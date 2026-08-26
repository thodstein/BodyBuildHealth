/**
 * ManualUI.tsx — единый UI-слой ручного конструктора (в стиле CardioUI + training-ui).
 * Все вкладки конструктора используют эти токены/компоненты для единого оформления.
 */
import React from 'react';
import { ACCENT, CARD as BASE_CARD, BTN as BASE_BTN, BTN_GHOST as BASE_GHOST, DIM, DIM_STRONG, IN as BASE_IN, STEP_PILL as BASE_STEP_PILL, panelStyle } from './training-ui';

// ─── Токены (совместимы с training-ui, но централизованы) ───
export { ACCENT, DIM, DIM_STRONG, panelStyle };
export const ACCENT_SOFT = 'rgba(0,230,138,0.14)';
export const ACCENT_BORDER = 'rgba(0,230,138,0.45)';
export const GLASS_BG = 'linear-gradient(180deg, rgba(26,28,38,0.62), rgba(18,20,30,0.48))';
export const GLASS_BORDER = 'rgba(255,255,255,0.09)';

export const CARD: React.CSSProperties = {
  ...BASE_CARD,
  background: GLASS_BG,
  border: `1px solid ${GLASS_BORDER}`,
  borderRadius: 16,
  boxShadow: '0 10px 28px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.04)',
  backdropFilter: 'blur(18px) saturate(150%)',
};

export const CARD_ACCENT: React.CSSProperties = {
  ...CARD,
  borderColor: ACCENT_BORDER,
  background: 'linear-gradient(180deg, rgba(0,230,138,0.12), rgba(0,230,138,0.03))',
  boxShadow: '0 4px 24px rgba(0,230,138,0.12), inset 0 1px 0 rgba(255,255,255,0.06)',
};

export const CARD_SOFT: React.CSSProperties = {
  ...CARD,
  background: 'rgba(255,255,255,0.02)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
};

export const CARD_INFO: React.CSSProperties = {
  ...CARD,
  borderLeft: '3px solid #60a5fa',
  background: 'linear-gradient(180deg, rgba(59,130,246,0.08), rgba(255,255,255,0.015))',
};

export const ROW: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' };
export const ROW_TIGHT: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' };
export const LABEL: React.CSSProperties = { fontSize: 11, color: '#fff', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, lineHeight: 1 };
export const LABEL_SM: React.CSSProperties = { fontSize: 10, color: '#fff', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 };
export const HINT: React.CSSProperties = { fontSize: 11, color: '#fff', lineHeight: 1.55 };
export const HINT_SM: React.CSSProperties = { fontSize: 10, color: 'rgba(255,255,255,0.42)', lineHeight: 1.5 };

export const BTN: React.CSSProperties = BASE_BTN;
export const BTN_GHOST: React.CSSProperties = BASE_GHOST;
export const BTN_PRIMARY: React.CSSProperties = { ...BASE_BTN, background: 'linear-gradient(180deg, rgba(0,230,138,0.22), rgba(0,230,138,0.14))', border: `1px solid ${ACCENT_BORDER}`, color: ACCENT, boxShadow: '0 0 14px rgba(0,230,138,0.18), inset 0 1px 0 rgba(255,255,255,0.08)' };
export const BTN_DANGER: React.CSSProperties = { ...BASE_BTN, background: 'rgba(239,68,68,0.11)', border: '1px solid rgba(239,68,68,0.32)', color: '#f87171' };
export const BTN_SMALL: React.CSSProperties = { ...BASE_BTN, minHeight: 32, padding: '6px 11px', fontSize: 11, borderRadius: 9 };
export const BTN_XS: React.CSSProperties = { ...BASE_BTN, minHeight: 28, padding: '4px 9px', fontSize: 11, borderRadius: 8 };
export const IN: React.CSSProperties = BASE_IN;
export const STEP_PILL = BASE_STEP_PILL;

