/**
 * CardioUI.tsx — единый UI-слой кардио-конструктора: общие стили (карточки,
 * кнопки, чипы, инпуты) и переиспользуемые компоненты (SectionCard, StatTile,
 * Stepper, ChipToggle, SectionNav). Все вкладки используют эти примитивы,
 * чтобы структура и оформление были едиными.
 */
import React from 'react';

// ─── Токены дизайна v4 TOP (уровень флагманов: стекло + кромки + glow) ───
export const ACCENT = '#00e68a';
export const ACCENT_SOFT = 'rgba(0,230,138,0.14)';
export const ACCENT_BORDER = 'rgba(0,230,138,0.45)';
export const ACCENT_HOVER = 'rgba(0,230,138,0.22)';
export const ACCENT_GRAD = 'linear-gradient(135deg,#00e68a 0%,#00c8a0 60%,#06b6d4 100%)';
export const GLASS_BG = 'linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02))';
export const GLASS_BORDER = 'rgba(255,255,255,0.09)';
export const SURFACE_0 = 'rgba(255,255,255,0.02)';
export const SURFACE_1 = 'rgba(255,255,255,0.045)';
export const SURFACE_2 = 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.025))';
export const TEXT_1 = '#ffffff';
export const TEXT_2 = 'rgba(255,255,255,0.72)';
export const TEXT_3 = 'rgba(255,255,255,0.45)';
export const RADIUS_LG = 18;
export const RADIUS_MD = 12;
export const SHADOW_CARD = '0 8px 28px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.06)';
export const SHADOW_ACCENT = '0 6px 26px rgba(0,230,138,0.16), inset 0 1px 0 rgba(255,255,255,0.07)';
export const EDGE_TOP = 'inset 0 1px 0 rgba(255,255,255,0.07)';
/** Табличные цифры — метрики не «прыгают» при смене значений. */
export const TABULAR: React.CSSProperties = { fontVariantNumeric: 'tabular-nums' as const };
/** Нажатие-кнопка: лёгкий press вместо плоского hover (тач-экраны). */
export const PRESSABLE = 'ck-press';

// ─── Единые стили ───

