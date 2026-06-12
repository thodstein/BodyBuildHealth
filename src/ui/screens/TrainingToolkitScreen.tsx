import React, { useState, useMemo } from 'react';
import { classifyMovement, estimateDifficulty, getMuscleSynergy, getJointStress, assessSafety } from '../../engines/movement-engines';
import { generatePLPeaking, generateBBPeaking } from '../../engines/peaking-engine';
import { generateCalendarMonth, getDayTrainingFocus, getWaterStats, quickAddWater } from '../../engines/training-calendar.engine';
import { autoregulate } from '../../engines/autoregulation-engine';
import { selectRepPattern } from '../../engines/rep-pattern.engine';
import { createSession, buildHistoryContext, generateInsights } from '../../engines/diary-engine';
import { startSession, addExerciseToSession, logSet, finishSession, loadSessions } from '../../engines/workout-logger.engine';
import { calculatePlates, warmupPlateSequence, getPlateLoadingOrder } from '../../engines/gym-competition.engine';
import { getRequiredPatterns, getBlockedPatterns } from '../../engines/exercise-pattern.engine';
import { defaultPeriodization, getBlockTemplates, createMesocycle } from '../../engines/periodization-designer.engine';
import { computeOrthopedicConstraints, distributeWeeklyLoad } from '../../engines/orthopedic-load-engines';
import type { MovementPattern } from '../../core/types';

export const TrainingToolkitScreen: React.FC = () => {
  const [tab, setTab] = useState('movement');
  const tabs = ['movement','peaking','calendar','autoreg','reps','gym','patterns','design','logger','ortho'];
  const labels: Record<string,string> = {movement:'🏃 Движение',peaking:'🏆 Пик',calendar:'📅 Календарь',autoreg:'⚙ Авторег',reps:'🔢 Повторы',gym:'🏋️ Зал',patterns:'🧩 Паттерны',design:'🧱 Блоки',logger:'📝 Логгер',ortho:'🦴 Ортопедия'};
  return (<div className="screen"><h2>🧰 Инструментарий</h2>
    <div style={{ display:'flex',gap:3,marginBottom:10,overflowX:'auto' }}>
      {tabs.map(t => <button key={t} onClick={()=>setTab(t)} style={{ padding:'6px 10px',borderRadius:8,fontSize:11,cursor:'pointer',whiteSpace:'nowrap',background:tab===t?'var(--accent-green)':'var(--bg-secondary)',color:tab===t?'#000':'var(--text-dim)',border:'none',fontWeight:tab===t?700:400 }}>{labels[t]}</button>)}
    </div>
    {tab==='movement' && <MovementTab />}
    {tab==='peaking' && <PeakingTab />}
    {tab==='calendar' && <CalendarTab />}
    {tab==='autoreg' && <AutoregTab />}
    {tab==='reps' && <RepsTab />}
    {tab==='gym' && <GymTab />}
    {tab==='patterns' && <PatternsTab />}
    {tab==='design' && <DesignTab />}
    {tab==='logger' && <LoggerTab />}
    {tab==='ortho' && <OrthoTab />}
  </div>);
};

const EXS = ['squat','bench_press','deadlift','overhead_press','pull_up','barbell_row','lunge','dip'];
const EX_LABELS: Record<string, string> = {
  squat: 'Присед', bench_press: 'Жим лёжа', deadlift: 'Становая тяга', overhead_press: 'Жим стоя',
  pull_up: 'Подтягивания', barbell_row: 'Тяга штанги', lunge: 'Выпады', dip: 'Отжимания на брусьях',
};

