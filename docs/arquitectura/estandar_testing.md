# Estándar de Testing: Normas y Estructura de Pruebas

**Proyecto:** Quantix  
**Ámbito:** Backend (Python/pytest) y Frontend (TypeScript/Vitest)  
**Principio Rector:** Toda integración de código debe estar respaldada por pruebas automatizadas que queden persistidas en el repositorio. No existe tarea completada sin tests que la validen.

---

## 1. Pirámide de Testing de Quantix

```
                    ┌─────────────┐
                    │   E2E Tests  │  ← Flujos completos de usuario (Playwright)
                    │  (pocos, lentos)│
                   └───────────────┘
                  ┌─────────────────┐
                  │ Integration Tests│  ← API routes + DB real (test DB)
                  │ (moderados)      │
                 └───────────────────┘
                ┌─────────────────────┐
                │    Unit Tests        │  ← Funciones, servicios, algoritmos en aislamiento
                │  (muchos, rápidos)   │
               └─────────────────────────┘
```

---

## 2. Normas Obligatorias de Testing

### Artículo T-I: Tests Obligatorios por Integración
Todo Pull Request o tarea completada en `tasks.md` que modifique o introduzca código de producción **debe incluir en el mismo commit** los tests correspondientes. El checklist de revisión de cada spec exigirá:
- [ ] Tests unitarios para cada función/servicio nuevo.
- [ ] Tests de integración para cada endpoint nuevo o modificado.
- [ ] Tests de ETL para cada pipeline nuevo o modificado.
- [ ] Cobertura mínima del módulo: **80%** de líneas.

