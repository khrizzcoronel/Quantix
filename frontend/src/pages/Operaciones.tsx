import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, CheckCircle2, AlertCircle, 
  Layers, HardDrive, Cpu, 
  Clock, Zap, FileText, Eye, X,
  ShieldCheck, ArrowRight, Database, Download
} from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { exportToCSV, formatDate, formatNumber } from '../utils/exportUtils';

interface RegistroETL {
  id: string;
  tipo_disparo: string;
  usuario_email: string;
  status: string;
  duracion_ms: number;
  origen_datos: string;
  destino_archivo: string;
  filas_bronze_ventas: number;
  filas_silver_ventas: number;
  filas_gold_ventas: number;
  filas_gold_productos: number;
  tamano_duckdb_kb: number;
  capas_detalle?: {
    bronze?: string[];
    silver?: string[];
    gold?: string[];
  };
  error?: string | null;
  creado_en: string;
}

interface EstadoETL {
  status: string;
  timestamp: string;
  archivo_duckdb: {
    path: string;
    existe: boolean;
    tamano_kb: number;
    tablas_gold: Record<string, number>;
  };
  scheduler: {
    running: boolean;
    intervalo_minutos: number;
    job_id: string;
  };
  ultima_ejecucion: {
    status: string;
    timestamp: string | null;
    duracion_ms: number;
    filas: {
      bronze_ventas?: number;
      silver_ventas?: number;
      gold_ventas?: number;
      gold_productos?: number;
    };
    error?: string | null;
  };
  historial_reciente?: RegistroETL[];
}

