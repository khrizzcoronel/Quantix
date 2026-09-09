# Modelo de Datos: 008 - Operación Offline-First y Sincronización

**Módulo:** 008-offline-sync  
**Ámbito:** Base de datos local del navegador (IndexedDB `quantix_offline_db` v1) y persistencia relacional central (PostgreSQL mediante SQLAlchemy y migración Alembic `0004`).

---

## 1. Persistencia Local en Frontend (IndexedDB)

La terminal de punto de venta utiliza la API nativa de **IndexedDB** (`quantix_offline_db`, versión 1) implementada en `frontend/src/services/offline/db.ts`. Se descartó SQLite Web / WASM para evitar sobrecarga de bundle (2–5 MB), retrasos de inicialización y problemas de compatibilidad en navegadores estándar.

### Almacenes de Objetos (Object Stores) e Índices

| Object Store | Clave Primaria (`keyPath`) | Índices Secundarios | Propósito |
| :--- | :--- | :--- | :--- |
| `catalogo` | `id` (string UUID) | `sku` (no único), `nombre` (no único) | Snapshot local de productos activos, precios vigentes y códigos de barras para búsqueda instantánea en modo offline. |
| `ventas` | `id_local` (UUID v4) | `estado` (no único), `creado_en` (no único) | Historial durable de ventas locales registradas durante contingencias de red. |
| `cola_sync` | `id_local` (UUID v4) | `creado_en` (no único) | Cola FIFO transaccional de transacciones pendientes de envío al backend central. |
| `metadata` | `clave` (string) | N/A | Almacén clave-valor para control del snapshot (`snapshot_info`), timestamps y métricas de sincronización. |

### Esquemas TypeScript de Persistencia Local

```typescript
// Almacén: catalogo
export interface ProductoOffline {
  id: string;                       // UUID del producto central
  sku: string;                      // Identificador de inventario
  nombre: string;                   // Nombre comercial
  precio_venta: number;             // Precio base de venta vigente
  codigo_barras?: string | null;    // Código EAN/UPC para escaneo
  stock_total?: number;             // Stock de referencia al momento del snapshot
  categoria_nombre?: string | null; // Clasificación del producto
  requiere_pesaje?: boolean;        // Indicador de pesaje en báscula
  imagen?: string | null;           // URL de imagen opcional
  activo?: boolean;                 // Estado activo en inventario
  actualizado_en?: string;          // Timestamp ISO del snapshot
}

// Almacén: ventas
export type EstadoVentaOffline =
  | 'PENDIENTE_SYNC'
  | 'SINCRONIZADA'
  | 'PENDIENTE_REVISION'
  | 'RECHAZADA';

export interface ItemVentaOffline {
  producto_id: string;
  sku: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  lote_codigo?: string | null;      // Informado en cliente; el backend reasigna FEFO
}

export interface VentaOffline {
  id_local: string;                 // UUID v4 generado en la terminal (idempotency key)
  sesion_caja_id: string;           // UUID de la sesión de caja activa
  terminal_id: string;              // Identificador de la terminal (ej. 'TERM-01')
  usuario_id?: string | null;       // UUID del cajero autenticado
  cajero_nombre?: string;           // Nombre para impresión del comprobante
  cliente_id?: string | null;       // UUID opcional de cliente CRM
  cliente_nombre?: string | null;   // Nombre opcional de cliente
  cliente_telefono?: string | null; // Teléfono opcional de cliente
  fecha_hora: string;               // ISO 8601 de captura en caja
  creado_en: string;                // ISO 8601 de guardado local
  subtotal: number;                 // Subtotal calculado en cliente (recalculado en servidor)
  descuento: number;                // Descuento local (generalmente 0 en contingencia)
  impuestos: number;                // IVA 16% calculado en cliente
  total_pagar: number;              // Total liquidado en efectivo
  metodo_pago: 'EFECTIVO';          // Exclusivo: el modo offline restringe a Efectivo
  monto_recibido?: number;          // Efectivo entregado por el cliente
  cambio?: number;                  // Cambio devuelto
  codigo_cupon?: string | null;     // Nulo en contingencia offline
  items: ItemVentaOffline[];        // Desglose de partidas vendidas
  estado: EstadoVentaOffline;       // Estado de sincronización
  sincronizado_en?: string | null;  // Timestamp de confirmación del backend
  venta_id_central?: string | null; // UUID asignado en tabla central 'ventas'
  folio_ticket_central?: string | null; // Folio 'TKT-...' emitido por el backend
  motivo_conflicto?: string | null; // Detalle de rechazo o conflicto de stock
}

// Almacén: cola_sync
export interface ColaSyncItem {
  id_local: string;                 // Clave primaria coincidente con VentaOffline
  creado_en: string;                // Timestamp para ordenamiento FIFO
  reintentos: number;               // Contador de reintentos fallidos
  ultimo_intento?: string | null;   // Timestamp de última tentativa
  ultimo_error?: string | null;     // Mensaje del último error de red o servidor
  venta: VentaOffline;              // Payload completo de la transacción
}

// Almacén: metadata
export interface MetadataItem {
  clave: string;                    // Identificador ('snapshot_info', 'ultimo_sync', etc.)
  valor: unknown;                   // Datos serializados
  actualizado_en: string;           // Timestamp de actualización
}
```

---

## 2. Persistencia Central en Backend (PostgreSQL & SQLAlchemy)

La persistencia de sincronización en el backend se implementa en `backend/app/models/sync.py` y se gestiona mediante la migración Alembic `0004_offline_sync.py` (que sucede a la revisión `0003`).

### 2.1 Modelo `VentaOfflineRecibida`

Almacena cada transacción offline recibida por la API, garantizando idempotencia estricta y trazabilidad forense del payload original transmitido por la terminal.

