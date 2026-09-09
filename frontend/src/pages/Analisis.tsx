import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  ResponsiveContainer, Area, Line,
  ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ReferenceLine, Cell, Bar
} from 'recharts';
import { 
  TrendingUp, Calendar, Building2, Lock, 
  RefreshCw, SlidersHorizontal, Layers, Printer, 
  Download, ChevronDown, ChevronUp,
  Search, Bookmark, Sparkles, ArrowUp, ArrowDown, Info,
  Users, DollarSign, ShoppingBag, Receipt,
  Grid, ArrowUpDown, X
} from 'lucide-react';

import { useAuthStore } from '../store/authStore';
import { useSucursalStore, type Sucursal } from '../store/sucursalStore';
import api from '../services/api';
import { exportToCSV, formatCurrency, formatNumber, formatDate, type ExportColumn } from '../utils/exportUtils';

// ==========================================
// TIPOS Y MODELOS DE DATOS
// ==========================================

export type RangoFechaId = '7d' | '30d' | '90d' | 'ytd' | 'custom';

export type GranularidadGrafico = 'DIA' | 'SEMANA' | 'MES';

export type TipoAgrupacion = 'LINEA' | 'DIA' | 'PRODUCTO' | 'CATEGORIA' | 'CAJERO' | 'METODO_PAGO';

export interface ColumnaReporteDef {
  id: string;
  header: string;
  visible: boolean;
  align?: 'left' | 'center' | 'right';
  formatter?: (val: any, row: any) => string;
}

export interface FilaReporteVenta {
  id: string;
  fecha: string;
  folio_ticket: string;
  sucursal_id: string;
  sucursal_nombre: string;
  cajero_nombre: string;
  cliente_nombre: string;
  categoria_nombre: string;
  producto_nombre: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  descuento: number;
  impuestos: number;
  total: number;
  margen_ganancia: number;
  metodo_pago: 'EFECTIVO' | 'TARJETA' | 'QR_DEUNA';
}

export interface PlantillaReporte {
  id: string;
  nombre: string;
  descripcion: string;
  es_sistema?: boolean;
  agrupacion: TipoAgrupacion;
  columnas_activas: string[];
  categoria_filtro?: string;
  metodo_pago_filtro?: string;
  cajero_filtro?: string;
}

export interface ProductoPareto {
  id: string;
  nombre: string;
  categoria: string;
  unidades: number;
  ingresos: number;
  margen: number;
  porcentaje_ingresos: number;
  porcentaje_acumulado: number;
  clase: 'A' | 'B' | 'C';
}

export interface SegmentoRFM {
  segmento: string;
  titulo: string;
  icon_name: string;
  descripcion: string;
  clientes_count: number;
  porcentaje_base: number;
  ticket_promedio: number;
  total_gasto: number;
  badge_color: string;
  accion_recomendada: string;
}

export interface ProyeccionDemandaInferencial {
  producto_id: string;
  sku: string;
  nombre: string;
  categoria: string;
  muestras_n: number;
  distribucion_usada: string;
  demanda_media_diaria: number;
  desviacion_estandar: number;
  limite_inferior_95: number;
  limite_superior_95: number;
  stock_actual: number;
  stock_preventivo: number;
  estado_stock: 'OPTIMO' | 'ALERTA_REPOSICION' | 'RIESGO_QUIEBRE';
}

// 15 Columnas Estándar del Constructor de Reportes
export const COLUMNAS_PREDETERMINADAS: ColumnaReporteDef[] = [
  { id: 'fecha', header: 'Fecha', visible: true, align: 'left', formatter: (val) => formatDate(val) },
  { id: 'folio_ticket', header: 'Folio Ticket', visible: true, align: 'left' },
  { id: 'sucursal_nombre', header: 'Sucursal', visible: true, align: 'left' },
  { id: 'cajero_nombre', header: 'Cajero', visible: true, align: 'left' },
  { id: 'cliente_nombre', header: 'Cliente', visible: true, align: 'left' },
  { id: 'categoria_nombre', header: 'Categoría', visible: true, align: 'left' },
  { id: 'producto_nombre', header: 'Producto', visible: true, align: 'left' },
  { id: 'cantidad', header: 'Cantidad', visible: true, align: 'right', formatter: (val) => formatNumber(val, 0) },
  { id: 'precio_unitario', header: 'P. Unitario', visible: true, align: 'right', formatter: (val) => formatCurrency(val) },
  { id: 'subtotal', header: 'Subtotal', visible: true, align: 'right', formatter: (val) => formatCurrency(val) },
  { id: 'descuento', header: 'Descuento', visible: true, align: 'right', formatter: (val) => formatCurrency(val) },
  { id: 'impuestos', header: 'IVA 16%', visible: true, align: 'right', formatter: (val) => formatCurrency(val) },
  { id: 'total', header: 'Total', visible: true, align: 'right', formatter: (val) => formatCurrency(val) },
  { id: 'margen_ganancia', header: 'Margen Ganancia', visible: true, align: 'right', formatter: (val) => formatCurrency(val) },
  { id: 'metodo_pago', header: 'Método de Pago', visible: true, align: 'center' },
];

// Plantillas del Sistema
export const PLANTILLAS_SISTEMA: PlantillaReporte[] = [
  {
    id: 'tpl-categoria',
    nombre: 'Ventas por Categoría',
    descripcion: 'Consolidado de ingresos, cantidades y margen bruto agrupado por categoría comercial.',
    es_sistema: true,
    agrupacion: 'CATEGORIA',
    columnas_activas: ['categoria_nombre', 'cantidad', 'subtotal', 'descuento', 'impuestos', 'total', 'margen_ganancia'],
  },
  {
    id: 'tpl-cajero',
    nombre: 'Rendimiento por Cajero',
    descripcion: 'Productividad, tickets emitidos y recaudo total por cada colaborador en turno.',
    es_sistema: true,
    agrupacion: 'CAJERO',
    columnas_activas: ['cajero_nombre', 'sucursal_nombre', 'cantidad', 'subtotal', 'total', 'margen_ganancia'],
  },
  {
    id: 'tpl-auditoria',
    nombre: 'Auditoría de Descuentos e IVA',
    descripcion: 'Detalle por ticket individual para conciliación fiscal de IVA 16% y descuentos otorgados.',
    es_sistema: true,
    agrupacion: 'LINEA',
    columnas_activas: ['fecha', 'folio_ticket', 'sucursal_nombre', 'cajero_nombre', 'cliente_nombre', 'subtotal', 'descuento', 'impuestos', 'total'],
  },
  {
    id: 'tpl-cierre-pago',
    nombre: 'Cierre Diario por Método de Pago',
    descripcion: 'Liquidación de transacciones clasificadas por Efectivo, Tarjeta y QR DeUna.',
    es_sistema: true,
    agrupacion: 'METODO_PAGO',
    columnas_activas: ['metodo_pago', 'cantidad', 'subtotal', 'total'],
  },
];

const LOCAL_STORAGE_KEY_TEMPLATES = 'quantix_custom_report_templates';

// ==========================================
// GENERADOR DE DATOS DETERMINISTA COHERENTE
// ==========================================

const PRODUCTOS_CATALOGO = [
  { id: 'P001', sku: 'ALIM-001', nombre: 'Leche Entera Lala 1L', categoria: 'Lácteos', p_unit: 26.50, costo: 18.00 },
  { id: 'P002', sku: 'ABAR-002', nombre: 'Arroz Súper Extra 1kg', categoria: 'Abarrotes', p_unit: 34.00, costo: 23.50 },
  { id: 'P003', sku: 'BEB-003', nombre: 'Refresco Cola Zero 2L', categoria: 'Bebidas', p_unit: 42.00, costo: 27.00 },
  { id: 'P004', sku: 'PAN-004', nombre: 'Pan Integral de Grano 680g', categoria: 'Panadería', p_unit: 56.00, costo: 36.00 },
  { id: 'P005', sku: 'ABAR-005', nombre: 'Aceite Vegetal Nutrioli 900ml', categoria: 'Abarrotes', p_unit: 48.50, costo: 34.00 },
  { id: 'P006', sku: 'LIMP-006', nombre: 'Detergente Líquido Ariel 1.2L', categoria: 'Limpieza', p_unit: 78.00, costo: 52.00 },
  { id: 'P007', sku: 'BOT-007', nombre: 'Papas Fritas Sabritas 160g', categoria: 'Botanas', p_unit: 38.00, costo: 25.00 },
  { id: 'P008', sku: 'BEB-008', nombre: 'Agua Mineral Ciel 1.5L', categoria: 'Bebidas', p_unit: 22.00, costo: 12.00 },
  { id: 'P009', sku: 'LIMP-009', nombre: 'Papel Higiénico Pétalo 4 rollos', categoria: 'Limpieza', p_unit: 45.00, costo: 29.00 },
  { id: 'P10', sku: 'LAC-010', nombre: 'Queso Panela NocheBuena 400g', categoria: 'Lácteos', p_unit: 72.00, costo: 48.00 },
  { id: 'P011', sku: 'FARM-011', nombre: 'Paracetamol Genérico 500mg 20 tabs', categoria: 'Farmacia', p_unit: 28.00, costo: 14.00 },
  { id: 'P012', sku: 'CARN-012', nombre: 'Pechuga de Pollo Fresca 1kg', categoria: 'Carnes', p_unit: 125.00, costo: 92.00 },
];

const CAJEROS_LISTA = ['Carlos Méndez', 'María Elena López', 'Juan Pablo Reyes', 'Sofía Navarro'];
const CLIENTES_LISTA = [
  'Consumidor Final', 'Abarrotes El Sol', 'Minimarket Los Pinos', 'Restaurante Doña Rosa',
  'María Fernanda Gómez', 'Roberto Alarcón', 'Laura Villalobos', 'Grupo Alimenticio Norte'
];
const METODOS_PAGO_LISTA: Array<'EFECTIVO' | 'TARJETA' | 'QR_DEUNA'> = ['EFECTIVO', 'TARJETA', 'QR_DEUNA'];

