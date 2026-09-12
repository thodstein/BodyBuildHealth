/**
 * design.ts — Apple-style design tokens для дневника веса и замеров.
 * iOS-типографика, системные цвета, карточки/группы/кнопки/сегменты.
 * Enhanced with glassmorphism, gradients, animations.
 */
import type React from 'react';

export const FONT =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif";

/** Системные цвета iOS (dark) */
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
  green: '#30d158',
  red: '#ff453a',
  orange: '#ff9f0a',
  yellow: '#ffd60a',
  blue: '#0a84ff',
  purple: '#bf5af2',
  teal: '#64d2ff',
  pink: '#ff375f',
  gray: '#ffffff',
  // Glassmorphism
  glass: 'rgba(28,28,30,0.72)',
  glassBorder: 'rgba(255,255,255,0.12)',
  glassHighlight: 'rgba(255,255,255,0.08)',
  // Gradients
  gradGreen: 'linear-gradient(135deg, #30d158 0%, #22c55e 100%)',
  gradBlue: 'linear-gradient(135deg, #0a84ff 0%, #0071e3 100%)',
  gradPurple: 'linear-gradient(135deg, #bf5af2 0%, #a855f7 100%)',
  gradOrange: 'linear-gradient(135deg, #ff9f0a 0%, #f97316 100%)',
  gradRed: 'linear-gradient(135deg, #ff453a 0%, #ff6b5a 100%)',
  gradTeal: 'linear-gradient(135deg, #64d2ff 0%, #06b6d4 100%)',
  gradPink: 'linear-gradient(135deg, #ff375f 0%, #f43f5e 100%)',
  gradSunset: 'linear-gradient(135deg, #ff9f0a 0%, #f97316 50%, #ef4444 100%)',
  gradOcean: 'linear-gradient(135deg, #0a84ff 0%, #06b6d4 50%, #30d158 100%)',
  gradCosmic: 'linear-gradient(135deg, #bf5af2 0%, #a855f7 50%, #0a84ff 100%)',
} as const;

/** Числа таблиц — tabular-nums, чтобы колонки не «дрожали». */
export const tnum: React.CSSProperties = { fontVariantNumeric: 'tabular-nums' };

/* ── Animations ─────────────────────────────────────────────────────── */

export const keyframes = {
  fadeIn: '@keyframes wd-fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }',
  slideUp: '@keyframes wd-slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }',
  slideRight: '@keyframes wd-slideRight { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }',
  scaleIn: '@keyframes wd-scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }',
  shimmer: '@keyframes wd-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }',
  pulse: '@keyframes wd-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }',
  float: '@keyframes wd-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }',
};

export const animations = {
  fadeIn: 'wd-fadeIn 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
  slideUp: 'wd-slideUp 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
  slideRight: 'wd-slideRight 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
  scaleIn: 'wd-scaleIn 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
  shimmer: 'wd-shimmer 2s infinite linear',
  pulse: 'wd-pulse 2s infinite ease-in-out',
  float: 'wd-float 3s infinite ease-in-out',
};

export const staggerDelay = (index: number, base = 0.08): React.CSSProperties => ({
  animationDelay: `${index * base}s`,
});

/* ── Glassmorphism Cards ────────────────────────────────────────────── */

/** Glass card: frosted glass with subtle border and highlight. — облегчён для производительности */
export const glassCard: React.CSSProperties = {
  background: c.glass,
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  borderRadius: 18,
  border: `1px solid ${c.glassBorder}`,
  boxShadow: `0 6px 20px rgba(0,0,0,0.24), inset 0 1px 0 ${c.glassHighlight}`,
  padding: 20,
  marginBottom: 14,
  animation: animations.slideUp,
  contain: 'layout paint',
};

/** Glass tile for metrics grid. */
export const glassTile: React.CSSProperties = {
  background: c.glass,
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
  borderRadius: 16,
  border: `1px solid ${c.glassBorder}`,
  boxShadow: `0 4px 16px rgba(0,0,0,0.20), inset 0 1px 0 ${c.glassHighlight}`,
  padding: '14px 16px',
  transition: 'transform 0.14s ease, box-shadow 0.14s ease',
  contain: 'layout paint',
} as React.CSSProperties & { ':hover'?: React.CSSProperties };

