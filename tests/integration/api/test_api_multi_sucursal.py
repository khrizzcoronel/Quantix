import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_listar_sucursales_incluye_matriz_por_defecto(
    async_client: AsyncClient,
    cajero_headers: dict
):
    """Verifica que la base de datos contenga la Sucursal Matriz predeterminada"""
    res = await async_client.get("/api/v1/sucursales", headers=cajero_headers)
    assert res.status_code == 200
    sucursales = res.json()
    assert len(sucursales) >= 1
    matriz = next((s for s in sucursales if s["codigo"] == "MATRIZ"), None)
    assert matriz is not None
    assert matriz["es_matriz"] is True

@pytest.mark.asyncio
async def test_flujo_completo_transferencia_inter_sucursal(
    async_client: AsyncClient,
    supervisor_headers: dict
):
    """Verifica el ciclo de vida completo de un traspaso de inventario entre sucursales"""
    # 1. Crear Sucursal Destino
    res_suc = await async_client.post(
        "/api/v1/sucursales",
        json={
            "codigo": "SUC-TEST-01",
            "nombre": "Sucursal Test Satélite",
            "direccion": "Calle 45 Norte #123",
            "es_matriz": False
        },
        headers=supervisor_headers
    )
    assert res_suc.status_code == 201
    suc_destino = res_suc.json()

    # 2. Obtener la sucursal matriz y un producto con stock
    res_sucs = await async_client.get("/api/v1/sucursales", headers=supervisor_headers)
    matriz = next(s for s in res_sucs.json() if s["codigo"] == "MATRIZ")

    res_prods = await async_client.get("/api/v1/inventario/productos", headers=supervisor_headers)
    assert res_prods.status_code == 200
    prods = res_prods.json()
    assert len(prods) > 0
    prod = prods[0]

    # Crear un lote fresco con stock suficiente en la sucursal matriz
    res_lote = await async_client.post(
        "/api/v1/inventario/lotes/ingreso-directo",
        json={
            "producto_id": prod["id"],
            "codigo_lote": "LOTE-TR-MULTI-01",
            "cantidad": 50.0,
            "costo_unitario": 15.0,
            "fecha_vencimiento": "2027-12-31"
        },
        headers=supervisor_headers
    )
    assert res_lote.status_code == 201
    lote_creado = res_lote.json()
    cant_tr = 10.0

    # 3. Solicitar transferencia
    payload_tr = {
        "sucursal_origen_id": matriz["id"],
        "sucursal_destino_id": suc_destino["id"],
        "notas": "Traspaso de reposición urgente",
        "items": [
            {
                "producto_id": prod["id"],
                "cantidad": cant_tr,
                "lote_origen_id": lote_creado["id"]
            }
        ]
    }
    res_tr = await async_client.post("/api/v1/transferencias", json=payload_tr, headers=supervisor_headers)
    assert res_tr.status_code == 201
    tr_data = res_tr.json()
    assert tr_data["estado"] == "SOLICITADA"
    assert tr_data["folio"].startswith("TR-")
    assert len(tr_data["detalles"]) == 1

    # 4. Despachar transferencia
    tr_id = tr_data["id"]
    res_desp = await async_client.post(f"/api/v1/transferencias/{tr_id}/despachar", headers=supervisor_headers)
    assert res_desp.status_code == 200
    assert res_desp.json()["estado"] == "EN_TRANSITO"
    assert res_desp.json()["fecha_despacho"] is not None

    # 5. Recibir transferencia en destino
    res_rec = await async_client.post(f"/api/v1/transferencias/{tr_id}/recibir", headers=supervisor_headers)
    assert res_rec.status_code == 200
    assert res_rec.json()["estado"] == "RECIBIDA"
    assert res_rec.json()["fecha_recepcion"] is not None
    assert res_rec.json()["detalles"][0]["lote_destino_id"] is not None
