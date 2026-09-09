import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from app.models.ventas import Venta, Cliente

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

    # 2. Comprar 5 unidades a $26.00; IVA 16% = $20.80
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
                "monto": 150.80
            }
        ]
    }
    response = await async_client.post("/api/v1/pos/checkout", json=checkout_payload, headers=director_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["estado"] == "COMPLETADA"
    assert float(data["subtotal"]) == 130.00
    assert float(data["total_impuestos"]) == 20.80
    assert float(data["total_pagar"]) == 150.80
    assert "TKT-" in data["folio_ticket"]

@pytest.mark.asyncio
async def test_checkout__stock_insuficiente__retorna_409_conflict(
    async_client: AsyncClient,
    director_headers: dict
):
    """(ERR-INV-01) Intento de compra superior al stock acumulado es rechazado con HTTP 409"""
    sesiones = (await async_client.get("/api/v1/caja/sesiones", headers=director_headers)).json()
    checkout_payload = {
        "sesion_caja_id": sesiones[0]["id"],
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
    sesiones = (await async_client.get("/api/v1/caja/sesiones", headers=director_headers)).json()
    checkout_payload = {
        "sesion_caja_id": sesiones[0]["id"],
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


@pytest.mark.asyncio
async def test_checkout__misma_idempotency_key__devuelve_la_misma_venta(
    async_client: AsyncClient,
    director_headers: dict,
):
    sesiones = (await async_client.get("/api/v1/caja/sesiones", headers=director_headers)).json()
    payload = {
        "sesion_caja_id": sesiones[0]["id"],
        "idempotency_key": "checkout-idempotente-001",
        "items": [{"producto_id": PRODUCTO_ID, "cantidad": 1}],
        "pagos": [{"metodo_pago": "EFECTIVO", "monto": 30.16}],
    }

    first = await async_client.post("/api/v1/pos/checkout", json=payload, headers=director_headers)
    second = await async_client.post("/api/v1/pos/checkout", json=payload, headers=director_headers)

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["venta_id"] == second.json()["venta_id"]
    assert "ya procesada" in second.json()["mensaje"].lower()


@pytest.mark.asyncio
async def test_checkout__tarjeta_simulada__captura_total_calculado_por_servidor(
    async_client: AsyncClient,
    director_headers: dict,
):
    sesiones = (await async_client.get("/api/v1/caja/sesiones", headers=director_headers)).json()
    payload = {
        "sesion_caja_id": sesiones[0]["id"],
        "idempotency_key": "checkout-tarjeta-aprobada-001",
        "items": [{"producto_id": PRODUCTO_ID, "cantidad": 1}],
        "pagos": [{
            "metodo_pago": "TARJETA",
            "monto": 100,
            "referencia_pasarela": "SIM-APPROVED",
        }],
    }

    response = await async_client.post("/api/v1/pos/checkout", json=payload, headers=director_headers)

    assert response.status_code == 200
    venta_id = response.json()["venta_id"]
    detalle = await async_client.get(f"/api/v1/pos/ventas/{venta_id}", headers=director_headers)
    pago = detalle.json()["pagos"][0]
    assert float(pago["monto"]) == float(response.json()["total_pagar"])
    assert pago["referencia_pasarela"].startswith("SIMPAY-")


@pytest.mark.asyncio
async def test_checkout__tarjeta_simulada_rechazada__no_crea_venta(
    async_client: AsyncClient,
    director_headers: dict,
    db_session: AsyncSession,
):
    sesiones = (await async_client.get("/api/v1/caja/sesiones", headers=director_headers)).json()
    payload = {
        "sesion_caja_id": sesiones[0]["id"],
        "idempotency_key": "checkout-tarjeta-rechazada-001",
        "items": [{"producto_id": PRODUCTO_ID, "cantidad": 1}],
        "pagos": [{
            "metodo_pago": "TARJETA",
            "monto": 30.16,
            "referencia_pasarela": "SIM-DECLINED",
        }],
    }

    response = await async_client.post("/api/v1/pos/checkout", json=payload, headers=director_headers)
    venta = await db_session.scalar(
        select(Venta).where(Venta.idempotency_key == payload["idempotency_key"])
    )

    assert response.status_code == 402
    assert venta is None


@pytest.mark.asyncio
async def test_checkout__timeout_persistido__requiere_conciliacion_y_no_duplica_cobro(
    async_client: AsyncClient,
    director_headers: dict,
    cajero_headers: dict,
):
    sesiones = (await async_client.get("/api/v1/caja/sesiones", headers=director_headers)).json()
    checkout_key = "checkout-timeout-conciliado-001"
    payload = {
        "sesion_caja_id": sesiones[0]["id"],
        "idempotency_key": checkout_key,
        "items": [{"producto_id": PRODUCTO_ID, "cantidad": 1}],
        "pagos": [{
            "metodo_pago": "TARJETA",
            "monto": 30.16,
            "referencia_pasarela": "SIM-TIMEOUT",
        }],
    }

    timeout = await async_client.post("/api/v1/pos/checkout", json=payload, headers=director_headers)
    intentos = await async_client.get(f"/api/v1/pagos/intentos/{checkout_key}", headers=director_headers)

    assert timeout.status_code == 504
    assert intentos.status_code == 200
    assert len(intentos.json()) == 1
    assert intentos.json()[0]["estado"] == "INCIERTO"

    retry_bloqueado = await async_client.post("/api/v1/pos/checkout", json=payload, headers=director_headers)
    assert retry_bloqueado.status_code == 409
    assert "conciliación" in retry_bloqueado.json()["detail"].lower()

    intento_id = intentos.json()[0]["id"]
    forbidden = await async_client.post(
        f"/api/v1/pagos/intentos/{intento_id}/conciliar",
        json={"resultado": "APROBADO"},
        headers=cajero_headers,
    )
    assert forbidden.status_code == 403

    conciliado = await async_client.post(
        f"/api/v1/pagos/intentos/{intento_id}/conciliar",
        json={"resultado": "APROBADO", "detalle": "Confirmado por conciliación de prueba"},
        headers=director_headers,
    )
    assert conciliado.status_code == 200
    assert conciliado.json()["estado"] == "APROBADO"
    assert conciliado.json()["referencia_pasarela"].startswith("SIMPAY-")

    completado = await async_client.post("/api/v1/pos/checkout", json=payload, headers=director_headers)
    assert completado.status_code == 200

    final = await async_client.get(f"/api/v1/pagos/intentos/{checkout_key}", headers=director_headers)
    assert len(final.json()) == 1
    assert final.json()[0]["estado"] == "VINCULADO"
    assert final.json()[0]["venta_id"] == completado.json()["venta_id"]


@pytest.mark.asyncio
async def test_pos_ventas_listar_y_detalle_y_anular(
    async_client: AsyncClient,
    director_headers: dict
):
    """Prueba listado de ventas, detalle exhaustivo y baja lógica / anulación con restitución de stock"""
    # 1. Abrir sesión si no existe
    abrir_res = await async_client.post(
        "/api/v1/caja/abrir",
        json={"fondo_inicial": 500.00, "terminal_id": "TERM-POS-02"},
        headers=director_headers
    )
    if abrir_res.status_code == 200:
        sesion_id = abrir_res.json()["id"]
    else:
        sesiones = (await async_client.get("/api/v1/caja/sesiones", headers=director_headers)).json()
        sesion_id = sesiones[0]["id"]

    # 2. Realizar checkout de 2 unidades
    checkout_payload = {
        "sesion_caja_id": sesion_id,
        "items": [{"producto_id": PRODUCTO_ID, "cantidad": 2}],
        "pagos": [{"metodo_pago": "EFECTIVO", "monto": 60.32}]
    }
    chk_res = await async_client.post("/api/v1/pos/checkout", json=checkout_payload, headers=director_headers)
    assert chk_res.status_code == 200
    venta_id = chk_res.json()["venta_id"]

    # 3. Listar ventas y verificar que aparece
    ventas_res = await async_client.get("/api/v1/pos/ventas", headers=director_headers)
    assert ventas_res.status_code == 200
    ventas = ventas_res.json()
    assert any(v["id"] == venta_id for v in ventas)

    # 4. Obtener detalle de venta
    detalle_res = await async_client.get(f"/api/v1/pos/ventas/{venta_id}", headers=director_headers)
    assert detalle_res.status_code == 200
    det_data = detalle_res.json()
    assert det_data["id"] == venta_id
    assert det_data["estado"] == "COMPLETADA"
    assert len(det_data["detalles"]) >= 1
    assert len(det_data["pagos"]) >= 1

    # 5. Anular venta (Baja Lógica)
    anular_res = await async_client.post(
        f"/api/v1/pos/ventas/{venta_id}/anular",
        json={"motivo": "Devolución o error de caja"},
        headers=director_headers
    )
    assert anular_res.status_code == 200
    assert anular_res.json()["estado"] == "ANULADA"


@pytest.mark.asyncio
async def test_checkout_canje_puntos_lealtad(async_client: AsyncClient, director_headers: dict, db_session: AsyncSession):
    # 1. Crear un cliente con 100 puntos acumulados
    cliente = Cliente(
        nombre="Cliente Puntos Test",
        telefono="5559998877",
        email="puntos@test.com",
        puntos_acumulados=100
    )
    db_session.add(cliente)
    await db_session.commit()
    await db_session.refresh(cliente)
    cliente_id = str(cliente.id)

    # 2. Abrir sesión de caja si no existe
    abrir_res = await async_client.post(
        "/api/v1/caja/abrir",
        json={"fondo_inicial": 500.0, "terminal_id": "POS-PUNTOS-1"},
        headers=director_headers
    )
    if abrir_res.status_code == 200:
        sesion_id = abrir_res.json()["id"]
    else:
        sesiones = (await async_client.get("/api/v1/caja/sesiones", headers=director_headers)).json()
        sesion_id = sesiones[0]["id"]

    # 3. Canje con más puntos de los disponibles -> Error 400
    checkout_fail = await async_client.post(
        "/api/v1/pos/checkout",
        json={
            "sesion_caja_id": sesion_id,
            "cliente_id": cliente_id,
            "items": [{"producto_id": PRODUCTO_ID, "cantidad": 1}],
            "puntos_canjeados": 500,
            "metodo_pago": "EFECTIVO"
        },
        headers=director_headers
    )
    assert checkout_fail.status_code == 400
    assert "Puntos insuficientes" in checkout_fail.json()["detail"]

    # 4. Canje exitoso: 50 puntos = $5.00 MXN de descuento
    # Producto cuesta 26.00 + IVA (16%) = 30.16. Con $5.00 descuento -> base 21.00 + IVA (3.36) = 24.36
    checkout_ok = await async_client.post(
        "/api/v1/pos/checkout",
        json={
            "sesion_caja_id": sesion_id,
            "cliente_id": cliente_id,
            "items": [{"producto_id": PRODUCTO_ID, "cantidad": 1}],
            "puntos_canjeados": 50,
            "pagos": [{"metodo_pago": "EFECTIVO", "monto": 24.36}]
        },
        headers=director_headers
    )
    assert checkout_ok.status_code == 200
    res_data = checkout_ok.json()
    assert res_data["puntos_canjeados"] == 50
    assert float(res_data["descuento_puntos"]) == 5.0
    assert float(res_data["total_pagar"]) == 24.36

    # 5. Verificar puntos restantes del cliente (100 - 50 + puntos ganados por base 21 -> 2 pts = 52)
    cliente_db = (await db_session.execute(select(Cliente).where(Cliente.id == uuid.UUID(cliente_id)))).scalar_one()
    assert cliente_db.puntos_acumulados == 52

    # 6. Probar envío de ticket por correo
    venta_id = res_data["venta_id"]
    email_res = await async_client.post(
        f"/api/v1/pos/ventas/{venta_id}/enviar-ticket",
        json={"email": "cliente@test.com"},
        headers=director_headers
    )
    assert email_res.status_code == 200
    assert "enviado exitosamente" in email_res.json()["mensaje"]


@pytest.mark.asyncio
async def test_checkout_sin_cliente_y_detalle_ticket(
    async_client: AsyncClient,
    director_headers: dict
):
    """
    Verifica que una venta sin cliente asociado (cliente_id=None) proceda sin errores
    y que el endpoint /pos/ventas/{id} retorne campos nulos limpios para cliente (nombre, teléfono, email)
    garantizando que el POS y el modal de tickets no sufran White Screen of Death.
    """
    # 1. Abrir sesión de caja si no existe
    abrir_res = await async_client.post(
        "/api/v1/caja/abrir",
        json={"fondo_inicial": 500.00, "terminal_id": "TERM-POS-NOCLI"},
        headers=director_headers
    )
    if abrir_res.status_code == 200:
        sesion_id = abrir_res.json()["id"]
    else:
        sesiones = (await async_client.get("/api/v1/caja/sesiones", headers=director_headers)).json()
        sesion_id = sesiones[0]["id"]

    # 2. Checkout sin cliente_id (None)
    checkout_payload = {
        "sesion_caja_id": sesion_id,
        "cliente_id": None,
        "items": [
            {
                "producto_id": PRODUCTO_ID,
                "cantidad": 2
            }
        ],
        "pagos": [
            {
                "metodo_pago": "EFECTIVO",
                "monto": 60.32
            }
        ]
    }
    checkout_res = await async_client.post("/api/v1/pos/checkout", json=checkout_payload, headers=director_headers)
    assert checkout_res.status_code == 200
    venta_data = checkout_res.json()
    venta_id = venta_data["venta_id"]

    # 3. Consultar detalle de la venta (como hace abrirTicketModalDesdeVenta en el POS)
    detalle_res = await async_client.get(f"/api/v1/pos/ventas/{venta_id}", headers=director_headers)
    assert detalle_res.status_code == 200
    ticket = detalle_res.json()

    assert ticket["id"] == venta_id
    assert ticket["cliente_id"] is None
    assert ticket["cliente_nombre"] is None
    assert ticket["cliente_telefono"] is None
    assert ticket["cliente_email"] is None
    assert ticket["estado"] == "COMPLETADA"
    assert float(ticket["total_pagar"]) == 60.32
    assert len(ticket["detalles"]) >= 1
    total_unidades = sum(float(d["cantidad"]) for d in ticket["detalles"])
    assert total_unidades == 2.0
    for d in ticket["detalles"]:
        assert d["producto_sku"] == SKU_TEST
    assert len(ticket["pagos"]) == 1
    assert ticket["pagos"][0]["metodo_pago"] == "EFECTIVO"



