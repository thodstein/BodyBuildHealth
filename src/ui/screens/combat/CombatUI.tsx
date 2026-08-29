/**
 * CombatUI.tsx — премиальный UI-слой для единоборств (фиолетово-розовая ветка).
 * Стекло + градиенты + мягкие тени + Apple HIG. Полностью современный.
 */
import React from 'react';

// ─── Палитра ───
export const ACCENT = '#a855f7';
export const ACCENT_2 = '#ec4899';
export const ACCENT_3 = '#f59e0b';
export const ACCENT_GRAD = 'linear-gradient(135deg, #a855f7 0%, #ec4899 55%, #f59e0b 100%)';
export const ACCENT_GRAD_SOFT = 'linear-gradient(135deg, rgba(168,85,247,0.22), rgba(236,72,153,0.14))';
export const ACCENT_SOFT = 'rgba(168,85,247,0.12)';
export const ACCENT_BORDER = 'rgba(168,85,247,0.32)';
export const ACCENT_GLOW = '0 0 20px rgba(168,85,247,0.22), 0 8px 32px rgba(0,0,0,0.32)';

export const GLASS_BG = 'linear-gradient(180deg, rgba(26,24,38,0.72), rgba(18,16,28,0.58))';
export const GLASS_BG_SOFT = 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.015))';
export const GLASS_BORDER = 'rgba(255,255,255,0.08)';
export const GLASS_SHADOW = '0 10px 36px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.06)';
export const TEXT_1 = '#ffffff';
export const TEXT_2 = 'rgba(255,255,255,0.68)';
export const TEXT_3 = 'rgba(255,255,255,0.42)';

export const RADIUS_LG = 20;
export const RADIUS_MD = 14;
export const RADIUS_SM = 10;

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
  background: `linear-gradient(180deg, rgba(168,85,247,0.14), rgba(18,16,28,0.62))`,
  borderColor: ACCENT_BORDER,
  boxShadow: ACCENT_GLOW + ', inset 0 1px 0 rgba(255,255,255,0.07)',
};

export const CARD_HERO: React.CSSProperties = {
  ...CARD_ACCENT,
  padding: 16,
  gap: 14,
  overflow: 'hidden',
};

export const ROW: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' };
export const COL: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 10 };

export const LABEL: React.CSSProperties = {
  fontSize: 10, color: TEXT_2, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.7, lineHeight: 1, display: 'flex', alignItems: 'center', gap: 6,
};
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

export const BTN_PRIMARY: React.CSSProperties = {
  ...BTN,
  background: ACCENT_GRAD,
  border: 'none',
  color: '#fff',
  boxShadow: '0 8px 24px rgba(168,85,247,0.32), 0 2px 8px rgba(236,72,153,0.22), inset 0 1px 0 rgba(255,255,255,0.22)',
};

export const BTN_GHOST: React.CSSProperties = {
  ...BTN,
  background: 'rgba(168,85,247,0.10)',
  border: `1px solid ${ACCENT_BORDER}`,
  color: '#d8b4fe',
};

export const BTN_SMALL: React.CSSProperties = { ...BTN, minHeight: 36, padding: '8px 12px', fontSize: 11.5, borderRadius: 10 };

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

export const SELECT: React.CSSProperties = {
  ...INPUT,
  appearance: 'none' as any,
  cursor: 'pointer',
};

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

export const CHIP_ACTIVE: React.CSSProperties = {
  ...CHIP,
  border: `1px solid ${ACCENT_BORDER}`,
  background: 'linear-gradient(135deg, rgba(168,85,247,0.22), rgba(236,72,153,0.16))',
  color: '#fff',
  boxShadow: '0 4px 16px rgba(168,85,247,0.18), inset 0 1px 0 rgba(255,255,255,0.12)',
};

