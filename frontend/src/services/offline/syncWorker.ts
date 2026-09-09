/**
 * Worker de Sincronización FIFO para Ventas Offline de Quantix.
 * Garantiza unicidad mediante Web Locks API (o fallback de lease),
 * envío secuencial ordenado por creado_en, y manejo robusto de respuestas y backoff con jitter.
 */

import api from '../api';
import {
  obtenerColaPendiente,
  marcarVentaSincronizada,
  marcarVentaConflicto,
  contarPendientes
} from './queueService';
import type { ColaSyncItem, ItemVentaOffline } from './db';
import { mostrarToast } from '../../hooks/useWebSocket';

export interface SyncWorkerStatus {
  isSyncing: boolean;
  ultimoError: string | null;
  ultimaSincronizacion: string | null;
  reintentosFallidos: number;
}

let isSyncingInMemory = false;
let retryTimeoutId: ReturnType<typeof setTimeout> | null = null;
let reintentosFallidos = 0;

export interface SyncResponseDetalle {
  id_local: string;
  estado: 'SINCRONIZADA' | 'YA_PROCESADA' | 'PENDIENTE_REVISION' | 'RECHAZADA';
  venta_id?: string | null;
  folio_ticket?: string | null;
  mensaje?: string;
}

export interface SyncResultadoResponse {
  procesadas: number;
  exitosas: number;
  conflictos: number;
  rechazadas?: number;
  detalles: SyncResponseDetalle[];
}

/**
 * Adquiere un lock exclusivo entre pestañas del navegador usando Web Locks API.
 * Si Web Locks no está disponible, utiliza una bandera en memoria como fallback seguro.
 */
async function ejecutarConLock(tarea: () => Promise<void>): Promise<void> {
  if (typeof navigator !== 'undefined' && 'locks' in navigator && navigator.locks?.request) {
    try {
      await navigator.locks.request('quantix_sync_lock', { ifAvailable: true }, async (lock) => {
        if (!lock) {
          // Otra pestaña ya está ejecutando la sincronización en este momento
          return;
        }
        await tarea();
      });
    } catch (err) {
      console.warn('Error al solicitar Web Lock para sincronización:', err);
      // Fallback si falla la llamada al lock
      if (!isSyncingInMemory) {
        isSyncingInMemory = true;
        try {
          await tarea();
        } finally {
          isSyncingInMemory = false;
        }
      }
    }
  } else {
    if (isSyncingInMemory) return;
    isSyncingInMemory = true;
    try {
      await tarea();
    } finally {
      isSyncingInMemory = false;
    }
  }
}

/**
 * Procesa la cola de ventas pendientes en estricto orden FIFO.
 */
