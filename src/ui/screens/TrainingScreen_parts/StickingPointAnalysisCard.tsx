import React, { useMemo, useState } from 'react';
import type { WorkoutLog } from '../../../core/types';
import { diagnoseLift, phaseForReps } from '../../../engines/pro/lift-diagnostics.engine';
import { epley1RM } from '../../../engines/e1rm';
import { WEAK_POINTS_BY_LIFT, type Lift, type WeakPoint } from '../../../engines/lms/weakpoint-pl';
import { applyToPlanner } from './planner-bridge';

interface LiftFailureData {
  lift: Lift;
  label: string;
  currentMax: number;
  priorMax: number;
  e1rmDeltaPct: number | null;
  totalFailedSets: number;
  failureRate: number;
  likelyPhase: WeakPoint | null;
  diagnosis: any;
  sumoHardSets: number;
}

const TREND_WINDOW_DAYS = 28;
const GLASS: React.CSSProperties = { background:'rgba(24,24,27,0.42)', border:'1px solid rgba(255,255,255,0.07)', backdropFilter:'blur(12px)', borderRadius:14 } as any;

function detectFailures(sessions: WorkoutLog[], lift: Lift, aliases: string[]): LiftFailureData | null {
  const phaseCounts: Record<string, number> = {};
  let totalHard = 0;
  let sumoHard = 0;
  let currentMax = 0;
  let priorMax = 0;
  let hasLift = false;
  const dated = sessions.filter(w => w && typeof w.date === 'string' && !Number.isNaN(Date.parse(w.date)));
  const maxDate = dated.length > 0 ? dated.reduce((m, w) => Math.max(m, Date.parse(w.date)), 0) : 0;
  const ageOf = (date: string): number => maxDate > 0 ? Math.max(0, Math.floor((maxDate - Date.parse(date)) / 86400000)) : 0;
  sessions.forEach((w: any) => (w.exercises || []).forEach((e: any) => {
    const en = (e.exerciseName || e.exerciseId || '').toLowerCase();
    if (!aliases.some(a => en.includes(a))) return;
    hasLift = true;
    const isSumo = lift === 'deadlift' && /сумо|sumo/.test(en);
    const age = ageOf(w.date ?? '');
    const isPrior = age >= TREND_WINDOW_DAYS && age < TREND_WINDOW_DAYS * 2;
    (e.sets || []).forEach((s: any) => {
      const weight = s.weight || 0;
      const reps = s.reps || 0;
      const rpe = (s.rpe && s.rpe > 0) ? s.rpe : (s.rir != null ? 10 - s.rir : 0);
      const e1rm = epley1RM(weight, reps);
      if (Number.isFinite(e1rm)) {
        if (isPrior && e1rm > priorMax) priorMax = Math.round(e1rm);
        else if (!isPrior && e1rm > currentMax) currentMax = Math.round(e1rm);
      }
      const isHard = (rpe >= 8 && weight > 0) || (rpe === 0 && reps > 0 && reps <= 2 && weight > 0);
      if (!isHard) return;
      totalHard += 1;
      const phaseHint = isSumo
        ? (reps <= 2 ? 'sumo_start' : reps <= 5 ? 'sumo_lockout' : null)
        : phaseForReps(reps, lift);
      if (isSumo) sumoHard += 1;
      if (phaseHint) phaseCounts[phaseHint] = (phaseCounts[phaseHint] || 0) + 1;
    });
  }));
  if (!hasLift) return null;
  const phases = WEAK_POINTS_BY_LIFT[lift] ?? [];
  let likelyPhase: WeakPoint | null;
  if (totalHard > 0 && Object.keys(phaseCounts).length > 0) {
    const top = Object.entries(phaseCounts).sort((a, b) => b[1] - a[1])[0];
    likelyPhase = (phases.includes(top[0] as WeakPoint) ? top[0] : null) as WeakPoint | null;
  } else {
    likelyPhase = null;
  }
  const diagnosis = likelyPhase ? diagnoseLift(lift, likelyPhase) : null;
  const totalSets = sessions.reduce((s, w: any) => s + (w.exercises || []).reduce((ss: number, e: any) => {
    const en = (e.exerciseName || e.exerciseId || '').toLowerCase();
    return ss + (aliases.some(a => en.includes(a)) ? (e.sets || []).length : 0);
  }, 0), 0);
  const labels: Record<Lift, string> = { squat: 'Присед', bench: 'Жим лёжа', deadlift: 'Становая тяга (классика)', ohp: 'Жим стоя', row: 'Тяга в наклоне', pulldown: 'Тяга верхнего блока', incline_press: 'Жим на наклонной', sumo: 'Становая тяга (сумо)', biceps: 'Подъём на бицепс' };
  return {
    lift, label: labels[lift] || lift,
    currentMax,
    priorMax,
    e1rmDeltaPct: priorMax > 0 ? Math.round(((currentMax - priorMax) / priorMax) * 1000) / 10 : null,
    totalFailedSets: totalHard,
    failureRate: totalSets > 0 ? Math.round((totalHard / totalSets) * 100) : 0,
    likelyPhase,
    diagnosis,
    sumoHardSets: sumoHard,
  };
}

