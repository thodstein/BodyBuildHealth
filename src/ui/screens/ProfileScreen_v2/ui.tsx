/**
 * ProfileScreen_v2/ui.ts — общие утилиты UI для нового Профиля.
 */
import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';

export const colors = {
  bg: 'rgba(28,28,32,0.65)',
  bgSolid: '#1c1c20',
  border: 'rgba(255,255,255,0.10)',
  borderHover: 'rgba(255,255,255,0.20)',
  text: '#fff',
  textMuted: 'rgba(255,255,255,0.55)',
  textSubtle: 'rgba(255,255,255,0.35)',
  primary: '#00e68a',
  primaryDim: 'rgba(0,230,138,0.15)',
  warning: '#f59e0b',
  warningDim: 'rgba(245,158,11,0.15)',
  danger: '#ef4444',
  dangerDim: 'rgba(239,68,68,0.15)',
  blue: '#3b82f6',
  blueDim: 'rgba(59,130,246,0.15)',
  purple: '#8b5cf6',
  purpleDim: 'rgba(139,92,246,0.15)',
  green: '#22c55e',
  greenDim: 'rgba(34,197,94,0.15)',
  pink: '#ec4899',
  pinkDim: 'rgba(236,72,153,0.15)',
  orange: '#f59e0b',
  orangeDim: 'rgba(245,158,11,0.15)',
  teal: '#14b8a6',
  tealDim: 'rgba(20,184,166,0.15)',
};

export const glassCard: React.CSSProperties = {
  background: colors.bg,
  backdropFilter: 'blur(28px) saturate(180%)',
  WebkitBackdropFilter: 'blur(28px) saturate(180%)',
  borderRadius: 16,
  border: `1px solid ${colors.border}`,
  boxShadow: '0 4px 20px rgba(0,0,0,0.25), inset 0 0.5px 0 rgba(255,255,255,0.06)',
  padding: 16,
};

export const tabCard: React.CSSProperties = {
  ...glassCard,
  cursor: 'pointer',
  transition: 'all 0.25s cubic-bezier(0.2,0.9,0.4,1)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 8,
  minHeight: 130,
  textAlign: 'left',
  color: colors.text,
};

export const inputBase: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: `1px solid ${colors.border}`,
  borderRadius: 8,
  padding: '8px 10px',
  color: colors.text,
  fontSize: 14,
  outline: 'none',
  transition: 'border-color 0.15s',
  minHeight: 36,
};

export const inputStyle: React.CSSProperties = {
  ...inputBase,
  width: '100%',
  boxSizing: 'border-box',
};

export const selectStyle: React.CSSProperties = {
  ...inputBase,
  cursor: 'pointer',
  appearance: 'none',
  WebkitAppearance: 'none',
  backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M0 0l5 6 5-6z' fill='%23ffffff80'/></svg>")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 10px center',
  paddingRight: 28,
};

export const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'rgba(255,255,255,0.62)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginBottom: 4,
  display: 'block',
};

/* ── Заголовок подгруппы (иконка-бокс + текст) ── */

export const GroupHeader: React.FC<{ icon: string; title: string; color?: string; style?: React.CSSProperties }> = ({ icon, title, color, style }) => {
  const c = color || colors.text;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, ...style }}>
      <span aria-hidden="true" style={{
        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, background: `${c}1f`, border: `1px solid ${c}40`,
      }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: c, letterSpacing: 0.2 }}>{title}</span>
    </div>
  );
};

export const sectionTitleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: colors.text,
  marginBottom: 4,
};

export const sectionSubtitleStyle: React.CSSProperties = {
  fontSize: 12,
  color: colors.textMuted,
};

/* ── Простые компоненты ввода ── */

export const NumberInput: React.FC<{
  value: number | undefined | null;
  onChange: (v: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  unit?: string;
  disabled?: boolean;
}> = ({ value, onChange, min, max, step = 1, placeholder, unit, disabled }) => {
  const [local, setLocal] = useState<string>(value === undefined || value === null ? '' : String(value));
  useEffect(() => {
    setLocal(value === undefined || value === null ? '' : String(value));
  }, [value]);
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        type="number"
        value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={() => {
          if (local === '' || local === '-') { onChange(undefined); return; }
          const n = Number(local);
          if (!Number.isFinite(n)) { setLocal(value === undefined || value === null ? '' : String(value)); return; }
          let v = n;
          if (min !== undefined) v = Math.max(min, v);
          if (max !== undefined) v = Math.min(max, v);
          onChange(v);
        }}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        disabled={disabled}
        style={{ ...inputStyle, paddingRight: unit ? 28 : 10 }}
        inputMode="decimal"
      />
      {unit && <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: colors.textSubtle, pointerEvents: 'none' }}>{unit}</span>}
    </div>
  );
};