export async function procesarColaSync(): Promise<void> {
  if (retryTimeoutId) {
    clearTimeout(retryTimeoutId);
    retryTimeoutId = null;
  }

  await ejecutarConLock(async () => {
    const pendientes: ColaSyncItem[] = await obtenerColaPendiente();
    if (pendientes.length === 0) {
      reintentosFallidos = 0;
      return;
    }

    // Preparar el lote en orden FIFO para envío
    const payloadVentas = pendientes.map((item) => ({
      id_local: item.venta.id_local,
      sesion_caja_id: item.venta.sesion_caja_id,
      terminal_id: item.venta.terminal_id,
      usuario_id: item.venta.usuario_id || null,
      fecha_hora: item.venta.fecha_hora,
      subtotal: item.venta.subtotal,
      descuento: item.venta.descuento || 0,
      impuestos: item.venta.impuestos || 0,
      total_pagar: item.venta.total_pagar,
      metodo_pago: item.venta.metodo_pago,
      monto_recibido: item.venta.monto_recibido,
      cambio: item.venta.cambio,
      codigo_cupon: item.venta.codigo_cupon,
      items: item.venta.items.map((it: ItemVentaOffline) => ({
        producto_id: it.producto_id,
        sku: it.sku,
        nombre: it.nombre,
        cantidad: it.cantidad,
        precio_unitario: it.precio_unitario,
        subtotal: it.subtotal,
        lote_codigo: it.lote_codigo || null
      }))
    }));

    try {
      const response = await api.post<SyncResultadoResponse>(
        '/sync/ventas-offline',
        { ventas: payloadVentas },
        { timeout: 15000 }
      );

      const data = response.data;
      if (data && Array.isArray(data.detalles)) {
        for (const detalle of data.detalles) {
          switch (detalle.estado) {
            case 'SINCRONIZADA':
            case 'YA_PROCESADA':
              await marcarVentaSincronizada(detalle.id_local, {
                venta_id: detalle.venta_id,
                folio_ticket: detalle.folio_ticket
              });
              break;

            case 'PENDIENTE_REVISION':
              await marcarVentaConflicto(
                detalle.id_local,
                detalle.mensaje || 'Conflicto de stock al reconciliar lote FEFO',
                'PENDIENTE_REVISION'
              );
              window.dispatchEvent(
                new CustomEvent('quantix:sync-conflict', {
                  detail: {
                    id_local: detalle.id_local,
                    motivo: detalle.mensaje || 'Conflicto detectado'
                  }
                })
              );
              break;

            case 'RECHAZADA':
              await marcarVentaConflicto(
                detalle.id_local,
                detalle.mensaje || 'Venta rechazada por el servidor central',
                'RECHAZADA'
              );
              window.dispatchEvent(
                new CustomEvent('quantix:sync-rejected', {
                  detail: {
                    id_local: detalle.id_local,
                    motivo: detalle.mensaje || 'Venta rechazada'
                  }
                })
              );
              break;
          }
        }
      }

      // Reiniciar contador de reintentos fallidos tras respuesta exitosa del backend
      reintentosFallidos = 0;

      if (data && data.exitosas > 0) {
        mostrarToast({
          titulo: 'Sincronización Offline Completada',
          mensaje: `Se sincronizaron exitosamente ${data.exitosas} ${data.exitosas === 1 ? 'venta offline' : 'ventas offline'} con el servidor central.`,
          severidad: 'SUCCESS',
        });
      }

      if (data && data.conflictos > 0) {
        mostrarToast({
          titulo: 'Conflicto de Sincronización',
          mensaje: `${data.conflictos} ${data.conflictos === 1 ? 'venta requiere' : 'ventas requieren'} revisión en el módulo de Operaciones.`,
          severidad: 'WARNING',
        });
      }

      // Notificar al sistema para actualizar contador de pendientes
      const restantes = await contarPendientes();
      window.dispatchEvent(
        new CustomEvent('quantix:sync-updated', {
          detail: { pendientes: restantes }
        })
      );
    } catch (error: any) {
      const status = error.response?.status;

      // 4xx Funcional (ej. 401 Unauthorized, 403 Forbidden)
      if (status && status >= 400 && status < 500) {
        console.error('Error funcional al sincronizar ventas offline:', status, error.response?.data);
        window.dispatchEvent(
          new CustomEvent('quantix:sync-auth-error', {
            detail: {
              status,
              mensaje:
                status === 401
                  ? 'Sesión no autorizada o expirada al sincronizar ventas offline.'
                  : 'Error de validación al sincronizar ventas offline.'
            }
          })
        );
        // Detener reintentos automáticos continuos ante errores 4xx
        return;
      }

      // Error de Red o 5xx del servidor -> Backoff exponencial con jitter
      reintentosFallidos++;
      const baseDelay = Math.min(60000, Math.pow(2, reintentosFallidos) * 1000);
      const jitter = Math.random() * 1000;
      const delay = Math.round(baseDelay + jitter);

      console.warn(
        `Fallo al sincronizar ventas offline (intento ${reintentosFallidos}). Reintentando en ${Math.round(delay / 1000)}s...`,
        error.message
      );

      retryTimeoutId = setTimeout(() => {
        void procesarColaSync();
      }, delay);
    }
  });
}

/**
 * Disparador público para iniciar la sincronización inmediatamente cuando la conexión se restablezca.
 */
export function dispararSincronizacion(): void {
  void procesarColaSync();
}
