import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { EXERCISE_CATALOG, getExercisesByGroup } from '../../../core/exercise-catalog';
import { calcTraining, calcExercisePrescription, EXERCISE_DB, TRAINING_SPLITS, TRAINING_LEVEL_CONFIGS, LEVEL_VOLUMES } from '../../../engines/training.engine';
import { generateMacrocycle, generateBlockPlan, getCurrentWeekPlan, BLOCK_SEQUENCES, type MacrocyclePlan, type Microcycle, type MacrocycleInput } from '../../../engines/training-periodization.engine';
import { selectSplit, getSplitOptions, type SplitCandidate } from '../../../engines/split-selector.engine';
import { selectProgressionRule } from '../../../engines/progression.engine';
import { RIR_MATRIX, generateWeeklyPlan } from '../../../engines/rir-matrix.engine';
import { StrengthDiary, type StrengthStats, type WeeklyProgress, type ProgressionAlert } from '../../../engines/strength-diary.engine';
import type { WorkoutLog } from '../../../core/types';
import { generateCooldown } from '../../../engines/cooldown.engine';
import { selectSetScheme } from '../../../engines/set-scheme.engine';
import { selectTempo, formatTempo } from '../../../engines/tempo.engine';
import { useDataLink } from '../../../core/data-link';
import type { TrainingInput, TrainingOutput, Exercise, MovementPattern } from '../../../core/types';
import { computeAnalytics, type AnalyticsSnapshot, type WeeklyBreakdown } from '../../../engines/analytics-engine';
import { computeConstraints } from '../../../engines/training-constraints.engine';
import { generatePeriodization, getPhaseParams } from '../../../engines/cycle-periodization.engine';
import { getTrainingMethods, getMethodsByCategory, getVolumeReferences, getVolumeByMuscle, getSplitVisuals, type TrainingMethod } from '../../../engines/training-methodology.engine';
import { buildVisualDashboard, computeWeeklyChart, computeMuscleVolume, computeProgression, type VizSessionData } from '../../../engines/training-visualization.engine';
import { getProgramById, getProgramsByGoal, FULL_PROGRAM_LIBRARY } from '../../../engines/complete-program-library.engine';
import { getExerciseBio } from '../../../data/exercise-biomechanics-db';
import { getStrengthLevel, getNextLevelTarget } from '../../../engines/performance-analytics.engine';
import { computeStructuredAnalytics } from '../../../engines/structured-analytics.engine';
import {
  GOALS, LEVELS, MUSCLE_GROUPS, GROUP_LABELS, EQUIP_LABELS, JOINT_LABELS,
  PHASE_LABELS, PHASE_HINTS, TAB_LABELS,
  type TrainingTab, type TrainingPage,
} from './shared';
import { applyToPlanner } from './planner-bridge';


