import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Dog, CalendarDays, LogOut, Settings, Archive, FileText, ShoppingCart, Package, Boxes, AlertTriangle, Scissors, Key, RefreshCw, MessageCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useBranding } from '../../context/BrandingContext';
import { useLicense } from '../../context/LicenseContext';
import { api } from '../../services/api';
import { PdvFocusContext } from '../../App';
import BrandLogo from '../Branding/BrandLogo';

// ============================================================
// Overlay de Licença Bloqueada — autocontido com form de ativação
// ============================================================
function LicenseBlockOverlay() {
  const { licenseStatus, activate, isLoading } = useLicense();
  const [chave, setChave] = React.useState('');
  const [activating, setActivating] = React.useState(false);
  const [msg, setMsg] = React.useState(null);

  const handleActivate = async (e) => {
    e.preventDefault();
    if (!chave.trim()) return;
    setActivating(true);
    setMsg(null);
    const res = await activate(chave.trim().toUpperCase());
    setActivating(false);
    if (res.success) {
      setMsg({ type: 'success', text: 'Licença ativada com sucesso! O sistema será liberado.' });
    } else {
      setMsg({ type: 'error', text: res.message || 'Erro ao ativar. Verifique a chave.' });
    }
  };

  const isSuspended = licenseStatus === 'suspended';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99998,
      backgroundColor: 'rgba(0,0,0,0.88)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div className="card animate-fade" style={{
        width: '460px', textAlign: 'center', padding: '36px 32px',
        border: `1px solid ${isSuspended ? 'rgba(249,115,22,0.3)' : 'rgba(239,68,68,0.3)'}`
      }}>
        <AlertTriangle
          size={48}
          color={isSuspended ? '#F97316' : 'var(--danger)'}
          style={{ margin: '0 auto 16px' }}
        />
        <h2 style={{ marginBottom: '10px', color: isSuspended ? '#F97316' : 'var(--danger)', fontSize: '22px', fontWeight: '800' }}>
          {isSuspended ? 'Assinatura Suspensa' : 'Licença Bloqueada'}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '28px', lineHeight: '1.6' }}>
          {isSuspended
            ? 'Sua assinatura está suspensa por inadimplência. Regularize o pagamento para liberar o sistema.'
            : 'O período de uso expirou ou sua licença foi bloqueada. Insira uma nova chave de ativação ou entre em contato com o suporte.'}
        </p>

        {!isSuspended && (
          <form onSubmit={handleActivate} style={{ textAlign: 'left', marginBottom: '20px' }}>
            <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>
              <Key size={12} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              Chave de Ativação
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                className="input"
                value={chave}
                onChange={e => setChave(e.target.value.toUpperCase())}
                placeholder="PTWY-XXXX-XXXX-XXXX"
                style={{ flex: 1, fontFamily: 'monospace', textTransform: 'uppercase', fontSize: '15px', letterSpacing: '2px' }}
                disabled={activating}
              />
              <button
                className="btn"
                type="submit"
                disabled={activating || !chave.trim()}
                style={{ padding: '0 16px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {activating ? <RefreshCw size={16} className="animate-spin" /> : 'Ativar'}
              </button>
            </div>

            {msg && (
              <div style={{
                marginTop: '12px', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
                background: msg.type === 'success' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                border: `1px solid ${msg.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                color: msg.type === 'success' ? '#10B981' : '#EF4444'
              }}>
                {msg.text}
              </div>
            )}
          </form>
        )}

        <button
          className="btn"
          onClick={() => api.system.openExternal('https://wa.me/5567991413940?text=Ol%C3%A1!%20Preciso%20de%20suporte%20com%20minha%20licen%C3%A7a%20PetWay.')}
          style={{
            width: '100%', padding: '12px', fontSize: '14px', fontWeight: '700',
            background: isSuspended ? '#F97316' : 'rgba(37,211,102,0.15)',
            color: isSuspended ? '#fff' : '#25D366',
            border: isSuspended ? 'none' : '1px solid rgba(37,211,102,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
          }}
        >
          <MessageCircle size={18} />
          {isSuspended ? 'Regularizar via WhatsApp' : 'Falar com Suporte no WhatsApp'}
        </button>
      </div>
    </div>
  );
}


function Sidebar() {
  const { logout, user } = useAuth();
  const location = useLocation();
  const { branding } = useBranding();
  const isPrivileged = ['administrador', 'master'].includes(user?.tipo_usuario);

  const operacaoLinks = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/atendimento', label: 'Fila & Consultório', icon: FileText },
    { path: '/pdv', label: 'Ponto de Venda (PDV)', icon: ShoppingCart },
    { path: '/pendencias-fiscais', label: 'Pendências Fiscais', icon: AlertTriangle },
    { path: '/caixa', label: 'Tesouraria (Caixa)', icon: Archive },
    { path: '/estoque', label: 'Controle de Estoque', icon: Boxes }
  ];

  const cadastroLinks = [
    { path: '/agenda', label: 'Agenda', icon: CalendarDays },
    { path: '/clientes', label: 'Clientes', icon: Users },
    { path: '/pets', label: 'Pets', icon: Dog },
    { path: '/produtos', label: 'Produtos', icon: Package },
    { path: '/servicos', label: 'Serviços', icon: Scissors }
  ];

  return (
    <div style={{
      width: '260px',
      height: '100%',
      backgroundColor: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border-default)',
      display: 'flex',
      flexDirection: 'column',
      paddingTop: '60px' // for the frameless drag area
    }}>
      <div style={{ padding: '0 24px 32px 24px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <BrandLogo size="sm" logoPath={branding.logo_path} logoTs={branding.logoTs} />
          <span style={{ fontWeight: '800', fontSize: '22px', color: 'var(--primary)', letterSpacing: '-0.5px' }}>
            PetWay
          </span>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '500', opacity: 0.8, marginLeft: '2px' }}>
          Sistema completo para Pet Shop
        </div>
      </div>
      
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        
        <div className="sidebar-group-label" style={{ color: 'var(--text-secondary)' }}>Operação</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '0 12px' }}>
          {operacaoLinks.filter(l => isPrivileged || ['/pdv'].includes(l.path)).map(link => {
            const Icon = link.icon;
            const isActive = location.pathname === link.path;
            return <NavLink key={link.path} to={link.path} className={`nav-item ${isActive ? 'active' : ''}`}><Icon size={18} />{link.label}</NavLink>;
          })}
        </div>

        <div className="sidebar-group-label" style={{ marginTop: '24px', color: 'var(--text-secondary)' }}>Cadastros</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '0 12px' }}>
          {cadastroLinks.filter(l => isPrivileged || ['/agenda', '/clientes', '/pets'].includes(l.path)).map(link => {
            const Icon = link.icon;
            const isActive = location.pathname === link.path;
            return <NavLink key={link.path} to={link.path} className={`nav-item ${isActive ? 'active' : ''}`}><Icon size={18} />{link.label}</NavLink>;
          })}
        </div>

      </nav>

      <div style={{ padding: '16px', borderTop: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div className="sidebar-group-label" style={{ margin: '0 0 8px 0', color: 'var(--text-secondary)' }}>Sistema</div>
        {isPrivileged && (
          <>
            <NavLink to="/usuarios" className={`nav-item ${location.pathname === '/usuarios' ? 'active' : ''}`}><Users size={18} /> Usuários</NavLink>
            <NavLink to="/configuracoes" className={`nav-item ${location.pathname === '/configuracoes' ? 'active' : ''}`}><Settings size={18} /> Configurações</NavLink>
          </>
        )}
        <button className="nav-item" onClick={logout} style={{ width: '100%', border: 'none', background: 'transparent', color: 'var(--danger)', textAlign: 'left', cursor: 'pointer' }}><LogOut size={18} /> Sair</button>
      </div>
    </div>
  );
}

function Topbar() {
  const { user } = useAuth();
  const location = useLocation();
  const roleLabel = user?.tipo_usuario === 'master'
    ? 'Master'
    : user?.tipo_usuario === 'administrador'
      ? 'Administrador'
      : 'Funcionário';

  const getPageTitle = (path) => {
    switch (path) {
      case '/': return 'Dashboard de Negócios';
      case '/atendimento': return 'Fila de Atendimento e Clínica';
      case '/pdv': return 'Caixa Livre (Ponto de Venda)';
      case '/pendencias-fiscais': return 'Resolução de Pendências Fiscais';
      case '/caixa': return 'Extrato e Tesouraria';
      case '/estoque': return 'Gestão de Estoque';
      case '/clientes': return 'Gestão de Clientes';
      case '/pets': return 'Prontuários e Pets';
      case '/produtos': return 'Catálogo de Produtos';
      case '/servicos': return 'Catálogo de Serviços';
      case '/agenda': return 'Agenda Central';
      case '/configuracoes': return 'Painel de Configurações Globais';
      default: return 'Sistema';
    }
  };

  return (
    <div style={{ height: '56px', borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', backgroundColor: 'var(--bg-primary)' }}>
      <div style={{ fontWeight: '600', fontSize: '18px', color: 'var(--text-primary)' }}>
        {getPageTitle(location.pathname)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>{user?.nome}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{roleLabel}</div>
        </div>
        <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'rgba(var(--primary-rgb), 0.2)', border: '1px solid var(--primary)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
          {user?.nome?.charAt(0).toUpperCase()}
        </div>
      </div>
    </div>
  );
}

export default function Layout({ children }) {
  const { user, setUser } = useAuth();
  const { isPdvFocused } = React.useContext(PdvFocusContext);
  const { license, isValid, isLoading, calcularDiasRestantes, licenseStatus } = useLicense();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [errorPx, setErrorPx] = React.useState('');

  const mustChangePassword = user?.senha_padrao_alterada === 0;
  const isMaster = user?.tipo_usuario === 'master';

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setErrorPx('');
    if (newPassword !== confirmPassword) {
      return setErrorPx('As senhas não coincidem.');
    }
    if (newPassword.length < 5) {
      return setErrorPx('A nova senha deve ter no mínimo 5 caracteres.');
    }
    
    const res = await api.auth.changePassword({ login: user.login, currentPassword, newPassword });
    if (res.success) {
      setUser({ ...user, senha_padrao_alterada: 1 });
    } else {
      setErrorPx(res.message);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: 'var(--bg-primary)' }}>
      {mustChangePassword && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card animate-fade" style={{ width: '400px' }}>
            <h2 style={{ marginBottom: '8px', color: 'var(--warning)', fontSize: '20px' }}>Ação Obrigatória</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
              Por motivos de segurança, você deve alterar a senha padrão antes de continuar.
            </p>
            {errorPx && (
              <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(255, 82, 82, 0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', fontSize: '13px', marginBottom: '16px' }}>
                {errorPx}
              </div>
            )}
            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="input-group">
                <label>Senha Atual (padrão)</label>
                <input type="password" required className="input" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
              </div>
              <div className="input-group">
                <label>Nova Senha</label>
                <input type="password" required className="input" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
              </div>
              <div className="input-group">
                <label>Confirmar Nova Senha</label>
                <input type="password" required className="input" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
              </div>
              <button className="btn" type="submit" style={{ marginTop: '8px', padding: '12px' }}>
                Confirmar Alteração
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Expired License Global Overlay */}
      {!isLoading && !isValid && user?.tipo_usuario !== 'master' && (
        <LicenseBlockOverlay />
      )}

      {/* Top draggable area for frameless window */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '40px', WebkitAppRegion: 'drag', zIndex: 999 }}></div>
      
      {!mustChangePassword && !isPdvFocused && <Sidebar />}
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingTop: isPdvFocused ? '0px' : '40px', filter: mustChangePassword ? 'blur(4px)' : 'none', pointerEvents: mustChangePassword ? 'none' : 'auto' }}>
        {!isPdvFocused && <Topbar />}

        {/* License warning banner */}
        {!isPdvFocused && !isLoading && isValid && license?.expiresAt && calcularDiasRestantes(license.expiresAt) <= 7 && (
          <div style={{
            padding: '10px 24px',
            background: 'rgba(245, 158, 11, 0.12)',
            borderBottom: '1px solid rgba(245, 158, 11, 0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontSize: '13px', fontWeight: '600',
            color: '#F59E0B'
          }}>
            <span>
              {`⚠️ Sua licença expira em ${calcularDiasRestantes(license.expiresAt)} dia(s). Renove para evitar bloqueio.`}
            </span>
            <span onClick={() => navigate('/configuracoes', { state: { activeTab: 'licenca' } })} style={{ color: 'inherit', textDecoration: 'underline', cursor: 'pointer', fontSize: '12px' }}>Ativar licença →</span>
          </div>
        )}
        <main style={{ 
          flex: 1, 
          overflowY: location.pathname === '/pdv' ? 'hidden' : 'auto', 
          padding: isPdvFocused ? '0px' : location.pathname === '/pdv' ? '20px' : '32px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div className="animate-fade" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
