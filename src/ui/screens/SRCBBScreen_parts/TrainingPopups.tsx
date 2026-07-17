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
  label: string;
  value: string;
  options: { id: string; label: string; desc?: string }[];
  hint?: string;
  onChange: (v: string) => void;
}> = ({ label, value, options, hint, onChange }) => {
  const [open, setOpen] = useState(false);
  const sel = options.find(o => o.id === value);
  return (
    <>
      <button onClick={() => setOpen(true)} style={cardBtnStyle(!!value)}>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 12, color: value ? ACCENT : 'rgba(255,255,255,0.4)' }}>{sel ? sel.label : 'Выбрать…'}</div>
      </button>
      {open && (
        <div style={overlay} onClick={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={sheet(420)}>
            <div style={topBar} />
            <div style={sheetBody}>
              <div style={titleStyle}>{label}</div>
              {hint && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginBottom: 8, lineHeight: 1.4 }}>{hint}</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {options.map(o => (
                  <button 
                    key={o.id} 
                    onClick={() => { onChange(o.id); setOpen(false); }}
                    style={{ 
                      display: 'block', width: '100%', padding: '10px 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                      fontSize: 11, fontWeight: value === o.id ? 700 : 400,
                      background: value === o.id ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)',
                      border: value === o.id ? '1px solid rgba(0,230,138,0.3)' : '1px solid rgba(255,255,255,0.06)',
                      color: value === o.id ? ACCENT : 'rgba(255,255,255,0.85)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{o.label}</span>
                      {value === o.id && <span style={{ fontSize: 10 }}>✓</span>}
                    </div>
                    {o.desc && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 2, lineHeight: 1.4 }}>{o.desc}</div>}
                  </button>
                ))}
              </div>
              <button onClick={() => setOpen(false)} style={{ width: '100%', marginTop: 12, padding: '10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Закрыть</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const PopupText: React.FC<{
  label: string; value: string; placeholder?: string;
  hint?: string; onChange: (v: string) => void;
}> = ({ label, value, placeholder, hint, onChange }) => {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(value);
  return <>
    <button onClick={() => { setEdit(value); setOpen(true); }} style={cardBtnStyle(!!value)}>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12, color: value ? ACCENT : 'rgba(255,255,255,0.4)' }}>{value || 'Введите...'}</div>
    </button>
    {open && <div style={overlay} onClick={() => setOpen(false)}>
      <div onClick={e => e.stopPropagation()} style={sheet()}>
        <div style={topBar} />
        <div style={sheetBody}>
          <div style={titleStyle}>{label}</div>
          {hint && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginBottom: 8, lineHeight: 1.4 }}>{hint}</div>}
          <input type="text" value={edit} placeholder={placeholder}
            onChange={e => setEdit(e.target.value)} autoFocus
            style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 16, boxSizing: 'border-box', textAlign: 'center', marginBottom: 12 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setOpen(false)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Отмена</button>
            <button onClick={() => { onChange(edit); setOpen(false); }} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 700, fontSize: 12 }}>OK</button>
          </div>
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

// ═══ CalcSection — красивый контейнер-секция для калькуляторов ═══
export const CalcSection: React.FC<{
  icon: string; title: string; desc?: string; accent?: string; children: React.ReactNode;
  /** Если true — сетка 2 колонки для содержимого */
  grid2?: boolean;
}> = ({ icon, title, desc, accent = ACCENT, children, grid2 }) => (
  <div style={{
    background: 'rgba(24,24,27,0.35)', borderRadius: 14,
    border: `1px solid ${accent}18`, overflow: 'hidden', marginBottom: 10,
  }}>
    <div style={{
      padding: '10px 12px 6px', display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: accent }}>{title}</div>
        {desc && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 1, lineHeight: 1.3 }}>{desc}</div>}
      </div>
    </div>
    <div style={{
      padding: grid2 ? 8 : '6px 10px 10px',
      display: grid2 ? 'grid' : 'flex', flexDirection: grid2 ? undefined : 'column',
      gridTemplateColumns: grid2 ? '1fr 1fr' : undefined, gap: 8,
    }}>
      {children}
    </div>
  </div>
);

