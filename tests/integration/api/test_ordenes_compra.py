import pytest
from httpx import AsyncClient
import uuid
from decimal import Decimal
from datetime import date, timedelta

@pytest.mark.asyncio
async def test_crear_y_listar_orden_compra(async_client: AsyncClient, director_headers: dict):
    # 1. Obtener o crear proveedor
    prov_res = await async_client.post(
        "/api/v1/inventario/proveedores",
        json={
            "nombre": f"Proveedor Test {uuid.uuid4().hex[:6]}",
            "contacto_nombre": "Juan Pérez",
            "telefono": "5551234567",
            "email": "juan@test.local",
            "lead_time_dias": 5
        },
        headers=director_headers
    )
    assert prov_res.status_code == 201
    prov_id = prov_res.json()["id"]

    # 2. Obtener categoría y crear producto
    cats = (await async_client.get("/api/v1/inventario/categorias", headers=director_headers)).json()
    cat_id = cats[0]["id"]
    sku = f"OC-PRD-{uuid.uuid4().hex[:6].upper()}"
    prod_res = await async_client.post(
        "/api/v1/inventario/productos",
        json={
            "categoria_id": cat_id,
            "sku": sku,
            "nombre": "Aceite Vegetal 1L",
            "costo_base": 30.0,
            "precio_venta": 45.0
        },
        headers=director_headers
    )
    assert prod_res.status_code == 201
    prod_id = prod_res.json()["id"]

    # 3. Crear orden de compra
    payload_orden = {
        "proveedor_id": prov_id,
        "notas": "Pedido semanal urgente",
        "items": [
            {
                "producto_id": prod_id,
                "cantidad_solicitada": 50,
                "costo_unitario_pactado": 29.50
            }
        ]
    }
    crear_res = await async_client.post(
        "/api/v1/inventario/ordenes-compra",
        json=payload_orden,
        headers=director_headers
    )
    assert crear_res.status_code == 201
    orden = crear_res.json()
    orden_id = orden["id"]
    assert orden["estado"] == "PENDIENTE"
    assert orden["proveedor_id"] == prov_id
    assert orden["proveedor_nombre"] is not None
    assert len(orden["detalles"]) == 1
    assert float(orden["detalles"][0]["cantidad_solicitada"]) == 50.0
    assert float(orden["detalles"][0]["costo_unitario_pactado"]) == 29.50
    assert float(orden["total_estimado"]) == 50 * 29.50

    # 4. Listar órdenes de compra con filtros
    list_res = await async_client.get(
        f"/api/v1/inventario/ordenes-compra?estado=PENDIENTE&proveedor_id={prov_id}",
        headers=director_headers
    )
    assert list_res.status_code == 200
    ordenes_list = list_res.json()
    assert any(o["id"] == orden_id for o in ordenes_list)


@pytest.mark.asyncio
async def test_cancelar_orden_compra(async_client: AsyncClient, director_headers: dict):
    # 1. Crear proveedor y producto
    prov_res = await async_client.post(
        "/api/v1/inventario/proveedores",
        json={"nombre": f"Proveedor Cancelar {uuid.uuid4().hex[:6]}"},
        headers=director_headers
    )
    prov_id = prov_res.json()["id"]

    cats = (await async_client.get("/api/v1/inventario/categorias", headers=director_headers)).json()
    cat_id = cats[0]["id"]
    prod_res = await async_client.post(
        "/api/v1/inventario/productos",
        json={
            "categoria_id": cat_id,
            "sku": f"CAN-{uuid.uuid4().hex[:6].upper()}",
            "nombre": "Harina de Trigo 1kg",
            "costo_base": 12.0,
            "precio_venta": 18.0
        },
        headers=director_headers
    )
    prod_id = prod_res.json()["id"]

    # 2. Crear orden
    crear_res = await async_client.post(
        "/api/v1/inventario/ordenes-compra",
        json={
            "proveedor_id": prov_id,
            "items": [{"producto_id": prod_id, "cantidad_solicitada": 20, "costo_unitario_pactado": 11.50}]
        },
        headers=director_headers
    )
    orden_id = crear_res.json()["id"]

    # 3. Cancelar orden
    cancel_res = await async_client.post(
        f"/api/v1/inventario/ordenes-compra/{orden_id}/cancelar",
        headers=director_headers
    )
    assert cancel_res.status_code == 200
    assert cancel_res.json()["estado"] == "CANCELADA"

    # 4. Intentar cancelar de nuevo debe retornar 400
    cancel_dup_res = await async_client.post(
        f"/api/v1/inventario/ordenes-compra/{orden_id}/cancelar",
        headers=director_headers
    )
    assert cancel_dup_res.status_code == 400


