import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { EXERCISE_CATALOG } from '../../core/exercise-catalog';
import { calcTraining, EXERCISE_DB } from '../../engines/training.engine';
import { generateMacrocycle, getCurrentWeekPlan, MESOCYCLE_PARAMS, type MacrocyclePlan, type Microcycle, type MacrocycleInput } from '../../engines/training-periodization.engine';
import { selectSplit, getSplitOptions, type SplitCandidate } from '../../engines/split-selector.engine';
import { selectProgressionRule, calcSuggestedWeight, estimate1RM, getDeloadRecommendation } from '../../engines/progression.engine';
import { RIR_MATRIX } from '../../engines/rir-matrix.engine';
import { StrengthDiary, type StrengthStats, type WeeklyProgress, type ProgressionAlert } from '../../engines/strength-diary.engine';
import { generateWarmup } from '../../engines/warmup.engine';
import { generateCooldown } from '../../engines/cooldown.engine';
import { selectSetScheme } from '../../engines/set-scheme.engine';
import { selectTempo, formatTempo } from '../../engines/tempo.engine';
import { findSubstitute } from '../../engines/exercise-substitution.engine';
import { useDataLink } from '../../core/data-link';
import type { TrainingInput, TrainingOutput, Exercise, MovementPattern } from '../../core/types';

const WARMUP_LABELS: Record<string, string> = {
  jumping_jack: 'Прыжки ноги вместе-врозь', arm_circles: 'Круги руками', leg_swings: 'Махи ногами',
  hip_circle: 'Круги тазом', ankle_mobility: 'Мобилизация голеностопа', shoulder_circle: 'Круги плечами',
  thoracic_rotation: 'Грудная ротация', cat_camel: 'Кошка-верблюд', worlds_greatest: 'Растяжка выпадом',
  banded_clam: 'Ракушка с резинкой', external_rotation: 'Наружная ротация', bird_dog: 'Птица-собака',
  dead_bug: 'Мёртвый жук', light_cardio: 'Лёгкое кардио', squat: 'Приседания с грифом',
  deep_breathing: 'Глубокое дыхание', box_breathing: 'Квадратное дыхание 4-7-8',
};

const GOALS = [
  { value: 'bulk', label: 'Набор массы', icon: '🏋️' },
  { value: 'cut', label: 'Сушка', icon: '🔥' },
  { value: 'strength', label: 'Сила', icon: '💪' },
  { value: 'maintenance', label: 'Поддержание', icon: '⚖️' },
  { value: 'recomp', label: 'Рекомпозиция', icon: '🔄' },
  { value: 'rehab', label: 'Реабилитация', icon: '🏥' },
] as const;

const LEVELS = [
  { value: 'beginner', label: 'Новичок', icon: '🌱' },
  { value: 'intermediate', label: 'Средний', icon: '🌿' },
  { value: 'advanced', label: 'Продвинутый', icon: '🌳' },
  { value: 'enhanced', label: 'Усиленный', icon: '⚡' },
] as const;

const MUSCLE_GROUPS = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'] as const;
const GROUP_LABELS: Record<string, string> = {
    chest: 'Грудь', back: 'Спина', legs: 'Ноги', shoulders: 'Плечи', arms: 'Руки', core: 'Кор',
};
const EQUIP_LABELS: Record<string, string> = { barbell: 'Штанга', dumbbell: 'Гантели', machine: 'Тренажёр', cable: 'Блок', bodyweight: 'Вес тела', band: 'Лента', kettlebell: 'Гиря', specialty_bar: 'Спец. гриф' };
const JOINT_LABELS: Record<string, string> = { high: 'Высокая', med: 'Средняя', low: 'Низкая' };

type TrainingTab = 'plan' | 'runtime' | 'exercises' | 'calculators' | 'diary' | 'cycles';