const LIFT_ALIASES: Record<Lift, string[]> = {
  squat: ['squat', 'присед', 'приседания', 'barbell squat'],
  bench: ['bench', 'жим', 'жим лёжа', 'bench press'],
  deadlift: ['deadlift', 'тяга', 'становая тяга', 'conventional deadlift'],
  ohp: ['overhead press', 'жим стоя', 'ohp', 'military press'],
  row: ['barbell row', 'тяга в наклоне', 'bent over row', 'pendlay row'],
  pulldown: ['pulldown', 'тяга верхнего', 'lat pulldown', 'подтягивания'],
  incline_press: ['incline bench', 'жим на наклонной', 'жим под углом', 'incline press'],
  sumo: ['sumo', 'сумо', 'тяга сумо', 'sumo deadlift'],
  biceps: ['biceps', 'бицепс', 'подъём на бицепс', 'сгибание', 'curl'],
};

const PHASE_LABELS: Record<string, string> = {
  off_chest: 'Срыв с груди',
  mid: 'Середина амплитуды',
  lockout: 'Дожим',
  start: 'Старт',
  bottom: 'Яма (нижняя точка)',
  sumo_start: 'Сумо: старт (срыв)',
  sumo_mid: 'Сумо: середина (проход коленей)',
  sumo_lockout: 'Сумо: дожим (замыкание)',
  ohp_start: 'Старт с плеч',
  ohp_mid: 'Середина',
  ohp_lockout: 'Дожим вверх',
  row_start: 'Старт (съём)',
  row_mid: 'Середина',
  row_squeeze: 'Сведение лопаток',
  pd_top: 'Верх (старт)',
  pd_mid: 'Середина',
  pd_squeeze: 'Сведение к груди',
  inc_off: 'Сход с груди (верх)',
  inc_mid: 'Середина',
  inc_lockout: 'Дожим',
  biceps_start: 'Сгибание: старт',
  biceps_mid: 'Сгибание: середина',
  biceps_top: 'Сгибание: пик (сокращение)',
};

const pill = (active:boolean): React.CSSProperties => ({
  flex:1, padding:'6px 8px', borderRadius:20, cursor:'pointer', fontSize:10, fontWeight:800,
  border: active ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.07)',
  background: active ? 'linear-gradient(135deg,#00e68a,#00c853)' : 'rgba(255,255,255,0.04)',
  color: active ? '#000' : '#fff',
});
const liftPill = (active:boolean): React.CSSProperties => ({
  padding:'5px 9px', borderRadius:20, cursor:'pointer', fontSize:10, fontWeight:700,
  border: active ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.07)',
  background: active ? 'linear-gradient(135deg,#00e68a,#00c853)' : 'rgba(255,255,255,0.04)',
  color: active ? '#000' : '#fff',
});