export const CARD: React.CSSProperties = {
  background: GLASS_BG,
  border: `1px solid ${GLASS_BORDER}`,
  borderRadius: RADIUS_LG, padding: 15, display: 'flex', flexDirection: 'column', gap: 12,
  boxShadow: SHADOW_CARD,
  backdropFilter: 'blur(10px)',
  position: 'relative',
};
export const CARD_ACCENT: React.CSSProperties = {
  ...CARD,
  borderColor: ACCENT_BORDER,
  background: 'linear-gradient(180deg, rgba(0,230,138,0.13), rgba(0,230,138,0.04))',
  boxShadow: SHADOW_ACCENT,
};
export const CARD_SOFT: React.CSSProperties = {
  ...CARD,
  background: SURFACE_0,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
};
export const CARD_HERO: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(0,230,138,0.16) 0%, rgba(6,182,212,0.09) 55%, rgba(139,92,246,0.07) 100%)',
  border: '1px solid rgba(0,230,138,0.32)',
  borderRadius: RADIUS_LG, padding: 15, display: 'flex', flexDirection: 'column', gap: 12,
  boxShadow: '0 10px 32px rgba(0,0,0,0.34), 0 0 24px rgba(0,230,138,0.08), inset 0 1px 0 rgba(255,255,255,0.08)',
  backdropFilter: 'blur(10px)',
};
export const ROW: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' };
export const ROW_TIGHT: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' };
export const COL: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8 };
export const LABEL: React.CSSProperties = { fontSize: 11, color: TEXT_1, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, lineHeight: 1 };
export const LABEL_SM: React.CSSProperties = { fontSize: 10, color: TEXT_1, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 };
export const HINT: React.CSSProperties = { fontSize: 12, color: TEXT_2, lineHeight: 1.55 };
export const HINT_SM: React.CSSProperties = { fontSize: 11, color: TEXT_3, lineHeight: 1.5 };
export const BTN: React.CSSProperties = {
  padding: '10px 15px', borderRadius: 11, fontSize: 12.5, fontWeight: 750, cursor: 'pointer',
  border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.055)',
  color: TEXT_1, minHeight: 44, whiteSpace: 'nowrap',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07), 0 2px 8px rgba(0,0,0,0.22)',
  transition: 'all 0.15s ease',
};
export const BTN_PRIMARY: React.CSSProperties = { ...BTN, background: 'linear-gradient(180deg, rgba(0,230,138,0.30), rgba(0,230,138,0.16))', border: `1px solid ${ACCENT_BORDER}`, color: '#4ade80', fontWeight: 800, boxShadow: '0 0 16px rgba(0,230,138,0.22), inset 0 1px 0 rgba(255,255,255,0.09)' };
export const BTN_CTA: React.CSSProperties = {
  ...BTN, background: ACCENT_GRAD, border: 'none', color: '#06281c', fontWeight: 850, fontSize: 13,
  boxShadow: '0 6px 20px rgba(0,230,138,0.35), inset 0 1px 0 rgba(255,255,255,0.25)',
};
export const BTN_GHOST: React.CSSProperties = { ...BTN, background: 'transparent', border: '1px solid rgba(255,255,255,0.09)', color: TEXT_1 };
export const BTN_DANGER: React.CSSProperties = { ...BTN, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.34)', color: '#f87171' };
export const BTN_SMALL: React.CSSProperties = { ...BTN, minHeight: 40, padding: '8px 13px', fontSize: 11.5, borderRadius: 10 };
export const BTN_XS: React.CSSProperties = { ...BTN, minHeight: 36, padding: '6px 10px', fontSize: 11, borderRadius: 8 };
export const INPUT: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.13)',
  borderRadius: 10, padding: '11px 12px', color: TEXT_1, fontSize: 16,
  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.20)', outline: 'none', minHeight: 48,
};
export const CHIP: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 11, fontSize: 12.5, fontWeight: 650, cursor: 'pointer',
  border: '1px solid rgba(255,255,255,0.10)', background: SURFACE_1,
  color: TEXT_1, whiteSpace: 'nowrap', minHeight: 44,
  transition: 'all 0.15s ease', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
};
export const CHIP_ACTIVE: React.CSSProperties = {
  ...CHIP,
  border: `1px solid ${ACCENT_BORDER}`, background: ACCENT_SOFT, color: TEXT_1, fontWeight: 800,
  boxShadow: '0 0 12px rgba(0,230,138,0.20), inset 0 1px 0 rgba(255,255,255,0.07)',
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
export const GOAL_COLOR: Record<string, string> = {
  health: '#22c55e', mass: '#3b82f6', cut: '#f59e0b', recomp: '#a78bfa',
  maintenance: '#8b5cf6', recovery: '#71717a', bb_prep: '#ec4899', pl_prep: '#06b6d4', bb_taper: '#ef4444',
};
export const CK_COLORS = { phase: PHASE_COLOR, goal: GOAL_COLOR, type: TYPE_COLOR };

// ─── Компоненты ───

export const SectionCard: React.FC<{
  id?: string;
  title?: React.ReactNode;
  right?: React.ReactNode;
  accent?: boolean;
  hint?: string;
  children: React.ReactNode;
}> = ({ id, title, right, accent, hint, children }) => (
  <div className="ck-card kit-section" data-accent={accent ? '1' : undefined} style={accent ? CARD_ACCENT : CARD} id={id}>
    {title != null && (
      <div style={ROW}>
        <span style={{ fontSize: 13.5, fontWeight: 850, color: '#fff', letterSpacing: 0.1 }}>{title}</span>
        <span style={{ flex: 1 }} />
        {right}
      </div>
    )}
    {children}
    {hint && <div style={HINT}>{hint}</div>}
  </div>
);

export const StatTile: React.FC<{ label: string; value: string; color?: string; sub?: string }> = ({ label, value, color = '#94a3b8', sub }) => (
  <div className="ck-tile kit-stat" style={{ flex: '1 1 104px', padding: '11px 12px 10px', borderRadius: 13, background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))', border: '1px solid rgba(255,255,255,0.09)', borderTop: `2px solid ${color}`, display: 'flex', flexDirection: 'column', gap: 3, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 10px rgba(0,0,0,0.18)' }}>
    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.48)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 800 }}>{label}</span>
    <span style={{ fontSize: 20, fontWeight: 900, color, lineHeight: 1, ...TABULAR }}>{value}</span>
    {sub && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.42)', ...TABULAR }}>{sub}</span>}
  </div>
);

