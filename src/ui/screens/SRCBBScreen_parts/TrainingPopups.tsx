/**
 * TrainingPopups.tsx — переиспользуемые попап-компоненты для тренировочного блока.
 * Единый стиль: тёмная карточка-кнопка + открывающийся попап с зелёным акцентом.
 * Экспортирует: PopupNumber, PopupSelect, ExpandableCard, MetricCard, SaveButton.
 */
import React, { useState } from 'react';

const ACCENT = '#00e68a';

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 250, display: 'flex',
  alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)',
};
const sheet = (maxW = 360): React.CSSProperties => ({
  width: '88%', maxWidth: maxW, maxHeight: '78vh', borderRadius: 16,
  background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden',
});
const topBar: React.CSSProperties = { height: 3, background: 'linear-gradient(90deg,#00e68a,#00c853)' };
const sheetBody: React.CSSProperties = { padding: '14px 16px', maxHeight: 'calc(78vh - 3px)', overflowY: 'auto' };
const titleStyle: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: ACCENT, marginBottom: 10 };

export const cardBtnStyle = (active: boolean): React.CSSProperties => ({
  width: '100%', padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 11, fontWeight: 700,
  textAlign: 'left' as const, boxSizing: 'border-box' as const,
  background: active ? 'rgba(0,230,138,0.10)' : 'rgba(255,255,255,0.03)',
  border: active ? '1px solid rgba(0,230,138,0.35)' : '1px solid rgba(255,255,255,0.06)',
  color: active ? ACCENT : 'rgba(255,255,255,0.7)',
});

export const PopupNumber: React.FC<{
  label: string; value: number; min?: number; max?: number; step?: number; suffix?: string;
  hint?: string; onChange: (v: number) => void;
}> = ({ label, value, min, max, step = 1, suffix = '', hint, onChange }) => {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(String(value));
  const display = value ? `${value}${suffix}` : `—${suffix ? ' ' + suffix : ''}`;
  return <>
    <button onClick={() => { setEdit(String(value)); setOpen(true); }} style={cardBtnStyle(!!value)}>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, color: value ? ACCENT : 'rgba(255,255,255,0.4)' }}>{display}</div>
    </button>
    {open && <div style={overlay} onClick={() => setOpen(false)}>
      <div onClick={e => e.stopPropagation()} style={sheet()}>
        <div style={topBar} />
        <div style={sheetBody}>
          <div style={titleStyle}>{label}</div>
          {hint && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginBottom: 8, lineHeight: 1.4 }}>{hint}</div>}
          <input type="number" value={edit} min={min} max={max} step={step}
            onChange={e => setEdit(e.target.value)} autoFocus
            style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 16, boxSizing: 'border-box', textAlign: 'center', marginBottom: 12 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setOpen(false)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Отмена</button>
            <button onClick={() => { const v = parseFloat(edit); if (!isNaN(v)) onChange(v); setOpen(false); }} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 700, fontSize: 12 }}>OK</button>
          </div>
        </div>
      </div>
    </div>}
  </>;
};

export const PopupSelect: React.FC<{
  label: string; value: string; options: { id: string; label: string; desc?: string }[];
  hint?: string; onChange: (v: string) => void;
}> = ({ label, value, options, hint, onChange }) => {
  const [open, setOpen] = useState(false);
  const sel = options.find(o => o.id === value);
  return <>
    <button onClick={() => setOpen(true)} style={cardBtnStyle(!!value)}>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12, color: value ? ACCENT : 'rgba(255,255,255,0.4)' }}>{sel ? sel.label : 'Выбрать…'}</div>
    </button>
    {open && <div style={overlay} onClick={() => setOpen(false)}>
      <div onClick={e => e.stopPropagation()} style={sheet(420)}>
        <div style={topBar} />
        <div style={sheetBody}>
          <div style={titleStyle}>{label}</div>
          {hint && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginBottom: 8, lineHeight: 1.4 }}>{hint}</div>}
          {options.map(o => <button key={o.id} onClick={() => { onChange(o.id); setOpen(false); }}
            style={{ display: 'block', width: '100%', padding: '10px 12px', marginBottom: 4, borderRadius: 10, cursor: 'pointer', textAlign: 'left' as const,
              fontSize: 11, fontWeight: value === o.id ? 700 : 400,
              background: value === o.id ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)',
              border: value === o.id ? '1px solid rgba(0,230,138,0.3)' : '1px solid rgba(255,255,255,0.06)',
              color: value === o.id ? ACCENT : 'rgba(255,255,255,0.85)' }}>
            <div>{o.label}{value === o.id ? ' ✓' : ''}</div>
            {o.desc && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 2, lineHeight: 1.4 }}>{o.desc}</div>}
          </button>)}
        </div>
      </div>
    </div>}
  </>;
};

export const ExpandableCard: React.FC<{
  title: string; short: React.ReactNode; full?: React.ReactNode; accent?: string; icon?: string;
  children?: React.ReactNode;
}> = ({ title, short, full, accent = ACCENT, icon, children }) => {
  const [open, setOpen] = useState(false);
  return <div style={{ background: 'rgba(24,24,27,0.6)', borderRadius: 12, border: `1px solid ${accent}22`, padding: 12, margin: '6px 0' }}>
    <div onClick={() => full && setOpen(o => !o)} style={{ cursor: full ? 'pointer' : 'default', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: accent }}>{icon ? icon + ' ' : ''}{title}</div>
      {full && <span style={{ fontSize: 10, color: accent, flexShrink: 0 }}>{open ? '▲ свернуть' : '▼ подробнее'}</span>}
    </div>
    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, marginTop: 6 }}>{short}</div>
    {open && full && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', lineHeight: 1.55, marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>{full}</div>}
    {children}
  </div>;
};

export const MetricCard: React.FC<{
  title: string; accent?: string; icon?: string; children: React.ReactNode;
}> = ({ title, accent = ACCENT, icon, children }) => (
  <div style={{ marginTop: 10, padding: 12, borderRadius: 12,
    background: `${accent}0f`, border: `1px solid ${accent}33`,
    boxShadow: `0 0 0 1px ${accent}11` }}>
    <div style={{ fontSize: 11, fontWeight: 800, color: accent, margin: '0 0 8px', letterSpacing: 0.3, textTransform: 'uppercase' }}>{icon ? icon + ' ' : ''}{title}</div>
    {children}
  </div>
);

export const SaveButton: React.FC<{
  label?: string; savedLabel?: string; onSave: () => void; disabled?: boolean;
}> = ({ label = '💾 Сохранить', savedLabel = '✓ Сохранено', onSave, disabled }) => {
  const [saved, setSaved] = useState(false);
  return <button disabled={disabled} onClick={() => { onSave(); setSaved(true); setTimeout(() => setSaved(false), 1800); }}
    style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
      background: saved ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'linear-gradient(135deg,#00e68a,#00c853)',
      color: '#000', fontWeight: 800, fontSize: 12, opacity: disabled ? 0.4 : 1, transition: 'all 0.2s' }}>
    {saved ? savedLabel : label}
  </button>;
};

export default { PopupNumber, PopupSelect, ExpandableCard, MetricCard, SaveButton };