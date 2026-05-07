import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Save, Printer, Scale } from 'lucide-react';

export default function ConfigHardware() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const [hwConfig, setHwConfig] = useState({
    usar_gaveta: 0,
    modo_gaveta: 'impressora',
    nome_impressora: ''
  });

  const [balancaConfig, setBalancaConfig] = useState({
    ativa: 0,
    porta: '',
    baud_rate: 9600,
    protocolo: 'simulado'
  });

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    setLoading(true);
    const hw = await api.hardware.getConfig();
    if (hw) setHwConfig(hw);
    
    const bl = await api.balanca.getConfig();
    if (bl) setBalancaConfig(bl);
    
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      await api.hardware.saveConfig(hwConfig);
      await api.balanca.saveConfig(balancaConfig);
      setFeedback({ type: 'success', message: 'Configurações de hardware salvas com sucesso!' });
    } catch (err) {
      setFeedback({ type: 'error', message: 'Erro ao salvar configurações.' });
    } finally {
      setSaving(false);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  if (loading) return <div style={{color:'var(--text-secondary)'}}>Carregando configurações de hardware...</div>;

  return (
    <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* GAVETA DE CAIXA */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Printer size={20} color="var(--primary)" />
          <h3 style={{ fontSize: '16px', margin: 0 }}>Gaveta de Caixa</h3>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label>Ativar Abertura de Gaveta?</label>
            <select 
              className="input-base"
              value={hwConfig.usar_gaveta}
              onChange={e => setHwConfig({...hwConfig, usar_gaveta: Number(e.target.value)})}
            >
              <option value={1}>Sim, abrir na finalização</option>
              <option value={0}>Não, desativado</option>
            </select>
          </div>

          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label>Modo de Abertura</label>
            <select 
              className="input-base"
              value={hwConfig.modo_gaveta}
              onChange={e => setHwConfig({...hwConfig, modo_gaveta: e.target.value})}
              disabled={hwConfig.usar_gaveta === 0}
            >
              <option value="impressora">Via Impressora (Spooler)</option>
              <option value="usb" disabled>USB Direto (Em Breve)</option>
            </select>
          </div>

          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label>Nome Impressora (Opcional)</label>
            <input 
              type="text" 
              className="input-base"
              placeholder="Ex: EPSON TM-T20"
              value={hwConfig.nome_impressora || ''}
              onChange={e => setHwConfig({...hwConfig, nome_impressora: e.target.value})}
              disabled={hwConfig.usar_gaveta === 0 || hwConfig.modo_gaveta !== 'impressora'}
            />
          </div>
        </div>
      </div>

      <hr style={{ borderColor: 'rgba(255,255,255,0.1)', borderStyle: 'solid' }} />

      {/* BALANÇA */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Scale size={20} color="var(--tertiary)" />
          <h3 style={{ fontSize: '16px', margin: 0 }}>Balança (Integração Serial)</h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label>Ativar Balança?</label>
             <select 
              className="input-base"
              value={balancaConfig.ativa}
              onChange={e => setBalancaConfig({...balancaConfig, ativa: Number(e.target.value)})}
            >
              <option value={1}>Sim, habilitar leitura</option>
              <option value={0}>Não, desativada</option>
            </select>
          </div>

          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label>Protocolo/Marca</label>
            <select 
              className="input-base"
              value={balancaConfig.protocolo}
              onChange={e => setBalancaConfig({...balancaConfig, protocolo: e.target.value})}
              disabled={balancaConfig.ativa === 0}
            >
              <option value="simulado">Simulador (Mock Mode)</option>
              <option value="toledo">Toledo (Prix)</option>
              <option value="filizola">Filizola</option>
            </select>
          </div>

          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label>Porta (COMx)</label>
            <input 
              type="text" 
              className="input-base"
              placeholder="Ex: COM1"
              value={balancaConfig.porta || ''}
              onChange={e => setBalancaConfig({...balancaConfig, porta: e.target.value})}
              disabled={balancaConfig.ativa === 0}
            />
          </div>

          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label>Baud Rate</label>
            <select 
              className="input-base"
              value={balancaConfig.baud_rate}
              onChange={e => setBalancaConfig({...balancaConfig, baud_rate: Number(e.target.value)})}
              disabled={balancaConfig.ativa === 0}
            >
              <option value={2400}>2400</option>
              <option value={4800}>4800</option>
              <option value={9600}>9600</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
        <div style={{ color: feedback?.type === 'success' ? '#4CAF50' : '#F44336' }}>
          {feedback?.message || ''}
        </div>
        <button 
          className="btn-primary" 
          onClick={handleSave} 
          disabled={saving}
          style={{ padding: '12px 24px' }}
        >
          <Save size={18} />
          {saving ? 'Salvando...' : 'Salvar Hardware'}
        </button>
      </div>

    </div>
  );
}
