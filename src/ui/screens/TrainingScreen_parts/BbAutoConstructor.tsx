/**
 * BbAutoConstructor.tsx — PRO-ББ АВТО-КОНСТРУКТОР (профессиональный тренерский подход).
 *
 * Ключевые улучшения против базового:
 *  - Фазовая периодизация (Accumulation → Intensification → Deload/Peak)
 *  - RIR-прогрессия по фазам
 *  - Модуляция объёма и реп-диапазонов по фазам
 *  - Ротация изолирующих упражнений на границах фаз
 *  - Стратегия прогрессии нагрузки (DoubleProgression / Linear / Wave / RPE)
 *  - Авто-делод при ACWR > 1.3 + структурированная разгрузочная неделя
 *  - Интенсив-техники (дропсеты, рест-пауза, мио-репс) — рекомендации по фазе
 *  - Разминочные подходы к compounds
 *  - 3D эволюция объёма/интенсивности/частоты по неделям
 *  - Цветная индикация фазы в календаре и плане
 */
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useDataLink } from '../../../core/data-link';
import { EXERCISE_CATALOG, getExercisesByGroup, getSubstitutes, getExerciseById } from '../../../core/exercise-catalog';
import { SubstitutionPopup } from './SubstitutionPopup';
import { SPLIT_PATTERNS } from '../../../engines/bb/bb-split-patterns';
import { rankBBSplits, explainBBSelection, getMuscleFrequencies, type BBRankedPattern } from '../../../engines/bb/bb-selector.engine';
import { buildBBPlan, buildWarmup, type BBPlan, type BBExercise, type BBSession, type BBSet } from '../../../engines/bb/bb-builder.engine';
import { calcBBPlanMetrics, explainBBMetrics, type BBPlanMetrics, type BBMuscleVolume } from '../../../engines/bb/bb-metrics.engine';
import { adaptForPEDs, explainPEDAdaptation, type PED, type PEDAdaptation } from '../../../engines/bb/bb-ped-adaptation.engine';
import { getAllVolumeLandmarks } from '../../../engines/volume-landmarks.engine';
import { loadSRPESessions } from '../../../engines/pro/srpe-store';
import { acuteChronicRatio, toDailyLoads } from '../../../engines/pro/training-load.engine';
import { autoRegulate, shouldTrainToday } from '../../../engines/pro/autoregulation-pro.engine';
import { loadTrainingProfile, saveTrainingProfile } from './training-profile';
import { applyToPlanner, subscribePlannerApply } from './planner-bridge';
import { ACCENT, CARD, SMALL, BTN, BTN_GHOST, H, STEP_PILL, IN, Chip, panelStyle } from './training-ui';
import { MesocycleProgressionCard } from './MesocycleProgressionCard';
import { PopupNumber, PopupSelect, PopupSelectSmart, ExpandableCard, MetricCard, SaveButton } from '../SRCBBScreen_parts/TrainingPopups';
import { InjurySelectCard } from './InjurySelectCard';
import type { InjurySelectEntry } from './InjurySelectCard';
import { prescribeLoad, DELOAD_PROTOCOLS, applyDeloadToWeek, rirDrift, suggestFeeders, detectGarbageVolume, computeOverloadTargets, phaseExerciseMix, type LoadStrategy, type DeloadType, INTENSITY_TECHNIQUES, DEFAULT_TECHNIQUE_BY_PHASE, type IntensityTechnique } from '../../../engines/bb/bb-autocoach.engine';
import { PCT_FOR_RIR } from '../../../engines/rir-table';
import { getCyclesByDirection, getCycleById } from '../../../data/lms-cycles/lms-cycle-index';
import { convertCycleToBBPlan, programToCycleTemplate, cycleTemplateToFullProgram, programToBBPlan } from '../../../engines/bb/cycle-to-plan';
import type { SRCycleTemplate } from '../../../data/lms-cycles/lms-types';
import { getAllPrograms, FULL_PROGRAM_LIBRARY } from '../../../engines/complete-program-library.engine';
import type { FullProgram } from '../../../engines/complete-program-library.engine';
import { WOMENS_PROGRAMS, CUSTOM_PROGRAMS } from './programs-data';
import { BbProgramLibraryPicker } from './BbProgramLibraryPicker';
import { getPlanFeedback } from '../../../engines/plan-execution-feedback.engine';
import { validatePlan, weeklySetsFromBBPlan } from '../../../engines/plan-validator';
import { VolumeByWeekChart, RirDriftChart, type WeekVolume, type RirRecord } from './PlanCharts';
import { distributePhases as distributePhasesUnified, PHASE_CONFIGS, type PhaseDistribution } from './TrainingConstructor/phase-periodization';
import { validatePlanQuality, bbPlanToQualityInput, type PlanQualityResult } from '../../../engines/plan-quality.engine';
import { PlanExportCard } from './PlanExportCard';
import { DayCard, ExerciseRow, PhaseBanner, WeekStrip, PHASE_COLORS, PHASE_LABELS, type PlanDayView, type PlanExerciseView, type PhaseKey } from './PlanOutput';
import { loadSavedBBPlans, saveBBPlanVariant, deleteBBPlanVariant, type SavedBBPlan } from './bb-plans-store';
import { getBBSuggestions } from './bb-compat';
import { PlannerToolsPanel } from './PlannerToolsPanel';
import { WhatIfCard } from './WhatIfCard';

type Step = 'params' | 'ped' | 'split' | 'plan' | 'quality' | 'adjust';
type BBPhase = 'accumulation' | 'intensification' | 'deload' | 'peaking';
type PlanMode = 'generic_split' | 'bb_cycle';

const WEAK_GROUPS = [
  ['chest','Грудь'],['chest_upper','Верх груди'],['chest_lower','Низ груди'],
  ['back','Спина'],['back_width','Ширина спины'],['back_thickness','Толщина спины'],
  ['shoulders','Плечи (общее)'],['delt_front','Передняя дельта'],['delt_mid','Средняя дельта'],['delt_rear','Задняя дельта'],
  ['quads','Квадрицепс'],['hamstrings','Бицепс бедра'],['glutes','Ягодицы'],['calves','Икры'],
  ['biceps','Бицепс'],['triceps','Трицепс'],['forearms','Предплечья'],
  ['abs','Пресс'],['traps','Трапеции'],
] as const;
const BB_WM_KEYS = ['chest','back','quads','hamstrings','shoulders','biceps','triceps','glutes','calves','abs'] as const;
const BB_WM_RU: Record<string,string> = { chest:'Грудь', back:'Спина', quads:'Квадрицепсы', hamstrings:'Бицепс бедра', shoulders:'Плечи', biceps:'Бицепс', triceps:'Трицепс', glutes:'Ягодичные', calves:'Икры', abs:'Пресс' };
const TAG_LABELS_RU: Record<string, string> = {
  Push: 'Толкающие', Pull: 'Тянущие', Legs: 'Ноги', Upper: 'Верх', Lower: 'Низ',
  FullBody: 'Всё тело', Chest: 'Грудь', Back: 'Спина', Shoulders: 'Плечи', Arms: 'Руки',
  ChestBack: 'Грудь+Спина', ShouldersArms: 'Плечи+Руки', Torso: 'Торс', Limbs: 'Конечности',
  UpperPower: 'Верх(сила)', LowerPower: 'Низ(сила)', UpperHyp: 'Верх(гиперт)', LowerHyp: 'Низ(гиперт)',
  };
export const PHASE_TECHNIQUES: Record<BBPhase, string[]> = {
  accumulation: ['Темповые повторы (TUT)', 'Пауза в растянутой позиции', 'Суперсеты антагонистов'],
  intensification: ['Дроп-сеты (последний подход)', 'Рест-пауза (compounds)', 'Форсированные повторы (с партнёром)'],
  deload: ['Медленные негативы', 'Стрейч-пауза'],
  peaking: ['Околопредельные веса (RIR 0)', 'Кластеры 5×2'],
};

const _phaseMapCache = new Map<string, Map<number, BBPhase>>();
function getPhaseMap(totalWeeks: number): Map<number, BBPhase> {
  const cacheKey = String(totalWeeks);
  if (_phaseMapCache.has(cacheKey)) return _phaseMapCache.get(cacheKey)!;
  // P1: синхронизируем deloadFreq с движком buildBBPlan (deloadFreq = weeks>=6 ? 4 : 0),
  // иначе календарь/баннер показывал «без делода», а сгенерированный план содержал deload-неделю.
  const deloadFreq = totalWeeks >= 6 ? 4 : 0;
  const dist: PhaseDistribution[] = distributePhasesUnified(totalWeeks, deloadFreq, 'mass');
  const map = new Map<number, BBPhase>();
  for (const d of dist) {
    for (const w of d.weeks) {
      map.set(w, d.phase as BBPhase);
    }
  }
  for (let w = 1; w <= totalWeeks; w++) {
    if (!map.has(w)) map.set(w, 'accumulation' as BBPhase);
  }
  _phaseMapCache.set(cacheKey, map);
  return map;
}

function phaseForWeek(week: number, totalWeeks: number): BBPhase {
  return getPhaseMap(totalWeeks).get(week) || 'accumulation';
}

/** Проверка: мышца в списке слабых групп (с учётом родительских групп). */
function isWeakMuscle(muscle: string, weakPoints: string[]): boolean {
  if (weakPoints.includes(muscle)) return true;
  const PARENT: Record<string, string> = { delt_front: 'shoulders', delt_mid: 'shoulders', delt_rear: 'shoulders' };
  return weakPoints.includes(PARENT[muscle] ?? '');
}

/** Мини-чип для параметров упражнения (общий из training-ui). */

function computePhases(totalWeeks: number): { week: number; phase: BBPhase }[] {
  const phases: { week: number; phase: BBPhase }[] = [];
  for (let w = 1; w <= totalWeeks; w++) {
    const p = phaseForWeek(w, totalWeeks);
    phases.push({ week: w, phase: p });
  }
  return phases;
}

function exerciseComment(ex: BBExercise, weakPoints: string[], focusGroup: string, phase: BBPhase): string {
  const parts: string[] = [];
  if (ex.role === 'primary') {
    parts.push('🎯 Основное движение');
    if (weakPoints.includes(ex.muscle)) parts.push('🔥 Акцент на отстающую');
    if (focusGroup === ex.muscle) parts.push('⭐ Группа специализации');
  } else {
    parts.push('📌 Добивочное');
  }
  const phaseTech = PHASE_TECHNIQUES[phase];
  if (phaseTech.length > 0) {
    const seed = (ex.name || '').split('').reduce((a, c, i) => a + c.charCodeAt(0) * (i + 1), 0);
    const techHint = phaseTech[seed % phaseTech.length];
    parts.push('💡 ' + techHint);
  }
  if (ex.character === 'тяж') parts.push('💪 Силовая нагрузка');
  else if (ex.character === 'памп') parts.push('🩸 Нагнетание крови');
  const catalogEx = EXERCISE_CATALOG.find(e => e.name === ex.name || e.name === ex.muscle);
  if (catalogEx?.movementPattern) parts.push('🧬 ' + catalogEx.movementPattern);
  if (catalogEx?.targetMuscle) {
    const targets = catalogEx.targetMuscle.split(',').map(t => t.trim()).filter(t => t !== ex.muscle);
    if (targets.length > 0) parts.push('🎯 Доп. нагрузка: ' + targets.join(', '));
  }
  return parts.join(' · ');
}


function rotationSubstitutions(week: number, totalWeeks: number, muscle: string, currentName: string): string[] {
  const catalog = EXERCISE_CATALOG.filter(e => (e.group || '') === muscle && e.name !== currentName);
  if (catalog.length === 0) return [];
  const phase = phaseForWeek(week, totalWeeks);
  if (phase === 'accumulation' || phase === 'deload') return [];
  return catalog.slice(0, 3).map(e => e.name);
}

