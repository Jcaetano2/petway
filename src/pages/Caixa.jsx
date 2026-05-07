import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { DollarSign, Archive, LogIn, Lock } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import ModalConfirm from '../components/Common/ModalConfirm';

export default function Caixa() {
  const [caixaAberto, setCaixaAberto] = useState(null);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [valorAbertura, setValorAbertura] = useState('');
  const [valorFechamento, setValorFechamento] = useState('');
  const { showToast } = useToast();
  const [modalConfirm, setModalConfirm] = useState({ isOpen: false, title: '', message: '', type: 'info', onConfirm: () => {} });

  const [showFechamento, setShowFechamento] = useState(false);

  async function loadCaixa() {
    setLoading(true);
    const cx = await api.caixa.getAberto();
    setCaixaAberto(cx);
    if (cx) {
      const movs = await api.caixa.getMovimentacoes(cx.id);
      setMovimentacoes(movs);
    }
    setLoading(false);
  }

  useEffect(() => { loadCaixa(); }, []);

  const handleAbrir = async (e) => {
    e.preventDefault();
    const val = parseFloat(valorAbertura) || 0;
    const res = await api.caixa.abrir({ valor_abertura: val });
    if (!res.success) {
      showToast(res.message, 'error');
      return;
    }
    showToast('Caixa aberto com sucesso!', 'success');
    setValorAbertura('');
    loadCaixa();
  };

  const handleFechar = async (e) => {
    e.preventDefault();
    const val = parseFloat(valorFechamento);
    if (isNaN(val)) {
      showToast('Informe o valor físico contado em caixa.', 'warning');
      return;
    }

    setModalConfirm({
      isOpen: true,
      title: 'Fechar Caixa',
      message: `Tem certeza que deseja fechar o caixa informando R$ ${val.toFixed(2)}?`,
      type: 'warning',
      onConfirm: async () => {
        const res = await api.caixa.fechar({ id: caixaAberto.id, valor_fechamento_informado: val });
        if (!res.success) {
          showToast(res.message, 'error');
        } else {
          showToast('Caixa fechado com sucesso!', 'success');
          setShowFechamento(false);
          setValorFechamento('');
          loadCaixa();
        }
      }
    });
  };

  if (loading) return <div>Carregando caixa...</div>;

  if (!caixaAberto) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', marginTop: '100px' }}>
        <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '40px', borderRadius: '16px', textAlign: 'center', width: '400px', border: '1px solid var(--border-color)' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(var(--primary-rgb), 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <Archive size={32} color="var(--primary)" />
          </div>
          <h2 style={{ marginBottom: '8px' }}>O Caixa está Fechado</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>Para realizar vendas e atendimentos, abra o seu turno.</p>
          
          <form onSubmit={handleAbrir} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="input-group" style={{ textAlign: 'left' }}>
              <label>Fundo de Troco Inicial (R$)</label>
              <input type="number" step="0.01" required className="input" value={valorAbertura} onChange={e => setValorAbertura(e.target.value)} placeholder="0.00" />
            </div>
            <button className="btn" type="submit" style={{ width: '100%', padding: '14px' }}>
               Abrir Caixa Agora
            </button>
          </form>
        </div>
      </div>
    );
  }

  const saldoEntradas = movimentacoes.filter(m => m.tipo === 'entrada').reduce((a, b) => a + b.valor, 0);
  const saldoSaidas = movimentacoes.filter(m => m.tipo === 'saida').reduce((a, b) => a + b.valor, 0);
  const saldoEsperado = (caixaAberto.valor_abertura || 0) + saldoEntradas - saldoSaidas;
  const diferenca = parseFloat(valorFechamento || 0) - saldoEsperado;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Painel do Caixa (# {caixaAberto.id})</h2>
        <button onClick={() => setShowFechamento(true)} className="btn-outline" style={{ border: '1px solid var(--danger)', color: 'var(--danger)' }}>
          <Lock size={18} /> Encerrar Turno
        </button>
      </div>

      {showFechamento && (
        <div className="card animate-fade" style={{ border: '1px solid var(--danger)' }}>
          <h3 style={{ marginBottom: '16px', color: 'var(--danger)' }}>Fechamento de Caixa</h3>
          <form onSubmit={handleFechar} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
             
             <div style={{ display: 'flex', gap: '16px' }}>
               <div className="input-group" style={{ flex: 1 }}>
                  <label>Valor Esperado (R$)</label>
                  <input type="text" readOnly className="input" value={saldoEsperado.toFixed(2)} style={{ backgroundColor: 'rgba(0,0,0,0.2)', color: 'var(--text-secondary)', cursor: 'not-allowed' }} />
               </div>

               <div className="input-group" style={{ flex: 1 }}>
                  <label>Valor em Caixa / Informado (R$)</label>
                  <input type="number" step="0.01" required className="input" value={valorFechamento} onChange={e => setValorFechamento(e.target.value)} placeholder="0.00" autoFocus />
               </div>

               <div className="input-group" style={{ flex: 1 }}>
                  <label>Diferença (R$)</label>
                  <input type="text" readOnly className="input" value={diferenca.toFixed(2)} style={{ backgroundColor: 'rgba(0,0,0,0.2)', color: diferenca === 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 'bold', cursor: 'not-allowed' }} />
               </div>
             </div>

             <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end', marginTop: '8px' }}>
               <button type="button" className="btn-outline" onClick={() => setShowFechamento(false)}>Cancelar</button>
               <button type="submit" className="btn" style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}>Confirmar Fechamento</button>
             </div>
          </form>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)', gap: '24px' }}>
        <div className="stat-card" style={{ padding: '24px', borderRadius: '16px', background: 'rgba(255, 255, 255, 0.05)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Fundo Inicial</span>
          <h2 style={{ fontSize: '28px', margin: 0 }}>R$ {caixaAberto.valor_abertura.toFixed(2)}</h2>
        </div>
        <div className="stat-card" style={{ padding: '24px', borderRadius: '16px', background: 'rgba(76, 175, 80, 0.1)', border: '1px solid var(--success)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ color: 'var(--success)' }}>Entradas (Suprimentos e Vendas)</span>
          <h2 style={{ fontSize: '28px', margin: 0, color: 'var(--success)' }}>+ R$ {saldoEntradas.toFixed(2)}</h2>
        </div>
         <div className="stat-card" style={{ padding: '24px', borderRadius: '16px', background: 'rgba(33, 150, 243, 0.1)', border: '1px solid var(--info)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ color: 'var(--info)' }}>Saldo Esperado em Gaveta</span>
          <h2 style={{ fontSize: '28px', margin: 0, color: 'var(--info)' }}>= R$ {saldoEsperado.toFixed(2)}</h2>
        </div>
      </div>

      <div className="card">
         <h4 style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>Extrato de Movimentações</h4>
         <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '12px 16px', fontWeight: '500' }}>Tipo</th>
              <th style={{ padding: '12px 16px', fontWeight: '500' }}>Descrição / Histórico</th>
              <th style={{ padding: '12px 16px', fontWeight: '500', textAlign: 'right' }}>Valor</th>
            </tr>
          </thead>
          <tbody>
            {movimentacoes.map(m => (
              <tr key={m.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '12px 16px' }}>
                  {m.tipo === 'entrada' ? <span style={{ color: 'var(--success)' }}>Entrada</span> : <span style={{ color: 'var(--danger)' }}>Saída</span>}
                </td>
                <td style={{ padding: '12px 16px', color: 'var(--text-primary)' }}>{m.descricao} {m.referencia_id ? `(#${m.referencia_id})` : ''}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right', color: m.tipo === 'entrada' ? 'var(--success)' : 'var(--danger)' }}>
                  {m.tipo === 'entrada' ? '+' : '-'} R$ {m.valor.toFixed(2)}
                </td>
              </tr>
            ))}
            {movimentacoes.length === 0 && <tr><td colSpan="3" style={{ padding: '16px', textAlign: 'center' }}>Nenhuma movimentação lançada neste turno.</td></tr>}
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
