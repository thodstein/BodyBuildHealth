import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import { isBodyweightExercise as isBWExercise } from '../../../engines/movement-pattern';
import { epley1RM } from '../../../engines/e1rm';
import { getAliasesForExercise } from '../../../engines/exercise-aliases';
import { loadReadinessHistory } from './readiness-history';
import { MMCSetPanel } from './MMCSetPanel';
import { MindsetCheckinInline } from '../SRCBBScreen_parts/MindsetSessionPanels';
import { MobilityCheckinInline } from '../SRCBBScreen_parts/MobilitySessionPanel';
import { WarmupCheckinInline } from '../SRCBBScreen_parts/WarmupSessionPanel';
import { CooldownCheckinInline } from '../SRCBBScreen_parts/CooldownSessionPanel';
import { getPreviousWorkoutData } from './diary-shared';
import type { StrengthLogEntry, WorkoutLog } from '../../../core/types';

const ACCENT = '#00e68a';

const style: Record<string, React.CSSProperties> = {
  input: { width: '100%', padding: '6px 4px', borderRadius: 6, background: '#18181b', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 11, boxSizing: 'border-box' as any },
};

const FELT_LABELS = ['👎 Ужасно', '😟 Плохо', '😐 Нормально', '🙂 Хорошо', '😄 Отлично'];
const SP_LABELS: Record<string, string> = { fullbody: 'Фулбоди', upper_lower: 'Верх/Низ', push_pull: 'Жим/Тяга', ppl: 'PPL', bro: 'Сплит', legs_push_pull: 'Ноги/Жим/Тяга', custom: 'Свой' };

interface SetRecord {
  weight: number;
  reps: number;
  rir: number;
  rpe: number;
  completed: boolean;
  notes?: string;
  /** Оценка техники: 5 (отлично) / 4 (норма) / 3 (слабо). */
  technique?: number;
}

interface ExerciseRecord {
  exerciseId: string;
  exerciseName: string;
  sets: SetRecord[];
  isSuperset?: boolean;
  supersetGroup?: number;
  notes?: string;
}

interface DiaryRecordingFormProps {
  diary: any;
  selectedНеделя: number;
  onSave: () => void;
  historyWorkouts?: WorkoutLog[];
  /** План дня для предзаполнения (кнопка «Записать по плану»). */
  pendingTemplate?: { exercises: Array<{ name?: string; sets?: number; reps?: string | number; rir?: number }> } | null;
  templateKey?: number;
  onTemplateApplied?: () => void;
}

