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
  abrirCaja: (fondoInicial: number, terminalId: string) => Promise<void>;
  realizarArqueoCiego: (conteo: { efectivo: number; tarjeta: number; transferencia: number; otros: number }) => Promise<ResultadoArqueo>;
  cerrarSesionLocal: () => void;
}

export const useCajaStore = create<CajaState>()(
  persist(
    (set, get) => ({
      sesionActiva: null,
      estaAbierta: false,

      abrirCaja: async (fondoInicial: number, terminalId: string) => {
        try {
          const response = await api.post('/caja/abrir', {
            fondo_inicial: fondoInicial,
            terminal_id: terminalId,
          });
          set({ sesionActiva: response.data, estaAbierta: true });
        } catch (error: any) {
          // Si el backend responde que ya tiene una abierta o si estamos en modo offline
          if (error.response?.data?.detail?.includes('ya tiene una sesión')) {
            // Asumimos sesión activa restaurada
            set({
              sesionActiva: {
                id: 'sesion-activa-recuperada',
                usuario_id: 'user-actual',
                terminal_id: terminalId,
                fecha_apertura: new Date().toISOString(),
                fondo_inicial: fondoInicial,
                estado: 'ABIERTA',
              },
              estaAbierta: true,
            });
          } else {
            throw error;
          }
        }
      },

      realizarArqueoCiego: async (conteo) => {
        try {
          const response = await api.post('/caja/arqueo-ciego', {
            conteo_declarado: conteo,
          });
          const resultado: ResultadoArqueo = response.data;
          set({ sesionActiva: null, estaAbierta: false });
          return resultado;
        } catch (error: any) {
          // Fallback de cálculo en memoria si el backend estuviera en mantenimiento
          const fondo = get().sesionActiva?.fondo_inicial || 0;
          const fisico = conteo.efectivo + conteo.tarjeta + conteo.transferencia + conteo.otros;
          const diferencia = fisico - fondo;
          const estado = Math.abs(diferencia) <= 5 ? 'OK' : diferencia > 5 ? 'SOBRANTE' : 'FALTANTE';
          const mockResultado: ResultadoArqueo = {
            sesion_caja_id: get().sesionActiva?.id || 'id-mock',
            total_teorico: fondo,
            total_fisico_declarado: fisico,
            diferencia,
            estado,
            requiere_auditoria: estado !== 'OK',
            mensaje: 'Arqueo procesado localmente',
          };
          set({ sesionActiva: null, estaAbierta: false });
          return mockResultado;
        }
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
