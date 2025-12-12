import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const TOAST_DURATION = 3000; // 3 seconds

export const useToast = () => {
  const [toasts, setToasts] = useState([]);

  const showToast = (message, type = 'info', duration = TOAST_DURATION) => {
    const id = Date.now() + Math.random();
    const toast = { id, message, type, duration };
    
    setToasts(prev => [...prev, toast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }

    return id;
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const success = (message, duration) => showToast(message, 'success', duration);
  const error = (message, duration) => showToast(message, 'error', duration);
  const info = (message, duration) => showToast(message, 'info', duration);
  const warning = (message, duration) => showToast(message, 'warning', duration);

  return { toasts, showToast, removeToast, success, error, info, warning };
};

export default function ToastContainer({ toasts, onRemove }) {
  const { t } = useTranslation();

  const getToastStyles = (type) => {
    const baseStyles = {
      padding: '12px 20px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      minWidth: '300px',
      maxWidth: '500px',
      animation: 'slideIn 0.3s ease-out',
      position: 'relative',
      zIndex: 10000
    };

    const typeStyles = {
      success: {
        backgroundColor: '#10b981',
        color: '#fff',
        borderLeft: '4px solid #059669'
      },
      error: {
        backgroundColor: '#ef4444',
        color: '#fff',
        borderLeft: '4px solid #dc2626'
      },
      info: {
        backgroundColor: '#3b82f6',
        color: '#fff',
        borderLeft: '4px solid #2563eb'
      },
      warning: {
        backgroundColor: '#f59e0b',
        color: '#fff',
        borderLeft: '4px solid #d97706'
      }
    };

    return { ...baseStyles, ...typeStyles[type] };
  };

  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        );
      case 'error':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        );
      case 'warning':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        );
      default:
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        );
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        pointerEvents: 'none'
      }}
    >
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes slideOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
      `}</style>
      {toasts.map(toast => (
        <div
          key={toast.id}
          style={{
            ...getToastStyles(toast.type),
            pointerEvents: 'auto'
          }}
          onClick={() => onRemove(toast.id)}
        >
          {getIcon(toast.type)}
          <span style={{ flex: 1 }}>{toast.message}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(toast.id);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              padding: '0',
              display: 'flex',
              alignItems: 'center',
              opacity: 0.8
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

