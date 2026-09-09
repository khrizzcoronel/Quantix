# Tareas de Implementación: 008 - Operación Offline-First y Sincronización

**Módulo:** 008-offline-sync  

---

## Bloque 1: Monitoreo de Red & Backend de Sincronización
- [x] **TASK-008-01:** Endpoint `GET /health` disponible. Falta certificar por benchmark el objetivo < 20 ms.
- [ ] **TASK-008-02:** Implementar endpoint `POST /api/v1/sync/ventas-offline` que procesa lotes de ventas locales.
- [ ] **TASK-008-03:** Implementar servicio de resolución de conflictos FEFO en backend (marca como `PENDIENTE_REVISION` si no hay stock suficiente).
- [ ] **TASK-008-04:** Endpoint `GET /api/v1/sync/conflictos` para listar incidencias de ventas offline para supervisión.

## Bloque 2: Cliente Local SQLite / Frontend POS
- [ ] **TASK-008-05:** Configurar IndexedDB versionada en el frontend para catálogo, ventas, cola y metadata.
- [ ] **TASK-008-06:** Implementar `ConnectivityService` en frontend (polling cada 5 segundos con timeout de 2s).
- [ ] **TASK-008-07:** Implementar modo degradado en POS: al perder red, solo permite efectivo y usa `productos_cache`.
- [ ] **TASK-008-08:** Implementar cola FIFO de sincronización que dispara el envío de ventas pendientes en cuanto el heartbeat responde HTTP 200.
- [ ] **TASK-008-09:** UI: Banner superior de conectividad (Verde: Online / Ámbar: Modo Offline con contador de ventas pendientes).
