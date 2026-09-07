import sys
import os
import asyncio
from datetime import datetime, timezone, timedelta
import uuid
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select

# Asegurar que backend esté en el sys.path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from app.models.base import Base
from app.models.usuarios import Usuario, RolUsuario, SesionCaja, AuditoriaEvento
from app.models.inventario import (
    Categoria, Producto, LoteInventario, Proveedor, OrdenCompra, 
    DetalleOrdenCompra, EstadoOrdenCompra, EstadoLote
)
from app.models.ventas import Cliente, Cupon, Venta, DetalleVenta, PagoVenta
from app.models.configuracion import Configuracion
from app.core.security import get_password_hash, create_access_token
from app.main import app
from app.db.oltp import get_db

# Base de datos aislada de pruebas (Artículo T-II)
TEST_DB_HOST = os.getenv("POSTGRES_SERVER", "127.0.0.1")
TEST_DB_PORT = os.getenv("POSTGRES_PORT", "5433" if TEST_DB_HOST in ["127.0.0.1", "localhost"] else "5432")
TEST_DB_USER = os.getenv("POSTGRES_USER", "quantix_user")
TEST_DB_PASSWORD = os.getenv("POSTGRES_PASSWORD", "quantix_password")
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    f"postgresql+asyncpg://{TEST_DB_USER}:{TEST_DB_PASSWORD}@{TEST_DB_HOST}:{TEST_DB_PORT}/quantix_test"
)

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(bind=test_engine, expire_on_commit=False)

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()

@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_test_database():
    """Inicializa el esquema completo en la base de datos de test y crea usuarios base"""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with TestSessionLocal() as db:
        # Sembrar usuarios de prueba para todos los roles
        usuarios = [
            Usuario(
                id=uuid.UUID("8ed89f03-d9f9-4fdd-94bd-7425a20f284b"),
                nombre="Director Test",
                email="admin@quantix.local",
                password_hash=get_password_hash("Admin123!"),
                rol=RolUsuario.DIRECTOR,
                activo=True
            ),
            Usuario(
                id=uuid.UUID("30df4c3b-d5f6-405a-99a5-457f3d8c800f"),
                nombre="Supervisor Test",
                email="supervisor@quantix.local",
                password_hash=get_password_hash("Super123!"),
                rol=RolUsuario.SUPERVISOR,
                activo=True
            ),
            Usuario(
                id=uuid.UUID("3cd8ea52-1642-49a0-bc03-9a956fce630d"),
                nombre="Cajero Test",
                email="cajero@quantix.local",
                password_hash=get_password_hash("Caja123!"),
                rol=RolUsuario.CAJERO,
                activo=True
            ),
            Usuario(
                id=uuid.UUID("eae5213f-40bb-4297-ab8c-e200711899ba"),
                nombre="Bodeguero Test",
                email="bodeguero@quantix.local",
                password_hash=get_password_hash("Bodega123!"),
                rol=RolUsuario.BODEGUERO,
                activo=True
            ),
        ]
        db.add_all(usuarios)

        # Sembrar productos y lotes de prueba para FEFO
        cat = Categoria(id=uuid.uuid4(), nombre="Lácteos", descripcion="Pruebas")
        db.add(cat)
        await db.flush()

        prod = Producto(
            id=uuid.UUID("c12c3433-1953-4980-80cb-06d6ab535e54"),
            categoria_id=cat.id,
            sku="LAL-ENT-1L",
            nombre="Leche Entera Lala 1L",
            codigo_barras="7501020515250",
            costo_base=18.50,
            precio_venta=26.00,
            margen_minimo_pct=15.0,
            requiere_pesaje=False,
            clasificacion_abc="A",
            activo=True
        )
        db.add(prod)
        await db.flush()

        # Dos lotes con fechas distintas para testear FEFO
        hoy = datetime.utcnow()
        lote_proximo = LoteInventario(
            id=uuid.uuid4(),
            producto_id=prod.id,
            codigo_lote="LOTE-EXPIRA-PRONTO",
            cantidad_inicial=10,
            cantidad_disponible=10,
            costo_unitario=18.50,
            fecha_ingreso=hoy,
            fecha_vencimiento=hoy.date() + timedelta(days=5), # Vence en 5 días
            estado=EstadoLote.ACTIVO
        )
        lote_lejano = LoteInventario(
            id=uuid.uuid4(),
            producto_id=prod.id,
            codigo_lote="LOTE-EXPIRA-LEJOS",
            cantidad_inicial=20,
            cantidad_disponible=20,
            costo_unitario=18.50,
            fecha_ingreso=hoy,
            fecha_vencimiento=hoy.date() + timedelta(days=30), # Vence en 30 días
            estado=EstadoLote.ACTIVO
        )
        db.add_all([lote_proximo, lote_lejano])

        # Parámetros globales por defecto
        configs = [
            Configuracion(clave="etl_intervalo_minutos", valor="5", tipo_dato="INTEGER"),
            Configuracion(clave="caja_tolerancia_descuadre", valor="5.00", tipo_dato="DECIMAL"),
            Configuracion(clave="fefo_alerta_dias_1", valor="15", tipo_dato="INTEGER"),
            Configuracion(clave="fefo_alerta_dias_2", valor="30", tipo_dato="INTEGER"),
            Configuracion(clave="smtp_host", valor="smtp.gmail.com", tipo_dato="STRING"),
            Configuracion(clave="smtp_port", valor="587", tipo_dato="INTEGER"),
            Configuracion(clave="smtp_user", valor="alertas@quantix.local", tipo_dato="STRING"),
        ]
        db.add_all(configs)

        await db.commit()

    yield

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest_asyncio.fixture
async def db_session():
    """Fixture de sesión con rollback automático al finalizar cada test"""
    async with TestSessionLocal() as session:
        yield session
        await session.rollback()

@pytest_asyncio.fixture
async def async_client(db_session: AsyncSession):
    """Cliente HTTP asíncrono inyectando la sesión de base de datos de test"""
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()

@pytest.fixture
def director_token():
    return create_access_token(subject="8ed89f03-d9f9-4fdd-94bd-7425a20f284b", rol="DIRECTOR")

@pytest.fixture
def supervisor_token():
    return create_access_token(subject="30df4c3b-d5f6-405a-99a5-457f3d8c800f", rol="SUPERVISOR")

@pytest.fixture
def cajero_token():
    return create_access_token(subject="3cd8ea52-1642-49a0-bc03-9a956fce630d", rol="CAJERO")

@pytest.fixture
def bodeguero_token():
    return create_access_token(subject="eae5213f-40bb-4297-ab8c-e200711899ba", rol="BODEGUERO")

@pytest.fixture
def director_headers(director_token):
    return {"Authorization": f"Bearer {director_token}"}

@pytest.fixture
def supervisor_headers(supervisor_token):
    return {"Authorization": f"Bearer {supervisor_token}"}

@pytest.fixture
def cajero_headers(cajero_token):
    return {"Authorization": f"Bearer {cajero_token}"}

@pytest.fixture
def bodeguero_headers(bodeguero_token):
    return {"Authorization": f"Bearer {bodeguero_token}"}
