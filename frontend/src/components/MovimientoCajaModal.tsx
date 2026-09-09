import React, { useState } from 'react';
import api from '../services/api';
import { ArrowDownLeft, ArrowUpRight, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { mostrarToast } from '../hooks/useWebSocket';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (msg: string) => void;
}

export default function MovimientoCajaModal({ isOpen, onClose, onSuccess }: Props) {
  const [tipo, setTipo] = useState<'INGRESO' | 'EGRESO'>('INGRESO');
  const [monto, setMonto] = useState('');
  const [concepto, setConcepto] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const quickConceptosIngreso = [
    'Dotación inicial extra',
    'Cambio en monedas/billetes',
    'Reintegro de gasto',
    'Aporte de caja central'
  ];

  const quickConceptosEgreso = [
    'Pago de insumos urgentes',
    'Compra de bolsas/papelería',
    'Retiro de efectivo por seguridad',
    'Pago de servicios menores'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const montoNum = parseFloat(monto);
    if (isNaN(montoNum) || montoNum <= 0) {
      setErrorMsg('Ingresa un monto válido mayor a $0.00');
      return;
    }

    if (!concepto.trim()) {
      setErrorMsg('Debes especificar el motivo o concepto del movimiento');
      return;
    }

    setLoading(true);
    try {
      await api.post('/caja/movimientos', {
        tipo,
        monto: montoNum,
        concepto: concepto.trim()
      });

      const msg = `Movimiento registrado: ${tipo === 'INGRESO' ? 'Entrada' : 'Salida'} de $${montoNum.toFixed(2)}`;
      mostrarToast({
        titulo: 'Movimiento de Caja',
        mensaje: msg,
        severidad: 'INFO'
      });
      if (onSuccess) onSuccess(msg);
      handleCerrar();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || err.message || 'Error al registrar el movimiento de caja');
    } finally {
      setLoading(false);
    }
  };

  const handleCerrar = () => {
    setMonto('');
    setConcepto('');
    setErrorMsg(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-inverse-surface/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-surface-container-lowest rounded-3xl shadow-2xl max-w-md w-full p-6 border border-outline-variant/30 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-outline-variant/20">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
              tipo === 'INGRESO' ? 'bg-primary-container text-on-primary-container' : 'bg-amber-100 text-amber-900 border border-amber-300'
            }`}>
              {tipo === 'INGRESO' ? (
                <ArrowDownLeft className="w-6 h-6 text-primary" />
              ) : (
                <ArrowUpRight className="w-6 h-6 text-amber-700" />
              )}
            </div>
            <div>
              <h2 className="font-headline-md text-title-lg text-on-surface">Movimiento de Caja</h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Control de entradas y salidas extraordinarias en gaveta
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCerrar}
            className="w-9 h-9 rounded-full bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error alert */}
        {errorMsg && (
          <div className="mt-4 p-3 bg-error-container text-on-error-container rounded-2xl flex items-center gap-2.5 text-body-sm font-medium border border-error/20">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 overflow-y-auto pr-1">
          {/* Selector de Tipo */}
          <div>
            <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider mb-1.5">
              Tipo de Operación
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-surface-container-low rounded-2xl border border-outline-variant/20">
              <button
                type="button"
                onClick={() => setTipo('INGRESO')}
                className={`py-2.5 px-3 rounded-xl font-headline-md text-body-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  tipo === 'INGRESO'
                    ? 'bg-primary text-on-primary shadow-xs font-bold'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                }`}
              >
                <ArrowDownLeft className="w-4 h-4" />
                <span>Entrada (Ingreso)</span>
              </button>

              <button
                type="button"
                onClick={() => setTipo('EGRESO')}
                className={`py-2.5 px-3 rounded-xl font-headline-md text-body-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  tipo === 'EGRESO'
                    ? 'bg-amber-600 text-white shadow-xs font-bold'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                }`}
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>Salida (Egreso)</span>
              </button>
            </div>
          </div>

          {/* Input Monto */}
          <div>
            <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider mb-1.5">
              Monto en Efectivo ($) *
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant font-bold text-lg">$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                required
                autoFocus
                className="w-full h-12 pl-9 pr-4 rounded-full bg-surface-container-low text-on-surface font-label-numeric-lg text-title-lg font-bold focus:bg-surface-container focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Concepto / Motivo */}
          <div>
            <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider mb-1.5">
              Concepto / Motivo *
            </label>
            <input
              type="text"
              placeholder="Ej. Dotación de monedas o pago de papelería"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              required
              maxLength={255}
              className="w-full h-11 px-4 rounded-full bg-surface-container-low text-on-surface font-body-md focus:bg-surface-container focus:outline-none transition-all"
            />
          </div>

          {/* Sugerencias Rápidas */}
          <div>
            <span className="block font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider mb-1.5">
              Motivos Frecuentes
            </span>
            <div className="flex flex-wrap gap-1.5">
              {(tipo === 'INGRESO' ? quickConceptosIngreso : quickConceptosEgreso).map((sug, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setConcepto(sug)}
                  className="px-3 py-1 rounded-full bg-surface-container-low hover:bg-surface-container text-body-sm text-on-surface-variant hover:text-on-surface border border-outline-variant/20 transition-all cursor-pointer text-xs"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>

          {/* Acciones */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline-variant/20">
            <button
              type="button"
              onClick={handleCerrar}
              disabled={loading}
              className="h-11 px-5 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-headline-md text-body-md transition-all cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`h-11 px-6 rounded-full text-white font-headline-md text-body-md transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
                tipo === 'INGRESO' ? 'bg-primary hover:opacity-95' : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>{loading ? 'Registrando...' : 'Confirmar Movimiento'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
