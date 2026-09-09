import { useState, useEffect, useRef } from 'react';
import { 
  AlertOctagon, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  X 
} from 'lucide-react';
import { useNotificationStore, type ToastNotificacion, type SeveridadAlerta } from '../hooks/useWebSocket';

interface ToastItemProps {
  toast: ToastNotificacion;
  onDismiss: (id: string) => void;
  onMarkAsRead?: (id: string) => void;
}

function ToastItem({ toast, onDismiss, onMarkAsRead }: ToastItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [progress, setProgress] = useState(100);
  const duracion = toast.duracionMs || 5000;
  const startTimeRef = useRef<number>(0);
  const remainingTimeRef = useRef<number>(duracion);

  useEffect(() => {
    if (startTimeRef.current === 0) {
      startTimeRef.current = Date.now();
    }
    let animationFrameId: number;

    const tick = () => {
      if (!isHovered) {
        const elapsed = Date.now() - startTimeRef.current;
        const currentRemaining = Math.max(0, remainingTimeRef.current - elapsed);
        const percent = (currentRemaining / duracion) * 100;
        setProgress(percent);

        if (currentRemaining <= 0) {
          onDismiss(toast.id);
          return;
        }
      }
      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isHovered, duracion, onDismiss, toast.id]);

  const handleMouseEnter = () => {
    setIsHovered(true);
    const elapsed = Date.now() - startTimeRef.current;
    remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    startTimeRef.current = Date.now();
  };

  const getSeverityConfig = (sev: SeveridadAlerta) => {
    switch (sev) {
      case 'CRITICO':
        return {
          containerBorder: 'border-error/50 shadow-error/15',
          accentBg: 'bg-error-container text-on-error-container',
          progressColor: 'bg-error',
          badgeClass: 'bg-error text-on-error',
          icon: <AlertOctagon className="w-5 h-5 text-error" />,
          label: 'Alerta Crítica',
        };
      case 'WARNING':
        return {
          containerBorder: 'border-amber-400/50 shadow-amber-500/15',
          accentBg: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
          progressColor: 'bg-amber-500',
          badgeClass: 'bg-amber-500 text-white',
          icon: <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />,
          label: 'Advertencia',
        };
      case 'SUCCESS':
        return {
          containerBorder: 'border-primary/50 shadow-primary/15',
          accentBg: 'bg-primary-fixed/40 text-on-primary-fixed-variant',
          progressColor: 'bg-primary',
          badgeClass: 'bg-primary text-on-primary',
          icon: <CheckCircle2 className="w-5 h-5 text-primary" />,
          label: 'Operación Exitosa',
        };
      case 'INFO':
      default:
        return {
          containerBorder: 'border-surface-container-high/80 shadow-black/5',
          accentBg: 'bg-surface-container-high text-on-surface',
          progressColor: 'bg-secondary',
          badgeClass: 'bg-secondary text-on-secondary',
          icon: <Info className="w-5 h-5 text-secondary" />,
          label: 'Notificación',
        };
    }
  };

  const config = getSeverityConfig(toast.severidad);

  return (
    <div
      role="alert"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => {
        if (onMarkAsRead) onMarkAsRead(toast.id);
      }}
      className={`pointer-events-auto w-full bg-surface-container-lowest/95 backdrop-blur-xl border ${config.containerBorder} shadow-2xl rounded-2xl p-4 flex flex-col gap-2 overflow-hidden relative transition-all duration-200 hover:scale-[1.01] animate-in slide-in-from-right-8 fade-in select-none`}
    >
      <div className="flex items-start gap-3">
        {/* Icono con fondo temático */}
        <div className={`p-2.5 rounded-xl ${config.accentBg} shrink-0 shadow-xs flex items-center justify-center`}>
          {config.icon}
        </div>

        {/* Contenido Textual */}
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`px-2 py-0.5 rounded-full font-label-caps text-[9px] font-bold uppercase tracking-wider ${config.badgeClass}`}>
              {config.label}
            </span>
            <span className="font-body-sm text-[10px] text-outline">
              Ahora
            </span>
          </div>

          <h4 className="font-headline-md text-title-sm font-bold text-on-surface leading-snug">
            {toast.titulo}
          </h4>

          <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed line-clamp-3 mt-0.5">
            {toast.mensaje}
          </p>
        </div>

        {/* Botón Cerrar */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(toast.id);
          }}
          className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-full transition-colors cursor-pointer shrink-0 -mr-1 -mt-1"
          title="Cerrar notificación emergente"
          aria-label="Cerrar notificación"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Barra de progreso de autodestrucción */}
      <div className="w-full bg-surface-container-high/40 h-1 rounded-full overflow-hidden mt-1">
        <div 
          className={`h-full ${config.progressColor} transition-all ease-linear`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export default function ToastContainer() {
  const toasts = useNotificationStore((state) => state.toasts);
  const descartarToast = useNotificationStore((state) => state.descartarToast);
  const marcarComoLeida = useNotificationStore((state) => state.marcarComoLeida);

  if (toasts.length === 0) return null;

  return (
    <div 
      aria-live="polite"
      aria-atomic="true"
      className="fixed top-20 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none transition-all"
    >
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onDismiss={descartarToast}
          onMarkAsRead={marcarComoLeida}
        />
      ))}
    </div>
  );
}
