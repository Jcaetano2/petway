import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { AlertCircle, RefreshCw, Send, CheckCircle2, Clock, Eye } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import DetalheFiscalModal from '../components/DetalheFiscalModal';

export default function PendenciasFiscais() {
  const [pendentes, setPendentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reprocessing, setReprocessing] = useState(false);
  const [reprocessId, setReprocessId] = useState(null);
  const [modalVendaId, setModalVendaId] = useState(null);
  const { showToast } = useToast();

  const loadData = async () => {
    setLoading(true);
    const data = await api.fiscal.getPendentes();
    setPendentes(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      if (!reprocessing && !reprocessId) loadData();
    }, 30000);
    return () => clearInterval(interval);
  }, [reprocessing, reprocessId]);

  const handleReprocessarTodas = async () => {
    setReprocessing(true);
    const result = await api.fiscal.reprocessarPendentes();
    if (result.success) {
      showToast(result.message, 'success');
    } else {
      showToast('Aviso: ' + result.message, 'warning');
    }
    await loadData();
    setReprocessing(false);
  };

  const handleReenviar = async (id) => {
    setReprocessId(id);
    const result = await api.fiscal.reenviarUnico(id);
    if (result.success) {
      showToast(result.message, 'success');
    } else {
      showToast(result.error || 'Erro desconhecido', 'error');
    }
    await loadData();
    setReprocessId(null);
  };

  if (loading && !pendentes.length) return <div style={{ padding: '24px', color: 'var(--text-secondary)' }}>Carregando fila fiscal...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle color="var(--warning)" /> Pendências Fiscais
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>NFC-es que falharam por instabilidade de rede ou da SEFAZ aguardando reprocessamento.</p>
        </div>
        <button 
          className="btn" 
          onClick={handleReprocessarTodas} 
          disabled={reprocessing || pendentes.length === 0}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: pendentes.length === 0 ? 0.5 : 1 }}
        >
          <RefreshCw size={18} className={reprocessing ? 'spin' : ''} />
          {reprocessing ? 'Processando Fila...' : 'Reprocessar Todas'}
        </button>
      </div>

      <div className="card" style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-default)', zIndex: 10 }}>
            <tr>
              <th style={thStyle}>Venda</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>NFC-e</th>
              <th style={thStyle}>Valor</th>
              <th style={thStyle}>Detalhes</th>
              <th style={{ ...thStyle, width: '200px' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {pendentes.map((nota) => {
              const isErroRede = nota.status_fiscal === 'erro_rede';
              const statusColor = isErroRede ? '#ff9800' : '#ffc107';
              const statusBg = isErroRede ? 'rgba(255, 152, 0, 0.1)' : 'rgba(255, 193, 7, 0.1)';
              
              return (
                <tr key={nota.id} style={{ borderBottom: '1px solid var(--border-default)' }}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '15px' }}>#{nota.venda_id}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      {new Date(nota.created_at).toLocaleString()}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '600',
                      backgroundColor: statusBg, color: statusColor
                    }}>
                      <Clock size={14} />
                      {isErroRede ? 'Erro de Rede' : 'Pendente API'}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, fontSize: '14px', color: 'var(--text-primary)' }}>
                    <div>Série: {nota.serie_nfce}</div>
                    <div>Nº: {nota.numero_nfce}</div>
                  </td>
                  <td style={{ ...tdStyle, fontSize: '14px', color: 'var(--text-primary)', fontWeight: '500' }}>
                    R$ {(nota.valor_total || 0).toFixed(2)}
                  </td>
                  <td style={tdStyle}>
                    <div style={{ fontSize: '13px', color: 'var(--danger)', marginBottom: '4px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={nota.mensagem_retorno}>
                      {nota.mensagem_retorno || 'Aguardando processamento'}
                    </div>
                    {nota.tentativas > 0 && (
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Tentativas: {nota.tentativas} | Última: {new Date(nota.ultima_tentativa).toLocaleTimeString()}
                      </div>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button 
                        className="btn-outline"
                        onClick={() => setModalVendaId(nota.venda_id)}
                        style={smallBtnStyle('#8D8D99')}
                        title="Ver Detalhe Fiscal"
                      >
                        <Eye size={14} /> Detalhe
                      </button>
                      <button 
                        className="btn-outline"
                        onClick={() => handleReenviar(nota.id)}
                        disabled={reprocessing || reprocessId === nota.id}
                        style={smallBtnStyle('var(--primary)')}
                      >
                        {reprocessId === nota.id ? <RefreshCw size={14} className="spin" /> : <Send size={14} />}
                        Reenviar
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            
            {pendentes.length === 0 && (
              <tr>
                <td colSpan="6" style={{ padding: '60px 24px', textAlign: 'center' }}>
                  <CheckCircle2 size={48} color="var(--success)" style={{ opacity: 0.5, margin: '0 auto 16px auto', display: 'block' }} />
                  <div style={{ fontSize: '16px', color: 'var(--text-primary)', fontWeight: '500' }}>Fila Limpa</div>
                  <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '8px' }}>Não há notas pendentes de envio no momento.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Modal de Detalhe Fiscal */}
      <DetalheFiscalModal 
        vendaId={modalVendaId} 
        isOpen={!!modalVendaId} 
        onClose={() => setModalVendaId(null)} 
      />

      <style>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const thStyle = { padding: '16px 24px', color: 'var(--text-secondary)', fontWeight: '600', fontSize: '13px', textTransform: 'uppercase' };
const tdStyle = { padding: '16px 24px' };

function smallBtnStyle(color) {
  return {
    borderColor: color,
    color: color,
    padding: '5px 10px',
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '12px',
    backgroundColor: 'transparent',
    whiteSpace: 'nowrap'
  };
}
