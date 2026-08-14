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
import { DiarySetRow } from './DiarySetRow';
import { exerciseMatchScore, getAliasesForExercise } from '../../../engines/exercise-aliases';
import { useIsMobile } from './useIsMobile';
import { isBodyweightExercise as isBWExercise } from '../../../engines/movement-pattern';

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
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedSummary, setSavedSummary] = useState<{ exercises: number; sets: number; volume: number } | null>(null);
  const [showPR, setShowPR] = useState<{ exercise: string; weight: number; reps: number; e1rm: number } | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const prTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Undo/Redo
  const undoRef = useRef<ExerciseRecord[][]>([]);
  const redoRef = useRef<ExerciseRecord[][]>([]);
  const pushUndo = useCallback((snapshot: ExerciseRecord[]) => {
    undoRef.current = [...undoRef.current.slice(-19), JSON.parse(JSON.stringify(snapshot))];
    redoRef.current = [];
  }, []);
  const undo = useCallback(() => {
    if (undoRef.current.length === 0) return;
    redoRef.current.push(JSON.parse(JSON.stringify(exercises)));
    const prev = undoRef.current.pop()!;
    setExercises(prev);
    setCurrentExIdx(Math.min(currentExIdx, prev.length - 1));
  }, [exercises, currentExIdx]);
  const redo = useCallback(() => {
    if (redoRef.current.length === 0) return;
    undoRef.current.push(JSON.parse(JSON.stringify(exercises)));
    const next = redoRef.current.pop()!;
    setExercises(next);
    setCurrentExIdx(Math.min(currentExIdx, next.length - 1));
  }, [exercises, currentExIdx]);

  // Keyboard undo/redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
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
    pushUndo(exercises);
    const isBW = isBWExercise(ex);
    const newEx: ExerciseRecord = {
      exerciseId: ex.id,
      exerciseName: ex.name,
      sets: [{ weight: isBW ? 0 : (prevData?.weight || 0), reps: prevData?.reps || 10, rpe: 0, rir: prevData?.rir || 2, completed: false }],
    };
    setExercises(prev => [...prev, newEx]);
    setCurrentExIdx(exercises.length);
    setCurrentSetIdx(0);
    setSearchQuery('');
    setSearchResults([]);
  }, [prevData, exercises.length, exercises, pushUndo]);

  const addSet = useCallback(() => {
    if (!currentEx) return;
    pushUndo(exercises);
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
  }, [currentEx, currentExIdx, exercises, pushUndo]);

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
    pushUndo(exercises);
    setExercises(prev => prev.filter((_, i) => i !== idx));
    if (currentExIdx >= exercises.length - 1) {
      setCurrentExIdx(Math.max(0, exercises.length - 2));
    }
  }, [currentExIdx, exercises.length, exercises, pushUndo]);

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
      try {
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
        if (mountedRef.current) {
          setSavedSummary({ exercises: strengthEntries.length, sets: totalSets, volume: totalVolume });
          setSaved(true);
          setTimeout(() => { if (mountedRef.current) { setSaved(false); setSavedSummary(null); onSave(); } }, 3000);
        }
      } catch {
        if (mountedRef.current) {
          setSaveError('Ошибка сохранения');
          setTimeout(() => { if (mountedRef.current) setSaveError(null); }, 3000);
        }
      }
    } else if (mountedRef.current) {
      setSaved(true);
      setTimeout(() => { if (mountedRef.current) setSaved(false); }, 1500);
    }
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
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {undoRef.current.length > 0 && (
            <button onClick={undo} style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 10 }}>↩</button>
          )}
          {redoRef.current.length > 0 && (
            <button onClick={redo} style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 10 }}>↷</button>
          )}
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
            {totalSets} сетов · {totalVolume.toLocaleString()} кг
          </div>
        </div>
      </div>

      {/* Repeat last workout + Search */}
      {exercises.length === 0 && historyWorkouts.length > 0 && (
        <button onClick={() => {
          const last = historyWorkouts[0];
          if (!last?.exercises?.length) return;
          const repeated: ExerciseRecord[] = last.exercises.map((ex: any) => ({
            exerciseId: ex.exerciseId,
            exerciseName: ex.exerciseName.replace(/\s*\[superset:\d+\]/, ''),
            sets: (ex.sets || []).map((s: any) => ({
              weight: s.weight || 0, reps: s.reps || 10, rpe: 0, rir: s.rir || 2, completed: false,
            })),
          }));
          setExercises(repeated);
          setCurrentExIdx(0);
          setCurrentSetIdx(0);
        }}
          style={{
            width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px dashed rgba(0,230,138,0.3)',
            background: 'rgba(0,230,138,0.04)', color: ACCENT, cursor: 'pointer', fontSize: 13, minHeight: 44,
          }}>
          🔄 Повторить от {new Date(historyWorkouts[0].date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
        </button>
      )}

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

      {/* Recent exercises quick list */}
      {!searchQuery && exercises.length === 0 && (() => {
        const recentMap = new Map<string, { name: string; lastDate: string }>();
        historyWorkouts.slice(-10).forEach((w: any) => (Array.isArray(w.exercises) ? w.exercises : []).forEach((e: any) => {
          const name = e.exerciseName || '';
          if (!name) return;
          const prev = recentMap.get(name);
          if (!prev || w.date > prev.lastDate) recentMap.set(name, { name, lastDate: w.date });
        }));
        const recent = Array.from(recentMap.values()).sort((a, b) => b.lastDate.localeCompare(a.lastDate)).slice(0, 6);
        if (recent.length === 0) return null;
        return (
          <div style={{ marginTop: 8, marginBottom: 8 }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>Недавние:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {recent.map(r => (
                <button key={r.name} onClick={() => { const ex = EXERCISE_CATALOG.find((c: any) => c.name === r.name); if (ex) addExercise(ex); }}
                  style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 10 }}>
                  {r.name}
                </button>
              ))}
            </div>
          </div>
        );
      })()}

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
                    <DiarySetRow
                      key={setIdx}
                      set={set}
                      setNumber={setIdx + 1}
                      isCurrent={isCurrentSet}
                      isBodyweight={isBWExercise({ name: ex.exerciseName })}
                      prevData={setIdx === 0 ? prevData : null}
                      exerciseId={ex.exerciseId}
                      exerciseName={ex.exerciseName}
                      date={new Date().toISOString().split('T')[0]}
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
                {/* Add set + repeat last set buttons */}
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  <button
                    onClick={addSet}
                    style={{
                      flex: 1, padding: '8px', borderRadius: 8,
                      border: '1px dashed rgba(0,230,138,0.3)', background: 'transparent',
                      color: ACCENT, cursor: 'pointer', fontSize: 11, minHeight: 36,
                    }}
                  >+ Добавить</button>
                  {ex.sets.length >= 2 && (
                    <button
                      onClick={() => {
                        pushUndo(exercises);
                        const last = ex.sets[ex.sets.length - 1];
                        setExercises(prev => {
                          const updated = [...prev];
                          const exercise = { ...updated[exIdx] };
                          exercise.sets = [...exercise.sets, { ...last, completed: false }];
                          updated[exIdx] = exercise;
                          return updated;
                        });
                        setCurrentSetIdx(ex.sets.length);
                      }}
                      style={{
                        padding: '8px 10px', borderRadius: 8,
                        border: '1px dashed rgba(245,158,11,0.3)', background: 'transparent',
                        color: '#f59e0b', cursor: 'pointer', fontSize: 11, minHeight: 36,
                      }}
                    >⧉ Копировать</button>
                  )}
                </div>
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
      {savedSummary ? (
        <div style={{ padding: 12, borderRadius: 12, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>✅ Тренировка сохранена!</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, fontSize: 11 }}>
            <div style={{ textAlign: 'center' }}><div style={{ color: 'rgba(255,255,255,0.4)' }}>Упр.</div><div style={{ fontWeight: 700, color: '#fff' }}>{savedSummary.exercises}</div></div>
            <div style={{ textAlign: 'center' }}><div style={{ color: 'rgba(255,255,255,0.4)' }}>Сетов</div><div style={{ fontWeight: 700, color: '#fff' }}>{savedSummary.sets}</div></div>
            <div style={{ textAlign: 'center' }}><div style={{ color: 'rgba(255,255,255,0.4)' }}>Тоннаж</div><div style={{ fontWeight: 700, color: '#fff' }}>{savedSummary.volume.toLocaleString()} кг</div></div>
          </div>
        </div>
      ) : exercises.length > 0 && (
        <>
        {exercises.some(ex => ex.sets.some(s => !s.completed)) && (
          <button
            onClick={() => {
              setExercises(prev => prev.map(ex => ({
                ...ex,
                sets: ex.sets.map(s => {
                  if (s.completed) return s;
                  const lastCompleted = [...ex.sets].reverse().find(sc => sc.completed);
                  return { ...s, weight: lastCompleted?.weight || s.weight, reps: lastCompleted?.reps || s.reps, rpe: lastCompleted?.rpe || s.rpe, rir: lastCompleted?.rir || s.rir, completed: true };
                }),
              })));
            }}
            style={{
              width: '100%', padding: 10, borderRadius: 10, border: '1px solid rgba(245,158,11,0.3)',
              background: 'rgba(245,158,11,0.08)', color: '#f59e0b', cursor: 'pointer',
              fontWeight: 600, fontSize: 12, marginBottom: 6, minHeight: 40,
            }}
          >
            ⚡ Добросить всё (авто-заполнить остатки)
          </button>
        )}
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
        {saveError && <div style={{ fontSize: 11, color: '#ef4444', textAlign: 'center', marginTop: 4 }}>{saveError}</div>}
        </>
      )}
    </div>
  );
};



export default QuickEntry;
