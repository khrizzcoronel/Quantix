import pytest
from httpx import AsyncClient
import uuid

@pytest.mark.asyncio
async def test_categorias_crud_completo_con_baja_logica(async_client: AsyncClient, director_headers: dict):
    # 1. Crear categoría
    res_crear = await async_client.post(
        "/api/v1/inventario/categorias",
        json={"nombre": f"Bebidas Test {uuid.uuid4().hex[:6]}", "descripcion": "Refrescos y jugos"},
        headers=director_headers
    )
    assert res_crear.status_code == 201
    cat = res_crear.json()
    cat_id = cat["id"]
    assert cat["activo"] is True

    # 2. Modificar categoría
    res_edit = await async_client.put(
        f"/api/v1/inventario/categorias/{cat_id}",
        json={"descripcion": "Refrescos, jugos y aguas"},
        headers=director_headers
    )
    assert res_edit.status_code == 200
    assert res_edit.json()["descripcion"] == "Refrescos, jugos y aguas"

    # 3. Baja lógica
    res_baja = await async_client.delete(
        f"/api/v1/inventario/categorias/{cat_id}",
        headers=director_headers
    )
    assert res_baja.status_code == 200
    assert res_baja.json()["activo"] is False

    # 4. Listar comprobando filtro activo_only
    res_list_activos = await async_client.get(
        "/api/v1/inventario/categorias?activo_only=true",
        headers=director_headers
    )
    assert res_list_activos.status_code == 200
    ids_activos = [c["id"] for c in res_list_activos.json()]
    assert cat_id not in ids_activos


@pytest.mark.asyncio
async def test_proveedores_crud_completo_con_baja_logica(async_client: AsyncClient, director_headers: dict):
    # 1. Crear proveedor
    nombre_prov = f"Distribuidora Bimbo {uuid.uuid4().hex[:6]}"
    res_crear = await async_client.post(
        "/api/v1/inventario/proveedores",
        json={
            "nombre": nombre_prov,
            "contacto_nombre": "Carlos Gómez",
            "telefono": "5551234567",
            "email": "carlos@bimbo.test",
            "lead_time_dias": 3
        },
        headers=director_headers
    )
    assert res_crear.status_code == 201
    prov = res_crear.json()
    prov_id = prov["id"]
    assert prov["activo"] is True
    assert prov["lead_time_dias"] == 3

    # 2. Modificar proveedor
    res_edit = await async_client.put(
        f"/api/v1/inventario/proveedores/{prov_id}",
        json={"lead_time_dias": 5, "telefono": "5559876543"},
        headers=director_headers
    )
    assert res_edit.status_code == 200
    assert res_edit.json()["lead_time_dias"] == 5
    assert res_edit.json()["telefono"] == "5559876543"

    # 3. Baja lógica
    res_baja = await async_client.delete(
        f"/api/v1/inventario/proveedores/{prov_id}",
        headers=director_headers
    )
    assert res_baja.status_code == 200
    assert res_baja.json()["activo"] is False