export const PHASE_COLOR: Record<string, string> = {
  accumulation: '#3b82f6',
  transmutation: '#a855f7',
  realization: '#ef4444',
  gpp: '#60a5fa',
  power: '#a855f7',
  taper: '#f59e0b',
  deload: '#f59e0b',
  conjugate: '#ec4899',
  transition: '#64748b',
  intensification: '#f97316',
  peaking: '#ef4444',
};
export const DISCIPLINE_COLOR: Record<string, string> = {
  boxing: '#3b82f6',
  mma: '#a855f7',
  wrestling: '#ef4444',
  kickboxing: '#f59e0b',
  general: '#6b7280',
};
export const EQUIP_RU: Record<string, string> = { barbell: 'Штанга', dumbbell: 'Гантели', machine: 'Тренажёр', cable: 'Блоки', sled: 'Сани', other: 'Прочее' };
export const MOBILITY_RU: Record<string, string> = { shoulder: 'Плечо', hip: 'Таз', knee: 'Колено', ankle: 'Голеностоп', wrist: 'Запястье', neck: 'Шея', lower_back: 'Поясница' };
export const LEVEL_RU: Record<string, string> = { beginner: 'Новичок', intermediate: 'Средний', advanced: 'Продвинутый', enhanced: 'На курсе' };
export const PHASE_RU: Record<string, string> = { accumulation: 'Накопление', transmutation: 'Трансформация', realization: 'Реализация', gpp: 'ОФП', power: 'Сила', taper: 'Тапер', deload: 'Разгрузка', conjugate: 'Сопряжённая', transition: 'Переход', intensification: 'Интенсификация', peaking: 'Пик' };
export const ZONE_RU: Record<string, string> = { optimal: 'Оптимум', caution: 'Внимание', dangerous: 'Перегруз', undertrained: 'Недотрен' };
export const PERIODIZATION_RU: Record<string, string> = { atr_10: 'ATR 5/3/2 · 10 нед', linear_12: 'Линейная · 12 нед', conjugate: 'Сопряжённая' };
export const SESSION_TAG_RU: Record<string, string> = { upper_power: 'Верх тяж', lower_power: 'Низ тяж', full_power: 'Фулбоди тяж', full_conditioning: 'Фулбоди+конд.', snatch_day: 'Рывок', clean_day: 'Толчок', strength_day: 'Сила' };
export function ruLabel(map: Record<string, string>, key: string | undefined | null) { return key != null ? ((map as any)[key] ?? key) : ''; }

// ─── Компоненты ───

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
    {/* верхняя светлая линия */}
    <div style={{ position: 'absolute', top: 0, left: 14, right: 14, height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)' }} />
    {title != null && (
      <div style={ROW}>
        {icon && (
          <span style={{
            width: 28, height: 28, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: accent ? 'linear-gradient(135deg,#a855f7,#ec4899)' : 'rgba(255,255,255,0.06)',
            border: accent ? 'none' : '1px solid rgba(255,255,255,0.07)',
            fontSize: 14, flexShrink: 0,
          }}>{icon}</span>
        )}
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

export const StatTile: React.FC<{ label: string; value: string; color?: string; sub?: string; icon?: string }> = ({ label, value, color = '#a855f7', sub, icon }) => (
  <div style={{
    flex: '1 1 112px', padding: '12px 12px', borderRadius: 14,
    background: `linear-gradient(180deg, ${color}14, rgba(255,255,255,0.02))`,
    border: `1px solid ${color}22`, display: 'flex', flexDirection: 'column', gap: 4, position: 'relative', overflow: 'hidden',
    backdropFilter: 'blur(10px)', boxShadow: `0 4px 16px ${color}10`,
  }}>
    <div style={{ position: 'absolute', top: -18, right: -18, width: 56, height: 56, borderRadius: '50%', background: `${color}14`, filter: 'blur(6px)' }} />
    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.48)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4 }}>
      {icon && <span style={{ fontSize: 10 }}>{icon}</span>}{label}
    </span>
    <span style={{ fontSize: 20, fontWeight: 900, color, lineHeight: 1, letterSpacing: -0.5 }}>{value}</span>
    {sub && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.44)', lineHeight: 1.2 }}>{sub}</span>}
  </div>
);

export const Badge: React.FC<{ color?: string; bg?: string; border?: string; icon?: string; children: React.ReactNode }> = ({ color = '#fff', bg = 'rgba(255,255,255,0.06)', border = 'rgba(255,255,255,0.10)', icon, children }) => (
  <span style={{
    fontSize: 11, fontWeight: 800, color, background: bg, border: `1px solid ${border}`, borderRadius: 20,
    padding: '5px 11px', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5,
    backdropFilter: 'blur(10px)', boxShadow: '0 2px 8px rgba(0,0,0,0.14)',
    letterSpacing: 0.15,
  }}>{icon && <span style={{ fontSize: 11 }}>{icon}</span>}{children}</span>
);

