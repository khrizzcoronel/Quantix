# Modelo de Datos: 006 - Control de Caja, Mermas y Auditoría

**Módulo:** 006-caja-mermas-fraude  
**Esquema:** Relacional OLTP (PostgreSQL)

---

## 1. DDL Relacional (OLTP — PostgreSQL)

```sql
-- Tipos ENUM para Caja
CREATE TYPE estado_sesion_caja_enum AS ENUM (
    'ABIERTA',
    'CERRADA',
    'DESCUADRE'
);

CREATE TYPE tipo_movimiento_caja_enum AS ENUM (
    'INGRESO',
    'EGRESO'
);

-- Tabla de Sesiones de Caja
CREATE TABLE sesion_caja (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id              UUID NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
    sucursal_id             UUID NOT NULL REFERENCES sucursal(id) ON DELETE RESTRICT,
    terminal_id             VARCHAR(50) NOT NULL,
    monto_inicial_efectivo  NUMERIC(12, 2) NOT NULL CHECK (monto_inicial_efectivo >= 0),
    fecha_inicio            TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_cierre            TIMESTAMP WITH TIME ZONE,
    estado                  estado_sesion_caja_enum NOT NULL DEFAULT 'ABIERTA'
);

CREATE INDEX idx_sesion_caja_usuario  ON sesion_caja(usuario_id);
CREATE INDEX idx_sesion_caja_sucursal ON sesion_caja(sucursal_id);
CREATE INDEX idx_sesion_caja_estado   ON sesion_caja(estado);

-- Tabla de Movimientos Extraordinarios de Caja (Alembic 0007)
CREATE TABLE movimiento_caja (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sesion_id   UUID NOT NULL REFERENCES sesion_caja(id) ON DELETE CASCADE,
    usuario_id  UUID NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
    tipo        tipo_movimiento_caja_enum NOT NULL,
    monto       NUMERIC(12, 2) NOT NULL CHECK (monto > 0),
    concepto    VARCHAR(255) NOT NULL,
    fecha_hora  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_movimiento_caja_sesion ON movimiento_caja(sesion_id);

-- Tabla de Arqueos Ciegos de Caja
CREATE TABLE arqueo_caja (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sesion_id               UUID NOT NULL UNIQUE REFERENCES sesion_caja(id) ON DELETE CASCADE,
    cajero_id               UUID NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
    fecha_arqueo            TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    total_teorico           NUMERIC(12, 2) NOT NULL,
    total_fisico_declarado  NUMERIC(12, 2) NOT NULL CHECK (total_fisico_declarado >= 0),
    diferencia              NUMERIC(12, 2) NOT NULL,
    desglose_declarado_json JSONB,
    estado                  VARCHAR(50) NOT NULL,  -- 'OK', 'SOBRANTE', 'FALTANTE'
    observaciones           TEXT
);

CREATE INDEX idx_arqueo_caja_sesion ON arqueo_caja(sesion_id);

-- Tabla de Bitácora Inmutable de Auditoría
CREATE TABLE auditoria_evento (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_evento     VARCHAR(255) NOT NULL,
    usuario_id      UUID REFERENCES usuario(id) ON DELETE SET NULL,
    gravedad        VARCHAR(50) NOT NULL DEFAULT 'INFO',  -- 'INFO', 'BAJA', 'MEDIA', 'CRITICA'
    payload_json    JSONB,
    fecha_evento    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_auditoria_evento_fecha ON auditoria_evento(fecha_evento DESC);
CREATE INDEX idx_auditoria_evento_tipo  ON auditoria_evento(tipo_evento);
```