export default function Operaciones() {
  const { user } = useAuthStore();
  const isDirector = user?.rol === 'DIRECTOR';

  const [estado, setEstado] = useState<EstadoETL | null>(null);
  const [historial, setHistorial] = useState<RegistroETL[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [ejecutando, setEjecutando] = useState(false);
  const [nuevoIntervalo, setNuevoIntervalo] = useState<string>('5');
  const [feedback, setFeedback] = useState<{ tipo: 'success' | 'error'; mensaje: string } | null>(null);
  const [resultadoReciente, setResultadoReciente] = useState<any>(null);

  // Modal Detalle de Trazabilidad
  const [detalleLog, setDetalleLog] = useState<RegistroETL | null>(null);

  const showToast = (tipo: 'success' | 'error', mensaje: string) => {
    setFeedback({ tipo, mensaje });
    setTimeout(() => setFeedback(null), 5000);
  };

  const cargarTodo = async () => {
    await Promise.all([cargarEstado(), cargarHistorial()]);
  };

  const cargarEstado = async () => {
    try {
      setLoading(true);
      const res = await api.get('/operaciones/etl/estado');
      setEstado(res.data);
      if (res.data.scheduler?.intervalo_minutos) {
        setNuevoIntervalo(String(res.data.scheduler.intervalo_minutos));
      }
      if (res.data.historial_reciente && res.data.historial_reciente.length > 0) {
        setHistorial(res.data.historial_reciente);
      }
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || 'Error al obtener estado operativo del ETL');
    } finally {
      setLoading(false);
    }
  };

  const cargarHistorial = async () => {
    try {
      setLoadingHistorial(true);
      const res = await api.get('/operaciones/etl/historial', { params: { limit: 30 } });
      setHistorial(res.data.registros);
    } catch {
      // Dejar los datos del estado
    } finally {
      setLoadingHistorial(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => void cargarTodo());
  }, []);

  const handleDispararETL = async () => {
    try {
      setEjecutando(true);
      setResultadoReciente(null);
      const res = await api.post('/operaciones/etl/ejecutar');
      setResultadoReciente(res.data.resultado);
      showToast('success', `Pipeline Medallion ETL ejecutado en ${res.data.resultado.duracion_ms} ms`);
      cargarTodo();
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || 'Fallo crítico al ejecutar el pipeline ETL');
    } finally {
      setEjecutando(false);
    }
  };

  const handleReprogramarScheduler = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const min = parseInt(nuevoIntervalo, 10);
      if (isNaN(min) || min < 1) {
        showToast('error', 'El intervalo debe ser un número entero mayor a 0');
        return;
      }
      const res = await api.post('/operaciones/etl/reprogramar', {
        intervalo_minutos: min
      });
      showToast('success', res.data.mensaje);
      cargarEstado();
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || 'Error al actualizar frecuencia del scheduler');
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      {/* Feedback Toast */}
      {feedback && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl border text-sm font-bold ${
          feedback.tipo === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
            : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          {feedback.tipo === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}
          <span>{feedback.mensaje}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-quantix-50 text-quantix-600 rounded-2xl border border-quantix-100 shadow-sm">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 bg-purple-100 text-purple-800 rounded-md text-[10px] font-black uppercase tracking-wider">
                Estratégico • Dirección
              </span>
            </div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Sincronización de Datos</h1>
            <p className="text-gray-500 text-xs font-medium">
              Pipeline analítico Medallion (Bronze ➔ Silver ➔ Gold), trazabilidad de destinos y auditoría de cambios
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={() => {
              exportToCSV({
                filename: `bitacora_etl_medallion_${new Date().toISOString().slice(0, 10)}.csv`,
                data: historial,
                columns: [
                  { key: 'creado_en', header: 'Fecha y Hora', formatter: (v) => formatDate(v) },
                  { key: 'tipo_disparo', header: 'Tipo Disparo' },
                  { key: 'status', header: 'Estado' },
                  { key: 'duracion_ms', header: 'Duración (ms)', formatter: (v) => formatNumber(v, 2) },
                  { key: 'filas_bronze_ventas', header: 'Ventas Bronze' },
                  { key: 'filas_silver_ventas', header: 'Ventas Silver' },
                  { key: 'filas_gold_ventas', header: 'Ventas Gold' },
                  { key: 'filas_gold_productos', header: 'Productos Gold' },
                  { key: 'usuario_email', header: 'Operador / Disparador' },
                  { key: 'error', header: 'Error', formatter: (v) => v || 'Ninguno' }
                ]
              });
            }}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-xl text-xs transition-colors shadow-sm cursor-pointer"
            title="Exportar bitácora de ejecuciones ETL a CSV / Excel"
          >
            <Download className="w-3.5 h-3.5 text-quantix-600" />
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={cargarTodo}
            disabled={loading || loadingHistorial}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-xl text-xs transition-colors shadow-sm cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar Monitor</span>
          </button>
        </div>
      </div>

      {/* Tarjeta Principal: Flujo Medallion Interactivo */}
      <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-quantix-600" />
            <span>Arquitectura de Datos Medallion en Ejecución</span>
          </h2>
          <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-black">
            OLTP ➔ OLAP Activo
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          
          {/* Origen: PostgreSQL */}
          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 text-center relative group">
            <div className="w-10 h-10 bg-blue-100 text-blue-700 rounded-xl flex items-center justify-center mx-auto mb-2 font-black text-xs">
              PG
            </div>
            <h4 className="font-bold text-gray-900 text-sm">PostgreSQL (OLTP)</h4>
            <p className="text-[11px] text-gray-400 mt-1">ventas, detalles_venta, producto</p>
            <span className="mt-2 inline-block px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[10px] font-bold">
              Fuente de Verdad
            </span>
          </div>

          {/* Bronze */}
          <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200 text-center">
            <div className="w-10 h-10 bg-amber-100 text-amber-800 rounded-xl flex items-center justify-center mx-auto mb-2 font-black text-xs">
              BZ
            </div>
            <h4 className="font-bold text-amber-900 text-sm">Capa Bronze (Raw)</h4>
            <p className="text-[11px] text-amber-700 mt-1">Extracción fiel + timestamp de ingesta</p>
            <span className="mt-2 inline-block px-2 py-0.5 bg-amber-200/80 text-amber-900 rounded-md text-[10px] font-bold">
              {estado?.ultima_ejecucion?.filas?.bronze_ventas !== undefined 
                ? `${estado.ultima_ejecucion.filas.bronze_ventas} filas extraídas` 
                : 'En sincronía'}
            </span>
          </div>

          {/* Silver */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-300 text-center">
            <div className="w-10 h-10 bg-slate-200 text-slate-800 rounded-xl flex items-center justify-center mx-auto mb-2 font-black text-xs">
              AG
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Capa Silver (Clean)</h4>
            <p className="text-[11px] text-slate-600 mt-1">Limpieza: excluye anuladas y mermas</p>
            <span className="mt-2 inline-block px-2 py-0.5 bg-slate-200 text-slate-800 rounded-md text-[10px] font-bold">
              {estado?.ultima_ejecucion?.filas?.silver_ventas !== undefined 
                ? `${estado.ultima_ejecucion.filas.silver_ventas} filas limpias` 
                : 'Depuradas'}
            </span>
          </div>

          {/* Gold */}
          <div className="bg-quantix-50/80 p-4 rounded-2xl border border-quantix-200 text-center">
            <div className="w-10 h-10 bg-quantix-600 text-white rounded-xl flex items-center justify-center mx-auto mb-2 font-black text-xs shadow-md">
              AU
            </div>
            <h4 className="font-bold text-quantix-900 text-sm">Capa Gold (Star Schema)</h4>
            <p className="text-[11px] text-quantix-700 mt-1">fact_ventas, dim_producto, dim_tiempo</p>
            <span className="mt-2 inline-block px-2 py-0.5 bg-quantix-600 text-white rounded-md text-[10px] font-bold">
              {estado?.ultima_ejecucion?.filas?.gold_ventas !== undefined 
                ? `${estado.ultima_ejecucion.filas.gold_ventas} en fact_ventas` 
                : 'Listo para BI'}
            </span>
          </div>

        </div>
      </div>

      {/* Grid: Disparador Manual + Frecuencia Scheduler */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Panel 1: Ejecución Manual con Métricas */}
        <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-quantix-100 text-quantix-700 rounded-xl">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Ejecución Manual Bajo Demanda</h3>
                  <p className="text-xs text-gray-400 font-medium">Fuerza la ejecución inmediata del pipeline sin esperar al micro-batch</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 mb-4 text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 font-medium">Último estado:</span>
                <span className={`px-2.5 py-0.5 rounded-full font-black text-[11px] ${
                  estado?.ultima_ejecucion?.status === 'EXITOSO' 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : estado?.ultima_ejecucion?.status === 'ERROR'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-200 text-gray-700'
                }`}>
                  {estado?.ultima_ejecucion?.status || 'SIN REGISTRO'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 font-medium">Duración de última corrida:</span>
                <span className="font-mono font-bold text-gray-900">
                  {estado?.ultima_ejecucion?.duracion_ms ? `${estado.ultima_ejecucion.duracion_ms} ms` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 font-medium">Último timestamp:</span>
                <span className="font-mono text-gray-600 text-[11px]">
                  {estado?.ultima_ejecucion?.timestamp 
                    ? new Date(estado.ultima_ejecucion.timestamp).toLocaleString() 
                    : 'N/A'}
                </span>
              </div>
            </div>

            {/* Resultado de Ejecución Reciente si existe */}
            {resultadoReciente && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl mb-4 text-xs animate-in fade-in">
                <div className="flex items-center gap-2 text-emerald-800 font-bold mb-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>¡Sincronización completada exitosamente!</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2 text-[11px] text-emerald-900 font-mono">
                  <div>Duración: <strong>{resultadoReciente.duracion_ms} ms</strong></div>
                  <div>Gold Ventas: <strong>{resultadoReciente.filas?.gold_ventas || 0}</strong></div>
                  <div>Gold Productos: <strong>{resultadoReciente.filas?.gold_productos || 0}</strong></div>
                  <div>Bronze Extraídas: <strong>{resultadoReciente.filas?.bronze_ventas || 0}</strong></div>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleDispararETL}
            disabled={ejecutando}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 px-4 bg-quantix-600 hover:bg-quantix-700 text-white rounded-2xl font-black text-sm shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${ejecutando ? 'animate-spin' : ''}`} />
            <span>{ejecutando ? 'Ejecutando Pipeline ETL...' : 'Disparar Pipeline ETL Ahora'}</span>
          </button>
        </div>

        {/* Panel 2: Scheduler & Almacenamiento DuckDB */}
        <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">Frecuencia de Micro-Batch Automático</h3>
                <p className="text-xs text-gray-400 font-medium">Reprogramación en caliente sin reiniciar el servidor</p>
              </div>
            </div>

            <form onSubmit={handleReprogramarScheduler} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Intervalo de Ejecución (Minutos)
                </label>
                <div className="flex gap-2">
                  <select
                    value={nuevoIntervalo}
                    onChange={(e) => setNuevoIntervalo(e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-xl font-bold text-sm text-gray-800 focus:ring-2 focus:ring-quantix-500"
                  >
                    <option value="1">Cada 1 minuto (Tiempo real / Pruebas)</option>
                    <option value="5">Cada 5 minutos (Recomendado Estándar)</option>
                    <option value="10">Cada 10 minutos</option>
                    <option value="15">Cada 15 minutos</option>
                    <option value="30">Cada 30 minutos</option>
                    <option value="60">Cada 60 minutos (1 hora)</option>
                  </select>

                  {isDirector && (
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors"
                    >
                      Guardar
                    </button>
                  )}
                </div>
              </div>
            </form>

            <div className="mt-5 pt-4 border-t border-gray-100 space-y-2 text-xs">
              <div className="flex items-center justify-between text-gray-600">
                <span className="flex items-center gap-1.5 font-medium">
                  <HardDrive className="w-3.5 h-3.5 text-gray-400" />
                  Archivo Analítico Destino:
                </span>
                <span className="font-mono font-bold text-gray-800 truncate max-w-[220px]" title={estado?.archivo_duckdb?.path}>
                  {estado?.archivo_duckdb?.path || 'quantix_analytics.duckdb'}
                </span>
              </div>
              <div className="flex items-center justify-between text-gray-600">
                <span className="font-medium">Tamaño del archivo DuckDB:</span>
                <span className="font-mono font-bold text-gray-800">
                  {estado?.archivo_duckdb?.tamano_kb ? `${estado.archivo_duckdb.tamano_kb} KB` : 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between text-gray-600">
                <span className="font-medium">Tablas en Capa Gold:</span>
                <span className="font-mono text-[11px] text-quantix-700 font-bold">
                  {estado?.archivo_duckdb?.tablas_gold ? Object.keys(estado.archivo_duckdb.tablas_gold).join(', ') : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
            <span>Scheduler Status:</span>
            <span className="font-bold text-emerald-700 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {estado?.scheduler?.running ? 'APScheduler Activo' : 'Inactivo'}
            </span>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* SECCIÓN DE TRAZABILIDAD & CHANGE LOG (¿QUÉ SE GUARDÓ Y EN DÓNDE?) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-gray-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-quantix-600" />
              <span>Bitácora de Trazabilidad & Change Log del ETL</span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Registro histórico inmutable de cada sincronización: origen de datos, destinos en DuckDB, conteo de filas y duración
            </p>
          </div>

          <button
            onClick={cargarHistorial}
            disabled={loadingHistorial}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors self-start md:self-auto"
          >
            <RefreshCw className={`w-3 h-3 ${loadingHistorial ? 'animate-spin' : ''}`} />
            <span>Recargar Bitácora</span>
          </button>
        </div>

        {/* Tabla de Change Log con scroll independiente y cabecera fija */}
        <div className="overflow-x-auto rounded-2xl border border-gray-200 max-h-[500px] overflow-y-auto shadow-2xs">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-gray-50/95 backdrop-blur-sm z-10 border-b border-gray-200 shadow-2xs">
              <tr className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <th className="py-3 px-4">Fecha & Hora</th>
                <th className="py-3 px-4">Disparador / Operador</th>
                <th className="py-3 px-4">Destino de Guardado</th>
                <th className="py-3 px-4 text-center">Registros Procesados</th>
                <th className="py-3 px-4 text-right">Duración</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-right">Trazabilidad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {historial.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-gray-400 font-medium">
                    No hay registros de ejecución en la bitácora todavía. Dispara el ETL para generar la primera traza.
                  </td>
                </tr>
              ) : (
                historial.map((log) => (
                  <tr 
                    key={log.id}
                    onClick={() => setDetalleLog(log)}
                    title="Haz clic para ver el desglose forense de la sincronización"
                    className="cursor-pointer hover:bg-quantix-50/60 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-gray-800 whitespace-nowrap">
                      {new Date(log.creado_en).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900">{log.tipo_disparo}</div>
                      <div className="text-[10px] text-gray-400 truncate max-w-[160px] font-mono">{log.usuario_email}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-800 flex items-center gap-1">
                        <Database className="w-3 h-3 text-quantix-600 shrink-0" />
                        <span>quantix_analytics.duckdb</span>
                      </div>
                      <div className="text-[10px] text-quantix-600 font-mono">
                        bronze.* ➔ silver.* ➔ gold.*
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center font-mono">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md font-bold text-[11px]">
                        {log.filas_gold_ventas} ventas | {log.filas_gold_productos} prod
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-gray-700">
                      {log.duracion_ms} ms
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                        log.status === 'EXITOSO'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setDetalleLog(log)}
                        title="Ver Ficha de Trazabilidad Completa"
                        className="p-1.5 text-quantix-600 hover:bg-quantix-50 rounded-lg transition-colors font-bold text-[11px] inline-flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Ver</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL DE DETALLE DE TRAZABILIDAD (¿DÓNDE SE GUARDÓ Y QUÉ CONTIENE?) */}
      {/* ========================================================================= */}
      {detalleLog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 my-auto">
            
            {/* Header Modal */}
            <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-gradient-to-r from-quantix-50 to-white shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 bg-quantix-600 text-white rounded-md text-[10px] font-black uppercase tracking-wider">
                    Ficha Forense ETL
                  </span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    detalleLog.status === 'EXITOSO' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {detalleLog.status}
                  </span>
                </div>
                <h3 className="text-xl font-black text-gray-900 mt-1">Trazabilidad de Sincronización</h3>
                <p className="text-xs font-mono text-gray-500">ID Lote: {detalleLog.id}</p>
              </div>
              <button 
                onClick={() => setDetalleLog(null)} 
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido Modal */}
            <div className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
              
              {/* Origen y Destino */}
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-2">
                <div className="flex items-center justify-between text-gray-600">
                  <span className="font-bold uppercase text-[10px] text-gray-400">Origen de Extracción:</span>
                  <span className="font-mono font-bold text-gray-800">{detalleLog.origen_datos}</span>
                </div>
                <div className="flex items-center justify-center text-quantix-600 my-1">
                  <ArrowRight className="w-4 h-4" />
                </div>
                <div className="flex items-center justify-between text-gray-600">
                  <span className="font-bold uppercase text-[10px] text-gray-400">Destino de Almacenamiento:</span>
                  <span className="font-mono font-bold text-quantix-700">{detalleLog.destino_archivo}</span>
                </div>
              </div>

              {/* Conteo de Filas por Capa */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200">
                  <span className="text-[10px] font-bold text-amber-800 uppercase block">Capa Bronze (Raw)</span>
                  <div className="text-lg font-black text-amber-900 font-mono mt-0.5">
                    {detalleLog.filas_bronze_ventas} <span className="text-xs font-medium">ventas</span>
                  </div>
                  <span className="text-[10px] text-amber-700 mt-0.5 block">Tablas: bronze.venta, bronze.detalle_venta</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-300">
                  <span className="text-[10px] font-bold text-slate-700 uppercase block">Capa Silver (Clean)</span>
                  <div className="text-lg font-black text-slate-900 font-mono mt-0.5">
                    {detalleLog.filas_silver_ventas} <span className="text-xs font-medium">limpias</span>
                  </div>
                  <span className="text-[10px] text-slate-600 mt-0.5 block">Tablas: silver.venta_limpia, silver.producto_activo</span>
                </div>
              </div>

              <div className="p-4 bg-quantix-50/70 rounded-xl border border-quantix-200">
                <span className="text-[10px] font-bold text-quantix-800 uppercase block mb-1">
                  Capa Gold (Modelo Dimensional Analítico en DuckDB)
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono font-bold text-quantix-900">
                  <div>gold.fact_ventas: <span className="text-quantix-600 font-black">{detalleLog.filas_gold_ventas}</span> filas</div>
                  <div>gold.dim_producto: <span className="text-quantix-600 font-black">{detalleLog.filas_gold_productos}</span> filas</div>
                </div>
              </div>

              {/* Metadatos de Auditoría */}
              <div className="grid grid-cols-3 gap-2 text-[11px] bg-gray-50 p-3 rounded-xl border border-gray-100">
                <div>
                  <span className="text-gray-400 block font-bold">Disparador</span>
                  <span className="font-semibold text-gray-800">{detalleLog.tipo_disparo}</span>
                </div>
                <div>
                  <span className="text-gray-400 block font-bold">Duración</span>
                  <span className="font-mono font-bold text-gray-800">{detalleLog.duracion_ms} ms</span>
                </div>
                <div>
                  <span className="text-gray-400 block font-bold">Tamaño Archivo</span>
                  <span className="font-mono font-bold text-gray-800">{detalleLog.tamano_duckdb_kb || 0} KB</span>
                </div>
              </div>

              {detalleLog.error && (
                <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-red-800 text-[11px]">
                  <strong>Error reportado:</strong> {detalleLog.error}
                </div>
              )}

              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-blue-900 leading-relaxed text-[11px]">
                <ShieldCheck className="w-4 h-4 inline mr-1 text-blue-600" />
                <strong>Garantía de Trazabilidad:</strong> Cada sincronización registra origen, transformación y destino inmutable para auditoría y BI.
              </div>
            </div>

            {/* Footer Modal */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end shrink-0">
              <button
                onClick={() => setDetalleLog(null)}
                className="px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-200 rounded-xl transition-colors"
              >
                Cerrar Trazabilidad
              </button>
            </div>

          </div>
        </div>
      )}

      </div>
    </div>
  );
}
