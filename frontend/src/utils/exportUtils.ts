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
