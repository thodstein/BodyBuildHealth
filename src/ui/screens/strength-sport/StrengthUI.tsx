/**
 * StrengthUI.tsx — Apple-уровень UI-слой для силового экстрима/ТА (изумруд/янтарь/синий).
 * HIG: SF Pro, hairline 0.5, vibrancy 20px saturate 180%, как CombatUI/CardioUI.
 * Палитра: WL #00e68a (изумруд), Strongman #f59e0b (янтарь), Hybrid #3b82f6 (синий).
 */
import React from 'react';
import * as SharedAppleUI from '../../shared/apple-ui'; void SharedAppleUI.CARD;

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
export const TEXT_2 = 'rgba(235,235,245,0.60)';
export const TEXT_3 = 'rgba(235,235,245,0.30)';
export const SEPARATOR = 'rgba(84,84,88,0.36)';

export const RADIUS_LG = 14;
export const RADIUS_MD = 10;
export const RADIUS_SM = 8;

const SF = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif';

export const CARD: React.CSSProperties = {
  background: GLASS_BG,
  border: `0.5px solid ${GLASS_BORDER}`,
  borderRadius: RADIUS_LG,
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
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
  padding: 18,
  gap: 14,
};
export const ROW: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontFamily: SF };
export const COL: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 10, fontFamily: SF };
export const LABEL: React.CSSProperties = {
  fontSize: 11, color: TEXT_2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.06 * 11, lineHeight: 1, fontFamily: SF, display: 'flex', alignItems: 'center', gap: 6,
};
export const HINT: React.CSSProperties = { fontSize: 13, color: TEXT_2, lineHeight: 1.45, fontFamily: SF, fontWeight: 400 };
export const HINT_SM: React.CSSProperties = { fontSize: 11, color: TEXT_3, lineHeight: 1.4, fontFamily: SF };
export const BTN: React.CSSProperties = {
  padding: '11px 18px',
  borderRadius: RADIUS_MD,
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
  border: '0.5px solid rgba(84,84,88,0.36)',
  background: 'rgba(58,58,60,0.72)',
  color: TEXT_1,
  minHeight: 44,
  whiteSpace: 'nowrap',
  fontFamily: SF,
  letterSpacing: -0.01 * 15,
  transition: 'all 0.20s cubic-bezier(0.2,0,0,1)',
  backdropFilter: 'blur(20px)',
};
export const BTN_PRIMARY: React.CSSProperties = {
  ...BTN,
  background: ACCENT,
  border: 'none',
  color: '#000',
  boxShadow: '0 1px 3px rgba(0,0,0,0.30)',
  fontWeight: 600,
};
export const BTN_GHOST: React.CSSProperties = {
  ...BTN,
  background: 'rgba(0,230,138,0.12)',
  border: '0.5px solid rgba(0,230,138,0.24)',
  color: ACCENT,
};
export const BTN_SMALL: React.CSSProperties = { ...BTN, minHeight: 32, padding: '7px 12px', fontSize: 13, borderRadius: 8, fontWeight: 600 };
export const INPUT: React.CSSProperties = {
  background: 'rgba(58,58,60,0.72)',
  border: '0.5px solid rgba(84,84,88,0.36)',
  borderRadius: RADIUS_MD,
  padding: '10px 12px',
  color: TEXT_1,
  fontSize: 17,
  fontWeight: 400,
  fontFamily: SF,
  outline: 'none',
  width: '100%',
  transition: 'border-color 0.20s, background 0.20s',
  backdropFilter: 'blur(20px)',
};
export const CHIP: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 20,
  fontSize: 13,
  fontWeight: 590,
  cursor: 'pointer',
  border: '0.5px solid rgba(84,84,88,0.36)',
  background: 'rgba(58,58,60,0.72)',
  color: TEXT_1,
  whiteSpace: 'nowrap',
  minHeight: 34,
  fontFamily: SF,
  transition: 'all 0.18s cubic-bezier(0.2,0,0,1)',
};
export const CHIP_ACTIVE: React.CSSProperties = {
  ...CHIP,
  border: `0.5px solid ${ACCENT}`,
  background: ACCENT,
  color: '#000',
  boxShadow: '0 1px 3px rgba(0,0,0,0.20)',
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
}> = ({ id, title, subtitle, icon, right, accent, strong, hint, children }) => (
  <div className="kit-section" style={strong ? CARD_STRONG : accent ? CARD_ACCENT : CARD} id={id}>
    {title != null && (
      <div style={{ ...ROW, marginBottom: 2 }}>
        {icon && (
          <span style={{
            width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: strong ? ACCENT_STRONG : accent ? ACCENT : 'rgba(58,58,60,0.72)', border: `0.5px solid ${strong ? STRONG_BORDER : accent ? ACCENT_BORDER : SEPARATOR}`,
            fontSize: 14, flexShrink: 0, fontFamily: SF,
          }}>{icon}</span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: TEXT_1, letterSpacing: -0.02 * 15, fontFamily: SF }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: TEXT_2, fontFamily: SF, marginTop: 1, lineHeight: 1.35 }}>{subtitle}</div>}
        </div>
        {right}
      </div>
    )}
    {children}
    {hint && <div style={{ ...HINT, background: 'rgba(58,58,60,0.36)', border: `0.5px solid ${SEPARATOR}`, borderRadius: 8, padding: '8px 10px', fontSize: 12, lineHeight: 1.4 }}>{hint}</div>}
  </div>
);
export const StatTile: React.FC<{ label: string; value: string; color?: string; sub?: string; icon?: string }> = ({ label, value, color = ACCENT, sub, icon }) => (
  <div className="kit-stat" style={{
    flex: '1 1 110px', padding: '12px 12px', borderRadius: 12,
    background: 'rgba(58,58,60,0.48)', border: `0.5px solid ${SEPARATOR}`, display: 'flex', flexDirection: 'column', gap: 3,
    fontFamily: SF,
  }}>
    <span style={{ fontSize: 11, color: TEXT_2, textTransform: 'uppercase', letterSpacing: 0.06 * 11, fontWeight: 600, fontFamily: SF, display: 'flex', alignItems: 'center', gap: 4 }}>
      {icon && <span style={{ fontSize: 11 }}>{icon}</span>}{label}
    </span>
    <span style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1, letterSpacing: -0.02 * 22, fontFamily: SF, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    {sub && <span style={{ fontSize: 11, color: TEXT_3, fontFamily: SF }}>{sub}</span>}
  </div>
);
export const Badge: React.FC<{ color?: string; bg?: string; border?: string; icon?: string; children: React.ReactNode }> = ({ color = TEXT_1, bg = 'rgba(58,58,60,0.72)', border = SEPARATOR, icon, children }) => (
  <span style={{
    fontSize: 13, fontWeight: 590, color, background: bg, border: `0.5px solid ${border}`, borderRadius: 20,
    padding: '4px 10px', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4,
    fontFamily: SF, letterSpacing: -0.01 * 13,
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
      fontSize: 13, color: pal.color, background: pal.bg, border: `0.5px solid ${pal.border}`,
      borderRadius: 10, padding: '10px 12px', lineHeight: 1.45, fontFamily: SF, display: 'flex', gap: 8, alignItems: 'flex-start',
    }}>
      <span style={{ fontSize: 13, marginTop: 0, flexShrink: 0, fontFamily: SF }}>{pal.icon}</span>
      <span style={{ flex: 1, fontWeight: 400 }}>{children}</span>
    </div>
  );
};
export const GroupHeading: React.FC<{ icon: string; text: string; desc?: string; strong?: boolean }> = ({ icon, text, desc, strong }) => (
  <div className="kit-grouphead" style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '6px 0 6px 12px', borderLeft: `2px solid ${strong ? ACCENT_STRONG : ACCENT}`, margin: '4px 0', fontFamily: SF }}>
    <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_1, fontFamily: SF, display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 13 }}>{icon}</span>{text}
    </span>
    {desc && <span style={{ fontSize: 11, color: 'rgba(235,235,245,0.30)', lineHeight: 1.4, fontFamily: SF }}>{desc}</span>}
  </div>
);
export const ProgressBar: React.FC<{ value: number; max?: number; color?: string; height?: number }> = ({ value, max = 100, color = ACCENT, height = 4 }) => {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label="прогресс" className="kit-progress" style={{ height, borderRadius: height / 2, background: 'rgba(58,58,60,0.72)', overflow: 'hidden' }}>
      <div style={{ height: '100%', borderRadius: height / 2, width: pct + '%', background: color, transition: 'width 0.40s cubic-bezier(0.2,0,0,1)' }} />
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
    {label && <span style={{ fontSize: 11, color: 'rgba(235,235,245,0.60)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.06 * 11, lineHeight: 1, fontFamily: SF, display: 'flex', alignItems: 'center', gap: 6 }}>{label}</span>}
    {children}
    {hint && !error && <span style={{ fontSize: 11, color: 'rgba(235,235,245,0.30)', lineHeight: 1.4, fontFamily: SF }}>{hint}</span>}
    {error && <span style={{ fontSize: 12, color: '#FF3B30', fontWeight: 590, fontFamily: SF }}>⚠ {error}</span>}
  </div>
);
export const Highlight: React.FC<{ color?: string; children: React.ReactNode }> = ({ color = ACCENT, children }) => (
  <span style={{ background: `${color}14`, color, padding: '2px 6px', borderRadius: 6, fontWeight: 590, fontSize: '0.94em', fontFamily: SF, border: `0.5px solid ${color}18` }}>{children}</span>
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
  background: ACCENT_STRONG,
  border: 'none',
  color: '#fff',
  boxShadow: '0 1px 3px rgba(0,0,0,0.22)',
};
export const SELECT: React.CSSProperties = { ...INPUT, appearance: 'none' as any, cursor: 'pointer', fontSize: 15 };
export const CHIP_STRONG_ACTIVE: React.CSSProperties = {
  ...CHIP,
  border: `0.5px solid ${ACCENT_STRONG}`,
  background: ACCENT_STRONG,
  color: '#fff',
  boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
};
export const MODE_RU: Record<string, string> = { weightlifting: 'Тяжёлая атлетика', strongman: 'Силовой экстрим', hybrid: 'Гибрид' };
export const PHASE_RU: Record<string, string> = { accumulation: 'Накопление', intensification: 'Интенсификация', peaking: 'Пик', deload: 'Разгрузка', transition: 'Переход', taper: 'Тапер', integration: 'Интеграция' };
export const ZONE_RU: Record<string, string> = { optimal: 'Оптимум', caution: 'Внимание', dangerous: 'Перегруз', undertrained: 'Недотрен' };
export const EQUIP_RU: Record<string, string> = { barbell: 'Штанга', dumbbell: 'Гантели', machine: 'Тренажёр', cable: 'Блоки', other: 'Прочее', sled: 'Сани', specialty: 'Спецснаряд' };
export const MOBILITY_RU: Record<string, string> = { shoulder: 'Плечо', hip: 'Таз', knee: 'Колено', ankle: 'Голеностоп', wrist: 'Запястье', lower_back: 'Поясница', neck: 'Шея' };
export const SESSION_TAG_RU: Record<string, string> = { snatch_day: 'Рывок', clean_day: 'Толчок', strength_day: 'Сила', technique_day: 'Техника', pull_day: 'Тяги', accessory_day: 'Подсобка', overhead_day: 'Жим', deadlift_day: 'Тяга', event_day: 'Ивенты', squat_day: 'Присед', oly_day: 'Олимпийка' };

export const SectionNav: React.FC<{ items: { id: string; label: string }[]; activeId?: string; onSelect?: (id: string) => void }> = ({ items, activeId, onSelect }) => {
  const goTo = (id: string) => { if (onSelect) { onSelect(id); return; } const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  return (
    <div style={{ display: 'flex', gap: 6, padding: 4, background: 'rgba(58,58,60,0.72)', borderRadius: 10, border: `0.5px solid ${SEPARATOR}`, backdropFilter: VIBRANCY, WebkitBackdropFilter: VIBRANCY, alignSelf: 'flex-start', maxWidth: '100%', overflowX: 'auto' }}>
      {items.map(n => {
        const active = activeId ? activeId === n.id : false;
        return (
          <button key={n.id} onClick={() => goTo(n.id)} aria-pressed={active} style={{ padding: '6px 12px', borderRadius: 7, fontSize: 13, fontWeight: active ? 600 : 400, cursor: 'pointer', fontFamily: SF, border: 'none', background: active ? '#fff' : 'transparent', color: active ? '#000' : TEXT_2, boxShadow: active ? '0 1px 3px rgba(0,0,0,0.12)' : 'none', transition: 'all 0.20s cubic-bezier(0.2,0,0,1)', whiteSpace: 'nowrap', flexShrink: 0 }}>{n.label}</button>
        );
      })}
    </div>
  );
};

export const Divider: React.FC = () => <div style={{ height: 0.5, background: SEPARATOR, margin: '8px 0' }} />;

export const CardHeader: React.FC<{ icon: string; title: string; subtitle?: string; right?: React.ReactNode; strong?: boolean }> = ({ icon, title, subtitle, right, strong }) => (
  <div style={ROW}>
    <span style={{ width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0, fontFamily: SF, background: strong ? ACCENT_STRONG : ACCENT, color: '#fff', border: `0.5px solid ${strong ? STRONG_BORDER : ACCENT_BORDER}` }}>{icon}</span>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: TEXT_1, letterSpacing: -0.02 * 15, fontFamily: SF }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: TEXT_2, fontFamily: SF, marginTop: 1, lineHeight: 1.35 }}>{subtitle}</div>}
    </div>
    {right}
  </div>
);

