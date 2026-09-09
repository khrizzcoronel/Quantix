import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Store, BarChart3, LogOut, UserCircle, 
  ShieldCheck, Package, Settings, Users,
  Cpu, UserCheck, Sun, Moon, Camera, X,
  Loader2, Upload, Clock
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import NotificationCenter from './NotificationCenter';
import MiActividadModal from './MiActividadModal';
import { useWebSocket } from '../hooks/useWebSocket';
import api from '../services/api';

export default function Layout() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const updateAvatar = useAuthStore((state) => state.updateAvatar);
  const { isDarkMode, toggleDarkMode } = useThemeStore();
  
  const navigate = useNavigate();
  const location = useLocation();

  // Estado para el modal de Avatar
  const [modalAvatarOpen, setModalAvatarOpen] = useState(false);
  const [previewAvatar, setPreviewAvatar] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estado para el modal Mi Actividad
  const [modalActividadOpen, setModalActividadOpen] = useState(false);

  // Estado de conexión WebSocket y verificación de /health en tiempo real
  const { estadoConexion } = useWebSocket();
  const [healthStatus, setHealthStatus] = useState<'ok' | 'error' | 'verificando'>('verificando');
  const [healthLatency, setHealthLatency] = useState<number | null>(null);

  useEffect(() => {
    let cancel = false;
    const checkHealth = async () => {
      const t0 = performance.now();
      try {
        const rawUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
        const healthUrl = rawUrl.replace(/\/api\/v1\/?$/, '') + '/health';
        const res = await fetch(healthUrl, { method: 'GET', signal: AbortSignal.timeout(4000) });
        if (res.ok) {
          const lat = Math.round(performance.now() - t0);
          if (!cancel) {
            setHealthStatus('ok');
            setHealthLatency(lat);
          }
        } else {
          if (!cancel) setHealthStatus('error');
        }
      } catch {
        if (!cancel) setHealthStatus('error');
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => {
      cancel = true;
      clearInterval(interval);
    };
  }, []);

  const isOnline = healthStatus === 'ok' && estadoConexion === 'conectado';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const rol = user?.rol || 'CAJERO';

  // Configuración de rutas agrupadas por nivel organizacional según la Pirámide de Anthony
  interface NavItem {
    to: string;
    label: string;
    icon: any;
    roles: string[];
    descripcion?: string;
  }

  interface NavSection {
    id: string;
    titulo: string;
    badge: string;
    badgeColor: string;
    items: NavItem[];
  }

  const navSections: NavSection[] = [
    {
      id: 'estrategico',
      titulo: 'Estratégico',
      badge: 'Dirección',
      badgeColor: 'bg-purple-100 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800',
      items: [
        {
          to: '/dashboard',
          label: 'Panel de Control',
          icon: BarChart3,
          roles: ['DIRECTOR'],
        },
        {
          to: '/operaciones',
          label: 'Sincronización de Datos',
          icon: Cpu,
          roles: ['DIRECTOR'],
        },
        {
          to: '/configuracion',
          label: 'Ajustes del Sistema',
          icon: Settings,
          roles: ['DIRECTOR'],
        },
      ]
    },
    {
      id: 'tactico',
      titulo: 'Táctico',
      badge: 'Supervisión',
      badgeColor: 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      items: [
        {
          to: '/tactico',
          label: 'Supervisión de Cajas',
          icon: ShieldCheck,
          roles: ['DIRECTOR', 'SUPERVISOR'],
        },
        {
          to: '/usuarios',
          label: 'Usuarios y Accesos',
          icon: Users,
          roles: ['DIRECTOR', 'SUPERVISOR'],
        },
      ]
    },
    {
      id: 'operativo',
      titulo: 'Operativo',
      badge: 'Piso & Venta',
      badgeColor: 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      items: [
        {
          to: '/pos',
          label: 'Punto de Venta',
          icon: Store,
          roles: ['DIRECTOR', 'SUPERVISOR', 'CAJERO'],
        },
        {
          to: '/clientes',
          label: 'Clientes y Cupones',
          icon: UserCheck,
          roles: ['DIRECTOR', 'SUPERVISOR', 'CAJERO'],
        },
        {
          to: '/inventario',
          label: 'Control de Inventario',
          icon: Package,
          roles: ['DIRECTOR', 'SUPERVISOR', 'BODEGUERO'],
        },
      ]
    },
  ];

  const sectionsFiltradas = navSections
    .map((sec) => ({
      ...sec,
      items: sec.items.filter((item) => item.roles.includes(rol)),
    }))
    .filter((sec) => sec.items.length > 0);

  const getModuloTitulo = (pathname: string) => {
    switch (pathname) {
      case '/dashboard':
        return 'Panel de Control';
      case '/operaciones':
        return 'Sincronización de Datos';
      case '/configuracion':
        return 'Ajustes del Sistema';
      case '/tactico':
        return 'Supervisión de Cajas';
      case '/usuarios':
        return 'Usuarios y Accesos';
      case '/pos':
        return 'Punto de Venta';
      case '/clientes':
        return 'Clientes y Cupones';
      case '/inventario':
        return 'Control de Inventario';
      default:
        return 'Módulo Operativo';
    }
  };

  const tituloModuloActual = getModuloTitulo(location.pathname);

  const getRoleColorBadge = (r: string) => {
    switch (r) {
      case 'DIRECTOR':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800 border-purple-200';
      case 'SUPERVISOR':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800 border-amber-200';
      case 'BODEGUERO':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800 border-blue-200';
      case 'CAJERO':
      default:
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800 border-emerald-200';
    }
  };

  // Manejo de archivo y compresión a 200x200 JPEG con HTML5 Canvas
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Por favor selecciona un archivo de imagen válido (JPEG, PNG, WebP).');
      return;
    }

    setUploadError(null);
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 200;
          canvas.height = 200;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            setUploadError('No se pudo inicializar el procesador de gráficos.');
            return;
          }

          // Recorte centrado (Center Crop) y reescalado a 200x200
          const minDim = Math.min(img.width, img.height);
          const sx = (img.width - minDim) / 2;
          const sy = (img.height - minDim) / 2;

          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, 200, 200);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setPreviewAvatar(compressedDataUrl);
        } catch {
          setUploadError('Error al procesar la compresión de la imagen.');
        }
      };
      img.onerror = () => {
        setUploadError('No se pudo decodificar el archivo de imagen.');
      };
      img.src = readerEvent.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleGuardarAvatar = async () => {
    if (!previewAvatar || !user?.id) return;
    setIsUploading(true);
    setUploadError(null);
    try {
      await api.put(`/usuarios/${user.id}/avatar`, { avatar: previewAvatar });
      updateAvatar(previewAvatar);
      setModalAvatarOpen(false);
      setPreviewAvatar(null);
    } catch (err: any) {
      setUploadError(err.response?.data?.detail || 'Error al actualizar la foto de perfil');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-200">
      {/* Sidebar Menú con RBAC Estricto */}
      <aside className="w-72 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col shadow-sm z-20 transition-colors duration-200">
        
        {/* Encabezado Logo y Marca */}
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex flex-col items-center">
          <div className="w-12 h-12 bg-quantix-100 dark:bg-quantix-900/40 text-quantix-600 dark:text-quantix-400 rounded-2xl flex items-center justify-center mb-3 shadow-inner">
             <Store className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
            QUANTIX
          </h1>
          <span className="text-[11px] font-bold text-quantix-600 dark:text-quantix-400 uppercase tracking-widest mt-0.5">
            Enterprise Retail OS
          </span>
        </div>
        
        {/* Lista de Secciones y Módulos Autorizados */}
        <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
          {sectionsFiltradas.map((section) => (
            <div key={section.id} className="space-y-1">
              
              {/* Encabezado de la Sección */}
              <div className="px-3 pt-1 pb-1.5 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  {section.titulo}
                </span>
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${section.badgeColor}`}>
                  {section.badge}
                </span>
              </div>

              {/* Módulos de la Sección */}
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.to;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl font-semibold text-xs transition-all ${
                        isActive
                          ? 'bg-quantix-600 text-white shadow-md shadow-quantix-600/20'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-gray-400 dark:text-gray-500'}`} />
                        <span className="truncate">{item.label}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Perfil de Usuario, Rol y Botón Editar Avatar */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/50">
          <div className="flex items-center gap-3 px-3 py-2.5 mb-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200/70 dark:border-gray-700 shadow-2xs">
            
            {/* Foto de Avatar o Icono por Defecto con Botón de Edición */}
            <div className="relative group/avatar shrink-0">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.nombre}
                  className="w-10 h-10 rounded-full object-cover border-2 border-quantix-500 shadow-sm"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                  <UserCircle className="w-8 h-8" />
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setPreviewAvatar(user?.avatar || null);
                  setUploadError(null);
                  setModalAvatarOpen(true);
                }}
                className="absolute -bottom-1 -right-1 bg-quantix-600 hover:bg-quantix-700 text-white p-1 rounded-full shadow-md cursor-pointer transition-transform hover:scale-110"
                title="Cambiar Foto de Perfil"
                aria-label="Cambiar foto de perfil"
              >
                <Camera className="w-2.5 h-2.5" />
              </button>
            </div>

            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-bold text-gray-900 dark:text-white truncate">
                {user?.nombre || 'Usuario'}
              </span>
              <span className="text-[10px] text-gray-400 dark:text-gray-400 truncate font-mono">
                {user?.email || 'email@quantix'}
              </span>
              <div className="mt-1 flex items-center justify-between">
                <span className={`inline-block text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${getRoleColorBadge(rol)}`}>
                  {rol}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewAvatar(user?.avatar || null);
                    setUploadError(null);
                    setModalAvatarOpen(true);
                  }}
                  className="text-[10px] text-quantix-600 dark:text-quantix-400 hover:underline font-bold cursor-pointer"
                >
                  Editar Foto
                </button>
              </div>
            </div>
          </div>

          <button 
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 px-4 py-2.5 w-full text-center text-red-600 dark:text-red-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors font-bold text-xs border border-red-100 dark:border-red-900/40 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Contenedor Principal con Barra Superior y Outlet */}
      <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
        
        {/* Barra Superior Global: Módulo Actual, Píldora de Conexión, Toggle Modo Oscuro y Notificaciones */}
        <header className="h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 flex items-center justify-between z-10 shrink-0 shadow-2xs transition-colors duration-200">
          {/* Lado Izquierdo: Contexto de Navegación */}
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-xs font-black tracking-wider uppercase text-quantix-600 dark:text-quantix-400">
              Quantix OS
            </span>
            <span className="text-gray-300 dark:text-gray-600">/</span>
            <span className="text-xs font-bold text-gray-700 dark:text-gray-200 truncate">
              {tituloModuloActual}
            </span>
          </div>

          {/* Lado Derecho: Píldora de Conexión + Toggle Modo Oscuro / Claro + Centro de Notificaciones */}
          <div className="flex items-center gap-3">
            {/* Píldora de Estado de Conexión */}
            <div 
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-default select-none ${
                isOnline
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                  : estadoConexion === 'conectando' || healthStatus === 'verificando'
                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                  : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
              }`}
              title={
                isOnline
                  ? `En línea • API Core 200 OK (${healthLatency || 15}ms) • WebSocket activo`
                  : estadoConexion === 'conectando' || healthStatus === 'verificando'
                  ? 'Verificando enlace y reconectando...'
                  : 'Desconectado • Sin comunicación con el servidor backend'
              }
            >
              <span className="relative flex h-2 w-2">
                {isOnline && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${
                  isOnline 
                    ? 'bg-emerald-500' 
                    : (estadoConexion === 'conectando' || healthStatus === 'verificando') 
                    ? 'bg-amber-500' 
                    : 'bg-red-500'
                }`}></span>
              </span>
              <span className="text-[11px] font-extrabold tracking-tight">
                {isOnline ? 'En línea' : (estadoConexion === 'conectando' || healthStatus === 'verificando') ? 'Conectando...' : 'Desconectado'}
              </span>
            </div>

            {/* Botón Mi Turno / Mi Actividad */}
            <button
              type="button"
              onClick={() => setModalActividadOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 font-bold text-xs transition-all cursor-pointer shadow-2xs"
              title="Consultar Mi Turno / Mi Actividad"
            >
              <Clock className="w-3.5 h-3.5 text-quantix-600 dark:text-quantix-400" />
              <span className="hidden sm:inline">Mi Turno</span>
            </button>

            {/* Toggle Modo Oscuro / Claro (Sol / Luna) */}
            <button
              type="button"
              onClick={toggleDarkMode}
              className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-amber-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all cursor-pointer shadow-2xs"
              title={isDarkMode ? "Cambiar a Modo Claro" : "Cambiar a Modo Oscuro"}
              aria-label="Alternar Modo Oscuro"
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4 text-amber-400 hover:rotate-45 transition-transform" />
              ) : (
                <Moon className="w-4 h-4 text-gray-600 hover:-rotate-12 transition-transform" />
              )}
            </button>

            {/* Centro de Notificaciones Push */}
            <NotificationCenter />
          </div>
        </header>

        {/* Contenido de Página */}
        <main className="flex-1 overflow-hidden relative bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
          <Outlet />
        </main>
      </div>

      {/* MODAL: CAMBIAR FOTO DE PERFIL (CON COMPRESIÓN HTML5 CANVAS 200x200 JPEG) */}
      {modalAvatarOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            
            {/* Header del Modal con Botón 'X' */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-quantix-50 dark:bg-quantix-900/30 text-quantix-600 dark:text-quantix-400 rounded-xl">
                  <Camera className="w-5 h-5" />
                </div>
                <h3 className="text-base font-black text-gray-900 dark:text-white">
                  Cambiar Foto de Perfil
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalAvatarOpen(false);
                  setPreviewAvatar(null);
                  setUploadError(null);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                aria-label="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido del Modal */}
            <div className="py-5 space-y-4">
              {uploadError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs rounded-xl">
                  {uploadError}
                </div>
              )}

              {/* Vista Previa */}
              <div className="flex flex-col items-center justify-center gap-3">
                <div className="w-32 h-32 rounded-full border-4 border-quantix-500/30 dark:border-quantix-500/50 overflow-hidden shadow-inner flex items-center justify-center bg-gray-100 dark:bg-gray-800 relative">
                  {previewAvatar ? (
                    <img 
                      src={previewAvatar} 
                      alt="Vista previa del avatar" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <UserCircle className="w-24 h-24 text-gray-400 dark:text-gray-500" />
                  )}
                </div>
                <div className="text-center">
                  <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 block">
                    Resolución estándar: 200 × 200 px (JPEG optimizado)
                  </span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">
                    Se comprimirá automáticamente en el navegador usando Canvas HTML5
                  </span>
                </div>
              </div>

              {/* Input de Selección de Imagen */}
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3 px-4 border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-quantix-500 dark:hover:border-quantix-400 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-quantix-50/50 dark:hover:bg-quantix-950/30 transition-all cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-quantix-600 dark:text-quantix-400" />
                  <span>Seleccionar imagen desde tu dispositivo</span>
                </button>
              </div>
            </div>

            {/* Footer con Botones Cancelar / Guardar */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => {
                  setModalAvatarOpen(false);
                  setPreviewAvatar(null);
                  setUploadError(null);
                }}
                disabled={isUploading}
                className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 font-bold text-xs transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleGuardarAvatar}
                disabled={!previewAvatar || isUploading}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all ${
                  previewAvatar && !isUploading
                    ? 'bg-quantix-600 hover:bg-quantix-700 text-white cursor-pointer active:scale-95'
                    : 'bg-gray-300 dark:bg-gray-800 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isUploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Guardar Foto</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL MI TURNO / MI ACTIVIDAD */}
      <MiActividadModal 
        isOpen={modalActividadOpen} 
        onClose={() => setModalActividadOpen(false)} 
      />
    </div>
  );
}
