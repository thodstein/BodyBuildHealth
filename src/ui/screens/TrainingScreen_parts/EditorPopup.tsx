/**
 * EditorPopup.tsx — общий попап-выбор для ручного конструктора.
 * Замена нативных <select>: нативный попап рендерится в светлой схеме ОС
 * (белый фон + белый текст тёмной темы → опции невидимы). Попап-карточки:
 * тёмный sheet в portal на body, единый стиль редактора.
 *
 * EditorPopupSelect — выбор из списка опций (label + desc).
 * EditorPopupNumber — выбор числа из диапазона (недели/сессии).
 */
import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { ACCENT, IN } from './training-ui';

const EditorOverlay: React.FC<{ onClose: () => void; children: React.ReactNode }> = ({ onClose, children }) => {
  if (typeof document === 'undefined') return null;
  return ReactDOM.createPortal(
    <div data-testid="editor-popup-overlay" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)' }}>
      {children}
    </div>,
    document.body,
  );
};

const editorSheet: React.CSSProperties = {
  width: '92%', maxWidth: 340, maxHeight: '78vh', borderRadius: 16,
  background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden',
};

const editorSheetCloseBtn: React.CSSProperties = {
  width: '100%', marginTop: 12, padding: '10px', minHeight: 44, borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.1)', background: 'transparent',
  color:'rgba(255,255,255,0.9)', fontWeight: 700, fontSize: 12, cursor: 'pointer',
  touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
};

const editorOptionBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
  width: '100%', minHeight: 44, padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
  textAlign: 'left', fontSize: 11, position: 'relative',
  touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
};

export interface EditorPopupOption {
  id: string;
  label: string;
  desc?: string;
}

/** Попап-выбор опции (замена нативного select). */
export const EditorPopupSelect: React.FC<{
  value: string;
  options: Array<EditorPopupOption>;
  onChange: (v: string) => void;
  title?: string;
  ariaLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  buttonStyle?: React.CSSProperties;
}> = ({ value, options, onChange, title = 'Выберите', ariaLabel, placeholder = '—', disabled, buttonStyle }) => {
  const [open, setOpen] = useState(false);
  const sel = options.find(o => o.id === value);
  return (
    <>
      <button type="button" aria-label={ariaLabel} onClick={() => setOpen(true)}
        disabled={disabled}
        style={{ ...IN, padding: '6px 8px', fontSize: 11, minHeight: 44, flex: '0 0 auto', cursor: 'pointer', fontWeight: 700, textAlign: 'center', opacity: disabled ? 0.4 : 1, touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent', ...buttonStyle }}>
        {sel?.label ?? placeholder}
      </button>
      {open && (
        <EditorOverlay onClose={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={editorSheet}>
            <div style={{ height: 3, background: 'linear-gradient(90deg,#00e68a,#00c853)' }} />
            <div style={{ padding: '14px 16px', maxHeight: 'calc(78vh - 3px)', overflowY: 'auto', overscrollBehavior: 'contain', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.2) transparent' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT, marginBottom: 10 }}>{title}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {options.map(o => {
                  const isSel = o.id === value;
                  return (
                    <button key={o.id} type="button" onClick={() => { onChange(o.id); setOpen(false); }}
                      style={{ ...editorOptionBtn, flexDirection: 'column', alignItems: 'stretch',
                        background: isSel ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)',
                        border: isSel ? '1px solid rgba(0,230,138,0.3)' : '1px solid rgba(255,255,255,0.06)',
                        color: isSel ? ACCENT : 'rgba(255,255,255,0.85)', fontWeight: isSel ? 700 : 400 }}>
                      <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <span style={{ minWidth: 0 }}>{o.label}</span>
                        {isSel && <span style={{ fontSize: 10 }}>✓</span>}
                      </span>
                      {o.desc && <span style={{ fontSize: 10, color: isSel ? 'rgba(0,230,138,0.75)' : 'rgba(255,255,255,0.85)', fontWeight: 400, marginTop: 2 }}>{o.desc}</span>}
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setOpen(false)} style={editorSheetCloseBtn}>Закрыть</button>
            </div>
          </div>
        </EditorOverlay>
      )}
    </>
  );
};

/** Попап-выбор числа из диапазона (недели/сессии). */
export const EditorPopupNumber: React.FC<{
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  title?: string;
  ariaLabel?: string;
  format?: (v: number) => string;
  buttonStyle?: React.CSSProperties;
}> = ({ value, min, max, onChange, title = 'Выберите', ariaLabel, format = v => String(v), buttonStyle }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" aria-label={ariaLabel} onClick={() => setOpen(true)}
        style={{ ...IN, padding: '6px 8px', fontSize: 11, minHeight: 44, flex: '0 0 auto', cursor: 'pointer', fontWeight: 700, textAlign: 'center', touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent', ...buttonStyle }}>
        {format(value)}
      </button>
      {open && (
        <EditorOverlay onClose={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={editorSheet}>
            <div style={{ height: 3, background: 'linear-gradient(90deg,#00e68a,#00c853)' }} />
            <div style={{ padding: '14px 16px', maxHeight: 'calc(78vh - 3px)', overflowY: 'auto', overscrollBehavior: 'contain', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.2) transparent' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT, marginBottom: 10 }}>{title}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {Array.from({ length: Math.max(0, max - min + 1) }, (_, i) => min + i).map(v => {
                  const isSel = v === value;
                  return (
                    <button key={v} type="button" onClick={() => { onChange(v); setOpen(false); }}
                      style={{ ...editorOptionBtn,
                        background: isSel ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)',
                        border: isSel ? '1px solid rgba(0,230,138,0.3)' : '1px solid rgba(255,255,255,0.06)',
                        color: isSel ? ACCENT : 'rgba(255,255,255,0.85)', fontWeight: isSel ? 700 : 400 }}>
                      <span>{format(v)}</span>
                      {isSel && <span style={{ fontSize: 10 }}>✓</span>}
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setOpen(false)} style={editorSheetCloseBtn}>Закрыть</button>
            </div>
          </div>
        </EditorOverlay>
      )}
    </>
  );
};