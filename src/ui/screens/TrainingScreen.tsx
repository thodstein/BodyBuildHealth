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
import { PlannerPlAuto } from './TrainingScreen_parts/PlannerPlAuto';
import { PlannerBbAuto } from './TrainingScreen_parts/PlannerBbAuto';
import { CardioConstructor } from './TrainingScreen_parts/CardioConstructor';
import { ProgramManagerPanelWithProvider as ProgramManagerPanel } from './TrainingScreen_parts/ProgramManagerPanel';
import { DiaryAnalyticsZone } from './TrainingScreen_parts/DiaryAnalyticsZone';
import { LibraryZone } from './TrainingScreen_parts/LibraryZone';
import { LoadSafetyCard } from './TrainingScreen_parts/LoadSafetyCard';
import { SplitGenCard } from './TrainingScreen_parts/SplitGenCard';
import { PriRepPatternCard } from './TrainingScreen_parts/PriRepPatternCard';
import { TrainingMixTab } from './TrainingScreen_parts/TrainingMixTab';
import { MixPresetsCard } from './TrainingScreen_parts/MixPresetsCard';

import { PlannerToolsPanel } from './TrainingScreen_parts/PlannerToolsPanel';
import { StrengthAnalysisHub } from './TrainingScreen_parts/StrengthAnalysisHub';
import { LoadManagementHub } from './TrainingScreen_parts/LoadManagementHub';
import TrainingIntelligenceDashboard from './TrainingScreen_parts/TrainingIntelligenceDashboard';
import { DiagnosticsHub } from './TrainingScreen_parts/DiagnosticsHub';
import { PeriodizationHub } from './TrainingScreen_parts/PeriodizationHub';
import { TaperPlannerTab } from './TrainingScreen_parts/TaperPlannerTab';
import { ExecutionZone } from './TrainingScreen_parts/ExecutionZone';
import { TrainingDiaryHub } from './TrainingScreen_parts/TrainingDiaryHub';

import {
  WARMUP_LABELS, GOALS, LEVELS, MUSCLE_GROUPS, GROUP_LABELS, EQUIP_LABELS, JOINT_LABELS,
  PHASE_LABELS, PHASE_HINTS, TAB_LABELS,
  type TrainingTab, type TrainingPage,
  type PlanningTrack, getPlanningTrack, setPlanningTrack,
} from './TrainingScreen_parts/shared';
import { ZONES, ZONE_ORDER, zoneForTab, PLANNER_MODES, type TrainingZone } from './TrainingScreen_parts/nav';
import { hapticImpact } from '../../core/telegram';
import { InfoErrorBoundary } from './SupportScreen_parts/SupportScreenData';

