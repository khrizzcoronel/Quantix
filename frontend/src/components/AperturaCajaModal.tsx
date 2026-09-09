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
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-quantix-100 text-quantix-600 rounded-2xl shadow-inner">
              <Banknote className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900 tracking-tight">Apertura de Turno de Caja</h2>
              <p className="text-xs text-gray-500 font-medium">Requisito operativo previo a la venta</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCancelOrClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Identidad del Operador Autenticado */}
        <div className="mb-4 p-3 bg-gray-50 rounded-2xl border border-gray-200/70 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <UserCircle className="w-6 h-6 text-gray-400 shrink-0" />
            <div className="truncate">
              <span className="text-xs font-bold text-gray-900 block truncate">
                {user?.nombre || 'Operador'}
              </span>
              <span className="text-[10px] text-gray-400 font-mono block truncate">
                {user?.email || 'email@quantix.local'}
              </span>
            </div>
          </div>
          <span className="px-2.5 py-0.5 bg-quantix-100 text-quantix-700 font-black text-[10px] rounded-md uppercase tracking-wider shrink-0">
            {user?.rol || 'CAJERO'}
          </span>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-5 text-xs text-amber-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>El fondo inicial ingresado será contrastado en el <strong>arqueo ciego</strong> al cierre de tu turno.</span>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl mb-4 font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* ========================================================================= */}
          {/* CASO A: EL CAJERO NO TIENE QUE ELEGIR, YA ESTÁ ASIGNADA AUTOMÁTICAMENTE */}
          {/* ========================================================================= */}
          {isCajero ? (
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center justify-between">
                <span>Caja Asignada a tu Estación</span>
                <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Asignada Automáticamente
                </span>
              </label>
              <div className="p-3.5 bg-gray-50/80 border border-gray-200 rounded-2xl flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-white border border-gray-200 rounded-xl flex items-center justify-center text-quantix-600 shadow-2xs">
                    <Monitor className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-gray-900 text-sm">{terminalSeleccionadaObj.nombre}</div>
                    <div className="text-[11px] text-gray-500 font-mono">{terminalSeleccionadaObj.id} • {terminalSeleccionadaObj.descripcion}</div>
                  </div>
                </div>
                <div className="p-1.5 bg-gray-100 text-gray-400 rounded-lg" title="Terminal fija de tu puesto de trabajo">
                  <Lock className="w-4 h-4" />
                </div>
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* CASO B: ADMINISTRADOR / SUPERVISOR SELECCIONA CON BUSCADOR EN EL MISMO CONTROL */
            /* ========================================================================= */
            <div ref={comboboxRef} className="relative">
              <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center justify-between">
                <span>Seleccionar Terminal / Caja a Operar</span>
                <span className="text-[10px] text-purple-700 font-bold">Modo Supervisor / Director</span>
              </label>

              {/* Botón trigger del Combobox */}
              <button
                type="button"
                onClick={() => setComboboxOpen(!comboboxOpen)}
                className="w-full p-3 bg-white border border-gray-300 hover:border-quantix-400 rounded-2xl flex items-center justify-between text-left transition-colors shadow-2xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Monitor className="w-4 h-4 text-quantix-600 shrink-0" />
                  <div className="truncate">
                    <span className="font-bold text-gray-900 text-xs block truncate">
                      {terminalSeleccionadaObj.nombre}
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono block truncate">
                      Código: {terminalSeleccionadaObj.id}
                    </span>
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${comboboxOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Menú Desplegable con Buscador Integrado */}
              {comboboxOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-gray-200 shadow-2xl z-30 p-2 animate-in fade-in zoom-in-95">
                  
                  {/* Input de Búsqueda en el mismo control */}
                  <div className="relative mb-2">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      autoFocus
                      value={searchTerminal}
                      onChange={(e) => setSearchTerminal(e.target.value)}
                      placeholder="Buscar por código o nombre de caja..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-quantix-500 outline-none"
                    />
                  </div>

                  {/* Lista de Terminales */}
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {terminalesFiltradas.length === 0 ? (
                      <div className="py-3 text-center text-xs text-gray-400">
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
                          className={`w-full p-2 rounded-xl text-left text-xs flex items-center justify-between transition-colors ${
                            terminalId === term.id
                              ? 'bg-quantix-50 text-quantix-900 font-bold'
                              : 'hover:bg-gray-100 text-gray-700'
                          }`}
                        >
                          <div>
                            <div className="font-bold flex items-center gap-1.5">
                              <span>{term.nombre}</span>
                              <span className="font-mono text-[10px] px-1.5 py-0.2 bg-gray-200/80 rounded text-gray-600">
                                {term.id}
                              </span>
                            </div>
                            <div className="text-[10px] text-gray-400">{term.descripcion}</div>
                          </div>
                          {terminalId === term.id && (
                            <CheckCircle2 className="w-4 h-4 text-quantix-600 shrink-0" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Fondo Inicial */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Fondo Inicial en Gaveta ($ Efectivo Base)
            </label>
            <div className="relative">
              <span className="text-gray-400 absolute left-3.5 top-2.5 font-black text-base">$</span>
              <input
                type="number"
                step="0.50"
                min="0"
                required
                value={fondoInicial}
                onChange={(e) => setFondoInicial(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-2xl text-lg font-black text-gray-900 focus:ring-2 focus:ring-quantix-500 outline-none"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-100 mt-6">
            <button
              type="button"
              onClick={handleCancelOrClose}
              className="flex-1 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl text-xs transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3.5 bg-quantix-600 hover:bg-quantix-700 disabled:opacity-70 text-white font-bold rounded-2xl shadow-lg transition-all text-xs flex items-center justify-center gap-2 shadow-quantix-600/20"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar Apertura'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