export const NoteList: React.FC<{ items: string[]; color?: string }> = ({ items, color }) => (
  <div style={{ fontSize: 10, color: color ?? '#fff', lineHeight: 1.5 }}>
    {items.map((it, i) => <div key={i}>• {it}</div>)}
  </div>
);

export const InfoBanner: React.FC<{ tone?: 'ok' | 'warn' | 'info'; children: React.ReactNode }> = ({ tone = 'info', children }) => {
  const palette = tone === 'warn'
    ? { color: '#fbbf24', bg: 'rgba(245,158,11,0.09)', border: 'rgba(245,158,11,0.30)', bar: '#f59e0b', icon: '⚠' }
    : tone === 'ok'
      ? { color: '#4ade80', bg: 'rgba(0,230,138,0.08)', border: 'rgba(0,230,138,0.30)', bar: '#00e68a', icon: '✓' }
      : { color: '#93c5fd', bg: 'rgba(59,130,246,0.09)', border: 'rgba(59,130,246,0.30)', bar: '#60a5fa', icon: 'ℹ' };
  return (
    <div role="status" style={{ fontSize: 11.5, color: palette.color, background: palette.bg, border: `1px solid ${palette.border}`, borderLeft: `3px solid ${palette.bar}`, borderRadius: 10, padding: '8px 11px', lineHeight: 1.5, boxShadow: '0 2px 10px rgba(0,0,0,0.16)' }}>
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
  <div className="ck-group-head kit-grouphead" style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingTop: 6, borderLeft: `3px solid ${ACCENT}`, paddingLeft: 10, borderRadius: 4, background: 'linear-gradient(90deg, rgba(0,230,138,0.06), transparent)' }}>
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
        {suffix && <span style={{ fontSize: 11, color: '#fff' }}>{suffix}</span>}
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
      className="ck-btn ck-stepbtn"
      style={{ ...BTN_SMALL, minWidth: 44, opacity: disabled || (min !== undefined && value <= min) ? 0.4 : 1 }}
      onClick={() => onChange(Math.max(min ?? -Infinity, value - step))}
      disabled={disabled || (min !== undefined && value <= min)}
      aria-label={`${ariaPrefix ?? ''} уменьшить`}
    >
      −
    </button>
    <span style={{ fontSize: 16, fontWeight: 850, minWidth: width ?? 30, textAlign: 'center', ...TABULAR }}>{value}</span>
    <button
      className="ck-btn ck-stepbtn"
      style={{ ...BTN_SMALL, minWidth: 44, opacity: disabled || (max !== undefined && value >= max) ? 0.4 : 1 }}
      onClick={() => onChange(Math.min(max ?? Infinity, value + step))}
      disabled={disabled || (max !== undefined && value >= max)}
      aria-label={`${ariaPrefix ?? ''} увеличить`}
    >
      +
    </button>
    {suffix && <span style={{ fontSize: 11, color: '#fff', ...TABULAR }}>{suffix}</span>}
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
    className="ck-chip kit-chiptoggle"
    data-active={active}
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

export const ProgressBar: React.FC<{ value: number; max?: number; color?: string; height?: number }> = ({ value, max = 100, color = ACCENT, height = 7 }) => {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label="прогресс" className="kit-progress" style={{ height, borderRadius: height / 2, background: 'rgba(255,255,255,0.09)', overflow: 'hidden', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.28)' }}>
      <div style={{ height, borderRadius: height / 2, width: pct + '%', background: `linear-gradient(90deg, ${color}, ${color}cc)`, transition: 'width 0.35s ease', boxShadow: `0 0 10px ${color}66` }} />
    </div>
  );
};

export const Divider: React.FC = () => <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '2px 0' }} />;

export const EmptyState: React.FC<{ icon: string; title: string; desc?: string; action?: React.ReactNode; art?: React.ReactNode }> = ({ icon, title, desc, action, art }) => (
  <div className="kit-empty" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, padding: '24px 14px', textAlign: 'center', background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(0,230,138,0.07), transparent)' }}>
    {art ?? <div style={{ fontSize: 34, filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))' }}>{icon}</div>}
    <div style={{ fontSize: 14, fontWeight: 850, color: '#fff', letterSpacing: -0.1 }}>{title}</div>
    {desc && <div style={{ fontSize: 11.5, color: TEXT_2, maxWidth: 360, lineHeight: 1.55 }}>{desc}</div>}
    {action}
  </div>
);

