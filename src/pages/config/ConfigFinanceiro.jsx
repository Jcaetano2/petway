import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Save, CheckCircle, Smartphone, CreditCard, Banknote, QrCode } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function ConfigFinanceiro() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const { showToast } = useToast();
  
  const [config, setConfig] = useState({
    exigir_abertura_caixa: 1,
    apenas_um_caixa_aberto: 1,
    confirmar_fechamento_caixa: 1,
    permitir_sangria: 1,
    permitir_suprimento: 1,
    desconto_maximo_percentual: 10,
    exigir_obs_sangria: 1,
    exigir_obs_ajuste: 1,
    pagto_dinheiro_ativo: 1,
    pagto_pix_ativo: 1,
    pagto_credito_ativo: 1,
    pagto_debito_ativo: 1
  });

  useEffect(() => {
    async function load() {
      const data = await api.config.caixaFinanceiro.get();
      if (data && data.id) {
        setConfig(data);
      }
      setLoading(false);
    }
    load();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    const res = await api.config.caixaFinanceiro.save(config);
    if (res.success) {
      showToast('Configurações de caixa salvas!', 'success');
    } else {
      showToast('Erro ao salvar configurações.', 'error');
    }
    setSaving(false);
  };

  const handleChange = (field, value) => {
    setConfig({ ...config, [field]: value });
  };

  const Toggle = ({ name, field, desc }) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', padding: '16px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
      <input type="checkbox" checked={config[field] === 1} onChange={e => handleChange(field, e.target.checked ? 1 : 0)} style={{ marginTop: '4px', transform: 'scale(1.2)' }} />
      <div>
        <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{name}</div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>{desc}</div>
      </div>
    </div>
  );

  if (loading) return <div style={{ padding: '24px' }}>Carregando...</div>;

  return (
    <div className="card animate-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2>Configurações de Caixa e Financeiro</h2>
        {msg && <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}><CheckCircle size={18} /> {msg}</span>}
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

        <div style={{ padding: '16px', border: '1px solid var(--border-default)', borderRadius: '8px' }}>
          <h3 style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>Operacional do Banco/Gaveta</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '16px' }}>
            <Toggle name="Exigir Abertura de Caixa" field="exigir_abertura_caixa" desc="Bloqueia PDV se não houver um caixa iniciado pelo operador." />
            <Toggle name="Apenas um Caixa por Sessão" field="apenas_um_caixa_aberto" desc="Impede múltiplos caixas em paralelo no terminal." />
            <Toggle name="Checagem Cega de Valor no Fechamento" field="confirmar_fechamento_caixa" desc="Obriga o operador a digitar quanto dinheiro físico há solto no final." />
          </div>
        </div>

        <div style={{ padding: '16px', border: '1px solid var(--border-default)', borderRadius: '8px' }}>
          <h3 style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>Movimentações</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '16px' }}>
            <Toggle name="Permitir Sangria (Retirada)" field="permitir_sangria" desc="Autoriza retirar dinheiro para avulsos ou malote." />
            <Toggle name="Permitir Suprimento (Entrada)" field="permitir_suprimento" desc="Autoriza adição de troco de emergência." />
            <Toggle name="Exigir Observação: Sangria" field="exigir_obs_sangria" desc="Não permite salvar sem texto explicativo." />
            <Toggle name="Exigir Observação: Suprimento" field="exigir_obs_ajuste" desc="Não permite salvar sem texto explicativo." />
          </div>
        </div>

        <div style={{ padding: '16px', border: '1px solid var(--border-default)', borderRadius: '8px' }}>
          <h3 style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>Regras de Pagamento no PDV</h3>
          
          <div className="input-group" style={{ marginBottom: '24px', maxWidth: '300px' }}>
            <label>Desconto Máximo de Vendedor (%)</label>
            <input type="number" step="0.1" className="input" value={config.desconto_maximo_percentual} onChange={e => handleChange('desconto_maximo_percentual', e.target.value)} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Toggle name="Habilitar Dinheiro Físico" field="pagto_dinheiro_ativo" desc="Mostra a opção em tela, com aba de cálculo de troco." />
            <Toggle name="Habilitar Transferência Pix" field="pagto_pix_ativo" desc="Exibido na interface do PDV e recidos." />
            <Toggle name="Habilitar Cartão de Crédito" field="pagto_credito_ativo" desc="Computa lançamento fiscal a prazo." />
            <Toggle name="Habilitar Cartão de Débito" field="pagto_debito_ativo" desc="Computa lançamento fiscal à vista." />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
          <button type="submit" className="btn" disabled={saving}>
            <Save size={18} /> {saving ? 'Salvando...' : 'Salvar Regras'}
          </button>
        </div>

      </form>
    </div>
  );
}
