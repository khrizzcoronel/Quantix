import React, { useState, useEffect } from 'react';
import api from '../services/api';

export interface DetalleOrdenItem {
  id?: string;
  producto_id: string;
  producto_nombre?: string;
  producto_sku?: string;
  cantidad_solicitada: number;
  cantidad_recibida?: number;
  cantidad_pendiente?: number;
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
  cantidad_ya_recibida: number;
  cantidad_pendiente: number;
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
          const yaRecibido = Number(d.cantidad_recibida || 0);
          const solicitada = Number(d.cantidad_solicitada || 0);
          const pendiente = d.cantidad_pendiente !== undefined 
            ? Number(d.cantidad_pendiente) 
            : Math.max(0, solicitada - yaRecibido);

          return {
            producto_id: d.producto_id,
            producto_nombre: d.producto_nombre || prod?.nombre || 'Producto',
            producto_sku: d.producto_sku || prod?.sku || '',
            cantidad_solicitada: solicitada,
            cantidad_ya_recibida: yaRecibido,
            cantidad_pendiente: pendiente,
            cantidad_recibida: String(pendiente),
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
        const itemsValidos = itemsRecepcion.filter(item => (parseFloat(item.cantidad_recibida) || 0) > 0);
        if (itemsValidos.length === 0) {
          setErrorMsg('Debes ingresar al menos un producto con cantidad a recibir mayor a cero');
          setLoading(false);
          return;
        }

        for (const item of itemsValidos) {
          const cant = parseFloat(item.cantidad_recibida);
          if (isNaN(cant) || cant <= 0) throw new Error(`Cantidad inválida para ${item.producto_nombre}`);
          if (cant > item.cantidad_pendiente) {
            throw new Error(`La cantidad a recibir (${cant}) no puede exceder el saldo pendiente (${item.cantidad_pendiente}) para ${item.producto_nombre}`);
          }
        }

        const itemsPayload = itemsValidos.map(item => {
          const cant = parseFloat(item.cantidad_recibida);
          const cost = parseFloat(item.costo_unitario_real);
          return {
            producto_id: item.producto_id,
            cantidad_recibida: cant,
            costo_unitario_real: isNaN(cost) ? 0 : cost,
            fecha_vencimiento: item.fecha_vencimiento || null,
            codigo_lote: item.codigo_lote.trim() || undefined
          };
        });

        const res = await api.post(`/inventario/ordenes-compra/${ordenParaRecibir.id}/recibir`, {
          items: itemsPayload,
          fecha_vencimiento_general: fechaGeneral || null,
          notas: notasRecepcion.trim() || undefined
        });

        const nuevoEstado = res.data?.estado;
        const msgExito = nuevoEstado === 'RECIBIDA_PARCIAL'
          ? 'Recepción parcial registrada con éxito. La orden continúa abierta por el saldo pendiente.'
          : 'Recepción completa registrada con éxito. Lotes sanitarios generados en estado ACTIVO y orden cerrada.';

        onSuccess(msgExito);
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || err.message || 'Error al procesar la operación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-inverse-surface/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest rounded-3xl shadow-2xl max-w-3xl w-full p-6 border border-outline-variant/30 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header Modal */}
        <div className="flex items-center justify-between pb-4 border-b border-outline-variant/20 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-xs ${
              modo === 'crear' ? 'bg-primary-container text-on-primary-container' : 'bg-secondary-container text-on-secondary-container'
            }`}>
              <span className="material-symbols-outlined text-2xl">
                {modo === 'crear' ? 'shopping_bag' : 'local_shipping'}
              </span>
            </div>
            <div>
              <h2 className="font-headline-md text-title-lg text-on-surface">
                {modo === 'crear' ? 'Nueva Orden de Compra' : 'Recepción de Mercancía'}
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                {modo === 'crear' 
                  ? 'Cadena de suministro y aprovisionamiento formal de inventario' 
                  : `Orden #${ordenParaRecibir?.id?.slice(0, 8)} • Proveedor: ${ordenParaRecibir?.proveedor_nombre || 'N/A'}`
                }
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Cerrar"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Mensaje de Error */}
        {errorMsg && (
          <div className="mt-4 p-3.5 bg-error-container text-on-error-container rounded-2xl flex items-center gap-2.5 text-body-sm font-medium border border-error/20 shrink-0">
            <span className="material-symbols-outlined text-lg shrink-0">warning</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Formulario con Scroll */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-4 space-y-5 pr-1">
          {modo === 'crear' ? (
            <>
              {/* Proveedor y Notas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider mb-1.5">
                    Proveedor *
                  </label>
                  <select
                    value={proveedorId}
                    onChange={(e) => setProveedorId(e.target.value)}
                    required
                    className="w-full h-11 px-4 rounded-full bg-surface-container-low text-on-surface font-body-md focus:bg-surface-container focus:outline-none transition-all cursor-pointer"
                  >
                    <option value="">-- Seleccionar Proveedor --</option>
                    {proveedores.map(p => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider mb-1.5">
                    Notas / Referencia
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Entrega urgente bodega central"
                    value={notasCrear}
                    onChange={(e) => setNotasCrear(e.target.value)}
                    className="w-full h-11 px-4 rounded-full bg-surface-container-low text-on-surface font-body-md focus:bg-surface-container focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* Lista dinámica de productos */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-headline-md text-title-md text-on-surface">
                    Líneas de la Orden ({lineas.length})
                  </h3>
                  <button
                    type="button"
                    onClick={handleAgregarLinea}
                    className="h-9 px-4 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-headline-md text-body-sm flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">add</span>
                    <span>Añadir Producto</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {lineas.map((linea, idx) => {
                    const subtotal = (parseFloat(linea.cantidad) || 0) * (parseFloat(linea.costo_unitario) || 0);

                    return (
                      <div key={idx} className="p-3.5 bg-surface-container-low/60 rounded-2xl border border-outline-variant/20 flex flex-wrap md:flex-nowrap items-center gap-3">
                        <div className="flex-1 min-w-[180px]">
                          <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-1">Producto</label>
                          <select
                            value={linea.producto_id}
                            onChange={(e) => handleCambiarLinea(idx, 'producto_id', e.target.value)}
                            className="w-full h-10 px-3 rounded-full bg-surface-container-lowest text-on-surface font-body-sm focus:outline-none shadow-xs border-0 cursor-pointer"
                          >
                            {productos.map(p => (
                              <option key={p.id} value={p.id}>{p.sku} • {p.nombre}</option>
                            ))}
                          </select>
                        </div>

                        <div className="w-24">
                          <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-1 text-center">Cantidad</label>
                          <input
                            type="number"
                            min="1"
                            step="any"
                            value={linea.cantidad}
                            onChange={(e) => handleCambiarLinea(idx, 'cantidad', e.target.value)}
                            required
                            className="w-full h-10 px-3 rounded-full bg-surface-container-lowest text-on-surface font-label-numeric-md text-body-md text-center focus:outline-none shadow-xs border-0"
                          />
                        </div>

                        {!isBodeguero && (
                          <div className="w-28">
                            <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-1 text-right">Costo Unit ($)</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={linea.costo_unitario}
                              onChange={(e) => handleCambiarLinea(idx, 'costo_unitario', e.target.value)}
                              required
                              className="w-full h-10 px-3 rounded-full bg-surface-container-lowest text-on-surface font-label-numeric-md text-body-md text-right focus:outline-none shadow-xs border-0"
                            />
                          </div>
                        )}

                        {!isBodeguero && (
                          <div className="w-24 text-right">
                            <span className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-1">Subtotal</span>
                            <span className="font-label-numeric-md text-body-md font-bold text-on-surface">${subtotal.toFixed(2)}</span>
                          </div>
                        )}

                        {lineas.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleEliminarLinea(idx)}
                            className="w-8 h-8 rounded-full hover:bg-error-container text-on-surface-variant hover:text-on-error-container flex items-center justify-center transition-colors cursor-pointer mt-4 md:mt-0"
                            title="Quitar línea"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
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
                  <div className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/20 text-right min-w-[200px]">
                    <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider block mb-0.5">Total Estimado</span>
                    <span className="font-label-numeric-lg text-title-lg text-primary font-bold">${calcularTotalCrear().toFixed(2)}</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* MODO RECEPCION */
            <>
              {/* Vencimiento General y Notas */}
              <div className="bg-surface-container-low/70 border border-outline-variant/20 p-4 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-primary font-headline-md text-body-sm">
                  <span className="material-symbols-outlined text-lg text-primary">inventory</span>
                  <span>Configuración Rápida de Lotes Sanitarios</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-1">
                      Fecha Vencimiento Predeterminada
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={fechaGeneral}
                        onChange={(e) => handleAplicarFechaGeneral(e.target.value)}
                        className="h-10 px-3 rounded-full bg-surface-container-lowest text-on-surface font-body-sm focus:outline-none shadow-xs border-0"
                      />
                      <span className="font-body-sm text-body-sm text-on-surface-variant">Aplica a todos</span>
                    </div>
                  </div>

                  <div>
                    <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-1">
                      Observaciones de Recepción
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Mercancía recibida en buen estado / temp 4°C"
                      value={notasRecepcion}
                      onChange={(e) => setNotasRecepcion(e.target.value)}
                      className="w-full h-10 px-4 rounded-full bg-surface-container-lowest text-on-surface font-body-sm focus:outline-none shadow-xs border-0"
                    />
                  </div>
                </div>
              </div>

              {/* Lista de Items a Recibir */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-headline-md text-title-md text-on-surface">
                    Productos y Lotes a Recibir ({itemsRecepcion.length})
                  </h3>
                  <span className="text-body-sm text-on-surface-variant">
                    Ingresa las cantidades recibidas hoy (0 para omitir líneas)
                  </span>
                </div>

                <div className="space-y-3">
                  {itemsRecepcion.map((item, idx) => {
                    const estaCompletado = item.cantidad_pendiente <= 0;
                    return (
                      <div key={idx} className={`p-4 rounded-2xl border space-y-3 transition-all ${
                        estaCompletado 
                          ? 'bg-surface-container-low/30 border-outline-variant/10 opacity-75'
                          : 'bg-surface-container-low/60 border-outline-variant/20'
                      }`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="font-label-caps text-label-caps text-primary uppercase font-bold mr-2">{item.producto_sku}</span>
                            <span className="font-headline-md text-title-md text-on-surface">{item.producto_nombre}</span>
                          </div>
                          <div className="flex items-center gap-3 text-body-sm">
                            <span className="text-on-surface-variant">
                              Solicitado: <strong className="text-on-surface font-label-numeric-md">{item.cantidad_solicitada}</strong>
                            </span>
                            <span className="text-on-surface-variant">
                              Recibido antes: <strong className="text-on-surface font-label-numeric-md">{item.cantidad_ya_recibida}</strong>
                            </span>
                            <span className={`px-2.5 py-0.5 rounded-full text-label-caps font-bold ${
                              estaCompletado
                                ? 'bg-primary/10 text-primary'
                                : 'bg-amber-100 text-amber-900 border border-amber-300'
                            }`}>
                              {estaCompletado ? 'Completado' : `Saldo Pendiente: ${item.cantidad_pendiente}`}
                            </span>
                          </div>
                        </div>

                        {!estaCompletado ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
                            <div>
                              <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-1">
                                Recibir Hoy (máx {item.cantidad_pendiente})
                              </label>
                              <input
                                type="number"
                                min="0"
                                max={item.cantidad_pendiente}
                                step="any"
                                value={item.cantidad_recibida}
                                onChange={(e) => handleCambiarItemRecepcion(idx, 'cantidad_recibida', e.target.value)}
                                className="w-full h-10 px-3 rounded-full bg-surface-container-lowest text-on-surface font-label-numeric-md text-body-md text-center focus:outline-none shadow-xs border-0"
                              />
                            </div>

                            {!isBodeguero && (
                              <div>
                                <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-1">Costo Unit Real ($)</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.costo_unitario_real}
                                  onChange={(e) => handleCambiarItemRecepcion(idx, 'costo_unitario_real', e.target.value)}
                                  className="w-full h-10 px-3 rounded-full bg-surface-container-lowest text-on-surface font-label-numeric-md text-body-md text-right focus:outline-none shadow-xs border-0"
                                />
                              </div>
                            )}

                            <div>
                              <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-1">Caducidad Lote</label>
                              <input
                                type="date"
                                value={item.fecha_vencimiento}
                                onChange={(e) => handleCambiarItemRecepcion(idx, 'fecha_vencimiento', e.target.value)}
                                className="w-full h-10 px-3 rounded-full bg-surface-container-lowest text-on-surface font-body-sm focus:outline-none shadow-xs border-0"
                              />
                            </div>

                            <div>
                              <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-1">Lote Sanitario</label>
                              <input
                                type="text"
                                value={item.codigo_lote}
                                onChange={(e) => handleCambiarItemRecepcion(idx, 'codigo_lote', e.target.value)}
                                placeholder="SAN-YYYYMMDD-XXXX"
                                className="w-full h-10 px-3 rounded-full bg-surface-container-lowest text-on-surface font-mono text-body-sm focus:outline-none shadow-xs border-0"
                              />
                            </div>
                          </div>
                        ) : (
                          <p className="text-body-sm text-on-surface-variant italic pt-1">
                            Este producto ya fue entregado en su totalidad.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Footer con Botones Cancelar y Guardar */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-outline-variant/20 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="h-11 px-6 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-headline-md text-body-md transition-all cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="h-11 px-6 rounded-full bg-primary text-on-primary hover:opacity-95 active:scale-98 font-headline-md text-body-md transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
                  <span>Procesando...</span>
                </>
              ) : modo === 'crear' ? (
                <>
                  <span className="material-symbols-outlined text-lg">check_circle</span>
                  <span>Guardar Orden</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">verified</span>
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
