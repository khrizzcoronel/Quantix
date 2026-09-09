import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { X, ArrowRight, Plus, Trash2, AlertCircle, Building2, Package, Layers } from 'lucide-react';
import { mostrarToast } from '../hooks/useWebSocket';
import type { Sucursal } from '../store/sucursalStore';

interface ProductoItem {
  id: string;
  sku: string;
  nombre: string;
  stock_total: number;
}

interface LoteItem {
  id: string;
  codigo_lote: string;
  cantidad_disponible: number;
  fecha_vencimiento?: string;
  sucursal_id?: string;
}

interface ItemTransferencia {
  producto_id: string;
  producto_sku: string;
  producto_nombre: string;
  cantidad: number;
  lote_origen_id?: string;
  lote_origen_codigo?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  sucursales: Sucursal[];
  sucursalOrigenDefaultId?: string;
  productos: ProductoItem[];
}

export default function TransferenciaModal({
  isOpen,
  onClose,
  onSuccess,
  sucursales,
  sucursalOrigenDefaultId,
  productos,
}: Props) {
  const [origenId, setOrigenId] = useState<string>('');
  const [destinoId, setDestinoId] = useState<string>('');
  const [notas, setNotas] = useState('');
  const [items, setItems] = useState<ItemTransferencia[]>([]);

  // Item en edición
  const [selectedProdId, setSelectedProdId] = useState('');
  const [selectedLoteId, setSelectedLoteId] = useState('');
  const [cantidadInput, setCantidadInput] = useState('');
  const [lotesProducto, setLotesProducto] = useState<LoteItem[]>([]);
  const [loadingLotes, setLoadingLotes] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const orig = sucursalOrigenDefaultId || sucursales[0]?.id || '';
      setOrigenId(orig);
      const dest = sucursales.find((s) => s.id !== orig)?.id || '';
      setDestinoId(dest);
      setNotas('');
      setItems([]);
      setSelectedProdId('');
      setSelectedLoteId('');
      setCantidadInput('');
      setErrorMsg(null);
    }
  }, [isOpen, sucursalOrigenDefaultId, sucursales]);

  // Cargar lotes cuando cambia el producto seleccionado
  useEffect(() => {
    if (!selectedProdId) {
      setLotesProducto([]);
      setSelectedLoteId('');
      return;
    }
    const fetchLotes = async () => {
      setLoadingLotes(true);
      try {
        const res = await api.get('/inventario/lotes', { params: { producto_id: selectedProdId } });
        const allLotes: LoteItem[] = res.data || [];
        // Filtrar lotes disponibles con stock > 0 pertenecientes al origen (o sin sucursal si es matriz)
        const filtered = allLotes.filter((l) => {
          const pertenece = !l.sucursal_id || l.sucursal_id === origenId;
          return pertenece && Number(l.cantidad_disponible) > 0;
        });
        setLotesProducto(filtered);
      } catch (err) {
        console.error('Error al cargar lotes para traspaso:', err);
      } finally {
        setLoadingLotes(false);
      }
    };
    void fetchLotes();
  }, [selectedProdId, origenId]);

  if (!isOpen) return null;

  const handleAgregarItem = () => {
    setErrorMsg(null);
    if (!selectedProdId) {
      setErrorMsg('Selecciona un producto para transferir');
      return;
    }

    const cant = parseFloat(cantidadInput);
    if (isNaN(cant) || cant <= 0) {
      setErrorMsg('Ingresa una cantidad válida mayor a 0');
      return;
    }

    const prod = productos.find((p) => p.id === selectedProdId);
    if (!prod) return;

    let loteCodigo: string | undefined;
    if (selectedLoteId) {
      const lote = lotesProducto.find((l) => l.id === selectedLoteId);
      if (lote) {
        if (cant > Number(lote.cantidad_disponible)) {
          setErrorMsg(`La cantidad excede el stock disponible en el lote seleccionado (${lote.cantidad_disponible})`);
          return;
        }
        loteCodigo = lote.codigo_lote;
      }
    }

    // Verificar si ya existe en la lista
    const idx = items.findIndex(
      (it) => it.producto_id === selectedProdId && (it.lote_origen_id || '') === (selectedLoteId || '')
    );

    if (idx >= 0) {
      const updated = [...items];
      updated[idx].cantidad += cant;
      setItems(updated);
    } else {
      setItems([
        ...items,
        {
          producto_id: prod.id,
          producto_sku: prod.sku,
          producto_nombre: prod.nombre,
          cantidad: cant,
          lote_origen_id: selectedLoteId || undefined,
          lote_origen_codigo: loteCodigo,
        },
      ]);
    }

    setSelectedProdId('');
    setSelectedLoteId('');
    setCantidadInput('');
  };

  const handleEliminarItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!origenId || !destinoId) {
      setErrorMsg('Debes seleccionar sucursal de origen y destino');
      return;
    }

    if (origenId === destinoId) {
      setErrorMsg('La sucursal de origen y destino no pueden ser la misma');
      return;
    }

    if (items.length === 0) {
      setErrorMsg('Debes agregar al menos un producto a la transferencia');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        sucursal_origen_id: origenId,
        sucursal_destino_id: destinoId,
        notas: notas.trim() || undefined,
        items: items.map((it) => ({
          producto_id: it.producto_id,
          cantidad: it.cantidad,
          lote_origen_id: it.lote_origen_id || undefined,
        })),
      };

      const res = await api.post('/transferencias', payload);
      mostrarToast({
        titulo: 'Traspaso Solicitado',
        mensaje: `Folio ${res.data.folio} generado exitosamente en estado SOLICITADA`,
        severidad: 'SUCCESS',
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error al solicitar transferencia:', err);
      setErrorMsg(err.response?.data?.detail || 'Error al procesar la solicitud de traspaso');
    } finally {
      setLoading(false);
    }
  };

  const totalUnidades = items.reduce((acc, it) => acc + it.cantidad, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-surface-container-lowest rounded-3xl border border-surface-container-high/60 shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200 my-8">
        
        {/* Header Neo-Retail */}
        <div className="px-6 py-5 border-b border-surface-container-low flex items-center justify-between bg-surface-container-low/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary-container flex items-center justify-center text-on-primary-container shadow-xs">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-headline-md text-title-md font-bold text-on-surface">
                Solicitud de Traspaso Inter-Sucursal
              </h3>
              <p className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider">
                Movimiento logístico entre almacenes y tiendas
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-container-low hover:bg-surface-container text-on-surface-variant flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-error-container/20 border border-error/20 flex items-center gap-2.5 text-error text-body-sm font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Rutas de Traspaso: Origen -> Destino */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-surface-container-low/60 p-4 rounded-2xl border border-surface-container-high/50">
            <div>
              <label className="block font-label-caps text-label-caps uppercase font-bold text-on-surface-variant mb-1.5">
                Sucursal Origen (Emite)
              </label>
              <select
                value={origenId}
                onChange={(e) => {
                  setOrigenId(e.target.value);
                  setItems([]); // Limpiar items si cambia origen
                }}
                className="w-full bg-surface-container-lowest border border-outline/30 rounded-xl px-3 py-2 text-on-surface font-title-md text-body-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {sucursales.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre} {s.es_matriz ? '(Matriz)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-label-caps text-label-caps uppercase font-bold text-on-surface-variant mb-1.5">
                Sucursal Destino (Recibe)
              </label>
              <select
                value={destinoId}
                onChange={(e) => setDestinoId(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline/30 rounded-xl px-3 py-2 text-on-surface font-title-md text-body-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {sucursales
                  .filter((s) => s.id !== origenId)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre} {s.es_matriz ? '(Matriz)' : ''}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Selector de Producto y Lote a Agregar */}
          <div className="p-4 rounded-2xl border border-surface-container-high/50 bg-surface-container-lowest space-y-3">
            <span className="font-label-caps text-label-caps uppercase font-bold text-on-surface-variant flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-primary" />
              Agregar Mercancía al Traspaso
            </span>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-5">
                <select
                  value={selectedProdId}
                  onChange={(e) => setSelectedProdId(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline/30 rounded-xl px-3 py-2 text-on-surface font-title-md text-body-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">-- Selecciona Producto --</option>
                  {productos.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.sku}] {p.nombre} (Stock: {p.stock_total})
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-4">
                <select
                  value={selectedLoteId}
                  onChange={(e) => setSelectedLoteId(e.target.value)}
                  disabled={!selectedProdId || loadingLotes}
                  className="w-full bg-surface-container-low border border-outline/30 rounded-xl px-3 py-2 text-on-surface font-title-md text-body-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                >
                  <option value="">FEFO Automático (Recomendado)</option>
                  {lotesProducto.map((l) => (
                    <option key={l.id} value={l.id}>
                      Lote: {l.codigo_lote} (Disp: {l.cantidad_disponible})
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <input
                  type="number"
                  min="0.1"
                  step="any"
                  placeholder="Cant."
                  value={cantidadInput}
                  onChange={(e) => setCantidadInput(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline/30 rounded-xl px-3 py-2 text-on-surface font-title-md text-body-sm focus:outline-none focus:ring-2 focus:ring-primary text-center"
                />
              </div>

              <div className="md:col-span-1 flex items-center">
                <button
                  type="button"
                  onClick={handleAgregarItem}
                  disabled={!selectedProdId || !cantidadInput}
                  className="w-full h-9 rounded-xl bg-primary-container text-on-primary-container hover:bg-primary hover:text-on-primary font-bold flex items-center justify-center transition-colors disabled:opacity-40 cursor-pointer"
                  title="Agregar a la lista"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Tabla de Items Agregados */}
          <div className="border border-surface-container-high/40 rounded-2xl overflow-hidden bg-surface-container-low/20">
            <div className="px-4 py-2.5 bg-surface-container-low/60 flex items-center justify-between border-b border-surface-container-high/30">
              <span className="font-label-caps text-label-caps uppercase font-bold text-on-surface-variant">
                Items en Traspaso ({items.length})
              </span>
              <span className="font-label-numeric-md text-body-sm font-bold text-primary">
                Total Unidades: {totalUnidades}
              </span>
            </div>

            {items.length === 0 ? (
              <div className="p-6 text-center text-on-surface-variant text-body-sm">
                No hay productos añadidos a este traspaso todavía.
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto divide-y divide-surface-container-high/30">
                {items.map((it, idx) => (
                  <div key={idx} className="px-4 py-2.5 flex items-center justify-between hover:bg-surface-container-low/40">
                    <div className="min-w-0 flex-1">
                      <div className="font-title-md text-body-sm font-semibold text-on-surface truncate">
                        {it.producto_nombre}
                      </div>
                      <div className="flex items-center gap-2 font-label-caps text-[11px] text-on-surface-variant">
                        <span>SKU: {it.producto_sku}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Layers className="w-3 h-3 text-outline" />
                          {it.lote_origen_codigo ? `Lote: ${it.lote_origen_codigo}` : 'FEFO Automático'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <span className="px-3 py-1 rounded-full bg-surface-container-high font-label-numeric-md font-bold text-body-sm text-on-surface">
                        {it.cantidad} uds
                      </span>
                      <button
                        type="button"
                        onClick={() => handleEliminarItem(idx)}
                        className="text-error hover:bg-error-container/20 p-1.5 rounded-lg transition-colors cursor-pointer"
                        title="Quitar de la lista"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notas / Observaciones */}
          <div>
            <label className="block font-label-caps text-label-caps uppercase font-bold text-on-surface-variant mb-1">
              Notas / Motivo del Traspaso (Opcional)
            </label>
            <input
              type="text"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Ej: Reabastecimiento urgente por quiebre de stock en sucursal satélite..."
              className="w-full bg-surface-container-low border border-outline/30 rounded-xl px-3 py-2 text-on-surface font-title-md text-body-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Footer de Acciones */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-surface-container-low">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full font-title-md text-body-sm font-bold text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || items.length === 0}
              className="px-6 py-2.5 rounded-full bg-primary-container hover:bg-primary text-on-primary-container hover:text-on-primary font-title-md text-body-sm font-bold shadow-sm hover:shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <span>Solicitando...</span>
              ) : (
                <>
                  <span>Confirmar Solicitud</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
