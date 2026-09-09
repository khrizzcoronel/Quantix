from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timezone
import json

from typing import List, Optional
from decimal import Decimal
from uuid import UUID
from app.db.oltp import get_db
from app.api.deps import get_current_user, RoleChecker
from app.models.usuarios import Usuario, SesionCaja, EstadoSesionCaja, ArqueoCaja, AuditoriaEvento
from app.models.ventas import Venta, PagoVenta, EstadoVenta, Cliente
from app.schemas.caja import (
    AperturaCajaRequest, ArqueoCiegoRequest, SesionCajaResponse, 
    ArqueoResponse, SesionDetalleResponse, AuditoriaEventoResponse,
    CorteZResponse, EstadisticasHistoricasCajasResponse, EstadisticaCajeroItem,
    MiActividadResponse, MiActividadTicketItem
)
from app.api.ws import notif_manager

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

    await notif_manager.notificar_evento({
        "tipo": "APERTURA_CAJA",
        "titulo": f"Apertura de Turno ({req.terminal_id})",
        "mensaje": f"Cajero {current_user.nombre_completo} abrió caja en {req.terminal_id} con fondo de ${float(req.fondo_inicial):.2f}",
        "severidad": "INFO",
        "payload": {
            "sesion_id": str(nueva_sesion.id),
            "cajero": current_user.nombre_completo,
            "terminal_id": req.terminal_id,
            "fondo_inicial": float(req.fondo_inicial)
        }
    })
    
    # Compatibilidad con Pydantic y Enum
    response_dict = nueva_sesion.__dict__.copy()
    response_dict["estado"] = nueva_sesion.estado.value
    return SesionCajaResponse(**response_dict)