export const HighlightStrong: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ background: `${ACCENT_STRONG}14`, color: ACCENT_STRONG, padding: '2px 6px', borderRadius: 6, fontWeight: 590, fontFamily: SF, border: `0.5px solid ${ACCENT_STRONG}18` }}>{children}</span>
);

// ─── Apple sheets ───
const POP_OVERLAY: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.38)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', padding: 0 };
const POP_SHEET: React.CSSProperties = { width: '100%', maxWidth: 420, maxHeight: '78vh', overflowY: 'auto', borderRadius: '16px 16px 0 0', background: '#1C1C1E', borderTop: `0.5px solid ${SEPARATOR}`, boxShadow: '0 -8px 32px rgba(0,0,0,0.32)', paddingBottom: 'max(16px, env(safe-area-inset-bottom))' };
const POP_HANDLE: React.CSSProperties = { width: 36, height: 5, borderRadius: 3, background: 'rgba(120,120,128,0.36)', margin: '8px auto 0' };
const popCardBtn: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 11, fontWeight: 600, textAlign: 'center', minHeight: 52, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2, fontFamily: SF,
  background: 'rgba(58,58,60,0.72)', border: `0.5px solid ${SEPARATOR}`, color: TEXT_2, transition: 'all 0.18s',
};

export const StrengthPopupSelect: React.FC<{ label: string; value: string | undefined; options: { id: string; label: string; desc?: string }[]; onChange: (v: string) => void; strong?: boolean }> = ({ label, value, options, onChange, strong }) => {
  const [open, setOpen] = React.useState(false);
  const sel = options.find(o => o.id === (value ?? ''));
  const accent = strong ? ACCENT_STRONG : ACCENT;
  return (
    <>
      <button onClick={() => setOpen(true)} style={popCardBtn} aria-haspopup="dialog" aria-label={label}>
        <span style={{ fontSize: 11, color: TEXT_2, textTransform: 'uppercase', letterSpacing: 0.06 * 11, fontWeight: 600, fontFamily: SF }}>{label}</span>
        <span style={{ fontSize: 15, color: strong ? '#f59e0b' : '#00e68a', fontWeight: 590, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: SF, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>{sel ? sel.label : 'Выбрать…'}<span style={{ fontSize: 10, color: TEXT_3 }}>▾</span></span>
      </button>
      {open && (
        <div style={POP_OVERLAY} onClick={() => setOpen(false)} role="presentation">
          <div onClick={e => e.stopPropagation()} style={POP_SHEET} role="dialog" aria-modal="true" aria-label={label}>
            <div style={POP_HANDLE} />
            <div style={{ padding: '12px 16px 8px', borderBottom: `0.5px solid ${SEPARATOR}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: TEXT_2, textAlign: 'center', fontFamily: SF, flex: 1 }}>{label}</div>
              {sel?.desc && <span style={{ fontSize: 11, color: TEXT_3, background: 'rgba(255,255,255,0.06)', padding: '3px 8px', borderRadius: 20, border: '0.5px solid rgba(255,255,255,0.08)', fontFamily: SF }}>{sel.desc}</span>}
            </div>
            <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {options.map(o => {
                const active = value === o.id;
                return (
                  <button key={o.id} onClick={() => { onChange(o.id); setOpen(false); }} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '12px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left' as const,
                    fontFamily: SF, background: active ? (strong ? 'rgba(245,158,11,0.12)' : 'rgba(0,230,138,0.12)') : 'transparent',
                    border: 'none', borderBottom: `0.5px solid ${SEPARATOR}`, transition: 'background 0.18s',
                  }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 17, fontWeight: active ? 600 : 400, color: active ? accent : TEXT_1, fontFamily: SF, display: 'flex', alignItems: 'center', gap: 8 }}>{o.label}{active && <span style={{ fontSize: 13, color: accent }}>✓</span>}</span>
                      {o.desc && <span style={{ fontSize: 12, color: active ? accent : TEXT_2, fontFamily: SF, marginTop: 2, display: 'block', lineHeight: 1.35, opacity: active ? 0.92 : 0.78 }}>{o.desc}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
            <div style={{ padding: '8px 16px' }}>
              <button onClick={() => setOpen(false)} style={{ width: '100%', padding: '12px', borderRadius: 10, background: 'rgba(58,58,60,0.72)', border: `0.5px solid ${SEPARATOR}`, color: TEXT_1, fontSize: 17, fontWeight: 590, fontFamily: SF, cursor: 'pointer' }}>Готово</button>
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
      <button onClick={() => { setEdit(String(value)); setOpen(true); }} style={popCardBtn} aria-haspopup="dialog">
        <span style={{ fontSize: 11, color: TEXT_2, textTransform: 'uppercase', letterSpacing: 0.06 * 11, fontWeight: 600, fontFamily: SF }}>{label}</span>
        <span style={{ fontSize: 17, color: accent, fontWeight: 600, fontFamily: SF, fontVariantNumeric: 'tabular-nums' }}>{value}{suffix ? ` ${suffix}` : ''}</span>
      </button>
      {open && (
        <div style={POP_OVERLAY} onClick={() => setOpen(false)} role="presentation">
          <div onClick={e => e.stopPropagation()} style={{ ...POP_SHEET, maxWidth: 360 }} role="dialog" aria-modal="true" aria-label={label}>
            <div style={POP_HANDLE} />
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 17, fontWeight: 600, color: TEXT_1, textAlign: 'center', fontFamily: SF }}>{label}</div>
              <input type="range" min={min ?? 0} max={max ?? 300} step={step} value={parseFloat(edit) || 0} onChange={e => setEdit(e.target.value)} style={{ width: '100%', accentColor: accent, height: 6, borderRadius: 999 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: TEXT_3, fontFamily: SF }}><span>{min ?? 0}</span><span>{max ?? 300}</span></div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="number" value={edit} onChange={e => setEdit(e.target.value)} style={{ flex: 1, padding: '11px 12px', borderRadius: 10, border: `0.5px solid ${SEPARATOR}`, background: 'rgba(58,58,60,0.72)', color: TEXT_1, fontSize: 17, fontWeight: 400, textAlign: 'center', outline: 'none', fontFamily: SF, fontVariantNumeric: 'tabular-nums' }} />
                {suffix && <span style={{ fontSize: 13, color: TEXT_2, fontFamily: SF }}>{suffix}</span>}
                <button onClick={() => { let v = parseFloat(edit); if (isNaN(v)) v = min ?? 0; if (min !== undefined) v = Math.max(min, v); if (max !== undefined) v = Math.min(max, v); onChange(v); setOpen(false); }} style={{ padding: '11px 22px', borderRadius: 10, border: 'none', background: accent, color: '#fff', fontWeight: 600, fontFamily: SF, cursor: 'pointer', minHeight: 44 }}>Готово</button>
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
    <div style={{ ...CARD_STRONG, padding: 14, gap: 10 }}>
      <div style={ROW}>
        <span style={{ width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: ACCENT_STRONG, fontSize: 14 }}>⛓️</span>
        <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700, color: TEXT_1, fontFamily: SF }}>{title}</div><div style={{ fontSize: 11, color: TEXT_2, fontFamily: SF }}>{subtitle} · <span style={{ color: ACCENT_STRONG }}>{totalDist}м / cap {medleyCap}с</span></div></div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {events.map(ev => (
          <div key={ev.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 12, fontWeight: 600, color: TEXT_1, fontFamily: SF }}>{ev.label} {ev.weight ? <span style={{ color: TEXT_3 }}>{ev.weight}кг</span> : null}</span><span style={{ fontSize: 10, color: TEXT_3, fontFamily: SF }}>{ev.distanceM}м · {ev.timeCapS}с</span></div>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', height: 22, borderRadius: 8, overflow: 'hidden', border: '0.5px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.18)' }}>
        {grouped.map((g, i) => (
          <div key={i} title={`${PHASE_RU[g.key] || g.key}: ${g.weeks}нед`} style={{ flex: g.weeks, background: g.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.12)' : 'none' }}>{g.weeks >= 2 ? (PHASE_RU[g.key] || g.key) : ''}</div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {grouped.map((g, i) => (
          <span key={i} style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4, color: TEXT_2, fontFamily: SF }}><span style={{ width: 10, height: 10, borderRadius: 3, background: g.color, display: 'inline-block' }} />{PHASE_RU[g.key] || g.key} {g.weeks}нед</span>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: TEXT_3, fontFamily: SF }}><span>Нед 1</span><span>Нед {total}</span></div>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map(row => (
        <div key={row.key} style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px 10px', borderRadius: 12, border: '0.5px solid rgba(255,255,255,0.04)' }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: row.strong ? ACCENT_STRONG : ACCENT, minWidth: 72, display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ fontSize: 11 }}>{row.icon}</span>{row.label}</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
            {weeksData.map(wk => {
              const cnt = row.unit === 'meters'
                ? wk.sessions.flatMap(s => s.exercises.filter(e => row.ids.includes(e.id))).reduce((a, e) => a + e.workSets.reduce((x, s) => x + ((s as any).distanceM || 20), 0), 0)
                : row.unit === 'lifts'
                  ? wk.sessions.flatMap(s => s.exercises.filter(e => row.ids.includes(e.id))).reduce((a, e) => a + e.workSets.reduce((x, s) => x + s.reps, 0), 0)
                  : wk.sessions.flatMap(s => s.exercises.filter(e => row.ids.includes(e.id))).reduce((a, e) => a + e.sets, 0);
              const col = cnt === 0 ? 'rgba(255,255,255,0.06)' : cnt < 10 ? '#f59e0b' : cnt < 20 ? '#eab308' : '#30d158';
              const bg = cnt === 0 ? 'rgba(255,255,255,0.03)' : col + '18';
              return <span key={wk.week} style={{ padding: '4px 8px', borderRadius: 10, background: bg, border: `0.5px solid ${col}22`, color: cnt === 0 ? TEXT_3 : col, fontSize: 10.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>Н{wk.week}: {cnt}{row.unit === 'meters' ? 'м' : ''}</span>;
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
