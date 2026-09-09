import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

export interface User {
  id: string;
  email: string;
  nombre: string;
  rol: string;
  avatar?: string | null;
  telefono?: string | null;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  updateAvatar: (avatar: string) => void;
  updateProfile: (data: Partial<User>) => void;
}

// Función auxiliar para decodificar el payload del token JWT de forma segura
const decodeJwt = (token: string): { sub?: string; rol?: string } | null => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,

      login: async (email, password) => {
        const formData = new URLSearchParams();
        formData.append('username', email);
        formData.append('password', password);

        const response = await api.post('/auth/login', formData, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });

        const { access_token, user: apiUser } = response.data;

        // Si el backend envió el usuario completo, lo usamos.
        // Como respaldo infalible, extraemos el rol directamente de los claims del JWT firmado.
        let resolvedUser: User;
        if (apiUser && apiUser.rol) {
          resolvedUser = apiUser;
        } else {
          const payload = decodeJwt(access_token);
          resolvedUser = {
            id: payload?.sub || 'user-id',
            email: email,
            nombre: email.split('@')[0],
            rol: payload?.rol || 'CAJERO',
          };
        }

        set({ token: access_token, user: resolvedUser, isAuthenticated: true });
        return resolvedUser;
      },

      logout: () => {
        set({ token: null, user: null, isAuthenticated: false });
        localStorage.removeItem('quantix-caja-activa');
      },

      updateAvatar: (avatar: string) => {
        const currentUser = get().user;
        if (currentUser) {
          set({ user: { ...currentUser, avatar } });
        }
      },

      updateProfile: (data: Partial<User>) => {
        const currentUser = get().user;
        if (currentUser) {
          set({ user: { ...currentUser, ...data } });
        }
      },
    }),
    {
      name: 'quantix-auth-storage',
    }
  )
);
