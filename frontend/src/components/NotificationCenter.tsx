import { useState, useRef, useEffect } from 'react';
import { 
  Bell, CheckCheck, Trash2, X, AlertOctagon, 
  AlertTriangle, CheckCircle2, Info 
} from 'lucide-react';
import { useWebSocket, type SeveridadAlerta } from '../hooks/useWebSocket';

export default function NotificationCenter() {
  const [renderedAt] = useState(() => Date.now());
  const [abierto, setAbierto] = useState(false);
  const [filtroSeveridad, setFiltroSeveridad] = useState<'TODAS' | 'CRITICO' | 'WARNING' | 'SUCCESS'>('TODAS');
  const popoverRef = useRef<HTMLDivElement>(null);
  const botonRef = useRef<HTMLButtonElement>(null);

  const {
    notificaciones,
    noLeidasCount,
    marcarComoLeida,
    marcarTodasComoLeidas,
    eliminarNotificacion,
    limpiarNotificaciones,
  } = useWebSocket();

  // Cerrar al presionar Escape o clic fuera del popover
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAbierto(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        botonRef.current &&
        !botonRef.current.contains(e.target as Node)
      ) {
        setAbierto(false);
      }
    };

    if (abierto) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [abierto]);

  // Filtrado reactivo
  const notificacionesFiltradas = notificaciones.filter((n) => {
    if (filtroSeveridad === 'TODAS') return true;
    if (filtroSeveridad === 'CRITICO') return n.severidad === 'CRITICO';
    if (filtroSeveridad === 'WARNING') return n.severidad === 'WARNING';
    if (filtroSeveridad === 'SUCCESS') return n.severidad === 'SUCCESS' || n.severidad === 'INFO';
    return true;
  });

  const getSeveridadBadge = (sev: SeveridadAlerta) => {
    switch (sev) {
      case 'CRITICO':
        return {
          bg: 'bg-red-50 border-red-200 text-red-700',
          dot: 'bg-red-500',
          icon: <AlertOctagon className="w-4 h-4 text-red-600 shrink-0" />,
          label: 'Crítico',
        };
      case 'WARNING':
        return {
          bg: 'bg-amber-50 border-amber-200 text-amber-800',
          dot: 'bg-amber-500',
          icon: <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />,
          label: 'Alerta',
        };
      case 'SUCCESS':
        return {
          bg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
          dot: 'bg-emerald-500',
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />,
          label: 'Éxito',
        };
      case 'INFO':
      default:
        return {
          bg: 'bg-blue-50 border-blue-200 text-blue-800',
          dot: 'bg-blue-500',
          icon: <Info className="w-4 h-4 text-blue-600 shrink-0" />,
          label: 'Info',
        };
    }
  };

  const formatearTiempoRelativo = (isoDate: string) => {
    try {
      const diffSegundos = Math.floor((renderedAt - new Date(isoDate).getTime()) / 1000);
      if (diffSegundos < 60) return 'Hace un momento';
      const minutos = Math.floor(diffSegundos / 60);
      if (minutos < 60) return `Hace ${minutos}m`;
      const horas = Math.floor(minutos / 60);
      if (horas < 24) return `Hace ${horas}h`;
      return new Date(isoDate).toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return 'Reciente';
    }
  };

  return (
    <div className="relative inline-block">
      {/* Botón Campana Disparador */}
      <button
        ref={botonRef}
        onClick={() => setAbierto(!abierto)}
        aria-label="Abrir centro de notificaciones"
        className={`relative p-2 rounded-xl transition-all border ${
          abierto
            ? 'bg-quantix-50 border-quantix-300 text-quantix-700 shadow-sm ring-2 ring-quantix-500/20'
            : 'bg-white border-gray-200/80 text-gray-600 hover:text-gray-900 hover:bg-gray-50 shadow-2xs'
        }`}
      >
        <Bell className="w-5 h-5" />
        
        {/* Badge contador de no leídas */}
        {noLeidasCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 bg-red-600 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-md animate-pulse">
            {noLeidasCount > 99 ? '99+' : noLeidasCount}
          </span>
        )}
      </button>

      {/* Popover / Menú Desplegable */}
      {abierto && (
        <div
          ref={popoverRef}
          className="absolute right-0 mt-2.5 w-96 max-w-[92vw] bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
          style={{ maxHeight: 'calc(100vh - 120px)' }}
        >
          {/* Encabezado del Popover */}
          <div className="p-4 border-b border-gray-100 bg-gray-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-quantix-100 text-quantix-700 rounded-xl">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-gray-900 leading-tight">
                  Notificaciones y Alertas
                </h3>
                <p className="text-[11px] text-gray-500 font-medium">
                  {noLeidasCount > 0 ? `${noLeidasCount} sin leer` : 'Bandeja al día'}
                </p>
              </div>
            </div>

            {/* Botón estándar de cierre 'X' */}
            <button
              onClick={() => setAbierto(false)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 transition-colors"
              aria-label="Cerrar popover"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Barra de Acciones y Filtros */}
          <div className="px-4 py-2.5 border-b border-gray-100 bg-white flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1">
                {(['TODAS', 'CRITICO', 'WARNING', 'SUCCESS'] as const).map((filtro) => (
                  <button
                    key={filtro}
                    onClick={() => setFiltroSeveridad(filtro)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                      filtroSeveridad === filtro
                        ? 'bg-gray-900 text-white shadow-xs'
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    {filtro === 'TODAS' && 'Todas'}
                    {filtro === 'CRITICO' && 'Críticas'}
                    {filtro === 'WARNING' && 'Alertas'}
                    {filtro === 'SUCCESS' && 'Éxito'}
                  </button>
                ))}
              </div>

              {/* Botón marcar todas como leídas */}
              {noLeidasCount > 0 && (
                <button
                  onClick={marcarTodasComoLeidas}
                  className="flex items-center gap-1 text-[11px] font-bold text-quantix-700 hover:text-quantix-800 transition-colors"
                  title="Marcar todas como leídas"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Leídas
                </button>
              )}
            </div>
          </div>

          {/* Lista de Notificaciones */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100 max-h-[380px]">
            {notificacionesFiltradas.length === 0 ? (
              <div className="py-12 px-6 text-center flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400 mb-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                </div>
                <h4 className="text-xs font-bold text-gray-800">No hay notificaciones</h4>
                <p className="text-[11px] text-gray-400 mt-1 max-w-[220px]">
                  No se registran eventos pendientes en esta categoría.
                </p>
              </div>
            ) : (
              notificacionesFiltradas.map((notif) => {
                const config = getSeveridadBadge(notif.severidad);
                return (
                  <div
                    key={notif.id}
                    onClick={() => marcarComoLeida(notif.id)}
                    className={`p-3.5 transition-all cursor-pointer flex items-start gap-3 hover:bg-gray-50 relative ${
                      !notif.leida ? 'bg-amber-50/30' : 'bg-white'
                    }`}
                  >
                    {/* Indicador visual lateral de no leída */}
                    {!notif.leida && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-quantix-600 rounded-r-md" />
                    )}

                    {/* Icono de severidad */}
                    <div className="mt-0.5">
                      {config.icon}
                    </div>

                    {/* Contenido */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="text-xs font-bold text-gray-900 truncate">
                          {notif.titulo}
                        </span>
                        <span className="text-[10px] text-gray-400 font-medium shrink-0">
                          {formatearTiempoRelativo(notif.timestamp)}
                        </span>
                      </div>
                      
                      <p className="text-[11px] text-gray-600 leading-snug break-words">
                        {notif.mensaje}
                      </p>

                      {/* Metadatos / Badges */}
                      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${config.bg}`}>
                          {config.label}
                        </span>
                        <span className="text-[9px] font-mono text-gray-400 uppercase bg-gray-100 px-1.5 py-0.5 rounded">
                          {notif.tipo}
                        </span>
                      </div>
                    </div>

                    {/* Botón 'X' para descartar individual */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        eliminarNotificacion(notif.id);
                      }}
                      className="p-1 text-gray-300 hover:text-red-500 rounded-md hover:bg-gray-100 transition-colors"
                      title="Descartar notificación"
                      aria-label="Descartar notificación"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer del Popover con botón Limpiar */}
          {notificaciones.length > 0 && (
            <div className="p-3 border-t border-gray-100 bg-gray-50/70 flex items-center justify-between">
              <span className="text-[11px] font-medium text-gray-400">
                {notificaciones.length} en total
              </span>
              <button
                onClick={limpiarNotificaciones}
                className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Limpiar Historial
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
