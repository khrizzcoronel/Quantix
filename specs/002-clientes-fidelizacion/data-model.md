# Modelo de Datos: 002 - Clientes, Segmentación RFM y Fidelización

**Módulo:** 002-clientes-fidelizacion  
**Esquema:** Relacional OLTP (PostgreSQL) + Analítico OLAP (DuckDB)

---

## 1. DDL Relacional (OLTP — PostgreSQL)

```sql
-- Tabla de Clientes
CREATE TABLE clientes (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telefono                VARCHAR(20)  NOT NULL UNIQUE,
    nombre                  VARCHAR(150) NOT NULL,
    email                   VARCHAR(254),
    fecha_nacimiento        DATE,
    opt_in_marketing        BOOLEAN NOT NULL DEFAULT FALSE,
    ciclo_intercompra_dias  NUMERIC(8, 2),          -- Recalculado en cada compra del cliente
    dias_sin_comprar        INTEGER,                 -- Actualizado por ETL nocturno
    ultima_compra_fecha     TIMESTAMP WITH TIME ZONE,
    segmento_rfm            VARCHAR(20),             -- CAMPEON, LEAL, EN_RIESGO, DORMIDO
    ltv_estimado            NUMERIC(12, 2),
    creado_en               TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_clientes_telefono   ON clientes(telefono);
CREATE INDEX idx_clientes_segmento   ON clientes(segmento_rfm);
CREATE INDEX idx_clientes_nacimiento ON clientes(fecha_nacimiento);

-- Tipos ENUM para cupones
CREATE TYPE tipo_cupon_enum     AS ENUM ('CUMPLEANOS', 'REACTIVACION', 'COMBO', 'MANUAL');
CREATE TYPE descuento_tipo_enum AS ENUM ('PORCENTAJE', 'MONTO_FIJO');
CREATE TYPE estado_cupon_enum   AS ENUM ('ACTIVO', 'CANJEADO', 'EXPIRADO', 'ANULADO');

-- Tabla de Cupones
CREATE TABLE cupones (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo              VARCHAR(30) NOT NULL UNIQUE,
    cliente_id          UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    tipo_cupon          tipo_cupon_enum     NOT NULL,
    descuento_tipo      descuento_tipo_enum NOT NULL,
    descuento_valor     NUMERIC(10, 2) NOT NULL CHECK (descuento_valor > 0),
    valido_desde        DATE NOT NULL,
    valido_hasta        DATE NOT NULL,
    estado              estado_cupon_enum NOT NULL DEFAULT 'ACTIVO',
    venta_canje_id      UUID REFERENCES ventas(id) ON DELETE SET NULL,  -- NULL mientras no se canje
    generado_en         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_cupon_vigencia CHECK (valido_hasta >= valido_desde)
);

CREATE INDEX idx_cupones_codigo   ON cupones(codigo);
CREATE INDEX idx_cupones_cliente  ON cupones(cliente_id);
CREATE INDEX idx_cupones_vigencia ON cupones(valido_desde, valido_hasta);
```

---

## 2. DDL Analítico (OLAP — DuckDB)

### DIM_CLIENTE

```sql
CREATE TABLE DIM_CLIENTE (
    cliente_sk          INTEGER PRIMARY KEY,        -- Surrogate key OLAP
    cliente_id          UUID NOT NULL UNIQUE,       -- FK hacia OLTP
    telefono            VARCHAR(20)  NOT NULL,
    nombre              VARCHAR(150) NOT NULL,
    email               VARCHAR(254),
    fecha_nacimiento    DATE,
    opt_in_marketing    BOOLEAN,
    segmento_rfm        VARCHAR(20),
    ltv_estimado        NUMERIC(12, 2),
    fecha_carga         TIMESTAMP DEFAULT current_timestamp
);
```

### FACT_CLIENTE_RFM_PERIODO

```sql
CREATE TABLE FACT_CLIENTE_RFM_PERIODO (
    id                      INTEGER PRIMARY KEY,
    cliente_sk              INTEGER NOT NULL REFERENCES DIM_CLIENTE(cliente_sk),
    periodo_inicio          DATE NOT NULL,
    periodo_fin             DATE NOT NULL,
    recency_dias            INTEGER       NOT NULL,  -- Días desde última compra al cierre del periodo
    frequency_compras       INTEGER       NOT NULL,  -- Número de compras en el periodo
    monetary_total          NUMERIC(12, 2) NOT NULL, -- Gasto total en el periodo
    ciclo_intercompra_dias  NUMERIC(8, 2),
    segmento_rfm            VARCHAR(20)   NOT NULL,  -- CAMPEON, LEAL, EN_RIESGO, DORMIDO
    ltv_estimado            NUMERIC(12, 2),
    fecha_calculo           TIMESTAMP DEFAULT current_timestamp
);
```
