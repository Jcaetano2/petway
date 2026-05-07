import React, { useState } from 'react';
import { api } from '../../services/api';
import { 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  Key, 
  Clock, 
  AlertTriangle, 
  RefreshCw, 
  Cpu, 
  WifiOff, 
  Zap, 
  Infinity as InfinityIcon, 
  Check, 
  ExternalLink,
  Lock
} from 'lucide-react';
import { useLicense } from '../../context/LicenseContext';

export default function ConfigLicenca() {
  const { 
    license, 
    isValid, 
    isTrial, 
    isOffline, 
    isLoading, 
    licenseType, 
    planType,
    supportUntil,
    errorMessage, 
    activate, 
    revalidate,
    calcularDiasRestantes,
    hwid 
  } = useLicense();

  const [chave, setChave] = useState('');
  const [activating, setActivating] = useState(false);
  const [localMessage, setLocalMessage] = useState(null);

  const handleActivate = async (e) => {
    e.preventDefault();
    if (!chave.trim()) return;
    setActivating(true);
    setLocalMessage(null);
    
    const res = await activate(chave.trim());
    setActivating(false);
    
    if (res.success) {
      setLocalMessage({ type: 'success', text: `Licença ativada com sucesso!` });
      setChave('');
    } else {
      setLocalMessage({ type: 'error', text: res.message || 'Erro ao ativar licença.' });
    }
  };

  const formatDate = (d) => {
    if (!d) return '-';
    try {
      const date = new Date(d);
      return date.toLocaleDateString('pt-BR');
    } catch { return d; }
  };

  const diasRestantes = calcularDiasRestantes(license?.expiresAt);
  const progressPercent = isTrial
    ? Math.max(0, Math.min(100, (diasRestantes / 30) * 100))
    : Math.max(0, Math.min(100, (diasRestantes / 365) * 100));

  const statusColor = !isValid ? '#EF4444' : (isTrial || diasRestantes <= 7) ? '#F59E0B' : '#10B981';
  const statusLabel = !isValid ? 'Inválida/Expirada' : isTrial ? 'Trial' : 'Ativa';
  const StatusIcon = !isValid ? ShieldAlert : ShieldCheck;

  // Plan Meta
  const isLifetime = planType === 'lifetime';
  const planLabel = isLifetime ? 'Licença Vitalícia' : 'Assinatura Mensal';
  const planColor = isLifetime ? '#8B5CF6' : '#3B82F6';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '900px' }}>
      
      {/* 1. Status Section */}
      <div className="card" style={{ borderLeft: `4px solid ${statusColor}`, position: 'relative', overflow: 'hidden' }}>
        {/* Subtle background plan indicator */}
        <div style={{ 
          position: 'absolute', top: '-10px', right: '-10px', opacity: 0.05,
          transform: 'rotate(15deg)'
        }}>
          {isLifetime ? <InfinityIcon size={120} /> : <Zap size={120} />}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '20px', position: 'relative', zIndex: 1 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '16px',
            background: `${statusColor}15`,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <StatusIcon size={32} color={statusColor} />
          </div>
          
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ 
                fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', 
                padding: '2px 8px', borderRadius: '4px', background: `${planColor}20`, color: planColor 
              }}>
                {planLabel}
              </span>
              {isOffline && (
                <span style={{ 
                  fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', 
                  padding: '2px 8px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B',
                  display: 'flex', alignItems: 'center', gap: '4px'
                }}>
                  <WifiOff size={10} /> Offline
                </span>
              )}
            </div>
            
            <div style={{ fontSize: '22px', fontWeight: '800', color: '#E1E1E6', marginTop: '4px' }}>
              Status: <span style={{ color: statusColor }}>{statusLabel}</span>
            </div>
            
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {isLifetime 
                ? `Suporte e Atualizações: ${supportUntil ? `Ativo até ${formatDate(supportUntil)}` : 'Vencido'}`
                : `Assinatura: ${license?.expiresAt ? `Próxima cobrança em ${formatDate(license.expiresAt)}` : 'Ativa'}`
              }
            </div>
          </div>

          {!isLifetime && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '32px', fontWeight: '900', color: statusColor, lineHeight: 1 }}>
                {diasRestantes}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '700' }}>dias restantes</div>
            </div>
          )}
        </div>

        {/* Progress bar (only for trial/monthly) */}
        {!isLifetime && (
          <>
            <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '6px', height: '10px', overflow: 'hidden' }}>
              <div style={{
                width: `${progressPercent}%`,
                height: '100%',
                borderRadius: '6px',
                background: `linear-gradient(90deg, ${statusColor}, ${statusColor}88)`,
                transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <span>{isTrial ? 'Período de Avaliação' : 'Ciclo de Faturamento'}</span>
              <span>{license?.expiresAt ? `Expira em: ${formatDate(license.expiresAt)}` : '-'}</span>
            </div>
          </>
        )}
      </div>

      {/* 2. Commercial / Conversion Section (Visible for non-lifetime) */}
      {!isLifetime && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Plan Mensal */}
          <div className="card" style={{ 
            display: 'flex', flexDirection: 'column', border: '2px solid rgba(59, 130, 246, 0.2)',
            transition: 'transform 0.2s', cursor: 'default'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px' }}>
              <div>
                <h4 style={{ fontSize: '16px', fontWeight: '700', color: '#3B82F6' }}>Plano Mensal</h4>
                <div style={{ fontSize: '24px', fontWeight: '900', marginTop: '4px' }}>R$ 180<span style={{ fontSize: '14px', fontWeight: '500', opacity: 0.6 }}>/mês</span></div>
              </div>
              <div style={{ padding: '8px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)' }}>
                <Zap size={24} color="#3B82F6" />
              </div>
            </div>
            
            <ul style={{ listStyle: 'none', padding: 0, fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, marginBottom: '20px' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={14} color="#10B981" /> Acesso total ao sistema</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={14} color="#10B981" /> Suporte técnico prioritize</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={14} color="#10B981" /> Atualizações ilimitadas</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={14} color="#10B981" /> Backup em nuvem incluso</li>
            </ul>
            
            <button className="btn" onClick={() => api.system.openExternal('https://wa.me/5567991413940?text=Olá!%20Gostaria%20de%20adquirir%20um%20plano%20do%20PetWay.')} style={{ width: '100%', background: '#3B82F6' }}>Assinar Agora</button>
          </div>

          {/* Plan Definitivo */}
          <div className="card" style={{ 
            display: 'flex', flexDirection: 'column', border: '2px solid rgba(139, 92, 246, 0.3)',
            background: 'linear-gradient(145deg, var(--card-bg), rgba(139, 92, 246, 0.05))'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px' }}>
              <div>
                <h4 style={{ fontSize: '16px', fontWeight: '700', color: '#8B5CF6' }}>Compra Definitiva</h4>
                <div style={{ fontSize: '24px', fontWeight: '900', marginTop: '4px' }}>R$ 5.000<span style={{ fontSize: '14px', fontWeight: '500', opacity: 0.6 }}> único</span></div>
              </div>
              <div style={{ padding: '8px', borderRadius: '12px', background: 'rgba(139, 92, 246, 0.1)' }}>
                <InfinityIcon size={24} color="#8B5CF6" />
              </div>
            </div>
            
            <ul style={{ listStyle: 'none', padding: 0, fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, marginBottom: '20px' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={14} color="#10B981" /> Licença vitalícia da versão</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={14} color="#10B981" /> Sem mensalidades</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.7 }}><Clock size={14} /> Suporte por 12 meses</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.7 }}><Lock size={14} /> Atualizações pontuais</li>
            </ul>
            
            <button className="btn" onClick={() => api.system.openExternal('https://wa.me/5567991413940?text=Olá.%20Gostaria%20de%20adquirir%20uma%20licença%20permanente%20do%20PetWay.')} style={{ width: '100%', background: '#8B5CF6' }}>Comprar Licença</button>
          </div>
        </div>
      )}

      {/* 3. Activation Form */}
      <div className="card">
        <h3 style={{ fontSize: '16px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px', color: '#E1E1E6' }}>
          <Key size={18} /> Ativar Licença PetWay
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
          Se já possui uma chave de ativação, cole-a abaixo para desbloquear o sistema.
        </p>

        {(localMessage || errorMessage) && (
          <div style={{
            padding: '12px 16px', borderRadius: '8px', marginBottom: '16px',
            background: (localMessage?.type === 'success') ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
            border: `1px solid ${(localMessage?.type === 'success') ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            color: (localMessage?.type === 'success') ? '#10B981' : '#EF4444',
            fontSize: '13px', fontWeight: '600'
          }}>
            {localMessage?.text || errorMessage}
          </div>
        )}

        <form onSubmit={handleActivate} style={{ display: 'flex', gap: '12px' }}>
          <input
            className="input"
            value={chave}
            onChange={e => setChave(e.target.value.toUpperCase())}
            placeholder="PTWY-XXXX-XXXX-XXXX"
            style={{ flex: 1, fontFamily: 'monospace', textTransform: 'uppercase', fontSize: '16px', letterSpacing: '2px' }}
          />
          <button className="btn" disabled={activating || isLoading || !chave.trim()} style={{ padding: '12px 28px', fontSize: '14px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {activating ? <RefreshCw size={18} className="animate-spin" /> : 'Ativar Sistema'}
          </button>
        </form>
      </div>

      {/* 4. Footer Info / Tools */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <button 
          className="btn-outline" 
          onClick={revalidate} 
          disabled={isLoading || isTrial}
          style={{ padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          Sincronizar com Servidor
        </button>
        
        <div style={{ 
          padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', 
          border: '1px solid var(--border-color)', fontSize: '11px', color: 'var(--text-secondary)',
          display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          <Cpu size={14} /> 
          <div>
            <strong>HWID:</strong> <span style={{ fontFamily: 'monospace', opacity: 0.6 }}>{hwid || 'Gerando...'}</span>
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: '20px' }}>
        <a 
          href="https://petway.com.br/ajuda" 
          target="_blank" 
          rel="noopener noreferrer" 
          style={{ color: 'var(--primary)', fontSize: '13px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          Dúvidas sobre o licenciamento? Acesse nossa central de ajuda <ExternalLink size={14} />
        </a>
      </div>
    </div>
  );
}