export const TextInput: React.FC<{
  value: string | undefined | null;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
}> = ({ value, onChange, placeholder, maxLength }) => (
  <input
    type="text"
    value={value ?? ''}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    maxLength={maxLength}
    style={inputStyle}
  />
);

export const SelectInput: React.FC<{
  value: string | undefined | null;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
}> = ({ value, onChange, options, placeholder, disabled }) => (
  <select
    value={value ?? ''}
    onChange={e => onChange(e.target.value)}
    disabled={disabled}
    style={selectStyle}
  >
    {placeholder && <option value="" style={{ background: colors.bgSolid }}>{placeholder}</option>}
    {options.map(o => (
      <option key={o.id} value={o.id} style={{ background: colors.bgSolid }}>{o.label}</option>
    ))}
  </select>
);

export const BoolChip: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  color?: string;
}> = ({ checked, onChange, label, color }) => {
  const c = color || colors.primary;
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        padding: '6px 12px',
        borderRadius: 14,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        border: `1px solid ${checked ? c : colors.border}`,
        background: checked ? `${c}22` : 'transparent',
        color: checked ? c : colors.textMuted,
        transition: 'all 0.15s',
        minHeight: 34,
        boxShadow: checked ? `0 2px 10px ${c}22` : 'none',
      }}
    >
      {checked ? '✓ ' : ''}{label}
    </button>
  );
};

export const SliderInput: React.FC<{
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  label?: string;
  unit?: string;
  color?: string;
  /** Куда направлена шкала: 'good' = выше лучше (↑ хорошо), 'bad' = выше хуже (↓ плохо). */
  direction?: 'good' | 'bad';
  /** Подпись минимального значения шкалы (что значит 1), например «спокойствие, без напряжения». */
  minLabel?: string;
  /** Подпись максимального значения шкалы (что значит 5/10), например «пик стресса, тревога». */
  maxLabel?: string;
}> = ({ value: rawValue, onChange, min, max, step = 1, label, unit, color, direction, minLabel, maxLabel }) => {
  const c = color || colors.primary;
  const value = (rawValue !== undefined && rawValue !== null && !isNaN(rawValue)) ? rawValue : min;
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  const dirColor = direction === 'good' ? '#22c55e' : direction === 'bad' ? '#ef4444' : null;
  return (
    <div>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.62)', fontWeight: 600 }}>{label}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              fontSize: 11, fontWeight: 700, color: c,
              background: `${c}1a`, border: `1px solid ${c}33`,
              padding: '1px 8px', borderRadius: 8, minWidth: 36, textAlign: 'center',
            }}>{rawValue != null ? `${value}${unit || ''}` : '—'}</span>
          </span>
        </div>
      )}
      <div style={{ position: 'relative', height: 26, display: 'flex', alignItems: 'center' }}>
        <div style={{
          position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 2,
          background: 'rgba(255,255,255,0.08)',
        }} />
        <div style={{
          position: 'absolute', left: 0, width: `${pct}%`, height: 4, borderRadius: 2,
          background: `linear-gradient(90deg, ${c}55, ${c})`,
        }} />
        <input
          type="range"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={e => onChange(Number(e.target.value))}
          aria-label={label}
          style={{
            position: 'relative', width: '100%', height: 26, opacity: 0, cursor: 'pointer', margin: 0,
          }}
        />
        <div style={{
          position: 'absolute', left: `calc(${pct}% - 9px)`,
          width: 18, height: 18, borderRadius: '50%',
          background: `radial-gradient(circle at 35% 30%, ${c}, ${c}cc)`,
          border: `2px solid ${c}`,
          boxShadow: `0 0 0 4px ${c}2e, 0 2px 8px ${c}55`,
          pointerEvents: 'none',
          transition: 'left 0.1s',
        }} />
      </div>
      {(minLabel || maxLabel) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 4, fontSize: 10, color: 'rgba(255,255,255,0.5)', lineHeight: 1.35 }}>
          <span style={{ flex: 1, minWidth: 0 }}>{minLabel ? `${min} — ${minLabel}` : ''}</span>
          <span style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>{maxLabel ? `${max} — ${maxLabel}` : ''}</span>
        </div>
      )}
    </div>
  );
};

