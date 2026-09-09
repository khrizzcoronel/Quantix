import { useRef, useState } from 'react';
import { 
  Printer, Download, X, FileText, Image as ImageIcon, 
  Sparkles, ShieldCheck, ChevronDown, WifiOff, CheckCircle2,
  Mail, Send, Loader2
} from 'lucide-react';
import api from '../services/api';
import { mostrarToast } from '../hooks/useWebSocket';

export interface TicketItem {
  nombre: string;
  sku: string;
  cantidad: number | string;
  precio_unitario: number | string;
  subtotal: number | string;
  lote_codigo?: string | null;
}

export interface TicketData {
  id?: string;
  folio_ticket: string;
  fecha_hora: string;
  terminal_id?: string;
  cajero_nombre?: string;
  cliente_nombre?: string | null;
  cliente_cedula?: string | null;
  cliente_telefono?: string | null;
  cliente_email?: string | null;
  cliente_puntos_ganados?: number;
  cliente_puntos_totales?: number;
  items: TicketItem[];
  subtotal: number | string;
  descuento: number | string;
  impuestos: number | string;
  total: number | string;
  metodo_pago: string;
  monto_recibido?: number | string;
  cambio?: number | string;
  estado?: string;
  es_offline?: boolean;
  id_local?: string;
}

const toNum = (val: unknown): number => {
  if (val === null || val === undefined) return 0;
  const n = typeof val === 'number' ? val : Number(val);
  return isNaN(n) ? 0 : n;
};

const formatNum = (val: unknown, decimals = 2): string => {
  return toNum(val).toFixed(decimals);
};

interface TicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: TicketData | null;
}

