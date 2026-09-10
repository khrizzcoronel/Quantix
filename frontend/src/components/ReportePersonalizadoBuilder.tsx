import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Bookmark,
  Sparkles,
  BarChart3,
  TrendingUp,
  Activity,
  Disc,
  PieChart,
  Layers,
  Palette,
  Search,
  Filter,
  Download,
  Printer,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  X,
  Plus,
  Trash2,
  Award,
  CreditCard,
  Eye,
  SlidersHorizontal,
  Users
} from 'lucide-react';
import {
  type ColumnaReporteDef,
  type FilaReporteVenta,
  type TipoAgrupacion,
  type TipoGrafico,
  type TipoSeccion,
  type SeccionReporte,
  type PaletaColor,
  type PlantillaReporteV2,
  PALETAS_CONFIG
} from '../types/reportes';
import ReportePreview from './ReportePreview';
import {
  exportarReporteExcel,
  exportarReporteCSV
} from '../utils/exportUtils';
import { type Sucursal } from '../store/sucursalStore';

export const LOCAL_STORAGE_KEY_TEMPLATES = 'quantix_custom_report_templates';

// 15 Columnas Estándar (conservadas para compatibilidad con suite de pruebas)
export const COLUMNAS_PREDETERMINADAS: ColumnaReporteDef[] = [
  { id: 'fecha', header: 'Fecha', visible: true, align: 'left', categoria: 'TIEMPO' },
  { id: 'folio_ticket', header: 'Folio Ticket', visible: true, align: 'left', categoria: 'OPERACION' },
  { id: 'sucursal_nombre', header: 'Sucursal', visible: true, align: 'left', categoria: 'OPERACION' },
  { id: 'cajero_nombre', header: 'Cajero', visible: true, align: 'left', categoria: 'OPERACION' },
  { id: 'cliente_nombre', header: 'Cliente', visible: true, align: 'left', categoria: 'CLIENTE' },
  { id: 'categoria_nombre', header: 'Categoría', visible: true, align: 'left', categoria: 'PRODUCTO' },
  { id: 'producto_nombre', header: 'Producto', visible: true, align: 'left', categoria: 'PRODUCTO' },
  { id: 'cantidad', header: 'Cantidad', visible: true, align: 'right', categoria: 'FINANZAS' },
  { id: 'precio_unitario', header: 'P. Unitario', visible: true, align: 'right', categoria: 'FINANZAS' },
  { id: 'subtotal', header: 'Subtotal', visible: true, align: 'right', categoria: 'FINANZAS' },
  { id: 'descuento', header: 'Descuento', visible: true, align: 'right', categoria: 'FINANZAS' },
  { id: 'impuestos', header: 'IVA 16%', visible: true, align: 'right', categoria: 'FINANZAS' },
  { id: 'total', header: 'Total', visible: true, align: 'right', categoria: 'FINANZAS' },
  { id: 'margen_ganancia', header: 'Margen Ganancia', visible: true, align: 'right', categoria: 'FINANZAS' },
  { id: 'metodo_pago', header: 'Método de Pago', visible: true, align: 'center', categoria: 'PAGO' },
];