export const TrainingScreen: React.FC<{ initialSubTab?: string }> = ({ initialSubTab }) => {
  const linked = useDataLink();
  const readiness = linked.readiness;
  const labAnalysis = linked.labAnalysis;
  const diary = useMemo(() => new StrengthDiary(), []);
  // 5-зонная навигация. Зона 'planner' использует сегментированный переключатель
  // (ПЛ-авто / ББ-авто / Ручной сбор) вместо отдельных вкладок-дублей.
  const [planningTrack, setPlanningTrackState] = useState<PlanningTrack>(getPlanningTrack());
  const [tab, setTab] = useState<TrainingTab>('runtime');
  const [page, setPage] = useState<TrainingPage>('hero');
  const [zone, setZone] = useState<TrainingZone | null>(null);
  const switchPlanningTrack = (t: PlanningTrack) => {
    setPlanningTrack(t);
    setPlanningTrackState(t);
    setZone('planner');
    setPage('tabs');
  };
  // Переход в зону «Планировщик» → режим «Ручной сбор» (внешние ссылки setTab('constructor'))
  const goPlannerManual = useCallback(() => { setZone('planner'); switchPlanningTrack('manual'); }, []);
  // Универсальный переход на вкладку с автоматическим выбором её зоны
  const goTab = useCallback((t: TrainingTab) => { setZone(zoneForTab(t)); setTab(t); }, []);

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

  // (manualResult state removed — now uses ProgramManagerPanel + CalcQualityTab reads UserProgram from localStorage)

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
  const safeParsePlRuntime = (raw: string | null): { days: PlayerDay[]; focus: string; week: number; track: string } | null => {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Array.isArray(parsed.days) && parsed.days.length > 0) {
        return parsed;
      }
      return null;
    } catch { return null; }
  };
  const [plRuntime, setPlRuntime] = useState<{ days: PlayerDay[]; focus: string; week: number; track: string } | null>(() => safeParsePlRuntime(localStorage.getItem('he_pl_runtime')));
  const [plRunOpen, setPlRunOpen] = useState(false);
  useEffect(() => { if (tab === 'runtime') { setPlRuntime(safeParsePlRuntime(localStorage.getItem('he_pl_runtime'))); } }, [tab]);
  useEffect(() => { if (linked.readiness) appendReadinessToday(linked.readiness.recovery ?? 70, linked.readiness.fatigue ?? 30); }, [linked.readiness]);
  // Open diary tab directly when navigated from Profile → diaries → Тренировки
  useEffect(() => {
    try {
      if (localStorage.getItem('he_nav_training_diary') === '1') {
        localStorage.removeItem('he_nav_training_diary');
        setZone('diary'); setPage('tabs'); setTab('diary');
      }
    } catch {}
  }, []);
  useEffect(() => {
    const diaryTabs = new Set<TrainingTab>(['diary', 'history', 'analytics', 'progress', 'calendar', 'checkin', 'mmc_tracking', 'reports']);
    if (initialSubTab === 'reports') {
      setZone('diary'); setPage('tabs'); setTab('reports');
    } else if (initialSubTab === 'analytics') {
      setZone('diary'); setPage('tabs'); setTab('analytics');
    } else if (initialSubTab && diaryTabs.has(initialSubTab as TrainingTab)) {
      setZone('diary'); setPage('tabs'); setTab(initialSubTab as TrainingTab);
    }
  }, [initialSubTab]);
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
        const parsed = val === 'bb' ? val : 'pl';
        setPlanningTrack(parsed);
        setPlanningTrackState(parsed);
        setZone('planner'); setPage('tabs');
      }
      if (e.key === 'he_training_tab') {
        const val = localStorage.getItem('he_training_tab') as TrainingTab | null;
        if (val) {
          const z = zoneForTab(val);
          setZone(z);
          if (z !== 'planner') setTab(val);
          setPage('tabs');
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Глобальный хендлер внешней навигации (SRCBB → «Качество программы» и др.)
  useEffect(() => {
    const handler = (t: string) => {
      if (t === 'programcalc') { setZone('calculators'); setTab('calc_quality'); setPage('tabs'); return; }
      const tabId = t as TrainingTab;
      if (TAB_LABELS[tabId] && zoneForTab(tabId) !== 'planner') {
        setZone(zoneForTab(tabId)); setTab(tabId); setPage('tabs');
      }
    };
    (window as any).__navigateToTrainingTab = handler;
    return () => { delete (window as any).__navigateToTrainingTab; };
  }, []);

  // Держим активную вкладку валидной для текущей зоны
  useEffect(() => {
    if (!zone) return;
    if (zone === 'planner') { setTab('constructor'); return; }
    if (zone === 'calculators') return; // Не переключаем — дашборд рендерится при tab вне CALC_TABS
    const visible = ZONES[zone].tabs;
    if (!visible.includes(tab)) setTab(visible[0]);
  }, [zone]);

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


  return (
    <div className="screen training-screen" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto', padding: 0, WebkitOverflowScrolling: 'touch' }}>

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
              {ZONE_ORDER.map(z => {
                const group = ZONES[z];
                return (
                <button key={z} onClick={() => { hapticImpact('light'); setPage('tabs'); setZone(z); if (z === 'calculators') setTab('runtime'); else if (z !== 'planner') setTab(group.tabs[0]); }} style={{
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
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', lineHeight: 1.3 }}>{group.subtitle}</div>
                  </div>
                  <span style={{ color: group.color, fontSize: 16, opacity: 0.6 }}>→</span>
                </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB VIEW HEADER (компактный, без обрезки) ─── */}
      {page !== 'hero' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', flexShrink: 0, borderBottom: '1px solid var(--border)', minHeight: 36 }}>
          <button onClick={() => { setPage('hero'); setZone(null); }} style={{
            padding: '4px 8px', cursor: 'pointer', fontSize: 13,
            color: 'var(--text-dim)', border: 'none', background: 'transparent',
            display: 'flex', alignItems: 'center', gap: 3,
            fontWeight: 600, whiteSpace: 'nowrap',
          }}>← На главную</button>
          {zone && (
            <span style={{ fontSize: 11, fontWeight: 700, color: ZONES[zone].color, marginLeft: 2, whiteSpace: 'nowrap', overflow: 'visible' }}>{ZONES[zone].title}</span>
          )}
        </div>
      )}

      {page !== 'hero' && (
      <div style={{ padding: '0 4px' }}>
      {zone && (
        <h2 style={{ margin: '0 0 6px', fontSize: 14, color: ZONES[zone].color, wordBreak:'break-word' }}>{ZONES[zone].title}</h2>
      )}

      {zone && zone !== 'planner' && zone !== 'calculators' && (() => {
        const cats = ZONES[zone].categories;
        if (cats) {
          return (
            <div style={{ marginBottom: 8 }}>
              {cats.map(cat => (
                <div key={cat.label} style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', margin: '2px 0 2px', textTransform: 'uppercase', letterSpacing: 0.3 }}>{cat.icon} {cat.label}</div>
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {cat.tabs.map(k => (
                      <button key={k} onClick={() => { hapticImpact('light'); goTab(k); }} style={{
                        padding: '5px 10px', borderRadius: 20, fontSize: 10, fontWeight: 600,
                        background: tab === k ? 'var(--accent)' : 'var(--bg-secondary)',
                        color: tab === k ? '#000' : 'var(--text-dim)', border: 'none', cursor: 'pointer',
                        transition: 'all 0.2s', whiteSpace: 'normal', wordBreak: 'break-word',
                      }}>{TAB_LABELS[k]}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        }
        return (
          <div style={{ display: 'flex', gap: 3, marginBottom: 8, flexWrap: 'wrap' }}>
            {ZONES[zone].tabs.map(k => (
              <button key={k} onClick={() => { hapticImpact('light'); goTab(k); }} style={{
                padding: '5px 10px', borderRadius: 20, fontSize: 10, fontWeight: 600,
                background: tab === k ? 'var(--accent)' : 'var(--bg-secondary)',
                color: tab === k ? '#000' : 'var(--text-dim)', border: 'none', cursor: 'pointer',
                transition: 'all 0.2s', whiteSpace: 'normal', wordBreak: 'break-word',
              }}>{TAB_LABELS[k]}</button>
            ))}
          </div>
        );
      })()}

      {/* Readiness card — only on training tabs, compact for mobile */}
      {readiness && zone === 'training' && (
        <div className="card" style={{ marginBottom: 6, padding: '8px 10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <h4 style={{ margin: 0, fontSize: 11 }}>📊 Готовность к тренировке</h4>
            <span style={{ fontSize: 10, color: readiness.recovery >= 70 ? '#22c55e' : readiness.recovery >= 40 ? '#eab308' : '#ef4444', fontWeight: 700 }}>
              {Math.round(readiness.recovery)}%
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            {[
              { label: 'Восст.', value: readiness.recovery, color: readiness.recovery >= 70 ? '#22c55e' : '#eab308' },
              { label: 'Питание', value: readiness.nutrition ?? 50, color: (readiness.nutrition ?? 50) >= 70 ? '#22c55e' : '#eab308' },
              { label: 'Сон', value: readiness.sleep ?? 50, color: (readiness.sleep ?? 50) >= 70 ? '#22c55e' : '#eab308' },
              { label: 'Поддержка', value: readiness.support ?? 50, color: (readiness.support ?? 50) >= 70 ? '#22c55e' : '#eab308' },
              { label: 'Усталость', value: 100 - (readiness.fatigue ?? 50), color: (readiness.fatigue ?? 50) < 40 ? '#22c55e' : '#ef4444' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text-dim)', minWidth: 38, whiteSpace:'normal' }}>{item.label}</span>
                <div style={{ flex: 1, background: 'var(--bg-secondary)', borderRadius: 3, height: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, Math.max(0, item.value))}%`, height: '100%', background: item.color, borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: item.color, minWidth: 22, textAlign: 'right' }}>{Math.round(item.value)}%</span>
              </div>
            ))}
          </div>
          {(() => { const srpe = loadSRPESessions(); if (srpe.length < 2) return null; const acwr = acuteChronicRatio(toDailyLoads(srpe)); const zoneColor = acwr.ratio > 1.5 ? '#ef4444' : acwr.ratio > 1.3 ? '#eab308' : acwr.ratio < 0.8 ? '#3b82f6' : '#22c55e'; const zoneLabel = acwr.ratio > 1.5 ? 'опасно' : acwr.ratio > 1.3 ? 'осторожно' : acwr.ratio < 0.8 ? 'недотрен' : 'оптимум'; return <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}><span style={{ color: 'var(--text-dim)', minWidth: 38 }}>Нагрузка</span><div style={{ flex: 1, background: 'var(--bg-secondary)', borderRadius: 3, height: 4, overflow: 'hidden' }}><div style={{ width: Math.min(100, acwr.ratio * 50) + '%', height: '100%', background: zoneColor, borderRadius: 3 }} /></div><span style={{ fontWeight: 700, color: zoneColor, minWidth: 50, textAlign: 'right', fontSize:11 }}>ACWR {acwr.ratio.toFixed(2)} · {zoneLabel}</span></div>; })()}
        </div>
      )}

      {/* Training Score Card перенесён в подвкладку Восстановление тренировочного блока */}

      {/* ═══════════ PLAN TAB ═══════════ */}
      
      {/* ═══════════ ПЛАНИРОВЩИК (зона) — сегментированный ПЛ/ББ ═══════════ */}
      {zone === 'planner' && (
        <InfoErrorBoundary label="Планировщик">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display:'flex', gap:4, padding:'6px', borderRadius:12, background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)', overflowX:'auto', scrollbarWidth:'none', WebkitOverflowScrolling:'touch' }}>
              {PLANNER_MODES.map(m => (
                <button key={m.id} onClick={() => { hapticImpact('medium'); switchPlanningTrack(m.id); }} style={{ flex:'0 0 auto', minWidth:104, padding:'8px 10px', borderRadius:9, fontSize:12, fontWeight:700, cursor:'pointer', border: planningTrack === m.id ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.06)', background: planningTrack === m.id ? 'rgba(0,230,138,0.20)' : 'rgba(255,255,255,0.02)', color: planningTrack === m.id ? '#ffffff' : 'var(--text-dim)', display:'flex', flexDirection:'column', alignItems:'center', gap:2, whiteSpace:'nowrap', boxShadow: planningTrack === m.id ? '0 0 0 1px rgba(0,230,138,0.4), 0 2px 10px rgba(0,0,0,0.25)' : 'none' }}>
                  <span style={{ fontSize:16 }}>{m.icon}</span>
                  <span>{m.label}</span>
                  <span style={{ fontSize:11, fontWeight:400, opacity:0.75, lineHeight:1.2, maxWidth:'100%', overflow:'hidden', textOverflow:'ellipsis' }}>{m.hint}</span>
                </button>
              ))}
            </div>
            {planningTrack === 'pl' && <PlannerPlAuto />}
            {planningTrack === 'bb' && <PlannerBbAuto />}
            {planningTrack === 'manual' && <ProgramManagerPanel />}
            {planningTrack === 'cardio' && <CardioConstructor />}
          </div>
        </InfoErrorBoundary>
      )}

      {/* ═══════════ Тренировка / выполнение (зона) ═══════════ */}
      {zone === 'training' && (tab === 'runtime' || tab === 'timers') && (
        <ExecutionZone
          tab={tab}
          goal={goal} level={level} recovery={recovery}
          trainingOutput={trainingOutput} macrocycle={macrocycle}
          selectedWeek={selectedWeek} currentMicrocycle={currentMicrocycle}
          runtimeDay={runtimeDay} setRuntimeDay={setRuntimeDay}
          runtimeExIdx={runtimeExIdx} setRuntimeExIdx={setRuntimeExIdx}
          runtimeLogs={runtimeLogs} setRuntimeLogs={setRuntimeLogs}
          runtimeStarted={runtimeStarted} setRuntimeStarted={setRuntimeStarted}
          plRuntime={plRuntime} plRunOpen={plRunOpen} setPlRunOpen={setPlRunOpen}
          runtimeSetW={runtimeSetW} setRuntimeSetW={setRuntimeSetW}
          runtimeSetR={runtimeSetR} setRuntimeSetR={setRuntimeSetR}
          runtimeSetRP={runtimeSetRP} setRuntimeSetRP={setRuntimeSetRP}
          runtimeSetRI={runtimeSetRI} setRuntimeSetRI={setRuntimeSetRI}
            diary={diary} onRefresh={loadDiaryStats}
            onGoToTimers={(settings) => { setTab('timers'); }}
          />
      )}

      {/* ═══════════ Библиотека (зона) ═══════════ */}
      {zone === 'library' && (tab === 'library' || tab === 'programs' || tab === 'methods' || tab === 'peaking' || tab === 'calc_taper' || tab === 'exercises') && (
        <LibraryZone
          tab={tab}
          linked={linked} trainingOutput={trainingOutput} diaryStats={diaryStats} historyWorkouts={historyWorkouts}
          goal={goal} level={level} daysPerWeek={daysPerWeek} recovery={recovery} fatigue={fatigue}
          appliedMethods={appliedMethods} setAppliedMethods={setAppliedMethods}
          applyMethodComposition={applyMethodComposition} goPlannerManual={goPlannerManual}
          selectedProgram={selectedProgram} setSelectedProgram={setSelectedProgram}
          customExercises={customExercises} setCustomExercises={setCustomExercises}
          mesoLength={mesoLength}
          onLoadToConstructor={() => goPlannerManual()}
        />
      )}

      {/* ═══════════ CALCULATORS TAB (also serves programcalc) ═══════════ */}

            {/* ═══════════ DIARY AND ANALYTICS TAB (объединённый дневник+аналитика+прогресс+визуализация+отчёты) ═══════════ */}
      {/* ═══════════ Дневник и аналитика (зона) ═══════════ */}
      {zone === 'diary' && (tab === 'diary' || tab === 'history' || tab === 'analytics' || tab === 'progress' || tab === 'calendar' || tab === 'checkin' || tab === 'mmc_tracking' || tab === 'mindset' || tab === 'mobility' || tab === 'reports' || tab === 'mytraining') && (
        <DiaryAnalyticsZone
          tab={tab}
          initialDiaryMode={initialSubTab === 'diary' ? 'diary' : undefined}
          diary={diary} diaryStats={diaryStats} diaryProgress={diaryProgress}
          historyWorkouts={historyWorkouts} macrocycle={macrocycle} selectedWeek={selectedWeek}
          level={level} onRefresh={loadDiaryStats} trainingOutput={trainingOutput}
          goal={goal} daysPerWeek={daysPerWeek} splitType={splitType}
          periodizationType={periodizationType} mesoLength={mesoLength}
          tprofile={tprofile} linked={linked}
          onTabChange={setTab}
        />
      )}


      {/* ═══════════ ⚡ ИНТЕЛЛЕКТ ТРЕНИРОВКИ (дашборд вместо пилюль) ═══════════ */}
      {zone === 'calculators' && (() => {
        const CALC_TABS = new Set(['strength_analysis','load_management','diagnostics','periodization_hub','exercise_lab','calc_plates','volume','load_safety','split_gen','pri_reppat','tonnage','calc_quality','training_mix_hub','mix_presets']);
        const isCalcTab = CALC_TABS.has(tab);
        if (isCalcTab) {
          // Показываем конкретный инструмент с кнопкой назад
          const backBtnStyle: React.CSSProperties = { padding: '4px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'var(--text-dim)', cursor: 'pointer', marginBottom: 6 };
          return (<>
            <button style={backBtnStyle} onClick={() => { setTab('runtime'); }}>← К дашборду</button>
            {tab === 'strength_analysis' && <InfoErrorBoundary label="Анализ силы"><StrengthAnalysisHub /></InfoErrorBoundary>}
            {tab === 'load_management' && <InfoErrorBoundary label="Управление нагрузкой"><LoadManagementHub sessions={historyWorkouts} baseRisk={linked.risk?.overallRaw ?? 20} baseReadiness={readiness?.recovery ?? 75} /></InfoErrorBoundary>}
            {tab === 'diagnostics' && <InfoErrorBoundary label="Диагностика"><DiagnosticsHub sessions={historyWorkouts} tprofile={tprofile} readinessRecovery={readiness?.recovery ?? 70} readinessFatigue={readiness?.fatigue ?? 30} mesoWeeks={mesoLength} missedSessions={0} currentVolume={18} currentRir={2} /></InfoErrorBoundary>}
            {tab === 'periodization_hub' && <InfoErrorBoundary label="Периодизация"><PeriodizationHub /></InfoErrorBoundary>}
            {tab === 'exercise_lab' && <InfoErrorBoundary label="Лаборатория упражнений"><ExerciseLabMerged /></InfoErrorBoundary>}
            {tab === 'calc_plates' && <InfoErrorBoundary label="Калькулятор блинов"><PlateCalcTab /></InfoErrorBoundary>}
            {tab === 'volume' && <InfoErrorBoundary label="Расчёт объёма"><VolumeOptimizerTab /></InfoErrorBoundary>}
            {tab === 'load_safety' && <InfoErrorBoundary label="Нагрузка/авторег"><LoadSafetyCard /></InfoErrorBoundary>}
            {tab === 'split_gen' && <InfoErrorBoundary label="Генератор сплитов"><SplitGenCard /></InfoErrorBoundary>}
            {tab === 'pri_reppat' && <InfoErrorBoundary label="PRI/схема повт"><PriRepPatternCard /></InfoErrorBoundary>}
            {tab === 'tonnage' && <InfoErrorBoundary label="Тоннаж"><TonnageCalcTab /></InfoErrorBoundary>}
              {tab === 'calc_quality' && <InfoErrorBoundary label="Качество программы"><CalcQualityTab onBuildPlan={() => goPlannerManual()} /></InfoErrorBoundary>}
            {tab === 'training_mix_hub' && <InfoErrorBoundary label="Тренировочные миксы"><TrainingMixTab /></InfoErrorBoundary>}
            {tab === 'mix_presets' && <InfoErrorBoundary label="Пресеты здоровья"><MixPresetsCard /></InfoErrorBoundary>}
          </>);
        }
        return <TrainingIntelligenceDashboard
          manualResult={null} level={level}
          historyWorkouts={historyWorkouts} tprofile={tprofile}
          readinessRecovery={readiness?.recovery ?? 70}
          readinessFatigue={readiness?.fatigue ?? 30}
          mesoLength={mesoLength}
          onBuildPlan={() => goPlannerManual()}
          onOpenTool={goTab as (tab: string) => void}
        />;
      })()}
      {/* ═══════════ MY TRAINING TAB ═══════════ */}

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
import { LiftHistoryCard } from './TrainingScreen_parts/LiftHistoryCard';
import { VolumeTrendCard } from './TrainingScreen_parts/VolumeTrendCard';
import AllExercisesTrendCard from './TrainingScreen_parts/AllExercisesTrendCard';
import StandardForecastCard from './TrainingScreen_parts/StandardForecastCard';
import VolumeRecoveryCorrelationCard from './TrainingScreen_parts/VolumeRecoveryCorrelationCard';
import StickingPointAnalysisCard from './TrainingScreen_parts/StickingPointAnalysisCard';
import { LoadRadarCard } from './TrainingScreen_parts/LoadRadarCard';
import { WeekCompareCard } from './TrainingScreen_parts/WeekCompareCard';
import { CsvImportTab } from './TrainingScreen_parts/CsvImportTab';
import { MethodsTab } from './TrainingScreen_parts/MethodsTab';
import { ProgramsTab } from './TrainingScreen_parts/ProgramsTab';
import { VolumeOptimizerTab } from './TrainingScreen_parts/VolumeOptimizerTab';
import ExerciseLabMerged from './TrainingScreen_parts/ExerciseLabMerged';
import { TrainingLoadCalculator } from './TrainingScreen_parts/TrainingLoadCalculator';
import { WhatIfCard } from './TrainingScreen_parts/WhatIfCard';
import { ReadinessForecastCard } from './TrainingScreen_parts/ReadinessForecastCard';
import { MethodologyEncyclopedia } from './TrainingScreen_parts/MethodologyEncyclopedia';
import { labTrainingAdjust } from './TrainingScreen_parts/lab-training-adjust';
import { appendReadinessToday, loadReadinessHistory } from './TrainingScreen_parts/readiness-history';
import { useTrainingProfile } from './TrainingScreen_parts/training-profile';
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
import { TrainingCalendarTab } from './TrainingScreen_parts/TrainingCalendarTab';
import { PlateCalcTab } from './TrainingScreen_parts/PlateCalcTab';
import { TonnageCalcTab } from './TrainingScreen_parts/TonnageCalcTab';
import { RIRCalibrationCard } from './TrainingScreen_parts/RIRCalibrationCard';
import MesoCorrectionCard from './TrainingScreen_parts/MesoCorrectionCard';
import MMCTrackingCard from './TrainingScreen_parts/MMCTrackingCard';
import { loadRirCalibrationStats } from '../../engines/meso-correction.engine';
