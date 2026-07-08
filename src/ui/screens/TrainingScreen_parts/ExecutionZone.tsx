/** ExecutionZone.tsx — зона «Тренировка» (выполнение): live-сессия, таймеры, миксы.
 * Содержимое зоны — ровно эти 3 вкладки; нигде больше они не рендерятся. */
import React from 'react';
import { InfoErrorBoundary } from '../SupportScreen_parts/SupportScreenData';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import { StrengthDiary } from '../../../engines/strength-diary.engine';
import type { TrainingOutput, MovementPattern } from '../../../core/types';
import type { MacrocyclePlan, Microcycle } from '../../../engines/training-periodization.engine';
import { SessionPlayer, type PlayerDay } from '../SRCBBScreen_parts/SessionPlayer';
import { TimersTab } from './TimersTab';
import { selectSetScheme } from '../../../engines/set-scheme.engine';
import { selectTempo, formatTempo } from '../../../engines/tempo.engine';
import { TrainingMixTab } from './TrainingMixTab';
import type { TrainingTab } from './shared';

type RuntimeLogEntry = { sets: { weight: number; reps: number; rpe: number; rir: number }[]; completed: boolean };
type PlRuntime = { days: PlayerDay[]; focus: string; week: number; track: string };

interface Props {
  tab: TrainingTab;
  goal: string; level: string; recovery: number;
  trainingOutput: TrainingOutput | null;
  macrocycle: MacrocyclePlan | null;
  selectedWeek: number;
  currentMicrocycle: Microcycle | null;
  runtimeDay: number; setRuntimeDay: React.Dispatch<React.SetStateAction<number>>;
  runtimeExIdx: number; setRuntimeExIdx: React.Dispatch<React.SetStateAction<number>>;
  runtimeLogs: Record<string, RuntimeLogEntry>; setRuntimeLogs: React.Dispatch<React.SetStateAction<Record<string, RuntimeLogEntry>>>;
  runtimeStarted: boolean; setRuntimeStarted: React.Dispatch<React.SetStateAction<boolean>>;
  plRuntime: PlRuntime | null; plRunOpen: boolean; setPlRunOpen: React.Dispatch<React.SetStateAction<boolean>>;
  runtimeSetW: number; setRuntimeSetW: React.Dispatch<React.SetStateAction<number>>;
  runtimeSetR: number; setRuntimeSetR: React.Dispatch<React.SetStateAction<number>>;
  runtimeSetRP: number; setRuntimeSetRP: React.Dispatch<React.SetStateAction<number>>;
  runtimeSetRI: number; setRuntimeSetRI: React.Dispatch<React.SetStateAction<number>>;
  diary: StrengthDiary;
  onRefresh: () => void;
}

