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
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
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

      <div className={`bg-white rounded-2xl shadow-2xl w-full border border-gray-100 animate-in fade-in zoom-in-95 duration-200 transition-all ${
        mostrarCorteZ ? 'max-w-2xl p-6 my-4' : 'max-w-lg p-6'
      }`}>
        
        {/* VISTA 1: FORMULARIO DE CONTEO FÍSICO A CIEGAS */}
        {!resultado ? (
          <>
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-100 text-amber-700 rounded-2xl shadow-inner">
                  <EyeOff className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Arqueo Ciego de Cierre</h2>
                  <p className="text-xs text-gray-500 font-medium">Conteo físico obligatorio sin visibilidad del saldo teórico (RF-SEG-01)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                title="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-5 text-xs text-blue-800 leading-relaxed">
              Ingresa el total contado físicamente en la gaveta y los váuchers de terminal. El sistema calculará la discrepancia, cerrará el turno y generará el <strong>Corte Z</strong> fiscal.
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Efectivo Físico Contado ($)
                  </label>
                  <input
                    type="number"
                    step="0.50"
                    min="0"
                    required
                    value={efectivo}
                    onChange={(e) => setEfectivo(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-base font-bold text-gray-800 focus:ring-2 focus:ring-quantix-500 outline-none"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Váuchers Tarjeta ($)
                  </label>
                  <input
                    type="number"
                    step="0.50"
                    min="0"
                    value={tarjeta}
                    onChange={(e) => setTarjeta(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-base font-bold text-gray-800 focus:ring-2 focus:ring-quantix-500 outline-none"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Transferencias / QR ($)
                  </label>
                  <input
                    type="number"
                    step="0.50"
                    min="0"
                    value={transferencia}
                    onChange={(e) => setTransferencia(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-base font-bold text-gray-800 focus:ring-2 focus:ring-quantix-500 outline-none"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Otros Comprobantes ($)
                  </label>
                  <input
                    type="number"
                    step="0.50"
                    min="0"
                    value={otros}
                    onChange={(e) => setOtros(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-base font-bold text-gray-800 focus:ring-2 focus:ring-quantix-500 outline-none"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100 mt-6">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-sm transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-70 text-white font-bold rounded-xl shadow-lg transition-all text-sm flex items-center justify-center gap-2"
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
              className="absolute right-0 top-0 p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
              title="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4 mt-2">
              {resultado.estado === 'OK' ? (
                <div className="bg-green-100 text-green-600 p-4 rounded-full">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
              ) : resultado.estado === 'SOBRANTE' ? (
                <div className="bg-amber-100 text-amber-600 p-4 rounded-full">
                  <AlertTriangle className="w-10 h-10" />
                </div>
              ) : (
                <div className="bg-red-100 text-red-600 p-4 rounded-full">
                  <ShieldAlert className="w-10 h-10" />
                </div>
              )}
            </div>

            <h3 className="text-2xl font-black text-gray-900 mb-1">
              {resultado.estado === 'OK' ? 'Caja Cuadrada' : `Descuadre: ${resultado.estado}`}
            </h3>
            <p className="text-sm text-gray-500 mb-6">{resultado.mensaje}</p>

            <div className="bg-gray-50 p-4 rounded-xl space-y-2 text-sm border border-gray-200 mb-6 text-left">
              <div className="flex justify-between">
                <span className="text-gray-500">Total Teórico Esperado:</span>
                <span className="font-semibold text-gray-800">${Number(resultado.total_teorico || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Total Físico Declarado:</span>
                <span className="font-semibold text-gray-800">${Number(resultado.total_fisico_declarado || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-200 font-bold">
                <span>Diferencia:</span>
                <span className={Number(resultado.diferencia || 0) === 0 ? 'text-green-600' : Number(resultado.diferencia || 0) > 0 ? 'text-amber-600' : 'text-red-600'}>
                  {Number(resultado.diferencia || 0) > 0 ? `+$${Number(resultado.diferencia || 0).toFixed(2)}` : `-$${Math.abs(Number(resultado.diferencia || 0)).toFixed(2)}`}
                </span>
              </div>
            </div>

            {resultado.requiere_auditoria && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-lg mb-6 text-left">
                <strong>Alerta de Seguridad:</strong> La diferencia supera la tolerancia máxima ($5.00). Se ha generado un registro en la Bitácora de Auditoría Forense y se notificó al Supervisor de Turno.
              </div>
            )}

            <div className="space-y-3">
              {corteZError && (
                <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-left text-xs font-semibold text-red-700">
                  {corteZError}
                </p>
              )}
              <button
                onClick={() => cargarCorteZ(resultado.sesion_caja_id)}
                disabled={loadingCorteZ}
                className="w-full py-3 bg-quantix-600 hover:bg-quantix-700 text-white font-bold rounded-xl shadow-lg transition-all text-sm flex items-center justify-center gap-2"
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
                className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-sm transition-all"
              >
                Aceptar y Salir de Turno
              </button>
            </div>
          </div>
        ) : (
          /* VISTA 3: ACTA Y COMPROBANTE OFICIAL DE CORTE Z (IMPRIMIBLE / DESCARGABLE) */
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 mb-4 no-print">
              <button
                onClick={() => setMostrarCorteZ(false)}
                className="flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-gray-900 bg-gray-100 px-3 py-1.5 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Volver al Resumen
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleDescargar}
                  className="flex items-center gap-1.5 text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-all shadow-xs"
                  title="Descargar comprobante en texto"
                >
                  {descargado ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Download className="w-3.5 h-3.5" />}
                  {descargado ? '¡Descargado!' : 'Descargar'}
                </button>

                <button
                  onClick={handleImprimir}
                  className="flex items-center gap-1.5 text-xs font-bold bg-gray-900 text-white hover:bg-gray-800 px-3.5 py-1.5 rounded-lg transition-all shadow-sm"
                  title="Imprimir acta oficial"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Imprimir Comprobante
                </button>

                <button
                  onClick={handleFinalizar}
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
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
                className="bg-white border-2 border-dashed border-gray-300 rounded-xl p-5 font-mono text-xs text-gray-800 leading-relaxed shadow-inner"
              >
                {/* Cabecera Fiscal */}
                <div className="text-center pb-4 border-b border-gray-200">
                  <div className="flex items-center justify-center gap-2 font-black text-sm tracking-widest uppercase text-gray-900">
                    <FileText className="w-4 h-4 text-quantix-600" />
                    QUANTIX ENTERPRISE RETAIL
                  </div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">SISTEMA FISCAL POS • LIBRO DE CAJA</p>
                  <h2 className="text-base font-black text-gray-900 mt-2 tracking-tight">ACTA DE CIERRE DIARIO (CORTE Z)</h2>
                  <span className="inline-block px-3 py-0.5 mt-1 bg-gray-100 border border-gray-300 rounded text-[11px] font-bold text-gray-800">
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
                <div className="py-3 border-b border-gray-200 space-y-1 text-[11px] bg-gray-50/70 p-2.5 rounded-lg my-2">
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
                className="px-6 py-2.5 bg-quantix-600 hover:bg-quantix-700 text-white font-bold rounded-xl text-xs shadow-md transition-all"
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
