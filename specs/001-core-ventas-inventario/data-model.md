# Modelo de Datos: 001 - Core de Ventas e Inventario

**Módulo:** 001-core-ventas-inventario  
**Esquema:** Relacional OLTP (PostgreSQL)

---

## 1. DDL Relacional

```sql
-- Categorías de catálogo
CREATE TABLE categoria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT
);

-- Catálogo maestro de productos
CREATE TABLE producto (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_barras VARCHAR(50) NOT NULL UNIQUE,
    sku VARCHAR(50) NOT NULL UNIQUE,
    nombre VARCHAR(150) NOT NULL,
    categoria_id UUID REFERENCES categoria(id) ON DELETE RESTRICT,
    clasificacion_abc VARCHAR(1) NOT NULL DEFAULT 'B' CHECK (clasificacion_abc IN ('A', 'B', 'C')),
    precio_venta NUMERIC(10, 2) NOT NULL CHECK (precio_venta >= 0),
    costo_base NUMERIC(10, 2) NOT NULL CHECK (costo_base >= 0),
    margen_minimo_pct NUMERIC(5, 2) NOT NULL DEFAULT 15.00,
    requiere_pesaje BOOLEAN NOT NULL DEFAULT FALSE,
    imagen TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_producto_codigo_barras ON producto(codigo_barras);
CREATE INDEX idx_producto_sku ON producto(sku);
CREATE INDEX idx_producto_categoria ON producto(categoria_id);

-- Lotes para trazabilidad sanitaria FEFO por sucursal
CREATE TYPE estado_lote_enum AS ENUM ('ACTIVO', 'AGOTADO', 'CADUCADO', 'MERMA');

CREATE TABLE lote_inventario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    producto_id UUID NOT NULL REFERENCES producto(id) ON DELETE RESTRICT,
    sucursal_id UUID NOT NULL REFERENCES sucursal(id) ON DELETE RESTRICT,
    orden_compra_id UUID REFERENCES orden_compra(id) ON DELETE SET NULL,
    codigo_lote VARCHAR(100) NOT NULL,
    fecha_vencimiento DATE NOT NULL,
    costo_unitario NUMERIC(10, 2) NOT NULL CHECK (costo_unitario >= 0),
    cantidad_inicial NUMERIC(10, 2) NOT NULL CHECK (cantidad_inicial > 0),
    cantidad_disponible NUMERIC(10, 2) NOT NULL CHECK (cantidad_disponible >= 0),
    estado estado_lote_enum NOT NULL DEFAULT 'ACTIVO',
    fecha_ingreso TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_lotes_fefo ON lote_inventario(producto_id, sucursal_id, estado, fecha_vencimiento ASC, cantidad_disponible);

-- Encabezado de Venta
CREATE TYPE estado_venta_enum AS ENUM ('COMPLETADA', 'CANCELADA_PARCIAL', 'ANULADA', 'PENDIENTE_SYNC', 'PAGADO');

CREATE TABLE ventas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folio_ticket VARCHAR(30) NOT NULL UNIQUE,
    sesion_caja_id UUID NOT NULL REFERENCES sesion_caja(id) ON DELETE RESTRICT,
    sucursal_id UUID NOT NULL REFERENCES sucursal(id) ON DELETE RESTRICT,
    cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
    fecha_hora TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    total_bruto NUMERIC(10, 2) NOT NULL CHECK (total_bruto >= 0),
    total_descuento NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_impuestos NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_pagar NUMERIC(10, 2) NOT NULL CHECK (total_pagar >= 0),
    estado estado_venta_enum NOT NULL DEFAULT 'COMPLETADA',
    idempotency_key VARCHAR(64) UNIQUE
);

CREATE INDEX idx_ventas_fecha ON ventas(fecha_hora DESC);
CREATE INDEX idx_ventas_sesion ON ventas(sesion_caja_id);
CREATE INDEX idx_ventas_sucursal ON ventas(sucursal_id);
CREATE INDEX idx_ventas_idempotency ON ventas(idempotency_key);

-- Detalle de Venta con lote FEFO asignado y margen congelado
CREATE TABLE detalles_venta (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venta_id UUID NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    producto_id UUID NOT NULL REFERENCES producto(id) ON DELETE RESTRICT,
    lote_id UUID NOT NULL REFERENCES lote_inventario(id) ON DELETE RESTRICT,
    cantidad NUMERIC(10, 3) NOT NULL CHECK (cantidad > 0),
    precio_unitario_venta NUMERIC(10, 2) NOT NULL,
    costo_unitario_lote NUMERIC(10, 2) NOT NULL,
    descuento_unitario NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    subtotal NUMERIC(10, 2) NOT NULL,
    margen_ganancia NUMERIC(10, 2) NOT NULL
);

CREATE INDEX idx_detalles_venta_venta ON detalles_venta(venta_id);
CREATE INDEX idx_detalles_venta_producto ON detalles_venta(producto_id);

-- Desglose de Pagos por Venta
CREATE TYPE metodo_pago_enum AS ENUM ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'QR', 'CUPON');

CREATE TABLE pagos_venta (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venta_id UUID NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    metodo_pago metodo_pago_enum NOT NULL,
    monto NUMERIC(10, 2) NOT NULL CHECK (monto > 0),
    referencia_pasarela VARCHAR(100),
    fecha_pago TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pagos_venta_venta ON pagos_venta(venta_id);

-- Intentos de Pago para Pasarela y Prevención de Duplicados
CREATE TABLE intentos_pago (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checkout_idempotency_key VARCHAR(64) NOT NULL,
    indice INTEGER NOT NULL,
    metodo_pago metodo_pago_enum NOT NULL,
    monto NUMERIC(10, 2) NOT NULL,
    referencia_pasarela VARCHAR(100),
    estado VARCHAR(30) NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_intento_pago_checkout_indice UNIQUE (checkout_idempotency_key, indice)
);
```
