/**
 * CombatUI.tsx — единый UI-слой для единоборств (фиолетовая ветка).
 * Порт CardioUI (ACCENT #a855f7) с боевыми токенами фаз/дисциплин.
 * Все вкладки CombatConstructor используют эти примитивы.
 */
import React from 'react';

// ─── Токены ───
export const ACCENT = '#a855f7';
export const ACCENT_2 = '#ec4899';
export const ACCENT_SOFT = 'rgba(168,85,247,0.14)';
export const ACCENT_BORDER = 'rgba(168,85,247,0.45)';
export const ACCENT_HOVER = 'rgba(168,85,247,0.22)';
export const GLASS_BG = 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.015))';
export const GLASS_BORDER = 'rgba(255,255,255,0.08)';
export const SURFACE_0 = 'rgba(255,255,255,0.015)';
export const SURFACE_1 = 'rgba(255,255,255,0.035)';
export const TEXT_1 = '#ffffff';
export const TEXT_2 = 'rgba(255,255,255,0.72)';
export const TEXT_3 = 'rgba(255,255,255,0.45)';
export const RADIUS_LG = 16;
export const RADIUS_MD = 12;
export const SHADOW_CARD = '0 4px 20px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.05)';

export const CARD: React.CSSProperties = {
  background: GLASS_BG,
  border: `1px solid ${GLASS_BORDER}`,
  borderRadius: RADIUS_LG, padding: 14, display: 'flex', flexDirection: 'column', gap: 11,
  boxShadow: SHADOW_CARD, backdropFilter: 'blur(6px)',
};
export const CARD_ACCENT: React.CSSProperties = {
  ...CARD, borderColor: ACCENT_BORDER,
  background: 'linear-gradient(180deg, rgba(168,85,247,0.12), rgba(168,85,247,0.03))',
  boxShadow: '0 4px 24px rgba(168,85,247,0.14), inset 0 1px 0 rgba(255,255,255,0.06)',
};
export const ROW: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' };
export const COL: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8 };
export const LABEL: React.CSSProperties = { fontSize: 11, color: TEXT_1, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, lineHeight: 1 };
export const HINT: React.CSSProperties = { fontSize: 12, color: TEXT_2, lineHeight: 1.55 };
export const HINT_SM: React.CSSProperties = { fontSize: 11, color: TEXT_3, lineHeight: 1.5 };
export const BTN: React.CSSProperties = {
  padding: '9px 14px', borderRadius: 10, fontSize: 12, fontWeight: 750, cursor: 'pointer',
  border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.05)',
  color: TEXT_1, minHeight: 44, whiteSpace: 'nowrap',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 1px 6px rgba(0,0,0,0.2)', transition: 'all 0.15s ease',
};
export const BTN_PRIMARY: React.CSSProperties = { ...BTN, background: 'linear-gradient(180deg, rgba(168,85,247,0.22), rgba(168,85,247,0.14))', border: `1px solid ${ACCENT_BORDER}`, color: ACCENT };
export const BTN_SMALL: React.CSSProperties = { ...BTN, minHeight: 36, padding: '7px 12px', fontSize: 11, borderRadius: 9 };
export const INPUT: React.CSSProperties = {
  background: 'rgba(255,255,255,0.055)', border: '1px solid rgba(255,255,255,0.13)',
  borderRadius: 10, padding: '9px 11px', color: TEXT_1, fontSize: 13,
  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.18)', outline: 'none',
};
export const CHIP: React.CSSProperties = {
  padding: '7px 13px', borderRadius: 10, fontSize: 12, fontWeight: 650, cursor: 'pointer',
  border: '1px solid rgba(255,255,255,0.09)', background: SURFACE_1,
  color: TEXT_1, whiteSpace: 'nowrap', minHeight: 40, transition: 'all 0.15s ease',
};
export const CHIP_ACTIVE: React.CSSProperties = { ...CHIP, border: `1px solid ${ACCENT_BORDER}`, background: ACCENT_SOFT, color: TEXT_1, boxShadow: '0 0 10px rgba(168,85,247,0.16)' };

