/**
 * planner-ui.tsx — единый плотный каркас планировщиков (BB-эталон для всех).
 * План: docs/PLANNERS-STRUCTURE-PRO-PLAN.md (P1).
 *
 * Метрики: корень gap 8, карточка marginBottom 8 / padding 10-12 / radius 14,
 * шапка иконка 26 + заголовок 12.5/800, вторичное — Fold default closed,
 * закрытое = null (не display:none). Инлайн — единственный источник отступов.
 * Классы/DOM-хуки пробрасываются пропсами — строки/aria/логика 1-в-1.
 */
import React, { useState } from 'react';
import { ACCENT, CARD, SMALL, BTN, BTN_GHOST, H, STEP_PILL } from './training-ui';

export const PLANNER_GAP = 8;
export const PLANNER_CARD_MB = 8;

export function buzzPlanner(): void {
  try { (navigator as any)?.vibrate?.(8); } catch { /* no-op */ }
}

/** Корень шага: одна колонка с gap 8 — никаких stacked marginTop. */
export const PlannerRoot: React.FC<{
  rootClass?: string;
  maxWidth?: number;
  className?: string;
  children?: React.ReactNode;
}> = ({ rootClass, maxWidth, className, children }) => (
  <div
    className={rootClass ? `${rootClass} planner-root ${className || ''}` : `planner-root ${className || ''}`}
    style={{
      display: 'flex', flexDirection: 'column', gap: PLANNER_GAP,
      maxWidth, margin: maxWidth ? '0 auto' : undefined,
      padding: maxWidth ? '0 10px 90px' : undefined, boxSizing: 'border-box',
    }}
  >
    {children}
  </div>
);

