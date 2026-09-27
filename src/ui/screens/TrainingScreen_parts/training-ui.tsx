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
export const DIM = 'var(--text-dim, #fff)';
export const DIM_STRONG = 'var(--text-light, #fff)';

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

/** Шаговая пилюля (активная / неактивная) — современно, с подъёмом. */
export const STEP_PILL = (active: boolean): React.CSSProperties => ({
  padding: '8px 14px', borderRadius: R.pill, fontSize: 11,
  fontWeight: active ? 800 : 500, cursor: 'pointer',
  border: active ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.08)',
  background: active ? `linear-gradient(135deg,${ACCENT} 0%, #00c8a0 100%)` : 'rgba(255,255,255,0.04)',
  color: active ? '#06281c' : '#fff', flexShrink: 0,
  boxShadow: active ? '0 2px 10px rgba(0,230,138,0.25), inset 0 1px 0 rgba(255,255,255,0.2)' : 'none',
  backdropFilter: 'blur(8px)', transition: 'all 0.2s ease', transform: active ? 'translateY(-1px)' : 'none',
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
    <span style={{ fontSize: 11, color: '#fff', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.3 }}>{label}</span>
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

/* ── Единый кит карточек (эталон BbCard/BbFoldCard, ПЛ-Фаза 3): иконка-тайл,
      заголовок 12.5/800, верхняя кромка акцента. Один визуальный язык для
      ББ-авто, ПЛ-авто, попапов и общих панелей — вместо локальных копий. ── */

/** Общая обвязка карточки кита (фон/рамка/радиус/верхняя кромка) — единый
 *  источник для BbCard/BbFoldCard и выносных fold-карточек (TrainingPopups). */
export function bbCardChrome(accent: string): React.CSSProperties {
  return {
    marginBottom: 10, padding: '10px 12px', borderRadius: 14, boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.025)',
    border: `1px solid ${accent}2e`, borderTop: `2px solid ${accent}55`,
  };
}

/** Иконка-тайл карточки кита (26×26, акцентная подложка). */
export function bbIconTile(accent: string): React.CSSProperties {
  return {
    width: 26, height: 26, borderRadius: 9, flexShrink: 0, fontSize: 14,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: `${accent}1f`, border: `1px solid ${accent}44`,
  };
}

/** Заголовок карточки кита (12.5/800). */
export const bbCardTitle: React.CSSProperties = { fontSize: 12.5, fontWeight: 800, color: '#fff', letterSpacing: 0.2 };

/** Бейдж карточки кита (справа, акцентный). */
export function bbCardBadge(accent: string): React.CSSProperties {
  return {
    marginLeft: 'auto', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999,
    background: `${accent}1a`, color: accent, border: `1px solid ${accent}44`,
  };
}

