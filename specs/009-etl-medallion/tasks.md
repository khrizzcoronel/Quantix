# Tareas de Implementación: 009 - Pipeline ETL Medallion

**Módulo:** 009-etl-medallion  

> [!IMPORTANT]
> **Cada tarea de este módulo requiere sus tests correspondientes en `tests/unit/etl/` o `tests/integration/etl/` antes de marcarse como `[x]`.**

---

## Bloque 1: Infraestructura Base del Pipeline

- [ ] **TASK-009-01:** Inicializar archivo DuckDB `quantix_analytics.duckdb` y crear los 4 esquemas (`bronze`, `silver`, `gold`, `control`).
- [ ] **TASK-009-02:** Implementar `backend/app/etl/connection.py` — gestión de la conexión DuckDB con context manager thread-safe y carga de la extensión `postgres_scanner`.
- [ ] **TASK-009-03:** Implementar `backend/app/etl/control_log.py` — funciones `start_run`, `finish_run`, `fail_run` sobre `control.etl_control_log`.
  - Test: `tests/unit/etl/test_control_log.py` → valida que `start_run` crea fila RUNNING, `finish_run` la actualiza a SUCCESS, `fail_run` la actualiza a FAILED.

## Bloque 2: Capa Bronze — Extracción Cruda Incremental

- [ ] **TASK-009-04:** Implementar `bronze/schema_init.py` — CREATE TABLE IF NOT EXISTS para las 15 tablas Bronze.
- [ ] **TASK-009-05:** Implementar `bronze/extract_ventas.py` — extracción incremental de `ventas` y `detalle_ventas` usando watermark.
  - Test: `tests/unit/etl/test_bronze_extractor.py` → valida idempotencia (dos ejecuciones = mismas filas), y que el watermark avanza correctamente.
- [ ] **TASK-009-06:** Implementar `bronze/extract_inventario.py` — extracción de `lotes_inventario`.
- [ ] **TASK-009-07:** Implementar `bronze/extract_caja.py` — extracción de `sesiones_caja`, `arqueos_caja`, `auditoria_eventos`.
- [ ] **TASK-009-08:** Implementar `bronze/extract_clientes.py` — extracción de `cliente` y `cupon`.
- [ ] **TASK-009-09:** Implementar `bronze/extract_catalogos.py` — recarga completa (TRUNCATE + INSERT) de `productos`, `proveedores`, `usuario`, `configuracion`.

## Bloque 3: Capa Silver — Validación y Limpieza

- [ ] **TASK-009-10:** Implementar `silver/schema_init.py` + `silver/rejection_log.py`.
- [ ] **TASK-009-11:** Implementar `silver/validate_ventas.py` — validar y transformar ventas y detalle_ventas.
  - Test: `tests/unit/etl/test_silver_validator.py` → valida que registros con `total_pagar < 0` van a `rejection_log` y no a Silver.
- [ ] **TASK-009-12:** Implementar `silver/validate_inventario.py` — validar lotes con `fecha_vencimiento IS NOT NULL`.
- [ ] **TASK-009-13:** Implementar `silver/validate_caja.py` — validar arqueos con `efectivo_contado >= 0`.

## Bloque 4: Capa Gold — Modelo Dimensional

- [ ] **TASK-009-14:** Implementar `gold/schema_init.py` + generar `dim_tiempo` (2020-2035).
- [ ] **TASK-009-15:** Implementar `gold/dim_producto_scd2.py` — lógica de SCD Tipo 2 para cambios de precio y clasificación.
  - Test: `tests/unit/etl/test_scd2_producto.py` → valida que al cambiar `tipo_estrategico`, se cierra el registro anterior y se abre uno nuevo.
- [ ] **TASK-009-16:** Implementar `gold/fact_ventas.py` + `gold/fact_tickets.py` — carga desde Silver.
  - Test: `tests/integration/etl/test_pipeline_micro_batch.py` → ejecuta pipeline completo Bronze→Silver→Gold y valida conteo de filas en Gold.
- [ ] **TASK-009-17:** Implementar `gold/fact_inventario_diario.py` + `gold/fact_arqueos_merma.py`.
- [ ] **TASK-009-18:** Implementar `gold/fact_cliente_rfm.py` — snapshot mensual de scores RFM y LTV.
- [ ] **TASK-009-19:** Implementar `gold/fact_compras.py` + `gold/fact_devoluciones.py`.

## Bloque 5: Orquestación y Monitoreo

- [ ] **TASK-009-20:** Implementar `etl/scheduler.py` — configurar `etl_micro_batch` (*/5 min, 6-23h) y `etl_nightly_batch` (02:00 AM) con APScheduler.
- [ ] **TASK-009-21:** Endpoint `GET /api/v1/admin/etl/estado` — devuelve últimas 50 filas de `control.etl_control_log` ordenadas por `inicio DESC`.
- [ ] **TASK-009-22:** UI: widget de estado del ETL en el backoffice (última ejecución, estado, filas procesadas).
