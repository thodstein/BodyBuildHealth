/**
 * CombatUI.tsx — Apple-уровень UI-слой для единоборств (фиолетовая ветка).
 * HIG: SF Pro, hairline 0.5, vibrancy 20px saturate 180%, spring motion, sheets.
 * Полный редизайн: попапы-карточки, заголовки, выделения — premium native.
 */
import React from 'react';
import * as SharedAppleUI from '../../shared/apple-ui'; void SharedAppleUI.CARD; // shared HIG tokens единый источник
import {
  bbCardChrome, bbIconTile, bbCardTitle,
  PlannerNestedCardContext, PLANNER_SUBCARD, plannerTitleText,
} from '../TrainingScreen_parts/training-ui';

// ─── Apple палитра (системные) ───
export const ACCENT = '#a855f7';
export const ACCENT_2 = '#ec4899';
export const ACCENT_3 = '#f59e0b';
export const ACCENT_GRAD = 'linear-gradient(135deg, #AF52DE 0%, #a855f7 100%)';
export const ACCENT_SOFT = 'rgba(175,82,222,0.12)';
export const ACCENT_BORDER = 'rgba(175,82,222,0.22)';
export const ACCENT_HAIRLINE = 'rgba(84,84,88,0.32)';

export const GLASS_BG = 'rgba(44,44,46,0.78)';
export const GLASS_BG_SOFT = 'rgba(58,58,60,0.36)';
export const GLASS_BORDER = 'rgba(84,84,88,0.36)';
export const GLASS_SHADOW = '0 1px 3px rgba(0,0,0,0.30), 0 4px 16px rgba(0,0,0,0.24)';
export const VIBRANCY = 'blur(20px) saturate(180%)';

export const TEXT_1 = '#FFFFFF';
export const TEXT_2 = '#fff';
export const TEXT_3 = '#fff';
export const SEPARATOR = 'rgba(84,84,88,0.36)';

export const RADIUS_LG = 14;
export const RADIUS_MD = 10;
export const RADIUS_SM = 8;

const SF = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif';

// Apple card — inset grouped, vibrancy, hairline
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
  boxShadow: '0 1px 3px rgba(0,0,0,0.30), 0 8px 24px rgba(175,82,222,0.12)',
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
  fontSize: 11, color: TEXT_2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.06 * 11, lineHeight: 1.2, fontFamily: SF, display: 'flex', alignItems: 'center', gap: 6,
};
export const HINT: React.CSSProperties = { fontSize: 13, color: TEXT_2, lineHeight: 1.45, fontFamily: SF, fontWeight: 400 };
export const HINT_SM: React.CSSProperties = { fontSize: 11, color: TEXT_3, lineHeight: 1.4, fontFamily: SF };

// Apple buttons — 16pt bold, 10pt radius, 52pt min (как в ТА/стронг)
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
  color: '#fff',
  boxShadow: '0 6px 20px rgba(168,85,247,0.28), inset 0 1px 0 rgba(255,255,255,0.25)',
  fontWeight: 800,
};