export const TrainingScreen: React.FC = () => {
  const linked = useDataLink();
  const diary = useMemo(() => new StrengthDiary(), []);
  const [tab, setTab] = useState<TrainingTab>('plan');

  // Plan state
  const [goal, setGoal] = useState('bulk');
  const [level, setLevel] = useState('intermediate');
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [splitType, setSplitType] = useState('auto');
  const [splitCandidates, setSplitCandidates] = useState<SplitCandidate[]>([]);
  const [showSplitPicker, setShowSplitPicker] = useState(false);
  const [cycleType, setCycleType] = useState('auto');
  const [mesoLength, setMesoLength] = useState(12);
  const [recovery, setRecovery] = useState(7);
  const [fatigue, setFatigue] = useState(3);
  const [weakPoints, setWeakPoints] = useState<string[]>([]);
  const [bodyWeight, setBodyWeight] = useState(80);
  const [sleepHours, setSleepHours] = useState(7);
  const [stressLevel, setStressLevel] = useState(5);
  const [customExercises, setCustomExercises] = useState<{ name: string; sets: number; reps: number; rir: number }[]>([]);
  const [trainingOutput, setTrainingOutput] = useState<TrainingOutput | null>(null);
  const [macrocycle, setMacrocycle] = useState<MacrocyclePlan | null>(null);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [currentMicrocycle, setCurrentMicrocycle] = useState<Microcycle | null>(null);

  // Exercise DB state
  const [exSearch, setExSearch] = useState('');
  const [exGroup, setExGroup] = useState('all');
  const [exType, setExType] = useState('all');
  const [exEquipment, setExEquipment] = useState('all');
  const [selectedEx, setSelectedEx] = useState<Exercise | null>(null);

  // Calculator state
  const [calcWeight, setCalcWeight] = useState(100);
  const [calcReps, setCalcReps] = useState(5);
  const [calcRPE, setCalcRPE] = useState(8);
  const [calc1RM, setCalc1RM] = useState(100);
  const [calcPercent, setCalcPercent] = useState(75);
  const [plSquat, setPlSquat] = useState(140);
  const [plBench, setPlBench] = useState(100);
  const [plDeadlift, setPlDeadlift] = useState(180);
  const [plWeight, setPlWeight] = useState(80);
  const [plSex, setPlSex] = useState<'male' | 'female'>('male');

  // Diary state
  const [diaryStats, setDiaryStats] = useState<StrengthStats[]>([]);
  const [diaryProgress, setDiaryProgress] = useState<WeeklyProgress[]>([]);
  const [logExercise, setLogExercise] = useState('');
  const [logWeight, setLogWeight] = useState(80);
  const [logReps, setLogReps] = useState(8);
  const [logRIR, setLogRIR] = useState(2);

  // Runtime (live workout) state
  const [runtimeDay, setRuntimeDay] = useState<number>(1);
  const [runtimeExIdx, setRuntimeExIdx] = useState(0);
  const [runtimeLogs, setRuntimeLogs] = useState<Record<string, { sets: { weight: number; reps: number; rpe: number; rir: number }[]; completed: boolean }>>({});
  const [runtimeStarted, setRuntimeStarted] = useState(false);
  const [showWarmup, setShowWarmup] = useState(false);
  const [showCooldown, setShowCooldown] = useState(false);
  const [runtimeSetW, setRuntimeSetW] = useState(80);
  const [runtimeSetR, setRuntimeSetR] = useState(8);
  const [runtimeSetRP, setRuntimeSetRP] = useState(7);
  const [runtimeSetRI, setRuntimeSetRI] = useState(2);

  const generatePlan = useCallback(() => {
    const input: TrainingInput = {
      goal, level, daysPerWeek, recovery, fatigue, nutrition: 7,
      weakPoints, sessionDuration: 60, exercises: [],
    };
    const output = calcTraining(input);
    setTrainingOutput(output);

    const macroInput: MacrocycleInput = {
      goal: goal as MacrocycleInput['goal'],
      level: level as MacrocycleInput['level'],
      daysPerWeek,
      readinessScore: recovery / 10,
      isOnCourse: level === 'enhanced',
      weakPoints,
      injuries: [],
      experience: level as MacrocycleInput['experience'],
      currentWeek: 1,
    };
    const macro = generateMacrocycle(macroInput);
    setMacrocycle(macro);
    setSelectedWeek(1);
    setCurrentMicrocycle(getCurrentWeekPlan(macro, 1));
  }, [goal, level, daysPerWeek, recovery, fatigue, weakPoints]);

  // Auto-regenerate when days/sparse
  const prevDays = useRef(daysPerWeek);
  useEffect(() => {
    if (prevDays.current !== daysPerWeek) {
      prevDays.current = daysPerWeek;
      generatePlan();
    }
  }, [daysPerWeek]);

  useEffect(() => {
    if (macrocycle && selectedWeek > 0) {
      setCurrentMicrocycle(getCurrentWeekPlan(macrocycle, selectedWeek));
    }
  }, [macrocycle, selectedWeek]);

  useEffect(() => {
    (async () => {
      try {
        const progress = await diary.getWeeklyProgress();
        setDiaryProgress(progress);
        // Load stats for top compounds
        const compoundIds = EXERCISE_CATALOG.filter(e => e.type === 'compound').slice(0, 10).map(e => e.id);
        const stats: StrengthStats[] = [];
        for (const id of compoundIds) {
          const s = await diary.getExerciseStats(id);
          if (s) stats.push(s);
        }
        setDiaryStats(stats);
      } catch {}
    })();
  }, []);

  const filteredExercises = useMemo(() => {
    let list = EXERCISE_CATALOG;
    if (exSearch) {
      const q = exSearch.toLowerCase();
      list = list.filter(e => e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q) || (e.targetMuscle || '').toLowerCase().includes(q));
    }
    if (exGroup !== 'all') list = list.filter(e => e.group === exGroup);
    if (exType !== 'all') list = list.filter(e => e.type === exType);
    if (exEquipment !== 'all') list = list.filter(e => e.equipment === exEquipment);
    return list;
  }, [exSearch, exGroup, exType, exEquipment]);

  const calcResults = useMemo(() => {
    const epley1RM = calcWeight * (1 + calcReps / 30);
    const brzycki1RM = calcWeight * (36 / (37 - calcReps));
    const rpePercent = Math.max(0.3, 1 - (calcRPE - 1) * 0.03 - (calcReps - 1) * 0.025);
    const rpe1RM = calcWeight / rpePercent;
    const percentWeight = calc1RM * (calcPercent / 100);
    return { epley1RM, brzycki1RM, rpe1RM, percentWeight, rpePercent };
  }, [calcWeight, calcReps, calcRPE, calc1RM, calcPercent]);

  const handleLogWorkout = async () => {
    if (!logExercise) return;
    const ex = EXERCISE_CATALOG.find(e => e.id === logExercise);
    await diary.saveStrengthLog({
      id: `log_${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      exerciseId: logExercise,
      exerciseName: ex?.name || logExercise,
      sets: [{ weight: logWeight, reps: logReps, rir: logRIR }],
      totalVolume: logWeight * logReps,
      estimated1RM: logWeight * (1 + logReps / 30),
      isCompound: ex?.type === 'compound',
      weekNumber: selectedWeek,
    });
    // Reload stats
    const compoundIds = EXERCISE_CATALOG.filter(e => e.type === 'compound').slice(0, 10).map(e => e.id);
    const stats: StrengthStats[] = [];
    for (const id of compoundIds) {
      const s = await diary.getExerciseStats(id);
      if (s) stats.push(s);
    }
    setDiaryStats(stats);
    setLogExercise('');
    setLogWeight(80);
    setLogReps(8);
    setLogRIR(2);
  };

  const getRIRstr = (g: string, l: string, deload: boolean): string => {
    if (deload) return '3-5';
    try {
      const rir = RIR_MATRIX[g]?.[l]?.base ?? 2;
      return `${rir}-${rir + 2}`;
    } catch { return '2-3'; }
  };

  const formatSplitGroups = (output: TrainingOutput) => {
    if (!output.volumePerGroup) return '';
    return Object.entries(output.volumePerGroup)
      .filter(([_, v]) => v > 0)
      .map(([g, v]) => `${GROUP_LABELS[g] || g}: ${v} подх`)
      .join(' • ');
  };

  return (
    <div className="screen training-screen" style={{ padding: '0 4px' }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 16, color: 'var(--accent)' }}>🏋️ Тренировки</h2>

      <div style={{ display: 'flex', gap: 3, marginBottom: 10, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {([
          ['plan', '📋 План'], ['runtime', '🏃 Тренировка'], ['exercises', '📖 Упражнения'],
          ['calculators', '📐 Калькуляторы'], ['diary', '📓 Дневник'], ['cycles', '🔄 Циклы'],
        ] as [TrainingTab, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
            background: tab === k ? 'var(--accent)' : 'var(--bg-secondary)',
            color: tab === k ? '#000' : 'var(--text-dim)', border: 'none', cursor: 'pointer',
          }}>{l}</button>
        ))}
      </div>

      {/* ═══════════ PLAN TAB ═══════════ */}
      {tab === 'plan' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="card" style={{ padding: '10px 12px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>⚙️ Параметры плана</h3>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {GOALS.map(g => (
                <button key={g.value} onClick={() => setGoal(g.value)} style={{
                  padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: goal === g.value ? 700 : 400,
                  cursor: 'pointer', border: goal === g.value ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: goal === g.value ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)', color: 'var(--text)',
                }}>{g.icon} {g.label}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {LEVELS.map(l => (
                <button key={l.value} onClick={() => setLevel(l.value)} style={{
                  padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: level === l.value ? 700 : 400,
                  cursor: 'pointer', border: level === l.value ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: level === l.value ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)', color: 'var(--text)',
                }}>{l.icon} {l.label}</button>
              ))}
            </div>
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 3, display: 'block' }}>Тип сплита</label>
              <button onClick={() => { setShowSplitPicker(!showSplitPicker); if (!splitCandidates.length) { const opts = getSplitOptions({ goal, level, daysPerWeek } as any); setSplitCandidates(opts.slice(0, 12)); } }} style={{
                width: '100%', padding: '6px 10px', borderRadius: 8, textAlign: 'left', cursor: 'pointer',
                background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span>{splitType === 'auto' ? '🤖 Авто-выбор' : splitCandidates.find(c => c.id === splitType)?.name || splitType}</span>
                <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>{showSplitPicker ? '▴' : '▾'}</span>
              </button>
              {showSplitPicker && (
                <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 220, overflowY: 'auto', background: 'var(--bg-secondary)', borderRadius: 8, padding: '4px 6px', border: '1px solid var(--border)' }}>
                  <div key="auto" onClick={() => { setSplitType('auto'); setShowSplitPicker(false); }} style={{
                    padding: '5px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 11,
                    background: splitType === 'auto' ? 'rgba(0,230,138,0.1)' : 'transparent',
                    border: splitType === 'auto' ? '1px solid var(--accent)' : '1px solid transparent',
                  }}>
                    <div style={{ fontWeight: 600 }}>🤖 Авто-выбор</div>
                    <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Движок сам подберёт оптимальный сплит</div>
                  </div>
                  {splitCandidates.map(c => (
                    <div key={c.id || c.name} onClick={() => { setSplitType(c.id || c.name); setShowSplitPicker(false); }} style={{
                      padding: '5px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 11,
                      background: splitType === (c.id || c.name) ? 'rgba(0,230,138,0.1)' : 'transparent',
                      border: splitType === (c.id || c.name) ? '1px solid var(--accent)' : '1px solid transparent',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600 }}>{c.name}</span>
                        <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: 'rgba(0,230,138,0.1)', color: '#00e68a', fontWeight: 600 }}>{(c.score * 100).toFixed(0)}%</span>
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>{c.desc?.slice(0, 80)}{c.desc && c.desc.length > 80 ? '...' : ''}</div>
                      {c.rationale && <div style={{ fontSize: 8, color: 'var(--accent)', marginTop: 1 }}>{c.rationale.slice(0, 60)}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2, display: 'block' }}>Тип цикла</label>
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {[
                  { v: 'auto', l: 'Авто' }, { v: 'pl_strength', l: 'PL Сила' }, { v: 'pl_peaking', l: 'PL Пик' },
                  { v: 'bb_mass', l: 'BB Масса' }, { v: 'bb_specialization', l: 'BB Спец' },
                  { v: 'rehab', l: 'Рехаб' }, { v: 'wl_tech', l: 'WL Техника' },
                ].map(c => (
                  <button key={c.v} onClick={() => { setCycleType(c.v); setTimeout(generatePlan, 50); }} style={{
                    padding: '3px 7px', borderRadius: 6, fontSize: 9, fontWeight: cycleType === c.v ? 700 : 400, cursor: 'pointer',
                    border: cycleType === c.v ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: cycleType === c.v ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)', color: 'var(--text)',
                  }}>{c.l}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2, display: 'block' }}>Длина цикла</label>
              <div style={{ display: 'flex', gap: 3 }}>
                {[4, 8, 12].map(w => (
                  <button key={w} onClick={() => setMesoLength(w)} style={{
                    padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: mesoLength === w ? 700 : 400, cursor: 'pointer',
                    border: mesoLength === w ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: mesoLength === w ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)', color: 'var(--text)',
                  }}>{w} нед</button>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Дней/нед</label>
                <input type="range" min={2} max={7} value={daysPerWeek} onChange={e => { setDaysPerWeek(+e.target.value); setTimeout(generatePlan, 50); }}
                  style={{ width: '100%', accentColor: 'var(--accent)' }} />
                <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-dim)' }}>{daysPerWeek}</div>
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Восстановление</label>
                <input type="range" min={1} max={10} value={recovery} onChange={e => setRecovery(+e.target.value)}
                  style={{ width: '100%', accentColor: 'var(--accent)' }} />
                <div style={{ textAlign: 'center', fontSize: 10, color: recovery < 4 ? '#ef4444' : recovery < 6 ? '#ff9100' : '#22c55e' }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: recovery < 4 ? '#ef4444' : recovery < 6 ? '#ff9100' : '#22c55e', marginRight: 4 }} />
                  {recovery}/10 — {recovery < 4 ? 'Плохое' : recovery < 6 ? 'Среднее' : recovery < 8 ? 'Хорошее' : 'Отличное'}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Усталость</label>
                <input type="range" min={1} max={10} value={fatigue} onChange={e => setFatigue(+e.target.value)}
                  style={{ width: '100%', accentColor: 'var(--accent)' }} />
                <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-dim)' }}>{fatigue}/10</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Вес (кг)</label>
                <input type="number" value={bodyWeight} onChange={e => setBodyWeight(+e.target.value)}
                  style={{ width: '100%', padding: '5px 6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Сон (ч)</label>
                <input type="number" min={0} max={12} value={sleepHours} onChange={e => setSleepHours(+e.target.value)}
                  style={{ width: '100%', padding: '5px 6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Стресс (1-10)</label>
                <input type="number" min={1} max={10} value={stressLevel} onChange={e => setStressLevel(+e.target.value)}
                  style={{ width: '100%', padding: '5px 6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2, display: 'block' }}>Слабые зоны</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {MUSCLE_GROUPS.map(g => {
                  const active = weakPoints.includes(g);
                  return (
                    <button key={g} onClick={() => setWeakPoints(active ? weakPoints.filter(w => w !== g) : [...weakPoints, g])} style={{
                      padding: '3px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer',
                      border: active ? '1px solid #ff9100' : '1px solid var(--border)',
                      background: active ? 'rgba(255,145,0,0.15)' : 'var(--bg-secondary)',
                      color: active ? '#ff9100' : 'var(--text-dim)', fontWeight: active ? 600 : 400,
                    }}>{GROUP_LABELS[g]}</button>
                  );
                })}
              </div>
            </div>
            <button onClick={generatePlan} style={{
              width: '100%', padding: 10, borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #00e68a, #00c853)', color: '#000', fontWeight: 700, fontSize: 13,
            }}>▶ Сгенерировать план</button>
          </div>

          {trainingOutput && (
            <>
              {/* Smart Recommendations */}
              {(() => {
                const tips: { icon: string; text: string; color: string }[] = [];
                if (recovery < 5) tips.push({ icon: '⚠️', text: `Восстановление ${recovery}/10 — снизь объём на 15-20%, увеличь сон`, color: '#ef4444' });
                if (sleepHours < 7) tips.push({ icon: '😴', text: `Сон ${sleepHours}ч — добавь 30-60 мин для лучшего восстановления`, color: '#ff9100' });
                if (stressLevel > 7) tips.push({ icon: '🧘', text: `Стресс ${stressLevel}/10 — снизь интенсивность, добавь LISS`, color: '#ff9100' });
                if (currentMicrocycle?.mesocycleType === 'deload') tips.push({ icon: '🔄', text: 'Делоад: фокус на технику и мобильность, не гонись за весами', color: '#3b82f6' });
                else if (currentMicrocycle?.mesocycleType === 'peaking') tips.push({ icon: '🏆', text: 'Пик: работай с соревновательными движениями, RIR 0-1', color: '#ef4444' });
                else if (currentMicrocycle?.mesocycleType === 'accumulation') tips.push({ icon: '📈', text: 'Накопление: добавляй подсобку на слабые зоны, 8-12 повторений', color: '#22c55e' });
                if (weakPoints.length > 0) tips.push({ icon: '🎯', text: `Слабые зоны: ${weakPoints.map(w => GROUP_LABELS[w] || w).join(', ')} — добавь 1-2 подсобных`, color: '#8b5cf6' });
                if (recovery > 8 && fatigue < 3) tips.push({ icon: '✅', text: 'Отличная готовность — можно добавить 1 сет в основных движениях', color: '#22c55e' });
                if (tips.length === 0) tips.push({ icon: '💪', text: 'Всё в норме. Придерживайся плана и следи за RPE.', color: '#00e68a' });
                return (
                  <div className="card" style={{ padding: '10px 12px', border: '1px solid rgba(0,230,138,0.2)' }}>
                    <h4 style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--accent)' }}>💡 Рекомендации</h4>
                    {tips.map((t, i) => (
                      <div key={i} style={{ fontSize: 10, color: 'var(--text-dim)', padding: '2px 0', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                        <span>{t.icon}</span>
                        <span style={{ color: t.color }}>{t.text}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
              <div className="card" style={{ padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--accent)' }}>{trainingOutput.splitName}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 6 }}>RIR {getRIRstr(goal, level, trainingOutput.isDeload)}</span>
                  </div>
                  {trainingOutput.isDeload && (
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(255,145,0,0.15)', color: '#ff9100', fontWeight: 600 }}>РАЗГРУЗКА</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>{trainingOutput.splitDesc}</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{formatSplitGroups(trainingOutput)}</div>
              </div>

              <div className="card" style={{ padding: '8px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>Нед {selectedWeek}</span>
                  <input type="range" min={1} max={macrocycle?.totalWeeks || 12} value={selectedWeek}
                    onChange={e => setSelectedWeek(+e.target.value)}
                    style={{ flex: 1, accentColor: 'var(--accent)' }} />
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <button onClick={() => setShowWarmup(!showWarmup)} style={{
                    padding: '3px 8px', borderRadius: 4, fontSize: 9, cursor: 'pointer',
                    background: showWarmup ? 'rgba(255,145,0,0.15)' : 'var(--bg-secondary)',
                    border: showWarmup ? '1px solid #ff9100' : '1px solid var(--border)',
                    color: showWarmup ? '#ff9100' : 'var(--text-dim)',
                  }}>🔥 Разминка</button>
                  <button onClick={() => setShowCooldown(!showCooldown)} style={{
                    padding: '3px 8px', borderRadius: 4, fontSize: 9, cursor: 'pointer',
                    background: showCooldown ? 'rgba(59,130,246,0.15)' : 'var(--bg-secondary)',
                    border: showCooldown ? '1px solid #3b82f6' : '1px solid var(--border)',
                    color: showCooldown ? '#3b82f6' : 'var(--text-dim)',
                  }}>🧊 Заминка</button>
                </div>
              </div>

              {/* Warmup */}
              {showWarmup && currentMicrocycle && currentMicrocycle.days.length > 0 && (() => {
                const wuInput = {
                  sessionFocus: currentMicrocycle.days[0]?.split || 'fullbody',
                  primaryExercises: currentMicrocycle.days[0]?.exercises?.slice(0, 2).map((e: any) => e.name) || [],
                  riskFlags: {} as Record<string, string>,
                  techniqueIssues: [] as string[],
                  fatigueLevel: fatigue / 10,
                  equipmentAvailable: ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'],
                };
                const warmup = generateWarmup(wuInput);
                return (
                  <div className="card" style={{ padding: '8px 10px', border: '1px solid rgba(255,145,0,0.2)' }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: '#ff9100', marginBottom: 4 }}>🔥 Разминка</div>
                    {warmup.map((b, bi) => (
                      <div key={bi} style={{ fontSize: 10, marginBottom: 2, color: 'var(--text-dim)' }}>
                        <span style={{ fontWeight: 600, color: '#ff9100' }}>
                          {b.type === 'general' ? 'Кардио' : b.type === 'mobility' ? 'Мобильность' : b.type === 'activation' ? 'Активация' : 'Специфика'} ({b.durationSec}с)
                        </span>
                        {b.exercises?.map((ex, exi) => (
                          <span key={exi} style={{ marginLeft: 6, color: 'var(--text-dim)' }}>
                            {WARMUP_LABELS[ex.exerciseId] || ex.exerciseId.replace(/_/g, ' ')} {ex.sets ? `×${ex.sets}` : ''}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })()}

              {currentMicrocycle && (
                <div className="card" style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>
                      {currentMicrocycle.mesocycleType === 'accumulation' ? '📈 Накопление' :
                       currentMicrocycle.mesocycleType === 'intensification' ? '📊 Интенсификация' :
                       currentMicrocycle.mesocycleType === 'peaking' ? '🏆 Пик' :
                       currentMicrocycle.mesocycleType === 'deload' ? '🔄 Разгрузка' : '📋'} — Неделя {selectedWeek}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                      Объём ×{currentMicrocycle.volumeMultiplier} | RIR {currentMicrocycle.rirRange[0]}-{currentMicrocycle.rirRange[1]}
                      {currentMicrocycle.mesocycleType !== 'deload' && currentMicrocycle.mesocycleType !== 'peaking' && (
                        <span style={{ color: '#22c55e', fontWeight: 600, marginLeft: 6 }}>
                          ↑+{(currentMicrocycle.mesocycleType === 'accumulation' ? 2.5 : 3.75)}%/нед
                        </span>
                      )}
                      {currentMicrocycle.mesocycleType === 'deload' && (
                        <span style={{ color: '#3b82f6', fontWeight: 600, marginLeft: 6 }}>↓-50%</span>
                      )}
                    </span>
                      </div>
                      {/* Phase training tip */}
                      {currentMicrocycle && (
                        <div style={{ padding: '6px 8px', background: 'rgba(0,230,138,0.04)', borderRadius: 6, fontSize: 10, color: 'var(--accent)', marginBottom: 6, lineHeight: 1.4 }}>
                          {currentMicrocycle.mesocycleType === 'accumulation' ? '📈 Накопление: фокус на объём, технику и гипертрофию. 8-12 повторений, RIR 2-3. Добавь 1-2 подсобных на слабые зоны.' :
                           currentMicrocycle.mesocycleType === 'intensification' ? '📊 Интенсификация: рост рабочих весов, снижение объёма. 4-8 повторений, RIR 1-2, RPE 8-9. Приоритет — базовые движения.' :
                           currentMicrocycle.mesocycleType === 'peaking' ? '🏆 Пик: максимальные веса, минимальный объём. 1-3 повторения, RIR 0-1. Только специфичные соревновательные движения.' :
                           currentMicrocycle.mesocycleType === 'deload' ? '🔄 Разгрузка: восстановление ЦНС и суставов. 50% объёма, лёгкие веса, RIR 3-5. Акцент на мобильность и технику.' : ''}
                        </div>
                      )}
                      {currentMicrocycle.days.filter((d: any) => d.isTraining).map((day: any, di: number) => {
                    const dayExCount = day.exercises?.length || 0;
                    const dayCompounds = day.exercises?.filter((e: any) => e.isCompound).length || 0;
                    const difficultyScore = Math.min(10, Math.round((dayCompounds * 2 + dayExCount) * (day.intensity === 'very_high' ? 1.4 : day.intensity === 'high' ? 1.2 : 1)));
                    const diffLabel = difficultyScore <= 3 ? 'Легко' : difficultyScore <= 5 ? 'Средне' : difficultyScore <= 7 ? 'Тяжело' : 'Экстрим';
                    const diffColor = difficultyScore <= 3 ? '#22c55e' : difficultyScore <= 5 ? '#84cc16' : difficultyScore <= 7 ? '#ff9100' : '#ef4444';
                    const adjRecovery = recovery / 10;
                    const autoRegNote = adjRecovery < 0.4 ? '⚠ Снизить объём на 20% — низкое восстановление' :
                                       adjRecovery < 0.6 ? '⚡ Умеренная нагрузка — следи за RPE' :
                                       adjRecovery > 0.8 ? '✅ Высокая готовность — можно добавить подход' : '';
                    return (
                    <div key={di} style={{ marginBottom: 6, background: 'var(--bg-secondary)', borderRadius: 6, padding: '6px 8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: 11 }}>{day.day}</span>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {(() => {
                            const hasSquat = day.exercises?.some((e: any) => e.exerciseId?.includes('squat') || e.name?.includes('Присед'));
                            const hasBench = day.exercises?.some((e: any) => e.exerciseId?.includes('bench') || e.name?.includes('Жим'));
                            const hasDead = day.exercises?.some((e: any) => e.exerciseId?.includes('deadlift') || e.name?.includes('Тяг'));
                            const focusTag = hasSquat ? '🦵 Присед' : hasBench ? '🏋️ Жим' : hasDead ? '🔙 Тяга' : '';
                            return focusTag ? <span style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 600 }}>{focusTag}</span> : null;
                          })()}
                          <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: `${diffColor}22`, color: diffColor, fontWeight: 600 }}>{diffLabel} {difficultyScore}/10</span>
                          <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{day.duration} мин</span>
                        </div>
                      </div>
                      {autoRegNote && (
                        <div style={{ fontSize: 9, color: adjRecovery < 0.4 ? '#ef4444' : adjRecovery < 0.6 ? '#ff9100' : '#22c55e', marginBottom: 3, background: `${adjRecovery < 0.4 ? '#ef4444' : adjRecovery < 0.6 ? '#ff9100' : '#22c55e'}11`, padding: '2px 6px', borderRadius: 3 }}>
                          {autoRegNote}
                        </div>
                      )}
                      <div style={{ fontSize: 8, color: 'var(--text-dim)', marginBottom: 3, padding: '1px 4px', background: 'rgba(255,165,2,0.05)', borderRadius: 3 }}>
                        🍎 {goal === 'bulk' ? 'До: бел.+угл. После: быстрый протеин' : goal === 'cut' ? 'До: белок. Углеводы только вокруг' : goal === 'strength' ? 'До: кофеин+угл. После: протеин+креатин' : 'До/после: белок+углеводы'}
                      </div>
                      {day.exercises.map((ex: any, ei: number) => {
                        const scheme = selectSetScheme({
                          goal, movementPattern: 'squat' as MovementPattern, difficultyLevel: level === 'beginner' ? 'low' : level === 'intermediate' ? 'medium' : 'high',
                          techniqueIssues: [], riskFlags: {}, fatigueScore: fatigue / 10, repPattern: 'normal', isPrimaryLift: ei === 0,
                        });
                        const tempo = selectTempo(goal, [], {}, ex.isCompound);
                        const exCat = EXERCISE_CATALOG.find(ec => ec.id === ex.exerciseId || ec.name === ex.name);
                        const estMax = ex.weight ? Math.round(ex.weight * (1 + Number(ex.reps) / 30)) : 0;
                        const substitute = exCat?.canReplace?.[0] ? EXERCISE_CATALOG.find(e => e.id === exCat.canReplace![0]) : null;
                        const role = ei === 0 ? 'main' : ei <= 2 ? 'secondary' : 'accessory';
                        const roleColor = role === 'main' ? '#ef4444' : role === 'secondary' ? '#f97316' : '#6b7280';
                        const roleLabel = role === 'main' ? 'ОСН' : role === 'secondary' ? 'ПОДС' : 'АКС';
                        const restSec = ei === 0 ? (goal === 'strength' ? 180 : 120) : ei <= 2 ? 90 : 60;
                        return (
                        <div key={ei} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0', fontSize: 10, borderBottom: ei < day.exercises.length - 1 ? '1px solid var(--border)' : 'none', gap: 2 }}>
                          <span style={{ fontSize: 7, padding: '1px 3px', borderRadius: 2, background: `${roleColor}22`, color: roleColor, fontWeight: 700, minWidth: 22, textAlign: 'center', flexShrink: 0 }}>{roleLabel}</span>
                          <span style={{ flex: 1 }} title={ex.technique || ''}>{ex.name}</span>
                          <span style={{ color: 'var(--accent)', fontWeight: 600, minWidth: 55, textAlign: 'right' }}>{ex.sets}×{ex.reps}</span>
                          {estMax > 0 && <span style={{ fontSize: 8, color: '#8b5cf6', minWidth: 40, textAlign: 'right' }}>~{estMax}кг</span>}
                          <span style={{ fontSize: 8, color: 'var(--text-dim)', minWidth: 25, textAlign: 'right' }}>RIR{ex.rir}</span>
                          <span style={{ fontSize: 6, padding: '1px 2px', borderRadius: 2, background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', whiteSpace: 'nowrap' }}>{scheme?.schemeType?.slice(0, 6) || '—'}</span>
                          <span style={{ fontSize: 6, padding: '1px 2px', borderRadius: 2, background: 'rgba(249,115,22,0.1)', color: '#f97316', whiteSpace: 'nowrap' }}>⏱{restSec}с</span>
                          {substitute && <span style={{ fontSize: 6, color: 'var(--text-dim)', maxWidth: 50, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`Заменить: ${substitute.name}`}>↔{substitute.name.slice(0, 8)}</span>}
                        </div>
                        );
                      })}
                      {/* Rotation suggestion for main lifts */}
                      {day.exercises?.filter((e: any) => e.isCompound).slice(0, 2).map((ex: any, ei: number) => {
                        const cat = EXERCISE_CATALOG.find(ec => ec.id === ex.exerciseId || ec.name === ex.name);
                        const alts = cat?.canReplace?.filter(r => !day.exercises.some((de: any) => de.exerciseId === r || de.name === r)).slice(0, 2) || [];
                        if (alts.length === 0) return null;
                        return (
                          <div key={`rot-${ei}`} style={{ fontSize: 8, color: 'var(--text-dim)', padding: '1px 0', marginLeft: 26, marginBottom: 1 }}>
                            <span style={{ color: '#8b5cf6' }}>🔄 {ex.name.slice(0, 12)} → </span>
                            {alts.map((a: string, ai: number) => {
                              const altEx = EXERCISE_CATALOG.find(e => e.id === a);
                              return <span key={ai}>{altEx?.name || a}{ai < alts.length - 1 ? ', ' : ''}</span>;
                            })}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
                  <div style={{ marginTop: 4, padding: '4px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 4, fontSize: 9, color: 'var(--text-dim)' }}>
                      <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                        {currentMicrocycle.mesocycleType === 'accumulation' ? '📈 Фаза накопления: высокий объём, умеренная интенсивность. Фокус на гипертрофию и технику.' :
                         currentMicrocycle.mesocycleType === 'intensification' ? '📊 Фаза интенсификации: снижение объёма, рост весов. RIR 1-2, RPE 8-9.' :
                         currentMicrocycle.mesocycleType === 'peaking' ? '🏆 Пиковая фаза: минимальный объём, максимальные веса. Подготовка к проходке.' :
                         currentMicrocycle.mesocycleType === 'deload' ? '🔄 Разгрузка: 50% объёма, RIR 3-5. Восстановление ЦНС и суставов.' : ''}
                      </span>
                    </div>
                </div>
              )}

              {/* Quick week summary */}
              {currentMicrocycle && (
                <div className="card" style={{ padding: '8px 10px' }}>
                  <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--accent)', marginBottom: 4 }}>📋 Сводка недели {selectedWeek}</div>
                  {(() => {
                    const days = currentMicrocycle.days.filter((d: any) => d.isTraining);
                    const totalSets = days.reduce((s: number, d: any) => s + (d.exercises?.reduce((ss: number, e: any) => ss + (e.sets || 0), 0) || 0), 0);
                    const totalReps = days.reduce((s: number, d: any) => s + (d.exercises?.reduce((ss: number, e: any) => ss + (parseInt(String(e.reps)) || 0) * (e.sets || 0), 0) || 0), 0);
                    const totalTonnage = days.reduce((s: number, d: any) => s + (d.exercises?.reduce((ss: number, e: any) => ss + (e.sets || 0) * (parseInt(String(e.reps)) || 0) * (e.weight || 0), 0) || 0), 0);
                    const totalMin = days.reduce((s: number, d: any) => s + (d.duration || 0), 0);
                    const density = totalMin > 0 ? Math.round(totalTonnage / totalMin) : 0;
                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 4, fontSize: 10 }}>
                        <div style={{ textAlign: 'center', padding: '4px', background: 'rgba(0,230,138,0.05)', borderRadius: 4 }}>
                          <div style={{ color: 'var(--text-dim)' }}>Дней</div>
                          <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{days.length}</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '4px', background: 'rgba(0,230,138,0.05)', borderRadius: 4 }}>
                          <div style={{ color: 'var(--text-dim)' }}>Подходов</div>
                          <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{totalSets}</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '4px', background: 'rgba(0,230,138,0.05)', borderRadius: 4 }}>
                          <div style={{ color: 'var(--text-dim)' }}>Повторов</div>
                          <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{totalReps}</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '4px', background: 'rgba(0,230,138,0.05)', borderRadius: 4 }}>
                          <div style={{ color: 'var(--text-dim)' }}>Тоннаж</div>
                          <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{totalTonnage > 0 ? `${(totalTonnage / 1000).toFixed(1)}т` : '—'}</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '4px', background: 'rgba(0,230,138,0.05)', borderRadius: 4 }}>
                          <div style={{ color: 'var(--text-dim)' }}>Плотность</div>
                          <div style={{ fontWeight: 700, color: density > 50 ? '#22c55e' : density > 25 ? '#ff9100' : '#ef4444' }}>{density} кг/мин</div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Weekly training calendar (TZ) */}
              {currentMicrocycle && (
                <div className="card" style={{ padding: '10px 12px', marginTop: 8 }}>
                  <h4 style={{ margin: '0 0 6px', fontSize: 12 }}>📅 Календарь недели</h4>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((dayName, di) => {
                      const day = currentMicrocycle.days.find((d: any) => d.isTraining && d.day?.includes(dayName));
                      const isTraining = !!day;
                      return (
                        <div key={di} style={{
                          flex: 1, textAlign: 'center', padding: '4px 2px', borderRadius: 6, fontSize: 9,
                          background: isTraining ? 'rgba(0,230,138,0.1)' : 'rgba(255,255,255,0.02)',
                          border: isTraining ? '1px solid rgba(0,230,138,0.2)' : '1px solid var(--border)',
                          color: isTraining ? 'var(--accent)' : 'var(--text-dim)',
                          fontWeight: isTraining ? 600 : 400,
                        }}>
                          <div>{dayName}</div>
                          {isTraining && <div style={{ fontSize: 7, marginTop: 1 }}>{day?.exercises?.length || 0} упр</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Cooldown */}
              {showCooldown && currentMicrocycle && currentMicrocycle.days.length > 0 && (() => {
                const cdInput = {
                  muscleGroupsUsed: currentMicrocycle.days[0]?.exercises?.map((e: any) => e.group).filter(Boolean) || [],
                  fatigueScore: fatigue / 10,
                  riskFlags: {} as Record<string, string>,
                  sessionDuration: currentMicrocycle.days[0]?.duration || 60,
                };
                const cooldown = generateCooldown(cdInput);
                return (
                  <div className="card" style={{ padding: '8px 10px', border: '1px solid rgba(59,130,246,0.2)' }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: '#3b82f6', marginBottom: 4 }}>🧊 Заминка</div>
                    {cooldown.map((b, bi) => (
                      <div key={bi} style={{ fontSize: 10, marginBottom: 2, color: 'var(--text-dim)' }}>
                        <span style={{ fontWeight: 600, color: '#3b82f6' }}>
                          {b.type === 'breathing' ? 'Дыхание' : b.type === 'stretch' ? 'Растяжка' : 'Мобильность'} ({b.durationSec}с)
                        </span>
                        {b.exercises?.map((ex, exi) => (
                          <span key={exi} style={{ marginLeft: 6, color: 'var(--text-dim)' }}>
                            {WARMUP_LABELS[ex.exerciseId] || ex.exerciseId.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })(              )}

              {/* Custom added exercises */}
              {customExercises.length > 0 && (
                <div className="card" style={{ padding: '8px 10px', border: '1px dashed rgba(139,92,246,0.3)' }}>
                  <div style={{ fontWeight: 600, fontSize: 11, color: '#8b5cf6', marginBottom: 4 }}>📝 Добавленные ({customExercises.length})</div>
                  {customExercises.map((ce, ci) => (
                    <div key={ci} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, padding: '2px 0', borderBottom: ci < customExercises.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <span>{ce.name}</span>
                      <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{ce.sets}×{ce.reps}</span>
                      <span style={{ color: 'var(--text-dim)', fontSize: 9 }}>RIR {ce.rir}</span>
                      <button onClick={() => setCustomExercises(customExercises.filter((_, i) => i !== ci))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12, padding: 0 }}>×</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Intensity zone distribution (TZ) */}
              {currentMicrocycle?.days && (
                <div className="card" style={{ padding: '8px 10px', marginTop: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--accent)', marginBottom: 4 }}>📊 Зоны интенсивности</div>
                  {(() => {
                    const reps = currentMicrocycle.days.filter((d: any) => d.isTraining)
                      .flatMap((d: any) => d.exercises?.map((e: any) => parseInt(String(e.reps)) || 8) || []) || [];
                    const str = reps.filter(r => r >= 1 && r <= 6).length;
                    const hyp = reps.filter(r => r >= 7 && r <= 12).length;
                    const end = reps.filter(r => r >= 13).length;
                    const total = reps.length || 1;
                    return (
                      <div>
                        <div style={{ display: 'flex', gap: 2, height: 18, borderRadius: 6, overflow: 'hidden', marginBottom: 4 }}>
                          <div style={{ flex: str || 0.1, background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#fff', fontWeight: 600, minWidth: str > 0 ? 20 : 0 }}>
                            {str > 0 ? `${Math.round((str/total)*100)}%` : ''}
                          </div>
                          <div style={{ flex: hyp || 0.1, background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#fff', fontWeight: 600, minWidth: hyp > 0 ? 20 : 0 }}>
                            {hyp > 0 ? `${Math.round((hyp/total)*100)}%` : ''}
                          </div>
                          <div style={{ flex: end || 0.1, background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#fff', fontWeight: 600, minWidth: end > 0 ? 20 : 0 }}>
                            {end > 0 ? `${Math.round((end/total)*100)}%` : ''}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, fontSize: 9, color: 'var(--text-dim)' }}>
                          <span>🔴 Сила ({str})</span><span>🟢 Гипертрофия ({hyp})</span><span>🔵 Выносливость ({end})</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Workout nutrition tips */}
              <div className="card" style={{ padding: '8px 10px', border: '1px solid rgba(255,165,2,0.2)', marginTop: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 11, color: '#ffa502', marginBottom: 4 }}>🍎 Питание вокруг тренировки</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                  {goal === 'bulk' ? 'До: белки + углеводы за 2ч. После: быстрый белок + углеводы в течение 30 мин.' :
                   goal === 'cut' ? 'До: белки за 2ч. После: белок + овощи. Углеводы только вокруг тренировки.' :
                   goal === 'strength' ? 'До: кофеин + углеводы за 1ч. После: белок + креатин.' :
                   'До: лёгкий перекус за 1-2ч. После: белок + углеводы в течение 1ч.'}
                </div>
              </div>

              {/* Strength balance (TZ 38) */}
              {trainingOutput.volumePerGroup && (() => {
                const groups = trainingOutput.volumePerGroup as Record<string, number>;
                const pushVol = (groups.chest || 0) + (groups.shoulders || 0);
                const pullVol = (groups.back || 0);
                const quadVol = groups.legs || 0;
                const ratio = pullVol > 0 ? (pushVol / pullVol).toFixed(1) : '—';
                const balanced = parseFloat(ratio as string) >= 0.8 && parseFloat(ratio as string) <= 1.2;
                return (
                  <div className="card" style={{ padding: '8px 10px', border: '1px solid rgba(139,92,246,0.2)' }}>
                    <div style={{ fontWeight: 600, fontSize: 11, color: '#8b5cf6', marginBottom: 4 }}>⚖️ Баланс нагрузки</div>
                    <div style={{ display: 'flex', gap: 8, fontSize: 10, color: 'var(--text-dim)' }}>
                      <span>Push/Pull: <b style={{ color: balanced ? '#22c55e' : '#ff9100' }}>{ratio}</b> {balanced ? '✓' : '⚠'}</span>
                      <span>Ноги/Верх: <b>{(quadVol / Math.max(1, pushVol + pullVol)).toFixed(1)}</b></span>
                    </div>
                  </div>
                );
              })(                  )}

              {/* Overtraining risk assessment */}
              {currentMicrocycle && (() => {
                const acRatio = currentMicrocycle.volumeMultiplier * 100 / 85;
                const riskScore = (acRatio > 120 ? 3 : acRatio > 100 ? 1 : 0) + (sleepHours < 6 ? 2 : sleepHours < 7 ? 1 : 0) + (stressLevel > 7 ? 2 : stressLevel > 5 ? 1 : 0);
                const riskLabel = riskScore >= 5 ? '🚨 Высокий риск перетренированности' : riskScore >= 3 ? '⚠️ Умеренный риск' : riskScore >= 1 ? '⚡ Повышенная нагрузка' : '';
                if (!riskLabel) return null;
                return (
                  <div className="card" style={{ padding: '6px 10px', border: `1px solid ${riskScore >= 5 ? 'rgba(239,68,68,0.3)' : 'rgba(255,145,0,0.3)'}`, background: riskScore >= 5 ? 'rgba(239,68,68,0.05)' : 'rgba(255,145,0,0.05)' }}>
                    <div style={{ fontSize: 10, color: riskScore >= 5 ? '#ef4444' : '#ff9100', fontWeight: 600 }}>
                      {riskLabel} — {riskScore >= 5 ? 'Снизь нагрузку на 25-30% и увеличь сон' : riskScore >= 3 ? 'Контролируй RPE, спи 7+ часов' : 'Следи за восстановлением'}
                    </div>
                  </div>
                );
              })()}

              {trainingOutput.volumePerGroup && (
                <div className="card" style={{ padding: '10px 12px' }}>
                  <h4 style={{ margin: '0 0 6px', fontSize: 12 }}>📊 Объём по группам</h4>
                  {Object.entries(trainingOutput.volumePerGroup).map(([g, v]) => (
                    <div key={g} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, minWidth: 50 }}>{GROUP_LABELS[g] || g}</span>
                      <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 3, height: 6, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, v / 2)}%`, height: '100%', background: 'var(--accent)', borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--text-dim)', minWidth: 40, textAlign: 'right' }}>{v} подх</span>
                    </div>
                  ))}
                  {trainingOutput.estimatedProgress !== undefined && (
                    <div style={{ marginTop: 6, padding: '6px 8px', background: 'rgba(0,230,138,0.05)', borderRadius: 6, fontSize: 10 }}>
                      <span style={{ color: 'var(--accent)', fontWeight: 600 }}>📈 Ожидаемый прогресс: +{trainingOutput.estimatedProgress}%/нед</span>
                      <span style={{ color: 'var(--text-dim)', marginLeft: 8 }}>
                        Модель: {goal} × {level}
                      </span>
                    </div>
                  )}
                  {/* Workload ratio + Monotony/Strain (TZ 71-72) */}
                  {currentMicrocycle && (
                    <div style={{ marginTop: 4, padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 4, fontSize: 9 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-dim)' }}>🔬 Нагрузка: </span>
                      <span style={{ color: 'var(--accent)' }}>Острая: {Math.round(currentMicrocycle.volumeMultiplier * bodyWeight * daysPerWeek)} кг/нед</span>
                      <span style={{ color: 'var(--text-dim)', marginLeft: 4 }}>
                        Хрон.: {Math.round(currentMicrocycle.volumeMultiplier * bodyWeight * daysPerWeek * 0.85)} кг/нед
                      </span>
                      <span style={{ marginLeft: 4, color: currentMicrocycle.volumeMultiplier > 1.2 ? '#ef4444' : currentMicrocycle.mesocycleType === 'deload' ? '#22c55e' : '#ff9100' }}>
                        A/C: {(currentMicrocycle.volumeMultiplier * 100 / 85).toFixed(0)}%
                      </span>
                      {currentMicrocycle.volumeMultiplier > 1.3 && (
                        <span style={{ marginLeft: 4, color: '#ef4444', fontWeight: 600 }}>⚠ Высокий риск перегрузки</span>
                      )}
                      <span style={{ marginLeft: 4, color: sleepHours < 6 ? '#ef4444' : sleepHours < 7 ? '#ff9100' : '#22c55e' }}>
                        Сон: {sleepHours}ч | Стресс: {stressLevel}/10
                      </span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ═══════════ RUNTIME (Live Workout) ═══════════ */}
      {tab === 'runtime' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!runtimeStarted ? (
            <div className="card" style={{ padding: '12px' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>🏃 Начать тренировку</h3>
              <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 10px' }}>
                Выберите день из плана для отслеживания подходов в реальном времени.
              </p>
              {macrocycle && currentMicrocycle ? (
                <>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
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
                Интенсивность: {currentMicrocycle.days.filter((d: any) => d.isTraining)[runtimeDay]?.intensity || 'средняя'} | Схема: {(currentMicrocycle as any).mesocycleType || 'накопление'}
              </div>
              <div style={{ fontSize: 10, color: 'var(--accent)', marginTop: 2, fontWeight: 600 }}>
                Расчётный тоннаж: {currentMicrocycle.days.filter((d: any) => d.isTraining)[runtimeDay]?.exercises?.reduce((sum: number, ex: any) => sum + (ex.sets || 0) * (Number(ex.reps) || 0) * (ex.weight || 0), 0) || 0} кг
              </div>
            </div>
                  <button onClick={() => { setRuntimeStarted(true); setRuntimeLogs({}); setRuntimeExIdx(0); }} style={{
                    width: '100%', padding: 12, borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: 'linear-gradient(135deg, #00e68a, #00c853)', color: '#000', fontWeight: 700, fontSize: 14,
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
                      <button onClick={() => setRuntimeStarted(false)} style={{
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
                        <span style={{ fontSize: 9, padding: '2px 5px', borderRadius: 3, background: 'rgba(139,92,246,0.1)', color: '#8b5cf6' }}>{scheme?.schemeType || 'straight'}</span>
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
                      </div>
                    )}

                    {/* Set input form (if not completed) */}
                    {!log.completed && (
                      <div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 6 }}>
                          <div>
                            <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Вес (кг)</label>
                            <input type="number" value={runtimeSetW} onChange={e => setRuntimeSetW(+e.target.value)}
                              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Повторения</label>
                            <input type="number" value={runtimeSetR} onChange={e => setRuntimeSetR(+e.target.value)}
                              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>RPE (1-10)</label>
                            <input type="number" min={1} max={10} value={runtimeSetRP} onChange={e => setRuntimeSetRP(+e.target.value)}
                              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>RIR</label>
                            <input type="number" min={0} max={5} value={runtimeSetRI} onChange={e => setRuntimeSetRI(+e.target.value)}
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
      )}

      {/* ═══════════ EXERCISES TAB ═══════════ */}
      {tab === 'exercises' && (
        <div style={{ display: 'flex', gap: 8, flexDirection: selectedEx ? 'row' : 'column', flexWrap: 'wrap' }}>
          <div style={{ flex: selectedEx ? '0 0 280px' : 1, maxHeight: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column' }}>
            <input type="text" value={exSearch} onChange={e => setExSearch(e.target.value)}
              placeholder="🔍 Поиск..."
              style={{ width: '100%', padding: '7px 10px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, marginBottom: 4, boxSizing: 'border-box', flexShrink: 0 }} />
            <div style={{ display: 'flex', gap: 3, marginBottom: 4, flexShrink: 0 }}>
              <select value={exGroup} onChange={e => setExGroup(e.target.value)} style={{ flex: 1, padding: '4px 4px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 10 }}>
                <option value="all">Все группы</option>
                {MUSCLE_GROUPS.map(g => <option key={g} value={g}>{GROUP_LABELS[g]}</option>)}
              </select>
              <select value={exType} onChange={e => setExType(e.target.value)} style={{ flex: 1, padding: '4px 4px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 10 }}>
                <option value="all">Все типы</option>
                <option value="compound">Базовые</option>
                <option value="isolation">Изолирующие</option>
              </select>
              <select value={exEquipment} onChange={e => setExEquipment(e.target.value)} style={{ flex: 1, padding: '4px 4px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 10 }}>
                <option value="all">Оборуд.</option>
                <option value="barbell">Штанга</option>
                <option value="dumbbell">Гантели</option>
                <option value="machine">Тренажёр</option>
                <option value="cable">Блок</option>
                <option value="bodyweight">Вес тела</option>
              </select>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {filteredExercises.slice(0, 80).map(ex => (
                <div key={ex.id} onClick={() => setSelectedEx(selectedEx?.id === ex.id ? null : ex)} style={{
                  padding: '4px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 11,
                  background: selectedEx?.id === ex.id ? 'rgba(0,230,138,0.1)' : 'var(--bg-secondary)',
                  border: selectedEx?.id === ex.id ? '1px solid var(--accent)' : '1px solid transparent',
                }}>
                  <div style={{ fontWeight: 600, fontSize: 11, display: 'flex', justifyContent: 'space-between' }}>
                    <span>{ex.name}</span>
                    <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>{GROUP_LABELS[ex.group]}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {selectedEx && (
            <div style={{ flex: 1, background: 'var(--bg-secondary)', borderRadius: 10, padding: '10px 12px', maxHeight: 'calc(100vh - 190px)', overflowY: 'auto', minWidth: 250 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <h3 style={{ margin: 0, fontSize: 13, color: 'var(--accent)' }}>{selectedEx.name}</h3>
                <button onClick={() => setSelectedEx(null)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 14, cursor: 'pointer', padding: 0 }}>✕</button>
              </div>
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 6 }}>
                <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(0,230,138,0.1)', color: '#00e68a' }}>{GROUP_LABELS[selectedEx.group]}</span>
                <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>{selectedEx.type === 'compound' ? 'Базовое' : 'Изолир.'}</span>
                <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(249,115,22,0.1)', color: '#f97316' }}>{EQUIP_LABELS[selectedEx.equipment] || selectedEx.equipment}</span>
                <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: selectedEx.jointStress === 'high' ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', color: selectedEx.jointStress === 'high' ? '#ef4444' : '#22c55e' }}>Суставы: {JOINT_LABELS[selectedEx.jointStress] || selectedEx.jointStress}</span>
                <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(139,92,246,0.1)', color: '#8b5cf6' }}>Усталость: {selectedEx.fatigueCost}/10</span>
                {selectedEx.difficulty && (
                  <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: selectedEx.difficulty === 'advanced' ? 'rgba(239,68,68,0.1)' : selectedEx.difficulty === 'intermediate' ? 'rgba(249,115,22,0.1)' : 'rgba(34,197,94,0.1)', color: selectedEx.difficulty === 'advanced' ? '#ef4444' : selectedEx.difficulty === 'intermediate' ? '#f97316' : '#22c55e' }}>
                    {selectedEx.difficulty === 'advanced' ? 'Продвинутый' : selectedEx.difficulty === 'intermediate' ? 'Средний' : 'Новичок'}
                  </span>
                )}
                {selectedEx.targetMuscle && (
                  <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(236,72,153,0.1)', color: '#ec4899' }}>
                    🎯 {selectedEx.targetMuscle}
                  </span>
                )}
              </div>
              {selectedEx.technique && (
                <div style={{ marginBottom: 6, background: 'rgba(0,230,138,0.05)', borderRadius: 6, padding: '5px 8px', fontSize: 10, color: 'var(--text)', lineHeight: 1.4 }}>
                  <span style={{ fontWeight: 600, color: 'var(--accent)' }}>🎯 </span>{selectedEx.technique}
                </div>
              )}
              {selectedEx.comments && (
                <div style={{ marginBottom: 6, background: 'rgba(255,145,0,0.05)', borderRadius: 6, padding: '5px 8px', fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.4 }}>
                  <span style={{ fontWeight: 600, color: '#ff9100' }}>💡 </span>{selectedEx.comments}
                </div>
              )}
              {selectedEx.canReplace && selectedEx.canReplace.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center' }}>
                  <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>Замена:</span>
                  {selectedEx.canReplace.map(r => {
                    const rep = EXERCISE_CATALOG.find(e => e.id === r);
                    return rep ? <span key={r} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(0,230,138,0.08)', color: '#00e68a' }}>{rep.name}</span> : null;
                  })}
                </div>
              )}
              <button onClick={() => {
                setCustomExercises([...customExercises, { name: selectedEx.name, sets: 3, reps: 10, rir: 2 }]);
                setSelectedEx(null);
              }} style={{
                width: '100%', marginTop: 6, padding: '6px 12px', borderRadius: 6, border: '1px dashed var(--accent)',
                background: 'rgba(0,230,138,0.08)', color: 'var(--accent)', fontWeight: 600, fontSize: 11, cursor: 'pointer',
              }}>+ Добавить в план</button>
            </div>
          )}
        </div>
      )}

      {/* ═══════════ CALCULATORS TAB ═══════════ */}
      {tab === 'calculators' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="card" style={{ padding: '10px 12px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>📐 Калькулятор 1RM</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Вес (кг)</label>
                <input type="number" value={calcWeight} onChange={e => setCalcWeight(+e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Повторения</label>
                <input type="number" value={calcReps} onChange={e => setCalcReps(+e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Epley</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>{calcResults.epley1RM.toFixed(1)}</div>
                <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>кг</div>
              </div>
              <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Brzycki</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>{calcResults.brzycki1RM.toFixed(1)}</div>
                <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>кг</div>
              </div>
              <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Среднее</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>{((calcResults.epley1RM + calcResults.brzycki1RM) / 2).toFixed(1)}</div>
                <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>кг</div>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '10px 12px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>📊 RPE ↔ %1RM</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Вес (кг)</label>
                <input type="number" value={calcWeight} onChange={e => setCalcWeight(+e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Повторения</label>
                <input type="number" value={calcReps} onChange={e => setCalcReps(+e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>RPE (1-10)</label>
                <input type="number" min={1} max={10} value={calcRPE} onChange={e => setCalcRPE(+e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>1RM (через RPE)</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>{calcResults.rpe1RM.toFixed(1)}</div>
                <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>кг</div>
              </div>
              <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>%1RM при RPE{calcRPE}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>{(calcResults.rpePercent * 100).toFixed(1)}%</div>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '10px 12px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>🎯 %1RM → Рабочий вес</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>1RM (кг)</label>
                <input type="number" value={calc1RM} onChange={e => setCalc1RM(+e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>% от 1RM</label>
                <input type="number" min={30} max={100} value={calcPercent} onChange={e => setCalcPercent(+e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Рабочий вес ({calcPercent}% от {calc1RM}кг)</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>{calcResults.percentWeight.toFixed(1)} кг</div>
            </div>
          </div>

          {/* Powerlifting Indexes (TZ 7.12) */}
          <div className="card" style={{ padding: '10px 12px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>🏆 Силовые индексы (Wilks/Dots)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
              {[
                { k: plSquat, s: setPlSquat, l: 'Присед (кг)' },
                { k: plBench, s: setPlBench, l: 'Жим (кг)' },
                { k: plDeadlift, s: setPlDeadlift, l: 'Тяга (кг)' },
                { k: plWeight, s: setPlWeight, l: 'Вес тела (кг)' },
              ].map(f => (
                <div key={f.l}>
                  <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>{f.l}</label>
                  <input type="number" value={f.k} onChange={e => f.s(+e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Пол</label>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['male', 'female'] as const).map(s => (
                    <button key={s} onClick={() => setPlSex(s)} style={{
                      flex: 1, padding: '6px 4px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                      background: plSex === s ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)',
                      border: plSex === s ? '1px solid var(--accent)' : '1px solid var(--border)',
                      color: plSex === s ? '#00e68a' : 'var(--text-dim)', fontWeight: plSex === s ? 700 : 400,
                    }}>{s === 'male' ? 'М' : 'Ж'}</button>
                  ))}
                </div>
              </div>
            </div>
            {(() => {
              const total = plSquat + plBench + plDeadlift;
              const w = Math.max(plWeight, 30);
              const coef = plSex === 'male'
                ? { a: -216.0475144, b: 16.2606339, c: -0.002388645, d: -0.00113732, e: 7.01863e-6, f: -1.291e-8 }
                : { a: 594.31747775582, b: -27.23842536447, c: 0.82112226871, d: -0.00930733913, e: 4.731582e-5, f: -9.054e-8 };
              const denom = coef.a + coef.b * w + coef.c * w * w + coef.d * w * w * w + coef.e * w * w * w * w + coef.f * w * w * w * w * w;
              const dots = denom > 0 ? total * 500 / denom : 0;
              return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                  <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Сумма</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>{total} кг</div>
                  </div>
                  <div style={{ background: 'rgba(139,92,246,0.08)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Dots</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#8b5cf6' }}>{dots.toFixed(2)}</div>
                  </div>
                  <div style={{ background: 'rgba(249,115,22,0.08)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Отн. вес</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#f97316' }}>{(total / w).toFixed(1)}×</div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ═══════════ DIARY TAB ═══════════ */}
      {tab === 'diary' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="card" style={{ padding: '10px 12px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>📝 Записать подход</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Упражнение</label>
                <select value={logExercise} onChange={e => setLogExercise(e.target.value)} style={{ width: '100%', padding: '6px 4px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box' }}>
                  <option value="">— Выбрать —</option>
                  {EXERCISE_CATALOG.filter(e => e.type === 'compound').slice(0, 20).map(e => (
                    <option key={e.id} value={e.id}>{e.name.slice(0, 20)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Вес (кг)</label>
                <input type="number" value={logWeight} onChange={e => setLogWeight(+e.target.value)} style={{ width: '100%', padding: '6px 4px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Повторения</label>
                <input type="number" value={logReps} onChange={e => setLogReps(+e.target.value)} style={{ width: '100%', padding: '6px 4px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>RIR</label>
                <input type="number" min={0} max={5} value={logRIR} onChange={e => setLogRIR(+e.target.value)} style={{ width: '100%', padding: '6px 4px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
            </div>
            <button onClick={handleLogWorkout} style={{
              width: '100%', padding: 8, borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 12,
            }}>✓ Записать</button>
          </div>

          {diaryProgress.length > 0 && (
            <>
              <div className="card" style={{ padding: '10px 12px', marginBottom: 8 }}>
                <h4 style={{ margin: '0 0 6px', fontSize: 12 }}>🔥 Активность</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, fontSize: 10 }}>
                  <div style={{ textAlign: 'center', background: 'rgba(0,230,138,0.05)', borderRadius: 6, padding: 6 }}>
                    <div style={{ color: 'var(--text-dim)' }}>Недель</div>
                    <div style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 16 }}>{diaryProgress.length}</div>
                  </div>
                  <div style={{ textAlign: 'center', background: 'rgba(0,230,138,0.05)', borderRadius: 6, padding: 6 }}>
                    <div style={{ color: 'var(--text-dim)' }}>Тренировок</div>
                    <div style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 16 }}>{diaryProgress.reduce((s, w) => s + w.workoutCount, 0)}</div>
                  </div>
                  <div style={{ textAlign: 'center', background: 'rgba(0,230,138,0.05)', borderRadius: 6, padding: 6 }}>
                    <div style={{ color: 'var(--text-dim)' }}>Объём</div>
                    <div style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 16 }}>{diaryProgress.length > 0 ? `${(diaryProgress[diaryProgress.length - 1]?.totalVolume / 1000).toFixed(1)}т` : '—'}</div>
                  </div>
                  <div style={{ textAlign: 'center', background: 'rgba(0,230,138,0.05)', borderRadius: 6, padding: 6 }}>
                    <div style={{ color: 'var(--text-dim)' }}>План</div>
                    {(() => {
                      const planned = currentMicrocycle?.days?.filter((d: any) => d.isTraining).length || 0;
                      const actual = diaryProgress.length > 0 ? (diaryProgress[diaryProgress.length - 1]?.workoutCount || 0) : 0;
                      const compliance = planned > 0 ? Math.min(100, Math.round((actual / planned) * 100)) : 0;
                      return (
                        <>
                          <div style={{ fontWeight: 700, color: compliance >= 80 ? '#22c55e' : compliance >= 50 ? '#ff9100' : '#ef4444', fontSize: 16 }}>{compliance}%</div>
                          <div style={{ fontSize: 7, color: 'var(--text-dim)' }}>{actual}/{planned} дн</div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
              <div className="card" style={{ padding: '10px 12px', marginBottom: 8 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 12 }}>📈 Тоннаж по неделям</h4>
              <div style={{ display: 'flex', gap: 2, height: 60, alignItems: 'flex-end' }}>
                {diaryProgress.slice(-12).map((w, i) => {
                  const maxVol = Math.max(...diaryProgress.map(w => w.totalVolume), 1);
                  const h = Math.max(4, (w.totalVolume / maxVol) * 100);
                  const isMax = w.totalVolume === maxVol;
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}
                      title={`Нед ${w.week}: ${Math.round(w.totalVolume)}кг × ${w.workoutCount} трен`}>
                      <div style={{ width: '70%', height: `${h}%`, background: isMax ? 'var(--accent)' : 'rgba(0,230,138,0.3)', borderRadius: '2px 2px 0 0' }} />
                      <span style={{ fontSize: 7, color: 'var(--text-dim)' }}>{w.week}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-dim)', marginTop: 4 }}>
                <span>Неделя</span>
                <span>Пик: {Math.round(Math.max(...diaryProgress.map(w => w.totalVolume)))} кг</span>
              </div>
            </div>
            </>
          )}

          {diaryStats.length > 0 && (
            <div className="card" style={{ padding: '10px 12px', marginBottom: 8 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 12 }}>🏆 1RM по базовым</h4>
              {diaryStats.map((s, i) => {
                const pctMax = diaryStats.length > 0 ? Math.round((s.max1RM / Math.max(...diaryStats.map(d => d.max1RM))) * 100) : 0;
                const prev = i < diaryStats.length - 1 ? diaryStats[i + 1] : null;
                const trend = prev ? (s.max1RM > prev.max1RM * 1.02 ? '↑' : s.max1RM < prev.max1RM * 0.98 ? '↓' : '→') : '→';
                const trendColor = trend === '↑' ? '#22c55e' : trend === '↓' ? '#ef4444' : '#6b7280';
                return (
                  <div key={s.exerciseId} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 10 }}>
                    <span style={{ fontSize: 11, color: trendColor, minWidth: 12 }}>{trend}</span>
                    <span style={{ flex: 1, fontWeight: 500 }}>{s.exerciseName}</span>
                    <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 3, height: 6, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.max(5, pctMax)}%`, height: '100%', background: pctMax > 80 ? 'var(--accent)' : pctMax > 50 ? '#8b5cf6' : '#6b7280', borderRadius: 3 }} />
                    </div>
                    <span style={{ color: 'var(--accent)', fontWeight: 600, minWidth: 55, textAlign: 'right' }}>{Math.round(s.max1RM)} кг</span>
                    <span style={{ color: 'var(--text-dim)', minWidth: 45, textAlign: 'right' }}>{s.maxWeight}×{s.maxReps}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════ CYCLES TAB ═══════════ */}
      {tab === 'cycles' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="card" style={{ padding: '10px 12px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>🔄 Структура цикла</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
              {GOALS.map(g => (
                <button key={g.value} onClick={() => setGoal(g.value)} style={{
                  padding: '6px 8px', borderRadius: 6, fontSize: 11, fontWeight: goal === g.value ? 700 : 400,
                  cursor: 'pointer', border: goal === g.value ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: goal === g.value ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)', color: 'var(--text)', textAlign: 'left',
                }}>{g.icon} {g.label}</button>
              ))}
            </div>
            <button onClick={generatePlan} style={{
              width: '100%', padding: 8, borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 12,
            }}>▶ Сгенерировать макроцикл</button>
          </div>

          {macrocycle && (
            <>
              {/* Weekly volume/intensity chart */}
              <div className="card" style={{ padding: '10px 12px' }}>
                <h4 style={{ margin: '0 0 8px', fontSize: 12 }}>📊 Объём и интенсивность по неделям</h4>
                <div style={{ display: 'flex', gap: 1, height: 80, alignItems: 'flex-end' }}>
                  {macrocycle.mesocycles.flatMap(mc => mc.microcycles || []).map((mc, wi) => {
                    const isCurrent = wi + 1 === selectedWeek;
                    const volH = Math.max(4, (mc?.volumeMultiplier || 1) * 35);
                    const intH = Math.max(4, (mc?.rpeTarget || 7) * 5);
                    const color = mc?.mesocycleType === 'accumulation' ? '#22c55e' :
                                 mc?.mesocycleType === 'intensification' ? '#eab308' :
                                 mc?.mesocycleType === 'peaking' ? '#ef4444' : '#6b7280';
                    return (
                      <div key={wi} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }} title={`Нед ${wi+1}: Объём ×${mc?.volumeMultiplier || 1}, RPE ${mc?.rpeTarget || 7}`}
                        onClick={() => { setSelectedWeek(wi + 1); setTab('plan'); }}>
                        <div style={{ width: '70%', height: volH, background: color, borderRadius: '2px 2px 0 0', opacity: isCurrent ? 1 : 0.4 }} />
                        <div style={{ width: '40%', height: intH, background: color, borderRadius: '2px 2px 0 0', opacity: isCurrent ? 0.8 : 0.3 }} />
                        <span style={{ fontSize: 7, color: isCurrent ? 'var(--accent)' : 'var(--text-dim)', fontWeight: isCurrent ? 700 : 400 }}>{wi + 1}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 12, fontSize: 9, color: 'var(--text-dim)', marginTop: 4 }}>
                  <span><span style={{ color: '#22c55e' }}>■</span> Накопление</span>
                  <span><span style={{ color: '#eab308' }}>■</span> Интенсификация</span>
                  <span><span style={{ color: '#ef4444' }}>■</span> Пик</span>
                  <span><span style={{ color: '#6b7280' }}>■</span> Разгрузка</span>
                </div>
              </div>

              <div className="card" style={{ padding: '10px 12px' }}>
                <h3 style={{ margin: '0 0 6px', fontSize: 13 }}>📅 {macrocycle.totalWeeks}-недельный макроцикл</h3>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>
                  {GOALS.find(g => g.value === macrocycle.goal)?.label} • {LEVELS.find(l => l.value === macrocycle.level)?.label}
                </div>
                {macrocycle.mesocycles.map((mc, mi) => (
                  <div key={mi} style={{ marginBottom: 6, background: 'var(--bg-secondary)', borderRadius: 6, padding: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 12 }}>
                        {mc.type === 'accumulation' ? '📈 Накопление' :
                         mc.type === 'intensification' ? '📊 Интенсификация' :
                         mc.type === 'peaking' ? '🏆 Пик' :
                         mc.type === 'deload' ? '🔄 Разгрузка' : '📋'} — Мезоцикл {mi + 1}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{mc.weeks} нед (нед {mc.weekStart + 1}–{mc.weekStart + mc.weeks})</span>
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 4 }}>
                      {mc.type === 'accumulation' ? 'Объём 100-130%, RIR 2-3, RPE 6-7. Субмаксимальные веса, много подсобки.' :
                       mc.type === 'intensification' ? 'Объём 70-90%, RIR 1-2, RPE 8-9. Рост весов, снижение подсобки.' :
                       mc.type === 'peaking' ? 'Объём 40-60%, RIR 0-1, RPE 9-10. Максимальные веса, специфика.' :
                       mc.type === 'deload' ? 'Объём 30-50%, RIR 3-5, RPE 5-6. Восстановление ЦНС, мобильность.' : ''}
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {Array.from({ length: mc.weeks }, (_, wi) => (
                        <div key={wi} style={{
                          width: 24, height: 24, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: selectedWeek === mc.weekStart + wi + 1 ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
                          border: selectedWeek === mc.weekStart + wi + 1 ? '1px solid var(--accent)' : '1px solid var(--border)',
                          fontSize: 9, color: selectedWeek === mc.weekStart + wi + 1 ? '#000' : 'var(--text-dim)',
                          cursor: 'pointer',
                        }} onClick={() => { setSelectedWeek(mc.weekStart + wi + 1); setTab('plan'); }}>
                          {mc.weekStart + wi + 1}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Projected max-out */}
              {diaryStats.length > 0 && (
                <div className="card" style={{ padding: '10px 12px', border: '1px solid rgba(0,230,138,0.2)', marginBottom: 8 }}>
                  <h4 style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--accent)' }}>🎯 Прогноз к концу макроцикла</h4>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>
                    {macrocycle?.totalWeeks || 12} нед × {(trainingOutput?.estimatedProgress || 2)}%/нед прогресс
                  </div>
                  {diaryStats.slice(0, 3).map(s => {
                    const projected = Math.round(s.max1RM * (1 + (trainingOutput?.estimatedProgress || 2) / 100 * (macrocycle?.totalWeeks || 12)));
                    const gain = projected - Math.round(s.max1RM);
                    return (
                      <div key={s.exerciseId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '2px 0' }}>
                        <span>{s.exerciseName}</span>
                        <span style={{ color: 'var(--text-dim)' }}>{Math.round(s.max1RM)} → <b style={{ color: '#22c55e' }}>{projected}</b> кг (+{gain})</span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="card" style={{ padding: '10px 12px' }}>
                <h4 style={{ margin: '0 0 6px', fontSize: 12 }}>📊 Параметры фаз</h4>
                {(['accumulation', 'intensification', 'peaking', 'deload'] as const).map(phase => {
                  const params = MESOCYCLE_PARAMS[phase];
                  if (!params) return null;
                  return (
                    <div key={phase} style={{ marginBottom: 4, padding: '4px 6px', background: 'var(--bg-secondary)', borderRadius: 4, fontSize: 10 }}>
                      <span style={{ fontWeight: 600 }}>
                        {phase === 'accumulation' ? 'Накопление' : phase === 'intensification' ? 'Интенсификация' : phase === 'peaking' ? 'Пик' : 'Разгрузка'}
                      </span>
                      <span style={{ color: 'var(--text-dim)', marginLeft: 6 }}>
                        Объём: {params.volumeMultiplier}× | RIR: {params.rirRange[0]}-{params.rirRange[1]} | RPE: {params.rpeTarget}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
