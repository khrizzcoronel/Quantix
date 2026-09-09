import { useState, useRef, useEffect } from 'react';
import { useWebSocket, mostrarToast, type SeveridadAlerta } from '../hooks/useWebSocket';

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
          bg: 'bg-error-container text-on-error-container border-error/30',
          dot: 'bg-error',
          iconName: 'warning',
          label: 'Crítico',
        };
      case 'WARNING':
        return {
          bg: 'bg-amber-100 text-amber-900 border-amber-300',
          dot: 'bg-amber-600',
          iconName: 'error_outline',
          label: 'Alerta',
        };
      case 'SUCCESS':
        return {
          bg: 'bg-primary-fixed text-on-primary-fixed border-primary/20',
          dot: 'bg-primary',
          iconName: 'check_circle',
          label: 'Éxito',
        };
      case 'INFO':
      default:
        return {
          bg: 'bg-surface-container-high text-on-surface border-outline-variant/30',
          dot: 'bg-outline',
          iconName: 'info',
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
        className={`w-10 h-10 rounded-full transition-all flex items-center justify-center relative cursor-pointer ${
          abierto
            ? 'bg-surface-container-high text-primary ring-2 ring-primary/30 shadow-xs'
            : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
        }`}
      >
        <span className="material-symbols-outlined text-xl">notifications</span>
        
        {/* Badge contador de no leídas */}
        {noLeidasCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-error text-on-error font-label-numeric-md text-[10px] font-black rounded-full flex items-center justify-center shadow-md animate-pulse">
            {noLeidasCount > 99 ? '99+' : noLeidasCount}
          </span>
        )}
      </button>

      {/* Popover / Menú Desplegable */}
      {abierto && (
        <div
          ref={popoverRef}
          className="absolute right-0 mt-3 w-96 max-w-[92vw] bg-surface-container-lowest rounded-3xl shadow-2xl border border-outline-variant/30 z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
          style={{ maxHeight: 'calc(100vh - 120px)' }}
        >
          {/* Encabezado del Popover */}
          <div className="p-4 border-b border-outline-variant/20 bg-surface-container-low/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary-container text-on-primary-container flex items-center justify-center shadow-xs">
                <span className="material-symbols-outlined text-lg">notifications</span>
              </div>
              <div>
                <h3 className="font-headline-md text-body-md text-on-surface leading-tight">
                  Notificaciones y Alertas
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                  {noLeidasCount > 0 ? `${noLeidasCount} sin leer` : 'Bandeja al día'}
                </p>
              </div>
            </div>

            {/* Botón de cierre 'X' */}
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="w-8 h-8 rounded-full bg-surface-container-low hover:bg-surface-container text-on-surface-variant flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Cerrar popover"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>

          {/* Barra de Acciones y Filtros */}
          <div className="px-4 py-2.5 border-b border-outline-variant/15 bg-surface-container-lowest flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 overflow-x-auto">
              {(['TODAS', 'CRITICO', 'WARNING', 'SUCCESS'] as const).map((filtro) => (
                <button
                  key={filtro}
                  type="button"
                  onClick={() => setFiltroSeveridad(filtro)}
                  className={`px-3 py-1 rounded-full font-headline-md text-label-caps transition-all cursor-pointer whitespace-nowrap ${
                    filtroSeveridad === filtro
                      ? 'bg-inverse-surface text-inverse-on-surface shadow-xs'
                      : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
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
                type="button"
                onClick={marcarTodasComoLeidas}
                className="h-7 px-2.5 rounded-full bg-surface-container hover:bg-surface-container-high text-primary font-headline-md text-label-caps flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap shadow-2xs"
                title="Marcar todas como leídas"
              >
                <span className="material-symbols-outlined text-sm">done_all</span>
                <span>Leídas</span>
              </button>
            )}
          </div>

          {/* Lista de Notificaciones */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[380px]">
            {notificacionesFiltradas.length === 0 ? (
              <div className="py-12 px-6 text-center flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-2xl bg-surface-container-low flex items-center justify-center text-primary mb-3">
                  <span className="material-symbols-outlined text-2xl">check_circle</span>
                </div>
                <h4 className="font-headline-md text-title-md text-on-surface">No hay notificaciones</h4>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 max-w-[220px]">
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
                    className={`p-3.5 rounded-2xl transition-all cursor-pointer flex items-start gap-3 relative border ${
                      !notif.leida 
                        ? 'bg-surface-container-low/70 border-outline-variant/30 shadow-2xs' 
                        : 'bg-surface-container-lowest border-outline-variant/15 hover:bg-surface-container-low/40'
                    }`}
                  >
                    {/* Indicador visual lateral pill de no leída */}
                    {!notif.leida && (
                      <div className="w-1.5 h-6 rounded-full bg-primary shrink-0 mt-1" />
                    )}

                    {/* Icono de severidad */}
                    <div className="mt-0.5 shrink-0">
                      <span className={`material-symbols-outlined text-lg ${
                        notif.severidad === 'CRITICO' ? 'text-error' :
                        notif.severidad === 'WARNING' ? 'text-amber-600' :
                        notif.severidad === 'SUCCESS' ? 'text-primary' : 'text-on-surface-variant'
                      }`}>
                        {config.iconName}
                      </span>
                    </div>

                    {/* Contenido */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="font-headline-md text-body-md text-on-surface truncate">
                          {notif.titulo}
                        </span>
                        <span className="font-body-sm text-body-sm text-on-surface-variant shrink-0">
                          {formatearTiempoRelativo(notif.timestamp)}
                        </span>
                      </div>
                      
                      <p className="font-body-sm text-body-sm text-on-surface-variant leading-snug break-words">
                        {notif.mensaje}
                      </p>

                      {/* Metadatos / Badges */}
                      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                        <span className={`px-2.5 py-0.5 rounded-full font-label-caps text-label-caps uppercase border ${config.bg}`}>
                          {config.label}
                        </span>
                        <span className="px-2 py-0.5 rounded-full font-mono text-[10px] text-on-surface-variant uppercase bg-surface-container">
                          {notif.tipo}
                        </span>
                      </div>
                    </div>

                    {/* Botón 'X' para descartar individual */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        eliminarNotificacion(notif.id);
                      }}
                      className="w-7 h-7 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-error flex items-center justify-center transition-colors cursor-pointer shrink-0"
                      title="Descartar notificación"
                      aria-label="Descartar notificación"
                    >
                      <span className="material-symbols-outlined text-base">close</span>
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer del Popover con botón Probar Toast y Limpiar */}
          <div className="p-3.5 border-t border-outline-variant/20 bg-surface-container-low/50 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                mostrarToast({
                  titulo: 'Alerta Emergente Activa',
                  mensaje: 'Las notificaciones tipo toast de Quantix Retail OS están operativas en tiempo real.',
                  severidad: 'SUCCESS',
                });
              }}
              className="px-3 py-1 bg-surface-container hover:bg-surface-container-high text-primary font-title-md text-[11px] font-bold rounded-full transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
              title="Disparar notificación emergente de prueba"
            >
              <span className="material-symbols-outlined text-sm">notifications_active</span>
              <span>Probar Toast</span>
            </button>

            {notificaciones.length > 0 && (
              <button
                type="button"
                onClick={limpiarNotificaciones}
                className="h-8 px-3.5 rounded-full bg-error-container hover:bg-error text-on-error-container hover:text-on-error font-headline-md text-label-caps flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-sm">delete</span>
                <span>Limpiar</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
