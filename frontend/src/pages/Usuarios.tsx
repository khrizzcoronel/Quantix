import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, PlusCircle, Search, 
  Edit, Trash2, RotateCcw, Shield, X, Eye, 
  CheckCircle2, AlertCircle, Key, RefreshCw, Download
} from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { exportToCSV, formatBoolean, formatDate } from '../utils/exportUtils';

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

  const showToast = useCallback((tipo: 'success' | 'error', mensaje: string) => {
    setFeedback({ tipo, mensaje });
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
    setModalUsuario({ open: true, editando: null });
  };

  const handleAbrirEditar = (u: UsuarioItem) => {
    setFormUser({
      nombre: u.nombre,
      email: u.email,
      password: '',
      rol: u.rol
    });
    setModalUsuario({ open: true, editando: u });
  };

  const handleGuardarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (modalUsuario.editando) {
        const payload: any = {
          nombre: formUser.nombre,
          rol: formUser.rol
        };
        if (formUser.password.trim()) {
          payload.password = formUser.password;
        }
        await api.put(`/usuarios/${modalUsuario.editando.id}`, payload);
        showToast('success', `Usuario ${formUser.nombre} actualizado correctamente`);
      } else {
        if (!formUser.password) {
          showToast('error', 'Debes asignar una contraseña para el nuevo usuario');
          return;
        }
        await api.post('/usuarios', {
          nombre: formUser.nombre,
          email: formUser.email,
          password: formUser.password,
          rol: formUser.rol
        });
        showToast('success', `Usuario ${formUser.nombre} registrado exitosamente`);
      }
      setModalUsuario({ open: false });
      if (detalleUsuario) setDetalleUsuario(null);
      cargarUsuarios();
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || 'Error al guardar el usuario');
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

  const getRoleBadge = (rol: string) => {
    switch (rol) {
      case 'DIRECTOR':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'SUPERVISOR':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'BODEGUERO':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'CAJERO':
      default:
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    }
  };

  // Contadores KPI
  const totalActivos = usuarios.filter(u => u.activo).length;
  const countDirectores = usuarios.filter(u => u.rol === 'DIRECTOR' && u.activo).length;
  const countSupervisores = usuarios.filter(u => u.rol === 'SUPERVISOR' && u.activo).length;
  const countCajeros = usuarios.filter(u => u.rol === 'CAJERO' && u.activo).length;
  const countBodegueros = usuarios.filter(u => u.rol === 'BODEGUERO' && u.activo).length;

  return (
    <div className="h-full overflow-y-auto bg-gray-50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      {/* Toast Feedback */}
      {feedback && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl border text-sm font-bold ${
          feedback.tipo === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
            : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          {feedback.tipo === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}
          <span>{feedback.mensaje}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-quantix-50 text-quantix-600 rounded-2xl border border-quantix-100 shadow-sm">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 rounded-md text-[10px] font-black uppercase tracking-wider">
                  Táctico • Supervisión
                </span>
              </div>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">Usuarios y Accesos</h1>
              <p className="text-gray-500 text-xs font-medium">Control de acceso RBAC, roles operacionales y auditoría de credenciales</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={cargarUsuarios}
            disabled={loading}
            className="p-2.5 text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl transition-colors shadow-sm"
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
            className="flex items-center gap-2 px-3.5 py-2.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer"
            title="Exportar directorio de operadores a CSV / Excel"
          >
            <Download className="w-3.5 h-3.5 text-quantix-600" />
            <span>Exportar CSV</span>
          </button>
          
          {isDirector && (
            <button
              onClick={handleAbrirCrear}
              className="flex items-center gap-2 px-4 py-2.5 bg-quantix-600 hover:bg-quantix-700 text-white rounded-xl font-bold text-sm shadow-md transition-all active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Nuevo Usuario</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Total Activos</span>
          <div className="text-2xl font-black text-gray-900">{totalActivos}</div>
          <span className="text-[11px] text-gray-400 mt-1 block">Operadores vigentes</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <span className="text-xs font-bold text-purple-700 uppercase tracking-wider block mb-1">Directores</span>
          <div className="text-2xl font-black text-purple-900">{countDirectores}</div>
          <span className="text-[11px] text-purple-600 mt-1 block">Acceso gerencial total</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <span className="text-xs font-bold text-amber-700 uppercase tracking-wider block mb-1">Supervisores</span>
          <div className="text-2xl font-black text-amber-900">{countSupervisores}</div>
          <span className="text-[11px] text-amber-600 mt-1 block">Control de turno y caja</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider block mb-1">Cajeros</span>
          <div className="text-2xl font-black text-emerald-900">{countCajeros}</div>
          <span className="text-[11px] text-emerald-600 mt-1 block">Punto de venta y cobro</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <span className="text-xs font-bold text-blue-700 uppercase tracking-wider block mb-1">Bodegueros</span>
          <div className="text-2xl font-black text-blue-900">{countBodegueros}</div>
          <span className="text-[11px] text-blue-600 mt-1 block">Entradas y lotes FEFO</span>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por nombre o correo electrónico..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-quantix-500 font-medium"
            />
          </div>

          <select
            value={rolFiltro}
            onChange={(e) => setRolFiltro(e.target.value)}
            className="px-3 py-2 border rounded-xl text-sm font-semibold text-gray-700 focus:ring-2 focus:ring-quantix-500"
          >
            <option value="">Todos los Roles</option>
            <option value="DIRECTOR">Director</option>
            <option value="SUPERVISOR">Supervisor</option>
            <option value="CAJERO">Cajero</option>
            <option value="BODEGUERO">Bodeguero</option>
          </select>
        </div>

        <label className="flex items-center gap-2 text-xs font-bold text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={mostrarInactivos}
            onChange={(e) => setMostrarInactivos(e.target.checked)}
            className="rounded border-gray-300 text-quantix-600 focus:ring-quantix-500 w-4 h-4"
          />
          Mostrar usuarios dados de baja
        </label>
      </div>

      {/* Tabla de Usuarios */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="py-3 px-4">Operador</th>
                <th className="py-3 px-4">Correo Electrónico</th>
                <th className="py-3 px-4 text-center">Rol Asignado</th>
                <th className="py-3 px-4 text-center">Fecha Alta</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {usuariosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400 font-medium">
                    No se encontraron usuarios registrados con los criterios seleccionados.
                  </td>
                </tr>
              ) : (
                usuariosFiltrados.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => setDetalleUsuario(u)}
                    title="Haz clic para ver la ficha detallada del operador"
                    className={`cursor-pointer hover:bg-quantix-50/60 transition-colors ${!u.activo ? 'opacity-60 bg-gray-50/30' : ''}`}
                  >
                    <td className="py-3.5 px-4 font-bold text-gray-900 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-quantix-100 text-quantix-700 flex items-center justify-center font-black text-xs">
                        {u.nombre.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <span>{u.nombre}</span>
                        {currentUser?.id === u.id && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-quantix-50 text-quantix-700 rounded-md font-bold">Tú</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-gray-600 text-xs">{u.email}</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-black border ${getRoleBadge(u.rol)}`}>
                        {u.rol}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center text-xs text-gray-500 font-mono">
                      {u.creado_en ? new Date(u.creado_en).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {u.activo ? (
                        <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">Activo</span>
                      ) : (
                        <span className="px-2.5 py-0.5 bg-gray-200 text-gray-700 rounded-full text-xs font-bold">Baja Lógica</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setDetalleUsuario(u)}
                          title="Ver Ficha de Usuario"
                          className="p-1.5 text-quantix-600 hover:bg-quantix-50 rounded-lg transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {isDirector && (
                          <>
                            <button
                              onClick={() => handleAbrirEditar(u)}
                              title="Editar Usuario o Cambiar Contraseña"
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggleActivo(u)}
                              title={u.activo ? 'Dar de baja lógica' : 'Reactivar usuario'}
                              className={`p-1.5 rounded-lg transition-colors ${
                                u.activo ? 'text-red-500 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95">
            <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-gradient-to-r from-quantix-50 to-white">
              <div>
                <span className="px-2.5 py-0.5 bg-quantix-600 text-white rounded-md text-[11px] font-black uppercase tracking-wider">
                  Ficha de Operador
                </span>
                <h3 className="text-xl font-black text-gray-900 mt-1">{detalleUsuario.nombre}</h3>
                <p className="text-xs font-mono text-gray-500">{detalleUsuario.email}</p>
              </div>
              <button 
                onClick={() => setDetalleUsuario(null)} 
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <div>
                  <span className="text-gray-400 block font-bold uppercase mb-0.5">Rol en el Sistema</span>
                  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-black border mt-1 ${getRoleBadge(detalleUsuario.rol)}`}>
                    {detalleUsuario.rol}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block font-bold uppercase mb-0.5">Estado</span>
                  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold mt-1 ${
                    detalleUsuario.activo ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-700'
                  }`}>
                    {detalleUsuario.activo ? 'Activo en Turno' : 'Baja Lógica'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block font-bold uppercase mb-0.5">ID UUID</span>
                  <span className="font-mono text-gray-700 text-[11px] truncate block">{detalleUsuario.id}</span>
                </div>
                <div>
                  <span className="text-gray-400 block font-bold uppercase mb-0.5">Fecha de Alta</span>
                  <span className="font-semibold text-gray-800">
                    {detalleUsuario.creado_en ? new Date(detalleUsuario.creado_en).toLocaleString() : 'N/A'}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-blue-900 leading-relaxed text-[11px]">
                <Shield className="w-4 h-4 inline mr-1.5 text-blue-600" />
                <strong>Políticas RBAC:</strong> Las operaciones críticas en POS, arqueos y administración requieren verificación de credenciales y autorización por jerarquía.
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
              {isDirector && (
                <>
                  <button
                    onClick={() => {
                      const u = detalleUsuario;
                      setDetalleUsuario(null);
                      handleAbrirEditar(u);
                    }}
                    className="px-3.5 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl"
                  >
                    Editar Credenciales
                  </button>
                  <button
                    onClick={() => {
                      const u = detalleUsuario;
                      handleToggleActivo(u);
                    }}
                    className={`px-3.5 py-2 text-xs font-bold rounded-xl ${
                      detalleUsuario.activo ? 'text-red-700 bg-red-50 hover:bg-red-100' : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                    }`}
                  >
                    {detalleUsuario.activo ? 'Dar de Baja' : 'Reactivar'}
                  </button>
                </>
              )}
              <button
                onClick={() => setDetalleUsuario(null)}
                className="px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-200 rounded-xl"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Crear / Editar Usuario */}
      {modalUsuario.open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-extrabold text-gray-900 text-lg">
                {modalUsuario.editando ? 'Modificar Usuario / Credenciales' : 'Registrar Nuevo Operador'}
              </h3>
              <button onClick={() => setModalUsuario({ open: false })} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGuardarUsuario} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 uppercase mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  value={formUser.nombre}
                  onChange={(e) => setFormUser({ ...formUser, nombre: e.target.value })}
                  placeholder="Ej. Juan Pérez López"
                  className="w-full px-3 py-2.5 border rounded-xl text-sm font-semibold focus:ring-2 focus:ring-quantix-500"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase mb-1">Correo Electrónico (Login) *</label>
                <input
                  type="email"
                  required
                  disabled={!!modalUsuario.editando}
                  value={formUser.email}
                  onChange={(e) => setFormUser({ ...formUser, email: e.target.value })}
                  placeholder="operador@quantix.com"
                  className={`w-full px-3 py-2.5 border rounded-xl text-sm font-semibold focus:ring-2 focus:ring-quantix-500 ${
                    modalUsuario.editando ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''
                  }`}
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase mb-1">Rol Operacional *</label>
                <select
                  value={formUser.rol}
                  onChange={(e) => setFormUser({ ...formUser, rol: e.target.value as any })}
                  className="w-full px-3 py-2.5 border rounded-xl text-sm font-bold text-gray-800 focus:ring-2 focus:ring-quantix-500"
                >
                  <option value="CAJERO">CAJERO (Punto de Venta & Cobro)</option>
                  <option value="SUPERVISOR">SUPERVISOR (Arqueos, Anulaciones, Auditoría)</option>
                  <option value="BODEGUERO">BODEGUERO (Ingreso de Lotes FEFO & Almacén)</option>
                  <option value="DIRECTOR">DIRECTOR (Control General, BI y Parámetros)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase mb-1">
                  {modalUsuario.editando ? 'Nueva Contraseña (dejar en blanco para conservar actual)' : 'Contraseña de Acceso *'}
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required={!modalUsuario.editando}
                    value={formUser.password}
                    onChange={(e) => setFormUser({ ...formUser, password: e.target.value })}
                    placeholder={modalUsuario.editando ? '•••••••• (sin cambios)' : 'Contraseña segura'}
                    className="w-full pl-9 pr-3 py-2.5 border rounded-xl text-sm font-mono focus:ring-2 focus:ring-quantix-500"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setModalUsuario({ open: false })}
                  className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-bold text-white bg-quantix-600 hover:bg-quantix-700 rounded-xl shadow-md"
                >
                  {modalUsuario.editando ? 'Guardar Cambios' : 'Registrar Usuario'}
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
