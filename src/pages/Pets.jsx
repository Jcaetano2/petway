import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Plus, Search, Edit2, Trash2, History, X, Star, Calendar, DollarSign, MessageCircle } from 'lucide-react';
import { gerarLinkLembrete } from '../utils/whatsappHelper';
import { useBranding } from '../context/BrandingContext';
import { useToast } from '../context/ToastContext';
import ModalConfirm from '../components/Common/ModalConfirm';

export default function Pets() {
  const [pets, setPets] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { branding } = useBranding();
  const { showToast } = useToast();
  const [modalConfirm, setModalConfirm] = useState({ isOpen: false, title: '', message: '', type: 'info', onConfirm: () => {} });
  
  const initialForm = { id: null, cliente_id: '', nome: '', especie: '', raca: '', porte: '', sexo: '', data_nascimento: '', observacoes: '' };
  const [formData, setFormData] = useState(initialForm);

  // Modal de histórico
  const [showHistorico, setShowHistorico] = useState(false);
  const [historicoPet, setHistoricoPet] = useState(null);
  const [historicoData, setHistoricoData] = useState([]);
  const [clienteResumo, setClienteResumo] = useState(null);
  const [historicoLoading, setHistoricoLoading] = useState(false);

  async function loadData() {
    setLoading(true);
    const [petsData, clientesData] = await Promise.all([
      api.pets.getAll(),
      api.clientes.getAll()
    ]);
    setPets(petsData);
    setClientes(clientesData);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.nome) return showToast('O nome do pet é obrigatório!', 'warning');
    if (!formData.cliente_id) return showToast('É obrigatório vincular um cliente (tutor) ao pet!', 'warning');
    if (!formData.especie) return showToast('A espécie é obrigatória!', 'warning');

    if (formData.id) {
      await api.pets.update(formData);
      showToast('Pet atualizado com sucesso!', 'success');
    } else {
      await api.pets.create(formData);
      showToast('Pet cadastrado com sucesso!', 'success');
    }
    
    setFormData(initialForm);
    setShowForm(false);
    loadData();
  };

  const handleEdit = (pet) => {
    setFormData(pet);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    setModalConfirm({
      isOpen: true,
      title: 'Inativar Pet',
      message: 'Tem certeza que deseja inativar este pet?',
      type: 'danger',
      onConfirm: async () => {
        const res = await api.pets.delete(id);
        if (!res.success) {
          showToast(res.message, 'error');
        } else {
          showToast('Pet inativado com sucesso!', 'success');
          loadData();
        }
      }
    });
  };

  const handleVerHistorico = async (pet) => {
    setHistoricoPet(pet);
    setShowHistorico(true);
    setHistoricoLoading(true);
    try {
      const [historico, resumo] = await Promise.all([
        api.pets.getHistorico(pet.id),
        api.clientes.getResumo(pet.cliente_id)
      ]);
      setHistoricoData(historico || []);
      setClienteResumo(resumo || {});
    } catch {
      setHistoricoData([]);
      setClienteResumo({});
    }
    setHistoricoLoading(false);
  };

  const fmtDate = (d) => {
    if (!d) return '-';
    try {
      return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return d;
    }
  };

  const fmt = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const badgeColors = {
    'VIP': { bg: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B' },
    'Frequente': { bg: 'rgba(16, 185, 129, 0.15)', color: '#10B981' },
    'Recorrente': { bg: 'rgba(99, 102, 241, 0.15)', color: '#6366F1' },
    'Novo': { bg: 'rgba(161, 161, 170, 0.15)', color: '#A1A1AA' }
  };

  const filtered = pets.filter(p => p.nome.toLowerCase().includes(searchTerm.toLowerCase()) || p.cliente_nome.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0 12px', width: '300px' }}>
          <Search size={18} color="var(--text-secondary)" />
          <input type="text" placeholder="Buscar pet ou tutor..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', padding: '12px 0', width: '100%', outline: 'none' }} />
        </div>
        <button className="btn" onClick={() => { setFormData(initialForm); setShowForm(!showForm); }}>
          <Plus size={18} /> {showForm ? 'Cancelar' : 'Novo Pet'}
        </button>
      </div>

      {showForm && (
        <div className="card animate-fade">
          <h3 style={{ marginBottom: '16px' }}>{formData.id ? 'Editar Pet' : 'Cadastrar Pet'}</h3>
          <form onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)', gap: '16px' }}>
            
            <div className="input-group" style={{ gridColumn: 'span 3' }}>
              <label>Cliente (Tutor) *</label>
              <select required className="input" value={formData.cliente_id} onChange={e => setFormData({...formData, cliente_id: e.target.value})}>
                <option value="">-- Selecione o tutor --</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>

            <div className="input-group" style={{ gridColumn: 'span 2' }}>
              <label>Nome do Pet *</label>
              <input required className="input" value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} />
            </div>
            
            <div className="input-group">
              <label>Espécie * (Ex: Cão, Gato)</label>
              <input required className="input" value={formData.especie} onChange={e => setFormData({...formData, especie: e.target.value})} />
            </div>

            <div className="input-group">
              <label>Raça</label>
              <input className="input" value={formData.raca} onChange={e => setFormData({...formData, raca: e.target.value})} />
            </div>

            <div className="input-group">
              <label>Porte</label>
              <select className="input" value={formData.porte} onChange={e => setFormData({...formData, porte: e.target.value})}>
                <option value="">Selecione...</option>
                <option value="pequeno">Pequeno</option>
                <option value="medio">Médio</option>
                <option value="grande">Grande</option>
              </select>
            </div>

            <div className="input-group">
              <label>Sexo</label>
              <select className="input" value={formData.sexo} onChange={e => setFormData({...formData, sexo: e.target.value})}>
                <option value="">Selecione...</option>
                <option value="M">Macho</option>
                <option value="F">Fêmea</option>
              </select>
            </div>

            <div className="input-group" style={{ gridColumn: 'span 3' }}>
              <label>Observações / Restrições (Ex: Alergias, Agressivo)</label>
              <input className="input" value={formData.observacoes} onChange={e => setFormData({...formData, observacoes: e.target.value})} />
            </div>

            <div className="input-group" style={{ gridColumn: 'span 3' }}>
              <button className="btn" style={{ width: 'fit-content' }}>Salvar Pet</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '12px 16px', fontWeight: '500' }}>Pet</th>
              <th style={{ padding: '12px 16px', fontWeight: '500' }}>Tutor</th>
              <th style={{ padding: '12px 16px', fontWeight: '500' }}>Espécie/Raça</th>
              <th style={{ padding: '12px 16px', fontWeight: '500', width: '160px', textAlign: 'center' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan="4" style={{ padding: '16px', textAlign: 'center' }}>Carregando...</td></tr> : 
             filtered.length === 0 ? <tr><td colSpan="4" style={{ padding: '16px', textAlign: 'center' }}>Nenhum pet encontrado.</td></tr> :
             filtered.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '12px 16px', color: 'var(--text-primary)', fontWeight: 'bold' }}>{p.nome} {p.sexo === 'M' ? '♂' : (p.sexo === 'F' ? '♀' : '')}</td>
                <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{p.cliente_nome}</td>
                <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{p.especie || '-'} {p.raca ? `- ${p.raca}` : ''}</td>
                <td style={{ padding: '12px 16px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
                   <button onClick={() => handleVerHistorico(p)} title="Histórico" className="btn-outline" style={{ padding: '6px', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}><History size={16} /></button>
                   <button onClick={() => handleEdit(p)} className="btn-outline" style={{ padding: '6px', border: 'none', color: 'var(--info)', cursor: 'pointer' }}><Edit2 size={16} /></button>
                   <button onClick={() => handleDelete(p.id)} className="btn-outline" style={{ padding: '6px', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ──── Modal de Histórico ──── */}
      {showHistorico && historicoPet && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowHistorico(false)} />
          <div className="card animate-fade" style={{ position: 'relative', width: '640px', maxHeight: '80vh', overflow: 'auto', zIndex: 1001 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: '0 0 4px 0', fontSize: '18px' }}>
                  {historicoPet.nome} {historicoPet.sexo === 'M' ? '♂' : (historicoPet.sexo === 'F' ? '♀' : '')}
                </h2>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {historicoPet.especie || ''} {historicoPet.raca ? `• ${historicoPet.raca}` : ''} {historicoPet.porte ? `• ${historicoPet.porte}` : ''} • Tutor: {historicoPet.cliente_nome}
                </div>
                {historicoPet.observacoes && (
                  <div style={{ fontSize: '12px', color: 'var(--warning)', marginTop: '6px', fontStyle: 'italic' }}>
                    ⚠️ {historicoPet.observacoes}
                  </div>
                )}
              </div>
              <button onClick={() => setShowHistorico(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px' }}><X size={20} /></button>
            </div>

            {/* Badge + Resumo */}
            {clienteResumo && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
                <div style={{ padding: '12px', borderRadius: '10px', background: badgeColors[clienteResumo.badge]?.bg || 'rgba(255,255,255,0.05)', textAlign: 'center' }}>
                  <Star size={16} style={{ color: badgeColors[clienteResumo.badge]?.color, marginBottom: '4px' }} />
                  <div style={{ fontSize: '13px', fontWeight: '700', color: badgeColors[clienteResumo.badge]?.color }}>{clienteResumo.badge}</div>
                </div>
                <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', textAlign: 'center' }}>
                  <Calendar size={16} style={{ color: 'var(--text-secondary)', marginBottom: '4px' }} />
                  <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>{clienteResumo.totalVisitas}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>visitas</div>
                </div>
                <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', textAlign: 'center' }}>
                  <DollarSign size={16} style={{ color: 'var(--success)', marginBottom: '4px' }} />
                  <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--success)' }}>{fmt(clienteResumo.totalGasto)}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>total gasto</div>
                </div>
                <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', textAlign: 'center' }}>
                  <History size={16} style={{ color: 'var(--info)', marginBottom: '4px' }} />
                  <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{clienteResumo.ultimaVisita ? fmtDate(clienteResumo.ultimaVisita) : 'Nunca'}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>última visita</div>
                </div>
              </div>
            )}

            {/* Timeline */}
            <h3 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--text-secondary)' }}>Histórico de Atendimentos</h3>
            {historicoLoading ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>Carregando...</div>
            ) : historicoData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)', fontSize: '13px' }}>Nenhum atendimento registrado para este pet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {historicoData.map((h, i) => (
                  <div key={h.id || i} style={{ display: 'flex', gap: '12px', padding: '10px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', borderLeft: '3px solid var(--primary)', transition: 'background 0.15s' }}
                    onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}>
                    <div style={{ flexShrink: 0, width: '80px' }}>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>{fmtDate(h.data)}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{h.servico_nome || 'Serviço'}</div>
                      {h.observacoes && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{h.observacoes}</div>}
                    </div>
                    {h.valor_total != null && (
                      <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--success)', flexShrink: 0 }}>{fmt(h.valor_total)}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
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
