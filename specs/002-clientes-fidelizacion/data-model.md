# Modelo de Datos: 002 - Clientes, Segmentación RFM y Fidelización

**Módulo:** 002-clientes-fidelizacion  
**Esquema:** Relacional OLTP (PostgreSQL) + Capa Analítica OLAP (DuckDB Gold)

---

## 1. DDL Relacional (OLTP — PostgreSQL)

```sql
-- Tabla de Clientes
CREATE TABLE clientes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cedula              VARCHAR(30) NOT NULL UNIQUE,
    telefono            VARCHAR(20) NOT NULL UNIQUE,
    nombre              VARCHAR(150) NOT NULL,
    email               VARCHAR(254),
    puntos_acumulados   INTEGER NOT NULL DEFAULT 0 CHECK (puntos_acumulados >= 0),
    sucursal_id         UUID NOT NULL REFERENCES sucursal(id) ON DELETE RESTRICT,
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_registro      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_clientes_cedula    ON clientes(cedula);
CREATE INDEX idx_clientes_telefono  ON clientes(telefono);
CREATE INDEX idx_clientes_sucursal  ON clientes(sucursal_id);
CREATE INDEX idx_clientes_activo    ON clientes(activo);

-- Tipos ENUM para Cupones
CREATE TYPE tipo_cupon_enum     AS ENUM ('CUMPLEANIOS', 'REACTIVACION', 'COMBO', 'MANUAL');
CREATE TYPE descuento_regla_tipo AS ENUM ('PORCENTAJE', 'MONTO_FIJO');
CREATE TYPE estado_cupon_enum   AS ENUM ('EMITIDO', 'CANJEADO', 'EXPIRADO');

-- Tabla de Cupones de Descuento
CREATE TABLE cupones (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo              VARCHAR(30) NOT NULL UNIQUE,
    cliente_id          UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    sucursal_id         UUID NOT NULL REFERENCES sucursal(id) ON DELETE RESTRICT,
    tipo                tipo_cupon_enum NOT NULL DEFAULT 'MANUAL',
    descuento_tipo      descuento_regla_tipo NOT NULL,
    descuento_valor     NUMERIC(10, 2) NOT NULL CHECK (descuento_valor > 0),
    valido_desde        DATE NOT NULL,
    valido_hasta        DATE NOT NULL,
    estado              estado_cupon_enum NOT NULL DEFAULT 'EMITIDO',
    creado_en           TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_cupon_vigencia CHECK (valido_hasta >= valido_desde)
);

CREATE INDEX idx_cupones_codigo   ON cupones(codigo);
CREATE INDEX idx_cupones_cliente  ON cupones(cliente_id);
CREATE INDEX idx_cupones_sucursal ON cupones(sucursal_id);
CREATE INDEX idx_cupones_estado   ON cupones(estado);
```

---

## 2. DDL Analítico (OLAP — DuckDB Gold)

### `gold.dim_cliente`
```sql
CREATE TABLE gold.dim_cliente (
    cliente_id          UUID PRIMARY KEY,
    cedula              VARCHAR(30),
    nombre              VARCHAR(150) NOT NULL,
    telefono            VARCHAR(20),
    email               VARCHAR(254),
    puntos_acumulados   INTEGER,
    sucursal_id         UUID,
    activo              BOOLEAN
);
```

### Consulta Dinámica RFM (Generación de Segmentos en Tiempo de Ejecución)
```sql
WITH metricas_base AS (
    SELECT 
        v.cliente_id,
        c.nombre,
        c.cedula,
        c.telefono,
        DATEDIFF('day', MAX(v.fecha_hora), CURRENT_DATE) AS recencia_dias,
        COUNT(DISTINCT v.id) AS frecuencia_compras,
        SUM(v.total_pagar) AS valor_monetario
    FROM gold.fact_ventas v
    JOIN gold.dim_cliente c ON v.cliente_id = c.cliente_id
    WHERE v.estado = 'COMPLETADA'
      AND (:sucursal_id IS NULL OR v.sucursal_id = :sucursal_id)
    GROUP BY v.cliente_id, c.nombre, c.cedula, c.telefono
),
scores_rfm AS (
    SELECT *,
        NTILE(5) OVER (ORDER BY recencia_dias DESC) AS r_score,
        NTILE(5) OVER (ORDER BY frecuencia_compras ASC) AS f_score,
        NTILE(5) OVER (ORDER BY valor_monetario ASC) AS m_score
    FROM metricas_base
)
SELECT *,
    CASE 
        WHEN r_score >= 4 AND f_score >= 4 AND m_score >= 4 THEN 'CAMPEONES'
        WHEN r_score >= 3 AND f_score >= 3 AND m_score >= 3 THEN 'LEALES'
        WHEN r_score >= 4 AND f_score <= 2 THEN 'PROMETEDORES'
        WHEN r_score >= 3 AND f_score <= 2 THEN 'NUEVOS'
        WHEN r_score <= 2 AND f_score >= 3 THEN 'EN RIESGO'
        WHEN r_score = 1 AND f_score >= 4 THEN 'NO PODEMOS PERDERLOS'
        WHEN r_score <= 2 AND f_score <= 2 AND m_score >= 3 THEN 'EN ESPERA'
        WHEN r_score <= 2 AND f_score <= 2 AND m_score <= 2 THEN 'DORMIDOS'
        ELSE 'NECESITAN ATENCION'
    END AS segmento_rfm
FROM scores_rfm;
```