@router.get("/sesion-activa", response_model=Optional[SesionCajaResponse])
async def obtener_sesion_activa(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Devuelve la sesión abierta real del usuario autenticado, si existe."""
    result = await db.execute(
        select(SesionCaja).where(
            SesionCaja.usuario_id == current_user.id,
            SesionCaja.estado == EstadoSesionCaja.ABIERTA
        )
    )
    sesion = result.scalar_one_or_none()
    if not sesion:
        return None
    response_dict = sesion.__dict__.copy()
    response_dict["estado"] = sesion.estado.value
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
            Venta.estado.in_(['COMPLETADA', 'PAGADO'])
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
                "desglose_declarado": req.conteo_declarado.model_dump(mode="json")
            }
        )
        db.add(auditoria)
        
    await db.commit()
    
    # 6. Notificaciones en tiempo real vía WebSockets
    if requiere_auditoria:
        gravedad_ws = "CRITICO" if abs(diferencia) > 50 else "WARNING"
        await notif_manager.broadcast_alerta(
            tipo="ARQUEO_DESCUADRE",
            titulo=f"Alerta de Descuadre en Caja ({estado_cuadre})",
            mensaje=f"Cajero {current_user.nombre_completo} en terminal {sesion.terminal_id} registró un {estado_cuadre.lower()} de ${abs(diferencia):.2f}. Teórico: ${total_teorico:.2f}, Físico: ${total_fisico:.2f}.",
            severidad=gravedad_ws,
            payload={
                "sesion_id": str(sesion.id),
                "usuario_id": str(current_user.id),
                "usuario_nombre": current_user.nombre_completo,
                "terminal_id": sesion.terminal_id,
                "diferencia": round(diferencia, 2),
                "estado_cuadre": estado_cuadre,
                "total_teorico": round(total_teorico, 2),
                "total_fisico": round(total_fisico, 2)
            }
        )

    await notif_manager.notificar_evento({
        "tipo": "ARQUEO_REALIZADO",
        "titulo": f"Arqueo de Caja - {estado_cuadre}",
        "mensaje": f"Arqueo cerrado en terminal {sesion.terminal_id} por {current_user.nombre_completo}. Diferencia: ${diferencia:.2f}",
        "severidad": "CRITICO" if abs(diferencia) > 50 else ("WARNING" if requiere_auditoria else "SUCCESS"),
        "payload": {
            "sesion_id": str(sesion.id),
            "cajero": current_user.nombre_completo,
            "terminal_id": sesion.terminal_id,
            "diferencia": round(diferencia, 2),
            "estado": estado_cuadre,
            "total_teorico": round(total_teorico, 2),
            "total_fisico": round(total_fisico, 2)
        }
    })

    return ArqueoResponse(
        sesion_caja_id=sesion.id,
        total_teorico=total_teorico,
        total_fisico_declarado=total_fisico,
        diferencia=diferencia,
        estado=estado_cuadre,
        requiere_auditoria=requiere_auditoria,
        mensaje="Arqueo procesado y sesión cerrada exitosamente"
    )

@router.get("/sesiones", response_model=List[SesionDetalleResponse])
async def listar_sesiones(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(RoleChecker(['SUPERVISOR', 'DIRECTOR']))
):
    """
    Lista las sesiones de caja con sus resultados de arqueo y nombre del cajero.
    """
    query = (
        select(SesionCaja, Usuario.nombre.label("usuario_nombre"), ArqueoCaja)
        .join(Usuario, SesionCaja.usuario_id == Usuario.id)
        .outerjoin(ArqueoCaja, ArqueoCaja.sesion_caja_id == SesionCaja.id)
        .order_by(SesionCaja.fecha_apertura.desc())
    )
    result = await db.execute(query)
    rows = result.all()

    resp = []
    for ses, u_nom, arq in rows:
        resp.append(
            SesionDetalleResponse(
                id=ses.id,
                usuario_id=ses.usuario_id,
                usuario_nombre=u_nom,
                terminal_id=ses.terminal_id,
                fecha_apertura=ses.fecha_apertura,
                fecha_cierre=ses.fecha_cierre,
                fondo_inicial=ses.fondo_inicial,
                estado=ses.estado.value if hasattr(ses.estado, 'value') else str(ses.estado),
                total_teorico=arq.total_teorico if arq else None,
                total_fisico=arq.total_fisico_declarado if arq else None,
                diferencia=arq.diferencia if arq else None,
                estado_cuadre=arq.estado if arq else None
            )
        )
    return resp

@router.get("/auditoria", response_model=List[AuditoriaEventoResponse])
async def listar_eventos_auditoria(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(RoleChecker(['SUPERVISOR', 'DIRECTOR']))
):
    """
    Lista los eventos inmutables de auditoría forense.
    """
    query = (
        select(AuditoriaEvento, Usuario.nombre.label("usuario_nombre"))
        .join(Usuario, AuditoriaEvento.usuario_id == Usuario.id)
        .order_by(AuditoriaEvento.fecha_evento.desc())
        .limit(100)
    )
    result = await db.execute(query)
    rows = result.all()

    return [
        AuditoriaEventoResponse(
            id=ev.id,
            usuario_id=ev.usuario_id,
            usuario_nombre=u_nom,
            tipo_evento=ev.tipo_evento,
            descripcion=ev.descripcion,
            fecha_evento=ev.fecha_evento,
            gravedad=ev.gravedad,
            venta_referencia_id=ev.venta_referencia_id,
            usuario_autorizador_id=ev.usuario_autorizador_id,
            ip_terminal=ev.ip_terminal,
            detalle_json=ev.detalle_json
        )
        for ev, u_nom in rows
    ]


@router.get("/sesiones/{id}/corte-z", response_model=CorteZResponse)
async def obtener_corte_z(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    (RF-FISCAL-Z) Devuelve el resumen fiscal y contable detallado del turno (Corte Z).
    Incluye cajero, terminal, apertura/cierre, fondo inicial, ventas por método de pago,
    arqueo ciego declarado, descuadre/sobrante, y comprobantes emitidos.
    """
    sesion = await db.get(SesionCaja, id)
    if not sesion:
        raise HTTPException(status_code=404, detail="Sesión de caja no encontrada")

    rol_str = current_user.rol.value if hasattr(current_user.rol, 'value') else str(current_user.rol)
    if rol_str not in ['SUPERVISOR', 'DIRECTOR'] and sesion.usuario_id != current_user.id:
        raise HTTPException(status_code=403, detail="No tienes autorización para consultar el Corte Z de esta sesión")

    cajero = await db.get(Usuario, sesion.usuario_id)
    cajero_nombre = cajero.nombre if cajero else "Cajero No Registrado"
    cajero_email = cajero.email if cajero else None

    # Arqueo de la sesión si existe
    arq_q = await db.execute(
        select(ArqueoCaja).where(ArqueoCaja.sesion_caja_id == sesion.id).order_by(ArqueoCaja.fecha_arqueo.desc())
    )
    arqueo = arq_q.scalars().first()

    # Ventas asociadas a la sesión
    ventas_q = await db.execute(
        select(Venta).where(Venta.sesion_caja_id == sesion.id).order_by(Venta.fecha_hora.asc())
    )
    ventas = ventas_q.scalars().all()

    ventas_completadas = [v for v in ventas if (v.estado.value if hasattr(v.estado, 'value') else str(v.estado)) in {'COMPLETADA', 'PAGADO'}]
    tickets_anulados = sum(1 for v in ventas if (v.estado.value if hasattr(v.estado, 'value') else str(v.estado)) == 'ANULADA')

    primer_folio = ventas_completadas[0].folio_ticket if ventas_completadas else (ventas[0].folio_ticket if ventas else None)
    ultimo_folio = ventas_completadas[-1].folio_ticket if ventas_completadas else (ventas[-1].folio_ticket if ventas else None)

    total_bruto = sum((Decimal(str(v.total_bruto)) for v in ventas_completadas), Decimal("0.00"))
    total_descuento = sum((Decimal(str(v.total_descuento)) for v in ventas_completadas), Decimal("0.00"))
    total_impuestos = sum((Decimal(str(v.total_impuestos)) for v in ventas_completadas), Decimal("0.00"))
    total_ventas = sum((Decimal(str(v.total_pagar)) for v in ventas_completadas), Decimal("0.00"))

    # Pagos desglosados por método
    pagos_q = await db.execute(
        select(PagoVenta)
        .join(Venta, PagoVenta.venta_id == Venta.id)
        .where(Venta.sesion_caja_id == sesion.id, Venta.estado.in_(['COMPLETADA', 'PAGADO']))
    )
    pagos = pagos_q.scalars().all()

    ventas_efectivo = Decimal("0.00")
    ventas_tarjeta = Decimal("0.00")
    ventas_transferencia = Decimal("0.00")
    ventas_otros = Decimal("0.00")

    for p in pagos:
        metodo = p.metodo_pago.value if hasattr(p.metodo_pago, 'value') else str(p.metodo_pago)
        monto = Decimal(str(p.monto))
        if metodo == 'EFECTIVO':
            ventas_efectivo += monto
        elif metodo == 'TARJETA':
            ventas_tarjeta += monto
        elif metodo in ['TRANSFERENCIA', 'QR']:
            ventas_transferencia += monto
        else:
            ventas_otros += monto

    fondo_inicial = Decimal(str(sesion.fondo_inicial))
    total_teorico = Decimal(str(arqueo.total_teorico)) if arqueo else (fondo_inicial + ventas_efectivo + ventas_tarjeta + ventas_transferencia + ventas_otros)
    total_fisico = Decimal(str(arqueo.total_fisico_declarado)) if arqueo else None
    diferencia = Decimal(str(arqueo.diferencia)) if arqueo else None
    
    estado_sesion_str = sesion.estado.value if hasattr(sesion.estado, 'value') else str(sesion.estado)
    estado_cuadre = arqueo.estado if arqueo else ("PENDIENTE" if estado_sesion_str == 'ABIERTA' else "OK")

    folio_corte = f"Z-{str(sesion.id)[:8].upper()}"

    return CorteZResponse(
        sesion_id=sesion.id,
        folio_corte=folio_corte,
        cajero_id=sesion.usuario_id,
        cajero_nombre=cajero_nombre,
        cajero_email=cajero_email,
        terminal_id=sesion.terminal_id,
        fecha_apertura=sesion.fecha_apertura,
        fecha_cierre=sesion.fecha_cierre,
        fondo_inicial=fondo_inicial,
        total_ventas=total_ventas,
        total_bruto=total_bruto,
        total_descuento=total_descuento,
        total_impuestos=total_impuestos,
        ventas_efectivo=ventas_efectivo,
        ventas_tarjeta=ventas_tarjeta,
        ventas_transferencia=ventas_transferencia,
        ventas_otros=ventas_otros,
        total_tickets_emitidos=len(ventas_completadas),
        primer_folio=primer_folio,
        ultimo_folio=ultimo_folio,
        tickets_anulados=tickets_anulados,
        total_fisico_declarado=total_fisico,
        total_teorico=total_teorico,
        diferencia=diferencia,
        estado_cuadre=estado_cuadre,
        estado=estado_sesion_str,
        fecha_emision=datetime.now(timezone.utc)
    )


@router.get("/estadisticas-historicas", response_model=EstadisticasHistoricasCajasResponse)
async def obtener_estadisticas_historicas(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(RoleChecker(['CAJERO', 'SUPERVISOR', 'DIRECTOR']))
):
    """
    Retorna métricas comparativas de cajeros:
    total ventas acumuladas, promedio de tickets por turno, promedio y número de descuadres registrados,
    tasa de precisión de gaveta y KPIs consolidados.
    """
    # 1. Obtener todas las sesiones con sus usuarios y arqueos
    query_sesiones = (
        select(SesionCaja, Usuario, ArqueoCaja)
        .join(Usuario, SesionCaja.usuario_id == Usuario.id)
        .outerjoin(ArqueoCaja, ArqueoCaja.sesion_caja_id == SesionCaja.id)
        .order_by(SesionCaja.fecha_apertura.desc())
    )
    result_ses = await db.execute(query_sesiones)
    filas = result_ses.all()

    # 2. Obtener agregados de ventas por sesión
    query_ventas = (
        select(
            Venta.sesion_caja_id,
            func.count(Venta.id).label("tickets_count"),
            func.coalesce(func.sum(Venta.total_pagar), 0).label("monto_ventas")
        )
        .where(Venta.estado.in_(['COMPLETADA', 'PAGADO']))
        .group_by(Venta.sesion_caja_id)
    )
    result_v = await db.execute(query_ventas)
    ventas_map = {row[0]: {"tickets": row[1], "monto": Decimal(str(row[2]))} for row in result_v.all()}

    # 3. Agrupar datos por usuario (cajero)
    cajeros_data = {}
    for ses, u, arq in filas:
        uid = u.id
        if uid not in cajeros_data:
            cajeros_data[uid] = {
                "usuario_id": uid,
                "usuario_nombre": u.nombre,
                "usuario_email": u.email,
                "total_sesiones": 0,
                "total_ventas_acumuladas": Decimal("0.00"),
                "total_tickets": 0,
                "descuadres": [],
                "ultima_sesion_fecha": ses.fecha_apertura,
                "ultimo_estado": ses.estado.value if hasattr(ses.estado, 'value') else str(ses.estado)
            }

        cajero_dict = cajeros_data[uid]
        cajero_dict["total_sesiones"] += 1

        v_info = ventas_map.get(ses.id, {"tickets": 0, "monto": Decimal("0.00")})
        cajero_dict["total_ventas_acumuladas"] += v_info["monto"]
        cajero_dict["total_tickets"] += v_info["tickets"]

        if arq:
            dif = Decimal(str(arq.diferencia))
            if arq.estado != "OK" or abs(dif) > Decimal(str(TOLERANCIA_DESCUADRE_MAX)):
                cajero_dict["descuadres"].append(dif)

    # 4. Formatear lista de cajeros y calcular métricas globales
    lista_cajeros = []
    total_ventas_general = Decimal("0.00")
    total_sesiones_general = 0
    total_tickets_general = 0
    total_descuadres_general = 0

    for uid, data in cajeros_data.items():
        total_ses = data["total_sesiones"]
        tot_tickets = data["total_tickets"]
        descs = data["descuadres"]
        num_descuadres = len(descs)
        prom_tickets = round(float(tot_tickets) / total_ses, 1) if total_ses > 0 else 0.0
        prom_descuadre = round(sum((abs(d) for d in descs), Decimal("0.00")) / num_descuadres, 2) if num_descuadres > 0 else Decimal("0.00")
        precision = round(((total_ses - num_descuadres) / total_ses) * 100, 1) if total_ses > 0 else 100.0

        item = EstadisticaCajeroItem(
            usuario_id=data["usuario_id"],
            usuario_nombre=data["usuario_nombre"],
            usuario_email=data["usuario_email"],
            total_sesiones=total_ses,
            total_ventas_acumuladas=data["total_ventas_acumuladas"],
            total_tickets=tot_tickets,
            promedio_tickets_por_turno=prom_tickets,
            total_descuadres=num_descuadres,
            promedio_descuadre=prom_descuadre,
            precision_gaveta_pct=precision,
            ultima_sesion_fecha=data["ultima_sesion_fecha"],
            ultimo_estado=data["ultimo_estado"]
        )
        lista_cajeros.append(item)

        total_ventas_general += data["total_ventas_acumuladas"]
        total_sesiones_general += total_ses
        total_tickets_general += tot_tickets
        total_descuadres_general += num_descuadres

    tasa_precision_global = round(((total_sesiones_general - total_descuadres_general) / total_sesiones_general) * 100, 1) if total_sesiones_general > 0 else 100.0
    prom_tickets_global = round(float(total_tickets_general) / total_sesiones_general, 1) if total_sesiones_general > 0 else 0.0

    # Ordenar por ventas acumuladas descendente
    lista_cajeros.sort(key=lambda x: x.total_ventas_acumuladas, reverse=True)

    return EstadisticasHistoricasCajasResponse(
        metricas_globales={
            "total_ventas_general": float(total_ventas_general),
            "total_sesiones": total_sesiones_general,
            "total_tickets": total_tickets_general,
            "promedio_tickets_por_turno_global": prom_tickets_global,
            "total_descuadres_global": total_descuadres_general,
            "tasa_precision_gaveta_global": tasa_precision_global
        },
        cajeros=lista_cajeros
    )


@router.get("/mi-actividad", response_model=MiActividadResponse)
async def obtener_mi_actividad(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Retorna la actividad del operador autenticado durante el día actual:
    sesión activa de caja, ventas emitidas hoy y eventos de auditoría registrados.
    """
    # 1. Sesión activa actual
    q_ses_activa = (
        select(SesionCaja, ArqueoCaja)
        .outerjoin(ArqueoCaja, ArqueoCaja.sesion_caja_id == SesionCaja.id)
        .where(
            SesionCaja.usuario_id == current_user.id,
            SesionCaja.estado == EstadoSesionCaja.ABIERTA
        )
    )
    res_ses = await db.execute(q_ses_activa)
    fila_ses = res_ses.first()

    ses_detalle = None
    if fila_ses:
        s_obj, a_obj = fila_ses
        ses_detalle = SesionDetalleResponse(
            id=s_obj.id,
            usuario_id=s_obj.usuario_id,
            usuario_nombre=current_user.nombre,
            terminal_id=s_obj.terminal_id,
            fecha_apertura=s_obj.fecha_apertura,
            fecha_cierre=s_obj.fecha_cierre,
            fondo_inicial=s_obj.fondo_inicial,
            estado=s_obj.estado.value if hasattr(s_obj.estado, 'value') else str(s_obj.estado),
            total_teorico=a_obj.total_teorico if a_obj else None,
            total_fisico=a_obj.total_fisico_declarado if a_obj else None,
            diferencia=a_obj.diferencia if a_obj else None,
            estado_cuadre=a_obj.estado if a_obj else None
        )

    # 2. Rango de hoy (00:00:00 UTC en adelante)
    hoy_inicio = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    # 3. Tickets de hoy para sesiones del usuario
    q_tickets = (
        select(Venta, Cliente.nombre.label("cliente_nombre"))
        .join(SesionCaja, Venta.sesion_caja_id == SesionCaja.id)
        .outerjoin(Cliente, Venta.cliente_id == Cliente.id)
        .where(
            SesionCaja.usuario_id == current_user.id,
            Venta.fecha_hora >= hoy_inicio
        )
        .order_by(Venta.fecha_hora.desc())
        .limit(100)
    )
    res_tkt = await db.execute(q_tickets)
    filas_tkt = res_tkt.all()

    tickets_list = []
    total_monto_hoy = Decimal("0.00")
    total_descuento_hoy = Decimal("0.00")
    total_impuestos_hoy = Decimal("0.00")
    anulados_hoy = 0

    for v, c_nom in filas_tkt:
        est = v.estado.value if hasattr(v.estado, 'value') else str(v.estado)
        if est == 'COMPLETADA':
            total_monto_hoy += Decimal(str(v.total_pagar))
            total_descuento_hoy += Decimal(str(v.total_descuento))
            total_impuestos_hoy += Decimal(str(v.total_impuestos))
        elif est == 'ANULADA':
            anulados_hoy += 1

        tickets_list.append(
            MiActividadTicketItem(
                id=v.id,
                folio_ticket=v.folio_ticket,
                fecha_hora=v.fecha_hora,
                total_pagar=Decimal(str(v.total_pagar)),
                estado=est,
                cliente_nombre=c_nom
            )
        )

    # 4. Eventos de auditoría de hoy para el usuario
    q_aud = (
        select(AuditoriaEvento)
        .where(
            AuditoriaEvento.usuario_id == current_user.id,
            AuditoriaEvento.fecha_evento >= hoy_inicio
        )
        .order_by(AuditoriaEvento.fecha_evento.desc())
        .limit(50)
    )
    res_aud = await db.execute(q_aud)
    aud_list = [
        AuditoriaEventoResponse(
            id=ev.id,
            usuario_id=ev.usuario_id,
            usuario_nombre=current_user.nombre,
            tipo_evento=ev.tipo_evento,
            descripcion=ev.descripcion,
            fecha_evento=ev.fecha_evento,
            gravedad=ev.gravedad,
            venta_referencia_id=ev.venta_referencia_id,
            usuario_autorizador_id=ev.usuario_autorizador_id,
            ip_terminal=ev.ip_terminal,
            detalle_json=ev.detalle_json
        )
        for ev in res_aud.scalars().all()
    ]

    resumen = {
        "total_tickets": len(tickets_list),
        "total_monto": float(total_monto_hoy),
        "total_descuento": float(total_descuento_hoy),
        "total_impuestos": float(total_impuestos_hoy),
        "tickets_anulados": anulados_hoy,
        "promedio_ticket": round(float(total_monto_hoy) / len(tickets_list), 2) if tickets_list else 0.0
    }

    return MiActividadResponse(
        sesion_activa=ses_detalle,
        resumen_hoy=resumen,
        tickets_hoy=tickets_list,
        eventos_auditoria_hoy=aud_list
    )
