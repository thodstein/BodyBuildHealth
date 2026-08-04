import React, { useEffect, useRef } from 'react';

interface TrainingModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}

/** Shared dialog shell for constructor libraries and planner tools. */
export const TrainingModal: React.FC<TrainingModalProps> = ({ title, onClose, children, wide = false }) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      role="presentation"
      className="training-modal-backdrop"
      onMouseDown={event => { if (event.currentTarget === event.target) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        style={{ width: '100%', maxWidth: wide ? 980 : 760, maxHeight: 'calc(100dvh - 24px)', overflowY: 'auto', background: 'var(--card-bg, #18181b)', border: '1px solid var(--border-light, rgba(255,255,255,0.12))', borderRadius: 16, padding: 12, outline: 'none', boxShadow: '0 20px 70px rgba(0,0,0,0.5)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
          <strong style={{ color: 'var(--text, #fff)', fontSize: 14 }}>{title}</strong>
          <button type="button" aria-label="Закрыть окно" onClick={onClose} style={{ minWidth: 44, minHeight: 44, border: '1px solid var(--border, rgba(255,255,255,0.12))', borderRadius: 10, background: 'transparent', color: 'var(--text-dim, #aaa)', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
};