export const PLANTILLAS_SISTEMA: PlantillaReporteV2[] = [
  {
    id: 'tpl-categoria',
    nombre: 'Ventas por Categoría & KPIs',
    descripcion: 'Sección 1 con Gráfico de Barras y Sección 2 con KPIs financieros.',
    es_sistema: true,
    agrupacion: 'CATEGORIA',
    paleta: 'QUANTIX',
    titulo_reporte: 'Informe de Ventas por Categoría',
    subtitulo_reporte: 'Distribución por departamento comercial y métricas de desempeño',
    columnas_activas: ['categoria_nombre', 'cantidad', 'subtotal', 'descuento', 'impuestos', 'total', 'margen_ganancia'],
    secciones: [
      {
        id: 'sec-grafico-cat',
        tipo: 'GRAFICO',
        titulo: 'Ventas por Departamento Comercial',
        tipoGrafico: 'BARRAS',
        dimensionAgrupacion: 'CATEGORIA',
      },
      {
        id: 'sec-kpis-cat',
        tipo: 'KPIS',
        titulo: 'Métricas Financieras Consolidadas',
      },
      {
        id: 'sec-ranking-cat',
        tipo: 'DISTRIBUCION_RANKING',
        titulo: 'Top Artículos de Mayor Venta',
        dimensionRanking: 'PRODUCTO',
        limiteItems: 5,
      }
    ]
  },
  {
    id: 'tpl-cajero',
    nombre: 'Rendimiento Operativo de Personal',
    descripcion: 'Sección 1 con KPIs de cobro y Sección 2 con barras apiladas por cajero.',
    es_sistema: true,
    agrupacion: 'CAJERO',
    paleta: 'CORPORATE',
    titulo_reporte: 'Rendimiento Operativo por Cajero',
    subtitulo_reporte: 'Auditoría de productividad de personal y balance de cobros',
    columnas_activas: ['cajero_nombre', 'sucursal_nombre', 'cantidad', 'subtotal', 'total', 'margen_ganancia'],
    secciones: [
      {
        id: 'sec-kpis-caj',
        tipo: 'KPIS',
        titulo: 'Resumen Ejecutivo de Recaudo',
      },
      {
        id: 'sec-grafico-caj',
        tipo: 'GRAFICO',
        titulo: 'Facturación por Colaborador en Turno',
        tipoGrafico: 'BARRAS_APILADAS',
        dimensionAgrupacion: 'CAJERO',
      },
      {
        id: 'sec-canales-caj',
        tipo: 'CANALES_PAGO',
        titulo: 'Distribución de Medios de Pago en Turno',
      }
    ]
  },
  {
    id: 'tpl-auditoria',
    nombre: 'Auditoría Temporal & Tendencias',
    descripcion: 'Sección 1 con evolución temporal de ventas y Sección 2 con arqueo de canales.',
    es_sistema: true,
    agrupacion: 'LINEA',
    paleta: 'MONO',
    titulo_reporte: 'Auditoría Temporal de Ventas',
    subtitulo_reporte: 'Evolución diaria y canales de cobro auditados',
    columnas_activas: ['fecha', 'folio_ticket', 'sucursal_nombre', 'cajero_nombre', 'cliente_nombre', 'subtotal', 'descuento', 'impuestos', 'total'],
    secciones: [
      {
        id: 'sec-grafico-aud',
        tipo: 'GRAFICO',
        titulo: 'Flujo Temporal de Ingresos',
        tipoGrafico: 'AREA',
        dimensionAgrupacion: 'DIA',
      },
      {
        id: 'sec-kpis-aud',
        tipo: 'KPIS',
        titulo: 'Indicadores Globales del Período',
      },
      {
        id: 'sec-canales-aud',
        tipo: 'CANALES_PAGO',
        titulo: 'Liquidación de Transacciones por Canal',
      }
    ]
  },
  {
    id: 'tpl-cierre-pago',
    nombre: 'Liquidación por Canales de Pago',
    descripcion: 'Sección 1 con Dona de canales y Sección 2 con Ranking de categorías.',
    es_sistema: true,
    agrupacion: 'METODO_PAGO',
    paleta: 'SUNSET',
    titulo_reporte: 'Liquidación por Canales de Pago',
    subtitulo_reporte: 'Arqueo de ingresos por medios bancarios y electrónicos',
    columnas_activas: ['metodo_pago', 'cantidad', 'subtotal', 'total'],
    secciones: [
      {
        id: 'sec-grafico-pag',
        tipo: 'GRAFICO',
        titulo: 'Participación por Medio de Pago',
        tipoGrafico: 'DONA',
        dimensionAgrupacion: 'METODO_PAGO',
      },
      {
        id: 'sec-canales-pag',
        tipo: 'CANALES_PAGO',
        titulo: 'Desglose Detallado de Cobros',
      },
      {
        id: 'sec-ranking-pag',
        tipo: 'DISTRIBUCION_RANKING',
        titulo: 'Top Categorías en el Período',
        dimensionRanking: 'CATEGORIA',
        limiteItems: 5,
      }
    ]
  },
  {
    id: 'tpl-clientes',
    nombre: 'Inteligencia & Cartera de Clientes',
    descripcion: 'Sección 1 con Inteligencia de Clientes, Sección 2 con Gráfico de Top Compradores y Sección 3 con KPIs.',
    es_sistema: true,
    agrupacion: 'CLIENTE',
    paleta: 'QUANTIX',
    titulo_reporte: 'Informe de Inteligencia y Valor de Clientes',
    subtitulo_reporte: 'Análisis de recurrencia, ticket promedio y concentración de cartera',
    columnas_activas: ['cliente_nombre', 'cantidad', 'subtotal', 'total', 'margen_ganancia'],
    secciones: [
      {
        id: 'sec-intel-cli',
        tipo: 'INTELIGENCIA_CLIENTES',
        titulo: 'Métricas de Cartera & Compradores Clave',
        subtitulo: 'Indicadores de recurrencia y clientes de mayor facturación',
      },
      {
        id: 'sec-grafico-cli',
        tipo: 'GRAFICO',
        titulo: 'Facturación por Cliente Destacado',
        tipoGrafico: 'BARRAS',
        dimensionAgrupacion: 'CLIENTE',
      },
      {
        id: 'sec-kpis-cli',
        tipo: 'KPIS',
        titulo: 'Consolidado General de Operaciones',
      },
      {
        id: 'sec-ranking-cli',
        tipo: 'DISTRIBUCION_RANKING',
        titulo: 'Participación en Cartera',
        dimensionRanking: 'CLIENTE',
        limiteItems: 5,
      }
    ]
  },
];

export interface ReportePersonalizadoBuilderProps {
  datosVentas: FilaReporteVenta[];
  sucursales: Sucursal[];
  sucursalSeleccionadaId: string;
  nombreSucursalActiva: string;
  nombreOperador: string;
  rangoFechaLabel: string;
}