/** Компактная hero-шапка (как BbAuto: иконка-тайл + заголовок + подпись, без glow-простыней). */
export const PlannerHead: React.FC<{
  icon: string; title: React.ReactNode; sub?: React.ReactNode; side?: React.ReactNode;
  className?: string;
}> = ({ icon, title, sub, side, className }) => (
  <div className={className || 'planner-head'} style={{ ...CARD, display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', margin: 0, flexWrap: 'wrap' }}>
    <div aria-hidden style={{ fontSize: 22, lineHeight: 1, width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(0,230,138,0.22), rgba(0,200,160,0.08))', border: '1px solid rgba(0,230,138,0.35)', flexShrink: 0 }}>{icon}</div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <h2 style={{ ...H, margin: 0, fontSize: 15 }}>{title}</h2>
      {sub ? <p style={{ ...SMALL, margin: '2px 0 0', color: '#fff', fontSize: 11 }}>{sub}</p> : null}
    </div>
    {side ? <div style={{ flexShrink: 0 }}>{side}</div> : null}
  </div>
);

export type PlannerStepDef = { id: string; label: string };

/** Липкая лента шагов с группами — один ряд, без пустот. */
export const PlannerSteps: React.FC<{
  groups: Array<{ name: string; ids: string[] }>;
  defs: PlannerStepDef[];
  active: string;
  onGo: (id: string) => void;
  hook?: Record<string, any>;
  className?: string;
}> = ({ groups, defs, active, onGo, hook, className }) => (
  <div className={className || 'planner-steps'} aria-label="Шаги" {...(hook || {})} style={{ position: 'sticky', top: 0, zIndex: 30, background: 'rgb(20,20,23)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '5px 6px', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
    {groups.map((g, gi) => (
      <span key={g.name} style={{ display: 'flex', alignItems: 'center', gap: 4, flex: '1 1 auto', minWidth: 0, flexWrap: 'wrap' }}>
        <span aria-hidden style={{ fontSize: 9, fontWeight: 800, color: '#fff', letterSpacing: 0.5 }}>{g.name}</span>
        {g.ids.map((id) => {
          const idx = defs.findIndex((s) => s.id === id);
          const s = defs[idx] || { id, label: id };
          const isActive = active === id;
          return (
            <button
              key={id} type="button" aria-label={s.label} aria-pressed={isActive} data-active={isActive}
              onClick={() => { buzzPlanner(); onGo(id); }}
              style={{ ...STEP_PILL(isActive), padding: '6px 8px', fontSize: 10, flex: '1 1 auto', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              <span aria-hidden style={{ marginRight: 4, opacity: 0.8 }}>{idx + 1}</span>
              {s.label}
            </button>
          );
        })}
        {gi < groups.length - 1 && <span aria-hidden style={{ width: 1, height: 18, background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.08), transparent)', margin: '0 2px' }} />}
      </span>
    ))}
  </div>
);

/** Первичная карточка секции (открыта всегда). */
export const PlannerCard: React.FC<{
  icon?: string; title: React.ReactNode; desc?: React.ReactNode; accent?: string;
  badge?: React.ReactNode; children?: React.ReactNode;
  className?: string; hook?: Record<string, any>;
}> = ({ icon, title, desc, accent = '#a855f7', badge, children, className, hook }) => (
  <section className={className} {...(hook || {})} style={{
    margin: `0 0 ${PLANNER_CARD_MB}px`, padding: '10px 12px', borderRadius: 14, boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.025)',
    border: `1px solid ${accent}2e`, borderTop: `2px solid ${accent}55`,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: desc || children ? 8 : 0 }}>
      {icon && (
        <span aria-hidden style={{ width: 26, height: 26, borderRadius: 9, flexShrink: 0, fontSize: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: `${accent}1f`, border: `1px solid ${accent}44` }}>{icon}</span>
      )}
      <span style={{ fontSize: 12.5, fontWeight: 800, color: '#fff', letterSpacing: 0.2 }}>{title}</span>
      {badge && (
        <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: `${accent}1a`, color: accent, border: `1px solid ${accent}44` }}>{badge}</span>
      )}
    </div>
    {desc && <div style={{ fontSize: 10.5, color: '#fff', lineHeight: 1.45, marginBottom: children ? 8 : 0 }}>{desc}</div>}
    {children}
  </section>
);

/** Вторичная карточка-аккордеон: закрытое = null (не display:none) — пустот нет. */
export const PlannerFold: React.FC<{
  icon?: string; title: React.ReactNode; desc?: React.ReactNode; accent?: string;
  badge?: React.ReactNode; defaultOpen?: boolean; summary?: React.ReactNode;
  status?: 'ok' | 'warn'; children?: React.ReactNode;
  className?: string; hook?: Record<string, any>;
}> = ({ icon, title, desc, accent = '#60a5fa', badge, defaultOpen = false, summary, status, children, className, hook }) => {
  const [open, setOpen] = useState(defaultOpen);
  const dot = status ? <span aria-hidden style={{ width: 8, height: 8, borderRadius: 99, background: status === 'ok' ? '#00e68a' : '#f59e0b', display: 'inline-block', marginRight: 6 }} /> : null;
  return (
    <section className={className} {...(hook || {})} style={{
      margin: `0 0 ${PLANNER_CARD_MB}px`, padding: '10px 12px', borderRadius: 14, boxSizing: 'border-box',
      background: 'rgba(255,255,255,0.025)',
      border: `1px solid ${accent}2e`, borderTop: `2px solid ${accent}55`,
    }}>
      <button
        type="button" aria-expanded={open}
        onClick={() => { buzzPlanner(); setOpen((v) => !v); }}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: 0, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', minHeight: 28 }}
      >
        {icon && (
          <span aria-hidden style={{ width: 26, height: 26, borderRadius: 9, flexShrink: 0, fontSize: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: `${accent}1f`, border: `1px solid ${accent}44` }}>{icon}</span>
        )}
        <span style={{ fontSize: 12.5, fontWeight: 800, color: '#fff', letterSpacing: 0.2 }}>{dot}{title}</span>
        {badge && (
          <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: `${accent}1a`, color: accent, border: `1px solid ${accent}44` }}>{badge}</span>
        )}
        {!open && summary ? <span style={{ ...SMALL, color: '#fff', marginLeft: badge ? 6 : 'auto' }}>{summary}</span> : null}
        <span aria-hidden style={{ marginLeft: badge || (!open && summary) ? 6 : 'auto', fontSize: 11, color: '#fff', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s', display: 'inline-block' }}>▾</span>
      </button>
      {desc && <div style={{ fontSize: 10.5, color: '#fff', lineHeight: 1.45, marginTop: 6 }}>{desc}</div>}
      {open ? <div style={{ marginTop: 8 }}>{children}</div> : null}
    </section>
  );
};

/** Навигация шага: primary-CTA + компактная подсказка, без липкой пустоты. */
export const PlannerNav: React.FC<{
  nextLabel: React.ReactNode; onNext: () => void;
  backLabel?: React.ReactNode; onBack?: () => void;
  hint?: React.ReactNode;
}> = ({ nextLabel, onNext, backLabel, onBack, hint }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2 }}>
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {onBack && <button type="button" onClick={onBack} style={{ ...BTN_GHOST, flex: 1 }}>{backLabel || '← Назад'}</button>}
      <button type="button" onClick={() => { buzzPlanner(); onNext(); }} style={{ ...BTN, flex: 1.4 }}>{nextLabel}</button>
    </div>
    {hint ? <div style={{ ...SMALL, color: '#fff', fontSize: 11 }}>{hint}</div> : null}
  </div>
);

export { ACCENT, BTN, BTN_GHOST, STEP_PILL };
