/**
 * training-ui.tsx — ЕДИНЫЙ НАБОР ДИЗАЙН-ТОКЕНОВ для вывода программ тренировок.
 *
 * Все экраны планировщика (BbAutoConstructor, PlanDisplay/TrainingConstructor,
 * SRCBBScreen, MyTrainingTab) ОБЯЗАНЫ использовать эти токены вместо
 * собственных «магических чисел», чтобы вывод программы выглядел одинаково
 * и современно (mobile-first, фрост-гласс).
 */
import React from 'react';

export const ACCENT = '#00e68a';
export const ACCENT_SOFT = 'rgba(0,230,138,0.14)';
export const ACCENT_LINE = 'rgba(0,230,138,0.45)';
export const DIM = 'rgba(255,255,255,0.6)';
export const DIM_STRONG = 'rgba(255,255,255,0.92)';

/** Радиусы — единая шкала (крупнее для мобильных тап-зон). */
export const R = { card: 16, pill: 18, btn: 12, in: 10, chip: 10, bar: 6 } as const;

/** Общий фрост-гласс фон для карточек. */
const GLASS: React.CSSProperties = {
  background: 'rgba(26,28,38,0.55)',
  backdropFilter: 'blur(18px) saturate(150%)',
  WebkitBackdropFilter: 'blur(18px) saturate(150%)',
  border: '1px solid rgba(255,255,255,0.09)',
  boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
};

/** Базовая карточка (фон/рамка/радиус/тень — одинаковы везде). */
export const CARD: React.CSSProperties = {
  ...GLASS,
  borderRadius: R.card,
  padding: '14px',
  margin: '8px 0',
};

/** Вторичный текст. */
export const SMALL: React.CSSProperties = {
  color: DIM, fontSize: 12, lineHeight: 1.45,
};

/** Заголовок секции. */
export const H: React.CSSProperties = {
  fontSize: 17, fontWeight: 800, color: ACCENT, marginBottom: 10, letterSpacing: -0.3,
};

/** Основная кнопка (акцентная). */
export const BTN: React.CSSProperties = {
  background: `linear-gradient(135deg,${ACCENT},#00c8a0)`,
  color: '#06281c', border: 'none',
  borderRadius: R.btn, padding: '12px 16px', fontWeight: 700,
  fontSize: 13, minHeight: 44, cursor: 'pointer',
  boxShadow: '0 6px 18px rgba(0,230,138,0.25)',
};

/** Призрачная кнопка (контур акцента). */
export const BTN_GHOST: React.CSSProperties = {
  ...BTN, background: 'transparent', color: ACCENT, border: `1px solid ${ACCENT_LINE}`, boxShadow: 'none',
};

/** Шаговая пилюля (активная / неактивная). */
export const STEP_PILL = (active: boolean): React.CSSProperties => ({
  padding: '7px 14px', borderRadius: R.pill, fontSize: 12,
  fontWeight: active ? 800 : 500, cursor: 'pointer',
  border: active ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.08)',
  background: active ? `linear-gradient(135deg,${ACCENT},#00c8a0)` : 'rgba(24,24,27,0.6)',
  color: active ? '#06281c' : '#fff', flexShrink: 0,
  boxShadow: active ? '0 4px 14px rgba(0,230,138,0.3)' : 'none',
});

/** Поле ввода. */
export const IN: React.CSSProperties = {
  background: 'rgba(118,118,128,0.14)', color: '#fff',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: R.in,
  padding: '9px 10px', fontSize: 13, outline: 'none',
  boxSizing: 'border-box', minHeight: 40,
};

/** Мини-чип параметра (label + value). */
export const Chip: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div style={{
    padding: '7px 10px', borderRadius: R.chip,
    background: color + '1f',
    border: `1px solid ${color}55`,
    display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center',
    minWidth: 56,
  }}>
    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.3 }}>{label}</span>
    <span style={{ fontSize: 15, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</span>
  </div>
);

/** Цветная панель-уведомление (фрост-гласс с акцентной левой рамкой). */
export function panelStyle(color: string, bgAlpha = 0.06, borderAlpha = 0.22): React.CSSProperties {
  return {
    marginTop: 10, padding: 12, borderRadius: R.card,
    background: `${color}${Math.round(bgAlpha * 255).toString(16).padStart(2, '0')}`,
    border: `1px solid ${color}${Math.round(borderAlpha * 255).toString(16).padStart(2, '0')}`,
    borderLeft: `3px solid ${color}`,
    backdropFilter: 'blur(12px) saturate(140%)',
    WebkitBackdropFilter: 'blur(12px) saturate(140%)',
  };
}