const MovementTab: React.FC = () => {
  const [ex, setEx] = useState('squat');
  const mov = useMemo(() => classifyMovement(ex), [ex]);
  const diff = useMemo(() => estimateDifficulty(ex), [ex]);
  const syn = useMemo(() => getMuscleSynergy(ex), [ex]);
  const stress = useMemo(() => getJointStress(ex), [ex]);
  const safe = useMemo(() => assessSafety(ex, [], 80), [ex]);
  return (<div className="card" style={{ padding:10 }}>
    <h4 style={{ margin:'0 0 6px',fontSize:12 }}>🏃 Анализ движения</h4>
    <select value={ex} onChange={e=>setEx(e.target.value)} style={{ width:'100%',padding:'6px',borderRadius:6,background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text)',fontSize:12,marginBottom:8 }}>
      {EXS.map(e=><option key={e} value={e}>{EX_LABELS[e] || e}</option>)}
    </select>
    <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'3px 8px',fontSize:10 }}>
      <span>Паттерн:</span><span style={{ fontWeight:600 }}>{mov.pattern} ({mov.plane})</span>
      <span>Сложность:</span><span style={{ fontWeight:600 }}>{(diff as any).overall || (diff as any).score}/10</span>
      <span>Мышцы:</span><span style={{ fontSize:9 }}>{syn.primary?.join(', ')}</span>
      <span>Суставы:</span><span style={{ fontSize:9 }}>{(stress as any).overallRisk || '—'}%</span>
    </div>
    <div style={{ marginTop:6,fontSize:10,color:(safe as any).safe?'#22c55e':'#ef4444',fontWeight:600 }}>{(safe as any).safe ? '✅' : '⚠'} {(safe as any).reason || (safe as any).risk || ''}</div>
  </div>);
};

