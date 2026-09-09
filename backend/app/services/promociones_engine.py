from decimal import Decimal, ROUND_HALF_UP
from typing import List, Dict, Optional
from uuid import UUID
from collections import defaultdict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.promociones import ReglaPromocion, TipoReglaPromocion, DescuentoReglaTipo
from app.models.inventario import Producto
from app.schemas.promociones import (
    ItemCarritoEvaluar, PromocionAplicada, EvaluarCarritoResponse
)

def round_money(val: Decimal) -> Decimal:
    return val.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

async def evaluar_promociones_carrito(
    items: List[ItemCarritoEvaluar],
    db: AsyncSession,
    reglas: Optional[List[ReglaPromocion]] = None
) -> EvaluarCarritoResponse:
    """
    Servicio evaluador que toma los ítems del carrito y las reglas activas:
    - COMBO: Si contiene producto disparador A, aplica X% o monto fijo de descuento al producto beneficio B.
    - VOLUMEN: Si la cantidad de un producto o categoría >= cantidad_minima, aplica descuento.
    - MONTO_MINIMO: Si subtotal >= monto_minimo, aplica descuento.
    - Validación de margen mínimo: Verifica que el margen resultante del ticket sea >= 0 (no vender a pérdida).
    """
    if not items:
        return EvaluarCarritoResponse(
            subtotal_bruto=Decimal("0.00"),
            total_descuento=Decimal("0.00"),
            total_con_descuento=Decimal("0.00"),
            promociones_aplicadas=[],
            margen_respetado=True,
            mensaje="Carrito vacío"
        )

    # 1. Obtener productos de la base de datos
    producto_ids = list({item.producto_id for item in items})
    query_prod = select(Producto).where(Producto.id.in_(producto_ids))
    res_prod = await db.execute(query_prod)
    productos_map: Dict[UUID, Producto] = {p.id: p for p in res_prod.scalars().all()}

    # Consolidar cantidades y precios por producto
    cantidades: Dict[UUID, Decimal] = defaultdict(Decimal)
    precios_unitarios: Dict[UUID, Decimal] = {}
    costos_unitarios: Dict[UUID, Decimal] = {}
    subtotales_linea: Dict[UUID, Decimal] = defaultdict(Decimal)

    subtotal_bruto = Decimal("0.00")
    total_costo = Decimal("0.00")

    for item in items:
        prod = productos_map.get(item.producto_id)
        if not prod:
            continue
        
        cant = Decimal(str(item.cantidad))
        cantidades[prod.id] += cant
        
        precio_unitario = (
            Decimal(str(item.precio_unitario))
            if item.precio_unitario is not None
            else Decimal(str(prod.precio_venta))
        )
        precios_unitarios[prod.id] = precio_unitario
        
        costo_unitario = (
            Decimal(str(prod.costo_base))
            if prod.costo_base is not None
            else Decimal("0.00")
        )
        costos_unitarios[prod.id] = costo_unitario
        
        linea = cant * precio_unitario
        subtotales_linea[prod.id] += linea
        subtotal_bruto += linea
        total_costo += cant * costo_unitario

    subtotal_bruto = round_money(subtotal_bruto)
    total_costo = round_money(total_costo)

    # Margen disponible sin vender a pérdida (margen resultante del ticket >= 0)
    # total_con_descuento >= total_costo => total_descuento <= subtotal_bruto - total_costo
    max_descuento_permitido = max(Decimal("0.00"), subtotal_bruto - total_costo)

    # 2. Cargar reglas activas si no fueron provistas
    if reglas is None:
        query_reglas = (
            select(ReglaPromocion)
            .where(ReglaPromocion.activo == True)
            .options(
                selectinload(ReglaPromocion.producto_disparador),
                selectinload(ReglaPromocion.producto_beneficio),
                selectinload(ReglaPromocion.categoria),
            )
            .order_by(ReglaPromocion.creado_en.asc())
        )
        res_reglas = await db.execute(query_reglas)
        reglas_activas = list(res_reglas.scalars().all())
    else:
        reglas_activas = [r for r in reglas if r.activo]

    promociones_aplicadas: List[PromocionAplicada] = []
    total_descuento_acumulado = Decimal("0.00")

    # 3. Evaluar cada regla activa
    for regla in reglas_activas:
        descuento_candidato = Decimal("0.00")
        mensaje_promo = ""
        producto_beneficiado_id = None

        if regla.tipo_regla == TipoReglaPromocion.COMBO:
            # COMBO: Si contiene producto disparador A, aplica X% o monto fijo de descuento al producto beneficio B.
            if regla.producto_disparador_id and regla.producto_beneficio_id:
                disp_id = regla.producto_disparador_id
                bene_id = regla.producto_beneficio_id
                
                cant_disp = cantidades.get(disp_id, Decimal("0.00"))
                cant_bene = cantidades.get(bene_id, Decimal("0.00"))
                min_disp = (
                    Decimal(str(regla.cantidad_minima))
                    if regla.cantidad_minima and regla.cantidad_minima > 0
                    else Decimal("1.00")
                )

                if disp_id == bene_id:
                    # Mismo producto (ej. 2x1 o lleva 2 con descuento en el segundo)
                    combos_posibles = int(cant_disp // (min_disp + Decimal("1.00")))
                else:
                    if cant_disp >= min_disp and cant_bene > Decimal("0.00"):
                        combos_posibles = int(min(cant_disp // min_disp, cant_bene))
                    else:
                        combos_posibles = 0

                if combos_posibles > 0 and bene_id in precios_unitarios:
                    precio_bene = precios_unitarios[bene_id]
                    producto_beneficiado_id = bene_id
                    
                    if regla.descuento_tipo == DescuentoReglaTipo.PORCENTAJE:
                        pct = Decimal(str(regla.descuento_valor)) / Decimal("100.00")
                        descuento_candidato = Decimal(combos_posibles) * precio_bene * pct
                        mensaje_promo = f"Combo '{regla.nombre}': {regla.descuento_valor}% desc en {combos_posibles} unidad(es)"
                    else:
                        monto_fijo = Decimal(str(regla.descuento_valor))
                        descuento_unitario = min(monto_fijo, precio_bene)
                        descuento_candidato = Decimal(combos_posibles) * descuento_unitario
                        mensaje_promo = f"Combo '{regla.nombre}': ${descuento_candidato:.2f} desc fijo"

        elif regla.tipo_regla == TipoReglaPromocion.VOLUMEN:
            # VOLUMEN: Si la cantidad de un producto o categoría >= cantidad_minima, aplica descuento.
            min_cant = Decimal(str(regla.cantidad_minima))
            
            # Caso 1: Producto específico (disparador o beneficio)
            prod_id = regla.producto_disparador_id or regla.producto_beneficio_id
            if prod_id and prod_id in cantidades:
                cant_prod = cantidades[prod_id]
                if cant_prod >= min_cant:
                    subtotal_p = subtotales_linea[prod_id]
                    producto_beneficiado_id = prod_id
                    if regla.descuento_tipo == DescuentoReglaTipo.PORCENTAJE:
                        pct = Decimal(str(regla.descuento_valor)) / Decimal("100.00")
                        descuento_candidato = subtotal_p * pct
                        mensaje_promo = f"Volumen '{regla.nombre}': {regla.descuento_valor}% desc por comprar {cant_prod} uds"
                    else:
                        descuento_candidato = min(Decimal(str(regla.descuento_valor)), subtotal_p)
                        mensaje_promo = f"Volumen '{regla.nombre}': ${descuento_candidato:.2f} desc fijo por mayoreo"

            # Caso 2: Categoría
            elif regla.categoria_id:
                prods_cat = [
                    pid for pid, prod in productos_map.items()
                    if prod.categoria_id == regla.categoria_id and pid in cantidades
                ]
                cant_cat = sum(cantidades[pid] for pid in prods_cat)
                subtotal_cat = sum(subtotales_linea[pid] for pid in prods_cat)
                
                if cant_cat >= min_cant and subtotal_cat > 0:
                    if regla.descuento_tipo == DescuentoReglaTipo.PORCENTAJE:
                        pct = Decimal(str(regla.descuento_valor)) / Decimal("100.00")
                        descuento_candidato = subtotal_cat * pct
                        mensaje_promo = f"Volumen Categoría '{regla.nombre}': {regla.descuento_valor}% desc ({cant_cat} uds)"
                    else:
                        descuento_candidato = min(Decimal(str(regla.descuento_valor)), subtotal_cat)
                        mensaje_promo = f"Volumen Categoría '{regla.nombre}': ${descuento_candidato:.2f} desc fijo"

        elif regla.tipo_regla == TipoReglaPromocion.MONTO_MINIMO:
            # MONTO_MINIMO: Si subtotal >= monto_minimo, aplica descuento.
            min_monto = Decimal(str(regla.monto_minimo))
            if subtotal_bruto >= min_monto and subtotal_bruto > 0:
                if regla.descuento_tipo == DescuentoReglaTipo.PORCENTAJE:
                    pct = Decimal(str(regla.descuento_valor)) / Decimal("100.00")
                    descuento_candidato = subtotal_bruto * pct
                    mensaje_promo = f"Ticket Mínimo '{regla.nombre}': {regla.descuento_valor}% desc sobre ticket >= ${min_monto:.2f}"
                else:
                    descuento_candidato = min(Decimal(str(regla.descuento_valor)), subtotal_bruto)
                    mensaje_promo = f"Ticket Mínimo '{regla.nombre}': ${descuento_candidato:.2f} desc fijo sobre ticket >= ${min_monto:.2f}"

        # 4. Validación de margen mínimo (no vender a pérdida)
        descuento_candidato = round_money(descuento_candidato)
        if descuento_candidato > Decimal("0.00"):
            espacio_margen = max(Decimal("0.00"), max_descuento_permitido - total_descuento_acumulado)
            descuento_aplicable = min(descuento_candidato, espacio_margen)
            descuento_aplicable = round_money(descuento_aplicable)

            if descuento_aplicable > Decimal("0.00"):
                if descuento_aplicable < descuento_candidato:
                    mensaje_promo += f" (Ajustado por protección de margen mínimo a ${descuento_aplicable:.2f})"
                
                total_descuento_acumulado += descuento_aplicable
                promociones_aplicadas.append(
                    PromocionAplicada(
                        regla_id=regla.id,
                        nombre=regla.nombre,
                        tipo_regla=regla.tipo_regla.value if hasattr(regla.tipo_regla, "value") else str(regla.tipo_regla),
                        descuento_monto=descuento_aplicable,
                        mensaje=mensaje_promo,
                        producto_beneficiado_id=producto_beneficiado_id,
                    )
                )

    total_descuento = round_money(total_descuento_acumulado)
    total_con_descuento = round_money(max(Decimal("0.00"), subtotal_bruto - total_descuento))

    return EvaluarCarritoResponse(
        subtotal_bruto=subtotal_bruto,
        total_descuento=total_descuento,
        total_con_descuento=total_con_descuento,
        promociones_aplicadas=promociones_aplicadas,
        margen_respetado=True,
        mensaje="Promociones evaluadas exitosamente respetando margen mínimo no negativo"
    )
