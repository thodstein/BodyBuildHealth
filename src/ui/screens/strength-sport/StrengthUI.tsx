/**
 * StrengthUI.tsx — Apple-уровень UI для стронга/ТА (зелёно-янтарная ветка).
 * HIG: SF, hairline, vibrancy, sheets.
 */
import React from 'react';

export const ACCENT = '#30D158';
export const ACCENT_STRONG = '#FF9F0A';
export const ACCENT_TA = '#0A84FF';
export const ACCENT_GRAD = 'linear-gradient(135deg, #30D158 0%, #00C853 100%)';
export const STRONG_GRAD = 'linear-gradient(135deg, #FF9F0A 0%, #FF6B22 100%)';
export const ACCENT_SOFT = 'rgba(48,209,88,0.12)';
export const ACCENT_BORDER = 'rgba(48,209,88,0.20)';
export const STRONG_SOFT = 'rgba(255,159,10,0.12)';
export const STRONG_BORDER = 'rgba(255,159,10,0.20)';

export const GLASS_BG = 'rgba(44,44,46,0.78)';
export const GLASS_BORDER = 'rgba(84,84,88,0.36)';
export const GLASS_SHADOW = '0 1px 3px rgba(0,0,0,0.30), 0 4px 16px rgba(0,0,0,0.24)';
export const VIBRANCY = 'blur(20px) saturate(180%)';
export const TEXT_1 = '#FFFFFF';
export const TEXT_2 = 'rgba(235,235,245,0.60)';
export const TEXT_3 = 'rgba(235,235,245,0.30)';
export const SEPARATOR = 'rgba(84,84,88,0.36)';
export const RADIUS_LG = 14;
export const RADIUS_MD = 10;
const SF = '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif';

export const CARD: React.CSSProperties = {
  background: GLASS_BG, border: `0.5px solid ${GLASS_BORDER}`, borderRadius: RADIUS_LG, padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
  boxShadow: GLASS_SHADOW, backdropFilter: VIBRANCY, WebkitBackdropFilter: VIBRANCY, position: 'relative', overflow: 'hidden', fontFamily: SF,
};
export const CARD_ACCENT: React.CSSProperties = { ...CARD, background: 'rgba(44,44,46,0.84)', borderColor: 'rgba(48,209,88,0.18)', boxShadow: '0 1px 3px rgba(0,0,0,0.30), 0 8px 24px rgba(48,209,88,0.10)' };
export const CARD_STRONG: React.CSSProperties = { ...CARD, background: 'rgba(44,44,46,0.84)', borderColor: 'rgba(255,159,10,0.18)', boxShadow: '0 1px 3px rgba(0,0,0,0.30), 0 8px 24px rgba(255,159,10,0.10)' };
export const CARD_HERO: React.CSSProperties = { ...CARD, background: 'rgba(44,44,46,0.86)', borderColor: GLASS_BORDER, boxShadow: '0 4px 24px rgba(0,0,0,0.32)', padding: 18, gap: 14 };

export const ROW: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontFamily: SF };
export const COL: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 10, fontFamily: SF };
export const LABEL: React.CSSProperties = { fontSize: 11, color: TEXT_2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.06 * 11, lineHeight: 1, fontFamily: SF, display: 'flex', alignItems: 'center', gap: 6 };
export const HINT: React.CSSProperties = { fontSize: 13, color: TEXT_2, lineHeight: 1.45, fontFamily: SF };
export const HINT_SM: React.CSSProperties = { fontSize: 11, color: TEXT_3, lineHeight: 1.4, fontFamily: SF };

export const BTN: React.CSSProperties = {
  padding: '11px 18px', borderRadius: RADIUS_MD, fontSize: 15, fontWeight: 600, cursor: 'pointer', border: `0.5px solid ${SEPARATOR}`, background: 'rgba(58,58,60,0.72)', color: TEXT_1, minHeight: 44, whiteSpace: 'nowrap', fontFamily: SF, letterSpacing: -0.01 * 15, transition: 'all 0.20s cubic-bezier(0.2,0,0,1)', backdropFilter: VIBRANCY,
};
export const BTN_PRIMARY: React.CSSProperties = { ...BTN, background: ACCENT, border: 'none', color: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.30)', fontWeight: 600 };
export const BTN_STRONG: React.CSSProperties = { ...BTN, background: ACCENT_STRONG, border: 'none', color: '#fff' };
export const BTN_SMALL: React.CSSProperties = { ...BTN, minHeight: 32, padding: '7px 12px', fontSize: 13, borderRadius: 8, fontWeight: 600 };
export const BTN_GHOST: React.CSSProperties = { ...BTN, background: 'rgba(48,209,88,0.12)', border: `0.5px solid ${ACCENT_BORDER}`, color: '#30D158' };