@pytest.mark.asyncio
async def test_recibir_orden_compra_y_generacion_lotes_sanitarios(async_client: AsyncClient, director_headers: dict):
    # 1. Crear proveedor y producto
    prov_res = await async_client.post(
        "/api/v1/inventario/proveedores",
        json={"nombre": f"Proveedor Recibir {uuid.uuid4().hex[:6]}"},
        headers=director_headers
    )
    prov_id = prov_res.json()["id"]

    cats = (await async_client.get("/api/v1/inventario/categorias", headers=director_headers)).json()
    cat_id = cats[0]["id"]
    prod_res = await async_client.post(
        "/api/v1/inventario/productos",
        json={
            "categoria_id": cat_id,
            "sku": f"REC-{uuid.uuid4().hex[:6].upper()}",
            "nombre": "Yogurt Griego 500g",
            "costo_base": 22.0,
            "precio_venta": 35.0
        },
        headers=director_headers
    )
    prod = prod_res.json()
    prod_id = prod["id"]
    assert float(prod["stock_total"]) == 0.0

    # 2. Crear orden de compra
    crear_res = await async_client.post(
        "/api/v1/inventario/ordenes-compra",
        json={
            "proveedor_id": prov_id,
            "items": [{"producto_id": prod_id, "cantidad_solicitada": 40, "costo_unitario_pactado": 21.00}]
        },
        headers=director_headers
    )
    orden_id = crear_res.json()["id"]

    # 3. Recibir orden de compra informando fecha de vencimiento
    vencimiento_test = (date.today() + timedelta(days=90)).isoformat()
    recibir_res = await async_client.post(
        f"/api/v1/inventario/ordenes-compra/{orden_id}/recibir",
        json={
            "items": [
                {
                    "producto_id": prod_id,
                    "cantidad_recibida": 40,
                    "costo_unitario_real": 21.00,
                    "fecha_vencimiento": vencimiento_test
                    # codigo_lote omitido para validar generación automática sanitaria
                }
            ],
            "notas": "Recepción conforme con control de temperatura"
        },
        headers=director_headers
    )
    assert recibir_res.status_code == 200
    orden_recibida = recibir_res.json()
    assert orden_recibida["estado"] == "RECIBIDA"
    assert orden_recibida["fecha_recepcion"] is not None

    # Validar lotes generados
    assert len(orden_recibida["lotes"]) == 1
    lote = orden_recibida["lotes"][0]
    assert lote["producto_id"] == prod_id
    assert lote["codigo_lote"].startswith("SAN-")
    assert lote["fecha_vencimiento"] == vencimiento_test
    assert float(lote["cantidad_disponible"]) == 40.0
    assert lote["estado"] == "ACTIVO"

    # 4. Validar que el stock consolidado del producto aumentó
    prod_updated = (await async_client.get(f"/api/v1/inventario/productos/{prod_id}", headers=director_headers)).json()
    assert float(prod_updated["stock_total"]) == 40.0
    assert prod_updated["lotes_activos_count"] >= 1

    # 5. Intentar cancelar una orden ya recibida debe fallar con 400
    cancel_fail = await async_client.post(
        f"/api/v1/inventario/ordenes-compra/{orden_id}/cancelar",
        headers=director_headers
    )
    assert cancel_fail.status_code == 400

    # 6. Intentar recibir nuevamente debe fallar con 400
    recibir_fail = await async_client.post(
        f"/api/v1/inventario/ordenes-compra/{orden_id}/recibir",
        json={},
        headers=director_headers
    )
    assert recibir_fail.status_code == 400