export const MyTrainingTab: React.FC<{ customExercises: { name: string; sets: number; reps: number; rir: number }[]; setCustomExercises: React.Dispatch<React.SetStateAction<{ name: string; sets: number; reps: number; rir: number }[]>>; goal?: string; level?: string; daysPerWeek?: number; mesoLength?: number; onLoadToConstructor?: (plan: { name: string; exercises: { name: string; sets: number; reps: number; rir: number }[] }) => void }> = ({ customExercises, setCustomExercises, goal = 'bulk', level = 'intermediate', daysPerWeek = 4, mesoLength = 6, onLoadToConstructor }) => {
  const [newExName, setNewExName] = useState('');
  const [newExSets, setNewExSets] = useState(3);
  const [newExReps, setNewExReps] = useState(10);
  const [newExRir, setNewExRir] = useState(2);
  const [savedPlans, setSavedPlans] = useState<{ id: string; name: string; date: string; exercises: { name: string; sets: number; reps: number; rir: number }[] }[]>(() => { try { const v = JSON.parse(localStorage.getItem('myTrainingPlans') || '[]'); return (Array.isArray(v) ? v : []).filter((p: any) => p && typeof p === 'object' && typeof p.id === 'string' && Array.isArray(p.exercises)); } catch { return []; } });
  const [planName, setPlanName] = useState('');
  const [savedCycles, setSavedCycles] = useState<{ id: string; name: string; date: string; weeks: number; goal: string; level: string; days: number }[]>(() => { try { return JSON.parse(localStorage.getItem('myTrainingCycles') || '[]'); } catch { return []; } });
  const [cycleName, setCycleName] = useState('');
  const [subTab, setSubTab] = useState<'exercises'|'plans'|'cycles'|'progress'>('exercises');

  const [progressData, setProgressData] = useState<any>(null);
  useEffect(() => {
    if (subTab !== 'progress') return;
    (async () => {
      try {
        const d = new StrengthDiary();
        const logs = await d.getWorkoutLogs();
        if (!logs || logs.length === 0) { setProgressData({ noData: true }); return; }
        const sorted = [...logs].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        const e1rmByExercise: Record<string, { date: string; e1rm: number }[]> = {};
        const tonnageByWeek: Record<string, number> = {};
        let totalTonnageAll = 0;
        for (const log of sorted) {
          for (const ex of (log as any).exercises || []) {
            const e = ex.exercise || ex.name || '';
            const weight = parseFloat(ex.bestWeight || ex.weight || 0) || 0;
            const reps = parseInt(ex.bestReps || ex.reps || 10) || 10;
            if (e && weight > 0) {
              const e1rm = Math.round(weight / (1 - reps / 30));
              if (!e1rmByExercise[e]) e1rmByExercise[e] = [];
              e1rmByExercise[e].push({ date: log.date, e1rm });
            }
          }
          const dt = (log.date || '').slice(0, 10);
          const wk = dt.slice(0, 7) + '-W' + Math.ceil(parseInt(dt.slice(8, 10)) / 7);
          const vol = ((log as any).exercises || []).reduce((s: number, ex: any) => s + (ex.totalVolume || 0), 0);
          tonnageByWeek[wk] = (tonnageByWeek[wk] || 0) + vol;
          totalTonnageAll += vol;
        }
        const topExercises = Object.entries(e1rmByExercise)
          .map(([ex, data]) => ({ exercise: ex, count: data.length, best: Math.max(...data.map(d => d.e1rm)), history: data.slice(-12) }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 3);
        const weeks = Object.entries(tonnageByWeek).sort().slice(-8);
        setProgressData({ topExercises, weeks, total: sorted.length, totalTonnageAll });
      } catch { setProgressData({ noData: true }); }
    })();
  }, [subTab]);

  const addExercise = () => {
    if (!newExName.trim()) return;
    setCustomExercises(prev => [...prev, { name: newExName.trim(), sets: newExSets, reps: newExReps, rir: newExRir }]);
    setNewExName('');
    showToast('Упражнение «' + newExName.trim() + '» добавлено в текущий список', 'ok');
  };

  /** Всплывающее уведомление: что/куда сохранилось или загрузилось. */
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  };

  const savePlan = () => {
    if (customExercises.length === 0) { showToast('Список упражнений пуст — добавьте хотя бы одно', 'err'); return; }
    const plan = { id: 'plan_' + Date.now(), name: planName || 'План ' + new Date().toLocaleDateString('ru'), date: new Date().toISOString(), exercises: [...customExercises] };
    const updated = [...savedPlans, plan];
    setSavedPlans(updated);
    try { localStorage.setItem('myTrainingPlans', JSON.stringify(updated)); } catch { showToast('Не удалось сохранить: хранилище переполнено', 'err'); return; }
    setPlanName('');
    showToast('План «' + plan.name + '» (' + plan.exercises.length + ' упр.) сохранён во вкладке «Планы»', 'ok');
  };

  const deletePlan = (id: string) => {
    const updated = savedPlans.filter(p => p.id !== id);
    setSavedPlans(updated);
    try { localStorage.setItem('myTrainingPlans', JSON.stringify(updated)); } catch { showToast('Не удалось удалить: хранилище переполнено', 'err'); return; }
    showToast('План удалён из «Мои тренировки»', 'ok');
  };

  const loadPlan = (plan: { name?: string; exercises: { name: string; sets: number; reps: number; rir: number }[] }) => {
    setCustomExercises(plan.exercises);
    showToast('План «' + (plan.name || '—') + '» загружен: ' + plan.exercises.length + ' упр. в список (вкладка «Упражнения»)', 'ok');
  };

  const saveCycle = () => {
    const cycle = { id: 'cycle_' + Date.now(), name: cycleName || 'Цикл ' + new Date().toLocaleDateString('ru'), date: new Date().toISOString(), weeks: mesoLength, goal, level, days: daysPerWeek };
    const updated = [...savedCycles, cycle];
    setSavedCycles(updated);
    try { localStorage.setItem('myTrainingCycles', JSON.stringify(updated)); } catch { showToast('Не удалось сохранить: хранилище переполнено', 'err'); return; }
    setCycleName('');
    showToast('Цикл «' + cycle.name + '» (' + cycle.weeks + ' нед) сохранён во вкладке «Циклы»', 'ok');
  };

  const deleteCycle = (id: string) => {
    const updated = savedCycles.filter(c => c.id !== id);
    setSavedCycles(updated);
    try { localStorage.setItem('myTrainingCycles', JSON.stringify(updated)); } catch { showToast('Не удалось удалить: хранилище переполнено', 'err'); return; }
    showToast('Цикл удалён из «Мои тренировки»', 'ok');
  };

  const groupOptions = [...new Set(EXERCISE_DB.map(e => e.group || '').filter(Boolean))].sort();

  return (
    <div>
      <div style={{fontSize:14,fontWeight:700,color:'#00e68a',marginBottom:4}}>⭐ Моя тренировка</div>
      <div style={{fontSize:11,color:'#fff',marginBottom:8}}>Пользовательские упражнения, планы и циклы</div>

      <div style={{display:'flex',gap:4,marginBottom:8,flexWrap:'wrap'}}>
        {(['exercises','plans','cycles','progress'] as const).map(t => (
          <button key={t} onClick={()=>setSubTab(t)} style={{padding:'6px 12px',borderRadius:8,fontSize:11,fontWeight:600,cursor:'pointer',background:subTab===t?'#00e68a':'rgba(24,24,27,0.55)',color:subTab===t?'#000':'#fff',border:subTab===t?'1px solid #00e68a':'1px solid rgba(255,255,255,0.06)'}}>
            {t==='exercises'?'🏋️ Упражнения':t==='plans'?'📋 Планы':t==='cycles'?'🔄 Циклы':'📊 Прогресс'}
          </button>
        ))}
      </div>

      {subTab === 'exercises' ? (
        <div>
          <div className="card" style={{padding:10,marginBottom:8}}>
            <h4 style={{margin:'0 0 6px',fontSize:12}}>➕ Добавить упражнение</h4>
            <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr',gap:4,marginBottom:4}}>
              <div style={{fontSize:11,color:'#fff',paddingLeft:2}}>Упражнение</div>
              <div style={{fontSize:11,color:'#fff',paddingLeft:2}}>Сеты</div>
              <div style={{fontSize:11,color:'#fff',paddingLeft:2}}>Повторы</div>
              <div style={{fontSize:11,color:'#fff',paddingLeft:2}}>RIR</div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr',gap:4,marginBottom:6}}>
              <input value={newExName} onChange={e=>setNewExName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addExercise()} placeholder="Название упражнения" style={{padding:'6px 8px',borderRadius:8,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(24,24,27,0.55)',color:'#fff',fontSize:11,boxSizing:'border-box'}} />
              <input type="number" min="1" max="10" value={newExSets} onChange={e=>setNewExSets(parseFloat(e.target.value) || 0)} placeholder="Напр. 3" style={{padding:'6px 8px',borderRadius:8,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(24,24,27,0.55)',color:'#fff',fontSize:11,boxSizing:'border-box',textAlign:'center'}} />
              <input type="number" min="1" max="30" value={newExReps} onChange={e=>setNewExReps(parseFloat(e.target.value) || 0)} placeholder="Напр. 10" style={{padding:'6px 8px',borderRadius:8,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(24,24,27,0.55)',color:'#fff',fontSize:11,boxSizing:'border-box',textAlign:'center'}} />
              <input type="number" min="0" max="4" value={newExRir} onChange={e=>setNewExRir(parseFloat(e.target.value) || 0)} placeholder="0-4" style={{padding:'6px 8px',borderRadius:8,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(24,24,27,0.55)',color:'#fff',fontSize:11,boxSizing:'border-box',textAlign:'center'}} />
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:3,marginBottom:6}}>
              <span style={{fontSize:11,color:'#fff',padding:'2px 4px',alignSelf:'center'}}>Категория:</span>
              {groupOptions.slice(0,12).map(g=><button key={g} onClick={()=>setNewExName(g+' → ')} style={{padding:'2px 6px',borderRadius:8,fontSize:11,cursor:'pointer',background:'rgba(24,24,27,0.55)',border:'1px solid rgba(255,255,255,0.06)',color:'#fff'}}>{GROUP_LABELS[g] || g}</button>)}
            </div>
            <button onClick={addExercise} style={{width:'100%',padding:6,borderRadius:8,border:'none',cursor:'pointer',background:'#00e68a',color:'#000',fontWeight:600,fontSize:11}}>Добавить</button>
          </div>

          {customExercises.length > 0 ? (
            <div className="card" style={{padding:10,marginBottom:8}}>
              <h4 style={{margin:'0 0 6px',fontSize:12}}>📝 Мои упражнения ({customExercises.length})</h4>
              <div style={{display:'flex',flexDirection:'column',gap:4}}>
                {customExercises.map((ex,i) => (
                  <div key={i} style={{display:'flex',alignItems:'center',gap:6,padding:'4px 8px',borderRadius:8,background:'rgba(24,24,27,0.55)',border:'1px solid rgba(255,255,255,0.06)'}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:11,fontWeight:600,color:'#fff'}}>{ex.name}</div>
                      <div style={{fontSize:11,color:'#fff'}}>{ex.sets}×{ex.reps} @ RIR {ex.rir}</div>
                    </div>
                    <button onClick={()=>setCustomExercises(prev=>prev.filter((_,j)=>j!==i))} style={{padding:'2px 6px',borderRadius:8,border:'1px solid rgba(239,68,68,0.2)',background:'rgba(239,68,68,0.08)',color:'#f87171',fontSize:11,cursor:'pointer'}}>✕</button>
                  </div>
                ))}
              </div>
              <div style={{display:'flex',gap:4,marginTop:6}}>
                <input value={planName} onChange={e=>setPlanName(e.target.value)} placeholder="Название плана..." style={{flex:1,padding:'6px 8px',borderRadius:8,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(24,24,27,0.55)',color:'#fff',fontSize:11,boxSizing:'border-box'}} />
                <button onClick={savePlan} style={{padding:'6px 12px',borderRadius:8,border:'none',cursor:'pointer',background:'#00e68a',color:'#000',fontWeight:600,fontSize:11}}>💾 Сохранить план</button>
                <button onClick={()=>setCustomExercises([])} style={{padding:'6px 12px',borderRadius:8,border:'1px solid rgba(239,68,68,0.2)',background:'rgba(239,68,68,0.08)',color:'#f87171',fontSize:11,cursor:'pointer'}}>Очистить</button>
              </div>
            </div>
          ) : null}
        </div>
      ) : subTab === 'plans' ? (
        <div>
          {savedPlans.length === 0 && <div className="card" style={{padding:20,textAlign:'center',color:'#fff',fontSize:11}}>Нет сохранённых планов</div>}
          {savedPlans.map(plan => (
            <div key={plan.id} className="card" style={{padding:10,marginBottom:6}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:'#fff'}}>{plan.name}</div>
                  <div style={{fontSize:11,color:'#fff'}}>{new Date(plan.date).toLocaleDateString('ru')} · {plan.exercises.length} упр.</div>
                </div>
                <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                  <button onClick={()=>loadPlan(plan)} style={{padding:'3px 8px',borderRadius:8,border:'1px solid rgba(0,230,138,0.2)',background:'rgba(0,230,138,0.08)',color:'#00e68a',fontSize:11,cursor:'pointer'}}>Загрузить</button>
                  <button onClick={()=>{ setCustomExercises(prev=>[...prev, ...plan.exercises]); showToast('Добавлено ' + plan.exercises.length + ' упр. к текущему списку', 'ok'); }} style={{padding:'3px 8px',borderRadius:8,border:'1px solid rgba(139,92,246,0.2)',background:'rgba(139,92,246,0.08)',color:'#8b5cf6',fontSize:11,cursor:'pointer'}}>➕ В мою</button>
                  <button onClick={() => {
                    const exs = Array.isArray((plan as any).exercises) ? (plan as any).exercises : (Array.isArray((plan as any).days) ? (plan as any).days.flatMap((d:any)=>d.exercises||[]) : []);
                    const data = exs.map((e:any) => ({ name: e.name, sets: e.sets || e.sets || 3, reps: e.reps || 10, rir: e.rir ?? 2 }));
                    applyToPlanner({ kind: 'split', label: plan.name, data });
                    if (onLoadToConstructor) { onLoadToConstructor({ name: plan.name, exercises: exs }); showToast('План «' + plan.name + '» (' + exs.length + ' упр.) загружен в конструктор', 'ok'); }
                    else showToast('План «' + plan.name + '» готов — откройте Планировщик (ББ/Ручной) и нажмите «Применить»', 'ok');
                  }} style={{padding:'3px 8px',borderRadius:8,border:'1px solid rgba(168,85,247,0.2)',background:'rgba(168,85,247,0.08)',color:'#a855f7',fontSize:11,cursor:'pointer',fontWeight:700}}>📥 В конструктор</button>
                  <button onClick={()=>deletePlan(plan.id)} style={{padding:'3px 8px',borderRadius:8,border:'1px solid rgba(239,68,68,0.2)',background:'rgba(239,68,68,0.08)',color:'#f87171',fontSize:11,cursor:'pointer'}}>Удалить</button>
                </div>
              </div>
              <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
                {plan.exercises.map((ex,i) => (
                  <span key={i} style={{fontSize:11,padding:'2px 6px',borderRadius:8,background:'rgba(0,230,138,0.06)',border:'1px solid rgba(0,230,138,0.12)',color:'#fff'}}>{ex.name} {ex.sets}×{ex.reps}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : subTab === 'cycles' ? (
        <div>
          <div className="card" style={{padding:10,marginBottom:8}}>
            <h4 style={{margin:'0 0 6px',fontSize:12}}>🔄 Новый цикл</h4>
            <div style={{display:'flex',gap:4,marginBottom:6}}>
              <input value={cycleName} onChange={e=>setCycleName(e.target.value)} placeholder="Название цикла..." style={{flex:1,padding:'6px 8px',borderRadius:8,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(24,24,27,0.55)',color:'#fff',fontSize:11,boxSizing:'border-box'}} />
              <button onClick={saveCycle} style={{padding:'6px 12px',borderRadius:8,border:'none',cursor:'pointer',background:'#00e68a',color:'#000',fontWeight:600,fontSize:11}}>💾 Сохранить</button>
            </div>
            <div style={{fontSize:11,color:'#fff'}}>Цикл создаётся на основе текущих настроек плана</div>
          </div>
          {savedCycles.length === 0 && <div className="card" style={{padding:20,textAlign:'center',color:'#fff',fontSize:11}}>Нет сохранённых циклов</div>}
          {savedCycles.map(cycle => (
            <div key={cycle.id} className="card" style={{padding:10,marginBottom:6}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:'#fff'}}>{cycle.name}</div>
                  <div style={{fontSize:11,color:'#fff'}}>{new Date(cycle.date).toLocaleDateString('ru')} · {cycle.weeks} нед · {cycle.days} д/н</div>
                </div>
                <button onClick={()=>deleteCycle(cycle.id)} style={{padding:'3px 8px',borderRadius:8,border:'1px solid rgba(239,68,68,0.2)',background:'rgba(239,68,68,0.08)',color:'#f87171',fontSize:11,cursor:'pointer'}}>Удалить</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div>
          <div style={{fontSize:12,fontWeight:700,color:'rgba(96,165,250,0.9)',marginBottom:6}}>📊 Прогресс из дневника</div>
          {!progressData || progressData.noData ? (
            <div className="card" style={{padding:20,textAlign:'center',color:'#fff',fontSize:11}}>
              Нет данных. Запишите тренировку во вкладке «Тренировка → Дневник», чтобы увидеть прогресс.
            </div>
          ) : (
            <>
              <div className="card" style={{padding:10,marginBottom:6}}>
                <div style={{fontSize:11,fontWeight:700,color:'#fff',marginBottom:4,textTransform:'uppercase'}}>Сводка</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  <div style={{padding:6,borderRadius:8,background:'rgba(24,24,27,0.55)',border:'1px solid rgba(255,255,255,0.06)'}}>
                    <div style={{fontSize:11,color:'#fff'}}>Тренировок</div>
                    <div style={{fontSize:14,fontWeight:700,color:'rgba(96,165,250,0.9)'}}>{progressData.total}</div>
                  </div>
                  <div style={{padding:6,borderRadius:8,background:'rgba(24,24,27,0.55)',border:'1px solid rgba(255,255,255,0.06)'}}>
                    <div style={{fontSize:11,color:'#fff'}}>Тоннаж</div>
                    <div style={{fontSize:14,fontWeight:700,color:'rgba(96,165,250,0.9)'}}>{Math.round(progressData.totalTonnageAll / 1000).toFixed(1)}k кг</div>
                  </div>
                </div>
              </div>

              <div className="card" style={{padding:10,marginBottom:6}}>
                <div style={{fontSize:11,fontWeight:700,color:'#fff',marginBottom:6,textTransform:'uppercase'}}>Топ-3 упражнения: расчётный 1ПМ</div>
                {progressData.topExercises.length === 0 ? (
                  <div style={{fontSize:11,color:'#fff'}}>Недостаточно данных</div>
                ) : (
                  progressData.topExercises.map((ex: any, i: number) => {
                    const max = Math.max(...ex.history.map((d: any) => d.e1rm));
                    const low = Math.min(...ex.history.map((d: any) => d.e1rm));
                    const spread = max - low;
                    const SHOWchied = ex.history.length > 1 ? Math.round(((max - ex.history[0].e1rm) / Math.max(1, ex.history[0].e1rm)) * 100) : 0;
                    return (
                      <div key={i} style={{marginBottom:6,padding:8,borderRadius:8,background:'rgba(24,24,27,0.55)',border:'1px solid rgba(255,255,255,0.04)'}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                          <div style={{fontSize:11,fontWeight:600,color:'#fff'}}>{i+1}. {ex.exercise}</div>
                          <div style={{fontSize:11,fontWeight:700,color:SHOWchied>0?'#00e68a':'#fff'}}>
                            {SHOWchied > 0 ? '+':''}{SHOWchied}% · лучший {ex.best}кг ({ex.count} тренировок)
                          </div>
                        </div>
                        <div style={{height:24,position:'relative',background:'rgba(255,255,255,0.03)',borderRadius:8,overflow:'hidden'}}>
                          <svg viewBox={`0 0 ${ex.history.length * 20} 24`} preserveAspectRatio="none" style={{width:'100%',height:'100%'}}>
                            {(() => {
                              if (ex.history.length < 2) return null;
                              const allVals = ex.history.map((d: any) => d.e1rm);
                              const maxV = Math.max(...allVals, 1);
                              const minV = Math.min(...allVals, 0);
                              const range = Math.max(maxV - minV, 1);
                              const pts = ex.history.map((d: any, idx: number) => {
                                const x = idx * 20 + 10;
                                const y = 22 - ((d.e1rm - minV) / range) * 18;
                                return `${x},${y}`;
                              }).join(' ');
                              return <polyline points={pts} fill="none" stroke="#22c55e" strokeWidth="1.5" />;
                            })()}
                          </svg>
                        </div>
                        {ex.history.length > 1 ? (
                          <div style={{fontSize:11,color:'#fff',marginTop:2,display:'flex',justifyContent:'space-between'}}>
                            <span>{ex.history[0].date.slice(5)}</span>
                            <span>Спред: {spread}кг</span>
                            <span>{ex.history[ex.history.length-1].date.slice(5)}</span>
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="card" style={{padding:10,marginBottom:6}}>
                <div style={{fontSize:11,fontWeight:700,color:'#fff',marginBottom:6,textTransform:'uppercase'}}>Тоннаж по неделям (8 нед)</div>
                {progressData.weeks.length === 0 ? (
                  <div style={{fontSize:11,color:'#fff'}}>Нет данных</div>
                ) : (
                  (() => {
                    const maxT = Math.max(...progressData.weeks.map((w: any) => w[1]), 1);
                    return (
                      <div style={{display:'flex',flexDirection:'column',gap:3}}>
                        {progressData.weeks.map((w: any, i: number) => (
                          <div key={i} style={{display:'flex',alignItems:'center',gap:4,fontSize:11,color:'#fff'}}>
                            <span style={{minWidth:72}}>{w[0]}</span>
                            <div style={{height:8,background:'rgba(96,165,250,0.3)',borderRadius:2,width:Math.round((w[1] / maxT) * 150)+'px',minWidth:4}}></div>
                            <span style={{minWidth:50}}>{Math.round(w[1]).toLocaleString()} кг</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Всплывающее уведомление: что и куда сохранено/загружено */}
      {toast && (
        <div role="status" style={{ position:'fixed', bottom: 84, left:'50%', transform:'translateX(-50%)', zIndex: 400, maxWidth:'92%', padding:'10px 16px', borderRadius: 12, fontSize: 12, fontWeight: 700, lineHeight: 1.4, color: '#fff', background: toast.type === 'ok' ? 'rgba(0,230,138,0.16)' : 'rgba(239,68,68,0.18)', border: '1px solid ' + (toast.type === 'ok' ? 'rgba(0,230,138,0.45)' : 'rgba(239,68,68,0.5)'), boxShadow:'0 6px 24px rgba(0,0,0,0.45)', backdropFilter:'blur(8px)' }}>
          {toast.type === 'ok' ? '✅ ' : '⚠️ '}{toast.msg}
        </div>
      )}
    </div>
  );
};
