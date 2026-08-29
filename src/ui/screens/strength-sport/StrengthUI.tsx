/**
 * StrengthUI.tsx — премиальный UI-слой для стронга/ТА (зелёно-янтарная ветка).
 * Стекло + градиенты + Apple HIG. Полностью современный.
 */
import React from 'react';

export const ACCENT = '#00e68a';
export const ACCENT_STRONG = '#f59e0b';
export const ACCENT_TA = '#3b82f6';
export const ACCENT_GRAD = 'linear-gradient(135deg, #00e68a 0%, #00c853 55%, #0ea5e9 100%)';
export const STRONG_GRAD = 'linear-gradient(135deg, #f59e0b 0%, #f97316 55%, #ef4444 100%)';
export const ACCENT_SOFT = 'rgba(0,230,138,0.12)';
export const ACCENT_BORDER = 'rgba(0,230,138,0.32)';
export const ACCENT_GLOW = '0 0 20px rgba(0,230,138,0.20), 0 8px 32px rgba(0,0,0,0.32)';
export const STRONG_SOFT = 'rgba(245,158,11,0.12)';
export const STRONG_BORDER = 'rgba(245,158,11,0.32)';

export const GLASS_BG = 'linear-gradient(180deg, rgba(24,26,28,0.72), rgba(16,18,20,0.58))';
export const GLASS_BORDER = 'rgba(255,255,255,0.08)';
export const GLASS_SHADOW = '0 10px 36px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.06)';
export const TEXT_1 = '#ffffff';
export const TEXT_2 = 'rgba(255,255,255,0.68)';
export const TEXT_3 = 'rgba(255,255,255,0.42)';

export const RADIUS_LG = 20;
export const RADIUS_MD = 14;

export const CARD: React.CSSProperties = {
  background: GLASS_BG,
  border: `1px solid ${GLASS_BORDER}`,
  borderRadius: RADIUS_LG,
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  boxShadow: GLASS_SHADOW,
  backdropFilter: 'blur(18px) saturate(160%)',
  WebkitBackdropFilter: 'blur(18px) saturate(160%)',
  position: 'relative',
  overflow: 'hidden',
};
export const CARD_ACCENT: React.CSSProperties = {
  ...CARD,
  background: 'linear-gradient(180deg, rgba(0,230,138,0.12), rgba(16,20,18,0.62))',
  borderColor: ACCENT_BORDER,
  boxShadow: '0 0 20px rgba(0,230,138,0.14), 0 8px 32px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.07)',
};
export const CARD_STRONG: React.CSSProperties = {
  ...CARD,
  background: 'linear-gradient(180deg, rgba(245,158,11,0.12), rgba(28,22,16,0.62))',
  borderColor: STRONG_BORDER,
  boxShadow: '0 0 20px rgba(245,158,11,0.12), 0 8px 32px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.07)',
};
export const CARD_HERO: React.CSSProperties = {
  ...CARD,
  background: 'linear-gradient(180deg, rgba(0,230,138,0.10), rgba(16,20,18,0.62))',
  borderColor: ACCENT_BORDER,
  boxShadow: ACCENT_GLOW + ', inset 0 1px 0 rgba(255,255,255,0.07)',
  padding: 16,
  gap: 14,
};

export const ROW: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' };
export const COL: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 10 };
export const LABEL: React.CSSProperties = { fontSize: 10, color: TEXT_2, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.7, lineHeight: 1, display: 'flex', alignItems: 'center', gap: 6 };
export const HINT: React.CSSProperties = { fontSize: 12, color: TEXT_2, lineHeight: 1.5 };
export const HINT_SM: React.CSSProperties = { fontSize: 11, color: TEXT_3, lineHeight: 1.5 };

export const BTN: React.CSSProperties = {
  padding: '11px 16px',
  borderRadius: 12,
  fontSize: 12.5,
  fontWeight: 800,
  cursor: 'pointer',
  border: '1px solid rgba(255,255,255,0.09)',
  background: 'rgba(255,255,255,0.06)',
  color: TEXT_1,
  minHeight: 44,
  whiteSpace: 'nowrap',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 16px rgba(0,0,0,0.22)',
  transition: 'all 0.18s cubic-bezier(0.25,0.46,0.45,0.94)',
  letterSpacing: 0.15,
  backdropFilter: 'blur(10px)',
};
export const BTN_PRIMARY: React.CSSProperties = { ...BTN, background: ACCENT_GRAD, border: 'none', color: '#06281c', boxShadow: '0 8px 24px rgba(0,230,138,0.28), inset 0 1px 0 rgba(255,255,255,0.22)' };
export const BTN_STRONG: React.CSSProperties = { ...BTN, background: STRONG_GRAD, border: 'none', color: '#fff', boxShadow: '0 8px 24px rgba(245,158,11,0.28), inset 0 1px 0 rgba(255,255,255,0.22)' };
export const BTN_SMALL: React.CSSProperties = { ...BTN, minHeight: 36, padding: '8px 12px', fontSize: 11.5, borderRadius: 10 };
export const BTN_GHOST: React.CSSProperties = { ...BTN, background: 'rgba(0,230,138,0.10)', border: `1px solid ${ACCENT_BORDER}`, color: '#86efac' };