export const InfoBanner: React.FC<{ tone?: 'ok' | 'warn' | 'info' | 'accent'; children: React.ReactNode }> = ({ tone = 'info', children }) => {
  const pal = tone === 'warn' ? { color: '#fbbf24', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.22)', left: '#f59e0b' }
    : tone === 'ok' ? { color: '#4ade80', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.22)', left: '#22c55e' }
    : tone === 'accent' ? { color: '#d8b4fe', bg: 'rgba(168,85,247,0.10)', border: 'rgba(168,85,247,0.24)', left: '#a855f7' }
    : { color: '#c4b5fd', bg: 'rgba(168,85,247,0.07)', border: 'rgba(168,85,247,0.18)', left: '#a855f7' };
  return (
    <div role="status" style={{
      fontSize: 11.5, color: pal.color, background: pal.bg, border: `1px solid ${pal.border}`, borderLeft: `3px solid ${pal.left}`,
      borderRadius: 12, padding: '9px 11px', lineHeight: 1.45, backdropFilter: 'blur(10px)', display: 'flex', gap: 8, alignItems: 'flex-start',
    }}>
      <span style={{ fontSize: 12, marginTop: 1, flexShrink: 0 }}>{tone === 'warn' ? '⚠️' : tone === 'ok' ? '✅' : tone === 'accent' ? '✦' : 'ℹ️'}</span>
      <span style={{ flex: 1 }}>{children}</span>
    </div>
  );
};

