import { useState, useEffect, useCallback } from 'react';
import { 
  X, UserCheck, Receipt, ShieldAlert, 
  Clock, RefreshCw
} from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface TicketItem {
  id: string;
  folio_ticket: string;
  fecha_hora: string;
  total_pagar: number;
  estado: string;
  cliente_nombre?: string | null;
}

interface EventoItem {
  id: string;
  tipo_evento: string;
  descripcion: string;
  fecha_evento: string;
  gravedad: string;
  ip_terminal?: string | null;
  detalle_json?: any;
}

interface MiActividadData {
  sesion_activa: {
    id: string;
    terminal_id: string;
    fecha_apertura: string;
    fondo_inicial: number;
    estado: string;
    total_teorico?: number | null;
    total_fisico?: number | null;
    diferencia?: number | null;
  } | null;
  resumen_hoy: {
    total_tickets: number;
    total_monto: number;
    total_descuento: number;
    total_impuestos: number;
    tickets_anulados: number;
    promedio_ticket: number;
  };
  tickets_hoy: TicketItem[];
  eventos_auditoria_hoy: EventoItem[];
}

export default function MiActividadModal({ isOpen, onClose }: Props) {
  const user = useAuthStore((state) => state.user);
  const [tab, setTab] = useState<'TICKETS' | 'EVENTOS'>('TICKETS');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<MiActividadData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargarActividad = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/caja/mi-actividad');
      setData(res.data);
    } catch (requestError: unknown) {
      setData(null);
      const detail = (requestError as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'No se pudo cargar la actividad real del operador.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      queueMicrotask(() => void cargarActividad());
    }
  }, [isOpen, cargarActividad]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full border border-gray-100 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Cabecera */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-quantix-100 text-quantix-700 rounded-2xl">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-gray-900">Mi Turno / Mi Actividad</h2>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold rounded-full uppercase">
                  Hoy
                </span>
              </div>
              <p className="text-xs text-gray-500 font-medium">
                Operador: <strong className="text-gray-800">{user?.nombre || 'Usuario'}</strong> ({user?.rol || 'CAJERO'})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={cargarActividad}
              disabled={loading}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
              title="Actualizar actividad"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
              title="Cerrar ventana"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Panel de Resumen Rápido de Turno */}
        <div className="p-5 bg-gradient-to-br from-quantix-500 to-quantix-700 text-white">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-white/10 backdrop-blur-xs p-3 rounded-2xl border border-white/15">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">Sesión Actual</span>
              <p className="text-sm font-black mt-0.5 truncate">
                {data?.sesion_activa ? data.sesion_activa.terminal_id : 'Sin sesión activa'}
              </p>
              <span className="text-[10px] text-emerald-200 font-semibold">
                {data?.sesion_activa?.estado || 'Cerrada'}
              </span>
            </div>

            <div className="bg-white/10 backdrop-blur-xs p-3 rounded-2xl border border-white/15">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">Ventas Cobradas</span>
              <p className="text-base font-black mt-0.5">
                ${Number(data?.resumen_hoy.total_monto || 0).toFixed(2)}
              </p>
              <span className="text-[10px] text-white/70">Monto del día</span>
            </div>

            <div className="bg-white/10 backdrop-blur-xs p-3 rounded-2xl border border-white/15">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">Tickets Emitidos</span>
              <p className="text-base font-black mt-0.5">
                {data?.resumen_hoy.total_tickets || 0}
              </p>
              <span className="text-[10px] text-white/70">
                {data?.resumen_hoy.tickets_anulados ? `${data.resumen_hoy.tickets_anulados} anulados` : '0 anulados'}
              </span>
            </div>

            <div className="bg-white/10 backdrop-blur-xs p-3 rounded-2xl border border-white/15">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">Fondo Inicial</span>
              <p className="text-base font-black mt-0.5">
                ${Number(data?.sesion_activa?.fondo_inicial || 0).toFixed(2)}
              </p>
              <span className="text-[10px] text-white/70">En gaveta</span>
            </div>
          </div>
        </div>

        {/* Pestañas de contenido */}
        <div className="flex border-b border-gray-200 px-5 pt-3 gap-2 bg-gray-50/50">
          <button
            onClick={() => setTab('TICKETS')}
            className={`pb-2.5 px-4 font-bold text-xs border-b-2 transition-all flex items-center gap-2 ${
              tab === 'TICKETS'
                ? 'border-quantix-600 text-quantix-600'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            Mis Tickets de Hoy ({data?.tickets_hoy.length || 0})
          </button>

          <button
            onClick={() => setTab('EVENTOS')}
            className={`pb-2.5 px-4 font-bold text-xs border-b-2 transition-all flex items-center gap-2 ${
              tab === 'EVENTOS'
                ? 'border-quantix-600 text-quantix-600'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Bitácora de Mi Turno ({data?.eventos_auditoria_hoy.length || 0})
          </button>
        </div>

        {/* Contenido scrolleable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm" role="alert">
              {error}
            </div>
          )}
          {loading && !data ? (
            <div className="py-12 text-center text-gray-400 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-quantix-500" />
              Cargando historial de tu turno...
            </div>
          ) : tab === 'TICKETS' ? (
            /* TAB TICKETS */
            data?.tickets_hoy && data.tickets_hoy.length > 0 ? (
              <div className="space-y-2">
                {data.tickets_hoy.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 bg-white border border-gray-200 hover:border-quantix-300 rounded-2xl flex items-center justify-between transition-all shadow-2xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${
                        t.estado === 'COMPLETADA' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                      }`}>
                        <Receipt className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-gray-900">{t.folio_ticket}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            t.estado === 'COMPLETADA' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {t.estado}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          Cliente: <strong>{t.cliente_nombre || 'Público General'}</strong> • {new Date(t.fecha_hora).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-mono font-black text-sm text-gray-900">
                        ${Number(t.total_pagar).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-gray-400 text-xs">
                <Receipt className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                No has emitido tickets en este turno todavía.
              </div>
            )
          ) : (
            /* TAB EVENTOS */
            data?.eventos_auditoria_hoy && data.eventos_auditoria_hoy.length > 0 ? (
              <div className="space-y-2">
                {data.eventos_auditoria_hoy.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3 bg-white border border-gray-200 rounded-2xl text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                        ev.gravedad === 'CRITICA' ? 'bg-red-100 text-red-800 border border-red-200' :
                        ev.gravedad === 'MEDIA' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                        'bg-blue-100 text-blue-800 border border-blue-200'
                      }`}>
                        {ev.tipo_evento}
                      </span>
                      <span className="text-gray-400 text-[10px] flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3" />
                        {new Date(ev.fecha_evento).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-gray-700 text-xs font-medium pt-1">
                      {ev.descripcion}
                    </p>
                    {ev.ip_terminal && (
                      <span className="text-[10px] text-gray-400 font-mono block">
                        Terminal: {ev.ip_terminal}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-gray-400 text-xs">
                <ShieldAlert className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                No hay eventos de auditoría registrados en este turno.
              </div>
            )
          )}
        </div>

        {/* Footer con botón Cerrar */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/70 flex items-center justify-between">
          <span className="text-[11px] text-gray-400">
            Registro inmutable de seguridad Quantix
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl text-xs shadow-sm transition-all"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
