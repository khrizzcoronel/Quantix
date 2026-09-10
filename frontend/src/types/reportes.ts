/**
 * Tipos y constantes para el generador de reportes personalizados y motor analítico de Quantix Retail OS.
 */

export type RangoFechaId = '7d' | '30d' | '90d' | 'ytd' | 'custom';

export type GranularidadGrafico = 'DIA' | 'SEMANA' | 'MES';

export type TipoAgrupacion = 'LINEA' | 'DIA' | 'PRODUCTO' | 'CATEGORIA' | 'CAJERO' | 'METODO_PAGO' | 'CLIENTE';

export type TipoGrafico = 
  | 'BARRAS' 
  | 'LINEA' 
  | 'AREA' 
  | 'DONA' 
  | 'PIE' 
  | 'BARRAS_APILADAS' 
  | 'TABLA_EDITORIAL';

export type LayoutReporte = 'EDITORIAL' | 'ONE_PAGE' | 'DASHBOARD';

export type PaletaColor = 'QUANTIX' | 'CORPORATE' | 'SUNSET' | 'MONO';

export interface ColumnaReporteDef {
  id: string;
  header: string;
  visible: boolean;
  align?: 'left' | 'center' | 'right';
  categoria?: 'TIEMPO' | 'OPERACION' | 'CLIENTE' | 'PRODUCTO' | 'FINANZAS' | 'PAGO';
  formatter?: (val: any, row?: any) => string;
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

export type TipoSeccion = 
  | 'GRAFICO' 
  | 'KPIS' 
  | 'DISTRIBUCION_RANKING' 
  | 'CANALES_PAGO'
  | 'COMPARATIVA_DUAL'
  | 'INTELIGENCIA_CLIENTES';

export interface SeccionReporte {
  id: string;
  tipo: TipoSeccion;
  titulo: string;
  subtitulo?: string;
  // Configuración específica de GRAFICO
  tipoGrafico?: TipoGrafico;
  dimensionAgrupacion?: TipoAgrupacion;
  metrica?: 'total' | 'margen' | 'cantidad' | 'subtotal';
  // Configuración específica de KPIS
  kpisSeleccionados?: Array<'ventas' | 'margen' | 'ticket' | 'transacciones' | 'unidades'>;
  // Configuración específica de DISTRIBUCION_RANKING
  dimensionRanking?: 'PRODUCTO' | 'CATEGORIA' | 'CAJERO' | 'CLIENTE';
  limiteItems?: number;
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

export interface PlantillaReporteV2 extends PlantillaReporte {
  tipo_grafico?: TipoGrafico;
  layout_reporte?: LayoutReporte;
  paleta?: PaletaColor;
  titulo_reporte?: string;
  subtitulo_reporte?: string;
  mostrar_tabla?: boolean;
  mostrar_logo?: boolean;
  secciones?: SeccionReporte[];
}

export interface DefinicionPaleta {
  id: PaletaColor;
  nombre: string;
  tagline: string;
  primario: string;
  secundario: string;
  acento: string;
  colores: string[];
  gradiente: [string, string];
  claseBadge: string;
  bordePreview: string;
}

export const PALETAS_CONFIG: Record<PaletaColor, DefinicionPaleta> = {
  QUANTIX: {
    id: 'QUANTIX',
    nombre: 'Quantix Esmeralda',
    tagline: 'Identidad oficial verde esmeralda y menta neo-retail',
    primario: '#006c49',
    secundario: '#10b981',
    acento: '#34d399',
    colores: ['#006c49', '#10b981', '#059669', '#34d399', '#047857', '#6ee7b7', '#065f46'],
    gradiente: ['#006c49', '#10b981'],
    claseBadge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
    bordePreview: 'border-emerald-500/40',
  },
  CORPORATE: {
    id: 'CORPORATE',
    nombre: 'Corporate Cobalt',
    tagline: 'Azul cobalto financiero y alta dirección C-Level',
    primario: '#0051d5',
    secundario: '#3b82f6',
    acento: '#60a5fa',
    colores: ['#0051d5', '#3b82f6', '#2563eb', '#60a5fa', '#1d4ed8', '#93c5fd', '#1e40af'],
    gradiente: ['#0051d5', '#3b82f6'],
    claseBadge: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300 dark:border-blue-800',
    bordePreview: 'border-blue-500/40',
  },
  SUNSET: {
    id: 'SUNSET',
    nombre: 'Sunset Ámbar',
    tagline: 'Ámbar cálido y tonos comerciales de alta energía',
    primario: '#d97706',
    secundario: '#f59e0b',
    acento: '#fbbf24',
    colores: ['#d97706', '#f59e0b', '#ea580c', '#fbbf24', '#c2410c', '#fcd34d', '#7c2d12'],
    gradiente: ['#d97706', '#f59e0b'],
    claseBadge: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800',
    bordePreview: 'border-amber-500/40',
  },
  MONO: {
    id: 'MONO',
    nombre: 'Editorial Slate',
    tagline: 'Gris pizarra y grafito sobrio estilo OSCORP',
    primario: '#334155',
    secundario: '#64748b',
    acento: '#94a3b8',
    colores: ['#1e293b', '#334155', '#475569', '#64748b', '#94a3b8', '#0f172a', '#cbd5e1'],
    gradiente: ['#1e293b', '#64748b'],
    claseBadge: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border-slate-400 dark:border-slate-700',
    bordePreview: 'border-slate-500/40',
  },
};