export const CHIP: React.CSSProperties = {
  padding: '7px 13px', borderRadius: 10, fontSize: 12, fontWeight: 650, cursor: 'pointer',
  border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.035)',
  color: '#fff', whiteSpace: 'nowrap', minHeight: 36, transition: 'all 0.15s ease',
};
export const CHIP_ACTIVE: React.CSSProperties = {
  ...CHIP, border: `1px solid ${ACCENT_BORDER}`, background: ACCENT_SOFT, color: '#fff',
  boxShadow: '0 0 10px rgba(0,230,138,0.16), inset 0 1px 0 rgba(255,255,255,0.06)',
};

export const DIR_COLOR: Record<string, string> = { bb: '#00e68a', pl: '#a78bfa', hybrid: '#3b82f6' };
export const DIR_BG: Record<string, string> = { bb: 'rgba(0,230,138,0.12)', pl: 'rgba(167,139,250,0.12)', hybrid: 'rgba(59,130,246,0.12)' };

export const PHASE_COLOR: Record<string, string> = { accumulation: '#22c55e', intensification: '#f59e0b', deload: '#ef4444', peaking: '#a78bfa' };
export const PHASE_BG: Record<string, string> = {
  accumulation: 'rgba(34,197,94,0.14)', intensification: 'rgba(245,158,11,0.14)', deload: 'rgba(239,68,68,0.14)', peaking: 'rgba(167,139,250,0.14)',
};

// ─── Компоненты ───

export const Badge: React.FC<{ color?: string; bg?: string; border?: string; children: React.ReactNode }> = ({ color = '#fff', bg = 'rgba(255,255,255,0.06)', border = 'rgba(255,255,255,0.12)', children }) => (
  <span style={{ fontSize: 11, fontWeight: 750, color, background: bg, border: `1px solid ${border}`, borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap' }}>{children}</span>
);

export const ProgressBar: React.FC<{ value: number; max?: number; color?: string; height?: number }> = ({ value, max = 100, color = ACCENT, height = 6 }) => {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return <div style={{ height, borderRadius: height / 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}><div style={{ height, borderRadius: height / 2, width: pct + '%', background: color, transition: 'width 0.35s ease', boxShadow: `0 0 8px ${color}55` }} /></div>;
};

export const Divider: React.FC = () => <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '2px 0' }} />;

export const InfoBanner: React.FC<{ tone?: 'ok' | 'warn' | 'info' | 'accent'; children: React.ReactNode }> = ({ tone = 'info', children }) => {
  const palette = tone === 'warn'
    ? { color: '#fbbf24', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)' }
    : tone === 'ok'
      ? { color: '#4ade80', bg: 'rgba(0,230,138,0.07)', border: 'rgba(0,230,138,0.25)' }
      : tone === 'accent'
        ? { color: ACCENT, bg: 'rgba(0,230,138,0.08)', border: ACCENT_BORDER }
        : { color: '#93c5fd', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.28)' };
  return <div role="status" style={{ fontSize: 11, color: palette.color, background: palette.bg, border: `1px solid ${palette.border}`, borderRadius: 10, padding: '7px 10px', lineHeight: 1.5 }}>{children}</div>;
};

export const SectionCard: React.FC<{ id?: string; title?: React.ReactNode; right?: React.ReactNode; accent?: boolean; hint?: string; children: React.ReactNode }> = ({ id, title, right, accent, hint, children }) => (
  <div style={accent ? CARD_ACCENT : CARD} id={id}>
    {title != null && (<div style={ROW}><span style={{ fontSize: 13, fontWeight: 850, color: '#fff', letterSpacing: 0.1 }}>{title}</span><span style={{ flex: 1 }} />{right}</div>)}
    {children}
    {hint && <div style={HINT}>{hint}</div>}
  </div>
);

export const GroupHeading: React.FC<{ icon: string; text: string; desc?: string }> = ({ icon, text, desc }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingTop: 6, borderLeft: `3px solid ${ACCENT}`, paddingLeft: 10, borderRadius: 4, background: 'linear-gradient(90deg, rgba(0,230,138,0.06), transparent)' }}>
    <span style={{ fontSize: 13, fontWeight: 850, color: ACCENT, letterSpacing: 0.1 }}>{icon} {text}</span>
    {desc && <span style={HINT_SM}>{desc}</span>}
  </div>
);

