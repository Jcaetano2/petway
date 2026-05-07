import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, KeyRound } from 'lucide-react';
import BrandLogo from '../components/Branding/BrandLogo';
import { useBranding } from '../context/BrandingContext';
import { api } from '../services/api';

export default function Login() {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { branding } = useBranding();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await login(loginId, password);
      if (res.success) {
        if (res.user.tipo_usuario === 'operador') {
          navigate('/pdv');
        } else {
          navigate('/');
        }
      } else {
        setError(res.message || 'Erro ao fazer login. Verifique suas credenciais.');
      }
    } catch (err) {
      setError('Erro de sistema. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: 'var(--bg-primary)', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '40px', WebkitAppRegion: 'drag' }}></div>
      <div className="card animate-fade" style={{ width: '400px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ marginBottom: '24px' }}>
            <BrandLogo size="lg" logoPath={branding.logo_path} logoTs={branding.logoTs} />
          </div>
          <h1 style={{ fontSize: '32px', fontWeight: '800', color: 'var(--primary)', letterSpacing: '-1px', margin: 0 }}>
            PetWay
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '6px', fontSize: '15px', fontWeight: '500' }}>
            Sistema completo para Pet Shop
          </p>
        </div>

        {error && (
          <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(255, 82, 82, 0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', fontSize: '14px', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="input-group">
            <label>Usuário</label>
            <input 
              type="text" 
              className="input" 
              placeholder="admin" 
              value={loginId} 
              onChange={(e) => setLoginId(e.target.value)} 
              required 
            />
          </div>
          <div className="input-group">
            <label>Senha</label>
            <input 
              type="password" 
              className="input" 
              placeholder="••••••••" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />
          </div>
          
          <button type="submit" className="btn" style={{ width: '100%', marginTop: '8px', padding: '14px' }} disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar na Conta'}
          </button>
        </form>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginTop: '8px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Status da Licença:</span>
          <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '12px', backgroundColor: 'rgba(0, 230, 118, 0.1)', color: 'var(--success)', fontWeight: '600' }}>ATIVO</span>
        </div>
      </div>
    </div>
  );
}
