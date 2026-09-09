import { useEffect, useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { BrainCircuit, Eye, X, RefreshCw, AlertTriangle } from 'lucide-react';
import api from '../services/api';
import KpiCard from '../components/ui/KpiCard';

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
    <div className="p-6 md:p-8 h-full overflow-y-auto bg-background text-on-surface select-none">
      {/* Encabezado Superior del Dashboard */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-tertiary-fixed text-on-tertiary-fixed rounded-full font-label-caps text-label-caps uppercase tracking-wider font-bold">
              Nivel Estratégico • C-Level
            </span>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-surface-container-low rounded-full">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="font-label-caps text-[11px] font-bold text-primary uppercase">
                DuckDB Gold v1.1
              </span>
            </div>
          </div>
          <h2 className="font-headline-xl text-3xl font-bold text-on-surface tracking-tight mt-2">
            Visión Ejecutiva & Rentabilidad
          </h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
            Métricas analíticas consolidadas en memoria e inferencia estadística Z/T
          </p>
        </div>

        <button
          type="button"
          onClick={cargarDashboard}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-surface-container-lowest hover:bg-surface-container text-on-surface font-title-md text-body-sm font-semibold shadow-xs border border-surface-container-high/60 transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-primary ${loading ? 'animate-spin' : ''}`} />
          <span>Actualizar DuckDB</span>
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-error-container text-on-error-container flex items-center gap-3 shadow-xs" role="alert">
          <AlertTriangle className="w-5 h-5 shrink-0 text-error" />
          <div>
            <p className="font-bold text-body-md">Datos analíticos no disponibles</p>
            <p className="font-body-sm text-body-sm opacity-90">{error}</p>
          </div>
        </div>
      )}

      {loading && !data ? (
        <div className="h-64 flex flex-col items-center justify-center gap-3 text-on-surface-variant font-title-md">
          <RefreshCw className="w-6 h-6 animate-spin text-primary" />
          <span>Consultando la capa DuckDB Gold…</span>
        </div>
      ) : data ? (
        <>
          {/* Tarjetas KPI Superiores */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
            <KpiCard
              title="Ingresos del Mes"
              value={`$${Number(data.ingresos_mes_actual).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`}
              icon="payments"
              iconColor="primary"
              delta={variacion !== null ? {
                value: `${variacion >= 0 ? '+' : ''}${variacion.toFixed(1)}% MoM`,
                isPositive: variacion >= 0,
                label: 'vs periodo anterior',
              } : undefined}
              footer={{
                label: 'Fuente de datos',
                value: 'DuckDB Gold Fact Ventas',
              }}
            />

            <KpiCard
              title="Margen Promedio"
              value={`${(Number(data.margen_promedio_mes) * 100).toFixed(2)}%`}
              icon="pie_chart"
              iconColor="secondary"
              delta={{
                value: 'Margen Bruto',
                isPositive: true,
                label: 'consolidado',
              }}
              footer={{
                label: 'Cálculo de rentabilidad',
                value: 'PVP vs Costo Promedio',
              }}
            />

            <KpiCard
              title="Variación de Serie"
              value={variacion === null ? 'N/D' : `${variacion >= 0 ? '+' : ''}${variacion.toFixed(2)}%`}
              icon="trending_up"
              iconColor={variacion && variacion >= 0 ? 'primary' : 'error'}
              delta={{
                value: '7 Días',
                isPositive: variacion !== null && variacion >= 0,
                label: 'ventana móvil',
              }}
              footer={{
                label: 'Modelo analítico',
                value: 'Suavizado Exponencial Z/T',
              }}
            />
          </div>

          {/* Sección de Gráfica de Tendencia */}
          <section className="bg-surface-container-lowest p-6 rounded-3xl border border-surface-container-high/40 shadow-sm mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-headline-md text-title-lg font-bold text-on-surface">
                  Desempeño de los Últimos 7 Días
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Evolución temporal de ventas brutas y margen neto desde la capa Gold
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-primary-fixed/20 text-on-primary-fixed-variant font-label-caps text-label-caps uppercase font-bold">
                  Ingresos
                </span>
                <span className="px-3 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-caps text-label-caps uppercase font-bold">
                  Margen
                </span>
              </div>
            </div>

            {tendencia.length === 0 ? (
              <EmptyState text="La capa Gold todavía no contiene métricas diarias registradas." />
            ) : (
              <div className="h-[340px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={tendencia}>
                    <defs>
                      <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#006c49" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#006c49" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="colorMargen" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0051d5" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#0051d5" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eaedff" />
                    <XAxis dataKey="fecha" stroke="#6c7a71" tick={{ fill: '#3c4a42', fontSize: 12 }} />
                    <YAxis stroke="#6c7a71" tick={{ fill: '#3c4a42', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        borderRadius: '16px',
                        border: '1px solid #e2e7ff',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                        fontFamily: 'Geist',
                        fontSize: '13px',
                      }}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="ventas" name="Ventas ($)" stroke="#006c49" strokeWidth={2.5} fill="url(#colorVentas)" />
                    <Area type="monotone" dataKey="margen" name="Margen ($)" stroke="#0051d5" strokeWidth={2.5} fill="url(#colorMargen)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          {/* Sección de Inferencia Predictiva Z/T */}
          <section className="bg-surface-container-lowest p-6 rounded-3xl border border-surface-container-high/40 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl bg-tertiary-fixed text-on-tertiary-fixed flex items-center justify-center">
                <BrainCircuit className="w-4 h-4" />
              </div>
              <h3 className="font-headline-md text-title-lg font-bold text-on-surface">
                Proyecciones de Demanda & Modelo Z/T
              </h3>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mb-5">
              Intervalos de confianza al 95% calculados por el motor inferencial, sin datos simulados.
            </p>

            {data.predicciones_top_productos.length === 0 ? (
              <EmptyState text="No hay histórico suficiente para generar proyecciones analíticas." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left font-body-md text-body-md border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low text-on-surface-variant font-label-caps text-label-caps uppercase tracking-wider rounded-2xl select-none">
                      <th className="py-3 px-4 rounded-l-2xl">Producto</th>
                      <th className="py-3 px-3 text-center">Muestras</th>
                      <th className="py-3 px-3 text-center">Modelo</th>
                      <th className="py-3 px-3 text-center">Demanda Media</th>
                      <th className="py-3 px-3 text-center">Intervalo IC 95%</th>
                      <th className="py-3 px-4 rounded-r-2xl text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container-low">
                    {data.predicciones_top_productos.map((row) => (
                      <tr key={row.producto_id} className="hover:bg-surface-container-low/50 transition-colors group">
                        <td className="py-3.5 px-4 font-title-md font-bold text-on-surface">
                          {row.nombre_producto}
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono font-bold text-body-sm">
                          {row.muestras_n} obs
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span className="px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface font-label-caps text-[10px] font-bold uppercase">
                            {row.distribucion_usada}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center font-label-numeric-md font-bold text-primary">
                          {row.demanda_media_diaria} uds/día
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono text-body-sm font-semibold text-secondary">
                          {row.limite_inferior_95} – {row.limite_superior_95}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSeleccionada(row)}
                            aria-label="Ver detalle estadístico"
                            className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}

      {/* Modal Detalle de Proyección Demanda */}
      {seleccionada && (
        <div className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface-container-lowest rounded-3xl p-7 max-w-md w-full shadow-2xl border border-surface-container-high/40 flex flex-col gap-5">
            <div className="flex justify-between items-start">
              <div>
                <span className="font-label-caps text-label-caps uppercase text-tertiary font-bold tracking-wider">
                  Inferencia Predictiva
                </span>
                <h3 className="font-headline-md text-title-lg font-bold text-on-surface mt-0.5">
                  {seleccionada.nombre_producto}
                </h3>
                <p className="font-mono text-body-sm text-outline">
                  ID: {seleccionada.producto_id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSeleccionada(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-body-sm">
              <Metric label="Distribución" value={seleccionada.distribucion_usada} />
              <Metric label="Muestras" value={`${seleccionada.muestras_n} observaciones`} />
              <Metric label="Demanda media" value={`${seleccionada.demanda_media_diaria} uds/día`} />
              <Metric label="Intervalo IC 95%" value={`${seleccionada.limite_inferior_95} – ${seleccionada.limite_superior_95}`} />
            </dl>

            <button
              type="button"
              onClick={() => setSeleccionada(null)}
              className="w-full py-3 rounded-full bg-primary-container text-on-primary-container font-title-md text-body-md font-bold shadow-sm hover:opacity-95 transition-all cursor-pointer"
            >
              Cerrar Detalle
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-12 text-center text-body-sm text-on-surface-variant border border-dashed border-surface-container-high rounded-2xl">
      {text}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 bg-surface-container-low rounded-2xl">
      <dt className="font-label-caps text-[10px] uppercase text-outline font-bold tracking-wider">{label}</dt>
      <dd className="font-title-md text-body-sm font-bold text-on-surface mt-1">{value}</dd>
    </div>
  );
}