export const INPUT: React.CSSProperties = {
  background: 'rgba(58,58,60,0.72)', border: `0.5px solid ${SEPARATOR}`, borderRadius: RADIUS_MD, padding: '10px 12px', color: TEXT_1, fontSize: 17, fontWeight: 400, fontFamily: SF, outline: 'none', width: '100%', backdropFilter: VIBRANCY,
};
export const SELECT: React.CSSProperties = { ...INPUT, appearance: 'none' as any, cursor: 'pointer', fontSize: 15 };

export const CHIP: React.CSSProperties = {
  padding: '7px 14px', borderRadius: 20, fontSize: 13, fontWeight: 590, cursor: 'pointer', border: `0.5px solid ${SEPARATOR}`, background: 'rgba(58,58,60,0.72)', color: TEXT_1, whiteSpace: 'nowrap', minHeight: 34, fontFamily: SF, transition: 'all 0.18s cubic-bezier(0.2,0,0,1)',
};
export const CHIP_ACTIVE: React.CSSProperties = { ...CHIP, border: `0.5px solid ${ACCENT}`, background: ACCENT, color: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.20)' };
export const CHIP_STRONG_ACTIVE: React.CSSProperties = { ...CHIP, border: `0.5px solid ${ACCENT_STRONG}`, background: ACCENT_STRONG, color: '#fff' };

export const PHASE_COLOR: Record<string, string> = { accumulation: '#0A84FF', intensification: '#FF9F0A', peaking: '#FF3B30', deload: '#8E8E93', transition: '#636366', taper: '#FF9F0A' };
export const MODE_COLOR: Record<string, string> = { weightlifting: ACCENT, strongman: ACCENT_STRONG, hybrid: ACCENT_TA };
export const MODE_RU: Record<string, string> = { weightlifting: 'Тяжёлая атлетика', strongman: 'Силовой экстрим', hybrid: 'Гибрид' };
export const LEVEL_RU: Record<string, string> = { beginner: 'Новичок', intermediate: 'Средний', advanced: 'Продвинутый', enhanced: 'На курсе' };
export const PHASE_RU: Record<string, string> = { accumulation: 'Накопление', intensification: 'Интенсификация', peaking: 'Пик', deload: 'Разгрузка', transition: 'Переход', taper: 'Тапер' };
export const ZONE_RU: Record<string, string> = { optimal: 'Оптимум', caution: 'Внимание', dangerous: 'Перегруз', undertrained: 'Недотрен' };
export const EQUIP_RU: Record<string, string> = { barbell: 'Штанга', dumbbell: 'Гантели', machine: 'Тренажёр', cable: 'Блоки', other: 'Прочее' };
export const MOBILITY_RU: Record<string, string> = { shoulder: 'Плечо', hip: 'Таз', knee: 'Колено', ankle: 'Голеностоп', wrist: 'Запястье', lower_back: 'Поясница' };
export const SESSION_TAG_RU: Record<string, string> = { snatch_day: 'Рывок', clean_day: 'Толчок', strength_day: 'Сила', technique_day: 'Техника', pull_day: 'Тяги', accessory_day: 'Подсобка', overhead_day: 'Жим', deadlift_day: 'Тяга', event_day: 'Ивенты', squat_day: 'Присед', oly_day: 'Олимпийка' };
export function ruLabel(map: Record<string, string>, k: string) { return (map as any)[k] ?? k; }

