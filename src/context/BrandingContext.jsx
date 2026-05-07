import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

const BrandingContext = createContext();

export function BrandingProvider({ children }) {
  const [branding, setBranding] = useState({
    logo_path: null,
    nome_comercio: '',
    exibir_logo_cupom: 1,
    logoTs: Date.now(),
  });

  const loadBranding = useCallback(async () => {
    try {
      const cfg = await api.config.aparencia.get();
      if (cfg) {
        setBranding({
          logo_path: cfg.logo_path || null,
          nome_comercio: cfg.nome_comercio || '',
          exibir_logo_cupom: cfg.exibir_logo_cupom ?? 1,
          logoTs: Date.now(), // Invalida cache de imagem em todo o app
        });
      }
    } catch (e) {
      /* silencioso — branding é cosmético, não deve travar o app */
    }
  }, []);

  // Carrega no mount (startup do app)
  useEffect(() => {
    loadBranding();
  }, [loadBranding]);

  /**
   * Chamado após salvar aparência nas configurações.
   * Todos os componentes que consomem esse contexto re-renderizam automaticamente.
   */
  const refreshBranding = useCallback(() => {
    return loadBranding();
  }, [loadBranding]);

  return (
    <BrandingContext.Provider value={{ branding, refreshBranding }}>
      {children}
    </BrandingContext.Provider>
  );
}

/**
 * Hook utilitário para consumir o branding global.
 * @returns {{ branding: { logo_path, nome_comercio, exibir_logo_cupom, logoTs }, refreshBranding: () => Promise }}
 */
export function useBranding() {
  const ctx = useContext(BrandingContext);
  if (!ctx) {
    // Fallback seguro para componentes renderizados fora do provider (ex: Login)
    return {
      branding: { logo_path: null, nome_comercio: '', exibir_logo_cupom: 1, logoTs: Date.now() },
      refreshBranding: async () => {},
    };
  }
  return ctx;
}