export const PHASE_COLOR: Record<string, string> = {
  accumulation: '#3b82f6', transmutation: '#a855f7', realization: '#ef4444', gpp: '#60a5fa', power: '#a855f7', taper: '#eab308', deload: '#f59e0b', conjugate: '#ec4899', transition: '#64748b',
};
export const DISCIPLINE_COLOR: Record<string, string> = {
  boxing: '#3b82f6', mma: '#a855f7', wrestling: '#ef4444', kickboxing: '#f59e0b', general: '#6b7280',
};
export const EQUIP_RU: Record<string,string> = { barbell:'Штанга', dumbbell:'Гантели', machine:'Тренажёр', cable:'Блоки', other:'Прочее' };
export const MOBILITY_RU: Record<string,string> = { shoulder:'Плечо', hip:'Таз', knee:'Колено', ankle:'Голеностоп', wrist:'Запястье', neck:'Шея', lower_back:'Поясница' };
export const LEVEL_RU: Record<string,string> = { beginner:'Новичок', intermediate:'Средний', advanced:'Продвинутый', enhanced:'На курсе' };
export const PHASE_RU: Record<string,string> = { accumulation:'Накопление', transmutation:'Трансформация', realization:'Реализация', gpp:'ОФП', power:'Сила', taper:'Тапер', deload:'Разгрузка', conjugate:'Сопряжённая', transition:'Переход', intensification:'Интенсификация', peaking:'Пик' };
export const ZONE_RU: Record<string,string> = { optimal:'Оптимум', caution:'Внимание', dangerous:'Перегруз', undertrained:'Недотрен' };
export const PERIODIZATION_RU: Record<string,string> = { atr_10:'ATR 5/3/2 (10 нед)', linear_12:'Линейная (12 нед)', conjugate:'Сопряжённая' };
export const SESSION_TAG_RU: Record<string,string> = { upper_power:'Верх тяж', lower_power:'Низ тяж', full_power:'Фулбоди тяж', full_conditioning:'Фулбоди+конд.', snatch_day:'Рывок', clean_day:'Толчок', strength_day:'Сила' };
export function ruLabel(map:Record<string,string>, key:string){ return (map as any)[key] ?? key; }

// ─── Компоненты ───
export const SectionCard: React.FC<{ id?: string; title?: React.ReactNode; right?: React.ReactNode; accent?: boolean; hint?: string; children: React.ReactNode }> = ({ id, title, right, accent, hint, children }) => (
  <div style={accent ? CARD_ACCENT : CARD} id={id}>
    {title != null && (
      <div style={ROW}>
        <span style={{ fontSize: 13, fontWeight: 850, color: '#fff', letterSpacing: 0.1 }}>{title}</span>
        <span style={{ flex: 1 }} />
        {right}
      </div>
    )}
    {children}
    {hint && <div style={HINT}>{hint}</div>}
  </div>
);

export const StatTile: React.FC<{ label: string; value: string; color?: string; sub?: string }> = ({ label, value, color = '#94a3b8', sub }) => (
  <div style={{ flex: '1 1 96px', padding: '10px 12px', borderRadius: 12, background: 'linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.02))', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 3 }}>
    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.42)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>{label}</span>
    <span style={{ fontSize: 18, fontWeight: 900, color, lineHeight: 1 }}>{value}</span>
    {sub && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)' }}>{sub}</span>}
  </div>
);

