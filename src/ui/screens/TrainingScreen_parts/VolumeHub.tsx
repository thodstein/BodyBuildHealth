/** VolumeHub.tsx — ЕДИНЫЙ хаб объёма без дублей (полированный, как Интеллект).
 *  Объединяет VolumeOptimizerTab (MEV/MAV/MRV), TonnageCalcTab (тоннаж/КПШ/УОИ) и PlateCalcTab (блины).
 *  Без дублей: объём считался в 3 местах — теперь единый расчёт. Белый текст, стекло, градиенты.
 */
import React, { useState } from 'react';
import { VolumeOptimizerTab } from './VolumeOptimizerTab';
import { TonnageCalcTab } from './TonnageCalcTab';
import { PlateCalcTab } from './PlateCalcTab';

const ACCENT = '#00e68a';
const GLASS: React.CSSProperties = { background: 'rgba(24,24,27,0.42)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)', transition:'all 0.18s ease' };
const CARD: React.CSSProperties = { ...GLASS, borderRadius: 14, padding: 12, marginBottom: 10, transition:'all 0.18s ease' };
const DIM = '#fff';
const SMALL: React.CSSProperties = { fontSize: 10, color: '#fff', lineHeight: 1.45 };

type HubMode = 'volume' | 'tonnage' | 'plates';

const MODE_DEFS: Array<{ m: HubMode; label: string; icon: string; desc: string; accent: string; hint: string }> = [
  { m: 'volume', label: 'Объём', icon: '📐', accent: '#22c55e', desc: 'MEV/MAV/MRV, оптимизация, SFR, прогрессия', hint: 'По мышцам · сеты vs MEV/MAV/MRV · частота · SFR' },
  { m: 'tonnage', label: 'Тоннаж', icon: '⚖️', accent: '#3b82f6', desc: 'Тоннаж/КПШ/УОИ, зоны интенсивности', hint: 'вес×репы×сеты · КПШ · УОИ · зоны <60/60-80/>80%' },
  { m: 'plates', label: 'Блины', icon: '🥞', accent: '#f59e0b', desc: 'Грифы 8 типов, блины, %1RM, разминка', hint: 'Подбор блинов · 1RM-пресеты · SVG грифа · разминка' },
];

