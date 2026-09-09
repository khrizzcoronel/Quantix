import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useAuthStore } from '../store/authStore';

export type SeveridadAlerta = 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICO';

export interface NotificacionWS {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  severidad: SeveridadAlerta;
  timestamp: string;
  leida: boolean;
  payload?: any;
}

export interface EventoActividad {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  severidad: SeveridadAlerta;
  timestamp: string;
  payload?: any;
}

export type EstadoConexion = 'conectado' | 'conectando' | 'desconectado' | 'error';

interface NotificacionesState {
  notificaciones: NotificacionWS[];
  eventosEnVivo: EventoActividad[];
  estadoConexion: EstadoConexion;
  ultimoLatido: string | null;
  latenciaMs: number | null;
  
  // Acciones
  setEstadoConexion: (estado: EstadoConexion) => void;
  agregarNotificacion: (notif: Omit<NotificacionWS, 'leida'> & { leida?: boolean }) => void;
  agregarEventoEnVivo: (evento: EventoActividad) => void;
  marcarComoLeida: (id: string) => void;
  marcarTodasComoLeidas: () => void;
  eliminarNotificacion: (id: string) => void;
  limpiarNotificaciones: () => void;
  limpiarEventos: () => void;
  actualizarLatido: (latencia?: number) => void;
}

export const useNotificationStore = create<NotificacionesState>()(
  persist(
    (set) => ({
      notificaciones: [],
      eventosEnVivo: [],
      estadoConexion: 'desconectado',
      ultimoLatido: null,
      latenciaMs: null,

      setEstadoConexion: (estado) => set({ estadoConexion: estado }),

      agregarNotificacion: (notif) =>
        set((state) => {
          // Evitar duplicados por id
          if (state.notificaciones.some((n) => n.id === notif.id)) {
            return state;
          }
          const nueva: NotificacionWS = {
            ...notif,
            leida: notif.leida ?? false,
          };
          return {
            notificaciones: [nueva, ...state.notificaciones].slice(0, 100),
          };
        }),

      agregarEventoEnVivo: (evento) =>
        set((state) => {
          if (state.eventosEnVivo.some((e) => e.id === evento.id)) {
            return state;
          }
          return {
            eventosEnVivo: [evento, ...state.eventosEnVivo].slice(0, 80),
          };
        }),

      marcarComoLeida: (id) =>
        set((state) => ({
          notificaciones: state.notificaciones.map((n) =>
            n.id === id ? { ...n, leida: true } : n
          ),
        })),

      marcarTodasComoLeidas: () =>
        set((state) => ({
          notificaciones: state.notificaciones.map((n) => ({ ...n, leida: true })),
        })),

      eliminarNotificacion: (id) =>
        set((state) => ({
          notificaciones: state.notificaciones.filter((n) => n.id !== id),
        })),

      limpiarNotificaciones: () => set({ notificaciones: [] }),

      limpiarEventos: () => set({ eventosEnVivo: [] }),

      actualizarLatido: (latencia) =>
        set({
          ultimoLatido: new Date().toISOString(),
          latenciaMs: latencia !== undefined ? latencia : null,
        }),
    }),
    {
      name: 'quantix-notificaciones-storage-v2',
      partialize: (state) => ({
        notificaciones: state.notificaciones,
      }),
    }
  )
);

// Singleton de conexión WebSocket para evitar aperturas duplicadas
let globalSocket: WebSocket | null = null;
let pingIntervalId: any = null;
let reconnectTimeoutId: any = null;
let pingSentTime = 0;

