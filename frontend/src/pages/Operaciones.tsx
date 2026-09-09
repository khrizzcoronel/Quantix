import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, CheckCircle2, AlertCircle, 
  Layers, HardDrive, Cpu, 
  Clock, Zap, FileText, Eye, X,
  ShieldCheck, ArrowRight, Database, Download,
  AlertTriangle, WifiOff, Check, Search, ShieldAlert
} from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { exportToCSV, formatDate, formatNumber } from '../utils/exportUtils';
import { mostrarToast } from '../hooks/useWebSocket';

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

export interface IncidenciaSync {
  id: string;
  venta_offline_id: string;
  id_local: string;
  tipo: string;
  detalle: string;
  resuelto: boolean;
  creado_en: string;
  resuelto_por?: string | null;
  resuelto_en?: string | null;
  nota_resolucion?: string | null;
}

export default function Operaciones() {
  const { user } = useAuthStore();
  const isDirector = user?.rol === 'DIRECTOR';
  const isSupervisorOrDirector = user?.rol === 'SUPERVISOR' || user?.rol === 'DIRECTOR';

  // Navegación por pestañas
  const [activeTab, setActiveTab] = useState<'etl' | 'conflictos'>('etl');

  // Estado ETL Medallion
  const [estado, setEstado] = useState<EstadoETL | null>(null);
  const [historial, setHistorial] = useState<RegistroETL[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [ejecutando, setEjecutando] = useState(false);
  const [nuevoIntervalo, setNuevoIntervalo] = useState<string>('5');
  const [feedback, setFeedback] = useState<{ tipo: 'success' | 'error'; mensaje: string } | null>(null);
  const [resultadoReciente, setResultadoReciente] = useState<any>(null);
  const [detalleLog, setDetalleLog] = useState<RegistroETL | null>(null);

  // Estado Supervisión de Conflictos Offline
  const [conflictos, setConflictos] = useState<IncidenciaSync[]>([]);
  const [loadingConflictos, setLoadingConflictos] = useState(false);
  const [filtroConflicto, setFiltroConflicto] = useState<'Todos' | 'Pendientes' | 'Resueltos'>('Todos');
  const [busquedaConflicto, setBusquedaConflicto] = useState('');
  const [modalResolver, setModalResolver] = useState<IncidenciaSync | null>(null);
  const [accionResolucion, setAccionResolucion] = useState<'AJUSTE_AUTOMATICO' | 'FORZAR_VENTA' | 'DESCARTAR'>('AJUSTE_AUTOMATICO');
  const [notaResolucion, setNotaResolucion] = useState('');
  const [guardandoResolucion, setGuardandoResolucion] = useState(false);

  const showToast = (tipo: 'success' | 'error', mensaje: string) => {
    setFeedback({ tipo, mensaje });
    mostrarToast({
      titulo: tipo === 'success' ? 'Operaciones & ETL' : 'Error en Operaciones',
      mensaje,
      severidad: tipo === 'success' ? 'SUCCESS' : 'CRITICO',
    });
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

  const cargarConflictos = async () => {
    try {
      setLoadingConflictos(true);
      // solo_pendientes: false para obtener el universo completo y filtrar visualmente
      const res = await api.get('/sync/conflictos', { params: { solo_pendientes: false } });
      setConflictos(res.data);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setConflictos([]);
      } else {
        showToast('error', err.response?.data?.detail || 'Error al cargar conflictos de sincronización');
      }
    } finally {
      setLoadingConflictos(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void cargarTodo();
      void cargarConflictos();
    });
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

  const handleResolverConflicto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalResolver) return;

    const nota = notaResolucion.trim();
    if (!nota) {
      showToast('error', 'Debes ingresar una nota de resolución explicativa');
      return;
    }

    try {
      setGuardandoResolucion(true);
      await api.post(`/sync/conflictos/${modalResolver.id}/resolver`, {
        accion: accionResolucion,
        nota_resolucion: nota
      });
      showToast('success', `Incidencia de venta ${modalResolver.id_local.slice(0, 8)}... resuelta con éxito (${accionResolucion})`);
      setModalResolver(null);
      setNotaResolucion('');
      setAccionResolucion('AJUSTE_AUTOMATICO');
      await cargarConflictos();
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || 'Error al resolver la incidencia de sincronización');
    } finally {
      setGuardandoResolucion(false);
    }
  };

  const getBadgeTipoConflicto = (tipo: string) => {
    switch (tipo.toUpperCase()) {
      case 'STOCK_INSUFICIENTE':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'SESION_INVALIDA':
      case 'SESION_CERRADA':
        return 'bg-purple-100 text-purple-900 border-purple-300';
      case 'PRODUCTO_NO_ENCONTRADO':
        return 'bg-blue-100 text-blue-900 border-blue-300';
      case 'MONTO_DISCORDANTE':
        return 'bg-cyan-100 text-cyan-900 border-cyan-300';
      default:
        return 'bg-rose-100 text-rose-900 border-rose-300';
    }
  };

  // Conteo y filtrado de conflictos
  const totalConflictos = conflictos.length;
  const pendientesCount = conflictos.filter((c) => !c.resuelto).length;
  const resueltosCount = conflictos.filter((c) => c.resuelto).length;

  const conflictosFiltrados = conflictos.filter((c) => {
    if (filtroConflicto === 'Pendientes' && c.resuelto) return false;
    if (filtroConflicto === 'Resueltos' && !c.resuelto) return false;

    if (busquedaConflicto.trim()) {
      const q = busquedaConflicto.toLowerCase();
      const matchId = c.id_local?.toLowerCase().includes(q);
      const matchTipo = c.tipo?.toLowerCase().includes(q);
      const matchDetalle = c.detalle?.toLowerCase().includes(q);
      const matchNota = c.nota_resolucion?.toLowerCase().includes(q);
      return matchId || matchTipo || matchDetalle || matchNota;
    }

    return true;
  });

  const handleExportarConflictos = () => {
    exportToCSV({
      filename: `conflictos_sync_offline_${new Date().toISOString().slice(0, 10)}.csv`,
      data: conflictosFiltrados,
      columns: [
        { key: 'id_local', header: 'UUID Venta Offline' },
        { key: 'tipo', header: 'Tipo Incidencia' },
        { key: 'detalle', header: 'Detalle Conflicto' },
        { key: 'resuelto', header: 'Estado', formatter: (v) => (v ? 'Resuelto' : 'Pendiente') },
        { key: 'creado_en', header: 'Fecha Creación', formatter: (v) => formatDate(v) },
        { key: 'resuelto_en', header: 'Fecha Resolución', formatter: (v) => formatDate(v) },
        { key: 'nota_resolucion', header: 'Nota Resolución', formatter: (v) => v || 'N/A' }
      ]
    });
  };

  return (
    <div className="h-full overflow-y-auto bg-background text-on-surface p-6 md:p-8 select-none">
      <div className="w-full space-y-6 animate-in fade-in duration-300">
      
      {/* Feedback Toast */}
      {feedback && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl border text-body-sm font-bold ${
          feedback.tipo === 'success' 
            ? 'bg-primary-fixed/30 text-on-primary-fixed-variant border-primary-fixed' 
            : 'bg-error-container text-on-error-container border-error'
        }`}>
          {feedback.tipo === 'success' ? <CheckCircle2 className="w-5 h-5 text-primary" /> : <AlertCircle className="w-5 h-5 text-error" />}
          <span>{feedback.mensaje}</span>
        </div>
      )}

      {/* Header General */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-surface-container-high/60 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-surface-container-low text-primary rounded-2xl flex items-center justify-center shadow-xs">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="px-2.5 py-0.5 bg-tertiary-fixed text-on-tertiary-fixed rounded-full font-label-caps text-[10px] font-bold uppercase tracking-wider">
                Nivel Estratégico • Operaciones
              </span>
            </div>
            <h1 className="font-headline-xl text-2xl md:text-3xl font-bold text-on-surface tracking-tight">
              Centro de Operaciones & Sincronización
            </h1>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Pipeline analítico Medallion (Bronze ➔ Silver ➔ Gold) y resolución de conflictos offline
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <button
            onClick={() => {
              if (activeTab === 'etl') {
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
              } else {
                handleExportarConflictos();
              }
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface-container-lowest border border-surface-container-high hover:bg-surface-container text-on-surface font-title-md rounded-full text-body-sm transition-all shadow-xs cursor-pointer"
            title="Exportar a CSV / Excel"
          >
            <Download className="w-4 h-4 text-primary" />
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={() => {
              if (activeTab === 'etl') {
                cargarTodo();
              } else {
                cargarConflictos();
              }
            }}
            disabled={activeTab === 'etl' ? (loading || loadingHistorial) : loadingConflictos}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface-container-lowest border border-surface-container-high hover:bg-surface-container text-on-surface font-title-md rounded-full text-body-sm transition-all shadow-xs cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-primary ${(activeTab === 'etl' ? loading : loadingConflictos) ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* Pestañas de Navegación */}
      <div className="flex flex-wrap items-center gap-2 border-b border-surface-container-high/60 pb-3">
        <button
          onClick={() => setActiveTab('etl')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-title-md text-body-sm transition-all cursor-pointer ${
            activeTab === 'etl'
              ? 'bg-primary-container text-on-primary-container font-bold shadow-sm'
              : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Pipeline ETL Medallion</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('conflictos');
            if (conflictos.length === 0) cargarConflictos();
          }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-title-md text-body-sm transition-all cursor-pointer relative ${
            activeTab === 'conflictos'
              ? 'bg-primary-container text-on-primary-container font-bold shadow-sm'
              : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
          }`}
        >
          <WifiOff className="w-4 h-4" />
          <span>Supervisión de Conflictos Offline</span>
          {pendientesCount > 0 && (
            <span className={`px-2 py-0.5 rounded-full font-label-caps text-[10px] font-bold ${
              activeTab === 'conflictos'
                ? 'bg-surface-container-lowest text-on-surface'
                : 'bg-amber-200 text-amber-950'
            }`}>
              {pendientesCount}
            </span>
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* PESTAÑA 1: PIPELINE ETL MEDALLION */}
      {/* ========================================================================= */}
      {activeTab === 'etl' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
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
                className="w-full flex items-center justify-center gap-2.5 py-3.5 px-4 bg-quantix-600 hover:bg-quantix-700 text-white rounded-2xl font-black text-sm shadow-md transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
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
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors cursor-pointer"
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

          {/* Sección de Trazabilidad & Change Log */}
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
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors self-start md:self-auto cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${loadingHistorial ? 'animate-spin' : ''}`} />
                <span>Recargar Bitácora</span>
              </button>
            </div>

            {/* Tabla de Change Log */}
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
                            className="p-1.5 text-quantix-600 hover:bg-quantix-50 rounded-lg transition-colors font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
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

        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 2: SUPERVISIÓN DE CONFLICTOS OFFLINE */}
      {/* ========================================================================= */}
      {activeTab === 'conflictos' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* Tarjetas KPI de Conflictos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Total Incidencias */}
            <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Incidencias</p>
                <h3 className="text-2xl font-black text-gray-900 mt-1 font-mono">{totalConflictos}</h3>
                <p className="text-[11px] text-gray-500 mt-0.5">Reportadas por backend</p>
              </div>
              <div className="p-3 bg-gray-100 text-gray-700 rounded-2xl">
                <Database className="w-6 h-6" />
              </div>
            </div>

            {/* Pendientes de Resolución */}
            <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Pendientes</p>
                  {pendientesCount > 0 && (
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  )}
                </div>
                <h3 className="text-2xl font-black text-amber-600 mt-1 font-mono">{pendientesCount}</h3>
                <p className="text-[11px] text-amber-700/80 mt-0.5">Requieren auditoría</p>
              </div>
              <div className="p-3 bg-amber-50 text-amber-600 border border-amber-200 rounded-2xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </div>

            {/* Resueltas */}
            <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Resueltas</p>
                <h3 className="text-2xl font-black text-emerald-600 mt-1 font-mono">{resueltosCount}</h3>
                <p className="text-[11px] text-emerald-700/80 mt-0.5">Auditadas exitosamente</p>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-2xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>

            {/* Permisos de Supervisión */}
            <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-quantix-700 uppercase tracking-wider">Rol de Auditoría</p>
                <h3 className="text-base font-black text-gray-900 mt-1">{user?.rol || 'INVITADO'}</h3>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {isSupervisorOrDirector ? 'Resolución habilitada' : 'Solo lectura'}
                </p>
              </div>
              <div className="p-3 bg-quantix-50 text-quantix-600 border border-quantix-200 rounded-2xl">
                <ShieldCheck className="w-6 h-6" />
              </div>
            </div>

          </div>

          {/* Tabla de Supervisión de Conflictos */}
          <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <WifiOff className="w-5 h-5 text-quantix-600" />
                  <span>Bitácora de Conflictos e Incidencias Offline</span>
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Ventas registradas localmente en contingencia que reportaron discrepancias al sincronizar con el servidor central
                </p>
              </div>

              {/* Filtros de Estado & Búsqueda */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200 text-xs font-bold">
                  {(['Todos', 'Pendientes', 'Resueltos'] as const).map((filtro) => {
                    const count = filtro === 'Todos' 
                      ? totalConflictos 
                      : filtro === 'Pendientes' 
                      ? pendientesCount 
                      : resueltosCount;
                    return (
                      <button
                        key={filtro}
                        onClick={() => setFiltroConflicto(filtro)}
                        className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                          filtroConflicto === filtro
                            ? 'bg-white text-gray-900 shadow-xs'
                            : 'text-gray-500 hover:text-gray-900'
                        }`}
                      >
                        {filtro} ({count})
                      </button>
                    );
                  })}
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={busquedaConflicto}
                    onChange={(e) => setBusquedaConflicto(e.target.value)}
                    placeholder="Filtrar por UUID o detalle..."
                    className="pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:ring-2 focus:ring-quantix-500 outline-none w-52 font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Contenedor de la Tabla */}
            <div className="overflow-x-auto rounded-2xl border border-gray-200 max-h-[550px] overflow-y-auto shadow-2xs">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-gray-50/95 backdrop-blur-sm z-10 border-b border-gray-200 shadow-2xs">
                  <tr className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    <th className="py-3 px-4">UUID Local (id_local)</th>
                    <th className="py-3 px-4">Tipo Incidencia</th>
                    <th className="py-3 px-4">Detalle del Conflicto</th>
                    <th className="py-3 px-4 whitespace-nowrap">Fecha Reporte</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4">Resolución & Auditoría</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {loadingConflictos ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-500">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-quantix-600 mb-2" />
                        <span className="font-semibold">Cargando incidencias de sincronización...</span>
                      </td>
                    </tr>
                  ) : conflictosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-400 font-medium">
                        {filtroConflicto === 'Pendientes' ? (
                          <div className="flex flex-col items-center gap-1.5">
                            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                            <span className="text-gray-700 font-bold">¡Sin conflictos pendientes!</span>
                            <span className="text-[11px] text-gray-400">Todas las transacciones offline se encuentran sincronizadas o resueltas.</span>
                          </div>
                        ) : (
                          <span>No se encontraron registros de incidencias con los filtros actuales.</span>
                        )}
                      </td>
                    </tr>
                  ) : (
                    conflictosFiltrados.map((conf) => (
                      <tr key={conf.id} className="hover:bg-quantix-50/40 transition-colors">
                        
                        {/* id_local */}
                        <td className="py-3.5 px-4 font-mono font-bold text-gray-800 whitespace-nowrap">
                          <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded-md text-[11px] border border-gray-200">
                            {conf.id_local}
                          </span>
                        </td>

                        {/* Tipo */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border tracking-wider ${getBadgeTipoConflicto(conf.tipo)}`}>
                            {conf.tipo}
                          </span>
                        </td>

                        {/* Detalle */}
                        <td className="py-3.5 px-4 max-w-xs md:max-w-md">
                          <p className="text-gray-800 font-medium leading-relaxed break-words">
                            {conf.detalle}
                          </p>
                        </td>

                        {/* Fecha Reporte */}
                        <td className="py-3.5 px-4 font-mono text-[11px] text-gray-600 whitespace-nowrap">
                          {new Date(conf.creado_en).toLocaleString()}
                        </td>

                        {/* Estado */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {conf.resuelto ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full font-black text-[10px]">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Resuelto
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full font-black text-[10px]">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                              Pendiente
                            </span>
                          )}
                        </td>

                        {/* Resolución & Acciones */}
                        <td className="py-3.5 px-4">
                          {conf.resuelto ? (
                            <div className="space-y-1">
                              <div className="flex items-start gap-1.5 text-emerald-900 bg-emerald-50/80 p-2 rounded-xl border border-emerald-200 max-w-sm">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                <div>
                                  <p className="font-semibold text-xs leading-snug">
                                    {conf.nota_resolucion || 'Resuelto sin notas'}
                                  </p>
                                  {conf.resuelto_en && (
                                    <span className="text-[10px] text-emerald-700/80 font-mono block mt-0.5">
                                      Resuelto: {new Date(conf.resuelto_en).toLocaleString()}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div>
                              {isSupervisorOrDirector ? (
                                <button
                                  onClick={() => {
                                    setModalResolver(conf);
                                    setNotaResolucion('');
                                  }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-quantix-600 hover:bg-quantix-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer active:scale-95 whitespace-nowrap"
                                  title="Ingresar nota de resolución y solventar conflicto"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Resolver Incidencia</span>
                                </button>
                              ) : (
                                <span className="text-[11px] text-gray-400 italic">
                                  Requiere Supervisor o Director
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE RESOLUCIÓN DE INCIDENCIA OFFLINE */}
      {/* ========================================================================= */}
      {modalResolver && (
        <div className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in overflow-y-auto">
          <div className="bg-surface-container-lowest rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-surface-container-high/40 animate-in zoom-in-95 my-auto">
            <div className="p-6 border-b border-surface-container-low flex justify-between items-start bg-surface-container-low/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-900 dark:text-amber-200 flex items-center justify-center">
                  <ShieldAlert className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <span className="px-2.5 py-0.5 bg-amber-500/15 text-amber-900 dark:text-amber-200 rounded-full font-label-caps text-[10px] font-bold uppercase tracking-wider">
                    Auditoría & Sync
                  </span>
                  <h3 className="font-headline-md text-title-lg font-bold text-on-surface mt-1">Resolver Conflicto Offline</h3>
                  <p className="font-body-sm font-mono text-outline">Resolución de incidencia y trazabilidad</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setModalResolver(null);
                  setNotaResolucion('');
                }}
                className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-full cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResolverConflicto} className="p-6 space-y-4 text-body-sm">
              <div className="p-4 bg-surface-container-low rounded-2xl border border-surface-container-high/40 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-label-caps text-[10px] text-outline font-bold uppercase">UUID Venta Local:</span>
                  <span className="font-mono font-bold text-on-surface text-[11px]">{modalResolver.id_local}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-label-caps text-[10px] text-outline font-bold uppercase">Tipo de Conflicto:</span>
                  <span className={`px-2.5 py-0.5 rounded-full font-label-caps text-[10px] font-bold uppercase border ${getBadgeTipoConflicto(modalResolver.tipo)}`}>
                    {modalResolver.tipo}
                  </span>
                </div>
                <div className="pt-2 border-t border-surface-container-high/40">
                  <span className="font-label-caps text-[10px] text-outline font-bold uppercase block mb-1">Motivo Reportado:</span>
                  <p className="text-on-surface bg-surface-container-lowest p-3 rounded-2xl border border-surface-container-high/40 font-medium">
                    {modalResolver.detalle}
                  </p>
                </div>
                <div className="text-[10px] text-outline font-mono">
                  Registrado el: {new Date(modalResolver.creado_en).toLocaleString()}
                </div>
              </div>

              <div>
                <label className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-bold block mb-1.5">
                  Acción Resolutiva <span className="text-error">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAccionResolucion('AJUSTE_AUTOMATICO')}
                    className={`p-3 rounded-2xl text-left border transition-all cursor-pointer ${
                      accionResolucion === 'AJUSTE_AUTOMATICO'
                        ? 'bg-primary-fixed/30 border-primary text-on-primary-fixed-variant shadow-xs ring-1 ring-primary'
                        : 'bg-surface-container-low border-surface-container-high/60 text-on-surface hover:bg-surface-container'
                    }`}
                  >
                    <div className="font-title-md text-xs font-bold">Ajuste de Stock</div>
                    <div className="text-[10px] opacity-75 mt-0.5">Crear lote de ajuste contable FEFO</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccionResolucion('FORZAR_VENTA')}
                    className={`p-3 rounded-2xl text-left border transition-all cursor-pointer ${
                      accionResolucion === 'FORZAR_VENTA'
                        ? 'bg-secondary-fixed/30 border-secondary text-on-secondary-fixed-variant shadow-xs ring-1 ring-secondary'
                        : 'bg-surface-container-low border-surface-container-high/60 text-on-surface hover:bg-surface-container'
                    }`}
                  >
                    <div className="font-title-md text-xs font-bold">Forzar Venta</div>
                    <div className="text-[10px] opacity-75 mt-0.5">Registrar venta oficial</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccionResolucion('DESCARTAR')}
                    className={`p-3 rounded-2xl text-left border transition-all cursor-pointer ${
                      accionResolucion === 'DESCARTAR'
                        ? 'bg-error-container border-error text-on-error-container shadow-xs ring-1 ring-error'
                        : 'bg-surface-container-low border-surface-container-high/60 text-on-surface hover:bg-surface-container'
                    }`}
                  >
                    <div className="font-title-md text-xs font-bold">Descartar Venta</div>
                    <div className="text-[10px] opacity-75 mt-0.5">Rechazar registro offline</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-bold block mb-1.5">
                  Nota de Resolución <span className="text-error">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={notaResolucion}
                  onChange={(e) => setNotaResolucion(e.target.value)}
                  placeholder="Explica la acción técnica o comercial adoptada para solventar la discrepancia (ej. merma justificada, ajuste de inventario realizado, venta confirmada)..."
                  className="w-full p-3.5 bg-surface-container-low rounded-2xl font-title-md text-body-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-all border border-surface-container-high/40 resize-none font-medium"
                />
                <p className="text-[11px] text-outline mt-1">
                  Esta nota quedará vinculada permanentemente con tu usuario ({user?.nombre || user?.email}) para auditoría forense.
                </p>
              </div>

              <div className="pt-3 border-t border-surface-container-low flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={guardandoResolucion}
                  onClick={() => {
                    setModalResolver(null);
                    setNotaResolucion('');
                  }}
                  className="px-4 py-2 font-title-md text-body-sm font-bold text-on-surface hover:bg-surface-container rounded-full cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoResolucion || !notaResolucion.trim()}
                  className="flex items-center gap-2 px-5 py-2 font-title-md text-body-sm font-bold bg-primary hover:opacity-95 disabled:opacity-50 text-on-primary rounded-full cursor-pointer transition-all shadow-xs"
                >
                  <Check className={`w-3.5 h-3.5 ${guardandoResolucion ? 'animate-spin' : ''}`} />
                  <span>{guardandoResolucion ? 'Guardando...' : 'Confirmar Resolución'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE DETALLE DE TRAZABILIDAD ETL */}
      {/* ========================================================================= */}
      {detalleLog && (
        <div className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in overflow-y-auto">
          <div className="bg-surface-container-lowest rounded-3xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-surface-container-high/40 animate-in zoom-in-95 my-auto">
            
            {/* Header Modal */}
            <div className="p-6 border-b border-surface-container-low flex justify-between items-start bg-surface-container-low/50 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 bg-primary text-on-primary rounded-full font-label-caps text-[10px] font-bold uppercase tracking-wider">
                    Ficha Forense ETL
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full font-label-caps text-[10px] font-bold uppercase ${
                    detalleLog.status === 'EXITOSO' ? 'bg-primary-fixed/30 text-on-primary-fixed-variant' : 'bg-error-container text-on-error-container'
                  }`}>
                    {detalleLog.status}
                  </span>
                </div>
                <h3 className="font-headline-md text-title-lg font-bold text-on-surface mt-1.5">Trazabilidad de Sincronización</h3>
                <p className="font-body-sm font-mono text-outline">ID Lote: {detalleLog.id}</p>
              </div>
              <button 
                onClick={() => setDetalleLog(null)} 
                className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-full cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido Modal */}
            <div className="p-6 space-y-4 text-body-sm overflow-y-auto flex-1">
              
              {/* Origen y Destino */}
              <div className="p-4 bg-surface-container-low rounded-2xl border border-surface-container-high/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-label-caps text-[10px] text-outline font-bold uppercase">Origen de Extracción:</span>
                  <span className="font-mono font-bold text-on-surface">{detalleLog.origen_datos}</span>
                </div>
                <div className="flex items-center justify-center text-primary my-1">
                  <ArrowRight className="w-4 h-4" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-label-caps text-[10px] text-outline font-bold uppercase">Destino de Almacenamiento:</span>
                  <span className="font-mono font-bold text-primary">{detalleLog.destino_archivo}</span>
                </div>
              </div>

              {/* Conteo de Filas por Capa */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-surface-container-low rounded-2xl border border-surface-container-high/40">
                  <span className="font-label-caps text-[10px] text-outline font-bold uppercase block mb-1">Capa Bronze (Raw)</span>
                  <div className="font-headline-md text-title-lg font-black text-on-surface font-mono">
                    {detalleLog.filas_bronze_ventas} <span className="text-body-sm font-medium font-sans text-on-surface-variant">ventas</span>
                  </div>
                  <span className="font-mono text-[10px] text-outline mt-1 block">bronze.venta, bronze.detalle_venta</span>
                </div>

                <div className="p-4 bg-surface-container-low rounded-2xl border border-surface-container-high/40">
                  <span className="font-label-caps text-[10px] text-outline font-bold uppercase block mb-1">Capa Silver (Clean)</span>
                  <div className="font-headline-md text-title-lg font-black text-on-surface font-mono">
                    {detalleLog.filas_silver_ventas} <span className="text-body-sm font-medium font-sans text-on-surface-variant">limpias</span>
                  </div>
                  <span className="font-mono text-[10px] text-outline mt-1 block">silver.venta_limpia, silver.producto_activo</span>
                </div>
              </div>

              <div className="p-4 bg-surface-container-low rounded-2xl border border-surface-container-high/40">
                <span className="font-label-caps text-[10px] text-outline font-bold uppercase block mb-1.5">
                  Capa Gold (Modelo Dimensional Analítico en DuckDB)
                </span>
                <div className="grid grid-cols-2 gap-2 font-mono text-body-sm font-bold text-on-surface">
                  <div>gold.fact_ventas: <span className="text-primary font-black">{detalleLog.filas_gold_ventas}</span> filas</div>
                  <div>gold.dim_producto: <span className="text-primary font-black">{detalleLog.filas_gold_productos}</span> filas</div>
                </div>
              </div>

              {/* Metadatos de Auditoría */}
              <div className="grid grid-cols-3 gap-3 bg-surface-container-low p-4 rounded-2xl border border-surface-container-high/40">
                <div>
                  <span className="font-label-caps text-[10px] text-outline font-bold uppercase block mb-1">Disparador</span>
                  <span className="font-title-md text-body-sm font-bold text-on-surface">{detalleLog.tipo_disparo}</span>
                </div>
                <div>
                  <span className="font-label-caps text-[10px] text-outline font-bold uppercase block mb-1">Duración</span>
                  <span className="font-mono text-body-sm font-bold text-on-surface">{detalleLog.duracion_ms} ms</span>
                </div>
                <div>
                  <span className="font-label-caps text-[10px] text-outline font-bold uppercase block mb-1">Tamaño Archivo</span>
                  <span className="font-mono text-body-sm font-bold text-on-surface">{detalleLog.tamano_duckdb_kb || 0} KB</span>
                </div>
              </div>

              {detalleLog.error && (
                <div className="p-4 bg-error-container text-on-error-container rounded-2xl border border-error/20 text-body-sm">
                  <strong>Error reportado:</strong> {detalleLog.error}
                </div>
              )}

              <div className="p-4 bg-surface-container-low rounded-2xl border border-surface-container-high/40 text-on-surface leading-relaxed text-body-sm flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 shrink-0 text-primary mt-0.5" />
                <span>
                  <strong>Garantía de Trazabilidad:</strong> Cada sincronización registra origen, transformación y destino inmutable para auditoría y BI.
                </span>
              </div>
            </div>

            {/* Footer Modal */}
            <div className="p-4 bg-surface-container-low/50 border-t border-surface-container-low flex justify-end shrink-0">
              <button
                onClick={() => setDetalleLog(null)}
                className="px-4 py-2 font-title-md text-body-sm font-bold text-on-surface hover:bg-surface-container rounded-full cursor-pointer transition-colors"
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