export const EmptyState: React.FC<{ icon: string; title: string; desc?: string; action?: React.ReactNode }> = ({ icon, title, desc, action }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '20px 12px', textAlign: 'center' }}>
    <div style={{ fontSize: 28 }}>{icon}</div>
    <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{title}</div>
    {desc && <div style={{ fontSize: 11, color: '#fff', maxWidth: 360, lineHeight: 1.5 }}>{desc}</div>}
    {action}
  </div>
);

export const StatTile: React.FC<{ label: string; value: string; color?: string; sub?: string }> = ({ label, value, color = '#94a3b8', sub }) => (
  <div style={{ flex: '1 1 96px', padding: '10px 12px', borderRadius: 12, background: 'linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.02))', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 3, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}>
    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.42)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>{label}</span>
    <span style={{ fontSize: 18, fontWeight: 900, color, lineHeight: 1 }}>{value}</span>
    {sub && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)' }}>{sub}</span>}
  </div>
);

/** Шапка конструктора — акцент-карточка с заголовком, сводкой и прогрессом. */
export const ManualHeader: React.FC<{
  title: string;
  subtitle?: string;
  chips?: Array<{ label: string; color?: string }>;
  progress?: { current: number; total: number; label?: string };
}> = ({ title, subtitle, chips, progress }) => {
  const pct = progress ? Math.round((progress.current / Math.max(1, progress.total)) * 100) : 0;
  return (
    <div style={{ ...CARD_ACCENT, padding: '12px 14px', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 15, fontWeight: 900, color: '#fff', letterSpacing: -0.2 }}>{title}</span>
        {progress && <span style={{ fontSize: 11, fontWeight: 700, color: ACCENT, background: 'rgba(0,230,138,0.12)', border: `1px solid ${ACCENT_BORDER}`, borderRadius: 20, padding: '2px 8px' }}>Шаг {progress.current} из {progress.total}{progress.label ? ` — ${progress.label}` : ''}</span>}
        <span style={{ flex: 1 }} />
        {chips?.map((c, i) => <span key={i} style={{ fontSize: 10, fontWeight: 700, color: c.color ?? '#fff', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '3px 8px', whiteSpace: 'nowrap' }}>{c.label}</span>)}
      </div>
      {subtitle && <div style={{ fontSize: 11, color: '#fff', lineHeight: 1.5 }}>{subtitle}</div>}
      {progress && (
        <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <div style={{ height: 6, borderRadius: 3, width: pct + '%', background: 'linear-gradient(90deg,#00e68a,#00c853)', transition: 'width 0.35s ease', boxShadow: '0 0 10px rgba(0,230,138,0.35)' }} />
        </div>
      )}
    </div>
  );
};

/** Степпер шагов — 3 пилюли выбора. */
export const ManualStepper: React.FC<{
  steps: Array<{ id: string; label: string }>;
  active: string;
  onChange: (id: string) => void;
  disabledIds?: Set<string>;
}> = ({ steps, active, onChange, disabledIds }) => {
  const activeIdx = steps.findIndex(s => s.id === active);
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {steps.map((s, idx) => {
        const isActive = s.id === active;
        const disabled = disabledIds?.has(s.id);
        const isDone = activeIdx >= 0 && idx < activeIdx && !disabled;
        return (
          <button
            key={s.id}
            disabled={!!disabled}
            onClick={() => !disabled && onChange(s.id)}
            aria-pressed={isActive}
            aria-disabled={!!disabled}
            style={{
              ...CHIP,
              flex: '1 0 auto',
              minWidth: 92,
              justifyContent: 'center',
              display: 'inline-flex',
              alignItems: 'center',
              ...(isActive ? { background: 'linear-gradient(135deg,#00e68a,#00c8a0)', color: '#06281c', border: '1px solid #00e68a', boxShadow: '0 4px 14px rgba(0,230,138,0.3)', fontWeight: 800 } : {}),
              ...(disabled ? { opacity: 0.4, cursor: 'not-allowed' } : {}),
            }}
          >
            {isDone ? '✓ ' : isActive ? '● ' : ''}{s.label}
          </button>
        );
      })}
    </div>
  );
};

