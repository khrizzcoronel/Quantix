import { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  LineChart,
  AreaChart,
  PieChart,
  Pie,
  Cell,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend
} from 'recharts';
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Receipt,
  Building2,
  Calendar,
  User,
  ShieldCheck,
  Percent,
  Hash,
  Sparkles,
  Award,
  CreditCard,
  Layers,
  BarChart3,
  Activity,
  Users
} from 'lucide-react';
import {
  type FilaReporteVenta,
  type SeccionReporte,
  type TipoAgrupacion,
  type PaletaColor,
  PALETAS_CONFIG
} from '../types/reportes';
import { formatCurrency, formatNumber } from '../utils/exportUtils';

export interface ReportePreviewProps {
  ventas: FilaReporteVenta[];
  secciones: SeccionReporte[];
  paleta: PaletaColor;
  tituloReporte: string;
  subtituloReporte: string;
  mostrarLogo: boolean;
  nombreSucursal: string;
  nombreOperador: string;
  rangoFechaLabel: string;
  cargando?: boolean;
}

export default function ReportePreview({
  ventas,
  secciones,
  paleta,
  tituloReporte,
  subtituloReporte,
  mostrarLogo,
  nombreSucursal,
  nombreOperador,
  rangoFechaLabel,
  cargando = false,
}: ReportePreviewProps) {
  const paletaActual = PALETAS_CONFIG[paleta] || PALETAS_CONFIG.QUANTIX;

  // Fecha y folio de emisión
  const fechaEmision = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString('es-EC', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  const folioReporte = useMemo(() => {
    return `QX-REP-${new Date().getFullYear()}-${Math.abs(
      (tituloReporte.length * 41 + nombreSucursal.length * 17) % 9000 + 1000
    )}`;
  }, [tituloReporte, nombreSucursal]);

  // Cálculos globales de KPIs
  const kpisGlobales = useMemo(() => {
    const totalIngresos = ventas.reduce((acc, r) => acc + (r.total || 0), 0);
    const totalSubtotal = ventas.reduce((acc, r) => acc + (r.subtotal || 0), 0);
    const totalMargen = ventas.reduce((acc, r) => acc + (r.margen_ganancia || 0), 0);
    const totalUnidades = ventas.reduce((acc, r) => acc + (r.cantidad || 0), 0);
    const ticketsSet = new Set(ventas.map((r) => r.folio_ticket));
    const transacciones = ticketsSet.size;

    const margenBrutoPct = totalSubtotal > 0 ? (totalMargen / totalSubtotal) * 100 : 0;
    const ticketPromedio = transacciones > 0 ? totalIngresos / transacciones : 0;

    return {
      ingresosNetos: totalIngresos,
      margenBrutoPct,
      margenBrutoTotal: totalMargen,
      ticketPromedio,
      transaccionesTotales: transacciones,
      unidadesVendidas: totalUnidades,
    };
  }, [ventas]);

  // Helper para agrupar datos según dimensión para gráficos
  const obtenerDatosGrafico = (dimension: TipoAgrupacion = 'CATEGORIA', limite = 12) => {
    if (ventas.length === 0) return [];

    const mapa: Record<string, { nombre: string; total: number; margen: number; subtotal: number; impuestos: number; cantidad: number }> = {};

    ventas.forEach((v) => {
      let clave = '';
      switch (dimension) {
        case 'DIA':
          clave = v.fecha ? v.fecha.split('T')[0] : 'Sin fecha';
          break;
        case 'PRODUCTO':
          clave = v.producto_nombre || 'Sin producto';
          break;
        case 'CATEGORIA':
          clave = v.categoria_nombre || 'Sin categoría';
          break;
        case 'CLIENTE':
          clave = v.cliente_nombre || 'Cliente Ocasional';
          break;
        case 'CAJERO':
          clave = v.cajero_nombre || 'Sin cajero';
          break;
        case 'METODO_PAGO':
          clave = v.metodo_pago || 'EFECTIVO';
          break;
        default:
          clave = v.categoria_nombre || 'Varios';
      }

      if (!mapa[clave]) {
        mapa[clave] = { nombre: clave, total: 0, margen: 0, subtotal: 0, impuestos: 0, cantidad: 0 };
      }
      mapa[clave].total += v.total || 0;
      mapa[clave].margen += v.margen_ganancia || 0;
      mapa[clave].subtotal += v.subtotal || 0;
      mapa[clave].impuestos += v.impuestos || 0;
      mapa[clave].cantidad += v.cantidad || 0;
    });

    return Object.values(mapa)
      .map((item) => ({
        ...item,
        total: Number(item.total.toFixed(2)),
        margen: Number(item.margen.toFixed(2)),
        subtotal: Number(item.subtotal.toFixed(2)),
        impuestos: Number(item.impuestos.toFixed(2)),
      }))
      .sort((a, b) => (dimension === 'DIA' ? a.nombre.localeCompare(b.nombre) : b.total - a.total))
      .slice(0, limite);
  };

  // Helper para datos de ranking (Top productos, categorías o clientes con barras de progreso)
  const obtenerDatosRanking = (dimension: 'PRODUCTO' | 'CATEGORIA' | 'CAJERO' | 'CLIENTE' = 'PRODUCTO', limite = 6) => {
    const agrupados = obtenerDatosGrafico(dimension, limite);
    const totalMax = kpisGlobales.ingresosNetos > 0 ? kpisGlobales.ingresosNetos : 1;

    return agrupados.map((item) => ({
      nombre: item.nombre,
      total: item.total,
      margen: item.margen,
      cantidad: item.cantidad,
      porcentaje: Number(((item.total / totalMax) * 100).toFixed(1)),
    }));
  };

  // Helper para métricas e inteligencia de clientes
  const obtenerMetricasClientes = () => {
    const clientesSet = new Set(ventas.map((v) => v.cliente_nombre));
    const totalClientes = clientesSet.size;
    const gastoPromedio = totalClientes > 0 ? kpisGlobales.ingresosNetos / totalClientes : 0;
    const rankingClientes = obtenerDatosRanking('CLIENTE', 5);
    const clienteLider = rankingClientes[0] || { nombre: 'N/A', total: 0, porcentaje: 0 };
    const ticketsPromedioPorCliente = totalClientes > 0 ? Number((kpisGlobales.transaccionesTotales / totalClientes).toFixed(1)) : 0;

    return {
      totalClientes,
      gastoPromedio,
      clienteLider,
      ticketsPromedioPorCliente,
      topClientes: rankingClientes,
    };
  };

  // Helper para canales de pago
  const obtenerDatosCanalesPago = () => {
    const canales = [
      { key: 'EFECTIVO', label: 'Efectivo', color: '#10b981' },
      { key: 'TARJETA', label: 'Tarjeta Bancaria', color: '#3b82f6' },
      { key: 'QR_DEUNA', label: 'QR DeUna', color: '#8b5cf6' },
    ];

    const totalGeneral = kpisGlobales.ingresosNetos > 0 ? kpisGlobales.ingresosNetos : 1;

    return canales.map((c) => {
      const ventasCanal = ventas.filter((v) => v.metodo_pago === c.key);
      const totalCanal = ventasCanal.reduce((acc, v) => acc + v.total, 0);
      const ticketsCanal = new Set(ventasCanal.map((v) => v.folio_ticket)).size;
      const pct = Number(((totalCanal / totalGeneral) * 100).toFixed(1));

      return {
        key: c.key,
        label: c.label,
        total: totalCanal,
        tickets: ticketsCanal,
        porcentaje: pct,
        color: c.color,
      };
    });
  };

  // RENDERIZADO DE GRÁFICO RECHARTS
  const renderGraficoRecharts = (seccion: SeccionReporte) => {
    const tipo = seccion.tipoGrafico || 'BARRAS';
    const dimension = seccion.dimensionAgrupacion || 'CATEGORIA';
    const datos = obtenerDatosGrafico(dimension);

    if (datos.length === 0) {
      return (
        <div className="h-64 flex items-center justify-center text-outline font-title-md text-xs">
          No hay datos disponibles para esta visualización con los filtros activos.
        </div>
      );
    }

    switch (tipo) {
      case 'LINEA':
        return (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={datos} margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
              <XAxis dataKey="nombre" angle={-15} textAnchor="end" tick={{ fontSize: 11 }} interval={0} />
              <YAxis tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} tick={{ fontSize: 11 }} />
              <RechartsTooltip
                formatter={(val: any, name: any) => [
                  formatCurrency(Number(val)),
                  name === 'total' ? 'Facturación' : 'Margen Bruto'
                ]}
                contentStyle={{ borderRadius: '1rem', backgroundColor: '#131b2e', color: '#ffffff', border: 'none' }}
              />
              <Legend verticalAlign="top" height={32} />
              <Line
                type="monotone"
                dataKey="total"
                name="Ventas Totales ($)"
                stroke={paletaActual.primario}
                strokeWidth={3}
                dot={{ r: 4, fill: paletaActual.primario }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="margen"
                name="Margen Ganancia ($)"
                stroke={paletaActual.secundario}
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={{ r: 3, fill: paletaActual.secundario }}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'AREA':
        return (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={datos} margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
              <defs>
                <linearGradient id={`gradArea-${seccion.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={paletaActual.primario} stopOpacity={0.5} />
                  <stop offset="95%" stopColor={paletaActual.primario} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
              <XAxis dataKey="nombre" angle={-15} textAnchor="end" tick={{ fontSize: 11 }} interval={0} />
              <YAxis tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} tick={{ fontSize: 11 }} />
              <RechartsTooltip
                formatter={(val: any) => [formatCurrency(Number(val)), 'Total Facturado']}
                contentStyle={{ borderRadius: '1rem', backgroundColor: '#131b2e', color: '#ffffff', border: 'none' }}
              />
              <Area
                type="monotone"
                dataKey="total"
                name="Ventas Totales"
                stroke={paletaActual.primario}
                strokeWidth={3}
                fillOpacity={1}
                fill={`url(#gradArea-${seccion.id})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'DONA':
        return (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <RechartsTooltip
                formatter={(val: any) => [formatCurrency(Number(val)), 'Facturación']}
                contentStyle={{ borderRadius: '1rem', backgroundColor: '#131b2e', color: '#ffffff', border: 'none' }}
              />
              <Legend verticalAlign="bottom" height={36} />
              <Pie
                data={datos}
                dataKey="total"
                nameKey="nombre"
                cx="50%"
                cy="48%"
                innerRadius={65}
                outerRadius={105}
                paddingAngle={3}
              >
                {datos.map((_, index) => (
                  <Cell
                    key={`donut-${seccion.id}-${index}`}
                    fill={paletaActual.colores[index % paletaActual.colores.length]}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        );

      case 'PIE':
        return (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <RechartsTooltip
                formatter={(val: any) => [formatCurrency(Number(val)), 'Facturación']}
                contentStyle={{ borderRadius: '1rem', backgroundColor: '#131b2e', color: '#ffffff', border: 'none' }}
              />
              <Legend verticalAlign="bottom" height={36} />
              <Pie
                data={datos}
                dataKey="total"
                nameKey="nombre"
                cx="50%"
                cy="48%"
                outerRadius={100}
              >
                {datos.map((_, index) => (
                  <Cell
                    key={`pie-${seccion.id}-${index}`}
                    fill={paletaActual.colores[index % paletaActual.colores.length]}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        );

      case 'BARRAS_APILADAS':
        return (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={datos} margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
              <XAxis dataKey="nombre" angle={-15} textAnchor="end" tick={{ fontSize: 11 }} interval={0} />
              <YAxis tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} tick={{ fontSize: 11 }} />
              <RechartsTooltip
                formatter={(val: any, name: any) => [formatCurrency(Number(val)), name]}
                contentStyle={{ borderRadius: '1rem', backgroundColor: '#131b2e', color: '#ffffff', border: 'none' }}
              />
              <Legend verticalAlign="top" height={32} />
              <Bar dataKey="subtotal" name="Subtotal Neto" stackId="stackA" fill={paletaActual.primario} />
              <Bar dataKey="impuestos" name="IVA 16%" stackId="stackA" fill={paletaActual.acento} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'BARRAS':
      default:
        return (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={datos} margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
              <XAxis dataKey="nombre" angle={-15} textAnchor="end" tick={{ fontSize: 11 }} interval={0} />
              <YAxis tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} tick={{ fontSize: 11 }} />
              <RechartsTooltip
                formatter={(val: any) => [formatCurrency(Number(val)), 'Total Facturado']}
                contentStyle={{ borderRadius: '1rem', backgroundColor: '#131b2e', color: '#ffffff', border: 'none' }}
              />
              <Bar dataKey="total" radius={[8, 8, 0, 0]}>
                {datos.map((_, index) => (
                  <Cell
                    key={`bar-${seccion.id}-${index}`}
                    fill={paletaActual.colores[index % paletaActual.colores.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );
    }
  };

  // RENDERIZADO DINÁMICO DE CADA SECCIÓN POR TIPO
  const renderSeccion = (seccion: SeccionReporte, idxSeccion: number) => {
    switch (seccion.tipo) {
      case 'KPIS':
        return (
          <div
            key={seccion.id}
            className="p-5 md:p-6 rounded-3xl bg-surface-container-low border border-surface-container-high/60 space-y-4 shadow-xs"
          >
            <div className="flex items-center justify-between pb-2 border-b border-surface-container-high/40">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: paletaActual.primario }} />
                <h3 className="font-title-md font-bold text-sm md:text-base text-on-surface">
                  {seccion.titulo || `Sección ${idxSeccion + 1}: Tarjetas de Métricas & KPIs`}
                </h3>
              </div>
              <span className="text-[11px] text-outline font-medium">
                {seccion.subtitulo || 'Métricas consolidadas del período'}
              </span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              {/* Ventas Netas */}
              <div
                className="p-4 rounded-2xl bg-surface-container border border-surface-container-high/60 relative overflow-hidden"
                style={{ borderLeft: `4px solid ${paletaActual.primario}` }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-label-caps text-[10px] uppercase font-bold text-outline tracking-wider">
                    Ventas Netas
                  </span>
                  <span className="p-1.5 rounded-xl text-white shadow-xs" style={{ backgroundColor: paletaActual.primario }}>
                    <DollarSign className="w-3.5 h-3.5" />
                  </span>
                </div>
                <div className="font-headline-md text-xl md:text-2xl font-black text-on-surface">
                  {formatCurrency(kpisGlobales.ingresosNetos)}
                </div>
                <div className="mt-1 flex items-center gap-1 text-[11px] text-outline">
                  <TrendingUp className="w-3 h-3 text-primary" />
                  <span>Facturación total</span>
                </div>
              </div>

              {/* Margen Bruto */}
              <div
                className="p-4 rounded-2xl bg-surface-container border border-surface-container-high/60 relative overflow-hidden"
                style={{ borderLeft: `4px solid ${paletaActual.secundario}` }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-label-caps text-[10px] uppercase font-bold text-outline tracking-wider">
                    Margen de Utilidad
                  </span>
                  <span className="p-1.5 rounded-xl text-white shadow-xs" style={{ backgroundColor: paletaActual.secundario }}>
                    <Percent className="w-3.5 h-3.5" />
                  </span>
                </div>
                <div className="font-headline-md text-xl md:text-2xl font-black text-on-surface">
                  {formatNumber(kpisGlobales.margenBrutoPct, 1)}%
                </div>
                <div className="mt-1 text-[11px] font-medium" style={{ color: paletaActual.secundario }}>
                  Utilidad: {formatCurrency(kpisGlobales.margenBrutoTotal)}
                </div>
              </div>

              {/* Ticket Promedio */}
              <div
                className="p-4 rounded-2xl bg-surface-container border border-surface-container-high/60 relative overflow-hidden"
                style={{ borderLeft: `4px solid ${paletaActual.acento}` }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-label-caps text-[10px] uppercase font-bold text-outline tracking-wider">
                    Ticket Promedio
                  </span>
                  <span className="p-1.5 rounded-xl text-white shadow-xs" style={{ backgroundColor: paletaActual.acento }}>
                    <Receipt className="w-3.5 h-3.5" />
                  </span>
                </div>
                <div className="font-headline-md text-xl md:text-2xl font-black text-on-surface">
                  {formatCurrency(kpisGlobales.ticketPromedio)}
                </div>
                <div className="mt-1 text-[11px] text-outline">Por transacción</div>
              </div>

              {/* Transacciones */}
              <div
                className="p-4 rounded-2xl bg-surface-container border border-surface-container-high/60 relative overflow-hidden"
                style={{ borderLeft: `4px solid ${paletaActual.primario}` }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-label-caps text-[10px] uppercase font-bold text-outline tracking-wider">
                    Operaciones
                  </span>
                  <span className="p-1.5 rounded-xl bg-surface-container-high text-on-surface shadow-xs">
                    <ShoppingBag className="w-3.5 h-3.5" />
                  </span>
                </div>
                <div className="font-headline-md text-xl md:text-2xl font-black text-on-surface">
                  {kpisGlobales.transaccionesTotales.toLocaleString()}
                </div>
                <div className="mt-1 flex items-center gap-1 text-[11px] text-outline">
                  <Hash className="w-3 h-3" />
                  <span>{kpisGlobales.unidadesVendidas.toLocaleString()} unidades vendidas</span>
                </div>
              </div>
            </div>
          </div>
        );

      case 'DISTRIBUCION_RANKING': {
        const ranking = obtenerDatosRanking(seccion.dimensionRanking || 'PRODUCTO', seccion.limiteItems || 6);
        return (
          <div
            key={seccion.id}
            className="p-5 md:p-6 rounded-3xl bg-surface-container-low border border-surface-container-high/60 space-y-4 shadow-xs"
          >
            <div className="flex items-center justify-between pb-2 border-b border-surface-container-high/40">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4" style={{ color: paletaActual.primario }} />
                <h3 className="font-title-md font-bold text-sm md:text-base text-on-surface">
                  {seccion.titulo || `Sección ${idxSeccion + 1}: Ranking & Participación Comercial`}
                </h3>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full font-label-caps text-[10px] font-bold border ${paletaActual.claseBadge}`}>
                Top {ranking.length} {seccion.dimensionRanking || 'PRODUCTOS'}
              </span>
            </div>

            {seccion.subtitulo && (
              <p className="text-xs text-on-surface-variant -mt-2">{seccion.subtitulo}</p>
            )}

            <div className="space-y-3.5 pt-1">
              {ranking.map((item, idx) => (
                <div key={item.nombre} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold bg-surface-container-highest text-on-surface shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-on-surface truncate">{item.nombre}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-outline font-mono">{formatCurrency(item.total)}</span>
                      <span className="font-bold text-primary w-12 text-right">{item.porcentaje}%</span>
                    </div>
                  </div>

                  {/* Barra visual de progreso */}
                  <div className="h-2.5 w-full rounded-full bg-surface-container-highest/60 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500 shadow-xs"
                      style={{
                        width: `${Math.min(100, Math.max(4, item.porcentaje))}%`,
                        backgroundColor: paletaActual.colores[idx % paletaActual.colores.length]
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      }

      case 'CANALES_PAGO': {
        const canales = obtenerDatosCanalesPago();
        return (
          <div
            key={seccion.id}
            className="p-5 md:p-6 rounded-3xl bg-surface-container-low border border-surface-container-high/60 space-y-4 shadow-xs"
          >
            <div className="flex items-center justify-between pb-2 border-b border-surface-container-high/40">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" style={{ color: paletaActual.primario }} />
                <h3 className="font-title-md font-bold text-sm md:text-base text-on-surface">
                  {seccion.titulo || `Sección ${idxSeccion + 1}: Canales de Cobro & Métodos de Pago`}
                </h3>
              </div>
              <span className="text-[11px] text-outline font-mono">Arqueo de Recaudo</span>
            </div>

            {seccion.subtitulo && (
              <p className="text-xs text-on-surface-variant -mt-2">{seccion.subtitulo}</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {canales.map((canal) => (
                <div
                  key={canal.key}
                  className="p-4 rounded-2xl bg-surface-container border border-surface-container-high/60 space-y-2 relative overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-title-md text-xs font-bold text-on-surface">
                      {canal.label}
                    </span>
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                      style={{
                        backgroundColor: `${canal.color}20`,
                        color: canal.color
                      }}
                    >
                      {canal.porcentaje}%
                    </span>
                  </div>

                  <div className="font-headline-md text-xl font-black text-on-surface">
                    {formatCurrency(canal.total)}
                  </div>

                  <div className="text-[11px] text-outline">
                    {canal.tickets} tickets procesados
                  </div>

                  {/* Medidor visual */}
                  <div className="h-1.5 w-full rounded-full bg-surface-container-highest overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${canal.porcentaje}%`,
                        backgroundColor: canal.color
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      }

      case 'COMPARATIVA_DUAL': {
        const datosTendencia = obtenerDatosGrafico('DIA', 10);
        const datosCategoria = obtenerDatosGrafico('CATEGORIA', 5);
        return (
          <div
            key={seccion.id}
            className="p-5 md:p-6 rounded-3xl bg-surface-container-low border border-surface-container-high/60 space-y-4 shadow-xs"
          >
            <div className="flex items-center justify-between pb-2 border-b border-surface-container-high/40">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4" style={{ color: paletaActual.primario }} />
                <h3 className="font-title-md font-bold text-sm md:text-base text-on-surface">
                  {seccion.titulo || `Sección ${idxSeccion + 1}: Comparativa Dual Dinámica`}
                </h3>
              </div>
              <span className="text-xs text-outline">Comportamiento Cruzado</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Lado A: Línea temporal */}
              <div className="p-3 rounded-2xl bg-surface-container border border-surface-container-high/40">
                <div className="text-xs font-bold text-on-surface mb-2 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-primary" />
                  <span>Evolución Temporal de Ventas</span>
                </div>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={datosTendencia} margin={{ top: 5, right: 10, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                      <XAxis dataKey="nombre" angle={-15} textAnchor="end" tick={{ fontSize: 10 }} interval={0} />
                      <YAxis tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} tick={{ fontSize: 10 }} />
                      <RechartsTooltip formatter={(val: any) => [formatCurrency(Number(val)), 'Total']} />
                      <Area type="monotone" dataKey="total" stroke={paletaActual.primario} fill={paletaActual.acento} fillOpacity={0.3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Lado B: Dona por Categorías */}
              <div className="p-3 rounded-2xl bg-surface-container border border-surface-container-high/40">
                <div className="text-xs font-bold text-on-surface mb-2 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-secondary" />
                  <span>Participación por Categoría</span>
                </div>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <RechartsTooltip formatter={(val: any) => [formatCurrency(Number(val)), 'Total']} />
                      <Legend verticalAlign="bottom" height={28} iconSize={8} />
                      <Pie data={datosCategoria} dataKey="total" nameKey="nombre" cx="50%" cy="45%" innerRadius={45} outerRadius={70}>
                        {datosCategoria.map((_, i) => (
                          <Cell key={`dual-${i}`} fill={paletaActual.colores[i % paletaActual.colores.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        );
      }

      case 'INTELIGENCIA_CLIENTES': {
        const metricas = obtenerMetricasClientes();
        return (
          <div
            key={seccion.id}
            className="p-5 md:p-6 rounded-3xl bg-surface-container-low border border-surface-container-high/60 space-y-4 shadow-xs"
          >
            <div className="flex items-center justify-between pb-2 border-b border-surface-container-high/40">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" style={{ color: paletaActual.primario }} />
                <h3 className="font-title-md font-bold text-sm md:text-base text-on-surface">
                  {seccion.titulo || `Sección ${idxSeccion + 1}: Inteligencia & Cartera de Clientes`}
                </h3>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full font-label-caps text-[10px] font-bold border ${paletaActual.claseBadge}`}>
                {metricas.totalClientes} Clientes Registrados
              </span>
            </div>

            {seccion.subtitulo && (
              <p className="text-xs text-on-surface-variant -mt-2">{seccion.subtitulo}</p>
            )}

            {/* 4 Tarjetas de Métricas de Clientes */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-surface-container border border-surface-container-high/60">
                <span className="text-[10px] font-bold uppercase font-label-caps text-outline">Clientes Únicos</span>
                <div className="font-headline-md text-xl font-black text-on-surface mt-1">
                  {metricas.totalClientes}
                </div>
                <div className="text-[11px] text-outline mt-0.5">En el período auditado</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-surface-container border border-surface-container-high/60">
                <span className="text-[10px] font-bold uppercase font-label-caps text-outline">Gasto Promedio (LTV)</span>
                <div className="font-headline-md text-xl font-black text-on-surface mt-1">
                  {formatCurrency(metricas.gastoPromedio)}
                </div>
                <div className="text-[11px] text-outline mt-0.5">Por comprador activo</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-surface-container border border-surface-container-high/60">
                <span className="text-[10px] font-bold uppercase font-label-caps text-outline">Frecuencia Media</span>
                <div className="font-headline-md text-xl font-black text-on-surface mt-1">
                  {metricas.ticketsPromedioPorCliente}
                </div>
                <div className="text-[11px] text-outline mt-0.5">Tickets por comprador</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-surface-container border border-surface-container-high/60">
                <span className="text-[10px] font-bold uppercase font-label-caps text-outline">Cliente Principal</span>
                <div className="font-headline-md text-xs font-black text-primary mt-1 truncate" title={metricas.clienteLider.nombre}>
                  {metricas.clienteLider.nombre}
                </div>
                <div className="text-[11px] text-outline mt-0.5">
                  {formatCurrency(metricas.clienteLider.total)} ({metricas.clienteLider.porcentaje}%)
                </div>
              </div>
            </div>

            {/* Top Compradores con barras de progreso */}
            <div className="pt-2 space-y-2.5">
              <div className="text-xs font-bold text-on-surface flex items-center justify-between">
                <span>Top Compradores de Mayor Facturación</span>
                <span className="text-[11px] text-outline">Aporte Porcentual</span>
              </div>
              {metricas.topClientes.map((cli, idx) => (
                <div key={cli.nombre} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold bg-surface-container-highest text-on-surface shrink-0">
                        #{idx + 1}
                      </span>
                      <span className="text-on-surface truncate">{cli.nombre}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-outline font-mono">{formatCurrency(cli.total)}</span>
                      <span className="font-bold text-primary w-12 text-right">{cli.porcentaje}%</span>
                    </div>
                  </div>
                  <div className="h-2 w-full rounded-full bg-surface-container-highest overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, Math.max(4, cli.porcentaje))}%`,
                        backgroundColor: paletaActual.colores[idx % paletaActual.colores.length]
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      }

      case 'GRAFICO':
      default:
        return (
          <div
            key={seccion.id}
            className="p-5 md:p-6 rounded-3xl bg-surface-container-low border border-surface-container-high/60 space-y-3 shadow-xs"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-surface-container-high/40">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" style={{ color: paletaActual.primario }} />
                <h3 className="font-title-md font-bold text-sm md:text-base text-on-surface">
                  {seccion.titulo || `Sección ${idxSeccion + 1}: Gráfico de ${seccion.tipoGrafico || 'Barras'}`}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full font-label-caps text-[10px] font-bold border ${paletaActual.claseBadge}`}>
                  Por {seccion.dimensionAgrupacion || 'CATEGORIA'}
                </span>
              </div>
            </div>

            {seccion.subtitulo && (
              <p className="text-xs text-on-surface-variant -mt-1">{seccion.subtitulo}</p>
            )}

            <div className="w-full pt-2">
              {renderGraficoRecharts(seccion)}
            </div>
          </div>
        );
    }
  };

  return (
    <div
      id="reporte-preview-container"
      className={`relative w-full rounded-3xl transition-all duration-200 bg-surface-container-lowest text-on-surface border shadow-sm p-6 md:p-8 space-y-6 print:m-0 print:p-0 print:border-none print:shadow-none print:bg-white print:text-black print:rounded-none ${paletaActual.bordePreview}`}
      style={{ minHeight: '600px' }}
    >
      {/* Indicador de recálculo */}
      {cargando && (
        <div className="absolute inset-0 bg-surface/50 backdrop-blur-[2px] z-20 rounded-3xl flex items-center justify-center print:hidden">
          <div className="flex items-center gap-3 px-5 py-2.5 rounded-full bg-surface-container-high border border-surface-container-highest shadow-lg">
            <span className="w-2.5 h-2.5 rounded-full animate-ping" style={{ backgroundColor: paletaActual.primario }} />
            <span className="font-title-md text-xs font-bold text-on-surface">
              Actualizando reporte en tiempo real…
            </span>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 1. CABECERA & MEMBRETE CORPORATIVO OFICIAL                */}
      {/* ========================================================= */}
      <div className="pb-6 border-b border-surface-container-high/60 space-y-4">
        {/* Barra superior de acento con gradiente de la paleta */}
        <div
          className="h-1.5 w-full rounded-full transition-all duration-300"
          style={{
            background: `linear-gradient(90deg, ${paletaActual.primario} 0%, ${paletaActual.secundario} 50%, ${paletaActual.acento} 100%)`
          }}
        />

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          {/* Logo y Nombre de Empresa */}
          <div className="flex items-center gap-3.5">
            {mostrarLogo && (
              <div className="flex items-center justify-center p-2 rounded-2xl bg-surface-container-low border border-surface-container-high/60 shadow-xs">
                <img
                  src="/quantix_logo.png"
                  alt="Quantix Retail OS"
                  className="h-9 w-auto max-w-[120px] object-contain"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-headline-sm text-base md:text-lg font-extrabold tracking-tight text-on-surface">
                  QUANTIX RETAIL OS
                </span>
                <span className={`px-2 py-0.5 rounded-md font-label-caps text-[10px] font-bold border ${paletaActual.claseBadge}`}>
                  DuckDB Gold OLAP
                </span>
              </div>
              <p className="font-body-xs text-[11px] text-outline font-medium">
                Inteligencia Comercial • Auditoría & Control de Gestión
              </p>
            </div>
          </div>

          {/* Metadatos de Auditoría y Sucursal */}
          <div className="flex flex-wrap md:flex-col items-start md:items-end gap-1.5 text-[11px] text-on-surface-variant font-mono">
            <div className="flex items-center gap-1.5">
              <span className="text-outline font-sans font-semibold">Folio:</span>
              <span className="font-bold text-on-surface px-1.5 py-0.5 rounded bg-surface-container-low border border-surface-container-high/40">
                {folioReporte}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-outline" />
              <span className="font-semibold text-on-surface">{nombreSucursal}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-outline" />
              <span>{rangoFechaLabel}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-outline" />
              <span>Emite: {nombreOperador}</span>
              <span className="text-outline">•</span>
              <span>{fechaEmision}</span>
            </div>
          </div>
        </div>

        {/* Título y Subtítulo del Reporte */}
        <div className="pt-2">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: paletaActual.primario }} />
            <h1 className="font-headline-lg text-2xl md:text-3xl font-black text-on-surface tracking-tight">
              {tituloReporte || 'Reporte Personalizado Modular'}
            </h1>
          </div>
          {subtituloReporte && (
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
              {subtituloReporte}
            </p>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. RENDERIZADO DINÁMICO DE SECCIONES EN CASCADA           */}
      {/* ========================================================= */}
      <div className="space-y-6">
        {secciones.length === 0 ? (
          <div className="py-16 text-center rounded-3xl bg-surface-container-low border-2 border-dashed border-surface-container-high p-8 space-y-3">
            <Sparkles className="w-8 h-8 text-primary mx-auto opacity-60" />
            <h4 className="font-title-md font-bold text-base text-on-surface">
              Reporte sin secciones activas
            </h4>
            <p className="text-xs text-outline max-w-sm mx-auto">
              Utiliza el botón <strong>[+ Agregar Sección]</strong> en el panel lateral para añadir gráficos, KPIs o rankings.
            </p>
          </div>
        ) : (
          secciones.map((seccion, idx) => renderSeccion(seccion, idx))
        )}
      </div>

      {/* ========================================================= */}
      {/* 3. PIE DE PÁGINA & SELLO FORMAL DE AUDITORÍA              */}
      {/* ========================================================= */}
      <div className="mt-8 pt-4 border-t border-surface-container-high/60 flex flex-col md:flex-row md:items-center justify-between gap-3 text-[11px] text-outline">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <span>
            Documento procesado con motor analítico <strong>DuckDB Gold OLAP</strong> de Quantix Retail OS.
          </span>
        </div>
        <div className="font-mono text-[10px] text-right">
          ID: {folioReporte} • {fechaEmision} • Confidencial • {secciones.length} secciones
        </div>
      </div>
    </div>
  );
}
