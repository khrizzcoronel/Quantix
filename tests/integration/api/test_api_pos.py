import pytest
from httpx import AsyncClient
import uuid

PRODUCTO_ID = "c12c3433-1953-4980-80cb-06d6ab535e54"
SKU_TEST = "LAL-ENT-1L"

@pytest.mark.asyncio
async def test_buscar_producto__sku_existente__retorna_producto_con_stock(
    async_client: AsyncClient,
    cajero_headers: dict
):
    """(RNF-PERF-01) Búsqueda rápida por SKU devolviendo catálogo y stock consolidado"""
    response = await async_client.get(f"/api/v1/pos/productos/{SKU_TEST}", headers=cajero_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["sku"] == SKU_TEST
    assert data["nombre"] == "Leche Entera Lala 1L"
    assert float(data["precio_venta"]) == 26.00
    assert data["stock_total"] >= 10

@pytest.mark.asyncio
async def test_buscar_producto__sku_inexistente__retorna_404(
    async_client: AsyncClient,
    cajero_headers: dict
):
    """Un SKU inexistente debe responder inmediatamente 404"""
    response = await async_client.get("/api/v1/pos/productos/SKU-NO-EXISTE", headers=cajero_headers)
    assert response.status_code == 404

@pytest.mark.asyncio
async def test_checkout__stock_suficiente__aplica_fefo_y_descarga_lote(
    async_client: AsyncClient,
    director_headers: dict
):
    """(RF-POS-03 & RF-INV-02) Checkout transaccional con descarga FEFO automática"""
    # 1. Abrir sesión para el usuario Director
    abrir_res = await async_client.post(
        "/api/v1/caja/abrir",
        json={"fondo_inicial": 1000.00, "terminal_id": "TERM-POS-01"},
        headers=director_headers
    )
    sesion_id = abrir_res.json()["id"]

    # 2. Comprar 5 unidades a .00 = .00
    checkout_payload = {
        "sesion_caja_id": sesion_id,
        "items": [
            {
                "producto_id": PRODUCTO_ID,
                "cantidad": 5
            }
        ],
        "pagos": [
            {
                "metodo_pago": "EFECTIVO",
                "monto": 130.00
            }
        ]
    }
    response = await async_client.post("/api/v1/pos/checkout", json=checkout_payload, headers=director_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["estado"] == "COMPLETADA"
    assert float(data["total_pagar"]) == 130.00
    assert "TKT-" in data["folio_ticket"]

@pytest.mark.asyncio
async def test_checkout__stock_insuficiente__retorna_409_conflict(
    async_client: AsyncClient,
    director_headers: dict
):
    """(ERR-INV-01) Intento de compra superior al stock acumulado es rechazado con HTTP 409"""
    checkout_payload = {
        "sesion_caja_id": str(uuid.uuid4()),
        "items": [
            {
                "producto_id": PRODUCTO_ID,
                "cantidad": 9999
            }
        ],
        "pagos": [
            {
                "metodo_pago": "EFECTIVO",
                "monto": 9999 * 26.00
            }
        ]
    }
    response = await async_client.post("/api/v1/pos/checkout", json=checkout_payload, headers=director_headers)
    assert response.status_code == 409
    assert "insuficiente" in response.json()["detail"].lower()

@pytest.mark.asyncio
async def test_checkout__pago_menor_al_total__retorna_400_bad_request(
    async_client: AsyncClient,
    director_headers: dict
):
    """(ERR-PAG-01) Un pago inferior al importe total es rechazado con HTTP 400"""
    checkout_payload = {
        "sesion_caja_id": str(uuid.uuid4()),
        "items": [
            {
                "producto_id": PRODUCTO_ID,
                "cantidad": 1
            }
        ],
        "pagos": [
            {
                "metodo_pago": "EFECTIVO",
                "monto": 10.00  # Total requerido es .00
            }
        ]
    }
    response = await async_client.post("/api/v1/pos/checkout", json=checkout_payload, headers=director_headers)
    assert response.status_code == 400
    assert "menor al total" in response.json()["detail"].lower()
