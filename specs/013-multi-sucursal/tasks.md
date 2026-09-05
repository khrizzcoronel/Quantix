# Checklist de Implementación

- [ ] Crear migración SQL para la tabla `sucursal`.
- [ ] Crear migración SQL para la tabla `terminal_caja`.
- [ ] Crear migración SQL para la tabla `inventario_sucursal`.
- [ ] Modificar tabla `sesion_caja` para referenciar a `terminal_caja`.
- [ ] Implementar modelo y repositorio para `Sucursal`.
- [ ] Implementar modelo y repositorio para `TerminalCaja`.
- [ ] Desarrollar API CRUD para Sucursales (`/api/v1/admin/sucursales`).
- [ ] Desarrollar API CRUD para Terminales (`/api/v1/admin/terminales`).
- [ ] Actualizar el middleware de JWT/Auth para inyectar el `sucursal_id` en el contexto.
- [ ] Refactorizar módulo de inventario para leer/escribir usando `inventario_sucursal`.
- [ ] Escribir pruebas unitarias e integración para el soporte multi-sucursal.
- [ ] Actualizar documentación técnica general.
