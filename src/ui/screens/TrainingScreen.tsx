import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { EXERCISE_CATALOG, getExercisesByGroup } from '../../core/exercise-catalog';
import { calcTraining, calcExercisePrescription, EXERCISE_DB, TRAINING_SPLITS } from '../../engines/training.engine';
import { generateMacrocycle, getCurrentWeekPlan, type MacrocyclePlan, type Microcycle, type MacrocycleInput } from '../../engines/training-periodization.engine';
import { selectSplit, getSplitOptions, type SplitCandidate } from '../../engines/split-selector.engine';
import { selectProgressionRule } from '../../engines/progression.engine';
import { RIR_MATRIX, generateWeeklyPlan } from '../../engines/rir-matrix.engine';
import { StrengthDiary, type StrengthStats, type WeeklyProgress, type ProgressionAlert } from '../../engines/strength-diary.engine';
import type { WorkoutLog } from '../../core/types';
import { generateWarmup } from '../../engines/warmup.engine';
import { generateCooldown } from '../../engines/cooldown.engine';
import { selectSetScheme } from '../../engines/set-scheme.engine';
import { selectTempo, formatTempo } from '../../engines/tempo.engine';
import { useDataLink } from '../../core/data-link';
import type { TrainingInput, TrainingOutput, Exercise, MovementPattern } from '../../core/types';
import { computeAnalytics, type AnalyticsSnapshot, type WeeklyBreakdown } from '../../engines/analytics-engine';
import { computeConstraints } from '../../engines/training-constraints.engine';
import { generatePeriodization, getPhaseParams } from '../../engines/cycle-periodization.engine';
import { getTrainingMethods, getMethodsByCategory, getVolumeReferences, getVolumeByMuscle, getSplitVisuals } from '../../engines/training-methodology.engine';
import { buildVisualDashboard, computeWeeklyChart, computeMuscleVolume, computeProgression, type VizSessionData } from '../../engines/training-visualization.engine';
import { getProgramById, getProgramsByGoal, FULL_PROGRAM_LIBRARY } from '../../engines/complete-program-library.engine';
import { generateWeeklyReport, analyzeMeasurements, loadMeasurements, saveMeasurement, type BodyMeasurement } from '../../engines/log-analytics-progression.engine';
import { getExerciseBio } from '../../data/exercise-biomechanics-db';
import { getStrengthLevel, getNextLevelTarget } from '../../engines/performance-analytics.engine';
import { computeStructuredAnalytics } from '../../engines/structured-analytics.engine';

const WARMUP_LABELS: Record<string, string> = {
  jumping_jack: 'Прыжки Jumping Jack', arm_circles: 'Круги руками', leg_swings: 'Махи ногами',
  hip_circle: 'Круги тазом', ankle_mobility: 'Мобилизация голеностопа', shoulder_circle: 'Круги плечами',
  thoracic_rotation: 'Ротация грудного отдела', cat_camel: 'Кошка-корова', worlds_greatest: 'Глубокий выпад с ротацией',
  banded_clam: 'Ракушка с резинкой', external_rotation: 'Внешняя ротация плеча', bird_dog: 'Bird-dog',
  dead_bug: 'Dead bug', light_cardio: 'Лёгкое кардио', squat: 'Присед',
  deep_breathing: 'Глубокое дыхание', box_breathing: 'Квадратное дыхание',
};

const GOALS = [
  { value: 'bulk', label: 'Масса', icon: '💪' },
  { value: 'cut', label: 'Сушка', icon: '🔥' },
  { value: 'strength', label: 'Сила', icon: '🏋️' },
  { value: 'maintenance', label: 'Поддержание', icon: '⚖️' },
  { value: 'recomp', label: 'Рекомпозиция', icon: '🔁' },
  { value: 'rehab', label: 'Реабилитация', icon: '🩹' },
] as const;

const LEVELS = [
  { value: 'beginner', label: 'Новичок', icon: '🌱' },
  { value: 'intermediate', label: 'Средний', icon: '📈' },
  { value: 'advanced', label: 'Опытный', icon: '🏆' },
  { value: 'enhanced', label: 'Enhanced', icon: '⚡' },
] as const;

const MUSCLE_GROUPS = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'] as const;
const GROUP_LABELS: Record<string, string> = {
    chest: 'Грудь', back: 'Спина', legs: 'Ноги', shoulders: 'Плечи', arms: 'Руки', core: 'Кор',
};
const EQUIP_LABELS: Record<string, string> = { barbell: 'Штанга', dumbbell: 'Гантели', machine: 'Тренажёр', cable: 'Блок', bodyweight: 'Вес тела', band: 'Резинка', kettlebell: 'Гиря', specialty_bar: 'Спецгриф' };
const JOINT_LABELS: Record<string, string> = { high: 'высокая', med: 'средняя', low: 'низкая' };
const PHASE_LABELS: Record<string, string> = { accumulation: 'Накопление', intensification: 'Интенсификация', peaking: 'Пик', deload: 'Разгрузка' };
const PHASE_HINTS: Record<string, string> = {
  accumulation: 'Фаза накопления: умеренная интенсивность, рост объёма, контроль техники и восстановления.',
  intensification: 'Фаза интенсификации: выше рабочие веса, меньше лишнего объёма, строгий контроль RPE.',
  peaking: 'Пиковая фаза: приоритет тяжёлых подходов, низкая усталость, больше отдыха между сессиями.',
  deload: 'Разгрузка: снижаем объём и интенсивность, восстанавливаем суставы и нервную систему.',
};

type TrainingTab = 'plan' | 'runtime' | 'exercises' | 'calculators' | 'diary' | 'cycles' | 'history' | 'analytics' | 'methods' | 'visual' | 'programs' | 'timers' | 'progress' | 'mytraining';
type TrainingPage = 'hero' | 'tabs';
type TrainingGroup = 'training' | 'planning' | 'info' | null;

const TAB_GROUPS: Record<string, { title: string; icon: string; tabs: TrainingTab[]; color: string }> = {
  training: { title: '🏋️ Тренировки', icon: '🏋️', tabs: ['plan', 'runtime', 'exercises', 'diary', 'history'], color: 'var(--accent)' },
  planning: { title: '📐 Планирование', icon: '📐', tabs: ['calculators', 'cycles', 'programs', 'mytraining'], color: '#3b82f6' },
  info: { title: '📊 Инфо', icon: '📊', tabs: ['analytics', 'methods', 'visual', 'timers', 'progress'], color: '#8b5cf6' },
};

const TAB_LABELS: Record<TrainingTab, string> = {
  plan: '📋 План', runtime: '▶ Тренировка', exercises: '🏋️ Упражнения', calculators: '📐 Калькуляторы',
  diary: '📝 Дневник', cycles: '🔄 Циклы', history: '📜 История', analytics: '📊 Аналитика',
  methods: '🧠 Методики', visual: '📈 Визуализация', programs: '📚 Программы', timers: '⏱ Таймеры',
  progress: '📏 Прогресс', mytraining: '⭐ Мои',
};

