import { describe, it, expect, beforeEach } from 'vitest';

// Mock simple de localStorage para el entorno de prueba
const storageMap: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => storageMap[key] || null,
  setItem: (key: string, value: string) => {
    storageMap[key] = String(value);
  },
  removeItem: (key: string) => {
    delete storageMap[key];
  },
  clear: () => {
    for (const key of Object.keys(storageMap)) {
      delete storageMap[key];
    }
  },
  length: 0,
  key: () => null,
};

Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
  configurable: true,
});

if (typeof window === 'undefined') {
  (globalThis as any).window = globalThis;
}

const { useNotificationStore, mostrarToast } = await import('../../hooks/useWebSocket');

describe('Toast Notification System (useNotificationStore & mostrarToast)', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    useNotificationStore.setState({
      notificaciones: [],
      eventosEnVivo: [],
      toasts: [],
      estadoConexion: 'desconectado',
      ultimoLatido: null,
      latenciaMs: null,
    });
  });

  it('debe agregar un toast con severidad, título, mensaje y duración por defecto', () => {
    mostrarToast({
      titulo: 'Operación Exitosa',
      mensaje: 'El producto fue creado correctamente',
      severidad: 'SUCCESS',
    });

    const state = useNotificationStore.getState();
    expect(state.toasts).toHaveLength(1);
    const toast = state.toasts[0];
    expect(toast.titulo).toBe('Operación Exitosa');
    expect(toast.mensaje).toBe('El producto fue creado correctamente');
    expect(toast.severidad).toBe('SUCCESS');
    expect(toast.duracionMs).toBe(5000);
    expect(toast.id).toBeDefined();
    expect(toast.timestamp).toBeDefined();
  });

  it('debe asignar 8000ms a alertas críticas y 5000ms a alertas estándar', () => {
    useNotificationStore.getState().agregarToast({
      titulo: 'Alerta Crítica',
      mensaje: 'Ruptura de stock detectada',
      severidad: 'CRITICO',
    });

    useNotificationStore.getState().agregarToast({
      titulo: 'Información',
      mensaje: 'Sincronización completa',
      severidad: 'INFO',
    });

    const state = useNotificationStore.getState();
    expect(state.toasts).toHaveLength(2);
    const toastInfo = state.toasts[0]; // Más reciente al frente
    const toastCritico = state.toasts[1];

    expect(toastCritico.duracionMs).toBe(8000);
    expect(toastInfo.duracionMs).toBe(5000);
  });

  it('debe limitar el número máximo de toasts concurrentes a 5 para evitar saturación de pantalla', () => {
    for (let i = 1; i <= 8; i++) {
      mostrarToast({
        id: `toast-${i}`,
        titulo: `Mensaje ${i}`,
        mensaje: `Detalle número ${i}`,
        severidad: 'INFO',
      });
    }

    const state = useNotificationStore.getState();
    expect(state.toasts).toHaveLength(5);
    // Deben ser los 5 más recientes (8, 7, 6, 5, 4)
    expect(state.toasts[0].id).toBe('toast-8');
    expect(state.toasts[4].id).toBe('toast-4');
  });

  it('debe descartar un toast específico por su id', () => {
    useNotificationStore.getState().agregarToast({
      id: 'toast-eliminar',
      titulo: 'Prueba Descarte',
      mensaje: 'Este toast se eliminará',
      severidad: 'WARNING',
    });
    useNotificationStore.getState().agregarToast({
      id: 'toast-permanece',
      titulo: 'Permanece',
      mensaje: 'Este toast continuará',
      severidad: 'SUCCESS',
    });

    expect(useNotificationStore.getState().toasts).toHaveLength(2);

    useNotificationStore.getState().descartarToast('toast-eliminar');

    const state = useNotificationStore.getState();
    expect(state.toasts).toHaveLength(1);
    expect(state.toasts[0].id).toBe('toast-permanece');
  });

  it('debe limpiar todos los toasts activos', () => {
    mostrarToast({ titulo: 'T1', mensaje: 'M1', severidad: 'INFO' });
    mostrarToast({ titulo: 'T2', mensaje: 'M2', severidad: 'SUCCESS' });
    mostrarToast({ titulo: 'T3', mensaje: 'M3', severidad: 'CRITICO' });

    expect(useNotificationStore.getState().toasts).toHaveLength(3);

    useNotificationStore.getState().limpiarToasts();

    expect(useNotificationStore.getState().toasts).toHaveLength(0);
  });

  it('agregarNotificacion debe emitir automáticamente un toast emergente salvo que se silencie', () => {
    // 1. Notificación normal genera toast
    useNotificationStore.getState().agregarNotificacion({
      id: 'notif-1',
      tipo: 'VENTA',
      titulo: 'Venta Realizada',
      mensaje: 'Folio #TK-1002 emitido',
      severidad: 'SUCCESS',
      timestamp: new Date().toISOString(),
    });

    let state = useNotificationStore.getState();
    expect(state.notificaciones).toHaveLength(1);
    expect(state.toasts).toHaveLength(1);
    expect(state.toasts[0].id).toBe('notif-1');
    expect(state.toasts[0].titulo).toBe('Venta Realizada');

    // 2. Notificación con silenciarToast = true NO genera toast emergente
    useNotificationStore.getState().agregarNotificacion({
      id: 'notif-silenciosa',
      tipo: 'BACKGROUND',
      titulo: 'Latido en Segundo Plano',
      mensaje: 'Verificación periódica OK',
      severidad: 'INFO',
      timestamp: new Date().toISOString(),
      silenciarToast: true,
    });

    state = useNotificationStore.getState();
    expect(state.notificaciones).toHaveLength(2);
    expect(state.toasts).toHaveLength(1); // Sigue teniendo solo 1 toast
  });

  it('no debe persistir los toasts efímeros en localStorage (solo persiste historial en campana)', () => {
    mostrarToast({
      titulo: 'Toast Volátil',
      mensaje: 'No debe almacenarse en localStorage',
      severidad: 'WARNING',
    });

    useNotificationStore.getState().agregarNotificacion({
      id: 'notif-persistente',
      tipo: 'INVENTARIO',
      titulo: 'Stock Crítico',
      mensaje: 'Harina sin stock',
      severidad: 'CRITICO',
      timestamp: new Date().toISOString(),
    });

    const storedRaw = localStorage.getItem('quantix-notificaciones-storage-v2');
    expect(storedRaw).toBeDefined();
    if (storedRaw) {
      const parsed = JSON.parse(storedRaw);
      expect(parsed.state?.notificaciones).toHaveLength(1);
      expect(parsed.state?.notificaciones[0].id).toBe('notif-persistente');
      // toasts NO debe estar presente en el almacenamiento serializado
      expect(parsed.state?.toasts).toBeUndefined();
    }
  });
});