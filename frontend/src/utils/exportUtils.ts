/**
 * Utilidad universal para exportación de datos a CSV / Excel compatible.
 * Incorpora BOM UTF-8 (\uFEFF) para visualización nativa de acentos y caracteres
 * especiales en Microsoft Excel y procesadores de hojas de cálculo en Windows.
 */

export interface ExportColumn<T = any> {
  key?: keyof T | string;
  header: string;
  formatter?: (value: any, item: T) => string | number;
}

/**
 * Formatea valores numéricos a formato decimal estándar
 */
export const formatNumber = (val: number | null | undefined, decimals = 2): string => {
  if (val === null || val === undefined || isNaN(Number(val))) return '0.00';
  return Number(val).toFixed(decimals);
};

/**
 * Formatea valores de moneda para hojas de cálculo
 */
export const formatCurrency = (val: number | null | undefined): string => {
  if (val === null || val === undefined || isNaN(Number(val))) return '$0.00';
  return `$${Number(val).toFixed(2)}`;
};

/**
 * Formatea fechas a formato estándar ISO / legible YYYY-MM-DD HH:mm:ss
 */
export const formatDate = (val: string | Date | null | undefined): string => {
  if (!val) return 'N/A';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const min = pad(d.getMinutes());
    const ss = pad(d.getSeconds());
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
  } catch {
    return String(val);
  }
};

/**
 * Formatea booleanos a texto amigable
 */
export const formatBoolean = (val: boolean | null | undefined, trueLabel = 'Sí', falseLabel = 'No'): string => {
  return val ? trueLabel : falseLabel;
};

/**
 * Escapa valores para respetar el formato CSV RFC 4180
 */
