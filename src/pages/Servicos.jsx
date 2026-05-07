import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Plus, Edit2, Search, PowerOff, Power } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import ModalConfirm from '../components/Common/ModalConfirm';

export default function Servicos() {
  const [servicos, setServicos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState('todos');

  const [showForm, setShowForm] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const { showToast } = useToast();
  const [modalConfirm, setModalConfirm] = useState({ isOpen: false, title: '', message: '', type: 'info', onConfirm: () => {} });
  
  const initialForm = { 
    id: null, 
    nome: '', 
    descricao: '', 
    categoria: '', 
    preco_base: '', 
    usa_preco_por_porte: 0, 
    preco_pequeno: '', 
    preco_medio: '', 
    preco_grande: '', 
    duracao_minutos: 30, 
    ativo: 1 
  };
  const [formData, setFormData] = useState(initialForm);

  async function loadData() {
    setLoading(true);
    const data = await api.servicos.listAll();
    setServicos(data || []);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  const handleEdit = (s) => {
    setFormData({ ...s });
    setErrorMsg('');
    setShowForm(true);
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const servico = servicos.find(item => item.id === id);
    if(servico) {
      if (currentStatus === 1) {
         setModalConfirm({
           isOpen: true,
           title: 'Inativar Serviço',
           message: `Tem certeza que deseja inativar o serviço "${servico.nome}"? Ele não aparecerá em novos agendamentos e vendas.`,
           type: 'warning',
           onConfirm: async () => {
             const novoStatus = 0;
             const payload = { ...servico, ativo: novoStatus };
             if (!payload.preco_base) payload.preco_base = 0.01;
             const res = await api.servicos.update(payload);
             if(!res.success) showToast(res.message, 'error');
             else {
               showToast('Serviço inativado.', 'info');
               loadData();
             }
           }
         });
         return;
      }
      const novoStatus = 1;
      const payload = { ...servico, ativo: novoStatus };
      if (!payload.preco_base) payload.preco_base = 0.01;
      const res = await api.servicos.update(payload);
      if(!res.success) showToast(res.message, 'error');
      else {
        showToast('Serviço ativado!', 'success');
        loadData();
      }
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    
    if (!formData.nome) return setErrorMsg('Nome é obrigatório.');
    if (!formData.preco_base || parseFloat(formData.preco_base) <= 0) return setErrorMsg('O Preço Base deve ser preenchido firmemente e ser maior que zero, pois servirá de valor padrão.');

    if (formData.usa_preco_por_porte) {
      if (!formData.preco_pequeno || parseFloat(formData.preco_pequeno) <= 0) return setErrorMsg('Preço Pequeno inválido.');
      if (!formData.preco_medio || parseFloat(formData.preco_medio) <= 0) return setErrorMsg('Preço Médio inválido.');
      if (!formData.preco_grande || parseFloat(formData.preco_grande) <= 0) return setErrorMsg('Preço Grande inválido.');
    }

    const payload = {
      ...formData,
      preco_base: parseFloat(formData.preco_base),
      usa_preco_por_porte: formData.usa_preco_por_porte ? 1 : 0,
      preco_pequeno: parseFloat(formData.preco_pequeno) || 0,
      preco_medio: parseFloat(formData.preco_medio) || 0,
      preco_grande: parseFloat(formData.preco_grande) || 0,
      duracao_minutos: parseInt(formData.duracao_minutos) || 30
    };

    let res;
    if (formData.id) {
      res = await api.servicos.update(payload);
    } else {
      res = await api.servicos.create(payload);
    }

    if (!res.success) {
      showToast(res.message, 'error');
      return setErrorMsg(res.message);
    }

    showToast(formData.id ? 'Serviço atualizado!' : 'Serviço cadastrado!', 'success');
    setShowForm(false);
    loadData();
  };

  const filtered = servicos.filter(s => {
    if (filterMode === 'ativos' && s.ativo === 0) return false;
    if (filterMode === 'inativos' && s.ativo === 1) return false;
    if (searchTerm && !s.nome.toLowerCase().includes(searchTerm.toLowerCase()) && !(s.categoria || '').toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flex: 1, maxWidth: '600px' }}>
           <div className="input-group" style={{ flex: 1 }}>
             <label>Buscar Serviço</label>
             <div style={{ position: 'relative' }}>
               <input 
                 type="text" 
                 className="input" 
                 placeholder="Nome ou categoria..." 
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
                 style={{ paddingLeft: '36px' }}
               />
               <Search size={18} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-secondary)' }} />
             </div>
           </div>
           
           <div className="input-group" style={{ width: '180px' }}>
             <label>Status</label>
             <select className="input" value={filterMode} onChange={e => setFilterMode(e.target.value)}>
                <option value="todos">Todos os Status</option>
                <option value="ativos">Apenas Ativos</option>
                <option value="inativos">Apenas Inativos</option>
             </select>
           </div>
        </div>

        <button className="btn" onClick={() => { setFormData(initialForm); setShowForm(true); setErrorMsg(''); }} style={{ height: '42px' }}>
          <Plus size={18} /> Novo Serviço
        </button>
      </div>

      <div className="card">
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '12px 16px', fontWeight: '500' }}>Status</th>
              <th style={{ padding: '12px 16px', fontWeight: '500' }}>Serviço</th>
              <th style={{ padding: '12px 16px', fontWeight: '500' }}>Categoria</th>
              <th style={{ padding: '12px 16px', fontWeight: '500' }}>Exposição de Valor</th>
              <th style={{ padding: '12px 16px', fontWeight: '500', textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan="5" style={{ padding: '16px', textAlign: 'center' }}>Carregando...</td></tr> : 
             filtered.length === 0 ? <tr><td colSpan="5" style={{ padding: '16px', textAlign: 'center' }}>Nenhum serviço encontrado.</td></tr> :
             filtered.map(s => (
               <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)', opacity: s.ativo === 0 ? 0.6 : 1, transition: 'all 0.2s' }}>
                 <td style={{ padding: '12px 16px' }}>
                   <span style={{ 
                     padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', 
                     backgroundColor: s.ativo ? 'rgba(0, 200, 83, 0.1)' : 'rgba(255, 255, 255, 0.1)', 
                     color: s.ativo ? 'var(--success)' : 'var(--text-secondary)'
                   }}>
                     {s.ativo ? 'ATIVO' : 'INATIVO'}
                   </span>
                 </td>
                 <td style={{ padding: '12px 16px' }}>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{s.nome}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>{s.descricao || '--'}</div>
                 </td>
                 <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{s.categoria || 'Geral'}</td>
                 <td style={{ padding: '12px 16px' }}>
                    {s.usa_preco_por_porte ? (
                      <div>
                        <div style={{ color: 'var(--success)', fontWeight: 'bold', fontSize: '14px' }}>R$ Varia {s.duracao_minutos}m</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>P: {s.preco_pequeno?.toFixed(2)} | M: {s.preco_medio?.toFixed(2)} | G: {s.preco_grande?.toFixed(2)}</div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ color: 'var(--success)', fontWeight: 'bold', fontSize: '14px' }}>R$ {Number(s.preco_base).toFixed(2)}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '2px' }}>Aprox. {s.duracao_minutos} min</div>
                      </div>
                    )}
                 </td>
                 <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                   <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                     <button className="btn-outline" onClick={() => handleEdit(s)} style={{ padding: '6px', border: '1px solid var(--border-default)', background: 'transparent' }} title="Editar">
                       <Edit2 size={16} />
                     </button>
                     <button 
                       className="btn-outline" 
                       onClick={() => handleToggleStatus(s.id, s.ativo)} 
                       style={{ padding: '6px', border: `1px solid ${s.ativo ? 'var(--danger)' : 'var(--success)'}`, color: s.ativo ? 'var(--danger)' : 'var(--success)', background: 'transparent' }} 
                       title={s.ativo ? 'Desativar Serviço' : 'Ativar Serviço'}
                     >
                       {s.ativo ? <PowerOff size={16} /> : <Power size={16} />}
                     </button>
                   </div>
                 </td>
               </tr>
             ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>
          <div className="card animate-fade" style={{ width: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
               <h3 style={{ margin: 0 }}>{formData.id ? 'Editar Serviço' : 'Novo Serviço'}</h3>
            </div>
            
            {errorMsg && <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(255, 82, 82, 0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', fontSize: '13px', marginBottom: '16px' }}>{errorMsg}</div>}
            
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '16px' }}>
                <div className="input-group">
                  <label>Nome do Serviço *</label>
                  <input type="text" required className="input" value={formData.nome || ''} onChange={e => setFormData({...formData, nome: e.target.value})} autoFocus />
                </div>
                <div className="input-group">
                  <label>Categoria</label>
                  <input type="text" className="input" value={formData.categoria || ''} onChange={e => setFormData({...formData, categoria: e.target.value})} placeholder="Ex: Higiene, Tosa..." />
                </div>
              </div>

              <div className="input-group">
                <label>Descrição Opcional</label>
                <textarea className="input" style={{ resize: 'vertical', minHeight: '60px' }} value={formData.descricao || ''} onChange={e => setFormData({...formData, descricao: e.target.value})} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px' }}>
                <div className="input-group">
                  <label>Preço Base / Valor Padrão (R$) *</label>
                  <input type="number" step="0.01" required className="input" value={formData.preco_base} onChange={e => setFormData({...formData, preco_base: e.target.value})} />
                </div>
                
                <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-primary)', fontWeight: 'bold' }}>
                    <input 
                      type="checkbox" 
                      style={{ transform: 'scale(1.2)' }}
                      checked={formData.usa_preco_por_porte} 
                      onChange={e => setFormData({...formData, usa_preco_por_porte: e.target.checked ? 1 : 0})} 
                    />
                    Ativar Preço Dinâmico (Por Porte)
                  </label>
                </div>
              </div>

              {formData.usa_preco_por_porte === 1 && (
                <div className="animate-fade" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', background: 'rgba(var(--primary-rgb), 0.05)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(var(--primary-rgb), 0.2)' }}>
                  <div className="input-group">
                    <label>Pequeno (R$) *</label>
                    <input type="number" step="0.01" className="input" style={{ borderColor: 'var(--primary)' }} value={formData.preco_pequeno} onChange={e => setFormData({...formData, preco_pequeno: e.target.value})} />
                  </div>
                  <div className="input-group">
                    <label>Médio (R$) *</label>
                    <input type="number" step="0.01" className="input" style={{ borderColor: 'var(--primary)' }} value={formData.preco_medio} onChange={e => setFormData({...formData, preco_medio: e.target.value})} />
                  </div>
                  <div className="input-group">
                    <label>Grande (R$) *</label>
                    <input type="number" step="0.01" className="input" style={{ borderColor: 'var(--primary)' }} value={formData.preco_grande} onChange={e => setFormData({...formData, preco_grande: e.target.value})} />
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '16px' }}>
                <div className="input-group">
                  <label>Duração Estimada (Minutos) *</label>
                  <input type="number" required className="input" value={formData.duracao_minutos} onChange={e => setFormData({...formData, duracao_minutos: e.target.value})} />
                </div>
                <div className="input-group">
                  <label>Status Operacional</label>
                  <select className="input" value={formData.ativo} onChange={e => setFormData({...formData, ativo: parseInt(e.target.value)})}>
                    <option value={1}>Ativado (Público)</option>
                    <option value={0}>Inativo (Oculto)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-default)' }}>
                 <button type="button" className="btn-outline" onClick={() => setShowForm(false)}>Cancelar</button>
                 <button type="submit" className="btn">Salvar Serviço</button>
              </div>
            </form>
          </div>
        </div>
      )}

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
