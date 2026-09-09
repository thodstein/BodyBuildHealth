/**
 * ProfileScreen_v2/ui.ts — общие утилиты UI для нового Профиля.
 */
import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { makeAlpha } from '../../native/accent';

export const colors = {
  bg: 'rgba(28,28,32,0.65)',
  bgSolid: '#1c1c20',
  border: 'rgba(255,255,255,0.10)',
  borderHover: 'rgba(255,255,255,0.20)',
  text: '#fff',
  textMuted: 'rgba(255,255,255,0.55)',
  textSubtle: 'rgba(255,255,255,0.35)',
  primary: 'var(--profile-accent, #34d399)',
  primaryDim: 'rgba(var(--profile-accent-rgb, 52, 211, 153), 0.15)',
  warning: '#f59e0b',
  warningDim: 'rgba(245,158,11,0.15)',
  danger: '#ef4444',
  dangerDim: 'rgba(239,68,68,0.15)',
  blue: '#3b82f6',
  blueDim: 'rgba(59,130,246,0.15)',
  purple: '#8b5cf6',
  purpleDim: 'rgba(139,92,246,0.15)',
  green: '#34d399',
  greenDim: 'rgba(52,211,153,0.15)',
  pink: '#ec4899',
  pinkDim: 'rgba(236,72,153,0.15)',
  orange: '#f59e0b',
  orangeDim: 'rgba(245,158,11,0.15)',
  teal: '#14b8a6',
  tealDim: 'rgba(20,184,166,0.15)',
};

/* ── Акцент темы в инлайн-стилях ────────────────────────────────────────
 * colors.primary — это var(--profile-accent, #34d399): в APK мост
 * styles-native.css (§62) кладёт туда системный --accent, в TG/web —
 * фолбэк #34d399 (1-в-1, без изменений).
 * Hex+alpha конкатенация (`${c}44`) с var() невалидна, поэтому ВСЕ
 * полупрозрачные производные идут через withAlpha(): для hex — та же
 * строка что раньше, для акцента — rgba() через rgb-триплет. */
export const PROFILE_ACCENT_VAR = 'var(--profile-accent, #34d399)';
export const PROFILE_ACCENT_RGB_VAR = 'var(--profile-accent-rgb, 52, 211, 153)';
/** Единая реализация — native/accent.makeAlpha (сигнатура и выхлоп те же). */
export const withAlpha = makeAlpha(PROFILE_ACCENT_VAR, PROFILE_ACCENT_RGB_VAR);

/* ── Enhanced Design System: Gradients, Animations, Glassmorphism ──────── */

export const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif";

export const c = {
  bg: '#0a0a0a',
  card: '#1c1c1e',
  cardBorder: 'rgba(255,255,255,0.08)',
  cardHighlight: 'inset 0 0.5px 0 rgba(255,255,255,0.07)',
  hairline: 'rgba(255,255,255,0.07)',
  row: 'rgba(255,255,255,0.04)',
  text: '#f5f5f7',
  text2: '#ffffff',
  text3: '#ffffff',
  green: '#34d399',
  red: '#ff453a',
  orange: '#ff9f0a',
  yellow: '#ffd60a',
  blue: '#0a84ff',
  purple: '#bf5af2',
  teal: '#64d2ff',
  pink: '#ff375f',
  gray: '#ffffff',
  glass: 'rgba(28,28,30,0.72)',
  glassBorder: 'rgba(255,255,255,0.12)',
  glassHighlight: 'rgba(255,255,255,0.08)',
  gradGreen: 'linear-gradient(135deg, #34d399 0%, #22c55e 100%)',
  gradBlue: 'linear-gradient(135deg, #0a84ff 0%, #0071e3 100%)',
  gradPurple: 'linear-gradient(135deg, #bf5af2 0%, #a855f7 100%)',
  gradOrange: 'linear-gradient(135deg, #ff9f0a 0%, #f97316 100%)',
  gradRed: 'linear-gradient(135deg, #ff453a 0%, #ff6b5a 100%)',
  gradTeal: 'linear-gradient(135deg, #64d2ff 0%, #06b6d4 100%)',
  gradPink: 'linear-gradient(135deg, #ff375f 0%, #f43f5e 100%)',
  gradSunset: 'linear-gradient(135deg, #ff9f0a 0%, #f97316 50%, #ef4444 100%)',
  gradOcean: 'linear-gradient(135deg, #0a84ff 0%, #06b6d4 50%, #34d399 100%)',
  gradCosmic: 'linear-gradient(135deg, #bf5af2 0%, #a855f7 50%, #0a84ff 100%)',
} as const;