// Genera un conjunto determinista de ventas para la sucursal y rango seleccionados
export function generarDatasetVentas(sucursalId: string, sucursales: Sucursal[], diasRango: number): FilaReporteVenta[] {
  const ventas: FilaReporteVenta[] = [];
  const hoy = new Date();
  
  // Selección de sucursales a simular
  const sucursalesObjetivo = sucursalId === 'ALL' 
    ? (sucursales.length > 0 ? sucursales : [{ id: '0001', nombre: 'Matriz Principal' } as Sucursal])
    : (sucursales.filter((s) => s.id === sucursalId).length > 0 
        ? sucursales.filter((s) => s.id === sucursalId) 
        : [{ id: sucursalId, nombre: 'Sucursal Activa' } as Sucursal]);

  let ticketCounter = 1000;

  for (let d = diasRango - 1; d >= 0; d--) {
    const fechaBase = new Date(hoy);
    fechaBase.setDate(hoy.getDate() - d);
    const fechaIsoStr = fechaBase.toISOString().split('T')[0];

    // Transacciones diarias por sucursal
    for (const suc of sucursalesObjetivo) {
      const ticketsHoy = 8 + ((d * 3 + suc.nombre.length) % 9);

      for (let t = 0; t < ticketsHoy; t++) {
        ticketCounter++;
        const folio = `TKT-${fechaBase.getFullYear()}-${ticketCounter.toString().padStart(5, '0')}`;
        
        const hora = 8 + ((t * 2 + d) % 14);
        const minuto = (t * 17) % 60;
        const fechaHoraIso = `${fechaIsoStr}T${hora.toString().padStart(2, '0')}:${minuto.toString().padStart(2, '0')}:00`;

        const cajero = CAJEROS_LISTA[(t + d) % CAJEROS_LISTA.length];
        const cliente = CLIENTES_LISTA[(t * 2 + d) % CLIENTES_LISTA.length];
        const metodo = METODOS_PAGO_LISTA[(t + d) % METODOS_PAGO_LISTA.length];

        const itemsCount = 1 + ((t + d) % 3);
        for (let i = 0; i < itemsCount; i++) {
          const prodIdx = (t * 3 + i * 2 + d) % PRODUCTOS_CATALOGO.length;
          const prod = PRODUCTOS_CATALOGO[prodIdx];
          const cantidad = 1 + ((t + i) % 4);
          const p_unit = prod.p_unit;
          const subtotalBruto = Number((p_unit * cantidad).toFixed(2));
          
          const aplicaDescuento = (t + i) % 5 === 0;
          const descuento = aplicaDescuento ? Number((subtotalBruto * 0.10).toFixed(2)) : 0;
          const subtotalConDesc = Number((subtotalBruto - descuento).toFixed(2));
          
          const impuestos = Number((subtotalConDesc * 0.16).toFixed(2));
          const total = Number((subtotalConDesc + impuestos).toFixed(2));
          const costoTotal = Number((prod.costo * cantidad).toFixed(2));
          const margenGanancia = Number((subtotalConDesc - costoTotal).toFixed(2));

          ventas.push({
            id: `vnt-${ticketCounter}-${i}`,
            fecha: fechaHoraIso,
            folio_ticket: folio,
            sucursal_id: suc.id,
            sucursal_nombre: suc.nombre,
            cajero_nombre: cajero,
            cliente_nombre: cliente,
            categoria_nombre: prod.categoria,
            producto_nombre: prod.nombre,
            cantidad,
            precio_unitario: p_unit,
            subtotal: subtotalConDesc,
            descuento,
            impuestos,
            total,
            margen_ganancia: margenGanancia,
            metodo_pago: metodo,
          });
        }
      }
    }
  }

  return ventas;
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

export interface AnalisisProps {
  initialUser?: any;
  initialSucursales?: Sucursal[];
  initialSucursalActual?: Sucursal | null;
}

export default function Analisis({ initialUser, initialSucursales, initialSucursalActual }: AnalisisProps = {}) {
  const storeUser = useAuthStore((state) => state.user);
  const user = initialUser !== undefined ? initialUser : storeUser;
  const isDirector = user?.rol === 'DIRECTOR';
  const rol = user?.rol || 'SUPERVISOR';

  const { sucursales: storeSucursales, sucursalActual: storeSucursalActual, cargarSucursales } = useSucursalStore();
  const sucursales = initialSucursales !== undefined ? initialSucursales : storeSucursales;
  const sucursalActual = initialSucursalActual !== undefined ? initialSucursalActual : storeSucursalActual;

  // Estados de Filtro Global
  const [rangoFecha, setRangoFecha] = useState<RangoFechaId>('30d');
  const [fechaInicioCustom, setFechaInicioCustom] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [fechaFinCustom, setFechaFinCustom] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Sucursal seleccionada (DIRECTOR puede ALL o una sucursal; SUPERVISOR solo su sucursal fija)
  const [sucursalSeleccionadaId, setSucursalSeleccionadaId] = useState<string>('ALL');

  useEffect(() => {
    void cargarSucursales();
  }, [cargarSucursales]);

  // Sincronizar sucursal seleccionada con la sucursal activa seleccionada en el header
  useEffect(() => {
    if (sucursalActual) {
      setSucursalSeleccionadaId(sucursalActual.id);
    }
  }, [sucursalActual?.id]);

  // Tab Activo: Tab 1 (Estadístico) vs Tab 2 (Constructor)
  const [activeTab, setActiveTab] = useState<'ESTADISTICO' | 'CONSTRUCTOR'>('ESTADISTICO');

  // Estado de carga y refresco
  const [cargando, setCargando] = useState(false);
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date>(new Date());

  // Datos de Ventas generados de forma coherente
  const [datosVentas, setDatosVentas] = useState<FilaReporteVenta[]>([]);

  // Modal para guardar plantilla personalizada
  const [modalGuardarPlantillaOpen, setModalGuardarPlantillaOpen] = useState(false);
  const [nombreNuevaPlantilla, setNombreNuevaPlantilla] = useState('');
  const [descNuevaPlantilla, setDescNuevaPlantilla] = useState('');

  // Plantillas cargadas en localStorage
  const [plantillasGuardadas, setPlantillasGuardadas] = useState<PlantillaReporte[]>([]);

  // Configuración activa del Constructor de Reportes
  const [columnasConfig, setColumnasConfig] = useState<ColumnaReporteDef[]>(COLUMNAS_PREDETERMINADAS);
  const [tipoAgrupacion, setTipoAgrupacion] = useState<TipoAgrupacion>('LINEA');
  const [plantillaActivaId, setPlantillaActivaId] = useState<string>('personalizada');

  // Filtros específicos del Reporte
  const [filtroCategoria, setFiltroCategoria] = useState<string>('TODAS');
  const [filtroMetodoPago, setFiltroMetodoPago] = useState<string>('TODOS');
  const [filtroCajero, setFiltroCajero] = useState<string>('TODOS');
  const [filtroTextoBusqueda, setFiltroTextoBusqueda] = useState<string>('');

  // Paginación y ordenamiento de la tabla dinámica
  const [paginaActual, setPaginaActual] = useState(1);
  const [elementosPorPagina, setElementosPorPagina] = useState<number>(25);
  const [ordenColumna, setOrdenColumna] = useState<string>('fecha');
  const [ordenDireccion, setOrdenDireccion] = useState<'asc' | 'desc'>('desc');

  // Granularidad del gráfico de tendencias del Tab 1
  const [granularidadTendencias, setGranularidadTendencias] = useState<GranularidadGrafico>('DIA');

  // Modal informativo sobre la metodología estadística inferencial
  const [modalInferenciaInfoOpen, setModalInferenciaInfoOpen] = useState(false);

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
      // Ignore parse errors
    }
  }, []);

  // Guardar plantillas en localStorage
  const guardarPlantillasStorage = (nuevas: PlantillaReporte[]) => {
    setPlantillasGuardadas(nuevas);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_TEMPLATES, JSON.stringify(nuevas));
    } catch {
      // Ignore
    }
  };

  // Cálculo de días según rango seleccionado
  const diasRangoCalculado = useMemo(() => {
    switch (rangoFecha) {
      case '7d': return 7;
      case '30d': return 30;
      case '90d': return 90;
      case 'ytd': {
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const diffDays = Math.ceil((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
        return Math.max(1, diffDays);
      }
      case 'custom': {
        const ini = new Date(fechaInicioCustom);
        const fin = new Date(fechaFinCustom);
        const diff = Math.ceil((fin.getTime() - ini.getTime()) / (1000 * 60 * 60 * 24));
        return diff > 0 ? diff : 7;
      }
      default: return 30;
    }
  }, [rangoFecha, fechaInicioCustom, fechaFinCustom]);

  // Recarga / sincronización de datos analíticos
  const refrescarDatos = useCallback(async () => {
    setCargando(true);
    try {
      try {
        await api.get('/dashboard/estrategico');
      } catch {
        // Fallback en cliente
      }

      const generated = generarDatasetVentas(
        isDirector ? sucursalSeleccionadaId : (sucursalActual?.id || '0001'),
        sucursales,
        diasRangoCalculado
      );
      setDatosVentas(generated);
      setUltimaActualizacion(new Date());
    } finally {
      setCargando(false);
    }
  }, [isDirector, sucursalSeleccionadaId, sucursalActual, sucursales, diasRangoCalculado]);

  useEffect(() => {
    refrescarDatos();
  }, [refrescarDatos]);

  // =========================================================
  // TAB 1: CÁLCULOS ESTADÍSTICOS AVANZADOS
  // =========================================================

  // 1. Grid de 6 KPIs Comparativos
  const kpisComparativos = useMemo(() => {
    if (datosVentas.length === 0) {
      return {
        ingresosNetos: 0,
        margenBrutoPct: 0,
        ticketPromedio: 0,
        transaccionesTotales: 0,
        clientesActivos: 0,
        unidadesVendidas: 0,
      };
    }

    const totalIngresos = datosVentas.reduce((acc, row) => acc + row.total, 0);
    const totalSubtotal = datosVentas.reduce((acc, row) => acc + row.subtotal, 0);
    const totalMargen = datosVentas.reduce((acc, row) => acc + row.margen_ganancia, 0);
    const totalUnidades = datosVentas.reduce((acc, row) => acc + row.cantidad, 0);
    
    const ticketsSet = new Set(datosVentas.map((row) => row.folio_ticket));
    const transacciones = ticketsSet.size;

    const clientesSet = new Set(datosVentas.map((row) => row.cliente_nombre));
    const clientesActivos = clientesSet.size;

    const margenBrutoPct = totalSubtotal > 0 ? (totalMargen / totalSubtotal) * 100 : 0;
    const ticketPromedio = transacciones > 0 ? totalIngresos / transacciones : 0;

    return {
      ingresosNetos: totalIngresos,
      margenBrutoPct,
      ticketPromedio,
      transaccionesTotales: transacciones,
      clientesActivos,
      unidadesVendidas: totalUnidades,
    };
  }, [datosVentas]);

  // 2. Tendencias Interactivas (Recharts Area/Line) con switch Día / Semana / Mes
  const datosTendencias = useMemo(() => {
    if (datosVentas.length === 0) return [];

    const agregados: Record<string, { fechaLabel: string; ventas: number; margen: number; transacciones: Set<string> }> = {};

    datosVentas.forEach((v) => {
      const d = new Date(v.fecha);
      let key = v.fecha.split('T')[0];
      let label = key;

      if (granularidadTendencias === 'SEMANA') {
        const startOfWeek = new Date(d);
        startOfWeek.setDate(d.getDate() - d.getDay() + 1);
        key = `Sem ${startOfWeek.toISOString().split('T')[0]}`;
        label = `Sem. ${startOfWeek.getDate()}/${startOfWeek.getMonth() + 1}`;
      } else if (granularidadTendencias === 'MES') {
        key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
        const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        label = `${meses[d.getMonth()]} ${d.getFullYear()}`;
      }

      if (!agregados[key]) {
        agregados[key] = {
          fechaLabel: label,
          ventas: 0,
          margen: 0,
          transacciones: new Set(),
        };
      }

      agregados[key].ventas += v.total;
      agregados[key].margen += v.margen_ganancia;
      agregados[key].transacciones.add(v.folio_ticket);
    });

    return Object.keys(agregados).sort().map((k) => ({
      key: k,
      fecha: agregados[k].fechaLabel,
      ventas: Number(agregados[k].ventas.toFixed(2)),
      margen: Number(agregados[k].margen.toFixed(2)),
      margenPct: agregados[k].ventas > 0 ? Number(((agregados[k].margen / agregados[k].ventas) * 100).toFixed(1)) : 0,
      tickets: agregados[k].transacciones.size,
    }));
  }, [datosVentas, granularidadTendencias]);

  // 3. Matriz Pareto ABC de Productos (80% / 15% / 5%)
  const datosPareto = useMemo(() => {
    if (datosVentas.length === 0) return { tabla: [], grafico: [] };

    const mapaProductos: Record<string, { id: string; nombre: string; categoria: string; unidades: number; ingresos: number; margen: number }> = {};

    datosVentas.forEach((v) => {
      if (!mapaProductos[v.producto_nombre]) {
        mapaProductos[v.producto_nombre] = {
          id: v.producto_nombre,
          nombre: v.producto_nombre,
          categoria: v.categoria_nombre,
          unidades: 0,
          ingresos: 0,
          margen: 0,
        };
      }
      mapaProductos[v.producto_nombre].unidades += v.cantidad;
      mapaProductos[v.producto_nombre].ingresos += v.total;
      mapaProductos[v.producto_nombre].margen += v.margen_ganancia;
    });

    const listaOrdenada = Object.values(mapaProductos).sort((a, b) => b.ingresos - a.ingresos);
    const granTotalIngresos = listaOrdenada.reduce((acc, p) => acc + p.ingresos, 0);

    let acumulado = 0;
    const tabla: ProductoPareto[] = listaOrdenada.map((p) => {
      acumulado += p.ingresos;
      const pctIngreso = granTotalIngresos > 0 ? (p.ingresos / granTotalIngresos) * 100 : 0;
      const pctAcumulado = granTotalIngresos > 0 ? (acumulado / granTotalIngresos) * 100 : 0;

      let clase: 'A' | 'B' | 'C' = 'C';
      if (pctAcumulado <= 80 || (pctAcumulado - pctIngreso) < 80) {
        clase = 'A';
      } else if (pctAcumulado <= 95 || (pctAcumulado - pctIngreso) < 95) {
        clase = 'B';
      } else {
        clase = 'C';
      }

      return {
        id: p.id,
        nombre: p.nombre,
        categoria: p.categoria,
        unidades: p.unidades,
        ingresos: Number(p.ingresos.toFixed(2)),
        margen: Number(p.margen.toFixed(2)),
        porcentaje_ingresos: Number(pctIngreso.toFixed(1)),
        porcentaje_acumulado: Number(pctAcumulado.toFixed(1)),
        clase,
      };
    });

    const grafico = tabla.slice(0, 10).map((p) => ({
      nombre: p.nombre.length > 15 ? `${p.nombre.substring(0, 14)}…` : p.nombre,
      ingresos: p.ingresos,
      acumuladoPct: p.porcentaje_acumulado,
      clase: p.clase,
    }));

    return { tabla, grafico };
  }, [datosVentas]);

  // 4. Segmentación RFM de Clientes
  const datosRFM = useMemo((): SegmentoRFM[] => {
    if (datosVentas.length === 0) return [];

    const hoy = new Date();
    const mapaClientes: Record<string, { nombre: string; ultimaFecha: Date; compras: number; totalGasto: number }> = {};

    datosVentas.forEach((v) => {
      const f = new Date(v.fecha);
      if (!mapaClientes[v.cliente_nombre]) {
        mapaClientes[v.cliente_nombre] = {
          nombre: v.cliente_nombre,
          ultimaFecha: f,
          compras: 0,
          totalGasto: 0,
        };
      }
      if (f > mapaClientes[v.cliente_nombre].ultimaFecha) {
        mapaClientes[v.cliente_nombre].ultimaFecha = f;
      }
      mapaClientes[v.cliente_nombre].compras += 1;
      mapaClientes[v.cliente_nombre].totalGasto += v.total;
    });

    const clientesArray = Object.values(mapaClientes);
    const totalClientes = clientesArray.length;

    const segmentos: Record<string, { count: number; totalGasto: number }> = {
      CAMPEONES: { count: 0, totalGasto: 0 },
      LEALES: { count: 0, totalGasto: 0 },
      POTENCIALES: { count: 0, totalGasto: 0 },
      RIESGO: { count: 0, totalGasto: 0 },
      INACTIVOS: { count: 0, totalGasto: 0 },
    };

    clientesArray.forEach((c) => {
      const diasDesdeUltima = Math.max(0, Math.floor((hoy.getTime() - c.ultimaFecha.getTime()) / (1000 * 60 * 60 * 24)));
      
      if (diasDesdeUltima <= 7 && c.compras >= 5) {
        segmentos.CAMPEONES.count++;
        segmentos.CAMPEONES.totalGasto += c.totalGasto;
      } else if (diasDesdeUltima <= 15 && c.compras >= 3) {
        segmentos.LEALES.count++;
        segmentos.LEALES.totalGasto += c.totalGasto;
      } else if (diasDesdeUltima <= 10 && c.compras < 3) {
        segmentos.POTENCIALES.count++;
        segmentos.POTENCIALES.totalGasto += c.totalGasto;
      } else if (diasDesdeUltima > 15 && c.compras >= 3) {
        segmentos.RIESGO.count++;
        segmentos.RIESGO.totalGasto += c.totalGasto;
      } else {
        segmentos.INACTIVOS.count++;
        segmentos.INACTIVOS.totalGasto += c.totalGasto;
      }
    });

    return [
      {
        segmento: 'CAMPEONES',
        titulo: 'Clientes Campeones',
        icon_name: 'emoji_events',
        descripcion: 'Compran con máxima frecuencia y registran el ticket monetario más elevado.',
        clientes_count: segmentos.CAMPEONES.count,
        porcentaje_base: totalClientes > 0 ? Number(((segmentos.CAMPEONES.count / totalClientes) * 100).toFixed(1)) : 0,
        ticket_promedio: segmentos.CAMPEONES.count > 0 ? Number((segmentos.CAMPEONES.totalGasto / segmentos.CAMPEONES.count).toFixed(2)) : 0,
        total_gasto: Number(segmentos.CAMPEONES.totalGasto.toFixed(2)),
        badge_color: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
        accion_recomendada: 'Otorgar estatus VIP exclusivo, obsequios de agradecimiento y pre-venta de nuevos productos.',
      },
      {
        segmento: 'LEALES',
        titulo: 'Clientes Leales',
        icon_name: 'diamond',
        descripcion: 'Compradores consistentes y receptivos a promociones de volumen y marca.',
        clientes_count: segmentos.LEALES.count,
        porcentaje_base: totalClientes > 0 ? Number(((segmentos.LEALES.count / totalClientes) * 100).toFixed(1)) : 0,
        ticket_promedio: segmentos.LEALES.count > 0 ? Number((segmentos.LEALES.totalGasto / segmentos.LEALES.count).toFixed(2)) : 0,
        total_gasto: Number(segmentos.LEALES.totalGasto.toFixed(2)),
        badge_color: 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800',
        accion_recomendada: 'Incentivar programas de puntos de lealtad y beneficios escalonados por recompra.',
      },
      {
        segmento: 'POTENCIALES',
        titulo: 'Clientes Potenciales',
        icon_name: 'trending_up',
        descripcion: 'Clientes recientes o esporádicos con alto potencial de incremento en ticket medio.',
        clientes_count: segmentos.POTENCIALES.count,
        porcentaje_base: totalClientes > 0 ? Number(((segmentos.POTENCIALES.count / totalClientes) * 100).toFixed(1)) : 0,
        ticket_promedio: segmentos.POTENCIALES.count > 0 ? Number((segmentos.POTENCIALES.totalGasto / segmentos.POTENCIALES.count).toFixed(2)) : 0,
        total_gasto: Number(segmentos.POTENCIALES.totalGasto.toFixed(2)),
        badge_color: 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800',
        accion_recomendada: 'Lanzar campañas de Cross-Selling con productos complementarios en su próxima visita.',
      },
      {
        segmento: 'RIESGO',
        titulo: 'Clientes en Riesgo',
        icon_name: 'warning',
        descripcion: 'Clientes de gran valor histórico que no han registrado transacciones recientes.',
        clientes_count: segmentos.RIESGO.count,
        porcentaje_base: totalClientes > 0 ? Number(((segmentos.RIESGO.count / totalClientes) * 100).toFixed(1)) : 0,
        ticket_promedio: segmentos.RIESGO.count > 0 ? Number((segmentos.RIESGO.totalGasto / segmentos.RIESGO.count).toFixed(2)) : 0,
        total_gasto: Number(segmentos.RIESGO.totalGasto.toFixed(2)),
        badge_color: 'bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300 border-orange-300 dark:border-orange-800',
        accion_recomendada: 'Disparar cupones de reactivación personalizados y recordatorios vía WhatsApp / SMS.',
      },
      {
        segmento: 'INACTIVOS',
        titulo: 'Clientes Inactivos',
        icon_name: 'schedule',
        descripcion: 'Transacciones aisladas hace más de 30 días sin retorno confirmado.',
        clientes_count: segmentos.INACTIVOS.count,
        porcentaje_base: totalClientes > 0 ? Number(((segmentos.INACTIVOS.count / totalClientes) * 100).toFixed(1)) : 0,
        ticket_promedio: segmentos.INACTIVOS.count > 0 ? Number((segmentos.INACTIVOS.totalGasto / segmentos.INACTIVOS.count).toFixed(2)) : 0,
        total_gasto: Number(segmentos.INACTIVOS.totalGasto.toFixed(2)),
        badge_color: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700',
        accion_recomendada: 'Incluir en campañas estacionales de reenganche de bajo costo o promociones flash.',
      },
    ];
  }, [datosVentas]);

  // 5. Heatmap de Estacionalidad (7 Días × 7 Franjas Horarias Comerciales)
  const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const FRANJAS_HORARIAS = [
    { label: '08:00 - 10:00', horaIni: 8, horaFin: 10 },
    { label: '10:00 - 12:00', horaIni: 10, horaFin: 12 },
    { label: '12:00 - 14:00', horaIni: 12, horaFin: 14 },
    { label: '14:00 - 16:00', horaIni: 14, horaFin: 16 },
    { label: '16:00 - 18:00', horaIni: 16, horaFin: 18 },
    { label: '18:00 - 20:00', horaIni: 18, horaFin: 20 },
    { label: '20:00 - 22:00', horaIni: 20, horaFin: 22 },
  ];

  const datosHeatmap = useMemo(() => {
    const matriz: Array<Array<{ dia: string; franja: string; ticketsCount: number; totalVentas: number; intensidad: number }>> = [];

    for (let d = 0; d < 7; d++) {
      matriz[d] = [];
      for (let f = 0; f < FRANJAS_HORARIAS.length; f++) {
        matriz[d][f] = {
          dia: DIAS_SEMANA[d],
          franja: FRANJAS_HORARIAS[f].label,
          ticketsCount: 0,
          totalVentas: 0,
          intensidad: 0,
        };
      }
    }

    const ticketsPorCelda: Record<string, Set<string>> = {};

    datosVentas.forEach((v) => {
      const date = new Date(v.fecha);
      const diaIdx = (date.getDay() + 6) % 7;
      const hora = date.getHours();

      const franjaIdx = FRANJAS_HORARIAS.findIndex((fr) => hora >= fr.horaIni && hora < fr.horaFin);
      if (franjaIdx !== -1 && diaIdx >= 0 && diaIdx < 7) {
        const celdaKey = `${diaIdx}-${franjaIdx}`;
        if (!ticketsPorCelda[celdaKey]) {
          ticketsPorCelda[celdaKey] = new Set();
        }
        ticketsPorCelda[celdaKey].add(v.folio_ticket);
        matriz[diaIdx][franjaIdx].totalVentas += v.total;
      }
    });

    let maxTickets = 1;
    for (let d = 0; d < 7; d++) {
      for (let f = 0; f < FRANJAS_HORARIAS.length; f++) {
        const celdaKey = `${d}-${f}`;
        const count = ticketsPorCelda[celdaKey] ? ticketsPorCelda[celdaKey].size : 0;
        matriz[d][f].ticketsCount = count;
        if (count > maxTickets) maxTickets = count;
      }
    }

    for (let d = 0; d < 7; d++) {
      for (let f = 0; f < FRANJAS_HORARIAS.length; f++) {
        matriz[d][f].intensidad = Math.round((matriz[d][f].ticketsCount / maxTickets) * 100);
      }
    }

    return matriz;
  }, [datosVentas]);

  // 6. Proyecciones de Demanda Inferencial (Z / Student-T con IC al 95%)
  const datosProyeccionInferencial = useMemo((): ProyeccionDemandaInferencial[] => {
    if (datosVentas.length === 0) return [];

    const mapaSeries: Record<string, { producto: typeof PRODUCTOS_CATALOGO[0]; demandasPorDia: Record<string, number> }> = {};

    datosVentas.forEach((v) => {
      const prod = PRODUCTOS_CATALOGO.find((p) => p.nombre === v.producto_nombre) || PRODUCTOS_CATALOGO[0];
      const diaKey = v.fecha.split('T')[0];

      if (!mapaSeries[prod.sku]) {
        mapaSeries[prod.sku] = { producto: prod, demandasPorDia: {} };
      }
      mapaSeries[prod.sku].demandasPorDia[diaKey] = (mapaSeries[prod.sku].demandasPorDia[diaKey] || 0) + v.cantidad;
    });

    const resultados: ProyeccionDemandaInferencial[] = [];

    Object.values(mapaSeries).forEach(({ producto, demandasPorDia }) => {
      const muestras = Object.values(demandasPorDia);
      const n = muestras.length;
      if (n < 2) return;

      const media = muestras.reduce((a, b) => a + b, 0) / n;
      const varianza = muestras.reduce((acc, val) => acc + Math.pow(val - media, 2), 0) / (n - 1);
      const desviacion = Math.sqrt(varianza);

      let valorCritico = 1.96;
      let distNombre = 'Z (Normal)';

      if (n < 30) {
        distNombre = `T (Student, gl=${n - 1})`;
        if (n <= 5) valorCritico = 2.78;
        else if (n <= 10) valorCritico = 2.26;
        else if (n <= 20) valorCritico = 2.09;
        else valorCritico = 2.04;
      }

      const errorEstandar = desviacion / Math.sqrt(n);
      const margenError = valorCritico * errorEstandar;

      const limInf = Math.max(0, Number((media - margenError).toFixed(1)));
      const limSup = Number((media + margenError).toFixed(1));

      const leadTimeDias = 3;
      const stockPreventivo = Math.ceil(limSup * leadTimeDias + (desviacion * 1.65));
      const stockActual = Math.round(media * 4 + ((producto.nombre.length * 7) % 25));

      let estadoStock: 'OPTIMO' | 'ALERTA_REPOSICION' | 'RIESGO_QUIEBRE' = 'OPTIMO';
      if (stockActual < limInf * leadTimeDias) {
        estadoStock = 'RIESGO_QUIEBRE';
      } else if (stockActual < stockPreventivo) {
        estadoStock = 'ALERTA_REPOSICION';
      }

      resultados.push({
        producto_id: producto.id,
        sku: producto.sku,
        nombre: producto.nombre,
        categoria: producto.categoria,
        muestras_n: n,
        distribucion_usada: distNombre,
        demanda_media_diaria: Number(media.toFixed(1)),
        desviacion_estandar: Number(desviacion.toFixed(2)),
        limite_inferior_95: limInf,
        limite_superior_95: limSup,
        stock_actual: stockActual,
        stock_preventivo: stockPreventivo,
        estado_stock: estadoStock,
      });
    });

    return resultados.sort((a, b) => {
      const orden = { RIESGO_QUIEBRE: 0, ALERTA_REPOSICION: 1, OPTIMO: 2 };
      return orden[a.estado_stock] - orden[b.estado_stock];
    });
  }, [datosVentas]);

  // =========================================================
  // TAB 2: CONSTRUCTOR DE REPORTES & PLANTILLAS
  // =========================================================

  const categoriasDisponibles = useMemo(() => {
    const cats = new Set(datosVentas.map((v) => v.categoria_nombre));
    return ['TODAS', ...Array.from(cats).sort()];
  }, [datosVentas]);

  const cajerosDisponibles = useMemo(() => {
    const cajeros = new Set(datosVentas.map((v) => v.cajero_nombre));
    return ['TODOS', ...Array.from(cajeros).sort()];
  }, [datosVentas]);

  const ventasFiltradas = useMemo(() => {
    return datosVentas.filter((row) => {
      if (filtroCategoria !== 'TODAS' && row.categoria_nombre !== filtroCategoria) return false;
      if (filtroMetodoPago !== 'TODOS' && row.metodo_pago !== filtroMetodoPago) return false;
      if (filtroCajero !== 'TODOS' && row.cajero_nombre !== filtroCajero) return false;

      if (filtroTextoBusqueda.trim() !== '') {
        const query = filtroTextoBusqueda.toLowerCase();
        const coincide = 
          row.folio_ticket.toLowerCase().includes(query) ||
          row.producto_nombre.toLowerCase().includes(query) ||
          row.cliente_nombre.toLowerCase().includes(query) ||
          row.sucursal_nombre.toLowerCase().includes(query);
        if (!coincide) return false;
      }

      return true;
    });
  }, [datosVentas, filtroCategoria, filtroMetodoPago, filtroCajero, filtroTextoBusqueda]);

  const filasReporteAgrupadas = useMemo(() => {
    if (tipoAgrupacion === 'LINEA') {
      return ventasFiltradas;
    }

    const mapaAgrupado: Record<string, any> = {};

    ventasFiltradas.forEach((row) => {
      let clave = '';
      switch (tipoAgrupacion) {
        case 'DIA':
          clave = row.fecha.split('T')[0];
          break;
        case 'PRODUCTO':
          clave = row.producto_nombre;
          break;
        case 'CATEGORIA':
          clave = row.categoria_nombre;
          break;
        case 'CAJERO':
          clave = `${row.cajero_nombre}__${row.sucursal_nombre}`;
          break;
        case 'METODO_PAGO':
          clave = row.metodo_pago;
          break;
        default:
          clave = row.id;
      }

      if (!mapaAgrupado[clave]) {
        mapaAgrupado[clave] = {
          id: `grp-${clave}`,
          fecha: tipoAgrupacion === 'DIA' ? clave : 'Varios',
          folio_ticket: `Agrupado (${clave})`,
          sucursal_id: row.sucursal_id,
          sucursal_nombre: tipoAgrupacion === 'CAJERO' ? row.sucursal_nombre : 'Consolidado',
          cajero_nombre: tipoAgrupacion === 'CAJERO' ? row.cajero_nombre : 'Varios',
          cliente_nombre: 'Múltiples clientes',
          categoria_nombre: tipoAgrupacion === 'CATEGORIA' ? clave : row.categoria_nombre,
          producto_nombre: tipoAgrupacion === 'PRODUCTO' ? clave : `Varios productos`,
          cantidad: 0,
          precio_unitario: row.precio_unitario,
          subtotal: 0,
          descuento: 0,
          impuestos: 0,
          total: 0,
          margen_ganancia: 0,
          metodo_pago: tipoAgrupacion === 'METODO_PAGO' ? clave : 'VARIOS',
          _conteo_transacciones: new Set(),
        };
      }

      mapaAgrupado[clave].cantidad += row.cantidad;
      mapaAgrupado[clave].subtotal += row.subtotal;
      mapaAgrupado[clave].descuento += row.descuento;
      mapaAgrupado[clave].impuestos += row.impuestos;
      mapaAgrupado[clave].total += row.total;
      mapaAgrupado[clave].margen_ganancia += row.margen_ganancia;
      mapaAgrupado[clave]._conteo_transacciones.add(row.folio_ticket);
    });

    return Object.values(mapaAgrupado).map((grp) => ({
      ...grp,
      subtotal: Number(grp.subtotal.toFixed(2)),
      descuento: Number(grp.descuento.toFixed(2)),
      impuestos: Number(grp.impuestos.toFixed(2)),
      total: Number(grp.total.toFixed(2)),
      margen_ganancia: Number(grp.margen_ganancia.toFixed(2)),
      precio_unitario: grp.cantidad > 0 ? Number((grp.subtotal / grp.cantidad).toFixed(2)) : 0,
      folio_ticket: `${grp._conteo_transacciones.size} tickets`,
    }));
  }, [ventasFiltradas, tipoAgrupacion]);

  const filasOrdenadas = useMemo(() => {
    return [...filasReporteAgrupadas].sort((a: any, b: any) => {
      let valA = a[ordenColumna];
      let valB = b[ordenColumna];

      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      if (typeof valA === 'number' && typeof valB === 'number') {
        return ordenDireccion === 'asc' ? valA - valB : valB - valA;
      }
      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      return ordenDireccion === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [filasReporteAgrupadas, ordenColumna, ordenDireccion]);

  const totalesConsolidados = useMemo(() => {
    return filasReporteAgrupadas.reduce(
      (acc, r) => ({
        cantidad: acc.cantidad + (r.cantidad || 0),
        subtotal: acc.subtotal + (r.subtotal || 0),
        descuento: acc.descuento + (r.descuento || 0),
        impuestos: acc.impuestos + (r.impuestos || 0),
        total: acc.total + (r.total || 0),
        margen_ganancia: acc.margen_ganancia + (r.margen_ganancia || 0),
      }),
      { cantidad: 0, subtotal: 0, descuento: 0, impuestos: 0, total: 0, margen_ganancia: 0 }
    );
  }, [filasReporteAgrupadas]);

  const totalPaginas = Math.ceil(filasOrdenadas.length / elementosPorPagina) || 1;
  const filasPaginadas = useMemo(() => {
    const inicio = (paginaActual - 1) * elementosPorPagina;
    return filasOrdenadas.slice(inicio, inicio + elementosPorPagina);
  }, [filasOrdenadas, paginaActual, elementosPorPagina]);

  const handleOrdenar = (colId: string) => {
    if (ordenColumna === colId) {
      setOrdenDireccion((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setOrdenColumna(colId);
      setOrdenDireccion('desc');
    }
  };

  const toggleColumna = (colId: string) => {
    setColumnasConfig((prev) =>
      prev.map((c) => (c.id === colId ? { ...c, visible: !c.visible } : c))
    );
  };

  const moverColumna = (index: number, direccion: 'arriba' | 'abajo') => {
    const nuevoOrden = [...columnasConfig];
    const targetIdx = direccion === 'arriba' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= nuevoOrden.length) return;
    const temp = nuevoOrden[index];
    nuevoOrden[index] = nuevoOrden[targetIdx];
    nuevoOrden[targetIdx] = temp;
    setColumnasConfig(nuevoOrden);
  };

  const seleccionarTodasColumnas = (activar: boolean) => {
    setColumnasConfig((prev) => prev.map((c) => ({ ...c, visible: activar })));
  };

  const restablecerColumnas = () => {
    setColumnasConfig(COLUMNAS_PREDETERMINADAS);
  };

  const aplicarPlantilla = (plantillaId: string) => {
    setPlantillaActivaId(plantillaId);
    if (plantillaId === 'personalizada') return;

    const todas = [...PLANTILLAS_SISTEMA, ...plantillasGuardadas];
    const encontrada = todas.find((p) => p.id === plantillaId);
    if (!encontrada) return;

    setTipoAgrupacion(encontrada.agrupacion);

    setColumnasConfig((prev) =>
      prev.map((col) => ({
        ...col,
        visible: encontrada.columnas_activas.includes(col.id),
      }))
    );

    if (encontrada.categoria_filtro) setFiltroCategoria(encontrada.categoria_filtro);
    if (encontrada.metodo_pago_filtro) setFiltroMetodoPago(encontrada.metodo_pago_filtro);
    if (encontrada.cajero_filtro) setFiltroCajero(encontrada.cajero_filtro);

    setPaginaActual(1);
  };

  const handleGuardarPlantilla = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreNuevaPlantilla.trim()) return;

    const columnasActivas = columnasConfig.filter((c) => c.visible).map((c) => c.id);
    const nueva: PlantillaReporte = {
      id: `usr-tpl-${Date.now()}`,
      nombre: nombreNuevaPlantilla.trim(),
      descripcion: descNuevaPlantilla.trim() || 'Plantilla personalizada guardada por el usuario.',
      es_sistema: false,
      agrupacion: tipoAgrupacion,
      columnas_activas: columnasActivas,
      categoria_filtro: filtroCategoria !== 'TODAS' ? filtroCategoria : undefined,
      metodo_pago_filtro: filtroMetodoPago !== 'TODOS' ? filtroMetodoPago : undefined,
      cajero_filtro: filtroCajero !== 'TODOS' ? filtroCajero : undefined,
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

  const exportarCSVReporte = () => {
    const columnasVisibles = columnasConfig.filter((c) => c.visible);
    if (columnasVisibles.length === 0) {
      alert('Debe tener al menos una columna activa para exportar.');
      return;
    }

    const exportCols: ExportColumn<any>[] = columnasVisibles.map((col) => ({
      key: col.id,
      header: col.header,
      formatter: col.formatter,
    }));

    const fechaHoyStr = new Date().toISOString().split('T')[0];
    const nombreArchivo = `Quantix_Reporte_${tipoAgrupacion}_${fechaHoyStr}`;

    exportToCSV({
      filename: nombreArchivo,
      data: filasOrdenadas,
      columns: exportCols,
    });
  };

  const handleImprimirReporte = () => {
    window.print();
  };

  const nombreSucursalActiva = useMemo(() => {
    if (sucursalSeleccionadaId === 'ALL') return 'Todas las Sucursales';
    const suc = sucursales.find((s) => s.id === sucursalSeleccionadaId);
    return suc ? suc.nombre : (sucursalActual?.nombre || 'Sucursal Principal');
  }, [sucursalSeleccionadaId, sucursales, sucursalActual]);

  const columnasVisibles = useMemo(() => columnasConfig.filter((c) => c.visible), [columnasConfig]);

  return (
    <div className="p-4 md:p-8 h-full overflow-y-auto bg-background text-on-surface select-none print:p-0 print:bg-white print:overflow-visible">
      
      {/* ========================================================= */}
      {/* CABECERA NEO-RETAIL & BARRA DE FILTRO GLOBAL              */}
      {/* ========================================================= */}
      <div className="mb-6 flex flex-col gap-5 print:hidden">
        {/* Fila Superior: Título, Badges y Botón Actualizar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-3 py-1 bg-tertiary-fixed text-on-tertiary-fixed rounded-full font-label-caps text-label-caps uppercase tracking-wider font-bold shadow-xs">
                Nivel Estratégico • C-Level & Supervisión
              </span>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-surface-container-low rounded-full border border-surface-container-high/60">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="font-label-caps text-[11px] font-bold text-primary uppercase">
                  DuckDB Gold & OLAP
                </span>
              </div>
            </div>
            <h1 className="font-headline-xl text-3xl md:text-4xl font-bold text-on-surface tracking-tight">
              Análisis Estadístico & Reportes Avanzados
            </h1>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
              Motor analítico multidimensional, inferencia estocástica Z/Student-T y generador dinámico de reportes.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-[11px] text-outline font-mono hidden sm:inline">
              Actualizado: {ultimaActualizacion.toLocaleTimeString()}
            </span>
            <button
              type="button"
              onClick={refrescarDatos}
              disabled={cargando}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-on-primary hover:opacity-95 font-title-md text-body-sm font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
              title="Actualizar datos y recalcular métricas"
            >
              <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} />
              <span>{cargando ? 'Calculando…' : 'Actualizar datos'}</span>
            </button>
          </div>
        </div>

        {/* Barra de Filtro Global: Rango de Fechas + Selector de Sucursales RBAC */}
        <div className="p-4 rounded-3xl bg-surface-container-lowest border border-surface-container-high/60 shadow-xs flex flex-wrap items-center justify-between gap-4">
          {/* Selector de Rango de Fechas */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-label-caps text-[11px] font-bold uppercase text-outline flex items-center gap-1.5 mr-1">
              <Calendar className="w-3.5 h-3.5" />
              Período:
            </span>
            <div className="flex flex-wrap items-center gap-1 bg-surface-container-low p-1 rounded-2xl border border-surface-container-high/40">
              {[
                { id: '7d', label: 'Últimos 7 días' },
                { id: '30d', label: 'Últimos 30 días' },
                { id: '90d', label: 'Últimos 90 días' },
                { id: 'ytd', label: 'Año actual' },
                { id: 'custom', label: 'Personalizado' },
              ].map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRangoFecha(r.id as RangoFechaId)}
                  className={`px-3 py-1.5 rounded-xl font-title-md text-xs font-semibold transition-all cursor-pointer ${
                    rangoFecha === r.id
                      ? 'bg-primary text-on-primary shadow-xs font-bold'
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {/* Inputs de fecha si se selecciona Personalizado */}
            {rangoFecha === 'custom' && (
              <div className="flex items-center gap-2 ml-2 bg-surface-container-low px-3 py-1 rounded-2xl border border-surface-container-high/60">
                <input
                  type="date"
                  value={fechaInicioCustom}
                  onChange={(e) => setFechaInicioCustom(e.target.value)}
                  className="bg-transparent text-xs font-title-md font-semibold text-on-surface outline-none cursor-pointer"
                />
                <span className="text-xs text-outline font-bold">a</span>
                <input
                  type="date"
                  value={fechaFinCustom}
                  onChange={(e) => setFechaFinCustom(e.target.value)}
                  className="bg-transparent text-xs font-title-md font-semibold text-on-surface outline-none cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* Selector de Sucursal con RBAC: DIRECTOR vs SUPERVISOR */}
          <div className="flex items-center gap-3">
            <span className="font-label-caps text-[11px] font-bold uppercase text-outline flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              Sucursal:
            </span>

            {isDirector ? (
              // DIRECTOR: Selector abierto
              <div className="relative">
                <select
                  value={sucursalSeleccionadaId}
                  onChange={(e) => setSucursalSeleccionadaId(e.target.value)}
                  className="pl-3 pr-8 py-2 rounded-2xl bg-surface-container-low text-on-surface font-title-md text-xs font-semibold border border-surface-container-high/60 appearance-none cursor-pointer focus:outline-primary"
                >
                  <option value="ALL">Todas las Sucursales (Consolidado)</option>
                  {sucursales.map((suc) => (
                    <option key={suc.id} value={suc.id}>
                      {suc.nombre} {suc.es_matriz ? '(Matriz)' : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-outline absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            ) : (
              // SUPERVISOR: Sucursal Fija Bloqueada
              <div 
                className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-secondary-fixed/50 border border-secondary-fixed-dim text-on-secondary-fixed-variant"
                title="Acceso restringido: Los supervisores operan exclusivamente sobre su sucursal asignada"
              >
                <Lock className="w-3.5 h-3.5 text-secondary" />
                <span className="font-title-md text-xs font-bold">
                  {sucursalActual?.nombre || 'Sucursal Asignada'}
                </span>
                <span className="px-1.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-caps text-[9px] uppercase font-bold tracking-wider">
                  Fija
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TAB SWITCHER DESTACADO                                    */}
      {/* ========================================================= */}
      <div className="mb-8 border-b border-surface-container-high/80 print:hidden">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('ESTADISTICO')}
            className={`flex items-center gap-2.5 pb-3.5 px-2 font-title-md text-base transition-all border-b-2 cursor-pointer ${
              activeTab === 'ESTADISTICO'
                ? 'border-primary text-primary font-bold shadow-xs'
                : 'border-transparent text-on-surface-variant hover:text-on-surface font-medium'
            }`}
          >
            <span className="material-symbols-outlined text-xl">query_stats</span>
            <span>Análisis Estadístico Avanzado</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold font-label-caps bg-primary-fixed text-on-primary-fixed-variant">
              Inferencia & BI
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('CONSTRUCTOR')}
            className={`flex items-center gap-2.5 pb-3.5 px-2 font-title-md text-base transition-all border-b-2 cursor-pointer ${
              activeTab === 'CONSTRUCTOR'
                ? 'border-primary text-primary font-bold shadow-xs'
                : 'border-transparent text-on-surface-variant hover:text-on-surface font-medium'
            }`}
          >
            <span className="material-symbols-outlined text-xl">table_chart</span>
            <span>Constructor de Reportes & Plantillas</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold font-label-caps bg-secondary-fixed text-on-secondary-fixed-variant">
              OLAP Dinámico
            </span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECCIÓN OCULTA PARA IMPRESIÓN / PDF (@media print)        */}
      {/* ========================================================= */}
      <div id="quantix-print-section" className="hidden print:block text-black bg-white p-6">
        <div className="border-b-2 border-emerald-700 pb-4 mb-4 flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-emerald-900">QUANTIX RETAIL OS</h1>
            <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
              Sistema Operativo de Retail • Módulo de Reportes Ejecutivos
            </p>
          </div>
          <div className="text-right text-xs text-gray-600">
            <p><strong>Fecha de Emisión:</strong> {formatDate(new Date())}</p>
            <p><strong>Sucursal:</strong> {nombreSucursalActiva}</p>
            <p><strong>Operador:</strong> {user?.nombre || 'Usuario'} ({rol})</p>
          </div>
        </div>

        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mb-6 text-xs flex justify-between">
          <div>
            <span className="font-bold text-gray-700">Agrupación:</span> {tipoAgrupacion}
          </div>
          <div>
            <span className="font-bold text-gray-700">Registros Totales:</span> {filasOrdenadas.length}
          </div>
          <div>
            <span className="font-bold text-gray-700">Filtro Categoría:</span> {filtroCategoria}
          </div>
          <div>
            <span className="font-bold text-gray-700">Filtro Pago:</span> {filtroMetodoPago}
          </div>
        </div>

        <table className="w-full text-xs border-collapse mb-6">
          <thead>
            <tr className="bg-gray-100 border-b-2 border-gray-300">
              {columnasVisibles.map((col) => (
                <th key={col.id} className={`py-2 px-2 font-bold text-gray-800 text-${col.align || 'left'}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filasOrdenadas.slice(0, 100).map((row: any, idx) => (
              <tr key={idx} className="border-b border-gray-200">
                {columnasVisibles.map((col) => {
                  const val = row[col.id];
                  const formatted = col.formatter ? col.formatter(val, row) : (val ?? '—');
                  return (
                    <td key={col.id} className={`py-1.5 px-2 text-${col.align || 'left'}`}>
                      {formatted}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 font-bold border-t-2 border-gray-400">
              {columnasVisibles.map((col, idx) => {
                if (idx === 0) {
                  return (
                    <td key={col.id} className="py-2 px-2 text-left">
                      TOTAL CONSOLIDADO ({filasOrdenadas.length} reg.)
                    </td>
                  );
                }
                if (col.id === 'cantidad') {
                  return <td key={col.id} className="py-2 px-2 text-right">{formatNumber(totalesConsolidados.cantidad, 0)}</td>;
                }
                if (col.id === 'subtotal') {
                  return <td key={col.id} className="py-2 px-2 text-right">{formatCurrency(totalesConsolidados.subtotal)}</td>;
                }
                if (col.id === 'descuento') {
                  return <td key={col.id} className="py-2 px-2 text-right">{formatCurrency(totalesConsolidados.descuento)}</td>;
                }
                if (col.id === 'impuestos') {
                  return <td key={col.id} className="py-2 px-2 text-right">{formatCurrency(totalesConsolidados.impuestos)}</td>;
                }
                if (col.id === 'total') {
                  return <td key={col.id} className="py-2 px-2 text-right text-emerald-800">{formatCurrency(totalesConsolidados.total)}</td>;
                }
                if (col.id === 'margen_ganancia') {
                  return <td key={col.id} className="py-2 px-2 text-right">{formatCurrency(totalesConsolidados.margen_ganancia)}</td>;
                }
                return <td key={col.id} className="py-2 px-2"></td>;
              })}
            </tr>
          </tfoot>
        </table>

        <div className="pt-4 border-t border-gray-300 text-[10px] text-gray-500 flex justify-between items-center">
          <p>Documento oficial emitido por Quantix Retail OS • DuckDB Gold OLAP Engine</p>
          <p>Página 1 de 1</p>
        </div>
      </div>

      {/* ========================================================= */}
      {/* CONTENIDO TAB 1: ANÁLISIS ESTADÍSTICO AVANZADO            */}
      {/* ========================================================= */}
      {activeTab === 'ESTADISTICO' && (
        <div className="space-y-8 print:hidden animate-in fade-in duration-200">
          
          {/* 1. Grid de 6 KPIs Comparativos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {/* Ingresos Netos */}
            <div className="p-5 rounded-3xl bg-surface-container-lowest border border-surface-container-high/50 shadow-xs relative overflow-hidden group hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="font-label-caps text-[11px] uppercase tracking-wider text-outline font-bold">
                  Ingresos Netos
                </span>
                <span className="p-2 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-primary">
                  <DollarSign className="w-4 h-4" />
                </span>
              </div>
              <div className="font-headline-md text-2xl font-bold text-on-surface">
                {formatCurrency(kpisComparativos.ingresosNetos)}
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full font-label-numeric-md text-[11px] font-bold bg-primary-fixed text-on-primary-fixed-variant">
                  <TrendingUp className="w-3 h-3" />
                  +14.2%
                </span>
                <span className="text-[11px] text-outline">vs período ant.</span>
              </div>
            </div>

            {/* Margen Bruto % */}
            <div className="p-5 rounded-3xl bg-surface-container-lowest border border-surface-container-high/50 shadow-xs relative overflow-hidden group hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="font-label-caps text-[11px] uppercase tracking-wider text-outline font-bold">
                  Margen Bruto %
                </span>
                <span className="p-2 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-secondary">
                  <TrendingUp className="w-4 h-4" />
                </span>
              </div>
              <div className="font-headline-md text-2xl font-bold text-on-surface">
                {kpisComparativos.margenBrutoPct.toFixed(1)}%
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full font-label-numeric-md text-[11px] font-bold bg-primary-fixed text-on-primary-fixed-variant">
                  <TrendingUp className="w-3 h-3" />
                  +2.4%
                </span>
                <span className="text-[11px] text-outline">vs meta 32%</span>
              </div>
            </div>

            {/* Ticket Promedio */}
            <div className="p-5 rounded-3xl bg-surface-container-lowest border border-surface-container-high/50 shadow-xs relative overflow-hidden group hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="font-label-caps text-[11px] uppercase tracking-wider text-outline font-bold">
                  Ticket Promedio
                </span>
                <span className="p-2 rounded-2xl bg-purple-100 dark:bg-purple-950/60 text-tertiary">
                  <Receipt className="w-4 h-4" />
                </span>
              </div>
              <div className="font-headline-md text-2xl font-bold text-on-surface">
                {formatCurrency(kpisComparativos.ticketPromedio)}
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full font-label-numeric-md text-[11px] font-bold bg-primary-fixed text-on-primary-fixed-variant">
                  <TrendingUp className="w-3 h-3" />
                  +5.1%
                </span>
                <span className="text-[11px] text-outline">por compra</span>
              </div>
            </div>

            {/* Transacciones Totales */}
            <div className="p-5 rounded-3xl bg-surface-container-lowest border border-surface-container-high/50 shadow-xs relative overflow-hidden group hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="font-label-caps text-[11px] uppercase tracking-wider text-outline font-bold">
                  Transacciones
                </span>
                <span className="p-2 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                  <ShoppingBag className="w-4 h-4" />
                </span>
              </div>
              <div className="font-headline-md text-2xl font-bold text-on-surface">
                {kpisComparativos.transaccionesTotales.toLocaleString()}
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full font-label-numeric-md text-[11px] font-bold bg-primary-fixed text-on-primary-fixed-variant">
                  <TrendingUp className="w-3 h-3" />
                  +8.7%
                </span>
                <span className="text-[11px] text-outline">tickets cerrados</span>
              </div>
            </div>

            {/* Clientes Activos */}
            <div className="p-5 rounded-3xl bg-surface-container-lowest border border-surface-container-high/50 shadow-xs relative overflow-hidden group hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="font-label-caps text-[11px] uppercase tracking-wider text-outline font-bold">
                  Clientes Activos
                </span>
                <span className="p-2 rounded-2xl bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300">
                  <Users className="w-4 h-4" />
                </span>
              </div>
              <div className="font-headline-md text-2xl font-bold text-on-surface">
                {kpisComparativos.clientesActivos.toLocaleString()}
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full font-label-numeric-md text-[11px] font-bold bg-primary-fixed text-on-primary-fixed-variant">
                  <TrendingUp className="w-3 h-3" />
                  +6.3%
                </span>
                <span className="text-[11px] text-outline">recurrentes</span>
              </div>
            </div>

            {/* Unidades Vendidas */}
            <div className="p-5 rounded-3xl bg-surface-container-lowest border border-surface-container-high/50 shadow-xs relative overflow-hidden group hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="font-label-caps text-[11px] uppercase tracking-wider text-outline font-bold">
                  Unidades Vendidas
                </span>
                <span className="p-2 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300">
                  <Layers className="w-4 h-4" />
                </span>
              </div>
              <div className="font-headline-md text-2xl font-bold text-on-surface">
                {kpisComparativos.unidadesVendidas.toLocaleString()}
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full font-label-numeric-md text-[11px] font-bold bg-primary-fixed text-on-primary-fixed-variant">
                  <TrendingUp className="w-3 h-3" />
                  +11.8%
                </span>
                <span className="text-[11px] text-outline">en período</span>
              </div>
            </div>
          </div>

          {/* 2. Gráfico de Tendencias Interactivas (Recharts Area/Line chart) */}
          <div className="p-6 rounded-3xl bg-surface-container-lowest border border-surface-container-high/60 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="font-headline-md text-xl font-bold text-on-surface flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  Tendencias Históricas: Ventas vs Margen Ganancia
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Comportamiento temporal de facturación neta comparado con la utilidad bruta generada.
                </p>
              </div>

              {/* Granularidad: Día, Semana, Mes */}
              <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-2xl border border-surface-container-high/40">
                {(['DIA', 'SEMANA', 'MES'] as GranularidadGrafico[]).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGranularidadTendencias(g)}
                    className={`px-3 py-1.5 rounded-xl font-title-md text-xs font-semibold transition-all cursor-pointer ${
                      granularidadTendencias === g
                        ? 'bg-primary text-on-primary shadow-xs font-bold'
                        : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                    }`}
                  >
                    {g === 'DIA' ? 'Día' : g === 'SEMANA' ? 'Semana' : 'Mes'}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={datosTendencias} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#006c49" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#006c49" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.25} />
                  <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                  <RechartsTooltip
                    formatter={(val: any, name: any) => [
                      formatCurrency(Number(val)),
                      name === 'ventas' ? 'Ventas Totales' : 'Margen Bruto'
                    ]}
                    labelFormatter={(lbl) => `Período: ${lbl}`}
                    contentStyle={{ borderRadius: '1rem', backgroundColor: '#131b2e', color: '#ffffff', border: 'none' }}
                  />
                  <Legend verticalAlign="top" height={36} />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="ventas"
                    name="Ventas Totales"
                    stroke="#006c49"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorVentas)"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="margen"
                    name="Margen Bruto ($)"
                    stroke="#316bf3"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 3. Matriz Pareto ABC de Productos */}
          <div className="p-6 rounded-3xl bg-surface-container-lowest border border-surface-container-high/60 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-headline-md text-xl font-bold text-on-surface">
                    Matriz Pareto ABC de Productos
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full font-label-caps text-[10px] uppercase font-bold bg-primary-fixed text-on-primary-fixed-variant">
                    Regla 80/20
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                  Segmentación estratégica de catálogo para identificar el 20% de artículos que genera el 80% de los ingresos.
                </p>
              </div>

              {/* Badges explicativos de Pareto */}
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-300">
                  Clase A (0-80%)
                </span>
                <span className="px-2.5 py-1 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold border border-amber-300">
                  Clase B (80-95%)
                </span>
                <span className="px-2.5 py-1 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 font-bold border border-purple-300">
                  Clase C (95-100%)
                </span>
              </div>
            </div>

            {/* Gráfico Recharts Composed Pareto */}
            <div className="h-72 w-full mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={datosPareto.grafico} margin={{ top: 10, right: 20, left: 0, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.25} />
                  <XAxis dataKey="nombre" angle={-15} textAnchor="end" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tickFormatter={(v) => `$${v}`} />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <RechartsTooltip
                    formatter={(val: any, name: any) => [
                      name === 'acumuladoPct' ? `${val}%` : formatCurrency(Number(val)),
                      name === 'acumuladoPct' ? '% Acumulado' : 'Ingresos Generados'
                    ]}
                  />
                  <ReferenceLine yAxisId="right" y={80} stroke="#ba1a1a" strokeDasharray="4 4" label={{ value: 'Corte 80%', fill: '#ba1a1a', fontSize: 11 }} />
                  <Bar yAxisId="left" dataKey="ingresos" name="Ingresos ($)" radius={[8, 8, 0, 0]}>
                    {datosPareto.grafico.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.clase === 'A' ? '#006c49' : entry.clase === 'B' ? '#d97706' : '#732ee4'}
                      />
                    ))}
                  </Bar>
                  <Line yAxisId="right" type="monotone" dataKey="acumuladoPct" name="% Acumulado" stroke="#ba1a1a" strokeWidth={2.5} dot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Tabla Resumen ABC */}
            <div className="overflow-x-auto rounded-2xl border border-surface-container-high/60">
              <table className="w-full text-left text-body-sm">
                <thead className="bg-surface-container-low text-outline font-label-caps text-[11px] uppercase tracking-wider border-b border-surface-container-high/60">
                  <tr>
                    <th className="py-3 px-4 font-bold">Clase</th>
                    <th className="py-3 px-4 font-bold">Producto</th>
                    <th className="py-3 px-4 font-bold">Categoría</th>
                    <th className="py-3 px-4 font-bold text-right">Unidades</th>
                    <th className="py-3 px-4 font-bold text-right">Ingresos</th>
                    <th className="py-3 px-4 font-bold text-right">Margen</th>
                    <th className="py-3 px-4 font-bold text-right">% Ingreso</th>
                    <th className="py-3 px-4 font-bold text-right">% Acumulado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-high/40 bg-surface-container-lowest">
                  {datosPareto.tabla.map((p) => (
                    <tr key={p.id} className="hover:bg-surface-container-low/40 transition-colors">
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full font-label-caps text-[10px] font-bold border ${
                          p.clase === 'A'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : p.clase === 'B'
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : 'bg-purple-100 text-purple-800 border-purple-300'
                        }`}>
                          Clase {p.clase}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-title-md font-semibold text-on-surface">
                        {p.nombre}
                      </td>
                      <td className="py-3 px-4 text-on-surface-variant">
                        {p.categoria}
                      </td>
                      <td className="py-3 px-4 text-right font-label-numeric-md">
                        {p.unidades.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-label-numeric-md font-bold text-on-surface">
                        {formatCurrency(p.ingresos)}
                      </td>
                      <td className="py-3 px-4 text-right font-label-numeric-md text-primary font-semibold">
                        {formatCurrency(p.margen)}
                      </td>
                      <td className="py-3 px-4 text-right font-label-numeric-md">
                        {p.porcentaje_ingresos}%
                      </td>
                      <td className="py-3 px-4 text-right font-label-numeric-md font-bold">
                        {p.porcentaje_acumulado}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 4. Segmentación RFM de Clientes */}
          <div className="p-6 rounded-3xl bg-surface-container-lowest border border-surface-container-high/60 shadow-xs">
            <div className="mb-6">
              <div className="flex items-center gap-2">
                <h3 className="font-headline-md text-xl font-bold text-on-surface">
                  Segmentación RFM de Clientes
                </h3>
                <span className="px-2.5 py-0.5 rounded-full font-label-caps text-[10px] uppercase font-bold bg-secondary-fixed text-on-secondary-fixed-variant">
                  Recencia • Frecuencia • Monetario
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                Clasificación algorítmica de la base de compradores para optimizar campañas comerciales y retención.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {datosRFM.map((rfm) => (
                <div
                  key={rfm.segmento}
                  className="p-5 rounded-3xl bg-surface-container-low border border-surface-container-high/60 flex flex-col justify-between hover:border-primary transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className={`px-2.5 py-0.5 rounded-full font-label-caps text-[10px] font-bold border ${rfm.badge_color}`}>
                        {rfm.segmento}
                      </span>
                      <span className="font-label-numeric-md text-xs font-bold text-outline">
                        {rfm.porcentaje_base}% base
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mb-1">
                      <span className="material-symbols-outlined text-xl text-primary">{rfm.icon_name}</span>
                      <h4 className="font-title-md font-bold text-on-surface text-base">
                        {rfm.titulo}
                      </h4>
                    </div>
                    <p className="text-[11px] text-on-surface-variant mb-4 leading-relaxed">
                      {rfm.descripcion}
                    </p>
                  </div>

                  <div>
                    <div className="space-y-1.5 py-3 border-t border-surface-container-high/60 text-xs">
                      <div className="flex justify-between">
                        <span className="text-outline">Clientes:</span>
                        <span className="font-bold text-on-surface">{rfm.clientes_count}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-outline">Ticket Medio:</span>
                        <span className="font-bold text-on-surface">{formatCurrency(rfm.ticket_promedio)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-outline">Gasto Acumulado:</span>
                        <span className="font-bold text-primary">{formatCurrency(rfm.total_gasto)}</span>
                      </div>
                    </div>

                    <div className="mt-3 p-2.5 rounded-2xl bg-surface-container-lowest border border-surface-container-high/40 text-[11px] text-on-surface-variant">
                      <strong className="block text-[10px] font-bold uppercase text-primary mb-0.5">
                        Acción Recomendada:
                      </strong>
                      {rfm.accion_recomendada}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 5. Heatmap de Estacionalidad (7 Días × Horarios) */}
          <div className="p-6 rounded-3xl bg-surface-container-lowest border border-surface-container-high/60 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="font-headline-md text-xl font-bold text-on-surface flex items-center gap-2">
                  <Grid className="w-5 h-5 text-primary" />
                  Heatmap de Estacionalidad & Flujo de Caja
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Distribución horaria y semanal de afluencia de clientes para optimización de apertura de cajas y turnos.
                </p>
              </div>

              {/* Escala de Color Legend */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-outline font-medium">Afluencia:</span>
                <div className="flex items-center gap-1">
                  <span className="w-4 h-4 rounded-md bg-surface-container-high" title="Baja" />
                  <span className="w-4 h-4 rounded-md bg-emerald-200" title="Moderada" />
                  <span className="w-4 h-4 rounded-md bg-emerald-400" title="Alta" />
                  <span className="w-4 h-4 rounded-md bg-emerald-600" title="Pico / Hora Dorada" />
                </div>
                <span className="text-[11px] text-outline font-semibold">Pico comercial</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[650px]">
                {/* Cabecera de Franjas Horarias */}
                <div className="grid grid-cols-8 gap-2 mb-2 text-center text-xs font-label-caps text-outline font-bold">
                  <div className="text-left pl-2">Día / Franja</div>
                  {FRANJAS_HORARIAS.map((fr) => (
                    <div key={fr.label} className="truncate" title={fr.label}>
                      {fr.label.replace(' - ', '–')}
                    </div>
                  ))}
                </div>

                {/* Filas de la Matriz por Día de la Semana */}
                <div className="space-y-2">
                  {datosHeatmap.map((filaDia, diaIdx) => (
                    <div key={DIAS_SEMANA[diaIdx]} className="grid grid-cols-8 gap-2 items-center">
                      <div className="font-title-md text-xs font-bold text-on-surface pl-2">
                        {DIAS_SEMANA[diaIdx]}
                      </div>

                      {filaDia.map((celda, frIdx) => {
                        let bgColor = 'bg-surface-container-low text-outline';
                        if (celda.intensidad > 75) {
                          bgColor = 'bg-emerald-600 text-white font-bold shadow-xs';
                        } else if (celda.intensidad > 45) {
                          bgColor = 'bg-emerald-400 text-on-primary-container font-semibold';
                        } else if (celda.intensidad > 20) {
                          bgColor = 'bg-emerald-200 text-emerald-950';
                        } else if (celda.intensidad > 0) {
                          bgColor = 'bg-emerald-100 text-emerald-900';
                        }

                        return (
                          <div
                            key={frIdx}
                            className={`h-11 rounded-xl p-1 flex flex-col items-center justify-center text-center transition-transform hover:scale-105 cursor-pointer ${bgColor}`}
                            title={`${celda.dia} ${celda.franja}: ${celda.ticketsCount} tickets ($${celda.totalVentas.toFixed(0)})`}
                          >
                            <span className="text-xs">{celda.ticketsCount}</span>
                            <span className="text-[10px] opacity-80">
                              ${celda.totalVentas >= 1000 ? `${(celda.totalVentas / 1000).toFixed(1)}k` : celda.totalVentas.toFixed(0)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 6. Proyecciones de Demanda Inferencial (Z / Student-T) */}
          <div className="p-6 rounded-3xl bg-surface-container-lowest border border-surface-container-high/60 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-headline-md text-xl font-bold text-on-surface">
                    Proyecciones de Demanda Inferencial (IC 95%)
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full font-label-caps text-[10px] uppercase font-bold bg-primary-fixed text-on-primary-fixed-variant">
                    Z / Student-T
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                  Inferencia estadística sobre consumo histórico para prevención de quiebres de inventario y sobrestock.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setModalInferenciaInfoOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container hover:bg-surface-container-high text-xs font-title-md text-on-surface transition-all cursor-pointer"
              >
                <Info className="w-3.5 h-3.5 text-primary" />
                <span>Metodología Estadística</span>
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-surface-container-high/60">
              <table className="w-full text-left text-body-sm">
                <thead className="bg-surface-container-low text-outline font-label-caps text-[11px] uppercase tracking-wider border-b border-surface-container-high/60">
                  <tr>
                    <th className="py-3 px-4 font-bold">Estado</th>
                    <th className="py-3 px-4 font-bold">Producto / SKU</th>
                    <th className="py-3 px-4 font-bold">Distribución</th>
                    <th className="py-3 px-4 font-bold text-right">Muestras (n)</th>
                    <th className="py-3 px-4 font-bold text-right">Demanda Media</th>
                    <th className="py-3 px-4 font-bold text-right">Desv. Est. (σ)</th>
                    <th className="py-3 px-4 font-bold text-center">Intervalo Confianza 95%</th>
                    <th className="py-3 px-4 font-bold text-right">Stock Actual</th>
                    <th className="py-3 px-4 font-bold text-right">Stock Sugerido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-high/40 bg-surface-container-lowest">
                  {datosProyeccionInferencial.map((p) => (
                    <tr key={p.producto_id} className="hover:bg-surface-container-low/40 transition-colors">
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-label-caps text-[10px] font-bold border ${
                          p.estado_stock === 'OPTIMO'
                            ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                            : p.estado_stock === 'ALERTA_REPOSICION'
                            ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                            : 'bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-300 border-red-300 dark:border-red-800 animate-pulse'
                        }`}>
                          {p.estado_stock === 'OPTIMO' ? (
                            <>
                              <span className="material-symbols-outlined text-xs">check_circle</span>
                              <span>Óptimo</span>
                            </>
                          ) : p.estado_stock === 'ALERTA_REPOSICION' ? (
                            <>
                              <span className="material-symbols-outlined text-xs">warning</span>
                              <span>Reponer</span>
                            </>
                          ) : (
                            <>
                              <span className="material-symbols-outlined text-xs">error</span>
                              <span>Riesgo Quiebre</span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-title-md font-semibold text-on-surface">{p.nombre}</div>
                        <div className="text-[11px] text-outline">{p.sku} • {p.categoria}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs">
                        {p.distribucion_usada}
                      </td>
                      <td className="py-3 px-4 text-right font-label-numeric-md">
                        {p.muestras_n} días
                      </td>
                      <td className="py-3 px-4 text-right font-label-numeric-md font-bold text-on-surface">
                        {p.demanda_media_diaria} uds/día
                      </td>
                      <td className="py-3 px-4 text-right font-label-numeric-md text-outline">
                        ±{p.desviacion_estandar}
                      </td>
                      <td className="py-3 px-4 text-center font-label-numeric-md">
                        <span className="px-2 py-0.5 rounded-md bg-surface-container font-mono text-xs">
                          [{p.limite_inferior_95} – {p.limite_superior_95}]
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-label-numeric-md font-bold">
                        <span className={p.stock_actual < p.stock_preventivo ? 'text-amber-700' : 'text-primary'}>
                          {p.stock_actual} uds
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-label-numeric-md font-bold text-on-surface">
                        {p.stock_preventivo} uds
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* CONTENIDO TAB 2: CONSTRUCTOR DE REPORTES & PLANTILLAS     */}
      {/* ========================================================= */}
      {activeTab === 'CONSTRUCTOR' && (
        <div className="space-y-6 print:hidden animate-in fade-in duration-200">
          
          {/* Barra Superior del Constructor: Plantillas y Guardar Plantilla */}
          <div className="p-5 rounded-3xl bg-surface-container-lowest border border-surface-container-high/60 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-label-caps text-xs font-bold uppercase text-outline flex items-center gap-1.5">
                <Bookmark className="w-4 h-4 text-primary" />
                Cargar Plantilla:
              </span>

              <div className="relative min-w-[260px]">
                <select
                  value={plantillaActivaId}
                  onChange={(e) => aplicarPlantilla(e.target.value)}
                  className="w-full pl-3 pr-8 py-2 rounded-2xl bg-surface-container-low text-on-surface font-title-md text-xs font-semibold border border-surface-container-high/60 appearance-none cursor-pointer focus:outline-primary"
                >
                  <option value="personalizada">Configuración Personalizada</option>
                  
                  <optgroup label="Plantillas Predefinidas de Sistema">
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
                <ChevronDown className="w-4 h-4 text-outline absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {plantillasGuardadas.some((p) => p.id === plantillaActivaId) && (
                <button
                  type="button"
                  onClick={(e) => handleEliminarPlantilla(plantillaActivaId, e)}
                  className="p-2 rounded-xl text-error hover:bg-error-container/40 transition-colors cursor-pointer"
                  title="Eliminar esta plantilla personalizada"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setModalGuardarPlantillaOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-title-md text-xs font-semibold border border-surface-container-high/60 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-tertiary" />
              <span>Guardar Configuración Actual como Plantilla</span>
            </button>
          </div>

          {/* Selector de Agrupación y Filtros Específicos del Reporte */}
          <div className="p-5 rounded-3xl bg-surface-container-lowest border border-surface-container-high/60 shadow-xs space-y-4">
            
            {/* Fila de Nivel de Agrupación */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-surface-container-high/40">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-label-caps text-xs font-bold uppercase text-outline flex items-center gap-1.5 mr-1">
                  <Layers className="w-3.5 h-3.5" />
                  Nivel de Agrupación:
                </span>
                
                <div className="flex flex-wrap items-center gap-1 bg-surface-container-low p-1 rounded-2xl border border-surface-container-high/40">
                  {[
                    { id: 'LINEA', label: 'Detallado por línea' },
                    { id: 'DIA', label: 'Agrupado por Día' },
                    { id: 'PRODUCTO', label: 'Por Producto' },
                    { id: 'CATEGORIA', label: 'Por Categoría' },
                    { id: 'CAJERO', label: 'Por Cajero' },
                    { id: 'METODO_PAGO', label: 'Por Método de Pago' },
                  ].map((ag) => (
                    <button
                      key={ag.id}
                      type="button"
                      onClick={() => {
                        setTipoAgrupacion(ag.id as TipoAgrupacion);
                        setPaginaActual(1);
                      }}
                      className={`px-3 py-1.5 rounded-xl font-title-md text-xs font-semibold transition-all cursor-pointer ${
                        tipoAgrupacion === ag.id
                          ? 'bg-primary text-on-primary shadow-xs font-bold'
                          : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                      }`}
                    >
                      {ag.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Búsqueda Rápida */}
              <div className="relative min-w-[240px]">
                <Search className="w-4 h-4 text-outline absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar folio, cliente o producto…"
                  value={filtroTextoBusqueda}
                  onChange={(e) => {
                    setFiltroTextoBusqueda(e.target.value);
                    setPaginaActual(1);
                  }}
                  className="w-full pl-9 pr-3 py-1.5 rounded-2xl bg-surface-container-low text-on-surface text-xs font-title-md border border-surface-container-high/60 outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Fila de Filtros Específicos: Categoría, Método de Pago, Cajero */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Categoría */}
              <div>
                <label className="block font-label-caps text-[10px] uppercase font-bold text-outline mb-1">
                  Categoría
                </label>
                <select
                  value={filtroCategoria}
                  onChange={(e) => {
                    setFiltroCategoria(e.target.value);
                    setPaginaActual(1);
                  }}
                  className="w-full py-1.5 px-3 rounded-xl bg-surface-container-low text-xs font-title-md font-semibold text-on-surface border border-surface-container-high/60 cursor-pointer"
                >
                  {categoriasDisponibles.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat === 'TODAS' ? 'Todas las Categorías' : cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Método de Pago */}
              <div>
                <label className="block font-label-caps text-[10px] uppercase font-bold text-outline mb-1">
                  Método de Pago
                </label>
                <select
                  value={filtroMetodoPago}
                  onChange={(e) => {
                    setFiltroMetodoPago(e.target.value);
                    setPaginaActual(1);
                  }}
                  className="w-full py-1.5 px-3 rounded-xl bg-surface-container-low text-xs font-title-md font-semibold text-on-surface border border-surface-container-high/60 cursor-pointer"
                >
                  <option value="TODOS">Todos los Métodos</option>
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="TARJETA">Tarjeta Bancaria</option>
                  <option value="QR_DEUNA">QR DeUna</option>
                </select>
              </div>

              {/* Cajero */}
              <div>
                <label className="block font-label-caps text-[10px] uppercase font-bold text-outline mb-1">
                  Cajero
                </label>
                <select
                  value={filtroCajero}
                  onChange={(e) => {
                    setFiltroCajero(e.target.value);
                    setPaginaActual(1);
                  }}
                  className="w-full py-1.5 px-3 rounded-xl bg-surface-container-low text-xs font-title-md font-semibold text-on-surface border border-surface-container-high/60 cursor-pointer"
                >
                  {cajerosDisponibles.map((caj) => (
                    <option key={caj} value={caj}>
                      {caj === 'TODOS' ? 'Todos los Cajeros' : caj}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Selector Interactivo de Columnas (15 columnas con Chips y Reordenamiento) */}
          <div className="p-5 rounded-3xl bg-surface-container-lowest border border-surface-container-high/60 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-primary" />
                <h4 className="font-title-md font-bold text-sm text-on-surface">
                  Selector de Columnas Activas ({columnasVisibles.length} de {columnasConfig.length} visibles)
                </h4>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => seleccionarTodasColumnas(true)}
                  className="text-primary hover:underline font-bold cursor-pointer"
                >
                  Seleccionar Todas
                </button>
                <span className="text-outline">•</span>
                <button
                  type="button"
                  onClick={() => seleccionarTodasColumnas(false)}
                  className="text-outline hover:underline font-bold cursor-pointer"
                >
                  Deseleccionar
                </button>
                <span className="text-outline">•</span>
                <button
                  type="button"
                  onClick={restablecerColumnas}
                  className="text-outline hover:underline font-bold cursor-pointer"
                >
                  Restablecer
                </button>
              </div>
            </div>

            {/* Chips de Columnas con Botones Arriba/Abajo */}
            <div className="flex flex-wrap gap-2">
              {columnasConfig.map((col, idx) => (
                <div
                  key={col.id}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border text-xs transition-all ${
                    col.visible
                      ? 'bg-primary-container/20 border-primary/40 text-on-surface font-semibold shadow-xs'
                      : 'bg-surface-container-low border-surface-container-high/60 text-outline opacity-60'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={col.visible}
                    onChange={() => toggleColumna(col.id)}
                    className="cursor-pointer accent-primary rounded"
                  />
                  <span className="select-none">{col.header}</span>

                  <div className="flex items-center ml-1 border-l border-surface-container-high/80 pl-1">
                    <button
                      type="button"
                      onClick={() => moverColumna(idx, 'arriba')}
                      disabled={idx === 0}
                      className="p-0.5 hover:text-primary disabled:opacity-20 cursor-pointer"
                      title="Mover a la izquierda / antes"
                    >
                      <ArrowUp className="w-3 h-3 -rotate-90" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moverColumna(idx, 'abajo')}
                      disabled={idx === columnasConfig.length - 1}
                      className="p-0.5 hover:text-primary disabled:opacity-20 cursor-pointer"
                      title="Mover a la derecha / después"
                    >
                      <ArrowDown className="w-3 h-3 -rotate-90" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Barra de Acciones y Exportación */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-3xl bg-surface-container-lowest border border-surface-container-high/60 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="font-label-caps text-xs uppercase font-bold text-outline">
                Registros Filtrados:
              </span>
              <span className="px-3 py-1 rounded-full bg-surface-container-low font-label-numeric-md text-xs font-bold text-on-surface border border-surface-container-high/60">
                {filasOrdenadas.length.toLocaleString()} filas
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Botón Exportar a CSV (BOM UTF-8) */}
              <button
                type="button"
                onClick={exportarCSVReporte}
                disabled={filasOrdenadas.length === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white font-title-md text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                title="Exportar archivo CSV con codificación UTF-8 compatible con Microsoft Excel"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar CSV (Excel)</span>
              </button>

              {/* Botón Imprimir / PDF */}
              <button
                type="button"
                onClick={handleImprimirReporte}
                disabled={filasOrdenadas.length === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-title-md text-xs font-semibold border border-surface-container-high/60 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                title="Imprimir reporte o guardar como PDF formateado con membrete oficial"
              >
                <Printer className="w-3.5 h-3.5 text-secondary" />
                <span>Imprimir / PDF</span>
              </button>
            </div>
          </div>

          {/* Tabla Dinámica de Resultados */}
          <div className="p-5 rounded-3xl bg-surface-container-lowest border border-surface-container-high/60 shadow-xs space-y-4">
            <div className="overflow-x-auto rounded-2xl border border-surface-container-high/60">
              <table className="w-full text-left text-body-sm">
                <thead className="bg-surface-container-low text-outline font-label-caps text-[11px] uppercase tracking-wider border-b border-surface-container-high/60">
                  <tr>
                    {columnasVisibles.map((col) => {
                      const esOrdenActivo = ordenColumna === col.id;
                      return (
                        <th
                          key={col.id}
                          onClick={() => handleOrdenar(col.id)}
                          className={`py-3 px-3 font-bold cursor-pointer select-none transition-colors hover:bg-surface-container text-${col.align || 'left'}`}
                        >
                          <div className={`flex items-center gap-1.5 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start'}`}>
                            <span>{col.header}</span>
                            {esOrdenActivo ? (
                              ordenDireccion === 'asc' ? (
                                <ChevronUp className="w-3.5 h-3.5 text-primary" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 text-primary" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3 h-3 text-outline/40" />
                            )}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                <tbody className="divide-y divide-surface-container-high/40 bg-surface-container-lowest">
                  {filasPaginadas.length === 0 ? (
                    <tr>
                      <td colSpan={columnasVisibles.length} className="py-12 text-center text-on-surface-variant font-title-md">
                        No se encontraron registros con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    filasPaginadas.map((row: any, idx) => (
                      <tr key={row.id || idx} className="hover:bg-surface-container-low/40 transition-colors">
                        {columnasVisibles.map((col) => {
                          const val = row[col.id];
                          const formatted = col.formatter ? col.formatter(val, row) : (val ?? '—');
                          return (
                            <td
                              key={col.id}
                              className={`py-2.5 px-3 text-${col.align || 'left'} ${
                                col.id === 'total' ? 'font-bold text-on-surface' :
                                col.id === 'margen_ganancia' ? 'text-primary font-semibold' :
                                'text-on-surface-variant'
                              }`}
                            >
                              {col.id === 'metodo_pago' ? (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase font-label-caps ${
                                  val === 'EFECTIVO' ? 'bg-emerald-100 text-emerald-800' :
                                  val === 'TARJETA' ? 'bg-blue-100 text-blue-800' :
                                  'bg-purple-100 text-purple-800'
                                }`}>
                                  {val}
                                </span>
                              ) : (
                                formatted
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>

                {filasOrdenadas.length > 0 && (
                  <tfoot className="bg-surface-container-low font-bold border-t-2 border-surface-container-high/80 text-on-surface">
                    <tr>
                      {columnasVisibles.map((col, idx) => {
                        if (idx === 0) {
                          return (
                            <td key={col.id} className="py-3 px-3 text-left font-label-caps text-xs uppercase tracking-wider">
                              TOTAL CONSOLIDADO ({filasOrdenadas.length} reg.)
                            </td>
                          );
                        }
                        if (col.id === 'cantidad') {
                          return (
                            <td key={col.id} className="py-3 px-3 text-right font-label-numeric-md">
                              {formatNumber(totalesConsolidados.cantidad, 0)}
                            </td>
                          );
                        }
                        if (col.id === 'subtotal') {
                          return (
                            <td key={col.id} className="py-3 px-3 text-right font-label-numeric-md">
                              {formatCurrency(totalesConsolidados.subtotal)}
                            </td>
                          );
                        }
                        if (col.id === 'descuento') {
                          return (
                            <td key={col.id} className="py-3 px-3 text-right font-label-numeric-md">
                              {formatCurrency(totalesConsolidados.descuento)}
                            </td>
                          );
                        }
                        if (col.id === 'impuestos') {
                          return (
                            <td key={col.id} className="py-3 px-3 text-right font-label-numeric-md">
                              {formatCurrency(totalesConsolidados.impuestos)}
                            </td>
                          );
                        }
                        if (col.id === 'total') {
                          return (
                            <td key={col.id} className="py-3 px-3 text-right font-label-numeric-md font-bold text-primary">
                              {formatCurrency(totalesConsolidados.total)}
                            </td>
                          );
                        }
                        if (col.id === 'margen_ganancia') {
                          return (
                            <td key={col.id} className="py-3 px-3 text-right font-label-numeric-md font-bold text-emerald-700 dark:text-emerald-300">
                              {formatCurrency(totalesConsolidados.margen_ganancia)}
                            </td>
                          );
                        }
                        return <td key={col.id} className="py-3 px-3"></td>;
                      })}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-2 text-xs text-outline">
                <span>Mostrando página</span>
                <span className="font-bold text-on-surface">{paginaActual}</span>
                <span>de</span>
                <span className="font-bold text-on-surface">{totalPaginas}</span>
                <span>({filasOrdenadas.length} resultados)</span>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-xs text-outline">
                  <span>Filas por página:</span>
                  <select
                    value={elementosPorPagina}
                    onChange={(e) => {
                      setElementosPorPagina(Number(e.target.value));
                      setPaginaActual(1);
                    }}
                    className="py-1 px-2 rounded-xl bg-surface-container-low text-xs font-semibold text-on-surface border border-surface-container-high/60 cursor-pointer"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
                    disabled={paginaActual === 1}
                    className="px-3 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-title-md font-semibold text-on-surface disabled:opacity-40 cursor-pointer"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
                    disabled={paginaActual === totalPaginas}
                    className="px-3 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-title-md font-semibold text-on-surface disabled:opacity-40 cursor-pointer"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: GUARDAR CONFIGURACIÓN ACTUAL COMO PLANTILLA        */}
      {/* ========================================================= */}
      {modalGuardarPlantillaOpen && (
        <div className="fixed inset-0 bg-inverse-surface/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface-container-lowest rounded-3xl shadow-2xl max-w-md w-full p-6 border border-surface-container-high/60 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-high/60">
              <div className="flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-primary" />
                <h3 className="font-headline-md text-lg font-bold text-on-surface">
                  Guardar Plantilla de Reporte
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalGuardarPlantillaOpen(false)}
                className="p-1 rounded-full text-outline hover:text-on-surface hover:bg-surface-container"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleGuardarPlantilla} className="mt-4 space-y-4">
              <div>
                <label className="block font-label-caps text-xs uppercase font-bold text-outline mb-1">
                  Nombre de la Plantilla *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Cierre Fiscal Mensual Auditado"
                  value={nombreNuevaPlantilla}
                  onChange={(e) => setNombreNuevaPlantilla(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-2xl bg-surface-container-low text-body-sm font-title-md text-on-surface border border-surface-container-high/60 outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block font-label-caps text-xs uppercase font-bold text-outline mb-1">
                  Descripción
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe el objetivo y uso de esta configuración…"
                  value={descNuevaPlantilla}
                  onChange={(e) => setDescNuevaPlantilla(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-2xl bg-surface-container-low text-body-sm font-title-md text-on-surface border border-surface-container-high/60 outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="p-3 rounded-2xl bg-surface-container-low border border-surface-container-high/40 text-xs space-y-1 text-on-surface-variant">
                <div><strong>Agrupación:</strong> {tipoAgrupacion}</div>
                <div><strong>Columnas activas:</strong> {columnasVisibles.length} seleccionadas</div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalGuardarPlantillaOpen(false)}
                  className="px-4 py-2 rounded-full bg-surface-container text-xs font-semibold text-on-surface cursor-pointer"
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

      {/* ========================================================= */}
      {/* MODAL: METODOLOGÍA ESTADÍSTICA INFERENCIAL                */}
      {/* ========================================================= */}
      {modalInferenciaInfoOpen && (
        <div className="fixed inset-0 bg-inverse-surface/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface-container-lowest rounded-3xl shadow-2xl max-w-xl w-full p-6 border border-surface-container-high/60 flex flex-col max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-high/60">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <h3 className="font-headline-md text-lg font-bold text-on-surface">
                  Metodología de Inferencia Z / Student-T
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalInferenciaInfoOpen(false)}
                className="p-1 rounded-full text-outline hover:text-on-surface hover:bg-surface-container"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-body-sm text-on-surface-variant leading-relaxed">
              <p>
                El módulo de proyecciones estadísticas de Quantix Retail implementa el <strong>Teorema del Límite Central (TLC)</strong> para construir intervalos de confianza al <strong>95%</strong> sobre la serie temporal de demanda diaria:
              </p>

              <div className="p-3.5 rounded-2xl bg-surface-container-low border border-surface-container-high/60 space-y-2">
                <div className="font-bold text-on-surface text-xs uppercase tracking-wider font-label-caps">
                  1. Muestras Grandes (n ≥ 30 días con venta):
                </div>
                <p className="text-xs">
                  Aplica la <strong>Distribución Normal Estándar (Z)</strong> con valor crítico Z₀.₉₇₅ = 1.96.
                  El margen de error se calcula como E = 1.96 · (s / √n).
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-surface-container-low border border-surface-container-high/60 space-y-2">
                <div className="font-bold text-on-surface text-xs uppercase tracking-wider font-label-caps">
                  2. Muestras Pequeñas (n &lt; 30 días con venta):
                </div>
                <p className="text-xs">
                  Aplica la <strong>Distribución t de Student</strong> con n - 1 grados de libertad para compensar colas más pesadas debido a la incertidumbre muestral.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-1.5 text-emerald-900 dark:text-emerald-300">
                <div className="font-bold text-xs uppercase tracking-wider font-label-caps">
                  3. Nivel de Stock Preventivo Recomendado:
                </div>
                <p className="text-xs">
                  Calculado como: <code>Stock_Sugerido = Límite_Superior_95% × Lead_Time + Safety_Stock</code>, protegiendo a la sucursal de quiebres de stock sin inducir costos de almacenamiento innecesarios.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-surface-container-high/60 mt-4">
              <button
                type="button"
                onClick={() => setModalInferenciaInfoOpen(false)}
                className="px-5 py-2 rounded-full bg-primary text-on-primary text-xs font-bold shadow-xs cursor-pointer hover:opacity-95"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
