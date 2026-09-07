import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Store, BarChart3, LogOut, UserCircle, 
  ShieldCheck, Package, Settings
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export default function Layout() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const rol = user?.rol || 'CAJERO';

  // Configuración de rutas según la Pirámide Organizacional de Anthony
  const navItems = [
    {
      to: '/dashboard',
      label: 'BI Estratégico (DuckDB)',
      icon: BarChart3,
      roles: ['DIRECTOR'],
      badge: 'Estratégico'
    },
    {
      to: '/configuracion',
      label: 'Ajustes del Sistema',
      icon: Settings,
      roles: ['DIRECTOR'],
      badge: 'Control Global'
    },
    {
      to: '/tactico',
      label: 'Monitor Táctico & Mermas',
      icon: ShieldCheck,
      roles: ['DIRECTOR', 'SUPERVISOR'],
      badge: 'Táctico'
    },
    {
      to: '/inventario',
      label: 'Inventario & Lotes FEFO',
      icon: Package,
      roles: ['DIRECTOR', 'SUPERVISOR', 'BODEGUERO'],
      badge: 'Bodega'
    },
    {
      to: '/pos',
      label: 'Caja Registradora',
      icon: Store,
      roles: ['DIRECTOR', 'SUPERVISOR', 'CAJERO'],
      badge: 'Operativo'
    },
  ];

  const allowedNav = navItems.filter(item => item.roles.includes(rol));

  const getRoleColorBadge = (r: string) => {
    switch (r) {
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

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar Menú con RBAC Estricto */}
      <aside className="w-72 bg-white border-r border-gray-200 flex flex-col shadow-sm z-20">
        <div className="p-6 border-b border-gray-100 flex flex-col items-center">
          <div className="w-12 h-12 bg-quantix-100 text-quantix-600 rounded-2xl flex items-center justify-center mb-3 shadow-inner">
             <Store className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            QUANTIX
          </h1>
          <span className="text-[11px] font-bold text-quantix-600 uppercase tracking-widest mt-0.5">
            Enterprise Retail OS
          </span>
        </div>
        
        {/* Navegación Filtrada por Rol */}
        <div className="px-4 py-2 mt-3">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 px-3">
            Módulos Autorizados
          </span>
        </div>

        <nav className="flex-1 px-3 space-y-1.5 overflow-y-auto">
          {allowedNav.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center justify-between px-3.5 py-3 rounded-xl font-semibold text-sm transition-all ${
                  isActive
                    ? 'bg-quantix-600 text-white shadow-md shadow-quantix-600/20'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                  <span>{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Perfil de Usuario y Rol */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/70">
          <div className="flex items-center gap-3 px-2 py-2 mb-3 bg-white rounded-xl border border-gray-200/70 shadow-2xs">
            <UserCircle className="w-9 h-9 text-gray-400 shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-gray-900 truncate">
                {user?.nombre || 'Usuario'}
              </span>
              <span className="text-[10px] text-gray-400 truncate font-mono">
                {user?.email || 'email@quantix'}
              </span>
              <div className="mt-1">
                <span className={`inline-block text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${getRoleColorBadge(rol)}`}>
                  {rol}
                </span>
              </div>
            </div>
          </div>

          <button 
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 px-4 py-2.5 w-full text-center text-red-600 rounded-xl hover:bg-red-50 transition-colors font-bold text-xs border border-red-100"
          >
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Contenido Principal */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
