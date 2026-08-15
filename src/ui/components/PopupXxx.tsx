import React, { useState, useEffect } from 'react';

const ACCENT = '#00e68a';

const cardBtn = (active?: boolean): React.CSSProperties => ({
  width: '100%', padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
  fontSize: 10, fontWeight: 700, textAlign: 'center', minHeight: 58,
  display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2,
  background: active
    ? 'linear-gradient(135deg, rgba(0,230,138,0.16), rgba(0,200,160,0.07))'
    : 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015))',
  border: active ? '1px solid rgba(0,230,138,0.55)' : '1px solid rgba(255,255,255,0.09)',
  color: active ? '#000' : 'rgba(255,255,255,0.7)',
  boxShadow: active ? '0 2px 16px rgba(0,230,138,0.22)' : '0 1px 8px rgba(0,0,0,0.22)',
  transition: 'all 0.18s ease',
});

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 250, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  background: 'rgba(5,5,8,0.72)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
  animation: 'fadeSlideIn 0.18s ease',
};

const sheet: React.CSSProperties = {
  width: '100%', maxWidth: 380, maxHeight: '80vh', overflowY: 'auto', borderRadius: '20px 20px 0 0',
  background: 'linear-gradient(180deg, #1e1e22, #141417)',
  border: '1px solid rgba(255,255,255,0.1)', borderBottom: 'none',
  boxShadow: '0 -10px 44px rgba(0,0,0,0.55)',
  animation: 'fadeSlideIn 0.22s ease',
  paddingBottom: 16,
};

const sheetPad: React.CSSProperties = { padding: '14px 16px' };
const sheetTitle: React.CSSProperties = { fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 2, letterSpacing: '-0.2px' };
const sheetSub: React.CSSProperties = { fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: 12 };

const topBar: React.ReactNode = <div style={{ height: 3, background: 'linear-gradient(90deg,#00e68a,#00c853,#00e68a)' }} />;

const optionBtn = (selected: boolean): React.CSSProperties => ({
  display: 'block', width: '100%', padding: '11px 13px', marginBottom: 5, borderRadius: 12, cursor: 'pointer',
  textAlign: 'left' as const, fontSize: 12, fontWeight: selected ? 800 : 500,
  background: selected ? 'linear-gradient(135deg, rgba(0,230,138,0.14), rgba(0,200,160,0.07))' : 'rgba(255,255,255,0.03)',
  border: selected ? '1px solid rgba(0,230,138,0.45)' : '1px solid rgba(255,255,255,0.07)',
  color: selected ? ACCENT : 'rgba(255,255,255,0.88)',
  boxShadow: selected ? '0 2px 12px rgba(0,230,138,0.15)' : 'none',
  transition: 'all 0.15s ease',
});

const fieldInput: React.CSSProperties = {
  flex: 1, padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(0,0,0,0.35)', color: '#fff', fontSize: 16, fontWeight: 700, textAlign: 'center',
  outline: 'none', boxSizing: 'border-box' as const,
};

export const PopupBool: React.FC<{ label: string; value: boolean; onChange: (v: boolean) => void }> = ({ label, value, onChange }) => {
  const [open, setOpen] = useState(false);
  return <>
    <button onClick={() => setOpen(true)} style={cardBtn(value)}>
      <span style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</span>
      <span style={{ fontSize: 12, color: value ? ACCENT : 'rgba(255,255,255,0.88)' }}>{value ? '✓ Да' : '✗ Нет'}</span>
    </button>
    {open && <div style={overlay} onClick={() => setOpen(false)}>
      <div onClick={e => e.stopPropagation()} style={sheet}>
        {topBar}
        <div style={sheetPad}>
          <div style={sheetTitle}>{label}</div>
          <div style={sheetSub}>Выберите значение</div>
          <button onClick={() => { onChange(true); setOpen(false); }} style={optionBtn(value)}>
            <div>✓ Да{value ? ' · текущее' : ''}</div>
          </button>
          <button onClick={() => { onChange(false); setOpen(false); }} style={{
            ...optionBtn(!value),
            border: !value ? '1px solid rgba(239,68,68,0.45)' : '1px solid rgba(255,255,255,0.07)',
            background: !value ? 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.05))' : 'rgba(255,255,255,0.03)',
            color: !value ? '#f87171' : 'rgba(255,255,255,0.88)',
            boxShadow: 'none',
          }}>
            <div>✗ Нет{!value ? ' · текущее' : ''}</div>
          </button>
        </div>
      </div>
    </div>}
  </>;
};