export const tnum: React.CSSProperties = { fontVariantNumeric: 'tabular-nums' };

export const keyframes = {
  fadeIn: '@keyframes ui-fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }',
  slideUp: '@keyframes ui-slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }',
  slideRight: '@keyframes ui-slideRight { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }',
  scaleIn: '@keyframes ui-scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }',
  shimmer: '@keyframes ui-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }',
  pulse: '@keyframes ui-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }',
  float: '@keyframes ui-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }',
};

export const animations = {
  fadeIn: 'ui-fadeIn 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
  slideUp: 'ui-slideUp 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
  slideRight: 'ui-slideRight 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
  scaleIn: 'ui-scaleIn 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
  shimmer: 'ui-shimmer 2s infinite linear',
  pulse: 'ui-pulse 2s infinite ease-in-out',
  float: 'ui-float 3s infinite ease-in-out',
};

export const staggerDelay = (index: number, base = 0.08): React.CSSProperties => ({
  animationDelay: `${index * base}s`,
});

export const glassCard: React.CSSProperties = {
  background: 'linear-gradient(180deg, rgba(30,30,34,0.85), rgba(18,18,21,0.9))',
  backdropFilter: 'blur(20px) saturate(160%)',
  WebkitBackdropFilter: 'blur(20px) saturate(160%)',
  borderRadius: 20,
  border: '1px solid rgba(255,255,255,0.09)',
  boxShadow: '0 12px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.07)',
  padding: 20,
  marginBottom: 14,
  animation: animations.slideUp,
};

export const glassCardElevated: React.CSSProperties = {
  ...glassCard,
  boxShadow: `0 16px 48px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.2), inset 0 1px 0 ${c.glassHighlight}`,
  border: `1px solid ${c.glassBorder}`,
};

export const glassTile: React.CSSProperties = {
  background: c.glass,
  backdropFilter: 'blur(16px) saturate(180%)',
  WebkitBackdropFilter: 'blur(16px) saturate(180%)',
  borderRadius: 16,
  border: `1px solid ${c.glassBorder}`,
  boxShadow: `0 4px 20px rgba(0,0,0,0.24), inset 0 1px 0 ${c.glassHighlight}`,
  padding: '14px 16px',
  transition: 'transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94), box-shadow 0.2s',
};

export const chip = (active: boolean, color: string): React.CSSProperties => ({
  minHeight: 30,
  padding: '0 12px',
  borderRadius: 999,
  cursor: 'pointer',
  border: `1px solid ${active ? `${withAlpha(color, '55')}` : 'rgba(255,255,255,0.1)'}`,
  background: active ? `${withAlpha(color, '1f')}` : 'transparent',
  color: active ? color : colors.textMuted,
  fontSize: 11.5,
  fontWeight: 500,
  fontFamily: FONT,
  whiteSpace: 'nowrap',
  transition: 'background 0.15s, color 0.15s',
});

export const chipGlass = (active: boolean, color: string): React.CSSProperties => ({
  minHeight: 30,
  padding: '0 12px',
  borderRadius: 999,
  cursor: 'pointer',
  border: `1px solid ${active ? `${withAlpha(color, '66')}` : c.glassBorder}`,
  background: active ? `${withAlpha(color, '22')}` : c.glass,
  backdropFilter: 'blur(16px) saturate(180%)',
  WebkitBackdropFilter: 'blur(16px) saturate(180%)',
  boxShadow: active ? `0 2px 10px ${withAlpha(color, '33')}, inset 0 1px 0 ${c.glassHighlight}` : `inset 0 1px 0 ${c.glassHighlight}`,
  color: active ? color : colors.textMuted,
  fontSize: 11.5,
  fontWeight: 500,
  fontFamily: FONT,
  whiteSpace: 'nowrap',
  transition: 'background 0.15s, color 0.15s, box-shadow 0.15s',
});

