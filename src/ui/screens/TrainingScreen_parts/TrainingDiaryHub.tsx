import React, { useState, useMemo, useEffect } from 'react';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import { StrengthDiary, type StrengthStats, type WeeklyProgress } from '../../../engines/strength-diary.engine';
import type { WorkoutLog, StrengthLogEntry, TrainingOutput } from '../../../core/types';
import { computeAnalytics } from '../../../engines/analytics-engine';
import { weeklySetsByGroup } from '../../../engines/training-recommendations.engine';
import { LEVEL_VOLUMES } from '../../../engines/training.engine';
import type { MacrocyclePlan } from '../../../engines/training-periodization.engine';
import { generateWeeklyReport, analyzeMeasurements, loadMeasurements, saveMeasurement, type BodyMeasurement } from '../../../engines/log-analytics-progression.engine';
import { buildVisualDashboard, computeWeeklyChart, computeMuscleVolume, computeProgression, type VizSessionData } from '../../../engines/training-visualization.engine';
import { loadSRPESessions } from '../../../engines/pro/srpe-store';
import { acuteChronicRatio, toDailyLoads, weeklyMonotony } from '../../../engines/pro/training-load.engine';
import { loadReadinessHistory } from './readiness-history';
import { RIRCalibrationCard } from './RIRCalibrationCard';
import MesoCorrectionCard from './MesoCorrectionCard';
import { MuscleProgressCard } from './MuscleProgressCard';
import { VolumeTrendCard } from './VolumeTrendCard';
import { LoadRadarCard } from './LoadRadarCard';
import { WeekCompareCard } from './WeekCompareCard';
import { LiftHistoryCard } from './LiftHistoryCard';
import { AnalyticsTab } from './AnalyticsTab';
import { StructuredAnalyticsCard } from './StructuredAnalyticsCard';
import AllExercisesTrendCard from './AllExercisesTrendCard';
import StandardForecastCard from './StandardForecastCard';
import VolumeRecoveryCorrelationCard from './VolumeRecoveryCorrelationCard';
import StickingPointAnalysisCard from './StickingPointAnalysisCard';
import { TrainingRecommendationsCard } from './TrainingRecommendationsCard';
import { loadRirCalibrationStats } from '../../../engines/meso-correction.engine';
import { useDataLink } from '../../../core/data-link';

const ACCENT = '#00e68a';
const GRP_RU: Record<string, string> = { chest: 'Грудь', back: 'Спина', legs: 'Ноги', shoulders: 'Плечи', arms: 'Руки', core: 'Кор', hamstrings: 'Бицепс бедра', glutes: 'Ягодицы', calves: 'Икры', triceps: 'Трицепс', biceps: 'Бицепс', quads: 'Квадрицепсы' };
const GROUP_COLORS: Record<string, string> = { chest: '#00e68a', back: '#60a5fa', legs: '#f59e0b', shoulders: '#a855f7', arms: '#ef4444', core: '#22c55e' };
const FELT_LABELS = ['👎 Ужасно', '😟 Плохо', '😐 Нормально', '🙂 Хорошо', '😄 Отлично'];
const SP_LABELS: Record<string, string> = { fullbody: 'Фулбоди', upper_lower: 'Верх/Низ', push_pull: 'Жим/Тяга', ppl: 'PPL', bro: 'Сплит', legs_push_pull: 'Ноги/Жим/Тяга', custom: 'Свой' };

