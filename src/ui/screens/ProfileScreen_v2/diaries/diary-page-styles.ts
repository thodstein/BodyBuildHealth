/**
 * diary-page-styles.ts — премиальный дизайн-слой для ПОЛНЫХ страниц дневников
 * (открываются по кнопке «Открыть» в Профиле). Единый язык: тёмное стекло,
 * iOS Health-инспирированная типографика, акцентный градиент, микро-анимации.
 *
 * Каждый дневник передаёт свой ACCENT; всё остальное — токены отсюда.
 * Обратная совместимость сохранена: старые имена (btnBase/chip/statCard…)
 * остаются, но получили апгрейд.
 */
import React from 'react';
import { colors } from '../ui';

export const FONT =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif";

// ── helpers ────────────────────────────────────────────────────────────

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgba = (hex: string, a: number) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};

// ── Кнопки ─────────────────────────────────────────────────────────────

export const btnBase = (accent: string): React.CSSProperties => ({
  minHeight: 44,
  padding: '10px 17px',
  borderRadius: 14,
  border: `1px solid rgba(255,255,255,0.11)`,
  background: 'rgba(255,255,255,0.06)',
  // средний blur — дешевле для GPU, на мобилках отключится через CSS
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 13.5,
  fontWeight: 700,
  fontFamily: FONT,
  transition: 'all 0.18s cubic-bezier(0.25,0.46,0.45,0.94)',
  whiteSpace: 'nowrap',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  boxShadow: '0 4px 14px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.06)',
  letterSpacing: '-0.1px',
});

export const btnPrimary = (accent: string): React.CSSProperties => ({
  ...btnBase(accent),
  background: `linear-gradient(135deg, ${accent}, ${rgba(accent, 0.72)})`,
  border: `1px solid ${rgba(accent, 0.65)}`,
  color: '#0a0a0f',
  fontWeight: 800,
  boxShadow: `0 6px 22px ${rgba(accent, 0.35)}, 0 2px 8px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.25)`,
});

export const btnGhost = (accent: string): React.CSSProperties => ({
  ...btnBase(accent),
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
});

export const btnDanger: React.CSSProperties = {
  minHeight: 44,
  padding: '10px 17px',
  borderRadius: 14,
  border: '1px solid rgba(239,68,68,0.35)',
  background: 'linear-gradient(135deg, rgba(239,68,68,0.16), rgba(239,68,68,0.06))',
  color: '#fca5a5',
  cursor: 'pointer',
  fontSize: 13.5,
  fontWeight: 700,
  fontFamily: FONT,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  boxShadow: '0 4px 14px rgba(239,68,68,0.16), inset 0 1px 0 rgba(255,255,255,0.05)',
};

export const menuItem = (accent: string): React.CSSProperties => ({
  ...btnGhost(accent),
  justifyContent: 'flex-start',
  width: '100%',
  minHeight: 44,
  padding: '10px 13px',
  border: 'none',
  borderRadius: 12,
  fontSize: 13.5,
  fontWeight: 600,
  background: 'transparent',
  boxShadow: 'none',
});

// ── Чипы ───────────────────────────────────────────────────────────────

export const chip = (accent: string): React.CSSProperties => ({
  minHeight: 40,
  padding: '8px 15px',
  borderRadius: 999,
  fontSize: 12.5,
  fontWeight: 700,
  cursor: 'pointer',
  border: `1px solid rgba(255,255,255,0.11)`,
  background: 'rgba(255,255,255,0.05)',
  // без blur — чип без стекла быстрее рендерится
  color: 'rgba(255,255,255,0.65)',
  fontFamily: FONT,
  transition: 'all 0.18s ease',
  letterSpacing: '-0.1px',
  whiteSpace: 'nowrap',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
});

export const chipActive = (accent: string): React.CSSProperties => ({
  ...chip(accent),
  borderColor: rgba(accent, 0.6),
  background: `linear-gradient(135deg, ${rgba(accent, 0.24)}, ${rgba(accent, 0.10)})`,
  color: '#fff',
  boxShadow: `0 4px 16px ${rgba(accent, 0.24)}, inset 0 1px 0 rgba(255,255,255,0.12)`,
  fontWeight: 800,
});