export const BTN_GHOST: React.CSSProperties = {
  ...BTN,
  background: 'rgba(175,82,222,0.12)',
  border: '0.5px solid rgba(175,82,222,0.24)',
  color: '#BF5AF2',
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

export const SELECT: React.CSSProperties = {
  ...INPUT,
  appearance: 'none' as any,
  cursor: 'pointer',
  fontSize: 15,
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
  color: '#fff',
  boxShadow: '0 4px 16px rgba(168,85,247,0.30), inset 0 1px 0 rgba(255,255,255,0.25)',
};

export const PHASE_COLOR: Record<string, string> = {
  accumulation: '#0A84FF',
  transmutation: '#AF52DE',
  realization: '#FF3B30',
  gpp: '#64D2FF',
  power: '#AF52DE',
  taper: '#FF9F0A',
  deload: '#FF9F0A',
  conjugate: '#FF375F',
  transition: '#8E8E93',
  intensification: '#FF6B22',
  peaking: '#FF3B30',
};
export const DISCIPLINE_COLOR: Record<string, string> = {
  boxing: '#0A84FF',
  mma: '#AF52DE',
  wrestling: '#FF3B30',
  kickboxing: '#FF9F0A',
  general: '#8E8E93',
};
export const EQUIP_RU: Record<string, string> = { barbell: 'Штанга', dumbbell: 'Гантели', machine: 'Тренажёр', cable: 'Блоки', sled: 'Сани', other: 'Прочее' };
export const MOBILITY_RU: Record<string, string> = { shoulder: 'Плечо', hip: 'Таз', knee: 'Колено', ankle: 'Голеностоп', wrist: 'Запястье', neck: 'Шея', lower_back: 'Поясница' };
export const LEVEL_RU: Record<string, string> = { beginner: 'Новичок', intermediate: 'Средний', advanced: 'Продвинутый', enhanced: 'На курсе' };
export const PHASE_RU: Record<string, string> = { accumulation: 'Накопление', transmutation: 'Трансформация', realization: 'Реализация', gpp: 'ОФП', power: 'Сила', taper: 'Тапер', deload: 'Разгрузка', conjugate: 'Сопряжённая', transition: 'Переход', intensification: 'Интенсификация', peaking: 'Пик' };
export const ZONE_RU: Record<string, string> = { optimal: 'Оптимум', caution: 'Внимание', dangerous: 'Перегруз', undertrained: 'Недотрен' };
export const PERIODIZATION_RU: Record<string, string> = { atr_10: 'ATR 5/3/2 · 10 нед', linear_12: 'Линейная · 12 нед', conjugate: 'Сопряжённая' };
export const SESSION_TAG_RU: Record<string, string> = { upper_power: 'Верх тяж', lower_power: 'Низ тяж', full_power: 'Фулбоди тяж', full_conditioning: 'Фулбоди+конд.', neck_grip: 'Шея+хват', snatch_day: 'Рывок', clean_day: 'Толчок', strength_day: 'Сила' };
export function ruLabel(map: Record<string, string>, key: string | undefined | null) { return key != null ? ((map as any)[key] ?? key) : ''; }

// ─── Apple компоненты ───

export const SectionCard: React.FC<{
  id?: string;
  title?: React.ReactNode;
  subtitle?: string;
  icon?: string;
  right?: React.ReactNode;
  accent?: boolean;
  hint?: string;
  children: React.ReactNode;
}> = ({ id, title, subtitle, icon, right, accent, hint, children }) => {
  /* Тот же кит, что в ББ-авто и ТА/стронг: иконка-тайл, заголовок 12.5/800,
     верхняя кромка акцента. Вложенная карточка (внутри CbSec) не рисует
     второй слой — становится плоским под-блоком, как внутри BB-карточек. */
  const parentTitle = React.useContext(PlannerNestedCardContext);
  const nested = parentTitle !== null;
  const ownTitle = plannerTitleText(title);
  const hideDupTitle = nested && ownTitle !== '' && ownTitle === parentTitle;
  const color = accent ? ACCENT : '#c4b5fd';
  const showTitle = title != null && !hideDupTitle;
  // Вложенная карточка с тем же заголовком, что у родителя (CbSec), — не второй
  // стеклянный слой, а плоский контент: шапку даёт CbSec, здесь только subtitle.
  const containerStyle: React.CSSProperties = nested
    ? (hideDupTitle ? { display: 'flex', flexDirection: 'column' } : { ...PLANNER_SUBCARD, display: 'flex', flexDirection: 'column' })
    : { ...bbCardChrome(color), marginBottom: 0, display: 'flex', flexDirection: 'column' };
  const head = showTitle ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', width: '100%' }}>
      {icon && <span aria-hidden style={bbIconTile(color)}>{icon}</span>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...bbCardTitle, display: 'flex', alignItems: 'center', gap: 6 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 10.5, color: '#fff', lineHeight: 1.45, marginTop: 2 }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  ) : null;
  return (
    <section id={id} className={nested ? 'kit-section kit-section--nested' : 'kit-section'} style={containerStyle}>
      {head}
      {hideDupTitle && subtitle ? (
        <div style={{ fontSize: 10.5, color: '#fff', lineHeight: 1.45, marginBottom: 8 }}>{subtitle}</div>
      ) : null}
      <div style={{ marginTop: head || (hideDupTitle && subtitle) ? 8 : 0 }}>
        <PlannerNestedCardContext.Provider value={ownTitle || parentTitle || ''}>
          {children}
        </PlannerNestedCardContext.Provider>
        {hint && (
          <div style={{ ...HINT, background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '8px 10px', fontSize: 10.5, lineHeight: 1.45, marginTop: 8 }}>{hint}</div>
        )}
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

export const InfoBanner: React.FC<{ tone?: 'ok' | 'warn' | 'info' | 'accent'; children: React.ReactNode }> = ({ tone = 'info', children }) => {
  const pal = tone === 'warn' ? { color: '#FF9F0A', bg: 'rgba(255,159,10,0.12)', border: 'rgba(255,159,10,0.24)', icon: '⚠️' }
    : tone === 'ok' ? { color: '#30D158', bg: 'rgba(48,209,88,0.10)', border: 'rgba(48,209,88,0.20)', icon: '✓' }
    : tone === 'accent' ? { color: '#BF5AF2', bg: 'rgba(175,82,222,0.10)', border: 'rgba(175,82,222,0.18)', icon: '◆' }
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

export const GroupHeading: React.FC<{ icon: string; text: string; desc?: string }> = ({ icon, text, desc }) => (
  <div className="kit-grouphead" style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '6px 0 6px 12px', borderLeft: `3px solid ${ACCENT}`, borderRadius: '0 10px 10px 0', background: 'rgba(168,85,247,0.05)', margin: '2px 0', fontFamily: SF }}>
    <span style={{ fontSize: 14, fontWeight: 700, color: TEXT_1, fontFamily: SF, display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 14 }}>{icon}</span>{text}
    </span>
    {desc && <span style={{ fontSize: 12, color: '#fff', lineHeight: 1.45, fontFamily: SF }}>{desc}</span>}
  </div>
);

export const SectionNav: React.FC<{ items: { id: string; label: string }[]; activeId?: string; onSelect?: (id: string) => void }> = ({ items, activeId, onSelect }) => {
  const goTo = (id: string) => {
    if (onSelect) { onSelect(id); return; }
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return (
    <div className="kit-sectionnav" style={{ display: 'flex', gap: 6, padding: 4, background: 'rgba(58,58,60,0.72)', borderRadius: 10, border: `0.5px solid ${SEPARATOR}`, backdropFilter: VIBRANCY, WebkitBackdropFilter: VIBRANCY, alignSelf: 'flex-start', maxWidth: '100%', overflowX: 'auto' }}>
      {items.map(n => {
        const active = activeId ? activeId === n.id : false;
        return (
          <button
            key={n.id}
            onClick={() => goTo(n.id)}
            aria-pressed={active}
            className="kit-sectionnav-opt"
            data-active={active}
            style={{
              padding: '6px 12px', borderRadius: 7, fontSize: 13, fontWeight: active ? 600 : 400, cursor: 'pointer', fontFamily: SF,
              border: 'none',
              background: active ? '#fff' : 'transparent',
              color: active ? '#000' : TEXT_2,
              boxShadow: active ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
              transition: 'all 0.20s cubic-bezier(0.2,0,0,1)', whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            {n.label}
          </button>
        );
      })}
    </div>
  );
};

export const ProgressBar: React.FC<{ value: number; max?: number; color?: string; height?: number }> = ({ value, max = 100, color = ACCENT, height = 8 }) => {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label="прогресс" className="kit-progress" style={{ height, borderRadius: height / 2, background: 'rgba(58,58,60,0.72)', overflow: 'hidden', border: '0.5px solid rgba(255,255,255,0.06)' }}>
      <div style={{
        height: '100%', borderRadius: height / 2, width: pct + '%',
        background: `linear-gradient(90deg, ${color}, ${color})`,
        boxShadow: `0 0 12px ${color}88`,
        transition: 'width 0.40s cubic-bezier(0.2,0,0,1)',
      }} />
    </div>
  );
};

export const Stepper: React.FC<{ label?: string; value: number; min?: number; max?: number; step?: number; onChange: (n: number) => void }> = ({ label, value, min, max, step = 1, onChange }) => (
  <div style={{ ...ROW, gap: 8, fontFamily: SF }}>
    {label && <span style={{ ...LABEL, minWidth: 0 }}>{label}</span>}
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(58,58,60,0.72)', borderRadius: 10, padding: 3, border: `0.5px solid ${SEPARATOR}` }}>
      <button
        aria-label="уменьшить"
        style={{
          width: 30, height: 30, borderRadius: 7, border: '0.5px solid rgba(84,84,88,0.36)', background: 'rgba(58,58,60,0.72)', color: TEXT_1,
          fontSize: 15, fontWeight: 400, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SF,
          opacity: min !== undefined && value <= min ? 0.32 : 1,
        }}
        onClick={() => onChange(Math.max(min ?? -Infinity, value - step))}
        disabled={min !== undefined && value <= min}
      >−</button>
      <span style={{ fontSize: 17, fontWeight: 590, minWidth: 28, textAlign: 'center', color: TEXT_1, fontFamily: SF, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      <button
        aria-label="увеличить"
        style={{
          width: 30, height: 30, borderRadius: 7, border: 'none', background: ACCENT, color: '#fff',
          fontSize: 15, fontWeight: 590, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SF,
          opacity: max !== undefined && value >= max ? 0.32 : 1,
        }}
        onClick={() => onChange(Math.min(max ?? Infinity, value + step))}
        disabled={max !== undefined && value >= max}
      >+</button>
    </div>
  </div>
);

export const ChipToggle: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean; icon?: string }> = ({ active, onClick, children, disabled, icon }) => (
  <button
    className="kit-chiptoggle cb-chip"
    data-active={active}
    style={{ ...(active ? CHIP_ACTIVE : CHIP), opacity: disabled ? 0.38 : 1, display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: SF, minHeight: 44 }}
    onClick={onClick} disabled={disabled} aria-pressed={active}
  >
    {icon && <span style={{ fontSize: 12 }}>{icon}</span>}{children}
  </button>
);

export const Field: React.FC<{ label?: string; hint?: string; error?: string; children: React.ReactNode }> = ({ label, hint, error, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 148px', minWidth: 0, fontFamily: SF }}>
    {label && <span style={LABEL}>{label}</span>}
    {children}
    {hint && !error && <span style={{ fontSize: 12, color: '#fff', lineHeight: 1.45, fontFamily: SF }}>{hint}</span>}
    {error && <span style={{ fontSize: 13, color: '#FF3B30', fontWeight: 600, fontFamily: SF }}>⚠ {error}</span>}
  </div>
);

export const Divider: React.FC = () => <div style={{ height: 0.5, background: SEPARATOR, margin: '8px 0' }} />;

export const GlassButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'ghost' | 'primary' | 'soft' }> = ({ variant = 'ghost', style, children, ...props }) => {
  const base = variant === 'primary' ? BTN_PRIMARY : variant === 'soft' ? { ...BTN, background: 'rgba(58,58,60,0.72)' } : BTN;
  return <button className="kit-glassbtn" data-variant={variant} style={{ ...base, ...style, fontFamily: SF }} {...props}>{children}</button>;
};

export const CardHeader: React.FC<{ icon: string; title: string; subtitle?: string; right?: React.ReactNode; accent?: boolean }> = ({ icon, title, subtitle, right, accent }) => (
  <div style={ROW}>
    <span style={{
      width: 36, height: 36, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0, fontFamily: SF,
      background: accent ? ACCENT_GRAD : 'rgba(58,58,60,0.72)',
      border: `0.5px solid ${accent ? ACCENT_BORDER : SEPARATOR}`,
      color: accent ? '#fff' : TEXT_1,
      boxShadow: accent ? '0 4px 14px rgba(168,85,247,0.30)' : 'none',
    }}>{icon}</span>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: TEXT_1, letterSpacing: -0.02 * 16, fontFamily: SF, lineHeight: 1.2 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 13, color: TEXT_2, fontFamily: SF, marginTop: 2, lineHeight: 1.4 }}>{subtitle}</div>}
    </div>
    {right}
  </div>
);

// ─── Apple выделения ───
export const Highlight: React.FC<{ color?: string; children: React.ReactNode }> = ({ color = ACCENT, children }) => (
  <span style={{ background: `${color}1A`, color, padding: '3px 8px', borderRadius: 8, fontWeight: 600, fontSize: '0.94em', fontFamily: SF, border: `0.5px solid ${color}22`, whiteSpace: 'nowrap' }}>{children}</span>
);
export const AccentText: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ color: ACCENT, fontWeight: 600, fontFamily: SF }}>{children}</span>
);

