/**
 * Serviço de comunicação com o módulo de segurança do Electron (IPC)
 * Todas as requisições externas e persistência criptografada ocorrem no backend.
 * Usa exclusivamente window.api (exposto pelo preload via contextBridge).
 */
class LicenseService {
  /**
   * Ativa uma licença delegando para o processo principal do Electron.
   * O backend (ipcHandlers) gera o HWID, faz a chamada de rede e criptografa.
   */
  async activate(key) {
    try {
      const response = await window.api.licenseActivate(key);

      if (!response.success) {
        throw new Error(response.error || 'Falha ao ativar licença');
      }

      return {
        success: true,
        token: response.token,
        expiresAt: response.expiresAt,
        type: response.type,
        planType: response.planType,
        supportUntil: response.supportUntil,
        status: response.status
      };
    } catch (error) {
      console.error('License Activation Error:', error);
      throw error;
    }
  }

  /**
   * Valida a licença delegando para o processo principal do Electron.
   * O Electron lida com verificação online ou validação local antifraude.
   */
  async validate(key) {
    try {
      const response = await window.api.licenseValidate(key);

      if (!response.success) {
        throw new Error(response.error || 'Falha ao validar licença');
      }

      return {
        success: true,
        token: response.token,
        expiresAt: response.expiresAt,
        status: response.status,
        type: response.type,
        planType: response.planType,
        supportUntil: response.supportUntil,
        offline: response.offline
      };
    } catch (error) {
      console.error('License Validation Error:', error);
      throw error;
    }
  }

  /**
   * Heartbeat para renovar o token (via IPC — reutiliza validate).
   */
  async heartbeat(key) {
    try {
      const response = await window.api.licenseValidate(key);
      if (!response.success) return null;

      return {
        token: response.token,
        expiresAt: response.expiresAt,
        status: response.status
      };
    } catch (error) {
      return null; // Silent fail para heartbeat
    }
  }

  /**
   * Verificação visual rápida se a data de expiração passou.
   * null = licença vitalícia = nunca expira.
   * Nota: A verdadeira barreira de segurança reside no IPC Backend.
   */
  isTokenExpired(expiresAt) {
    if (!expiresAt) return false; // null = vitalício, nunca expira
    const expiry = new Date(expiresAt);
    return new Date() > expiry;
  }
}

export default new LicenseService();
