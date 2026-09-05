from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List
from uuid import uuid4
import datetime

from app.db.oltp import get_db
from app.schemas.pos import ProductoBuscado, CheckoutRequest, CheckoutResponse
from app.models.inventario import Producto, LoteInventario
from app.models.ventas import Venta, DetalleVenta, PagoVenta

from app.api.deps import get_current_user
from app.models.usuarios import Usuario

router = APIRouter()

@router.get("/productos/{sku}", response_model=ProductoBuscado)
async def buscar_producto(
    sku: str, 
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
        
    # Calcular stock total sumando los lotes
    stock_query = select(func.sum(LoteInventario.cantidad_disponible)).where(
        LoteInventario.producto_id == producto.id,
        LoteInventario.estado == 'ACTIVO'
    )
    stock_result = await db.execute(stock_query)
    stock_total = stock_result.scalar() or 0
    
    return ProductoBuscado(
        id=producto.id,
        sku=producto.sku,
        nombre=producto.nombre,
        precio_venta=producto.precio_venta,
        requiere_pesaje=producto.requiere_pesaje,
        stock_total=stock_total
    )


@router.post("/checkout", response_model=CheckoutResponse)
async def procesar_checkout(
    req: CheckoutRequest, 
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Procesa la venta aplicando la regla de inventario estricta FEFO (First Expired, First Out)
    con bloqueo pesimista de concurrencia.
    """
    # 1. Generar variables base
    nuevo_folio = f"TKT-{datetime.datetime.now().strftime('%Y%M%d%H%M%S')}-{str(uuid4())[:4].upper()}"
    total_bruto = 0.0
    detalles_venta = []
    
    try:
        # 2. Procesar cada ítem del carrito aplicando FEFO
        for item in req.items:
            producto = await db.get(Producto, item.producto_id)
            if not producto:
                raise HTTPException(status_code=404, detail=f"Producto {item.producto_id} no existe")
            
            cantidad_restante_por_descargar = item.cantidad
            
            # Buscar lotes activos ordenados por vencimiento más próximo (FEFO) con bloqueo FOR UPDATE
            lotes_query = select(LoteInventario).where(
                LoteInventario.producto_id == item.producto_id,
                LoteInventario.estado == 'ACTIVO',
                LoteInventario.cantidad_disponible > 0
            ).order_by(LoteInventario.fecha_vencimiento.asc()).with_for_update()
            
            result = await db.execute(lotes_query)
            lotes_disponibles = result.scalars().all()
            
            for lote in lotes_disponibles:
                if cantidad_restante_por_descargar == 0:
                    break
                    
                cantidad_a_tomar = min(lote.cantidad_disponible, cantidad_restante_por_descargar)
                lote.cantidad_disponible -= cantidad_a_tomar
                cantidad_restante_por_descargar -= cantidad_a_tomar
                
                # Si el lote se vació, cambiar su estado
                if lote.cantidad_disponible == 0:
                    lote.estado = 'AGOTADO'
                    
                # Precio unitario actual del producto, pero costo congelado del lote
                subtotal_linea = float(producto.precio_venta) * cantidad_a_tomar
                margen_linea = subtotal_linea - (float(lote.costo_unitario) * cantidad_a_tomar)
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

            # Si después de iterar todos los lotes no cubrimos la cantidad, rechazamos la compra entera (ERR-INV-01)
            if cantidad_restante_por_descargar > 0:
                raise HTTPException(status_code=409, detail=f"Stock insuficiente para el producto {producto.nombre}. Faltan {cantidad_restante_por_descargar} unidades.")

        # 3. Validar los montos de pago
        total_pagado = sum(float(p.monto) for p in req.pagos)
        # Nota: Aquí podríamos aplicar una tolerancia mínima por temas de decimales
        if total_pagado < total_bruto:
            raise HTTPException(status_code=400, detail="El monto pagado es menor al total de la compra")

        # 4. Crear la cabecera de la Venta
        nueva_venta = Venta(
            sesion_caja_id=req.sesion_caja_id,
            cliente_id=req.cliente_id,
            folio_ticket=nuevo_folio,
            total_bruto=total_bruto,
            total_descuento=0.0, # Se manejará lógica de descuento después
            total_impuestos=total_bruto * 0.16, # Asumimos IVA 16% incrustado o adicional según regla
            total_pagar=total_bruto,
            estado='COMPLETADA'
        )
        db.add(nueva_venta)
        await db.flush() # Para obtener el ID de la venta

        # 5. Insertar DetalleVenta
        for detalle in detalles_venta:
            detalle.venta_id = nueva_venta.id
            db.add(detalle)
            
        # 6. Insertar PagoVenta
        for pago in req.pagos:
            nuevo_pago = PagoVenta(
                venta_id=nueva_venta.id,
                metodo_pago=pago.metodo_pago,
                monto=pago.monto,
                referencia_pasarela=pago.referencia_pasarela
            )
            db.add(nuevo_pago)

        # 7. Commit (Atomicidad)
        await db.commit()
        
        return CheckoutResponse(
            venta_id=nueva_venta.id,
            folio_ticket=nuevo_folio,
            total_pagar=total_bruto,
            estado="COMPLETADA",
            mensaje="Venta procesada exitosamente con descarga FEFO"
        )
        
    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error interno al procesar el checkout: {str(e)}")
