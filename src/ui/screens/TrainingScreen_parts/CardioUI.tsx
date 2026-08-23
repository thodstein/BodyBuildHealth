/**
 * CardioUI.tsx — единый UI-слой кардио-конструктора: общие стили (карточки,
 * кнопки, чипы, инпуты) и переиспользуемые компоненты (SectionCard, StatTile,
 * Stepper, ChipToggle, SectionNav). Все вкладки используют эти примитивы,
 * чтобы структура и оформление были едиными.
 */
import React from 'react';

// ─── Токены дизайна v2 ───
export const ACCENT = '#00e68a';
export const ACCENT_SOFT = 'rgba(0,230,138,0.14)';
export const ACCENT_BORDER = 'rgba(0,230,138,0.45)';
export const GLASS_BG = 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.015))';
export const GLASS_BORDER = 'rgba(255,255,255,0.08)';

// ─── Единые стили ───

export const CARD: React.CSSProperties = {
  background: GLASS_BG,
  border: `1px solid ${GLASS_BORDER}`,
  borderRadius: 16, padding: 14, display: 'flex', flexDirection: 'column', gap: 11,
  boxShadow: '0 4px 20px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.05)',
  backdropFilter: 'blur(6px)',
};
export const CARD_ACCENT: React.CSSProperties = {
  ...CARD,
  borderColor: ACCENT_BORDER,
  background: 'linear-gradient(180deg, rgba(0,230,138,0.12), rgba(0,230,138,0.03))',
  boxShadow: '0 4px 24px rgba(0,230,138,0.12), inset 0 1px 0 rgba(255,255,255,0.06)',
};
export const CARD_SOFT: React.CSSProperties = {
  ...CARD,
  background: 'rgba(255,255,255,0.02)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
};
export const ROW: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' };
export const ROW_TIGHT: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' };
export const LABEL: React.CSSProperties = { fontSize: 11, color: 'var(--text-dim)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, lineHeight: 1 };
export const LABEL_SM: React.CSSProperties = { fontSize: 10, color: 'rgba(255,255,255,0.85)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 };
export const HINT: React.CSSProperties = { fontSize: 11, color: 'rgba(255,255,255,0.52)', lineHeight: 1.55 };
export const HINT_SM: React.CSSProperties = { fontSize: 10, color: 'rgba(255,255,255,0.42)', lineHeight: 1.5 };
export const BTN: React.CSSProperties = {
  padding: '9px 14px', borderRadius: 10, fontSize: 12, fontWeight: 750, cursor: 'pointer',
  border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.05)',
  color: '#fff', minHeight: 40, whiteSpace: 'nowrap',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 1px 6px rgba(0,0,0,0.2)',
  transition: 'all 0.15s ease',
};
export const BTN_PRIMARY: React.CSSProperties = { ...BTN, background: 'linear-gradient(180deg, rgba(0,230,138,0.22), rgba(0,230,138,0.14))', border: `1px solid ${ACCENT_BORDER}`, color: ACCENT, boxShadow: '0 0 14px rgba(0,230,138,0.18), inset 0 1px 0 rgba(255,255,255,0.08)' };
export const BTN_GHOST: React.CSSProperties = { ...BTN, background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.75)' };
export const BTN_DANGER: React.CSSProperties = { ...BTN, background: 'rgba(239,68,68,0.11)', border: '1px solid rgba(239,68,68,0.32)', color: '#f87171' };
export const BTN_SMALL: React.CSSProperties = { ...BTN, minHeight: 32, padding: '6px 11px', fontSize: 11, borderRadius: 9 };
export const BTN_XS: React.CSSProperties = { ...BTN, minHeight: 28, padding: '4px 9px', fontSize: 11, borderRadius: 8 };
export const INPUT: React.CSSProperties = {
  background: 'rgba(255,255,255,0.055)', border: '1px solid rgba(255,255,255,0.13)',
  borderRadius: 10, padding: '9px 11px', color: '#fff', fontSize: 13,
  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.18)', outline: 'none',
};
export const CHIP: React.CSSProperties = {
  padding: '7px 13px', borderRadius: 10, fontSize: 12, fontWeight: 650, cursor: 'pointer',
  border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.035)',
  color: 'var(--text-dim)', whiteSpace: 'nowrap', minHeight: 36,
  transition: 'all 0.15s ease',
};
export const CHIP_ACTIVE: React.CSSProperties = {
  ...CHIP,
  border: `1px solid ${ACCENT_BORDER}`, background: ACCENT_SOFT, color: '#fff',
  boxShadow: '0 0 10px rgba(0,230,138,0.16), inset 0 1px 0 rgba(255,255,255,0.06)',
};
export const CHIP_MUTED: React.CSSProperties = {
  ...CHIP, opacity: 0.5, cursor: 'not-allowed',
};

