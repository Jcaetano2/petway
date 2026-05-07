import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import licenseService from '../services/licenseService';
import { LICENSE_CONFIG } from '../config/licenseConfig';

const LicenseContext = createContext();

export const useLicense = () => {
  const context = useContext(LicenseContext);
  if (!context) throw new Error('useLicense must be used within a LicenseProvider');
  return context;
};

export const LicenseProvider = ({ children }) => {
  const [license, setLicense] = useState(null);
  const [isValid, setIsValid] = useState(true); // Default high for smooth startup
  const [isTrial, setIsTrial] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [licenseType, setLicenseType] = useState('trial');
  const [planType, setPlanType] = useState('monthly'); // monthly, lifetime
  const [supportUntil, setSupportUntil] = useState(null);
  const [licenseStatus, setLicenseStatus] = useState('active');
  const [errorMessage, setErrorMessage] = useState('');
  const [hwid, setHwid] = useState('');

  const calcularDiasRestantes = useCallback((expiresAt) => {
    if (!expiresAt) return 0;
    const diff = new Date(expiresAt) - new Date();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, []);

  const checkLicenseOnStartup = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    
    try {
      console.log('[LicenseContext] Iniciando verificação de licença...');
      // 1. Get HWID from Electron
      const machineId = await window.api.licenseGetHWID();
      setHwid(machineId);
      console.log('[LicenseContext] HWID:', machineId);

      // 2. Get local status from SQLite — IPC returns { success, data }
      const localRaw = await window.api.licenseGetLocalStatus();
      const local = localRaw?.data || null;
      console.log('[LicenseContext] Status Local:', local);
      
      // 3. Handle First Run / Trial
      if (!local || (!local.key && !local.token)) {
        console.log('[LicenseContext] Nenhuma licença local encontrada. Iniciando modo Trial.');
        const firstRunDate = await window.api.licenseInitTrial();
        const start = new Date(firstRunDate);
        const now = new Date();
        const daysUsed = Math.floor((now - start) / (1000 * 60 * 60 * 24));
        const daysLeft = Math.max(0, LICENSE_CONFIG.TRIAL_PERIOD_DAYS - daysUsed);
        
        setIsTrial(true);
        setLicenseType('trial');
        setIsValid(daysLeft > 0);
        setLicense({ 
          key: 'TRIAL-MODE', 
          expiresAt: new Date(start.getTime() + LICENSE_CONFIG.TRIAL_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString(),
          daysLeft 
        });
        setIsLoading(false);
        return;
      }

      // 4. Try Online Validation
      try {
        console.log('[LicenseContext] Tentando validação online para chave:', local.key);
        const result = await licenseService.validate(local.key);
        console.log('[LicenseContext] Validação Online Sucesso:', result);
        
        // Success Online: update local DB
        await window.api.licenseSaveLocalStatus({
          key: local.key,
          token: result.token,
          expiresAt: result.expiresAt,
          type: result.type,
          planType: result.planType,
          supportUntil: result.supportUntil,
          status: result.status // persist latest status
        });

        setLicense({ key: local.key, expiresAt: result.expiresAt });
        setLicenseType(result.type || 'standard');
        setPlanType(result.planType || 'monthly');
        setSupportUntil(result.supportUntil || null);
        setLicenseStatus(result.status || 'active');
        
        if (result.status === 'suspended' || result.status === 'revoked') {
          setIsValid(false);
          setErrorMessage(`Licença ${result.status === 'suspended' ? 'suspensa' : 'revogada'}.`);
        } else {
          setIsValid(true);
        }
        
        setIsOffline(false);
        setIsTrial(false);
      } catch (onlineError) {
        // Detecta erros de rede: timeout (AbortError), falha de conexão, etc.
        const isNetworkError = 
          onlineError.name === 'AbortError' ||
          onlineError.message === 'network_timeout' || 
          onlineError.message === 'Failed to fetch' || 
          onlineError.message.includes('NetworkError') ||
          onlineError.message.includes('fetch') ||
          onlineError.message.includes('ECONNREFUSED') ||
          onlineError.message.includes('ERR_CONNECTION_REFUSED');

        // Licença Expirada (Offline) vem do IPC backend quando não há conexão + expirada localmente
        // NÃO é uma revogação — deve mostrar o bloqueio mas permitir ativação de nova chave
        const isExpiredOffline = onlineError.message === 'Licença Expirada (Offline)';
        
        if (isNetworkError || isExpiredOffline) {
          console.warn('[LicenseContext] Servidor de licenciamento inacessível ou licença expirada offline.', onlineError.message);
          setIsOffline(true);
          
          const isSuspended = local.status === 'suspended' || local.status === 'revoked';
          const isExpired = isExpiredOffline || (local.expiresAt ? licenseService.isTokenExpired(local.expiresAt) : true);

          if (isSuspended) {
            setIsValid(false);
            setLicenseStatus(local.status || 'suspended');
            setErrorMessage('Licença suspensa ou revogada administrativamente.');
          } else if (isExpired) {
            setIsValid(false);
            setLicenseStatus('expired');
            setErrorMessage('Licença expirada. Ative uma nova chave para continuar.');
            // IMPORTANTE: NÃO sobrescrever o status local — o usuário precisa poder ativar nova chave
          } else {
            setIsValid(true);
            setLicense({ key: local.key, expiresAt: local.expiresAt });
            setLicenseType(local.type || 'standard');
            setPlanType(local.planType || 'monthly');
            setSupportUntil(local.supportUntil || null);
            console.log('[LicenseContext] Licença offline validada com sucesso.');
          }
        } else {
          // Erro genuíno retornado pelo SERVIDOR (ex: chave não encontrada, HWID diferente)
          // Apenas nesses casos confirmamos a revogação
          console.error('[LicenseContext] Servidor rejeitou a licença:', onlineError.message);
          setIsOffline(false);
          setIsValid(false);
          setLicenseStatus('revoked');
          setErrorMessage(onlineError.message || 'Licença inválida ou rejeitada pelo servidor.');
          // Só salva revoked se o SERVIDOR confirmou explicitamente
          if (onlineError.message && !onlineError.message.includes('Offline')) {
            await window.api.licenseSaveLocalStatus({ ...local, status: 'revoked' });
          }
        }
      }
    } catch (globalError) {
      console.error('[LicenseContext] Erro fatal no licenciamento:', globalError);
      setErrorMessage('Erro crítico ao validar licença.');
      setIsValid(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const activate = async (key) => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const machineId = hwid || await window.api.licenseGetHWID();
      const result = await licenseService.activate(key, machineId);
      
      await window.api.licenseSaveLocalStatus({
        key,
        token: result.token,
        expiresAt: result.expiresAt,
        type: result.type,
        planType: result.planType,
        supportUntil: result.supportUntil,
        status: result.status // save the status from activation
      });

      setLicense({ key, expiresAt: result.expiresAt });
      setLicenseType(result.type);
      setPlanType(result.planType || 'monthly');
      setSupportUntil(result.supportUntil);
      setLicenseStatus(result.status || 'active');
      setIsValid(result.status !== 'suspended' && result.status !== 'revoked');
      setIsTrial(false);
      setIsOffline(false);
      return { success: true };
    } catch (error) {
      setErrorMessage(error.message);
      return { success: false, message: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const revalidate = async () => {
    if (!license || !license.key || isTrial) return;
    await checkLicenseOnStartup();
  };

  // periodic heartbeat (every 1 hour if online)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isOffline && license && license.key && !isTrial) {
        licenseService.heartbeat(license.key, hwid).then(result => {
          if (result) {
             // BUG-10 FIX: salvar lastOnlineDate para que o anti-fraude offline funcione
             window.api.licenseSaveLocalStatus({
               key: license.key,
               token: result.token,
               expiresAt: result.expiresAt,
               type: licenseType, // keep current type
               status: result.status, // update status from heartbeat
               lastOnlineDate: Date.now()
             });
          }
        });
      }
    }, 60 * 60 * 1000); 

    return () => clearInterval(interval);
  }, [license, hwid, isOffline, isTrial, licenseType]);

  useEffect(() => {
    checkLicenseOnStartup();
  }, [checkLicenseOnStartup]);

  return (
    <LicenseContext.Provider value={{
      license,
      isValid,
      isTrial,
      isOffline,
      isLoading,
      licenseType,
      planType,
      supportUntil,
      licenseStatus,
      errorMessage,
      activate,
      revalidate,
      checkLicenseOnStartup,
      calcularDiasRestantes,
      hwid
    }}>
      {children}
    </LicenseContext.Provider>
  );
};
