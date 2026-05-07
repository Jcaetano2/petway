import React from 'react';
import defaultLogo from '../../assets/PetWay.png';

/**
 * BrandLogo - Componente central de identidade visual da PetWay
 * 
 * @param {string} size - 'sm' (40px), 'md' (80px), 'lg' (160px)
 * @param {string} logoPath - Caminho relativo da logo customizada da clínica (opcional)
 * @param {number} logoTs - Timestamp para cache buster
 * @param {string} className - Classes adicionais
 */
export default function BrandLogo({ size = 'md', logoPath = null, logoTs = null, className = '' }) {
  const dimensions = {
    sm: { wrapper: 40 },
    md: { wrapper: 80 },
    lg: { wrapper: 160 },
    sidebar: { wrapper: 50 },
    login: { wrapper: 120 }
  }[size] || { wrapper: 80 };

  // Estilos base do container da imagem
  const wrapperStyle = {
    width: dimensions.wrapper,
    height: dimensions.wrapper,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  };

  // Estilos da imagem para garantir que ela caiba contida e mantenha a proporção
  const imgStyle = {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain'
  };

  // Prioridade 1: Logo customizada do usuário (feita upload pelas configurações)
  if (logoPath) {
    const timestamp = logoTs || Date.now();
    return (
      <div className={className} style={wrapperStyle}>
        <img 
          src={`brand-logo://${logoPath}?t=${timestamp}`} 
          alt="Logo do Pet Shop"
          style={imgStyle}
          onError={(e) => {
            // Em caso de erro na logo customizada (arquivo deletado, etc), faz o fallback para a logo oficial
            e.target.onerror = null; // Previne loop infinito
            e.target.src = defaultLogo;
            e.target.alt = "PetWay Logo";
          }}
        />
      </div>
    );
  }

  // Prioridade 2: Logo padrão PetWay
  return (
    <div className={className} style={wrapperStyle}>
      <img 
        src={defaultLogo} 
        alt="PetWay Logo" 
        style={imgStyle}
      />
    </div>
  );
}