/** Elevated glass card with stronger shadow. */
export const glassCardElevated: React.CSSProperties = {
  ...glassCard,
  boxShadow: `0 16px 48px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.2), inset 0 1px 0 ${c.glassHighlight}`,
  border: `1px solid ${c.glassBorder}`,
};

/* ── Classic Cards (backward compat) ────────────────────────────────── */

/** iOS-карточка: скругление 16, тонкая рамка + верхний highlight. */
export const card: React.CSSProperties = {
  background: c.card,
  borderRadius: 16,
  border: `1px solid ${c.cardBorder}`,
  boxShadow: c.cardHighlight,
  padding: 16,
  marginBottom: 12,
};

/** Карточка-«плитка» (компактные метрики внутри grid). */
export const tile: React.CSSProperties = {
  background: c.row,
  borderRadius: 14,
  border: `1px solid ${c.cardBorder}`,
  padding: '10px 12px',
};

/** Заголовок секции вне карточки (как iOS grouped headers). */
export const sectionHeader: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  color: c.text3,
  padding: '12px 4px 6px',
  margin: 0,
  fontFamily: FONT,
};

/** Заголовок внутри карточки-визуала. */
export const visualTitle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: '-0.1px',
  color: c.text,
  marginBottom: 10,
  fontFamily: FONT,
};

/** iOS grouped list: обёртка, строки разделены hairline. */
export const group: React.CSSProperties = {
  background: c.card,
  borderRadius: 16,
  border: `1px solid ${c.cardBorder}`,
  boxShadow: c.cardHighlight,
  overflow: 'hidden',
  marginBottom: 12,
};

export const groupRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  padding: '10px 14px',
  borderBottom: `0.5px solid ${c.hairline}`,
  fontSize: 13,
  color: c.text,
  fontFamily: FONT,
};

/* ── Кнопки ───────────────────────────────────────────────────────── */

export const btn: React.CSSProperties = {
  minHeight: 44,
  padding: '10px 16px',
  borderRadius: 14,
  cursor: 'pointer',
  background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(255,255,255,0.11)',
  color: c.text,
  fontSize: 13.5,
  fontWeight: 600,
  fontFamily: FONT,
  transition: 'background 0.15s, transform 0.1s',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
};

export const btnPrimary: React.CSSProperties = {
  minHeight: 44,
  padding: '10px 18px',
  borderRadius: 14,
  cursor: 'pointer',
  background: c.gradGreen,
  border: '1px solid rgba(48,209,88,0.45)',
  color: '#fff',
  fontSize: 13.5,
  fontWeight: 700,
  fontFamily: FONT,
  boxShadow: '0 6px 20px rgba(48,209,88,0.32), inset 0 1px 0 rgba(255,255,255,0.18)',
  transition: 'filter 0.15s, transform 0.1s, box-shadow 0.15s',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
};

export const btnSecondary: React.CSSProperties = {
  ...btnPrimary,
  background: c.glass,
  border: `1px solid ${c.glassBorder}`,
  boxShadow: `0 4px 16px rgba(0,0,0,0.16), inset 0 1px 0 ${c.glassHighlight}`,
  color: c.text,
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
};

export const btnGlass: (color?: string) => React.CSSProperties = (color = c.blue) => ({
  minHeight: 44,
  padding: '10px 18px',
  borderRadius: 14,
  cursor: 'pointer',
  background: 'rgba(255,255,255,0.08)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  border: `1px solid ${c.glassBorder}`,
  boxShadow: `0 4px 16px rgba(0,0,0,0.18), inset 0 1px 0 ${c.glassHighlight}`,
  color: c.text,
  fontSize: 13.5,
  fontWeight: 700,
  fontFamily: FONT,
  transition: 'background 0.15s, transform 0.1s, box-shadow 0.15s',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
});

export const btnGradient: (grad?: string) => React.CSSProperties = (grad = c.gradGreen) => ({
  ...btnPrimary,
  background: grad,
  boxShadow: `0 2px 10px ${grad.includes('green') ? 'rgba(48,209,88,0.35)' : grad.includes('blue') ? 'rgba(10,132,255,0.35)' : grad.includes('purple') ? 'rgba(191,90,242,0.35)' : grad.includes('orange') ? 'rgba(249,115,22,0.35)' : 'rgba(255,69,58,0.35)'}, inset 0 1px 0 rgba(255,255,255,0.15)`,
});

