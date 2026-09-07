import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import POS from './pages/POS';
import Dashboard from './pages/Dashboard';
import Tactico from './pages/Tactico';
import Inventario from './pages/Inventario';
import Configuracion from './pages/Configuracion';
import Login from './pages/Login';
import { useAuthStore } from './store/authStore';

// Componente para proteger rutas que requieren autenticación
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
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
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Rutas protegidas dentro del Layout */}
        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<RoleRedirect />} />
          <Route path="pos" element={<POS />} />
          <Route path="tactico" element={<Tactico />} />
          <Route path="inventario" element={<Inventario />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="configuracion" element={<Configuracion />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
