/**
 * Configurações de licenciamento do sistema
 * ATENÇÃO: O servidor PetWay Licensing monta rotas em /api/license (sem /v1)
 * /api/v1 existe APENAS para webhooks (Mercado Pago)
 */

const IS_PROD = import.meta.env.PROD;

// Base URL lida do .env (VITE_ prefix para Vite injetar no frontend)
// Fallback correto: /api sem /v1
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://137.131.216.152:3333/api';

export const LICENSE_CONFIG = {
  // Endereço da API de licenciamento
  API_BASE_URL: IS_PROD
    ? 'https://api.petway.com.br/api'  // Produção (sem /v1 — rotas em /api/license)
    : 'http://137.131.216.152:3333/api', // Desenvolvimento

  // Timeout para requisições de rede (ms)
  TIMEOUT: 5000,

  // Período máximo de funcionamento offline sem revalidação (dias)
  OFFLINE_TOKEN_EXPIRATION_DAYS: 7,

  // Período de trial inicial (dias)
  TRIAL_PERIOD_DAYS: 30,
};
