import React, { useState } from 'react';

const ACCENT = '#00e68a';

const cardBtn = (active?: boolean): React.CSSProperties => ({
  width: '100%', padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
  fontSize: 10, fontWeight: 700, textAlign: 'center',
  background: active ? 'linear-gradient(135deg,#00e68a,#00c853)' : 'rgba(24,24,27,0.6)',
  border: active ? '2px solid #00e68a' : '1px solid rgba(255,255,255,0.06)',
  color: active ? '#000' : 'rgba(255,255,255,0.7)',
  transition: 'all 0.15s',
});

const overlay: React.CSSProperties = {
  position:'fixed', inset:0, zIndex:250, display:'flex', alignItems:'center', justifyContent:'center',
  background:'rgba(0,0,0,0.85)',
};
const sheet: React.CSSProperties = {
  width:'85%', maxWidth:320, borderRadius:16, background:'#18181b', border:'1px solid rgba(255,255,255,0.1)', overflow:'hidden',
};
const sheetPad: React.CSSProperties = { padding:'14px 16px' };
const sheetTitle: React.CSSProperties = { fontSize:14, fontWeight:700, color:'#00e68a', marginBottom:10 };

export const PopupBool: React.FC<{ label: string; value: boolean; onChange: (v: boolean) => void }> = ({ label, value, onChange }) => {
  const [open, setOpen] = useState(false);
  return <>
    <button onClick={() => setOpen(true)} style={cardBtn(value)}>{label}</button>
    {open && <div style={overlay} onClick={() => setOpen(false)}>
      <div onClick={e => e.stopPropagation()} style={sheet}>
        <div style={{ height:3, background:'linear-gradient(90deg,#00e68a,#00c853)' }} />
        <div style={sheetPad}>
          <div style={sheetTitle}>{label}</div>
          <button onClick={() => { onChange(true); setOpen(false); }} style={{ display:'block', width:'100%', padding:'10px 14px', marginBottom:3, borderRadius:10, cursor:'pointer', fontSize:11, fontWeight:700, textAlign:'left', background: value ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)', border: value ? '1px solid rgba(0,230,138,0.3)' : '1px solid rgba(255,255,255,0.06)', color: value ? ACCENT : 'rgba(255,255,255,0.8)' }}>✓ Да {value ? ' ✓' : ''}</button>
          <button onClick={() => { onChange(false); setOpen(false); }} style={{ display:'block', width:'100%', padding:'10px 14px', borderRadius:10, cursor:'pointer', fontSize:11, fontWeight:700, textAlign:'left', background: !value ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.03)', border: !value ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.06)', color: !value ? '#ef4444' : 'rgba(255,255,255,0.8)', marginBottom:6 }}>✗ Нет {!value ? ' ✓' : ''}</button>
        </div>
      </div>
    </div>}
  </>;
};

export const PopupNumber: React.FC<{ label: string; value: number; min?: number; max?: number; step?: number; onChange: (v: number) => void; suffix?: string }> = ({ label, value, min, max, step = 1, onChange, suffix = '' }) => {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(String(value));
  const display = value + (suffix ? ' ' + suffix : '');
  return <>
    <button onClick={() => { setEdit(String(value)); setOpen(true); }} style={cardBtn(false)}>
      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, color: ACCENT }}>{display}</div>
    </button>
    {open && <div style={overlay} onClick={() => setOpen(false)}>
      <div onClick={e => e.stopPropagation()} style={sheet}>
        <div style={{ height:3, background:'linear-gradient(90deg,#00e68a,#00c853)' }} />
        <div style={sheetPad}>
          <div style={sheetTitle}>{label}</div>
          <input type="range" min={min ?? 0} max={max ?? 300} step={step} value={parseInt(edit) || 0}
            onChange={e => setEdit(e.target.value)}
            style={{ width:'100%', height:4, accentColor:ACCENT, cursor:'pointer', marginBottom:6 }} />
          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
            <input type="number" value={edit} onChange={e => setEdit(e.target.value)}
              style={{ flex:1, padding:'6px 10px', borderRadius:8, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(0,0,0,0.3)', color:'#fff', fontSize:16, fontWeight:700, textAlign:'center' }} />
            <button onClick={() => { const v = parseFloat(edit); if (!isNaN(v)) onChange(v); setOpen(false); }} style={{ padding:'8px 16px', borderRadius:8, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#00e68a,#00c853)', color:'#000', fontWeight:700, fontSize:12 }}>OK</button>
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
      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 11, color: ACCENT }}>{sel ? sel.label : 'Выбрать…'}</div>
    </button>
    {open && <div style={overlay} onClick={() => setOpen(false)}>
      <div onClick={e => e.stopPropagation()} style={sheet}>
        <div style={{ height:3, background:'linear-gradient(90deg,#00e68a,#00c853)' }} />
        <div style={sheetPad}>
          <div style={sheetTitle}>{label}</div>
          {options.map(o => <button key={o.id} onClick={() => { onChange(o.id); setOpen(false); }}
            style={{ display:'block', width:'100%', padding:'10px 12px', marginBottom:4, borderRadius:10, cursor:'pointer', textAlign:'left' as const,
              fontSize:11, fontWeight: value === o.id ? 700 : 400,
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

export const PopupText: React.FC<{ label: string; value: string; onChange: (v: string) => void; placeholder?: string }> = ({ label, value, onChange, placeholder = '' }) => {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(value);
  return <>
    <button onClick={() => { setEdit(value); setOpen(true); }} style={cardBtn(false)}>
      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 11, color: value ? '#00e68a' : 'rgba(255,255,255,0.4)' }}>{value || 'Не указано'}</div>
    </button>
    {open && <div style={overlay} onClick={() => setOpen(false)}>
      <div onClick={e => e.stopPropagation()} style={sheet}>
        <div style={{ height:3, background:'linear-gradient(90deg,#00e68a,#00c853)' }} />
        <div style={sheetPad}>
          <div style={sheetTitle}>{label}</div>
          <textarea value={edit} onChange={e => setEdit(e.target.value)} placeholder={placeholder}
            style={{ width:'100%', minHeight:60, padding:'8px 10px', borderRadius:8, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(0,0,0,0.3)', color:'#fff', fontSize:12, resize:'vertical', boxSizing:'border-box', fontFamily:'inherit' }} />
          <button onClick={() => { onChange(edit); setOpen(false); }} style={{
            width:'100%', marginTop:8, padding:'10px', borderRadius:8, border:'none',
            background:'linear-gradient(135deg,#00e68a,#00c853)', color:'#000', fontWeight:700, fontSize:12, cursor:'pointer',
          }}>OK</button>
        </div>
      </div>
    </div>}
  </>;
};
