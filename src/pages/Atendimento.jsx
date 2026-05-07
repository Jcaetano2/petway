import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Play, Check, ShoppingCart, Clock, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { calcularPrecoServico } from '../utils/precoHelpers';
import { gerarLinkPetPronto } from '../utils/whatsappHelper';
import { useBranding } from '../context/BrandingContext';

export default function Atendimento() {
  const [agendamentos, setAgendamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { branding } = useBranding();
  const { showToast } = useToast();
  const [clientes, setClientes] = useState([]);

  async function loadData() {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const [data, cliData] = await Promise.all([
      api.agenda.getByDate(today),
      api.clientes.getAll()
    ]);
    // Show only the relevant states for Operational Clinic
    setAgendamentos(data.filter(a => a.status !== 'cancelado' && a.status !== 'faltou'));
    setClientes(cliData);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  const handleStart = async (agendaItem) => {
    // 1. Create Atendimento representation
    const resCreate = await api.atendimentos.create({
      agendamento_id: agendaItem.id,
      cliente_id: agendaItem.cliente_id,
      pet_id: agendaItem.pet_id,
      servico_id: agendaItem.servico_id,
      observacoes: agendaItem.observacoes
    });

    if (!resCreate.success) {
      showToast(resCreate.message || 'Erro ao criar tracking de atendimento.', 'error');
      return;
    }
    
    // 2. Start it
    const resStart = await api.atendimentos.start(resCreate.id);
    if (!resStart.success) {
      showToast(resStart.message, 'error');
      return;
    }
    loadData();
  };

  const handleFinish = async (agendaItem) => {
    // Need to find the active "atendimento" id
    const att = await api.atendimentos.getByAgendamento(agendaItem.id);
    if (!att) {
      showToast('Atendimento não encontrado no banco.', 'error');
      return;
    }
    
    const res = await api.atendimentos.finish(att.id);
    if (!res.success) {
      showToast(res.message, 'error');
      return;
    }
    loadData();
  };

  const handleSendToCaixa = async (agendaItem) => {
    const att = await api.atendimentos.getByAgendamento(agendaItem.id);
    if (!att) {
      showToast('Atendimento não encontrado no banco.', 'error');
      return;
    }

    // Create a pendent Venda
    const resVenda = await api.vendas.create({
      cliente_id: agendaItem.cliente_id,
      pet_id: agendaItem.pet_id,
      atendimento_id: att.id
    });

    if (!resVenda.success) {
      showToast(resVenda.message, 'error');
      return;
    }

    // Auto add the main service as the first item
    // Need price from DB
    const [servicos, pets] = await Promise.all([
      api.servicos.getAtivos(),
      api.pets.getAll()
    ]);
    const svc = servicos.find(s => s.id === agendaItem.servico_id);
    if (svc) {
      const pet = pets.find(p => p.id === agendaItem.pet_id);
      const precoCalculado = calcularPrecoServico(svc, pet?.porte);
      
      await api.vendas.addItem({
        venda_id: resVenda.id,
        tipo: 'servico',
        referencia_id: svc.id,
        descricao_snapshot: svc.nome,
        quantidade: 1,
        valor_unitario: precoCalculado
      });
    }

    // Go to PDV with this Venda active
    navigate('/pdv', { state: { vendaId: resVenda.id } });
  };

  const StatusBadge = ({ status }) => {
    const states = {
      agendado: { color: '--info', text: 'Aguardando' },
      em_atendimento: { color: '--warning', text: 'Atendendo' },
      finalizado: { color: '--success', text: 'Lib. Para Frente Caixa' },
      faturado: { color: '--text-secondary', text: 'Faturado / Concluído' } // Although it wouldn't show here usually, just in case
    };
    const s = states[status] || states.agendado;
    return (
      <span style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', backgroundColor: `rgba(var(${s.color}-rgb, 124, 77, 255), 0.1)`, color: `var(${s.color})`, whiteSpace: 'nowrap' }}>
        {s.text}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Atendimentos do Dia</h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {loading ? <div>Carregando...</div> : 
         agendamentos.length === 0 ? <div className="card" style={{textAlign: 'center', padding: '32px'}}>Nenhum paciente aguardando para hoje.</div> :
         agendamentos.map(a => (
          <div key={a.id} className="card animate-fade" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderLeft: a.status === 'em_atendimento' ? '4px solid var(--warning)' : '4px solid var(--bg-secondary)' }}>
            
            <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                {a.hora}
              </div>
              <div>
                <h3 style={{ margin: '0 0 4px 0' }}>{a.pet_nome} <span style={{fontWeight:'normal', fontSize: '14px', color:'var(--text-secondary)'}}>({a.cliente_nome})</span></h3>
                <div style={{ color: 'var(--primary)', fontWeight: '500', fontSize: '14px' }}>Serviço: {a.servico_nome}</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              <StatusBadge status={a.status} />

              <div style={{ display: 'flex', gap: '8px' }}>
                {a.status === 'agendado' && (
                  <button onClick={() => handleStart(a)} className="btn" style={{ background: 'var(--warning)', color: '#000', padding: '10px 16px' }}>
                    <Play size={18} /> Iniciar
                  </button>
                )}
                {a.status === 'em_atendimento' && (
                  <button onClick={() => handleFinish(a)} className="btn" style={{ background: 'var(--success)', padding: '10px 16px' }}>
                    <Check size={18} /> Finalizar
                  </button>
                )}
                {(a.status === 'finalizado' || a.status === 'faturado') && (
                  <>
                    {a.status === 'finalizado' && (
                      <button onClick={() => handleSendToCaixa(a)} className="btn" style={{ background: 'var(--primary)', padding: '10px 16px' }}>
                        <ShoppingCart size={18} /> Enviar para Caixa
                      </button>
                    )}
                    <button onClick={() => {
                      const cli = clientes.find(c => c.id === a.cliente_id);
                      if (!cli?.telefone) {
                        showToast('Cliente sem telefone cadastrado.', 'warning');
                        return;
                      }
                      const link = gerarLinkPetPronto({ telefone: cli.telefone, petNome: a.pet_nome, nomeComercio: branding.nome_comercio });
                      if (link) api.system.openExternal(link);
                      else showToast('Telefone inválido.', 'error');
                    }} title="Avisar Pet Pronto via WhatsApp" style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid rgba(37,211,102,0.3)', background: 'rgba(37,211,102,0.1)', color: '#25D366', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600' }}>
                      <MessageCircle size={16} /> Pet Pronto
                    </button>
                  </>
                )}
                {a.status === 'faturado' && (
                  <span style={{ color: 'var(--text-secondary)' }}><Check size={18}/> Faturado</span>
                )}
              </div>
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}