export const INPUT: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 12,
  padding: '10px 12px',
  color: TEXT_1,
  fontSize: 13,
  fontWeight: 600,
  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.18)',
  outline: 'none',
  width: '100%',
  transition: 'border-color 0.18s, box-shadow 0.18s, background 0.18s',
  backdropFilter: 'blur(8px)',
};
export const SELECT: React.CSSProperties = { ...INPUT, appearance: 'none' as any, cursor: 'pointer' };

export const CHIP: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 12,
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.05)',
  color: TEXT_1,
  whiteSpace: 'nowrap',
  minHeight: 38,
  transition: 'all 0.18s ease',
  letterSpacing: 0.15,
  backdropFilter: 'blur(8px)',
};
export const CHIP_ACTIVE: React.CSSProperties = { ...CHIP, border: `1px solid ${ACCENT_BORDER}`, background: 'linear-gradient(135deg, rgba(0,230,138,0.18), rgba(0,230,138,0.08))', color: '#fff', boxShadow: '0 4px 16px rgba(0,230,138,0.14), inset 0 1px 0 rgba(255,255,255,0.10)' };
export const CHIP_STRONG_ACTIVE: React.CSSProperties = { ...CHIP, border: `1px solid ${STRONG_BORDER}`, background: 'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(245,158,11,0.08))', color: '#fff', boxShadow: '0 4px 16px rgba(245,158,11,0.14), inset 0 1px 0 rgba(255,255,255,0.10)' };

export const PHASE_COLOR: Record<string, string> = {
  accumulation: '#3b82f6', intensification: '#f59e0b', peaking: '#ef4444', deload: '#64748b', transition: '#475569', taper: '#eab308',
};
export const MODE_COLOR: Record<string, string> = { weightlifting: ACCENT, strongman: ACCENT_STRONG, hybrid: ACCENT_TA };
export const MODE_RU: Record<string, string> = { weightlifting: 'Тяжёлая атлетика', strongman: 'Силовой экстрим', hybrid: 'Гибрид' };
export const LEVEL_RU: Record<string, string> = { beginner: 'Новичок', intermediate: 'Средний', advanced: 'Продвинутый', enhanced: 'На курсе' };
export const PHASE_RU: Record<string, string> = { accumulation: 'Накопление', intensification: 'Интенсификация', peaking: 'Пик', deload: 'Разгрузка', transition: 'Переход', taper: 'Тапер' };
export const ZONE_RU: Record<string, string> = { optimal: 'Оптимум', caution: 'Внимание', dangerous: 'Перегруз', undertrained: 'Недотрен' };
export const EQUIP_RU: Record<string, string> = { barbell: 'Штанга', dumbbell: 'Гантели', machine: 'Тренажёр', cable: 'Блоки', other: 'Прочее' };
export const MOBILITY_RU: Record<string, string> = { shoulder: 'Плечо', hip: 'Таз', knee: 'Колено', ankle: 'Голеностоп', wrist: 'Запястье', lower_back: 'Поясница' };
export const SESSION_TAG_RU: Record<string, string> = { snatch_day: 'Рывок', clean_day: 'Толчок', strength_day: 'Сила', technique_day: 'Техника', pull_day: 'Тяги', accessory_day: 'Подсобка', overhead_day: 'Жим', deadlift_day: 'Тяга', event_day: 'Ивенты', squat_day: 'Присед', oly_day: 'Олимпийка' };
export function ruLabel(map: Record<string, string>, k: string) { return (map as any)[k] ?? k; }

