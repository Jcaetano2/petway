import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { Save, CheckCircle, Database, FolderOpen, Server, Download, RefreshCw, AlertTriangle, RotateCcw, Zap } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const UPDATE_STATUS_LABELS = {
  idle: null,
  checking: { label: 'Verificando atualizações...', color: 'var(--primary)', spin: true },
  available: { label: 'Nova versão disponível!', color: '#f59e0b', spin: false },
  'not-available': { label: 'Você está na versão mais recente.', color: 'var(--success)', spin: false },
  downloading: { label: 'Baixando atualização...', color: 'var(--primary)', spin: true },
  downloaded: { label: 'Atualização pronta! Reinicie para instalar.', color: 'var(--success)', spin: false },
  error: { label: 'Erro ao verificar atualizações.', color: 'var(--danger)', spin: false },
};

export default function ConfigSistema() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();
  
  const [info, setInfo] = useState({ versao: '', dbPath: '' });
  const [config, setConfig] = useState({ modo_ambiente: 'local', ultimo_teste_api: '' });

  // Estado do sistema de atualizações
  const [updateState, setUpdateState] = useState({
    status: 'idle',    // idle | checking | available | not-available | downloading | downloaded | error
    version: null,
    percent: 0,
    message: null,
    releaseNotes: null
  });

  useEffect(() => {
    async function load() {
      const dataInfo = await api.sistema.getInfo();
      if (dataInfo) setInfo(dataInfo);
      const dataConfig = await api.config.sistema.get();
      if (dataConfig && dataConfig.id) setConfig(dataConfig);
      setLoading(false);
    }
    load();
  }, []);

  // Escutar eventos de atualização vindos do processo principal
  useEffect(() => {
    if (!window.api?.onUpdateStatus) return;

    const unsubscribe = window.api.onUpdateStatus((data) => {
      setUpdateState(prev => ({
        ...prev,
        status: data.status,
        version: data.version || prev.version,
        percent: data.percent ?? prev.percent,
        message: data.message || null,
        releaseNotes: data.releaseNotes || prev.releaseNotes
      }));
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    const res = await api.config.sistema.save(config);
    if (res.success) {
      showToast('Configurações do sistema salvas!', 'success');
    } else {
      showToast('Erro ao salvar no banco.', 'error');
    }
    setSaving(false);
  };

  const handleAbrirPasta = async () => {
    await api.sistema.abrirPastaDados();
  };

  const handleCheckUpdates = async () => {
    setUpdateState(prev => ({ ...prev, status: 'checking', message: null }));
    try {
      const res = await window.api.updaterCheck();
      if (!res.success) {
        setUpdateState(prev => ({ ...prev, status: 'error', message: res.message }));
      }
      // Se sucesso, o evento 'update-status' do main process atualizará o estado automaticamente
    } catch (err) {
      setUpdateState(prev => ({ ...prev, status: 'error', message: err.message }));
    }
  };

  const handleDownloadUpdate = async () => {
    setUpdateState(prev => ({ ...prev, status: 'downloading', percent: 0 }));
    try {
      await window.api.updaterDownload();
    } catch (err) {
      setUpdateState(prev => ({ ...prev, status: 'error', message: err.message }));
    }
  };

  const handleInstallUpdate = async () => {
    await window.api.updaterInstall();
  };

  if (loading) return <div style={{ padding: '24px' }}>Carregando...</div>;

  const statusInfo = UPDATE_STATUS_LABELS[updateState.status];

  return (
    <div className="card animate-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2>Sistema e Atualizações</h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Versão e diretórios */}
        <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Server size={20} color="var(--primary)" /> Versão e Diretórios
            </h3>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,2fr)', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Build Version</label>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)' }}>v{info.versao || '1.0.0'}</div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Caminho do Banco Relacional Local</label>
              <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontFamily: 'monospace', padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
                {info.dbPath}
              </div>
            </div>
          </div>
          <div style={{ marginTop: '16px' }}>
            <button type="button" onClick={handleAbrirPasta} className="btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FolderOpen size={16} /> Abrir Diretório do Banco AppData
            </button>
          </div>
        </div>

        {/* Sistema de Atualizações */}
        <div style={{ padding: '20px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <Download size={20} color="var(--primary)" /> Atualizações do Sistema
          </h3>

          {/* Status card */}
          {statusInfo && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '12px 16px', borderRadius: '8px', marginBottom: '16px',
              background: `${statusInfo.color}18`,
              border: `1px solid ${statusInfo.color}55`
            }}>
              {statusInfo.spin ? (
                <RefreshCw size={16} color={statusInfo.color} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
              ) : updateState.status === 'downloaded' ? (
                <CheckCircle size={16} color={statusInfo.color} style={{ flexShrink: 0 }} />
              ) : updateState.status === 'error' ? (
                <AlertTriangle size={16} color={statusInfo.color} style={{ flexShrink: 0 }} />
              ) : (
                <Zap size={16} color={statusInfo.color} style={{ flexShrink: 0 }} />
              )}
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: statusInfo.color }}>
                  {statusInfo.label}
                </div>
                {updateState.version && updateState.status === 'available' && (
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Versão disponível: <strong style={{ color: '#f59e0b' }}>v{updateState.version}</strong>
                  </div>
                )}
                {updateState.version && updateState.status === 'downloaded' && (
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Versão v{updateState.version} pronta para instalação
                  </div>
                )}
                {updateState.message && (
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', fontFamily: 'monospace' }}>
                    {updateState.message}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Barra de progresso do download */}
          {updateState.status === 'downloading' && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <span>Baixando...</span>
                <span style={{ fontWeight: '600', color: 'var(--primary)' }}>{updateState.percent}%</span>
              </div>
              <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${updateState.percent}%`,
                  background: 'var(--primary)',
                  borderRadius: '3px',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
          )}

          {/* Botões de ação */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {/* Verificar */}
            {(updateState.status === 'idle' || updateState.status === 'not-available' || updateState.status === 'error') && (
              <button
                onClick={handleCheckUpdates}
                className="btn-outline"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}
              >
                <RefreshCw size={16} /> Verificar Agora
              </button>
            )}

            {/* Baixar */}
            {updateState.status === 'available' && (
              <button
                onClick={handleDownloadUpdate}
                className="btn"
                style={{ background: '#f59e0b', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}
              >
                <Download size={16} /> Baixar v{updateState.version}
              </button>
            )}

            {/* Instalar e Reiniciar */}
            {updateState.status === 'downloaded' && (
              <button
                onClick={handleInstallUpdate}
                className="btn"
                style={{ background: 'var(--success)', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}
              >
                <RotateCcw size={16} /> Instalar e Reiniciar
              </button>
            )}

            {/* Botão de verificar novamente enquanto checking ou downloading */}
            {(updateState.status === 'checking' || updateState.status === 'downloading') && (
              <button disabled className="btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', opacity: 0.5 }}>
                <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                {updateState.status === 'checking' ? 'Verificando...' : 'Baixando...'}
              </button>
            )}
          </div>

          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '16px', lineHeight: '1.6' }}>
            As atualizações são distribuídas via <strong style={{ color: 'var(--text-primary)' }}>GitHub Releases</strong>.
            O download não interrompe o uso do sistema e a instalação ocorre apenas no próximo reinício.
          </p>
        </div>

        {/* Configurações do sistema */}
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
            <button type="submit" className="btn" disabled={saving}>
              <Save size={18} /> {saving ? 'Salvando...' : 'Gravar Estado Base'}
            </button>
          </div>
        </form>

      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
