import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Store, Loader2, Users } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const login = useAuthStore((state) => state.login);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();

  // Si ya está autenticado, redirigir a su vista según su rol
  if (isAuthenticated && user) {
    if (user.rol === 'DIRECTOR') return <Navigate to="/dashboard" replace />;
    if (user.rol === 'SUPERVISOR') return <Navigate to="/tactico" replace />;
    if (user.rol === 'BODEGUERO') return <Navigate to="/inventario" replace />;
    return <Navigate to="/pos" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      await login(email, password);
      // Obtener el rol recién almacenado
      const currentUser = useAuthStore.getState().user;
      if (currentUser?.rol === 'DIRECTOR') {
        navigate('/dashboard');
      } else if (currentUser?.rol === 'SUPERVISOR') {
        navigate('/tactico');
      } else if (currentUser?.rol === 'BODEGUERO') {
        navigate('/inventario');
      } else {
        navigate('/pos');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Credenciales inválidas o error de conexión con el backend');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickFill = (testEmail: string, testPass: string) => {
    setEmail(testEmail);
    setPassword(testPass);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md flex flex-col items-center">
        <div className="bg-quantix-100 p-4 rounded-2xl text-quantix-600 mb-4 shadow-sm">
          <Store className="w-12 h-12" />
        </div>
        <h2 className="text-center text-3xl font-black text-gray-900 tracking-tight">
          Quantix Retail OS
        </h2>
        <p className="mt-1 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Autenticación Centralizada por Roles (RBAC)
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl sm:rounded-2xl sm:px-10 border border-gray-100">
          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded-r-lg">
                <p className="text-xs font-semibold text-red-700">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Correo Corporativo
              </label>
              <input 
                type="email" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@quantix.local"
                className="block w-full border border-gray-300 rounded-xl shadow-xs py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-quantix-500 transition-colors" 
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Contraseña
              </label>
              <input 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="block w-full border border-gray-300 rounded-xl shadow-xs py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-quantix-500 transition-colors" 
              />
            </div>

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full mt-2 flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-lg text-sm font-extrabold text-white bg-quantix-600 hover:bg-quantix-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-quantix-500 disabled:opacity-70 transition-all active:scale-95"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" />
                  Verificando credenciales...
                </>
              ) : (
                'Iniciar Sesión'
              )}
            </button>
          </form>

          {/* Accesos Rápidos de Prueba */}
          <div className="mt-6 pt-5 border-t border-gray-100">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-2 flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              Cuentas demo para probar roles:
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickFill('admin@quantix.local', 'Admin123!')}
                className="p-2 text-left rounded-lg bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors"
              >
                <span className="block text-xs font-bold text-purple-900">DIRECTOR</span>
                <span className="block text-[10px] text-purple-600">Acceso a BI & Táctico</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('cajero@quantix.local', 'Caja123!')}
                className="p-2 text-left rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors"
              >
                <span className="block text-xs font-bold text-emerald-900">CAJERO</span>
                <span className="block text-[10px] text-emerald-600">Solo Caja & Arqueo</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