const PeakingTab: React.FC = () => {
  const [type, setType] = useState<'pl'|'bb'>('pl');
  const [pl, setPl] = useState({squat:200,bench:140,deadlift:250,bw:83,weeksOut:4});
  const [bb, setBb] = useState({weeksOut:16,weight:85,bf:10,height:175});
  const plResult = useMemo(() => generatePLPeaking({meetDate:'2024-06-01',current1RM:{squat:pl.squat,bench:pl.bench,deadlift:pl.deadlift},bodyWeight:pl.bw,fatigue:5,pri:70} as any), [pl]);
  const bbResult = useMemo(() => generateBBPeaking({showDate:'2024-06-01',currentWeight:bb.weight,currentBf:bb.bf,heightCm:bb.height,conditioning:7,fullness:5,dryness:5,carbTolerance:'moderate'} as any), [bb]);
  return (<div>
    <div style={{ display:'flex',gap:4,marginBottom:8 }}>
      <button onClick={()=>setType('pl')} style={{ padding:'6px 12px',borderRadius:6,fontSize:11,cursor:'pointer',background:type==='pl'?'var(--accent)':'var(--bg-secondary)',color:type==='pl'?'#000':'var(--text-dim)',border:'none' }}>PL</button>
      <button onClick={()=>setType('bb')} style={{ padding:'6px 12px',borderRadius:6,fontSize:11,cursor:'pointer',background:type==='bb'?'var(--accent)':'var(--bg-secondary)',color:type==='bb'?'#000':'var(--text-dim)',border:'none' }}>BB</button>
    </div>
    {type==='pl' && <div className="card" style={{ padding:10 }}>
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:4 }}>
        <div><label style={{ fontSize:9 }}>Присед</label><input type="number" value={pl.squat} onChange={e=>setPl({...pl,squat:+e.target.value})} style={{ width:'100%',padding:'4px',borderRadius:4,background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text)',fontSize:11,boxSizing:'border-box' }} /></div>
        <div><label style={{ fontSize:9 }}>Жим</label><input type="number" value={pl.bench} onChange={e=>setPl({...pl,bench:+e.target.value})} style={{ width:'100%',padding:'4px',borderRadius:4,background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text)',fontSize:11,boxSizing:'border-box' }} /></div>
        <div><label style={{ fontSize:9 }}>Тяга</label><input type="number" value={pl.deadlift} onChange={e=>setPl({...pl,deadlift:+e.target.value})} style={{ width:'100%',padding:'4px',borderRadius:4,background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text)',fontSize:11,boxSizing:'border-box' }} /></div>
        <div><label style={{ fontSize:9 }}>Вес тела</label><input type="number" value={pl.bw} onChange={e=>setPl({...pl,bw:+e.target.value})} style={{ width:'100%',padding:'4px',borderRadius:4,background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text)',fontSize:11,boxSizing:'border-box' }} /></div>
      </div>
      {plResult && <div style={{ marginTop:6,fontSize:10 }}>
        <div>Тотал: <b>{(plResult as any).projectedTotal || pl.squat+pl.bench+pl.deadlift} кг</b></div>
        {(plResult as any).weekPlan?.slice(0,4).map((w:any,i:number)=><div key={i} style={{ marginTop:2 }}>Нед {i+1}: {w.focus || w.phase}</div>)}
      </div>}
    </div>}
    {type==='bb' && <div className="card" style={{ padding:10 }}>
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:4 }}>
        <div><label style={{ fontSize:9 }}>Вес</label><input type="number" value={bb.weight} onChange={e=>setBb({...bb,weight:+e.target.value})} style={{ width:'100%',padding:'4px',borderRadius:4,background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text)',fontSize:11,boxSizing:'border-box' }} /></div>
        <div><label style={{ fontSize:9 }}>BF%</label><input type="number" value={bb.bf} onChange={e=>setBb({...bb,bf:+e.target.value})} style={{ width:'100%',padding:'4px',borderRadius:4,background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text)',fontSize:11,boxSizing:'border-box' }} /></div>
      </div>
      {bbResult && <div style={{ marginTop:6,fontSize:10 }}>
        {(bbResult as any).weeklyPlan?.slice(0,6).map((w:any,i:number)=><div key={i} style={{ marginTop:2 }}>Нед {i+1}: {w.phase || ''}</div>)}
      </div>}
    </div>}
  </div>);
};

const CalendarTab: React.FC = () => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()+1);
  const [split, setSplit] = useState('PPL');
  const cal = useMemo(() => generateCalendarMonth(year, month, [], []), [year, month]);
  const water = useMemo(() => getWaterStats(), []);
  const todayFocus = getDayTrainingFocus(now.getDay(), split);
  const waterDisplay = typeof water === 'object' ? `` : '';
  return (<div>
    <div className="card" style={{ marginBottom:8,padding:10 }}>
      <div style={{ display:'flex',gap:4,marginBottom:6 }}>
        <button onClick={()=>{if(month===1){setMonth(12);setYear(year-1)}else setMonth(month-1)}} style={{ padding:'4px 8px',borderRadius:4,fontSize:10,background:'var(--bg-secondary)',color:'var(--text)',border:'none',cursor:'pointer' }}>←</button>
        <select value={split} onChange={e=>setSplit(e.target.value)} style={{ padding:'4px',borderRadius:4,background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text)',fontSize:10 }}><option>PPL</option><option>U/L</option><option>FB</option></select>
        <button onClick={()=>{if(month===12){setMonth(1);setYear(year+1)}else setMonth(month+1)}} style={{ padding:'4px 8px',borderRadius:4,fontSize:10,background:'var(--bg-secondary)',color:'var(--text)',border:'none',cursor:'pointer' }}>→</button>
      </div>
      <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2,textAlign:'center' }}>
        {['','','','','','',''].map(d=><div key={d} style={{ fontSize:8,color:'var(--text-dim)',fontWeight:600 }}>{d}</div>)}
        {(cal as any).days?.map((d:any,i:number)=><div key={i} style={{ padding:'4px 2px',borderRadius:4,fontSize:9,background:d.isTraining?'rgba(0,230,138,0.1)':'transparent',color:d.isTraining?'#00e68a':'var(--text-dim)' }}>{d.day}<br/><span style={{ fontSize:6 }}>{d.focus||''}</span></div>)}
      </div>
    </div>
    <div className="card" style={{ padding:10 }}>
      <div style={{ fontSize:10,marginBottom:4 }}>Сегодня: <b style={{ color:'var(--accent)' }}>{todayFocus}</b></div>
      <div style={{ fontSize:10 }}>{waterDisplay}</div>
      <button onClick={()=>quickAddWater(250)} style={{ padding:'4px 10px',borderRadius:4,fontSize:10,marginTop:4,background:'#3b82f6',color:'#fff',border:'none',cursor:'pointer' }}>+250 мл</button>
    </div>
  </div>);
};

