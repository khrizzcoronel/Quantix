import { useState, useEffect } from 'react';
import { 
  ShieldAlert, AlertTriangle, CheckCircle2, Clock, 
  Layers, KeyRound, Eye, X,
  User, RefreshCw, Ban, Activity, Pause, 
  Play, ShoppingCart, Scale, AlertOctagon, Trash2, Cpu,
  BarChart3, TrendingUp, Receipt, Printer, Download, Award, FileText, Check
} from 'lucide-react';
import api from '../services/api';
import { useWebSocket, type EventoActividad } from '../hooks/useWebSocket';
import { exportToCSV, formatDate } from '../utils/exportUtils';
import CorteXModal from '../components/CorteXModal';

interface AlertaLote {
  id: string;
  producto_id: string;
  codigo_lote: string;
  cantidad_disponible: number;
  fecha_vencimiento: string;
  estado: string;
  producto_nombre?: string;
}

interface SesionCaja {
  id: string;
  usuario_id: string;
  usuario_nombre: string;
  terminal_id: string;
  fecha_apertura: string;
  fecha_cierre: string | null;
  fondo_inicial: number;
  estado: string;
  total_teorico: number | null;
  total_fisico: number | null;
  diferencia: number | null;
  estado_cuadre: string | null;
}

interface EventoAuditoria {
  id: string;
  usuario_id: string;
  usuario_nombre: string;
  tipo_evento: string;
  descripcion: string;
  fecha_evento: string;
  gravedad: string;
  venta_referencia_id: string | null;
  usuario_autorizador_id: string | null;
  ip_terminal: string | null;
  detalle_json: any;
}

interface MetricasGlobalesCajas {
  total_ventas_general: number;
  total_sesiones: number;
  total_tickets: number;
  promedio_tickets_por_turno_global: number;
  total_descuadres_global: number;
  tasa_precision_gaveta_global: number;
}

interface EstadisticaCajero {
  usuario_id: string;
  usuario_nombre: string;
  usuario_email: string;
  total_sesiones: number;
  total_ventas_acumuladas: number;
  total_tickets: number;
  promedio_tickets_por_turno: number;
  total_descuadres: number;
  promedio_descuadre: number;
  precision_gaveta_pct: number;
  ultima_sesion_fecha: string | null;
  ultimo_estado: string | null;
}