const escapeCSVValue = (val: any): string => {
  if (val === null || val === undefined) return '';
  const str = String(val);
  // Si contiene comas, comillas dobles, retornos de carro o saltos de línea, envolver en comillas y doblar comillas
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export interface ExportOptions<T = any> {
  filename: string;
  data: T[];
  columns?: ExportColumn<T>[];
}

/**
 * Exporta un arreglo de datos a un archivo CSV descargable en el navegador.
 */
export function exportToCSV<T extends Record<string, any>>({
  filename,
  data,
  columns,
}: ExportOptions<T>): void {
  if (!data || data.length === 0) {
    alert('No hay datos disponibles para exportar.');
    return;
  }

  // Si no se especifican columnas, se infieren automáticamente de las llaves del primer objeto
  const cols: ExportColumn<T>[] = columns && columns.length > 0
    ? columns
    : Object.keys(data[0]).map((key) => ({
        key: key as keyof T,
        header: key.toUpperCase().replace(/_/g, ' '),
      }));

  // Construcción de la fila de encabezados
  const headerRow = cols.map((col) => escapeCSVValue(col.header)).join(',');

  // Construcción de las filas de datos
  const rows = data.map((item) => {
    return cols.map((col) => {
      let rawVal: any;
      if (typeof col.key === 'string' && col.key.includes('.')) {
        // Soporte para propiedades anidadas (ej. "cliente.nombre")
        rawVal = col.key.split('.').reduce((obj, key) => obj?.[key], item);
      } else if (col.key !== undefined) {
        rawVal = item[col.key as keyof T];
      } else {
        rawVal = item;
      }

      const formattedVal = col.formatter ? col.formatter(rawVal, item) : rawVal;
      return escapeCSVValue(formattedVal);
    }).join(',');
  });

  // Prefijo BOM UTF-8 (\uFEFF) para compatibilidad con Microsoft Excel
  const csvContent = '\uFEFF' + [headerRow, ...rows].join('\r\n');

  // Creación del Blob y descarga
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  // Limpieza de extensión en el nombre del archivo
  const cleanFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  link.setAttribute('href', url);
  link.setAttribute('download', cleanFilename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ============================================================================
// EXPORTACIÓN EJECUTIVA PARA EXCEL / CSV DEL REPORTE PERSONALIZADO (PREVIEW)
// ============================================================================

import {
  type FilaReporteVenta,
  type SeccionReporte,
  type PaletaColor,
  type TipoAgrupacion,
  PALETAS_CONFIG,
} from '../types/reportes';

export interface ExportarReporteExcelParams {
  filename: string;
  tituloReporte: string;
  subtituloReporte: string;
  nombreSucursal: string;
  nombreOperador: string;
  rangoFechaLabel: string;
  folioReporte: string;
  fechaEmision: string;
  paleta: PaletaColor;
  secciones: SeccionReporte[];
  ventas: FilaReporteVenta[];
}

export const calcularKpisReporte = (ventas: FilaReporteVenta[]) => {
  const ingresosNetos = ventas.reduce((acc, r) => acc + (r.total || 0), 0);
  const subtotal = ventas.reduce((acc, r) => acc + (r.subtotal || 0), 0);
  const margen = ventas.reduce((acc, r) => acc + (r.margen_ganancia || 0), 0);
  const unidades = ventas.reduce((acc, r) => acc + (r.cantidad || 0), 0);
  const ticketsSet = new Set(ventas.map((r) => r.folio_ticket));
  const transacciones = ticketsSet.size;

  const margenPct = subtotal > 0 ? (margen / subtotal) * 100 : 0;
  const ticketPromedio = transacciones > 0 ? ingresosNetos / transacciones : 0;

  return {
    ingresosNetos,
    subtotal,
    margen,
    unidades,
    transacciones,
    margenPct,
    ticketPromedio,
  };
};

export const agruparVentasPorDimension = (
  ventas: FilaReporteVenta[],
  dimension: TipoAgrupacion = 'CATEGORIA',
  limite = 15
) => {
  const mapa: Record<string, { nombre: string; total: number; margen: number; subtotal: number; cantidad: number }> = {};
  ventas.forEach((v) => {
    let clave = '';
    switch (dimension) {
      case 'DIA': clave = v.fecha ? v.fecha.split('T')[0] : 'Sin fecha'; break;
      case 'PRODUCTO': clave = v.producto_nombre || 'Sin producto'; break;
      case 'CATEGORIA': clave = v.categoria_nombre || 'Sin categoría'; break;
      case 'CLIENTE': clave = v.cliente_nombre || 'Cliente Ocasional'; break;
      case 'CAJERO': clave = v.cajero_nombre || 'Sin cajero'; break;
      case 'METODO_PAGO': clave = v.metodo_pago || 'EFECTIVO'; break;
      default: clave = v.categoria_nombre || 'Varios';
    }
    if (!mapa[clave]) {
      mapa[clave] = { nombre: clave, total: 0, margen: 0, subtotal: 0, cantidad: 0 };
    }
    mapa[clave].total += v.total || 0;
    mapa[clave].margen += v.margen_ganancia || 0;
    mapa[clave].subtotal += v.subtotal || 0;
    mapa[clave].cantidad += v.cantidad || 0;
  });

  return Object.values(mapa)
    .map((item) => ({
      ...item,
      total: Number(item.total.toFixed(2)),
      margen: Number(item.margen.toFixed(2)),
      subtotal: Number(item.subtotal.toFixed(2)),
    }))
    .sort((a, b) => (dimension === 'DIA' ? a.nombre.localeCompare(b.nombre) : b.total - a.total))
    .slice(0, limite);
};

export const calcularCanalesPagoReporte = (ventas: FilaReporteVenta[], totalGeneral: number) => {
  const canales = [
    { key: 'EFECTIVO', label: 'Efectivo' },
    { key: 'TARJETA', label: 'Tarjeta Bancaria' },
    { key: 'QR_DEUNA', label: 'QR DeUna' },
  ];
  const totalMax = totalGeneral > 0 ? totalGeneral : 1;
  return canales.map((c) => {
    const vCanal = ventas.filter((v) => v.metodo_pago === c.key);
    const total = vCanal.reduce((acc, v) => acc + v.total, 0);
    const tickets = new Set(vCanal.map((v) => v.folio_ticket)).size;
    const porcentaje = Number(((total / totalMax) * 100).toFixed(1));
    return { key: c.key, label: c.label, total, tickets, porcentaje };
  });
};

export const calcularMetricasClientesReporte = (
  ventas: FilaReporteVenta[],
  totalGeneral: number,
  totalTransacciones: number
) => {
  const clientesSet = new Set(ventas.map((v) => v.cliente_nombre));
  const totalClientes = clientesSet.size;
  const gastoPromedio = totalClientes > 0 ? totalGeneral / totalClientes : 0;
  const ticketsPromedio = totalClientes > 0 ? Number((totalTransacciones / totalClientes).toFixed(1)) : 0;

  const ranking = agruparVentasPorDimension(ventas, 'CLIENTE', 10).map((c) => ({
    nombre: c.nombre,
    total: c.total,
    porcentaje: totalGeneral > 0 ? Number(((c.total / totalGeneral) * 100).toFixed(1)) : 0,
  }));

  const clienteLider = ranking[0] || { nombre: 'N/A', total: 0, porcentaje: 0 };
  return { totalClientes, gastoPromedio, ticketsPromedio, clienteLider, topClientes: ranking };
};

/**
 * Exporta exclusivamente el reporte configurado en la vista previa a un libro de Microsoft Excel (.xls)
 * con membrete institucional, colores corporativos y secciones ejecutivas sin tablas de tickets crudas.
 */
export function exportarReporteExcel({
  filename,
  tituloReporte,
  subtituloReporte,
  nombreSucursal,
  nombreOperador,
  rangoFechaLabel,
  folioReporte,
  fechaEmision,
  paleta,
  secciones,
  ventas,
}: ExportarReporteExcelParams): void {
  const paletaDef = PALETAS_CONFIG[paleta] || PALETAS_CONFIG.QUANTIX;
  const primaryColor = paletaDef.primario || '#006c49';
  const secondaryColor = paletaDef.secundario || '#10b981';

  const kpis = calcularKpisReporte(ventas);
  const totalMax = kpis.ingresosNetos > 0 ? kpis.ingresosNetos : 1;

  let seccionesHtml = '';

  secciones.forEach((sec, idx) => {
    seccionesHtml += `
      <tr><td colspan="4" style="height: 14px;"></td></tr>
      <tr style="background-color: ${primaryColor}; color: #ffffff;">
        <th colspan="4" style="text-align: left; padding: 7px 10px; font-size: 11pt; font-weight: bold;">
          Sección ${idx + 1}: ${sec.titulo || sec.tipo}
        </th>
      </tr>
    `;

    if (sec.subtitulo) {
      seccionesHtml += `
        <tr style="background-color: #f8fafc; color: #64748b; font-style: italic; font-size: 9pt;">
          <td colspan="4" style="padding: 4px 10px;">${sec.subtitulo}</td>
        </tr>
      `;
    }

    switch (sec.tipo) {
      case 'KPIS': {
        seccionesHtml += `
          <tr style="background-color: #f1f5f9; font-weight: bold; font-size: 9pt;">
            <th style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: left;">Métrica C-Level</th>
            <th style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: right;">Valor</th>
            <th colspan="2" style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: left;">Detalle de Auditoría</th>
          </tr>
          <tr>
            <td style="border: 1px solid #e2e8f0; padding: 5px 10px; font-weight: bold;">Ventas Netas</td>
            <td style="border: 1px solid #e2e8f0; padding: 5px 10px; text-align: right; font-weight: bold; color: ${primaryColor};">${formatCurrency(kpis.ingresosNetos)}</td>
            <td colspan="2" style="border: 1px solid #e2e8f0; padding: 5px 10px; color: #475569;">Facturación total consolidada</td>
          </tr>
          <tr>
            <td style="border: 1px solid #e2e8f0; padding: 5px 10px; font-weight: bold;">Margen de Utilidad</td>
            <td style="border: 1px solid #e2e8f0; padding: 5px 10px; text-align: right; font-weight: bold; color: ${secondaryColor};">${formatNumber(kpis.margenPct, 1)}%</td>
            <td colspan="2" style="border: 1px solid #e2e8f0; padding: 5px 10px; color: #475569;">Ganancia bruta: ${formatCurrency(kpis.margen)}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #e2e8f0; padding: 5px 10px; font-weight: bold;">Ticket Promedio</td>
            <td style="border: 1px solid #e2e8f0; padding: 5px 10px; text-align: right; font-weight: bold;">${formatCurrency(kpis.ticketPromedio)}</td>
            <td colspan="2" style="border: 1px solid #e2e8f0; padding: 5px 10px; color: #475569;">Gasto promedio por transacción</td>
          </tr>
          <tr>
            <td style="border: 1px solid #e2e8f0; padding: 5px 10px; font-weight: bold;">Transacciones Totales</td>
            <td style="border: 1px solid #e2e8f0; padding: 5px 10px; text-align: right; font-weight: bold;">${kpis.transacciones.toLocaleString()}</td>
            <td colspan="2" style="border: 1px solid #e2e8f0; padding: 5px 10px; color: #475569;">Tickets emitidos y cobrados</td>
          </tr>
          <tr>
            <td style="border: 1px solid #e2e8f0; padding: 5px 10px; font-weight: bold;">Unidades Comercializadas</td>
            <td style="border: 1px solid #e2e8f0; padding: 5px 10px; text-align: right; font-weight: bold;">${kpis.unidades.toLocaleString()}</td>
            <td colspan="2" style="border: 1px solid #e2e8f0; padding: 5px 10px; color: #475569;">Volumen de artículos en período</td>
          </tr>
        `;
        break;
      }

      case 'DISTRIBUCION_RANKING': {
        const dim = sec.dimensionRanking || 'PRODUCTO';
        const limite = sec.limiteItems || 6;
        const ranking = agruparVentasPorDimension(ventas, dim, limite).map((item) => ({
          ...item,
          porcentaje: Number(((item.total / totalMax) * 100).toFixed(1)),
        }));

        seccionesHtml += `
          <tr style="background-color: #f1f5f9; font-weight: bold; font-size: 9pt;">
            <th style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: center; width: 40px;">#</th>
            <th style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: left;">Elemento (${dim})</th>
            <th style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: right;">Facturación Total</th>
            <th style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: right;">Participación %</th>
          </tr>
        `;

        ranking.forEach((item, i) => {
          seccionesHtml += `
            <tr>
              <td style="border: 1px solid #e2e8f0; padding: 5px 10px; text-align: center; font-weight: bold;">${i + 1}</td>
              <td style="border: 1px solid #e2e8f0; padding: 5px 10px;">${item.nombre}</td>
              <td style="border: 1px solid #e2e8f0; padding: 5px 10px; text-align: right; font-weight: bold;">${formatCurrency(item.total)}</td>
              <td style="border: 1px solid #e2e8f0; padding: 5px 10px; text-align: right; font-weight: bold; color: ${primaryColor};">${item.porcentaje}%</td>
            </tr>
          `;
        });
        break;
      }

      case 'INTELIGENCIA_CLIENTES': {
        const cliMetricas = calcularMetricasClientesReporte(ventas, kpis.ingresosNetos, kpis.transacciones);

        seccionesHtml += `
          <tr style="background-color: #f1f5f9; font-weight: bold; font-size: 9pt;">
            <th style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: left;">Indicador de Cartera</th>
            <th style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: right;">Resultado</th>
            <th colspan="2" style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: left;">Contexto</th>
          </tr>
          <tr>
            <td style="border: 1px solid #e2e8f0; padding: 5px 10px; font-weight: bold;">Clientes Únicos Registrados</td>
            <td style="border: 1px solid #e2e8f0; padding: 5px 10px; text-align: right; font-weight: bold;">${cliMetricas.totalClientes}</td>
            <td colspan="2" style="border: 1px solid #e2e8f0; padding: 5px 10px; color: #475569;">Total de compradores activos</td>
          </tr>
          <tr>
            <td style="border: 1px solid #e2e8f0; padding: 5px 10px; font-weight: bold;">Gasto Promedio por Cliente (LTV)</td>
            <td style="border: 1px solid #e2e8f0; padding: 5px 10px; text-align: right; font-weight: bold; color: ${primaryColor};">${formatCurrency(cliMetricas.gastoPromedio)}</td>
            <td colspan="2" style="border: 1px solid #e2e8f0; padding: 5px 10px; color: #475569;">Valor promedio de compra por cliente</td>
          </tr>
          <tr>
            <td style="border: 1px solid #e2e8f0; padding: 5px 10px; font-weight: bold;">Frecuencia Media de Compra</td>
            <td style="border: 1px solid #e2e8f0; padding: 5px 10px; text-align: right; font-weight: bold;">${cliMetricas.ticketsPromedio}</td>
            <td colspan="2" style="border: 1px solid #e2e8f0; padding: 5px 10px; color: #475569;">Tickets promedio por comprador</td>
          </tr>
          <tr>
            <td style="border: 1px solid #e2e8f0; padding: 5px 10px; font-weight: bold;">Cliente Principal</td>
            <td style="border: 1px solid #e2e8f0; padding: 5px 10px; text-align: right; font-weight: bold; color: ${primaryColor};">${formatCurrency(cliMetricas.clienteLider.total)}</td>
            <td colspan="2" style="border: 1px solid #e2e8f0; padding: 5px 10px; color: #475569;">${cliMetricas.clienteLider.nombre} (${cliMetricas.clienteLider.porcentaje}% de ingresos)</td>
          </tr>
          <tr style="background-color: #f8fafc; font-weight: bold; font-size: 9pt;">
            <th colspan="2" style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: left;">Top Compradores de Mayor Facturación</th>
            <th style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: right;">Facturación Total</th>
            <th style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: right;">Aporte % Cartera</th>
          </tr>
        `;

        cliMetricas.topClientes.slice(0, 5).forEach((cli, i) => {
          seccionesHtml += `
            <tr>
              <td colspan="2" style="border: 1px solid #e2e8f0; padding: 5px 10px;">${i + 1}. ${cli.nombre}</td>
              <td style="border: 1px solid #e2e8f0; padding: 5px 10px; text-align: right; font-weight: bold;">${formatCurrency(cli.total)}</td>
              <td style="border: 1px solid #e2e8f0; padding: 5px 10px; text-align: right; font-weight: bold; color: ${primaryColor};">${cli.porcentaje}%</td>
            </tr>
          `;
        });
        break;
      }

      case 'CANALES_PAGO': {
        const canales = calcularCanalesPagoReporte(ventas, kpis.ingresosNetos);
        seccionesHtml += `
          <tr style="background-color: #f1f5f9; font-weight: bold; font-size: 9pt;">
            <th style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: left;">Canal de Recaudo</th>
            <th style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: right;">Monto Liquidado</th>
            <th style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: right;">Tickets</th>
            <th style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: right;">Participación %</th>
          </tr>
        `;

        canales.forEach((canal) => {
          seccionesHtml += `
            <tr>
              <td style="border: 1px solid #e2e8f0; padding: 5px 10px; font-weight: bold;">${canal.label}</td>
              <td style="border: 1px solid #e2e8f0; padding: 5px 10px; text-align: right; font-weight: bold;">${formatCurrency(canal.total)}</td>
              <td style="border: 1px solid #e2e8f0; padding: 5px 10px; text-align: right;">${canal.tickets} tickets</td>
              <td style="border: 1px solid #e2e8f0; padding: 5px 10px; text-align: right; font-weight: bold; color: ${primaryColor};">${canal.porcentaje}%</td>
            </tr>
          `;
        });
        break;
      }

      case 'COMPARATIVA_DUAL': {
        const porDia = agruparVentasPorDimension(ventas, 'DIA', 8);
        const porCat = agruparVentasPorDimension(ventas, 'CATEGORIA', 5);

        seccionesHtml += `
          <tr style="background-color: #f1f5f9; font-weight: bold; font-size: 9pt;">
            <th colspan="2" style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: left;">Evolución Temporal Reciente</th>
            <th colspan="2" style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: left;">Distribución por Categorías</th>
          </tr>
        `;

        const maxRows = Math.max(porDia.length, porCat.length);
        for (let i = 0; i < maxRows; i++) {
          const d = porDia[i];
          const c = porCat[i];
          seccionesHtml += `
            <tr>
              <td style="border: 1px solid #e2e8f0; padding: 4px 8px;">${d ? d.nombre : ''}</td>
              <td style="border: 1px solid #e2e8f0; padding: 4px 8px; text-align: right; font-weight: bold;">${d ? formatCurrency(d.total) : ''}</td>
              <td style="border: 1px solid #e2e8f0; padding: 4px 8px;">${c ? c.nombre : ''}</td>
              <td style="border: 1px solid #e2e8f0; padding: 4px 8px; text-align: right; font-weight: bold; color: ${secondaryColor};">${c ? formatCurrency(c.total) : ''}</td>
            </tr>
          `;
        }
        break;
      }

      case 'GRAFICO':
      default: {
        const dim = sec.dimensionAgrupacion || 'CATEGORIA';
        const datos = agruparVentasPorDimension(ventas, dim, 12);

        seccionesHtml += `
          <tr style="background-color: #f1f5f9; font-weight: bold; font-size: 9pt;">
            <th style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: left;">Agrupación: ${dim}</th>
            <th style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: right;">Facturación Total</th>
            <th style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: right;">Margen de Ganancia</th>
            <th style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: right;">Unidades Vendidas</th>
          </tr>
        `;

        datos.forEach((d) => {
          seccionesHtml += `
            <tr>
              <td style="border: 1px solid #e2e8f0; padding: 5px 10px; font-weight: bold;">${d.nombre}</td>
              <td style="border: 1px solid #e2e8f0; padding: 5px 10px; text-align: right; font-weight: bold;">${formatCurrency(d.total)}</td>
              <td style="border: 1px solid #e2e8f0; padding: 5px 10px; text-align: right; color: ${secondaryColor}; font-weight: bold;">${formatCurrency(d.margen)}</td>
              <td style="border: 1px solid #e2e8f0; padding: 5px 10px; text-align: right;">${d.cantidad.toLocaleString()}</td>
            </tr>
          `;
        });
        break;
      }
    }
  });

  const htmlContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Reporte Ejecutivo</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        body { font-family: 'Segoe UI', Calibri, Arial, sans-serif; font-size: 10pt; }
        table { border-collapse: collapse; width: 100%; }
        th, td { font-family: 'Segoe UI', Calibri, Arial, sans-serif; }
      </style>
    </head>
    <body>
      <table>
        <!-- ENCABEZADO INSTITUCIONAL -->
        <tr>
          <td colspan="4" style="font-size: 16pt; font-weight: bold; color: ${primaryColor}; padding: 6px 0;">
            QUANTIX RETAIL OS — INFORME EJECUTIVO
          </td>
        </tr>
        <tr>
          <td colspan="4" style="font-size: 13pt; font-weight: bold; color: #1e293b;">
            ${tituloReporte || 'Reporte Personalizado Modular'}
          </td>
        </tr>
        ${
          subtituloReporte
            ? `<tr><td colspan="4" style="font-size: 10pt; color: #64748b; font-style: italic; padding-bottom: 8px;">${subtituloReporte}</td></tr>`
            : ''
        }
        <tr><td colspan="4" style="border-bottom: 2px solid ${primaryColor}; height: 4px;"></td></tr>
        
        <!-- METADATOS DE AUDITORÍA -->
        <tr style="background-color: #f8fafc; font-size: 9pt;">
          <td style="padding: 4px 8px; font-weight: bold; color: #475569;">Folio de Auditoría:</td>
          <td style="padding: 4px 8px; font-family: monospace; font-weight: bold;">${folioReporte}</td>
          <td style="padding: 4px 8px; font-weight: bold; color: #475569;">Sucursal:</td>
          <td style="padding: 4px 8px; font-weight: bold;">${nombreSucursal}</td>
        </tr>
        <tr style="background-color: #f8fafc; font-size: 9pt;">
          <td style="padding: 4px 8px; font-weight: bold; color: #475569;">Período Analizado:</td>
          <td style="padding: 4px 8px;">${rangoFechaLabel}</td>
          <td style="padding: 4px 8px; font-weight: bold; color: #475569;">Emisor Responsable:</td>
          <td style="padding: 4px 8px;">${nombreOperador}</td>
        </tr>
        <tr style="background-color: #f8fafc; font-size: 9pt;">
          <td style="padding: 4px 8px; font-weight: bold; color: #475569;">Fecha de Emisión:</td>
          <td style="padding: 4px 8px;">${fechaEmision}</td>
          <td style="padding: 4px 8px; font-weight: bold; color: #475569;">Motor Analítico:</td>
          <td style="padding: 4px 8px; color: ${primaryColor}; font-weight: bold;">DuckDB Gold OLAP</td>
        </tr>

        <!-- SECCIONES DINÁMICAS -->
        ${seccionesHtml}

        <!-- PIE DE AUDITORÍA Y CERTIFICACIÓN -->
        <tr><td colspan="4" style="height: 18px;"></td></tr>
        <tr><td colspan="4" style="border-top: 1px solid #cbd5e1; height: 4px;"></td></tr>
        <tr>
          <td colspan="4" style="font-size: 8pt; color: #94a3b8; font-style: italic;">
            Certificación: Documento generado y auditado por el motor analítico DuckDB Gold OLAP de Quantix Retail OS.
          </td>
        </tr>
        <tr>
          <td colspan="4" style="font-size: 8pt; color: #94a3b8; font-style: italic;">
            Folio: ${folioReporte} • Emisión: ${fechaEmision} • Carácter: Confidencial • ${secciones.length} secciones modulares.
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob(['\uFEFF' + htmlContent], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const cleanFilename = filename.endsWith('.xls') ? filename : `${filename}.xls`;
  link.setAttribute('href', url);
  link.setAttribute('download', cleanFilename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exporta el reporte estructurado en formato CSV con las mismas secciones de la vista previa
 */
export function exportarReporteCSV({
  filename,
  tituloReporte,
  subtituloReporte,
  nombreSucursal,
  nombreOperador,
  rangoFechaLabel,
  folioReporte,
  fechaEmision,
  secciones,
  ventas,
}: Omit<ExportarReporteExcelParams, 'paleta'>): void {
  const kpis = calcularKpisReporte(ventas);
  const totalMax = kpis.ingresosNetos > 0 ? kpis.ingresosNetos : 1;

  const lineas: string[] = [
    `"QUANTIX RETAIL OS - INFORME EJECUTIVO"`,
    `"Título: ${tituloReporte || 'Reporte Personalizado'}"`,
    `"Subtítulo: ${subtituloReporte || 'Consolidado ejecutivo'}"`,
    `"Folio: ${folioReporte}"`,
    `"Sucursal: ${nombreSucursal}"`,
    `"Período: ${rangoFechaLabel}"`,
    `"Emite: ${nombreOperador}"`,
    `"Fecha Emisión: ${fechaEmision}"`,
    `"Motor: DuckDB Gold OLAP"`,
    `""`,
  ];

  secciones.forEach((sec, idx) => {
    lineas.push(`"=== SECCIÓN ${idx + 1}: ${sec.titulo || sec.tipo} ==="`);
    if (sec.subtitulo) {
      lineas.push(`"Observación: ${sec.subtitulo}"`);
    }

    switch (sec.tipo) {
      case 'KPIS':
        lineas.push(`"Métrica","Valor","Detalle"`);
        lineas.push(`"Ventas Netas","${formatCurrency(kpis.ingresosNetos)}","Facturación total"`);
        lineas.push(`"Margen de Utilidad","${formatNumber(kpis.margenPct, 1)}%","Ganancia bruta: ${formatCurrency(kpis.margen)}"`);
        lineas.push(`"Ticket Promedio","${formatCurrency(kpis.ticketPromedio)}","Promedio por transacción"`);
        lineas.push(`"Transacciones Totales","${kpis.transacciones}","Tickets cerrados"`);
        lineas.push(`"Unidades Vendidas","${kpis.unidades}","Artículos en período"`);
        break;

      case 'DISTRIBUCION_RANKING': {
        const dim = sec.dimensionRanking || 'PRODUCTO';
        const ranking = agruparVentasPorDimension(ventas, dim, sec.limiteItems || 6);
        lineas.push(`"Posición","Elemento (${dim})","Facturación Total","Participación %"`);
        ranking.forEach((r, i) => {
          const pct = Number(((r.total / totalMax) * 100).toFixed(1));
          lineas.push(`"${i + 1}","${r.nombre}","${formatCurrency(r.total)}","${pct}%"`);
        });
        break;
      }

      case 'INTELIGENCIA_CLIENTES': {
        const cliMetricas = calcularMetricasClientesReporte(ventas, kpis.ingresosNetos, kpis.transacciones);
        lineas.push(`"Indicador de Cartera","Resultado","Detalle"`);
        lineas.push(`"Clientes Únicos","${cliMetricas.totalClientes}","Compradores registrados"`);
        lineas.push(`"Gasto Promedio (LTV)","${formatCurrency(cliMetricas.gastoPromedio)}","Por comprador activo"`);
        lineas.push(`"Frecuencia Media","${cliMetricas.ticketsPromedio}","Tickets por comprador"`);
        lineas.push(`"Cliente Principal","${cliMetricas.clienteLider.nombre}","${formatCurrency(cliMetricas.clienteLider.total)} (${cliMetricas.clienteLider.porcentaje}%)"`);
        lineas.push(`""`);
        lineas.push(`"Top Compradores","Facturación Total","Aporte % Cartera"`);
        cliMetricas.topClientes.slice(0, 5).forEach((c, i) => {
          lineas.push(`"${i + 1}. ${c.nombre}","${formatCurrency(c.total)}","${c.porcentaje}%"`);
        });
        break;
      }

      case 'CANALES_PAGO': {
        const canales = calcularCanalesPagoReporte(ventas, kpis.ingresosNetos);
        lineas.push(`"Canal de Cobro","Total Recaudado","Tickets","Participación %"`);
        canales.forEach((c) => {
          lineas.push(`"${c.label}","${formatCurrency(c.total)}","${c.tickets}","${c.porcentaje}%"`);
        });
        break;
      }

      case 'GRAFICO':
      default: {
        const dim = sec.dimensionAgrupacion || 'CATEGORIA';
        const datos = agruparVentasPorDimension(ventas, dim, 12);
        lineas.push(`"Elemento (${dim})","Facturación Total","Margen Ganancia","Unidades"`);
        datos.forEach((d) => {
          lineas.push(`"${d.nombre}","${formatCurrency(d.total)}","${formatCurrency(d.margen)}","${d.cantidad}"`);
        });
        break;
      }
    }

    lineas.push(`""`);
  });

  lineas.push(`"Certificación: Motor Analítico DuckDB Gold OLAP - Quantix Retail OS"`);

  const csvContent = '\uFEFF' + lineas.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const cleanFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  link.setAttribute('href', url);
  link.setAttribute('download', cleanFilename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