export const Tabs: React.FC<{ tabs: { id: string; label: string; icon?: string }[]; active: string; onChange: (id: string) => void }> = ({ tabs, active, onChange }) => (
  <div className="kit-tabs" style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 13, background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.07)', overflowX: 'auto', scrollbarWidth: 'none' }}>
    {tabs.map(t => {
      const isActive = active === t.id;
      return (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          aria-pressed={isActive}
          className="kit-tab"
          data-active={isActive}
          style={{
            flex: '1 0 auto', minWidth: 68, minHeight: 44, padding: '8px 13px', borderRadius: 10, fontSize: 12, fontWeight: isActive ? 800 : 600,
            border: isActive ? `1px solid ${ACCENT_BORDER}` : '1px solid transparent',
            background: isActive ? 'linear-gradient(180deg, rgba(0,230,138,0.24), rgba(0,230,138,0.10))' : 'transparent',
            color: isActive ? '#fff' : '#fff', cursor: 'pointer', whiteSpace: 'nowrap',
            boxShadow: isActive ? '0 0 12px rgba(0,230,138,0.18), inset 0 1px 0 rgba(255,255,255,0.08)' : 'none', transition: 'all 0.15s ease',
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
    <div id={id} className="kit-accordion" data-open={open} style={{ ...CARD, padding: 0, overflow: 'hidden', gap: 0, scrollMarginTop: 72, borderColor: open ? 'rgba(0,230,138,0.22)' : GLASS_BORDER }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="ck-acc-head"
        style={{
          display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '13px 14px', minHeight: 52,
          background: open ? 'linear-gradient(180deg, rgba(0,230,138,0.09), rgba(0,230,138,0.02))' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
        aria-expanded={open}
      >
        <span style={{ width: 26, height: 26, borderRadius: 8, background: open ? 'rgba(0,230,138,0.16)' : 'rgba(255,255,255,0.05)', border: open ? '1px solid rgba(0,230,138,0.35)' : '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff', transition: 'transform 0.18s ease', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', flexShrink: 0 }}>▾</span>
        {icon && <span style={{ fontSize: 17, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.4))' }}>{icon}</span>}
        <span style={{ fontSize: 13.5, fontWeight: 850, color: '#fff', flex: 1 }}>{title}</span>
        {badge}
      </button>
      {open && <div style={{ padding: 15, display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.015)', animation: 'ckFadeIn 0.18s ease' }}>{children}</div>}
    </div>
  );
};

// ─── v3 — Hero, Segmented, Timeline ───

export const HeroCard: React.FC<{ icon?: string; title: string; subtitle?: string; right?: React.ReactNode; children?: React.ReactNode }> = ({ icon, title, subtitle, right, children }) => (
  <div className="kit-hero" style={CARD_HERO}>
    <div style={ROW}>
      {icon && <span style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg,#00e68a,#06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, boxShadow: '0 4px 16px rgba(0,230,138,0.40), inset 0 1px 0 rgba(255,255,255,0.25)', flexShrink: 0 }}>{icon}</span>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 900, color: TEXT_1, lineHeight: 1.1, letterSpacing: -0.2 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11.5, color: TEXT_2, marginTop: 3, lineHeight: 1.45 }}>{subtitle}</div>}
      </div>
      {right}
    </div>
    {children}
  </div>
);

export const Segmented: React.FC<{
  options: { value: string; label: string; desc?: string; icon?: string; disabled?: boolean }[];
  value: string;
  onChange: (v: string) => void;
  columns?: number;
  ariaLabel?: string;
}> = ({ options, value, onChange, columns, ariaLabel }) => (
  <div role="radiogroup" aria-label={ariaLabel} className="kit-segmented" style={{ display: 'grid', gridTemplateColumns: columns ? `repeat(${columns},1fr)` : 'repeat(auto-fill, minmax(150px,1fr))', gap: 7 }}>
    {options.map(o => {
      const active = value === o.value;
      return (
        <button
          key={o.value}
          role="radio"
          aria-checked={active}
          disabled={o.disabled}
          className="kit-segmented-opt"
          data-active={active}
          onClick={() => !o.disabled && onChange(o.value)}
          style={{
            padding: '11px 13px', borderRadius: RADIUS_MD, textAlign: 'left', cursor: o.disabled ? 'not-allowed' : 'pointer',
            border: active ? `1px solid ${ACCENT_BORDER}` : '1px solid rgba(255,255,255,0.09)',
            background: active ? 'linear-gradient(180deg, rgba(0,230,138,0.16), rgba(0,230,138,0.06))' : SURFACE_1,
            color: TEXT_1, opacity: o.disabled ? 0.45 : 1,
            boxShadow: active ? '0 0 14px rgba(0,230,138,0.16), inset 0 1px 0 rgba(255,255,255,0.07)' : 'inset 0 1px 0 rgba(255,255,255,0.04)',
            transition: 'all 0.15s ease', minHeight: 48,
          }}
        >
          <div style={{ fontSize: 12.5, fontWeight: active ? 800 : 650, display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 9, height: 9, borderRadius: 5, background: active ? '#00e68a' : 'rgba(255,255,255,0.18)', boxShadow: active ? '0 0 8px rgba(0,230,138,0.8)' : 'none', flexShrink: 0 }} />
            {o.icon && <span>{o.icon}</span>}{o.label}
          </div>
          {o.desc && <div style={{ fontSize: 10.5, color: TEXT_2, marginTop: 4, lineHeight: 1.4 }}>{o.desc}</div>}
        </button>
      );
    })}
  </div>
);

export const SegmentedChips: React.FC<{
  options: { value: string; label: string; icon?: string }[];
  value: string;
  onChange: (v: string) => void;
  ariaLabel?: string;
}> = ({ options, value, onChange, ariaLabel }) => (
  <div role="radiogroup" aria-label={ariaLabel} className="kit-chips" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
    {options.map(o => {
      const active = value === o.value;
      return (
        <button key={o.value} role="radio" aria-checked={active} onClick={() => onChange(o.value)} className="kit-chip" data-active={active} style={active ? CHIP_ACTIVE : CHIP}>
          {o.icon ? o.icon + ' ' : ''}{o.label}
        </button>
      );
    })}
  </div>
);

/** Универсальный Timeline по фазам/неделям — высота 28-36, сегменты + точки стартов */
export const Timeline: React.FC<{
  segments: { key: string; weeks: number; color: string; label?: string }[];
  markers?: { week: number; color?: string; label?: string }[];
  totalWeeks: number;
  height?: number;
}> = ({ segments, markers, totalWeeks, height = 28 }) => {
  let cursor = 1;
  return (
    <div style={{ display: 'flex', height, borderRadius: 8, overflow: 'hidden', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', position: 'relative' }}>
      {segments.map(s => {
        const w = s.weeks;
        if (w <= 0) return null;
        const el = <div key={s.key} title={`${s.label ?? s.key}: ${w} нед`} style={{ flex: w, background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', borderLeft: cursor > 1 ? '1px solid rgba(255,255,255,0.12)' : 'none', position: 'relative' as const }}>{w >= 6 ? s.label ?? '' : ''}</div>;
        cursor += w;
        return el;
      })}
      {markers?.map((m, i) => {
        const left = ((m.week - 0.5) / totalWeeks) * 100;
        return <div key={i} title={m.label ?? `нед ${m.week}`} style={{ position: 'absolute', left: `calc(${left}% - 5px)`, top: 2, width: 10, height: 10, borderRadius: 5, background: m.color ?? '#ef4444', border: '2px solid #fff', boxShadow: '0 1px 6px rgba(0,0,0,0.4)' }} />;
      })}
    </div>
  );
};

export const Field: React.FC<{ label?: string; hint?: string; error?: string; children: React.ReactNode }> = ({ label, hint, error, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 140px', minWidth: 0 }}>
    {label && <span style={LABEL}>{label}</span>}
    {children}
    {hint && !error && <span style={HINT_SM}>{hint}</span>}
    {error && <span style={{ fontSize: 10, color: '#f87171' }}>⚠ {error}</span>}
  </div>
);
