/**
 * Capa de Persistencia IndexedDB para Quantix Offline-First.
 * Base de datos 'quantix_offline_db', versión 1.
 * API nativa con promesas fuertemente tipadas y transacciones seguras.
 */

export const DB_NAME = 'quantix_offline_db';
export const DB_VERSION = 1;

export type StoreName = 'catalogo' | 'ventas' | 'cola_sync' | 'metadata';

export interface ProductoOffline {
  id: string;
  sku: string;
  nombre: string;
  precio_venta: number;
  codigo_barras?: string | null;
  stock_total?: number;
  categoria_nombre?: string | null;
  requiere_pesaje?: boolean;
  imagen?: string | null;
  activo?: boolean;
  actualizado_en?: string;
}

export interface ItemVentaOffline {
  producto_id: string;
  sku: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  lote_codigo?: string | null;
}

export type EstadoVentaOffline =
  | 'PENDIENTE_SYNC'
  | 'SINCRONIZADA'
  | 'PENDIENTE_REVISION'
  | 'RECHAZADA';

export interface VentaOffline {
  id_local: string; // UUID v4 estable
  sesion_caja_id: string;
  terminal_id: string;
  usuario_id?: string | null;
  cajero_nombre?: string;
  cliente_id?: string | null;
  cliente_nombre?: string | null;
  cliente_telefono?: string | null;
  fecha_hora: string; // ISO string
  creado_en: string; // ISO string
  subtotal: number;
  descuento: number;
  impuestos: number;
  total_pagar: number;
  metodo_pago: 'EFECTIVO';
  monto_recibido?: number;
  cambio?: number;
  codigo_cupon?: string | null;
  items: ItemVentaOffline[];
  estado: EstadoVentaOffline;
  sincronizado_en?: string | null;
  venta_id_central?: string | null;
  folio_ticket_central?: string | null;
  motivo_conflicto?: string | null;
}

export interface ColaSyncItem {
  id_local: string;
  creado_en: string;
  reintentos: number;
  ultimo_intento?: string | null;
  ultimo_error?: string | null;
  venta: VentaOffline;
}

export interface MetadataItem {
  clave: string;
  valor: unknown;
  actualizado_en: string;
}

let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Obtiene la instancia abierta de la base de datos IndexedDB.
 */
export function getDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const hasIndexedDB = typeof indexedDB !== 'undefined' || (typeof window !== 'undefined' && Boolean(window.indexedDB));
    if (!hasIndexedDB) {
      reject(new Error('IndexedDB no está soportado en este entorno.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Almacén: 'catalogo'
      if (!db.objectStoreNames.contains('catalogo')) {
        const storeCatalogo = db.createObjectStore('catalogo', { keyPath: 'id' });
        storeCatalogo.createIndex('sku', 'sku', { unique: false });
        storeCatalogo.createIndex('nombre', 'nombre', { unique: false });
      }

      // Almacén: 'ventas'
      if (!db.objectStoreNames.contains('ventas')) {
        const storeVentas = db.createObjectStore('ventas', { keyPath: 'id_local' });
        storeVentas.createIndex('estado', 'estado', { unique: false });
        storeVentas.createIndex('creado_en', 'creado_en', { unique: false });
      }

      // Almacén: 'cola_sync'
      if (!db.objectStoreNames.contains('cola_sync')) {
        const storeCola = db.createObjectStore('cola_sync', { keyPath: 'id_local' });
        storeCola.createIndex('creado_en', 'creado_en', { unique: false });
      }

      // Almacén: 'metadata'
      if (!db.objectStoreNames.contains('metadata')) {
        db.createObjectStore('metadata', { keyPath: 'clave' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      dbInstance.onclose = () => {
        dbInstance = null;
        dbPromise = null;
      };
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      dbPromise = null;
      reject((event.target as IDBOpenDBRequest).error);
    };

    request.onblocked = () => {
      console.warn('Apertura de IndexedDB bloqueada por otra pestaña.');
    };
  });

  return dbPromise;
}

/**
 * Operación get individual por clave primaria.
 */
export async function dbGet<T>(storeName: StoreName, key: IDBValidKey): Promise<T | undefined> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(key);

    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Operación getAll para obtener todos los registros o con rango/límite.
 */
export async function dbGetAll<T>(
  storeName: StoreName,
  query?: IDBValidKey | IDBKeyRange | null,
  count?: number
): Promise<T[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll(query ?? undefined, count);

    req.onsuccess = () => resolve((req.result || []) as T[]);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Operación getAll por índice específico.
 */
export async function dbGetAllFromIndex<T>(
  storeName: StoreName,
  indexName: string,
  query?: IDBValidKey | IDBKeyRange | null
): Promise<T[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const req = index.getAll(query ?? undefined);

    req.onsuccess = () => resolve((req.result || []) as T[]);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Guarda o actualiza un registro individual.
 */
export async function dbPut<T>(storeName: StoreName, value: T): Promise<IDBValidKey> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(value);

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Inserta o reemplaza un conjunto de registros de forma masiva en una sola transacción.
 */
export async function dbPutBulk<T>(storeName: StoreName, values: T[]): Promise<void> {
  if (values.length === 0) return;
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transacción abortada'));

    for (const val of values) {
      store.put(val);
    }
  });
}

/**
 * Elimina un registro por clave primaria.
 */
export async function dbDelete(storeName: StoreName, key: IDBValidKey): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(key);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Vacía completamente un almacén de objetos.
 */
export async function dbClearStore(storeName: StoreName): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.clear();

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Cuenta los elementos de un almacén.
 */
export async function dbCount(storeName: StoreName): Promise<number> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.count();

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Ejecuta una transacción personalizada y atómica sobre múltiples almacenes.
 */
export async function dbTransaction<T>(
  storeNames: StoreName[],
  mode: IDBTransactionMode,
  callback: (tx: IDBTransaction) => Promise<T> | T
): Promise<T> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, mode);
    let callbackResult: T;

    tx.oncomplete = () => resolve(callbackResult);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transacción abortada'));

    Promise.resolve()
      .then(() => callback(tx))
      .then((res) => {
        callbackResult = res;
      })
      .catch((err) => {
        try {
          tx.abort();
        } catch {}
        reject(err);
      });
  });
}
