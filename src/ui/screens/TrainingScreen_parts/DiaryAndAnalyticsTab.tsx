import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { EXERCISE_CATALOG, getExerciseById } from '../../../core/exercise-catalog';
import { StrengthDiary, type StrengthStats, type WeeklyProgress } from '../../../engines/strength-diary.engine';
import type { WorkoutLog, StrengthLogEntry } from '../../../core/types';
import { computeAnalytics, type AnalyticsSnapshot } from '../../../engines/analytics-engine';
import { weeklySetsByGroup } from '../../../engines/training-recommendations.engine';
import { LEVEL_VOLUMES } from '../../../engines/training.engine';
import type { MacrocyclePlan } from '../../../engines/training-periodization.engine';
import { useIsMobile } from './useIsMobile';

const ACCENT = '#00e68a';
const GRP_RU: Record<string, string> = { chest:'Грудь', back:'Спина', legs:'Ноги', shoulders:'Плечи', arms:'Руки', core:'Кор', hamstrings:'Бицепс бедра', glutes:'Ягодицы', calves:'Икры', triceps:'Трицепс', biceps:'Бицепс', quads:'Квадрицепсы' };
const GROUP_COLORS: Record<string, string> = { chest:'#00e68a', back:'#60a5fa', legs:'#f59e0b', shoulders:'#a855f7', arms:'#ef4444', core:'#22c55e' };
const FELT_LABELS = ['👎 Ужасно','😟 Плохо','😐 Нормально','🙂 Хорошо','😄 Отлично'];
const SP_LABELS: Record<string, string> = { fullbody:'Фулбоди', upper_lower:'Верх/Низ', push_pull:'Жим/Тяга', ppl:'PPL', bro:'Сплит', legs_push_pull:'Ноги/Жим/Тяга', custom:'Свой' };