// ─── CbSwitch: красивый свитч вместо нативной галочки ───
export const CbSwitch: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string; tone?: 'violet' | 'red' }> = ({ checked, onChange, label, desc, tone = 'violet' }) => {
  const on = tone === 'red' ? '#ef4444' : ACCENT;
  const buzz = () => { try { (navigator as any)?.vibrate?.(8); } catch { /* no-op */ } };
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      data-on={checked ? 'true' : 'false'}
      onClick={() => { buzz(); onChange(!checked); }}
      className="cb-switch"
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
        borderRadius: 12, cursor: 'pointer', textAlign: 'left' as const, fontFamily: SF, minHeight: 52,
        background: checked ? `${on}1f` : 'rgba(255,255,255,0.03)',
        border: `1px solid ${checked ? `${on}55` : 'rgba(255,255,255,0.08)'}`,
        transition: 'all 0.18s',
      }}
      onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.98)'; }}
      onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = ''; }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: TEXT_1, display: 'block', lineHeight: 1.3 }}>{label}</span>
        {desc && <span style={{ fontSize: 11, color: TEXT_2, display: 'block', marginTop: 2, lineHeight: 1.35 }}>{desc}</span>}
      </span>
      <span aria-hidden style={{
        width: 52, height: 32, borderRadius: 999, flexShrink: 0, position: 'relative',
        background: checked ? `linear-gradient(135deg, ${on}, ${tone === 'red' ? '#f87171' : '#ec4899'})` : 'rgba(120,120,128,0.32)',
        boxShadow: checked ? `0 0 14px ${on}66, inset 0 1px 0 rgba(255,255,255,0.22)` : 'inset 0 1px 3px rgba(0,0,0,0.3)',
        transition: 'all 0.2s',
      }}>
        <span style={{
          position: 'absolute', top: 4, left: checked ? 24 : 4, width: 24, height: 24, borderRadius: '50%',
          background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.35)', transition: 'left 0.2s',
        }} />
      </span>
    </button>
  );
};

