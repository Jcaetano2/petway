import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Save } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function ConfigEmpresa() {
  const [formData, setFormData] = useState({
    id: '',
    nome_fantasia: '',
    razao_social: '',
    cnpj: '',
    telefone: '',
    email: '',
    endereco: '',
    cidade: '',
    uf: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    async function fetchEmpresa() {
      const data = await api.config.getEmpresa();
      if (data) setFormData(data);
      setLoading(false);
    }
    fetchEmpresa();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const res = await api.config.saveEmpresa(formData);
    setSaving(false);
    
    if (res.success) {
      showToast('Dados empresariais atualizados!', 'success');
    } else {
      showToast('Falha ao salvar: ' + res.message, 'error');
    }
  };

  if (loading) return <div style={{ padding: '24px', color: 'var(--text-secondary)' }}>Carregando dados empresariais...</div>;

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ fontSize: '18px', marginBottom: '8px' }}>Dados da Empresa</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Estas informações comporão cabeçalhos de Nota, Cupons Térmicos e relatórios financeiros internos.
        </p>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="input-group">
            <label>Nome Fantasia</label>
            <input type="text" className="input" name="nome_fantasia" value={formData.nome_fantasia || ''} onChange={handleChange} required placeholder="Ex: PetWay Amigo Animal" />
          </div>
          <div className="input-group">
            <label>Razão Social</label>
            <input type="text" className="input" name="razao_social" value={formData.razao_social || ''} onChange={handleChange} placeholder="Ex: Cães & Gatos Serviços Veterinários LTDA" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)', gap: '16px' }}>
           <div className="input-group">
             <label>CNPJ / CPF</label>
             <input type="text" className="input" name="cnpj" value={formData.cnpj || ''} onChange={handleChange} placeholder="Ex: 00.000.000/0001-00" />
           </div>
           <div className="input-group">
             <label>Telefone Principal</label>
             <input type="text" className="input" name="telefone" value={formData.telefone || ''} onChange={handleChange} placeholder="(00) 00000-0000" />
           </div>
           <div className="input-group">
             <label>E-mail Institucional</label>
             <input type="email" className="input" name="email" value={formData.email || ''} onChange={handleChange} placeholder="contato@empresa.com.br" />
           </div>
        </div>

        <div className="input-group">
           <label>Endereço Físico (Rua, Número, Bairro)</label>
           <input type="text" className="input" name="endereco" value={formData.endereco || ''} onChange={handleChange} placeholder="Ex: Rua das Flores, 123 - Centro" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: '16px' }}>
           <div className="input-group">
             <label>Cidade</label>
             <input type="text" className="input" name="cidade" value={formData.cidade || ''} onChange={handleChange} />
           </div>
           <div className="input-group">
             <label>UF</label>
             <input type="text" className="input" name="uf" maxLength={2} value={formData.uf || ''} onChange={handleChange} style={{ textTransform: 'uppercase' }} />
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
