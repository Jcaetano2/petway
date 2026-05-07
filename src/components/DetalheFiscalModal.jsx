import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { X, FileCheck, Printer, Eye, AlertTriangle, CheckCircle2, XCircle, Clock, RefreshCw } from 'lucide-react';
import { useToast } from '../context/ToastContext';

/**
 * Modal reutilizável de Detalhe Fiscal da Venda.
 * 
 * Props:
 *   vendaId - ID da venda
 *   isOpen - controle de visibilidade
 *   onClose - callback para fechar
 */
export default function DetalheFiscalModal({ vendaId, isOpen, onClose }) {
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();
  const [detalhe, setDetalhe] = useState(null);
  const [error, setError] = useState(null);
  const [danfePreview, setDanfePreview] = useState(null);
  const [printing, setPrinting] = useState(false);
  const [loadingDanfe, setLoadingDanfe] = useState(false);

  useEffect(() => {
    if (isOpen && vendaId) {
      loadDetalhe();
      setDanfePreview(null);
    }
  }, [isOpen, vendaId]);

  const loadDetalhe = async () => {
    setLoading(true);
    setError(null);
    const result = await api.fiscal.getDetalheByVenda(vendaId);
    if (result.success) {
      setDetalhe(result.data);
    } else {
      setError(result.error || 'Erro ao carregar detalhe fiscal.');
    }
    setLoading(false);
  };

  const handleVisualizarDanfe = async () => {
    setLoadingDanfe(true);
    const result = await api.fiscal.gerarDanfeHtml(vendaId);
    if (result.success) {
      setDanfePreview(result.html);
    } else {
      showToast(result.error || 'Erro ao gerar DANFE.', 'error');
    }
    setLoadingDanfe(false);
  };

  const handleImprimirDanfe = async () => {
    setPrinting(true);
    const result = await api.fiscal.printDanfe(vendaId);
    if (!result.success) {
      showToast(result.error || 'Falha na impressão do DANFE.', 'error');
    } else {
      showToast('DANFE enviado para impressão.', 'success');
    }
    setPrinting(false);
  };

  if (!isOpen) return null;

  const getStatusBadge = (status) => {
    const map = {
      autorizado: { color: 'var(--success)', bg: 'rgba(0, 200, 83, 0.1)', icon: CheckCircle2, label: 'Autorizada' },
      rejeitado: { color: 'var(--danger)', bg: 'rgba(255, 82, 82, 0.1)', icon: XCircle, label: 'Rejeitada' },
      erro_rede: { color: '#ff9800', bg: 'rgba(255, 152, 0, 0.1)', icon: AlertTriangle, label: 'Erro de Rede' },
      pendente_reenvio: { color: '#ffc107', bg: 'rgba(255, 193, 7, 0.1)', icon: Clock, label: 'Pendente Reenvio' },
      em_processamento: { color: 'var(--primary)', bg: 'rgba(var(--primary-rgb), 0.1)', icon: RefreshCw, label: 'Em Processamento' },
      nao_emitido: { color: 'var(--text-secondary)', bg: 'rgba(255,255,255,0.05)', icon: Clock, label: 'Não Emitida' },
    };
    const s = map[status] || map.nao_emitido;
    const Icon = s.icon;
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: '600', backgroundColor: s.bg, color: s.color }}>
        <Icon size={16} />
        {s.label}
      </span>
    );
  };

  const fiscal = detalhe?.fiscal;
  const venda = detalhe?.venda;
  const empresa = detalhe?.empresa;
  const isAutorizada = fiscal?.status_fiscal === 'autorizado';
  const isHomologacao = fiscal?.ambiente === 'homologacao';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99998, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div className="animate-fade" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '16px', width: danfePreview ? '1100px' : '640px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'width 0.3s ease' }}>
        
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <FileCheck size={22} color="var(--primary)" />
            <div>
              <h2 style={{ fontSize: '18px', color: 'var(--text-primary)', margin: 0 }}>Detalhe Fiscal — Venda #{vendaId}</h2>
              {isHomologacao && <span style={{ fontSize: '11px', color: '#ffc107', fontWeight: '600' }}>AMBIENTE DE HOMOLOGAÇÃO</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '8px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex' }}>
          
          {/* Left panel — Fiscal info */}
          <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
            
            {loading && <div style={{ color: 'var(--text-secondary)', padding: '24px', textAlign: 'center' }}>Carregando dados fiscais...</div>}
            
            {error && (
              <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: 'rgba(255, 82, 82, 0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', fontSize: '14px' }}>
                {error}
              </div>
            )}

            {fiscal && (
              <>
                {/* Status Badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {getStatusBadge(fiscal.status_fiscal)}
                </div>

                {/* Homologação warning */}
                {isHomologacao && isAutorizada && (
                  <div style={{ padding: '10px 16px', borderRadius: '8px', backgroundColor: 'rgba(255, 193, 7, 0.08)', border: '1px solid rgba(255, 193, 7, 0.3)', color: '#ffc107', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <AlertTriangle size={16} />
                    <span>Emitida em ambiente de homologação — sem valor fiscal.</span>
                  </div>
                )}

                {/* Data grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <InfoRow label="NFC-e Nº" value={fiscal.numero_nfce || '-'} />
                  <InfoRow label="Série" value={fiscal.serie_nfce || '-'} />
                  <InfoRow label="Data/Hora" value={fiscal.created_at ? new Date(fiscal.created_at).toLocaleString('pt-BR') : '-'} />
                  <InfoRow label="Protocolo" value={fiscal.protocolo || '-'} />
                </div>

                {fiscal.chave_acesso && (
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '700', marginBottom: '6px' }}>Chave de Acesso</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-primary)', wordBreak: 'break-all', fontFamily: 'monospace', padding: '10px', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-default)' }}>
                      {fiscal.chave_acesso.replace(/(.{4})/g, '$1 ').trim()}
                    </div>
                  </div>
                )}

                {/* Mensagem retorno */}
                {fiscal.mensagem_retorno && (
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '700', marginBottom: '6px' }}>Mensagem SEFAZ</div>
                    <div style={{ fontSize: '13px', color: isAutorizada ? 'var(--success)' : 'var(--danger)', padding: '10px', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-default)' }}>
                      {fiscal.mensagem_retorno}
                    </div>
                  </div>
                )}

                {/* Resumo da venda */}
                {venda && (
                  <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: '16px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '700', marginBottom: '12px' }}>Resumo da Venda</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <InfoRow label="Cliente" value={venda.cliente_nome || 'Consumidor'} />
                      {venda.pet_nome && <InfoRow label="Pet" value={venda.pet_nome} />}
                      <InfoRow label="Subtotal" value={`R$ ${parseFloat(venda.subtotal || 0).toFixed(2)}`} />
                      <InfoRow label="Total" value={`R$ ${parseFloat(venda.valor_total || 0).toFixed(2)}`} highlight />
                      <InfoRow label="Pagamento" value={(venda.forma_pagamento || '').toUpperCase()} />
                      <InfoRow label="Itens" value={`${(venda.itens || []).length} item(s)`} />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right panel — DANFE Preview */}
          {danfePreview && (
            <div style={{ width: '460px', borderLeft: '1px solid var(--border-default)', backgroundColor: '#f5f5f5', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #ddd', backgroundColor: '#e8e8e8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#333' }}>Pré-visualização DANFE</span>
                <button onClick={() => setDanfePreview(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#666', padding: '4px' }}>
                  <X size={16} />
                </button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', justifyContent: 'center' }}>
                <iframe
                  srcDoc={danfePreview}
                  style={{ width: '320px', minHeight: '600px', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#fff' }}
                  title="DANFE NFC-e Preview"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {fiscal && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-default)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            {isAutorizada && (
              <>
                <button 
                  className="btn-outline" 
                  onClick={handleVisualizarDanfe} 
                  disabled={loadingDanfe}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderColor: 'var(--primary)', color: 'var(--primary)', backgroundColor: 'transparent' }}
                >
                  {loadingDanfe ? <RefreshCw size={16} className="spin" /> : <Eye size={16} />}
                  Visualizar DANFE
                </button>
                <button 
                  className="btn" 
                  onClick={handleImprimirDanfe} 
                  disabled={printing}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}
                >
                  {printing ? <RefreshCw size={16} className="spin" /> : <Printer size={16} />}
                  Imprimir DANFE
                </button>
              </>
            )}
            <button className="btn-outline" onClick={onClose} style={{ padding: '10px 20px', borderColor: 'var(--border-default)', color: 'var(--text-secondary)', backgroundColor: 'transparent' }}>
              Fechar
            </button>
          </div>
        )}
      </div>

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

function InfoRow({ label, value, highlight }) {
  return (
    <div>
      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '700', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '14px', color: highlight ? 'var(--success)' : 'var(--text-primary)', fontWeight: highlight ? '700' : '500' }}>{value}</div>
    </div>
  );
}
