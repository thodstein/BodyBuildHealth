import React, { useState, useMemo } from 'react';
import { useDataLink } from '../../core/data-link';
import { analyzeRecovery, shouldTrain } from '../../engines/recovery-optimization.engine';
import { getBiohackingProtocols, getHomeGymSetups } from '../../engines/biohacking-environment.engine';
import { generateDeload, getAllTechniques, getCues } from '../../engines/genetic-deload-technique.engine';
import { getFederationRules, getGripProtocols, getMobilityFlows, getPostureAssessments, getCompetitionCalendar } from '../../engines/federation-grip-mobility.engine';
import { detectOvertraining } from '../../engines/overtraining-scheduler.engine';
import { analyzeBiomechanics } from '../../engines/biomechanics-risk-engine';
import { getAllPrehabRoutines, getBloodPanels } from '../../engines/injury-cycle-blood.engine';

interface OTMarkers {
  performanceDecline: number; hrvSuppression: number; restingHRIncrease: number;
  sleepHours: number; sleepQuality: number; moodDisturbance: boolean;
  appetiteLoss: boolean; frequentIllness: boolean; jointPainIncrease: boolean;
  rpeInflation: boolean; recoveryTimeExtension: boolean; libidoDecrease: boolean;
  trainingMotivation: number;
}

