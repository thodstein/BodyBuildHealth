/**
 * CombatUI.tsx — Apple-уровень UI-слой для единоборств (фиолетовая ветка).
 * HIG: SF Pro, hairline 0.5, vibrancy 20px saturate 180%, spring motion, sheets.
 * Полный редизайн: попапы-карточки, заголовки, выделения — premium native.
 */
import React from 'react';
import * as SharedAppleUI from '../../../shared/apple-ui'; void SharedAppleUI.CARD; // shared HIG tokens единый источник

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
export const TEXT_2 = 'rgba(235,235,245,0.60)';
export const TEXT_3 = 'rgba(235,235,245,0.30)';
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
  boxShadow: '0 1px 3px rgba(0,0,0,0.30), 0 8px 24px rgba(175,82,222,0.12)',
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

// Apple buttons — 15pt, semibold, 10pt radius, 44pt min
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
  color: '#fff',
  boxShadow: '0 1px 3px rgba(0,0,0,0.30)',
  fontWeight: 600,
};

export const BTN_GHOST: React.CSSProperties = {
  ...BTN,
  background: 'rgba(175,82,222,0.12)',
  border: '0.5px solid rgba(175,82,222,0.24)',
  color: '#BF5AF2',
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

export const SELECT: React.CSSProperties = {
  ...INPUT,
  appearance: 'none' as any,
  cursor: 'pointer',
  fontSize: 15,
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
  color: '#fff',
  boxShadow: '0 1px 3px rgba(0,0,0,0.20)',
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
export const SESSION_TAG_RU: Record<string, string> = { upper_power: 'Верх тяж', lower_power: 'Низ тяж', full_power: 'Фулбоди тяж', full_conditioning: 'Фулбоди+конд.', snatch_day: 'Рывок', clean_day: 'Толчок', strength_day: 'Сила' };
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
}> = ({ id, title, subtitle, icon, right, accent, hint, children }) => (
  <div style={accent ? CARD_ACCENT : CARD} id={id}>
    {title != null && (
      <div style={{ ...ROW, marginBottom: 2 }}>
        {icon && (
          <span style={{
            width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: accent ? ACCENT : 'rgba(58,58,60,0.72)', border: `0.5px solid ${accent ? ACCENT_BORDER : SEPARATOR}`,
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
  <div style={{
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

export const InfoBanner: React.FC<{ tone?: 'ok' | 'warn' | 'info' | 'accent'; children: React.ReactNode }> = ({ tone = 'info', children }) => {
  const pal = tone === 'warn' ? { color: '#FF9F0A', bg: 'rgba(255,159,10,0.12)', border: 'rgba(255,159,10,0.24)', icon: '⚠️' }
    : tone === 'ok' ? { color: '#30D158', bg: 'rgba(48,209,88,0.10)', border: 'rgba(48,209,88,0.20)', icon: '✓' }
    : tone === 'accent' ? { color: '#BF5AF2', bg: 'rgba(175,82,222,0.10)', border: 'rgba(175,82,222,0.18)', icon: '◆' }
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

export const GroupHeading: React.FC<{ icon: string; text: string; desc?: string }> = ({ icon, text, desc }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '6px 0 6px 12px', borderLeft: `2px solid ${ACCENT}`, margin: '4px 0', fontFamily: SF }}>
    <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_1, fontFamily: SF, display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 13 }}>{icon}</span>{text}
    </span>
    {desc && <span style={HINT_SM}>{desc}</span>}
  </div>
);

export const SectionNav: React.FC<{ items: { id: string; label: string }[]; activeId?: string; onSelect?: (id: string) => void }> = ({ items, activeId, onSelect }) => {
  const goTo = (id: string) => {
    if (onSelect) { onSelect(id); return; }
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return (
    <div style={{ display: 'flex', gap: 6, padding: 4, background: 'rgba(58,58,60,0.72)', borderRadius: 10, border: `0.5px solid ${SEPARATOR}`, backdropFilter: VIBRANCY, WebkitBackdropFilter: VIBRANCY, alignSelf: 'flex-start', maxWidth: '100%', overflowX: 'auto' }}>
      {items.map(n => {
        const active = activeId ? activeId === n.id : false;
        return (
          <button
            key={n.id}
            onClick={() => goTo(n.id)}
            aria-pressed={active}
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

export const ProgressBar: React.FC<{ value: number; max?: number; color?: string; height?: number }> = ({ value, max = 100, color = ACCENT, height = 4 }) => {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label="прогресс" style={{ height, borderRadius: height / 2, background: 'rgba(58,58,60,0.72)', overflow: 'hidden' }}>
      <div style={{
        height: '100%', borderRadius: height / 2, width: pct + '%',
        background: color,
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
    style={{ ...(active ? CHIP_ACTIVE : CHIP), opacity: disabled ? 0.38 : 1, display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: SF }}
    onClick={onClick} disabled={disabled} aria-pressed={active}
  >
    {icon && <span style={{ fontSize: 12 }}>{icon}</span>}{children}
  </button>
);

export const Field: React.FC<{ label?: string; hint?: string; error?: string; children: React.ReactNode }> = ({ label, hint, error, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 148px', minWidth: 0, fontFamily: SF }}>
    {label && <span style={LABEL}>{label}</span>}
    {children}
    {hint && !error && <span style={HINT_SM}>{hint}</span>}
    {error && <span style={{ fontSize: 12, color: '#FF3B30', fontWeight: 590, fontFamily: SF }}>⚠ {error}</span>}
  </div>
);

export const Divider: React.FC = () => <div style={{ height: 0.5, background: SEPARATOR, margin: '8px 0' }} />;

export const GlassButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'ghost' | 'primary' | 'soft' }> = ({ variant = 'ghost', style, children, ...props }) => {
  const base = variant === 'primary' ? BTN_PRIMARY : variant === 'soft' ? { ...BTN, background: 'rgba(58,58,60,0.72)' } : BTN;
  return <button style={{ ...base, ...style, fontFamily: SF }} {...props}>{children}</button>;
};

export const CardHeader: React.FC<{ icon: string; title: string; subtitle?: string; right?: React.ReactNode; accent?: boolean }> = ({ icon, title, subtitle, right, accent }) => (
  <div style={ROW}>
    <span style={{
      width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0, fontFamily: SF,
      background: accent ? ACCENT : 'rgba(58,58,60,0.72)',
      border: `0.5px solid ${accent ? ACCENT_BORDER : SEPARATOR}`,
      color: accent ? '#fff' : TEXT_1,
    }}>{icon}</span>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: TEXT_1, letterSpacing: -0.02 * 15, fontFamily: SF }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: TEXT_2, fontFamily: SF, marginTop: 1, lineHeight: 1.35 }}>{subtitle}</div>}
    </div>
    {right}
  </div>
);

// ─── Apple выделения ───
export const Highlight: React.FC<{ color?: string; children: React.ReactNode }> = ({ color = ACCENT, children }) => (
  <span style={{ background: `${color}14`, color, padding: '2px 6px', borderRadius: 6, fontWeight: 590, fontSize: '0.94em', fontFamily: SF, border: `0.5px solid ${color}18` }}>{children}</span>
);
export const AccentText: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ color: ACCENT, fontWeight: 600, fontFamily: SF }}>{children}</span>
);

// ─── Apple sheets (попапы) ───
const POP_OVERLAY: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  background: 'rgba(0,0,0,0.38)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', padding: 0,
};
const POP_SHEET: React.CSSProperties = {
  width: '100%', maxWidth: 420, maxHeight: '78vh', overflowY: 'auto', borderRadius: '16px 16px 0 0',
  background: '#1C1C1E', borderTop: `0.5px solid ${SEPARATOR}`,
  boxShadow: '0 -8px 32px rgba(0,0,0,0.32)', paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
};
const POP_HANDLE: React.CSSProperties = { width: 36, height: 5, borderRadius: 3, background: 'rgba(120,120,128,0.36)', margin: '8px auto 0' };
const popCardBtn: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 11, fontWeight: 600, textAlign: 'center', minHeight: 52,
  display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2, fontFamily: SF,
  background: 'rgba(58,58,60,0.72)', border: `0.5px solid ${SEPARATOR}`, color: TEXT_2, transition: 'all 0.18s',
};

export const CombatPopupSelect: React.FC<{ label: string; value: string | undefined; options: { id: string; label: string; desc?: string }[]; onChange: (v: string) => void }> = ({ label, value, options, onChange }) => {
  const [open, setOpen] = React.useState(false);
  const sel = options.find(o => o.id === (value ?? ''));
  return (
    <>
      <button onClick={() => setOpen(true)} style={popCardBtn} aria-haspopup="dialog" aria-label={label}>
        <span style={{ fontSize: 11, color: TEXT_2, textTransform: 'uppercase', letterSpacing: 0.06 * 11, fontWeight: 600, fontFamily: SF }}>{label}</span>
        <span style={{ fontSize: 15, color: '#BF5AF2', fontWeight: 590, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: SF, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>{sel ? sel.label : 'Выбрать…'}<span style={{ fontSize: 10, color: TEXT_3 }}>▾</span></span>
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
                    fontFamily: SF, background: active ? 'rgba(175,82,222,0.12)' : 'transparent',
                    border: 'none', borderBottom: `0.5px solid ${SEPARATOR}`,
                  }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 17, fontWeight: active ? 600 : 400, color: active ? '#BF5AF2' : TEXT_1, display: 'flex', alignItems: 'center', gap: 8 }}>{o.label}{active && <span style={{ fontSize: 13, color: '#BF5AF2' }}>✓</span>}</span>
                      {o.desc && <span style={{ fontSize: 12, color: active ? '#BF5AF2' : TEXT_2, display: 'block', marginTop: 2, lineHeight: 1.35, opacity: active ? 0.92 : 0.78 }}>{o.desc}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
            {sel?.desc && <div style={{ margin: '0 8px', padding: '8px 12px', fontSize: 12, color: TEXT_2, background: 'rgba(175,82,222,0.08)', border: '0.5px solid rgba(175,82,222,0.12)', borderRadius: 8, fontFamily: SF, lineHeight: 1.4 }}>{sel.desc}</div>}
            <div style={{ padding: '8px 16px' }}>
              <button onClick={() => setOpen(false)} style={{ width: '100%', padding: '12px', borderRadius: 10, background: 'rgba(58,58,60,0.72)', border: `0.5px solid ${SEPARATOR}`, color: TEXT_1, fontSize: 17, fontWeight: 590, fontFamily: SF, cursor: 'pointer' }}>Готово</button>
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
  React.useEffect(() => { if (!open) setEdit(String(value)); }, [value, open]);
  return (
    <>
      <button onClick={() => { setEdit(String(value)); setOpen(true); }} style={popCardBtn} aria-haspopup="dialog">
        <span style={{ fontSize: 11, color: TEXT_2, textTransform: 'uppercase', letterSpacing: 0.06 * 11, fontWeight: 600, fontFamily: SF }}>{label}</span>
        <span style={{ fontSize: 17, color: '#BF5AF2', fontWeight: 600, fontFamily: SF, fontVariantNumeric: 'tabular-nums' }}>{value}{suffix ? ` ${suffix}` : ''}</span>
      </button>
      {open && (
        <div style={POP_OVERLAY} onClick={() => setOpen(false)} role="presentation">
          <div onClick={e => e.stopPropagation()} style={{ ...POP_SHEET, maxWidth: 360 }} role="dialog" aria-modal="true" aria-label={label}>
            <div style={POP_HANDLE} />
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 17, fontWeight: 600, color: TEXT_1, textAlign: 'center', fontFamily: SF }}>{label}</div>
              <input type="range" min={min ?? 0} max={max ?? 300} step={step} value={parseFloat(edit) || 0} onChange={e => setEdit(e.target.value)} style={{ width: '100%', accentColor: ACCENT, height: 6, borderRadius: 999 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: TEXT_3, fontFamily: SF }}><span>{min ?? 0}</span><span>{max ?? 300}</span></div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="number" value={edit} onChange={e => setEdit(e.target.value)} style={{ flex: 1, padding: '11px 12px', borderRadius: 10, border: `0.5px solid ${SEPARATOR}`, background: 'rgba(58,58,60,0.72)', color: TEXT_1, fontSize: 17, fontWeight: 400, textAlign: 'center', outline: 'none', fontFamily: SF, fontVariantNumeric: 'tabular-nums' }} />
                {suffix && <span style={{ fontSize: 13, color: TEXT_2, fontFamily: SF }}>{suffix}</span>}
                <button onClick={() => { let v = parseFloat(edit); if (isNaN(v)) v = min ?? 0; if (min !== undefined) v = Math.max(min, v); if (max !== undefined) v = Math.min(max, v); onChange(v); setOpen(false); }} style={{ padding: '11px 22px', borderRadius: 10, border: 'none', background: ACCENT, color: '#fff', fontWeight: 600, fontFamily: SF, cursor: 'pointer', minHeight: 44 }}>{'Готово'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