export const iconBtn: React.CSSProperties = {
  width: 44,
  height: 44,
  minWidth: 44,
  minHeight: 44,
  borderRadius: 14,
  cursor: 'pointer',
  background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(255,255,255,0.11)',
  color: c.text2,
  fontSize: 16,
  fontFamily: FONT,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background 0.15s, transform 0.1s',
};

export const iconBtnGlass: React.CSSProperties = {
  ...iconBtn,
  background: 'rgba(255,255,255,0.06)',
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
  border: `1px solid ${c.glassBorder}`,
  boxShadow: `inset 0 1px 0 ${c.glassHighlight}`,
};

/* ── Сегмент-контрол (iOS) ────────────────────────────────────────── */

export const segWrap: React.CSSProperties = {
  display: 'inline-flex',
  gap: 4,
  padding: 4,
  background: 'rgba(255,255,255,0.06)',
  borderRadius: 15,
  border: '1px solid rgba(255,255,255,0.08)',
  maxWidth: '100%',
  overflowX: 'auto',
  scrollbarWidth: 'none',
};

export const segWrapGlass: React.CSSProperties = {
  ...segWrap,
  background: c.glass,
  backdropFilter: 'blur(16px) saturate(180%)',
  WebkitBackdropFilter: 'blur(16px) saturate(180%)',
  border: `1px solid ${c.glassBorder}`,
  boxShadow: `inset 0 1px 0 ${c.glassHighlight}`,
};

export const segBtn = (active: boolean): React.CSSProperties => ({
  minHeight: 40,
  padding: '0 16px',
  borderRadius: 11,
  cursor: 'pointer',
  border: 'none',
  fontSize: 12.5,
  fontWeight: active ? 800 : 600,
  fontFamily: FONT,
  whiteSpace: 'nowrap',
  color: active ? '#fff' : c.text3,
  background: active ? 'linear-gradient(135deg, #30d158, #22c55e)' : 'transparent',
  boxShadow: active ? '0 4px 14px rgba(48,209,88,0.32), inset 0 1px 0 rgba(255,255,255,0.2)' : 'none',
  transition: 'background 0.15s, color 0.15s, box-shadow 0.15s',
});

export const segBtnGlass = (active: boolean): React.CSSProperties => ({
  minHeight: 40,
  padding: '0 16px',
  borderRadius: 11,
  cursor: 'pointer',
  border: 'none',
  fontSize: 12.5,
  fontWeight: active ? 800 : 600,
  fontFamily: FONT,
  whiteSpace: 'nowrap',
  color: active ? '#fff' : c.text2,
  background: active ? c.gradBlue : 'transparent',
  boxShadow: active ? '0 4px 14px rgba(10,132,255,0.35), inset 0 1px 0 rgba(255,255,255,0.15)' : 'none',
  transition: 'background 0.15s, color 0.15s, box-shadow 0.15s',
});

/* ── Чипы ─────────────────────────────────────────────────────────── */

export const chip = (active: boolean, color: string): React.CSSProperties => ({
  minHeight: 40,
  padding: '8px 15px',
  borderRadius: 999,
  cursor: 'pointer',
  border: `1px solid ${active ? `${color}60` : 'rgba(255,255,255,0.11)'}`,
  background: active ? `linear-gradient(135deg, ${color}30, ${color}12)` : 'rgba(255,255,255,0.04)',
  color: active ? '#fff' : c.text3,
  fontSize: 12.5,
  fontWeight: active ? 800 : 600,
  fontFamily: FONT,
  whiteSpace: 'nowrap',
  display: 'inline-flex',
  alignItems: 'center',
  transition: 'background 0.15s, color 0.15s, box-shadow 0.15s',
  boxShadow: active ? `0 4px 14px ${color}28` : 'none',
});

