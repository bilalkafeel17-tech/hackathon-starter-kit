import { useEffect } from 'react';
import { Toast } from '../types';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

interface ToastProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export default function ToastContainer({ toasts, onDismiss }: ToastProps) {
  return (
    <div
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 20,
        right: 20,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        maxWidth: 380,
        width: '100%',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const config = {
    success: {
      color: 'var(--color-success)',
      bg: 'var(--color-surface)',
      border: 'var(--color-success)',
      Icon: CheckCircle2,
    },
    warning: {
      color: 'var(--color-warning)',
      bg: 'var(--color-surface)',
      border: 'var(--color-warning)',
      Icon: AlertTriangle,
    },
    danger: {
      color: 'var(--color-danger)',
      bg: 'var(--color-surface)',
      border: 'var(--color-danger)',
      Icon: AlertCircle,
    },
    info: {
      color: 'var(--color-info)',
      bg: 'var(--color-surface)',
      border: 'var(--color-info)',
      Icon: Info,
    },
  }[toast.type] || {
    color: 'var(--color-text)',
    bg: 'var(--color-surface)',
    border: 'var(--color-border)',
    Icon: Info,
  };

  const IconComponent = config.Icon;

  return (
    <div
      role="alert"
      style={{
        pointerEvents: 'auto',
        backgroundColor: config.bg,
        border: '1px solid var(--color-border)',
        borderLeft: `4px solid ${config.border}`,
        borderRadius: 'var(--radius-control)',
        padding: '12px 14px',
        boxShadow: 'var(--shadow-overlay)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <IconComponent size={18} strokeWidth={1.75} color={config.color} style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1, fontSize: 13.5, color: 'var(--color-text)', lineHeight: 1.4 }}>
        {toast.message}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        style={{
          background: 'none',
          border: 'none',
          padding: 2,
          cursor: 'pointer',
          color: 'var(--color-text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <X size={16} strokeWidth={1.75} />
      </button>

      {/* Solid color auto-dismiss progress line */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 2,
          backgroundColor: config.border,
          animation: 'toastProgress 4s linear forwards',
        }}
      />
      <style>{`
        @keyframes toastProgress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}