// ─── Компоненты ───
export const SectionCard: React.FC<{ id?: string; title?: React.ReactNode; subtitle?: string; icon?: string; right?: React.ReactNode; accent?: boolean; strong?: boolean; hint?: string; children: React.ReactNode }> = ({ id, title, subtitle, icon, right, accent, strong, hint, children }) => {
  const base = strong ? CARD_STRONG : accent ? CARD_ACCENT : CARD;
  return (
    <div style={base} id={id}>
      <div style={{ position: 'absolute', top: 0, left: 14, right: 14, height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)' }} />
      {title != null && (
        <div style={ROW}>
          {icon && <span style={{ width: 28, height: 28, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: strong ? 'linear-gradient(135deg,#f59e0b,#ef4444)' : accent ? 'linear-gradient(135deg,#00e68a,#0ea5e9)' : 'rgba(255,255,255,0.06)', border: strong || accent ? 'none' : '1px solid rgba(255,255,255,0.07)', fontSize: 14, flexShrink: 0 }}>{icon}</span>}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', letterSpacing: -0.2 }}>{title}</div>
            {subtitle && <div style={{ fontSize: 11, color: TEXT_3, lineHeight: 1.2, marginTop: 1 }}>{subtitle}</div>}
          </div>
          {right}
        </div>
      )}
      {children}
      {hint && <div style={{ ...HINT, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, padding: '8px 10px' }}>{hint}</div>}
    </div>
  );
};

export const StatTile: React.FC<{ label: string; value: string; color?: string; sub?: string; icon?: string }> = ({ label, value, color = '#00e68a', sub, icon }) => (
  <div style={{ flex: '1 1 112px', padding: '12px 12px', borderRadius: 14, background: `linear-gradient(180deg, ${color}14, rgba(255,255,255,0.02))`, border: `1px solid ${color}22`, display: 'flex', flexDirection: 'column', gap: 4, position: 'relative', overflow: 'hidden', backdropFilter: 'blur(10px)', boxShadow: `0 4px 16px ${color}10` }}>
    <div style={{ position: 'absolute', top: -18, right: -18, width: 56, height: 56, borderRadius: '50%', background: `${color}14`, filter: 'blur(6px)' }} />
    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.48)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4 }}>{icon && <span style={{ fontSize: 10 }}>{icon}</span>}{label}</span>
    <span style={{ fontSize: 20, fontWeight: 900, color, lineHeight: 1, letterSpacing: -0.5 }}>{value}</span>
    {sub && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.44)', lineHeight: 1.2 }}>{sub}</span>}
  </div>
);

export const Badge: React.FC<{ color?: string; bg?: string; border?: string; icon?: string; children: React.ReactNode }> = ({ color = '#fff', bg = 'rgba(255,255,255,0.06)', border = 'rgba(255,255,255,0.10)', icon, children }) => (
  <span style={{ fontSize: 11, fontWeight: 800, color, background: bg, border: `1px solid ${border}`, borderRadius: 20, padding: '5px 11px', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5, backdropFilter: 'blur(10px)', boxShadow: '0 2px 8px rgba(0,0,0,0.14)', letterSpacing: 0.15 }}>{icon && <span style={{ fontSize: 11 }}>{icon}</span>}{children}</span>
);

export const InfoBanner: React.FC<{ tone?: 'ok' | 'warn' | 'info' | 'strong'; children: React.ReactNode }> = ({ tone = 'info', children }) => {
  const pal = tone === 'warn' ? { color: '#fbbf24', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.22)', left: '#f59e0b' }
    : tone === 'ok' ? { color: '#4ade80', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.22)', left: '#22c55e' }
    : tone === 'strong' ? { color: '#fcd34d', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.24)', left: '#f59e0b' }
    : { color: '#93c5fd', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.20)', left: '#3b82f6' };
  return <div role="status" style={{ fontSize: 11.5, color: pal.color, background: pal.bg, border: `1px solid ${pal.border}`, borderLeft: `3px solid ${pal.left}`, borderRadius: 12, padding: '9px 11px', lineHeight: 1.45, backdropFilter: 'blur(10px)', display: 'flex', gap: 8, alignItems: 'flex-start' }}><span style={{ fontSize: 12, marginTop: 1, flexShrink: 0 }}>{tone === 'warn' ? '⚠️' : tone === 'ok' ? '✅' : tone === 'strong' ? '🪨' : 'ℹ️'}</span><span style={{ flex: 1 }}>{children}</span></div>;
};

