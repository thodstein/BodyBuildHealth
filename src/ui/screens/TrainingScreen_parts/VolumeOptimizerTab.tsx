import React, { useMemo, useState, useCallback } from 'react';
import { EXERCISE_CATALOG, getExerciseById, getSubstitutes, canReplace } from '../../../core/exercise-catalog';
import { getVolumeReferences, getVolumeByMuscle } from '../../../engines/training-methodology.engine';
import { PopupSelect, PopupNumber, ExpandableCard, MetricCard } from '../SRCBBScreen_parts/TrainingPopups';
import { useDataLink } from '../../../core/data-link';

const ACCENT = '#00e68a';
const SMALL: React.CSSProperties = { color: 'rgba(255,255,255,0.6)', fontSize: 11, lineHeight: 1.4 };
const H: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: ACCENT, margin: '4px 0 8px' };
const IN: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px', minHeight: 38, width: '100%', boxSizing: 'border-box' as const, fontSize: 12, textAlign: 'center' as const };

interface ExerciseRow {
  id: string;
  exerciseId: string;
  weight: number;
  reps: number;
  sets: number;
  oneRM?: number;
}

interface Suggestion {
  id: string;
  type: 'add' | 'reduce';
  muscle: string;
  exerciseId?: string;
  deltaSets: number; // positive for add, negative for reduce (absolute value is the change)
  reason: string;
  detail: string;
}

