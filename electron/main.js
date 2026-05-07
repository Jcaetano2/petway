require('dotenv').config({ quiet: true });
const { app, BrowserWindow, ipcMain, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { getDatabase } = require('./database');
const { setupIpcHandlers } = require('./ipcHandlers');
const { processarFilaReenvio } = require('./fiscal/fiscalService');
const { initAutoBackupScheduler } = require('./backupService');
const { autoUpdater } = require('electron-updater');

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

function configureDevelopmentRuntime() {
  if (!isDev) return;

  const devSessionPath = path.join(os.tmpdir(), 'petway-electron-dev-session', String(process.pid));
  fs.mkdirSync(devSessionPath, { recursive: true });

  try {
    app.setPath('sessionData', devSessionPath);
  } catch (err) {
    console.warn('[Dev] Nao foi possivel isolar sessionData:', err.message);
  }

  app.commandLine.appendSwitch('disk-cache-dir', path.join(devSessionPath, 'Cache'));
  app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
}

configureDevelopmentRuntime();

// Declarar brand-logo:// como protocolo seguro (deve estar antes do app.whenReady)
protocol.registerSchemesAsPrivileged([
  { scheme: 'brand-logo', privileges: { secure: true, standard: true, bypassCSP: true, supportFetchAPI: true } }
]);

let mainWindow;

// ===========================
// AUTO-UPDATER CONFIGURATION
// ===========================
function setupAutoUpdater() {
  // Em desenvolvimento, não tentar buscar atualizações reais
  if (isDev) {
    console.log('[Updater] Modo desenvolvimento — atualizações desabilitadas.');
    return;
  }

  autoUpdater.autoDownload = false; // Download manual para o usuário confirmar
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    sendUpdateStatus('checking');
  });

  autoUpdater.on('update-available', (info) => {
    sendUpdateStatus('available', { version: info.version, releaseNotes: info.releaseNotes });
  });

  autoUpdater.on('update-not-available', () => {
    sendUpdateStatus('not-available');
  });

  autoUpdater.on('error', (err) => {
    console.error('[Updater] Erro:', err);
    sendUpdateStatus('error', { message: err.message });
  });

  autoUpdater.on('download-progress', (progressObj) => {
    sendUpdateStatus('downloading', {
      percent: Math.round(progressObj.percent),
      transferred: progressObj.transferred,
      total: progressObj.total,
      bytesPerSecond: progressObj.bytesPerSecond
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    sendUpdateStatus('downloaded', { version: info.version });
  });

  // Verificar automaticamente após 5 segundos da inicialização
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(err => {
      console.warn('[Updater] Falha na verificação automática:', err.message);
    });
  }, 5000);
}

function sendUpdateStatus(status, data = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-status', { status, ...data });
  }
}

// Expor autoUpdater e sendUpdateStatus para ipcHandlers
global.autoUpdater = autoUpdater;
global.sendUpdateStatus = sendUpdateStatus;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    title: 'PetWay - Sistema para Pet Shop',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#1e1e2d',
      symbolColor: '#ffffff',
      height: 40
    }
  });

  // Load the UI
  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  // Registrar protocolo brand-logo:// ANTES de criar a janela
  protocol.handle('brand-logo', (request) => {
    const userDataPath = app.getPath('userData');
    const brandDir = path.join(userDataPath, 'brand');
    const relativePath = decodeURIComponent(request.url.replace('brand-logo://', '').split('?')[0]);
    const absolutePath = path.resolve(userDataPath, relativePath);
    if (!absolutePath.startsWith(brandDir + path.sep)) {
      return new Response('Forbidden', { status: 403 });
    }
    return net.fetch('file://' + absolutePath);
  });

  // Initialize Database before starting window
  console.log('Initializing SQLite Database...');
  getDatabase().catch(err => {
    console.error('Failed to initialize database: ', err);
  });

  // Setup IPC Handlers
  setupIpcHandlers(ipcMain);

  createWindow();

  // Iniciar rotina de backup em background
  initAutoBackupScheduler();

  // Resiliência: rotinas de reenvio automático da fila NFC-e
  setTimeout(() => {
    console.log('Iniciando reenvio pendente NFC-e (startup)...');
    processarFilaReenvio().catch(console.error);
  }, 10000); // 10 segundos
  setInterval(() => {
    processarFilaReenvio().catch(console.error);
  }, 3 * 60 * 1000); // 3 minutos

  // Configurar sistema de atualizações automáticas
  setupAutoUpdater();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
