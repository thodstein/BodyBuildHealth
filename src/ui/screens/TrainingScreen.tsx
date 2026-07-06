import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { EXERCISE_CATALOG, getExercisesByGroup, getSubstitutes, canReplace, getExerciseById } from '../../core/exercise-catalog';
import { calcTraining, calcExercisePrescription, EXERCISE_DB, TRAINING_SPLITS, TRAINING_LEVEL_CONFIGS, LEVEL_VOLUMES } from '../../engines/training.engine';
import { generateMacrocycle, generateBlockPlan, getCurrentWeekPlan, BLOCK_SEQUENCES, type MacrocyclePlan, type Microcycle, type MacrocycleInput } from '../../engines/training-periodization.engine';
import { selectSplit, getSplitOptions, type SplitCandidate } from '../../engines/split-selector.engine';
import { selectProgressionRule } from '../../engines/progression.engine';
import { RIR_MATRIX, generateWeeklyPlan } from '../../engines/rir-matrix.engine';
import { StrengthDiary, type StrengthStats, type WeeklyProgress, type ProgressionAlert } from '../../engines/strength-diary.engine';
import type { WorkoutLog } from '../../core/types';
import { generateWarmup } from '../../engines/warmup.engine';
import { generateCooldown } from '../../engines/cooldown.engine';
import { selectSetScheme } from '../../engines/set-scheme.engine';
import { selectTempo, formatTempo } from '../../engines/tempo.engine';
import { generateRepTempo } from '../../engines/rep-tempo-engine';
import { useDataLink } from '../../core/data-link';
import type { TrainingInput, TrainingOutput, Exercise, MovementPattern } from '../../core/types';
import { computeAnalytics, type AnalyticsSnapshot, type WeeklyBreakdown } from '../../engines/analytics-engine';
import { computeConstraints } from '../../engines/training-constraints.engine';
import { generatePeriodization, getPhaseParams, type GoalType } from '../../engines/cycle-periodization.engine';
import { getTrainingMethods, getMethodsByCategory, getVolumeReferences, getVolumeByMuscle, getSplitVisuals, type TrainingMethod } from '../../engines/training-methodology.engine';
import { buildVisualDashboard, computeWeeklyChart, computeMuscleVolume, computeProgression, type VizSessionData } from '../../engines/training-visualization.engine';
import { getProgramById, getProgramsByGoal, FULL_PROGRAM_LIBRARY, type FullProgram, type ProgramDay } from '../../engines/complete-program-library.engine';
import { generateWeeklyReport, analyzeMeasurements, loadMeasurements, saveMeasurement, type BodyMeasurement } from '../../engines/log-analytics-progression.engine';
import { getExerciseBio } from '../../data/exercise-biomechanics-db';
import { getStrengthLevel, getNextLevelTarget } from '../../engines/performance-analytics.engine';
import { computeStructuredAnalytics } from '../../engines/structured-analytics.engine';
import { SRCBBScreen } from './SRCBBScreen';
import { TrainingDiaryHub } from './TrainingScreen_parts/TrainingDiaryHub';
import { VBTCalculator } from './SRCBBScreen_parts/VBTCalculator';
import { MRVEstimator } from './SRCBBScreen_parts/MRVEstimator';
import { PlateCalculator } from './SRCBBScreen_parts/PlateCalculator';

import {
  WARMUP_LABELS, GOALS, LEVELS, MUSCLE_GROUPS, GROUP_LABELS, EQUIP_LABELS, JOINT_LABELS,
  PHASE_LABELS, PHASE_HINTS, TAB_GROUPS, TAB_LABELS,
  type TrainingTab, type TrainingPage, type TrainingGroup,
  type PlanningTrack, getPlanningTrack, setPlanningTrack, planningTabsFor,
} from './TrainingScreen_parts/shared';
import { hapticImpact } from '../../core/telegram';
import { InfoErrorBoundary } from './SupportScreen_parts/SupportScreenData';

