import { useState } from 'react';
import { useCajaStore, type ResultadoArqueo } from '../store/cajaStore';
import { 
  EyeOff, CheckCircle2, AlertTriangle, ShieldAlert, Loader2, 
  X, Receipt, Printer, Download, ArrowLeft, FileText, Check 
} from 'lucide-react';
import api from '../services/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export interface CorteZData {
  sesion_id: string;
  folio_corte: string;
  cajero_id: string;
  cajero_nombre: string;
  cajero_email?: string | null;
  terminal_id: string;
  fecha_apertura: string;
  fecha_cierre?: string | null;
  fondo_inicial: number;
  total_ventas: number;
  total_bruto: number;
  total_descuento: number;
  total_impuestos: number;
  ventas_efectivo: number;
  ventas_tarjeta: number;
  ventas_transferencia: number;
  ventas_otros: number;
  total_tickets_emitidos: number;
  primer_folio?: string | null;
  ultimo_folio?: string | null;
  tickets_anulados: number;
  total_fisico_declarado?: number | null;
  total_teorico?: number | null;
  diferencia?: number | null;
  estado_cuadre?: string | null;
  estado: string;
  fecha_emision: string;
}

export default function ArqueoCiegoModal({ isOpen, onClose }: Props) {
  const [efectivo, setEfectivo] = useState('');
  const [tarjeta, setTarjeta] = useState('');
  const [transferencia, setTransferencia] = useState('');
  const [otros, setOtros] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ResultadoArqueo | null>(null);

  // Estados para visualización del Comprobante de Corte Z
  const [mostrarCorteZ, setMostrarCorteZ] = useState(false);
  const [loadingCorteZ, setLoadingCorteZ] = useState(false);
  const [corteZ, setCorteZ] = useState<CorteZData | null>(null);
  const [corteZError, setCorteZError] = useState<string | null>(null);
  const [descargado, setDescargado] = useState(false);

  const realizarArqueoCiego = useCajaStore((state) => state.realizarArqueoCiego);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const conteo = {
      efectivo: parseFloat(efectivo) || 0,
      tarjeta: parseFloat(tarjeta) || 0,
      transferencia: parseFloat(transferencia) || 0,
      otros: parseFloat(otros) || 0,
    };

    try {
      const res = await realizarArqueoCiego(conteo);
      setResultado(res);
    } catch (err) {
      console.error("Error al realizar arqueo ciego:", err);
    } finally {
      setLoading(false);
    }
  };

  const cargarCorteZ = async (sesionId: string) => {
    setLoadingCorteZ(true);
    setCorteZError(null);
    try {
      const res = await api.get(`/caja/sesiones/${sesionId}/corte-z`);
      setCorteZ({
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
      setMostrarCorteZ(true);
    } catch {
      setCorteZ(null);
      setCorteZError('No se pudo obtener el Corte Z oficial. No se generará un comprobante local.');
    } finally {
      setLoadingCorteZ(false);
    }
  };

  const handleImprimir = () => {
    window.print();
  };

  const handleDescargar = () => {
    if (!corteZ) return;
    const lineas = [
      "==================================================",
      "       QUANTIX ENTERPRISE RETAIL OS",
      "       ACTA FISCAL Y CONTABLE DE CIERRE",
      "               (CORTE Z)",
      "==================================================",
      `FOLIO CORTE:      ${corteZ.folio_corte}`,
      `TERMINAL ID:      ${corteZ.terminal_id}`,
      `CAJERO:           ${corteZ.cajero_nombre}`,
      `FECHA EMISIÓN:    ${new Date(corteZ.fecha_emision).toLocaleString()}`,
      `FECHA APERTURA:   ${new Date(corteZ.fecha_apertura).toLocaleString()}`,
      `FECHA CIERRE:     ${corteZ.fecha_cierre ? new Date(corteZ.fecha_cierre).toLocaleString() : 'N/A'}`,
      `ESTADO TURNO:     ${corteZ.estado}`,
      "--------------------------------------------------",
      "RESUMEN CONTABLE DE VENTAS:",
      `Fondo Inicial:          $${corteZ.fondo_inicial.toFixed(2)}`,
      `Ventas Brutas:          $${corteZ.total_bruto.toFixed(2)}`,
      `Descuentos Aplicados:  -$${corteZ.total_descuento.toFixed(2)}`,
      `Impuestos (IVA 16%):    $${corteZ.total_impuestos.toFixed(2)}`,
      `TOTAL VENTAS COBRADAS:  $${corteZ.total_ventas.toFixed(2)}`,
      "--------------------------------------------------",
      "DESGLOSE POR MÉTODO DE PAGO:",
      `Efectivo en Caja:       $${corteZ.ventas_efectivo.toFixed(2)}`,
      `Tarjetas Débito/Crédito:$${corteZ.ventas_tarjeta.toFixed(2)}`,
      `Transferencias / QR:    $${corteZ.ventas_transferencia.toFixed(2)}`,
      `Otros / Cupones:        $${corteZ.ventas_otros.toFixed(2)}`,
      "--------------------------------------------------",
      "AUDITORÍA DE GAVETA Y ARQUEO CIEGO:",
      `Saldo Teórico Esperado: $${(corteZ.total_teorico || 0).toFixed(2)}`,
      `Total Físico Declarado: $${(corteZ.total_fisico_declarado || 0).toFixed(2)}`,
      `Diferencia / Descuadre: $${(corteZ.diferencia || 0).toFixed(2)} (${corteZ.estado_cuadre || 'OK'})`,
      "--------------------------------------------------",
      "COMPROBANTES FISCALES EMITIDOS:",
      `Total Tickets Emitidos: ${corteZ.total_tickets_emitidos}`,
      `Rango de Folios:        ${corteZ.primer_folio || 'N/A'} a ${corteZ.ultimo_folio || 'N/A'}`,
      `Tickets Anulados:       ${corteZ.tickets_anulados || 0}`,
      "==================================================",
      "",
      "FIRMAS DE CONFORMIDAD Y AUDITORÍA:",
      "",
      "___________________________    ___________________________",
      `Firma Cajero:                  Firma Supervisor de Turno`,
      `${corteZ.cajero_nombre}`,
      "=================================================="
    ];

    const blob = new Blob([lineas.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Corte_Z_${corteZ.folio_corte}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDescargado(true);
    setTimeout(() => setDescargado(false), 2500);
  };

  const handleFinalizar = () => {
    setResultado(null);
    setMostrarCorteZ(false);
    setCorteZ(null);
    setEfectivo('');
    setTarjeta('');
    setTransferencia('');
    setOtros('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-on-surface/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* Estilos dedicados para impresión CSS print */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #corte-z-imprimible, #corte-z-imprimible * {
            visibility: visible !important;
          }
          #corte-z-imprimible {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 16px !important;
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

      <div className={`bg-surface-container-lowest rounded-3xl shadow-2xl w-full border border-outline-variant/30 animate-in fade-in zoom-in-95 duration-200 transition-all font-body-md text-on-surface ${
        mostrarCorteZ ? 'max-w-2xl p-6 my-4' : 'max-w-lg p-6'
      }`}>
        
        {/* VISTA 1: FORMULARIO DE CONTEO FÍSICO A CIEGAS */}
        {!resultado ? (
          <>
            <div className="flex items-center justify-between pb-4 border-b border-surface-container-high/60 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 flex items-center justify-center shadow-xs">
                  <EyeOff className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="font-headline-md text-title-lg font-bold text-on-surface tracking-tight">
                    Arqueo Ciego de Cierre
                  </h2>
                  <p className="font-body-sm text-xs text-on-surface-variant font-medium">
                    Conteo físico obligatorio sin visibilidad del saldo teórico (RF-SEG-01)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-full transition-colors"
                title="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-surface-container-low border border-surface-container-high/60 rounded-2xl p-3.5 mb-5 text-xs text-on-surface leading-relaxed">
              Ingresa el total contado físicamente en la gaveta y los váuchers de terminal. El sistema calculará la discrepancia, cerrará el turno y generará el <strong>Corte Z</strong> fiscal.
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-label-caps uppercase text-on-surface-variant font-bold mb-1.5">
                    Efectivo Físico Contado ($)
                  </label>
                  <input
                    type="number"
                    step="0.50"
                    min="0"
                    required
                    value={efectivo}
                    onChange={(e) => setEfectivo(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-full bg-surface-container-low border border-surface-container-high text-base font-bold font-mono text-on-surface focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none transition-all"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block font-label-caps uppercase text-on-surface-variant font-bold mb-1.5">
                    Váuchers Tarjeta ($)
                  </label>
                  <input
                    type="number"
                    step="0.50"
                    min="0"
                    value={tarjeta}
                    onChange={(e) => setTarjeta(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-full bg-surface-container-low border border-surface-container-high text-base font-bold font-mono text-on-surface focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none transition-all"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block font-label-caps uppercase text-on-surface-variant font-bold mb-1.5">
                    Transferencias / QR ($)
                  </label>
                  <input
                    type="number"
                    step="0.50"
                    min="0"
                    value={transferencia}
                    onChange={(e) => setTransferencia(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-full bg-surface-container-low border border-surface-container-high text-base font-bold font-mono text-on-surface focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none transition-all"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block font-label-caps uppercase text-on-surface-variant font-bold mb-1.5">
                    Otros Comprobantes ($)
                  </label>
                  <input
                    type="number"
                    step="0.50"
                    min="0"
                    value={otros}
                    onChange={(e) => setOtros(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-full bg-surface-container-low border border-surface-container-high text-base font-bold font-mono text-on-surface focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none transition-all"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-surface-container-high/60 mt-6">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 px-5 bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest font-title-md text-body-sm font-semibold rounded-full transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 px-5 bg-primary hover:opacity-95 text-on-primary font-title-md text-body-sm font-bold rounded-full shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar Conteo y Cerrar'}
                </button>
              </div>
            </form>
          </>
        ) : !mostrarCorteZ ? (
          /* VISTA 2: RESULTADO DE ARQUEO CON BOTÓN PARA VER CORTE Z */
          <div className="text-center py-2 relative">
            <button
              onClick={handleFinalizar}
              className="absolute right-0 top-0 p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-full transition-colors"
              title="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4 mt-2">
              {resultado.estado === 'OK' ? (
                <div className="bg-primary-fixed/30 text-on-primary-fixed-variant p-4 rounded-full">
                  <CheckCircle2 className="w-10 h-10 text-primary" />
                </div>
              ) : resultado.estado === 'SOBRANTE' ? (
                <div className="bg-amber-100 text-amber-800 p-4 rounded-full">
                  <AlertTriangle className="w-10 h-10" />
                </div>
              ) : (
                <div className="bg-error-container text-on-error-container p-4 rounded-full">
                  <ShieldAlert className="w-10 h-10" />
                </div>
              )}
            </div>

            <h3 className="font-headline-md text-2xl font-black text-on-surface mb-1">
              {resultado.estado === 'OK' ? 'Caja Cuadrada' : `Descuadre: ${resultado.estado}`}
            </h3>
            <p className="font-body-sm text-sm text-on-surface-variant mb-6">{resultado.mensaje}</p>

            <div className="bg-surface-container-low p-4 rounded-2xl space-y-2 text-sm border border-surface-container-high mb-6 text-left">
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant">Total Teórico Esperado:</span>
                <span className="font-bold text-on-surface font-mono">${Number(resultado.total_teorico || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant">Total Físico Declarado:</span>
                <span className="font-bold text-on-surface font-mono">${Number(resultado.total_fisico_declarado || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-surface-container-high font-bold">
                <span className="text-on-surface">Diferencia:</span>
                <span className={`font-mono text-base ${Number(resultado.diferencia || 0) === 0 ? 'text-primary' : Number(resultado.diferencia || 0) > 0 ? 'text-amber-700' : 'text-error'}`}>
                  {Number(resultado.diferencia || 0) > 0 ? `+$${Number(resultado.diferencia || 0).toFixed(2)}` : `-$${Math.abs(Number(resultado.diferencia || 0)).toFixed(2)}`}
                </span>
              </div>
            </div>

            {resultado.requiere_auditoria && (
              <div className="bg-error-container/30 border border-error-container text-on-error-container text-xs p-3.5 rounded-2xl mb-6 text-left font-medium">
                <strong>Alerta de Seguridad:</strong> La diferencia supera la tolerancia máxima ($5.00). Se ha generado un registro en la Bitácora de Auditoría Forense y se notificó al Supervisor de Turno.
              </div>
            )}

            <div className="space-y-3">
              {corteZError && (
                <p role="alert" className="rounded-2xl border border-error-container bg-error-container/30 p-3 text-left text-xs font-semibold text-on-error-container">
                  {corteZError}
                </p>
              )}
              <button
                onClick={() => cargarCorteZ(resultado.sesion_caja_id)}
                disabled={loadingCorteZ}
                className="w-full py-3.5 px-6 bg-primary hover:opacity-95 text-on-primary font-title-md text-body-sm font-bold rounded-full shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loadingCorteZ ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Receipt className="w-4 h-4" />
                    Ver Comprobante de Corte Z
                  </>
                )}
              </button>

              <button
                onClick={handleFinalizar}
                className="w-full py-3 px-6 bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-title-md text-body-sm font-semibold rounded-full transition-all cursor-pointer"
              >
                Aceptar y Salir de Turno
              </button>
            </div>
          </div>
        ) : (
          /* VISTA 3: ACTA Y COMPROBANTE OFICIAL DE CORTE Z (IMPRIMIBLE / DESCARGABLE) */
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-high/60 mb-4 no-print">
              <button
                onClick={() => setMostrarCorteZ(false)}
                className="flex items-center gap-1.5 text-xs font-bold text-on-surface-variant hover:text-on-surface bg-surface-container-high hover:bg-surface-container-highest px-4 py-2 rounded-full transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Volver al Resumen
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleDescargar}
                  className="flex items-center gap-1.5 text-xs font-bold bg-surface-container-low text-on-surface border border-surface-container-high hover:bg-surface-container px-4 py-2 rounded-full transition-all shadow-xs cursor-pointer"
                  title="Descargar comprobante en texto"
                >
                  {descargado ? <Check className="w-3.5 h-3.5 text-primary" /> : <Download className="w-3.5 h-3.5" />}
                  {descargado ? '¡Descargado!' : 'Descargar'}
                </button>

                <button
                  onClick={handleImprimir}
                  className="flex items-center gap-1.5 text-xs font-bold bg-primary text-on-primary hover:opacity-95 px-5 py-2 rounded-full transition-all shadow-md cursor-pointer"
                  title="Imprimir acta oficial"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Imprimir
                </button>

                <button
                  onClick={handleFinalizar}
                  className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-full transition-colors cursor-pointer"
                  title="Cerrar modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Comprobante de Corte Z estructurado (Diseño térmico y fiscal) */}
            {corteZ && (
              <div 
                id="corte-z-imprimible"
                className="bg-white border-2 border-dashed border-gray-300 rounded-2xl p-6 font-mono text-xs text-gray-800 leading-relaxed shadow-inner select-none"
              >
                {/* Cabecera Fiscal */}
                <div className="text-center pb-4 border-b border-gray-200">
                  <div className="flex items-center justify-center gap-2 font-black text-sm tracking-widest uppercase text-gray-900">
                    <FileText className="w-4 h-4 text-emerald-700" />
                    QUANTIX ENTERPRISE RETAIL
                  </div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">SISTEMA FISCAL POS • LIBRO DE CAJA</p>
                  <h2 className="text-base font-black text-gray-900 mt-2 tracking-tight">ACTA DE CIERRE DIARIO (CORTE Z)</h2>
                  <span className="inline-block px-3 py-0.5 mt-1 bg-gray-100 border border-gray-300 rounded-full text-[11px] font-bold text-gray-800">
                    FOLIO: {corteZ.folio_corte}
                  </span>
                </div>

                {/* Metadatos de la sesión */}
                <div className="py-3 border-b border-gray-200 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-gray-500">Terminal:</span> <strong>{corteZ.terminal_id}</strong>
                  </div>
                  <div>
                    <span className="text-gray-500">Cajero:</span> <strong>{corteZ.cajero_nombre}</strong>
                  </div>
                  <div>
                    <span className="text-gray-500">Apertura:</span> {new Date(corteZ.fecha_apertura).toLocaleTimeString()}
                  </div>
                  <div>
                    <span className="text-gray-500">Cierre:</span> {corteZ.fecha_cierre ? new Date(corteZ.fecha_cierre).toLocaleTimeString() : 'En curso'}
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Fecha Emisión:</span> {new Date(corteZ.fecha_emision).toLocaleString()}
                  </div>
                </div>

                {/* Resumen Contable y Fiscal */}
                <div className="py-3 border-b border-gray-200 space-y-1 text-[11px]">
                  <div className="font-bold text-gray-900 uppercase text-[10px] tracking-wider mb-1">Resumen Fiscal de Ventas</div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Fondo Inicial de Apertura:</span>
                    <span>${corteZ.fondo_inicial.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Ventas Brutas (+):</span>
                    <span>${corteZ.total_bruto.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Descuentos y Promociones (-):</span>
                    <span>-${corteZ.total_descuento.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Impuestos Trasladados (IVA 16%):</span>
                    <span>${corteZ.total_impuestos.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-1 font-bold text-gray-900 border-t border-gray-100">
                    <span>TOTAL VENTAS NETAS:</span>
                    <span>${corteZ.total_ventas.toFixed(2)}</span>
                  </div>
                </div>

                {/* Desglose por Formas de Pago */}
                <div className="py-3 border-b border-gray-200 space-y-1 text-[11px]">
                  <div className="font-bold text-gray-900 uppercase text-[10px] tracking-wider mb-1">Desglose por Método de Pago</div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Efectivo en Caja:</span>
                    <span>${corteZ.ventas_efectivo.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tarjetas (Débito/Crédito):</span>
                    <span>${corteZ.ventas_tarjeta.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Transferencias / SPEI / QR:</span>
                    <span>${corteZ.ventas_transferencia.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Otros Medios / Cupones:</span>
                    <span>${corteZ.ventas_otros.toFixed(2)}</span>
                  </div>
                </div>

                {/* Arqueo Ciego y Conciliación */}
                <div className="py-3 border-b border-gray-200 space-y-1 text-[11px] bg-gray-50/70 p-3 rounded-xl my-2">
                  <div className="font-bold text-gray-900 uppercase text-[10px] tracking-wider mb-1">Auditoría de Gaveta (Arqueo Ciego)</div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Saldo Teórico Esperado:</span>
                    <span className="font-semibold">${(corteZ.total_teorico || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Conteo Físico Declarado:</span>
                    <span className="font-semibold">${(corteZ.total_fisico_declarado || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-gray-200 font-bold">
                    <span>Diferencia Registrada:</span>
                    <span className={(corteZ.diferencia || 0) === 0 ? 'text-green-700' : (corteZ.diferencia || 0) > 0 ? 'text-amber-700' : 'text-red-700'}>
                      {(corteZ.diferencia || 0) > 0 ? `+$${(corteZ.diferencia || 0).toFixed(2)}` : `-$${Math.abs(corteZ.diferencia || 0).toFixed(2)}`} ({corteZ.estado_cuadre})
                    </span>
                  </div>
                </div>

                {/* Tickets y Rango */}
                <div className="py-2 border-b border-gray-200 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-gray-500">Tickets Emitidos:</span> <strong>{corteZ.total_tickets_emitidos}</strong>
                  </div>
                  <div>
                    <span className="text-gray-500">Tickets Anulados:</span> <strong>{corteZ.tickets_anulados}</strong>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Rango de Tickets:</span> {corteZ.primer_folio || 'S/N'} al {corteZ.ultimo_folio || 'S/N'}
                  </div>
                </div>

                {/* Firmas de Responsabilidad */}
                <div className="pt-8 pb-3 grid grid-cols-2 gap-8 text-center text-[10px]">
                  <div>
                    <div className="border-t border-gray-400 pt-1 font-bold text-gray-800">
                      {corteZ.cajero_nombre}
                    </div>
                    <span className="text-gray-500">Firma del Cajero / Operador</span>
                  </div>
                  <div>
                    <div className="border-t border-gray-400 pt-1 font-bold text-gray-800">
                      Supervisor Autorizador
                    </div>
                    <span className="text-gray-500">Firma Supervisor de Turno</span>
                  </div>
                </div>

                <div className="text-center text-[9px] text-gray-400 pt-2 border-t border-gray-100">
                  Documento fiscal y contable emitido electrónicamente por Quantix POS. Conservar para auditoría.
                </div>
              </div>
            )}

            <div className="mt-5 flex justify-end no-print">
              <button
                onClick={handleFinalizar}
                className="px-6 py-3 bg-primary hover:opacity-95 text-on-primary font-title-md text-body-sm font-bold rounded-full shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                Cerrar Turno y Continuar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