const style: Record<string, React.CSSProperties> = {
  card: { padding: 12, borderRadius: 14, background: 'rgba(24,24,27,0.12)', border: '1px solid rgba(255,255,255,0.04)', marginBottom: 8 },
  label: { fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 500, letterSpacing: '0.3px', textTransform: 'uppercase', marginBottom: 8 },
  input: { width: '100%', padding: '6px 4px', borderRadius: 6, background: '#18181b', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 11, boxSizing: 'border-box' as any },
  btn: { width: '100%', padding: 9, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,var(--accent),#00cc7a)', color: '#000', fontWeight: 700, fontSize: 12 },
};

interface TrainingDiaryHubProps {
  diary: StrengthDiary;
  diaryStats: StrengthStats[];
  diaryProgress: WeeklyProgress[];
  historyWorkouts: WorkoutLog[];
  macrocycle: MacrocyclePlan | null;
  selectedWeek: number;
  level: string;
  onRefresh: () => void;
  trainingOutput: TrainingOutput | null;
  goal: string;
  daysPerWeek: number;
  splitType: string;
  periodizationType: string;
  mesoLength: number;
  tprofile: any;
  linked: any;
}

type HubMode = 'diary' | 'history' | 'analytics' | 'progress' | 'visual' | 'reports';

export const TrainingDiaryHub: React.FC<TrainingDiaryHubProps> = ({
  diary, diaryStats, diaryProgress, historyWorkouts, macrocycle, selectedWeek, level, onRefresh,
  trainingOutput, goal, daysPerWeek, splitType, periodizationType, mesoLength, tprofile, linked,
}) => {
  const [mode, setMode] = useState<HubMode>('diary');
  const [search, setSearch] = useState('');
  const [historyExpanded, setHistoryExpanded] = useState<string | null>(null);
  const [hubAnalyticsExpanded, setHubAnalyticsExpanded] = useState(false);

  // Logging state
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [logDuration, setLogDuration] = useState(60);
  const [logRPE, setLogRPE] = useState(7);
  const [logRecovery, setLogRecovery] = useState(5);
  const [logFelt, setLogFelt] = useState(2);
  const [logNotes, setLogNotes] = useState('');
  const [logSplit, setLogSplit] = useState('fullbody');
  const [logExercises, setLogExercises] = useState<{ exerciseId: string; weight: number; reps: number; rir: number }[]>([]);
  const [exId, setExId] = useState('');
  const [exW, setExW] = useState(80);
  const [exR, setExR] = useState(10);
  const [exRI, setExRI] = useState(2);
  const [saved, setSaved] = useState(false);

  // Progress state
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [repData, setRepData] = useState<any>(null);
  const [mWeight, setMWeight] = useState(80);
  const [mWaist, setMWaist] = useState(85);
  const [mChest, setMChest] = useState(100);
  const [mArm, setMArm] = useState(38);
  const [mThigh, setMThigh] = useState(60);
  const [mDate, setMDate] = useState(new Date().toISOString().split('T')[0]);

  // Reports state
  const [trainingReportGenerated, setTrainingReportGenerated] = useState(false);
  const [trainingArchive, setTrainingArchive] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('he_training_reports') || '[]'); } catch { return []; }
  });

  useEffect(() => { setMeasurements(loadMeasurements()); try { if (localStorage.getItem('he_training_report_current')) setTrainingReportGenerated(true); } catch {} }, []);
  const measureAnalytics = useMemo(() => analyzeMeasurements(175), [measurements]);

  useEffect(() => {
    if (historyWorkouts.length > 0) {
      const logs: any[] = [];
      historyWorkouts.forEach((w: any) => (w.exercises || []).forEach((e: any) => {
        (e.sets || []).forEach((s: any) => logs.push({ date: w.date, exercise: e.exerciseName || e.exerciseId, weight: s.weight, reps: s.reps, rpe: 7 }));
      }));
      if (logs.length > 0) setRepData(generateWeeklyReport(logs, logs.map((l: any) => ({ date: l.date, durationMin: 60 }))));
    }
  }, [historyWorkouts]);

  const saveMeasurementHandler = () => {
    const updated = saveMeasurement({ date: mDate, weightKg: mWeight, waistCm: mWaist, chestCm: mChest, armCm: mArm, thighCm: mThigh, calfCm: 38, neckCm: 38, hipCm: 95, shoulderCm: 120, forearmCm: 32, wristCm: 18, ankleCm: 22, bodyFatPercent: 15 } as any);
    setMeasurements(updated);
  };

  const addExercise = () => {
    if (!exId) return;
    setLogExercises(prev => [...prev, { exerciseId: exId, weight: exW, reps: exR, rir: exRI }]);
    setExId('');
  };
  const removeExercise = (i: number) => setLogExercises(prev => prev.filter((_, idx) => idx !== i));

  const handleSaveWorkout = async () => {
    if (logExercises.length === 0) return;
    const wid = `workout_${Date.now()}`;
    const exList: StrengthLogEntry[] = logExercises.map((e, i) => {
      const cat = EXERCISE_CATALOG.find(x => x.id === e.exerciseId);
      return {
        id: `${wid}_${i}`, date: logDate, exerciseId: e.exerciseId,
        exerciseName: cat?.name || e.exerciseId,
        sets: [{ weight: e.weight, reps: e.reps, rir: e.rir }],
        totalVolume: e.weight * e.reps,
        estimated1RM: Math.round(e.weight * (1 + e.reps / 30)),
        isCompound: cat?.type === 'compound', weekNumber: selectedWeek,
      };
    });
    await diary.saveWorkoutLog({
      id: wid, date: logDate, duration: logDuration, exercises: exList,
      overallRPE: logRPE, recoveryBefore: logRecovery, split: logSplit,
      weekNumber: selectedWeek,
      notes: `Самочувствие: ${FELT_LABELS[logFelt]}${logNotes ? ' · ' + logNotes : ''}`,
    });
    for (const ex of exList) { await diary.saveStrengthLog(ex); }
    setSaved(true); setTimeout(() => setSaved(false), 2500);
    setLogExercises([]); setLogNotes(''); setLogDuration(60); setLogRPE(7);
    onRefresh();
  };

  // Analytics
  const analytics = useMemo(() => {
    if (historyWorkouts.length === 0) return null;
    try {
      const mapped = historyWorkouts.map(w => ({
        sessionId: w.id, date: w.date, focus: w.split || 'fullbody', durationMin: w.duration || 60,
        sets: (w.exercises || []).flatMap((ex: any) => (ex.sets || []).map((s: any, i: number) => ({
          exerciseId: ex.exerciseId || ex.name || 'unknown', exerciseName: ex.name || 'Exercise',
          reps: s.reps || 0, weight: s.weight || 0, rpe: s.rpe || 5, rir: s.rir || 3, date: w.date, setIndex: i,
        }))),
      }));
      if (!mapped.some(m => m.sets.length > 0)) return null;
      return computeAnalytics({ sessions: mapped, weeks: 4 });
    } catch { return null; }
  }, [historyWorkouts]);

  const wsg = useMemo(() => weeklySetsByGroup(historyWorkouts, 8), [historyWorkouts]);
  const groups = useMemo(() => Object.keys(wsg).sort((a, b) => (wsg[b]?.reduce((s: number, x: number) => s + x, 0) || 0) - (wsg[a]?.reduce((s: number, x: number) => s + x, 0) || 0)), [wsg]);
  const totals = useMemo(() => Array.from({ length: 8 }, (_, i) => groups.reduce((s, g) => s + (wsg[g]?.[i] || 0), 0)), [wsg, groups]);

  const groupedHistory = useMemo(() => {
    const map = new Map<string, WorkoutLog[]>();
    for (const w of historyWorkouts) {
      const week = w.weekNumber ? `Неделя ${w.weekNumber}` : w.date.slice(0, 7);
      if (!map.has(week)) map.set(week, []);
      map.get(week)!.push(w);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [historyWorkouts]);
  const filteredHistory = search ? groupedHistory.filter(([week]) => week.toLowerCase().includes(search.toLowerCase())) : groupedHistory;

  const curPhase = useMemo(() => {
    if (!macrocycle) return null;
    for (const m of macrocycle.mesocycles) {
      if (selectedWeek >= m.weekStart + 1 && selectedWeek <= m.weekStart + m.weeks) return m;
    }
    return null;
  }, [macrocycle, selectedWeek]);
  const PHASE_RU: Record<string, string> = { accumulation: 'Накопление', intensification: 'Интенсификация', peaking: 'Пик', deload: 'Разгрузка', recovery: 'Восстановление' };

  // Visual analytics
  const vizSessions: VizSessionData[] = useMemo(() => historyWorkouts.map((s: any) => ({
    week: s.weekNumber || 1, date: s.date || '',
    exercises: (s.exercises || []).map((e: any) => ({
      name: e.exerciseName || e.name || '', sets: e.sets?.length || 0,
      reps: Math.max(...(e.sets || [{ reps: 0 }]).map((st: any) => st.reps || 0), 0),
      weight: Math.max(...(e.sets || [{ weight: 0 }]).map((st: any) => st.weight || 0), 0),
      rpe: 7, volume: e.totalVolume || 0,
    })),
  })), [historyWorkouts]);
  const visDashboard = useMemo(() => { try { return historyWorkouts.length > 2 ? buildVisualDashboard(vizSessions) : null; } catch { return null; } }, [vizSessions]);
  const visWeekly = useMemo(() => { try { return computeWeeklyChart(vizSessions); } catch { return []; } }, [vizSessions]);
  const visMuscleVol = useMemo(() => { try { return computeMuscleVolume(vizSessions); } catch { return []; } }, [vizSessions]);
  const visProg = useMemo(() => { try { return computeProgression(vizSessions); } catch { return []; } }, [vizSessions]);

  // Expert analytics data
  const expertSrpe = useMemo(() => { try { return loadSRPESessions(); } catch { return []; } }, []);
  const expertAcwr = useMemo(() => expertSrpe.length >= 2 ? acuteChronicRatio(toDailyLoads(expertSrpe)).ratio : 1.0, [expertSrpe]);
  const expertMono = useMemo(() => { try { return expertSrpe.length >= 7 ? weeklyMonotony(toDailyLoads(expertSrpe)).monotony : 0; } catch { return 0; } }, [expertSrpe]);
  const expertExercises = useMemo(() => {
    const calcE1rm = (w: number, r: number) => r <= 1 ? w : w * (1 + Math.min(r, 30) / 30);
    const exMap = new Map<string, { first: number; last: number }>();
    for (const w of historyWorkouts) {
      const exs: any[] = (w as any).exercises || [];
      for (const ex of exs) {
        const nm = ex.name || ex.exerciseId || '?';
        if (!exMap.has(nm)) exMap.set(nm, { first: 0, last: 0 });
        const v = calcE1rm(ex.weight || 0, ex.reps || 5);
        const cur = exMap.get(nm)!;
        if (!cur.first || (v > 0 && v < cur.first)) cur.first = v;
        if (v > cur.last) cur.last = v;
      }
    }
    return Array.from(exMap.entries()).filter(([, v]) => v.first > 0 && v.last > 0).slice(0, 10)
      .map(([name, v]) => ({ name, e1rmBefore: Math.round(v.first), e1rmAfter: Math.round(v.last) }));
  }, [historyWorkouts]);
  const expertRecentVol = useMemo(() => historyWorkouts.slice(-14).reduce((s: number, w: any) => s + ((w.exercises || []).length), 0), [historyWorkouts]);
  const expertRirStats = useMemo(() => { try { return loadRirCalibrationStats(); } catch { return { bias: 0, stdDev: 1, sessions: 0 }; } }, []);

  const MODES: [HubMode, string][] = [
    ['diary', '📝 Запись'], ['history', '📜 История'], ['analytics', '📊 Аналитика'],
    ['progress', '📏 Прогресс'], ['visual', '📈 Визуализация'], ['reports', '📄 Отчёты'],
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Mode selector */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {MODES.map(([k, l]) => (
          <button key={k} onClick={() => setMode(k)} style={{
            padding: '6px 10px', borderRadius: 8, border: mode === k ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.06)',
            background: mode === k ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.02)',
            color: mode === k ? 'var(--accent)' : 'var(--text-dim)', fontWeight: mode === k ? 700 : 400, fontSize: 10, cursor: 'pointer',
          }}>{l}</button>
        ))}
      </div>

      {/* Program context header */}
      {macrocycle && curPhase && (
        <div style={{ ...style.card, border: '1px solid rgba(0,230,138,0.12)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Текущая программа</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{macrocycle.totalWeeks}-нед макроцикл</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>Фаза: <b>{PHASE_RU[curPhase.type] || curPhase.type}</b> · Нед {selectedWeek}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Сплит</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#60a5fa' }}>{historyWorkouts[0]?.split || '—'}</div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODE: DIARY ═══ */}
      {mode === 'diary' && (
        <div style={style.card}>
          <div style={style.label}>📝 Записать тренировку</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 6 }}>
            <div><label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Дата</label><input type="date" value={logDate} onChange={e => setLogDate(e.target.value)} style={style.input} /></div>
            <div><label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Длительность (мин)</label><input type="number" min={1} value={logDuration} onChange={e => setLogDuration(parseInt(e.target.value) || 0)} style={style.input} /></div>
            <div><label style={{ fontSize: 9, color: 'var(--text-dim)' }}>RPE (1-10)</label><input type="number" min={1} max={10} value={logRPE} onChange={e => setLogRPE(parseInt(e.target.value) || 5)} style={style.input} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 6 }}>
            <div><label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Восстановление (1-10)</label><input type="number" min={1} max={10} value={logRecovery} onChange={e => setLogRecovery(parseInt(e.target.value) || 5)} style={style.input} /></div>
            <div><label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Сплит</label>
              <select value={logSplit} onChange={e => setLogSplit(e.target.value)} style={style.input}>
                {Object.entries(SP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div><label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Самочувствие</label>
              <select value={logFelt} onChange={e => setLogFelt(parseInt(e.target.value))} style={style.input}>
                {FELT_LABELS.map((l, i) => <option key={i} value={i}>{l}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Заметки</label>
            <input type="text" value={logNotes} onChange={e => setLogNotes(e.target.value)} placeholder="Самочувствие, особенности, инвентарь..." style={style.input} />
          </div>
          <div style={style.label}>🏋️ Упражнения</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.5fr 0.5fr 0.5fr auto', gap: 4, marginBottom: 6, alignItems: 'end' }}>
            <div><label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Упражнение</label>
              <select value={exId} onChange={e => setExId(e.target.value)} style={style.input}><option value="">— Выбрать —</option>{EXERCISE_CATALOG.slice(0, 50).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
            </div>
            <div><label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Вес (кг)</label><input type="number" value={exW} onChange={e => setExW(parseFloat(e.target.value) || 0)} style={style.input} /></div>
            <div><label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Повт</label><input type="number" value={exR} onChange={e => setExR(parseInt(e.target.value) || 0)} style={style.input} /></div>
            <div><label style={{ fontSize: 9, color: 'var(--text-dim)' }}>RIR</label><input type="number" min={0} max={5} value={exRI} onChange={e => setExRI(parseInt(e.target.value) || 0)} style={style.input} /></div>
            <button onClick={addExercise} disabled={!exId} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--accent)', background: exId ? 'rgba(0,230,138,0.12)' : 'transparent', color: exId ? 'var(--accent)' : 'var(--text-dim)', cursor: exId ? 'pointer' : 'not-allowed', fontSize: 11, whiteSpace: 'nowrap' }}>+ Добавить</button>
          </div>
          {logExercises.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              {logExercises.map((e, i) => {
                const cat = EXERCISE_CATALOG.find((x: any) => x.id === e.exerciseId);
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.03)', marginBottom: 3, fontSize: 10 }}>
                    <span style={{ fontWeight: 600 }}>{cat?.name || e.exerciseId}</span>
                    <span style={{ color: 'var(--text-dim)' }}>{e.weight} кг × {e.reps} · RIR {e.rir}</span>
                    <button onClick={() => removeExercise(i)} style={{ padding: '2px 7px', borderRadius: 5, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer', fontSize: 10 }}>✕</button>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 10, color: 'var(--text-dim)' }}>
            <span>Всего: {logExercises.length} упр. · {logExercises.reduce((s, e) => s + e.weight * e.reps, 0)} кг·повт</span>
            {saved && <span style={{ color: 'var(--accent)', fontWeight: 700 }}>✅ Сохранено!</span>}
          </div>
          <button onClick={handleSaveWorkout} disabled={logExercises.length === 0} style={{ ...style.btn, opacity: logExercises.length === 0 ? 0.4 : 1 }}>💾 Сохранить тренировку</button>
        </div>
      )}

      {/* ═══ MODE: HISTORY ═══ */}
      {mode === 'history' && (
        <div>
          {diaryProgress.length > 0 && <TrainingRecommendationsCard
            historyWorkouts={historyWorkouts} level={level} weakPoints={tprofile.weakPoints}
            readinessHistory={(() => { try { return loadReadinessHistory(); } catch { return []; } })()}
            acwr={(() => { try { const _s = loadSRPESessions(); if (_s.length < 2) return undefined; return acuteChronicRatio(toDailyLoads(_s)).ratio; } catch { return undefined; } })()}
            nutrition={{ kcal: linked.avgWeeklyKcal, protein: linked.avgWeeklyProtein, fat: linked.avgWeeklyFat, carbs: linked.avgWeeklyCarbs }}
            bodyWeight={tprofile.bodyWeight}
            labAnalysis={linked.labAnalysis ? { liverStress: linked.labAnalysis.liverStress, cardioRisk: linked.labAnalysis.cardioRisk, inflammation: linked.labAnalysis.inflammation, kidneyStress: linked.labAnalysis.kidneyStress, hormoneScore: linked.labAnalysis.hormoneScore, homaIR: linked.labAnalysis.homaIR } : undefined}
            onCourse={tprofile.onCourse} courseIntensity={tprofile.courseIntensity} supportCoverage={linked.supportCoverage}
          />}
          <div style={style.card}>
            <div style={style.label}>📜 История тренировок</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              {[
                { label: 'Недель', value: diaryProgress.length, color: '#34d399' },
                { label: 'Тренировок', value: diaryProgress.reduce((s, w) => s + w.workoutCount, 0), color: '#60a5fa' },
                { label: 'Объём', value: diaryProgress.length > 0 ? `${(diaryProgress[diaryProgress.length - 1]?.totalVolume / 1000).toFixed(1)}т` : '—', color: '#f59e0b' },
                { label: 'ACWR', value: (() => { try { const s = loadSRPESessions(); if (s.length < 2) return '—'; return acuteChronicRatio(toDailyLoads(s)).ratio.toFixed(2); } catch { return '—'; } })(), color: '#22c55e' },
              ].map((s, i) => <div key={i} style={{ flex: 1, background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 4px', textAlign: 'center' }}>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)' }}>{s.label}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: s.color }}>{s.value}</div>
              </div>)}
            </div>
            {/* Heatmap */}
            {historyWorkouts.length > 0 && (() => {
              const byDay: Record<string, number> = {};
              historyWorkouts.forEach((w: any) => { byDay[w.date] = (byDay[w.date] || 0) + (w.exercises || []).reduce((s: number, e: any) => s + (e.totalVolume || 0), 0); });
              const cells: { date: string; vol: number }[] = [];
              const today = new Date();
              for (let i = 83; i >= 0; i--) { const d = new Date(today); d.setDate(d.getDate() - i); cells.push({ date: d.toISOString().slice(0, 10), vol: byDay[d.toISOString().slice(0, 10)] || 0 }); }
              const maxVol = Math.max(1, ...cells.map(c => c.vol));
              const col = (v: number) => v === 0 ? 'rgba(255,255,255,0.04)' : v < maxVol * 0.33 ? 'rgba(0,230,138,0.25)' : v < maxVol * 0.66 ? 'rgba(0,230,138,0.5)' : 'rgba(0,230,138,0.85)';
              const weeks: { date: string; vol: number }[][] = [];
              for (let w = 0; w < 12; w++) weeks.push(cells.slice(w * 7, w * 7 + 7));
              return (
                <div style={{ marginBottom: 8, padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: 6 }}>🔥 Тепловая карта тренировок (12 нед)</div>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {weeks.map((wk, wi) => (
                      <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
                        {wk.map((c, di) => <div key={di} title={c.date + (c.vol > 0 ? ': ' + Math.round(c.vol) + ' кг·повт' : '')} style={{ aspectRatio: '1', borderRadius: 3, background: col(c.vol) }} />)}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}><span>меньше</span><span>больше</span></div>
                </div>
              );
            })()}
            {/* MRV alerts */}
            {historyWorkouts.length > 0 && (() => {
              const lvlKey = (level === 'enhanced' ? 'advanced' : level) as 'beginner' | 'intermediate' | 'advanced';
              const mrvBase = (((LEVEL_VOLUMES as Record<string, { mrv: number }>)[level]?.mrv) ?? 20) * (tprofile.onCourse ? 1.2 : 1);
              const ws = (d0: Date) => { const x = new Date(d0); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); x.setHours(0, 0, 0, 0); return x; };
              const now = new Date();
              const wkSets = (weeksAgo: number) => { const s = ws(now); s.setDate(s.getDate() - weeksAgo * 7); const e = new Date(s); e.setDate(e.getDate() + 6); const ss = s.toISOString().slice(0, 10), ee = e.toISOString().slice(0, 10); const m: Record<string, number> = {}; historyWorkouts.forEach((w: any) => { if (w.date >= ss && w.date <= ee) (w.exercises || []).forEach((ex: any) => { const cat = EXERCISE_CATALOG.find((c: any) => c.id === ex.exerciseId); if (cat) m[cat.group] = (m[cat.group] || 0) + (ex.sets?.length || 0); }); }); return m; };
              const w1 = wkSets(1), w2 = wkSets(0);
              const groups2 = Array.from(new Set([...Object.keys(w1), ...Object.keys(w2)]));
              const over2 = groups2.filter(g => (w1[g] || 0) > mrvBase && (w2[g] || 0) > mrvBase);
              const over1 = groups2.filter(g => ((w1[g] || 0) > mrvBase || (w2[g] || 0) > mrvBase) && !over2.includes(g));
              if (over2.length === 0 && over1.length === 0) return null;
              const ru = (g: string) => GRP_RU[g] || g;
              const color = over2.length > 0 ? '#ef4444' : '#f59e0b';
              return (
                <div style={{ marginBottom: 8, padding: 10, borderRadius: 10, background: color + '12', border: '1px solid ' + color + '40' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color, marginBottom: 4 }}>{over2.length > 0 ? '🔴 Риск перетренированности' : '🟡 Превышение объёма'}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>
                    {over2.length > 0 ? `Группы выше MRV (${Math.round(mrvBase)} сетов) 2 недели подряд: ${over2.map(ru).join(', ')}. Снизьте объём на 10–15% в следующем микроцикле.` : `Группы выше MRV на прошлой/текущей неделе: ${over1.map(ru).join(', ')}. Следите за восстановлением.`}
                  </div>
                </div>
              );
            })()}
            {/* Volume chart */}
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 4 }}>📈 Тоннаж по неделям</div>
              <div style={{ display: 'flex', gap: 2, height: 50, alignItems: 'flex-end' }}>
                {diaryProgress.slice(-12).map((w, i) => {
                  const maxVol2 = Math.max(...diaryProgress.map(w2 => w2.totalVolume), 1);
                  const h = Math.max(4, (w.totalVolume / maxVol2) * 100);
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                      <div style={{ width: '70%', height: `${h}%`, background: w.totalVolume === maxVol2 ? 'var(--accent)' : 'rgba(0,230,138,0.3)', borderRadius: '2px 2px 0 0' }} />
                      <span style={{ fontSize: 6, color: 'var(--text-dim)' }}>{w.week}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          {/* Search + grouped history */}
          <div style={{ marginBottom: 6 }}><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Поиск по неделе..." style={style.input} /></div>
          {filteredHistory.map(([week, workouts]) => (
            <WorkoutWeekCard key={week} weekLabel={week} workouts={workouts} />
          ))}
          {filteredHistory.length === 0 && (
            <div style={{ ...style.card, textAlign: 'center', padding: 24 }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>📜</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{search ? 'Ничего не найдено' : 'Нет тренировок. Запишите первую во вкладке «Запись».'}</div>
            </div>
          )}
        </div>
      )}

      {/* ═══ MODE: ANALYTICS ═══ */}
      {mode === 'analytics' && (
        <div>
          {analytics ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
                <div style={style.card}>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Объём/нед</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: ACCENT }}>{analytics.volume.weeklyVolumeKg.toLocaleString()} кг</div>
                  <div style={{ fontSize: 9, color: analytics.volume.volumeTrend >= 0 ? '#22c55e' : '#ef4444' }}>
                    {analytics.volume.volumeTrend >= 0 ? '↑' : '↓'} {Math.abs(analytics.volume.volumeTrend)}% vs пред.
                  </div>
                </div>
                <div style={style.card}>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Интенсивность</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#60a5fa' }}>{analytics.intensity.avgIntensity}%</div>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>RPE avg: {analytics.intensity.avgRPE}</div>
                </div>
                <div style={style.card}>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Усталость</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: analytics.fatigue.weeklyFatigue > 0.7 ? '#ef4444' : analytics.fatigue.weeklyFatigue > 0.4 ? '#f59e0b' : '#22c55e' }}>
                    {Math.round(analytics.fatigue.weeklyFatigue * 100)}%
                  </div>
                </div>
                <div style={style.card}>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Готовность</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: analytics.recovery.readinessEstimate > 60 ? '#22c55e' : analytics.recovery.readinessEstimate > 40 ? '#f59e0b' : '#ef4444' }}>
                    {analytics.recovery.readinessEstimate}%
                  </div>
                </div>
              </div>
              {/* Intensity distribution */}
              <div style={style.card}>
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Распределение нагрузки</div>
                <div style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden', marginBottom: 4 }}>
                  <div style={{ width: `${analytics.intensity.intensityDistribution.strength}%`, background: '#ef4444' }} />
                  <div style={{ width: `${analytics.intensity.intensityDistribution.hypertrophy}%`, background: '#f59e0b' }} />
                  <div style={{ width: `${analytics.intensity.intensityDistribution.endurance}%`, background: '#22c55e' }} />
                </div>
                <div style={{ display: 'flex', gap: 10, fontSize: 9, color: 'var(--text-dim)' }}>
                  <span>🔴 Сила {analytics.intensity.intensityDistribution.strength}%</span>
                  <span>🟠 Гипертрофия {analytics.intensity.intensityDistribution.hypertrophy}%</span>
                  <span>🟢 Выносливость {analytics.intensity.intensityDistribution.endurance}%</span>
                </div>
              </div>
              {/* Volume by group stacked bars */}
              {totals.some(t => t > 0) && (
                <div style={style.card}>
                  <div style={style.label}>📊 Объём по неделям (сеты)</div>
                  <div style={{ display: 'flex', gap: 2, height: 80, alignItems: 'flex-end', marginBottom: 6 }}>
                    {totals.map((t, wi) => (
                      <div key={wi} style={{ flex: 1, display: 'flex', flexDirection: 'column-reverse', height: '100%', borderRadius: 3, overflow: 'hidden', background: t > 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                        {groups.map(g => { const v = wsg[g]?.[wi] || 0; if (v === 0) return null; return <div key={g} style={{ flex: v, background: GROUP_COLORS[g] || '#888', minHeight: 2 }} />; })}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 8, color: 'rgba(255,255,255,0.6)' }}>
                    {groups.filter(g => (wsg[g]?.reduce((s: number, x: number) => s + x, 0) || 0) > 0).map(g => (
                      <span key={g} style={{ display: 'flex', alignItems: 'center', gap: 2 }}><span style={{ width: 6, height: 6, borderRadius: 1, background: GROUP_COLORS[g] || '#888', display: 'inline-block' }} />{GRP_RU[g] || g}</span>
                    ))}
                  </div>
                </div>
              )}
              {/* Volume by group */}
              <div style={style.card}>
                <div style={style.label}>Объём по группам</div>
                {Object.entries(analytics.volume.volumeByGroup).sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 8).map(([group, vol]) => {
                  const v = vol as number;
                  const maxVol3 = Math.max(...Object.values(analytics.volume.volumeByGroup).map(v2 => v2 as number), 1);
                  return (
                    <div key={group} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ width: 80, fontSize: 10, color: 'var(--text-dim)', textAlign: 'right' }}>{GRP_RU[group] || group}</span>
                      <div style={{ flex: 1, height: 6, borderRadius: 4, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                        <div style={{ width: `${(v / maxVol3) * 100}%`, height: '100%', background: '#8b5cf6', borderRadius: 4 }} />
                      </div>
                      <span style={{ fontSize: 9, color: 'var(--text-dim)', width: 50 }}>{Math.round(v).toLocaleString()} кг</span>
                    </div>
                  );
                })}
              </div>
              {/* 1RM */}
              {Object.keys(analytics.strength.estimated1RM).length > 0 && (
                <div style={style.card}>
                  <div style={style.label}>🏆 Расчётный 1RM</div>
                  {Object.entries(analytics.strength.estimated1RM).sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 5).map(([exId2, rm]) => {
                    const trend = analytics.strength.strengthTrend[exId2] || 0;
                    const ex = EXERCISE_CATALOG.find((e2: any) => e2.id === exId2);
                    return (
                      <div key={exId2} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 11 }}>
                        <span style={{ color: 'var(--text-dim)' }}>{ex?.name || exId2}</span>
                        <span><strong style={{ color: ACCENT }}>{Math.round(rm as number)} кг</strong><span style={{ marginLeft: 6, fontSize: 10, color: trend >= 0 ? '#22c55e' : '#ef4444' }}>{trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%</span></span>
                      </div>
                    );
                  })}
                </div>
              )}
              {/* Fatigue metrics */}
              <div style={style.card}>
                <div style={style.label}>Метрики усталости</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, fontSize: 10 }}>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '4px 6px', textAlign: 'center' }}>
                    <div style={{ color: 'var(--text-dim)', fontSize: 8 }}>Монотонность</div>
                    <div style={{ fontWeight: 700, color: analytics.fatigue.monotony > 2 ? '#ef4444' : ACCENT }}>{analytics.fatigue.monotony.toFixed(1)}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '4px 6px', textAlign: 'center' }}>
                    <div style={{ color: 'var(--text-dim)', fontSize: 8 }}>Напряжение</div>
                    <div style={{ fontWeight: 700, color: analytics.fatigue.strain > 300 ? '#ef4444' : ACCENT }}>{Math.round(analytics.fatigue.strain)}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '4px 6px', textAlign: 'center' }}>
                    <div style={{ color: 'var(--text-dim)', fontSize: 8 }}>ЦНС</div>
                    <div style={{ fontWeight: 700, color: analytics.fatigue.cnsFatigue > 0.7 ? '#ef4444' : ACCENT }}>{Math.round(analytics.fatigue.cnsFatigue * 100)}%</div>
                  </div>
                </div>
              </div>
              {/* Expert analytics toggle */}
              <div style={style.card}>
                <button onClick={() => setHubAnalyticsExpanded(!hubAnalyticsExpanded)} style={{
                  width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(168,85,247,0.25)', cursor: 'pointer',
                  background: hubAnalyticsExpanded ? 'rgba(168,85,247,0.08)' : 'transparent', color: '#a855f7', fontWeight: 600, fontSize: 11,
                }}>
                  {hubAnalyticsExpanded ? '▾ Скрыть' : '▸'} 🔬 Экспертная аналитика (13 карт)
                </button>
                {hubAnalyticsExpanded && historyWorkouts.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <RIRCalibrationCard />
                    <MesoCorrectionCard
                      profile={tprofile} acwr={expertAcwr} monotony={expertMono}
                      avgReadiness={(() => { const r = linked.readiness; return r ? (r.recovery + (100 - r.fatigue)) / 2 : 70; })()}
                      mesoWeeks={mesoLength} missedSessions={0}
                      exercises={expertExercises}
                      currentVolume={expertRecentVol > 0 ? Math.round(expertRecentVol / Math.max(1, Math.floor(historyWorkouts.length / 14))) : 16}
                      currentRir={expertRirStats.bias >= 0 ? 2 : 1}
                    />
                    <MuscleProgressCard sessions={historyWorkouts} level={level} />
                    <VolumeTrendCard sessions={historyWorkouts} />
                    <LoadRadarCard sessions={historyWorkouts} level={level} />
                    <WeekCompareCard sessions={historyWorkouts} />
                    <LiftHistoryCard sessions={historyWorkouts} />
                    <AnalyticsTab sessions={historyWorkouts} onRefresh={onRefresh} />
                    <StructuredAnalyticsCard sessions={historyWorkouts} />
                    <AllExercisesTrendCard sessions={historyWorkouts} />
                    <StandardForecastCard sessions={historyWorkouts} />
                    <VolumeRecoveryCorrelationCard sessions={historyWorkouts} />
                    <StickingPointAnalysisCard sessions={historyWorkouts} />
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ ...style.card, textAlign: 'center', padding: 24 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{historyWorkouts.length === 0 ? 'Нет данных. Сначала запишите тренировки.' : 'Недостаточно данных для аналитики.'}</div>
              <button onClick={onRefresh} style={{ marginTop: 8, padding: '6px 14px', borderRadius: 8, border: '1px solid var(--accent)', background: 'transparent', color: 'var(--accent)', fontSize: 10, cursor: 'pointer' }}>🔄 Обновить</button>
            </div>
          )}
        </div>
      )}

      {/* ═══ MODE: PROGRESS ═══ */}
      {mode === 'progress' && (
        <div>
          <div className="card" style={{ marginBottom: 8, padding: 10 }}>
            <h4 style={{ margin: '0 0 6px', fontSize: 12 }}>📏 Замеры тела</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
              <div><label style={{ fontSize: 9 }}>Вес</label><input type="number" value={mWeight} onChange={e => setMWeight(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '4px', borderRadius: 4, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box' }} /></div>
              <div><label style={{ fontSize: 9 }}>Талия</label><input type="number" value={mWaist} onChange={e => setMWaist(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '4px', borderRadius: 4, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box' }} /></div>
              <div><label style={{ fontSize: 9 }}>Грудь</label><input type="number" value={mChest} onChange={e => setMChest(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '4px', borderRadius: 4, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box' }} /></div>
              <div><label style={{ fontSize: 9 }}>Бицепс</label><input type="number" value={mArm} onChange={e => setMArm(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '4px', borderRadius: 4, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box' }} /></div>
              <div><label style={{ fontSize: 9 }}>Бедро</label><input type="number" value={mThigh} onChange={e => setMThigh(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '4px', borderRadius: 4, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box' }} /></div>
              <div><label style={{ fontSize: 9 }}>Дата</label><input type="date" value={mDate || ''} onChange={e => setMDate(e.target.value)} style={{ width: '100%', padding: '4px', borderRadius: 4, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box' }} /></div>
            </div>
            <button onClick={saveMeasurementHandler} style={{ width: '100%', marginTop: 6, padding: 8, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 12 }}>Сохранить замер</button>
          </div>
          {measurements.length > 0 && (
            <div className="card" style={{ marginBottom: 8, padding: 10 }}>
              <h4 style={{ margin: '0 0 4px', fontSize: 12 }}>📊 История ({measurements.length})</h4>
              {measurements.slice(-5).reverse().map((m: any, i) => (
                <div key={i} style={{ fontSize: 9, padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  {m.date}: Вес {m.weightKg}кг | Талия {m.waistCm}см | Грудь {m.chestCm}см | Бицепс {m.armCm}см | Бедро {m.thighCm}см
                </div>
              ))}
            </div>
          )}
          {measureAnalytics && (
            <div className="card" style={{ padding: 10 }}>
              <h4 style={{ margin: '0 0 4px', fontSize: 12 }}>📈 Аналитика тела</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 8px', fontSize: 10 }}>
                <span>FFMI:</span><span style={{ fontWeight: 600 }}>{measureAnalytics.ffmi?.toFixed(1)}</span>
                <span>LBM:</span><span style={{ fontWeight: 600 }}>{measureAnalytics.lbm?.toFixed(1)} кг</span>
                <span>BMI:</span><span style={{ fontWeight: 600 }}>{measureAnalytics.bmi?.toFixed(1)}</span>
                <span>Fat:</span><span style={{ fontWeight: 600 }}>{measureAnalytics.fatMass?.toFixed(1)} кг</span>
              </div>
            </div>
          )}
          {repData && (
            <div className="card" style={{ padding: 10, marginTop: 8 }}>
              <h4 style={{ margin: '0 0 4px', fontSize: 12 }}>📋 Недельный отчёт</h4>
              <div style={{ fontSize: 9, color: 'var(--text-light)' }}>{repData.insights?.slice(0, 3).map((r: any, i: number) => <div key={i}>• {r}</div>)}</div>
            </div>
          )}
          {/* e1RM and tonnage charts from diary data */}
          {historyWorkouts.length > 0 && (() => {
            const byEx: Record<string, { date: string; e1rm: number }[]> = {};
            historyWorkouts.forEach((w: any) => (w.exercises || []).forEach((e: any) => {
              const best = (e.sets || []).reduce((m: number, s: any) => Math.max(m, s.weight * (1 + (s.reps || 0) / 30)), 0);
              if (best <= 0) return;
              const name = e.exerciseName || e.exerciseId || '—';
              (byEx[name] = byEx[name] || []).push({ date: w.date, e1rm: Math.round(best) });
            }));
            const top = Object.entries(byEx).map(([n, arr]) => ({ n, arr: arr.sort((a, b) => a.date.localeCompare(b.date)) }))
              .sort((a, b) => b.arr.length - a.arr.length).slice(0, 3).filter(x => x.arr.length >= 2);
            const wkMap: Record<string, number> = {};
            historyWorkouts.forEach((w: any) => { const wn = w.date.slice(0, 10).slice(0, 7) + '-' + Math.floor(new Date(w.date).getDate() / 7); const vol = (w.exercises || []).reduce((s: number, e: any) => s + (e.totalVolume || (e.sets || []).reduce((ss: number, st: any) => ss + (st.weight || 0) * (st.reps || 0), 0)), 0); wkMap[wn] = (wkMap[wn] || 0) + vol; });
            const wkArr = Object.entries(wkMap).sort((a, b) => a[0].localeCompare(b[0])).slice(-8);
            const renderLine = (series: { date: string; e1rm: number }[], color: string, W: number, H: number, allMin: number, allMax: number) => {
              if (series.length < 2) return null;
              const px = (i: number) => 6 + (i / Math.max(1, series.length - 1)) * (W - 12);
              const py = (v: number) => H - 8 - ((v - allMin) / Math.max(1, allMax - allMin)) * (H - 16);
              return <polyline points={series.map((p, i) => `${px(i)},${py(p.e1rm)}`).join(' ')} fill="none" stroke={color} strokeWidth={1.6} />;
            };
            const colors = ['#00e68a', '#60a5fa', '#a855f7'];
            const W = 320, H = 70;
            const allVals = top.flatMap(t => t.arr.map(a => a.e1rm));
            const minV = Math.min(...allVals, 0), maxV = Math.max(...allVals, 1);
            const maxWk = Math.max(1, ...wkArr.map(([, v]) => v));
            return (
              <div className="card" style={{ padding: 10, marginTop: 8 }}>
                <h4 style={{ margin: '0 0 4px', fontSize: 12 }}>📈 Прогресс из дневника</h4>
                {top.length === 0 ? (
                  <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Недостаточно данных (нужно ≥2 тренировок на упражнение с весами).</div>
                ) : (
                  <>
                    <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 4 }}>ПМ (e1RM) по топ-упражнениям:</div>
                    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: 360, margin: '0 auto', display: 'block' }}>
                      {top.map((t, i) => renderLine(t.arr, colors[i % colors.length], W, H, minV, maxV))}
                      {top.flatMap((t, i) => t.arr.map((p, j) => <circle key={t.n + j} cx={6 + (j / Math.max(1, t.arr.length - 1)) * (W - 12)} cy={H - 8 - ((p.e1rm - minV) / Math.max(1, maxV - minV)) * (H - 16)} r={2} fill={colors[i % colors.length]} />))}
                    </svg>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 4 }}>
                      {top.map((t, i) => <span key={t.n} style={{ fontSize: 8, color: colors[i % colors.length] }}>● {t.n.slice(0, 18)}</span>)}
                    </div>
                  </>
                )}
                {wkArr.length >= 2 && (
                  <>
                    <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 8, marginBottom: 4 }}>Тоннаж по неделям:</div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 60 }}>
                      {wkArr.map(([wk, v], i) => <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}><div style={{ width: '100%', maxWidth: 28, height: Math.max(2, (v / maxWk) * 48), borderRadius: 3, background: 'linear-gradient(180deg,#00e68a,#00c853)' }} /><span style={{ fontSize: 6, color: 'rgba(255,255,255,0.4)' }}>{wk.slice(5)}</span></div>)}
                    </div>
                  </>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ═══ MODE: VISUAL ═══ */}
      {mode === 'visual' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {historyWorkouts.length < 2 ? (
            <div style={{ padding: 24, textAlign: 'center', background: 'rgba(24,24,27,0.08)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>📈</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Нужно минимум 2 тренировки для визуализации</div>
            </div>
          ) : (
            <>
              {visDashboard && (
                <div style={style.card}>
                  <div style={style.label}>📈 Недельный объём</div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 90, padding: '4px 2px' }}>
                    {visWeekly.map((w, i) => {
                      const maxV = Math.max(...visWeekly.map(x => x.volume), 1);
                      return <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ width: '80%', borderRadius: '6px 6px 2px 2px', height: `${Math.max(6, (w.volume / maxV) * 100)}%`, background: 'linear-gradient(180deg,#00e68a,rgba(0,230,138,0.3))', transition: 'height 0.4s cubic-bezier(0.22,1,0.36,1)' }} />
                        <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.35)', marginTop: 4, fontWeight: 500 }}>Н{w.week}</span>
                      </div>;
                    })}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, fontSize: 9, marginTop: 6, padding: '6px 4px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                    <span style={{ color: 'rgba(255,255,255,0.4)' }}>Пик <b style={{ color: '#fff' }}>{(visDashboard.summary as any).peakVolume || visDashboard.summary.totalVolume}</b></span>
                    <span style={{ color: 'rgba(255,255,255,0.4)' }}>Интенс. <b style={{ color: '#fff' }}>{visDashboard.summary.avgIntensity}%</b></span>
                    <span style={{ color: 'rgba(255,255,255,0.4)' }}>Тренд <b style={{ color: (visDashboard.summary as any).trend === 'up' ? '#34d399' : (visDashboard.summary as any).trend === 'down' ? '#f87171' : '#9ca3af' }}>{(visDashboard.summary as any).trend === 'up' ? '↑ +' : (visDashboard.summary as any).trend === 'down' ? '↓ ' : '→'}</b></span>
                  </div>
                </div>
              )}
              {visMuscleVol.length > 0 && (
                <div style={style.card}>
                  <div style={style.label}>💪 Объём по группам</div>
                  {visMuscleVol.map((mv, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ width: 55, fontSize: 9, color: 'rgba(255,255,255,0.5)', fontWeight: 500, textAlign: 'right' }}>{mv.muscle}</span>
                    <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 8, height: 10, overflow: 'hidden', position: 'relative' }}>
                      <div style={{ width: `${mv.percent}%`, height: '100%', borderRadius: 8, background: 'linear-gradient(90deg,#3b82f6,#60a5fa)', transition: 'width 0.5s cubic-bezier(0.22,1,0.36,1)' }} />
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.7)', minWidth: 32, textAlign: 'right' }}>{mv.percent}%</span>
                  </div>)}
                </div>
              )}
              {visProg.length > 0 && (
                <div style={style.card}>
                  <div style={style.label}>📈 Прогрессия 1RM</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {visProg.slice(0, 5).map((p, i) => {
                      const maxRM = Math.max(...p.weeks.map(x => x.estimated1RM), 1);
                      const latest = p.weeks[p.weeks.length - 1]?.estimated1RM || 0;
                      const first = p.weeks[0]?.estimated1RM || 0;
                      const change = first > 0 ? Math.round((latest - first) / first * 100) : 0;
                      return <div key={i} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '6px 8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{p.exercise}</span>
                          <span style={{ fontSize: 9, fontWeight: 700, color: change >= 0 ? '#34d399' : '#f87171' }}>{change >= 0 ? `+${change}` : change}%</span>
                        </div>
                        <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 24 }}>
                          {p.weeks.map((w, wi) => (
                            <div key={wi} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                              <div style={{ width: '100%', borderRadius: '3px 3px 1px 1px', height: `${Math.max(3, (w.estimated1RM / maxRM) * 24)}px`, background: w.estimated1RM > (p.weeks[wi - 1]?.estimated1RM || 0) ? 'linear-gradient(180deg,#34d399,#059669)' : 'linear-gradient(180deg,#f87171,#dc2626)', transition: 'height 0.3s cubic-bezier(0.22,1,0.36,1)' }} />
                              <span style={{ fontSize: 6, color: 'rgba(255,255,255,0.25)', marginTop: 1 }}>Н{w.week}</span>
                            </div>
                          ))}
                        </div>
                      </div>;
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ═══ MODE: REPORTS ═══ */}
      {mode === 'reports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="card" style={{ padding: '10px 12px' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 13 }}>📄 Отчёты по тренировкам</h3>
            <p style={{ margin: '0 0 8px', fontSize: 11, color: 'var(--text-dim)' }}>
              Сгенерируйте комплексный отчёт по вашим тренировкам: информация из каталога упражнений, статистика плана (недели, упражнения в неделю), метрики тренировок (объём, интенсивность).
            </p>
            <button onClick={() => {
              const planWeeks = macrocycle?.totalWeeks ?? (trainingOutput?.plan?.length && daysPerWeek > 0 ? Math.ceil(trainingOutput.plan.length / daysPerWeek) : 0);
              const totalVolume = trainingOutput?.weeklyVolume ?? 0;
              const avgIntensity = trainingOutput?.estimatedProgress ? Math.round(50 + trainingOutput.estimatedProgress * 5) : 0;
              const report = {
                id: 'report_' + Date.now(), date: new Date().toISOString(),
                exerciseCatalogCount: EXERCISE_CATALOG.length, planWeeks, exercisesPerWeek: daysPerWeek,
                totalVolume, avgIntensity, goal, level, daysPerWeek, splitType, periodizationType, mesoLength,
              };
              const updated = [report, ...trainingArchive].slice(0, 20);
              setTrainingArchive(updated);
              try { localStorage.setItem('he_training_reports', JSON.stringify(updated)); } catch {}
              try { localStorage.setItem('he_training_report_current', JSON.stringify(report)); } catch {}
              setTrainingReportGenerated(true);
            }} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'var(--accent)', color: '#000', border: 'none', cursor: 'pointer' }}>
              Сгенерировать отчёт
            </button>
            {trainingReportGenerated && (
              <p style={{ margin: '6px 0 0', fontSize: 11, color: '#22c55e' }}>✓ Отчёт сгенерирован и сохранён в архиве</p>
            )}
          </div>
          <div className="card" style={{ padding: '10px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h4 style={{ margin: 0, fontSize: 12 }}>📦 Архив отчетов ({trainingArchive.length})</h4>
              {trainingArchive.length > 0 && (
                <button onClick={() => { setTrainingArchive([]); localStorage.removeItem('he_training_reports'); localStorage.removeItem('he_training_report_current'); setTrainingReportGenerated(false); }} style={{
                  padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600, background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: 'none', cursor: 'pointer',
                }}>Очистить архив</button>
              )}
            </div>
            {trainingArchive.length === 0 ? (
              <p style={{ margin: 0, fontSize: 11, color: 'var(--text-dim)' }}>Архив пуст. Сгенерируйте первый отчёт.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[...trainingArchive].reverse().map((r: any) => (
                  <div key={r.id} style={{ padding: '8px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 600 }}>Отчёт {new Date(r.date).toLocaleDateString('ru')}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{new Date(r.date).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px', fontSize: 10, color: 'var(--text-dim)' }}>
                      <span>Упражнений в каталоге: {r.exerciseCatalogCount}</span>
                      <span>Недель в плане: {r.planWeeks}</span>
                      <span>Тренировок/нед: {r.exercisesPerWeek}</span>
                      <span>Общий объём: {r.totalVolume}</span>
                      <span>Ср. интенсивность: {r.avgIntensity}%</span>
                      <span>Цель: {r.goal}, Уровень: {r.level}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── WorkoutWeekCard ─── */
const WorkoutWeekCard: React.FC<{ weekLabel: string; workouts: WorkoutLog[] }> = ({ weekLabel, workouts }) => {
  const [expanded, setExpanded] = useState(false);
  const totalVol = workouts.reduce((s: number, w: WorkoutLog) => s + (w.exercises || []).reduce((s2: number, ex: any) => s2 + (ex.totalVolume || 0), 0), 0);
  const totalSets = workouts.reduce((s: number, w: WorkoutLog) => s + (w.exercises || []).reduce((s2: number, ex: any) => s2 + (ex.sets?.length || 0), 0), 0);
  const totalDur = workouts.reduce((s: number, w: WorkoutLog) => s + (w.duration || 0), 0);

  return (
    <div style={{ borderRadius: 10, marginBottom: 4, overflow: 'hidden', background: 'rgba(255,255,255,0.02)', border: expanded ? '1px solid rgba(0,230,138,0.2)' : '1px solid rgba(255,255,255,0.03)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
        <div>
          <span style={{ fontWeight: 700, fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>{weekLabel}</span>
          <span style={{ fontSize: 9, color: 'var(--text-dim)', marginLeft: 6 }}>{workouts.length} тр · {totalSets} сетов</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{Math.round(totalVol).toLocaleString()} кг</span>
          <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>{expanded ? '▴' : '▾'}</span>
        </div>
      </div>
      {expanded && (
        <div style={{ padding: '0 10px 8px', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 6 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginBottom: 6 }}>
            {[
              { label: 'Объём', value: `${Math.round(totalVol)} кг`, color: '#34d399' },
              { label: 'Сетов', value: totalSets, color: '#60a5fa' },
              { label: 'Длит.', value: `${Math.round(totalDur / Math.max(1, workouts.length))} мин`, color: '#f59e0b' },
            ].map((s, i) => <div key={i} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 6, padding: '4px 6px', textAlign: 'center' }}>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>{s.label}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.value}</div>
            </div>)}
          </div>
          {workouts.map((w: WorkoutLog, wi: number) => (
            <div key={wi} style={{ padding: '6px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.02)', marginBottom: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 9 }}>
                <span style={{ color: 'var(--text-dim)' }}>{w.date} · {w.duration} мин · RPE {w.overallRPE} · {SP_LABELS[w.split as keyof typeof SP_LABELS] || w.split}</span>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 8 }}>{w.notes?.slice(0, 40)}</span>
              </div>
              {(w.exercises || []).map((ex: any, ei: number) => {
                const bestSet = (ex.sets || []).reduce((b: any, s: any) => s.weight > b.weight ? s : b, { weight: 0, reps: 0, rir: 0 });
                return (
                  <div key={ei} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: 9 }}>
                    <span style={{ color: 'rgba(255,255,255,0.6)' }}>{ex.exerciseName || ex.exerciseId}</span>
                    <span style={{ color: '#34d399' }}>{bestSet.weight}×{bestSet.reps} @ RIR {bestSet.rir}</span>
                    <span style={{ color: 'rgba(255,255,255,0.3)' }}>1RM {Math.round(ex.estimated1RM || 0)} кг</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TrainingDiaryHub;