/* ── Accordion section ── */

export const AccordionSection: React.FC<{
  title: string;
  subtitle?: string;
  icon?: string;
  color?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: string;
  id?: string;
}> = ({ title, subtitle, icon, color, defaultOpen = false, children, badge, id }) => {
  const [open, setOpen] = useState(defaultOpen);
  const c = color || colors.primary;
  return (
    <div
      id={id}
      style={{
        ...glassCard,
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        padding: 0,
        overflow: 'hidden',
        scrollMarginTop: 70, // для smooth scroll с учётом sticky quick-jump
        position: 'relative',
      }}
    >
      {/* Акцентная полоса сверху в цвет секции */}
      <div aria-hidden="true" style={{
        height: 3, width: '100%',
        background: `linear-gradient(90deg, ${c}, ${c}26 55%, transparent)`,
      }} />
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: 14,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          color: colors.text,
          minHeight: 60,
        }}
      >
        {icon && (
          <span aria-hidden="true" style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, background: `${c}22`, border: `1px solid ${c}44`,
            boxShadow: `inset 0 0 14px ${c}1a`,
          }}>{icon}</span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: c, letterSpacing: -0.2 }}>{title}</span>
            {badge && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: c, background: `${c}22`,
                padding: '2px 8px', borderRadius: 8, border: `1px solid ${c}33`,
                whiteSpace: 'nowrap',
              }}>{badge}</span>
            )}
          </div>
          {subtitle && <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{subtitle}</div>}
        </div>
        <span style={{
          width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: open ? `${c}22` : 'rgba(255,255,255,0.05)',
          fontSize: 13, color: open ? c : colors.textMuted,
          transition: 'transform 0.2s',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        }}>▾</span>
      </button>
      {open && (
        <div className="profile-section-body" style={{
          padding: '0 16px 16px 16px',
          borderTop: `1px solid ${colors.border}`,
          paddingTop: 16,
        }}>
          {children}
        </div>
      )}
    </div>
  );
};

/* ── Поле ввода (label + input) ── */

export const Field: React.FC<{
  label: string;
  hint?: string;
  children: React.ReactNode;
  fullWidth?: boolean;
  style?: React.CSSProperties;
}> = ({ label, hint, children, fullWidth, style }) => (
  <div style={{ marginBottom: 12, ...(fullWidth ? { gridColumn: '1 / -1' } : {}), ...style }}>
    <label style={labelStyle}>{label}</label>
    {children}
    {hint && <div style={{ fontSize: 10, color: colors.textSubtle, marginTop: 4 }}>{hint}</div>}
  </div>
);

export const FieldRow: React.FC<{ children: React.ReactNode; cols?: number; gap?: number; style?: React.CSSProperties }> = ({ children, cols = 2, gap = 12, style }) => (
  <div className="profile-fieldrow" style={{
    display: 'grid',
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
    gap,
    ...style,
  }}>
    {children}
  </div>
);

/* ── Popup value editor ── */

const PVE_KEYFRAMES = `
@keyframes pve-overlay-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes pve-sheet-in { from { transform: translateY(72px); opacity: 0.3; } to { transform: translateY(0); opacity: 1; } }
@keyframes pve-row-in { from { transform: translateX(12px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
@keyframes pve-value-pop { 0% { transform: scale(1.14); } 100% { transform: scale(1); } }
`;

const PVE_STYLE_ID = 'pve-keyframes';

