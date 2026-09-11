# Modelo de Datos: 003 - Precios, Rentabilidad, Matriz Pareto ABC y Órdenes de Compra

**Módulo:** 003-precios-margenes  
**Esquema:** Relacional OLTP (PostgreSQL) + Capa Analítica OLAP (DuckDB Gold)

---

## 1. DDL Relacional (OLTP — PostgreSQL)

```sql
-- Tabla de Proveedores con Lead Time Operativo
CREATE TABLE proveedor (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre              VARCHAR(150) NOT NULL UNIQUE,
    contacto_nombre     VARCHAR(100),
    telefono            VARCHAR(30),
    email               VARCHAR(254),
    lead_time_dias      INTEGER NOT NULL DEFAULT 7 CHECK (lead_time_dias >= 1),
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en           TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_proveedor_nombre ON proveedor(nombre);
CREATE INDEX idx_proveedor_activo ON proveedor(activo);

-- Estados de Orden de Compra
CREATE TYPE estado_orden_compra_enum AS ENUM (
    'PENDIENTE',
    'RECIBIDA_PARCIAL',
    'RECIBIDA',
    'CANCELADA'
);

-- Encabezado de Orden de Compra
CREATE TABLE orden_compra (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proveedor_id            UUID NOT NULL REFERENCES proveedor(id) ON DELETE RESTRICT,
    usuario_solicitante_id  UUID NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
    fecha_emision           TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_entrega_estimada  DATE,
    fecha_recepcion         TIMESTAMP WITH TIME ZONE,
    estado                  estado_orden_compra_enum NOT NULL DEFAULT 'PENDIENTE',
    total_estimado          NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    notas                   TEXT
);

CREATE INDEX idx_orden_compra_proveedor ON orden_compra(proveedor_id);
CREATE INDEX idx_orden_compra_estado    ON orden_compra(estado);
CREATE INDEX idx_orden_compra_fecha     ON orden_compra(fecha_emision DESC);

-- Detalle de Orden de Compra con soporte para recepción parcial
CREATE TABLE detalle_orden_compra (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    orden_compra_id         UUID NOT NULL REFERENCES orden_compra(id) ON DELETE CASCADE,
    producto_id             UUID NOT NULL REFERENCES producto(id) ON DELETE RESTRICT,
    cantidad_solicitada     NUMERIC(10, 2) NOT NULL CHECK (cantidad_solicitada > 0),
    cantidad_recibida       NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (cantidad_recibida >= 0),
    costo_unitario_pactado  NUMERIC(10, 2) NOT NULL CHECK (costo_unitario_pactado >= 0)
);

CREATE INDEX idx_detalle_orden_compra_orden    ON detalle_orden_compra(orden_compra_id);
CREATE INDEX idx_detalle_orden_compra_producto ON detalle_orden_compra(producto_id);
```

---

## 2. DDL Analítico (OLAP — DuckDB Gold)

### Matriz Pareto ABC de Productos (`gold.fact_ventas` + `gold.dim_producto`)
```sql
WITH ventas_acumuladas AS (
    SELECT 
        p.producto_id,
        p.sku,
        p.nombre,
        SUM(v.cantidad) AS unidades_vendidas,
        SUM(v.total_pagar) AS ingresos_totales,
        SUM(v.margen_ganancia) AS margen_bruto_total,
        ROUND((SUM(v.margen_ganancia) / NULLIF(SUM(v.total_pagar), 0)) * 100, 2) AS margen_pct
    FROM gold.fact_ventas v
    JOIN gold.dim_producto p ON v.producto_id = p.producto_id
    WHERE v.estado = 'COMPLETADA'
      AND (:sucursal_id IS NULL OR v.sucursal_id = :sucursal_id)
    GROUP BY p.producto_id, p.sku, p.nombre
),
pareto_ranking AS (
    SELECT *,
        SUM(ingresos_totales) OVER () AS facturacion_global,
        SUM(ingresos_totales) OVER (ORDER BY ingresos_totales DESC) AS ingresos_acumulados
    FROM ventas_acumuladas
)
SELECT *,
    ROUND((ingresos_acumulados / facturacion_global) * 100, 2) AS pct_acumulado,
    CASE 
        WHEN (ingresos_acumulados / facturacion_global) <= 0.80 THEN 'A'
        WHEN (ingresos_acumulados / facturacion_global) <= 0.95 THEN 'B'
        ELSE 'C'
    END AS clase_pareto
FROM pareto_ranking
ORDER BY ingresos_totales DESC;
```
