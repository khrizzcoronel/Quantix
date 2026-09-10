import { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  Printer, X, Receipt, ArrowDownLeft, ArrowUpRight, 
  RefreshCw, AlertCircle 
} from 'lucide-react';

interface MovimientoItem {
  id: string;
  sesion_id: string;
  usuario_id: string;
  usuario_nombre?: string;
  tipo: string;
  monto: number;
  concepto: string;
  fecha_hora: string;
}

export interface CorteXData {
  sesion_id: string;
  folio_corte: string;
  cajero_id: string;
  cajero_nombre: string;
  cajero_email?: string | null;
  terminal_id: string;
  fecha_apertura: string;
  fecha_corte_x: string;
  fondo_inicial: number;
  total_ventas_efectivo: number;
  total_ventas_tarjeta: number;
  total_ventas_transferencia: number;
  total_ventas_otros: number;
  total_ventas: number;
  total_ingresos_extra: number;
  total_egresos_extra: number;
  efectivo_teorico_en_caja: number;
  total_tickets_emitidos: number;
  movimientos: MovimientoItem[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sesionId?: string;
}

export default function CorteXModal({ isOpen, onClose, sesionId }: Props) {
  const [data, setData] = useState<CorteXData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargarCorteX = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = sesionId ? `/caja/corte-x?sesion_id=${sesionId}` : '/caja/corte-x';
      const res = await api.get(url);
      setData(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Error al obtener el Corte X');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      cargarCorteX();
    } else {
      setData(null);
      setError(null);
    }
  }, [isOpen, sesionId]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-inverse-surface/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200 corte-x-modal-overlay">
      {/* Estilos para impresión @media print aislada y limpia de Corte X */}
      <style>{`
        @media print {
          @page {
            size: auto;
            margin: 4mm;
          }
          body * {
            visibility: hidden !important;
          }
          .corte-x-modal-overlay,
          .corte-x-modal-container {
            position: static !important;
            background: transparent !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            overflow: visible !important;
            max-height: none !important;
            width: 100% !important;
            display: block !important;
          }
          #imprimible-corte-x,
          #imprimible-corte-x * {
            visibility: visible !important;
          }
          #imprimible-corte-x {
            position: absolute !important;
            left: 0 !important;
            right: 0 !important;
            top: 0 !important;
            margin: 0 auto !important;
            width: 80mm !important;
            max-width: 80mm !important;
            padding: 6mm 4mm !important;
            background: #ffffff !important;
            color: #000000 !important;
            border: 1px dashed #333333 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 11px !important;
            line-height: 1.35 !important;
            z-index: 999999 !important;
          }
          #imprimible-corte-x * {
            color: #000000 !important;
            background: transparent !important;
            border-color: #333333 !important;
            box-shadow: none !important;
            text-shadow: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
      <div className="bg-surface-container-lowest rounded-3xl shadow-2xl max-w-xl w-full p-6 border border-outline-variant/30 flex flex-col max-h-[92vh] corte-x-modal-container">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-outline-variant/20 shrink-0 no-print">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-secondary-container text-on-secondary-container flex items-center justify-center shadow-xs">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-headline-md text-title-lg text-on-surface">Corte X (Parcial)</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-blue-100 text-blue-800 border border-blue-200">
                  Sesión Abierta
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Arqueo informativo en tiempo real sin cierre de turno
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={cargarCorteX}
              disabled={loading}
              className="w-9 h-9 rounded-full bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer"
              title="Actualizar datos"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {loading && !data && (
            <div className="py-16 text-center text-on-surface-variant flex flex-col items-center gap-2">
              <RefreshCw className="w-8 h-8 animate-spin text-primary" />
              <span className="font-medium">Calculando arqueo en tiempo real...</span>
            </div>
          )}

          {error && (
            <div className="p-4 bg-error-container text-on-error-container rounded-2xl flex items-center gap-3 border border-error/20">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <div>
                <p className="font-headline-md font-bold">No se pudo generar el Corte X</p>
                <p className="text-body-sm">{error}</p>
              </div>
            </div>
          )}

          {data && (
            <div id="imprimible-corte-x" className="space-y-4">
              {/* Metadatos de la sesión */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3.5 bg-surface-container-low/70 rounded-2xl border border-outline-variant/20 text-body-sm">
                <div>
                  <span className="font-label-caps text-label-caps text-on-surface-variant uppercase block">Folio Corte</span>
                  <span className="font-mono font-bold text-on-surface text-xs">{data.folio_corte}</span>
                </div>
                <div>
                  <span className="font-label-caps text-label-caps text-on-surface-variant uppercase block">Cajero</span>
                  <span className="font-headline-md text-on-surface truncate block">{data.cajero_nombre}</span>
                </div>
                <div>
                  <span className="font-label-caps text-label-caps text-on-surface-variant uppercase block">Terminal</span>
                  <span className="font-mono text-on-surface">{data.terminal_id}</span>
                </div>
                <div>
                  <span className="font-label-caps text-label-caps text-on-surface-variant uppercase block">Apertura</span>
                  <span className="font-body-sm text-on-surface text-xs">{new Date(data.fecha_apertura).toLocaleTimeString()}</span>
                </div>
                <div>
                  <span className="font-label-caps text-label-caps text-on-surface-variant uppercase block">Hora Corte X</span>
                  <span className="font-body-sm text-on-surface text-xs">{new Date(data.fecha_corte_x).toLocaleTimeString()}</span>
                </div>
                <div>
                  <span className="font-label-caps text-label-caps text-on-surface-variant uppercase block">Tickets Emitidos</span>
                  <span className="font-label-numeric-md font-bold text-on-surface">{data.total_tickets_emitidos}</span>
                </div>
              </div>

              {/* Tarjeta Destacada: Efectivo Teórico en Gaveta */}
              <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20 flex items-center justify-between">
                <div>
                  <span className="font-label-caps text-label-caps text-primary uppercase font-bold tracking-wider block">
                    Efectivo Teórico en Gaveta
                  </span>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Fondo inicial + Ventas efectivo + Entradas - Salidas
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-label-numeric-lg text-headline-md font-bold text-primary">
                    ${Number(data.efectivo_teorico_en_caja || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Desglose de Ventas por Método de Pago */}
              <div className="space-y-2">
                <h3 className="font-headline-md text-title-md text-on-surface">Ventas por Método de Pago</h3>
                <div className="p-3.5 bg-surface-container-low/50 rounded-2xl border border-outline-variant/20 space-y-2 text-body-sm">
                  <div className="flex justify-between items-center py-1 border-b border-outline-variant/10">
                    <span className="text-on-surface-variant">Fondo Inicial Apertura</span>
                    <span className="font-mono font-medium text-on-surface">${Number(data.fondo_inicial).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-outline-variant/10">
                    <span className="text-on-surface-variant">Ventas en Efectivo</span>
                    <span className="font-mono font-medium text-on-surface">${Number(data.total_ventas_efectivo).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-outline-variant/10">
                    <span className="text-on-surface-variant">Ventas con Tarjeta</span>
                    <span className="font-mono font-medium text-on-surface">${Number(data.total_ventas_tarjeta).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-outline-variant/10">
                    <span className="text-on-surface-variant">Transferencias / SPEI</span>
                    <span className="font-mono font-medium text-on-surface">${Number(data.total_ventas_transferencia).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-outline-variant/10">
                    <span className="text-on-surface-variant">Otros Medios</span>
                    <span className="font-mono font-medium text-on-surface">${Number(data.total_ventas_otros).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 font-bold">
                    <span className="text-on-surface">Total Ventas Registradas</span>
                    <span className="font-mono text-primary text-base">${Number(data.total_ventas).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Movimientos Extraordinarios de Efectivo */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-headline-md text-title-md text-on-surface">
                    Movimientos de Caja ({data.movimientos?.length || 0})
                  </h3>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-primary font-bold">
                      +${Number(data.total_ingresos_extra || 0).toFixed(2)} Entradas
                    </span>
                    <span className="text-amber-700 font-bold">
                      -${Number(data.total_egresos_extra || 0).toFixed(2)} Salidas
                    </span>
                  </div>
                </div>

                {(!data.movimientos || data.movimientos.length === 0) ? (
                  <div className="p-4 bg-surface-container-low rounded-2xl text-center text-on-surface-variant text-body-sm border border-outline-variant/15">
                    No se han registrado movimientos extraordinarios en esta sesión.
                  </div>
                ) : (
                  <div className="p-3 bg-surface-container-low/40 rounded-2xl border border-outline-variant/20 space-y-2 max-h-44 overflow-y-auto">
                    {data.movimientos.map((m) => (
                      <div key={m.id} className="p-2.5 bg-surface-container-lowest rounded-xl border border-outline-variant/10 flex items-center justify-between text-body-sm">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            m.tipo === 'INGRESO' ? 'bg-primary/10 text-primary' : 'bg-amber-100 text-amber-900'
                          }`}>
                            {m.tipo === 'INGRESO' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                          </span>
                          <div>
                            <span className="font-headline-md text-on-surface block text-xs">{m.concepto}</span>
                            <span className="font-mono text-on-surface-variant text-[11px]">
                              {new Date(m.fecha_hora).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                        <span className={`font-mono font-bold ${m.tipo === 'INGRESO' ? 'text-primary' : 'text-amber-700'}`}>
                          {m.tipo === 'INGRESO' ? '+' : '-'}${Number(m.monto).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-outline-variant/20 shrink-0 no-print">
          <button
            type="button"
            onClick={handlePrint}
            disabled={!data}
            className="h-11 px-5 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-headline-md text-body-md flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-11 px-6 rounded-full bg-primary text-on-primary hover:opacity-95 font-headline-md text-body-md transition-all cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
