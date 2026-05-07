import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../services/api';
import { CalendarDays, Clock, CheckCircle2, CalendarX2, DollarSign, TrendingUp, ShoppingBag, Users, MessageCircle, ArrowUpRight, BarChart3, PieChart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BrandLogo from '../components/Branding/BrandLogo';
import { useBranding } from '../context/BrandingContext';
import { useToast } from '../context/ToastContext';
import { gerarLinkLembrete } from '../utils/whatsappHelper';

// ── Helpers de formatação ─────────────────────────────────────────
const fmt = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d) => { try { const [y, m, dd] = d.split('-'); return `${dd}/${m}`; } catch { return d; } };

// ── Componente de Gráfico de Barras (Canvas) ──────────────────────
function BarChartCanvas({ data, width = 400, height = 200 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data || data.length === 0) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const padding = { top: 20, right: 16, bottom: 40, left: 60 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;
    const maxVal = Math.max(...data.map(d => d.total), 1);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartH / 4) * i;
      ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(width - padding.right, y); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(fmt(maxVal - (maxVal / 4) * i).replace('R$\u00a0', ''), padding.left - 8, y + 4);
    }

    // Bars
    const barW = Math.min(chartW / data.length * 0.6, 48);
    const gap = chartW / data.length;
    const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
    gradient.addColorStop(0, 'rgba(130, 87, 229, 0.9)');
    gradient.addColorStop(1, 'rgba(130, 87, 229, 0.3)');

    data.forEach((d, i) => {
      const x = padding.left + gap * i + (gap - barW) / 2;
      const barH = (d.total / maxVal) * chartH;
      const y = padding.top + chartH - barH;

      ctx.fillStyle = gradient;
      ctx.beginPath();
      const r = 4;
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + barW - r, y);
      ctx.quadraticCurveTo(x + barW, y, x + barW, y + r);
      ctx.lineTo(x + barW, y + barH);
      ctx.lineTo(x, y + barH);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.fill();

      // Label
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(fmtDate(d.data), x + barW / 2, height - padding.bottom + 20);
    });
  }, [data, width, height]);

  return <canvas ref={canvasRef} style={{ width, height, display: 'block' }} />;
}