export const useWebSocket = () => {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const {
    notificaciones,
    eventosEnVivo,
    estadoConexion,
    ultimoLatido,
    latenciaMs,
    setEstadoConexion,
    agregarNotificacion,
    agregarEventoEnVivo,
    marcarComoLeida,
    marcarTodasComoLeidas,
    eliminarNotificacion,
    limpiarNotificaciones,
    limpiarEventos,
    actualizarLatido,
  } = useNotificationStore();

  const getWsUrl = (jwtToken: string) => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
    let base = apiUrl.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');
    if (base.startsWith('http://')) {
      base = 'ws://' + base.slice(7);
    } else if (base.startsWith('https://')) {
      base = 'wss://' + base.slice(8);
    } else {
      const loc = window.location;
      const proto = loc.protocol === 'https:' ? 'wss:' : 'ws:';
      base = `${proto}//${loc.host}`;
    }
    return `${base}/ws/notificaciones/stream?token=${encodeURIComponent(jwtToken)}`;
  };

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    if (!isAuthenticated || !user || !token) {
      if (globalSocket) {
        globalSocket.close();
        globalSocket = null;
      }
      setEstadoConexion('desconectado');
      return;
    }

    const conectarWS = () => {
      if (globalSocket && (globalSocket.readyState === WebSocket.OPEN || globalSocket.readyState === WebSocket.CONNECTING)) {
        return;
      }

      setEstadoConexion('conectando');
      const wsUrl = getWsUrl(token);

      try {
        const socket = new WebSocket(wsUrl);
        globalSocket = socket;

        socket.onopen = () => {
          if (!isMountedRef.current) return;
          setEstadoConexion('conectado');
          actualizarLatido(12);

          // Configurar Heartbeat cada 25 segundos
          if (pingIntervalId) clearInterval(pingIntervalId);
          pingIntervalId = setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) {
              pingSentTime = performance.now();
              socket.send(JSON.stringify({ tipo: 'PING', timestamp: new Date().toISOString() }));
            }
          }, 25000);
        };

        socket.onmessage = (event) => {
          if (!isMountedRef.current) return;
          try {
            const data = JSON.parse(event.data);

            // Manejo de respuesta Heartbeat PONG
            if (data.tipo === 'PONG') {
              const latency = Math.round(performance.now() - pingSentTime);
              actualizarLatido(latency > 0 ? latency : 15);
              return;
            }

            // Normalizar mensaje recibido
            const id = data.id || `ws-${crypto.randomUUID()}`;
            const tipo = data.tipo || 'NOTIFICACION';
            const titulo = data.titulo || 'Notificación del Sistema';
            const mensaje = data.mensaje || '';
            const severidad: SeveridadAlerta = (data.severidad?.toUpperCase() as SeveridadAlerta) || 'INFO';
            const timestamp = data.timestamp || new Date().toISOString();
            const payload = data.payload || {};

            const item = {
              id,
              tipo,
              titulo,
              mensaje,
              severidad,
              timestamp,
              payload,
            };

            // Clasificar según tipo de evento
            const esEventoEnVivo = [
              'VENTA_REALIZADA',
              'TICKET_ANULADO',
              'ARQUEO_REALIZADO',
              'APERTURA_CAJA',
              'ALERTA_SANITARIA',
              'ETL_SYNC'
            ].includes(tipo);

            if (esEventoEnVivo) {
              agregarEventoEnVivo(item);
            }

            // Si es alerta crítica o notificación relevante, agregarlo al Notification Center
            const esNotificacion = [
              'ARQUEO_DESCUADRE',
              'ALERTA_FEFO',
              'ALERTA_SANITARIA',
              'ETL_ERROR',
              'ETL_SYNC',
              'ALERTA',
              'SISTEMA',
              'TICKET_ANULADO'
            ].includes(tipo) || severidad === 'CRITICO' || severidad === 'WARNING';

            if (esNotificacion) {
              agregarNotificacion(item);
            }
          } catch (err) {
            console.warn('Error al parsear mensaje WebSocket:', err);
          }
        };

        socket.onerror = () => {
          if (!isMountedRef.current) return;
          setEstadoConexion('error');
        };

        socket.onclose = () => {
          if (!isMountedRef.current) return;
          setEstadoConexion('desconectado');
          if (pingIntervalId) clearInterval(pingIntervalId);

          // Intentar reconectar automáticamente en 4 segundos
          if (reconnectTimeoutId) clearTimeout(reconnectTimeoutId);
          reconnectTimeoutId = setTimeout(() => {
            if (isMountedRef.current && useAuthStore.getState().isAuthenticated) {
              conectarWS();
            }
          }, 4000);
        };
      } catch {
        setEstadoConexion('desconectado');
      }
    };

    conectarWS();

    return () => {
      // No cerramos forzosamente si otros componentes están usando el singleton,
      // pero limpiamos timeouts
    };
  }, [
    token,
    isAuthenticated,
    user,
    setEstadoConexion,
    agregarEventoEnVivo,
    agregarNotificacion,
    actualizarLatido,
  ]);

  const enviarMensaje = (payload: any) => {
    if (globalSocket && globalSocket.readyState === WebSocket.OPEN) {
      globalSocket.send(typeof payload === 'string' ? payload : JSON.stringify(payload));
    }
  };

  const noLeidasCount = notificaciones.filter((n) => !n.leida).length;

  return {
    estadoConexion,
    estaConectado: estadoConexion === 'conectado',
    notificaciones,
    noLeidasCount,
    eventosEnVivo,
    ultimoLatido,
    latenciaMs,
    marcarComoLeida,
    marcarTodasComoLeidas,
    eliminarNotificacion,
    limpiarNotificaciones,
    limpiarEventos,
    agregarNotificacion,
    agregarEventoEnVivo,
    enviarMensaje,
  };
};
