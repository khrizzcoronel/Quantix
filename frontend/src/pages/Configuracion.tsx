import React, { useState, useEffect } from 'react';
import { 
  Sliders, Mail, Save, 
  Send, Eye, EyeOff, Loader2,
  Calendar, DollarSign
} from 'lucide-react';
import api from '../services/api';
import { mostrarToast } from '../hooks/useWebSocket';
import { 
  validatePositiveNumber, 
  validateEmail, 
  validateRequired 
} from '../utils/validation';

export default function Configuracion() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  // SMTP
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('alertas@quantix.local');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailPrueba, setEmailPrueba] = useState('');
  const [emailPruebaError, setEmailPruebaError] = useState<string | null>(null);
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
      mostrarToast({
        titulo: 'Error de Configuración',
        mensaje: 'No se pudieron cargar los parámetros del servidor.',
        severidad: 'CRITICO',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => void cargarConfiguraciones());
  }, []);

  const validarConfiguracion = (): boolean => {
    const errs: Record<string, string | null> = {};

    const errDias1 = validatePositiveNumber(fefoDias1, 'Días de alerta roja', { min: 1, max: 90, decimalsAllowed: false });
    if (errDias1) errs.fefoDias1 = errDias1;

    const errDias2 = validatePositiveNumber(fefoDias2, 'Días de alerta amarilla', { min: 1, max: 180, decimalsAllowed: false });
    if (errDias2) {
      errs.fefoDias2 = errDias2;
    } else if (!errDias1 && parseInt(fefoDias2, 10) <= parseInt(fefoDias1, 10)) {
      errs.fefoDias2 = 'La alerta amarilla debe ser estrictamente mayor a los días de alerta roja';
    }

    const errTol = validatePositiveNumber(toleranciaCaja, 'Tolerancia de caja', { allowZero: true, min: 0, max: 10000 });
    if (errTol) errs.toleranciaCaja = errTol;

    const errRfm = validatePositiveNumber(rfmMultiplicador, 'Factor RFM', { min: 1.0, max: 10.0 });
    if (errRfm) errs.rfmMultiplicador = errRfm;

    const errHost = validateRequired(smtpHost, 'Servidor SMTP (Host)', 3);
    if (errHost) errs.smtpHost = errHost;

    const errPort = validatePositiveNumber(smtpPort, 'Puerto SMTP', { min: 1, max: 65535, decimalsAllowed: false });
    if (errPort) errs.smtpPort = errPort;

    const errUser = validateEmail(smtpUser);
    if (errUser) errs.smtpUser = errUser;

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleGuardarCambios = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validarConfiguracion()) {
      mostrarToast({
        titulo: 'Validación Incompleta',
        mensaje: 'Por favor corrige los campos con error antes de guardar.',
        severidad: 'WARNING',
      });
      return;
    }

    setSaving(true);

    const payload = {
      items: [
        { clave: 'smtp_host', valor: smtpHost.trim() },
        { clave: 'smtp_port', valor: smtpPort.trim() },
        { clave: 'smtp_user', valor: smtpUser.trim() },
        ...(smtpPassword && smtpPassword !== '••••••••' ? [{ clave: 'smtp_password', valor: smtpPassword }] : []),
        { clave: 'caja_tolerancia_descuadre', valor: toleranciaCaja.trim() },
        { clave: 'fefo_alerta_dias_1', valor: fefoDias1.trim() },
        { clave: 'fefo_alerta_dias_2', valor: fefoDias2.trim() },
        { clave: 'rfm_multiplo_reactivacion', valor: rfmMultiplicador.trim() }
      ]
    };

    try {
      await api.put('/configuracion', payload);
      mostrarToast({
        titulo: 'Configuración Guardada',
        mensaje: 'Parámetros globales guardados exitosamente.',
        severidad: 'SUCCESS',
      });
    } catch (err: any) {
      const errorText = err.response?.data?.detail || 'Error al guardar los parámetros.';
      mostrarToast({
        titulo: 'Error de Configuración',
        mensaje: errorText,
        severidad: 'CRITICO',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleProbarSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const errMail = validateEmail(emailPrueba);
    if (errMail) {
      setEmailPruebaError(errMail);
      return;
    }
    setEmailPruebaError(null);

    setTestingSmtp(true);
    setSmtpResult(null);

    try {
      const res = await api.post('/configuracion/smtp/probar', { email_destino: emailPrueba.trim() });
      const exitoMsg = res.data.mensaje || 'Correo de prueba enviado correctamente.';
      setSmtpResult({
        tipo: 'success',
        mensaje: exitoMsg
      });
      mostrarToast({
        titulo: 'Prueba SMTP Exitosa',
        mensaje: exitoMsg,
        severidad: 'SUCCESS',
      });
    } catch (err: any) {
      const errorText = err.response?.data?.detail || 'Fallo de conexión con el servidor SMTP.';
      setSmtpResult({
        tipo: 'error',
        mensaje: errorText
      });
      mostrarToast({
        titulo: 'Error en Servidor SMTP',
        mensaje: errorText,
        severidad: 'CRITICO',
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
    <div className="h-full overflow-y-auto bg-background text-on-surface p-6 md:p-8 select-none">
      <div className="w-full space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-surface-container-high/60 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-surface-container-low text-primary rounded-2xl flex items-center justify-center shadow-xs">
              <Sliders className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="px-2.5 py-0.5 bg-tertiary-fixed text-on-tertiary-fixed rounded-full font-label-caps text-[10px] font-bold uppercase tracking-wider">
                  Nivel Estratégico • Dirección
                </span>
              </div>
              <h1 className="font-headline-xl text-2xl md:text-3xl font-bold text-on-surface tracking-tight">
                Ajustes & Políticas del Sistema
              </h1>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Políticas operativas sanitarias FEFO, tolerancias de gaveta y pasarela SMTP
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleGuardarCambios}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-primary-container hover:bg-primary-container/90 text-on-primary-container rounded-full font-headline-md text-title-md font-bold shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 cursor-pointer self-start md:self-auto"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          <span>{saving ? 'Guardando...' : 'Guardar Parámetros'}</span>
        </button>
      </div>

      <form onSubmit={handleGuardarCambios} className="space-y-6" noValidate>
        
        {/* Grid de Políticas Operativas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Tarjeta 1: Políticas Sanitarias FEFO */}
          <div className="bg-surface-container-lowest rounded-3xl p-7 border border-surface-container-high/60 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-11 h-11 bg-primary-fixed/30 text-on-primary-fixed-variant rounded-2xl flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-headline-md text-title-lg font-bold text-on-surface">Políticas Sanitarias FEFO</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">Umbrales para el semáforo y alertas preventivas de caducidad</p>
                </div>
              </div>

              <div className="space-y-5 text-body-sm">
                <div>
                  <label className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-bold block mb-1.5">
                    Alerta Amarilla / Riesgo Medio (Días previos) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="180"
                      value={fefoDias2}
                      onChange={(e) => {
                        setFefoDias2(e.target.value);
                        if (errors.fefoDias2) setErrors((prev) => ({ ...prev, fefoDias2: null }));
                      }}
                      className={`w-full px-4 py-3 rounded-2xl font-mono text-body-md font-bold text-on-surface focus:outline-none transition-all ${
                        errors.fefoDias2
                          ? 'bg-error-container/10 border-2 border-error focus:ring-2 focus:ring-error/20'
                          : 'bg-surface-container-low focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20'
                      }`}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-outline font-title-md text-body-sm">días</span>
                  </div>
                  {errors.fefoDias2 && (
                    <div className="flex items-center gap-1.5 text-error text-xs font-medium mt-1 px-1 animate-in fade-in">
                      <span className="material-symbols-outlined text-[15px]">error</span>
                      <span>{errors.fefoDias2}</span>
                    </div>
                  )}
                  <p className="font-body-sm text-[11px] text-outline mt-1.5">Lotes que caduquen dentro de este lapso entran en semáforo preventivo.</p>
                </div>

                <div>
                  <label className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-bold block mb-1.5">
                    Alerta Roja / Riesgo Inminente (Días previos) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="90"
                      value={fefoDias1}
                      onChange={(e) => {
                        setFefoDias1(e.target.value);
                        if (errors.fefoDias1) setErrors((prev) => ({ ...prev, fefoDias1: null }));
                      }}
                      className={`w-full px-4 py-3 rounded-2xl font-mono text-body-md font-bold text-error focus:outline-none transition-all ${
                        errors.fefoDias1
                          ? 'bg-error-container/10 border-2 border-error focus:ring-2 focus:ring-error/20'
                          : 'bg-surface-container-low focus:bg-surface-container-lowest focus:ring-2 focus:ring-error/20'
                      }`}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-outline font-title-md text-body-sm">días</span>
                  </div>
                  {errors.fefoDias1 && (
                    <div className="flex items-center gap-1.5 text-error text-xs font-medium mt-1 px-1 animate-in fade-in">
                      <span className="material-symbols-outlined text-[15px]">error</span>
                      <span>{errors.fefoDias1}</span>
                    </div>
                  )}
                  <p className="font-body-sm text-[11px] text-outline mt-1.5">Dispara sugerencia prioritaria de rotación FEFO e inspección en bodega.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tarjeta 2: Políticas de Caja y Arqueo Ciego */}
          <div className="bg-surface-container-lowest rounded-3xl p-7 border border-surface-container-high/60 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-11 h-11 bg-secondary-fixed text-on-secondary-fixed rounded-2xl flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-secondary" />
                </div>
                <div>
                  <h3 className="font-headline-md text-title-lg font-bold text-on-surface">Tolerancias de Caja & Arqueo</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">Márgenes permitidos antes de registrar auditoría forense</p>
                </div>
              </div>

              <div className="space-y-5 text-body-sm">
                <div>
                  <label className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-bold block mb-1.5">
                    Tolerancia Máxima de Descuadre ($) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-outline font-title-md text-body-md font-bold">$</span>
                    <input
                      type="number"
                      step="0.50"
                      min="0"
                      value={toleranciaCaja}
                      onChange={(e) => {
                        setToleranciaCaja(e.target.value);
                        if (errors.toleranciaCaja) setErrors((prev) => ({ ...prev, toleranciaCaja: null }));
                      }}
                      className={`w-full pl-9 pr-4 py-3 rounded-2xl font-mono text-body-md font-bold text-on-surface focus:outline-none transition-all ${
                        errors.toleranciaCaja
                          ? 'bg-error-container/10 border-2 border-error focus:ring-2 focus:ring-error/20'
                          : 'bg-surface-container-low focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20'
                      }`}
                    />
                  </div>
                  {errors.toleranciaCaja && (
                    <div className="flex items-center gap-1.5 text-error text-xs font-medium mt-1 px-1 animate-in fade-in">
                      <span className="material-symbols-outlined text-[15px]">error</span>
                      <span>{errors.toleranciaCaja}</span>
                    </div>
                  )}
                  <p className="font-body-sm text-[11px] text-outline mt-1.5">
                    Si la diferencia entre el efectivo físico contado y el teórico supera este monto, se marca como Descuadre Auditado.
                  </p>
                </div>

                <div>
                  <label className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-bold block mb-1.5">
                    Factor de Reactivación RFM (CRM) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="1.0"
                      max="10.0"
                      value={rfmMultiplicador}
                      onChange={(e) => {
                        setRfmMultiplicador(e.target.value);
                        if (errors.rfmMultiplicador) setErrors((prev) => ({ ...prev, rfmMultiplicador: null }));
                      }}
                      className={`w-full px-4 py-3 rounded-2xl font-mono text-body-md font-bold text-tertiary focus:outline-none transition-all ${
                        errors.rfmMultiplicador
                          ? 'bg-error-container/10 border-2 border-error focus:ring-2 focus:ring-error/20'
                          : 'bg-surface-container-low focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20'
                      }`}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-outline font-title-md text-body-sm">× ciclo</span>
                  </div>
                  {errors.rfmMultiplicador && (
                    <div className="flex items-center gap-1.5 text-error text-xs font-medium mt-1 px-1 animate-in fade-in">
                      <span className="material-symbols-outlined text-[15px]">error</span>
                      <span>{errors.rfmMultiplicador}</span>
                    </div>
                  )}
                  <p className="font-body-sm text-[11px] text-outline mt-1.5">
                    Multiplicador del ciclo intercompra para catalogar a un cliente habitual en riesgo de deserción.
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Tarjeta 3: Pasarela SMTP */}
        <div className="bg-surface-container-lowest rounded-3xl p-7 border border-surface-container-high/60 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 bg-tertiary-fixed text-on-tertiary-fixed rounded-2xl flex items-center justify-center">
              <Mail className="w-6 h-6 text-tertiary" />
            </div>
            <div>
              <h3 className="font-headline-md text-title-lg font-bold text-on-surface">Servidor Saliente de Notificaciones (SMTP)</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Configuración de mensajería para alertas operativas, quiebres de inventario y arqueos</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-body-sm">
            <div>
              <label className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-bold block mb-1.5">
                Servidor SMTP (Host) *
              </label>
              <input
                type="text"
                value={smtpHost}
                onChange={(e) => {
                  setSmtpHost(e.target.value);
                  if (errors.smtpHost) setErrors((prev) => ({ ...prev, smtpHost: null }));
                }}
                placeholder="smtp.gmail.com"
                className={`w-full px-4 py-3 rounded-2xl font-mono text-body-sm text-on-surface focus:outline-none transition-all ${
                  errors.smtpHost
                    ? 'bg-error-container/10 border-2 border-error focus:ring-2 focus:ring-error/20'
                    : 'bg-surface-container-low focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20'
                }`}
              />
              {errors.smtpHost && (
                <div className="flex items-center gap-1.5 text-error text-xs font-medium mt-1 px-1 animate-in fade-in">
                  <span className="material-symbols-outlined text-[15px]">error</span>
                  <span>{errors.smtpHost}</span>
                </div>
              )}
            </div>

            <div>
              <label className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-bold block mb-1.5">
                Puerto *
              </label>
              <input
                type="number"
                value={smtpPort}
                onChange={(e) => {
                  setSmtpPort(e.target.value);
                  if (errors.smtpPort) setErrors((prev) => ({ ...prev, smtpPort: null }));
                }}
                placeholder="587"
                className={`w-full px-4 py-3 rounded-2xl font-mono text-body-sm text-on-surface focus:outline-none transition-all ${
                  errors.smtpPort
                    ? 'bg-error-container/10 border-2 border-error focus:ring-2 focus:ring-error/20'
                    : 'bg-surface-container-low focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20'
                }`}
              />
              {errors.smtpPort && (
                <div className="flex items-center gap-1.5 text-error text-xs font-medium mt-1 px-1 animate-in fade-in">
                  <span className="material-symbols-outlined text-[15px]">error</span>
                  <span>{errors.smtpPort}</span>
                </div>
              )}
            </div>

            <div>
              <label className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-bold block mb-1.5">
                Usuario Remitente (Email) *
              </label>
              <input
                type="email"
                value={smtpUser}
                onChange={(e) => {
                  setSmtpUser(e.target.value);
                  if (errors.smtpUser) setErrors((prev) => ({ ...prev, smtpUser: null }));
                }}
                placeholder="alertas@quantix.local"
                className={`w-full px-4 py-3 rounded-2xl font-mono text-body-sm text-on-surface focus:outline-none transition-all ${
                  errors.smtpUser
                    ? 'bg-error-container/10 border-2 border-error focus:ring-2 focus:ring-error/20'
                    : 'bg-surface-container-low focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20'
                }`}
              />
              {errors.smtpUser && (
                <div className="flex items-center gap-1.5 text-error text-xs font-medium mt-1 px-1 animate-in fade-in">
                  <span className="material-symbols-outlined text-[15px]">error</span>
                  <span>{errors.smtpUser}</span>
                </div>
              )}
            </div>

            <div>
              <label className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-bold block mb-1.5">
                Contraseña / Token de Aplicación
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={smtpPassword}
                  onChange={(e) => setSmtpPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-4 py-3 bg-surface-container-low rounded-2xl font-mono text-body-sm text-on-surface pr-12 focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Test de Correo */}
          <div className="mt-6 pt-6 border-t border-surface-container-high/50 space-y-2">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex-1 w-full flex items-center gap-3">
                <input
                  type="email"
                  value={emailPrueba}
                  onChange={(e) => {
                    setEmailPrueba(e.target.value);
                    if (emailPruebaError) setEmailPruebaError(null);
                  }}
                  placeholder="correo-destino@ejemplo.com para prueba..."
                  className={`flex-1 px-4 py-2.5 rounded-full font-body-md text-body-sm text-on-surface focus:outline-none transition-all ${
                    emailPruebaError
                      ? 'bg-error-container/10 border-2 border-error focus:ring-2 focus:ring-error/20'
                      : 'bg-surface-container-low focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20'
                  }`}
                />
                <button
                  type="button"
                  onClick={handleProbarSmtp}
                  disabled={testingSmtp || !emailPrueba}
                  className="flex items-center gap-2 px-5 py-2.5 bg-surface-container-high hover:bg-surface-container text-on-surface font-title-md text-body-sm font-semibold rounded-full disabled:opacity-50 transition-all cursor-pointer shadow-xs shrink-0"
                >
                  {testingSmtp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>{testingSmtp ? 'Enviando...' : 'Enviar Prueba'}</span>
                </button>
              </div>

              {smtpResult && (
                <span className={`font-title-md text-body-sm font-bold ${smtpResult.tipo === 'success' ? 'text-primary' : 'text-error'}`}>
                  {smtpResult.mensaje}
                </span>
              )}
            </div>
            {emailPruebaError && (
              <div className="flex items-center gap-1.5 text-error text-xs font-medium px-1 animate-in fade-in">
                <span className="material-symbols-outlined text-[15px]">error</span>
                <span>{emailPruebaError}</span>
              </div>
            )}
          </div>
        </div>

      </form>

      </div>
    </div>
  );
}
