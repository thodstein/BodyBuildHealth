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
    <div style={{ padding: '8px 4px 24px', color: '#fff', maxWidth: 760, margin: '0 auto', display:'flex', flexDirection:'column', gap:12 }}>
      <div style={{ ...CARD, padding:'16px', background:'linear-gradient(135deg, rgba(0,230,138,0.12), rgba(96,165,250,0.08), rgba(139,92,246,0.06))', border:'1px solid rgba(255,255,255,0.08)', position:'relative', overflow:'hidden', borderRadius:18 }}>
        <div style={{ position:'absolute', top:-20, right:-20, width:120, height:120, borderRadius:120, background:'radial-gradient(circle, rgba(0,230,138,0.18), transparent 68%)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:-30, left:-10, width:180, height:80, borderRadius:60, background:'radial-gradient(circle, rgba(96,165,250,0.12), transparent 70%)', pointerEvents:'none' }} />
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8, position:'relative' }}>
          <div style={{ width:40, height:40, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#00e68a,#00c853)', color:'#000', fontWeight:900, fontSize:18, boxShadow:'0 4px 16px rgba(0,230,138,0.35)', flexShrink:0 }}>🧮</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:16, fontWeight:900, color:'#fff', lineHeight:1.15, letterSpacing:'-0.3px' }}>Расчёты выбора препаратов</div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,0.72)', lineHeight:1.35 }}>Единый центр — 5 калькуляторов без дублей</div>
          </div>
          <span style={{ fontSize:11, padding:'6px 10px', borderRadius:20, background:'rgba(0,230,138,0.14)', border:'1px solid rgba(0,230,138,0.22)', color:ACCENT, fontWeight:800, whiteSpace:'nowrap', flexShrink:0 }}>5 в 1</span>
        </div>
        <div style={{ fontSize:11.5, color:'rgba(255,255,255,0.78)', background:'rgba(0,0,0,0.18)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:12, padding:'10px 12px', lineHeight:1.5, position:'relative' }}>
          <b style={{ color:'#fff' }}>Как работает:</b> выбери препарат один раз — все 5 расчётов (<span style={{ color:'#a78bfa', fontWeight:700 }}>био</span> → <span style={{ color:ACCENT, fontWeight:700 }}>доза</span> → <span style={{ color:'#60a5fa', fontWeight:700 }}>синергия</span> → <span style={{ color:'#f59e0b', fontWeight:700 }}>тайминг</span> → <span style={{ color:'#ec4899', fontWeight:700 }}>аналоги</span>) на одних данных. ААС вынесены отдельно.
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
        {MODE_DEFS.slice(0,3).map(d=> {
          const isActive = mode===d.m;
          return (
            <div key={d.m} onClick={()=> setMode(d.m)} onMouseEnter={e => { if(!isActive) (e.currentTarget as HTMLDivElement).style.borderColor = `${d.accent}35`; }} onMouseLeave={e => { if(!isActive) (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.07)'; }} style={{ ...CARD, marginBottom:0, padding:12, cursor:'pointer', borderLeft:`4px solid ${d.accent}`, background: isActive ? `${d.accent}14` : 'rgba(24,24,27,0.50)', border: isActive ? `1px solid ${d.accent}45` : '1px solid rgba(255,255,255,0.07)', minHeight:84, boxShadow: isActive ? `0 4px 20px ${d.accent}18` : '0 2px 12px rgba(0,0,0,0.2)', transition:'all 0.18s' }}>
              <div style={{ fontSize:10, fontWeight:800, color:d.accent, letterSpacing:0.5, textTransform:'uppercase', display:'flex', alignItems:'center', gap:4 }}>{d.icon} {d.label}</div>
              <div style={{ fontSize:12, fontWeight:700, color:'#fff', lineHeight:1.25, marginTop:5 }}>{d.desc}</div>
              <div style={{ fontSize:10.5, color:'rgba(255,255,255,0.5)', lineHeight:1.3, marginTop:4 }}>{d.hint}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        {MODE_DEFS.slice(3).map(d=> {
          const isActive = mode===d.m;
          return (
            <div key={d.m} onClick={()=> setMode(d.m)} onMouseEnter={e => { if(!isActive) (e.currentTarget as HTMLDivElement).style.borderColor = `${d.accent}35`; }} onMouseLeave={e => { if(!isActive) (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.07)'; }} style={{ ...CARD, marginBottom:0, padding:12, cursor:'pointer', borderLeft:`4px solid ${d.accent}`, background: isActive ? `${d.accent}14` : 'rgba(24,24,27,0.50)', border: isActive ? `1px solid ${d.accent}45` : '1px solid rgba(255,255,255,0.07)', minHeight:82, boxShadow: isActive ? `0 4px 20px ${d.accent}18` : '0 2px 12px rgba(0,0,0,0.2)', transition:'all 0.18s' }}>
              <div style={{ fontSize:10, fontWeight:800, color:d.accent, letterSpacing:0.5, textTransform:'uppercase', display:'flex', alignItems:'center', gap:4 }}>{d.icon} {d.label}</div>
              <div style={{ fontSize:12, fontWeight:700, color:'#fff', lineHeight:1.25, marginTop:5 }}>{d.desc}</div>
              <div style={{ fontSize:10.5, color:'rgba(255,255,255,0.5)', lineHeight:1.3, marginTop:4 }}>{d.hint}</div>
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
