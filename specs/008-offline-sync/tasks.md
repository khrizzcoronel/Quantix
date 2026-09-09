# Tareas de Implementación: 008 - Operación Offline-First y Sincronización

**Módulo:** 008-offline-sync  
**Estado General:** COMPLETADO  
**Cobertura:** 100% de criterios de aceptación verificados mediante pruebas automatizadas y compilación limpia.

---

## Bloque 1: Monitoreo de Red & Backend de Sincronización

- [x] **TASK-008-01: Heartbeat `GET /health` en la raíz.**
  - **Descripción:** Endpoint liviano sin middleware pesado para comprobación periódica de conectividad y medición de latencia en tiempo real desde terminales POS.
  - **Archivos implementados:**
    - `backend/app/main.py` (definición del endpoint raíz `/health` retornando estado, timestamp y versión del sistema).
    - `frontend/src/store/connectivityStore.ts` (polling activo cada 5 segundos con timeout de 3s y medición de latencia en milisegundos).

- [x] **TASK-008-02: Endpoint `POST /api/v1/sync/ventas-offline` procesando lotes FIFO transaccionales con savepoints.**
  - **Descripción:** Recepción y procesamiento en lote de ventas locales generadas durante contingencias offline. Procesamiento secuencial FIFO con aislamiento por `begin_nested()` (savepoint por venta) para evitar que un fallo revierta ventas válidas previas. Idempotencia estricta soportada por la restricción única `uq_ventas_offline_id_local`.
  - **Archivos implementados:**
    - `backend/app/api/sync.py` (controlador `sincronizar_ventas_offline` con bucle transaccional por venta).
    - `backend/app/schemas/sync.py` (esquemas `LoteSyncVentasRequest`, `VentaOfflineSyncItem`, `SyncLoteResponse`, `ResultadoVentaSyncItem`).
    - `backend/app/models/sync.py` (modelo `VentaOfflineRecibida` con clave idempotente `id_local`, auditoría de terminal, sesión y payload original).
    - `backend/alembic/versions/0004_offline_sync.py` (migración Alembic para tablas `ventas_offline_recibidas` e `incidencias_sync`).
    - `tests/integration/api/test_api_sync_offline.py` (`test_sync_venta_offline_exitosa`, `test_sync_venta_offline_idempotencia`, `test_sync_venta_offline_sesion_invalida`).

- [x] **TASK-008-03: Servicio de resolución de conflictos FEFO en backend.**
  - **Descripción:** Motor determinista de asignación de inventario en servidor que reutiliza la estrategia FEFO (First Expired, First Out). NUNCA genera stock negativo ni lotes artificiales. En caso de stock agotado o caducidad durante la desconexión, marca la venta como `PENDIENTE_REVISION`, crea una `IncidenciaSync` de tipo `STOCK_INSUFICIENTE` y no registra la venta en la tabla central `ventas` hasta resolución del supervisor. Recalcula precios de catálogo vigentes e impuestos (16% IVA) sin confiar en cálculos del cliente.
  - **Archivos implementados:**
    - `backend/app/api/sync.py` (motor FEFO de asignación de lotes activos no vencidos, recálculo financiero con `ROUND_HALF_UP` y generación de incidencias).
    - `backend/app/models/sync.py` (modelo `IncidenciaSync` con clave foránea a `ventas_offline_recibidas`).
    - `backend/app/models/ventas.py` (integración con `Venta`, `DetalleVenta` y `PagoVenta` en `EFECTIVO`).
    - `tests/integration/api/test_api_sync_offline.py` (`test_sync_venta_offline_conflicto_stock`).

- [x] **TASK-008-04: Endpoint `GET /api/v1/sync/conflictos` y `POST /api/v1/sync/conflictos/{id}/resolver` para supervisión auditada.**
  - **Descripción:** Endpoints protegidos por control de acceso basado en roles (`SUPERVISOR`, `DIRECTOR`) para auditar, consultar y resolver discrepancias de sincronización. Registro de auditoría con `resuelto_por`, `resuelto_en` y `nota_resolucion`.
  - **Archivos implementados:**
    - `backend/app/api/sync.py` (endpoints `listar_conflictos` con filtro `solo_pendientes` y `resolver_conflicto` auditado).
    - `backend/app/schemas/sync.py` (esquemas `IncidenciaSyncResponse` y `ResolverIncidenciaRequest`).
    - `tests/integration/api/test_api_sync_offline.py` (`test_sync_listar_y_resolver_conflictos`).

---

## Bloque 2: Cliente Local IndexedDB / Frontend POS

