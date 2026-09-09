import React, { useState, useEffect } from 'react';
import { 
  Sliders, Mail, Save, 
  Send, CheckCircle2, AlertCircle, Eye, EyeOff, Loader2,
  Calendar, DollarSign
} from 'lucide-react';
import api from '../services/api';

export default function Configuracion() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // SMTP
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('alertas@quantix.local');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailPrueba, setEmailPrueba] = useState('');
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [smtpResult, setSmtpResult] = useState<{ tipo: 'success' | 'error'; mensaje: string } | null>(null);

  // Políticas
  const [toleranciaCaja, setToleranciaCaja] = useState('5.00');
  const [fefoDias1, setFefoDias1] = useState('15');
  const [fefoDias2, setFefoDias2] = useState('30');
  const [rfmMultiplicador, setRfmMultiplicador] = useState('1.5');

  const cargarConfiguraciones = async () => {
    try {
      setLoading(true);
      const res = await api.get('/configuracion');
      const data = res.data;

      // SMTP
      setSmtpHost(data.smtp?.smtp_host || 'smtp.gmail.com');
      setSmtpPort(String(data.smtp?.smtp_port || 587));
      setSmtpUser(data.smtp?.smtp_user || 'alertas@quantix.local');
      if (data.smtp?.tiene_password) {
        setSmtpPassword('••••••••');
      }

      // Políticas
      setToleranciaCaja(String(data.politicas?.caja_tolerancia_descuadre || '5.00'));
      setFefoDias1(String(data.politicas?.fefo_alerta_dias_1 || 15));
      setFefoDias2(String(data.politicas?.fefo_alerta_dias_2 || 30));
      setRfmMultiplicador(String(data.politicas?.rfm_multiplo_reactivacion || '1.5'));
    } catch {
      setErrorMsg('No se pudieron cargar los parámetros del servidor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => void cargarConfiguraciones());
  }, []);

  const handleGuardarCambios = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(null);
    setErrorMsg(null);

    const payload = {
      items: [
        { clave: 'smtp_host', valor: smtpHost },
        { clave: 'smtp_port', valor: smtpPort },
        { clave: 'smtp_user', valor: smtpUser },
        ...(smtpPassword && smtpPassword !== '••••••••' ? [{ clave: 'smtp_password', valor: smtpPassword }] : []),
        { clave: 'caja_tolerancia_descuadre', valor: toleranciaCaja },
        { clave: 'fefo_alerta_dias_1', valor: fefoDias1 },
        { clave: 'fefo_alerta_dias_2', valor: fefoDias2 },
        { clave: 'rfm_multiplo_reactivacion', valor: rfmMultiplicador }
      ]
    };

    try {
      await api.put('/configuracion', payload);
      setSaveSuccess('Parámetros globales guardados exitosamente.');
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Error al guardar los parámetros.');
    } finally {
      setSaving(false);
    }
  };

  const handleProbarSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailPrueba) return;

    setTestingSmtp(true);
    setSmtpResult(null);

    try {
      const res = await api.post('/configuracion/smtp/probar', { email_destino: emailPrueba });
      setSmtpResult({
        tipo: 'success',
        mensaje: res.data.mensaje || 'Correo de prueba enviado correctamente.'
      });
    } catch (err: any) {
      setSmtpResult({
        tipo: 'error',
        mensaje: err.response?.data?.detail || 'Fallo de conexión con el servidor SMTP.'
      });
    } finally {
      setTestingSmtp(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-quantix-600" />
          <p className="text-gray-500 font-medium text-sm">Cargando parámetros globales...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      {/* Toast Feedback */}
      {saveSuccess && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-2xl shadow-xl text-sm font-bold">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {errorMsg && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 bg-red-50 text-red-800 border border-red-200 rounded-2xl shadow-xl text-sm font-bold">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-quantix-50 text-quantix-600 rounded-2xl border border-quantix-100 shadow-sm">
              <Sliders className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">Ajustes del Sistema</h1>
              <p className="text-gray-500 text-xs font-medium">
                Políticas de caducidad FEFO, tolerancia de arqueo de caja y pasarela SMTP
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleGuardarCambios}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-quantix-600 hover:bg-quantix-700 text-white rounded-xl font-bold text-sm shadow-md transition-all active:scale-95 disabled:opacity-50 self-start md:self-auto"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>{saving ? 'Guardando...' : 'Guardar Todos los Cambios'}</span>
        </button>
      </div>

      <form onSubmit={handleGuardarCambios} className="space-y-6">
        
        {/* Grid de Políticas Operativas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Tarjeta 1: Políticas Sanitarias FEFO */}
          <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Políticas Sanitarias FEFO</h3>
                <p className="text-xs text-gray-400">Umbrales para el semáforo y alertas automáticas de caducidad</p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 uppercase mb-1">
                  Alerta Amarilla / Riesgo Medio (Días previos)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={fefoDias2}
                    onChange={(e) => setFefoDias2(e.target.value)}
                    className="w-full px-3 py-2.5 border rounded-xl font-mono text-sm font-bold focus:ring-2 focus:ring-quantix-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">días</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">Lotes que caduquen dentro de este lapso entran a semáforo preventivo.</p>
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase mb-1">
                  Alerta Roja / Riesgo Inminente (Días previos)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={fefoDias1}
                    onChange={(e) => setFefoDias1(e.target.value)}
                    className="w-full px-3 py-2.5 border rounded-xl font-mono text-sm font-bold text-red-600 focus:ring-2 focus:ring-quantix-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">días</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">Dispara sugerencia prioritaria de liquidación y notificación a supervisión.</p>
              </div>
            </div>
          </div>

          {/* Tarjeta 2: Políticas de Caja y Arqueo Ciego */}
          <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Políticas de Caja & Arqueo Ciego</h3>
                <p className="text-xs text-gray-400">Tolerancias de gaveta antes de registrar auditoría forense</p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 uppercase mb-1">
                  Tolerancia Máxima de Descuadre ($ MXN)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
                  <input
                    type="number"
                    step="0.50"
                    min="0"
                    value={toleranciaCaja}
                    onChange={(e) => setToleranciaCaja(e.target.value)}
                    className="w-full pl-8 pr-3 py-2.5 border rounded-xl font-mono text-sm font-bold text-gray-800 focus:ring-2 focus:ring-quantix-500"
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  Si la diferencia entre el efectivo contado y el teórico supera este valor, se marca el turno como DESCUADRE y se registra en la bitácora de auditoría.
                </p>
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase mb-1">
                  Factor de Reactivación Antipánico (CRM)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="1.0"
                    max="5.0"
                    value={rfmMultiplicador}
                    onChange={(e) => setRfmMultiplicador(e.target.value)}
                    className="w-full px-3 py-2.5 border rounded-xl font-mono text-sm font-bold text-purple-700 focus:ring-2 focus:ring-quantix-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">× ciclo</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  Multiplicador sobre el ciclo intercompra habitual para clasificar a un cliente regular en riesgo de deserción.
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Tarjeta 3: Pasarela SMTP */}
        <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-purple-100 text-purple-800 rounded-xl">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Notificaciones por Correo Electrónico (SMTP)</h3>
              <p className="text-xs text-gray-400">Servidor saliente para avisos de roturas de stock, descuadres y cupones</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-gray-700 uppercase mb-1">Servidor SMTP (Host)</label>
              <input
                type="text"
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                placeholder="smtp.gmail.com"
                className="w-full px-3 py-2.5 border rounded-xl font-mono text-sm focus:ring-2 focus:ring-quantix-500"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 uppercase mb-1">Puerto</label>
              <input
                type="number"
                value={smtpPort}
                onChange={(e) => setSmtpPort(e.target.value)}
                placeholder="587"
                className="w-full px-3 py-2.5 border rounded-xl font-mono text-sm focus:ring-2 focus:ring-quantix-500"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 uppercase mb-1">Usuario / Remitente</label>
              <input
                type="email"
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
                placeholder="alertas@quantix.local"
                className="w-full px-3 py-2.5 border rounded-xl font-mono text-sm focus:ring-2 focus:ring-quantix-500"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 uppercase mb-1">Contraseña / Token de Aplicación</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={smtpPassword}
                  onChange={(e) => setSmtpPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3 py-2.5 border rounded-xl font-mono text-sm pr-10 focus:ring-2 focus:ring-quantix-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Test de Correo */}
          <div className="mt-5 pt-5 border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex-1 w-full flex items-center gap-2">
              <input
                type="email"
                value={emailPrueba}
                onChange={(e) => setEmailPrueba(e.target.value)}
                placeholder="correo-destino@ejemplo.com para prueba..."
                className="flex-1 px-3 py-2 border rounded-xl text-xs font-semibold focus:ring-2 focus:ring-quantix-500"
              />
              <button
                type="button"
                onClick={handleProbarSmtp}
                disabled={testingSmtp || !emailPrueba}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl disabled:opacity-50 transition-colors shrink-0"
              >
                {testingSmtp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>{testingSmtp ? 'Enviando...' : 'Enviar Prueba'}</span>
              </button>
            </div>

            {smtpResult && (
              <span className={`text-xs font-bold ${smtpResult.tipo === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                {smtpResult.mensaje}
              </span>
            )}
          </div>
        </div>

      </form>

      </div>
    </div>
  );
}
