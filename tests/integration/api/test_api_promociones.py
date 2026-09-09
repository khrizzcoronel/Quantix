import pytest
from httpx import AsyncClient
import uuid
from decimal import Decimal
from datetime import datetime, timedelta
from sqlalchemy import text

from app.models.inventario import Categoria, Producto, LoteInventario, EstadoLote
from app.models.promociones import ReglaPromocion, TipoReglaPromocion, DescuentoReglaTipo

PRODUCTO_A_ID = "c12c3433-1953-4980-80cb-06d6ab535e54" # Leche Entera Lala 1L en conftest (costo 18.50, venta 26.00)

@pytest.fixture(autouse=True)
async def limpiar_promociones(db_session):
    """Limpia la tabla de promociones antes y después de cada test para aislamiento estricto"""
    await db_session.execute(text("DELETE FROM regla_promocion"))
    await db_session.commit()
    yield
    await db_session.execute(text("DELETE FROM regla_promocion"))
    await db_session.commit()

@pytest.fixture
async def producto_beneficio_extra(db_session):
    """Crea un segundo producto de prueba para combos con SKU y código de barras únicos"""
    cat_id = uuid.uuid4()
    cat = Categoria(id=cat_id, nombre=f"Snacks-{str(cat_id)[:8]}", descripcion="Galletas y panes")
    db_session.add(cat)
    await db_session.flush()

    uid_str = uuid.uuid4().hex[:6].upper()
    prod_b = Producto(
        id=uuid.uuid4(),
        categoria_id=cat.id,
        sku=f"GAL-{uid_str}",
        nombre="Galletas de Chocolate 100g",
        codigo_barras=f"750{uuid.uuid4().int % 100000000:08d}",
        costo_base=Decimal("10.00"),
        precio_venta=Decimal("20.00"),
        margen_minimo_pct=Decimal("20.00"),
        requiere_pesaje=False,
        clasificacion_abc="B",
        activo=True
    )
    db_session.add(prod_b)

    # Lote para que tenga inventario disponible
    hoy = datetime.utcnow()
    lote = LoteInventario(
        id=uuid.uuid4(),
        producto_id=prod_b.id,
        codigo_lote=f"LOTE-SNACK-{uid_str}",
        cantidad_inicial=50,
        cantidad_disponible=50,
        costo_unitario=Decimal("10.00"),
        fecha_ingreso=hoy,
        fecha_vencimiento=hoy.date() + timedelta(days=60),
        estado=EstadoLote.ACTIVO
    )
    db_session.add(lote)
    await db_session.commit()
    return prod_b

