/** RIRCalibrationCard — стекло 0.42 0.07 blur12 radius14, белый #fff, gradient подвкладки, без sticky */
import React, { useMemo, useState } from 'react';
import { getCalibrationStats, clearCalibrationData, type RIRCalibrationStats } from '../../../engines/rir-calibration.engine';
import { loadSessions } from '../../../engines/workout-logger.engine';
import { recordSessionRIR } from '../../../engines/rir-calibration.engine';
import { applyToPlanner } from './planner-bridge';

const ACCENT = '#00e68a';
const GLASS: React.CSSProperties = { background:'rgba(24,24,27,0.42)', border:'1px solid rgba(255,255,255,0.07)', backdropFilter:'blur(12px)', borderRadius:14 } as any;

const subTab = (active:boolean): React.CSSProperties => ({
  flex:1, padding:'7px 8px', borderRadius:20, cursor:'pointer', fontSize:10, fontWeight:800,
  border: active ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.07)',
  background: active ? 'linear-gradient(135deg,#00e68a,#00c853)' : 'rgba(255,255,255,0.04)',
  color: active ? '#000' : '#fff',
});

export const RIRCalibrationCard: React.FC = () => {
  const [mode, setMode] = useState<'diary'|'manual'>('diary');
  const [manualEx, setManualEx] = useState('Жим лёжа');
  const [manualWeight, setManualWeight] = useState('100');
  const [manualReps, setManualReps] = useState('5');
  const [manualRpe, setManualRpe] = useState('8');
  const [manualPlannedRir, setManualPlannedRir] = useState('2');
  const [refresh, setRefresh] = useState(0);
  const [reprocessing, setReprocessing] = useState(false);
  const [applyOn, setApplyOn] = useState(false);

  const stats: RIRCalibrationStats | null = useMemo(() => {
    try { return getCalibrationStats(); } catch { return null; }
  }, [refresh]);

  const reprocessAll = () => {
    setReprocessing(true);
    try {
      clearCalibrationData();
      const sessions = loadSessions();
      sessions.forEach(s => {
        try {
          const planFallback = {
            exercises: (s.exercises || []).map(ex => ({
              name: ex.exerciseName || ex.exerciseId || '',
              targetSets: (ex.sets || []).map((set:any) => {
                const planned = typeof set.rir === 'number' ? set.rir : (typeof (set as any).plannedRir === 'number' ? (set as any).plannedRir : undefined);
                if (planned != null) return { rir: planned };
                const isCompound = !/сгибан|разгибан|махи|подъём|отведен|скручив/i.test(ex.exerciseName || '');
                return { rir: isCompound ? 2 : 3 };
              }),
            })),
          };
          recordSessionRIR(s, planFallback);
        } catch { /* skip */ }
      });
      setRefresh(v => v + 1);
    } finally { setReprocessing(false); }
  };

  const Shell: React.FC<{ children: React.ReactNode; title?:string; desc?:string }> = ({ children, title='RIR-калибровка', desc }) => (
    <div style={{ ...GLASS, padding:12 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
        <div style={{ width:24, height:24, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#00e68a,#00c853)', color:'#000', fontWeight:900, fontSize:12 }}>🎯</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:11, fontWeight:800, color:'#fff' }}>{title}</div>
          {desc && <div style={{ fontSize:10, color:'#fff', opacity:0.85, marginTop:1 }}>{desc}</div>}
        </div>
      </div>
      {children}
    </div>
  );

  if (!stats || stats.totalSets === 0) {
    return (
      <Shell title="RIR-калибровка" desc="Нет данных — заполняй RPE или введи вручную">
        <div style={{ display:'flex', gap:6, marginBottom:8 }}>
          <button onClick={()=>setMode('manual')} style={subTab(mode==='manual')}>✍️ Вручную</button>
          <button onClick={()=>setMode('diary')} style={subTab(mode==='diary')}>📓 Из дневника</button>
        </div>
        {mode==='manual' ? (
          <div style={{ padding:9, borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ fontSize:10, color:'#fff', marginBottom:7, lineHeight:1.4, opacity:0.92 }}>Введи подход вручную — bias = план RIR − факт (10−RPE). План — из программы.</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
              <label style={{fontSize:10,color:'#fff'}}>Упр <input value={manualEx} onChange={e=>setManualEx(e.target.value)} style={{width:110,marginLeft:4,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.07)',color:'#fff',borderRadius:8,padding:'5px 7px',fontSize:10}} /></label>
              <label style={{fontSize:10,color:'#fff'}}>Вес <input value={manualWeight} onChange={e=>setManualWeight(e.target.value)} style={{width:56,marginLeft:4,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.07)',color:'#fff',borderRadius:8,padding:'5px 7px',fontSize:10}} /></label>
              <label style={{fontSize:10,color:'#fff'}}>Повт <input value={manualReps} onChange={e=>setManualReps(e.target.value)} style={{width:36,marginLeft:4,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.07)',color:'#fff',borderRadius:8,padding:'5px 7px',fontSize:10}} /></label>
              <label style={{fontSize:10,color:'#fff'}}>План RIR <input value={manualPlannedRir} onChange={e=>setManualPlannedRir(e.target.value)} style={{width:36,marginLeft:4,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.07)',color:'#fff',borderRadius:8,padding:'5px 7px',fontSize:10}} /></label>
              <label style={{fontSize:10,color:'#fff'}}>RPE <input value={manualRpe} onChange={e=>setManualRpe(e.target.value)} style={{width:32,marginLeft:4,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.07)',color:'#fff',borderRadius:8,padding:'5px 7px',fontSize:10}} /></label>
            </div>
            {(()=>{
              const rpe = parseFloat(manualRpe)||0, weight=parseFloat(manualWeight)||0, reps=parseInt(manualReps)||0;
              const planned = parseFloat(manualPlannedRir)||0;
              const bias = planned - (10 - rpe);
              if (!weight||!reps||!rpe) return null;
              return <div style={{ marginTop:8, padding:7, borderRadius:8, background: Math.abs(bias)>1?'rgba(239,68,68,0.07)':'rgba(34,197,94,0.07)', border:'1px solid rgba(255,255,255,0.07)' }}>
                <div style={{fontSize:10,fontWeight:800,color:'#fff'}}>Bias: {bias>0?`+${bias.toFixed(1)}`:`${bias.toFixed(1)}`} — {bias>0.5?'тяжелее чем думаешь': bias<-0.5?'легче чем думаешь':'точно'}</div>
                <div style={{fontSize:9,color:'#fff',marginTop:2,opacity:0.85}}>{manualEx} {weight}×{reps} @ RPE {rpe} → RIR {10-rpe}</div>
              </div>;
            })()}
          </div>
        ) : (
        <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.5, padding: 9, borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', opacity:0.9 }}>
          Нет данных для калибровки. Заполняй RPE в каждой тренировке — чем больше подходов, тем точнее bias.
        </div>
        )}
        <button onClick={reprocessAll} disabled={reprocessing} style={{
          width: '100%', marginTop:10, padding: '10px', borderRadius: 10, cursor: reprocessing ? 'wait' : 'pointer',
          border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 10, fontWeight:800,
        }}>
          {reprocessing ? '⏳ Обработка...' : '🔄 Переобработать из истории (дневник)'}
        </button>
      </Shell>
    );
  }

  const topWorst = [...stats.exercises].sort((a, b) => Math.abs(b.avgBias) - Math.abs(a.avgBias)).slice(0, 5);
  const topConsistent = [...stats.exercises].sort((a, b) => b.consistencyScore - a.consistencyScore).slice(0, 3);

  return (
    <Shell title="RIR-калибровка" desc={`${stats.totalSets} записанных подходов`}>
      <div style={{ display:'flex', gap:6, marginBottom:8 }}>
        <button onClick={()=>setMode('manual')} style={subTab(mode==='manual')}>✍️ Вручную</button>
        <button onClick={()=>setMode('diary')} style={subTab(mode==='diary')}>📓 Из дневника</button>
      </div>
      {mode==='manual' && (
        <div style={{ padding:9, borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', marginBottom:10 }}>
          <div style={{ fontSize:10, color:'#fff', marginBottom:7, opacity:0.92 }}>Ручной тест: план RIR vs факт (10−RPE) → bias.</div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
            <label style={{fontSize:10,color:'#fff'}}>Упр <input value={manualEx} onChange={e=>setManualEx(e.target.value)} style={{width:110,marginLeft:4,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.07)',color:'#fff',borderRadius:8,padding:'5px 7px',fontSize:10}} /></label>
            <label style={{fontSize:10,color:'#fff'}}>Вес <input value={manualWeight} onChange={e=>setManualWeight(e.target.value)} style={{width:56,marginLeft:4,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.07)',color:'#fff',borderRadius:8,padding:'5px 7px',fontSize:10}} /></label>
            <label style={{fontSize:10,color:'#fff'}}>Повт <input value={manualReps} onChange={e=>setManualReps(e.target.value)} style={{width:36,marginLeft:4,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.07)',color:'#fff',borderRadius:8,padding:'5px 7px',fontSize:10}} /></label>
            <label style={{fontSize:10,color:'#fff'}}>План RIR <input value={manualPlannedRir} onChange={e=>setManualPlannedRir(e.target.value)} style={{width:36,marginLeft:4,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.07)',color:'#fff',borderRadius:8,padding:'5px 7px',fontSize:10}} /></label>
            <label style={{fontSize:10,color:'#fff'}}>RPE <input value={manualRpe} onChange={e=>setManualRpe(e.target.value)} style={{width:32,marginLeft:4,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.07)',color:'#fff',borderRadius:8,padding:'5px 7px',fontSize:10}} /></label>
          </div>
          {(()=>{
            const rpe = parseFloat(manualRpe)||0, weight=parseFloat(manualWeight)||0, reps=parseInt(manualReps)||0;
            const planned = parseFloat(manualPlannedRir)||0;
            const bias = planned - (10 - rpe);
            if (!weight||!reps||!rpe) return null;
            return <div style={{ marginTop:7, padding:7, borderRadius:8, background: Math.abs(bias)>1?'rgba(239,68,68,0.07)':'rgba(34,197,94,0.07)', border:'1px solid rgba(255,255,255,0.07)' }}>
              <div style={{fontSize:10,fontWeight:800,color:'#fff'}}>Bias: {bias>0?`+${bias.toFixed(1)}`:`${bias.toFixed(1)}`} — {bias>0.5?'тяжелее': bias<-0.5?'легче':'точно'}</div>
            </div>;
          })()}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom:8 }}>
        <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:10, textAlign:'center' }}>
          <div style={{ fontSize: 10, color: '#fff', opacity:0.8, marginBottom: 4, fontWeight:700 }}>Общий bias</div>
          <div style={{ fontSize: 17, fontWeight: 900, color: Math.abs(stats.overallAvgBias) > 1.5 ? '#ef4444' : Math.abs(stats.overallAvgBias) > 0.5 ? '#eab308' : '#22c55e' }}>
            {stats.overallAvgBias.toFixed(2)}
          </div>
          <div style={{ fontSize: 10, color: '#fff', opacity:0.85, marginTop:2 }}>{stats.overallAvgBias > 0.5 ? 'Тяжелее, чем думаешь' : stats.overallAvgBias < -0.5 ? 'Легче, чем думаешь' : 'Точно'}</div>
        </div>
        <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:10, textAlign:'center' }}>
          <div style={{ fontSize: 10, color: '#fff', opacity:0.8, marginBottom: 4, fontWeight:700 }}>Согласованность</div>
          <div style={{ fontSize: 17, fontWeight: 900, color: stats.overallConsistency >= 0.7 ? '#22c55e' : '#eab308' }}>
            {(stats.overallConsistency * 100).toFixed(0)}%
          </div>
          <div style={{ fontSize: 10, color: '#fff', opacity:0.85, marginTop:2 }}>{stats.overallConsistency >= 0.7 ? 'Стабильно' : 'Разброс >30%'}</div>
        </div>
      </div>

      {topWorst.length > 0 && (
        <div style={{ marginBottom: 10, padding:8, borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#fff', marginBottom: 5 }}>📊 Топ-5 по отклонению</div>
            {topWorst.map((ex, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 6px', fontSize: 10, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ color: '#fff' }}>{ex.exerciseName}</span>
              <span style={{ fontWeight: 800, color: Math.abs(ex.avgBias) > 1 ? '#ef4444' : '#eab308' }}>{ex.avgBias.toFixed(1)} (n={ex.totalPoints})</span>
            </div>
          ))}
        </div>
      )}

      {topConsistent.length > 0 && (
        <div style={{ marginBottom: 10, padding:8, borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#fff', marginBottom: 5 }}>✅ Самые точные</div>
          {topConsistent.map((ex, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 6px', fontSize: 10 }}>
              <span style={{ color: '#fff' }}>{ex.exerciseName}</span>
              <span style={{ color: '#22c55e', fontWeight: 800 }}>{(ex.consistencyScore * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ padding:9, borderRadius:10, background:'rgba(168,85,247,0.06)', border:'1px solid rgba(255,255,255,0.07)', marginBottom:8 }}>
        <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.5, opacity:0.92 }}>
          {stats.overallAvgBias > 0.5
            ? `Рекомендация: RIR+${Math.round(stats.overallAvgBias)} — твои оценки жестче реальности на ${Math.abs(stats.overallAvgBias).toFixed(1)}.`
            : stats.overallAvgBias < -0.5
              ? `Рекомендация: RIR${Math.round(stats.overallAvgBias)} — недооцениваешь интенсивность на ${Math.abs(stats.overallAvgBias).toFixed(1)}.`
              : 'Твои RIR-оценки точны — продолжай так же.'}
        </div>
      </div>

      <button onClick={() => { const v=!applyOn; setApplyOn(v); if (v) applyToPlanner({ kind: 'pri', label: `RIR-калибровка: bias ${stats.overallAvgBias.toFixed(1)}`, data: { rirShift: Math.round(stats.overallAvgBias), volumeMult: 1 } }); }} style={{ width:'100%', padding:'10px 12px', borderRadius:10, cursor:'pointer', border:'1px solid rgba(255,255,255,0.07)', background: applyOn ? 'linear-gradient(135deg,#00e68a,#00c853)' : 'rgba(255,255,255,0.05)', color: applyOn?'#000':'#fff', fontWeight:800, fontSize:10 }}>
        {applyOn ? '✓ Калибровка применена' : '🔄 Применить калибровку к плану'}
      </button>

      <button onClick={reprocessAll} disabled={reprocessing} style={{
        width: '100%', marginTop: 8, padding: '9px', borderRadius: 10, cursor: reprocessing ? 'wait' : 'pointer',
        border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)', color: '#fff', fontSize: 10, fontWeight:700,
      }}>
        {reprocessing ? '⏳ Переобработка...' : '🔄 Переобработать калибровку из истории'}
      </button>
    </Shell>
  );
};
