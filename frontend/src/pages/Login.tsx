import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Loader2, Users } from 'lucide-react';

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
      const loggedUser = await login(email, password);
      
      switch (loggedUser?.rol) {
        case 'DIRECTOR':
          navigate('/dashboard', { replace: true });
          break;
        case 'SUPERVISOR':
          navigate('/tactico', { replace: true });
          break;
        case 'BODEGUERO':
          navigate('/inventario', { replace: true });
          break;
        case 'CAJERO':
        default:
          navigate('/pos', { replace: true });
          break;
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
    <div className="min-h-screen bg-background font-body-md text-on-surface antialiased flex flex-col justify-between relative overflow-hidden select-none">
      {/* Ambient background glow blobs */}
      <div className="absolute -top-24 -left-20 w-96 h-96 rounded-full bg-gradient-to-tr from-primary-container/15 via-secondary-container/10 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-20 w-96 h-96 rounded-full bg-gradient-to-tr from-tertiary-container/15 via-primary-container/10 to-transparent blur-3xl pointer-events-none" />

      {/* Top Header Strip — Neo-Retail Security & Edge Bar */}
      <header className="w-full bg-surface-container-lowest/80 backdrop-blur-xl border-b border-surface-container-high/50 z-20">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center">
            <img 
              src="/quantix_logo.png" 
              alt="Quantix Retail OS" 
              className="h-9 w-auto object-contain dark:brightness-125" 
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-surface-container-low rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-container opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              <span className="font-label-caps text-[11px] font-bold uppercase text-on-surface">
                Online 12ms • Cluster Central
              </span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1 bg-surface-container-low rounded-full">
              <span className="material-symbols-outlined text-primary text-[16px]">verified_user</span>
              <span className="font-label-caps text-[10px] font-bold uppercase text-on-surface-variant">
                PCI-DSS 4.0
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Login Frame */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 relative z-10">
        <div className="w-full max-w-lg mx-auto">
          <div className="bg-surface-container-lowest rounded-3xl shadow-xl border border-surface-container-high/40 p-8 sm:p-10 flex flex-col gap-6">
            
            {/* Header del Formulario */}
            <div className="flex flex-col items-center text-center">
              <img 
                src="/quantix_logo.png" 
                alt="Quantix Retail OS" 
                className="h-12 w-auto object-contain mb-3 dark:brightness-125" 
              />
              <span className="px-3 py-1 rounded-full bg-surface-container-low text-primary font-label-caps text-[11px] font-bold uppercase tracking-wider mb-2">
                Autenticación Unificada (RBAC)
              </span>
              <h2 className="font-headline-xl text-2xl sm:text-3xl font-bold text-on-surface tracking-tight">
                Iniciar Sesión
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                Ingresa con tu correo corporativo y contraseña autorizada
              </p>
            </div>

            {error && (
              <div className="p-3.5 bg-error-container text-on-error-container rounded-2xl flex items-center gap-3 text-body-sm font-semibold">
                <span className="material-symbols-outlined text-error text-[20px] shrink-0">error</span>
                <span>{error}</span>
              </div>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-bold block mb-1.5">
                  Correo Corporativo
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-4 text-outline text-[20px] pointer-events-none">
                    mail
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@quantix.local"
                    className="w-full h-14 pl-12 pr-4 bg-surface-container-low rounded-2xl font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 focus:shadow-sm transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-bold block mb-1.5">
                  Contraseña
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-4 text-outline text-[20px] pointer-events-none">
                    lock
                  </span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-14 pl-12 pr-4 bg-surface-container-low rounded-2xl font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 focus:shadow-sm transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-14 mt-2 rounded-full bg-primary-container hover:bg-primary-container/90 active:scale-[0.99] text-on-primary-container font-headline-md text-title-md font-bold tracking-tight shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin w-5 h-5 text-on-primary-container" />
                    <span>Verificando Credenciales...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[20px]">login</span>
                    <span>Ingresar al Sistema</span>
                  </>
                )}
              </button>
            </form>

            {/* Selector de Cuentas Demo por Roles */}
            <div className="pt-4 border-t border-surface-container-high/50">
              <span className="font-label-caps text-[11px] font-bold text-outline uppercase tracking-wider block mb-2.5 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-primary" />
                Accesos rápidos de prueba por rol:
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickFill('admin@quantix.local', 'Admin123!')}
                  className="p-3 text-left rounded-2xl bg-tertiary-fixed/30 hover:bg-tertiary-fixed/60 border border-tertiary-fixed transition-all cursor-pointer group"
                >
                  <span className="font-label-caps text-[10px] font-bold text-on-tertiary-fixed uppercase tracking-wider block">
                    DIRECTOR
                  </span>
                  <span className="font-body-sm text-[11px] text-on-surface font-semibold group-hover:text-tertiary">
                    Dashboard & BI Total
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickFill('supervisor@quantix.local', 'Super123!')}
                  className="p-3 text-left rounded-2xl bg-secondary-fixed/30 hover:bg-secondary-fixed/60 border border-secondary-fixed transition-all cursor-pointer group"
                >
                  <span className="font-label-caps text-[10px] font-bold text-on-secondary-fixed uppercase tracking-wider block">
                    SUPERVISOR
                  </span>
                  <span className="font-body-sm text-[11px] text-on-surface font-semibold group-hover:text-secondary">
                    Arqueos & Auditoría
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickFill('bodeguero@quantix.local', 'Bodega123!')}
                  className="p-3 text-left rounded-2xl bg-surface-container hover:bg-surface-container-high border border-surface-container-high transition-all cursor-pointer group"
                >
                  <span className="font-label-caps text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">
                    BODEGUERO
                  </span>
                  <span className="font-body-sm text-[11px] text-on-surface font-semibold">
                    Inventario & FEFO
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickFill('cajero@quantix.local', 'Cajero123!')}
                  className="p-3 text-left rounded-2xl bg-primary-fixed/30 hover:bg-primary-fixed/60 border border-primary-fixed transition-all cursor-pointer group"
                >
                  <span className="font-label-caps text-[10px] font-bold text-on-primary-fixed uppercase tracking-wider block">
                    CAJERO
                  </span>
                  <span className="font-body-sm text-[11px] text-on-surface font-semibold group-hover:text-primary">
                    Punto de Venta POS
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Pie de Página */}
      <footer className="w-full bg-surface-container-lowest/60 border-t border-surface-container-high/30 py-3 select-none">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-on-surface-variant font-body-sm text-[11px]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-container" />
            <span>Quantix Retail OS v4.2 • PostgreSQL + DuckDB Gold</span>
          </div>
          <span className="font-label-caps uppercase text-outline">
            Terminal Node ID: QTX-TER-01 • © 2026 Quantix Enterprise
          </span>
        </div>
      </footer>
    </div>
  );
}
