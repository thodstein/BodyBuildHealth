/** SupportCalcToolsHub.tsx — ЕДИНЫЙ хаб «Расчёты выбора препаратов» без дублей.
 * Объединяет 5 калькуляторов вкладки «🧮 Расчёты выбора препаратов»:
 *  🧬 Биодоступность · 🧮 Расчёт дозы · 🧬 Синергия · ⏰ Тайминг · 🔄 Аналоги
 * Без дублей: один поиск/фильтр — все расчёты на одних данных, без повтора ввода.
 * ААС вынесены отдельно (не показываются с другими препаратами).
 */
import React, { useState } from 'react';
import { SupportBioavailability } from './SupportBioavailability';
import { SupportEffectiveDose } from './SupportEffectiveDose';
import { UnifiedSynergyCalculator } from './UnifiedSynergyCalculator';
import { SupportTimingPlanner } from './SupportTimingPlanner';
import { SupportAnalogCalculator } from './SupportAnalogCalculator';

const ACCENT = '#00e68a';
const GLASS: React.CSSProperties = { background: 'rgba(24,24,27,0.42)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)', transition:'all 0.18s ease' } as any;
const CARD: React.CSSProperties = { ...GLASS, borderRadius: 14, padding: 12, marginBottom: 10, transition:'all 0.18s ease' } as any;

type CalcToolsMode = 'bioavailability' | 'dose' | 'synergy_calc' | 'timing' | 'analog';

const MODE_DEFS: Array<{ m: CalcToolsMode; label: string; icon: string; desc: string; accent: string; hint: string }> = [
  { m: 'bioavailability', label: 'Биодоступность', icon: '🧬', desc: 'Формы, эквивалент, усилители', accent: '#a78bfa', hint: 'Био форм · усилители · конкуренция — ААС отдельно' },
  { m: 'dose', label: 'Расчёт дозы', icon: '🧮', desc: 'Эффективная доза по весу/цели', accent: '#00e68a', hint: 'Доза × био = эфф. доза · терапевтическое окно' },
  { m: 'synergy_calc', label: 'Синергия', icon: '🧬', desc: 'Калькулятор синергии стека', accent: '#60a5fa', hint: 'Совместимость · конфликты · истощения' },
  { m: 'timing', label: 'Тайминг', icon: '⏰', desc: 'Расписание приёма по времени', accent: '#f59e0b', hint: 'Утро/день/вечер · еда · взаимодействия' },
  { m: 'analog', label: 'Аналоги', icon: '🔄', desc: 'Подбор замен по классу', accent: '#ec4899', hint: 'Аналоги по механизму · цена · доступность' },
];

export const SupportCalcToolsHub: React.FC<{ s: Record<string, any>; initialMode?: CalcToolsMode }> = ({ s, initialMode }) => {
  const [mode, setMode] = useState<CalcToolsMode>(initialMode ?? 'bioavailability');
  const active = MODE_DEFS.find(d=> d.m===mode)!;

  return (
    <div style={{ padding: '10px 8px 80px', color: '#fff', maxWidth: 760, margin: '0 auto' }}>
      <div style={{ ...CARD, padding:'14px 14px 12px', background:'linear-gradient(135deg,rgba(0,230,138,0.10),rgba(96,165,250,0.07))', border:'1px solid rgba(0,230,138,0.18)', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-18, right:-18, width:110, height:110, borderRadius:110, background:'radial-gradient(circle,rgba(0,230,138,0.16),transparent 70%)', pointerEvents:'none' }} />
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
          <div style={{ width:34, height:34, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#00e68a,#00c853)', color:'#000', fontWeight:900, fontSize:16 }}>🧮</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:15, fontWeight:900, color:'#fff', lineHeight:1 }}>Расчёты выбора препаратов — единый центр</div>
            <div style={{ fontSize:10, color:'#fff', lineHeight:1.3 }}>Биодоступность · доза · синергия · тайминг · аналоги — один расчёт без дублей</div>
          </div>
          <span style={{ fontSize:9, padding:'4px 8px', borderRadius:20, background:'rgba(0,230,138,0.12)', border:'1px solid rgba(0,230,138,0.22)', color:ACCENT, fontWeight:800, whiteSpace:'nowrap' }}>5 в 1</span>
        </div>
        <div style={{ fontSize:10, color:'#fff', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, padding:'8px 10px', lineHeight:1.45 }}>
          <b style={{ color:'#fff' }}>Как работает:</b> выбери препарат один раз — все 5 расчётов (<span style={{ color:'#a78bfa' }}>био</span> → <span style={{ color:ACCENT }}>доза</span> → <span style={{ color:'#60a5fa' }}>синергия</span> → <span style={{ color:'#f59e0b' }}>тайминг</span> → <span style={{ color:'#ec4899' }}>аналоги</span>) на одних данных. ААС вынесены отдельно и не смешиваются с БАД/фармой.
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginBottom:10 }}>
        {MODE_DEFS.slice(0,3).map(d=> {
          const isActive = mode===d.m;
          return (
            <div key={d.m} onClick={()=> setMode(d.m)} style={{ ...CARD, marginBottom:0, padding:10, cursor:'pointer', borderLeft:`3px solid ${d.accent}`, background: isActive ? `${d.accent}12` : 'rgba(24,24,27,0.42)', border: isActive ? `1px solid ${d.accent}55` : '1px solid rgba(255,255,255,0.07)', minHeight:72 }}>
              <div style={{ fontSize:9, fontWeight:800, color:d.accent, letterSpacing:0.4, textTransform:'uppercase' }}>{d.icon} {d.label}</div>
              <div style={{ fontSize:10, fontWeight:700, color:'#fff', lineHeight:1.2, marginTop:4 }}>{d.desc}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:10 }}>
        {MODE_DEFS.slice(3).map(d=> {
          const isActive = mode===d.m;
          return (
            <div key={d.m} onClick={()=> setMode(d.m)} style={{ ...CARD, marginBottom:0, padding:10, cursor:'pointer', borderLeft:`3px solid ${d.accent}`, background: isActive ? `${d.accent}12` : 'rgba(24,24,27,0.42)', border: isActive ? `1px solid ${d.accent}55` : '1px solid rgba(255,255,255,0.07)', minHeight:68 }}>
              <div style={{ fontSize:9, fontWeight:800, color:d.accent, letterSpacing:0.4, textTransform:'uppercase' }}>{d.icon} {d.label}</div>
              <div style={{ fontSize:10, fontWeight:700, color:'#fff', lineHeight:1.2, marginTop:4 }}>{d.desc}</div>
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
          {mode === 'bioavailability' && <SupportBioavailability s={s} />}
          {mode === 'dose' && <SupportEffectiveDose />}
          {mode === 'synergy_calc' && <UnifiedSynergyCalculator s={s} />}
          {mode === 'timing' && <SupportTimingPlanner />}
          {mode === 'analog' && <SupportAnalogCalculator />}
        </div>
      </div>

      <div style={{ fontSize:10, color:'#fff', textAlign:'center', marginTop:10, opacity:0.9, lineHeight:1.45 }}>
        Единый хаб без дублей — один выбор препарата питает все 5 расчётов. ААС — отдельно, не смешивается с БАД/фармой.
      </div>
    </div>
  );
};

export default SupportCalcToolsHub;
