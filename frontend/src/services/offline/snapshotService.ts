/**
 * Servicio de Snapshots de Catálogo Offline para Quantix.
 * Mantiene la copia local autoritativa de productos en IndexedDB sin usar datos ficticios.
 */

import {
  dbClearStore,
  dbPutBulk,
  dbPut,
  dbGet,
  dbGetAll,
  type ProductoOffline,
  type MetadataItem
} from './db';

export interface SnapshotInfo {
  fecha: string | null;
  valido: boolean;
  total: number;
  horasAntiguedad: number | null;
}

export interface ProductoCatalogoApi {
  id?: string;
  producto_id?: string;
  sku: string;
  nombre: string;
  precio_venta: number | string;
  codigo_barras?: string | null;
  stock_total?: number;
  categoria_nombre?: string | null;
  requiere_pesaje?: boolean;
  imagen?: string | null;
  activo?: boolean;
}

/**
 * Guarda los productos activos recibidos del backend en IndexedDB y actualiza los metadatos de snapshot.
 * NUNCA inventa productos: si el array viene vacío, el catálogo local quedará vacío.
 */
export async function actualizarCatalogoOffline(
  productos: ProductoCatalogoApi[]
): Promise<number> {
  const ahora = new Date().toISOString();

  // Filtrar únicamente los productos activos
  const normalizados: ProductoOffline[] = productos
    .filter((p) => p.activo !== false)
    .map((p) => ({
      id: String(p.id || p.producto_id),
      sku: String(p.sku || '').trim(),
      nombre: String(p.nombre || '').trim(),
      precio_venta: Number(p.precio_venta) || 0,
      codigo_barras: p.codigo_barras ? String(p.codigo_barras).trim() : null,
      stock_total: typeof p.stock_total === 'number' ? p.stock_total : 0,
      categoria_nombre: p.categoria_nombre ? String(p.categoria_nombre) : null,
      requiere_pesaje: Boolean(p.requiere_pesaje),
      imagen: p.imagen || null,
      activo: true,
      actualizado_en: ahora
    }));

  // Reemplazo limpio del almacén 'catalogo'
  await dbClearStore('catalogo');
  if (normalizados.length > 0) {
    await dbPutBulk('catalogo', normalizados);
  }

  // Guardar metadata de snapshot
  await dbPut<MetadataItem>('metadata', {
    clave: 'snapshot_at',
    valor: ahora,
    actualizado_en: ahora
  });

  await dbPut<MetadataItem>('metadata', {
    clave: 'snapshot_count',
    valor: normalizados.length,
    actualizado_en: ahora
  });

  return normalizados.length;
}

/**
 * Comprueba si existe un snapshot de catálogo local y si su antigüedad no supera el límite de horas.
 */
export async function esSnapshotValido(maxHoras: number = 24): Promise<boolean> {
  const snapshotAtItem = await dbGet<MetadataItem>('metadata', 'snapshot_at');
  const snapshotCountItem = await dbGet<MetadataItem>('metadata', 'snapshot_count');

  if (!snapshotAtItem || typeof snapshotAtItem.valor !== 'string') {
    return false;
  }

  const count = typeof snapshotCountItem?.valor === 'number' ? snapshotCountItem.valor : 0;
  if (count <= 0) {
    return false;
  }

  const fechaSnapshot = new Date(snapshotAtItem.valor).getTime();
  if (Number.isNaN(fechaSnapshot)) {
    return false;
  }

  const diferenciaMs = Date.now() - fechaSnapshot;
  const maxMs = maxHoras * 3600 * 1000;

  return diferenciaMs >= 0 && diferenciaMs <= maxMs;
}

/**
 * Busca productos en el almacén local 'catalogo' por SKU, código de barras o nombre.
 */
export async function buscarProductosLocales(query: string): Promise<ProductoOffline[]> {
  const todos = await dbGetAll<ProductoOffline>('catalogo');
  const term = query.trim().toLowerCase();

  if (!term) {
    return todos.slice(0, 50);
  }

  return todos.filter((p) => {
    const skuMatch = p.sku.toLowerCase().includes(term);
    const nombreMatch = p.nombre.toLowerCase().includes(term);
    const barcodeMatch = p.codigo_barras ? p.codigo_barras.toLowerCase().includes(term) : false;
    const catMatch = p.categoria_nombre ? p.categoria_nombre.toLowerCase().includes(term) : false;
    return skuMatch || nombreMatch || barcodeMatch || catMatch;
  });
}

/**
 * Retorna la información de diagnóstico sobre la vigencia del snapshot local.
 */
export async function obtenerInfoSnapshot(): Promise<SnapshotInfo> {
  const snapshotAtItem = await dbGet<MetadataItem>('metadata', 'snapshot_at');
  const snapshotCountItem = await dbGet<MetadataItem>('metadata', 'snapshot_count');

  const fecha = typeof snapshotAtItem?.valor === 'string' ? snapshotAtItem.valor : null;
  const total = typeof snapshotCountItem?.valor === 'number' ? snapshotCountItem.valor : 0;

  let horasAntiguedad: number | null = null;
  let valido = false;

  if (fecha && total > 0) {
    const ms = Date.now() - new Date(fecha).getTime();
    if (!Number.isNaN(ms) && ms >= 0) {
      horasAntiguedad = Math.round((ms / (3600 * 1000)) * 10) / 10;
      valido = horasAntiguedad <= 24;
    }
  }

  return {
    fecha,
    valido,
    total,
    horasAntiguedad
  };
}
