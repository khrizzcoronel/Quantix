import React, { useState, useEffect } from 'react';
import { 
  X, Plus, Trash2, ShoppingBag, Truck, 
  Layers, CheckCircle2, AlertCircle, Loader2
} from 'lucide-react';
import api from '../services/api';

export interface DetalleOrdenItem {
  id?: string;
  producto_id: string;
  producto_nombre?: string;
  producto_sku?: string;
  cantidad_solicitada: number;
  costo_unitario_pactado: number;
  subtotal?: number;
}

export interface OrdenCompraData {
  id: string;
  proveedor_id: string;
  proveedor_nombre?: string;
  estado: string;
  fecha_emision: string;
  fecha_recepcion?: string | null;
  notas?: string | null;
  detalles?: DetalleOrdenItem[];
  total_estimado?: number;
}

interface ItemRecepcionForm {
  producto_id: string;
  producto_nombre: string;
  producto_sku: string;
  cantidad_solicitada: number;
  cantidad_recibida: string;
  costo_unitario_real: string;
  fecha_vencimiento: string;
  codigo_lote: string;
}

interface OrdenCompraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (mensaje?: string) => void;
  modo: 'crear' | 'recibir';
  ordenParaRecibir?: OrdenCompraData | null;
  proveedores?: Array<{ id: string; nombre: string }>;
  productos?: Array<{ id: string; nombre: string; sku: string; costo_base: number }>;
  isBodeguero?: boolean;
  productoPreseleccionadoId?: string;
}

