import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Save } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

function Toggle({ checked, onChange, label, description }) {
  return (
    <div 
      style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '16px', 
        backgroundColor: 'var(--bg-primary)', 
        borderRadius: '8px', 
        border: '1px solid var(--border-default)' 
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>{label}</div>
        {description && <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{description}</div>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        style={{
          width: '48px',
          height: '26px',
          borderRadius: '13px',
          border: 'none',
          cursor: 'pointer',
          position: 'relative',
          transition: 'background-color 0.25s ease',
          backgroundColor: checked ? 'var(--success)' : '#323238',
          flexShrink: 0,
          marginLeft: '16px'
        }}
      >
        <div style={{
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          backgroundColor: '#fff',
          position: 'absolute',
          top: '3px',
          left: checked ? '25px' : '3px',
          transition: 'left 0.25s ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
        }} />
      </button>
    </div>
  );
}

export default function ConfigPDV() {
  const [formData, setFormData] = useState({
    id: '',
    permitir_venda_sem_cliente: 1,
    cliente_padrao: '',
    abrir_nova_venda_auto: 0,
    confirmar_cancelamento: 1
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    async function fetchConfig() {
      const data = await api.config.getPDV();
      if (data) setFormData(data);
      setLoading(false);
    }
    fetchConfig();
  }, []);

  const handleToggle = (field, value) => {
    setFormData({ ...formData, [field]: value ? 1 : 0 });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const res = await api.config.savePDV(formData);
    setSaving(false);

    if (res.success) {
      showToast('Configurações do PDV salvas!', 'success');
    } else {
      showToast('Falha ao salvar: ' + (res.message || 'Erro desconhecido'), 'error');
    }
  };

  if (loading) return <div style={{ padding: '24px', color: 'var(--text-secondary)' }}>Carregando configurações do PDV...</div>;

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ fontSize: '18px', marginBottom: '8px' }}>Operação de Frente de Loja (PDV)</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Defina o comportamento padrão do Ponto de Venda durante a operação de balcão.
        </p>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        <Toggle
          checked={!!formData.permitir_venda_sem_cliente}
          onChange={(v) => handleToggle('permitir_venda_sem_cliente', v)}
          label="Permitir venda sem identificação de cliente"
          description="Quando ativo, o operador pode finalizar vendas avulsas sem selecionar um cliente cadastrado."
        />

        <Toggle
          checked={!!formData.abrir_nova_venda_auto}
          onChange={(v) => handleToggle('abrir_nova_venda_auto', v)}
          label="Abrir nova venda automaticamente após finalizar"
          description="Após concluir uma venda, o sistema retorna imediatamente para uma nova sessão de venda livre."
        />

        <Toggle
          checked={!!formData.confirmar_cancelamento}
          onChange={(v) => handleToggle('confirmar_cancelamento', v)}
          label="Exigir confirmação ao cancelar venda"
          description="Solicita uma confirmação antes de anular os itens do carrinho e descartar a venda em andamento."
        />

        <div style={{ 
          padding: '16px', 
          backgroundColor: 'var(--bg-primary)', 
          borderRadius: '8px', 
          border: '1px solid var(--border-default)' 
        }}>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '14px', fontWeight: '600' }}>Nome do Cliente Padrão</label>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
              Nome utilizado automaticamente quando uma venda livre é realizada sem identificação de cliente.
            </p>
            <input
              type="text"
              className="input"
              value={formData.cliente_padrao || ''}
              onChange={e => setFormData({ ...formData, cliente_padrao: e.target.value })}
              placeholder="Ex: Consumidor Padrão"
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-default)', paddingTop: '20px', marginTop: '8px' }}>
          <button type="submit" className="btn" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', fontSize: '14px', fontWeight: 'bold' }}>
            <Save size={18} />
            {saving ? 'Gravando...' : 'Salvar Alterações'}
          </button>
        </div>

      </form>
    </div>
  );
}
