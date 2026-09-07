import React, { useState } from 'react';
import { useCajaStore } from '../store/cajaStore';
import { Banknote, Monitor, Loader2, AlertCircle } from 'lucide-react';

interface Props {
  onSuccess?: () => void;
}

export default function AperturaCajaModal({ onSuccess }: Props) {
  const [fondoInicial, setFondoInicial] = useState('500.00');
  const [terminalId, setTerminalId] = useState('TERM-01');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const abrirCaja = useCajaStore((state) => state.abrirCaja);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const monto = parseFloat(fondoInicial);
    if (isNaN(monto) || monto < 0) {
      setError('Ingresa un monto de fondo inicial válido');
      setLoading(false);
      return;
    }

    try {
      await abrirCaja(monto, terminalId);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al aperturar la caja');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-quantix-100 text-quantix-600 rounded-xl">
            <Banknote className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Apertura de Turno de Caja</h2>
            <p className="text-xs text-gray-500 font-medium">Requisito operativo previo a la venta</p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 text-xs text-amber-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>El fondo inicial ingresado será auditado en el arqueo ciego al cierre de tu turno.</span>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Terminal / Número de Caja
            </label>
            <div className="relative">
              <Monitor className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                required
                value={terminalId}
                onChange={(e) => setTerminalId(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-quantix-500 outline-none"
                placeholder="Ej. TERM-01"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Fondo Inicial en Gaveta ($ Efectivo base)
            </label>
            <div className="relative">
              <span className="text-gray-400 absolute left-3 top-2.5 font-bold">$</span>
              <input
                type="number"
                step="0.50"
                min="0"
                required
                value={fondoInicial}
                onChange={(e) => setFondoInicial(e.target.value)}
                className="w-full pl-8 pr-3 py-2.5 border border-gray-300 rounded-xl text-lg font-bold text-gray-800 focus:ring-2 focus:ring-quantix-500 outline-none"
                placeholder="0.00"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-quantix-600 hover:bg-quantix-700 disabled:opacity-70 text-white font-bold rounded-xl shadow-lg transition-all text-sm flex items-center justify-center gap-2 mt-6"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar Apertura e Iniciar Turno'}
          </button>
        </form>
      </div>
    </div>
  );
}