export default function ReportePersonalizadoBuilder({
  datosVentas,
  sucursales: _sucursales,
  sucursalSeleccionadaId: _sucursalSeleccionadaId,
  nombreSucursalActiva,
  nombreOperador,
  rangoFechaLabel,
}: ReportePersonalizadoBuilderProps) {
  // Configuración Global del Reporte
  const [paleta, setPaleta] = useState<PaletaColor>('QUANTIX');
  const [tituloReporte, setTituloReporte] = useState<string>('Reporte Estratégico de Operaciones');
  const [subtituloReporte, setSubtituloReporte] = useState<string>('Consolidado ejecutivo y análisis de rendimiento');
  const [mostrarLogo, setMostrarLogo] = useState<boolean>(true);

  // Filtros Globales
  const [filtroCategoria, setFiltroCategoria] = useState<string>('TODAS');
  const [filtroMetodoPago, setFiltroMetodoPago] = useState<string>('TODOS');
  const [filtroCajero, setFiltroCajero] = useState<string>('TODOS');
  const [filtroCliente, setFiltroCliente] = useState<string>('TODOS');
  const [filtroTextoBusqueda, setFiltroTextoBusqueda] = useState<string>('');

  // SECCIONES DINÁMICAS (Lienzo Modular)
  const [secciones, setSecciones] = useState<SeccionReporte[]>([
    {
      id: 'sec-1',
      tipo: 'GRAFICO',
      titulo: 'Comportamiento de Ventas por Categoría',
      subtitulo: 'Desglose de facturación por departamento comercial',
      tipoGrafico: 'BARRAS',
      dimensionAgrupacion: 'CATEGORIA',
    },
    {
      id: 'sec-2',
      tipo: 'KPIS',
      titulo: 'Métricas Financieras Consolidadas',
      subtitulo: 'Indicadores C-Level de rentabilidad y volumen',
    },
    {
      id: 'sec-3',
      tipo: 'DISTRIBUCION_RANKING',
      titulo: 'Top Artículos de Mayor Rotación',
      subtitulo: 'Participación porcentual sobre el volumen total',
      dimensionRanking: 'PRODUCTO',
      limiteItems: 5,
    },
  ]);

  const [seccionExpandidaId, setSeccionExpandidaId] = useState<string | null>('sec-1');
  const [modalAgregarSeccionOpen, setModalAgregarSeccionOpen] = useState(false);

  // Plantillas
  const [plantillaActivaId, setPlantillaActivaId] = useState<string>('tpl-categoria');
  const [plantillasGuardadas, setPlantillasGuardadas] = useState<PlantillaReporteV2[]>([]);
  const [modalGuardarPlantillaOpen, setModalGuardarPlantillaOpen] = useState(false);
  const [nombreNuevaPlantilla, setNombreNuevaPlantilla] = useState('');
  const [descNuevaPlantilla, setDescNuevaPlantilla] = useState('');

  // Cargar plantillas desde localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY_TEMPLATES);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setPlantillasGuardadas(parsed);
        }
      }
    } catch {
      // Ignorar errores de parseo
    }
  }, []);

  const guardarPlantillasStorage = (nuevas: PlantillaReporteV2[]) => {
    setPlantillasGuardadas(nuevas);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_TEMPLATES, JSON.stringify(nuevas));
    } catch {
      // Ignorar
    }
  };

  // Catálogos dinámicos
  const categoriasDisponibles = useMemo(() => {
    const cats = new Set(datosVentas.map((v) => v.categoria_nombre));
    return ['TODAS', ...Array.from(cats).sort()];
  }, [datosVentas]);

  const cajerosDisponibles = useMemo(() => {
    const cajeros = new Set(datosVentas.map((v) => v.cajero_nombre));
    return ['TODOS', ...Array.from(cajeros).sort()];
  }, [datosVentas]);

  const clientesDisponibles = useMemo(() => {
    const clientes = new Set(datosVentas.map((v) => v.cliente_nombre).filter(Boolean));
    return ['TODOS', ...Array.from(clientes).sort()];
  }, [datosVentas]);

  // Filtrado de registros
  const ventasFiltradas = useMemo(() => {
    return datosVentas.filter((row) => {
      if (filtroCategoria !== 'TODAS' && row.categoria_nombre !== filtroCategoria) return false;
      if (filtroMetodoPago !== 'TODOS' && row.metodo_pago !== filtroMetodoPago) return false;
      if (filtroCajero !== 'TODOS' && row.cajero_nombre !== filtroCajero) return false;
      if (filtroCliente !== 'TODOS' && row.cliente_nombre !== filtroCliente) return false;

      if (filtroTextoBusqueda.trim() !== '') {
        const query = filtroTextoBusqueda.toLowerCase();
        const coincide =
          row.folio_ticket.toLowerCase().includes(query) ||
          row.producto_nombre.toLowerCase().includes(query) ||
          row.cliente_nombre.toLowerCase().includes(query) ||
          row.sucursal_nombre.toLowerCase().includes(query) ||
          row.cajero_nombre.toLowerCase().includes(query);
        if (!coincide) return false;
      }

      return true;
    });
  }, [datosVentas, filtroCategoria, filtroMetodoPago, filtroCajero, filtroCliente, filtroTextoBusqueda]);

  // OPERACIONES DE SECCIONES
  const agregarSeccion = (tipo: TipoSeccion) => {
    const nuevoId = `sec-${Date.now()}`;
    let nueva: SeccionReporte;

    switch (tipo) {
      case 'KPIS':
        nueva = {
          id: nuevoId,
          tipo: 'KPIS',
          titulo: 'Tarjetas de Métricas & KPIs',
          subtitulo: 'Resumen consolidado de rentabilidad',
        };
        break;
      case 'DISTRIBUCION_RANKING':
        nueva = {
          id: nuevoId,
          tipo: 'DISTRIBUCION_RANKING',
          titulo: 'Ranking & Participación Comercial',
          subtitulo: 'Desglose de mayor volumen en período',
          dimensionRanking: 'PRODUCTO',
          limiteItems: 5,
        };
        break;
      case 'CANALES_PAGO':
        nueva = {
          id: nuevoId,
          tipo: 'CANALES_PAGO',
          titulo: 'Canales de Cobro & Recaudo',
          subtitulo: 'Arqueo de ingresos por canal',
        };
        break;
      case 'COMPARATIVA_DUAL':
        nueva = {
          id: nuevoId,
          tipo: 'COMPARATIVA_DUAL',
          titulo: 'Comparativa Dual Cruzada',
          subtitulo: 'Evolución temporal y categorías',
        };
        break;
      case 'INTELIGENCIA_CLIENTES':
        nueva = {
          id: nuevoId,
          tipo: 'INTELIGENCIA_CLIENTES',
          titulo: 'Inteligencia & Cartera de Clientes',
          subtitulo: 'Análisis de retención, valor promedio y compradores clave',
        };
        break;
      case 'GRAFICO':
      default:
        nueva = {
          id: nuevoId,
          tipo: 'GRAFICO',
          titulo: 'Visualización Gráfica',
          tipoGrafico: 'BARRAS',
          dimensionAgrupacion: 'CATEGORIA',
        };
        break;
    }

    setSecciones((prev) => [...prev, nueva]);
    setSeccionExpandidaId(nuevoId);
    setModalAgregarSeccionOpen(false);
  };

  const eliminarSeccion = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSecciones((prev) => prev.filter((s) => s.id !== id));
  };

  const moverSeccion = (index: number, direccion: 'arriba' | 'abajo', e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const targetIdx = direccion === 'arriba' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= secciones.length) return;

    const copia = [...secciones];
    const temp = copia[index];
    copia[index] = copia[targetIdx];
    copia[targetIdx] = temp;
    setSecciones(copia);
  };

  const actualizarSeccion = (id: string, cambios: Partial<SeccionReporte>) => {
    setSecciones((prev) =>
      prev.map((sec) => (sec.id === id ? { ...sec, ...cambios } : sec))
    );
  };

  // Handlers de Plantillas
  const aplicarPlantilla = (plantillaId: string) => {
    setPlantillaActivaId(plantillaId);
    if (plantillaId === 'personalizada') return;

    const todas = [...PLANTILLAS_SISTEMA, ...plantillasGuardadas];
    const encontrada = todas.find((p) => p.id === plantillaId);
    if (!encontrada) return;

    if (encontrada.paleta) setPaleta(encontrada.paleta);
    if (encontrada.titulo_reporte) setTituloReporte(encontrada.titulo_reporte);
    if (encontrada.subtitulo_reporte !== undefined) setSubtituloReporte(encontrada.subtitulo_reporte);
    if (encontrada.mostrar_logo !== undefined) setMostrarLogo(encontrada.mostrar_logo);
    if (encontrada.secciones && encontrada.secciones.length > 0) {
      setSecciones(encontrada.secciones);
      setSeccionExpandidaId(encontrada.secciones[0]?.id || null);
    }
  };

  const handleGuardarPlantilla = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreNuevaPlantilla.trim()) return;

    const nueva: PlantillaReporteV2 = {
      id: `usr-tpl-${Date.now()}`,
      nombre: nombreNuevaPlantilla.trim(),
      descripcion: descNuevaPlantilla.trim() || 'Plantilla modular con secciones personalizadas.',
      es_sistema: false,
      agrupacion: 'CATEGORIA',
      columnas_activas: ['categoria_nombre', 'total'],
      paleta,
      titulo_reporte: tituloReporte,
      subtitulo_reporte: subtituloReporte,
      mostrar_logo: mostrarLogo,
      secciones,
    };

    const actualizadas = [nueva, ...plantillasGuardadas];
    guardarPlantillasStorage(actualizadas);
    setPlantillaActivaId(nueva.id);
    setModalGuardarPlantillaOpen(false);
    setNombreNuevaPlantilla('');
    setDescNuevaPlantilla('');
  };

  const handleEliminarPlantilla = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtradas = plantillasGuardadas.filter((p) => p.id !== id);
    guardarPlantillasStorage(filtradas);
    if (plantillaActivaId === id) {
      setPlantillaActivaId('personalizada');
    }
  };

  // Exportar a CSV
  // Exportar el reporte exclusivo de la vista previa a Microsoft Excel (.xls)
  const handleExportarExcel = () => {
    if (ventasFiltradas.length === 0) {
      alert('No hay registros de ventas para exportar con los filtros actuales.');
      return;
    }

    const fechaHoyStr = new Date().toISOString().split('T')[0];
    const nombreArchivo = `Quantix_Reporte_Ejecutivo_${fechaHoyStr}`;

    const fechaEmision = new Date().toLocaleDateString('es-EC', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    const folioReporte = `QX-REP-${new Date().getFullYear()}-${Math.abs(
      (tituloReporte.length * 41 + nombreSucursalActiva.length * 17) % 9000 + 1000
    )}`;

    exportarReporteExcel({
      filename: nombreArchivo,
      tituloReporte,
      subtituloReporte,
      nombreSucursal: nombreSucursalActiva,
      nombreOperador,
      rangoFechaLabel,
      folioReporte,
      fechaEmision,
      paleta,
      secciones,
      ventas: ventasFiltradas,
    });
  };

  // Exportar el reporte estructurado de la vista previa a CSV (.csv)
  const handleExportarCSV = () => {
    if (ventasFiltradas.length === 0) {
      alert('No hay registros de ventas para exportar con los filtros actuales.');
      return;
    }

    const fechaHoyStr = new Date().toISOString().split('T')[0];
    const nombreArchivo = `Quantix_Reporte_Ejecutivo_${fechaHoyStr}`;

    const fechaEmision = new Date().toLocaleDateString('es-EC', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    const folioReporte = `QX-REP-${new Date().getFullYear()}-${Math.abs(
      (tituloReporte.length * 41 + nombreSucursalActiva.length * 17) % 9000 + 1000
    )}`;

    exportarReporteCSV({
      filename: nombreArchivo,
      tituloReporte,
      subtituloReporte,
      nombreSucursal: nombreSucursalActiva,
      nombreOperador,
      rangoFechaLabel,
      folioReporte,
      fechaEmision,
      secciones,
      ventas: ventasFiltradas,
    });
  };

  const handleImprimirReporte = useCallback(() => {
    window.print();
  }, []);

  return (
    <div className="flex flex-col xl:flex-row gap-6 items-start w-full print:block print:w-full print:p-0 print:m-0">
      {/* ========================================================= */}
      {/* PANEL IZQUIERDO: CONSTRUCTOR DE SECCIONES MODULARES       */}
      {/* ========================================================= */}
      <div className="w-full xl:w-[440px] shrink-0 space-y-4 print:hidden">
        {/* Cabecera del Constructor */}
        <div className="p-4 rounded-3xl bg-surface-container-lowest border border-surface-container-high/60 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-2xl bg-primary-container/20 text-primary">
              <SlidersHorizontal className="w-4 h-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-title-md font-bold text-sm text-on-surface">
                  Lienzo de Secciones
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-label-caps text-[9px] uppercase font-bold tracking-wider">
                  {nombreSucursalActiva}
                </span>
              </div>
              <p className="text-[11px] text-outline">
                {secciones.length} bloques modulares • {ventasFiltradas.length} transacciones
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setModalGuardarPlantillaOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-title-md font-semibold border border-surface-container-high/60 transition-all cursor-pointer shadow-xs"
            title="Guardar diseño de secciones como plantilla"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>Guardar</span>
          </button>
        </div>

        {/* 1. SECCIÓN: PLANTILLAS DEL SISTEMA */}
        <div className="p-4 rounded-3xl bg-surface-container-lowest border border-surface-container-high/60 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-label-caps text-[10px] uppercase font-bold text-outline flex items-center gap-1.5">
              <Bookmark className="w-3.5 h-3.5 text-primary" />
              Plantilla Predeterminada
            </span>
            {plantillasGuardadas.some((p) => p.id === plantillaActivaId) && (
              <button
                type="button"
                onClick={(e) => handleEliminarPlantilla(plantillaActivaId, e)}
                className="text-[11px] text-error hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <X className="w-3 h-3" />
                <span>Borrar</span>
              </button>
            )}
          </div>

          <div className="relative">
            <select
              value={plantillaActivaId}
              onChange={(e) => aplicarPlantilla(e.target.value)}
              className="w-full pl-3 pr-8 py-2 rounded-2xl bg-surface-container-low text-on-surface font-title-md text-xs font-semibold border border-surface-container-high/60 appearance-none cursor-pointer focus:outline-primary"
            >
              <option value="personalizada">Lienzo Personalizado Libre</option>
              <optgroup label="Plantillas de Secciones de Sistema">
                {PLANTILLAS_SISTEMA.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.nombre}
                  </option>
                ))}
              </optgroup>
              {plantillasGuardadas.length > 0 && (
                <optgroup label="Mis Plantillas Guardadas">
                  {plantillasGuardadas.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.nombre}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <ChevronDown className="w-4 h-4 text-outline absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* 2. BOTÓN DESTACADO: AGREGAR SECCIÓN */}
        <button
          type="button"
          onClick={() => setModalAgregarSeccionOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-3xl bg-primary hover:opacity-95 text-on-primary font-title-md text-xs font-bold shadow-sm transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ Agregar Nueva Sección al Reporte</span>
        </button>

        {/* 3. LISTA ORDENABLE DE SECCIONES ACTIVAS */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="font-label-caps text-[10px] uppercase font-bold text-outline">
              Estructura & Jerarquía ({secciones.length} bloques)
            </span>
            <span className="text-[10px] text-outline">Usa ▲ ▼ para ordenar</span>
          </div>

          {secciones.map((sec, idx) => {
            const expandida = seccionExpandidaId === sec.id;
            return (
              <div
                key={sec.id}
                className={`rounded-3xl border transition-all overflow-hidden ${
                  expandida
                    ? 'bg-surface-container-lowest border-primary shadow-xs ring-1 ring-primary/30'
                    : 'bg-surface-container-lowest border-surface-container-high/60 shadow-2xs hover:border-surface-container-highest'
                }`}
              >
                {/* Cabecera de la sección (con botones de subir, bajar y borrar) */}
                <div
                  onClick={() => setSeccionExpandidaId(expandida ? null : sec.id)}
                  className="p-3.5 flex items-center justify-between gap-2 cursor-pointer select-none bg-surface-container-low/50"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-[11px] flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="font-title-md font-bold text-xs text-on-surface truncate">
                        {sec.titulo || `Sección ${idx + 1}`}
                      </div>
                      <div className="text-[10px] text-outline font-mono uppercase">
                        {sec.tipo.replace('_', ' ')}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {/* Botón Subir */}
                    <button
                      type="button"
                      onClick={(e) => moverSeccion(idx, 'arriba', e)}
                      disabled={idx === 0}
                      className="p-1 rounded-lg hover:bg-surface-container disabled:opacity-20 text-on-surface-variant hover:text-primary cursor-pointer"
                      title="Mover arriba"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>

                    {/* Botón Bajar */}
                    <button
                      type="button"
                      onClick={(e) => moverSeccion(idx, 'abajo', e)}
                      disabled={idx === secciones.length - 1}
                      className="p-1 rounded-lg hover:bg-surface-container disabled:opacity-20 text-on-surface-variant hover:text-primary cursor-pointer"
                      title="Mover abajo"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>

                    {/* Botón Eliminar */}
                    <button
                      type="button"
                      onClick={(e) => eliminarSeccion(sec.id, e)}
                      className="p-1 rounded-lg hover:bg-error-container/30 text-outline hover:text-error cursor-pointer"
                      title="Eliminar sección"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setSeccionExpandidaId(expandida ? null : sec.id)}
                      className="p-1 text-outline cursor-pointer"
                    >
                      {expandida ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Contenido expandido de configuración de la sección */}
                {expandida && (
                  <div className="p-4 border-t border-surface-container-high/40 space-y-3 text-xs animate-in fade-in duration-150">
                    {/* Título de la sección */}
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-outline mb-1">
                        Título del Bloque
                      </label>
                      <input
                        type="text"
                        value={sec.titulo}
                        onChange={(e) => actualizarSeccion(sec.id, { titulo: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-xl bg-surface-container-low text-xs font-semibold text-on-surface border border-surface-container-high/60 outline-none focus:border-primary"
                      />
                    </div>

                    {/* Subtítulo de la sección */}
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-outline mb-1">
                        Subtítulo / Observación
                      </label>
                      <input
                        type="text"
                        value={sec.subtitulo || ''}
                        onChange={(e) => actualizarSeccion(sec.id, { subtitulo: e.target.value })}
                        placeholder="Opcional..."
                        className="w-full px-3 py-1.5 rounded-xl bg-surface-container-low text-xs text-on-surface border border-surface-container-high/60 outline-none focus:border-primary"
                      />
                    </div>

                    {/* Opciones específicas si es GRAFICO */}
                    {sec.tipo === 'GRAFICO' && (
                      <div className="space-y-3 pt-2 border-t border-surface-container-high/40">
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-outline mb-1.5">
                            Tipo de Gráfico
                          </label>
                          <div className="grid grid-cols-3 gap-1.5">
                            {[
                              { id: 'BARRAS', label: 'Barras', icon: BarChart3 },
                              { id: 'LINEA', label: 'Línea', icon: TrendingUp },
                              { id: 'AREA', label: 'Área', icon: Activity },
                              { id: 'DONA', label: 'Dona', icon: Disc },
                              { id: 'PIE', label: 'Torta', icon: PieChart },
                              { id: 'BARRAS_APILADAS', label: 'Apiladas', icon: Layers },
                            ].map((tipo) => {
                              const Icon = tipo.icon;
                              const activo = (sec.tipoGrafico || 'BARRAS') === tipo.id;
                              return (
                                <button
                                  key={tipo.id}
                                  type="button"
                                  onClick={() => actualizarSeccion(sec.id, { tipoGrafico: tipo.id as TipoGrafico })}
                                  className={`flex items-center gap-1.5 p-2 rounded-xl border text-[11px] font-semibold transition-all cursor-pointer ${
                                    activo
                                      ? 'bg-primary text-on-primary border-primary shadow-xs'
                                      : 'bg-surface-container-low border-surface-container-high/60 text-on-surface-variant hover:bg-surface-container'
                                  }`}
                                >
                                  <Icon className="w-3.5 h-3.5" />
                                  <span>{tipo.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] uppercase font-bold text-outline mb-1">
                            Dimensión a Graficar
                          </label>
                          <select
                            value={sec.dimensionAgrupacion || 'CATEGORIA'}
                            onChange={(e) =>
                              actualizarSeccion(sec.id, { dimensionAgrupacion: e.target.value as TipoAgrupacion })
                            }
                            className="w-full py-1.5 px-2.5 rounded-xl bg-surface-container-low text-xs font-semibold text-on-surface border border-surface-container-high/60 cursor-pointer"
                          >
                            <option value="CATEGORIA">Por Categoría Comercial</option>
                            <option value="PRODUCTO">Por Producto / Artículo</option>
                            <option value="DIA">Por Día (Evolución Temporal)</option>
                            <option value="CAJERO">Por Cajero / Colaborador</option>
                            <option value="METODO_PAGO">Por Método de Pago</option>
                            <option value="CLIENTE">Por Cliente (Top Compradores)</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Opciones específicas si es DISTRIBUCION_RANKING */}
                    {sec.tipo === 'DISTRIBUCION_RANKING' && (
                      <div className="space-y-3 pt-2 border-t border-surface-container-high/40">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] uppercase font-bold text-outline mb-1">
                              Clasificar Por
                            </label>
                            <select
                              value={sec.dimensionRanking || 'PRODUCTO'}
                              onChange={(e) =>
                                actualizarSeccion(sec.id, {
                                  dimensionRanking: e.target.value as 'PRODUCTO' | 'CATEGORIA' | 'CAJERO' | 'CLIENTE',
                                })
                              }
                              className="w-full py-1.5 px-2.5 rounded-xl bg-surface-container-low text-xs font-semibold text-on-surface border border-surface-container-high/60 cursor-pointer"
                            >
                              <option value="PRODUCTO">Top Productos</option>
                              <option value="CATEGORIA">Top Categorías</option>
                              <option value="CAJERO">Top Cajeros</option>
                              <option value="CLIENTE">Top Clientes</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] uppercase font-bold text-outline mb-1">
                              Cantidad de Items
                            </label>
                            <select
                              value={sec.limiteItems || 5}
                              onChange={(e) =>
                                actualizarSeccion(sec.id, { limiteItems: Number(e.target.value) })
                              }
                              className="w-full py-1.5 px-2.5 rounded-xl bg-surface-container-low text-xs font-semibold text-on-surface border border-surface-container-high/60 cursor-pointer"
                            >
                              <option value={5}>Top 5</option>
                              <option value={8}>Top 8</option>
                              <option value={10}>Top 10</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 4. CONFIGURACIÓN DE ESTILO & PALETA CORPORATIVA */}
        <div className="p-4 rounded-3xl bg-surface-container-lowest border border-surface-container-high/60 shadow-xs space-y-3">
          <span className="font-label-caps text-[10px] uppercase font-bold text-outline flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-primary" />
            Paleta de Color & Membrete
          </span>

          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(PALETAS_CONFIG) as PaletaColor[]).map((palId) => {
              const palDef = PALETAS_CONFIG[palId];
              const activo = paleta === palId;
              return (
                <button
                  key={palId}
                  type="button"
                  onClick={() => setPaleta(palId)}
                  className={`flex items-center gap-2 p-2 rounded-2xl border text-left transition-all cursor-pointer ${
                    activo
                      ? 'bg-surface-container-high border-primary ring-2 ring-primary/40 shadow-xs font-bold'
                      : 'bg-surface-container-low border-surface-container-high/60 text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  <div className="flex -space-x-1 shrink-0">
                    <span
                      className="w-3 h-3 rounded-full border border-surface-container-lowest"
                      style={{ backgroundColor: palDef.primario }}
                    />
                    <span
                      className="w-3 h-3 rounded-full border border-surface-container-lowest"
                      style={{ backgroundColor: palDef.secundario }}
                    />
                  </div>
                  <span className="text-[11px] font-title-md truncate">{palDef.nombre}</span>
                </button>
              );
            })}
          </div>

          <div className="space-y-2 pt-2 border-t border-surface-container-high/40">
            <div>
              <label className="block font-label-caps text-[10px] uppercase font-bold text-outline mb-1">
                Título General del Documento
              </label>
              <input
                type="text"
                value={tituloReporte}
                onChange={(e) => setTituloReporte(e.target.value)}
                placeholder="Ej. Reporte Ejecutivo de Operaciones"
                className="w-full px-3 py-1.5 rounded-xl bg-surface-container-low text-xs font-title-md font-semibold text-on-surface border border-surface-container-high/60 outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block font-label-caps text-[10px] uppercase font-bold text-outline mb-1">
                Subtítulo General
              </label>
              <input
                type="text"
                value={subtituloReporte}
                onChange={(e) => setSubtituloReporte(e.target.value)}
                placeholder="Ej. Auditoría de cierre y rentabilidad"
                className="w-full px-3 py-1.5 rounded-xl bg-surface-container-low text-xs font-title-md text-on-surface border border-surface-container-high/60 outline-none focus:border-primary"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
              <input
                type="checkbox"
                checked={mostrarLogo}
                onChange={(e) => setMostrarLogo(e.target.checked)}
                className="accent-primary rounded cursor-pointer w-4 h-4"
              />
              <span className="text-xs text-on-surface font-title-md">
                Mostrar logotipo oficial en membrete
              </span>
            </label>
          </div>
        </div>

        {/* 5. FILTROS GLOBALES DEL REPORTE */}
        <div className="p-4 rounded-3xl bg-surface-container-lowest border border-surface-container-high/60 shadow-xs space-y-2.5">
          <span className="font-label-caps text-[10px] uppercase font-bold text-outline flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-primary" />
            Filtros Globales de Datos
          </span>

          <div className="space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] uppercase font-bold text-outline mb-0.5">Categoría</label>
                <select
                  value={filtroCategoria}
                  onChange={(e) => setFiltroCategoria(e.target.value)}
                  className="w-full py-1.5 px-2.5 rounded-xl bg-surface-container-low text-xs font-semibold text-on-surface border border-surface-container-high/60 cursor-pointer"
                >
                  {categoriasDisponibles.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat === 'TODAS' ? 'Todas' : cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-outline mb-0.5">Cliente</label>
                <select
                  value={filtroCliente}
                  onChange={(e) => setFiltroCliente(e.target.value)}
                  className="w-full py-1.5 px-2.5 rounded-xl bg-surface-container-low text-xs font-semibold text-on-surface border border-surface-container-high/60 cursor-pointer"
                >
                  {clientesDisponibles.map((cli) => (
                    <option key={cli} value={cli}>
                      {cli === 'TODOS' ? 'Todos' : cli}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] uppercase font-bold text-outline mb-0.5">Método de Pago</label>
                <select
                  value={filtroMetodoPago}
                  onChange={(e) => setFiltroMetodoPago(e.target.value)}
                  className="w-full py-1.5 px-2.5 rounded-xl bg-surface-container-low text-xs font-semibold text-on-surface border border-surface-container-high/60 cursor-pointer"
                >
                  <option value="TODOS">Todos</option>
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="TARJETA">Tarjeta</option>
                  <option value="QR_DEUNA">QR DeUna</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-outline mb-0.5">Cajero</label>
                <select
                  value={filtroCajero}
                  onChange={(e) => setFiltroCajero(e.target.value)}
                  className="w-full py-1.5 px-2.5 rounded-xl bg-surface-container-low text-xs font-semibold text-on-surface border border-surface-container-high/60 cursor-pointer"
                >
                  {cajerosDisponibles.map((caj) => (
                    <option key={caj} value={caj}>
                      {caj === 'TODOS' ? 'Todos' : caj}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="relative pt-1">
              <Search className="w-3.5 h-3.5 text-outline absolute left-2.5 top-[18px]" />
              <input
                type="text"
                placeholder="Buscar ticket, cliente o artículo…"
                value={filtroTextoBusqueda}
                onChange={(e) => setFiltroTextoBusqueda(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-surface-container-low text-xs font-title-md text-on-surface border border-surface-container-high/60 outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>

        {/* 6. ACCIONES DE SALIDA: EXCEL Y PDF */}
        <div className="p-4 rounded-3xl bg-surface-container-lowest border border-surface-container-high/60 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-label-caps text-[10px] uppercase font-bold text-outline">
              Exportación & Salida
            </span>
            <span className="text-[10px] text-outline font-medium">
              Fiel a Vista Previa
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleExportarExcel}
              disabled={ventasFiltradas.length === 0}
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-title-md text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
              title="Descargar reporte en formato Excel (.xls) fiel a la vista previa"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar Excel</span>
            </button>

            <button
              type="button"
              onClick={handleImprimirReporte}
              disabled={ventasFiltradas.length === 0}
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-surface-container hover:bg-surface-container-high text-on-surface font-title-md text-xs font-bold border border-surface-container-high/60 shadow-xs transition-all cursor-pointer disabled:opacity-50"
              title="Imprimir reporte membretado o guardar como PDF"
            >
              <Printer className="w-3.5 h-3.5 text-secondary" />
              <span>Imprimir / PDF</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleExportarCSV}
            disabled={ventasFiltradas.length === 0}
            className="w-full flex items-center justify-center gap-1.5 py-1 text-center text-outline hover:text-on-surface font-title-md text-[11px] transition-all cursor-pointer disabled:opacity-40 hover:underline"
            title="Descargar datos estructurados de las secciones en formato CSV"
          >
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* PANEL DERECHO: VISTA PREVIA EN TIEMPO REAL (CANVAS)       */}
      {/* ========================================================= */}
      <div className="flex-1 min-w-0 w-full print:w-full print:block print:p-0 print:m-0">
        {/* Barra superior de la vista previa */}
        <div className="mb-3 flex items-center justify-between px-2 print:hidden">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-primary" />
            <h3 className="font-title-md font-bold text-sm text-on-surface">
              Vista Previa Modular en Tiempo Real
            </h3>
            <span className="px-2.5 py-0.5 rounded-full bg-surface-container-high font-mono text-[10px] text-outline font-bold">
              {secciones.length} secciones
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleImprimirReporte}
              className="flex items-center gap-1.5 text-xs text-primary font-bold hover:underline cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Vista de Impresión / PDF</span>
            </button>
          </div>
        </div>

        {/* Componente Puro de Vista Previa */}
        <ReportePreview
          ventas={ventasFiltradas}
          secciones={secciones}
          paleta={paleta}
          tituloReporte={tituloReporte}
          subtituloReporte={subtituloReporte}
          mostrarLogo={mostrarLogo}
          nombreSucursal={nombreSucursalActiva}
          nombreOperador={nombreOperador}
          rangoFechaLabel={rangoFechaLabel}
        />
      </div>

      {/* ========================================================= */}
      {/* MODAL: SELECCIONAR NUEVO TIPO DE SECCIÓN                  */}
      {/* ========================================================= */}
      {modalAgregarSeccionOpen && (
        <div className="fixed inset-0 bg-inverse-surface/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150 print:hidden">
          <div className="bg-surface-container-lowest rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-surface-container-high/60 flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-high/60">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" />
                <h3 className="font-headline-md text-lg font-bold text-on-surface">
                  Agregar Nueva Sección al Reporte
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalAgregarSeccionOpen(false)}
                className="p-1 rounded-full text-outline hover:text-on-surface hover:bg-surface-container cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-on-surface-variant">
              Selecciona el tipo de bloque visual que deseas incorporar en esta sección del reporte:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {[
                {
                  tipo: 'GRAFICO' as TipoSeccion,
                  titulo: 'Gráfico Personalizado',
                  desc: 'Barras, Líneas, Áreas, Donas o Tortas agrupadas por categoría, día o producto.',
                  icon: BarChart3,
                },
                {
                  tipo: 'KPIS' as TipoSeccion,
                  titulo: 'Tarjetas de Métricas & KPIs',
                  desc: 'Ventas Netas, Margen Bruto %, Ticket Promedio y Volumen de Operaciones.',
                  icon: Sparkles,
                },
                {
                  tipo: 'DISTRIBUCION_RANKING' as TipoSeccion,
                  titulo: 'Ranking & Participación',
                  desc: 'Barras de progreso visuales con los Top artículos o categorías sin tablas.',
                  icon: Award,
                },
                {
                  tipo: 'CANALES_PAGO' as TipoSeccion,
                  titulo: 'Canales de Cobro & Recaudo',
                  desc: 'Tarjetas y medidores de participación para Efectivo, Tarjetas y QR DeUna.',
                  icon: CreditCard,
                },
                {
                  tipo: 'COMPARATIVA_DUAL' as TipoSeccion,
                  titulo: 'Comparativa Dual Cruzada',
                  desc: 'Dos visualizaciones simultáneas: evolución temporal + dona de categorías.',
                  icon: Activity,
                },
                {
                  tipo: 'INTELIGENCIA_CLIENTES' as TipoSeccion,
                  titulo: 'Inteligencia de Clientes',
                  desc: 'Métricas LTV, frecuencia media y ranking de compradores clave sin tablas.',
                  icon: Users,
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.tipo}
                    type="button"
                    onClick={() => agregarSeccion(item.tipo)}
                    className="p-3.5 rounded-2xl bg-surface-container-low border border-surface-container-high/60 hover:border-primary hover:bg-surface-container text-left transition-all cursor-pointer group shadow-2xs"
                  >
                    <div className="flex items-center gap-2 text-primary font-bold text-xs mb-1">
                      <Icon className="w-4 h-4" />
                      <span>{item.titulo}</span>
                    </div>
                    <p className="text-[11px] text-outline leading-snug">{item.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: GUARDAR PLANTILLA MODULAR                          */}
      {/* ========================================================= */}
      {modalGuardarPlantillaOpen && (
        <div className="fixed inset-0 bg-inverse-surface/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150 print:hidden">
          <div className="bg-surface-container-lowest rounded-3xl shadow-2xl max-w-md w-full p-6 border border-surface-container-high/60 flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-high/60">
              <div className="flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-primary" />
                <h3 className="font-headline-md text-lg font-bold text-on-surface">
                  Guardar Plantilla de Secciones
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalGuardarPlantillaOpen(false)}
                className="p-1 rounded-full text-outline hover:text-on-surface hover:bg-surface-container cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleGuardarPlantilla} className="space-y-4">
              <div>
                <label className="block font-label-caps text-xs uppercase font-bold text-outline mb-1">
                  Nombre de la Plantilla *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Cierre de Secciones Gerencial"
                  value={nombreNuevaPlantilla}
                  onChange={(e) => setNombreNuevaPlantilla(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-2xl bg-surface-container-low text-xs font-semibold text-on-surface border border-surface-container-high/60 outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block font-label-caps text-xs uppercase font-bold text-outline mb-1">
                  Descripción
                </label>
                <textarea
                  rows={2}
                  placeholder="Describe la composición de este reporte…"
                  value={descNuevaPlantilla}
                  onChange={(e) => setDescNuevaPlantilla(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-2xl bg-surface-container-low text-xs text-on-surface border border-surface-container-high/60 outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="p-3 rounded-2xl bg-surface-container-low border border-surface-container-high/40 text-xs space-y-1 text-on-surface-variant">
                <div>
                  <strong>Secciones configuradas:</strong> {secciones.length}
                </div>
                <div>
                  <strong>Paleta:</strong> {PALETAS_CONFIG[paleta].nombre}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalGuardarPlantillaOpen(false)}
                  className="px-4 py-2 rounded-full bg-surface-container text-xs font-semibold text-on-surface cursor-pointer hover:bg-surface-container-high"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full bg-primary text-on-primary text-xs font-bold shadow-xs cursor-pointer hover:opacity-95"
                >
                  Guardar Plantilla
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
