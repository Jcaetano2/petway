import React, { useEffect, useRef } from 'react';
import { X, AlertTriangle, HelpCircle, CheckCircle } from 'lucide-react';

export default function ModalConfirm({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmLabel = 'Confirmar', 
  cancelLabel = 'Cancelar', 
  type = 'warning' 
}) {
  const confirmBtnRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      // Pequeno delay para garantir que o modal renderizou e pode aceitar foco
      setTimeout(() => {
        confirmBtnRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const styles = {
    warning: { color: 'var(--warning)', icon: AlertTriangle },
    danger: { color: 'var(--danger)', icon: AlertTriangle },
    info: { color: 'var(--info)', icon: HelpCircle },
    success: { color: 'var(--success)', icon: CheckCircle },
  };

  const current = styles[type] || styles.info;
  const Icon = current.icon;

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        zIndex: 11000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(2px)'
      }}
      onClick={onClose}
    >
      <div 
        className="card animate-fade"
        style={{
          width: '90%',
          maxWidth: '440px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ 
            width: '48px', 
            height: '48px', 
            borderRadius: '50%', 
            backgroundColor: `${current.color}15`, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center' 
          }}>
            <Icon size={24} color={current.color} />
          </div>
          <div>
            <h3 style={{ fontSize: '18px', margin: 0, color: 'var(--text-primary)' }}>{title}</h3>
          </div>
        </div>

        <div style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6' }}>
          {message}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
          {onClose && cancelLabel && (
            <button 
              className="btn-outline" 
              onClick={onClose}
              style={{ padding: '10px 20px' }}
            >
              {cancelLabel}
            </button>
          )}
          <button 
            ref={confirmBtnRef}
            className="btn" 
            onClick={() => {
              onConfirm();
              if (!onConfirm.async) onClose(); // se não for async, fecha na hora
            }}
            style={{ 
              backgroundColor: type === 'danger' ? 'var(--danger)' : 'var(--primary)',
              padding: '10px 20px'
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