const AutoregTab: React.FC = () => {
  const [pri, setPri] = React.useState(70);
  const [fatigue, setFatigue] = React.useState(30);
  const [recovery, setRecovery] = React.useState(70);
  const [result, setResult] = React.useState<any>(null);
  const run = () => setResult(autoregulate({priScore:pri,fatigueScore:fatigue,recoveryScore:recovery,jointFatigue:20,cumulativeLoad:5000,riskLevel:2,techniqueScore:80,velocityTrend:0,goal:'strength',plannedIntensity:80,plannedSets:5,plannedReps:5,plannedFrequency:4,exerciseJointStress:{}} as any));
  return (<div className="card" style={{ padding:10 }}>
    <h4 style={{ margin:'0 0 6px',fontSize:12 }}>⚙ Авторегуляция</h4>
    <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:4 }}>
      <div><label style={{ fontSize:9 }}>PRI</label><input type="range" min={0} max={100} value={pri} onChange={e=>setPri(+e.target.value)} /><span style={{ fontSize:9 }}>{pri}%</span></div>
      <div><label style={{ fontSize:9 }}>Усталость</label><input type="range" min={0} max={100} value={fatigue} onChange={e=>setFatigue(+e.target.value)} /><span style={{ fontSize:9 }}>{fatigue}%</span></div>
      <div><label style={{ fontSize:9 }}>Восстановление</label><input type="range" min={0} max={100} value={recovery} onChange={e=>setRecovery(+e.target.value)} /><span style={{ fontSize:9 }}>{recovery}%</span></div>
    </div>
    <button onClick={run} style={{ width:'100%',padding:8,borderRadius:6,border:'none',cursor:'pointer',marginTop:6,background:'var(--accent)',color:'#000',fontWeight:600,fontSize:12 }}>Рассчитать</button>
    {result && <div style={{ marginTop:6,fontSize:10 }}>
      {result.sessionCancelled && <div style={{ color:'#ef4444',fontWeight:700 }}>🔴 Сессия отменена</div>}
      {!result.sessionCancelled && <div>
        <div>Интенсивность: <b>{result.intensity?.targetIntensity || '—'}%</b> (RPE: {result.intensity?.targetRPE || '—'})</div>
        <div>Объём: <b>{result.volume?.targetSets}×{result.volume?.targetReps}</b></div>
        {result.summary && <div style={{ color:'var(--text-dim)',marginTop:2 }}>{result.summary}</div>}
      </div>}
    </div>}
  </div>);
};

