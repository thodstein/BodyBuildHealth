/**
 * StrengthUI.tsx — Apple-уровень UI-слой для силового экстрима/ТА (изумруд/янтарь/синий).
 * HIG: SF Pro, hairline 0.5, vibrancy 20px saturate 180%, как CombatUI/CardioUI.
 * Палитра: WL #00e68a (изумруд), Strongman #f59e0b (янтарь), Hybrid #3b82f6 (синий).
 */
import React from 'react';
import * as SharedAppleUI from '../../shared/apple-ui'; void SharedAppleUI.CARD;
import {
  bbCardChrome, bbIconTile, bbCardTitle,
  PlannerNestedCardContext, PLANNER_SUBCARD, plannerTitleText,
} from '../TrainingScreen_parts/training-ui';

export const ACCENT = '#00e68a';
export const ACCENT_STRONG = '#f59e0b';
export const ACCENT_HYBRID = '#3b82f6';
export const ACCENT_GRAD = 'linear-gradient(135deg, #00e68a 0%, #10b981 100%)';
export const ACCENT_GRAD_STRONG = 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)';
export const ACCENT_SOFT = 'rgba(0,230,138,0.12)';
export const ACCENT_BORDER = 'rgba(0,230,138,0.22)';
export const ACCENT_HAIRLINE = 'rgba(84,84,88,0.32)';

export const GLASS_BG = 'rgba(44,44,46,0.78)';
export const GLASS_BG_SOFT = 'rgba(58,58,60,0.36)';
export const GLASS_BORDER = 'rgba(84,84,88,0.36)';
export const GLASS_SHADOW = '0 1px 3px rgba(0,0,0,0.30), 0 4px 16px rgba(0,0,0,0.24)';
export const VIBRANCY = 'blur(20px) saturate(180%)';

export const TEXT_1 = '#FFFFFF';
// Белый текст везде (требование TOP-АПК): иерархия — размером/жирностью, не серым.
export const TEXT_2 = '#FFFFFF';
export const TEXT_3 = '#FFFFFF';
export const SEPARATOR = 'rgba(84,84,88,0.36)';

export const RADIUS_LG = 18;
export const RADIUS_MD = 14;
export const RADIUS_SM = 10;

const SF = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif';

export const CARD: React.CSSProperties = {
  background: GLASS_BG,
  border: `0.5px solid ${GLASS_BORDER}`,
  borderRadius: RADIUS_LG,
  padding: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  boxShadow: GLASS_SHADOW,
  backdropFilter: VIBRANCY,
  WebkitBackdropFilter: VIBRANCY,
  position: 'relative',
  overflow: 'hidden',
  fontFamily: SF,
};
export const CARD_ACCENT: React.CSSProperties = {
  ...CARD,
  background: 'rgba(44,44,46,0.82)',
  borderColor: ACCENT_BORDER,
  boxShadow: '0 1px 3px rgba(0,0,0,0.30), 0 8px 24px rgba(0,230,138,0.12)',
};
export const CARD_HERO: React.CSSProperties = {
  ...CARD,
  background: 'rgba(44,44,46,0.84)',
  borderColor: 'rgba(84,84,88,0.32)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.32), 0 1px 3px rgba(0,0,0,0.24)',
  padding: 12,
  gap: 8,
};
export const ROW: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontFamily: SF };
export const COL: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8, fontFamily: SF };
export const LABEL: React.CSSProperties = {
  fontSize: 11, color: TEXT_2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.06 * 11, lineHeight: 1, fontFamily: SF, display: 'flex', alignItems: 'center', gap: 6,
};
export const HINT: React.CSSProperties = { fontSize: 13, color: TEXT_2, lineHeight: 1.45, fontFamily: SF, fontWeight: 400 };
export const HINT_SM: React.CSSProperties = { fontSize: 11, color: TEXT_3, lineHeight: 1.4, fontFamily: SF };
export const BTN: React.CSSProperties = {
  padding: '14px 20px',
  borderRadius: RADIUS_MD,
  fontSize: 16,
  fontWeight: 700,
  cursor: 'pointer',
  border: '0.5px solid rgba(84,84,88,0.36)',
  background: 'rgba(58,58,60,0.72)',
  color: TEXT_1,
  minHeight: 52,
  whiteSpace: 'nowrap',
  fontFamily: SF,
  letterSpacing: -0.01 * 16,
  transition: 'all 0.20s cubic-bezier(0.2,0,0,1)',
  backdropFilter: 'blur(20px)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.22)',
};
export const BTN_PRIMARY: React.CSSProperties = {
  ...BTN,
  background: ACCENT_GRAD,
  border: 'none',
  color: '#06281c',
  boxShadow: '0 6px 20px rgba(0,230,138,0.28), inset 0 1px 0 rgba(255,255,255,0.25)',
  fontWeight: 800,
};
export const BTN_GHOST: React.CSSProperties = {
  ...BTN,
  background: 'rgba(0,230,138,0.12)',
  border: '0.5px solid rgba(0,230,138,0.24)',
  color: ACCENT,
  boxShadow: 'none',
};
export const BTN_SMALL: React.CSSProperties = { ...BTN, minHeight: 44, padding: '12px 16px', fontSize: 14, borderRadius: 10, fontWeight: 700 };
export const INPUT: React.CSSProperties = {
  background: 'rgba(58,58,60,0.72)',
  border: '0.5px solid rgba(84,84,88,0.36)',
  borderRadius: RADIUS_MD,
  padding: '13px 14px',
  color: TEXT_1,
  fontSize: 17,
  fontWeight: 400,
  fontFamily: SF,
  outline: 'none',
  width: '100%',
  minHeight: 52,
  transition: 'border-color 0.20s, background 0.20s',
  backdropFilter: 'blur(20px)',
};
export const CHIP: React.CSSProperties = {
  padding: '11px 18px',
  borderRadius: 22,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  border: '0.5px solid rgba(84,84,88,0.36)',
  background: 'rgba(58,58,60,0.72)',
  color: TEXT_1,
  whiteSpace: 'nowrap',
  minHeight: 44,
  fontFamily: SF,
  transition: 'all 0.18s cubic-bezier(0.2,0,0,1)',
};
export const CHIP_ACTIVE: React.CSSProperties = {
  ...CHIP,
  border: `0.5px solid ${ACCENT}`,
  background: ACCENT_GRAD,
  color: '#06281c',
  boxShadow: '0 4px 16px rgba(0,230,138,0.30), inset 0 1px 0 rgba(255,255,255,0.25)',
};
export const PHASE_COLOR: Record<string, string> = {
  accumulation: '#0A84FF',
  intensification: '#00e68a',
  integration: '#a855f7',
  peaking: '#FF3B30',
  deload: '#FF9F0A',
  transition: '#8E8E93',
  taper: '#FF9F0A',
};
export const MODE_COLOR: Record<string, string> = {
  weightlifting: '#00e68a',
  strongman: '#f59e0b',
  hybrid: '#3b82f6',
};
export const GOAL_RU: Record<string, string> = { strength:'Сила', hypertrophy:'Масса', peaking:'Пик', technique:'Техника', maintenance:'Поддержание' };
export const LEVEL_RU: Record<string, string> = { beginner:'Новичок', intermediate:'Средний', advanced:'Продвинутый', enhanced:'На курсе' };
export function ruLabel(map: Record<string, string>, key: string | undefined | null) { return key != null ? ((map as any)[key] ?? key) : ''; }

