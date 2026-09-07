import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_abrir_caja__cajero_valido__retorna_200_y_sesion_abierta(
    async_client: AsyncClient,
    cajero_headers: dict
):
    """(RF-POS-06) Un cajero con credenciales válidas puede aperturar caja exitosamente"""
    payload = {
        "fondo_inicial": 500.00,
        "terminal_id": "TERM-TEST-01"
    }
    response = await async_client.post("/api/v1/caja/abrir", json=payload, headers=cajero_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["estado"] == "ABIERTA"
    assert float(data["fondo_inicial"]) == 500.00
    assert data["terminal_id"] == "TERM-TEST-01"

@pytest.mark.asyncio
async def test_abrir_caja__sesion_ya_abierta__retorna_400_conflict(
    async_client: AsyncClient,
    cajero_headers: dict
):
    """Un cajero no puede abrir una segunda sesión si ya tiene una en estado ABIERTA"""
    # Intentar abrir una segunda sesión
    payload = {
        "fondo_inicial": 300.00,
        "terminal_id": "TERM-TEST-02"
    }
    response = await async_client.post("/api/v1/caja/abrir", json=payload, headers=cajero_headers)
    assert response.status_code == 400
    assert "ya tiene una sesión" in response.json()["detail"].lower()

@pytest.mark.asyncio
async def test_arqueo_ciego__conteo_exacto__cierra_sesion_con_ok(
    async_client: AsyncClient,
    cajero_headers: dict
):
    """(RF-SEG-01) El arqueo ciego calcula diferencia 0.00 cuando el conteo físico coincide"""
    # La sesión ya fue abierta con 500.00 en los tests previos
    payload = {
        "conteo_declarado": {
            "efectivo": 500.00,
            "tarjeta": 0.00,
            "transferencia": 0.00,
            "otros": 0.00
        }
    }
    response = await async_client.post("/api/v1/caja/arqueo-ciego", json=payload, headers=cajero_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["estado"] == "OK"
    assert float(data["diferencia"]) == 0.00
    assert data["requiere_auditoria"] is False

@pytest.mark.asyncio
async def test_arqueo_ciego__sin_sesion_abierta__retorna_404(
    async_client: AsyncClient,
    cajero_headers: dict
):
    """(ERR-CAJ-01) No se puede ejecutar un arqueo si el usuario no tiene sesión abierta"""
    payload = {
        "conteo_declarado": {
            "efectivo": 100.00,
            "tarjeta": 0.00,
            "transferencia": 0.00,
            "otros": 0.00
        }
    }
    response = await async_client.post("/api/v1/caja/arqueo-ciego", json=payload, headers=cajero_headers)
    assert response.status_code == 404
    assert "no tienes una sesión" in response.json()["detail"].lower()

@pytest.mark.asyncio
async def test_arqueo_ciego__descuadre_excesivo__marca_descuadre_y_alerta(
    async_client: AsyncClient,
    supervisor_headers: dict
):
    """El arqueo con diferencia mayor a la tolerancia dispara alerta y estado FALTANTE"""
    # 1. Abrir caja con el supervisor
    abrir_res = await async_client.post(
        "/api/v1/caja/abrir", 
        json={"fondo_inicial": 1000.00, "terminal_id": "TERM-SUPER"}, 
        headers=supervisor_headers
    )
    assert abrir_res.status_code == 200
    
    # 2. Arqueo con faltante de  (declaró 900 de los 1000 esperados)
    payload = {
        "conteo_declarado": {
            "efectivo": 900.00,
            "tarjeta": 0.00,
            "transferencia": 0.00,
            "otros": 0.00
        }
    }
    response = await async_client.post("/api/v1/caja/arqueo-ciego", json=payload, headers=supervisor_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["estado"] == "FALTANTE"
    assert float(data["diferencia"]) == -100.00
    assert data["requiere_auditoria"] is True