export const GroupHeading: React.FC<{ icon: string; text: string; desc?: string }> = ({ icon, text, desc }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '8px 12px', borderLeft: `3px solid ${ACCENT}`, borderRadius: 10, background: 'linear-gradient(90deg, rgba(0,230,138,0.08), transparent)', margin: '2px 0' }}>
    <span style={{ fontSize: 12.5, fontWeight: 900, color: '#fff', letterSpacing: -0.1, display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 22, height: 22, borderRadius: 7, background: ACCENT_GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>{icon}</span>{text}</span>
    {desc && <span style={HINT_SM}>{desc}</span>}
  </div>
);

export const SectionNav: React.FC<{ items: { id: string; label: string }[]; activeId?: string; onSelect?: (id: string) => void }> = ({ items, activeId, onSelect }) => {
  const goTo = (id: string) => { if (onSelect) { onSelect(id); return; } const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  return <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: 4, background: 'rgba(0,0,0,0.20)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(10px)' }}>{items.map(n => {
    const active = activeId ? activeId === n.id : false;
    const isStrong = false;
    return <button key={n.id} onClick={() => goTo(n.id)} aria-pressed={active} style={{ padding: '8px 14px', borderRadius: 10, fontSize: 11.5, fontWeight: active ? 800 : 600, cursor: 'pointer', border: active ? '1px solid rgba(0,230,138,0.36)' : '1px solid transparent', background: active ? 'linear-gradient(135deg, rgba(0,230,138,0.18), rgba(14,165,233,0.10))' : 'transparent', color: active ? '#fff' : 'rgba(255,255,255,0.58)', boxShadow: active ? '0 2px 10px rgba(0,230,138,0.14), inset 0 1px 0 rgba(255,255,255,0.08)' : 'none', transition: 'all 0.18s ease', whiteSpace: 'nowrap' }}>{n.label}</button>;
  })}</div>;
};

export const ProgressBar: React.FC<{ value: number; max?: number; color?: string; height?: number }> = ({ value, max = 100, color = ACCENT, height = 8 }) => {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return <div style={{ height, borderRadius: height / 2, background: 'rgba(255,255,255,0.07)', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)', padding: 1 }}><div style={{ height: '100%', borderRadius: height / 2, width: pct + '%', background: `linear-gradient(90deg, ${color}, #0ea5e9)`, boxShadow: `0 0 10px ${color}55`, transition: 'width 0.45s cubic-bezier(0.25,0.46,0.45,0.94)', position: 'relative', overflow: 'hidden' }}><div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)', opacity: 0.65 }} /></div></div>;
};

export const Stepper: React.FC<{ label?: string; value: number; min?: number; max?: number; step?: number; onChange: (n: number) => void }> = ({ label, value, min, max, step = 1, onChange }) => (
  <div style={ROW}><span style={{ ...LABEL, minWidth: 0 }}>{label}</span><div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.22)', borderRadius: 12, padding: 4, border: '1px solid rgba(255,255,255,0.07)' }}><button aria-label="уменьшить" style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: min !== undefined && value <= min ? 0.35 : 1 }} onClick={() => onChange(Math.max(min ?? -Infinity, value - step))} disabled={min !== undefined && value <= min}>−</button><span style={{ fontSize: 15, fontWeight: 900, minWidth: 28, textAlign: 'center', color: '#fff' }}>{value}</span><button aria-label="увеличить" style={{ width: 32, height: 32, borderRadius: 9, border: 'none', background: ACCENT_GRAD, color: '#06281c', fontSize: 16, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,230,138,0.22)', opacity: max !== undefined && value >= max ? 0.35 : 1 }} onClick={() => onChange(Math.min(max ?? Infinity, value + step))} disabled={max !== undefined && value >= max}>+</button></div></div>
);

export const ChipToggle: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }> = ({ active, onClick, children, disabled }) => (
  <button style={{ ...(active ? CHIP_ACTIVE : CHIP), opacity: disabled ? 0.38 : 1 }} onClick={onClick} disabled={disabled} aria-pressed={active}>{children}</button>
);
export const ChipToggleStrong: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button style={{ ...(active ? CHIP_STRONG_ACTIVE : CHIP) }} onClick={onClick} aria-pressed={active}>{children}</button>
);

export const Field: React.FC<{ label?: string; hint?: string; error?: string; children: React.ReactNode }> = ({ label, hint, error, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 148px', minWidth: 0 }}>{label && <span style={LABEL}>{label}</span>}{children}{hint && !error && <span style={HINT_SM}>{hint}</span>}{error && <span style={{ fontSize: 11, color: '#f87171', fontWeight: 700 }}>⚠ {error}</span>}</div>
);

export const Divider: React.FC = () => <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)', margin: '4px 0' }} />;

export const CardHeader: React.FC<{ icon: string; title: string; subtitle?: string; right?: React.ReactNode; strong?: boolean }> = ({ icon, title, subtitle, right, strong }) => (
  <div style={ROW}><span style={{ width: 34, height: 34, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0, background: strong ? STRONG_GRAD : ACCENT_GRAD, boxShadow: strong ? '0 4px 14px rgba(245,158,11,0.22)' : '0 4px 14px rgba(0,230,138,0.22)' }}>{icon}</span><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 900, color: '#fff', lineHeight: 1.1, letterSpacing: -0.2 }}>{title}</div>{subtitle && <div style={{ fontSize: 11, color: TEXT_3, lineHeight: 1.2, marginTop: 1 }}>{subtitle}</div>}</div>{right}</div>
);
