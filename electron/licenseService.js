const crypto = require('crypto');
const { machineIdSync } = require('node-machine-id');
const Store = require('electron-store');
const { getDatabase } = require('./database');

/**
 * Generates a resilient hardware ID (HWID)
 */
function getHWID() {
  return machineIdSync({ original: true });
}

// Generate secure encryption key based on HWID and static salt
const hwid = getHWID();
const encryptionKey = crypto.createHash('sha256').update(hwid + 'PetWay_Secure_Salt_2026').digest('hex');

const store = new Store({
  name: 'petway_secure_config',
  encryptionKey: encryptionKey
});

/**
 * Gets the license info from the encrypted local store
 */
async function getLocalLicense() {
  try {
    const data = store.get('license');
    if (!data) {
      // Fallback: Check if it exists in legacy sqlite, if so migrate
      const db = await getDatabase();
      const config = await db.get(`
        SELECT 
          chave_licenca, token_offline, validade_licenca, tipo_licenca, 
          plan_type, support_until, license_status, data_primeira_execucao 
        FROM config_sistema 
        WHERE id = 1
      `);
      if (config && config.chave_licenca) {
        const legacyData = {
          key: config.chave_licenca,
          token: config.token_offline,
          expiresAt: config.validade_licenca,
          type: config.tipo_licenca,
          planType: config.plan_type,
          supportUntil: config.support_until,
          status: config.license_status,
          firstRun: config.data_primeira_execucao,
          lastOnlineDate: Date.now()
        };
        store.set('license', legacyData);
        return legacyData;
      }
      return null;
    }
    return data;
  } catch (error) {
    console.error('Error reading encrypted local license:', error);
    return null;
  }
}

/**
 * Saves or updates the license in the encrypted local store
 */
async function saveLocalLicense(data) {
  try {
    const existingData = store.get('license') || {};
    
    // Merge new data
    const newData = {
      ...existingData,
      ...data,
      lastOnlineDate: data.lastOnlineDate || existingData.lastOnlineDate || Date.now()
    };
    
    store.set('license', newData);
    
    // Keep sqlite updated as backup/legacy support
    try {
      const db = await getDatabase();
      await db.run(
        `UPDATE config_sistema SET 
          chave_licenca = COALESCE(?, chave_licenca), 
          token_offline = COALESCE(?, token_offline), 
          validade_licenca = COALESCE(?, validade_licenca), 
          tipo_licenca = COALESCE(?, tipo_licenca),
          plan_type = COALESCE(?, plan_type),
          support_until = COALESCE(?, support_until),
          license_status = COALESCE(?, license_status),
          licenca_ativa = 1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = 1`,
        [
          newData.key || null, 
          newData.token || null, 
          newData.expiresAt || null, 
          newData.type || null,
          newData.planType || null,
          newData.supportUntil || null,
          newData.status || null
        ]
      );
    } catch (dbErr) {
      console.warn('Failed to update legacy sqlite db', dbErr);
    }

    return true;
  } catch (error) {
    console.error('Error saving encrypted local license:', error);
    return false;
  }
}

/**
 * Validates offline anti-fraud parameters
 * 1. Checks if clock was rewound (Date.now() < lastOnlineDate)
 * 2. Checks maximum offline days (e.g. 15 days without internet ping)
 */
function checkOfflineFraud(licenseData) {
  if (!licenseData || !licenseData.lastOnlineDate) return { valid: true };

  const now = Date.now();
  const lastOnline = new Date(licenseData.lastOnlineDate).getTime();

  // 1. Time-tampering (Clock rewound)
  if (now < lastOnline) {
    console.error('ANTI-FRAUD TRIGGERED: System clock has been rewound.');
    return { valid: false, reason: 'time_tampered' };
  }

  // 2. Max Offline Time (15 days)
  const MAX_OFFLINE_MS = 15 * 24 * 60 * 60 * 1000;
  if (now - lastOnline > MAX_OFFLINE_MS) {
    console.error('ANTI-FRAUD TRIGGERED: Maximum offline time exceeded.');
    return { valid: false, reason: 'max_offline_exceeded' };
  }

  return { valid: true };
}

/**
 * Initialize first run trial (30 days) if no license exists
 */
async function initTrial() {
  try {
    const license = store.get('license');
    if (license && license.firstRun) {
      return license.firstRun;
    }

    const db = await getDatabase();
    let config = await db.get('SELECT data_primeira_execucao FROM config_sistema WHERE id = 1');
    
    if (!config || !config.data_primeira_execucao) {
      const firstRunDate = new Date().toISOString().split('T')[0];
      await db.run('UPDATE config_sistema SET data_primeira_execucao = ? WHERE id = 1', [firstRunDate]);
      return firstRunDate;
    }
    
    return config.data_primeira_execucao;
  } catch (error) {
    console.error('Error initializing trial:', error);
    return null;
  }
}

module.exports = {
  getHWID,
  getLocalLicense,
  saveLocalLicense,
  initTrial,
  checkOfflineFraud
};