const TABS = ['recovery','overtraining','deload','biohack','technique','grip','mobility','posture','compete','biomech','prehab'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = {
  recovery:'Восстановление', overtraining:'Перетрен', deload:'Разгрузка', biohack:'Биохакинг',
  technique:'Техника', grip:'Хват', mobility:'Мобильность', posture:'Осанка',
  compete:'Соревнования', biomech:'Биомеханика', prehab:'Реабилитация'
};

export const RecoveryScreen: React.FC = () => {
  const linked = useDataLink();
  const p = linked.profile?.settings;

  const [tab, setTab] = useState<Tab>('recovery');
  const [sleepH, setSleepH] = useState(p?.baselineSleepHours ?? 7);
  const [sleepQ, setSleepQ] = useState(p?.baselineSleepQuality ?? 6);
  const [hrv, setHrv] = useState(Math.round((p?.baselineHrvRatio ?? 0.7) * 80));
  const [fatigue, setFatigue] = useState(p?.fatigueLevel ?? 3);
  const [recOut, setRecOut] = useState<any>(null);

  const [otMarkers, setOtMarkers] = useState<OTMarkers>({
    performanceDecline:0, hrvSuppression:0, restingHRIncrease:0, sleepHours:7, sleepQuality:6,
    moodDisturbance:false, appetiteLoss:false, frequentIllness:false, jointPainIncrease:false,
    rpeInflation:false, recoveryTimeExtension:false, libidoDecrease:false, trainingMotivation:7
  });
  const [otOut, setOtOut] = useState<any>(null);
  const [deloadOut, setDeloadOut] = useState<any>(null);
  const techniques = useMemo(() => getAllTechniques(), []);
  const [ti, setTi] = useState(0);
  const grips = useMemo(() => getGripProtocols(), []);
  const mobilities = useMemo(() => getMobilityFlows(), []);
  const postures = useMemo(() => getPostureAssessments(), []);
  const comps = useMemo(() => getCompetitionCalendar(), []);

  // biomech state
  const [bmH, setBmH] = useState(175);
  const [bmW, setBmW] = useState(80);
  const [bmEx, setBmEx] = useState('squat');
  const [bmLd, setBmLd] = useState(100);
  const [bmOut, setBmOut] = useState<any>(null);

  const s_label = { fontSize:9, color:'var(--text-dim)' };

  return (
    <div className="screen">
      <h2>Восстановление и производительность</h2>
      <div style={{ display:'flex', gap:3, marginBottom:10, overflowX:'auto', scrollbarWidth:'none' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding:'6px 10px', borderRadius:8, fontSize:11, cursor:'pointer', whiteSpace:'nowrap',
            background: tab===t ? 'var(--accent-green)' : 'var(--bg-secondary)',
            color: tab===t ? '#000' : 'var(--text-dim)', border:'none', fontWeight: tab===t ? 700 : 400
          }}>{TAB_LABELS[t]}</button>
        ))}
      </div>

      {tab === 'recovery' && renderRecovery()}
      {tab === 'overtraining' && renderOvertraining()}
      {tab === 'deload' && renderDeload()}
      {tab === 'biohack' && renderBiohack()}
      {tab === 'technique' && renderTechnique()}
      {tab === 'grip' && renderGrip()}
      {tab === 'mobility' && renderMobility()}
      {tab === 'posture' && renderPosture()}
      {tab === 'compete' && renderCompete()}
      {tab === 'biomech' && renderBiomech()}
      {tab === 'prehab' && renderPrehab()}
    </div>
  );

  // ---- tab renderers ----
  // biomeh -> bm

  function renderRecovery() {
    return (
      <div>
        <div className="card" style={{ marginBottom:8, padding:10 }}>
          <h4 style={{ margin:'0 0 6px', fontSize:12 }}>Анализ восстановления</h4>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
            <div>
              <label style={s_label}>Сон (часы)</label>
              <input type="number" value={sleepH} onChange={e => setSleepH(parseFloat(e.target.value) || 0)}
                style={{ width:'100%', padding:'4px 6px', borderRadius:4, background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text)', fontSize:11, boxSizing:'border-box' }} />
            </div>
            <div>
              <label style={s_label}>Качество сна</label>
              <input type="range" min={1} max={10} value={sleepQ} onChange={e => setSleepQ(parseFloat(e.target.value) || 0)} />
              <span style={{ fontSize:9 }}>{sleepQ}/10</span>
            </div>
            <div>
              <label style={s_label}>HRV RMSSD</label>
              <input type="number" value={hrv} onChange={e => setHrv(parseFloat(e.target.value) || 0)}
                style={{ width:'100%', padding:'4px 6px', borderRadius:4, background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text)', fontSize:11, boxSizing:'border-box' }} />
            </div>
            <div>
              <label style={s_label}>Утомление</label>
              <input type="range" min={1} max={10} value={fatigue} onChange={e => setFatigue(parseFloat(e.target.value) || 0)} />
              <span style={{ fontSize:9 }}>{fatigue}/10</span>
            </div>
          </div>
          <button onClick={() => {
            const sl = { hours:sleepH, quality:sleepQ, bedtime:'23:00', wakeTime:'07:00', latencyMin:15, awakenings:Math.max(0,5-sleepQ) };
            const hv = { rmssd:hrv, sdnn:hrv*1.6, restingHR:60, readinessScore:Math.round(hrv/1.2) };
            setRecOut(analyzeRecovery({
              sleep:sl, hrv:hv, fatigueScore:fatigue, trainingDaysThisWeek:4, currentWeek:4,
              periodizationPhase:'intensification', recentPR:false, injuryHistory:[]
            }));
          }} className="btn primary" style={{ width:'100%', marginTop:6 }}>Анализировать</button>
        </div>
        {recOut && renderRecoveryResult()}
      </div>
    );
  }

  function renderRecoveryResult() {
    const s = shouldTrain(recOut.overallRecoveryIndex, fatigue*10);
    return (
      <div className="card" style={{ padding:10 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'2px 8px', fontSize:10 }}>
          <span style={{ color:'var(--text-dim)' }}>Индекс восстановления</span>
          <span style={{ fontWeight:700, color: recOut.overallRecoveryIndex>70 ? '#22c55e' : recOut.overallRecoveryIndex>40 ? '#f59e0b' : '#ef4444' }}>{recOut.overallRecoveryIndex}%</span>
          <span style={{ color:'var(--text-dim)' }}>Сон</span><span style={{ fontWeight:600 }}>{recOut.sleepScore}%</span>
          <span style={{ color:'var(--text-dim)' }}>HRV</span><span style={{ fontWeight:600 }}>{recOut.hrvScore}%</span>
          <span style={{ color:'var(--text-dim)' }}>Риск перетрена</span><span style={{ fontWeight:700, color: recOut.overtrainingRisk>60 ? '#ef4444' : '#22c55e' }}>{recOut.overtrainingRisk}%</span>
          <span style={{ color:'var(--text-dim)' }}>Разгрузка</span><span style={{ fontWeight:600, color: recOut.deloadRecommended ? '#ef4444' : '#22c55e' }}>{recOut.deloadRecommended ? 'НУЖНА' : 'НЕТ'}</span>
          <span style={{ color:'var(--text-dim)' }}>Суперкомпенсация</span><span style={{ fontWeight:600 }}>{recOut.supercompensationHours}ч</span>
        </div>
        {recOut.recommendations?.length > 0 && (
          <div style={{ marginTop:4, fontSize:9, color:'#f59e0b' }}>
            {recOut.recommendations.slice(0,3).map((r:string,i:number) => <div key={i}>- {r}</div>)}
          </div>
        )}
        <div style={{ marginTop:6, fontSize:10, color: s.train ? '#22c55e' : '#ef4444', fontWeight:700 }}>
          {s.train ? 'ГОТОВ К ТРЕНИРОВКЕ' : 'ДЕНЬ ОТДЫХА: '+s.message}
        </div>
      </div>
    );
  }

  function renderOvertraining() {
    return (
      <div>
        <div className="card" style={{ marginBottom:8, padding:10 }}>
          <h4 style={{ margin:'0 0 6px', fontSize:12 }}>Диагностика перетренированности (12 маркеров)</h4>
          {(Object.entries(otMarkers) as [string, any][]).map(([k, v]) => (
            <div key={k} style={{ display:'flex', alignItems:'center', gap:4, marginBottom:3 }}>
              <span style={{ flex:1, fontSize:9, color:'var(--text-dim)' }}>
                {k.replace(/([A-Z])/g,' $1').replace(/^./, c=>c.toUpperCase())}
              </span>
              {typeof v === 'boolean' ? (
                <input type="checkbox" checked={v} onChange={e => setOtMarkers({...otMarkers, [k]:e.target.checked})} />
              ) : (
                <>
                  <input type="range" min={0} max={10} value={v}
                    onChange={e => setOtMarkers({...otMarkers, [k]:parseFloat(e.target.value) || 0})}
                    style={{ width:80 }} />
                  <span style={{ fontSize:8, minWidth:14, textAlign:'right' }}>{v}/10</span>
                </>
              )}
            </div>
          ))}
          <button onClick={() => setOtOut(detectOvertraining(otMarkers))}
            style={{ width:'100%', padding:8, borderRadius:6, border:'none', cursor:'pointer', marginTop:6, background:'#ef4444', color:'#fff', fontWeight:600, fontSize:12 }}>
            Диагностировать
          </button>
        </div>
        {otOut && (
          <div className="card" style={{ padding:10 }}>
            <div style={{ fontWeight:700, fontSize:12 }}>{otOut.riskLevel} ({otOut.riskPercent}%)</div>
            <div style={{ fontSize:9, marginTop:2 }}>{otOut.recommendation}</div>
            {otOut.markers?.filter((m:any) => m.status !== 'normal').slice(0,5).map((m:any, i:number) => (
              <div key={i} style={{ fontSize:8, color:'#ef4444', marginTop:1 }}>! {m.name}: {m.score}/{m.maxScore}</div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderDeload() {
    return (
      <div>
        <button onClick={() => setDeloadOut(generateDeload({
          weeksInCycle:8, fatigueScore:fatigue*10, priScore:50, sleepScore:sleepQ*15,
          hrvSuppression:2, jointPain:2, motivation:7, gymPerformance:'stable'
        }))} style={{ width:'100%', padding:10, borderRadius:8, border:'none', cursor:'pointer',
          background:'#f59e0b', color:'#000', fontWeight:700, fontSize:14, marginBottom:10 }}>
          Сгенерировать разгрузку
        </button>
        {deloadOut && (
          <div className="card" style={{ padding:10 }}>
            <div style={{ fontWeight:700, fontSize:13 }}>{deloadOut.type} — {deloadOut.weeks} нед</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'2px 8px', fontSize:10, marginTop:4 }}>
              <span>Объём</span><span style={{ fontWeight:600 }}>{deloadOut.volumePercent}%</span>
              <span>Интенсивность</span><span style={{ fontWeight:600 }}>{deloadOut.intensityPercent}%</span>
              <span>Дней/нед</span><span style={{ fontWeight:600 }}>{deloadOut.frequencyDays}</span>
            </div>
            <div style={{ fontSize:9, color:'var(--text-dim)', marginTop:4 }}>{deloadOut.nutritionAdjustment}</div>
            {deloadOut.dailyActivities?.map((a:string, i:number) => <div key={i} style={{ fontSize:8, marginTop:1 }}>+ {a}</div>)}
          </div>
        )}
      </div>
    );
  }

  function renderBiohack() {
    return (
      <div>
        <h4 style={{ fontSize:12, margin:'0 0 6px' }}>Биохакинг-протоколы</h4>
        {getBiohackingProtocols().map((p:any, i:number) => (
          <div key={i} className="card" style={{ marginBottom:6, padding:8 }}>
            <div style={{ fontWeight:600, fontSize:11 }}>{p.name} ({p.category})</div>
            <div style={{ fontSize:8, color:'var(--text-dim)' }}>{p.frequency} | {p.timing}</div>
            <div style={{ fontSize:9, marginTop:2 }}>
              {typeof p.protocol === 'string' ? p.protocol : (p.protocol as any[])?.map((s:any) => s.action).join(' → ')}
            </div>
          </div>
        ))}
        <h4 style={{ fontSize:12, margin:'12px 0 6px' }}>Домашние спортзалы</h4>
        {getHomeGymSetups().map((g:any, i:number) => (
          <div key={i} className="card" style={{ marginBottom:4, padding:8 }}>
            <div style={{ fontWeight:600, fontSize:11 }}>{g.name || g.tier || 'Сет'} <span style={{ color:'var(--accent)', fontSize:9 }}>{g.budget}</span></div>
            <div style={{ fontSize:8, color:'var(--text-dim)' }}>{g.equipment?.slice(0,6).join(', ')}</div>
          </div>
        ))}
      </div>
    );
  }

  function renderTechnique() {
    return (
      <div>
        <div style={{ display:'flex', gap:4, marginBottom:8, overflowX:'auto' }}>
          {techniques.map((t:any, i:number) => (
            <button key={i} onClick={() => setTi(i)} style={{
              padding:'5px 10px', borderRadius:6, fontSize:10, cursor:'pointer', whiteSpace:'nowrap',
              background: ti===i ? 'var(--accent-green)' : 'var(--bg-secondary)',
              color: ti===i ? '#000' : 'var(--text-dim)', border:'none'
            }}>{t.name}</button>
          ))}
        </div>
        {techniques[ti] && (
          <div className="card" style={{ padding:10 }}>
            <h4 style={{ margin:'0 0 6px', fontSize:13 }}>{techniques[ti].name}</h4>
            <div style={{ fontSize:10, marginBottom:4 }}><b>Настройка:</b> {techniques[ti].setup}</div>
            <div style={{ fontSize:10, marginBottom:4 }}><b>Выполнение:</b> {techniques[ti].execution}</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginTop:4 }}>
              {(techniques[ti] as any).commonMistakes?.map((e:string, i:number) => (
                <span key={i} style={{ fontSize:8, padding:'2px 5px', borderRadius:3, background:'rgba(239,68,68,0.1)', color:'#ef4444' }}>✕ {e}</span>
              ))}
              {getCues(techniques[ti].name).map((c:any, i:number) => (
                <span key={i} style={{ fontSize:8, padding:'2px 5px', borderRadius:3, background:'rgba(0,230,138,0.08)', color:'#00e68a' }}>
                  {(c as any).instruction || (c as any).text || String(c)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderGrip() {
    return (
      <div>
        {grips.map((p:any, i:number) => (
          <div key={i} className="card" style={{ marginBottom:4, padding:8 }}>
            <div style={{ fontWeight:600, fontSize:11 }}>{p.name} ({p.type})</div>
            <div style={{ fontSize:9, color:'var(--text-light)' }}>{p.exercises?.slice(0,4).join(' | ')}</div>
          </div>
        ))}
      </div>
    );
  }

  function renderMobility() {
    return (
      <div>
        {mobilities.map((f:any, i:number) => (
          <div key={i} className="card" style={{ marginBottom:4, padding:8 }}>
            <div style={{ fontWeight:600, fontSize:11 }}>{f.name} ({(f as any).duration || '10'} мин)</div>
            <div style={{ fontSize:9, color:'var(--text-dim)' }}>{(f as any).description || f.name}</div>
          </div>
        ))}
      </div>
    );
  }

  function renderPosture() {
    return (
      <div>
        {postures.map((p:any, i:number) => (
          <div key={i} className="card" style={{ marginBottom:4, padding:8 }}>
            <div style={{ fontWeight:600, fontSize:11 }}>{p.deviation}</div>
            <div style={{ fontSize:8, color:'var(--text-dim)' }}>{(p as any).causes || ''}</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:2 }}>
              {(p as any).correctives?.slice(0,4).map((c:string, ci:number) => (
                <span key={ci} style={{ fontSize:7, padding:'1px 4px', borderRadius:2, background:'rgba(59,130,246,0.1)', color:'#3b82f6' }}>{c}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderCompete() {
    return (
      <div>
        {comps.map((c:any, i:number) => (
          <div key={i} className="card" style={{ marginBottom:4, padding:8 }}>
            <div style={{ fontWeight:600, fontSize:11 }}>{c.name} ({(c as any).federation || ''})</div>
            <div style={{ fontSize:8, color:'var(--text-dim)' }}>{c.date} | {c.location}</div>
          </div>
        ))}
        <div className="card" style={{ marginTop:8, padding:10 }}>
          <h4 style={{ margin:'0 0 4px', fontSize:12 }}>Правила федераций</h4>
          {getFederationRules().map((f:any, i:number) => (
            <div key={i} style={{ marginBottom:4, fontSize:10 }}><b>{f.name}</b>: {f.commands} | {(f as any).equipment || ''}</div>
          ))}
        </div>
      </div>
    );
  }

  function renderBiomech() {
    return (
      <div>
        <div className="card" style={{ marginBottom:8, padding:10 }}>
          <h4 style={{ margin:'0 0 6px', fontSize:12 }}>Биомеханический анализ</h4>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
            <div>
              <label style={s_label}>Рост (см)</label>
              <input type="number" value={bmH} onChange={e => setBmH(+e.target.value)}
                style={{ width:'100%', padding:'4px', borderRadius:4, background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text)', fontSize:11, boxSizing:'border-box' }} />
            </div>
            <div>
              <label style={s_label}>Вес (кг)</label>
              <input type="number" value={bmW} onChange={e => setBmW(+e.target.value)}
                style={{ width:'100%', padding:'4px', borderRadius:4, background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text)', fontSize:11, boxSizing:'border-box' }} />
            </div>
            <div>
              <label style={s_label}>Упражнение</label>
              <select value={bmEx} onChange={e => setBmEx(e.target.value)}
                style={{ width:'100%', padding:'4px', borderRadius:4, background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text)', fontSize:11 }}>
                <option value="squat">Присед</option>
                <option value="deadlift">Тяга</option>
                <option value="bench">Жим</option>
              </select>
            </div>
            <div>
              <label style={s_label}>Вес снаряда (кг)</label>
              <input type="number" value={bmLd} onChange={e => setBmLd(+e.target.value)}
                style={{ width:'100%', padding:'4px', borderRadius:4, background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text)', fontSize:11, boxSizing:'border-box' }} />
            </div>
          </div>
          <button onClick={() => setBmOut(analyzeBiomechanics({
            exercise: { exerciseId:bmEx, category:bmEx, isUnilateral:false, expectedROM:{minCm:20,maxCm:80}, jointAnglesDeg:{} } as any,
            load: { weightKg:bmLd, barPosition:'high_bar', stance:'medium', grip:'medium' },
            anthropometry: { heightCm:bmH, weightKg:bmW }
          }))} className="btn primary" style={{ width:'100%', marginTop:6 }}>Анализировать</button>
        </div>
        {bmOut && (
          <div className="card" style={{ padding:10 }}>
            <div style={{ fontWeight:700, fontSize:12 }}>Результаты</div>
            <div style={{ fontSize:9, marginTop:2 }}>{(bmOut as any).risks?.map((r:string) => r).join('; ') || 'Рисков не выявлено'}</div>
          </div>
        )}
      </div>
    );
  }

  function renderPrehab() {
    return (
      <div>
        {getAllPrehabRoutines().map((r:any, i:number) => (
          <div key={i} className="card" style={{ marginBottom:4, padding:8 }}>
            <div style={{ fontWeight:600, fontSize:11 }}>{r.name || r.pattern || r.id}</div>
            <div style={{ fontSize:9, color:'var(--text-light)' }}>{(r as any).exercises?.slice(0,5).join(' | ')}</div>
          </div>
        ))}
        <div className="card" style={{ marginTop:8, padding:10 }}>
          <h4 style={{ margin:'0 0 4px', fontSize:12 }}>Панели анализов крови</h4>
          {getBloodPanels().map((p:any, i:number) => (
            <div key={i} style={{ fontSize:10, marginBottom:2 }}><b>{p.name || p.panel || p.id}</b> — {p.frequency} ({p.markers?.length || 0} маркеров)</div>
          ))}
        </div>
      </div>
    );
  }
};