// сегмент-контрол (табы внутри дневника)
export const segWrap: React.CSSProperties = {
  display: 'inline-flex',
  gap: 4,
  padding: 4,
  background: 'rgba(255,255,255,0.05)',
  borderRadius: 15,
  border: '1px solid rgba(255,255,255,0.08)',
  maxWidth: '100%',
  overflowX: 'auto',
  scrollbarWidth: 'none',
};
export const segBtn = (active: boolean, accent: string): React.CSSProperties => ({
  minHeight: 40,
  padding: '0 16px',
  borderRadius: 11,
  cursor: 'pointer',
  border: 'none',
  fontSize: 12.5,
  fontWeight: active ? 800 : 600,
  fontFamily: FONT,
  whiteSpace: 'nowrap',
  color: active ? '#0a0a0f' : 'rgba(255,255,255,0.6)',
  background: active ? `linear-gradient(135deg, ${accent}, ${rgba(accent, 0.75)})` : 'transparent',
  boxShadow: active ? `0 4px 14px ${rgba(accent, 0.32)}, inset 0 1px 0 rgba(255,255,255,0.2)` : 'none',
  transition: 'all 0.18s ease',
});

// ── Заголовки секций ───────────────────────────────────────────────────

export const sectionTitle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: '#fff',
  textTransform: 'uppercase',
  letterSpacing: '0.9px',
  marginBottom: 12,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

export const sectionTitleAccent = (accent: string): React.CSSProperties => ({
  ...sectionTitle,
  color: accent,
});

// ── Карточки ───────────────────────────────────────────────────────────

export const statCard: React.CSSProperties = {
  background: 'linear-gradient(180deg, rgba(30,30,36,0.88), rgba(18,18,22,0.9))',
  // лёгкий blur — тяжёлый 18px сильно тормозит на Telegram WebView
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  borderRadius: 18,
  border: `1px solid rgba(255,255,255,0.09)`,
  boxShadow: '0 10px 28px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.06)',
  padding: 15,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  minWidth: 0,
  position: 'relative',
  overflow: 'hidden',
  contain: 'layout paint',
};

// карточка с акцентной левой полосой
export const statCardAccent = (accent: string): React.CSSProperties => ({
  ...statCard,
  borderLeft: `2px solid ${rgba(accent, 0.62)}`,
});

export const glassSection: React.CSSProperties = {
  ...statCard,
  padding: 16,
  marginBottom: 14,
};

// премиум «герой» — блок Сегодня
export const heroCard = (accent: string): React.CSSProperties => ({
  ...statCard,
  padding: 17,
  marginBottom: 14,
  borderRadius: 20,
  background:
    `linear-gradient(135deg, ${rgba(accent, 0.17)} 0%, ${rgba(accent, 0.05)} 42%, rgba(255,255,255,0.02) 100%), rgba(24,24,30,0.85)`,
  border: `1px solid ${rgba(accent, 0.28)}`,
  boxShadow: `0 14px 40px rgba(0,0,0,0.36), 0 0 0 1px ${rgba(accent, 0.10)} inset, inset 0 1px 0 rgba(255,255,255,0.08)`,
});

// ── Шапка / контейнер ──────────────────────────────────────────────────

export const header: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 6,
  padding: '10px 14px',
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  alignItems: 'center',
  background: 'rgba(14,14,18,0.88)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  borderBottom: `1px solid rgba(255,255,255,0.08)`,
  boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
};

export const main: React.CSSProperties = {
  padding: '16px 16px 80px',
  maxWidth: 1100,
  margin: '0 auto',
};

// оболочка страницы (фон) — используйте как style={diaryShell(accent)}
export const diaryShell = (accent: string): React.CSSProperties => {
  const [r, g, b] = hexToRgb(accent);
  return {
    position: 'fixed',
    inset: 0,
    // Явные края — фолбэк для WebView без поддержки inset (иначе оверлей схлопывается).
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2000,
    background:
      `radial-gradient(900px 520px at 14% -10%, rgba(${r},${g},${b},0.13), transparent 62%),` +
      `radial-gradient(720px 460px at 100% 0%, rgba(${r},${g},${b},0.07), transparent 58%),` +
      `radial-gradient(900px 600px at 50% 115%, rgba(255,255,255,0.04), transparent 60%),` +
      `#0a0a0d`,
    color: colors.text,
    overflowY: 'auto',
    overflowX: 'hidden',
    WebkitOverflowScrolling: 'touch',
    overscrollBehavior: 'contain',
  };
};

