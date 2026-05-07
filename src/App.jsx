import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BrandingProvider } from './context/BrandingContext';
import { LicenseProvider } from './context/LicenseContext';
import { ToastProvider } from './context/ToastContext';
import Layout from './components/Layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clientes from './pages/Clientes';
import Pets from './pages/Pets';
import Agenda from './pages/Agenda';
import Caixa from './pages/Caixa';
import Atendimento from './pages/Atendimento';
import PDV from './pages/PDV';
import Produtos from './pages/Produtos';
import Servicos from './pages/Servicos';
import Estoque from './pages/Estoque';
import PendenciasFiscais from './pages/PendenciasFiscais';
import Configuracoes from './pages/Configuracoes';
import Usuarios from './pages/Usuarios';
import { applyTheme } from './pages/config/ConfigAparencia';
import { api } from './services/api';
import './index.css';

export const PdvFocusContext = React.createContext();

const RoleRoute = ({ children, allowedRoles }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  
  if (allowedRoles && !allowedRoles.includes(user.tipo_usuario)) {
    return <Navigate to="/pdv" replace />;
  }
  return <>{children}</>;
};

const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
};

export default function App() {
  const [isPdvFocused, setIsPdvFocused] = React.useState(false);

  React.useEffect(() => {
    // Aplicar tema salvo o mais cedo possível para evitar "piscar" (FOUC)
    api.config.aparencia.get().then(cfg => {
      if (cfg && cfg.id) applyTheme(cfg);
    }).catch(() => { /* silencioso no primeiro startup */ });
  }, []);

  return (
    <AuthProvider>
      <BrandingProvider>
      <LicenseProvider>
      <ToastProvider>
      <PdvFocusContext.Provider value={{ isPdvFocused, setIsPdvFocused }}>
        <HashRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route path="/" element={<ProtectedRoute><RoleRoute allowedRoles={['administrador']}><Dashboard /></RoleRoute></ProtectedRoute>} />
            <Route path="/clientes" element={<ProtectedRoute><Clientes /></ProtectedRoute>} />
            <Route path="/pets" element={<ProtectedRoute><Pets /></ProtectedRoute>} />
            <Route path="/agenda" element={<ProtectedRoute><Agenda /></ProtectedRoute>} />
            
            <Route path="/pdv" element={<ProtectedRoute><PDV /></ProtectedRoute>} />
            
            {/* ROTAS ADMINISTRATIVAS */}
            <Route path="/produtos" element={<ProtectedRoute><RoleRoute allowedRoles={['administrador']}><Produtos /></RoleRoute></ProtectedRoute>} />
            <Route path="/servicos" element={<ProtectedRoute><RoleRoute allowedRoles={['administrador']}><Servicos /></RoleRoute></ProtectedRoute>} />
            <Route path="/caixa" element={<ProtectedRoute><RoleRoute allowedRoles={['administrador']}><Caixa /></RoleRoute></ProtectedRoute>} />
            <Route path="/atendimento" element={<ProtectedRoute><RoleRoute allowedRoles={['administrador']}><Atendimento /></RoleRoute></ProtectedRoute>} />
            <Route path="/pendencias-fiscais" element={<ProtectedRoute><RoleRoute allowedRoles={['administrador']}><PendenciasFiscais /></RoleRoute></ProtectedRoute>} />
            <Route path="/estoque" element={<ProtectedRoute><RoleRoute allowedRoles={['administrador']}><Estoque /></RoleRoute></ProtectedRoute>} />
            <Route path="/configuracoes" element={<ProtectedRoute><RoleRoute allowedRoles={['administrador']}><Configuracoes /></RoleRoute></ProtectedRoute>} />
            <Route path="/usuarios" element={<ProtectedRoute><RoleRoute allowedRoles={['administrador']}><Usuarios /></RoleRoute></ProtectedRoute>} />
          </Routes>
        </HashRouter>
      </PdvFocusContext.Provider>
      </ToastProvider>
      </LicenseProvider>
      </BrandingProvider>
    </AuthProvider>
  );
}
