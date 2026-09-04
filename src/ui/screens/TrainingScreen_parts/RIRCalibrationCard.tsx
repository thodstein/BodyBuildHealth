/** RIRCalibrationCard.tsx — сводка RIR-калибровки в стиле CalcSection/PopupToggle.
 *  Все raw-стили заменены на CalcSection/MetricCard. */
import React, { useMemo, useState } from 'react';
import { getCalibrationStats, clearCalibrationData, type RIRCalibrationStats } from '../../../engines/rir-calibration.engine';
import { loadSessions } from '../../../engines/workout-logger.engine';
import { recordSessionRIR } from '../../../engines/rir-calibration.engine';
import { applyToPlanner } from './planner-bridge';
import { CalcSection, PopupToggle, ExpandableCard, MetricCard } from '../SRCBBScreen_parts/TrainingPopups';

const ACCENT = '#00e68a';

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
          // План-заглушка: пытаемся взять реальный запланированный RIR из сета (s.rir) или типа упражнения, иначе 2.
          // Ранее всегда 2 — давало одинаковый bias (бред). Теперь per-set и по типу.
          const planFallback = {
            exercises: (s.exercises || []).map(ex => ({
              name: ex.exerciseName || ex.exerciseId || '',
              targetSets: (ex.sets || []).map((set:any) => {
                const planned = typeof set.rir === 'number' ? set.rir : (typeof (set as any).plannedRir === 'number' ? (set as any).plannedRir : undefined);
                if (planned != null) return { rir: planned };
                // эвристика по типу: база 2, изоляция 3
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

  if (!stats || stats.totalSets === 0) {
    return (
      <div className="train-rir">
      <CalcSection icon="🎯" title="RIR-калибровка" accent={ACCENT} desc="Нет данных. Заполняйте RPE или введите вручную">
        <div style={{ display:'flex', gap:6, marginBottom:8 }}>
          <button onClick={()=>setMode('manual')} style={{ flex:1, padding:'6px', borderRadius:6, border: mode==='manual'?'1px solid var(--accent)':'1px solid rgba(255,255,255,0.1)', background: mode==='manual'?'rgba(0,230,138,0.12)':'rgba(255,255,255,0.05)', color: mode==='manual'?'var(--accent)':'#fff', fontSize:10, fontWeight:700, cursor:'pointer' }}>✍️ Вручную</button>
          <button onClick={()=>setMode('diary')} style={{ flex:1, padding:'6px', borderRadius:6, border: mode==='diary'?'1px solid var(--accent)':'1px solid rgba(255,255,255,0.1)', background: mode==='diary'?'rgba(0,230,138,0.12)':'rgba(255,255,255,0.05)', color: mode==='diary'?'var(--accent)':'#fff', fontSize:10, fontWeight:700, cursor:'pointer' }}>📓 Из дневника</button>
        </div>
        {mode==='manual' ? (
          <div style={{ padding:8, borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize:10, color:'#fff', marginBottom:6 }}>Введите подход вручную — bias = план RIR − факт (10−RPE). План берём из программы, не константу.</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
              <label style={{fontSize:10,color:'#fff'}}>Упр <input value={manualEx} onChange={e=>setManualEx(e.target.value)} style={{width:110,marginLeft:4,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.15)',color:'#fff',borderRadius:6,padding:'4px 6px',fontSize:10}} /></label>
              <label style={{fontSize:10,color:'#fff'}}>Вес <input value={manualWeight} onChange={e=>setManualWeight(e.target.value)} style={{width:56,marginLeft:4,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.15)',color:'#fff',borderRadius:6,padding:'4px 6px',fontSize:10}} /></label>
              <label style={{fontSize:10,color:'#fff'}}>Повт <input value={manualReps} onChange={e=>setManualReps(e.target.value)} style={{width:36,marginLeft:4,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.15)',color:'#fff',borderRadius:6,padding:'4px 6px',fontSize:10}} /></label>
              <label style={{fontSize:10,color:'#fff'}}>План RIR <input value={manualPlannedRir} onChange={e=>setManualPlannedRir(e.target.value)} style={{width:36,marginLeft:4,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.15)',color:'#fff',borderRadius:6,padding:'4px 6px',fontSize:10}} /></label>
              <label style={{fontSize:10,color:'#fff'}}>RPE <input value={manualRpe} onChange={e=>setManualRpe(e.target.value)} style={{width:32,marginLeft:4,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.15)',color:'#fff',borderRadius:6,padding:'4px 6px',fontSize:10}} /></label>
            </div>
            {(()=>{
              const rpe = parseFloat(manualRpe)||0, weight=parseFloat(manualWeight)||0, reps=parseInt(manualReps)||0;
              const planned = parseFloat(manualPlannedRir)||0;
              const bias = planned - (10 - rpe);
              if (!weight||!reps||!rpe) return null;
              return <div style={{ marginTop:6, padding:6, borderRadius:6, background: Math.abs(bias)>1?'rgba(239,68,68,0.08)':'rgba(34,197,94,0.08)', border:'1px solid '+(Math.abs(bias)>1?'rgba(239,68,68,0.2)':'rgba(34,197,94,0.2)') }}>
                <div style={{fontSize:10,fontWeight:700,color: Math.abs(bias)>1?'#f87171':'#4ade80'}}>Bias: {bias>0?`+${bias.toFixed(1)}`:`${bias.toFixed(1)}`} — {bias>0.5?'тяжелее чем думаете': bias<-0.5?'легче чем думаете':'точно'}</div>
                <div style={{fontSize:9,color:'#fff',marginTop:2}}>{manualEx} {weight}×{reps} @ RPE {rpe} → RIR {10-rpe}</div>
              </div>;
            })()}
          </div>
        ) : (
        <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.4, padding: 8 }}>
          Нет данных для калибровки. Заполняйте RPE в каждой тренировке — чем больше данных, тем точнее корректировка RIR.
        </div>
        )}
        <button onClick={reprocessAll} disabled={reprocessing} style={{
          width: '100%', marginTop:8, padding: '10px', borderRadius: 8, cursor: reprocessing ? 'wait' : 'pointer',
          border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', color: '#fff', fontSize: 11, fontWeight: 700,
        }}>
          {reprocessing ? '⏳ Обработка...' : '🔄 Переобработать из истории (дневник)'}
        </button>
      </CalcSection>
    </div>
    );
  }

  const topWorst = [...stats.exercises].sort((a, b) => Math.abs(b.avgBias) - Math.abs(a.avgBias)).slice(0, 5);
  const topConsistent = [...stats.exercises].sort((a, b) => b.consistencyScore - a.consistencyScore).slice(0, 3);

  return (
    <div className="train-rir">
    <CalcSection icon="🎯" title="RIR-калибровка" accent={ACCENT} desc={`${stats.totalSets} записанных подходов`}>
      <div style={{ display:'flex', gap:6, marginBottom:8 }}>
        <button onClick={()=>setMode('manual')} style={{ flex:1, padding:'6px', borderRadius:6, border: mode==='manual'?'1px solid var(--accent)':'1px solid rgba(255,255,255,0.1)', background: mode==='manual'?'rgba(0,230,138,0.12)':'rgba(255,255,255,0.05)', color: mode==='manual'?'var(--accent)':'#fff', fontSize:10, fontWeight:700, cursor:'pointer' }}>✍️ Вручную</button>
        <button onClick={()=>setMode('diary')} style={{ flex:1, padding:'6px', borderRadius:6, border: mode==='diary'?'1px solid var(--accent)':'1px solid rgba(255,255,255,0.1)', background: mode==='diary'?'rgba(0,230,138,0.12)':'rgba(255,255,255,0.05)', color: mode==='diary'?'var(--accent)':'#fff', fontSize:10, fontWeight:700, cursor:'pointer' }}>📓 Из дневника</button>
      </div>
      {mode==='manual' && (
        <div style={{ padding:8, borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', marginBottom:8 }}>
          <div style={{ fontSize:10, color:'#fff', marginBottom:6 }}>Ручной тест: план RIR vs факт (10−RPE) → bias.</div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
            <label style={{fontSize:10,color:'#fff'}}>Упр <input value={manualEx} onChange={e=>setManualEx(e.target.value)} style={{width:110,marginLeft:4,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.15)',color:'#fff',borderRadius:6,padding:'4px 6px',fontSize:10}} /></label>
            <label style={{fontSize:10,color:'#fff'}}>Вес <input value={manualWeight} onChange={e=>setManualWeight(e.target.value)} style={{width:56,marginLeft:4,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.15)',color:'#fff',borderRadius:6,padding:'4px 6px',fontSize:10}} /></label>
            <label style={{fontSize:10,color:'#fff'}}>Повт <input value={manualReps} onChange={e=>setManualReps(e.target.value)} style={{width:36,marginLeft:4,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.15)',color:'#fff',borderRadius:6,padding:'4px 6px',fontSize:10}} /></label>
            <label style={{fontSize:10,color:'#fff'}}>План RIR <input value={manualPlannedRir} onChange={e=>setManualPlannedRir(e.target.value)} style={{width:36,marginLeft:4,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.15)',color:'#fff',borderRadius:6,padding:'4px 6px',fontSize:10}} /></label>
            <label style={{fontSize:10,color:'#fff'}}>RPE <input value={manualRpe} onChange={e=>setManualRpe(e.target.value)} style={{width:32,marginLeft:4,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.15)',color:'#fff',borderRadius:6,padding:'4px 6px',fontSize:10}} /></label>
          </div>
          {(()=>{
            const rpe = parseFloat(manualRpe)||0, weight=parseFloat(manualWeight)||0, reps=parseInt(manualReps)||0;
            const planned = parseFloat(manualPlannedRir)||0;
            const bias = planned - (10 - rpe);
            if (!weight||!reps||!rpe) return null;
            return <div style={{ marginTop:6, padding:6, borderRadius:6, background: Math.abs(bias)>1?'rgba(239,68,68,0.08)':'rgba(34,197,94,0.08)', border:'1px solid '+(Math.abs(bias)>1?'rgba(239,68,68,0.2)':'rgba(34,197,94,0.2)') }}>
              <div style={{fontSize:10,fontWeight:700,color: Math.abs(bias)>1?'#f87171':'#4ade80'}}>Bias: {bias>0?`+${bias.toFixed(1)}`:`${bias.toFixed(1)}`} — {bias>0.5?'тяжелее': bias<-0.5?'легче':'точно'}</div>
            </div>;
          })()}
        </div>
      )}
      <div style={{ padding: '0 4px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
          <MetricCard title="Общий bias" accent="#60a5fa">
            <div style={{ fontSize: 16, fontWeight: 800, color: Math.abs(stats.overallAvgBias) > 1.5 ? '#ef4444' : Math.abs(stats.overallAvgBias) > 0.5 ? '#eab308' : '#22c55e' }}>
              {stats.overallAvgBias.toFixed(2)}
            </div>
            <div style={{ fontSize: 10, color: '#fff' }}>{stats.overallAvgBias > 0.5 ? 'Вы тяжелее, чем думаете' : stats.overallAvgBias < -0.5 ? 'Вы легче, чем думаете' : 'Точная оценка'}</div>
          </MetricCard>
          <MetricCard title="Согласованность" accent={stats.overallConsistency >= 0.7 ? '#22c55e' : '#eab308'}>
            <div style={{ fontSize: 16, fontWeight: 800, color: stats.overallConsistency >= 0.7 ? '#22c55e' : '#eab308' }}>
              {(stats.overallConsistency * 100).toFixed(0)}%
            </div>
            <div style={{ fontSize: 10, color: '#fff' }}>{stats.overallConsistency >= 0.7 ? 'Стабильная оценка' : 'Разброс >30%'}</div>
          </MetricCard>
        </div>

        {topWorst.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#fff', marginBottom: 4 }}>📊 Топ-5 по отклонению</div>
              {topWorst.map((ex, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 6px', fontSize: 10, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <span style={{ color: '#fff' }}>{ex.exerciseName}</span>
                <span style={{ fontWeight: 700, color: Math.abs(ex.avgBias) > 1 ? '#ef4444' : '#eab308' }}>{ex.avgBias.toFixed(1)} (n={ex.totalPoints})</span>
              </div>
            ))}
          </div>
        )}

        {topConsistent.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#fff', marginBottom: 4 }}>✅ Самые точные</div>
            {topConsistent.map((ex, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 6px', fontSize: 10 }}>
                <span style={{ color: '#fff' }}>{ex.exerciseName}</span>
                <span style={{ color: '#22c55e', fontWeight: 700 }}>{(ex.consistencyScore * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        )}

        <MetricCard title="Коррекция RIR" accent="#a855f7">
          <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.4 }}>
            {stats.overallAvgBias > 0.5
              ? `Рекомендуется RIR+${Math.round(stats.overallAvgBias)}: ваши RIR-оценки на ${Math.abs(stats.overallAvgBias).toFixed(1)} пункта жестче реальности.`
              : stats.overallAvgBias < -0.5
                ? `Рекомендуется RIR${Math.round(stats.overallAvgBias)}: вы недооцениваете интенсивность на ${Math.abs(stats.overallAvgBias).toFixed(1)} пункта.`
                : 'Ваши RIR-оценки точны. Продолжайте в том же духе.'}
          </div>
        </MetricCard>

        <PopupToggle label="Применить калибровку к плану" value={applyOn} onChange={v => { setApplyOn(v); if (v) applyToPlanner({ kind: 'pri', label: `RIR-калибровка: bias ${stats.overallAvgBias.toFixed(1)}`, data: { rirShift: Math.round(stats.overallAvgBias), volumeMult: 1 } }); }} icon="🔄" />

        <button onClick={reprocessAll} disabled={reprocessing} style={{
          width: '100%', marginTop: 6, padding: '8px', borderRadius: 8, cursor: reprocessing ? 'wait' : 'pointer',
          border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#fff', fontSize: 10, fontWeight: 600,
        }}>
          {reprocessing ? '⏳ Переобработка...' : '🔄 Переобработать калибровку из истории'}
        </button>
      </div>
    </CalcSection>
    </div>
  );
};