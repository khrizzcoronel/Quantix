# Tareas de Implementación: 006 - Caja, Mermas y Detección de Fraude

**Módulo:** 006-caja-mermas-fraude  
**Regla:** Las tareas deben completarse en estricto orden de dependencias. Cada tarea completada debe marcarse con `[x]` y contar con un test asociado.

---

## Bloque 1: Persistencia (Pre-requisito para todo el módulo)
- [ ] **TASK-006-01:** Implementar endpoint `POST /api/v1/caja/sesiones/abrir` — crea la sesión de caja con `cajero_usuario_id`, `terminal_id` y `fondo_inicial`; valida que no exista otra sesión `ABIERTA` en la misma terminal.

## Bloque 2: Ciclo de Arqueo
- [ ] **TASK-006-02:** Implementar endpoint `POST /api/v1/caja/sesiones/{id}/arqueo-ciego` — recibe `efectivo_contado` y `comprobantes_tarjeta`, calcula `total_teorico` sumando las ventas de la sesión, persiste el arqueo y cierra la sesión.
- [ ] **TASK-006-03:** Implementar `DiscrepanciaArqueoService.evaluar(arqueo_id)` — calcula la diferencia, compara contra `caja_tolerancia_descuadre` de `CONFIGURACION` y, si `abs(diferencia) > tolerancia`, registra el evento en `auditoria_eventos` y dispara la notificación al Supervisor.

## Bloque 3: Auditoría y Reporting
- [ ] **TASK-006-04:** Implementar endpoint `GET /api/v1/admin/caja/auditoria` — devuelve eventos de auditoría filtrable por `cajero_usuario_id`, `tipo_evento`, `fecha_desde` y `fecha_hasta`; paginado con cursor.
- [ ] **TASK-006-05:** Implementar ETL nocturno en DuckDB para `FACT_ARQUEOS_MERMA` — carga los arqueos cerrados del día con sus diferencias y metadatos de cajero.

## Bloque 4: Frontend
- [ ] **TASK-006-06:** Crear componente React `ArqueoView.tsx` — pantalla de arqueo ciego que solo expone los campos `efectivo_contado` y `comprobantes_tarjeta`; oculta el total teórico hasta la confirmación para garantizar la independencia del conteo.
- [ ] **TASK-006-07:** Crear componente React `DashboardMermasView.tsx` — tabla de sesiones recientes con columna `diferencia` coloreada por semáforo (verde/amarillo/rojo según múltiplos de la tolerancia configurada).
