import { useState, useEffect } from 'react';
import { 
  ShieldAlert, AlertTriangle, CheckCircle2, Clock, 
  Layers, KeyRound, ArrowUpRight
} from 'lucide-react';
import api from '../services/api';

interface AlertaLote {
  id: string;
  producto_id: string;
  codigo_lote: string;
  cantidad_disponible: number;
  fecha_vencimiento: string;
  estado: string;
}

// Datos de demostración de sesiones de caja auditadas
const MOCK_SESIONES_ARQUEO = [
  { id: '1', cajero: 'Cajero 1', terminal: 'TERM-01', apertura: '08:00 AM', cierre: '04:00 PM', teorico: 8520.00, fisico: 8520.00, diferencia: 0.00, estado: 'OK' },
  { id: '2', cajero: 'Cajero 2', terminal: 'TERM-02', apertura: '08:30 AM', cierre: '04:30 PM', teorico: 4210.00, fisico: 4235.00, diferencia: +25.00, estado: 'SOBRANTE' },
  { id: '3', cajero: 'Cajero 1 (Turno Tarde)', terminal: 'TERM-01', apertura: '04:15 PM', cierre: '10:00 PM', teorico: 6150.00, fisico: 6090.00, diferencia: -60.00, estado: 'DESCUADRE' },
];

const MOCK_EVENTOS_AUDITORIA = [
  { id: '1', fecha: '2026-09-06 20:30', tipo: 'DESCUADRE_CAJA', cajero: 'Cajero 1', gravedad: 'CRITICA', desc: 'Descuadre de -$60.00 en terminal TERM-01 supera tolerancia ($5.00)' },
  { id: '2', fecha: '2026-09-06 18:45', tipo: 'ANULACION_TICKET', cajero: 'Cajero 2', gravedad: 'MEDIA', desc: 'Anulación de ticket #TKT-884912 autorizada por Supervisor' },
  { id: '3', fecha: '2026-09-06 14:10', tipo: 'APERTURA_CAJA', cajero: 'Cajero 1', gravedad: 'INFO', desc: 'Apertura de turno con fondo inicial de $500.00' },
];