/** Базовая карточка секции: иконка-тайл + заголовок + подпись + контент. */
export const BbCard: React.FC<{
  icon?: string;
  title: React.ReactNode;
  desc?: React.ReactNode;
  accent?: string;
  badge?: React.ReactNode;
  /** Правый слот шапки (компактные контролы) — вне потока бейджа. */
  right?: React.ReactNode;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ icon, title, desc, accent = '#a855f7', badge, right, id, className, style, children }) => (
  <section id={id} className={className} style={{ ...bbCardChrome(accent), ...style }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: desc || children ? 8 : 0 }}>
      {icon && <span aria-hidden style={bbIconTile(accent)}>{icon}</span>}
      <span style={bbCardTitle}>{title}</span>
      {badge && <span style={bbCardBadge(accent)}>{badge}</span>}
      {right && (
        <span style={{ marginLeft: badge ? 0 : 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
          {right}
        </span>
      )}
    </div>
    {desc && <div style={{ fontSize: 10.5, color: '#fff', lineHeight: 1.45, marginBottom: children ? 8 : 0 }}>{desc}</div>}
    {children}
  </section>
);

/** Карточка-аккордеон (необязательные/второстепенные секции): тот же стиль, шапка-кнопка. */
export const BbFoldCard: React.FC<{
  icon?: string;
  title: React.ReactNode;
  desc?: React.ReactNode;
  accent?: string;
  badge?: React.ReactNode;
  /** Правый слот шапки (компактные контролы) — рядом с кнопкой, не внутри неё. */
  right?: React.ReactNode;
  defaultOpen?: boolean;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ icon, title, desc, accent = '#60a5fa', badge, right, defaultOpen = false, id, className, style, children }) => {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <section id={id} className={className} style={{ ...bbCardChrome(accent), ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        style={{
          width: right ? 'auto' : '100%', flex: right ? '1 1 auto' : undefined, minWidth: 0,
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          padding: 0, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
          fontFamily: 'inherit', minHeight: 28,
        }}
      >
        {icon && <span aria-hidden style={bbIconTile(accent)}>{icon}</span>}
        <span style={bbCardTitle}>{title}</span>
        {badge && <span style={bbCardBadge(accent)}>{badge}</span>}
        <span aria-hidden style={{
          marginLeft: badge ? 6 : 'auto', fontSize: 11, color: '#fff',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s', display: 'inline-block',
        }}>▾</span>
      </button>
      {right && (
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
          {right}
        </span>
      )}
      </div>
      {desc && <div style={{ fontSize: 10.5, color: '#fff', lineHeight: 1.45, marginTop: 6 }}>{desc}</div>}
      {open && <div style={{ marginTop: 8 }}>{children}</div>}
    </section>
  );
};

/* ── Шаговая навигация планировщиков (единый образец ББ-авто) ──
   Один компонент на ББ-авто, арм, ТА/стронг и единоборства: раньше у каждого
   был свой бэкграунд строки шагов (0.92 / 0.55 / rgb(20,20,23)) и свой набор
   разделителей, поэтому «визуально одинаковые» планировщики расходились. */

export type PlannerStepDef = { id: string; label: string };

/** Контейнер ленты шагов — плотный фон вместо стекла: blur(12px) давал лаги
 *  при переключении шагов на телефоне. */
export const PLANNER_STEP_NAV: React.CSSProperties = {
  background: 'rgba(24,24,27,0.92)', border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 10, padding: '5px 6px', marginBottom: 8, display: 'flex', gap: 4,
  overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
  alignItems: 'center',
};

/** Внешняя обёртка ленты (как в ББ-авто). */
export const PLANNER_STEP_NAV_WRAP: React.CSSProperties = {
  display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center',
};

/** Вертикальный разделитель между группами шагов. */
export const PLANNER_NAV_DIVIDER: React.CSSProperties = {
  width: 1, height: 18, flexShrink: 0, margin: '0 2px', alignSelf: 'center',
  background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.08), transparent)',
};

/** Шапка конструктора (имя + действия) — единый вид. */
export const PLANNER_HEAD_BAR: React.CSSProperties = {
  marginBottom: 10, padding: '8px 12px', borderRadius: 12,
  background: 'var(--accent-dim)', border: '1px solid var(--accent-glow)',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
};

export const PLANNER_HEAD_TITLE: React.CSSProperties = { fontSize: 13, fontWeight: 800, color: 'var(--accent)' };

/** Глобальный флеш — виден на всех шагах, не только в параметрах. */
export const PLANNER_FLASH: React.CSSProperties = {
  marginBottom: 10, padding: '8px 12px', borderRadius: 10,
  background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.2)',
  color: '#00e68a', fontSize: 11, fontWeight: 700,
};

/** Лента шагов конструктора. `groups` задаёт РАЗДЕЛИТЕЛИ, как в ББ-авто:
 *  названия групп там намеренно не рисуются — визуально это полоса пилюль. */
export const PlannerStepNav: React.FC<{
  steps: PlannerStepDef[];
  groups: string[][];
  active: string;
  /** Ключ трека — попадает в data-planner-step-nav, нужен хуку прокрутки. */
  dataNav: string;
  onSelect: (id: string) => void;
  /** Причина блокировки шага — вместо молчаливого «не нажимается». */
  lockReason?: (id: string) => string | null;
  flash?: (msg: string) => void;
  /** Совместимость с существующими хуками/тестами. */
  navAttrs?: Record<string, string>;
  pillClassName?: string;
  pillAttrs?: (id: string) => Record<string, string>;
}> = ({ steps, groups, active, dataNav, onSelect, lockReason, flash, navAttrs, pillClassName, pillAttrs }) => {
  const groupEndKeys = new Set(groups.map(g => g[g.length - 1]).filter(Boolean));
  const lastId = steps.length ? steps[steps.length - 1].id : null;
  return (
    <div {...navAttrs} data-planner-step-nav={dataNav} aria-label="Шаги" style={PLANNER_STEP_NAV}>
      {steps.map(s => {
        const isActive = active === s.id;
        const reason = lockReason ? lockReason(s.id) : null;
        const disabled = reason != null;
        return (
          <span key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <button
              type="button"
              className={pillClassName}
              data-step={s.id}
              data-active={isActive ? 'true' : 'false'}
              disabled={disabled}
              aria-current={isActive ? 'step' : undefined}
              aria-label={s.label}
              title={disabled ? reason! : undefined}
              onClick={() => {
                if (disabled) { if (flash) flash(`🔒 ${reason}`); return; }
                onSelect(s.id);
              }}
              style={{ ...STEP_PILL(isActive), flexShrink: 0, opacity: disabled ? 0.45 : 1 }}
              {...(pillAttrs ? pillAttrs(s.id) : null)}
            >{s.label}</button>
            {groupEndKeys.has(s.id) && s.id !== lastId && <span aria-hidden style={PLANNER_NAV_DIVIDER} />}
          </span>
        );
      })}
    </div>
  );
};