const RepsTab: React.FC = () => {
  const [goal, setGoal] = React.useState('strength');
  const result = React.useMemo(() => selectRepPattern(goal as any, 'horizontal_push' as MovementPattern, 'medium', [], {}), [goal]);
  const r = result as any;
  return (<div className="card" style={{ padding:10 }}>
    <h4 style={{ margin:'0 0 6px',fontSize:12 }}>🔁 Паттерн повторений</h4>
    <div style={{ display:'flex',gap:4,marginBottom:6 }}>
      <select value={goal} onChange={e=>setGoal(e.target.value)} style={{ flex:1,padding:'4px',borderRadius:4,background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text)',fontSize:11 }}>
        <option value="strength">Сила</option><option value="hypertrophy">Масса</option><option value="endurance">Выносливость</option>
      </select>
    </div>
    <div style={{ fontSize:10 }}>{r.name || r.pattern}: <b style={{color:'var(--accent)'}}>{r.reps} повт</b> × {r.sets} подх, RIR: {r.rir || r.targetRIR}</div>
    {r.description && <div style={{ fontSize:9,color:'var(--text-dim)',marginTop:2 }}>{r.description}</div>}
  </div>);
};

const DiaryToolTab: React.FC = () => {
  const [session, setSession] = React.useState(() => createSession({date:new Date().toISOString().split('T')[0], focus:'push', durationMin:60, completed:false}));
  const insights = React.useMemo(() => generateInsights([session] as any, [session] as any), [session]);
  const ctx = React.useMemo(() => buildHistoryContext([] as any, [session] as any), [session]);
  const c = ctx as any;
  return (<div>
    <div className="card" style={{ marginBottom:8,padding:10 }}>
      <h4 style={{ margin:'0 0 4px',fontSize:12 }}>📓 Сессия</h4>
      <div style={{ fontSize:10 }}>Дата: {session.date} | Фокус: {session.focus} | {session.durationMin} мин | {session.completed ? '✅' : '⏳'}</div>
    </div>
    <div className="card" style={{ padding:10 }}>
      <h4 style={{ margin:'0 0 4px',fontSize:12 }}>💡 Инсайты</h4>
      {insights.slice(0,5).map((r:any,i:number)=><div key={i} style={{ fontSize:9,color:'var(--text-dim)',marginTop:2 }}>• {r}</div>)}
      <div style={{ fontSize:9,color:'var(--text-dim)',marginTop:4 }}>Контекст: {c.recentSessions || 0} сессий, средняя: {c.avgDuration || 0} мин</div>
    </div>
  </div>);
};

const GymTab: React.FC = () => {
  const [target, setTarget] = React.useState(100);
  const plates = React.useMemo(() => calculatePlates(target), [target]);
  const order = React.useMemo(() => getPlateLoadingOrder(target), [target]);
  const warmup = React.useMemo(() => warmupPlateSequence(target), [target]);
  const plateDisplay = typeof plates === 'object' ? `${(plates as any).total || target} кг (${(plates as any).perSide || '-'} на сторону)` : `${plates}`;
  return (<div>
    <div className="card" style={{ marginBottom:8,padding:10 }}>
      <h4 style={{ margin:'0 0 6px',fontSize:12 }}>🏋️ Калькулятор блинов</h4>
      <div><label style={{ fontSize:10 }}>Рабочий вес (кг)</label><input type="number" value={target} onChange={e=>setTarget(+e.target.value)} style={{ width:'100%',padding:'6px',borderRadius:6,background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text)',fontSize:14,boxSizing:'border-box',textAlign:'center' }} /></div>
      <div style={{ fontSize:12,marginTop:4 }}>Блины: <b style={{color:'var(--accent)'}}>{plateDisplay}</b></div>
      <div style={{ fontSize:9,color:'var(--text-dim)',marginTop:2 }}>Порядок: {order.join(' + ')}</div>
    </div>
    <div className="card" style={{ padding:10 }}>
      <h4 style={{ margin:'0 0 4px',fontSize:11 }}>🔄 Разминка</h4>
      {warmup.map((w,i)=><div key={i} style={{ fontSize:9 }}>Подход {w.set}: {w.weight}кг × {w.reps} ({w.plates})</div>)}
    </div>
  </div>);
};

const PatternsTab: React.FC = () => {
  const req = React.useMemo(() => (getRequiredPatterns as any)(), []);
  const blk = React.useMemo(() => (getBlockedPatterns as any)(), []);
  return (<div>
    <div className="card" style={{ marginBottom:8,padding:10 }}><h4 style={{ margin:'0 0 4px',fontSize:12 }}>📐 Нужные паттерны</h4>{req.map((p:any,i:number)=><div key={i} style={{ fontSize:10,padding:'2px 0' }}>• {p.name || p.pattern}: {p.frequency}</div>)}</div>
    <div className="card" style={{ padding:10 }}><h4 style={{ margin:'0 0 4px',fontSize:12 }}>🚫 Блокируемые</h4>{blk.map((p:any,i:number)=><div key={i} style={{ fontSize:10,padding:'2px 0' }}>• {p.name || p.pattern}</div>)}</div>
  </div>);
};

const DesignTab: React.FC = () => {
  const templates = React.useMemo(() => getBlockTemplates(), []);
  const def = React.useMemo(() => defaultPeriodization('strength'), []);
  return (<div>
    <div className="card" style={{ marginBottom:8,padding:10 }}><h4 style={{ margin:'0 0 4px',fontSize:12 }}>🎨 Шаблоны</h4>{templates.map((t:any,i:number)=><div key={i} style={{ fontSize:10,padding:'2px 0' }}>• {t.name}: {t.weeks} нед</div>)}</div>
    <div className="card" style={{ padding:10 }}><h4 style={{ margin:'0 0 4px',fontSize:12 }}>📋 По умолчанию (сила)</h4><div style={{ fontSize:10 }}>{def.name || ''}: {def.blocks?.length || 0} блоков</div></div>
  </div>);
};

const LoggerTab: React.FC = () => {
  const [focus, setFocus] = React.useState('push');
  const [wk, setWk] = React.useState(1);
  const [session, setSession] = React.useState<any>(null);
  const start = () => setSession(startSession(focus, wk));
  const addEx = () => { if (session) setSession(addExerciseToSession(session, {id:'bench_press',name:'Bench Press',pattern:'horizontal_push',muscleGroup:'chest'})); };
  const log = () => { if (session?.exercises?.length) { const exId = session.exercises[0].exerciseId; setSession(logSet(session, exId, {weightKg:80, reps:5, rir:2, rpe:7, notes:'', setNumber:1})); } };
  const finish = () => { if (session) { setSession(finishSession(session)); } };
  return (<div className="card" style={{ padding:10 }}>
    <h4 style={{ margin:'0 0 6px',fontSize:12 }}>📝 Логгер тренировки</h4>
    <div style={{ display:'flex',gap:4,marginBottom:6 }}>
      <select value={focus} onChange={e=>setFocus(e.target.value)} style={{ flex:1,padding:'4px',borderRadius:4,background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text)',fontSize:11 }}><option value="push">Push</option><option value="pull">Pull</option><option value="legs">Legs</option></select>
      <input type="number" value={wk} onChange={e=>setWk(+e.target.value)} style={{ width:50,padding:'4px',borderRadius:4,background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text)',fontSize:11 }} />
    </div>
    {!session && <button onClick={start} style={{ width:'100%',padding:8,borderRadius:6,border:'none',cursor:'pointer',background:'var(--accent)',color:'#000',fontWeight:600,fontSize:12 }}>▶ Начать тренировку</button>}
    {session && <div>
      <div style={{ fontSize:10,marginBottom:4 }}>Сессия: {session.focus} | Нед {session.weekNumber} | {session.completed ? '✅ Завершена' : '⏳ В процессе'}</div>
      {!session.completed && <div style={{ display:'flex',gap:4 }}>
        <button onClick={addEx} style={{ flex:1,padding:'4px',borderRadius:4,fontSize:10,cursor:'pointer',background:'var(--bg-secondary)',color:'var(--text)',border:'1px solid var(--border)' }}>+ Жим</button>
        <button onClick={log} style={{ flex:1,padding:'4px',borderRadius:4,fontSize:10,cursor:'pointer',background:'var(--bg-secondary)',color:'var(--text)',border:'1px solid var(--border)' }}>📝 Подход</button>
        <button onClick={finish} style={{ flex:1,padding:'4px',borderRadius:4,fontSize:10,cursor:'pointer',background:'#22c55e',color:'#000',border:'none' }}>✓ Финиш</button>
      </div>}
    </div>}
  </div>);
};

const OrthoTab: React.FC = () => {
  const [wt, setWt] = React.useState(80);
  const [ht, setHt] = React.useState(175);
  const [ex, setEx] = React.useState('squat');
  const ortho = React.useMemo(() => computeOrthopedicConstraints({weightKg:wt,heightCm:ht,exerciseId:ex,trainingAge:12,history:'none'} as any), [wt,ht,ex]);
  const dist = React.useMemo(() => distributeWeeklyLoad({exercises:[{id:'squat',sets:5,reps:5,weight:100},{id:'bench',sets:5,reps:5,weight:80},{id:'deadlift',sets:3,reps:5,weight:140}],daysPerWeek:4,splitType:'PPL'} as any), []);
  return (<div>
    <div className="card" style={{ marginBottom:8,padding:10 }}>
      <h4 style={{ margin:'0 0 6px',fontSize:12 }}>🦴 Ортопедические ограничения</h4>
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:4 }}>
        <div><label style={{ fontSize:9 }}>Вес</label><input type="number" value={wt} onChange={e=>setWt(+e.target.value)} style={{ width:'100%',padding:'4px',borderRadius:4,background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text)',fontSize:11,boxSizing:'border-box' }} /></div>
        <div><label style={{ fontSize:9 }}>Рост</label><input type="number" value={ht} onChange={e=>setHt(+e.target.value)} style={{ width:'100%',padding:'4px',borderRadius:4,background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text)',fontSize:11,boxSizing:'border-box' }} /></div>
      </div>
      <select value={ex} onChange={e=>setEx(e.target.value)} style={{ width:'100%',padding:'4px',marginTop:4,borderRadius:4,background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text)',fontSize:11 }}><option value="squat">Присед</option><option value="deadlift">Тяга</option><option value="bench">Жим</option></select>
      {(ortho as any).flags?.map((f:any,i:number)=><div key={i} style={{ fontSize:9,color:'#f59e0b',marginTop:3 }}>⚠ {f}</div>)}
    </div>
    <div className="card" style={{ padding:10 }}>
      <h4 style={{ margin:'0 0 4px',fontSize:12 }}>📊 Распределение нагрузки</h4>
      <div style={{ fontSize:10 }}>Объём: <b>{(dist as any).totalVolume || 0}</b> | Нагрузка/день: <b>{(dist as any).loadPerDay || 0}</b></div>
      {(dist as any).recommendations?.map((r:any,i:number)=><div key={i} style={{ fontSize:9,color:'var(--text-dim)',marginTop:2 }}>• {r}</div>)}
    </div>
  </div>);
};