export const SectionCard: React.FC<{
  id?: string;
  title?: React.ReactNode;
  subtitle?: string;
  icon?: string;
  right?: React.ReactNode;
  accent?: boolean;
  strong?: boolean;
  hint?: string;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  summary?: React.ReactNode;
  status?: 'ok' | 'warn';
}> = ({ id, title, subtitle, icon, right, accent, strong, hint, children, collapsible, defaultOpen, summary, status }) => {
  const [open, setOpen] = React.useState(defaultOpen ?? true);
  const parentTitle = React.useContext(PlannerNestedCardContext);
  const nested = parentTitle !== null;
  const ownTitle = plannerTitleText(title);
  // Вложенная карточка с тем же заголовком, что у родителя, не дублирует его.
  const hideDupTitle = nested && ownTitle !== '' && ownTitle === parentTitle;
  const color = strong ? ACCENT_STRONG : accent ? ACCENT : '#a855f7';
  const dot = status ? (
    <span className="ss-sec-dot" data-s={status} aria-hidden style={{
      width: 8, height: 8, borderRadius: 99, flexShrink: 0,
      background: status === 'ok' ? '#00e68a' : '#f59e0b',
      boxShadow: status === 'ok' ? '0 0 10px rgba(0,230,138,0.6)' : '0 0 10px rgba(245,158,11,0.6)',
    }} />
  ) : null;
  const showTitle = title != null && !hideDupTitle;
  const head = showTitle ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', width: '100%' }}>
      {icon && <span aria-hidden style={bbIconTile(color)}>{icon}</span>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...bbCardTitle, display: 'flex', alignItems: 'center', gap: 6 }}>{dot}{title}</div>
        {(!collapsible || open) && subtitle && <div style={{ fontSize: 10.5, color: '#fff', lineHeight: 1.45, marginTop: 2 }}>{subtitle}</div>}
        {collapsible && !open && summary != null && <div className="ss-sec-sum" style={{ fontSize: 10.5, color: '#fff', marginTop: 2, lineHeight: 1.45, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontVariantNumeric: 'tabular-nums' }}>{summary}</div>}
      </div>
      {!collapsible && right}
    </div>
  ) : null;
  const chevron = collapsible ? (
    <span className="ss-sec-chev" data-open={open} aria-hidden style={{
      marginLeft: 'auto', fontSize: 11, color: '#fff', flexShrink: 0,
      display: 'inline-block', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease',
    }}>▾</span>
  ) : null;
  const hasHead = showTitle;
  const containerStyle: React.CSSProperties = nested
    ? { ...PLANNER_SUBCARD, display: 'flex', flexDirection: 'column' }
    : { ...bbCardChrome(color), marginBottom: 0, display: 'flex', flexDirection: 'column' };
  return (
    <section id={id} className={nested ? 'kit-section kit-section--nested' : 'kit-section'} data-ss={strong ? 'section-strong' : 'section'} style={containerStyle}>
      {collapsible ? (
        <button type="button" className="ss-sec-head" aria-expanded={open} onClick={() => setOpen((o) => !o)} style={{ width: '100%', background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer', textAlign: 'left', minHeight: 28, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontFamily: SF, WebkitTapHighlightColor: 'transparent' }}>
          {head}
          {chevron}
        </button>
      ) : head}
      {hideDupTitle && subtitle ? (
        <div style={{ fontSize: 10.5, color: '#fff', lineHeight: 1.45, marginTop: hasHead ? 6 : 0, marginBottom: 8 }}>{subtitle}</div>
      ) : null}
      <div className="ss-sec-body" data-open={open} style={collapsible ? { display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', opacity: open ? 1 : 0, transition: 'grid-template-rows 0.28s ease, opacity 0.2s ease', marginTop: open && hasHead ? 8 : 0 } : { marginTop: hasHead ? 8 : 0 }}>
        <div style={collapsible ? { minHeight: 0, overflow: 'hidden' } : undefined}>
          <PlannerNestedCardContext.Provider value={ownTitle || parentTitle || ''}>
            {children}
          </PlannerNestedCardContext.Provider>
          {hint && <div style={{ ...HINT, background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '8px 10px', fontSize: 10.5, lineHeight: 1.45, marginTop: 8 }}>{hint}</div>}
        </div>
      </div>
    </section>
  );
};
export const StatTile: React.FC<{ label: string; value: string; color?: string; sub?: string; icon?: string }> = ({ label, value, color = ACCENT, sub, icon }) => (
  <div className="kit-stat" style={{
    flex: '1 1 120px', padding: '14px', borderRadius: 16,
    background: 'linear-gradient(180deg, rgba(64,64,68,0.55), rgba(58,58,60,0.42))', border: `0.5px solid ${SEPARATOR}`, borderTop: `2px solid ${color}55`, display: 'flex', flexDirection: 'column', gap: 4,
    fontFamily: SF, boxShadow: '0 4px 14px rgba(0,0,0,0.22)',
  }}>
    <span style={{ fontSize: 11, color: TEXT_2, textTransform: 'uppercase', letterSpacing: 0.06 * 11, fontWeight: 700, fontFamily: SF, display: 'flex', alignItems: 'center', gap: 4 }}>
      {icon && <span style={{ fontSize: 12 }}>{icon}</span>}{label}
    </span>
    <span style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1, letterSpacing: -0.02 * 26, fontFamily: SF, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    {sub && <span style={{ fontSize: 12, color: TEXT_3, fontFamily: SF }}>{sub}</span>}
  </div>
);
export const Badge: React.FC<{ color?: string; bg?: string; border?: string; icon?: string; children: React.ReactNode }> = ({ color = TEXT_1, bg = 'rgba(58,58,60,0.72)', border = SEPARATOR, icon, children }) => (
  <span style={{
    fontSize: 13, fontWeight: 600, color, background: bg, border: `0.5px solid ${border}`, borderRadius: 22,
    padding: '6px 12px', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5,
    fontFamily: SF, letterSpacing: -0.01 * 13, lineHeight: 1.3,
  }}>{icon && <span style={{ fontSize: 12 }}>{icon}</span>}{children}</span>
);
export const InfoBanner: React.FC<{ tone?: 'ok' | 'warn' | 'info' | 'accent' | 'strong'; children: React.ReactNode }> = ({ tone = 'info', children }) => {
  const pal = tone === 'warn' ? { color: '#FF9F0A', bg: 'rgba(255,159,10,0.12)', border: 'rgba(255,159,10,0.24)', icon: '⚠️' }
    : tone === 'ok' ? { color: '#30D158', bg: 'rgba(48,209,88,0.10)', border: 'rgba(48,209,88,0.20)', icon: '✓' }
    : tone === 'accent' ? { color: ACCENT, bg: 'rgba(0,230,138,0.10)', border: 'rgba(0,230,138,0.18)', icon: '◆' }
    : tone === 'strong' ? { color: ACCENT_STRONG, bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.20)', icon: '★' }
    : { color: '#64D2FF', bg: 'rgba(100,210,255,0.10)', border: 'rgba(100,210,255,0.18)', icon: 'ℹ︎' };
  return (
    <div role="status" style={{
      fontSize: 14, color: pal.color, background: pal.bg, border: `0.5px solid ${pal.border}`,
      borderRadius: 14, padding: '12px 14px', lineHeight: 1.5, fontFamily: SF, display: 'flex', gap: 10, alignItems: 'flex-start',
      boxShadow: '0 2px 10px rgba(0,0,0,0.18)',
    }}>
      <span style={{ fontSize: 16, marginTop: 0, flexShrink: 0, fontFamily: SF }}>{pal.icon}</span>
      <span style={{ flex: 1, fontWeight: 400 }}>{children}</span>
    </div>
  );
};
export const GroupHeading: React.FC<{ icon: string; text: string; desc?: string; strong?: boolean }> = ({ icon, text, desc, strong }) => (
  <div className="kit-grouphead" style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '6px 0 6px 12px', borderLeft: `3px solid ${strong ? ACCENT_STRONG : ACCENT}`, borderRadius: '0 10px 10px 0', background: strong ? 'rgba(245,158,11,0.05)' : 'rgba(0,230,138,0.04)', margin: '2px 0', fontFamily: SF }}>
    <span style={{ fontSize: 14, fontWeight: 700, color: TEXT_1, fontFamily: SF, display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 14 }}>{icon}</span>{text}
    </span>
    {desc && <span style={{ fontSize: 12, color: '#fff', lineHeight: 1.45, fontFamily: SF }}>{desc}</span>}
  </div>
);
export const ProgressBar: React.FC<{ value: number; max?: number; color?: string; height?: number }> = ({ value, max = 100, color = ACCENT, height = 8 }) => {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label="прогресс" className="kit-progress" style={{ height, borderRadius: height / 2, background: 'rgba(58,58,60,0.72)', overflow: 'hidden', border: '0.5px solid rgba(255,255,255,0.06)' }}>
      <div style={{ height: '100%', borderRadius: height / 2, width: pct + '%', background: `linear-gradient(90deg, ${color}, ${color})`, boxShadow: `0 0 12px ${color}88`, transition: 'width 0.40s cubic-bezier(0.2,0,0,1)' }} />
    </div>
  );
};
export const ChipToggle: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean; icon?: string }> = ({ active, onClick, children, disabled, icon }) => (
  <button
    className="kit-chiptoggle"
    data-active={active}
    style={{ ...(active ? CHIP_ACTIVE : CHIP), opacity: disabled ? 0.38 : 1, display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: SF }}
    onClick={onClick} disabled={disabled} aria-pressed={active}
  >
    {icon && <span style={{ fontSize: 12 }}>{icon}</span>}{children}
  </button>
);
export const Field: React.FC<{ label?: string; hint?: string; error?: string; children: React.ReactNode }> = ({ label, hint, error, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 148px', minWidth: 0, fontFamily: SF }}>
    {label && <span style={{ fontSize: 11, color: '#fff', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.06 * 11, lineHeight: 1.2, fontFamily: SF, display: 'flex', alignItems: 'center', gap: 6 }}>{label}</span>}
    {children}
    {hint && !error && <span style={{ fontSize: 12, color: '#fff', lineHeight: 1.45, fontFamily: SF }}>{hint}</span>}
    {error && <span style={{ fontSize: 13, color: '#FF3B30', fontWeight: 600, fontFamily: SF }}>⚠ {error}</span>}
  </div>
);
export const Highlight: React.FC<{ color?: string; children: React.ReactNode }> = ({ color = ACCENT, children }) => (
  <span style={{ background: `${color}1A`, color, padding: '3px 8px', borderRadius: 8, fontWeight: 600, fontSize: '0.94em', fontFamily: SF, border: `0.5px solid ${color}22`, whiteSpace: 'nowrap' }}>{children}</span>
);

// ─── сильный (стронг) акцент-варианты ───
export const STRONG_GRAD = 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)';
export const STRONG_SOFT = 'rgba(245,158,11,0.12)';
export const STRONG_BORDER = 'rgba(245,158,11,0.20)';
export const CARD_STRONG: React.CSSProperties = {
  ...CARD,
  background: 'rgba(44,44,46,0.84)',
  borderColor: STRONG_BORDER,
  boxShadow: '0 1px 3px rgba(0,0,0,0.30), 0 8px 24px rgba(245,158,11,0.10)',
};
export const BTN_STRONG: React.CSSProperties = {
  ...BTN,
  background: ACCENT_GRAD_STRONG,
  border: 'none',
  color: '#fff',
  boxShadow: '0 6px 20px rgba(245,158,11,0.30), inset 0 1px 0 rgba(255,255,255,0.25)',
  fontWeight: 800,
};
export const SELECT: React.CSSProperties = { ...INPUT, appearance: 'none' as any, cursor: 'pointer', fontSize: 16, minHeight: 52 };
export const CHIP_STRONG_ACTIVE: React.CSSProperties = {
  ...CHIP,
  border: `0.5px solid ${ACCENT_STRONG}`,
  background: ACCENT_GRAD_STRONG,
  color: '#fff',
  boxShadow: '0 4px 16px rgba(245,158,11,0.30), inset 0 1px 0 rgba(255,255,255,0.25)',
};
export const MODE_RU: Record<string, string> = { weightlifting: 'Тяжёлая атлетика', strongman: 'Силовой экстрим', hybrid: 'Гибрид' };
export const PHASE_RU: Record<string, string> = { accumulation: 'Накопление', intensification: 'Интенсификация', peaking: 'Пик', deload: 'Разгрузка', transition: 'Переход', taper: 'Тапер', integration: 'Интеграция' };
export const ZONE_RU: Record<string, string> = { optimal: 'Оптимум', caution: 'Внимание', dangerous: 'Перегруз', undertrained: 'Недотрен' };
export const EQUIP_RU: Record<string, string> = { barbell: 'Штанга', dumbbell: 'Гантели', machine: 'Тренажёр', cable: 'Блоки', other: 'Прочее', sled: 'Сани', specialty: 'Спецснаряд' };
export const MOBILITY_RU: Record<string, string> = { shoulder: 'Плечо', hip: 'Таз', knee: 'Колено', ankle: 'Голеностоп', wrist: 'Запястье', lower_back: 'Поясница', neck: 'Шея' };
export const SESSION_TAG_RU: Record<string, string> = { snatch_day: 'Рывок', clean_day: 'Толчок', strength_day: 'Сила', technique_day: 'Техника', pull_day: 'Тяги', accessory_day: 'Подсобка', overhead_day: 'Жим', deadlift_day: 'Тяга', event_day: 'Ивенты', squat_day: 'Присед', oly_day: 'Олимпийка' };