// ═══ PopupToggle — переключатель on/off в виде красивой кнопки-карточки ═══
export const PopupToggle: React.FC<{
  label: string; value: boolean; onChange: (v: boolean) => void; icon?: string;
}> = ({ label, value, onChange, icon }) => (
  <button onClick={() => onChange(!value)} style={{
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
    background: value ? 'rgba(0,230,138,0.10)' : 'rgba(255,255,255,0.03)',
    border: value ? '1px solid rgba(0,230,138,0.35)' : '1px solid rgba(255,255,255,0.06)',
    color: value ? ACCENT : 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 700, width: '100%', textAlign: 'left' as const,
  }}>
    {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
    <span style={{ flex: 1 }}>{label}</span>
    <span style={{
      width: 20, height: 20, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: value ? ACCENT : 'rgba(255,255,255,0.1)', color: value ? '#000' : 'rgba(255,255,255,0.3)',
      fontSize: 9, fontWeight: 800, transition: 'all 0.15s',
    }}>
      {value ? '✓' : '✕'}
    </span>
  </button>
);

// ═══ CalcResult — блок результата расчёта ═══
export const CalcResult: React.FC<{
  label: string; value: string; accent?: string; hint?: string;
}> = ({ label, value, accent = ACCENT, hint }) => (
  <div style={{
    padding: '14px 16px', borderRadius: 12, textAlign: 'center',
    background: `${accent}0d`, border: `1px solid ${accent}22`,
    marginBottom: 10,
  }}>
    <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 800, color: accent }}>{value}</div>
    {hint && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', marginTop: 2, lineHeight: 1.3 }}>{hint}</div>}
  </div>
);

// ═══ PopupExerciseList — управление списком упражнений (карточка-кнопка → попап) ═══
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';

export const PopupExerciseList: React.FC<{
  label: string; ids: string[]; onChange: (ids: string[]) => void;
  accent?: string; placeholder?: string;
}> = ({ label, ids, onChange, accent = ACCENT, placeholder = 'Поиск упражнения…' }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const isFilled = ids.length > 0;
  const nameOf = (id: string): string => {
    const e = (EXERCISE_CATALOG as any)[id] || (EXERCISE_CATALOG as any)[id.toUpperCase()];
    return e?.name || id;
  };
  const results = (() => {
    const ql = q.trim().toLowerCase();
    const all = Object.values(EXERCISE_CATALOG as any) as any[];
    return all
      .filter(e => !ids.includes(e.id) && (!ql || (e.name || '').toLowerCase().includes(ql) || (e.id || '').toLowerCase().includes(ql)))
      .slice(0, 40);
  })();
  const remove = (id: string) => onChange(ids.filter(x => x !== id));
  const add = (id: string) => { if (!ids.includes(id)) onChange([...ids, id]); setQ(''); };
  return <>
    <button onClick={() => { setQ(''); setOpen(true); }} style={{
      display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 14px', borderRadius: 14, cursor: 'pointer', textAlign: 'left',
      background: 'rgba(255,255,255,0.04)', border: `1px solid ${accent}33`, borderLeft: `3px solid ${accent}`, color: '#fff',
      transition: 'all 0.15s', boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
    }}
      onMouseDown={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.98)'; }}
      onMouseUp={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
    >
      <span style={{ fontSize: 18, flexShrink: 0 }}>⭐</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: isFilled ? accent : 'rgba(255,255,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{isFilled ? `${ids.length} выбрано` : 'Не выбрано'}</div>
      </div>
      <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: isFilled ? accent : 'rgba(255,255,255,0.15)' }} />
    </button>
    {open && (
      <div onClick={() => setOpen(false)} style={overlay}>
        <div onClick={e => e.stopPropagation()} style={sheet()}>
          <div style={topBar} />
          <div style={sheetBody}>
            <div style={titleStyle}>{label}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10, minHeight: 4 }}>
              {ids.length === 0 && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>Список пуст — добавьте упражнения ниже</div>}
              {ids.map(id => (
                <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 8, background: `${accent}1f`, border: `1px solid ${accent}4d`, fontSize: 11, color: accent, fontWeight: 600 }}>
                  {nameOf(id)}
                  <button onClick={() => remove(id)} style={{ background: 'none', border: 'none', color: accent, cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: 0 }}>✕</button>
                </span>
              ))}
            </div>
            <input type="text" value={q} placeholder={placeholder}
              onChange={e => setQ(e.target.value)} autoFocus
              style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 14, boxSizing: 'border-box', marginBottom: 10 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {results.map(e => (
                <button key={e.id} onClick={() => add(e.id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '9px 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left', fontSize: 11, fontWeight: 600, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.9)' }}>
                  <span>{e.name}</span>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>+ добавить</span>
                </button>
              ))}
              {results.length === 0 && q.trim() && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>Ничего не найдено</div>}
            </div>
            <button onClick={() => setOpen(false)} style={{ width: '100%', marginTop: 12, padding: '10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Готово</button>
          </div>
        </div>
      </div>
    )}
  </>;
};

export default { PopupNumber, PopupSelect, PopupText, ExpandableCard, MetricCard, SaveButton, CalcSection, PopupToggle, CalcResult };
