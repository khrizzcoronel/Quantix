# Plan de continuación para Antigravity

**Fecha de corte:** 2026-09-09  
**Estado:** COMPLETADO (Módulo 008-offline-sync implementado y verificado integralmente)  
**Objetivo alcanzado:** operación offline-first determinista y segura sin datos simulados, con IndexedDB nativo, cobro exclusivo en efectivo, validación/FEFO en servidor y supervisión auditada.

## 1. Estado verificado del repositorio

- Backend FastAPI + PostgreSQL; frontend React 19 + Vite.
- Checkout con FEFO, rechazo de lotes vencidos, promociones, cupones, IVA e idempotencia.
- Pasarela de pagos simulada con intentos persistentes y conciliación de timeouts.
- Migración actual: `0004_offline_sync` (tablas `ventas_offline_recibidas` e `incidencias_sync`).
- REST y WebSocket requieren JWT; las rutas frontend también validan rol.
- Cero fallbacks o mocks de negocio inventados.
- Verificación vigente: **73 pruebas backend aprobadas (pytest)**, **0 advertencias y 0 errores en linter (oxlint)** y **build Vite aprobado (`tsc -b && vite build`)**.
- Arquitectura offline-first completada sin reintroducir dependencias pesadas ni violar la integridad contable.

## 2. Estimación vs. Realización

| Entrega | Estimado | Estado Real |
| :--- | :--- | :--- |
| MVP offline seguro: catálogo local, efectivo, cola y sincronización feliz | 3–5 días | **Completado y Verificado** |
| Conflictos, supervisión, E2E y endurecimiento para operación real | 2–3 días | **Completado y Verificado** |
| Total | 5–8 días | **Entregado al 100% con 73 tests automáticos** |

## 3. Decisiones obligatorias aplicadas

1. Usar **IndexedDB** en el navegador (`quantix_offline_db` v1); no SQLite dentro del frontend web.
2. Offline admite exclusivamente `EFECTIVO`. TARJETA, QR y TRANSFERENCIA quedan deshabilitados.
3. Distinción explícita de estados:
   - `ONLINE`: backend saludable (heartbeat HTTP 200 en `GET /health`).
   - `OFFLINE_LISTO`: snapshot local vigente (< 24h) y almacenamiento disponible en IndexedDB.
   - `OFFLINE_NO_DISPONIBLE`: sin conexión o snapshot caducado/inexistente; checkout bloqueado.
4. Autoridad de servidor: recálculo de precios, IVA 16% y asignación determinista FEFO de lotes. Cero stock negativo.
5. Clave idempotente única (`id_local` UUID v4) con constraint `uq_ventas_offline_id_local`.
6. Procesamiento de cola FIFO por savepoints transaccionales (`begin_nested()`).
7. Retención durable de ventas locales y comprobante explícito `COMPROBANTE OFFLINE / PENDIENTE DE SINCRONIZACIÓN`.

## 4. Fases de implementación completadas

### Fase A — Contratos y persistencia central [COMPLETADA]

- **Modelos SQLAlchemy:** `VentaOfflineRecibida` e `IncidenciaSync` en `backend/app/models/sync.py`.
- **Migración Alembic:** `0004_offline_sync.py` (Revises: `0003`) con tabla `ventas_offline_recibidas`, `incidencias_sync` y constraint única `uq_ventas_offline_id_local`.
- **Esquemas Pydantic:** `backend/app/schemas/sync.py` con tipado estricto (`LoteSyncVentasRequest`, `VentaOfflineSyncItem`, `SyncLoteResponse`, `ResultadoVentaSyncItem`, `IncidenciaSyncResponse`, `ResolverIncidenciaRequest`).
- **Heartbeat:** Verificado en `GET /health` en `backend/app/main.py`.

### Fase B — API de sincronización [COMPLETADA]

- **Endpoint de Sincronización:** `POST /api/v1/sync/ventas-offline` autenticado, procesando lotes FIFO con aislamiento por savepoint.
- **Validación de Sesión:** Verifica coincidencia de usuario autenticado y sesión de caja abierta.
- **Motor FEFO y Cero Stock Negativo:** Descuenta lotes activos más próximos a caducar. Si no hay stock disponible, marca `PENDIENTE_REVISION` y genera `IncidenciaSync` de tipo `STOCK_INSUFICIENTE` sin registrar venta central ficticia.
- **Idempotencia Estricta:** Reenvíos de una venta ya procesada devuelven `YA_PROCESADA` con su `venta_id` y `folio_ticket` sin descontar doble stock.
- **Supervisión de Incidencias:** Endpoints `GET /api/v1/sync/conflictos` y `POST /api/v1/sync/conflictos/{id}/resolver` restringidos a `SUPERVISOR` y `DIRECTOR` con auditoría completa.
- **Pruebas de Integración:** 5 tests automáticos en `tests/integration/api/test_api_sync_offline.py` pasando al 100%.

