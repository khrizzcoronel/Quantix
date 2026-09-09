import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, DollarSign, Percent, BrainCircuit, Eye, X, RefreshCw, AlertTriangle } from 'lucide-react';
import api from '../services/api';

interface MetricaDiaria { fecha: string; total_ventas: number; margen_ganancia: number }
interface ProyeccionDemanda {
  producto_id: string;
  nombre_producto: string;
  muestras_n: number;
  distribucion_usada: string;
  demanda_media_diaria: number;
  limite_inferior_95: number;
  limite_superior_95: number;
}
interface DashboardData {
  ingresos_mes_actual: number;
  margen_promedio_mes: number;
  tendencia_ultimos_7_dias: MetricaDiaria[];
  predicciones_top_productos: ProyeccionDemanda[];
}

const getApiError = (error: unknown): string => {
  const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  return typeof detail === 'string' ? detail : 'No se pudo consultar la capa analítica.';
};

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seleccionada, setSeleccionada] = useState<ProyeccionDemanda | null>(null);

  const cargarDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/dashboard/estrategico');
      setData(response.data);
    } catch (requestError: unknown) {
      setData(null);
      setError(getApiError(requestError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => void cargarDashboard());
  }, []);

  const tendencia = useMemo(() => (data?.tendencia_ultimos_7_dias || []).map((item) => ({
    fecha: item.fecha,
    ventas: Number(item.total_ventas),
    margen: Number(item.margen_ganancia),
  })).reverse(), [data]);

  const variacion = useMemo(() => {
    if (tendencia.length < 2 || tendencia[0].ventas === 0) return null;
    return ((tendencia[tendencia.length - 1].ventas - tendencia[0].ventas) / tendencia[0].ventas) * 100;
  }, [tendencia]);

  return (
    <div className="p-8 h-full overflow-y-auto bg-gray-50 dark:bg-gray-950">
      <div className="flex items-center justify-between mb-8">
        <div>
          <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-black uppercase tracking-wider">Estratégico • Dirección</span>
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mt-2">Panel de Control</h2>
          <p className="text-gray-500 mt-1">Datos reales de DuckDB Gold e inferencia estadística Z/T</p>
        </div>
        <button type="button" onClick={cargarDashboard} disabled={loading} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs font-bold">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
        </button>
      </div>

      {error && <div className="mb-6 p-4 rounded-xl border border-red-200 bg-red-50 text-red-800 flex gap-3" role="alert"><AlertTriangle className="w-5 h-5 shrink-0" /><div><p className="font-bold">Datos analíticos no disponibles</p><p className="text-sm">{error}</p></div></div>}

      {loading && !data ? <div className="h-64 flex items-center justify-center text-gray-500">Consultando la capa Gold…</div> : data ? <>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Kpi icon={<DollarSign />} label="Ingresos del mes" value={`$${Number(data.ingresos_mes_actual).toLocaleString('es', { minimumFractionDigits: 2 })}`} />
          <Kpi icon={<Percent />} label="Margen promedio" value={`${(Number(data.margen_promedio_mes) * 100).toFixed(2)}%`} />
          <Kpi icon={<TrendingUp />} label="Variación de la serie" value={variacion === null ? 'Sin base comparable' : `${variacion >= 0 ? '+' : ''}${variacion.toFixed(2)}%`} />
        </div>

        <section className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 mb-8">
          <h3 className="text-lg font-bold">Desempeño de los últimos 7 días disponibles</h3>
          <p className="text-xs text-gray-400 mb-6">Ventas y margen consolidados desde DuckDB Gold</p>
          {tendencia.length === 0 ? <EmptyState text="La capa Gold todavía no contiene métricas diarias." /> : <div className="h-[320px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={tendencia}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="fecha" /><YAxis /><Tooltip /><Legend /><Area type="monotone" dataKey="ventas" name="Ventas ($)" stroke="#22c55e" fill="#22c55e33" /><Area type="monotone" dataKey="margen" name="Margen ($)" stroke="#3b82f6" fill="#3b82f633" /></AreaChart></ResponsiveContainer></div>}
        </section>

        <section className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2"><BrainCircuit className="w-5 h-5 text-quantix-600" /><h3 className="text-lg font-bold">Proyecciones de demanda</h3></div>
          <p className="text-xs text-gray-400 mb-4">Intervalos calculados por el backend, sin datos de demostración.</p>
          {data.predicciones_top_productos.length === 0 ? <EmptyState text="No hay histórico suficiente para generar proyecciones." /> : <div className="overflow-x-auto"><table className="w-full text-left"><thead className="border-b text-xs uppercase text-gray-500"><tr><th className="p-3">Producto</th><th className="p-3 text-center">Muestras</th><th className="p-3 text-center">Modelo</th><th className="p-3 text-center">Media</th><th className="p-3 text-center">IC 95%</th><th /></tr></thead><tbody className="divide-y dark:divide-gray-800">{data.predicciones_top_productos.map((row) => <tr key={row.producto_id}><td className="p-3 font-bold">{row.nombre_producto}</td><td className="p-3 text-center">{row.muestras_n}</td><td className="p-3 text-center">{row.distribucion_usada}</td><td className="p-3 text-center">{row.demanda_media_diaria}</td><td className="p-3 text-center">{row.limite_inferior_95} – {row.limite_superior_95}</td><td><button type="button" onClick={() => setSeleccionada(row)} aria-label="Ver detalle"><Eye className="w-4 h-4" /></button></td></tr>)}</tbody></table></div>}
        </section>
      </> : null}

      {seleccionada && <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"><div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-md w-full"><div className="flex justify-between mb-5"><div><h3 className="font-black text-lg">{seleccionada.nombre_producto}</h3><p className="text-xs text-gray-500">{seleccionada.producto_id}</p></div><button type="button" onClick={() => setSeleccionada(null)}><X className="w-5 h-5" /></button></div><dl className="grid grid-cols-2 gap-4 text-sm"><Metric label="Distribución" value={seleccionada.distribucion_usada} /><Metric label="Muestras" value={`${seleccionada.muestras_n} observaciones`} /><Metric label="Demanda media" value={`${seleccionada.demanda_media_diaria} uds/día`} /><Metric label="Intervalo 95%" value={`${seleccionada.limite_inferior_95} – ${seleccionada.limite_superior_95}`} /></dl></div></div>}
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 flex gap-4 items-center"><div className="w-12 h-12 rounded-xl bg-quantix-50 text-quantix-600 flex items-center justify-center">{icon}</div><div><p className="text-xs uppercase font-bold text-gray-400">{label}</p><p className="text-2xl font-black">{value}</p></div></div>;
}
function EmptyState({ text }: { text: string }) { return <div className="py-12 text-center text-sm text-gray-500 border border-dashed rounded-xl">{text}</div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl"><dt className="text-xs text-gray-500">{label}</dt><dd className="font-bold mt-1">{value}</dd></div>; }
