import React, { useState } from 'react';
import { Building2, ShoppingCart, Printer, DollarSign, Database, Settings, ChevronRight, FileCheck, Cpu, Palette, Shield } from 'lucide-react';
import ConfigEmpresa from './config/ConfigEmpresa';
import ConfigPDV from './config/ConfigPDV';
import ConfigImpressao from './config/ConfigImpressao';
import ConfigFinanceiro from './config/ConfigFinanceiro';
import ConfigBackup from './config/ConfigBackup';
import ConfigSistema from './config/ConfigSistema';
import ConfigIntegracoes from './config/ConfigIntegracoes';
import ConfigAparencia from './config/ConfigAparencia';
import ConfigLicenca from './config/ConfigLicenca';
import ConfigFiscal from './config/ConfigFiscal';

import { useLocation } from 'react-router-dom';

export default function Configuracoes() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(location.state?.activeTab || 'empresa');

  const menuItems = [
    { id: 'empresa', label: 'Empresa', icon: Building2 },
    { id: 'pdv', label: 'PDV', icon: ShoppingCart },
    { id: 'impressao', label: 'Impressão', icon: Printer },
    { id: 'financeiro', label: 'Caixa e Financeiro', icon: DollarSign },
    { id: 'fiscal', label: 'Fiscal NFC-e', icon: FileCheck },
    { id: 'aparencia', label: 'Aparência e Branding', icon: Palette },
    { id: 'integracoes', label: 'API / Integrações', icon: Cpu },
    { id: 'backup', label: 'Segurança e Backup', icon: Database },
    { id: 'licenca', label: 'Licença', icon: Shield },
    { id: 'sistema', label: 'Sistema', icon: Settings },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'empresa': return <ConfigEmpresa />;
      case 'pdv': return <ConfigPDV />;
      case 'impressao': return <ConfigImpressao />;
      case 'financeiro': return <ConfigFinanceiro />;
      case 'fiscal': return <ConfigFiscal />;
      case 'aparencia': return <ConfigAparencia />;
      case 'integracoes': return <ConfigIntegracoes />;
      case 'backup': return <ConfigBackup />;
      case 'licenca': return <ConfigLicenca />;
      case 'sistema': return <ConfigSistema />;
      default: return <ConfigEmpresa />;
    }
  };

  return (
    <div style={{ display: 'flex', gap: '24px', height: 'calc(100vh - 120px)' }}>
      {/* Menu Lateral Interno */}
      <div 
        className="card" 
        style={{ 
          width: '240px', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '4px',
          padding: '16px'
        }}
      >
        <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '12px', paddingLeft: '12px' }}>
          Parâmetros Globais
        </h3>
        
        {menuItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: isActive ? 'rgba(var(--primary-rgb), 0.1)' : 'transparent',
                color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                fontWeight: isActive ? '600' : '500',
                transition: 'all 0.2s ease',
              }}
              onMouseOver={e => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.color = '#E1E1E6';
                }
              }}
              onMouseOut={e => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Icon size={18} />
                {item.label}
              </div>
              {isActive && <ChevronRight size={16} />}
            </button>
          );
        })}
      </div>

      {/* Área de Conteúdo Dinâmica */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {renderContent()}
      </div>
    </div>
  );
}
