/**
 * metabolic-hub.parts.tsx — presentational primitives for MetabolicHub.
 *
 * Вынесено из god-файла MetabolicHub.tsx: карточка-секция, числовое поле с
 * честным «не задано» (раньше поля показывали фиктивные 45/120/50, а движок
 * считал undefined — пользователь видел число, которого нет), тогл, плитка
 * метрики, шкала и SVG-график EMA.
 *
 * Важно: никаких нативных <select>/<input type=checkbox> — это залочено
 * guard-тестом metabolic-hub-toggles.test.tsx.
 */
import React, { useState } from 'react';
import ReactDOM from 'react-dom';

export const MH_GLASS: React.CSSProperties = {
  background: 'rgba(24,24,27,0.42)',
  border: '1px solid rgba(255,255,255,0.07)',
  backdropFilter: 'blur(12px)',
  transition: 'all 0.18s ease',
};
export const MH_CARD: React.CSSProperties = {
  ...MH_GLASS, borderRadius: 14, padding: 12, marginBottom: 10,
};

/** Карточка-секция: один заголовок, подпись и слот справа. */
export const MhSection: React.FC<{
  icon?: string; title: string; hint?: string; accent?: string;
  right?: React.ReactNode; children: React.ReactNode; tone?: string;
}> = ({ icon, title, hint, accent = '#60a5fa', right, children, tone }) => (
  <div style={{ ...MH_CARD, ...(tone ? { background: tone, border: `1px solid ${accent}22` } : {}) }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      {icon != null && (
        <span aria-hidden style={{
          width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, flexShrink: 0, background: `${accent}18`, border: `1px solid ${accent}33`,
        }}>{icon}</span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.3, textTransform: 'uppercase', color: accent }}>{title}</div>
        {hint != null && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', lineHeight: 1.35, marginTop: 1 }}>{hint}</div>}
      </div>
      {right}
    </div>
    {children}
  </div>
);

/** Сетка полей: 2 колонки на телефоне, 3 на широком экране. */
export const MhGrid: React.FC<{ children: React.ReactNode; cols?: 2 | 3 }> = ({ children, cols = 2 }) => (
  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, gap: 6 }}>{children}</div>
);

const fieldStyle = (has: boolean): React.CSSProperties => ({
  display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start',
  width: '100%', minHeight: 48, padding: '7px 10px', borderRadius: 10, cursor: 'pointer',
  textAlign: 'left', background: has ? 'rgba(96,165,250,0.08)' : 'rgba(255,255,255,0.03)',
  border: has ? '1px solid rgba(96,165,250,0.22)' : '1px solid rgba(255,255,255,0.07)',
  color: '#fff', transition: 'all ease 0.15s',
});

/** Попап-оверлей внутри портала (containing-block bug: backdrop-filter ломает fixed). */
const MhOverlay: React.FC<{ onClose: () => void; children: React.ReactNode }> = ({ onClose, children }) => {
  if (typeof document === 'undefined') return null;
  return ReactDOM.createPortal(
    <div className="mh-popupoverlay" onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 250, display: 'flex',
      alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)',
    }}>{children}</div>,
    document.body,
  );
};

/**
 * MhNum — числовое поле с честным состоянием «не задано».
 *
 * Отличие от PopupNumber: `value?: number` и `optional` → движок и UI говорят
 * одно и то же. Раньше `value={hct ?? 45}` показывал 45%, а hematology считал
 * «нет HCT» — вкладка «Кровь» выглядела сломанной.
 */
