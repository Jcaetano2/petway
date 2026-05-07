import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Plus, Search, Edit2, Trash2 } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import ModalConfirm from '../components/Common/ModalConfirm';

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const initialForm = { id: null, nome: '', telefone: '', email: '', cpf: '', endereco: '', observacoes: '' };
  const [formData, setFormData] = useState(initialForm);
  const { showToast } = useToast();
  const [modalConfirm, setModalConfirm] = useState({ isOpen: false, title: '', message: '', type: 'info', onConfirm: () => {} });

  async function loadData() {
    setLoading(true);
    const data = await api.clientes.getAll();
    setClientes(data);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.nome) return showToast('O nome é obrigatório!', 'warning');
    
    if (formData.id) {
      await api.clientes.update(formData);
      showToast('Cliente atualizado com sucesso!', 'success');
    } else {
      await api.clientes.create(formData);
      showToast('Cliente cadastrado com sucesso!', 'success');
    }
    
    setFormData(initialForm);
    setShowForm(false);
    loadData();
  };

  const handleEdit = (cliente) => {
    setFormData(cliente);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    setModalConfirm({
      isOpen: true,
      title: 'Inativar Cliente',
      message: 'Tem certeza que deseja inativar este cliente?',
      type: 'danger',
      onConfirm: async () => {
        const res = await api.clientes.delete(id);
        if (!res.success) {
          showToast(res.message, 'error');
        } else {
          showToast('Cliente inativado com sucesso!', 'success');
          loadData();
        }
      }
    });
  };

  const filtered = clientes.filter(c => c.nome.toLowerCase().includes(searchTerm.toLowerCase()) || (c.telefone && c.telefone.includes(searchTerm)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0 12px', width: '300px' }}>
          <Search size={18} color="var(--text-secondary)" />
          <input type="text" placeholder="Buscar cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', padding: '12px 0', width: '100%', outline: 'none' }} />
        </div>
        <button className="btn" onClick={() => { setFormData(initialForm); setShowForm(!showForm); }}>
          <Plus size={18} /> {showForm ? 'Cancelar' : 'Novo Cliente'}
        </button>
      </div>

      {showForm && (
        <div className="card animate-fade">
          <h3 style={{ marginBottom: '16px' }}>{formData.id ? 'Editar Cliente' : 'Cadastrar Cliente'}</h3>
          <form onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '16px' }}>
            <div className="input-group"><label>Nome Completo *</label><input required className="input" value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} /></div>
            <div className="input-group"><label>Telefone</label><input className="input" value={formData.telefone} onChange={e => setFormData({...formData, telefone: e.target.value})} /></div>
            <div className="input-group"><label>E-mail</label><input type="email" className="input" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /></div>
            <div className="input-group"><label>CPF</label><input className="input" value={formData.cpf} onChange={e => setFormData({...formData, cpf: e.target.value})} /></div>
            <div className="input-group" style={{ gridColumn: 'span 2' }}><label>Endereço</label><input className="input" value={formData.endereco} onChange={e => setFormData({...formData, endereco: e.target.value})} /></div>
            <div className="input-group" style={{ gridColumn: 'span 2' }}><label>Observações</label><input className="input" value={formData.observacoes} onChange={e => setFormData({...formData, observacoes: e.target.value})} /></div>
            <div className="input-group" style={{ gridColumn: 'span 2' }}><button className="btn" style={{ width: 'fit-content' }}>Salvar Cliente</button></div>
          </form>
        </div>
      )}

      <div className="card">
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '12px 16px', fontWeight: '500' }}>Nome</th>
              <th style={{ padding: '12px 16px', fontWeight: '500' }}>Telefone</th>
              <th style={{ padding: '12px 16px', fontWeight: '500' }}>Email</th>
              <th style={{ padding: '12px 16px', fontWeight: '500', width: '120px', textAlign: 'center' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan="4" style={{ padding: '16px', textAlign: 'center' }}>Carregando...</td></tr> : 
             filtered.length === 0 ? <tr><td colSpan="4" style={{ padding: '16px', textAlign: 'center' }}>Nenhum cliente cadastrado.</td></tr> :
             filtered.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '12px 16px', color: 'var(--text-primary)' }}>{c.nome}</td>
                <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{c.telefone || '-'}</td>
                <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{c.email || '-'}</td>
                <td style={{ padding: '12px 16px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
                   <button onClick={() => handleEdit(c)} className="btn-outline" style={{ padding: '6px', border: 'none', color: 'var(--info)', cursor: 'pointer' }}><Edit2 size={16} /></button>
                   <button onClick={() => handleDelete(c.id)} className="btn-outline" style={{ padding: '6px', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
