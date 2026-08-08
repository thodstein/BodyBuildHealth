import React, { useState, useEffect } from 'react';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import { isBodyweightExercise as isBWExercise } from '../../../engines/movement-pattern';
import { epley1RM } from '../../../engines/e1rm';
import type { StrengthLogEntry } from '../../../core/types';

const style: Record<string, React.CSSProperties> = {
  input: { width: '100%', padding: '6px 4px', borderRadius: 6, background: '#18181b', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 11, boxSizing: 'border-box' as any },
  btn: { width: '100%', padding: 9, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,var(--accent),#00cc7a)', color: '#000', fontWeight: 700, fontSize: 12 },
};

const FELT_LABELS = ['👎 Ужасно','😟 Плохо','😐 Нормально','🙂 Хорошо','😄 Отлично'];
const SP_LABELS: Record<string, string> = { fullbody: 'Фулбоди', upper_lower: 'Верх/Низ', push_pull: 'Жим/Тяга', ppl: 'PPL', bro: 'Сплит', legs_push_pull: 'Ноги/Жим/Тяга', custom: 'Свой' };

export interface DiaryRecordingFormProps {
  diary: any;
  selectedWeek: number;
  onSave: () => void;
}

export const DiaryRecordingForm: React.FC<DiaryRecordingFormProps> = ({ diary, selectedWeek, onSave }) => {
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
  const [saveError, setSaveError] = useState<string | null>(null);
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(hover: none) and (pointer: coarse)').matches;

  useEffect(() => {
    if (!exId) return;
    const cat = EXERCISE_CATALOG.find(x => x.id === exId);
    if (cat && isBWExercise(cat)) setExW(0);
  }, [exId]);

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
        estimated1RM: epley1RM(e.weight, e.reps),
        isCompound: cat?.type === 'compound', weekNumber: selectedWeek,
      };
    });
    try {
      await diary.saveWorkoutLog({
        id: wid, date: logDate, duration: logDuration, exercises: exList,
        overallRPE: logRPE, recoveryBefore: logRecovery, split: logSplit,
        weekNumber: selectedWeek,
        notes: `Самочувствие: ${FELT_LABELS[logFelt]}${logNotes ? ' · ' + logNotes : ''}`,
      });
      for (const ex of exList) { await diary.saveStrengthLog(ex); }
      setSaved(true); setTimeout(() => setSaved(false), 2500);
      setLogExercises([]); setLogNotes(''); setLogDuration(60); setLogRPE(7);
      onSave();
    } catch {
      setSaveError('Ошибка сохранения');
      setTimeout(() => setSaveError(null), 3000);
    }
  };

  return (
    <div style={{ padding: 12, borderRadius: 14, background: 'rgba(24,24,27,0.12)', border: '1px solid rgba(255,255,255,0.04)', marginBottom: 8 }}>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 500, letterSpacing: '0.3px', textTransform: 'uppercase', marginBottom: 8 }}>📝 Записать тренировку</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 6 }}>
        <div><label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Дата</label><input type="date" value={logDate} onChange={e => setLogDate(e.target.value)} style={style.input} /></div>
        <div><label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Длительность (мин)</label><input type="number" min={1} value={logDuration} onChange={e => setLogDuration(parseInt(e.target.value) || 0)} style={style.input} /></div>
        <div><label style={{ fontSize: 10, color: 'var(--text-dim)' }}>RPE (1-10)</label><input type="number" min={1} max={10} value={logRPE} onChange={e => setLogRPE(parseInt(e.target.value) || 5)} style={style.input} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 6 }}>
        <div><label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Восстановление (1-10)</label><input type="number" min={1} max={10} value={logRecovery} onChange={e => setLogRecovery(parseInt(e.target.value) || 5)} style={style.input} /></div>
        <div><label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Сплит</label>
          <select value={logSplit} onChange={e => setLogSplit(e.target.value)} style={style.input}>
            {Object.entries(SP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div><label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Самочувствие</label>
          <select value={logFelt} onChange={e => setLogFelt(parseInt(e.target.value))} style={style.input}>
            {FELT_LABELS.map((l, i) => <option key={i} value={i}>{l}</option>)}
          </select>
        </div>
      </div>
      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Заметки</label>
        <input type="text" value={logNotes} onChange={e => setLogNotes(e.target.value)} placeholder="Самочувствие, особенности, инвентарь..." style={style.input} />
      </div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 500, letterSpacing: '0.3px', textTransform: 'uppercase', marginBottom: 8 }}>🏋️ Упражнения</div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr 1fr auto' : '1fr 0.5fr 0.5fr 0.5fr auto', gap: 4, marginBottom: 6, alignItems: 'end' }}>
        <div style={isMobile ? { gridColumn: '1 / -1' } : undefined}><label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Упражнение</label>
          <select value={exId} onChange={e => setExId(e.target.value)} style={style.input}><option value="">— Выбрать —</option>{EXERCISE_CATALOG.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
        </div>
        <div><label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Вес (кг)</label><input type="number" value={exW} disabled={!!(exId && isBWExercise(EXERCISE_CATALOG.find(x => x.id === exId) || { name: '' }))} onChange={e => setExW(parseFloat(e.target.value) || 0)} style={{ ...style.input, opacity: exId && isBWExercise(EXERCISE_CATALOG.find(x => x.id === exId) || { name: '' }) ? 0.5 : 1 }} /></div>
        <div><label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Повт</label><input type="number" value={exR} onChange={e => setExR(parseInt(e.target.value) || 0)} style={style.input} /></div>
        <div><label style={{ fontSize: 10, color: 'var(--text-dim)' }}>RIR</label><input type="number" min={0} max={5} value={exRI} onChange={e => setExRI(parseInt(e.target.value) || 0)} style={style.input} /></div>
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
        {saveError && <span style={{ color: '#ef4444', fontWeight: 700 }}>{saveError}</span>}
      </div>
      <button onClick={handleSaveWorkout} disabled={logExercises.length === 0} style={{ ...style.btn, opacity: logExercises.length === 0 ? 0.4 : 1 }}>💾 Сохранить тренировку</button>
    </div>
  );
};