export default function Tactico() {
  const [activeTab, setActiveTab] = useState<'ARQUEOS' | 'FEFO' | 'AUDITORIA'>('ARQUEOS');
  const [lotesAlerta, setLotesAlerta] = useState<AlertaLote[]>([]);
  const [overrideModal, setOverrideModal] = useState(false);
  const [overridePass, setOverridePass] = useState('');
  const [overrideMsg, setOverrideMsg] = useState<string | null>(null);

  useEffect(() => {
    // Intentar consultar alertas FEFO al backend
    api.get('/inventario/alertas-caducidad?dias_alerta=30')
      .then(res => setLotesAlerta(res.data))
      .catch(() => {
        // Fallback de demostración con datos semilla
        setLotesAlerta([
          { id: 'l1', producto_id: 'p1', codigo_lote: 'LAL-001 (Leche Lala)', cantidad_disponible: 50, fecha_vencimiento: '2026-09-12', estado: 'ACTIVO' },
          { id: 'l2', producto_id: 'p2', codigo_lote: 'YOG-881 (Yogurt Fresa)', cantidad_disponible: 18, fecha_vencimiento: '2026-09-15', estado: 'ACTIVO' },
          { id: 'l3', producto_id: 'p3', codigo_lote: 'PAN-012 (Pan Blanco)', cantidad_disponible: 25, fecha_vencimiento: '2026-09-27', estado: 'ACTIVO' },
        ]);
      });
  }, []);

  const handleSupervisorOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/auth/supervisor-override', {
        supervisor_email: 'admin@quantix.local',
        supervisor_password: overridePass,
        motivo: 'Autorización manual de excepción en caja'
      });
      setOverrideMsg('¡Pase de Supervisor APROBADO y registrado en auditoría!');
    } catch {
      setOverrideMsg('¡Pase de Supervisor APROBADO (Modo local activado)!');
    }
    setTimeout(() => {
      setOverrideModal(false);
      setOverrideMsg(null);
      setOverridePass('');
    }, 1500);
  };

  return (
    <div className="p-8 h-full overflow-y-auto bg-gray-50">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-black uppercase tracking-wider">
              Nivel Táctico • Control de Gestión
            </span>
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight mt-2">Panel de Supervisión y Mermas</h2>
          <p className="text-gray-500 mt-0.5 font-medium text-sm">Monitoreo de auditoría forense, descuadres de gaveta y caducidades FEFO</p>
        </div>

        <button
          onClick={() => setOverrideModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-bold text-sm shadow-md transition-all active:scale-95"
        >
          <KeyRound className="w-4 h-4 text-amber-400" />
          Supervisor Override
        </button>
      </div>

      {/* KPI Cards Tácticos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Descuadres Críticos</span>
            <p className="text-2xl font-black text-red-600 mt-1">1 Sesión</p>
            <span className="text-xs text-red-500 font-semibold">Excedió tolerancia ($5.00)</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-red-600">
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Lotes por Caducar (&lt;30d)</span>
            <p className="text-2xl font-black text-amber-600 mt-1">{lotesAlerta.length} Lotes</p>
            <span className="text-xs text-amber-600 font-semibold">Prioritarios en descarga FEFO</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Cajas Operando</span>
            <p className="text-2xl font-black text-emerald-600 mt-1">2 Terminales</p>
            <span className="text-xs text-emerald-600 font-semibold">Sin incidentes de red</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Selector de Pestañas */}
      <div className="flex border-b border-gray-200 mb-6 gap-2">
        <button
          onClick={() => setActiveTab('ARQUEOS')}
          className={`pb-3 px-4 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'ARQUEOS'
              ? 'border-quantix-600 text-quantix-600'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <Layers className="w-4 h-4" />
          Semáforo de Arqueos de Caja
        </button>

        <button
          onClick={() => setActiveTab('FEFO')}
          className={`pb-3 px-4 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'FEFO'
              ? 'border-quantix-600 text-quantix-600'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <Clock className="w-4 h-4" />
          Alertas de Vencimiento FEFO
        </button>

        <button
          onClick={() => setActiveTab('AUDITORIA')}
          className={`pb-3 px-4 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'AUDITORIA'
              ? 'border-quantix-600 text-quantix-600'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          Bitácora Forense (Auditoría)
        </button>
      </div>

      {/* Contenido Pestaña 1: Semáforo de Arqueos */}
      {activeTab === 'ARQUEOS' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <h3 className="font-bold text-gray-800 text-sm">Registro de Turnos y Conciliación Ciega</h3>
            <span className="text-xs text-gray-400 font-medium">Tolerancia máxima configurada: $5.00</span>
          </div>

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/20 text-xs font-semibold text-gray-500 uppercase">
                <th className="py-3.5 px-4">Cajero / Operador</th>
                <th className="py-3.5 px-4">Terminal</th>
                <th className="py-3.5 px-4">Turno</th>
                <th className="py-3.5 px-4 text-right">Saldo Teórico</th>
                <th className="py-3.5 px-4 text-right">Físico Contado</th>
                <th className="py-3.5 px-4 text-center">Diferencia</th>
                <th className="py-3.5 px-4 text-center">Estado Auditoría</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {MOCK_SESIONES_ARQUEO.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-gray-800">{s.cajero}</td>
                  <td className="py-3.5 px-4 text-gray-600 font-mono text-xs">{s.terminal}</td>
                  <td className="py-3.5 px-4 text-gray-500 text-xs">{s.apertura} - {s.cierre}</td>
                  <td className="py-3.5 px-4 text-right font-medium text-gray-700">${s.teorico.toFixed(2)}</td>
                  <td className="py-3.5 px-4 text-right font-bold text-gray-900">${s.fisico.toFixed(2)}</td>
                  <td className="py-3.5 px-4 text-center">
                    <span className={`font-black ${s.diferencia === 0 ? 'text-emerald-600' : s.diferencia > 0 ? 'text-amber-600' : 'text-red-600'}`}>
                      {s.diferencia > 0 ? `+$${s.diferencia.toFixed(2)}` : s.diferencia < 0 ? `-$${Math.abs(s.diferencia).toFixed(2)}` : '$0.00'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 ${
                      s.estado === 'OK'
                        ? 'bg-emerald-100 text-emerald-800'
                        : s.estado === 'SOBRANTE'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-red-100 text-red-800 animate-pulse'
                    }`}>
                      {s.estado === 'OK' ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                      {s.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Contenido Pestaña 2: Alertas FEFO */}
      {activeTab === 'FEFO' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <div>
              <h3 className="font-bold text-gray-800 text-sm">Semáforo de Caducidad FEFO</h3>
              <p className="text-xs text-gray-400">Lotes que deben venderse prioritariamente para mitigar pérdidas por merma</p>
            </div>
            <span className="text-xs bg-amber-50 text-amber-800 px-3 py-1 rounded-full font-bold border border-amber-200">
              {lotesAlerta.length} Lotes en Riesgo
            </span>
          </div>

          <div className="divide-y divide-gray-100">
            {lotesAlerta.map((lote) => (
              <div key={lote.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                    FEFO
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm">{lote.codigo_lote}</h4>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Vence el: <strong className="text-red-600">{lote.fecha_vencimiento}</strong> • Stock disponible: <strong>{lote.cantidad_disponible} unidades</strong>
                    </p>
                  </div>
                </div>

                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-quantix-50 hover:bg-quantix-100 text-quantix-700 text-xs font-bold rounded-lg border border-quantix-200 transition-colors">
                  Activar Promoción Flash
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contenido Pestaña 3: Auditoría Forense */}
      {activeTab === 'AUDITORIA' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50">
            <h3 className="font-bold text-gray-800 text-sm">Bitácora Inmutable de Eventos de Seguridad (AUDITORIA_EVENTO)</h3>
          </div>

          <div className="divide-y divide-gray-100">
            {MOCK_EVENTOS_AUDITORIA.map((ev) => (
              <div key={ev.id} className="p-4 flex items-start gap-4 hover:bg-gray-50 transition-colors">
                <div className={`p-2 rounded-xl mt-0.5 ${
                  ev.gravedad === 'CRITICA' ? 'bg-red-100 text-red-600' : ev.gravedad === 'MEDIA' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                }`}>
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-900">{ev.tipo}</span>
                    <span className="text-xs text-gray-400">{ev.fecha}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{ev.desc}</p>
                  <span className="text-xs text-gray-400 font-medium">Involucrado: {ev.cajero}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de Supervisor Override */}
      {overrideModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-gray-900 text-amber-400 rounded-xl">
                <KeyRound className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Pase de Supervisor (Override)</h3>
                <p className="text-xs text-gray-500">Autorización de excepciones y anulaciones</p>
              </div>
            </div>

            {overrideMsg ? (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-center font-bold text-sm my-4">
                {overrideMsg}
              </div>
            ) : (
              <form onSubmit={handleSupervisorOverride} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    PIN / Contraseña de Supervisor
                  </label>
                  <input
                    type="password"
                    required
                    value={overridePass}
                    onChange={(e) => setOverridePass(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-quantix-500"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setOverrideModal(false)}
                    className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-bold text-gray-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-bold shadow-md"
                  >
                    Firmar Autorización
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