// ─── Попапы в стиле ББ-авто: центральный диалог, тёмная карточка ───
const CB_POP_ANIM = `@keyframes cbPopFadeW{from{opacity:0}to{opacity:1}}@keyframes cbPopSheetUpW{from{opacity:0;transform:translateY(8px) scale(0.98)}to{opacity:1;transform:none}}`;
const POP_OVERLAY: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(0,0,0,0.85)', padding: 0, animation: 'cbPopFadeW 0.20s ease',
};
const POP_SHEET: React.CSSProperties = {
  width: '88%', maxWidth: 420, maxHeight: '78vh', borderRadius: 16,
  background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden',
  display: 'flex', flexDirection: 'column', animation: 'cbPopSheetUpW 0.22s ease',
};
const POP_BAR = (accent: string): React.CSSProperties => ({ height: 3, flexShrink: 0, background: `linear-gradient(90deg, ${accent}, ${accent}cc)` });
const POP_BODY: React.CSSProperties = { padding: '14px 16px', overflowY: 'auto', maxHeight: 'calc(78vh - 3px)' };
const popLabelStyle: React.CSSProperties = { fontSize: 11, color: '#fff', fontWeight: 600, marginBottom: 2, overflowWrap: 'anywhere', wordBreak: 'break-word' };
const popCardBtn = (active: boolean, accent: string): React.CSSProperties => ({
  width: '100%', padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 11, fontWeight: 700,
  textAlign: 'left' as const, boxSizing: 'border-box' as const, minWidth: 0, maxWidth: '100%', overflow: 'hidden',
  background: active ? `${accent}1a` : 'rgba(255,255,255,0.03)',
  border: active ? `1px solid ${accent}59` : '1px solid rgba(255,255,255,0.06)',
  color: active ? accent : '#fff',
});

