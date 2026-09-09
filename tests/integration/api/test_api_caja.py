import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import text
from tests.conftest import test_engine

@pytest_asyncio.fixture(autouse=True, scope="module")
async def clean_caja_state():
    async with test_engine.begin() as conn:
        await conn.execute(text("TRUNCATE TABLE incidencias_sync, ventas_offline_recibidas, detalles_venta, pagos_venta, ventas, movimiento_caja, arqueo_caja, sesion_caja CASCADE;"))
    yield

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


@pytest.mark.asyncio
async def test_movimientos_caja_ingreso_egreso_y_corte_x(
    async_client: AsyncClient,
    cajero_headers: dict
):
    """(RF-CAJA-MOV) Verifica registrar ingresos y egresos de caja, corte X y su impacto en arqueo ciego"""
    # 1. Abrir sesión con $500
    abrir_res = await async_client.post(
        "/api/v1/caja/abrir",
        json={"fondo_inicial": 500.00, "terminal_id": "TERM-MOV-01"},
        headers=cajero_headers
    )
    assert abrir_res.status_code == 200

    # 2. Registrar INGRESO extraordinario de $150 (dotación de monedas)
    mov_in_res = await async_client.post(
        "/api/v1/caja/movimientos",
        json={"tipo": "INGRESO", "monto": 150.00, "concepto": "Dotación cambio monedas"},
        headers=cajero_headers
    )
    assert mov_in_res.status_code == 200
    assert mov_in_res.json()["tipo"] == "INGRESO"
    assert float(mov_in_res.json()["monto"]) == 150.00

    # 3. Registrar EGRESO de $50 (compra de papelería)
    mov_out_res = await async_client.post(
        "/api/v1/caja/movimientos",
        json={"tipo": "EGRESO", "monto": 50.00, "concepto": "Compra de papelería urgente"},
        headers=cajero_headers
    )
    assert mov_out_res.status_code == 200
    assert mov_out_res.json()["tipo"] == "EGRESO"
    assert float(mov_out_res.json()["monto"]) == 50.00

    # 4. Listar movimientos
    movs_list = await async_client.get("/api/v1/caja/movimientos", headers=cajero_headers)
    assert movs_list.status_code == 200
    assert len(movs_list.json()) == 2

    # 5. Consultar Corte X (sin cerrar sesión)
    corte_x = await async_client.get("/api/v1/caja/corte-x", headers=cajero_headers)
    assert corte_x.status_code == 200
    corte_data = corte_x.json()
    assert float(corte_data["fondo_inicial"]) == 500.00
    assert float(corte_data["total_ingresos_extra"]) == 150.00
    assert float(corte_data["total_egresos_extra"]) == 50.00
    # Teórico = 500 + 0 ventas + 150 - 50 = 600
    assert float(corte_data["efectivo_teorico_en_caja"]) == 600.00
    assert len(corte_data["movimientos"]) == 2

    # 6. Cerrar sesión con arqueo ciego exacto de 600.00
    cierre_res = await async_client.post(
        "/api/v1/caja/arqueo-ciego",
        json={
            "conteo_declarado": {
                "efectivo": 600.00,
                "tarjeta": 0.00,
                "transferencia": 0.00,
                "otros": 0.00
            }
        },
        headers=cajero_headers
    )
    assert cierre_res.status_code == 200
    assert cierre_res.json()["estado"] == "OK"
    assert float(cierre_res.json()["diferencia"]) == 0.00


@pytest.mark.asyncio
async def test_movimiento_egreso_excede_disponible_retorna_400(
    async_client: AsyncClient,
    cajero_headers: dict
):
    """Intento de retiro de efectivo mayor al saldo teórico disponible es rechazado con 400"""
    # 1. Abrir con $100
    abrir_res = await async_client.post(
        "/api/v1/caja/abrir",
        json={"fondo_inicial": 100.00, "terminal_id": "TERM-MOV-02"},
        headers=cajero_headers
    )
    assert abrir_res.status_code == 200

    # 2. Intentar retirar $250
    fail_res = await async_client.post(
        "/api/v1/caja/movimientos",
        json={"tipo": "EGRESO", "monto": 250.00, "concepto": "Retiro no autorizado"},
        headers=cajero_headers
    )
    assert fail_res.status_code == 400
    assert "insuficiente" in fail_res.json()["detail"].lower()

    # 3. Cerrar caja con $100
    await async_client.post(
        "/api/v1/caja/arqueo-ciego",
        json={
            "conteo_declarado": {
                "efectivo": 100.00,
                "tarjeta": 0.00,
                "transferencia": 0.00,
                "otros": 0.00
            }
        },
        headers=cajero_headers
    )