export const SectionCard: React.FC<{ id?: string; title?: React.ReactNode; subtitle?: string; icon?: string; right?: React.ReactNode; accent?: boolean; strong?: boolean; hint?: string; children: React.ReactNode }> = ({ id, title, subtitle, icon, right, accent, strong, hint, children }) => {
  const base = strong ? CARD_STRONG : accent ? CARD_ACCENT : CARD;
  return (
    <div style={base} id={id}>
      {title != null && (
        <div style={ROW}>
          {icon && <span style={{ width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: strong ? ACCENT_STRONG : accent ? ACCENT : 'rgba(58,58,60,0.72)', fontSize: 14, flexShrink: 0, fontFamily: SF }}>{icon}</span>}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: TEXT_1, letterSpacing: -0.02 * 15, fontFamily: SF }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12, color: TEXT_2, fontFamily: SF, marginTop: 1 }}>{subtitle}</div>}
          </div>
          {right}
        </div>
      )}
      {children}
      {hint && <div style={{ ...HINT, background: 'rgba(58,58,60,0.36)', border: `0.5px solid ${SEPARATOR}`, borderRadius: 8, padding: '8px 10px', fontSize: 12 }}>{hint}</div>}
    </div>
  );
};

export const StatTile: React.FC<{ label: string; value: string; color?: string; sub?: string; icon?: string }> = ({ label, value, color = ACCENT, sub, icon }) => (
  <div style={{ flex: '1 1 110px', padding: '12px 12px', borderRadius: 12, background: 'rgba(58,58,60,0.48)', border: `0.5px solid ${SEPARATOR}`, display: 'flex', flexDirection: 'column', gap: 3, fontFamily: SF }}>
    <span style={{ fontSize: 11, color: TEXT_2, textTransform: 'uppercase', letterSpacing: 0.06 * 11, fontWeight: 600, fontFamily: SF, display: 'flex', alignItems: 'center', gap: 4 }}>{icon && <span style={{ fontSize: 11 }}>{icon}</span>}{label}</span>
    <span style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1, letterSpacing: -0.02 * 22, fontFamily: SF, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    {sub && <span style={{ fontSize: 11, color: TEXT_3, fontFamily: SF }}>{sub}</span>}
  </div>
);

export const Badge: React.FC<{ color?: string; bg?: string; border?: string; icon?: string; children: React.ReactNode }> = ({ color = TEXT_1, bg = 'rgba(58,58,60,0.72)', border = SEPARATOR, icon, children }) => (
  <span style={{ fontSize: 13, fontWeight: 590, color, background: bg, border: `0.5px solid ${border}`, borderRadius: 20, padding: '4px 10px', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: SF, letterSpacing: -0.01 * 13 }}>{icon && <span style={{ fontSize: 12 }}>{icon}</span>}{children}</span>
);

export const InfoBanner: React.FC<{ tone?: 'ok' | 'warn' | 'info' | 'strong'; children: React.ReactNode }> = ({ tone = 'info', children }) => {
  const pal = tone === 'warn' ? { color: '#FF9F0A', bg: 'rgba(255,159,10,0.12)', border: 'rgba(255,159,10,0.20)' } : tone === 'ok' ? { color: '#30D158', bg: 'rgba(48,209,88,0.10)', border: 'rgba(48,209,88,0.18)' } : tone === 'strong' ? { color: '#FF9F0A', bg: 'rgba(255,159,10,0.10)', border: 'rgba(255,159,10,0.18)' } : { color: '#64D2FF', bg: 'rgba(100,210,255,0.10)', border: 'rgba(100,210,255,0.16)' };
  return <div role="status" style={{ fontSize: 13, color: pal.color, background: pal.bg, border: `0.5px solid ${pal.border}`, borderRadius: 10, padding: '10px 12px', lineHeight: 1.4, fontFamily: SF, display: 'flex', gap: 8 }}>{pal.color === '#FF9F0A' ? '⚠️' : pal.color === '#30D158' ? '✓' : 'ℹ︎'}<span style={{ flex: 1 }}>{children}</span></div>;
};

export const GroupHeading: React.FC<{ icon: string; text: string; desc?: string }> = ({ icon, text, desc }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '6px 0 6px 12px', borderLeft: `2px solid ${ACCENT}`, margin: '4px 0', fontFamily: SF }}>
    <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_1, fontFamily: SF, display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 13 }}>{icon}</span>{text}</span>
    {desc && <span style={HINT_SM}>{desc}</span>}
  </div>
);