export const VolumeOptimizerTab: React.FC = () => {
  const { profile } = useDataLink();
  const [level, setLevel] = useState<'beginner' | 'intermediate' | 'advanced' | 'enhanced'>((profile?.settings.trainingLevel as 'beginner' | 'intermediate' | 'advanced' | 'enhanced') ?? 'intermediate');
  // We'll map 'enhanced' to 'advanced' for volume references, as the engine might not have enhanced.
  const volumeLevel = level === 'enhanced' ? 'advanced' : level;
  const [oneRMGlobal, setOneRMGlobal] = useState<number>(100);
  const [rows, setRows] = useState<ExerciseRow[]>([
    { id: 'r1', exerciseId: 'bench_bar', weight: 80, reps: 5, sets: 4 },
    { id: 'r2', exerciseId: 'row_bar', weight: 60, reps: 8, sets: 3 },
  ]);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Get the user's strength baselines (1RM) from profile
  const strengthBaselines = profile?.settings.strengthBaselines ?? {};

  // Helper to get oneRM for an exercise: use individual if provided, else global
  const getExerciseOneRM = (exerciseId: string): number => {
    const baseline = strengthBaselines[exerciseId];
    if (baseline && baseline > 0) return baseline;
    return oneRMGlobal;
  };

  // Helper to update a row
  const upd = (id: string, field: keyof ExerciseRow, val: any) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
  };

  const addRow = () => {
    setRows(prev => [...prev, { id: 'r' + Date.now(), exerciseId: 'bench_bar', weight: 60, reps: 6, sets: 3 }]);
  };

  const delRow = (id: string) => {
    setRows(prev => prev.filter(r => r.id !== id));
  };

  const getExercise = (exerciseId: string) => getExerciseById(exerciseId);
  const getMuscle = (exerciseId: string) => {
    const ex = getExercise(exerciseId);
    return ex?.group ?? '';
  };

  // Compute muscle stats: sets per muscle, and MEV/MAV/MRV for the user's level
  const muscleStats = useMemo(() => {
    const map: Record<string, { sets: number; mev: number; mav: number; mrv: number }> = {};
    rows.forEach(r => {
      const ex = getExercise(r.exerciseId);
      if (!ex) return;
      const muscle = ex.group;
      const sets = r.sets;
      if (!map[muscle]) {
        const volRef = getVolumeByMuscle(muscle);
        if (!volRef) return;
        const levelData = volRef[volumeLevel as 'beginner' | 'intermediate' | 'advanced'];
        if (!levelData) return;
        map[muscle] = {
          sets: 0,
          mev: levelData.mev,
          mav: levelData.mav,
          mrv: levelData.mrv,
        };
      }
      const stat = map[muscle];
      stat.sets += sets;
    });
    return map;
  }, [rows, volumeLevel]);

  // Compute total sets, tonnage, and KPSh
  const { totalSets, totalTonnage, totalKpSh } = useMemo(() => {
    let totalSets = 0;
    let totalTonnage = 0; // kg * reps
    let totalKpSh = 0; // we define KPSh as tonnage * intensity (weight/1RM) summed over sets
    rows.forEach(r => {
      const ex = getExercise(r.exerciseId);
      if (!ex) return;
      const oneRM = getExerciseOneRM(r.exerciseId);
      const weight = r.weight;
      const reps = r.reps;
      const sets = r.sets;
      const setTonnage = weight * reps * sets;
      totalSets += sets;
      totalTonnage += setTonnage;
      // Intensity factor: weight / oneRM (if oneRM > 0)
      const intensity = oneRM > 0 ? weight / oneRM : 0;
      // We'll multiply the setTonnage by intensity to get a "weighted" tonnage for KPSh
      totalKpSh += setTonnage * intensity;
    });
    return { totalSets, totalTonnage, totalKpSh };
  }, [rows]);

  // Compute tonnage and KPSh per muscle (for display)
  const tonnageByMuscle = useMemo(() => {
    const map: Record<string, number> = {};
    const kpShByMap: Record<string, number> = {};
    rows.forEach(r => {
      const ex = getExercise(r.exerciseId);
      if (!ex) return;
      const muscle = ex.group;
      const oneRM = getExerciseOneRM(r.exerciseId);
      const weight = r.weight;
      const reps = r.reps;
      const sets = r.sets;
      const setTonnage = weight * reps * sets;
      const intensity = oneRM > 0 ? weight / oneRM : 0;
      map[muscle] = (map[muscle] || 0) + setTonnage;
      kpShByMap[muscle] = (kpShByMap[muscle] || 0) + setTonnage * intensity;
    });
    return { tonnageByMuscle: map, kpShByMuscle: kpShByMap };
  }, [rows]);

  // Generate suggestions for improvement
  const suggestionsMemo = useMemo(() => {
    const sugg: Suggestion[] = [];
    const weakPoints = new Set(profile?.settings.weakPoints ?? []);
    Object.entries(muscleStats).forEach(([muscle, stat]) => {
      const { sets, mev, mrv } = stat;
      // Get existing exercises for this muscle, sorted by sets descending
      const muscleExercises = rows
        .filter(r => getExercise(r.exerciseId)?.group === muscle)
        .sort((a, b) => b.sets - a.sets);

      if (sets < mev) {
        // Need to add volume
        const deficit = mev - sets;
        let exerciseId: string | undefined;
        let reason: string = '';
        let detail: string = '';

        // Prefer to add sets to the existing exercise with the most sets for this muscle
        if (muscleExercises.length > 0) {
          const topEx = muscleExercises[0];
          exerciseId = topEx.exerciseId;
          const exName = getExercise(exerciseId)?.name ?? exerciseId;
          reason = `Недостаток объёма для ${muscle}`;
          detail = `Добавить ${deficit} подход(ов) упражнения "${exName}" (MEV=${mev}).`;
        } else {
          // No existing exercise for this muscle, add a new one
          // Choose a basic exercise for the muscle from volume references
          const volRef = getVolumeByMuscle(muscle);
          if (volRef && volRef.bestExercises.length > 0) {
            exerciseId = volRef.bestExercises[0];
          } else {
            // Fallback to first exercise in catalog for this muscle
            const fallback = EXERCISE_CATALOG.find(e => e.group === muscle);
            exerciseId = fallback ? fallback.id : '';
          }
          if (exerciseId) {
            const exName = getExercise(exerciseId)?.name ?? exerciseId;
            reason = `Недостаток объёма для ${muscle}`;
            detail = `Добавить ${deficit} подход(ов) упражнения "${exName}" (MEV=${mev}).`;
          }
        }
        if (exerciseId) {
          sugg.push({
            id: `add-${muscle}-${Date.now()}`,
            type: 'add',
            muscle,
            exerciseId,
            deltaSets: deficit, // positive
            reason,
            detail,
          });
        }
      } else if (sets > mrv) {
        // Need to reduce volume
        const excess = sets - mrv;
        let reduced = 0;
        // We'll reduce from the exercises with the most sets first
        const sorted = [...muscleExercises].sort((a, b) => b.sets - a.sets);
        for (const row of sorted) {
          if (reduced >= excess) break;
          const canTake = Math.min(row.sets, excess - reduced);
          if (canTake > 0) {
            sugg.push({
              id: `reduce-${row.id}-${Date.now()}`,
              type: 'reduce',
              muscle,
              exerciseId: row.exerciseId,
              deltaSets: -canTake, // negative
              reason: `Превышение допустимого объёма для ${muscle}`,
              detail: `Уменьшить подходы упражнения "${getExercise(row.exerciseId)?.name ?? row.exerciseId}" с ${row.sets} до ${row.sets - canTake} (MRV=${mrv}).`,
            });
            reduced += canTake;
          }
        }
      }
    });
    return sugg.length > 0 ? sugg : null;
  }, [muscleStats, profile?.settings.weakPoints, volumeLevel]);

  // Handle substitution for a row
  const handleSubstituteForRow = (rowId: string) => {
    const row = rows.find(r => r.id === rowId);
    if (!row) return;
    const subs = getSubstitutesFor(row.exerciseId);
    if (subs.length === 0) {
      alert('Замены для данного упражнения не найдены');
      return;
    }
    const sub = subs.find(s => canReplace(row.exerciseId, s.id)) || subs[0];
    upd(rowId, 'exerciseId', sub.id);
  };

  const getSubstitutesFor = (exerciseId: string) => {
    const ex = getExercise(exerciseId);
    if (!ex) return [];
    const sub = getSubstitutes(exerciseId);
    if (!sub) return [];
    return sub.substitutes.map(s => ({ id: s.id, name: getExerciseById(s.id)?.name ?? s.id, reason: s.reason }));
  };

  // Apply improvements from suggestions
  const applyImprovements = () => {
    if (!suggestions) return;
    const newRows = [...rows];
    // We'll process suggestions in order, but note that reduce suggestions may refer to rows that may be removed by other reduces.
    // We'll process reduces first, then adds.
    const reduces = suggestions.filter(s => s.type === 'reduce');
    const adds = suggestions.filter(s => s.type === 'add');

    // Process reduces: we need to reduce sets on specific exercises
    reduces.forEach(sug => {
      // Find the row for the exerciseId (if provided) or for the muscle with the most sets
      let targetRow: ExerciseRow | undefined;
      if (sug.exerciseId) {
        targetRow = newRows.find(r => r.exerciseId === sug.exerciseId);
      } else {
        // Find any row for the muscle with the most sets
        const muscleRows = newRows.filter(r => getExercise(r.exerciseId)?.group === sug.muscle);
        if (muscleRows.length > 0) {
          targetRow = muscleRows.reduce((a, b) => (a.sets > b.sets ? a : b));
        }
      }
      if (targetRow) {
        const newSets = Math.max(0, targetRow.sets + sug.deltaSets); // deltaSets is negative
        if (newSets === 0) {
          // Remove the row if sets become zero
          const index = newRows.indexOf(targetRow);
          if (index > -1) newRows.splice(index, 1);
        } else {
          upd(targetRow.id, 'sets', newSets);
        }
      }
    });

    // Process adds: we need to add sets, either by increasing existing exercise or adding a new row
    adds.forEach(sug => {
      if (sug.exerciseId) {
        // Find the row for this exercise with the most sets (or first)
        let targetRow: ExerciseRow | undefined;
        const matchingRows = newRows.filter(r => r.exerciseId === sug.exerciseId);
        if (matchingRows.length > 0) {
          targetRow = matchingRows.reduce((a, b) => (a.sets > b.sets ? a : b));
        }
        if (targetRow) {
          upd(targetRow.id, 'sets', targetRow.sets + sug.deltaSets); // deltaSets is positive
        } else {
          // If not found, add a new row
          const ex = getExercise(sug.exerciseId);
          if (ex) {
            const newRow: ExerciseRow = {
              id: 'r' + Date.now(),
              exerciseId: sug.exerciseId,
              weight: 60, // default weight, could be based on oneRM
              reps: 8,
              sets: sug.deltaSets,
            };
            newRows.push(newRow);
          }
        }
      } else {
        // Should not happen because we set exerciseId in suggestions
      }
    });

    setRows(newRows);
    setSuggestions(null);
    setShowModal(false);
  };

  // Frequency and intensity balance (placeholder)
  // We'll skip for now but can add a simple warning if needed.

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT, margin: '4px 0 8px' }}>
        📦 Объём и оптимизация v2
      </div>

      {/* Level and global oneRM inputs */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Уровень подготовки</label>
          <select
            value={level}
            onChange={e => setLevel(e.target.value as 'beginner' | 'intermediate' | 'advanced' | 'enhanced')}
            style={IN}
          >
            <option value="beginner">Начальный</option>
            <option value="intermediate">Средний</option>
            <option value="advanced">Продвинутый</option>
            <option value="enhanced">Энхансд</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Глобальный 1RM (кг)</label>
          <input
            type="number"
            value={oneRMGlobal}
            onChange={e => setOneRMGlobal(+e.target.value)}
            style={IN}
            min={0}
            max={500}
          />
        </div>
      </div>

      {/* Table of exercises */}
      <div style={{ background: 'rgba(24,24,27,0.4)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
        {rows.map(row => (
          <div key={row.id} style={{ display: 'flex', gap: 12, alignItems: 'start', marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ flex: 2, minWidth: 180 }}>
              <PopupSelect
                label="Упражнение"
                value={row.exerciseId}
                options={EXERCISE_CATALOG.map(e => ({ id: e.id, label: e.name, desc: `${e.group} · ${e.type === 'compound' ? 'Базовое' : 'Изолированное'}`}))}
                hint="Начните вводить для поиска"
                onChange={v => upd(row.id, 'exerciseId', v)}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Вес (кг)</label>
              <input
                type="number"
                value={row.weight}
                onChange={e => upd(row.id, 'weight', +e.target.value)}
                style={IN}
                min={0}
                max={500}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Повт</label>
              <input
                type="number"
                value={row.reps}
                onChange={e => upd(row.id, 'reps', +e.target.value)}
                style={IN}
                min={0}
                max={200}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Подх</label>
              <input
                type="number"
                value={row.sets}
                onChange={e => upd(row.id, 'sets', +e.target.value)}
                style={IN}
                min={0}
                max={100}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>1RM (опц)</label>
              <input
                type="number"
                value={row.oneRM ?? 0}
                onChange={e => {
                  const v = +e.target.value;
                  upd(row.id, 'oneRM', v === 0 ? undefined : v);
                }}
                style={IN}
                min={0}
                max={500}
                placeholder="–"
              />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button
                onClick={() => handleSubstituteForRow(row.id)}
                style={{ marginTop: 4, padding: '4px 8px', background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.2)', color: ACCENT, borderRadius: 4, cursor: 'pointer', fontSize: 11 }}
              >
                Замена
              </button>
              <button
                onClick={() => delRow(row.id)}
                style={{ marginTop: 4, padding: '4px 8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}
              >
                Удалить
              </button>
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <button
            onClick={addRow}
            style={{ flex: 1, padding: '8px 12px', background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.3)', color: ACCENT, borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
            Добавить упражнение
          </button>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
        <MetricCard title="Объём (сетов)" icon="🔚" accent={ACCENT}>
          <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{totalSets}</div>
          <div style={{ ...SMALL }}>подходов</div>
        </MetricCard>
        <MetricCard title="Тоннаж" icon="📦" accent={ACCENT}>
          <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{totalTonnage.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
          <div style={{ ...SMALL }}>кг·повт</div>
        </MetricCard>
        <MetricCard title="КПШ" icon="📧" accent={ACCENT}>
          <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{totalKpSh.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
          <div style={{ ...SMALL }}>единица</div>
        </MetricCard>
      </div>

      {/* Tonnage and KPSh by muscle */}
      {Object.keys(tonnageByMuscle.tonnageByMuscle).length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>📧 Тоннаж по мышцам</div>
          <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
            {Object.entries(tonnageByMuscle.tonnageByMuscle).map(([muscle, tonnage]) => (
              <div key={muscle} style={{ background: 'rgba(24,24,27,0.4)', borderRadius: 8, padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
                  <span>{muscle}</span>
                  <span>{tonnage.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} кг·повт</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Suggestions for improvement */}
      <div style={{ marginTop: 16, padding: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
        <div style={{ fontWeight: 600, color: ACCENT, marginBottom: 4 }}>Рекомендации по улучшению</div>
        {suggestions ? (
          <>
            {suggestions.map((s, idx) => (
              <div key={idx} style={{ marginBottom: 8, padding: 6, background: 'rgba(0,230,138,0.04)', borderRadius: 4 }}>
                <div style={{ fontWeight: 600 }}>{s.reason}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>{s.detail}</div>
              </div>
            ))}
            <div style={{ marginTop: 12, textAlign: 'right' }}>
              <button
                onClick={applyImprovements}
                style={{ width: '100%', padding: '10px 16px', background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.3)', color: ACCENT, borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
              >
                Применить рекомендации
              </button>
            </div>
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-dim)' }}>Рекомендаций нет. Программа сбалансирована по объёму.</p>
        )}
      </div>

      {/* Modal for confirmation (we use the same applyImprovements function, but we could show a modal before applying) */}
      {/* For simplicity, we apply directly after showing suggestions. If we want a modal, we can add a confirmation step. */}
      {/* We'll keep it simple: show suggestions and a button to apply. */}
    </div>
  );
};


