import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { Plus, Check, X, Clock, Play, MessageCircle, ChevronLeft, ChevronRight, Eye, Calendar, Users, Trash2, UserPlus } from 'lucide-react';
import { calcularPrecoServico } from '../utils/precoHelpers';
import { gerarLinkConfirmacao } from '../utils/whatsappHelper';
import { useBranding } from '../context/BrandingContext';
import { useToast } from '../context/ToastContext';
import ModalConfirm from '../components/Common/ModalConfirm';

// Horários disponíveis (08:00 – 20:00)
const HORARIOS = [];
for (let h = 8; h <= 20; h++) {
  HORARIOS.push(`${String(h).padStart(2, '0')}:00`);
  if (h < 20) HORARIOS.push(`${String(h).padStart(2, '0')}:30`);
}

const STATUS_COLORS = {
  agendado: '#3f3f46',
  em_atendimento: '#F59E0B',
  finalizado: '#10B981',
  cancelado: '#EF4444',
  faltou: '#71717A'
};

const STATUS_LABELS = {
  agendado: 'Agendado',
  em_atendimento: 'Atendendo',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
  faltou: 'Faltou'
};

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date.toISOString().split('T')[0];
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function formatDateShort(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function Agenda() {
  const [agendamentos, setAgendamentos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [servicos, setServicos] = useState([]);
  const [pets, setPets] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const { branding } = useBranding();
  const { showToast } = useToast();
  const [modalConfirm, setModalConfirm] = useState({ isOpen: false, title: '', message: '', type: 'info', onConfirm: () => {} });

  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [viewMode, setViewMode] = useState('dia'); // 'dia' | 'semana'
  const [weekStart, setWeekStart] = useState(getMonday(todayStr));

  // Form
  const [showForm, setShowForm] = useState(false);
  const initialForm = { id: null, cliente_id: '', pet_id: '', servico_id: '', data: todayStr, hora: '09:00', observacoes: '', funcionario_id: '', duracao: 30 };
  const [formData, setFormData] = useState(initialForm);

  // Funcionário form
  const [showFuncForm, setShowFuncForm] = useState(false);
  const [funcFormData, setFuncFormData] = useState({ nome: '', cor: '#8257E5' });

  async function loadData() {
    const [cli, svc, func] = await Promise.all([
      api.clientes.getAll(),
      api.servicos.getAtivos(),
      api.funcionarios.getAll()
    ]);
    setClientes(cli);
    setServicos(svc);
    setFuncionarios(func);

    if (viewMode === 'dia') {
      const ag = await api.agenda.getByDate(selectedDate);
      setAgendamentos(ag || []);
    } else {
      const ag = await api.agenda.getByWeek(weekStart);
      setAgendamentos(ag || []);
    }
  }

  useEffect(() => { loadData(); }, [selectedDate, viewMode, weekStart]);

  // Pets by selected client
  useEffect(() => {
    if (formData.cliente_id) {
      api.pets.getByCliente(formData.cliente_id).then(p => setPets(p || []));
    } else {
      setPets([]);
    }
  }, [formData.cliente_id]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.cliente_id || !formData.pet_id || !formData.servico_id) return showToast('Preencha todos os campos obrigatórios!', 'warning');
    
    if (formData.id) {
      const res = await api.agenda.update(formData);
      if (!res.success) return showToast(res.message, 'error');
      showToast('Agendamento atualizado com sucesso!', 'success');
    } else {
      const res = await api.agenda.create(formData);
      if (!res.success) return showToast(res.message, 'error');
      showToast('Agendamento criado com sucesso!', 'success');
    }

    setFormData(initialForm);
    setShowForm(false);
    loadData();
  };

  const handleStatusChange = async (id, status) => {
    await api.agenda.updateStatus(id, status);
    loadData();
  };

  const handleWhatsApp = (agendamento) => {
    const tel = agendamento.cliente_telefone;
    if (!tel) return showToast('Cliente sem telefone cadastrado.', 'warning');
    const link = gerarLinkConfirmacao({
      telefone: tel,
      petNome: agendamento.pet_nome,
      data: agendamento.data,
      hora: agendamento.hora,
      servico: agendamento.servico_nome,
      nomeComercio: branding.nome_comercio
    });
    if (link) api.system.openExternal(link);
    else showToast('Telefone inválido.', 'error');
  };

  const handleSaveFuncionario = async (e) => {
    e.preventDefault();
    if (!funcFormData.nome) return showToast('Nome obrigatório.', 'warning');
    await api.funcionarios.create(funcFormData);
    setFuncFormData({ nome: '', cor: '#8257E5' });
    setShowFuncForm(false);
    loadData();
  };

  const handleDeleteFuncionario = async (id) => {
    setModalConfirm({
      isOpen: true,
      title: 'Inativar Funcionário',
      message: 'Desativar este funcionário?',
      type: 'danger',
      onConfirm: async () => {
        await api.funcionarios.delete(id);
        showToast('Funcionário desativado.', 'success');
        loadData();
      }
    });
  };

  // Week navigation
  const prevWeek = () => setWeekStart(addDays(weekStart, -7));
  const nextWeek = () => setWeekStart(addDays(weekStart, 7));
  const prevDay = () => setSelectedDate(addDays(selectedDate, -1));
  const nextDay = () => setSelectedDate(addDays(selectedDate, 1));

  // Week days array
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const StatusBadge = ({ status }) => (
    <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', backgroundColor: STATUS_COLORS[status] + '22', color: STATUS_COLORS[status], whiteSpace: 'nowrap' }}>
      {STATUS_LABELS[status] || status}
    </span>
  );

  // ── Renderização de um card de agendamento ──
  const AgendaCard = ({ a, compact = false }) => (
    <div style={{
      padding: compact ? '6px 8px' : '10px 12px',
      borderRadius: '8px',
      borderLeft: `3px solid ${a.funcionario_cor || STATUS_COLORS[a.status] || 'var(--primary)'}`,
      background: 'rgba(255,255,255,0.03)',
      fontSize: compact ? '11px' : '13px',
      transition: 'background 0.15s',
      cursor: 'default'
    }}
      onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
      onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
            {a.hora} — {a.pet_nome}
          </div>
          {!compact && (
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {a.cliente_nome} • {a.servico_nome}
              {a.funcionario_nome && <span style={{ color: a.funcionario_cor || 'var(--primary)' }}> • {a.funcionario_nome}</span>}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
          <StatusBadge status={a.status} />
          {!compact && (
            <>
              {a.status === 'agendado' && <button onClick={() => handleStatusChange(a.id, 'em_atendimento')} title="Iniciar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warning)', padding: '4px' }}><Play size={14} /></button>}
              {a.status === 'em_atendimento' && <button onClick={() => handleStatusChange(a.id, 'finalizado')} title="Finalizar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--success)', padding: '4px' }}><Check size={14} /></button>}
              {(a.status === 'agendado' || a.status === 'em_atendimento') && <button onClick={() => handleStatusChange(a.id, 'cancelado')} title="Cancelar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '4px' }}><X size={14} /></button>}
              {a.status === 'agendado' && <button onClick={() => handleWhatsApp(a)} title="WhatsApp" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#25D366', padding: '4px' }}><MessageCircle size={14} /></button>}
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* View Toggles */}
          <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: '8px', padding: '2px', border: '1px solid var(--border-color)' }}>
            <button onClick={() => setViewMode('dia')} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600', background: viewMode === 'dia' ? 'var(--primary)' : 'none', color: viewMode === 'dia' ? '#fff' : 'var(--text-secondary)', transition: 'all 0.2s' }}>
              <Calendar size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Dia
            </button>
            <button onClick={() => { setViewMode('semana'); setWeekStart(getMonday(selectedDate)); }} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600', background: viewMode === 'semana' ? 'var(--primary)' : 'none', color: viewMode === 'semana' ? '#fff' : 'var(--text-secondary)', transition: 'all 0.2s' }}>
              <Eye size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Semana
            </button>
          </div>

          {/* Date navigation */}
          {viewMode === 'dia' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button onClick={prevDay} className="btn-outline" style={{ padding: '6px 8px', border: 'none' }}><ChevronLeft size={18} /></button>
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="input" style={{ width: '160px', padding: '6px 10px' }} />
              <button onClick={nextDay} className="btn-outline" style={{ padding: '6px 8px', border: 'none' }}><ChevronRight size={18} /></button>
              <button onClick={() => setSelectedDate(todayStr)} className="btn-outline" style={{ fontSize: '12px', padding: '6px 12px' }}>Hoje</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button onClick={prevWeek} className="btn-outline" style={{ padding: '6px 8px', border: 'none' }}><ChevronLeft size={18} /></button>
              <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', padding: '0 8px' }}>
                {formatDateShort(weekStart)} — {formatDateShort(addDays(weekStart, 6))}
              </span>
              <button onClick={nextWeek} className="btn-outline" style={{ padding: '6px 8px', border: 'none' }}><ChevronRight size={18} /></button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-outline" onClick={() => setShowFuncForm(!showFuncForm)} style={{ fontSize: '13px', padding: '8px 12px' }}>
            <Users size={16} /> Funcionários
          </button>
          <button className="btn" onClick={() => { setFormData({ ...initialForm, data: selectedDate }); setShowForm(!showForm); }}>
            <Plus size={18} /> Novo Agendamento
          </button>
        </div>
      </div>

      {/* Funcionários mini-panel */}
      {showFuncForm && (
        <div className="card animate-fade" style={{ padding: '16px' }}>
          <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={16} /> Gerenciar Funcionários
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
            {funcionarios.map(f => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)' }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: f.cor, flexShrink: 0 }} />
                <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{f.nome}</span>
                <button onClick={() => handleDeleteFuncionario(f.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '2px' }}><Trash2 size={12} /></button>
              </div>
            ))}
            {funcionarios.length === 0 && <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Nenhum funcionário cadastrado.</span>}
          </div>
          <form onSubmit={handleSaveFuncionario} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <div className="input-group" style={{ flex: 1 }}>
              <label style={{ fontSize: '12px' }}>Nome</label>
              <input className="input" value={funcFormData.nome} onChange={e => setFuncFormData({ ...funcFormData, nome: e.target.value })} placeholder="Ex: Maria" />
            </div>
            <div className="input-group" style={{ width: '60px' }}>
              <label style={{ fontSize: '12px' }}>Cor</label>
              <input type="color" value={funcFormData.cor} onChange={e => setFuncFormData({ ...funcFormData, cor: e.target.value })} style={{ width: '100%', height: '38px', border: 'none', padding: 0, background: 'none', cursor: 'pointer' }} />
            </div>
            <button className="btn" style={{ padding: '8px 16px' }}><UserPlus size={16} /> Adicionar</button>
          </form>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="card animate-fade">
          <h3 style={{ marginBottom: '16px' }}>{formData.id ? 'Editar Agendamento' : 'Novo Agendamento'}</h3>
          <form onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <div className="input-group" style={{ gridColumn: 'span 3' }}>
              <label>Cliente (Tutor) *</label>
              <select required className="input" value={formData.cliente_id} onChange={e => setFormData({ ...formData, cliente_id: e.target.value, pet_id: '' })}>
                <option value="">-- Selecione --</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>

            <div className="input-group">
              <label>Pet *</label>
              <select required className="input" value={formData.pet_id} onChange={e => setFormData({ ...formData, pet_id: e.target.value })}>
                <option value="">-- Selecione --</option>
                {pets.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>

            <div className="input-group">
              <label>Serviço *</label>
              <select required className="input" value={formData.servico_id} onChange={e => setFormData({ ...formData, servico_id: e.target.value })}>
                <option value="">-- Selecione --</option>
                {servicos.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </div>

            <div className="input-group">
              <label>Funcionário</label>
              <select className="input" value={formData.funcionario_id} onChange={e => setFormData({ ...formData, funcionario_id: e.target.value })}>
                <option value="">-- Sem funcionário --</option>
                {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </div>

            <div className="input-group">
              <label>Data *</label>
              <input type="date" required className="input" value={formData.data} onChange={e => setFormData({ ...formData, data: e.target.value })} />
            </div>

            <div className="input-group">
              <label>Hora *</label>
              <select required className="input" value={formData.hora} onChange={e => setFormData({ ...formData, hora: e.target.value })}>
                {HORARIOS.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>

            <div className="input-group">
              <label>Duração (min)</label>
              <select className="input" value={formData.duracao} onChange={e => setFormData({ ...formData, duracao: parseInt(e.target.value) })}>
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>1 hora</option>
                <option value={90}>1h 30min</option>
                <option value={120}>2 horas</option>
              </select>
            </div>

            <div className="input-group" style={{ gridColumn: 'span 3' }}>
              <label>Observações</label>
              <input className="input" value={formData.observacoes} onChange={e => setFormData({ ...formData, observacoes: e.target.value })} />
            </div>

            <div style={{ gridColumn: 'span 3', display: 'flex', gap: '8px' }}>
              <button className="btn">Salvar Agendamento</button>
              <button type="button" className="btn-outline" onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* ─── VISÃO DIA ─── */}
      {viewMode === 'dia' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '15px' }}>
              Agenda — {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </h3>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{agendamentos.length} agendamento{agendamentos.length !== 1 ? 's' : ''}</span>
          </div>

          {funcionarios.length > 0 ? (
            /* Grid por funcionário */
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${funcionarios.length + 1}, 1fr)`, gap: '12px' }}>
              {/* Sem funcionário */}
              <div>
                <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', textAlign: 'center', padding: '8px', borderBottom: '2px solid var(--border-color)', marginBottom: '8px' }}>
                  Sem Responsável
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {agendamentos.filter(a => !a.funcionario_id).map(a => <AgendaCard key={a.id} a={a} />)}
                </div>
              </div>
              {funcionarios.map(f => (
                <div key={f.id}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: f.cor, textAlign: 'center', padding: '8px', borderBottom: `2px solid ${f.cor}`, marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: f.cor }} />
                    {f.nome}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {agendamentos.filter(a => a.funcionario_id === f.id).map(a => <AgendaCard key={a.id} a={a} />)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Lista simples (sem funcionários cadastrados) */
            agendamentos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                <Clock size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
                <div>Nenhum agendamento para este dia.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {agendamentos.map(a => <AgendaCard key={a.id} a={a} />)}
              </div>
            )
          )}
        </div>
      )}

      {/* ─── VISÃO SEMANA ─── */}
      {viewMode === 'semana' && (
        <div className="card" style={{ overflow: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(7, minmax(140px, 1fr))`, gap: '1px', background: 'var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
            {weekDays.map((day, i) => {
              const dayAgendas = agendamentos.filter(a => a.data === day);
              const isToday = day === todayStr;
              return (
                <div key={day} style={{ background: 'var(--bg-card)', minHeight: '200px', display: 'flex', flexDirection: 'column' }}>
                  {/* Day header */}
                  <div style={{
                    padding: '10px 8px',
                    textAlign: 'center',
                    borderBottom: '1px solid var(--border-color)',
                    background: isToday ? 'rgba(var(--primary-rgb),0.08)' : 'rgba(255,255,255,0.02)'
                  }}>
                    <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                      {DIAS_SEMANA[new Date(day + 'T12:00:00').getDay()]}
                    </div>
                    <div style={{
                      fontSize: '18px', fontWeight: '700',
                      color: isToday ? 'var(--primary)' : 'var(--text-primary)',
                      marginTop: '2px'
                    }}>
                      {day.split('-')[2]}
                    </div>
                  </div>
                  {/* Day content */}
                  <div style={{ padding: '6px', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {dayAgendas.length === 0 ? (
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'center', padding: '12px 0', opacity: 0.5 }}>—</div>
                    ) : (
                      dayAgendas.map(a => <AgendaCard key={a.id} a={a} compact />)
                    )}
                  </div>
                </div>
              );
            })}
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