export const metricLabel: React.CSSProperties = {
  display: 'block',
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.4px',
  textTransform: 'uppercase',
  color: colors.textMuted,
  marginBottom: 2,
  fontFamily: FONT,
};

export const metricValue: React.CSSProperties = {
  ...tnum,
  display: 'block',
  fontSize: 17,
  fontWeight: 700,
  letterSpacing: '-0.3px',
  color: colors.text,
  fontFamily: FONT,
};

export const metricValueLarge: React.CSSProperties = {
  ...metricValue,
  fontSize: 28,
  fontWeight: 800,
  letterSpacing: '-0.8px',
};

export const metricDelta: React.CSSProperties = {
  ...tnum,
  display: 'block',
  fontSize: 11,
  fontWeight: 500,
  color: colors.textMuted,
  marginTop: 2,
  fontFamily: FONT,
};

export const metricValueGradient = (grad: string): React.CSSProperties => ({
  ...metricValue,
  background: grad,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
});

export const metricValueLargeGradient = (grad: string): React.CSSProperties => ({
  ...metricValueLarge,
  background: grad,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
});

export const metricDeltaGradient = (grad: string): React.CSSProperties => ({
  ...metricDelta,
  background: grad,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
});

export const progressBar = (grad: string, height = 8): React.CSSProperties => ({
  height,
  borderRadius: 999,
  background: `rgba(255,255,255,0.08)`,
  overflow: 'hidden',
});

export const progressFill = (grad: string, pct: number): React.CSSProperties => ({
  height: '100%',
  width: `${Math.max(0, Math.min(100, pct))}%`,
  borderRadius: 999,
  background: grad,
  transition: 'width 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
});

export const chartLine = (color: string, width = 2, dash?: string): React.CSSProperties => ({
  stroke: color,
  strokeWidth: width,
  fill: 'none',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  strokeDasharray: dash,
  filter: `drop-shadow(0 2px 4px ${withAlpha(color, '44')})`,
});

export const chartArea = (color: string, opacity = 0.15): React.CSSProperties => ({
  fill: color,
  fillOpacity: opacity,
  filter: `drop-shadow(0 4px 12px ${withAlpha(color, '33')})`,
});

export const glowRing = (color: string, size = 8): React.CSSProperties => ({
  width: size,
  height: size,
  borderRadius: '50%',
  background: `radial-gradient(circle at 30% 30%, ${withAlpha(color, 'cc')}, ${withAlpha(color, '33')} 60%, transparent 100%)`,
  boxShadow: `0 0 ${size * 2}px ${withAlpha(color, '66')}, inset 0 0 ${size}px ${withAlpha(color, '44')}`,
});

export const flexCenter: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export const flexBetween: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

