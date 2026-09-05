# Modelo de Datos: 001 - Core de Ventas e Inventario

**Módulo:** 001-core-ventas-inventario  
**Esquema:** Relacional OLTP (PostgreSQL)

---

## 1. DDL Relacional

```sql
-- Categorías de catálogo
CREATE TABLE categorias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT
);

-- Catálogo de productos
CREATE TYPE tipo_estrategico_enum AS ENUM ('GANCHO', 'NICHO', 'REGULAR');

CREATE TABLE productos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_barras VARCHAR(50) NOT NULL UNIQUE,
    sku VARCHAR(50) NOT NULL UNIQUE,
    nombre VARCHAR(150) NOT NULL,
    categoria_id UUID REFERENCES categorias(id) ON DELETE RESTRICT,
    tipo_estrategico tipo_estrategico_enum NOT NULL DEFAULT 'REGULAR',
    precio_venta NUMERIC(10, 2) NOT NULL CHECK (precio_venta >= 0),
    costo_reposicion NUMERIC(10, 2) NOT NULL CHECK (costo_reposicion >= 0),
    margen_minimo_pct NUMERIC(5, 2) NOT NULL DEFAULT 15.00,
    stock_minimo INTEGER NOT NULL DEFAULT 5,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_productos_codigo_barras ON productos(codigo_barras);
CREATE INDEX idx_productos_sku ON productos(sku);

-- Lotes para trazabilidad FEFO
CREATE TABLE lotes_inventario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    numero_lote VARCHAR(50) NOT NULL,
    fecha_vencimiento DATE NOT NULL,
    costo_unitario_compra NUMERIC(10, 2) NOT NULL CHECK (costo_unitario_compra >= 0),
    cantidad_inicial INTEGER NOT NULL CHECK (cantidad_inicial > 0),
    cantidad_disponible INTEGER NOT NULL CHECK (cantidad_disponible >= 0),
    fecha_ingreso TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_lotes_fefo ON lotes_inventario(producto_id, fecha_vencimiento ASC, cantidad_disponible);

-- Encabezado de Venta
CREATE TYPE estado_venta_enum AS ENUM ('COMPLETADA', 'ANULADA', 'DEVUELTA');

CREATE TABLE ventas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folio_ticket VARCHAR(30) NOT NULL UNIQUE,
    fecha_hora TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
    total_descuento NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_impuestos NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_pagar NUMERIC(10, 2) NOT NULL CHECK (total_pagar >= 0),
    costo_total_venta NUMERIC(10, 2) NOT NULL,
    margen_total_ganancia NUMERIC(10, 2) NOT NULL,
    estado estado_venta_enum NOT NULL DEFAULT 'COMPLETADA'
);

CREATE INDEX idx_ventas_fecha ON ventas(fecha_hora DESC);

-- Detalle de Venta con lote FEFO asignado
CREATE TABLE detalle_ventas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venta_id UUID NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    lote_id UUID NOT NULL REFERENCES lotes_inventario(id) ON DELETE RESTRICT,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario_cobrado NUMERIC(10, 2) NOT NULL,
    costo_unitario_lote NUMERIC(10, 2) NOT NULL,
    descuento_unitario NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    subtotal_linea NUMERIC(10, 2) NOT NULL,
    margen_linea NUMERIC(10, 2) NOT NULL
);

CREATE INDEX idx_detalle_ventas_venta ON detalle_ventas(venta_id);
CREATE INDEX idx_detalle_ventas_producto ON detalle_ventas(producto_id);
```
