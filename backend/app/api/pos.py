from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from typing import List, Optional
from uuid import uuid4, UUID
import datetime
import logging
from decimal import Decimal, ROUND_HALF_UP

from app.db.oltp import get_db
from app.schemas.pos import (
    ProductoBuscado, ItemCarrito, PagoCheckout, CheckoutRequest, CheckoutResponse,
    VentaResumenResponse, VentaDetalleResponse, DetalleVentaItemResponse, 
    PagoVentaItemResponse, AnularVentaRequest, EnviarTicketRequest
)
from app.models.inventario import Producto, LoteInventario, EstadoLote
from app.models.ventas import (
    Venta, DetalleVenta, PagoVenta, Cliente, Cupon, EstadoCupon,
    DescuentoTipo, EstadoVenta
)
from app.models.usuarios import Usuario, AuditoriaEvento, SesionCaja, EstadoSesionCaja
from app.api.deps import get_current_user, RoleChecker
from app.api.ws import notif_manager
from app.schemas.promociones import ItemCarritoEvaluar
from app.services.promociones_engine import evaluar_promociones_carrito
from app.services.payment_gateway import (
    SimulatedPaymentGateway, PaymentDeclined, PaymentTimeout, PaymentGatewayError
)
from app.services.payment_attempts import iniciar_intento, actualizar_intento
from app.services.email import EmailSender

router = APIRouter()
logger = logging.getLogger(__name__)

cajero_o_superior = RoleChecker(["CAJERO", "BODEGUERO", "SUPERVISOR", "DIRECTOR"])
supervisor_o_director = RoleChecker(["SUPERVISOR", "DIRECTOR"])
CENTAVOS = Decimal("0.01")
IVA_RATE = Decimal("0.16")


def redondear_moneda(valor: Decimal) -> Decimal:
    return valor.quantize(CENTAVOS, rounding=ROUND_HALF_UP)


