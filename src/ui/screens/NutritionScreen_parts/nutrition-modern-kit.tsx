
import React from 'react';
import { NativeIcon, type NativeIconName } from '../../native/NativeIcons';
import { makeFill } from '../../native/accent';

/** Витринный акцент питания: в APK за темой, в TG/web — минт. */
export const NUT_ACC = 'var(--nut-accent, #00e68a)';
const NUT_RGB = 'var(--nut-accent-rgb, 0,230,138)';
const nutA = makeFill(NUT_RGB);

/** Эмодзи витрин → SVG. Неизвестное — как было (совместимость). */
const HERO_ICONS: Record<string, NativeIconName> = {
  '🛒': 'bag', '📖': 'bookOpen', '📦': 'grid', '🍽': 'bowl', '🍽️': 'bowl',
  '📊': 'chart', 'ℹ️': 'message', '⭐': 'star', '🏆': 'award', '📈': 'chart',
  '🧮': 'cpu', '🥤': 'droplet', '🧑‍⚕️': 'cross', '🎯': 'target', '⚖️': 'activity',
  '📓': 'notebook', '📋': 'file', '🥗': 'leaf',
};

export const modernCardBg: React.CSSProperties = { background: '#18181b', borderRadius: 18, border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 2px 16px rgba(0,0,0,0.2)' };
export const modernInputStyle: React.CSSProperties = { width:'100%', padding:'12px 14px', borderRadius:12, background:'#202023', border:'1px solid rgba(255,255,255,0.06)', color:'#fff', fontSize:13, boxSizing:'border-box', outline:'none' };

export const ModernHero: React.FC<{ icon: string; title: string; subtitle: string; count?: number; stats?: {k:string;v:number|string;sub:string;col:string;bg:string}[]; action?: React.ReactNode }> = ({ icon, title, subtitle, count, stats, action }) => (
  <div className="modern-hero" style={{ padding:16, borderRadius:18, background:`linear-gradient(135deg, ${nutA(0.09)} 0%, #1a2a1f 45%,#18181b 100%)`, border:`1px solid ${nutA(0.14)}`, boxShadow:`0 4px 24px ${nutA(0.08)}`, position:'relative', overflow:'hidden' }}>
    <div style={{ position:'absolute', top:-30, right:-30, width:120, height:120, background:`radial-gradient(circle, ${nutA(0.12)} 0%, transparent 70%)`, borderRadius:'50%' }} />
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, position:'relative' }}>
      <div>
        <div style={{ fontSize:18, fontWeight:800, color:'#fff', letterSpacing:-0.4, display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ width:36, height:36, borderRadius:10, background:`linear-gradient(135deg, ${NUT_ACC}, var(--accent-2, #00c8a0))`, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--accent-contrast, #000)', boxShadow:`0 4px 12px ${nutA(0.25)}` }}>{HERO_ICONS[icon] ? <NativeIcon name={HERO_ICONS[icon]} size={18} /> : icon}</span>
          {title}
          {count !== undefined && <span style={{ fontSize:9, fontWeight:700, padding:'3px 7px', borderRadius:999, background: nutA(0.14), color: NUT_ACC, border:`1px solid ${nutA(0.25)}` }}>{count}</span>}
        </div>
        <div style={{ fontSize:11, color:'rgba(255,255,255,0.6)', marginTop:4, lineHeight:1.4, maxWidth:480 }}>{subtitle}</div>
      </div>
      {action && <div style={{ flexShrink:0 }}>{action}</div>}
    </div>
    {stats && stats.length > 0 && (
      <div style={{ display:'grid', gridTemplateColumns:`repeat(${stats.length},1fr)`, gap:8, marginTop:12 }}>
        {stats.map(s => (
          <div key={s.k} style={{ background:s.bg, border:`1px solid ${s.col}18`, borderRadius:12, padding:'8px 10px', textAlign:'center' as const }}>
            <div style={{ fontSize:8, color:'rgba(255,255,255,0.55)', letterSpacing:0.3, textTransform:'uppercase' as const, fontWeight:600 }}>{s.k}</div>
            <div style={{ fontSize:18, fontWeight:800, color:s.col, marginTop:2 }}>{s.v}</div>
            <div style={{ fontSize:8, color:'rgba(255,255,255,0.5)' }}>{s.sub}</div>
          </div>
        ))}
      </div>
    )}
  </div>
);

export const ModernPill: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode; accent?: string }> = ({ active, onClick, children, accent }) => (
  <button onClick={onClick} className="modern-pill" data-active={active} style={{
    padding:'6px 12px', borderRadius:999, fontSize:11, cursor:'pointer', fontWeight: active ? 700 : 500, whiteSpace:'nowrap' as const, transition:'all 0.15s',
    border: active ? `1px solid ${accent || NUT_ACC}` : '1px solid rgba(255,255,255,0.07)',
    background: active ? (accent ? `${accent}18` : `linear-gradient(135deg, ${nutA(0.18)}, ${nutA(0.12)})`) : '#202023',
    color: active ? (accent || NUT_ACC) : 'rgba(255,255,255,0.75)',
    boxShadow: active ? `0 2px 8px ${accent ? accent + '20' : nutA(0.13)}` : 'none',
  }}>{children}</button>
);

export const ModernSearch: React.FC<{ value: string; onChange: (v:string)=>void; placeholder: string }> = ({ value, onChange, placeholder }) => (
  <div className="modern-search" style={{ position:'relative' }}>
    <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', display:'inline-flex', color:'rgba(255,255,255,0.35)' }}><NativeIcon name="search" size={13} /></span>
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ ...modernInputStyle, paddingLeft:36, paddingRight: value ? 36 : 14, background:'#202023' }} />
    {value && <button onClick={() => onChange('')} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', width:22, height:22, borderRadius:999, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.6)', cursor:'pointer', fontSize:10 }}>✕</button>}
  </div>
);