export const PHASE_COLOR: Record<string, string> = {
  base: '#22c55e', build: '#3b82f6', maintenance: '#8b5cf6', contest_prep: '#f59e0b', taper: '#eab308', peak: '#ef4444', transition: '#64748b',
};
export const PHASE_BG: Record<string, string> = {
  base: 'rgba(34,197,94,0.14)', build: 'rgba(59,130,246,0.14)', maintenance: 'rgba(139,92,246,0.14)', contest_prep: 'rgba(245,158,11,0.14)', taper: 'rgba(234,179,8,0.14)', peak: 'rgba(239,68,68,0.14)', transition: 'rgba(100,116,139,0.14)',
};
export const TYPE_COLOR: Record<string, string> = { zone2: '#4ade80', miss: '#60a5fa', hiit: '#a78bfa', recovery: '#94a3b8' };

// ─── Компоненты ───

export const SectionCard: React.FC<{
  id?: string;
  title?: React.ReactNode;
  right?: React.ReactNode;
  accent?: boolean;
  hint?: string;
  children: React.ReactNode;
}> = ({ id, title, right, accent, hint, children }) => (
  <div className="ck-card" style={accent ? CARD_ACCENT : CARD} id={id}>
    {title != null && (
      <div style={ROW}>
        <span style={{ fontSize: 13, fontWeight: 850, color: '#fff', letterSpacing: 0.1 }}>{title}</span>
        <span style={{ flex: 1 }} />
        {right}
      </div>
    )}
    {children}
    {hint && <div style={HINT}>{hint}</div>}
  </div>
);

export const StatTile: React.FC<{ label: string; value: string; color?: string; sub?: string }> = ({ label, value, color = '#94a3b8', sub }) => (
  <div className="ck-tile" style={{ flex: '1 1 96px', padding: '10px 12px', borderRadius: 12, background: 'linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.02))', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 3, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}>
    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.42)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>{label}</span>
    <span style={{ fontSize: 18, fontWeight: 900, color, lineHeight: 1 }}>{value}</span>
    {sub && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)' }}>{sub}</span>}
  </div>
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
        <button key={n.id} className="ck-btn" style={{ ...BTN_SMALL, fontSize: 10 }} onClick={() => goTo(n.id)} aria-label={`К разделу ${n.label}`}>{n.label}</button>
      ))}
    </div>
  );
};

export const GroupHeading: React.FC<{ icon: string; text: string; desc?: string }> = ({ icon, text, desc }) => (
  <div className="ck-group-head" style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingTop: 6, borderLeft: `3px solid ${ACCENT}`, paddingLeft: 10, borderRadius: 4, background: 'linear-gradient(90deg, rgba(0,230,138,0.06), transparent)' }}>
    <span style={{ fontSize: 13, fontWeight: 850, color: ACCENT, letterSpacing: 0.1 }}>{icon} {text}</span>
    {desc && <span style={HINT_SM}>{desc}</span>}
  </div>
);

// ─── Универсальные компоненты ввода ───

export interface NumberInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  suffix?: string;
  width?: number;
  error?: string;
}

export const NumberInput: React.FC<NumberInputProps> = ({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  placeholder,
  ariaLabel,
  disabled,
  suffix,
  width,
  error,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow empty, negative (during typing), and decimal points
    if (raw === '' || raw === '-' || raw === '.') {
      onChange(raw);
      return;
    }
    const num = parseFloat(raw);
    if (!isNaN(num)) {
      onChange(raw);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '' || raw === '-' || raw === '.') {
      onChange(String(min ?? 0));
      return;
    }
    const num = parseFloat(raw);
    if (!isNaN(num)) {
      let clamped = num;
      if (min !== undefined) clamped = Math.max(min, clamped);
      if (max !== undefined) clamped = Math.min(max, clamped);
      if (step !== undefined && step > 0) {
        const remainder = clamped % step;
        if (remainder !== 0) {
          clamped = Math.round(clamped / step) * step;
        }
      }
      onChange(String(clamped));
    } else {
      onChange(String(min ?? 0));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const raw = e.currentTarget.value;
      const num = parseFloat(raw) || 0;
      const delta = e.key === 'ArrowUp' ? step : -step;
      let next = num + delta;
      if (min !== undefined) next = Math.max(min, next);
      if (max !== undefined) next = Math.min(max, next);
      onChange(String(next));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      {label && <span style={LABEL}>{label}</span>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label={ariaLabel}
          disabled={disabled}
          style={{
            ...INPUT,
            width: width ?? 100,
            borderColor: error ? '#ef4444' : 'rgba(255,255,255,0.12)',
            background: error ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.05)',
          }}
        />
        {suffix && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>{suffix}</span>}
      </div>
      {error && <span style={{ fontSize: 10, color: '#f87171' }}>⚠ {error}</span>}
    </div>
  );
};

export interface SelectInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  ariaLabel?: string;
  disabled?: boolean;
  width?: number;
}

