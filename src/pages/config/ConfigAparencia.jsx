import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';
import {
  Eye, RotateCcw, Store, AlertTriangle, Printer,
  Palette, CheckCircle, Image, Upload, Trash2, Save
} from 'lucide-react';
import BrandLogo from '../../components/Branding/BrandLogo';
import { useBranding } from '../../context/BrandingContext';
import { useToast } from '../../context/ToastContext';
import ModalConfirm from '../../components/Common/ModalConfirm';

// ── Presets de tema ────────────────────────────────────────────────────────────
const TEMA_PADRAO = {
  cor_primaria: '#8257E5',
  cor_secundaria: '#202024',
  cor_destaque: '#9466FF',
  cor_fundo: '#121214',
  cor_card: '#202024',
  cor_texto: '#FFFFFF',
  cor_texto_secundario: '#A1A1AA',
};

const TEMAS_PRESET = {
  escuro: TEMA_PADRAO,
  claro: {
    cor_primaria: '#6C3BD0',
    cor_secundaria: '#F4F4F5',
    cor_destaque: '#7C4DFF',
    cor_fundo: '#FAFAFA',
    cor_card: '#FFFFFF',
    cor_texto: '#18181B',
    cor_texto_secundario: '#71717A',
  },
};

const COLOR_FIELDS = [
  { key: 'cor_primaria',          label: 'Cor Primária (Botões)' },
  { key: 'cor_secundaria',        label: 'Cor Secundária' },
  { key: 'cor_destaque',          label: 'Cor de Destaque (Hover)' },
  { key: 'cor_fundo',             label: 'Cor de Fundo' },
  { key: 'cor_card',              label: 'Cor dos Cards' },
  { key: 'cor_texto',             label: 'Cor do Texto Padrão' },
  { key: 'cor_texto_secundario',  label: 'Cor do Texto Auxiliar' },
];

// Validação mínima de imagem no frontend via canvas/Image
const MIN_DIM = 100;

