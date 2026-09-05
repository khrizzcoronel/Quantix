# Modelo de Datos: 009 - Pipeline ETL Medallion

**Módulo:** 009-etl-medallion  
**Ámbito:** Esquemas `bronze`, `silver`, `gold` y `control` dentro de `quantix_analytics.duckdb`

---

## 1. Esquema `control` — Registro de Ejecuciones ETL

```sql
CREATE SCHEMA IF NOT EXISTS control;

CREATE TABLE IF NOT EXISTS control.etl_control_log (
    id                 VARCHAR PRIMARY KEY,    -- UUID como string en DuckDB
    -- Identificación del paso
    pipeline_name      TEXT NOT NULL,          -- ej: 'bronze_ventas', 'gold_fact_ventas'
    capa               TEXT NOT NULL,          -- 'BRONZE' | 'SILVER' | 'GOLD'
    tabla_destino      TEXT NOT NULL,          -- 'bronze.ventas'
    tabla_origen       TEXT,                   -- 'public.ventas' o 'bronze.ventas'
    -- Temporalidad
    inicio             TIMESTAMPTZ NOT NULL,
    fin                TIMESTAMPTZ,
    duracion_segundos  DOUBLE,
    -- Resultado
    estado             TEXT NOT NULL,          -- 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PARTIAL'
    filas_leidas       BIGINT DEFAULT 0,
    filas_insertadas   BIGINT DEFAULT 0,
    filas_rechazadas   BIGINT DEFAULT 0,
    -- Trazabilidad incremental
    watermark_inicio   TIMESTAMPTZ,
    watermark_fin      TIMESTAMPTZ,
    batch_id           VARCHAR,
    -- Error
    error_tipo         TEXT,
    error_mensaje      TEXT,
    stack_trace        TEXT
);
```

---

## 2. Esquema `bronze` — Tablas de Extracción Cruda

Cada tabla Bronze = espejo exacto del OLTP + 3 metadatos de extracción:

```sql
CREATE SCHEMA IF NOT EXISTS bronze;

CREATE TABLE IF NOT EXISTS bronze.ventas (
    -- Columnas idénticas a public.ventas
    id                    VARCHAR,
    folio_ticket          TEXT,
    sesion_caja_id        VARCHAR,
    cliente_id            VARCHAR,
    fecha_hora            TIMESTAMPTZ,
    subtotal              DECIMAL(10,2),
    total_descuento       DECIMAL(10,2),
    total_impuestos       DECIMAL(10,2),
    total_pagar           DECIMAL(10,2),
    costo_total_venta     DECIMAL(10,2),
    margen_total_ganancia DECIMAL(10,2),
    estado                TEXT,
    origen_offline        BOOLEAN,
    -- Metadatos ETL
    _extraction_ts        TIMESTAMPTZ NOT NULL,
    _source               TEXT NOT NULL,
    _batch_id             VARCHAR NOT NULL
);

-- (Misma estructura para todas las demás tablas: detalle_ventas, lotes_inventario,
--  clientes, sesiones_caja, arqueos_caja, auditoria_eventos, proveedores,
--  ordenes_compra, detalle_ordenes_compra, cupones, usuarios, pagos_venta, configuracion)
```

---

## 3. Esquema `silver` — Tablas Validadas y Limpias

```sql
CREATE SCHEMA IF NOT EXISTS silver;

-- Tabla de rechazos (compartida por todas las validaciones Silver)
CREATE TABLE IF NOT EXISTS silver.rejection_log (
    id            VARCHAR PRIMARY KEY,
    tabla_origen  TEXT NOT NULL,
    batch_id      VARCHAR NOT NULL,
    record_id     TEXT NOT NULL,
    motivo        TEXT NOT NULL,
    campo_fallido TEXT,
    valor_fallido TEXT,
    registrado_en TIMESTAMPTZ DEFAULT now()
);

-- Silver ventas: añade campo calculado
CREATE TABLE IF NOT EXISTS silver.ventas AS
SELECT * FROM bronze.ventas WHERE 1=0;  -- misma estructura

-- Silver detalle_ventas: añade margen calculado validado
CREATE TABLE IF NOT EXISTS silver.detalle_ventas (
    -- ...todos los campos de bronze.detalle_ventas...
    margen_pct_calculado DECIMAL(8,4)  -- campo adicional Silver
);
```

---

## 4. Esquema `gold` — Modelo Dimensional Kimball

Las tablas Gold son idénticas a las definidas en [diseno_arquitectura_datos.md](file:///c:/Users/kacor/OneDrive/Desktop/Quantix/docs/arquitectura/diseno_arquitectura_datos.md), sección 3. Aquí se registran únicamente las particularidades de implementación DuckDB:

```sql
CREATE SCHEMA IF NOT EXISTS gold;

-- DIM_TIEMPO: generada una sola vez para el rango 2020-2035
CREATE TABLE IF NOT EXISTS gold.dim_tiempo AS
SELECT
    CAST(strftime(date_trunc('day', d)::DATE, '%Y%m%d') AS BIGINT) AS tiempo_key,
    date_trunc('day', d)::DATE AS fecha,
    year(d) AS anio,
    month(d) AS mes,
    strftime(d, '%B') AS nombre_mes,
    weekofyear(d) AS semana_anio,
    dayofweek(d) AS dia_semana,
    dayofweek(d) IN (0, 6) AS es_fin_de_semana,
    FALSE AS es_festivo,
    'REGULAR' AS temporada
FROM generate_series(
    DATE '2020-01-01', DATE '2035-12-31', INTERVAL '1 day'
) t(d);

-- DIM_PRODUCTO con SCD Tipo 2
CREATE TABLE IF NOT EXISTS gold.dim_producto (
    producto_key          BIGINT PRIMARY KEY,
    producto_id_oltp      VARCHAR,
    sku                   TEXT,
    nombre                TEXT,
    categoria             TEXT,
    tipo_estrategico      TEXT,
    margen_objetivo_pct   DECIMAL(6,2),
    fecha_inicio_vigencia DATE NOT NULL,
    fecha_fin_vigencia    DATE,
    es_actual             BOOLEAN DEFAULT TRUE
);
```
