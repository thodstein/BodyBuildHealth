/** PeriodizationPopups.tsx — попапы хаба периодизации (вынесено из PeriodizationDesignerTab, байт-в-байт).
 * Bottom-sheet вместо нативных select: PhOverlay + PhSelect. */
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

export const PhOverlay: React.FC<{ onClose: () => void; accent: string; title: string; children: React.ReactNode }> = ({ onClose, accent, title, children }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setMounted(true), 10);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { window.clearTimeout(t); window.removeEventListener('keydown', onKey); };
  }, [onClose]);
  return (
    <div onClick={onClose} role="presentation" style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.66)', backdropFilter:'blur(6px)', display:'flex', alignItems:'flex-end', justifyContent:'center', padding:12, opacity: mounted ? 1 : 0, transition:'opacity 0.18s ease' }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title} style={{ width:'100%', maxWidth:440, maxHeight:'82vh', borderRadius:'18px 18px 14px 14px', background:'rgba(20,21,26,0.97)', border:'1px solid rgba(255,255,255,0.10)', overflow:'hidden', boxShadow:'0 24px 70px rgba(0,0,0,0.6)', transform: mounted ? 'translateY(0)' : 'translateY(24px)', transition:'transform 0.2s ease' }}>
        <div style={{ height:4, background:`linear-gradient(90deg,${accent},${accent}88)` }} />
        <div style={{ padding:'12px 14px 14px', maxHeight:'calc(82vh - 4px)', overflowY:'auto' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <div style={{ fontSize:13, fontWeight:900, color:accent }}>{title}</div>
            <button onClick={onClose} aria-label="Закрыть попап" style={{ width:34, height:34, borderRadius:10, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.05)', color:'#fff', fontSize:14, cursor:'pointer' }}>✕</button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
};
export const PhSelect: React.FC<{ label: string; value: string; accent: string; options: Array<{ id: string; label: string; desc?: string }>; onChange: (v: string) => void; title?: string }> = ({ label, value, accent, options, onChange, title }) => {
  const [open, setOpen] = useState(false);
  const sel = options.find(o => o.id === value);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" style={{ width:'100%', padding:'10px 12px', borderRadius:11, cursor:'pointer', textAlign:'left', minHeight:48, background: value ? accent+'10' : 'rgba(255,255,255,0.03)', border:`1px solid ${value ? accent+'44' : 'rgba(255,255,255,0.09)'}`, color:'#fff' }}>
        <div style={{ fontSize:10, color:'#fff', opacity:0.75, fontWeight:700, marginBottom:2 }}>{label}</div>
        <div style={{ fontSize:12, fontWeight:800, color: value ? accent : '#fff', display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
          <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{sel ? sel.label : 'Выбрать…'}</span>
          <span style={{ fontSize:12, opacity:0.7 }}>▾</span>
        </div>
        {sel?.desc && <div style={{ fontSize:10, color:'#fff', opacity:0.7, marginTop:2 }}>{sel.desc}</div>}
      </button>
      {open && typeof document !== 'undefined' && ReactDOM.createPortal(
        <PhOverlay onClose={() => setOpen(false)} accent={accent} title={title || label}>
          <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
            {options.map(o => {
              const active = o.id === value;
              return (
                <button key={o.id} type="button" onClick={() => { onChange(o.id); setOpen(false); }} aria-pressed={active} style={{ display:'block', width:'100%', padding:'11px 12px', borderRadius:12, cursor:'pointer', textAlign:'left', minHeight:48, background: active ? accent+'16' : 'rgba(255,255,255,0.03)', border:`1px solid ${active ? accent+'55' : 'rgba(255,255,255,0.07)'}`, color: active ? accent : '#fff' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, fontSize:12, fontWeight: active ? 800 : 600 }}>
                    <span>{o.label}</span>{active && <span>✓</span>}
                  </div>
                  {o.desc && <div style={{ fontSize:10, color:'#fff', opacity:0.72, marginTop:3, lineHeight:1.4 }}>{o.desc}</div>}
                </button>
              );
            })}
          </div>
        </PhOverlay>,
        document.body,
      )}
    </>
  );
};

export default PhSelect;