// ── Componente de Gráfico Pizza (Canvas) ──────────────────────────
function PieChartCanvas({ data, width = 220, height = 220 }) {
  const canvasRef = useRef(null);
  const colors = ['#8257E5', '#10B981', '#F59E0B', '#EF4444', '#6366F1'];
  const labels = { dinheiro: 'Dinheiro', pix: 'Pix', cartao: 'Cartão', credito: 'Crédito', debito: 'Débito' };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data || data.length === 0) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const total = data.reduce((s, d) => s + d.count, 0);
    if (total === 0) return;

    const cx = width / 2, cy = height / 2, radius = Math.min(cx, cy) - 16;
    let startAngle = -Math.PI / 2;

    data.forEach((d, i) => {
      const slice = (d.count / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, startAngle + slice);
      ctx.closePath();
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
      startAngle += slice;
    });

    // Inner circle (donut)
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = 'var(--bg-card, #202024)';
    ctx.fill();

    // Center text
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(total, cx, cy + 2);
    ctx.font = '11px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText('vendas', cx, cy + 18);
  }, [data, width, height]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
      <canvas ref={canvasRef} style={{ width, height }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: colors[i % colors.length], flexShrink: 0 }} />
            <span style={{ color: 'var(--text-secondary)' }}>{labels[d.forma_pagamento] || d.forma_pagamento}</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: '600', marginLeft: 'auto' }}>{fmt(d.total)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Dashboard Principal ───────────────────────────────────────────
export default function Dashboard() {
  const [stats, setStats] = useState({});
  const [agendamentos, setAgendamentos] = useState([]);
  const [clientesRetorno, setClientesRetorno] = useState([]);
  const [loading, setLoading] = useState(true);
  const { branding } = useBranding();
  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchDashboard() {
      setLoading(true);
      const [data, today] = await Promise.all([
        api.dashboard.getStats(),
        new Date().toISOString().split('T')[0]
      ]);
      setStats(data || {});

      const [agendaHoje, retorno] = await Promise.all([
        api.agenda.getByDate(today),
        api.dashboard.getClientesRetorno()
      ]);
      if (agendaHoje) setAgendamentos(agendaHoje.slice(0, 8));
      setClientesRetorno(retorno || []);
      setLoading(false);
    }
    fetchDashboard();
  }, []);

  const handleWhatsAppRetorno = useCallback((item) => {
    const link = gerarLinkLembrete({
      telefone: item.telefone,
      petNome: item.pet_nome,
      diasSemVisita: item.dias_sem_visita,
      nomeComercio: branding.nome_comercio
    });
    if (link) api.system.openExternal(link);
    else showToast('Telefone inválido ou não cadastrado para este cliente.', 'error');
  }, [branding.nome_comercio]);

  const StatusBadge = ({ status }) => {
    const states = {
      agendado: { color: 'info', text: 'Agendado' },
      em_atendimento: { color: 'warning', text: 'Em Andamento' },
      finalizado: { color: 'success', text: 'Finalizado' },
      cancelado: { color: 'danger', text: 'Cancelado' },
      faltou: { color: 'default', text: 'Faltou' }
    };
    const s = states[status] || states.agendado;
    return <span className={`badge ${s.color}`}>{s.text}</span>;
  };

  // Style helpers
  const kpiCard = (icon, label, value, color, bgColor) => (
    <div className="stat-card" style={{ position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -8, right: -8, width: 64, height: 64, borderRadius: '50%', background: bgColor, opacity: 0.08 }} />
      <div className="stat-card-title">
        <div style={{ padding: '8px', background: bgColor, borderRadius: '8px', color }}>
          {icon}
        </div>
        {label}
      </div>
      <div className="stat-card-value">{value}</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Banner de Boas-Vindas com Branding */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '20px',
        padding: '24px', borderRadius: '16px',
        background: 'linear-gradient(135deg, rgba(var(--primary-rgb),0.12) 0%, rgba(var(--primary-rgb),0.04) 100%)',
        border: '1px solid rgba(var(--primary-rgb),0.2)',
      }}>
        <BrandLogo size="md" logoPath={branding.logo_path} logoTs={branding.logoTs} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
            {branding.nome_comercio || 'Bem-vindo ao PetWay'}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: '500' }}>
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn" onClick={() => navigate('/agenda')} style={{ fontSize: '13px', padding: '8px 16px' }}>
            <CalendarDays size={16} /> Agenda
          </button>
          <button className="btn-outline" onClick={() => navigate('/pdv')} style={{ fontSize: '13px', padding: '8px 16px' }}>
            <ShoppingBag size={16} /> PDV
          </button>
        </div>
      </div>

      {/* KPIs Financeiros */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {kpiCard(<DollarSign size={20} />, 'Faturamento Dia', fmt(stats.faturamentoDia), '#10B981', 'rgba(16, 185, 129, 0.15)')}
        {kpiCard(<TrendingUp size={20} />, 'Faturamento Mês', fmt(stats.faturamentoMes), '#8257E5', 'rgba(130, 87, 229, 0.15)')}
        {kpiCard(<ShoppingBag size={20} />, 'Ticket Médio', fmt(stats.ticketMedio), '#F59E0B', 'rgba(245, 158, 11, 0.15)')}
        {kpiCard(<Users size={20} />, 'Atendimentos Hoje', stats.atendimentosDia || 0, '#6366F1', 'rgba(99, 102, 241, 0.15)')}
      </div>

      {/* KPIs de Agenda */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {kpiCard(<CalendarDays size={20} />, 'Agendamentos Hoje', stats.agendamentosHoje || 0, 'var(--primary)', 'rgba(var(--primary-rgb),0.15)')}
        {kpiCard(<Clock size={20} />, 'Em Atendimento', stats.emAndamento || 0, 'var(--warning)', 'rgba(245, 158, 11, 0.15)')}
        {kpiCard(<CheckCircle2 size={20} />, 'Finalizados', stats.finalizados || 0, 'var(--success)', 'rgba(16, 185, 129, 0.15)')}
      </div>

      {/* Gráficos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '16px' }}>
        {/* Vendas últimos 7 dias */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <BarChart3 size={18} color="var(--primary)" />
            <h3 style={{ margin: 0, fontSize: '15px' }}>Vendas — Últimos 7 dias</h3>
          </div>
          {stats.vendasPorDia && stats.vendasPorDia.length > 0 ? (
            <BarChartCanvas data={stats.vendasPorDia} width={520} height={220} />
          ) : (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
              Nenhuma venda registrada nos últimos 7 dias
            </div>
          )}
        </div>

        {/* Formas de pagamento */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <PieChart size={18} color="var(--primary)" />
            <h3 style={{ margin: 0, fontSize: '15px' }}>Formas de Pagamento</h3>
          </div>
          {stats.formasPagamento && stats.formasPagamento.length > 0 ? (
            <PieChartCanvas data={stats.formasPagamento} width={160} height={160} />
          ) : (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
              Sem dados para o mês atual
            </div>
          )}
        </div>
      </div>

      {/* Rankings */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Top Produtos */}
        <div className="card">
          <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShoppingBag size={18} color="var(--primary)" /> Top Produtos do Mês
          </h3>
          {stats.topProdutos && stats.topProdutos.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {stats.topProdutos.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)' }}>
                  <span style={{ width: 24, height: 24, borderRadius: '6px', background: 'rgba(var(--primary-rgb),0.15)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>{i + 1}</span>
                  <span style={{ flex: 1, fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>{p.nome}</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{p.qtd}x</span>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--success)' }}>{fmt(p.total)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>Sem vendas de produtos este mês</div>
          )}
        </div>

        {/* Top Serviços */}
        <div className="card">
          <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} color="var(--primary)" /> Top Serviços do Mês
          </h3>
          {stats.topServicos && stats.topServicos.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {stats.topServicos.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)' }}>
                  <span style={{ width: 24, height: 24, borderRadius: '6px', background: 'rgba(var(--primary-rgb),0.15)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>{i + 1}</span>
                  <span style={{ flex: 1, fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>{s.nome}</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{s.qtd}x</span>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--success)' }}>{fmt(s.total)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>Sem vendas de serviços este mês</div>
          )}
        </div>
      </div>

      {/* Clientes para Retorno (Lembretes) */}
      {clientesRetorno.length > 0 && (
        <div className="card" style={{ borderLeft: '3px solid var(--warning)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={18} color="var(--warning)" /> Clientes para Retorno
            </h3>
            <span style={{ fontSize: '12px', background: 'rgba(245,158,11,0.1)', padding: '4px 10px', borderRadius: '12px', fontWeight: '600', color: 'var(--warning)' }}>
              {clientesRetorno.length} pendente{clientesRetorno.length > 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {clientesRetorno.slice(0, 8).map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', transition: 'background 0.2s' }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--warning)', fontWeight: 'bold', fontSize: '14px', flexShrink: 0 }}>
                  {item.cliente_nome?.charAt(0) || '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{item.cliente_nome}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>🐾 {item.pet_nome} • {item.dias_sem_visita} dias sem visita</div>
                </div>
                {item.telefone && (
                  <button
                    onClick={() => handleWhatsAppRetorno(item)}
                    title="Enviar lembrete via WhatsApp"
                    style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(37,211,102,0.3)', background: 'rgba(37,211,102,0.1)', color: '#25D366', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600', transition: 'all 0.2s' }}
                    onMouseOver={e => { e.currentTarget.style.background = 'rgba(37,211,102,0.2)'; }}
                    onMouseOut={e => { e.currentTarget.style.background = 'rgba(37,211,102,0.1)'; }}
                  >
                    <MessageCircle size={14} /> WhatsApp
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Próximos Agendamentos */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h3 style={{ margin: '0 0 4px 0' }}>Próximos Agendamentos</h3>
            <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Acompanhe a agenda do dia e clientes aguardando.</div>
          </div>
          <button className="btn-outline" onClick={() => navigate('/agenda')}>Ver Agenda Completa</button>
        </div>

        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>Carregando...</div>
        ) : agendamentos.length === 0 ? (
          <div className="empty-state">
            <CalendarX2 size={48} className="empty-state-icon" />
            <h3>Nenhum agendamento hoje</h3>
            <p>Sua agenda está livre no momento. Você verá clientes aguardando aqui.</p>
            <button className="btn-outline" style={{ marginTop: '16px' }} onClick={() => navigate('/agenda')}>Criar Novo Agendamento</button>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Horário</th>
                  <th>Paciente (Tutor)</th>
                  <th>Serviço</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {agendamentos.map(a => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{a.hora}</td>
                    <td>
                      <div style={{ fontWeight: '500' }}>{a.pet_nome}</div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>{a.cliente_nome}</div>
                    </td>
                    <td>{a.servico_nome}</td>
                    <td><StatusBadge status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
