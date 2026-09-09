import datetime
import uuid
from decimal import Decimal
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventario import EstadoLote, LoteInventario, Producto
from app.models.sync import IncidenciaSync, VentaOfflineRecibida
from app.models.usuarios import EstadoSesionCaja, SesionCaja
from app.models.ventas import DetalleVenta, PagoVenta, Venta

PRODUCTO_ID = "c12c3433-1953-4980-80cb-06d6ab535e54"
SKU_TEST = "LAL-ENT-1L"


async def obtener_o_abrir_sesion(async_client: AsyncClient, headers: dict, terminal_id: str = "TERM-TEST") -> str:
    res = await async_client.get("/api/v1/caja/sesion-activa", headers=headers)
    if res.status_code == 200 and res.json():
        return res.json()["id"]
    abrir_res = await async_client.post(
        "/api/v1/caja/abrir",
        json={"fondo_inicial": 1000.00, "terminal_id": terminal_id},
        headers=headers,
    )
    return abrir_res.json()["id"]


@pytest.mark.asyncio
async def test_sync_venta_offline_exitosa(
    async_client: AsyncClient,
    cajero_headers: dict,
    db_session: AsyncSession,
):
    """
    Prueba de sincronización offline exitosa:
    - Validación de motor FEFO y descuento de lote más próximo a vencer.
    - Recálculo de precios del servidor (no confiar en cliente).
    - Creación de Venta con estado PAGADO, DetalleVenta y PagoVenta en EFECTIVO.
    - Registro de VentaOfflineRecibida con estado SINCRONIZADA.
    """
    # 1. Abrir sesión de caja para cajero
    sesion_id = await obtener_o_abrir_sesion(async_client, cajero_headers, "TERM-OFFLINE-01")

    # 2. Consultar y asegurar stock del lote más próximo a vencer
    lote_proximo_res = await db_session.execute(
        select(LoteInventario)
        .where(LoteInventario.producto_id == uuid.UUID(PRODUCTO_ID), LoteInventario.codigo_lote == "LOTE-EXPIRA-PRONTO")
    )
    lote_proximo = lote_proximo_res.scalar_one()
    if float(lote_proximo.cantidad_disponible) < 4:
        lote_proximo.cantidad_disponible = Decimal("10.00")
        lote_proximo.estado = EstadoLote.ACTIVO
        await db_session.commit()
        await db_session.refresh(lote_proximo)

    stock_inicial_proximo = float(lote_proximo.cantidad_disponible)
    assert stock_inicial_proximo >= 4

    # 3. Payload offline con 4 unidades
    id_local = str(uuid.uuid4())
    ahora = datetime.datetime.utcnow().isoformat()
    sync_payload = {
        "ventas": [
            {
                "id_local": id_local,
                "terminal_id": "TERM-OFFLINE-01",
                "sesion_caja_id": sesion_id,
                "fecha_local": ahora,
                "items": [
                    {
                        "producto_id": PRODUCTO_ID,
                        "cantidad": 4,
                        "precio_unitario": 999.00,  # Precio intencionalmente falso para verificar recálculo en servidor
                    }
                ],
                "total_local": 3996.00,
            }
        ]
    }

    # 4. Enviar a endpoint de sincronización
    response = await async_client.post(
        "/api/v1/sync/ventas-offline",
        json=sync_payload,
        headers=cajero_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["procesadas"] == 1
    assert data["exitosas"] == 1
    assert data["conflictos"] == 0
    assert len(data["detalles"]) == 1

    item_res = data["detalles"][0]
    assert item_res["id_local"] == id_local
    assert item_res["estado"] == "SINCRONIZADA"
    assert item_res["venta_id"] is not None
    assert item_res["folio_ticket"] is not None
    assert "TKT-" in item_res["folio_ticket"]

    # 5. Validar persistencia en base de datos
    venta_id = uuid.UUID(item_res["venta_id"])
    venta_db = await db_session.get(Venta, venta_id)
    assert venta_db is not None
    assert venta_db.estado == "PAGADO"
    assert venta_db.idempotency_key == id_local
    # 4 unidades * $26.00 = $104.00; IVA 16% = $16.64; Total = $120.64
    assert float(venta_db.total_bruto) == 104.00
    assert float(venta_db.total_impuestos) == 16.64
    assert float(venta_db.total_pagar) == 120.64

    # Validar DetalleVenta
    detalles_db = (
        await db_session.execute(select(DetalleVenta).where(DetalleVenta.venta_id == venta_id))
    ).scalars().all()
    assert len(detalles_db) == 1
    assert float(detalles_db[0].cantidad) == 4.0
    assert float(detalles_db[0].precio_unitario_venta) == 26.00

    # Validar PagoVenta en EFECTIVO
    pagos_db = (
        await db_session.execute(select(PagoVenta).where(PagoVenta.venta_id == venta_id))
    ).scalars().all()
    assert len(pagos_db) == 1
    assert pagos_db[0].metodo_pago == "EFECTIVO"
    assert float(pagos_db[0].monto) == 120.64

    # Validar VentaOfflineRecibida
    recibida_db = (
        await db_session.execute(
            select(VentaOfflineRecibida).where(VentaOfflineRecibida.id_local == id_local)
        )
    ).scalar_one()
    assert recibida_db.estado == "SINCRONIZADA"
    assert recibida_db.venta_id == venta_id
    assert recibida_db.terminal_id == "TERM-OFFLINE-01"

    # Validar descuento de inventario FEFO sobre el lote próximo
    await db_session.refresh(lote_proximo)
    assert float(lote_proximo.cantidad_disponible) == stock_inicial_proximo - 4.0


@pytest.mark.asyncio
async def test_sync_venta_offline_idempotencia(
    async_client: AsyncClient,
    cajero_headers: dict,
    db_session: AsyncSession,
):
    """
    Prueba de idempotencia en sincronización:
    - El reenvío del mismo id_local devuelve YA_PROCESADA.
    - No descuenta doble stock de inventario.
    - Devuelve el venta_id y folio originales.
    """
    # 1. Abrir o reutilizar sesión
    sesion_id = await obtener_o_abrir_sesion(async_client, cajero_headers, "TERM-OFFLINE-02")

    id_local = str(uuid.uuid4())
    sync_payload = {
        "ventas": [
            {
                "id_local": id_local,
                "terminal_id": "TERM-OFFLINE-02",
                "sesion_caja_id": sesion_id,
                "fecha_local": datetime.datetime.utcnow().isoformat(),
                "items": [{"producto_id": PRODUCTO_ID, "cantidad": 2, "precio_unitario": 26.00}],
            }
        ]
    }

    # Asegurar stock antes de sincronizar
    lote_res = await db_session.execute(
        select(LoteInventario).where(LoteInventario.producto_id == uuid.UUID(PRODUCTO_ID), LoteInventario.codigo_lote == "LOTE-EXPIRA-PRONTO")
    )
    lote = lote_res.scalar_one()
    if float(lote.cantidad_disponible) < 2:
        lote.cantidad_disponible = Decimal("10.00")
        lote.estado = EstadoLote.ACTIVO
        await db_session.commit()
        await db_session.refresh(lote)

    # Primera sincronización
    res1 = await async_client.post("/api/v1/sync/ventas-offline", json=sync_payload, headers=cajero_headers)
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["detalles"][0]["estado"] == "SINCRONIZADA"
    primer_venta_id = data1["detalles"][0]["venta_id"]
    primer_folio = data1["detalles"][0]["folio_ticket"]

    # Consultar stock después de la primera venta
    await db_session.refresh(lote)
    stock_tras_primera = float(lote.cantidad_disponible)

    # Reenvío de la misma venta
    res2 = await async_client.post("/api/v1/sync/ventas-offline", json=sync_payload, headers=cajero_headers)
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["procesadas"] == 1
    assert data2["exitosas"] == 1
    assert data2["conflictos"] == 0

    item2 = data2["detalles"][0]
    assert item2["id_local"] == id_local
    assert item2["estado"] == "YA_PROCESADA"
    assert item2["venta_id"] == primer_venta_id
    assert item2["folio_ticket"] == primer_folio

    # Verificar que el stock no cambió
    await db_session.refresh(lote)
    assert float(lote.cantidad_disponible) == stock_tras_primera


@pytest.mark.asyncio
async def test_sync_venta_offline_conflicto_stock(
    async_client: AsyncClient,
    cajero_headers: dict,
    db_session: AsyncSession,
):
    """
    Prueba de conflicto por stock insuficiente:
    - NUNCA genera stock negativo ni lotes falsos.
    - No crea registro en tabla Venta.
    - Registra VentaOfflineRecibida con estado PENDIENTE_REVISION.
    - Registra IncidenciaSync con tipo STOCK_INSUFICIENTE y resuelto=False.
    """
    sesion_id = await obtener_o_abrir_sesion(async_client, cajero_headers, "TERM-OFFLINE-03")

    id_local = str(uuid.uuid4())
    # Pedir 99999 unidades, superando con creces el stock disponible
    sync_payload = {
        "ventas": [
            {
                "id_local": id_local,
                "terminal_id": "TERM-OFFLINE-03",
                "sesion_caja_id": sesion_id,
                "fecha_local": datetime.datetime.utcnow().isoformat(),
                "items": [{"producto_id": PRODUCTO_ID, "cantidad": 99999, "precio_unitario": 26.00}],
            }
        ]
    }

    response = await async_client.post("/api/v1/sync/ventas-offline", json=sync_payload, headers=cajero_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["procesadas"] == 1
    assert data["exitosas"] == 0
    assert data["conflictos"] == 1

    item = data["detalles"][0]
    assert item["id_local"] == id_local
    assert item["estado"] == "PENDIENTE_REVISION"
    assert item["venta_id"] is None

    # Verificar en BD que NO existe venta central
    venta_db = (
        await db_session.execute(select(Venta).where(Venta.idempotency_key == id_local))
    ).scalar_one_or_none()
    assert venta_db is None

    # Verificar que VentaOfflineRecibida existe con PENDIENTE_REVISION
    recibida = (
        await db_session.execute(
            select(VentaOfflineRecibida).where(VentaOfflineRecibida.id_local == id_local)
        )
    ).scalar_one()
    assert recibida.estado == "PENDIENTE_REVISION"

    # Verificar que IncidenciaSync fue creada asociada
    incidencia = (
        await db_session.execute(
            select(IncidenciaSync).where(IncidenciaSync.venta_offline_id == recibida.id)
        )
    ).scalar_one()
    assert incidencia.tipo == "STOCK_INSUFICIENTE"
    assert incidencia.resuelto is False
    assert "Stock insuficiente" in incidencia.detalle


@pytest.mark.asyncio
async def test_sync_venta_offline_sesion_invalida(
    async_client: AsyncClient,
    cajero_headers: dict,
    director_headers: dict,
    db_session: AsyncSession,
):
    """
    Prueba de validación de sesión de caja:
    - Sesión cerrada -> RECHAZADA.
    - Sesión perteneciente a otro usuario -> RECHAZADA.
    """
    # 1. Caso A: Sesión perteneciente a otro usuario (Director)
    sesion_dir_id = await obtener_o_abrir_sesion(async_client, director_headers, "TERM-DIR-01")

    id_local_otro = str(uuid.uuid4())
    sync_otro_payload = {
        "ventas": [
            {
                "id_local": id_local_otro,
                "terminal_id": "TERM-OFFLINE-04",
                "sesion_caja_id": sesion_dir_id,
                "fecha_local": datetime.datetime.utcnow().isoformat(),
                "items": [{"producto_id": PRODUCTO_ID, "cantidad": 1, "precio_unitario": 26.00}],
            }
        ]
    }
    res_otro = await async_client.post(
        "/api/v1/sync/ventas-offline", json=sync_otro_payload, headers=cajero_headers
    )
    assert res_otro.status_code == 200
    data_otro = res_otro.json()
    assert data_otro["detalles"][0]["estado"] == "RECHAZADA"
    assert "otro usuario" in data_otro["detalles"][0]["mensaje"]

    # 2. Caso B: Sesión cerrada del cajero
    sesion_caj_id = await obtener_o_abrir_sesion(async_client, cajero_headers, "TERM-CAJ-CLOSE")

    # Cerrar la sesión en la base de datos
    sesion_caj = await db_session.get(SesionCaja, uuid.UUID(sesion_caj_id))
    sesion_caj.estado = EstadoSesionCaja.CERRADA
    sesion_caj.fecha_cierre = datetime.datetime.now(datetime.timezone.utc)
    await db_session.commit()

    id_local_cerrada = str(uuid.uuid4())
    sync_cerrada_payload = {
        "ventas": [
            {
                "id_local": id_local_cerrada,
                "terminal_id": "TERM-CAJ-CLOSE",
                "sesion_caja_id": sesion_caj_id,
                "fecha_local": datetime.datetime.utcnow().isoformat(),
                "items": [{"producto_id": PRODUCTO_ID, "cantidad": 1, "precio_unitario": 26.00}],
            }
        ]
    }
    res_cerrada = await async_client.post(
        "/api/v1/sync/ventas-offline", json=sync_cerrada_payload, headers=cajero_headers
    )
    assert res_cerrada.status_code == 200
    data_cerrada = res_cerrada.json()
    assert data_cerrada["detalles"][0]["estado"] == "RECHAZADA"
    assert "no está abierta" in data_cerrada["detalles"][0]["mensaje"]


@pytest.mark.asyncio
async def test_sync_listar_y_resolver_conflictos(
    async_client: AsyncClient,
    cajero_headers: dict,
    supervisor_headers: dict,
    db_session: AsyncSession,
):
    """
    Prueba de supervisión y resolución de incidencias offline:
    - Cajero no tiene permisos para listar/resolver conflictos (HTTP 403).
    - Supervisor lista incidencias pendientes.
    - Supervisor resuelve una incidencia con nota y auditoría.
    """
    # 1. Crear una incidencia por falta de stock
    sesion_id = await obtener_o_abrir_sesion(async_client, cajero_headers, "TERM-CONF-01")

    id_local = str(uuid.uuid4())
    await async_client.post(
        "/api/v1/sync/ventas-offline",
        json={
            "ventas": [
                {
                    "id_local": id_local,
                    "terminal_id": "TERM-CONF-01",
                    "sesion_caja_id": sesion_id,
                    "fecha_local": datetime.datetime.utcnow().isoformat(),
                    "items": [{"producto_id": PRODUCTO_ID, "cantidad": 88888, "precio_unitario": 26.00}],
                }
            ]
        },
        headers=cajero_headers,
    )

    # 2. Cajero intenta listar conflictos -> 403 Forbidden
    res_cajero = await async_client.get("/api/v1/sync/conflictos", headers=cajero_headers)
    assert res_cajero.status_code == 403

    # 3. Supervisor lista conflictos -> 200 OK
    res_super = await async_client.get("/api/v1/sync/conflictos", headers=supervisor_headers)
    assert res_super.status_code == 200
    conflictos = res_super.json()
    assert len(conflictos) >= 1

    # Ubicar la incidencia creada
    incidencia_target = next((c for c in conflictos if c["id_local"] == id_local), None)
    assert incidencia_target is not None
    assert incidencia_target["resuelto"] is False
    assert incidencia_target["tipo"] == "STOCK_INSUFICIENTE"

    # 4. Supervisor resuelve el conflicto
    incidencia_id = incidencia_target["id"]
    res_resolver = await async_client.post(
        f"/api/v1/sync/conflictos/{incidencia_id}/resolver",
        json={"nota_resolucion": "Ajuste de inventario aplicado tras conteo físico en anaquel"},
        headers=supervisor_headers,
    )
    assert res_resolver.status_code == 200
    resuelto_data = res_resolver.json()
    assert resuelto_data["resuelto"] is True
    assert resuelto_data["nota_resolucion"] == "Ajuste de inventario aplicado tras conteo físico en anaquel"
    assert resuelto_data["resuelto_por"] is not None
    assert resuelto_data["resuelto_en"] is not None

    # 5. Comprobar que ya no figura en la lista de pendientes por defecto
    res_pendientes = await async_client.get("/api/v1/sync/conflictos", headers=supervisor_headers)
    assert res_pendientes.status_code == 200
    pendientes = res_pendientes.json()
    assert not any(p["id"] == incidencia_id for p in pendientes)
