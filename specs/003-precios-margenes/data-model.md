# Modelo de Datos: 003 - Precios y Márgenes

**Módulo:** 003-precios-margenes  
**Esquema:** Relacional OLTP (PostgreSQL) + Analítico OLAP (DuckDB)

---

## 1. DDL Relacional (OLTP — PostgreSQL)

### Campos clave en `productos`
Los siguientes campos de la tabla `productos` (definida en el módulo 001) son los puntos de extensión de este módulo:

```sql
-- Campos relevantes de 003 en la tabla productos (ya declarados en 001):
--   tipo_estrategico   tipo_estrategico_enum  NOT NULL DEFAULT 'REGULAR'
--   costo_reposicion   NUMERIC(10, 2)         NOT NULL
--   margen_minimo_pct  NUMERIC(5, 2)          NOT NULL DEFAULT 15.00

-- Índice adicional para consultas de análisis de margen:
CREATE INDEX idx_productos_tipo_estrategico ON productos(tipo_estrategico);
CREATE INDEX idx_productos_margen_minimo    ON productos(margen_minimo_pct);
```

### Tabla `ordenes_compra`

```sql
CREATE TYPE estado_orden_compra_enum AS ENUM ('BORRADOR', 'ENVIADA', 'RECIBIDA', 'CANCELADA');

CREATE TABLE ordenes_compra (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proveedor_id            UUID NOT NULL,                              -- FK a tabla proveedores
    fecha_emision           TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_entrega_estimada  DATE,
    estado                  estado_orden_compra_enum NOT NULL DEFAULT 'BORRADOR',
    total_estimado          NUMERIC(12, 2),
    notas                   TEXT,
    creado_por_usuario_id   UUID NOT NULL
);

CREATE TABLE detalle_ordenes_compra (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    orden_compra_id         UUID NOT NULL REFERENCES ordenes_compra(id) ON DELETE CASCADE,
    producto_id             UUID NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    cantidad_solicitada     INTEGER NOT NULL CHECK (cantidad_solicitada > 0),
    costo_unitario_pactado  NUMERIC(10, 2) NOT NULL CHECK (costo_unitario_pactado >= 0),
    -- Campo disparador de alerta: si costo_unitario_pactado > precio_venta * (1 - margen_minimo_pct/100)
    -- el servicio AlertaErosionMargenService emite notificación al Supervisor
    subtotal_linea          NUMERIC(12, 2) GENERATED ALWAYS AS (cantidad_solicitada * costo_unitario_pactado) STORED
);

CREATE INDEX idx_detalle_orden_compra_producto ON detalle_ordenes_compra(producto_id);
```

---

## 2. DDL Analítico (OLAP — DuckDB)

### FACT_VENTAS (extensión de margen)

```sql
-- Esta tabla es el punto de extensión analítico de 001-core-ventas-inventario.
-- El ETL de este módulo añade la columna margen_bruto_pct.
CREATE TABLE FACT_VENTAS (
    venta_sk                INTEGER PRIMARY KEY,
    venta_id                UUID    NOT NULL UNIQUE,
    fecha_sk                INTEGER NOT NULL,           -- FK a DIM_TIEMPO
    producto_sk             INTEGER NOT NULL,           -- FK a DIM_PRODUCTO
    cliente_sk              INTEGER,                    -- FK a DIM_CLIENTE (nullable)
    cantidad                INTEGER NOT NULL,
    precio_cobrado          NUMERIC(10, 2) NOT NULL,
    costo_unitario_lote     NUMERIC(10, 2) NOT NULL,
    descuento_unitario      NUMERIC(10, 2) NOT NULL DEFAULT 0,
    subtotal_linea          NUMERIC(10, 2) NOT NULL,
    margen_bruto_pct        NUMERIC(8, 4),              -- (precio_cobrado - costo_unitario_lote) / precio_cobrado * 100
    tipo_estrategico        VARCHAR(10),                -- Snapshot del tipo en el momento de la venta
    fecha_carga             TIMESTAMP DEFAULT current_timestamp
);
```