### Artículo T-II: Datos en Tests (Regla de Oro)
1. Los tests **NUNCA** leen ni escriben en la base de datos de producción.
2. Los tests de integración usan una base de datos PostgreSQL de prueba separada (`quantix_test`).
3. Cada test de integración se ejecuta dentro de una transacción que se revierte automáticamente al finalizar (`@pytest.fixture` con `rollback`). No quedan datos residuales.
4. Los datos de prueba se definen como **fixtures** (`conftest.py`) — objetos de dominio Pydantic construidos en memoria, nunca strings mágicos dispersos en el código de test.
5. **Prohibido crear datos ficticios persistentes** en ninguna base de datos. Ver [Política de Datos Reales](etl_medallion_architecture.md#6-política-de-datos-reales).

### Artículo T-III: Nomenclatura y Ubicación de Tests
```
tests/
├── unit/
│   ├── backend/
│   │   ├── test_fefo_algorithm.py      # un archivo por dominio/módulo
│   │   ├── test_rfm_calculator.py
│   │   ├── test_cupon_validator.py
│   │   └── test_arqueo_discrepancia.py
│   └── etl/
│       ├── test_bronze_extractor.py
│       ├── test_silver_validator.py
│       └── test_gold_transformer.py
├── integration/
│   ├── api/
│   │   ├── test_api_pos_checkout.py         # módulo 001
│   │   ├── test_api_clientes.py             # módulo 002
│   │   ├── test_api_precios.py              # módulo 003
│   │   ├── test_api_inventario.py           # módulo 004
│   │   ├── test_api_promociones.py          # módulo 005
│   │   ├── test_api_caja.py                 # módulo 006
│   │   ├── test_api_pagos.py                # módulo 007
│   │   └── test_api_sync_offline.py         # módulo 008
│   └── etl/
│       ├── test_pipeline_micro_batch.py
│       └── test_pipeline_nightly.py
├── e2e/
│   └── test_flujo_venta_completa.py
├── conftest.py            # fixtures globales, configuración de DB de test
└── README.md              # este documento
```

### Artículo T-IV: Convención de Nombres de Funciones de Test
El nombre de cada función de test debe comunicar: **qué** se prueba, **bajo qué condición** y **qué se espera**:
```
test_<que_se_prueba>__<condicion>__<resultado_esperado>
```
**Ejemplos correctos:**
```python
def test_fefo_algorithm__multiple_lots__returns_nearest_expiry_first():
def test_checkout__insufficient_stock__raises_409_conflict():
def test_rfm_score__champion_customer__returns_score_5_5_5():
def test_blind_audit__cashier_submits_count__difference_computed_server_side():
def test_cupon__already_redeemed__raises_400_invalid():
```

### Artículo T-V: Tests de ETL
Cada pipeline ETL (bronze, silver, gold) debe tener tests que validen:
1. **Idempotencia:** Ejecutar el pipeline dos veces con los mismos datos produce el mismo resultado (sin duplicados).
2. **Incrementalidad:** Solo se procesan registros nuevos desde la última marca de agua.
3. **Registro de control:** Cada ejecución genera exactamente una fila en `control.etl_control_log` con el estado correcto.
4. **Rechazo de datos inválidos:** Registros que no pasan validación Silver van a `silver.rejection_log`, no bloquean el pipeline.

---

## 3. Estructura de Configuración de Tests (Backend)

### `tests/conftest.py` — Configuración Global
```python
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from httpx import AsyncClient
from app.main import app
from app.database import Base

TEST_DB_URL = "postgresql+asyncpg://quantix:quantix@localhost/quantix_test"

@pytest.fixture(scope="session")
def event_loop():
    """Reutilizar el event loop de asyncio en toda la sesión."""
    import asyncio
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()

@pytest_asyncio.fixture(scope="function")
async def db_session():
    """
    Fixture que provee una sesión de BD en una transacción que siempre hace ROLLBACK.
    Garantía: ningún test deja datos en la BD de prueba.
    """
    engine = create_async_engine(TEST_DB_URL)
    async with engine.connect() as conn:
        await conn.begin()
        session = AsyncSession(bind=conn)
        yield session
        await session.close()
        await conn.rollback()
    await engine.dispose()

@pytest_asyncio.fixture(scope="function")
async def api_client(db_session):
    """Cliente HTTP asíncrono configurado contra la app con la sesión de test inyectada."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client
```

### `tests/unit/backend/conftest.py` — Fixtures de Dominio
```python
import pytest
from decimal import Decimal
from uuid import uuid4
from app.schemas.producto import ProductoSchema
from app.schemas.lote import LoteInventarioSchema

@pytest.fixture
def producto_perecedero():
    return ProductoSchema(
        id=uuid4(),
        nombre="Yogur Natural 200g",
        codigo_barras="7891000100103",
        precio_venta=Decimal("1.50"),
        tipo_estrategico="REGULAR"
    )

@pytest.fixture
def lotes_fefo_ordenados(producto_perecedero):
    """Tres lotes del mismo producto con fechas de vencimiento distintas."""
    from datetime import date
    return [
        LoteInventarioSchema(producto_id=producto_perecedero.id,
                             fecha_vencimiento=date(2026, 9, 10), cantidad_disponible=5),
        LoteInventarioSchema(producto_id=producto_perecedero.id,
                             fecha_vencimiento=date(2026, 9, 20), cantidad_disponible=10),
        LoteInventarioSchema(producto_id=producto_perecedero.id,
                             fecha_vencimiento=date(2026, 10, 5), cantidad_disponible=3),
    ]
```

---

## 4. Comandos para Ejecutar los Tests

```bash
# Todos los tests con cobertura
pytest tests/ --cov=app --cov-report=html --cov-report=term-missing -v

# Solo tests unitarios (rápidos, sin DB)
pytest tests/unit/ -v

# Solo tests de integración (requiere quantix_test DB levantada)
pytest tests/integration/ -v

# Solo tests ETL
pytest tests/unit/etl/ tests/integration/etl/ -v

# Tests de un módulo específico
pytest tests/integration/api/test_api_pos_checkout.py -v

# Ver cobertura en browser
open htmlcov/index.html
```

---

## 5. Integración Continua: Gate de Calidad

Antes de marcar cualquier tarea en `tasks.md` como completada `[x]`, debe verificarse:

```
✅ pytest tests/unit/ → todos verdes (0 failures, 0 errors)
✅ pytest tests/integration/ → todos verdes
✅ coverage report → ≥ 80% en el módulo modificado
✅ git status → no existen archivos .db de prueba ni datos ficticios sin limpiar
```
