import { describe, it, expect, beforeEach } from 'vitest';

// Mock simple de localStorage y window para el entorno Node de Vitest
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

const { useAuthStore } = await import('../../store/authStore');
type User = import('../../store/authStore').User;

describe('Profile Update & Persistence in useAuthStore', () => {
  const initialUser: User = {
    id: 'user-uuid-1234',
    email: 'cajero@quantix.retail',
    nombre: 'Cajero Inicial',
    rol: 'CAJERO',
    avatar: null,
    telefono: null,
  };

  beforeEach(() => {
    // Limpiar storage y reiniciar store de auth
    mockLocalStorage.clear();
    useAuthStore.setState({
      token: 'jwt-dummy-token-xyz',
      user: { ...initialUser },
      isAuthenticated: true,
    });
  });

  it('debe actualizar reactivamente el nombre, email, telefono y avatar del usuario', () => {
    // Verificar estado inicial
    const stateAntes = useAuthStore.getState();
    expect(stateAntes.user?.nombre).toBe('Cajero Inicial');
    expect(stateAntes.user?.email).toBe('cajero@quantix.retail');
    expect(stateAntes.user?.telefono).toBeNull();
    expect(stateAntes.user?.avatar).toBeNull();

    // Ejecutar updateProfile con todos los campos
    const nuevosDatos: Partial<User> = {
      nombre: 'Carlos Cajero Actualizado',
      email: 'carlos.cajero@quantix.retail',
      telefono: '+52 55 9876 5432',
      avatar: 'data:image/jpeg;base64,mockAvatarCompressedDataUrl==',
    };

    useAuthStore.getState().updateProfile(nuevosDatos);

    // Verificar que el estado del store se actualizó reactivamente
    const stateDespues = useAuthStore.getState();
    expect(stateDespues.user).toBeDefined();
    expect(stateDespues.user?.nombre).toBe('Carlos Cajero Actualizado');
    expect(stateDespues.user?.email).toBe('carlos.cajero@quantix.retail');
    expect(stateDespues.user?.telefono).toBe('+52 55 9876 5432');
    expect(stateDespues.user?.avatar).toBe('data:image/jpeg;base64,mockAvatarCompressedDataUrl==');
    
    // Verificar que id y rol se preservan intactos
    expect(stateDespues.user?.id).toBe('user-uuid-1234');
    expect(stateDespues.user?.rol).toBe('CAJERO');
  });

  it('debe persistir cambios parciales en el estado del usuario', () => {
    // Actualizar únicamente el teléfono
    useAuthStore.getState().updateProfile({
      telefono: '+52 81 1234 5678',
    });

    let state = useAuthStore.getState();
    expect(state.user?.telefono).toBe('+52 81 1234 5678');
    expect(state.user?.nombre).toBe('Cajero Inicial'); // Preservado
    expect(state.user?.email).toBe('cajero@quantix.retail'); // Preservado

    // Actualizar el avatar y remover el teléfono
    useAuthStore.getState().updateProfile({
      avatar: 'data:image/jpeg;base64,avatar2==',
      telefono: null,
    });

    state = useAuthStore.getState();
    expect(state.user?.avatar).toBe('data:image/jpeg;base64,avatar2==');
    expect(state.user?.telefono).toBeNull();
    expect(state.user?.nombre).toBe('Cajero Inicial');
  });

  it('debe persistir los cambios en el almacenamiento quantix-auth-storage', () => {
    useAuthStore.getState().updateProfile({
      nombre: 'Usuario Persistido',
      telefono: '+52 33 0000 1111',
    });

    const storedRaw = localStorage.getItem('quantix-auth-storage');
    expect(storedRaw).toBeDefined();
    if (storedRaw) {
      const parsed = JSON.parse(storedRaw);
      expect(parsed.state?.user?.nombre).toBe('Usuario Persistido');
      expect(parsed.state?.user?.telefono).toBe('+52 33 0000 1111');
    }
  });

  it('no debe mutar el estado si user es null', () => {
    useAuthStore.setState({ user: null, isAuthenticated: false });
    
    // Intentar actualizar perfil cuando no hay usuario activo
    useAuthStore.getState().updateProfile({
      nombre: 'Fantasma',
    });

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
  });
});