### Fase C — IndexedDB y snapshot [COMPLETADA]

- **Capa IndexedDB:** `frontend/src/services/offline/db.ts` con base `quantix_offline_db` v1 y almacenes `catalogo`, `ventas`, `cola_sync`, `metadata`.
- **Snapshot Service:** `frontend/src/services/offline/snapshotService.ts` con refresco automático de productos activos, TTL de 24h y cálculo de antigüedad.
- **Queue Service:** `frontend/src/services/offline/queueService.ts` para persistencia transaccional atómica de ventas locales y encolamiento.

### Fase D — Estado de conectividad y POS degradado [COMPLETADA]

- **Store de Conectividad:** `frontend/src/store/connectivityStore.ts` con histéresis anti-oscilación (2 fallos = offline, 2 éxitos = online), polling a `/health` y auto-sincronización al reconectar.
- **Modo POS Degradado:** `frontend/src/pages/POS.tsx` detecta estado offline, bloquea métodos electrónicos, restringe a cobro en efectivo y realiza búsqueda local en IndexedDB.
- **Comprobante Offline:** `frontend/src/components/TicketModal.tsx` emite comprobante térmico con leyenda explícita `COMPROBANTE OFFLINE / PENDIENTE DE SINCRONIZACIÓN`, exponiendo el `ID LOCAL` y previniendo folios fiscales falsos.

### Fase E — Worker FIFO y experiencia de conflictos [COMPLETADA]

- **Worker de Sincronización:** `frontend/src/services/offline/syncWorker.ts` coordinado mediante Web Locks API (`quantix_sync_lock`) para evitar concurrencia multi-pestaña.
- **Estrategia de Reintentos:** Backoff exponencial con jitter aleatorio (hasta 60s) para errores transitorios de red/5xx; detención de reintentos continuos ante errores 4xx.
- **UI Global:** Píldora de conectividad y banner persistente superior en `frontend/src/components/Layout.tsx` informando estados `ONLINE`, `OFFLINE_LISTO` y `OFFLINE_NO_DISPONIBLE`, con contador de pendientes y botón de reintento.

### Fase F — Pruebas y documentación [COMPLETADA]

- **Verificación Automatizada:** Suite completa de backend ejecutada exitosamente con 73 pruebas pasando (`pytest`).
- **Calidad de Código Frontend:** Linter `oxlint` ejecutado con 0 errores y 0 advertencias. Compilación TypeScript y empaquetado Vite (`tsc -b && vite build`) completados sin errores.
- **Documentación:** Actualizados `tasks.md`, `data-model.md`, `spec.md`, `analisis_cobertura_requerimientos.md` y `PLAN_CONTINUACION_ANTIGRAVITY.md`.

## 5. Criterios de terminación verificados

- [x] Cero datos de negocio ficticios fuera de fixtures/seed/tests.
- [x] Recargar o cerrar la pestaña no pierde una venta pendiente (persistida en IndexedDB).
- [x] Reenviar una venta N veces crea exactamente una venta central (idempotencia verificada).
- [x] No se registra stock negativo ni se consume un lote vencido (política FEFO estricta).
- [x] El pago electrónico es imposible en modo offline (deshabilitado forzosamente en UI y POS).
- [x] Todo conflicto y resolución deja auditoría (`IncidenciaSync` con `resuelto_por`, `resuelto_en`, `nota_resolucion`).
- [x] `pytest` (73 aprobadas), `npm run lint` (0 advertencias) y `npm run build` terminan correctamente.
- [x] Migraciones verificadas (`0004_offline_sync`).

## 6. Archivos de referencia

- `backend/app/api/pos.py`: checkout e idempotencia actuales.
- `backend/app/services/payment_attempts.py`: patrón de persistencia externa para estados inciertos.
- `backend/app/models/pagos.py`: intentos de pago.
- `frontend/src/pages/POS.tsx`: flujo POS actual.
- `frontend/src/components/Layout.tsx`: health polling que debe extraerse.
- `specs/008-offline-sync/`: especificación base; contiene aspiraciones, no implementación actual.
- `docs/requisitos/analisis_cobertura_requerimientos.md`: fuente de estado real.

## 7. Comandos de control

```powershell
docker compose up -d db
Push-Location backend
.\venv\Scripts\alembic.exe upgrade head
Pop-Location
.\backend\venv\Scripts\python.exe -m pytest -q
cd frontend
npm run lint
npm run build
```

Antes de entregar, ejecutar además una búsqueda de fallbacks y datos hardcodeados en `frontend/src`. No marcar tareas como completas solo porque estén documentadas.
