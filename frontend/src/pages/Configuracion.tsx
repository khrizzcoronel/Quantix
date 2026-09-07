import { useState, useEffect } from 'react';
import { 
  RefreshCw, Mail, Shield, Save, 
  Send, CheckCircle2, AlertCircle, Eye, EyeOff, Loader2 
} from 'lucide-react';
import api from '../services/api';

export default function Configuracion() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ETL
  const [etlIntervalo, setEtlIntervalo] = useState('5');
  const [etlHoraNocturna, setEtlHoraNocturna] = useState('02:00');
  const [syncingEtl, setSyncingEtl] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // SMTP
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('alertas@quantix.local');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailPrueba, setEmailPrueba] = useState('');
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [smtpResult, setSmtpResult] = useState<string | null>(null);

  // Políticas
  const [toleranciaCaja, setToleranciaCaja] = useState('5.00');
  const [fefoDias1, setFefoDias1] = useState('15');
  const [fefoDias2, setFefoDias2] = useState('30');

  useEffect(() => {
    cargarConfiguraciones();
  }, []);

  const cargarConfiguraciones = async () => {
    try {
      setLoading(true);
      const res = await api.get('/configuracion');
      const data = res.data;

      // ETL
      setEtlIntervalo(String(data.etl?.etl_intervalo_minutos || 5));
      setEtlHoraNocturna(data.etl?.etl_hora_cierre_diario || '02:00');

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
    } catch (err: any) {
      setErrorMsg('No se pudieron cargar las configuraciones del servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuardarCambios = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(null);
    setErrorMsg(null);

    const payload = {
      items: [
        { clave: 'etl_intervalo_minutos', valor: etlIntervalo },
        { clave: 'etl_hora_cierre_diario', valor: etlHoraNocturna },
        { clave: 'smtp_host', valor: smtpHost },
        { clave: 'smtp_port', valor: smtpPort },
        { clave: 'smtp_user', valor: smtpUser },
        { clave: 'smtp_password', valor: smtpPassword },
        { clave: 'caja_tolerancia_descuadre', valor: toleranciaCaja },
        { clave: 'fefo_alerta_dias_1', valor: fefoDias1 },
        { clave: 'fefo_alerta_dias_2', valor: fefoDias2 },
      ]
    };

    try {
      const res = await api.put('/configuracion', payload);
      setSaveSuccess(res.data.hot_reload_etl 
        ? '¡Configuraciones guardadas y frecuencia de ETL reprogramada en caliente exitosamente!' 
        : '¡Configuraciones guardadas exitosamente!');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Error al guardar las configuraciones.');
    } finally {
      setSaving(false);
    }
  };

  const handleForzarSincronizacion = async () => {
    setSyncingEtl(true);
    setSyncMessage(null);
    try {
      const res = await api.post('/configuracion/etl/sincronizar-ahora');
      setSyncMessage(res.data.mensaje);
    } catch (err: any) {
      setSyncMessage('Error al disparar la sincronización del ETL.');
    } finally {
      setSyncingEtl(false);
    }
  };

  const handleProbarSmtp = async () => {
    if (!emailPrueba) {
      setSmtpResult('Ingresa un correo destinatario para la prueba.');
      return;
    }
    setTestingSmtp(true);
    setSmtpResult(null);
    try {
      const res = await api.post('/configuracion/smtp/probar', { destinatario: emailPrueba });
      setSmtpResult(res.data.mensaje);
    } catch (err: any) {
      setSmtpResult(err.response?.data?.detail || 'Fallo de conexión con el servidor SMTP.');
    } finally {
      setTestingSmtp(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-quantix-600" />
          <span className="text-sm font-bold text-gray-600">Cargando parámetros del sistema...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 h-full overflow-y-auto bg-gray-50">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-black uppercase tracking-wider">
              Nivel Estratégico • Alta Dirección
            </span>
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight mt-2">Ajustes Globales del Sistema</h2>
          <p className="text-gray-500 mt-0.5 font-medium text-sm">Control dinámico de sincronización ETL, notificaciones SMTP y políticas operativas</p>
        </div>

        <button
          onClick={handleGuardarCambios}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-3 bg-quantix-600 hover:bg-quantix-700 disabled:opacity-70 text-white rounded-xl font-black text-sm shadow-lg shadow-quantix-600/20 transition-all active:scale-95"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar Cambios
        </button>
      </div>

      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm p-4 rounded-2xl mb-6 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-semibold">{saveSuccess}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-sm p-4 rounded-2xl mb-6 flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleGuardarCambios} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Tarjeta 1: ETL & DuckDB */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <RefreshCw className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Tubería ETL & DuckDB (Medallion)</h3>
                <p className="text-xs text-gray-500">Sincronización de PostgreSQL hacia la capa columnar Gold</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                  Frecuencia de Micro-Batch (Minutos)
                </label>
                <select
                  value={etlIntervalo}
                  onChange={(e) => setEtlIntervalo(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-quantix-500 outline-none"
                >
                  <option value="1">Cada 1 minuto (Tiempo casi real - Picos de venta)</option>
                  <option value="5">Cada 5 minutos (Recomendado estándar)</option>
                  <option value="10">Cada 10 minutos</option>
                  <option value="15">Cada 15 minutos</option>
                  <option value="30">Cada 30 minutos</option>
                  <option value="60">Cada 60 minutos (Baja exigencia de servidor)</option>
                </select>
                <p className="text-[11px] text-gray-400 mt-1">
                  Al guardar, el planificador reprograma la tarea en memoria inmediatamente.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                  Hora de Reconstrucción Nocturna Profunda
                </label>
                <input
                  type="time"
                  value={etlHoraNocturna}
                  onChange={(e) => setEtlHoraNocturna(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-mono text-gray-800 focus:ring-2 focus:ring-quantix-500 outline-none"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500">¿Deseas refrescar métricas de BI ahora?</span>
              <button
                type="button"
                onClick={handleForzarSincronizacion}
                disabled={syncingEtl}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-colors border border-blue-200"
              >
                {syncingEtl ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Sincronizar DuckDB Ahora
              </button>
            </div>
            {syncMessage && (
              <p className="text-xs text-blue-600 mt-2 font-medium bg-blue-50/50 p-2 rounded-lg">
                {syncMessage}
              </p>
            )}
          </div>
        </div>

        {/* Tarjeta 2: Notificaciones & Servidor SMTP */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Servidor de Correos & Alertas (SMTP)</h3>
                <p className="text-xs text-gray-500">Envío de reportes ejecutivos y alertas de descuadre</p>
              </div>
            </div>

            <div className="space-y-3.5">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Servidor SMTP Host
                  </label>
                  <input
                    type="text"
                    required
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-quantix-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Puerto
                  </label>
                  <input
                    type="number"
                    required
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-quantix-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Usuario / Correo Emisor
                </label>
                <input
                  type="email"
                  required
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-quantix-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Token / Contraseña de Aplicación
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={smtpPassword}
                    onChange={(e) => setSmtpPassword(e.target.value)}
                    placeholder="Dejar intacto para conservar la actual"
                    className="w-full pl-3 pr-10 py-2 bg-gray-50 border border-gray-300 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-quantix-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-gray-100">
            <span className="block text-xs font-bold text-gray-500 mb-2">Comprobar conectividad SMTP:</span>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="correo_destino@gmail.com"
                value={emailPrueba}
                onChange={(e) => setEmailPrueba(e.target.value)}
                className="flex-1 px-3 py-1.5 text-xs bg-gray-50 border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-quantix-500"
              />
              <button
                type="button"
                onClick={handleProbarSmtp}
                disabled={testingSmtp}
                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-200 transition-colors"
              >
                {testingSmtp ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                Probar
              </button>
            </div>
            {smtpResult && (
              <p className="text-xs text-emerald-700 mt-2 font-medium bg-emerald-50/50 p-2 rounded-lg">
                {smtpResult}
              </p>
            )}
          </div>
        </div>

        {/* Tarjeta 3: Políticas de Tienda & Antifraude */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 lg:col-span-2">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Políticas de Control, Mermas y Antifraude</h3>
              <p className="text-xs text-gray-500">Umbrales parametrizables que rigen la operación en cajas y bodega</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-50/60 p-4 rounded-xl border border-gray-200/70">
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Tolerancia Descuadre de Caja ($)
              </label>
              <input
                type="number"
                step="0.50"
                min="0"
                required
                value={toleranciaCaja}
                onChange={(e) => setToleranciaCaja(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-base font-bold text-gray-900 outline-none focus:ring-2 focus:ring-quantix-500"
              />
              <p className="text-[11px] text-gray-500 mt-1.5">
                Diferencias en el arqueo ciego superiores a este monto disparan una alerta de auditoría forense.
              </p>
            </div>

            <div className="bg-gray-50/60 p-4 rounded-xl border border-gray-200/70">
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Alerta FEFO 1 (Días)
              </label>
              <input
                type="number"
                min="1"
                required
                value={fefoDias1}
                onChange={(e) => setFefoDias1(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-base font-bold text-gray-900 outline-none focus:ring-2 focus:ring-quantix-500"
              />
              <p className="text-[11px] text-gray-500 mt-1.5">
                Umbral crítico: Lotes con vencimiento menor o igual a estos días aparecen en rojo para liquidación rápida.
              </p>
            </div>

            <div className="bg-gray-50/60 p-4 rounded-xl border border-gray-200/70">
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Alerta FEFO 2 (Días)
              </label>
              <input
                type="number"
                min="1"
                required
                value={fefoDias2}
                onChange={(e) => setFefoDias2(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-base font-bold text-gray-900 outline-none focus:ring-2 focus:ring-quantix-500"
              />
              <p className="text-[11px] text-gray-500 mt-1.5">
                Umbral preventivo: Lotes que entran en la ventana de supervisión táctica para el monitoreo de mermas.
              </p>
            </div>
          </div>
        </div>

      </form>
    </div>
  );
}
