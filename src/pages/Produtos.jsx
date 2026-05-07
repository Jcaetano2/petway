import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Plus, Edit2, Archive, Search } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import ModalConfirm from '../components/Common/ModalConfirm';

export default function Produtos() {
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [busca, setBusca] = useState('');
  const [filtroAtivos, setFiltroAtivos] = useState('ativos'); // ativos, inativos, todos

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState(null);
  const [errorPx, setErrorPx] = useState('');
  const { showToast } = useToast();
  const [modalConfirm, setModalConfirm] = useState({ isOpen: false, title: '', message: '', type: 'info', onConfirm: () => {} });

  const loadProdutos = async () => {
    setLoading(true);
    const data = await api.produtos.getAll();
    setProdutos(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadProdutos();
  }, []);

  const openForm = (produto = null) => {
    setErrorPx('');
    if (produto) {
      setFormData({ ...produto });
    } else {
      setFormData({
        nome: '',
        codigo_barras: '',
        categoria: '',
        fornecedor: '',
        custo: 0,
        preco: 0,
        estoque: 0,
        estoque_minimo: 0,
        ativo: 1,
        vendido_por_peso: 0,
        unidade_medida: 'un',
        ncm: '',
        cfop: '',
        cst_csosn: '',
        unidade_comercial: ''
      });
    }
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setErrorPx('');

    if (!formData.nome || formData.nome.trim() === '') {
      return setErrorPx('O nome do produto é obrigatório.');
    }
    if (parseFloat(formData.preco) <= 0) {
      return setErrorPx('O preço deve ser maior que 0.');
    }

    const payload = {
      ...formData,
      custo: parseFloat(formData.custo) || 0,
      preco: parseFloat(formData.preco),
      estoque: parseFloat(formData.estoque) || 0,
      estoque_minimo: parseFloat(formData.estoque_minimo) || 0
    };

    let res;
    if (payload.id) {
      res = await api.produtos.update(payload);
    } else {
      res = await api.produtos.create(payload);
    }

    if (!res.success) {
      showToast(res.message, 'error');
      return setErrorPx(res.message);
    }

    showToast(payload.id ? 'Produto atualizado!' : 'Produto cadastrado!', 'success');
    setModalOpen(false);
    loadProdutos();
  };

  const handleInativar = async (id) => {
    setModalConfirm({
      isOpen: true,
      title: 'Inativar Produto',
      message: 'Tem certeza que deseja inativar este produto? Ele não aparecerá mais no PDV.',
      type: 'danger',
      onConfirm: async () => {
        const res = await api.produtos.delete(id);
        if (res.success) {
          showToast('Produto inativado.', 'success');
          loadProdutos();
        } else {
          showToast(res.message, 'error');
        }
      }
    });
  };

  const filteredProdutos = produtos.filter(p => {
    const matchBusca = p.nome.toLowerCase().includes(busca.toLowerCase()) || 
                       (p.codigo_barras && p.codigo_barras.toLowerCase().includes(busca.toLowerCase()));
    if (!matchBusca) return false;

    if (filtroAtivos === 'ativos') return p.ativo === 1;
    if (filtroAtivos === 'inativos') return p.ativo === 0;
    return true; // todos
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Catálogo de Produtos</h2>
        <button className="btn" onClick={() => openForm()}>
          <Plus size={18} /> Novo Produto
        </button>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '16px' }}>
        <div style={{ display: 'flex', gap: '16px' }}>
          <div className="input-group" style={{ flex: 1, position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '34px', color: 'var(--text-secondary)' }} />
            <label>Buscar Produto</label>
            <input 
              type="text" 
              className="input" 
              placeholder="Nome ou código de barras..." 
              value={busca} 
              onChange={e => setBusca(e.target.value)} 
              style={{ paddingLeft: '38px' }}
            />
          </div>
          <div className="input-group" style={{ width: '200px' }}>
            <label>Situação</label>
            <select className="input" value={filtroAtivos} onChange={e => setFiltroAtivos(e.target.value)}>
              <option value="ativos">Apenas Ativos</option>
              <option value="inativos">Apenas Inativos</option>
              <option value="todos">Mostrar Todos</option>
            </select>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Código/Nome</th>
                <th>Categoria</th>
                <th>Preço</th>
                <th>Estoque</th>
                <th>Status</th>
                <th style={{ width: '100px' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '24px' }}>Carregando...</td></tr>
              ) : filteredProdutos.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '24px' }}>Nenhum produto encontrado.</td></tr>
              ) : (
                filteredProdutos.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: '500' }}>{p.nome}</div>
                      {p.codigo_barras && <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>CB: {p.codigo_barras}</div>}
                    </td>
                    <td>{p.categoria || '-'}</td>
                    <td style={{ color: 'var(--success)' }}>R$ {p.preco.toFixed(2)}</td>
                    <td>{p.estoque}</td>
                    <td>
                      {p.ativo === 1 ? 
                        <span style={{ padding: '4px 8px', background: 'rgba(var(--success-rgb), 0.1)', color: 'var(--success)', borderRadius: '4px', fontSize: '12px' }}>Ativo</span> : 
                        <span style={{ padding: '4px 8px', background: 'rgba(var(--danger-rgb), 0.1)', color: 'var(--danger)', borderRadius: '4px', fontSize: '12px' }}>Inativo</span>
                      }
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn-outline" onClick={() => openForm(p)} title="Editar" style={{ padding: '6px' }}><Edit2 size={16} /></button>
                        {p.ativo === 1 && (
                          <button className="btn-outline" onClick={() => handleInativar(p.id)} title="Inativar" style={{ padding: '6px', color: 'var(--danger)', borderColor: 'var(--danger)' }}><Archive size={16} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card animate-fade" style={{ width: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '16px' }}>{formData.id ? 'Editar Produto' : 'Novo Produto'}</h2>
            
            {errorPx && (
              <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(255, 82, 82, 0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', fontSize: '13px', marginBottom: '16px' }}>
                {errorPx}
              </div>
            )}

            <form onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="input-group" style={{ gridColumn: 'span 2' }}>
                <label>Nome do Produto *</label>
                <input type="text" className="input" required value={formData.nome || ''} onChange={e => setFormData({...formData, nome: e.target.value})} />
              </div>
              
              <div className="input-group">
                <label>Código de Barras</label>
                <input type="text" className="input" value={formData.codigo_barras || ''} onChange={e => setFormData({...formData, codigo_barras: e.target.value})} />
              </div>

              <div className="input-group">
                <label>Categoria</label>
                <input type="text" className="input" value={formData.categoria || ''} onChange={e => setFormData({...formData, categoria: e.target.value})} />
              </div>

              <div className="input-group">
                <label>Fornecedor</label>
                <input type="text" className="input" value={formData.fornecedor || ''} onChange={e => setFormData({...formData, fornecedor: e.target.value})} />
              </div>

              {!formData.id && (
                <div className="input-group">
                  <label>Estoque Inicial</label>
                  <input type="number" className="input" step="0.01" value={formData.estoque || 0} onChange={e => setFormData({...formData, estoque: e.target.value})} />
                </div>
              )}
              {formData.id && (
                <div className="input-group">
                  <label>Estoque (Atual)</label>
                  <input type="number" disabled className="input" value={formData.estoque} style={{ backgroundColor: 'var(--bg-secondary)', cursor: 'not-allowed' }} />
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Use a aba Estoque para alterar</span>
                </div>
              )}

              <div className="input-group">
                <label>Custo (R$)</label>
                <input type="number" className="input" step="0.01" value={formData.custo || 0} onChange={e => setFormData({...formData, custo: e.target.value})} />
              </div>

              <div className="input-group">
                <label>Preço de Venda (R$) *</label>
                <input type="number" className="input" step="0.01" required value={formData.preco || 0} onChange={e => setFormData({...formData, preco: e.target.value})} />
              </div>

              <div className="input-group">
                <label>Estoque Mínimo (Alerta)</label>
                <input type="number" className="input" step="0.01" value={formData.estoque_minimo || 0} onChange={e => setFormData({...formData, estoque_minimo: e.target.value})} />
              </div>

              {formData.id && (
                <div className="input-group">
                  <label>Status</label>
                  <select className="input" value={formData.ativo} onChange={e => setFormData({...formData, ativo: parseInt(e.target.value)})}>
                    <option value={1}>Ativo (Vende no PDV)</option>
                    <option value={0}>Inativo (Somente Histórico)</option>
                  </select>
                </div>
              )}

              <div style={{ gridColumn: 'span 2', borderTop: '1px solid var(--border-default)', paddingTop: '16px', marginTop: '8px' }}>
                <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: '700', marginBottom: '16px', letterSpacing: '0.5px' }}>Configuração de Unidade e Balança</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="input-group">
                    <label>Vendido por Peso?</label>
                    <select 
                      className="input" 
                      value={formData.vendido_por_peso || 0} 
                      onChange={e => {
                        const vp = parseInt(e.target.value);
                        setFormData({
                          ...formData, 
                          vendido_por_peso: vp,
                          unidade_medida: vp === 1 ? 'kg' : 'un'
                        });
                      }}
                    >
                      <option value={0}>Não (Unidade Fechada)</option>
                      <option value={1}>Sim (Balança / Peso)</option>
                    </select>
                  </div>
                  <div className="input-group">
                    <label>Unidade de Medida</label>
                    <select 
                      className="input" 
                      value={formData.unidade_medida || 'un'} 
                      onChange={e => setFormData({...formData, unidade_medida: e.target.value})}
                      disabled={!formData.vendido_por_peso}
                    >
                      <option value="un">un (Unidade)</option>
                      <option value="kg" disabled={!formData.vendido_por_peso}>kg (Quilograma)</option>
                      <option value="g" disabled={!formData.vendido_por_peso}>g (Grama)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ gridColumn: 'span 2', borderTop: '1px solid var(--border-default)', paddingTop: '16px', marginTop: '8px' }}>
                <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: '700', marginBottom: '16px', letterSpacing: '0.5px' }}>Dados Fiscais (NFC-e)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="input-group">
                    <label>NCM</label>
                    <input type="text" className="input" maxLength={8} value={formData.ncm || ''} onChange={e => setFormData({...formData, ncm: e.target.value})} placeholder="Ex: 22021000" />
                  </div>
                  <div className="input-group">
                    <label>CFOP</label>
                    <input type="text" className="input" maxLength={4} value={formData.cfop || ''} onChange={e => setFormData({...formData, cfop: e.target.value})} placeholder="Ex: 5102" />
                  </div>
                  <div className="input-group">
                    <label>CST/CSOSN</label>
                    <input type="text" className="input" maxLength={4} value={formData.cst_csosn || ''} onChange={e => setFormData({...formData, cst_csosn: e.target.value})} placeholder="Ex: 102" />
                  </div>
                  <div className="input-group">
                    <label>Unidade Comercial</label>
                    <input type="text" className="input" maxLength={6} value={formData.unidade_comercial || ''} onChange={e => setFormData({...formData, unidade_comercial: e.target.value.toUpperCase()})} placeholder="Ex: UN, KG, LT" />
                  </div>
                </div>
              </div>

              <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-default)' }}>
                <button type="button" className="btn-outline" onClick={() => setModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn">Salvar Produto</button>
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
