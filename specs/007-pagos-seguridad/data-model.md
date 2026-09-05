# Modelo de Datos: 007 - Pagos y Seguridad de Transacciones

**Módulo:** 007-pagos-seguridad  
**Esquema:** Relacional OLTP (PostgreSQL) + Analítico OLAP (DuckDB)

---

## 1. DDL Relacional (OLTP — PostgreSQL)

```sql
-- ENUMs de pagos
CREATE TYPE metodo_pago_enum  AS ENUM ('EFECTIVO', 'TARJETA_DEBITO', 'TARJETA_CREDITO', 'TRANSFERENCIA', 'QR');
CREATE TYPE estado_pago_enum  AS ENUM ('PENDIENTE_CONFIRMACION', 'CONFIRMADO', 'RECHAZADO', 'REEMBOLSADO');

CREATE TABLE pagos_venta (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venta_id                UUID NOT NULL REFERENCES ventas(id) ON DELETE RESTRICT,
    metodo_pago             metodo_pago_enum NOT NULL,
    monto                   NUMERIC(10, 2) NOT NULL CHECK (monto > 0),
    estado_pago             estado_pago_enum NOT NULL DEFAULT 'PENDIENTE_CONFIRMACION',
    referencia_transaccion  VARCHAR(100),               -- ID de la pasarela (llega con el webhook)
    autorizacion_bancaria   VARCHAR(50),                -- Código de autorización bancaria
    token_tarjeta           VARCHAR(200),               -- Token devuelto por la pasarela (no PAN)
    ultimos_4_digitos       CHAR(4),                    -- Para visualización en recibos
    idempotency_key         VARCHAR(100) NOT NULL UNIQUE,
    -- Formato: folio_ticket + '_' + metodo_pago; garantiza unicidad del cobro
    intento_numero          SMALLINT NOT NULL DEFAULT 1 CHECK (intento_numero BETWEEN 1 AND 3),
    error_codigo            VARCHAR(20),                -- ERR-PAG-01 o ERR-PAG-02 si aplica
    creado_en               TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    actualizado_en          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pagos_venta_id         ON pagos_venta(venta_id);
CREATE INDEX idx_pagos_idempotency      ON pagos_venta(idempotency_key);
CREATE INDEX idx_pagos_estado           ON pagos_venta(estado_pago);
CREATE INDEX idx_pagos_referencia       ON pagos_venta(referencia_transaccion);
CREATE INDEX idx_pagos_creado_en        ON pagos_venta(creado_en DESC);
```

---

## 2. DDL Analítico (OLAP — DuckDB)

### DIM_METODO_PAGO

```sql
CREATE TABLE DIM_METODO_PAGO (
    metodo_pago_sk          INTEGER PRIMARY KEY,
    metodo_pago_codigo      VARCHAR(30) NOT NULL UNIQUE,  -- EFECTIVO, TARJETA_DEBITO, etc.
    descripcion             VARCHAR(100),
    comision_pct_estimada   NUMERIC(5, 4) NOT NULL DEFAULT 0.0000,
    -- Porcentaje de comisión cobrado por la pasarela para este método
    activo                  BOOLEAN NOT NULL DEFAULT TRUE
);

-- Seed inicial
INSERT INTO DIM_METODO_PAGO (metodo_pago_sk, metodo_pago_codigo, descripcion, comision_pct_estimada) VALUES
  (1, 'EFECTIVO',         'Pago en efectivo',             0.0000),
  (2, 'TARJETA_DEBITO',   'Tarjeta de débito (MSC)',       0.0090),
  (3, 'TARJETA_CREDITO',  'Tarjeta de crédito (MSC)',      0.0360),
  (4, 'TRANSFERENCIA',    'Transferencia bancaria',        0.0050),
  (5, 'QR',               'Pago por código QR / CoDi',    0.0000);
```