/** Мини полоска объёма MEV/MAV/MRV — для сессии/недели. */
export const VolumeMiniBar: React.FC<{ cur: number; mrv: number; mev: number; label?: string; compact?: boolean }> = ({ cur, mrv, mev, label, compact }) => {
  const pct = mrv > 0 ? Math.round((cur / mrv) * 100) : 0;
  const color = pct > 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : cur < mev ? '#3b82f6' : '#22c55e';
  const status = pct > 100 ? 'перегруз' : cur < mev ? 'недобор' : pct >= 80 ? 'зона' : 'ок';
  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
        {label && <span style={{ fontSize: 10, color: DIM, minWidth: 52 }}>{label}</span>}
        <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', minWidth: 36 }}><div style={{ height: 6, width: Math.min(100, pct) + '%', background: color, borderRadius: 3 }} /></div>
        <span style={{ fontSize: 10, fontWeight: 700, color }}>{cur}/{mrv}</span>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      {label && <span style={{ fontSize: 11, color: '#fff', fontWeight: 700, minWidth: 64 }}>{label}</span>}
      <div style={{ flex: 1, height: 7, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}><div style={{ height: 7, width: Math.min(100, pct) + '%', background: color }} /></div>
      <span style={{ fontSize: 11, fontWeight: 700, color }}>{cur}/{mrv}с</span>
      <span style={{ fontSize: 10, fontWeight: 700, color }}>{status}</span>
    </div>
  );
};

export const ScoreBadge: React.FC<{ score: number; grade: string }> = ({ score, grade }) => {
  const color = score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
  return <span style={{ fontSize: 12, fontWeight: 800, color, background: color + '15', border: `1px solid ${color}40`, borderRadius: 20, padding: '3px 10px' }}>{score}/100 {grade}</span>;
};

// ─── Карточные кнопки (замена всем мелким BTN_GHOST) ───
// Карточка-кнопка: иконка + заголовок + подсказка, стеклянный фон, hover-подъём.
// Используется для выбора групп мышц, шаблонов, действий — вместо россыпи мелких кнопок.
export const CARD_BTN: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3,
  padding: '10px 11px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.02))',
  border: '1px solid rgba(255,255,255,0.08)', color: '#fff',
  boxShadow: '0 2px 10px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.04)',
  transition: 'all 0.15s ease', minHeight: 56,
  whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'normal',
} as const;
export const CARD_BTN_ACTIVE: React.CSSProperties = {
  ...CARD_BTN, background: 'linear-gradient(180deg, rgba(0,230,138,0.14), rgba(0,230,138,0.06))',
  border: '1px solid rgba(0,230,138,0.35)', boxShadow: '0 4px 14px rgba(0,230,138,0.18), inset 0 1px 0 rgba(255,255,255,0.06)',
} as const;
export const CARD_BTN_GRID: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(132px, 1fr))', gap: 8,
} as const;
export const CARD_ACTION: React.CSSProperties = {
  ...CARD_BTN, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 8, minHeight: 48, padding: '10px 12px',
} as const;

// Маленькая иконка-кнопка в карточке (⧉/🔄/📋/✕/▲/▼) — тоже карточка, но компактная
export const ICON_CARD_BTN: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 44, height: 44, minWidth: 44, minHeight: 44, borderRadius: 10, cursor: 'pointer',
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff',
  fontSize: 13, transition: 'all 0.15s ease',
} as const;

export const MethodHint: React.FC<{ icon?: string; title: string; text: string; color?: string }> = ({ icon = '💡', title, text, color = '#60a5fa' }) => (
  <div style={{ display: 'flex', gap: 8, padding: '8px 10px', borderRadius: 10, background: `${color}10`, border: `1px solid ${color}22`, lineHeight: 1.45 }}>
    <span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <span style={{ fontSize: 11, fontWeight: 800, color }}>{title}</span>
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', overflowWrap: 'anywhere', wordBreak: 'normal' }}>{text}</span>
    </div>
  </div>
);