/** Смена шага — скролл экрана наверх + активная пилюля в видимую зону. */
export function usePlannerStepScroll(navKey: string, deps: React.DependencyList): void {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    try {
      const scroller = document.querySelector('.screen.training-screen') as HTMLElement | null;
      if (scroller && typeof scroller.scrollTo === 'function') scroller.scrollTo({ top: 0, behavior: 'smooth' });
      const nav = document.querySelector(`[data-planner-step-nav="${navKey}"]`) as HTMLElement | null;
      const activeBtn = nav?.querySelector('button[aria-current="step"]') as HTMLElement | null;
      if (activeBtn && typeof activeBtn.scrollIntoView === 'function') {
        activeBtn.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
      }
    } catch { /* нет DOM (SSR/jsdom) — не критично */ }
  }, deps);
}

/** Переключатель-строка: заголовок + описание + трек/тамб (высота 44px). */
export const BbRowSwitch: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  title: React.ReactNode;
  desc?: React.ReactNode;
  icon?: string;
  accent?: string;
  ariaLabel?: string;
  disabled?: boolean;
}> = ({ checked, onChange, title, desc, icon, accent = ACCENT, ariaLabel, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={ariaLabel}
    aria-disabled={disabled}
    onClick={() => { if (!disabled) onChange(!checked); }}
    style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 6px',
      padding: '10px 12px', minHeight: 44, borderRadius: 12, cursor: disabled ? 'not-allowed' : 'pointer', textAlign: 'left',
      boxSizing: 'border-box', fontFamily: 'inherit', opacity: disabled ? 0.5 : 1,
      background: checked ? `linear-gradient(135deg, ${accent}1e, rgba(24,24,27,0.35))` : 'rgba(255,255,255,0.03)',
      border: checked ? `1px solid ${accent}66` : '1px solid rgba(255,255,255,0.08)',
      transition: 'all .15s',
    }}
  >
    {icon && <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>}
    <span style={{ flex: 1, minWidth: 0 }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: checked ? accent : '#fff', lineHeight: 1.25 }}>{title}</span>
      {desc && <span style={{ display: 'block', fontSize: 10, color: '#fff', lineHeight: 1.35, marginTop: 2 }}>{desc}</span>}
    </span>
    <span style={{ marginLeft: 'auto', width: 36, height: 20, borderRadius: 10, flexShrink: 0, position: 'relative', background: checked ? accent : 'rgba(255,255,255,0.15)', transition: 'background .2s' }}>
      <span style={{ position: 'absolute', top: 2, left: checked ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
    </span>
  </button>
);

/** Компактный чип-переключатель (чек-листы, инлайн-ряды): ≥44px, aria-pressed. */
export const BbToggleChip: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
  accent?: string;
  ariaLabel?: string;
}> = ({ checked, onChange, label, accent = '#22c55e', ariaLabel }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={ariaLabel}
    onClick={() => onChange(!checked)}
    style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, padding: '6px 12px',
      borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
      fontSize: 11, fontWeight: checked ? 800 : 600,
      background: checked ? `${accent}22` : 'rgba(255,255,255,0.04)',
      border: checked ? `1px solid ${accent}66` : '1px solid rgba(255,255,255,0.1)',
      color: checked ? accent : '#fff',
    }}
  >
    <span aria-hidden style={{ fontSize: 12 }}>{checked ? '✓' : '○'}</span>
    <span style={{ minWidth: 0 }}>{label}</span>
  </button>
);

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
