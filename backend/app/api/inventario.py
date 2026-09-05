from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from datetime import date, timedelta
from uuid import UUID

from app.db.oltp import get_db
from app.api.deps import RoleChecker, get_current_user
from app.models.usuarios import Usuario
from app.models.inventario import OrdenCompra, DetalleOrdenCompra, EstadoOrdenCompra, LoteInventario, EstadoLote
from app.schemas.inventario import (
    OrdenCompraRequest, OrdenCompraResponse, 
    RecepcionOrdenRequest, LoteResponse
)

router = APIRouter()

# El inventario y compras solo lo manejan BODEGUERO, SUPERVISOR y DIRECTOR.
bodega_roles = RoleChecker(["BODEGUERO", "SUPERVISOR", "DIRECTOR"])

@router.post("/orden-compra", response_model=OrdenCompraResponse)
async def crear_orden_compra(
    req: OrdenCompraRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(bodega_roles)
):
    """
    Crea una nueva Orden de Compra en estado PENDIENTE.
    """
    nueva_orden = OrdenCompra(
        proveedor_id=req.proveedor_id,
        usuario_solicitante_id=current_user.id,
        estado=EstadoOrdenCompra.PENDIENTE,
        notas=req.notas
    )
    db.add(nueva_orden)
    await db.flush()
    
    for item in req.items:
        detalle = DetalleOrdenCompra(
            orden_compra_id=nueva_orden.id,
            producto_id=item.producto_id,
            cantidad_solicitada=item.cantidad_solicitada,
            costo_unitario_pactado=item.costo_unitario_pactado
        )
        db.add(detalle)
        
    await db.commit()
    return nueva_orden

@router.post("/recepcion/{orden_id}", response_model=List[LoteResponse])
async def recibir_orden(
    orden_id: UUID,
    req: RecepcionOrdenRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(bodega_roles)
):
    """
    Recibe el inventario físico de una orden de compra, generando
    automáticamente los Lotes con estado ACTIVO para ser consumidos por el FEFO del POS.
    """
    orden = await db.get(OrdenCompra, orden_id)
    if not orden:
        raise HTTPException(status_code=404, detail="Orden de compra no encontrada")
        
    if orden.estado in [EstadoOrdenCompra.RECIBIDA, EstadoOrdenCompra.CANCELADA]:
        raise HTTPException(status_code=400, detail="La orden ya fue procesada o cancelada")
        
    lotes_creados = []
    
    for item in req.items:
        # Aquí se crea el Lote que alimentará la venta FEFO
        nuevo_lote = LoteInventario(
            producto_id=item.producto_id,
            orden_compra_id=orden.id,
            codigo_lote=item.codigo_lote,
            cantidad_inicial=item.cantidad_recibida,
            cantidad_disponible=item.cantidad_recibida,
            costo_unitario=item.costo_unitario_real,
            fecha_vencimiento=item.fecha_vencimiento,
            estado=EstadoLote.ACTIVO
        )
        db.add(nuevo_lote)
        lotes_creados.append(nuevo_lote)
        
    orden.estado = EstadoOrdenCompra.RECIBIDA
    
    # En un sistema completo registraríamos AuditoriaEvento aquí
    await db.commit()
    
    # Refrescar los lotes para poder devolverlos serializados
    for lote in lotes_creados:
        await db.refresh(lote)
        
    return lotes_creados

@router.get("/alertas-caducidad", response_model=List[LoteResponse])
async def alertas_caducidad(
    dias_alerta: int = 30,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(bodega_roles)
):
    """
    (RF-INV-03) Retorna los lotes activos cuya fecha de vencimiento es menor
    o igual a (HOY + dias_alerta). Ideal para ejecutar en un job de notificaciones.
    """
    fecha_limite = date.today() + timedelta(days=dias_alerta)
    
    query = select(LoteInventario).where(
        LoteInventario.estado == EstadoLote.ACTIVO,
        LoteInventario.fecha_vencimiento <= fecha_limite,
        LoteInventario.cantidad_disponible > 0
    ).order_by(LoteInventario.fecha_vencimiento.asc())
    
    result = await db.execute(query)
    lotes_proximos_vencer = result.scalars().all()
    
    return lotes_proximos_vencer