export const VolumeHub: React.FC<{ initialMode?: HubMode }> = ({ initialMode }) => {
  const [mode, setMode] = useState<HubMode>(initialMode ?? 'volume');
  const active = MODE_DEFS.find(d => d.m === mode)!;

  return (
    <div className="train-volumehub" style={{ padding: '10px 8px 18px', color: '#fff', maxWidth: 760, margin: '0 auto' }}>
      {/* header */}
      <div style={{ ...CARD, padding:'14px 14px 12px', background:'linear-gradient(135deg,rgba(34,197,94,0.10),rgba(59,130,246,0.07))', border:'1px solid rgba(34,197,94,0.18)', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-18, right:-18, width:110, height:110, borderRadius:110, background:'radial-gradient(circle,rgba(34,197,94,0.16),transparent 70%)', pointerEvents:'none' }} />
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
          <div style={{ width:34, height:34, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#00e68a,#00c853)', color:'#000', fontWeight:900, fontSize:16 }}>📐</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:15, fontWeight:900, color:'#fff', lineHeight:1 }}>Объём — единый хаб</div>
            <div style={{ fontSize:10, color:'#fff', lineHeight:1.3 }}>MEV/MAV/MRV + тоннаж/КПШ + блины — один расчёт без дублей</div>
          </div>
          <span style={{ fontSize:9, padding:'4px 8px', borderRadius:20, background:'rgba(34,197,94,0.12)', border:'1px solid rgba(34,197,94,0.22)', color:ACCENT, fontWeight:800, whiteSpace:'nowrap' }}>без дублей</span>
        </div>
        <div style={{ fontSize:10, color:'#fff', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, padding:'8px 10px', lineHeight:1.45 }}>
          <b style={{ color:'#fff' }}>Как читать:</b> <span style={{ color:'#fff' }}>«Объём»</span> — по мышцам (сеты vs MEV/MAV/MRV, % от MRV, частота). <span style={{ color:'#fff' }}>«Тоннаж»</span> — вес×репы×сеты + КПШ + УОИ + зоны &lt;60/60-80/&gt;80%. <span style={{ color:'#fff' }}>«Блины»</span> — подбор блинов под гриф/вес, 1RM-% пресеты, SVG. Источники: Israetel MEV/MAV/MRV, Helms 2019, Schoenfeld 2017, Prilepin 1974 (КПШ).
        </div>
      </div>

      {/* summary strip */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginBottom:10 }}>
        {MODE_DEFS.map(d => {
          const isActive = mode === d.m;
          return (
            <div key={d.m} onClick={()=> setMode(d.m)} style={{ ...CARD, marginBottom:0, padding:10, cursor:'pointer', borderLeft:`3px solid ${d.accent}`, background: isActive ? `${d.accent}12` : 'rgba(24,24,27,0.42)', border: isActive ? `1px solid ${d.accent}55` : '1px solid rgba(255,255,255,0.07)', minHeight:72 }}>
              <div style={{ fontSize:9, fontWeight:800, color:d.accent, letterSpacing:0.4, textTransform:'uppercase' }}>{d.icon} {d.label}</div>
              <div style={{ fontSize:11, fontWeight:800, color:'#fff', lineHeight:1.2, marginTop:4 }}>{d.desc}</div>
              <div style={{ fontSize:9, color:'#fff', marginTop:4, lineHeight:1.3 }}>{d.hint}</div>
            </div>
          );
        })}
      </div>

      {/* sticky nav */}
      <div style={{ position:'sticky', top:0, zIndex:5, margin:'-2px -8px 10px', padding:'8px 8px 8px', background:'rgba(10,10,12,0.72)', backdropFilter:'blur(10px)', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', gap:6, overflowX:'auto', scrollbarWidth:'none' }}>
        {MODE_DEFS.map(({ m, label, icon, desc }) => {
          const isActive = mode === m;
          const accent = MODE_DEFS.find(x=> x.m===m)!.accent;
          return (
            <button key={m} onClick={() => setMode(m)} title={desc} style={{
              flex:'0 0 auto', display:'flex', alignItems:'center', gap:6, padding:'7px 11px', borderRadius:20, cursor:'pointer', fontSize:11, fontWeight:800, whiteSpace:'nowrap',
              border: isActive ? `1px solid ${accent}` : '1px solid rgba(255,255,255,0.08)',
              background: isActive ? `${accent}18` : 'rgba(255,255,255,0.04)',
              color: isActive ? accent : '#fff', transition:'all 0.16s',
            }}>
              <span>{icon}</span> {label}
            </button>
          );
        })}
      </div>

      {/* content */}
      <div style={{ ...CARD, padding:0, overflow:'hidden', background:'rgba(24,24,27,0.30)' }}>
        <div style={{ padding:'8px 10px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ width:26, height:26, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background: `${active.accent}18`, border:`1px solid ${active.accent}33`, fontSize:14 }}>{active.icon}</span>
          <div>
            <div style={{ fontSize:12, fontWeight:900, color:active.accent }}>{active.label} · {active.desc}</div>
            <div style={{ fontSize:10, color:'#fff' }}>{active.hint}</div>
          </div>
        </div>
        <div style={{ padding: 10 }}>
          {mode === 'volume' && <VolumeOptimizerTab />}
          {mode === 'tonnage' && <TonnageCalcTab />}
          {mode === 'plates' && <PlateCalcTab />}
        </div>
      </div>

      <div style={{ fontSize:10, color:'#fff', textAlign:'center', marginTop:10, lineHeight:1.45, opacity:0.9 }}>
        Единый хаб без дублей — объём только в «Объёме», тоннаж только в «Тоннаже», блины только в «Блинах». Связный конвейер, а не 3 разрозненных калькулятора.
      </div>
    </div>
  );
};

export default VolumeHub;
