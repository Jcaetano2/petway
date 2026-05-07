const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { getDatabase } = require('./database');
const fiscalService = require('./fiscal/fiscalService');

const DB_FILENAME = 'petshop.db';

function getDbPath() {
  return path.join(app.getPath('userData'), DB_FILENAME);
}

/**
 * Retorna as configurações de backup
 */
async function getConfigBackup() {
  const db = await getDatabase();
  let conf = await db.get('SELECT * FROM config_backup WHERE id = 1');
  if (!conf) {
    await db.run("INSERT INTO config_backup (id, caminho_backup, backup_automatico, frequencia_backup, manter_copias) VALUES (1, '', 0, 'manual', 5)");
    conf = await db.get('SELECT * FROM config_backup WHERE id = 1');
  }
  return conf;
}

/**
 * Salva configurações de backup
 */
async function saveConfigBackup(data) {
  try {
    const db = await getDatabase();
    await db.run(`
      UPDATE config_backup SET 
        caminho_backup = ?,
        backup_automatico = ?,
        frequencia_backup = ?,
        manter_copias = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `, [data.caminho_backup || '', data.backup_automatico ? 1 : 0, data.frequencia_backup || 'manual', data.manter_copias || 5]);
    
    // Atualiza o scheduler nativo quando salva a config
    initAutoBackupScheduler();

    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * Gera um timestamp sufixo limpo
 */
function getTimestampSufix() {
  const d = new Date();
  const pad = n => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

/**
 * Executa o backup copiando do app.userData para a pasta configurada
 */
async function realizarBackupManual(isAutomated = false) {
  try {
    const config = await getConfigBackup();
    const destDir = config.caminho_backup;

    if (!destDir) {
      if (isAutomated) return { success: false, message: 'Diretório não configurado.' };
      throw new Error('Caminho de backup não foi configurado. Selecione uma pasta.');
    }

    if (!fs.existsSync(destDir)) {
      throw new Error(`Diretório de destino não acessível: ${destDir}`);
    }

    const currentDbPath = getDbPath();
    const backupFileName = `backup_${getTimestampSufix()}.db`;
    const destPath = path.join(destDir, backupFileName);

    // Lock Database temporarily just to copy (using WAL mode helps here, but copyFileSync is fast enough)
    fs.copyFileSync(currentDbPath, destPath);

    // Registrar o horario
    const db = await getDatabase();
    await db.run("UPDATE config_backup SET ultimo_backup = CURRENT_TIMESTAMP WHERE id = 1");

    await limparBackupsAntigos(destDir, config.manter_copias);

    return { success: true, fileName: backupFileName, path: destPath };
  } catch (e) {
    console.error('Falha no backup:', e);
    return { success: false, message: e.message };
  }
}

/**
 * Lista arquivos válidos no diretório para restaurar
 */
async function listarArquivosBackup() {
  try {
    const config = await getConfigBackup();
    if (!config.caminho_backup || !fs.existsSync(config.caminho_backup)) {
      return { success: true, files: [] };
    }

    const files = fs.readdirSync(config.caminho_backup);
    const validBackups = files
      .filter(f => f.endsWith('.db') || f.endsWith('.sqlite'))
      .map(f => {
        const fullPath = path.join(config.caminho_backup, f);
        const stats = fs.statSync(fullPath);
        return {
          name: f,
          path: fullPath,
          size: stats.size,
          mtime: stats.mtime
        };
      });

    // Ordenar do mais novo pro mais antigo
    validBackups.sort((a, b) => b.mtime - a.mtime);

    return { success: true, files: validBackups };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

/**
 * Mantém apenas N cópias configuradas no diretório
 */
async function limparBackupsAntigos(dirPath, maxCopies) {
  if (maxCopies <= 0) return; // Nao manter controle
  try {
    const files = fs.readdirSync(dirPath);
    const dbFiles = files
      .filter(f => f.startsWith('backup_') && f.endsWith('.db'))
      .map(f => ({ name: f, path: path.join(dirPath, f), mtime: fs.statSync(path.join(dirPath, f)).mtime }))
      .sort((a, b) => b.mtime - a.mtime); // Decrescente

    if (dbFiles.length > maxCopies) {
      const toDelete = dbFiles.slice(maxCopies);
      toDelete.forEach(file => {
         try { fs.unlinkSync(file.path); } catch(err) { console.error('Erro ao deletar excesso:', file.name); }
      });
    }
  } catch (e) {
    console.error('Erro na limpeza de backups antigos', e);
  }
}

/**
 * Restaura um banco de dados e reinicia a aplicação via Electron force
 */
async function restaurarBackup(caminhoArquivo) {
  try {
    if (fiscalService.isFiscalJobRunning()) {
      throw new Error('Não é possível restaurar o banco enquanto o serviço fiscal está processando notas em segundo plano. Aguarde a finalização.');
    }

    if (!fs.existsSync(caminhoArquivo)) {
      throw new Error(`Arquivo de backup não encontrado: ${caminhoArquivo}`);
    }

    if (!caminhoArquivo.endsWith('.db') && !caminhoArquivo.endsWith('.sqlite')) {
      throw new Error('Apenas arquivos .db ou .sqlite podem ser restaurados.');
    }

    const currentDbPath = getDbPath();
    
    // Backup Preventivo no proprio local de user data
    const preRestoreBakPath = currentDbPath + `.pre-restore-${getTimestampSufix()}.bak`;
    fs.copyFileSync(currentDbPath, preRestoreBakPath);
    console.log('[RESTORE] Backup preventivo salvo em: ', preRestoreBakPath);

    // Fecha conexões globais DB - se existir rotina
    const db = await getDatabase();
    if (db) {
       await db.close();
    }

    // Sobreescreve
    fs.copyFileSync(caminhoArquivo, currentDbPath);

    setTimeout(() => {
      app.relaunch();
      app.exit(0);
    }, 500);

    return { success: true, restartScheduled: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// ============== ROTINAS AUTOMÁTICAS ==============
let autoBackupTimer = null;

async function checkRoutine() {
  try {
    const config = await getConfigBackup();
    if (!config.backup_automatico || !config.caminho_backup) return;

    const umDiaEmMs = 24 * 60 * 60 * 1000;
    const frequenciaMs = config.frequencia_backup === 'semanal' ? (7 * umDiaEmMs) : umDiaEmMs;
    
    const now = new Date();
    const ultimoBkpTimestamp = config.ultimo_backup ? new Date(config.ultimo_backup).getTime() : 0;
    
    // Converte timezone do banco SQL (UTC vs Local) lidando na checagem
    const dbDateOffsetDiff = new Date().getTimezoneOffset() * 60000;
    const lastBackupTime = ultimoBkpTimestamp - dbDateOffsetDiff;

    if ((now.getTime() - lastBackupTime) >= frequenciaMs || !config.ultimo_backup) {
       console.log(`[Backup Automático] Intervalo esgotado. Disparando cópia de Segurança.`);
       await realizarBackupManual(true);
    }
  } catch (e) {
    console.error('Erro no scheduler de backup:', e);
  }
}

function initAutoBackupScheduler() {
  if (autoBackupTimer) clearInterval(autoBackupTimer);

  // Checa assim que subir
  setTimeout(() => { checkRoutine(); }, 5000);

  // E dps de 30 em 30 min pra ver se o relógio virou as 24h
  autoBackupTimer = setInterval(() => {
    checkRoutine();
  }, 30 * 60 * 1000);
}

module.exports = {
  getConfigBackup,
  saveConfigBackup,
  realizarBackupManual,
  listarArquivosBackup,
  restaurarBackup,
  initAutoBackupScheduler
};