@pytest.mark.asyncio
async def test_recibir_orden_compra_auto_default(async_client: AsyncClient, director_headers: dict):
    # Crear proveedor, producto y orden
    prov = (await async_client.post(
        "/api/v1/inventario/proveedores",
        json={"nombre": f"Prov Auto {uuid.uuid4().hex[:6]}"},
        headers=director_headers
    )).json()

    cats = (await async_client.get("/api/v1/inventario/categorias", headers=director_headers)).json()
    prod = (await async_client.post(
        "/api/v1/inventario/productos",
        json={
            "categoria_id": cats[0]["id"],
            "sku": f"AUT-{uuid.uuid4().hex[:6].upper()}",
            "nombre": "Arroz Blanco 1kg",
            "costo_base": 15.0,
            "precio_venta": 22.0
        },
        headers=director_headers
    )).json()

    orden = (await async_client.post(
        "/api/v1/inventario/ordenes-compra",
        json={
            "proveedor_id": prov["id"],
            "items": [{"producto_id": prod["id"], "cantidad_solicitada": 30, "costo_unitario_pactado": 14.50}]
        },
        headers=director_headers
    )).json()

    # Recibir enviando payload vacío / sin items para que tome los detalles de la orden
    recibir_res = await async_client.post(
        f"/api/v1/inventario/ordenes-compra/{orden['id']}/recibir",
        json={},
        headers=director_headers
    )
    assert recibir_res.status_code == 200
    recibida = recibir_res.json()
    assert recibida["estado"] == "RECIBIDA"
    assert len(recibida["lotes"]) == 1
    assert recibida["lotes"][0]["codigo_lote"].startswith("SAN-")
    assert float(recibida["lotes"][0]["cantidad_disponible"]) == 30.0


@pytest.mark.asyncio
async def test_sugerencias_reorden(async_client: AsyncClient, director_headers: dict):
    # Llamar endpoint de sugerencias
    res = await async_client.get("/api/v1/inventario/ordenes-compra/sugerencias", headers=director_headers)
    assert res.status_code == 200
    sugerencias = res.json()
    assert isinstance(sugerencias, list)
    if len(sugerencias) > 0:
        sug = sugerencias[0]
        assert "producto_id" in sug
        assert "sku" in sug
        assert "stock_actual" in sug
        assert "punto_reorden" in sug
        assert "sugerido_compra" in sug
        assert float(sug["sugerido_compra"]) > 0


@pytest.mark.asyncio
async def test_modo_bodeguero_operaciones(async_client: AsyncClient, bodeguero_headers: dict, director_headers: dict):
    # El bodeguero puede consultar órdenes, crearlas y recibir mercancía
    prov = (await async_client.post(
        "/api/v1/inventario/proveedores",
        json={"nombre": f"Prov Bodega {uuid.uuid4().hex[:6]}"},
        headers=director_headers
    )).json()

    cats = (await async_client.get("/api/v1/inventario/categorias", headers=director_headers)).json()
    prod = (await async_client.post(
        "/api/v1/inventario/productos",
        json={
            "categoria_id": cats[0]["id"],
            "sku": f"BOD-{uuid.uuid4().hex[:6].upper()}",
            "nombre": "Atún en Agua 140g",
            "costo_base": 16.0,
            "precio_venta": 24.0
        },
        headers=director_headers
    )).json()

    # 1. Bodeguero crea orden de compra
    oc_res = await async_client.post(
        "/api/v1/inventario/ordenes-compra",
        json={
            "proveedor_id": prov["id"],
            "items": [{"producto_id": prod["id"], "cantidad_solicitada": 60, "costo_unitario_pactado": 15.00}]
        },
        headers=bodeguero_headers
    )
    assert oc_res.status_code == 201
    orden_id = oc_res.json()["id"]

    # 2. Bodeguero lista órdenes
    list_res = await async_client.get("/api/v1/inventario/ordenes-compra", headers=bodeguero_headers)
    assert list_res.status_code == 200

    # 3. Bodeguero recibe mercancía
    rec_res = await async_client.post(
        f"/api/v1/inventario/ordenes-compra/{orden_id}/recibir",
        json={
            "items": [
                {
                    "producto_id": prod["id"],
                    "cantidad_recibida": 60,
                    "costo_unitario_real": 15.00,
                    "fecha_vencimiento": (date.today() + timedelta(days=365)).isoformat()
                }
            ]
        },
        headers=bodeguero_headers
    )
    assert rec_res.status_code == 200
    assert rec_res.json()["estado"] == "RECIBIDA"