- [x] **TASK-008-05: IndexedDB `quantix_offline_db` v1 en frontend.**
  - **Descripción:** Capa de almacenamiento local estructurado en navegador basada en la API nativa de IndexedDB (sin dependencias externas pesadas ni SQLite web). Define 4 object stores (`catalogo`, `ventas`, `cola_sync`, `metadata`) con índices secundarios para consultas eficientes y transacciones ACID locales.
  - **Archivos implementados:**
    - `frontend/src/services/offline/db.ts` (apertura de BD versionada v1, definición de interfaces TypeScript, creación de stores e índices, operaciones tipadas con promesas).
    - `frontend/src/services/offline/snapshotService.ts` (gestión del catálogo local offline, cálculo de antigüedad y validez del snapshot con TTL configurable de 24h).
    - `frontend/src/services/offline/queueService.ts` (persistencia atómica de ventas en `ventas` y `cola_sync`).

- [x] **TASK-008-06: `connectivityStore` con histéresis anti-oscilación en frontend.**
  - **Descripción:** Store global en Zustand que gobierna los tres estados del sistema (`ONLINE`, `OFFLINE_LISTO`, `OFFLINE_NO_DISPONIBLE`). Implementa histéresis con contadores de confirmación para evitar flapping (2 fallos consecutivos para declarar desconexión, 2 éxitos consecutivos para declarar reconexión). Monitorea eventos `online`/`offline` de la ventana y sincroniza en segundo plano.
  - **Archivos implementados:**
    - `frontend/src/store/connectivityStore.ts` (máquina de estados de conectividad, histéresis 2-fallos/2-éxitos, auto-refresco de snapshot y disparador de sincronización).

- [x] **TASK-008-07: Modo degradado en POS: solo efectivo, búsqueda local en IndexedDB y comprobante offline explícito.**
  - **Descripción:** Adaptación reactiva de la terminal de punto de venta ante cortes de red. Deshabilita métodos electrónicos (tarjetas, transferencias, QR), restringe el cobro estrictamente a `EFECTIVO`, realiza búsqueda instantánea sobre el almacén local `catalogo`, persiste la venta atómicamente en IndexedDB y emite comprobante térmico con leyenda explícita `COMPROBANTE OFFLINE / PENDIENTE DE SINCRONIZACIÓN`, utilizando `ID LOCAL` (UUID) en lugar de inventar folios fiscales centrales.
  - **Archivos implementados:**
    - `frontend/src/pages/POS.tsx` (detección de `connectivityStatus`, carga de catálogo local, bloqueo de pagos no-efectivo, transacción de guardado offline y generación de ticket).
    - `frontend/src/components/TicketModal.tsx` (diseño e impresión de ticket térmico 80mm con leyendas offline explícitas y advertencias visuales).
    - `frontend/src/services/offline/queueService.ts` (función `guardarVentaOffline` transaccional).

- [x] **TASK-008-08: Cola FIFO de sincronización con Web Locks API y backoff exponencial con jitter.**
  - **Descripción:** Worker de sincronización en segundo plano con control de concurrencia multi-pestaña mediante Web Locks API (`quantix_sync_lock`). Envía lotes en orden secuencial por `creado_en`. Procesa respuestas del servidor (`SINCRONIZADA`, `YA_PROCESADA`, `PENDIENTE_REVISION`, `RECHAZADA`), actualizando los almacenes locales. En caso de fallos de red o errores HTTP 5xx, reintenta con backoff exponencial y jitter aleatorio (hasta 60s); suspende reintentos continuos ante errores funcionales HTTP 4xx.
  - **Archivos implementados:**
    - `frontend/src/services/offline/syncWorker.ts` (implementación de `procesarColaSync`, `ejecutarConLock` con Web Locks API, algoritmo de backoff con jitter y despacho de eventos custom).
    - `frontend/src/services/offline/queueService.ts` (`obtenerColaPendiente`, `marcarVentaSincronizada`, `marcarVentaConflicto`, `contarPendientes`).

- [x] **TASK-008-09: Banner persistente superior en `Layout.tsx` con estados de conectividad.**
  - **Descripción:** Elemento visual global persistente que informa al cajero y supervisor el estado de conexión del sistema: Verde (`ONLINE` con ping en vivo), Ámbar (`OFFLINE_LISTO` con alerta de cobro solo efectivo, antigüedad del catálogo local, contador de ventas pendientes y botón de reintento), y Rojo (`OFFLINE_NO_DISPONIBLE` con cobro suspendido por ausencia de catálogo).
  - **Archivos implementados:**
    - `frontend/src/components/Layout.tsx` (píldora de estado en barra superior, banners de alerta ámbar y roja, contador de cola y botón de reintento).
    - `frontend/src/store/connectivityStore.ts` (exposición reactiva de `status`, `pendingSyncCount` y `snapshotInfo`).
