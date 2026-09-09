import { useState, useEffect, useCallback } from 'react';
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
    <div className="fixed inset-0 bg-inverse-surface/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest rounded-3xl shadow-2xl max-w-2xl w-full border border-outline-variant/30 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Cabecera */}
        <div className="p-5 border-b border-outline-variant/20 flex items-center justify-between bg-surface-container-low/40">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-primary-container text-on-primary-container flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-2xl">badge</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-headline-md text-title-lg text-on-surface">Mi Turno / Mi Actividad</h2>
                <span className="px-2.5 py-0.5 bg-primary-fixed text-on-primary-fixed font-label-caps text-label-caps rounded-full uppercase">
                  Hoy
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                Operador: <strong className="text-on-surface font-headline-md">{user?.nombre || 'Usuario'}</strong> ({user?.rol || 'CAJERO'})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cargarActividad}
              disabled={loading}
              className="w-10 h-10 rounded-full bg-surface-container-low hover:bg-surface-container text-on-surface-variant flex items-center justify-center transition-colors cursor-pointer"
              title="Actualizar actividad"
            >
              <span className={`material-symbols-outlined text-lg ${loading ? 'animate-spin text-primary' : ''}`}>
                refresh
              </span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-surface-container-low hover:bg-surface-container text-on-surface-variant flex items-center justify-center transition-colors cursor-pointer"
              title="Cerrar ventana"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
        </div>

        {/* Panel de Resumen Rápido de Turno */}
        <div className="p-5 bg-surface-container-low border-b border-outline-variant/20">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-surface-container-lowest p-3.5 rounded-2xl border border-outline-variant/20 shadow-xs">
              <span className="font-label-caps text-label-caps uppercase text-on-surface-variant block">Sesión Actual</span>
              <p className="font-headline-md text-body-md text-on-surface mt-1 truncate">
                {data?.sesion_activa ? data.sesion_activa.terminal_id : 'Sin sesión'}
              </p>
              <span className="inline-flex items-center gap-1 font-label-caps text-[10px] text-primary mt-0.5 uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                {data?.sesion_activa?.estado || 'Cerrada'}
              </span>
            </div>

            <div className="bg-surface-container-lowest p-3.5 rounded-2xl border border-outline-variant/20 shadow-xs">
              <span className="font-label-caps text-label-caps uppercase text-on-surface-variant block">Ventas Cobradas</span>
              <p className="font-label-numeric-md text-title-md font-bold text-primary mt-1">
                ${Number(data?.resumen_hoy.total_monto || 0).toFixed(2)}
              </p>
              <span className="font-body-sm text-body-sm text-on-surface-variant">Monto del día</span>
            </div>

            <div className="bg-surface-container-lowest p-3.5 rounded-2xl border border-outline-variant/20 shadow-xs">
              <span className="font-label-caps text-label-caps uppercase text-on-surface-variant block">Tickets Emitidos</span>
              <p className="font-label-numeric-md text-title-md font-bold text-on-surface mt-1">
                {data?.resumen_hoy.total_tickets || 0}
              </p>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                {data?.resumen_hoy.tickets_anulados ? `${data.resumen_hoy.tickets_anulados} anulados` : '0 anulados'}
              </span>
            </div>

            <div className="bg-surface-container-lowest p-3.5 rounded-2xl border border-outline-variant/20 shadow-xs">
              <span className="font-label-caps text-label-caps uppercase text-on-surface-variant block">Fondo Inicial</span>
              <p className="font-label-numeric-md text-title-md font-bold text-secondary mt-1">
                ${Number(data?.sesion_activa?.fondo_inicial || 0).toFixed(2)}
              </p>
              <span className="font-body-sm text-body-sm text-on-surface-variant">En gaveta</span>
            </div>
          </div>
        </div>

        {/* Pestañas de contenido con pills rounded-full */}
        <div className="flex items-center gap-2 p-4 border-b border-outline-variant/15 bg-surface-container-low/20">
          <button
            type="button"
            onClick={() => setTab('TICKETS')}
            className={`px-5 py-2 rounded-full font-headline-md text-body-sm transition-all flex items-center gap-2 cursor-pointer ${
              tab === 'TICKETS'
                ? 'bg-inverse-surface text-inverse-on-surface shadow-xs'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-base">receipt_long</span>
            <span>Mis Tickets de Hoy ({data?.tickets_hoy.length || 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('EVENTOS')}
            className={`px-5 py-2 rounded-full font-headline-md text-body-sm transition-all flex items-center gap-2 cursor-pointer ${
              tab === 'EVENTOS'
                ? 'bg-inverse-surface text-inverse-on-surface shadow-xs'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-base">shield</span>
            <span>Bitácora de Mi Turno ({data?.eventos_auditoria_hoy.length || 0})</span>
          </button>
        </div>

        {/* Contenido scrolleable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {error && (
            <div className="p-3.5 rounded-2xl bg-error-container text-on-error-container border border-error/20 text-body-sm font-medium" role="alert">
              {error}
            </div>
          )}
          {loading && !data ? (
            <div className="py-12 text-center text-on-surface-variant text-body-sm">
              <span className="material-symbols-outlined text-2xl animate-spin text-primary mx-auto mb-2 block">progress_activity</span>
              Cargando historial de tu turno...
            </div>
          ) : tab === 'TICKETS' ? (
            /* TAB TICKETS */
            data?.tickets_hoy && data.tickets_hoy.length > 0 ? (
              <div className="space-y-2.5">
                {data.tickets_hoy.map((t) => (
                  <div
                    key={t.id}
                    className="p-3.5 bg-surface-container-low/50 hover:bg-surface-container-low border border-outline-variant/20 rounded-2xl flex items-center justify-between transition-all shadow-2xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                        t.estado === 'COMPLETADA' ? 'bg-primary/10 text-primary' : 'bg-error-container text-on-error-container'
                      }`}>
                        <span className="material-symbols-outlined text-lg">receipt</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-body-sm text-on-surface">{t.folio_ticket}</span>
                          <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-label-caps uppercase ${
                            t.estado === 'COMPLETADA' ? 'bg-primary/10 text-primary' : 'bg-error-container text-on-error-container'
                          }`}>
                            {t.estado}
                          </span>
                        </div>
                        <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                          Cliente: <strong className="text-on-surface font-headline-md">{t.cliente_nombre || 'Público General'}</strong> • {new Date(t.fecha_hora).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-label-numeric-md font-bold text-title-md text-on-surface">
                        ${Number(t.total_pagar).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-on-surface-variant text-body-sm">
                <span className="material-symbols-outlined text-4xl text-on-surface-variant mx-auto mb-2 block">receipt_long</span>
                No has emitido tickets en este turno todavía.
              </div>
            )
          ) : (
            /* TAB EVENTOS */
            data?.eventos_auditoria_hoy && data.eventos_auditoria_hoy.length > 0 ? (
              <div className="space-y-2.5">
                {data.eventos_auditoria_hoy.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3.5 bg-surface-container-low/50 hover:bg-surface-container-low border border-outline-variant/20 rounded-2xl text-body-sm space-y-1.5 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`px-2.5 py-0.5 rounded-full font-label-caps text-label-caps uppercase ${
                        ev.gravedad === 'CRITICA' ? 'bg-error-container text-on-error-container' :
                        ev.gravedad === 'MEDIA' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                        'bg-secondary-fixed text-on-secondary-fixed'
                      }`}>
                        {ev.tipo_evento}
                      </span>
                      <span className="text-on-surface-variant text-body-sm flex items-center gap-1 font-mono">
                        <span className="material-symbols-outlined text-sm">schedule</span>
                        {new Date(ev.fecha_evento).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-on-surface text-body-md pt-0.5">
                      {ev.descripcion}
                    </p>
                    {ev.ip_terminal && (
                      <span className="font-mono text-body-sm text-on-surface-variant block">
                        Terminal: {ev.ip_terminal}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-on-surface-variant text-body-sm">
                <span className="material-symbols-outlined text-4xl text-on-surface-variant mx-auto mb-2 block">security</span>
                No hay eventos de auditoría registrados en este turno.
              </div>
            )
          )}
        </div>

        {/* Footer con botón Cerrar */}
        <div className="p-4 border-t border-outline-variant/20 bg-surface-container-low/40 flex items-center justify-between">
          <span className="font-body-sm text-body-sm text-on-surface-variant">
            Registro inmutable de seguridad Quantix
          </span>
          <button
            type="button"
            onClick={onClose}
            className="h-11 px-6 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-headline-md text-body-md transition-all cursor-pointer shadow-xs"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
