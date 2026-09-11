# Plan de Implementación: 013 - Soporte Multi-Sucursal

## Fases del Proyecto

### Fase 1: Base de Datos y Modelos
- [x] Creación de las tablas `sucursal` y `terminal_caja` (Alembic `0008_multi_sucursal.py`).
- [x] Inserción de la sede matriz predeterminada (`00000000-0000-0000-0000-000000000001`).
- [x] Asociación de `sucursal_id` en `lote_inventario`, `sesion_caja`, `ventas`, `usuario`, `clientes` y `cupones`.

### Fase 2: APIs y Controladores
- [x] Implementar CRUD completo para la entidad Sucursal en `backend/app/api/sucursales.py`.
- [x] Implementar gestión de terminales de caja por sucursal.
- [x] Implementar dependency de seguridad `enforce_sucursal_scope` con rechazo HTTP 403 Forbidden.

### Fase 3: Frontend y Sincronización Reactiva
- [x] Store global persistente `useSucursalStore` (`quantix-sucursal-storage`).
- [x] Selector interactivo de sucursales en Header para `DIRECTOR` con opción de consolidado.
- [x] Bloqueo con candado visual fijo para `SUPERVISOR`, `CAJERO` y `BODEGUERO`.
- [x] Suscripción reactiva en todas las vistas (`POS`, `Inventario`, `Clientes`, `Tactico`, `Analisis`, `Dashboard`).

### Fase 4: Pruebas y Verificación
- [x] Pruebas unitarias de aislamiento y reactividad de tiendas.
- [x] Validación de rechazo HTTP 403 ante accesos cruzados no autorizados.
