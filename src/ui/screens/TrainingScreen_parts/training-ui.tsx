/**
 * training-ui.tsx — ЕДИНЫЙ НАБОР ДИЗАЙН-ТОКЕНОВ для вывода программ тренировок.
 *
 * Все экраны планировщика (BbAutoConstructor, PlanDisplay/TrainingConstructor,
 * SRCBBScreen, MyTrainingTab) ОБЯЗАНЫ использовать эти токены вместо
 * собственных «магических чисел» (radius 6/8/10/12/16, шрифты 9/10/11/13),
 * чтобы вывод программы выглядел одинаково везде.
 */
import React from 'react';

export const ACCENT = '#00e68a';
export const ACCENT_SOFT = 'rgba(0,230,138,0.12)';
export const ACCENT_LINE = 'rgba(0,230,138,0.35)';
export const DIM = 'rgba(255,255,255,0.55)';
export const DIM_STRONG = 'rgba(255,255,255,0.85)';

/** Радиусы — единая шкала. */
export const R = { card: 14, pill: 16, btn: 10, in: 8, chip: 8, bar: 4 } as const;

/** Базовая карточка (фон/рамка/радиус — одинаковы везде). */
export const CARD: React.CSSProperties = {
  background: 'rgba(24,24,27,0.55)',
  borderRadius: R.card,
  border: '1px solid rgba(255,255,255,0.06)',
  padding: '12px',
  margin: '6px 0',
};

/** Вторичный текст. */
export const SMALL: React.CSSProperties = {
  color: DIM, fontSize: 11, lineHeight: 1.4,
};

/** Заголовок секции. */
export const H: React.CSSProperties = {
  fontSize: 14, fontWeight: 700, color: ACCENT, marginBottom: 8,
};

/** Основная кнопка (акцентная). */
export const BTN: React.CSSProperties = {
  background: ACCENT, color: '#0a0a0a', border: 'none',
  borderRadius: R.btn, padding: '10px 14px', fontWeight: 600,
  fontSize: 12, minHeight: 40, cursor: 'pointer',
};

/** Призрачная кнопка (контур акцента). */
export const BTN_GHOST: React.CSSProperties = {
  ...BTN, background: 'transparent', color: ACCENT, border: `1px solid ${ACCENT_LINE}`,
};

/** Шаговая пилюля (активная / неактивная). */
export const STEP_PILL = (active: boolean): React.CSSProperties => ({
  padding: '5px 12px', borderRadius: R.pill, fontSize: 11,
  fontWeight: active ? 700 : 500, cursor: 'pointer',
  border: active ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.06)',
  background: active ? `linear-gradient(135deg,${ACCENT},#00c8a0)` : '#18181b',
  color: active ? '#000' : '#fff', flexShrink: 0,
});

/** Поле ввода. */
export const IN: React.CSSProperties = {
  background: '#18181b', color: '#fff',
  border: '1px solid rgba(255,255,255,0.08)', borderRadius: R.in,
  padding: '6px 8px', fontSize: 11, outline: 'none',
  boxSizing: 'border-box', minHeight: 32,
};

/** Мини-чип параметра (label + value). */
export const Chip: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div style={{
    padding: '5px 8px', borderRadius: R.chip,
    background: color + '15',
    border: `0.5px solid ${color}30`,
    display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center',
    minWidth: 50,
  }}>
    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', fontWeight: 700 }}>{label}</span>
    <span style={{ fontSize: 13, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</span>
  </div>
);

/** Цветная панель-уведомление (используется вместо ad-hoc rgba-панелей). */
export function panelStyle(color: string, bgAlpha = 0.05, borderAlpha = 0.18): React.CSSProperties {
  return {
    marginTop: 8, padding: 10, borderRadius: R.card,
    background: color + Math.round(bgAlpha * 255).toString(16).padStart(2, '0'),
    border: `1px solid ${color}${Math.round(borderAlpha * 255).toString(16).padStart(2, '0')}`,
  };
}
