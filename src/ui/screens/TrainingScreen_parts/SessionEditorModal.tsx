/** SessionEditorModal.tsx — полное редактирование сохранённой тренировки.
 *  Мета (дата/длительность/сплит/RPE/восстановление/заметки) + упражнения и подходы.
 *  Не полагается на backend — чистый редактор, onSave отдаёт обновлённый WorkoutLog. */
import React, { useState } from 'react';
import type { WorkoutLog, StrengthLogEntry } from '../../../core/types';
import { epley1RM } from '../../../engines/e1rm';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import { isBodyweightExercise as isBW } from '../../../engines/workout-logger.engine';
import { ACCENT } from './diary-tokens';
import { MindsetCheckinInline } from '../SRCBBScreen_parts/MindsetSessionPanels';
import { MobilityCheckinInline } from '../SRCBBScreen_parts/MobilitySessionPanel';
import { WarmupCheckinInline } from '../SRCBBScreen_parts/WarmupSessionPanel';
import { CooldownCheckinInline } from '../SRCBBScreen_parts/CooldownSessionPanel';

interface Props {
  workout: WorkoutLog;
  onClose: () => void;
  onSave: (log: WorkoutLog) => void;
}

const FELT_OPTIONS = ['Фулбоди', 'Верх/Низ', 'Жим/Тяга', 'PPL', 'Сплит', 'Ноги/Жим/Тяга', 'Свой'];

const IN: React.CSSProperties = {
  width: '100%', padding: '6px 8px', borderRadius: 6, background: '#18181b',
  border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 12, boxSizing: 'border-box' as any,
};