export const SelectInput: React.FC<SelectInputProps> = ({
  label,
  value,
  onChange,
  options,
  ariaLabel,
  disabled,
  width,
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
    {label && <span style={LABEL}>{label}</span>}
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      aria-label={ariaLabel}
      disabled={disabled}
      style={{
        ...INPUT,
        width: width ?? 160,
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.12)',
        color: '#fff',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

// Улучшенный Stepper с поддержкой клавиатуры и доступностью
export const Stepper: React.FC<{
  label?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (n: number) => void;
  ariaPrefix?: string;
  suffix?: string;
  width?: number;
  disabled?: boolean;
}> = ({ label, value, min, max, step = 1, onChange, ariaPrefix, suffix, width, disabled }) => (
  <div style={ROW}>
    {label && <span style={LABEL}>{label}</span>}
    <button
      className="ck-btn"
      style={{ ...BTN_SMALL, opacity: disabled || (min !== undefined && value <= min) ? 0.4 : 1 }}
      onClick={() => onChange(Math.max(min ?? -Infinity, value - step))}
      disabled={disabled || (min !== undefined && value <= min)}
      aria-label={`${ariaPrefix ?? ''} уменьшить`}
    >
      −
    </button>
    <span style={{ fontSize: 14, fontWeight: 800, minWidth: width ?? 26, textAlign: 'center' }}>{value}</span>
    <button
      className="ck-btn"
      style={{ ...BTN_SMALL, opacity: disabled || (max !== undefined && value >= max) ? 0.4 : 1 }}
      onClick={() => onChange(Math.min(max ?? Infinity, value + step))}
      disabled={disabled || (max !== undefined && value >= max)}
      aria-label={`${ariaPrefix ?? ''} увеличить`}
    >
      +
    </button>
    {suffix && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)' }}>{suffix}</span>}
  </div>
);

// ChipToggle с поддержкой disabled
export const ChipToggle: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
}> = ({ active, onClick, children, ariaLabel, disabled }) => (
  <button
    className="ck-chip"
    style={{ ...(active ? CHIP_ACTIVE : CHIP), opacity: disabled ? 0.4 : 1 }}
    onClick={onClick}
    disabled={disabled}
    aria-label={ariaLabel}
    aria-pressed={active}
  >
    {children}
  </button>
);

// ─── Новые примитивы v2 ───

export const Badge: React.FC<{ color?: string; bg?: string; border?: string; children: React.ReactNode }> = ({ color = '#fff', bg = 'rgba(255,255,255,0.06)', border = 'rgba(255,255,255,0.12)', children }) => (
  <span style={{ fontSize: 11, fontWeight: 750, color, background: bg, border: `1px solid ${border}`, borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap' }}>{children}</span>
);

export const ProgressBar: React.FC<{ value: number; max?: number; color?: string; height?: number }> = ({ value, max = 100, color = ACCENT, height = 6 }) => {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div style={{ height, borderRadius: height / 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
      <div style={{ height, borderRadius: height / 2, width: pct + '%', background: color, transition: 'width 0.35s ease', boxShadow: `0 0 8px ${color}55` }} />
    </div>
  );
};

export const Divider: React.FC = () => <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '2px 0' }} />;

export const EmptyState: React.FC<{ icon: string; title: string; desc?: string; action?: React.ReactNode }> = ({ icon, title, desc, action }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '20px 12px', textAlign: 'center' }}>
    <div style={{ fontSize: 28 }}>{icon}</div>
    <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{title}</div>
    {desc && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', maxWidth: 340, lineHeight: 1.5 }}>{desc}</div>}
    {action}
  </div>
);

export const Tabs: React.FC<{ tabs: { id: string; label: string; icon?: string }[]; active: string; onChange: (id: string) => void }> = ({ tabs, active, onChange }) => (
  <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', overflowX: 'auto', scrollbarWidth: 'none' }}>
    {tabs.map(t => {
      const isActive = active === t.id;
      return (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          aria-pressed={isActive}
          style={{
            flex: '1 0 auto', minWidth: 64, padding: '7px 12px', borderRadius: 9, fontSize: 12, fontWeight: isActive ? 800 : 600,
            border: isActive ? `1px solid ${ACCENT_BORDER}` : '1px solid transparent',
            background: isActive ? ACCENT_SOFT : 'transparent',
            color: isActive ? '#fff' : 'var(--text-dim)', cursor: 'pointer', whiteSpace: 'nowrap',
            boxShadow: isActive ? '0 0 10px rgba(0,230,138,0.12)' : 'none', transition: 'all 0.15s ease',
          }}
        >
          {t.icon ? t.icon + ' ' : ''}{t.label}
        </button>
      );
    })}
  </div>
);

export const Accordion: React.FC<{ id?: string; title: React.ReactNode; defaultOpen?: boolean; icon?: string; badge?: React.ReactNode; children: React.ReactNode }> = ({ id, title, defaultOpen = false, icon, badge, children }) => {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div id={id} style={{ ...CARD, padding: 0, overflow: 'hidden', gap: 0, scrollMarginTop: 12 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px 14px',
          background: open ? 'rgba(0,230,138,0.06)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
        aria-expanded={open}
      >
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{open ? '▾' : '▸'}</span>
        {icon && <span style={{ fontSize: 15 }}>{icon}</span>}
        <span style={{ fontSize: 13, fontWeight: 850, color: '#fff', flex: 1 }}>{title}</span>
        {badge}
      </button>
      {open && <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 11, borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.015)' }}>{children}</div>}
    </div>
  );
};
