/**
 * diary-page-styles.ts — канонический дизайн-слой для ПОЛНЫХ страниц дневников
 * (открываются по кнопке «Открыть» в Профиле). Эталон — дневник сна (SleepDiary).
 * Все дневники (сон / давление / вес / инъекции / здоровье) используют одни и те же
 * токены: стеклянные кнопки, чипы, карточки, типографику, шапку, таблицы.
 * Акцентный цвет задаётся на странице (у каждого дневника свой).
 */
import React from 'react';
import { colors } from '../ui';

export const FONT =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif";

/** Базовые кнопки страницы (как в дневнике сна). */
export const btnBase = (accent: string): React.CSSProperties => ({
  minHeight: 38,
  padding: '8px 13px',
  borderRadius: 10,
  border: `1px solid ${colors.border}`,
  background: 'rgba(255,255,255,0.05)',
  color: colors.text,
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
  fontFamily: FONT,
  transition: 'all 0.15s',
  whiteSpace: 'nowrap',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
});
export const btnPrimary = (accent: string): React.CSSProperties => ({
  ...btnBase(accent),
  background: accent,
  border: `1px solid ${accent}`,
  color: '#18181b',
});
export const btnGhost = (accent: string): React.CSSProperties => ({
  ...btnBase(accent),
  background: 'transparent',
});
export const menuItem = (accent: string): React.CSSProperties => ({
  ...btnGhost(accent),
  justifyContent: 'flex-start',
  width: '100%',
  minHeight: 36,
  padding: '6px 10px',
  border: 'none',
  borderRadius: 8,
  fontSize: 13,
});

/** Чипы-переключатели (диапазоны/навигация), как в дневнике сна. */
export const chip = (accent: string): React.CSSProperties => ({
  minHeight: 30,
  padding: '4px 11px',
  borderRadius: 16,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  border: `1px solid ${colors.border}`,
  background: 'rgba(255,255,255,0.03)',
  color: colors.textMuted,
  fontFamily: FONT,
  transition: 'all 0.15s',
});
export const chipActive = (accent: string): React.CSSProperties => ({
  ...chip(accent),
  borderColor: accent,
  background: `${accent}1f`,
  color: accent,
});

/** Заголовок секции (11px капс, акцентный цвет). */
export const sectionTitle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: colors.textMuted,
  textTransform: 'uppercase',
  letterSpacing: '0.6px',
  marginBottom: 10,
};

/** Карточка-виджет со статистикой (как StatCard в дневнике сна). */
export const statCard: React.CSSProperties = {
  background: colors.bg,
  backdropFilter: 'blur(28px) saturate(180%)',
  WebkitBackdropFilter: 'blur(28px) saturate(180%)',
  borderRadius: 16,
  border: `1px solid ${colors.border}`,
  boxShadow: '0 4px 20px rgba(0,0,0,0.25), inset 0 0.5px 0 rgba(255,255,255,0.06)',
  padding: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  minWidth: 0,
};

/** Стеклянная секция-карточка (как glassCard секции в дневнике сна). */
export const glassSection: React.CSSProperties = {
  ...statCard,
  padding: 16,
  marginBottom: 12,
};

/** Стикер-шапка страницы дневника. */
export const header: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 2,
  padding: '10px 14px',
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  alignItems: 'center',
  background: 'rgba(24,24,27,0.92)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  borderBottom: `1px solid ${colors.border}`,
};

/** Контейнер контента страницы. */
export const main: React.CSSProperties = { padding: 16, maxWidth: 1100, margin: 'auto' };

/** Таблица дневника: th/td размеры как в дневнике сна. */
export const tableTh: React.CSSProperties = {
  textAlign: 'left',
  padding: '9px 8px',
  cursor: 'pointer',
  borderBottom: '1px solid rgba(255,255,255,0.12)',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.4px',
  color: 'rgba(255,255,255,0.55)',
  whiteSpace: 'nowrap',
  fontWeight: 600,
};
export const tableTd: React.CSSProperties = {
  padding: '9px 8px',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  fontSize: 13,
};
