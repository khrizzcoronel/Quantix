import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDB,
  dbPut,
  dbGet,
  dbClearStore,
  type ProductoOffline,
  type MetadataItem,
  type VentaOffline
} from '../db';
import {
  actualizarCatalogoOffline,
  esSnapshotValido,
  buscarProductosLocales,
  type ProductoCatalogoApi
} from '../snapshotService';
import {
  guardarVentaOffline,
  obtenerColaPendiente,
  marcarVentaSincronizada,
  marcarVentaConflicto,
  type VentaOfflineInput
} from '../queueService';

// Patrón Regex para validar formato UUID v4
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('IndexedDB Offline Storage Layer', () => {
  beforeEach(async () => {
    // Limpiar todos los almacenes antes de cada prueba para aislamiento
    await dbClearStore('catalogo');
    await dbClearStore('ventas');
    await dbClearStore('cola_sync');
    await dbClearStore('metadata');
  });

  describe('1. Inicialización y operaciones básicas de IndexedDB', () => {
    it('debe inicializar la base de datos con los 4 almacenes esperados', async () => {
      const db = await getDB();
      expect(db).toBeDefined();
      expect(db.name).toBe('quantix_offline_db');
      expect(db.objectStoreNames.contains('catalogo')).toBe(true);
      expect(db.objectStoreNames.contains('ventas')).toBe(true);
      expect(db.objectStoreNames.contains('cola_sync')).toBe(true);
      expect(db.objectStoreNames.contains('metadata')).toBe(true);
    });

    it('debe almacenar y recuperar registros en catalogo y metadata', async () => {
      const prod: ProductoOffline = {
        id: 'prod-init-1',
        sku: 'SKU-INIT',
        nombre: 'Producto Inicial',
        precio_venta: 15.5,
        activo: true,
        actualizado_en: new Date().toISOString()
      };

      await dbPut('catalogo', prod);
      const recuperadoProd = await dbGet<ProductoOffline>('catalogo', 'prod-init-1');
      expect(recuperadoProd).toBeDefined();
      expect(recuperadoProd?.nombre).toBe('Producto Inicial');
      expect(recuperadoProd?.sku).toBe('SKU-INIT');

      const meta: MetadataItem = {
        clave: 'version_app',
        valor: '1.0.0',
        actualizado_en: new Date().toISOString()
      };

      await dbPut('metadata', meta);
      const recuperadoMeta = await dbGet<MetadataItem>('metadata', 'version_app');
      expect(recuperadoMeta).toBeDefined();
      expect(recuperadoMeta?.valor).toBe('1.0.0');
    });
  });

  describe('2. snapshotService (actualizarCatalogoOffline, esSnapshotValido, buscarProductosLocales)', () => {
    it('debe actualizar catálogo offline filtrando inactivos y guardando metadata', async () => {
      const productosApi: ProductoCatalogoApi[] = [
        {
          id: 'p-1',
          sku: 'SKU-001',
          nombre: 'Leche Deslactosada 1L',
          precio_venta: 28.5,
          activo: true
        },
        {
          id: 'p-2',
          sku: 'SKU-002',
          nombre: 'Pan Integral Artesanal',
          precio_venta: 35.0,
          activo: true
        },
        {
          id: 'p-3',
          sku: 'SKU-003',
          nombre: 'Producto Descontinuado',
          precio_venta: 10.0,
          activo: false
        }
      ];

      const count = await actualizarCatalogoOffline(productosApi);
      expect(count).toBe(2);

      const p1 = await dbGet<ProductoOffline>('catalogo', 'p-1');
      expect(p1).toBeDefined();
      expect(p1?.sku).toBe('SKU-001');

      const p3 = await dbGet<ProductoOffline>('catalogo', 'p-3');
      expect(p3).toBeUndefined(); // Inactivo no debe persistirse

      const metaCount = await dbGet<MetadataItem>('metadata', 'snapshot_count');
      expect(metaCount?.valor).toBe(2);

      const valido = await esSnapshotValido(24);
      expect(valido).toBe(true);
    });

    it('debe retornar falso en esSnapshotValido cuando no hay snapshot o está vencido', async () => {
      // Sin datos en metadata
      expect(await esSnapshotValido()).toBe(false);

      // Con fecha antigua (más de 24 horas)
      const fechaVieja = new Date(Date.now() - 25 * 3600 * 1000).toISOString();
      await dbPut<MetadataItem>('metadata', {
        clave: 'snapshot_at',
        valor: fechaVieja,
        actualizado_en: fechaVieja
      });
      await dbPut<MetadataItem>('metadata', {
        clave: 'snapshot_count',
        valor: 10,
        actualizado_en: fechaVieja
      });

      expect(await esSnapshotValido(24)).toBe(false);
    });

    it('debe buscar productos locales por SKU y por nombre de forma insensible a mayúsculas', async () => {
      const productosApi: ProductoCatalogoApi[] = [
        {
          id: 'p-coca',
          sku: 'BEB-001',
          nombre: 'Refresco Coca Cola 600ml',
          precio_venta: 20.0,
          activo: true
        },
        {
          id: 'p-agua',
          sku: 'BEB-002',
          nombre: 'Agua Purificada 1L',
          precio_venta: 12.0,
          activo: true
        }
      ];
      await actualizarCatalogoOffline(productosApi);

      // Búsqueda por SKU
      const porSku = await buscarProductosLocales('beb-001');
      expect(porSku.length).toBe(1);
      expect(porSku[0].id).toBe('p-coca');

      // Búsqueda por Nombre
      const porNombre = await buscarProductosLocales('coca cola');
      expect(porNombre.length).toBe(1);
      expect(porNombre[0].sku).toBe('BEB-001');

      // Búsqueda por subcadena compartida
      const compartida = await buscarProductosLocales('beb');
      expect(compartida.length).toBe(2);
    });
  });

  describe('3. queueService: guardarVentaOffline', () => {
    it('debe guardar venta atómicamente en ventas y cola_sync con id_local UUID v4', async () => {
      const ventaInput: VentaOfflineInput = {
        sesion_caja_id: 'sesion-caja-test-123',
        terminal_id: 'TERM-01',
        usuario_id: 'user-cajero-uuid',
        cajero_nombre: 'Carlos Cajero',
        subtotal: 100,
        impuestos: 16,
        total_pagar: 116,
        items: [
          {
            producto_id: 'prod-item-1',
            sku: 'SKU-ITEM-1',
            nombre: 'Galletas de Avena',
            cantidad: 2,
            precio_unitario: 50,
            subtotal: 100
          }
        ]
      };

      const ventaCreada = await guardarVentaOffline(ventaInput);

      // Validar id_local UUID v4
      expect(ventaCreada.id_local).toBeDefined();
      expect(UUID_V4_REGEX.test(ventaCreada.id_local)).toBe(true);
      expect(ventaCreada.estado).toBe('PENDIENTE_SYNC');
      expect(ventaCreada.metodo_pago).toBe('EFECTIVO');

      // Verificar persistencia atómica en 'ventas'
      const enVentas = await dbGet<VentaOffline>('ventas', ventaCreada.id_local);
      expect(enVentas).toBeDefined();
      expect(enVentas?.id_local).toBe(ventaCreada.id_local);
      expect(enVentas?.total_pagar).toBe(116);
      expect(enVentas?.items.length).toBe(1);

      // Verificar persistencia en 'cola_sync'
      const cola = await obtenerColaPendiente();
      expect(cola.length).toBe(1);
      expect(cola[0].id_local).toBe(ventaCreada.id_local);
      expect(cola[0].venta.id_local).toBe(ventaCreada.id_local);
      expect(cola[0].reintentos).toBe(0);
    });
  });

  describe('4. queueService: marcarVentaSincronizada', () => {
    it('debe actualizar estado a SINCRONIZADA con id central y remover de cola_sync', async () => {
      const ventaInput: VentaOfflineInput = {
        sesion_caja_id: 'sesion-caja-sync-456',
        terminal_id: 'TERM-02',
        subtotal: 50,
        total_pagar: 50,
        items: [
          {
            producto_id: 'p-10',
            sku: 'SKU-10',
            nombre: 'Café Americano',
            cantidad: 1,
            precio_unitario: 50,
            subtotal: 50
          }
        ]
      };

      const venta = await guardarVentaOffline(ventaInput);
      expect((await obtenerColaPendiente()).length).toBe(1);

      // Sincronizar exitosamente con backend
      await marcarVentaSincronizada(venta.id_local, {
        venta_id: 'uuid-backend-001',
        folio_ticket: 'TICK-CENTRAL-9999'
      });

      // Validar en 'ventas'
      const ventaActualizada = await dbGet<VentaOffline>('ventas', venta.id_local);
      expect(ventaActualizada).toBeDefined();
      expect(ventaActualizada?.estado).toBe('SINCRONIZADA');
      expect(ventaActualizada?.venta_id_central).toBe('uuid-backend-001');
      expect(ventaActualizada?.folio_ticket_central).toBe('TICK-CENTRAL-9999');
      expect(ventaActualizada?.sincronizado_en).toBeTruthy();

      // Validar retirada de 'cola_sync'
      const colaDespues = await obtenerColaPendiente();
      expect(colaDespues.length).toBe(0);
    });
  });

  describe('5. queueService: marcarVentaConflicto', () => {
    it('debe actualizar a PENDIENTE_REVISION y retirar de cola_sync', async () => {
      const ventaInput: VentaOfflineInput = {
        sesion_caja_id: 'sesion-caja-conf-01',
        terminal_id: 'TERM-01',
        subtotal: 200,
        total_pagar: 200,
        items: [
          {
            producto_id: 'p-20',
            sku: 'SKU-20',
            nombre: 'Caja Sorpresa',
            cantidad: 1,
            precio_unitario: 200,
            subtotal: 200
          }
        ]
      };

      const venta = await guardarVentaOffline(ventaInput);
      const motivo = 'STOCK_INSUFICIENTE: Solo quedan 0 unidades en inventario central';

      await marcarVentaConflicto(venta.id_local, motivo, 'PENDIENTE_REVISION');

      const ventaEnDb = await dbGet<VentaOffline>('ventas', venta.id_local);
      expect(ventaEnDb).toBeDefined();
      expect(ventaEnDb?.estado).toBe('PENDIENTE_REVISION');
      expect(ventaEnDb?.motivo_conflicto).toBe(motivo);

      const cola = await obtenerColaPendiente();
      expect(cola.length).toBe(0); // No debe quedarse en cola_sync bloqueando reintentos
    });

    it('debe actualizar a RECHAZADA y retirar de cola_sync', async () => {
      const ventaInput: VentaOfflineInput = {
        sesion_caja_id: 'sesion-caja-conf-02',
        terminal_id: 'TERM-01',
        subtotal: 80,
        total_pagar: 80,
        items: [
          {
            producto_id: 'p-30',
            sku: 'SKU-30',
            nombre: 'Producto Inexistente',
            cantidad: 1,
            precio_unitario: 80,
            subtotal: 80
          }
        ]
      };

      const venta = await guardarVentaOffline(ventaInput);
      const motivo = 'SESION_INVALIDA: La sesión de caja no existe en backend';

      await marcarVentaConflicto(venta.id_local, motivo, 'RECHAZADA');

      const ventaEnDb = await dbGet<VentaOffline>('ventas', venta.id_local);
      expect(ventaEnDb).toBeDefined();
      expect(ventaEnDb?.estado).toBe('RECHAZADA');
      expect(ventaEnDb?.motivo_conflicto).toBe(motivo);

      const cola = await obtenerColaPendiente();
      expect(cola.length).toBe(0);
    });
  });
});
