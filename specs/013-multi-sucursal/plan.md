# Plan de Implementación: Multi-Sucursal

## Fases del Proyecto

### Fase 1: Base de Datos y Modelos
- Creación de las tablas `sucursal` y `terminal_caja`.
- Modificación de la tabla `sesion_caja` para incluir el `terminal_caja_id`.
- Modificación del sistema de inventario para soportar `inventario_sucursal` (separar stock por sucursal).

### Fase 2: APIs y Controladores
- Implementar CRUD completo para la entidad Sucursal.
- Implementar CRUD para la entidad Terminal de Caja.

### Fase 3: Autenticación y Contexto
- Modificar el middleware de autenticación para inyectar la sucursal actual en el contexto del usuario (contexto de autenticación).
- Asegurar que las consultas de ventas e inventario se filtren automáticamente por la sucursal del contexto.

### Fase 4: Pruebas y Despliegue
- Pruebas unitarias para los nuevos controladores y servicios.
- Pruebas de integración asegurando el aislamiento de datos entre sucursales.
