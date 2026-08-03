/**
 * ConfirmDialog.tsx — F4: replacement for window.confirm() with app-style glass UI.
 *
 * Usage:
 *   const { confirm } = useConfirmDialog();
 *   const ok = await confirm({ title: 'Удалить?', message: 'Будет потеряно N элементов', confirmLabel: 'Удалить', danger: true });
 *   if (ok) doDelete();
 */
import React, { useState, useCallback, useRef, createContext, useContext, type ReactNode } from 'react';
import { ACCENT, BTN, BTN_GHOST } from './training-ui';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ConfirmDialogState {
  open: boolean;
  options: ConfirmOptions;
  resolve: ((ok: boolean) => void) | null;
}

const ConfirmDialogContext = createContext<{ confirm: (opts: ConfirmOptions) => Promise<boolean> } | null>(null);

export const ConfirmDialogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<ConfirmDialogState>({ open: false, options: { message: '' }, resolve: null });
  const cancelRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setState({ open: true, options: opts, resolve });
    });
  }, []);

  const handleClose = (ok: boolean) => {
    state.resolve?.(ok);
    setState({ open: false, options: { message: '' }, resolve: null });
  };

  const danger = state.options.danger;
  const confirmColor = danger ? '#ef4444' : ACCENT;
  const confirmBg = danger
    ? 'linear-gradient(135deg,#ef4444,#dc2626)'
    : 'linear-gradient(135deg,#00e68a,#00c8a0)';

  return (
    <ConfirmDialogContext.Provider value={{ confirm }}>
      {children}
      {state.open && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(false); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
        >
          <div
            style={{
              background: 'rgba(26,28,38,0.95)', backdropFilter: 'blur(20px) saturate(160%)',
              border: `1px solid ${confirmColor}44`, borderRadius: 16, padding: 20,
              maxWidth: 360, width: '100%', boxShadow: `0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px ${confirmColor}22`,
            }}
          >
            {state.options.title && (
              <div style={{ fontSize: 14, fontWeight: 800, color: confirmColor, marginBottom: 8 }}>
                {danger ? '⚠ ' : ''}{state.options.title}
              </div>
            )}
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5, marginBottom: 16 }}>
              {state.options.message}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                ref={cancelRef}
                onClick={() => handleClose(false)}
                style={{ ...BTN_GHOST, flex: 1, borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)' }}
              >
                {state.options.cancelLabel || 'Отмена'}
              </button>
              <button
                autoFocus
                onClick={() => handleClose(true)}
                style={{ ...BTN, flex: 1, background: confirmBg, color: danger ? '#fff' : '#06281c' }}
              >
                {state.options.confirmLabel || 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmDialogContext.Provider>
  );
};

export function useConfirmDialog(): { confirm: (opts: ConfirmOptions) => Promise<boolean> } {
  const ctx = useContext(ConfirmDialogContext);
  if (!ctx) {
    // Fallback to window.confirm if provider is not mounted (e.g., in tests)
    return {
      confirm: (opts: ConfirmOptions) => Promise.resolve(window.confirm(opts.message)),
    };
  }
  return ctx;
}