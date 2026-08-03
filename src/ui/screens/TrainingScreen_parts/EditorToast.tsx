/**
 * EditorToast.tsx — V6: Toast component with success/warning/error variants.
 *
 * Replaces the plain <div> editorToast in ProgramEditorView with a styled
 * component that has icons, colors, and slide-in animation.
 */
import React, { useState, useCallback, useRef, type ReactNode } from 'react';
import { UI_METRICS } from './training-ui';

export type ToastVariant = 'success' | 'warning' | 'error' | 'info';

interface ToastState {
  message: string;
  variant: ToastVariant;
  visible: boolean;
}

const VARIANT_META: Record<ToastVariant, { icon: string; color: string; bg: string; border: string }> = {
  success: { icon: '✅', color: '#00e68a', bg: 'rgba(0,230,138,0.12)', border: 'rgba(0,230,138,0.4)' },
  warning: { icon: '⚠', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.4)' },
  error: { icon: '✕', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.4)' },
  info: { icon: 'ℹ', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.4)' },
};

export function useEditorToast(): {
  toast: ToastState;
  showToast: (message: string, variant?: ToastVariant) => void;
  ToastNode: ReactNode;
} {
  const [toast, setToast] = useState<ToastState>({ message: '', variant: 'success', visible: false });
  const timerRef = useRef<number | null>(null);

  const showToast = useCallback((message: string, variant: ToastVariant = 'success') => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setToast({ message, variant, visible: true });
    timerRef.current = window.setTimeout(() => {
      setToast((s) => ({ ...s, visible: false }));
    }, UI_METRICS.toastMs);
  }, []);

  const meta = VARIANT_META[toast.variant];

  const ToastNode = toast.visible ? (
    <div
      style={{
        padding: '8px 14px',
        background: meta.bg,
        borderLeft: `3px solid ${meta.color}`,
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 700,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        animation: 'editorToastSlideIn 0.2s ease-out',
      }}
    >
      <span style={{ fontSize: 14 }}>{meta.icon}</span>
      <span style={{ flex: 1 }}>{toast.message}</span>
    </div>
  ) : null;

  return { toast, showToast, ToastNode };
}