export const GroupHeading: React.FC<{ icon: string; text: string; desc?: string }> = ({ icon, text, desc }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', gap: 3, padding: '8px 12px', borderLeft: `3px solid ${ACCENT}`, borderRadius: 10,
    background: 'linear-gradient(90deg, rgba(168,85,247,0.08), transparent)', margin: '2px 0',
  }}>
    <span style={{ fontSize: 12.5, fontWeight: 900, color: '#fff', letterSpacing: -0.1, display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 22, height: 22, borderRadius: 7, background: 'linear-gradient(135deg,#a855f7,#ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>{icon}</span>
      {text}
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
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: 4, background: 'rgba(0,0,0,0.20)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(10px)' }}>
      {items.map(n => {
        const active = activeId ? activeId === n.id : false;
        return (
          <button
            key={n.id}
            onClick={() => goTo(n.id)}
            aria-pressed={active}
            style={{
              padding: '8px 14px', borderRadius: 10, fontSize: 11.5, fontWeight: active ? 800 : 600, cursor: 'pointer',
              border: active ? '1px solid rgba(168,85,247,0.42)' : '1px solid transparent',
              background: active ? 'linear-gradient(135deg, rgba(168,85,247,0.22), rgba(236,72,153,0.18))' : 'transparent',
              color: active ? '#fff' : 'rgba(255,255,255,0.58)',
              boxShadow: active ? '0 2px 10px rgba(168,85,247,0.18), inset 0 1px 0 rgba(255,255,255,0.10)' : 'none',
              transition: 'all 0.18s ease', whiteSpace: 'nowrap',
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
    <div style={{ height, borderRadius: height / 2, background: 'rgba(255,255,255,0.07)', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)', padding: 1 }}>
      <div style={{
        height: '100%', borderRadius: height / 2, width: pct + '%',
        background: `linear-gradient(90deg, ${color}, #ec4899)`,
        boxShadow: `0 0 10px ${color}66`,
        transition: 'width 0.45s cubic-bezier(0.25,0.46,0.45,0.94)', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)', opacity: 0.7 }} />
      </div>
    </div>
  );
};

export const Stepper: React.FC<{ label?: string; value: number; min?: number; max?: number; step?: number; onChange: (n: number) => void }> = ({ label, value, min, max, step = 1, onChange }) => (
  <div style={{ ...ROW, gap: 8 }}>
    {label && <span style={{ ...LABEL, minWidth: 0 }}>{label}</span>}
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.22)', borderRadius: 12, padding: 4, border: '1px solid rgba(255,255,255,0.07)' }}>
      <button
        aria-label="уменьшить"
        style={{
          width: 32, height: 32, borderRadius: 9, border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.06)', color: '#fff',
          fontSize: 16, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: min !== undefined && value <= min ? 0.35 : 1, transition: 'all 0.15s',
        }}
        onClick={() => onChange(Math.max(min ?? -Infinity, value - step))}
        disabled={min !== undefined && value <= min}
      >−</button>
      <span style={{ fontSize: 15, fontWeight: 900, minWidth: 28, textAlign: 'center', color: '#fff' }}>{value}</span>
      <button
        aria-label="увеличить"
        style={{
          width: 32, height: 32, borderRadius: 9, border: 'none', background: ACCENT_GRAD, color: '#fff',
          fontSize: 16, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(168,85,247,0.28)', opacity: max !== undefined && value >= max ? 0.35 : 1, transition: 'all 0.15s',
        }}
        onClick={() => onChange(Math.min(max ?? Infinity, value + step))}
        disabled={max !== undefined && value >= max}
      >+</button>
    </div>
  </div>
);

export const ChipToggle: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean; icon?: string }> = ({ active, onClick, children, disabled, icon }) => (
  <button
    style={{ ...(active ? CHIP_ACTIVE : CHIP), opacity: disabled ? 0.38 : 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}
    onClick={onClick} disabled={disabled} aria-pressed={active}
  >
    {icon && <span style={{ fontSize: 12 }}>{icon}</span>}{children}
  </button>
);

export const Field: React.FC<{ label?: string; hint?: string; error?: string; children: React.ReactNode }> = ({ label, hint, error, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 148px', minWidth: 0 }}>
    {label && <span style={LABEL}>{label}</span>}
    {children}
    {hint && !error && <span style={HINT_SM}>{hint}</span>}
    {error && <span style={{ fontSize: 11, color: '#f87171', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>⚠ {error}</span>}
  </div>
);

export const Divider: React.FC = () => <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)', margin: '4px 0' }} />;

export const GlassButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'ghost' | 'primary' | 'soft' }> = ({ variant = 'ghost', style, children, ...props }) => {
  const base = variant === 'primary' ? BTN_PRIMARY : variant === 'soft' ? { ...BTN, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' } : BTN;
  return <button style={{ ...base, ...style }} {...props}>{children}</button>;
};

export const CardHeader: React.FC<{ icon: string; title: string; subtitle?: string; right?: React.ReactNode; accent?: boolean }> = ({ icon, title, subtitle, right, accent }) => (
  <div style={ROW}>
    <span style={{
      width: 34, height: 34, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0,
      background: accent ? 'linear-gradient(135deg,#a855f7,#ec4899)' : 'rgba(255,255,255,0.06)',
      border: accent ? 'none' : '1px solid rgba(255,255,255,0.07)',
      boxShadow: accent ? '0 4px 14px rgba(168,85,247,0.28)' : 'none',
    }}>{icon}</span>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', lineHeight: 1.1, letterSpacing: -0.2 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 11, color: TEXT_3, lineHeight: 1.2, marginTop: 1 }}>{subtitle}</div>}
    </div>
    {right}
  </div>
);

// ─── Выделения текста ───
export const Highlight: React.FC<{ color?: string; children: React.ReactNode }> = ({ color = ACCENT, children }) => (
  <span style={{ background: `${color}18`, border: `1px solid ${color}30`, color, padding: '1px 6px', borderRadius: 6, fontWeight: 800, fontSize: '0.95em' }}>{children}</span>
);
export const AccentText: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ color: ACCENT, fontWeight: 800 }}>{children}</span>
);

// ─── Красивые попапы (фиолетовая ветка) ───
const POP_OVERLAY: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(8,6,16,0.72)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', padding: 16, animation: 'fadeIn 0.18s ease',
};
const POP_SHEET: React.CSSProperties = {
  width: '100%', maxWidth: 420, maxHeight: '78vh', overflowY: 'auto', borderRadius: 20,
  background: 'linear-gradient(180deg, #1e1a2e, #14101e)', border: '1px solid rgba(168,85,247,0.18)',
  boxShadow: '0 20px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(168,85,247,0.08) inset', paddingBottom: 16,
};
const POP_TOPBAR: React.CSSProperties = { height: 3, background: ACCENT_GRAD, borderRadius: '20px 20px 0 0' };
const popOption = (active: boolean): React.CSSProperties => ({
  display: 'block', width: '100%', padding: '12px 14px', marginBottom: 6, borderRadius: 12, cursor: 'pointer', textAlign: 'left' as const,
  fontSize: 13, fontWeight: active ? 800 : 600, background: active ? 'linear-gradient(135deg, rgba(168,85,247,0.16), rgba(236,72,153,0.10))' : 'rgba(255,255,255,0.04)',
  border: active ? '1px solid rgba(168,85,247,0.38)' : '1px solid rgba(255,255,255,0.07)', color: active ? '#d8b4fe' : 'rgba(255,255,255,0.88)',
  boxShadow: active ? '0 4px 16px rgba(168,85,247,0.16)' : 'none', transition: 'all 0.14s ease',
});
const popCardBtn = (active?: boolean): React.CSSProperties => ({
  width: '100%', padding: '10px 12px', borderRadius: 12, cursor: 'pointer', fontSize: 10, fontWeight: 700, textAlign: 'center', minHeight: 54,
  display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2,
  background: active ? 'linear-gradient(135deg, rgba(168,85,247,0.16), rgba(236,72,153,0.08))' : 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))',
  border: active ? '1px solid rgba(168,85,247,0.36)' : '1px solid rgba(255,255,255,0.07)', color: active ? '#d8b4fe' : 'rgba(255,255,255,0.72)',
  boxShadow: active ? '0 4px 16px rgba(168,85,247,0.14)' : 'none', transition: 'all 0.16s ease',
});

