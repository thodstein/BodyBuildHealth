/** MixHub.tsx — тренировочные миксы/пресеты здоровья.
 * Объединяет: TrainingMixTab (пред/интра/пост по цели тренировки) + MixPresetsCard (7 пресетов здоровья).
 * Структура как в VolumeHub / PeriodizationTaperHub — единый расчёт, без дублей. */
import React, { useState } from 'react';
import { TrainingMixTab } from './TrainingMixTab';
import { MixPresetsCard } from './MixPresetsCard';

const ACCENT = '#00e68a';
const DIM = '#fff';
const GLASS: React.CSSProperties = { background: 'rgba(24,24,27,0.42)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)', transition:'all 0.18s ease' } as any;
const CARD: React.CSSProperties = { ...GLASS, borderRadius: 14, padding: 12, marginBottom: 10, transition:'all 0.18s ease' } as any;
type MixHubMode = 'training' | 'health';

const MODE_DEFS: Array<{ m: MixHubMode; label: string; icon: string; desc: string; accent: string; hint: string }> = [
  { m: 'training', label: 'Тренировочные', icon: '💪', desc: 'Цель: памп/выносливость/сила/фокус — пред/интра/пост', accent: '#00e68a', hint: 'Подбор по цели + тип/время/опыт/фарма · скоринг' },
  { m: 'health', label: 'Пресеты здоровья', icon: '🛡️', desc: 'Жиросжиг/суставы/ЖКТ/сон/гидра/противовоспал/иммунитет', accent: '#60a5fa', hint: '7 готовых стеков pre/intra/post по весу' },
];

export const MixHub: React.FC<{ initialMode?: MixHubMode }> = ({ initialMode }) => {
  const [mode, setMode] = useState<MixHubMode>(initialMode ?? 'training');
  const active = MODE_DEFS.find(d=> d.m===mode)!;

  return (
    <div style={{ padding: '10px 8px 18px', color: '#fff', maxWidth: 760, margin: '0 auto' }}>
      <div style={{ ...CARD, padding:'14px 14px 12px', background:'linear-gradient(135deg,rgba(236,72,153,0.10),rgba(0,230,138,0.07))', border:'1px solid rgba(236,72,153,0.18)', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-18, right:-18, width:110, height:110, borderRadius:110, background:'radial-gradient(circle,rgba(236,72,153,0.14),transparent 70%)', pointerEvents:'none' }} />
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
          <div style={{ width:34, height:34, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#ec4899,#00e68a)', color:'#fff', fontWeight:900, fontSize:16 }}>🧪</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:15, fontWeight:900, color:'#fff', lineHeight:1 }}>Миксы — единый хаб</div>
            <div style={{ fontSize:10, color:'#fff', lineHeight:1.3 }}>Тренировочные + пресеты здоровья — один расчёт, без дублей</div>
          </div>
          <span style={{ fontSize:9, padding:'4px 8px', borderRadius:20, background:'rgba(236,72,153,0.12)', border:'1px solid rgba(236,72,153,0.22)', color:'#ec4899', fontWeight:800, whiteSpace:'nowrap' }}>ISSN · Examine</span>
        </div>
        <div style={{ fontSize:10, color:'#fff', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, padding:'8px 10px', lineHeight:1.45 }}>
          <b style={{ color:'#fff' }}>Как работает:</b> <span style={{ color:ACCENT }}>тренировочные</span> — цель тренировки → пред/интра/пост (скоринг + фарма), <span style={{ color:'#60a5fa' }}>пресеты</span> — 7 готовых составов pre/intra/post по весу. Сохранение → дневник + избранное + план поддержки.
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:10 }}>
        {MODE_DEFS.map(d=> {
          const isActive = mode===d.m;
          return (
            <div key={d.m} onClick={()=> setMode(d.m)} style={{ ...CARD, marginBottom:0, padding:10, cursor:'pointer', borderLeft:`3px solid ${d.accent}`, background: isActive ? `${d.accent}12` : 'rgba(24,24,27,0.42)', border: isActive ? `1px solid ${d.accent}55` : '1px solid rgba(255,255,255,0.07)', minHeight:72 }}>
              <div style={{ fontSize:9, fontWeight:800, color:d.accent, letterSpacing:0.4, textTransform:'uppercase' }}>{d.icon} {d.label}</div>
              <div style={{ fontSize:11, fontWeight:800, color:'#fff', lineHeight:1.2, marginTop:4 }}>{d.desc}</div>
              <div style={{ fontSize:9, color:'#fff', marginTop:4 }}>{d.hint}</div>
            </div>
          );
        })}
      </div>

      <div style={{ position:'sticky', top:0, zIndex:5, margin:'-2px -8px 10px', padding:'8px 8px', background:'rgba(10,10,12,0.72)', backdropFilter:'blur(10px)', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', gap:6, overflowX:'auto', scrollbarWidth:'none' }}>
        {MODE_DEFS.map(({ m, label, icon, desc, accent }) => {
          const isActive = mode===m;
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

      <div style={{ ...CARD, padding:0, overflow:'hidden', background:'rgba(24,24,27,0.30)' }}>
        <div style={{ padding:'8px 10px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ width:26, height:26, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:`${active.accent}18`, border:`1px solid ${active.accent}33`, fontSize:14 }}>{active.icon}</span>
          <div>
            <div style={{ fontSize:12, fontWeight:900, color:active.accent }}>{active.label} · {active.desc}</div>
            <div style={{ fontSize:10, color:'#fff' }}>{active.hint}</div>
          </div>
        </div>
        <div style={{ padding: 10 }}>
          {mode === 'training' && <TrainingMixTab />}
          {mode === 'health' && <MixPresetsCard />}
        </div>
      </div>

      <div style={{ fontSize:10, color:'#fff', textAlign:'center', marginTop:10, opacity:0.9, lineHeight:1.45 }}>
        Единый хаб без дублей — тренировочные миксы (цель → пред/интра/пост) + пресеты здоровья (7 стеков) в одном месте.
      </div>
    </div>
  );
};

export default MixHub;
