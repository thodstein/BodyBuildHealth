/**
 * design.ts — Apple-style design tokens для дневника веса и замеров.
 * iOS-типографика, системные цвета, карточки/группы/кнопки/сегменты.
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
  text2: 'rgba(235,235,245,0.62)',
  text3: 'rgba(235,235,245,0.36)',
  green: '#30d158',
  red: '#ff453a',
  orange: '#ff9f0a',
  yellow: '#ffd60a',
  blue: '#0a84ff',
  purple: '#bf5af2',
  teal: '#64d2ff',
  pink: '#ff375f',
  gray: '#8e8e93',
} as const;

/** Числа таблиц — tabular-nums, чтобы колонки не «дрожали». */
export const tnum: React.CSSProperties = { fontVariantNumeric: 'tabular-nums' };

/* ── Карточки ─────────────────────────────────────────────────────── */

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
  minHeight: 36,
  padding: '6px 12px',
  borderRadius: 12,
  cursor: 'pointer',
  background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(255,255,255,0.09)',
  color: c.text,
  fontSize: 13,
  fontWeight: 500,
  fontFamily: FONT,
  transition: 'background 0.15s, transform 0.1s',
};

export const btnPrimary: React.CSSProperties = {
  minHeight: 36,
  padding: '6px 16px',
  borderRadius: 12,
  cursor: 'pointer',
  background: 'linear-gradient(180deg,#34c759,#248a3d)',
  border: '1px solid rgba(48,209,88,0.4)',
  color: '#fff',
  fontSize: 13,
  fontWeight: 600,
  fontFamily: FONT,
  boxShadow: '0 2px 10px rgba(48,209,88,0.28)',
  transition: 'filter 0.15s, transform 0.1s',
};

export const iconBtn: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 12,
  cursor: 'pointer',
  background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(255,255,255,0.09)',
  color: c.text2,
  fontSize: 15,
  fontFamily: FONT,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background 0.15s',
};

/* ── Сегмент-контрол (iOS) ────────────────────────────────────────── */

export const segWrap: React.CSSProperties = {
  display: 'inline-flex',
  gap: 2,
  padding: 2,
  background: 'rgba(255,255,255,0.08)',
  borderRadius: 10,
};

export const segBtn = (active: boolean): React.CSSProperties => ({
  minHeight: 30,
  padding: '0 14px',
  borderRadius: 8,
  cursor: 'pointer',
  border: 'none',
  fontSize: 12,
  fontWeight: 600,
  fontFamily: FONT,
  color: active ? '#fff' : c.text3,
  background: active ? 'rgba(118,118,128,0.32)' : 'transparent',
  transition: 'background 0.15s, color 0.15s',
});

/* ── Чипы ─────────────────────────────────────────────────────────── */

export const chip = (active: boolean, color: string): React.CSSProperties => ({
  minHeight: 30,
  padding: '0 12px',
  borderRadius: 999,
  cursor: 'pointer',
  border: `1px solid ${active ? `${color}55` : 'rgba(255,255,255,0.1)'}`,
  background: active ? `${color}1f` : 'transparent',
  color: active ? color : c.text3,
  fontSize: 11.5,
  fontWeight: 500,
  fontFamily: FONT,
  whiteSpace: 'nowrap',
  transition: 'background 0.15s, color 0.15s',
});

/* ── Инпуты ───────────────────────────────────────────────────────── */

export const input: React.CSSProperties = {
  minHeight: 36,
  padding: '6px 12px',
  borderRadius: 10,
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.09)',
  color: c.text,
  fontSize: 13,
  outline: 'none',
  fontFamily: FONT,
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
};

/* ── Метрика: лейбл + значение (iOS Health-стиль) ────────────────── */

export const metricLabel: React.CSSProperties = {
  display: 'block',
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.4px',
  textTransform: 'uppercase',
  color: c.text3,
  marginBottom: 2,
  fontFamily: FONT,
};

export const metricValue: React.CSSProperties = {
  ...tnum,
  display: 'block',
  fontSize: 17,
  fontWeight: 700,
  letterSpacing: '-0.3px',
  color: c.text,
  fontFamily: FONT,
};

export const metricDelta: React.CSSProperties = {
  ...tnum,
  display: 'block',
  fontSize: 11,
  fontWeight: 500,
  color: c.text2,
  marginTop: 2,
  fontFamily: FONT,
};
