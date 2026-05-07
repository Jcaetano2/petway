import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Save, CheckCircle, Scale, Database, ShieldCheck } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function ConfigIntegracoes() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const { showToast } = useToast();
  
  const [integracoes, setIntegracoes] = useState({
    api_provider: 'gatewayx',
    api_url: '',
    api_token: '',
    api_ambiente: 'homologacao',
    api_timeout: 30,
    usar_gaveta: 0,
    modo_gaveta: 'impressora',
    balanca_ativa: 0,
    porta_balanca: 'COM1',
    protocolo_balanca: 'simulado',
    baud_rate: 9600
  });

  useEffect(() => {
    async function load() {
      const data = await api.config.integracoes.get();
      if (data) setIntegracoes(prev => ({ ...prev, ...data }));
      setLoading(false);
    }
    load();
  }, []);

  const handleChange = (field, value) => {
    setIntegracoes(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    const res = await api.config.integracoes.save(integracoes);
    if (res.success) {
      setMsg('Salvo');
      showToast('Configurações de integração salvas!', 'success');
    } else {
      showToast('Erro ao salvar integrações.', 'error');
    }
    setSaving(false);
  };

  const testarGaveta = async () => {
    const res = await api.hardware.abrirGaveta();
    if(res.success) showToast('Comando enviado à gaveta!', 'success');
    else showToast('Erro ao abrir: ' + res.message, 'error');
  };

  const testarBalanca = async () => {
    const res = await api.balanca.lerPeso();
    if (res.success) showToast(`Peso lido: ${Number(res.peso || 0).toFixed(3)} kg`, 'success');
    else showToast('Erro ao ler balanca: ' + (res.message || 'falha desconhecida'), 'error');
  };

  if (loading) return <div style={{ padding: '24px' }}>Carregando...</div>;

  return (
    <div className="card animate-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2>API / Hub de Integrações Externas</h2>
        {msg && <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}><CheckCircle size={18} /> {msg}</span>}
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* 1. SEFAZ / NFCe API */}
        <div style={{ padding: '16px', border: '1px solid var(--border-default)', borderRadius: '8px' }}>
          <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><ShieldCheck size={20} color="var(--primary)"/> Fiscal / Web API</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)', gap: '16px' }}>
            <div className="input-group">
              <label>Sistema Fiscal Nativo</label>
              <select className="input" value={integracoes.api_provider || 'focus'} onChange={e => handleChange('api_provider', e.target.value)}>
                <option value="focus">Focus NFe</option>
                <option value="gatewayx">Gateway-X / ACBr Local</option>
              </select>
            </div>
            <div className="input-group" style={{ gridColumn: 'span 2' }}>
              <label>Endpoint / Base URL</label>
              <input type="text" className="input" placeholder="http://localhost:8000/api/fiscal" value={integracoes.api_url} onChange={e => handleChange('api_url', e.target.value)} />
            </div>

            <div className="input-group">
              <label>Ambiente Alvo</label>
              <select className="input" value={integracoes.api_ambiente} onChange={e => handleChange('api_ambiente', e.target.value)}>
                <option value="homologacao">Homologação (Testes)</option>
                <option value="producao">Produção (Real)</option>
              </select>
            </div>
            <div className="input-group" style={{ gridColumn: 'span 2' }}>
              <label>Token da API Fiscal</label>
              <input type="password" className="input" value={integracoes.api_token || ''} onChange={e => handleChange('api_token', e.target.value)} placeholder={integracoes.api_provider === 'gatewayx' ? 'Opcional para Gateway-X' : 'Token da Focus NFe'} />
            </div>
          </div>
        </div>

        {/* 2. GAVETA DE DINHEIRO */}
        <div style={{ padding: '16px', border: '1px solid var(--border-default)', borderRadius: '8px' }}>
          <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Database size={20} color="var(--primary)"/> Gaveta de Dinheiro Físico</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '16px', alignItems: 'flex-start' }}>
            
            <div style={{ padding: '8px 0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                <input type="checkbox" checked={integracoes.usar_gaveta === 1} onChange={e => handleChange('usar_gaveta', e.target.checked ? 1 : 0)} style={{ transform: 'scale(1.2)' }} />
                Ativar Ejetor Automático
              </label>
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px', paddingLeft: '22px' }}>Dispara abertura via driver na finalização do dinheiro em espécie.</div>
            </div>

            <div className="input-group">
              <label>Modo de Conexão Rj11</label>
              <select className="input" value={integracoes.modo_gaveta} onChange={e => handleChange('modo_gaveta', e.target.value)} disabled={integracoes.usar_gaveta === 0}>
                <option value="impressora">Via Spooler Impressora (Padrão)</option>
                <option value="serial" disabled>Direta (Porta Serial) - nao implementado</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: '16px' }}>
            <button type="button" onClick={testarGaveta} className="btn-outline" disabled={integracoes.usar_gaveta === 0}>Testar Abertura da Gaveta</button>
          </div>
        </div>

        {/* 3. BALANÇA (PESO) */}
        <div style={{ padding: '16px', border: '1px solid var(--border-default)', borderRadius: '8px' }}>
          <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Scale size={20} color="var(--primary)"/> Integração Balança Comercial</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', alignItems: 'flex-start' }}>
            
            <div style={{ padding: '8px 0', gridColumn: 'span 3' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                <input type="checkbox" checked={integracoes.balanca_ativa === 1} onChange={e => handleChange('balanca_ativa', e.target.checked ? 1 : 0)} style={{ transform: 'scale(1.2)' }} />
                Ativar Leitura Serial (RS-232/USB)
              </label>
            </div>

            <div className="input-group">
              <label>Porta (COM/TTY)</label>
              <input type="text" className="input" value={integracoes.porta_balanca} onChange={e => handleChange('porta_balanca', e.target.value)} disabled={integracoes.balanca_ativa === 0} placeholder="Ex: COM3" />
            </div>

            <div className="input-group">
              <label>Protocolo Base</label>
              <select className="input" value={integracoes.protocolo_balanca} onChange={e => handleChange('protocolo_balanca', e.target.value)} disabled={integracoes.balanca_ativa === 0}>
                <option value="simulado">Modo Simulado (Teste 2Kg)</option>
                <option value="toledo" disabled>Toledo (P01) - nao implementado</option>
                <option value="filizola" disabled>Filizola - nao implementado</option>
              </select>
            </div>

            <div className="input-group">
              <label>Baud Rate</label>
              <select className="input" value={integracoes.baud_rate} onChange={e => handleChange('baud_rate', parseInt(e.target.value))} disabled={integracoes.balanca_ativa === 0}>
                <option value={4800}>4800</option>
                <option value={9600}>9600</option>
                <option value={19200}>19200</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: '16px' }}>
            <button type="button" onClick={testarBalanca} className="btn-outline" disabled={integracoes.balanca_ativa === 0}>Testar Obtenção de Peso</button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
          <button type="submit" className="btn" disabled={saving}>
            <Save size={18} /> {saving ? 'Salvando...' : 'Aplicar Modificações Gerais'}
          </button>
        </div>

      </form>
    </div>
  );
}
