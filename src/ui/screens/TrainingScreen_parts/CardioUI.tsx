/**
 * CardioUI.tsx — единый UI-слой кардио-конструктора: общие стили (карточки,
 * кнопки, чипы, инпуты) и переиспользуемые компоненты (SectionCard, StatTile,
 * Stepper, ChipToggle, SectionNav). Все вкладки используют эти примитивы,
 * чтобы структура и оформление были едиными.
 */
import React from 'react';

// ─── Единые стили ───

export const CARD: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 14, padding: 12, display: 'flex', flexDirection: 'column', gap: 10,
};
export const CARD_ACCENT: React.CSSProperties = { ...CARD, borderColor: 'rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.04)' };
export const ROW: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' };
export const LABEL: React.CSSProperties = { fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 };
export const HINT: React.CSSProperties = { fontSize: 10, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 };
export const BTN: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
  border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.04)',
  color: '#fff', minHeight: 40, whiteSpace: 'nowrap',
};
export const BTN_PRIMARY: React.CSSProperties = { ...BTN, background: 'rgba(0,230,138,0.18)', border: '1px solid rgba(0,230,138,0.5)', color: '#00e68a' };
export const BTN_DANGER: React.CSSProperties = { ...BTN, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171' };
export const BTN_SMALL: React.CSSProperties = { ...BTN, minHeight: 30, padding: '5px 10px', fontSize: 11 };
export const INPUT: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8, padding: '8px 10px', color: '#fff', fontSize: 12,
};
export const CHIP: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 9, fontSize: 11, fontWeight: 600, cursor: 'pointer',
  border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.03)',
  color: 'var(--text-dim)', whiteSpace: 'nowrap', minHeight: 34,
};
export const CHIP_ACTIVE: React.CSSProperties = { ...CHIP, border: '1px solid rgba(0,230,138,0.5)', background: 'rgba(0,230,138,0.14)', color: '#fff' };

export const PHASE_COLOR: Record<string, string> = {
  base: '#22c55e', build: '#3b82f6', maintenance: '#8b5cf6', contest_prep: '#f59e0b', taper: '#eab308', peak: '#ef4444', transition: '#71717a',
};

// ─── Компоненты ───

export const SectionCard: React.FC<{
  id?: string;
  title?: React.ReactNode;
  right?: React.ReactNode;
  accent?: boolean;
  hint?: string;
  children: React.ReactNode;
}> = ({ id, title, right, accent, hint, children }) => (
  <div style={accent ? CARD_ACCENT : CARD} id={id}>
    {title != null && (
      <div style={ROW}>
        <span style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>{title}</span>
        <span style={{ flex: 1 }} />
        {right}
      </div>
    )}
    {children}
    {hint && <div style={HINT}>{hint}</div>}
  </div>
);

export const StatTile: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color = '#94a3b8' }) => (
  <div style={{ flex: '1 1 84px', padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 2 }}>
    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</span>
    <span style={{ fontSize: 15, fontWeight: 800, color }}>{value}</span>
  </div>
);

export const Stepper: React.FC<{
  label?: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (n: number) => void;
  ariaPrefix?: string;
  suffix?: string;
  width?: number;
}> = ({ label, value, min, max, onChange, ariaPrefix, suffix, width }) => (
  <div style={ROW}>
    {label && <span style={LABEL}>{label}</span>}
    <button style={BTN_SMALL} onClick={() => onChange(Math.max(min ?? -Infinity, value - 1))} aria-label={`${ariaPrefix ?? ''} меньше`}>−</button>
    <span style={{ fontSize: 14, fontWeight: 800, minWidth: width ?? 26, textAlign: 'center' }}>{value}</span>
    <button style={BTN_SMALL} onClick={() => onChange(Math.min(max ?? Infinity, value + 1))} aria-label={`${ariaPrefix ?? ''} больше`}>+</button>
    {suffix && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{suffix}</span>}
  </div>
);

export const ChipToggle: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
}> = ({ active, onClick, children, ariaLabel, disabled }) => (
  <button
    style={{ ...(active ? CHIP_ACTIVE : CHIP), opacity: disabled ? 0.4 : 1 }}
    onClick={onClick}
    disabled={disabled}
    aria-label={ariaLabel}
  >
    {children}
  </button>
);

export const NoteList: React.FC<{ items: string[]; color?: string }> = ({ items, color }) => (
  <div style={{ fontSize: 10, color: color ?? 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
    {items.map((it, i) => <div key={i}>• {it}</div>)}
  </div>
);

export const InfoBanner: React.FC<{ tone?: 'ok' | 'warn' | 'info'; children: React.ReactNode }> = ({ tone = 'info', children }) => {
  const palette = tone === 'warn'
    ? { color: '#fbbf24', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)' }
    : tone === 'ok'
      ? { color: '#4ade80', bg: 'rgba(0,230,138,0.07)', border: 'rgba(0,230,138,0.25)' }
      : { color: '#93c5fd', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.28)' };
  return (
    <div role="status" style={{ fontSize: 11, color: palette.color, background: palette.bg, border: `1px solid ${palette.border}`, borderRadius: 8, padding: '7px 10px' }}>
      {children}
    </div>
  );
};

export const SectionNav: React.FC<{ items: { id: string; label: string }[] }> = ({ items }) => {
  const goTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {items.map(n => (
        <button key={n.id} style={{ ...BTN_SMALL, fontSize: 10 }} onClick={() => goTo(n.id)} aria-label={`К разделу ${n.label}`}>{n.label}</button>
      ))}
    </div>
  );
};

export const GroupHeading: React.FC<{ icon: string; text: string; desc?: string }> = ({ icon, text, desc }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 4 }}>
    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent, #00e68a)' }}>{icon} {text}</span>
    {desc && <span style={HINT}>{desc}</span>}
    <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '2px 0 2px' }} />
  </div>
);