export const PopupNumber: React.FC<{ label: string; value: number; min?: number; max?: number; step?: number; onChange: (v: number) => void; suffix?: string }> = ({ label, value, min, max, step = 1, onChange, suffix = '' }) => {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(String(value));
  const display = value + (suffix ? ' ' + suffix : '');
  // P2-fix: sync edit с внешним value когда попап закрыт (избегает stale state)
  useEffect(() => { if (!open) setEdit(String(value)); }, [value, open]);
  return <>
    <button onClick={() => { setEdit(String(value)); setOpen(true); }} style={cardBtn(false)}>
      <span style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</span>
      <span style={{ fontSize: 15, color: ACCENT, fontWeight: 800 }}>{display}</span>
    </button>
    {open && <div style={overlay} onClick={() => setOpen(false)}>
      <div onClick={e => e.stopPropagation()} style={sheet}>
        {topBar}
        <div style={sheetPad}>
          <div style={sheetTitle}>{label}</div>
          <div style={sheetSub}>Ползунок или ввод числа</div>
          {/* P2-fix: parseFloat вместо parseInt — теперь slider корректно показывает дробные значения (14.5) */}
          <input type="range" min={min ?? 0} max={max ?? 300} step={step} value={parseFloat(edit) || 0}
            onChange={e => setEdit(e.target.value)}
            style={{ width:'100%', height:4, accentColor:ACCENT, cursor:'pointer', marginBottom:12 }} />
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <input type="number" value={edit} onChange={e => setEdit(e.target.value)} style={fieldInput} />
            <button onClick={() => {
              // P2-fix: clamp min/max при нажатии OK — раньше можно было ввести 99999 для роста (max=250)
              let v = parseFloat(edit);
              if (isNaN(v)) v = min ?? 0;
              if (min !== undefined) v = Math.max(min, v);
              if (max !== undefined) v = Math.min(max, v);
              onChange(v);
              setOpen(false);
            }} style={{ padding:'10px 20px', borderRadius:10, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#00e68a,#00c853)', color:'#000', fontWeight:800, fontSize:12, boxShadow:'0 3px 14px rgba(0,230,138,0.3)' }}>OK</button>
          </div>
        </div>
      </div>
    </div>}
  </>;
};

export const PopupSelect: React.FC<{ label: string; value: string; options: { id: string; label: string; desc?: string }[]; onChange: (v: string) => void }> = ({ label, value, options, onChange }) => {
  const [open, setOpen] = useState(false);
  const sel = options.find(o => o.id === value);
  return <>
    <button onClick={() => setOpen(true)} style={cardBtn(false)}>
      <span style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</span>
      <span style={{ fontSize: 11.5, color: ACCENT, fontWeight: 700 }}>{sel ? sel.label : 'Выбрать…'}</span>
    </button>
    {open && <div style={overlay} onClick={() => setOpen(false)}>
      <div onClick={e => e.stopPropagation()} style={sheet}>
        {topBar}
        <div style={sheetPad}>
          <div style={sheetTitle}>{label}</div>
          {sel?.desc && <div style={{ ...sheetSub, marginBottom: 8 }}>{sel.desc}</div>}
          {options.map(o => <button key={o.id} onClick={() => { onChange(o.id); setOpen(false); }}
            style={optionBtn(value === o.id)}>
            <div>{o.label}{value === o.id ? ' ✓' : ''}</div>
            {o.desc && <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.5)', marginTop: 2, lineHeight: 1.45, fontWeight: 400 }}>{o.desc}</div>}
          </button>)}
        </div>
      </div>
    </div>}
  </>;
};

export const PopupText: React.FC<{ label: string; value: string; onChange: (v: string) => void; placeholder?: string }> = ({ label, value, onChange, placeholder = '' }) => {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(value);
  return <>
    <button onClick={() => { setEdit(value); setOpen(true); }} style={cardBtn(false)}>
      <span style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</span>
      <span style={{ fontSize: 11.5, color: value ? ACCENT : 'rgba(255,255,255,0.4)', fontWeight: value ? 700 : 400 }}>{value || 'Не указано'}</span>
    </button>
    {open && <div style={overlay} onClick={() => setOpen(false)}>
      <div onClick={e => e.stopPropagation()} style={sheet}>
        {topBar}
        <div style={sheetPad}>
          <div style={sheetTitle}>{label}</div>
          <textarea value={edit} onChange={e => setEdit(e.target.value)} placeholder={placeholder}
            style={{ width:'100%', minHeight:60, padding:'9px 11px', borderRadius:10, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(0,0,0,0.35)', color:'#fff', fontSize:12, resize:'vertical', boxSizing:'border-box', fontFamily:'inherit', outline:'none' }} />
          <button onClick={() => { onChange(edit); setOpen(false); }} style={{
            width:'100%', marginTop:8, padding:'10px', borderRadius:10, border:'none',
            background:'linear-gradient(135deg,#00e68a,#00c853)', color:'#000', fontWeight:800, fontSize:12, cursor:'pointer',
            boxShadow:'0 3px 14px rgba(0,230,138,0.3)',
          }}>OK</button>
        </div>
      </div>
    </div>}
  </>;
};