export const DiaryRecordingForm: React.FC<DiaryRecordingFormProps> = ({ diary, selectedWeek, onSave, historyWorkouts = [], pendingTemplate = null, templateKey = 0, onTemplateApplied }) => {
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [logDuration, setLogDuration] = useState(60);
  const [logRPE, setLogRPE] = useState(7);
  const [logRecovery, setLogRecovery] = useState(5);
  const [logFelt, setLogFelt] = useState(2);
  const [logNotes, setLogNotes] = useState('');
  const [logSplit, setLogSplit] = useState('fullbody');
  const [exercises, setExercises] = useState<ExerciseRecord[]>([]);
  const [currentExIdx, setCurrentExIdx] = useState(0);
  const [currentSetIdx, setCurrentSetIdx] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<typeof EXERCISE_CATALOG>([]);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedWid, setSavedWid] = useState<string | null>(null);
  const [savedSummary, setSavedSummary] = useState<{ exercises: number; sets: number; volume: number; date: string } | null>(null);
  const [nextSupersetGroup, setNextSupersetGroup] = useState(1);
  const [restTimer, setRestTimer] = useState(0);
  const [restTarget, setRestTarget] = useState(90);
  const [mmcOpen, setMmcOpen] = useState<Record<string, boolean>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Undo history
  const undoRef = useRef<ExerciseRecord[][]>([]);
  const pushUndo = useCallback((snapshot: ExerciseRecord[]) => {
    undoRef.current = [...undoRef.current.slice(-19), JSON.parse(JSON.stringify(snapshot))];
  }, []);
  const undo = useCallback(() => {
    if (undoRef.current.length === 0) return;
    const prev = undoRef.current.pop()!;
    setExercises(prev);
    setCurrentExIdx(Math.min(currentExIdx, prev.length - 1));
  }, [currentExIdx]);

  // Auto-save draft to localStorage
  const DRAFT_KEY = 'he_diary_draft';
  const [draftRestored, setDraftRestored] = useState(false);

  // Чек-ин: префилл «Восстановление» из последней записи готовности (readiness history)
  useEffect(() => {
    try {
      const rh = loadReadinessHistory();
      if (rh.length > 0) {
        const last = rh[rh.length - 1];
        const rec = Math.round((last.recovery || 50) / 10);
        setLogRecovery(Math.max(1, Math.min(10, rec || 5)));
      }
    } catch {}
  }, []);
  useEffect(() => {
    if (exercises.length === 0) return;
    const timer = setTimeout(() => {
      try {
        const draft = { exercises, logDate, logDuration, logRPE, logRecovery, logFelt, logSplit, logNotes, savedAt: Date.now() };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {}
    }, 1000);
    return () => clearTimeout(timer);
  }, [exercises, logDate, logDuration, logRPE, logRecovery, logFelt, logSplit, logNotes]);

  // Restore draft on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (!draft?.exercises?.length) return;
      const age = Date.now() - (draft.savedAt || 0);
      if (age > 24 * 60 * 60 * 1000) { localStorage.removeItem(DRAFT_KEY); return; }
      if (exercises.length === 0) {
        setExercises(draft.exercises);
        if (draft.logDate) setLogDate(draft.logDate);
        if (draft.logDuration) setLogDuration(draft.logDuration);
        if (draft.logRPE) setLogRPE(draft.logRPE);
        if (draft.logRecovery) setLogRecovery(draft.logRecovery);
        if (draft.logFelt) setLogFelt(draft.logFelt);
        if (draft.logSplit) setLogSplit(draft.logSplit);
        if (draft.logNotes) setLogNotes(draft.logNotes);
        setDraftRestored(true);
        setTimeout(() => setDraftRestored(false), 4000);
      }
    } catch {}
  }, []);

  // Clear draft after save
  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
  }, []);

  // Load template from tools mode
  useEffect(() => {
    const handler = () => {
      try {
        const raw = localStorage.getItem('he_diary_template');
        if (!raw) return;
        const template = JSON.parse(raw);
        if (!template?.exercises?.length) return;
        setExercises(template.exercises);
        if (template.overallRPE) setLogRPE(template.overallRPE);
        if (template.split) setLogSplit(template.split);
        if (template.notes) setLogNotes(template.notes);
        localStorage.removeItem('he_diary_template');
      } catch {}
    };
    window.addEventListener('diary-template-loaded', handler);
    return () => window.removeEventListener('diary-template-loaded', handler);
  }, []);

  // План дня → предзаполнение формы («Записать по плану»)
  const [planApplied, setPlanApplied] = useState(false);
  useEffect(() => {
    if (!pendingTemplate || !templateKey) return;
    if (!pendingTemplate.exercises || pendingTemplate.exercises.length === 0) return;
    const exs: ExerciseRecord[] = pendingTemplate.exercises.map((e: any) => {
      const cat = EXERCISE_CATALOG.find((c: any) => c.name === e.name);
      const reps = Math.max(1, parseInt(String(e.reps)) || 10);
      const sets: SetRecord[] = Array.from({ length: Math.max(1, Number(e.sets) || 3) }, () => ({ weight: 0, reps, rir: Number(e.rir) || 2, rpe: 7, completed: false }));
      return { exerciseId: cat?.id || e.name || 'custom', exerciseName: cat?.name || e.name || 'Упражнение', sets };
    });
    if (exs.length === 0) return;
    pushUndo(exercises);
    setExercises(exs);
    setCurrentExIdx(0);
    setCurrentSetIdx(0);
    setPlanApplied(true);
    setTimeout(() => setPlanApplied(false), 5000);
    onTemplateApplied?.();
  }, [templateKey]);

  // Toggle superset for an exercise (links it with the previous one)
  const toggleSuperset = useCallback((idx: number) => {
    pushUndo(exercises);
    setExercises(prev => {
      const updated = [...prev];
      const ex = { ...updated[idx] };
      if (ex.isSuperset) {
        ex.isSuperset = false;
        ex.supersetGroup = undefined;
        updated[idx] = ex;
      } else {
        const prevEx = updated[idx - 1];
        if (prevEx) {
          const group = prevEx.supersetGroup || nextSupersetGroup;
          ex.isSuperset = true;
          ex.supersetGroup = group;
          prevEx.isSuperset = true;
          prevEx.supersetGroup = group;
          updated[idx - 1] = { ...prevEx };
          updated[idx] = ex;
          setNextSupersetGroup(g => g + 1);
        }
      }
      return updated;
    });
  }, [exercises, nextSupersetGroup, pushUndo]);

  // Keyboard shortcut Ctrl+Z
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo]);

  // Search exercises
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const q = searchQuery.toLowerCase();
    const matches = EXERCISE_CATALOG
      .filter(ex => ex.name.toLowerCase().includes(q) || ex.id.toLowerCase().includes(q) || getAliasesForExercise(ex.id).some(a => a.toLowerCase().includes(q)))
      .slice(0, 8);
    setSearchResults(matches);
  }, [searchQuery]);

  // Rest timer countdown
  useEffect(() => {
    if (restTimer > 0) {
      timerRef.current = setTimeout(() => setRestTimer(prev => prev - 1), 1000);
      return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }
  }, [restTimer]);

  const addExercise = useCallback((ex: typeof EXERCISE_CATALOG[0]) => {
    const isBW = isBWExercise(ex);
    const prev = getPreviousWorkoutData(historyWorkouts, ex.name);
    const firstSet: SetRecord = {
      weight: isBW ? 0 : (prev?.weight || 0),
      reps: prev?.reps || 10,
      rir: prev?.rir || 2,
      rpe: 7,
      completed: false,
    };
    const newEx: ExerciseRecord = { exerciseId: ex.id, exerciseName: ex.name, sets: [firstSet] };
    pushUndo(exercises);
    setExercises(prev => [...prev, newEx]);
    setCurrentExIdx(exercises.length);
    setCurrentSetIdx(0);
    setSearchQuery('');
    setSearchResults([]);
  }, [exercises, historyWorkouts, pushUndo]);

  const addSet = useCallback(() => {
    if (!exercises[currentExIdx]) return;
    const lastSet = exercises[currentExIdx].sets[exercises[currentExIdx].sets.length - 1];
    const newSet: SetRecord = { weight: lastSet?.weight || 0, reps: lastSet?.reps || 10, rir: lastSet?.rir || 2, rpe: 7, completed: false };
    pushUndo(exercises);
    setExercises(prev => {
      const updated = [...prev];
      updated[currentExIdx] = { ...updated[currentExIdx], sets: [...updated[currentExIdx].sets, newSet] };
      return updated;
    });
    setCurrentSetIdx(exercises[currentExIdx].sets.length);
  }, [currentExIdx, exercises, pushUndo]);

  // Keyboard shortcut: Enter = add set to current exercise (только в полях подходов),
  // в поиске — выбрать первый результат
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') return;
      if (target?.dataset?.setInput === '1') {
        e.preventDefault();
        addSet();
        return;
      }
      if (target?.dataset?.exSearch === '1') {
        e.preventDefault();
        if (searchResults.length > 0) addExercise(searchResults[0]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [addSet, addExercise, searchResults]);

  const updateSet = useCallback((exIdx: number, setIdx: number, patch: Partial<SetRecord>) => {
    setExercises(prev => {
      const updated = [...prev];
      const ex = { ...updated[exIdx] };
      const sets = [...ex.sets];
      sets[setIdx] = { ...sets[setIdx], ...patch };
      ex.sets = sets;
      updated[exIdx] = ex;
      return updated;
    });
  }, []);

  const removeExercise = useCallback((idx: number) => {
    pushUndo(exercises);
    setExercises(prev => prev.filter((_, i) => i !== idx));
    setCurrentExIdx(Math.min(currentExIdx, Math.max(0, exercises.length - 2)));
  }, [currentExIdx, exercises, pushUndo]);

  const removeSet = useCallback((exIdx: number, setIdx: number) => {
    pushUndo(exercises);
    setExercises(prev => {
      const updated = [...prev];
      const ex = { ...updated[exIdx] };
      ex.sets = ex.sets.filter((_, i) => i !== setIdx);
      if (ex.sets.length === 0) return updated.filter((_, i) => i !== exIdx);
      updated[exIdx] = ex;
      return updated;
    });
  }, [exercises, pushUndo]);

  const handleSaveWorkout = async () => {
    if (exercises.length === 0) return;
    const wid = `workout_${Date.now()}`;
      const exList: StrengthLogEntry[] = exercises.map((e, i) => {
      const cat = EXERCISE_CATALOG.find(x => x.id === e.exerciseId);
      const completedSets = e.sets.filter(s => s.completed || (s.weight > 0 && s.reps > 0));
      // Суперсеты и заметки хранятся структурно, а не в имени упражнения
      return {
        id: `${wid}_${i}`, date: logDate, exerciseId: e.exerciseId,
        exerciseName: cat?.name || e.exerciseId,
        sets: completedSets.map(s => ({ weight: s.weight, reps: s.reps, rir: s.rir, rpe: s.rpe, notes: s.notes || undefined, techniqueScore: s.technique })),
        totalVolume: completedSets.reduce((s, st) => s + st.weight * st.reps, 0),
        estimated1RM: Math.max(...completedSets.map(s => epley1RM(s.weight, s.reps)), 0),
        isCompound: cat?.type === 'compound', weekNumber: selectedWeek,
        supersetGroup: e.isSuperset && e.supersetGroup ? e.supersetGroup : undefined,
        note: e.notes || undefined,
      };
    }).filter(e => e.sets.length > 0);
    if (exList.length === 0) return;
    try {
      await diary.saveWorkoutLog({
        id: wid, date: logDate, duration: logDuration, exercises: exList,
        overallRPE: logRPE, recoveryBefore: logRecovery, split: logSplit,
        weekNumber: selectedWeek,
        notes: `Самочувствие: ${FELT_LABELS[logFelt]}${logNotes ? ' · ' + logNotes : ''}`,
      });
      for (const ex of exList) { await diary.saveStrengthLog(ex); }
      setSavedSummary({ exercises: exList.length, sets: totalSets, volume: totalVolume, date: logDate });
      setSavedWid(wid);
      setSaved(true); setTimeout(() => { setSaved(false); setSavedSummary(null); }, 4000);
      undoRef.current = [];
      setExercises([]); setLogNotes(''); setLogDuration(60); setLogRPE(7);
      clearDraft();
      onSave();
    } catch {
      setSaveError('Ошибка сохранения');
      setTimeout(() => setSaveError(null), 3000);
    }
  };

  const totalSets = exercises.reduce((s, e) => s + e.sets.length, 0);
  const totalVolume = exercises.reduce((s, e) => s + e.sets.reduce((ss, st) => ss + st.weight * st.reps, 0), 0);
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(hover: none) and (pointer: coarse)').matches;

  return (
    <div style={{ padding: 12, borderRadius: 14, background: 'rgba(24,24,27,0.12)', border: '1px solid rgba(255,255,255,0.04)', marginBottom: 8 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', fontWeight: 500, letterSpacing: '0.3px', textTransform: 'uppercase' }}>📝 Записать тренировку</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {undoRef.current.length > 0 && (
            <button onClick={undo} style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.85)', cursor: 'pointer', fontSize: 10 }}>↩</button>
          )}
          {totalSets > 0 && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)' }}>{totalSets} сетов · {totalVolume.toLocaleString()} кг</span>}
        </div>
      </div>

      {/* Session fields */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr', gap: 6, marginBottom: 6 }}>
        <div><label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Дата</label><input type="date" value={logDate} onChange={e => setLogDate(e.target.value)} style={style.input} /></div>
        <div><label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Длительность (мин)</label><input type="number" min={1} value={logDuration} onChange={e => setLogDuration(parseInt(e.target.value) || 0)} style={style.input} /></div>
        {!isMobile && <div><label style={{ fontSize: 10, color: 'var(--text-dim)' }}>RPE (1-10)</label><input type="number" min={1} max={10} value={logRPE} onChange={e => setLogRPE(parseInt(e.target.value) || 5)} style={style.input} /></div>}
      </div>
      {isMobile && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
          <div><label style={{ fontSize: 10, color: 'var(--text-dim)' }}>RPE (1-10)</label><input type="number" min={1} max={10} value={logRPE} onChange={e => setLogRPE(parseInt(e.target.value) || 5)} style={style.input} /></div>
          <div><label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Восстановление</label><input type="number" min={1} max={10} value={logRecovery} onChange={e => setLogRecovery(parseInt(e.target.value) || 5)} style={style.input} /></div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr', gap: 6, marginBottom: 6 }}>
        {!isMobile && <div><label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Восстановление (1-10)</label><input type="number" min={1} max={10} value={logRecovery} onChange={e => setLogRecovery(parseInt(e.target.value) || 5)} style={style.input} /></div>}
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
        {/* Quick note tags */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
          {[
            { tag: 'хорошая разминка', emoji: '🔥' },
            { tag: 'сильная нагрузка', emoji: '💪' },
            { tag: 'слабая разминка', emoji: '😴' },
            { tag: 'проблемы со сном', emoji: '🛏️' },
            { tag: 'стресс на работе', emoji: '💼' },
            { tag: 'памп отличный', emoji: '泵' },
            { tag: 'DOMS', emoji: '🦵' },
            { tag: 'травма/боль', emoji: '⚠️' },
            { tag: 'пропустил разминку', emoji: '❌' },
            { tag: 'хороший аппетит', emoji: '🍽️' },
          ].map(qt => (
            <button key={qt.tag} type="button" onClick={() => {
              setLogNotes(prev => prev ? `${prev}, ${qt.tag}` : qt.tag);
            }} style={{
              padding: '2px 6px', borderRadius: 10, fontSize: 9,
              background: logNotes.includes(qt.tag) ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.04)',
              color: logNotes.includes(qt.tag) ? '#00e68a' : 'rgba(255,255,255,0.85)',
              border: `1px solid ${logNotes.includes(qt.tag) ? 'rgba(0,230,138,0.3)' : 'rgba(255,255,255,0.06)'}`,
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}>{qt.emoji} {qt.tag}</button>
          ))}
        </div>
      </div>

      {/* Repeat last workout button */}
      {exercises.length === 0 && historyWorkouts.length > 0 && (
        <button onClick={() => {
          const last = historyWorkouts[0];
          if (!last?.exercises?.length) return;
          pushUndo(exercises);
          const repeated: ExerciseRecord[] = last.exercises.map((ex: any) => ({
            exerciseId: ex.exerciseId,
            exerciseName: ex.exerciseName.replace(/\s*\[superset:\d+\]/, ''),
            sets: (ex.sets || []).map((s: any) => ({
              weight: s.weight || 0, reps: s.reps || 10, rir: s.rir || 2, rpe: s.rpe || 7, completed: false,
            })),
          }));
          setExercises(repeated);
          setCurrentExIdx(0);
          setCurrentSetIdx(0);
        }}
          style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px dashed rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.04)', color: ACCENT, cursor: 'pointer', fontSize: 11, marginBottom: 8 }}>
          🔄 Повторить тренировку от {new Date(historyWorkouts[0].date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
        </button>
      )}

      {/* Draft restored indicator */}
      {draftRestored && exercises.length > 0 && (
        <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', marginBottom: 8, fontSize: 10, color: '#60a5fa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>📋 Черновик восстановлен ({exercises.length} упр.)</span>
          <button onClick={() => { setExercises([]); clearDraft(); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.85)', cursor: 'pointer', fontSize: 10 }}>✕ очистить</button>
        </div>
      )}

      {/* Plan applied indicator */}
      {planApplied && exercises.length > 0 && (
        <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.25)', marginBottom: 8, fontSize: 10, color: '#00e68a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>🎯 План загружен: {exercises.length} упр. — заполните веса и повторы</span>
          <button onClick={() => { setExercises([]); setPlanApplied(false); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.85)', cursor: 'pointer', fontSize: 10 }}>✕</button>
        </div>
      )}

      {/* Exercise search */}
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', fontWeight: 500, letterSpacing: '0.3px', textTransform: 'uppercase', marginBottom: 8 }}>🏋️ Упражнения</div>
      {/* Muscle group quick filter */}
      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 6 }}>
        {[
          { id: '', label: 'Все' },
          { id: 'chest', label: 'Грудь' },
          { id: 'back', label: 'Спина' },
          { id: 'shoulders', label: 'Плечи' },
          { id: 'quads', label: 'Ноги' },
          { id: 'biceps', label: 'Бицепс' },
          { id: 'triceps', label: 'Трицепс' },
          { id: 'core', label: 'Кор' },
        ].map(g => (
          <button key={g.id} type="button" onClick={() => {
            if (g.id) {
              setSearchQuery(g.label);
              const filtered = EXERCISE_CATALOG.filter((e: any) => e.group === g.id);
              setSearchResults(filtered);
            } else {
              setSearchQuery('');
              setSearchResults([]);
            }
          }} style={{
            padding: '3px 8px', borderRadius: 10, fontSize: 9,
            background: searchQuery === g.label ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.04)',
            color: searchQuery === g.label ? '#00e68a' : 'rgba(255,255,255,0.85)',
            border: `1px solid ${searchQuery === g.label ? 'rgba(0,230,138,0.3)' : 'rgba(255,255,255,0.06)'}`,
            cursor: 'pointer',
          }}>{g.label}</button>
        ))}
      </div>
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <input
          type="text" value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onBlur={() => setTimeout(() => setSearchResults([]), 200)}
          placeholder="🔍 Поиск упражнения..."
          data-ex-search="1"
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: '#18181b', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 12, boxSizing: 'border-box' as any }}
        />
        {searchResults.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, zIndex: 100, maxHeight: 200, overflowY: 'auto', marginTop: 4 }}>
            {searchResults.map(ex => (
              <div key={ex.id} onClick={() => addExercise(ex)} style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#fff' }}>{ex.name}</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)' }}>{ex.group}</span>
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
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 4 }}>Недавние:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {recent.map(r => {
                const cat = EXERCISE_CATALOG.find((c: any) => c.name === r.name);
                return (
                  <button key={r.name} onClick={() => { const ex = EXERCISE_CATALOG.find((c: any) => c.name === r.name); if (ex) addExercise(ex); }}
                    style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color:'rgba(255,255,255,0.9)', cursor: 'pointer', fontSize: 10 }}>
                    {r.name}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Exercise list with multi-set support */}
      {exercises.length === 0 && (
        <div style={{ textAlign: 'center', padding: 24, borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)', marginBottom: 8 }}>
          <div style={{ fontSize: 24, marginBottom: 6 }}>🏋️</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>Начните с поиска упражнения выше</div>
        </div>
      )}

      {/* Expand/collapse all exercises */}
      {exercises.length >= 2 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4, gap: 6 }}>
          <button onClick={() => setCurrentExIdx(-1)} style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>▾ Все свернуть</button>
          <button onClick={() => setCurrentExIdx(0)} style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>▸ Первое</button>
        </div>
      )}

      {exercises.map((ex, exIdx) => {
        const isCurrent = exIdx === currentExIdx;
        const cat = EXERCISE_CATALOG.find(x => x.id === ex.exerciseId);
        const prev = getPreviousWorkoutData(historyWorkouts, ex.exerciseName);
        const isSupersetPaired = ex.isSuperset && ex.supersetGroup;
        return (
          <div key={exIdx} style={{
            borderRadius: 10, overflow: 'hidden', marginBottom: 6,
            background: isCurrent ? 'rgba(0,230,138,0.04)' : 'rgba(255,255,255,0.02)',
            border: `1px solid ${isCurrent ? 'rgba(0,230,138,0.2)' : 'rgba(255,255,255,0.04)'}`,
            marginLeft: ex.isSuperset ? 12 : 0,
            borderLeft: ex.isSuperset ? '3px solid #a855f7' : undefined,
          }}>
            {/* Exercise header */}
            <div onClick={() => { setCurrentExIdx(exIdx); setCurrentSetIdx(0); }}
              style={{ padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {ex.isSuperset && <span style={{ fontSize: 9, color: '#a855f7', fontWeight: 700 }}>🔗</span>}
                  {cat?.name || ex.exerciseName}
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)' }}>
                  {ex.sets.length} подходов
                  {prev && <span style={{ marginLeft: 6, color: ACCENT }}>прошлый: {prev.weight}кг×{prev.reps}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={e => {
                  e.stopPropagation();
                  const updated = [...exercises];
                  updated[exIdx] = { ...updated[exIdx], notes: updated[exIdx].notes !== undefined ? undefined : '' };
                  setExercises(updated);
                  if (updated[exIdx].notes !== undefined) setCurrentExIdx(exIdx);
                }}
                  style={{
                    width: 28, height: 28, borderRadius: 6,
                    border: `1px solid ${ex.notes !== undefined ? '#a855f7' : 'rgba(255,255,255,0.1)'}`,
                    background: ex.notes !== undefined ? 'rgba(168,85,247,0.15)' : 'transparent',
                    color: ex.notes !== undefined ? '#a855f7' : 'rgba(255,255,255,0.85)',
                    cursor: 'pointer', fontSize: 11,
                  }} title="Заметка">📝</button>
                {exIdx > 0 && (
                  <button onClick={e => { e.stopPropagation(); toggleSuperset(exIdx); }}
                    style={{
                      width: 28, height: 28, borderRadius: 6,
                      border: `1px solid ${ex.isSuperset ? '#a855f7' : 'rgba(255,255,255,0.1)'}`,
                      background: ex.isSuperset ? 'rgba(168,85,247,0.15)' : 'transparent',
                      color: ex.isSuperset ? '#a855f7' : 'rgba(255,255,255,0.85)',
                      cursor: 'pointer', fontSize: 12,
                    }} title="Суперсет с предыдущим">🔗</button>
                )}
                <button onClick={e => { e.stopPropagation(); addSet(); }}
                  style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: ACCENT, cursor: 'pointer', fontSize: 14 }}>+</button>
                <button onClick={e => { e.stopPropagation(); removeExercise(exIdx); }}
                  style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer', fontSize: 11 }}>✕</button>
              </div>
            </div>

            {/* Exercise notes */}
            {isCurrent && ex.notes !== undefined && (
              <div style={{ padding: '0 10px 4px' }}>
                <input type="text" value={ex.notes || ''}
                  onChange={e => {
                    const updated = [...exercises];
                    updated[exIdx] = { ...updated[exIdx], notes: e.target.value };
                    setExercises(updated);
                  }}
                  placeholder="заметка к упражнению..."
                  style={{ width: '100%', padding: '4px 8px', borderRadius: 5, background: 'transparent', border: '1px solid rgba(168,85,247,0.15)', color: 'rgba(255,255,255,0.85)', fontSize: 10, boxSizing: 'border-box' as any }} />
              </div>
            )}

            {/* Exercise suggestion for new exercise */}
            {isCurrent && !prev && ex.sets.length <= 1 && (() => {
              const isCompound = cat?.type === 'compound';
              const suggested = isCompound
                ? { sets: 4, reps: '6-8', rir: 2, rest: 180, note: 'Базовое: 4×6-8, отдых 2-3 мин' }
                : { sets: 3, reps: '10-12', rir: 2, rest: 60, note: 'Изоляция: 3×10-12, отдых 60-90 сек' };
              return (
                <div style={{ padding: '4px 10px', marginBottom: 4, fontSize: 9, color: 'rgba(255,255,255,0.85)', background: 'rgba(255,255,255,0.02)', borderRadius: 6, border: '1px dashed rgba(255,255,255,0.06)' }}>
                  💡 {suggested.note}
                </div>
              );
            })()}

            {/* Sets */}
            {isCurrent && (
              <div style={{ padding: '0 10px 8px' }}>
                {/* Rest timer bar */}
                {restTimer > 0 && (
                  <div style={{
                    padding: '8px 12px', borderRadius: 8, marginBottom: 6,
                    background: restTimer <= 10 ? 'rgba(239,68,68,0.15)' : 'rgba(0,230,138,0.08)',
                    border: `1px solid ${restTimer <= 10 ? 'rgba(239,68,68,0.3)' : 'rgba(0,230,138,0.2)'}`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)' }}>Отдых</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: restTimer <= 10 ? '#ef4444' : ACCENT }}>
                        {Math.floor(restTimer / 60)}:{(restTimer % 60).toString().padStart(2, '0')}
                      </div>
                    </div>
                    <button onClick={() => setRestTimer(0)} style={{
                      padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)',
                      background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: 11,
                    }}>Пропустить</button>
                  </div>
                )}

                {/* Set header */}
                <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr 1fr 1fr 1fr 96px', gap: 3, marginBottom: 4, fontSize: 10, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', paddingLeft: 2 }}>
                  <span>#</span><span style={{ textAlign: 'center' }}>кг</span><span style={{ textAlign: 'center' }}>повт</span><span style={{ textAlign: 'center' }}>RPE</span><span style={{ textAlign: 'center' }}>RIR</span><span></span>
                </div>
                {ex.sets.map((set, setIdx) => (
                  <React.Fragment key={setIdx}>
                    <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr 1fr 1fr 1fr 96px', gap: 3, marginBottom: 3, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: ACCENT, textAlign: 'center' }}>{setIdx + 1}</span>
                      <input type="number" value={set.weight} disabled={isBWExercise({ name: ex.exerciseName })} data-set-input="1"
                        onChange={e => updateSet(exIdx, setIdx, { weight: parseFloat(e.target.value) || 0 })}
                        style={{ padding: '6px 4px', borderRadius: 5, background: '#18181b', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 12, textAlign: 'center', minHeight: isMobile ? 44 : 34 }} />
                      <input type="number" value={set.reps} data-set-input="1"
                        onChange={e => updateSet(exIdx, setIdx, { reps: parseInt(e.target.value) || 0 })}
                        onBlur={e => {
                          // Авто-старт таймера отдыха после ввода повторов последнего подхода
                          const repsVal = parseInt(e.currentTarget.value) || 0;
                          const lastSet = exercises[currentExIdx]?.sets;
                          if (lastSet && setIdx === lastSet.length - 1 && set.weight > 0 && repsVal > 0) {
                            setRestTimer(restTarget);
                          }
                        }}
                        style={{ padding: '6px 4px', borderRadius: 5, background: '#18181b', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 12, textAlign: 'center', minHeight: isMobile ? 44 : 34 }} />
                      <input type="number" min={1} max={10} value={set.rpe} data-set-input="1"
                        onChange={e => updateSet(exIdx, setIdx, { rpe: parseInt(e.target.value) || 5 })}
                        style={{ padding: '6px 4px', borderRadius: 5, background: '#18181b', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 12, textAlign: 'center', minHeight: isMobile ? 44 : 34 }} />
                      <input type="number" min={0} max={5} value={set.rir} data-set-input="1"
                        onChange={e => updateSet(exIdx, setIdx, { rir: parseInt(e.target.value) || 0 })}
                        style={{ padding: '6px 4px', borderRadius: 5, background: '#18181b', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 12, textAlign: 'center', minHeight: isMobile ? 44 : 34 }} />
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button onClick={() => setMmcOpen(prev => ({ ...prev, [`${exIdx}_${setIdx}`]: !prev[`${exIdx}_${setIdx}`] }))}
                          style={{ width: 22, height: 22, borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 9,
                            background: mmcOpen[`${exIdx}_${setIdx}`] ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.05)',
                            color: mmcOpen[`${exIdx}_${setIdx}`] ? '#00e68a' : 'rgba(255,255,255,0.85)' }}
                          title="MMC/Пампинг/Суставы/Энергия">
                          🧠
                        </button>
                        <button onClick={() => {
                          // Цикл оценки техники: нет → 5 → 4 → 3 → нет
                          const next = set.technique === undefined ? 5 : set.technique === 5 ? 4 : set.technique === 4 ? 3 : undefined;
                          updateSet(exIdx, setIdx, { technique: next });
                        }}
                          style={{ width: 22, height: 22, borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 10,
                            background: set.technique ? (set.technique === 5 ? 'rgba(34,197,94,0.15)' : set.technique === 4 ? 'rgba(96,165,250,0.15)' : 'rgba(239,68,68,0.15)') : 'rgba(255,255,255,0.05)',
                            color: set.technique ? (set.technique === 5 ? '#22c55e' : set.technique === 4 ? '#60a5fa' : '#ef4444') : 'rgba(255,255,255,0.85)' }}
                          title={set.technique ? `Техника: ${set.technique}/5` : 'Оценить технику (нет)'}>
                          {set.technique ? (set.technique === 5 ? '✅' : set.technique === 4 ? '🎯' : '⚠️') : '🎯'}
                        </button>
                        <button onClick={() => {
                          const updated = [...exercises];
                          const ex2 = { ...updated[exIdx] };
                          const sets2 = [...ex2.sets];
                          sets2[setIdx] = { ...sets2[setIdx], notes: sets2[setIdx].notes ? '' : ' ' };
                          ex2.sets = sets2;
                          updated[exIdx] = ex2;
                          setExercises(updated);
                        }}
                          style={{ width: 22, height: 22, borderRadius: 4, border: 'none', background: set.notes ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.05)', color: set.notes ? '#a855f7' : 'rgba(255,255,255,0.85)', cursor: 'pointer', fontSize: 9 }}>📝</button>
                        <button onClick={() => removeSet(exIdx, setIdx)}
                          style={{ width: 22, height: 22, borderRadius: 4, border: 'none', background: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer', fontSize: 10 }}>✕</button>
                      </div>
                    </div>
                    {set.notes !== undefined && (
                      <input type="text" value={set.notes || ''}
                        onChange={e => updateSet(exIdx, setIdx, { notes: e.target.value })}
                        placeholder="заметка к подходу..."
                        style={{ width: '100%', padding: '3px 6px', borderRadius: 4, background: 'transparent', border: '1px solid rgba(168,85,247,0.15)', color: 'rgba(255,255,255,0.85)', fontSize: 9, marginBottom: 3, boxSizing: 'border-box' as any }} />
                    )}
                    {mmcOpen[`${exIdx}_${setIdx}`] && (
                      <div style={{ marginBottom: 3 }}>
                        <MMCSetPanel exerciseId={ex.exerciseId} exerciseName={ex.exerciseName} setNumber={setIdx + 1} date={logDate} compact />
                      </div>
                    )}
                  </React.Fragment>
                ))}
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  <button onClick={addSet}
                    style={{ flex: 1, padding: '6px', borderRadius: 6, border: '1px dashed rgba(0,230,138,0.3)', background: 'transparent', color: ACCENT, cursor: 'pointer', fontSize: 10 }}>+ Добавить подход</button>
                  <button onClick={() => setRestTimer(restTarget)}
                    style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.85)', cursor: 'pointer', fontSize: 10 }}>⏱ {restTarget}с</button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Rest target selector */}
      {exercises.length > 0 && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8, fontSize: 10, color: 'rgba(255,255,255,0.85)' }}>
          <span>Отдых:</span>
          {[60, 90, 120, 180].map(sec => (
            <button key={sec} onClick={() => setRestTarget(sec)}
              style={{
                padding: '3px 8px', borderRadius: 5,
                border: `1px solid ${restTarget === sec ? ACCENT : 'rgba(255,255,255,0.1)'}`,
                background: restTarget === sec ? 'rgba(0,230,138,0.1)' : 'transparent',
                color: restTarget === sec ? ACCENT : 'rgba(255,255,255,0.85)',
                cursor: 'pointer', fontSize: 10,
              }}>{sec}с</button>
          ))}
        </div>
      )}

      {/* Психо-чек-ин (опционально): уверенность/активация/фокус сессии */}
      {exercises.length > 0 && (
        <MindsetCheckinInline date={logDate} sessionId={savedWid || undefined} />
      )}

      {/* Чек-ин мобильности (опционально): рутина/сессия + ROM */}
      {exercises.length > 0 && (
        <MobilityCheckinInline date={logDate} sessionId={savedWid || undefined} />
      )}

      {/* Чек-ин разминки (опционально): выполнена + качество */}
      {exercises.length > 0 && (
        <WarmupCheckinInline date={logDate} sessionId={savedWid || undefined} />
      )}

      {/* Чек-ин заминки (опционально): выполнена + качество */}
      {exercises.length > 0 && (
        <CooldownCheckinInline date={logDate} sessionId={savedWid || undefined} />
      )}

      {/* Save */}
      {savedSummary ? (
        <div style={{ padding: 10, borderRadius: 10, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)', marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 4 }}>✅ Тренировка сохранена!</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, fontSize: 10, color:'rgba(255,255,255,0.9)' }}>
            <div><span style={{ color: 'rgba(255,255,255,0.85)' }}>Упражнения:</span> <strong style={{ color: '#fff' }}>{savedSummary.exercises}</strong></div>
            <div><span style={{ color: 'rgba(255,255,255,0.85)' }}>Подходы:</span> <strong style={{ color: '#fff' }}>{savedSummary.sets}</strong></div>
            <div><span style={{ color: 'rgba(255,255,255,0.85)' }}>Тоннаж:</span> <strong style={{ color: '#fff' }}>{savedSummary.volume.toLocaleString()} кг</strong></div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 10, color: 'var(--text-dim)' }}>
          <span>Всего: {exercises.length} упр. · {totalSets} подходов · {totalVolume.toLocaleString()} кг</span>
          {saved && <span style={{ color: ACCENT, fontWeight: 700 }}>✅ Сохранено!</span>}
          {saveError && <span style={{ color: '#ef4444', fontWeight: 700 }}>{saveError}</span>}
        </div>
      )}
      <button onClick={handleSaveWorkout} disabled={exercises.length === 0}
        style={{ width: '100%', padding: 10, borderRadius: 10, border: 'none', cursor: 'pointer', background: exercises.length > 0 ? 'linear-gradient(135deg,var(--accent),#00cc7a)' : 'rgba(255,255,255,0.05)', color: exercises.length > 0 ? '#000' : 'rgba(255,255,255,0.85)', fontWeight: 700, fontSize: 12, opacity: exercises.length === 0 ? 0.4 : 1 }}>
        💾 Сохранить тренировку
      </button>
    </div>
  );
};