@pytest.mark.asyncio
async def test_crear_regla_promocion__director_valido__retorna_201(
    async_client: AsyncClient,
    director_headers: dict,
    producto_beneficio_extra
):
    """Director crea una regla de combo exitosamente (HTTP 201)"""
    payload = {
        "nombre": "Combo Desayuno: Leche + Galletas 50% OFF",
        "tipo_regla": "COMBO",
        "producto_disparador_id": PRODUCTO_A_ID,
        "producto_beneficio_id": str(producto_beneficio_extra.id),
        "descuento_tipo": "PORCENTAJE",
        "descuento_valor": 50.00,
        "cantidad_minima": 1.00,
        "monto_minimo": 0.00,
        "activo": True
    }
    res = await async_client.post("/api/v1/promociones/", json=payload, headers=director_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["nombre"] == payload["nombre"]
    assert data["tipo_regla"] == "COMBO"
    assert data["activo"] is True
    assert data["producto_disparador_id"] == PRODUCTO_A_ID
    assert data["producto_beneficio_id"] == str(producto_beneficio_extra.id)

@pytest.mark.asyncio
async def test_crear_regla_promocion__cajero_no_autorizado__retorna_403(
    async_client: AsyncClient,
    cajero_headers: dict
):
    """Un cajero no tiene permisos para crear reglas promocionales (HTTP 403)"""
    payload = {
        "nombre": "Regla No Autorizada",
        "tipo_regla": "MONTO_MINIMO",
        "monto_minimo": 100.00,
        "descuento_tipo": "MONTO_FIJO",
        "descuento_valor": 10.00
    }
    res = await async_client.post("/api/v1/promociones/", json=payload, headers=cajero_headers)
    assert res.status_code == 403

@pytest.mark.asyncio
async def test_listar_y_filtrar_reglas_promocion(
    async_client: AsyncClient,
    supervisor_headers: dict
):
    """Listar reglas y filtrar por activas"""
    # 1. Crear una regla activa
    res1 = await async_client.post("/api/v1/promociones/", json={
        "nombre": "Promo Activa",
        "tipo_regla": "MONTO_MINIMO",
        "monto_minimo": 200.00,
        "descuento_tipo": "MONTO_FIJO",
        "descuento_valor": 20.00,
        "activo": True
    }, headers=supervisor_headers)
    assert res1.status_code == 201
    id1 = res1.json()["id"]

    # 2. Crear una regla inactiva
    res2 = await async_client.post("/api/v1/promociones/", json={
        "nombre": "Promo Inactiva",
        "tipo_regla": "MONTO_MINIMO",
        "monto_minimo": 500.00,
        "descuento_tipo": "PORCENTAJE",
        "descuento_valor": 10.00,
        "activo": False
    }, headers=supervisor_headers)
    assert res2.status_code == 201
    id2 = res2.json()["id"]

    # Listar todas
    res_todas = await async_client.get("/api/v1/promociones/", headers=supervisor_headers)
    assert res_todas.status_code == 200
    ids_todas = [r["id"] for r in res_todas.json()]
    assert id1 in ids_todas
    assert id2 in ids_todas

    # Listar solo activas
    res_act = await async_client.get("/api/v1/promociones/?activo=true", headers=supervisor_headers)
    assert res_act.status_code == 200
    ids_act = [r["id"] for r in res_act.json()]
    assert id1 in ids_act
    assert id2 not in ids_act

@pytest.mark.asyncio
async def test_editar_y_baja_logica_regla_promocion(
    async_client: AsyncClient,
    director_headers: dict
):
    """Edición y baja lógica (activo = False) de una regla"""
    res_crear = await async_client.post("/api/v1/promociones/", json={
        "nombre": "Regla Para Editar",
        "tipo_regla": "VOLUMEN",
        "cantidad_minima": 5.00,
        "descuento_tipo": "PORCENTAJE",
        "descuento_valor": 15.00,
        "activo": True
    }, headers=director_headers)
    regla_id = res_crear.json()["id"]

    # Editar
    res_edit = await async_client.put(f"/api/v1/promociones/{regla_id}", json={
        "nombre": "Regla Editada Exitosamente",
        "descuento_valor": 25.00
    }, headers=director_headers)
    assert res_edit.status_code == 200
    data_edit = res_edit.json()
    assert data_edit["nombre"] == "Regla Editada Exitosamente"
    assert float(data_edit["descuento_valor"]) == 25.00

    # Baja lógica
    res_baja = await async_client.delete(f"/api/v1/promociones/{regla_id}", headers=director_headers)
    assert res_baja.status_code == 200
    assert res_baja.json()["activo"] is False

@pytest.mark.asyncio
async def test_evaluar_carrito__combo_inteligente(
    async_client: AsyncClient,
    cajero_headers: dict,
    director_headers: dict,
    producto_beneficio_extra
):
    """Evalúa un carrito con producto disparador y beneficio aplicando combo"""
    # Crear regla COMBO: Leche (26.00) + Galletas (20.00 con 50% desc = 10.00 de descuento)
    await async_client.post("/api/v1/promociones/", json={
        "nombre": "Combo Leche + Galletas",
        "tipo_regla": "COMBO",
        "producto_disparador_id": PRODUCTO_A_ID,
        "producto_beneficio_id": str(producto_beneficio_extra.id),
        "descuento_tipo": "PORCENTAJE",
        "descuento_valor": 50.00,
        "cantidad_minima": 1.00,
        "activo": True
    }, headers=director_headers)

    # Evaluar carrito con 1 Leche y 1 Galletas
    eval_req = {
        "items": [
            {"producto_id": PRODUCTO_A_ID, "cantidad": 1},
            {"producto_id": str(producto_beneficio_extra.id), "cantidad": 1}
        ]
    }
    res = await async_client.post("/api/v1/promociones/evaluar-carrito", json=eval_req, headers=cajero_headers)
    assert res.status_code == 200
    data = res.json()
    # Subtotal bruto: 26.00 + 20.00 = 46.00
    assert float(data["subtotal_bruto"]) == 46.00
    # Descuento 50% en Galletas (20.00 * 0.5 = 10.00)
    # Margen check: Costos: 18.50 + 10.00 = 28.50. Max descuento permitido: 46.00 - 28.50 = 17.50. 10.00 <= 17.50, ok!
    assert float(data["total_descuento"]) == 10.00
    assert float(data["total_con_descuento"]) == 36.00
    assert len(data["promociones_aplicadas"]) == 1
    assert data["promociones_aplicadas"][0]["tipo_regla"] == "COMBO"

@pytest.mark.asyncio
async def test_evaluar_carrito__volumen_cantidad(
    async_client: AsyncClient,
    cajero_headers: dict,
    director_headers: dict
):
    """Evalúa un carrito aplicando descuento por volumen en cantidad de producto"""
    # Regla: Leche (26.00) a partir de 3 piezas tiene 10% de descuento
    await async_client.post("/api/v1/promociones/", json={
        "nombre": "Mayoreo Leche 3+",
        "tipo_regla": "VOLUMEN",
        "producto_disparador_id": PRODUCTO_A_ID,
        "cantidad_minima": 3.00,
        "descuento_tipo": "PORCENTAJE",
        "descuento_valor": 10.00,
        "activo": True
    }, headers=director_headers)

    # 4 Leches a 26.00 = 104.00. Descuento 10% = 10.40
    # Costo base: 4 * 18.50 = 74.00. Max descuento: 104 - 74 = 30.00. 10.40 <= 30.00 ok.
    eval_req = {
        "items": [
            {"producto_id": PRODUCTO_A_ID, "cantidad": 4}
        ]
    }
    res = await async_client.post("/api/v1/promociones/evaluar-carrito", json=eval_req, headers=cajero_headers)
    assert res.status_code == 200
    data = res.json()
    assert float(data["subtotal_bruto"]) == 104.00
    assert float(data["total_descuento"]) == 10.40
    assert float(data["total_con_descuento"]) == 93.60
    assert len(data["promociones_aplicadas"]) == 1

@pytest.mark.asyncio
async def test_evaluar_carrito__monto_minimo(
    async_client: AsyncClient,
    cajero_headers: dict,
    director_headers: dict
):
    """Evalúa un carrito aplicando descuento por superar monto mínimo"""
    # Regla: Subtotal >= 50.00 tiene $5.00 de descuento fijo
    await async_client.post("/api/v1/promociones/", json={
        "nombre": "Ticket Mayor a $50",
        "tipo_regla": "MONTO_MINIMO",
        "monto_minimo": 50.00,
        "descuento_tipo": "MONTO_FIJO",
        "descuento_valor": 5.00,
        "activo": True
    }, headers=director_headers)

    # 3 Leches a 26.00 = 78.00 >= 50.00
    eval_req = {
        "items": [
            {"producto_id": PRODUCTO_A_ID, "cantidad": 3}
        ]
    }
    res = await async_client.post("/api/v1/promociones/evaluar-carrito", json=eval_req, headers=cajero_headers)
    assert res.status_code == 200
    data = res.json()
    assert float(data["subtotal_bruto"]) == 78.00
    assert float(data["total_descuento"]) == 5.00
    assert float(data["total_con_descuento"]) == 73.00

@pytest.mark.asyncio
async def test_evaluar_carrito__margen_minimo_protege_contra_perdida(
    async_client: AsyncClient,
    cajero_headers: dict,
    director_headers: dict
):
    """Garantiza que el motor nunca otorgue un descuento que resulte en margen < 0 (no vender a pérdida)"""
    # Leche: venta 26.00, costo 18.50. Margen bruto unitario = 7.50.
    # Si la regla otorga un descuento excesivo de $20.00 por unidad, vendería a 6.00 (pérdida de 12.50).
    # El motor debe limitar el descuento a 7.50 para mantener margen >= 0.
    await async_client.post("/api/v1/promociones/", json={
        "nombre": "Descuento Excesivo",
        "tipo_regla": "VOLUMEN",
        "producto_disparador_id": PRODUCTO_A_ID,
        "cantidad_minima": 1.00,
        "descuento_tipo": "MONTO_FIJO",
        "descuento_valor": 20.00,
        "activo": True
    }, headers=director_headers)

    eval_req = {
        "items": [
            {"producto_id": PRODUCTO_A_ID, "cantidad": 1}
        ]
    }
    res = await async_client.post("/api/v1/promociones/evaluar-carrito", json=eval_req, headers=cajero_headers)
    assert res.status_code == 200
    data = res.json()
    assert float(data["subtotal_bruto"]) == 26.00
    # Descuento acotado al margen disponible (26.00 - 18.50 = 7.50)
    assert float(data["total_descuento"]) == 7.50
    assert float(data["total_con_descuento"]) == 18.50 # Precio final igual al costo base, margen = 0.00 (no pérdida)
    assert data["margen_respetado"] is True

@pytest.mark.asyncio
async def test_pos_checkout__aplica_descuento_promocion_automatica(
    async_client: AsyncClient,
    director_headers: dict
):
    """Checkout en POS aplica automáticamente las promociones activas y registra total_descuento"""
    # 1. Crear regla activa de monto mínimo: Ticket >= 50.00 obtiene 10.00 de descuento
    await async_client.post("/api/v1/promociones/", json={
        "nombre": "Promo Checkout Directo",
        "tipo_regla": "MONTO_MINIMO",
        "monto_minimo": 50.00,
        "descuento_tipo": "MONTO_FIJO",
        "descuento_valor": 10.00,
        "activo": True
    }, headers=director_headers)

    # 2. Abrir caja o reutilizar sesión activa
    abrir_res = await async_client.post(
        "/api/v1/caja/abrir",
        json={"fondo_inicial": 800.00, "terminal_id": "TERM-POS-PROMO"},
        headers=director_headers
    )
    if abrir_res.status_code == 200:
        sesion_id = abrir_res.json()["id"]
    else:
        sesiones = (await async_client.get("/api/v1/caja/sesiones", headers=director_headers)).json()
        sesion_id = sesiones[0]["id"]

    # 3. Comprar 3 leches a 26.00 = 78.00 bruto.
    # Descuento automático: 10.00. Total pagar: 68.00.
    checkout_payload = {
        "sesion_caja_id": sesion_id,
        "items": [
            {
                "producto_id": PRODUCTO_A_ID,
                "cantidad": 3
            }
        ],
        "pagos": [
            {
                "metodo_pago": "EFECTIVO",
                "monto": 78.88
            }
        ]
    }
    res_chk = await async_client.post("/api/v1/pos/checkout", json=checkout_payload, headers=director_headers)
    assert res_chk.status_code == 200
    data_chk = res_chk.json()
    assert float(data_chk["total_pagar"]) == 78.88
    assert data_chk["estado"] == "COMPLETADA"

    # 4. Verificar en el listado de ventas que total_descuento fue persistido en BD
    venta_id = data_chk["venta_id"]
    res_v = await async_client.get(f"/api/v1/pos/ventas/{venta_id}", headers=director_headers)
    assert res_v.status_code == 200
    venta_data = res_v.json()
    assert float(venta_data["total_bruto"]) == 78.00
    assert float(venta_data["total_descuento"]) == 10.00
    assert float(venta_data["total_pagar"]) == 78.88
