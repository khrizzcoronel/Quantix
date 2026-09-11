# Plan de Implementación: 015 - Transferencias de Inventario Inter-Sucursal

## Fases de Implementación

### Fase 1: Capa de Persistencia y Modelado
- [x] Migración Alembic `0008_multi_sucursal.py` creando las tablas `transferencia_inventario` y `detalle_transferencia`.
- [x] Definición del enum `EstadoTransferencia` (`SOLICITADA`, `EN_TRANSITO`, `RECIBIDA`, `CANCELADA`).
- [x] Modelos SQLAlchemy `TransferenciaInventario` y `DetalleTransferencia` en `app/models/sucursal.py`.

### Fase 2: Lógica de Negocio y Ciclo de Vida Logístico
- [x] Router `backend/app/api/transferencias.py` con operaciones de solicitud, despacho, recepción y cancelación.
- [x] Despacho custodiado: reserva inmediata y descuento de existencias en el lote FEFO origen (`EN_TRANSITO`).
- [x] Recepción física: creación automática de nuevo lote en destino con prefijo sanitario `TR-`, preservando vencimiento original y costo de reposición (`RECIBIDA`).
- [x] Reversión de stock: reintegro atómico de existencias al lote de origen si se cancela un traspaso en tránsito.

### Fase 3: Componentes de Frontend
- [x] Modal de solicitud de transferencias `TransferenciaModal.tsx` con selección de sucursal destino, buscador de productos y lotes FEFO disponibles.
- [x] Modal de trazabilidad y operaciones `TransferenciaDetalleModal.tsx` con botones de acción contextual según el estado del traspaso y rol del usuario.
- [x] Pestaña de Traspasos integrada en la vista principal de `Inventario.tsx`.

### Fase 4: Seguridad y Aislamiento RBAC
- [x] Validación de que bodegueros y supervisores solo puedan despachar o recibir envíos donde su sucursal sea el origen o destino.
- [x] Autorización global exclusiva para el rol `DIRECTOR`.