- **Tabla:** `ventas_offline_recibidas`
- **Constraint Única:** `uq_ventas_offline_id_local` sobre la columna `id_local`.

| Campo | Tipo SQLAlchemy | Tipo PostgreSQL | Nulable | Restricciones / Índices | Descripción |
| :--- | :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID(as_uuid=True)` | `UUID` | No | Primary Key, `default=uuid.uuid4` | Identificador único interno del registro. |
| `id_local` | `String(64)` | `VARCHAR(64)` | No | `unique=True`, `index=True`, `UQ` | UUID v4 generado en la terminal; clave de idempotencia. |
| `terminal_id` | `String(50)` | `VARCHAR(50)` | No | | Identificador físico o lógico de la terminal emisora. |
| `sesion_caja_id` | `UUID(as_uuid=True)` | `UUID` | No | `ForeignKey("sesion_caja.id")`, `index=True` | Sesión de caja abierta en la cual se efectuó la venta. |
| `usuario_id` | `UUID(as_uuid=True)` | `UUID` | No | `ForeignKey("usuario.id")`, `index=True` | Cajero que operó y firmó la transacción local. |
| `fecha_local` | `DateTime` | `TIMESTAMP` | No | | Fecha y hora de emisión del ticket en la terminal POS. |
| `fecha_recepcion` | `DateTime` | `TIMESTAMP` | No | `server_default=func.now()` | Fecha y hora de recepción en el servidor central. |
| `payload_original` | `JSON` | `JSON` | No | | Copia exacta del JSON transmitido por el cliente (evidencia auditada). |
| `estado` | `String(30)` | `VARCHAR(30)` | No | `index=True`, `default="SINCRONIZADA"` | Estado: `SINCRONIZADA`, `YA_PROCESADA`, `PENDIENTE_REVISION`, `RECHAZADA`. |
| `venta_id` | `UUID(as_uuid=True)` | `UUID` | Sí | `ForeignKey("ventas.id")`, `index=True` | Referencia a la venta central generada tras sincronización exitosa. |
| `motivo_conflicto` | `String(500)` | `VARCHAR(500)` | Sí | | Descripción textual del motivo de rechazo o revisión. |

**Relaciones SQLAlchemy:**
- `sesion_caja`: `relationship("SesionCaja")`
- `usuario`: `relationship("Usuario", foreign_keys=[usuario_id])`
- `venta`: `relationship("Venta", foreign_keys=[venta_id])`
- `incidencias`: `relationship("IncidenciaSync", back_populates="venta_offline", cascade="all, delete-orphan")`

---

### 2.2 Modelo `IncidenciaSync`

Registra discrepancias, quiebres de inventario o inconsistencias operativas detectadas al sincronizar una venta offline, permitiendo resolución auditada por supervisión.

- **Tabla:** `incidencias_sync`

| Campo | Tipo SQLAlchemy | Tipo PostgreSQL | Nulable | Restricciones / Índices | Descripción |
| :--- | :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID(as_uuid=True)` | `UUID` | No | Primary Key, `default=uuid.uuid4` | Identificador único de la incidencia. |
| `venta_offline_id` | `UUID(as_uuid=True)` | `UUID` | No | `ForeignKey("ventas_offline_recibidas.id")`, `index=True` | Venta offline asociada a la discrepancia. |
| `tipo` | `String(50)` | `VARCHAR(50)` | No | `index=True` | Tipo: `STOCK_INSUFICIENTE`, `PRECIO_DISCREPANTE`, `SESION_INVALIDA`, etc. |
| `detalle` | `Text` | `TEXT` | No | | Descripción detallada con SKU, cantidad solicitada y disponible. |
| `resuelto` | `Boolean` | `BOOLEAN` | No | `index=True`, `server_default=false` | Estado de atención de la incidencia. |
| `resuelto_por` | `UUID(as_uuid=True)` | `UUID` | Sí | `ForeignKey("usuario.id")` | Supervisor o Director que resolvió la incidencia. |
| `resuelto_en` | `DateTime` | `TIMESTAMP` | Sí | | Momento en que se registró la resolución. |
| `nota_resolucion` | `Text` | `TEXT` | Sí | | Justificación u orden de ajuste de inventario/merma. |
| `creado_en` | `DateTime` | `TIMESTAMP` | No | `server_default=func.now()` | Momento de detección de la incidencia. |

**Relaciones SQLAlchemy:**
- `venta_offline`: `relationship("VentaOfflineRecibida", back_populates="incidencias")`
- `usuario_resolutor`: `relationship("Usuario", foreign_keys=[resuelto_por])`

---

### 2.3 Vinculación con el Modelo Transaccional Central

Cuando una venta offline resulta `SINCRONIZADA`:
1. Se crea un registro en `ventas` con `idempotency_key = id_local`, `estado = EstadoVenta.PAGADO`, `total_bruto`, `total_impuestos` y `total_pagar` recalculados en servidor.
2. Se crean los registros correspondientes en `detalle_ventas` vinculando lotes vigentes de `lotes_inventario` mediante el algoritmo determinista FEFO.
3. Se crea un registro en `pagos_venta` con `metodo_pago = MetodoPago.EFECTIVO` por el importe total recalculado.
4. Se asigna un folio fiscal/comercial legítimo (`TKT-YYYYMMDD-XXXXXX`).
5. Se actualiza `VentaOfflineRecibida` enlazando `venta_id = nueva_venta.id` y `estado = "SINCRONIZADA"`.
6. Si hay stock insuficiente, **NUNCA** se crea stock negativo ni registro ficticio en `ventas`: se marca `PENDIENTE_REVISION` y se inserta la `IncidenciaSync` para intervención del Supervisor.

