from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone
import random

from app.db.oltp import get_db
from app.api.deps import get_current_user, RoleChecker
from app.models.usuarios import Usuario
from app.models.sucursal import Sucursal, TransferenciaInventario, DetalleTransferencia, EstadoTransferencia
from app.models.inventario import Producto, LoteInventario, EstadoLote
from app.schemas.sucursal import (
    TransferenciaCreate, TransferenciaResponse, DetalleTransferenciaResponse
)

router = APIRouter()

def _query_transferencia_completa():
    return (
        select(TransferenciaInventario)
        .options(
            selectinload(TransferenciaInventario.sucursal_origen),
            selectinload(TransferenciaInventario.sucursal_destino),
            selectinload(TransferenciaInventario.usuario_solicita),
            selectinload(TransferenciaInventario.usuario_recibe),
            selectinload(TransferenciaInventario.detalles).selectinload(DetalleTransferencia.producto),
            selectinload(TransferenciaInventario.detalles).selectinload(DetalleTransferencia.lote_origen),
        )
    )

def _map_transferencia_response(t: TransferenciaInventario) -> TransferenciaResponse:
    detalles_resp = []
    for d in (t.detalles or []):
        detalles_resp.append(
            DetalleTransferenciaResponse(
                id=d.id,
                producto_id=d.producto_id,
                producto_nombre=d.producto.nombre if d.producto else None,
                producto_sku=d.producto.sku if d.producto else None,
                cantidad=d.cantidad,
                lote_origen_id=d.lote_origen_id,
                lote_origen_codigo=d.lote_origen.codigo_lote if d.lote_origen else None,
                lote_destino_id=d.lote_destino_id
            )
        )

    return TransferenciaResponse(
        id=t.id,
        folio=t.folio,
        sucursal_origen_id=t.sucursal_origen_id,
        sucursal_origen_nombre=t.sucursal_origen.nombre if t.sucursal_origen else None,
        sucursal_destino_id=t.sucursal_destino_id,
        sucursal_destino_nombre=t.sucursal_destino.nombre if t.sucursal_destino else None,
        usuario_solicita_id=t.usuario_solicita_id,
        usuario_solicita_nombre=t.usuario_solicita.nombre if t.usuario_solicita else None,
        usuario_recibe_id=t.usuario_recibe_id,
        usuario_recibe_nombre=t.usuario_recibe.nombre if t.usuario_recibe else None,
        estado=t.estado.value if hasattr(t.estado, 'value') else str(t.estado),
        fecha_solicitud=t.fecha_solicitud,
        fecha_despacho=t.fecha_despacho,
        fecha_recepcion=t.fecha_recepcion,
        notas=t.notas,
        detalles=detalles_resp
    )

async def _obtener_t_completa(id: UUID, db: AsyncSession) -> Optional[TransferenciaInventario]:
    q = _query_transferencia_completa().where(TransferenciaInventario.id == id)
    res = await db.execute(q)
    return res.scalar_one_or_none()

