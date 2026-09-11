# Checklist de Tareas: 015 - Transferencias de Inventario Inter-Sucursal

- [x] Crear migración Alembic `0008_multi_sucursal.py` con tablas de transferencias.
- [x] Definir modelos `TransferenciaInventario` y `DetalleTransferencia` en `app/models/sucursal.py`.
- [x] Implementar máquina de estados (`SOLICITADA` -> `EN_TRANSITO` -> `RECIBIDA` / `CANCELADA`).
- [x] Desarrollar endpoint de solicitud de transferencias con validación de stock origen.
- [x] Desarrollar endpoint de despacho con descuento de existencias en lote origen.
- [x] Desarrollar endpoint de recepción con creación automática de lote sanitario `TR-` en destino.
- [x] Desarrollar endpoint de cancelación con restitución atómica de existencias al lote origen.
- [x] Implementar modal de interfaz `TransferenciaModal.tsx` para solicitar envíos.
- [x] Implementar modal de interfaz `TransferenciaDetalleModal.tsx` con trazabilidad y botones de acción.
- [x] Integrar pestaña de Traspasos en `Inventario.tsx`.
- [x] Aplicar restricciones de seguridad RBAC para personal de sucursal origen/destino.
