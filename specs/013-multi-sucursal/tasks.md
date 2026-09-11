# Checklist de Implementación: 013 - Soporte Multi-Sucursal

- [x] Crear migración SQL para la tabla `sucursal` (Alembic 0008).
- [x] Crear migración SQL para la tabla `terminal_caja`.
- [x] Asociar clave foránea `sucursal_id` en lotes de inventario.
- [x] Asociar clave foránea `sucursal_id` en sesiones de caja.
- [x] Asociar clave foránea `sucursal_id` en usuarios y clientes/cupones (Alembic 0011).
- [x] Implementar modelo y esquemas Pydantic para `Sucursal` y `TerminalCaja`.
- [x] Desarrollar API REST para Sucursales (`/api/v1/sucursales/`).
- [x] Desarrollar API REST para Terminales (`/api/v1/sucursales/{id}/terminales`).
- [x] Implementar dependencia `enforce_sucursal_scope` con rechazo HTTP 403 Forbidden.
- [x] Desarrollar store global reactivo `useSucursalStore` en frontend.
- [x] Implementar selector dinámico en Header con candado para supervisores.
- [x] Escribir pruebas unitarias y de integración para el aislamiento multi-sucursal.
