import { Outlet, Link, useNavigate } from 'react-router-dom';
import { Store, BarChart3, LogOut, UserCircle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export default function Layout() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar Menú */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shadow-sm z-10">
        <div className="p-6 border-b border-gray-100 flex flex-col items-center">
          <div className="w-12 h-12 bg-quantix-100 text-quantix-600 rounded-xl flex items-center justify-center mb-3">
             <Store className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">
            QUANTIX
          </h1>
          <span className="text-xs font-semibold text-quantix-600 uppercase tracking-wider mt-1">Smart POS</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 mt-4">
          <Link to="/pos" className="flex items-center gap-3 px-4 py-3 text-gray-600 rounded-xl hover:bg-quantix-50 hover:text-quantix-700 transition-all font-medium">
            <Store className="w-5 h-5" />
            Caja Registradora
          </Link>
          
          {/* Solo mostramos el dashboard si el rol lo permite */}
          {user?.rol !== 'CAJERO' && (
            <Link to="/dashboard" className="flex items-center gap-3 px-4 py-3 text-gray-600 rounded-xl hover:bg-quantix-50 hover:text-quantix-700 transition-all font-medium">
              <BarChart3 className="w-5 h-5" />
              BI Estratégico
            </Link>
          )}
        </nav>

        <div className="p-4 border-t border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <UserCircle className="w-8 h-8 text-gray-400" />
            <div className="flex flex-col">
              <span className="text-sm font-bold text-gray-900 truncate">{user?.nombre || 'Usuario'}</span>
              <span className="text-xs text-gray-500 font-medium">{user?.rol || 'Rol'}</span>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2.5 w-full text-left text-red-600 rounded-lg hover:bg-red-50 transition-colors font-medium text-sm"
          >
            <LogOut className="w-4 h-4" />
            Cerrar Turno
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
