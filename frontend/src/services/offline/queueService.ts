/**
 * Servicio de Cola de Sincronización FIFO y Persistencia de Ventas Offline.
 * Garantiza transacciones atómicas durables en IndexedDB antes de presentar comprobantes.
 */

import {
  dbTransaction,
  dbGetAll,
  dbCount,
  type VentaOffline,
  type ColaSyncItem,
  type ItemVentaOffline
} from './db';

export interface VentaOfflineInput {
  sesion_caja_id: string;
  sucursal_id?: string | null;
  terminal_id: string;
  usuario_id?: string | null;
  cajero_nombre?: string;
  cliente_id?: string | null;
  cliente_nombre?: string | null;
  cliente_telefono?: string | null;
  items: ItemVentaOffline[];
  subtotal: number;
  descuento?: number;
  impuestos?: number;
  total_pagar: number;
  monto_recibido?: number;
  cambio?: number;
  codigo_cupon?: string | null;
}

export interface SyncResultInfo {
  venta_id?: string | null;
  folio_ticket?: string | null;
}

/**
 * Guarda una venta offline en UNA SOLA transacción atómica de IndexedDB.
 * Inserta simultáneamente en 'ventas' (historial local) y en 'cola_sync' (cola de reenvío FIFO).
 */
export async function guardarVentaOffline(input: VentaOfflineInput): Promise<VentaOffline> {
  const id_local = crypto.randomUUID();
  const ahora = new Date().toISOString();

  const venta: VentaOffline = {
    id_local,
    sesion_caja_id: input.sesion_caja_id,
    sucursal_id: input.sucursal_id || null,
    terminal_id: input.terminal_id,
    usuario_id: input.usuario_id || null,
    cajero_nombre: input.cajero_nombre || 'Cajero en Turno',
    cliente_id: input.cliente_id || null,
    cliente_nombre: input.cliente_nombre || null,
    cliente_telefono: input.cliente_telefono || null,
    fecha_hora: ahora,
    creado_en: ahora,
    subtotal: input.subtotal,
    descuento: input.descuento || 0,
    impuestos: input.impuestos || 0,
    total_pagar: input.total_pagar,
    metodo_pago: 'EFECTIVO', // Offline admite EXCLUSIVAMENTE efectivo
    monto_recibido: input.monto_recibido ?? input.total_pagar,
    cambio: input.cambio ?? 0,
    codigo_cupon: input.codigo_cupon || null,
    items: input.items,
    estado: 'PENDIENTE_SYNC',
    sincronizado_en: null,
    venta_id_central: null,
    folio_ticket_central: null,
    motivo_conflicto: null
  };

  const colaItem: ColaSyncItem = {
    id_local,
    creado_en: ahora,
    reintentos: 0,
    ultimo_intento: null,
    ultimo_error: null,
    venta
  };

  await dbTransaction(['ventas', 'cola_sync'], 'readwrite', (tx) => {
    const storeVentas = tx.objectStore('ventas');
    const storeCola = tx.objectStore('cola_sync');
    storeVentas.put(venta);
    storeCola.put(colaItem);
  });

  return venta;
}

/**
 * Obtiene todos los elementos pendientes en 'cola_sync' ordenados por creado_en ASC (estricto FIFO).
 */
export async function obtenerColaPendiente(): Promise<ColaSyncItem[]> {
  const items = await dbGetAll<ColaSyncItem>('cola_sync');
  return items.sort((a, b) => {
    return new Date(a.creado_en).getTime() - new Date(b.creado_en).getTime();
  });
}

/**
 * Marca una venta como SINCRONIZADA en 'ventas' y la remueve de 'cola_sync'.
 */
export async function marcarVentaSincronizada(
  id_local: string,
  syncResult: SyncResultInfo
): Promise<void> {
  const ahora = new Date().toISOString();

  await dbTransaction(['ventas', 'cola_sync'], 'readwrite', (tx) => {
    const storeVentas = tx.objectStore('ventas');
    const storeCola = tx.objectStore('cola_sync');

    const getReq = storeVentas.get(id_local);
    getReq.onsuccess = () => {
      const venta = getReq.result as VentaOffline | undefined;
      if (venta) {
        venta.estado = 'SINCRONIZADA';
        venta.sincronizado_en = ahora;
        venta.venta_id_central = syncResult.venta_id || null;
        venta.folio_ticket_central = syncResult.folio_ticket || null;
        storeVentas.put(venta);
      }
      storeCola.delete(id_local);
    };
  });
}

/**
 * Marca una venta en conflicto ('PENDIENTE_REVISION' o 'RECHAZADA') y la retira de la cola activa.
 */
export async function marcarVentaConflicto(
  id_local: string,
  motivo: string,
  estado: 'PENDIENTE_REVISION' | 'RECHAZADA' = 'PENDIENTE_REVISION'
): Promise<void> {
  await dbTransaction(['ventas', 'cola_sync'], 'readwrite', (tx) => {
    const storeVentas = tx.objectStore('ventas');
    const storeCola = tx.objectStore('cola_sync');

    const getReq = storeVentas.get(id_local);
    getReq.onsuccess = () => {
      const venta = getReq.result as VentaOffline | undefined;
      if (venta) {
        venta.estado = estado;
        venta.motivo_conflicto = motivo;
        storeVentas.put(venta);
      }
      // Retirar de la cola de reintentos continuos para evitar bloqueos en bucle
      storeCola.delete(id_local);
    };
  });
}

/**
 * Retorna la cantidad de ventas pendientes en 'cola_sync'.
 */
export async function contarPendientes(): Promise<number> {
  return dbCount('cola_sync');
}

/**
 * Retorna todas las ventas guardadas localmente en 'ventas'.
 */
export async function obtenerVentasLocales(): Promise<VentaOffline[]> {
  const ventas = await dbGetAll<VentaOffline>('ventas');
  return ventas.sort((a, b) => new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime());
}
