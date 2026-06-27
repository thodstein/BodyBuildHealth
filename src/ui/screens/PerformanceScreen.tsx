import React, { useState, useMemo } from 'react';
import { useDataLink } from '../../core/data-link';
import { getBloodMarkersDeep, getCriticalMarkers, getSupplementStacks, calculateFullMacros, calculateMealSplit } from '../../engines/blood-stack-macro.engine';
import { getPeriodizationModels, getBBContestPrep, getPCTProtocols, generateMeetStrategy, type MeetStrategy } from '../../engines/periodization-meet-pct.engine';
import { predictStrength, computePRI, type PredictionInput } from '../../engines/prediction-models-engine';

export const PerformanceScreen: React.FC = () => {
  const linked = useDataLink();
  const [tab, setTab] = useState('blood');
  const bloodMarkers = useMemo(() => getBloodMarkersDeep(), []);
  const criticalMarkers = useMemo(() => getCriticalMarkers(), []);
  const stacks = useMemo(() => getSupplementStacks(), []);

  const s = linked.profile?.settings;
  const [macroWeight, setMacroWeight] = useState(s?.weight ?? 80);
  const [macroH, setMacroH] = useState(s?.height ?? 175);
  const [macroAge, setMacroAge] = useState(s?.age ?? 30);
  const [macroBf, setMacroBf] = useState(s?.bodyFat ?? 15);
  const [macroGoal, setMacroGoal] = useState<'bulk'|'cut'|'maintenance'>('bulk');
  const macroResult = useMemo(() => calculateFullMacros(macroWeight, macroH, macroAge, 'male', macroBf, 'moderate', macroGoal), [macroWeight, macroH, macroAge, macroBf, macroGoal]);
  const mealSplit = useMemo(() => calculateMealSplit(macroResult.goals[macroGoal].kcal, macroResult.goals[macroGoal].protein, 5), [macroResult, macroGoal]);

  const [meetSquat, setMeetSquat] = useState(200);
  const [meetBench, setMeetBench] = useState(140);
  const [meetDeadlift, setMeetDeadlift] = useState(250);
  const [meetBodyW, setMeetBodyW] = useState(83);
  const [meetFed, setMeetFed] = useState('IPF');
  const [meetResult, setMeetResult] = useState<ReturnType<typeof generateMeetStrategy> | null>(null);

  const periodizationModels = useMemo(() => getPeriodizationModels(), []);
  const bbPrep = useMemo(() => getBBContestPrep(), []);
  const pctProtocols = useMemo(() => getPCTProtocols(), []);

  const tabs = ['blood','stacks','macro','periodization','meet','bbprep','pct','predict'];
  const labels: Record<string,string> = {blood:'🩸 Маркеры',stacks:'📦 Стеки',macro:'📐 Макро',periodization:'🔄 Периодизация',meet:'🏆 Соревн.',bbprep:'🏋 Бодибилдинг',pct:'🧬 ПКТ',predict:'🔮 Прогноз'};

  return (<div className="screen">
    <h2>⚡ Лаборатория</h2>
    <div style={{ display:'flex', gap:3, marginBottom:10, overflowX:'auto', scrollbarWidth:'none' }}>
      {tabs.map(t => <button key={t} onClick={()=>setTab(t)} style={{ padding:'6px 10px', borderRadius:8, fontSize:11, cursor:'pointer', whiteSpace:'nowrap', background:tab===t?'var(--accent-green)':'var(--bg-secondary)', color:tab===t?'#000':'var(--text-dim)', border:'none', fontWeight:tab===t?700:400 }}>{labels[t]}</button>)}
    </div>

    {tab==='blood' && <div>
      <div className="card" style={{ marginBottom:8 }}><h4 style={{ margin:'0 0 4px', fontSize:12 }}>⚠ Критические маркеры</h4>
        {criticalMarkers.slice(0,6).map((m,i)=><div key={i} style={{ fontSize:9, padding:'3px 6px', borderBottom:'1px solid rgba(255,255,255,0.03)' }}><b>{m.name}</b> ({m.code}) — {m.whatItMeans}</div>)}
      </div>
      {bloodMarkers.slice(0,8).map((m,i)=><div key={i} className="card" style={{ marginBottom:4, padding:8 }}>
        <div style={{ fontWeight:600, fontSize:11 }}>{m.name} ({m.code}) — {m.optimalRange} {m.unit}</div>
        <div style={{ fontSize:8, color:'var(--text-light)', marginTop:2 }}>{m.whatItMeans}</div>
        {m.actionPlan?.slice(0,2).map((a,ai)=><div key={ai} style={{ fontSize:8, color:'#f59e0b', marginTop:1 }}>• {a.condition}: {a.action}</div>)}
      </div>)}
    </div>}

    {tab==='stacks' && <div>
      {stacks.map((s,i)=><div key={i} className="card" style={{ marginBottom:6, padding:10 }}>
        <div style={{ fontWeight:600, fontSize:12 }}>{s.name} ({s.goal}) <span style={{ fontSize:9, color:'var(--text-dim)' }}>{s.level} · {s.monthlyCost}</span></div>
        <div style={{ fontSize:9, color:'var(--text-light)', marginTop:4 }}>{s.supplements.map(x=>`${x.name} ${x.dosage} (${x.timing})`).join(' · ')}</div>
        {s.expectedBenefits?.slice(0,3).map((b,bi)=><div key={bi} style={{ fontSize:8, color:'#22c55e' }}>✓ {b}</div>)}
      </div>)}
    </div>}

    {tab==='macro' && <div className="card">
      <h4 style={{ margin:'0 0 8px', fontSize:12 }}>🧮 Полный расчёт макро</h4>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
        <div><label style={{ fontSize:10 }}>Вес (кг)</label><input type="number" value={macroWeight} onChange={e=>setMacroWeight(parseFloat(e.target.value) || 0)} style={{ width:'100%',padding:'6px',borderRadius:6,background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text)',fontSize:12,boxSizing:'border-box' }} /></div>
        <div><label style={{ fontSize:10 }}>Рост (см)</label><input type="number" value={macroH} onChange={e=>setMacroH(parseFloat(e.target.value) || 0)} style={{ width:'100%',padding:'6px',borderRadius:6,background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text)',fontSize:12,boxSizing:'border-box' }} /></div>
        <div><label style={{ fontSize:10 }}>Возраст</label><input type="number" value={macroAge} onChange={e=>setMacroAge(parseFloat(e.target.value) || 0)} style={{ width:'100%',padding:'6px',borderRadius:6,background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text)',fontSize:12,boxSizing:'border-box' }} /></div>
        <div><label style={{ fontSize:10 }}>BF%</label><input type="number" value={macroBf} onChange={e=>setMacroBf(parseFloat(e.target.value) || 0)} style={{ width:'100%',padding:'6px',borderRadius:6,background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text)',fontSize:12,boxSizing:'border-box' }} /></div>
        <div><label style={{ fontSize:10 }}>Цель</label><select value={macroGoal || ''} onChange={e=>setMacroGoal(e.target.value as any)} style={{ width:'100%',padding:'6px',borderRadius:6,background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text)',fontSize:12 }}><option value="bulk">Набор</option><option value="cut">Сушка</option><option value="maintenance">Поддержание</option></select></div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'2px 12px', fontSize:10, marginTop:8 }}>
        <span>BMR:</span><span style={{ fontWeight:600 }}>{macroResult.bmr.mifflin} ккал</span>
        <span>Katch:</span><span style={{ fontWeight:600 }}>{macroResult.bmr.katch} ккал</span>
        <span>TDEE (moderate):</span><span style={{ fontWeight:600 }}>{macroResult.tdee.moderate} ккал</span>
      </div>
      <h5 style={{ margin:'10px 0 4px', fontSize:11 }}>Цель: {macroGoal === 'bulk' ? '' : macroGoal === 'cut' ? '' : ''}</h5>
      <div style={{ fontSize:10 }}>Ккал: <b>{macroResult.goals[macroGoal].kcal}</b> | Б: <b>{macroResult.goals[macroGoal].protein}г</b> | Ж: <b>{macroResult.goals[macroGoal].fat}г</b> | У: <b>{macroResult.goals[macroGoal].carbs}г</b></div>
      <h5 style={{ margin:'8px 0 4px', fontSize:11 }}>Разбивка по 5 приёмам:</h5>
      {mealSplit.map((m,i)=><div key={i} style={{ fontSize:9, padding:'2px 0', display:'flex',gap:8 }}><span>Приём {m.meal}:</span><span>{m.kcal} ккал</span><span>Б:{m.protein}г</span><span>Ж:{m.fat}г</span><span>У:{m.carbs}г</span></div>)}
    </div>}

    {tab==='periodization' && <div>
      {periodizationModels.map((p,i)=><div key={i} className="card" style={{ marginBottom:6, padding:10 }}>
        <div style={{ fontWeight:600, fontSize:12 }}>{p.name} <span style={{ fontSize:9, color:'var(--text-dim)' }}>({p.type})</span></div>
        <div style={{ fontSize:9, color:'var(--text-light)', marginTop:2 }}>{p.description}</div>
        <div style={{ fontSize:8, color:'var(--text-dim)' }}>{p.macrocycleWeeks} нед · {p.phases?.length} фаз</div>
      </div>)}
    </div>}

    {tab==='meet' && <div>
      <div className="card" style={{ marginBottom:8 }}>
        <h4 style={{ margin:'0 0 6px', fontSize:12 }}>🏆 Стратегия соревнований</h4>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
          <div><label style={{ fontSize:10 }}>Присед 1RM</label><input type="number" value={meetSquat} onChange={e=>setMeetSquat(parseFloat(e.target.value) || 0)} style={{ width:'100%',padding:'6px',borderRadius:6,background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text)',fontSize:12,boxSizing:'border-box' }} /></div>
          <div><label style={{ fontSize:10 }}>Жим 1RM</label><input type="number" value={meetBench} onChange={e=>setMeetBench(parseFloat(e.target.value) || 0)} style={{ width:'100%',padding:'6px',borderRadius:6,background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text)',fontSize:12,boxSizing:'border-box' }} /></div>
          <div><label style={{ fontSize:10 }}>Тяга 1RM</label><input type="number" value={meetDeadlift} onChange={e=>setMeetDeadlift(parseFloat(e.target.value) || 0)} style={{ width:'100%',padding:'6px',borderRadius:6,background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text)',fontSize:12,boxSizing:'border-box' }} /></div>
          <div><label style={{ fontSize:10 }}>Вес тела</label><input type="number" value={meetBodyW} onChange={e=>setMeetBodyW(parseFloat(e.target.value) || 0)} style={{ width:'100%',padding:'6px',borderRadius:6,background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text)',fontSize:12,boxSizing:'border-box' }} /></div>
        </div>
        <button onClick={()=>setMeetResult(generateMeetStrategy(meetSquat, meetBench, meetDeadlift, meetBodyW, meetFed))} style={{ width:'100%',padding:10,borderRadius:8,border:'none',cursor:'pointer',marginTop:6,background:'var(--accent)',color:'#000',fontWeight:700,fontSize:13 }}>Рассчитать</button>
      </div>
      {meetResult && <div className="card"><div style={{ fontWeight:700,fontSize:14 }}>Тотал: {meetResult.total.opener}/{meetResult.total.second}/{meetResult.total.third} кг (Wilks: {meetResult.total.wilks.toFixed(1)})</div>
        {meetResult.attempts.map((s,i)=><div key={i} style={{ marginTop:6 }}><div style={{ fontWeight:600,fontSize:11 }}>{s.lift}: {s.openerKg}/{s.secondKg}/{s.thirdKg} кг</div>
          <div style={{ fontSize:8, color:'var(--text-dim)' }}>{s.warmupSequence?.map(w=>`${w.weight}×${w.reps}`).join(' → ')}</div></div>)}
      </div>}
    </div>}

    {tab==='bbprep' && <div>
      <h4 style={{ fontSize:12, marginBottom:8 }}>💪 Подготовка к соревнованиям</h4>
      {bbPrep.map((p,i)=><div key={i} className="card" style={{ marginBottom:6, padding:10 }}>
        <div style={{ fontWeight:600, fontSize:12 }}>{p.phase} (нед {p.weeksOut} до старта)</div>
        <div style={{ fontSize:9, color:'var(--text-light)', marginTop:2 }}>Тренировки: {p.training} | Кардио: {p.cardio} | Углеводы: {p.carbs}</div>
      </div>)}
    </div>}

    {tab==='pct' && <div>
      <h4 style={{ fontSize:12, marginBottom:8 }}>🔄 Протоколы ПКТ</h4>
      {pctProtocols.map((p,i)=><div key={i} className="card" style={{ marginBottom:6, padding:10 }}>
        <div style={{ fontWeight:600, fontSize:12 }}>{p.name} ({p.forCycle})</div>
        <div style={{ fontSize:9, color:'var(--text-dim)', marginTop:2 }}>{p.totalWeeks} недель · Успех: {p.successRate}</div>
        <div style={{ fontSize:8, color:'var(--text-light)', marginTop:4 }}>{p.expectedRecovery}</div>
        {p.timeline?.slice(0,4).map((t,ti)=><div key={ti} style={{ fontSize:8, marginTop:2 }}>
          <b>Нед {t.week}:</b> {t.compounds.map(c=>`${c.name} ${c.dosage}`).join(', ')} — {t.notes}
        </div>)}
      </div>)}
    </div>}
    {tab==='predict' && <PredictTab />}
  </div>);
};

const PredictTab: React.FC = () => {
  const [sq, setSq] = React.useState(200);
  const [bp, setBp] = React.useState(140);
  const [dl, setDl] = React.useState(250);
  const result = React.useMemo(() => predictStrength({current1RM:{squat:sq,bench:bp,deadlift:dl}, weeks:12, goal:'strength'} as any), [sq,bp,dl]);
  const pri = React.useMemo(() => computePRI({sleepQuality:7,hrvValue:70,fatigue:30,stress:20,readiness:70,trainingLoad:80} as any), []);
  return (<div>
    <div className="card" style={{ marginBottom:8,padding:10 }}>
      <h4 style={{ margin:'0 0 6px',fontSize:12 }}>🔮 Прогноз силы</h4>
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:4 }}>
        <div><label style={{ fontSize:9 }}>Присед</label><input type="number" value={sq} onChange={e=>setSq(parseFloat(e.target.value) || 0)} style={{ width:'100%',padding:'4px',borderRadius:4,background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text)',fontSize:11,boxSizing:'border-box' }} /></div>
        <div><label style={{ fontSize:9 }}>Жим</label><input type="number" value={bp} onChange={e=>setBp(parseFloat(e.target.value) || 0)} style={{ width:'100%',padding:'4px',borderRadius:4,background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text)',fontSize:11,boxSizing:'border-box' }} /></div>
        <div><label style={{ fontSize:9 }}>Тяга</label><input type="number" value={dl} onChange={e=>setDl(parseFloat(e.target.value) || 0)} style={{ width:'100%',padding:'4px',borderRadius:4,background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text)',fontSize:11,boxSizing:'border-box' }} /></div>
      </div>
      {result.slice(0,5).map((r:any,i)=> <div key={i} style={{ fontSize:9,marginTop:4 }}>{(r as any).exercise || (r as any).lift}: {(r as any).current1RM} → <b style={{color:'#22c55e'}}>{(r as any).projected1RM || (r as any).week12 || '—'} кг</b></div>)}
    </div>
    <div className="card" style={{ padding:10 }}>
      <h4 style={{ margin:'0 0 4px',fontSize:12 }}>📊 PRI</h4>
      <div style={{ fontSize:10 }}>Готовность: <b style={{color:(pri as any).score>70?'#22c55e':'#f59e0b'}}>{(pri as any).score || (pri as any).pri}%</b> | Уровень: {(pri as any).level || '—'}</div>
    </div>
  </div>);
};
