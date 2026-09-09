# Plan de continuación para Antigravity

**Fecha de corte:** 2026-09-08  
**Objetivo inmediato:** implementar operación offline-first sin reintroducir datos simulados ni falsos resultados exitosos.

## 1. Estado verificado del repositorio

- Backend FastAPI + PostgreSQL; frontend React 19 + Vite.
- Checkout con FEFO, rechazo de lotes vencidos, promociones, cupones, IVA e idempotencia.
- Pasarela de pagos simulada con intentos persistentes y conciliación de timeouts.
- Migración actual: `0003_payment_attempts`; la base de desarrollo ya está en `0003`.
- REST y WebSocket requieren JWT; las rutas frontend también validan rol.
- No deben existir fallbacks de negocio inventados. Un fallo de API muestra error o estado vacío.
- Verificación vigente: **68 pruebas aprobadas**, lint sin advertencias y build Vite aprobado.
- El worktree contiene muchos cambios previos y nuevos sin commit. No descartar, resetear ni sobrescribir cambios ajenos.

## 2. Estimación

| Entrega | Tiempo estimado |
| :--- | :--- |
| MVP offline seguro: catálogo local, efectivo, cola y sincronización feliz | 3–5 días |
| Conflictos, supervisión, E2E y endurecimiento para operación real | 2–3 días adicionales |
| Total recomendado | 5–8 días de trabajo enfocado |

No reducir este alcance fabricando tickets cuando una llamada online falla. Una venta offline solo puede declararse exitosa cuando fue guardada durablemente en IndexedDB y contiene una clave idempotente.

## 3. Decisiones obligatorias

1. Usar **IndexedDB** en el navegador; no SQLite dentro del frontend web.
2. Offline admite exclusivamente `EFECTIVO`. TARJETA, QR y TRANSFERENCIA quedan deshabilitados.
3. Distinguir explícitamente:
   - `ONLINE`: backend saludable.
   - `OFFLINE_LISTO`: existe snapshot local vigente y almacenamiento disponible.
   - `OFFLINE_NO_DISPONIBLE`: no hay conexión o no existe snapshot válido; no permitir checkout.
4. No confiar en subtotal, precio, impuestos ni identidad enviados por el cliente al sincronizar. Conservarlos como evidencia, pero recalcular y comparar en servidor.
5. Toda venta local lleva UUID/idempotency key estable desde su creación hasta quedar sincronizada.
6. Procesar la cola FIFO, una venta por transacción. Un conflicto no debe revertir las ventas anteriores del lote.
7. No borrar ventas locales sincronizadas inmediatamente: conservarlas con estado y fecha de confirmación durante un periodo de retención.

## 4. Fases de implementación

### Fase A — Contratos y persistencia central (0.5–1 día)

- Crear modelos de sincronización: `VentaOfflineRecibida` e `IncidenciaSync` o equivalentes.
- Campos mínimos: `id_local`, `terminal_id`, `sesion_caja_id`, `usuario_id`, fecha local, fecha recepción, payload original, estado, venta central vinculada y motivo de conflicto.
- Restricción única sobre `id_local`; agregar migración Alembic `0004`.
- Implementar esquemas tipados. No usar `List[dict]` para el contrato offline.
- Corregir el contrato: el heartbeat existente es `GET /health`, no `/api/v1/health`.

### Fase B — API de sincronización (1–1.5 días)

- Crear `POST /api/v1/sync/ventas-offline` autenticado.
- Verificar que usuario, sesión y terminal del payload correspondan al JWT y a la sesión autorizada.
- Reutilizar/extractar el motor FEFO del checkout; evitar mantener dos algoritmos divergentes.
- Respuesta individual por venta: `SINCRONIZADA`, `YA_PROCESADA`, `PENDIENTE_REVISION` o `RECHAZADA`.
- Si no hay stock, persistir incidencia y auditoría. No crear stock negativo.
- Crear `GET /api/v1/sync/conflictos` para Supervisor/Director y endpoint de resolución auditada.
- Probar reenvío del mismo UUID y concurrencia: debe existir una sola venta central.

### Fase C — IndexedDB y snapshot (1 día)

- Crear una capa en `frontend/src/services/offline/` con versión de esquema.
- Almacenes recomendados: `catalogo`, `ventas`, `cola_sync` y `metadata`.
- Snapshot solo con productos activos, precio vigente, identificadores, SKU/código de barras y stock informativo.
- Registrar `snapshot_at` y expiración configurable. Sin snapshot válido, bloquear venta offline.
- No precargar ejemplos, productos o clientes ficticios.

### Fase D — Estado de conectividad y POS degradado (0.5–1 día)

- Extraer el health polling actualmente ubicado en `Layout.tsx` a un store/servicio compartido.
- Considerar offline después de dos fallos consecutivos; requerir dos respuestas exitosas para volver a online y evitar oscilaciones.
- Mostrar banner persistente, antigüedad del snapshot y cantidad pendiente.
- En POS offline: búsqueda desde IndexedDB, efectivo solamente, sin CRM/cupones remotos ni promociones no incluidas en snapshot.
- Al finalizar, guardar venta + detalle + entrada de cola en una sola transacción IndexedDB antes de mostrar comprobante offline.
- El comprobante debe decir `COMPROBANTE OFFLINE / PENDIENTE DE SINCRONIZACIÓN` y nunca usar un folio fiscal central inventado.

### Fase E — Worker FIFO y experiencia de conflictos (1 día)

- Un único worker por pestaña/origen; evitar sincronizaciones simultáneas con Web Locks API o lease en IndexedDB.
- Reintentos solo para errores de red/5xx con backoff y jitter. No reintentar 4xx funcionales automáticamente.
- Mantener claves idempotentes sin regenerarlas.
- Exponer progreso, último error y conflictos en UI de supervisión.

### Fase F — Pruebas y documentación (1–1.5 días)

- Unitarias de IndexedDB usando un adaptador inyectable/fake-indexeddb solo dentro de tests.
- Integración backend: feliz, duplicado, stock insuficiente, sesión ajena/cerrada y FIFO.
- E2E: perder conexión, vender efectivo, recargar navegador, reconectar y verificar una sola venta.
- Probar que pagos electrónicos y checkout sin snapshot están bloqueados offline.
- Actualizar `spec.md`, `tasks.md`, `contracts/api.yaml`, README y matriz de cobertura de acuerdo con lo realmente implementado.

## 5. Criterios de terminación

- Cero datos de negocio ficticios fuera de fixtures/seed/tests.
- Recargar o cerrar la pestaña no pierde una venta pendiente.
- Reenviar una venta N veces crea exactamente una venta central.
- No se registra stock negativo ni se consume un lote vencido.
- El pago electrónico es imposible en modo offline.
- Todo conflicto y resolución deja auditoría.
- `pytest`, `npm run lint` y `npm run build` terminan correctamente.
- Migraciones verificadas sobre base vacía y sobre una base en revisión `0003`.

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
