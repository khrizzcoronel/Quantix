# Modelo de Datos: Multi-Sucursal

Este documento define las nuevas tablas necesarias para el sistema OLTP orientadas al soporte de múltiples sucursales y terminales de caja.

## Nuevas Tablas

### `sucursal`
Almacena la información de cada una de las sucursales del negocio.
- `id` (UUID, PK)
- `nombre` (VARCHAR)
- `direccion` (VARCHAR)
- `telefono` (VARCHAR)
- `estado` (BOOLEAN)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### `terminal_caja`
Representa una caja registradora o punto de venta físico dentro de una sucursal.
- `id` (UUID, PK)
- `sucursal_id` (UUID, FK a `sucursal.id`)
- `nombre` (VARCHAR, ej. "Caja 1")
- `estado` (BOOLEAN)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

## Relaciones Modificadas / Nuevas

### `sesion_caja`
La tabla existente de sesiones de caja debe enlazarse ahora a la terminal específica en lugar de ser global.
- Añadir `terminal_caja_id` (UUID, FK a `terminal_caja.id`).

### `inventario_sucursal`
Para soportar el inventario separado, la entidad de inventario se asocia a la sucursal.
- `id` (UUID, PK)
- `sucursal_id` (UUID, FK a `sucursal.id`)
- `producto_id` (UUID, FK a `producto.id`)
- `cantidad` (DECIMAL/INT)
