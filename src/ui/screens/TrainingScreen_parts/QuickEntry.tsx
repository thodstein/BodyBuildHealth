/**
 * QuickEntry.tsx — быстрый ввод тренировки для мобильного устройства.
 *
 * Оптимизирован для использования прямо в зале:
 *  - Large touch targets (≥44px)
 *  - Auto-suggest прошлые веса/повторы из дневника
 *  - Swipe-set: свайп вправо = записать подход, влево = пропустить
 *  - Авто-таймер отдыха между подходами
 *  - Минимальное количество полей
 */
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import { StrengthDiary } from '../../../engines/strength-diary.engine';
import { epley1RM } from '../../../engines/e1rm';
import type { WorkoutLog, StrengthLogEntry } from '../../../core/types';
import { exerciseMatchScore, getAliasesForExercise } from '../../../engines/exercise-aliases';
import { useIsMobile } from './useIsMobile';

const ACCENT = '#00e68a';

interface QuickEntryProps {
  diary: StrengthDiary;
  historyWorkouts: WorkoutLog[];
  selectedWeek: number;
  onSave: () => void;
}

interface SetRecord {
  weight: number;
  reps: number;
  rpe: number;
  rir: number;
  completed: boolean;
}

interface ExerciseRecord {
  exerciseId: string;
  exerciseName: string;
  sets: SetRecord[];
  isSuperset?: boolean;
  supersetWith?: string;
}

/**
 * Получить рекомендацию веса/повторов из предыдущих сессий
 */
function getPreviousWorkoutData(
  historyWorkouts: WorkoutLog[],
  exerciseName: string,
): { weight: number; reps: number; rir: number; date: string } | null {
  let best: { weight: number; reps: number; rir: number; date: string; e1rm: number } | null = null;
  for (const wl of historyWorkouts) {
    for (const ex of wl.exercises) {
      const score = exerciseMatchScore(ex.exerciseName, exerciseName);
      if (score >= 0.5) {
        const sets = ex.sets || [];
        for (const set of sets) {
          const e1rm = epley1RM(set.weight, set.reps);
          if (!best || e1rm > best.e1rm) {
            best = { weight: set.weight, reps: set.reps, rir: set.rir || 2, date: wl.date, e1rm };
          }
        }
      }
    }
  }
  return best ? { weight: best.weight, reps: best.reps, rir: best.rir, date: best.date } : null;
}

/**
 * Получить PR по упражнению
 */
function getPersonalRecord(
  historyWorkouts: WorkoutLog[],
  exerciseName: string,
): { weight: number; reps: number; e1rm: number } | null {
  let best: { weight: number; reps: number; e1rm: number } | null = null;
  for (const wl of historyWorkouts) {
    for (const ex of wl.exercises) {
      const score = exerciseMatchScore(ex.exerciseName, exerciseName);
      if (score >= 0.5) {
        for (const set of ex.sets || []) {
          const e1rm = epley1RM(set.weight, set.reps);
          if (!best || e1rm > best.e1rm) {
            best = { weight: set.weight, reps: set.reps, e1rm };
          }
        }
      }
    }
  }
  return best;
}