const style: Record<string, React.CSSProperties> = {
  card: { padding: 12, borderRadius: 14, background: 'rgba(24,24,27,0.12)', border: '1px solid rgba(255,255,255,0.04)', marginBottom: 8 },
  label: { fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 500, letterSpacing: '0.3px', textTransform: 'uppercase', marginBottom: 8 },
  input: { width: '100%', padding: '6px 4px', borderRadius: 6, background: '#18181b', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 11, boxSizing: 'border-box' },
  btn: { width: '100%', padding: 9, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,var(--accent),#00cc7a)', color: '#000', fontWeight: 700, fontSize: 12 },
};

interface DiaryAndAnalyticsTabProps {
  diary: StrengthDiary;
  diaryStats: StrengthStats[];
  diaryProgress: WeeklyProgress[];
  historyWorkouts: WorkoutLog[];
  macrocycle: MacrocyclePlan | null;
  selectedWeek: number;
  level: string;
  onRefresh: () => void;
}

export const DiaryAndAnalyticsTab: React.FC<DiaryAndAnalyticsTabProps> = ({ diary, diaryStats, diaryProgress, historyWorkouts, macrocycle, selectedWeek, level, onRefresh }) => {
  const [mode, setMode] = useState<'diary' | 'history' | 'analytics'>('diary');
  const isMobile = useIsMobile();
  const [search, setSearch] = useState('');

  // Logging state — multi-exercise session
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
        id: `${wid}_${i}`,
        date: logDate,
        exerciseId: e.exerciseId,
        exerciseName: cat?.name || e.exerciseId,
        sets: [{ weight: e.weight, reps: e.reps, rir: e.rir }],
        totalVolume: e.weight * e.reps,
        estimated1RM: Math.round(e.weight * (1 + e.reps / 30)),
        isCompound: cat?.type === 'compound',
        weekNumber: selectedWeek,
      };
    });
    const workoutLog: WorkoutLog = {
      id: wid,
      date: logDate,
      duration: logDuration,
      exercises: exList,
      overallRPE: logRPE,
      recoveryBefore: logRecovery,
      split: logSplit,
      weekNumber: selectedWeek,
      notes: `Самочувствие: ${FELT_LABELS[logFelt]}${logNotes ? ' · ' + logNotes : ''}`,
    };
    await diary.saveWorkoutLog(workoutLog);
    for (const ex of exList) {
      await diary.saveStrengthLog(ex);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    setLogExercises([]);
    setLogNotes('');
    setLogDuration(60);
    setLogRPE(7);
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
  const maxTotal = Math.max(1, ...totals);

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

  const PHASE_RU: Record<string, string> = { accumulation:'Накопление', intensification:'Интенсификация', peaking:'Пик', deload:'Разгрузка', recovery:'Восстановление' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Mode bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 2 }}>
        {([['diary','📝 Запись'],['history','📜 История'],['analytics','📊 Аналитика']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setMode(k)} style={{
            flex: 1, padding: '6px 8px', borderRadius: 8, border: mode === k ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.06)',
            background: mode === k ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.02)', color: mode === k ? 'var(--accent)' : 'var(--text-dim)', fontWeight: mode === k ? 700 : 400, fontSize: 11, cursor: 'pointer',
          }}>{l}</button>
        ))}
      </div>

      {/* ═══ PROGRAM/CYCLE CONTEXT (always visible) ═══ */}
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

      {/* ═══ MODE: DIARY (запись тренировки) ═══ */}
      {mode === 'diary' && (
        <div style={style.card}>
          <div style={style.label}>📝 Записать тренировку</div>
          {/* Date + Duration + RPE row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 6 }}>
            <div>
              <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Дата</label>
              <input type="date" value={logDate} onChange={e => setLogDate(e.target.value)} style={style.input} />
            </div>
            <div>
              <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Длительность (мин)</label>
              <input type="number" min={1} value={logDuration} onChange={e => setLogDuration(parseInt(e.target.value) || 0)} style={style.input} />
            </div>
            <div>
              <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>RPE (1-10)</label>
              <input type="number" min={1} max={10} value={logRPE} onChange={e => setLogRPE(parseInt(e.target.value) || 5)} style={style.input} />
            </div>
          </div>
          {/* Recovery + Split + Felt row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 6 }}>
            <div>
              <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Восстановление (1-10)</label>
              <input type="number" min={1} max={10} value={logRecovery} onChange={e => setLogRecovery(parseInt(e.target.value) || 5)} style={style.input} />
            </div>
            <div>
              <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Сплит</label>
              <select value={logSplit} onChange={e => setLogSplit(e.target.value)} style={style.input}>
                {Object.entries(SP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Самочувствие</label>
              <select value={logFelt} onChange={e => setLogFelt(parseInt(e.target.value))} style={style.input}>
                {FELT_LABELS.map((l, i) => <option key={i} value={i}>{l}</option>)}
              </select>
            </div>
          </div>
          {/* Notes */}
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Заметки</label>
            <input type="text" value={logNotes} onChange={e => setLogNotes(e.target.value)} placeholder="Самочувствие, особенности, инвентарь..." style={style.input} />
          </div>
          {/* Add exercise */}
          <div style={style.label}>🏋️ Упражнения</div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr 1fr auto' : '1fr 0.5fr 0.5fr 0.5fr auto', gap: 4, marginBottom: 6, alignItems: 'end' }}>
            <div style={isMobile ? { gridColumn: '1 / -1' } : undefined}>
              <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Упражнение</label>
              <select value={exId} onChange={e => setExId(e.target.value)} style={style.input}>
                <option value="">— Выбрать —</option>
                {EXERCISE_CATALOG.slice(0, 50).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Вес (кг)</label>
              <input type="number" value={exW} onChange={e => setExW(parseFloat(e.target.value) || 0)} style={style.input} />
            </div>
            <div>
              <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Повт</label>
              <input type="number" value={exR} onChange={e => setExR(parseInt(e.target.value) || 0)} style={style.input} />
            </div>
            <div>
              <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>RIR</label>
              <input type="number" min={0} max={5} value={exRI} onChange={e => setExRI(parseInt(e.target.value) || 0)} style={style.input} />
            </div>
            <button onClick={addExercise} disabled={!exId} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--accent)', background: exId ? 'rgba(0,230,138,0.12)' : 'transparent', color: exId ? 'var(--accent)' : 'var(--text-dim)', cursor: exId ? 'pointer' : 'not-allowed', fontSize: 11, whiteSpace: 'nowrap' }}>+ Добавить</button>
          </div>
          {/* Exercise list */}
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
          {/* Summary + save */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 10, color: 'var(--text-dim)' }}>
            <span>Всего: {logExercises.length} упр. · {logExercises.reduce((s, e) => s + e.weight * e.reps, 0)} кг·повт</span>
            {saved && <span style={{ color: 'var(--accent)', fontWeight: 700 }}>✅ Сохранено!</span>}
          </div>
          <button onClick={handleSaveWorkout} disabled={logExercises.length === 0} style={{ ...style.btn, opacity: logExercises.length === 0 ? 0.4 : 1 }}>
            💾 Сохранить тренировку
          </button>
        </div>
      )}

      {/* ═══ MODE: HISTORY (история тренировок + аналитика в одном) ═══ */}
      {mode === 'history' && (
        <div>
          {/* Quick stats */}
          {diaryProgress.length > 0 && (
            <div style={style.card}>
              <div style={style.label}>🔥 Активность</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, fontSize: 10 }}>
                <div style={{ textAlign: 'center', background: 'rgba(0,230,138,0.05)', borderRadius: 6, padding: 6 }}>
                  <div style={{ color: 'var(--text-dim)' }}>Недель</div>
                  <div style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 16 }}>{diaryProgress.length}</div>
                </div>
                <div style={{ textAlign: 'center', background: 'rgba(96,165,250,0.05)', borderRadius: 6, padding: 6 }}>
                  <div style={{ color: 'var(--text-dim)' }}>Тренировок</div>
                  <div style={{ fontWeight: 700, color: '#60a5fa', fontSize: 16 }}>{diaryProgress.reduce((s, w) => s + w.workoutCount, 0)}</div>
                </div>
                <div style={{ textAlign: 'center', background: 'rgba(245,158,11,0.05)', borderRadius: 6, padding: 6 }}>
                  <div style={{ color: 'var(--text-dim)' }}>Объём (тек.нед)</div>
                  <div style={{ fontWeight: 700, color: '#f59e0b', fontSize: 16 }}>{diaryProgress.length > 0 ? `${(diaryProgress[diaryProgress.length - 1]?.totalVolume / 1000).toFixed(1)}т` : '—'}</div>
                </div>
                <div style={{ textAlign: 'center', background: 'rgba(34,197,94,0.05)', borderRadius: 6, padding: 6 }}>
                  <div style={{ color: 'var(--text-dim)' }}>ACWR</div>
                  <div style={{ fontWeight: 700, color: '#22c55e', fontSize: 16 }}>—</div>
                </div>
              </div>
              {/* Volume bar chart */}
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 4 }}>📈 Тоннаж по неделям</div>
                <div style={{ display: 'flex', gap: 2, height: 50, alignItems: 'flex-end' }}>
                  {diaryProgress.slice(-12).map((w, i) => {
                    const maxVol = Math.max(...diaryProgress.map(w => w.totalVolume), 1);
                    const h = Math.max(4, (w.totalVolume / maxVol) * 100);
                    return (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                        <div style={{ width: '70%', height: `${h}%`, background: w.totalVolume === maxVol ? 'var(--accent)' : 'rgba(0,230,138,0.3)', borderRadius: '2px 2px 0 0' }} />
                        <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>{w.week}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          {/* Search */}
          <div style={{ marginBottom: 6 }}>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Поиск по неделе..." style={style.input} />
          </div>
          {/* Workout history grouped by week */}
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

      {/* ═══ MODE: ANALYTICS (аналитика + графики) ═══ */}
      {mode === 'analytics' && (
        <div>
          {/* Program context */}
          {macrocycle && curPhase && (
            <div style={{ ...style.card, border: '1px solid rgba(0,230,138,0.12)' }}>
              <div style={style.label}>🎯 Текущий цикл</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, fontSize: 10 }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '4px 6px', textAlign: 'center' }}>
                  <div style={{ color: 'var(--text-dim)' }}>Фаза</div>
                  <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{PHASE_RU[curPhase.type] || curPhase.type}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '4px 6px', textAlign: 'center' }}>
                  <div style={{ color: 'var(--text-dim)' }}>Неделя</div>
                  <div style={{ fontWeight: 700, color: '#60a5fa' }}>{selectedWeek} / {macrocycle.totalWeeks}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '4px 6px', textAlign: 'center' }}>
                  <div style={{ color: 'var(--text-dim)' }}>Цель</div>
                  <div style={{ fontWeight: 700, color: '#f59e0b' }}>{macrocycle.goal}</div>
                </div>
              </div>
              {diaryProgress.length >= 2 && (() => {
                const last = diaryProgress[diaryProgress.length - 1];
                const prev = diaryProgress[diaryProgress.length - 2];
                const volDelta = prev.totalVolume > 0 ? Math.round((last.totalVolume - prev.totalVolume) / prev.totalVolume * 100) : 0;
                return (
                  <div style={{ marginTop: 6, fontSize: 10, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
                    Объём: {volDelta > 0 ? '+' : ''}{volDelta}% к пред.неделе {volDelta > 20 ? <span style={{ color: '#ef4444' }}>⚠ резкий скачок</span> : ''}
                  </div>
                );
              })()}
            </div>
          )}
          {/* Analytics cards */}
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
              {/* Volume by muscle group - stacked bars */}
              {totals.some(t => t > 0) && (
                <div style={style.card}>
                  <div style={style.label}>📊 Объём по неделям (сеты)</div>
                  <div style={{ display: 'flex', gap: 2, height: 80, alignItems: 'flex-end', marginBottom: 6 }}>
                    {totals.map((t, wi) => (
                      <div key={wi} style={{ flex: 1, display: 'flex', flexDirection: 'column-reverse', height: '100%', borderRadius: 3, overflow: 'hidden', background: t > 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                        {groups.map(g => {
                          const v = wsg[g]?.[wi] || 0;
                          if (v === 0) return null;
                          return <div key={g} style={{ flex: v, background: GROUP_COLORS[g] || '#888', minHeight: 2 }} />;
                        })}
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
              {/* Volume by group bars */}
              <div style={style.card}>
                <div style={style.label}>Объём по группам</div>
                {Object.entries(analytics.volume.volumeByGroup).sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 8).map(([group, vol]) => {
                  const v = vol as number;
                  const maxVol = Math.max(...Object.values(analytics.volume.volumeByGroup).map(v => v as number), 1);
                  return (
                    <div key={group} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ width: 80, fontSize: 10, color: 'var(--text-dim)', textAlign: 'right' }}>{GRP_RU[group] || group}</span>
                      <div style={{ flex: 1, height: 6, borderRadius: 4, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                        <div style={{ width: `${(v / maxVol) * 100}%`, height: '100%', background: '#8b5cf6', borderRadius: 4 }} />
                      </div>
                      <span style={{ fontSize: 9, color: 'var(--text-dim)', width: 50 }}>{Math.round(v).toLocaleString()} кг</span>
                    </div>
                  );
                })}
              </div>
              {/* 1RM estimate */}
              {Object.keys(analytics.strength.estimated1RM).length > 0 && (
                <div style={style.card}>
                  <div style={style.label}>🏆 Расчётный 1RM</div>
                  {Object.entries(analytics.strength.estimated1RM).sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 5).map(([exId, rm]) => {
                    const trend = analytics.strength.strengthTrend[exId] || 0;
                    const ex = EXERCISE_CATALOG.find((e: any) => e.id === exId);
                    return (
                      <div key={exId} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 11 }}>
                        <span style={{ color: 'var(--text-dim)' }}>{ex?.name || exId}</span>
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
            </>
          ) : (
            <div style={{ ...style.card, textAlign: 'center', padding: 24 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                {historyWorkouts.length === 0 ? 'Нет данных. Сначала запишите тренировки.' : 'Недостаточно данных для аналитики.'}
              </div>
              <button onClick={onRefresh} style={{ marginTop: 8, padding: '6px 14px', borderRadius: 8, border: '1px solid var(--accent)', background: 'transparent', color: 'var(--accent)', fontSize: 10, cursor: 'pointer' }}>🔄 Обновить</button>
            </div>
          )}
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
              { label:'Объём', value:`${Math.round(totalVol)} кг`, color:'#34d399' },
              { label:'Сетов', value:totalSets, color:'#60a5fa' },
              { label:'Длит.', value:`${Math.round(totalDur / Math.max(1, workouts.length))} мин`, color:'#f59e0b' },
            ].map((s, i) => <div key={i} style={{ background:'rgba(255,255,255,0.02)', borderRadius:6, padding:'4px 6px', textAlign:'center' }}>
              <div style={{ fontSize:8, color:'rgba(255,255,255,0.3)' }}>{s.label}</div>
              <div style={{ fontSize:12, fontWeight:700, color:s.color }}>{s.value}</div>
            </div>)}
          </div>
          {workouts.map((w: WorkoutLog, wi: number) => {
            return (
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
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DiaryAndAnalyticsTab;
