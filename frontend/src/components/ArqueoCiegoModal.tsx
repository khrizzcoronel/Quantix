import { useState } from 'react';
import { useCajaStore, type ResultadoArqueo } from '../store/cajaStore';
import { EyeOff, CheckCircle2, AlertTriangle, ShieldAlert, Loader2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function ArqueoCiegoModal({ isOpen, onClose }: Props) {
  const [efectivo, setEfectivo] = useState('');
  const [tarjeta, setTarjeta] = useState('');
  const [transferencia, setTransferencia] = useState('');
  const [otros, setOtros] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ResultadoArqueo | null>(null);

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
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFinalizar = () => {
    setResultado(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        {!resultado ? (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-amber-100 text-amber-700 rounded-xl">
                <EyeOff className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Arqueo Ciego de Cierre</h2>
                <p className="text-xs text-gray-500 font-medium">Conteo físico obligatorio sin visibilidad del saldo teórico (RF-SEG-01)</p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-5 text-xs text-blue-800">
              Ingresa el total contado físicamente en gaveta y los váuchers de terminal. El sistema calculará la discrepancia y cerrará el turno.
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
        ) : (
          <div className="text-center py-2">
            <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4">
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
                <span className="font-semibold text-gray-800">${resultado.total_teorico.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Total Físico Declarado:</span>
                <span className="font-semibold text-gray-800">${resultado.total_fisico_declarado.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-200 font-bold">
                <span>Diferencia:</span>
                <span className={resultado.diferencia === 0 ? 'text-green-600' : resultado.diferencia > 0 ? 'text-amber-600' : 'text-red-600'}>
                  {resultado.diferencia > 0 ? `+$${resultado.diferencia.toFixed(2)}` : `-$${Math.abs(resultado.diferencia).toFixed(2)}`}
                </span>
              </div>
            </div>

            {resultado.requiere_auditoria && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-lg mb-6 text-left">
                <strong>Alerta de Seguridad:</strong> La diferencia supera la tolerancia máxima ($5.00). Se ha generado un registro en la Bitácora de Auditoría Forense y se notificó al Supervisor de Turno.
              </div>
            )}

            <button
              onClick={handleFinalizar}
              className="w-full py-3 bg-quantix-600 hover:bg-quantix-700 text-white font-bold rounded-xl shadow-lg transition-all text-sm"
            >
              Aceptar y Salir de Turno
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
