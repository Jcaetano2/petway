import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

const ToastContext = createContext();

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Math.random().toString(36).substr(2, 9);
    
    setToasts((prev) => {
      // Limite de 3 toasts simultâneos
      const newToasts = [...prev, { id, message, type, duration }];
      if (newToasts.length > 3) {
        return newToasts.slice(1);
      }
      return newToasts;
    });

    if (duration !== Infinity) {
      setTimeout(() => removeToast(id), duration);
    }
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      {/* Toast Container - Non-blocking */}
      <div style={{
        position: 'fixed',
        top: '24px',
        right: '24px',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        pointerEvents: 'none', // Important: clicks pass through container
        maxWidth: '320px',
        width: '100%'
      }}>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onRemove }) {
  const { type, message } = toast;

  const styles = {
    success: { bg: 'rgba(16, 185, 129, 0.1)', border: '#10B981', color: '#10B981', icon: CheckCircle },
    error: { bg: 'rgba(239, 68, 68, 0.1)', border: '#EF4444', color: '#EF4444', icon: AlertCircle },
    warning: { bg: 'rgba(245, 158, 11, 0.1)', border: '#F59E0B', color: '#F59E0B', icon: AlertTriangle },
    info: { bg: 'rgba(59, 130, 246, 0.1)', border: '#3B82F6', color: '#3B82F6', icon: Info }
  };

  const current = styles[type] || styles.info;
  const Icon = current.icon;

  return (
    <div 
      className="animate-fade"
      style={{
        pointerEvents: 'auto', // Allows clicking the toast itself if needed, but usually we just want them passive
        backgroundColor: 'var(--bg-secondary)',
        border: `1px solid ${current.border}`,
        borderRadius: '8px',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        color: 'var(--text-primary)',
        fontSize: '14px',
        fontWeight: '500'
      }}
    >
      <Icon size={18} color={current.color} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, lineHeight: '1.4' }}>{message}</div>
      {/* No focusable button here to avoid stealing focus */}
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
