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
  minHeight: 40,
  padding: '9px 15px',
  borderRadius: 12,
  border: `1px solid rgba(255,255,255,0.10)`,
  background: 'rgba(255,255,255,0.06)',
  // средний blur — дешевле для GPU, на мобилках отключится через CSS
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
  color: colors.text,
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
  fontFamily: FONT,
  transition: 'all 0.18s cubic-bezier(0.25,0.46,0.45,0.94)',
  whiteSpace: 'nowrap',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
  boxShadow: '0 2px 10px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.05)',
  letterSpacing: '-0.1px',
});

export const btnPrimary = (accent: string): React.CSSProperties => ({
  ...btnBase(accent),
  background: accent,
  border: `1px solid ${accent}`,
  color: '#0a0a0f',
  fontWeight: 700,
  boxShadow: `0 4px 18px ${rgba(accent, 0.32)}, 0 2px 8px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.18)`,
});

export const btnGhost = (accent: string): React.CSSProperties => ({
  ...btnBase(accent),
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
});

export const btnDanger: React.CSSProperties = {
  minHeight: 40,
  padding: '9px 15px',
  borderRadius: 12,
  border: '1px solid rgba(239,68,68,0.30)',
  background: 'rgba(239,68,68,0.10)',
  color: '#fca5a5',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
  fontFamily: FONT,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};

export const menuItem = (accent: string): React.CSSProperties => ({
  ...btnGhost(accent),
  justifyContent: 'flex-start',
  width: '100%',
  minHeight: 38,
  padding: '8px 12px',
  border: 'none',
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 500,
  background: 'transparent',
  boxShadow: 'none',
});

// ── Чипы ───────────────────────────────────────────────────────────────

export const chip = (accent: string): React.CSSProperties => ({
  minHeight: 32,
  padding: '6px 13px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  border: `1px solid rgba(255,255,255,0.10)`,
  background: 'rgba(255,255,255,0.05)',
  // без blur — чип без стекла быстрее рендерится
  color: colors.textMuted,
  fontFamily: FONT,
  transition: 'all 0.18s ease',
  letterSpacing: '-0.1px',
});

export const chipActive = (accent: string): React.CSSProperties => ({
  ...chip(accent),
  borderColor: rgba(accent, 0.55),
  background: `linear-gradient(135deg, ${rgba(accent, 0.18)}, ${rgba(accent, 0.08)})`,
  color: accent,
  boxShadow: `0 2px 12px ${rgba(accent, 0.18)}, inset 0 1px 0 ${rgba(accent, 0.18)}`,
  fontWeight: 700,
});

// сегмент-контрол (табы внутри дневника)
export const segWrap: React.CSSProperties = {
  display: 'inline-flex',
  gap: 3,
  padding: 3,
  background: 'rgba(255,255,255,0.06)',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.07)',
};
export const segBtn = (active: boolean, accent: string): React.CSSProperties => ({
  minHeight: 30,
  padding: '0 13px',
  borderRadius: 8,
  cursor: 'pointer',
  border: 'none',
  fontSize: 12,
  fontWeight: active ? 700 : 600,
  fontFamily: FONT,
  color: active ? '#0a0a0f' : colors.textMuted,
  background: active ? accent : 'transparent',
  boxShadow: active ? `0 2px 10px ${rgba(accent, 0.28)}` : 'none',
  transition: 'all 0.18s ease',
});

// ── Заголовки секций ───────────────────────────────────────────────────

export const sectionTitle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: colors.textMuted,
  textTransform: 'uppercase',
  letterSpacing: '0.7px',
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
  background: 'rgba(28,28,32,0.82)',
  // лёгкий blur — тяжёлый 18px сильно тормозит на Telegram WebView
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  borderRadius: 16,
  border: `1px solid rgba(255,255,255,0.08)`,
  boxShadow: '0 6px 20px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.05)',
  padding: 14,
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
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
  padding: 16,
  marginBottom: 14,
  background:
    `linear-gradient(135deg, ${rgba(accent, 0.14)} 0%, ${rgba(accent, 0.04)} 42%, rgba(255,255,255,0.02) 100%), rgba(28,28,32,0.78)`,
  border: `1px solid ${rgba(accent, 0.22)}`,
  boxShadow: `0 10px 36px rgba(0,0,0,0.32), 0 0 0 1px ${rgba(accent, 0.10)} inset, inset 0 1px 0 rgba(255,255,255,0.07)`,
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
  background: 'rgba(16,16,20,0.86)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  borderBottom: `1px solid rgba(255,255,255,0.07)`,
  boxShadow: '0 4px 16px rgba(0,0,0,0.22)',
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
  fontSize: 11,
  fontWeight: 700,
  color: accent,
  background: rgba(accent, 0.12),
  border: `1px solid ${rgba(accent, 0.28)}`,
  borderRadius: 999,
  padding: '3px 10px',
  letterSpacing: '0.2px',
  whiteSpace: 'nowrap',
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
  padding: 28,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  gap: 8,
  background: 'rgba(255,255,255,0.03)',
  border: '1px dashed rgba(255,255,255,0.12)',
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
  minHeight: 40,
  padding: '9px 12px',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.06)',
  color: colors.text,
  fontSize: 14,
  fontFamily: FONT,
  outline: 'none',
  transition: 'border-color 0.15s, background 0.15s',
};

export const diarySelect: React.CSSProperties = {
  ...{
    width: '100%',
    boxSizing: 'border-box',
    minHeight: 40,
    padding: '9px 12px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.06)',
    color: colors.text,
    fontSize: 14,
    fontFamily: FONT,
    outline: 'none',
    transition: 'border-color 0.15s, background 0.15s',
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
