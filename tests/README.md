# Tests del Proyecto Quantix

Este directorio contiene todas las pruebas automatizadas del sistema.

> [!IMPORTANT]
> **Las pruebas son obligatorias.** Ninguna tarea en `specs/*/tasks.md` puede marcarse como `[x]` sin que sus tests correspondientes estén aquí, pasen y sean parte del mismo commit.

---

## Estructura del Directorio

```
tests/
├── unit/
│   ├── backend/           # Tests de servicios, algoritmos y lógica de dominio
│   └── etl/               # Tests de pipelines Bronze/Silver/Gold en aislamiento
├── integration/
│   ├── api/               # Tests de endpoints HTTP completos (con DB de prueba)
│   └── etl/               # Tests del pipeline ETL contra DuckDB de test
├── e2e/                   # Flujos completos de usuario (Playwright)
├── conftest.py            # Fixtures globales: sesión de BD, cliente HTTP
└── README.md              # Este archivo
```

---

## Documentación de Referencia

* **Normas completas de testing:** [docs/arquitectura/estandar_testing.md](../docs/arquitectura/estandar_testing.md)
* **Convención de nombres de tests:** `test_<que>__<condicion>__<resultado_esperado>`
* **Regla de datos:** Los tests nunca dejan datos en ninguna BD. Ver [Política de Datos Reales](../docs/arquitectura/etl_medallion_architecture.md#6-política-de-datos-reales).

---

## Cómo Ejecutar

```bash
# Requisito: tener la BD de prueba levantada
docker compose up -d db

# Ejecutar todos los tests con cobertura
.\backend\venv\Scripts\python.exe -m pytest tests backend\tests --cov=backend/app --cov-report=term-missing -v

# Solo unitarios (sin BD, rapidísimos)
pytest tests/unit/ -v

# Solo integración
pytest tests/integration/ -v
```