export const Badge: React.FC<{ color?: string; bg?: string; border?: string; children: React.ReactNode }> = ({ color = '#fff', bg = 'rgba(255,255,255,0.06)', border = 'rgba(255,255,255,0.12)', children }) => (
  <span style={{ fontSize: 11, fontWeight: 750, color, background: bg, border: `1px solid ${border}`, borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap' }}>{children}</span>
);

export const InfoBanner: React.FC<{ tone?: 'ok' | 'warn' | 'info'; children: React.ReactNode }> = ({ tone = 'info', children }) => {
  const pal = tone === 'warn' ? { color: '#fbbf24', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)' } : tone === 'ok' ? { color: '#4ade80', bg: 'rgba(168,85,247,0.07)', border: 'rgba(168,85,247,0.25)' } : { color: '#c4b5fd', bg: 'rgba(168,85,247,0.08)', border: 'rgba(168,85,247,0.28)' };
  return <div role="status" style={{ fontSize: 11, color: pal.color, background: pal.bg, border: `1px solid ${pal.border}`, borderRadius: 8, padding: '7px 10px' }}>{children}</div>;
};

export const GroupHeading: React.FC<{ icon: string; text: string; desc?: string }> = ({ icon, text, desc }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingTop: 6, borderLeft: `3px solid ${ACCENT}`, paddingLeft: 10, borderRadius: 4, background: 'linear-gradient(90deg, rgba(168,85,247,0.06), transparent)' }}>
    <span style={{ fontSize: 13, fontWeight: 850, color: ACCENT, letterSpacing: 0.1 }}>{icon} {text}</span>
    {desc && <span style={HINT_SM}>{desc}</span>}
  </div>
);

export const SectionNav: React.FC<{ items: { id: string; label: string }[]; activeId?: string; onSelect?: (id:string)=>void }> = ({ items, activeId, onSelect }) => {
  const goTo = (id: string) => {
    if(onSelect){ onSelect(id); return; }
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{items.map(n => {
    const active = activeId ? activeId===n.id : false;
    return <button key={n.id} style={{ ...(active? {...BTN_SMALL, background:'rgba(168,85,247,0.18)', borderColor:'rgba(168,85,247,0.35)', color:'#c4b5fd'}: BTN_SMALL), fontSize: 10 }} onClick={() => goTo(n.id)} aria-pressed={active}>{n.label}</button>;
  })}</div>;
};

export const ProgressBar: React.FC<{ value: number; max?: number; color?: string; height?: number }> = ({ value, max = 100, color = ACCENT, height = 6 }) => {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return <div style={{ height, borderRadius: height / 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}><div style={{ height, borderRadius: height / 2, width: pct + '%', background: color, transition: 'width 0.35s ease' }} /></div>;
};

export const Stepper: React.FC<{ label?: string; value: number; min?: number; max?: number; step?: number; onChange: (n: number) => void }> = ({ label, value, min, max, step = 1, onChange }) => (
  <div style={ROW}>
    {label && <span style={LABEL}>{label}</span>}
    <button style={{ ...BTN_SMALL, opacity: min !== undefined && value <= min ? 0.4 : 1 }} onClick={() => onChange(Math.max(min ?? -Infinity, value - step))} disabled={min !== undefined && value <= min}>−</button>
    <span style={{ fontSize: 14, fontWeight: 800, minWidth: 26, textAlign: 'center' }}>{value}</span>
    <button style={{ ...BTN_SMALL, opacity: max !== undefined && value >= max ? 0.4 : 1 }} onClick={() => onChange(Math.min(max ?? Infinity, value + step))} disabled={max !== undefined && value >= max}>+</button>
  </div>
);

export const ChipToggle: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }> = ({ active, onClick, children, disabled }) => (
  <button style={{ ...(active ? CHIP_ACTIVE : CHIP), opacity: disabled ? 0.4 : 1 }} onClick={onClick} disabled={disabled} aria-pressed={active}>{children}</button>
);

export const Field: React.FC<{ label?: string; hint?: string; error?: string; children: React.ReactNode }> = ({ label, hint, error, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 140px', minWidth: 0 }}>
    {label && <span style={LABEL}>{label}</span>}{children}{hint && !error && <span style={HINT_SM}>{hint}</span>}{error && <span style={{ fontSize: 10, color: '#f87171' }}>⚠ {error}</span>}
  </div>
);

export const Divider: React.FC = () => <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '2px 0' }} />;
