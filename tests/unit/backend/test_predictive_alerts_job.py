import uuid
from datetime import datetime, timezone, timedelta, date
from decimal import Decimal
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.etl.scheduler import job_alertas_predictivas
from app.models.ventas import Cliente, Cupon, TipoCupon, EstadoCupon
from app.models.inventario import Producto, LoteInventario, EstadoLote
from app.models.usuarios import SesionCaja, ArqueoCaja, EstadoSesionCaja, Usuario, RolUsuario


@pytest.mark.asyncio
async def test_job_alertas_predictivas_basic_execution(db_session: AsyncSession):
    """
    Verifica que el job de alertas predictivas se ejecute sin excepciones
    de datetimes (naive vs aware) y retorne el estado EXITOSO.
    """
    res = await job_alertas_predictivas()
    assert res is not None
    assert res["status"] == "EXITOSO"
    assert res["error"] is None
    assert "timestamp" in res
    assert isinstance(res["sobrestock_detectados"], int)
    assert isinstance(res["cupones_reactivacion_emitidos"], int)
    assert isinstance(res["descuadres_repetidos_detectados"], int)


@pytest.mark.asyncio
async def test_job_alertas_predictivas_inactive_client_coupon(db_session: AsyncSession):
    """
    Verifica que un cliente sin compras por más de 45 días reciba
    un cupón de REACTIVACION automáticamente sin duplicidades.
    """
    # 1. Crear cliente inactivo con fecha_registro naive en el pasado
    hace_50_dias = datetime.utcnow() - timedelta(days=50)
    cliente_id = uuid.uuid4()
    tel_random = f"55{uuid.uuid4().hex[:8]}"
    cliente = Cliente(
        id=cliente_id,
        nombre="Cliente Inactivo Test",
        telefono=tel_random,
        email="inactivo@test.com",
        fecha_registro=hace_50_dias,
        puntos_acumulados=0,
        activo=True
    )
    db_session.add(cliente)
    await db_session.commit()

    # 2. Ejecutar job
    res1 = await job_alertas_predictivas()
    assert res1["status"] == "EXITOSO"
    assert res1["cupones_reactivacion_emitidos"] >= 1

    # 3. Comprobar en BD que se emitió el cupón
    stmt = select(Cupon).where(
        Cupon.cliente_id == cliente_id,
        Cupon.tipo == TipoCupon.REACTIVACION,
        Cupon.estado == EstadoCupon.EMITIDO
    )
    res_cupon = await db_session.execute(stmt)
    cupones = res_cupon.scalars().all()
    assert len(cupones) == 1
    assert cupones[0].descuento_valor == Decimal("15.00")
    assert cupones[0].valido_hasta >= date.today()

    # 4. Re-ejecutar job y verificar que no genera cupón duplicado
    res2 = await job_alertas_predictivas()
    assert res2["status"] == "EXITOSO"
    res_cupon2 = await db_session.execute(stmt)
    cupones2 = res_cupon2.scalars().all()
    assert len(cupones2) == 1
