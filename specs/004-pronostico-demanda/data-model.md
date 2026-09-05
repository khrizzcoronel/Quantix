# Modelo de Datos: 004 - Pronóstico de Demanda y Reposición

**Módulo:** 004-pronostico-demanda  
**Esquema:** Analítico OLAP (DuckDB) + Parámetros de Configuración (PostgreSQL)

---

## 1. DDL Analítico (OLAP — DuckDB)

### FACT_INVENTARIO_DIARIO

```sql
CREATE TABLE FACT_INVENTARIO_DIARIO (
    id                          INTEGER PRIMARY KEY,
    fecha                       DATE    NOT NULL,
    producto_sk                 INTEGER NOT NULL,           -- FK a DIM_PRODUCTO
    producto_id                 UUID    NOT NULL,           -- FK hacia OLTP
    stock_disponible_inicio     INTEGER NOT NULL DEFAULT 0, -- Stock al inicio del día
    unidades_vendidas           INTEGER NOT NULL DEFAULT 0, -- Total unidades vendidas en el día
    unidades_recibidas          INTEGER NOT NULL DEFAULT 0, -- Entradas de lote en el día
    stock_disponible_fin        INTEGER NOT NULL DEFAULT 0, -- Stock al cierre del día
    cantidad_rotura_stock       INTEGER NOT NULL DEFAULT 0,
    -- 0 = sin rotura; > 0 = horas o unidades faltantes (marca el día para excluirlo del promedio de velocidad)
    velocidad_venta_diaria      NUMERIC(10, 4),             -- Calculada en el ETL, excluyendo días con rotura
    dias_inventario_proyectados NUMERIC(10, 2),             -- stock_disponible_fin / velocidad_venta_diaria
    punto_reorden               NUMERIC(10, 4),             -- (velocidad × lead_time) + stock_seguridad
    lead_time_dias              INTEGER,                    -- Del proveedor preferido del producto
    factor_seguridad            NUMERIC(5, 2),              -- Snapshot del valor en CONFIGURACION
    fecha_carga                 TIMESTAMP DEFAULT current_timestamp,
    UNIQUE (fecha, producto_id)
);

CREATE INDEX idx_fact_inv_diario_fecha     ON FACT_INVENTARIO_DIARIO(fecha DESC);
CREATE INDEX idx_fact_inv_diario_producto  ON FACT_INVENTARIO_DIARIO(producto_id);
```

---

## 2. Parámetros de Configuración (OLTP — PostgreSQL)

Los siguientes registros deben existir en la tabla `CONFIGURACION` (definida en el módulo 001):

```sql
-- Factor de seguridad para el cálculo de stock de seguridad
-- Fórmula: velocidad_diaria × desviacion_estandar_demanda × factor_seguridad
INSERT INTO configuracion (clave, valor, descripcion) VALUES
  ('stock_seguridad_factor',     '1.65', 'Factor Z para nivel de servicio ~95%. Modificable por Director.'),
  ('inventario_dias_sobrestock', '90',   'Días proyectados a partir de los cuales un producto se considera sobrestock.');
```