(() => {
  if (typeof document === 'undefined') return;
  if (document.getElementById(PVE_STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = PVE_STYLE_ID;
  el.textContent = PVE_KEYFRAMES;
  document.head.appendChild(el);
})();

const normText = (s: string) => s.toLowerCase().replace(/ё/g, 'е').trim();

export const PopupValueEditor: React.FC<{
  label: string;
  value: string | number | undefined | null;
  unit?: string;
  placeholder?: string;
  type?: 'number' | 'text' | 'select';
  options?: { id: string; label: string; desc?: string }[];
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: any) => void;
  children?: React.ReactNode;
  color?: string;
}> = ({ label, value, unit, placeholder, type = 'text', options, min, max, step = 1, onChange, children, color }) => {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<string>('');
  const [query, setQuery] = useState('');
  const c = color || colors.primary;

  const hasValue = value !== undefined && value !== null && value !== '' && value !== 0;

  const option = type === 'select' && options
    ? options.find(o => o.id === String(value))
    : undefined;

  const displayValue = () => {
    if (!hasValue) return placeholder || '—';
    if (option) return option.label;
    if (unit) return `${value} ${unit}`;
    return String(value);
  };

  const openPopup = useCallback(() => {
    setLocal(value !== undefined && value !== null && value !== 0 ? String(value) : '');
    setQuery('');
    setOpen(true);
  }, [value]);

  // Escape закрывает попап + блокировка скролла body, пока попап открыт.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); }
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const commit = () => {
    if (type === 'number') {
      if (local === '' || local === '-') { onChange(undefined); setOpen(false); return; }
      const n = Number(local);
      if (!Number.isFinite(n)) {
        // Невалидный ввод — сбрасываем local чтобы не залип
        setLocal('');
        setOpen(false);
        return;
      }
      let v = n;
      if (min !== undefined) v = Math.max(min, v);
      if (max !== undefined) v = Math.min(max, v);
      onChange(v);
    } else {
      onChange(local);
    }
    setOpen(false);
  };

  const filtered = (type === 'select' && options && query.trim())
    ? options.filter(o =>
        normText(o.label).includes(normText(query)) ||
        (o.desc ? normText(o.desc).includes(normText(query)) : false)
      )
    : (options || []);

  const sliderVal = (() => {
    const n = parseFloat(local);
    return !Number.isFinite(n) ? (min ?? 0) : Math.max(min ?? 0, Math.min(max ?? 300, n));
  })();
  const sliderPct = (max ?? 300) > (min ?? 0)
    ? Math.round(((sliderVal - (min ?? 0)) / ((max ?? 300) - (min ?? 0))) * 100)
    : 0;

  const stepBy = (dir: 1 | -1) => {
    const n = parseFloat(local);
    const base = Number.isFinite(n) ? n : (min ?? 0);
    let v = Math.round((base + dir * step) * 100) / 100;
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    setLocal(String(v));
  };

  const liveNumber = (() => {
    const n = parseFloat(local);
    return Number.isFinite(n) ? n : undefined;
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <button
        type="button"
        onClick={openPopup}
        aria-label={`${label}: ${displayValue()}`}
        style={{
          position: 'relative',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: 12,
          border: `1px solid ${hasValue ? `${c}44` : colors.border}`,
          boxShadow: hasValue ? `0 2px 14px ${c}14` : 'none',
          padding: '10px 34px 10px 12px',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          gap: 3,
          width: '100%',
          textAlign: 'left',
          color: colors.text,
          minHeight: 58,
          transition: 'all 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = `${c}66`;
          e.currentTarget.style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = hasValue ? `${c}44` : colors.border;
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        <span style={{
          fontSize: 10, fontWeight: 600, color: colors.textMuted, letterSpacing: 0.3,
          whiteSpace: 'normal', overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', maxWidth: '100%', lineHeight: 1.3,
        }}>{label}</span>
        <span style={{
          fontSize: 15, fontWeight: 700, color: hasValue ? c : colors.textSubtle,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
        }}>
          {displayValue()}
        </span>
        <span aria-hidden="true" style={{
          position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
          width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: hasValue ? `${c}22` : 'rgba(255,255,255,0.06)',
          border: `1px solid ${hasValue ? `${c}44` : colors.border}`,
          color: hasValue ? c : colors.textSubtle, fontSize: 9,
        }}>✎</span>
      </button>

      {open && ReactDOM.createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={label}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            animation: 'pve-overlay-in 0.18s ease',
          }}
          onClick={() => setOpen(false)}
        >
          <div
            role="presentation"
            style={{
              width: 'min(420px, 100vw)',
              maxHeight: '82vh',
              display: 'flex', flexDirection: 'column',
              background: 'linear-gradient(180deg, #202026, #16161a)',
              border: `1px solid ${c}2e`, borderBottom: 'none',
              borderRadius: '22px 22px 0 0',
              boxShadow: '0 -12px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
              animation: 'pve-sheet-in 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
              overflow: 'hidden',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div aria-hidden="true" style={{ height: 3, background: `linear-gradient(90deg, ${c}, ${c}26 70%, transparent)` }} />
            <div aria-hidden="true" style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.16)' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px 6px' }}>
              <span aria-hidden="true" style={{
                width: 34, height: 34, borderRadius: 11, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `linear-gradient(135deg, ${c}2e, ${c}14)`,
                border: `1px solid ${c}44`, fontSize: 15, color: c,
              }}>{type === 'select' ? '✓' : type === 'number' ? '#' : '✎'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: colors.text, letterSpacing: -0.2 }}>{label}</div>
                <div style={{ fontSize: 10, color: colors.textSubtle, marginTop: 1 }}>
                  {type === 'select'
                    ? 'Выберите значение'
                    : type === 'number'
                      ? (min !== undefined && max !== undefined ? `Диапазон ${min}–${max}${unit ? ' ' + unit : ''}` : 'Введите число')
                      : 'Введите значение'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Закрыть"
                style={{
                  width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(255,255,255,0.06)', border: `1px solid ${colors.border}`,
                  color: colors.textMuted, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
                }}
              >✕</button>
            </div>

            {type === 'select' && options ? (
              <div style={{ padding: '6px 16px 16px', overflowY: 'auto' }}>
                {options.length > 5 && (
                  <div style={{ position: 'relative', marginBottom: 8 }}>
                    <span aria-hidden="true" style={{
                      position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                      fontSize: 12, color: colors.textSubtle, pointerEvents: 'none',
                    }}>⌕</span>
                    <input
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      placeholder="Поиск…"
                      aria-label={`Поиск в ${label}`}
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        padding: '8px 30px 8px 28px', borderRadius: 10,
                        border: `1px solid ${colors.border}`,
                        background: 'rgba(255,255,255,0.05)',
                        color: colors.text, fontSize: 13, outline: 'none', minHeight: 36,
                      }}
                    />
                    {query && (
                      <button
                        type="button"
                        onClick={() => setQuery('')}
                        aria-label="Очистить поиск"
                        style={{
                          position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                          width: 20, height: 20, borderRadius: '50%',
                          background: 'rgba(255,255,255,0.08)', border: 'none',
                          color: colors.textMuted, fontSize: 9, cursor: 'pointer',
                        }}
                      >✕</button>
                    )}
                  </div>
                )}
                {filtered.map((o, i) => {
                  const sel = String(value) === o.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => { onChange(o.id); setOpen(false); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                        padding: '10px 12px', borderRadius: 12, cursor: 'pointer', marginBottom: 6,
                        background: sel ? `linear-gradient(135deg, ${c}22, ${c}0d)` : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${sel ? `${c}55` : colors.border}`,
                        boxShadow: sel ? `0 2px 12px ${c}1f` : 'none',
                        transition: 'all 0.15s', color: colors.text, minHeight: 46,
                        animation: 'pve-row-in 0.22s ease both',
                        animationDelay: `${Math.min(i * 18, 216)}ms`,
                      }}
                    >
                      <span aria-hidden="true" style={{
                        width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: `2px solid ${sel ? c : 'rgba(255,255,255,0.22)'}`,
                        background: sel ? c : 'transparent',
                        boxShadow: sel ? `0 0 0 4px ${c}22` : 'none',
                        transition: 'all 0.15s',
                      }}>
                        {sel && <span style={{ color: '#000', fontSize: 10, fontWeight: 900 }}>✓</span>}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{
                          display: 'block', fontSize: 13, fontWeight: sel ? 800 : 500,
                          color: sel ? c : colors.text,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>{o.label}</span>
                        {o.desc && (
                          <span style={{
                            display: 'block', fontSize: 10, color: colors.textSubtle,
                            marginTop: 1, lineHeight: 1.4, fontWeight: 400,
                          }}>{o.desc}</span>
                        )}
                      </span>
                      {sel && (
                        <span style={{
                          fontSize: 10, color: c, fontWeight: 700, flexShrink: 0,
                          background: `${c}1a`, border: `1px solid ${c}33`,
                          padding: '2px 8px', borderRadius: 8, whiteSpace: 'nowrap',
                        }}>текущее</span>
                      )}
                    </button>
                  );
                })}
                {filtered.length === 0 && (
                  <div style={{ padding: '20px 12px', textAlign: 'center', fontSize: 12, color: colors.textSubtle }}>
                    Ничего не найдено
                  </div>
                )}
              </div>
            ) : type === 'number' ? (
              <div style={{ padding: '6px 16px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '4px 0 10px' }}>
                  <button
                    type="button"
                    onClick={() => stepBy(-1)}
                    aria-label="Уменьшить"
                    style={{
                      width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(255,255,255,0.06)', border: `1px solid ${colors.border}`,
                      color: colors.text, fontSize: 18, cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >−</button>
                  <div key={liveNumber ?? 'empty'} style={{
                    minWidth: 140, textAlign: 'center', fontSize: 34, fontWeight: 900,
                    color: c, letterSpacing: -1, lineHeight: 1.1,
                    animation: 'pve-value-pop 0.18s ease',
                  }}>
                    {liveNumber ?? '—'}
                    {unit && <span style={{ fontSize: 15, fontWeight: 700, color: colors.textMuted, marginLeft: 5 }}>{unit}</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => stepBy(1)}
                    aria-label="Увеличить"
                    style={{
                      width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(255,255,255,0.06)', border: `1px solid ${colors.border}`,
                      color: colors.text, fontSize: 18, cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >+</button>
                </div>
                <input
                  type="range"
                  min={min ?? 0}
                  max={max ?? 300}
                  step={step}
                  value={sliderVal}
                  onChange={e => setLocal(e.target.value)}
                  aria-label={label}
                  style={{
                    width: '100%', height: 6, borderRadius: 3, cursor: 'pointer', margin: '0 0 8px',
                    outline: 'none', appearance: 'none', WebkitAppearance: 'none',
                    background: `linear-gradient(to right, ${c} 0%, ${c} ${sliderPct}%, rgba(255,255,255,0.1) ${sliderPct}%, rgba(255,255,255,0.1) 100%)`,
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: colors.textSubtle, marginBottom: 12 }}>
                  <span>{min ?? 0}</span>
                  <span>{max ?? 300}</span>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    value={local}
                    onChange={e => setLocal(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setOpen(false); }}
                    min={min}
                    max={max}
                    step={step}
                    placeholder={placeholder}
                    autoFocus
                    style={{ ...inputStyle, marginBottom: 12, fontSize: 18, padding: '12px 42px 12px 14px' }}
                    inputMode="decimal"
                  />
                  {unit && (
                    <span aria-hidden="true" style={{
                      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                      fontSize: 12, color: colors.textSubtle, pointerEvents: 'none',
                    }}>{unit}</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: colors.textSubtle, marginRight: 'auto' }}>
                    Enter — сохранить · Esc — отмена
                  </span>
                  <button
                    onClick={() => setOpen(false)}
                    style={{
                      ...inputBase, background: 'transparent', border: `1px solid ${colors.border}`,
                      cursor: 'pointer', minHeight: 36, padding: '8px 16px',
                    }}
                  >Отмена</button>
                  <button
                    onClick={commit}
                    style={{
                      ...inputBase, background: `linear-gradient(135deg, ${c}, ${c}bb)`,
                      border: `1px solid ${c}`,
                      color: '#000', cursor: 'pointer', fontWeight: 700,
                      minHeight: 36, padding: '8px 16px', boxShadow: `0 2px 12px ${c}3d`,
                    }}
                  >Сохранить</button>
                </div>
              </div>
            ) : (
              <div style={{ padding: '6px 16px 16px' }}>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={local}
                    onChange={e => setLocal(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setOpen(false); }}
                    placeholder={placeholder}
                    autoFocus
                    style={{ ...inputStyle, marginBottom: 12, fontSize: 16, padding: '12px 34px 12px 14px' }}
                  />
                  {local && (
                    <button
                      type="button"
                      onClick={() => setLocal('')}
                      aria-label="Очистить"
                      style={{
                        position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                        width: 22, height: 22, borderRadius: '50%',
                        background: 'rgba(255,255,255,0.08)', border: 'none',
                        color: colors.textMuted, fontSize: 10, cursor: 'pointer',
                      }}
                    >✕</button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: colors.textSubtle, marginRight: 'auto' }}>
                    Enter — сохранить · Esc — отмена
                  </span>
                  <button
                    onClick={() => setOpen(false)}
                    style={{
                      ...inputBase, background: 'transparent', border: `1px solid ${colors.border}`,
                      cursor: 'pointer', minHeight: 36, padding: '8px 16px',
                    }}
                  >Отмена</button>
                  <button
                    onClick={commit}
                    style={{
                      ...inputBase, background: `linear-gradient(135deg, ${c}, ${c}bb)`,
                      border: `1px solid ${c}`,
                      color: '#000', cursor: 'pointer', fontWeight: 700,
                      minHeight: 36, padding: '8px 16px', boxShadow: `0 2px 12px ${c}3d`,
                    }}
                  >Сохранить</button>
                </div>
              </div>
            )}
          </div>
        </div>
      , document.body)}
    </div>
  );
};