// ── Таблицы ────────────────────────────────────────────────────────────

export const tableTh: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 10px',
  cursor: 'pointer',
  borderBottom: '1px solid rgba(255,255,255,0.10)',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.6px',
  color: 'rgba(255,255,255,0.52)',
  whiteSpace: 'nowrap',
  fontWeight: 700,
  fontFamily: FONT,
  background: 'rgba(255,255,255,0.02)',
};

export const tableTd: React.CSSProperties = {
  padding: '10px 10px',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  fontSize: 13,
  fontFamily: FONT,
  color: 'rgba(255,255,255,0.88)',
};

// ── Пилюли/бейджи ──────────────────────────────────────────────────────

export const accentBadge = (accent: string): React.CSSProperties => ({
  fontSize: 11.5,
  fontWeight: 800,
  color: '#fff',
  background: `linear-gradient(135deg, ${rgba(accent, 0.30)}, ${rgba(accent, 0.12)})`,
  border: `1px solid ${rgba(accent, 0.4)}`,
  borderRadius: 999,
  padding: '4px 11px',
  letterSpacing: '0.2px',
  whiteSpace: 'nowrap',
  boxShadow: `0 2px 10px ${rgba(accent, 0.22)}`,
  fontVariantNumeric: 'tabular-nums',
});

export const subtleBadge: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: colors.textMuted,
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 999,
  padding: '3px 9px',
  whiteSpace: 'nowrap',
};

// ── Пустое состояние ───────────────────────────────────────────────────

export const emptyCard: React.CSSProperties = {
  ...statCard,
  padding: 30,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  gap: 9,
  background: 'rgba(255,255,255,0.03)',
  border: '1px dashed rgba(255,255,255,0.14)',
  boxShadow: 'none',
};

// ── Разделитель ────────────────────────────────────────────────────────

export const hairline: React.CSSProperties = {
  height: 1,
  background: 'rgba(255,255,255,0.07)',
  margin: '10px 0',
};

// ── Инпуты (единый стиль для дневников) ────────────────────────────────

export const diaryInput: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: 48,
  padding: '12px 14px',
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.11)',
  background: 'rgba(255,255,255,0.06)',
  color: colors.text,
  fontSize: 16,
  fontFamily: FONT,
  outline: 'none',
  transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
};

export const diarySelect: React.CSSProperties = {
  ...{
    width: '100%',
    boxSizing: 'border-box',
    minHeight: 48,
    padding: '12px 14px',
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.11)',
    background: 'rgba(255,255,255,0.06)',
    color: colors.text,
    fontSize: 16,
    fontFamily: FONT,
    outline: 'none',
    transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
  } as React.CSSProperties,
  cursor: 'pointer',
};

// ── Анимации / скроллбары (вставьте строкой в <style>) ─────────────────

export const diaryScrollbarCss = (accent: string) => `
  .diary-scrollbar::-webkit-scrollbar { width: 10px; height: 10px; }
  .diary-scrollbar::-webkit-scrollbar-track { background: transparent; }
  .diary-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 999px; border: 2px solid transparent; background-clip: content-box; }
  .diary-scrollbar::-webkit-scrollbar-thumb:hover { background: ${rgba(accent, 0.40)}; background-clip: content-box; }
  .diary-card { transition: transform 0.14s ease, box-shadow 0.14s ease; contain: layout paint; }
  .diary-card:hover { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.05); }
  @media (max-width: 768px) {
    .diary-card, .diary-scrollbar, [style*="backdrop-filter"] { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
  }
  @media (hover: none) and (pointer: coarse) {
    .diary-header-btn { min-height: 44px; }
    .diary-input, .diary-select { font-size: 16px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .diary-card, .diary-card:hover { transition: none !important; transform: none !important; }
  }
`;