export const CombatPopupSelect: React.FC<{ label: string; value: string | undefined; options: { id: string; label: string; desc?: string }[]; onChange: (v: string) => void }> = ({ label, value, options, onChange }) => {
  const [open, setOpen] = React.useState(false);
  const sel = options.find(o => o.id === (value ?? ''));
  return (
    <>
      <button onClick={() => setOpen(true)} style={popCardBtn(false)}>
        <span style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.42)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
        <span style={{ fontSize: 12, color: '#d8b4fe', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sel ? sel.label : 'Выбрать…'}</span>
      </button>
      {open && (
        <div style={POP_OVERLAY} onClick={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={POP_SHEET}>
            <div style={POP_TOPBAR} />
            <div style={{ padding: '16px 16px 0' }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: '#fff', letterSpacing: -0.2 }}>{label}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.42)', marginTop: 2, marginBottom: 14 }}>Выберите вариант</div>
              {options.map(o => (
                <button key={o.id} onClick={() => { onChange(o.id); setOpen(false); }} style={popOption(value === o.id)}>
                  <div>{o.label}{value === o.id ? ' ✓' : ''}</div>
                  {o.desc && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.48)', marginTop: 3, lineHeight: 1.4 }}>{o.desc}</div>}
                </button>
              ))}
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
      <button onClick={() => { setEdit(String(value)); setOpen(true); }} style={popCardBtn(false)}>
        <span style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.42)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
        <span style={{ fontSize: 14, color: '#d8b4fe', fontWeight: 900 }}>{value}{suffix ? ` ${suffix}` : ''}</span>
      </button>
      {open && (
        <div style={POP_OVERLAY} onClick={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={POP_SHEET}>
            <div style={POP_TOPBAR} />
            <div style={{ padding: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: '#fff' }}>{label}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.42)', marginBottom: 12 }}>Ползунок или точный ввод</div>
              <input type="range" min={min ?? 0} max={max ?? 300} step={step} value={parseFloat(edit) || 0} onChange={e => setEdit(e.target.value)} style={{ width: '100%', accentColor: ACCENT, marginBottom: 12 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="number" value={edit} onChange={e => setEdit(e.target.value)} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(168,85,247,0.22)', background: 'rgba(0,0,0,0.32)', color: '#fff', fontSize: 16, fontWeight: 800, textAlign: 'center', outline: 'none' }} />
                <button onClick={() => { let v = parseFloat(edit); if (isNaN(v)) v = min ?? 0; if (min !== undefined) v = Math.max(min, v); if (max !== undefined) v = Math.min(max, v); onChange(v); setOpen(false); }} style={{ padding: '10px 22px', borderRadius: 10, border: 'none', background: ACCENT_GRAD, color: '#fff', fontWeight: 900, cursor: 'pointer' }}>OK</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
