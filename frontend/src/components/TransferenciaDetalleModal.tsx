import { useState } from 'react';
import api from '../services/api';
import { 
  X, Building2, Calendar, User, FileText, CheckCircle2, 
  Send, Layers, ArrowRight, Ban 
} from 'lucide-react';
import { mostrarToast } from '../hooks/useWebSocket';
import { formatDate } from '../utils/exportUtils';

export interface DetalleTransferencia {
  id: string;
  producto_id: string;
  producto_nombre?: string;
  producto_sku?: string;
  cantidad: number;
  lote_origen_id?: string;
  lote_origen_codigo?: string;
  lote_destino_id?: string;
}

export interface TransferenciaData {
  id: string;
  folio: string;
  sucursal_origen_id: string;
  sucursal_origen_nombre?: string;
  sucursal_destino_id: string;
  sucursal_destino_nombre?: string;
  usuario_solicita_id: string;
  usuario_solicita_nombre?: string;
  usuario_recibe_id?: string;
  usuario_recibe_nombre?: string;
  estado: 'SOLICITADA' | 'EN_TRANSITO' | 'RECIBIDA' | 'CANCELADA';
  fecha_solicitud: string;
  fecha_despacho?: string;
  fecha_recepcion?: string;
  notas?: string;
  detalles: DetalleTransferencia[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  transferencia: TransferenciaData | null;
  onActualizado?: () => void;
  puedeGestionar?: boolean;
}

export default function TransferenciaDetalleModal({
  isOpen,
  onClose,
  transferencia,
  onActualizado,
  puedeGestionar = true,
}: Props) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  if (!isOpen || !transferencia) return null;

