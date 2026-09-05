# Plan de Implementación Técnica: 009 - Pipeline ETL Medallion

**Módulo:** 009-etl-medallion  

---

## 1. Estructura de Archivos del Pipeline

```
backend/
└── app/
    └── etl/
        ├── __init__.py
        ├── connection.py         # Conexión a DuckDB y a postgres_scanner
        ├── control_log.py        # CRUD sobre control.etl_control_log
        ├── scheduler.py          # Configuración de APScheduler (micro_batch + nightly)
        ├── bronze/
        │   ├── __init__.py
        │   ├── schema_init.py    # CREATE SCHEMA IF NOT EXISTS bronze; CREATE TABLE IF NOT EXISTS...
        │   ├── extract_ventas.py
        │   ├── extract_inventario.py
        │   ├── extract_caja.py
        │   ├── extract_clientes.py
        │   └── extract_catalogos.py   # productos, proveedores, usuarios, config (full reload)
        ├── silver/
        │   ├── __init__.py
        │   ├── schema_init.py
        │   ├── rejection_log.py   # Inserción en silver.rejection_log
        │   ├── validate_ventas.py
        │   ├── validate_inventario.py
        │   └── validate_caja.py
        └── gold/
            ├── __init__.py
            ├── schema_init.py
            ├── dim_tiempo.py      # Generación única del calendario
            ├── dim_producto_scd2.py
            ├── fact_ventas.py
            ├── fact_tickets.py
            ├── fact_inventario_diario.py
            ├── fact_arqueos_merma.py
            ├── fact_compras.py
            ├── fact_cliente_rfm.py
            └── fact_devoluciones.py
```

---

## 2. Componente Central: `control_log.py`

```python
# backend/app/etl/control_log.py
from uuid import uuid4
from datetime import datetime, timezone
import duckdb

def start_run(conn: duckdb.DuckDBPyConnection, pipeline_name: str,
              capa: str, tabla_destino: str, tabla_origen: str,
              watermark_inicio: datetime, batch_id=None) -> str:
    """Inserta una fila con estado RUNNING y retorna el ID del registro."""
    run_id = str(uuid4())
    batch_id = batch_id or str(uuid4())
    conn.execute("""
        INSERT INTO control.etl_control_log
            (id, pipeline_name, capa, tabla_destino, tabla_origen,
             inicio, estado, watermark_inicio, batch_id)
        VALUES (?, ?, ?, ?, ?, ?, 'RUNNING', ?, ?)
    """, [run_id, pipeline_name, capa, tabla_destino, tabla_origen,
          datetime.now(timezone.utc), watermark_inicio, batch_id])
    return run_id

def finish_run(conn, run_id: str, filas_leidas: int,
               filas_insertadas: int, filas_rechazadas: int,
               watermark_fin: datetime):
    fin = datetime.now(timezone.utc)
    conn.execute("""
        UPDATE control.etl_control_log
        SET fin = ?, duracion_segundos = EPOCH(? - inicio),
            estado = 'SUCCESS', filas_leidas = ?,
            filas_insertadas = ?, filas_rechazadas = ?,
            watermark_fin = ?
        WHERE id = ?
    """, [fin, fin, filas_leidas, filas_insertadas, filas_rechazadas,
          watermark_fin, run_id])

def fail_run(conn, run_id: str, error_tipo: str,
             error_mensaje: str, stack_trace: str = None):
    conn.execute("""
        UPDATE control.etl_control_log
        SET fin = NOW(), duracion_segundos = EPOCH(NOW() - inicio),
            estado = 'FAILED', error_tipo = ?,
            error_mensaje = ?, stack_trace = ?
        WHERE id = ?
    """, [error_tipo, error_mensaje, stack_trace, run_id])
```

---

## 3. Jobs de APScheduler

```python
# backend/app/etl/scheduler.py
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler(timezone="America/Guayaquil")

# Micro-batch: ventas, caja, pagos — cada 5 minutos en horario comercial
@scheduler.scheduled_job('cron', minute='*/5', hour='6-23', id='etl_micro_batch')
async def micro_batch():
    async with get_duckdb_conn() as conn:
        await run_bronze_ventas(conn)
        await run_bronze_caja(conn)
        await run_silver_ventas(conn)
        await run_gold_fact_ventas(conn)
        await run_gold_fact_tickets(conn)
        await run_gold_fact_arqueos(conn)

# Nightly: inventario completo, RFM, SCD Tipo 2 — a las 2:00 AM
@scheduler.scheduled_job('cron', hour=2, minute=0, id='etl_nightly_batch')
async def nightly_batch():
    async with get_duckdb_conn() as conn:
        await run_bronze_catalogos(conn)        # full reload
        await run_bronze_inventario(conn)
        await run_silver_inventario(conn)
        await run_silver_clientes(conn)
        await run_gold_dim_producto_scd2(conn)  # cierra/abre versiones
        await run_gold_fact_inventario_diario(conn)
        await run_gold_fact_cliente_rfm(conn)
        await run_gold_fact_compras(conn)
```

---

## 4. Endopint de Monitoreo del Pipeline

El backend expone un endpoint de solo lectura para consultar el estado del pipeline desde el backoffice administrativo:

```
GET /api/v1/admin/etl/estado
```
Responde con las últimas 50 ejecuciones de `control.etl_control_log`, ordenadas por inicio DESC, para que los supervisores vean cuándo fue la última actualización exitosa de los dashboards.
