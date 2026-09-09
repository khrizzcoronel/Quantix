import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

export interface SesionCajaActiva {
  id: string;
  usuario_id: string;
  terminal_id: string;
  fecha_apertura: string;
  fondo_inicial: number;
  estado: string;
}

export interface ResultadoArqueo {
  sesion_caja_id: string;
  total_teorico: number;
  total_fisico_declarado: number;
  diferencia: number;
  estado: string; // OK, SOBRANTE, FALTANTE
  requiere_auditoria: boolean;
  mensaje: string;
}

interface CajaState {
  sesionActiva: SesionCajaActiva | null;
  estaAbierta: boolean;
  recuperarSesionActiva: () => Promise<void>;
  abrirCaja: (fondoInicial: number, terminalId: string) => Promise<void>;
  realizarArqueoCiego: (conteo: { efectivo: number; tarjeta: number; transferencia: number; otros: number }) => Promise<ResultadoArqueo>;
  cerrarSesionLocal: () => void;
}

export const useCajaStore = create<CajaState>()(
  persist(
    (set) => ({
      sesionActiva: null,
      estaAbierta: false,

      recuperarSesionActiva: async () => {
        const response = await api.get('/caja/sesion-activa');
        if (!response.data) {
          set({ sesionActiva: null, estaAbierta: false });
          return;
        }
        set({
          sesionActiva: {
            ...response.data,
            fondo_inicial: Number(response.data.fondo_inicial),
          },
          estaAbierta: true,
        });
      },

      abrirCaja: async (fondoInicial: number, terminalId: string) => {
        try {
          const response = await api.post('/caja/abrir', {
            fondo_inicial: fondoInicial,
            terminal_id: terminalId,
          });
          set({ 
            sesionActiva: {
              ...response.data,
              fondo_inicial: Number(response.data.fondo_inicial)
            }, 
            estaAbierta: true 
          });
        } catch (error: any) {
          if (error.response?.data?.detail?.includes('ya tiene una sesión')) {
            const response = await api.get('/caja/sesion-activa');
            if (!response.data) throw error;
            set({
              sesionActiva: {
                ...response.data,
                fondo_inicial: Number(response.data.fondo_inicial),
              },
              estaAbierta: true,
            });
          } else {
            throw error;
          }
        }
      },

      realizarArqueoCiego: async (conteo) => {
        const response = await api.post('/caja/arqueo-ciego', {
          conteo_declarado: conteo,
        });
        const resultado: ResultadoArqueo = {
          ...response.data,
          total_teorico: Number(response.data.total_teorico),
          total_fisico_declarado: Number(response.data.total_fisico_declarado),
          diferencia: Number(response.data.diferencia),
        };
        set({ sesionActiva: null, estaAbierta: false });
        return resultado;
      },

      cerrarSesionLocal: () => {
        set({ sesionActiva: null, estaAbierta: false });
      },
    }),
    {
      name: 'quantix-caja-activa',
    }
  )
);
