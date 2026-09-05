from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timezone
import json

from app.db.oltp import get_db
from app.api.deps import get_current_user, RoleChecker
from app.models.usuarios import Usuario, SesionCaja, EstadoSesionCaja, ArqueoCaja, AuditoriaEvento
from app.models.ventas import Venta, PagoVenta
from app.schemas.caja import AperturaCajaRequest, ArqueoCiegoRequest, SesionCajaResponse, ArqueoResponse

router = APIRouter()

# Tolerancia permitida en la caja antes de levantar una alerta crítica
TOLERANCIA_DESCUADRE_MAX = 5.00

@router.post("/abrir", response_model=SesionCajaResponse)
async def abrir_caja(
    req: AperturaCajaRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(RoleChecker(['CAJERO', 'SUPERVISOR', 'DIRECTOR']))
):
    """
    Inicia una nueva sesión de caja. Solo se permite tener una sesión activa por usuario.
    """
    # Verificar que no tenga ya una sesión abierta
    sesion_existente = await db.execute(
        select(SesionCaja).where(
            SesionCaja.usuario_id == current_user.id,
            SesionCaja.estado == EstadoSesionCaja.ABIERTA
        )
    )
    if sesion_existente.scalar_one_or_none():
        raise HTTPException(
            status_code=400, 
            detail="El usuario ya tiene una sesión de caja abierta"
        )
        
    nueva_sesion = SesionCaja(
        usuario_id=current_user.id,
        terminal_id=req.terminal_id,
        fondo_inicial=req.fondo_inicial,
        estado=EstadoSesionCaja.ABIERTA
    )
    db.add(nueva_sesion)
    
    # Rastro de auditoría inmutable
    auditoria = AuditoriaEvento(
        usuario_id=current_user.id,
        tipo_evento="APERTURA_CAJA",
        descripcion=f"Apertura de caja en terminal {req.terminal_id} con fondo de {req.fondo_inicial}",
        gravedad="INFO",
        ip_terminal=req.terminal_id
    )
    db.add(auditoria)
    
    await db.commit()
    await db.refresh(nueva_sesion)
    
    # Compatibilidad con Pydantic y Enum
    response_dict = nueva_sesion.__dict__.copy()
    response_dict["estado"] = nueva_sesion.estado.value
    return SesionCajaResponse(**response_dict)


@router.post("/arqueo-ciego", response_model=ArqueoResponse)
async def arqueo_ciego(
    req: ArqueoCiegoRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    (RF-SEG-01) Realiza el Arqueo Ciego. El cajero envía cuánto contó físicamente.
    El sistema lo contrasta con el teórico y decide si cuadra, sobra o falta, cerrando la sesión.
    """
    sesion = await db.get(SesionCaja, current_user.id) # Espera, el user solo tiene una, es mejor buscar por ID de sesión. 
    # Corrección: El req no tiene el ID de sesión pero asumimos que busca la activa.
    sesiones = await db.execute(
        select(SesionCaja).where(
            SesionCaja.usuario_id == current_user.id,
            SesionCaja.estado == EstadoSesionCaja.ABIERTA
        )
    )
    sesion = sesiones.scalar_one_or_none()
    
    if not sesion:
        raise HTTPException(status_code=404, detail="No tienes una sesión de caja abierta")

    # 1. Calcular total teórico = fondo_inicial + sum(pagos de ventas completadas de esta sesion)
    # Subquery para obtener ventas completadas de la sesión
    query_pagos = (
        select(func.sum(PagoVenta.monto))
        .select_from(PagoVenta)
        .join(Venta)
        .where(
            Venta.sesion_caja_id == sesion.id,
            Venta.estado == 'COMPLETADA'
        )
    )
    result_pagos = await db.execute(query_pagos)
    suma_pagos = result_pagos.scalar() or 0.0
    
    total_teorico = float(sesion.fondo_inicial) + float(suma_pagos)
    total_fisico = float(req.conteo_declarado.total)
    
    diferencia = total_fisico - total_teorico
    
    # 2. Determinar estado
    estado_cuadre = "OK"
    if diferencia > TOLERANCIA_DESCUADRE_MAX:
        estado_cuadre = "SOBRANTE"
    elif diferencia < -TOLERANCIA_DESCUADRE_MAX:
        estado_cuadre = "FALTANTE"
        
    requiere_auditoria = estado_cuadre != "OK"
    
    # 3. Guardar el Arqueo
    arqueo = ArqueoCaja(
        sesion_caja_id=sesion.id,
        total_teorico=total_teorico,
        total_fisico_declarado=total_fisico,
        diferencia=diferencia,
        estado=estado_cuadre
    )
    db.add(arqueo)
    
    # 4. Cerrar la sesión
    sesion.estado = EstadoSesionCaja.DESCUADRE if requiere_auditoria else EstadoSesionCaja.CERRADA
    sesion.fecha_cierre = datetime.now(timezone.utc)
    
    # 5. Generar alerta en Auditoría si hay descuadre
    if requiere_auditoria:
        auditoria = AuditoriaEvento(
            usuario_id=current_user.id,
            tipo_evento="DESCUADRE_CAJA",
            descripcion=f"Cierre de caja con {estado_cuadre} de {abs(diferencia)}",
            gravedad="CRITICA" if abs(diferencia) > 50 else "MEDIA",
            ip_terminal=sesion.terminal_id,
            detalle_json={
                "fisico": total_fisico, 
                "teorico": total_teorico, 
                "desglose_declarado": req.conteo_declarado.model_dump()
            }
        )
        db.add(auditoria)
        
    await db.commit()
    
    return ArqueoResponse(
        sesion_caja_id=sesion.id,
        total_teorico=total_teorico,
        total_fisico_declarado=total_fisico,
        diferencia=diferencia,
        estado=estado_cuadre,
        requiere_auditoria=requiere_auditoria,
        mensaje="Arqueo procesado y sesión cerrada exitosamente"
    )