export default function TicketModal({ isOpen, onClose, ticket }: TicketModalProps) {
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [emailInputOpen, setEmailInputOpen] = useState(false);
  const [emailDestino, setEmailDestino] = useState('');
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const ticketRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !ticket) return null;

  // Imprimir usando CSS @media print y window.print()
  const handlePrint = () => {
    window.print();
  };

  // Descarga en formato texto plano ESC/POS estándar (80mm / 42 caracteres por línea)
  const handleDownloadTXT = () => {
    const W = 42;
    const center = (str: string) => {
      const pad = Math.max(0, Math.floor((W - str.length) / 2));
      return ' '.repeat(pad) + str;
    };
    const row = (left: string, right: string) => {
      const space = Math.max(1, W - left.length - right.length);
      return left + ' '.repeat(space) + right;
    };

    let txt = '';
    txt += center('QUANTIX SUPERMERCADOS S.A. DE C.V.') + '\n';
    txt += center('RFC: QTX-240101-AAA') + '\n';
    txt += center('Av. Insurgentes Sur 1234, Benito Juárez') + '\n';
    txt += center('Ciudad de México, CDMX - CP 03100') + '\n';
    txt += center('Tel: (55) 8000-QUANTIX') + '\n';
    txt += center('Régimen: 601 General Personas Morales') + '\n';
    if (ticket.es_offline) {
      txt += '='.repeat(W) + '\n';
      txt += center('COMPROBANTE OFFLINE') + '\n';
      txt += center('PENDIENTE DE SINCRONIZACION') + '\n';
      txt += '='.repeat(W) + '\n';
      txt += `ID LOCAL: ${ticket.id_local || ticket.folio_ticket}\n`;
      txt += `FECHA LOCAL: ${new Date(ticket.fecha_hora).toLocaleString('es-MX')}\n`;
    } else {
      txt += '='.repeat(W) + '\n';
      txt += `FOLIO: ${ticket.folio_ticket}\n`;
      txt += `FECHA: ${new Date(ticket.fecha_hora).toLocaleString('es-MX')}\n`;
    }
    txt += `TERMINAL: ${ticket.terminal_id || 'TERM-01'}   CAJA: 01\n`;
    txt += `CAJERO: ${ticket.cajero_nombre || 'Cajero en Turno'}\n`;
    const esConsumidorFinalTxt = !ticket.cliente_nombre || ticket.cliente_nombre.trim().toUpperCase() === 'CONSUMIDOR FINAL' || ticket.cliente_cedula === '9999999999999';
    if (esConsumidorFinalTxt) {
      txt += `CLIENTE: CONSUMIDOR FINAL\n`;
      txt += `RUC / C.I.: 9999999999999\n`;
    } else {
      txt += `CLIENTE: ${ticket.cliente_nombre}\n`;
      if (ticket.cliente_cedula) txt += `RUC / C.I.: ${ticket.cliente_cedula}\n`;
      if (ticket.cliente_telefono) txt += `TEL: ${ticket.cliente_telefono}\n`;
    }
    txt += '-'.repeat(W) + '\n';
    txt += 'CANT  DESCRIPCIÓN              P.U.    TOTAL\n';
    txt += '-'.repeat(W) + '\n';

    ticket.items.forEach((item) => {
      const cantStr = `${formatNum(item.cantidad, 0).padEnd(4)}`;
      const puStr = `$${formatNum(item.precio_unitario)}`;
      const totStr = `$${formatNum(item.subtotal)}`;
      txt += `${cantStr}  ${item.nombre.slice(0, 18).padEnd(18)} ${puStr.padStart(6)} ${totStr.padStart(8)}\n`;
      if (item.lote_codigo) {
        txt += `      [Lote FEFO: ${item.lote_codigo}]\n`;
      }
    });

    txt += '-'.repeat(W) + '\n';
    txt += row('SUBTOTAL:', `$${formatNum(ticket.subtotal)}`) + '\n';
    if (toNum(ticket.descuento) > 0) {
      txt += row('DESCUENTO:', `-$${formatNum(ticket.descuento)}`) + '\n';
    }
    txt += row('IVA TRASLADADO (16%):', `$${formatNum(ticket.impuestos)}`) + '\n';
    txt += '='.repeat(W) + '\n';
    txt += row('TOTAL A PAGAR (MXN):', `$${formatNum(ticket.total)}`) + '\n';
    txt += '='.repeat(W) + '\n';
    txt += row('FORMA DE PAGO:', ticket.metodo_pago) + '\n';

    if (ticket.monto_recibido !== undefined && toNum(ticket.monto_recibido) > 0) {
      txt += row('IMPORTE RECIBIDO:', `$${formatNum(ticket.monto_recibido)}`) + '\n';
      txt += row('CAMBIO:', `$${formatNum(ticket.cambio || 0)}`) + '\n';
    }

    if (ticket.cliente_puntos_ganados || ticket.cliente_puntos_totales) {
      txt += '-'.repeat(W) + '\n';
      txt += center('*** CLUB QUANTIX FIDELIZACIÓN ***') + '\n';
      if (ticket.cliente_puntos_ganados) {
        txt += row('Puntos acumulados hoy:', `+${ticket.cliente_puntos_ganados} pts`) + '\n';
      }
      if (ticket.cliente_puntos_totales) {
        txt += row('Saldo total disponible:', `${ticket.cliente_puntos_totales} pts`) + '\n';
      }
    }

    txt += '='.repeat(W) + '\n';
    txt += center('¡GRACIAS POR SU PREFERENCIA!') + '\n';
    if (ticket.es_offline) {
      txt += center('Registro local en terminal offline') + '\n';
      txt += center('Folio fiscal asignado al sincronizar') + '\n';
      txt += '-'.repeat(W) + '\n';
      txt += center(`*${ticket.id_local || ticket.folio_ticket}*`) + '\n';
    } else {
      txt += center('Facturación CFDI en línea en:') + '\n';
      txt += center('https://facturacion.quantix.mx') + '\n';
      txt += center('Vigencia: 72 horas naturales') + '\n';
      txt += '-'.repeat(W) + '\n';
      txt += center(`*${ticket.folio_ticket}*`) + '\n';
    }

    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Ticket_${ticket.folio_ticket}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    setDownloadMenuOpen(false);
  };

  // Descarga en formato imagen PNG de alta fidelidad vía Canvas 80mm
  const handleDownloadPNG = () => {
    const canvas = document.createElement('canvas');
    const width = 576; // 80mm a 203 DPI
    const itemsCount = ticket.items.length;
    const baseHeight = 880 + (itemsCount * 45);
    canvas.width = width;
    canvas.height = baseHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fondo blanco papel térmico
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, baseHeight);

    // Tipografía térmica
    ctx.fillStyle = '#111827';
    ctx.textAlign = 'center';

    let y = 40;
    ctx.font = 'bold 20px monospace';
    ctx.fillText('QUANTIX SUPERMERCADOS S.A. DE C.V.', width / 2, y);

    y += 24;
    ctx.font = '14px monospace';
    ctx.fillText('RFC: QTX-240101-AAA', width / 2, y);

    y += 20;
    ctx.fillText('Av. Insurgentes Sur 1234, Benito Juárez', width / 2, y);
    y += 20;
    ctx.fillText('Ciudad de México, CDMX - CP 03100', width / 2, y);
    y += 20;
    ctx.fillText('Tel: (55) 8000-QUANTIX (7826)', width / 2, y);
    y += 20;
    ctx.fillText('Régimen: 601 General Personas Morales', width / 2, y);

    y += 25;
    ctx.font = '14px monospace';
    ctx.fillText('==============================================', width / 2, y);

    y += 24;
    ctx.textAlign = 'left';
    if (ticket.es_offline) {
      ctx.font = 'bold 15px monospace';
      ctx.fillText(`ID LOCAL: ${ticket.id_local || ticket.folio_ticket}`, 30, y);
      y += 20;
      ctx.font = 'bold 13px monospace';
      ctx.fillText('[COMPROBANTE OFFLINE - PENDIENTE SYNC]', 30, y);
    } else {
      ctx.font = 'bold 15px monospace';
      ctx.fillText(`FOLIO: ${ticket.folio_ticket}`, 30, y);
    }

    y += 20;
    ctx.font = '13px monospace';
    ctx.fillText(`FECHA: ${new Date(ticket.fecha_hora).toLocaleString('es-MX')}`, 30, y);

    y += 20;
    ctx.fillText(`TERMINAL: ${ticket.terminal_id || 'TERM-01'}  |  CAJA: 01`, 30, y);

    y += 20;
    ctx.fillText(`CAJERO: ${ticket.cajero_nombre || 'Cajero en Turno'}`, 30, y);

    const esConsumidorFinalCanvas = !ticket.cliente_nombre || ticket.cliente_nombre.trim().toUpperCase() === 'CONSUMIDOR FINAL' || ticket.cliente_cedula === '9999999999999';
    if (esConsumidorFinalCanvas) {
      y += 20;
      ctx.fillText('CLIENTE: CONSUMIDOR FINAL', 30, y);
      y += 18;
      ctx.fillText('RUC / C.I.: 9999999999999', 30, y);
    } else {
      y += 20;
      ctx.fillText(`CLIENTE: ${ticket.cliente_nombre}`, 30, y);
      if (ticket.cliente_cedula) {
        y += 18;
        ctx.fillText(`RUC / C.I.: ${ticket.cliente_cedula}`, 30, y);
      }
      if (ticket.cliente_telefono) {
        y += 18;
        ctx.fillText(`TELÉFONO: ${ticket.cliente_telefono}`, 30, y);
      }
    }

    y += 25;
    ctx.textAlign = 'center';
    ctx.fillText('----------------------------------------------', width / 2, y);

    y += 20;
    ctx.textAlign = 'left';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('CANT  DESCRIPCIÓN             P.U.     TOTAL', 30, y);

    y += 15;
    ctx.textAlign = 'center';
    ctx.font = '13px monospace';
    ctx.fillText('----------------------------------------------', width / 2, y);

    (ticket.items || []).forEach((item) => {
      y += 24;
      ctx.textAlign = 'left';
      ctx.font = '13px monospace';
      const cant = `${formatNum(item.cantidad, 0)}x`.padEnd(5);
      const desc = item.nombre.length > 20 ? item.nombre.substring(0, 19) + '…' : item.nombre.padEnd(20);
      const pu = `$${formatNum(item.precio_unitario)}`.padStart(8);
      const tot = `$${formatNum(item.subtotal)}`.padStart(9);
      ctx.fillText(`${cant} ${desc} ${pu} ${tot}`, 30, y);

      if (item.lote_codigo) {
        y += 16;
        ctx.font = '11px monospace';
        ctx.fillStyle = '#4b5563';
        ctx.fillText(`      [Lote FEFO: ${item.lote_codigo}]`, 30, y);
        ctx.fillStyle = '#111827';
      }
    });

    y += 25;
    ctx.textAlign = 'center';
    ctx.font = '13px monospace';
    ctx.fillText('----------------------------------------------', width / 2, y);

    const drawRow = (label: string, value: string, isBold = false) => {
      y += 22;
      ctx.textAlign = 'left';
      ctx.font = isBold ? 'bold 15px monospace' : '13px monospace';
      ctx.fillText(label, 30, y);
      ctx.textAlign = 'right';
      ctx.fillText(value, width - 30, y);
    };

    drawRow('SUBTOTAL:', `$${formatNum(ticket.subtotal)}`);
    if (toNum(ticket.descuento) > 0) {
      drawRow('DESCUENTO:', `-$${formatNum(ticket.descuento)}`);
    }
    drawRow('IVA TRASLADADO (16%):', `$${formatNum(ticket.impuestos)}`);

    y += 10;
    ctx.textAlign = 'center';
    ctx.fillText('==============================================', width / 2, y);

    drawRow('TOTAL A PAGAR:', `$${formatNum(ticket.total)}`, true);

    y += 10;
    ctx.textAlign = 'center';
    ctx.fillText('==============================================', width / 2, y);

    drawRow('MÉTODO DE PAGO:', ticket.metodo_pago);
    if (ticket.monto_recibido !== undefined && toNum(ticket.monto_recibido) > 0) {
      drawRow('RECIBIDO:', `$${formatNum(ticket.monto_recibido)}`);
      drawRow('CAMBIO:', `$${formatNum(ticket.cambio || 0)}`);
    }

    if (ticket.cliente_puntos_ganados || ticket.cliente_puntos_totales) {
      y += 20;
      ctx.textAlign = 'center';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('*** PROGRAMA CLUB QUANTIX ***', width / 2, y);
      if (ticket.cliente_puntos_ganados) {
        drawRow('Puntos Acumulados Venta:', `+${ticket.cliente_puntos_ganados} pts`);
      }
      if (ticket.cliente_puntos_totales) {
        drawRow('Saldo Total Puntos:', `${ticket.cliente_puntos_totales} pts`);
      }
    }

    // Pie fiscal
    y += 35;
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('¡GRACIAS POR SU COMPRA!', width / 2, y);
    y += 18;
    ctx.font = '11px monospace';
    if (ticket.es_offline) {
      ctx.fillText('Comprobante local emitido en modo offline.', width / 2, y);
      y += 16;
      ctx.fillText('Folio fiscal asignado al sincronizar con servidor.', width / 2, y);
    } else {
      ctx.fillText('Facturación electrónica en: https://facturacion.quantix.mx', width / 2, y);
      y += 16;
      ctx.fillText('Conserve este comprobante para aclaraciones', width / 2, y);
    }

    // Simulación gráfica de código de barras
    y += 30;
    const barcodeX = 60;
    const barcodeW = width - 120;
    const barcodeH = 45;
    for (let bx = 0; bx < barcodeW; bx += 4) {
      const isThick = ((bx * 7 + 13) % 11) > 5;
      const barWidth = isThick ? 3 : 1.5;
      ctx.fillRect(barcodeX + bx, y, barWidth, barcodeH);
    }
    y += barcodeH + 18;
    ctx.font = '12px monospace';
    ctx.fillText(`*${ticket.es_offline ? (ticket.id_local || ticket.folio_ticket) : ticket.folio_ticket}*`, width / 2, y);

    const link = document.createElement('a');
    link.download = `Ticket_${ticket.folio_ticket}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    setDownloadMenuOpen(false);
  };

  const handleEnviarCorreo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket?.id) return;
    const dest = emailDestino.trim() || ticket.cliente_email || '';
    if (!dest) {
      mostrarToast({
        titulo: 'Email Requerido',
        mensaje: 'Ingresa un correo electrónico de destino válido.',
        severidad: 'WARNING',
      });
      return;
    }
    try {
      setEnviandoEmail(true);
      await api.post(`/pos/ventas/${ticket.id}/enviar-ticket`, { email: dest });
      mostrarToast({
        titulo: 'Comprobante Enviado',
        mensaje: `Ticket digital enviado exitosamente a ${dest}`,
        severidad: 'SUCCESS',
      });
      setEmailInputOpen(false);
    } catch (err: unknown) {
      const errDetail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      mostrarToast({
        titulo: 'Error al Enviar',
        mensaje: errDetail || 'No se pudo enviar el comprobante por correo.',
        severidad: 'CRITICO',
      });
    } finally {
      setEnviandoEmail(false);
    }
  };

  return (
    <>
      {/* Estilos para impresión @media print aislada y limpia de 80mm */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #thermal-ticket-print, #thermal-ticket-print * {
            visibility: visible !important;
          }
          #thermal-ticket-print {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            padding: 4mm 2mm !important;
            margin: 0 !important;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="fixed inset-0 bg-on-surface/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
        <div className="bg-surface-container-lowest rounded-3xl shadow-2xl max-w-lg w-full border border-surface-container-high/80 flex flex-col max-h-[92vh] overflow-hidden my-auto animate-in zoom-in-95 duration-200">
          
          {/* Header del Modal Neo-Retail */}
          <div className="px-6 py-4 border-b border-surface-container-high/60 flex items-center justify-between bg-surface-container-low/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary-container text-on-primary-container flex items-center justify-center shadow-xs">
                {ticket.es_offline ? (
                  <WifiOff className="w-5 h-5" />
                ) : (
                  <Printer className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-headline-md text-title-lg text-on-surface font-bold tracking-tight">
                    {ticket.es_offline ? 'Comprobante Offline' : 'Ticket Térmico (80mm)'}
                  </h3>
                  {ticket.es_offline ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-900 dark:text-amber-200 font-label-caps text-[10px] font-bold uppercase border border-amber-400/40">
                      Pendiente Sync
                    </span>
                  ) : ticket.estado === 'COMPLETADA' && (
                    <span className="px-2.5 py-0.5 rounded-full bg-primary-fixed/35 text-on-primary-fixed-variant font-label-caps text-[10px] font-bold uppercase border border-primary/20 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Emitido
                    </span>
                  )}
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant font-mono">
                  {ticket.es_offline ? `ID Local: ${ticket.id_local || ticket.folio_ticket}` : `Folio Fiscal: ${ticket.folio_ticket}`}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-full transition-colors"
              title="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Contenedor del Ticket Térmico 80mm */}
          <div className="flex-1 overflow-y-auto p-5 bg-surface-container-low flex justify-center items-start">
            <div 
              ref={ticketRef}
              id="thermal-ticket-print"
              className="w-[340px] bg-white text-gray-900 p-6 rounded-2xl shadow-md border border-surface-container-high font-mono text-xs select-none transition-all"
            >
              {/* Encabezado Comercial */}
              <div className="text-center space-y-1 pb-3 border-b border-dashed border-gray-300">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <div className="w-3.5 h-3.5 bg-emerald-700 rounded-sm"></div>
                  <span className="font-black text-sm tracking-wider text-gray-900">QUANTIX SUPERMERCADOS</span>
                </div>
                <p className="text-[11px] font-bold text-gray-700">QUANTIX S.A. DE C.V.</p>
                <p className="text-[10px] text-gray-600 font-medium">RFC: QTX-240101-AAA</p>
                <p className="text-[10px] text-gray-600 leading-tight">
                  Av. Insurgentes Sur 1234, Benito Juárez<br />
                  Ciudad de México, CDMX, C.P. 03100
                </p>
                <p className="text-[10px] text-gray-600">Tel: (55) 8000-QUANTIX</p>
                <p className="text-[9px] text-gray-500">Régimen 601 General de Ley Personas Morales</p>
              </div>

              {/* Banner Destacado para Modo Offline Explícito */}
              {ticket.es_offline && (
                <div className="my-3 p-3 bg-amber-50 border-2 border-dashed border-amber-400 rounded-xl text-center space-y-1">
                  <span className="font-black text-[11px] text-amber-900 block uppercase tracking-tight">
                    COMPROBANTE OFFLINE • COBRO EFECTIVO
                  </span>
                  <span className="text-[9px] text-amber-800 block leading-tight font-medium">
                    Pago recibido y almacenado durablemente en terminal local. Folio fiscal central se sincronizará automáticamente.
                  </span>
                  <div className="pt-1 font-mono text-[9px] text-amber-900 font-bold break-all">
                    UUID: {ticket.id_local || ticket.folio_ticket}
                  </div>
                </div>
              )}

              {/* Metadatos de la Venta */}
              <div className="py-2.5 border-b border-dashed border-gray-300 space-y-1 text-[11px]">
                <div className="flex justify-between font-bold">
                  <span>{ticket.es_offline ? 'ID LOCAL:' : 'FOLIO FISCAL:'}</span>
                  <span className="font-mono text-gray-900 text-[10px] break-all text-right max-w-[210px]">
                    {ticket.es_offline ? (ticket.id_local || ticket.folio_ticket) : ticket.folio_ticket}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600 text-[10px]">
                  <span>FECHA Y HORA {ticket.es_offline ? 'LOCAL:' : ':'}</span>
                  <span>{new Date(ticket.fecha_hora).toLocaleString('es-MX')}</span>
                </div>
                <div className="flex justify-between text-gray-600 text-[10px]">
                  <span>TERMINAL: {ticket.terminal_id || 'TERM-01'}</span>
                  <span>CAJA: 01</span>
                </div>
                <div className="flex justify-between text-gray-600 text-[10px]">
                  <span>CAJERO:</span>
                  <span className="font-semibold">{ticket.cajero_nombre || 'Turno Activo'}</span>
                </div>

                {(!ticket.cliente_nombre || ticket.cliente_nombre.trim().toUpperCase() === 'CONSUMIDOR FINAL' || ticket.cliente_cedula === '9999999999999') ? (
                  <div className="mt-1 pt-1 border-t border-dotted border-gray-200">
                    <div className="flex justify-between font-semibold text-gray-800">
                      <span>CLIENTE:</span>
                      <span className="font-bold text-gray-900">CONSUMIDOR FINAL</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                      <span>R.U.C. / C.I.:</span>
                      <span>9999999999999</span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 pt-1 border-t border-dotted border-gray-200">
                    <div className="flex justify-between font-semibold text-emerald-950">
                      <span>CLIENTE:</span>
                      <span className="truncate max-w-[170px]">{ticket.cliente_nombre}</span>
                    </div>
                    {ticket.cliente_cedula && (
                      <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                        <span>RUC / C.I.:</span>
                        <span>{ticket.cliente_cedula}</span>
                      </div>
                    )}
                    {ticket.cliente_telefono && (
                      <div className="flex justify-between text-[10px] text-gray-500">
                        <span>TEL:</span>
                        <span>{ticket.cliente_telefono}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Líneas de Compra */}
              <div className="py-2.5 border-b border-dashed border-gray-300">
                <div className="flex justify-between text-[10px] font-bold text-gray-700 pb-1.5 border-b border-gray-200">
                  <span className="w-8">CANT</span>
                  <span className="flex-1 text-left px-1">DESCRIPCIÓN</span>
                  <span className="w-12 text-right">P.U.</span>
                  <span className="w-14 text-right">TOTAL</span>
                </div>

                <div className="divide-y divide-gray-100 py-1 space-y-1">
                  {(ticket.items || []).map((it, idx) => (
                    <div key={idx} className="pt-1 text-[11px] leading-tight">
                      <div className="flex justify-between items-baseline">
                        <span className="w-8 font-semibold text-gray-700">{formatNum(it.cantidad, 0)}x</span>
                        <span className="flex-1 px-1 font-medium text-gray-900 truncate">
                          {it.nombre}
                        </span>
                        <span className="w-12 text-right text-gray-600">${formatNum(it.precio_unitario)}</span>
                        <span className="w-14 text-right font-bold text-gray-900">${formatNum(it.subtotal)}</span>
                      </div>
                      {it.lote_codigo && (
                        <div className="text-[9px] text-gray-500 pl-8 flex items-center gap-1 font-mono">
                          <ShieldCheck className="w-2.5 h-2.5 text-emerald-600 inline shrink-0" />
                          <span>Lote FEFO: <strong>{it.lote_codigo}</strong></span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Totales e Impuestos */}
              <div className="py-2.5 border-b border-dashed border-gray-300 space-y-1 text-[11px]">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal Bruto:</span>
                  <span>${formatNum(ticket.subtotal)}</span>
                </div>
                {toNum(ticket.descuento) > 0 && (
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>Descuento Aplicado:</span>
                    <span>-${formatNum(ticket.descuento)}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-600">
                  <span>IVA Trasladado (16%):</span>
                  <span>${formatNum(ticket.impuestos)}</span>
                </div>

                <div className="flex justify-between items-center pt-2 mt-1 border-t-2 border-dashed border-gray-400 font-black text-sm text-gray-900">
                  <span>TOTAL A PAGAR:</span>
                  <span className="text-base font-extrabold text-emerald-950">
                    ${formatNum(ticket.total)} MXN
                  </span>
                </div>
              </div>

              {/* Forma de Pago */}
              <div className="py-2 border-b border-dashed border-gray-300 text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">Forma de Pago:</span>
                  <span className="font-bold uppercase text-gray-900">{ticket.metodo_pago}</span>
                </div>
                {ticket.monto_recibido !== undefined && toNum(ticket.monto_recibido) > 0 && (
                  <>
                    <div className="flex justify-between text-gray-600">
                      <span>Importe Recibido:</span>
                      <span>${formatNum(ticket.monto_recibido)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Cambio Entregado:</span>
                      <span className="font-bold">${formatNum(ticket.cambio || 0)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* CRM / Puntos Acumulados */}
              {(ticket.cliente_puntos_ganados || ticket.cliente_puntos_totales) && (
                <div className="py-2 border-b border-dashed border-gray-300 bg-emerald-50/60 p-2.5 rounded-xl my-1.5">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-900 uppercase tracking-wider mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Club Quantix Recompensas</span>
                  </div>
                  {ticket.cliente_puntos_ganados && (
                    <div className="flex justify-between text-[10px] text-gray-700">
                      <span>Puntos generados en esta compra:</span>
                      <span className="font-bold text-emerald-700">+{ticket.cliente_puntos_ganados} pts</span>
                    </div>
                  )}
                  {ticket.cliente_puntos_totales && (
                    <div className="flex justify-between text-[10px] text-gray-700 font-medium">
                      <span>Saldo acumulado disponible:</span>
                      <span className="font-bold">{ticket.cliente_puntos_totales} pts</span>
                    </div>
                  )}
                </div>
              )}

              {/* Código de Barras y QR Simulado */}
              <div className="pt-3 pb-1 text-center space-y-2">
                {/* SVG Código de Barras */}
                <div className="flex flex-col items-center">
                  <svg className="w-48 h-10" viewBox="0 0 160 36">
                    <rect x="0" y="0" width="160" height="36" fill="white" />
                    {[
                      2, 1, 3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 1, 2, 3, 2, 1, 4,
                      1, 2, 3, 1, 4, 2, 1, 3, 2, 1, 3, 2, 1, 4, 2, 1, 3, 1, 2, 4
                    ].map((w, i) => {
                      const xOffset = i * 4;
                      return (
                        <rect
                          key={i}
                          x={xOffset}
                          y="0"
                          width={w > 2 ? 2.5 : 1.2}
                          height="36"
                          fill="black"
                        />
                      );
                    })}
                  </svg>
                  <span className="text-[9px] font-mono tracking-widest text-gray-600 mt-0.5">
                    *{ticket.es_offline ? (ticket.id_local || ticket.folio_ticket) : ticket.folio_ticket}*
                  </span>
                </div>

                {/* Sección Fiscal vs Comprobante Offline */}
                {ticket.es_offline ? (
                  <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-center space-y-1 my-2">
                    <p className="font-bold text-[10px] text-amber-900 uppercase tracking-wide">
                      Registro Local en Terminal
                    </p>
                    <p className="text-[9px] text-amber-800 leading-tight">
                      Venta persistida durablemente en almacenamiento local offline.<br />
                      El folio fiscal central se emitirá al conectar con el servidor.
                    </p>
                    <p className="text-[9px] font-mono text-gray-600 pt-0.5 break-all">
                      UUID Local: {ticket.id_local || ticket.folio_ticket}
                    </p>
                  </div>
                ) : (
                  /* SVG Código QR Fiscal */
                  <div className="flex items-center justify-center gap-3 pt-1">
                    <div className="p-1.5 bg-white border border-gray-300 rounded shadow-sm inline-block">
                      <svg className="w-16 h-16" viewBox="0 0 33 33" fill="none">
                        {/* Marcadores de Esquina QR */}
                        {/* Top-Left */}
                        <rect x="1" y="1" width="9" height="9" fill="black" />
                        <rect x="2.5" y="2.5" width="6" height="6" fill="white" />
                        <rect x="4" y="4" width="3" height="3" fill="black" />

                        {/* Top-Right */}
                        <rect x="23" y="1" width="9" height="9" fill="black" />
                        <rect x="24.5" y="2.5" width="6" height="6" fill="white" />
                        <rect x="26" y="4" width="3" height="3" fill="black" />

                        {/* Bottom-Left */}
                        <rect x="1" y="23" width="9" height="9" fill="black" />
                        <rect x="2.5" y="24.5" width="6" height="6" fill="white" />
                        <rect x="4" y="26" width="3" height="3" fill="black" />

                        {/* Puntos y patrones del cuerpo del QR */}
                        {[
                          [12, 2], [14, 2], [16, 4], [18, 2], [20, 3],
                          [11, 6], [13, 5], [15, 8], [17, 6], [19, 7],
                          [2, 12], [4, 14], [6, 11], [8, 13],
                          [12, 12], [14, 13], [16, 11], [18, 14], [20, 12],
                          [23, 13], [25, 12], [27, 14], [29, 11], [31, 13],
                          [12, 16], [15, 17], [17, 19], [19, 16],
                          [11, 20], [13, 21], [16, 22], [18, 20], [21, 22],
                          [12, 25], [15, 27], [18, 24], [20, 26],
                          [24, 23], [26, 25], [28, 23], [30, 26], [31, 24],
                          [23, 28], [25, 30], [27, 29], [29, 31], [31, 28]
                        ].map(([x, y], idx) => (
                          <rect key={idx} x={x} y={y} width="1.4" height="1.4" fill="black" />
                        ))}
                      </svg>
                    </div>
                    <div className="text-left text-[9px] text-gray-500 leading-tight space-y-0.5">
                      <p className="font-bold text-gray-700">Comprobante Fiscal Digital</p>
                      <p>Factura en: <strong>quantix.mx/factura</strong></p>
                      <p>UUID: {ticket.id ? ticket.id.slice(0, 13) + '...' : 'QTX-VALID-CFDI'}</p>
                      <p className="text-emerald-700 font-semibold">Descarga FEFO verificada</p>
                    </div>
                  </div>
                )}

                <div className="pt-2 text-[10px] text-gray-500 leading-tight">
                  <p className="font-bold text-gray-800">¡GRACIAS POR SU COMPRA!</p>
                  <p>Por favor conserve este comprobante para cualquier aclaración.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer con Botones de Acción Neo-Retail */}
          <div className="px-6 py-4 bg-surface-container-lowest border-t border-surface-container-high/60 flex items-center justify-between gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => setDownloadMenuOpen(!downloadMenuOpen)}
                className="px-4 py-2.5 bg-surface-container-low hover:bg-surface-container text-on-surface text-body-sm font-semibold rounded-full transition-colors flex items-center gap-1.5 border border-surface-container-high shadow-xs"
              >
                <Download className="w-4 h-4 text-on-surface-variant" />
                <span>Descargar</span>
                <ChevronDown className="w-3.5 h-3.5 ml-0.5 text-on-surface-variant" />
              </button>

              {downloadMenuOpen && (
                <div className="absolute left-0 bottom-full mb-2 w-56 bg-surface-container-lowest rounded-2xl shadow-xl border border-surface-container-high/80 py-1.5 z-20 animate-in fade-in zoom-in-95">
                  <button
                    onClick={handleDownloadTXT}
                    className="w-full px-4 py-2.5 text-left text-body-sm text-on-surface hover:bg-surface-container-low flex items-center gap-2 font-medium"
                  >
                    <FileText className="w-4 h-4 text-primary" />
                    <span>Texto Plano (.txt ESC/POS)</span>
                  </button>
                  <button
                    onClick={handleDownloadPNG}
                    className="w-full px-4 py-2.5 text-left text-body-sm text-on-surface hover:bg-surface-container-low flex items-center gap-2 font-medium"
                  >
                    <ImageIcon className="w-4 h-4 text-secondary" />
                    <span>Imagen PNG (80mm 203dpi)</span>
                  </button>
                </div>
              )}
            </div>

            {/* Botón y Formulario Enviar Ticket por Correo */}
            {ticket.id && !ticket.es_offline && (
              <div className="relative">
                {!emailInputOpen ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEmailDestino(ticket.cliente_email || '');
                      setEmailInputOpen(true);
                    }}
                    className="px-4 py-2.5 bg-surface-container-low hover:bg-surface-container text-on-surface text-body-sm font-semibold rounded-full transition-colors flex items-center gap-1.5 border border-surface-container-high shadow-xs cursor-pointer"
                    title="Enviar comprobante por correo electrónico"
                  >
                    <Mail className="w-4 h-4 text-primary" />
                    <span>Enviar Correo</span>
                  </button>
                ) : (
                  <form onSubmit={handleEnviarCorreo} className="flex items-center gap-1.5 bg-surface-container-low p-1 rounded-full border border-surface-container-high">
                    <input
                      type="email"
                      required
                      autoFocus
                      placeholder="correo@ejemplo.com"
                      value={emailDestino}
                      onChange={(e) => setEmailDestino(e.target.value)}
                      className="px-3 py-1 bg-surface-container-lowest rounded-full text-xs text-on-surface outline-none focus:ring-1 focus:ring-primary w-44"
                    />
                    <button
                      type="submit"
                      disabled={enviandoEmail}
                      className="px-3 py-1 bg-primary text-on-primary rounded-full text-xs font-bold hover:opacity-90 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      {enviandoEmail ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                      <span>{enviandoEmail ? '...' : 'Enviar'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmailInputOpen(false)}
                      className="p-1 text-on-surface-variant hover:text-on-surface rounded-full"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </form>
                )}
              </div>
            )}

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 bg-surface-container-low hover:bg-surface-container text-on-surface font-title-md text-body-sm font-semibold rounded-full transition-colors"
              >
                Cerrar
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="px-6 py-2.5 bg-primary-container hover:opacity-95 text-on-primary-container font-title-md text-body-sm font-bold rounded-full shadow-md hover:shadow-lg transition-all flex items-center gap-2 active:scale-95"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Ticket</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
