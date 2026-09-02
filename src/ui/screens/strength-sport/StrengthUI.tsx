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
    : tone === 'accent' ? { color: ACCENT, bg: 'rgba(0,230,138,0.10)', border: 'rgba(0,230,138,0.18)', icon: '◆' }
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
    {desc && <span style={{ fontSize: 11, color: 'rgba(235,235,245,0.30)', lineHeight: 1.4, fontFamily: SF }}>{desc}</span>}
  </div>
);
export const ProgressBar: React.FC<{ value: number; max?: number; color?: string; height?: number }> = ({ value, max = 100, color = ACCENT, height = 4 }) => {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label="прогресс" style={{ height, borderRadius: height / 2, background: 'rgba(58,58,60,0.72)', overflow: 'hidden' }}>
      <div style={{ height: '100%', borderRadius: height / 2, width: pct + '%', background: color, transition: 'width 0.40s cubic-bezier(0.2,0,0,1)' }} />
    </div>
  );
};
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
    {label && <span style={{ fontSize: 11, color: 'rgba(235,235,245,0.60)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.06 * 11, lineHeight: 1, fontFamily: SF, display: 'flex', alignItems: 'center', gap: 6 }}>{label}</span>}
    {children}
    {hint && !error && <span style={{ fontSize: 11, color: 'rgba(235,235,245,0.30)', lineHeight: 1.4, fontFamily: SF }}>{hint}</span>}
    {error && <span style={{ fontSize: 12, color: '#FF3B30', fontWeight: 590, fontFamily: SF }}>⚠ {error}</span>}
  </div>
);
export const Highlight: React.FC<{ color?: string; children: React.ReactNode }> = ({ color = ACCENT, children }) => (
  <span style={{ background: `${color}14`, color, padding: '2px 6px', borderRadius: 6, fontWeight: 590, fontSize: '0.94em', fontFamily: SF, border: `0.5px solid ${color}18` }}>{children}</span>
);