export const TrainingScreen: React.FC = () => {
  const linked = useDataLink();
  const readiness = linked.readiness;
  const labAnalysis = linked.labAnalysis;
  const diary = useMemo(() => new StrengthDiary(), []);
  const [tab, setTab] = useState<TrainingTab>('plan');
  const [page, setPage] = useState<TrainingPage>('hero');
  const [mainGroup, setMainGroup] = useState<TrainingGroup>(null);

  // Plan state — pre-fill from readiness and labAnalysis
  const [goal, setGoal] = useState('bulk');
  const [level, setLevel] = useState('intermediate');
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [splitType, setSplitType] = useState('auto');
  const [splitCandidates, setSplitCandidates] = useState<SplitCandidate[]>([]);
  const [showSplitPicker, setShowSplitPicker] = useState(false);
  const [cycleType, setCycleType] = useState('auto');
  const [mesoLength, setMesoLength] = useState(12);
  const [recovery, setRecovery] = useState(Math.round((readiness?.recovery ?? 70) / 10));
  const [fatigue, setFatigue] = useState(Math.round((readiness?.fatigue ?? 30) / 10));
  const [weakPoints, setWeakPoints] = useState<string[]>([]);
  const [bodyWeight, setBodyWeight] = useState(80);
  const [sleepHours, setSleepHours] = useState(linked.profile?.settings?.baselineSleepHours ?? 7);
  const [stressLevel, setStressLevel] = useState(linked.profile?.settings?.baselineStressLevel ?? 5);
  const [customExercises, setCustomExercises] = useState<{ name: string; sets: number; reps: number; rir: number }[]>(() => { try { return JSON.parse(localStorage.getItem('myTrainingExercises') || '[]'); } catch { return []; } });
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
  const [bmiWeight, setBmiWeight] = useState(70);
  const [bmiHeight, setBmiHeight] = useState(175);
  const [bmiResult, setBmiResult] = useState<number | null>(null);
  const [bmrWeight, setBmrWeight] = useState(70);
  const [bmrHeight, setBmrHeight] = useState(175);
  const [bmrAge, setBmrAge] = useState(25);
  const [bmrSex, setBmrSex] = useState<'male' | 'female'>('male');
  const [bmrResult, setBmrResult] = useState<number | null>(null);
  const [bmrKmWeight, setBmrKmWeight] = useState(70);
  const [bmrKmBodyFat, setBmrKmBodyFat] = useState(15);
  const [bmrKmResult, setBmrKmResult] = useState<number | null>(null);
  const [tdeeBmr, setTdeeBmr] = useState(1700);
  const [tdeePal, setTdeePal] = useState(1.55);
  const [tdeeResult, setTdeeResult] = useState<number | null>(null);
  const [gripKg, setGripKg] = useState(45);
  const [gripSex, setGripSex] = useState<'male' | 'female'>('male');
  const [gripAge, setGripAge] = useState(30);
  const [gripResult, setGripResult] = useState<{ percentile: number; level: string } | null>(null);
  const [hrvValue, setHrvValue] = useState(50);
  const [stressResult, setStressResult] = useState<{ stress: number; level: string } | null>(null);

  // Exercise Calculator state
  const [exCalcGroup, setExCalcGroup] = useState('');
  const [exCalcType, setExCalcType] = useState('');
  const [exCalcEquip, setExCalcEquip] = useState('');

  // Unified program builder state
  const [builderStep, setBuilderStep] = useState(1);
  const [builderSplit, setBuilderSplit] = useState<SplitCandidate | null>(null);
  const [builderDayExercises, setBuilderDayExercises] = useState<Record<number, { name: string; sets: number; reps: string; rir: number; rest: number; group: string }[]>>({});
  const [builderMacroResult, setBuilderMacroResult] = useState<any[] | null>(null);
  const [builderShowSubs, setBuilderShowSubs] = useState<string | null>(null);
  const [builderAddExDay, setBuilderAddExDay] = useState<number | null>(null);

  // Diary state
  const [diaryStats, setDiaryStats] = useState<StrengthStats[]>([]);
  const [diaryProgress, setDiaryProgress] = useState<WeeklyProgress[]>([]);
  const [logExercise, setLogExercise] = useState('');
  const [logWeight, setLogWeight] = useState(80);
  const [logReps, setLogReps] = useState(8);
  const [logRIR, setLogRIR] = useState(2);
  const [historyWorkouts, setHistoryWorkouts] = useState<WorkoutLog[]>([]);
  const [historyExpanded, setHistoryExpanded] = useState<string | null>(null);

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

  const generatePlan = useCallback((overrideSplitType?: string) => {
    const input: TrainingInput = {
      goal, level, daysPerWeek, recovery, fatigue, nutrition: 7,
      weakPoints, sessionDuration: 60, exercises: [],
      splitType: overrideSplitType || splitType,
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
  }, [goal, level, daysPerWeek, recovery, fatigue, weakPoints, splitType]);

  // Auto-regenerate when days/sparse
  const loadDiaryStats = async () => {
    try {
      const progress = await diary.getWeeklyProgress();
      setDiaryProgress(progress);
      const compoundIds = EXERCISE_CATALOG.filter(e => e.type === 'compound').slice(0, 10).map(e => e.id);
      const stats: StrengthStats[] = [];
      for (const id of compoundIds) { const s = await diary.getExerciseStats(id); if (s) stats.push(s); }
      setDiaryStats(stats);
      const wLogs = await diary.getWorkoutLogs();
      setHistoryWorkouts(wLogs.reverse());
    } catch {}
  };

  const prevDays = useRef(daysPerWeek);
  useEffect(() => { loadDiaryStats(); }, []);
  useEffect(() => { if (prevDays.current !== daysPerWeek) { prevDays.current = daysPerWeek; generatePlan(); } }, [daysPerWeek]);
  useEffect(() => { localStorage.setItem('myTrainingExercises', JSON.stringify(customExercises)); }, [customExercises]);

  useEffect(() => {
    if (macrocycle && selectedWeek > 0) {
      setCurrentMicrocycle(getCurrentWeekPlan(macrocycle, selectedWeek));
    }
  }, [macrocycle, selectedWeek]);

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
    // Also save workout log and reload history
    await diary.saveWorkoutLog({
      id: `workout_${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      duration: 60,
      exercises: [{
        id: `log_${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        exerciseId: logExercise,
        exerciseName: ex?.name || logExercise,
        sets: [{ weight: logWeight, reps: logReps, rir: logRIR }],
        totalVolume: logWeight * logReps,
        estimated1RM: Math.round(logWeight * (1 + logReps / 30)),
        isCompound: ex?.type === 'compound',
        weekNumber: selectedWeek,
      }],
      overallRPE: 7,
      recoveryBefore: recovery,
      split: trainingOutput?.splitName || 'custom',
      weekNumber: selectedWeek,
    });
    const wLogs = await diary.getWorkoutLogs();
    setHistoryWorkouts(wLogs.reverse());
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

  const calcBMI = () => {
    const hm = bmiHeight / 100;
    setBmiResult(bmiWeight / (hm * hm));
  };

  const calcBMR = () => {
    if (bmrSex === 'male')
      setBmrResult(10 * bmrWeight + 6.25 * bmrHeight - 5 * bmrAge + 5);
    else setBmrResult(10 * bmrWeight + 6.25 * bmrHeight - 5 * bmrAge - 161);
  };

  const calcBMR_KM = () => {
    const lbm = bmrKmWeight * (100 - bmrKmBodyFat) / 100;
    setBmrKmResult(370 + 21.6 * lbm);
  };

  const calcTDEE = () => setTdeeResult(tdeeBmr * tdeePal);

  const calcGrip = () => {
    let ref: number;
    if (gripSex === 'male') ref = 50 - (gripAge - 30) * 0.3;
    else ref = 30 - (gripAge - 30) * 0.2;
    const pct = Math.min(100, Math.max(0, (gripKg / ref) * 100));
    setGripResult({ percentile: Math.round(pct), level: pct >= 80 ? 'Отлично' : pct >= 60 ? 'Хорошо' : pct >= 40 ? 'Средне' : 'Низкий' });
  };

  const calcStress = () => {
    const stress = Math.max(0, Math.min(100, 100 - (hrvValue - 20) * 2));
    setStressResult({ stress: Math.round(stress), level: stress >= 70 ? 'Высокий' : stress >= 30 ? 'Средний' : 'Низкий' });
  };

  const PAL_OPTIONS = [
    { value: 1.2, label: 'Сидячий (1.2)' },
    { value: 1.375, label: 'Легкий (1.375)' },
    { value: 1.55, label: 'Умеренный (1.55)' },
    { value: 1.725, label: 'Высокий (1.725)' },
    { value: 1.9, label: 'Экстремальный (1.9)' },
  ];

  const bmiCategory = (v: number) => v < 18.5 ? 'Недостаток веса' : v < 25 ? 'Норма' : v < 30 ? 'Избыток' : 'Ожирение';

  return (
    <div className="screen training-screen" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto', padding: 0 }}>

      {/* ─── HERO PAGE ─── */}
      {page === 'hero' && (
        <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', flexDirection:'column' }}>
          <img src="/training-hero.jpg" alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top' }} />
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(transparent 50%, rgba(0,0,0,0.85))' }} />
          <div style={{ position:'relative', zIndex:2, flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:'16px 16px 80px' }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: '0 0 2px', textShadow: '0 2px 14px rgba(0,0,0,0.9)' }}>Тренировки</h1>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)', margin: '0 0 16px', lineHeight: 1.3, textShadow: '0 1px 8px rgba(0,0,0,0.8)' }}>
              План, дневник, упражнения, калькуляторы и аналитика
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {(Object.entries(TAB_GROUPS) as [TrainingGroup & string, typeof TAB_GROUPS[string]][]).map(([key, group]) => (
                <button key={key} onClick={() => { setPage('tabs'); setMainGroup(key as TrainingGroup); setTab(group.tabs[0]); }} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, cursor: 'pointer', textAlign: 'left', width: '100%',
                  background: 'rgba(20,22,30,0.35)', border: '1px solid var(--glass-border)', color: 'var(--text)',
                  transition: 'all 0.2s',
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    background: group.color + '18', fontSize: 20,
                  }}>
                    {group.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2, color: group.color }}>{group.title}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', lineHeight: 1.3 }}>
                      {group.tabs.map(t => TAB_LABELS[t].replace(/^.\s?/, '')).join(' • ')}
                    </div>
                  </div>
                  <span style={{ color: group.color, fontSize: 16, opacity: 0.6 }}>→</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB VIEW (when not on hero) ─── */}
      {page !== 'hero' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
          <button onClick={() => { setPage('hero'); setMainGroup(null); }} style={{
            padding: '6px 8px', cursor: 'pointer', fontSize: 14,
            color: 'var(--text-dim)', border: 'none', background: 'transparent',
            display: 'flex', alignItems: 'center', gap: 4,
            fontWeight: 600, transition: 'all 0.2s',
          }}>← На главную</button>
          {mainGroup && (
            <button onClick={() => { setMainGroup(null); setTab('plan'); }} style={{
              padding: '6px 8px', cursor: 'pointer', fontSize: 12,
              color: 'var(--accent)', border: 'none', background: 'transparent',
              display: 'flex', alignItems: 'center', gap: 4,
              fontWeight: 600, transition: 'all 0.2s',
            }}>← Назад</button>
          )}
        </div>
      )}

      {page !== 'hero' && (
      <div style={{ padding: '0 4px' }}>
      {mainGroup && (
        <h2 style={{ margin: '0 0 8px', fontSize: 16, color: TAB_GROUPS[mainGroup].color }}>{TAB_GROUPS[mainGroup].title}</h2>
      )}

      <div style={{ display: 'flex', gap: 3, marginBottom: 10, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {(mainGroup ? TAB_GROUPS[mainGroup].tabs : Object.keys(TAB_LABELS) as TrainingTab[]).map(k => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: '7px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
            background: tab === k ? 'var(--accent)' : 'var(--bg-secondary)',
            color: tab === k ? '#000' : 'var(--text-dim)', border: 'none', cursor: 'pointer',
            transition: 'all 0.2s',
          }}>{TAB_LABELS[k]}</button>
        ))}
      </div>

      {/* Readiness card — visible on all tabs */}
      {readiness && (
        <div className="card" style={{ marginBottom: 8, padding: '10px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <h4 style={{ margin: 0, fontSize: 12 }}>📊 Готовность к тренировке</h4>
            <span style={{ fontSize: 11, color: readiness.recovery >= 70 ? '#22c55e' : readiness.recovery >= 40 ? '#eab308' : '#ef4444', fontWeight: 700 }}>
              {Math.round(readiness.recovery)}%
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {[
              { label: 'Восст.', value: readiness.recovery, color: readiness.recovery >= 70 ? '#22c55e' : '#eab308' },
              { label: 'Питание', value: readiness.nutrition ?? 50, color: (readiness.nutrition ?? 50) >= 70 ? '#22c55e' : '#eab308' },
              { label: 'Сон', value: (readiness.sleep ?? 0) * 10, color: (readiness.sleep ?? 5) >= 7 ? '#22c55e' : '#eab308' },
              { label: 'Стресс', value: 100 - (readiness.stress ?? 50), color: (readiness.stress ?? 3) < 4 ? '#22c55e' : '#ef4444' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, color: 'var(--text-dim)', minWidth: 44 }}>{item.label}</span>
                <div style={{ flex: 1, background: 'var(--bg-secondary)', borderRadius: 4, height: 5, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, Math.max(0, item.value))}%`, height: '100%', background: item.color, borderRadius: 4 }} />
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color: item.color, minWidth: 24, textAlign: 'right' }}>{Math.round(item.value)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

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
              <button onClick={() => { setShowSplitPicker(!showSplitPicker); if (!splitCandidates.length) { const opts = getSplitOptions({ goal, level, daysPerWeek, recovery, fatigue, nutrition: 7, weakPoints, sessionDuration: 60, exercises: [] } as any); setSplitCandidates(opts.slice(0, 12)); } }} style={{
                width: '100%', padding: '6px 10px', borderRadius: 8, textAlign: 'left', cursor: 'pointer',
                background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span>{splitType === 'auto' ? 'Авто-выбор сплита' : splitCandidates.find(c => c.id === splitType)?.name || splitType}</span>
                <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>{showSplitPicker ? '▴' : '▾'}</span>
              </button>
              {showSplitPicker && (
                <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 220, overflowY: 'auto', background: 'var(--bg-secondary)', borderRadius: 8, padding: '4px 6px', border: '1px solid var(--border)' }}>
                  <div key="auto" onClick={() => { setSplitType('auto'); setShowSplitPicker(false); setTimeout(() => generatePlan(), 50); }} style={{
                    padding: '5px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 11,
                    background: splitType === 'auto' ? 'rgba(0,230,138,0.1)' : 'transparent',
                    border: splitType === 'auto' ? '1px solid var(--accent)' : '1px solid transparent',
                  }}>
                    <div style={{ fontWeight: 600 }}>🤖 Авто-выбор</div>
                    <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Движок сам подберёт оптимальный сплит</div>
                  </div>
                   {splitCandidates.map(c => (
                     <div key={c.id || c.name} onClick={() => { const newType = c.id || c.name; setSplitType(newType); setShowSplitPicker(false); setTimeout(() => generatePlan(newType), 50); }} style={{
                      padding: '5px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 11,
                      background: splitType === (c.id || c.name) ? 'rgba(0,230,138,0.1)' : 'transparent',
                      border: splitType === (c.id || c.name) ? '1px solid var(--accent)' : '1px solid transparent',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600 }}>{c.name}</span>
                        <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: 'rgba(0,230,138,0.1)', color: '#00e68a', fontWeight: 600 }}>{(c.score * 100).toFixed(0)}%</span>
                      </div>
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)' }}>{c.desc?.slice(0, 80)}{c.desc && c.desc.length > 80 ? '...' : ''}</div>
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
                  { v: 'rehab', l: 'Реабилитация' }, { v: 'wl_tech', l: 'WL Техника' },
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
                <input type="range" min={2} max={7} value={daysPerWeek} onChange={e => { setDaysPerWeek(parseFloat(e.target.value) || 0); setTimeout(generatePlan, 50); }}
                  style={{ width: '100%', accentColor: 'var(--accent)' }} />
                <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-dim)' }}>{daysPerWeek}</div>
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Восстановление</label>
                <input type="range" min={1} max={10} value={recovery} onChange={e => setRecovery(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', accentColor: 'var(--accent)' }} />
                <div style={{ textAlign: 'center', fontSize: 10, color: recovery < 4 ? '#ef4444' : recovery < 6 ? '#ff9100' : '#22c55e' }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: recovery < 4 ? '#ef4444' : recovery < 6 ? '#ff9100' : '#22c55e', marginRight: 4 }} />
                  {recovery}/10 — {recovery < 4 ? 'низкое' : recovery < 6 ? 'умеренное' : recovery < 8 ? 'хорошее' : 'отличное'}
                </div>
                <div style={{ fontSize:8, color:'var(--text-dim)', textAlign:'center', marginTop:1 }}>Низкий → требуется больше отдыха</div>
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Усталость</label>
                <input type="range" min={1} max={10} value={fatigue} onChange={e => setFatigue(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', accentColor: 'var(--accent)' }} />
                <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-dim)' }}>{fatigue}/10</div>
                <div style={{ fontSize:8, color:'var(--text-dim)', textAlign:'center', marginTop:1 }}>
                  {fatigue <= 3 ? 'Свежий' : fatigue <= 6 ? 'Умеренная усталость' : fatigue <= 8 ? 'Высокая нагрузка' : 'Перетренированность'}
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Вес (кг)</label>
                <input type="number" value={bodyWeight} onChange={e => setBodyWeight(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '5px 6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Сон (ч)</label>
                <input type="number" min={0} max={12} value={sleepHours || ''} onChange={e => setSleepHours(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '5px 6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
                <div style={{ fontSize:8, color: sleepHours < 6 ? '#ef4444' : sleepHours <= 7 ? '#ff9100' : sleepHours <= 9 ? '#22c55e' : '#ff9100', marginTop:1, textAlign:'center' }}>
                  {sleepHours < 6 ? '<6: Недостаточно' : sleepHours <= 7 ? '6-7: Минимум' : sleepHours <= 9 ? '7-9: Оптимум' : '>9: Избыток'}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Стресс (1-10)</label>
                <input type="number" min={1} max={10} value={stressLevel || ''} onChange={e => setStressLevel(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '5px 6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
                <div style={{ fontSize:8, color: stressLevel <= 3 ? '#22c55e' : stressLevel <= 6 ? '#ff9100' : '#ef4444', marginTop:1, textAlign:'center' }}>
                  {stressLevel <= 3 ? '1-3: Низкий' : stressLevel <= 6 ? '4-6: Средний' : '7-10: Высокий'}
                </div>
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
            <button onClick={() => generatePlan()} style={{
              width: '100%', padding: 10, borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #00e68a, #00c853)', color: '#000', fontWeight: 700, fontSize: 13,
            }}>▶ Сгенерировать план</button>
          </div>

          {trainingOutput && (
            <>
              {/* Training constraints check */}
              {(() => {
                const constraints = computeConstraints({
                  riskSnapshot: {},
                  fatigueLevel: fatigue / 10,
                  recoveryLevel: recovery / 10,
                  priScore: recovery / 10,
                  jointFatigue: {},
                  cumulativeLoad: { weekly: 0, patternLoad: {}, jointLoad: {}, overload: false },
                  equipmentAvailable: ['barbell', 'dumbbell', 'bench'],
                  goal,
                });
                if (constraints.recommendations.length === 0) return null;
                return (
                  <div key="constraints" className="card" style={{
                    marginBottom: 8, padding: '6px 10px',
                    background: 'rgba(249,115,22,0.06)', borderLeft: '3px solid #f97316',
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#f97316' }}>⚠ Ограничения тренировки</div>
                    {constraints.recommendations.map((r, i) => (
                      <div key={i} style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>• {r}</div>
                    ))}
                  </div>
                );
              })()}
              {/* Smart Recommendations */}
              {(() => {
                const tips: { icon: string; text: string; color: string }[] = [];
                if (recovery < 5) tips.push({ icon: '⚠️', text: 'Низкое восстановление: сократите объём на 10-20% или держите RIR выше.', color: '#ef4444' });
                if (sleepHours < 7) tips.push({ icon: '😴', text: `Сон ${sleepHours} ч: добавьте 30-60 минут сна перед тяжёлыми днями.`, color: '#ff9100' });
                if (stressLevel > 7) tips.push({ icon: '🧠', text: 'Высокий стресс: избегайте отказных подходов и контролируйте RPE.', color: '#ff9100' });
                if (currentMicrocycle?.mesocycleType === 'deload') tips.push({ icon: '🧊', text: 'Неделя разгрузки: цель — восстановление, а не рекорды.', color: '#3b82f6' });
                else if (currentMicrocycle?.mesocycleType === 'peaking') tips.push({ icon: '🎯', text: 'Пиковая фаза: держите технику стабильной и не добавляйте лишний объём.', color: '#ef4444' });
                else if (currentMicrocycle?.mesocycleType === 'accumulation') tips.push({ icon: '📈', text: 'Фаза накопления: постепенно увеличивайте объём при сохранении качества повторений.', color: '#22c55e' });
                if (weakPoints.length > 0) tips.push({ icon: '🔎', text: `Фокус на слабых зонах: ${weakPoints.map(w => GROUP_LABELS[w] || w).join(', ')}.`, color: '#8b5cf6' });
                if (recovery > 8 && fatigue < 3) tips.push({ icon: '✅', text: 'Готовность высокая: можно добавить один качественный подход в приоритетную группу.', color: '#22c55e' });
                if (tips.length === 0) tips.push({ icon: '✅', text: 'Параметры выглядят сбалансированно: выполняйте план без лишних изменений.', color: '#00e68a' });
                return (
                  <div key="recommendations" className="card" style={{ padding: '10px 12px', border: '1px solid rgba(0,230,138,0.2)' }}>
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
                    onChange={e => setSelectedWeek(parseFloat(e.target.value) || 0)}
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
                  <div key="warmup" className="card" style={{ padding: '8px 10px', border: '1px solid rgba(255,145,0,0.2)' }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: '#ff9100', marginBottom: 4 }}>🔥 Разминка</div>
                    {warmup.map((b, bi) => (
                      <div key={bi} style={{ fontSize: 10, marginBottom: 2, color: 'var(--text-dim)' }}>
                        <span style={{ fontWeight: 600, color: '#ff9100' }}>
                          {b.type === 'general' ? 'Общая' : b.type === 'mobility' ? 'Мобилизация' : b.type === 'activation' ? 'Активация' : 'Разминка'} ({b.durationSec}с)
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
                      {PHASE_LABELS[currentMicrocycle.mesocycleType] || 'Рабочая фаза'} — Неделя {selectedWeek}
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
                          {PHASE_HINTS[currentMicrocycle.mesocycleType] || 'Рабочая неделя: сохраняйте заданный объём, интенсивность и RIR.'}
                        </div>
                      )}
                      {currentMicrocycle.days.filter((d: any) => d.isTraining).map((day: any, di: number) => {
                    const dayExCount = day.exercises?.length || 0;
                    const dayCompounds = day.exercises?.filter((e: any) => e.isCompound).length || 0;
                    const difficultyScore = Math.min(10, Math.round((dayCompounds * 2 + dayExCount) * (day.intensity === 'very_high' ? 1.4 : day.intensity === 'high' ? 1.2 : 1)));
                    const diffLabel = difficultyScore <= 3 ? 'лёгко' : difficultyScore <= 5 ? 'умеренно' : difficultyScore <= 7 ? 'тяжело' : 'очень тяжело';
                    const diffColor = difficultyScore <= 3 ? '#22c55e' : difficultyScore <= 5 ? '#84cc16' : difficultyScore <= 7 ? '#ff9100' : '#ef4444';
                    const adjRecovery = recovery / 10;
                    const autoRegNote = adjRecovery < 0.4 ? '⚠ Снизить объём на 20% — низкое восстановление' :
                                       adjRecovery < 0.6 ? '⚡ Умеренная нагрузка — следи за RPE' :
                                       adjRecovery > 0.8 ? '✅ Высокая готовность — можно добавить подход' : '';
                    const labWarnings: string[] = [];
                    if (labAnalysis) {
                      if (labAnalysis.liverStress > 60) labWarnings.push(`⚠ Печень ${labAnalysis.liverStress}% — исключить гепатотоксичные нагрузки`);
                      if (labAnalysis.inflammation > 5) labWarnings.push(`⚠ Воспаление ${labAnalysis.inflammation.toFixed(1)} — рекомендован deload`);
                      if (labAnalysis.kidneyStress > 50) labWarnings.push(`⚠ Почки ${labAnalysis.kidneyStress}% — контроль гидратации`);
                    }
                    return (
                    <div key={di} style={{ marginBottom: 6, background: 'var(--bg-secondary)', borderRadius: 6, padding: '6px 8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: 11 }}>{day.day}</span>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {(() => {
                            const hasSquat = day.exercises?.some((e: any) => e.exerciseId?.includes('squat') || e.name?.toLowerCase().includes('присед'));
                            const hasBench = day.exercises?.some((e: any) => e.exerciseId?.includes('bench') || e.name?.toLowerCase().includes('жим'));
                            const hasDead = day.exercises?.some((e: any) => e.exerciseId?.includes('deadlift') || e.name?.toLowerCase().includes('тяга'));
                            const focusTag = hasSquat ? 'Присед' : hasBench ? 'Жим' : hasDead ? 'Тяга' : '';
                            return focusTag ? <span style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 600 }}>{focusTag}</span> : null;
              })()}

              {/* Periodization phase info */}
              {(() => {
                const pp = getPhaseParams({
                  goal: goal === 'bulk' ? 'hypertrophy' : goal as any,
                  phase: cycleType === 'peaking' ? 'peaking' : cycleType === 'intensification' ? 'intensification' : cycleType === 'deload' ? 'deload' : 'accumulation',
                  analytics: { fatigue: fatigue / 10, recovery: recovery / 10, risk: 0 },
                });
                return (
                  <div className="card" style={{ marginBottom: 8, padding: '6px 10px', background: 'rgba(139,92,246,0.06)', borderLeft: '3px solid #8b5cf6' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#8b5cf6', marginBottom: 2 }}>
                      🔄 Фаза: {cycleType === 'peaking' ? 'Пик' : cycleType === 'intensification' ? 'Интенсификация' : cycleType === 'deload' ? 'Разгрузка' : 'Накопление'}
                    </div>
                    <div style={{ display: 'flex', gap: 10, fontSize: 9, color: 'var(--text-dim)' }}>
                      <span>Объём: <b>{pp.volumeLevel}</b></span>
                      <span>Интенсивность: <b>{pp.intensityLevel}</b></span>
                      <span>Частота: <b>{pp.frequencyLevel}</b></span>
                      <span>Приоритет: <b>{pp.priority}</b></span>
                    </div>
                  </div>
                );
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
                      {labWarnings.length > 0 && labWarnings.map((w, wi) => (
                        <div key={wi} style={{ fontSize: 9, color: '#ef4444', marginBottom: 3, background: 'rgba(239,68,68,0.08)', padding: '2px 6px', borderRadius: 3 }}>
                          {w}
                        </div>
                      ))}
                      <div style={{ fontSize: 8, color: 'var(--text-dim)', marginBottom: 3, padding: '1px 4px', background: 'rgba(255,165,2,0.05)', borderRadius: 3 }}>
                        🍎 {goal === 'bulk' ? 'Профицит 5-10%, белок 1.8-2.2 г/кг, углеводы вокруг тренировки.' : goal === 'cut' ? 'Дефицит 10-20%, белок 2.0-2.4 г/кг, углеводы до/после тренировки.' : goal === 'strength' ? 'Поддерживайте калории около TDEE и держите углеводы перед тяжёлыми подходами.' : 'Калории около TDEE, белок 1.8-2.2 г/кг, стабильный режим питания.'}
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
                        const roleLabel = role === 'main' ? 'ОСН' : role === 'secondary' ? 'ДОП' : 'АКС';
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
                          {substitute && <span style={{ fontSize: 6, color: 'var(--text-dim)', maxWidth: 50, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={``}>↔{substitute.name.slice(0, 8)}</span>}
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
                         {PHASE_HINTS[currentMicrocycle.mesocycleType] || 'Следуйте заданным подходам, повторам и RIR.'}
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
                      <div key="week-summary" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 4, fontSize: 10 }}>
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
                  <div key="cooldown" className="card" style={{ padding: '8px 10px', border: '1px solid rgba(59,130,246,0.2)' }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: '#3b82f6', marginBottom: 4 }}>🧊 Заминка</div>
                    {cooldown.map((b, bi) => (
                      <div key={bi} style={{ fontSize: 10, marginBottom: 2, color: 'var(--text-dim)' }}>
                        <span style={{ fontWeight: 600, color: '#3b82f6' }}>
                          {b.type === 'breathing' ? 'Дыхание' : b.type === 'stretch' ? 'Растяжка' : 'Заминка'} ({b.durationSec}с)
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
                      <div key="intensity-zones">
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
                  {goal === 'bulk' ? 'За 60-120 минут до тренировки: углеводы + белок. После: белок 30-40 г и углеводы по аппетиту.' :
                   goal === 'cut' ? 'Перед тренировкой оставьте часть дневных углеводов. После тренировки держите белок и не превышайте дефицит.' :
                   goal === 'strength' ? 'Перед тяжёлой сессией добавьте быстрые углеводы и соль; после восстановите жидкость и белок.' :
                   'Держите стабильный белок и распределяйте углеводы вокруг самых тяжёлых тренировок.'}
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
                  <div key="strength-balance" className="card" style={{ padding: '8px 10px', border: '1px solid rgba(139,92,246,0.2)' }}>
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
                const riskLabel = riskScore >= 5 ? '🚨 Высокий риск перегрузки' : riskScore >= 3 ? '⚠️ Умеренный риск' : riskScore >= 1 ? '⚡ Повышенная нагрузка' : '';
                if (!riskLabel) return null;
                return (
                  <div key="overtraining-risk" className="card" style={{ padding: '6px 10px', border: `1px solid ${riskScore >= 5 ? 'rgba(239,68,68,0.3)' : 'rgba(255,145,0,0.3)'}`, background: riskScore >= 5 ? 'rgba(239,68,68,0.05)' : 'rgba(255,145,0,0.05)' }}>
                    <div style={{ fontSize: 10, color: riskScore >= 5 ? '#ef4444' : '#ff9100', fontWeight: 600 }}>
                      {riskLabel} — {riskScore >= 5 ? 'снизьте объём и добавьте отдых' : riskScore >= 3 ? 'контролируйте сон, стресс и RPE' : 'следите за восстановлением'}
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
                Интенсивность: {currentMicrocycle.days.filter((d: any) => d.isTraining)[runtimeDay]?.intensity || 'средняя'} | Схема: {(currentMicrocycle as any).mesocycleType || ''}
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
      )}

      {/* ═══════════ EXERCISES TAB ═══════════ */}
      {tab === 'exercises' && (
        <div style={{ display: 'flex', gap: 8, flexDirection: selectedEx ? 'row' : 'column', flexWrap: 'wrap' }}>
          <div style={{ flex: selectedEx ? '0 0 280px' : 1, maxHeight: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column' }}>
            <input type="text" value={exSearch} onChange={e => setExSearch(e.target.value)}
              placeholder=""
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
                <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>{selectedEx.type === 'compound' ? 'Базовое' : 'Изолирующее'}</span>
                <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(249,115,22,0.1)', color: '#f97316' }}>{EQUIP_LABELS[selectedEx.equipment] || selectedEx.equipment}</span>
                <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: selectedEx.jointStress === 'high' ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', color: selectedEx.jointStress === 'high' ? '#ef4444' : '#22c55e' }}>Суставы: {JOINT_LABELS[selectedEx.jointStress] || selectedEx.jointStress}</span>
                <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(139,92,246,0.1)', color: '#8b5cf6' }}>Усталость: {selectedEx.fatigueCost}/10</span>
                {selectedEx.difficulty && (
                  <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: selectedEx.difficulty === 'advanced' ? 'rgba(239,68,68,0.1)' : selectedEx.difficulty === 'intermediate' ? 'rgba(249,115,22,0.1)' : 'rgba(34,197,94,0.1)', color: selectedEx.difficulty === 'advanced' ? '#ef4444' : selectedEx.difficulty === 'intermediate' ? '#f97316' : '#22c55e' }}>
                    {selectedEx.difficulty === 'advanced' ? 'Продвинутое' : selectedEx.difficulty === 'intermediate' ? 'Среднее' : 'Начальное'}
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
              {(() => { const bio = getExerciseBio(selectedEx.id); if (!bio) return null; const js = bio.jointStress; const strs = Object.entries(js||{}).map(([k,v])=>`${k} ${v}/10`); return <div key="exercise-bio" style={{ marginBottom: 6, background: 'rgba(59,130,246,0.05)', borderRadius: 6, padding: '5px 8px', fontSize: 9 }}>
                <span style={{ fontWeight: 600, color: '#3b82f6' }}>🔬 Биомеханика:</span> Суставы: {strs.join(', ')} | Сложность: {bio.difficulty}/10 | ЦНС: {bio.cnsDemand || 5}/10
              </div>; })()}
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
          <div className="card" style={{ padding: '12px 14px', background:'rgba(20,22,30,0.35)', border:'1px solid var(--glass-border)', borderRadius:14 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 13, color:'var(--accent)' }}>📐 Калькулятор 1RM</h3>
            <div style={{ fontSize:9, color:'var(--text-dim)', marginBottom:10 }}>Вес × Повторения → 1ПМ</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom:3, display:'block' }}>Вес (кг)</label>
                <input type="number" value={calcWeight || ''} onChange={e => setCalcWeight(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom:3, display:'block' }}>Повторения</label>
                <input type="number" value={calcReps || ''} onChange={e => setCalcReps(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              <div style={{ background: 'rgba(0,230,138,0.1)', borderRadius: 12, padding: 10, textAlign: 'center', border:'1px solid rgba(0,230,138,0.15)' }}>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Epley</div>
                <div style={{ fontSize: 20, fontWeight: 800, background:'linear-gradient(135deg, #00e68a, #00c853)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>{calcResults.epley1RM.toFixed(1)}</div>
                <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>кг</div>
              </div>
              <div style={{ background: 'rgba(59,130,246,0.1)', borderRadius: 12, padding: 10, textAlign: 'center', border:'1px solid rgba(59,130,246,0.15)' }}>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Brzycki</div>
                <div style={{ fontSize: 20, fontWeight: 800, background:'linear-gradient(135deg, #3b82f6, #60a5fa)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>{calcResults.brzycki1RM.toFixed(1)}</div>
                <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>кг</div>
              </div>
              <div style={{ background: 'rgba(139,92,246,0.1)', borderRadius: 12, padding: 10, textAlign: 'center', border:'1px solid rgba(139,92,246,0.15)' }}>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Среднее</div>
                <div style={{ fontSize: 20, fontWeight: 800, background:'linear-gradient(135deg, #8b5cf6, #a855f7)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>{((calcResults.epley1RM + calcResults.brzycki1RM) / 2).toFixed(1)}</div>
                <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>кг</div>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '10px 12px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>📊 RPE ↔ %1RM</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Вес (кг)</label>
                <input type="number" value={calcWeight} onChange={e => setCalcWeight(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Повторения</label>
                <input type="number" value={calcReps} onChange={e => setCalcReps(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>RPE (1-10)</label>
                <input type="number" min={1} max={10} value={calcRPE} onChange={e => setCalcRPE(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
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
                <input type="number" value={calc1RM} onChange={e => setCalc1RM(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>% от 1RM</label>
                <input type="number" min={30} max={100} value={calcPercent} onChange={e => setCalcPercent(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
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
                { k: plSquat, s: setPlSquat, l: 'Присед' },
                { k: plBench, s: setPlBench, l: 'Жим' },
                { k: plDeadlift, s: setPlDeadlift, l: 'Тяга' },
                { k: plWeight, s: setPlWeight, l: 'Вес тела' },
              ].map(f => (
                <div key={f.l}>
                  <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>{f.l}</label>
                  <input type="number" value={f.k} onChange={e => f.s(parseFloat(e.target.value) || 0)}
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
                    }}>{s === 'male' ? 'Мужской' : 'Женский'}</button>
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
          <StrengthLevelCard />

          {/* ═══ BMI ═══ */}
          <div className="card" style={{ padding: '10px 12px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>⚖️ Индекс массы тела (BMI)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Вес (кг)</label>
                <input type="number" value={bmiWeight} onChange={e => setBmiWeight(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Рост (см)</label>
                <input type="number" value={bmiHeight} onChange={e => setBmiHeight(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
            </div>
            <button onClick={calcBMI} style={{ width: '100%', padding: 6, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 11, marginBottom: 8 }}>Рассчитать</button>
            {bmiResult !== null && (
              <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>{bmiResult.toFixed(1)}</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{bmiCategory(bmiResult)}</div>
              </div>
            )}
          </div>

          {/* ═══ BMR Mifflin-St Jeor ═══ */}
          <div className="card" style={{ padding: '10px 12px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>🔥 BMR (Миффлин-Сан Жеор)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Вес (кг)</label>
                <input type="number" value={bmrWeight} onChange={e => setBmrWeight(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Рост (см)</label>
                <input type="number" value={bmrHeight} onChange={e => setBmrHeight(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Возраст</label>
                <input type="number" value={bmrAge} onChange={e => setBmrAge(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Пол</label>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['male', 'female'] as const).map(s => (
                    <button key={s} onClick={() => setBmrSex(s)} style={{
                      flex: 1, padding: '6px 4px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                      background: bmrSex === s ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)',
                      border: bmrSex === s ? '1px solid var(--accent)' : '1px solid var(--border)',
                      color: bmrSex === s ? '#00e68a' : 'var(--text-dim)', fontWeight: bmrSex === s ? 700 : 400,
                    }}>{s === 'male' ? 'Мужской' : 'Женский'}</button>
                  ))}
                </div>
              </div>
            </div>
            <button onClick={calcBMR} style={{ width: '100%', padding: 6, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 11, marginBottom: 8 }}>Рассчитать</button>
            {bmrResult !== null && (
              <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>{bmrResult.toFixed(0)}</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>ккал/день</div>
              </div>
            )}
          </div>

          {/* ═══ BMR Katch-McArdle ═══ */}
          <div className="card" style={{ padding: '10px 12px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>🔥 BMR (Кэтч-Мкардл)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Вес (кг)</label>
                <input type="number" value={bmrKmWeight} onChange={e => setBmrKmWeight(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>% жира</label>
                <input type="number" step="0.1" value={bmrKmBodyFat} onChange={e => setBmrKmBodyFat(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
            </div>
            <button onClick={calcBMR_KM} style={{ width: '100%', padding: 6, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 11, marginBottom: 8 }}>Рассчитать</button>
            {bmrKmResult !== null && (
              <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>{bmrKmResult.toFixed(0)}</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>ккал/день (LBM: {(bmrKmWeight * (100 - bmrKmBodyFat) / 100).toFixed(1)} кг)</div>
              </div>
            )}
          </div>

          {/* ═══ TDEE ═══ */}
          <div className="card" style={{ padding: '10px 12px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>⚡ TDEE</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>BMR (ккал)</label>
                <input type="number" value={tdeeBmr} onChange={e => setTdeeBmr(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>PAL</label>
                <select value={tdeePal} onChange={e => setTdeePal(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 4px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box' }}>
                  {PAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <button onClick={calcTDEE} style={{ width: '100%', padding: 6, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 11, marginBottom: 8 }}>Рассчитать</button>
            {tdeeResult !== null && (
              <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>{tdeeResult.toFixed(0)}</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>ккал/день</div>
              </div>
            )}
          </div>

          {/* ═══ Grip Strength ═══ */}
          <div className="card" style={{ padding: '10px 12px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>🤚 Сила хвата</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Сила (кг)</label>
                <input type="number" value={gripKg} onChange={e => setGripKg(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Пол</label>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['male', 'female'] as const).map(s => (
                    <button key={s} onClick={() => setGripSex(s)} style={{
                      flex: 1, padding: '6px 4px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                      background: gripSex === s ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)',
                      border: gripSex === s ? '1px solid var(--accent)' : '1px solid var(--border)',
                      color: gripSex === s ? '#00e68a' : 'var(--text-dim)', fontWeight: gripSex === s ? 700 : 400,
                    }}>{s === 'male' ? 'Мужской' : 'Женский'}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Возраст</label>
                <input type="number" value={gripAge} onChange={e => setGripAge(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
            </div>
            <button onClick={calcGrip} style={{ width: '100%', padding: 6, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 11, marginBottom: 8 }}>Оценить</button>
            {gripResult !== null && (
              <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>{gripResult.percentile}%</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{gripResult.level}</div>
              </div>
            )}
          </div>

          {/* ═══ Stress (HRV) ═══ */}
          <div className="card" style={{ padding: '10px 12px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>🧠 Стресс (HRV)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>RMSSD / HRV (мс)</label>
                <input type="number" value={hrvValue} onChange={e => setHrvValue(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
            </div>
            <button onClick={calcStress} style={{ width: '100%', padding: 6, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 11, marginBottom: 8 }}>Оценить</button>
            {stressResult !== null && (
              <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>{stressResult.stress}%</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{stressResult.level}</div>
              </div>
            )}
          </div>

          {/* ═══════ UNIFIED PROGRAM BUILDER ═══════ */}
          <div className="card" style={{ padding: '10px 12px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>🧬 Конструктор программы</h3>
            <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 8 }}>4 шага: параметры → сплит → упражнения → цикл</div>

            {/* Step indicators */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 10 }}>
              {[1,2,3,4].map(s => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div onClick={() => setBuilderStep(s)} style={{
                    width: 18, height: 18, borderRadius: '50%', cursor: 'pointer',
                    background: builderStep === s ? 'var(--accent)' : 'var(--bg-secondary)',
                    border: builderStep === s ? '2px solid var(--accent)' : '2px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 8, fontWeight: 700, color: builderStep === s ? '#000' : 'var(--text-dim)',
                  }}>{s}</div>
                  <span style={{ fontSize: 9, color: builderStep === s ? 'var(--text-light)' : 'var(--text-dim)', fontWeight: builderStep === s ? 600 : 400 }}>
                    {s === 1 ? 'Параметры' : s === 2 ? 'Сплит' : s === 3 ? 'Упражнения' : 'Цикл'}
                  </span>
                  {s < 4 && <span style={{ color: 'var(--text-dim)', fontSize: 8, marginLeft: 2 }}>→</span>}
                </div>
              ))}
            </div>

            {/* STEP 1: Параметры */}
            {builderStep === 1 && (<>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Цель</label>
                  <select value={goal} onChange={e => setGoal(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box' }}>
                    {GOALS.map(g => <option key={g.value} value={g.value}>{g.icon} {g.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Уровень</label>
                  <select value={level} onChange={e => setLevel(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box' }}>
                    {LEVELS.map(l => <option key={l.value} value={l.value}>{l.icon} {l.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Дней/нед</label>
                  <select value={daysPerWeek} onChange={e => setDaysPerWeek(parseInt(e.target.value))} style={{ width: '100%', padding: '6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box' }}>
                    {[2,3,4,5,6].map(d => <option key={d} value={d}>{d} дн/нед</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Длит. (недель)</label>
                  <input type="number" min={4} max={20} value={mesoLength} onChange={e => setMesoLength(parseInt(e.target.value) || 12)} style={{ width: '100%', padding: '6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box' }} />
                </div>
              </div>
              <button onClick={() => {
                const inp = { goal, level, daysPerWeek, recovery, fatigue, nutrition: 7, weakPoints, sessionDuration: 60, exercises: [] } as TrainingInput;
                const best = selectSplit(inp);
                setBuilderSplit(best[0] || null);
                const s = best[0];
                if (s) {
                  const dayKeys = Object.keys(TRAINING_SPLITS);
                  const matchKey = dayKeys.find(k => TRAINING_SPLITS[k].name === s.name);
                  const sp = matchKey ? TRAINING_SPLITS[matchKey] : null;
                  const exByDay: Record<number, any[]> = {};
                  if (sp) {
                    const totalDays = Math.min(sp.groupsPerDay.length, daysPerWeek);
                    const cycle: string[][] = [];
                    while (cycle.length < daysPerWeek) {
                      for (const g of sp.groupsPerDay) { cycle.push(g); if (cycle.length >= daysPerWeek) break; }
                    }
                    cycle.forEach((groups, di) => {
                      const dayExs: any[] = [];
                      groups.forEach(g => {
                        const catalogExs = getExercisesByGroup(g);
                        const chosen = catalogExs.slice(0, g === 'core' ? 2 : g === 'arms' ? 2 : 3);
                        chosen.forEach((ex, i) => {
                          const presc = calcExercisePrescription(ex, goal, level, g === (weakPoints[0] || ''), false, i === 0 ? 1 : 0.9);
                          dayExs.push({ name: ex.name, sets: presc.sets, reps: presc.reps, rir: presc.rir, rest: presc.rest, group: g });
                        });
                      });
                      exByDay[di] = dayExs;
                    });
                  }
                  setBuilderDayExercises(exByDay);
                }
                setBuilderStep(2);
              }} style={{ width: '100%', padding: 8, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 12 }}>Далее: Подобрать сплит</button>
            </>)}

            {/* STEP 2: Сплит */}
            {builderStep === 2 && (<>
              {builderSplit ? (
                <div style={{ background: 'rgba(0,230,138,0.06)', borderRadius: 8, padding: 10, marginBottom: 8, border: '1px solid rgba(0,230,138,0.12)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>🏆 {builderSplit.name}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-light)', marginTop: 3 }}>{builderSplit.desc}</div>
                  <div style={{ fontSize: 9, color: 'var(--accent)', marginTop: 3 }}>Score: {((builderSplit.score || 0) * 100).toFixed(0)}%</div>
                  {builderSplit.rationale && <div style={{ fontSize: 8, color: 'var(--text-dim)', marginTop: 3 }}>{builderSplit.rationale.join(' · ')}</div>}
                </div>
              ) : (
                <div style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', padding: 20 }}>Вернитесь на шаг 1 для подбора сплита</div>
              )}
              {(() => {
                const inp = { goal, level, daysPerWeek, recovery, fatigue, nutrition: 7, weakPoints, sessionDuration: 60, exercises: [] } as TrainingInput;
                const topSplits = getSplitOptions(inp);
                const top10 = topSplits.slice(0, 10);
                const rest = topSplits.slice(10);
                return (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-light)', marginBottom: 4 }}>Топ-10 сплитов</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 200, overflowY: 'auto', marginBottom: 4 }}>
                      {top10.map((s, i) => (
                        <div key={i} onClick={() => { setBuilderSplit(s); setSplitType(s.id || 'auto'); }} style={{ padding: '4px 8px', borderRadius: 6, cursor: 'pointer', background: builderSplit?.name === s.name ? 'rgba(0,230,138,0.08)' : 'var(--bg-secondary)', border: builderSplit?.name === s.name ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-light)' }}>{s.name}</span>
                            <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--accent)' }}>{(s.score * 100).toFixed(0)}%</span>
                          </div>
                          <div style={{ fontSize: 7, color: 'var(--text-dim)', marginTop: 1 }}>{s.desc}{s.rationale ? ' · ' + s.rationale.slice(0, 3).join(' | ') : ''}</div>
                        </div>
                      ))}
                    </div>
                    {rest.length > 0 && (
                      <details>
                        <summary style={{ fontSize: 9, fontWeight: 600, color: 'var(--accent)', cursor: 'pointer' }}>Показать все сплиты ({topSplits.length})</summary>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4, maxHeight: 160, overflowY: 'auto' }}>
                          {rest.map((s, i) => (
                            <div key={i} onClick={() => { setBuilderSplit(s); setSplitType(s.id || 'auto'); }} style={{ padding: '4px 8px', borderRadius: 6, cursor: 'pointer', background: builderSplit?.name === s.name ? 'rgba(0,230,138,0.08)' : 'var(--bg-secondary)', border: builderSplit?.name === s.name ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-light)' }}>{s.name}</span>
                                <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--accent)' }}>{(s.score * 100).toFixed(0)}%</span>
                              </div>
                              <div style={{ fontSize: 7, color: 'var(--text-dim)', marginTop: 1 }}>{s.desc}</div>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                );
              })()}
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setBuilderStep(1)} style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', background: 'var(--bg-secondary)', color: 'var(--text-dim)', fontSize: 12 }}>← Назад</button>
                <button onClick={() => setBuilderStep(3)} style={{ flex: 1, padding: 8, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 12 }}>Далее: Упражнения</button>
              </div>
            </>)}

            {/* STEP 3: Упражнения */}
            {builderStep === 3 && (<>
              <div style={{ maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                {Object.entries(builderDayExercises).sort(([a],[b]) => parseInt(a) - parseInt(b)).map(([dayKey, exs]) => (
                  <div key={dayKey} style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 8, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-light)', marginBottom: 6 }}>День {parseInt(dayKey) + 1}</div>
                    {exs.map((ex, ei) => (<div key={ei}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 6px', borderRadius: 4, marginBottom: 2, background: 'rgba(255,255,255,0.02)' }}>
                        <span style={{ fontSize: 10, fontWeight: 600, flex: 1 }}>{ex.name}</span>
                        <span style={{ fontSize: 9, color: 'var(--accent)' }}>{ex.sets}×{ex.reps}</span>
                        <span style={{ fontSize: 8, color: 'var(--text-dim)' }}>RIR{ex.rir}</span>
                        <button onClick={() => {
                          setBuilderShowSubs(builderShowSubs === `${dayKey}_${ei}` ? null : `${dayKey}_${ei}`);
                        }} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)', cursor: 'pointer', background: 'transparent', color: 'var(--text-dim)' }}>↔</button>
                        <button onClick={() => {
                          const subs = getExercisesByGroup(ex.group || '');
                          if (subs.length > 0) {
                            const alt = subs[0];
                            const newExs = { ...builderDayExercises };
                            const name = alt.name || alt.id;
                            newExs[parseInt(dayKey)] = newExs[parseInt(dayKey)].map((e, j) => j === ei ? { ...e, name } : e);
                            setBuilderDayExercises(newExs);
                          }
                        }} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)', cursor: 'pointer', background: 'transparent', color: 'var(--accent)' }}>↻</button>
                        <button onClick={() => {
                          const newExs = { ...builderDayExercises };
                          newExs[parseInt(dayKey)] = newExs[parseInt(dayKey)].filter((_, j) => j !== ei);
                          setBuilderDayExercises(newExs);
                        }} style={{ fontSize: 9, padding: '2px 4px', borderRadius: 4, border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer', background: 'transparent', color: '#ef4444' }}>✕</button>
                      </div>
                      {builderShowSubs === `${dayKey}_${ei}` && (<>
                        <div style={{ fontSize: 8, color: 'var(--text-dim)', marginLeft: 8, marginBottom: 2 }}>Альтернативы:</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginLeft: 8, marginBottom: 4 }}>
                          {getExercisesByGroup(ex.group || '').slice(0, 3).map((alt, ai: number) => {
                            const altName = alt.name || alt.id;
                            return (
                              <button key={ai} onClick={() => {
                                const newExs = { ...builderDayExercises };
                                newExs[parseInt(dayKey)] = newExs[parseInt(dayKey)].map((e, j) => j === ei ? { ...e, name: altName } : e);
                                setBuilderDayExercises(newExs);
                                setBuilderShowSubs(null);
                              }} style={{ fontSize: 8, padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)', cursor: 'pointer', background: 'rgba(0,230,138,0.06)', color: 'var(--text-dim)' }}>
                                {altName}
                              </button>
                            );
                          })}
                        </div>
                      </>)}
                    </div>))}
                    <button onClick={() => { setBuilderAddExDay(builderAddExDay === parseInt(dayKey) ? null : parseInt(dayKey)); }} style={{ marginTop: 4, fontSize: 9, padding: '3px 8px', borderRadius: 4, border: '1px dashed rgba(0,230,138,0.3)', cursor: 'pointer', background: 'transparent', color: 'var(--accent)' }}>+ Добавить упражнение</button>
                    {builderAddExDay === parseInt(dayKey) && (
                      <div style={{ marginTop: 4, maxHeight: 150, overflowY: 'auto' }}>
                        {EXERCISE_CATALOG.slice(0, 25).map((catEx, ci) => (
                          <div key={ci} onClick={() => {
                            const newExs = { ...builderDayExercises };
                            const presc = calcExercisePrescription(catEx, goal, level, false, false, 1);
                            newExs[parseInt(dayKey)] = [...(newExs[parseInt(dayKey)] || []), { name: catEx.name, sets: presc.sets, reps: presc.reps, rir: presc.rir, rest: presc.rest, group: catEx.group }];
                            setBuilderDayExercises(newExs);
                            setBuilderAddExDay(null);
                          }} style={{ fontSize: 9, padding: '3px 6px', cursor: 'pointer', borderRadius: 4, marginBottom: 1, background: 'rgba(255,255,255,0.02)' }}>
                            {catEx.name} <span style={{ color: 'var(--accent)', fontSize: 7 }}>{catEx.group}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setBuilderStep(2)} style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', background: 'var(--bg-secondary)', color: 'var(--text-dim)', fontSize: 12 }}>← Назад</button>
                <button onClick={() => {
                  const plan = generateWeeklyPlan({ goal, level, daysPerWeek, recovery, fatigue, nutrition: 7, weakPoints, sessionDuration: 60, exercises: [] } as TrainingInput, mesoLength || 8);
                  setBuilderMacroResult(plan);
                  setBuilderStep(4);
                }} style={{ flex: 1, padding: 8, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 12 }}>Далее: Цикл</button>
              </div>
            </>)}

            {/* STEP 4: Цикл */}
            {builderStep === 4 && (<>
              {builderMacroResult ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 6 }}>
                    <div style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: 6, textAlign: 'center' }}>
                      <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>Недель</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)' }}>{builderMacroResult.length}</div>
                    </div>
                    <div style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: 6, textAlign: 'center' }}>
                      <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>Прогрессия</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-light)' }}>{selectProgressionRule(level).name}</div>
                      <div style={{ fontSize: 7, color: 'var(--text-dim)' }}>+{selectProgressionRule(level).weeklyWeightIncrement}кг/нед</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 200, overflowY: 'auto', marginBottom: 8 }}>
                    {builderMacroResult.map((w: any, i: number) => {
                      const phaseColors: Record<string, string> = { base: '#3b82f6', build: '#f59e0b', peak: '#ef4444', deload: '#22c55e' };
                      const col = phaseColors[w.phase] || '#888';
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', borderRadius: 4, background: 'var(--bg-secondary)' }}>
                          <span style={{ fontSize: 9, fontWeight: 700, width: 20, textAlign: 'center' }}>Н{w.weekNumber}</span>
                          <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: col + '22', color: col, fontWeight: 600, whiteSpace: 'nowrap' }}>{w.phaseName}</span>
                          <span style={{ fontSize: 8, color: 'var(--text-dim)' }}>RIR {w.rir}</span>
                          <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>Vol: {typeof w.volumePerGroup === 'number' ? w.volumePerGroup : JSON.stringify(w.volumePerGroup)}</span>
                          {w.deloadWeek && <span style={{ fontSize: 7, color: '#22c55e', fontWeight: 600 }}>Deload</span>}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', padding: 20 }}>Цикл не сгенерирован. Вернитесь на шаг 3.</div>
              )}
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <button onClick={() => setBuilderStep(3)} style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', background: 'var(--bg-secondary)', color: 'var(--text-dim)', fontSize: 12 }}>← Назад</button>
              </div>
              <button onClick={() => {
                try {
                  const prog = {
                    name: builderSplit?.name || 'Моя программа',
                    goal, level, daysPerWeek, mesoLength,
                    split: builderSplit,
                    exercises: builderDayExercises,
                    macrocycle: builderMacroResult,
                    createdAt: new Date().toISOString(),
                  };
                  const existing = JSON.parse(localStorage.getItem('customPrograms') || '[]');
                  existing.push(prog);
                  localStorage.setItem('customPrograms', JSON.stringify(existing));
                  localStorage.setItem('activeProgram', JSON.stringify(prog));
                  alert('✅ Программа сохранена!');
                } catch {}
              }} style={{ width: '100%', padding: 10, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 12 }}>
                📋 Сохранить программу
              </button>
            </>)}
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
                <input type="number" value={logWeight} onChange={e => setLogWeight(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 4px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>Повторения</label>
                <input type="number" value={logReps} onChange={e => setLogReps(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 4px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>RIR</label>
                <input type="number" min={0} max={5} value={logRIR} onChange={e => setLogRIR(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 4px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
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
                      title={``}>
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
            <button onClick={() => generatePlan()} style={{
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
                      <div key={wi} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }} title={``}
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
                        {PHASE_LABELS[mc.type] || 'Рабочая фаза'} — Мезоцикл {mi + 1}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{mc.weeks} нед (нед {mc.weekStart + 1}–{mc.weekStart + mc.weeks})</span>
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 4 }}>
                      {PHASE_HINTS[mc.type] || 'Стабильная рабочая фаза с контролем объёма, интенсивности и восстановления.'}
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
                {macrocycle?.mesocycles?.map((mc, mi) => {
                  const firstMicro = mc.microcycles?.[0];
                  const vol = firstMicro?.volumeMultiplier || 1;
                  const rirLo = firstMicro?.rirRange?.[0] ?? 1;
                  const rirHi = firstMicro?.rirRange?.[1] ?? 3;
                  const rpe = firstMicro?.rpeTarget || 7;
                  return (
                    <div key={mi} style={{ marginBottom: 4, padding: '4px 6px', background: 'var(--bg-secondary)', borderRadius: 4, fontSize: 10 }}>
                      <span style={{ fontWeight: 600 }}>
                        {PHASE_LABELS[mc.type] || mc.type || 'Фаза'} — Мезо {mi + 1}
                      </span>
                      <span style={{ color: 'var(--text-dim)', marginLeft: 6 }}>
                        Объём: {vol}× | RIR: {rirLo}-{rirHi} | RPE: {rpe} | {mc.weeks} нед
                      </span>
                    </div>
                  );
                })}
                {!macrocycle && (
                  <div style={{ fontSize: 9, color: 'var(--text-dim)', textAlign: 'center', padding: 8 }}>Сгенерируйте макроцикл для отображения параметров</div>
                )}
              </div>
            </>
          )}
          </div>
        )}
      {/* ═══════════ HISTORY TAB ═══════════ */}
      {tab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="card" style={{ padding: '10px 12px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>📜 История тренировок</h3>
            {diaryProgress.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-dim)' }}>
                Нет записей. Начните вести дневник на вкладке 📓 Дневник.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[...diaryProgress].sort((a, b) => b.week - a.week).map((w, wi) => (
                  <div key={wi} style={{
                    background: 'var(--bg-secondary)', borderRadius: 8, padding: '8px 10px',
                    border: historyExpanded === `w${wi}` ? '1px solid var(--accent)' : '1px solid transparent',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                      onClick={() => setHistoryExpanded(historyExpanded === `w${wi}` ? null : `w${wi}`)}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>Неделя {w.week}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 8 }}>{w.workoutCount} тренировок</span>
                      </div>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        {(() => {
                          const sorted = [...diaryProgress].sort((a, b) => b.week - a.week);
                          const prev = sorted[wi + 1];
                          const delta = prev ? Math.round((w.totalVolume - prev.totalVolume) / Math.max(1, prev.totalVolume) * 100) : 0;
                          const arrow = prev ? (delta > 5 ? '↑' : delta < -5 ? '↓' : '→') : '';
                          const arrColor = delta > 5 ? '#22c55e' : delta < -5 ? '#ef4444' : '#6b7280';
                          return arrow ? <span style={{ fontSize: 13, color: arrColor, fontWeight: 700, minWidth: 16 }}>{arrow}</span> : null;
                        })()}
                        <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>{Math.round(w.totalVolume).toLocaleString()} кг</span>
                        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                          {w.compoundWorkouts > 0 ? `${w.compoundWorkouts} базовых` : 'без базовых'}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{historyExpanded === `w${wi}` ? '▴' : '▾'}</span>
                      </div>
                    </div>
                    {historyExpanded === `w${wi}` && (
                      <div style={{ marginTop: 6, borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginBottom: 6, fontSize: 9 }}>
                          <div style={{ background: 'rgba(0,230,138,0.05)', borderRadius: 4, padding: 4, textAlign: 'center' }}>
                            <div style={{ color: 'var(--text-dim)' }}>Объём</div>
                            <div style={{ fontWeight: 600, color: 'var(--accent)' }}>{Math.round(w.totalVolume)} кг</div>
                          </div>
                          <div style={{ background: 'rgba(0,230,138,0.05)', borderRadius: 4, padding: 4, textAlign: 'center' }}>
                            <div style={{ color: 'var(--text-dim)' }}>Тренировок</div>
                            <div style={{ fontWeight: 600, color: 'var(--accent)' }}>{w.workoutCount}</div>
                          </div>
                          <div style={{ background: 'rgba(0,230,138,0.05)', borderRadius: 4, padding: 4, textAlign: 'center' }}>
                            <div style={{ color: 'var(--text-dim)' }}>1RM ср.</div>
                            <div style={{ fontWeight: 600, color: 'var(--accent)' }}>{Math.round(w.total1RM)} кг</div>
                          </div>
                        </div>
                        {diaryStats.filter(s => s.workoutCount > 0 && s.lastWorkoutDate >= `2020-01-01`).slice(0, 5).map(s => (
                          <div key={s.exerciseId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '2px 0', borderBottom: '1px solid var(--border)' }}>
                            <span>{s.exerciseName}</span>
                            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{s.maxWeight}×{s.maxReps}</span>
                            <span style={{ color: 'var(--text-dim)' }}>1RM {Math.round(s.max1RM)} кг</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {/* ═══════════ ANALYTICS TAB ═══════════ */}
      {tab === 'analytics' && <><AnalyticsTab sessions={historyWorkouts} /><StructuredAnalyticsCard sessions={historyWorkouts} /></>}
      {tab === 'methods' && <MethodsTab />}
      {tab === 'visual' && <VisualTab sessions={historyWorkouts} />}
      {tab === 'programs' && <ProgramsTab />}
      {tab === 'timers' && <TimersTab />}
      {tab === 'progress' && <ProgressTab historyWorkouts={historyWorkouts} />}

      {/* ═══════════ MY TRAINING TAB ═══════════ */}
      {tab === 'mytraining' && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <MyTrainingTab customExercises={customExercises} setCustomExercises={setCustomExercises} goal={goal} level={level} daysPerWeek={daysPerWeek} mesoLength={mesoLength} />
        </div>
      )}
    </div>
      )}
    </div>
  );
};

const MyTrainingTab: React.FC<{ customExercises: { name: string; sets: number; reps: number; rir: number }[]; setCustomExercises: React.Dispatch<React.SetStateAction<{ name: string; sets: number; reps: number; rir: number }[]>>; goal?: string; level?: string; daysPerWeek?: number; mesoLength?: number }> = ({ customExercises, setCustomExercises, goal = 'bulk', level = 'intermediate', daysPerWeek = 4, mesoLength = 6 }) => {
  const [newExName, setNewExName] = useState('');
  const [newExSets, setNewExSets] = useState(3);
  const [newExReps, setNewExReps] = useState(10);
  const [newExRir, setNewExRir] = useState(2);
  const [savedPlans, setSavedPlans] = useState<{ id: string; name: string; date: string; exercises: { name: string; sets: number; reps: number; rir: number }[] }[]>(() => { try { return JSON.parse(localStorage.getItem('myTrainingPlans') || '[]'); } catch { return []; } });
  const [planName, setPlanName] = useState('');
  const [savedCycles, setSavedCycles] = useState<{ id: string; name: string; date: string; weeks: number; goal: string; level: string; days: number }[]>(() => { try { return JSON.parse(localStorage.getItem('myTrainingCycles') || '[]'); } catch { return []; } });
  const [cycleName, setCycleName] = useState('');
  const [subTab, setSubTab] = useState<'exercises'|'plans'|'cycles'>('exercises');

  const addExercise = () => {
    if (!newExName.trim()) return;
    setCustomExercises(prev => [...prev, { name: newExName.trim(), sets: newExSets, reps: newExReps, rir: newExRir }]);
    setNewExName('');
  };

  const savePlan = () => {
    if (customExercises.length === 0) return;
    const plan = { id: 'plan_' + Date.now(), name: planName || 'План ' + new Date().toLocaleDateString('ru'), date: new Date().toISOString(), exercises: [...customExercises] };
    const updated = [...savedPlans, plan];
    setSavedPlans(updated);
    localStorage.setItem('myTrainingPlans', JSON.stringify(updated));
    setPlanName('');
  };

  const deletePlan = (id: string) => {
    const updated = savedPlans.filter(p => p.id !== id);
    setSavedPlans(updated);
    localStorage.setItem('myTrainingPlans', JSON.stringify(updated));
  };

  const loadPlan = (plan: { exercises: { name: string; sets: number; reps: number; rir: number }[] }) => {
    setCustomExercises(plan.exercises);
  };

  const saveCycle = () => {
    const cycle = { id: 'cycle_' + Date.now(), name: cycleName || 'Цикл ' + new Date().toLocaleDateString('ru'), date: new Date().toISOString(), weeks: mesoLength, goal, level, days: daysPerWeek };
    const updated = [...savedCycles, cycle];
    setSavedCycles(updated);
    localStorage.setItem('myTrainingCycles', JSON.stringify(updated));
    setCycleName('');
  };

  const deleteCycle = (id: string) => {
    const updated = savedCycles.filter(c => c.id !== id);
    setSavedCycles(updated);
    localStorage.setItem('myTrainingCycles', JSON.stringify(updated));
  };

  const groupOptions = [...new Set(EXERCISE_DB.map(e => e.group || '').filter(Boolean))].sort();

  return (
    <div>
      <div style={{fontSize:14,fontWeight:700,color:'var(--accent)',marginBottom:4}}>⭐ Моя тренировка</div>
      <div style={{fontSize:9,color:'var(--text-dim)',marginBottom:8}}>Пользовательские упражнения, планы и циклы</div>

      <div style={{display:'flex',gap:4,marginBottom:8}}>
        {(['exercises','plans','cycles'] as const).map(t => (
          <button key={t} onClick={()=>setSubTab(t)} style={{padding:'6px 12px',borderRadius:8,fontSize:10,fontWeight:600,cursor:'pointer',background:subTab===t?'var(--accent)':'var(--bg-secondary)',color:subTab===t?'#000':'var(--text-dim)',border:subTab===t?'1px solid var(--accent)':'1px solid var(--border)'}}>
            {t==='exercises'?'🏋️ Упражнения':t==='plans'?'📋 Планы':'🔄 Циклы'}
          </button>
        ))}
      </div>

      {subTab === 'exercises' ? (
        <div>
          <div className="card" style={{padding:10,marginBottom:8}}>
            <h4 style={{margin:'0 0 6px',fontSize:12}}>➕ Добавить упражнение</h4>
            <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr',gap:4,marginBottom:6}}>
              <input value={newExName} onChange={e=>setNewExName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addExercise()} placeholder="Название упражнения" style={{padding:'6px 8px',borderRadius:6,border:'1px solid var(--border)',background:'var(--bg-secondary)',color:'var(--text)',fontSize:11,boxSizing:'border-box'}} />
              <input type="number" value={newExSets} onChange={e=>setNewExSets(parseFloat(e.target.value) || 0)} placeholder="Подходы" style={{padding:'6px 8px',borderRadius:6,border:'1px solid var(--border)',background:'var(--bg-secondary)',color:'var(--text)',fontSize:11,boxSizing:'border-box'}} />
              <input type="number" value={newExReps} onChange={e=>setNewExReps(parseFloat(e.target.value) || 0)} placeholder="Повторы" style={{padding:'6px 8px',borderRadius:6,border:'1px solid var(--border)',background:'var(--bg-secondary)',color:'var(--text)',fontSize:11,boxSizing:'border-box'}} />
              <input type="number" value={newExRir} onChange={e=>setNewExRir(parseFloat(e.target.value) || 0)} placeholder="RIR" style={{padding:'6px 8px',borderRadius:6,border:'1px solid var(--border)',background:'var(--bg-secondary)',color:'var(--text)',fontSize:11,boxSizing:'border-box'}} />
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:3,marginBottom:6}}>
              {groupOptions.slice(0,12).map(g=><button key={g} onClick={()=>setNewExName(g+' → ')} style={{padding:'2px 6px',borderRadius:4,fontSize:7,cursor:'pointer',background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text-dim)'}}>{g}</button>)}
            </div>
            <button onClick={addExercise} style={{width:'100%',padding:6,borderRadius:6,border:'none',cursor:'pointer',background:'var(--accent)',color:'#000',fontWeight:600,fontSize:11}}>Добавить</button>
          </div>

          {customExercises.length > 0 ? (
            <div className="card" style={{padding:10,marginBottom:8}}>
              <h4 style={{margin:'0 0 6px',fontSize:12}}>📝 Мои упражнения ({customExercises.length})</h4>
              <div style={{display:'flex',flexDirection:'column',gap:4}}>
                {customExercises.map((ex,i) => (
                  <div key={i} style={{display:'flex',alignItems:'center',gap:6,padding:'4px 8px',borderRadius:6,background:'var(--bg-secondary)',border:'1px solid var(--border)'}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:10,fontWeight:600,color:'var(--text-light)'}}>{ex.name}</div>
                      <div style={{fontSize:8,color:'var(--text-dim)'}}>{ex.sets}×{ex.reps} @ RIR {ex.rir}</div>
                    </div>
                    <button onClick={()=>setCustomExercises(prev=>prev.filter((_,j)=>j!==i))} style={{padding:'2px 6px',borderRadius:4,border:'1px solid rgba(239,68,68,0.2)',background:'rgba(239,68,68,0.08)',color:'#f87171',fontSize:9,cursor:'pointer'}}>✕</button>
                  </div>
                ))}
              </div>
              <div style={{display:'flex',gap:4,marginTop:6}}>
                <input value={planName} onChange={e=>setPlanName(e.target.value)} placeholder="Название плана..." style={{flex:1,padding:'6px 8px',borderRadius:6,border:'1px solid var(--border)',background:'var(--bg-secondary)',color:'var(--text)',fontSize:10,boxSizing:'border-box'}} />
                <button onClick={savePlan} style={{padding:'6px 12px',borderRadius:6,border:'none',cursor:'pointer',background:'var(--accent)',color:'#000',fontWeight:600,fontSize:10}}>💾 Сохранить план</button>
                <button onClick={()=>setCustomExercises([])} style={{padding:'6px 12px',borderRadius:6,border:'1px solid rgba(239,68,68,0.2)',background:'rgba(239,68,68,0.08)',color:'#f87171',fontSize:10,cursor:'pointer'}}>Очистить</button>
              </div>
            </div>
          ) : null}
        </div>
      ) : subTab === 'plans' ? (
        <div>
          {savedPlans.length === 0 && <div className="card" style={{padding:20,textAlign:'center',color:'var(--text-dim)',fontSize:11}}>Нет сохранённых планов</div>}
          {savedPlans.map(plan => (
            <div key={plan.id} className="card" style={{padding:10,marginBottom:6}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:'var(--text-light)'}}>{plan.name}</div>
                  <div style={{fontSize:8,color:'var(--text-dim)'}}>{new Date(plan.date).toLocaleDateString('ru')} · {plan.exercises.length} упр.</div>
                </div>
                <div style={{display:'flex',gap:4}}>
                  <button onClick={()=>loadPlan(plan)} style={{padding:'3px 8px',borderRadius:4,border:'1px solid rgba(0,230,138,0.2)',background:'rgba(0,230,138,0.08)',color:'var(--accent)',fontSize:8,cursor:'pointer'}}>Загрузить</button>
                  <button onClick={()=>deletePlan(plan.id)} style={{padding:'3px 8px',borderRadius:4,border:'1px solid rgba(239,68,68,0.2)',background:'rgba(239,68,68,0.08)',color:'#f87171',fontSize:8,cursor:'pointer'}}>Удалить</button>
                </div>
              </div>
              <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
                {plan.exercises.map((ex,i) => (
                  <span key={i} style={{fontSize:7,padding:'2px 6px',borderRadius:4,background:'rgba(0,230,138,0.06)',border:'1px solid rgba(0,230,138,0.12)',color:'var(--text-light)'}}>{ex.name} {ex.sets}×{ex.reps}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div>
          <div className="card" style={{padding:10,marginBottom:8}}>
            <h4 style={{margin:'0 0 6px',fontSize:12}}>🔄 Новый цикл</h4>
            <div style={{display:'flex',gap:4,marginBottom:6}}>
              <input value={cycleName} onChange={e=>setCycleName(e.target.value)} placeholder="Название цикла..." style={{flex:1,padding:'6px 8px',borderRadius:6,border:'1px solid var(--border)',background:'var(--bg-secondary)',color:'var(--text)',fontSize:11,boxSizing:'border-box'}} />
              <button onClick={saveCycle} style={{padding:'6px 12px',borderRadius:6,border:'none',cursor:'pointer',background:'var(--accent)',color:'#000',fontWeight:600,fontSize:10}}>💾 Сохранить</button>
            </div>
            <div style={{fontSize:8,color:'var(--text-dim)'}}>Цикл создаётся на основе текущих настроек плана</div>
          </div>
          {savedCycles.length === 0 && <div className="card" style={{padding:20,textAlign:'center',color:'var(--text-dim)',fontSize:11}}>Нет сохранённых циклов</div>}
          {savedCycles.map(cycle => (
            <div key={cycle.id} className="card" style={{padding:10,marginBottom:6}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:'var(--text-light)'}}>{cycle.name}</div>
                  <div style={{fontSize:8,color:'var(--text-dim)'}}>{new Date(cycle.date).toLocaleDateString('ru')} · {cycle.weeks} нед · {cycle.days} д/н</div>
                </div>
                <button onClick={()=>deleteCycle(cycle.id)} style={{padding:'3px 8px',borderRadius:4,border:'1px solid rgba(239,68,68,0.2)',background:'rgba(239,68,68,0.08)',color:'#f87171',fontSize:8,cursor:'pointer'}}>Удалить</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const MethodsTab: React.FC = () => {
  const methods = React.useMemo(() => getTrainingMethods(), []);
  const volumes = React.useMemo(() => getVolumeReferences(), []);
  const visuals = React.useMemo(() => getSplitVisuals(), []);
  const [methodCat, setMethodCat] = React.useState('all');
  const filtered = methodCat === 'all' ? methods : getMethodsByCategory(methodCat);
  const cats = [...new Set(methods.map(m => m.category))];

  return (<div>
    <div style={{ display:'flex', gap:4, marginBottom:8, flexWrap:'wrap' }}>
      <button onClick={()=>setMethodCat('all')} style={{ padding:'4px 10px', borderRadius:6, fontSize:10, background: methodCat==='all'?'var(--accent)':'var(--bg-secondary)', color: methodCat==='all'?'#000':'var(--text-dim)', border:'none', cursor:'pointer' }}>Все</button>
      {cats.map(c => <button key={c} onClick={()=>setMethodCat(c)} style={{ padding:'4px 10px', borderRadius:6, fontSize:10, background: methodCat===c?'rgba(139,92,246,0.2)':'var(--bg-secondary)', border: methodCat===c?'1px solid #8b5cf6':'1px solid var(--border)', color: methodCat===c?'#8b5cf6':'var(--text-dim)', cursor:'pointer' }}>{c}</button>)}
    </div>
    {filtered.map((m,i) => <div key={i} className="card" style={{ marginBottom:6, padding:10 }}>
      <div style={{ fontWeight:600, fontSize:12 }}>{m.name} <span style={{ fontSize:9, color:'var(--text-dim)' }}>[{m.category}]</span></div>
      <div style={{ fontSize:9, color:'var(--text-light)', marginTop:2 }}>{m.description}</div>
      <div style={{ fontSize:8, color:'var(--text-dim)' }}>Лучше всего для: {m.bestFor}</div>
    </div>)}

    <h4 style={{ margin:'12px 0 8px', fontSize:12 }}>📊 Volume Landmarks (MEV/MAV/MRV)</h4>
    {volumes.map((v,i) => <div key={i} className="card" style={{ marginBottom:4, padding:8 }}>
      <div style={{ fontWeight:600, fontSize:11 }}>{v.muscle}</div>
      <div style={{ display:'flex', gap:6, fontSize:9, marginTop:2 }}>
        <span>Новичок: {v.beginner.mev}-{v.beginner.mav}-{v.beginner.mrv}</span>
        <span>Средний: {v.intermediate.mev}-{v.intermediate.mav}-{v.intermediate.mrv}</span>
        <span>Продв: {v.advanced.mev}-{v.advanced.mav}-{v.advanced.mrv}</span>
      </div>
    </div>)}

    <h4 style={{ margin:'12px 0 8px', fontSize:12 }}>📐 Визуализация сплитов</h4>
    {visuals.map((s,i) => <div key={i} className="card" style={{ marginBottom:4, padding:8 }}>
      <div style={{ fontWeight:600, fontSize:11 }}>{s.name}</div>
      <div style={{ fontSize:9, color:'var(--text-dim)' }}>{(s as any).schedule?.join(' | ') || s.name}</div>
    </div>)}
  </div>);
};

const VisualTab: React.FC<{ sessions: any[] }> = ({ sessions }) => {
  const vizSessions: VizSessionData[] = React.useMemo(() => sessions.map((s:any) => ({
    week: s.weekNumber || 1, date: s.date || '', exercises: (s.exercises || []).map((e:any) => ({
      name: e.exerciseName || e.name || '', sets: e.sets?.length || 0, reps: Math.max(...(e.sets||[{reps:0}]).map((st:any)=>st.reps||0), 0),
      weight: Math.max(...(e.sets||[{weight:0}]).map((st:any)=>st.weight||0), 0), rpe: 7, volume: e.totalVolume || 0,
    }))
  })), [sessions]);
  const dashboard = React.useMemo(() => sessions.length > 2 ? buildVisualDashboard(vizSessions) : null, [sessions, vizSessions]);
  const weekly = React.useMemo(() => computeWeeklyChart(vizSessions), [vizSessions]);
  const muscleVol = React.useMemo(() => computeMuscleVolume(vizSessions), [vizSessions]);
  const prog = React.useMemo(() => computeProgression(vizSessions), [vizSessions]);

  if (sessions.length < 2) return <div className="card" style={{ padding:20, textAlign:'center', color:'var(--text-dim)' }}>Нужно минимум 2 тренировки для визуализации</div>;

  return (<div>
    {dashboard && <div className="card" style={{ marginBottom:8, padding:10 }}>
      <h4 style={{ margin:'0 0 6px', fontSize:12 }}>📈 Недельный график</h4>
      <div style={{ display:'flex', alignItems:'flex-end', gap:2, height:100 }}>
        {weekly.map((w,i) => { const maxV = Math.max(...weekly.map(x=>x.volume),1); return <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center' }}>
          <div style={{ width:'100%', background:'rgba(0,230,138,0.3)', borderRadius:'2px 2px 0 0', height:`${Math.max(5, (w.volume/maxV)*100)}%` }} title={``} />
          <span style={{ fontSize:7, color:'var(--text-dim)', marginTop:2 }}>{w.week}</span>
        </div>})}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4, fontSize:9, marginTop:4 }}>
        <span>Пик объёма: <b>{(dashboard.summary as any).peakVolume || dashboard.summary.totalVolume}</b></span>
        <span>Средняя интенс.: <b>{dashboard.summary.avgIntensity}%</b></span>
        <span>Тренд: <b style={{color:(dashboard.summary as any).trend==='up'?'#22c55e':'#ef4444'}}>{(dashboard.summary as any).trend==='up'?'↑':'→'}</b></span>
      </div>
    </div>}

    <div className="card" style={{ marginBottom:8, padding:10 }}>
      <h4 style={{ margin:'0 0 6px', fontSize:12 }}>💪 Объём по группам мышц</h4>
      {muscleVol.map((mv,i) => <div key={i} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
        <span style={{ width:60, fontSize:9, color:'var(--text-dim)' }}>{mv.muscle}</span>
        <div style={{ flex:1, background:'rgba(255,255,255,0.06)', borderRadius:3, height:8, overflow:'hidden' }}>
          <div style={{ width:`${mv.percent}%`, height:'100%', background:'#3b82f6', borderRadius:3 }} />
        </div>
        <span style={{ fontSize:9, fontWeight:600 }}>{mv.percent}%</span>
      </div>)}
    </div>

    <div className="card" style={{ padding:10 }}>
      <h4 style={{ margin:'0 0 6px', fontSize:12 }}>📈 Прогрессия 1RM</h4>
      {prog.slice(0,5).map((p,i) => <div key={i} style={{ marginBottom:4 }}>
        <div style={{ fontWeight:600, fontSize:10 }}>{p.exercise}</div>
        <div style={{ display:'flex', gap:4, alignItems:'flex-end', height:30 }}>
          {p.weeks.map((w,wi) => { const max = Math.max(...p.weeks.map(x=>x.estimated1RM),1); return <div key={wi} style={{ flex:1, textAlign:'center' }}>
            <div style={{ width:'100%', background: w.estimated1RM > (p.weeks[wi-1]?.estimated1RM||0) ? '#22c55e' : '#ef4444', borderRadius:2, height:`${Math.max(3,(w.estimated1RM/max)*30)}%` }} />
            <span style={{ fontSize:6, color:'var(--text-dim)' }}>Н{w.week}</span>
          </div>})}
        </div>
      </div>)}
    </div>
  </div>);
};

// ── Analytics Tab Component ──
const AnalyticsTab: React.FC<{ sessions: WorkoutLog[] }> = ({ sessions }) => {
  const analytics = useMemo(() => {
    const mapped = sessions.map(w => ({
      sessionId: w.id,
      date: w.date,
      focus: w.split || 'fullbody',
      durationMin: w.duration || 60,
      sets: (w.exercises || []).flatMap((ex: any) =>
        (ex.sets || []).map((s: any, i: number) => ({
          exerciseId: ex.exerciseId || ex.name || 'unknown',
          exerciseName: ex.name || 'Exercise',
          reps: s.reps || 0,
          weight: s.weight || 0,
          rpe: s.rpe || 5,
          rir: s.rir || 3,
          date: w.date,
          setIndex: i,
        }))
      ),
    }));
    return computeAnalytics({ sessions: mapped, weeks: 4 });
  }, [sessions]);

  if (!analytics || sessions.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 30 }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
          Нет данных для аналитики. Запишите тренировки во вкладке «Дневник».
        </div>
      </div>
    );
  }

  const { volume, intensity, strength, fatigue, recovery } = analytics;

  return (
    <div>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
        <div className="card" style={{ padding: '8px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Объём/нед</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#00e68a' }}>{volume.weeklyVolumeKg.toLocaleString()} кг</div>
          <div style={{ fontSize: 9, color: volume.volumeTrend >= 0 ? '#22c55e' : '#ef4444' }}>
            {volume.volumeTrend >= 0 ? '↑' : '↓'} {Math.abs(volume.volumeTrend)}% vs пред.
          </div>
        </div>
        <div className="card" style={{ padding: '8px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Интенсивность</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#60a5fa' }}>{intensity.avgIntensity}%</div>
          <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>
            RPE avg: {intensity.avgRPE}
          </div>
        </div>
        <div className="card" style={{ padding: '8px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Усталость</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: fatigue.weeklyFatigue > 0.7 ? '#ef4444' : fatigue.weeklyFatigue > 0.4 ? '#f59e0b' : '#22c55e' }}>
            {Math.round(fatigue.weeklyFatigue * 100)}%
          </div>
        </div>
        <div className="card" style={{ padding: '8px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Готовность</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: recovery.readinessEstimate > 60 ? '#22c55e' : recovery.readinessEstimate > 40 ? '#f59e0b' : '#ef4444' }}>
            {recovery.readinessEstimate}%
          </div>
        </div>
      </div>

      {/* Intensity distribution */}
      <div className="card" style={{ marginBottom: 10, padding: '8px 10px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Распределение нагрузки</div>
        <div style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden', marginBottom: 4 }}>
          <div style={{ width: `${intensity.intensityDistribution.strength}%`, background: '#ef4444' }} title="" />
          <div style={{ width: `${intensity.intensityDistribution.hypertrophy}%`, background: '#f59e0b' }} title="" />
          <div style={{ width: `${intensity.intensityDistribution.endurance}%`, background: '#22c55e' }} title="" />
        </div>
        <div style={{ display: 'flex', gap: 10, fontSize: 9, color: 'var(--text-dim)' }}>
          <span>🔴 Сила {intensity.intensityDistribution.strength}%</span>
          <span>🟠 Гипертрофия {intensity.intensityDistribution.hypertrophy}%</span>
          <span>🟢 Выносливость {intensity.intensityDistribution.endurance}%</span>
        </div>
      </div>

      {/* Volume by group */}
      <div className="card" style={{ marginBottom: 10, padding: '8px 10px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Объём по группам мышц</div>
        {Object.entries(volume.volumeByGroup)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 8)
          .map(([group, vol]) => {
            const maxVol = Math.max(...Object.values(volume.volumeByGroup), 1);
            return (
              <div key={group} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <span style={{ width: 80, fontSize: 10, color: 'var(--text-dim)', textAlign: 'right' }}>{group}</span>
                <div style={{ flex: 1, height: 6, borderRadius: 4, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                  <div style={{ width: `${(vol / maxVol) * 100}%`, height: '100%', background: '#8b5cf6', borderRadius: 4 }} />
                </div>
                <span style={{ fontSize: 9, color: 'var(--text-dim)', width: 50 }}>{Math.round(vol).toLocaleString()} кг</span>
              </div>
            );
          })}
      </div>

      {/* Strength estimates */}
      {Object.keys(strength.estimated1RM).length > 0 && (
        <div className="card" style={{ marginBottom: 10, padding: '8px 10px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Расчётный 1RM</div>
          {Object.entries(strength.estimated1RM)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([exId, rm]) => {
              const trend = strength.strengthTrend[exId] || 0;
              return (
                <div key={exId} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 11 }}>
                  <span style={{ color: 'var(--text-dim)' }}>{exId}</span>
                  <span>
                    <strong>{rm} кг</strong>
                    <span style={{ marginLeft: 6, fontSize: 10, color: trend >= 0 ? '#22c55e' : '#ef4444' }}>
                      {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
                    </span>
                  </span>
                </div>
              );
            })}
        </div>
      )}

      {/* Fatigue details */}
      <div className="card" style={{ padding: '8px 10px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Метрики усталости</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, fontSize: 10 }}>
          <div>
            <span style={{ color: 'var(--text-dim)' }}>Монотонность: </span>
            <span style={{ fontWeight: 600, color: fatigue.monotony > 2 ? '#ef4444' : 'var(--accent)' }}>{fatigue.monotony}</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-dim)' }}>Напряжение: </span>
            <span style={{ fontWeight: 600, color: fatigue.strain > 300 ? '#ef4444' : 'var(--accent)' }}>{fatigue.strain}</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-dim)' }}>ЦНС: </span>
            <span style={{ fontWeight: 600, color: fatigue.cnsFatigue > 0.7 ? '#ef4444' : 'var(--accent)' }}>{Math.round(fatigue.cnsFatigue * 100)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const GOAL_FILTER_OPTIONS: { value: string; label: string; goal?: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'strength', label: 'Сила' },
  { value: 'hypertrophy', label: 'Масса' },
  { value: 'peaking', label: 'Сушка' },
  { value: 'women', label: 'Женские' },
  { value: 'custom', label: 'Авторские' },
];

const WOMENS_PROGRAMS: import('../../engines/complete-program-library.engine').FullProgram[] = [
  {
    id: 'women_glutes_hips', name: 'Ягодицы и бёдра (Женский)', author: 'Health Engine',
    type: 'Lower Body 4x/week', goal: 'hypertrophy', level: 'intermediate',
    durationWeeks: 8, daysPerWeek: 4, sessionTimeMin: '50-65',
    description: 'Специализированная программа для женщин с акцентом на ягодицы и бёдра. 4 дня в неделю: два нижних дня (тяжёлый и пампинг), один верхний лёгкий, один фулбоди.',
    targetAudience: 'Женщины со средним опытом тренировок, которые хотят акцентировать ягодицы и бёдра, сохраняя баланс верха.',
    equipmentNeeded: ['barbell', 'dumbbell', 'cable', 'band'],
    warnings: ['Прогрессируйте постепенно в hip thrust.', 'Следите за техникой в Bulgarian split squat.', 'Не пропускайте разминку тазобедренных суставов.'],
    expectedResults: 'Рост ягодичных мышц, улучшение формы бёдер, подтянутый верх тела.',
    progressionModel: 'Линейная: +2.5 кг/нед базовые упражнения, +1 повтор/нед изоляция.',
    deloadProtocol: 'Каждые 4 недели: снижение объёма на 40%, RPE 6-7.',
    customization: ['Заменить cable kickback на banded glute bridge при отсутствии блока.', 'Добавить abductor если отстаёт средняя ягодичная.', 'Заменить sumo deadlift на RDL при проблемах с поясницей.'],
    weeks: [{
      week: 1, phase: 'accumulation', volumeMultiplier: 1.0, intensityMultiplier: 1.0, deload: false,
      days: [
        { day: 1, name: 'День 1: Ягодицы (тяжёлый)', focus: 'Glutes + Hamstrings', warmup: 'Hip circles, glute activation band',
          exercises: [
            { name: 'Hip Thrust', sets: 5, reps: '8-12', rpe: 8, rir: 2, restSec: 120, notes: 'Прогрессия веса', progression: '+2.5 кг/нед' },
            { name: 'Bulgarian Split Squat', sets: 4, reps: '10-12', rpe: 7.5, rir: 2.5, restSec: 90, notes: 'На каждую ногу', progression: '+1 повтор/нед' },
            { name: 'Romanian Deadlift', sets: 4, reps: '10-12', rpe: 7.5, rir: 2.5, restSec: 90, notes: 'Контроль эксцентрики', progression: '+2.5 кг/нед' },
            { name: 'Cable Kickback', sets: 4, reps: '15', rpe: 7, rir: 3, restSec: 60, notes: 'Пиковое сокращение', progression: '+2.5 кг/нед' },
            { name: 'Abductor Machine', sets: 4, reps: '15-20', rpe: 7, rir: 3, restSec: 45, notes: 'Медленно, с задержкой', progression: '+5 кг/нед' },
            { name: 'Glute Bridge', sets: 3, reps: '15', rpe: 6, rir: 4, restSec: 45, notes: 'Завершающее', progression: 'Вес тела → резинка' },
          ], cooldown: 'Stretch hip flexors, hamstrings, glutes' },
        { day: 2, name: 'День 2: Верх (лёгкий)', focus: 'Upper Body Light', warmup: 'Arm circles, shoulder dislocators',
          exercises: [
            { name: 'Lat Pulldown', sets: 3, reps: '12', rpe: 7, rir: 3, restSec: 75, notes: 'Широкий хват', progression: '+2.5 кг/нед' },
            { name: 'Seated Cable Row', sets: 3, reps: '12', rpe: 7, rir: 3, restSec: 75, notes: 'V-образная рукоять', progression: '+2.5 кг/нед' },
            { name: 'Lateral Raise', sets: 4, reps: '15', rpe: 7, rir: 3, restSec: 60, notes: 'Лёгкий вес, много повторений', progression: '+1 кг/нед' },
            { name: 'Face Pull', sets: 3, reps: '15', rpe: 6.5, rir: 3.5, restSec: 60, notes: 'Здоровье плеч', progression: '+2.5 кг/нед' },
            { name: 'Tricep Pushdown', sets: 3, reps: '15', rpe: 7, rir: 3, restSec: 45, notes: 'Верёвка или прямая рукоять', progression: '+2.5 кг/нед' },
            { name: 'Bicep Curl', sets: 3, reps: '15', rpe: 7, rir: 3, restSec: 45, notes: 'Гантели или штанга', progression: '+1 кг/нед' },
          ], cooldown: 'Stretch chest, shoulders, triceps' },
        { day: 3, name: 'День 3: Ягодицы (пампинг)', focus: 'Glutes Pump', warmup: 'Banded glute activation, hip mobility',
          exercises: [
            { name: 'Hip Thrust (Heavy)', sets: 5, reps: '6-10', rpe: 8.5, rir: 1.5, restSec: 120, notes: 'Тяжелее дня 1', progression: '+2.5 кг/нед' },
            { name: 'Sumo Deadlift', sets: 4, reps: '8-10', rpe: 8, rir: 2, restSec: 120, notes: 'Широкая постановка', progression: '+5 кг/нед' },
            { name: 'Walking Lunge', sets: 4, reps: '12/leg', rpe: 7.5, rir: 2.5, restSec: 60, notes: 'Гантели в руках', progression: '+1 повтор/нед' },
            { name: 'Leg Press (High)', sets: 4, reps: '12', rpe: 7, rir: 3, restSec: 90, notes: 'Высокая постановка ног', progression: '+5 кг/нед' },
            { name: 'Cable Pull-Through', sets: 4, reps: '15', rpe: 7, rir: 3, restSec: 60, notes: 'Шарнир таза', progression: '+2.5 кг/нед' },
          ], cooldown: 'Stretch glutes, hamstrings, adductors' },
        { day: 4, name: 'День 4: Фулбоди', focus: 'Full Body Toning', warmup: 'Dynamic stretching, light cardio',
          exercises: [
            { name: 'Goblet Squat', sets: 3, reps: '12', rpe: 7, rir: 3, restSec: 75, notes: 'Гантель/гиря у груди', progression: '+2.5 кг/нед' },
            { name: 'Dumbbell Press', sets: 3, reps: '12', rpe: 7, rir: 3, restSec: 75, notes: 'Лёгкий жим на плечи/грудь', progression: '+1 кг/нед' },
            { name: 'Single Leg RDL', sets: 3, reps: '12', rpe: 7, rir: 3, restSec: 60, notes: 'Баланс + задняя цепь', progression: '+1 кг/нед' },
            { name: 'Banded Glute Bridge', sets: 4, reps: '20', rpe: 6, rir: 4, restSec: 45, notes: 'Пампинг', progression: 'Толще резинка' },
            { name: 'Plank', sets: 3, reps: '60s', rpe: 6, rir: 4, restSec: 45, notes: 'Удержание', progression: '+5 сек/нед' },
          ], cooldown: 'Full body stretch' },
      ],
    }],
  },
  {
    id: 'women_hourglass', name: 'Песочные часы (Женский)', author: 'Health Engine',
    type: 'Glutes + Shoulders 4x/week', goal: 'hypertrophy', level: 'intermediate',
    durationWeeks: 8, daysPerWeek: 4, sessionTimeMin: '50-60',
    description: 'Программа для создания пропорций "песочные часы": акцент на ягодицы и плечи для визуального сужения талии. 4 дня: тяжёлые ягодицы, плечи+спина, пампинг ягодиц, фулбоди тонинг.',
    targetAudience: 'Женщины, которые хотят визуально расширить плечи и ягодицы для пропорции песочных часов.',
    equipmentNeeded: ['barbell', 'dumbbell', 'cable', 'band'],
    warnings: ['Не перегружайте плечи — они получают объём и в день спины.', 'Следите за осанкой в жимах над головой.', 'Пампинг-день должен быть с коротким отдыхом.'],
    expectedResults: 'Визуальное расширение плечевого пояса и ягодиц, сужение талии за счёт пропорций.',
    progressionModel: 'Двойная: +2.5 кг базовые/нед, +1 повтор изоляция/нед.',
    deloadProtocol: 'Каждые 5 недель: снижение объёма на 50%, RPE 5-6.',
    customization: ['Заменить OHP на Arnold press при проблемах с плечами.', 'Добавить abductor в пампинг-день.', 'Заменить hip thrust на glute bridge при дискомфорте.'],
    weeks: [{
      week: 1, phase: 'accumulation', volumeMultiplier: 1.0, intensityMultiplier: 1.0, deload: false,
      days: [
        { day: 1, name: 'День 1: Ягодицы (тяжёлый)', focus: 'Glutes Heavy', warmup: 'Hip activation, glute bridges',
          exercises: [
            { name: 'Hip Thrust', sets: 5, reps: '6-10', rpe: 8.5, rir: 1.5, restSec: 120, notes: 'Основное движение', progression: '+2.5 кг/нед' },
            { name: 'Bulgarian Split Squat', sets: 4, reps: '8-10', rpe: 8, rir: 2, restSec: 90, notes: 'На каждую ногу', progression: '+2.5 кг/нед' },
            { name: 'Sumo Deadlift', sets: 4, reps: '8-10', rpe: 8, rir: 2, restSec: 120, notes: 'Широкая стойка', progression: '+5 кг/нед' },
            { name: 'Leg Press (High)', sets: 4, reps: '10-12', rpe: 7.5, rir: 2.5, restSec: 90, notes: 'Высокие ноги', progression: '+5 кг/нед' },
            { name: 'Cable Kickback', sets: 3, reps: '15', rpe: 7, rir: 3, restSec: 60, notes: 'Пик сокращения', progression: '+2.5 кг/нед' },
          ], cooldown: 'Stretch glutes, hip flexors, hamstrings' },
        { day: 2, name: 'День 2: Плечи + спина', focus: 'Shoulders + Back', warmup: 'Arm circles, band pull-aparts',
          exercises: [
            { name: 'Overhead Press', sets: 4, reps: '8-10', rpe: 8, rir: 2, restSec: 90, notes: 'Штанга или гантели', progression: '+2.5 кг/нед' },
            { name: 'Lateral Raise', sets: 5, reps: '12-15', rpe: 7.5, rir: 2.5, restSec: 60, notes: 'Много объёма', progression: '+1 повтор/нед' },
            { name: 'Lat Pulldown', sets: 4, reps: '10-12', rpe: 7.5, rir: 2.5, restSec: 75, notes: 'Широкий хват', progression: '+2.5 кг/нед' },
            { name: 'Face Pull', sets: 4, reps: '15', rpe: 7, rir: 3, restSec: 60, notes: 'Задняя дельта + здоровье', progression: '+2.5 кг/нед' },
            { name: 'Seated Cable Row', sets: 3, reps: '12', rpe: 7, rir: 3, restSec: 75, notes: 'Толщина спины', progression: '+2.5 кг/нед' },
            { name: 'Rear Delt Fly', sets: 3, reps: '15', rpe: 6.5, rir: 3.5, restSec: 60, notes: 'Лёгкий вес', progression: '+1 кг/нед' },
          ], cooldown: 'Stretch shoulders, lats, traps' },
        { day: 3, name: 'День 3: Ягодицы (пампинг)', focus: 'Glutes Pump', warmup: 'Banded activation, hip mobility',
          exercises: [
            { name: 'Hip Thrust', sets: 4, reps: '12-15', rpe: 7, rir: 3, restSec: 60, notes: 'Пампинг-вес', progression: '+2.5 кг/нед' },
            { name: 'Abductor Machine', sets: 5, reps: '15-20', rpe: 7, rir: 3, restSec: 45, notes: 'Много объёма', progression: '+5 кг/нед' },
            { name: 'Cable Pull-Through', sets: 4, reps: '15', rpe: 7, rir: 3, restSec: 60, notes: 'Шарнир', progression: '+2.5 кг/нед' },
            { name: 'Banded Glute Bridge', sets: 4, reps: '20', rpe: 6, rir: 4, restSec: 30, notes: 'Пампинг до жжения', progression: 'Толще резинка' },
            { name: 'Step-Up', sets: 3, reps: '12', rpe: 7, rir: 3, restSec: 60, notes: 'На каждую ногу', progression: '+2.5 кг/нед' },
          ], cooldown: 'Stretch glutes, adductors, calves' },
        { day: 4, name: 'День 4: Фулбоди тонинг', focus: 'Full Body Toning', warmup: 'Dynamic stretching, light cardio',
          exercises: [
            { name: 'Goblet Squat', sets: 3, reps: '12', rpe: 7, rir: 3, restSec: 75, notes: 'Гантель/гиря', progression: '+2.5 кг/нед' },
            { name: 'Dumbbell Press', sets: 3, reps: '12', rpe: 7, rir: 3, restSec: 75, notes: 'Верх тела', progression: '+1 кг/нед' },
            { name: 'Romanian Deadlift', sets: 3, reps: '12', rpe: 7, rir: 3, restSec: 90, notes: 'Лёгкий вес', progression: '+2.5 кг/нед' },
            { name: 'Plank', sets: 3, reps: '60s', rpe: 6, rir: 4, restSec: 45, notes: 'Кор', progression: '+5 сек/нед' },
            { name: 'Bird Dog', sets: 3, reps: '10/side', rpe: 5, rir: 5, restSec: 30, notes: 'Стабильность кора', progression: '' },
          ], cooldown: 'Full body stretch' },
      ],
    }],
  },
  {
    id: 'women_start', name: 'Старт (Женский, начинающие)', author: 'Health Engine',
    type: 'Full Body 3x/week', goal: 'hypertrophy', level: 'beginner',
    durationWeeks: 6, daysPerWeek: 3, sessionTimeMin: '40-50',
    description: 'Программа для начинающих женщин. 3 тренировки в неделю на всё тело. Простые, безопасные упражнения с акцентом на технику и привыкание к нагрузкам.',
    targetAudience: 'Женщины, которые только начинают заниматься в зале (0-3 месяца опыта).',
    equipmentNeeded: ['dumbbell', 'cable', 'band'],
    warnings: ['Начинайте с малых весов — техника важнее.', 'Если чувствуете боль в пояснице в RDL — уменьшите вес.', 'Не стесняйтесь использовать тренажёры для привыкания.'],
    expectedResults: 'Освоение базовых движений, тонус мышц, привычка к режиму 3 раза в неделю.',
    progressionModel: 'Линейная: +2.5 кг/нед верх, +5 кг/нед низ (первые 6 недель).',
    deloadProtocol: 'Неделя 6: снижение объёма на 30%, работа над техникой.',
    customization: ['Заменить DB Press на Smith Machine Press для уверенности.', 'Добавить cardio 10-15 мин после тренировки.', 'Заменить plank на dead bug при дискомфорте в пояснице.'],
    weeks: [{
      week: 1, phase: 'accumulation', volumeMultiplier: 1.0, intensityMultiplier: 1.0, deload: false,
      days: [
        { day: 1, name: 'День 1: Фулбоди', focus: 'Full Body', warmup: 'Light cardio 5 min, dynamic stretching',
          exercises: [
            { name: 'Goblet Squat', sets: 3, reps: '12', rpe: 6, rir: 4, restSec: 90, notes: 'Техника в приоритете', progression: '+2.5 кг/нед' },
            { name: 'Dumbbell Press', sets: 3, reps: '12', rpe: 6, rir: 4, restSec: 75, notes: 'Гантели или Smith', progression: '+1 кг/нед' },
            { name: 'Lat Pulldown', sets: 3, reps: '12', rpe: 6, rir: 4, restSec: 75, notes: 'Широкий хват', progression: '+2.5 кг/нед' },
            { name: 'Romanian Deadlift', sets: 3, reps: '12', rpe: 6, rir: 4, restSec: 90, notes: 'Лёгкий вес, шарнир', progression: '+2.5 кг/нед' },
            { name: 'Hip Thrust', sets: 3, reps: '15', rpe: 6, rir: 4, restSec: 75, notes: 'Техника тазового моста', progression: '+2.5 кг/нед' },
            { name: 'Plank', sets: 3, reps: '30s', rpe: 5, rir: 5, restSec: 45, notes: 'Удержание', progression: '+5 сек/нед' },
          ], cooldown: 'Full body stretch 5 min' },
        { day: 2, name: 'День 2: Фулбоди', focus: 'Full Body', warmup: 'Light cardio 5 min, dynamic stretching',
          exercises: [
            { name: 'Goblet Squat', sets: 3, reps: '12', rpe: 6.5, rir: 3.5, restSec: 90, notes: '+2.5 кг от дня 1', progression: '+2.5 кг/нед' },
            { name: 'Dumbbell Press', sets: 3, reps: '12', rpe: 6.5, rir: 3.5, restSec: 75, notes: 'Повторение дня 1', progression: '+1 кг/нед' },
            { name: 'Lat Pulldown', sets: 3, reps: '12', rpe: 6.5, rir: 3.5, restSec: 75, notes: 'Узкий хват (вариант)', progression: '+2.5 кг/нед' },
            { name: 'Romanian Deadlift', sets: 3, reps: '12', rpe: 6.5, rir: 3.5, restSec: 90, notes: 'Техника', progression: '+2.5 кг/нед' },
            { name: 'Hip Thrust', sets: 3, reps: '15', rpe: 6, rir: 4, restSec: 75, notes: 'На полу', progression: '+2.5 кг/нед' },
            { name: 'Plank', sets: 3, reps: '30s', rpe: 5, rir: 5, restSec: 45, notes: 'Кор', progression: '+5 сек/нед' },
          ], cooldown: 'Full body stretch 5 min' },
        { day: 3, name: 'День 3: Фулбоди', focus: 'Full Body', warmup: 'Light cardio 5 min, dynamic stretching',
          exercises: [
            { name: 'Goblet Squat', sets: 3, reps: '12', rpe: 7, rir: 3, restSec: 90, notes: 'Немного тяжелее', progression: '+2.5 кг/нед' },
            { name: 'Dumbbell Press', sets: 3, reps: '12', rpe: 7, rir: 3, restSec: 75, notes: 'Увереннее вес', progression: '+1 кг/нед' },
            { name: 'Lat Pulldown', sets: 3, reps: '12', rpe: 7, rir: 3, restSec: 75, notes: 'Обратный хват', progression: '+2.5 кг/нед' },
            { name: 'Romanian Deadlift', sets: 3, reps: '12', rpe: 7, rir: 3, restSec: 90, notes: 'Контроль эксцентрики', progression: '+2.5 кг/нед' },
            { name: 'Hip Thrust', sets: 3, reps: '15', rpe: 7, rir: 3, restSec: 75, notes: 'Скамья вариант', progression: '+2.5 кг/нед' },
            { name: 'Plank', sets: 3, reps: '30s', rpe: 6, rir: 4, restSec: 45, notes: 'Боковая планка опционально', progression: '+5 сек/нед' },
          ], cooldown: 'Full body stretch 5 min' },
      ],
    }],
  },
];

const CUSTOM_PROGRAMS: import('../../engines/complete-program-library.engine').FullProgram[] = [
  {
    id: 'split_8day_advanced', name: '8-дневный сплит (Продвинутый)', author: 'Health Engine',
    type: '8-Day Rotating Split', goal: 'hypertrophy', level: 'advanced',
    durationWeeks: 8, daysPerWeek: 8, sessionTimeMin: '60-75',
    description: 'Продвинутый 8-дневный сплит с чередованием тяжёлых и пампинговых тренировок. Дни: квадрицепс тяжёлый, грудь пампинг, спина тяжёлая, кардио/восстановление, бицепс бедра тяжёлый, грудь тяжёлая, спина пампинг, полный отдых. Каждая мышечная группа прорабатывается дважды за цикл с разной интенсивностью.',
    targetAudience: 'Продвинутые атлеты (2+ года опыта), использующие фармакологическую поддержку.',
    equipmentNeeded: ['barbell', 'dumbbell', 'cable', 'machine', 'rack', 'bench'],
    warnings: ['Только для опытных атлетов.', 'Строго соблюдайте дни отдыха.', 'При признаках перетренированности — добавьте день восстановления.', 'Контролируйте объём: не более 20-25 рабочих подходов за тренировку.'],
    expectedResults: 'Максимальная гипертрофия при достаточном восстановлении. Специализация на отстающих группах через двойную частоту.',
    progressionModel: 'Волновая: тяжёлые дни +2.5 кг/цикл, пампинг-дни +1 повтор/цикл.',
    deloadProtocol: 'После 2 полных циклов (16 дней): снижение объёма на 50%, RPE 5-6, активное восстановление.',
    customization: ['Менять порядок дней под свой график.', 'Заменять кардио-день на активное восстановление (йога, плавание).', 'Регулировать RIR в тяжёлых днях: 1-2 для базы, 2-3 для изоляции.'],
    weeks: [{
      week: 1, phase: 'accumulation', volumeMultiplier: 1.0, intensityMultiplier: 1.0, deload: false,
      days: [
        { day: 1, name: 'Д1: Квадрицепс Heavy + бицепс бедра', focus: 'Quadriceps Heavy + Hamstrings', warmup: 'Leg extensions (ramp-up), light squats',
          exercises: [
            { name: 'Barbell Squat', sets: 4, reps: '5-8', rpe: 8.5, rir: 1.5, restSec: 180, notes: 'Основное движение', progression: '+2.5 кг/цикл' },
            { name: 'Leg Press', sets: 4, reps: '8-10', rpe: 8, rir: 2, restSec: 120, notes: 'Высокая постановка', progression: '+5 кг/цикл' },
            { name: 'Leg Extension', sets: 3, reps: '12', rpe: 7.5, rir: 2.5, restSec: 75, notes: 'Пиковое сокращение', progression: '+2.5 кг/цикл' },
            { name: 'Romanian Deadlift', sets: 4, reps: '8-10', rpe: 8, rir: 2, restSec: 120, notes: 'Бицепс бедра', progression: '+2.5 кг/цикл' },
            { name: 'Lying Leg Curl', sets: 3, reps: '12', rpe: 7.5, rir: 2.5, restSec: 75, notes: 'Изоляция', progression: '+2.5 кг/цикл' },
            { name: 'Standing Calf Raise', sets: 4, reps: '15', rpe: 7, rir: 3, restSec: 60, notes: 'Икры', progression: '+5 кг/цикл' },
          ], cooldown: 'Stretch quads, hamstrings, calves' },
        { day: 2, name: 'Д2: Грудь Pump + дельта + трицепс', focus: 'Chest Pump + Delts + Triceps', warmup: 'Cable fly light, band pull-aparts',
          exercises: [
            { name: 'Incline Dumbbell Press', sets: 4, reps: '12-15', rpe: 7.5, rir: 2.5, restSec: 75, notes: 'Пампинг-вес', progression: '+1 повтор/цикл' },
            { name: 'Pec Deck Fly', sets: 4, reps: '15', rpe: 7, rir: 3, restSec: 60, notes: 'Растяжка + сокращение', progression: '+2.5 кг/цикл' },
            { name: 'Cable Crossover', sets: 3, reps: '15', rpe: 7, rir: 3, restSec: 45, notes: 'Нижний/средний/верхний блок', progression: '+2.5 кг/цикл' },
            { name: 'Lateral Raise', sets: 4, reps: '15-20', rpe: 7.5, rir: 2.5, restSec: 60, notes: 'Много объёма', progression: '+1 повтор/цикл' },
            { name: 'Overhead Tricep Extension', sets: 3, reps: '12-15', rpe: 7.5, rir: 2.5, restSec: 60, notes: 'Длинная головка', progression: '+2.5 кг/цикл' },
            { name: 'Tricep Pushdown', sets: 3, reps: '15', rpe: 7, rir: 3, restSec: 45, notes: 'Верёвка', progression: '+2.5 кг/цикл' },
          ], cooldown: 'Stretch chest, shoulders, triceps' },
        { day: 3, name: 'Д3: Спина Heavy + задняя дельта + бицепс', focus: 'Back Heavy + Rear Delts + Biceps', warmup: 'Lat pulldown ramp-up, band pull-aparts',
          exercises: [
            { name: 'Deadlift', sets: 3, reps: '3-5', rpe: 9, rir: 1, restSec: 240, notes: 'Тяжёлая работа', progression: '+5 кг/цикл' },
            { name: 'Barbell Row', sets: 4, reps: '6-8', rpe: 8.5, rir: 1.5, restSec: 150, notes: 'Строгий торс', progression: '+2.5 кг/цикл' },
            { name: 'Weighted Pull-Up', sets: 4, reps: '5-8', rpe: 8.5, rir: 1.5, restSec: 120, notes: 'С доп. весом', progression: '+1.25 кг/цикл' },
            { name: 'T-Bar Row', sets: 3, reps: '8-10', rpe: 8, rir: 2, restSec: 120, notes: 'Толщина спины', progression: '+2.5 кг/цикл' },
            { name: 'Rear Delt Fly', sets: 4, reps: '12-15', rpe: 7.5, rir: 2.5, restSec: 60, notes: 'Задняя дельта', progression: '+1 кг/цикл' },
            { name: 'Barbell Curl', sets: 3, reps: '8-10', rpe: 8, rir: 2, restSec: 75, notes: 'Бицепс тяжёлый', progression: '+2.5 кг/цикл' },
            { name: 'Hammer Curl', sets: 3, reps: '12', rpe: 7.5, rir: 2.5, restSec: 60, notes: 'Брахиалис', progression: '+1 кг/цикл' },
          ], cooldown: 'Stretch back, rear delts, biceps' },
        { day: 4, name: 'Д4: Кардио/Восстановление', focus: 'Cardio / Recovery', warmup: 'Light dynamic stretching',
          exercises: [
            { name: 'LISS Cardio', sets: 1, reps: '30-40 min', rpe: 4, rir: 6, restSec: 0, notes: 'Пульс 120-140 уд/мин', progression: '' },
            { name: 'Stretching / Mobility', sets: 1, reps: '15-20 min', rpe: 3, rir: 7, restSec: 0, notes: 'Растяжка всего тела', progression: '' },
            { name: 'Foam Rolling', sets: 1, reps: '10-15 min', rpe: 3, rir: 7, restSec: 0, notes: 'МФР проблемных зон', progression: '' },
          ], cooldown: 'Deep breathing, meditation optional' },
        { day: 5, name: 'Д5: Бицепс бедра Heavy + квадрицепс', focus: 'Hamstrings Heavy + Quadriceps', warmup: 'Lying leg curl ramp-up, leg extensions light',
          exercises: [
            { name: 'Stiff-Leg Deadlift', sets: 4, reps: '6-8', rpe: 8.5, rir: 1.5, restSec: 180, notes: 'Основное движение', progression: '+2.5 кг/цикл' },
            { name: 'Lying Leg Curl', sets: 4, reps: '8-10', rpe: 8.5, rir: 1.5, restSec: 90, notes: 'Тяжёлая изоляция', progression: '+2.5 кг/цикл' },
            { name: 'Glute-Ham Raise', sets: 3, reps: '6-10', rpe: 8, rir: 2, restSec: 120, notes: 'Вес тела или резинка', progression: '+1 повтор/цикл' },
            { name: 'Hack Squat', sets: 4, reps: '8-10', rpe: 8, rir: 2, restSec: 120, notes: 'Квадрицепс', progression: '+5 кг/цикл' },
            { name: 'Walking Lunge', sets: 3, reps: '12/leg', rpe: 7.5, rir: 2.5, restSec: 90, notes: 'Добивка', progression: '+1 повтор/цикл' },
            { name: 'Seated Calf Raise', sets: 4, reps: '12-15', rpe: 7.5, rir: 2.5, restSec: 60, notes: 'Икры', progression: '+5 кг/цикл' },
          ], cooldown: 'Stretch hamstrings, quads, glutes' },
        { day: 6, name: 'Д6: Грудь Heavy + дельта + трицепс', focus: 'Chest Heavy + Delts + Triceps', warmup: 'Bench ramp-up, band shoulder warmup',
          exercises: [
            { name: 'Barbell Bench Press', sets: 4, reps: '5-8', rpe: 8.5, rir: 1.5, restSec: 180, notes: 'Основное движение', progression: '+2.5 кг/цикл' },
            { name: 'Incline Barbell Press', sets: 4, reps: '6-8', rpe: 8.5, rir: 1.5, restSec: 150, notes: 'Верх груди', progression: '+2.5 кг/цикл' },
            { name: 'Weighted Dip', sets: 3, reps: '6-10', rpe: 8, rir: 2, restSec: 120, notes: 'С доп. весом', progression: '+2.5 кг/цикл' },
            { name: 'Overhead Press', sets: 4, reps: '6-8', rpe: 8, rir: 2, restSec: 120, notes: 'Дельта тяжёлая', progression: '+2.5 кг/цикл' },
            { name: 'Close-Grip Bench Press', sets: 3, reps: '8-10', rpe: 8, rir: 2, restSec: 90, notes: 'Трицепс тяжёлый', progression: '+2.5 кг/цикл' },
            { name: 'Skull Crusher', sets: 3, reps: '10-12', rpe: 7.5, rir: 2.5, restSec: 75, notes: 'Длинная головка', progression: '+2.5 кг/цикл' },
          ], cooldown: 'Stretch chest, shoulders, triceps' },
        { day: 7, name: 'Д7: Спина Pump + задняя дельта + бицепс', focus: 'Back Pump + Rear Delts + Biceps', warmup: 'Straight-arm pulldown light, face pulls',
          exercises: [
            { name: 'Lat Pulldown', sets: 4, reps: '12-15', rpe: 7.5, rir: 2.5, restSec: 75, notes: 'Пампинг-вес, разный хват', progression: '+1 повтор/цикл' },
            { name: 'Seated Cable Row', sets: 4, reps: '12-15', rpe: 7.5, rir: 2.5, restSec: 75, notes: 'V-рукоять', progression: '+2.5 кг/цикл' },
            { name: 'Straight-Arm Pulldown', sets: 3, reps: '15', rpe: 7, rir: 3, restSec: 60, notes: 'Широчайшие', progression: '+2.5 кг/цикл' },
            { name: 'Face Pull', sets: 4, reps: '15-20', rpe: 7, rir: 3, restSec: 60, notes: 'Задняя дельта + здоровье плеч', progression: '+2.5 кг/цикл' },
            { name: 'Machine Row', sets: 3, reps: '12-15', rpe: 7, rir: 3, restSec: 75, notes: 'Изоляция', progression: '+5 кг/цикл' },
            { name: 'Preacher Curl', sets: 3, reps: '12-15', rpe: 7.5, rir: 2.5, restSec: 60, notes: 'Бицепс пампинг', progression: '+1 кг/цикл' },
            { name: 'Concentration Curl', sets: 3, reps: '15', rpe: 7, rir: 3, restSec: 45, notes: 'Пик бицепса', progression: '+1 кг/цикл' },
          ], cooldown: 'Stretch back, rear delts, biceps' },
        { day: 8, name: 'Д8: Полный отдых', focus: 'Full Rest', warmup: '',
          exercises: [
            { name: 'Полный отдых', sets: 0, reps: '0', rpe: 0, rir: 0, restSec: 0, notes: 'Восстановление, сон, питание', progression: '' },
          ], cooldown: '' },
      ],
    }],
  },
];

const PROGRAM_LEVEL_MAP: Record<string, string> = {
  novice: 'Новичок', beginner: 'Начинающий', intermediate: 'Средний', advanced: 'Продвинутый', elite: 'Элитный', enhanced: 'Enhanced',
};
const PROGRAM_GOAL_MAP: Record<string, string> = {
  strength: 'Сила', hypertrophy: 'Масса', peaking: 'Сушка', powerlifting: 'Пауэрлифтинг', bodybuilding: 'Бодибилдинг', general: 'Общее', mass: 'Масса', conditioning: 'Кондиция', weightloss: 'Похудение',
};
const PROGRAM_EQUIP_MAP: Record<string, string> = {
  barbell: 'Штанга', dumbbell: 'Гантели', machine: 'Тренажёр', cable: 'Блок', bodyweight: 'Вес тела', bench: 'Скамья', rack: 'Стойка', kettlebell: 'Гиря', band: 'Резинка',
};

const ProgramsTab: React.FC = () => {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [goalFilter, setGoalFilter] = React.useState('all');
  const [detailWeek, setDetailWeek] = React.useState(1);

  const allPrograms = React.useMemo(() => [...FULL_PROGRAM_LIBRARY, ...WOMENS_PROGRAMS, ...CUSTOM_PROGRAMS], []);
  const programs = React.useMemo(() => {
    if (goalFilter === 'all') return allPrograms;
    if (goalFilter === 'women') return WOMENS_PROGRAMS;
    if (goalFilter === 'custom') return CUSTOM_PROGRAMS;
    return allPrograms.filter(p => p.goal === goalFilter);
  }, [goalFilter, allPrograms]);
  const selected = selectedId ? allPrograms.find(p => p.id === selectedId) || null : null;

  const handleLoadProgram = () => {
    if (!selected) return;
    try {
      const prog = {
        id: selected.id, name: selected.name, goal: selected.goal, level: selected.level,
        daysPerWeek: selected.daysPerWeek, durationWeeks: selected.durationWeeks,
        description: selected.description, weeks: selected.weeks,
        loadedAt: new Date().toISOString(),
      };
      localStorage.setItem('activeProgram', JSON.stringify(prog));
      alert('✅ Программа загружена! Перейдите на вкладку "План" для генерации.');
    } catch {}
  };

  return (<div>
    <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
      {GOAL_FILTER_OPTIONS.map(g => (
        <button key={g.value} onClick={() => { setGoalFilter(g.value); setSelectedId(null); }}
          style={{
            padding: '6px 14px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
            background: goalFilter === g.value ? 'var(--accent)' : 'var(--bg-secondary)',
            color: goalFilter === g.value ? '#000' : 'var(--text-dim)', border: 'none',
            fontWeight: goalFilter === g.value ? 600 : 400,
          }}>{g.label}</button>
      ))}
    </div>

    {!selected && (
      <div style={{ display: 'grid', gap: 8 }}>
        {programs.map(p => (
          <div key={p.id} onClick={() => setSelectedId(p.id)}
            style={{
              padding: 12, borderRadius: 14, cursor: 'pointer',
              background: 'rgba(20,22,30,0.5)', border: '1px solid var(--glass-border)',
              backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{p.name}</div>
              <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 10, background: 'rgba(0,230,138,0.1)', color: 'var(--accent)', fontWeight: 600 }}>
                {PROGRAM_GOAL_MAP[p.goal] || p.goal}
              </span>
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 6 }}>{p.description}</div>
            <div style={{ display: 'flex', gap: 10, fontSize: 9, color: 'var(--text-light)' }}>
              <span>Автор: <b>{p.author}</b></span>
              <span>Уровень: <b style={{ color: 'var(--accent)' }}>{PROGRAM_LEVEL_MAP[p.level] || p.level}</b></span>
              <span>{p.daysPerWeek} дн/нед</span>
              <span>{p.durationWeeks} нед</span>
            </div>
          </div>
        ))}
      </div>
    )}

    {selected && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button onClick={() => setSelectedId(null)}
          style={{
            alignSelf: 'flex-start', padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)',
            cursor: 'pointer', background: 'var(--bg-secondary)', color: 'var(--text-dim)', fontSize: 11,
          }}>← К списку</button>

        <div style={{
          padding: 14, borderRadius: 14, background: 'rgba(20,22,30,0.5)',
          border: '1px solid var(--glass-border)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 16, color: 'var(--text)' }}>{selected.name}</h3>
          <p style={{ fontSize: 10, color: 'var(--text-dim)', margin: '0 0 8px' }}>{selected.description}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, fontSize: 10, marginBottom: 8 }}>
            <div style={{ background: 'rgba(0,230,138,0.05)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
              <div style={{ color: 'var(--text-dim)', fontSize: 8 }}>Уровень</div>
              <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{PROGRAM_LEVEL_MAP[selected.level] || selected.level}</div>
            </div>
            <div style={{ background: 'rgba(0,230,138,0.05)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
              <div style={{ color: 'var(--text-dim)', fontSize: 8 }}>Цель</div>
              <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{PROGRAM_GOAL_MAP[selected.goal] || selected.goal}</div>
            </div>
            <div style={{ background: 'rgba(0,230,138,0.05)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
              <div style={{ color: 'var(--text-dim)', fontSize: 8 }}>Дней/нед</div>
              <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{selected.daysPerWeek}</div>
            </div>
          </div>

          <div style={{ fontSize: 10, color: 'var(--text-light)', marginBottom: 4 }}>
            <b>Снаряжение:</b> {selected.equipmentNeeded.map(e => PROGRAM_EQUIP_MAP[e] || e).join(', ')}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-light)', marginBottom: 4 }}>
            <b>Прогрессия:</b> {selected.progressionModel}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-light)', marginBottom: 8 }}>
            <b>Разгрузка:</b> {selected.deloadProtocol}
          </div>
          {selected.warnings.length > 0 && (
            <div style={{ fontSize: 9, color: '#f59e0b', background: 'rgba(245,158,11,0.08)', borderRadius: 8, padding: 8, marginBottom: 8 }}>
              {selected.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
            </div>
          )}
          <div style={{ fontSize: 10, color: 'var(--accent)', background: 'rgba(0,230,138,0.06)', borderRadius: 8, padding: 8, marginBottom: 8 }}>
            <b>Ожидаемый результат:</b> {selected.expectedResults}
          </div>

          <button onClick={handleLoadProgram}
            style={{
              width: '100%', padding: 10, borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'var(--accent)', color: '#000', fontWeight: 700, fontSize: 12, marginBottom: 10,
            }}>
            📋 Загрузить программу
          </button>

          {/* Week-by-week detail */}
          <h4 style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--text)' }}>Программа по неделям</h4>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
            {selected.weeks.map((w, i) => (
              <button key={i} onClick={() => setDetailWeek(i + 1)}
                style={{
                  padding: '4px 10px', borderRadius: 12, fontSize: 10, cursor: 'pointer',
                  background: detailWeek === i + 1 ? 'rgba(0,230,138,0.12)' : 'var(--bg-secondary)',
                  border: detailWeek === i + 1 ? '1px solid var(--accent)' : '1px solid var(--border)',
                  color: detailWeek === i + 1 ? 'var(--accent)' : 'var(--text-dim)',
                  fontWeight: detailWeek === i + 1 ? 600 : 400,
                }}>
                Нед {w.week}{w.deload ? ' 🟢' : ''}
              </button>
            ))}
          </div>

          {selected.weeks[detailWeek - 1] && (() => {
            const wk = selected.weeks[detailWeek - 1];
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>
                  Фаза: <b>{PHASE_LABELS[wk.phase] || wk.phase}</b> | Объём: {wk.volumeMultiplier}× | Интенсивность: {wk.intensityMultiplier}×
                  {wk.deload ? ' | 🟢 Разгрузка' : ''}
                </div>
                {wk.days.map((day, di) => (
                  <div key={di} style={{
                    padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border)',
                  }}>
                    <div style={{ fontWeight: 700, fontSize: 11, color: 'var(--accent)', marginBottom: 4 }}>
                      День {day.day}: {day.name} — {day.focus}
                    </div>
                    <div style={{ fontSize: 8, color: 'var(--text-dim)', marginBottom: 6 }}>
                      Разминка: {day.warmup} | Заминка: {day.cooldown}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 8px', borderRadius: 4, marginBottom: 2, fontSize: 8, color: 'var(--text-dim)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ flex: 1 }}>Упражнение</span>
                      <span style={{ minWidth: 50, textAlign: 'center' }}>Подходы</span>
                      <span style={{ minWidth: 35, textAlign: 'center' }}>RPE</span>
                      <span style={{ minWidth: 30, textAlign: 'center' }}>RIR</span>
                      <span style={{ minWidth: 35, textAlign: 'center' }}>Отдых</span>
                    </div>
                    {day.exercises.map((ex, ei) => (
                      <div key={ei} style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px',
                        borderRadius: 6, marginBottom: 2, background: 'rgba(255,255,255,0.03)',
                        fontSize: 9,
                      }}>
                        <span style={{ flex: 1, fontWeight: 600 }}>{ex.name}</span>
                        <span style={{ color: 'var(--accent)' }}>{ex.sets}×{ex.reps}</span>
                        <span style={{ color: 'var(--text-dim)' }}>RPE {ex.rpe}</span>
                        <span style={{ color: 'var(--text-dim)' }}>RIR {ex.rir}</span>
                        <span style={{ color: 'var(--text-dim)' }}>Отд {ex.restSec}с</span>
                        {ex.notes ? <span style={{ fontSize: 8, color: 'var(--text-dim)' }}>{ex.notes}</span> : null}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>
    )}
  </div>);
};

const TimersTab: React.FC = () => {
  const [totalSec, setTotalSec] = React.useState(60);
  const [restSec, setRestSec] = React.useState(30);
  const [rounds, setRounds] = React.useState(3);
  const [isRunning, setIsRunning] = React.useState(false);
  const [currentRound, setCurrentRound] = React.useState(0);
  const [phase, setPhase] = React.useState<'work' | 'rest'>('work');
  const [timeLeft, setTimeLeft] = React.useState(0);
  const intervalRef = React.useRef<number | null>(null);

  const start = () => {
    if (isRunning) return;
    setIsRunning(true);
    setCurrentRound(1);
    setPhase('work');
    setTimeLeft(totalSec);
  };

  const stop = () => {
    setIsRunning(false);
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  };

  const reset = () => {
    stop();
    setCurrentRound(0);
    setPhase('work');
    setTimeLeft(0);
  };

  React.useEffect(() => {
    if (!isRunning) return;
    intervalRef.current = window.setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (phase === 'work') {
            if (currentRound >= rounds) { stop(); return 0; }
            setPhase('rest');
            return restSec;
          } else {
            setPhase('work');
            setCurrentRound(r => r + 1);
            return totalSec;
          }
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } };
  }, [isRunning, phase, currentRound, rounds, totalSec, restSec]);

  const pct = phase === 'work' ? (timeLeft / totalSec) * 100 : (timeLeft / restSec) * 100;

  return (<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div style={{
      padding: 16, borderRadius: 16, textAlign: 'center',
      background: 'rgba(20,22,30,0.5)', border: '1px solid var(--glass-border)',
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>
        {phase === 'work' ? 'РАБОТА' : 'ОТДЫХ'} · Раунд {currentRound}/{rounds}
      </div>
      <div style={{
        fontSize: 64, fontWeight: 800, lineHeight: 1,
        background: 'linear-gradient(135deg, #00e68a, #00c853)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
      }}>
        {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
      </div>
      <div style={{
        marginTop: 8, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: 3,
          background: phase === 'work' ? 'var(--accent)' : '#3b82f6',
          transition: 'width 1s linear',
        }} />
      </div>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
      <div>
        <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Работа (с)</label>
        <input type="number" min={5} max={600} value={totalSec || ''} onChange={e => setTotalSec(parseInt(e.target.value) || 60)} disabled={isRunning}
          style={{ width: '100%', padding: '8px', borderRadius: 8, textAlign: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' }} />
      </div>
      <div>
        <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Отдых (с)</label>
        <input type="number" min={5} max={600} value={restSec || ''} onChange={e => setRestSec(parseInt(e.target.value) || 30)} disabled={isRunning}
          style={{ width: '100%', padding: '8px', borderRadius: 8, textAlign: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' }} />
      </div>
      <div>
        <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Раунды</label>
        <input type="number" min={1} max={20} value={rounds || ''} onChange={e => setRounds(parseInt(e.target.value) || 3)} disabled={isRunning}
          style={{ width: '100%', padding: '8px', borderRadius: 8, textAlign: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' }} />
      </div>
    </div>

    <div style={{ display: 'flex', gap: 8 }}>
      {!isRunning ? (
        <button onClick={start}
          style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', cursor: 'pointer',
            background: 'var(--accent)', color: '#000', fontWeight: 700, fontSize: 14 }}>
          ▶ Старт
        </button>
      ) : (
        <button onClick={stop}
          style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', cursor: 'pointer',
            background: '#ef4444', color: '#fff', fontWeight: 700, fontSize: 14 }}>
          ⏸ Стоп
        </button>
      )}
      <button onClick={reset}
        style={{ padding: '12px 20px', borderRadius: 12, border: '1px solid var(--border)', cursor: 'pointer',
          background: 'var(--bg-secondary)', color: 'var(--text-dim)', fontSize: 14 }}>
        ↺ Сброс
      </button>
    </div>
  </div>);
};

const ProgressTab: React.FC<{ historyWorkouts: WorkoutLog[] }> = ({ historyWorkouts }) => {
  const [measurements, setMeasurements] = React.useState<BodyMeasurement[]>([]);
  const [repData, setRepData] = React.useState<any>(null);
  const [mWeight, setMWeight] = React.useState(80);
  const [mWaist, setMWaist] = React.useState(85);
  const [mChest, setMChest] = React.useState(100);
  const [mArm, setMArm] = React.useState(38);
  const [mThigh, setMThigh] = React.useState(60);
  const [mDate, setMDate] = React.useState(new Date().toISOString().split('T')[0]);

  React.useEffect(() => { setMeasurements(loadMeasurements()); }, []);
  const analytics = React.useMemo(() => analyzeMeasurements(175), [measurements]);

  const save = () => {
    const updated = saveMeasurement({ date: mDate, weightKg: mWeight, waistCm: mWaist, chestCm: mChest, armCm: mArm, thighCm: mThigh, calfCm: 38, neckCm: 38, hipCm: 95, shoulderCm: 120, forearmCm: 32, wristCm: 18, ankleCm: 22, bodyFatPercent: 15 } as any);
    setMeasurements(updated);
  };

  React.useEffect(() => {
    if (historyWorkouts.length > 0) {
      const logs: any[] = [];
      historyWorkouts.forEach((w: any) => (w.exercises || []).forEach((e: any) => {
        (e.sets || []).forEach((s: any) => logs.push({ date: w.date, exercise: e.exerciseName || e.exerciseId, weight: s.weight, reps: s.reps, rpe: 7 }));
      }));
      if (logs.length > 0) setRepData(generateWeeklyReport(logs, logs.map((l: any) => ({ date: l.date, durationMin: 60 }))));
    }
  }, [historyWorkouts]);

  return (<div>
    <div className="card" style={{ marginBottom:8, padding:10 }}>
      <h4 style={{ margin:'0 0 6px',fontSize:12 }}>📏 Замеры тела</h4>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4 }}>
        <div><label style={{ fontSize:9 }}>Вес</label><input type="number" value={mWeight} onChange={e=>setMWeight(parseFloat(e.target.value) || 0)} style={{ width:'100%',padding:'4px',borderRadius:4,background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text)',fontSize:11,boxSizing:'border-box' }} /></div>
        <div><label style={{ fontSize:9 }}>Талия</label><input type="number" value={mWaist} onChange={e=>setMWaist(parseFloat(e.target.value) || 0)} style={{ width:'100%',padding:'4px',borderRadius:4,background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text)',fontSize:11,boxSizing:'border-box' }} /></div>
        <div><label style={{ fontSize:9 }}>Грудь</label><input type="number" value={mChest} onChange={e=>setMChest(parseFloat(e.target.value) || 0)} style={{ width:'100%',padding:'4px',borderRadius:4,background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text)',fontSize:11,boxSizing:'border-box' }} /></div>
        <div><label style={{ fontSize:9 }}>Бицепс</label><input type="number" value={mArm} onChange={e=>setMArm(parseFloat(e.target.value) || 0)} style={{ width:'100%',padding:'4px',borderRadius:4,background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text)',fontSize:11,boxSizing:'border-box' }} /></div>
        <div><label style={{ fontSize:9 }}>Бедро</label><input type="number" value={mThigh} onChange={e=>setMThigh(parseFloat(e.target.value) || 0)} style={{ width:'100%',padding:'4px',borderRadius:4,background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text)',fontSize:11,boxSizing:'border-box' }} /></div>
        <div><label style={{ fontSize:9 }}>Дата</label><input type="date" value={mDate || ''} onChange={e=>setMDate(e.target.value)} style={{ width:'100%',padding:'4px',borderRadius:4,background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text)',fontSize:11,boxSizing:'border-box' }} /></div>
      </div>
      <button onClick={save} style={{ width:'100%',marginTop:6,padding:8,borderRadius:6,border:'none',cursor:'pointer',background:'var(--accent)',color:'#000',fontWeight:600,fontSize:12 }}>Сохранить замер</button>
    </div>

    {measurements.length > 0 && <div className="card" style={{ marginBottom:8, padding:10 }}>
      <h4 style={{ margin:'0 0 4px',fontSize:12 }}>📊 История ({measurements.length})</h4>
        {measurements.slice(-5).reverse().map((m:any,i)=><div key={i} style={{ fontSize:9,padding:'2px 0',borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
        {m.date}: Вес {m.weightKg}кг | Талия {m.waistCm}см | Грудь {m.chestCm}см | Бицепс {m.armCm}см | Бедро {m.thighCm}см
      </div>)}
    </div>}

    {analytics && <div className="card" style={{ padding:10 }}>
      <h4 style={{ margin:'0 0 4px',fontSize:12 }}>📈 Аналитика</h4>
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'2px 8px',fontSize:10 }}>
        <span>FFMI:</span><span style={{ fontWeight:600 }}>{analytics.ffmi?.toFixed(1)}</span>
        <span>LBM:</span><span style={{ fontWeight:600 }}>{analytics.lbm?.toFixed(1)} кг</span>
        <span>BMI:</span><span style={{ fontWeight:600 }}>{analytics.bmi?.toFixed(1)}</span>
        <span>Fat:</span><span style={{ fontWeight:600 }}>{analytics.fatMass?.toFixed(1)} кг</span>
      </div>
    </div>}

    {repData && <div className="card" style={{ padding:10, marginTop:8 }}>
      <h4 style={{ margin:'0 0 4px',fontSize:12 }}>📋 Недельный отчёт</h4>
      <div style={{ fontSize:9,color:'var(--text-light)' }}>{repData.insights?.slice(0,3).map((r:any,i:number)=><div key={i}>• {r}</div>)}</div>
    </div>}
  </div>);
};

const StrengthLevelCard: React.FC = () => {
  const [slEx, setSlEx] = React.useState('squat');
  const [slWt, setSlWt] = React.useState(80);
  const [sl1RM, setSl1RM] = React.useState(140);
  const level = getStrengthLevel(slEx, slWt, sl1RM) as string;
  const next = getNextLevelTarget(slEx, slWt, level as any);
  return (<div className="card" style={{ marginTop:8, padding:10 }}>
    <h4 style={{ margin:'0 0 6px',fontSize:12 }}>📊 Уровень силы</h4>
    <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:4 }}>
      <div><label style={{ fontSize:9 }}>Упражнение</label><select value={slEx || ''} onChange={e=>setSlEx(e.target.value)} style={{ width:'100%',padding:'4px',borderRadius:4,background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text)',fontSize:11 }}><option value="squat">Присед</option><option value="bench">Жим</option><option value="deadlift">Тяга</option></select></div>
      <div><label style={{ fontSize:9 }}>Вес тела (кг)</label><input type="number" value={slWt} onChange={e=>setSlWt(parseFloat(e.target.value) || 0)} style={{ width:'100%',padding:'4px',borderRadius:4,background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text)',fontSize:11,boxSizing:'border-box' }} /></div>
      <div><label style={{ fontSize:9 }}>1RM (кг)</label><input type="number" value={sl1RM} onChange={e=>setSl1RM(parseFloat(e.target.value) || 0)} style={{ width:'100%',padding:'4px',borderRadius:4,background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text)',fontSize:11,boxSizing:'border-box' }} /></div>
    </div>
    <div style={{ marginTop:6,fontSize:10 }}>Уровень: <b style={{ color:'var(--accent)' }}>{level}</b> | До следующего: <b style={{ color:'#8b5cf6' }}>{next} кг</b></div>
  </div>);
};

const StructuredAnalyticsCard: React.FC<{ sessions: any[] }> = ({ sessions }) => {
  const result = React.useMemo(() => sessions.length > 0 ? computeStructuredAnalytics(sessions) : null, [sessions]);
  if (!result) return null;
  return (<div className="card" style={{ marginTop:8, padding:10 }}>
    <h4 style={{ margin:'0 0 4px',fontSize:12 }}>📊 Структурная</h4>
    <div style={{ fontSize:10 }}>Сессий: <b>{(result as any).sessionCount || sessions.length}</b> | Объём: <b>{(result as any).totalVolume || '—'}</b></div>
    {(result as any).insights?.slice(0,3).map((r:any,i:number)=><div key={i} style={{ fontSize:9,color:'var(--text-dim)',marginTop:2 }}>• {r}</div>)}
  </div>);
};
