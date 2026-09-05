# Modelo de Datos: 008 - Operación Offline-First y Sincronización

**Módulo:** 008-offline-sync  
**Ámbito:** Base de datos local de la terminal (SQLite) y tabla de estado de sincronización en servidor central.

---

## 1. Esquema SQLite Local en Terminal POS

```sql
-- Catálogo descargado para búsqueda offline rápida
CREATE TABLE productos_cache (
    id TEXT PRIMARY KEY,               -- UUID central
    codigo_barras TEXT NOT NULL UNIQUE,
    sku TEXT NOT NULL,
    nombre TEXT NOT NULL,
    precio_venta NUMERIC NOT NULL,
    actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cache_barcode ON productos_cache(codigo_barras);

-- Ventas generadas localmente durante el corte
CREATE TABLE ventas_offline (
    id_local TEXT PRIMARY KEY,         -- UUID generado en terminal
    fecha_hora DATETIME NOT NULL,
    subtotal NUMERIC NOT NULL,
    total_pagar NUMERIC NOT NULL,
    efectivo_recibido NUMERIC NOT NULL,
    cambio_entregado NUMERIC NOT NULL,
    estado_sync TEXT NOT NULL DEFAULT 'PENDIENTE', -- PENDIENTE | SINCRONIZADA | EN_CONFLICTO
    sincronizado_en DATETIME
);

-- Detalle de productos vendidos offline
CREATE TABLE detalle_ventas_offline (
    id_local TEXT PRIMARY KEY,
    venta_id_local TEXT NOT NULL REFERENCES ventas_offline(id_local),
    producto_id TEXT NOT NULL,
    cantidad INTEGER NOT NULL,
    precio_unitario NUMERIC NOT NULL,
    subtotal_linea NUMERIC NOT NULL
);
```

---

## 2. Control de Conflictos en Backend Central (PostgreSQL)

En la tabla central `ventas`, se añade la columna:
```sql
ALTER TABLE ventas ADD COLUMN origen_offline BOOLEAN DEFAULT FALSE;
ALTER TABLE ventas ADD COLUMN estado_sync_revision VARCHAR(30) DEFAULT 'NORMAL'; -- NORMAL | PENDIENTE_REVISION
```