export const ExecutionZone: React.FC<Props> = (p) => {
  const { tab, goal, level, recovery, trainingOutput, macrocycle, selectedWeek, currentMicrocycle,
    runtimeDay, setRuntimeDay, runtimeExIdx, setRuntimeExIdx, runtimeLogs, setRuntimeLogs,
    runtimeStarted, setRuntimeStarted, plRuntime, plRunOpen, setPlRunOpen,
    runtimeSetW, setRuntimeSetW, runtimeSetR, setRuntimeSetR, runtimeSetRP, setRuntimeSetRP, runtimeSetRI, setRuntimeSetRI,
    diary, onRefresh: loadDiaryStats } = p;
  return (
    <>
      {tab === 'runtime' && (
        <InfoErrorBoundary label="Тренировка">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Запуск построенного плана ПЛ/ББ */}
          {plRuntime && plRuntime.days.length > 0 && !plRunOpen && !runtimeStarted && (
            <div className="card" style={{ padding: '12px', border: '1px solid rgba(0,230,138,0.25)', background: 'rgba(0,230,138,0.06)' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 13, color: 'var(--accent)' }}>▶ Запустить построенный план ({plRuntime.track === 'bb' ? 'ББ' : 'ПЛ'})</h3>
              <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 8px' }}>Неделя {plRuntime.week} · {plRuntime.days.length} дн. · фокус: {plRuntime.focus}. Выполнение записывается в дневник тренировок.</p>
              <button onClick={() => setPlRunOpen(true)} style={{ width: '100%', padding: 12, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, var(--accent), #00c853)', color: '#000', fontWeight: 700, fontSize: 14 }}>▶ Начать выполнение</button>
            </div>
          )}
          {plRunOpen && plRuntime && plRuntime.days.length > 0 && (
            <div className="card" style={{ padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: 13, color: 'var(--accent)' }}>▶ Выполнение плана · {plRuntime.focus}</h3>
                <button onClick={() => setPlRunOpen(false)} style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 11 }}>✕ Закрыть</button>
              </div>
              <SessionPlayer days={plRuntime.days} weekNumber={plRuntime.week} focus={plRuntime.focus} />
            </div>
          )}
          {!runtimeStarted ? (
            <div className="card" style={{ padding: '12px' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>🏃 Начать тренировку</h3>
              <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 10px' }}>
                Выберите день из плана для отслеживания подходов в реальном времени.
              </p>
              {macrocycle && currentMicrocycle ? (
                <>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
                    {(() => { const _td = currentMicrocycle.days.filter((d: any) => d.isTraining); const _todayIdx = (((new Date().getDay() + 6) % 7)) % Math.max(1, _td.length); return (
                      <button onClick={() => setRuntimeDay(_todayIdx)} title="Сегодня (по дню недели)" style={{ padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: 'rgba(0,230,138,0.12)', color: 'var(--accent)', border: '1px solid rgba(0,230,138,0.4)' }}>📅 Сегодня</button>
                    ); })()}
                    {currentMicrocycle.days.filter((d: any) => d.isTraining).map((day: any, di: number) => (
                      <button key={di} onClick={() => setRuntimeDay(di)} style={{
                        padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: runtimeDay === di ? 700 : 400, cursor: 'pointer',
                        background: runtimeDay === di ? 'var(--accent)' : 'var(--bg-secondary)',
                        color: runtimeDay === di ? '#000' : 'var(--text)', border: '1px solid ' + (runtimeDay === di ? 'var(--accent)' : 'var(--border)'),
                      }}>{day.day}</button>
                    ))}
                  </div>
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                {currentMicrocycle.days.filter((d: any) => d.isTraining)[runtimeDay]?.exercises?.length || 0} упражнений • {currentMicrocycle.days.filter((d: any) => d.isTraining)[runtimeDay]?.duration || 60} мин
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
                Интенсивность: {currentMicrocycle.days.filter((d: any) => d.isTraining)[runtimeDay]?.intensity || 'средняя'} | Схема: {currentMicrocycle.mesocycleType || ''}
              </div>
              <div style={{ fontSize: 10, color: 'var(--accent)', marginTop: 2, fontWeight: 600 }}>
                Расчётный тоннаж: {currentMicrocycle.days.filter((d: any) => d.isTraining)[runtimeDay]?.exercises?.reduce((sum: number, ex: any) => sum + (ex.sets || 0) * (Number(ex.reps) || 0) * (ex.weight || 0), 0) || 0} кг
              </div>
            </div>
                  {/* Session difficulty estimate */}
                  {(() => {
                    const dayExercises = currentMicrocycle.days.filter((d: any) => d.isTraining)[runtimeDay]?.exercises || [];
                    const totalSets = dayExercises.reduce((s: number, e: any) => s + (e.sets || 0), 0);
                    const avgIntensity = dayExercises.length > 0
                      ? dayExercises.reduce((s: number, e: any) => s + (e.intensity || 70), 0) / dayExercises.length
                      : 70;
                    const difficulty = totalSets > 25 ? 'очень тяжёлая' : totalSets > 15 ? 'средняя' : 'лёгкая';
                    const color = totalSets > 25 ? '#ef4444' : totalSets > 15 ? '#f59e0b' : '#22c55e';
                    return (
                      <div style={{ fontSize: 10, margin: '6px 0', padding: '6px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.03)' }}>
                        <span style={{ color: 'var(--text-dim)' }}>Сложность: </span>
                        <span style={{ fontWeight: 600, color }}>{difficulty}</span>
                        <span style={{ color: 'var(--text-dim)', marginLeft: 6 }}>· {totalSets} подходов · ~{avgIntensity.toFixed(0)}% ср.</span>
                        {totalSets > 25 && (
                          <div style={{ color: '#f97316', marginTop: 2 }}>⚠ Высокий объём — отдых ≥ 3 мин между подходами</div>
                        )}
                      </div>
                    );
                  })()}
                  <button onClick={() => { setRuntimeStarted(true); setRuntimeLogs({}); setRuntimeExIdx(0); }} style={{
                    width: '100%', padding: 12, borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: 'linear-gradient(135deg, var(--accent), #00c853)', color: '#000', fontWeight: 700, fontSize: 14,
                  }}>▶ Старт</button>
                </>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: 11 }}>
                  Сначала сгенерируйте план во вкладке 📋 План
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Active workout */}
              {currentMicrocycle && (() => {
                const day = currentMicrocycle.days.filter((d: any) => d.isTraining)[runtimeDay];
                if (!day) return null;
                const exercises = day.exercises || [];
                const ex = exercises[runtimeExIdx];
                if (!ex) return (
                  <div className="card" style={{ textAlign: 'center', padding: 20 }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>🏆</div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Тренировка завершена!</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12 }}>
                      {Object.values(runtimeLogs).filter(l => l.completed).length} из {exercises.length} упражнений выполнено
                    </div>
                    {/* Summary stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 12, fontSize: 10 }}>
                      {(() => {
                        const totalSets = Object.values(runtimeLogs).reduce((s, l) => s + l.sets.length, 0);
                        const totalVolume = Object.values(runtimeLogs).reduce((s, l) => s + l.sets.reduce((ss, st) => ss + st.weight * st.reps, 0), 0);
                        const max1RM = Object.values(runtimeLogs).reduce((max, l) => {
                          const local = l.sets.reduce((m, st) => Math.max(m, Math.round(st.weight * (1 + st.reps / 30))), 0);
                          return Math.max(max, local);
                        }, 0);
                        return (
                          <>
                            <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 6, padding: 6 }}>
                              <div style={{ color: 'var(--text-dim)', fontSize: 8 }}>Подходов</div>
                              <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{totalSets}</div>
                            </div>
                            <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 6, padding: 6 }}>
                              <div style={{ color: 'var(--text-dim)', fontSize: 8 }}>Тоннаж</div>
                              <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{totalVolume.toLocaleString()} кг</div>
                            </div>
                            <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 6, padding: 6 }}>
                              <div style={{ color: 'var(--text-dim)', fontSize: 8 }}>Макс 1RM</div>
                              <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{max1RM} кг</div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                      <button onClick={async () => {
                        // Save completed workout to IndexedDB
                        const completedExercises = Object.entries(runtimeLogs)
                          .filter(([_, log]) => log.sets.length > 0)
                          .map(([exId, log]) => ({
                            exerciseId: exId,
                            exerciseName: EXERCISE_CATALOG.find(e => e.id === exId)?.name || exId,
                            sets: log.sets,
                            totalVolume: log.sets.reduce((sum, s) => sum + s.weight * s.reps, 0),
                            maxWeight: Math.max(...log.sets.map(s => s.weight), 0),
                            estimated1RM: log.sets.length > 0
                              ? Math.round(log.sets[log.sets.length - 1].weight * (1 + log.sets[log.sets.length - 1].reps / 30))
                              : 0,
                          }));
                        const totalVolume = completedExercises.reduce((s, e) => s + e.totalVolume, 0);
                        if (completedExercises.length > 0) {
                          const dateStr = new Date().toISOString().split('T')[0];
                          const ts = Date.now();
                          const strengthEntries = completedExercises.map((ex, i) => ({
                            id: `log_${ts}_${i}`,
                            date: dateStr,
                            exerciseId: ex.exerciseId,
                            exerciseName: ex.exerciseName,
                            sets: ex.sets,
                            totalVolume: ex.totalVolume,
                            estimated1RM: ex.estimated1RM,
                            isCompound: EXERCISE_CATALOG.find(e => e.id === ex.exerciseId)?.type === 'compound',
                            weekNumber: selectedWeek,
                          }));
                          await diary.saveWorkoutLog({
                            id: `workout_${ts}`,
                            date: dateStr,
                            duration: Math.round(runtimeExIdx * 5 + completedExercises.reduce((s, e) => s + e.sets.length, 0) * 3),
                            exercises: strengthEntries,
                            overallRPE: 7,
                            recoveryBefore: recovery,
                            split: trainingOutput?.splitName || 'custom',
                            weekNumber: selectedWeek,
                          });
                          for (const se of strengthEntries) {
                            await diary.saveStrengthLog(se);
                          }
                          // Reload stats and history
                          await loadDiaryStats();
                        }
                        setRuntimeStarted(false);
                        setRuntimeLogs({});
                      }} style={{
                        padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
                        background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 13,
                      }}>✓ Завершить</button>
                    </div>
                  </div>
                );

                const log = runtimeLogs[ex.exerciseId || ex.name] || { sets: [], completed: false };
                const totalSets = ex.sets || 3;
                const currentSet = log.sets.length + 1;

                const last1RM = log.sets.length > 0
                  ? Math.round(log.sets[log.sets.length - 1].weight * (1 + log.sets[log.sets.length - 1].reps / 30))
                  : 0;

                const estimatedVolume = log.sets.reduce((s, st) => s + st.weight * st.reps, 0);
                const avgRPE = log.sets.length > 0 ? Math.round(log.sets.reduce((s, st) => s + st.rpe, 0) / log.sets.length * 10) / 10 : 0;

                const scheme = selectSetScheme({
                  goal, movementPattern: 'squat' as MovementPattern, difficultyLevel: level === 'beginner' ? 'low' : level === 'intermediate' ? 'medium' : 'high',
                  techniqueIssues: [], riskFlags: {}, fatigueScore: 0.3, repPattern: 'normal', isPrimaryLift: runtimeExIdx === 0,
                });
                const tempo = selectTempo(goal, [], {}, ex.isCompound);

                return (
                  <div className="card" style={{ padding: '10px 12px' }}>
                    {/* Exercise header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div>
                        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>Упражнение {runtimeExIdx + 1}/{exercises.length}</span>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>{ex.name}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>  
                        <span style={{ fontSize: 9, padding: '2px 5px', borderRadius: 3, background: 'rgba(0,230,138,0.1)', color: '#00e68a' }}>{scheme?.schemeType || 'straight'}</span>
                        <span style={{ fontSize: 9, padding: '2px 5px', borderRadius: 3, background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>{formatTempo(tempo)}</span>
                      </div>
                    </div>

                    {/* Target */}
                    <div style={{ display: 'flex', gap: 12, marginBottom: 4, fontSize: 10, color: 'var(--text-dim)' }}>
                      <span>Цель: {ex.sets}×{ex.reps}</span>
                      <span>RIR: {ex.rir}</span>
                      {ex.weight && <span>Вес: {ex.weight}кг | ~{Math.round(ex.weight * (1 + Number(ex.reps) / 30))}кг 1RM</span>}
                    </div>

                    {/* Technique note */}
                    {ex.technique && (
                      <div style={{ marginBottom: 6, padding: '5px 8px', background: 'rgba(0,230,138,0.05)', borderRadius: 6, fontSize: 9, color: 'var(--text)', lineHeight: 1.4 }}>
                        <span style={{ fontWeight: 600, color: 'var(--accent)' }}>🎯 </span>{ex.technique}
                      </div>
                    )}

                    {/* Warmup ramp-up (first set only) */}
                    {log.sets.length === 0 && ex.weight && (
                      <div style={{ marginBottom: 6, padding: '5px 8px', background: 'rgba(255,145,0,0.05)', borderRadius: 6, fontSize: 9 }}>
                        <div style={{ fontWeight: 600, color: '#ff9100', marginBottom: 3 }}>🔥 Разминочные подходы</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 2, color: 'var(--text-dim)' }}>
                          {[{ pct: 20, reps: 10 }, { pct: 40, reps: 5 }, { pct: 60, reps: 3 }, { pct: 75, reps: 1 }].map(wu => (
                            <div key={wu.pct} style={{ textAlign: 'center', padding: '2px 4px', background: 'rgba(255,145,0,0.08)', borderRadius: 3 }}>
                              <div style={{ color: '#ff9100', fontWeight: 600 }}>~{Math.round((ex.weight || 80) * wu.pct / 100)}кг</div>
                              <div style={{ fontSize: 7 }}>{wu.reps} повт</div>
                              <div style={{ fontSize: 7 }}>{wu.pct}%</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Progress bar */}
                    <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 4, height: 6, marginBottom: 8, overflow: 'hidden' }}>
                      <div style={{ width: `${(currentSet / totalSets) * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 4, transition: 'width 0.3s' }} />
                    </div>

                    {/* Previous sets log */}
                    {log.sets.length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 2 }}>Выполнено:</div>
                        {log.sets.map((s, si) => (
                          <div key={si} style={{ display: 'flex', gap: 8, fontSize: 10, padding: '2px 0' }}>
                            <span style={{ fontWeight: 600, minWidth: 16 }}>#{si + 1}</span>
                            <span>{s.weight}кг × {s.reps}</span>
                            <span style={{ color: 'var(--text-dim)' }}>RPE {s.rpe}</span>
                            <span style={{ color: 'var(--text-dim)' }}>RIR {s.rir}</span>
                            <span style={{ color: 'var(--accent)' }}>1RM ~{Math.round(s.weight * (1 + s.reps / 30))}кг</span>
                          </div>
                        ))}
                        {last1RM > 0 && (
                          <div style={{ fontSize: 9, color: 'var(--accent)', marginTop: 2 }}>1RM последний: {last1RM}кг | Объём: {estimatedVolume}кг | RPE ср: {avgRPE}</div>
                        )}
                        {/* Autoregulation hint */}
                        {log.sets.length >= 1 && (() => {
                          const lastSet = log.sets[log.sets.length - 1];
                          let hint = '';
                          let hintColor = 'var(--text-dim)';
                          if (lastSet.rpe <= 5 && lastSet.rir >= 3) {
                            hint = 'Подход лёгкий: можно добавить 2.5-5 кг или 1-2 повтора в следующем подходе.';
                            hintColor = '#22c55e';
                          } else if (lastSet.rpe >= 9.5 && lastSet.rir <= 0) {
                            hint = 'Подход на пределе: снизьте вес на 5-10% или завершите упражнение.';
                            hintColor = '#ef4444';
                          } else if (lastSet.rpe >= 8.5 && lastSet.rir <= 1) {
                            hint = 'Высокая тяжесть: сохраняйте вес, но не идите в отказ.';
                            hintColor = '#f59e0b';
                          }
                          if (!hint) return null;
                          return <div style={{ fontSize: 9, color: hintColor, marginTop: 2, fontWeight: 600 }}>{hint}</div>;
                        })()}
                      </div>
                    )}

                    {/* Set input form (if not completed) */}
                    {!log.completed && (
                      <div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 6 }}>
                          <div>
                            <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Вес (кг)</label>
                            <input type="number" value={runtimeSetW} onChange={e => setRuntimeSetW(parseFloat(e.target.value) || 0)}
                              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Повторения</label>
                            <input type="number" value={runtimeSetR} onChange={e => setRuntimeSetR(parseFloat(e.target.value) || 0)}
                              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>RPE (1-10)</label>
                            <input type="number" min={1} max={10} value={runtimeSetRP} onChange={e => setRuntimeSetRP(parseFloat(e.target.value) || 0)}
                              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>RIR</label>
                            <input type="number" min={0} max={5} value={runtimeSetRI} onChange={e => setRuntimeSetRI(parseFloat(e.target.value) || 0)}
                              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
                          </div>
                        </div>
                        <button onClick={() => {
                          const newLog = { ...log, sets: [...log.sets, { weight: runtimeSetW, reps: runtimeSetR, rpe: runtimeSetRP, rir: runtimeSetRI }] };
                          setRuntimeLogs({ ...runtimeLogs, [ex.exerciseId || ex.name]: newLog });
                        }} style={{
                          width: '100%', padding: 8, borderRadius: 6, border: 'none', cursor: 'pointer',
                          background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 12,
                          marginBottom: 4,
                        }}>✓ Записать подход {currentSet}/{totalSets}</button>
                        <button onClick={() => {
                          const newLog = { ...log, completed: true };
                          setRuntimeLogs({ ...runtimeLogs, [ex.exerciseId || ex.name]: newLog });
                          if (runtimeExIdx < exercises.length - 1) setRuntimeExIdx(runtimeExIdx + 1);
                        }} style={{
                          width: '100%', padding: 6, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer',
                          background: 'transparent', color: 'var(--text-dim)', fontSize: 11,
                        }}>Пропустить →</button>
                      </div>
                    )}
                    {log.completed && (
                      <div style={{ textAlign: 'center', padding: 8, background: 'rgba(0,230,138,0.1)', borderRadius: 6 }}>
                        <span style={{ color: '#22c55e', fontWeight: 600 }}>✓ Выполнено — {log.sets.length} подхода(ов)</span>
                        <div style={{ marginTop: 6 }}>
                          <button onClick={() => {
                            if (runtimeExIdx < exercises.length - 1) setRuntimeExIdx(runtimeExIdx + 1);
                          }} style={{
                            padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
                            background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 13,
                          }}>Следующее упражнение →</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </>
          )}
        </div>
        </InfoErrorBoundary>
      )}
      {tab === 'timers' && <InfoErrorBoundary label="Таймеры"><TimersTab /></InfoErrorBoundary>}
      {tab === 'mixes' && (
        <InfoErrorBoundary label="Тренировочные миксы">
          <TrainingMixTab />
        </InfoErrorBoundary>
      )}
    </>
  );
};
