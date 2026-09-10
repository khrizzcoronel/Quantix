import { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Store, BarChart3, LineChart, LogOut, UserCircle, 
  ShieldCheck, Package, Settings, Users,
  Cpu, UserCheck, Sun, Moon, Camera,
  Loader2, Clock, AlertTriangle, AlertCircle, RefreshCw,
  Phone, Building2, ChevronDown, Lock
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { useConnectivityStore } from '../store/connectivityStore';
import { useSucursalStore } from '../store/sucursalStore';
import { dispararSincronizacion } from '../services/offline/syncWorker';
import NotificationCenter from './NotificationCenter';
import ToastContainer from './ToastContainer';
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

  // Gestión de Sucursal Activa
  const { sucursales, sucursalActual, cargarSucursales, seleccionarSucursal } = useSucursalStore();
  const [menuSucursalOpen, setMenuSucursalOpen] = useState(false);

  const isDirector = user?.rol === 'DIRECTOR';

  useEffect(() => {
    void cargarSucursales();
  }, [cargarSucursales, user?.id, user?.sucursal_id]);

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
          to: '/analisis',
          label: 'Análisis & Reportes',
          icon: LineChart,
          roles: ['DIRECTOR', 'SUPERVISOR'],
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

  return (
    <div className="flex h-screen bg-background text-on-surface antialiased print:h-auto print:block print:bg-white print:overflow-visible">
      {/* Sidebar Menú con RBAC Estricto — Neo-Retail */}
      <aside className="w-72 bg-surface-container-lowest border-r border-surface-container-high/60 flex flex-col justify-between shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-30 transition-all print:hidden">
        
        {/* Encabezado Logo y Marca */}
        <div className="p-5 border-b border-surface-container-low flex flex-col items-center select-none">
          <Link to="/" className="flex items-center justify-center w-full group py-1" title="Quantix Retail OS">
            <img 
              src="/quantix_logo.png" 
              alt="Quantix Retail OS" 
              className="h-12 w-auto object-contain max-w-[225px] transition-transform duration-200 group-hover:scale-[1.03] dark:brightness-125" 
            />
          </Link>
        </div>
        
        {/* Lista de Secciones y Módulos Autorizados */}
        <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
          {sectionsFiltradas.map((section) => (
            <div key={section.id} className="space-y-1">
              
              {/* Encabezado de la Sección */}
              <div className="px-3 pt-1 pb-1 flex items-center justify-between">
                <span className="font-label-caps text-[10px] font-bold uppercase tracking-wider text-outline">
                  {section.titulo}
                </span>
                <span className={`font-label-caps text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${section.badgeColor}`}>
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
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl font-title-md text-body-sm transition-all group ${
                        isActive
                          ? 'bg-primary-container text-on-primary-container font-bold shadow-sm'
                          : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${isActive ? 'text-on-primary-container' : 'text-outline'}`} />
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
        <div className="p-3 border-t border-surface-container-low bg-surface-container-lowest">
          <div className="p-3 bg-surface-container-low rounded-3xl flex flex-col gap-2.5 border border-surface-container-high/40 shadow-xs">
            
            <div className="flex items-center gap-3">
              {/* Foto de Avatar o Icono por Defecto con Botón de Edición */}
              <div className="relative group/avatar shrink-0">
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.nombre}
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-primary-container shadow-xs"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-outline ring-2 ring-surface-container-high">
                    <UserCircle className="w-7 h-7" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setModalPerfilOpen(true)}
                  className="absolute -bottom-1 -right-1 bg-primary text-on-primary p-1 rounded-full shadow-md cursor-pointer transition-transform hover:scale-110"
                  title="Cambiar Foto de Perfil"
                  aria-label="Cambiar foto de perfil"
                >
                  <Camera className="w-2.5 h-2.5" />
                </button>
              </div>

              <div className="flex flex-col min-w-0 flex-1">
                <span className="font-title-md text-body-sm text-on-surface font-bold truncate">
                  {user?.nombre || 'Usuario'}
                </span>
                <span className="font-body-sm text-[11px] text-on-surface-variant truncate">
                  {user?.email || 'email@quantix'}
                </span>
                {user?.telefono && (
                  <span className="font-body-sm text-[10px] text-outline truncate flex items-center gap-1 mt-0.5">
                    <Phone className="w-2.5 h-2.5 shrink-0" />
                    {user.telefono}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-surface-container-high/50">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => setModalPerfilOpen(true)}
                  className="flex items-center justify-center p-1.5 rounded-full text-on-surface-variant hover:text-primary hover:bg-surface-container-high/60 transition-colors cursor-pointer group shrink-0"
                  title="Configuración de Perfil"
                  aria-label="Configuración de perfil"
                >
                  <span className="material-symbols-outlined text-[18px] transition-transform duration-300 group-hover:rotate-45 leading-none">settings</span>
                </button>
                <span className={`px-2.5 py-0.5 rounded-full font-label-caps text-[10px] uppercase tracking-wider font-bold select-none truncate ${
                  rol === 'DIRECTOR'
                    ? 'bg-tertiary-fixed text-on-tertiary-fixed border border-tertiary-container/60 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800'
                    : rol === 'SUPERVISOR'
                    ? 'bg-secondary-fixed text-on-secondary-fixed-variant border border-secondary-container/60 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                    : rol === 'BODEGUERO'
                    ? 'bg-blue-100 text-blue-900 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
                    : 'bg-primary-fixed text-on-primary-fixed-variant border border-primary-container/60 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                }`}>
                  {rol}
                </span>
              </div>
              <button 
                onClick={handleLogout}
                className="flex items-center gap-1 text-error hover:bg-error-container/30 px-2.5 py-1 rounded-full font-label-caps text-[10px] font-bold uppercase transition-colors cursor-pointer shrink-0"
                title="Cerrar Sesión"
              >
                <LogOut className="w-3 h-3" />
                <span>Salir</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Contenedor Principal con Barra Superior y Outlet */}
      <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden bg-background print:h-auto print:block print:overflow-visible print:bg-white print:w-full">
        
        {/* Barra Superior Global — Neo-Retail */}
        <header className="h-16 bg-surface-container-lowest/90 backdrop-blur-xl border-b border-surface-container-high/60 px-6 md:px-8 flex items-center justify-between z-20 shrink-0 shadow-[0_1px_8px_rgba(0,0,0,0.04)] print:hidden">
          {/* Lado Izquierdo: Selector de Sucursal Activa */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Selector de Sucursal Activa con Leyenda */}
            {sucursalActual && (
              isDirector ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMenuSucursalOpen(!menuSucursalOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-low hover:bg-surface-container border border-surface-container-high/60 font-title-md text-body-sm transition-all cursor-pointer shadow-xs"
                    title="Cambiar sucursal activa de trabajo (Acceso Director - Multi-Sede Global)"
                  >
                    <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="font-bold text-on-surface max-w-[120px] sm:max-w-[180px] truncate">
                      {sucursalActual.nombre}
                    </span>
                    {sucursalActual.es_matriz && (
                      <span className="hidden sm:inline px-1.5 py-0.2 rounded-full font-label-caps text-[9px] font-bold uppercase bg-primary-container text-on-primary-container">
                        Matriz
                      </span>
                    )}
                    <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-label-caps text-[9px] font-bold uppercase bg-tertiary-fixed/30 text-on-tertiary-fixed-variant border border-tertiary-fixed/40">
                      Multi-Sede
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-on-surface-variant transition-transform ${menuSucursalOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Menú desplegable de Sucursales */}
                  {menuSucursalOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setMenuSucursalOpen(false)}
                      />
                      <div className="absolute left-0 mt-2 w-72 bg-surface-container-lowest rounded-2xl border border-surface-container-high/70 shadow-xl py-2 z-40 animate-in fade-in zoom-in duration-150">
                        <div className="px-3.5 py-2 border-b border-surface-container-low flex flex-col gap-0.5">
                          <span className="font-label-caps text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">
                            Sucursales Disponibles ({sucursales.length})
                          </span>
                          <span className="text-[11px] text-primary font-medium">
                            Leyenda: Acceso global para alternar sedes libremente
                          </span>
                        </div>
                        <div className="max-h-56 overflow-y-auto py-1">
                          {sucursales.map((suc) => {
                            const isSelected = suc.id === sucursalActual.id;
                            return (
                              <button
                                key={suc.id}
                                type="button"
                                onClick={() => {
                                  seleccionarSucursal(suc);
                                  setMenuSucursalOpen(false);
                                }}
                                className={`w-full px-3.5 py-2 text-left flex items-center justify-between hover:bg-surface-container transition-colors cursor-pointer ${
                                  isSelected ? 'bg-primary-container/20 font-bold text-primary' : 'text-on-surface'
                                }`}
                              >
                                <div className="flex flex-col min-w-0">
                                  <span className="font-title-md text-body-sm truncate">{suc.nombre}</span>
                                  <span className="font-label-caps text-[10px] text-on-surface-variant">{suc.codigo}</span>
                                </div>
                                {suc.es_matriz && (
                                  <span className="px-2 py-0.5 rounded-full font-label-caps text-[9px] uppercase font-bold bg-secondary-container text-on-secondary-container">
                                    Matriz
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-low border border-surface-container-high/50 font-title-md text-body-sm shadow-xs select-none"
                  title={`Sucursal fija asignada a tu usuario: ${sucursalActual.nombre}. Solo la dirección general puede alternar entre sucursales.`}
                >
                  <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="font-bold text-on-surface max-w-[120px] sm:max-w-[180px] truncate">
                    {sucursalActual.nombre}
                  </span>
                  {sucursalActual.es_matriz && (
                    <span className="hidden sm:inline px-1.5 py-0.2 rounded-full font-label-caps text-[9px] font-bold uppercase bg-primary-container text-on-primary-container">
                      Matriz
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-label-caps text-[9px] font-bold uppercase bg-surface-container-high text-on-surface-variant border border-surface-container-high">
                    <Lock className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                    <span>Sede Fija</span>
                  </span>
                </div>
              )
            )}
          </div>

          {/* Lado Derecho: Píldora de Conexión + Mi Turno + Toggle Modo Oscuro + Centro de Notificaciones */}
          <div className="flex items-center gap-2.5">
            {/* Píldora de Estado de Conexión */}
            <div 
              className={`flex items-center gap-2 px-3 py-1 rounded-full font-label-caps text-label-caps uppercase font-bold transition-all cursor-default select-none ${
                isOnline
                  ? 'bg-primary-fixed/30 text-on-primary-fixed-variant'
                  : connectivityStatus === 'OFFLINE_LISTO'
                  ? 'bg-amber-100 text-amber-900'
                  : 'bg-error-container text-on-error-container'
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
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-container opacity-75"></span>
                )}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${
                  isOnline 
                    ? 'bg-primary' 
                    : connectivityStatus === 'OFFLINE_LISTO'
                    ? 'bg-amber-500' 
                    : 'bg-error'
                }`}></span>
              </span>
              <span>
                {isOnline ? 'Online' : connectivityStatus === 'OFFLINE_LISTO' ? 'Offline Seguro' : 'Desconectado'}
              </span>
            </div>

            {/* Botón Mi Turno / Mi Actividad */}
            <button
              type="button"
              onClick={() => setModalActividadOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-low hover:bg-surface-container text-on-surface font-title-md text-body-sm transition-all cursor-pointer"
              title="Consultar Mi Turno / Mi Actividad"
            >
              <Clock className="w-3.5 h-3.5 text-primary" />
              <span className="hidden sm:inline">Mi Turno</span>
            </button>

            {/* Toggle Modo Oscuro / Claro */}
            <button
              type="button"
              onClick={toggleDarkMode}
              className="p-2 rounded-full bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-all cursor-pointer"
              title={isDarkMode ? "Cambiar a Modo Claro" : "Cambiar a Modo Oscuro"}
              aria-label="Alternar Modo Oscuro"
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4 text-amber-500" />
              ) : (
                <Moon className="w-4 h-4 text-on-surface-variant" />
              )}
            </button>

            {/* Centro de Notificaciones Push */}
            <NotificationCenter />
          </div>
        </header>

        {/* Banner Persistente de Modo Offline Seguro */}
        {connectivityStatus === 'OFFLINE_LISTO' && (
          <div className="bg-amber-500 text-white px-6 py-2.5 flex items-center justify-between shadow-sm z-15 text-body-sm font-medium print:hidden">
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
                <span className="bg-amber-700 px-2.5 py-0.5 rounded-full font-label-caps text-[11px] font-bold">
                  {pendingSyncCount} {pendingSyncCount === 1 ? 'pendiente' : 'pendientes'}
                </span>
              )}
              <button
                type="button"
                onClick={() => void checkHealth()}
                className="px-3 py-1 bg-surface-container-lowest text-amber-800 hover:bg-amber-50 rounded-full font-title-md text-body-sm font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
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
          <div className="bg-error text-on-error px-6 py-2.5 flex items-center justify-between shadow-sm z-15 text-body-sm font-medium print:hidden">
            <div className="flex items-center gap-2.5 min-w-0">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="truncate">
                <strong>Cobro Suspendido:</strong> Sin conexión con el servidor y no existe catálogo local válido o vigente. Se requiere enlace para sincronizar.
              </span>
            </div>
            <button
              type="button"
              onClick={() => void checkHealth()}
              className="px-3 py-1 bg-surface-container-lowest text-error hover:bg-error-container rounded-full font-title-md text-body-sm font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer shrink-0"
              title="Reintentar enlace con el servidor"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reintentar</span>
            </button>
          </div>
        )}

        {/* Indicador Discreto de Sincronización en Progreso */}
        {connectivityStatus === 'ONLINE' && pendingSyncCount > 0 && (
          <div className="bg-primary text-on-primary px-6 py-1.5 flex items-center justify-between text-body-sm font-medium z-15 print:hidden">
            <div className="flex items-center gap-2 min-w-0">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-fixed shrink-0" />
              <span className="truncate">
                Sincronizando {pendingSyncCount} {pendingSyncCount === 1 ? 'venta offline pendiente' : 'ventas offline pendientes'} con el servidor central...
              </span>
            </div>
            <button
              type="button"
              onClick={() => void dispararSincronizacion()}
              className="text-body-sm underline hover:opacity-80 font-bold cursor-pointer shrink-0 ml-2"
            >
              Sincronizar ahora
            </button>
          </div>
        )}

        {/* Contenido de Página */}
        <main className="flex-1 overflow-hidden relative bg-background print:overflow-visible print:h-auto print:block print:bg-white print:p-0">
          <Outlet />
        </main>
      </div>

      {/* NOTIFICACIONES EMERGENTES / TOASTS */}
      <div className="print:hidden">
        <ToastContainer />
      </div>

      {/* MODAL PERFIL DE USUARIO */}
      <div className="print:hidden">
        <PerfilUsuarioModal
          isOpen={modalPerfilOpen}
          onClose={() => setModalPerfilOpen(false)}
        />
      </div>

      {/* MODAL MI TURNO / MI ACTIVIDAD */}
      <div className="print:hidden">
        <MiActividadModal 
          isOpen={modalActividadOpen} 
          onClose={() => setModalActividadOpen(false)} 
        />
      </div>
    </div>
  );
}