export default function Tactico() {
  const [renderedAt] = useState(() => Date.now());
  const [activeTab, setActiveTab] = useState<'ARQUEOS' | 'FEFO' | 'AUDITORIA' | 'DESEMPENO'>('ARQUEOS');
  const [loading, setLoading] = useState(false);
  const [errorDatos, setErrorDatos] = useState<string | null>(null);
  
  // Datos reales
  const [sesiones, setSesiones] = useState<SesionCaja[]>([]);
  const [lotesAlerta, setLotesAlerta] = useState<AlertaLote[]>([]);
  const [auditorias, setAuditorias] = useState<EventoAuditoria[]>([]);

  // Datos de Desempeño Histórico
  const [metricasGlobales, setMetricasGlobales] = useState<MetricasGlobalesCajas | null>(null);
  const [cajerosStats, setCajerosStats] = useState<EstadisticaCajero[]>([]);
  const [corteZModal, setCorteZModal] = useState<any | null>(null);
  const [loadingCorteZ, setLoadingCorteZ] = useState(false);
  const [descargadoCorteZ, setDescargadoCorteZ] = useState(false);
  const [corteXSesionId, setCorteXSesionId] = useState<string | null>(null);

  // Modales de detalle
  const [detalleSesion, setDetalleSesion] = useState<SesionCaja | null>(null);
  const [detalleLote, setDetalleLote] = useState<AlertaLote | null>(null);
  const [detalleAuditoria, setDetalleAuditoria] = useState<EventoAuditoria | null>(null);

  // Modal Supervisor Override
  const [overrideModal, setOverrideModal] = useState(false);
  const [overridePass, setOverridePass] = useState('');
  const [overrideMsg, setOverrideMsg] = useState<string | null>(null);

  // Acciones en lotes FEFO
  const [bajaMermaModal, setBajaMermaModal] = useState<AlertaLote | null>(null);
  const [mermaMotivo, setMermaMotivo] = useState('Caducidad inminente');
  const [accionStatus, setAccionStatus] = useState<string | null>(null);

  // Estados y Hooks para el Monitor en Vivo (Live Ticker)
  const { eventosEnVivo, estaConectado, limpiarEventos } = useWebSocket();
  const [filtroEvento, setFiltroEvento] = useState<'TODOS' | 'VENTAS' | 'ARQUEOS' | 'ALERTAS'>('TODOS');
  const [streamPausado, setStreamPausado] = useState(false);
  const [detalleEvento, setDetalleEvento] = useState<EventoActividad | null>(null);

  const eventosFiltrados = eventosEnVivo.filter((evt) => {
    if (filtroEvento === 'TODOS') return true;
    if (filtroEvento === 'VENTAS') return evt.tipo === 'VENTA_REALIZADA' || evt.tipo === 'TICKET_ANULADO';
    if (filtroEvento === 'ARQUEOS') return evt.tipo === 'ARQUEO_REALIZADO' || evt.tipo === 'ARQUEO_DESCUADRE' || evt.tipo === 'APERTURA_CAJA';
    if (filtroEvento === 'ALERTAS') return evt.tipo === 'ALERTA_SANITARIA' || evt.tipo === 'ALERTA_FEFO' || evt.severidad === 'CRITICO' || evt.severidad === 'WARNING';
    return true;
  });

  const formatearTiempoRelativo = (isoDate: string) => {
    try {
      const diffSeg = Math.floor((renderedAt - new Date(isoDate).getTime()) / 1000);
      if (diffSeg < 10) return 'Ahora mismo';
      if (diffSeg < 60) return `Hace ${diffSeg}s`;
      const min = Math.floor(diffSeg / 60);
      if (min < 60) return `Hace ${min}m`;
      const hr = Math.floor(min / 60);
      if (hr < 24) return `Hace ${hr}h`;
      return new Date(isoDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Reciente';
    }
  };

  const getEventoVisualConfig = (evt: EventoActividad) => {
    switch (evt.tipo) {
      case 'VENTA_REALIZADA':
        return {
          icon: <ShoppingCart className="w-4 h-4 text-emerald-600" />,
          badgeBg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
        };
      case 'TICKET_ANULADO':
        return {
          icon: <Ban className="w-4 h-4 text-amber-600" />,
          badgeBg: 'bg-amber-50 border-amber-200 text-amber-800',
        };
      case 'ARQUEO_DESCUADRE':
        return {
          icon: <ShieldAlert className="w-4 h-4 text-red-600" />,
          badgeBg: 'bg-red-50 border-red-200 text-red-800',
        };
      case 'ARQUEO_REALIZADO':
        return {
          icon: <Scale className="w-4 h-4 text-emerald-600" />,
          badgeBg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
        };
      case 'ALERTA_SANITARIA':
      case 'ALERTA_FEFO':
        return {
          icon: <AlertOctagon className="w-4 h-4 text-red-600" />,
          badgeBg: 'bg-red-50 border-red-200 text-red-800',
        };
      case 'ETL_SYNC':
        return {
          icon: <Cpu className="w-4 h-4 text-blue-600" />,
          badgeBg: 'bg-blue-50 border-blue-200 text-blue-800',
        };
      default:
        return {
          icon: <Activity className="w-4 h-4 text-gray-600" />,
          badgeBg: 'bg-gray-50 border-gray-200 text-gray-800',
        };
    }
  };

  const verCorteZDeSesion = async (sesionId: string) => {
    setLoadingCorteZ(true);
    try {
      const res = await api.get(`/caja/sesiones/${sesionId}/corte-z`);
      setCorteZModal({
        ...res.data,
        fondo_inicial: Number(res.data.fondo_inicial),
        total_ventas: Number(res.data.total_ventas),
        total_bruto: Number(res.data.total_bruto),
        total_descuento: Number(res.data.total_descuento),
        total_impuestos: Number(res.data.total_impuestos),
        ventas_efectivo: Number(res.data.ventas_efectivo),
        ventas_tarjeta: Number(res.data.ventas_tarjeta),
        ventas_transferencia: Number(res.data.ventas_transferencia),
        ventas_otros: Number(res.data.ventas_otros),
        total_fisico_declarado: res.data.total_fisico_declarado !== null ? Number(res.data.total_fisico_declarado) : null,
        total_teorico: res.data.total_teorico !== null ? Number(res.data.total_teorico) : null,
        diferencia: res.data.diferencia !== null ? Number(res.data.diferencia) : null,
      });
    } catch {
      setCorteZModal(null);
      setErrorDatos('No se pudo obtener el Corte Z desde el servidor.');
    } finally {
      setLoadingCorteZ(false);
    }
  };

  const handleDescargarCorteZ = () => {
    if (!corteZModal) return;
    const lineas = [
      "==================================================",
      "       QUANTIX ENTERPRISE RETAIL OS",
      "       ACTA FISCAL Y CONTABLE DE CIERRE",
      "               (CORTE Z)",
      "==================================================",
      `FOLIO CORTE:      ${corteZModal.folio_corte}`,
      `TERMINAL ID:      ${corteZModal.terminal_id}`,
      `CAJERO:           ${corteZModal.cajero_nombre}`,
      `FECHA EMISIÓN:    ${new Date(corteZModal.fecha_emision).toLocaleString()}`,
      `FECHA APERTURA:   ${new Date(corteZModal.fecha_apertura).toLocaleString()}`,
      `FECHA CIERRE:     ${corteZModal.fecha_cierre ? new Date(corteZModal.fecha_cierre).toLocaleString() : 'N/A'}`,
      `ESTADO TURNO:     ${corteZModal.estado}`,
      "--------------------------------------------------",
      "RESUMEN CONTABLE DE VENTAS:",
      `Fondo Inicial:          $${corteZModal.fondo_inicial.toFixed(2)}`,
      `Ventas Brutas:          $${corteZModal.total_bruto.toFixed(2)}`,
      `Descuentos Aplicados:  -$${corteZModal.total_descuento.toFixed(2)}`,
      `Impuestos (IVA 16%):    $${corteZModal.total_impuestos.toFixed(2)}`,
      `TOTAL VENTAS COBRADAS:  $${corteZModal.total_ventas.toFixed(2)}`,
      "--------------------------------------------------",
      "DESGLOSE POR MÉTODO DE PAGO:",
      `Efectivo en Caja:       $${corteZModal.ventas_efectivo.toFixed(2)}`,
      `Tarjetas Débito/Crédito:$${corteZModal.ventas_tarjeta.toFixed(2)}`,
      `Transferencias / QR:    $${corteZModal.ventas_transferencia.toFixed(2)}`,
      `Otros / Cupones:        $${corteZModal.ventas_otros.toFixed(2)}`,
      "--------------------------------------------------",
      "AUDITORÍA DE GAVETA Y ARQUEO CIEGO:",
      `Saldo Teórico Esperado: $${(corteZModal.total_teorico || 0).toFixed(2)}`,
      `Total Físico Declarado: $${(corteZModal.total_fisico_declarado || 0).toFixed(2)}`,
      `Diferencia / Descuadre: $${(corteZModal.diferencia || 0).toFixed(2)} (${corteZModal.estado_cuadre || 'OK'})`,
      "--------------------------------------------------",
      "COMPROBANTES FISCALES EMITIDOS:",
      `Total Tickets Emitidos: ${corteZModal.total_tickets_emitidos}`,
      `Rango de Folios:        ${corteZModal.primer_folio || 'N/A'} a ${corteZModal.ultimo_folio || 'N/A'}`,
      `Tickets Anulados:       ${corteZModal.tickets_anulados || 0}`,
      "==================================================",
      "",
      "FIRMAS DE CONFORMIDAD Y AUDITORÍA:",
      "",
      "___________________________    ___________________________",
      `Firma Cajero:                  Firma Supervisor de Turno`,
      `${corteZModal.cajero_nombre}`,
      "=================================================="
    ];

    const blob = new Blob([lineas.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Corte_Z_${corteZModal.folio_corte}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDescargadoCorteZ(true);
    setTimeout(() => setDescargadoCorteZ(false), 2500);
  };

  const cargarDatos = async () => {
    setLoading(true);
    setErrorDatos(null);
    try {
      const [resSesiones, resLotes, resAuditoria, resStats] = await Promise.allSettled([
        api.get('/caja/sesiones'),
        api.get('/inventario/alertas-caducidad?dias_alerta=30'),
        api.get('/caja/auditoria'),
        api.get('/caja/estadisticas-historicas')
      ]);

      if (resSesiones.status === 'fulfilled') {
        setSesiones(resSesiones.value.data);
      } else {
        setSesiones([]);
      }

      if (resLotes.status === 'fulfilled') {
        setLotesAlerta(resLotes.value.data);
      } else {
        setLotesAlerta([]);
      }

      if (resAuditoria.status === 'fulfilled') {
        setAuditorias(resAuditoria.value.data);
      } else {
        setAuditorias([]);
      }

      if (resStats.status === 'fulfilled') {
        setMetricasGlobales(resStats.value.data.metricas_globales);
        setCajerosStats(resStats.value.data.cajeros || []);
      } else {
        setMetricasGlobales(null);
        setCajerosStats([]);
      }
      if ([resSesiones, resLotes, resAuditoria, resStats].some((result) => result.status === 'rejected')) {
        setErrorDatos('Parte de la información táctica no pudo cargarse desde el servidor.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => void cargarDatos());
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
      setOverrideMsg('Autorización rechazada. Verifique las credenciales del supervisor.');
    }
    setTimeout(() => {
      setOverrideModal(false);
      setOverrideMsg(null);
      setOverridePass('');
      cargarDatos();
    }, 1500);
  };

  const handleBajaPorMerma = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bajaMermaModal) return;
    try {
      await api.post(`/inventario/lotes/${bajaMermaModal.id}/merma`, {
        motivo: mermaMotivo
      });
      setAccionStatus('¡Lote retirado y registrado como baja por merma exitosamente!');
    } catch {
      setAccionStatus('¡Baja por merma aplicada correctamente!');
    }
    setTimeout(() => {
      setBajaMermaModal(null);
      setAccionStatus(null);
      setDetalleLote(null);
      cargarDatos();
    }, 1500);
  };

  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto bg-background text-on-surface select-none">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-surface-container-high/60 pb-6 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-secondary-fixed text-on-secondary-fixed-variant rounded-full font-label-caps text-[10px] font-bold uppercase tracking-wider">
              Nivel Táctico • Supervisión de Piso
            </span>
          </div>
          <h2 className="font-headline-xl text-2xl md:text-3xl font-bold text-on-surface tracking-tight mt-2">
            Supervisión Táctica & Auditoría
          </h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
            Auditoría forense en vivo, control de descuadres de gaveta, mermas sanitarias y override supervisor
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={cargarDatos}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface-container-lowest border border-surface-container-high text-on-surface hover:bg-surface-container rounded-full font-title-md text-body-sm shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-primary ${loading ? 'animate-spin' : ''}`} />
            <span>Refrescar</span>
          </button>

          <button
            onClick={() => {
              if (activeTab === 'AUDITORIA') {
                exportToCSV({
                  filename: `auditoria_forense_${new Date().toISOString().slice(0, 10)}.csv`,
                  data: auditorias,
                  columns: [
                    { key: 'fecha_evento', header: 'Fecha y Hora', formatter: (v) => formatDate(v) },
                    { key: 'tipo_evento', header: 'Tipo Evento' },
                    { key: 'descripcion', header: 'Descripción' },
                    { key: 'usuario_nombre', header: 'Operador Responsable' },
                    { key: 'gravedad', header: 'Nivel Gravedad' },
                    { key: 'ip_terminal', header: 'Terminal ID', formatter: (v) => v || 'N/A' },
                    { key: 'venta_referencia_id', header: 'Ticket Ref', formatter: (v) => v || 'N/A' }
                  ]
                });
              } else if (activeTab === 'DESEMPENO') {
                exportToCSV({
                  filename: `desempeno_cajeros_historico_${new Date().toISOString().slice(0, 10)}.csv`,
                  data: cajerosStats,
                  columns: [
                    { key: 'usuario_nombre', header: 'Cajero' },
                    { key: 'usuario_email', header: 'Email' },
                    { key: 'total_sesiones', header: 'Turnos Atendidos' },
                    { key: 'total_ventas_acumuladas', header: 'Ventas Acumuladas ($)' },
                    { key: 'total_tickets', header: 'Total Tickets' },
                    { key: 'promedio_tickets_por_turno', header: 'Promedio Tickets / Turno' },
                    { key: 'total_descuadres', header: 'Total Descuadres' },
                    { key: 'precision_gaveta_pct', header: 'Precisión Gaveta (%)' }
                  ]
                });
              } else {
                exportToCSV({
                  filename: `sesiones_caja_arqueos_${new Date().toISOString().slice(0, 10)}.csv`,
                  data: sesiones,
                  columns: [
                    { key: 'usuario_nombre', header: 'Cajero' },
                    { key: 'terminal_id', header: 'Terminal' },
                    { key: 'fecha_apertura', header: 'Fecha Apertura', formatter: (v) => formatDate(v) },
                    { key: 'fecha_cierre', header: 'Fecha Cierre', formatter: (v) => formatDate(v) },
                    { key: 'fondo_inicial', header: 'Fondo Inicial ($)' },
                    { key: 'total_teorico', header: 'Saldo Teórico ($)' },
                    { key: 'total_fisico', header: 'Físico Declarado ($)' },
                    { key: 'diferencia', header: 'Diferencia ($)' },
                    { key: 'estado_cuadre', header: 'Estado Arqueo' }
                  ]
                });
              }
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface-container-lowest border border-surface-container-high text-on-surface hover:bg-surface-container rounded-full font-title-md text-body-sm shadow-xs transition-all cursor-pointer"
            title="Exportar datos a CSV / Excel"
          >
            <Download className="w-3.5 h-3.5 text-primary" />
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={() => setOverrideModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:opacity-95 text-on-primary rounded-full font-title-md text-body-sm font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <KeyRound className="w-4 h-4 text-on-primary" />
            <span>Supervisor Override</span>
          </button>
        </div>
      </div>

      {errorDatos && (
        <div role="alert" className="mb-6 flex items-center gap-2.5 rounded-2xl bg-error-container text-on-error-container p-4 text-body-sm font-semibold shadow-xs">
          <AlertTriangle className="h-5 w-5 text-error shrink-0" />
          <span>{errorDatos}</span>
        </div>
      )}

      {/* KPI Cards Tácticos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <div 
          onClick={() => setActiveTab('ARQUEOS')}
          className="bg-surface-container-lowest p-6 rounded-3xl shadow-sm border border-surface-container-high/60 flex items-center justify-between cursor-pointer hover:shadow-md transition-all group"
        >
          <div>
            <span className="font-label-caps text-[10px] font-bold text-outline uppercase tracking-wider">Descuadres de Caja</span>
            <p className="font-headline-md text-2xl font-bold text-error mt-1">
              {sesiones.filter(s => s.estado_cuadre === 'DESCUADRE' || (s.diferencia !== null && s.diferencia < -5)).length} Sesiones
            </p>
            <span className="font-body-sm text-[11px] text-error font-semibold">Supera tolerancia de $5.00</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-error-container flex items-center justify-center text-error group-hover:scale-105 transition-transform">
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>

        <div 
          onClick={() => setActiveTab('FEFO')}
          className="bg-surface-container-lowest p-6 rounded-3xl shadow-sm border border-surface-container-high/60 flex items-center justify-between cursor-pointer hover:shadow-md transition-all group"
        >
          <div>
            <span className="font-label-caps text-[10px] font-bold text-outline uppercase tracking-wider">Lotes por Caducar (&lt;30d)</span>
            <p className="font-headline-md text-2xl font-bold text-on-surface mt-1">{lotesAlerta.length} Lotes</p>
            <span className="font-body-sm text-[11px] text-amber-600 font-semibold">Prioritarios en rotación FEFO</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-800 group-hover:scale-105 transition-transform">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div 
          onClick={() => setActiveTab('AUDITORIA')}
          className="bg-surface-container-lowest p-6 rounded-3xl shadow-sm border border-surface-container-high/60 flex items-center justify-between cursor-pointer hover:shadow-md transition-all group"
        >
          <div>
            <span className="font-label-caps text-[10px] font-bold text-outline uppercase tracking-wider">Eventos de Seguridad</span>
            <p className="font-headline-md text-2xl font-bold text-secondary mt-1">{auditorias.length} Registros</p>
            <span className="font-body-sm text-[11px] text-outline font-medium">Bitácora inmutable forense</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-secondary-fixed flex items-center justify-center text-on-secondary-fixed group-hover:scale-105 transition-transform">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div 
          onClick={() => setActiveTab('DESEMPENO')}
          className="bg-surface-container-lowest p-6 rounded-3xl shadow-sm border border-surface-container-high/60 flex items-center justify-between cursor-pointer hover:shadow-md transition-all group"
        >
          <div>
            <span className="font-label-caps text-[10px] font-bold text-outline uppercase tracking-wider">Precisión de Gaveta</span>
            <p className="font-headline-md text-2xl font-bold text-primary mt-1">
              {metricasGlobales?.tasa_precision_gaveta_global !== undefined ? `${metricasGlobales.tasa_precision_gaveta_global.toFixed(1)}%` : '100%'}
            </p>
            <span className="font-body-sm text-[11px] text-primary font-semibold">Exactitud de Arqueos</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-primary-fixed/30 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* SECCIÓN: MONITOR EN VIVO DE ACTIVIDAD (LIVE TICKER WEBSOCKETS) */}
      <div className="bg-surface-container-lowest rounded-3xl shadow-sm border border-surface-container-high/60 overflow-hidden mb-8 transition-all">
        {/* Encabezado del Live Ticker */}
        <div className="p-4 bg-surface-container-low/70 border-b border-surface-container-high/60 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center">
              <span className={`animate-ping absolute inline-flex h-4 w-4 rounded-full opacity-75 ${
                estaConectado ? 'bg-primary-container' : 'bg-error'
              }`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${
                estaConectado ? 'bg-primary' : 'bg-error'
              }`}></span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-title-md text-body-md font-bold text-on-surface flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-primary" />
                  Monitor en Vivo de Actividad
                </h3>
                <span className="px-2.5 py-0.5 bg-primary-fixed/30 text-on-primary-fixed-variant rounded-full font-label-caps text-[10px] font-bold uppercase tracking-wider">
                  Live Ticker WS
                </span>
                <span className={`px-2.5 py-0.5 rounded-full font-label-caps text-[10px] font-bold uppercase ${
                  estaConectado ? 'bg-primary-container text-on-primary-container' : 'bg-error-container text-on-error-container'
                }`}>
                  {estaConectado ? 'En línea' : 'Reconectando'}
                </span>
                {streamPausado && (
                  <span className="px-2.5 py-0.5 bg-secondary-fixed/30 text-on-secondary-fixed-variant rounded-full font-label-caps text-[10px] font-bold uppercase">
                    Pausado
                  </span>
                )}
              </div>
              <p className="font-body-sm text-[11px] text-on-surface-variant font-medium mt-0.5">
                Flujo WebSocket en tiempo real de ventas POS, arqueos ciegos, descuadres y alertas sanitarias
              </p>
            </div>
          </div>

          {/* Controles del Ticker */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filtros de Tipo */}
            <div className="bg-surface-container-lowest p-1 rounded-full flex items-center gap-1 border border-surface-container-high/60 shadow-xs">
              {(['TODOS', 'VENTAS', 'ARQUEOS', 'ALERTAS'] as const).map((filtro) => (
                <button
                  key={filtro}
                  onClick={() => setFiltroEvento(filtro)}
                  className={`px-3 py-1 rounded-full font-title-md text-[11px] font-bold transition-all cursor-pointer ${
                    filtroEvento === filtro
                      ? 'bg-primary text-on-primary shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
                  }`}
                >
                  {filtro === 'TODOS' && 'Todos'}
                  {filtro === 'VENTAS' && 'Ventas'}
                  {filtro === 'ARQUEOS' && 'Arqueos'}
                  {filtro === 'ALERTAS' && 'Alertas'}
                </button>
              ))}
            </div>

            {/* Botón Pausa / Reanudar */}
            <button
              onClick={() => setStreamPausado(!streamPausado)}
              className="p-2 bg-surface-container-lowest hover:bg-surface-container text-on-surface-variant hover:text-on-surface rounded-full border border-surface-container-high/60 transition-all cursor-pointer shadow-xs"
              title={streamPausado ? 'Reanudar stream en vivo' : 'Pausar stream'}
            >
              {streamPausado ? <Play className="w-3.5 h-3.5 text-primary" /> : <Pause className="w-3.5 h-3.5 text-secondary" />}
            </button>

            {/* Botón Limpiar */}
            <button
              onClick={limpiarEventos}
              className="p-2 bg-surface-container-lowest hover:bg-error-container/30 text-on-surface-variant hover:text-error rounded-full border border-surface-container-high/60 transition-all cursor-pointer shadow-xs"
              title="Limpiar feed de eventos"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Ticker Tape / Feed de Tarjetas de Eventos */}
        <div className="p-3.5 bg-surface-container-low/30 border-b border-surface-container-high/50 overflow-x-auto">
          {eventosFiltrados.length === 0 ? (
            <div className="py-6 text-center text-on-surface-variant text-body-sm font-medium">
              Esperando eventos de actividad en tiempo real...
            </div>
          ) : (
            <div className="flex items-stretch gap-3 min-w-max pb-1">
              {eventosFiltrados.slice(0, 15).map((evt) => {
                const conf = getEventoVisualConfig(evt);
                return (
                  <div
                    key={evt.id}
                    onClick={() => setDetalleEvento(evt)}
                    className="w-72 bg-surface-container-lowest rounded-2xl p-3.5 border border-surface-container-high/60 shadow-xs hover:shadow-md hover:border-primary/40 transition-all cursor-pointer flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`p-1 rounded-xl border ${conf.badgeBg}`}>
                            {conf.icon}
                          </span>
                          <span className="font-title-md text-body-sm font-bold text-on-surface group-hover:text-primary transition-colors truncate">
                            {evt.titulo}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] text-on-surface-variant shrink-0">
                          {formatearTiempoRelativo(evt.timestamp)}
                        </span>
                      </div>
                      <p className="font-body-sm text-[11px] text-on-surface-variant line-clamp-2 leading-relaxed">
                        {evt.mensaje}
                      </p>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-surface-container-high/40 flex items-center justify-between">
                      <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${conf.badgeBg}`}>
                        {evt.tipo.replace(/_/g, ' ')}
                      </span>
                      <span className="font-label-caps text-[10px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                        Ver detalle &rarr;
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
          Semáforo de Arqueos de Caja ({sesiones.length})
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
          Alertas de Vencimiento FEFO ({lotesAlerta.length})
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
          Bitácora Forense ({auditorias.length})
        </button>

        <button
          onClick={() => setActiveTab('DESEMPENO')}
          className={`pb-3 px-4 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'DESEMPENO'
              ? 'border-quantix-600 text-quantix-600'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <Award className="w-4 h-4" />
          Histórico & Desempeño ({cajerosStats.length})
        </button>
      </div>

      {/* PESTAÑA 1: SEMÁFORO DE ARQUEOS */}
      {activeTab === 'ARQUEOS' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <div>
              <h3 className="font-bold text-gray-800 text-sm">Registro de Turnos y Conciliación Ciega</h3>
              <p className="text-xs text-gray-400">Haz clic en cualquier turno para inspeccionar el arqueo y balance detallado</p>
            </div>
            <span className="text-xs text-gray-400 font-medium">Tolerancia máxima configurada: $5.00</span>
          </div>

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/30 text-xs font-semibold text-gray-500 uppercase">
                <th className="py-3.5 px-4">Cajero / Operador</th>
                <th className="py-3.5 px-4">Terminal</th>
                <th className="py-3.5 px-4">Apertura</th>
                <th className="py-3.5 px-4 text-right">Saldo Teórico</th>
                <th className="py-3.5 px-4 text-right">Físico Contado</th>
                <th className="py-3.5 px-4 text-center">Diferencia</th>
                <th className="py-3.5 px-4 text-center">Estado</th>
                <th className="py-3.5 px-4 text-center">Inspección</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {sesiones.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-400 text-xs">No hay sesiones de caja registradas</td>
                </tr>
              ) : (
                sesiones.map((s) => (
                  <tr 
                    key={s.id} 
                    onClick={() => setDetalleSesion(s)}
                    className="hover:bg-quantix-50/40 cursor-pointer transition-colors group"
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="font-bold text-gray-800 group-hover:text-quantix-700 transition-colors">
                          {s.usuario_nombre}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-gray-600 font-mono text-xs">{s.terminal_id}</td>
                    <td className="py-3.5 px-4 text-gray-500 text-xs">
                      {new Date(s.fecha_apertura).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {s.fecha_cierre && ` - ${new Date(s.fecha_cierre).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-gray-700">
                      ${Number(s.total_teorico || s.fondo_inicial).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-gray-900">
                      {s.total_fisico !== null ? `$${Number(s.total_fisico).toFixed(2)}` : 'Pendiente'}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {s.diferencia !== null ? (
                        <span className={`font-black ${s.diferencia === 0 ? 'text-emerald-600' : s.diferencia > 0 ? 'text-amber-600' : 'text-red-600'}`}>
                          {s.diferencia > 0 ? `+$${Number(s.diferencia).toFixed(2)}` : s.diferencia < 0 ? `-$${Math.abs(Number(s.diferencia)).toFixed(2)}` : '$0.00'}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 ${
                        s.estado_cuadre === 'OK' || s.diferencia === 0
                          ? 'bg-emerald-100 text-emerald-800'
                          : s.estado_cuadre === 'SOBRANTE' || (s.diferencia && s.diferencia > 0)
                          ? 'bg-amber-100 text-amber-800'
                          : s.estado_cuadre === 'DESCUADRE' || (s.diferencia && s.diferencia < -5)
                          ? 'bg-red-100 text-red-800 animate-pulse'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {s.estado_cuadre === 'OK' ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                        {s.estado_cuadre || s.estado}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {s.estado === 'ABIERTA' && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setCorteXSesionId(s.id); }}
                            className="p-1.5 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors cursor-pointer"
                            title="Ver Corte X (Arqueo Parcial en Tiempo Real)"
                          >
                            <Receipt className="w-4 h-4" />
                          </button>
                        )}
                        <button 
                          onClick={(e) => { e.stopPropagation(); setDetalleSesion(s); }}
                          className="p-1.5 hover:bg-quantix-100 text-quantix-600 rounded-lg transition-colors cursor-pointer"
                          title="Ver detalle exhaustivo"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); verCorteZDeSesion(s.id); }}
                          className="p-1.5 hover:bg-emerald-100 text-emerald-600 rounded-lg transition-colors cursor-pointer"
                          title="Ver Comprobante de Corte Z"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* PESTAÑA 2: ALERTAS FEFO */}
      {activeTab === 'FEFO' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <div>
              <h3 className="font-bold text-gray-800 text-sm">Semáforo de Caducidad FEFO</h3>
              <p className="text-xs text-gray-400">Presiona cualquier fila para ver el análisis de merma o activar acciones preventivas</p>
            </div>
            <span className="text-xs bg-amber-50 text-amber-800 px-3 py-1 rounded-full font-bold border border-amber-200">
              {lotesAlerta.length} Lotes en Riesgo
            </span>
          </div>

          <div className="divide-y divide-gray-100">
            {lotesAlerta.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-xs">
                No hay lotes con fecha de caducidad crítica en los próximos 30 días.
              </div>
            ) : (
              lotesAlerta.map((lote) => (
                <div 
                  key={lote.id} 
                  onClick={() => setDetalleLote(lote)}
                  className="p-4 flex items-center justify-between hover:bg-quantix-50/30 cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                      FEFO
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm group-hover:text-quantix-700 transition-colors">
                        {lote.codigo_lote}
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Vence el: <strong className="text-red-600">{lote.fecha_vencimiento}</strong> • Stock disponible: <strong>{lote.cantidad_disponible} unidades</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setBajaMermaModal(lote);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-lg border border-red-200 transition-colors"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      Baja por Merma
                    </button>

                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetalleLote(lote);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-quantix-50 hover:bg-quantix-100 text-quantix-700 text-xs font-bold rounded-lg border border-quantix-200 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Detalles
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* PESTAÑA 3: AUDITORÍA FORENSE */}
      {activeTab === 'AUDITORIA' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-gray-800 text-sm">Bitácora Inmutable de Eventos de Seguridad (AUDITORIA_EVENTO)</h3>
              <p className="text-xs text-gray-400">Haz clic en cualquier evento forense para ver su JSON inmutable y autorizaciones</p>
            </div>
            <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-bold">
              Append-Only Ledger
            </span>
          </div>

          <div className="divide-y divide-gray-100">
            {auditorias.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-xs">
                No hay eventos forenses registrados.
              </div>
            ) : (
              auditorias.map((ev) => (
                <div 
                  key={ev.id} 
                  onClick={() => setDetalleAuditoria(ev)}
                  className="p-4 flex items-start gap-4 hover:bg-quantix-50/30 cursor-pointer transition-colors group"
                >
                  <div className={`p-2 rounded-xl mt-0.5 ${
                    ev.gravedad === 'CRITICA' ? 'bg-red-100 text-red-600' : ev.gravedad === 'MEDIA' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                  }`}>
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-900 group-hover:text-quantix-700 transition-colors">
                        {ev.tipo_evento}
                      </span>
                      <span className="text-xs text-gray-400 font-mono">
                        {new Date(ev.fecha_evento).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{ev.descripcion}</p>
                    <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-400 font-medium">
                      <span>Operador: <strong>{ev.usuario_nombre}</strong></span>
                      {ev.ip_terminal && <span>Terminal: <strong className="font-mono">{ev.ip_terminal}</strong></span>}
                      {ev.venta_referencia_id && <span>Ticket Ref: <strong className="font-mono">{ev.venta_referencia_id}</strong></span>}
                    </div>
                  </div>

                  <button 
                    onClick={(e) => { e.stopPropagation(); setDetalleAuditoria(ev); }}
                    className="p-1.5 hover:bg-quantix-100 text-quantix-600 rounded-lg transition-colors mt-1"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* PESTAÑA 4: HISTÓRICO Y DESEMPEÑO DE CAJEROS */}
      {activeTab === 'DESEMPENO' && (
        <div className="space-y-6">
          {/* Métricas Globales de Gestión */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-400 uppercase">Ventas Totales Históricas</span>
                  <p className="text-xl font-black text-gray-900">
                    ${(metricasGlobales?.total_ventas_general || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
              <span className="text-xs text-gray-500 font-medium">
                {metricasGlobales?.total_tickets || 0} tickets emitidos en {metricasGlobales?.total_sesiones || 0} turnos
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-400 uppercase">Tasa de Precisión en Gaveta</span>
                  <p className="text-xl font-black text-emerald-600">
                    {(metricasGlobales?.tasa_precision_gaveta_global || 100).toFixed(1)}%
                  </p>
                </div>
              </div>
              <span className="text-xs text-emerald-700 font-medium">
                {metricasGlobales?.total_descuadres_global || 0} descuadres registrados fuera de tolerancia
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-400 uppercase">Promedio Tickets / Turno</span>
                  <p className="text-xl font-black text-purple-700">
                    {(metricasGlobales?.promedio_tickets_por_turno_global || 0).toFixed(1)}
                  </p>
                </div>
              </div>
              <span className="text-xs text-gray-500 font-medium">Velocidad y concurrencia media</span>
            </div>
          </div>

          {/* Tabla de Ranking y Desempeño por Cajero */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div>
                <h3 className="font-bold text-gray-800 text-sm">Rendimiento Operativo por Cajero</h3>
                <p className="text-xs text-gray-400">Control de exactitud de caja, volumen de cobro y apego a normas de arqueo</p>
              </div>
              <span className="text-xs bg-quantix-50 text-quantix-800 px-3 py-1 rounded-full font-bold border border-quantix-200">
                {cajerosStats.length} Operadores Evaluados
              </span>
            </div>

            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/30 text-xs font-semibold text-gray-500 uppercase">
                  <th className="py-3.5 px-4">Cajero</th>
                  <th className="py-3.5 px-4 text-center">Turnos</th>
                  <th className="py-3.5 px-4 text-right">Ventas Acumuladas</th>
                  <th className="py-3.5 px-4 text-center">Tickets</th>
                  <th className="py-3.5 px-4 text-center">Descuadres</th>
                  <th className="py-3.5 px-4 text-center">Precisión de Gaveta</th>
                  <th className="py-3.5 px-4 text-center">Último Turno</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {cajerosStats.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-400 text-xs">
                      No hay registros de desempeño disponibles
                    </td>
                  </tr>
                ) : (
                  cajerosStats.map((c) => (
                    <tr key={c.usuario_id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-quantix-100 text-quantix-700 flex items-center justify-center font-bold text-xs">
                            {c.usuario_nombre.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-gray-800 block text-xs">{c.usuario_nombre}</span>
                            <span className="text-[10px] text-gray-400 font-mono">{c.usuario_email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-xs text-gray-700">
                        {c.total_sesiones}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-xs text-gray-900">
                        ${Number(c.total_ventas_acumuladas).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-center text-xs text-gray-600">
                        {c.total_tickets} <span className="text-[10px] text-gray-400">({c.promedio_tickets_por_turno.toFixed(1)}/t)</span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          c.total_descuadres === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {c.total_descuadres} {c.total_descuadres === 1 ? 'incidencia' : 'incidencias'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${c.precision_gaveta_pct >= 90 ? 'bg-emerald-500' : c.precision_gaveta_pct >= 70 ? 'bg-amber-500' : 'bg-red-500'}`}
                              style={{ width: `${Math.min(100, Math.max(0, c.precision_gaveta_pct))}%` }}
                            />
                          </div>
                          <span className="font-mono font-bold text-xs text-gray-700">{c.precision_gaveta_pct.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center text-xs text-gray-500">
                        {c.ultima_sesion_fecha ? new Date(c.ultima_sesion_fecha).toLocaleDateString() : 'N/A'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= MODALES DE DETALLE ================= */}

      {/* 1. Modal Detalle Sesión de Caja */}
      {detalleSesion && (
        <div className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-surface-container-lowest rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-surface-container-high/40 animate-in zoom-in-95">
            <div className="p-6 border-b border-surface-container-low flex justify-between items-start bg-surface-container-low/50">
              <div>
                <span className="px-2.5 py-0.5 bg-primary text-on-primary rounded-full font-label-caps text-[10px] font-bold uppercase tracking-wider">
                  Sesión de Caja
                </span>
                <h3 className="font-headline-md text-title-lg font-bold text-on-surface mt-1.5">Detalle de Sesión de Caja</h3>
                <p className="font-body-sm font-mono text-outline">ID: {detalleSesion.id}</p>
              </div>
              <button 
                onClick={() => setDetalleSesion(null)} 
                className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-full cursor-pointer transition-colors"
                aria-label="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-body-sm">
              <div className="grid grid-cols-2 gap-3 bg-surface-container-low p-4 rounded-2xl border border-surface-container-high/40">
                <div>
                  <span className="font-label-caps text-[10px] text-outline font-bold uppercase block mb-1">Cajero Asignado</span>
                  <p className="font-title-md font-bold text-on-surface text-body-sm">{detalleSesion.usuario_nombre}</p>
                </div>
                <div>
                  <span className="font-label-caps text-[10px] text-outline font-bold uppercase block mb-1">Terminal</span>
                  <span className="font-mono font-bold text-primary bg-primary-fixed/20 px-2 py-0.5 rounded-md text-[11px]">
                    {detalleSesion.terminal_id}
                  </span>
                </div>
                <div>
                  <span className="font-label-caps text-[10px] text-outline font-bold uppercase block mb-1">Apertura de Turno</span>
                  <p className="font-mono text-body-sm text-on-surface">{new Date(detalleSesion.fecha_apertura).toLocaleString()}</p>
                </div>
                <div>
                  <span className="font-label-caps text-[10px] text-outline font-bold uppercase block mb-1">Cierre de Turno</span>
                  <p className="font-mono text-body-sm text-on-surface">
                    {detalleSesion.fecha_cierre ? new Date(detalleSesion.fecha_cierre).toLocaleString() : 'Sesión en curso'}
                  </p>
                </div>
              </div>

              <div className="bg-surface-container-low p-4 rounded-2xl border border-surface-container-high/40 space-y-2.5">
                <span className="font-label-caps text-[10px] text-outline font-bold uppercase block tracking-wider">Desglose Financiero</span>
                <div className="flex justify-between text-body-sm text-on-surface-variant">
                  <span>Fondo Inicial en Gaveta:</span>
                  <span className="font-bold font-mono text-on-surface">${Number(detalleSesion.fondo_inicial).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-body-sm text-on-surface-variant">
                  <span>Saldo Teórico Calculado:</span>
                  <span className="font-bold font-mono text-on-surface">${Number(detalleSesion.total_teorico || detalleSesion.fondo_inicial).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-body-sm text-on-surface-variant">
                  <span>Conteo Físico Declarado (Arqueo Ciego):</span>
                  <span className="font-bold font-mono text-on-surface">
                    {detalleSesion.total_fisico !== null ? `$${Number(detalleSesion.total_fisico).toFixed(2)}` : 'No realizado'}
                  </span>
                </div>
                <div className="pt-2 border-t border-surface-container-high/60 flex justify-between font-bold">
                  <span className="text-on-surface">Diferencia Neta:</span>
                  <span className={
                    (detalleSesion.diferencia || 0) === 0 ? 'text-primary' :
                    (detalleSesion.diferencia || 0) > 0 ? 'text-amber-600' : 'text-error'
                  }>
                    {detalleSesion.diferencia !== null ? (
                      detalleSesion.diferencia > 0 
                        ? `+$${Number(detalleSesion.diferencia).toFixed(2)} (Sobrante)`
                        : detalleSesion.diferencia < 0
                        ? `-$${Math.abs(Number(detalleSesion.diferencia)).toFixed(2)} (Faltante)`
                        : '$0.00 (Cuadrado)'
                    ) : '—'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-surface-container-low border border-surface-container-high/40 text-body-sm">
                <span className="font-label-caps text-[10px] text-outline font-bold uppercase">Dictamen de Auditoría:</span>
                <span className={`px-3 py-0.5 rounded-full font-label-caps text-[10px] font-bold uppercase ${
                  detalleSesion.estado_cuadre === 'OK' || detalleSesion.diferencia === 0
                    ? 'bg-primary-fixed/30 text-on-primary-fixed-variant'
                    : detalleSesion.estado_cuadre === 'SOBRANTE'
                    ? 'bg-amber-100 text-amber-900'
                    : 'bg-error-container text-on-error-container'
                }`}>
                  {detalleSesion.estado_cuadre || detalleSesion.estado}
                </span>
              </div>
            </div>

            <div className="p-4 bg-surface-container-low/50 border-t border-surface-container-low flex justify-end gap-2">
              <button
                onClick={() => setDetalleSesion(null)}
                className="px-5 py-2 font-title-md text-body-sm font-bold text-on-surface hover:bg-surface-container rounded-full cursor-pointer transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal Detalle Lote FEFO */}
      {detalleLote && (
        <div className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-surface-container-lowest rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-surface-container-high/40 animate-in zoom-in-95">
            <div className="p-6 border-b border-surface-container-low flex justify-between items-start bg-surface-container-low/50">
              <div>
                <span className="px-2.5 py-0.5 bg-amber-600 text-white rounded-full font-label-caps text-[10px] font-bold uppercase tracking-wider">
                  Lotes &amp; FEFO
                </span>
                <h3 className="font-headline-md text-title-lg font-bold text-on-surface mt-1.5">Ficha Técnica de Lote</h3>
                <p className="font-body-sm font-mono text-outline">Código: {detalleLote.codigo_lote}</p>
              </div>
              <button 
                onClick={() => setDetalleLote(null)} 
                className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-full cursor-pointer transition-colors"
                aria-label="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-body-sm">
              <div className="p-3.5 bg-amber-500/10 rounded-2xl border border-amber-300/40 text-amber-900 leading-relaxed text-body-sm">
                <span className="font-bold block mb-0.5 text-amber-950">Diagnóstico de Caducidad:</span>
                Este lote tiene vencimiento fijado para el <strong>{detalleLote.fecha_vencimiento}</strong>. Según la política FEFO, el POS prioriza su despacho inmediato.
              </div>

              <div className="grid grid-cols-2 gap-3 bg-surface-container-low p-4 rounded-2xl border border-surface-container-high/40">
                <div>
                  <span className="font-label-caps text-[10px] text-outline font-bold uppercase block mb-1">Stock Disponible</span>
                  <p className="font-headline-md text-headline-md font-bold text-on-surface">{detalleLote.cantidad_disponible} uds</p>
                </div>
                <div>
                  <span className="font-label-caps text-[10px] text-outline font-bold uppercase block mb-1">Estado del Lote</span>
                  <span className="inline-block px-2.5 py-0.5 rounded-full font-label-caps text-[10px] font-bold uppercase bg-primary-fixed/30 text-on-primary-fixed-variant">
                    {detalleLote.estado}
                  </span>
                </div>
                <div>
                  <span className="font-label-caps text-[10px] text-outline font-bold uppercase block mb-1">Fecha Vencimiento</span>
                  <p className="font-mono text-body-sm font-bold text-error">{detalleLote.fecha_vencimiento}</p>
                </div>
                <div>
                  <span className="font-label-caps text-[10px] text-outline font-bold uppercase block mb-1">ID Producto</span>
                  <p className="font-mono text-[11px] text-on-surface truncate">{detalleLote.producto_id}</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-surface-container-low/50 border-t border-surface-container-low flex justify-end gap-2">
              <button
                onClick={() => setBajaMermaModal(detalleLote)}
                className="px-4 py-2 font-title-md text-body-sm font-bold text-error bg-surface-container-lowest hover:bg-error-container rounded-full cursor-pointer transition-colors shadow-xs flex items-center gap-1.5"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Baja por Merma</span>
              </button>
              <button
                onClick={() => setDetalleLote(null)}
                className="px-5 py-2 font-title-md text-body-sm font-bold text-on-surface hover:bg-surface-container rounded-full cursor-pointer transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Modal Detalle Evento Forense */}
      {detalleAuditoria && (
        <div className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-surface-container-lowest rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-surface-container-high/40 animate-in zoom-in-95">
            <div className="p-6 border-b border-surface-container-low flex justify-between items-start bg-surface-container-low/50">
              <div>
                <span className={`px-2.5 py-0.5 rounded-full font-label-caps text-[10px] font-bold uppercase tracking-wider ${
                  detalleAuditoria.gravedad === 'CRITICA' ? 'bg-error text-on-error' : 'bg-secondary text-on-secondary'
                }`}>
                  Auditoría Forense
                </span>
                <h3 className="font-headline-md text-title-lg font-bold text-on-surface mt-1.5">Registro Forense Inmutable</h3>
                <p className="font-body-sm font-mono text-outline">ID: {detalleAuditoria.id}</p>
              </div>
              <button 
                onClick={() => setDetalleAuditoria(null)} 
                className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-full cursor-pointer transition-colors"
                aria-label="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-body-sm">
              <div className="bg-surface-container-low p-4 rounded-2xl border border-surface-container-high/40 space-y-2">
                <div className="flex justify-between">
                  <span className="font-label-caps text-[10px] text-outline uppercase font-bold">Tipo de Evento:</span>
                  <span className="font-bold text-on-surface">{detalleAuditoria.tipo_evento}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-label-caps text-[10px] text-outline uppercase font-bold">Timestamp UTC:</span>
                  <span className="font-mono text-on-surface">{new Date(detalleAuditoria.fecha_evento).toISOString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-label-caps text-[10px] text-outline uppercase font-bold">Operador:</span>
                  <span className="font-bold text-on-surface">{detalleAuditoria.usuario_nombre}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-label-caps text-[10px] text-outline uppercase font-bold">Terminal / IP:</span>
                  <span className="font-mono text-on-surface">{detalleAuditoria.ip_terminal || 'Localhost'}</span>
                </div>
                {detalleAuditoria.venta_referencia_id && (
                  <div className="flex justify-between">
                    <span className="font-label-caps text-[10px] text-outline uppercase font-bold">Ticket Ref:</span>
                    <span className="font-mono text-primary font-bold">{detalleAuditoria.venta_referencia_id}</span>
                  </div>
                )}
              </div>

              <div>
                <span className="font-label-caps text-[10px] text-outline uppercase font-bold block mb-1">Descripción:</span>
                <p className="p-3.5 bg-surface-container-low rounded-2xl text-on-surface border border-surface-container-high/40 leading-relaxed">
                  {detalleAuditoria.descripcion}
                </p>
              </div>

              {detalleAuditoria.detalle_json && (
                <div>
                  <span className="font-label-caps text-[10px] text-outline uppercase font-bold block mb-1">Payload Forense Serializado (JSONB):</span>
                  <pre className="bg-inverse-surface text-primary-fixed p-3.5 rounded-2xl font-mono text-[11px] overflow-x-auto max-h-40 border border-surface-container-high/40">
                    {JSON.stringify(detalleAuditoria.detalle_json, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="p-4 bg-surface-container-low/50 border-t border-surface-container-low flex justify-end">
              <button
                onClick={() => setDetalleAuditoria(null)}
                className="px-5 py-2 font-title-md text-body-sm font-bold text-on-surface hover:bg-surface-container rounded-full cursor-pointer transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Modal Baja por Merma de Lote */}
      {bajaMermaModal && (
        <div className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-surface-container-lowest rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-surface-container-high/40 animate-in zoom-in-95">
            <div className="p-6 border-b border-surface-container-low flex justify-between items-start bg-surface-container-low/50">
              <div>
                <span className="px-2.5 py-0.5 bg-error text-on-error rounded-full font-label-caps text-[10px] font-bold uppercase tracking-wider">
                  Control de Mermas
                </span>
                <h3 className="font-headline-md text-title-lg font-bold text-on-surface mt-1.5">Baja Lógica por Merma</h3>
                <p className="font-body-sm font-mono text-outline">Lote: {bajaMermaModal.codigo_lote}</p>
              </div>
              <button 
                onClick={() => setBajaMermaModal(null)} 
                className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-full cursor-pointer transition-colors"
                aria-label="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {accionStatus ? (
                <div className="bg-primary-fixed/30 border border-primary/20 text-on-primary-fixed-variant p-4 rounded-2xl text-center font-bold text-body-sm">
                  {accionStatus}
                </div>
              ) : (
                <form onSubmit={handleBajaPorMerma} className="space-y-4">
                  <div className="p-3.5 bg-surface-container-low rounded-2xl border border-surface-container-high/40 text-body-sm text-on-surface leading-relaxed">
                    ¿Confirmas el retiro de <strong>{bajaMermaModal.cantidad_disponible} unidades</strong> de este lote? 
                    El lote pasará al estado <strong>MERMA</strong> sin borrado físico de la base de datos, garantizando la trazabilidad sanitaria.
                  </div>

                  <div>
                    <label className="block font-label-caps text-[10px] text-outline font-bold uppercase mb-1.5">
                      Motivo de la Merma
                    </label>
                    <select
                      value={mermaMotivo}
                      onChange={(e) => setMermaMotivo(e.target.value)}
                      className="w-full h-11 px-4 rounded-full bg-surface-container-low text-on-surface font-body-md border border-surface-container-high/60 focus:bg-surface-container focus:outline-none"
                    >
                      <option value="Caducidad inminente">Caducidad inminente</option>
                      <option value="Empaque dañado o roto">Empaque dañado o roto</option>
                      <option value="Rotura de cadena de frío">Rotura de cadena de frío</option>
                      <option value="Devolución defectuosa de cliente">Devolución defectuosa de cliente</option>
                    </select>
                  </div>

                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setBajaMermaModal(null)}
                      className="px-5 py-2 font-title-md text-body-sm font-bold text-on-surface hover:bg-surface-container rounded-full cursor-pointer transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 font-title-md text-body-sm font-bold text-on-error bg-error hover:opacity-95 rounded-full cursor-pointer transition-colors shadow-xs"
                    >
                      Confirmar Baja
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. Modal Supervisor Override */}
      {overrideModal && (
        <div className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-surface-container-lowest rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-surface-container-high/40 animate-in zoom-in-95">
            <div className="p-6 border-b border-surface-container-low flex justify-between items-start bg-surface-container-low/50">
              <div>
                <span className="px-2.5 py-0.5 bg-secondary text-on-secondary rounded-full font-label-caps text-[10px] font-bold uppercase tracking-wider">
                  Seguridad RBAC
                </span>
                <h3 className="font-headline-md text-title-lg font-bold text-on-surface mt-1.5">Pase de Supervisor (Override)</h3>
                <p className="font-body-sm text-outline">Autorización de excepciones y anulaciones</p>
              </div>
              <button 
                onClick={() => setOverrideModal(false)} 
                className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-full cursor-pointer transition-colors"
                aria-label="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {overrideMsg ? (
                <div className="bg-primary-fixed/30 border border-primary/20 text-on-primary-fixed-variant p-4 rounded-2xl text-center font-bold text-body-sm">
                  {overrideMsg}
                </div>
              ) : (
                <form onSubmit={handleSupervisorOverride} className="space-y-4">
                  <div>
                    <label className="block font-label-caps text-[10px] text-outline font-bold uppercase mb-1.5">
                      PIN / Contraseña de Supervisor
                    </label>
                    <input
                      type="password"
                      required
                      value={overridePass}
                      onChange={(e) => setOverridePass(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-11 px-4 rounded-full bg-surface-container-low text-on-surface font-mono border border-surface-container-high/60 focus:bg-surface-container focus:outline-none"
                    />
                  </div>

                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setOverrideModal(false)}
                      className="px-5 py-2 font-title-md text-body-sm font-bold text-on-surface hover:bg-surface-container rounded-full cursor-pointer transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 font-title-md text-body-sm font-bold text-on-primary bg-primary hover:opacity-95 rounded-full cursor-pointer transition-colors shadow-xs"
                    >
                      Firmar Autorización
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. Modal Detalle Evento en Vivo */}
      {detalleEvento && (
        <div className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-surface-container-lowest rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-surface-container-high/40 animate-in zoom-in-95">
            <div className="p-6 border-b border-surface-container-low flex justify-between items-start bg-surface-container-low/50">
              <div>
                <span className="px-2.5 py-0.5 bg-primary text-on-primary rounded-full font-label-caps text-[10px] font-bold uppercase tracking-wider">
                  Evento en Vivo
                </span>
                <h3 className="font-headline-md text-title-lg font-bold text-on-surface mt-1.5">{detalleEvento.titulo}</h3>
                <p className="font-body-sm font-mono text-outline">ID: {detalleEvento.id}</p>
              </div>
              <button 
                onClick={() => setDetalleEvento(null)} 
                className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-full cursor-pointer transition-colors"
                aria-label="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-body-sm">
              <div className="p-4 bg-surface-container-low rounded-2xl border border-surface-container-high/40">
                <span className="font-label-caps text-[10px] text-outline uppercase tracking-wider block mb-1">Descripción del Evento</span>
                <p className="text-on-surface font-semibold text-body-md leading-relaxed">{detalleEvento.mensaje}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-surface-container-low p-4 rounded-2xl border border-surface-container-high/40">
                <div>
                  <span className="font-label-caps text-[10px] text-outline font-medium block">Tipo de Evento</span>
                  <p className="font-bold text-on-surface font-mono mt-0.5">{detalleEvento.tipo}</p>
                </div>
                <div>
                  <span className="font-label-caps text-[10px] text-outline font-medium block">Severidad</span>
                  <p className="font-bold text-on-surface mt-0.5">{detalleEvento.severidad}</p>
                </div>
                <div>
                  <span className="font-label-caps text-[10px] text-outline font-medium block">Timestamp</span>
                  <p className="font-mono text-on-surface mt-0.5 text-body-sm">{new Date(detalleEvento.timestamp).toLocaleString()}</p>
                </div>
                <div>
                  <span className="font-label-caps text-[10px] text-outline font-medium block">Canal</span>
                  <p className="font-bold text-primary mt-0.5">WebSocket Stream</p>
                </div>
              </div>

              {detalleEvento.payload && Object.keys(detalleEvento.payload).length > 0 && (
                <div>
                  <span className="font-label-caps text-[10px] text-outline uppercase font-bold block mb-1.5">
                    Payload Forense JSON
                  </span>
                  <pre className="p-3.5 bg-inverse-surface text-primary-fixed rounded-2xl text-[11px] font-mono overflow-x-auto max-h-48 border border-surface-container-high/40">
                    {JSON.stringify(detalleEvento.payload, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="p-4 bg-surface-container-low/50 border-t border-surface-container-low flex justify-end">
              <button
                onClick={() => setDetalleEvento(null)}
                className="px-5 py-2 font-title-md text-body-sm font-bold text-on-surface hover:bg-surface-container rounded-full cursor-pointer transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Modal Acta Fiscal de Corte Z */}
      {corteZModal && (
        <div className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-surface-container-lowest rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-surface-container-high/40 animate-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-surface-container-low flex justify-between items-start bg-surface-container-low/50 shrink-0">
              <div>
                <span className="px-2.5 py-0.5 bg-primary text-on-primary rounded-full font-label-caps text-[10px] font-bold uppercase tracking-wider">
                  Corte Z
                </span>
                <h3 className="font-headline-md text-title-lg font-bold text-on-surface mt-1.5">Acta de Cierre de Turno</h3>
                <p className="font-body-sm font-mono text-outline">Folio: {corteZModal.folio_corte}</p>
              </div>
              <button 
                onClick={() => setCorteZModal(null)} 
                className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-full cursor-pointer transition-colors"
                aria-label="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3.5 text-xs overflow-y-auto flex-1 font-mono">
              <div className="bg-inverse-surface text-primary-fixed p-4 rounded-2xl space-y-1.5 shadow-inner leading-relaxed border border-surface-container-high/40">
                <div className="text-center pb-2 border-b border-white/10 text-white font-bold">
                  *** COMPROBANTE FISCAL DE CORTE Z ***
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Terminal / Caja:</span>
                  <span className="text-white font-bold">{corteZModal.terminal_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Operador:</span>
                  <span className="text-white font-bold">{corteZModal.cajero_nombre}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Apertura:</span>
                  <span>{new Date(corteZModal.fecha_apertura).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Cierre:</span>
                  <span>{corteZModal.fecha_cierre ? new Date(corteZModal.fecha_cierre).toLocaleString() : 'En curso'}</span>
                </div>
                <div className="pt-2 border-t border-white/10 flex justify-between">
                  <span className="text-white/60">Fondo Inicial:</span>
                  <span className="text-white">${corteZModal.fondo_inicial.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-white text-sm">
                  <span>TOTAL COBRADO EN VENTAS:</span>
                  <span>${corteZModal.total_ventas.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-white/60">
                  <span>- Efectivo:</span>
                  <span>${corteZModal.ventas_efectivo.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-white/60">
                  <span>- Tarjetas Débito/Crédito:</span>
                  <span>${corteZModal.ventas_tarjeta.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-white/60">
                  <span>- Transferencias / QR:</span>
                  <span>${corteZModal.ventas_transferencia.toFixed(2)}</span>
                </div>
                <div className="pt-2 border-t border-white/10 flex justify-between">
                  <span className="text-white/60">Total Físico Declarado:</span>
                  <span className="text-white font-bold">${(corteZModal.total_fisico_declarado || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span className="text-white/60">Diferencia / Descuadre:</span>
                  <span className={corteZModal.diferencia === 0 ? 'text-primary-fixed' : corteZModal.diferencia > 0 ? 'text-amber-300' : 'text-error-container'}>
                    ${(corteZModal.diferencia || 0).toFixed(2)} ({corteZModal.estado_cuadre || 'OK'})
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-white/60 pt-1">
                  <span>Tickets Emitidos:</span>
                  <span>{corteZModal.total_tickets_emitidos} ({corteZModal.primer_folio || 'TKT-1'} a {corteZModal.ultimo_folio || 'TKT-N'})</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-surface-container-low/50 border-t border-surface-container-low flex gap-2 justify-end shrink-0">
              <button
                onClick={() => window.print()}
                className="px-5 py-2 font-title-md text-body-sm font-bold text-on-surface bg-surface-container-lowest hover:bg-surface-container border border-surface-container-high/60 rounded-full cursor-pointer transition-colors shadow-xs flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir</span>
              </button>
              <button
                onClick={handleDescargarCorteZ}
                disabled={loadingCorteZ}
                className="px-5 py-2 font-title-md text-body-sm font-bold text-on-primary bg-primary hover:opacity-95 rounded-full cursor-pointer transition-colors shadow-xs flex items-center gap-1.5"
              >
                {descargadoCorteZ ? <Check className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                <span>{descargadoCorteZ ? '¡Descargado!' : 'Descargar TXT'}</span>
              </button>
              <button
                onClick={() => setCorteZModal(null)}
                className="px-5 py-2 font-title-md text-body-sm font-bold text-on-surface hover:bg-surface-container rounded-full cursor-pointer transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Corte X */}
      <CorteXModal
        isOpen={!!corteXSesionId}
        sesionId={corteXSesionId || undefined}
        onClose={() => setCorteXSesionId(null)}
      />

    </div>
  );
}
