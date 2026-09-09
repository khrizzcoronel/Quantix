/**
 * Store Zustand para Control de Conectividad e Histéresis Anti-Oscilación.
 * Administra los 3 estados operativos: ONLINE | OFFLINE_LISTO | OFFLINE_NO_DISPONIBLE,
 * la monitorización de salud con /health, conteo de cola y refresco de snapshots.
 */

import { create } from 'zustand';
import api from '../services/api';
import {
  esSnapshotValido,
  obtenerInfoSnapshot,
  actualizarCatalogoOffline,
  type SnapshotInfo
} from '../services/offline/snapshotService';
import { contarPendientes } from '../services/offline/queueService';
import { dispararSincronizacion } from '../services/offline/syncWorker';

export type ConnectivityStatus = 'ONLINE' | 'OFFLINE_LISTO' | 'OFFLINE_NO_DISPONIBLE';

interface ConnectivityStore {
  status: ConnectivityStatus;
  pendingSyncCount: number;
  latency: number | null;
  lastChecked: string | null;
  snapshotInfo: SnapshotInfo | null;
  isRefreshingSnapshot: boolean;
  consecutiveSuccesses: number;
  consecutiveFailures: number;

  // Acciones
  checkHealth: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
  refreshPendingCount: () => Promise<number>;
  refrescarSnapshot: () => Promise<boolean>;
  updateSnapshotInfo: () => Promise<void>;
}

let pollingIntervalId: ReturnType<typeof setInterval> | null = null;
let listenersRegistered = false;

export const useConnectivityStore = create<ConnectivityStore>((set, get) => ({
  status: 'ONLINE',
  pendingSyncCount: 0,
  latency: null,
  lastChecked: null,
  snapshotInfo: null,
  isRefreshingSnapshot: false,
  consecutiveSuccesses: 0,
  consecutiveFailures: 0,

  updateSnapshotInfo: async () => {
    try {
      const info = await obtenerInfoSnapshot();
      set({ snapshotInfo: info });
    } catch {
      // IndexedDB cerrado o no disponible
    }
  },

  refreshPendingCount: async () => {
    try {
      const count = await contarPendientes();
      set({ pendingSyncCount: count });
      return count;
    } catch {
      return 0;
    }
  },

  refrescarSnapshot: async () => {
    if (get().status !== 'ONLINE') {
      return false;
    }

    set({ isRefreshingSnapshot: true });
    try {
      const res = await api.get('/inventario/productos?activo_only=true');
      const count = await actualizarCatalogoOffline(res.data || []);
      const info = await obtenerInfoSnapshot();
      set({ snapshotInfo: info, isRefreshingSnapshot: false });
      return count > 0;
    } catch (err) {
      console.warn('Error al refrescar snapshot de catálogo desde backend:', err);
      set({ isRefreshingSnapshot: false });
      return false;
    }
  },

  checkHealth: async () => {
    const t0 = performance.now();
    let isHealthy = false;
    let lat: number | null = null;

    try {
      const rawUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
      const healthUrl = rawUrl.replace(/\/api\/v1\/?$/, '') + '/health';
      const res = await fetch(healthUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });

      if (res.ok) {
        lat = Math.round(performance.now() - t0);
        isHealthy = true;
      }
    } catch {
      isHealthy = false;
    }

    const {
      status: currentStatus,
      consecutiveSuccesses,
      consecutiveFailures
    } = get();

    const timestamp = new Date().toISOString();
    const pendingCount = await get().refreshPendingCount();

    if (isHealthy) {
      const nextSuccesses = consecutiveSuccesses + 1;
      const nextFailures = 0;

      // Regla de histéresis: requiere 2 éxitos consecutivos para pasar a ONLINE
      if (currentStatus !== 'ONLINE') {
        if (nextSuccesses >= 2) {
          set({
            status: 'ONLINE',
            latency: lat,
            lastChecked: timestamp,
            consecutiveSuccesses: nextSuccesses,
            consecutiveFailures: nextFailures
          });

          // Disparar worker FIFO para sincronizar ventas pendientes acumuladas
          if (pendingCount > 0) {
            dispararSincronizacion();
          }

          // Si no hay snapshot local o ya expiró, actualizarlo automáticamente al volver a ONLINE
          const valido = await esSnapshotValido();
          if (!valido) {
            void get().refrescarSnapshot();
          } else {
            void get().updateSnapshotInfo();
          }
        } else {
          set({
            latency: lat,
            lastChecked: timestamp,
            consecutiveSuccesses: nextSuccesses,
            consecutiveFailures: nextFailures
          });
        }
      } else {
        // Ya está ONLINE
        set({
          status: 'ONLINE',
          latency: lat,
          lastChecked: timestamp,
          consecutiveSuccesses: nextSuccesses,
          consecutiveFailures: nextFailures
        });

        if (pendingCount > 0) {
          dispararSincronizacion();
        }
      }
    } else {
      // Fallo en la comprobación
      const nextFailures = consecutiveFailures + 1;
      const nextSuccesses = 0;

      // Regla de histéresis: requiere 2 fallos consecutivos para pasar a offline
      if (currentStatus === 'ONLINE') {
        if (nextFailures >= 2) {
          const snapshotValido = await esSnapshotValido();
          const info = await obtenerInfoSnapshot();
          const newStatus: ConnectivityStatus = snapshotValido
            ? 'OFFLINE_LISTO'
            : 'OFFLINE_NO_DISPONIBLE';

          set({
            status: newStatus,
            latency: null,
            lastChecked: timestamp,
            snapshotInfo: info,
            consecutiveSuccesses: nextSuccesses,
            consecutiveFailures: nextFailures
          });
        } else {
          set({
            latency: null,
            lastChecked: timestamp,
            consecutiveSuccesses: nextSuccesses,
            consecutiveFailures: nextFailures
          });
        }
      } else {
        // Si ya está en modo offline, actualizar diagnóstico si el snapshot expiró mientras estaba desconectado
        const snapshotValido = await esSnapshotValido();
        const info = await obtenerInfoSnapshot();
        const newStatus: ConnectivityStatus = snapshotValido
          ? 'OFFLINE_LISTO'
          : 'OFFLINE_NO_DISPONIBLE';

        set({
          status: newStatus,
          latency: null,
          lastChecked: timestamp,
          snapshotInfo: info,
          consecutiveSuccesses: nextSuccesses,
          consecutiveFailures: nextFailures
        });
      }
    }
  },

  startPolling: () => {
    if (pollingIntervalId) return;

    // Registrar listeners globales de red y eventos de sincronización una sola vez
    if (!listenersRegistered && typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        void get().checkHealth();
      });

      window.addEventListener('offline', () => {
        void get().checkHealth();
      });

      window.addEventListener('quantix:sync-updated', () => {
        void get().refreshPendingCount();
      });

      listenersRegistered = true;
    }

    // Comprobación inicial inmediata
    void get().checkHealth();
    void get().updateSnapshotInfo();

    // Polling cada 12 segundos
    pollingIntervalId = setInterval(() => {
      void get().checkHealth();
    }, 12000);
  },

  stopPolling: () => {
    if (pollingIntervalId) {
      clearInterval(pollingIntervalId);
      pollingIntervalId = null;
    }
  }
}));