const StickingPointAnalysisCard: React.FC<{ sessions: WorkoutLog[] }> = ({ sessions }) => {
  const [mode, setMode] = useState<'diary'|'manual'>('diary');
  const [manualLift, setManualLift] = useState<Lift>('bench');
  const [manualWeight, setManualWeight] = useState('100');
  const [manualReps, setManualReps] = useState('3');
  const [manualRir, setManualRir] = useState('1');
  const [selectedLift, setSelectedLift] = useState<Lift>('bench');

  const analysis = useMemo(() => {
    if (mode==='manual') return [];
    if (!sessions.length) return [];
    const lifts: Lift[] = ['bench', 'squat', 'deadlift', 'ohp', 'row', 'pulldown', 'incline_press', 'sumo', 'biceps'];
    return lifts.map(l => detectFailures(sessions, l, LIFT_ALIASES[l])).filter(Boolean) as LiftFailureData[];
  }, [sessions, mode]);

  const manualData = useMemo(()=>{
    if (mode!=='manual') return null;
    const reps = parseInt(manualReps)||0;
    const weight = parseFloat(manualWeight)||0;
    if (reps<=0 || weight<=0) return null;
    const phase = phaseForReps(reps, manualLift);
    const diagnosis = phase ? diagnoseLift(manualLift, phase) : null;
    const e1rm = epley1RM(weight, reps);
    return { lift: manualLift, reps, weight, rir: parseInt(manualRir)||0, phase, diagnosis, e1rm };
  }, [mode, manualLift, manualWeight, manualReps, manualRir]);

  if ((mode as string)==='diary' && !analysis.length) return (
    <div style={{ ...GLASS, padding:12 }}>
      <div style={{ display:'flex', gap:6, marginBottom:10 }}>
        <button onClick={()=>setMode('manual')} style={pill((mode as string)==='manual')}>✍️ Вручную</button>
        <button onClick={()=>setMode('diary')} style={pill((mode as string)==='diary')}>📓 Из дневника</button>
      </div>
      <div style={{ fontSize: 11, fontWeight: 800, color:'#fff', marginBottom:6 }}>
        🔬 Анализ срывов (sticking points)
      </div>
      <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.5, opacity:0.92 }}>
        Нет тяжёлых подходов (RPE≥8) по дневнику. Сделай 1–2 подхода в отказной зоне через «▶ Проведение тренировки» — здесь появится фаза срыва и коррекции. Или включи «Вручную» и введи вес/повторы.
      </div>
    </div>
  );

  const active = analysis.find(a => a.lift === selectedLift) || analysis[0];

  return (
    <div style={{ ...GLASS, padding:12 }}>
      <div style={{ display:'flex', gap:6, marginBottom:10 }}>
        <button onClick={()=>setMode('manual')} style={pill(mode==='manual')}>✍️ Вручную</button>
        <button onClick={()=>setMode('diary')} style={pill(mode==='diary')}>📓 Из дневника</button>
      </div>
      {mode==='manual' ? (
        <div style={{ padding:9, borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', marginBottom:10 }}>
          <div style={{ fontSize:10, fontWeight:800, color:'#fff', marginBottom:7 }}>✍️ Ручной ввод — фаза по повторам</div>
          <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:8 }}>
            {(['bench','squat','deadlift','ohp','row'] as Lift[]).map(l=> <button key={l} onClick={()=>setManualLift(l)} style={liftPill(manualLift===l)}>{l}</button>)}
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
            <label style={{fontSize:10,color:'#fff'}}>Вес <input value={manualWeight} onChange={e=>setManualWeight(e.target.value)} style={{width:60,marginLeft:4,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.07)',color:'#fff',borderRadius:8,padding:'5px 7px',fontSize:10}} /></label>
            <label style={{fontSize:10,color:'#fff'}}>Повт <input value={manualReps} onChange={e=>setManualReps(e.target.value)} style={{width:40,marginLeft:4,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.07)',color:'#fff',borderRadius:8,padding:'5px 7px',fontSize:10}} /></label>
            <label style={{fontSize:10,color:'#fff'}}>RIR <input value={manualRir} onChange={e=>setManualRir(e.target.value)} style={{width:32,marginLeft:4,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.07)',color:'#fff',borderRadius:8,padding:'5px 7px',fontSize:10}} /></label>
          </div>
          {manualData && (
            <div style={{ marginTop:8, padding:8, borderRadius:8, background:'rgba(0,230,138,0.06)', border:'1px solid rgba(255,255,255,0.07)' }}>
              <div style={{fontSize:10,fontWeight:800,color:'#fff'}}>Фаза: {manualData.phase ? (PHASE_LABELS[manualData.phase]||manualData.phase) : 'неопределена (≥6 повт)'} · e1RM ~{Math.round(manualData.e1rm)}кг</div>
              {manualData.diagnosis && <>
                <div style={{fontSize:10,color:'#fff',marginTop:3, opacity:0.92}}>{manualData.diagnosis.biomechanicalReason}</div>
                <div style={{fontSize:10,marginTop:4}}><span style={{color:'#fff', fontWeight:700}}>Коррекции:</span> <span style={{color:'#fff', opacity:0.9}}>{manualData.diagnosis.corrections.slice(0,3).join(' · ')}</span></div>
              </>}
            </div>
          )}
        </div>
      ) : null}
      <div style={{ fontSize: 11, fontWeight: 800, color:'#fff', marginBottom:8 }}>
        🔬 Срывы — {mode==='manual'?'вручную':'из дневника'}
      </div>
      {mode==='diary' && <div style={{ display: 'flex', gap: 5, marginBottom: 10, flexWrap: 'wrap' }}>
        {analysis.map(a => (
          <button key={a.lift} onClick={() => setSelectedLift(a.lift)} style={{
            padding: '5px 9px', borderRadius:20, cursor:'pointer', fontSize:10, fontWeight: a.lift === selectedLift ? 800 : 700,
            border: a.lift === selectedLift ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.07)',
            background: a.lift === selectedLift ? 'linear-gradient(135deg,#00e68a,#00c853)' : 'rgba(255,255,255,0.04)',
            color: a.lift === selectedLift ? '#000' : '#fff',
          }}>
            {a.label} {a.failureRate > 0 && <span style={{ opacity:0.9 }}>({a.failureRate}%)</span>}
          </button>
        ))}
      </div>}
      {active && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7, marginBottom:8 }}>
            <div style={{ padding:'8px 9px', borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', textAlign:'center' }}>
              <div style={{ fontSize:9, color:'#fff', opacity:0.7, fontWeight:700 }}>Текущий макс</div>
              <div style={{ fontSize:14, fontWeight:900, color:'#fff', marginTop:2 }}>{active.currentMax} кг</div>
            </div>
            <div style={{ padding:'8px 9px', borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', textAlign:'center' }}>
              <div style={{ fontSize:9, color:'#fff', opacity:0.7, fontWeight:700 }}>e1RM-тренд 28д</div>
              {active.e1rmDeltaPct != null ? (
                <div style={{ fontSize:12, fontWeight:900, color: active.e1rmDeltaPct <= -5 ? '#ef4444' : active.e1rmDeltaPct <= 1 ? '#f59e0b' : '#22c55e', marginTop:2 }}>
                  {active.e1rmDeltaPct > 0 ? '▲ +' : active.e1rmDeltaPct < 0 ? '▼ ' : '→ '}{active.e1rmDeltaPct}% <span style={{ fontSize:9, color:'#fff', opacity:0.7 }}>({active.priorMax} кг)</span>
                </div>
              ) : <div style={{ fontSize:11, color:'#fff', opacity:0.6, marginTop:2 }}>—</div>}
            </div>
          </div>
          {active.totalFailedSets > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7, fontSize: 10, padding:'6px 8px', borderRadius:8, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(255,255,255,0.07)' }}>
              <span style={{ color: '#fff' }}>Тяжёлых подходов (RPE≥8):</span>
              <span style={{ fontWeight: 800, color: '#fff' }}>{active.totalFailedSets} ({active.failureRate}%)</span>
            </div>
          )}
          {active.sumoHardSets > 0 && (
            <div style={{ marginBottom: 7, padding: 7, borderRadius: 8, background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(255,255,255,0.07)', fontSize: 10, color: '#fff' }}>
              🤸 Сумо-тяга: {active.sumoHardSets} тяжёлых подходов — сверь фазы «Сумо: старт» и «Сумо: дожим».
            </div>
          )}
          {active.likelyPhase && (
            <div style={{ marginBottom: 8, padding: 9, borderRadius: 10, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
                Вероятная слабая фаза: {PHASE_LABELS[active.likelyPhase] || active.likelyPhase}
              </div>
              {active.diagnosis && (
                <>
                  <div style={{ fontSize: 10, color: '#fff', marginBottom: 4, lineHeight:1.45, opacity:0.92 }}>
                    {active.diagnosis.biomechanicalReason}
                  </div>
                  <div style={{ fontSize: 10, color: '#fff', marginBottom: 4, opacity:0.92 }}>
                    Слабые мышцы: {active.diagnosis.weakMuscles.join(', ')}
                  </div>
                  <div style={{ fontSize: 10 }}>
                    <span style={{ color: '#fff', fontWeight:700 }}>Коррекции:</span>
                    <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                      {active.diagnosis.corrections.slice(0, 4).map((c: string, i: number) => (
                        <li key={i} style={{ color: '#fff', fontSize: 10, marginBottom: 2, opacity:0.92 }}>{c}</li>
                      ))}
                    </ul>
                  </div>
                  <div style={{ fontSize: 10, color: '#fff', marginTop: 6, opacity:0.9 }}>
                    🎯 {active.diagnosis.loadCues}
                  </div>
                </>
              )}
            </div>
          )}
          {active.totalFailedSets === 0 && (
            <div style={{ fontSize: 10, color: '#fff', padding: '7px 9px', background: 'rgba(34,197,94,0.07)', borderRadius: 8, border:'1px solid rgba(255,255,255,0.07)' }}>
              ✅ Срывов не обнаружено — прогрессия стабильна.
            </div>
          )}
        </div>
      )}
      {active && active.diagnosis && active.diagnosis.weakMuscles && active.diagnosis.weakMuscles.length > 0 && (() => { const mapM = (m: string) => { const l = m.toLowerCase(); if (/трицеп|бицеп|arm/.test(l)) return 'arms'; if (/дельт|плеч|shoulder/.test(l)) return 'shoulders'; if (/груд|chest|pec/.test(l)) return 'chest'; if (/спин|широк|трап|back|lat|разгибат/.test(l)) return 'back'; if (/квадр|ягод|икр|бедр|ног|привод|leg|quad|glute|calf|adductor/.test(l)) return 'legs'; if (/пресс|кор|core|ab/.test(l)) return 'core'; return null; }; const groups = Array.from(new Set(active.diagnosis.weakMuscles.map(mapM).filter(Boolean) as string[])); return (
        <div style={{ marginTop: 10, padding: 9, borderRadius: 10, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ fontSize: 10, color: '#fff', marginBottom: 7, lineHeight:1.4, opacity:0.92 }}>Слабые мышцы по срывам «{active.label}»: {active.diagnosis.weakMuscles.join(', ')} → приоритет групп планировщику.</div>
          <button onClick={() => applyToPlanner({ kind: 'weakpoints', label: 'Срывы ' + active.label + ': ' + groups.join(', '), data: { groups, lift: active.lift } })} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 11, minHeight: 40 }}>🛠 Слабые мышцы → планировщик</button>
        </div>
      ); })()}
    </div>
  );
};

export default React.memo(StickingPointAnalysisCard);