export const gridAutoFit = (minWidth = '160px'): React.CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}, 1fr))`,
  gap: 12,
});

export const grid3: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 12,
};

export const grid2: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: 12,
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
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 13,
  padding: '10px 12px',
  color: colors.text,
  fontSize: 16,
  outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
  minHeight: 44,
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
  fontSize: 10.5,
  fontWeight: 800,
  color: 'rgba(255,255,255,0.6)',
  textTransform: 'uppercase',
  letterSpacing: '0.8px',
  marginBottom: 6,
  display: 'block',
};

/* ── Заголовок подгруппы (иконка-бокс + текст) ── */

export const GroupHeader: React.FC<{ icon: React.ReactNode; title: string; color?: string; style?: React.CSSProperties }> = ({ icon, title, color, style }) => {
  const c = color || colors.text;
  return (
    <div className="profile-grouphead" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, ...style }}>
      <span aria-hidden="true" style={{
        width: 32, height: 32, borderRadius: 11, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff',
        background: `linear-gradient(135deg, ${withAlpha(c, '3d')}, ${withAlpha(c, '1a')})`,
        border: `1px solid ${withAlpha(c, '40')}`,
        boxShadow: `0 4px 12px ${withAlpha(c, '26')}, inset 0 1px 0 rgba(255,255,255,0.15)`,
      }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: '-0.1px' }}>{title}</span>
      <span aria-hidden="true" style={{ flex:1, height:1, background:'linear-gradient(90deg, rgba(255,255,255,0.12), transparent)', borderRadius:1, marginLeft:2 }} />
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
    <div className="profile-numinput" style={{ position: 'relative', width: '100%' }}>
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
    className="profile-textinput"
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
    className="profile-selectinput"
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
      className="profile-boolchip"
      data-active={checked}
      aria-pressed={checked}
      style={{
        padding: '8px 15px',
        borderRadius: 999,
        fontSize: 12.5,
        fontWeight: checked ? 800 : 600,
        cursor: 'pointer',
        border: `1px solid ${checked ? c : 'rgba(255,255,255,0.10)'}`,
        background: checked ? `linear-gradient(135deg, ${withAlpha(c, '30')}, ${withAlpha(c, '12')})` : 'rgba(255,255,255,0.04)',
        color: checked ? '#fff' : 'rgba(255,255,255,0.65)',
        transition: 'all 0.2s',
        minHeight: 40,
        boxShadow: checked ? `0 4px 14px ${withAlpha(c, '28')}, inset 0 1px 0 rgba(255,255,255,0.12)` : 'none',
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
    <div className="profile-slider">
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: '#fff', fontWeight: 700 }}>{label}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              fontSize: 13, fontWeight: 800, color: '#fff', fontVariantNumeric: 'tabular-nums',
              background: `linear-gradient(135deg, ${withAlpha(c, '35')}, ${withAlpha(c, '15')})`,
              border: `1px solid ${withAlpha(c, '45')}`,
              padding: '3px 11px', borderRadius: 999, minWidth: 44, textAlign: 'center',
              boxShadow: `0 2px 10px ${withAlpha(c, '25')}`,
            }}>{rawValue != null ? `${value}${unit || ''}` : '—'}</span>
          </span>
        </div>
      )}
      <div style={{ position: 'relative', height: 32, display: 'flex', alignItems: 'center' }}>
        <div style={{
          position: 'absolute', left: 0, right: 0, height: 6, borderRadius: 99,
          background: 'rgba(255,255,255,0.08)',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)',
        }} />
        <div style={{
          position: 'absolute', left: 0, width: `${pct}%`, height: 6, borderRadius: 99,
          background: `linear-gradient(90deg, ${withAlpha(c, '60')}, ${c})`,
          boxShadow: `0 0 10px ${withAlpha(c, '40')}`,
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
            position: 'relative', width: '100%', height: 32, opacity: 0, cursor: 'pointer', margin: 0,
          }}
        />
        <div style={{
          position: 'absolute', left: `calc(${pct}% - 11px)`,
          width: 22, height: 22, borderRadius: '50%',
          background: `radial-gradient(circle at 35% 30%, #fff, ${c} 65%)`,
          border: `2px solid ${c}`,
          boxShadow: `0 0 0 5px ${withAlpha(c, '22')}, 0 3px 10px ${withAlpha(c, '50')}`,
          pointerEvents: 'none',
          transition: 'left 0.12s',
        }} />
      </div>
      {(minLabel || maxLabel) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 6, fontSize: 10.5, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>
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
  icon?: React.ReactNode;
  color?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: string;
  id?: string;
}> = ({ title, subtitle, icon, color, defaultOpen = false, children, badge, id }) => {
  const [open, setOpen] = useState(defaultOpen);
  const c = color || colors.primary;
  // Пакетное «Развернуть все / Свернуть» из ProfileUserTab (без проп-дриллинга).
  useEffect(() => {
    const handler = (e: Event) => {
      const v = (e as CustomEvent<boolean>).detail;
      if (typeof v === 'boolean') setOpen(v);
    };
    window.addEventListener('profile-accordion-toggle', handler as EventListener);
    return () => window.removeEventListener('profile-accordion-toggle', handler as EventListener);
  }, []);
  return (
    <div
      id={id}
      className="profile-accordion pf-acc"
      data-open={open}
      style={{
        background: open
          ? 'linear-gradient(180deg, rgba(32,32,37,0.92), rgba(18,18,21,0.94))'
          : 'linear-gradient(180deg, rgba(26,26,30,0.85), rgba(18,18,21,0.9))',
        backdropFilter: 'blur(20px) saturate(160%)',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        borderRadius: 20,
        border: `1px solid ${open ? withAlpha(c, '30') : 'rgba(255,255,255,0.09)'}`,
        boxShadow: open
          ? `0 14px 36px rgba(0,0,0,0.4), 0 0 0 1px ${withAlpha(c, '12')}, inset 0 1px 0 rgba(255,255,255,0.08)`
          : '0 8px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)',
        padding: 0,
        overflow: 'hidden',
        scrollMarginTop: 120, // для smooth scroll с учётом sticky quick-jump
        position: 'relative',
        transition: 'border-color 0.25s, box-shadow 0.25s',
        animation: animations.slideUp,
      }}
    >
      {/* Акцентная полоса сверху в цвет секции */}
      <div aria-hidden="true" style={{
        height: 3, width: '100%',
        background: `linear-gradient(90deg, ${c}, ${withAlpha(c, '30')} 55%, transparent)`,
        opacity: open ? 1 : 0.55,
      }} />
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="pf-acc-btn"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 13,
          padding: '14px 15px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          color: colors.text,
          minHeight: 68,
        }}
      >
        {icon && (
          <span aria-hidden="true" style={{
            width: 48, height: 48, borderRadius: 15, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff',
            background: `linear-gradient(135deg, ${withAlpha(c, '45')}, ${withAlpha(c, '18')})`,
            border: `1px solid ${withAlpha(c, '45')}`,
            boxShadow: `0 6px 18px ${withAlpha(c, '30')}, inset 0 1px 0 rgba(255,255,255,0.2)`,
          }}>{icon}</span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap:'wrap' }}>
            <span style={{ fontSize: 15.5, fontWeight: 800, color: '#fff', letterSpacing: -0.2 }}>{title}</span>
            {badge && (
              <span style={{
                fontSize: 10, fontWeight: 800, color: c, background: `${withAlpha(c, '18')}`,
                padding: '3px 9px', borderRadius: 999, border: `1px solid ${withAlpha(c, '35')}`,
                whiteSpace: 'nowrap', letterSpacing:'0.2px',
              }}>{badge}</span>
            )}
          </div>
          {subtitle && <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.6)', marginTop: 3, lineHeight:1.4 }}>{subtitle}</div>}
        </div>
        <span style={{
          width: 32, height: 32, borderRadius: 11, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: open ? `linear-gradient(135deg, ${withAlpha(c, '30')}, ${withAlpha(c, '12')})` : 'rgba(255,255,255,0.06)',
          border: `1px solid ${open ? withAlpha(c, '40') : 'rgba(255,255,255,0.10)'}`,
          fontSize: 14, color: open ? '#fff' : colors.textMuted,
          transition: 'transform 0.25s',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        }}>▾</span>
      </button>
      {open && (
        <div className="profile-section-body" style={{
          padding: '0 15px 17px 15px',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          paddingTop: 15,
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
  <div className="profile-field" style={{ marginBottom: 13, ...(fullWidth ? { gridColumn: '1 / -1' } : {}), ...style }}>
    <label style={labelStyle}>{label}</label>
    {children}
    {hint && <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.45)', marginTop: 5, lineHeight:1.4 }}>{hint}</div>}
  </div>
);

export const FieldRow: React.FC<{ children: React.ReactNode; cols?: number; gap?: number; style?: React.CSSProperties }> = ({ children, cols = 2, gap = 10, style }) => (
  <div className="profile-fieldrow" data-cols={cols} style={{
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
    <div className="profile-pve" style={{ display: 'flex', flexDirection: 'column' }}>
      <button
        type="button"
        onClick={openPopup}
        className="profile-pve-btn"
        data-filled={hasValue}
        aria-label={`${label}: ${displayValue()}`}
        style={{
          position: 'relative',
          background: hasValue
            ? `linear-gradient(180deg, ${withAlpha(c, '14')}, rgba(255,255,255,0.03))`
            : 'rgba(255,255,255,0.04)',
          borderRadius: 15,
          border: `1px solid ${hasValue ? `${withAlpha(c, '40')}` : 'rgba(255,255,255,0.09)'}`,
          boxShadow: hasValue ? `0 4px 16px ${withAlpha(c, '12')}, inset 0 1px 0 rgba(255,255,255,0.07)` : 'inset 0 1px 0 rgba(255,255,255,0.05)',
          padding: '10px 38px 10px 13px',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          gap: 4,
          width: '100%',
          textAlign: 'left',
          color: colors.text,
          minHeight: 64,
          transition: 'all 0.2s',
        }}
      >
        <span style={{
          fontSize: 9.5, fontWeight: 800, color: hasValue ? withAlpha(c, 'dd') as string : 'rgba(255,255,255,0.5)', letterSpacing: '0.7px', textTransform:'uppercase',
          whiteSpace: 'normal', overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', maxWidth: '100%', lineHeight: 1.35,
        }}>{label}</span>
        <span style={{
          fontSize: 16, fontWeight: 800, color: hasValue ? '#fff' : 'rgba(255,255,255,0.3)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
          letterSpacing:'-0.2px', fontVariantNumeric:'tabular-nums',
        }}>
          {displayValue()}
        </span>
        <span aria-hidden="true" style={{
          position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)',
          width: 26, height: 26, borderRadius: 9, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: hasValue ? `linear-gradient(135deg, ${withAlpha(c, '30')}, ${withAlpha(c, '12')})` : 'rgba(255,255,255,0.06)',
          border: `1px solid ${hasValue ? `${withAlpha(c, '45')}` : 'rgba(255,255,255,0.10)'}`,
          color: hasValue ? '#fff' : colors.textSubtle, fontSize: 10,
          boxShadow: hasValue ? `0 2px 8px ${withAlpha(c, '25')}` : 'none',
        }}>✎</span>
      </button>

      {open && ReactDOM.createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={label}
          className="pf-pve-overlay"
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
            className="pf-pve-sheet"
            style={{
              width: 'min(440px, 100vw)',
              maxHeight: '84vh',
              display: 'flex', flexDirection: 'column',
              background: 'linear-gradient(180deg, #24242b, #141418)',
              border: `1px solid ${withAlpha(c, '35')}`, borderBottom: 'none',
              borderRadius: '24px 24px 0 0',
              boxShadow: '0 -16px 56px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.07)',
              animation: 'pve-sheet-in 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
              overflow: 'hidden',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div aria-hidden="true" style={{ height: 4, background: `linear-gradient(90deg, ${c}, ${withAlpha(c, '30')} 70%, transparent)` }} />
            <div aria-hidden="true" style={{ display: 'flex', justifyContent: 'center', paddingTop: 9 }}>
              <div style={{ width: 44, height: 5, borderRadius: 99, background: 'rgba(255,255,255,0.18)' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px 8px' }}>
              <span aria-hidden="true" style={{
                width: 42, height: 42, borderRadius: 14, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `linear-gradient(135deg, ${withAlpha(c, '35')}, ${withAlpha(c, '15')})`,
                border: `1px solid ${withAlpha(c, '50')}`, fontSize: 17, color: '#fff',
                boxShadow: `0 4px 14px ${withAlpha(c, '30')}, inset 0 1px 0 rgba(255,255,255,0.15)`,
              }}>{type === 'select' ? '✓' : type === 'number' ? '#' : '✎'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: colors.text, letterSpacing: -0.2 }}>{label}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
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
                className="pf-pve-close"
                style={{
                  width: 44, height: 44, minWidth: 44, minHeight: 44, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(255,255,255,0.06)', border: `1px solid ${colors.border}`,
                  color: colors.textMuted, fontSize: 14, cursor: 'pointer', transition: 'all 0.15s',
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
                      className="pf-pve-search"
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        padding: '8px 34px 8px 28px', borderRadius: 10,
                        border: `1px solid ${colors.border}`,
                        background: 'rgba(255,255,255,0.05)',
                        color: colors.text, fontSize: 16, outline: 'none', minHeight: 44,
                      }}
                    />
                    {query && (
                      <button
                        type="button"
                        onClick={() => setQuery('')}
                        aria-label="Очистить поиск"
                        className="pf-pve-clear"
                        style={{
                          position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                          width: 28, height: 28, borderRadius: '50%',
                          background: 'rgba(255,255,255,0.08)', border: 'none',
                          color: colors.textMuted, fontSize: 11, cursor: 'pointer',
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
                      className="pf-pve-opt"
                      data-sel={sel}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left',
                        padding: '11px 13px', borderRadius: 14, cursor: 'pointer', marginBottom: 7,
                        background: sel ? `linear-gradient(135deg, ${withAlpha(c, '26')}, ${withAlpha(c, '10')})` : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${sel ? `${withAlpha(c, '60')}` : 'rgba(255,255,255,0.09)'}`,
                        boxShadow: sel ? `0 4px 16px ${withAlpha(c, '22')}, inset 0 1px 0 rgba(255,255,255,0.08)` : 'none',
                        transition: 'all 0.15s', color: colors.text, minHeight: 52,
                        animation: 'pve-row-in 0.22s ease both',
                        animationDelay: `${Math.min(i * 18, 216)}ms`,
                      }}
                    >
                      <span aria-hidden="true" style={{
                        width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: `2px solid ${sel ? c : 'rgba(255,255,255,0.22)'}`,
                        background: sel ? c : 'transparent',
                        boxShadow: sel ? `0 0 0 4px ${withAlpha(c, '22')}` : 'none',
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
                          background: `${withAlpha(c, '1a')}`, border: `1px solid ${withAlpha(c, '33')}`,
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
                    className="pf-pve-step"
                    style={{
                      width: 44, height: 44, minWidth: 44, minHeight: 44, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(255,255,255,0.06)', border: `1px solid ${colors.border}`,
                      color: colors.text, fontSize: 18, cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >−</button>
                  <div key={liveNumber ?? 'empty'} style={{
                    minWidth: 150, textAlign: 'center', fontSize: 38, fontWeight: 900,
                    color: '#fff', letterSpacing: -1, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums',
                    textShadow: `0 0 24px ${withAlpha(c, '50')}`,
                    animation: 'pve-value-pop 0.18s ease',
                  }}>
                    {liveNumber ?? '—'}
                    {unit && <span style={{ fontSize: 15, fontWeight: 700, color: colors.textMuted, marginLeft: 5 }}>{unit}</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => stepBy(1)}
                    aria-label="Увеличить"
                    className="pf-pve-step"
                    style={{
                      width: 44, height: 44, minWidth: 44, minHeight: 44, borderRadius: '50%', flexShrink: 0,
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
                    className="pf-pve-cancel"
                    style={{
                      ...inputBase, background: 'transparent', border: `1px solid ${colors.border}`,
                      cursor: 'pointer', minHeight: 44, padding: '8px 16px',
                    }}
                  >Отмена</button>
                  <button
                    onClick={commit}
                    className="pf-pve-save"
                    style={{
                      ...inputBase, background: `linear-gradient(135deg, ${c}, ${withAlpha(c, 'bb')})`,
                      border: `1px solid ${c}`,
                      color: '#000', cursor: 'pointer', fontWeight: 700,
                      minHeight: 44, padding: '8px 16px', boxShadow: `0 2px 12px ${withAlpha(c, '3d')}`,
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
                      className="pf-pve-clear"
                      style={{
                        position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                        width: 30, height: 30, borderRadius: '50%',
                        background: 'rgba(255,255,255,0.08)', border: 'none',
                        color: colors.textMuted, fontSize: 11, cursor: 'pointer',
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
                    className="pf-pve-cancel"
                    style={{
                      ...inputBase, background: 'transparent', border: `1px solid ${colors.border}`,
                      cursor: 'pointer', minHeight: 44, padding: '8px 16px',
                    }}
                  >Отмена</button>
                  <button
                    onClick={commit}
                    className="pf-pve-save"
                    style={{
                      ...inputBase, background: `linear-gradient(135deg, ${c}, ${withAlpha(c, 'bb')})`,
                      border: `1px solid ${c}`,
                      color: '#000', cursor: 'pointer', fontWeight: 700,
                      minHeight: 44, padding: '8px 16px', boxShadow: `0 2px 12px ${withAlpha(c, '3d')}`,
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