  const handleDespachar = async () => {
    if (!confirm(`¿Confirmas el despacho de mercancía para el traspaso ${transferencia.folio}? El inventario será descontado de los lotes origen.`)) {
      return;
    }
    setLoadingAction('despachar');
    try {
      await api.post(`/transferencias/${transferencia.id}/despachar`);
      mostrarToast({
        titulo: 'Traspaso Despachado',
        mensaje: `La transferencia ${transferencia.folio} ahora está EN TRÁNSITO`,
        severidad: 'SUCCESS',
      });
      if (onActualizado) onActualizado();
      onClose();
    } catch (err: any) {
      mostrarToast({
        titulo: 'Error al Despachar',
        mensaje: err.response?.data?.detail || 'No se pudo despachar el traspaso',
        severidad: 'CRITICO',
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRecibir = async () => {
    if (!confirm(`¿Confirmas la recepción física del traspaso ${transferencia.folio}? Los lotes serán generados en el inventario destino.`)) {
      return;
    }
    setLoadingAction('recibir');
    try {
      await api.post(`/transferencias/${transferencia.id}/recibir`);
      mostrarToast({
        titulo: 'Traspaso Recibido',
        mensaje: `La transferencia ${transferencia.folio} fue RECIBIDA e ingresada a almacén destino`,
        severidad: 'SUCCESS',
      });
      if (onActualizado) onActualizado();
      onClose();
    } catch (err: any) {
      mostrarToast({
        titulo: 'Error al Recibir',
        mensaje: err.response?.data?.detail || 'No se pudo registrar la recepción',
        severidad: 'CRITICO',
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCancelar = async () => {
    if (!confirm(`¿Deseas cancelar el traspaso ${transferencia.folio}? Si ya estaba en tránsito se restituirá el inventario de origen.`)) {
      return;
    }
    setLoadingAction('cancelar');
    try {
      await api.post(`/transferencias/${transferencia.id}/cancelar`);
      mostrarToast({
        titulo: 'Traspaso Cancelado',
        mensaje: `El traspaso ${transferencia.folio} ha sido cancelado`,
        severidad: 'WARNING',
      });
      if (onActualizado) onActualizado();
      onClose();
    } catch (err: any) {
      mostrarToast({
        titulo: 'Error al Cancelar',
        mensaje: err.response?.data?.detail || 'No se pudo cancelar el traspaso',
        severidad: 'CRITICO',
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const getBadgeStyle = (estado: string) => {
    switch (estado) {
      case 'SOLICITADA':
        return 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300';
      case 'EN_TRANSITO':
        return 'bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-blue-300';
      case 'RECIBIDA':
        return 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300';
      case 'CANCELADA':
        return 'bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-red-300';
      default:
        return 'bg-surface-container-high text-on-surface-variant border-outline/30';
    }
  };

  const totalCantidad = (transferencia.detalles || []).reduce((acc, d) => acc + Number(d.cantidad), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-surface-container-lowest rounded-3xl border border-surface-container-high/60 shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in duration-200 my-8">
        
        {/* Header Neo-Retail */}
        <div className="px-6 py-5 border-b border-surface-container-low flex items-center justify-between bg-surface-container-low/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-secondary-container flex items-center justify-center text-on-secondary-container shadow-xs">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-headline-md text-title-md font-bold text-on-surface">
                  Traspaso {transferencia.folio}
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full font-label-caps text-[10px] uppercase font-bold border ${getBadgeStyle(transferencia.estado)}`}>
                  {transferencia.estado.replace('_', ' ')}
                </span>
              </div>
              <p className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider">
                Detalle logístico y seguimiento de custodia
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

        <div className="p-6 space-y-6">
          {/* Ruta: Origen -> Destino */}
          <div className="bg-surface-container-low/50 rounded-2xl p-4 border border-surface-container-high/40 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex-1 text-center md:text-left">
              <span className="font-label-caps text-[10px] uppercase font-bold text-on-surface-variant block">
                Origen (Emisor)
              </span>
              <span className="font-title-md text-body-md font-bold text-on-surface">
                {transferencia.sucursal_origen_nombre || 'Sucursal Matriz'}
              </span>
            </div>

            <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-primary shrink-0">
              <ArrowRight className="w-5 h-5" />
            </div>

            <div className="flex-1 text-center md:text-right">
              <span className="font-label-caps text-[10px] uppercase font-bold text-on-surface-variant block">
                Destino (Receptor)
              </span>
              <span className="font-title-md text-body-md font-bold text-on-surface">
                {transferencia.sucursal_destino_nombre || 'Sucursal Destino'}
              </span>
            </div>
          </div>

          {/* Metadata Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-body-sm">
            <div className="p-3 bg-surface-container-low/40 rounded-xl border border-surface-container-high/30">
              <div className="flex items-center gap-1.5 text-on-surface-variant mb-1 font-label-caps text-[10px] uppercase font-bold">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                <span>Solicitado</span>
              </div>
              <div className="font-title-md text-on-surface font-semibold">
                {formatDate(transferencia.fecha_solicitud)}
              </div>
            </div>

            <div className="p-3 bg-surface-container-low/40 rounded-xl border border-surface-container-high/30">
              <div className="flex items-center gap-1.5 text-on-surface-variant mb-1 font-label-caps text-[10px] uppercase font-bold">
                <User className="w-3.5 h-3.5 text-secondary" />
                <span>Solicitó</span>
              </div>
              <div className="font-title-md text-on-surface font-semibold truncate">
                {transferencia.usuario_solicita_nombre || 'Operador'}
              </div>
            </div>

            <div className="p-3 bg-surface-container-low/40 rounded-xl border border-surface-container-high/30">
              <div className="flex items-center gap-1.5 text-on-surface-variant mb-1 font-label-caps text-[10px] uppercase font-bold">
                <Calendar className="w-3.5 h-3.5 text-blue-500" />
                <span>Despachado</span>
              </div>
              <div className="font-title-md text-on-surface font-semibold">
                {transferencia.fecha_despacho ? formatDate(transferencia.fecha_despacho) : '—'}
              </div>
            </div>

            <div className="p-3 bg-surface-container-low/40 rounded-xl border border-surface-container-high/30">
              <div className="flex items-center gap-1.5 text-on-surface-variant mb-1 font-label-caps text-[10px] uppercase font-bold">
                <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                <span>Recibido</span>
              </div>
              <div className="font-title-md text-on-surface font-semibold">
                {transferencia.fecha_recepcion ? formatDate(transferencia.fecha_recepcion) : '—'}
              </div>
            </div>
          </div>

          {transferencia.notas && (
            <div className="p-3 bg-surface-container-low/30 rounded-xl border border-surface-container-high/20 flex items-start gap-2 text-body-sm">
              <FileText className="w-4 h-4 text-outline shrink-0 mt-0.5" />
              <div>
                <span className="font-label-caps text-[10px] uppercase font-bold text-on-surface-variant block">
                  Notas de Despacho / Observaciones
                </span>
                <p className="text-on-surface">{transferencia.notas}</p>
              </div>
            </div>
          )}

          {/* Tabla de Artículos */}
          <div className="border border-surface-container-high/40 rounded-2xl overflow-hidden bg-surface-container-low/20">
            <div className="px-4 py-2.5 bg-surface-container-low/60 flex items-center justify-between border-b border-surface-container-high/30">
              <span className="font-label-caps text-label-caps uppercase font-bold text-on-surface-variant">
                Líneas de Artículos ({transferencia.detalles?.length || 0})
              </span>
              <span className="font-label-numeric-md text-body-sm font-bold text-primary">
                Total Unidades: {totalCantidad}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-surface-container-high/30 bg-surface-container-low/30 text-[11px] font-label-caps uppercase text-on-surface-variant">
                    <th className="py-2.5 px-4">SKU</th>
                    <th className="py-2.5 px-4">Producto</th>
                    <th className="py-2.5 px-4">Lote Origen</th>
                    <th className="py-2.5 px-4 text-right">Cantidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-high/20 text-body-sm">
                  {(transferencia.detalles || []).map((det) => (
                    <tr key={det.id} className="hover:bg-surface-container-low/40">
                      <td className="py-2.5 px-4 font-mono font-bold text-primary">
                        {det.producto_sku || '—'}
                      </td>
                      <td className="py-2.5 px-4 font-title-md font-semibold text-on-surface">
                        {det.producto_nombre || 'Producto'}
                      </td>
                      <td className="py-2.5 px-4 text-on-surface-variant">
                        <span className="inline-flex items-center gap-1 font-mono text-xs px-2 py-0.5 rounded-full bg-surface-container-high">
                          <Layers className="w-3 h-3 text-outline" />
                          {det.lote_origen_codigo || 'FEFO Auto'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-label-numeric-md font-bold text-on-surface">
                        {det.cantidad}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer de Acciones según Estado */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-surface-container-low">
            <div>
              {puedeGestionar && (transferencia.estado === 'SOLICITADA' || transferencia.estado === 'EN_TRANSITO') && (
                <button
                  type="button"
                  onClick={handleCancelar}
                  disabled={loadingAction !== null}
                  className="px-4 py-2 rounded-full border border-error/40 text-error hover:bg-error-container/20 font-title-md text-body-sm font-bold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                >
                  <Ban className="w-4 h-4" />
                  <span>Cancelar Traspaso</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-full font-title-md text-body-sm font-bold text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
              >
                Cerrar
              </button>

              {puedeGestionar && transferencia.estado === 'SOLICITADA' && (
                <button
                  type="button"
                  onClick={handleDespachar}
                  disabled={loadingAction !== null}
                  className="px-6 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-title-md text-body-sm font-bold shadow-sm hover:shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>Despachar Mercancía</span>
                </button>
              )}

              {puedeGestionar && transferencia.estado === 'EN_TRANSITO' && (
                <button
                  type="button"
                  onClick={handleRecibir}
                  disabled={loadingAction !== null}
                  className="px-6 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-title-md text-body-sm font-bold shadow-sm hover:shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirmar Recepción</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
