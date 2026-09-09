import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCajaStore } from '../store/cajaStore';
import { useAuthStore } from '../store/authStore';
import { 
  Banknote, Monitor, Loader2, AlertCircle, 
  CheckCircle2, Search, ChevronDown, UserCircle, Lock, X
} from 'lucide-react';

interface Props {
  onSuccess?: () => void;
  onClose?: () => void;
}

interface TerminalOption {
  id: string;
  nombre: string;
  descripcion: string;
}

const TERMINALES_DEFAULT: TerminalOption[] = [
  { id: 'CAJA-01', nombre: 'Caja 01 - Principal', descripcion: 'Estación física principal (Planta Baja)' },
  { id: 'CAJA-02', nombre: 'Caja 02 - Rápida / Express', descripcion: 'Cobro ágil hasta 10 artículos' },
  { id: 'CAJA-03', nombre: 'Caja 03 - Mostrador Central', descripcion: 'Atención al cliente y mayoristas' },
  { id: 'CAJA-04', nombre: 'Caja 04 - Pasillo Lateral', descripcion: 'Estación de refuerzo en horas pico' },
  { id: 'TERM-01', nombre: 'Terminal Móvil 01', descripcion: 'Dispositivo POS inalámbrico / Backup' },
];

export default function AperturaCajaModal({ onSuccess, onClose }: Props) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isCajero = user?.rol === 'CAJERO';

  const handleCancelOrClose = () => {
    if (onClose) {
      onClose();
    } else {
      navigate('/dashboard');
    }
  };

  // Si es cajero, toma la terminal asignada a su estación física automáticamente
  const terminalAsignadaDefault = localStorage.getItem('quantix_terminal_asignada') || 'CAJA-01';

  const [fondoInicial, setFondoInicial] = useState('500.00');
  const [terminalId, setTerminalId] = useState(terminalAsignadaDefault);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Estado del buscador para Administrador / Supervisor
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [searchTerminal, setSearchTerminal] = useState('');
  const comboboxRef = useRef<HTMLDivElement>(null);

  const abrirCaja = useCajaStore((state) => state.abrirCaja);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (comboboxRef.current && !comboboxRef.current.contains(event.target as Node)) {
        setComboboxOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtrado de terminales para Supervisor / Director
  const terminalesFiltradas = useMemo(() => {
    if (!searchTerminal.trim()) return TERMINALES_DEFAULT;
    const q = searchTerminal.toLowerCase();
    return TERMINALES_DEFAULT.filter(
      (t) => t.id.toLowerCase().includes(q) || t.nombre.toLowerCase().includes(q) || t.descripcion.toLowerCase().includes(q)
    );
  }, [searchTerminal]);

  const terminalSeleccionadaObj = TERMINALES_DEFAULT.find((t) => t.id === terminalId) || {
    id: terminalId,
    nombre: `Terminal ${terminalId}`,
    descripcion: 'Terminal personalizada',
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const monto = parseFloat(fondoInicial);
    if (isNaN(monto) || monto < 0) {
      setError('Ingresa un monto de fondo inicial válido');
      setLoading(false);
      return;
    }

    try {
      await abrirCaja(monto, terminalId);
      // Recordar terminal en el equipo
      localStorage.setItem('quantix_terminal_asignada', terminalId);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al aperturar la caja');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-on-surface/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-surface-container-lowest rounded-3xl shadow-2xl max-w-md w-full p-6 border border-outline-variant/30 animate-in fade-in zoom-in-95 duration-200 text-on-surface font-body-md">
        
        {/* Header Neo-Retail */}
        <div className="flex items-center justify-between pb-4 border-b border-surface-container-high/60 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary-container text-on-primary-container flex items-center justify-center shadow-xs">
              <Banknote className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-headline-md text-title-lg font-bold text-on-surface tracking-tight">
                Apertura de Turno de Caja
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant font-medium">
                Requisito operativo previo a la venta
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCancelOrClose}
            className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-full transition-colors"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Identidad del Operador Autenticado */}
        <div className="mb-4 p-3.5 bg-surface-container-low rounded-2xl border border-surface-container-high/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <UserCircle className="w-6 h-6 text-on-surface-variant shrink-0" />
            <div className="truncate">
              <span className="font-title-md text-body-sm font-bold text-on-surface block truncate">
                {user?.nombre || 'Operador'}
              </span>
              <span className="font-body-sm text-[11px] text-on-surface-variant font-mono block truncate">
                {user?.email || 'email@quantix.local'}
              </span>
            </div>
          </div>
          <span className="px-2.5 py-0.5 bg-primary-fixed/30 text-on-primary-fixed-variant font-label-caps text-[10px] font-bold rounded-full uppercase tracking-wider shrink-0">
            {user?.rol || 'CAJERO'}
          </span>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 mb-4 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>El fondo inicial ingresado será contrastado en el <strong>arqueo ciego</strong> al cierre de tu turno.</span>
        </div>

        {error && (
          <div className="bg-error-container text-on-error-container text-xs p-3 rounded-2xl mb-4 font-semibold border border-error/20">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* ========================================================================= */}
          {/* CASO A: EL CAJERO NO TIENE QUE ELEGIR, YA ESTÁ ASIGNADA AUTOMÁTICAMENTE */}
          {/* ========================================================================= */}
          {isCajero ? (
            <div>
              <label className="block font-label-caps uppercase text-on-surface-variant font-bold mb-1.5 flex items-center justify-between">
                <span>Caja Asignada a tu Estación</span>
                <span className="text-[10px] text-primary font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                  Asignada Automáticamente
                </span>
              </label>
              <div className="p-3.5 bg-surface-container-low border border-surface-container-high/60 rounded-2xl flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-surface-container-lowest border border-surface-container-high rounded-xl flex items-center justify-center text-primary shadow-xs">
                    <Monitor className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-title-md font-bold text-on-surface text-sm">{terminalSeleccionadaObj.nombre}</div>
                    <div className="font-body-sm text-[11px] text-on-surface-variant font-mono">{terminalSeleccionadaObj.id} • {terminalSeleccionadaObj.descripcion}</div>
                  </div>
                </div>
                <div className="p-1.5 bg-surface-container-high text-on-surface-variant rounded-full" title="Terminal fija de tu puesto de trabajo">
                  <Lock className="w-4 h-4" />
                </div>
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* CASO B: ADMINISTRADOR / SUPERVISOR SELECCIONA CON BUSCADOR EN EL MISMO CONTROL */
            /* ========================================================================= */
            <div ref={comboboxRef} className="relative">
              <label className="block font-label-caps uppercase text-on-surface-variant font-bold mb-1.5 flex items-center justify-between">
                <span>Seleccionar Terminal / Caja a Operar</span>
                <span className="text-[10px] text-secondary font-bold font-label-caps uppercase">Modo Supervisor / Director</span>
              </label>

              {/* Botón trigger del Combobox en estilo pill */}
              <button
                type="button"
                onClick={() => setComboboxOpen(!comboboxOpen)}
                className="w-full px-4 py-3 bg-surface-container-low border border-surface-container-high hover:border-primary/50 rounded-full flex items-center justify-between text-left transition-colors shadow-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Monitor className="w-4 h-4 text-primary shrink-0" />
                  <div className="truncate">
                    <span className="font-title-md font-bold text-on-surface text-xs block truncate">
                      {terminalSeleccionadaObj.nombre}
                    </span>
                    <span className="font-body-sm text-[10px] text-on-surface-variant font-mono block truncate">
                      Código: {terminalSeleccionadaObj.id}
                    </span>
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-on-surface-variant transition-transform ${comboboxOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Menú Desplegable con Buscador Integrado */}
              {comboboxOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-surface-container-lowest rounded-2xl border border-surface-container-high shadow-2xl z-30 p-2 animate-in fade-in zoom-in-95">
                  
                  {/* Input de Búsqueda en el mismo control (Pill) */}
                  <div className="relative mb-2">
                    <Search className="w-3.5 h-3.5 text-on-surface-variant absolute left-3 top-2.5" />
                    <input
                      type="text"
                      autoFocus
                      value={searchTerminal}
                      onChange={(e) => setSearchTerminal(e.target.value)}
                      placeholder="Buscar por código o nombre de caja..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface-container-low border border-surface-container-high rounded-full focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none text-on-surface"
                    />
                  </div>

                  {/* Lista de Terminales */}
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {terminalesFiltradas.length === 0 ? (
                      <div className="py-3 text-center text-xs text-on-surface-variant">
                        No hay cajas con ese criterio
                      </div>
                    ) : (
                      terminalesFiltradas.map((term) => (
                        <button
                          key={term.id}
                          type="button"
                          onClick={() => {
                            setTerminalId(term.id);
                            setComboboxOpen(false);
                            setSearchTerminal('');
                          }}
                          className={`w-full p-2.5 rounded-xl text-left text-xs flex items-center justify-between transition-colors ${
                            terminalId === term.id
                              ? 'bg-primary-fixed/20 text-on-primary-fixed-variant font-bold'
                              : 'hover:bg-surface-container-low text-on-surface'
                          }`}
                        >
                          <div>
                            <div className="font-bold flex items-center gap-1.5">
                              <span>{term.nombre}</span>
                              <span className="font-mono text-[10px] px-1.5 py-0.2 bg-surface-container-high rounded text-on-surface-variant">
                                {term.id}
                              </span>
                            </div>
                            <div className="text-[10px] text-on-surface-variant">{term.descripcion}</div>
                          </div>
                          {terminalId === term.id && (
                            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Fondo Inicial con Estilo Pill */}
          <div>
            <label className="block font-label-caps uppercase text-on-surface-variant font-bold mb-1.5">
              Fondo Inicial en Gaveta ($ Efectivo Base)
            </label>
            <div className="relative">
              <span className="text-on-surface-variant absolute left-4 top-2.5 font-black text-lg">$</span>
              <input
                type="number"
                step="0.50"
                min="0"
                required
                value={fondoInicial}
                onChange={(e) => setFondoInicial(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-full bg-surface-container-low border border-surface-container-high text-lg font-black font-mono text-on-surface focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none transition-all"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-surface-container-high/60 mt-6">
            <button
              type="button"
              onClick={handleCancelOrClose}
              className="flex-1 py-3 px-5 bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest font-title-md text-body-sm font-semibold rounded-full transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 px-5 bg-primary hover:opacity-95 text-on-primary font-title-md text-body-sm font-bold rounded-full shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar Apertura'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