export const QuickEntry: React.FC<QuickEntryProps> = ({
  diary, historyWorkouts, selectedWeek, onSave,
}) => {
  const isMobile = useIsMobile();
  const [exercises, setExercises] = useState<ExerciseRecord[]>([]);
  const [currentExIdx, setCurrentExIdx] = useState(0);
  const [currentSetIdx, setCurrentSetIdx] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<typeof EXERCISE_CATALOG>([]);
  const [restTimer, setRestTimer] = useState(0);
  const [restTarget, setRestTarget] = useState(90);
  const [saved, setSaved] = useState(false);
  const [showPR, setShowPR] = useState<{ exercise: string; weight: number; reps: number; e1rm: number } | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const prTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (prTimerRef.current) clearTimeout(prTimerRef.current);
    };
  }, []);

  // Поиск упражнений
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const q = searchQuery.toLowerCase();
    const matches = EXERCISE_CATALOG
      .filter(ex => {
        if (ex.name.toLowerCase().includes(q) || ex.id.toLowerCase().includes(q)) return true;
        const aliases = getAliasesForExercise(ex.id);
        return aliases.some(a => a.toLowerCase().includes(q));
      })
      .slice(0, 8);
    setSearchResults(matches);
  }, [searchQuery]);

  // Таймер отдыха
  useEffect(() => {
    if (restTimer > 0) {
      timerRef.current = setTimeout(() => setRestTimer(prev => prev - 1), 1000);
      return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }
  }, [restTimer]);

  const currentEx = exercises[currentExIdx];
  const prevData = useMemo(() => {
    if (!currentEx) return null;
    return getPreviousWorkoutData(historyWorkouts, currentEx.exerciseName);
  }, [currentEx, historyWorkouts]);

  const currentPR = useMemo(() => {
    if (!currentEx) return null;
    return getPersonalRecord(historyWorkouts, currentEx.exerciseName);
  }, [currentEx, historyWorkouts]);

  const addExercise = useCallback((ex: typeof EXERCISE_CATALOG[0]) => {
    const newEx: ExerciseRecord = {
      exerciseId: ex.id,
      exerciseName: ex.name,
      sets: [{ weight: prevData?.weight || 0, reps: prevData?.reps || 10, rpe: 0, rir: prevData?.rir || 2, completed: false }],
    };
    setExercises(prev => [...prev, newEx]);
    setCurrentExIdx(exercises.length);
    setCurrentSetIdx(0);
    setSearchQuery('');
    setSearchResults([]);
  }, [prevData, exercises.length]);

  const addSet = useCallback(() => {
    if (!currentEx) return;
    const lastSet = currentEx.sets[currentEx.sets.length - 1];
    const newSet: SetRecord = {
      weight: lastSet?.weight || 0,
      reps: lastSet?.reps || 10,
      rpe: 0,
      rir: lastSet?.rir || 2,
      completed: false,
    };
    setExercises(prev => {
      const updated = [...prev];
      updated[currentExIdx] = { ...updated[currentExIdx], sets: [...updated[currentExIdx].sets, newSet] };
      return updated;
    });
    setCurrentSetIdx(currentEx.sets.length);
  }, [currentEx, currentExIdx]);

  const completeSet = useCallback((weight: number, reps: number, rpe: number, rir: number) => {
    if (!currentEx) return;
    setExercises(prev => {
      const updated = [...prev];
      const ex = { ...updated[currentExIdx] };
      const sets = [...ex.sets];
      sets[currentSetIdx] = { weight, reps, rpe, rir, completed: true };
      ex.sets = sets;
      updated[currentExIdx] = ex;
      return updated;
    });

    // Check for PR
    if (currentPR && epley1RM(weight, reps) > currentPR.e1rm && weight > 0) {
      setShowPR({ exercise: currentEx.exerciseName, weight, reps, e1rm: epley1RM(weight, reps) });
      if (prTimerRef.current) clearTimeout(prTimerRef.current);
      prTimerRef.current = setTimeout(() => setShowPR(null), 3000);
    }

    // Start rest timer
    setRestTimer(restTarget);

    // Move to next set
    if (currentSetIdx < currentEx.sets.length - 1) {
      setCurrentSetIdx(currentSetIdx + 1);
    } else if (currentExIdx < exercises.length - 1) {
      // Auto-advance to next exercise
      setCurrentExIdx(currentExIdx + 1);
      setCurrentSetIdx(0);
    }
  }, [currentEx, currentExIdx, currentSetIdx, exercises.length, currentPR, restTarget]);

  const removeExercise = useCallback((idx: number) => {
    setExercises(prev => prev.filter((_, i) => i !== idx));
    if (currentExIdx >= exercises.length - 1) {
      setCurrentExIdx(Math.max(0, exercises.length - 2));
    }
  }, [currentExIdx, exercises.length]);

  const handleSave = useCallback(async () => {
    const wid = `workout_${Date.now()}`;
    const dateStr = new Date().toISOString().split('T')[0];
    const strengthEntries: StrengthLogEntry[] = [];

    for (const ex of exercises) {
      const completedSets = ex.sets.filter(s => s.completed);
      if (completedSets.length === 0) continue;

      strengthEntries.push({
        id: `${wid}_${ex.exerciseId}`,
        date: dateStr,
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        sets: completedSets.map(s => ({ weight: s.weight, reps: s.reps, rir: s.rir, rpe: s.rpe })),
        totalVolume: completedSets.reduce((s, st) => s + st.weight * st.reps, 0),
        estimated1RM: Math.max(...completedSets.map(s => epley1RM(s.weight, s.reps)), 0),
        isCompound: EXERCISE_CATALOG.find(e => e.id === ex.exerciseId)?.type === 'compound',
        weekNumber: selectedWeek,
      });
    }

    if (strengthEntries.length > 0) {
      await diary.saveWorkoutLog({
        id: wid,
        date: dateStr,
        duration: exercises.reduce((s, e) => s + e.sets.length, 0) * 3,
        exercises: strengthEntries,
        overallRPE: 7,
        recoveryBefore: 5,
        split: 'quick',
        weekNumber: selectedWeek,
      });
      for (const se of strengthEntries) {
        await diary.saveStrengthLog(se);
      }
    }

    setSaved(true);
    setTimeout(() => { setSaved(false); onSave(); }, 1500);
  }, [exercises, diary, selectedWeek, onSave]);

  const totalSets = exercises.reduce((s, e) => s + e.sets.filter(st => st.completed).length, 0);
  const totalVolume = exercises.reduce((s, e) => s + e.sets.filter(st => st.completed).reduce((ss, st) => ss + st.weight * st.reps, 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: isMobile ? 8 : 12 }}>
      {/* PR celebration overlay */}
      {showPR && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.85)', zIndex: 9999,
          animation: 'fadeIn 0.3s ease-out',
        }}>
          <div style={{ textAlign: 'center', padding: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT, marginBottom: 8 }}>НОВЫЙ ПМ!</div>
            <div style={{ fontSize: 14, color: '#fff', marginBottom: 4 }}>{showPR.exercise}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#fff' }}>{showPR.weight}кг × {showPR.reps}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>e1RM: {Math.round(showPR.e1rm)}кг</div>
          </div>
        </div>
      )}

      {/* Rest timer */}
      {restTimer > 0 && (
        <div style={{
          padding: '12px 16px', borderRadius: 12,
          background: restTimer <= 10 ? 'rgba(239,68,68,0.15)' : 'rgba(0,230,138,0.08)',
          border: `1px solid ${restTimer <= 10 ? 'rgba(239,68,68,0.3)' : 'rgba(0,230,138,0.2)'}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>Отдых</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: restTimer <= 10 ? '#ef4444' : ACCENT }}>
              {Math.floor(restTimer / 60)}:{(restTimer % 60).toString().padStart(2, '0')}
            </div>
          </div>
          <button onClick={() => setRestTimer(0)} style={{
            padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
            background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: 12,
          }}>Пропустить</button>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>⚡ Быстрый ввод</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
          {totalSets} сетов · {totalVolume.toLocaleString()} кг
        </div>
      </div>

      {/* Search */}
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onBlur={() => setTimeout(() => setSearchResults([]), 200)}
          placeholder="🔍 Поиск упражнения..."
          style={{
            width: '100%', padding: '12px 14px', borderRadius: 12,
            background: '#18181b', border: '1px solid rgba(255,255,255,0.08)',
            color: '#fff', fontSize: 14, boxSizing: 'border-box', minHeight: 44,
          }}
        />
        {searchResults.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0,
            background: '#18181b', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12, zIndex: 100, maxHeight: 250, overflowY: 'auto',
            marginTop: 4,
          }}>
            {searchResults.map(ex => (
              <div
                key={ex.id}
                onClick={() => addExercise(ex)}
                style={{
                  padding: '12px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  minHeight: 44,
                }}
              >
                <span style={{ fontSize: 13, color: '#fff' }}>{ex.name}</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{ex.group}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Exercise list */}
      {exercises.length === 0 && (
        <div style={{
          textAlign: 'center', padding: 32, borderRadius: 16,
          background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)',
        }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🏋️</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
            Начните с поиска упражнения выше
          </div>
        </div>
      )}

      {exercises.map((ex, exIdx) => {
        const isCurrentExercise = exIdx === currentExIdx;
        return (
          <div key={exIdx} style={{
            borderRadius: 12, overflow: 'hidden',
            background: isCurrentExercise ? 'rgba(0,230,138,0.04)' : 'rgba(255,255,255,0.02)',
            border: `1px solid ${isCurrentExercise ? 'rgba(0,230,138,0.2)' : 'rgba(255,255,255,0.04)'}`,
          }}>
            {/* Exercise header */}
            <div
              onClick={() => { setCurrentExIdx(exIdx); setCurrentSetIdx(0); }}
              style={{
                padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                cursor: 'pointer', minHeight: 44,
              }}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{ex.exerciseName}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                  {ex.sets.filter(s => s.completed).length}/{ex.sets.length} подходов
                  {prevData && (
                    <span style={{ marginLeft: 6, color: ACCENT }}>
                      прошлый: {prevData.weight}кг×{prevData.reps}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button
                  onClick={(e) => { e.stopPropagation(); addSet(); }}
                  style={{
                    width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
                    background: 'transparent', color: ACCENT, cursor: 'pointer', fontSize: 16,
                  }}
                >+</button>
                <button
                  onClick={(e) => { e.stopPropagation(); removeExercise(exIdx); }}
                  style={{
                    width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)',
                    background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer', fontSize: 12,
                  }}
                >✕</button>
              </div>
            </div>

            {/* Sets */}
            {isCurrentExercise && (
              <div style={{ padding: '0 14px 10px' }}>
                {ex.sets.map((set, setIdx) => {
                  const isCurrentSet = setIdx === currentSetIdx && !set.completed;
                  return (
                    <SetRow
                      key={setIdx}
                      set={set}
                      setNumber={setIdx + 1}
                      isCurrent={isCurrentSet}
                      prevData={setIdx === 0 ? prevData : null}
                      onComplete={(w, r, rpe, rir) => {
                        setCurrentSetIdx(setIdx);
                        completeSet(w, r, rpe, rir);
                      }}
                      onSkip={() => {
                        setExercises(prev => {
                          const updated = [...prev];
                          const exercise = { ...updated[exIdx] };
                          const sets = [...exercise.sets];
                          sets[setIdx] = { ...sets[setIdx], completed: true };
                          exercise.sets = sets;
                          updated[exIdx] = exercise;
                          return updated;
                        });
                      }}
                    />
                  );
                })}
                {/* Add set button */}
                <button
                  onClick={addSet}
                  style={{
                    width: '100%', padding: '8px', borderRadius: 8,
                    border: '1px dashed rgba(0,230,138,0.3)', background: 'transparent',
                    color: ACCENT, cursor: 'pointer', fontSize: 11, marginTop: 4, minHeight: 36,
                  }}
                >+ Добавить подход</button>
              </div>
            )}
          </div>
        );
      })}

      {/* Rest timer settings */}
      {exercises.length > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
          <span>Отдых:</span>
          {[60, 90, 120, 180].map(sec => (
            <button
              key={sec}
              onClick={() => setRestTarget(sec)}
              style={{
                padding: '4px 10px', borderRadius: 6,
                border: `1px solid ${restTarget === sec ? ACCENT : 'rgba(255,255,255,0.1)'}`,
                background: restTarget === sec ? 'rgba(0,230,138,0.1)' : 'transparent',
                color: restTarget === sec ? ACCENT : 'rgba(255,255,255,0.5)',
                cursor: 'pointer', fontSize: 10,
              }}
            >{sec}с</button>
          ))}
        </div>
      )}

      {/* Save button */}
      {exercises.length > 0 && (
        <button
          onClick={handleSave}
          disabled={totalSets === 0}
          style={{
            width: '100%', padding: 14, borderRadius: 12, border: 'none', cursor: 'pointer',
            background: totalSets > 0 ? 'linear-gradient(135deg, #00e68a, #00c853)' : 'rgba(255,255,255,0.05)',
            color: totalSets > 0 ? '#000' : 'rgba(255,255,255,0.3)',
            fontWeight: 700, fontSize: 14, minHeight: 48,
          }}
        >
          {saved ? '✅ Сохранено!' : `💾 Сохранить (${totalSets} подходов)`}
        </button>
      )}
    </div>
  );
};

/* ─── SetRow — строка подхода с быстрым вводом ─── */
const SetRow: React.FC<{
  set: SetRecord;
  setNumber: number;
  isCurrent: boolean;
  prevData: { weight: number; reps: number; rir: number } | null;
  onComplete: (weight: number, reps: number, rpe: number, rir: number) => void;
  onSkip: () => void;
}> = ({ set, setNumber, isCurrent, prevData, onComplete, onSkip }) => {
  const [weight, setWeight] = useState(set.weight || prevData?.weight || 0);
  const [reps, setReps] = useState(set.reps || prevData?.reps || 10);
  const [rpe, setRpe] = useState(set.rpe || 7);
  const [rir, setRir] = useState(set.rir ?? prevData?.rir ?? 2);

  useEffect(() => {
    if (prevData && set.weight === 0) {
      setWeight(prevData.weight);
      setReps(prevData.reps);
    }
  }, [prevData]);

  if (set.completed) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
        borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: 11,
      }}>
        <span style={{ fontWeight: 700, color: ACCENT, minWidth: 20 }}>#{setNumber}</span>
        <span style={{ color: '#fff', fontWeight: 600 }}>{set.weight}кг × {set.reps}</span>
        <span style={{ color: 'rgba(255,255,255,0.4)' }}>RPE {set.rpe}</span>
        <span style={{ color: 'rgba(255,255,255,0.4)' }}>RIR {set.rir}</span>
        <span style={{ color: ACCENT, marginLeft: 'auto', fontSize: 10 }}>
          {Math.round(epley1RM(set.weight, set.reps))}кг 1RM
        </span>
      </div>
    );
  }

  return (
    <div style={{
      padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)',
      background: isCurrent ? 'rgba(0,230,138,0.03)' : 'transparent',
      borderRadius: isCurrent ? 8 : 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
        <span style={{ fontWeight: 700, color: ACCENT, minWidth: 20, fontSize: 11 }}>#{setNumber}</span>
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4 }}>
          <input
            type="number" value={weight}
            onChange={e => setWeight(parseFloat(e.target.value) || 0)}
            placeholder="кг"
            style={{
              padding: '8px 6px', borderRadius: 6, background: '#18181b',
              border: '1px solid rgba(255,255,255,0.08)', color: '#fff',
              fontSize: 12, textAlign: 'center', minHeight: 36,
            }}
          />
          <input
            type="number" value={reps}
            onChange={e => setReps(parseInt(e.target.value) || 0)}
            placeholder="повт"
            style={{
              padding: '8px 6px', borderRadius: 6, background: '#18181b',
              border: '1px solid rgba(255,255,255,0.08)', color: '#fff',
              fontSize: 12, textAlign: 'center', minHeight: 36,
            }}
          />
          <input
            type="number" min={1} max={10} value={rpe}
            onChange={e => setRpe(parseInt(e.target.value) || 5)}
            placeholder="RPE"
            style={{
              padding: '8px 6px', borderRadius: 6, background: '#18181b',
              border: '1px solid rgba(255,255,255,0.08)', color: '#fff',
              fontSize: 12, textAlign: 'center', minHeight: 36,
            }}
          />
          <input
            type="number" min={0} max={5} value={rir}
            onChange={e => setRir(parseInt(e.target.value) || 0)}
            placeholder="RIR"
            style={{
              padding: '8px 6px', borderRadius: 6, background: '#18181b',
              border: '1px solid rgba(255,255,255,0.08)', color: '#fff',
              fontSize: 12, textAlign: 'center', minHeight: 36,
            }}
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={() => onComplete(weight, reps, rpe, rir)}
          disabled={weight <= 0 || reps <= 0}
          style={{
            flex: 2, padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: weight > 0 && reps > 0 ? 'linear-gradient(135deg, #00e68a, #00c853)' : 'rgba(255,255,255,0.05)',
            color: weight > 0 && reps > 0 ? '#000' : 'rgba(255,255,255,0.3)',
            fontWeight: 700, fontSize: 12, minHeight: 40,
          }}
        >✓ Записать</button>
        <button
          onClick={onSkip}
          style={{
            flex: 1, padding: '10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)',
            background: 'transparent', color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
            fontSize: 11, minHeight: 40,
          }}
        >Пропустить</button>
      </div>
    </div>
  );
};

export default QuickEntry;