export const MhNum: React.FC<{
  label: string;
  value?: number | null;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  hint?: string;
  optional?: boolean;
  /** Показать как «из профиля», если значение подтянуто автоматически. */
  fromProfile?: boolean;
  onChange: (v: number | undefined) => void;
}> = ({ label, value, min, max, step = 1, suffix = '', hint, optional, fromProfile, onChange }) => {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState('');
  const has = typeof value === 'number' && Number.isFinite(value);
  const commit = () => {
    const raw = edit.trim().replace(',', '.');
    if (!raw) { onChange(undefined); setOpen(false); return; }
    let v = Number.parseFloat(raw);
    if (!Number.isFinite(v)) { setOpen(false); return; }
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    onChange(v);
    setOpen(false);
  };
  return (
    <>
      <button type="button" className="mh-num" aria-haspopup="dialog"
        aria-label={`${label}: ${has ? `${value}${suffix}` : 'не задано'}`}
        onClick={() => { setEdit(has ? String(value) : ''); setOpen(true); }}
        style={fieldStyle(has)}>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.62)', fontWeight: 600, lineHeight: 1.25 }}>{label}</span>
        <span style={{ fontSize: 14, fontWeight: has ? 800 : 500, color: has ? '#fff' : 'rgba(255,255,255,0.42)', lineHeight: 1.3 }}>
          {has ? `${value}${suffix}` : (optional ? 'не задано' : '—')}
        </span>
        {fromProfile && has && <span style={{ fontSize: 7, color: '#22c55e' }}>из профиля</span>}
      </button>
      {open && (
        <MhOverlay onClose={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label={label} style={{
            width: '88%', maxWidth: 340, borderRadius: 16, background: '#18181b',
            border: '1px solid rgba(255,255,255,0.1)', padding: 16,
          }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#60a5fa', marginBottom: 8 }}>{label}</div>
            {hint && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginBottom: 8, lineHeight: 1.4 }}>{hint}</div>}
            <input type="number" value={edit} min={min} max={max} step={step} autoFocus
              onChange={(e) => setEdit(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
              style={{
                width: '100%', padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 16, boxSizing: 'border-box',
                textAlign: 'center', marginBottom: 12,
              }} />
            <div style={{ display: 'flex', gap: 8 }}>
              {optional && (
                <button type="button" onClick={() => { onChange(undefined); setOpen(false); }} style={{
                  flex: 1, minHeight: 44, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
                  background: 'transparent', color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: 11, cursor: 'pointer',
                }}>Очистить</button>
              )}
              <button type="button" onClick={commit} style={{
                flex: 1, minHeight: 44, borderRadius: 8, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg,#60a5fa,#3b82f6)', color: '#000', fontWeight: 800, fontSize: 12,
              }}>OK</button>
            </div>
          </div>
        </MhOverlay>
      )}
    </>
  );
};

/** MhToggle — карточка-переключатель вместо нативного checkbox. */
export const MhToggle: React.FC<{
  checked: boolean; onChange: (v: boolean) => void; icon?: string; title: string; desc?: string;
  accent?: string; compact?: boolean; span?: boolean;
}> = ({ checked, onChange, icon, title, desc, accent = '#22c55e', compact, span }) => (
  <button type="button" role="switch" aria-checked={checked} aria-label={title}
    onClick={() => onChange(!checked)} className="mh-toggle" data-on={checked ? 'true' : 'false'}
    style={{
      display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', cursor: 'pointer',
      minHeight: compact ? 44 : 52, padding: compact ? '8px 10px' : '10px 12px', borderRadius: 12,
      border: checked ? `1px solid ${accent}66` : '1px solid rgba(255,255,255,0.07)',
      background: checked ? `${accent}14` : 'rgba(255,255,255,0.03)', color: '#fff',
      boxShadow: checked ? `0 4px 14px ${accent}22` : 'none', transition: 'all 0.18s ease',
      ...(span ? { gridColumn: '1 / -1' } : {}),
    }}>
    {icon != null && (
      <span aria-hidden style={{
        width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 15, flexShrink: 0, background: checked ? `${accent}1e` : 'rgba(255,255,255,0.05)',
        border: `1px solid ${checked ? `${accent}44` : 'rgba(255,255,255,0.07)'}`,
      }}>{icon}</span>
    )}
    <span style={{ flex: 1, minWidth: 0 }}>
      <span style={{ display: 'block', fontSize: compact ? 10 : 11, fontWeight: 700, lineHeight: 1.3 }}>{title}</span>
      {desc != null && <span style={{ display: 'block', fontSize: 8, color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>{desc}</span>}
    </span>
    <span aria-hidden style={{
      width: 42, height: 25, borderRadius: 999, flexShrink: 0, position: 'relative', transition: 'background 0.18s ease',
      background: checked ? accent : 'rgba(255,255,255,0.12)', boxShadow: checked ? `0 0 10px ${accent}55` : 'none',
    }}>
      <span style={{
        position: 'absolute', top: 3, left: checked ? 20 : 3, width: 19, height: 19, borderRadius: '50%',
        background: '#fff', transition: 'left 0.18s ease', boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
      }} />
    </span>
  </button>
);

/** Плитка метрики — крупное число + подпись. */
export const MhTile: React.FC<{
  label: string; value: React.ReactNode; sub?: React.ReactNode; color?: string; accent?: string;
  onClick?: () => void; active?: boolean;
}> = ({ label, value, sub, color = '#fff', accent = '#60a5fa', onClick, active }) => {
  const Tag: any = onClick ? 'button' : 'div';
  // Только длинные свойства границ: смешивать `border`-шорткат с `borderLeft` нельзя —
  // React предупреждает, и при ререндере (active → не active) рамка может залипнуть.
  const edge = active ? `${accent}44` : 'rgba(255,255,255,0.07)';
  return (
    <Tag
      {...(onClick ? { type: 'button', onClick, 'aria-label': `${label}: ${typeof value === 'string' || typeof value === 'number' ? value : ''}` } : {})}
      style={{
        background: active ? `${accent}14` : MH_GLASS.background,
        backdropFilter: MH_GLASS.backdropFilter,
        transition: MH_GLASS.transition,
        borderRadius: 14, padding: 10, marginBottom: 0, minHeight: 72,
        borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 3,
        borderStyle: 'solid',
        borderTopColor: edge, borderRightColor: edge, borderBottomColor: edge, borderLeftColor: accent,
        ...(onClick ? { width: '100%', textAlign: 'left', cursor: 'pointer' } : {}),
      }}>
      <div style={{ fontSize: 9, fontWeight: 800, color: accent, letterSpacing: 0.4, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 900, color, lineHeight: 1.2 }}>{value}</div>
      {sub != null && <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.62)', lineHeight: 1.35 }}>{sub}</div>}
    </Tag>
  );
};

export const MhBar: React.FC<{ v: number; max: number; color: string; label?: string }> = ({ v, max, color, label }) => {
  const pct = Math.max(4, Math.min(100, Math.round((v / Math.max(1, max)) * 100)));
  return (
    <div style={{ flex: 1 }}>
      {label && <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.55)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>}
      <div style={{ height: 10, borderRadius: 20, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 20, transition: 'width 0.35s ease' }} />
      </div>
    </div>
  );
};

/** EmaChart — вес (точки + EMA) + intake-бары (ккал) + линия TDEE. Чистый SVG. */
export const MhEmaChart: React.FC<{
  ema: Array<{ date: string; emaKg: number }>;
  raw: number[];
  intakeByDate: Record<string, number>;
  tdee: number;
}> = ({ ema, raw, intakeByDate, tdee }) => {
  const n = ema.length;
  if (n < 2) return null;
  const W = 300, H1 = 104, H2 = 62, PAD = 10;
  const xs = (i: number): number => PAD + (i * (W - 2 * PAD)) / Math.max(1, n - 1);
  const tail = raw.slice(-n);
  const allKg = [...tail, ...ema.map((e) => e.emaKg)];
  let lo = Math.min(...allKg), hi = Math.max(...allKg);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
  if (hi - lo < 0.4) { const m = (hi + lo) / 2; lo = m - 0.2; hi = m + 0.2; }
  const yw = (kg: number): number => 8 + (1 - (kg - lo) / (hi - lo)) * (H1 - 20);
  const kcalVals = ema.map((e) => intakeByDate[e.date] ?? 0);
  const kMax = Math.max(tdee * 1.25, ...kcalVals, 1);
  const yk = (k: number): number => 4 + (1 - k / kMax) * (H2 - 14);
  const bw = Math.max(2, ((W - 2 * PAD) / n) * 0.55);
  const pts = ema.map((e, i) => `${xs(i).toFixed(1)},${yw(e.emaKg).toFixed(1)}`).join(' ');
  const dim = 'rgba(255,255,255,0.45)';
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H1}`} style={{ width: '100%', display: 'block' }} role="img" aria-label="Вес и EMA">
        <polyline points={pts} fill="none" stroke="#22c55e" strokeWidth={2} strokeLinejoin="round" />
        {tail.map((kg, i) => (
          <circle key={i} cx={xs(i)} cy={yw(kg)} r={2} fill="rgba(255,255,255,0.40)">
            <title>{`${ema[i]?.date ?? ''}: ${kg}кг · EMA ${ema[i]?.emaKg ?? ''}`}</title>
          </circle>
        ))}
        <text x={PAD} y={H1 - 1} fontSize={7} fill={dim}>{ema[0]?.date.slice(5)}</text>
        <text x={W - PAD} y={H1 - 1} fontSize={7} fill={dim} textAnchor="end">{ema[n - 1]?.date.slice(5)}</text>
        <text x={W - PAD} y={12} fontSize={7} fill="#22c55e" textAnchor="end">EMA {ema[n - 1]?.emaKg}кг</text>
      </svg>
      <svg viewBox={`0 0 ${W} ${H2}`} style={{ width: '100%', display: 'block', marginTop: 2 }} role="img" aria-label="Ккал и TDEE">
        {kcalVals.map((k, i) => k > 0
          ? (
            <rect key={i} x={xs(i) - bw / 2} y={yk(k)} width={bw} height={Math.max(1.5, H2 - 10 - yk(k))} rx={1.5}
              fill={Math.abs(k - tdee) / tdee <= 0.10 ? 'rgba(34,197,94,0.55)' : 'rgba(245,158,11,0.55)'}>
              <title>{`${ema[i]?.date ?? ''}: ${k}ккал`}</title>
            </rect>
          )
          : <rect key={i} x={xs(i) - 1} y={H2 - 12} width={2} height={3} fill="rgba(255,255,255,0.15)" />)}
        <line x1={PAD} y1={yk(tdee)} x2={W - PAD} y2={yk(tdee)} stroke="#eab308" strokeWidth={1.2} strokeDasharray="4 3" />
        <text x={W - PAD} y={yk(tdee) - 3} fontSize={7} fill="#eab308" textAnchor="end">TDEE {tdee}</text>
      </svg>
    </div>
  );
};