@router.get("", response_model=List[TransferenciaResponse])
async def listar_transferencias(
    origen_id: Optional[UUID] = None,
    destino_id: Optional[UUID] = None,
    estado: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Lista las transferencias de inventario entre sucursales con eager loading.
    Supervisores y bodegueros solo tienen acceso a transferencias donde su sede sea origen o destino.
    """
    rol_str = current_user.rol.value if hasattr(current_user.rol, 'value') else str(current_user.rol)
    query = _query_transferencia_completa().order_by(TransferenciaInventario.fecha_solicitud.desc())

    if rol_str != "DIRECTOR" and current_user.sucursal_id:
        if (origen_id and origen_id != current_user.sucursal_id and not destino_id) or \
           (destino_id and destino_id != current_user.sucursal_id and not origen_id) or \
           (origen_id and origen_id != current_user.sucursal_id and destino_id and destino_id != current_user.sucursal_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acceso denegado: Solo puedes consultar transferencias donde tu sucursal sea origen o destino"
            )
        query = query.where(
            or_(
                TransferenciaInventario.sucursal_origen_id == current_user.sucursal_id,
                TransferenciaInventario.sucursal_destino_id == current_user.sucursal_id
            )
        )

    if origen_id:
        query = query.where(TransferenciaInventario.sucursal_origen_id == origen_id)
    if destino_id:
        query = query.where(TransferenciaInventario.sucursal_destino_id == destino_id)
    if estado:
        query = query.where(TransferenciaInventario.estado == EstadoTransferencia(estado))

    result = await db.execute(query)
    transferencias = result.scalars().all()
    return [_map_transferencia_response(t) for t in transferencias]

@router.get("/{id}", response_model=TransferenciaResponse)
async def obtener_transferencia(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    transferencia = await _obtener_t_completa(id, db)
    if not transferencia:
        raise HTTPException(status_code=404, detail="Transferencia no encontrada")

    rol_str = current_user.rol.value if hasattr(current_user.rol, 'value') else str(current_user.rol)
    if rol_str != "DIRECTOR" and current_user.sucursal_id:
        if (transferencia.sucursal_origen_id != current_user.sucursal_id and 
            transferencia.sucursal_destino_id != current_user.sucursal_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acceso denegado: No tienes autorización para consultar transferencias de otras sucursales"
            )

    return _map_transferencia_response(transferencia)

@router.post("", response_model=TransferenciaResponse, status_code=status.HTTP_201_CREATED)
async def solicitar_transferencia(
    req: TransferenciaCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(RoleChecker(['BODEGUERO', 'SUPERVISOR', 'DIRECTOR']))
):
    """
    Registra una solicitud de traspaso inter-sucursal.
    """
    if req.sucursal_origen_id == req.sucursal_destino_id:
        raise HTTPException(status_code=400, detail="La sucursal de origen y destino deben ser distintas")

    rol_str = current_user.rol.value if hasattr(current_user.rol, 'value') else str(current_user.rol)
    if rol_str != "DIRECTOR" and current_user.sucursal_id:
        if (req.sucursal_origen_id != current_user.sucursal_id and 
            req.sucursal_destino_id != current_user.sucursal_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acceso denegado: Solo puedes solicitar transferencias donde tu sucursal sea origen o destino"
            )

    suc_origen = await db.get(Sucursal, req.sucursal_origen_id)
    suc_destino = await db.get(Sucursal, req.sucursal_destino_id)
    if not suc_origen or not suc_destino:
        raise HTTPException(status_code=404, detail="Una o ambas sucursales no existen")

    ahora = datetime.now(timezone.utc)
    rand_code = ''.join(random.choices('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', k=4))
    folio = f"TR-{ahora.strftime('%Y%m%d')}-{rand_code}"

    transferencia = TransferenciaInventario(
        folio=folio,
        sucursal_origen_id=req.sucursal_origen_id,
        sucursal_destino_id=req.sucursal_destino_id,
        usuario_solicita_id=current_user.id,
        estado=EstadoTransferencia.SOLICITADA,
        notas=req.notas.strip() if req.notas else None
    )
    db.add(transferencia)
    await db.flush()

    for item in req.items:
        prod = await db.get(Producto, item.producto_id)
        if not prod:
            raise HTTPException(status_code=404, detail=f"Producto {item.producto_id} no encontrado")

        lote_id = item.lote_origen_id
        if lote_id:
            lote = await db.get(LoteInventario, lote_id)
            if not lote or lote.producto_id != prod.id:
                raise HTTPException(status_code=400, detail=f"Lote {lote_id} inválido para el producto {prod.sku}")
            if lote.sucursal_id and lote.sucursal_id != req.sucursal_origen_id:
                raise HTTPException(status_code=400, detail=f"El lote {lote.codigo_lote} no pertenece a la sucursal de origen")
            if float(lote.cantidad_disponible) < float(item.cantidad):
                raise HTTPException(status_code=400, detail=f"Stock insuficiente en lote {lote.codigo_lote} ({lote.cantidad_disponible} disponibles, se solicitaron {item.cantidad})")
        else:
            # Buscar lote FEFO disponible en la sucursal de origen
            is_matriz = str(req.sucursal_origen_id) == "00000000-0000-0000-0000-000000000001"
            suc_cond = or_(LoteInventario.sucursal_id == req.sucursal_origen_id, LoteInventario.sucursal_id.is_(None)) if is_matriz else (LoteInventario.sucursal_id == req.sucursal_origen_id)

            q_lotes = (
                select(LoteInventario)
                .where(
                    LoteInventario.producto_id == prod.id,
                    suc_cond,
                    LoteInventario.estado == EstadoLote.ACTIVO,
                    LoteInventario.cantidad_disponible > 0
                )
                .order_by(LoteInventario.fecha_vencimiento.asc().nullslast())
            )
            res_lotes = await db.execute(q_lotes)
            lote = res_lotes.scalars().first()
            if not lote or float(lote.cantidad_disponible) < float(item.cantidad):
                raise HTTPException(
                    status_code=400, 
                    detail=f"Stock insuficiente en sucursal origen para {prod.nombre} ({prod.sku})"
                )
            lote_id = lote.id

        detalle = DetalleTransferencia(
            transferencia_id=transferencia.id,
            producto_id=prod.id,
            lote_origen_id=lote_id,
            cantidad=float(item.cantidad)
        )
        db.add(detalle)

    await db.commit()
    t_completa = await _obtener_t_completa(transferencia.id, db)
    return _map_transferencia_response(t_completa or transferencia)

@router.post("/{id}/despachar", response_model=TransferenciaResponse)
async def despachar_transferencia(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(RoleChecker(['BODEGUERO', 'SUPERVISOR', 'DIRECTOR']))
):
    """
    Despacha la mercancía de la sucursal origen. El inventario sale y pasa a estado EN_TRANSITO.
    """
    transferencia = await _obtener_t_completa(id, db)
    if not transferencia:
        raise HTTPException(status_code=404, detail="Transferencia no encontrada")

    rol_str = current_user.rol.value if hasattr(current_user.rol, 'value') else str(current_user.rol)
    if rol_str != "DIRECTOR" and current_user.sucursal_id:
        if transferencia.sucursal_origen_id != current_user.sucursal_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acceso denegado: Solo el personal de la sucursal origen puede despachar esta transferencia"
            )

    if transferencia.estado != EstadoTransferencia.SOLICITADA:
        raise HTTPException(status_code=400, detail=f"No se puede despachar una transferencia en estado {transferencia.estado.value}")

    for det in (transferencia.detalles or []):
        if det.lote_origen_id:
            lote = await db.get(LoteInventario, det.lote_origen_id)
            if lote:
                cant_desc = float(det.cantidad)
                if float(lote.cantidad_disponible) < cant_desc:
                    raise HTTPException(status_code=400, detail=f"Stock insuficiente al despachar lote {lote.codigo_lote}")
                lote.cantidad_disponible = float(lote.cantidad_disponible) - cant_desc
                if float(lote.cantidad_disponible) <= 0:
                    lote.estado = EstadoLote.AGOTADO

    transferencia.estado = EstadoTransferencia.EN_TRANSITO
    transferencia.fecha_despacho = datetime.now(timezone.utc)

    await db.commit()
    t_completa = await _obtener_t_completa(transferencia.id, db)
    return _map_transferencia_response(t_completa or transferencia)

@router.post("/{id}/recibir", response_model=TransferenciaResponse)
async def recibir_transferencia(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(RoleChecker(['BODEGUERO', 'SUPERVISOR', 'DIRECTOR']))
):
    """
    Recibe la transferencia en la sucursal de destino.
    Genera lotes sanitarios activos en la sucursal destino preservando caducidad y costo.
    """
    transferencia = await _obtener_t_completa(id, db)
    if not transferencia:
        raise HTTPException(status_code=404, detail="Transferencia no encontrada")

    rol_str = current_user.rol.value if hasattr(current_user.rol, 'value') else str(current_user.rol)
    if rol_str != "DIRECTOR" and current_user.sucursal_id:
        if transferencia.sucursal_destino_id != current_user.sucursal_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acceso denegado: Solo el personal de la sucursal destino puede recibir esta transferencia"
            )

    if transferencia.estado not in [EstadoTransferencia.EN_TRANSITO, EstadoTransferencia.SOLICITADA]:
        raise HTTPException(status_code=400, detail=f"No se puede recibir una transferencia en estado {transferencia.estado.value}")

    ahora = datetime.now(timezone.utc)
    fecha_tag = ahora.strftime('%Y%m%d')

    # Si estaba SOLICITADA y se recibe directamente, descontar primero del origen
    if transferencia.estado == EstadoTransferencia.SOLICITADA:
        for det in (transferencia.detalles or []):
            if det.lote_origen_id:
                lote = await db.get(LoteInventario, det.lote_origen_id)
                if lote:
                    lote.cantidad_disponible = float(lote.cantidad_disponible) - float(det.cantidad)
                    if float(lote.cantidad_disponible) <= 0:
                        lote.estado = EstadoLote.AGOTADO
        transferencia.fecha_despacho = ahora

    # Generar lotes en la sucursal de destino
    for det in (transferencia.detalles or []):
        lote_orig = await db.get(LoteInventario, det.lote_origen_id) if det.lote_origen_id else None
        prod = await db.get(Producto, det.producto_id)
        sku = prod.sku if prod else "PRD"
        orig_code = lote_orig.codigo_lote if lote_orig else f"SAN-{fecha_tag}-{sku}"
        nuevo_codigo = f"TR-{orig_code}"[-30:]

        nuevo_lote = LoteInventario(
            producto_id=det.producto_id,
            codigo_lote=nuevo_codigo,
            cantidad_inicial=float(det.cantidad),
            cantidad_disponible=float(det.cantidad),
            costo_unitario=float(lote_orig.costo_unitario if lote_orig else (prod.costo_base if prod else 0)),
            fecha_vencimiento=lote_orig.fecha_vencimiento if lote_orig else None,
            estado=EstadoLote.ACTIVO,
            sucursal_id=transferencia.sucursal_destino_id
        )
        db.add(nuevo_lote)
        await db.flush()
        det.lote_destino_id = nuevo_lote.id

    transferencia.estado = EstadoTransferencia.RECIBIDA
    transferencia.usuario_recibe_id = current_user.id
    transferencia.fecha_recepcion = ahora

    await db.commit()
    t_completa = await _obtener_t_completa(transferencia.id, db)
    return _map_transferencia_response(t_completa or transferencia)

@router.post("/{id}/cancelar", response_model=TransferenciaResponse)
async def cancelar_transferencia(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(RoleChecker(['SUPERVISOR', 'DIRECTOR']))
):
    """
    Cancela una transferencia. Si ya había sido despachada, reintegra las existencias al origen.
    """
    transferencia = await _obtener_t_completa(id, db)
    if not transferencia:
        raise HTTPException(status_code=404, detail="Transferencia no encontrada")
    if transferencia.estado == EstadoTransferencia.RECIBIDA:
        raise HTTPException(status_code=400, detail="No se puede cancelar una transferencia que ya fue RECIBIDA")
    if transferencia.estado == EstadoTransferencia.CANCELADA:
        raise HTTPException(status_code=400, detail="La transferencia ya está cancelada")

    if transferencia.estado == EstadoTransferencia.EN_TRANSITO:
        for det in (transferencia.detalles or []):
            if det.lote_origen_id:
                lote = await db.get(LoteInventario, det.lote_origen_id)
                if lote:
                    lote.cantidad_disponible = float(lote.cantidad_disponible) + float(det.cantidad)
                    lote.estado = EstadoLote.ACTIVO

    transferencia.estado = EstadoTransferencia.CANCELADA
    await db.commit()
    t_completa = await _obtener_t_completa(transferencia.id, db)
    return _map_transferencia_response(t_completa or transferencia)
