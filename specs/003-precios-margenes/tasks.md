# Tareas de Implementación: 003 - Precios y Márgenes

**Módulo:** 003-precios-margenes  
**Regla:** Las tareas deben completarse en estricto orden de dependencias. Cada tarea completada debe marcarse con `[x]` y contar con un test asociado.

---

## Bloque 1: Clasificación de Catálogo
- [ ] **TASK-003-01:** Implementar endpoint `PATCH /api/v1/productos/{id}/clasificacion` — actualiza el campo `tipo_estrategico` del producto; acceso restringido al rol `Director`; registra el cambio en `AUDITORIA_EVENTO`.

## Bloque 2: Alerta de Erosión de Margen
- [ ] **TASK-003-02:** Implementar `AlertaErosionMargenService` — al registrar una fila en `detalle_ordenes_compra`, valida si `costo_unitario_pactado > precio_venta * (1 - margen_minimo_pct / 100)`. Si se supera el umbral, emite notificación al rol `Supervisor` y registra en `AUDITORIA_EVENTO`.
- [ ] **TASK-003-03:** Implementar endpoint `GET /api/v1/admin/productos/en-riesgo-margen` — devuelve productos cuyo `costo_reposicion` ya supera el umbral de margen mínimo configurado.

## Bloque 3: Visualización Analítica
- [ ] **TASK-003-04:** Crear componente React `MatrizMargenRotacion.tsx` — `ScatterChart` de Recharts con eje X = rotación diaria y eje Y = `margen_bruto_pct`; coloreado por `tipo_estrategico`; tooltip con nombre del producto.
- [ ] **TASK-003-05:** Crear componente React `TablaProductosMargen.tsx` — tabla de productos con semáforo de margen: verde si `margen_bruto_pct >= margen_minimo_pct`, amarillo si entre 0 % y `margen_minimo_pct`, rojo si negativo.