export const chipGlass = (active: boolean, color: string): React.CSSProperties => ({
  minHeight: 40,
  padding: '8px 15px',
  borderRadius: 999,
  cursor: 'pointer',
  border: `1px solid ${active ? `${color}66` : c.glassBorder}`,
  background: active ? `linear-gradient(135deg, ${color}2e, ${color}12)` : c.glass,
  backdropFilter: 'blur(16px) saturate(180%)',
  WebkitBackdropFilter: 'blur(16px) saturate(180%)',
  boxShadow: active ? `0 4px 14px ${color}33, inset 0 1px 0 ${c.glassHighlight}` : `inset 0 1px 0 ${c.glassHighlight}`,
  color: active ? '#fff' : c.text2,
  fontSize: 12.5,
  fontWeight: active ? 800 : 600,
  fontFamily: FONT,
  whiteSpace: 'nowrap',
  display: 'inline-flex',
  alignItems: 'center',
  transition: 'background 0.15s, color 0.15s, box-shadow 0.15s',
});

/* ── Инпуты ───────────────────────────────────────────────────────── */

export const input: React.CSSProperties = {
  minHeight: 48,
  padding: '12px 14px',
  borderRadius: 14,
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.11)',
  color: c.text,
  fontSize: 16,
  outline: 'none',
  fontFamily: FONT,
  boxSizing: 'border-box',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

/* ── Метрика: лейбл + значение (iOS Health-стиль) ────────────────── */

export const metricLabel: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.7px',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.6)',
  marginBottom: 3,
  fontFamily: FONT,
};

export const metricLabelGradient: (grad: string) => React.CSSProperties = (grad) => ({
  ...metricLabel,
  background: grad,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
});

export const metricValue: React.CSSProperties = {
  ...tnum,
  display: 'block',
  fontSize: 17,
  fontWeight: 700,
  letterSpacing: '-0.3px',
  color: c.text,
  fontFamily: FONT,
};

export const metricValueGradient: (grad: string) => React.CSSProperties = (grad) => ({
  ...metricValue,
  background: grad,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
});

export const metricValueLarge: React.CSSProperties = {
  ...metricValue,
  fontSize: 28,
  fontWeight: 800,
  letterSpacing: '-0.8px',
};

export const metricValueLargeGradient: (grad: string) => React.CSSProperties = (grad) => ({
  ...metricValueLarge,
  background: grad,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
});

export const metricDelta: React.CSSProperties = {
  ...tnum,
  display: 'block',
  fontSize: 11,
  fontWeight: 500,
  color: c.text2,
  marginTop: 2,
  fontFamily: FONT,
};

export const metricDeltaGradient: (grad: string) => React.CSSProperties = (grad) => ({
  ...metricDelta,
  background: grad,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
});

/* ── Progress Bars ────────────────────────────────────────────────── */

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

/* ── SVG Chart Styles ─────────────────────────────────────────────── */

export const chartLine = (color: string, width = 2, dash?: string): React.CSSProperties => ({
  stroke: color,
  strokeWidth: width,
  fill: 'none',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  strokeDasharray: dash,
  filter: `drop-shadow(0 2px 4px ${color}44)`,
});

export const chartArea = (color: string, opacity = 0.15): React.CSSProperties => ({
  fill: color,
  fillOpacity: opacity,
  filter: `drop-shadow(0 4px 12px ${color}33)`,
});

/* ── Decorative Elements ──────────────────────────────────────────── */

export const glowRing = (color: string, size = 8): React.CSSProperties => ({
  width: size,
  height: size,
  borderRadius: '50%',
  background: `radial-gradient(circle at 30% 30%, ${color}cc, ${color}33 60%, transparent 100%)`,
  boxShadow: `0 0 ${size * 2}px ${color}66, inset 0 0 ${size}px ${color}44`,
});

export const badgeGlow: (color: string) => React.CSSProperties = (color) => ({
  position: 'relative',
  overflow: 'visible',
  '&::before': {
    content: '""',
    position: 'absolute',
    inset: '-4px',
    borderRadius: 'inherit',
    background: `radial-gradient(ellipse at center, ${color}33, transparent 70%)`,
    zIndex: -1,
    filter: 'blur(8px)',
  },
});

/* ── Layout Helpers ───────────────────────────────────────────────── */

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