@pytest.mark.asyncio
async def test_productos_crud_completo_con_baja_logica_y_stock(async_client: AsyncClient, director_headers: dict):
    # Obtener categoría existente
    cats = (await async_client.get("/api/v1/inventario/categorias", headers=director_headers)).json()
    cat_id = cats[0]["id"]

    # 1. Crear producto
    sku = f"TEST-{uuid.uuid4().hex[:6].upper()}"
    res_crear = await async_client.post(
        "/api/v1/inventario/productos",
        json={
            "categoria_id": cat_id,
            "sku": sku,
            "nombre": "Galletas Emperador Chocolate",
            "codigo_barras": f"750{uuid.uuid4().hex[:10]}",
            "costo_base": 14.50,
            "precio_venta": 22.00,
            "margen_minimo_pct": 20.0,
            "requiere_pesaje": False,
            "clasificacion_abc": "A"
        },
        headers=director_headers
    )
    assert res_crear.status_code == 201
    prod = res_crear.json()
    prod_id = prod["id"]
    assert prod["sku"] == sku
    assert prod["activo"] is True
    assert float(prod["stock_total"]) == 0.0

    # 2. Modificar producto
    res_edit = await async_client.put(
        f"/api/v1/inventario/productos/{prod_id}",
        json={"precio_venta": 24.50, "nombre": "Galletas Emperador Chocolate 100g"},
        headers=director_headers
    )
    assert res_edit.status_code == 200
    assert float(res_edit.json()["precio_venta"]) == 24.50

    # 3. Registrar ingreso directo de mercancía (nutre stock)
    res_ingreso = await async_client.post(
        "/api/v1/inventario/lotes/ingreso-directo",
        json={
            "producto_id": prod_id,
            "codigo_lote": f"LOTE-{sku}-01",
            "cantidad": 50,
            "costo_unitario": 14.50,
            "fecha_vencimiento": "2026-11-30",
            "notas": "Ingreso directo por apertura"
        },
        headers=director_headers
    )
    assert res_ingreso.status_code == 201
    lote = res_ingreso.json()
    lote_id = lote["id"]
    assert float(lote["cantidad_disponible"]) == 50.0

    # 4. Verificar que producto refleje el stock sumado dinámicamente
    res_prod_stock = await async_client.get(
        f"/api/v1/inventario/productos/{prod_id}",
        headers=director_headers
    )
    assert res_prod_stock.status_code == 200
    assert float(res_prod_stock.json()["stock_total"]) == 50.0
    assert res_prod_stock.json()["lotes_activos_count"] == 1

    # 5. Baja lógica parcial de lote por merma
    res_baja_merma = await async_client.post(
        f"/api/v1/inventario/lotes/{lote_id}/baja",
        json={
            "motivo": "MERMA",
            "cantidad_baja": 10,
            "notas": "Empaques rotos en traslado"
        },
        headers=director_headers
    )
    assert res_baja_merma.status_code == 200
    assert float(res_baja_merma.json()["cantidad_disponible"]) == 40.0

    # 6. Baja lógica completa por caducidad
    res_baja_caducado = await async_client.post(
        f"/api/v1/inventario/lotes/{lote_id}/baja",
        json={
            "motivo": "CADUCADO",
            "notas": "Fecha de caducidad expirada"
        },
        headers=director_headers
    )
    assert res_baja_caducado.status_code == 200
    assert float(res_baja_caducado.json()["cantidad_disponible"]) == 0.0
    assert res_baja_caducado.json()["estado"] == "CADUCADO"

    # 7. Stock del producto ahora debe ser 0
    res_prod_stock_zero = await async_client.get(
        f"/api/v1/inventario/productos/{prod_id}",
        headers=director_headers
    )
    assert float(res_prod_stock_zero.json()["stock_total"]) == 0.0

    # 8. Baja lógica del producto
    res_baja_prod = await async_client.delete(
        f"/api/v1/inventario/productos/{prod_id}",
        headers=director_headers
    )
    assert res_baja_prod.status_code == 200
    assert res_baja_prod.json()["activo"] is False


@pytest.mark.asyncio
async def test_producto_imagen_guardar_y_obtener(async_client: AsyncClient, director_headers: dict):
    """Prueba el almacenamiento de imágenes base64 en la base de datos para productos"""
    cats = (await async_client.get("/api/v1/inventario/categorias", headers=director_headers)).json()
    cat_id = cats[0]["id"]
    sku = f"IMG-{uuid.uuid4().hex[:6].upper()}"
    demo_image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

    # 1. Crear producto con imagen
    res = await async_client.post(
        "/api/v1/inventario/productos",
        json={
            "categoria_id": cat_id,
            "sku": sku,
            "nombre": "Producto Con Foto",
            "costo_base": 10.0,
            "precio_venta": 20.0,
            "imagen": demo_image
        },
        headers=director_headers
    )
    assert res.status_code == 201
    prod_data = res.json()
    assert prod_data["imagen"] == demo_image
    p_id = prod_data["id"]

    # 2. Obtener producto y comprobar que trae la imagen
    res_get = await async_client.get(f"/api/v1/inventario/productos/{p_id}", headers=director_headers)
    assert res_get.status_code == 200
    assert res_get.json()["imagen"] == demo_image

    # 3. Actualizar imagen
    nueva_imagen = "data:image/jpeg;base64,demo_updated"
    res_put = await async_client.put(
        f"/api/v1/inventario/productos/{p_id}",
        json={"imagen": nueva_imagen},
        headers=director_headers
    )
    assert res_put.status_code == 200
    assert res_put.json()["imagen"] == nueva_imagen

