import React, { useState, useMemo, useEffect } from 'react';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import { Sparkline } from './Sparkline';
import { OneRmCalcTab } from './OneRmCalcTab';
import { PlateCalcTab } from './PlateCalcTab';
import { StrengthDiary, type StrengthStats, type WeeklyProgress } from '../../../engines/strength-diary.engine';
import { epley1RM } from '../../../engines/e1rm';
import type { WorkoutLog, TrainingOutput } from '../../../core/types';
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
import { QuickEntry } from './QuickEntry';
import { DiaryRecordingForm } from './DiaryRecordingForm';
import { TrainingCalendarTab } from './TrainingCalendarTab';
import MMCTrackingCard from './MMCTrackingCard';
import { CheckinMetricsCard } from './CheckinMetricsCard';
import { CsvImportTab } from './CsvImportTab';
import { useIsMobile } from './useIsMobile';

/* ─── RecordModeSelector — sub-mode toggle for record (quick vs full) ─── */
const RecordModeSelector: React.FC<{
  diary: StrengthDiary;
  historyWorkouts: WorkoutLog[];
  selectedWeek: number;
  onSave: () => void;
}> = ({ diary, historyWorkouts, selectedWeek, onSave }) => {
  const [sub, setSub] = useState<'quick' | 'full'>('quick');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {([['quick', '⚡ Быстро'], ['full', '📝 Подробно']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setSub(k)} style={{
            flex: 1, padding: '8px 12px', borderRadius: 8,
            border: sub === k ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.06)',
            background: sub === k ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.02)',
            color: sub === k ? 'var(--accent)' : 'var(--text-dim)',
            fontWeight: sub === k ? 700 : 400, fontSize: 11, cursor: 'pointer',
          }}>{l}</button>
        ))}
      </div>
      {sub === 'quick' ? (
        <QuickEntry diary={diary} historyWorkouts={historyWorkouts} selectedWeek={selectedWeek} onSave={onSave} />
      ) : (
        <DiaryRecordingForm diary={diary} selectedWeek={selectedWeek} onSave={onSave} historyWorkouts={historyWorkouts} />
      )}
    </div>
  );
};

const ACCENT = '#00e68a';
const DIM = 'rgba(255,255,255,0.5)';

const GRP_RU: Record<string, string> = {
  chest: 'Грудь', back: 'Спина', legs: 'Ноги', shoulders: 'Плечи', arms: 'Руки',
  core: 'Кор', hamstrings: 'Бицепс бедра', glutes: 'Ягодицы', calves: 'Икры',
  triceps: 'Трицепс', biceps: 'Бицепс', quads: 'Квадрицепсы',
};
const GROUP_COLORS: Record<string, string> = {
  chest: '#00e68a', back: '#60a5fa', legs: '#f59e0b', shoulders: '#a855f7',
  arms: '#ef4444', core: '#22c55e', hamstrings: '#3b82f6', glutes: '#ec4899',
  calves: '#eab308', triceps: '#fb923c', biceps: '#f472b6', quads: '#facc15',
};

