import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

export interface Sucursal {
  id: string;
  codigo: string;
  nombre: string;
  direccion?: string | null;
  telefono?: string | null;
  es_matriz: boolean;
  activo: boolean;
  created_at?: string;
}

interface SucursalState {
  sucursales: Sucursal[];
  sucursalActual: Sucursal | null;
  cargando: boolean;
  error: string | null;
  cargarSucursales: () => Promise<void>;
  seleccionarSucursal: (sucursal: Sucursal) => void;
  seleccionarPorId: (id: string) => void;
}

import { useAuthStore } from './authStore';

export const MATRIZ_DEFAULT_ID = "00000000-0000-0000-0000-000000000001";

export const useSucursalStore = create<SucursalState>()(
  persist(
    (set, get) => ({
      sucursales: [],
      sucursalActual: null,
      cargando: false,
      error: null,

      cargarSucursales: async () => {
        set({ cargando: true, error: null });
        try {
          const res = await api.get('/sucursales');
          const lista: Sucursal[] = res.data || [];
          set({ sucursales: lista, cargando: false });

          const user = useAuthStore.getState().user;
          const isDirector = user?.rol === 'DIRECTOR';

          // Si el usuario no es Director y tiene sucursal asignada, fijarla estrictamente
          if (!isDirector && user?.sucursal_id) {
            const asignada = lista.find((s) => s.id === user.sucursal_id);
            if (asignada) {
              set({ sucursalActual: asignada });
              return;
            }
          }

          // Para Director o si no hay asignación fija: mantener la actual si existe o seleccionar la matriz
          const actual = get().sucursalActual;
          if (!actual || !lista.some((s) => s.id === actual.id)) {
            const matriz = lista.find((s) => s.es_matriz) || lista[0] || null;
            set({ sucursalActual: matriz });
          }
        } catch (err: any) {
          set({ error: err.response?.data?.detail || 'Error al cargar sucursales', cargando: false });
        }
      },

      seleccionarSucursal: (sucursal: Sucursal) => {
        const user = useAuthStore.getState().user;
        const isDirector = user?.rol === 'DIRECTOR';
        if (!isDirector && user?.sucursal_id) {
          return;
        }
        set({ sucursalActual: sucursal });
      },

      seleccionarPorId: (id: string) => {
        const user = useAuthStore.getState().user;
        const isDirector = user?.rol === 'DIRECTOR';
        if (!isDirector && user?.sucursal_id) {
          return;
        }
        const encontrada = get().sucursales.find((s) => s.id === id);
        if (encontrada) {
          set({ sucursalActual: encontrada });
        }
      },
    }),
    {
      name: 'quantix-sucursal-storage',
      partialize: (state) => ({
        sucursalActual: state.sucursalActual,
      }),
    }
  )
);