export default function OrdenCompraModal({
  isOpen,
  onClose,
  onSuccess,
  modo,
  ordenParaRecibir,
  proveedores = [],
  productos = [],
  isBodeguero = false,
  productoPreseleccionadoId
}: OrdenCompraModalProps) {
  // Estado para creación de orden
  const [proveedorId, setProveedorId] = useState('');
  const [notasCrear, setNotasCrear] = useState('');
  const [lineas, setLineas] = useState<Array<{ producto_id: string; cantidad: string; costo_unitario: string }>>([]);

  // Estado para recepción de orden
  const [itemsRecepcion, setItemsRecepcion] = useState<ItemRecepcionForm[]>([]);
  const [fechaGeneral, setFechaGeneral] = useState('');
  const [notasRecepcion, setNotasRecepcion] = useState('');

  // Estados generales
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Inicialización según el modo
  useEffect(() => {
    queueMicrotask(() => {
    if (!isOpen) {
      setErrorMsg(null);
      return;
    }

    const hoy = new Date();
    const vencDefecto = new Date(hoy);
    vencDefecto.setMonth(vencDefecto.getMonth() + 6);
    const vencIso = vencDefecto.toISOString().split('T')[0];
    const fechaCodigo = hoy.toISOString().slice(0, 10).replace(/-/g, '');

    if (modo === 'crear') {
      const defaultProv = proveedores[0]?.id || '';
      setProveedorId(defaultProv);
      setNotasCrear('');

      const prodInit = productoPreseleccionadoId 
        ? productos.find(p => p.id === productoPreseleccionadoId) || productos[0]
        : productos[0];

      if (prodInit) {
        setLineas([{
          producto_id: prodInit.id,
          cantidad: '20',
          costo_unitario: String(prodInit.costo_base || '10.00')
        }]);
      } else {
        setLineas([]);
      }
    } else if (modo === 'recibir' && ordenParaRecibir) {
      setFechaGeneral(vencIso);
      setNotasRecepcion('');

      const itemsInit: ItemRecepcionForm[] = (ordenParaRecibir.detalles || []).map((d) => {
        const prod = productos.find(p => p.id === d.producto_id);
        const skuSanit = (d.producto_sku || prod?.sku || 'PRD').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
        const randCode = Math.random().toString(36).substring(2, 6).toUpperCase();
        const autoCode = `SAN-${fechaCodigo}-${skuSanit}-${randCode}`;

        return {
          producto_id: d.producto_id,
          producto_nombre: d.producto_nombre || prod?.nombre || 'Producto',
          producto_sku: d.producto_sku || prod?.sku || '',
          cantidad_solicitada: Number(d.cantidad_solicitada),
          cantidad_recibida: String(d.cantidad_solicitada),
          costo_unitario_real: String(d.costo_unitario_pactado),
          fecha_vencimiento: vencIso,
          codigo_lote: autoCode
        };
      });

      setItemsRecepcion(itemsInit);
    }
    });
  }, [isOpen, modo, ordenParaRecibir, proveedores, productos, productoPreseleccionadoId]);

  if (!isOpen) return null;

  // Handlers para creación
  const handleAgregarLinea = () => {
    const prod = productos[0];
    if (!prod) return;
    setLineas(prev => [
      ...prev,
      {
        producto_id: prod.id,
        cantidad: '10',
        costo_unitario: String(prod.costo_base || '10.00')
      }
    ]);
  };

  const handleEliminarLinea = (index: number) => {
    setLineas(prev => prev.filter((_, i) => i !== index));
  };

  const handleCambiarLinea = (index: number, campo: 'producto_id' | 'cantidad' | 'costo_unitario', valor: string) => {
    setLineas(prev => {
      const nuevo = [...prev];
      nuevo[index] = { ...nuevo[index], [campo]: valor };
      if (campo === 'producto_id') {
        const prod = productos.find(p => p.id === valor);
        if (prod) {
          nuevo[index].costo_unitario = String(prod.costo_base || '10.00');
        }
      }
      return nuevo;
    });
  };

  const calcularTotalCrear = () => {
    return lineas.reduce((acc, l) => {
      const cant = parseFloat(l.cantidad) || 0;
      const cost = parseFloat(l.costo_unitario) || 0;
      return acc + (cant * cost);
    }, 0);
  };

  // Handlers para recepción
  const handleCambiarItemRecepcion = (index: number, campo: keyof ItemRecepcionForm, valor: string) => {
    setItemsRecepcion(prev => {
      const nuevo = [...prev];
      nuevo[index] = { ...nuevo[index], [campo]: valor };
      return nuevo;
    });
  };

  const handleAplicarFechaGeneral = (fecha: string) => {
    setFechaGeneral(fecha);
    setItemsRecepcion(prev => prev.map(item => ({ ...item, fecha_vencimiento: fecha })));
  };

  // Enviar formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      if (modo === 'crear') {
        if (!proveedorId) {
          setErrorMsg('Selecciona un proveedor para la orden');
          setLoading(false);
          return;
        }
        if (lineas.length === 0) {
          setErrorMsg('Agrega al menos un producto a la orden de compra');
          setLoading(false);
          return;
        }

        const itemsPayload = lineas.map(l => {
          const cant = parseFloat(l.cantidad);
          const cost = parseFloat(l.costo_unitario);
          if (isNaN(cant) || cant <= 0) throw new Error('Las cantidades deben ser mayores a cero');
          if (isNaN(cost) || cost < 0) throw new Error('El costo pactado no puede ser negativo');
          return {
            producto_id: l.producto_id,
            cantidad_solicitada: cant,
            costo_unitario_pactado: cost
          };
        });

        await api.post('/inventario/ordenes-compra', {
          proveedor_id: proveedorId,
          notas: notasCrear.trim() || undefined,
          items: itemsPayload
        });

        onSuccess('Orden de compra registrada exitosamente en estado PENDIENTE');
        onClose();
      } else if (modo === 'recibir' && ordenParaRecibir) {
        if (itemsRecepcion.length === 0) {
          setErrorMsg('No hay productos para recibir en esta orden');
          setLoading(false);
          return;
        }

        const itemsPayload = itemsRecepcion.map(item => {
          const cant = parseFloat(item.cantidad_recibida);
          const cost = parseFloat(item.costo_unitario_real);
          if (isNaN(cant) || cant <= 0) throw new Error(`Cantidad inválida para ${item.producto_nombre}`);
          return {
            producto_id: item.producto_id,
            cantidad_recibida: cant,
            costo_unitario_real: isNaN(cost) ? 0 : cost,
            fecha_vencimiento: item.fecha_vencimiento || null,
            codigo_lote: item.codigo_lote.trim() || undefined
          };
        });

        await api.post(`/inventario/ordenes-compra/${ordenParaRecibir.id}/recibir`, {
          items: itemsPayload,
          fecha_vencimiento_general: fechaGeneral || null,
          notas: notasRecepcion.trim() || undefined
        });

        onSuccess('Mercancía recibida con éxito. Lotes sanitarios generados en estado ACTIVO y stock actualizado.');
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || err.message || 'Error al procesar la operación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-6 border border-gray-100 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header Modal con botón X */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-2xl shadow-inner ${modo === 'crear' ? 'bg-quantix-100 text-quantix-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {modo === 'crear' ? <ShoppingBag className="w-6 h-6" /> : <Truck className="w-6 h-6" />}
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900">
                {modo === 'crear' ? 'Nueva Orden de Compra' : 'Recepción de Mercancía'}
              </h2>
              <p className="text-xs text-gray-500 font-medium">
                {modo === 'crear' 
                  ? 'Cadena de suministro y aprovisionamiento formal de inventario' 
                  : `Orden #${ordenParaRecibir?.id?.slice(0, 8)} • Proveedor: ${ordenParaRecibir?.proveedor_nombre || 'N/A'}`
                }
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensaje de Error */}
        {errorMsg && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-sm text-red-700 shrink-0">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Formulario con Scroll */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {modo === 'crear' ? (
            <>
              {/* Proveedor y Notas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Proveedor *
                  </label>
                  <select
                    value={proveedorId}
                    onChange={(e) => setProveedorId(e.target.value)}
                    required
                    className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-quantix-500"
                  >
                    <option value="">-- Seleccionar Proveedor --</option>
                    {proveedores.map(p => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Notas / Referencia
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Entrega urgente sucursal norte"
                    value={notasCrear}
                    onChange={(e) => setNotasCrear(e.target.value)}
                    className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-quantix-500"
                  />
                </div>
              </div>

              {/* Lista dinámica de productos */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-gray-700 uppercase tracking-wider">
                    Líneas de la Orden ({lineas.length})
                  </h3>
                  <button
                    type="button"
                    onClick={handleAgregarLinea}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-quantix-50 hover:bg-quantix-100 text-quantix-700 rounded-xl text-xs font-bold transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Añadir Producto
                  </button>
                </div>

                <div className="space-y-2.5">
                  {lineas.map((linea, idx) => {
                    const subtotal = (parseFloat(linea.cantidad) || 0) * (parseFloat(linea.costo_unitario) || 0);

                    return (
                      <div key={idx} className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex flex-wrap md:flex-nowrap items-center gap-3">
                        <div className="flex-1 min-w-[180px]">
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Producto</label>
                          <select
                            value={linea.producto_id}
                            onChange={(e) => handleCambiarLinea(idx, 'producto_id', e.target.value)}
                            className="w-full py-1.5 px-2 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-800"
                          >
                            {productos.map(p => (
                              <option key={p.id} value={p.id}>{p.sku} • {p.nombre}</option>
                            ))}
                          </select>
                        </div>

                        <div className="w-24">
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Cantidad</label>
                          <input
                            type="number"
                            min="1"
                            step="any"
                            value={linea.cantidad}
                            onChange={(e) => handleCambiarLinea(idx, 'cantidad', e.target.value)}
                            required
                            className="w-full py-1.5 px-2 bg-white border border-gray-200 rounded-lg text-xs font-mono font-bold text-center"
                          />
                        </div>

                        {!isBodeguero && (
                          <div className="w-28">
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Costo Unit ($)</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={linea.costo_unitario}
                              onChange={(e) => handleCambiarLinea(idx, 'costo_unitario', e.target.value)}
                              required
                              className="w-full py-1.5 px-2 bg-white border border-gray-200 rounded-lg text-xs font-mono font-bold text-right"
                            />
                          </div>
                        )}

                        {!isBodeguero && (
                          <div className="w-24 text-right">
                            <span className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Subtotal</span>
                            <span className="font-mono text-xs font-bold text-gray-900">${subtotal.toFixed(2)}</span>
                          </div>
                        )}

                        {lineas.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleEliminarLinea(idx)}
                            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all mt-4 md:mt-0"
                            title="Quitar línea"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Total Estimado */}
              {!isBodeguero && (
                <div className="flex justify-end pt-2">
                  <div className="p-3 bg-quantix-50 rounded-xl border border-quantix-200 text-right">
                    <span className="text-xs font-bold text-quantix-700 uppercase tracking-wider block">Total Estimado</span>
                    <span className="text-xl font-black font-mono text-quantix-900">${calcularTotalCrear().toFixed(2)}</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* MODO RECEPCION */
            <>
              {/* Vencimiento General y Notas */}
              <div className="bg-emerald-50/70 border border-emerald-200 p-3.5 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  <span>Configuración Rápida de Lotes Sanitarios</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-emerald-900 uppercase mb-1">
                      Fecha Vencimiento Predeterminada
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={fechaGeneral}
                        onChange={(e) => handleAplicarFechaGeneral(e.target.value)}
                        className="py-1.5 px-2.5 bg-white border border-emerald-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500"
                      />
                      <span className="text-[11px] text-emerald-700 font-medium">Aplica a todos los lotes</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-emerald-900 uppercase mb-1">
                      Observaciones de Recepción
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Mercancía recibida en buen estado / temp 4°C"
                      value={notasRecepcion}
                      onChange={(e) => setNotasRecepcion(e.target.value)}
                      className="w-full py-1.5 px-2.5 bg-white border border-emerald-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Lista de Items a Recibir */}
              <div className="space-y-3">
                <h3 className="text-xs font-black text-gray-700 uppercase tracking-wider">
                  Productos y Lotes a Generar ({itemsRecepcion.length})
                </h3>

                <div className="space-y-3">
                  {itemsRecepcion.map((item, idx) => (
                    <div key={idx} className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-mono text-xs font-bold text-quantix-700 mr-2">{item.producto_sku}</span>
                          <span className="font-bold text-sm text-gray-900">{item.producto_nombre}</span>
                        </div>
                        <span className="text-xs text-gray-500 font-medium">
                          Solicitado: <strong className="text-gray-800">{item.cantidad_solicitada} uds</strong>
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Cant. Recibida</label>
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            value={item.cantidad_recibida}
                            onChange={(e) => handleCambiarItemRecepcion(idx, 'cantidad_recibida', e.target.value)}
                            required
                            className="w-full py-1.5 px-2 bg-white border border-gray-300 rounded-lg text-xs font-mono font-bold"
                          />
                        </div>

                        {!isBodeguero && (
                          <div>
                            <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Costo Unit Real ($)</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.costo_unitario_real}
                              onChange={(e) => handleCambiarItemRecepcion(idx, 'costo_unitario_real', e.target.value)}
                              required
                              className="w-full py-1.5 px-2 bg-white border border-gray-300 rounded-lg text-xs font-mono font-bold text-right"
                            />
                          </div>
                        )}

                        <div>
                          <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Caducidad Lote</label>
                          <input
                            type="date"
                            value={item.fecha_vencimiento}
                            onChange={(e) => handleCambiarItemRecepcion(idx, 'fecha_vencimiento', e.target.value)}
                            required
                            className="w-full py-1.5 px-2 bg-white border border-gray-300 rounded-lg text-xs font-medium"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Lote Sanitario</label>
                          <input
                            type="text"
                            value={item.codigo_lote}
                            onChange={(e) => handleCambiarItemRecepcion(idx, 'codigo_lote', e.target.value)}
                            required
                            placeholder="SAN-YYYYMMDD-XXXX"
                            className="w-full py-1.5 px-2 bg-white border border-gray-300 rounded-lg text-xs font-mono font-semibold"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Footer con Botones Cancelar y Guardar */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl border border-gray-200 transition-all disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`flex items-center gap-2 px-5 py-2 text-sm font-bold text-white rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50 ${
                modo === 'crear' ? 'bg-quantix-600 hover:bg-quantix-700' : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Procesando...</span>
                </>
              ) : modo === 'crear' ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Guardar Orden</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirmar Recepción</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
