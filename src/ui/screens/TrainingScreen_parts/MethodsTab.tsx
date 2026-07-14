import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { EXERCISE_CATALOG, getExercisesByGroup } from '../../../core/exercise-catalog';
import { calcTraining, calcExercisePrescription, EXERCISE_DB, TRAINING_SPLITS, TRAINING_LEVEL_CONFIGS, LEVEL_VOLUMES } from '../../../engines/training.engine';
import { generateMacrocycle, generateBlockPlan, getCurrentWeekPlan, BLOCK_SEQUENCES, type MacrocyclePlan, type Microcycle, type MacrocycleInput } from '../../../engines/training-periodization.engine';
import { selectSplit, getSplitOptions, type SplitCandidate } from '../../../engines/split-selector.engine';
import { selectProgressionRule } from '../../../engines/progression.engine';
import { RIR_MATRIX, generateWeeklyPlan } from '../../../engines/rir-matrix.engine';
import { StrengthDiary, type StrengthStats, type WeeklyProgress, type ProgressionAlert } from '../../../engines/strength-diary.engine';
import type { WorkoutLog } from '../../../core/types';
import { generateWarmup } from '../../../engines/warmup.engine';
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
import { generateWeeklyReport, analyzeMeasurements, loadMeasurements, saveMeasurement, type BodyMeasurement } from '../../../engines/log-analytics-progression.engine';
import { getExerciseBio } from '../../../data/exercise-biomechanics-db';
import { getStrengthLevel, getNextLevelTarget } from '../../../engines/performance-analytics.engine';
import { computeStructuredAnalytics } from '../../../engines/structured-analytics.engine';
import { TaperPlannerTab } from './TaperPlannerTab';
import { PopupSelect } from '../SRCBBScreen_parts/TrainingPopups';
import {
  WARMUP_LABELS, GOALS, LEVELS, MUSCLE_GROUPS, GROUP_LABELS, EQUIP_LABELS, JOINT_LABELS,
  PHASE_LABELS, PHASE_HINTS, TAB_LABELS,
  type TrainingTab, type TrainingPage,
} from './shared';


