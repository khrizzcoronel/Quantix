import { Outlet, Link } from 'react-router-dom';
import { Store, BarChart3, LogOut } from 'lucide-react';

export default function Layout() {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar Menú */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-quantix-600 flex items-center gap-2">
            <Store className="w-8 h-8" />
            Quantix
          </h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <Link to="/pos" className="flex items-center gap-3 px-4 py-3 text-gray-700 rounded-lg hover:bg-quantix-50 hover:text-quantix-600 transition-colors font-medium">
            <Store className="w-5 h-5" />
            Caja POS
          </Link>
          <Link to="/dashboard" className="flex items-center gap-3 px-4 py-3 text-gray-700 rounded-lg hover:bg-quantix-50 hover:text-quantix-600 transition-colors font-medium">
            <BarChart3 className="w-5 h-5" />
            BI Estratégico
          </Link>
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button className="flex items-center gap-3 px-4 py-2 w-full text-left text-red-600 rounded-lg hover:bg-red-50 transition-colors">
            <LogOut className="w-5 h-5" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Contenido Principal */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
