import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Save, Database, History, RefreshCcw, FolderOpen, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import ModalConfirm from '../../components/Common/ModalConfirm';

export default function ConfigBackup() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [config, setConfig] = useState({
    caminho_backup: '',
    backup_automatico: 0,
    frequencia_backup: 'manual',
    manter_copias: 5,
    ultimo_backup: null
  });
  const [backupsList, setBackupsList] = useState([]);
  const { showToast } = useToast();
  const [modalConfirm, setModalConfirm] = useState({ isOpen: false, title: '', message: '', type: 'info', onConfirm: () => {} });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const cfg = await api.backup.getConfig();
      if (cfg) {
        setConfig({
          caminho_backup: cfg.caminho_backup || '',
          backup_automatico: cfg.backup_automatico || 0,
          frequencia_backup: cfg.frequencia_backup || 'manual',
          manter_copias: cfg.manter_copias || 5,
          ultimo_backup: cfg.ultimo_backup
        });
      }
      
      const fileRes = await api.backup.listar();
      if (fileRes && fileRes.success) {
         setBackupsList(fileRes.files || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const res = await api.backup.saveConfig(config);
      if (res && res.success) {
        showToast('Configurações de backup salvas!', 'success');
      } else {
        showToast('Erro ao salvar: ' + (res?.message || 'Erro Desconhecido'), 'error');
      }
    } catch (e) {
      showToast('Erro inesperado ao salvar: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectDirectory = async () => {
    const dir = await api.dialog.selectDirectory();
    if (dir) {
      handleChange('caminho_backup', dir);
    }
  };

  const handleBackupManual = async () => {
    if (!config.caminho_backup) {
      showToast('Selecione primeiro uma pasta de backup!', 'warning');
      return;
    }
    setExecuting(true);
    try {
      const res = await api.backup.executar();
      // O backend pode ter dado reject ou falhado por caminho nao acessivel
      if (!res.success) {
         showToast('Erro no Backup: ' + res.message, 'error');
      } else {
         showToast(`Backup concluído: ${res.fileName}`, 'success');
         loadData();
      }
    } catch (e) {
       showToast('Exceção ao fazer backup: ' + e.message, 'error');
    } finally {
      setExecuting(false);
    }
  };

  const handleRestaurar = async (arquivoPath) => {
    setModalConfirm({
      isOpen: true,
      title: 'Restaurar Backup (Operação Crítica)',
      message: 'ATENÇÃO: Isso irá substituir completamente o banco de dados atual. Qualquer dado feito após essa data será PERDIDO. O SISTEMA SERÁ REINICIADO.',
      type: 'danger',
      onConfirm: async () => {
        setRestoring(true);
        try {
           const res = await api.backup.restaurar(arquivoPath);
           if (!res.success) {
              showToast('Falha crítica ao restaurar: ' + res.message, 'error');
              setRestoring(false);
           } else {
              showToast('Bando de dados reinstalado! Reiniciando...', 'success');
           }
        } catch (e) {
           showToast('Erro Crítico no IPC RESTORE: ' + e.message, 'error');
           setRestoring(false);
        }
      }
    });
  };

  if (loading) return <div style={{ padding: '24px', color: 'var(--text-secondary)' }}>Carregando dados de segurança...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="card">
        <h2 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShieldCheck size={20} color="var(--primary)" />
          Segurança, Backup e Recuperação
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '8px' }}>
          Mantenha a segurança e integridade dos dados locais configurando backups regulares e automáticos.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '20px', alignItems: 'start' }}>
        
        {/* Esquerda - Controles e Configuração */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* PAINEL: DIRETÓRIO */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-default)', paddingBottom: '12px' }}>
              <FolderOpen size={18} /> Diretório de Armazenamento
            </h3>
            <div className="input-group">
              <label>Caminho da pasta</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  className="input" 
                  style={{ flex: 1 }}
                  placeholder="Nenhum diretório selecionado..."
                  value={config.caminho_backup}
                  readOnly
                />
                <button className="btn-outline" onClick={handleSelectDirectory}>
                  Procurar Pasta
                </button>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Recomendamos escolher uma pasta sincronizada com a nuvem (Google Drive, OneDrive).
              </span>
            </div>
            
            <button className="btn" style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }} onClick={handleSaveConfig} disabled={saving}>
               <Save size={16} /> {saving ? 'Salvando...' : 'Salvar Preferências'}
            </button>
          </div>

          {/* PAINEL: AUTOMATIZAÇÃO */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-default)', paddingBottom: '12px' }}>
              <RefreshCcw size={18} /> Backup Automático
            </h3>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', paddingBottom: '8px' }}>
                <input 
                  type="checkbox" 
                  checked={config.backup_automatico === 1}
                  onChange={(e) => handleChange('backup_automatico', e.target.checked ? 1 : 0)}
                />
                <span>Habilitar cópia de segurança em segundo plano</span>
            </label>

            {config.backup_automatico === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingLeft: '24px', borderLeft: '2px solid var(--border-default)' }}>
                 <div className="input-group">
                    <label>Frequência Relativa</label>
                    <select 
                      className="input" 
                      value={config.frequencia_backup} 
                      onChange={e => handleChange('frequencia_backup', e.target.value)}
                    >
                       <option value="diario">Rodar a cada 24 Horas</option>
                       <option value="semanal">Rodar a cada 7 Dias</option>
                    </select>
                 </div>
                 
                 <div className="input-group">
                    <label>Quantidade Limite de Histórico</label>
                    <input 
                      type="number" 
                      className="input" 
                      min="1" max="50"
                      value={config.manter_copias} 
                      onChange={e => handleChange('manter_copias', parseInt(e.target.value) || 1)}
                    />
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                       Backups mais antigos que o limite serão deletados da pasta automaticamente para poupar disco.
                    </span>
                 </div>
              </div>
            )}
          </div>

          {/* PAINEL: BACKUP ATIVO */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-default)', paddingBottom: '12px' }}>
              <Database size={18} /> Ações Manuais
            </h3>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
               <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                 Último Backup Geral:<br/>
                 <strong style={{ color: 'var(--text-primary)' }}>
                   {config.ultimo_backup ? new Date(config.ultimo_backup).toLocaleString('pt-BR') : 'Nunca realizado'}
                 </strong>
               </div>
               <button 
                  className="btn" 
                  onClick={handleBackupManual} 
                  disabled={executing || !config.caminho_backup}
                  style={{ backgroundColor: 'var(--success)', display: 'flex', alignItems: 'center', gap: '8px' }}
               >
                 <Database size={16}/> {executing ? 'Executando...' : 'Fazer Backup Agora'}
               </button>
            </div>
          </div>
          
        </div>

        {/* Direita - Restauração / Histórico */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
           <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
              <h3 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-default)', paddingBottom: '12px' }}>
                <History size={18} /> Restaurar Backup Existente
              </h3>

              {!config.caminho_backup ? (
                 <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Pasta não selecionada.
                 </div>
              ) : backupsList.length === 0 ? (
                 <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Nenhum arquivo de backup (.db) foi encontrado na pasta selecionada.
                 </div>
              ) : (
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '400px' }}>
                    {backupsList.map((file, idx) => (
                       <div key={idx} style={{ 
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                          padding: '12px', backgroundColor: 'rgba(255,255,255,0.03)', 
                          borderRadius: '8px', border: '1px solid var(--border-default)'
                       }}>
                          <div>
                            <div style={{ fontWeight: '500', fontSize: '13px', color: 'var(--text-primary)' }}>{file.name}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                              {(file.size / 1024).toFixed(2)} KB • Modificado: {new Date(file.mtime).toLocaleString('pt-BR')}
                            </div>
                          </div>
                          <button 
                             className="btn-outline" 
                             style={{ color: '#ff4444', borderColor: '#441111' }}
                             disabled={restoring}
                             onClick={() => handleRestaurar(file.path)}
                          >
                             {restoring ? 'Aguarde' : 'Restaurar'}
                          </button>
                       </div>
                    ))}
                 </div>
              )}
              
              <div style={{ backgroundColor: 'rgba(255, 68, 68, 0.1)', borderLeft: '3px solid #ff4444', padding: '12px', color: 'var(--text-secondary)', fontSize: '12px', borderRadius: '4px', marginTop: 'auto' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                    <AlertTriangle size={16} color="#ff4444" />
                    <strong style={{ color: '#ff4444' }}>Perigo: Perda de Dados Recentes</strong>
                  </div>
                  O recuo do banco substituí todo o panorama do sistema pelo momento da foto. O sistema deve estar ocioso e as NFs de hoje despachadas.
              </div>
           </div>
        </div>

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