export const MethodsTab: React.FC<{ linked: ReturnType<typeof useDataLink>; trainingOutput: TrainingOutput | null; diaryStats: StrengthStats[]; historyWorkouts: WorkoutLog[]; goal: string; level: string; daysPerWeek: number; recovery: number; fatigue: number; appliedMethods: Record<string, string>; onToggleMethod: (name: string, category: string) => void; onApplyComposition: () => void }> = ({ linked, trainingOutput, diaryStats, historyWorkouts, goal, level, daysPerWeek, recovery, fatigue, appliedMethods, onToggleMethod, onApplyComposition }) => {
  const methods = React.useMemo(() => getTrainingMethods(), []);
  const volumes = React.useMemo(() => getVolumeReferences(), []);
  const visuals = React.useMemo(() => getSplitVisuals(), []);

  const CAT_LABELS: Record<string, string> = {
    periodization: 'Периодизация', progression: 'Прогрессия', technique: 'Техника',
    intensity: 'Интенсивность', volume: 'Объём', frequency: 'Частота',
    specialization: 'Специализация', recovery: 'Восстановление', mobility: 'Мобильность',
    mindset: 'Психология',
  };
  const cats = [...new Set(methods.map(m => m.category))];
  const methodCatOptions = [
    { id: 'all', label: 'Все категории' },
    ...cats.map(c => ({ id: c, label: CAT_LABELS[c] || c })),
  ];
  const volLevelOptions = [
    { id: 'beginner', label: 'Новичок' },
    { id: 'intermediate', label: 'Средний' },
    { id: 'advanced', label: 'Продвинутый' },
  ];
  const [methodCat, setMethodCat] = React.useState('all');
  const [analysisLoaded, setAnalysisLoaded] = React.useState(false);
  const [volLevel, setVolLevel] = React.useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');
  const [expandedSplit, setExpandedSplit] = React.useState<number | null>(null);
  const filtered = methodCat === 'all' ? methods : getMethodsByCategory(methodCat);

  // ── Derived analytics from real data ──
  const realVolumes = React.useMemo(() => {
    if (!analysisLoaded || historyWorkouts.length === 0) return null;
    const groupVol: Record<string, { sets: number; totalReps: number; totalWeight: number }> = {};
    const recent = historyWorkouts.slice(-14);
    for (const w of recent) {
      for (const ex of w.exercises || []) {
        const exCat = EXERCISE_CATALOG.find(e => e.id === ex.exerciseId || e.name === (ex as any).name);
        const group = exCat?.group || (ex as any).group || 'other';
        if (!groupVol[group]) groupVol[group] = { sets: 0, totalReps: 0, totalWeight: 0 };
        const sets = ex.sets || [];
        groupVol[group].sets += sets.length;
        for (const s of sets) {
          groupVol[group].totalReps += s.reps || 0;
          groupVol[group].totalWeight += (s.weight || 0) * (s.reps || 0);
        }
      }
    }
    const weeks = Math.max(1, recent.length / daysPerWeek);
    const result: Record<string, { weeklySets: number; weeklyVolume: number; avgReps: number }> = {};
    for (const [g, v] of Object.entries(groupVol)) {
      result[g] = {
        weeklySets: Math.round(v.sets / weeks),
        weeklyVolume: Math.round(v.totalWeight / weeks),
        avgReps: v.sets > 0 ? Math.round(v.totalReps / v.sets) : 0,
      };
    }
    return result;
  }, [analysisLoaded, historyWorkouts, daysPerWeek]);

  // ── Progression status ──
  const progressionStatus = React.useMemo(() => {
    if (!analysisLoaded || historyWorkouts.length < 4) return null;
    const exVolumes: Record<string, { weeks: { sets: number; volume: number }[] }> = {};
    // Group by exercise name across weeks
    const sorted = [...historyWorkouts].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    for (const w of sorted) {
      const weekStr = w.date?.slice(0, 7) || '';
      for (const ex of w.exercises || []) {
        const name = (ex as any).name || ex.exerciseId || 'unknown';
        if (!exVolumes[name]) exVolumes[name] = { weeks: [] };
        const totalVol = (ex.sets || []).reduce((s, st) => s + (st.weight || 0) * (st.reps || 0), 0);
        const setCount = (ex.sets || []).length;
        const lastWk = exVolumes[name].weeks[exVolumes[name].weeks.length - 1];
        if (lastWk && lastWk.sets > 0) {
          lastWk.sets += setCount;
          lastWk.volume += totalVol;
        } else {
          exVolumes[name].weeks.push({ sets: setCount, volume: totalVol });
        }
      }
    }
    const trends: { name: string; trend: number; status: string }[] = [];
    for (const [name, data] of Object.entries(exVolumes)) {
      if (data.weeks.length >= 2) {
        const first = data.weeks[0].volume;
        const last = data.weeks[data.weeks.length - 1].volume;
        const pct = first > 0 ? Math.round(((last - first) / first) * 100) : 0;
        trends.push({
          name,
          trend: pct,
          status: pct > 3 ? 'progressing' : pct > 0 ? 'slow' : 'plateaued',
        });
      }
    }
    return trends.slice(0, 10);
  }, [analysisLoaded, historyWorkouts]);

  // ── Dynamic method recommendations ──
  const recommendations = React.useMemo(() => {
    const recs: { method: TrainingMethod; reason: string }[] = [];
    const isPlateaued = progressionStatus?.some(p => p.status === 'plateaued') ?? false;
    const isSlow = progressionStatus?.some(p => p.status === 'slow') ?? false;

    if (goal === 'bulk' && (isPlateaued || isSlow)) {
      recs.push({ method: methods.find(m => m.name.includes('Drop Set')) || methods.find(m => m.name.includes('Rest-Pause'))!, reason: 'Плато в наборе массы — интенсификация для нового стимула' });
      recs.push({ method: methods.find(m => m.name.includes('Rest-Pause')) || methods.find(m => m.name.includes('Cluster'))!, reason: 'Увеличение эффективных повторений близко к отказу' });
    }
    if (goal === 'strength' && (isPlateaued || isSlow)) {
      recs.push({ method: methods.find(m => m.name.includes('Cluster')) || methods.find(m => m.name.includes('Heavy'))!, reason: 'Плато в силе — кластерные подходы с околомаксимальным весом' });
      recs.push({ method: methods.find(m => m.name.includes('DUP')) || methods.find(m => m.name.includes('Undulating'))!, reason: 'Вариативность стимула для преодоления силового плато' });
    }
    if (goal === 'cut') {
      recs.push({ method: methods.find(m => m.name.includes('Myo-Rep')) || methods.find(m => m.name.includes('Density'))!, reason: 'Экономия времени + поддержание объёма на сушке' });
      recs.push({ method: methods.find(m => m.name.includes('Density')) || methods.find(m => m.name.includes('EMOM'))!, reason: 'Сохранение плотности тренировки при снижении калорий' });
    }
    if (goal === 'recomp' || goal === 'maintenance') {
      recs.push({ method: methods.find(m => m.name.includes('DUP')) || methods.find(m => m.name.includes('Block'))!, reason: 'Одновременное развитие силы и гипертрофии' });
    }
    if (level === 'beginner') {
      recs.push({ method: methods.find(m => m.name.includes('Linear Periodization')) || methods.find(m => m.name.includes('Progressive Overload'))!, reason: 'Линейный прогресс оптимален для новичков' });
    }
    return recs.filter((r, i, a) => a.findIndex(x => x.method?.name === r.method?.name) === i).slice(0, 5);
  }, [goal, level, progressionStatus, methods]);

  // ── Intensity distribution from history ──
  const intensityDist = React.useMemo(() => {
    if (!analysisLoaded || historyWorkouts.length === 0) return null;
    let lowRIR = 0, midRIR = 0, highRIR = 0;
    const recent = historyWorkouts.slice(-14);
    for (const w of recent) {
      for (const ex of w.exercises || []) {
        for (const s of ex.sets || []) {
          const rir = s.rir ?? (s.rpe != null ? (10 - s.rpe) : 3);
          if (rir <= 1) lowRIR++;
          else if (rir <= 3) midRIR++;
          else highRIR++;
        }
      }
    }
    const total = lowRIR + midRIR + highRIR || 1;
    return { low: Math.round((lowRIR / total) * 100), mid: Math.round((midRIR / total) * 100), high: Math.round((highRIR / total) * 100) };
  }, [analysisLoaded, historyWorkouts]);

  // ── Frequency analysis ──
  const frequencyAnalysis = React.useMemo(() => {
    if (!analysisLoaded || historyWorkouts.length === 0) return null;
    const groupDays: Record<string, Set<string>> = {};
    const recent = historyWorkouts.slice(-14);
    for (const w of recent) {
      for (const ex of w.exercises || []) {
        const exCat = EXERCISE_CATALOG.find(e => e.id === ex.exerciseId || e.name === (ex as any).name);
        const group = exCat?.group || (ex as any).group || 'other';
        if (!groupDays[group]) groupDays[group] = new Set();
        groupDays[group].add(w.date?.slice(0, 10) || '');
      }
    }
    const weeks = Math.max(1, recent.length / Math.max(1, daysPerWeek));
    return Object.fromEntries(Object.entries(groupDays).map(([g, d]) => [g, Math.round((d.size / weeks) * 10) / 10]));
  }, [analysisLoaded, historyWorkouts, daysPerWeek]);

  const readiness = linked.readiness;
  const groupLabelMap: Record<string, string> = {
    chest: 'Грудь', back: 'Спина', legs: 'Ноги', shoulders: 'Плечи', arms: 'Руки', core: 'Кор',
    quadriceps: 'Квадрицепсы', hamstrings: 'Бицепс бедра', glutes: 'Ягодичные', calves: 'Икры',
    biceps: 'Бицепс', triceps: 'Трицепс', lats: 'Широчайшие', traps: 'Трапеции',
    abs: 'Пресс', lower_back: 'Поясница', forearms: 'Предплечья', neck: 'Шея',
  };

  return (<div>
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, padding:"8px 10px", marginBottom:8, borderRadius:10, background:"rgba(0,230,138,0.08)", border:"1px solid rgba(0,230,138,0.2)" }}>
      <div style={{ fontSize:11, color:"#fff" }}>🧩 Композиция методик: <b style={{ color:"var(--accent)" }}>{Object.keys(appliedMethods).length}</b> из {cats.length} категорий {Object.keys(appliedMethods).length>0 ? "(по одной из каждой)" : ""}</div>
      <button onClick={() => onApplyComposition()} disabled={Object.keys(appliedMethods).length===0} style={{ padding:"8px 14px", borderRadius:8, fontSize:11, fontWeight:700, cursor:"pointer", border:"none", background: Object.keys(appliedMethods).length>0 ? "var(--accent)" : "rgba(255,255,255,0.1)", color: Object.keys(appliedMethods).length>0 ? "#000" : "var(--text-dim)", opacity: Object.keys(appliedMethods).length===0?0.5:1 }}>Применить к плану ▶</button>
    </div>
    {Object.keys(appliedMethods).length > 0 && (
      <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:8 }}>
        {Object.entries(appliedMethods).map(([c, n]) => <span key={c} onClick={() => onToggleMethod(n, c)} style={{ fontSize:10, padding:"3px 8px", borderRadius:10, cursor:"pointer", background:"rgba(0,230,138,0.12)", border:"1px solid rgba(0,230,138,0.3)", color:"#00e68a" }}>{({ periodization:'Периодизация', progression:'Прогрессия', technique:'Техника', intensity:'Интенсивность', volume:'Объём', frequency:'Частота', specialization:'Специализация', recovery:'Восстановление', mobility:'Мобильность', mindset:'Психология' } as Record<string,string>)[c] || c}: {n} ✕</span>)}
      </div>
    )}
    {/* ── Data Analysis Trigger ── */}
    <button
      onClick={() => setAnalysisLoaded(true)}
      style={{
        width: '100%', padding: '10px 14px', borderRadius: 10, marginBottom: 10,
        background: analysisLoaded ? 'rgba(0,230,138,0.08)' : 'linear-gradient(135deg, #3b82f6, #6366f1)',
        border: analysisLoaded ? '1px solid rgba(0,230,138,0.2)' : 'none',
        color: analysisLoaded ? '#00e68a' : '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer',
        transition: 'all 0.25s',
      }}
    >
      {analysisLoaded ? '✅ Данные загружены' : '📊 Использовать мои данные'}
    </button>

    {/* ── Real Data Section (only when loaded) ── */}
    {analysisLoaded && (
      <>
        {/* Current Split + Training Status */}
        <div className="card" style={{ marginBottom: 8, padding: 10 }}>
          <h4 style={{ margin: '0 0 6px', fontSize: 12, color: '#8b5cf6' }}>🔍 Анализ ваших тренировок</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 10 }}>
            <div>
              <span style={{ color: 'var(--text-dim)' }}>Сплит: </span>
              <b>{trainingOutput?.splitName || 'Не определён'}</b>
            </div>
            <div>
              <span style={{ color: 'var(--text-dim)' }}>Дней/нед: </span>
              <b>{daysPerWeek}</b>
            </div>
            <div>
              <span style={{ color: 'var(--text-dim)' }}>Цель: </span>
              <b>{goal === 'bulk' ? 'Масса' : goal === 'cut' ? 'Сушка' : goal === 'strength' ? 'Сила' : goal}</b>
            </div>
            <div>
              <span style={{ color: 'var(--text-dim)' }}>Уровень: </span>
              <b>{level === 'beginner' ? 'Новичок' : level === 'intermediate' ? 'Средний' : level === 'advanced' ? 'Опытный' : 'Enhanced'}</b>
            </div>
            <div>
              <span style={{ color: 'var(--text-dim)' }}>Готовность: </span>
              <b style={{ color: Math.max(0, (readiness?.recovery || 50) - (readiness?.fatigue || 30)) > 30 ? '#22c55e' : '#f59e0b' }}>{Math.max(0, Math.round((readiness?.recovery || 50) - (readiness?.fatigue || 30)))}%</b>
            </div>
            <div>
              <span style={{ color: 'var(--text-dim)' }}>Тренировок: </span>
              <b>{historyWorkouts.length}</b>
            </div>
          </div>
        </div>

        {/* Volume vs Benchmarks */}
        {realVolumes && (
          <div className="card" style={{ marginBottom: 8, padding: 10 }}>
            <h4 style={{ margin: '0 0 6px', fontSize: 12 }}>📊 Объём vs MEV/MAV/MRV</h4>
            {Object.entries(realVolumes).slice(0, 8).map(([group, v]) => {
              const volRef = volumes.find(r => {
                const rLow = r.muscle.toLowerCase();
                const gLow = group.toLowerCase();
                return rLow.includes(gLow) || gLow.includes(rLow) || (groupLabelMap[group] && rLow.includes(groupLabelMap[group].toLowerCase()));
              });
              const lvl = level === 'beginner' ? 'beginner' : level === 'advanced' || level === 'enhanced' ? 'advanced' : 'intermediate';
              const ref = volRef?.[lvl];
              const mev = ref?.mev || 6;
              const mav = ref?.mav || 12;
              const mrv = ref?.mrv || 18;
              const pct = Math.min(100, (v.weeklySets / mrv) * 100);
              const barColor = v.weeklySets < mev ? '#ef4444' : v.weeklySets < mav ? '#f59e0b' : v.weeklySets <= mrv ? '#22c55e' : '#ef4444';
              return (
                <div key={group} style={{ marginBottom: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 1 }}>
                    <span style={{ fontWeight: 600 }}>{groupLabelMap[group] || group}</span>
                    <span style={{ color: barColor }}>
                      {v.weeklySets} подходов/нед (MEV:{mev} MAV:{mav} MRV:{mrv})
                    </span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 3, transition: 'width 0.3s' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Progression Status */}
        {progressionStatus && progressionStatus.length > 0 && (
          <div className="card" style={{ marginBottom: 8, padding: 10 }}>
            <h4 style={{ margin: '0 0 6px', fontSize: 12 }}>📈 Статус прогрессии</h4>
            {progressionStatus.map((p, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', borderBottom: i < progressionStatus.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', fontSize: 10 }}>
                <span style={{ color: 'var(--text-dim)' }}>{p.name}</span>
                <span style={{
                  fontWeight: 600,
                  color: p.status === 'progressing' ? '#22c55e' : p.status === 'slow' ? '#f59e0b' : '#ef4444',
                }}>
                  {p.status === 'progressing' ? '↑ Прогресс' : p.status === 'slow' ? '→ Медленно' : '— Плато'} ({p.trend > 0 ? '+' : ''}{p.trend}%)
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Intensity Distribution */}
        {intensityDist && (
          <div className="card" style={{ marginBottom: 8, padding: 10 }}>
            <h4 style={{ margin: '0 0 6px', fontSize: 12 }}>🎯 Распределение интенсивности (RIR)</h4>
            <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 4 }}>
              <div style={{ width: `${intensityDist.low}%`, background: '#ef4444' }} title="RIR 0-1" />
              <div style={{ width: `${intensityDist.mid}%`, background: '#f59e0b' }} title="RIR 2-3" />
              <div style={{ width: `${intensityDist.high}%`, background: '#22c55e' }} title="RIR 4+" />
            </div>
            <div style={{ display: 'flex', gap: 10, fontSize: 10, color: 'var(--text-dim)' }}>
              <span>🔴 RIR 0-1: {intensityDist.low}%</span>
              <span>🟠 RIR 2-3: {intensityDist.mid}%</span>
              <span>🟢 RIR 4+: {intensityDist.high}%</span>
            </div>
          </div>
        )}

        {/* Frequency Analysis */}
        {frequencyAnalysis && (
          <div className="card" style={{ marginBottom: 8, padding: 10 }}>
            <h4 style={{ margin: '0 0 6px', fontSize: 12 }}>🔄 Частота тренировки групп</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {Object.entries(frequencyAnalysis).map(([g, f]) => (
                <span key={g} style={{
                  padding: '3px 8px', borderRadius: 12, fontSize: 10,
                  background: f >= 2 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                  color: f >= 2 ? '#22c55e' : '#ef4444',
                  border: `1px solid ${f >= 2 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                }}>
                  {groupLabelMap[g] || g}: {f}×/нед
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Recovery Status */}
        {readiness && (
          <div className="card" style={{ marginBottom: 8, padding: 10 }}>
            <h4 style={{ margin: '0 0 6px', fontSize: 12 }}>💤 Статус восстановления</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, fontSize: 10 }}>
              <div style={{ textAlign: 'center', padding: 6, borderRadius: 8, background: 'rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Усталость</div>
                <div style={{ fontWeight: 700, color: (readiness.fatigue || 30) > 50 ? '#ef4444' : '#22c55e' }}>{Math.round(readiness.fatigue || 30)}%</div>
              </div>
              <div style={{ textAlign: 'center', padding: 6, borderRadius: 8, background: 'rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Восстановление</div>
                <div style={{ fontWeight: 700, color: (readiness.recovery || 70) > 60 ? '#22c55e' : '#f59e0b' }}>{Math.round(readiness.recovery || 70)}%</div>
              </div>
              <div style={{ textAlign: 'center', padding: 6, borderRadius: 8, background: 'rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Готовность</div>
                <div style={{ fontWeight: 700, color: '#8b5cf6' }}>{Math.max(0, Math.round((readiness?.recovery || 50) - (readiness?.fatigue || 30)))}%</div>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Recommendations */}
        {recommendations.length > 0 && (
          <div className="card" style={{ marginBottom: 8, padding: 10, border: '1px solid rgba(139,92,246,0.2)' }}>
            <h4 style={{ margin: '0 0 6px', fontSize: 12, color: '#8b5cf6' }}>💡 Рекомендованные методики</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recommendations.map((r, i) => r.method && (
                <div key={i} style={{ padding: 8, borderRadius: 8, background: (appliedMethods[r.method!.category] === r.method!.name) ? 'rgba(0,230,138,0.1)' : 'rgba(139,92,246,0.06)', border: `1px solid ${(appliedMethods[r.method!.category] === r.method!.name) ? 'rgba(0,230,138,0.3)' : 'rgba(139,92,246,0.1)'}` }}>
                  <div style={{ fontWeight: 600, fontSize: 11, color: (appliedMethods[r.method!.category] === r.method!.name) ? '#00e68a' : '#8b5cf6' }}>
                    {(appliedMethods[r.method!.category] === r.method!.name) ? '✓ ' : ''}{r.method.name}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{r.reason}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{r.method.description}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
                    Протокол: {r.method.example} | Уровень доказательности: {r.method.evidenceLevel}
                  </div>
                  {(appliedMethods[r.method!.category] === r.method!.name) ? (
                    <div style={{ marginTop: 4, fontSize: 10, color: '#00e68a', fontWeight: 600 }}>✅ Применена к плану</div>
                  ) : (
                    <button onClick={() => onToggleMethod(r.method!.name, r.method!.category)} style={{ marginTop: 4, padding: '3px 8px', borderRadius: 4, fontSize: 10, background: 'var(--accent)', color: '#000', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Применить к плану</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </>
    )}

    {/* ── Method Reference Library (always visible) ── */}
    <h4 style={{ margin: '12px 0 8px', fontSize: 12, color: 'var(--accent)' }}>📚 Библиотека методик</h4>
    <div style={{ marginBottom: 8 }}>
      <PopupSelect label="Категория методики" value={methodCat} options={methodCatOptions} onChange={setMethodCat} />
    </div>
    {filtered.map((m,i) => <div key={i} className="card" style={{ marginBottom:6, padding:10, border: (appliedMethods[m.category] === m.name) ? '1px solid rgba(0,230,138,0.3)' : '1px solid var(--border)' }}>
      <div style={{ fontWeight:600, fontSize:12 }}>{(appliedMethods[m.category] === m.name) ? '✓ ' : ''}{m.name} <span style={{ fontSize:10, color:'var(--text-dim)' }}>[{({ periodization:'Периодизация', progression:'Прогрессия', technique:'Техника', intensity:'Интенсивность', volume:'Объём', frequency:'Частота', specialization:'Специализация', recovery:'Восстановление', mobility:'Мобильность', mindset:'Психология' } as Record<string,string>)[m.category] || m.category}]</span></div>
      <div style={{ fontSize:10, color:'var(--text-light)', marginTop:2 }}>{m.description}</div>
      <div style={{ fontSize:10, color:'var(--text-dim)' }}>Лучше всего для: {m.bestFor}</div>
      <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)' }}>Как работает: {m.howItWorks}</div>
      <div style={{ fontSize:10, color:'rgba(255,255,255,0.45)' }}>Протокол: {m.example}</div>
      <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)', marginTop:1 }}>Док-во: {m.evidenceLevel} | Авторы: {m.popularizedBy}</div>
      {m.caveats?.length > 0 && <div style={{ fontSize:10, color:'#f87171', marginTop:2, padding:'4px 6px', background:'rgba(239,68,68,0.06)', borderRadius:4 }}>⚠ {m.caveats.join(' | ')}</div>}
      {(appliedMethods[m.category] === m.name) ? (
        <div style={{ marginTop:4, fontSize:10, color:'#00e68a', fontWeight:600 }}>✅ Применена к плану</div>
      ) : (
        <button onClick={() => onToggleMethod(m.name, m.category)} style={{ marginTop:4, padding:'3px 8px', borderRadius:4, fontSize:10, background:'var(--accent)', color:'#000', border:'none', cursor:'pointer', fontWeight:600 }}>Применить к плану</button>
      )}
    </div>)}

    <h4 style={{ margin:'12px 0 8px', fontSize:12 }}>📊 Объёмные ориентиры (MEV / MAV / MRV)</h4>
    <div style={{ marginBottom: 8 }}>
      <PopupSelect label="Уровень для ориентиров" value={volLevel} options={volLevelOptions} onChange={(v) => setVolLevel(v as 'beginner' | 'intermediate' | 'advanced')} />
    </div>
    {volumes.map((v,i) => { const lvl = v[volLevel]; return <div key={i} className="card" style={{ marginBottom:4, padding:8 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
        <div style={{ fontWeight:700, fontSize:11, color:'#fff' }}>{v.muscle}</div>
        <div style={{ fontSize:10, color:'#00e68a', fontWeight:700 }}>MEV {lvl.mev} · MAV {lvl.mav} · MRV {lvl.mrv}</div>
      </div>
      <div style={{ display:'flex', gap:6, fontSize:10, color:'rgba(255,255,255,0.6)', marginTop:3 }}>
        <span>📡 {lvl.frequency}</span>
        <span style={{ flex:1 }}>
          <span style={{ display:'inline-block', width:100, height:5, background:'rgba(255,255,255,0.06)', borderRadius:3, verticalAlign:'middle', marginRight:4 }}>
            <span style={{ display:'inline-block', width:`${Math.min(100, (lvl.mav/(lvl.mrv||1))*100)}%`, height:5, background:'linear-gradient(90deg,#22c55e,#eab308,#ef4444)', borderRadius:3 }} />
          </span>
        </span>
      </div>
      <div style={{ fontSize:10, color:'var(--text-dim)', marginTop:3 }}>{v.notes}</div>
      <div style={{ fontSize:10, color:'rgba(0,230,138,0.7)', marginTop:2 }}>🏋️ {v.bestExercises.join(' · ')}</div>
    </div>; })}

    <h4 style={{ margin:'12px 0 8px', fontSize:12 }}>📐 Визуализация сплитов (нажмите для раскрытия)</h4>
    {visuals.map((s,i) => <div key={i} className="card" style={{ marginBottom:6, padding:8, cursor:'pointer', border: expandedSplit===i?'1px solid #00e68a':'1px solid rgba(255,255,255,0.06)' }} onClick={() => setExpandedSplit(expandedSplit===i?null:i)}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ fontWeight:700, fontSize:11, color: expandedSplit===i?'#00e68a':'#fff' }}>{s.name}</div>
        <span style={{ fontSize:10, color:'#00e68a' }}>{expandedSplit===i?'▲':'▼'}</span>
      </div>
      <div style={{ fontSize:10, color:'var(--text-dim)', marginTop:2 }}>📊 {s.totalVolume} · 🔁 {s.totalFrequency}</div>
      <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)', marginTop:1 }}>✅ Подходит: {s.suitability.join(', ')}</div>
      {expandedSplit===i && <div style={{ marginTop:8, borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:8 }}>
        {s.days.map((d,di) => <div key={di} style={{ background:'rgba(255,255,255,0.02)', borderRadius:6, padding:'6px 8px', marginBottom:4, borderLeft:'2px solid #00e68a' }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, fontWeight:700, color:'#fff' }}>
            <span>Д{d.day}: {d.name}</span>
            <span style={{ fontSize:10, color:'rgba(255,255,255,0.5)' }}>{d.volume} объём · {d.intensity} инт.</span>
          </div>
          <div style={{ fontSize:10, color:'rgba(0,230,138,0.8)', marginTop:2 }}>🎯 {d.focus}</div>
          <div style={{ fontSize:10, color:'rgba(255,255,255,0.55)', marginTop:2 }}>Шаблоны: {d.patterns.join(' · ')}</div>
        </div>)}
      </div>}
      </div>)}
    {(methodCat === 'all' || methodCat === 'periodization') && (
      <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#00e68a', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
          🏁 Taper-планер (снижение объёма к соревнованию)
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 10 }}>
          Полный инструмент: PL-taper (1-3 нед по усталости, прикиды, весовая категория, таймлайн, восстановление, ментал) + BB шоу-пик (углеводная загрузка, водная манипуляция).
          Кнопки «🛠 Применить к планировщику» связывают результат с вашим планом.
        </div>
        <div style={{ borderRadius: 12, background: 'rgba(24,24,27,0.3)', border: '1px solid rgba(0,230,138,0.08)', overflow: 'hidden' }}>
          <TaperPlannerTab />
        </div>
      </div>
    )}
  </div>);
};
