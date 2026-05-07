import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Users, Plus, KeyRound, Edit, Check, X, Trash2, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import ModalConfirm from '../components/Common/ModalConfirm';

export default function Usuarios() {
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  
  const [formData, setFormData] = useState({ nome: '', login: '', senha: '', tipo_usuario: 'operador' });
  const [formError, setFormError] = useState('');
  const { showToast } = useToast();
  const [modalConfirm, setModalConfirm] = useState({ isOpen: false, title: '', message: '', type: 'info', onConfirm: () => {} });

  const loadData = async () => {
    setLoading(true);
    const res = await api.usuarios.getAll(user);
    if (res.success) {
      setUsuarios(res.data);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleOpenNew = () => {
    setEditingUser(null);
    setFormData({ nome: '', login: '', senha: '', tipo_usuario: 'operador' });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (u) => {
    setEditingUser(u.id);
    setFormData({ nome: u.nome, login: u.login, senha: '', tipo_usuario: u.tipo_usuario });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (u) => {
    if (u.id === user.id) {
      showToast('Você não pode inativar a si mesmo.', 'warning');
      return;
    }
    
    setModalConfirm({
      isOpen: true,
      title: u.ativo ? 'Inativar Usuário' : 'Ativar Usuário',
      message: `Tem certeza que deseja ${u.ativo ? 'inativar' : 'ativar'} o usuário "${u.nome}"?`,
      type: u.ativo ? 'danger' : 'success',
      onConfirm: async () => {
        const res = await api.usuarios.updateStatus({ authToken: user.sessionToken, requesterLogin: user.login, id: u.id, ativo: !u.ativo });
        if (res.success) {
          showToast(`Usuário ${u.ativo ? 'inativado' : 'ativado'} com sucesso.`, 'success');
          loadData();
        } else {
          showToast('Erro: ' + res.message, 'error');
        }
      }
    });
  };

  const handleDelete = (u) => {
    // Proteção dupla no frontend: admin intocável por qualquer um; auto-exclusão bloqueada
    if (u.login === 'admin') {
      showToast('O usuário "admin" é permanente e não pode ser excluído.', 'error');
      return;
    }
    if (u.login === user.login) {
      showToast('Você não pode excluir a si mesmo.', 'warning');
      return;
    }

    setModalConfirm({
      isOpen: true,
      title: 'Excluir Usuário Permanentemente',
      message: `Tem certeza que deseja EXCLUIR permanentemente o usuário "${u.nome}" (@${u.login})? Esta ação não pode ser desfeita.`,
      type: 'danger',
      onConfirm: async () => {
        const res = await api.usuarios.delete({
            authToken: user.sessionToken,
          requesterLogin: user.login,
          id: u.id
        });
        if (res.success) {
          showToast(`Usuário "${u.nome}" excluído com sucesso.`, 'success');
          loadData();
        } else {
          showToast('Erro: ' + res.message, 'error');
        }
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    
    if (!editingUser && !formData.senha) return setFormError('Digite uma senha para o novo usuário.');
    
    const payload = { ...formData, authToken: user.sessionToken, requesterLogin: user.login };
    let res;
    
    if (editingUser) {
       payload.id = editingUser;
       res = await api.usuarios.update(payload);
    } else {
       res = await api.usuarios.create(payload);
    }

    if (res.success) {
      showToast(editingUser ? 'Usuário atualizado!' : 'Usuário criado com sucesso!', 'success');
      setIsModalOpen(false);
      loadData();
    } else {
      setFormError(res.message);
      showToast(res.message, 'error');
    }
  };

  // Determina se o usuário alvo está protegido contra ações sensíveis
  const isProtected = (u) => u.login === 'admin' && user?.login !== 'admin';
  const isSelf = (u) => u.id === user?.id;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: '100%' }}>
       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Controle de Acessos</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Gerencie os usuários e permissões do sistema.</p>
          </div>
          <button className="btn" onClick={handleOpenNew} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={18} /> Novo Usuário
          </button>
       </div>

       <div className="card" style={{ flex: 1, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
              <tr>
                <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontWeight: '600' }}>Usuário</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontWeight: '600' }}>Login</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontWeight: '600' }}>Cargo / Permissão</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontWeight: '600' }}>Status</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontWeight: '600', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>Carregando dados...</td></tr>
              ) : usuarios.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)', opacity: u.ativo ? 1 : 0.5 }}>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{u.nome}</div>
                      {u.login === 'admin' && (
                        <span style={{
                          fontSize: '10px', fontWeight: '800', padding: '2px 6px',
                          borderRadius: '4px', background: 'rgba(245,158,11,0.15)',
                          color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.5px'
                        }}>
                          Protegido
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>@{u.login}</td>
                  <td style={{ padding: '16px 24px' }}>
                     <span style={{ 
                        padding: '4px 10px', 
                        borderRadius: '12px', 
                        fontSize: '12px', 
                        fontWeight: '600', 
                        backgroundColor: u.tipo_usuario === 'administrador' ? 'rgba(var(--primary-rgb), 0.1)' : 'rgba(255,255,255,0.05)',
                        color: u.tipo_usuario === 'administrador' ? 'var(--primary)' : 'var(--text-secondary)'
                     }}>
                        {u.tipo_usuario.toUpperCase()}
                     </span>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                     <button 
                         onClick={() => handleToggleStatus(u)} 
                         disabled={isProtected(u)}
                         title={isProtected(u) ? 'Usuário admin não pode ser alterado' : ''}
                         style={{ 
                         background: 'transparent', border: 'none', cursor: isProtected(u) ? 'not-allowed' : 'pointer',
                         color: u.ativo ? 'var(--success)' : 'var(--danger)',
                         display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '500', fontSize: '13px',
                         opacity: isProtected(u) ? 0.4 : 1
                     }}>
                        {u.ativo ? <><Check size={14}/> Ativo</> : <><X size={14}/> Inativo</>}
                     </button>
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', alignItems: 'center' }}>
                      <button 
                          onClick={() => handleOpenEdit(u)} 
                          className="btn-outline" 
                          disabled={isProtected(u)}
                          title={isProtected(u) ? 'Usuário admin não pode ser editado por outros administradores' : 'Editar usuário'}
                          style={{ padding: '6px 12px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: isProtected(u) ? 'not-allowed' : 'pointer', opacity: isProtected(u) ? 0.4 : 1 }}>
                         <Edit size={14} /> Editar
                      </button>

                      {/* Botão Excluir — oculto para admin e para o próprio usuário logado */}
                      {u.login !== 'admin' && !isSelf(u) && (
                        <button
                          onClick={() => handleDelete(u)}
                          title="Excluir usuário permanentemente"
                          style={{
                            padding: '6px 12px', fontSize: '13px',
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            background: 'rgba(239, 68, 68, 0.08)',
                            color: 'var(--danger)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            fontWeight: '500'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.18)';
                            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.25)';
                          }}
                        >
                          <Trash2 size={14} /> Excluir
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
       </div>

       {isModalOpen && (
         <div className="modal-overlay">
           <div className="modal animate-scale-up" style={{ width: '450px' }}>
             <h2 style={{ marginBottom: '20px', fontSize: '20px' }}>{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</h2>
             
             {formError && (
               <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(255, 82, 82, 0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', fontSize: '14px', marginBottom: '16px' }}>
                 {formError}
               </div>
             )}

             <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
               <div className="input-group">
                 <label>Nome Completo</label>
                 <input autoFocus required type="text" className="input" value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} />
               </div>
               
               <div className="input-group">
                 <label>Login de Acesso</label>
                 <input required type="text" className="input" value={formData.login} onChange={e => setFormData({...formData, login: e.target.value})} disabled={editingUser === user?.id} />
               </div>
               
               <div className="input-group">
                 <label>{editingUser ? 'Criar Nova Senha (deixe branco para manter)' : 'Senha de Acesso'}</label>
                 <input type="password" className="input" placeholder="••••••••" value={formData.senha} onChange={e => setFormData({...formData, senha: e.target.value})} />
               </div>
               
               <div className="input-group">
                 <label>Cargo / Permissão</label>
                 <select className="input" value={formData.tipo_usuario} onChange={e => setFormData({...formData, tipo_usuario: e.target.value})} disabled={editingUser === user?.id}>
                   <option value="operador">Operador (Apenas PDV e Agendas)</option>
                   <option value="administrador">Administrador (Total)</option>
                 </select>
               </div>
               
               <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                 <button type="button" className="btn-outline" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                 <button type="submit" className="btn">Salvar Usuário</button>
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
