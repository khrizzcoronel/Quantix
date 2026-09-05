# Especificación: Soporte Multi-Sucursal

## Objetivo
El objetivo de esta especificación es definir los requerimientos para soportar múltiples sucursales dentro del sistema Quantix. Esto incluye la gestión de múltiples terminales por sucursal y la separación del inventario para que cada sucursal maneje su propio stock de productos.

## Alcance
- Gestión de Sucursales (Creación, lectura, actualización y eliminación - CRUD).
- Gestión de Terminales de Caja asociadas a una sucursal específica.
- Manejo de inventario independiente por cada sucursal.
- Asociación de sesiones de caja a una terminal y sucursal.

## Requerimientos No Funcionales
- El acceso a la información de otras sucursales debe estar restringido a menos que el usuario tenga un rol de administrador global.