export const SectionNav: React.FC<{ items: { id: string; label: string }[]; activeId?: string; onSelect?: (id: string) => void; numbered?: boolean; dividersAfter?: string[] }> = ({ items, activeId, onSelect, numbered, dividersAfter }) => {
  const goTo = (id: string) => { if (onSelect) { onSelect(id); return; } const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  return (
    <div style={{ display: 'flex', gap: 6, padding: 6, background: 'rgba(58,58,60,0.72)', borderRadius: 16, border: `0.5px solid ${SEPARATOR}`, backdropFilter: VIBRANCY, WebkitBackdropFilter: VIBRANCY, alignSelf: 'flex-start', maxWidth: '100%', overflowX: 'auto', scrollbarWidth: 'none', alignItems: 'center' }}>
      {items.map((n, i) => {
        const active = activeId ? activeId === n.id : false;
        return (
          <React.Fragment key={n.id}>
            <button onClick={() => goTo(n.id)} aria-pressed={active} aria-label={numbered ? `${i + 1}. ${n.label}` : n.label} style={{ padding: '10px 16px', borderRadius: 11, fontSize: 14, fontWeight: active ? 700 : 500, cursor: 'pointer', fontFamily: SF, border: 'none', background: active ? '#fff' : 'transparent', color: active ? '#000' : TEXT_2, boxShadow: active ? '0 2px 8px rgba(0,0,0,0.22)' : 'none', transition: 'all 0.20s cubic-bezier(0.2,0,0,1)', whiteSpace: 'nowrap', flexShrink: 0, minHeight: 44, fontVariantNumeric: 'tabular-nums' }}>{numbered ? `${i + 1} ${n.label}` : n.label}</button>
            {dividersAfter && dividersAfter.includes(n.id) && i < items.length - 1 && <span aria-hidden style={{ width: 1, height: 18, background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.14), transparent)', flexShrink: 0, margin: '0 2px' }} />}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export const Divider: React.FC = () => <div style={{ height: 0.5, background: SEPARATOR, margin: '8px 0' }} />;

export const CardHeader: React.FC<{ icon: string; title: string; subtitle?: string; right?: React.ReactNode; strong?: boolean }> = ({ icon, title, subtitle, right, strong }) => (
  <div style={ROW}>
    <span style={{ width: 36, height: 36, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0, fontFamily: SF, background: strong ? ACCENT_GRAD_STRONG : ACCENT_GRAD, color: strong ? '#fff' : '#06281c', border: `0.5px solid ${strong ? STRONG_BORDER : ACCENT_BORDER}`, boxShadow: strong ? '0 4px 14px rgba(245,158,11,0.30)' : '0 4px 14px rgba(0,230,138,0.28)' }}>{icon}</span>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: TEXT_1, letterSpacing: -0.02 * 16, fontFamily: SF, lineHeight: 1.2 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 13, color: TEXT_2, fontFamily: SF, marginTop: 2, lineHeight: 1.4 }}>{subtitle}</div>}
    </div>
    {right}
  </div>
);

export const HighlightStrong: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ background: `${ACCENT_STRONG}14`, color: ACCENT_STRONG, padding: '2px 6px', borderRadius: 6, fontWeight: 590, fontFamily: SF, border: `0.5px solid ${ACCENT_STRONG}18` }}>{children}</span>
);

// ─── Попапы в стиле ББ-авто: центральный диалог, тёмная карточка, акцент ───
const SS_POP_ANIM = `@keyframes ssPopFade{from{opacity:0}to{opacity:1}}@keyframes ssPopSheetUp{from{opacity:0;transform:translateY(8px) scale(0.98)}to{opacity:1;transform:none}}`;
const POP_OVERLAY: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', padding: 0, animation: 'ssPopFade 0.20s ease' };
const POP_SHEET: React.CSSProperties = { width: '88%', maxWidth: 420, maxHeight: '78vh', borderRadius: 16, background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden', display: 'flex', flexDirection: 'column', animation: 'ssPopSheetUp 0.22s ease' };
const POP_BAR = (accent: string): React.CSSProperties => ({ height: 3, flexShrink: 0, background: `linear-gradient(90deg, ${accent}, ${accent}cc)` });
const POP_BODY: React.CSSProperties = { padding: '14px 16px', overflowY: 'auto', maxHeight: 'calc(78vh - 3px)' };
const POP_TITLE = (accent: string): React.CSSProperties => ({ fontSize: 14, fontWeight: 700, color: accent, marginBottom: 10 });
const popLabelStyle: React.CSSProperties = { fontSize: 11, color: '#fff', fontWeight: 600, marginBottom: 2, overflowWrap: 'anywhere', wordBreak: 'break-word' };
const popCardBtn = (active: boolean, accent: string): React.CSSProperties => ({
  width: '100%', padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 11, fontWeight: 700,
  textAlign: 'left' as const, boxSizing: 'border-box' as const, minWidth: 0, maxWidth: '100%', overflow: 'hidden',
  background: active ? `${accent}1a` : 'rgba(255,255,255,0.03)',
  border: active ? `1px solid ${accent}59` : '1px solid rgba(255,255,255,0.06)',
  color: active ? accent : '#fff',
});

export const StrengthPopupSelect: React.FC<{ label: string; value: string | undefined; options: { id: string; label: string; desc?: string }[]; onChange: (v: string) => void; strong?: boolean }> = ({ label, value, options, onChange, strong }) => {
  const [open, setOpen] = React.useState(false);
  const sel = options.find(o => o.id === (value ?? ''));
  const accent = strong ? ACCENT_STRONG : ACCENT;
  return (
    <>
      <button onClick={() => setOpen(true)} style={popCardBtn(!!value, accent)} aria-haspopup="dialog" aria-label={label}>
        <div style={popLabelStyle}>{label}</div>
        <div style={{ fontSize: 12, color: value ? accent : '#fff', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{sel ? sel.label : 'Выбрать…'}</div>
      </button>
      {open && (
        <div className="ss-apk-backdrop" style={POP_OVERLAY} onClick={() => setOpen(false)} role="presentation">
          <style>{SS_POP_ANIM}</style>
          <div className="ss-apk-sheet" onClick={e => e.stopPropagation()} style={POP_SHEET} role="dialog" aria-modal="true" aria-label={label}>
            <div style={POP_BAR(accent)} />
            <div style={POP_BODY}>
              <div style={POP_TITLE(accent)}>{label}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {options.map(o => {
                  const active = value === o.id;
                  return (
                    <button key={o.id} className="ss-apk-option" onClick={() => { onChange(o.id); setOpen(false); }} style={{
                      display: 'block', width: '100%', padding: '10px 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left' as const,
                      fontSize: 11, fontWeight: active ? 700 : 400,
                      background: active ? `${accent}1f` : 'rgba(255,255,255,0.03)',
                      border: active ? `1px solid ${accent}4d` : '1px solid rgba(255,255,255,0.06)',
                      color: active ? accent : '#fff',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{o.label}</span>
                        {active && <span style={{ fontSize: 10 }}>✓</span>}
                      </div>
                      {o.desc && <div style={{ fontSize: 9, color: '#fff', marginTop: 2, lineHeight: 1.4 }}>{o.desc}</div>}
                    </button>
                  );
                })}
              </div>
              <button className="ss-apk-done" data-kind="close" onClick={() => setOpen(false)} style={{ width: '100%', marginTop: 12, padding: '10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Закрыть</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const StrengthPopupNumber: React.FC<{ label: string; value: number; min?: number; max?: number; step?: number; suffix?: string; onChange: (v: number) => void; strong?: boolean }> = ({ label, value, min, max, step = 1, suffix = '', onChange, strong }) => {
  const [open, setOpen] = React.useState(false);
  const [edit, setEdit] = React.useState(String(value));
  const accent = strong ? ACCENT_STRONG : ACCENT;
  React.useEffect(() => { if (!open) setEdit(String(value)); }, [value, open]);
  return (
    <>
      <button onClick={() => { setEdit(String(value)); setOpen(true); }} style={popCardBtn(true, accent)} aria-haspopup="dialog" aria-label={`${label}: ${value}${suffix ? ' ' + suffix : ''}`}>
        <div style={popLabelStyle}>{label}</div>
        <div style={{ fontSize: 14, color: accent, overflowWrap: 'anywhere', wordBreak: 'break-word', fontVariantNumeric: 'tabular-nums' }}>{value}{suffix ? ` ${suffix}` : ''}</div>
      </button>
      {open && (
        <div className="ss-apk-backdrop" style={POP_OVERLAY} onClick={() => setOpen(false)} role="presentation">
          <style>{SS_POP_ANIM}</style>
          <div className="ss-apk-sheet" onClick={e => e.stopPropagation()} style={{ ...POP_SHEET, maxWidth: 360 }} role="dialog" aria-modal="true" aria-label={label}>
            <div style={POP_BAR(accent)} />
            <div style={POP_BODY}>
              <div style={POP_TITLE(accent)}>{label}</div>
              <input type="number" value={edit} min={min} max={max} step={step}
                onChange={e => setEdit(e.target.value)} autoFocus
                style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 16, boxSizing: 'border-box', textAlign: 'center', marginBottom: 12 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setOpen(false)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Отмена</button>
                <button className="ss-apk-done" data-kind="ok" onClick={() => {
                  let v = parseFloat(edit);
                  if (isNaN(v)) { setOpen(false); return; }
                  if (min !== undefined) v = Math.max(min, v);
                  if (max !== undefined) v = Math.min(max, v);
                  onChange(v); setOpen(false);
                }} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, color: '#000', fontWeight: 700, fontSize: 12 }}>OK</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ─── EventCard + Gantt (как CardioUI) ───
export const EventCard: React.FC<{
  title?: string;
  subtitle?: string;
  events: { id: string; label: string; distanceM: number; timeCapS: number; weight?: number }[];
  onChange?: (id: string, patch: { distanceM?: number; timeCapS?: number }) => void;
  preview?: boolean;
}> = ({ title = 'Medley цепь — превью до сборки', subtitle = 'Дистанция 10-50м · cap 30-180с · 90с переход', events, onChange, preview }) => {
  const totalDist = events.reduce((a, e) => a + e.distanceM, 0);
  const totalCap = events.reduce((a, e) => a + e.timeCapS, 0);
  const medleyCap = Math.max(totalCap - 10, totalDist > 0 ? 60 : 0);
  return (
    <div data-ss="medley" style={{ ...CARD_STRONG, padding: 12, gap: 8 }}>
      <div style={ROW}>
        <span style={{ width: 30, height: 30, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: ACCENT_GRAD_STRONG, fontSize: 15, boxShadow: '0 4px 14px rgba(245,158,11,0.30)' }}>⛓️</span>
        <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 700, color: TEXT_1, fontFamily: SF, lineHeight: 1.2 }}>{title}</div><div style={{ fontSize: 12, color: TEXT_2, fontFamily: SF, marginTop: 2 }}>{subtitle} · <span style={{ color: ACCENT_STRONG, fontWeight: 700 }}>{totalDist}м / cap {medleyCap}с</span></div></div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {events.map(ev => (
          <div key={ev.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 14, fontWeight: 700, color: TEXT_1, fontFamily: SF }}>{ev.label} {ev.weight ? <span style={{ color: TEXT_3, fontWeight: 500 }}>{ev.weight}кг</span> : null}</span><span style={{ fontSize: 12, color: ACCENT_STRONG, fontFamily: SF, fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{ev.distanceM}м · {ev.timeCapS}с</span></div>
            {onChange ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><span style={LABEL}>Дистанция</span><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="range" min={10} max={50} step={5} value={ev.distanceM} onChange={e => onChange(ev.id, { distanceM: Number(e.target.value) })} style={{ flex: 1, accentColor: ACCENT_STRONG }} /><span style={{ fontSize: 11, color: ACCENT_STRONG, fontVariantNumeric: 'tabular-nums', minWidth: 32, textAlign: 'right' }}>{ev.distanceM}м</span></div></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><span style={LABEL}>Cap</span><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="range" min={30} max={180} step={10} value={ev.timeCapS} onChange={e => onChange(ev.id, { timeCapS: Number(e.target.value) })} style={{ flex: 1, accentColor: ACCENT_STRONG }} /><span style={{ fontSize: 11, color: ACCENT_STRONG, fontVariantNumeric: 'tabular-nums', minWidth: 36, textAlign: 'right' }}>{ev.timeCapS}с</span></div></div>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {preview && <div style={{ fontSize: 10, color: TEXT_3, background: 'rgba(245,158,11,0.08)', border: '0.5px solid rgba(245,158,11,0.16)', padding: '6px 8px', borderRadius: 8, fontFamily: SF }}>Превью medley до сборки · переход 5с между ивентами · cap {medleyCap}с</div>}
    </div>
  );
};

export const StrengthGantt: React.FC<{
  weeks: { week: number; phase: string; taper?: boolean; deload?: boolean }[];
  totalWeeks?: number;
}> = ({ weeks, totalWeeks }) => {
  const total = totalWeeks || weeks.length;
  const grouped: { key: string; weeks: number; color: string }[] = [];
  for (const w of weeks) {
    const key = (w as any).taper ? 'taper' : w.phase;
    const color = PHASE_COLOR[key] || '#636366';
    const last = grouped[grouped.length - 1];
    if (last && last.key === key) last.weeks++;
    else grouped.push({ key, weeks: 1, color });
  }
  return (
    <div data-ss="gantt" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', height: 32, borderRadius: 12, overflow: 'hidden', border: '0.5px solid rgba(255,255,255,0.10)', background: 'rgba(0,0,0,0.20)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}>
        {grouped.map((g, i) => (
          <div key={i} title={`${PHASE_RU[g.key] || g.key}: ${g.weeks}нед`} style={{ flex: g.weeks, background: `linear-gradient(180deg, ${g.color}, ${g.color}CC)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff', borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.14)' : 'none', textShadow: '0 1px 4px rgba(0,0,0,0.45)', fontFamily: SF }}>{g.weeks >= 2 ? (PHASE_RU[g.key] || g.key) : ''}</div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {grouped.map((g, i) => (
          <span key={i} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, color: TEXT_2, fontFamily: SF, fontWeight: 600, background: 'rgba(255,255,255,0.03)', padding: '5px 10px', borderRadius: 22, border: '0.5px solid rgba(255,255,255,0.06)' }}><span style={{ width: 12, height: 12, borderRadius: 4, background: g.color, display: 'inline-block', boxShadow: `0 0 8px ${g.color}66` }} />{PHASE_RU[g.key] || g.key} {g.weeks}нед</span>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: TEXT_3, fontFamily: SF, fontVariantNumeric: 'tabular-nums' }}><span>Нед 1</span><span>Нед {total}</span></div>
    </div>
  );
};

export const StrengthHeatmap: React.FC<{
  weeksData: { week: number; phase: string; totalSets?: number; totalTonnage?: number; sessions: { exercises: { id: string; sets: number; workSets: { reps: number; weight: number; distanceM?: number }[] }[] }[] }[];
  level: string;
}> = ({ weeksData, level }) => {
  const rows: { key: string; label: string; icon: string; ids: string[]; unit: 'meters' | 'sets' | 'lifts'; strong?: boolean }[] = [
    { key: 'carry', label: 'Переноски', icon: '🚜', ids: ['yoke_walk', 'farmers_walk_heavy', 'frame_carry', 'husafell_carry', 'zercher_carry', 'sandbag_carry'], unit: 'meters', strong: true },
    { key: 'stone', label: 'Камни', icon: '🪨', ids: ['atlas_stone_load', 'stone_lift', 'sandbag_shoulder', 'sandbag_load', 'keg_toss'], unit: 'lifts', strong: true },
    { key: 'overhead', label: 'Жим', icon: '🪵', ids: ['log_press', 'axle_press', 'ohp', 'push_press', 'circus_db_press', 'bench_bar', 'pin_press'], unit: 'sets' },
    { key: 'squat_deadlift', label: 'Присед+Тяга', icon: '🦵', ids: ['back_squat', 'front_squat', 'squat', 'hack_squat', 'deadlift', 'sumo_dl', 'axle_deadlift', 'car_deadlift_18', 'rdl'], unit: 'sets' },
  ];
  return (
    <div data-ss="heatmap" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.map(row => (
        <div key={row.key} style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'rgba(255,255,255,0.025)', padding: '10px 12px', borderRadius: 16, border: '0.5px solid rgba(255,255,255,0.05)' }}>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase', color: row.strong ? ACCENT_STRONG : ACCENT, minWidth: 76, display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ fontSize: 13 }}>{row.icon}</span>{row.label}</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1 }}>
            {weeksData.map(wk => {
              const cnt = row.unit === 'meters'
                ? wk.sessions.flatMap(s => s.exercises.filter(e => row.ids.includes(e.id))).reduce((a, e) => a + e.workSets.reduce((x, s) => x + ((s as any).distanceM || 20), 0), 0)
                : row.unit === 'lifts'
                  ? wk.sessions.flatMap(s => s.exercises.filter(e => row.ids.includes(e.id))).reduce((a, e) => a + e.workSets.reduce((x, s) => x + s.reps, 0), 0)
                  : wk.sessions.flatMap(s => s.exercises.filter(e => row.ids.includes(e.id))).reduce((a, e) => a + e.sets, 0);
              const col = cnt === 0 ? 'rgba(255,255,255,0.06)' : cnt < 10 ? '#f59e0b' : cnt < 20 ? '#eab308' : '#30d158';
              const bg = cnt === 0 ? 'rgba(255,255,255,0.03)' : col + '1F';
              return <span key={wk.week} style={{ padding: '6px 10px', borderRadius: 12, background: bg, border: `0.5px solid ${col}30`, color: cnt === 0 ? TEXT_3 : col, fontSize: 12, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>Н{wk.week}: {cnt}{row.unit === 'meters' ? 'м' : ''}</span>;
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