export const SectionNav: React.FC<{ items: { id: string; label: string }[]; activeId?: string; onSelect?: (id: string) => void }> = ({ items, activeId, onSelect }) => {
  const goTo = (id: string) => { if (onSelect) { onSelect(id); return; } const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  return <div style={{ display: 'flex', gap: 6, padding: 4, background: 'rgba(58,58,60,0.72)', borderRadius: 10, border: `0.5px solid ${SEPARATOR}`, backdropFilter: VIBRANCY, alignSelf: 'flex-start' }}>{items.map(n => {
    const active = activeId ? activeId === n.id : false;
    return <button key={n.id} onClick={() => goTo(n.id)} aria-pressed={active} style={{ padding: '6px 12px', borderRadius: 7, fontSize: 13, fontWeight: active ? 600 : 400, cursor: 'pointer', fontFamily: SF, border: 'none', background: active ? '#fff' : 'transparent', color: active ? '#000' : TEXT_2, boxShadow: active ? '0 1px 3px rgba(0,0,0,0.12)' : 'none', transition: 'all 0.20s' }}>{n.label}</button>;
  })}</div>;
};

export const ProgressBar: React.FC<{ value: number; max?: number; color?: string; height?: number }> = ({ value, max = 100, color = ACCENT, height = 4 }) => {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return <div style={{ height, borderRadius: height / 2, background: 'rgba(58,58,60,0.72)', overflow: 'hidden' }}><div style={{ height: '100%', borderRadius: height / 2, width: pct + '%', background: color, transition: 'width 0.40s cubic-bezier(0.2,0,0,1)' }} /></div>;
};

export const Stepper: React.FC<{ label?: string; value: number; min?: number; max?: number; step?: number; onChange: (n: number) => void }> = ({ label, value, min, max, step = 1, onChange }) => (
  <div style={ROW}><span style={{ ...LABEL, minWidth: 0 }}>{label}</span><div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(58,58,60,0.72)', borderRadius: 10, padding: 3, border: `0.5px solid ${SEPARATOR}` }}><button aria-label="уменьшить" style={{ width: 30, height: 30, borderRadius: 7, border: `0.5px solid ${SEPARATOR}`, background: 'rgba(58,58,60,0.72)', color: TEXT_1, fontSize: 15, fontWeight: 400, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SF, opacity: min !== undefined && value <= min ? 0.32 : 1 }} onClick={() => onChange(Math.max(min ?? -Infinity, value - step))} disabled={min !== undefined && value <= min}>−</button><span style={{ fontSize: 17, fontWeight: 590, minWidth: 28, textAlign: 'center', color: TEXT_1, fontFamily: SF, fontVariantNumeric: 'tabular-nums' }}>{value}</span><button aria-label="увеличить" style={{ width: 30, height: 30, borderRadius: 7, border: 'none', background: ACCENT, color: '#fff', fontSize: 15, fontWeight: 590, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SF, opacity: max !== undefined && value >= max ? 0.32 : 1 }} onClick={() => onChange(Math.min(max ?? Infinity, value + step))} disabled={max !== undefined && value >= max}>+</button></div></div>
);

export const ChipToggle: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }> = ({ active, onClick, children, disabled }) => (
  <button style={{ ...(active ? CHIP_ACTIVE : CHIP), opacity: disabled ? 0.38 : 1, fontFamily: SF }} onClick={onClick} disabled={disabled} aria-pressed={active}>{children}</button>
);
export const ChipToggleStrong: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button style={{ ...(active ? CHIP_STRONG_ACTIVE : CHIP), fontFamily: SF }} onClick={onClick} aria-pressed={active}>{children}</button>
);

