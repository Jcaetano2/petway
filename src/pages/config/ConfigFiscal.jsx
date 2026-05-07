import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Save, AlertTriangle, ShieldCheck, ShieldAlert } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import ModalConfirm from '../../components/Common/ModalConfirm';

function Toggle({ checked, onChange, label, description }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>{label}</div>
        {description && <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{description}</div>}
      </div>
      <button type="button" onClick={() => onChange(!checked)} style={{ width: '48px', height: '26px', borderRadius: '13px', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background-color 0.25s ease', backgroundColor: checked ? 'var(--success)' : '#323238', flexShrink: 0, marginLeft: '16px' }}>
        <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#fff', position: 'absolute', top: '3px', left: checked ? '25px' : '3px', transition: 'left 0.25s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
      </button>
    </div>
  );
}

export default function ConfigFiscal() {
  const [formData, setFormData] = useState({
    id: '', ambiente: 'homologacao', cnpj: '', ie: '', razao_social: '', nome_fantasia: '',
    crt: '', csc: '', csc_id: '', serie_nfce: 1, proximo_numero_nfce: 1, uf: '', cidade: '', habilitado: 0,
    api_provider: 'focus', api_token: '', api_url: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showProdConfirm, setShowProdConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const { showToast } = useToast();
  const [modalConfirm, setModalConfirm] = useState({ isOpen: false, title: '', message: '', type: 'info', onConfirm: () => {} });

  useEffect(() => {
    async function fetchConfig() {
      const data = await api.fiscal.getConfig();
      if (data) setFormData(data);
      setLoading(false);
    }
    fetchConfig();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Validações obrigatórias para produção
  const validarParaProducao = () => {
    const erros = [];
    const cnpjDigits = (formData.cnpj || '').replace(/\D/g, '');
    if (cnpjDigits.length < 14) erros.push('CNPJ inválido (mínimo 14 dígitos)');
    if (!formData.razao_social || formData.razao_social.trim().length < 3) erros.push('Razão Social é obrigatória');
    if (!formData.csc || formData.csc.trim().length < 4) erros.push('CSC (Código de Segurança do Contribuinte) não preenchido');
    if (!formData.api_token || formData.api_token.trim().length < 8) erros.push('Token da API não preenchido');
    if (!formData.uf || formData.uf.trim().length !== 2) erros.push('UF inválida');
    return erros;
  };

  const handleToggleAmbiente = () => {
    if (formData.ambiente === 'homologacao') {
      // Quer ir para produção → validar + confirmar
      const erros = validarParaProducao();
      if (erros.length > 0) {
        showToast('Validação falhou! Verifique os campos obrigatórios.', 'error');
        return;
      }
      setShowProdConfirm(true);
      setConfirmText('');
    } else {
      // Voltar para homologação → confirmação simples
      setModalConfirm({
        isOpen: true,
        title: 'Retornar para Homologação',
        message: 'Deseja realmente voltar para o ambiente de HOMOLOGAÇÃO? As NFC-e emitidas não terão mais validade fiscal.',
        type: 'warning',
        onConfirm: () => {
          setFormData({ ...formData, ambiente: 'homologacao' });
          showToast('Ambiente alterado para Homologação.', 'info');
        }
      });
    }
  };

  const handleConfirmProducao = () => {
    if (confirmText.trim().toUpperCase() !== 'PRODUCAO') {
      showToast('Texto de confirmação incorreto.', 'error');
      return;
    }
    setFormData({ ...formData, ambiente: 'producao' });
    setShowProdConfirm(false);
    setConfirmText('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const res = await api.fiscal.saveConfig(formData);
    setSaving(false);
    if (res.success) {
      showToast('Configurações fiscais salvas!', 'success');
    } else {
      showToast('Falha ao salvar: ' + (res.error || res.message || 'Erro desconhecido'), 'error');
    }
  };

  if (loading) return <div style={{ padding: '24px', color: 'var(--text-secondary)' }}>Carregando configurações fiscais...</div>;

  const isHomologacao = formData.ambiente === 'homologacao';
  const isProducao = formData.ambiente === 'producao';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Banner Ambiente */}
      {formData.habilitado ? (
        isHomologacao ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px',
            borderRadius: '8px', backgroundColor: 'rgba(255, 193, 7, 0.08)', border: '1px solid rgba(255, 193, 7, 0.3)', color: '#ffc107'
          }}>
            <AlertTriangle size={22} />
            <div>
              <div style={{ fontWeight: '700', fontSize: '14px' }}>Ambiente de Homologação Ativo</div>
              <div style={{ fontSize: '12px', opacity: 0.85 }}>Nenhuma NFC-e emitida neste ambiente tem validade fiscal. Utilize para testes e validação do fluxo.</div>
            </div>
          </div>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px',
            borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#EF4444'
          }}>
            <ShieldAlert size={22} />
            <div>
              <div style={{ fontWeight: '700', fontSize: '14px' }}>🔴 AMBIENTE DE PRODUÇÃO ATIVO</div>
              <div style={{ fontSize: '12px', opacity: 0.85 }}>Todas as NFC-e emitidas neste ambiente possuem VALIDADE FISCAL e são transmitidas para a SEFAZ. Tenha certeza absoluta antes de emitir.</div>
            </div>
          </div>
        )
      ) : null}

      {/* Card 1: Dados do Contribuinte */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <h2 style={{ fontSize: '18px', marginBottom: '8px' }}>Dados do Contribuinte</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Informações fiscais do emitente para composição da NFC-e.</p>
        </div>

        <form onSubmit={handleSave} id="fiscal-form" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="input-group">
              <label>CNPJ</label>
              <input type="text" className="input" name="cnpj" value={formData.cnpj || ''} onChange={handleChange} placeholder="00.000.000/0001-00" />
            </div>
            <div className="input-group">
              <label>Inscrição Estadual (IE)</label>
              <input type="text" className="input" name="ie" value={formData.ie || ''} onChange={handleChange} placeholder="000000000" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="input-group">
              <label>Razão Social</label>
              <input type="text" className="input" name="razao_social" value={formData.razao_social || ''} onChange={handleChange} />
            </div>
            <div className="input-group">
              <label>Nome Fantasia</label>
              <input type="text" className="input" name="nome_fantasia" value={formData.nome_fantasia || ''} onChange={handleChange} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 1fr', gap: '16px' }}>
            <div className="input-group">
              <label>CRT (Regime Tributário)</label>
              <select className="input" name="crt" value={formData.crt || ''} onChange={handleChange}>
                <option value="">Selecione...</option>
                <option value="1">1 — Simples Nacional</option>
                <option value="2">2 — Simples Nacional (Receita Bruta)</option>
                <option value="3">3 — Regime Normal</option>
              </select>
            </div>
            <div className="input-group">
              <label>UF</label>
              <input type="text" className="input" name="uf" maxLength={2} value={formData.uf || ''} onChange={handleChange} style={{ textTransform: 'uppercase' }} />
            </div>
            <div className="input-group">
              <label>Cidade</label>
              <input type="text" className="input" name="cidade" value={formData.cidade || ''} onChange={handleChange} />
            </div>
          </div>
        </form>
      </div>

      {/* Card 2: Parâmetros NFC-e */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <h2 style={{ fontSize: '18px', marginBottom: '8px' }}>Parâmetros NFC-e</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Configurações de emissão, segurança e numeração da NFC-e.</p>
        </div>

        {/* Toggle de Ambiente */}
        <div style={{ padding: '16px', borderRadius: '10px', border: `2px solid ${isProducao ? 'rgba(239, 68, 68, 0.4)' : 'var(--border-default)'}`, background: isProducao ? 'rgba(239, 68, 68, 0.04)' : 'var(--bg-primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>
                {isProducao ? <ShieldAlert size={18} color="#EF4444" /> : <ShieldCheck size={18} color="var(--success)" />}
                Ambiente: {isProducao ? 'PRODUÇÃO' : 'Homologação'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {isProducao ? '⚠️ NFC-e com VALIDADE FISCAL — emissão real para a SEFAZ' : 'Modo testes — NFC-e sem validade fiscal'}
              </div>
            </div>
            <button
              type="button"
              onClick={handleToggleAmbiente}
              style={{
                padding: '8px 16px', borderRadius: '8px', cursor: 'pointer',
                fontSize: '13px', fontWeight: '600',
                border: isProducao ? '1px solid rgba(245,158,11,0.5)' : '1px solid rgba(239,68,68,0.5)',
                background: isProducao ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                color: isProducao ? '#F59E0B' : '#EF4444',
                transition: 'all 0.2s'
              }}
            >
              {isProducao ? 'Voltar p/ Homologação' : 'Ativar Produção'}
            </button>
          </div>

          {/* Confirmação forte para produção */}
          {showProdConfirm && (
            <div style={{ marginTop: '16px', padding: '16px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#EF4444', marginBottom: '8px' }}>
                ⚠️ Confirme a ativação do ambiente de PRODUÇÃO
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                Digite <strong style={{ color: '#EF4444' }}>PRODUCAO</strong> no campo abaixo para confirmar. Após ativar, todas as NFC-e terão validade fiscal.
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  className="input"
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  placeholder="Digite PRODUCAO"
                  style={{ flex: 1, textTransform: 'uppercase' }}
                  autoFocus
                />
                <button onClick={handleConfirmProducao} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#EF4444', color: '#fff', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}>
                  Confirmar
                </button>
                <button onClick={() => setShowProdConfirm(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px' }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="input-group">
            <label>CSC (Código de Segurança do Contribuinte)</label>
            <input type="text" className="input" name="csc" value={formData.csc || ''} onChange={handleChange} placeholder="Token gerado no portal SEFAZ" />
          </div>
          <div className="input-group">
            <label>CSC ID (Identificador)</label>
            <input type="text" className="input" name="csc_id" value={formData.csc_id || ''} onChange={handleChange} placeholder="Ex: 000001" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="input-group">
            <label>Série NFC-e</label>
            <input type="number" className="input" name="serie_nfce" min={1} value={formData.serie_nfce || 1} onChange={handleChange} />
          </div>
          <div className="input-group">
            <label>Próximo Número NFC-e</label>
            <input type="number" className="input" name="proximo_numero_nfce" min={1} value={formData.proximo_numero_nfce || 1} onChange={handleChange} />
          </div>
        </div>

        {/* Card 3: Integração API */}
        <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: '20px', marginTop: '8px' }}>
          <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: '700', marginBottom: '16px', letterSpacing: '0.5px' }}>Integração com API de Emissão</div>

          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '16px', marginBottom: '16px' }}>
            <div className="input-group">
              <label>Provedor</label>
              <select className="input" name="api_provider" value={formData.api_provider || 'focus'} onChange={handleChange}>
                <option value="focus">Focus NFe</option>
                <option value="gatewayx">Gateway-X / ACBr Local</option>
              </select>
            </div>
            <div className="input-group">
              <label>Token da API</label>
              <input type="password" className="input" name="api_token" value={formData.api_token || ''} onChange={handleChange} placeholder={formData.api_provider === 'gatewayx' ? 'Opcional para Gateway-X' : 'Cole aqui o token fornecido pela Focus NFe'} />
            </div>
          </div>

          <div className="input-group" style={{ marginBottom: '16px' }}>
            <label>Base URL da API</label>
            <input type="text" className="input" name="api_url" value={formData.api_url || ''} onChange={handleChange} placeholder={formData.api_provider === 'gatewayx' ? 'http://localhost:8000/api/fiscal' : 'Opcional: URL customizada da Focus NFe'} />
          </div>

          <div style={{ padding: '12px 16px', borderRadius: '8px', backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-default)', fontSize: '12px', color: 'var(--text-secondary)' }}>
            O token é transmitido exclusivamente pelo processo nativo (Electron) e nunca exposto no navegador. Obtenha seu token no painel da Focus NFe.
          </div>
        </div>

        <Toggle
          checked={!!formData.habilitado}
          onChange={(v) => setFormData({ ...formData, habilitado: v ? 1 : 0 })}
          label="Habilitar emissão fiscal"
          description="Quando ativo, o PDV exibirá a opção de emitir NFC-e após finalizar a venda."
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-default)', paddingTop: '20px', marginTop: '8px' }}>
          <button type="submit" form="fiscal-form" className="btn" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', fontSize: '14px', fontWeight: 'bold' }}>
            <Save size={18} />
            {saving ? 'Gravando...' : 'Salvar Configurações Fiscais'}
          </button>
        </div>
      </div>

      <ModalConfirm
        isOpen={modalConfirm.isOpen}
        title={modalConfirm.title}
        message={modalConfirm.message}
        type={modalConfirm.type}
        onConfirm={() => {
          modalConfirm.onConfirm();
          setModalConfirm({ ...modalConfirm, isOpen: false });
        }}
        onClose={() => setModalConfirm({ ...modalConfirm, isOpen: false })}
      />
    </div>
  );
}