function validateLogoFile(file) {
  return new Promise((resolve) => {
    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(file.type)) {
      return resolve({ ok: false, msg: 'Formato inválido. Aceitos: PNG, JPG, JPEG, WEBP.' });
    }
    if (file.size > 2 * 1024 * 1024) {
      return resolve({ ok: false, msg: 'Arquivo excede 2 MB. Por favor, redimensione a imagem.' });
    }
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (img.width < MIN_DIM || img.height < MIN_DIM) {
        return resolve({ ok: false, msg: `Imagem muito pequena (${img.width}×${img.height}). Mínimo: ${MIN_DIM}×${MIN_DIM} px.` });
      }
      resolve({ ok: true });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ ok: false, msg: 'Não foi possível ler a imagem. Verifique o arquivo.' });
    };
    img.src = url;
  });
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function ConfigAparencia() {
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState('');
  const [logoError, setLogoError] = useState('');
  const dropRef = useRef(null);
  const { refreshBranding } = useBranding();
  const { showToast } = useToast();
  const [logoTs, setLogoTs] = useState(Date.now());
  const [modalConfirm, setModalConfirm] = useState({ isOpen: false, title: '', message: '', type: 'info', onConfirm: () => {} });

  const defaultConfig = {
    tema: 'escuro',
    ...TEMA_PADRAO,
    logo_path: null,
    nome_comercio: '',
    exibir_logo_cupom: 1,
  };

  const [config, setConfig] = useState(defaultConfig);

  useEffect(() => {
    async function load() {
      const data = await api.config.aparencia.get();
      if (data && data.id) setConfig({ ...defaultConfig, ...data });
      setLoading(false);
    }
    load();
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  const handleChange = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleTemaSelect = (tema) => {
    if (tema === 'personalizado') {
      handleChange('tema', 'personalizado');
      return;
    }
    const preset = TEMAS_PRESET[tema];
    if (preset) setConfig(prev => ({ ...prev, tema, ...preset }));
  };

  // Reset de APENAS cores/tema — preserva nome_comercio e logo
  const handleResetTema = () => {
    setModalConfirm({
      isOpen: true,
      title: 'Restaurar Tema',
      message: 'Restaurar todas as cores para o padrão Escuro Premium? Sua logo e nome do comércio serão mantidos.',
      type: 'warning',
      onConfirm: () => {
        setConfig(prev => ({
          ...prev,
          tema: 'escuro',
          ...TEMA_PADRAO,
        }));
        showToast('Tema restaurado. Salve para aplicar.', 'info');
      }
    });
  };

  // ── Logo ──────────────────────────────────────────────────────────────────
  const handleSelecionarLogo = async () => {
    setLogoError('');
    const res = await api.sistema.selecionarLogo();
    if (res.success) {
      handleChange('logo_path', res.logoPath);
      setLogoTs(Date.now()); // invalida cache
    } else if (res.message) {
      setLogoError(res.message);
    }
  };

  const handleRemoverLogo = () => {
    handleChange('logo_path', null);
    setLogoTs(Date.now());
  };

  // ── Salvar ────────────────────────────────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    const res = await api.config.aparencia.save(config);
    if (res.success) {
      applyTheme(config);
      await refreshBranding(); // Propaga logo/nome para Sidebar, Dashboard, PDV em tempo real
      showToast('Aparência aplicada com sucesso!', 'success');
    } else {
      showToast('Erro ao salvar aparência. Tente novamente.', 'error');
    }
    setSaving(false);
  };

  // URL segura para o renderer via protocolo customizado
  const logoUrl = config.logo_path
    ? `brand-logo://${config.logo_path}?t=${logoTs}`
    : null;

  if (loading) return (
    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
      Carregando configurações...
    </div>
  );

  return (
    <div className="card animate-fade">
      {/* ── Cabeçalho ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
          <Palette size={22} color="var(--primary)" /> Aparência e Branding
        </h2>
        {msg && (
          <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '600' }}>
            <CheckCircle size={18} /> {msg}
          </span>
        )}
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* ── 1. Nome do Comércio ──────────────────────────────────────────── */}
        <Section icon={<Store size={18} />} title="Nome do Comércio">
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            Usado no PDV, Dashboard e no cabeçalho do cupom de venda.
          </p>
          <input
            type="text"
            className="input"
            placeholder="Ex: PetShop Amigo Animal"
            value={config.nome_comercio || ''}
            onChange={e => handleChange('nome_comercio', e.target.value)}
            maxLength={80}
          />
        </Section>

        {/* ── 2. Tema ─────────────────────────────────────────────────────── */}
        <Section
          icon={<Palette size={18} />}
          title="Tema Base"
          action={
            <button type="button" onClick={handleResetTema} className="btn-outline"
              style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <RotateCcw size={14} /> Resetar Cores
            </button>
          }
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            {['escuro', 'claro', 'personalizado'].map(t => {
              const isActive = config.tema === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleTemaSelect(t)}
                  style={{
                    padding: '16px 12px', borderRadius: '10px', cursor: 'pointer',
                    border: isActive ? '2px solid var(--primary)' : '1px solid var(--border-default)',
                    backgroundColor: isActive ? 'rgba(var(--primary-rgb),0.1)' : 'var(--bg-primary)',
                    color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                    fontWeight: isActive ? '700' : '500',
                    transition: 'all 0.2s',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
                  }}
                >
                  <div style={{
                    width: '52px', height: '34px', borderRadius: '7px',
                    background:
                      t === 'escuro' ? 'linear-gradient(135deg, #121214 0%, #8257E5 100%)' :
                      t === 'claro'  ? 'linear-gradient(135deg, #FAFAFA 0%, #6C3BD0 100%)' :
                      'linear-gradient(135deg, #8257E5 0%, #F59E0B 50%, #10B981 100%)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }} />
                  <span style={{ fontSize: '13px', textTransform: 'capitalize' }}>{t}</span>
                </button>
              );
            })}
          </div>
        </Section>

        {/* ── 3. Paleta de Cores ──────────────────────────────────────────── */}
        <Section icon={<Palette size={18} />} title={
          <span>Paleta de Cores {config.tema !== 'personalizado' && (
            <span style={{ fontSize: '12px', fontWeight: '400', color: 'var(--text-secondary)' }}>
              — selecione "Personalizado" para editar livremente
            </span>
          )}</span>
        }>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {COLOR_FIELDS.map(f => (
              <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: '12px',
                padding: '10px 14px', borderRadius: '8px',
                backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-default)' }}>
                <input
                  type="color"
                  value={config[f.key] || '#000000'}
                  onChange={e => {
                    handleChange(f.key, e.target.value);
                    if (config.tema !== 'personalizado') handleChange('tema', 'personalizado');
                  }}
                  disabled={config.tema !== 'personalizado'}
                  style={{
                    width: '38px', height: '38px', border: 'none', padding: '2px',
                    borderRadius: '8px', cursor: config.tema === 'personalizado' ? 'pointer' : 'not-allowed',
                    background: 'transparent', flexShrink: 0,
                  }}
                />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{f.label}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace', marginTop: '2px' }}>
                    {config[f.key]}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── 4. Logo ─────────────────────────────────────────────────────── */}
        <Section icon={<Image size={18} />} title="Logo do Comércio">
          {logoError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px',
              backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '8px', marginBottom: '14px', fontSize: '13px', color: 'var(--danger)' }}>
              <AlertTriangle size={16} /> {logoError}
            </div>
          )}
          <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
            {/* Preview */}
            <div style={{
              width: '160px', height: '160px', borderRadius: '12px', flexShrink: 0,
              border: '2px dashed var(--border-default)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'var(--bg-primary)', overflow: 'hidden',
            }}>
              <BrandLogo size="lg" logoPath={config.logo_path} logoTs={logoTs} />
            </div>

            {/* Controles */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <button type="button" className="btn" onClick={handleSelecionarLogo}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Upload size={16} /> {logoUrl ? 'Trocar Logo' : 'Carregar Logo'}
                </button>
                {logoUrl && (
                  <button type="button" className="btn-outline" onClick={handleRemoverLogo}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', borderColor: 'var(--danger)', color: 'var(--danger)' }}>
                    <Trash2 size={16} /> Remover
                  </button>
                )}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <InfoRow label="Formatos aceitos" value="PNG, JPG, JPEG, WEBP" />
                <InfoRow label="Tamanho máximo" value="2 MB" />
                <InfoRow label="Dimensão mínima" value="100 × 100 px" />
                <InfoRow label="Recomendado" value="500 × 500 px" />
                <InfoRow label="Dica" value="Prefira PNG com fundo transparente para melhor resultado visual." />
              </div>

              {/* Toggle: exibir no cupom */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px',
                padding: '12px 14px', borderRadius: '8px',
                backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-default)',
              }}>
                <Printer size={16} color="var(--text-secondary)" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                    Exibir logo no cupom de venda
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Desative se sua impressora térmica não suportar imagens
                  </div>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!config.exibir_logo_cupom}
                    onChange={e => handleChange('exibir_logo_cupom', e.target.checked ? 1 : 0)}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute', inset: 0, borderRadius: '24px', transition: '0.3s',
                    backgroundColor: config.exibir_logo_cupom ? 'var(--primary)' : '#3f3f3f',
                  }} />
                  <span style={{
                    position: 'absolute', top: '3px',
                    left: config.exibir_logo_cupom ? '23px' : '3px',
                    width: '18px', height: '18px', borderRadius: '50%', transition: '0.3s',
                    backgroundColor: '#fff',
                  }} />
                </label>
              </div>
            </div>
          </div>
        </Section>

        {/* ── 5. Pré-visualização ─────────────────────────────────────────── */}
        <Section icon={<Eye size={18} />} title="Pré-visualização em Tempo Real">
          <div style={{
            padding: '28px', borderRadius: '14px',
            backgroundColor: config.cor_fundo,
            border: '1px solid rgba(255,255,255,0.06)',
            transition: 'all 0.35s',
          }}>
            {/* Card principal */}
            <div style={{
              backgroundColor: config.cor_card, borderRadius: '10px', padding: '22px',
              border: '1px solid rgba(255,255,255,0.05)', marginBottom: '16px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <BrandLogo size="sm" logoPath={config.logo_path} logoTs={logoTs} />
                  <h4 style={{ color: config.cor_texto, fontSize: '18px', fontWeight: '800', margin: 0, letterSpacing: '-0.5px' }}>
                    {config.nome_comercio || 'PetWay'}
                  </h4>
                </div>
                <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                  backgroundColor: `${config.cor_primaria}22`, color: config.cor_primaria }}>
                  Preview Digital
                </span>
              </div>
              <p style={{ color: config.cor_texto_secundario, fontSize: '13px', marginBottom: '18px', lineHeight: 1.6 }}>
                Este texto exemplifica a hierarquia de informação secundária do sistema.
              </p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button type="button" style={{
                  backgroundColor: config.cor_primaria, color: '#FFF', border: 'none',
                  padding: '9px 18px', borderRadius: '8px', fontWeight: '600', fontSize: '13px', cursor: 'default',
                }}>Ação Primária</button>
                <button type="button" style={{
                  backgroundColor: 'transparent', color: config.cor_texto,
                  border: `1px solid ${config.cor_texto_secundario}60`,
                  padding: '9px 18px', borderRadius: '8px', fontWeight: '600', fontSize: '13px', cursor: 'default',
                }}>Secundário</button>
                <button type="button" style={{
                  backgroundColor: config.cor_destaque, color: '#FFF', border: 'none',
                  padding: '9px 18px', borderRadius: '8px', fontWeight: '600', fontSize: '13px', cursor: 'default',
                }}>Destaque</button>
              </div>
            </div>

            {/* KPI cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {[
                { label: 'Vendas Hoje', valor: 'R$ 1.240' },
                { label: 'Agendamentos', valor: '8' },
                { label: 'Clientes', valor: '134' },
              ].map((kpi, i) => (
                <div key={i} style={{
                  backgroundColor: config.cor_card, borderRadius: '8px', padding: '16px',
                  border: `1px solid ${config.cor_primaria}30`,
                }}>
                  <div style={{ color: config.cor_texto_secundario, fontSize: '11px', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {kpi.label}
                  </div>
                  <div style={{ color: config.cor_texto, fontSize: '20px', fontWeight: '700' }}>{kpi.valor}</div>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* ── Rodapé ──────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid var(--border-default)' }}>
          <button type="submit" className="btn" disabled={saving} style={{ minWidth: '180px', justifyContent: 'center' }}>
            <Save size={18} /> {saving ? 'Aplicando...' : 'Salvar e Aplicar Tema'}
          </button>
        </div>
      </form>

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

// ── Sub-componentes utilitários ────────────────────────────────────────────────
function Section({ icon, title, action, children }) {
  return (
    <div style={{ padding: '20px', border: '1px solid var(--border-default)', borderRadius: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
          {icon} {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div><strong style={{ color: 'var(--text-primary)' }}>{label}:</strong> {value}</div>
  );
}

function LogoPlaceholder() {
  return (
    <div style={{ textAlign: 'center', padding: '16px', userSelect: 'none' }}>
      <Image size={36} style={{ opacity: 0.2, display: 'block', margin: '0 auto 8px' }} />
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', opacity: 0.6 }}>Sem logo</div>
    </div>
  );
}

// ── applyTheme — exportada para uso no App.jsx e pós-salvar ───────────────────
function hexToRgb(hex) {
  const normalized = (hex || '').replace('#', '').trim();
  if (normalized.length !== 6) return null;
  const value = Number.parseInt(normalized, 16);
  if (Number.isNaN(value)) return null;
  return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`;
}

export function applyTheme(config) {
  if (!config) return;
  const r = document.documentElement.style;
  if (config.cor_primaria)         r.setProperty('--primary',          config.cor_primaria);
  if (config.cor_destaque)         r.setProperty('--primary-hover',     config.cor_destaque);
  if (config.cor_fundo)            r.setProperty('--bg-primary',        config.cor_fundo);
  if (config.cor_card) {
    r.setProperty('--bg-secondary', config.cor_card);
    r.setProperty('--bg-card', config.cor_card);
    r.setProperty('--card-bg', config.cor_card);
  }
  if (config.cor_texto)            r.setProperty('--text-primary',      config.cor_texto);
  if (config.cor_texto)            r.setProperty('--text-h',            config.cor_texto);
  if (config.cor_texto_secundario) r.setProperty('--text-secondary',    config.cor_texto_secundario);
  if (config.cor_secundaria) {
    r.setProperty('--border-default', config.cor_secundaria);
    r.setProperty('--border-color', config.cor_secundaria);
    r.setProperty('--border', config.cor_secundaria);
  }

  const primaryRgb = hexToRgb(config.cor_primaria);
  if (primaryRgb) {
    r.setProperty('--primary-rgb', primaryRgb);
    r.setProperty('--accent-bg', `rgba(${primaryRgb}, 0.1)`);
    r.setProperty('--accent-border', `rgba(${primaryRgb}, 0.25)`);
  }
  if (config.cor_primaria) r.setProperty('--accent', config.cor_primaria);
}