export const Field: React.FC<{ label?: string; hint?: string; error?: string; children: React.ReactNode }> = ({ label, hint, error, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 148px', minWidth: 0, fontFamily: SF }}>{label && <span style={LABEL}>{label}</span>}{children}{hint && !error && <span style={HINT_SM}>{hint}</span>}{error && <span style={{ fontSize: 12, color: '#FF3B30', fontWeight: 590, fontFamily: SF }}>⚠ {error}</span>}</div>
);

export const Divider: React.FC = () => <div style={{ height: 0.5, background: SEPARATOR, margin: '8px 0' }} />;

export const CardHeader: React.FC<{ icon: string; title: string; subtitle?: string; right?: React.ReactNode; strong?: boolean }> = ({ icon, title, subtitle, right, strong }) => (
  <div style={ROW}><span style={{ width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0, fontFamily: SF, background: strong ? ACCENT_STRONG : ACCENT, color: '#fff' }}>{icon}</span><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 15, fontWeight: 600, color: TEXT_1, letterSpacing: -0.02 * 15, fontFamily: SF }}>{title}</div>{subtitle && <div style={{ fontSize: 12, color: TEXT_2, fontFamily: SF, marginTop: 1 }}>{subtitle}</div>}</div>{right}</div>
);

export const Highlight: React.FC<{ color?: string; children: React.ReactNode }> = ({ color = ACCENT, children }) => (
  <span style={{ background: `${color}14`, color, padding: '2px 6px', borderRadius: 6, fontWeight: 590, fontFamily: SF, fontSize: '0.94em' }}>{children}</span>
);
export const HighlightStrong: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ background: `${ACCENT_STRONG}14`, color: ACCENT_STRONG, padding: '2px 6px', borderRadius: 6, fontWeight: 590, fontFamily: SF }}>{children}</span>
);

const POP_OVERLAY: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.38)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', padding: 0 };
const POP_SHEET: React.CSSProperties = { width: '100%', maxWidth: 420, maxHeight: '78vh', overflowY: 'auto', borderRadius: '16px 16px 0 0', background: '#1C1C1E', borderTop: `0.5px solid ${SEPARATOR}`, boxShadow: '0 -8px 32px rgba(0,0,0,0.32)', paddingBottom: 'max(16px, env(safe-area-inset-bottom))' };
const POP_HANDLE: React.CSSProperties = { width: 36, height: 5, borderRadius: 3, background: 'rgba(120,120,128,0.36)', margin: '8px auto 0' };
const popOption = (active: boolean, strong?: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '12px 16px', borderRadius: 10, cursor: 'pointer', textAlign: 'left' as const,
  fontSize: 17, fontWeight: active ? 600 : 400, fontFamily: SF, background: active ? (strong ? 'rgba(255,159,10,0.12)' : 'rgba(48,209,88,0.12)') : 'transparent',
  border: 'none', color: active ? (strong ? '#FF9F0A' : '#30D158') : TEXT_1, borderBottom: `0.5px solid ${SEPARATOR}`,
});
const popCardBtn: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 11, fontWeight: 600, textAlign: 'center', minHeight: 52, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2, fontFamily: SF,
  background: 'rgba(58,58,60,0.72)', border: `0.5px solid ${SEPARATOR}`, color: TEXT_2,
};

export const StrengthPopupSelect: React.FC<{ label: string; value: string | undefined; options: { id: string; label: string; desc?: string }[]; onChange: (v: string) => void; strong?: boolean }> = ({ label, value, options, onChange, strong }) => {
  const [open, setOpen] = React.useState(false);
  const sel = options.find(o => o.id === (value ?? ''));
  return (
    <>
      <button onClick={() => setOpen(true)} style={popCardBtn}>
        <span style={{ fontSize: 11, color: TEXT_2, textTransform: 'uppercase', letterSpacing: 0.06 * 11, fontWeight: 600, fontFamily: SF }}>{label}</span>
        <span style={{ fontSize: 15, color: strong ? '#FF9F0A' : '#30D158', fontWeight: 590, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: SF }}>{sel ? sel.label : 'Выбрать…'}</span>
      </button>
      {open && (
        <div style={POP_OVERLAY} onClick={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={POP_SHEET}>
            <div style={POP_HANDLE} />
            <div style={{ padding: '12px 16px 8px', borderBottom: `0.5px solid ${SEPARATOR}` }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: TEXT_2, textAlign: 'center', fontFamily: SF }}>{label}</div>
            </div>
            <div style={{ padding: 8 }}>
              {options.map(o => (
                <button key={o.id} onClick={() => { onChange(o.id); setOpen(false); }} style={popOption(value === o.id, strong)}>
                  <span>{o.label}{value === o.id ? '  ✓' : ''}</span>
                </button>
              ))}
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