const WorkoutWeekCard: React.FC<{
  weekLabel: string;
  workouts: WorkoutLog[];
  prevWorkouts?: WorkoutLog[];
  expanded: boolean;
  onToggle: () => void;
}> = ({ weekLabel, workouts, prevWorkouts, expanded, onToggle }) => {
  const previousByExercise = new Map<string, number>();
  (prevWorkouts || []).forEach(workout => workout.exercises.forEach(exercise => {
    previousByExercise.set(exercise.exerciseId, Math.max(previousByExercise.get(exercise.exerciseId) || 0, exercise.estimated1RM || 0));
  }));
  const totalVol = workouts.reduce((s, w) => s + w.exercises.reduce((sum, e) => sum + e.totalVolume, 0), 0);
  const totalSets = workouts.reduce((s, w) => s + w.exercises.reduce((sum, e) => sum + e.sets.length, 0), 0);
  const prevVol = (prevWorkouts || []).reduce((s, w) => s + w.exercises.reduce((sum, e) => sum + e.totalVolume, 0), 0);
  const isDeload = prevVol > 0 && totalVol > 0 && totalVol / prevVol < 0.55;
  const avgRPE = (() => { let c = 0, s = 0; workouts.forEach(w => w.exercises.forEach(e => e.sets.forEach(st => { if (st.rpe) { s += st.rpe; c++; } }))); return c > 0 ? (s / c).toFixed(1) : null; })();
  return (
    <div style={{ ...style.card, borderLeft: isDeload ? '3px solid #f59e0b' : undefined }}>
      <div onClick={onToggle} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: expanded ? 6 : 0, cursor: 'pointer', padding: '2px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', transition: 'transform 0.2s', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
          <strong style={{ color: ACCENT, fontSize: 12 }}>{weekLabel}</strong>
          {isDeload && <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 8, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontWeight: 700 }}>ДЕЛОУД</span>}
        </div>
        <div style={{ display: 'flex', gap: 8, fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
          <span>{workouts.length} трен.</span>
          <span>{totalSets} подходов</span>
          <span>{(totalVol / 1000).toFixed(1)}т кг</span>
        </div>
      </div>
      {expanded && workouts.map(workout => (
        <div key={workout.id} style={{ padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600 }}>{new Date(workout.date).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })} · <span style={{ color: 'rgba(255,255,255,0.5)' }}>{workout.split || 'Тренировка'}</span></span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{Math.round(workout.exercises.reduce((sum, e) => sum + e.totalVolume, 0)).toLocaleString()} кг</span>
              <button onClick={e => { e.stopPropagation(); const lines: string[] = [`${new Date(workout.date).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })} — ${workout.split || 'Тренировка'}`, '']; workout.exercises.forEach(ex => { lines.push(ex.exerciseName); ex.sets.forEach((s, i) => { lines.push(`  ${i+1}. ${s.weight}кг × ${s.reps}${s.rir !== undefined ? ` RIR${s.rir}` : ''}`); }); lines.push(''); }); if (workout.overallRPE) lines.push(`RPE: ${workout.overallRPE}`); if (workout.duration) lines.push(`Длительность: ${workout.duration} мин`); if (workout.notes) lines.push(`Заметки: ${workout.notes}`); navigator.clipboard?.writeText(lines.join('\n')); }} style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 10, minWidth: 20 }} title="Копировать тренировку">📋</button>
            </div>
          </div>
          <div style={{ display: 'grid', gap: 4, marginTop: 4 }}>
            {workout.exercises.map(exercise => {
              const previous = previousByExercise.get(exercise.exerciseId);
              const current = exercise.estimated1RM || 0;
              const delta = previous && current ? current - previous : null;
              const deltaPct = previous && current && previous > 0 ? Math.round((current - previous) / previous * 100) : null;
              const isPR = delta !== null && delta > 0;
              return (
                <div key={exercise.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
                  <span style={{ flex: 1, color: 'rgba(255,255,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exercise.exerciseName}</span>
                  <span style={{ color: 'rgba(255,255,255,0.4)', minWidth: 40, textAlign: 'right' }}>{exercise.sets.length}сет</span>
                  <span style={{ color: 'rgba(255,255,255,0.5)', minWidth: 55, textAlign: 'right' }}>{current ? `${Math.round(current)}` : '—'}</span>
                  {deltaPct !== null && (
                    <span style={{
                      minWidth: 40, textAlign: 'right', fontWeight: 700,
                      color: isPR ? '#22c55e' : delta === 0 ? 'rgba(255,255,255,0.3)' : '#ef4444',
                      fontSize: 10,
                    }}>
                      {isPR ? '+' : ''}{deltaPct}%
                    </span>
                  )}
                  {isPR && <span style={{ fontSize: 8 }}>🏆</span>}
                </div>
              );
            })}
          </div>
          {/* Workout meta + notes */}
          {(workout.overallRPE || workout.duration || workout.notes) && (
            <div style={{ marginTop: 6, padding: '4px 6px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {workout.overallRPE && <span>RPE: <strong style={{ color: 'rgba(255,255,255,0.6)' }}>{workout.overallRPE}</strong></span>}
                {workout.duration && <span>{workout.duration} мин</span>}
                {workout.recoveryBefore && <span>Восст: {workout.recoveryBefore}/5</span>}
              </div>
              {workout.notes && (
                <div style={{ marginTop: 3, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic', lineHeight: 1.3 }}>{workout.notes}</div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const style: Record<string, React.CSSProperties> = {
  card: { padding: 12, borderRadius: 14, background: 'rgba(24,24,27,0.12)', border: '1px solid rgba(255,255,255,0.04)', marginBottom: 8 },
  label: { fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 500, letterSpacing: '0.3px', textTransform: 'uppercase', marginBottom: 8 },
  input: { width: '100%', padding: '6px 4px', borderRadius: 6, background: '#18181b', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 11, boxSizing: 'border-box' as any },
  btn: { width: '100%', padding: 9, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,var(--accent),#00cc7a)', color: '#000', fontWeight: 700, fontSize: 12 },
};

interface TrainingDiaryHubProps {
  initialMode?: 'record' | 'tools' | 'diary' | 'reports' | 'history' | 'analytics' | 'progress' | 'body' | 'calendar' | 'checkin' | 'mmc';
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

type HubMode = 'record' | 'history' | 'analytics' | 'progress' | 'body' | 'tools' | 'calendar' | 'checkin' | 'mmc';

/* ─── Extracted sub-components (fix: useState inside IIFE violates rules of hooks) ─── */

const WeeklyTargetsCard: React.FC<{ historyWorkouts: WorkoutLog[] }> = ({ historyWorkouts }) => {
  const [targets, setTargets] = useState<{ sessions: number; sets: number; tonnage: number }>(() => {
    try { return JSON.parse(localStorage.getItem('he_weekly_targets') || 'null') || { sessions: 4, sets: 80, tonnage: 5000 }; } catch { return { sessions: 4, sets: 80, tonnage: 5000 }; }
  });
  const today = new Date();
  const weekStart = new Date(today); weekStart.setDate(weekStart.getDate() - today.getDay() + 1); weekStart.setHours(0, 0, 0, 0);
  const thisWeek = historyWorkouts.filter(w => new Date(w.date) >= weekStart);
  const actualSessions = thisWeek.length;
  const actualSets = thisWeek.reduce((s: number, w: any) => s + w.exercises.reduce((sum: number, e: any) => sum + (e.sets?.length || 0), 0), 0);
  const actualTonnage = thisWeek.reduce((s: number, w: any) => s + w.exercises.reduce((sum: number, e: any) => sum + e.totalVolume, 0), 0);
  const pct = (cur: number, goal: number) => Math.min(100, Math.round((cur / Math.max(1, goal)) * 100));
  const saveTarget = (patch: Partial<typeof targets>) => {
    const next = { ...targets, ...patch };
    setTargets(next);
    try { localStorage.setItem('he_weekly_targets', JSON.stringify(next)); } catch {}
  };
  const items = [
    { label: 'Тренировки', actual: actualSessions, target: targets.sessions, unit: 'раз', color: '#00e68a', key: 'sessions' as const },
    { label: 'Сеты', actual: actualSets, target: targets.sets, unit: '', color: '#60a5fa', key: 'sets' as const },
    { label: 'Тоннаж', actual: actualTonnage, target: targets.tonnage, unit: 'кг', color: '#a855f7', key: 'tonnage' as const },
  ];
  return (
    <div style={style.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={style.label}>🎯 Цели недели</div>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>Эта неделя</span>
      </div>
      {items.map(item => {
        const p = pct(item.actual, item.target);
        return (
          <div key={item.key} style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
              <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{item.label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: p >= 100 ? '#22c55e' : '#fff' }}>
                  {item.key === 'tonnage' ? (item.actual / 1000).toFixed(1) + 'т' : item.actual}
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}> / {item.key === 'tonnage' ? (item.target / 1000).toFixed(1) + 'т' : item.target}</span>
                </span>
                <input type="number" value={item.target} onChange={e => saveTarget({ [item.key]: Math.max(1, +e.target.value || 1) })}
                  style={{ width: 40, padding: '1px 3px', borderRadius: 3, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', fontSize: 9, textAlign: 'right' }} />
              </div>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${p}%`, background: p >= 100 ? '#22c55e' : item.color, borderRadius: 3, transition: 'width 0.3s' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const ProgressChartsCard: React.FC<{ historyWorkouts: WorkoutLog[] }> = ({ historyWorkouts }) => {
  const [chartTooltip, setChartTooltip] = useState<{ name: string; value: number; x: number; y: number } | null>(null);
  const byEx: Record<string, { date: string; e1rm: number }[]> = {};
  historyWorkouts.forEach((w: any) => (w.exercises || []).forEach((e: any) => {
    const best = (e.sets || []).reduce((m: number, s: any) => Math.max(m, epley1RM(s.weight || 0, s.reps || 0)), 0);
    if (best <= 0) return;
    const name = e.exerciseName || e.exerciseId || '—';
    (byEx[name] = byEx[name] || []).push({ date: w.date, e1rm: Math.round(best) });
  }));
  const top = Object.entries(byEx).map(([n, arr]) => ({ n, arr: arr.sort((a, b) => a.date.localeCompare(b.date)) }))
    .sort((a, b) => b.arr.length - a.arr.length).slice(0, 3).filter(x => x.arr.length >= 2);
  const wkMap: Record<string, number> = {};
  historyWorkouts.forEach((w: any) => { const wn = w.date.slice(0, 10).slice(0, 7) + '-' + Math.floor(new Date(w.date).getDate() / 7); const vol = (w.exercises || []).reduce((s: number, e: any) => s + (e.totalVolume || (e.sets || []).reduce((ss: number, st: any) => ss + (st.weight || 0) * (st.reps || 0), 0)), 0); wkMap[wn] = (wkMap[wn] || 0) + vol; });
  const wkArr = Object.entries(wkMap).sort((a, b) => a[0].localeCompare(b[0])).slice(-8);
  const colors = ['#00e68a', '#60a5fa', '#a855f7'];
  const W = 320, H = 80;
  const allVals = top.flatMap(t => t.arr.map(a => a.e1rm));
  const minV = Math.min(...allVals, 0), maxV = Math.max(...allVals, 1);
  const maxWk = Math.max(1, ...wkArr.map(([, v]) => v));
  const gridLines = [0.25, 0.5, 0.75];
  return (
    <div className="card" style={{ padding: 10, marginTop: 8 }}>
      <h4 style={{ margin: '0 0 4px', fontSize: 12 }}>📈 Прогресс из дневника</h4>
      {top.length === 0 ? (
        <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Недостаточно данных (нужно ≥2 тренировок на упражнение с весами).</div>
      ) : (
        <>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>ПМ (e1RM) по топ-упражнениям:</div>
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: 360, margin: '0 auto', display: 'block' }}>
            {gridLines.map(pct => (
              <line key={pct} x1={6} x2={W - 6} y1={H - 8 - pct * (H - 16)} y2={H - 8 - pct * (H - 16)}
                stroke="rgba(255,255,255,0.06)" strokeDasharray="2 3" />
            ))}
            <text x={2} y={H - 8} fontSize={7} fill="rgba(255,255,255,0.3)">{minV}</text>
            <text x={2} y={12} fontSize={7} fill="rgba(255,255,255,0.3)">{maxV}</text>
            {top.map((t, i) => {
              if (t.arr.length < 2) return null;
              const px = (j: number) => 6 + (j / Math.max(1, t.arr.length - 1)) * (W - 12);
              const py = (v: number) => H - 8 - ((v - minV) / Math.max(1, maxV - minV)) * (H - 16);
              const d = t.arr.map((p, j) => `${j === 0 ? 'M' : 'L'}${px(j)},${py(p.e1rm)}`).join(' ');
              return (
                <g key={i}>
                  <path d={d} fill="none" stroke={colors[i % colors.length]} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                  {t.arr.map((p, j) => (
                    <circle key={j} cx={px(j)} cy={py(p.e1rm)}
                      r={j === t.arr.length - 1 ? 3 : 1.8}
                      fill={j === t.arr.length - 1 ? colors[i % colors.length] : 'rgba(255,255,255,0.3)'}
                      stroke={j === t.arr.length - 1 ? '#000' : 'none'} strokeWidth={0.5}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={e => setChartTooltip({ name: t.n, value: p.e1rm, x: e.clientX, y: e.clientY })}
                      onMouseLeave={() => setChartTooltip(null)}
                    />
                  ))}
                </g>
              );
            })}
          </svg>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 4 }}>
            {top.map((t, i) => <span key={t.n} style={{ fontSize: 10, color: colors[i % colors.length] }}>● {t.n}</span>)}
          </div>
          {chartTooltip && (
            <div style={{ position: 'fixed', left: chartTooltip.x + 8, top: chartTooltip.y - 28, background: '#18181b', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, padding: '3px 8px', fontSize: 10, color: '#fff', zIndex: 9999, pointerEvents: 'none', whiteSpace: 'nowrap' }}>
              {chartTooltip.name}: <strong>{chartTooltip.value} кг</strong>
            </div>
          )}
        </>
      )}
      {wkArr.length >= 2 && (
        <>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 8, marginBottom: 4 }}>Тоннаж по неделям:</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 60 }}>
            {wkArr.map(([wk, v], i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{ width: '100%', maxWidth: 28, height: Math.max(2, (v / maxWk) * 48), borderRadius: 3, background: 'linear-gradient(180deg,#00e68a,#00c853)', position: 'relative' }}
                  onMouseEnter={e => setChartTooltip({ name: wk, value: v, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setChartTooltip(null)}
                />
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{wk.slice(5)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const WorkoutComparisonCard: React.FC<{ historyWorkouts: WorkoutLog[] }> = ({ historyWorkouts }) => {
  const [cmpA, setCmpA] = useState(0);
  const [cmpB, setCmpB] = useState(1);
  const wA = historyWorkouts[cmpA];
  const wB = historyWorkouts[cmpB];
  if (!wA || !wB) return null;
  const volA = wA.exercises.reduce((s: number, e: any) => s + e.totalVolume, 0);
  const volB = wB.exercises.reduce((s: number, e: any) => s + e.totalVolume, 0);
  const setsA = wA.exercises.reduce((s: number, e: any) => s + (e.sets?.length || 0), 0);
  const setsB = wB.exercises.reduce((s: number, e: any) => s + (e.sets?.length || 0), 0);
  const exA = new Set(wA.exercises.map((e: any) => e.exerciseName));
  const exB = new Set(wB.exercises.map((e: any) => e.exerciseName));
  const shared = [...exA].filter(n => exB.has(n));
  const onlyA = [...exA].filter(n => !exB.has(n));
  const onlyB = [...exB].filter(n => !exA.has(n));
  return (
    <div style={style.card}>
      <div style={style.label}>⚖️ Сравнение тренировок</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <select value={cmpA} onChange={e => setCmpA(+e.target.value)} style={{ ...style.input, flex: 1, fontSize: 10, padding: '4px' }}>
          {historyWorkouts.slice(0, 20).map((w: any, i: number) => <option key={i} value={i}>{(w.date || '').slice(0, 10)} ({w.split || '—'})</option>)}
        </select>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>vs</span>
        <select value={cmpB} onChange={e => setCmpB(+e.target.value)} style={{ ...style.input, flex: 1, fontSize: 10, padding: '4px' }}>
          {historyWorkouts.slice(0, 20).map((w: any, i: number) => <option key={i} value={i}>{(w.date || '').slice(0, 10)} ({w.split || '—'})</option>)}
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 4, fontSize: 10, marginBottom: 4 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700, color: '#00e68a' }}>{(volA / 1000).toFixed(1)}т</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)' }}>объём</div>
        </div>
        <div style={{ color: volA > volB ? '#22c55e' : volA < volB ? '#ef4444' : 'rgba(255,255,255,0.3)', fontSize: 10 }}>
          {volA > volB ? '◀' : volA < volB ? '▶' : '='}
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700, color: '#60a5fa' }}>{(volB / 1000).toFixed(1)}т</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)' }}>объём</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700, color: '#00e68a' }}>{setsA}</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)' }}>сетов</div>
        </div>
        <div style={{ color: setsA > setsB ? '#22c55e' : setsA < setsB ? '#ef4444' : 'rgba(255,255,255,0.3)' }}>
          {setsA > setsB ? '◀' : setsA < setsB ? '▶' : '='}
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700, color: '#60a5fa' }}>{setsB}</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)' }}>сетов</div>
        </div>
      </div>
      {shared.length > 0 && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>🔄 Совпадение: {shared.join(', ')}</div>}
      {onlyA.length > 0 && <div style={{ fontSize: 9, color: '#00e68a' }}>🟢 Только A: {onlyA.join(', ')}</div>}
      {onlyB.length > 0 && <div style={{ fontSize: 9, color: '#60a5fa' }}>🔵 Только B: {onlyB.join(', ')}</div>}
    </div>
  );
};

const ExerciseSubstitutionCard: React.FC = () => {
  const muscleGroups: Record<string, string[]> = {
    'Грудь': ['Жим штанги лёжа', 'Жим гантелей', 'Разводка кабель', 'Жим в тренажёре', 'Сведение в бабочке', 'Жим на наклонной', 'Отжимания на брусьях'],
    'Спина': ['Тяга штанги в наклоне', 'Тяга верхнего блока', 'Тяга гантели', 'Подтягивания', 'Тяга нижнего блока', 'Гиперэкстензия', 'Тяга в ХМ-тренажёре'],
    'Ноги': ['Приседания со штангой', 'Жим ногами', 'Болгарские сплит-присед', 'Румынская тяга', 'Разгибание ног', 'Сгибание ног', 'Гакк-присед'],
    'Плечи': ['Жим стоя', 'Жим сидя гантелей', 'Разводка в стороны', 'Тяга к подбородку', 'Разведение кабеля', 'Армейский жим', 'Тяга штанги к груди'],
    'Руки': ['Подъём на бицепс', 'Молотки', 'Разгибание на трицепс', 'Французский жим', 'Концентрированный подъём', 'Отжимания на трицепс', 'Экстензия кабель'],
    'Ягодицы': ['Ягодичный мост', 'Гиперэкстензия', 'Отведение ноги', 'Болгарские сплит', 'Румынская тяга', 'Глубокий присед', 'Бедренная экстензия'],
    'Пресс': ['Скручивания', 'Планка', 'Велосипед', 'Подъём ног', 'Кранчи в тренажёре', 'Махи ногами', 'Дровосек'],
  };
  const [selGroup, setSelGroup] = useState('Грудь');
  const [selEx, setSelEx] = useState('');
  const alts = muscleGroups[selGroup] || [];
  return (
    <div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
        {Object.keys(muscleGroups).map(g => (
          <button key={g} onClick={() => { setSelGroup(g); setSelEx(''); }} style={{ padding: '2px 8px', borderRadius: 10, background: selGroup === g ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${selGroup === g ? 'rgba(0,230,138,0.3)' : 'rgba(255,255,255,0.08)'}`, color: selGroup === g ? ACCENT : DIM, cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>{g}</button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
        {alts.map(ex => (
          <div key={ex} onClick={() => setSelEx(selEx === ex ? '' : ex)} style={{ padding: '5px 8px', borderRadius: 6, background: selEx === ex ? 'rgba(0,230,138,0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${selEx === ex ? 'rgba(0,230,138,0.25)' : 'rgba(255,255,255,0.06)'}`, cursor: 'pointer', fontSize: 10, color: selEx === ex ? ACCENT : 'rgba(255,255,255,0.7)' }}>{ex}</div>
        ))}
      </div>
    </div>
  );
};

const WarmupRampCard: React.FC = () => {
  const [wuWeight, setWuWeight] = useState(100);
  const ramp = wuWeight <= 40
    ? [{ pct: 0, w: 0, reps: 15, label: 'Разминка' }]
    : wuWeight <= 80
      ? [{ pct: 50, w: Math.round(wuWeight * 0.5 / 2.5) * 2.5, reps: 10 }, { pct: 70, w: Math.round(wuWeight * 0.7 / 2.5) * 2.5, reps: 6 }, { pct: 85, w: Math.round(wuWeight * 0.85 / 2.5) * 2.5, reps: 3 }]
      : wuWeight <= 140
        ? [{ pct: 40, w: Math.round(wuWeight * 0.4 / 5) * 5, reps: 12 }, { pct: 60, w: Math.round(wuWeight * 0.6 / 5) * 5, reps: 8 }, { pct: 75, w: Math.round(wuWeight * 0.75 / 5) * 5, reps: 5 }, { pct: 85, w: Math.round(wuWeight * 0.85 / 5) * 5, reps: 3 }]
        : [{ pct: 40, w: Math.round(wuWeight * 0.4 / 5) * 5, reps: 12 }, { pct: 55, w: Math.round(wuWeight * 0.55 / 5) * 5, reps: 8 }, { pct: 70, w: Math.round(wuWeight * 0.7 / 5) * 5, reps: 5 }, { pct: 80, w: Math.round(wuWeight * 0.8 / 5) * 5, reps: 3 }, { pct: 90, w: Math.round(wuWeight * 0.9 / 5) * 5, reps: 1 }];
  return (
    <div style={style.card}>
      <div style={style.label}>🔥 Разминочная рампа</div>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>Автоподбор разминки по рабочему весу</div>
      <div style={{ marginBottom: 6 }}>
        <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Рабочий вес (кг)</label>
        <input type="number" value={wuWeight} onChange={e => setWuWeight(Math.max(0, +e.target.value || 0))} style={{ width: '100%', padding: '4px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 11, boxSizing: 'border-box' }} />
      </div>
      <div style={{ display: 'grid', gap: 2 }}>
        {ramp.map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, padding: '2px 0' }}>
            <span style={{ minWidth: 30, color: i === ramp.length - 1 ? ACCENT : 'rgba(255,255,255,0.4)', fontWeight: i === ramp.length - 1 ? 700 : 400 }}>{r.pct}%</span>
            <span style={{ flex: 1, color: 'rgba(255,255,255,0.6)' }}>{r.w > 0 ? `${r.w}кг` : 'Пустой гриф'}</span>
            <span style={{ color: 'rgba(255,255,255,0.35)' }}>{r.reps} повт</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, padding: '3px 0', fontWeight: 700 }}>
          <span style={{ minWidth: 30, color: ACCENT }}>100%</span>
          <span style={{ flex: 1, color: ACCENT }}>{wuWeight}кг × работа</span>
        </div>
      </div>
    </div>
  );
};

export const TrainingDiaryHub: React.FC<TrainingDiaryHubProps> = ({
  initialMode, diary, diaryStats, diaryProgress, historyWorkouts, macrocycle, selectedWeek, level, onRefresh,
  trainingOutput, goal, daysPerWeek, splitType, periodizationType, mesoLength, tprofile, linked,
}) => {
  const resolvedMode: HubMode = initialMode === 'diary' ? 'record' : initialMode === 'reports' ? 'tools' : (initialMode as HubMode) || 'record';
  const [mode, setMode] = useState<HubMode>(resolvedMode);
  // The hub is reused while the parent tab changes. Keep the visible content
  // in sync instead of relying on a remount/key as an accidental reset.
  useEffect(() => { setMode(resolvedMode); }, [resolvedMode]);
  const [search, setSearch] = useState('');
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [notesFilter, setNotesFilter] = useState('');
  const isMobile = useIsMobile();
  const [historyExpanded, setHistoryExpanded] = useState<string | null>(null);
  const [hubAnalyticsExpanded, setHubAnalyticsExpanded] = useState(false);
  const [barTooltip, setBarTooltip] = useState<{ group: string; sets: number; week: number; x: number; y: number } | null>(null);

  // Progress state

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

  // History exercise filter
  const [historyExerciseFilter, setHistoryExerciseFilter] = useState('');
  const allExerciseNames = useMemo(() => {
    const names = new Set<string>();
    historyWorkouts.forEach(w => w.exercises?.forEach((e: any) => names.add(e.exerciseName || e.exerciseId)));
    return Array.from(names).sort();
  }, [historyWorkouts]);
  const filteredHistoryWorkouts = useMemo(() => {
    if (!historyExerciseFilter) return historyWorkouts;
    return historyWorkouts.map(w => ({
      ...w,
      exercises: w.exercises.filter((e: any) => (e.exerciseName || e.exerciseId).toLowerCase().includes(historyExerciseFilter.toLowerCase())),
    })).filter(w => w.exercises.length > 0);
  }, [historyWorkouts, historyExerciseFilter]);

  useEffect(() => {
    const m = loadMeasurements();
    setMeasurements(m);
    if (m.length > 0) {
      const last = m[m.length - 1];
      setMWeight(last.weightKg || 80);
      setMWaist(last.waistCm || 85);
      setMChest(last.chestCm || 100);
      setMArm(last.armLeftCm || last.armRightCm || 38);
      setMThigh(last.thighLeftCm || last.thighRightCm || 60);
    }
    try { if (localStorage.getItem('he_training_report_current')) setTrainingReportGenerated(true); } catch {}
  }, []);
  const measureAnalytics = useMemo(() => analyzeMeasurements(linked?.profile?.settings?.personal?.height || 175), [measurements.length]);

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
    const last = measurements.length > 0 ? measurements[measurements.length - 1] : null;
    const updated = saveMeasurement({
      date: mDate,
      weightKg: mWeight,
      waistCm: mWaist,
      chestCm: mChest,
      armLeftCm: mArm || last?.armLeftCm || 0,
      armRightCm: mArm || last?.armRightCm || 0,
      thighLeftCm: mThigh || last?.thighLeftCm || 0,
      thighRightCm: mThigh || last?.thighRightCm || 0,
      calfLeftCm: last?.calfLeftCm || 0,
      calfRightCm: last?.calfRightCm || 0,
      neckCm: last?.neckCm || 0,
      hipCm: last?.hipCm || 0,
      shoulderCm: last?.shoulderCm || 0,
      forearmLeftCm: last?.forearmLeftCm || 0,
      forearmRightCm: last?.forearmRightCm || 0,
      bodyFatPercent: last?.bodyFatPercent || 0,
      notes: '',
    });
    setMeasurements(updated);
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
  const filteredHistory = useMemo(() => {
    let result = search ? groupedHistory.filter(([week]) => week.toLowerCase().includes(search.toLowerCase())) : groupedHistory;
    if (filterGroup !== 'all') {
      result = result.map(([week, workouts]) => [
        week,
        workouts.filter(w => (w.exercises || []).some((e: any) => {
          const cat = EXERCISE_CATALOG.find((c: any) => c.id === e.exerciseId);
          return cat?.group === filterGroup;
        })),
      ] as [string, WorkoutLog[]]).filter(([, ws]) => ws.length > 0);
    }
    if (historyExerciseFilter) {
      const q = historyExerciseFilter.toLowerCase();
      result = result.map(([week, workouts]) => [
        week,
        workouts.filter(w => (w.exercises || []).some((e: any) => (e.exerciseName || e.exerciseId || '').toLowerCase().includes(q))),
      ] as [string, WorkoutLog[]]).filter(([, ws]) => ws.length > 0);
    }
    if (notesFilter) {
      const q = notesFilter.toLowerCase();
      result = result.map(([week, workouts]) => [
        week,
        workouts.filter(w => (w.notes || '').toLowerCase().includes(q) || (w.split || '').toLowerCase().includes(q)),
      ] as [string, WorkoutLog[]]).filter(([, ws]) => ws.length > 0);
    }
    return result;
  }, [groupedHistory, search, filterGroup, historyExerciseFilter, notesFilter]);

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
    const exMap = new Map<string, { first: number; last: number }>();
    for (const w of historyWorkouts) {
      const exs: any[] = (w as any).exercises || [];
      for (const ex of exs) {
        const nm = ex.name || ex.exerciseId || '?';
        if (!exMap.has(nm)) exMap.set(nm, { first: 0, last: 0 });
        const v = epley1RM(ex.weight || 0, ex.reps || 0);
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Program context header */}
      {macrocycle && curPhase && (
        <div style={{ ...style.card, border: '1px solid rgba(0,230,138,0.12)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Текущая программа</div>
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

      {/* ═══ MODE: RECORD ═══ — quick entry + full form */}
      {mode === 'record' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <RecordModeSelector diary={diary} historyWorkouts={historyWorkouts} selectedWeek={selectedWeek} onSave={onRefresh} />
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
          {/* Calendar heatmap */}
          {historyWorkouts.length >= 2 && (() => {
            const weeks = 16;
            const today = new Date();
            const calStart = new Date(today);
            calStart.setDate(calStart.getDate() - (weeks * 7) + 1 - calStart.getDay());
            const dayMap = new Map<string, number>();
            historyWorkouts.forEach((w: any) => {
              const ds = w.date.slice(0, 10);
              dayMap.set(ds, (dayMap.get(ds) || 0) + 1);
            });
            const maxPerDay = Math.max(1, ...dayMap.values());
            const days: { date: string; count: number; dayOfWeek: number; weekIdx: number }[] = [];
            for (let w = 0; w < weeks; w++) {
              for (let d = 0; d < 7; d++) {
                const dt = new Date(calStart);
                dt.setDate(dt.getDate() + w * 7 + d);
                const ds = dt.toISOString().slice(0, 10);
                days.push({ date: ds, count: dayMap.get(ds) || 0, dayOfWeek: d, weekIdx: w });
              }
            }
            const dayLabels = ['Пн', '', 'Ср', '', 'Пт', '', 'Вс'];
            return (
              <div style={style.card}>
                <div style={style.label}>📅 Календарь ({weeks} нед)</div>
                <div style={{ display: 'flex', gap: 2 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginRight: 2 }}>
                    {dayLabels.map((l, i) => <div key={i} style={{ height: 10, fontSize: 7, color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center' }}>{l}</div>)}
                  </div>
                  {Array.from({ length: weeks }, (_, wi) => (
                    <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {days.filter(d => d.weekIdx === wi).map(d => {
                        const intensity = d.count / maxPerDay;
                        const bg = d.count === 0 ? 'rgba(255,255,255,0.03)' : intensity > 0.7 ? 'rgba(0,230,138,0.6)' : intensity > 0.3 ? 'rgba(0,230,138,0.35)' : 'rgba(0,230,138,0.15)';
                        return <div key={d.date} style={{ width: 10, height: 10, borderRadius: 2, background: bg }} title={`${d.date}: ${d.count} трен.`} />;
                      })}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 4, justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>Меньше</span>
                  {[0, 0.15, 0.35, 0.6].map(op => <div key={op} style={{ width: 8, height: 8, borderRadius: 1, background: `rgba(0,230,138,${op || 0.03})` }} />)}
                  <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>Больше</span>
                </div>
              </div>
            );
          })()}
          <div style={style.card}>
            <div style={style.label}>📜 История тренировок</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              {[
                { label: 'Недель', value: diaryProgress.length, color: '#34d399' },
                { label: 'Тренировок', value: diaryProgress.reduce((s, w) => s + w.workoutCount, 0), color: '#60a5fa' },
                { label: 'Объём', value: diaryProgress.length > 0 ? `${(diaryProgress[diaryProgress.length - 1]?.totalVolume / 1000).toFixed(1)}т` : '—', color: '#f59e0b' },
                { label: 'ACWR', value: (() => { try { const s = loadSRPESessions(); if (s.length < 2) return '—'; return acuteChronicRatio(toDailyLoads(s)).ratio.toFixed(2); } catch { return '—'; } })(), color: '#22c55e' },
              ].map((s, i) => <div key={i} style={{ flex: 1, background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 4px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{s.label}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: s.color }}>{s.value}</div>
              </div>)}
            </div>
            {/* Heatmap — redesigned with month labels + tooltips */}
            {historyWorkouts.length > 0 && (() => {
              const byDay: Record<string, number> = {};
              historyWorkouts.forEach((w: any) => { byDay[w.date] = (byDay[w.date] || 0) + (w.exercises || []).reduce((s: number, e: any) => s + (e.totalVolume || 0), 0); });
              const cells: { date: string; vol: number; dayOfWeek: number }[] = [];
              const today = new Date();
              for (let i = 83; i >= 0; i--) {
                const d = new Date(today); d.setDate(d.getDate() - i);
                cells.push({ date: d.toISOString().slice(0, 10), vol: byDay[d.toISOString().slice(0, 10)] || 0, dayOfWeek: (d.getDay() + 6) % 7 });
              }
              const maxVol = Math.max(1, ...cells.map(c => c.vol));
              const heatColor = (v: number) => {
                if (v === 0) return 'rgba(255,255,255,0.04)';
                const t = v / maxVol;
                if (t < 0.25) return 'rgba(0,230,138,0.2)';
                if (t < 0.5) return 'rgba(0,230,138,0.4)';
                if (t < 0.75) return 'rgba(0,230,138,0.65)';
                return 'rgba(0,230,138,0.9)';
              };
              // Group by weeks (columns)
              const weeks: { date: string; vol: number; dayOfWeek: number }[][] = [];
              for (let w = 0; w < 12; w++) weeks.push(cells.slice(w * 7, w * 7 + 7));
              // Month labels: find first day of each week column
              const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
              const monthLabels: { week: number; label: string }[] = [];
              let lastMonth = -1;
              weeks.forEach((wk, wi) => {
                if (wk.length > 0) {
                  const m = new Date(wk[0].date).getMonth();
                  if (m !== lastMonth) { monthLabels.push({ week: wi, label: monthNames[m] }); lastMonth = m; }
                }
              });
              return (
                <div style={{ marginBottom: 8, padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: 6 }}>🔥 Тепловая карта (12 нед)</div>
                  {/* Month labels row */}
                  <div style={{ display: 'flex', gap: 3, marginBottom: 2 }}>
                    {weeks.map((_, wi) => {
                      const ml = monthLabels.find(m => m.week === wi);
                      return <div key={wi} style={{ flex: 1, fontSize: 8, color: ml ? 'rgba(255,255,255,0.45)' : 'transparent', fontWeight: ml ? 600 : 400, textAlign: 'center' }}>{ml?.label || ''}</div>;
                    })}
                  </div>
                  {/* Day labels + grid */}
                  <div style={{ display: 'flex', gap: 3 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginRight: 2 }}>
                      {['Пн', '', 'Ср', '', 'Пт', '', 'Вс'].map((d, i) => (
                        <div key={i} style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)', height: 12, display: 'flex', alignItems: 'center' }}>{d}</div>
                      ))}
                    </div>
                    {weeks.map((wk, wi) => (
                      <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
                        {wk.map((c, di) => (
                          <div key={di} title={`${c.date}${c.vol > 0 ? ': ' + Math.round(c.vol) + ' кг' : ''}`}
                            style={{ height: 12, borderRadius: 2, background: heatColor(c.vol), transition: 'background 0.2s' }} />
                        ))}
                      </div>
                    ))}
                  </div>
                  {/* Legend */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', marginTop: 6, fontSize: 8, color: 'rgba(255,255,255,0.35)' }}>
                    <span>меньше</span>
                    {[0.1, 0.3, 0.5, 0.8].map((t, i) => (
                      <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: heatColor(maxVol * t) }} />
                    ))}
                    <span>больше</span>
                  </div>
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
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>📈 Тоннаж по неделям</div>
              <div style={{ display: 'flex', gap: 2, height: 50, alignItems: 'flex-end' }}>
                {diaryProgress.slice(-12).map((w, i) => {
                  const maxVol2 = Math.max(...diaryProgress.map(w2 => w2.totalVolume), 1);
                  const h = Math.max(4, (w.totalVolume / maxVol2) * 100);
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                      <div style={{ width: '70%', height: `${h}%`, background: w.totalVolume === maxVol2 ? 'var(--accent)' : 'rgba(0,230,138,0.3)', borderRadius: '2px 2px 0 0' }} />
                      <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{w.week}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Exercise progress mini-charts */}
            {historyWorkouts.length >= 2 && (() => {
              const byEx: Record<string, { date: string; e1rm: number }[]> = {};
              historyWorkouts.forEach((w: any) => (w.exercises || []).forEach((e: any) => {
                const best = (e.sets || []).reduce((m: number, s: any) => Math.max(m, epley1RM(s.weight || 0, s.reps || 0)), 0);
                if (best <= 0) return;
                const name = e.exerciseName || e.exerciseId || '—';
                (byEx[name] = byEx[name] || []).push({ date: w.date, e1rm: Math.round(best) });
              }));
              const topEx = Object.entries(byEx)
                .filter(([, arr]) => arr.length >= 2)
                .sort((a, b) => b[1].length - a[1].length)
                .slice(0, 4);
              if (topEx.length === 0) return null;
              return (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>📈 Прогресс e1RM по упражнениям</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {topEx.map(([name, arr]) => {
                      const sorted = arr.sort((a, b) => a.date.localeCompare(b.date));
                      const latest = sorted[sorted.length - 1].e1rm;
                      const prev = sorted.length >= 2 ? sorted[sorted.length - 2].e1rm : latest;
                      const delta = prev > 0 ? Math.round((latest - prev) / prev * 100) : 0;
                      return (
                        <div key={name} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '4px 6px' }}>
                          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Sparkline data={sorted.map(p => p.e1rm)} width={40} height={14} color={delta >= 0 ? '#22c55e' : '#ef4444'} showDots={false} />
                            <span style={{ fontSize: 10, fontWeight: 700, color: delta >= 0 ? '#22c55e' : '#ef4444' }}>
                              {latest}кг {delta !== 0 && <span style={{ fontSize: 8 }}>{delta > 0 ? '+' : ''}{delta}%</span>}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
            {/* Muscle recovery estimate */}
            {historyWorkouts.length >= 2 && (() => {
              const lastTrained: Record<string, string> = {};
              const sorted = [...historyWorkouts].sort((a, b) => b.date.localeCompare(a.date));
              sorted.forEach(w => (w.exercises || []).forEach((e: any) => {
                const cat = EXERCISE_CATALOG.find((c: any) => c.id === e.exerciseId);
                const group = cat?.group;
                if (group && !lastTrained[group]) lastTrained[group] = w.date;
              }));
              const today = new Date().toISOString().slice(0, 10);
              const groups = Object.entries(lastTrained)
                .map(([g, date]) => {
                  const days = Math.floor((new Date(today).getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
                  return { group: g, days, date };
                })
                .sort((a, b) => b.days - a.days)
                .slice(0, 6);
              if (groups.length === 0) return null;
              return (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>💚 Восстановление мышц</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                    {groups.map(({ group, days }) => {
                      const ready = days >= 4;
                      const color = days >= 7 ? '#22c55e' : days >= 4 ? '#f59e0b' : '#ef4444';
                      return (
                        <div key={group} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.02)' }}>
                          <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{GRP_RU[group] || group}</span>
                          <span style={{ fontSize: 10, fontWeight: 600, color }}>{days}д {ready ? '✓' : '⏳'}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
            {/* Muscle volume trend over 8 weeks */}
            {historyWorkouts.length >= 6 && (() => {
              const weeks = 8;
              const today = new Date();
              const GROUP_COLORS: Record<string, string> = { chest: '#ef4444', back: '#3b82f6', shoulders: '#f59e0b', quads: '#22c55e', hamstrings: '#10b981', biceps: '#a855f7', triceps: '#60a5fa', core: '#f97316' };
              const weekGroupVol: { week: string; groups: Record<string, number> }[] = [];
              for (let w = weeks - 1; w >= 0; w--) {
                const ws = new Date(today); ws.setDate(ws.getDate() - (w + 1) * 7);
                const we = new Date(today); we.setDate(we.getDate() - w * 7);
                const wos = historyWorkouts.filter(wo => { const d = new Date(wo.date); return d > ws && d <= we; });
                const groups: Record<string, number> = {};
                wos.forEach(wo => (wo.exercises || []).forEach((e: any) => {
                  const cat = EXERCISE_CATALOG.find((c: any) => c.id === e.exerciseId);
                  const g = cat?.group || 'core';
                  groups[g] = (groups[g] || 0) + (e.sets?.length || 0);
                }));
                weekGroupVol.push({ week: `Н${weeks - w}`, groups });
              }
              const topGroups = Object.entries(weekGroupVol.reduce((acc, wg) => {
                Object.entries(wg.groups).forEach(([g, v]) => { acc[g] = (acc[g] || 0) + v; });
                return acc;
              }, {} as Record<string, number>)).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([g]) => g);
              if (topGroups.length === 0) return null;
              const maxTotal = Math.max(1, ...weekGroupVol.map(wg => topGroups.reduce((s, g) => s + (wg.groups[g] || 0), 0)));
              return (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>📊 Объём по группам (нед)</div>
                  <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 50 }}>
                    {weekGroupVol.map((wg, wi) => {
                      const total = topGroups.reduce((s, g) => s + (wg.groups[g] || 0), 0);
                      const h = Math.max(2, (total / maxTotal) * 46);
                      let accH = 0;
                      return (
                        <div key={wi} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, position: 'relative' }}>
                          <div style={{ width: '100%', height: h, borderRadius: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column-reverse' }}>
                            {topGroups.map(g => {
                              const v = wg.groups[g] || 0;
                              const segH = total > 0 ? (v / total) * h : 0;
                              return <div key={g} style={{ height: segH, background: GROUP_COLORS[g] || '#888', opacity: 0.8 }} />;
                            })}
                          </div>
                          <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>{wg.week}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    {topGroups.map(g => <span key={g} style={{ fontSize: 8, color: GROUP_COLORS[g] || '#888' }}>● {GRP_RU[g] || g}</span>)}
                  </div>
                </div>
              );
            })()}
            {/* Duration trend */}
            {historyWorkouts.length >= 4 && (() => {
              const durations = historyWorkouts.slice(-12).map(w => w.duration || 0).filter(d => d > 0);
              if (durations.length < 3) return null;
              const avgDuration = Math.round(durations.reduce((s, d) => s + d, 0) / durations.length);
              const lastDur = durations[durations.length - 1];
              const firstDur = durations[0];
              const durDelta = firstDur > 0 ? Math.round(((lastDur - firstDur) / firstDur) * 100) : 0;
              return (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>⏱ Длительность сессий</span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>avg {avgDuration} мин</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sparkline data={durations} width={80} height={18} color="#60a5fa" />
                    <span style={{ fontSize: 10, fontWeight: 600, color: durDelta > 10 ? '#f59e0b' : durDelta < -10 ? '#22c55e' : 'rgba(255,255,255,0.4)' }}>
                      {durDelta > 0 ? '+' : ''}{durDelta}%
                    </span>
                  </div>
                </div>
              );
            })()}
            {/* Session quality score trend */}
            {historyWorkouts.length >= 4 && (() => {
              const recent = historyWorkouts.slice(-10);
              const scores = recent.map(w => {
                const exCount = w.exercises.length;
                const totalSets = w.exercises.reduce((s: number, e: any) => s + (e.sets?.length || 0), 0);
                const completedSets = w.exercises.reduce((s: number, e: any) => s + (e.sets || []).filter((st: any) => st.completed || (st.weight > 0 && st.reps > 0)).length, 0);
                const completionRate = totalSets > 0 ? completedSets / totalSets : 0;
                const rpe = w.overallRPE || 7;
                const rpeScore = rpe >= 7 && rpe <= 8.5 ? 1.0 : rpe < 7 ? 0.7 : rpe > 9 ? 0.6 : 0.85;
                const volumeScore = Math.min(totalSets / 20, 1);
                return Math.round((completionRate * 40 + rpeScore * 30 + volumeScore * 30));
              });
              const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
              const trend = scores[scores.length - 1] > scores[0];
              return (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>⭐ Качество сессий</span>
                    <span style={{ fontSize: 10, color: avg >= 70 ? '#22c55e' : avg >= 50 ? '#f59e0b' : '#ef4444' }}>{Math.round(avg)}%</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sparkline data={scores} width={80} height={18} color={avg >= 70 ? '#22c55e' : '#f59e0b'} />
                    <span style={{ fontSize: 10, color: trend ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                      {trend ? '↑ растёт' : '↓ падает'}
                    </span>
                  </div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>выполнение + RPE + объём</div>
                </div>
              );
            })()}
          </div>
          {/* Week-to-week comparison card */}
          {groupedHistory.length >= 2 && (() => {
            const [curWeek, curWorkouts] = groupedHistory[0];
            const [prevWeek, prevWorkouts] = groupedHistory[1];
            const curVol = curWorkouts.reduce((s, w) => s + w.exercises.reduce((sum, e) => sum + e.totalVolume, 0), 0);
            const prevVol = prevWorkouts.reduce((s, w) => s + w.exercises.reduce((sum, e) => sum + e.totalVolume, 0), 0);
            const curSets = curWorkouts.reduce((s, w) => s + w.exercises.reduce((sum, e) => sum + (e.sets?.length || 0), 0), 0);
            const prevSets = prevWorkouts.reduce((s, w) => s + w.exercises.reduce((sum, e) => sum + (e.sets?.length || 0), 0), 0);
            const volPct = prevVol > 0 ? Math.round((curVol - prevVol) / prevVol * 100) : 0;
            const setsPct = prevSets > 0 ? Math.round((curSets - prevSets) / prevSets * 100) : 0;
            const exNames = new Set<string>();
            curWorkouts.forEach(w => w.exercises.forEach((e: any) => exNames.add(e.exerciseName || e.exerciseId)));
            const prevExNames = new Set<string>();
            prevWorkouts.forEach(w => w.exercises.forEach((e: any) => prevExNames.add(e.exerciseName || e.exerciseId)));
            const newExercises = [...exNames].filter(n => !prevExNames.has(n));
            return (
              <div style={{ ...style.card, marginBottom: 6 }}>
                <div style={style.label}>📊 {curWeek} vs {prevWeek}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 10 }}>
                  <div>
                    <div style={{ color: 'var(--text-dim)' }}>Объём</div>
                    <div style={{ fontWeight: 700, color: volPct >= 0 ? '#22c55e' : '#ef4444' }}>
                      {volPct >= 0 ? '+' : ''}{volPct}% <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>({(curVol / 1000).toFixed(1)}т vs {(prevVol / 1000).toFixed(1)}т)</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-dim)' }}>Сеты</div>
                    <div style={{ fontWeight: 700, color: setsPct >= 0 ? '#22c55e' : '#ef4444' }}>
                      {setsPct >= 0 ? '+' : ''}{setsPct}% <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>({curSets} vs {prevSets})</span>
                    </div>
                  </div>
                </div>
                {newExercises.length > 0 && (
                  <div style={{ marginTop: 4, fontSize: 10, color: '#f59e0b' }}>🆕 Новые: {newExercises.slice(0, 3).join(', ')}{newExercises.length > 3 ? ` +${newExercises.length - 3}` : ''}</div>
                )}
              </div>
            );
          })()}
          {/* Search + group filter + exercise filter */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Поиск по неделе..." style={{ ...style.input, flex: 2 }} />
            <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)}
              style={{ ...style.input, flex: 1, padding: '6px 4px' }}>
              <option value="all">Все группы</option>
              {Object.entries(GRP_RU).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {allExerciseNames.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <input type="text" value={historyExerciseFilter} onChange={e => setHistoryExerciseFilter(e.target.value)}
                placeholder="🏋️ Фильтр по упражнению..." list="exerciseSearchList"
                style={{ ...style.input, width: '100%' }} />
              <datalist id="exerciseSearchList">
                {allExerciseNames.slice(0, 30).map(n => <option key={n} value={n} />)}
              </datalist>
            </div>
          )}
          {groupedHistory.some(([, ws]) => ws.some(w => w.notes)) && (
            <div style={{ marginBottom: 6 }}>
              <input type="text" value={notesFilter} onChange={e => setNotesFilter(e.target.value)}
                placeholder="📝 Фильтр по заметкам/сплиту..."
                style={{ ...style.input, width: '100%' }} />
            </div>
          )}
          {filteredHistory.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6, gap: 6 }}>
              <button onClick={() => setHistoryExpanded('__all__')} style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>▾ Развернуть все</button>
              <button onClick={() => setHistoryExpanded(null)} style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>▸ Свернуть все</button>
            </div>
          )}
          {/* Exercise-specific stats when filtered */}
          {historyExerciseFilter && filteredHistoryWorkouts.length > 0 && (() => {
            const q = historyExerciseFilter.toLowerCase();
            const exSessions = filteredHistoryWorkouts.flatMap(w => w.exercises.filter((e: any) => (e.exerciseName || '').toLowerCase().includes(q)));
            const totalVol = exSessions.reduce((s, e) => s + (e.totalVolume || 0), 0);
            const bestE1RM = Math.max(0, ...exSessions.map((e: any) => e.estimated1RM || 0));
            const totalSets = exSessions.reduce((s, e) => s + (e.sets?.length || 0), 0);
            const latestE1RM = exSessions[exSessions.length - 1]?.estimated1RM || 0;
            const prevE1RM = exSessions.length >= 2 ? exSessions[exSessions.length - 2]?.estimated1RM || 0 : latestE1RM;
            const delta = prevE1RM > 0 ? Math.round(((latestE1RM - prevE1RM) / prevE1RM) * 100) : 0;
            return (
              <div style={style.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={style.label}>🏋️ {historyExerciseFilter}</div>
                  <button onClick={() => setHistoryExerciseFilter('')} style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer' }}>✕ сброс</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, fontSize: 10 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: 'var(--text-dim)' }}>Объём</div>
                    <div style={{ fontWeight: 700, color: ACCENT }}>{(totalVol / 1000).toFixed(1)}т кг</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: 'var(--text-dim)' }}>Лучший e1RM</div>
                    <div style={{ fontWeight: 700, color: '#f59e0b' }}>{Math.round(bestE1RM)} кг</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: 'var(--text-dim)' }}>Сетов</div>
                    <div style={{ fontWeight: 700, color: '#60a5fa' }}>{totalSets}</div>
                  </div>
                </div>
                {delta !== 0 && (
                  <div style={{ fontSize: 10, textAlign: 'center', marginTop: 4, color: delta > 0 ? '#22c55e' : '#ef4444' }}>
                    {delta > 0 ? '↑' : '↓'} {Math.abs(delta)}% к предыдущему e1RM
                  </div>
                )}
              </div>
            );
          })()}
          {filteredHistory.map(([week, workouts], wi) => (
            <WorkoutWeekCard
              key={week}
              weekLabel={week}
              workouts={workouts}
              prevWorkouts={wi < filteredHistory.length - 1 ? filteredHistory[wi + 1][1] : undefined}
              expanded={historyExpanded === '__all__' || historyExpanded === week}
              onToggle={() => setHistoryExpanded(prev => prev === week ? null : week)}
            />
          ))}
          {filteredHistory.length === 0 && (
            <div style={{ ...style.card, textAlign: 'center', padding: 24 }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>📜</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{search || historyExerciseFilter ? 'Ничего не найдено' : 'Нет тренировок. Запишите первую во вкладке «Запись».'}</div>
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
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Объём/нед</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: ACCENT }}>{analytics.volume.weeklyVolumeKg.toLocaleString()} кг</div>
                  <div style={{ fontSize: 10, color: analytics.volume.volumeTrend >= 0 ? '#22c55e' : '#ef4444' }}>
                    {analytics.volume.volumeTrend >= 0 ? '↑' : '↓'} {Math.abs(analytics.volume.volumeTrend)}% vs пред.
                  </div>
                </div>
                <div style={style.card}>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Интенсивность</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#60a5fa' }}>{analytics.intensity.avgIntensity}%</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>RPE avg: {analytics.intensity.avgRPE}</div>
                </div>
                <div style={style.card}>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Усталость</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: analytics.fatigue.weeklyFatigue > 0.7 ? '#ef4444' : analytics.fatigue.weeklyFatigue > 0.4 ? '#f59e0b' : '#22c55e' }}>
                    {Math.round(analytics.fatigue.weeklyFatigue * 100)}%
                  </div>
                </div>
                <div style={style.card}>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Готовность</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: analytics.recovery.readinessEstimate > 60 ? '#22c55e' : analytics.recovery.readinessEstimate > 40 ? '#f59e0b' : '#ef4444' }}>
                    {analytics.recovery.readinessEstimate}%
                  </div>
                </div>
              </div>
              {/* Bodyweight overlay on volume trend */}
              {measurements.length >= 2 && historyWorkouts.length >= 4 && (() => {
                const sorted = [...historyWorkouts].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                const weeklyVol: { week: string; vol: number }[] = [];
                const weekMap = new Map<string, number>();
                sorted.forEach(w => {
                  const d = new Date(w.date);
                  const wkStart = new Date(d); wkStart.setDate(d.getDate() - d.getDay());
                  const key = wkStart.toISOString().slice(0, 10);
                  weekMap.set(key, (weekMap.get(key) || 0) + w.exercises.reduce((s: number, e: any) => s + e.totalVolume, 0));
                });
                weekMap.forEach((vol, week) => weeklyVol.push({ week, vol }));
                const last12 = weeklyVol.slice(-12);
                const weights = measurements.slice(-12).map((m: any) => m.weightKg || 0).filter(Boolean);
                if (last12.length < 3 || weights.length < 2) return null;
                const volMax = Math.max(...last12.map(w => w.vol), 1);
                const wMin = Math.min(...weights) - 2;
                const wMax = Math.max(...weights) + 2;
                const ww = 300; const h = 50;
                return (
                  <div style={style.card}>
                    <div style={style.label}>⚖️ Объём + вес тела</div>
                    <svg width="100%" viewBox={`0 0 ${ww} ${h}`} style={{ display: 'block' }}>
                      {last12.map((w, i) => {
                        const bh = (w.vol / volMax) * (h - 4);
                        return <rect key={i} x={(i / last12.length) * ww + 2} y={h - bh - 2} width={Math.max(2, ww / last12.length - 4)} height={bh} rx={2} fill="rgba(0,230,138,0.25)" />;
                      })}
                      {weights.length >= 2 && <polyline points={weights.map((w, i) => `${((i / (weights.length - 1)) * ww)},${h - ((w - wMin) / (wMax - wMin)) * (h - 4) - 2}`).join(' ')} fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeLinejoin="round" />}
                    </svg>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2, fontSize: 8, color: 'rgba(255,255,255,0.25)' }}>
                      <span>🟢 объём (кг)</span><span>🟡 вес тела ({weights[0]}→{weights[weights.length - 1]}кг)</span>
                    </div>
                  </div>
                );
              })()}
              {/* Week-over-week comparison */}
              {historyWorkouts.length >= 2 && (() => {
                const sorted = [...historyWorkouts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                const now = new Date();
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
                const thisWeek = sorted.filter(w => new Date(w.date) >= weekAgo);
                const lastWeek = sorted.filter(w => { const d = new Date(w.date); return d >= twoWeeksAgo && d < weekAgo; });
                if (thisWeek.length === 0 || lastWeek.length === 0) return null;
                const twVol = thisWeek.reduce((s, w) => s + w.exercises.reduce((sum, e) => sum + e.totalVolume, 0), 0);
                const lwVol = lastWeek.reduce((s, w) => s + w.exercises.reduce((sum, e) => sum + e.totalVolume, 0), 0);
                const twSets = thisWeek.reduce((s, w) => s + w.exercises.reduce((sum, e) => sum + e.sets.length, 0), 0);
                const lwSets = lastWeek.reduce((s, w) => s + w.exercises.reduce((sum, e) => sum + e.sets.length, 0), 0);
                const twWorkouts = thisWeek.length;
                const lwWorkouts = lastWeek.length;
                const volDelta = lwVol > 0 ? Math.round((twVol - lwVol) / lwVol * 100) : 0;
                const setsDelta = lwSets > 0 ? Math.round((twSets - lwSets) / lwSets * 100) : 0;
                return (
                  <div style={style.card}>
                    <div style={style.label}>📊 Неделя vs предыдущая</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Тренировок</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{twWorkouts} <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>vs {lwWorkouts}</span></div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Тоннаж</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: volDelta >= 0 ? '#22c55e' : '#ef4444' }}>
                          {volDelta >= 0 ? '+' : ''}{volDelta}%
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Подходы</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: setsDelta >= 0 ? '#22c55e' : '#ef4444' }}>
                          {setsDelta >= 0 ? '+' : ''}{setsDelta}%
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
              {/* Intensity distribution */}
              <div style={style.card}>
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Распределение нагрузки</div>
                <div style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden', marginBottom: 4 }}>
                  <div style={{ width: `${analytics.intensity.intensityDistribution.strength}%`, background: '#ef4444' }} />
                  <div style={{ width: `${analytics.intensity.intensityDistribution.hypertrophy}%`, background: '#f59e0b' }} />
                  <div style={{ width: `${analytics.intensity.intensityDistribution.endurance}%`, background: '#22c55e' }} />
                </div>
                <div style={{ display: 'flex', gap: 10, fontSize: 10, color: 'var(--text-dim)' }}>
                  <span>🔴 Сила {analytics.intensity.intensityDistribution.strength}%</span>
                  <span>🟠 Гипертрофия {analytics.intensity.intensityDistribution.hypertrophy}%</span>
                  <span>🟢 Выносливость {analytics.intensity.intensityDistribution.endurance}%</span>
                </div>
              </div>
              {/* Volume by group stacked bars */}
              {totals.some(t => t > 0) && (
                <div style={style.card}>
                  <div style={style.label}>📊 Объём по неделям (сеты)</div>
                  {/* MRV reference: avg ~20 sets/week for large groups */}
                  <div style={{ position: 'relative', height: 100, marginBottom: 4 }}>
                    {/* MRV reference line */}
                    {totals.some(t => t > 0) && (() => {
                      const maxT = Math.max(...totals, 1);
                      const mrvPct = Math.min((20 / maxT) * 100, 95);
                      return <div style={{ position: 'absolute', left: 0, right: 0, bottom: `${mrvPct}%`, height: 1, background: 'rgba(239,68,68,0.4)', zIndex: 1 }}>
                        <span style={{ position: 'absolute', right: 0, top: -8, fontSize: 8, color: 'rgba(239,68,68,0.6)' }}>MRV</span>
                      </div>;
                    })()}
                    <div style={{ display: 'flex', gap: 2, height: '100%', alignItems: 'flex-end' }}>
                      {totals.map((t, wi) => (
                        <div key={wi} style={{ flex: 1, display: 'flex', flexDirection: 'column-reverse', height: '100%', borderRadius: 3, overflow: 'visible', background: t > 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                          {groups.map(g => {
                            const v = wsg[g]?.[wi] || 0;
                            if (v === 0) return null;
                            return <div key={g} style={{ flex: v, background: GROUP_COLORS[g] || '#888', minHeight: 2, borderRadius: 1, cursor: 'pointer', position: 'relative' }}
                              onMouseEnter={e => setBarTooltip({ group: g, sets: v, week: wi + 1, x: e.clientX, y: e.clientY })}
                              onMouseLeave={() => setBarTooltip(null)}
                            />;
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Week labels */}
                  <div style={{ display: 'flex', gap: 2, marginBottom: 6 }}>
                    {totals.map((_, wi) => <span key={wi} style={{ flex: 1, textAlign: 'center', fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>Н{wi + 1}</span>)}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>
                    {groups.filter(g => (wsg[g]?.reduce((s: number, x: number) => s + x, 0) || 0) > 0).map(g => (
                      <span key={g} style={{ display: 'flex', alignItems: 'center', gap: 2 }}><span style={{ width: 6, height: 6, borderRadius: 1, background: GROUP_COLORS[g] || '#888', display: 'inline-block' }} />{GRP_RU[g] || g}</span>
                    ))}
                  </div>
                  {/* Tooltip */}
                  {barTooltip && (
                    <div style={{ position: 'fixed', left: barTooltip.x + 8, top: barTooltip.y - 30, background: '#18181b', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, padding: '4px 8px', fontSize: 10, color: '#fff', zIndex: 9999, pointerEvents: 'none', whiteSpace: 'nowrap' }}>
                      <span style={{ color: GROUP_COLORS[barTooltip.group] || '#888', fontWeight: 700 }}>{GRP_RU[barTooltip.group] || barTooltip.group}</span>
                      <span style={{ marginLeft: 6, color: 'rgba(255,255,255,0.6)' }}>Н{barTooltip.week}: {barTooltip.sets} сетов</span>
                    </div>
                  )}
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
                      <span style={{ fontSize: 10, color: 'var(--text-dim)', width: 50 }}>{Math.round(v).toLocaleString()} кг</span>
                    </div>
                  );
                })}
              </div>
              {/* Muscle balance */}
              {historyWorkouts.length >= 2 && (() => {
                const volByGroup: Record<string, number> = {};
                const recent = historyWorkouts.slice(-8);
                recent.forEach(w => w.exercises.forEach((e: any) => {
                  const cat = EXERCISE_CATALOG.find((c: any) => c.id === e.exerciseId);
                  const group = cat?.group || 'other';
                  volByGroup[group] = (volByGroup[group] || 0) + (e.totalVolume || 0);
                }));
                const groups = Object.keys(volByGroup);
                if (groups.length < 3) return null;
                const maxVol4 = Math.max(...Object.values(volByGroup), 1);
                const avgVol = Object.values(volByGroup).reduce((s, v) => s + v, 0) / groups.length;
                return (
                  <div style={style.card}>
                    <div style={style.label}>⚖️ Баланс мышц</div>
                    <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 4 }}>средний объём: {Math.round(avgVol).toLocaleString()} кг</div>
                    {groups.sort((a, b) => volByGroup[b] - volByGroup[a]).slice(0, 8).map(g => {
                      const v = volByGroup[g];
                      const ratio = v / avgVol;
                      const color = ratio > 1.3 ? '#ef4444' : ratio > 1.1 ? '#f59e0b' : ratio < 0.5 ? '#ef4444' : ratio < 0.7 ? '#f59e0b' : '#22c55e';
                      const label = ratio > 1.3 ? 'перегруз' : ratio > 1.1 ? 'выше нормы' : ratio < 0.5 ? 'недогруз' : ratio < 0.7 ? 'ниже нормы' : 'ok';
                      return (
                        <div key={g} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                          <span style={{ width: 70, fontSize: 10, color: 'var(--text-dim)', textAlign: 'right' }}>{GRP_RU[g] || g}</span>
                          <div style={{ flex: 1, height: 6, borderRadius: 4, background: 'rgba(255,255,255,0.05)', overflow: 'hidden', position: 'relative' }}>
                            <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.15)' }} />
                            <div style={{ width: `${Math.min((v / maxVol4) * 100, 100)}%`, height: '100%', background: color, borderRadius: 4, opacity: 0.8 }} />
                          </div>
                          <span style={{ fontSize: 9, color, width: 60, textAlign: 'right' }}>{label}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
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
              {/* PR history */}
              {historyWorkouts.length >= 2 && (() => {
                const prMap = new Map<string, { name: string; weight: number; reps: number; e1rm: number; date: string }>();
                const sorted = [...historyWorkouts].sort((a, b) => a.date.localeCompare(b.date));
                sorted.forEach(w => (w.exercises || []).forEach((e: any) => {
                  (e.sets || []).forEach((s: any) => {
                    const e1rm = epley1RM(s.weight || 0, s.reps || 0);
                    if (e1rm <= 0) return;
                    const name = e.exerciseName || e.exerciseId;
                    const prev = prMap.get(name);
                    if (!prev || e1rm > prev.e1rm) {
                      prMap.set(name, { name, weight: s.weight || 0, reps: s.reps || 0, e1rm: Math.round(e1rm), date: w.date });
                    }
                  });
                }));
                const prs = Array.from(prMap.values()).sort((a, b) => b.e1rm - a.e1rm).slice(0, 10);
                if (prs.length === 0) return null;
                return (
                  <div style={style.card}>
                    <div style={style.label}>🏆 Личные рекорды</div>
                    {prs.map((pr, i) => (
                      <div key={pr.name + i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3, fontSize: 10 }}>
                        <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span style={{ color: 'rgba(255,255,255,0.4)', marginRight: 4 }}>#{i + 1}</span>
                          <span style={{ color: 'var(--text-dim)' }}>{pr.name}</span>
                        </div>
                        <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <strong style={{ color: ACCENT }}>{pr.weight}кг×{pr.reps}</strong>
                          <span style={{ marginLeft: 4, color: 'rgba(255,255,255,0.3)' }}>e1RM {pr.e1rm}</span>
                          <span style={{ marginLeft: 6, fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>{pr.date.slice(5)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
              {/* Fatigue metrics */}
              <div style={style.card}>
                <div style={style.label}>Метрики усталости</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, fontSize: 10 }}>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '4px 6px', textAlign: 'center' }}>
                    <div style={{ color: 'var(--text-dim)', fontSize: 10 }}>Монотонность</div>
                    <div style={{ fontWeight: 700, color: analytics.fatigue.monotony > 2 ? '#ef4444' : ACCENT }}>{analytics.fatigue.monotony.toFixed(1)}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '4px 6px', textAlign: 'center' }}>
                    <div style={{ color: 'var(--text-dim)', fontSize: 10 }}>Напряжение</div>
                    <div style={{ fontWeight: 700, color: analytics.fatigue.strain > 300 ? '#ef4444' : ACCENT }}>{Math.round(analytics.fatigue.strain)}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '4px 6px', textAlign: 'center' }}>
                    <div style={{ color: 'var(--text-dim)', fontSize: 10 }}>ЦНС</div>
                    <div style={{ fontWeight: 700, color: analytics.fatigue.cnsFatigue > 0.7 ? '#ef4444' : ACCENT }}>{Math.round(analytics.fatigue.cnsFatigue * 100)}%</div>
                  </div>
                </div>
              </div>
              {/* Overtraining risk */}
              {historyWorkouts.length >= 4 && (() => {
                const recent = historyWorkouts.slice(-8);
                const monotony = analytics.fatigue.monotony;
                const strain = analytics.fatigue.strain;
                const cns = analytics.fatigue.cnsFatigue;
                const weeklyFatigue = analytics.fatigue.weeklyFatigue;
                const risks: string[] = [];
                let level: 'low' | 'moderate' | 'high' = 'low';
                if (monotony > 2.0) { risks.push('Монотонность > 2.0 — высокий риск перетренированности (Stone 2007)'); level = 'high'; }
                if (monotony > 1.5 && monotony <= 2.0) { risks.push('Монотонность 1.5-2.0 — следите за восстановлением'); level = 'moderate'; }
                if (strain > 300) { risks.push('Напряжение > 300 — критическая нагрузка на ЦНС'); level = 'high'; }
                if (cns > 0.7) { risks.push('ЦНС усталость > 70% — рекомендуется разгрузка'); if (level !== 'high') level = 'moderate'; }
                if (weeklyFatigue > 0.7) { risks.push('Еженедельная усталость > 70% — снижьте интенсивность'); if (level !== 'high') level = 'moderate'; }
                const deloadWeeks = recent.filter(w => {
                  const vol = w.exercises.reduce((s, e) => s + e.sets.length, 0);
                  return vol < 20;
                }).length;
                if (deloadWeeks === 0 && recent.length >= 4) { risks.push('Нет разгрузочных недель за 8 недель'); if (level !== 'high') level = 'moderate'; }
                if (risks.length === 0) return null;
                return (
                  <div style={{ ...style.card, border: `1px solid ${level === 'high' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`, background: level === 'high' ? 'rgba(239,68,68,0.05)' : 'rgba(245,158,11,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <span style={{ fontSize: 14 }}>{level === 'high' ? '🚨' : '⚠️'}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: level === 'high' ? '#ef4444' : '#f59e0b' }}>
                        Риск перетренированности: {level === 'high' ? 'высокий' : 'умеренный'}
                      </span>
                    </div>
                    {risks.map((r, i) => (
                      <div key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginBottom: 3, paddingLeft: 8, borderLeft: `2px solid ${level === 'high' ? 'rgba(239,68,68,0.4)' : 'rgba(245,158,11,0.4)'}` }}>• {r}</div>
                    ))}
                    {level === 'high' && (
                      <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', fontSize: 10, color: '#ef4444' }}>
                        Рекомендация: 3-5 дней активного восстановления, снижение объёма на 40-60%
                      </div>
                    )}
                  </div>
                );
              })()}
              {/* Deload recommendation */}
              {historyWorkouts.length >= 8 && (() => {
                const recent8 = historyWorkouts.slice(-8);
                const volumes = recent8.map(w => w.exercises.reduce((s: number, e: any) => s + (e.sets?.length || 0), 0));
                const avgVol = volumes.reduce((s, v) => s + v, 0) / volumes.length;
                const trend = volumes.slice(-3).reduce((s, v) => s + v, 0) / 3;
                const isRising = trend > avgVol * 1.15;
                const weeksSinceDeload = recent8.filter(w => {
                  const vol = w.exercises.reduce((s: number, e: any) => s + (e.sets?.length || 0), 0);
                  return vol >= avgVol * 0.7;
                }).length;
                const needsDeload = weeksSinceDeload >= 4 && isRising;
                if (!needsDeload) return null;
                return (
                  <div style={{ ...style.card, border: '1px solid rgba(96,165,250,0.3)', background: 'rgba(96,165,250,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 14 }}>📉</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa' }}>Рекомендация: разгрузочная неделя</span>
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
                      {weeksSinceDeload} недель подряд без снижения объёма. Тренд объёма растёт ({Math.round(trend)} → {Math.round(avgVol)} сетов). Рекомендуется неделя объёмом ~50% ({Math.round(avgVol * 0.5)} сетов) с RIR 3-4.
                    </div>
                    <div style={{ marginTop: 6, padding: '4px 8px', borderRadius: 6, background: 'rgba(96,165,250,0.08)', fontSize: 9, color: '#60a5fa' }}>
                      Пример: снизить веса на 10-15%, увеличить RIR до 3-4, убрать изолирующие упражнения
                    </div>
                  </div>
                );
              })()}
              {/* RPE trend */}
              {historyWorkouts.length >= 4 && (() => {
                const rpes = historyWorkouts.slice(-12).map(w => w.overallRPE || 0).filter(r => r > 0);
                if (rpes.length < 3) return null;
                const avgRPE = rpes.reduce((s, r) => s + r, 0) / rpes.length;
                const lastRPE = rpes[rpes.length - 1];
                const trend = lastRPE > avgRPE * 1.15 ? 'high' : lastRPE < avgRPE * 0.85 ? 'low' : 'normal';
                const trendLabel = trend === 'high' ? '⚠ выше нормы' : trend === 'low' ? '✓ ниже нормы' : 'в норме';
                const trendColor = trend === 'high' ? '#ef4444' : trend === 'low' ? '#22c55e' : 'rgba(255,255,255,0.4)';
                return (
                  <div style={style.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={style.label}>📊 RPE по сессиям</div>
                      <span style={{ fontSize: 9, color: trendColor }}>{trendLabel}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Sparkline data={rpes} width={100} height={24} color={trend === 'high' ? '#ef4444' : '#f59e0b'} />
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT }}>{avgRPE.toFixed(1)}</div>
                        <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>avg RPE</div>
                      </div>
                    </div>
                  </div>
                );
              })()}
              {/* RPE distribution */}
              {historyWorkouts.length >= 4 && (() => {
                const allRPEs: number[] = [];
                historyWorkouts.forEach((w: any) => (w.exercises || []).forEach((e: any) => (e.sets || []).forEach((s: any) => {
                  if (s.rpe > 0) allRPEs.push(Math.round(s.rpe));
                })));
                if (allRPEs.length < 10) return null;
                const bins = [5, 6, 7, 8, 9, 10];
                const counts = bins.map(b => allRPEs.filter(r => r === b).length);
                const maxCount = Math.max(1, ...counts);
                const total = allRPEs.length;
                return (
                  <div style={style.card}>
                    <div style={style.label}>📊 Распределение RPE</div>
                    <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 50 }}>
                      {bins.map((b, i) => {
                        const h = Math.max(2, (counts[i] / maxCount) * 46);
                        const pct = Math.round((counts[i] / total) * 100);
                        const color = b <= 6 ? '#22c55e' : b <= 7 ? '#60a5fa' : b <= 8 ? '#f59e0b' : '#ef4444';
                        return (
                          <div key={b} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                            <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>{pct}%</div>
                            <div style={{ width: '100%', height: h, background: color, borderRadius: 2 }} />
                            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)' }}>{b}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 4, textAlign: 'center' }}>
                      Всего {total} замеров RPE
                    </div>
                  </div>
                );
              })()}
              {/* Exercise-specific e1RM progress */}
              {historyWorkouts.length >= 3 && (() => {
                const byEx = new Map<string, { dates: string[]; e1rms: number[] }>();
                historyWorkouts.forEach((w: any) => (w.exercises || []).forEach((ex: any) => {
                  const name = ex.exerciseName || ex.exerciseId;
                  if (!name) return;
                  const best = (ex.sets || []).reduce((m: number, s: any) => Math.max(m, epley1RM(s.weight || 0, s.reps || 0)), 0);
                  if (best <= 0) return;
                  if (!byEx.has(name)) byEx.set(name, { dates: [], e1rms: [] });
                  const entry = byEx.get(name)!;
                  entry.dates.push(w.date);
                  entry.e1rms.push(Math.round(best));
                }));
                const exercises = [...byEx.entries()]
                  .map(([name, data]) => ({ name, count: data.dates.length, latest: data.e1rms[data.e1rms.length - 1], first: data.e1rms[0], delta: data.e1rms[data.e1rms.length - 1] - data.e1rms[0], data: data.e1rms }))
                  .filter(e => e.count >= 3)
                  .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
                  .slice(0, 6);
                if (exercises.length === 0) return null;
                return (
                  <div style={style.card}>
                    <div style={style.label}>🏋️ Прогресс по упражнениям</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {exercises.map(ex => (
                        <div key={ex.name} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '4px 6px' }}>
                          <div style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ex.name}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                            <Sparkline data={ex.data} width={50} height={14} color={ex.delta > 0 ? '#22c55e' : '#ef4444'} showDots={false} />
                            <div style={{ fontSize: 9, textAlign: 'right' }}>
                              <div style={{ fontWeight: 700, color: '#fff' }}>{ex.latest}кг</div>
                              <div style={{ color: ex.delta > 0 ? '#22c55e' : '#ef4444', fontSize: 8 }}>
                                {ex.delta > 0 ? '+' : ''}{ex.delta}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
              {/* Plateau detection */}
              {historyWorkouts.length >= 6 && (() => {
                const byEx = new Map<string, { e1rms: number[]; sessions: number; latestDate: string }>();
                historyWorkouts.forEach((w: any) => (w.exercises || []).forEach((ex: any) => {
                  const name = ex.exerciseName || ex.exerciseId;
                  if (!name) return;
                  const best = (ex.sets || []).reduce((m: number, s: any) => Math.max(m, epley1RM(s.weight || 0, s.reps || 0)), 0);
                  if (best <= 0) return;
                  if (!byEx.has(name)) byEx.set(name, { e1rms: [], sessions: 0, latestDate: w.date });
                  const entry = byEx.get(name)!;
                  entry.e1rms.push(Math.round(best));
                  entry.sessions++;
                  if (w.date > entry.latestDate) entry.latestDate = w.date;
                }));
                const plateaued = [...byEx.entries()]
                  .filter(([_, data]) => {
                    if (data.sessions < 4) return false;
                    const recent = data.e1rms.slice(-4);
                    const maxRecent = Math.max(...recent);
                    const minRecent = Math.min(...recent);
                    const range = maxRecent > 0 ? (maxRecent - minRecent) / maxRecent : 0;
                    return range < 0.03;
                  })
                  .map(([name, data]) => {
                    const recent = data.e1rms.slice(-4);
                    const best = Math.max(...recent);
                    const sessions = data.sessions;
                    return { name, best, sessions, date: data.latestDate };
                  })
                  .sort((a, b) => b.sessions - a.sessions)
                  .slice(0, 5);
                if (plateaued.length === 0) return null;
                return (
                  <div style={{ ...style.card, border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 14 }}>⚠️</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b' }}>Плато: {plateaued.length} упр.</span>
                    </div>
                    {plateaued.map(p => (
                      <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <div>
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>{p.name}</span>
                          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginLeft: 4 }}>{p.sessions} сессий</span>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b' }}>{p.best}кг</span>
                      </div>
                    ))}
                    <div style={{ marginTop: 4, fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>
                      💡 Попробуйте: изменить хват, темп, диапазон повторов или добавить assistance
                    </div>
                  </div>
                );
              })()}
              {/* Training consistency */}
              {historyWorkouts.length >= 4 && (() => {
                const weeks = 8;
                const today = new Date();
                const weekData: { label: string; count: number; target: number }[] = [];
                for (let w = weeks - 1; w >= 0; w--) {
                  const weekStart = new Date(today);
                  weekStart.setDate(weekStart.getDate() - (w + 1) * 7);
                  const weekEnd = new Date(today);
                  weekEnd.setDate(weekEnd.getDate() - w * 7);
                  const count = historyWorkouts.filter(wo => {
                    const d = new Date(wo.date);
                    return d > weekStart && d <= weekEnd;
                  }).length;
                  weekData.push({ label: `Н${weeks - w}`, count, target: 4 });
                }
                const avgPerWeek = weekData.reduce((s, w) => s + w.count, 0) / weeks;
                const consistency = weekData.filter(w => w.count >= 3).length;
                const perfectWeeks = weekData.filter(w => w.count >= 4).length;
                return (
                  <div style={style.card}>
                    <div style={style.label}>📅 Регулярность</div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                      <div style={{ flex: 1, textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '4px 6px' }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT }}>{avgPerWeek.toFixed(1)}</div>
                        <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>трен/нед</div>
                      </div>
                      <div style={{ flex: 1, textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '4px 6px' }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#22c55e' }}>{consistency}/{weeks}</div>
                        <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>стабильных</div>
                      </div>
                      <div style={{ flex: 1, textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '4px 6px' }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#f59e0b' }}>{perfectWeeks}</div>
                        <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>идеальных</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 32 }}>
                      {weekData.map((w, i) => {
                        const h = Math.min((w.count / 5) * 100, 100);
                        const color = w.count >= 4 ? '#22c55e' : w.count >= 3 ? '#f59e0b' : w.count >= 1 ? '#ef4444' : 'rgba(255,255,255,0.05)';
                        return (
                          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>{w.count}</div>
                            <div style={{ width: '100%', height: `${h}%`, minHeight: 2, background: color, borderRadius: 2 }} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              {/* Weekly targets */}
              {historyWorkouts.length >= 1 && <WeeklyTargetsCard historyWorkouts={historyWorkouts} />}
              {/* Workout streaks */}
              {historyWorkouts.length >= 3 && (() => {
                const sorted = [...historyWorkouts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                const days = sorted.map(w => new Date(w.date).toISOString().slice(0, 10));
                const uniqueDays = [...new Set(days)];
                let currentStreak = 0;
                const today = new Date().toISOString().slice(0, 10);
                let checkDate = new Date();
                for (let i = 0; i < 30; i++) {
                  const ds = checkDate.toISOString().slice(0, 10);
                  if (uniqueDays.includes(ds)) { currentStreak++; } else if (ds !== today) break;
                  checkDate.setDate(checkDate.getDate() - 1);
                }
                let maxStreak = 0;
                let cur = 1;
                for (let i = 1; i < uniqueDays.length; i++) {
                  const prev = new Date(uniqueDays[i - 1]);
                  const curr = new Date(uniqueDays[i]);
                  const diffDays = Math.round((prev.getTime() - curr.getTime()) / (24 * 60 * 60 * 1000));
                  if (diffDays === 1) { cur++; } else { maxStreak = Math.max(maxStreak, cur); cur = 1; }
                }
                maxStreak = Math.max(maxStreak, cur);
                const recentPRs = sorted.filter(w => w.date >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()).reduce((count: number, w: any) => {
                  return count + (w.exercises || []).filter((e: any) => (e.sets || []).some((s: any) => s.isPR)).length;
                }, 0);
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                    <div style={{ ...style.card, textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: currentStreak >= 3 ? '#22c55e' : ACCENT }}>{currentStreak}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>🔥 Серия дней</div>
                    </div>
                    <div style={{ ...style.card, textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#f59e0b' }}>{maxStreak}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>🏆 Макс. серия</div>
                    </div>
                    <div style={{ ...style.card, textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: recentPRs > 0 ? '#a855f7' : 'rgba(255,255,255,0.3)' }}>{recentPRs}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>⭐ PR за 7д</div>
                    </div>
                  </div>
                );
              })()}
              {/* Muscle group frequency per week */}
              {historyWorkouts.length >= 4 && (() => {
                const weeks = 8;
                const today = new Date();
                const groupWeeks: Record<string, number[]> = {};
                for (let w = weeks - 1; w >= 0; w--) {
                  const weekStart = new Date(today); weekStart.setDate(weekStart.getDate() - (w + 1) * 7);
                  const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() - w * 7);
                  const weekWorkouts = historyWorkouts.filter(wo => { const d = new Date(wo.date); return d > weekStart && d <= weekEnd; });
                  const trainedGroups = new Set<string>();
                  weekWorkouts.forEach(wo => wo.exercises.forEach((e: any) => {
                    const cat = EXERCISE_CATALOG.find((c: any) => c.id === e.exerciseId);
                    if (cat?.group) trainedGroups.add(cat.group);
                  }));
                  trainedGroups.forEach(g => { if (!groupWeeks[g]) groupWeeks[g] = new Array(weeks).fill(0); groupWeeks[g][weeks - 1 - w] = 1; });
                }
                const groups = Object.entries(groupWeeks)
                  .map(([g, arr]) => ({ group: g, total: arr.reduce((s, v) => s + v, 0), data: arr }))
                  .sort((a, b) => b.total - a.total)
                  .slice(0, 8);
                if (groups.length === 0) return null;
                return (
                  <div style={style.card}>
                    <div style={style.label}>💪 Частота по группам</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '80px repeat(8, 1fr)', gap: '2px 4px', alignItems: 'center' }}>
                      {groups.map(({ group, total, data }) => (
                        <React.Fragment key={group}>
                          <span style={{ fontSize: 9, color: 'var(--text-dim)', textAlign: 'right' }}>{GRP_RU[group] || group}</span>
                          {data.map((v, wi) => (
                            <div key={wi} style={{ height: 10, borderRadius: 2, background: v > 0 ? (total >= 6 ? '#22c55e' : total >= 3 ? '#f59e0b' : '#ef4444') : 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {v > 0 && <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.6)' }}>✓</span>}
                            </div>
                          ))}
                          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textAlign: 'right' }}>{total}/{weeks}</span>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                );
              })()}
              {/* Day-of-week training heatmap */}
              {historyWorkouts.length >= 3 && (() => {
                const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
                const dayData = dayNames.map((name, idx) => {
                  const dayWorkouts = historyWorkouts.filter(w => new Date(w.date).getDay() === (idx + 1) % 7);
                  const totalSets = dayWorkouts.reduce((s, w) => s + w.exercises.reduce((sum: number, e: any) => sum + (e.sets?.length || 0), 0), 0);
                  const groups = new Map<string, number>();
                  dayWorkouts.forEach(w => w.exercises.forEach((e: any) => {
                    const cat = EXERCISE_CATALOG.find((c: any) => c.id === e.exerciseId);
                    if (cat?.group) groups.set(cat.group, (groups.get(cat.group) || 0) + (e.sets?.length || 0));
                  }));
                  const topGroup = [...groups.entries()].sort((a, b) => b[1] - a[1])[0];
                  return { name, workouts: dayWorkouts.length, sets: totalSets, topGroup: topGroup ? GRP_RU[topGroup[0]] || topGroup[0] : '—' };
                });
                const maxSets = Math.max(1, ...dayData.map(d => d.sets));
                return (
                  <div style={style.card}>
                    <div style={style.label}>📅 Дни тренировок</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                      {dayData.map((d, i) => {
                        const intensity = d.sets / maxSets;
                        const bg = intensity > 0.7 ? 'rgba(0,230,138,0.2)' : intensity > 0.3 ? 'rgba(0,230,138,0.1)' : intensity > 0 ? 'rgba(0,230,138,0.05)' : 'rgba(255,255,255,0.02)';
                        return (
                          <div key={i} style={{ textAlign: 'center', padding: '6px 2px', borderRadius: 6, background: bg }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: d.workouts > 0 ? '#00e68a' : 'rgba(255,255,255,0.2)' }}>{d.name}</div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', margin: '2px 0' }}>{d.workouts}</div>
                            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>{d.sets} сетов</div>
                            {d.topGroup !== '—' && <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>{d.topGroup}</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              {/* Exercise frequency across all sessions */}
              {historyWorkouts.length >= 3 && (() => {
                const exFreq = new Map<string, { count: number; sets: number; group: string }>();
                historyWorkouts.forEach((w: any) => (w.exercises || []).forEach((e: any) => {
                  const name = e.exerciseName || e.exerciseId;
                  if (!name) return;
                  const cat = EXERCISE_CATALOG.find((c: any) => c.id === e.exerciseId);
                  const prev = exFreq.get(name);
                  if (prev) { prev.count++; prev.sets += e.sets?.length || 0; }
                  else exFreq.set(name, { count: 1, sets: e.sets?.length || 0, group: cat?.group || '' });
                }));
                const sorted = [...exFreq.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 12);
                if (sorted.length === 0) return null;
                const maxCount = sorted[0][1].count;
                return (
                  <div style={style.card}>
                    <div style={style.label}>🔥 Частота упражнений</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {sorted.map(([name, data], i) => {
                        const pct = data.count / maxCount;
                        const color = data.group ? (GRP_RU[data.group] ? '#00e68a' : '#60a5fa') : '#a855f7';
                        return (
                          <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', width: 14, textAlign: 'right' }}>{i + 1}</div>
                            <div style={{ flex: 1, height: 14, background: 'rgba(255,255,255,0.03)', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                              <div style={{ height: '100%', width: `${pct * 100}%`, background: `${color}33`, borderRadius: 3, transition: 'width 0.3s' }} />
                              <span style={{ position: 'absolute', left: 4, top: 1, fontSize: 8, color: 'rgba(255,255,255,0.7)', lineHeight: 12 }}>{name}</span>
                            </div>
                            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', width: 30, textAlign: 'right' }}>{data.count}×</div>
                            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', width: 24, textAlign: 'right' }}>{data.sets}с</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              {/* Time under tension */}
              {historyWorkouts.length > 0 && (() => {
                const lastWorkouts = historyWorkouts.slice(-8);
                let totalTUT = 0;
                let totalSessions = 0;
                lastWorkouts.forEach(w => {
                  w.exercises.forEach((e: any) => {
                    const sets = e.sets || [];
                    sets.forEach((s: any) => {
                      const reps = s.reps || 10;
                      const rest = s.restSec || 90;
                      const timePerSet = reps * 3 + rest;
                      totalTUT += timePerSet;
                    });
                  });
                  if (w.exercises.length > 0) totalSessions++;
                });
                const avgTUT = totalSessions > 0 ? Math.round(totalTUT / totalSessions) : 0;
                const totalMin = Math.round(totalTUT / 60);
                const avgMin = Math.round(avgTUT / 60);
                return (
                  <div style={style.card}>
                    <div style={style.label}>⏱ Время под нагрузкой</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: ACCENT }}>{avgMin} мин</div>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Среднее за сессию</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#60a5fa' }}>{totalMin} мин</div>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Всего (8 нед)</div>
                      </div>
                    </div>
                  </div>
                );
              })()}
              {/* Workout density */}
              {historyWorkouts.length >= 3 && (() => {
                const recent = historyWorkouts.slice(-8);
                const densities = recent.map(w => {
                  const dur = w.duration || 0;
                  const totalSets = w.exercises.reduce((s: number, e: any) => s + (e.sets?.length || 0), 0);
                  const totalVol = w.exercises.reduce((s: number, e: any) => s + e.totalVolume, 0);
                  if (dur <= 0) return null;
                  return { setsPerMin: totalSets / dur, volPerMin: totalVol / dur, sets: totalSets, dur, date: w.date };
                }).filter(Boolean) as { setsPerMin: number; volPerMin: number; sets: number; dur: number; date: string }[];
                if (densities.length < 3) return null;
                const avgSetsPerMin = densities.reduce((s, d) => s + d.setsPerMin, 0) / densities.length;
                const avgVolPerMin = densities.reduce((s, d) => s + d.volPerMin, 0) / densities.length;
                const last = densities[densities.length - 1];
                const trend = last.setsPerMin > avgSetsPerMin * 1.1;
                return (
                  <div style={{ ...style.card, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 2 }}>⚡ Плотность</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: trend ? '#f59e0b' : ACCENT }}>{avgSetsPerMin.toFixed(2)}</div>
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>сетов/мин (avg)</div>
                      <Sparkline data={densities.map(d => d.setsPerMin)} width={60} height={14} color={trend ? '#f59e0b' : '#00e68a'} showDots={false} />
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 2 }}>📊 Объём/мин</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#60a5fa' }}>{Math.round(avgVolPerMin)}</div>
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>кг/мин (avg)</div>
                      <Sparkline data={densities.map(d => d.volPerMin)} width={60} height={14} color="#60a5fa" showDots={false} />
                    </div>
                  </div>
                );
              })()}
              {/* Volume per session bar chart */}
              {historyWorkouts.length >= 3 && (() => {
                const recent = historyWorkouts.slice(-12);
                const vols = recent.map(w => w.exercises.reduce((s: number, e: any) => s + e.totalVolume, 0));
                const maxVol = Math.max(1, ...vols);
                return (
                  <div style={style.card}>
                    <div style={style.label}>📊 Объём за сессию</div>
                    <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 50 }}>
                      {vols.map((v, i) => {
                        const h = Math.max(2, (v / maxVol) * 46);
                        const isMax = v === maxVol;
                        const isMin = v === Math.min(...vols.filter(x => x > 0));
                        return (
                          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                            <div style={{ width: '100%', height: h, borderRadius: 2, background: isMax ? '#22c55e' : isMin ? '#ef4444' : '#00e68a', opacity: isMax ? 1 : 0.6 }} />
                            <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>{(v / 1000).toFixed(1)}т</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              {/* Trend sparklines */}
              {totals.filter(t => t > 0).length >= 2 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <div style={style.card}>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>Объём (сеты/нед)</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Sparkline data={totals} width={60} height={20} color="#00e68a" />
                      <span style={{ fontSize: 10, color: totals[7] > totals[0] ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                        {totals[7] > totals[0] ? '↑' : '↓'} {Math.abs(totals[7] - totals[0])} сетов
                      </span>
                    </div>
                  </div>
                  <div style={style.card}>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>Напряжение</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Sparkline data={[analytics.fatigue.monotony, analytics.fatigue.strain / 100, analytics.fatigue.cnsFatigue * 10, analytics.recovery.readinessEstimate / 10]} width={60} height={20} color="#a855f7" />
                      <span style={{ fontSize: 10, color: analytics.fatigue.weeklyFatigue > 0.7 ? '#ef4444' : '#22c55e', fontWeight: 600 }}>
                        {Math.round(analytics.fatigue.weeklyFatigue * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              )}
              {/* Fatigue trend by week */}
              {diaryProgress.length >= 3 && (
                <div style={style.card}>
                  <div style={style.label}>📉 Тренды по неделям</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <div>
                      <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 2 }}>Объём (кг/нед)</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Sparkline data={diaryProgress.slice(-8).map(w => w.totalVolume / 1000)} width={70} height={20} color="#00e68a" />
                        {diaryProgress.length >= 2 && <span style={{ fontSize: 10, fontWeight: 600, color: diaryProgress[diaryProgress.length - 1].totalVolume > diaryProgress[0].totalVolume ? '#22c55e' : '#ef4444' }}>
                          {diaryProgress[diaryProgress.length - 1].totalVolume > diaryProgress[0].totalVolume ? '↑' : '↓'} {Math.abs(Math.round((diaryProgress[diaryProgress.length - 1].totalVolume - diaryProgress[0].totalVolume) / 1000))}т
                        </span>}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 2 }}>Тренировок/нед</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Sparkline data={diaryProgress.slice(-8).map(w => w.workoutCount)} width={70} height={20} color="#60a5fa" />
                        {diaryProgress.length >= 2 && <span style={{ fontSize: 10, fontWeight: 600, color: '#60a5fa' }}>
                          {diaryProgress[diaryProgress.length - 1].workoutCount} ×
                        </span>}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {/* Recovery card */}
              {(() => {
                const rh = (() => { try { return loadReadinessHistory(); } catch { return []; } })();
                if (rh.length < 3) return null;
                const recent = rh.slice(-8);
                const avgRecovery = recent.reduce((s, r) => s + (r.recovery || 50), 0) / recent.length;
                const avgFatigue = recent.reduce((s, r) => s + (r.fatigue || 50), 0) / recent.length;
                const recTrend = recent[recent.length - 1]?.recovery > recent[0]?.recovery;
                const fatTrend = recent[recent.length - 1]?.fatigue < recent[0]?.fatigue;
                const readinessScore = Math.round(avgRecovery * 0.6 + (100 - avgFatigue) * 0.4);
                return (
                  <div style={style.card}>
                    <div style={style.label}>💚 Восстановление</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Восстановление</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: avgRecovery >= 50 ? '#22c55e' : '#ef4444' }}>{Math.round(avgRecovery)}%</div>
                        <Sparkline data={recent.map(r => r.recovery)} width={50} height={12} color={recTrend ? '#22c55e' : '#ef4444'} showDots={false} />
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Усталость</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: avgFatigue <= 50 ? '#22c55e' : '#f59e0b' }}>{Math.round(avgFatigue)}%</div>
                        <Sparkline data={recent.map(r => r.fatigue)} width={50} height={12} color={fatTrend ? '#22c55e' : '#f59e0b'} showDots={false} />
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Readiness</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: readinessScore >= 50 ? '#22c55e' : '#ef4444' }}>{readinessScore}%</div>
                        <Sparkline data={recent.map(r => r.recovery * 0.6 + (100 - r.fatigue) * 0.4)} width={50} height={12} color={readinessScore >= 50 ? '#22c55e' : '#ef4444'} showDots={false} />
                      </div>
                    </div>
                  </div>
                );
              })()}
              {/* Weekly summary card */}
              {historyWorkouts.length > 0 && (() => {
                const lastWeek = historyWorkouts.filter(w => {
                  const d = new Date(w.date);
                  const now = new Date();
                  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                  return d >= weekAgo;
                });
                if (lastWeek.length === 0) return null;
                const totalVol = lastWeek.reduce((s, w) => s + w.exercises.reduce((sum, e) => sum + e.totalVolume, 0), 0);
                const totalSetsW = lastWeek.reduce((s, w) => s + w.exercises.reduce((sum, e) => sum + e.sets.length, 0), 0);
                const topEx = new Map<string, { vol: number; e1rm: number }>();
                lastWeek.forEach(w => w.exercises.forEach(ex => {
                  const prev = topEx.get(ex.exerciseName);
                  const vol = ex.totalVolume;
                  const e1rm = ex.estimated1RM || 0;
                  if (!prev || vol > prev.vol) topEx.set(ex.exerciseName, { vol, e1rm });
                }));
                const sorted = Array.from(topEx.entries()).sort((a, b) => b[1].vol - a[1].vol).slice(0, 3);
                const bestPR = lastWeek.flatMap(w => w.exercises.map(ex => ({ name: ex.exerciseName, e1rm: ex.estimated1RM || 0 }))).sort((a, b) => b.e1rm - a.e1rm)[0];
                return (
                  <div style={style.card}>
                    <div style={style.label}>📋 Итоги недели</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 6 }}>
                      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '4px 6px', textAlign: 'center' }}>
                        <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Тренировок</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT }}>{lastWeek.length}</div>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '4px 6px', textAlign: 'center' }}>
                        <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Подходов</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#60a5fa' }}>{totalSetsW}</div>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '4px 6px', textAlign: 'center' }}>
                        <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Тоннаж</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#a855f7' }}>{(totalVol / 1000).toFixed(1)}т</div>
                      </div>
                    </div>
                    {sorted.length > 0 && (
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
                        <span style={{ color: 'rgba(255,255,255,0.3)' }}>Топ: </span>
                        {sorted.map(([name, data], i) => (
                          <span key={i}>
                            {i > 0 && ' · '}
                            <span style={{ color: '#fff' }}>{name}</span>
                            <span style={{ color: 'rgba(255,255,255,0.4)' }}> ({Math.round(data.vol).toLocaleString()} кг)</span>
                          </span>
                        ))}
                      </div>
                    )}
                    {bestPR && bestPR.e1rm > 0 && (
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                        🏆 Лучший e1RM: <span style={{ color: ACCENT, fontWeight: 700 }}>{bestPR.name}</span> {Math.round(bestPR.e1rm)} кг
                      </div>
                    )}
                  </div>
                );
              })()}
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
                    {/* Weekly volume bar chart */}
                    {historyWorkouts.length >= 3 && (() => {
                      const sorted = [...historyWorkouts].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                      const weekMap = new Map<string, { vol: number; sets: number; count: number }>();
                      sorted.forEach(w => {
                        const d = new Date(w.date);
                        const wkStart = new Date(d); wkStart.setDate(d.getDate() - d.getDay());
                        const key = wkStart.toISOString().slice(0, 10);
                        const prev = weekMap.get(key) || { vol: 0, sets: 0, count: 0 };
                        prev.vol += w.exercises.reduce((s: number, e: any) => s + e.totalVolume, 0);
                        prev.sets += w.exercises.reduce((s: number, e: any) => s + (e.sets || []).length, 0);
                        prev.count++;
                        weekMap.set(key, prev);
                      });
                      const weeks = [...weekMap.entries()].slice(-8);
                      if (weeks.length < 2) return null;
                      const volMax = Math.max(...weeks.map(([, w]) => w.vol), 1);
                      const h = 60; const ww = 300;
                      return (
                        <div style={style.card}>
                          <div style={style.label}>📊 Объём по неделям (тоннаж, кг)</div>
                          <svg width="100%" viewBox={`0 0 ${ww} ${h}`} style={{ display: 'block' }}>
                            {weeks.map(([wk, data], i) => {
                              const bh = (data.vol / volMax) * (h - 12);
                              const x = (i / weeks.length) * ww + 4;
                              const bw = ww / weeks.length - 6;
                              return (
                                <g key={wk}>
                                  <rect x={x} y={h - bh - 8} width={bw} height={bh} rx={3} fill={data.vol >= volMax * 0.8 ? '#22c55e' : data.vol >= volMax * 0.5 ? '#60a5fa' : 'rgba(255,255,255,0.15)'} />
                                  <text x={x + bw / 2} y={h - bh - 10} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize={7}>{data.vol >= 1000 ? `${(data.vol / 1000).toFixed(1)}т` : data.vol}</text>
                                  <text x={x + bw / 2} y={h - 1} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize={6}>{wk.slice(5, 10)}</text>
                                </g>
                              );
                            })}
                          </svg>
                        </div>
                      );
                    })()}
                    {/* Monthly summary */}
                    {historyWorkouts.length >= 4 && (() => {
                      const now = new Date();
                      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                      const monthW = historyWorkouts.filter(w => new Date(w.date) >= monthStart);
                      if (monthW.length === 0) return null;
                      const totalVol = monthW.reduce((s: number, w: any) => s + w.exercises.reduce((ss: number, e: any) => ss + e.totalVolume, 0), 0);
                      const totalSets = monthW.reduce((s: number, w: any) => s + w.exercises.reduce((ss: number, e: any) => ss + (e.sets || []).length, 0), 0);
                      const totalEx = monthW.reduce((s: number, w: any) => s + w.exercises.length, 0);
                      const avgRPE = (() => { let c = 0, s = 0; monthW.forEach(w => w.exercises.forEach(e => e.sets.forEach((st: any) => { if (st.rpe) { s += st.rpe; c++; } }))); return c > 0 ? (s / c).toFixed(1) : '—'; })();
                      const prCount = monthW.reduce((cnt: number, w: any) => cnt + w.exercises.filter((e: any) => (e.sets || []).some((s: any) => s.isPR)).length, 0);
                      return (
                        <div style={style.card}>
                          <div style={style.label}>📅 {now.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })} (итого)</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 4, textAlign: 'center' }}>
                            <div><div style={{ fontSize: 14, fontWeight: 800, color: ACCENT }}>{monthW.length}</div><div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>тренировок</div></div>
                            <div><div style={{ fontSize: 14, fontWeight: 800, color: '#60a5fa' }}>{(totalVol / 1000).toFixed(1)}т</div><div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>тоннаж</div></div>
                            <div><div style={{ fontSize: 14, fontWeight: 800, color: '#a855f7' }}>{totalSets}</div><div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>подходов</div></div>
                            <div><div style={{ fontSize: 14, fontWeight: 800, color: '#f59e0b' }}>{avgRPE}</div><div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>RPE avg</div></div>
                            <div><div style={{ fontSize: 14, fontWeight: 800, color: prCount > 0 ? '#22c55e' : 'rgba(255,255,255,0.3)' }}>{prCount}</div><div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>PR</div></div>
                          </div>
                        </div>
                      );
                    })()}
                    {/* PR Leaderboard */}
                    {historyWorkouts.length >= 2 && (() => {
                      const exMap = new Map<string, { name: string; e1rm: number; weight: number; reps: number; date: string }>();
                      historyWorkouts.forEach((w: any) => w.exercises.forEach((ex: any) => {
                        (ex.sets || []).forEach((s: any) => {
                          const e1rm = s.reps > 0 ? Math.round(s.weight * (1 + s.reps / 30)) : 0;
                          const prev = exMap.get(ex.exerciseId || ex.exerciseName);
                          if (!prev || e1rm > prev.e1rm) exMap.set(ex.exerciseId || ex.exerciseName, { name: ex.exerciseName, e1rm, weight: s.weight, reps: s.reps, date: w.date });
                        });
                      }));
                      const sorted = [...exMap.values()].sort((a, b) => b.e1rm - a.e1rm).slice(0, 10);
                      if (sorted.length === 0) return null;
                      return (
                        <div style={style.card}>
                          <div style={style.label}>🏆 Таблица лидеров (лучшие 1ПМ)</div>
                          <div style={{ display: 'grid', gap: 3 }}>
                            {sorted.map((e, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                <span style={{ minWidth: 16, textAlign: 'center', fontWeight: 700, color: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7f32' : 'rgba(255,255,255,0.3)' }}>{i + 1}</span>
                                <span style={{ flex: 1, color: 'rgba(255,255,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</span>
                                <span style={{ color: ACCENT, fontWeight: 700, minWidth: 40, textAlign: 'right' }}>{e.e1rm}кг</span>
                                <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, minWidth: 55, textAlign: 'right' }}>{e.weight}×{e.reps}</span>
                                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 8, minWidth: 45, textAlign: 'right' }}>{e.date.slice(5, 10)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                    <StandardForecastCard sessions={historyWorkouts} />
                    {/* Volume Landmarks per muscle */}
                    {historyWorkouts.length >= 4 && (() => {
                      const MRV: Record<string, number> = { chest: 22, back: 26, quads: 20, hamstrings: 14, shoulders: 18, biceps: 14, triceps: 12, glutes: 16, calves: 12 };
                      const MEV: Record<string, number> = { chest: 8, back: 8, quads: 8, hamstrings: 6, shoulders: 8, biceps: 4, triceps: 4, glutes: 6, calves: 6 };
                      const recent = historyWorkouts.slice(-8);
                      const MUSCLES = ['chest', 'back', 'quads', 'hamstrings', 'shoulders', 'biceps', 'triceps', 'glutes', 'calves'];
                      const muscleSets: Record<string, number[]> = {};
                      MUSCLES.forEach(m => { muscleSets[m] = []; });
                      for (let w = 0; w < recent.length; w++) {
                        const wo = recent[w];
                        const weekSets: Record<string, number> = {};
                        MUSCLES.forEach(m => { weekSets[m] = 0; });
                        wo.exercises.forEach((ex: any) => {
                          const cat = EXERCISE_CATALOG.find((c: any) => c.id === ex.exerciseId);
                          const group = cat?.group || '';
                          if (weekSets[group] !== undefined) weekSets[group] += (ex.sets || []).length;
                        });
                        MUSCLES.forEach(m => muscleSets[m].push(weekSets[m]));
                      }
                      return (
                        <div style={style.card}>
                          <div style={style.label}>📊 Ландмарки объёма (средняя/нед, последние {recent.length})</div>
                          <div style={{ display: 'grid', gap: 3 }}>
                            {MUSCLES.map(m => {
                              const avg = muscleSets[m].length > 0 ? muscleSets[m].reduce((s: number, v: number) => s + v, 0) / muscleSets[m].length : 0;
                              const mev = MEV[m] || 8; const mrv = MRV[m] || 20;
                              const ratio = avg / mrv;
                              const color = avg < mev ? '#ef4444' : avg < mrv * 0.7 ? '#22c55e' : avg < mrv ? '#f59e0b' : '#ef4444';
                              const label = avg < mev ? 'Ниже MEV' : avg < mrv * 0.7 ? 'Оптимально' : avg < mrv ? 'Выше нормы' : 'Over MRV';
                              return (
                                <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
                                  <span style={{ width: 70, color: 'rgba(255,255,255,0.5)', textAlign: 'right' }}>{GRP_RU[m] || m}</span>
                                  <div style={{ flex: 1, height: 8, borderRadius: 3, background: 'rgba(255,255,255,0.06)', position: 'relative', overflow: 'hidden' }}>
                                    <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.min(100, ratio * 100)}%`, background: color, borderRadius: 3 }} />
                                    <div style={{ position: 'absolute', left: `${(mev / mrv) * 100}%`, top: -1, width: 1, height: 10, background: 'rgba(255,255,255,0.4)' }} />
                                  </div>
                                  <span style={{ minWidth: 35, textAlign: 'right', fontWeight: 600, color }}>{Math.round(avg)}</span>
                                  <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', minWidth: 55 }}>/ {mrv} MRV</span>
                                  <span style={{ fontSize: 8, color }}>{label}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                    <VolumeRecoveryCorrelationCard sessions={historyWorkouts} />
                    {/* Fatigue accumulation curve */}
                    {historyWorkouts.length >= 4 && (() => {
                      const sorted = [...historyWorkouts].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                      const last12 = sorted.slice(-12);
                      const fatigueData: number[] = [];
                      const volumeData: number[] = [];
                      last12.forEach(w => {
                        let rpeSum = 0, rpeCount = 0;
                        w.exercises.forEach((e: any) => e.sets.forEach((st: any) => { if (st.rpe) { rpeSum += st.rpe; rpeCount++; } }));
                        fatigueData.push(rpeCount > 0 ? rpeSum / rpeCount : 7);
                        volumeData.push(w.exercises.reduce((s: number, e: any) => s + e.totalVolume, 0) / 1000);
                      });
                      const fMax = Math.max(...fatigueData, 1);
                      const vMax = Math.max(...volumeData, 1);
                      const h = 50; const ww = 280;
                      return (
                        <div style={style.card}>
                          <div style={style.label}>⚡ Кривая усталости</div>
                          <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 4 }}>RPE (синий) + объём (зелёный) по сессиям</div>
                          <svg width="100%" viewBox={`0 0 ${ww} ${h}`} style={{ display: 'block' }}>
                            <polyline points={fatigueData.map((v, i) => `${(i / Math.max(fatigueData.length - 1, 1)) * ww},${h - (v / fMax) * (h - 4) - 2}`).join(' ')} fill="none" stroke="#60a5fa" strokeWidth={2} strokeLinejoin="round" />
                            <polyline points={volumeData.map((v, i) => `${(i / Math.max(volumeData.length - 1, 1)) * ww},${h - (v / vMax) * (h - 4) - 2}`).join(' ')} fill="none" stroke="#22c55e" strokeWidth={1.5} strokeDasharray="4 2" strokeLinejoin="round" opacity={0.6} />
                            {fatigueData.map((v, i) => <circle key={i} cx={(i / Math.max(fatigueData.length - 1, 1)) * ww} cy={h - (v / fMax) * (h - 4) - 2} r={2} fill="#60a5fa" />)}
                          </svg>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)' }}>{last12[0]?.date.slice(5, 10)}</span>
                            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)' }}>{last12[last12.length - 1]?.date.slice(5, 10)}</span>
                          </div>
                          {(() => {
                            const last3 = fatigueData.slice(-3);
                            const avg = last3.length > 0 ? last3.reduce((s, v) => s + v, 0) / last3.length : 7;
                            return <div style={{ fontSize: 9, color: avg >= 8 ? '#ef4444' : avg >= 6.5 ? '#f59e0b' : '#22c55e', marginTop: 4 }}>Средний RPE (3 сессии): {avg.toFixed(1)}. {avg >= 8 ? '⚠ Высокая нагрузка — рассмотрите делоуд' : avg >= 6.5 ? 'Умеренная нагрузка' : 'Хорошее восстановление'}</div>;
                          })()}
                        </div>
                      );
                    })()}
                    {/* Training velocity per muscle */}
                    {historyWorkouts.length >= 6 && (() => {
                      const sorted = [...historyWorkouts].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                      const MUSCLES = ['chest', 'back', 'quads', 'hamstrings', 'shoulders', 'biceps', 'triceps'];
                      const velocities: { group: string; velocity: number; sessions: number; first: number; last: number }[] = [];
                      MUSCLES.forEach(m => {
                        const exBest = new Map<string, { e1rm: number; date: string }>();
                        sorted.forEach(w => w.exercises.forEach((ex: any) => {
                          const cat = EXERCISE_CATALOG.find((c: any) => c.id === ex.exerciseId);
                          if (cat?.group !== m) return;
                          (ex.sets || []).forEach((s: any) => {
                            const e1rm = s.reps > 0 ? Math.round(s.weight * (1 + s.reps / 30)) : 0;
                            const prev = exBest.get(ex.exerciseId);
                            if (!prev || e1rm > prev.e1rm) exBest.set(ex.exerciseId, { e1rm, date: w.date });
                          });
                        }));
                        if (exBest.size < 2) return;
                        const vals = [...exBest.values()].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                        const first = vals[0].e1rm; const last = vals[vals.length - 1].e1rm;
                        const weeks = Math.max(1, (new Date(vals[vals.length - 1].date).getTime() - new Date(vals[0].date).getTime()) / (7 * 24 * 60 * 60 * 1000));
                        velocities.push({ group: m, velocity: +((last - first) / weeks).toFixed(1), sessions: vals.length, first, last });
                      });
                      velocities.sort((a, b) => b.velocity - a.velocity);
                      if (velocities.length === 0) return null;
                      return (
                        <div style={style.card}>
                          <div style={style.label}>🚀 Скорость прогресса (кг/нед)</div>
                          <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 4 }}>Изменение 1ПМ по мышечным группам</div>
                          <div style={{ display: 'grid', gap: 3 }}>
                            {velocities.map(v => (
                              <div key={v.group} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
                                <span style={{ width: 70, color: 'rgba(255,255,255,0.5)', textAlign: 'right' }}>{GRP_RU[v.group] || v.group}</span>
                                <span style={{ fontWeight: 700, color: v.velocity > 0 ? '#22c55e' : v.velocity < 0 ? '#ef4444' : 'rgba(255,255,255,0.4)', minWidth: 40 }}>{v.velocity > 0 ? '+' : ''}{v.velocity}</span>
                                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>кг/нед ({v.first}→{v.last}кг, {v.sessions} упр.)</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                    <StickingPointAnalysisCard sessions={historyWorkouts} />
                    {/* Training density trend */}
                    {historyWorkouts.length >= 4 && (() => {
                      const sorted = [...historyWorkouts].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                      const last12 = sorted.slice(-12);
                      const densityData = last12.map(w => {
                        const totalSets = w.exercises.reduce((s: number, e: any) => s + (e.sets || []).length, 0);
                        const dur = w.duration || 60;
                        return { date: w.date.slice(5, 10), setsPerMin: +(totalSets / dur).toFixed(2), sets: totalSets, mins: dur };
                      });
                      const maxD = Math.max(...densityData.map(d => d.setsPerMin), 1);
                      const h = 40; const ww = 280;
                      return (
                        <div style={style.card}>
                          <div style={style.label}>⏱ Плотность тренировок</div>
                          <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 4 }}>Подходы/минуту по сессиям</div>
                          <svg width="100%" viewBox={`0 0 ${ww} ${h}`} style={{ display: 'block' }}>
                            {densityData.map((d, i) => {
                              const bh = (d.setsPerMin / maxD) * (h - 4);
                              const color = d.setsPerMin >= 0.25 ? '#22c55e' : d.setsPerMin >= 0.15 ? '#f59e0b' : '#ef4444';
                              return <rect key={i} x={(i / densityData.length) * ww + 2} y={h - bh - 2} width={Math.max(2, ww / densityData.length - 4)} height={bh} rx={2} fill={color} opacity={0.6} />;
                            })}
                          </svg>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2, fontSize: 8, color: 'rgba(255,255,255,0.25)' }}>
                            <span>{densityData[0]?.date}</span>
                            <span>{densityData[densityData.length - 1]?.date}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 9 }}>
                            <span style={{ color: '#22c55e' }}>🟢 ≥0.25 (высокая)</span>
                            <span style={{ color: '#f59e0b' }}>🟡 0.15-0.25</span>
                            <span style={{ color: '#ef4444' }}>🔴 &lt;0.15 (много отдыха)</span>
                          </div>
                          {densityData.length >= 2 && (() => {
                            const last = densityData[densityData.length - 1];
                            const first = densityData[0];
                            const trend = last.setsPerMin - first.setsPerMin;
                            return <div style={{ fontSize: 9, color: trend > 0 ? '#22c55e' : '#f59e0b', marginTop: 4 }}>Плотность: {last.setsPerMin} подход/мин ({trend >= 0 ? '+' : ''}{(trend).toFixed(2)} за период)</div>;
                          })()}
                        </div>
                      );
                    })()}
                    {/* Session duration forecast */}
                    {historyWorkouts.length >= 3 && (() => {
                      const sorted = [...historyWorkouts].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                      const last10 = sorted.slice(-10);
                      const avgDuration = Math.round(last10.reduce((s: number, w: any) => s + (w.duration || 60), 0) / last10.length);
                      const avgExercises = Math.round(last10.reduce((s: number, w: any) => s + w.exercises.length, 0) / last10.length * 10) / 10;
                      const avgSets = Math.round(last10.reduce((s: number, w: any) => s + w.exercises.reduce((ss: number, e: any) => ss + (e.sets || []).length, 0), 0) / last10.length);
                      const predictByExercises = (n: number) => Math.round(avgDuration * n / avgExercises);
                      return (
                        <div style={style.card}>
                          <div style={style.label}>⏱ Прогноз времени</div>
                          <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 4 }}>На основе последних {last10.length} тренировок (ср. {avgDuration} мин)</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, textAlign: 'center' }}>
                            {[4, 6, 8].map(n => (
                              <div key={n} style={{ padding: 6, borderRadius: 6, background: 'rgba(255,255,255,0.03)' }}>
                                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>{n} упр.</div>
                                <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT }}>{predictByExercises(n)}<span style={{ fontSize: 10, fontWeight: 400 }}> мин</span></div>
                              </div>
                            ))}
                          </div>
                          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 4, textAlign: 'center' }}>Ср. {avgSets} подходов / {avgExercises} упр. / {avgDuration} мин</div>
                        </div>
                      );
                    })()}
                    {/* Session quality score trend */}
                    {historyWorkouts.length >= 4 && (() => {
                      const sorted = [...historyWorkouts].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                      const last12 = sorted.slice(-12);
                      const scores = last12.map(w => {
                        const sets = w.exercises.reduce((s: number, e: any) => s + (e.sets || []).length, 0);
                        const dur = w.duration || 60;
                        const rpeArr: number[] = [];
                        w.exercises.forEach((e: any) => e.sets.forEach((st: any) => { if (st.rpe) rpeArr.push(st.rpe); }));
                        const avgRPE = rpeArr.length > 0 ? rpeArr.reduce((s, v) => s + v, 0) / rpeArr.length : 7;
                        const completion = dur > 0 ? Math.min(1, sets / dur * 1.5) : 0.5;
                        const quality = Math.round((completion * 40 + Math.min(avgRPE / 10, 1) * 30 + Math.min(sets / 30, 1) * 30) * 10);
                        return { date: w.date.slice(5, 10), score: Math.min(100, quality) };
                      });
                      const maxS = 100;
                      const h = 40; const ww = 280;
                      return (
                        <div style={style.card}>
                          <div style={style.label}>📊 Качество сессий</div>
                          <svg width="100%" viewBox={`0 0 ${ww} ${h}`} style={{ display: 'block' }}>
                            <polyline points={scores.map((s, i) => `${(i / Math.max(scores.length - 1, 1)) * ww},${h - (s.score / maxS) * (h - 6) - 3}`).join(' ')} fill="none" stroke="#a855f7" strokeWidth={2} strokeLinejoin="round" />
                            {scores.map((s, i) => <circle key={i} cx={(i / Math.max(scores.length - 1, 1)) * ww} cy={h - (s.score / maxS) * (h - 6) - 3} r={2} fill={s.score >= 70 ? '#22c55e' : s.score >= 50 ? '#f59e0b' : '#ef4444'} />)}
                          </svg>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2, fontSize: 8, color: 'rgba(255,255,255,0.25)' }}>
                            <span>{scores[0]?.date}</span>
                            <span>{scores[scores.length - 1]?.date}</span>
                          </div>
                          {scores.length >= 2 && (() => {
                            const last = scores[scores.length - 1];
                            const first = scores[0];
                            const trend = last.score - first.score;
                            return <div style={{ fontSize: 9, color: last.score >= 70 ? '#22c55e' : last.score >= 50 ? '#f59e0b' : '#ef4444', marginTop: 4 }}>Последняя сессия: {last.score}/100 ({trend >= 0 ? '+' : ''}{trend} за период)</div>;
                          })()}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ ...style.card, textAlign: 'center', padding: 24 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📊</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
                {historyWorkouts.length === 0 ? 'Дневник пуст' : 'Недостаточно данных'}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 12, lineHeight: 1.5 }}>
                {historyWorkouts.length === 0
                  ? 'Запишите первую тренировку, чтобы увидеть объём, интенсивность и усталость.'
                  : 'Нужно минимум 2 тренировки для расчёта аналитики.'}
              </div>
              {historyWorkouts.length === 0 && (
                <button onClick={() => setMode('record')} style={{
                  padding: '8px 20px', borderRadius: 8, border: '1px solid var(--accent)',
                  background: 'rgba(0,230,138,0.1)', color: 'var(--accent)', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                }}>📝 Записать тренировку</button>
              )}
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
              <div><label style={{ fontSize: 10 }}>Вес</label><input type="number" value={mWeight} onChange={e => setMWeight(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '4px', borderRadius: 4, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box' }} /></div>
              <div><label style={{ fontSize: 10 }}>Талия</label><input type="number" value={mWaist} onChange={e => setMWaist(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '4px', borderRadius: 4, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box' }} /></div>
              <div><label style={{ fontSize: 10 }}>Грудь</label><input type="number" value={mChest} onChange={e => setMChest(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '4px', borderRadius: 4, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box' }} /></div>
              <div><label style={{ fontSize: 10 }}>Бицепс</label><input type="number" value={mArm} onChange={e => setMArm(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '4px', borderRadius: 4, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box' }} /></div>
              <div><label style={{ fontSize: 10 }}>Бедро</label><input type="number" value={mThigh} onChange={e => setMThigh(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '4px', borderRadius: 4, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box' }} /></div>
              <div><label style={{ fontSize: 10 }}>Дата</label><input type="date" value={mDate || ''} onChange={e => setMDate(e.target.value)} style={{ width: '100%', padding: '4px', borderRadius: 4, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box' }} /></div>
            </div>
            <button onClick={saveMeasurementHandler} style={{ width: '100%', marginTop: 6, padding: 8, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 12 }}>Сохранить замер</button>
          </div>
          {measurements.length > 0 && (
            <div className="card" style={{ marginBottom: 8, padding: 10 }}>
              <h4 style={{ margin: '0 0 4px', fontSize: 12 }}>📊 История ({measurements.length})</h4>
              {measurements.slice(-5).reverse().map((m: any, i) => (
                <div key={i} style={{ fontSize: 10, padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  {m.date}: Вес {m.weightKg}кг | Талия {m.waistCm}см | Грудь {m.chestCm}см | Бицепс {m.armLeftCm || m.armRightCm}см | Бедро {m.thighLeftCm || m.thighRightCm}см
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
                <span>Жир:</span><span style={{ fontWeight: 600 }}>{measureAnalytics.fatMass?.toFixed(1)} кг</span>
              </div>
            </div>
          )}
          {/* Body composition trend sparklines */}
          {measurements.length >= 3 && (
            <div className="card" style={{ padding: 10, marginBottom: 8 }}>
              <h4 style={{ margin: '0 0 6px', fontSize: 12 }}>📉 Тренды замеров</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {[
                  { label: 'Вес (кг)', data: measurements.map((m: any) => m.weightKg || 0), color: '#00e68a', unit: 'кг' },
                  { label: 'Талия (см)', data: measurements.map((m: any) => m.waistCm || 0), color: '#f59e0b', unit: 'см' },
                  { label: 'Грудь (см)', data: measurements.map((m: any) => m.chestCm || 0), color: '#60a5fa', unit: 'см' },
                  { label: 'Бицепс (см)', data: measurements.map((m: any) => m.armLeftCm || m.armRightCm || 0), color: '#a855f7', unit: 'см' },
                ].map(m => {
                  const first = m.data[0] || 0;
                  const last = m.data[m.data.length - 1] || 0;
                  const delta = first > 0 ? (last - first) : 0;
                  return (
                    <div key={m.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '4px 6px' }}>
                      <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 2 }}>{m.label}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Sparkline data={m.data} width={60} height={18} color={m.color} />
                        <div style={{ fontSize: 10 }}>
                          <div style={{ fontWeight: 700, color: '#fff' }}>{last}{m.unit}</div>
                          <div style={{ fontSize: 9, color: delta === 0 ? 'rgba(255,255,255,0.3)' : delta > 0 ? '#22c55e' : '#ef4444' }}>
                            {delta === 0 ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}`}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {repData && (
            <div className="card" style={{ padding: 10, marginTop: 8 }}>
              <h4 style={{ margin: '0 0 4px', fontSize: 12 }}>📋 Недельный отчёт</h4>
              <div style={{ fontSize: 10, color: 'var(--text-light)' }}>{repData.insights?.slice(0, 3).map((r: any, i: number) => <div key={i}>• {r}</div>)}</div>
            </div>
          )}
          {/* PR Timeline */}
          {historyWorkouts.length >= 2 && (() => {
            const prMap = new Map<string, { date: string; e1rm: number; weight: number; reps: number; exercise: string }>();
            [...historyWorkouts].sort((a, b) => a.date.localeCompare(b.date)).forEach((w: any) => {
              (w.exercises || []).forEach((e: any) => {
                const name = e.exerciseName || e.exerciseId;
                if (!name) return;
                (e.sets || []).forEach((s: any) => {
                  const e1 = epley1RM(s.weight || 0, s.reps || 0);
                  if (e1 <= 0) return;
                  const prev = prMap.get(name);
                  if (!prev || e1 > prev.e1rm) {
                    prMap.set(name, { date: w.date, e1rm: Math.round(e1), weight: s.weight || 0, reps: s.reps || 0, exercise: name });
                  }
                });
              });
            });
            const prs = [...prMap.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15);
            if (prs.length === 0) return null;
            return (
              <div className="card" style={{ padding: 10, marginTop: 8 }}>
                <h4 style={{ margin: '0 0 6px', fontSize: 12 }}>🏆 Личные рекорды</h4>
                {prs.map((pr, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{pr.exercise}</div>
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>{pr.weight}кг × {pr.reps}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b' }}>e1RM {pr.e1rm}</div>
                      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>{pr.date.slice(0, 10)}</div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
          {/* Exercise 1RM progress sparklines */}
          {historyWorkouts.length >= 4 && (() => {
            const sorted = [...historyWorkouts].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            const exHist = new Map<string, { date: string; e1rm: number }[]>();
            sorted.forEach((w: any) => (w.exercises || []).forEach((ex: any) => {
              const id = ex.exerciseId || ex.exerciseName;
              if (!id) return;
              const bestSet = (ex.sets || []).reduce((best: any, s: any) => {
                const e = s.reps > 0 ? Math.round(s.weight * (1 + s.reps / 30)) : 0;
                return e > (best?.e1rm || 0) ? { e1rm: e, date: w.date } : best;
              }, null);
              if (bestSet) {
                if (!exHist.has(id)) exHist.set(id, []);
                exHist.get(id)!.push({ date: bestSet.date, e1rm: bestSet.e1rm });
              }
            }));
            const top = [...exHist.entries()]
              .filter(([, arr]) => arr.length >= 3)
              .map(([id, arr]) => {
                const first = arr[0].e1rm; const last = arr[arr.length - 1].e1rm;
                return { id, name: arr[0].date ? id : id, data: arr.map(a => a.e1rm), delta: last - first, last, arr };
              })
              .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
              .slice(0, 6);
            if (top.length === 0) return null;
            return (
              <div className="card" style={{ padding: 10, marginTop: 8 }}>
                <h4 style={{ margin: '0 0 6px', fontSize: 12 }}>📈 1ПМ по упражнениям</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  {top.map(ex => (
                    <div key={ex.id} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '4px 6px' }}>
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.id}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Sparkline data={ex.data} width={50} height={16} color={ex.delta >= 0 ? '#22c55e' : '#ef4444'} />
                        <div style={{ fontSize: 10, fontWeight: 700, color: ex.delta >= 0 ? '#22c55e' : '#ef4444' }}>
                          {ex.delta >= 0 ? '+' : ''}{ex.delta}кг
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
          {/* PR Calendar heatmap */}
          {historyWorkouts.length >= 5 && (() => {
            const prDays = new Set<string>();
            historyWorkouts.forEach((w: any) => (w.exercises || []).forEach((ex: any) => {
              if ((ex.sets || []).some((s: any) => s.isPR)) prDays.add(w.date.slice(0, 10));
            }));
            if (prDays.size === 0) return null;
            const weeks = 12;
            const today = new Date();
            const calStart = new Date(today);
            calStart.setDate(calStart.getDate() - (weeks * 7) + 1 - calStart.getDay());
            const days: { date: string; hasPR: boolean; dayOfWeek: number; weekIdx: number }[] = [];
            for (let w = 0; w < weeks; w++) {
              for (let d = 0; d < 7; d++) {
                const dt = new Date(calStart); dt.setDate(dt.getDate() + w * 7 + d);
                const ds = dt.toISOString().slice(0, 10);
                days.push({ date: ds, hasPR: prDays.has(ds), dayOfWeek: d, weekIdx: w });
              }
            }
            const dayLabels = ['Пн', '', 'Ср', '', 'Пт', '', 'Вс'];
            return (
              <div className="card" style={{ padding: 10, marginTop: 8 }}>
                <h4 style={{ margin: '0 0 6px', fontSize: 12 }}>🏆 Календарь PR ({prDays.size} дней за {weeks} нед)</h4>
                <div style={{ display: 'flex', gap: 2 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginRight: 2 }}>
                    {dayLabels.map((l, i) => <div key={i} style={{ height: 10, fontSize: 7, color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center' }}>{l}</div>)}
                  </div>
                  {Array.from({ length: weeks }, (_, wi) => (
                    <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {days.filter(d => d.weekIdx === wi).map(d => (
                        <div key={d.date} style={{ width: 10, height: 10, borderRadius: 2, background: d.hasPR ? '#f59e0b' : 'rgba(255,255,255,0.03)' }} title={d.hasPR ? `PR: ${d.date}` : d.date} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
          {/* Strength balance radar */}
          {historyWorkouts.length > 0 && (() => {
            const LIFTS = [
              { name: 'Жим', patterns: ['жим лёжа', 'bench', 'жим штанги'], color: '#ef4444' },
              { name: 'Присед', patterns: ['присед', 'squat'], color: '#3b82f6' },
              { name: 'Тяга', patterns: ['станов', 'deadlift', 'тяга стан'], color: '#f59e0b' },
              { name: 'Тяга верх', patterns: ['тяга верхнего', 'pull down', 'подтягивания'], color: '#22c55e' },
              { name: 'ОГЖ', patterns: ['жим стоя', 'overhead', 'жим армейский'], color: '#a855f7' },
              { name: 'Разгиб', patterns: ['разгиб', 'трицепс', 'pushdown'], color: '#60a5fa' },
            ];
            const lifts = LIFTS.map(l => {
              const sessions = historyWorkouts.flatMap((w: any) => (w.exercises || []).filter((e: any) => {
                const nm = (e.exerciseName || '').toLowerCase();
                return l.patterns.some(p => nm.includes(p));
              }));
              let best = 0;
              sessions.forEach((e: any) => (e.sets || []).forEach((s: any) => {
                const e1 = epley1RM(s.weight || 0, s.reps || 0);
                if (e1 > best) best = e1;
              }));
              return { ...l, e1rm: Math.round(best) };
            });
            const maxE1RM = Math.max(1, ...lifts.map(l => l.e1rm));
            if (lifts.filter(l => l.e1rm > 0).length < 3) return null;
            const R = 42, cx = 55, cy = 55;
            const pts = lifts.map((l, i) => {
              const angle = (Math.PI * 2 * i) / lifts.length - Math.PI / 2;
              const r = (l.e1rm / maxE1RM) * R;
              return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), l, angle };
            });
            const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z';
            return (
              <div className="card" style={{ padding: 10 }}>
                <h4 style={{ margin: '0 0 4px', fontSize: 12 }}>💪 Баланс сил</h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <svg width={110} height={110} viewBox="0 0 110 110">
                    {[0.25, 0.5, 0.75, 1].map(pct => (
                      <polygon key={pct} points={lifts.map((_, i) => {
                        const angle = (Math.PI * 2 * i) / lifts.length - Math.PI / 2;
                        return `${cx + R * pct * Math.cos(angle)},${cy + R * pct * Math.sin(angle)}`;
                      }).join(' ')} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />
                    ))}
                    <path d={pathD} fill="rgba(0,230,138,0.1)" stroke="#00e68a" strokeWidth={1.5} />
                    {pts.map((p, i) => (
                      <g key={i}>
                        <circle cx={p.x} cy={p.y} r={2.5} fill={p.l.color} />
                        <text x={cx + (R + 12) * Math.cos(p.angle)} y={cy + (R + 12) * Math.sin(p.angle)} textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.5)" fontSize={7}>{p.l.name}</text>
                        {p.l.e1rm > 0 && <text x={p.x} y={p.y - 6} textAnchor="middle" fill={p.l.color} fontSize={7} fontWeight={700}>{p.l.e1rm}</text>}
                      </g>
                    ))}
                  </svg>
                  <div style={{ flex: 1 }}>
                    {lifts.filter(l => l.e1rm > 0).map(l => (
                      <div key={l.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 10 }}>
                        <span style={{ color: l.color }}>{l.name}</span>
                        <span style={{ fontWeight: 700, color: '#fff' }}>{l.e1rm}кг</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
          {/* e1RM and tonnage charts from diary data */}
          {historyWorkouts.length > 0 && <ProgressChartsCard historyWorkouts={historyWorkouts} />}
        </div>
      )}

      {/* Dedicated diary sub-tabs. These used to fall through to record/body,
          which made the navigation appear clickable without changing content. */}
      {mode === 'calendar' && <TrainingCalendarTab />}
      {mode === 'checkin' && <CheckinMetricsCard />}
      {mode === 'mmc' && <MMCTrackingCard />}

      {/* ═══ MODE: BODY ═══ — calendar + MMC + body metrics */}
      {mode === 'body' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <TrainingCalendarTab />
          <MMCTrackingCard />
          {/* Inline body measurements (was progress mode) */}
          <div style={style.card}>
            <div style={style.label}>📏 Замеры тела</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
              <div><label style={{ fontSize: 10 }}>Вес</label><input type="number" value={mWeight} onChange={e => setMWeight(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '4px', borderRadius: 4, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box' as any }} /></div>
              <div><label style={{ fontSize: 10 }}>Талия</label><input type="number" value={mWaist} onChange={e => setMWaist(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '4px', borderRadius: 4, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box' as any }} /></div>
              <div><label style={{ fontSize: 10 }}>Грудь</label><input type="number" value={mChest} onChange={e => setMChest(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '4px', borderRadius: 4, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box' as any }} /></div>
              <div><label style={{ fontSize: 10 }}>Бицепс</label><input type="number" value={mArm} onChange={e => setMArm(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '4px', borderRadius: 4, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box' as any }} /></div>
              <div><label style={{ fontSize: 10 }}>Бедро</label><input type="number" value={mThigh} onChange={e => setMThigh(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '4px', borderRadius: 4, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box' as any }} /></div>
              <div><label style={{ fontSize: 10 }}>Дата</label><input type="date" value={mDate || ''} onChange={e => setMDate(e.target.value)} style={{ width: '100%', padding: '4px', borderRadius: 4, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box' as any }} /></div>
            </div>
            <button onClick={saveMeasurementHandler} style={{ width: '100%', marginTop: 6, padding: 8, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 12 }}>Сохранить замер</button>
          </div>
          {measurements.length > 0 && (
            <div style={style.card}>
              <div style={style.label}>📊 История замеров ({measurements.length})</div>
              {/* Trend sparklines */}
              {measurements.length >= 2 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '6px 8px' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 2 }}>Вес (кг)</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Sparkline data={measurements.map((m: any) => m.weightKg || 0)} width={60} height={18} color="#00e68a" />
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
                        {measurements[measurements.length - 1]?.weightKg || '—'} кг
                      </span>
                    </div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '6px 8px' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 2 }}>Талия (см)</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Sparkline data={measurements.map((m: any) => m.waistCm || 0)} width={60} height={18} color="#60a5fa" />
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
                        {measurements[measurements.length - 1]?.waistCm || '—'} см
                      </span>
                    </div>
                  </div>
                </div>
              )}
              {measurements.slice(-5).reverse().map((m: any, i) => (
                <div key={i} style={{ fontSize: 10, padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  {m.date}: Вес {m.weightKg}кг | Талия {m.waistCm}см | Грудь {m.chestCm}см | Бицепс {m.armLeftCm || m.armRightCm}см | Бедро {m.thighLeftCm || m.thighRightCm}см
                </div>
              ))}
            </div>
          )}
          {measureAnalytics && (
            <div style={style.card}>
              <div style={style.label}>📈 Аналитика тела</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 8px', fontSize: 10 }}>
                <span>FFMI:</span><span style={{ fontWeight: 600 }}>{measureAnalytics.ffmi?.toFixed(1)}</span>
                <span>LBM:</span><span style={{ fontWeight: 600 }}>{measureAnalytics.lbm?.toFixed(1)} кг</span>
                <span>BMI:</span><span style={{ fontWeight: 600 }}>{measureAnalytics.bmi?.toFixed(1)}</span>
                <span>Жир:</span><span style={{ fontWeight: 600 }}>{measureAnalytics.fatMass?.toFixed(1)} кг</span>
              </div>
            </div>
          )}
          <CheckinMetricsCard />
        </div>
      )}

      {/* ═══ MODE: TOOLS ═══ — import + export + reports */}
      {mode === 'tools' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <CsvImportTab onDone={onRefresh} />
          {/* CSV Export */}
          <div style={style.card}>
            <div style={style.label}>📥 Экспорт CSV</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>Экспорт всех тренировок в CSV (совместим с импортом)</div>
            {historyWorkouts.length === 0 ? (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', padding: 8 }}>Нет данных для экспорта</div>
            ) : (
              <button onClick={() => {
                const rows: string[] = ['date,exercise,set,weight,reps,rpe,rir,notes'];
                historyWorkouts.forEach((w: any) => {
                  (w.exercises || []).forEach((ex: any) => {
                    (ex.sets || []).forEach((s: any, i: number) => {
                      const weight = s.weight ?? '';
                      const reps = s.reps ?? '';
                      const rpe = s.rpe ?? '';
                      const rir = s.rir ?? '';
                      const notes = s.notes ?? '';
                      const safeWeight = typeof weight === 'string' ? `"${weight}"` : weight;
                      rows.push(`${(w.date || '').slice(0, 10)},"${(ex.exerciseName || '').replace(/"/g, '""')}",${i + 1},${safeWeight},${reps},${rpe},${rir},"${String(notes).replace(/"/g, '""')}"`);
                    });
                  });
                });
                const csv = rows.join('\n');
                const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `diary_export_${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }} style={{ width: '100%', padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'var(--accent)', color: '#000', border: 'none', cursor: 'pointer' }}>
                📥 Скачать CSV ({historyWorkouts.length} тренировок)
              </button>
            )}
          </div>
          {/* Workout templates from history */}
          {historyWorkouts.length > 0 && (() => {
            const recent = historyWorkouts.slice(-5).reverse();
            const templateMap = new Map<string, { exercises: string[]; sets: number; date: string }>();
            recent.forEach((w: any) => {
              const exNames = (w.exercises || []).map((e: any) => e.exerciseName || e.exerciseId).join(' + ');
              const totalSets = (w.exercises || []).reduce((s: number, e: any) => s + (e.sets?.length || 0), 0);
              if (exNames && !templateMap.has(exNames)) {
                templateMap.set(exNames, { exercises: exNames.split(' + '), sets: totalSets, date: (w.date || '').slice(0, 10) });
              }
            });
            const templates = [...templateMap.entries()].slice(0, 4);
            if (templates.length === 0) return null;
            return (
              <div style={style.card}>
                <div style={style.label}>📋 Шаблоны из дневника</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>Повторить тренировку из прошлого</div>
                {templates.map(([key, t], i) => (
                  <div key={i} style={{ padding: '6px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.03)', marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{t.exercises.slice(0, 3).join(', ')}{t.exercises.length > 3 ? ` +${t.exercises.length - 3}` : ''}</div>
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>{t.sets} сетов · {t.date}</div>
                    </div>
                    <button onClick={() => {
                      const wo = recent.find((w: any) => {
                        const names = (w.exercises || []).map((e: any) => e.exerciseName || e.exerciseId).join(' + ');
                        return names === key;
                      });
                      if (wo) try { localStorage.setItem('he_diary_template', JSON.stringify(wo)); window.dispatchEvent(new Event('diary-template-loaded')); } catch {}
                    }} style={{ padding: '3px 8px', borderRadius: 5, fontSize: 9, background: 'rgba(0,230,138,0.15)', color: '#00e68a', border: 'none', cursor: 'pointer' }}>📋 Использовать</button>
                  </div>
                ))}
              </div>
            );
          })()}
          <div style={style.card}>
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>📄 Отчёты</div>
            <button onClick={() => {
              const planWeeks = macrocycle?.totalWeeks ?? (trainingOutput?.plan?.length && daysPerWeek > 0 ? Math.ceil(trainingOutput.plan.length / daysPerWeek) : 0);
              const report = {
                id: 'report_' + Date.now(), date: new Date().toISOString(),
                exerciseCatalogCount: EXERCISE_CATALOG.length, planWeeks, exercisesPerWeek: daysPerWeek,
                totalVolume: trainingOutput?.weeklyVolume ?? 0,
                avgIntensity: trainingOutput?.estimatedProgress ? Math.round(50 + trainingOutput.estimatedProgress * 5) : 0,
                goal, level, daysPerWeek, splitType, periodizationType, mesoLength,
              };
              const updated = [report, ...trainingArchive].slice(0, 20);
              setTrainingArchive(updated);
              try { localStorage.setItem('he_training_reports', JSON.stringify(updated)); } catch {}
              try { localStorage.setItem('he_training_report_current', JSON.stringify(report)); } catch {}
              setTrainingReportGenerated(true);
            }} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'var(--accent)', color: '#000', border: 'none', cursor: 'pointer', width: '100%' }}>
              Сгенерировать отчёт
            </button>
            {trainingReportGenerated && <p style={{ margin: '6px 0 0', fontSize: 11, color: '#22c55e' }}>✓ Отчёт сохранён</p>}
            {trainingArchive.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>Архив ({trainingArchive.length})</span>
                  <button onClick={() => { setTrainingArchive([]); localStorage.removeItem('he_training_reports'); setTrainingReportGenerated(false); }}
                    style={{ padding: '3px 8px', borderRadius: 5, fontSize: 9, background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none', cursor: 'pointer' }}>Очистить</button>
                </div>
                {[...trainingArchive].slice(0, 3).map((r: any) => (
                  <div key={r.id} style={{ fontSize: 10, padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', color: 'var(--text-dim)' }}>
                    {new Date(r.date).toLocaleDateString('ru')} · {r.planWeeks} нед · {r.goal}
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Workout Comparison */}
          {historyWorkouts.length >= 2 && <WorkoutComparisonCard historyWorkouts={historyWorkouts} />}
          {/* Exercise Substitution */}
          <div style={style.card}>
            <div style={style.label}>🔄 Подбор замены</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>Альтернативы по мышечной группе</div>
            <ExerciseSubstitutionCard />
          </div>
          {/* 1RM Calculator — existing component */}
          <div style={style.card}>
            <OneRmCalcTab />
          </div>
          {/* Warm-up Ramp Calculator */}
          <WarmupRampCard />
          {/* Plate Calculator — existing component */}
          <div style={style.card}>
            <PlateCalcTab />
          </div>
          {/* JSON Full Backup */}
          <div style={style.card}>
            <div style={style.label}>💾 Полный бэкап</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>Экспорт/импорт всех данных дневника (JSON)</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => {
                const backup = {
                  version: 1,
                  date: new Date().toISOString(),
                  workouts: historyWorkouts,
                  measurements,
                  reports: trainingArchive,
                  rirCalibration: (() => { try { return JSON.parse(localStorage.getItem('he_rir_calibration') || 'null'); } catch { return null; } })(),
                  mmc: (() => { try { return JSON.parse(localStorage.getItem('he_mmc_data') || '[]'); } catch { return []; } })(),
                };
                const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `diary_backup_${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }} style={{ flex: 1, padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'var(--accent)', color: '#000', border: 'none', cursor: 'pointer' }}>
                📥 Экспорт
              </button>
              <label style={{ flex: 1, padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: 'none', cursor: 'pointer', textAlign: 'center' }}>
                📤 Импорт
                <input type="file" accept=".json" onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    try {
                      const data = JSON.parse(reader.result as string);
                      if (data.version !== 1 || !data.workouts) { alert('Неверный формат бэкапа'); return; }
                      const existing = historyWorkouts;
                      const existingIds = new Set(existing.map((w: any) => w.id || w.date));
                      const newWorkouts = data.workouts.filter((w: any) => !existingIds.has(w.id || w.date));
                      if (newWorkouts.length === 0) { alert('Все тренировки уже есть в дневнике'); return; }
                      const merged = [...existing, ...newWorkouts];
                      try { localStorage.setItem('he_training_sessions', JSON.stringify(merged)); } catch {}
                      if (data.measurements?.length) {
                        const existM = loadMeasurements();
                        const existDates = new Set(existM.map((m: any) => m.date));
                        const newM = data.measurements.filter((m: any) => !existDates.has(m.date));
                        if (newM.length) { try { newM.forEach((m: any) => saveMeasurement(m)); } catch {} }
                      }
                      alert(`Импортировано: ${newWorkouts.length} тренировок${data.measurements?.length ? `, ${data.measurements.length} замеров` : ''}`);
                      onRefresh();
                    } catch { alert('Ошибка чтения файла'); }
                  };
                  reader.readAsText(file);
                  e.target.value = '';
                }} style={{ display: 'none' }} />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrainingDiaryHub;