export const CombatPopupSelect: React.FC<{ label: string; value: string | undefined; options: { id: string; label: string; desc?: string }[]; onChange: (v: string) => void }> = ({ label, value, options, onChange }) => {
  const [open, setOpen] = React.useState(false);
  const sel = options.find(o => o.id === (value ?? ''));
  const accent = ACCENT;
  return (
    <>
      <button onClick={() => setOpen(true)} className="cb-pop-trig" style={popCardBtn(!!value, accent)} aria-haspopup="dialog" aria-label={label}>
        <div style={popLabelStyle}>{label}</div>
        <div style={{ fontSize: 12, color: value ? accent : '#fff', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{sel ? sel.label : 'Выбрать…'}</div>
      </button>
      {open && (
        <div className="cb-pop-backdrop" style={POP_OVERLAY} onClick={() => setOpen(false)} role="presentation">
          <style>{CB_POP_ANIM}</style>
          <div onClick={e => e.stopPropagation()} className="cb-pop-sheet" style={POP_SHEET} role="dialog" aria-modal="true" aria-label={label}>
            <div style={POP_BAR(accent)} />
            <div style={POP_BODY}>
              <div className="cb-pop-title" style={{ fontSize: 14, fontWeight: 700, color: accent, marginBottom: 10 }}>{label}</div>
              <div className="cb-pop-list" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {options.map(o => {
                  const active = value === o.id;
                  return (
                    <button key={o.id} onClick={() => { onChange(o.id); setOpen(false); }} className="cb-pop-opt" data-active={active ? 'true' : 'false'} style={{
                      display: 'block', width: '100%', padding: '10px 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left' as const,
                      fontSize: 11, fontWeight: active ? 700 : 400,
                      background: active ? `${accent}1f` : 'rgba(255,255,255,0.03)',
                      border: active ? `1px solid ${accent}4d` : '1px solid rgba(255,255,255,0.06)',
                      color: active ? accent : '#fff',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="cb-pop-optlabel">{o.label}</span>
                        {active && <span style={{ fontSize: 10 }}>✓</span>}
                      </div>
                      {o.desc && <div className="cb-pop-optdesc" style={{ fontSize: 9, color: '#fff', marginTop: 2, lineHeight: 1.4 }}>{o.desc}</div>}
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setOpen(false)} className="cb-pop-done" style={{ width: '100%', marginTop: 12, padding: '10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Готово</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const CombatPopupNumber: React.FC<{ label: string; value: number; min?: number; max?: number; step?: number; suffix?: string; onChange: (v: number) => void }> = ({ label, value, min, max, step = 1, suffix = '', onChange }) => {
  const [open, setOpen] = React.useState(false);
  const [edit, setEdit] = React.useState(String(value));
  const accent = ACCENT;
  React.useEffect(() => { if (!open) setEdit(String(value)); }, [value, open]);
  return (
    <>
      <button onClick={() => { setEdit(String(value)); setOpen(true); }} className="cb-pop-trig" style={popCardBtn(true, accent)} aria-haspopup="dialog" aria-label={`${label}: ${value}${suffix ? ' ' + suffix : ''}`}>
        <div style={popLabelStyle}>{label}</div>
        <div style={{ fontSize: 14, color: accent, overflowWrap: 'anywhere', wordBreak: 'break-word', fontVariantNumeric: 'tabular-nums' }}>{value}{suffix ? ` ${suffix}` : ''}</div>
      </button>
      {open && (
        <div className="cb-pop-backdrop" style={POP_OVERLAY} onClick={() => setOpen(false)} role="presentation">
          <style>{CB_POP_ANIM}</style>
          <div onClick={e => e.stopPropagation()} className="cb-pop-sheet" style={{ ...POP_SHEET, maxWidth: 360 }} role="dialog" aria-modal="true" aria-label={label}>
            <div style={POP_BAR(accent)} />
            <div style={POP_BODY}>
              <div className="cb-pop-numtitle" style={{ fontSize: 14, fontWeight: 700, color: accent, marginBottom: 10 }}>{label}</div>
              <input className="cb-pop-input" type="number" value={edit} min={min} max={max} step={step}
                onChange={e => setEdit(e.target.value)} autoFocus
                style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 16, boxSizing: 'border-box', textAlign: 'center', marginBottom: 12 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setOpen(false)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Отмена</button>
                <button onClick={() => { let v = parseFloat(edit); if (isNaN(v)) { setOpen(false); return; } if (min !== undefined) v = Math.max(min, v); if (max !== undefined) v = Math.min(max, v); onChange(v); setOpen(false); }} className="cb-pop-ok" style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, color: '#000', fontWeight: 700, fontSize: 12 }}>OK</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
