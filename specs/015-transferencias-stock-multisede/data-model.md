# Modelo de Datos: 015 - Transferencias de Inventario Inter-Sucursal

**Módulo:** 015-transferencias-stock-multisede  
**Esquema:** Relacional OLTP (PostgreSQL)

---

## 1. DDL Relacional (OLTP — PostgreSQL)

```sql
-- Estados del Ciclo de Vida de Transferencia
CREATE TYPE estado_transferencia_enum AS ENUM (
    'SOLICITADA',
    'EN_TRANSITO',
    'RECIBIDA',
    'CANCELADA'
);

-- Encabezado de Transferencia Inter-Sucursal (Alembic 0008)
CREATE TABLE transferencia_inventario (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folio                   VARCHAR(30) NOT NULL UNIQUE,
    sucursal_origen_id      UUID NOT NULL REFERENCES sucursal(id) ON DELETE RESTRICT,
    sucursal_destino_id     UUID NOT NULL REFERENCES sucursal(id) ON DELETE RESTRICT,
    usuario_solicitante_id  UUID NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
    usuario_despacha_id     UUID REFERENCES usuario(id) ON DELETE RESTRICT,
    usuario_recibe_id       UUID REFERENCES usuario(id) ON DELETE RESTRICT,
    estado                  estado_transferencia_enum NOT NULL DEFAULT 'SOLICITADA',
    fecha_solicitud         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_despacho          TIMESTAMP WITH TIME ZONE,
    fecha_recepcion         TIMESTAMP WITH TIME ZONE,
    notas                   TEXT,
    CONSTRAINT chk_sedes_distintas CHECK (sucursal_origen_id <> sucursal_destino_id)
);

CREATE INDEX idx_transferencia_origen  ON transferencia_inventario(sucursal_origen_id);
CREATE INDEX idx_transferencia_destino ON transferencia_inventario(sucursal_destino_id);
CREATE INDEX idx_transferencia_estado  ON transferencia_inventario(estado);
CREATE INDEX idx_transferencia_folio   ON transferencia_inventario(folio);

-- Detalle de Transferencia con trazabilidad de lotes
CREATE TABLE detalle_transferencia (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transferencia_id        UUID NOT NULL REFERENCES transferencia_inventario(id) ON DELETE CASCADE,
    producto_id             UUID NOT NULL REFERENCES producto(id) ON DELETE RESTRICT,
    lote_origen_id          UUID NOT NULL REFERENCES lote_inventario(id) ON DELETE RESTRICT,
    lote_destino_id         UUID REFERENCES lote_inventario(id) ON DELETE SET NULL,
    cantidad                NUMERIC(10, 2) NOT NULL CHECK (cantidad > 0),
    costo_unitario_traspaso NUMERIC(10, 2) NOT NULL CHECK (costo_unitario_traspaso >= 0)
);

CREATE INDEX idx_detalle_transferencia_trf ON detalle_transferencia(transferencia_id);
CREATE INDEX idx_detalle_transferencia_prd ON detalle_transferencia(producto_id);
```