@router.get("/productos/{sku}", response_model=ProductoBuscado)
async def buscar_producto(
    sku: str, 
    sucursal_id: Optional[UUID] = Query(None, description="Filtrar stock por sucursal"),
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Busca un producto por SKU o código de barras (< 200ms) y devuelve su stock disponible actual.
    """
    query = select(Producto).where(
        (Producto.sku == sku) | (Producto.codigo_barras == sku),
        Producto.activo == True
    )
    result = await db.execute(query)
    producto = result.scalar_one_or_none()
    
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado o inactivo")
        
    stock_query = select(func.sum(LoteInventario.cantidad_disponible)).where(
        LoteInventario.producto_id == producto.id,
        LoteInventario.estado == 'ACTIVO'
    )
    if sucursal_id:
        stock_query = stock_query.where(LoteInventario.sucursal_id == sucursal_id)

    stock_result = await db.execute(stock_query)
    stock_total = stock_result.scalar() or 0
    
    return ProductoBuscado(
        id=producto.id,
        sku=producto.sku,
        nombre=producto.nombre,
        precio_venta=producto.precio_venta,
        requiere_pesaje=producto.requiere_pesaje,
        stock_total=stock_total,
        imagen=producto.imagen
    )


@router.post("/checkout", response_model=CheckoutResponse)
@router.post("/ventas", response_model=CheckoutResponse)
async def procesar_checkout(
    req: CheckoutRequest, 
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Procesa la venta aplicando la regla de inventario estricta FEFO (First Expired, First Out)
    con bloqueo pesimista de concurrencia.
    """
    sesion = await db.get(SesionCaja, req.sesion_caja_id)
    if not sesion:
        raise HTTPException(status_code=404, detail="La sesión de caja no existe")
    if sesion.estado != EstadoSesionCaja.ABIERTA:
        raise HTTPException(status_code=409, detail="La sesión de caja no está abierta")
    if sesion.usuario_id != current_user.id:
        raise HTTPException(status_code=403, detail="La sesión de caja pertenece a otro usuario")

    if req.idempotency_key:
        existente_result = await db.execute(
            select(Venta).where(
                Venta.idempotency_key == req.idempotency_key,
                Venta.sesion_caja_id == req.sesion_caja_id,
            )
        )
        existente = existente_result.scalar_one_or_none()
        if existente:
            puntos_c = req.puntos_canjeados or 0
            desc_p = redondear_moneda(Decimal(str(puntos_c)) / Decimal("10")) if puntos_c > 0 else Decimal("0.00")
            return CheckoutResponse(
                venta_id=existente.id,
                folio_ticket=existente.folio_ticket,
                subtotal=existente.total_bruto,
                total_descuento=existente.total_descuento,
                total_impuestos=existente.total_impuestos,
                total_pagar=existente.total_pagar,
                estado=getattr(existente.estado, "value", existente.estado),
                mensaje="Venta ya procesada anteriormente; se devuelve el resultado existente",
                puntos_canjeados=puntos_c,
                descuento_puntos=desc_p,
            )

    nuevo_folio = f"TKT-{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}-{str(uuid4())[:4].upper()}"
    total_bruto = Decimal("0.00")
    detalles_venta = []
    
    # Normalizar items
    items_a_procesar: List[ItemCarrito] = []
    if req.items:
        items_a_procesar.extend(req.items)
    elif req.productos_solicitados:
        for p in req.productos_solicitados:
            p_id = UUID(str(p.get("producto_id")))
            cant = int(p.get("cantidad", 1))
            items_a_procesar.append(ItemCarrito(producto_id=p_id, cantidad=cant))
            
    if not items_a_procesar:
        raise HTTPException(status_code=400, detail="El carrito de compra no puede estar vacío")
    
    try:
        sucursal_id_venta = req.sucursal_id or getattr(sesion, 'sucursal_id', None) or getattr(current_user, 'sucursal_id', None)

        # 1. Procesar cada ítem aplicando FEFO
        for item in items_a_procesar:
            producto = await db.get(Producto, item.producto_id)
            if not producto:
                raise HTTPException(status_code=404, detail=f"Producto {item.producto_id} no existe")
            
            cantidad_restante_por_descargar = item.cantidad
            
            lotes_query = select(LoteInventario).where(
                LoteInventario.producto_id == item.producto_id,
                LoteInventario.estado == EstadoLote.ACTIVO,
                LoteInventario.cantidad_disponible > 0,
                LoteInventario.fecha_vencimiento >= datetime.date.today()
            )
            if sucursal_id_venta:
                lotes_query = lotes_query.where(LoteInventario.sucursal_id == sucursal_id_venta)
            lotes_query = lotes_query.order_by(LoteInventario.fecha_vencimiento.asc()).with_for_update()
            
            result = await db.execute(lotes_query)
            lotes_disponibles = result.scalars().all()
            
            for lote in lotes_disponibles:
                if cantidad_restante_por_descargar == 0:
                    break
                    
                disponible = Decimal(str(lote.cantidad_disponible))
                requerida = Decimal(str(cantidad_restante_por_descargar))
                cantidad_a_tomar = min(disponible, requerida)
                lote.cantidad_disponible = disponible - cantidad_a_tomar
                cantidad_restante_por_descargar -= int(cantidad_a_tomar)
                
                if float(lote.cantidad_disponible) <= 0:
                    lote.cantidad_disponible = 0
                    lote.estado = EstadoLote.AGOTADO
                    
                subtotal_linea = redondear_moneda(Decimal(str(producto.precio_venta)) * cantidad_a_tomar)
                margen_linea = redondear_moneda(
                    subtotal_linea - (Decimal(str(lote.costo_unitario)) * cantidad_a_tomar)
                )
                total_bruto += subtotal_linea
                
                detalles_venta.append(DetalleVenta(
                    producto_id=producto.id,
                    lote_id=lote.id,
                    cantidad=cantidad_a_tomar,
                    costo_unitario_lote=lote.costo_unitario,
                    precio_unitario_venta=producto.precio_venta,
                    subtotal=subtotal_linea,
                    margen_ganancia=margen_linea
                ))

            if cantidad_restante_por_descargar > 0:
                raise HTTPException(
                    status_code=409, 
                    detail=f"Stock insuficiente para el producto {producto.nombre}. Faltan {cantidad_restante_por_descargar} unidades."
                )

        # 2. Evaluar promociones automáticas y calcular total a pagar
        promo_items = [
            ItemCarritoEvaluar(
                producto_id=item.producto_id,
                cantidad=Decimal(str(item.cantidad))
            )
            for item in items_a_procesar
        ]
        resultado_promo = await evaluar_promociones_carrito(items=promo_items, db=db)
        total_descuento = redondear_moneda(Decimal(str(resultado_promo.total_descuento)))
        total_bruto_dec = redondear_moneda(total_bruto)

        cupon_aplicado = None
        if req.codigo_cupon:
            cupon_result = await db.execute(
                select(Cupon).where(Cupon.codigo == req.codigo_cupon.strip()).with_for_update()
            )
            cupon_aplicado = cupon_result.scalar_one_or_none()
            hoy = datetime.date.today()
            if (
                not cupon_aplicado
                or getattr(cupon_aplicado.estado, "value", cupon_aplicado.estado) != EstadoCupon.EMITIDO.value
                or cupon_aplicado.valido_desde > hoy
                or cupon_aplicado.valido_hasta < hoy
            ):
                raise HTTPException(status_code=400, detail="El cupón no existe, ya fue usado o está fuera de vigencia")

            base_tras_promocion = max(Decimal("0.00"), total_bruto_dec - total_descuento)
            tipo_descuento = getattr(cupon_aplicado.descuento_tipo, "value", cupon_aplicado.descuento_tipo)
            if tipo_descuento == DescuentoTipo.PORCENTAJE.value:
                descuento_cupon = base_tras_promocion * Decimal(str(cupon_aplicado.descuento_valor)) / Decimal("100")
            else:
                descuento_cupon = min(Decimal(str(cupon_aplicado.descuento_valor)), base_tras_promocion)
            total_descuento = redondear_moneda(min(total_bruto_dec, total_descuento + descuento_cupon))

        # Canje de puntos de lealtad (10 puntos = $1.00 MXN)
        cliente_instancia = None
        descuento_puntos = Decimal("0.00")
        puntos_canjeados = 0
        if req.puntos_canjeados and req.puntos_canjeados > 0:
            if not req.cliente_id:
                raise HTTPException(status_code=400, detail="Debes asociar un cliente para canjear puntos")

            cliente_result = await db.execute(
                select(Cliente).where(Cliente.id == req.cliente_id).with_for_update()
            )
            cliente_instancia = cliente_result.scalar_one_or_none()
            if not cliente_instancia:
                raise HTTPException(status_code=404, detail="Cliente no encontrado")

            if (cliente_instancia.puntos_acumulados or 0) < req.puntos_canjeados:
                raise HTTPException(status_code=400, detail="Puntos insuficientes")

            descuento_puntos = redondear_moneda(Decimal(str(req.puntos_canjeados)) / Decimal("10"))
            total_descuento = redondear_moneda(min(total_bruto_dec, total_descuento + descuento_puntos))
            cliente_instancia.puntos_acumulados = (cliente_instancia.puntos_acumulados or 0) - req.puntos_canjeados
            puntos_canjeados = req.puntos_canjeados

        base_gravable = redondear_moneda(max(Decimal("0.00"), total_bruto_dec - total_descuento))
        total_impuestos = redondear_moneda(base_gravable * IVA_RATE)
        total_pagar_dec = redondear_moneda(base_gravable + total_impuestos)

        # 3. Normalizar y validar pagos
        pagos_a_procesar: List[PagoCheckout] = []
        if req.pagos:
            pagos_a_procesar.extend(req.pagos)
        elif req.metodo_pago:
            pagos_a_procesar.append(PagoCheckout(metodo_pago=req.metodo_pago, monto=total_pagar_dec))
            
        total_pagado = redondear_moneda(sum((Decimal(str(p.monto)) for p in pagos_a_procesar), Decimal("0.00")))
        if total_pagado < total_pagar_dec:
            raise HTTPException(status_code=400, detail="El monto pagado es menor al total de la compra")

        pagos_electronicos = [p for p in pagos_a_procesar if p.metodo_pago.upper() != "EFECTIVO"]
        if pagos_electronicos and not req.idempotency_key:
            raise HTTPException(
                status_code=400,
                detail="Los pagos electrónicos requieren idempotency_key para prevenir doble cobro",
            )
        # Mientras la pasarela es simulada, el POS puede enviar una estimación anterior a
        # promociones automáticas. En un pago electrónico único capturamos únicamente el
        # total calculado por el servidor; nunca cobramos el excedente estimado por el cliente.
        if len(pagos_a_procesar) == 1 and pagos_electronicos and total_pagado > total_pagar_dec:
            pagos_a_procesar[0].monto = total_pagar_dec
            total_pagado = total_pagar_dec

        if pagos_electronicos and total_pagado != total_pagar_dec:
            raise HTTPException(status_code=400, detail="Los pagos electrónicos deben coincidir exactamente con el total")

        intentos_aprobados = []
        for indice, pago in enumerate(pagos_electronicos):
            intento, intento_nuevo = await iniciar_intento(
                checkout_key=req.idempotency_key,
                indice=indice,
                usuario_id=current_user.id,
                sesion_caja_id=req.sesion_caja_id,
                metodo_pago=pago.metodo_pago.upper(),
                monto=Decimal(str(pago.monto)),
                escenario=pago.referencia_pasarela,
            )
            if intento.estado in {"APROBADO", "VINCULADO"}:
                pago.referencia_pasarela = intento.referencia_pasarela
                intentos_aprobados.append(intento.id)
                continue
            if intento.estado == "RECHAZADO":
                raise HTTPException(status_code=402, detail=intento.detalle or "Pago rechazado")
            if intento.estado in {"INCIERTO", "INICIADO"} and not intento_nuevo:
                raise HTTPException(
                    status_code=409,
                    detail="El pago tiene un estado incierto y requiere conciliación antes de reintentar",
                )
            try:
                resultado_pago = await SimulatedPaymentGateway.authorize_and_capture(
                    amount=Decimal(str(pago.monto)),
                    scenario_token=pago.referencia_pasarela,
                    idempotency_key=f"{req.idempotency_key}:{indice}",
                )
                pago.referencia_pasarela = resultado_pago.transaction_id
                await actualizar_intento(
                    intento.id,
                    estado="APROBADO",
                    referencia=resultado_pago.transaction_id,
                    codigo=resultado_pago.response_code,
                    detalle="Pago autorizado y capturado por la pasarela simulada",
                )
                intentos_aprobados.append(intento.id)
            except PaymentDeclined as exc:
                await actualizar_intento(
                    intento.id, estado="RECHAZADO", codigo="05", detalle=str(exc)
                )
                raise HTTPException(status_code=402, detail=str(exc)) from exc
            except PaymentTimeout as exc:
                await actualizar_intento(
                    intento.id, estado="INCIERTO", codigo="TIMEOUT", detalle=str(exc)
                )
                raise HTTPException(status_code=504, detail=str(exc)) from exc
            except PaymentGatewayError as exc:
                await actualizar_intento(
                    intento.id, estado="RECHAZADO", codigo="INVALID_SCENARIO", detalle=str(exc)
                )
                raise HTTPException(status_code=400, detail=str(exc)) from exc

        # 4. Crear Venta
        nueva_venta = Venta(
            sesion_caja_id=req.sesion_caja_id,
            cliente_id=req.cliente_id,
            sucursal_id=sucursal_id_venta,
            folio_ticket=nuevo_folio,
            idempotency_key=req.idempotency_key,
            total_bruto=total_bruto_dec,
            total_descuento=total_descuento,
            total_impuestos=total_impuestos,
            total_pagar=total_pagar_dec,
            estado=EstadoVenta.COMPLETADA
        )
        db.add(nueva_venta)
        await db.flush()

        if cupon_aplicado:
            cupon_aplicado.estado = EstadoCupon.CANJEADO
            cupon_aplicado.venta_canje_id = nueva_venta.id

        # 5. Insertar DetalleVenta
        for detalle in detalles_venta:
            detalle.venta_id = nueva_venta.id
            db.add(detalle)
            
        # 6. Insertar PagoVenta
        for pago in pagos_a_procesar:
            db.add(PagoVenta(
                venta_id=nueva_venta.id,
                metodo_pago=pago.metodo_pago,
                monto=pago.monto,
                referencia_pasarela=pago.referencia_pasarela
            ))

        # 7. Sumar puntos si cliente fue asociado
        if req.cliente_id:
            cliente = await db.get(Cliente, req.cliente_id)
            if cliente:
                puntos_ganados = int(base_gravable // Decimal("10"))
                cliente.puntos_acumulados = (cliente.puntos_acumulados or 0) + puntos_ganados

        await db.commit()

        try:
            for intento_id in intentos_aprobados:
                await actualizar_intento(
                    intento_id,
                    estado="VINCULADO",
                    venta_id=nueva_venta.id,
                    detalle="Pago vinculado a la venta completada",
                )
        except Exception:
            logger.exception("La venta %s fue confirmada, pero no se pudo vincular su intento de pago", nueva_venta.id)
        
        # Emitir evento WS en tiempo real para supervisión táctica
        try:
            await notif_manager.notificar_evento({
                "tipo": "VENTA_REALIZADA",
                "titulo": f"Venta #{nuevo_folio}",
                "mensaje": f"Venta #{nuevo_folio} procesada por ${total_pagar_dec:.2f} ({len(items_a_procesar)} artículos) por {current_user.nombre_completo}",
                "severidad": "SUCCESS",
                "payload": {
                    "venta_id": str(nueva_venta.id),
                    "folio_ticket": nuevo_folio,
                    "total": float(total_pagar_dec),
                    "items_count": len(items_a_procesar),
                    "cajero": current_user.nombre_completo,
                    "metodos_pago": [p.metodo_pago for p in pagos_a_procesar]
                }
            })
        except Exception:
            logger.exception("La venta %s fue confirmada, pero no se pudo emitir su notificación", nueva_venta.id)

        mensaje_exito = (
            f"Venta procesada exitosamente con descarga FEFO. Descuento aplicado: ${total_descuento:.2f}"
            if total_descuento > 0
            else "Venta procesada exitosamente con descarga FEFO"
        )

        return CheckoutResponse(
            venta_id=nueva_venta.id,
            folio_ticket=nuevo_folio,
            subtotal=total_bruto_dec,
            total_descuento=total_descuento,
            total_impuestos=total_impuestos,
            total_pagar=total_pagar_dec,
            estado="COMPLETADA",
            mensaje=mensaje_exito,
            puntos_canjeados=puntos_canjeados,
            descuento_puntos=descuento_puntos
        )
        
    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error interno al procesar el checkout: {str(e)}")


@router.get("/ventas", response_model=List[VentaResumenResponse])
async def listar_ventas(
    limit: int = Query(50, ge=1, le=200),
    sesion_caja_id: Optional[UUID] = Query(None),
    sucursal_id: Optional[UUID] = Query(None, description="Filtrar por sucursal"),
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Lista las ventas registradas con datos de ticket, cliente y cantidad de ítems.
    """
    query = (
        select(
            Venta,
            Cliente.cedula.label("cliente_cedula"),
            Cliente.nombre.label("cliente_nombre"),
            Cliente.telefono.label("cliente_telefono"),
            Cliente.email.label("cliente_email"),
            func.count(DetalleVenta.id).label("items_count")
        )
        .outerjoin(Cliente, Venta.cliente_id == Cliente.id)
        .outerjoin(DetalleVenta, DetalleVenta.venta_id == Venta.id)
    )
    
    if sesion_caja_id:
        query = query.where(Venta.sesion_caja_id == sesion_caja_id)
    if sucursal_id:
        query = query.where(Venta.sucursal_id == sucursal_id)
        
    query = (
        query
        .group_by(Venta.id, Cliente.cedula, Cliente.nombre, Cliente.telefono, Cliente.email)
        .order_by(Venta.fecha_hora.desc())
        .limit(limit)
    )
    
    result = await db.execute(query)
    rows = result.all()
    
    resp = []
    for venta, c_ced, c_nom, c_tel, c_email, items_cnt in rows:
        resp.append(
            VentaResumenResponse(
                id=venta.id,
                sesion_caja_id=venta.sesion_caja_id,
                sucursal_id=venta.sucursal_id,
                cliente_id=venta.cliente_id,
                cliente_cedula=c_ced,
                cliente_nombre=c_nom,
                cliente_telefono=c_tel,
                cliente_email=c_email,
                folio_ticket=venta.folio_ticket,
                fecha_hora=venta.fecha_hora,
                total_bruto=venta.total_bruto,
                total_descuento=venta.total_descuento,
                total_impuestos=venta.total_impuestos,
                total_pagar=venta.total_pagar,
                estado=venta.estado.value if hasattr(venta.estado, 'value') else str(venta.estado),
                items_count=items_cnt or 0
            )
        )
    return resp


@router.get("/ventas/{venta_id}", response_model=VentaDetalleResponse)
async def obtener_venta_detalle(
    venta_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Obtiene el detalle completo de un ticket de venta: líneas, lotes FEFO aplicados y formas de pago.
    """
    venta = await db.get(Venta, venta_id)
    if not venta:
        raise HTTPException(status_code=404, detail="Ticket de venta no encontrado")
        
    # Datos de cliente si existe
    c_ced, c_nom, c_tel, c_email = None, None, None, None
    if venta.cliente_id:
        cli = await db.get(Cliente, venta.cliente_id)
        if cli:
            c_ced, c_nom, c_tel, c_email = cli.cedula, cli.nombre, cli.telefono, cli.email
            
    # Consultar detalles con productos y lotes
    det_query = (
        select(DetalleVenta, Producto.nombre.label("producto_nombre"), Producto.sku.label("producto_sku"), LoteInventario.codigo_lote.label("lote_codigo"))
        .join(Producto, DetalleVenta.producto_id == Producto.id)
        .outerjoin(LoteInventario, DetalleVenta.lote_id == LoteInventario.id)
        .where(DetalleVenta.venta_id == venta_id)
    )
    det_result = await db.execute(det_query)
    det_rows = det_result.all()
    
    detalles_resp = []
    for d, p_nom, p_sku, l_cod in det_rows:
        detalles_resp.append(
            DetalleVentaItemResponse(
                id=d.id,
                producto_id=d.producto_id,
                producto_nombre=p_nom,
                producto_sku=p_sku,
                lote_id=d.lote_id,
                lote_codigo=l_cod,
                cantidad=d.cantidad,
                costo_unitario_lote=d.costo_unitario_lote,
                precio_unitario_venta=d.precio_unitario_venta,
                subtotal=d.subtotal,
                margen_ganancia=d.margen_ganancia
            )
        )
        
    # Consultar pagos
    pagos_query = select(PagoVenta).where(PagoVenta.venta_id == venta_id)
    pagos_result = await db.execute(pagos_query)
    pagos_rows = pagos_result.scalars().all()
    
    pagos_resp = [
        PagoVentaItemResponse(
            id=p.id,
            metodo_pago=p.metodo_pago.value if hasattr(p.metodo_pago, 'value') else str(p.metodo_pago),
            monto=p.monto,
            referencia_pasarela=p.referencia_pasarela
        )
        for p in pagos_rows
    ]
    
    return VentaDetalleResponse(
        id=venta.id,
        sesion_caja_id=venta.sesion_caja_id,
        sucursal_id=venta.sucursal_id,
        cliente_id=venta.cliente_id,
        cliente_cedula=c_ced,
        cliente_nombre=c_nom,
        cliente_telefono=c_tel,
        cliente_email=c_email,
        folio_ticket=venta.folio_ticket,
        fecha_hora=venta.fecha_hora,
        total_bruto=venta.total_bruto,
        total_descuento=venta.total_descuento,
        total_impuestos=venta.total_impuestos,
        total_pagar=venta.total_pagar,
        estado=venta.estado.value if hasattr(venta.estado, 'value') else str(venta.estado),
        detalles=detalles_resp,
        pagos=pagos_resp
    )


@router.post("/ventas/{venta_id}/anular", response_model=VentaDetalleResponse)
async def anular_venta(
    venta_id: UUID,
    req: AnularVentaRequest = AnularVentaRequest(),
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(supervisor_o_director)
):
    """
    (RF-SEG-02) Baja lógica de venta / Anulación de Ticket:
    1. Valida que el ticket esté COMPLETADA.
    2. Reintegra atómicamente el stock a los lotes FEFO originales.
    3. Cambia el estado de la venta a 'ANULADA'.
    4. Registra evento inmutable en AUDITORIA_EVENTO.
    """
    venta = await db.get(Venta, venta_id)
    if not venta:
        raise HTTPException(status_code=404, detail="Ticket de venta no encontrado")
        
    if venta.estado == EstadoVenta.ANULADA or (hasattr(venta.estado, 'value') and venta.estado.value == 'ANULADA'):
        raise HTTPException(status_code=400, detail="Este ticket ya se encuentra anulado")

    # 1. Obtener detalles para revertir stock
    detalles_query = select(DetalleVenta).where(DetalleVenta.venta_id == venta_id)
    detalles = (await db.execute(detalles_query)).scalars().all()
    
    for det in detalles:
        lote = await db.get(LoteInventario, det.lote_id)
        if lote:
            # Reintegrar cantidad
            lote.cantidad_disponible = float(lote.cantidad_disponible) + float(det.cantidad)
            # Si el lote estaba agotado, reactivarlo
            if lote.estado == EstadoLote.AGOTADO or (hasattr(lote.estado, 'value') and lote.estado.value == 'AGOTADO'):
                lote.estado = EstadoLote.ACTIVO
                
    # 2. Marcar venta como ANULADA
    venta.estado = EstadoVenta.ANULADA
    
    # 3. Registrar auditoría forense inmutable
    auditoria = AuditoriaEvento(
        usuario_id=current_user.id,
        tipo_evento="ANULACION_TICKET",
        descripcion=f"Anulación de ticket #{venta.folio_ticket} por ${float(venta.total_pagar):.2f}. Motivo: {req.motivo}. Stock reintegrado a lotes.",
        gravedad="MEDIA",
        venta_referencia_id=venta.id,
        usuario_autorizador_id=current_user.id,
        ip_terminal="POS-TERMINAL",
        detalle_json={
            "motivo": req.motivo,
            "total_revertido": float(venta.total_pagar),
            "folio_ticket": venta.folio_ticket,
            "articulos_revertidos": len(detalles)
        }
    )
    db.add(auditoria)
    
    await db.commit()
    await db.refresh(venta)
    
    # Emitir evento WS en tiempo real para supervisión táctica
    await notif_manager.notificar_evento({
        "tipo": "TICKET_ANULADO",
        "titulo": f"Ticket #{venta.folio_ticket} Anulado",
        "mensaje": f"Ticket #{venta.folio_ticket} anulado por ${float(venta.total_pagar):.2f}. Motivo: {req.motivo}",
        "severidad": "WARNING",
        "payload": {
            "venta_id": str(venta.id),
            "folio_ticket": venta.folio_ticket,
            "total_revertido": float(venta.total_pagar),
            "motivo": req.motivo,
            "autorizador": current_user.nombre_completo
        }
    })

    return await obtener_venta_detalle(venta_id=venta_id, db=db, current_user=current_user)


@router.post("/ventas/{venta_id}/enviar-ticket")
async def enviar_ticket_digital(
    venta_id: UUID,
    background_tasks: BackgroundTasks,
    req: Optional[EnviarTicketRequest] = None,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(cajero_o_superior)
):
    """
    Envía el ticket de venta por correo electrónico al cliente de forma asíncrona.
    """
    stmt = (
        select(Venta)
        .where(Venta.id == venta_id)
        .options(
            selectinload(Venta.detalles).selectinload(DetalleVenta.producto),
            selectinload(Venta.cliente),
            selectinload(Venta.pagos)
        )
    )
    res = await db.execute(stmt)
    venta = res.scalar_one_or_none()
    if not venta:
        raise HTTPException(status_code=404, detail="Ticket de venta no encontrado")

    dest_email = req.email.strip() if (req and req.email and req.email.strip()) else (venta.cliente.email if venta.cliente else None)
    if not dest_email:
        raise HTTPException(status_code=400, detail="No se especificó un correo electrónico de destino válido")

    cajero_nombre = current_user.nombre_completo if current_user and current_user.nombre_completo else "Cajero"

    lineas_texto = [
        "QUANTIX RETAIL OS - COMPROBANTE DE COMPRA",
        f"Folio: {venta.folio_ticket}",
        f"Fecha: {venta.fecha_hora.strftime('%Y-%m-%d %H:%M:%S') if venta.fecha_hora else 'N/A'}",
        f"Cajero: {cajero_nombre}",
        "-" * 40,
    ]
    for det in venta.detalles:
        prod_nom = det.producto.nombre if det.producto else "Artículo"
        lineas_texto.append(f"{det.cantidad}x {prod_nom} - ${float(det.subtotal):.2f}")

    lineas_texto.extend([
        "-" * 40,
        f"Subtotal: ${float(venta.total_bruto):.2f}",
        f"Descuentos: -${float(venta.total_descuento):.2f}",
        f"Impuestos (IVA): ${float(venta.total_impuestos):.2f}",
        f"TOTAL PAGADO: ${float(venta.total_pagar):.2f}",
        "-" * 40,
        "¡Gracias por su compra en Quantix!"
    ])
    texto_plano = "\n".join(lineas_texto)

    filas_html = "".join([
        f"<tr><td style='padding:6px 0;'>{det.cantidad}x {det.producto.nombre if det.producto else 'Artículo'}</td>"
        f"<td style='text-align:right;padding:6px 0;font-family:monospace;'>${float(det.subtotal):.2f}</td></tr>"
        for det in venta.detalles
    ])

    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;border:1px solid #e0e0e0;border-radius:16px;overflow:hidden;background:#ffffff;">
      <div style="background:#006c49;padding:24px;text-align:center;color:#ffffff;">
        <h2 style="margin:0;font-size:20px;letter-spacing:1px;">QUANTIX RETAIL</h2>
        <p style="margin:4px 0 0;font-size:12px;opacity:0.9;">Comprobante Digital de Compra</p>
      </div>
      <div style="padding:24px;">
        <div style="font-size:13px;color:#555;margin-bottom:16px;">
          <strong>Folio:</strong> {venta.folio_ticket}<br/>
          <strong>Fecha:</strong> {venta.fecha_hora.strftime('%d/%m/%Y %H:%M') if venta.fecha_hora else ''}<br/>
          <strong>Atendido por:</strong> {cajero_nombre}
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:14px;border-top:1px dashed #ccc;border-bottom:1px dashed #ccc;padding:12px 0;">
          {filas_html}
        </table>
        <div style="margin-top:16px;font-size:14px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>Subtotal:</span><span>${float(venta.total_bruto):.2f}</span></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;color:#006c49;"><span>Descuento:</span><span>-${float(venta.total_descuento):.2f}</span></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;color:#777;"><span>IVA:</span><span>${float(venta.total_impuestos):.2f}</span></div>
          <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:bold;border-top:2px solid #006c49;padding-top:8px;"><span>Total:</span><span>${float(venta.total_pagar):.2f}</span></div>
        </div>
      </div>
      <div style="background:#f9fafb;padding:16px;text-align:center;font-size:12px;color:#777;">
        Este comprobante digital sustituye la impresión convencional.<br/>
        Consérvelo para cualquier aclaración o garantía.
      </div>
    </div>
    """

    background_tasks.add_task(
        EmailSender.enviar_correo,
        [dest_email],
        f"Tu Comprobante de Compra - Folio {venta.folio_ticket}",
        texto_plano,
        html
    )

    return {
        "mensaje": f"Comprobante enviado exitosamente a {dest_email}",
        "email": dest_email,
        "folio": venta.folio_ticket
    }