export const BbAutoConstructor: React.FC = () => {
  const linked = useDataLink();
  const prof = useMemo(() => loadTrainingProfile(), []);

  const [step, setStep] = useState<Step>('params');
  const [bbLevel, setBbLevel] = useState<string>(prof.level || 'intermediate');
  const [bbGoal, setBbGoal] = useState<string>(prof.goal === 'bulk' ? 'mass' : prof.goal || 'mass');
  const [bbDays, setBbDays] = useState<number>(prof.daysPerWeek || 4);
  const [bbWeeks, setBbWeeks] = useState<number>(8);
  const [bbVolGoal, setBbVolGoal] = useState<string>('mav');
  const [bbFocus, setBbFocus] = useState<string>('');
  const [planMode, setPlanMode] = useState<PlanMode>(prof.planMode === 'bb_cycle' ? 'bb_cycle' : 'generic_split');
  const [selectedCycleId, setSelectedCycleId] = useState<string>(prof.bbCycleId || '');
  const [loadStrategy, setLoadStrategy] = useState<LoadStrategy>((prof.loadStrategy as LoadStrategy) || 'double_progression');
  const [autoDeload, setAutoDeload] = useState<boolean>(true);
  const [deloadType, setDeloadType] = useState<DeloadType>('pump');
  // P6: выбор intensity technique (если не выбрана — дефолт по фазе)
  const [intensityTech, setIntensityTech] = useState<IntensityTechnique>('none');

  const [peds, setPeds] = useState<PED[]>((prof.bbPeds?.length ? prof.bbPeds : (prof.onCourse ? ['AAS'] : [])) as PED[]);
  const [pedDoses, setPedDoses] = useState<Record<string, number>>({ AAS: 500, insulin: 10, MGF: 200, IGF1: 50, GH: 4 });
  const [courseIntensity, setCourseIntensity] = useState<'mild' | 'moderate' | 'heavy'>(prof.courseIntensity || 'moderate');
  const [bbWorkMax, setBbWorkMax] = useState<Record<string, number>>(() => ({
    chest: 100, back: 110, quads: 140, hamstrings: 90, shoulders: 60, biceps: 50, triceps: 60, glutes: 160, calves: 120, abs: 60,
    ...(prof.workMax || {}),
  }));
  const [weakPoints, setWeakPoints] = useState<string[]>(prof.weakPoints || []);
  const [injuries, setInjuries] = useState<InjurySelectEntry[]>(prof.injuries || []);

  const [selectedSplitId, setSelectedSplitId] = useState<string>('');
  const [builtPlan, setBuiltPlan] = useState<BBPlan | null>(null);
  const [bbWeekSel, setBbWeekSel] = useState<number>(1);
  const [autoRegOn, setAutoRegOn] = useState(false);
  const [specializationMode, setSpecializationMode] = useState(false);
  const [editMode, setEditMode] = useState<{ dayIdx: number; exIdx: number } | null>(null);
  const [exerciseEdits, setExerciseEdits] = useState<Record<string, { sets: number; reps: number; weight: number }>>({});
  const [subTarget, setSubTarget] = useState<{ dayIdx: number; exIdx: number; sessionIdx: number } | null>(null);
  const [exSwapModal, setExSwapModal] = useState<{ si: number; ei: number; muscle: string; currentName: string } | null>(null);
  const [exSwapSearch, setExSwapSearch] = useState('');
  // Фаза 7: Фильтр оборудования
  const [bbEquipment, setBbEquipment] = useState<string[]>(() => prof.equipment || []);
  // Кастомный цикл из библиотеки программ (через planner-bridge kind='program' или прямой пикер)
  const [customCycle, setCustomCycle] = useState<SRCycleTemplate | null>(null);
  const [customProgram, setCustomProgram] = useState<FullProgram | null>(null);
  const [bbProgramPath, setBbProgramPath] = useState<'library' | 'cycle'>('cycle');
  const [bbAdaptMode, setBbAdaptMode] = useState<'faithful' | 'adapt'>('adapt');
  const [bbSource, setBbSource] = useState<'cycle' | 'program'>(customCycle ? 'program' : 'cycle');
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(customCycle ? customCycle.meta.id.replace('prog_', '') : null);
  const [bridgeMsg, setBridgeMsg] = useState('');
  // Мульти-планы: сохранённые варианты для сравнения
  const [savedPlans, setSavedPlans] = useState<SavedBBPlan[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const refreshSavedPlans = useCallback(() => setSavedPlans(loadSavedBBPlans()), []);
  useEffect(() => { refreshSavedPlans(); }, [refreshSavedPlans]);

  // Smart suggestions: матрица совместимости параметров (цепочка выборов)
  const bbSuggest = useMemo(() => getBBSuggestions(bbGoal, bbLevel), [bbGoal, bbLevel]);
  // Авто-применение рекомендаций при первой настройке (цепочка): если значение не рекомендовано
  // и пользователь не менял его явно — переключить на лучшее рекомендованное.
  const userTouched = useRef<Record<string, boolean>>({});
  useEffect(() => {
    // Авто-применить volumeGoal если не рекомендован и не тронут пользователем
    if (!userTouched.current.volGoal && !bbSuggest.volumeGoal.has(bbVolGoal) && bbSuggest.volumeGoal.size > 0) {
      const best = Array.from(bbSuggest.volumeGoal)[0];
      setBbVolGoal(best);
    }
    // Авто-применить loadStrategy
    if (!userTouched.current.loadStrategy && !bbSuggest.loadStrategy.has(loadStrategy) && bbSuggest.loadStrategy.size > 0) {
      const best = Array.from(bbSuggest.loadStrategy)[0];
      setLoadStrategy(best as LoadStrategy);
    }
    // Авто-применить deloadType
    if (!userTouched.current.deloadType && !bbSuggest.deloadType.has(deloadType) && bbSuggest.deloadType.size > 0) {
      const best = Array.from(bbSuggest.deloadType)[0];
      setDeloadType(best as DeloadType);
    }
    // Авто-применить intensityTechnique
    if (!userTouched.current.intensityTech && !bbSuggest.intensityTechnique.has(intensityTech) && bbSuggest.intensityTechnique.size > 0) {
      const best = Array.from(bbSuggest.intensityTechnique)[0];
      setIntensityTech(best as IntensityTechnique);
    }
  }, [bbSuggest]);
  // Обёртки onChange с пометкой userTouched
  const onUserVolGoal = (v: string) => { userTouched.current.volGoal = true; setBbVolGoal(v); };
  const onUserLoadStrategy = (v: string) => { userTouched.current.loadStrategy = true; setLoadStrategy(v as LoadStrategy); };
  const onUserDeloadType = (v: string) => { userTouched.current.deloadType = true; setDeloadType(v as DeloadType); };
  const onUserIntensityTech = (v: string) => { userTouched.current.intensityTech = true; setIntensityTech(v as IntensityTechnique); };

  // Подписка на planner-bridge: приём программ из библиотеки
  useEffect(() => {
    const unsub = subscribePlannerApply((payload) => {
      if (payload && payload.kind === 'program' && payload.data) {
        const cycle = payload.data as SRCycleTemplate;
        setCustomCycle(cycle);
        setPlanMode('bb_cycle');
        setBbSource('program');
        setSelectedProgramId(cycle.meta.id.replace('prog_', ''));
        setSelectedCycleId(cycle.meta.id);
        setBbDays(cycle.meta.sessionsPerWeek);
        setBbWeeks(cycle.meta.weeks);
        setBbLevel(cycle.meta.level === 'novice' ? 'beginner' : cycle.meta.level === 'KMS-MS' || cycle.meta.level === 'MS-MSMK' ? 'advanced' : 'intermediate');
        setBbGoal(cycle.meta.period === 'strength' ? 'strength_mass' : 'mass');
        setBridgeMsg(`🔗 Программа загружена: ${cycle.meta.title}`);
        setTimeout(() => setBridgeMsg(''), 5000);
        setStep('params');
      }
    });
    return () => { unsub(); };
  }, []);

  // Применение готовой программы из библиотеки (прямой пикер или bridge).
  // Определяет путь: программы ББ-цикла (cycle-bb-*) идут через convertCycleToBBPlan,
  // остальные (FULL_PROGRAM_LIBRARY + WOMENS + CUSTOM_PROGRAMS) идут через programToBBPlan (faithful).
  const applyProgramToBb = useCallback((program: FullProgram) => {
    const id = program.id || '';
    const isBbCycleProgram = id.startsWith('cycle-bb') || id.startsWith('bb_cycle_') || (program.author === 'LMS/PROF' && id.startsWith('prog_cycle-bb'));
    if (isBbCycleProgram) {
      // BB-cycle путь: конвертация через SRCycleTemplate (старый путь)
      const cycle = programToCycleTemplate(program);
      setCustomCycle(cycle);
      setCustomProgram(null);
      setBbProgramPath('cycle');
      setPlanMode('bb_cycle');
      setBbSource('program');
      setSelectedProgramId(program.id);
      setSelectedCycleId(cycle.meta.id);
      setBbDays(cycle.meta.sessionsPerWeek);
      setBbWeeks(cycle.meta.weeks);
      setBbLevel(cycle.meta.level === 'novice' ? 'beginner' : cycle.meta.level === 'KMS-MS' || cycle.meta.level === 'MS-MSMK' ? 'advanced' : 'intermediate');
      setBbGoal(cycle.meta.period === 'strength' ? 'strength_mass' : 'mass');
    } else {
      // Library путь: прямой FullProgram → programToBBPlan (faithful)
      setCustomProgram(program);
      setCustomCycle(null);
      setBbProgramPath('library');
      setPlanMode('bb_cycle');
      setBbSource('program');
      setSelectedProgramId(program.id);
      setSelectedCycleId('prog_' + program.id);
      setBbDays(program.daysPerWeek);
      setBbWeeks(program.durationWeeks);
      setBbLevel(program.level === 'beginner' ? 'beginner' : program.level === 'advanced' ? 'advanced' : 'intermediate');
      const goalMap: Record<string, string> = {
        hypertrophy: 'mass', strength: 'strength_mass', bodybuilding: 'mass',
        peaking: 'cut', powerlifting: 'strength_mass', athletic: 'mass', rehab: 'mass',
      };
      setBbGoal(goalMap[program.goal] || 'mass');
    }
    setBridgeMsg(`🔗 Программа загружена: ${program.name} (режим: ${isBbCycleProgram ? 'PROF-цикл' : 'библиотека, faithful + адаптация'})`);
    setTimeout(() => setBridgeMsg(''), 5000);
    setStep('params');
  }, []);

  const phases = useMemo(() => computePhases(bbWeeks), [bbWeeks]);

  const autoRegResult = useMemo(() => {
    const rec = linked.readiness?.recovery ?? 80;
    const fat = linked.readiness?.fatigue ?? 30;
    const sleep = linked.readiness?.sleep ?? 70;
    const hrv = linked.profile?.settings?.baselineHrvRatio ?? 1.0;
    const srpe = loadSRPESessions();
    const acwr = srpe.length >= 2 ? acuteChronicRatio(toDailyLoads(srpe)) : { ratio: 1.0, zone: 'optimal' as const };
    return autoRegulate({ readiness: rec, acwr: { ratio: acwr.ratio, zone: acwr.zone }, fatigue: fat, hrvRatio: hrv, sleepScore: sleep, plannedTopSetPct: 0.8, plannedRIR: 2 });
  }, [linked.readiness, linked.profile?.settings]);

  const ranked = useMemo(() => rankBBSplits({ level: bbLevel, goal: bbGoal as any, daysPerWeek: bbDays, weakPoints: weakPoints.length > 0 ? weakPoints : undefined }), [bbLevel, bbGoal, bbDays, weakPoints]);
  const bestSplit = ranked[0];
  useEffect(() => { if (bestSplit && !selectedSplitId) setSelectedSplitId(bestSplit.pattern.id); }, [bestSplit]);

  const allLandmarks = useMemo(() => getAllVolumeLandmarks(bbLevel), [bbLevel]);
  const pedAdapt = useMemo(() => adaptForPEDs(peds, Object.fromEntries(Object.entries(allLandmarks).map(([m, v]) => [m, v.mrv])), pedDoses, courseIntensity), [peds, allLandmarks, pedDoses, courseIntensity]);

  const metrics = useMemo(() => builtPlan ? calcBBPlanMetrics(builtPlan, pedAdapt.combinedMrvMultiplier) : null, [builtPlan, pedAdapt]);
  // FIX-6: Единый источник качества — validatePlanQuality (канонический движок)
  const quality = useMemo(() => {
    if (!builtPlan) return null;
    const input = bbPlanToQualityInput(builtPlan, { level: bbLevel, weakPoints, hasDeload: autoDeload, onCourse: peds.length > 0 });
    const result = validatePlanQuality(input);
    return {
      score: result.score,
      label: result.grade,
      details: result.issues.map(i => i.message),
      perMuscle: result.muscles.map(m => ({
        muscle: m.muscle, sets: m.weeklySets, mev: m.mev, mav: m.mav, mrv: m.mrv,
        pct: m.pctOfMav, status: m.status,
      })),
      recommendations: result.recommendations,
    };
  }, [builtPlan, bbLevel, weakPoints, autoDeload, peds]);

  useEffect(() => {
    try { saveTrainingProfile({ ...loadTrainingProfile(), workMax: bbWorkMax, weakPoints, injuries, onCourse: peds.length > 0, bbPeds: peds, courseIntensity, loadStrategy, planMode, bbCycleId: selectedCycleId }); } catch {}
  }, [bbWorkMax, weakPoints, peds, courseIntensity, loadStrategy, planMode, selectedCycleId]);

  // FIX-19: Авто-загрузка сохранённого плана при монтировании
  useEffect(() => {
    try {
      const saved = localStorage.getItem('he_bb_plan_saved');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.plan && parsed.date) {
          setBuiltPlan(parsed.plan);
          setBbWeekSel(1);
          setStep('plan');
        }
      }
    } catch {}
  }, []);

  const adjustVolume = (mult: number) => {
    if (!builtPlan) return;
    const w2 = structuredClone(builtPlan.weeks);
    for (const w of w2) for (const s of w.sessions) for (const e of s.exercises) {
      e.sets = Math.max(1, Math.round(e.sets * mult));
    }
    setBuiltPlan({ ...builtPlan, weeks: w2 });
  };
  const adjustWeight = (mult: number) => {
    if (!builtPlan) return;
    const w2 = structuredClone(builtPlan.weeks);
    for (const w of w2) for (const s of w.sessions) for (const e of s.exercises) for (const ws of e.workSets) {
      ws.weight = Math.round(ws.weight * mult * 10) / 10;
    }
    setBuiltPlan({ ...builtPlan, weeks: w2 });
  };

  const bbCyclesList = useMemo(() => {
    const base = getCyclesByDirection('bodybuilding').filter(c => !c.meta.id.startsWith('embed-'));
    // Включить кастомный цикл из библиотеки программ, если есть
    if (customCycle && !base.some(c => c.meta.id === customCycle.meta.id)) {
      return [customCycle, ...base];
    }
    return base;
  }, [customCycle]);

  // BB-циклы как готовые программы (для выбора в "Программе")
  const bbCyclePrograms = useMemo(() => {
    return getCyclesByDirection('bodybuilding')
      .filter(c => !c.meta.id.startsWith('embed-'))
      .map(c => cycleTemplateToFullProgram(c));
  }, []);

  // Все доступные программы для ББ-контекста:
  // FULL_PROGRAM_LIBRARY + WOMENS_PROGRAMS + CUSTOM_PROGRAMS + bb-циклы (дедуп по id).
  // Фильтр направления: только bodybuilding или both (силовые PL-only исключаем из ББ-выбора).
  const bbLibraryPrograms = useMemo<FullProgram[]>(() => {
    const all = [
      ...FULL_PROGRAM_LIBRARY,
      ...WOMENS_PROGRAMS,
      ...CUSTOM_PROGRAMS,
      ...bbCyclePrograms,
    ];
    const seen = new Set<string>();
    const out: FullProgram[] = [];
    for (const p of all) {
      if (!p || !p.id || seen.has(p.id)) continue;
      // ББ-контекст принимает bodybuilding / both; чисто силовые_PL отсекаем.
      if (p.direction === 'strength') continue;
      seen.add(p.id);
      out.push(p);
    }
    return out;
  }, [bbCyclePrograms]);

  const applyBbSubstitution = useCallback((newId: string) => {
    if (!subTarget || !builtPlan) return;
    const rep = getExerciseById(newId); if (!rep) { setSubTarget(null); return; }
    const { dayIdx: si, exIdx: ei } = subTarget;
    const wk = builtPlan.weeks[bbWeekSel - 1];
    if (!wk) { setSubTarget(null); return; }
    const ses = wk.sessions[si];
    if (!ses) { setSubTarget(null); return; }
    const oldEx = ses.exercises[ei];
    if (!oldEx) { setSubTarget(null); return; }
    const wm = bbWorkMax[(rep as any).group || oldEx.muscle || 'chest'] || 80;
    const pct = PCT_FOR_RIR[Math.max(0, Math.min(5, oldEx.rir))] ?? 0.9;
    const weight = Math.round(wm * pct);
    const w2 = structuredClone(builtPlan.weeks);
    const targetSession = w2[bbWeekSel - 1].sessions[si];
    targetSession.exercises[ei] = { ...oldEx, name: rep.name, muscle: (rep as any).group || oldEx.muscle || 'chest', workSets: [{ ...oldEx.workSets[0], weight }] };
    setBuiltPlan({ ...builtPlan, weeks: w2 });
    setSubTarget(null);
  }, [subTarget, builtPlan, bbWeekSel, bbWorkMax]);

  const buildBb = () => {
    let plan: BBPlan;

    // AutoReg-пейлоад (для buildBBPlan → applyPostPhaseProcessing)
    const autoRegPayload = (autoRegOn && autoRegResult) ? {
      volumeMultiplier: autoRegResult.volumeMultiplier,
      topSetPctMultiplier: autoRegResult.topSetPctMultiplier,
      rirShift: autoRegResult.rirShift,
    } : undefined;

    try {

    if (planMode === 'bb_cycle') {
      // Library путь (FullProgram напрямую → programToBBPlan, faithful режим)
      if (bbProgramPath === 'library' && customProgram) {
        plan = programToBBPlan(customProgram, {
          workMax: bbWorkMax,
          weakPoints,
          focusGroup: bbFocus,
          injuries,
          intTechnique: intensityTech,
          autoDeload,
          deloadType,
          loadStrategy,
          autoRegResult: autoRegPayload,
          favoriteExercises: prof.favoriteExercises || [],
          excludedExercises: prof.excludedExercises || [],
          avoidAxialLoad: prof.avoidAxialLoad || false,
          equipment: bbEquipment,
          peds,
          pedDoses,
          courseIntensity,
          level: bbLevel,
          volumeGoal: bbVolGoal as any,
          specialization: specializationMode,
          mode: bbAdaptMode,
        });
        if (bbDays !== customProgram.daysPerWeek) setBbDays(customProgram.daysPerWeek);
        if (bbWeeks !== customProgram.durationWeeks) setBbWeeks(customProgram.durationWeeks);
      } else if (selectedCycleId || customCycle) {
        // BB-цикл путь (SRCycleTemplate → convertCycleToBBPlan)
        const cycle = customCycle || (getCycleById(selectedCycleId) as SRCycleTemplate | undefined);
        if (!cycle) { alert('Цикл не найден'); return; }
        plan = convertCycleToBBPlan({
          cycle,
          workMax: bbWorkMax,
          weakPoints,
          peds,
          pedDoses,
          courseIntensity,
          loadStrategy,
          injuries,
          intensityTechnique: intensityTech,
          autoDeload,
          deloadType,
          autoRegResult: autoRegPayload,
          favoriteExercises: prof.favoriteExercises || [],
          excludedExercises: prof.excludedExercises || [],
          avoidAxialLoad: prof.avoidAxialLoad || false,
          volumeGoal: bbVolGoal as any,
          specialization: specializationMode,
          focusGroup: bbFocus,
          level: bbLevel,
          equipment: bbEquipment,
        });
        const cycleWeeks = cycle.meta.sessionsPerWeek;
        if (bbDays !== cycleWeeks) setBbDays(cycleWeeks);
        if (bbWeeks !== cycle.meta.weeks) setBbWeeks(cycle.meta.weeks);
      } else {
        return; // нет ни программы, ни цикла — нельзя строить (защита)
      }
    } else {
      const pattern = SPLIT_PATTERNS.find(p => p.id === selectedSplitId);
      if (!pattern) return;
      plan = buildBBPlan({
        patternId: selectedSplitId, level: bbLevel, goal: bbGoal as any, weeks: bbWeeks,
        workMax: bbWorkMax, weakPoints, focusGroup: bbFocus, volumeGoal: bbVolGoal as any,
        specialization: specializationMode,
        injuries,
        planStartWeek: new Date().toISOString().slice(0, 10),
        favoriteExercises: prof.favoriteExercises || [],
        excludedExercises: prof.excludedExercises || [],
        avoidAxialLoad: prof.avoidAxialLoad || false,
        intensityTechnique: intensityTech,
        autoDeload,
        deloadType,
        loadStrategy,
        autoRegResult: autoRegPayload,
        pedDoses,
        courseIntensity,
        equipment: bbEquipment,
      }, pedAdapt);
    }

    const modeLabel = planMode === 'bb_cycle' ? `BB-цикл: ${customCycle?.meta.title || getCycleById(selectedCycleId)?.meta.title || selectedCycleId}` : 'Generic-сплит';
    const srpe = loadSRPESessions();
    const acwr = srpe.length >= 2 ? acuteChronicRatio(toDailyLoads(srpe)) : null;
    const deloadNote = autoDeload && acwr && acwr.ratio > 1.3
      ? `🔄 Делод: ${DELOAD_PROTOCOLS[deloadType].description}`
      : 'Делод: нет';

    setBuiltPlan({
      ...plan,
      rationale: [...plan.rationale,
        `📌 Источник: ${modeLabel}`,
        `📈 Стратегия: ${loadStrategy}`,
        deloadNote,
        `💪 Слабые группы: ${weakPoints.length > 0 ? weakPoints.join(', ') : 'нет'}`,
      ],
    });
    setBbWeekSel(1);
    setStep('plan');
    try {
      const playerDays = plan.weeks.flatMap(w => w.sessions.map((s, si) => ({
        label: 'Нед' + w.week + ' Д' + (si+1),
        exercises: s.exercises.map(e => {
          const tgt: { weight: number; reps: number; rir: number } = { weight: e.workSets[0]?.weight || 60, reps: e.workSets[0]?.reps || 10, rir: e.rir ?? 2 };
          return { name: e.name, muscleGroup: e.muscle, targetSets: Array.from({ length: e.sets || 3 }, () => ({ ...tgt })), restSec: 90 };
        }),
      })));
      localStorage.setItem('he_pl_runtime', JSON.stringify({ days: playerDays, focus: plan.pattern?.name || 'ББ-сплит', week: 1, track: 'bb' }));
    } catch {}

    } catch (e: any) {
      console.error('[BB-auto] Ошибка генерации плана:', e);
      alert('Ошибка при генерации плана: ' + (e?.message || String(e)) + '. Проверьте параметры и попробуйте снова.');
      return;
    }
  };

  const handleSavePlan = () => {
    try { localStorage.setItem('he_bb_plan_saved', JSON.stringify({ plan: builtPlan, date: new Date().toISOString() })); alert('План сохранён'); } catch { alert('Ошибка сохранения'); }
  };

  /** Сохранить BB-план в "Мои тренировки" (myTrainingPlans) — унификация с ручным конструктором. */
  const handleSaveToMyPlans = () => {
    if (!builtPlan) return;
    const name = prompt('Название плана:', `${builtPlan.pattern.name} ${bbWeeks}нед`);
    if (!name) return;
    // Конвертация BB-плана в flat-формат Моих тренировок: все упражнения недели 1
    const week1 = builtPlan.weeks[0];
    const exs = week1.sessions.flatMap(s => s.exercises.map(e => ({
      name: e.name,
      sets: e.sets,
      reps: e.workSets[0]?.reps ?? 10,
      rir: e.rir,
    })));
    const plan = { id: 'bbplan_' + Date.now(), name, date: new Date().toISOString(), exercises: exs };
    try {
      const existing = JSON.parse(localStorage.getItem('myTrainingPlans') || '[]');
      const updated = [...existing, plan].slice(-20);
      localStorage.setItem('myTrainingPlans', JSON.stringify(updated));
      alert(`План «${name}» сохранён в Мои тренировки (${exs.length} упр.)`);
    } catch { alert('Ошибка сохранения'); }
  };

  const handleSaveVariant = () => {
    if (!builtPlan || !metrics) return;
    const name = prompt('Название варианта:', `${builtPlan.pattern.name} ${bbWeeks}нед ${peds.length > 0 ? peds.join('+') : 'натурал'}`);
    if (!name) return;
    const params: SavedBBPlan['params'] = {
      patternId: selectedSplitId,
      patternName: builtPlan.pattern.name,
      level: bbLevel, goal: bbGoal, weeks: bbWeeks, volumeGoal: bbVolGoal,
      peds, pedDoses, courseIntensity: courseIntensity as string,
      weakPoints, focusGroup: bbFocus, intensityTechnique: intensityTech,
      loadStrategy, autoDeload, deloadType, planMode,
      cycleId: planMode === 'bb_cycle' ? selectedCycleId : undefined,
    };
    const planMetrics: SavedBBPlan['metrics'] = {
      totalSets: metrics.totalSets,
      avgRir: metrics.avgRir,
      sessionsPerWeek: builtPlan.pattern.sessionsPerRotation,
      phases: phases.map(p => p.phase),
      qualityScore: quality?.score ?? 0,
      muscleCount: Object.keys(builtPlan.muscleFrequency || {}).length,
      mrvMult: pedAdapt.combinedMrvMultiplier,
    };
    const updated = saveBBPlanVariant(name, builtPlan, params, planMetrics);
    setSavedPlans(updated);
    setShowCompare(true);
  };

  const handleDeleteVariant = (id: string) => {
    const updated = deleteBBPlanVariant(id);
    setSavedPlans(updated);
  };

  const handleLoadVariant = (v: SavedBBPlan) => {
    if (!v.plan) return;
    setBuiltPlan(v.plan);
    setBbWeekSel(1);
    setStep('plan');
  };
  const handleReplaceExercise = (si: number, ei: number, newName: string) => {
    if (!newName || !builtPlan) return;
    const found = EXERCISE_CATALOG.find(x => x.name.toLowerCase() === newName.toLowerCase());
    if (!found) return;
    const w3 = structuredClone(builtPlan.weeks);
    const wLen = w3.length;
    const weekIdx = Math.min(bbWeekSel, wLen) - 1;
    if (w3[weekIdx]?.sessions[si]?.exercises[ei]) {
      w3[weekIdx].sessions[si].exercises[ei].name = found.name;
      w3[weekIdx].sessions[si].exercises[ei].muscle = found.group || w3[weekIdx].sessions[si].exercises[ei].muscle;
    }
    setBuiltPlan({ ...builtPlan, weeks: w3 });
  };

  // Фаза 5: Перестановка упражнений внутри дня (↑↓ — mobile-friendly вместо HTML5 DnD)
  const handleMoveExercise = (si: number, ei: number, dir: -1 | 1) => {
    if (!builtPlan) return;
    const w3 = structuredClone(builtPlan.weeks);
    const weekIdx = Math.min(bbWeekSel, w3.length) - 1;
    const sess = w3[weekIdx]?.sessions[si];
    if (!sess) return;
    const newIdx = ei + dir;
    if (newIdx < 0 || newIdx >= sess.exercises.length) return;
    // Swap
    const tmp = sess.exercises[ei];
    sess.exercises[ei] = sess.exercises[newIdx];
    sess.exercises[newIdx] = tmp;
    setBuiltPlan({ ...builtPlan, weeks: w3 });
  };

  const handleSendToExecution = () => {
    if (!builtPlan) return;
    try {
      const playerDays = builtPlan.weeks.flatMap(w => w.sessions.map((s, si) => ({
        label: 'Нед' + w.week + ' Д' + (si+1),
        exercises: s.exercises.map(e => {
          const tgt: { weight: number; reps: number; rir: number } = { weight: e.workSets[0]?.weight || 60, reps: e.workSets[0]?.reps || 10, rir: e.rir ?? 2 };
          return { name: e.name, muscleGroup: e.muscle, targetSets: Array.from({ length: e.sets || 3 }, () => ({ ...tgt })), restSec: 90 };
        }),
      })));
      localStorage.setItem('he_pl_runtime', JSON.stringify({ days: playerDays, focus: builtPlan.pattern?.name || 'ББ-сплит', week: 1, track: 'bb' }));
      // FIX-12: Авто-переход на вкладку «Тренировка» (как ручной конструктор)
      localStorage.setItem('he_training_tab', 'runtime');
      window.dispatchEvent(new StorageEvent('storage', { key: 'he_training_tab' }));
    } catch { alert('Ошибка при отправке плана на выполнение'); }
  };

  const stepList: Step[] = planMode === 'bb_cycle' ? ['params','ped','plan','quality','adjust'] : ['params','ped','split','plan','quality','adjust'];
  const stepLabels: Record<Step,string> = { params:'1 Параметры', ped:'2 PED+Вес', split:'3 Сплит', plan: planMode === 'bb_cycle' ? '3 План' : '4 План', quality: planMode === 'bb_cycle' ? '4 Качество' : '5 Качество', adjust: planMode === 'bb_cycle' ? '5 Коррекция' : '6 Коррекция' };
  const renderStepNav = () => (
    <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
      {stepList.map(s => {
        return <button key={s} onClick={() => { if ((s === 'plan' || s === 'quality' || s === 'adjust') && !builtPlan) return; setStep(s); }} style={STEP_PILL(step === s)}>{stepLabels[s]}</button>;
      })}
    </div>
  );

  const renderParams = () => (
    <div>
      <div style={H}>📋 Шаг 1: Базовые параметры</div>

      {bridgeMsg && (
        <div style={{ marginBottom:10, padding:'8px 12px', borderRadius:10, background:'rgba(0,230,138,0.08)', border:'1px solid rgba(0,230,138,0.2)', color:'#00e68a', fontSize:11, fontWeight:700 }}>
          {bridgeMsg}
        </div>
      )}

      {/* Plan mode: cycle vs generic split */}
      <div style={{ marginBottom:10, padding:'8px 10px', borderRadius:10, background:'rgba(168,85,247,0.06)', border:'1px solid rgba(168,85,247,0.15)' }}>
        <div style={{ fontSize:11, fontWeight:700, color:'#a855f7', marginBottom:6 }}>📌 Источник программы</div>
        <div style={{ display:'flex', gap:6 }}>
          <button onClick={() => setPlanMode('generic_split')} style={{
            flex:1, padding:'8px 10px', borderRadius:10, cursor:'pointer', fontWeight:700, fontSize:11,
            border: planMode === 'generic_split' ? '2px solid #a855f7' : '1px solid rgba(255,255,255,0.08)',
            background: planMode === 'generic_split' ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.02)',
            color: planMode === 'generic_split' ? '#a855f7' : 'rgba(255,255,255,0.6)',
          }}>🧩 Generic-сплит (авто-генерация)</button>
          <button onClick={() => setPlanMode('bb_cycle')} style={{
            flex:1, padding:'8px 10px', borderRadius:10, cursor:'pointer', fontWeight:700, fontSize:11,
            border: planMode === 'bb_cycle' ? '2px solid #00e68a' : '1px solid rgba(255,255,255,0.08)',
            background: planMode === 'bb_cycle' ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.02)',
            color: planMode === 'bb_cycle' ? '#00e68a' : 'rgba(255,255,255,0.6)',
          }}>📋 ПРОФ-цикл (12 готовых программ)</button>
        </div>
      </div>

      {planMode === 'bb_cycle' && (
        <div style={{ marginBottom:10, padding:'10px 12px', borderRadius:10, background:'rgba(0,230,138,0.04)', border:'1px solid rgba(0,230,138,0.12)' }}>
          {/* Под-источник: ПРОФ-цикл / Библиотека программ */}
          <div style={{ display:'flex', gap:6, marginBottom:8 }}>
            <button onClick={() => setBbSource('cycle')} style={{
              flex:1, padding:'7px 8px', borderRadius:9, cursor:'pointer', fontWeight:700, fontSize:11,
              border: bbSource === 'cycle' ? '2px solid #00e68a' : '1px solid rgba(255,255,255,0.08)',
              background: bbSource === 'cycle' ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.02)',
              color: bbSource === 'cycle' ? '#00e68a' : 'rgba(255,255,255,0.6)',
            }}>📋 ПРОФ-цикл</button>
            <button onClick={() => setBbSource('program')} style={{
              flex:1, padding:'7px 8px', borderRadius:9, cursor:'pointer', fontWeight:700, fontSize:11,
              border: bbSource === 'program' ? '2px solid #60a5fa' : '1px solid rgba(255,255,255,0.08)',
              background: bbSource === 'program' ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.02)',
              color: bbSource === 'program' ? '#60a5fa' : 'rgba(255,255,255,0.6)',
            }}>📚 Из библиотеки</button>
          </div>

          {bbSource === 'cycle' && (
            <>
              <div style={{ fontSize:11, fontWeight:700, color:'#00e68a', marginBottom:6 }}>📚 Выберите BB-цикл</div>
              <PopupSelect label="BB-цикл" value={selectedCycleId} onChange={v => { setSelectedCycleId(v); const c = getCycleById(v); if (c) { setBbDays(c.meta.sessionsPerWeek); setBbWeeks(c.meta.weeks); } }} options={[
                ...bbCyclesList.map(c => ({
                  id: c.meta.id,
                  label: `${c.meta.title} (${c.meta.weeks} нед, ${c.meta.sessionsPerWeek}×/нед)`,
                  description: c.meta.description?.slice(0, 120),
                })),
              ]} />
              {selectedCycleId && (() => {
                const c = getCycleById(selectedCycleId);
                if (!c) return null;
                return (
                  <div style={{ marginTop:6, fontSize:11, color:'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
                    <div><span style={{ fontWeight:700, color:'rgba(255,255,255,0.8)' }}>Уровень:</span> {c.meta.level}</div>
                    <div><span style={{ fontWeight:700, color:'rgba(255,255,255,0.8)' }}>Фокус:</span> {c.meta.targetFocus || '—'}</div>
                    {c.meta.deloadWeeks && c.meta.deloadWeeks.length > 0 && <div><span style={{ fontWeight:700, color:'rgba(255,255,255,0.8)' }}>Разгрузка:</span> нед {c.meta.deloadWeeks.join(', ')}</div>}
                    {c.meta.rirProgression && <div><span style={{ fontWeight:700, color:'rgba(255,255,255,0.8)' }}>RIR:</span> {c.meta.rirProgression.start}→{c.meta.rirProgression.end}</div>}
                    {c.meta.phases && c.meta.phases.length > 0 && <div><span style={{ fontWeight:700, color:'rgba(255,255,255,0.8)' }}>Фазы:</span> {c.meta.phases.map(ph => ph.title || `нед ${ph.weekStart}-${ph.weekEnd}`).join(', ')}</div>}
                    <div style={{ marginTop:4, padding:'4px 8px', borderRadius:8, background:'rgba(0,230,138,0.06)', fontSize:11, color:'rgba(255,255,255,0.7)' }}>{c.meta.description?.slice(0, 200)}</div>
                  </div>
                );
              })()}
            </>
          )}

          {bbSource === 'program' && (
            <>
              <div style={{ fontSize:11, fontWeight:700, color:'#60a5fa', marginBottom:6 }}>📚 Готовая программа из библиотеки</div>
              <BbProgramLibraryPicker
                label='Программа'
                value={selectedProgramId}
                programs={bbLibraryPrograms}
                onSelect={applyProgramToBb}
              />
              {bbSource === 'program' && customCycle && (
                <div style={{ marginTop:6, fontSize:11, color:'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
                  <div><span style={{ fontWeight:700, color:'rgba(255,255,255,0.8)' }}>Программа:</span> {customCycle.meta.title}</div>
                  <div><span style={{ fontWeight:700, color:'rgba(255,255,255,0.8)' }}>Уровень:</span> {customCycle.meta.level}</div>
                  <div><span style={{ fontWeight:700, color:'rgba(255,255,255,0.8)' }}>Дней/нед:</span> {customCycle.meta.sessionsPerWeek}</div>
                  <div><span style={{ fontWeight:700, color:'rgba(255,255,255,0.8)' }}>Недель:</span> {customCycle.meta.weeks}</div>
                  <div style={{ marginTop:4, padding:'4px 8px', borderRadius:8, background:'rgba(96,165,250,0.06)', fontSize:11, color:'rgba(255,255,255,0.7)' }}>{customCycle.meta.description?.slice(0, 200)}</div>
                </div>
              )}
              {bbSource === 'program' && selectedProgramId && !customCycle && (() => {
                const p = bbLibraryPrograms.find(pr => pr.id === selectedProgramId);
                if (!p) return null;
                return (
                  <div style={{ marginTop:6, fontSize:11, color:'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
                    <div><span style={{ fontWeight:700, color:'rgba(255,255,255,0.8)' }}>Программа:</span> {p.name}</div>
                    <div><span style={{ fontWeight:700, color:'rgba(255,255,255,0.8)' }}>Автор:</span> {p.author}</div>
                    <div><span style={{ fontWeight:700, color:'rgba(255,255,255,0.8)' }}>Уровень:</span> {p.level}</div>
                    <div><span style={{ fontWeight:700, color:'rgba(255,255,255,0.8)' }}>Дней/нед:</span> {p.daysPerWeek}</div>
                    <div><span style={{ fontWeight:700, color:'rgba(255,255,255,0.8)' }}>Недель:</span> {p.durationWeeks}</div>
                    <div><span style={{ fontWeight:700, color:'rgba(255,255,255,0.8)' }}>Цель:</span> {p.goal}{p.direction && p.direction !== p.goal ? ` (${p.direction})` : ''}</div>
                    {p.targetAudience && <div style={{ marginTop:3, fontSize: 10, color: 'rgba(255,255,255,0.5)' }}><b>Кому:</b> {p.targetAudience.slice(0, 160)}{p.targetAudience.length > 160 ? '…' : ''}</div>}
                    {p.warnings && p.warnings.length > 0 && (
                      <div style={{ marginTop:3, padding:'4px 8px', borderRadius:8, background:'rgba(245,158,11,0.08)', fontSize:10, color:'#fbbf24', lineHeight:1.4 }}>
                        ⚠️ {p.warnings.slice(0, 2).join(' · ')}{p.warnings.length > 2 ? '…' : ''}
                      </div>
                    )}
                    <div style={{ marginTop:4, padding:'4px 8px', borderRadius:8, background:'rgba(96,165,250,0.06)', fontSize:11, color:'rgba(255,255,255,0.7)' }}>{p.description?.slice(0, 240)}</div>
                  </div>
                );
              })()}

              {/* 🔧 Дополнительная настройка выбранной программы (применяется к генерации ББ-цикла) */}
              {bbSource === 'program' && selectedProgramId && (
                <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 12, background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.18)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#a855f7', marginBottom: 8, display:'flex', alignItems:'center', gap:6 }}>
                    🔧 Дополнительная настройка программы
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, marginBottom: 10 }}>
                    Переопределяет параметры выбранной программы под ваш профиль — слабые группы, интенсивность и стратегию прогрессии.
                    Если не менять — берутся разумные дефолты.
                  </div>

                  {/* Режим адаптации (faithful vs adapt) — только для library path */}
                  {bbProgramPath === 'library' && (
                    <div style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa', marginBottom: 6 }}>🔒 Режим конвертации программы</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => setBbAdaptMode('faithful')} style={{
                          flex: 1, padding: '7px 8px', borderRadius: 9, cursor: 'pointer', fontWeight: 700, fontSize: 10,
                          border: bbAdaptMode === 'faithful' ? '2px solid #60a5fa' : '1px solid rgba(255,255,255,0.08)',
                          background: bbAdaptMode === 'faithful' ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.02)',
                          color: bbAdaptMode === 'faithful' ? '#60a5fa' : 'rgba(255,255,255,0.6)',
                        }}>🎯 Точно по программе</button>
                        <button onClick={() => setBbAdaptMode('adapt')} style={{
                          flex: 1, padding: '7px 8px', borderRadius: 9, cursor: 'pointer', fontWeight: 700, fontSize: 10,
                          border: bbAdaptMode === 'adapt' ? '2px solid #00e68a' : '1px solid rgba(255,255,255,0.08)',
                          background: bbAdaptMode === 'adapt' ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.02)',
                          color: bbAdaptMode === 'adapt' ? '#00e68a' : 'rgba(255,255,255,0.6)',
                        }}>🔧 Адаптировать</button>
                      </div>
                      <div style={{ marginTop: 6, fontSize: 9, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>
                        {bbAdaptMode === 'faithful'
                          ? 'Все недели, RIR/множители/фазы/warmup/rest/reps/notes берутся дословно из программы. Применяются только safety-фильтры (травмы/исключённые упражнения/оборудование).'
                          : 'Структура программы сохраняется, но добавляется добивка слабых групп (+isolation), интенсив-техники, авто-делод и стратегия прогрессии.'}
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <PopupSelect
                      label='🎯 Фокус-группа'
                      value={bbFocus}
                      onChange={setBbFocus}
                      options={[{ id: '', label: 'Баланс (без акцента)' }, ...WEAK_GROUPS.map(([id, l]) => ({ id, label: l }))]}
                    />
                    <PopupSelect
                      label='🔥 Интенсив-техника'
                      value={intensityTech}
                      onChange={v => setIntensityTech(v as IntensityTechnique)}
                      options={[
                        { id: 'none', label: 'Авто по фазе' },
                        { id: 'rest_pause', label: 'Рест-пауза' },
                        { id: 'drop_set', label: 'Дроп-сет' },
                        { id: 'myo_reps', label: 'Myo-reps' },
                        { id: 'pause_rep', label: 'Пауза-репс' },
                        { id: 'mechanical_drop', label: 'Мех. дроп-сет' },
                      ]}
                    />
                    <PopupSelect
                      label='📈 Стратегия прогрессии'
                      value={loadStrategy}
                      onChange={v => setLoadStrategy(v as LoadStrategy)}
                      options={[
                        { id: 'double_progression', label: 'Двойная прогрессия' },
                        { id: 'linear', label: 'Линейная' },
                        { id: 'wave', label: 'Волновая' },
                        { id: 'rpe_based', label: 'RPE-based' },
                      ]}
                    />
                    <PopupSelect
                      label='📉 Тип делода'
                      value={deloadType}
                      onChange={v => setDeloadType(v as DeloadType)}
                      hint='Какую разгрузочную неделю строить при перегрузке (ACWR>1.3)'
                      options={[
                        { id: 'pump', label: 'Памп-делод (50% объём)' },
                        { id: 'neural', label: 'Нейр-делод (тяж/мало)' },
                        { id: 'full_rest', label: 'Полный отдых' },
                      ]}
                    />
                  </div>
                  <button
                    onClick={() => setAutoDeload(a => !a)}
                    style={{
                      width:'100%', marginTop: 8, padding: '8px 10px', borderRadius: 10, cursor: 'pointer',
                      fontSize: 11, fontWeight: 700, textAlign: 'left', boxSizing: 'border-box',
                      background: autoDeload ? 'rgba(0,230,138,0.10)' : 'rgba(255,255,255,0.03)',
                      border: autoDeload ? '1px solid rgba(0,230,138,0.35)' : '1px solid rgba(255,255,255,0.08)',
                      color: autoDeload ? ACCENT : 'rgba(255,255,255,0.6)',
                    }}
                  >
                    {autoDeload ? '✅ Авто-делод при перегрузке' : '⬜ Авто-делод при перегрузке'} (ACWR&gt;1.3)
                  </button>

                  {/* Слабые группы (мульти-чипсы) */}
                  <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>🔥 Слабые группы (акцент объёма)</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {WEAK_GROUPS.map(([id, l]) => {
                      const on = weakPoints.includes(id);
                      return (
                        <button key={id} onClick={() => setWeakPoints(wp => on ? wp.filter(x => x !== id) : [...wp, id])}
                          style={{
                            padding: '5px 10px', borderRadius: 999, cursor: 'pointer', fontSize: 10, fontWeight: 700,
                            background: on ? 'rgba(245,158,11,0.18)' : 'rgba(255,255,255,0.04)',
                            border: on ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(255,255,255,0.06)',
                            color: on ? '#fbbf24' : 'rgba(255,255,255,0.75)',
                          }}
                        >{on ? '✓ ' : ''}{l}</button>
                      );
                    })}
                  </div>
                  {weakPoints.length > 0 && (
                    <div style={{ marginTop: 6, fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
                      Количество слабых групп: {weakPoints.length}. Отстающие группы получат ~20-30% дополнительный объём топлива.
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {planMode === 'generic_split' && (
      <div>
        {/* Smart suggestions info banner */}
        <div style={{ marginBottom:8, padding:'8px 10px', borderRadius:10, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.15)' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b', marginBottom:4 }}>★ Smart-подбор (цепочка)</div>
          <div style={{ fontSize:10, color:'rgba(255,255,255,0.6)', lineHeight:1.5 }}>
            <div><b style={{ color:'#f59e0b' }}>Цель «{bbGoal === 'mass' ? 'Масса' : bbGoal === 'cut' ? 'Сушка' : bbGoal === 'recomp' ? 'Рекомпозиция' : bbGoal === 'maintenance' ? 'Поддержание' : 'Сила+Масса'}»:</b> {bbSuggest.goalDesc}</div>
            <div style={{ marginTop:3 }}><b style={{ color:'#f59e0b' }}>Уровень «{bbLevel === 'beginner' ? 'Новичок' : bbLevel === 'intermediate' ? 'Средний' : bbLevel === 'advanced' ? 'Опытный' : 'Enhanced'}»:</b> {bbSuggest.levelDesc}</div>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        <PopupSelect label="Уровень" value={bbLevel} onChange={setBbLevel} options={[['beginner','Новичок'],['intermediate','Средний'],['advanced','Опытный'],['enhanced','Enhanced (PED)']].map(([id,label]) => ({ id, label }))} />
        <PopupSelect label="Цель" value={bbGoal} onChange={setBbGoal} options={[['mass','Мышечная масса'],['cut','Сушка'],['recomp','Рекомпозиция'],['maintenance','Поддержание'],['strength_mass','Сила + Масса']].map(([id,label]) => ({ id, label }))} />
        <PopupNumber label="Дней/нед" value={bbDays} min={3} max={6} onChange={v => setBbDays(v)} />
        <PopupNumber label="Недель мезо" value={bbWeeks} min={4} max={24} suffix=" нед" onChange={v => setBbWeeks(v)} />
        <PopupSelectSmart label="Цель объёма" value={bbVolGoal} onChange={onUserVolGoal} suggestedIds={bbSuggest.volumeGoal} suggestionReason="По цели и уровню" options={[['mev','Минимум (MEV)'],['mav','Оптимум (MAV)'],['mrv','Максимум (MRV)']].map(([id,label]) => ({ id, label }))} />
        <PopupSelect label="Фокус-группа" value={bbFocus} onChange={setBbFocus} options={[{ id:'', label:'Нет' }, ...WEAK_GROUPS.map(([id,l]) => ({ id, label: l }))]} />
        </div>
      </div>
      )}
      <div style={{ marginTop:12, padding:10, borderRadius:10, background:'rgba(168,85,247,0.06)', border:'1px solid rgba(168,85,247,0.15)' }}>
        <div style={{ fontSize:11, fontWeight:700, color:'#a855f7', marginBottom:6 }}>📈 Стратегия прогрессии</div>
        <PopupSelectSmart label="" value={loadStrategy} onChange={onUserLoadStrategy} suggestedIds={bbSuggest.loadStrategy} suggestionReason={bbSuggest.goalDesc.split('.')[0]} options={[
          { id:'double_progression', label:'🔄 Двойная прогрессия: сначала повторы → потом вес (рекоменд.)' },
          { id:'linear', label:'📈 Линейная: +2.5 кг/нед для compounds, +1 кг для изоляции' },
          { id:'wave', label:'🌊 Волновая: 3-нед микроциклы (тяж/ср/лёг)' },
          { id:'rpe_based', label:'🎯 RPE-базированная: авто-подбор веса по ощущению (продвинутый)' },
        ]} />
        <div style={{ marginTop:4, fontSize:11, color:'rgba(255,255,255,0.5)' }}>
          {loadStrategy === 'double_progression' && 'Стратегия PRO-бодибилдеров: добейте повторы до верхней границы, затем повысьте вес на 5%.'}
          {loadStrategy === 'linear' && 'Классическая силовая прогрессия: еженедельное прибавление веса. Эффективно для новичков и intermediates.'}
          {loadStrategy === 'wave' && 'Продвинутая периодизация: 3-нед циклы тяжёлая/средняя/лёгкая неделя. Управление утомлением.'}
          {loadStrategy === 'rpe_based' && 'Для опытных: вес подбирается по ощущению (RPE). Авто-регуляция под текущее состояние.'}
        </div>
      </div>
      <div style={{ marginTop:8, display:'flex', alignItems:'center', gap:8 }}>
        <label style={{ fontSize:11, color:'rgba(255,255,255,0.6)', fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
          <input type="checkbox" checked={autoDeload} onChange={e => setAutoDeload(e.target.checked)} style={{ accentColor: ACCENT }} />
          Авто-разгрузка при ACWR {`>`} 1.3
        </label>
      </div>
      {autoDeload && (
        <div style={{ marginTop:6 }}>
          <PopupSelectSmart label="Тип разгрузки" value={deloadType} onChange={onUserDeloadType} suggestedIds={bbSuggest.deloadType} suggestionReason="По цели" options={[
            { id:'pump', label:'🩸 Pump-разгрузка: лёгкие веса, высокие повторы (рекоменд.)' },
            { id:'neural', label:'🧠 Нейральная: низкий объём, умеренный вес, долгий отдых' },
            { id:'full_rest', label:'😴 Полный отдых: минимальная активность, только при перетрене' },
          ]} />
          <div style={{ marginTop:4, padding:'4px 8px', borderRadius:8, background:'rgba(34,197,94,0.06)', fontSize:11, color:'rgba(255,255,255,0.6)' }}>
            {DELOAD_PROTOCOLS[deloadType].description}
          </div>
        </div>
      )}
      {/* P6: intensity technique (применяется к primary упражнениям) */}
      <div style={{ marginTop:8 }}>
        <PopupSelectSmart label="🎯 Intensity-техника (P6)" value={intensityTech} onChange={onUserIntensityTech} suggestedIds={bbSuggest.intensityTechnique} suggestionReason="По цели и уровню (цепочка)" options={[
          { id:'none', label:'Авто (по фазе): accumulation→pause_rep, intensification/peaking→rest_pause' },
          { id:'rest_pause', label:'⏸ Rest-pause: финальный сет 1×8 + 15с + 1×3-4 + 15с + 1×3-4' },
          { id:'drop_set', label:'⤵ Drop-set: финал 1×10 → -20% → 1×6 → -20% → 1×4' },
          { id:'myo_reps', label:'🔁 Myo-reps: 1×12-15 + 4 mini × 4 reps × 5с' },
          { id:'pause_rep', label:'🛑 Pause-rep: пауза 2-3с в нижней точке каждого повторения' },
          { id:'mechanical_drop', label:'🔄 Mechanical drop: смена угла/хвата без отдыха' },
        ]} />
        <div style={{ marginTop:4, fontSize:10, color:'rgba(255,255,255,0.5)' }}>
          {INTENSITY_TECHNIQUES[intensityTech]?.description || 'Без техники'}
        </div>
      </div>
      {/* Фаза 7: Фильтр оборудования */}
      <div style={{ marginTop:8, padding:'8px 10px', borderRadius:10, background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.15)' }}>
        <div style={{ fontSize:11, fontWeight:700, color:'#60a5fa', marginBottom:6 }}>🏋️ Доступное оборудование</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
          {([['barbell','Штанга'],['dumbbell','Гантели'],['cable','Блок/кроссовер'],['machine','Тренажёр'],['kettlebell','Гири'],['bodyweight','Свой вес'],['bands','Резинки']] as const).map(([id,label]) => {
            const on = bbEquipment.includes(id);
            return <button key={id} onClick={() => setBbEquipment(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
              style={{ padding:'5px 10px', borderRadius:14, fontSize:10, fontWeight:700, cursor:'pointer', border:on?'1px solid #60a5fa':'1px solid rgba(255,255,255,0.08)', background:on?'rgba(96,165,250,0.15)':'rgba(255,255,255,0.02)', color:on?'#60a5fa':'rgba(255,255,255,0.6)' }}>{label}{on?' ✓':''}</button>;
          })}
        </div>
        <div style={{ marginTop:4, fontSize:10, color:'rgba(255,255,255,0.4)' }}>Если ничего не выбрано — используются все упражнения. Выбор ограничивает пул отбора.</div>
      </div>
      {/* Карточка травм */}
      <div style={{ marginTop:8 }}>
        <InjurySelectCard
          injuries={injuries}
          onChange={setInjuries}
        />
      </div>

      <button style={{ ...BTN, width:'100%', marginTop:12 }} onClick={() => setStep('ped')}>Далее: PED и рабочие веса →</button>
    </div>
  );

  const renderPedWorkMax = () => (
    <div>
      <div style={H}>💉 Шаг 2: Фармакология и рабочие веса</div>
      <div style={{ padding:'8px 10px', borderRadius:10, background:'rgba(0,230,138,0.04)', border:'1px solid rgba(0,230,138,0.12)', marginBottom:10 }}>
        <div style={{ fontSize:11, fontWeight:700, color:ACCENT, marginBottom:6 }}>PED-адаптация объёмов</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
          {(['AAS','insulin','MGF','IGF1','GH'] as PED[]).map(p => (
            <button key={p} onClick={() => setPeds(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
              style={{ padding:'6px 12px', borderRadius:10, fontSize:11, fontWeight:700, cursor:'pointer', border:peds.includes(p)?'1px solid #00e68a':'1px solid rgba(255,255,255,0.08)', background:peds.includes(p)?'rgba(0,230,138,0.15)':'rgba(255,255,255,0.02)', color:peds.includes(p)?'#00e68a':'rgba(255,255,255,0.6)' }}>
              {['AAS: ААС','insulin: Инсулин','MGF: MGF','IGF1: IGF-1','GH: ГР'][['AAS','insulin','MGF','IGF1','GH'].indexOf(p)]}{peds.includes(p)?' ✓':''}
            </button>
          ))}
        </div>
        {/* FIX-15: Дозировки активных PED */}
        {peds.length > 0 && (
          <div style={{ marginTop:8, padding:'8px 10px', borderRadius:10, background:'rgba(0,230,138,0.04)', border:'1px solid rgba(0,230,138,0.12)' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.5)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.03em' }}>Дозировки (мг/нед или МЕ/нед)</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
              {peds.map(p => {
                const labels: Record<string, string> = { AAS: 'ААС, мг/нед', insulin: 'Инсулин, МЕ/день', MGF: 'MGF, мкг/нед', IGF1: 'IGF-1, мкг/день', GH: 'ГР, МЕ/день' };
                const steps: Record<string, number> = { AAS: 50, insulin: 5, MGF: 50, IGF1: 10, GH: 1 };
                return (
                  <div key={p} style={{ display:'flex', flexDirection:'column', gap:3 }}>
                    <span style={{ fontSize:10, color:'rgba(255,255,255,0.45)' }}>{labels[p] || p}</span>
                    <input type="number" value={pedDoses[p] || 0} min={0} max={p === 'AAS' ? 3000 : p === 'insulin' ? 50 : 500}
                      onChange={e => setPedDoses(d => ({ ...d, [p]: parseInt(e.target.value) || 0 }))}
                      style={{ width:'100%', padding:'5px 8px', borderRadius:7, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', color:'#fff', fontSize:11, fontWeight:700, textAlign:'center', boxSizing:'border-box' }} />
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {peds.length > 0 && <div style={{ ...SMALL, marginTop:6 }}>{explainPEDAdaptation(pedAdapt)}</div>}
        {peds.length > 0 && (
          <div style={{ marginTop:8 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.6)', marginBottom:4 }}>Интенсивность курса</div>
            <div style={{ display:'flex', gap:6 }}>
              {([['mild','Лёгкая'],['moderate','Умеренная'],['heavy','Тяжёлая']] as const).map(([val,label]) => (
                <button key={val} onClick={() => setCourseIntensity(val)}
                  style={{ padding:'5px 10px', borderRadius:10, fontSize:11, fontWeight:700, cursor:'pointer',
                    border: courseIntensity===val ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.08)',
                    background: courseIntensity===val ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.02)',
                    color: courseIntensity===val ? '#00e68a' : 'rgba(255,255,255,0.6)' }}>
                  {label}
                </button>
              ))}
            </div>
            </div>
          )}
          {/* Рекомендации по питанию */}
          {(() => {
            const nut: Record<string, { cal: string; pro: string; tip: string }> = {
              mass: { cal: 'Профицит 300-500 ккал/день', pro: '1.8-2.2 г/кг (≥160 г/день)', tip: 'Углеводы вокруг тренировки. 4-6 приёмов пищи.' },
              cut: { cal: 'Дефицит 300-500 ккал/день', pro: '2.2-2.8 г/кг (≥180 г/день)', tip: 'Белок повышен для сохранения мышц. Клетчатка 30+ г/день.' },
              recomp: { cal: 'Поддержание ±100 ккал', pro: '2.0-2.4 г/кг', tip: 'Циклирование углеводов: высокие в дни тренировок, низкие в дни отдыха.' },
              maintenance: { cal: 'Поддержание (TDEE)', pro: '1.6-2.0 г/кг', tip: 'Стабильное питание, контроль веса 1 раз/нед.' },
              strength_mass: { cal: 'Профицит 400-600 ккал/день', pro: '2.0-2.5 г/кг (≥180 г/день)', tip: 'Углеводы 5-7 г/кг для силовой производительности.' },
            };
            const n = nut[bbGoal] || nut.mass;
            const calMult = (pedAdapt.combinedMrvMultiplier - 1) * 3 + 1; // PED boost = больше калорий
            const adjCal = bbGoal === 'cut' ? n.cal : n.cal.replace(/\d+/, m => String(Math.round(Number(m) * calMult)));
            return (
              <div style={{ marginTop:8, padding:10, borderRadius:10, background:'rgba(34,197,94,0.04)', border:'1px solid rgba(34,197,94,0.15)' }}>
                <div style={{ fontSize:11, fontWeight:800, color:'#22c55e', marginBottom:6 }}>🥗 Рекомендации по питанию ({bbGoal})</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, fontSize:11 }}>
                  <div><span style={{ color:'rgba(255,255,255,0.5)' }}>Калории: </span><span style={{ fontWeight:700, color:'#f59e0b' }}>{adjCal}</span></div>
                  <div><span style={{ color:'rgba(255,255,255,0.5)' }}>Белок: </span><span style={{ fontWeight:700, color:'#22c55e' }}>{n.pro}</span></div>
                  <div style={{ gridColumn:'1/-1' }}><span style={{ color:'rgba(255,255,255,0.5)' }}>💡 </span><span style={{ color:'rgba(255,255,255,0.7)' }}>{n.tip}</span></div>
                  {pedAdapt.combinedMrvMultiplier > 1 && (
                    <div style={{ gridColumn:'1/-1', marginTop:4, fontSize:10, color:'#f59e0b' }}>
                      💉 PED увеличивают потребность в калориях и белке — значения скорректированы.
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      <div style={H}>💪 Рабочие максимумы (кг)</div>
      <div style={{ marginBottom:8, padding:'6px 10px', borderRadius:10, background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.12)', fontSize:11, color:'rgba(255,255,255,0.6)' }}>
        💡 Введите <b>рабочий вес на 5-8 повторений</b> (НЕ 1ПМ!) для каждой группы. Например: жим лёжа 100кг×8 → «Грудь 100».
        Для икр/пресса — вес в тренажёре. Веса используются для расчёта нагрузки по RIR и %1RM.
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginBottom:10 }}>
        {BB_WM_KEYS.map(k => <PopupNumber key={k} label={BB_WM_RU[k]} value={bbWorkMax[k] || 80} min={10} max={500} suffix=' кг' onChange={v => setBbWorkMax(p => ({ ...p, [k]: v }))} />)}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
        <div style={{ fontSize:11, fontWeight:700, color:ACCENT }}>🎯 Слабые группы</div>
        <label style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'rgba(255,255,255,0.5)', cursor:'pointer', marginLeft:'auto', padding:'3px 8px', borderRadius:8, background:specializationMode?'rgba(236,72,153,0.12)':'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
          <input type="checkbox" checked={specializationMode} onChange={e => setSpecializationMode(e.target.checked)} style={{ accentColor:'#ec4899' }} />
          Режим специализации
        </label>
      </div>
      <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:6 }}>
        {WEAK_GROUPS.map(([id,l]) => {
          const on = weakPoints.includes(id);
          return <button key={id} onClick={() => setWeakPoints(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])}
            style={{ padding:'5px 10px', borderRadius:14, fontSize:11, fontWeight:700, cursor:'pointer', border:on?'1px solid #00e68a':'1px solid rgba(255,255,255,0.08)', background:on?'rgba(0,230,138,0.15)':'rgba(255,255,255,0.02)', color:on?'#00e68a':'rgba(255,255,255,0.6)' }}>{l}{on?' ✓':''}</button>;
        })}
      </div>
      <div style={{ marginBottom:6, padding:'6px 10px', borderRadius:10, background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.15)', fontSize:11, color:'rgba(255,255,255,0.7)' }}>
        💡 Слабые группы получают: +20% объёма, приоритетное размещение (первые упражнения), снижение RIR на 0.5 (тяжелее).
      </div>
      {specializationMode && <div style={{ marginBottom:10, padding:'6px 10px', borderRadius:10, background:'rgba(236,72,153,0.06)', border:'1px solid rgba(236,72,153,0.15)', fontSize:11, color:'rgba(255,255,255,0.7)' }}>
        🔴 Режим специализации: топ-2 слабые группы на MAV+10%, остальные на MEV (поддерживающий объём).
      </div>}
      <button style={{ ...BTN, width:'100%' }} onClick={() => planMode === 'bb_cycle' ? buildBb() : setStep('split')}>
        {planMode === 'bb_cycle' ? '⚡ Собрать план по циклу →' : 'Далее: выбрать сплит →'}
      </button>
      {planMode === 'bb_cycle' && (
        <button style={{ ...BTN_GHOST, width:'100%', marginTop:6 }} onClick={() => setStep('params')}>
          ← Назад к параметрам
        </button>
      )}
    </div>
  );

  const renderSplit = () => (
    <div>
      <div style={H}>🏆 Шаг 3: Выбор сплита</div>
      <div style={{ marginBottom:8, padding:'6px 10px', borderRadius:10, background:'rgba(168,85,247,0.06)', border:'1px solid rgba(168,85,247,0.12)', fontSize:11, color:'rgba(255,255,255,0.7)' }}>
        📅 Фазы: {phases.filter((p,i,a) => p.phase !== a[i-1]?.phase).map((p,i) => <span key={i} style={{ color:PHASE_COLORS[p.phase], fontWeight:700 }}>{PHASE_LABELS[p.phase]}{i < phases.length - 1 ? ' → ' : ''}</span>)}
      </div>
      <div style={{ marginBottom:10, padding:'6px 10px', borderRadius:10, background:'rgba(0,230,138,0.04)', border:'1px solid rgba(0,230,138,0.1)', fontSize:11, color:'rgba(255,255,255,0.55)' }}>
        💡 Частота каждой группы — ключевой фактор роста. 2×/нед = оптимум для синтеза белка (Schoenfeld 2016, JSF 2019).
        Чипсы <span style={{ color:'#00e68a' }}>зелёные</span> = 2+×/нед (рекомендуемая частота), <span style={{ color:'rgba(255,255,255,0.4)' }}>серые</span> = 1×/нед.
      </div>
      {bestSplit && (
        <div style={{ marginBottom:10, padding:12, borderRadius:12, background:'linear-gradient(135deg,rgba(250,204,21,0.08),rgba(250,204,21,0.02))', border:'1px solid rgba(250,204,21,0.25)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
            <span style={{ fontWeight:800, fontSize:13, color:'#facc15' }}>🏆 Рекомендованный сплит: {bestSplit.pattern.name}</span>
            <span style={{ fontSize:12, color:'#facc15', fontWeight:700, background:'rgba(250,204,21,0.15)', padding:'2px 10px', borderRadius:8 }}>скор {bestSplit.score}</span>
          </div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.6)', marginBottom:6 }}>{bestSplit.pattern.description}</div>
          {bestSplit.rationale.slice(0, 3).map((x,i) => <div key={i} style={{ fontSize:11, color:'rgba(255,255,255,0.5)' }}>✓ {x}</div>)}
          <div style={{ display:'flex', gap:8, marginTop:8 }}>
            <button onClick={() => { setSelectedSplitId(bestSplit.pattern.id); }} style={{ padding:'6px 16px', borderRadius:10, fontSize:11, fontWeight:700, cursor:'pointer', background:'rgba(250,204,21,0.15)', border:'1px solid rgba(250,204,21,0.3)', color:'#facc15' }}>✅ Применить</button>
            <button onClick={buildBb} style={{ padding:'6px 16px', borderRadius:10, fontSize:11, fontWeight:700, cursor:'pointer', background:'rgba(0,230,138,0.15)', border:'1px solid rgba(0,230,138,0.3)', color:'#00e68a' }}>⚡ Собрать план</button>
          </div>
        </div>
      )}
      <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:8 }}>
        {ranked.map(r => {
          const sel = selectedSplitId === r.pattern.id;
          const mf = getMuscleFrequencies(r.pattern);
          const isSugSplit = bbSuggest.splitHints.has(r.pattern.id);
          return <div key={r.pattern.id} onClick={() => setSelectedSplitId(r.pattern.id)}
            style={{ padding:'10px 12px', borderRadius:10, cursor:'pointer', border:sel?'1px solid #00e68a':isSugSplit?'1px solid rgba(245,158,11,0.25)':'1px solid rgba(255,255,255,0.06)', background:sel?'rgba(0,230,138,0.08)':isSugSplit?'rgba(245,158,11,0.04)':'rgba(255,255,255,0.02)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontWeight:700, fontSize:12, color:sel?'#00e68a':isSugSplit?'#f59e0b':'#fff' }}>{isSugSplit ? '★ ' : ''}{r.pattern.name}</span>
              <span style={{ fontSize:11, color:ACCENT, fontWeight:700, background:'rgba(0,230,138,0.12)', padding:'2px 8px', borderRadius:8 }}>скор {r.score}</span>
            </div>
            <div style={{ ...SMALL, marginTop:4 }}>{r.pattern.description}</div>
            {isSugSplit && !sel && <div style={{ fontSize:10, color:'#f59e0b', marginTop:2 }}>★ Рекомендован для цели «{bbGoal}» + уровня «{bbLevel}»</div>}
            {sel && <div style={{ marginTop:6, fontSize:11, color:'rgba(255,255,255,0.7)' }}>{r.rationale.map((x,i) => <div key={i}>✓ {x}</div>)}</div>}
            <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:4 }}>
              {mf.map(f => (
                <span key={f.tag} style={{ fontSize:11, padding:'1px 6px', borderRadius:4, background:f.freq >= 2 ? 'rgba(0,230,138,0.08)' : 'rgba(255,255,255,0.03)', color:f.freq >= 2 ? '#00e68a' : 'rgba(255,255,255,0.4)' }}>{TAG_LABELS_RU[f.tag] || f.tag} ~ {f.freq}×/нед</span>
              ))}
            </div>
          </div>;
        })}
      </div>
      <div style={{ display:'flex', gap:8, marginTop:12 }}>
        <button style={{ ...BTN, flex:1 }} onClick={buildBb}>✅ Собрать план ({bbWeeks} нед, фазовая периодизация)</button>
        <button style={BTN_GHOST} onClick={() => setStep('ped')}>← Назад</button>
      </div>
    </div>
  );

  const renderPlanWithComments = () => {
    if (!builtPlan || !metrics) return null;
    const W = builtPlan.weeks;
    const wk = W[Math.min(bbWeekSel, W.length) - 1] || W[0];
    const currentPhase = phaseForWeek(wk.week, bbWeeks);
    const srpe = loadSRPESessions();
    const acwr = srpe.length >= 2 ? acuteChronicRatio(toDailyLoads(srpe)) : null;
    const needsDeload = autoDeload && acwr && acwr.ratio > 1.3;

    return (
      <div>
        <div style={H}>📋 Шаг 4: План — {builtPlan.pattern.name}</div>

        {/* Phase banner */}
        <div style={{ marginBottom:6, padding:'8px 10px', borderRadius:10, background:PHASE_COLORS[currentPhase] + '18', border:'1px solid ' + PHASE_COLORS[currentPhase] + '30' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:12, fontWeight:700, color:PHASE_COLORS[currentPhase] }}>📌 Фаза: {PHASE_LABELS[currentPhase]}</span>
            <span style={{ fontSize:11, color:'rgba(255,255,255,0.7)' }}>
              RIR {PHASE_CONFIGS[currentPhase].rirRange[0]}→{PHASE_CONFIGS[currentPhase].rirRange[1]} · Повт {PHASE_CONFIGS[currentPhase].repRange[0]}-{PHASE_CONFIGS[currentPhase].repRange[1]} · Темп {PHASE_CONFIGS[currentPhase].tempo}
            </span>
          </div>
          <div style={{ marginTop:4, fontSize:11, color:'rgba(255,255,255,0.55)' }}>
            {currentPhase === 'accumulation' && '🎯 Цель: накопление метаболического стресса. Больше объёма, умеренные веса, контроль времени под нагрузкой.'}
            {currentPhase === 'intensification' && '🎯 Цель: механическое натяжение. Снижение объёма, рост рабочих весов, подходы ближе к отказу.'}
            {currentPhase === 'deload' && '🎯 Цель: активное восстановление. Минимум объёма, лёгкие веса, сохранение движения.'}
            {currentPhase === 'peaking' && '🎯 Цель: максимальная сила и плотность. Низкий объём, высокие веса, околопредельные подходы.'}
          </div>
        </div>

        {needsDeload && currentPhase !== 'deload' && (
          <div style={{ marginBottom:6, padding:8, borderRadius:10, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)', color:'#ef4444', fontSize:11, fontWeight:600 }}>
            {'🚨'} ACWR {acwr?.ratio.toFixed(2)} {`>`} 1.3 — рекомендуется разгрузка. Включена авто-разгрузка на неделе {phases.find(p => p.phase === 'deload')?.week || 'последней'}.
          </div>
        )}

        {/* Фаза 6: Предпросмотр делод-недели */}
        {currentPhase === 'deload' && (() => {
          const dp = DELOAD_PROTOCOLS[deloadType] || DELOAD_PROTOCOLS.pump;
          return (
            <div style={{ marginBottom:8, padding:10, borderRadius:12, background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.2)' }}>
              <div style={{ fontSize:12, fontWeight:800, color:'#22c55e', marginBottom:6 }}>🔋 DELOAD-неделя — активное восстановление</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:6, fontSize:11 }}>
                <div style={{ textAlign:'center', padding:6, borderRadius:8, background:'rgba(34,197,94,0.06)' }}>
                  <div style={{ color:'rgba(255,255,255,0.5)', fontSize:10 }}>Объём</div>
                  <div style={{ fontWeight:700, color:'#22c55e' }}>−{Math.round((1-dp.volumeMultiplier)*100)}%</div>
                </div>
                <div style={{ textAlign:'center', padding:6, borderRadius:8, background:'rgba(34,197,94,0.06)' }}>
                  <div style={{ color:'rgba(255,255,255,0.5)', fontSize:10 }}>Интенсивность</div>
                  <div style={{ fontWeight:700, color:'#22c55e' }}>−{Math.round((1-dp.intensityMultiplier)*100)}%</div>
                </div>
                <div style={{ textAlign:'center', padding:6, borderRadius:8, background:'rgba(34,197,94,0.06)' }}>
                  <div style={{ color:'rgba(255,255,255,0.5)', fontSize:10 }}>RIR</div>
                  <div style={{ fontWeight:700, color:'#22c55e' }}>→{dp.rirTarget}</div>
                </div>
                <div style={{ textAlign:'center', padding:6, borderRadius:8, background:'rgba(34,197,94,0.06)' }}>
                  <div style={{ color:'rgba(255,255,255,0.5)', fontSize:10 }}>Повторения</div>
                  <div style={{ fontWeight:700, color:'#22c55e' }}>{dp.repRange[0]}-{dp.repRange[1]}</div>
                </div>
              </div>
              <div style={{ marginTop:6, fontSize:10, color:'rgba(255,255,255,0.6)' }}>Тип: {deloadType} — {dp.description}</div>
            </div>
          );
        })()}

        {/* Auto-reg + ACWR */}
        <div style={{ marginTop:6, padding:'8px 10px', borderRadius:10, background:autoRegResult.deload?'rgba(239,68,68,0.08)':'rgba(96,165,250,0.06)', border:'1px solid '+(autoRegResult.deload?'rgba(239,68,68,0.25)':'rgba(96,165,250,0.2)') }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:11, fontWeight:700, color:autoRegResult.deload?'#ef4444':'#60a5fa' }}>{shouldTrainToday({ readiness: linked.readiness?.recovery ?? 80, acwr: autoRegResult.deload ? { ratio: 1.8, zone: 'dangerous' } : { ratio: 1.0, zone: 'optimal' }, fatigue: linked.readiness?.fatigue ?? 30, hrvRatio: linked.profile?.settings?.baselineHrvRatio ?? 1.0 }).reason}</span>
            <button onClick={() => setAutoRegOn(a => !a)} style={{ padding:'5px 10px', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer', border:'none', background:autoRegOn?'#60a5fa':'rgba(255,255,255,0.1)', color:autoRegOn?'#000':'var(--text-dim)' }}>{autoRegOn?'Авторег ON':'Вкл. авторег'}</button>
          </div>
          {acwr && <div style={{ marginTop:4, fontSize:11, color:'rgba(255,255,255,0.5)' }}>ACWR {acwr.ratio.toFixed(2)} — {acwr.zone === 'dangerous' ? '⛔ опасная зона, разгрузка' : acwr.zone === 'caution' ? '⚠ осторожно' : '✅ оптимально'}</div>}
          {autoRegOn && <div style={{ marginTop:6, fontSize:11, color:'rgba(255,255,255,0.7)' }}><div>Топ-сет ×{autoRegResult.topSetPctMultiplier} · объём ×{autoRegResult.volumeMultiplier} · RIR +{autoRegResult.rirShift}{autoRegResult.deload?' · 🔴 DELOAD':''}</div>{autoRegResult.decisions.slice(0,2).map((d,i) => <div key={i}>• {d}</div>)}</div>}
        </div>

        {/* Слой 1: живой советник (на основе данных плана) */}
        {(() => {
          const lm = builtPlan.volumeLandmarks || [];
          if (lm.length === 0) return null;
          const MUSCLE_RU: Record<string, string> = { chest:'Грудь', back:'Спина', shoulders:'Плечи', quads:'Квадрицепс', hamstrings:'Бицепс бедра', glutes:'Ягодицы', calves:'Икры', biceps:'Бицепс', triceps:'Трицепс', forearms:'Предплечье', abs:'Пресс', traps:'Трапеции', arms:'Руки', legs:'Ноги', core:'Кор' };
          const tips: string[] = [];
          lm.forEach(r => {
            const name = MUSCLE_RU[r.group] || r.label || r.group;
            if (r.mrv && r.sets > r.mrv + 1) tips.push(`🔴 ${name}: ${r.sets} сет > MRV ${r.mrv} — снизьте на ${r.sets - r.mrv} сет.`);
            else if (r.mev && r.sets < r.mev) tips.push(`🟡 ${name}: ${r.sets} сет < MEV ${r.mev} — доберите объём.`);
          });
          if (acwr) {
            if (acwr.ratio > 1.3) tips.push(`🔴 ACWR ${acwr.ratio.toFixed(2)} — перетренированность, снизьте объём перед пиком.`);
            else if (acwr.ratio < 0.8) tips.push(`🟡 ACWR ${acwr.ratio.toFixed(2)} — недогруз, можно добавить объём.`);
            else tips.push(`✅ ACWR ${acwr.ratio.toFixed(2)} — баланс нагрузки.`);
          }
          if (weakPoints.length) tips.push(`🎯 Слабые группы (${weakPoints.join(', ')}) получают приоритет — проверьте feeder-сеты ниже.`);
          if (tips.length === 0) tips.push('✅ План сбалансирован по объёму и восстановлению. Можно переходить к отчёту качества.');
          return (
            <div style={{ marginTop:6, padding:'10px 12px', borderRadius:12, background:'rgba(0,230,138,0.05)', border:'1px solid rgba(0,230,138,0.18)' }}>
              <div style={{ fontSize:12, fontWeight:800, color:'#00e68a', marginBottom:6 }}>💡 Советник плана</div>
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {tips.map((t,i) => <div key={i} style={{ fontSize:11, color:'rgba(255,255,255,0.8)', lineHeight:1.4 }}>{t}</div>)}
              </div>
            </div>
          );
        })()}

        {/* Overload targets for this week */}
        {(() => {
          // Per-muscle частота и объём
          const freq = builtPlan.muscleFrequency || {};
          const vol = builtPlan.rotationMuscleVolume || {};
          const muscleEntries = Object.keys(freq).map(m => ({ muscle: m, freq: freq[m] || 0, sets: vol[m] || 0 })).sort((a, b) => b.sets - a.sets);
          if (muscleEntries.length === 0) return null;
          const MUSCLE_RU: Record<string, string> = { chest: 'Грудь', back: 'Спина', shoulders: 'Плечи', quads: 'Квадрицепс', hamstrings: 'Бицепс бедра', glutes: 'Ягодицы', calves: 'Икры', biceps: 'Бицепс', triceps: 'Трицепс', forearms: 'Предплечье', abs: 'Пресс', traps: 'Трапеции', arms: 'Руки', legs: 'Ноги', core: 'Кор' };
          const freqColor = (f: number) => f >= 3 ? '#ef4444' : f === 2 ? '#22c55e' : '#f59e0b';
          const freqLabel = (f: number) => f >= 3 ? `${f}×/нед (высокая)` : f === 2 ? `${f}×/нед (оптимум)` : `${f}×/нед`;
          return (
            <ExpandableCard title="📊 Частота и объём по мышцам" icon="📊"
              short={`${muscleEntries.length} групп · ${muscleEntries.filter(e => e.freq >= 2).length} ×2+/нед`}
              full={
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {muscleEntries.map(({ muscle, freq: f, sets }) => (
                    <div key={muscle} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: freqColor(f), flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>{MUSCLE_RU[muscle] || muscle}</div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{freqLabel(f)} · {sets} сет/нед</div>
                      </div>
                    </div>
                  ))}
                </div>
              }
            />
          );
        })()}

        {(() => {
          const targets = computeOverloadTargets(wk, loadStrategy, bbWorkMax, bbWeeks, currentPhase).slice(0, 6);
          if (targets.length === 0) return null;
          return (
            <ExpandableCard title={'🎯 Цели прогрессии на эту неделю (' + loadStrategy.replace('_', ' ') + ')'} icon="🎯" short={targets[0].nextTarget + (targets.length > 1 ? (' + ещё ' + (targets.length - 1)) : '')} full={
              <div>{targets.map((t, i) => <div key={i} style={{ padding:'4px 8px', marginBottom:4, borderRadius:8, background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.12)', fontSize:11, color:'rgba(255,255,255,0.8)' }}>
                <b>{t.exerciseName}</b>: {t.nextTarget}
              </div>)}</div>
            } />
          );
        })()}

        {/* Week selector with phase colors */}
        <div style={{ marginTop:10 }}>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.65)', marginBottom:6, fontWeight:700 }}>
            Неделя {wk.week} из {W.length} · <span style={{ color:PHASE_COLORS[currentPhase] }}>{PHASE_LABELS[currentPhase]}</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(36px, 1fr))', gap:4 }}>
            {W.map(w => {
              const ph = phaseForWeek(w.week, bbWeeks);
              const active = w.week === wk.week;
              return <button key={w.week} onClick={() => setBbWeekSel(w.week)}
                style={{ padding:'7px 0', borderRadius:7, fontSize:11, fontWeight:700, cursor:'pointer',
                  border: active ? '2px solid ' + PHASE_COLORS[ph] : '1px solid rgba(255,255,255,0.08)',
                  background: active ? PHASE_COLORS[ph] + '30' : 'rgba(255,255,255,0.02)',
                  color: active ? PHASE_COLORS[ph] : '#fff' }}>
                {w.week}
              </button>;
            })}
          </div>
        </div>

        {/* Calendar with phase colors */}
        <div style={{ marginTop:8, padding:8, borderRadius:10, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.6)', marginBottom:6 }}>📅 Календарь мезоцикла (цвет = фаза)</div>
          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
            {W.map(w => {
              const ph = phaseForWeek(w.week, bbWeeks);
              const active = w.week === wk.week;
              const daySets = w.sessions.map(s => s.exercises.reduce((ss, e) => ss + e.sets, 0));
              const maxD = Math.max(1, ...W.flatMap(ww => ww.sessions.map(s => s.exercises.reduce((ss, e) => ss + e.sets, 0))));
              return (
                <div key={w.week} onClick={() => setBbWeekSel(w.week)} style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 6px', borderRadius:8, cursor:'pointer', background:active ? PHASE_COLORS[ph] + '15' : 'transparent', borderLeft: '3px solid ' + PHASE_COLORS[ph] + '60' }}>
                  <span style={{ fontSize:11, fontWeight:700, color:active ? PHASE_COLORS[ph] : 'rgba(255,255,255,0.7)', minWidth:26 }}>Н{w.week}</span>
                  <div style={{ flex:1, display:'flex', gap:2 }}>{daySets.map((ds, di) => <div key={di} style={{ flex:1, height:14, borderRadius:3, background: `linear-gradient(180deg,${PHASE_COLORS[ph]},${PHASE_COLORS[ph]}88)`, opacity: 0.15 + 0.85 * (ds / maxD) }} />)}</div>
                  <span style={{ fontSize:11, color:'rgba(255,255,255,0.5)', minWidth:30, textAlign:'right' }}>{daySets.reduce((a,b)=>a+b,0)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Фактическая нагрузка из дневника (sRPE/ACWR) */}
        {(() => {
          const srpeSessions = loadSRPESessions();
          if (srpeSessions.length === 0) return null;
          const acwrData = acuteChronicRatio(toDailyLoads(srpeSessions));
          const last7 = srpeSessions.filter(s => {
            const d = new Date(s.date || '');
            const diff = (Date.now() - d.getTime()) / 86400000;
            return diff <= 7;
          });
          const avgRPE = last7.length > 0 ? last7.reduce((s, x) => s + (x.sRPE || 7), 0) / last7.length : 0;
          const zoneColor = acwrData.zone === 'dangerous' ? '#ef4444' : acwrData.zone === 'caution' ? '#f59e0b' : '#22c55e';
          const zoneLabel = acwrData.zone === 'dangerous' ? '⛔ опасная' : acwrData.zone === 'caution' ? '⚠ осторожно' : '✅ оптимально';
          return (
            <div style={{ marginTop:8, padding:10, borderRadius:10, background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.15)' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#60a5fa', marginBottom:6 }}>📊 Твоя фактическая нагрузка (из дневника)</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, fontSize:11 }}>
                <div style={{ textAlign:'center', padding:6, borderRadius:8, background:'rgba(96,165,250,0.06)' }}>
                  <div style={{ color:'rgba(255,255,255,0.5)', fontSize:10 }}>Сессий (7д)</div>
                  <div style={{ fontWeight:700, color:'#60a5fa' }}>{last7.length}</div>
                </div>
                <div style={{ textAlign:'center', padding:6, borderRadius:8, background:'rgba(96,165,250,0.06)' }}>
                  <div style={{ color:'rgba(255,255,255,0.5)', fontSize:10 }}>Средний RPE</div>
                  <div style={{ fontWeight:700, color:'#60a5fa' }}>{avgRPE.toFixed(1)}</div>
                </div>
                <div style={{ textAlign:'center', padding:6, borderRadius:8, background: zoneColor + '10' }}>
                  <div style={{ color:'rgba(255,255,255,0.5)', fontSize:10 }}>ACWR</div>
                  <div style={{ fontWeight:700, color: zoneColor }}>{acwrData.ratio.toFixed(2)} <span style={{ fontSize:9 }}>{zoneLabel}</span></div>
                </div>
              </div>
              {acwrData.ratio > 1.3 && <div style={{ marginTop:6, fontSize:10, color:'#f59e0b' }}>⚠ Восстановление недостаточно — план учитывает авторегуляцию.</div>}
            </div>
          );
        })()}

        {/* Сравнение недель — week 1 vs current week */}
        {(() => {
          const w1 = W[0];
          const wCur = wk;
          if (w1.week === wCur.week) return null;
          const w1Sets = w1.sessions.reduce((s, sess) => s + sess.exercises.reduce((ss, e) => ss + e.sets, 0), 0);
          const wCurSets = wCur.sessions.reduce((s, sess) => s + sess.exercises.reduce((ss, e) => ss + e.sets, 0), 0);
          const w1Rir = w1.sessions.flatMap(s => s.exercises).reduce((s, e) => s + e.rir * e.sets, 0) / Math.max(1, w1Sets);
          const wCurRir = wCur.sessions.flatMap(s => s.exercises).reduce((s, e) => s + e.rir * e.sets, 0) / Math.max(1, wCurSets);
          const w1Wt = w1.sessions.flatMap(s => s.exercises).reduce((s, e) => s + (e.workSets[0]?.weight || 80) * e.sets, 0);
          const wCurWt = wCur.sessions.flatMap(s => s.exercises).reduce((s, e) => s + (e.workSets[0]?.weight || 80) * e.sets, 0);
          const setsDiff = wCurSets - w1Sets;
          const rirDiff = wCurRir - w1Rir;
          const wtDiff = wCurWt - w1Wt;
          return (
            <ExpandableCard title={`📋 Сравнение: неделя 1 vs неделя ${wCur.week}`} icon="📋"
              short={`Сеты: ${w1Sets}→${wCurSets} (${setsDiff >= 0 ? '+' : ''}${setsDiff}) · RIR: ${w1Rir.toFixed(1)}→${wCurRir.toFixed(1)} · Тоннаж: ${wtDiff >= 0 ? '+' : ''}${Math.round(wtDiff)}кг`}
              full={
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, fontSize:11 }}>
                  <div style={{ padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)' }}>
                    <div style={{ color:'rgba(255,255,255,0.5)', fontSize:10 }}>Объём (сеты)</div>
                    <div style={{ fontWeight:700 }}>{w1Sets} → {wCurSets} <span style={{ color: setsDiff >= 0 ? '#22c55e' : '#ef4444' }}>({setsDiff >= 0 ? '+' : ''}{setsDiff})</span></div>
                  </div>
                  <div style={{ padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)' }}>
                    <div style={{ color:'rgba(255,255,255,0.5)', fontSize:10 }}>Средний RIR</div>
                    <div style={{ fontWeight:700 }}>{w1Rir.toFixed(1)} → {wCurRir.toFixed(1)} <span style={{ color: rirDiff <= 0 ? '#22c55e' : '#f59e0b' }}>({rirDiff >= 0 ? '+' : ''}{rirDiff.toFixed(1)})</span></div>
                  </div>
                  <div style={{ padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)' }}>
                    <div style={{ color:'rgba(255,255,255,0.5)', fontSize:10 }}>Тоннаж (кг)</div>
                    <div style={{ fontWeight:700 }}>{Math.round(w1Wt)} → {Math.round(wCurWt)} <span style={{ color: wtDiff >= 0 ? '#22c55e' : '#ef4444' }}>({wtDiff >= 0 ? '+' : ''}{Math.round(wtDiff)})</span></div>
                  </div>
                </div>
              }
            />
          );
        })()}

        {/* Progression chart across all weeks */}
        {(() => {
          const wkStats = W.map(w => {
            const ph = phaseForWeek(w.week, bbWeeks);
            const exs = w.sessions.flatMap(s => s.exercises);
            const sets = exs.reduce((s, e) => s + e.sets, 0);
            const rir = sets > 0 ? exs.reduce((s, e) => s + e.rir * e.sets, 0) / sets : 0;
            const totalWt = exs.reduce((s, e) => s + (e.workSets[0]?.weight || 80) * e.sets, 0);
            return { week: w.week, phase: ph, sets, rir, tonnage: totalWt };
          });
          const maxSets = Math.max(1, ...wkStats.map(x => x.sets));
          const maxTon = Math.max(1, ...wkStats.map(x => x.tonnage));
          return (
            <div style={{ marginTop:10, padding:'8px 10px', borderRadius:10, background:'rgba(34,197,94,0.04)', border:'1px solid rgba(34,197,94,0.15)' }}>
              <div style={{ fontSize:11, fontWeight:800, color:'#22c55e', marginBottom:6 }}>📈 ПРОГРЕССИЯ ПО НЕДЕЛЯМ: RIR / ОБЪЁМ / ТОННАЖ</div>
              <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                {wkStats.map(x => {
                  const barW = 220;
                  return (
                    <div key={x.week} style={{ display:'flex', alignItems:'center', gap:4, padding:'2px 0' }}>
                      <button onClick={() => setBbWeekSel(x.week)} style={{
                        minWidth:32, padding:'2px 4px', borderRadius:4, cursor:'pointer', fontSize:11, fontWeight:700,
                        border: x.week === bbWeekSel ? '1px solid ' + PHASE_COLORS[x.phase] : '1px solid transparent',
                        background: x.week === bbWeekSel ? PHASE_COLORS[x.phase] + '20' : 'transparent',
                        color: x.week === bbWeekSel ? PHASE_COLORS[x.phase] : 'rgba(255,255,255,0.5)',
                      }}>{x.week}</button>
                      <div style={{ fontSize:11, fontWeight:600, minWidth:56, color: PHASE_COLORS[x.phase] }}>{PHASE_LABELS[x.phase]}</div>
                      <div style={{ fontSize:11, fontWeight:700, minWidth:20, textAlign:'center', color:x.rir <= 1 ? '#ef4444' : x.rir <= 2 ? '#f59e0b' : '#22c55e' }}>RIR{x.rir.toFixed(0)}</div>
                      <div style={{ flex: 1, display:'flex', gap:2, alignItems:'center' }}>
                        <div style={{ height:8, width: Math.round((x.sets / maxSets) * barW), borderRadius:3, background: PHASE_COLORS[x.phase], opacity:0.6, transition:'width 0.5s', minWidth: x.sets > 0 ? 4 : 0 }} />
                        <span style={{ fontSize:11, fontWeight:600, color:'rgba(255,255,255,0.4)', minWidth:16 }}>{x.sets}</span>
                      </div>
                      <div style={{ flex: 1, display:'flex', gap:2, alignItems:'center' }}>
                        <div style={{ height:6, width: Math.round((x.tonnage / maxTon) * barW), borderRadius:2, background:'#60a5fa', opacity:0.5, transition:'width 0.5s', minWidth: x.tonnage > 0 ? 4 : 0 }} />
                        <span style={{ fontSize:11, fontWeight:600, color:'rgba(255,255,255,0.4)', minWidth:24 }}>{(x.tonnage / 1000).toFixed(1)}k</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display:'flex', gap:12, marginTop:4, fontSize:11, color:'rgba(255,255,255,0.3)', borderTop:'1px solid rgba(255,255,255,0.05)', paddingTop:3 }}>
                <span><span style={{ width:8, height:8, borderRadius:2, background:'#22c55e', display:'inline-block', marginRight:2 }} /> сеты/нед</span>
                <span><span style={{ width:8, height:8, borderRadius:2, background:'#60a5fa', display:'inline-block', marginRight:2 }} /> тоннаж</span>
                <span>RIR: 🟢3+ 🟡1-2 🔴0</span>
              </div>
            </div>
          );
        })()}

        {/* Daily session cards — карточки дней с frosted glass */}
        <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:12 }}>
          {wk.sessions.map((s, si) => {
            const dayColor = PHASE_COLORS[currentPhase];
            const daySets = s.exercises.reduce((ss, e) => ss + e.sets, 0);
            return (
              <DayCard key={si} day={{
                key: String(si),
                title: 'День ' + (si + 1),
                phase: currentPhase,
                volumeTag: s.exercises.length + ' упр · ' + daySets + ' сет',
                headerActions: (
                  <span style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <span style={{ padding:'3px 8px', borderRadius:7, fontSize:11, fontWeight:700, background: dayColor + '20', color: dayColor, border:'1px solid ' + dayColor + '30' }}>
                      {PHASE_LABELS[currentPhase]}
                    </span>
                    <span style={{ fontSize:11, fontWeight:600, color:'rgba(255,255,255,0.45)' }}>
                      {s.character} · {s.sessionTag || ''}
                    </span>
                  </span>
                ),
                renderBody: (
                  <>

                {/* Упражнения */}
                <div style={{ padding:'8px 10px' }}>
                  {s.exercises.map((e, ei) => {
                    const rawW = e.workSets[0]?.weight || 80;
                    const adjW = autoRegOn && autoRegResult ? Math.round(rawW * autoRegResult.topSetPctMultiplier * 10) / 10 : rawW;
                    const adjSets0 = autoRegOn && autoRegResult ? Math.max(1, Math.round(e.sets * autoRegResult.volumeMultiplier)) : e.sets;
                    const editKey = `${si}-${ei}`;
                    const edit = exerciseEdits[editKey] || { sets: adjSets0, reps: e.workSets[0]?.reps || 10, weight: adjW };
                    const isEditing = editMode?.dayIdx === si && editMode?.exIdx === ei;
                    const comment = e.comment || exerciseComment(e, weakPoints, bbFocus, currentPhase);
                    const roleColor = e.role === 'primary' ? '#00e68a' : '#a855f7';
                    const charColor = e.character === 'тяж' ? '#ef4444' : '#60a5fa';
                    
                    return (
                      <div key={ei} style={{
                        padding:'10px 12px', marginBottom:8,
                        background: 'rgba(255,255,255,0.025)',
                        borderRadius:10, border: '0.5px solid rgba(255,255,255,0.04)',
                      }}>
                        {/* Имя упражнения + кнопки */}
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:14, fontWeight:800, color:'#fff', lineHeight:1.25, marginBottom:5, letterSpacing:'-0.2px' }}>
                              {e.name}
                            </div>
                            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                              <span style={{ fontSize:11, fontWeight:700, padding:'2px 7px', borderRadius:5, background: roleColor + '20', color: roleColor, border: '0.5px solid ' + roleColor + '30' }}>
                                {e.role === 'primary' ? '🎯 Основное' : '📌 Добивка'}
                              </span>
                              <span style={{ fontSize:11, fontWeight:700, padding:'2px 7px', borderRadius:5, background: charColor + '20', color: charColor, border: '0.5px solid ' + charColor + '30' }}>
                                {e.character === 'тяж' ? '💪 Тяж' : e.character === 'памп' ? '🩸 Памп' : '🌿 Лёг'}
                              </span>
                              {isWeakMuscle(e.muscle, weakPoints) && (
                                <span style={{ fontSize:11, fontWeight:700, padding:'2px 7px', borderRadius:5, background:'rgba(250,204,21,0.15)', color:'#facc15', border:'0.5px solid rgba(250,204,21,0.3)' }}>
                                  🔥 Отстающая
                                </span>
                              )}
                              {bbFocus === e.muscle && (
                                <span style={{ fontSize:11, fontWeight:700, padding:'2px 7px', borderRadius:5, background:'rgba(236,72,153,0.15)', color:'#ec4899', border:'0.5px solid rgba(236,72,153,0.3)' }}>
                                  ⭐ Специализация
                                </span>
                              )}
                            </div>
                          </div>
                          <div style={{ display:'flex', gap:6, marginLeft:8 }}>
                            <button onClick={() => setSubTarget({ dayIdx: si, exIdx: ei, sessionIdx: si })} title="Заменить"
                              style={{ padding:'3px 8px', borderRadius:8, fontSize:11, fontWeight:600, cursor:'pointer', border:'1px solid rgba(0,230,138,0.2)', background:'rgba(0,230,138,0.06)', color:'#00e68a' }}>
                              🔄
                            </button>
                            <button onClick={() => setEditMode(isEditing ? null : { dayIdx: si, exIdx: ei })} title="Править"
                              style={{ padding:'3px 8px', borderRadius:8, fontSize:11, fontWeight:600, cursor:'pointer', border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.03)', color:'rgba(255,255,255,0.7)' }}>
                              {isEditing ? '✓' : '✎'}
                            </button>
                          </div>
                        </div>

                        {/* Редактирование (inline) */}
                        {isEditing && (
                          <div style={{ display:'flex', gap:8, marginBottom:8, alignItems:'center', padding:'6px 10px', borderRadius:10, background:'rgba(255,255,255,0.04)' }}>
                            <div><span style={SMALL}>Сеты</span><input type="number" value={edit.sets} min={0} max={20} onChange={e2 => setExerciseEdits(p => ({ ...p, [editKey]: { ...edit, sets: parseInt(e2.target.value) || 0 } }))} style={{ width:48, ...IN }} /></div>
                            <div><span style={SMALL}>Повт</span><input type="number" value={edit.reps} min={1} max={30} onChange={e2 => setExerciseEdits(p => ({ ...p, [editKey]: { ...edit, reps: parseInt(e2.target.value) || 1 } }))} style={{ width:48, ...IN }} /></div>
                            <div><span style={SMALL}>Вес</span><input type="number" value={edit.weight} min={0} max={500} onChange={e2 => setExerciseEdits(p => ({ ...p, [editKey]: { ...edit, weight: parseInt(e2.target.value) || 0 } }))} style={{ width:55, ...IN }} /></div>
                          </div>
                        )}

                        {/* Параметры: грид чипсов */}
                        <div style={{
                          display:'grid',
                          gridTemplateColumns:'repeat(auto-fill, minmax(80px, 1fr))',
                          gap:6,
                        }}>
                          <Chip label="Подходы" value={edit.sets + '×' + edit.reps} color="#22c55e" />
                          <Chip label="RIR" value={String(e.rir)} color="#f59e0b" />
                          <Chip label="Вес" value={edit.weight + ' кг'} color="#60a5fa" />
                          {e.workSets[0]?.tempo && <Chip label="Темп" value={e.workSets[0].tempo} color="#a855f7" />}
                          {e.workSets[0]?.restSeconds && <Chip label="Отдых" value={e.workSets[0].restSeconds + 'с'} color="rgba(255,255,255,0.55)" />}
                          <Chip label="Группа" value={e.muscle} color="rgba(255,255,255,0.55)" />
                        </div>

                        {/* Комментарий */}
                        <div style={{ marginTop:6, fontSize:11, color:'rgba(255,255,255,0.5)', lineHeight:1.4, padding:'4px 8px', borderRadius:8, background:'rgba(255,255,255,0.02)' }}>
                          {comment}
                        </div>

                        {/* Разминка */}
                        {(e.warmupSets && e.warmupSets.length > 0 ? e.warmupSets : (e.role === 'primary' && e.character === 'тяж' ? buildWarmup(edit.weight, true) : [])).length > 0 && (
                          <details style={{ marginTop:4 }}>
                            <summary style={{ fontSize:11, fontWeight:600, color:'rgba(96,165,250,0.7)', cursor:'pointer' }}>🔥 Разминка ({(e.warmupSets && e.warmupSets.length > 0 ? e.warmupSets : buildWarmup(edit.weight, true)).length} подхода)</summary>
                            <div style={{ display:'flex', gap:8, marginTop:4, flexWrap:'wrap' }}>
                              {(e.warmupSets && e.warmupSets.length > 0 ? e.warmupSets : buildWarmup(edit.weight, true)).map((w, wi) => (
                                <span key={wi} style={{ fontSize:10, color:'rgba(255,255,255,0.6)', padding:'2px 6px', borderRadius:4, background:'rgba(96,165,250,0.08)' }}>
                                  {w.reps}×{w.load} кг
                                </span>
                              ))}
                            </div>
                          </details>
                        )}

                        {/* Rationale */}
                        {e.rationale && (
                          <details style={{ marginTop:4 }}>
                            <summary style={{ fontSize:11, fontWeight:600, color:'rgba(96,165,250,0.6)', cursor:'pointer' }}>🧠 Почему это упражнение?</summary>
                            <div style={{ fontSize:10, color:'rgba(255,255,255,0.45)', padding:'2px 6px', lineHeight:1.4, marginTop:2 }}>{e.rationale}</div>
                          </details>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>)} } />
            );
          })}
        </div>
        {/* Feeder sets for weak points */}
        {weakPoints.length > 0 && (() => {
          const feeders = suggestFeeders(weakPoints, []);
          if (feeders.length === 0) return null;
          return (
            <ExpandableCard title={'🔥 Feeder-сеты для слабых групп (ежедневно)'} icon="🔥" short={feeders.map(f => f.muscle).join(', ')} full={
              <div>{feeders.map((f, i) => <div key={i} style={{ padding:'6px 8px', marginBottom:4, borderRadius:8, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.12)', fontSize:11, color:'rgba(255,255,255,0.8)' }}>
                <b>{f.exercise}</b> — {f.sets}×{f.reps}, {f.notes}
              </div>)}</div>
            } />
          );
        })()}

        {/* Summary */}
        <div style={{ display:'flex', gap:12, marginTop:10 }}>
          <button style={{ ...BTN, flex:1 }} onClick={() => setStep('quality')}>Далее: отчёт качества →</button>
          <button style={BTN_GHOST} onClick={() => setBbWeekSel(1)}>На первую нед</button>
        </div>
      </div>
    );
  };

  const renderQuality = () => {
    if (!metrics || !quality || !builtPlan) return null;
    const W = builtPlan.weeks;
    const srpe = loadSRPESessions();
    const loads = srpe.length >= 2 ? toDailyLoads(srpe) : null;
    const ratio = loads ? acuteChronicRatio(loads) : null;
    return (
      <div>
        <div style={H}>📊 Шаг 5: Качество и нагрузка плана</div>
        {/* Validation banners */}
        {(() => {
          const ws = weeklySetsFromBBPlan(W);
          const b = validatePlan({ weeklySets: ws, level: bbLevel, goal: bbGoal, daysPerWeek: bbDays, weakPoints, readiness: ((prof.recovery ?? 7) * 10) });
          if (b.length === 0) return null;
          return (
            <div style={{ ...CARD, marginBottom:8, background:'rgba(220,38,38,0.04)', border:'1px solid rgba(220,38,38,0.15)' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#f87171', marginBottom:6 }}>🛡 Валидация плана</div>
              {b.map((bn, i) => (
                <div key={i} style={{ fontSize:11, color:bn.level==='error'?'#f87171':bn.level==='warning'?'#fbbf24':'rgba(255,255,255,0.6)', marginBottom:4, padding:'4px 6px', borderRadius:4, background:bn.level==='error'?'rgba(248,113,113,0.08)':bn.level==='warning'?'rgba(251,191,36,0.08)':'rgba(255,255,255,0.03)', borderLeft:'2px solid '+(bn.level==='error'?'#f87171':bn.level==='warning'?'#fbbf24':'rgba(255,255,255,0.2)'), lineHeight:1.4 }}>
                  <div style={{ fontWeight:700 }}>{bn.level==='error'?'⛔':bn.level==='warning'?'⚠':'ℹ'} {bn.title}</div>
                  <div style={{ opacity:0.7, marginTop:1 }}>{bn.detail}</div>
                </div>
              ))}
            </div>
          );
        })()}
        {/* Cycle info if in cycle mode */}
        {planMode === 'bb_cycle' && selectedCycleId && (() => {
          const c = getCycleById(selectedCycleId);
          if (!c) return null;
          return (
            <div style={{ ...CARD, marginBottom:8, background:'rgba(0,230,138,0.04)', border:'1px solid rgba(0,230,138,0.12)' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#00e68a', marginBottom:4 }}>📋 ПРОФ-цикл: {c.meta.title}</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.6)' }}>
                <div>Упражнения: заданы циклом ({c.week1.reduce((s, d) => s + d.exercises.length, 0)} упр/день)</div>
                <div>Фазы: {c.meta.phases && c.meta.phases.length > 0 ? c.meta.phases.map(ph => ph.title || `нед ${ph.weekStart}-${ph.weekEnd}`).join(', ') : 'RIR-прогрессия'}</div>
                <div>{c.meta.conditions.slice(0, 2).map((cond, i) => <div key={i}>• {cond}</div>)}</div>
              </div>
            </div>
          );
        })()}
        {/* Score gauge */}
        <div style={{ ...CARD, textAlign:'center', borderLeft:'3px solid ' + (quality.score >= 85 ? '#22c55e' : quality.score >= 65 ? '#eab308' : '#ef4444') }}>
          <div style={{ fontSize:36, fontWeight:800, color:quality.score >=85?'#22c55e':quality.score >=65?'#eab308':'#ef4444' }}>{quality.score}/100</div>
          <div style={{ fontSize:13, fontWeight:700, color:quality.score >=85?'#22c55e':quality.score >=65?'#eab308':'#ef4444' }}>{quality.label}</div>
          <div style={{ marginTop:8, display:'flex', justifyContent:'center', gap:12, flexWrap:'wrap' }}>
            <div style={SMALL}>Всего сетов: <b style={{ color:'#fff' }}>{metrics.totalSets}</b></div>
            <div style={SMALL}>Тяж: <b style={{ color:'#ef4444' }}>{(metrics.тяжPct*100).toFixed(0)}%</b></div>
            <div style={SMALL}>Памп: <b style={{ color:'#60a5fa' }}>{(metrics.пампPct*100).toFixed(0)}%</b></div>
            <div style={SMALL}>RIR: <b style={{ color:'#f59e0b' }}>{metrics.avgRir.toFixed(1)}</b></div>
            <div style={SMALL}>Фаз: <b style={{ color:'#a855f7' }}>{phases.filter((p,i,a) => p.phase !== a[i-1]?.phase).length}</b></div>
          </div>
          {pedAdapt.combinedMrvMultiplier > 1 && (
            <div style={{ marginTop:6, fontSize:11, fontWeight:700, color:'#f59e0b', background:'rgba(245,158,11,0.08)', padding:'4px 10px', borderRadius:8, display:'inline-block' }}>
              💉 PED: MRV ×{pedAdapt.combinedMrvMultiplier.toFixed(2)} — пороги MEV/MAV/MRV увеличены
            </div>
          )}
        </div>
        {/* Объём vs MRV (volume-landmarks, единый источник) */}
        {builtPlan?.volumeLandmarks && builtPlan.volumeLandmarks.length > 0 && (
          <div style={{ ...CARD, marginBottom: 8, background: 'rgba(0,230,138,0.04)', borderLeft: '3px solid #00e68a' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#00e68a', marginBottom: 6 }}>
              📊 Объём по мышцам vs MRV {pedAdapt.combinedMrvMultiplier > 1 && <span style={{ opacity: 0.7, fontWeight: 600 }}>(MRV×{pedAdapt.combinedMrvMultiplier.toFixed(2)})</span>}
            </div>
            {builtPlan.volumeLandmarks.map(r => {
              const lColor = r.status === 'exceeding_mrv' ? '#ef4444' : r.status === 'approaching_mrv' ? '#f59e0b' : r.status === 'optimal' ? '#22c55e' : '#60a5fa';
              const barMax = Math.max(r.mrv, r.sets, 1);
              return (
                <div key={r.group} style={{ marginBottom: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
                    <span style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 700 }}>{r.label}</span>
                    <span style={{ color: lColor, fontWeight: 800 }}>{r.sets} подх <span style={{ opacity: 0.6, fontWeight: 600 }}>/ MRV {r.mrv}</span></span>
                  </div>
                  <div style={{ position: 'relative', height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: (r.sets / barMax * 100) + '%', background: lColor, borderRadius: 4 }} />
                    <div style={{ position: 'absolute', left: (r.mav / barMax * 100) + '%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.5)' }} />
                    <div style={{ position: 'absolute', left: (r.mrv / barMax * 100) + '%', top: 0, bottom: 0, width: 2, background: '#ef4444' }} />
                  </div>
                </div>
              );
            })}
            <div style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.45)', marginTop: 3 }}>Белая линия — MAV · красная — MRV. Превышение MRV → риск перетренированности.</div>
          </div>
        )}
        {/* Прогноз пиковой загрузки */}
        {(() => {
          const peakWeek = W.reduce((best, w, i) => {
            const ts = w.sessions.reduce((s, ss) => s + ss.exercises.reduce((ss2, e) => ss2 + e.sets, 0), 0);
            return ts > best.ts ? { wk: w.week, ts } : best;
          }, { wk: 1, ts: 0 });
          const deloadWeeks = phases.filter(p => p.phase === 'deload').map(p => p.week);
          const hasDeload = deloadWeeks.length > 0;
          const accWeeks = phases.filter(p => p.phase === 'accumulation');
          const intensWeeks = phases.filter(p => p.phase === 'intensification');
          return (
            <div style={{ marginTop:8, padding:10, borderRadius:10, background:'rgba(34,197,94,0.04)', border:'1px solid rgba(34,197,94,0.15)' }}>
              <div style={{ fontSize:11, fontWeight:800, color:'#22c55e', marginBottom:6 }}>🔮 Прогноз по фазам</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:11 }}>
                <div>
                  <span style={{ color:'rgba(255,255,255,0.5)' }}>Пик объёма: </span>
                  <span style={{ fontWeight:700, color:'#f59e0b' }}>нед {peakWeek.wk}</span>
                  <span style={{ color:'rgba(255,255,255,0.4)' }}> ({peakWeek.ts} сетов)</span>
                </div>
                <div>
                  <span style={{ color:'rgba(255,255,255,0.5)' }}>Разгрузка: </span>
                  <span style={{ fontWeight:700, color: hasDeload ? '#22c55e' : '#ef4444' }}>
                    {hasDeload ? 'нед ' + deloadWeeks.join(', ') : 'НЕ ЗАПЛАНИРОВАНА ⚠'}
                  </span>
                </div>
                <div>
                  <span style={{ color:'rgba(255,255,255,0.5)' }}>Накопление: </span>
                  <span style={{ fontWeight:700, color:'#60a5fa' }}>{accWeeks.length} нед</span>
                  <span style={{ color:'rgba(255,255,255,0.4)' }}> (RIR {PHASE_CONFIGS.accumulation.rirRange[0]}→{PHASE_CONFIGS.accumulation.rirRange[1]})</span>
                </div>
                <div>
                  <span style={{ color:'rgba(255,255,255,0.5)' }}>Интенсификация: </span>
                  <span style={{ fontWeight:700, color:'#ef4444' }}>{intensWeeks.length} нед</span>
                  <span style={{ color:'rgba(255,255,255,0.4)' }}> (RIR {PHASE_CONFIGS.intensification.rirRange[0]}→{PHASE_CONFIGS.intensification.rirRange[1]})</span>
                </div>
              </div>
              {!hasDeload && bbWeeks >= 6 && (
                <div style={{ marginTop:6, padding:'4px 8px', borderRadius:8, background:'rgba(239,68,68,0.1)', fontSize:11, color:'#ef4444' }}>
                  ⚠ Мезоцикл {bbWeeks} нед без разгрузки — высокий риск перетрена. Добавьте разгрузочную неделю.
                </div>
              )}
            </div>
          );
        })()}
        {/* MRV table */}
        <MetricCard title="Объём по мышцам (сетов/нед vs MEV/MAV/MRV)" icon="🏋️" accent="#a855f7">
          <div style={{ overflowX:'auto' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1.4fr 0.5fr 0.5fr 0.5fr 0.5fr', gap:2, fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', padding:'2px 0', minWidth:340 }}>
              <span>Мышца</span><span>Сетов</span><span>Тяж</span><span>Памп</span><span>MRV</span>
            </div>
            {(() => {
              const weakSet = new Set<string>(weakPoints as string[]);
              const weakVols = metrics.perMuscle.filter(x => weakSet.has(x.muscle));
              const normVols = metrics.perMuscle.filter(x => !weakSet.has(x.muscle));
              const weakAvg = weakVols.length ? Math.round(weakVols.reduce((s,x)=>s+x.totalSets,0)/weakVols.length) : 0;
              const normAvg = normVols.length ? Math.round(normVols.reduce((s,x)=>s+x.totalSets,0)/normVols.length) : 0;
              return <>
                {metrics.perMuscle.map(mm => {
                  const over = mm.totalSets > mm.mrv;
                  const weak = weakSet.has(mm.muscle);
                  return <div key={mm.muscle} style={{ display:'grid', gridTemplateColumns:'1.4fr 0.5fr 0.5fr 0.5fr 0.5fr', gap:2, fontSize:11, color:'rgba(255,255,255,0.85)', padding:'3px 0', borderTop:'1px solid rgba(255,255,255,0.04)', minWidth:340, background: weak?'rgba(236,72,153,0.08)':'transparent' }}>
                    <span style={{ fontWeight:600, color: weak?'#ec4899':undefined }}>{weak?'🔥 ':''}{mm.muscle}{over?' ⚠':''}</span>
                    <span style={{ color:over?'#ef4444':(weak?'#ec4899':ACCENT), fontWeight:700 }}>{mm.totalSets}</span>
                    <span style={{ color:'#ef4444' }}>{mm.тяжSets}</span>
                    <span style={{ color:'#60a5fa' }}>{mm.пампSets}</span>
                    <span style={{ color:'rgba(255,255,255,0.5)' }}>{mm.mrv}</span>
                  </div>;
                })}
                {weakVols.length > 0 && <div style={{ marginTop:8, padding:'6px 10px', borderRadius:10, background:'rgba(236,72,153,0.1)', border:'1px solid rgba(236,72,153,0.25)', fontSize:11, fontWeight:700, color:'#ec4899' }}>
                  🔥 Отстающие получают акцент: {weakAvg} сетов/нед против {normAvg} у остальных{normAvg>0 && weakAvg>normAvg?` (+${Math.round((weakAvg/normAvg-1)*100)}%)`:''}
                </div>}
              </>;
            })()}
          </div>
        </MetricCard>
        {/* Phase distribution */}
        <div style={{ ...CARD, background:'rgba(168,85,247,0.06)', border:'1px solid rgba(168,85,247,0.15)' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#a855f7', marginBottom:6 }}>📅 Распределение фаз</div>
          {(['accumulation','intensification','deload','peaking'] as BBPhase[]).map(ph => {
            const count = phases.filter(p => p.phase === ph).length;
            if (count === 0) return null;
            const pct = (count / bbWeeks * 100).toFixed(0);
            return <div key={ph} style={{ marginBottom:4 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:2 }}>
                <span style={{ color:PHASE_COLORS[ph], fontWeight:600 }}>{PHASE_LABELS[ph]}</span>
                <span style={{ color:'rgba(255,255,255,0.5)' }}>{count} нед ({pct}%)</span>
              </div>
              <div style={{ height:4, borderRadius:2, background:'rgba(255,255,255,0.06)' }}>
                <div style={{ height:'100%', width: pct + '%', borderRadius:2, background: PHASE_COLORS[ph], opacity:0.7 }} />
              </div>
            </div>;
          })}
        </div>
        {/* Прогрессия весов по неделям (основные упражнения) */}
        {(() => {
          const primaryExs = new Map<string, { name: string; muscle: string; weights: number[] }>();
          for (const w of W) {
            for (const s of w.sessions) {
              for (const e of s.exercises) {
                if (e.role !== 'primary') continue;
                const key = e.name;
                if (!primaryExs.has(key)) primaryExs.set(key, { name: e.name, muscle: e.muscle, weights: new Array(W.length).fill(0) });
                const rec = primaryExs.get(key)!;
                rec.weights[w.week - 1] = e.workSets[0]?.weight || 0;
              }
            }
          }
          if (primaryExs.size === 0) return null;
          const top = [...primaryExs.values()].filter(e => e.weights.some(w => w > 0)).slice(0, 6);
          if (top.length === 0) return null;
          return (
            <div style={{ ...CARD, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.15)' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b', marginBottom:6 }}>📈 Прогрессия весов (кг) по неделям</div>
              <div style={{ overflowX:'auto' }}>
                <div style={{ display:'grid', gridTemplateColumns:'1.2fr ' + '0.45fr '.repeat(Math.min(8, bbWeeks)), gap:2, fontSize:10, minWidth:Math.min(8,bbWeeks)*40+120 }}>
                  <span style={{ fontWeight:700, color:'rgba(255,255,255,0.5)' }}>Упражнение</span>
                  {Array.from({ length: Math.min(8, bbWeeks) }, (_, i) => (
                    <span key={i} style={{ fontWeight:700, color:'rgba(255,255,255,0.4)', textAlign:'center' }}>{i+1}</span>
                  ))}
                </div>
                {top.map(ex => {
                  const weights = ex.weights.slice(0, 8);
                  const first = weights.find(w => w > 0) || 0;
                  const last = weights.filter(w => w > 0).pop() || first;
                  const delta = last > first ? '+' + (last - first) : '';
                  return (
                    <div key={ex.name} style={{ display:'grid', gridTemplateColumns:'1.2fr ' + '0.45fr '.repeat(Math.min(8, bbWeeks)), gap:2, fontSize:10, padding:'2px 0', borderTop:'1px solid rgba(255,255,255,0.04)', alignItems:'center' }}>
                      <span style={{ fontWeight:600, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={ex.name}>{ex.name.substring(0, 18)}</span>
                      {weights.map((w, wi) => {
                        const prev = wi > 0 ? weights[wi-1] : 0;
                        const up = prev > 0 && w > prev;
                        const down = prev > 0 && w < prev;
                        return (
                          <span key={wi} style={{
                            textAlign:'center', fontWeight: w > 0 ? 700 : 400,
                            color: w > 0 ? (up ? '#22c55e' : down ? '#ef4444' : '#f59e0b') : 'rgba(255,255,255,0.2)',
                          }}>{w > 0 ? w : '—'}</span>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop:4, fontSize:10, color:'rgba(255,255,255,0.4)', display:'flex', gap:12 }}>
                <span>🟢 +вес</span><span>🟡 стабильно</span><span>🔴 −вес (разгрузка)</span>
              </div>
            </div>
          );
        })()}
        {/* 3D evolution chart */}
        <div style={{ ...CARD, background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.15)' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#60a5fa', marginBottom:6 }}>📈 3D эволюция объёма/интенсивности/частоты</div>
          {(() => {
            const wkStats = W.map(w => {
              const ph = phaseForWeek(w.week, bbWeeks);
              const exs = w.sessions.flatMap(s => s.exercises);
              const sets = exs.reduce((s, e) => s + e.sets, 0);
              const rir = sets > 0 ? exs.reduce((s, e) => s + e.rir * e.sets, 0) / sets : 0;
              const totalWeight = exs.reduce((s, e) => s + (e.workSets[0]?.weight || 0) * e.sets, 0);
              const avgWeight = sets > 0 ? totalWeight / sets : 0;
              return { week: w.week, phase: ph, sets, rir, avgWeight };
            });
            // Aggregate into 4-week blocks for >16 weeks
            const useAgg = W.length > 16;
            const chartData = useAgg ? (() => {
              const blocks: typeof wkStats = [];
              for (let i = 0; i < wkStats.length; i += 4) {
                const chunk = wkStats.slice(i, i + 4);
                blocks.push({
                  week: chunk[0].week + '-' + chunk[chunk.length - 1].week,
                  phase: chunk[Math.floor(chunk.length / 2)].phase,
                  sets: Math.round(chunk.reduce((s, x) => s + x.sets, 0) / chunk.length),
                  rir: chunk.reduce((s, x) => s + x.rir, 0) / chunk.length,
                  avgWeight: chunk.reduce((s, x) => s + x.avgWeight, 0) / chunk.length,
                } as any);
              }
              return blocks;
            })() : wkStats;
            const maxSets = Math.max(1, ...chartData.map((x: any) => x.sets));
            const maxWt = Math.max(1, ...chartData.map((x: any) => x.avgWeight));
            const labelField = useAgg ? 'week' : 'week';
            return (
              <div>
                {useAgg && <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginBottom:4 }}>Агрегировано по 4-нед блокам (средние)</div>}
                <svg width="100%" viewBox="0 0 320 90" style={{ maxWidth:360, margin:'0 auto', display:'block' }}>
                  {(chartData as any[]).map((x: any, i: number) => {
                    const px2 = 16 + (i / Math.max(1, chartData.length - 1)) * 290;
                    const barH = (x.sets / maxSets) * 36;
                    return <rect key={'b' + String(x.week)} x={px2 - 6} y={82 - barH} width={12} height={barH} rx={2} fill={PHASE_COLORS[x.phase as BBPhase]} opacity={0.5} />;
                  })}
                  {(chartData as any[]).map((x: any, i: number) => {
                    const px2 = 16 + (i / Math.max(1, chartData.length - 1)) * 290;
                    const wtPct = x.avgWeight / maxWt;
                    return <rect key={'w' + String(x.week)} x={px2 - 4} y={82 - wtPct * 36} width={8} height={wtPct * 36} rx={2} fill={PHASE_COLORS[x.phase as BBPhase]} opacity={0.9} />;
                  })}
                  <line x1={10} y1={82} x2={310} y2={82} stroke="rgba(255,255,255,0.1)" strokeWidth={0.5} />
                  {(chartData as any[]).filter((x: any, i: number) => i % 2 === 0 || i === chartData.length - 1).map((x: any) => {
                    const idx = (chartData as any[]).indexOf(x);
                    const px2 = 16 + (idx / Math.max(1, chartData.length - 1)) * 290;
                    return <text key={'l' + String(x.week)} x={px2} y={95} fontSize={7} fill="rgba(255,255,255,0.3)" textAnchor="middle">{x.week}</text>;
                  })}
                </svg>
                <div style={{ display:'flex', gap:12, justifyContent:'center', marginTop:4, flexWrap:'wrap' }}>
                  <span style={{ fontSize:11, color:'rgba(255,255,255,0.5)' }}>▮ Сеты/нед</span>
                  <span style={{ fontSize:11, color:'rgba(255,255,255,0.7)' }}>▮ Средний вес</span>
                  {(['accumulation','intensification','deload','peaking'] as BBPhase[]).map(ph => {
                    const c = wkStats.filter(x => x.phase === ph).length;
                    if (c === 0) return null;
                    return <span key={ph} style={{ fontSize:11, color:PHASE_COLORS[ph] }}>● {PHASE_LABELS[ph]}</span>;
                  })}
                </div>
              </div>
            );
          })()}
        </div>
        {/* Garbage volume detection */}
        {(() => {
          const garbage = detectGarbageVolume(builtPlan.weeks, weakPoints);
          if (garbage.length === 0) return null;
          return (
            <div style={{ ...CARD, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.15)' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:6 }}>🗑 Мусорный объём ({garbage.length})</div>
              {garbage.slice(0, 5).map((g, i) => <div key={i} style={{ fontSize:11, color:'rgba(255,255,255,0.7)', marginBottom:3, padding:'3px 6px', borderRadius:4, background:'rgba(239,68,68,0.04)' }}>
                • {g.exerciseName} ({g.muscle}): {g.reason}
              </div>)}
              {garbage.length > 5 && <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)' }}>...и ещё {garbage.length - 5}</div>}
            </div>
          );
        })()}
        {/* Exercise mix by phase */}
        {(() => {
          const mixPhase = phaseForWeek(W[0]?.week || 1, bbWeeks);
          const mix = phaseExerciseMix(mixPhase);
          return (
            <div style={{ ...CARD, background:'rgba(168,85,247,0.06)', border:'1px solid rgba(168,85,247,0.15)' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#a855f7', marginBottom:6 }}>🎯 Распределение упражнений ({PHASE_LABELS[mixPhase]})</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, fontSize:11 }}>
                <div>Базовые: <b style={{ color:'#fff' }}>{(mix.compoundPct * 100).toFixed(0)}%</b></div>
                <div>Изоляция: <b style={{ color:'#fff' }}>{(mix.isolationPct * 100).toFixed(0)}%</b></div>
                <div>Машины: <b style={{ color:'#fff' }}>{(mix.machinePct * 100).toFixed(0)}%</b></div>
                <div>Кабели: <b style={{ color:'#fff' }}>{(mix.cablePct * 100).toFixed(0)}%</b></div>
              </div>
            </div>
          );
        })()}
        {/* Per-muscle chip table */}
        {quality.perMuscle && quality.perMuscle.length > 0 && (
          <div style={{ ...CARD, background:'rgba(34,197,94,0.04)', border:'1px solid rgba(34,197,94,0.1)' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#22c55e', marginBottom:6 }}>🏋️ Мышцы · сеты · MEV · MAV · MRV · %</div>
            <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
              {quality.perMuscle.map(pm => {
                const color = pm.status === 'exceeding_mrv' ? '#ef4444' : pm.status === 'below_mev' ? '#f59e0b' : '#22c55e';
                return (
                  <div key={pm.muscle} style={{ padding:'4px 8px', borderRadius:8, background:color+'10', border:'1px solid '+color+'30', fontSize:11, display:'flex', alignItems:'center', gap:4 }}>
                    <span style={{ fontWeight:700, color:'#fff' }}>{pm.muscle}</span>
                    <span style={{ fontWeight:700, color }}>{pm.sets}</span>
                    <span style={{ color:'rgba(255,255,255,0.35)' }}>· {pm.mev} · {pm.mav} · {pm.mrv} · {pm.pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {/* Recommendations */}
        {quality.recommendations && quality.recommendations.length > 0 && (
          <div style={{ ...CARD, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.15)' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b', marginBottom:6 }}>💡 Рекомендации</div>
            {quality.recommendations.map((r, i) => (
              <div key={i} style={{ fontSize:11, color:'rgba(255,255,255,0.8)', marginBottom:3, paddingLeft:4, borderLeft:'2px solid #f59e0b' }}>{r}</div>
            ))}
          </div>
        )}
        {/* Details */}
        <div style={{ ...CARD }}>
          <div style={{ fontSize:11, fontWeight:700, color:ACCENT, marginBottom:6 }}>🔍 Детали оценки</div>
          {quality.details.map((d,i) => <div key={i} style={{ ...SMALL, marginBottom:3, padding:'4px 8px', borderRadius:8, background:'rgba(255,255,255,0.03)' }}>{d}</div>)}
        </div>
        {/* Volume chart */}
        {(() => {
          const vdata: WeekVolume[] = W.map(w => {
            const muscles: Record<string, number> = {};
            w.sessions.forEach(s => s.exercises.forEach(e => { const m = e.muscle || 'other'; muscles[m] = (muscles[m] || 0) + e.sets; }));
            return { week: w.week, totalSets: Object.values(muscles).reduce((a, b) => a + b, 0), muscles };
          });
          if (vdata.length < 2) return null;
          return (
            <div style={{ ...CARD }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#60a5fa', marginBottom:6 }}>📊 Объём по неделям (сетов)</div>
              <VolumeByWeekChart data={vdata} />
            </div>
          );
        })()}
        {/* RIR drift chart */}
        {(() => {
          const rdata: RirRecord[] = [];
          W.forEach(w => w.sessions.forEach(s => s.exercises.forEach(e => rdata.push({ week: w.week, exercise: e.name || e.muscle || '', rir: e.rir || 0 }))));
          if (rdata.length < 2) return null;
          return (
            <div style={{ ...CARD, marginTop:8 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#a855f7', marginBottom:6 }}>📉 RIR-drift по неделям</div>
              <RirDriftChart data={rdata} />
            </div>
          );
        })()}
        {/* Load assessment */}
        <div style={{ ...CARD, background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.15)' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#60a5fa', marginBottom:6 }}>📈 Оценка тренировочной нагрузки</div>
          {!ratio ? <div style={SMALL}>Недостаточно данных sRPE для расчёта ACWR. Ведите дневник тренировок.</div> : (
            <div>
              <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                <span style={SMALL}>ACWR: <b style={{ color:ratio.ratio>1.5?'#ef4444':ratio.ratio>1.3?'#eab308':'#22c55e', fontSize:14 }}>{ratio.ratio.toFixed(2)}</b></span>
                <span style={{ padding:'3px 8px', borderRadius:8, fontSize:11, fontWeight:700, background:ratio.zone==='dangerous'?'rgba(239,68,68,0.15)':ratio.zone==='caution'?'rgba(234,179,8,0.15)':'rgba(34,197,94,0.15)', color:ratio.zone==='dangerous'?'#ef4444':ratio.zone==='caution'?'#eab308':'#22c55e' }}>{ratio.zone === 'dangerous' ? '⛔ Опасно' : ratio.zone === 'caution' ? '⚠ Осторожно' : ratio.zone === 'optimal' ? '✅ Оптимум' : '⬇ Недотрен'}</span>
              </div>
              <div style={{ marginTop:6, ...SMALL }}>Хроническая нагрузка (28д) vs острая (7д). Цель: 0.8-1.3. Разгрузка при {`>`}1.5.</div>
            </div>
          )}
        </div>
        <MesocycleProgressionCard weeks={W.length} startVolumeSets={Math.round(W.reduce((s,w)=>s+w.sessions.reduce((ss,sess)=>ss+sess.exercises.reduce((sss,e)=>sss+e.sets,0),0),0)/W.length)} startIntensityPct={0.7} startRIR={2} goal="hypertrophy" title="Прогрессия мезоцикла (ББ)" />
        <div style={{ ...CARD, marginTop:8, background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.15)' }}>
          <div style={{ ...SMALL, whiteSpace:'pre-wrap' }}>{explainBBMetrics(metrics)}</div>
        </div>
        {/* Export plan card */}
        {quality && (
          <div style={{ marginTop:8 }}>
            <PlanExportCard
              bbPlan={builtPlan}
              profile={{
                level: bbLevel,
                goal: bbGoal,
                daysPerWeek: bbDays,
                bodyWeight: prof.bodyWeight,
                pmSquat: prof.pmSquat,
                pmBench: prof.pmBench,
                pmDead: prof.pmDead,
                weakPoints,
                onCourse: peds.length > 0,
              }}
              level={bbLevel}
              weakPoints={weakPoints}
              hasDeload={autoDeload}
              meta={{ splitName: builtPlan.pattern.name, weeks: bbWeeks, corrections: builtPlan.rationale }}
            />
          </div>
        )}

        {/* What-if прогноз (раскрывающаяся секция) */}
        <ExpandableCard title="🔮 What-if прогноз (что если изменить параметры)" icon="🔮"
          short="Δ калории / Δ сон / AAS множитель → прогноз риска и готовности"
          full={
            <WhatIfCard baseRisk={quality?.score ? 100 - quality.score : 20} baseReadiness={Math.round((linked.readiness?.recovery ?? 80))} />
          }
        />

        <div style={{ display:'flex', gap:8, marginTop:10 }}>
          <button style={{ ...BTN, flex:1 }} onClick={() => setStep('adjust')}>Далее: ручная коррекция →</button>
          <button style={BTN_GHOST} onClick={() => setStep('plan')}>← Назад</button>
        </div>
      </div>
    );
  };

  const renderAdjust = () => {
    if (!builtPlan || !metrics) return null;
    const W = builtPlan.weeks;
    const wk = W[Math.min(bbWeekSel, W.length) - 1] || W[0];
    const currentPhase = phaseForWeek(wk.week, bbWeeks);
    return (
      <div>
        <div style={H}>🛠 Шаг 6: Ручная коррекция</div>
        {(() => {
          const fb = getPlanFeedback();
          return fb.reasons.length > 0 && fb.avgRpe > 0 ? (
            <div style={{ ...CARD, marginBottom:10, background:'rgba(139,92,246,0.06)', border:'1px solid rgba(139,92,246,0.2)' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#a78bfa', marginBottom:6 }}>📊 Фидбэк план→выполнение</div>
              {fb.deloadRecommended && <div style={{ padding:'4px 8px', borderRadius:8, background:'rgba(239,68,68,0.12)', color:'#ef4444', fontSize:11, fontWeight:700, marginBottom:6 }}>⛔ РЕКОМЕНДОВАНА РАЗГРУЗКА</div>}
              {fb.reasons.map((r,i) => <div key={i} style={{ fontSize:11, color:'rgba(255,255,255,0.7)', marginBottom:3, padding:'3px 0' }}>{r}</div>)}
              <div style={{ display:'flex', gap:8, marginTop:6 }}>
                {fb.weightMultiplier !== 1 && <span style={{ padding:'2px 6px', borderRadius:4, fontSize:11, background:'rgba(96,165,250,0.1)', color:'#60a5fa' }}>Вес ×{fb.weightMultiplier}</span>}
                {fb.rirShift !== 0 && <span style={{ padding:'2px 6px', borderRadius:4, fontSize:11, background:'rgba(245,158,11,0.1)', color:'#f59e0b' }}>RIR {fb.rirShift > 0 ? '+':''}{fb.rirShift}</span>}
                {fb.volumeMultiplier !== 1 && <span style={{ padding:'2px 6px', borderRadius:4, fontSize:11, background:'rgba(34,197,94,0.1)', color:'#22c55e' }}>Объём ×{fb.volumeMultiplier}</span>}
              </div>
            </div>
          ) : null;
        })()}
        <div style={{ ...CARD, background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.15)', marginBottom:10 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#60a5fa', marginBottom:6 }}>🔧 Инструменты коррекции</div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            <button style={BTN_GHOST} onClick={() => adjustVolume(0.8)}>📦 Объём -20%</button>
            <button style={BTN_GHOST} onClick={() => adjustVolume(1.1)}>📦 Объём +10%</button>
            <button style={BTN_GHOST} onClick={() => adjustWeight(1.05)}>⚖ Вес +5%</button>
            <button style={BTN_GHOST} onClick={() => adjustWeight(0.95)}>⚖ Вес -5%</button>
            <button style={BTN_GHOST} onClick={() => { setExerciseEdits({}); setStep('split'); }}>🔄 Перестроить план</button>
            <button style={BTN_GHOST} onClick={handleSavePlan}>💾 Сохранить план</button>
            <button style={{ ...BTN_GHOST, borderColor:'#60a5fa', color:'#60a5fa' }} onClick={handleSaveToMyPlans}>💾 В Мои тренировки</button>
            <button style={{ ...BTN_GHOST, borderColor:'#22c55e', color:'#22c55e' }} onClick={handleSaveVariant}>💾 Вариант ({savedPlans.length})</button>
            <button style={{ ...BTN_GHOST, borderColor:'#f59e0b', color:'#f59e0b' }} onClick={() => setShowCompare(s => !s)}>⚖ Сравнить</button>
            <button style={{ ...BTN_GHOST, borderColor:'#a855f7', color:'#a855f7' }} onClick={handleSendToExecution}>▶ К выполнению</button>
          </div>

          {/* Мульти-планы: сравнение вариантов */}
          {showCompare && savedPlans.length > 0 && (
            <div style={{ marginTop:10, padding:12, borderRadius:12, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.15)' }}>
              <div style={{ fontSize:12, fontWeight:800, color:'#f59e0b', marginBottom:8 }}>⚖ Сравнение вариантов ({savedPlans.length})</div>
              <div style={{ overflowX:'auto', scrollbarWidth:'none' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:10, minWidth:500 }}>
                  <thead>
                    <tr style={{ color:'rgba(255,255,255,0.5)', textAlign:'left' }}>
                      <th style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.1)' }}>Вариант</th>
                      <th style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.1)', textAlign:'center' }}>Сеты</th>
                      <th style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.1)', textAlign:'center' }}>RIR</th>
                      <th style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.1)', textAlign:'center' }}>Дней</th>
                      <th style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.1)', textAlign:'center' }}>Групп</th>
                      <th style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.1)', textAlign:'center' }}>PED MRV</th>
                      <th style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.1)', textAlign:'center' }}>Кач-во</th>
                      <th style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.1)' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {savedPlans.map(v => (
                      <tr key={v.id} style={{ color:'rgba(255,255,255,0.8)' }}>
                        <td style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.05)', fontWeight:600 }}>{v.name}</td>
                        <td style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.05)', textAlign:'center' }}>{v.metrics.totalSets}</td>
                        <td style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.05)', textAlign:'center' }}>{v.metrics.avgRir.toFixed(1)}</td>
                        <td style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.05)', textAlign:'center' }}>{v.metrics.sessionsPerWeek}</td>
                        <td style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.05)', textAlign:'center' }}>{v.metrics.muscleCount}</td>
                        <td style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.05)', textAlign:'center' }}>×{v.metrics.mrvMult.toFixed(2)}</td>
                        <td style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.05)', textAlign:'center' }}>
                          <span style={{ color: v.metrics.qualityScore >= 75 ? '#22c55e' : v.metrics.qualityScore >= 50 ? '#f59e0b' : '#ef4444', fontWeight:700 }}>{v.metrics.qualityScore}</span>
                        </td>
                        <td style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.05)', display:'flex', gap:4 }}>
                          <button onClick={() => handleLoadVariant(v)} style={{ padding:'3px 8px', borderRadius:6, border:'1px solid rgba(0,230,138,0.3)', background:'rgba(0,230,138,0.08)', color:'#00e68a', cursor:'pointer', fontSize:9, fontWeight:700 }}>↩</button>
                          <button onClick={() => handleDeleteVariant(v.id)} style={{ padding:'3px 8px', borderRadius:6, border:'1px solid rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.08)', color:'#ef4444', cursor:'pointer', fontSize:9, fontWeight:700 }}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop:6, fontSize:10, color:'rgba(255,255,255,0.4)' }}>↩ — загрузить вариант · ✕ — удалить · максимум 8 вариантов</div>
            </div>
          )}
        </div>
        {/* Per-exercise editing zone */}
        <div style={{ marginTop:10 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <span style={{ fontSize:11, fontWeight:700, color:'#fff' }}>Редактор упражнений (неделя {bbWeekSel})</span>
            <div style={{ display:'flex', gap:4 }}>
              {W.map(w => {
                const ph = phaseForWeek(w.week, bbWeeks);
                return <button key={w.week} onClick={() => setBbWeekSel(w.week)} style={{ padding:'3px 8px', borderRadius:8, fontSize:11, cursor:'pointer', border:w.week===bbWeekSel?'1px solid ' + PHASE_COLORS[ph]:'1px solid rgba(255,255,255,0.08)', background:w.week===bbWeekSel?PHASE_COLORS[ph]+'20':'transparent', color:w.week===bbWeekSel?PHASE_COLORS[ph]:'rgba(255,255,255,0.6)' }}>{w.week}</button>;
              })}
            </div>
          </div>
          {wk.sessions.map((s, si) => (
            <ExpandableCard key={si} title={'День ' + (si+1) + ' · ' + s.character + ' (' + s.exercises.length + ' упр.)'} icon="🏋️" short={s.exercises.map(e => e.name).join(', ')} full={
              <div>
                {s.exercises.map((e, ei) => {
                  const editKey = `${si}-${ei}`;
                  const edit = exerciseEdits[editKey] || { sets: e.sets, reps: e.workSets[0]?.reps || 10, weight: e.workSets[0]?.weight || 80 };
                  const catEx = EXERCISE_CATALOG.find(x => x.name === e.name);
                  const altExercises = getExercisesByGroup(e.muscle).filter(x => x.name !== e.name).slice(0, 5);
                  return <div key={ei} style={{ marginBottom:8, padding:'8px 10px', borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontWeight:700, fontSize:11, color:'#fff', marginBottom:4 }}>{ei+1}. {e.name} <span style={{ fontWeight:400, fontSize:11, color:'rgba(255,255,255,0.4)' }}>({e.muscle})</span></div>
                    <div style={{ display:'flex', gap:8, marginBottom:6, flexWrap:'wrap', alignItems:'center' }}>
                      <div><span style={{ ...SMALL, fontSize:11 }}>Сеты</span><input type="number" value={edit.sets} min={0} max={20} onChange={e2 => setExerciseEdits(p => ({ ...p, [editKey]: { ...edit, sets: parseInt(e2.target.value) || 0 } }))} style={{ width:45, background:'#18181b', color:'#fff', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, padding:'4px 8px', fontSize:11 }} /></div>
                      <div><span style={{ ...SMALL, fontSize:11 }}>Повт</span><input type="number" value={edit.reps} min={1} max={30} onChange={e2 => setExerciseEdits(p => ({ ...p, [editKey]: { ...edit, reps: parseInt(e2.target.value) || 1 } }))} style={{ width:45, ...IN }} /></div>
                      <div><span style={{ ...SMALL, fontSize:11 }}>Вес, кг</span><input type="number" value={edit.weight} min={0} max={500} onChange={e2 => setExerciseEdits(p => ({ ...p, [editKey]: { ...edit, weight: parseInt(e2.target.value) || 0 } }))} style={{ width:55, ...IN }} /></div>
                      <div><span style={{ ...SMALL, fontSize:11 }}>RIR</span><span style={{ fontSize:11, fontWeight:700, color:'#f59e0b', marginLeft:4 }}>{e.rir}</span></div>
                      <button onClick={() => setExSwapModal({ si, ei, muscle: e.muscle, currentName: e.name })} style={{ padding:'3px 8px', borderRadius:8, fontSize:11, cursor:'pointer', border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.03)', color:'rgba(255,255,255,0.7)' }}>🔄 Заменить</button>
                      <button onClick={() => handleMoveExercise(si, ei, -1)} disabled={ei === 0} style={{ padding:'3px 8px', borderRadius:8, fontSize:11, cursor:ei===0?'default':'pointer', border:'1px solid rgba(96,165,250,0.2)', background:ei===0?'transparent':'rgba(96,165,250,0.06)', color:ei===0?'rgba(255,255,255,0.2)':'#60a5fa' }}>↑</button>
                      <button onClick={() => handleMoveExercise(si, ei, 1)} disabled={ei === s.exercises.length - 1} style={{ padding:'3px 8px', borderRadius:8, fontSize:11, cursor:ei===s.exercises.length-1?'default':'pointer', border:'1px solid rgba(96,165,250,0.2)', background:ei===s.exercises.length-1?'transparent':'rgba(96,165,250,0.06)', color:ei===s.exercises.length-1?'rgba(255,255,255,0.2)':'#60a5fa' }}>↓</button>
                    </div>
                    {altExercises.length > 0 && <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)' }}>Альтернативы: {altExercises.map(x => x.name).join(', ')}</div>}
                    <div style={{ marginTop:4, padding:'3px 6px', borderRadius:4, background:'rgba(0,230,138,0.04)', fontSize:11, color:'rgba(255,255,255,0.6)' }}>💡 {exerciseComment(e, weakPoints, bbFocus, currentPhase)}</div>
                  </div>;
                })}
              </div>
            } />
          ))}
        </div>
      </div>
    );
  };

  // ── Exercise swap modal ──
  const renderExSwapModal = () => {
    if (!exSwapModal || !builtPlan) return null;
    const filtered = EXERCISE_CATALOG
      .filter(e => (e.group || '') === exSwapModal.muscle)
      .filter(e => e.name.toLowerCase().includes(exSwapSearch.toLowerCase()));
    return (
      <div style={{ position:'fixed', inset:0, zIndex:250, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.85)' }}
        onClick={() => { setExSwapModal(null); setExSwapSearch(''); }}>
        <div onClick={e => e.stopPropagation()} style={{ width:'88%', maxWidth:400, maxHeight:'78vh', borderRadius:16, background:'#18181b', border:'1px solid rgba(255,255,255,0.1)', overflow:'hidden' }}>
          <div style={{ height:3, background:'linear-gradient(90deg,#00e68a,#00c853)' }} />
          <div style={{ padding:'14px 16px', maxHeight:'calc(78vh - 3px)', overflowY:'auto' }}>
            <div style={{ fontSize:14, fontWeight:700, color:'#00e68a', marginBottom:10 }}>🔄 Замена: {exSwapModal.currentName}</div>
            <input type="text" placeholder="Поиск упражнений..." value={exSwapSearch} autoFocus
              onChange={e => setExSwapSearch(e.target.value)}
              style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(0,0,0,0.3)', color:'#fff', fontSize:13, boxSizing:'border-box', marginBottom:10 }} />
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {filtered.slice(0, 30).map(ex => {
                const isCurrent = ex.name === exSwapModal.currentName;
                return <button key={ex.id} disabled={isCurrent} onClick={() => { handleReplaceExercise(exSwapModal.si, exSwapModal.ei, ex.name); setExSwapModal(null); setExSwapSearch(''); }}
                  style={{ display:'block', width:'100%', padding:'8px 10px', borderRadius:10, cursor:isCurrent?'default':'pointer', textAlign:'left', fontSize:11, fontWeight:isCurrent?400:500, background:isCurrent?'rgba(255,255,255,0.02)':'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', color:isCurrent?'rgba(255,255,255,0.3)':'rgba(255,255,255,0.85)', opacity:isCurrent?0.5:1 }}>
                  <div style={{ display:'flex', justifyContent:'space-between' }}>
                    <span>{ex.name}</span>
                    <span style={{ fontSize:11, color:'rgba(255,255,255,0.35)' }}>{ex.type} · {ex.equipment}</span>
                  </div>
                  {isCurrent && <div style={{ fontSize:11, color:'#00e68a', marginTop:2 }}>✓ текущее</div>}
                </button>;
              })}
              {filtered.length === 0 && <div style={{ padding:12, textAlign:'center', fontSize:11, color:'rgba(255,255,255,0.4)' }}>Ничего не найдено</div>}
            </div>
            <button onClick={() => { setExSwapModal(null); setExSwapSearch(''); }} style={{ width:'100%', marginTop:10, padding:'10px', borderRadius:10, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'rgba(255,255,255,0.6)', fontWeight:700, fontSize:12, cursor:'pointer' }}>Закрыть</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
        <div style={{ flex:1 }}>{renderStepNav()}</div>
        <button
          onClick={() => setShowTools(true)}
          title="Библиотека инструментов"
          style={{ padding:'9px 12px', borderRadius:12, fontSize:16, cursor:'pointer', border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.8)', minWidth:38, minHeight:38, flexShrink:0 }}
        >⚙️</button>
      </div>
      {showTools && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:60, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={() => setShowTools(false)}>
          <div style={{ width:'100%', maxWidth:560, maxHeight:'85vh', overflowY:'auto', padding:16, borderRadius:16, background:'rgba(24,24,27,0.97)', border:'1px solid rgba(255,255,255,0.1)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <div style={{ fontSize:14, fontWeight:800, color:'#00e68a' }}>📚 Библиотека инструментов</div>
              <button onClick={() => setShowTools(false)} style={{ padding:'4px 10px', borderRadius:8, fontSize:12, cursor:'pointer', border:'none', background:'rgba(255,255,255,0.1)', color:'var(--text-dim)' }}>✕</button>
            </div>
            <PlannerToolsPanel mode="bb" />
          </div>
        </div>
      )}
      {step === 'params' && renderParams()}
      {step === 'ped' && renderPedWorkMax()}
      {step === 'split' && renderSplit()}
      {step === 'plan' && renderPlanWithComments()}
      {step === 'quality' && renderQuality()}
      {step === 'adjust' && renderAdjust()}
      {renderExSwapModal()}
      {subTarget && (() => {
        const wk = builtPlan?.weeks[bbWeekSel - 1];
        const ses = wk?.sessions[subTarget.sessionIdx];
        const ex = ses?.exercises[subTarget.exIdx];
        return ex ? (
          <SubstitutionPopup
            exerciseName={ex.name}
            group={ex.muscle || ''}
            onSelect={applyBbSubstitution}
            onClose={() => setSubTarget(null)}
          />
        ) : null;
      })()}
    </div>
  );
};