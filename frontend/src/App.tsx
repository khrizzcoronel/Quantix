import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import { useAuthStore } from './store/authStore';

const POS = lazy(() => import('./pages/POS'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Tactico = lazy(() => import('./pages/Tactico'));
const Inventario = lazy(() => import('./pages/Inventario'));
const Configuracion = lazy(() => import('./pages/Configuracion'));
const Clientes = lazy(() => import('./pages/Clientes'));
const Operaciones = lazy(() => import('./pages/Operaciones'));
const Usuarios = lazy(() => import('./pages/Usuarios'));
const Analisis = lazy(() => import('./pages/Analisis'));
const Login = lazy(() => import('./pages/Login'));

// Componente para proteger rutas que requieren autenticación
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const RoleRoute = ({ children, roles }: { children: React.ReactNode; roles: string[] }) => {
  const user = useAuthStore((state) => state.user);
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.rol)) return <Navigate to="/" replace />;
  return <>{children}</>;
};

// Componente para redirigir la raíz ('/') según el rol del usuario
const RoleRedirect = () => {
  const user = useAuthStore((state) => state.user);
  if (!user) return <Navigate to="/login" replace />;

  switch (user.rol) {
    case 'DIRECTOR':
      return <Navigate to="/dashboard" replace />;
    case 'SUPERVISOR':
      return <Navigate to="/tactico" replace />;
    case 'BODEGUERO':
      return <Navigate to="/inventario" replace />;
    case 'CAJERO':
    default:
      return <Navigate to="/pos" replace />;
  }
};

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="min-h-screen grid place-items-center text-slate-500">Cargando módulo…</div>}>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Rutas protegidas dentro del Layout */}
        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<RoleRedirect />} />
          <Route path="pos" element={<RoleRoute roles={['DIRECTOR', 'SUPERVISOR', 'CAJERO']}><POS /></RoleRoute>} />
          <Route path="tactico" element={<RoleRoute roles={['DIRECTOR', 'SUPERVISOR']}><Tactico /></RoleRoute>} />
          <Route path="inventario" element={<RoleRoute roles={['DIRECTOR', 'SUPERVISOR', 'BODEGUERO']}><Inventario /></RoleRoute>} />
          <Route path="clientes" element={<RoleRoute roles={['DIRECTOR', 'SUPERVISOR', 'CAJERO']}><Clientes /></RoleRoute>} />
          <Route path="dashboard" element={<RoleRoute roles={['DIRECTOR']}><Dashboard /></RoleRoute>} />
          <Route path="analisis" element={<RoleRoute roles={['DIRECTOR', 'SUPERVISOR']}><Analisis /></RoleRoute>} />
          <Route path="operaciones" element={<RoleRoute roles={['DIRECTOR']}><Operaciones /></RoleRoute>} />
          <Route path="usuarios" element={<RoleRoute roles={['DIRECTOR', 'SUPERVISOR']}><Usuarios /></RoleRoute>} />
          <Route path="configuracion" element={<RoleRoute roles={['DIRECTOR']}><Configuracion /></RoleRoute>} />
        </Route>
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
