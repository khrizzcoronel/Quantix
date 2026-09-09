import { describe, it, expect, beforeEach } from 'vitest';

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

const { useSucursalStore, MATRIZ_DEFAULT_ID } = await import('../../store/sucursalStore');
type Sucursal = import('../../store/sucursalStore').Sucursal;

describe('Sucursales & Traspasos Inter-Sucursal Store', () => {
  const matrizMock: Sucursal = {
    id: MATRIZ_DEFAULT_ID,
    codigo: 'MATRIZ',
    nombre: 'Sucursal Matriz',
    direccion: 'Av. Principal #100',
    telefono: '555-0001',
    es_matriz: true,
    activo: true,
  };

  const sucursalNorteMock: Sucursal = {
    id: '00000000-0000-0000-0000-000000000002',
    codigo: 'SUC-NORTE',
    nombre: 'Sucursal Norte',
    direccion: 'Blvd. Norte #450',
    telefono: '555-0002',
    es_matriz: false,
    activo: true,
  };

  beforeEach(() => {
    mockLocalStorage.clear();
    useSucursalStore.setState({
      sucursales: [matrizMock, sucursalNorteMock],
      sucursalActual: matrizMock,
      cargando: false,
      error: null,
    });
  });

  it('inicia con la sucursal matriz seleccionada por defecto', () => {
    const { sucursalActual, sucursales } = useSucursalStore.getState();
    expect(sucursalActual).not.toBeNull();
    expect(sucursalActual?.id).toBe(MATRIZ_DEFAULT_ID);
    expect(sucursalActual?.es_matriz).toBe(true);
    expect(sucursales).toHaveLength(2);
  });

  it('permite alternar de sucursal activa con seleccionarSucursal', () => {
    const { seleccionarSucursal } = useSucursalStore.getState();
    seleccionarSucursal(sucursalNorteMock);

    const { sucursalActual } = useSucursalStore.getState();
    expect(sucursalActual?.id).toBe('00000000-0000-0000-0000-000000000002');
    expect(sucursalActual?.nombre).toBe('Sucursal Norte');
    expect(sucursalActual?.es_matriz).toBe(false);
  });

  it('permite seleccionar sucursal por ID', () => {
    const { seleccionarPorId } = useSucursalStore.getState();
    seleccionarPorId(MATRIZ_DEFAULT_ID);

    const { sucursalActual } = useSucursalStore.getState();
    expect(sucursalActual?.codigo).toBe('MATRIZ');
  });

  it('persiste la sucursal seleccionada en localStorage', () => {
    const { seleccionarSucursal } = useSucursalStore.getState();
    seleccionarSucursal(sucursalNorteMock);

    const raw = mockLocalStorage.getItem('quantix-sucursal-storage');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.state.sucursalActual.codigo).toBe('SUC-NORTE');
  });
});
