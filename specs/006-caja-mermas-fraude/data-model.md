# Modelo de Datos: 006 - Caja, Mermas y Detección de Fraude

**Módulo:** 006-caja-mermas-fraude  
**Esquema:** Relacional OLTP (PostgreSQL) + Analítico OLAP (DuckDB)

---

## 1. DDL Relacional (OLTP — PostgreSQL)

```sql
-- Estados de sesión de caja
CREATE TYPE estado_sesion_caja_enum AS ENUM ('ABIERTA', 'CERRADA', 'EN_REVISION');

CREATE TABLE sesiones_caja (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cajero_usuario_id   UUID NOT NULL,                      -- FK a tabla usuarios
    terminal_id         VARCHAR(50) NOT NULL,
    fondo_inicial       NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    fecha_apertura      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_cierre        TIMESTAMP WITH TIME ZONE,
    estado              estado_sesion_caja_enum NOT NULL DEFAULT 'ABIERTA',
    notas_cierre        TEXT
);

CREATE INDEX idx_sesion_caja_cajero   ON sesiones_caja(cajero_usuario_id);
CREATE INDEX idx_sesion_caja_estado   ON sesiones_caja(estado);
CREATE INDEX idx_sesion_caja_apertura ON sesiones_caja(fecha_apertura DESC);

-- Arqueo ciego por sesión
CREATE TABLE arqueos_caja (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sesion_caja_id          UUID NOT NULL UNIQUE REFERENCES sesiones_caja(id) ON DELETE RESTRICT,
    efectivo_contado        NUMERIC(10, 2) NOT NULL,         -- Solo lo que ingresa el cajero
    comprobantes_tarjeta    NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_teorico           NUMERIC(10, 2) NOT NULL,         -- Calculado por el backend
    diferencia              NUMERIC(10, 2) NOT NULL,         -- total_teorico - (efectivo_contado + comprobantes + fondo_inicial)
    requiere_revision       BOOLEAN NOT NULL DEFAULT FALSE,  -- TRUE si abs(diferencia) > tolerancia
    registrado_en           TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    revisado_por_usuario_id UUID,                            -- Supervisor que resuelve la discrepancia
    notas_revision          TEXT
);

-- Tabla de auditoría forense APPEND-ONLY
CREATE TYPE tipo_evento_auditoria_enum AS ENUM (
    'VENTA_COMPLETADA', 'VENTA_ANULADA', 'DESCUENTO_APLICADO',
    'APERTURA_SESION', 'CIERRE_SESION', 'DISCREPANCIA_ARQUEO',
    'ALERTA_MARGEN', 'LIQUIDACION_FEFO', 'ACCESO_RESTRINGIDO'
);

CREATE TABLE auditoria_eventos (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_evento             tipo_evento_auditoria_enum NOT NULL,
    usuario_id              UUID NOT NULL,
    venta_referencia_id     UUID REFERENCES ventas(id) ON DELETE SET NULL,   -- Contexto de venta (si aplica)
    usuario_autorizador_id  UUID,                               -- Supervisor que autorizó (si aplica)
    ip_terminal             INET,                               -- IP de la terminal que originó el evento
    detalle_json            JSONB NOT NULL DEFAULT '{}',        -- Snapshot completo del contexto en el momento del evento
    registrado_en           TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Trigger para garantizar inmutabilidad APPEND-ONLY
CREATE OR REPLACE FUNCTION auditoria_inmutable() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'La tabla auditoria_eventos es APPEND-ONLY. No se permiten UPDATE ni DELETE.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auditoria_no_update
    BEFORE UPDATE OR DELETE ON auditoria_eventos
    FOR EACH ROW EXECUTE FUNCTION auditoria_inmutable();

CREATE INDEX idx_auditoria_tipo      ON auditoria_eventos(tipo_evento);
CREATE INDEX idx_auditoria_usuario   ON auditoria_eventos(usuario_id);
CREATE INDEX idx_auditoria_fecha     ON auditoria_eventos(registrado_en DESC);
CREATE INDEX idx_auditoria_terminal  ON auditoria_eventos(ip_terminal);
```

---

## 2. DDL Analítico (OLAP — DuckDB)

### FACT_ARQUEOS_MERMA

```sql
CREATE TABLE FACT_ARQUEOS_MERMA (
    id                  INTEGER PRIMARY KEY,
    arqueo_id           UUID    NOT NULL UNIQUE,
    sesion_sk           INTEGER NOT NULL,
    cajero_sk           INTEGER NOT NULL,
    fecha_sk            INTEGER NOT NULL,
    fondo_inicial       NUMERIC(10, 2),
    efectivo_contado    NUMERIC(10, 2),
    comprobantes_tarjeta NUMERIC(10, 2),
    total_teorico       NUMERIC(10, 2),
    diferencia          NUMERIC(10, 2),
    requiere_revision   BOOLEAN,
    fecha_carga         TIMESTAMP DEFAULT current_timestamp
);
```
