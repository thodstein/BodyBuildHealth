/**
 * ProfileScreen_v2/ui.ts — общие утилиты UI для нового Профиля.
 */
import React, { useState, useRef, useEffect } from 'react';

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
}> = ({ value: rawValue, onChange, min, max, step = 1, label, unit, color }) => {
  const c = color || colors.primary;
  const value = (rawValue !== undefined && rawValue !== null && !isNaN(rawValue)) ? rawValue : min;
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  return (
    <div>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.62)', fontWeight: 600 }}>{label}</span>
          <span style={{
            fontSize: 11, fontWeight: 700, color: c,
            background: `${c}1a`, border: `1px solid ${c}33`,
            padding: '1px 8px', borderRadius: 8, minWidth: 36, textAlign: 'center',
          }}>{rawValue != null ? `${value}${unit || ''}` : '—'}</span>
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

export const PopupValueEditor: React.FC<{
  label: string;
  value: string | number | undefined | null;
  unit?: string;
  placeholder?: string;
  type?: 'number' | 'text' | 'select';
  options?: { id: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: any) => void;
  children?: React.ReactNode;
  color?: string;
}> = ({ label, value, unit, placeholder, type = 'text', options, min, max, step = 1, onChange, children, color }) => {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<string>('');
  const c = color || colors.primary;

  const hasValue = value !== undefined && value !== null && value !== '' && value !== 0;

  const displayValue = () => {
    if (!hasValue) return placeholder || '—';
    if (unit) return `${value} ${unit}`;
    return String(value);
  };

  const openPopup = () => {
    setLocal(value !== undefined && value !== null && value !== 0 ? String(value) : '');
    setOpen(true);
  };

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <button
        type="button"
        onClick={openPopup}
        aria-label={`${label}: ${displayValue()}`}
        style={{
          ...glassCard,
          background: 'rgba(255,255,255,0.04)',
          padding: '10px 12px',
          cursor: 'pointer',
          border: `1px solid ${hasValue ? `${c}44` : colors.border}`,
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
          boxShadow: hasValue ? `0 2px 14px ${c}14` : undefined,
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
          {hasValue && <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.55, fontWeight: 600 }}>✎</span>}
        </span>
      </button>

      {open && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{
              ...glassCard,
              width: 'min(360px, 90vw)',
              padding: 0,
              overflow: 'hidden',
              border: `1px solid ${c}44`,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div aria-hidden="true" style={{ height: 3, background: `linear-gradient(90deg, ${c}, ${c}22 70%, transparent)` }} />
            <div style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span aria-hidden="true" style={{
                  width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: `${c}22`, border: `1px solid ${c}44`, fontSize: 14,
                }}>✎</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: c, letterSpacing: -0.2 }}>{label}</div>
                  <div style={{ fontSize: 10, color: colors.textSubtle, marginTop: 1 }}>
                    {type === 'select' ? 'Выберите значение' : 'Введите значение'}
                  </div>
                </div>
              </div>

              {type === 'select' && options ? (
                <select
                  value={local}
                  onChange={e => setLocal(e.target.value)}
                  style={{ ...selectStyle, marginBottom: 16 }}
                  autoFocus
                >
                  {placeholder && <option value="">{placeholder}</option>}
                  {options.map(o => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
              ) : type === 'number' ? (
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
                  style={{ ...inputStyle, marginBottom: 16, fontSize: 18, padding: '12px 14px' }}
                  inputMode="decimal"
                />
              ) : (
                <input
                  type="text"
                  value={local}
                  onChange={e => setLocal(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setOpen(false); }}
                  placeholder={placeholder}
                  autoFocus
                  style={{ ...inputStyle, marginBottom: 16, fontSize: 18, padding: '12px 14px' }}
                />
              )}

              {unit && type === 'number' && (
                <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 16 }}>
                  Единица измерения: {unit}
                  {min !== undefined && max !== undefined && ` · Диапазон: ${min}–${max}`}
                </div>
              )}

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
                    ...inputBase, background: c, border: `1px solid ${c}`,
                    color: '#000', cursor: 'pointer', fontWeight: 700,
                    minHeight: 36, padding: '8px 16px', boxShadow: `0 2px 10px ${c}44`,
                  }}
                >Сохранить</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
