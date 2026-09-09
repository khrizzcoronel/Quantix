import datetime
import logging
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, RoleChecker
from app.api.ws import notif_manager
from app.db.oltp import get_db
from app.models.inventario import EstadoLote, LoteInventario, Producto
from app.models.sync import IncidenciaSync, VentaOfflineRecibida
from app.models.usuarios import EstadoSesionCaja, SesionCaja, Usuario
from app.models.ventas import DetalleVenta, EstadoVenta, PagoVenta, Venta
from app.schemas.sync import (
    IncidenciaSyncResponse,
    LoteSyncVentasRequest,
    ResolverIncidenciaRequest,
    ResultadoVentaSyncItem,
    SyncLoteResponse,
)

router = APIRouter()
logger = logging.getLogger(__name__)

supervisor_o_director = RoleChecker(["SUPERVISOR", "DIRECTOR"])
CENTAVOS = Decimal("0.01")
IVA_RATE = Decimal("0.16")


def redondear_moneda(valor: Decimal) -> Decimal:
    return valor.quantize(CENTAVOS, rounding=ROUND_HALF_UP)


@router.post("/ventas-offline", response_model=SyncLoteResponse)
async def sincronizar_ventas_offline(
    req: LoteSyncVentasRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Sincroniza un lote de ventas realizadas en modo offline.
    Procesa las ventas en orden FIFO de forma aislada por transacción/savepoint.
    Aplica motor FEFO para la asignación de lotes e idempotencia estricta por id_local.
    """
    procesadas = 0
    exitosas = 0
    conflictos = 0
    detalles: List[ResultadoVentaSyncItem] = []

    for venta_in in req.ventas:
        procesadas += 1

        try:
            async with db.begin_nested():
                # 1. Idempotencia: Verificar si ya existe en ventas_offline_recibidas
                recibida_stmt = (
                    select(VentaOfflineRecibida)
                    .where(VentaOfflineRecibida.id_local == venta_in.id_local)
                    .options(selectinload(VentaOfflineRecibida.venta))
                )
                recibida_res = await db.execute(recibida_stmt)
                existente = recibida_res.scalar_one_or_none()

                if existente:
                    if existente.estado in {"SINCRONIZADA", "YA_PROCESADA"}:
                        folio = existente.venta.folio_ticket if existente.venta else None
                        exitosas += 1
                        detalles.append(
                            ResultadoVentaSyncItem(
                                id_local=venta_in.id_local,
                                estado="YA_PROCESADA",
                                venta_id=existente.venta_id,
                                folio_ticket=folio,
                                mensaje="Venta ya procesada anteriormente; se devuelve el registro existente",
                            )
                        )
                        continue
                    elif existente.estado == "PENDIENTE_REVISION":
                        conflictos += 1
                        detalles.append(
                            ResultadoVentaSyncItem(
                                id_local=venta_in.id_local,
                                estado="PENDIENTE_REVISION",
                                venta_id=existente.venta_id,
                                mensaje="La venta se encuentra pendiente de revisión por incidencias de stock o validación",
                            )
                        )
                        continue
                    elif existente.estado == "RECHAZADA":
                        conflictos += 1
                        detalles.append(
                            ResultadoVentaSyncItem(
                                id_local=venta_in.id_local,
                                estado="RECHAZADA",
                                mensaje=existente.motivo_conflicto or "La venta fue rechazada previamente",
                            )
                        )
                        continue

                # Verificar también si la venta ya se registró en ventas centrales por idempotency_key
                venta_central_stmt = select(Venta).where(Venta.idempotency_key == venta_in.id_local)
                venta_central_res = await db.execute(venta_central_stmt)
                venta_central = venta_central_res.scalar_one_or_none()
                if venta_central:
                    nueva_offline = VentaOfflineRecibida(
                        id_local=venta_in.id_local,
                        terminal_id=venta_in.terminal_id,
                        sesion_caja_id=venta_central.sesion_caja_id,
                        usuario_id=current_user.id,
                        fecha_local=venta_in.fecha_local,
                        fecha_recepcion=datetime.datetime.utcnow(),
                        payload_original=venta_in.model_dump(mode="json"),
                        estado="YA_PROCESADA",
                        venta_id=venta_central.id,
                    )
                    db.add(nueva_offline)
                    exitosas += 1
                    detalles.append(
                        ResultadoVentaSyncItem(
                            id_local=venta_in.id_local,
                            estado="YA_PROCESADA",
                            venta_id=venta_central.id,
                            folio_ticket=venta_central.folio_ticket,
                            mensaje="Venta ya registrada centralmente",
                        )
                    )
                    continue

                # 2. Revalidar sesión de caja: debe existir, pertenecer a current_user y estar ABIERTA
                sesion = await db.get(SesionCaja, venta_in.sesion_caja_id)
                es_sesion_valida = (
                    sesion is not None
                    and sesion.usuario_id == current_user.id
                    and sesion.estado == EstadoSesionCaja.ABIERTA
                )

                if not es_sesion_valida:
                    motivo = "Sesión inválida"
                    if not sesion:
                        motivo = f"La sesión de caja {venta_in.sesion_caja_id} no existe en el sistema"
                    elif sesion.usuario_id != current_user.id:
                        motivo = f"La sesión de caja pertenece a otro usuario y no al operador autenticado"
                    elif sesion.estado != EstadoSesionCaja.ABIERTA:
                        estado_str = sesion.estado.value if hasattr(sesion.estado, "value") else str(sesion.estado)
                        motivo = f"La sesión de caja no está abierta (estado actual: {estado_str})"

                    conflictos += 1
                    # Si la sesión existe en base de datos podemos vincular la FK
                    if sesion:
                        offline_rechazada = VentaOfflineRecibida(
                            id_local=venta_in.id_local,
                            terminal_id=venta_in.terminal_id,
                            sesion_caja_id=venta_in.sesion_caja_id,
                            usuario_id=current_user.id,
                            fecha_local=venta_in.fecha_local,
                            fecha_recepcion=datetime.datetime.utcnow(),
                            payload_original=venta_in.model_dump(mode="json"),
                            estado="RECHAZADA",
                            motivo_conflicto=motivo,
                        )
                        db.add(offline_rechazada)

                    detalles.append(
                        ResultadoVentaSyncItem(
                            id_local=venta_in.id_local,
                            estado="RECHAZADA",
                            mensaje=motivo,
                        )
                    )
                    continue

                # 3. Motor FEFO: Validación previa de stock y productos sin descontar aún
                hoy = datetime.date.today()
                hay_conflicto_stock = False
                detalle_conflicto = ""
                tipo_conflicto = "STOCK_INSUFICIENTE"

                # Comprobación de que no esté vacío el carrito
                if not venta_in.items:
                    conflictos += 1
                    offline_rechazada = VentaOfflineRecibida(
                        id_local=venta_in.id_local,
                        terminal_id=venta_in.terminal_id,
                        sesion_caja_id=venta_in.sesion_caja_id,
                        usuario_id=current_user.id,
                        fecha_local=venta_in.fecha_local,
                        fecha_recepcion=datetime.datetime.utcnow(),
                        payload_original=venta_in.model_dump(mode="json"),
                        estado="RECHAZADA",
                        motivo_conflicto="La venta no contiene artículos",
                    )
                    db.add(offline_rechazada)
                    detalles.append(
                        ResultadoVentaSyncItem(
                            id_local=venta_in.id_local,
                            estado="RECHAZADA",
                            mensaje="La venta no contiene artículos",
                        )
                    )
                    continue

                # Verificar disponibilidad con bloqueo pesimista en orden FEFO
                items_validados = []
                for item in venta_in.items:
                    prod = await db.get(Producto, item.producto_id)
                    if not prod or not prod.activo:
                        hay_conflicto_stock = True
                        tipo_conflicto = "PRODUCTO_INEXISTENTE"
                        detalle_conflicto = f"El producto {item.producto_id} no existe o se encuentra inactivo"
                        break

                    lotes_stmt = (
                        select(LoteInventario)
                        .where(
                            LoteInventario.producto_id == item.producto_id,
                            LoteInventario.estado == EstadoLote.ACTIVO,
                            LoteInventario.cantidad_disponible > 0,
                            LoteInventario.fecha_vencimiento >= hoy,
                        )
                        .order_by(LoteInventario.fecha_vencimiento.asc())
                        .with_for_update()
                    )
                    lotes_res = await db.execute(lotes_stmt)
                    lotes_disponibles = lotes_res.scalars().all()

                    stock_total_lotes = sum(
                        Decimal(str(l.cantidad_disponible)) for l in lotes_disponibles
                    )
                    if stock_total_lotes < Decimal(str(item.cantidad)):
                        hay_conflicto_stock = True
                        tipo_conflicto = "STOCK_INSUFICIENTE"
                        detalle_conflicto = (
                            f"Stock insuficiente para producto '{prod.nombre}' (SKU: {prod.sku}). "
                            f"Requerido: {item.cantidad}, Disponible: {stock_total_lotes}"
                        )
                        break

                    items_validados.append((item, prod, lotes_disponibles))

                # Si no hay stock suficiente, NUNCA crear stock negativo ni lotes falsos
                if hay_conflicto_stock:
                    conflictos += 1
                    offline_pendiente = VentaOfflineRecibida(
                        id_local=venta_in.id_local,
                        terminal_id=venta_in.terminal_id,
                        sesion_caja_id=venta_in.sesion_caja_id,
                        usuario_id=current_user.id,
                        fecha_local=venta_in.fecha_local,
                        fecha_recepcion=datetime.datetime.utcnow(),
                        payload_original=venta_in.model_dump(mode="json"),
                        estado="PENDIENTE_REVISION",
                        motivo_conflicto=detalle_conflicto,
                    )
                    db.add(offline_pendiente)
                    await db.flush()

                    incidencia = IncidenciaSync(
                        venta_offline_id=offline_pendiente.id,
                        tipo=tipo_conflicto,
                        detalle=detalle_conflicto,
                        resuelto=False,
                    )
                    db.add(incidencia)

                    detalles.append(
                        ResultadoVentaSyncItem(
                            id_local=venta_in.id_local,
                            estado="PENDIENTE_REVISION",
                            mensaje=detalle_conflicto,
                        )
                    )
                    continue

                # 4. Hay stock suficiente: Descontar lotes en orden FEFO y persistir venta
                total_bruto = Decimal("0.00")
                detalles_venta_db = []

                for item, prod, lotes in items_validados:
                        cant_restante = Decimal(str(item.cantidad))
                        precio_servidor = Decimal(str(prod.precio_venta))

                        for lote in lotes:
                            if cant_restante <= 0:
                                break
                            disponible = Decimal(str(lote.cantidad_disponible))
                            a_tomar = min(disponible, cant_restante)
                            lote.cantidad_disponible = disponible - a_tomar
                            cant_restante -= a_tomar

                            if lote.cantidad_disponible <= 0:
                                lote.cantidad_disponible = Decimal("0.00")
                                lote.estado = EstadoLote.AGOTADO

                            subtotal_linea = redondear_moneda(precio_servidor * a_tomar)
                            costo_unitario = Decimal(str(lote.costo_unitario))
                            margen_linea = redondear_moneda(subtotal_linea - (costo_unitario * a_tomar))
                            total_bruto += subtotal_linea

                            detalles_venta_db.append(
                                DetalleVenta(
                                    producto_id=prod.id,
                                    lote_id=lote.id,
                                    cantidad=a_tomar,
                                    costo_unitario_lote=costo_unitario,
                                    precio_unitario_venta=precio_servidor,
                                    subtotal=subtotal_linea,
                                    margen_ganancia=margen_linea,
                                )
                            )

                total_bruto = redondear_moneda(total_bruto)
                total_descuento = Decimal("0.00")
                base_gravable = total_bruto
                total_impuestos = redondear_moneda(base_gravable * IVA_RATE)
                total_pagar = redondear_moneda(base_gravable + total_impuestos)

                nuevo_folio = f"TKT-{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}-{str(uuid4())[:4].upper()}"

                nueva_venta = Venta(
                    sesion_caja_id=venta_in.sesion_caja_id,
                    cliente_id=None,
                    folio_ticket=nuevo_folio,
                    idempotency_key=venta_in.id_local,
                    fecha_hora=venta_in.fecha_local,
                    total_bruto=total_bruto,
                    total_descuento=total_descuento,
                    total_impuestos=total_impuestos,
                    total_pagar=total_pagar,
                    estado="PAGADO",
                )
                db.add(nueva_venta)
                await db.flush()

                for d in detalles_venta_db:
                    d.venta_id = nueva_venta.id
                    db.add(d)

                pago = PagoVenta(
                    venta_id=nueva_venta.id,
                    metodo_pago="EFECTIVO",
                    monto=total_pagar,
                    referencia_pasarela=None,
                )
                db.add(pago)

                offline_sincronizada = VentaOfflineRecibida(
                    id_local=venta_in.id_local,
                    terminal_id=venta_in.terminal_id,
                    sesion_caja_id=venta_in.sesion_caja_id,
                    usuario_id=current_user.id,
                    fecha_local=venta_in.fecha_local,
                    fecha_recepcion=datetime.datetime.utcnow(),
                    payload_original=venta_in.model_dump(mode="json"),
                    estado="SINCRONIZADA",
                    venta_id=nueva_venta.id,
                )
                db.add(offline_sincronizada)

                exitosas += 1
                detalles.append(
                    ResultadoVentaSyncItem(
                        id_local=venta_in.id_local,
                        estado="SINCRONIZADA",
                        venta_id=nueva_venta.id,
                        folio_ticket=nuevo_folio,
                        mensaje="Venta sincronizada exitosamente",
                    )
                )

                try:
                    await notif_manager.notificar_evento({
                        "tipo": "VENTA_OFFLINE_SINCRONIZADA",
                        "titulo": f"Venta Offline #{nuevo_folio}",
                        "mensaje": f"Venta #{nuevo_folio} sincronizada por ${total_pagar:.2f} ({len(venta_in.items)} artículos)",
                        "severidad": "SUCCESS",
                        "payload": {
                            "venta_id": str(nueva_venta.id),
                            "folio_ticket": nuevo_folio,
                            "total": float(total_pagar),
                            "id_local": venta_in.id_local,
                        },
                    })
                except Exception:
                    pass

            await db.commit()

        except Exception as exc:
            await db.rollback()
            logger.exception("Error procesando venta offline %s: %s", venta_in.id_local, exc)
            conflictos += 1
            detalles.append(
                ResultadoVentaSyncItem(
                    id_local=venta_in.id_local,
                    estado="RECHAZADA",
                    mensaje=f"Error interno procesando venta: {str(exc)}",
                )
            )

    return SyncLoteResponse(
        procesadas=procesadas,
        exitosas=exitosas,
        conflictos=conflictos,
        detalles=detalles,
    )


@router.get("/conflictos", response_model=List[IncidenciaSyncResponse])
async def listar_conflictos(
    solo_pendientes: bool = Query(True, description="Filtrar solo incidencias no resueltas"),
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(supervisor_o_director),
):
    """
    Lista incidencias de sincronización offline con detalles para supervisión.
    Requiere rol SUPERVISOR o DIRECTOR.
    """
    stmt = (
        select(IncidenciaSync, VentaOfflineRecibida.id_local)
        .join(VentaOfflineRecibida, IncidenciaSync.venta_offline_id == VentaOfflineRecibida.id)
        .order_by(IncidenciaSync.creado_en.desc())
    )
    if solo_pendientes:
        stmt = stmt.where(IncidenciaSync.resuelto == False)

    result = await db.execute(stmt)
    filas = result.all()

    items = []
    for inc, id_local in filas:
        items.append(
            IncidenciaSyncResponse(
                id=inc.id,
                venta_offline_id=inc.venta_offline_id,
                id_local=id_local,
                tipo=inc.tipo,
                detalle=inc.detalle,
                resuelto=inc.resuelto,
                creado_en=inc.creado_en,
                resuelto_por=inc.resuelto_por,
                resuelto_en=inc.resuelto_en,
                nota_resolucion=inc.nota_resolucion,
            )
        )
    return items


@router.post("/conflictos/{incidencia_id}/resolver", response_model=IncidenciaSyncResponse)
async def resolver_conflicto(
    incidencia_id: UUID,
    req: ResolverIncidenciaRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(supervisor_o_director),
):
    """
    Resuelve y audita una incidencia de sincronización offline.
    Requiere rol SUPERVISOR o DIRECTOR.
    """
    stmt = (
        select(IncidenciaSync, VentaOfflineRecibida.id_local)
        .join(VentaOfflineRecibida, IncidenciaSync.venta_offline_id == VentaOfflineRecibida.id)
        .where(IncidenciaSync.id == incidencia_id)
    )
    result = await db.execute(stmt)
    fila = result.first()

    if not fila:
        raise HTTPException(status_code=404, detail="Incidencia de sincronización no encontrada")

    inc, id_local = fila
    inc.resuelto = True
    inc.resuelto_por = current_user.id
    inc.resuelto_en = datetime.datetime.utcnow()
    inc.nota_resolucion = req.nota_resolucion

    await db.commit()
    await db.refresh(inc)

    return IncidenciaSyncResponse(
        id=inc.id,
        venta_offline_id=inc.venta_offline_id,
        id_local=id_local,
        tipo=inc.tipo,
        detalle=inc.detalle,
        resuelto=inc.resuelto,
        creado_en=inc.creado_en,
        resuelto_por=inc.resuelto_por,
        resuelto_en=inc.resuelto_en,
        nota_resolucion=inc.nota_resolucion,
    )
