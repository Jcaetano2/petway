import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Save, Printer, FileText, Settings, AlertCircle } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function ConfigImpressao() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [formData, setFormData] = useState({
    largura_bobina: 80,
    imprimir_automatico: 1,
    exibir_dialogo_impressao: 1,
    imprimir_danfe_automatico: 0,
    vias_cupom: 1,
    mensagem_rodape: ''
  });
  const { showToast } = useToast();

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const data = await api.configImpressao.get();
      if (data) {
        setFormData({
          largura_bobina: data.largura_bobina || 80,
          imprimir_automatico: data.imprimir_automatico,
          exibir_dialogo_impressao: data.exibir_dialogo_impressao,
          imprimir_danfe_automatico: data.imprimir_danfe_automatico,
          vias_cupom: data.vias_cupom || 1,
          mensagem_rodape: data.mensagem_rodape || ''
        });
      }
    } catch (error) {
      console.error('Erro ao carregar configurações de impressão:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (formData.vias_cupom < 1 || formData.vias_cupom > 5) {
      showToast("O número de vias deve ser entre 1 e 5.", 'warning');
      return;
    }
    setSaving(true);
    try {
      const result = await api.configImpressao.save(formData);
      if (result.success) {
        showToast('Configurações de impressão salvas!', 'success');
      } else {
        showToast('Erro ao salvar: ' + result.message, 'error');
      }
    } catch (error) {
      showToast('Erro ao salvar configurações.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestPrint = async () => {
    setTesting(true);
    const bobinaWidth = formData.largura_bobina === 58 ? '210px' : '280px';
    const rodapeMsg = formData.mensagem_rodape || 'Sem rodapé configurado';
    const silent = formData.exibir_dialogo_impressao === 0;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <style>
              @page { margin: 0; }
              body { margin: 0; padding: 10px; font-family: 'Courier New', Courier, monospace; font-size: 12px; color: #000; width: ${bobinaWidth}; box-sizing: border-box; }
              .center { text-align: center; }
          </style>
      </head>
      <body>
          <h2 class="center">Teste de Impressora</h2>
          <div class="center">Bobina: ${formData.largura_bobina}mm</div>
          <div class="center">Diálogo: ${silent ? 'Não' : 'Sim'}</div>
          <div class="center" style="margin-top:20px; font-size: 11px;">
            ${rodapeMsg.replace(/\\n/g, '<br/>')}
          </div>
      </body>
      </html>
    `;

    try {
      const result = await api.system.printReceipt({ htmlContent, silent });
      if (!result.success) {
        showToast('Erro ao testar impressão: ' + result.error, 'error');
      } else {
        showToast('Impressão de teste enviada!', 'info');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setTesting(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (loading) return <div style={{ padding: '24px', color: 'var(--text-secondary)' }}>Carregando configurações...</div>;

  const showViasWarning = formData.vias_cupom > 1 && formData.exibir_dialogo_impressao === 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="card">
        <h2 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Printer size={20} color="var(--primary)" />
          Preferências de Impressão
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '8px' }}>
          Configure o tamanho da bobina térmica, automações e layouts do comprovante.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '20px', alignItems: 'start' }}>
        
        {/* Lado Esquerdo - Comercial */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-default)', paddingBottom: '12px' }}>
              <FileText size={18} /> Cupom Comercial
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="input-group">
                <label>Largura da Bobina</label>
                <select 
                  className="input" 
                  value={formData.largura_bobina}
                  onChange={(e) => handleChange('largura_bobina', parseInt(e.target.value))}
                >
                  <option value={80}>80mm (Padrão)</option>
                  <option value={58}>58mm (Mini)</option>
                </select>
              </div>

              <div className="input-group">
                <label>Número de Vias para Impressão</label>
                <input 
                  type="number" 
                  className="input" 
                  min="1" max="5"
                  value={formData.vias_cupom}
                  onChange={(e) => handleChange('vias_cupom', parseInt(e.target.value) || 1)}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={formData.imprimir_automatico === 1}
                    onChange={(e) => handleChange('imprimir_automatico', e.target.checked ? 1 : 0)}
                  />
                  <span>Imprimir automaticamente ao finalizar venda</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={formData.exibir_dialogo_impressao === 1}
                    onChange={(e) => handleChange('exibir_dialogo_impressao', e.target.checked ? 1 : 0)}
                  />
                  <span>Exibir janela de impressão do sistema (Não Silencioso)</span>
                </label>
              </div>

              {showViasWarning && (
                <div style={{ backgroundColor: 'rgba(255, 152, 0, 0.1)', borderLeft: '3px solid #ff9800', padding: '12px', color: 'var(--text-secondary)', fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'start', borderRadius: '4px' }}>
                  <AlertCircle size={16} color="#ff9800" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong style={{ color: '#ff9800', display: 'block', marginBottom: '4px' }}>Aviso sobre múltiplas vias</strong>
                    Com o diálogo de impressão ativo, imprimir {formData.vias_cupom} vias fará solicitar a impressora {formData.vias_cupom} vezes na hora da venda. Se quiser que as vias saiam sozinhas, desmarque a "janela de impressão" (uso silencioso).
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-default)', paddingBottom: '12px' }}>
              <Settings size={18} /> Personalização do Cupom
            </h3>

            <div className="input-group">
              <label>Mensagem de Rodapé (Opcional)</label>
              <textarea 
                className="input" 
                rows={3}
                placeholder="Ex: Volte sempre!"
                value={formData.mensagem_rodape}
                onChange={(e) => handleChange('mensagem_rodape', e.target.value)}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Esta mensagem aparecerá apenas no cupom térmico comercial.</span>
            </div>
          </div>
        </div>

        {/* Lado Direito - Fiscal & Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-default)', paddingBottom: '12px' }}>
              <Printer size={18} /> DANFE NFC-e
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={formData.imprimir_danfe_automatico === 1}
                  onChange={(e) => handleChange('imprimir_danfe_automatico', e.target.checked ? 1 : 0)}
                />
                <span>Imprimir DANFE automaticamente após autorização</span>
              </label>

              <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: '12px', color: 'var(--text-secondary)', fontSize: '13px', borderRadius: '4px' }}>
                O DANFE só gera disparo automático de impressão caso a SEFAZ retorne status de NFC-e <strong>Autorizada</strong> na hora da conclusão da venda pelo PDV.
              </div>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button 
              className="btn-outline" 
              onClick={handleTestPrint}
              disabled={testing}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {testing ? 'Testando...' : 'Testar Impressão'}
            </button>
            <button 
              className="btn" 
              onClick={handleSave}
              disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Save size={18} />
              {saving ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