export const TrainingScreen: React.FC = () => {
  const linked = useDataLink();
  const readiness = linked.readiness;
  const labAnalysis = linked.labAnalysis;
  const diary = useMemo(() => new StrengthDiary(), []);
  // Этап R: режим планирования (устраняет дубли программ СРЦ/BB ↔ конструктор, AGENTS.md баг #1)
  const [planningTrack, setPlanningTrackState] = useState<PlanningTrack>(getPlanningTrack());
  const [tab, setTab] = useState<TrainingTab>(getPlanningTrack() === 'manual' ? 'constructor' : 'srcbb');
  const [page, setPage] = useState<TrainingPage>('hero');
  const [mainGroup, setMainGroup] = useState<TrainingGroup>(null);
  // Эффективные группы вкладок: «Планирование» зависит от режима (взаимоисключающие наборы — нет дублей)
  const TAB_GROUPS_EFF: typeof TAB_GROUPS = {
    ...TAB_GROUPS,
    planning: { ...TAB_GROUPS.planning, tabs: planningTabsFor(planningTrack) },
  };
  const switchPlanningTrack = (t: PlanningTrack) => {
    setPlanningTrack(t);
    setPlanningTrackState(t);
    const visible = planningTabsFor(t);
    if (mainGroup === 'planning' && !visible.includes(tab)) setTab(visible[0]);
  };

  // Plan state — pre-fill from readiness and labAnalysis
  const [goal, setGoal] = useState('bulk');
  const [level, setLevel] = useState('intermediate');
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [splitType, setSplitType] = useState('auto');
  const [splitCandidates, setSplitCandidates] = useState<SplitCandidate[]>([]);
  const [showSplitPicker, setShowSplitPicker] = useState(false);
  const [cycleType, setCycleType] = useState('auto');
  const [periodizationType, setPeriodizationType] = useState<'auto' | 'linear' | 'undulating' | 'block' | 'conjugate'>('auto');
  const [mesoLength, setMesoLength] = useState(12);
  const [recovery, setRecovery] = useState(Math.round((readiness?.recovery ?? 70) / 10));
  const [fatigue, setFatigue] = useState(Math.round((readiness?.fatigue ?? 30) / 10));
  const [weakPoints, setWeakPoints] = useState<string[]>([]);
  const [myCycleMsg, setMyCycleMsg] = useState('');
  const [cyclesError, setCyclesError] = useState<string | null>(null);
  const [bodyWeight, setBodyWeight] = useState(80);
  const [sleepHours, setSleepHours] = useState(linked.profile?.settings?.baselineSleepHours ?? 7);
  const [stressLevel, setStressLevel] = useState(linked.profile?.settings?.baselineStressLevel ?? 5);
  const [tprofile, updateTProfile] = useTrainingProfile();
  // Синхронизируем локальные состояния из единого профиля (профиль — мастер для конструктора)
  useEffect(() => { setGoal(tprofile.goal); setLevel(tprofile.level); setDaysPerWeek(tprofile.daysPerWeek); setRecovery(tprofile.recovery); setFatigue(tprofile.fatigue); setWeakPoints(tprofile.weakPoints); setBodyWeight(tprofile.bodyWeight); setSleepHours(tprofile.sleepHours); setStressLevel(tprofile.stressLevel); }, [tprofile]);
  const [customExercises, setCustomExercises] = useState<{ name: string; sets: number; reps: number; rir: number }[]>(() => { try { return JSON.parse(localStorage.getItem('myTrainingExercises') || '[]'); } catch { return []; } });
  const [trainingOutput, setTrainingOutput] = useState<TrainingOutput | null>(null);
  const [macrocycle, setMacrocycle] = useState<MacrocyclePlan | null>(() => { try { return JSON.parse(localStorage.getItem('he_macro_session') || 'null'); } catch { return null; } });
  useEffect(() => { try { localStorage.setItem('he_macro_session', JSON.stringify(macrocycle)); } catch {} }, [macrocycle]);
  const [trainingReportGenerated, setTrainingReportGenerated] = useState(false);
  useEffect(() => { try { if (localStorage.getItem('he_training_report_current')) setTrainingReportGenerated(true); } catch {} }, []);
  const [trainingArchive, setTrainingArchive] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('he_training_reports') || '[]'); } catch { return []; }
  });
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [currentMicrocycle, setCurrentMicrocycle] = useState<Microcycle | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [expandedMeso, setExpandedMeso] = useState<number | null>(null);
  // Этап U: методики — по одной из каждой категории (было: одна строка total)
  const [appliedMethods, setAppliedMethods] = useState<Record<string, string>>({});
  const appliedMethod = Object.values(appliedMethods)[0] || null; // бэкворд-совместимость

  // Exercise DB state


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
  const [injMuscle, setInjMuscle] = useState<string>('chest');
  const [injFrom, setInjFrom] = useState<string>('');
  const [injTo, setInjTo] = useState<string>('');
  const PCT_FOR_RIR_MAN: Record<number, number> = { 0: 1.0, 1: 0.96, 2: 0.92, 3: 0.88, 4: 0.84, 5: 0.80 };
  const [manualResult, setManualResult] = useState<{ splitName: string; corrections: string[]; days: { day: number; groups: string[]; exercises: { name: string; sets: number; reps: string; rir: number; rest: number; group: string; weight: number }[] }[] } | null>(() => { try { return JSON.parse(localStorage.getItem('he_manual_session') || 'null'); } catch { return null; } });
  useEffect(() => { try { localStorage.setItem('he_manual_session', JSON.stringify(manualResult)); } catch { /* ignore */ } }, [manualResult]);
  const GRP_RU_M: Record<string, string> = { chest: 'Грудь', back: 'Спина', legs: 'Ноги', shoulders: 'Плечи', arms: 'Руки', core: 'Кор', full: 'Общее' };
  const SET_TEMPLATES: Record<string, { sets: number; reps: string; rir: number; rest: number }> = {
    '5×5': { sets: 5, reps: '5', rir: 1, rest: 180 }, '3×8': { sets: 3, reps: '8', rir: 2, rest: 90 },
    '4×10': { sets: 4, reps: '10', rir: 2, rest: 90 }, '3×12': { sets: 3, reps: '12', rir: 2, rest: 75 },
    'AMRAP': { sets: 1, reps: 'AMRAP', rir: 0, rest: 180 }, 'Myo-rep': { sets: 1, reps: '15 + 5×3', rir: 0, rest: 120 },
    '10×10 GVT': { sets: 10, reps: '10', rir: 3, rest: 60 }, '5/3/1': { sets: 3, reps: '5/3/1+', rir: 1, rest: 180 },
  };

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
  const [runtimeDay, setRuntimeDay] = useState<number>(() => { try { const v = JSON.parse(localStorage.getItem('he_runtime_day') || '1'); return typeof v === 'number' ? v : 1; } catch { return 1; } });
  useEffect(() => { try { localStorage.setItem('he_runtime_day', JSON.stringify(runtimeDay)); } catch { /* ignore */ } }, [runtimeDay]);
  const [runtimeExIdx, setRuntimeExIdx] = useState(0);
  const [runtimeLogs, setRuntimeLogs] = useState<Record<string, { sets: { weight: number; reps: number; rpe: number; rir: number }[]; completed: boolean }>>({});
  const [runtimeStarted, setRuntimeStarted] = useState(false);
  const [plRuntime, setPlRuntime] = useState<{ days: PlayerDay[]; focus: string; week: number; track: string } | null>(() => { try { const v = localStorage.getItem('he_pl_runtime'); return v ? JSON.parse(v) : null; } catch { return null; } });
  const [plRunOpen, setPlRunOpen] = useState(false);
  useEffect(() => { if (tab === 'runtime') { try { const v = localStorage.getItem('he_pl_runtime'); setPlRuntime(v ? JSON.parse(v) : null); } catch { /* ignore */ } } }, [tab]);
  useEffect(() => { if (linked.readiness) appendReadinessToday(linked.readiness.recovery ?? 70, linked.readiness.fatigue ?? 30); }, [linked.readiness]);
  const [showWarmup, setShowWarmup] = useState(false);
  const [showCooldown, setShowCooldown] = useState(false);
  const [runtimeSetW, setRuntimeSetW] = useState(80);
  const [runtimeSetR, setRuntimeSetR] = useState(8);
  const [runtimeSetRP, setRuntimeSetRP] = useState(7);
  const [runtimeSetRI, setRuntimeSetRI] = useState(2);

  const generatePlan = useCallback((overrideSplitType?: string) => {
    try {
    // U6: детерминированная генерация — без Math.random-jitter (циклы воспроизводимы при тех же параметрах).
    // recovery/fatigue берём как есть; nutrition — стабильное значение (8/10, питание учитывается отдельно).
    const input: TrainingInput = {
      goal, level, daysPerWeek, recovery: Math.max(0, Math.min(100, recovery)), fatigue: Math.max(0, Math.min(100, fatigue)), nutrition: 8,
      weakPoints, sessionDuration: 60, exercises: [],
      splitType: overrideSplitType || splitType,
      periodizationType,
      cycleType,
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
      periodizationType,
      cycleType,
    };
    const macro = periodizationType === 'block' ? generateBlockPlan(macroInput) : generateMacrocycle(macroInput);
    setMacrocycle(macro);
    setSelectedWeek(1);
    setCurrentMicrocycle(getCurrentWeekPlan(macro, 1));
    setCyclesError(null);
    } catch (e) { setCyclesError('Ошибка генерации: ' + String(e)); }
  }, [goal, level, daysPerWeek, recovery, fatigue, weakPoints, splitType, periodizationType, cycleType]);
  // Мост макроцикл -> выполнение (единый поток через SessionPlayer)

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

  // Применение композиции методик к плану (одна из каждой категории)
  const applyMethodComposition = () => {
    const pm = appliedMethods['periodization'];
    if (pm) {
      const n = pm.toLowerCase();
      const pt = n.includes('linear') ? 'linear' : n.includes('undulating')||n.includes('dup') ? 'undulating' : n.includes('block') ? 'block' : n.includes('conjugate')||n.includes('westside') ? 'conjugate' : null;
      if (pt) setPeriodizationType(pt);
    }
    setTimeout(() => generatePlan(), 120);
  };
  useEffect(() => {
    if (Object.keys(appliedMethods).length > 0) { const tm = setTimeout(() => generatePlan(), 150); return () => clearTimeout(tm); }
  }, [appliedMethods]);

  const prevDays = useRef(daysPerWeek);
  useEffect(() => { loadDiaryStats(); }, []);
  useEffect(() => { if (prevDays.current !== daysPerWeek) { prevDays.current = daysPerWeek; generatePlan(); } }, [daysPerWeek]);
  useEffect(() => { localStorage.setItem('myTrainingExercises', JSON.stringify(customExercises)); }, [customExercises]);

  // Sync tab/planningTrack with 'storage' events (cross-tab + child-tab navigation via localStorage)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'he_training_planning_track') {
        const val = localStorage.getItem('he_training_planning_track');
        const parsed = val === 'manual' || val === 'bb' ? val : 'pl';
        setPlanningTrack(parsed);
        setPlanningTrackState(parsed);
      }
      if (e.key === 'he_training_tab') {
        const val = localStorage.getItem('he_training_tab');
        const validTabs: TrainingTab[] = ['constructor', 'cycles', 'programs', 'mytraining', 'volume', 'library', 'analytics', 'visual', 'progress', 'exercise_lab', 'methods', 'timers', 'history', 'reports', 'srcbb', 'specialization'];
        if (val && validTabs.includes(val as TrainingTab)) {
          setTab(val as TrainingTab);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Держим активную вкладку валидной для текущей группы/трассы (иначе — пустой экран)
  useEffect(() => {
    if (!mainGroup) return;
    const visible = mainGroup === 'planning' ? planningTabsFor(planningTrack) : TAB_GROUPS[mainGroup].tabs;
    if (!visible.includes(tab)) setTab(visible[0]);
  }, [mainGroup, planningTrack]);

  useEffect(() => {
    if (macrocycle && selectedWeek > 0) {
      setCurrentMicrocycle(getCurrentWeekPlan(macrocycle, selectedWeek));
    }
  }, [macrocycle, selectedWeek]);

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

  const showNonBuilder = tab !== 'constructor';

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
              {(Object.entries(TAB_GROUPS_EFF) as [TrainingGroup & string, typeof TAB_GROUPS_EFF[string]][]).map(([key, group]) => (
                <button key={key} onClick={() => { setPage('tabs'); setMainGroup(key as TrainingGroup); setTab(key === 'planning' ? planningTabsFor(planningTrack)[0] : group.tabs[0]); }} style={{
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
                      {key === 'training' ? 'Проведение тренировки, таймеры отдыха, учёт подходов' : key === 'planning' ? (planningTrack === 'manual' ? 'Ручной сбор: план, циклы, программы, методики, калькулятор' : planningTrack === 'bb' ? 'Бодибилдинг: авто-подбор сплита, объём/тяж-памп, PED, метрики' : 'ПЛ (сила): авто-подбор циклов СРЦ, PM-прогрессия, блины, пик, метрики') : 'Аналитика, графики, прогресс, дневник, калькуляторы, история'}
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
            <button onClick={() => { setPage('hero'); setMainGroup(null); }} style={{
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
        <h2 style={{ margin: '0 0 8px', fontSize: 16, color: TAB_GROUPS_EFF[mainGroup].color }}>{TAB_GROUPS_EFF[mainGroup].title}</h2>
      )}

      <div style={{ display: 'flex', gap: 3, marginBottom: 10, flexWrap: 'wrap' }}>
        {(mainGroup ? TAB_GROUPS_EFF[mainGroup].tabs : Object.keys(TAB_LABELS) as TrainingTab[]).map(k => (
          <button key={k} onClick={() => { hapticImpact('light'); setTab(k); }} style={{
            padding: '7px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
            background: tab === k ? 'var(--accent)' : 'var(--bg-secondary)',
            color: tab === k ? '#000' : 'var(--text-dim)', border: 'none', cursor: 'pointer',
            transition: 'all 0.2s',
          }}>{TAB_LABELS[k]}</button>
        ))}
      </div>

      {/* Этап R: переключатель режима планирования — только в группе «Планирование».
           Разделяет авто-подбор (СРЦ/BB, единственный источник программ) и ручной конструктор,
           устраняя дублирование информации (AGENTS.md критич.баг #1). */}
      {mainGroup === 'planning' && (
        <div style={{ display:'flex', gap:4, marginBottom:10, padding:'6px', borderRadius:12, background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)' }}>
          <button onClick={() => { hapticImpact('medium'); switchPlanningTrack('pl'); }} style={{ flex:1, padding:'9px 6px', borderRadius:9, fontSize:11, fontWeight:700, cursor:'pointer', border: planningTrack === 'pl' ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.06)', background: planningTrack === 'pl' ? 'rgba(0,230,138,0.14)' : 'rgba(255,255,255,0.02)', color: planningTrack === 'pl' ? 'var(--accent)' : 'var(--text-dim)' }}>🏆 ПЛ (сила)</button>
          <button onClick={() => { hapticImpact('medium'); switchPlanningTrack('bb'); }} style={{ flex:1, padding:'9px 6px', borderRadius:9, fontSize:11, fontWeight:700, cursor:'pointer', border: planningTrack === 'bb' ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.06)', background: planningTrack === 'bb' ? 'rgba(0,230,138,0.14)' : 'rgba(255,255,255,0.02)', color: planningTrack === 'bb' ? '#00e68a' : 'var(--text-dim)' }}>💪 ББ</button>
          <button onClick={() => { hapticImpact('medium'); switchPlanningTrack('manual'); }} style={{ flex:1, padding:'9px 6px', borderRadius:9, fontSize:11, fontWeight:700, cursor:'pointer', border: planningTrack === 'manual' ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.06)', background: planningTrack === 'manual' ? 'rgba(0,230,138,0.14)' : 'rgba(255,255,255,0.02)', color: planningTrack === 'manual' ? '#00e68a' : 'var(--text-dim)' }}>🛠 Ручной сбор</button>
        </div>
      )}

      {/* Readiness card — only on training tabs */}
      {readiness && mainGroup === 'training' && (
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
              { label: 'Сон', value: readiness.sleep ?? 50, color: (readiness.sleep ?? 50) >= 70 ? '#22c55e' : '#eab308' },
              { label: 'Поддержка', value: readiness.support ?? 50, color: (readiness.support ?? 50) >= 70 ? '#22c55e' : '#eab308' },
              { label: 'Усталость', value: 100 - (readiness.fatigue ?? 50), color: (readiness.fatigue ?? 50) < 40 ? '#22c55e' : '#ef4444' },
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
          {(() => { const srpe = loadSRPESessions(); if (srpe.length < 2) return null; const acwr = acuteChronicRatio(toDailyLoads(srpe)); const zoneColor = acwr.ratio > 1.5 ? '#ef4444' : acwr.ratio > 1.3 ? '#eab308' : acwr.ratio < 0.8 ? '#3b82f6' : '#22c55e'; const zoneLabel = acwr.ratio > 1.5 ? 'опасно' : acwr.ratio > 1.3 ? 'осторожно' : acwr.ratio < 0.8 ? 'недотрен' : 'оптимум'; return <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}><span style={{ color: 'var(--text-dim)', minWidth: 44 }}>Нагрузка</span><div style={{ flex: 1, background: 'var(--bg-secondary)', borderRadius: 4, height: 5, overflow: 'hidden' }}><div style={{ width: Math.min(100, acwr.ratio * 50) + '%', height: '100%', background: zoneColor, borderRadius: 4 }} /></div><span style={{ fontWeight: 700, color: zoneColor, minWidth: 60, textAlign: 'right' }}>ACWR {acwr.ratio.toFixed(2)} · {zoneLabel}</span></div>; })()}
        </div>
      )}

      {/* Training Score Card перенесён в подвкладку Восстановление тренировочного блока */}

      {/* ═══════════ PLAN TAB ═══════════ */}
      
{tab === 'powerlifting' && <InfoErrorBoundary label="Пауэрлифтинг"><SRCBBScreen track="pl" /></InfoErrorBoundary>}
{tab === 'bodybuilding' && <InfoErrorBoundary label="Бодибилдинг"><SRCBBScreen track="bb" /></InfoErrorBoundary>}
{tab === 'srcbb' && (
  <InfoErrorBoundary label={planningTrack === 'bb' ? 'Бодибилдинг' : 'Пауэрлифтинг'}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)' }}>{planningTrack === 'bb' ? '💪 Бодибилдинг — авто-планировщик' : '🏆 Пауэрлифтинг — СРЦ-планировщик'}</div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>
        {planningTrack === 'bb'
          ? 'Автоматическое построение бодибилдинг-цикла: сплиты, объём по группам, прогрессия. Режим (ПЛ / ББ / Ручной сбор) переключается вверху.'
          : 'Автоматическое построение пауэрлифтингового цикла (СРЦ): присед, жим лёжа, становая тяга, вариации интенсивности. Режим (ПЛ / ББ / Ручной сбор) переключается вверху.'}
      </div>
      <button onClick={() => setTab(planningTrack === 'bb' ? 'bodybuilding' : 'powerlifting')} style={{ padding: 16, borderRadius: 12, border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.06)', color: 'var(--accent)', cursor: 'pointer', textAlign: 'center' }}>
        <div style={{ fontSize: 30 }}>{planningTrack === 'bb' ? '💪' : '🏋️'}</div>
        <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>{planningTrack === 'bb' ? 'Открыть Бодибилдинг' : 'Открыть Пауэрлифтинг (СРЦ)'}</div>
        <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>{planningTrack === 'bb' ? 'Сплиты · объём · прогрессия' : 'Присед · жим · тяга · интенсивность'}</div>
      </button>
      <button onClick={() => setTab('volume')} style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.06)', color: '#60a5fa', cursor: 'pointer', textAlign: 'left' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span><b>📐 Расчёт объёма и оптимизация</b><div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>MEV/MAV/MRV, подбор замен, рекомендации</div></span>
          <span style={{ fontSize: 18 }}>→</span>
        </div>
      </button>
    </div>
  </InfoErrorBoundary>
)}
          {tab === 'constructor' && (
        <InfoErrorBoundary label="Конструктор тренировок">
        <TrainingConstructor
          tprofile={tprofile} updateTProfile={updateTProfile}
          goal={goal} setGoal={setGoal}
          level={level} setLevel={setLevel}
          daysPerWeek={daysPerWeek} setDaysPerWeek={setDaysPerWeek}
          recovery={recovery} setRecovery={setRecovery}
          fatigue={fatigue} setFatigue={setFatigue}
          weakPoints={weakPoints} setWeakPoints={setWeakPoints}
          bodyWeight={bodyWeight} setBodyWeight={setBodyWeight}
          sleepHours={sleepHours} setSleepHours={setSleepHours}
          stressLevel={stressLevel} setStressLevel={setStressLevel}
          mesoLength={mesoLength} setMesoLength={setMesoLength}
          labAnalysis={linked.labAnalysis}
          setTab={setTab}
        />
        </InfoErrorBoundary>
      )}

      {/* ═══════════ RUNTIME (Live Workout) ═══════════ */}
      {tab === 'runtime' && (
        <InfoErrorBoundary label="Тренировка">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Запуск построенного плана СРЦ/ББ (перенесено из подвкладки «Выполнение») */}
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

      {/* ═══════════ EXERCISES TAB (каталог) ═══════════ */}
      {tab === 'exercises' && (
        <InfoErrorBoundary label="Упражнения">
          <ExerciseLabCatalog />
        </InfoErrorBoundary>
      )}

      {/* ═══════════ CALCULATORS TAB (also serves programcalc) ═══════════ */}

            {/* ═══════════ DIARY AND ANALYTICS TAB (объединённый дневник+аналитика+прогресс+визуализация+отчёты) ═══════════ */}
      {tab === 'diary' && (
        <InfoErrorBoundary label="Дневник">
          <TrainingDiaryHub
            diary={diary}
            diaryStats={diaryStats}
            diaryProgress={diaryProgress}
            historyWorkouts={historyWorkouts}
            macrocycle={macrocycle}
            selectedWeek={selectedWeek}
            level={level}
            onRefresh={loadDiaryStats}
            trainingOutput={trainingOutput}
            goal={goal}
            daysPerWeek={daysPerWeek}
            splitType={splitType}
            periodizationType={periodizationType}
            mesoLength={mesoLength}
            tprofile={tprofile}
            linked={linked}
          />
        </InfoErrorBoundary>
      )}

      {/* ═══════════ TRAINING MIXES TAB ═══════════ */}
      {tab === 'mixes' && (
        <InfoErrorBoundary label="Тренировочные миксы">
          <TrainingMixTab />
        </InfoErrorBoundary>
      )}

      {/* ═══════════ CYCLES TAB ═══════════ */}
      {tab === 'cycles' && (
        <InfoErrorBoundary label="Циклы">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <MicrocyclePlannerCard />
          <div style={{ padding: 12, borderRadius: 14, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#ef4444', marginBottom: 2 }}>🩹 Травмы / ограничения</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 8 }}>Указанные группы исключаются из генерации плана на активный период. Дата «до» — пусто = травма актуальна.</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr auto', gap: 6, marginBottom: 8, alignItems: 'end' }}>
              <div>
                <label style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>Группа</label>
                <select value={injMuscle} onChange={e => setInjMuscle(e.target.value)} style={{ width: '100%', background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: 6, fontSize: 11 }}>
                  {MUSCLE_GROUPS.map(g => <option key={g} value={g}>{GROUP_LABELS[g]}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>С</label>
                <input type="date" value={injFrom} onChange={e => setInjFrom(e.target.value)} style={{ width: '100%', background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: 6, fontSize: 11 }} />
              </div>
              <div>
                <label style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>До (опц)</label>
                <input type="date" value={injTo} onChange={e => setInjTo(e.target.value)} style={{ width: '100%', background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: 6, fontSize: 11 }} />
              </div>
              <button onClick={() => { if (!injFrom) return; updateTProfile({ injuries: [...(tprofile.injuries || []), { muscle: injMuscle, from: injFrom, to: injTo || undefined }] }); setInjFrom(''); setInjTo(''); }} disabled={!injFrom} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: injFrom ? 'rgba(239,68,68,0.12)' : 'transparent', color: '#ef4444', cursor: injFrom ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap' }}>+ Доб</button>
            </div>
            {(tprofile.injuries || []).length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {tprofile.injuries.map((inj, i) => {
                  const today = new Date().toISOString().slice(0, 10);
                  const active = (inj.from || '') <= today && (!inj.to || inj.to >= today);
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 8px', borderRadius: 6, background: active ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ fontSize: 11, color: active ? '#fca5a5' : 'var(--text-dim)' }}>{GROUP_LABELS[inj.muscle] || inj.muscle} · {inj.from}–{inj.to || '…'} {active ? '🔴 активно' : '✅ прошло'}</span>
                      <button onClick={() => updateTProfile({ injuries: (tprofile.injuries || []).filter((_, j) => j !== i) })} style={{ padding: '2px 7px', borderRadius: 5, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer', fontSize: 10 }}>✕</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {/* Controls - glass card */}
          <div style={{ padding:12, borderRadius:14, background:'rgba(24,24,27,0.12)', border:'1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.35)', fontWeight:500, letterSpacing:'0.3px', textTransform:'uppercase', marginBottom:8 }}>🔄 Параметры цикла</div>
            {/* Goal */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, marginBottom:8 }}>
              {GOALS.map(g => (
                <button key={g.value} onClick={() => { setGoal(g.value); setTimeout(generatePlan, 50); }} style={{
                  padding:'5px 8px', borderRadius:8, fontSize:10, fontWeight: goal === g.value ? 700 : 400,
                  cursor:'pointer', border: goal === g.value ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)',
                  background: goal === g.value ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)', color: 'var(--text)', textAlign:'left',
                }}>{g.icon} {g.label}</button>
              ))}
            </div>
            {/* Periodization pills */}
            <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:8, alignItems:'center' }}>
              <span style={{ fontSize:9, color:'rgba(255,255,255,0.35)' }}>Периодизация:</span>
              {[
                { v:'auto', l:'Авто' }, { v:'linear', l:'Линейная' },
                { v:'undulating', l:'DUP' }, { v:'block', l:'Блочная' },
              ].map(p => (
                <button key={p.v} onClick={() => { setPeriodizationType(p.v as 'auto' | 'linear' | 'undulating' | 'block' | 'conjugate'); setTimeout(generatePlan, 50); }} style={{
                  padding:'3px 8px', borderRadius:6, fontSize:9, fontWeight: periodizationType === p.v ? 700 : 400, cursor:'pointer',
                  border: periodizationType === p.v ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)',
                  background: periodizationType === p.v ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)', color: 'var(--text)',
                }}>{p.l}</button>
              ))}
            </div>
            {/* Cycle type - expanded with descriptions */}
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.35)', marginBottom:4 }}>Тип цикла:</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:3, marginBottom:8 }}>
              {[
                { v:'auto', l:'Авто', d:'Автоматический подбор по цели и уровню' },
                { v:'bb_mass', l:'Масса', d:'Высокий объём, изоляция, wave-кривая' },
                { v:'bb_specialization', l:'Специализация', d:'Акцент на отстающие группы' },
                { v:'pl_peaking', l:'Пауэрлифтинг', d:'Силовой пик, 1ПМ, линейная кривая' },
                { v:'wl_tech', l:'Тяжелоатлет', d:'Технические движения, рывок/толчок' },
                { v:'cf_cond', l:'Кроссфит', d:'Кондиционирование, метконы, круговые' },
                { v:'rehab', l:'Реабилитация', d:'Восстановление, низкий объём' },
              ].map(c => (
                <button key={c.v} onClick={() => { setCycleType(c.v); setTimeout(generatePlan, 50); }} title={c.d} style={{
                  padding:'4px 6px', borderRadius:6, fontSize:8, fontWeight: cycleType === c.v ? 700 : 400, cursor:'pointer',
                  border: cycleType === c.v ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.06)',
                  background: cycleType === c.v ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.02)', color: 'var(--text)',
                  textAlign:'center', lineHeight:1.2,
                }}><div style={{fontWeight: cycleType === c.v ? 700 : 500}}>{c.l}</div><div style={{fontSize:6, color:'rgba(255,255,255,0.3)', marginTop:1}}>{c.d}</div></button>
              ))}
            </div>
            {/* Level pills + generate */}
            <div style={{ display:'flex', gap:4, flexWrap:'wrap', alignItems:'center', marginBottom:8 }}>
              <span style={{ fontSize:9, color:'rgba(255,255,255,0.35)' }}>Уровень:</span>
              {LEVELS.map(l => (
                <button key={l.value} onClick={() => setLevel(l.value)} style={{
                  padding:'3px 8px', borderRadius:6, fontSize:9, fontWeight: level === l.value ? 700 : 400, cursor:'pointer',
                  border: level === l.value ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)',
                  background: level === l.value ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)', color: 'var(--text)',
                }}>{l.icon} {l.label}</button>
              ))}
            </div>
            <button onClick={() => generatePlan()} style={{
              width:'100%', padding:'9px', borderRadius:10, border:'none', cursor:'pointer',
              background:'linear-gradient(135deg,var(--accent),#00cc7a)', color:'#000', fontWeight:700, fontSize:12,
            }}>▶ Сгенерировать макроцикл</button>
            {cyclesError && <div style={{ padding:'6px 10px', borderRadius:6, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444', fontSize:10, marginTop:6, textAlign:'center' }}>{cyclesError}</div>}
          </div>

          {/* Empty state */}
          {!macrocycle && !cyclesError && (
            <div style={{ padding:24, borderRadius:14, background:'rgba(24,24,27,0.08)', border:'1px solid rgba(255,255,255,0.04)', textAlign:'center' }}>
              <div style={{ fontSize:28, marginBottom:6 }}>🔄</div>
              <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)', marginBottom:4 }}>Макроцикл ещё не сгенерирован</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)' }}>Выберите параметры выше и нажмите «Сгенерировать макроцикл»</div>
            </div>
          )}

          {macrocycle && (() => {
            const gCard: React.CSSProperties = { padding:12, borderRadius:14, background:'rgba(24,24,27,0.12)', border:'1px solid rgba(255,255,255,0.04)', marginBottom:8 };
            const gLabel: React.CSSProperties = { fontSize:10, color:'rgba(255,255,255,0.35)', fontWeight:500, letterSpacing:'0.3px', textTransform:'uppercase', marginBottom:8 };
            // Determine cycle type name
            const ctName = cycleType === 'auto' ? 'Авто' : ({ bb_mass:'Масса', bb_specialization:'Специализация', pl_peaking:'Пауэрлифтинг', wl_tech:'Тяжелоатлет', cf_cond:'Кроссфит', rehab:'Реабилитация' } as Record<string,string>)[cycleType] || 'Авто';
            const goalName = GOALS.find(g => g.value === macrocycle.goal)?.label || macrocycle.goal;
            const levelName = LEVELS.find(l => l.value === macrocycle.level)?.label || macrocycle.level;
            return (<>
              {/* Volume/intensity chart */}
              <div style={gCard}>
                <div style={gLabel}>📊 Объём и интенсивность по неделям</div>
                <div style={{ display:'flex', gap:1, height:80, alignItems:'flex-end' }}>
                  {(macrocycle.mesocycles || []).flatMap(mc => mc.microcycles || []).map((mc, wi) => {
                    const isCurrent = wi + 1 === selectedWeek;
                    const volH = Math.max(4, (mc?.volumeMultiplier || 1) * 35);
                    const intH = Math.max(4, (mc?.rpeTarget || 7) * 5);
                    const color = mc?.mesocycleType === 'accumulation' ? '#22c55e' :
                                 mc?.mesocycleType === 'intensification' ? '#eab308' :
                                 mc?.mesocycleType === 'peaking' ? '#ef4444' : '#6b7280';
                    return (
                      <div key={wi} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:1, cursor:'pointer' }}
                          onClick={() => { setSelectedWeek(wi + 1); setTab('constructor'); }}>
                        <div style={{ width:'70%', height:volH, background:color, borderRadius:'2px 2px 0 0', opacity: isCurrent ? 1 : 0.4, transition:'height 0.2s' }} />
                        <div style={{ width:'40%', height:intH, background:color, borderRadius:'2px 2px 0 0', opacity: isCurrent ? 0.8 : 0.3 }} />
                        <span style={{ fontSize:7, color: isCurrent ? 'var(--accent)' : 'rgba(255,255,255,0.3)', fontWeight: isCurrent ? 700 : 400 }}>{wi + 1}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display:'flex', justifyContent:'center', gap:12, fontSize:8, color:'rgba(255,255,255,0.3)', marginTop:4 }}>
                  <span><span style={{ color:'#22c55e' }}>■</span> Накопление</span>
                  <span><span style={{ color:'#eab308' }}>■</span> Интенсификация</span>
                  <span><span style={{ color:'#ef4444' }}>■</span> Пик</span>
                  <span><span style={{ color:'#6b7280' }}>■</span> Разгрузка</span>
                </div>
              </div>

              {/* Macrocycle header + mesocycles */}
              <div style={gCard}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                  <span style={gLabel}>📅 {macrocycle.totalWeeks}-недельный макроцикл</span>
                  <span style={{ fontSize:8, padding:'2px 6px', borderRadius:4, background:'rgba(0,230,138,0.1)', color:'#00e68a' }}>{ctName}</span>
                </div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)', marginBottom:6 }}>
                  {goalName} • {levelName} • Phase curve: {cycleType === 'bb_mass' || goal === 'bulk' ? '🌊 Wave' : goal === 'strength' || cycleType === 'pl_peaking' ? '📈 Linear' : goal === 'rehab' ? '📉 Inverted' : '⚖️ Balanced'}
                  {cycleType !== 'auto' && <span style={{ marginLeft:6, color:'rgba(255,255,255,0.2)' }}>| {({ bb_mass:'Высокий объём, изоляция', bb_specialization:'Акцент на слабые группы', pl_peaking:'Силовой пик, низкий объём', wl_tech:'Технические движения', cf_cond:'Метконы, круговые', rehab:'Восстановление' } as Record<string,string>)[cycleType]}</span>}
                </div>
                {macrocycle.mesocycles.map((mc, mi) => (
                  <div key={mi} style={{ marginBottom:6, borderRadius:10, overflow:'hidden', background:'rgba(255,255,255,0.02)', border: expandedMeso === mi ? '1px solid rgba(0,230,138,0.15)' : '1px solid rgba(255,255,255,0.03)' }}
                    onClick={() => setExpandedMeso(expandedMeso === mi ? null : mi)}>
                    <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 8px', cursor:'pointer' }}>
                      <span style={{ fontWeight:600, fontSize:11, color:'rgba(255,255,255,0.7)' }}>
                        {PHASE_LABELS[mc.type] || 'Рабочая фаза'} <span style={{ fontSize:8, color:'rgba(255,255,255,0.2)' }}>Мезо {mi + 1}</span>
                      </span>
                      <span style={{ fontSize:9, color:'rgba(255,255,255,0.3)' }}>{mc.weeks} нед ({mc.weekStart + 1}–{mc.weekStart + mc.weeks}) {expandedMeso === mi ? '▴' : '▾'}</span>
                    </div>
                    <div style={{ fontSize:8, color:'rgba(255,255,255,0.25)', padding:'0 8px 4px' }}>
                      {PHASE_HINTS[mc.type] || 'Стабильная рабочая фаза с контролем объёма, интенсивности и восстановления.'}
                    </div>
                    {/* Week squares */}
                    <div style={{ display:'flex', gap:3, flexWrap:'wrap', padding:'0 8px 6px' }}>
                      {Array.from({ length: mc.weeks }, (_, wi) => {
                        const weekNum = mc.weekStart + wi + 1;
                        const micro = mc.microcycles?.[wi];
                        const isDeload = micro?.isDeload;
                        return <div key={wi} style={{
                          width:22, height:22, borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center',
                          background: selectedWeek === weekNum ? 'rgba(0,230,138,0.3)' : isDeload ? 'rgba(107,114,128,0.2)' : 'rgba(255,255,255,0.04)',
                          border: selectedWeek === weekNum ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.06)',
                          fontSize:8, color: selectedWeek === weekNum ? 'var(--accent)' : 'rgba(255,255,255,0.4)',
                          cursor:'pointer', transition:'all 0.15s',
                        }} onClick={(e) => { e.stopPropagation(); setSelectedWeek(weekNum); setTab('constructor'); }}>
                          {weekNum}
                        </div>;
                      })}
                    </div>
                    {/* Expanded detail */}
                    {expandedMeso === mi && (
                      <div style={{ borderTop:'1px solid rgba(255,255,255,0.04)', padding:'6px 8px' }}>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4, marginBottom:4 }}>
                          {[
                            { label:'Тип', value: mc.type || 'Рабочий', color:'var(--accent)' },
                            { label:'Объём', value: `${(mc.microcycles?.[0]?.volumeMultiplier ?? 1).toFixed(1)}×`, color:'#60a5fa' },
                            { label:'RIR', value: `${mc.microcycles?.[0]?.rirRange?.[0] ?? 1}-${mc.microcycles?.[0]?.rirRange?.[1] ?? 3}`, color:'#f59e0b' },
                          ].map((s,i) => <div key={i} style={{ background:'rgba(255,255,255,0.02)', borderRadius:6, padding:'3px 6px', textAlign:'center' }}>
                            <div style={{ fontSize:7, color:'rgba(255,255,255,0.3)' }}>{s.label}</div>
                            <div style={{ fontSize:10, fontWeight:700, color:s.color }}>{s.value}</div>
                          </div>)}
                        </div>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4, fontSize:8 }}>
                          {[
                            { label:'RPE', value: `${mc.microcycles?.[0]?.rpeTarget ?? 7}`, color:'var(--accent)' },
                            { label:'Сплит', value: goal === 'bulk' ? 'Гипертрофия' : goal === 'strength' ? 'Сила' : goal === 'cut' ? 'Сушка' : 'Баланс', color:'#a78bfa' },
                            { label:'Дней', value: `${daysPerWeek}`, color:'#f59e0b' },
                          ].map((s,i) => <div key={i} style={{ background:'rgba(255,255,255,0.02)', borderRadius:6, padding:'3px', textAlign:'center' }}>
                            <span style={{ color:'rgba(255,255,255,0.3)' }}>{s.label}: <b style={{ color:s.color }}>{s.value}</b></span>
                          </div>)}
                        </div>
                        {mc.microcycles && mc.microcycles.length > 0 && (
                          <div style={{ fontSize:8, color:'rgba(255,255,255,0.25)', marginTop:4 }}>
                            Микроциклов: {mc.microcycles.length} | Прогрессия: <b style={{ color:'var(--accent)' }}>{mc.type === 'accumulation' ? '+объём' : mc.type === 'intensification' ? '+интенсивность' : mc.type === 'peaking' ? 'пик' : 'разгрузка'}</b>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Projected max-out */}
              {diaryStats.length > 0 && (
                <div style={{ ...gCard, border:'1px solid rgba(0,230,138,0.15)' }}>
                  <div style={gLabel}>🎯 Прогноз к концу макроцикла</div>
                  <div style={{ fontSize:9, color:'rgba(255,255,255,0.3)', marginBottom:4 }}>
                    {macrocycle?.totalWeeks || 12} нед × {(trainingOutput?.estimatedProgress || 2)}%/нед прогресс
                  </div>
                  {diaryStats.slice(0,3).map(s => {
                    const projected = Math.round(s.max1RM * (1 + (trainingOutput?.estimatedProgress || 2) / 100 * (macrocycle?.totalWeeks || 12)));
                    const gain = projected - Math.round(s.max1RM);
                    return <div key={s.exerciseId} style={{ display:'flex', justifyContent:'space-between', fontSize:9, padding:'2px 0' }}>
                      <span style={{ color:'rgba(255,255,255,0.5)' }}>{s.exerciseName}</span>
                      <span style={{ color:'rgba(255,255,255,0.3)' }}>{Math.round(s.max1RM)} → <b style={{ color:'#34d399' }}>{projected}</b> кг <span style={{ color:'#34d399' }}>(+{gain})</span></span>
                    </div>;
                  })}
                </div>
              )}

              {/* Phase params */}
              <div style={gCard}>
                <div style={gLabel}>📊 Параметры фаз</div>
                {macrocycle?.mesocycles?.map((mc, mi) => {
                  const firstMicro = mc.microcycles?.[0];
                  const vol = firstMicro?.volumeMultiplier || 1;
                  const rirLo = firstMicro?.rirRange?.[0] ?? 1;
                  const rirHi = firstMicro?.rirRange?.[1] ?? 3;
                  const rpe = firstMicro?.rpeTarget || 7;
                  return <div key={mi} style={{ marginBottom:3, padding:'4px 6px', borderRadius:6, background:'rgba(255,255,255,0.02)', fontSize:9 }}>
                    <span style={{ fontWeight:600, color:'rgba(255,255,255,0.6)' }}>{PHASE_LABELS[mc.type] || mc.type || 'Фаза'}</span>
                    <span style={{ color:'rgba(255,255,255,0.25)', marginLeft:4 }}>Объём: {vol}× | RIR: {rirLo}-{rirHi} | RPE: {rpe} | {mc.weeks} нед</span>
                  </div>;
                })}
              </div>

              {/* Save to my cycles */}
              <button onClick={() => { try {
                const existing = JSON.parse(localStorage.getItem('myTrainingCycles') || '[]');
                existing.push({ id:'cycle_' + Date.now(), name: (macrocycle?.totalWeeks || 12) + '-нед ' + goalName, date: new Date().toISOString(), weeks: macrocycle?.totalWeeks || 12, goal, level, days: daysPerWeek });
                localStorage.setItem('myTrainingCycles', JSON.stringify(existing));
                setMyCycleMsg('✅ Цикл добавлен в «Мои циклы»!');
                setTimeout(() => setMyCycleMsg(''), 3000);
              } catch {} }} style={{
                width:'100%', padding:9, borderRadius:10, border:'1px solid rgba(0,230,138,0.3)', cursor:'pointer',
                background:'rgba(0,230,138,0.06)', color:'var(--accent)', fontWeight:600, fontSize:11,
              }}>📋 В мои циклы</button>
              {myCycleMsg && <div style={{ padding:'6px 10px', borderRadius:6, background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.2)', color:'#8b5cf6', fontSize:10, marginTop:4, textAlign:'center' }}>{myCycleMsg}</div>}
            </>);
          })()}
          </div>
          </InfoErrorBoundary>
        )}
      {/* history, analytics tabs moved to TrainingDiaryHub (diary tab sub-modes) */}
      {tab === 'library' && (
  <InfoErrorBoundary label="Каталог циклов">
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)', marginBottom: 2 }}>📖 Каталог тренировочных циклов</div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Справочник готовых циклов (СРЦ / блочные / встроенные) с описанием, механизмом работы и условиями. Методики и программы — в соответствующих вкладках группы «Библиотека».</div>
      <ExpandableCard title="🔄 Каталог циклов (СРЦ / блоки / встроенные)" icon="📖" short="Все доступные циклы с полным описанием. Нажмите, чтобы развернуть." full={
        <div>
          {LMS_CYCLES.map(c => (
            <ExpandableCard key={c.meta.id} title={c.meta.title} icon="" accent="#00e68a" short={c.meta.description} full={<><div style={{ marginBottom: 6 }}>{c.meta.howItWorks}</div>{c.meta.conditions.length > 0 && <div><b>Условия:</b><ul style={{ margin: '4px 0 0 16px', padding: 0 }}>{c.meta.conditions.map((cond, i) => <li key={i} style={{ marginBottom: 2 }}>{cond}</li>)}</ul></div>}</>} />
          ))}
        </div>
      } />
    </div>
  </InfoErrorBoundary>
)}
{tab === 'methods' && <InfoErrorBoundary label="Методы"><MethodsTab linked={linked} trainingOutput={trainingOutput} diaryStats={diaryStats} historyWorkouts={historyWorkouts} goal={goal} level={level} daysPerWeek={daysPerWeek} recovery={recovery} fatigue={fatigue} appliedMethods={appliedMethods} onToggleMethod={(name, category) => setAppliedMethods(prev => { const next = { ...prev }; if (next[category] === name) delete next[category]; else next[category] = name; return next; })} onApplyComposition={() => { applyMethodComposition(); setTab('constructor'); }} /></InfoErrorBoundary>}
      {tab === 'programs' && <InfoErrorBoundary label="Программы"><ProgramsTab selectedProgram={selectedProgram} setSelectedProgram={setSelectedProgram} onAddToMyTraining={(exs) => setCustomExercises(prev => [...prev, ...exs])} /></InfoErrorBoundary>}
      {tab === 'timers' && <InfoErrorBoundary label="Таймеры"><TimersTab /></InfoErrorBoundary>}
      {/* visual, progress tabs moved to TrainingDiaryHub (diary tab sub-modes) */}
        {tab === 'exercise_lab' && <InfoErrorBoundary label="Лаборатория упражнений"><ExerciseLab /></InfoErrorBoundary>}
       {tab === 'calc_plates' && <InfoErrorBoundary label="Калькулятор блинов"><PlateCalculator /></InfoErrorBoundary>}
       {tab === 'calc_vbt' && <InfoErrorBoundary label="VBT-калькулятор"><VBTCalculator /></InfoErrorBoundary>}
       {tab === 'calc_mrv' && <InfoErrorBoundary label="Оценщик MRV"><MRVEstimator /></InfoErrorBoundary>}

      {tab === 'calc_1rm' && <InfoErrorBoundary label="Калькулятор 1RM"><OneRmCalcTab /></InfoErrorBoundary>}
      {tab === 'pl_norms' && <InfoErrorBoundary label="Нормативы ПЛ"><PlNormsCalcTab /></InfoErrorBoundary>}
      {tab === 'import_data' && <InfoErrorBoundary label="Импорт CSV"><CsvImportTab onDone={loadDiaryStats} /></InfoErrorBoundary>}
      {tab === 'volume' && <InfoErrorBoundary label="Расчёт объёма"><VolumeOptimizerTab /></InfoErrorBoundary>}

      {tab === 'calc_quality' && <InfoErrorBoundary label="Качество программы"><CalcQualityTab plan={manualResult} level={level} onBuildPlan={() => setTab('constructor')} /></InfoErrorBoundary>}
      {tab === 'pl_pro' && <InfoErrorBoundary label="Pro ПЛ-инструменты"><ProPlToolsTab /></InfoErrorBoundary>}
      {tab === 'rel_strength' && <InfoErrorBoundary label="Относительная сила"><RelativeStrengthCalcTab /></InfoErrorBoundary>}
      {tab === 'calendar' && <InfoErrorBoundary label="Календарь тренировок"><TrainingCalendarTab /></InfoErrorBoundary>}
      {tab === 'periodization_designer' && <InfoErrorBoundary label="Дизайнер периодизации"><PeriodizationDesignerTab /></InfoErrorBoundary>}
      {tab === 'deload_scheduler' && <InfoErrorBoundary label="Планировщик делода"><DeloadSchedulerTab /></InfoErrorBoundary>}
      {tab === 'meso_progression' && <InfoErrorBoundary label="Прогрессия мезо"><div style={{ maxWidth: 720, margin: '0 auto', padding: 12 }}><MesocycleProgressionCard weeks={mesoLength} goal={goal === 'strength' ? 'strength' : goal === 'bulk' ? 'hypertrophy' : 'hypertrophy'} /></div></InfoErrorBoundary>}
      {tab === 'calc_taper' && <InfoErrorBoundary label="Тапер-планер"><TaperPlannerTab /></InfoErrorBoundary>}
      {tab === 'calc_plates' && <InfoErrorBoundary label="Калькулятор блинов"><PlateCalcTab /></InfoErrorBoundary>}
      {tab === 'calc_vbt' && <InfoErrorBoundary label="VBT / скорость"><VBTCalcTab /></InfoErrorBoundary>}
      {tab === 'calc_fatigue' && <InfoErrorBoundary label="Индекс усталости"><FatigueIndexTab /></InfoErrorBoundary>}
      {tab === 'calc_mrv' && <InfoErrorBoundary label="Оценщик MRV"><MRVEstimatorTab /></InfoErrorBoundary>}
      {tab === 'tempo' && <InfoErrorBoundary label="Темп повторений"><TempoTab /></InfoErrorBoundary>}
      {tab === 'meso_tracker' && <InfoErrorBoundary label="Трекер мезоциклов"><MesocycleTrackerTab /></InfoErrorBoundary>}
      {tab === 'specialization' && <InfoErrorBoundary label="Специализация"><SpecializationTab /></InfoErrorBoundary>}
      {tab === 'peaking' && <InfoErrorBoundary label="Пик-протоколы"><PeakingProtocolTab /></InfoErrorBoundary>}
      {tab === 'conjugate' && <InfoErrorBoundary label="Конъюгат"><ConjugateTab /></InfoErrorBoundary>}
      {tab === 'mmc_tracking' && <InfoErrorBoundary label="MMC-трекинг"><MMCTrackingCard /></InfoErrorBoundary>}

      {/* ═══════════ MY TRAINING TAB ═══════════ */}
      {tab === 'mytraining' && (
        <InfoErrorBoundary label="Мои тренировки">
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <MyTrainingTab customExercises={customExercises} setCustomExercises={setCustomExercises} goal={goal} level={level} daysPerWeek={daysPerWeek} mesoLength={mesoLength} />
        </div>
        </InfoErrorBoundary>
      )}

      {/* reports tab moved to TrainingDiaryHub (diary tab sub-mode) */}
     </div>
      )}
    </div>
  );
};

import { MyTrainingTab } from './TrainingScreen_parts/MyTrainingTab';
import ExerciseLabCatalog from './TrainingScreen_parts/ExerciseLabCatalog';
import { CalcQualityTab } from './TrainingScreen_parts/CalcQualityTab';
import { MuscleProgressCard } from './TrainingScreen_parts/MuscleProgressCard';
import { MicrocyclePlannerCard } from './TrainingScreen_parts/MicrocyclePlannerCard';
import { TrainingRecommendationsCard } from './TrainingScreen_parts/TrainingRecommendationsCard';
import { OneRmCalcTab } from './TrainingScreen_parts/OneRmCalcTab';
import { PlNormsCalcTab } from './TrainingScreen_parts/PlNormsCalcTab';
import { LiftHistoryCard } from './TrainingScreen_parts/LiftHistoryCard';
import { VolumeTrendCard } from './TrainingScreen_parts/VolumeTrendCard';
import AllExercisesTrendCard from './TrainingScreen_parts/AllExercisesTrendCard';
import StandardForecastCard from './TrainingScreen_parts/StandardForecastCard';
import VolumeRecoveryCorrelationCard from './TrainingScreen_parts/VolumeRecoveryCorrelationCard';
import StickingPointAnalysisCard from './TrainingScreen_parts/StickingPointAnalysisCard';
import { LoadRadarCard } from './TrainingScreen_parts/LoadRadarCard';
import { WeekCompareCard } from './TrainingScreen_parts/WeekCompareCard';
import { CsvImportTab } from './TrainingScreen_parts/CsvImportTab';
import { usePlanGeneration } from '../hooks/usePlanGeneration';
import { PowerliftingTab } from './TrainingScreen_parts/PowerliftingTab';
import { BodybuildingTab } from './TrainingScreen_parts/BodybuildingTab';
import { MethodsTab } from './TrainingScreen_parts/MethodsTab';
import { VisualTab } from './TrainingScreen_parts/VisualTab';
import { AnalyticsTab } from './TrainingScreen_parts/AnalyticsTab';
import { ProgramsTab } from './TrainingScreen_parts/ProgramsTab';
import { VolumeOptimizerTab } from './TrainingScreen_parts/VolumeOptimizerTab';
import ExerciseLab from './TrainingScreen_parts/ExerciseLab';
import { TrainingLoadCalculator } from './TrainingScreen_parts/TrainingLoadCalculator';
import { TonnageCalcTab } from './TrainingScreen_parts/TonnageCalcTab';
import { WhatIfCard } from './TrainingScreen_parts/WhatIfCard';
import { ReadinessForecastCard } from './TrainingScreen_parts/ReadinessForecastCard';
import { MethodologyEncyclopedia } from './TrainingScreen_parts/MethodologyEncyclopedia';
import { labTrainingAdjust } from './TrainingScreen_parts/lab-training-adjust';
import { appendReadinessToday, loadReadinessHistory } from './TrainingScreen_parts/readiness-history';
import { useTrainingProfile } from './TrainingScreen_parts/training-profile';
import { TrainingProfileCard } from './TrainingScreen_parts/TrainingProfileCard';
import { loadSRPESessions } from '../../engines/pro/srpe-store';
import { acuteChronicRatio, toDailyLoads, weeklyMonotony } from '../../engines/pro/training-load.engine';
import { PopupSelect, PopupNumber, ExpandableCard } from './SRCBBScreen_parts/TrainingPopups';
import { LMS_CYCLES } from '../../data/lms-cycles/lms-cycle-index';
import { WOMENS_PROGRAMS, CUSTOM_PROGRAMS } from './TrainingScreen_parts/programs-data';
import { SessionPlayer, type PlayerDay } from './SRCBBScreen_parts/SessionPlayer';
import { TimersTab } from './TrainingScreen_parts/TimersTab';
import { ProgressTab } from './TrainingScreen_parts/ProgressTab';
import { StrengthLevelCard } from './TrainingScreen_parts/StrengthLevelCard';
import { StructuredAnalyticsCard } from './TrainingScreen_parts/StructuredAnalyticsCard';
import { TrainingMixTab } from './TrainingScreen_parts/TrainingMixTab';
import { ProPlToolsTab } from './TrainingScreen_parts/ProPlToolsTab';
import { RelativeStrengthCalcTab } from './TrainingScreen_parts/RelativeStrengthCalcTab';
import { TrainingCalendarTab } from './TrainingScreen_parts/TrainingCalendarTab';
import { PeriodizationDesignerTab } from './TrainingScreen_parts/PeriodizationDesignerTab';
import { DeloadSchedulerTab } from './TrainingScreen_parts/DeloadSchedulerTab';
import { MesocycleProgressionCard } from './TrainingScreen_parts/MesocycleProgressionCard';
import { TaperPlannerTab } from './TrainingScreen_parts/TaperPlannerTab';
import { PlateCalcTab } from './TrainingScreen_parts/PlateCalcTab';
import { VBTCalcTab } from './TrainingScreen_parts/VBTCalcTab';
import { FatigueIndexTab } from './TrainingScreen_parts/FatigueIndexTab';
import { MRVEstimatorTab } from './TrainingScreen_parts/MRVEstimatorTab';
import { TempoTab } from './TrainingScreen_parts/TempoTab';
import { MesocycleTrackerTab } from './TrainingScreen_parts/MesocycleTrackerTab';
import { RIRCalibrationCard } from './TrainingScreen_parts/RIRCalibrationCard';
import MesoCorrectionCard from './TrainingScreen_parts/MesoCorrectionCard';
import SpecializationTab from './TrainingScreen_parts/SpecializationTab';
import PeakingProtocolTab from './TrainingScreen_parts/PeakingProtocolTab';
import ConjugateTab from './TrainingScreen_parts/ConjugateTab';
import MMCTrackingCard from './TrainingScreen_parts/MMCTrackingCard';
import { loadRirCalibrationStats } from '../../engines/meso-correction.engine';

import { TrainingConstructor } from './TrainingScreen_parts/TrainingConstructor';