export const SessionEditorModal: React.FC<Props> = ({ workout, onClose, onSave }) => {
  const [log, setLog] = useState<WorkoutLog>(() => ({
    ...workout,
    exercises: (workout.exercises || []).map(ex => ({ ...ex, sets: (ex.sets || []).map(s => ({ ...s })) })),
  }));

  const patch = (p: Partial<WorkoutLog>) => setLog(prev => ({ ...prev, ...p }));

  const patchExercise = (ei: number, p: Partial<StrengthLogEntry>) => {
    setLog(prev => {
      const exercises = [...prev.exercises];
      exercises[ei] = { ...exercises[ei], ...p } as StrengthLogEntry;
      return { ...prev, exercises };
    });
  };

  const patchSet = (ei: number, si: number, p: Partial<{ weight: number; reps: number; rpe: number; rir: number; techniqueScore: number }>) => {
    setLog(prev => {
      const exercises = [...prev.exercises];
      const ex = { ...exercises[ei] } as StrengthLogEntry;
      const sets = [...ex.sets];
      sets[si] = { ...sets[si], ...p };
      ex.sets = sets;
      ex.totalVolume = sets.reduce((s, x) => s + (x.weight || 0) * (x.reps || 0), 0);
      ex.estimated1RM = Math.max(0, ...sets.map(x => epley1RM(x.weight || 0, x.reps || 0)));
      exercises[ei] = ex;
      return { ...prev, exercises };
    });
  };

  const addSet = (ei: number) => {
    setLog(prev => {
      const exercises = [...prev.exercises];
      const ex = { ...exercises[ei] } as StrengthLogEntry;
      const last = ex.sets[ex.sets.length - 1];
      ex.sets = [...ex.sets, { weight: last?.weight || 0, reps: last?.reps || 10, rir: last?.rir ?? 2, rpe: last?.rpe ?? 7 }];
      exercises[ei] = ex;
      return { ...prev, exercises };
    });
  };

  const removeSet = (ei: number, si: number) => {
    setLog(prev => {
      const exercises = [...prev.exercises];
      const ex = { ...exercises[ei] } as StrengthLogEntry;
      ex.sets = ex.sets.filter((_, i) => i !== si);
      ex.totalVolume = ex.sets.reduce((s, x) => s + (x.weight || 0) * (x.reps || 0), 0);
      ex.estimated1RM = Math.max(0, ...ex.sets.map(x => epley1RM(x.weight || 0, x.reps || 0)));
      exercises[ei] = ex;
      return { ...prev, exercises: exercises.filter(e => (e.sets || []).length > 0) };
    });
  };

  const removeExercise = (ei: number) => {
    setLog(prev => ({ ...prev, exercises: prev.exercises.filter((_, i) => i !== ei) }));
  };

  const save = () => {
    const exercises = log.exercises.map((ex, i) => {
      const sets = (ex.sets || []).filter(s => (s.weight || 0) > 0 || (s.reps || 0) > 0);
      return {
        ...ex,
        id: ex.id || `${log.id}_${i}`,
        sets,
        totalVolume: sets.reduce((s, x) => s + (x.weight || 0) * (x.reps || 0), 0),
        estimated1RM: Math.max(0, ...sets.map(x => epley1RM(x.weight || 0, x.reps || 0))),
      };
    }).filter(ex => (ex.sets || []).length > 0);
    onSave({
      ...log,
      exercises,
      overallRPE: log.overallRPE || 7,
      recoveryBefore: log.recoveryBefore || 5,
    });
  };

  const totalSets = log.exercises.reduce((s, e) => s + (e.sets || []).length, 0);
  const totalVolume = log.exercises.reduce((s, e) => s + e.totalVolume, 0);

  return (
    <div className="train-sessionmodal" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, maxHeight: '86vh', overflowY: 'auto', borderRadius: 16, background: '#18181b', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 12px 48px rgba(0,0,0,0.5)', padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT }}>✏️ Редактирование тренировки</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer', padding: 0, lineHeight: 1 }}>✕</button>
        </div>

        {/* Meta */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 6 }}>
          <div><label style={{ fontSize: 10, color: '#fff' }}>Дата</label><input type="date" value={log.date} onChange={e => patch({ date: e.target.value })} style={IN} /></div>
          <div><label style={{ fontSize: 10, color: '#fff' }}>Длительность (мин)</label><input type="number" min={0} value={log.duration || 0} onChange={e => patch({ duration: parseInt(e.target.value) || 0 })} style={IN} /></div>
          <div><label style={{ fontSize: 10, color: '#fff' }}>Сплит</label>
            <select value={log.split || ''} onChange={e => patch({ split: e.target.value })} style={IN}>
              {FELT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div><label style={{ fontSize: 10, color: '#fff' }}>RPE</label><input type="number" min={1} max={10} value={log.overallRPE || 7} onChange={e => patch({ overallRPE: parseInt(e.target.value) || 7 })} style={IN} /></div>
          <div><label style={{ fontSize: 10, color: '#fff' }}>Восстановление</label><input type="number" min={1} max={10} value={log.recoveryBefore || 5} onChange={e => patch({ recoveryBefore: parseInt(e.target.value) || 5 })} style={IN} /></div>
          <div><label style={{ fontSize: 10, color: '#fff' }}>Неделя</label><input type="number" min={1} value={log.weekNumber || 1} onChange={e => patch({ weekNumber: parseInt(e.target.value) || 1 })} style={IN} /></div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 10, color: '#fff' }}>Заметки</label>
          <input type="text" value={log.notes || ''} onChange={e => patch({ notes: e.target.value })} placeholder="Самочувствие, особенности..." style={IN} />
        </div>

        {/* Exercises */}
        {log.exercises.map((ex, ei) => {
          const cat = EXERCISE_CATALOG.find(c => c.id === ex.exerciseId);
          const isBWEx = isBW(ex.exerciseName) || (cat?.type === 'bodyweight');
          return (
            <div key={ex.id || ei} style={{ borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', marginBottom: 8, padding: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>
                  {ex.exerciseName}
                  {ex.supersetGroup ? <span style={{ marginLeft: 6, fontSize: 9, color: '#a855f7', fontWeight: 700 }}>🔗 суперсет {ex.supersetGroup}</span> : null}
                </div>
                <button onClick={() => removeExercise(ei)} style={{ padding: '3px 8px', borderRadius: 5, fontSize: 10, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)', cursor: 'pointer' }}>Удалить</button>
              </div>
              {ex.note ? <div style={{ fontSize: 10, color: '#fff', marginBottom: 4 }}>📝 {ex.note}</div> : null}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 56px 28px', gap: 4, marginBottom: 4, fontSize: 9, color: '#fff', textTransform: 'uppercase' }}>
                <span>кг</span><span>повт</span><span>RPE</span><span>RIR</span><span style={{ textAlign: 'center' }}>техника</span><span></span>
              </div>
              {ex.sets.map((s, si) => (
                <div key={si} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 56px 28px', gap: 4, marginBottom: 4 }}>
                  <input type="number" value={s.weight || 0} disabled={isBWEx} onChange={e => patchSet(ei, si, { weight: parseFloat(e.target.value) || 0 })} style={{ ...IN, textAlign: 'center', padding: '6px 2px', minHeight: 36 }} />
                  <input type="number" value={s.reps || 0} onChange={e => patchSet(ei, si, { reps: parseInt(e.target.value) || 0 })} style={{ ...IN, textAlign: 'center', padding: '6px 2px', minHeight: 36 }} />
                  <input type="number" min={1} max={10} value={s.rpe ?? 7} onChange={e => patchSet(ei, si, { rpe: parseInt(e.target.value) || 7 })} style={{ ...IN, textAlign: 'center', padding: '6px 2px', minHeight: 36 }} />
                  <input type="number" min={0} max={5} value={s.rir ?? 2} onChange={e => patchSet(ei, si, { rir: parseInt(e.target.value) || 2 })} style={{ ...IN, textAlign: 'center', padding: '6px 2px', minHeight: 36 }} />
                  <button onClick={() => {
                    const next = s.techniqueScore === undefined ? 5 : s.techniqueScore === 5 ? 4 : s.techniqueScore === 4 ? 3 : undefined;
                    patchSet(ei, si, { techniqueScore: next });
                  }}
                    style={{ height: 36, borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: 11,
                      background: s.techniqueScore ? (s.techniqueScore === 5 ? 'rgba(34,197,94,0.15)' : s.techniqueScore === 4 ? 'rgba(96,165,250,0.15)' : 'rgba(239,68,68,0.15)') : 'rgba(255,255,255,0.05)',
                      color: s.techniqueScore ? (s.techniqueScore === 5 ? '#22c55e' : s.techniqueScore === 4 ? '#60a5fa' : '#ef4444') : '#fff' }}
                    title={s.techniqueScore ? `Техника: ${s.techniqueScore}/5` : 'Оценить технику'}>
                    {s.techniqueScore ? (s.techniqueScore === 5 ? '✅' : s.techniqueScore === 4 ? '🎯' : '⚠️') : '🎯'}
                  </button>
                  <button onClick={() => removeSet(ei, si)} style={{ width: 28, height: 36, borderRadius: 5, border: 'none', background: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer', fontSize: 11 }}>✕</button>
                </div>
              ))}
              <button onClick={() => addSet(ei)} style={{ width: '100%', padding: '6px', borderRadius: 6, fontSize: 10, border: '1px dashed rgba(0,230,138,0.3)', background: 'transparent', color: ACCENT, cursor: 'pointer' }}>+ Подход</button>
            </div>
          );
        })}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: '#fff', marginBottom: 10 }}>
          <span>{log.exercises.length} упр. · {totalSets} подходов · {totalVolume.toLocaleString()} кг</span>
        </div>

        {/* Психо-чек-ин (опционально): уверенность/активация/фокус сессии */}
        <MindsetCheckinInline date={log.date} sessionId={workout.id} />

        {/* Чек-ин мобильности (опционально): рутина/сессия + ROM */}
        <MobilityCheckinInline date={log.date} sessionId={workout.id} />

        {/* Чек-ин разминки (опционально): выполнена + качество */}
        <WarmupCheckinInline date={log.date} sessionId={workout.id} />

        {/* Чек-ин заминки (опционально): выполнена + качество */}
        <CooldownCheckinInline date={log.date} sessionId={workout.id} />

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>Отмена</button>
          <button onClick={save} disabled={log.exercises.length === 0} style={{ flex: 1, padding: 10, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,var(--accent),#00cc7a)', color: '#000', fontWeight: 700, fontSize: 12, opacity: log.exercises.length === 0 ? 0.4 : 1 }}>💾 Сохранить</button>
        </div>
      </div>
    </div>
  );
};
