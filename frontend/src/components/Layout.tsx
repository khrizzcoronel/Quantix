import { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Store, BarChart3, LogOut, UserCircle, 
  ShieldCheck, Package, Settings, Users,
  Cpu, UserCheck, Sun, Moon, Camera,
  Loader2, Clock, AlertTriangle, AlertCircle, RefreshCw,
  Phone
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { useConnectivityStore } from '../store/connectivityStore';
import { dispararSincronizacion } from '../services/offline/syncWorker';
import NotificationCenter from './NotificationCenter';
import MiActividadModal from './MiActividadModal';
import PerfilUsuarioModal from './PerfilUsuarioModal';
import { useWebSocket } from '../hooks/useWebSocket';

export default function Layout() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const { isDarkMode, toggleDarkMode } = useThemeStore();
  
  const navigate = useNavigate();
  const location = useLocation();

  // Estado para el modal de Perfil de Usuario
  const [modalPerfilOpen, setModalPerfilOpen] = useState(false);

  // Estado para el modal Mi Actividad
  const [modalActividadOpen, setModalActividadOpen] = useState(false);

  // Estado de conexión WebSocket y sincronización offline gestionados globalmente
  const { estadoConexion } = useWebSocket();
  const {
    status: connectivityStatus,
    pendingSyncCount,
    latency: healthLatency,
    snapshotInfo,
    startPolling,
    stopPolling,
    checkHealth
  } = useConnectivityStore();

  useEffect(() => {
    startPolling();
    return () => {
      stopPolling();
    };
  }, [startPolling, stopPolling]);

  const isOnline = connectivityStatus === 'ONLINE' && estadoConexion === 'conectado';

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
                onClick={() => setModalPerfilOpen(true)}
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
              {user?.telefono && (
                <span className="text-[10px] text-gray-400 dark:text-gray-400 truncate font-mono flex items-center gap-1">
                  <Phone className="w-2.5 h-2.5 shrink-0" />
                  {user.telefono}
                </span>
              )}
              <div className="mt-1 flex items-center justify-between">
                <span className={`inline-block text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${getRoleColorBadge(rol)}`}>
                  {rol}
                </span>
                <button
                  type="button"
                  onClick={() => setModalPerfilOpen(true)}
                  className="text-[10px] text-quantix-600 dark:text-quantix-400 hover:underline font-bold cursor-pointer"
                >
                  Editar Perfil
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
                  : connectivityStatus === 'OFFLINE_LISTO'
                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                  : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
              }`}
              title={
                isOnline
                  ? `En línea • API Core 200 OK (${healthLatency || 15}ms) • WebSocket ${estadoConexion}`
                  : connectivityStatus === 'OFFLINE_LISTO'
                  ? 'Modo Offline Seguro • Catálogo local disponible • Cobros únicamente en Efectivo'
                  : 'Desconectado • Sin comunicación con el servidor ni catálogo disponible'
              }
            >
              <span className="relative flex h-2 w-2">
                {isOnline && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${
                  isOnline 
                    ? 'bg-emerald-500' 
                    : connectivityStatus === 'OFFLINE_LISTO'
                    ? 'bg-amber-500' 
                    : 'bg-red-500'
                }`}></span>
              </span>
              <span className="text-[11px] font-extrabold tracking-tight">
                {isOnline ? 'En línea' : connectivityStatus === 'OFFLINE_LISTO' ? 'Offline Seguro' : 'Desconectado'}
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

        {/* Banner Persistente de Modo Offline Seguro */}
        {connectivityStatus === 'OFFLINE_LISTO' && (
          <div className="bg-amber-500 dark:bg-amber-600 text-white px-6 py-2.5 flex items-center justify-between shadow-md z-15 text-xs font-semibold animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-100" />
              <span className="truncate">
                <strong>Modo Offline Seguro:</strong> Operando sin conexión al servidor central. Cobros permitidos <strong>únicamente en Efectivo</strong>.
                {snapshotInfo?.horasAntiguedad !== null && snapshotInfo?.horasAntiguedad !== undefined && (
                  <span className="ml-1.5 opacity-90 hidden md:inline">
                    (Catálogo local: {snapshotInfo.horasAntiguedad === 0 ? 'actualizado recientemente' : `hace ${snapshotInfo.horasAntiguedad} h`})
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              {pendingSyncCount > 0 && (
                <span className="bg-amber-700/60 dark:bg-amber-800/80 px-2.5 py-0.5 rounded-full text-[11px] font-bold border border-amber-400/40">
                  {pendingSyncCount} {pendingSyncCount === 1 ? 'pendiente' : 'pendientes'}
                </span>
              )}
              <button
                type="button"
                onClick={() => void checkHealth()}
                className="px-2.5 py-1 bg-white text-amber-800 hover:bg-amber-50 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                title="Reintentar enlace con el servidor"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Reintentar</span>
              </button>
            </div>
          </div>
        )}

        {/* Banner Persistente de Modo Offline No Disponible */}
        {connectivityStatus === 'OFFLINE_NO_DISPONIBLE' && (
          <div className="bg-red-600 text-white px-6 py-2.5 flex items-center justify-between shadow-md z-15 text-xs font-semibold animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-200" />
              <span className="truncate">
                <strong>Cobro Suspendido:</strong> Sin conexión con el servidor y no existe catálogo local válido o vigente. Se requiere enlace para sincronizar.
              </span>
            </div>
            <button
              type="button"
              onClick={() => void checkHealth()}
              className="px-2.5 py-1 bg-white text-red-700 hover:bg-red-50 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer shrink-0"
              title="Reintentar enlace con el servidor"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reintentar</span>
            </button>
          </div>
        )}

        {/* Indicador Discreto de Sincronización en Progreso (Online con Cola Pendiente) */}
        {connectivityStatus === 'ONLINE' && pendingSyncCount > 0 && (
          <div className="bg-quantix-600 text-white px-6 py-1.5 flex items-center justify-between text-xs font-semibold z-15">
            <div className="flex items-center gap-2 min-w-0">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-quantix-200 shrink-0" />
              <span className="truncate">
                Sincronizando {pendingSyncCount} {pendingSyncCount === 1 ? 'venta offline pendiente' : 'ventas offline pendientes'} con el servidor central...
              </span>
            </div>
            <button
              type="button"
              onClick={() => void dispararSincronizacion()}
              className="text-[11px] underline hover:text-quantix-100 font-bold cursor-pointer shrink-0 ml-2"
            >
              Sincronizar ahora
            </button>
          </div>
        )}

        {/* Contenido de Página */}
        <main className="flex-1 overflow-hidden relative bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
          <Outlet />
        </main>
      </div>

      {/* MODAL PERFIL DE USUARIO */}
      <PerfilUsuarioModal
        isOpen={modalPerfilOpen}
        onClose={() => setModalPerfilOpen(false)}
      />

      {/* MODAL MI TURNO / MI ACTIVIDAD */}
      <MiActividadModal 
        isOpen={modalActividadOpen} 
        onClose={() => setModalActividadOpen(false)} 
      />
    </div>
  );
}
