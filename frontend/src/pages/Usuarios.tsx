import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, PlusCircle, Search, 
  Edit, Trash2, RotateCcw, Shield, X, Eye, 
  CheckCircle2, AlertCircle, Key, RefreshCw, Download
} from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { exportToCSV, formatBoolean, formatDate } from '../utils/exportUtils';
import { mostrarToast } from '../hooks/useWebSocket';
import { 
  validateEmail, 
  validateRequired, 
  validatePassword, 
  evaluatePasswordStrength 
} from '../utils/validation';

interface UsuarioItem {
  id: string;
  nombre: string;
  email: string;
  rol: 'DIRECTOR' | 'SUPERVISOR' | 'CAJERO' | 'BODEGUERO';
  activo: boolean;
  creado_en?: string;
}

export default function Usuarios() {
  const { user: currentUser } = useAuthStore();
  const isDirector = currentUser?.rol === 'DIRECTOR';

  const [usuarios, setUsuarios] = useState<UsuarioItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: 'success' | 'error'; mensaje: string } | null>(null);

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [rolFiltro, setRolFiltro] = useState('');
  const [mostrarInactivos, setMostrarInactivos] = useState(false);

  // Modales
  const [detalleUsuario, setDetalleUsuario] = useState<UsuarioItem | null>(null);
  const [modalUsuario, setModalUsuario] = useState<{ open: boolean; editando?: UsuarioItem | null }>({ open: false });

  // Formulario
  const [formUser, setFormUser] = useState({
    nombre: '',
    email: '',
    password: '',
    rol: 'CAJERO' as 'DIRECTOR' | 'SUPERVISOR' | 'CAJERO' | 'BODEGUERO'
  });

  const [errorsUser, setErrorsUser] = useState<{
    nombre?: string | null;
    email?: string | null;
    password?: string | null;
    rol?: string | null;
  }>({});

  const showToast = useCallback((tipo: 'success' | 'error', mensaje: string) => {
    setFeedback({ tipo, mensaje });
    mostrarToast({
      titulo: tipo === 'success' ? 'Operación de Usuarios' : 'Error en Usuarios',
      mensaje,
      severidad: tipo === 'success' ? 'SUCCESS' : 'CRITICO',
    });
    setTimeout(() => setFeedback(null), 4000);
  }, []);

  const cargarUsuarios = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/usuarios', {
        params: { activo_only: !mostrarInactivos }
      });
      setUsuarios(res.data);
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || 'Error al cargar el directorio de usuarios');
    } finally {
      setLoading(false);
    }
  }, [mostrarInactivos, showToast]);

  useEffect(() => {
    queueMicrotask(() => void cargarUsuarios());
  }, [cargarUsuarios]);

  const handleAbrirCrear = () => {
    setFormUser({
      nombre: '',
      email: '',
      password: '',
      rol: 'CAJERO'
    });
    setErrorsUser({});
    setModalUsuario({ open: true, editando: null });
  };

  const handleAbrirEditar = (u: UsuarioItem) => {
    setFormUser({
      nombre: u.nombre,
      email: u.email,
      password: '',
      rol: u.rol
    });
    setErrorsUser({});
    setModalUsuario({ open: true, editando: u });
  };

  const validarFormUsuario = (isEditing: boolean): boolean => {
    const errs: typeof errorsUser = {};

    const errNombre = validateRequired(formUser.nombre, 'Nombre completo', 3);
    if (errNombre) errs.nombre = errNombre;

    if (!isEditing) {
      const errEmail = validateEmail(formUser.email);
      if (errEmail) errs.email = errEmail;

      const errPass = validatePassword(formUser.password);
      if (errPass) errs.password = errPass;
    } else {
      if (formUser.password.trim()) {
        const errPass = validatePassword(formUser.password);
        if (errPass) errs.password = errPass;
      }
    }

    if (!formUser.rol) {
      errs.rol = 'El rol operacional es obligatorio';
    }

    setErrorsUser(errs);
    return Object.keys(errs).length === 0;
  };

  const handleGuardarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    const isEditing = !!modalUsuario.editando;

    if (!validarFormUsuario(isEditing)) {
      showToast('error', 'Por favor corrige los campos señalados con error');
      return;
    }

    try {
      if (isEditing) {
        const payload: any = {
          nombre: formUser.nombre.trim(),
          rol: formUser.rol
        };
        if (formUser.password.trim()) {
          payload.password = formUser.password;
        }
        await api.put(`/usuarios/${modalUsuario.editando!.id}`, payload);
        showToast('success', `Usuario ${formUser.nombre} actualizado correctamente`);
      } else {
        await api.post('/usuarios', {
          nombre: formUser.nombre.trim(),
          email: formUser.email.trim(),
          password: formUser.password,
          rol: formUser.rol
        });
        showToast('success', `Usuario ${formUser.nombre} registrado exitosamente`);
      }
      setModalUsuario({ open: false });
      if (detalleUsuario) setDetalleUsuario(null);
      cargarUsuarios();
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        const newErrs: typeof errorsUser = {};
        for (const item of detail) {
          const field = item.loc?.[item.loc.length - 1];
          if (field && typeof field === 'string') {
            (newErrs as any)[field] = item.msg;
          }
        }
        if (Object.keys(newErrs).length > 0) {
          setErrorsUser(newErrs);
        }
      } else if (typeof detail === 'string') {
        if (detail.toLowerCase().includes('email') || detail.toLowerCase().includes('correo') || detail.toLowerCase().includes('registrado')) {
          setErrorsUser((prev) => ({ ...prev, email: detail }));
        }
      }
      showToast('error', typeof detail === 'string' ? detail : 'Error al guardar el usuario');
    }
  };

  const handleToggleActivo = async (u: UsuarioItem) => {
    try {
      if (u.activo) {
        await api.delete(`/usuarios/${u.id}`);
        showToast('success', `Usuario ${u.nombre} dado de baja lógicamente`);
      } else {
        await api.put(`/usuarios/${u.id}`, { activo: true });
        showToast('success', `Usuario ${u.nombre} reactivado`);
      }
      if (detalleUsuario) setDetalleUsuario(null);
      cargarUsuarios();
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || 'Error al modificar estado del usuario');
    }
  };

  // Filtrado
  const usuariosFiltrados = usuarios.filter(u => {
    const matchSearch = !searchQuery || 
      u.nombre.toLowerCase().includes(searchQuery.toLowerCase()) || 
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchRol = !rolFiltro || u.rol === rolFiltro;
    return matchSearch && matchRol;
  });

  const getRoleBadge = (r: string) => {
    switch (r) {
      case 'DIRECTOR':
        return 'bg-tertiary-fixed text-on-tertiary-fixed border-tertiary-fixed';
      case 'SUPERVISOR':
        return 'bg-secondary-fixed text-on-secondary-fixed-variant border-secondary-fixed';
      case 'BODEGUERO':
        return 'bg-surface-container-high text-on-surface border-surface-container-high';
      case 'CAJERO':
      default:
        return 'bg-primary-fixed text-on-primary-fixed-variant border-primary-fixed';
    }
  };

  // Contadores KPI
  const totalActivos = usuarios.filter(u => u.activo).length;
  const countDirectores = usuarios.filter(u => u.rol === 'DIRECTOR' && u.activo).length;
  const countSupervisores = usuarios.filter(u => u.rol === 'SUPERVISOR' && u.activo).length;
  const countCajeros = usuarios.filter(u => u.rol === 'CAJERO' && u.activo).length;
  const countBodegueros = usuarios.filter(u => u.rol === 'BODEGUERO' && u.activo).length;

  return (
    <div className="h-full overflow-y-auto bg-background text-on-surface p-6 md:p-8 select-none">
      <div className="w-full space-y-6 animate-in fade-in duration-300">
      
      {/* Toast Feedback */}
      {feedback && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl border text-body-sm font-bold ${
          feedback.tipo === 'success' 
            ? 'bg-primary-fixed/30 text-on-primary-fixed-variant border-primary-fixed' 
            : 'bg-error-container text-on-error-container border-error'
        }`}>
          {feedback.tipo === 'success' ? <CheckCircle2 className="w-5 h-5 text-primary" /> : <AlertCircle className="w-5 h-5 text-error" />}
          <span>{feedback.mensaje}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-surface-container-high/60 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-surface-container-low text-primary rounded-2xl flex items-center justify-center shadow-xs">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="px-2.5 py-0.5 bg-secondary-fixed text-on-secondary-fixed rounded-full font-label-caps text-[10px] font-bold uppercase tracking-wider">
                  Nivel Táctico • Supervisión
                </span>
              </div>
              <h1 className="font-headline-xl text-2xl md:text-3xl font-bold text-on-surface tracking-tight">
                Directorio Maestro & Accesos RBAC
              </h1>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Control de identidades, jerarquías operacionales y auditoría de credenciales
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={cargarUsuarios}
            disabled={loading}
            className="p-2.5 text-on-surface-variant bg-surface-container-lowest hover:bg-surface-container border border-surface-container-high rounded-full transition-all shadow-xs cursor-pointer"
            title="Recargar usuarios"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          
          <button
            onClick={() => {
              exportToCSV({
                filename: `directorio_usuarios_quantix_${new Date().toISOString().slice(0, 10)}.csv`,
                data: usuarios,
                columns: [
                  { key: 'nombre', header: 'Nombre del Operador' },
                  { key: 'email', header: 'Correo Electrónico' },
                  { key: 'rol', header: 'Rol Asignado' },
                  { key: 'activo', header: 'Activo', formatter: (v) => formatBoolean(v) },
                  { key: 'creado_en', header: 'Fecha Alta', formatter: (v) => formatDate(v) }
                ]
              });
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface-container-lowest border border-surface-container-high text-on-surface hover:bg-surface-container rounded-full font-title-md text-body-sm font-semibold shadow-xs transition-all cursor-pointer"
            title="Exportar directorio de operadores a CSV / Excel"
          >
            <Download className="w-4 h-4 text-primary" />
            <span>Exportar CSV</span>
          </button>
          
          {isDirector && (
            <button
              onClick={handleAbrirCrear}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary-container hover:bg-primary-container/90 text-on-primary-container rounded-full font-title-md text-body-sm font-bold shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Nuevo Usuario</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-surface-container-lowest p-4 rounded-3xl border border-surface-container-high/60 shadow-sm flex flex-col justify-between">
          <span className="font-label-caps text-[10px] font-bold text-outline uppercase tracking-wider block mb-1">Total Activos</span>
          <div className="font-label-numeric-lg text-2xl font-bold text-on-surface">{totalActivos}</div>
          <span className="font-body-sm text-[11px] text-on-surface-variant mt-1 block">Operadores vigentes</span>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-3xl border border-surface-container-high/60 shadow-sm flex flex-col justify-between">
          <span className="font-label-caps text-[10px] font-bold text-tertiary uppercase tracking-wider block mb-1">Directores</span>
          <div className="font-label-numeric-lg text-2xl font-bold text-on-surface">{countDirectores}</div>
          <span className="font-body-sm text-[11px] text-outline mt-1 block">Acceso gerencial total</span>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-3xl border border-surface-container-high/60 shadow-sm flex flex-col justify-between">
          <span className="font-label-caps text-[10px] font-bold text-secondary uppercase tracking-wider block mb-1">Supervisores</span>
          <div className="font-label-numeric-lg text-2xl font-bold text-on-surface">{countSupervisores}</div>
          <span className="font-body-sm text-[11px] text-outline mt-1 block">Control de turno y caja</span>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-3xl border border-surface-container-high/60 shadow-sm flex flex-col justify-between">
          <span className="font-label-caps text-[10px] font-bold text-primary uppercase tracking-wider block mb-1">Cajeros</span>
          <div className="font-label-numeric-lg text-2xl font-bold text-on-surface">{countCajeros}</div>
          <span className="font-body-sm text-[11px] text-outline mt-1 block">Piso y cobro POS</span>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-3xl border border-surface-container-high/60 shadow-sm flex flex-col justify-between col-span-2 sm:col-span-1">
          <span className="font-label-caps text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Bodegueros</span>
          <div className="font-label-numeric-lg text-2xl font-bold text-on-surface">{countBodegueros}</div>
          <span className="font-body-sm text-[11px] text-outline mt-1 block">Lotes FEFO y almacén</span>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-surface-container-lowest p-4 rounded-3xl border border-surface-container-high/60 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-outline absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por nombre o correo electrónico..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-surface-container-low rounded-full font-body-md text-body-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>

          <select
            value={rolFiltro}
            onChange={(e) => setRolFiltro(e.target.value)}
            className="px-4 py-2.5 bg-surface-container-low rounded-full font-title-md text-body-sm font-semibold text-on-surface border-none focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
          >
            <option value="">Todos los Roles</option>
            <option value="DIRECTOR">Director (C-Level)</option>
            <option value="SUPERVISOR">Supervisor (Táctico)</option>
            <option value="CAJERO">Cajero (Operativo)</option>
            <option value="BODEGUERO">Bodeguero (Almacén)</option>
          </select>
        </div>

        <label className="flex items-center gap-2 font-title-md text-body-sm text-on-surface-variant cursor-pointer select-none">
          <input
            type="checkbox"
            checked={mostrarInactivos}
            onChange={(e) => setMostrarInactivos(e.target.checked)}
            className="rounded-lg text-primary focus:ring-primary accent-primary w-4 h-4 cursor-pointer"
          />
          <span>Mostrar bajas lógicas</span>
        </label>
      </div>

      {/* Tabla de Usuarios — Neo-Retail */}
      <div className="bg-surface-container-lowest rounded-3xl border border-surface-container-high/60 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-body-md text-body-md border-collapse">
            <thead>
              <tr className="bg-surface-container-low/70 text-on-surface-variant font-label-caps text-label-caps uppercase tracking-wider select-none">
                <th className="py-3.5 px-5 rounded-l-2xl">Colaborador</th>
                <th className="py-3.5 px-4">Correo Institucional</th>
                <th className="py-3.5 px-4 text-center">Rol & Nivel</th>
                <th className="py-3.5 px-4 text-center">Fecha Alta</th>
                <th className="py-3.5 px-4 text-center">Estatus</th>
                <th className="py-3.5 px-5 rounded-r-2xl text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-low">
              {usuariosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-on-surface-variant font-body-md">
                    No se encontraron colaboradores registrados con los criterios seleccionados.
                  </td>
                </tr>
              ) : (
                usuariosFiltrados.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => setDetalleUsuario(u)}
                    title="Haz clic para ver la ficha del colaborador"
                    className={`cursor-pointer hover:bg-surface-container-low/60 transition-colors group ${!u.activo ? 'opacity-60 bg-surface-container-low/20' : ''}`}
                  >
                    <td className="py-3.5 px-5 font-bold text-on-surface flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-surface-container text-primary font-headline-md text-title-md flex items-center justify-center font-bold ring-1 ring-surface-container-high">
                        {u.nombre.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex items-center">
                        <span className="font-title-md text-on-surface group-hover:text-primary transition-colors">{u.nombre}</span>
                        {currentUser?.id === u.id && (
                          <span className="ml-2 font-label-caps text-[9px] px-2 py-0.5 bg-primary-fixed text-on-primary-fixed font-bold rounded-full uppercase">
                            Tú
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-on-surface-variant text-body-sm">{u.email}</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-block px-3 py-0.5 rounded-full font-label-caps text-[10px] font-bold uppercase tracking-wider border ${getRoleBadge(u.rol)}`}>
                        {u.rol}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-body-sm text-outline">
                      {u.creado_en ? new Date(u.creado_en).toLocaleDateString('es-MX') : 'N/A'}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {u.activo ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary-fixed/30 text-on-primary-fixed-variant font-label-caps text-[10px] font-bold uppercase">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                          Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant font-label-caps text-[10px] font-bold uppercase">
                          Baja Lógica
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setDetalleUsuario(u)}
                          title="Ver Ficha de Usuario"
                          className="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded-full transition-colors cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {isDirector && (
                          <>
                            <button
                              onClick={() => handleAbrirEditar(u)}
                              title="Editar Usuario o Cambiar Contraseña"
                              className="p-2 text-secondary hover:bg-secondary-fixed/50 rounded-full transition-colors cursor-pointer"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggleActivo(u)}
                              title={u.activo ? 'Dar de baja lógica' : 'Reactivar usuario'}
                              className={`p-2 rounded-full transition-colors cursor-pointer ${
                                u.activo ? 'text-error hover:bg-error-container' : 'text-primary hover:bg-primary-fixed/50'
                              }`}
                            >
                              {u.activo ? <Trash2 className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Ficha Detallada de Usuario */}
      {detalleUsuario && (
        <div className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-surface-container-lowest rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-surface-container-high/40 animate-in zoom-in-95">
            <div className="p-6 border-b border-surface-container-low flex justify-between items-start bg-surface-container-low/50">
              <div>
                <span className="px-2.5 py-0.5 bg-primary text-on-primary rounded-full font-label-caps text-[10px] font-bold uppercase tracking-wider">
                  Ficha de Operador
                </span>
                <h3 className="font-headline-md text-title-lg font-bold text-on-surface mt-1.5">{detalleUsuario.nombre}</h3>
                <p className="font-body-sm font-mono text-outline">{detalleUsuario.email}</p>
              </div>
              <button 
                onClick={() => setDetalleUsuario(null)} 
                className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-body-sm">
              <div className="grid grid-cols-2 gap-3 bg-surface-container-low p-4 rounded-2xl border border-surface-container-high/40">
                <div>
                  <span className="font-label-caps text-[10px] text-outline font-bold uppercase block mb-1">Rol Operacional</span>
                  <span className={`inline-block px-2.5 py-0.5 rounded-full font-label-caps text-[10px] font-bold uppercase border ${getRoleBadge(detalleUsuario.rol)}`}>
                    {detalleUsuario.rol}
                  </span>
                </div>
                <div>
                  <span className="font-label-caps text-[10px] text-outline font-bold uppercase block mb-1">Estado de Cuenta</span>
                  <span className={`inline-block px-2.5 py-0.5 rounded-full font-label-caps text-[10px] font-bold uppercase ${
                    detalleUsuario.activo ? 'bg-primary-fixed/30 text-on-primary-fixed-variant' : 'bg-surface-container-highest text-on-surface-variant'
                  }`}>
                    {detalleUsuario.activo ? 'Activo en Turno' : 'Baja Lógica'}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="font-label-caps text-[10px] text-outline font-bold uppercase block mb-0.5">Identificador UUID</span>
                  <span className="font-mono text-[11px] text-on-surface truncate block">{detalleUsuario.id}</span>
                </div>
                <div className="col-span-2">
                  <span className="font-label-caps text-[10px] text-outline font-bold uppercase block mb-0.5">Fecha de Registro</span>
                  <span className="font-mono text-body-sm text-on-surface">
                    {detalleUsuario.creado_en ? new Date(detalleUsuario.creado_en).toLocaleString('es-MX') : 'N/A'}
                  </span>
                </div>
              </div>

              <div className="p-3.5 bg-surface-container-low rounded-2xl border border-surface-container-high/50 text-on-surface leading-relaxed text-body-sm flex items-start gap-2.5">
                <Shield className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>
                  <strong>Políticas de Seguridad RBAC:</strong> Las operaciones críticas en POS, arqueos y administración requieren verificación de credenciales y autorización por jerarquía.
                </span>
              </div>
            </div>

            <div className="p-4 bg-surface-container-low/50 border-t border-surface-container-low flex justify-end gap-2">
              {isDirector && (
                <>
                  <button
                    onClick={() => {
                      const u = detalleUsuario;
                      setDetalleUsuario(null);
                      handleAbrirEditar(u);
                    }}
                    className="px-4 py-2 font-title-md text-body-sm font-bold text-secondary bg-surface-container-lowest hover:bg-secondary-fixed/30 rounded-full cursor-pointer transition-colors shadow-xs"
                  >
                    Editar Credenciales
                  </button>
                  <button
                    onClick={() => {
                      const u = detalleUsuario;
                      handleToggleActivo(u);
                    }}
                    className={`px-4 py-2 font-title-md text-body-sm font-bold rounded-full cursor-pointer transition-colors shadow-xs ${
                      detalleUsuario.activo ? 'text-error bg-surface-container-lowest hover:bg-error-container' : 'text-primary bg-surface-container-lowest hover:bg-primary-fixed/30'
                    }`}
                  >
                    {detalleUsuario.activo ? 'Dar de Baja' : 'Reactivar'}
                  </button>
                </>
              )}
              <button
                onClick={() => setDetalleUsuario(null)}
                className="px-4 py-2 font-title-md text-body-sm font-bold text-on-surface hover:bg-surface-container rounded-full cursor-pointer transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Crear / Editar Usuario */}
      {modalUsuario.open && (
        <div className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-surface-container-lowest rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-surface-container-high/40 animate-in zoom-in-95">
            <div className="p-6 border-b border-surface-container-low flex justify-between items-center bg-surface-container-low/50">
              <h3 className="font-headline-md text-title-lg font-bold text-on-surface">
                {modalUsuario.editando ? 'Modificar Credenciales de Operador' : 'Registrar Nuevo Operador'}
              </h3>
              <button onClick={() => setModalUsuario({ open: false })} className="p-1 text-on-surface-variant hover:text-on-surface rounded-full cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGuardarUsuario} className="p-6 space-y-4 text-body-sm" noValidate>
              <div>
                <label className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-bold block mb-1.5">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  value={formUser.nombre}
                  onChange={(e) => {
                    setFormUser({ ...formUser, nombre: e.target.value });
                    if (errorsUser.nombre) setErrorsUser((prev) => ({ ...prev, nombre: null }));
                  }}
                  placeholder="Ej. Juan Pérez López"
                  className={`w-full px-4 py-2.5 rounded-2xl font-title-md text-body-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none transition-all ${
                    errorsUser.nombre
                      ? 'bg-error-container/10 border-2 border-error focus:ring-2 focus:ring-error/20'
                      : 'bg-surface-container-low border border-surface-container-high/40 focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20'
                  }`}
                />
                {errorsUser.nombre && (
                  <div className="flex items-center gap-1.5 text-error text-xs font-medium mt-1 animate-in fade-in">
                    <span className="material-symbols-outlined text-[15px]">error</span>
                    <span>{errorsUser.nombre}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-bold block mb-1.5">
                  Correo Electrónico (Login) *
                </label>
                <input
                  type="email"
                  disabled={!!modalUsuario.editando}
                  value={formUser.email}
                  onChange={(e) => {
                    setFormUser({ ...formUser, email: e.target.value });
                    if (errorsUser.email) setErrorsUser((prev) => ({ ...prev, email: null }));
                  }}
                  placeholder="operador@quantix.local"
                  className={`w-full px-4 py-2.5 rounded-2xl font-title-md text-body-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none transition-all ${
                    modalUsuario.editando ? 'opacity-60 cursor-not-allowed bg-surface-container-low border border-surface-container-high/40' : ''
                  } ${
                    errorsUser.email
                      ? 'bg-error-container/10 border-2 border-error focus:ring-2 focus:ring-error/20'
                      : 'bg-surface-container-low border border-surface-container-high/40 focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20'
                  }`}
                />
                {errorsUser.email && (
                  <div className="flex items-center gap-1.5 text-error text-xs font-medium mt-1 animate-in fade-in">
                    <span className="material-symbols-outlined text-[15px]">error</span>
                    <span>{errorsUser.email}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-bold block mb-1.5">
                  Rol Operacional *
                </label>
                <select
                  value={formUser.rol}
                  onChange={(e) => {
                    setFormUser({ ...formUser, rol: e.target.value as any });
                    if (errorsUser.rol) setErrorsUser((prev) => ({ ...prev, rol: null }));
                  }}
                  className={`w-full px-4 py-2.5 rounded-2xl font-title-md text-body-sm text-on-surface focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 cursor-pointer ${
                    errorsUser.rol
                      ? 'bg-error-container/10 border-2 border-error'
                      : 'bg-surface-container-low border border-surface-container-high/40'
                  }`}
                >
                  <option value="CAJERO">CAJERO (Punto de Venta & Cobro)</option>
                  <option value="SUPERVISOR">SUPERVISOR (Arqueos, Anulaciones, Auditoría)</option>
                  <option value="BODEGUERO">BODEGUERO (Ingreso de Lotes FEFO & Almacén)</option>
                  <option value="DIRECTOR">DIRECTOR (Control General, BI y Parámetros)</option>
                </select>
                {errorsUser.rol && (
                  <div className="flex items-center gap-1.5 text-error text-xs font-medium mt-1 animate-in fade-in">
                    <span className="material-symbols-outlined text-[15px]">error</span>
                    <span>{errorsUser.rol}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-bold block mb-1.5">
                  {modalUsuario.editando ? 'Nueva Contraseña (en blanco para conservar actual)' : 'Contraseña de Acceso *'}
                </label>
                <div className="relative flex items-center">
                  <Key className="w-4 h-4 text-outline absolute left-3.5 pointer-events-none" />
                  <input
                    type="password"
                    value={formUser.password}
                    onChange={(e) => {
                      setFormUser({ ...formUser, password: e.target.value });
                      if (errorsUser.password) setErrorsUser((prev) => ({ ...prev, password: null }));
                    }}
                    placeholder={modalUsuario.editando ? '•••••••• (sin cambios)' : 'Mínimo 8 caracteres (A-Z, a-z, 0-9, #)'}
                    className={`w-full pl-10 pr-4 py-2.5 rounded-2xl font-mono text-body-sm text-on-surface focus:outline-none transition-all ${
                      errorsUser.password
                        ? 'bg-error-container/10 border-2 border-error focus:ring-2 focus:ring-error/20'
                        : 'bg-surface-container-low border border-surface-container-high/40 focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20'
                    }`}
                  />
                </div>
                {errorsUser.password && (
                  <div className="flex items-center gap-1.5 text-error text-xs font-medium mt-1 animate-in fade-in">
                    <span className="material-symbols-outlined text-[15px]">error</span>
                    <span>{errorsUser.password}</span>
                  </div>
                )}
                {formUser.password && (() => {
                  const strength = evaluatePasswordStrength(formUser.password);
                  const colors = [
                    'bg-error text-error',
                    'bg-error text-error',
                    'bg-amber-500 text-amber-600',
                    'bg-blue-500 text-blue-600',
                    'bg-primary text-primary',
                  ];
                  return (
                    <div className="mt-2.5 p-3 rounded-2xl bg-surface-container-low border border-surface-container-high/40 space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-on-surface-variant">Fortaleza de contraseña:</span>
                        <span className={`font-bold ${colors[strength.score]?.split(' ')[1] || 'text-outline'}`}>
                          {strength.label}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5 h-1.5">
                        {[1, 2, 3, 4].map((step) => (
                          <div
                            key={step}
                            className={`rounded-full h-full transition-all duration-300 ${
                              strength.score >= step
                                ? colors[strength.score]?.split(' ')[0]
                                : 'bg-surface-container-highest'
                            }`}
                          />
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-[11px] text-on-surface-variant pt-1">
                        <div className={`flex items-center gap-1 ${strength.hasMinLength ? 'text-primary font-medium' : 'text-outline'}`}>
                          <span className="material-symbols-outlined text-[13px]">
                            {strength.hasMinLength ? 'check_circle' : 'radio_button_unchecked'}
                          </span>
                          <span>8+ caracteres</span>
                        </div>
                        <div className={`flex items-center gap-1 ${strength.hasUpper && strength.hasLower ? 'text-primary font-medium' : 'text-outline'}`}>
                          <span className="material-symbols-outlined text-[13px]">
                            {strength.hasUpper && strength.hasLower ? 'check_circle' : 'radio_button_unchecked'}
                          </span>
                          <span>Mayús. y minús.</span>
                        </div>
                        <div className={`flex items-center gap-1 ${strength.hasNumber ? 'text-primary font-medium' : 'text-outline'}`}>
                          <span className="material-symbols-outlined text-[13px]">
                            {strength.hasNumber ? 'check_circle' : 'radio_button_unchecked'}
                          </span>
                          <span>Al menos 1 número</span>
                        </div>
                        <div className={`flex items-center gap-1 ${strength.hasSpecial ? 'text-primary font-medium' : 'text-outline'}`}>
                          <span className="material-symbols-outlined text-[13px]">
                            {strength.hasSpecial ? 'check_circle' : 'radio_button_unchecked'}
                          </span>
                          <span>Carácter especial</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="pt-4 flex justify-end gap-2.5 border-t border-surface-container-high/50">
                <button
                  type="button"
                  onClick={() => setModalUsuario({ open: false })}
                  className="px-5 py-2.5 font-title-md text-body-sm text-on-surface-variant hover:bg-surface-container rounded-full cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 font-title-md text-body-sm font-bold text-on-primary-container bg-primary-container hover:opacity-95 rounded-full shadow-md cursor-pointer transition-all active:scale-95"
                >
                  {modalUsuario.editando ? 'Guardar Cambios' : 'Registrar Operador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}
