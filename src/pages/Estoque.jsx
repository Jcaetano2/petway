import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { PlusCircle, SlidersHorizontal, History, Search } from 'lucide-react';

export default function Estoque() {
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');

  // Modals state
  const [modalMode, setModalMode] = useState(null); // 'entrada', 'ajuste', 'historico' ou null
  const [selectedProduto, setSelectedProduto] = useState(null);
  
  // Form fields
  const [quantidade, setQuantidade] = useState('');
  const [motivo, setMotivo] = useState('');
  const [historico, setHistorico] = useState([]);
  const [errorPx, setErrorPx] = useState('');

  const loadProdutos = async () => {
    setLoading(true);
    const data = await api.produtos.getAll();
    // Apenas produtos ativos ou que tem estoque > 0
    const filtered = (data || []).filter(p => p.ativo === 1 || p.estoque > 0);
    setProdutos(filtered);
    setLoading(false);
  };

  useEffect(() => { loadProdutos(); }, []);

  const openModal = async (produto, mode) => {
    setErrorPx('');
    setSelectedProduto(produto);
    setModalMode(mode);
    setQuantidade('');
    setMotivo('');
    
    if (mode === 'historico') {
      const hist = await api.estoque.getMovimentacoes(produto.id);
      setHistorico(hist || []);
    } else if (mode === 'ajuste') {
      setQuantidade(produto.estoque);
    }
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedProduto(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorPx('');

    if (!motivo || motivo.trim() === '') {
      return setErrorPx('O motivo é obrigatório.');
    }

    const val = parseFloat(quantidade);
    
    if (modalMode === 'entrada' && (isNaN(val) || val <= 0)) {
      return setErrorPx('A quantidade de entrada deve ser maior que 0.');
    }
    
    // Permitir estoque 0 em ajustes, mas não negativo
    if (modalMode === 'ajuste' && (isNaN(val) || val < 0)) {
      return setErrorPx('A quantidade do ajuste não pode ser negativa.');
    }

    let res;
    if (modalMode === 'entrada') {
      res = await api.estoque.entrada({ produto_id: selectedProduto.id, quantidade: val, motivo });
    } else if (modalMode === 'ajuste') {
      res = await api.estoque.ajuste({ produto_id: selectedProduto.id, quantidade: val, motivo });
    }

    if (!res.success) {
      return setErrorPx(res.message);
    }

    closeModal();
    loadProdutos();
  };

  const filteredProdutos = produtos.filter(p => 
    p.nome.toLowerCase().includes(busca.toLowerCase()) || 
    (p.codigo_barras && p.codigo_barras.toLowerCase().includes(busca.toLowerCase()))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Controle de Estoque</h2>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div className="input-group" style={{ width: '400px', position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '34px', color: 'var(--text-secondary)' }} />
            <label>Buscar Produto no Estoque</label>
            <input 
              type="text" 
              className="input" 
              placeholder="Nome ou código..." 
              value={busca} 
              onChange={e => setBusca(e.target.value)} 
              style={{ paddingLeft: '38px' }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Produto</th>
                <th style={{ textAlign: 'center' }}>Estoque Atual</th>
                <th style={{ textAlign: 'center' }}>Estoque Mín.</th>
                <th style={{ width: '300px', textAlign: 'center' }}>Ações de Inventário</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="4" style={{ textAlign: 'center', padding: '24px' }}>Carregando...</td></tr>
              ) : filteredProdutos.length === 0 ? (
                <tr><td colSpan="4" style={{ textAlign: 'center', padding: '24px' }}>Nenhum produto em estoque encontrado.</td></tr>
              ) : (
                filteredProdutos.map(p => {
                  let badgeStyle = { background: 'rgba(var(--success-rgb), 0.1)', color: 'var(--success)' };
                  if (p.estoque <= 0) badgeStyle = { background: 'rgba(var(--danger-rgb), 0.1)', color: 'var(--danger)' };
                  else if (p.estoque <= p.estoque_minimo) badgeStyle = { background: 'rgba(var(--warning-rgb), 0.1)', color: 'var(--warning)' };

                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ fontWeight: '500' }}>{p.nome}</div>
                        {p.ativo === 0 && <span style={{ fontSize: '11px', color: 'var(--danger)' }}>(Inativo para Venda)</span>}
                      </td>
                      <td style={{ textAlign: 'center', fontSize: '16px', fontWeight: 'bold' }}>
                        <span style={{ padding: '4px 12px', borderRadius: '16px', ...badgeStyle }}>
                          {p.estoque}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{p.estoque_minimo}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          <button className="btn-outline" onClick={() => openModal(p, 'entrada')} title="Entrada" style={{ fontSize: '12px', padding: '6px 12px' }}><PlusCircle size={14} /> Entrada</button>
                          <button className="btn-outline" onClick={() => openModal(p, 'ajuste')} title="Ajuste Cego" style={{ fontSize: '12px', padding: '6px 12px' }}><SlidersHorizontal size={14} /> Ajustar</button>
                          <button className="btn-outline" onClick={() => openModal(p, 'historico')} title="Histórico" style={{ fontSize: '12px', padding: '6px 12px' }}><History size={14} /> Histórico</button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalMode && (modalMode === 'entrada' || modalMode === 'ajuste') && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card animate-fade" style={{ width: '450px' }}>
            <h2 style={{ marginBottom: '8px' }}>{modalMode === 'entrada' ? 'Nova Entrada' : 'Ajuste de Saldo Absoluto'}</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>Produto: <strong>{selectedProduto?.nome}</strong></p>
            
            {errorPx && (
              <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(255, 82, 82, 0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', fontSize: '13px', marginBottom: '16px' }}>
                {errorPx}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="input-group">
                <label>{modalMode === 'entrada' ? 'Quantidade de Entrada (Somar) *' : 'Novo Saldo Físico Real (Sobrescrever) *'}</label>
                <input type="number" step="0.01" required className="input" value={quantidade} onChange={e => setQuantidade(e.target.value)} />
              </div>
              
              <div className="input-group">
                <label>Motivo da Operação *</label>
                <input type="text" required className="input" placeholder="Ex: Compra NF 1234, Contagem Física..." value={motivo} onChange={e => setMotivo(e.target.value)} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button type="button" className="btn-outline" onClick={closeModal}>Cancelar</button>
                <button type="submit" className="btn">Confirmar Operação</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalMode === 'historico' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card animate-fade" style={{ width: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ margin: 0 }}>Kardex / Histórico</h2>
                <div style={{ color: 'var(--text-secondary)' }}>{selectedProduto?.nome}</div>
              </div>
              <button className="btn-outline" onClick={closeModal}>Fechar</button>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <table className="table" style={{ fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th>Data/Hora</th>
                    <th>Tipo</th>
                    <th>Qtd. Muv</th>
                    <th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.length === 0 ? (
                    <tr><td colSpan="4" style={{ textAlign: 'center', padding: '16px' }}>Nenhum registro.</td></tr>
                  ) : (
                    historico.map(h => {
                       const dataFormatada = new Date(h.created_at).toLocaleString('pt-BR');
                       let tColor = 'var(--text-primary)';
                       if (h.tipo === 'entrada') tColor = 'var(--success)';
                       if (h.tipo === 'saida') tColor = 'var(--danger)';
                       if (h.tipo === 'ajuste') tColor = 'var(--warning)';

                       return (
                         <tr key={h.id}>
                           <td>{dataFormatada}</td>
                           <td style={{ color: tColor, fontWeight: 'bold', textTransform: 'capitalize' }}>{h.tipo}</td>
                           <td>{h.tipo === 'saida' ? '-' : h.tipo === 'entrada' ? '+' : ''}{h.quantidade}</td>
                           <td>{h.motivo}</td>
                         </tr>
                       )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
