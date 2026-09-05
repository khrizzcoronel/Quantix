# Tareas de Implementación: 005 - Promociones Inteligentes

**Módulo:** 005-promociones-inteligentes  
**Regla:** Las tareas deben completarse en estricto orden de dependencias. Cada tarea completada debe marcarse con `[x]` y contar con un test asociado.

---

## Bloque 1: Persistencia (Pre-requisito para todo el módulo)
- [ ] **TASK-005-01:** Crear modelo SQLAlchemy `ReglaPromocion` y migración Alembic para la tabla `reglas_promocion`, incluyendo todos los índices filtrados por `activo = TRUE`.

## Bloque 2: Lógica de Dominio — Motor de Promociones
- [ ] **TASK-005-02:** Implementar `MotorReglasPromocionService.evaluar(carrito_items)` — itera reglas activas y vigentes cuyo `producto_trigger_id` esté en el carrito y aplica el descuento sobre `producto_objetivo_id` si también está presente. Incluir tests unitarios con fixtures de combos múltiples.
- [ ] **TASK-005-03:** Implementar `ValidadorMargenTicketService.validar(carrito_con_descuentos)` — calcula `margen_total_ticket = Σ(precio_cobrado - costo_lote) × cantidad`; rechaza la operación con `ERR-PRO-01` si el resultado es negativo.

## Bloque 3: Liquidación FEFO
- [ ] **TASK-005-04:** Implementar `LiquidacionFEFOService.ejecutar()` — job periódico (cada hora, APScheduler) que detecta lotes con `fecha_vencimiento <= hoy + fefo_alerta_dias_1` y actualiza el precio de venta temporal del producto en caché; registra la liquidación en `AUDITORIA_EVENTO`.

## Bloque 4: CRUD de Reglas y Frontend
- [ ] **TASK-005-05:** Implementar CRUD de reglas de promoción (`GET`, `POST`, `PATCH`, `DELETE /api/v1/admin/promociones/reglas/`) — acceso restringido a roles `Supervisor` y `Director`.
- [ ] **TASK-005-06:** Crear componente React `GestionPromocionesView.tsx` — tabla de reglas con filtros de vigencia, botón de activar/desactivar y formulario de creación de nueva regla con selector de producto trigger y objetivo.
