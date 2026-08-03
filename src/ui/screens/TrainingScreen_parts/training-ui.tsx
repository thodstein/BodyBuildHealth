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
export const DIM = 'var(--text-dim, rgba(255,255,255,0.6))';
export const DIM_STRONG = 'var(--text-light, rgba(255,255,255,0.92))';

/** Радиусы — единая шкала (крупнее для мобильных тап-зон). */
export const R = { card: 16, pill: 18, btn: 12, in: 10, chip: 10, bar: 6 } as const;

/** Shared interaction timings and control sizes. */
export const UI_METRICS = {
  toastMs: 2600,
  autosaveMs: 30_000,
  touchMoveCancelPx: 10,
  tapMinHeight: 38,
  primaryMinHeight: 44,
} as const;

/** Общий фрост-гласс фон для карточек. */
const GLASS: React.CSSProperties = {
  background: 'var(--glass-bg, rgba(26,28,38,0.55))',
  backdropFilter: 'blur(18px) saturate(150%)',
  WebkitBackdropFilter: 'blur(18px) saturate(150%)',
  border: '1px solid var(--glass-border, rgba(255,255,255,0.09))',
  boxShadow: 'var(--glass-shadow, 0 10px 30px rgba(0,0,0,0.35))',
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
  background: 'var(--accent-gradient, linear-gradient(135deg,#00e68a,#00c8a0))',
  color: 'var(--accent-contrast, #06281c)', border: 'none',
  borderRadius: R.btn, padding: '12px 16px', fontWeight: 700,
  fontSize: 13, minHeight: 44, cursor: 'pointer',
  boxShadow: '0 6px 18px rgba(0,230,138,0.25)',
};

/** Призрачная кнопка (контур акцента). */
export const BTN_GHOST: React.CSSProperties = {
  ...BTN, background: 'transparent', color: 'var(--accent, #00e68a)', border: '1px solid var(--accent-line, rgba(0,230,138,0.45))', boxShadow: 'none',
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
  background: 'var(--input-bg, rgba(118,118,128,0.14))', color: 'var(--text, #fff)',
  border: '1px solid var(--input-border, rgba(255,255,255,0.1))', borderRadius: R.in,
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
    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.3 }}>{label}</span>
    <span style={{ fontSize: 15, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</span>
  </div>
);

/** Цветная панель-уведомление (фрост-гласс с акцентной левой рамкой) — Apple-style. */
export function panelStyle(color: string, bgAlpha = 0.06, borderAlpha = 0.22): React.CSSProperties {
  const hex = color.startsWith('#') ? color.slice(1) : color;
  const bg = `${hex}${Math.round(bgAlpha * 255).toString(16).padStart(2, '0')}`;
  const bd = `${hex}${Math.round(borderAlpha * 255).toString(16).padStart(2, '0')}`;
  return {
    marginTop: 10, padding: 14, borderRadius: 16,
    background: `rgba(${parseInt(hex.slice(0,2),16)}, ${parseInt(hex.slice(2,4),16)}, ${parseInt(hex.slice(4,6),16)}, ${bgAlpha})`,
    border: `1px solid ${bd}`,
    borderLeft: `3px solid ${color}`,
    backdropFilter: 'blur(20px) saturate(160%)',
    WebkitBackdropFilter: 'blur(20px) saturate(160%)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.05)',
    transition: 'all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  };
}

/** MRV-статус бейдж для таблицы объёмов. */
export function mrvBadge(status: 'below_mev' | 'optimal' | 'approaching_mrv' | 'exceeding_mrv'): React.CSSProperties {
  const colors = {
    below_mev: { bg: '#f59e0b1a', bd: '#f59e0b44', text: '#f59e0b', label: '🟡 Недотрен' },
    optimal:     { bg: '#22c55e1a', bd: '#22c55e44', text: '#22c55e', label: '🟢 Оптимум' },
    approaching_mrv: { bg: '#ef44441a', bd: '#ef444444', text: '#ef4444', label: '🟠 Близко к MRV' },
    exceeding_mrv:   { bg: '#ef44441a', bd: '#ef444444', text: '#ef4444', label: '🔴 > MRV' },
  };
  const c = colors[status];
  return {
    padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700,
    background: c.bg, border: `1px solid ${c.bd}`, color: c.text,
    whiteSpace: 'nowrap',
  };
}

/** Section title with accent bar. */
export function SectionTitle({ label, icon }: { label: string; icon?: string }): React.ReactElement {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      {icon && <span style={{ fontSize: 16 }}>{icon}</span>}
      <span style={{ fontSize: 13, fontWeight: 800, color: ACCENT, textTransform: 'uppercase', letterSpacing: 0.05 }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: ACCENT_LINE, borderRadius: 2 }} />
    </div>
  );
}
