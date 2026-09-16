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
import { EXERCISE_CATALOG, getExercisesByGroup, getExerciseById } from '../../../core/exercise-catalog';
import { SubstitutionPopup } from './SubstitutionPopup';
import { SPLIT_PATTERNS } from '../../../engines/bb/bb-split-patterns';
import { rankBBSplits, type BBRankedPattern } from '../../../engines/bb/bb-selector.engine';
import { buildBBPlan, applyMacrocycleToBBPlan, type BBPlan, type BBExercise } from '../../../engines/bb/bb-builder.engine';
import { collectPlanExercises, autoCalibrateFromStored, type PlanWeightEntry } from '../../../engines/bb/bb-weight-calibration.engine';
import type { DUPMode } from '../../../engines/bb/bb-dup.engine';
import { applyDUPOverlay, recommendDUPMode } from '../../../engines/bb/bb-dup.engine';
import { applyExecutionCorrections, type ExecutionCorrection } from '../../../engines/bb/bb-execution-corrections.engine';
import { validateBBPlan, generateActionableRecommendations } from '../../../engines/bb/bb-validator.engine';
import { isPackingActive } from '../../../engines/bb/bb-packing.engine';
import { finalizeBBPlan } from '../../../engines/bb/bb-finalize.engine';
import { exerciseFeatureBadges, techniqueChainParts } from './bb-technique-display';
import { calcBBPlanMetrics, type BBPlanMetrics } from '../../../engines/bb/bb-metrics.engine';
import { buildBBMethodologySummary, buildBBPlanReportText } from '../../../engines/bb/bb-report.engine';
import { averageWeeklyScores, scoreVolumeWeek, scoreProWeek, gradeFor } from '../../../engines/bb/bb-quality-weekly.engine';
import { computeRegimeMrvMult, sessionLimitsFor, aggregateBBVolume } from '../../../engines/bb/bb-volume.engine';
import { MUSCLE_LABEL_RU } from '../../../engines/volume-landmarks.engine';
import { buildMEVCalibration, recordMEVCalibrationWeek, resolveMEVAfterCalibration, isMEVCalibrationComplete, mevCalibrationProgress, saveMEVCalibration, loadMEVCalibration, clearMEVCalibration, mevSignalDegradation, type MEVCalibration, type MEVSignal } from '../../../engines/bb/bb-mev-calibration.engine';
import { adaptForPEDs, type PED, type PEDAdaptation } from '../../../engines/bb/bb-ped-adaptation.engine';
import { suggestMethodologyForStack } from '../../../engines/bb/bb-ped-methodology.engine';
import { getAllVolumeLandmarks } from '../../../engines/volume-landmarks.engine';
import { canonicalMuscle, expandDonorMuscles, isSpecializationTargetConflict as isRegionConflict, normalizeSpecializationTargets } from '../../../engines/bb/bb-specialization.engine';
import { loadSRPESessions } from '../../../engines/pro/srpe-store';
import { loadSessions } from '../../../engines/workout-logger.engine';
import { acuteChronicRatio, toDailyLoads } from '../../../engines/pro/training-load.engine';
import { autoRegulate, shouldTrainToday } from '../../../engines/pro/autoregulation-pro.engine';
import { bbOrthoMobilityAdd, riskyOpenChainIds, decideBbOrthoIntake, subtractTracked } from '../../../engines/pro/ortho-screen.engine';
import { loadTrainingProfile, saveTrainingProfile, type TrainingProfile } from './training-profile';
import { subscribePlannerApply, applyToPlanner, type WeakpointsPayload } from './planner-bridge';
import { loadAnnualTrainingPlan } from '../../../engines/annual-training/annual-training-storage';
import type { AnnualTrainingPlan } from '../../../engines/annual-training/annual-training.types';
import { ACCENT, CARD, SMALL, BTN, BTN_GHOST, H, STEP_PILL, IN } from './training-ui';
import { MesocycleProgressionCard } from './MesocycleProgressionCard';
import { PopupNumber, PopupSelect } from '../SRCBBScreen_parts/TrainingPopups';
import type { InjurySelectEntry } from './InjurySelectCard';
import { prescribeLoad, DELOAD_PROTOCOLS, applyDeloadToWeek, rirDrift, suggestFeeders, detectGarbageVolume, type LoadStrategy, type DeloadType, DEFAULT_TECHNIQUE_BY_PHASE, type IntensityTechnique } from '../../../engines/bb/bb-autocoach.engine';
import type { SessionMethodology } from '../../../engines/bb/bb-session-order.engine';
import { PCT_FOR_RIR } from '../../../engines/rir-table';
import { labTrainingAdjust } from './lab-training-adjust';
import { getCycleById, normalizeCycleDirection, getCyclesByDirection } from '../../../data/lms-cycles/lms-cycle-index';
import { programToBBPlan, cycleTemplateToFullProgram } from '../../../engines/bb/cycle-to-plan';
import type { SRCycleTemplate } from '../../../data/lms-cycles/lms-types';
import { FULL_PROGRAM_LIBRARY } from '../../../engines/complete-program-library.engine';
import type { FullProgram } from '../../../engines/complete-program-library.engine';
import { WOMENS_PROGRAMS, CUSTOM_PROGRAMS } from './programs-data';
import { useOriginalPrograms } from './useOriginalPrograms';

import { VolumeByWeekChart, RirDriftChart, type WeekVolume, type RirRecord } from './PlanCharts';
import { getPhaseConfig } from '../../../engines/periodization';
import { PlanExportCard } from './PlanExportCard';
import { DayCard, PHASE_COLORS, PHASE_LABELS } from './PlanOutput';
import { loadSavedBBPlans, saveBBPlanVariant, deleteBBPlanVariant, type SavedBBPlan } from './bb-plans-store';
import {
  buildBBContestPrep, applyPeakWeekOverlayToBBPlan, deserializeBBPrepConfig, legacyConfigFromProfile,
  isoAddDays, isoToday, CATEGORY_PROFILES, CONTEST_CATEGORY_LABELS, CONTEST_SPECIALIZATION_LABELS,
  buildBBContestPrepPlan, applyContestPrepToBBPlan, extendBBPlanPreparation, replanBBContestPrep,
  shiftBBContestPrepShowDate, serializeBBContestPrepPlan, nutritionTargetsForPrepDate,
  prepPhaseForDate, PREP_PHASE_LABELS, PREP_PHASE_COLORS,   buildShowTimeline, configFromPlan,
  computeReadiness, spillRiskScore, isShortCycle,
  saveTestPeakWeekResult, latestTestPeakWeek, resolvePeakStrategy, planFromStored, prepWeightAdvice, recommendCarbStrategyFromTrial, liveAdjustForPeakDay,
  recommendBBTaperConfig, sRPEAdjustment,
  buildShowChecklist, loadShowChecklist, toggleShowChecklistItem,
  type BBTaperRecommendation,
  buildPostShowPlan, buildContestPrepPrintHtml, recordPrepAdjustment, buildPrepIcs, buildPrepCoachJson,
  prepTrainingCompliance, buildPrepWeeklyReportHtml, buildPrepCheckinsCsv,
  manipulationLockedFor, manipulationLockNote, trialCarbDoseGPerKg,
  TAPER_VS_DELOAD_NOTE, lastHardDayForMuscle, prepDietBreaks,
  postShowRecoveryDiet, buildPeakWeek, recarbLoadFromVisual,
  type PrepAdjustment,
  type BBContestPrepConfig, type BBContestPrepResult, type BBContestCategory, type ContestSpecialization,
  type BBContestPrepPlan, type PrepWaterMode, type PrepSodiumMode, type PrepCarbMode, type BBPlanWithPrep,
  type PrepPhaseKey, type ContestEventEntry,
  type WaterStrategy, type SodiumStrategy, type CarbLoadStrategy,
} from '../../../engines/bb/bb-contest-prep.engine';
import { CONTEST_PREP_UPDATED_EVENT, migrateLegacyContestPrepIfNeeded, storeContestPrepPlan } from '../../../engines/bb/bb-contest-prep-sync';
import type { PeakingProtocol } from '../../../engines/peaking-protocols.engine';
import { buildPrepCycle, buildPrepSeason, recommendMinimalMode, getPosingCheckins, type PrepCycleConfig, type PrepCycleResult, type PrepSeasonConfig } from '../../../engines/bb/bb-prep-cycle.engine';
import {
  PREP_SPLIT_PROFILES, type PrepMinimalMode,
} from '../../../engines/bb/bb-prep-splits';
import { optimizeMuscleFrequency, type FrequencyOptimizationResult } from '../../../engines/bb/bb-frequency-optimizer.engine';
import { calculatePlanSafetyScore, type PlanSafetyScore } from '../../../engines/bb/bb-safety-score.engine';
import { assessReadiness, calculateACWR, getAutoRegulationOverride } from '../../../engines/bb/bb-auto-regulation.engine';
import { summarizeAutoRegulation } from '../../../engines/bb/bb-progression-feedback.engine';
import { buildBBMuscleHeatmap, BB_PHASE_COLOR, BB_PHASE_LABEL_RU, buildBBPlanIcs, bbWeekDateRanges, buildBBPlanPrintHtml } from '../../../engines/bb/bb-visual.engine';
import { buildBBQualityReport } from '../../../engines/bb/bb-quality-report.engine';
import { bbPlanQualityV2 } from '../../../engines/bb/bb-quality-v2.engine';
import { PLATE_SET_PRESETS } from '../../../engines/bb/bb-plates.engine';
import { createFromBuild as createUserProgramFromBuild, saveUserProgram as saveUserProgramStore } from '../../../engines/user-program/program-store';
import { getBBSuggestions } from './bb-compat';
import { sessionTagLabel, muscleLabel, exerciseTargetNote } from './bb-labels';
import { MacrocyclePanel } from '../SRCBBScreen_parts/MacrocyclePanel';
import { CardioLinkCard } from './CardioLinkCard';
import { PlannerToolsPanel } from './PlannerToolsPanel';
import { type BBMacrocycle } from '../../../engines/lms/macrocycle.engine';

import { getProfile, updateProfile } from '../../../core/profile-manager';
import { getWeightLog } from '../../../engines/profile-store';
import {
  loadPrepWeekCheckins, savePrepWeekCheckin, prepWeekRefs, prepStrengthTrend, avgWeight7d,
  type PrepWeekCheckin,
} from '../../../engines/bb/bb-prep-weekly-log';
import {
  getPostShowLog, savePostShowEntry, removePostShowEntry, postShowRecoveryMarkers,
  postShowComedownNotes,
} from '../../../engines/bb/bb-prep-post-show-log.engine';
import { PREP_LAB_PANEL, PREP_PROCEDURES, PREP_HYDRATION_GUIDELINES } from '../../../engines/bb/bb-prep-process.engine';

/* ── Вынесенный служебный слой (этап 1 §4.3): CollapsibleCard, типы шагов/фаз,
   константы групп и чистые хелперы — в `bb-auto-constructor-shared.tsx`. ── */
import {
  CollapsibleCard, WEAK_GROUPS, PHASE_TECHNIQUES,
  backSubgroupLabel, armHeadLabel, isAbRotationActive,
  annualBlockCtxToPrepPatch, annualActiveBlockLine,
  getPhaseMap, phaseForWeek, DONOR_GROUPS, normalizeDonorTargets,
  computePhases, chipBtn, useInlineDialogA11y,
  BbRowSwitch, BbToggleChip,
  type Step, type BBPhase, type PlanMode,
} from './bb-auto-constructor-shared';
import { BbSplitStep } from './bb-step-split';
import { BbPedWorkMaxStep } from './bb-step-ped';
import { BbWeightsStep } from './bb-step-weights';
import { BbExSwapModal } from './bb-step-ex-swap';
import { BbAdjustStep } from './bb-step-adjust';
import { BbPrepCycleStep } from './bb-step-prep-cycle';
import { BbParamsStep } from './bb-step-params';
import { BbPlanStep } from './bb-step-plan';
import { BbQualityUnifiedCard } from './bb-quality-sections';
export {
  PHASE_TECHNIQUES, backSubgroupLabel, armHeadLabel, isAbRotationActive,
  annualBlockCtxToPrepPatch, annualActiveBlockLine,
};
export type { AnnualBlockCtxToPrepPatch } from './bb-auto-constructor-shared';


/* Все служебные хелперы вынесены в './bb-auto-constructor-shared' (этап 1 §4.3). */

export const BbAutoConstructor: React.FC = () => {
  const linked = useDataLink();
  const prof = useMemo(() => loadTrainingProfile(), []);
  // P0-5: лабораторная коррекция MRV (ALT/CRP/HCT/гормоны/почки → снижение объёма).
  const labAdjust = useMemo(() => labTrainingAdjust(linked.labAnalysis ?? null), [linked.labAnalysis]);

  const [step, setStep] = useState<Step>('params');
  const [bbLevel, setBbLevel] = useState<string>(prof.level || 'intermediate');
  const [bbGoal, setBbGoal] = useState<string>(prof.goal === 'bulk' ? 'mass' : prof.goal || 'mass');
  const [bbDays, setBbDays] = useState<number>(prof.daysPerWeek || 4);
  const [bbWeeks, setBbWeeks] = useState<number>(8);
  // ═══ 🏁 Prep-цикл: отдельный режим подготовки к соревнованиям ═══
  const personal = linked.profile?.settings?.personal;
  const profileWeight = Number(personal?.weight) || 80;
  const prepSex = (personal?.sex === 'female' ? 'female' : 'male') as 'male' | 'female';
  const storedCatRaw = (prof as any)?.bbCategory as string | undefined;
  const storedCatValid = storedCatRaw && CATEGORY_PROFILES[storedCatRaw as BBContestCategory]
    && CATEGORY_PROFILES[storedCatRaw as BBContestCategory].sex === prepSex;
  const prepDefaultCat = (prepSex === 'female' ? 'bikini' : 'mens_physique') as BBContestCategory;
  const [prepMode, setPrepMode] = useState<boolean>(false);
  const [prepStep, setPrepStep] = useState<'params' | 'accent' | 'split' | 'nutrition' | 'result'>('params');
  const [prepCat, setPrepCat] = useState<BBContestCategory>(storedCatValid ? storedCatRaw as BBContestCategory : prepDefaultCat);
  const [pcWeeks, setPcWeeks] = useState<number>(12);
  const [prepTaper, setPrepTaper] = useState<number>(3);
  const [pcShowDate, setPcShowDate] = useState<string>(isoAddDays(isoToday(), 70));
  const [prepAccent, setPrepAccent] = useState<string[]>([]);
  const [prepMinimal, setPrepMinimal] = useState<string[]>([]);
  const [prepMinMode, setPrepMinMode] = useState<PrepMinimalMode>('reduce_direct_to_floor');
  const [prepVolumeStrategy, setPrepVolumeStrategy] = useState<'gentle' | 'balanced' | 'aggressive'>('balanced');
  const [prepDeloadEvery, setPrepDeloadEvery] = useState<number>(5);
  const [prepSplit, setPrepSplit] = useState<string>('');
  const [prepBodyFat, setPrepBodyFat] = useState<number | undefined>(undefined);
  const [prepResult, setPrepResult] = useState<PrepCycleResult | null>(null);
  const [prepSeason, setPrepSeason] = useState<ReturnType<typeof buildPrepSeason> | null>(null);
  const [posingMin, setPosingMin] = useState<number>(0);
  const [posingList, setPosingList] = useState<ReturnType<typeof getPosingCheckins>>(() => getPosingCheckins());
  const [pcBusy, setPcBusy] = useState<boolean>(false);
  const [prepComps, setPrepComps] = useState<ContestEventEntry[]>([]);
  const [prepMainId, setPrepMainId] = useState<string>('');
  const [prepCompDraft, setPrepCompDraft] = useState<{ name: string; date: string; priority: 'A' | 'B' | 'C' }>({ name: '', date: '', priority: 'B' });
  // При смене категории — пресет акцента/минимума/сплита (если пользователь не настроил вручную).
  useEffect(() => {
    const p = PREP_SPLIT_PROFILES[prepCat];
    if (!p) return;
    setPrepAccent(p.defaultAccent);
    setPrepMinimal(p.defaultMinimal);
    setPrepSplit(p.recommendedSplits[0] || '');
    setPrepResult(null);
  }, [prepCat]);
  // Сохранение преференсов Prep-цикла (авто-восстановление).
  useEffect(() => {
    if (!prepMode) return;
    try {
      localStorage.setItem('he_prep_cycle_v1', JSON.stringify({
        cat: prepCat, weeks: pcWeeks, taper: prepTaper, showDate: pcShowDate,
        accent: prepAccent, minimal: prepMinimal, minMode: prepMinMode, split: prepSplit, bodyFat: prepBodyFat ?? null,
        comps: prepComps, mainId: prepMainId,
      }));
    } catch { /* silent */ }
  }, [prepMode, prepCat, pcWeeks, prepTaper, pcShowDate, prepAccent, prepMinimal, prepMinMode, prepSplit, prepBodyFat, prepComps, prepMainId]);

  // п.18: карточка «📍 Текущий блок года» — живой план + слушатель обновлений.
  const [annualPlan, setAnnualPlan] = useState(() => loadAnnualTrainingPlan());
  useEffect(() => {
    setAnnualPlan(loadAnnualTrainingPlan());
    const onUpd = () => setAnnualPlan(loadAnnualTrainingPlan());
    window.addEventListener('he-annual-training-plan-updated', onUpd);
    return () => window.removeEventListener('he-annual-training-plan-updated', onUpd);
  }, []);
  // PRO annualBlockId sync: если годовой план имеет contest prep блок — синкать дату шоу
  useEffect(() => {
    if (!annualPlan) return;
    try {
      const block = (annualPlan.blocks||[]).find((b:any)=>b.ref?.phase==='contest_prep' && b.status==='built');
      if ((block?.result as any)?.showDate && (block?.result as any)?.showDate !== prepShowDate) {
        // не перезаписываем если пользователь уже вручную менял в этом месяце
        const isRecentManual = (()=>{ try{ const v=localStorage.getItem('he_contest_manual_date'); if(!v) return false; return Date.now() - Number(v) < 86400000*7; } catch{ return false; }})();
        if (!isRecentManual) setPrepShowDate((block?.result as any)?.showDate);
      }
    } catch {}
  }, [annualPlan]);
  // Стаж + любимые/нелюбимые упражнения (синхронизируются с профилем тренированности).
  const [bbTrainingYears, setBbTrainingYears] = useState<number>(prof.trainingYears || 3);
  const [bbFavEx, setBbFavEx] = useState<string[]>(prof.favoriteExercises || []);
  const [bbExclEx, setBbExclEx] = useState<string[]>(prof.excludedExercises || []);
  // Синхронизация параметров шага 1 в профиль тренированности (legacy + UnifiedSettings).
  const syncProf = useCallback((patch: Partial<TrainingProfile>) => {
    try { saveTrainingProfile({ ...loadTrainingProfile(), ...patch }); } catch { /* silent */ }
  }, []);
  const [bbAnnualMacrocycle, setBbAnnualMacrocycle] = useState<BBMacrocycle | null>(null);
  const [bbVolGoal, setBbVolGoal] = useState<string>('mav');
  const [trainingVolumeMode, setTrainingVolumeMode] = useState<'standard' | 'high'>('standard');
  // Фаза 4.28: ручные оверрайды восстановления/лаб-множителя в визарде (null = авто).
  const [labMultOverride, setLabMultOverride] = useState<number | null>(null);
  const [recoveryOverride, setRecoveryOverride] = useState<number | null>(null);
  // 📅 Многоблочная специализация: список блоков (3-6 нед каждый), у каждого
  // блока цели 1-2, режим доноров и мышцы-доноры. Остаток плана — баланс.
  interface UISpecBlock {
    id: string;
    weeks: number;
    targets: string[];
    tradeoffMode: 'none' | 'reduce_direct_to_floor' | 'remove_direct_when_indirect_covers_floor';
    donors: string[];
  }
  const [specBlocks, setSpecBlocks] = useState<UISpecBlock[]>(() => {
    const initial = normalizeSpecializationTargets((prof.weakPoints || []).slice(0, 2));
    return initial.length > 0
      ? [{ id: 'spec-block-1', weeks: 5, targets: initial, tradeoffMode: 'none' as const, donors: [] }]
      : [];
  });
  // Цели первого блока — зеркало для движка/сплит-селектора (weakPoints).
  const specTargets = specBlocks[0]?.targets ?? [];
  // Явные блоки для движка: недели рассчитываются подряд из длительностей.
  const buildSpecBlocks = useMemo(() => {
    if (specBlocks.length === 0) return undefined;
    const blocks: { id: string; weekStart: number; weekEnd: number; targets: string[]; tradeoff?: { mode: UISpecBlock['tradeoffMode']; donorMuscles: string[]; preserveIndirect: true } }[] = [];
    let cursor = 1;
    for (const b of specBlocks) {
      if (cursor > bbWeeks) break;
      const weeks = Math.max(3, Math.min(6, Math.round(b.weeks || 5)));
      const end = Math.min(bbWeeks, cursor + weeks - 1);
      blocks.push({
        id: b.id,
        weekStart: cursor,
        weekEnd: end,
        targets: normalizeSpecializationTargets(b.targets),
        ...(b.tradeoffMode !== 'none' && b.donors.length > 0 && b.targets.length > 0
          ? { tradeoff: { mode: b.tradeoffMode, donorMuscles: normalizeDonorTargets(b.donors, b.targets), preserveIndirect: true as const } }
          : {}),
      });
      cursor = end + 1;
    }
    return blocks.length > 0 ? blocks : undefined;
  }, [specBlocks, bbWeeks]);
  const specSchedulePreview = useMemo(() => {
    if (specBlocks.length === 0) return '';
    const parts: string[] = [];
    let cursor = 1;
    for (const b of specBlocks) {
      if (cursor > bbWeeks) break;
      const weeks = Math.max(3, Math.min(6, Math.round(b.weeks || 5)));
      const end = Math.min(bbWeeks, cursor + weeks - 1);
      if (b.targets.length > 0) {
        parts.push(`нед ${cursor}-${end} [${b.targets.slice(0, 2).join(', ')}]${b.tradeoffMode !== 'none' && b.donors.length > 0 ? ` (доноры: ${b.donors.join(', ')})` : ''}`);
      } else {
        parts.push(`нед ${cursor}-${end} баланс`);
      }
      cursor = end + 1;
    }
    if (cursor <= bbWeeks) parts.push(`нед ${cursor}-${bbWeeks} баланс`);
    return parts.join(' → ');
  }, [specBlocks, bbWeeks]);
  const addSpecBlock = () => {
    const used = specBlocks.reduce((sum, b) => sum + Math.max(3, Math.min(6, Math.round(b.weeks || 5))), 0);
    const remain = bbWeeks - used;
    if (remain < 3) { flash('Недостаточно недель: остаток меньше 3 — это баланс/переход'); return; }
    setSpecBlocks(prev => {
      const maxId = prev.reduce((m, b) => Math.max(m, parseInt(b.id.split('-')[2] || '0') || 0), 0);
      return [...prev, { id: `spec-block-${maxId + 1}`, weeks: Math.min(5, remain), targets: [], tradeoffMode: 'none', donors: [] }];
    });
  };
  const updateSpecBlock = (id: string, patch: Partial<UISpecBlock>) => {
    setSpecBlocks(prev => prev.map(b => (b.id === id ? { ...b, ...patch } : b)));
  };
  const removeSpecBlock = (id: string) => {
    setSpecBlocks(prev => prev.filter(b => b.id !== id));
  };
  const [bbTrainingFocus, setBbTrainingFocus] = useState<'strength' | 'hypertrophy' | 'endurance'>(
    ((prof as any).trainingFocus || 'hypertrophy') as 'strength' | 'hypertrophy' | 'endurance',
  );
  const [planMode, setPlanMode] = useState<PlanMode>((prof.planMode === 'programs' || prof.planMode === 'bb_cycle') ? 'programs' : 'generic_split');
  const [selectedCycleId, setSelectedCycleId] = useState<string>(prof.bbCycleId || '');
  const [loadStrategy, setLoadStrategy] = useState<LoadStrategy>((prof.loadStrategy as LoadStrategy) || 'double_progression');
  const [autoDeload, setAutoDeload] = useState<boolean>(true);
  const [deloadType, setDeloadType] = useState<DeloadType>('pump');
  // P6: выбор intensity technique (если не выбрана — дефолт по фазе)
  const [intensityTech, setIntensityTech] = useState<IntensityTechnique>('none');
  const [bbMethodology, setBbMethodology] = useState<SessionMethodology>('compound_first');
  // Проф-методики (Библиотека → Методики): DUP, суперсеты-антагонисты, схемы объёма памп-дней
  const [dupMode, setDupMode] = useState<DUPMode>('none');
  // P2 E: per-muscle DUP — мышцы, для которых DUP применяется (пусто = ко всем primary).
  const [dupMuscles, setDupMuscles] = useState<string[]>([]);
  const [supersetMode, setSupersetMode] = useState<'none' | 'antagonist' | 'same_muscle' | 'giant'>('none');
  const [volumeScheme, setVolumeScheme] = useState<'standard' | 'gvt' | 'fst7' | 'gironda'>('standard');
  const [pedPhaseOverride, setPedPhaseOverride] = useState<'auto' | 'proliferation' | 'differentiation'>('auto');
  const [dcMode, setDcMode] = useState<boolean>(false);

  // 3.7-UI (план BB-AUTO-EXHAUSTIVE): рекомендация DUP по цели/уровню/дням —
  // показываем чипом, БЕЗ авто-применения (пользователь решает сам).
  const dupRecommendation = useMemo(
    () => recommendDUPMode(bbGoal, bbLevel === 'enhanced' ? 'advanced' : bbLevel, bbDays),
    [bbGoal, bbLevel, bbDays],
  );
  const dupRecommendChip = (dupRecommendation.mode !== 'none' && dupMode !== dupRecommendation.mode) ? (
    <button
      onClick={() => setDupMode(dupRecommendation.mode)}
      title="Рекомендация по цели, уровню и дням — нажмите, чтобы применить"
      style={{
        marginTop: 4, padding: '5px 9px', borderRadius: 999, fontSize: 10, fontWeight: 700, cursor: 'pointer', minHeight: 30,
        background: 'rgba(34,211,238,0.12)', border: '1px solid rgba(34,211,238,0.35)', color: '#22d3ee',
      }}>
      💡 Рекомендуем: {dupRecommendation.mode === 'full_dup' ? 'Полный DUP (3 дня)' : dupRecommendation.mode === 'strength_hypertrophy' ? 'Сила/гипертрофия (2 дня)' : 'Тяж/лёг (2 дня)'}
    </button>
  ) : null;

  // P-ext: calorieSurplus (ккал/день) и eccentricMult (1.0=норма, 1.1-1.2=eccentric overload).
  // calorieSurplus: из профиля nutrition (если есть) или manual input. Нет в профиле → 0 (нейтрально).
  // eccentricMult: тренировочный параметр, не профильный → default 1.0.
  const [calorieSurplus, setCalorieSurplus] = useState<number>(
    (linked?.profile?.settings?.nutrition as any)?.calorieSurplus ?? 0,
  );
  const [eccentricMult, setEccentricMult] = useState<number>(1.0);
  // Кнопки/опции пользователя (передаются в engine).
  const [fewerCompound, setFewerCompound] = useState<boolean>(false);
  const [allowStrengthLifts, setAllowStrengthLifts] = useState<boolean>(false);
  // A/B-ротация паттернов: sibling-сессии одного тега в неделе — разные
  // паттерны (горизонталь vs вертикаль). Только generic-путь, дефолт выкл.
  const [abRotation, setAbRotation] = useState<boolean>(false);
  // Packing-v2: заливка упражнений до индивидуальных капов (6/5/4)
  // вместо ровного дележа. Спина/грудь, дефолт выкл.
  const [packingV2, setPackingV2] = useState<boolean>(false);
  const [rotationMode, setRotationMode] = useState<'forbid' | 'strict' | 'variety'>('variety');
  const [avoidAxialLoadUi, setAvoidAxialLoadUi] = useState<boolean>(false);
  const [intensityLevel, setIntensityLevel] = useState<'light' | 'moderate' | 'high'>('moderate');

  const [peds, setPeds] = useState<PED[]>((prof.bbPeds?.length ? prof.bbPeds : (prof.onCourse ? ['AAS'] : [])) as PED[]);
  const [pedDoses, setPedDoses] = useState<Record<string, number>>({ AAS: 500, insulin: 10, MGF: 200, IGF1: 50, GH: 4 });
  const [courseIntensity, setCourseIntensity] = useState<'mild' | 'moderate' | 'heavy'>(prof.courseIntensity || 'moderate');
  const [proPreset, setProPreset] = useState<string>('none');
  const [bfrMode, setBfrMode] = useState<boolean>(false);
  const [blastCruiseEnabled, setBlastCruiseEnabled] = useState<boolean>(false);
  const [blastWeeks, setBlastWeeks] = useState<number>(8);
  const [cruiseWeeks, setCruiseWeeks] = useState<number>(4);
  const [bbWorkMax, setBbWorkMax] = useState<Record<string, number>>(() => ({
    chest: 100, back: 110, quads: 140, hamstrings: 90, shoulders: 60, biceps: 50, triceps: 60, glutes: 160, calves: 120, abs: 60,
    ...(prof.workMax || {}),
  }));
  const [weakPoints, setWeakPoints] = useState<string[]>(prof.weakPoints || []);
  const [preferredExerciseIds, setPreferredExerciseIds] = useState<string[]>(() => {
    try { const raw = localStorage.getItem('he_bb_preferred_exercises'); const arr = raw ? JSON.parse(raw) : []; return Array.isArray(arr) ? arr.slice(0, 8) : []; } catch { return []; }
  });
  const [exerciseSwaps, setExerciseSwaps] = useState<Array<{ oldId: string; newId: string }>>(() => {
    try { const raw = localStorage.getItem('he_bb_exercise_swaps'); const arr = raw ? JSON.parse(raw) : []; return Array.isArray(arr) ? arr : []; } catch { return []; }
  });
  const [executionCorrections, setExecutionCorrections] = useState<Array<any>>(() => {
    try { const raw = localStorage.getItem('he_bb_execution_corrections'); const arr = raw ? JSON.parse(raw) : []; return Array.isArray(arr) ? arr : []; } catch { return []; }
  });
  // PRO-3 R2: L/R-добивка слабой стороны из ББ-диагностики (применяется в автосборке поверх плана)
  const [lrTopUp, setLrTopUp] = useState<Record<string, { side: 'left' | 'right'; sets: number }>>(() => {
    try {
      const raw = localStorage.getItem('he_bb_lr_topup');
      const j = raw ? JSON.parse(raw) : {};
      if (!j || typeof j !== 'object') return {};
      const out: Record<string, { side: 'left' | 'right'; sets: number }> = {};
      for (const [k, v] of Object.entries(j as Record<string, any>)) {
        if (v && (v.side === 'left' || v.side === 'right')) out[String(k)] = { side: v.side, sets: Math.max(1, Math.min(3, Math.round(Number(v.sets) || 1))) };
      }
      return out;
    } catch { return {}; }
  });
  // PRO-4 S3: активная ступень возврата — влияет на вставку и автосборку (0% на ступени 1)
  const [returnAction, setReturnAction] = useState<{ volumeMult: number; rirShift: number; bannedPatterns: string[] } | null>(() => {
    try {
      const raw = localStorage.getItem('he_bb_return_action');
      const j = raw ? JSON.parse(raw) : null;
      if (!j || typeof j !== 'object') return null;
      const vm = Number(j.volumeMult);
      if (!Number.isFinite(vm)) return null;
      return { volumeMult: Math.max(0, Math.min(1, vm)), rirShift: Math.max(0, Math.min(3, Math.round(Number(j.rirShift) || 0))), bannedPatterns: Array.isArray(j.bannedPatterns) ? j.bannedPatterns.map((x: any) => String(x)) : [] };
    } catch { return null; }
  });
  // Epic A: персональная калибровка MEV (личный минимум объёма). Хранится в he_bb_mev_calibration.
  const [mevCal, setMevCal] = useState<MEVCalibration | null>(() => loadMEVCalibration());
  const [mevDraft, setMevDraft] = useState<MEVSignal>({ pump: 4, soreness: 2, performance: 4 });
  const startMEVCalibration = () => {
    const cal = buildMEVCalibration(bbLevel, ['chest', 'back', 'quads', 'hamstrings', 'shoulders', 'biceps', 'triceps', 'glutes', 'calves', 'abs']);
    saveMEVCalibration(cal);
    setMevCal(cal);
    flash('🧪 Калибровка MEV запущена — старт MEV−2, после каждой недели вводите сигнал');
  };
  const commitMEVWeek = () => {
    if (!mevCal) return;
    const next = recordMEVCalibrationWeek(mevCal, mevDraft);
    saveMEVCalibration(next);
    setMevCal(next);
    flash(isMEVCalibrationComplete(next) ? '✅ MEV калиброван — личный минимум зафиксирован' : `📈 Неделя ${next.weeks.length} записана`);
  };
  const resetMEVCalibration = () => { clearMEVCalibration(); setMevCal(null); flash('🧪 Калибровка MEV сброшена'); };
  // Шаг «Реальные веса»: фактический ввод весов по упражнениям плана + число применённых
  const [weightEntries, setWeightEntries] = useState<PlanWeightEntry[]>([]);
  const [weightsApplied, setWeightsApplied] = useState(0);
  // Фаза 0: свёрнутые группы мышц в шаге «Реальные веса» (muscle -> collapsed).
  const [weightsCollapsed, setWeightsCollapsed] = useState<Record<string, boolean>>({});
  // weakPoints — зеркало specTargets (единый источник выбора в UI).
  useEffect(() => { setWeakPoints(specTargets); }, [specTargets]);
  const [injuries, setInjuries] = useState<InjurySelectEntry[]>(prof.injuries || []);
  // R1: мышцы для реабилитации (прогрессивная рампа возврата). По умолчанию — щадящие травмы.
  const [rehabMuscles, setRehabMuscles] = useState<string[]>([]);
  // P1: набор пластин зала для реалистичного округления весов.
  const [platePreset, setPlatePreset] = useState<string>('standard');
  // P1: женский цикл — день цикла для лютеиновой модуляции объёма.
  const [cycleDay, setCycleDay] = useState<number | undefined>(undefined);
  // P1: целевой % жира (уточняет cut/recomp) — дефолт из defaultTargetBodyFat.
  const [targetBodyFat, setTargetBodyFat] = useState<number | undefined>(() => {
    const sex = linked?.profile?.settings?.personal?.sex;
    const def = sex === 'female' ? 18 : 10;
    try {
      const g = (linked?.profile?.settings?.goals as any)?.targetBodyFat;
      return Number.isFinite(g) ? Number(g) : undefined;
    } catch { return undefined; }
  });
  // P2 D: дневные данные носимого (he_wearable_daily) — учитываются в recovery.
  // P0-13 (аудит 2026-09): tick — ручной ввод ниже пишет в localStorage, но без
  // ре-рендера сборка видела СТАРЫЕ данные. Tick форсит пересчёт.
  const [wearableTick, setWearableTick] = useState(0);
  const wearableData = useMemo(() => { try { const raw = localStorage.getItem('he_wearable_daily'); return raw ? JSON.parse(raw) : null; } catch { return null; } }, [wearableTick]);
  // P1: VBT — ввод скорости лучшего/последнего повтора для рекомендации нагрузки.
  const [vbtInput, setVbtInput] = useState<{ lift: string; best: string; last: string }>({ lift: 'bench', best: '', last: '' });
  // PRO: mobility restrictions — biomechanics-based exercise filtering
  const [mobilityRestrictions, setMobilityRestrictions] = useState<string[]>(prof.mobilityRestrictions || []);

  const [selectedSplitId, setSelectedSplitId] = useState<string>('');
  // Пользователь трогал сплит вручную → авто-рекомендация больше не перезаписывает выбор.
  const splitTouched = useRef(false);
  const [builtPlan, setBuiltPlan] = useState<BBPlan | null>(null);
  const [bbWeekSel, setBbWeekSel] = useState<number>(1);
  // Понедельный просмотр качества: номер недели или 'avg' (среднее по неделям).
  const [qualityWeek, setQualityWeek] = useState<number | 'avg'>('avg');
  const [autoRegOn, setAutoRegOn] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [expandedMuscles, setExpandedMuscles] = useState<Set<string>>(new Set());
  const [collapsedDays, setCollapsedDays] = useState<Set<number>>(new Set());
  const [collapsedExercises, setCollapsedExercises] = useState<Set<string>>(new Set());
  const [safetyOpen, setSafetyOpen] = useState(true);
  const [qualityOpen, setQualityOpen] = useState(true);
  const [safetyMainOpen, setSafetyMainOpen] = useState(true);
  const [safetyJointsOpen, setSafetyJointsOpen] = useState(true);
  const [safetyOrthoOpen, setSafetyOrthoOpen] = useState(true);
  const [safetyPreventionOpen, setSafetyPreventionOpen] = useState(true);
  const [safetyDistributionOpen, setSafetyDistributionOpen] = useState(true);
  const [safetyConclusionOpen, setSafetyConclusionOpen] = useState(true);
  const [safetyFactorsOpen, setSafetyFactorsOpen] = useState(true);
  const [generalSafetyLoadOpen, setGeneralSafetyLoadOpen] = useState(true);
  const [jointAnalysisOpen, setJointAnalysisOpen] = useState(true);
  const [qualityVolumeOpen, setQualityVolumeOpen] = useState(true);
  const [qualityLogicOpen, setQualityLogicOpen] = useState(true);
  const [qualityForecastOpen, setQualityForecastOpen] = useState(true);
  const [qualityProOpen, setQualityProOpen] = useState(true);
  const [qualityProgressionOpen, setQualityProgressionOpen] = useState(true);
  const [qualityGarbageOpen, setQualityGarbageOpen] = useState(true);
  const [qualityRecsOpen, setQualityRecsOpen] = useState(true);
  const [qualityVolumeChartOpen, setQualityVolumeChartOpen] = useState(true);
  const [qualityRirChartOpen, setQualityRirChartOpen] = useState(true);
  const [qualityLoadOpen, setQualityLoadOpen] = useState(true);
  const [qualityExtraOpen, setQualityExtraOpen] = useState(true);
  // specializationMode больше не выбирается в UI: специализация включается
  // автоматически при выборе 1-2 отстающих мышц (specTargets).
  const specializationMode = specTargets.length > 0;
  const [editMode, setEditMode] = useState<{ dayIdx: number; exIdx: number } | null>(null);
  const [exerciseEdits, setExerciseEdits] = useState<Record<string, { sets: number; reps: number; weight: number; rir?: number; tempo?: string; technique?: string; supersetWith?: string }>>({});
  // Фаза 4.26: undo/redo + bulk-редактирование упражнений.
  const editsRef = useRef(exerciseEdits); editsRef.current = exerciseEdits;
  const [editsHistory, setEditsHistory] = useState<Array<Record<string, any>>>([]);
  const [redosHistory, setRedosHistory] = useState<Array<Record<string, any>>>([]);
  const commitEdits = (next: Record<string, any>) => { setRedosHistory([]); setEditsHistory(h => [...h.slice(-9), editsRef.current]); setExerciseEdits(next as any); };
  const undoEdits = () => {
    if (!editsHistory.length) return;
    const prev = editsHistory[editsHistory.length - 1];
    setRedosHistory(r => [...r.slice(-9), editsRef.current]);
    setEditsHistory(h => h.slice(0, -1));
    setExerciseEdits(prev as any);
  };
  const redoEdits = () => {
    if (!redosHistory.length) return;
    const next = redosHistory[redosHistory.length - 1];
    setEditsHistory(h => [...h.slice(-9), editsRef.current]);
    setRedosHistory(r => r.slice(0, -1));
    setExerciseEdits(next as any);
  };
  const [bulkModal, setBulkModal] = useState(false);
  const [bulkField, setBulkField] = useState<'sets' | 'reps' | 'weight'>('weight');
  const [bulkValue, setBulkValue] = useState(0);
  const [bulkMode, setBulkMode] = useState<'set' | 'mult'>('set');
  const [subTarget, setSubTarget] = useState<{ dayIdx: number; exIdx: number; sessionIdx: number } | null>(null);
  const [exSwapModal, setExSwapModal] = useState<{ si: number; ei: number; muscle: string; currentName: string } | null>(null);
  const [exSwapSearch, setExSwapSearch] = useState('');
  // Фаза 7: Фильтр оборудования
  const [bbEquipment, setBbEquipment] = useState<string[]>(() => prof.equipment || []);
  // Программы: только FullProgram (библиотека) → programToBBPlan (faithful/adapt)
  const [customCycle, setCustomCycle] = useState<SRCycleTemplate | null>(null);
  const [customProgram, setCustomProgram] = useState<FullProgram | null>(null);
  const [bbProgramPath, setBbProgramPath] = useState<'library' | 'cycle'>('library');
  const [bbAdaptMode, setBbAdaptMode] = useState<'faithful' | 'adapt'>('faithful');
  const [bbSource, setBbSource] = useState<'cycle' | 'program'>('program');
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(customCycle ? customCycle.meta.id.replace('prog_', '') : null);
  const [bridgeMsg, setBridgeMsg] = useState('');
  // C4: flash helper — заменяет alert() для некритичных уведомлений.
  const flash = useCallback((m: string) => { setBridgeMsg(m); setTimeout(() => setBridgeMsg(''), 4000); }, []);
  // P1.6: авто-выбор методики порядка по PED-стеку — применяем ТОЛЬКО поверх
  // дефолта (ручной выбор не затираем). Чип ручного применения — в PED-карте.
  useEffect(() => {
    try {
      if (bbMethodology !== 'compound_first') return;
      const sug = suggestMethodologyForStack({ peds: peds as any, pedDoses });
      if (sug) {
        setBbMethodology(sug);
        flash('Методика порядка обновлена под PED-стек');
      }
    } catch { /* suggest не должен ломать UI */ }
  }, [peds, pedDoses]);
  // Имя для сохранения (модалка вместо prompt — prompt не работает в Telegram Mini App).
  const [namePrompt, setNamePrompt] = useState<{ title: string; value: string; onOk: (name: string) => void } | null>(null);
  const confirmName = () => {
    if (!namePrompt) return;
    const v = namePrompt.value.trim();
    if (!v) { flash('Введите название'); return; }
    const cb = namePrompt.onOk;
    setNamePrompt(null);
    cb(v);
  };
  // Мульти-планы: сохранённые варианты для сравнения
  const [savedPlans, setSavedPlans] = useState<SavedBBPlan[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  // Фаза 4.27: по-недельный дифф текущего плана против выбранного варианта.
  const [diffVariantId, setDiffVariantId] = useState<string | null>(null);
  const diffPlan = diffVariantId ? savedPlans.find(v => v.id === diffVariantId)?.plan : null;
  // Фаза 4.23: дата старта мезоцикла → календарные диапазоны недель + «📍 текущая неделя».
  const [startDateInput, setStartDateInput] = useState<string>(() => { try { return new Date().toISOString().slice(0, 10); } catch { return ''; } });
  // 🔄 «Начать заново»: подтверждение сброса сборки.
  const [resetAsk, setResetAsk] = useState(false);
  // 4.4: a11y inline-модалок (фокус на диалог, Escape закрывает, возврат фокуса).
  const exSwapDialogRef = useInlineDialogA11y(!!exSwapModal, () => { setExSwapModal(null); setExSwapSearch(''); });
  const namePromptDialogRef = useInlineDialogA11y(!!namePrompt, () => setNamePrompt(null));
  const resetAskDialogRef = useInlineDialogA11y(!!resetAsk, () => setResetAsk(false));
  // PRO: cross-mesocycle continuity — auto-load последнего сохранённого плана
  const [usePreviousPlan, setUsePreviousPlan] = useState(true);
  // PRO: peak week — единая система тапера ББ (bb-contest-prep.engine)
  const [showPeakWeek, setShowPeakWeek] = useState(false);
  const [peakPrep, setPeakPrep] = useState<BBContestPrepResult | null>(null);
  // 🏁 Contest Prep (Этап 8): опциональный полный цикл подготовки
  const [prepPlan, setPrepPlan] = useState<BBContestPrepPlan | null>(null);
  const [prepApplied, setPrepApplied] = useState(false);
  /** Snapshot плана ДО применения contest prep — для блока «Сравнение до/после». */
  const [prepBasePlan, setPrepBasePlan] = useState<BBPlan | null>(null);
  const [prepShowDate, setPrepShowDate] = useState<string>(() => {
    try {
      const prof = (linked.profile?.settings ?? {}) as any;
      const stored = prof?.goals?.bbPeakConfig ? deserializeBBPrepConfig(prof.goals.bbPeakConfig) : null;
      if (stored?.showDate) return stored.showDate;
      if (prof?.goals?.peakShowDay) return String(prof.goals.peakShowDay);
    } catch { /* ignore */ }
    return isoAddDays(isoToday(), 8 * 7);
  });
  const [prepWeeks, setPrepWeeks] = useState<number>(12);
  const [prepTaperWeeks, setPrepTaperWeeks] = useState<number>(2);
  const [prepWaterMode, setPrepWaterMode] = useState<WaterStrategy>('stable');
  const [prepSodiumMode, setPrepSodiumMode] = useState<SodiumStrategy>('stable');
  const [prepCarbMode, setPrepCarbMode] = useState<CarbLoadStrategy>('moderate');
  const [prepTrainingProtocol, setPrepTrainingProtocol] = useState<PeakingProtocol>('bb');
  const [prepPreferLowFiber, setPrepPreferLowFiber] = useState(false);
  const [prepCreatineStop, setPrepCreatineStop] = useState(false);
  const [prepCompetitions, setPrepCompetitions] = useState<ContestEventEntry[] | undefined>(undefined);
  const [prepMainCompetitionId, setPrepMainCompetitionId] = useState<string | undefined>(undefined);
  // 🏁 Режим подготовки (тренировочная логика недель подготовки): 1.0 = сохранение
  // (RIR 1–3, без отказа, объём как в плане), 0.85 = поддерживающий объём при дефиците.
  const [prepVolumeMode, setPrepVolumeMode] = useState<number>(1.0);
  // 📋 Контроль готовности (P2): чек-лист по дням, localStorage he_prep_checkin.
  const [prepCheckin, setPrepCheckin] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('he_prep_checkin') || '{}'); } catch { return {}; }
  });
  const PREP_CHECKIN_ITEMS = ['Вес записан (утро)', 'Сон ≥ 7 ч', 'Тренировка выполнена', 'Шаги/кардио по плану', 'Пищеварение ок', 'Фото/форма оценены'] as const;
  const togglePrepCheckin = (idx: number) => {
    const key = `${isoToday()}_${idx}`;
    const next = { ...prepCheckin, [key]: !prepCheckin[key] };
    setPrepCheckin(next);
    try { localStorage.setItem('he_prep_checkin', JSON.stringify(next)); } catch { /* ignore */ }
  };
  const prepCheckinDone = PREP_CHECKIN_ITEMS.filter((_, i) => prepCheckin[`${isoToday()}_${i}`]).length;
  // 📊 Недельный луп подготовки (Э4): форма чек-ина недели + тик обновления ленты.
  const [weeklyTick, setWeeklyTick] = useState(0);
  const [wkWeek, setWkWeek] = useState<number | null>(null);
  const [wkWeight, setWkWeight] = useState('');
  const [wkWaist, setWkWaist] = useState('');
  const [wkSleep, setWkSleep] = useState('');
  const [wkSessions, setWkSessions] = useState('');
  const [wkPsyche, setWkPsyche] = useState('');
  const [wkNote, setWkNote] = useState('');
  const weeklyLog = useMemo(
    () => (prepPlan ? loadPrepWeekCheckins(prepPlan.id) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prepPlan?.id, weeklyTick],
  );
  const weekRefs = useMemo(() => (prepPlan ? prepWeekRefs(prepPlan) : []), [prepPlan]);
  const strengthDowns = useMemo(() => {
    if (!prepPlan) return [];
    try { return prepStrengthTrend(loadSessions() as any, prepPlan); } catch { return []; }
  }, [prepPlan, weeklyTick]);
  const currentPrepWeek = useMemo(() => {
    if (!prepPlan) return 1;
    try {
      const d = Math.floor((new Date(isoToday()).getTime() - new Date(prepPlan.preparation.startDate).getTime()) / 864e5);
      return Math.min(prepPlan.preparation.weeks, Math.max(1, Math.floor(d / 7) + 1));
    } catch { return 1; }
  }, [prepPlan]);
  const handleSaveWeekCheckin = () => {
    if (!prepPlan) return;
    const w = wkWeek ?? currentPrepWeek;
    const num = (s: string): number | undefined => {
      const v = parseFloat(String(s).replace(',', '.'));
      return Number.isFinite(v) ? v : undefined;
    };
    let weightLog: Array<{ date: string; weight: number }> = [];
    try { weightLog = getWeightLog().map(e => ({ date: e.date, weight: e.weight })); } catch { /* ignore */ }
    const entry: PrepWeekCheckin = {
      week: w,
      date: isoToday(),
      weightAvg: num(wkWeight) ?? avgWeight7d(weightLog, isoToday()),
      waistCm: num(wkWaist),
      sleepAvg: num(wkSleep),
      sessionsDone: num(wkSessions) != null ? Math.round(num(wkSessions)!) : undefined,
      psyche: num(wkPsyche) != null ? Math.min(5, Math.max(1, Math.round(num(wkPsyche)!))) : undefined,
      note: wkNote.trim() || undefined,
      advice: (weightAdvice?.status as PrepWeekCheckin['advice']) ?? 'no_data',
    };
    savePrepWeekCheckin(prepPlan.id, entry);
    setWeeklyTick(t => t + 1);
    setWkWeight(''); setWkWaist(''); setWkSleep(''); setWkSessions(''); setWkPsyche(''); setWkNote(''); setWkWeek(null);
    flash(`📊 Чек-ин недели ${w} сохранён`);
  };
  const [prepConfirmedManip, setPrepConfirmedManip] = useState(false);
  const [prepBusy, setPrepBusy] = useState(false);
  // 📋 Чек-лист шоу D-10…D-0 (Э5) + live-adjust вводы.
  const [showCheck, setShowCheck] = useState<Record<string, boolean>>(() => {
    try { return loadShowChecklist(); } catch { return {}; }
  });
  const [liveFull, setLiveFull] = useState(3);
  const [liveWater, setLiveWater] = useState(3);
  // PRO-2 P2-доводка: live-пересчёт оставшихся load-дней по визуалу (персист по дате шоу).
  const [liveVisual, setLiveVisual] = useState<'flat' | 'full' | 'spill'>('full');
  const [recarb, setRecarb] = useState<Array<{ day: number; phase: string; carbsG: number; kcal: number }> | null>(null);
  // PRO-2 P6: лог восстановления post-show (6 нед) — вводы формы.
  const [postLogTick, setPostLogTick] = useState(0);
  const [postLogWeek, setPostLogWeek] = useState<number>(1);
  const [postLogWeight, setPostLogWeight] = useState('');
  const [postLogSleep, setPostLogSleep] = useState('');
  const [postLogHunger, setPostLogHunger] = useState(3);
  const [postLogCycle, setPostLogCycle] = useState<'restored' | 'irregular' | 'absent' | 'na'>('na');
  const [postLogStrength, setPostLogStrength] = useState('');
  const [contestWizard, setContestWizard] = useState<1|2|3|4|5>(1);
  // P2-8 (audit 2026-08): категория peak week — ранее хардкод 'mens_physique'.
  const [peakWeekCategory, setPeakWeekCategory] = useState<BBContestCategory>('mens_physique');
  // ⭐ Специализация (упор мышцы к старту) — из профильного конфига, с override в UI.
  const [peakSpec, setPeakSpec] = useState<ContestSpecialization>(() => {
    try {
      const raw = (linked.profile?.settings as any)?.goals?.bbPeakConfig;
      const cfg = raw ? deserializeBBPrepConfig(raw) : null;
      return cfg?.specialization ?? 'none';
    } catch { return 'none'; }
  });
  const prepContra = useMemo(() => {
    try {
      const health = (linked.profile?.settings as any)?.health as { chronicConditions?: string[]; contraindications?: Record<string, boolean> } | undefined;
      const out: string[] = [...(health?.chronicConditions ?? [])];
      const ci = health?.contraindications ?? {};
      if (ci.diabetes) out.push('diabetes');
      if (ci.kidneyDisease) out.push('kidney');
      if (ci.cvd) out.push('heart');
      return out;
    } catch { return []; }
  }, [linked.profile?.settings]);
  const [prepContraExtra, setPrepContraExtra] = useState<string[]>([]);
  const allPrepContra = useMemo(() => Array.from(new Set([...prepContra, ...prepContraExtra])), [prepContra, prepContraExtra]);

  /** Тренировочный стаж для contest prep (из bbTrainingYears / bbLevel). */
  const expYearsForPrep = useMemo(
    () => (Number(bbTrainingYears) > 0 ? Number(bbTrainingYears) : (bbLevel === 'advanced' ? 7 : bbLevel === 'beginner' ? 1 : 3)),
    [bbTrainingYears, bbLevel],
  );
  const buildContestPrepConfig = (): BBContestPrepConfig => {
    const prof = (linked.profile?.settings ?? {}) as any;
    const catProfile = CATEGORY_PROFILES[peakWeekCategory] ?? CATEGORY_PROFILES.mens_physique;
    const sex: 'male' | 'female' = catProfile.sex;
    // Тренировочный стаж → опыт для prep (влияет на стратегию пик-недели и предупреждения).
    const expYears = expYearsForPrep;
    const experienceLevel: 'beginner' | 'intermediate' | 'advanced' =
      expYears >= 5 || bbLevel === 'advanced' ? 'advanced'
        : expYears < 2 || bbLevel === 'beginner' ? 'beginner'
          : 'intermediate';
    const heightCm = Number(prof?.personal?.height) > 120 ? Number(prof.personal.height) : undefined;
    const cycleDay = (() => { try { const v = Number(localStorage.getItem('he_cycle_day')); return Number.isFinite(v) && v>=1 && v<=35 ? v : undefined; } catch { return undefined; } })();
    const hasTrial = (() => { try { const raw = localStorage.getItem('he_bb_test_peak_weeks'); if(!raw) return undefined; const arr=JSON.parse(raw); return Array.isArray(arr) && arr.length>0 ? true : undefined; } catch { return undefined; } })();
    const base: BBContestPrepConfig = {
      sex,
      category: peakWeekCategory,
      weightKg: Math.max(40, Math.min(200, Number(prof?.personal?.weight) || 80)),
      heightCm,
      bodyFatPct: Number(prof?.personal?.bodyFat) > 0 ? Number(prof?.personal?.bodyFat) : undefined,
      cycleDay,
      hasTrialPeak: hasTrial,
      experienceLevel,
      enhanced: peds.length > 0,
      prepCount: 0,
      showDate: prepShowDate,
      weeksOut: Math.min(4, Math.max(1, prepTaperWeeks)),
      carbLoadStrategy: prepCarbMode,
      waterStrategy: prepWaterMode,
      sodiumStrategy: prepSodiumMode,
      trainingProtocol: prepTrainingProtocol,
      preferLowFiberCarbs: prepPreferLowFiber || undefined,
      creatineStrategy: prepCreatineStop ? 'stop' : undefined,
      confirmedManipulation: prepConfirmedManip || undefined,
      contraindications: allPrepContra.length > 0 ? allPrepContra : undefined,
      specialization: peakSpec === 'none' ? undefined : peakSpec,
      competitions: prepCompetitions,
      mainCompetitionId: prepMainCompetitionId,
      schedule: { wake: '07:00', stage: '12:00' },
      pedContext: peds.length>0 ? { ghIU: (pedDoses.GH ?? pedDoses.gh ?? 0) || undefined, trenMg: (pedDoses.tren ?? pedDoses.trenbolone ?? 0) || undefined, insulinIU: (pedDoses.insulin ?? 0) || undefined, diuretic: false } : undefined,
    };
    return base;
  };
  const spillRisk = useMemo(() => { try { return spillRiskScore(buildContestPrepConfig()); } catch { return { level:'low' as const, note:'' }; } }, [peakWeekCategory, prepWaterMode, prepSodiumMode, prepCarbMode, linked.profile?.settings]);
  const readiness = useMemo(() => { try { return computeReadiness(buildContestPrepConfig()); } catch { return { verdict:'on_track' as const, gap:null, targetBf:null, note:'' }; } }, [peakWeekCategory, prepWaterMode, prepCarbMode, linked.profile?.settings]);

  /** Собрать единый prep-план, применить к текущему плану и сохранить в профиль. */
  const assembleContestPrep = (applyToPlan: boolean) => {
    if (!builtPlan) { flash('Сначала соберите план тренировок'); return; }
    setPrepBusy(true);
    try {
      const cfg = buildContestPrepConfig();
      // PRO gates
      const risk = spillRiskScore(cfg);
      if (risk.level==='high' && (cfg.carbLoadStrategy==='back' || cfg.carbLoadStrategy==='front')) { flash(`⛔ ${risk.note}`); setPrepBusy(false); return; }
      if (cfg.waterStrategy==='high' && !cfg.hasTrialPeak) { flash('⛔ High water требует trial peak за 21-28д + confirm'); setPrepBusy(false); return; }
      if (isShortCycle(prepWeeks + prepTaperWeeks + 1) && cfg.carbLoadStrategy==='back') { flash('⛔ ShortCycle 4-6 нед: берите linear/moderate, не back'); setPrepBusy(false); return; }
      // PRO-2 P2: персональная доза загрузки из trial (без trial — коридор по умолчанию).
      const trialDose = lastTest ? trialCarbDoseGPerKg(lastTest, cfg.category, cfg.sex) : undefined;
      // PRO-2 P5: трек post-show не сбрасывается пересборкой (берём из текущего плана).
      const keepTrack = prepPlan?.postShowTrack ?? 'recovery';
      const plan = buildBBContestPrepPlan(cfg, {
        prepWeeks: Math.min(52, Math.max(1, prepWeeks)),
        taperWeeks: Math.min(4, Math.max(1, prepTaperWeeks)),
        prepVolumeMult: prepVolumeMode,
        source: 'bb_auto',
        carbDoseGPerKg: trialDose,
        postShowTrack: keepTrack,
      });
      setPrepPlan(plan);
      if (applyToPlan) {
        // Сохраняем ручные правки пользователя (exerciseEdits) перед пересборкой prep:
        // иначе повторный taper клонирует план БЕЗ правок и они теряются.
        const baseWithEdits = Object.keys(exerciseEdits).length > 0 ? applyEditsToPlan(builtPlan) : builtPlan;
        // Snapshot ДО применения — для блока «Сравнение до/после».
        setPrepBasePlan(structuredClone(baseWithEdits) as BBPlan);
        const updated = applyContestPrepToBBPlan(baseWithEdits, cfg, {
          prepWeeks: plan.preparation.weeks,
          taperWeeks: plan.taper.weeks,
          prepVolumeMult: prepVolumeMode,
          force: true, // обновить уже наложенный taper/пик актуальными настройками
          carbDoseGPerKg: trialDose, // PRO-2 P2: доза trial в пик-неделю плана
        });
        setBuiltPlan(updated);
        setPrepApplied(true);
        // Подготовка в плане НЕ переделывается: taper накладывается поверх последних недель.
        const metaWarnings = ((updated as any).contestPrep?.warnings ?? []) as string[];
        const shortPrep = metaWarnings.find(w => w.includes('короче полной подготовки'));
        if (shortPrep) flash(`⚠ ${shortPrep.replace(/^⚠ /, '')}`);
      }
      savePrepToProfile(plan, cfg);
      flash('🏁 Contest prep собран' + (applyToPlan ? ' и применён к плану' : ''));
    } catch (e) {
      flash(`Не удалось собрать contest prep: ${(e as Error).message}`);
    } finally {
      setPrepBusy(false);
    }
  };

  // Единая точка записи prep (Э0): готовый план + конфиг — через sync-модуль
  // (оба ключа профиля + событие he-bb-contest-prep-updated). Не пересобирает план.
  const savePrepToProfile = (plan: BBContestPrepPlan, cfg: BBContestPrepConfig) => {
    storeContestPrepPlan(plan, cfg, { source: plan.source ?? 'bb_auto' });
  };

  /** Перенос даты шоу с пересчётом фаз (завершённые недели — с предупреждением). */
  const handleShiftPrepShowDate = (d: string) => {
    try { localStorage.setItem('he_contest_manual_date', String(Date.now())); } catch {}
    if (!prepPlan) { setPrepShowDate(d); return; }
    const { plan, changedFrozen, warnings } = shiftBBContestPrepShowDate(prepPlan, d);
    setPrepPlan(plan);
    setPrepShowDate(d);
    if (changedFrozen) flash(warnings[0] ?? 'Завершённые недели требуют подтверждения');
    else if (warnings.length) flash(warnings[0]);
    if (builtPlan && prepApplied) {
      const updated = applyContestPrepToBBPlan(builtPlan, buildContestPrepConfig(), {
        prepWeeks: plan.preparation.weeks,
        taperWeeks: plan.taper.weeks,
        prepVolumeMult: prepVolumeMode,
        force: true,
      });
      setBuiltPlan(updated);
    }
  };

  /** Расширить только подготовительный блок (+/- недели). */
  const handleExtendPrep = (delta: number) => {
    if (!prepPlan) return;
    const newWeeks = Math.min(52, Math.max(1, prepPlan.preparation.weeks + delta));
    if (newWeeks === prepPlan.preparation.weeks) return;
    setPrepWeeks(newWeeks);
    const replanned = replanBBContestPrep(prepPlan, prepPlan.showDate, newWeeks);
    setPrepPlan(replanned);
    if (builtPlan && prepApplied) {
      let base: BBPlanWithPrep = builtPlan as BBPlanWithPrep;
      if (delta > 0) base = extendBBPlanPreparation(base, delta);
      const updated = applyContestPrepToBBPlan(base, buildContestPrepConfig(), {
        prepWeeks: newWeeks,
        taperWeeks: replanned.taper.weeks,
        prepVolumeMult: prepVolumeMode,
        force: true,
      });
      setBuiltPlan(updated);
    }
    flash(delta > 0 ? `Подготовка расширена до ${newWeeks} нед (пик и тапер не тронуты)` : `Подготовка сокращена до ${newWeeks} нед`);
  };

  /** 🖨 Печать полной сводки contest prep (фазы/тапер/пик-неделя/шоу-день/post-show + история + выполнение). */
  const handlePrintPrepSummary = () => {
    if (!prepPlan) return;
    try {
      const compliance = (prepApplied && builtPlan)
        ? prepTrainingCompliance(
            prepPlan,
            builtPlan.weeks.map((w: any) => ({
              week: (w as any).week,
              contestPhase: (w as any).contestPhase,
              plannedSets: w.sessions.reduce((a: number, s: any) => a + s.exercises.reduce((b: number, e: any) => b + (e.sets || 0), 0), 0),
            })),
            loadSessions().map(s => ({ date: s.date, totalSets: s.totalSets })),
          )
        : undefined;
      const win = window.open('', '_blank', 'width=900,height=700');
      if (!win) { flash('Браузер заблокировал окно печати — разрешите всплывающие окна'); return; }
      win.document.write(buildContestPrepPrintHtml(prepPlan, { compliance, postShowLog: getPostShowLog(prepPlan.id) }));
      win.document.close();
      win.focus();
      setTimeout(() => { try { win.print(); } catch { /* ignore */ } }, 300);
    } catch (e) {
      flash(`Не удалось открыть сводку: ${(e as Error).message}`);
    }
  };

  /** 📅 Скачать .ics с фазами contest prep. */
  const handleExportPrepIcs = () => {
    if (!prepPlan) return;
    try {
      const blob = new Blob([buildPrepIcs(prepPlan)], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contest-prep-${prepPlan.showDate}.ics`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
      flash(`Не удалось создать календарь: ${(e as Error).message}`);
    }
  };

  /** 📥 JSON-снапшот плана для тренера. */
  const handleExportPrepJson = () => {
    if (!prepPlan) return;
    try {
      const blob = new Blob([buildPrepCoachJson(prepPlan, { postShowLog: getPostShowLog(prepPlan.id) })], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contest-prep-${prepPlan.showDate}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
      flash(`Не удалось экспортировать: ${(e as Error).message}`);
    }
  };

  /** Э8: недельный отчёт тренеру (HTML) + CSV чек-инов. */
  const prepReportInput = () => {
    if (!prepPlan) return null;
    let checkins: PrepWeekCheckin[] = [];
    try { checkins = loadPrepWeekCheckins(prepPlan.id); } catch { /* ignore */ }
    let strengthDowns: Array<{ exercise: string; before: number; after: number; deltaPct: number }> = [];
    try { strengthDowns = prepStrengthTrend(loadSessions() as any, prepPlan); } catch { /* ignore */ }
    return { checkins, strengthDowns };
  };
  const handleExportWeeklyReport = () => {
    if (!prepPlan) return;
    const input = prepReportInput();
    if (!input) return;
    try {
      const blob = new Blob([buildPrepWeeklyReportHtml(prepPlan, input)], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contest-prep-report-${prepPlan.showDate}.html`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
      flash(`Не удалось экспортировать отчёт: ${(e as Error).message}`);
    }
  };
  const handleExportCheckinsCsv = () => {
    if (!prepPlan) return;
    const input = prepReportInput();
    if (!input) return;
    try {
      const blob = new Blob([buildPrepCheckinsCsv(input.checkins)], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contest-prep-checkins-${prepPlan.showDate}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
      flash(`Не удалось экспортировать CSV: ${(e as Error).message}`);
    }
  };

  // ── Test Peak Week: тестовый прогон НЕ меняет основной план ──
  const [testRatings, setTestRatings] = useState<Record<string, number>>({});
  const [testWeightDelta, setTestWeightDelta] = useState<number>(0);
  const [lastTest, setLastTest] = useState<ReturnType<typeof latestTestPeakWeek>>(null);
  const handleRunTestPeakWeek = () => {
    if (!prepPlan) return;
    const ratings = {
      carbTolerance: testRatings.carbTolerance ?? 3,
      digestion: testRatings.digestion ?? 3,
      fullness: testRatings.fullness ?? 3,
      waterRetention: testRatings.waterRetention ?? 3,
      pump: testRatings.pump ?? 3,
      sleep: testRatings.sleep ?? 3,
    };
    const t = saveTestPeakWeekResult(prepPlan.id, prepPlan.showDate, ratings, testWeightDelta);
    setLastTest(t);
    setPrepPlan(p => p ? { ...p, testPeakWeekId: t.id, updatedAt: new Date().toISOString() } : p);
    savePrepToProfile({ ...prepPlan, testPeakWeekId: t.id }, buildContestPrepConfig());
    flash(`✅ Тест пик-недели сохранён: ${t.verdict === 'tested_ok' ? 'протокол можно использовать' : t.verdict === 'adjust' ? 'нужна коррекция' : 'консервативный режим'}`);
  };

  // ⚖️ Ступенчатая адаптация подготовки по весу (одна переменная за раз).
  const weightAdvice = useMemo(() => {
    if (!prepPlan) return null;
    try {
      const goals = (linked.profile?.settings as any)?.goals;
      const targetW = Number(goals?.targetWeight) > 30 ? Number(goals.targetWeight) : undefined;
      return prepWeightAdvice(getWeightLog().map(e => ({ date: e.date, weight: e.weight })), prepPlan, { targetWeightKg: targetW });
    } catch { return null; }
  }, [prepPlan, linked.profile?.settings]);
  // 🤖 Адаптивный тапер (Э2): рекомендация недель тапера по sRPE/ACWR/усталости дневника.
  const adaptiveTaper = useMemo(() => {
    if (!prepPlan) return null;
    try {
      const srpe = loadSRPESessions().slice(-28);
      const acwrRaw = calculateACWR();
      const acwrRatio = Number.isFinite(acwrRaw) && acwrRaw > 0 ? acwrRaw : undefined;
      const fatigue = linked.readiness?.fatigue;
      const rec: BBTaperRecommendation = recommendBBTaperConfig({
        fatigue: typeof fatigue === 'number' ? fatigue : undefined,
        acwrRatio,
        recentSessions: srpe.map(s => ({ sRPE: s.sRPE })),
        baseWeeksOut: prepTaperWeeks,
      });
      const srpeStat = sRPEAdjustment(srpe.map(s => ({ sRPE: s.sRPE })));
      return { rec, acwrRatio, srpeN: srpe.length, srpeStat };
    } catch { return null; }
  }, [prepPlan, prepTaperWeeks, linked.readiness]);
  const handleApplyAdaptiveTaper = () => {
    if (!adaptiveTaper) return;
    const { rec } = adaptiveTaper;
    setPrepTaperWeeks(rec.weeksOut);
    if (rec.volumeMult < 1) setPrepVolumeMode(0.85);
    flash(`🤖 Адаптивный тапер применён: ${rec.weeksOut} нед${rec.volumeMult < 1 ? ' · режим ×0.85' : ''}. Пересоберите prep («Собрать и применить»).`);
  };
  const handleApplyWeightAdjustment = (caloriesDelta: number, cardioDelta: number) => {
    if (!prepPlan || !weightAdvice || weightAdvice.status === 'no_data') return;
    const next: BBContestPrepPlan = {
      ...prepPlan,
      updatedAt: new Date().toISOString(),
      preparation: {
        ...prepPlan.preparation,
        currentCalories: Math.max(1200, prepPlan.preparation.currentCalories + caloriesDelta),
        cardioMinutesPerWeek: Math.max(0, prepPlan.preparation.cardioMinutesPerWeek + cardioDelta),
      },
      adjustments: [
        ...(prepPlan.adjustments ?? []),
        {
          date: isoToday(),
          reason: weightAdvice.recommendation,
          caloriesDelta,
          cardioDelta,
          weightStatus: weightAdvice.status,
          source: 'user' as const,
        },
      ].slice(-20),
    };
    setPrepPlan(next);
    savePrepToProfile(next, buildContestPrepConfig());
    const parts: string[] = [];
    if (caloriesDelta !== 0) parts.push(`${caloriesDelta > 0 ? '+' : ''}${caloriesDelta} ккал`);
    if (cardioDelta !== 0) parts.push(`${cardioDelta > 0 ? '+' : ''}${cardioDelta} мин кардио/нед`);
    flash(`⚖️ Применено (одна переменная): ${parts.join(' · ')}. Эффект оценивайте через 5-7 дней по среднему весу.`);
  };

  // 🏁 Авто-восстановление сохранённого prep-плана после перезагрузки + миграция legacy.
  useEffect(() => {
    try {
      const migrated = migrateLegacyContestPrepIfNeeded({ prepWeeks: 12 });
      if (migrated) {
        setPrepPlan(migrated);
        setPrepShowDate(migrated.showDate);
        setPrepWeeks(migrated.preparation.weeks);
        setPrepTaperWeeks(migrated.taper.weeks);
        setPeakWeekCategory(migrated.category);
        setPrepWaterMode(migrated.peakWeek.waterMode === 'stable' ? 'stable' : 'tapered' as WaterStrategy);
        setPrepSodiumMode(migrated.peakWeek.sodiumMode === 'stable' ? 'stable' : 'tapered' as SodiumStrategy);
        setPrepCarbMode(migrated.peakWeek.carbMode === 'conservative' ? 'back' : migrated.peakWeek.carbMode === 'high' ? 'front' : 'moderate' as CarbLoadStrategy);
        if (migrated.preparation.volumeMult != null) setPrepVolumeMode(migrated.preparation.volumeMult);
        setLastTest(migrated.testPeakWeekId ? latestTestPeakWeek(migrated.id) : null);
        // Доп. поля из конфига
        try {
          const cfg = (migrated as any).__cfg as BBContestPrepConfig | undefined;
          if (cfg) {
            if (cfg.trainingProtocol) setPrepTrainingProtocol(cfg.trainingProtocol);
            setPrepPreferLowFiber(!!cfg.preferLowFiberCarbs);
            setPrepCreatineStop(cfg.creatineStrategy === 'stop');
            setPrepCompetitions(cfg.competitions);
            setPrepMainCompetitionId(cfg.mainCompetitionId);
          }
        } catch {}
        return;
      }
    } catch {}
    try {
      const prof = (linked.profile?.settings ?? {}) as any;
      const stored = planFromStored(prof?.goals?.bbContestPrepPlan, prof?.goals?.bbPeakConfig, prof?.goals, prof?.personal);
      if (!stored) return;
      setPrepPlan(stored);
      setPrepShowDate(stored.showDate);
      setPrepWeeks(stored.preparation.weeks);
      setPrepTaperWeeks(stored.taper.weeks);
      setPeakWeekCategory(stored.category);
      setPrepWaterMode(stored.peakWeek.waterMode === 'stable' ? 'stable' : 'tapered' as WaterStrategy);
      setPrepSodiumMode(stored.peakWeek.sodiumMode === 'stable' ? 'stable' : 'tapered' as SodiumStrategy);
      setPrepCarbMode(stored.peakWeek.carbMode === 'conservative' ? 'back' : stored.peakWeek.carbMode === 'high' ? 'front' : 'moderate' as CarbLoadStrategy);
      if (stored.preparation.volumeMult != null) setPrepVolumeMode(stored.preparation.volumeMult);
      setLastTest(stored.testPeakWeekId ? latestTestPeakWeek(stored.id) : null);
      // Доп. поля из сохранённого конфига
      try {
        const raw = prof?.goals?.bbPeakConfig as string | undefined;
        const cfg = raw ? deserializeBBPrepConfig(raw) : null;
        if (cfg) {
          if (cfg.trainingProtocol) setPrepTrainingProtocol(cfg.trainingProtocol);
          setPrepPreferLowFiber(!!cfg.preferLowFiberCarbs);
          setPrepCreatineStop(cfg.creatineStrategy === 'stop');
          setPrepCompetitions(cfg.competitions);
          setPrepMainCompetitionId(cfg.mainCompetitionId);
          if (cfg.specialization) setPeakSpec(cfg.specialization);
        }
      } catch {}
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Автосохранение выбранного сплита и последнего собранного плана.
  useEffect(() => {
    const persist = () => {
      try {
        localStorage.setItem('he_bb_auto_state_v1', JSON.stringify({
          selectedSplitId, bbDays, bbWeeks, bbLevel, bbGoal, bbTrainingFocus,
          bbMethodology, bbVolGoal, trainingVolumeMode, loadStrategy,
          autoDeload, deloadType, specBlocks, pedPhaseOverride, dcMode, volumeScheme,
        }));
        // BUG-FIX (выбор сплита): НЕ пишем he_bb_plan_saved отсюда — эффект срабатывает
        // на КАЖДУЮ смену параметров (в т.ч. selectedSplitId) и сохранял СТАРЫЙ builtPlan,
        // который потом авто-загружался (FIX-19) вместо только что выбранного сплита.
        // План сохраняется явно при сборке/сохранении/экспорте.
      } catch { /* storage may be unavailable */ }
    };
    persist();
    const onHidden = () => { if (document.visibilityState === 'hidden') persist(); };
    window.addEventListener('beforeunload', persist);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      persist();
      window.removeEventListener('beforeunload', persist);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, [selectedSplitId, bbDays, bbWeeks, bbLevel, bbGoal, bbTrainingFocus, bbMethodology, bbVolGoal, trainingVolumeMode, loadStrategy, autoDeload, deloadType, specBlocks, builtPlan, pedPhaseOverride, dcMode, volumeScheme]);
  // Кросс-синхронизация: правки из питания (saveContestPrepEverywhere source=planner) → обновить локальные состояния без пересборки плана
  useEffect(() => {
    const handler = () => {
      try {
        const prof = (linked.profile?.settings ?? {}) as any;
        const stored = planFromStored(prof?.goals?.bbContestPrepPlan, prof?.goals?.bbPeakConfig, prof?.goals, prof?.personal);
        if (!stored) return;
        // Не трогаем builtPlan — только мета-состояния шага contest
        setPrepPlan(prev => {
          if (prev && prev.id === stored.id && prev.updatedAt === stored.updatedAt) return prev;
          return stored;
        });
        setPrepShowDate(stored.showDate);
        setPrepWeeks(stored.preparation.weeks);
        setPrepTaperWeeks(stored.taper.weeks);
        setPeakWeekCategory(stored.category);
        setPrepWaterMode(stored.peakWeek.waterMode === 'stable' ? 'stable' : 'tapered' as WaterStrategy);
        setPrepSodiumMode(stored.peakWeek.sodiumMode === 'stable' ? 'stable' : 'tapered' as SodiumStrategy);
        setPrepCarbMode(stored.peakWeek.carbMode === 'conservative' ? 'back' : stored.peakWeek.carbMode === 'high' ? 'front' : 'moderate' as CarbLoadStrategy);
        if (stored.preparation.volumeMult != null) setPrepVolumeMode(stored.preparation.volumeMult);
        try {
          const raw = prof?.goals?.bbPeakConfig as string | undefined;
          const cfg = raw ? deserializeBBPrepConfig(raw) : null;
          if (cfg) {
            if (cfg.trainingProtocol) setPrepTrainingProtocol(cfg.trainingProtocol);
            setPrepPreferLowFiber(!!cfg.preferLowFiberCarbs);
            setPrepCreatineStop(cfg.creatineStrategy === 'stop');
            setPrepCompetitions(cfg.competitions);
            setPrepMainCompetitionId(cfg.mainCompetitionId);
            if (cfg.specialization) setPeakSpec(cfg.specialization);
          }
        } catch {}
      } catch {}
    };
    window.addEventListener(CONTEST_PREP_UPDATED_EVENT as any, handler);
    window.addEventListener('he-bb-contest-prep-updated' as any, handler);
    return () => {
      window.removeEventListener(CONTEST_PREP_UPDATED_EVENT as any, handler);
      window.removeEventListener('he-bb-contest-prep-updated' as any, handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /** Конфиг тапера для кнопки «🎭 Peak week»: профиль (goals.bbPeakConfig/legacy)
   *  с переопределением категории и специализации выбранными в UI. */
  const buildPeakConfig = (): BBContestPrepConfig => {
    const prof = (linked.profile?.settings ?? {}) as any;
    const catProfile = CATEGORY_PROFILES[peakWeekCategory] ?? CATEGORY_PROFILES.mens_physique;
    const sex: 'male' | 'female' = catProfile.sex;
    const stored = prof?.goals?.bbPeakConfig ? deserializeBBPrepConfig(prof.goals.bbPeakConfig) : null;
    const legacy = stored ? null : legacyConfigFromProfile(prof?.goals, prof?.personal);
    const base = stored ?? legacy;
    if (base) return { ...base, category: peakWeekCategory, sex, specialization: peakSpec };
    return {
      sex,
      category: peakWeekCategory,
      weightKg: Math.max(40, Math.min(200, Number(prof?.personal?.weight) || 80)),
      bodyFatPct: Number(prof?.personal?.bodyFat) > 0 ? Number(prof?.personal?.bodyFat) : undefined,
      experienceLevel: 'intermediate',
      enhanced: false,
      prepCount: 0,
      showDate: isoAddDays(isoToday(), 7),
      weeksOut: 3,
      trainingProtocol: 'bb',
      carbLoadStrategy: 'moderate',
      waterStrategy: 'stable',
      sodiumStrategy: 'stable',
      specialization: peakSpec,
    };
  };

  const applyPeakWeekToCurrentPlan = (category: BBContestCategory, spec: ContestSpecialization = peakSpec) => {
    setPeakWeekCategory(category);
    setPeakSpec(spec);
    // Единый путь: вести на шаг Contest Prep (полный тапер), а не deprecated overlay
    setStep('contest');
    flash('→ Шаг «🏁 Contest Prep»: настройте полный тапер и пик-неделю, затем «Собрать и применить»');
  };
  // PRO: per-muscle frequency optimization
  const [freqOptResult, setFreqOptResult] = useState<FrequencyOptimizationResult | null>(null);
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

  // Подписка на planner-bridge: приём программ + слабые группы/ПМ для ББ-авто (маршрутизация по источнику)
  useEffect(() => {
    const unsub = subscribePlannerApply((payload) => {
      if (!payload || !payload.data) return;
      const src = (payload as any).source as string | undefined;
      const targetId = (payload as any).targetCycleId as string | undefined;
      if (src === 'pl-auto') return;
      if (src === 'intellectual' && targetId) {
        const c = getCycleById(targetId);
        if (c && normalizeCycleDirection(c.meta.direction) !== 'bodybuilding') return;
      }
      if (payload.kind === 'program' && payload.data) {
        const cycle = payload.data as SRCycleTemplate;
        // Legacy SRCycleTemplate из bridge теперь трактуем как программу (только FullProgram путь)
        // Для совместимости маппим на программу-заглушку через library path (faithful)
        setCustomProgram(null);
        setCustomCycle(cycle);
        setPlanMode('programs');
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
      } else if (payload.kind === 'weakpoints' && (() => {
        const d = payload.data as WeakpointsPayload;
        // 3.9: принимаем любой из источников групп (гранулярные → канонические → общие).
        return Array.isArray(d.weakZonesGranular) || Array.isArray(d.weakMusclesCanonical)
          || Array.isArray(d.weakPoints) || Array.isArray(d.groups);
      })()) {
        const bbDiag = payload.data as WeakpointsPayload;
        // 3.9: гранулярные зоны приоритетны, но канонические/общие группы — честный fallback.
        const groups = (bbDiag.weakZonesGranular ?? bbDiag.weakMusclesCanonical ?? bbDiag.weakPoints ?? bbDiag.groups) as string[];
        const normalized = normalizeSpecializationTargets(groups.slice(0, 2));
        if (normalized.length > 0) {
          setSpecBlocks([{ id: 'spec-block-1', weeks: 5, targets: normalized, tradeoffMode: 'none' as const, donors: [] }]);
          setBridgeMsg(`🔗 Слабые группы → ББ-авто: ${normalized.join(', ')}`);
          setTimeout(() => setBridgeMsg(''), 4000);
        }
        const pref = bbDiag.preferredExerciseIds;
        if (Array.isArray(pref) && pref.length) {
          const clean = pref.map(s => String(s).toLowerCase().trim()).filter(Boolean).slice(0, 8);
          setPreferredExerciseIds(clean);
          try { localStorage.setItem('he_bb_preferred_exercises', JSON.stringify(clean)); } catch {}
          setBridgeMsg((prev: string) => prev ? `${prev} · упр: ${clean.join(', ')}` : `🔗 Упражнения → ББ-авто: ${clean.join(', ')}`);
          setTimeout(() => setBridgeMsg(''), 5000);
        }
        const swap = bbDiag.exerciseSwap;
        if (swap && swap.oldId && swap.newId) {
          const entry = { oldId: String(swap.oldId).toLowerCase(), newId: String(swap.newId).toLowerCase() };
          setExerciseSwaps(prev => {
            const next = [...prev.filter(p => p.oldId !== entry.oldId), entry].slice(-8);
            try { localStorage.setItem('he_bb_exercise_swaps', JSON.stringify(next)); } catch {}
            return next;
          });
          setBridgeMsg((prev: string) => prev ? `${prev} · замена ${entry.oldId}→${entry.newId}` : `🔗 Замена → ББ-авто: ${entry.oldId}→${entry.newId}`);
          setTimeout(() => setBridgeMsg(''), 5000);
        }
        // Lab-добивка 7 + п.2: labDelta персистим, показываем и дописываем в rationale
        // уже собранного плана (порядок «сборка→применение» иначе терял Δ; дедуп по строке).
        const labDelta = bbDiag.labDelta as { summary?: unknown } | null | undefined;
        if (labDelta && typeof labDelta === 'object') {
          try { localStorage.setItem('he_bb_last_lab_delta', JSON.stringify(labDelta)); } catch {}
          if (typeof labDelta.summary === 'string' && labDelta.summary) {
            const deltaLine = `Δ лаб. коррекции: ${labDelta.summary}`;
            setBridgeMsg((prev: string) => prev ? `${prev} · Δ ${labDelta.summary}` : `🔗 Δ-коррекция из лаборатории: ${labDelta.summary}`);
            setTimeout(() => setBridgeMsg(''), 5000);
            try {
              setBuiltPlan((prev) => {
                if (!prev || !Array.isArray((prev as { weeks?: unknown }).weeks)) return prev;
                const rat = Array.isArray((prev as { rationale?: unknown }).rationale)
                  ? (prev as { rationale: string[] }).rationale
                  : [];
                if (rat.some((r) => r === deltaLine)) return prev;
                return { ...prev, rationale: [...rat, deltaLine] };
              });
            } catch { /* план тронется при следующей сборке (build-time ветка) */ }
          }
        }
        const labCorr = bbDiag.labCorrection;
        if (labCorr && labCorr.type) {
          setExecutionCorrections(prev => {
            const next = [...prev.filter(p => p.type !== labCorr.type || p.targetId !== labCorr.targetId), labCorr].slice(-8);
            try { localStorage.setItem('he_bb_execution_corrections', JSON.stringify(next)); } catch {}
            return next;
          });
          setBridgeMsg((prev: string) => prev ? `${prev} · корр ${labCorr.type}` : `🔗 Коррекция → ББ-авто: ${labCorr.type}${labCorr.targetName ? ` ${labCorr.targetName}` : ''}`);
          setTimeout(() => setBridgeMsg(''), 5000);
        }
        // MAX PRO: спец-блок из диагностики (недели/доноры/dayMap) + причины.
        // Форма свободная (unknown) — валидируем перед применением.
        const specRaw = bbDiag.specBlock as { lengthWeeks?: unknown; donors?: unknown } | null | undefined;
        if (specRaw && typeof specRaw === 'object' && normalized.length > 0) {
          const wks = Math.max(3, Math.min(6, Math.round(typeof specRaw.lengthWeeks === 'number' ? specRaw.lengthWeeks : 5)));
          const donors = Array.isArray(specRaw.donors) ? specRaw.donors.map((d) => String(d)).slice(0, 2) : [];
          setSpecBlocks([{ id: 'spec-block-1', weeks: wks, targets: normalized, tradeoffMode: donors.length ? 'reduce_direct_to_floor' as const : 'none' as const, donors }]);
          setBridgeMsg((prev: string) => prev ? `${prev} · спец-блок ${wks} нед` : `🔗 Спец-блок → ББ-авто: ${wks} нед`);
          setTimeout(() => setBridgeMsg(''), 5000);
        }
        // Слабые головки стимула — persist для будущих сборок и смены углов
        const heads = bbDiag.weakHeads;
        if (Array.isArray(heads) && heads.length) {
          const clean = heads.map((h) => String(h).toLowerCase().trim()).filter(Boolean).slice(0, 2);
          try { localStorage.setItem('he_bb_last_weak_heads', JSON.stringify(clean)); } catch {}
          setBridgeMsg((prev: string) => prev ? `${prev} · головки ${clean.join(', ')}` : `🔗 Головки → ББ-авто: ${clean.join(', ')}`);
          setTimeout(() => setBridgeMsg(''), 5000);
        }
        // PRO-2: L/R, готовность, флаги, штанга, поза, teen — только сохраняем, сборку не меняем
        const pro2parts: string[] = [];
        if (Array.isArray(bbDiag.lrVerdicts) && bbDiag.lrVerdicts.length) {
          const worst = bbDiag.lrVerdicts.filter((v) => v && (v.verdict === 'topup' || v.verdict === 'watch'))[0];
          if (worst) pro2parts.push(`L/R ${worst.group}: ${worst.text}`);
        }
        if (bbDiag.readiness && typeof bbDiag.readiness === 'object' && (bbDiag.readiness as { level?: unknown }).level) {
          pro2parts.push(`готовность ${(bbDiag.readiness as { level: string }).level}`);
        }
        if (bbDiag.redFlags && typeof bbDiag.redFlags === 'object' && Array.isArray((bbDiag.redFlags as { items?: unknown }).items)) {
          if ((bbDiag.redFlags as { blocked?: boolean }).blocked) pro2parts.push('⛔ флаги — только техника');
        }
        if (typeof bbDiag.teenNote === 'string' && bbDiag.teenNote) {
          pro2parts.push('🧒 teen-режим');
        }
        // J7 орто-скрининг: гарды ПРИМЕНЯЮТСЯ (не только сохраняются).
        // Решение — чистая decideBbOrthoIntake (прямой тест); здесь только сеттеры/персист/тост.
        // pauseOverhead/limitDeepSquat → mobilityRestrictions (живой фильтр пула);
        // Beighton closedChainOnly / teen → light + без отказных + повторы + раскрытия из пула + авто-делод.
        const dec = decideBbOrthoIntake({ orthoGuards: (bbDiag as any).orthoGuards, teenNote: (bbDiag as any).teenNote }, loadStrategy);
        if (dec.active) {
            if (dec.mobAdd.length) {
              setMobilityRestrictions((prev) => Array.from(new Set([...prev, ...dec.mobAdd])));
              try { localStorage.setItem('he_bb_ortho_mobility', JSON.stringify(dec.mobAdd)); } catch {}
              pro2parts.push(`🦴 орто-гарды: ${dec.mobAdd.join('+')} → фильтр пула`);
            }
            if (dec.light) setIntensityLevel('light');
            if (dec.deload) setAutoDeload(true);
            if (dec.techNone) setIntensityTech('none');
            // Э4 teen hard ban: только standard-объём (никаких GVT/FST-памп-схем подростку)
            if (dec.stdVolume && volumeScheme !== 'standard') {
              setVolumeScheme('standard');
              pro2parts.push('🧒 teen: только standard-объём');
            }
            if (dec.forceDouble) {
              setLoadStrategy('double_progression');
              try { userTouched.current.loadStrategy = true; } catch {}
            }
            if (dec.excludeRisky) {
              const risky = riskyOpenChainIds(EXERCISE_CATALOG as any, 40);
              if (risky.length) {
                setBbExclEx((prev) => Array.from(new Set([...prev, ...risky])));
                try { localStorage.setItem('he_bb_ortho_excluded', JSON.stringify(risky)); } catch {}
              }
              pro2parts.push(`🦴 Beighton+: light + без отказных + повторы + ${risky.length} раскрытий исключено`);
            }
          }
        if (Array.isArray(bbDiag.orthoFlags) && bbDiag.orthoFlags.length) {
          if (typeof bbDiag.orthoSummary === 'string' && bbDiag.orthoSummary) pro2parts.push(`🦴 ${bbDiag.orthoSummary.slice(0, 80)}`);
        }
        // Э3: мост без орто-полей снимает ранее отслеженные гарды (только свои id — чужое/своё юзера цело).
        if (!dec.active) {
          let cleaned = 0;
          try {
            const tm: unknown = JSON.parse(localStorage.getItem('he_bb_ortho_mobility') || '[]');
            const te: unknown = JSON.parse(localStorage.getItem('he_bb_ortho_excluded') || '[]');
            if (Array.isArray(tm) && tm.length) {
              setMobilityRestrictions((prev) => subtractTracked(prev, tm));
              cleaned += tm.length;
            }
            if (Array.isArray(te) && te.length) {
              setBbExclEx((prev) => subtractTracked(prev, te));
              cleaned += te.length;
            }
            localStorage.removeItem('he_bb_ortho_mobility');
            localStorage.removeItem('he_bb_ortho_excluded');
          } catch {}
          if (cleaned) pro2parts.push(`🦴 орто-гарды сняты (${cleaned})`);
        }
        // PRO-3 R2: L/R-добивка и острая готовность ПРИМЕНЯЮТСЯ (к вставке коррекций,
        // не к мезоциклу — острая готовность не должна переписывать структуру блока).
        // Остальное (LVP/сухожилия/return-to/MMC/веса) — сохраняется + тост, сборку не меняет.
        if (bbDiag.lvp && typeof bbDiag.lvp === 'object' && (bbDiag.lvp as { text?: unknown }).text) {
          pro2parts.push(`LVP ${(bbDiag.lvp as { text: string }).text}`);
        }
        if (bbDiag.tendon && typeof bbDiag.tendon === 'object') {
          const t = bbDiag.tendon as { elbowLevel?: string; shoulderLevel?: string };
          if (t.elbowLevel === 'stop' || t.shoulderLevel === 'stop') pro2parts.push('⛔ сухожилия — стоп');
        }
        if (bbDiag.returnTo && typeof bbDiag.returnTo === 'object' && (bbDiag.returnTo as { text?: unknown }).text) {
          pro2parts.push('возврат 3 ступени');
        }
        if (bbDiag.readinessAction && typeof bbDiag.readinessAction === 'object') {
          const ra = bbDiag.readinessAction as { level?: string; volumeMult?: number; rirShift?: number };
          if (ra.level === 'red') pro2parts.push(`готовность red → вставка ×${ra.volumeMult ?? 0.75} RIR+${ra.rirShift ?? 1}`);
        }
        if (bbDiag.lrTopUp && typeof bbDiag.lrTopUp === 'object' && Object.keys(bbDiag.lrTopUp).length) {
          const clean: Record<string, { side: 'left' | 'right'; sets: number }> = {};
          for (const [k, v] of Object.entries(bbDiag.lrTopUp as Record<string, any>)) {
            if (v && ((v as any).side === 'left' || (v as any).side === 'right')) {
              clean[String(k)] = { side: (v as any).side, sets: Math.max(1, Math.min(3, Math.round(Number((v as any).sets) || 1))) };
            }
          }
          setLrTopUp(clean);
          try { localStorage.setItem('he_bb_lr_topup', JSON.stringify(clean)); } catch {}
          const names = Object.entries(clean).map(([g, v]) => `${g}: ${v.side === 'left' ? 'левая' : 'правая'} +${v.sets}`).join(', ');
          if (names) pro2parts.push(`добивка слабой ${names} → в сборку`);
        } else if (bbDiag.lrTopUp && typeof bbDiag.lrTopUp === 'object') {
          // перекос закрыт — чистим добивку, чтобы не висела на сборках
          setLrTopUp({});
          try { localStorage.removeItem('he_bb_lr_topup'); } catch {}
        }
        if (typeof bbDiag.workingRange === 'string' && bbDiag.workingRange) {
          pro2parts.push('рабочий вес-ориентир');
        }
        if (bbDiag.returnAction && typeof bbDiag.returnAction === 'object' && Number.isFinite((bbDiag.returnAction as any).volumeMult)) {
          const ra2 = bbDiag.returnAction as { volumeMult: number; rirShift: number; bannedPatterns: string[] };
          const clean2 = { volumeMult: Math.max(0, Math.min(1, Number(ra2.volumeMult))), rirShift: Math.max(0, Math.min(3, Math.round(Number(ra2.rirShift) || 0))), bannedPatterns: Array.isArray(ra2.bannedPatterns) ? ra2.bannedPatterns.map((x) => String(x)) : [] };
          setReturnAction(clean2);
          try { localStorage.setItem('he_bb_return_action', JSON.stringify(clean2)); } catch {}
          if (clean2.volumeMult <= 0) pro2parts.push('↩ возврат: ступень 1 — только техника');
          else if (clean2.volumeMult < 1) pro2parts.push(`↩ возврат: ступень 2 — ×${clean2.volumeMult} RIR+${clean2.rirShift}`);
        } else if (bbDiag.returnStage != null) {
          // ступень без флага — чистим возврат
          setReturnAction(null);
          try { localStorage.removeItem('he_bb_return_action'); } catch {}
        }
        // 3.9: ранее неиспользуемые payload-поля диагностики сводим в одну строку моста —
        // ничего не приходит «в никуда» (payload↔потребитель 1:1, без плановых изменений).
        const diagBits: string[] = [];
        if (typeof bbDiag.bbDiagScore === 'number' && Number.isFinite(bbDiag.bbDiagScore)) diagBits.push(`скор ${Math.round(bbDiag.bbDiagScore)}`);
        if (typeof bbDiag.bbDiagLevel === 'string' && bbDiag.bbDiagLevel) diagBits.push(`уровень ${bbDiag.bbDiagLevel}`);
        if (typeof bbDiag.verification === 'number' && Number.isFinite(bbDiag.verification)) diagBits.push(`вериф ${Math.round(bbDiag.verification <= 1 ? bbDiag.verification * 100 : bbDiag.verification)}%`);
        else if (typeof bbDiag.verification === 'string' && bbDiag.verification) diagBits.push(`вериф ${bbDiag.verification}`);
        const symD = bbDiag.symmetry as { score?: number; asymPct?: number; verdict?: string } | null | undefined;
        if (symD && typeof symD === 'object') {
          if (Number.isFinite(symD.asymPct)) diagBits.push(`асимметрия ${Math.round(Number(symD.asymPct))}%`);
          else if (Number.isFinite(symD.score)) diagBits.push(`симметрия ${Math.round(Number(symD.score))}`);
          else if (symD.verdict) diagBits.push(`симметрия ${symD.verdict}`);
        }
        const stD = bbDiag.stimulus as { score?: number; verdict?: string } | null | undefined;
        if (stD && typeof stD === 'object') {
          if (Number.isFinite(stD.score)) diagBits.push(`стимул ${Math.round(Number(stD.score))}`);
          else if (stD.verdict) diagBits.push(`стимул ${stD.verdict}`);
        }
        if (bbDiag.perMuscleAcwr && typeof bbDiag.perMuscleAcwr === 'object') {
          const hot = Object.entries(bbDiag.perMuscleAcwr).find(([, v]) => v && (v.zone === 'dangerous' || v.zone === 'caution'));
          if (hot && hot[1]) diagBits.push(`ACWR ${hot[0]} ${Number(hot[1].ratio).toFixed(2)}`);
        }
        const ohsD = bbDiag.ohs as { totalScore?: number } | null | undefined;
        if (ohsD && typeof ohsD === 'object' && Number.isFinite(ohsD.totalScore)) diagBits.push(`OHS ${Math.round(Number(ohsD.totalScore))}`);
        const vbtD = bbDiag.vbt as { lossPct?: number } | null | undefined;
        if (vbtD && typeof vbtD === 'object' && Number.isFinite(vbtD.lossPct)) diagBits.push(`VBT −${Math.round(Number(vbtD.lossPct))}%`);
        if (typeof bbDiag.sleepHours === 'number' && Number.isFinite(bbDiag.sleepHours)) diagBits.push(`сон ${bbDiag.sleepHours}ч`);
        const labD = bbDiag.labDiagnosis as { summary?: unknown; type?: unknown } | null | undefined;
        if (labD && typeof labD === 'object') {
          const s = typeof labD.summary === 'string' ? labD.summary : (typeof labD.type === 'string' ? labD.type : 'есть');
          diagBits.push(`лаб-диагноз: ${s}`);
        }
        const bpD = bbDiag.barPath as { type?: string } | null | undefined;
        if (bpD && typeof bpD === 'object' && bpD.type) diagBits.push(`траектория ${bpD.type}`);
        if (bbDiag.poseAngles && typeof bbDiag.poseAngles === 'object') diagBits.push('углы позы');
        const causesD = bbDiag.weakCauses as Record<string, unknown> | null | undefined;
        if (causesD && typeof causesD === 'object') {
          const n = Object.keys(causesD).length;
          if (n) diagBits.push(`причины×${n}`);
        }
        if (Array.isArray(bbDiag.lrDirection) && bbDiag.lrDirection.length) {
          const first = bbDiag.lrDirection[0] as { text?: unknown } | undefined;
          if (first && typeof first.text === 'string') diagBits.push(`L/R: ${first.text}`);
        }
        if (typeof bbDiag.mmc === 'string' && bbDiag.mmc) diagBits.push('MMC-акцент');
        if (diagBits.length) pro2parts.push(`диагностика: ${diagBits.join(', ')}`);
        if (pro2parts.length) {
          setBridgeMsg((prev: string) => prev ? `${prev} · ${pro2parts.join(' · ')}` : `🔗 Диагностика PRO-3: ${pro2parts.join(' · ')}`);
          setTimeout(() => setBridgeMsg(''), 5000);
        }
      } else if (payload.kind === 'pm' && payload.data) {
        const d: any = payload.data;
        const patch: Record<string, number> = {};
        if (d.lift === 'squat' && typeof d.value === 'number') patch.quads = d.value;
        else if (d.lift === 'bench' && typeof d.value === 'number') patch.chest = d.value;
        else if (d.lift === 'dead' && typeof d.value === 'number') patch.hamstrings = d.value;
        if (typeof d.squat === 'number') patch.quads = d.squat;
        if (typeof d.bench === 'number') patch.chest = d.bench;
        if (typeof d.dead === 'number') patch.hamstrings = d.dead;
        if (Object.keys(patch).length) {
          setBbWorkMax(prev => ({ ...prev, ...patch }));
          setBridgeMsg(`🔗 ПМ → ББ-авто: ${Object.entries(patch).map(([k, v]) => `${k} ${v}кг`).join(', ')}`);
          setTimeout(() => setBridgeMsg(''), 4000);
        }
      }
    });
    return () => { unsub(); };
  }, []);

  // Применение готовой программы из библиотеки (единственный путь: FullProgram → programToBBPlan faithful/adapt).
  // Все программы (FULL_PROGRAM_LIBRARY + WOMENS + CUSTOM_PROGRAMS + cycle-bb-*) идут через один путь.
  const applyProgramToBb = useCallback((program: FullProgram) => {
    setBbAdaptMode('faithful');
    setCustomProgram(program);
    setCustomCycle(null);
    setBbProgramPath('library');
    setPlanMode('programs');
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
    setBridgeMsg(`🔗 Программа загружена: ${program.name} (режим: библиотека, faithful + адаптация)`);
    setTimeout(() => setBridgeMsg(''), 5000);
    setStep('params');
  }, []);

  const phases = useMemo(() => computePhases(bbWeeks, bbGoal), [bbWeeks, bbGoal]);

  const autoRegResult = useMemo(() => {
    const rec = linked.readiness?.recovery ?? 80;
    const fat = linked.readiness?.fatigue ?? 30;
    const sleep = linked.readiness?.sleep ?? 70;
    const hrv = linked.profile?.settings?.baselineHrvRatio ?? 1.0;
    const srpe = loadSRPESessions();
    const acwr = srpe.length >= 2 ? acuteChronicRatio(toDailyLoads(srpe)) : { ratio: 1.0, zone: 'optimal' as const };
    const legacy = autoRegulate({ readiness: rec, acwr: { ratio: acwr.ratio, zone: acwr.zone }, fatigue: fat, hrvRatio: hrv, sleepScore: sleep, plannedTopSetPct: 0.8, plannedRIR: 2 });
    const lifestyle = linked.profile?.settings?.lifestyle;
    const readiness = assessReadiness({
      hrvMs: lifestyle?.morningHRV,
      hrvBaseline: lifestyle?.morningHRV && lifestyle?.baselineHrvRatio ? lifestyle.morningHRV / lifestyle.baselineHrvRatio : undefined,
      sleepHours: lifestyle?.sleepHours,
      stressLevel: lifestyle?.stressLevel,
      subjectiveReadiness: linked.readiness?.recovery ? linked.readiness.recovery / 10 : undefined,
    });
    const override = getAutoRegulationOverride(readiness);
    return {
      ...legacy,
      volumeMultiplier: Math.min(legacy.volumeMultiplier, override.volumeMultiplier),
      topSetPctMultiplier: legacy.topSetPctMultiplier * override.intensityMultiplier,
      rirShift: Math.max(legacy.rirShift, override.rirShift),
      deload: legacy.deload || readiness.action === 'rest',
      decisions: [...legacy.decisions, ...readiness.recommendations.slice(0, 2)],
      readinessLevel: readiness.level,
      readinessScore: readiness.score,
    };
  }, [linked.readiness, linked.profile?.settings]);

  const ranked = useMemo(() => rankBBSplits({
    level: bbLevel,
    goal: bbGoal as any,
    daysPerWeek: bbDays,
    weakPoints: weakPoints.length > 0 ? weakPoints : undefined,
    sex: linked.profile?.settings?.personal?.sex,
    focusGroup: specTargets[0] || undefined,
    donorMuscles: specBlocks.flatMap(b => b.donors),
    specialization: specTargets.length > 0,
    peds,
    pedDoses,
    equipment: bbEquipment,
    injuries,
    mobilityRestrictions,
    preset: proPreset,
  }), [bbLevel, bbGoal, bbDays, weakPoints, specBlocks, specTargets, linked.profile?.settings?.personal?.sex, peds, pedDoses, bbEquipment, injuries, mobilityRestrictions, proPreset]);
  const bestSplit = ranked[0];
  useEffect(() => { if (bestSplit && !selectedSplitId && !splitTouched.current) setSelectedSplitId(bestSplit.pattern.id); }, [bestSplit, selectedSplitId]);

  const allLandmarks = useMemo(() => getAllVolumeLandmarks(bbLevel), [bbLevel]);
  // Расчётный объём целей специализации для подсказки: цель = MAV × (1.0 + 0.1×зон)
  // (1 зона ×1.1, 2 зоны одной мышцы ×1.2 — как в движке). Остальные — MEV.
  const specVolumeSummary = useMemo(() => {
    if (specTargets.length === 0) return '';
    const RU: Record<string, string> = { chest: 'Грудь', back: 'Спина', quads: 'Квадры', hamstrings: 'Бицепс бедра', shoulders: 'Плечи', biceps: 'Бицепс', triceps: 'Трицепс', calves: 'Икры', glutes: 'Ягодицы', abs: 'Пресс', traps: 'Трапеции', forearms: 'Предплечья' };
    const parts: string[] = [];
    const byRegion = new Map<string, string[]>();
    for (const t of specTargets) {
      const c = canonicalMuscle(t);
      const zones = byRegion.get(c) || [];
      zones.push(t);
      byRegion.set(c, zones);
    }
    for (const [c, zones] of byRegion) {
      const lm = (allLandmarks as Record<string, { mav: number }>)[c];
      if (!lm) continue;
      const mult = Math.min(1.3, 1.0 + 0.1 * zones.length);
      const label = RU[c] || c;
      const zoneText = zones.length > 1
        ? ` (${zones.length} зоны: ${zones.map(t => WEAK_GROUPS.find(([id]) => id === t)?.[1] || t).join(' + ')})`
        : '';
      parts.push(`${label} ≈${Math.round(lm.mav * mult)} сетов/нед${zoneText}`);
    }
    return parts.join(' · ');
  }, [specTargets, allLandmarks]);
  // Чип недоступен: достигнут лимит 2 целей ИЛИ конфликт региона
  // (shoulders + delt_mid нельзя; delt_mid + delt_rear можно).
  const specChipDisabled = (targets: string[], id: string, on: boolean) =>
    !!on ? false : targets.length >= 2 || targets.some(t => isRegionConflict(t, id));
  const pedAdapt = useMemo(() => adaptForPEDs(peds, Object.fromEntries(Object.entries(allLandmarks).map(([m, v]) => [m, v.mrv])), pedDoses, courseIntensity), [peds, allLandmarks, pedDoses, courseIntensity]);
  // Режим-множитель (×2 на курсе) — масштабирует MRV-капы в карточке muscle volume
  // под реальный режим (а не натуральный), чтобы карточка совпадала с планом.
  const regimeMrvMult = computeRegimeMrvMult({ onCourse: peds.length > 0, courseIntensity });
  // ACWR — единый расчёт для всего качества (пороги 1.3/1.5)
  const acwrData = useMemo(() => {
    try {
      const srpe = loadSRPESessions();
      if (srpe.length < 2) return null;
      return acuteChronicRatio(toDailyLoads(srpe));
    } catch { return null; }
  }, [builtPlan]);
  const metrics = useMemo(() => builtPlan ? calcBBPlanMetrics(builtPlan, 1) : null, [builtPlan]);
  // Epic F: единый отчёт качества (агрегирует validation/balance/rotation/safety, дедуп).
  const qualityReport = useMemo(() => {
    if (!builtPlan) return null;
    const personal = linked.profile?.settings?.personal;
    const lifestyle = linked.profile?.settings?.lifestyle;
    return buildBBQualityReport(builtPlan as any, {
      acwrRatio: acwrData ? acwrData.ratio : undefined,
      bodyFat: personal?.bodyFat,
      hrvMs: lifestyle?.morningHRV,
      sleepHours: lifestyle?.sleepHours,
      stressLevel: lifestyle?.stressLevel,
      injuries: injuries.map(i => ({ muscle: i.muscle, exclude: i.exclude })),
      mobilityRestrictions,
    });
  }, [builtPlan, linked.profile, acwrData, injuries, mobilityRestrictions]);
  // Quality Hub PRO: V2-панель (аддитивно к S5 — S5 считается и показывается как раньше).
  // Монотония Foster из того же дневника sRPE, что и ACWR.
  const srpeMonotony = useMemo(() => {
    try {
      const srpe = loadSRPESessions();
      if (srpe.length < 3) return null;
      return sRPEAdjustment(srpe);
    } catch { return null; }
  }, [builtPlan]);
  const bbQualityV2 = useMemo(() => {
    if (!builtPlan) return null;
    try {
      return bbPlanQualityV2(builtPlan as any, {
        level: bbLevel,
        specTargets,
        acwrRatio: acwrData?.ratio ?? null,
        monotony: srpeMonotony?.monotony ?? null,
        hasDiary: acwrData != null,
      });
    } catch { return null; }
  }, [builtPlan, bbLevel, specTargets, acwrData, srpeMonotony]);
  const todayBadge = useMemo(() => {
    if (acwrData == null) return null;
    const acwr = acwrData.ratio;
    if (acwr > 1.5) return '🔴 Сегодня — снизить объём (ACWR выше 1.5)';
    if (acwr < 0.6) return '🔵 Сегодня — лёгкий день / техника (ACWR ниже 0.6)';
    if (srpeMonotony != null && srpeMonotony.monotony > 2) return '🟡 Сегодня — варьируйте нагрузку (монотония выше 2)';
    return '🟢 Сегодня — можно по плану';
  }, [acwrData, srpeMonotony]);
  const safetyScore = useMemo<PlanSafetyScore | null>(() => {
    if (!builtPlan) return null;
    const personal = linked.profile?.settings?.personal;
    const lifestyle = linked.profile?.settings?.lifestyle;
    return calculatePlanSafetyScore(builtPlan, {
      acwrRatio: acwrData?.ratio,
      bodyFat: personal?.bodyFat,
      hrvMs: lifestyle?.morningHRV,
      sleepHours: lifestyle?.sleepHours,
      stressLevel: lifestyle?.stressLevel,
      injuryCount: injuries.length,
      injuries,
      mobilityRestrictions,
      balanceReport: (builtPlan as any).balanceReport || null,
      weeklySessions: builtPlan.weeks[0]?.sessions.length ?? 4,
      goal: bbGoal,
    });
  }, [builtPlan, linked.profile, injuries, mobilityRestrictions, acwrData, bbGoal]);
  // Понедельная оценка качества: факт выдачи × параметры плана (две шкалы, не суммируются).
  // A «Объём и соответствие» — факт недели vs собственные цели/капы/параметры плана.
  // B «PRO-техника» — факт исполнения недели (паттерны/углы/растяжка/техники).
  // Вид: конкретная неделя (по правилам её фазы) или 'avg' (среднее понедельных).
  const quality = useMemo(() => {
    if (!builtPlan) return null;
    try {
      const totalW = builtPlan.weeks.length || 1;
      const qw: number | 'avg' = qualityWeek === 'avg' ? 'avg' : Math.min(Math.max(1, qualityWeek), totalW);
      const avg = averageWeeklyScores(builtPlan as any);
      let selVolume: ReturnType<typeof scoreVolumeWeek>;
      let selPro: ReturnType<typeof scoreProWeek>;
      let viewTag: string;
      if (qw === 'avg') {
        viewTag = `среднее · ${avg.weeks} нед`;
        selVolume = {
          week: 0, phase: 'среднее', isDeload: false, isTaper: false,
          score: avg.avgVolume, grade: gradeFor(avg.avgVolume),
          issues: avg.recurringVolumeIssues, muscles: avg.avgMuscles, balance: [],
          recommendations: avg.recurringVolumeIssues.filter(i => i.severity !== 'info').slice(0, 5).map(i => `→ ${i.message} [${i.source}]`),
        };
        const meso = scoreProWeek(builtPlan as any, 'meso');
        // Число — среднее понедельных PRO; детали — агрегат мезоцикла (факт).
        selPro = { ...meso, score: avg.avgPro, grade: gradeFor(avg.avgPro) };
      } else {
        viewTag = `нед ${qw}/${totalW}`;
        selVolume = scoreVolumeWeek(builtPlan as any, qw);
        selPro = scoreProWeek(builtPlan as any, qw);
      }
      const recommendations = [
        ...selVolume.issues.filter(i => i.severity !== 'info').slice(0, 4).map(i => `→ ${i.message} [${i.source}]`),
        ...selPro.totalRecommendations.slice(0, 2),
      ];
      // Фактический делод из плана (не тоггл autoDeload) — читает экспортная карточка.
      const hasDeloadActual = builtPlan.weeks.some((w: any) => w.deload || String(w.phase || '').toLowerCase() === 'deload');
      const deloadWeeksActual = builtPlan.weeks.filter((w: any) => w.deload || String(w.phase || '').toLowerCase() === 'deload').map((w: any) => w.week).filter(Boolean);
      return {
        mode: qw, viewTag,
        avgVolume: avg.avgVolume, volumeLabel: gradeFor(avg.avgVolume),
        avgPro: avg.avgPro, proLabel: gradeFor(avg.avgPro),
        perWeek: avg.perWeek,
        viewVolume: selVolume.score, viewPro: selPro.score,
        selVolume, selPro,
        recommendations,
        hasDeloadActual, deloadWeeksActual,
        // back-compat для мест, читающих старые поля:
        score: selVolume.score, label: selVolume.grade,
        details: selVolume.issues.map(i => i.message),
        perMuscle: selVolume.muscles.map(m => ({
          muscle: m.muscle, sets: m.directSets, mev: m.mev, mav: m.mav, mrv: m.mrv,
          pct: m.mav > 0 ? Math.round((m.effectiveSets / m.mav) * 100) : 0, status: m.status, contextNote: m.note,
        })),
        proResult: selPro,
      };
    } catch { return null; }
  }, [builtPlan, qualityWeek]);

  useEffect(() => {
    try { saveTrainingProfile({ ...loadTrainingProfile(), workMax: bbWorkMax, weakPoints, injuries, mobilityRestrictions, onCourse: peds.length > 0, bbPeds: peds, courseIntensity, loadStrategy, planMode, bbCycleId: selectedCycleId }); } catch {}
  }, [bbWorkMax, weakPoints, peds, courseIntensity, loadStrategy, planMode, selectedCycleId]);

  // FIX-19: Авто-загрузка сохранённого плана при монтировании
  useEffect(() => {
    try {
      const saved = localStorage.getItem('he_bb_plan_saved');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.plan && parsed.date) {
          setBuiltPlan(revalidateEditedPlan(parsed.plan as BBPlan));
          setBbWeekSel(1);
          setStep('plan');
          applyAnnualBlockCtx(consumeAnnualBlockCtx());
        }
      }
      const savedAutoState = localStorage.getItem('he_bb_auto_state_v1');
      if (savedAutoState) {
        const state = JSON.parse(savedAutoState);
        if (state && typeof state === 'object') {
          if (typeof state.selectedSplitId === 'string') setSelectedSplitId(state.selectedSplitId);
          if (Number.isFinite(state.bbDays)) setBbDays(Math.max(2, Math.min(7, Math.round(state.bbDays))));
          if (Number.isFinite(state.bbWeeks)) setBbWeeks(Math.max(1, Math.min(52, Math.round(state.bbWeeks))));
          if (typeof state.bbLevel === 'string') setBbLevel(state.bbLevel);
          if (typeof state.bbGoal === 'string') setBbGoal(state.bbGoal);
          if (typeof state.bbTrainingFocus === 'string') setBbTrainingFocus(state.bbTrainingFocus as any);
          if (typeof state.bbMethodology === 'string') setBbMethodology(state.bbMethodology as any);
          if (typeof state.bbVolGoal === 'string') setBbVolGoal(state.bbVolGoal);
          if (typeof state.trainingVolumeMode === 'string') setTrainingVolumeMode(state.trainingVolumeMode as any);
          if (typeof state.loadStrategy === 'string') setLoadStrategy(state.loadStrategy as any);
          if (typeof state.autoDeload === 'boolean') setAutoDeload(state.autoDeload);
          if (typeof state.deloadType === 'string') setDeloadType(state.deloadType as any);
          if (Array.isArray(state.specBlocks)) setSpecBlocks(state.specBlocks as any);
          if (typeof state.pedPhaseOverride === 'string') setPedPhaseOverride(state.pedPhaseOverride as any);
          if (typeof state.dcMode === 'boolean') setDcMode(state.dcMode);
        }
      }
    } catch {}
  }, []);

  // ⚙️ Живой приём плана из «Сборки цикла» Годового планировщика (he-bb-plan-saved)
  useEffect(() => {
    const onExternalPlan = () => {
      try {
        const saved = localStorage.getItem('he_bb_plan_saved');
        if (!saved) return;
        const parsed = JSON.parse(saved);
        if (parsed.plan) {
          setBuiltPlan(revalidateEditedPlan(parsed.plan as BBPlan));
          setBbWeekSel(1);
          setStep('plan');
          applyAnnualBlockCtx(consumeAnnualBlockCtx());
        }
      } catch { /* ignore */ }
    };
    window.addEventListener('he-bb-plan-saved', onExternalPlan);
    return () => window.removeEventListener('he-bb-plan-saved', onExternalPlan);
  }, []);

  /* ─── Годовой план → ББ-авто: контекст блока (he_bb_plan_saved_ctx) ─── */

  const consumeAnnualBlockCtx = (): { peakWeek?: boolean; weeks?: number; peakConfig?: Record<string, unknown> | null } | null => {
    try {
      const raw = localStorage.getItem('he_bb_plan_saved_ctx');
      if (!raw) return null;
      localStorage.removeItem('he_bb_plan_saved_ctx');
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch { return null; }
  };

  const applyAnnualBlockCtx = (ctx: { peakWeek?: boolean; weeks?: number; peakConfig?: Record<string, unknown> | null } | null) => {
    const patch = ctx ? annualBlockCtxToPrepPatch(ctx) : null;
    if (!patch) return;
    setPeakWeekCategory(patch.peakWeekCategory);
    setPeakSpec(patch.peakSpec);
    setPrepShowDate(patch.prepShowDate);
    setPrepTaperWeeks(patch.prepTaperWeeks);
    setPrepWeeks(patch.prepWeeks);
    setPrepWaterMode(patch.prepWaterMode as WaterStrategy);
    setPrepSodiumMode(patch.prepSodiumMode as SodiumStrategy);
    setPrepCarbMode(patch.prepCarbMode as CarbLoadStrategy);
    setPrepConfirmedManip(patch.prepConfirmedManip);
    setStep('contest');
    flash('🏁 Блок годового плана: пик-неделя предзаполнена — проверьте и соберите Contest prep');
  };

  const revalidateEditedPlan = (plan: BBPlan): BBPlan => {
    const edited = structuredClone(plan) as BBPlan;
    return finalizeBBPlan(edited, {
      reorder: false,
      phaseSafety: true,
      methodology: bbMethodology,
           level: bbLevel,
      volumeGoal: bbVolGoal as any,
      equipment: edited.safetyConstraints?.equipment,
      excludedExercises: edited.safetyConstraints?.excludedExercises,
      excludedMuscles: edited.safetyConstraints?.excludedMuscles,
      avoidAxialLoad: edited.safetyConstraints?.avoidAxialLoad,
      // Контекст специализации сохраняется при повторной финализации:
      // иначе донорский объём мог вернуться после ручных правок.
      specializationSchedule: edited.specializationSchedule,
      priorityMuscles: edited.priorityMuscles,
      trainingYears: bbTrainingYears,
      mrvMultiplier: edited.mrvMultiplier,
      ensureMinimumVolume: true,
      controlledRotation: false,
      maxWorkingSets: edited.maxWorkingSets,
      maxExercises: edited.maxExercises,
      gradedMuscles: edited.gradedMuscles,
      mobilityRestrictions: edited.mobilityRestrictions,
    });
  };

  const adjustVolume = (mult: number) => {
    if (!builtPlan) return;
    const w2 = structuredClone(builtPlan.weeks);
    for (const w of w2) for (const s of w.sessions) for (const e of s.exercises) {
      e.sets = Math.max(1, Math.round(e.sets * mult));
    }
    setBuiltPlan(revalidateEditedPlan({ ...builtPlan, weeks: w2 }));
  };
  const adjustWeight = (mult: number) => {
    if (!builtPlan) return;
    const w2 = structuredClone(builtPlan.weeks);
    for (const w of w2) for (const s of w.sessions) for (const e of s.exercises) for (const ws of e.workSets) {
      ws.weight = Math.round(ws.weight * mult * 10) / 10;
    }
    setBuiltPlan(revalidateEditedPlan({ ...builtPlan, weeks: w2 }));
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
  const originalPrograms = useOriginalPrograms();
  const bbLibraryPrograms = useMemo<FullProgram[]>(() => {
    const all = [
      ...FULL_PROGRAM_LIBRARY,
      ...WOMENS_PROGRAMS,
      ...CUSTOM_PROGRAMS,
      ...originalPrograms,
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
  }, [bbCyclePrograms, originalPrograms]);

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
    setBuiltPlan(revalidateEditedPlan({ ...builtPlan, weeks: w2 }));
    setSubTarget(null);
  }, [subTarget, builtPlan, bbWeekSel, bbWorkMax]);

  const buildBb = () => {
    if (isBuilding) return;
    setIsBuilding(true);
    let plan: BBPlan;

    // AutoReg-пейлоад (для buildBBPlan → applyPostPhaseProcessing)
    const autoRegPayload = (autoRegOn && autoRegResult) ? {
      volumeMultiplier: autoRegResult.volumeMultiplier,
      topSetPctMultiplier: autoRegResult.topSetPctMultiplier,
      rirShift: autoRegResult.rirShift,
    } : undefined;
    // Объёмный режим: high → цель MRV, капы те же от уровня (дефолт 24 с фармой — норма)
    const effectiveVolGoal = (trainingVolumeMode === 'high' ? 'mrv' : bbVolGoal) as any;
    const effectiveVolumeScheme = (trainingVolumeMode === 'high' && volumeScheme === 'standard' ? 'gvt' as const : volumeScheme) as any;

    try {

    // P0-11 (аудит 2026-09): источник «📋 ПРОФ-цикл» раньше не собирался —
    // селектор писал selectedCycleId, но plan шёл в «Выберите программу».
    // Цикл конвертируется тем же cycleTemplateToFullProgram, что и в библиотеке,
    // и собирается через проверенный programToBBPlan (faithful/adapt).
    const cycleSourceProgram = (bbSource === 'cycle' && selectedCycleId)
      ? (() => { const c = getCycleById(selectedCycleId); return c ? cycleTemplateToFullProgram(c) : null; })()
      : null;
    const effectiveProgram = bbSource === 'cycle' ? cycleSourceProgram : customProgram;

    // BUG-FIX (выбор сплита): раньше ветка программы срабатывала и при
    // `planMode==='generic_split'`, если оставался `customProgram` от прошлой
    // сессии (`|| effectiveProgram`) — тогда выбор сплита игнорировался и
    // собирался случайный/старый план. Программная ветка — ТОЛЬКО в режиме
    // «Программы» (bbSource cycle/program внутри него).
    if (planMode === 'programs') {
      // Единственный путь: FullProgram → programToBBPlan (faithful / adapt)
      if (effectiveProgram) {
        plan = programToBBPlan(effectiveProgram, {
          workMax: bbWorkMax,
          weakPoints,
          focusGroup: '',
          specializationSchedule: buildSpecBlocks,
          injuries,
          intTechnique: intensityTech,
          autoDeload,
          deloadType,
          loadStrategy,
          autoRegResult: autoRegPayload,
          favoriteExercises: bbFavEx,
          excludedExercises: bbExclEx,
          avoidAxialLoad: avoidAxialLoadUi || prof.avoidAxialLoad || false,
          fewerCompound,
          allowStrengthLifts: allowStrengthLifts && bbGoal === 'strength_mass',
          rotationMode,
          abPatternRotation: abRotation,
          intensityLevel,
          equipment: bbEquipment,
          peds,
           pedDoses,
           courseIntensity,
            level: bbLevel,
            trainingYears: bbTrainingYears,
            bodyweightCapability: prof.bodyweightCapability,
           volumeGoal: effectiveVolGoal,
           // M3 (§8.3): цель пользователя доезжает в program-путь (был тихий игнор:
           // сушка/масса не влияли на объём циклового UI-пути — паритет с generic).
           goal: bbGoal,
          specialization: specializationMode,
           mode: bbAdaptMode,
           methodology: bbMethodology,
            trainingFocus: bbTrainingFocus,
             trainingVolumeMode: trainingVolumeMode as any,
             sex: linked.profile?.settings?.personal?.sex,
             bodyFat: linked.profile.settings.personal.bodyFat,
             leanMass: linked.profile.settings.personal.weight * (1 - linked.profile.settings.personal.bodyFat / 100),
             hrvMs: linked.profile.settings.lifestyle.morningHRV,
             sleepHours: linked.profile.settings.lifestyle.sleepHours,
             stressLevel: linked.profile.settings.lifestyle.stressLevel,
            proteinPerKg: linked.profile?.settings?.nutrition?.proteinPerKg,
            calorieSurplus,
            eccentricMult,
            mobilityRestrictions,
            labMrvMultiplier: labAdjust.mrvMultiplier,
            labWarnings: labAdjust.warnings,
            labIntensityNote: labAdjust.intensityNote,
            planStartWeek: new Date().toISOString().slice(0, 10),
            supersetMode,
            volumeScheme: effectiveVolumeScheme,
            bfrMode,
            blastCruiseEnabled,
            blastWeeks,
            cruiseWeeks,
            previousPlan: usePreviousPlan && savedPlans.length > 0 ? savedPlans[0].plan : undefined,
            wearable: wearableData,
            availablePlates: platePreset === 'machine' ? undefined : (PLATE_SET_PRESETS.find(p => p.id === platePreset)?.plates ?? undefined),
            rehabMuscles: rehabMuscles.length ? rehabMuscles : undefined,
            dcMode,
           });
          if (bbDays !== effectiveProgram.daysPerWeek) setBbDays(effectiveProgram.daysPerWeek);
         if (bbWeeks !== effectiveProgram.durationWeeks) {
           const clamped = Math.max(4, Math.min(24, Math.round(Number(effectiveProgram.durationWeeks) || 8)));
           if (Number.isFinite(clamped)) setBbWeeks(clamped);
         }
      } else {
        flash('Выберите цикл или программу из библиотеки');
        setIsBuilding(false);
        return;
      }
    } else {
      const pattern = SPLIT_PATTERNS.find(p => p.id === selectedSplitId);
      if (!pattern) return;
        plan = buildBBPlan({
          patternId: selectedSplitId, level: bbLevel, trainingYears: bbTrainingYears, goal: bbGoal as any, weeks: bbWeeks,
          bodyweightCapability: prof.bodyweightCapability,
          workMax: bbWorkMax, weakPoints, focusGroup: '', volumeGoal: effectiveVolGoal,
          specialization: specializationMode,
          specializationSchedule: buildSpecBlocks,
         injuries,
         planStartWeek: new Date().toISOString().slice(0, 10),
         favoriteExercises: bbFavEx,
         excludedExercises: bbExclEx,
         avoidAxialLoad: avoidAxialLoadUi || prof.avoidAxialLoad || false,
          fewerCompound,
          allowStrengthLifts: allowStrengthLifts && bbGoal === 'strength_mass',
          rotationMode,
          abPatternRotation: abRotation,
          packingV2,
          intensityLevel,
          intensityTechnique: intensityTech,
         autoDeload,
         deloadType,
         loadStrategy,
         autoRegResult: autoRegPayload,
          pedDoses,
          courseIntensity,
          pedPhaseOverride,
          dcMode,
          equipment: bbEquipment,
         methodology: bbMethodology,
         sex: linked.profile?.settings?.personal?.sex,
         // P0-5: лабораторная коррекция MRV (Ф4.28: ручной оверрайд приоритетнее)
         labMrvMultiplier: labMultOverride ?? labAdjust.mrvMultiplier,
          labWarnings: labAdjust.warnings,
          labIntensityNote: labAdjust.intensityNote,
          trainingFocus: bbTrainingFocus,
          recoveryMultOverride: recoveryOverride ?? undefined,
          bodyFat: linked.profile.settings.personal.bodyFat,
          leanMass: linked.profile.settings.personal.weight * (1 - linked.profile.settings.personal.bodyFat / 100),
          hrvMs: linked.profile.settings.lifestyle.morningHRV,
          sleepHours: linked.profile.settings.lifestyle.sleepHours,
          stressLevel: linked.profile.settings.lifestyle.stressLevel,
          proteinPerKg: linked.profile?.settings?.nutrition?.proteinPerKg,
          calorieSurplus,
          eccentricMult,
          mobilityRestrictions,
          // PRO: cross-mesocycle continuity — передаём последний сохранённый план
          previousPlan: usePreviousPlan && savedPlans.length > 0 ? savedPlans[0].plan : undefined,
          supersetMode,
          volumeScheme: effectiveVolumeScheme,
          trainingVolumeMode,
          bfrMode,
          blastCruiseEnabled,
          blastWeeks,
          cruiseWeeks,
          rehabMuscles: rehabMuscles.length ? rehabMuscles : undefined,
          availablePlates: platePreset === 'machine' ? undefined : (PLATE_SET_PRESETS.find(p => p.id === platePreset)?.plates ?? undefined),
          cycleDay,
          wearable: wearableData,
          targetBodyFat,
        }, pedAdapt);
    }

    if (bbAnnualMacrocycle) {
      // BB-1 FIX: use applyMacrocycleToBBPlan for proper volume/RIR adjustments
      // (compound×accessory multipliers, RIR ranges, accessory removal in contest_prep)
      plan = applyMacrocycleToBBPlan(plan, bbAnnualMacrocycle);
    }

    // Проф-методики: DUP поверх плана (все ветки). Суперсеты и схемы объёма для всех веток теперь обрабатываются внутри движка (finalize) через BBBuilderInput/CycleToPlanInput — единый путь.
    if (dupMode !== 'none') {
      plan = applyDUPOverlay(plan, { mode: dupMode, cycleDays: dupMode === 'full_dup' ? 3 : 2, muscles: dupMuscles.length ? dupMuscles : undefined });
    }
    // Лаборатория ББ-диагностики: замены + предпочитаемые + PROF-коррекции выполнения (темп/ROM/техника) — поверх плана
    // PRO-3 R2: L/R-добивка слабой стороны — поверх плана (унилатерально, слабая первой, ≤3 сетов, делод скип, сессия <10 упр)
    if (exerciseSwaps.length > 0 || preferredExerciseIds.length > 0 || executionCorrections.length > 0 || Object.keys(lrTopUp).length > 0) {
      const swaps = exerciseSwaps.slice();
      // preferred как swap если упражнения нет в плане — добавим в первую неделю
      for (const pid of preferredExerciseIds) {
        const low = String(pid).toLowerCase();
        const already = (plan.weeks || []).some((w: any) => (w.sessions || []).some((s: any) => (s.exercises || []).some((e: any) => String(e.exerciseName || e.id || '').toLowerCase() === low)));
        if (!already) {
          const cat = getExerciseById(pid) || EXERCISE_CATALOG.find(c => c.id.toLowerCase() === low);
          if (cat) {
            const targetMuscle = (cat.group || 'chest').toLowerCase();
            // найдём сессию где эта мышца primary — иначе первая
            let targetSession: any = null;
            for (const w of (plan.weeks || [])) {
              for (const s of (w.sessions || [])) {
                const has = (s.exercises || []).some((e: any) => String(e.muscle || '').toLowerCase() === targetMuscle);
                if (has) { targetSession = s; break; }
              }
              if (targetSession) break;
            }
            if (!targetSession) targetSession = (plan.weeks?.[0] as any)?.sessions?.[0];
            if (targetSession && Array.isArray(targetSession.exercises)) {
              // заменим последний accessory чтобы не ломать объём, или добавим если ≤ лимита
              const canAdd = targetSession.exercises.length < 10;
              if (canAdd) {
                targetSession.exercises.push({ muscle: targetMuscle, name: cat.name, exerciseName: cat.id, role: 'accessory' as const, sets: 3, repsRange: [10, 12] as any, rir: 2, tempo: '3-1-1-0', comment: `🧬 Лаб: предпочтено ${cat.name} (SFR)` } as any);
              } else {
                const idx = targetSession.exercises.length - 1;
                if (idx >= 1) targetSession.exercises[idx] = { muscle: targetMuscle, name: cat.name, exerciseName: cat.id, role: 'accessory' as const, sets: 3, repsRange: [10, 12] as any, rir: 2, tempo: '3-1-1-0', comment: `🧬 Лаб: замена на ${cat.name}` } as any;
              }
            }
          }
        }
      }
      for (const sw of swaps) {
        const oldLow = String(sw.oldId).toLowerCase();
        const newLow = String(sw.newId).toLowerCase();
        const newCat = getExerciseById(sw.newId) || EXERCISE_CATALOG.find(c => c.id.toLowerCase() === newLow);
        if (!newCat) continue;
        for (const w of (plan.weeks || [])) {
          for (const s of (w.sessions || [])) {
            for (let ei = 0; ei < (s.exercises || []).length; ei++) {
              const ex: any = s.exercises[ei];
              const cur = String(ex.exerciseName || ex.id || '').toLowerCase();
              if (cur === oldLow) {
                const keeps = { muscle: ex.muscle || newCat.group, sets: ex.sets, repsRange: ex.repsRange, rir: ex.rir, tempo: newCat.stretchPhase ? '3-1-1-0' : ex.tempo, comment: `🧬 Лаб: ${ex.name || oldLow} → ${newCat.name} (коррекция)` } as any;
                s.exercises[ei] = { ...ex, name: newCat.name, exerciseName: newCat.id, ...keeps };
              }
            }
          }
        }
      }
      // PROF-коррекции выполнения (темп/ROM/техника) — 3.10: гейт по targetId/targetName,
      // иначе правка выбранного упражнения меняла ВСЕ упражнения всех недель.
      applyExecutionCorrections(plan, executionCorrections as ExecutionCorrection[]);
      const profParts: string[] = [];
      // S3: возврат — главный план тоже режется (ступень 2 ×0.5, ступень 1 = только техника)
      if (returnAction && Number.isFinite(returnAction.volumeMult) && returnAction.volumeMult < 1) {
        const mult = Math.max(0, Math.min(1, returnAction.volumeMult));
        const rirAdd = Math.max(0, Math.min(3, Math.round(returnAction.rirShift || 0)));
        for (const w of (plan.weeks || []) as any[]) {
          if (w.deload) continue;
          for (const s of w.sessions as any[]) {
            for (const ex of s.exercises as any[]) {
              if (mult === 0) {
                ex.sets = 1;
                if (Array.isArray(ex.workSets) && ex.workSets.length > 1) ex.workSets = ex.workSets.slice(0, 1);
                ex.rir = Math.min(5, (ex.rir || 2) + rirAdd + 2);
                ex.comment = `${ex.comment ? ex.comment + ' · ' : ''}↩ возврат: техника`;
              } else {
                const ns = Math.max(1, Math.round(ex.sets * mult));
                if (ns !== ex.sets) {
                  if (Array.isArray(ex.workSets)) {
                    if (ns < ex.workSets.length) ex.workSets = ex.workSets.slice(0, ns);
                    else if (ns > ex.workSets.length) {
                      const tpl = ex.workSets[ex.workSets.length - 1] || { reps: 10, rir: 2, weight: 0 };
                      ex.workSets = [...ex.workSets, ...Array.from({ length: ns - ex.workSets.length }, () => ({ ...tpl }))];
                    }
                  }
                  ex.sets = ns;
                }
                if (rirAdd) ex.rir = Math.min(5, (ex.rir || 2) + rirAdd);
                ex.comment = `${ex.comment ? ex.comment + ' · ' : ''}↩ возврат ×${mult}`;
              }
            }
          }
        }
        profParts.push(mult === 0 ? 'возврат: ступень 1 — только техника' : `возврат: ×${mult} RIR+${rirAdd}`);
      }
      // PRO-3 R2 + S3: добивка слабой стороны (S3: на ступени 1 возврата — 0%, не добавляем)
      const retMult = returnAction && Number.isFinite(returnAction.volumeMult) ? Math.max(0, Math.min(1, returnAction.volumeMult)) : 1;
      const lrEntries = retMult <= 0 ? [] : Object.entries(lrTopUp);
      if (lrEntries.length) {
        const sideRu = (sd: string) => (sd === 'left' ? 'левая' : 'правая');
        for (const [g, tu] of lrEntries) {
          const gl = String(g).toLowerCase();
          const side = (tu as any)?.side === 'right' ? 'right' : 'left';
          const addSets = Math.max(1, Math.min(3, Math.round(Number((tu as any)?.sets) || 1)));
          for (const w of (plan.weeks || []) as any[]) {
            if (!w || (w as any).deload) continue;
            let target: any = null;
            for (const s of (w.sessions || []) as any[]) {
              if ((s.exercises || []).some((e: any) => String(e.muscle || '').toLowerCase() === gl)) { target = s; break; }
            }
            if (!target || !Array.isArray(target.exercises) || target.exercises.length >= 10) continue;
            const src = (target.exercises as any[]).find((e: any) => String(e.muscle || '').toLowerCase() === gl);
            if (!src) continue;
            target.exercises.push({
              ...src,
              sets: addSets,
              role: 'accessory' as const,
              side: side,
              unilateral: true,
              comment: `${(src as any).comment ? (src as any).comment + ' · ' : ''}↔ L/R: слабая ${sideRu(side)} первой, унилатерально +${addSets}`,
            });
          }
        }
        const lrNames = lrEntries.map(([g, tu]) => `${g}: ${sideRu(String((tu as any)?.side))} +${Math.max(1, Math.min(3, Math.round(Number((tu as any)?.sets) || 1)))}`).join(', ');
        profParts.push(`L/R добивка ${lrNames}`);
      }
      if (preferredExerciseIds.length) profParts.push(`предпочтения ${preferredExerciseIds.join(', ')}`);
      if (exerciseSwaps.length) profParts.push(`замены ${exerciseSwaps.map(s => `${s.oldId}→${s.newId}`).join(', ')}`);
      if (executionCorrections.length) profParts.push(`PROF ${executionCorrections.map(c => c.type).join(', ')}`);
      // Lab-добивка-2 п.6: Δ лабораторной коррекции — постоянной строкой (флеш transient, rationale живёт в плане).
      try {
        const lastLabDelta = JSON.parse(localStorage.getItem('he_bb_last_lab_delta') || 'null') as { summary?: unknown } | null;
        if (lastLabDelta && typeof lastLabDelta.summary === 'string' && lastLabDelta.summary) {
          profParts.push(`Δ лаб. коррекции: ${lastLabDelta.summary}`);
        }
      } catch { /* битый стор — молча */ }
      plan.rationale = [...(plan.rationale || []), `🧬 Лаб ББ: ${profParts.join(' · ')}`];
    }
    // Объёмный режим в generic-ветке уже прокинут через buildBBPlan(effectiveVolGoal/effectiveVolumeScheme); капы те же от уровня

    const modeLabel = bbAnnualMacrocycle
      ? `Годовой BB-макроцикл (${bbAnnualMacrocycle.totalWeeks} нед)`
      : planMode === 'programs' ? `Программа: ${customProgram?.name || customCycle?.meta.title || selectedProgramId || selectedCycleId}` : 'Generic-сплит';
    const srpe = loadSRPESessions();
    const acwr = srpe.length >= 2 ? acuteChronicRatio(toDailyLoads(srpe)) : null;
    const deloadNote = autoDeload && acwr && acwr.ratio > 1.5
      ? `🔄 Делод (ACWR ${acwr.ratio.toFixed(2)} >1.5 — danger): ${DELOAD_PROTOCOLS[deloadType].description}`
      : (acwr && acwr.ratio > 1.3
        ? `⚠ ACWR ${acwr.ratio.toFixed(2)} — зона осторожности (1.3-1.5). Рассмотрите разгрузку.`
        : 'Делод: нет (ACWR в норме)');

    setBuiltPlan({
      ...plan,
      // Слепок всех кнопок — чтобы отчёт соответствовал реальным настройкам, а не «от новичка»
      trainingVolumeMode,
      volumeGoal: (plan as any).volumeGoal || effectiveVolGoal,
      goal: bbGoal,
      trainingFocus: bbTrainingFocus,
      methodology: bbMethodology,
      supersetMode,
      volumeScheme: (plan as any).volumeScheme || effectiveVolumeScheme,
      dupMode,
      trainingYears: bbTrainingYears,
      courseIntensity,
      level: bbLevel,
      inputSnapshot: {
        level: bbLevel,
        goal: bbGoal,
        trainingVolumeMode,
        volumeGoal: effectiveVolGoal,
        trainingFocus: bbTrainingFocus,
        methodology: bbMethodology,
        supersetMode,
        volumeScheme: effectiveVolumeScheme,
        dupMode,
        trainingYears: bbTrainingYears,
        courseIntensity,
        fewerCompound,
        rotationMode,
        abPatternRotation: abRotation,
        packingV2,
        intensityLevel,
        avoidAxialLoad: avoidAxialLoadUi || (prof as any).avoidAxialLoad,
        equipment: bbEquipment,
        injuries,
        mobilityRestrictions,
        favoriteExercises: bbFavEx,
        excludedExercises: bbExclEx,
        autoDeload,
        deloadType,
        loadStrategy,
        eccentricMult,
        calorieSurplus,
        proteinPerKg: linked.profile?.settings?.nutrition?.proteinPerKg,
        labMrvMultiplier: labAdjust.mrvMultiplier,
        bodyFat: linked.profile.settings.personal.bodyFat,
        leanMass: linked.profile.settings.personal.weight * (1 - linked.profile.settings.personal.bodyFat / 100),
        hrvMs: linked.profile.settings.lifestyle.morningHRV,
        sleepHours: linked.profile.settings.lifestyle.sleepHours,
        stressLevel: linked.profile.settings.lifestyle.stressLevel,
        weakPoints,
        focusGroup: '',
      },
      rationale: [...plan.rationale,
        `📌 Источник: ${modeLabel}`,
        `📈 Стратегия: ${loadStrategy}`,
        `📦 Объём: ${trainingVolumeMode === 'high' ? 'Объёмный (MRV, кап 5)' : 'Обычный (' + effectiveVolGoal + ')'} · капы ${plan.maxWorkingSets}/${plan.maxExercises} (от уровня)`,
        deloadNote,
        `💪 Слабые группы: ${weakPoints.length > 0 ? weakPoints.join(', ') : 'нет'}`,
      ],
    });
    // Новая сборка с нуля — снапшот отката инъекции протух (план другой)
    try { localStorage.removeItem('he_bb_plan_saved_prev'); localStorage.removeItem('he_bb_plan_history'); } catch { /* ignore */ }
    // ⚖️ Авто-калибровка реальных весов из training.workMaxByExercise (сохранённых на шаге «Реальные веса»)
    try {
      const stored = getProfile().settings?.training?.workMaxByExercise;
      const calib = autoCalibrateFromStored(plan, stored, (n) => /подтягив|отжимани|скручив|планка|пловец|альпинист|tgu|мостик|отведение.*стоя|икры.*одной|выпад.*назад|болгарск/i.test(n));
      if (calib.applied > 0) {
        plan = { ...calib.plan, rationale: [...calib.plan.rationale, `⚖️ Применены сохранённые реальные веса (${calib.applied} вхождений упражнений).`] };
      }
    } catch { /* ignore */ }
    setBuiltPlan({
      ...plan,
      // Слепок всех кнопок — чтобы отчёт соответствовал реальным настройкам, а не «от новичка»
      trainingVolumeMode,
    });
    // Новая сборка с нуля — снапшот отката инъекции протух (план другой)
    try { localStorage.removeItem('he_bb_plan_saved_prev'); localStorage.removeItem('he_bb_plan_history'); } catch { /* ignore */ }
    // PRO: per-muscle frequency optimization
    try {
      const sessions = loadSessions();
      const freqResult = optimizeMuscleFrequency(plan, sessions.length > 0 ? sessions : undefined, bbWorkMax);
      setFreqOptResult(freqResult);
    } catch { setFreqOptResult(null); }
    setBbWeekSel(1);
    setStep('plan');
    try {
      const playerDays = plan.weeks.flatMap(w => w.sessions.map((s, si) => ({
        label: 'Нед' + w.week + ' Д' + (si+1),
        exercises: s.exercises.map(e => {
           const targetSets = (e.workSets || []).map(ws => ({ weight: ws.weight || 0, reps: ws.reps || 0, rir: ws.rir ?? e.rir ?? 2, technique: ws.technique }));
          return { name: e.name, muscleGroup: muscleLabel(e.muscle), notes: [exerciseTargetNote(e), e.comment || e.rationale || '', e.muscle === 'back' ? backSubgroupLabel((e as any).backSubgroup) : '', ['biceps', 'triceps', 'forearms'].includes(e.muscle) ? armHeadLabel((e as any).movementPattern) : ''].filter(Boolean).join(' · ') || '', targetSets, restSec: e.restSeconds || 90 };
        }),
      })));
      localStorage.setItem('he_pl_runtime', JSON.stringify({ days: playerDays, focus: plan.pattern?.name || 'ББ-сплит', week: 1, track: 'bb' }));
    } catch {}

    // План перестроен — применённый ранее contest prep больше не актуален
    // (новый план не содержит taper/пик-неделю). Сброс метки применения.
    setPrepApplied(false);
    setShowPeakWeek(false);

    } catch (e: any) {
      console.error('[BB-auto] Ошибка генерации плана:', e);
      flash('Ошибка при генерации плана: ' + (e?.message || String(e)) + '. Проверьте параметры и попробуйте снова.');
      return;
    } finally {
      setIsBuilding(false);
    }
  };

  // P2-9: применить inline-правки к плану перед сохранением/экспортом.
  // Раньше exerciseEdits были display-only — не мутатируют builtPlan/he_pl_runtime.
  // Теперь: если есть edits — мутируем workSets упражнений.
  const applyEditsToPlan = (plan: BBPlan): BBPlan => {
    if (!plan || Object.keys(exerciseEdits).length === 0) return plan;
    const weeks = plan.weeks.map(w => ({
      ...w,
      sessions: w.sessions.map((s, si) => ({
        ...s,
        exercises: s.exercises.map((e, ei) => {
          const editKey = `${si}-${ei}`;
          const edit = exerciseEdits[editKey];
          if (!edit) return e;
          const edited = {
            ...e,
            sets: edit.sets,
            workSets: (e.workSets || []).map((ws, i) =>
              i === 0
                ? { ...ws, weight: edit.weight, reps: edit.reps }
                : { ...ws, weight: edit.weight }
            ),
            repsRange: [edit.reps, edit.reps] as [number, number],
            comment: (e.comment || '') + ' | ✏️ inline-правка',
          };
          if (edit.rir != null && Number.isFinite(edit.rir)) edited.rir = edit.rir;
          if (edit.tempo) (edited as any).tempoSpec = edit.tempo;
          if (edit.technique && edit.technique !== 'none') {
            (edited as any).technique = edit.technique;
            if (!(edited as any).intensityTechUsed) (edited as any).intensityTechUsed = true;
          } else if (edit.technique === 'none') {
            delete (edited as any).technique;
          }
          if (edit.supersetWith && edit.supersetWith !== 'none') {
            (edited as any).supersetWith = edit.supersetWith;
            (edited as any).comment = (edited.comment || '') + ` | 🔗 Суперсет с «${edit.supersetWith}»`;
          }
          return edited;
        }),
      })),
    }));
    const editedPlan = { ...plan, weeks };
    return revalidateEditedPlan(editedPlan);
  };

  const handleSavePlan = () => {
    try {
      const planToSave = applyEditsToPlan(builtPlan!);
      const saveSafety = calculatePlanSafetyScore(planToSave, {
        acwrRatio: calculateACWR(),
        injuryCount: injuries.length,
      });
      if (saveSafety.riskLevel === 'dangerous') { flash(`⚠ SafetyScore ${saveSafety.score}/100 — план сохранён с предупреждением, проверьте риски.`); }
      if (!planToSave.validation?.valid) { flash('⚠ План сохранён с ошибками валидации — проверьте предупреждения.'); }
      setBuiltPlan(planToSave); localStorage.setItem('he_bb_plan_saved', JSON.stringify({ plan: planToSave, date: new Date().toISOString() })); flash('План сохранён');
      try { localStorage.removeItem('he_bb_plan_saved_prev'); localStorage.removeItem('he_bb_plan_history'); } catch { /* ignore */ }
    } catch { flash('Ошибка сохранения'); }
  };

  /** Сохранить BB-план в "Мои тренировки" (myTrainingPlans) — унификация с ручным конструктором. */
  const handleSaveToMyPlans = () => {
    if (!builtPlan) return;
    const exportPlan = applyEditsToPlan(builtPlan);
    const saveSafety = calculatePlanSafetyScore(exportPlan, { acwrRatio: calculateACWR(), injuryCount: injuries.length });
    if (saveSafety.riskLevel === 'dangerous') { flash(`⚠ SafetyScore ${saveSafety.score}/100 — сохраняем с предупреждением.`); }
    if (!exportPlan.validation?.valid) { flash('⚠ Есть ошибки валидации — сохраняем с предупреждением.'); }
    const fallbackName = `${exportPlan.pattern.name} ${bbWeeks}нед`;
    setNamePrompt({
      title: '💾 Название плана (Мои тренировки)',
      value: fallbackName,
      onOk: (name) => {
        // Конвертация BB-плана в flat-формат Моих тренировок: все упражнения недели 1
        const week1 = exportPlan.weeks[0];
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
          flash(`План «${name}» сохранён в Мои тренировки (${exs.length} упр.)`);
        } catch { flash('Ошибка сохранения'); }
      },
    });
  };

  const handleSaveVariant = () => {
    if (!builtPlan || !metrics) return;
    const exportPlan = applyEditsToPlan(builtPlan);
    if (!exportPlan.validation?.valid) { flash('⚠ Есть ошибки валидации — сохраняем вариант с предупреждением.'); }
    const exportMetrics = calcBBPlanMetrics(exportPlan, pedAdapt.combinedMrvMultiplier);
    // Скор варианта — среднее понедельных «Объём» (факт выдачи × параметры плана).
    const exportQualityScore = (() => { try { return averageWeeklyScores(exportPlan as any).avgVolume; } catch { return 0; } })();
    const fallbackName = `${exportPlan.pattern.name} ${bbWeeks}нед ${peds.length > 0 ? peds.join('+') : 'натурал'}`;
    setNamePrompt({
      title: '💾 Название варианта',
      value: fallbackName,
      onOk: (name) => {
        const params: SavedBBPlan['params'] = {
          patternId: selectedSplitId,
           patternName: exportPlan.pattern.name,
          level: bbLevel, goal: bbGoal, weeks: bbWeeks, volumeGoal: bbVolGoal,
          peds, pedDoses, courseIntensity: courseIntensity as string,
           weakPoints, focusGroup: '', intensityTechnique: intensityTech,
           loadStrategy, autoDeload, deloadType, planMode,
           trainingFocus: bbTrainingFocus,
           methodology: bbMethodology,
           equipment: bbEquipment.slice(),
           specialization: specializationMode,
           specBlocks: buildSpecBlocks,
           daysPerWeek: bbDays,
           source: bbSource,
           programPath: bbProgramPath,
            programId: selectedProgramId || undefined,
            cycleId: planMode === 'programs' ? selectedCycleId : undefined,
            abPatternRotation: abRotation === true ? true : undefined,
            packingV2: packingV2 === true ? true : undefined,
          };
        const planMetrics: SavedBBPlan['metrics'] = {
           totalSets: exportMetrics.totalSets,
           avgRir: exportMetrics.avgRir,
           sessionsPerWeek: exportPlan.pattern.sessionsPerRotation,
          phases: phases.map(p => p.phase),
            qualityScore: exportQualityScore,
           muscleCount: Object.keys(exportPlan.muscleFrequency || {}).length,
          mrvMult: pedAdapt.combinedMrvMultiplier,
           peakWeek: exportPlan.report?.peakWeek,
           peakDirectSets: exportPlan.report?.peakDirectSets,
            peakEffectiveSets: exportPlan.report
              ? Object.values(exportPlan.report.peakVolume as Record<string, { effectiveSets: number }>)
                .reduce((sum: number, item: { effectiveSets: number }) => sum + item.effectiveSets, 0)
              : undefined,
           maxSessionMinutes: exportPlan.report?.maxSessionMinutes,
           maxAxialCost: exportPlan.report?.maxAxialCost,
        };
        const updated = saveBBPlanVariant(name, exportPlan, params, planMetrics);
        setSavedPlans(updated);
        setShowCompare(true);
      },
    });
  };

  const handleDeleteVariant = (id: string) => {
    const updated = deleteBBPlanVariant(id);
    setSavedPlans(updated);
  };

  /** Сохранить собранный ББ-план в «Мои программы» (UserProgram) — канонический путь редактирования. */
  const handleSaveAsUserProgram = () => {
    if (!builtPlan) return;
    const exportPlan = applyEditsToPlan(builtPlan);
    if (!exportPlan.validation?.valid) { flash('⚠ Есть ошибки валидации — сохраняем программу с предупреждением.'); }
    const fallbackName = `${exportPlan.pattern.name} ${bbWeeks}нед`;
    setNamePrompt({
      title: '📂 Название программы (Мои программы)',
      value: fallbackName,
      onOk: (name) => {
        try {
          const userProg = createUserProgramFromBuild(exportPlan, {
            title: name,
            goal: bbGoal,
            level: bbLevel,
            weakPoints: weakPoints.slice(),
            equipment: bbEquipment.slice(),
          });
          saveUserProgramStore(userProg, 'Импорт из ББ-виззарда');
          flash(`✅ Сохранено в «Мои программы»: ${name}`);
        } catch (e: any) {
          console.error('[BB-auto] Ошибка сохранения в Мои программы:', e);
          flash('⚠ Не удалось сохранить: ' + (e?.message || String(e)));
        }
      },
    });
  };

  const handleLoadVariant = (v: SavedBBPlan) => {
    if (!v.plan) return;
    const loaded = structuredClone(v.plan) as BBPlan;
    setBuiltPlan(revalidateEditedPlan(loaded));
    if (v.params.trainingFocus) setBbTrainingFocus(v.params.trainingFocus);
    if (v.params.level) setBbLevel(v.params.level);
    if (v.params.goal) setBbGoal(v.params.goal);
    if (v.params.daysPerWeek) setBbDays(v.params.daysPerWeek);
    if (v.params.weeks) setBbWeeks(v.params.weeks);
    if (v.params.volumeGoal) setBbVolGoal(v.params.volumeGoal);
    if (Array.isArray(v.params.peds)) setPeds(v.params.peds as PED[]);
    // Миграция выбора специализации: specBlocks (новый формат) → слабые
    // точки/фокус (старый формат) → первый блок с целями.
    const legacyTargets = normalizeSpecializationTargets([
      ...(Array.isArray(v.params.weakPoints) ? v.params.weakPoints : []),
      ...(v.params.focusGroup && v.params.focusGroup !== '' ? [v.params.focusGroup as string] : []),
    ]);
    if (Array.isArray(v.params.specBlocks) && v.params.specBlocks.length > 0) {
      const blocks = v.params.specBlocks
        .filter((b: any) => Array.isArray(b.targets) && b.targets.length > 0)
        .map((b: any, idx: number) => ({
          id: `spec-block-${idx + 1}`,
          weeks: Math.max(3, Math.min(6, Math.round((b.weekEnd ?? b.weeks ?? 5) - (b.weekStart ?? (idx > 0 ? (v.params.specBlocks?.[idx - 1]?.weekEnd ?? 1) + 1 : 1)) + 1))),
          targets: normalizeSpecializationTargets(b.targets),
          tradeoffMode: (b.tradeoff && b.tradeoff.mode && b.tradeoff.mode !== 'none' ? b.tradeoff.mode : 'none') as any,
          donors: b.tradeoff && Array.isArray(b.tradeoff.donorMuscles) ? normalizeSpecializationTargets(b.tradeoff.donorMuscles) : [],
        }));
      if (blocks.length > 0) setSpecBlocks(blocks);
    } else if (legacyTargets.length > 0) {
      setSpecBlocks([{ id: 'spec-block-1', weeks: 5, targets: legacyTargets, tradeoffMode: 'none', donors: [] }]);
    }
    if (v.params.loadStrategy) setLoadStrategy(v.params.loadStrategy as LoadStrategy);
    if (v.params.deloadType) setDeloadType(v.params.deloadType as DeloadType);
    if (v.params.intensityTechnique) setIntensityTech(v.params.intensityTechnique as IntensityTechnique);
    if (v.params.methodology) setBbMethodology(v.params.methodology as SessionMethodology);
    if (Array.isArray(v.params.equipment)) setBbEquipment(v.params.equipment);
    if (v.params.specialization != null) {
      // Миграция: старый флаг специализации без specBlocks → блок 1 с целями.
      if (v.params.specialization && legacyTargets.length > 0) {
        setSpecBlocks([{ id: 'spec-block-1', weeks: 5, targets: legacyTargets, tradeoffMode: 'none', donors: [] }]);
      }
    }
    if (v.params.pedDoses) setPedDoses({ ...v.params.pedDoses });
    if ((v.params as any).pedPhaseOverride) setPedPhaseOverride((v.params as any).pedPhaseOverride);
    if ((v.params as any).dcMode != null) setDcMode(Boolean((v.params as any).dcMode));
    if (v.params.courseIntensity) setCourseIntensity(v.params.courseIntensity as 'mild' | 'moderate' | 'heavy');
    if (v.params.autoDeload != null) setAutoDeload(Boolean(v.params.autoDeload));
    if (v.params.planMode === 'programs' || (v.params as any).planMode === 'bb_cycle' || v.params.planMode === 'generic_split') {
      const migrated = (v.params as any).planMode === 'bb_cycle' ? 'programs' : v.params.planMode;
      setPlanMode(migrated as PlanMode);
    }
    if (v.params.patternId) setSelectedSplitId(v.params.patternId);
    if (v.params.source) setBbSource(v.params.source);
    if (v.params.programPath) setBbProgramPath(v.params.programPath);
    if (v.params.programId) {
      setSelectedProgramId(v.params.programId);
      const sourceProgram = bbLibraryPrograms.find(program => program.id === v.params.programId);
      if (sourceProgram && v.params.programPath === 'library') {
        setCustomProgram(sourceProgram);
        setCustomCycle(null);
      }
    }
    if (v.params.cycleId) setSelectedCycleId(v.params.cycleId);
    setAbRotation(v.params.abPatternRotation === true);
    setPackingV2(v.params.packingV2 === true);
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
    const target = w3[weekIdx]?.sessions[si]?.exercises[ei];
    if (!target) return;
    const oldEquipment = String((EXERCISE_CATALOG.find(x => x.name === target.name)?.equipment) || '');
    const newEquipment = String(found.equipment || '');
    const ratio: Record<string, number> = { barbell: 1, smith: 0.9, machine: 0.85, dumbbell: 0.8, cable: 0.8, bodyweight: 0.7 };
    const loadRatio = (ratio[newEquipment] || 1) / (ratio[oldEquipment] || 1);
    target.name = found.name;
    target.exerciseName = found.name;
    target.muscle = found.group || target.muscle;
    target.workSets = target.workSets.map(ws => ({ ...ws, weight: Math.round(ws.weight * loadRatio * 10) / 10 }));
    target.comment = `${target.comment || ''} | Ручная замена: ${oldEquipment || 'unknown'} → ${newEquipment || 'unknown'}, вес ×${loadRatio.toFixed(2)}`;
    target.rationale = `${target.rationale || ''} | Manual replacement: ${found.name}`;
    const editedPlan = { ...builtPlan, weeks: w3 };
    setBuiltPlan(revalidateEditedPlan(editedPlan));
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
     setBuiltPlan(revalidateEditedPlan({ ...builtPlan, weeks: w3 }));
  };

  const handleSendToExecution = () => {
    if (!builtPlan) return;
    const executionPlan = applyEditsToPlan(builtPlan);
    const validation = executionPlan.validation || validateBBPlan(executionPlan, executionPlan.safetyConstraints);
    if (!validation.valid) {
      flash('⚠ Отправляем план на выполнение с предупреждениями валидации — проверьте ошибки.');
    }
    setBuiltPlan(executionPlan);
    try {
      const playerDays = executionPlan.weeks.flatMap(w => w.sessions.map((s, si) => ({
        label: 'Нед' + w.week + ' Д' + (si+1),
        exercises: s.exercises.map(e => {
          const targetSets = (e.workSets || []).map(ws => ({
            weight: ws.weight || 0,
            reps: ws.reps || 0,
            rir: ws.rir ?? e.rir ?? 2,
            technique: ws.technique,
          }));
          return { name: e.name, muscleGroup: e.muscle, notes: e.comment || e.rationale || '', targetSets, restSec: e.restSeconds || 90 };
        }),
      })));
       localStorage.setItem('he_pl_runtime', JSON.stringify({ days: playerDays, focus: executionPlan.pattern?.name || 'ББ-сплит', week: 1, track: 'bb' }));
      // FIX-12: Авто-переход на вкладку «Тренировка» (как ручной конструктор)
      localStorage.setItem('he_training_tab', 'runtime');
      window.dispatchEvent(new StorageEvent('storage', { key: 'he_training_tab' }));
    } catch { flash('Ошибка при отправке плана на выполнение'); }
  };

  /** PRO: печать плана в PDF через window.print() — HTML-таблица с упражнениями. */
  const handlePrintPlan = () => {
    if (!builtPlan) return;
    const plan = applyEditsToPlan(builtPlan);
    const w = window.open('', '_blank');
    if (!w) { flash('Разрешите всплывающие окна для печати'); return; }
    const esc = (s: string) => (s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const weeksHtml = plan.weeks.map(wk => {
      const sessionsHtml = wk.sessions.map((s, si) => {
        const exsHtml = s.exercises.map(e => {
          const feat = exerciseFeatureBadges(e).map(b => b.label).join(' · ');
          const chain = techniqueChainParts(e);
          const sets = [...(e.workSets || []).map(ws => `${ws.reps}×${ws.weight}кг @RIR${ws.rir ?? e.rir}`), ...(chain ? [chain.label + ': ' + chain.parts.join(' → ')] : [])].join(', ');
          const sub = e.muscle === 'back' ? backSubgroupLabel((e as any).backSubgroup) : ['biceps', 'triceps', 'forearms'].includes(e.muscle) ? armHeadLabel((e as any).movementPattern) : '';
          return `<tr><td style="padding:4px 8px;border:1px solid #ddd">${esc(e.exerciseName || e.name || '')}</td><td style="padding:4px 8px;border:1px solid #ddd">${esc(e.muscle)}${sub ? ' · ' + esc(sub) : ''}</td><td style="padding:4px 8px;border:1px solid #ddd">${e.sets}</td><td style="padding:4px 8px;border:1px solid #ddd">${esc(sets)}</td><td style="padding:4px 8px;border:1px solid #ddd">${esc(feat ? '💥 ' + feat : '')}${esc(e.comment || '')}</td></tr>`;
        }).join('');
        const restNote = s.exercises.length === 0 ? `<p style="font-size:11px;color:#888;margin:6px 0">😴 Полный отдых — позирование, растяжка, сон 8–9 ч.${(s as any).comment ? ' ' + esc((s as any).comment) : ''}</p>` : '';
        return `<h3 style="margin:12px 0 4px">День ${si + 1}${s.sessionTag ? ' — ' + esc(sessionTagLabel(s.sessionTag)) : ''}${(s as any).peakWeekTraining ? ' — 🎭 памп' : ''}${(s as any).peakWeekRest ? ' — 😴 отдых' : ''}</h3>${restNote}<table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="background:#f0f0f0"><th style="padding:4px 8px;border:1px solid #ddd;text-align:left">Упражнение</th><th style="padding:4px 8px;border:1px solid #ddd;text-align:left">Мышца</th><th style="padding:4px 8px;border:1px solid #ddd">Сеты</th><th style="padding:4px 8px;border:1px solid #ddd;text-align:left">Вес/Reps</th><th style="padding:4px 8px;border:1px solid #ddd;text-align:left">Коммент</th></tr></thead><tbody>${exsHtml}</tbody></table>`;
      }).join('');
      const peakNote = (wk as any).peakWeek === true ? ` — 🎭 ПИК-НЕДЕЛЯ (тапер ББ)` : '';
      const prepNote = (wk as any).prepProtocol ? `<p style="font-size:10px;color:#888;margin:2px 0">${esc((wk as any).prepProtocol)}</p>` : '';
      const phaseRu = BB_PHASE_LABEL_RU[String((wk as any).phase || '')] || esc((wk as any).phase || '');
      const phaseColor = BB_PHASE_COLOR[String((wk as any).phase || '')] || '#444';
      return `<h2 style="margin:16px 0 6px;color:${phaseColor};border-left:4px solid ${phaseColor};padding-left:8px">Неделя ${wk.week} (${phaseRu}${wk.deload ? ' — DELOAD' : ''})${peakNote}</h2>${prepNote}${sessionsHtml}`;
    }).join('');
    const rationaleHtml = (plan.rationale || []).map(r => `<div style="font-size:10px;color:#666;margin:2px 0">${esc(r)}</div>`).join('');
    // Фаза 4.24: heatmap «мышца × неделя» в печати.
    const hm = buildBBMuscleHeatmap(plan);
    const hmWeeks = [...new Set(hm.map(h => h.week))].sort((a, b) => a - b);
    const hmMuscles = [...new Set(hm.map(h => h.muscle))];
    const hmColor: Record<string, string> = { below_mev: '#f87171', mev_mav: '#22c55e', above_mav: '#f59e0b', over_mrv: '#ef4444', none: '#e5e7eb' };
    const hmHtml = hmMuscles.length ? `<h2 style="font-size:14px;margin:16px 0 4px">🧬 Heatmap «мышца × неделя»</h2><table style="border-collapse:collapse;font-size:10px"><tr><th style="border:1px solid #ddd;padding:3px 6px;text-align:left">Мышца</th>${hmWeeks.map(ww => `<th style="border:1px solid #ddd;padding:3px 6px">Нед ${ww}</th>`).join('')}</tr>${hmMuscles.map(m => `<tr><td style="border:1px solid #ddd;padding:3px 6px">${esc(m)}</td>${hmWeeks.map(ww => { const c = hm.find(h => h.muscle === m && h.week === ww); return `<td style="border:1px solid #ddd;text-align:center;background:${c ? hmColor[c.status] : '#fafafa'}">${c ? c.sets : ''}</td>`; }).join('')}</tr>`).join('')}</table>` : '';
    w.document.write(`<!DOCTYPE html><html><head><title>${esc(plan.pattern?.name || 'BB-план')}</title><style>@media print{body{font-size:10px}h2{page-break-before:auto}}</style></head><body style="font-family:Arial,sans-serif;max-width:900px;margin:0 auto;padding:20px"><h1>${esc(plan.pattern?.name || 'BB-план')} — ${plan.weeks.length} нед</h1>${rationaleHtml}${weeksHtml}${hmHtml}<script>window.print()</script></body></html>`);
    w.document.close();
  };

  /** Фаза 4.25: передать ББ-план в планировщик питания (калораж/белок/трен-дни/объём). */
  const handleSendToNutrition = () => {
    if (!builtPlan) return;
    const plan = applyEditsToPlan(builtPlan);
    try {
      const weeklySets = (plan.weeks || []).reduce((s, w) => s + (w.sessions || []).reduce((a, ses) => a + ses.exercises.filter((e: any) => !(e as any).warmupActivator).reduce((b, e) => b + (e.sets || 0), 0), 0), 0);
      // Трен-дни недели: индексы сессий с упражнениями (не отдых).
      const w0 = plan.weeks[0];
      const trainDays = (w0?.sessions || []).map((s, i) => ((s.exercises || []).some((e: any) => !(e as any).warmupActivator) ? i + 1 : 0)).filter(d => d > 0);
      const kcal = Math.round((plan as any).mrvMultiplier && (plan as any).mrvMultiplier >= 1.3 ? 2800 : 2500 + trainDays.length * 150);
      const proteinG = Math.round((plan.weeks[0]?.sessions || []).reduce((a, s) => a + s.exercises.reduce((b, e) => b + (e.sets || 0), 0), 0) > 0 ? 180 : 160);
      applyToPlanner({
        kind: 'bb_nutrition',
        label: `ББ-план → питание (${trainDays.length} трен-дня, ~${weeklySets} сетов/нед)`,
        data: { kcal, proteinG, trainDays, weeklySets, splitId: plan.pattern?.id },
      });
    } catch (e) {
      flash('⚠ Ошибка передачи в питание: ' + ((e as Error)?.message || e));
    }
  };

  /** Фаза 4.24: экспорт обычного ББ-плана в .ics (календарь) по датам недель. */
  const handleExportIcs = () => {
    if (!builtPlan) return;
    const plan = applyEditsToPlan(builtPlan);
    try {
      const startDate = startDateInput || new Date().toISOString().slice(0, 10);
      const ics = buildBBPlanIcs(plan, { startDate });
      const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bb-plan-${(plan.pattern?.id || 'plan')}.ics`;
      a.click();
      URL.revokeObjectURL(url);
      flash('📅 Календарь .ics скачан (по неделям/дням от ' + startDate + ')');
    } catch { flash('⚠ Не удалось сформировать .ics'); }
  };

  /** 4.7: печать «таблицы мезоцикла» — единый движковый buildBBPlanPrintHtml (фазы/таблица/heatmap). */
  const handlePrintMesocycleTable = () => {
    if (!builtPlan) return;
    const plan = applyEditsToPlan(builtPlan);
    try {
      const html = buildBBPlanPrintHtml(plan, { heatmap: true });
      const w = window.open('', '_blank');
      if (!w) { flash('Разрешите всплывающие окна для печати'); return; }
      w.document.write(html.replace('</body>', '<script>window.print()</script></body>'));
      w.document.close();
    } catch { flash('⚠ Не удалось сформировать таблицу мезоцикла'); }
  };

  /** 4.8: отчёт качество/безопасность/валидатор/рекомендации (txt) — единый движок + issues. */
  const handleExportQualityReport = () => {
    if (!builtPlan) return;
    const plan = applyEditsToPlan(builtPlan);
    try {
      const issues = (((builtPlan as any).validation?.issues ?? []) as Array<{ level?: string; code?: string; message: string }>);
      const recs = generateActionableRecommendations(plan, issues as any);
      const lines: string[] = [`ББ-ПЛАН: ${plan.pattern?.name || 'план'} · ${plan.weeks.length} нед`, ''];
      try { lines.push(buildBBPlanReportText(plan)); } catch { /* базовая сводка недоступна */ }
      if (qualityReport) {
        lines.push('', `КАЧЕСТВО: ${qualityReport.score}/100 (${qualityReport.riskLevel})`);
        for (const i of (qualityReport.issues || []).slice(0, 15)) lines.push(`  • [${i.source}]${i.week ? ` нед ${i.week}` : ''} ${i.message}`);
      }
      const safety = calculatePlanSafetyScore(plan, { acwrRatio: acwrData?.ratio, injuryCount: injuries.length });
      lines.push('', `БЕЗОПАСНОСТЬ: ${safety.score}/100 (${safety.riskLevel})`);
      for (const r of (safety.recommendations || []).slice(0, 5)) lines.push(`  • ${r}`);
      const errs = issues.filter(i => i.level === 'error');
      const warns = issues.filter(i => i.level === 'warning');
      lines.push('', `ВАЛИДАТОР: ${errs.length} ошибок, ${warns.length} предупреждений`);
      for (const i of issues.slice(0, 20)) lines.push(`  [${i.level}] ${i.message}`);
      if (recs.length) {
        lines.push('', 'РЕКОМЕНДАЦИИ:');
        for (const r of recs.slice(0, 10)) lines.push(`  (${r.priority}) ${r.action}`);
      }
      const text = lines.join('\n');
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bb-report-${plan.pattern?.id || 'plan'}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      flash('📄 Отчёт скачан: качество · безопасность · валидатор · рекомендации');
    } catch (e) { flash('⚠ Не удалось сформировать отчёт: ' + ((e as Error)?.message || e)); }
  };

  /** Фаза 4.23: календарные диапазоны недель от даты старта + «📍 текущая неделя». */
  const weekDateInfo = useMemo(() => {
    if (!builtPlan || !startDateInput) return null;
    try { return bbWeekDateRanges(applyEditsToPlan(builtPlan), { startDate: startDateInput }); }
    catch { return null; }
  }, [builtPlan, startDateInput, exerciseEdits]);
  const currentWeek = weekDateInfo?.find(w => w.isCurrent);

  /** PRO: CSV export — все сеты плана в CSV для Excel/Google Sheets. */
  const handleExportCSV = () => {
    if (!builtPlan) return;
    const plan = applyEditsToPlan(builtPlan);
    const rows: string[] = [['Неделя', 'День', 'Упражнение', 'Мышца', 'Роль', 'Сет', 'Повторы', 'Вес(кг)', 'RIR', 'Темп', 'Отдых(с)', 'Паттерн', 'Ключи техники', 'Растяжение', 'Пиковое сокращение', 'Ошибки', 'Комментарий', 'Техника/Схема'].join(',')];    for (const wk of plan.weeks) {
      for (let si = 0; si < wk.sessions.length; si++) {
        const s = wk.sessions[si];
        for (const ex of s.exercises) {
          const ws = ex.workSets || [];
          const chain = techniqueChainParts(ex);
          const feat = [...exerciseFeatureBadges(ex).map(b => b.label), ...(chain ? [chain.label + ': ' + chain.parts.join(' -> ')] : [])].join('; ');
          for (let i = 0; i < (ws.length || ex.sets); i++) {
            const set = ws[i] || { reps: ex.repsRange?.[0] || 10, weight: 0, rir: ex.rir };
            const esc = (v: any) => `"${String(v || '').replace(/"/g, '""')}"`;
            rows.push([
              wk.week, si + 1, esc(ex.exerciseName || ex.name), esc(ex.muscle),
              ex.role, i + 1, set.reps, set.weight, set.rir,
              esc(ex.tempoSpec || ''), ex.restSeconds || '',
              esc(ex.executionProfile?.pattern || ''),
              esc(ex.executionProfile?.cues.join('; ') || ''),
              esc(ex.executionProfile?.stretch || ''),
              esc(ex.executionProfile?.peak || ''),
              esc(ex.executionProfile?.mistakes.join('; ') || ''),
              esc(ex.comment || ''),
              esc(feat),
            ].join(','));
          }
        }
      }
    }
    const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bb-plan-${plan.pattern?.id || 'export'}-${plan.weeks.length}wk.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const stepList: Step[] = planMode === 'programs' ? ['params','ped','plan','weights','quality','adjust','contest','annual','tools'] : ['params','ped','split','plan','weights','quality','adjust','contest','annual','tools'];
  const stepLabels: Record<Step,string> = { params:'1 Параметры', ped:'2 PED+Вес', split:'3 Сплит', plan: planMode === 'programs' ? '3 План' : '4 План', weights: planMode === 'programs' ? '4 Реальные веса' : '5 Реальные веса', quality: planMode === 'programs' ? '5 Тренировочная нагрузка плана' : '6 Тренировочная нагрузка плана', adjust: planMode === 'programs' ? '6 Коррекция' : '7 Коррекция', contest: '🏁 Contest prep', annual:'🗓 Годовой план', tools:'🔧 Инструменты' };
  const renderStepNav = () => {
    const groups: Record<string, string[]> = planMode === 'programs'
      ? { 'ПАРАМЕТРЫ': ['params','ped'], 'ПЛАН': ['plan','weights','quality','adjust'], 'ЦИКЛ': ['contest','annual','tools'] }
      : { 'ПАРАМЕТРЫ': ['params','ped','split'], 'ПЛАН': ['plan','weights','quality','adjust'], 'ЦИКЛ': ['contest','annual','tools'] };
    const groupEndKeys = new Set(Object.values(groups).map(arr => (arr as string[])[(arr as string[]).length - 1]).filter(Boolean) as string[]);
    return (
      <div style={{ background: 'rgba(24,24,27,0.55)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '5px 6px', marginBottom: 8, display: 'flex', gap: 4, overflowX: 'auto' as const, scrollbarWidth: 'none' as const, WebkitOverflowScrolling: 'touch' as const, alignItems: 'center' }}>
        {stepList.map(s => {
          const active = step === s;
          const disabled = (s === 'plan' || s === 'weights' || s === 'quality' || s === 'adjust' || s === 'contest') && !builtPlan;
          return (
            <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 as const }}>
              <button disabled={disabled} onClick={() => { if (disabled) return; if (s === 'annual') { goAnnual(); return; } setStep(s); }} style={{ ...STEP_PILL(active), flexShrink: 0 as const, opacity: disabled ? 0.45 : 1 }}>{stepLabels[s]}</button>
              {groupEndKeys.has(s) && s !== stepList[stepList.length - 1] && <span style={{ width: 1, height: 18, background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.08), transparent)', flexShrink: 0 as const, margin: '0 2px', alignSelf: 'center' }} />}
            </span>
          );
        })}
      </div>
    );
  };

  // Переход на «Годовой план»: построенный цикл сохраняется автоматически
  // (возврат — через шаг «Коррекция»/«План»), чтобы не потерять работу.
  const goAnnual = () => {
    if (builtPlan && step !== 'annual') {
      try {
        localStorage.setItem('he_bb_plan_saved', JSON.stringify({ plan: applyEditsToPlan(builtPlan), date: new Date().toISOString() }));
        localStorage.removeItem('he_bb_plan_saved_prev');
        localStorage.removeItem('he_bb_plan_history');
        flash('Построенный цикл сохранён — годовой план можно строить и возвращаться');
      } catch { flash('Не удалось автосохранить цикл'); }
    }
    setStep('annual');
  };

  // 🔄 «Начать заново»: сбрасываем собранный план, все правки и contest prep,
  // чистим автосохранение (иначе план воскреснет при ремонтировании) и
  // возвращаемся на первый шаг. Параметры пользователя остаются на месте.
  const resetBuild = () => {
    setResetAsk(false);
    setBuiltPlan(null);
    setPrepApplied(false);
    setPrepPlan(null);
    setPeakPrep(null);
    setBbWeekSel(1);
    setExerciseEdits({});
    setEditMode(null);
    setSubTarget(null);
    setExSwapModal(null);
    setShowCompare(false);
    setShowPeakWeek(false);
    try { localStorage.removeItem('he_bb_plan_saved'); } catch { /* ignore */ }
    setStep('params');
    flash('🔄 Сборка сброшена — начинаем заново');
  };

  // Общий блок действий: «Начать работу по циклу/программе» + сохранение.
  // На шаге «План» кнопка старта уже в шапке, поэтому там рендерится только сохранение.
  const renderActionRow = (withStart: boolean) => {
    return (
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:10 }}>
        {withStart && (
          <button style={{ ...BTN, flex:'1 1 100%' }} onClick={handleSendToExecution}>▶ Начать работу по циклу/программе</button>
        )}
        <button style={{ ...BTN_GHOST, flex:'1 1 30%' }} onClick={handleSavePlan}>💾 Сохранить план</button>
        <button style={{ ...BTN_GHOST, flex:'1 1 30%' }} onClick={handleSaveToMyPlans}>💾 В Мои тренировки</button>
        <button style={{ ...BTN_GHOST, flex:'1 1 30%' }} onClick={handleSaveAsUserProgram}>📂 В Мои программы</button>
      </div>
    );
  };

  /** Единственная точка выбора специализации. Она живёт на шаге 1 независимо
   *  от источника программы; в шаге 2 выбор повторно не показывается. */
  const renderSpecializationSelection = () => {
    const blockWeekRange = (idx: number, weeks: number): string => {
      const start = specBlocks.slice(0, idx).reduce((sum, b) => sum + Math.max(3, Math.min(6, Math.round(b.weeks || 5))), 1);
      const end = Math.min(bbWeeks, start + Math.max(3, Math.min(6, Math.round(weeks || 5))) - 1);
      return `${start}-${end}`;
    };
    return (
      <div style={{ marginBottom:10, padding:'10px 12px', borderRadius:12, background:'rgba(245,158,11,0.05)', border:'1px solid rgba(245,158,11,0.18)' }}>
        <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b', marginBottom:6 }}>🎯 Отстающие мышцы (специализация, 1-2)</div>
        {specBlocks.map((b, idx) => (
          <div key={b.id} style={{ marginBottom:8, padding:'8px 10px', borderRadius:10, background:'rgba(0,0,0,0.18)', border:'1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', marginBottom:6 }}>
              <span style={{ fontSize:10, fontWeight:800, color:'#fbbf24' }}>Блок {idx + 1} · нед {blockWeekRange(idx, b.weeks)}</span>
              <PopupNumber label="" value={b.weeks} min={3} max={6} suffix=" нед" onChange={v => updateSpecBlock(b.id, { weeks: Math.max(3, Math.min(6, Math.round(v))) })} />
              <button onClick={() => removeSpecBlock(b.id)} disabled={specBlocks.length <= 1} style={{ marginLeft:'auto', padding:'3px 8px', borderRadius:8, fontSize:10, fontWeight:700, cursor:specBlocks.length<=1?'default':'pointer', border:'1px solid rgba(239,68,68,0.35)', background:'rgba(239,68,68,0.08)', color:'#f87171', opacity:specBlocks.length<=1?0.4:1 }}>✕ Удалить</button>
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:6 }}>
              {WEAK_GROUPS.map(([id, l]) => {
                const on = b.targets.includes(id);
                const disabled = specChipDisabled(b.targets, id, on);
                return (
                  <button key={id} disabled={disabled} onClick={() => updateSpecBlock(b.id, { targets: normalizeSpecializationTargets(on ? b.targets.filter(x => x !== id) : [...b.targets, id]) })}
                    style={{ padding:'4px 8px', borderRadius:999, cursor:disabled?'default':'pointer', fontSize:10, fontWeight:700, minHeight:32,
                      background:on?'rgba(245,158,11,0.18)':'rgba(255,255,255,0.04)',
                      border:on?'1px solid rgba(245,158,11,0.4)':'1px solid rgba(255,255,255,0.08)',
                      color:on?'#fbbf24':disabled?'rgba(255,255,255,0.25)':'#fff', opacity:disabled?0.5:1 }}>
                    {on ? '✓ ' : ''}{l}
                  </button>
                );
              })}
            </div>
            {b.targets.length > 0 && (
              <>
                <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:6 }}>
                  {([['none', 'Обычная специализация'], ['reduce_direct_to_floor', 'Снизить прямую работу доноров'], ['remove_direct_when_indirect_covers_floor', 'Убрать прямую работу, если хватает indirect']] as const).map(([mode, label]) => (
                    <button key={mode} onClick={() => updateSpecBlock(b.id, { tradeoffMode: mode })}
                      style={{ padding:'4px 8px', borderRadius:999, fontSize:9, fontWeight:700, cursor:'pointer', minHeight:30,
                        border: b.tradeoffMode === mode ? '1px solid #ec4899' : '1px solid rgba(255,255,255,0.08)',
                        background: b.tradeoffMode === mode ? 'rgba(236,72,153,0.15)' : 'rgba(255,255,255,0.03)',
                        color: b.tradeoffMode === mode ? '#ec4899' : '#fff' }}>{label}</button>
                  ))}
                </div>
                {b.tradeoffMode !== 'none' && (
                  <div style={{ marginBottom:6 }}>
                    <div style={{ fontSize:9, fontWeight:700, color:'#ec4899', marginBottom:4 }}>👤 Доноры (1-2, косвенная нагрузка сохраняется):</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                      {DONOR_GROUPS.map(([id, l]) => {
                        const on = b.donors.includes(id);
                        const expanded = expandDonorMuscles([id]);
                        const targetCanonical = b.targets.map(canonicalMuscle);
                        const existingDonors = expandDonorMuscles(b.donors);
                        const sameAsTarget = expanded.some(m => targetCanonical.includes(canonicalMuscle(m)));
                        const overlapsDonor = expanded.some(m => existingDonors.includes(canonicalMuscle(m)) && !on);
                        const disabled = !on && (b.donors.length >= 2 || sameAsTarget || overlapsDonor);
                        return (
                          <button key={id} disabled={disabled} onClick={() => updateSpecBlock(b.id, { donors: normalizeDonorTargets(on ? b.donors.filter(x => x !== id) : [...b.donors, id], b.targets) })}
                            style={{ padding:'4px 8px', borderRadius:999, cursor:disabled?'default':'pointer', fontSize:9, fontWeight:700, minHeight:30,
                              background:on?'rgba(236,72,153,0.15)':'rgba(255,255,255,0.03)',
                              border:on?'1px solid rgba(236,72,153,0.4)':'1px solid rgba(255,255,255,0.08)',
                              color:on?'#ec4899':disabled?'rgba(255,255,255,0.25)':'#fff', opacity:disabled?0.5:1 }}>
                            {on ? '✓ ' : ''}{l}
                          </button>
                        );
                      })}
                    </div>
                    <div style={{ marginTop:4, fontSize:9, color:'#fff', lineHeight:1.4 }}>
                      Косвенная нагрузка донора (тяги → бицепс, жимы → трицепс) всегда сохраняется; effective объём не опускается ниже MEV.
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
        <button onClick={addSpecBlock} style={{ width:'100%', padding:'6px 10px', borderRadius:10, fontSize:10, fontWeight:700, cursor:'pointer', border:'1px dashed rgba(236,72,153,0.4)', background:'rgba(236,72,153,0.04)', color:'#ec4899' }}>
          + Добавить блок специализации (3-6 нед)
        </button>
        {specSchedulePreview && <div style={{ marginTop:6, fontSize:10, color:'#fff', lineHeight:1.5 }}>Итог: {specSchedulePreview}</div>}
        {specTargets.length > 0 && (
          <div style={{ marginTop:6, fontSize:10, color:'#fff', lineHeight:1.5 }}>
            Базовый ориентир блока 1: {specVolumeSummary}. Фактический план дополнительно учитывает уровень, стаж, цель, PED, восстановление, питание, лабораторную коррекцию и фазу.
          </div>
        )}
      </div>
    );
  };

  const renderParams = () => (
    <BbParamsStep
      planMode={planMode}
      setPlanMode={setPlanMode}
      specializationSelection={renderSpecializationSelection()}
      mevCal={mevCal}
      setMevCal={setMevCal}
      mevDraft={mevDraft}
      setMevDraft={setMevDraft}
      startMEVCalibration={startMEVCalibration}
      commitMEVWeek={commitMEVWeek}
      resetMEVCalibration={resetMEVCalibration}
      bbSource={bbSource}
      setBbSource={setBbSource}
      selectedCycleId={selectedCycleId}
      setSelectedCycleId={setSelectedCycleId}
      bbCyclesList={bbCyclesList}
      setBbDays={setBbDays}
      setBbWeeks={setBbWeeks}
      selectedProgramId={selectedProgramId}
      bbLibraryPrograms={bbLibraryPrograms}
      applyProgramToBb={applyProgramToBb}
      customCycle={customCycle}
      bbAdaptMode={bbAdaptMode}
      setBbAdaptMode={setBbAdaptMode}
      bbLevel={bbLevel}
      setBbLevel={setBbLevel}
      bbGoal={bbGoal}
      setBbGoal={setBbGoal}
      bbTrainingYears={bbTrainingYears}
      setBbTrainingYears={setBbTrainingYears}
      bbDays={bbDays}
      bbWeeks={bbWeeks}
      bbSuggest={bbSuggest}
      bbTrainingFocus={bbTrainingFocus}
      setBbTrainingFocus={setBbTrainingFocus}
      bbMethodology={bbMethodology}
      setBbMethodology={setBbMethodology}
      intensityTech={intensityTech}
      setIntensityTech={setIntensityTech}
      dupMode={dupMode}
      setDupMode={setDupMode}
      dupRecommendChip={dupRecommendChip}
      dupMuscles={dupMuscles}
      setDupMuscles={setDupMuscles}
      supersetMode={supersetMode}
      setSupersetMode={setSupersetMode}
      volumeScheme={volumeScheme}
      setVolumeScheme={setVolumeScheme}
      pedDoses={pedDoses}
      peds={peds}
      loadStrategy={loadStrategy}
      setLoadStrategy={setLoadStrategy}
      onUserLoadStrategy={onUserLoadStrategy}
      deloadType={deloadType}
      setDeloadType={setDeloadType}
      onUserDeloadType={onUserDeloadType}
      onUserIntensityTech={onUserIntensityTech}
      eccentricMult={eccentricMult}
      setEccentricMult={setEccentricMult}
      calorieSurplus={calorieSurplus}
      setCalorieSurplus={setCalorieSurplus}
      rotationMode={rotationMode}
      setRotationMode={setRotationMode}
      intensityLevel={intensityLevel}
      setIntensityLevel={setIntensityLevel}
      bbVolGoal={bbVolGoal}
      setBbVolGoal={setBbVolGoal}
      onUserVolGoal={onUserVolGoal}
      trainingVolumeMode={trainingVolumeMode}
      setTrainingVolumeMode={setTrainingVolumeMode}
      avoidAxialLoadUi={avoidAxialLoadUi}
      setAvoidAxialLoadUi={setAvoidAxialLoadUi}
      fewerCompound={fewerCompound}
      setFewerCompound={setFewerCompound}
      allowStrengthLifts={allowStrengthLifts}
      setAllowStrengthLifts={setAllowStrengthLifts}
      abRotation={abRotation}
      setAbRotation={setAbRotation}
      packingV2={packingV2}
      setPackingV2={setPackingV2}
      autoRegOn={autoRegOn}
      setAutoRegOn={setAutoRegOn}
      labAdjust={labAdjust}
      labMultOverride={labMultOverride}
      setLabMultOverride={setLabMultOverride}
      recoveryOverride={recoveryOverride}
      setRecoveryOverride={setRecoveryOverride}
      bbFavEx={bbFavEx}
      setBbFavEx={setBbFavEx}
      bbExclEx={bbExclEx}
      setBbExclEx={setBbExclEx}
      syncProf={syncProf}
      bbEquipment={bbEquipment}
      setBbEquipment={setBbEquipment}
      platePreset={platePreset}
      setPlatePreset={setPlatePreset}
      isFemaleProfile={linked?.profile?.settings?.personal?.sex === 'female'}
      cycleDay={cycleDay}
      setCycleDay={setCycleDay}
      targetBodyFat={targetBodyFat}
      setTargetBodyFat={setTargetBodyFat}
      wearableData={wearableData}
      setWearableTick={setWearableTick}
      injuries={injuries}
      setInjuries={setInjuries}
      rehabMuscles={rehabMuscles}
      setRehabMuscles={setRehabMuscles}
      mobilityRestrictions={mobilityRestrictions}
      setMobilityRestrictions={setMobilityRestrictions}
      autoDeload={autoDeload}
      setAutoDeload={setAutoDeload}
      savedPlans={savedPlans}
      usePreviousPlan={usePreviousPlan}
      setUsePreviousPlan={setUsePreviousPlan}
      flash={flash}
      setStep={setStep}
    />
  );

  const renderPedWorkMax = () => (
    <BbPedWorkMaxStep
      peds={peds} setPeds={setPeds}
      pedDoses={pedDoses} setPedDoses={setPedDoses}
      courseIntensity={courseIntensity} setCourseIntensity={setCourseIntensity}
      pedAdapt={pedAdapt}
      level={bbLevel} goal={bbGoal} trainingFocus={bbTrainingFocus} weeks={bbWeeks}
      pedPhaseOverride={pedPhaseOverride} setPedPhaseOverride={setPedPhaseOverride}
      proPreset={proPreset} setProPreset={setProPreset}
      dupMode={dupMode} setDupMode={setDupMode}
      supersetMode={supersetMode} setSupersetMode={setSupersetMode}
      volumeScheme={volumeScheme} setVolumeScheme={setVolumeScheme}
      methodology={bbMethodology} setMethodology={setBbMethodology}
      bfrMode={bfrMode} setBfrMode={setBfrMode}
      dcMode={dcMode} setDcMode={setDcMode}
      blastCruiseEnabled={blastCruiseEnabled} setBlastCruiseEnabled={setBlastCruiseEnabled}
      blastWeeks={blastWeeks} setBlastWeeks={setBlastWeeks}
      cruiseWeeks={cruiseWeeks} setCruiseWeeks={setCruiseWeeks}
      workMax={bbWorkMax} setWorkMax={setBbWorkMax}
      planMode={planMode}
      onBuild={buildBb}
      onNext={() => setStep('split')}
      onBackToParams={() => setStep('params')}
      flash={flash}
    />
  );

  const renderSplit = () => (
    <BbSplitStep
      selectedSplitId={selectedSplitId}
      onSelectSplit={id => { splitTouched.current = true; setSelectedSplitId(id); }}
      bestSplit={bestSplit}
      phases={phases}
      ranked={ranked}
      suggestSplitIds={bbSuggest.splitHints}
      goal={bbGoal}
      level={bbLevel}
      weeks={bbWeeks}
      isBuilding={isBuilding}
      onBuild={buildBb}
      onBack={() => setStep('ped')}
    />
  );

  const renderPlanWithComments = () => (
    <BbPlanStep
      builtPlan={builtPlan}
      metrics={metrics}
      bbWeekSel={bbWeekSel}
      setBbWeekSel={setBbWeekSel}
      bbWeeks={bbWeeks}
      autoDeload={autoDeload}
      weakPoints={weakPoints}
      dupMode={dupMode}
      autoRegOn={autoRegOn}
      autoRegResult={autoRegResult}
      exerciseEdits={exerciseEdits}
      setExerciseEdits={setExerciseEdits}
      editMode={editMode}
      setEditMode={setEditMode}
      collapsedDays={collapsedDays}
      setCollapsedDays={setCollapsedDays}
      collapsedExercises={collapsedExercises}
      setCollapsedExercises={setCollapsedExercises}
      bbTrainingFocus={bbTrainingFocus}
      bbLevel={bbLevel}
      setSubTarget={setSubTarget}
      handleSendToExecution={handleSendToExecution}
      setWeightEntries={setWeightEntries}
      setWeightsApplied={setWeightsApplied}
      setStep={setStep}
      actionRow={renderActionRow(false)}
    />
  );

  // ── ⚖️ Реальные веса: фактический ввод весов по упражнениям плана ──
  const renderWeights = () => (
    <BbWeightsStep
      builtPlan={builtPlan}
      setBuiltPlan={setBuiltPlan}
      weightEntries={weightEntries}
      setWeightEntries={setWeightEntries}
      weightsApplied={weightsApplied}
      setWeightsApplied={setWeightsApplied}
      weightsCollapsed={weightsCollapsed}
      setWeightsCollapsed={setWeightsCollapsed}
      onGoQuality={() => setStep('quality')}
      onBack={() => setStep('plan')}
    />
  );


  const renderQuality = () => {
    if (!metrics || !quality || !builtPlan) return null;
    const W = builtPlan.weeks;
    // Единый ACWR из селектора (а не 5 расчётов)
    const ratio = acwrData;
    return (
      <div>
        {/* 🛡 Единое качество — агрегат validation/balance/rotation/safety (Epic F) */}
        <BbQualityUnifiedCard
          qualityReport={qualityReport}
          builtPlan={builtPlan}
          vbtInput={vbtInput}
          setVbtInput={setVbtInput}
          readiness={(linked?.readiness?.recovery ?? linked?.profile?.settings?.lifestyle?.morningHRV) ? 65 : null}
          bbQualityV2={bbQualityV2}
          todayBadge={todayBadge}
        />
        {/* 🧠 Логика построения плана — вынесена первой в Шаге 5 */}
        {(() => {
          const levelRu: Record<string,string> = { beginner:'новичок', intermediate:'средний', advanced:'продвинутый', enhanced:'продвинутый+' };
          const goalRu: Record<string,string> = { mass:'масса', cut:'сушка', recomp:'рекомпозиция', maintenance:'поддержание', strength_mass:'сила+масса', strength:'сила' };
          const focusRu: Record<string,string> = { hypertrophy:'гипертрофия', strength:'сила', endurance:'выносливость' };
          const methRu: Record<string,string> = { compound_first:'база → изоляция', pre_exhaust:'предутомление', post_exhaust:'пост-утомление', mountain_dog:'Mountain Dog', fst7:'FST-7 порядок', hyperemia:'Hyperemia', antagonistic:'антагонисты', giant_sets:'гигант-сеты' };
          const volRu: Record<string,string> = { mev:'минимум (MEV)', mav:'оптимум (MAV)', mrv:'максимум (MRV)' };
          const stratRu: Record<string,string> = { double_progression:'двойная', linear:'линейная', wave:'волновая', rpe_based:'RPE-регуляция', undulating:'волновая', block:'блочная' };
          const totalW = builtPlan.weeks.length;
          const phaseGroups: Record<string, number[]> = {};
          for (const w of builtPlan.weeks) { const pr = ((w as any).phase || 'accumulation') as string; if (!phaseGroups[pr]) phaseGroups[pr]=[]; phaseGroups[pr].push(w.week); }
          const phaseRu: Record<string,string> = { accumulation:'накопление', intensification:'интенсификация', deload:'разгрузка', peaking:'пик' };
          const phaseText = Object.entries(phaseGroups).map(([pr,ws])=> `${phaseRu[pr]||pr} ${ws.length} нед`).join(' · ');
          const sel = ranked.find(r=> r.pattern.id===builtPlan.pattern?.id);
          const scoreText = sel ? `${sel.score}/${Math.max(...ranked.map(r=>r.score),1)}` : '—';
          const topAlt = ranked.slice(0,3).map(r=> `${r.pattern.name} ${r.score}`).join(' · ');
          const injText = injuries.length ? injuries.map(i=> `${i.muscle}${i.exclude?' (искл.)':' (щадящ.)'}`).join(', ') : 'нет';
          const mobText = mobilityRestrictions.length ? mobilityRestrictions.join(', ') : 'нет';
          const equipText = bbEquipment.length ? bbEquipment.slice(0,4).join(', ') : 'всё доступно';
          const specText = specTargets.length ? specTargets.join(' + ') : 'баланс';
          const pedMult = (pedAdapt as any).combinedMrvMultiplier ?? 1;
          const pedLabel = pedMult>1 ? `MRV ×${Number(pedMult).toFixed(2)} · ${peds.join(', ')||'курс'}` : 'натурал';
          return <CollapsibleCard title="🧠 Логика построения плана" defaultOpen={true} headerStyle={{ background: 'linear-gradient(135deg, rgba(96,165,250,0.18), rgba(96,165,250,0.08))', color: '#60a5fa' }} badge={`${totalW} нед · ${builtPlan.pattern?.name || ''}`}>
            <div style={{ ...CARD, marginTop:0, padding:0, overflow:'hidden', border:'1px solid rgba(96,165,250,0.22)', background:'rgba(15,23,42,0.38)' }}>
              <div style={{ padding:'10px 12px', display:'grid', gap:10 }}>
                <CollapsibleCard title="1 · Вход и цель" defaultOpen={true} headerStyle={{ background: 'linear-gradient(135deg, rgba(96,165,250,0.10), rgba(96,165,250,0.03))', color: '#60a5fa' }}>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                    {[
                      `уровень: ${levelRu[bbLevel]||bbLevel} (${bbTrainingYears} г)`,
                      `цель: ${goalRu[bbGoal]||bbGoal}`,
                      `фокус: ${focusRu[bbTrainingFocus]||bbTrainingFocus}`,
                      `методика: ${methRu[bbMethodology]||bbMethodology}`,
                      `объём: ${volRu[bbVolGoal]||bbVolGoal}${trainingVolumeMode==='high'?' · объёмный режим':''}`,
                      `прогрессия: ${stratRu[loadStrategy]||loadStrategy} · RIR ${(getPhaseConfig('accumulation', bbTrainingFocus as any) as any).rir ?? '2–3'}→${(getPhaseConfig('intensification', bbTrainingFocus as any) as any).rir ?? '1–2'}`,
                    ].map((t,i)=> <span key={i} style={{ fontSize:10, color:'#fff', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', padding:'3px 7px', borderRadius:20 }}>{t}</span>)}
                  </div>
                  <div style={{ fontSize:10, color:'#fff', opacity:0.7, lineHeight:1.35, marginTop:6 }}>
                    Уровень задаёт капы подходов/упражнений и доступ к сложным техникам · цель меняет фазовый профиль (масса — больше накопления, сушка — ниже объём) · фокус меняет RIR/повторы/темп · методика — порядок упражнений в сессии.
                  </div>
                </CollapsibleCard>
                <CollapsibleCard title="2 · Сплит — почему выбран" defaultOpen={false} headerStyle={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.10), rgba(168,85,247,0.03))', color: '#a78bfa' }}>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
                    <span style={{ fontSize:11, fontWeight:800, color:'#fff', background:'rgba(168,85,247,0.12)', border:'1px solid rgba(168,85,247,0.22)', padding:'4px 8px', borderRadius:8 }}>{builtPlan.pattern?.name || '—'} · {bbDays}×/нед · {totalW} нед</span>
                    <span style={{ fontSize:11, fontWeight:700, color: (sel ? (Number(scoreText.split('/')[0])/Number(scoreText.split('/')[1]||1) >=0.8 ? '#22c55e' : Number(scoreText.split('/')[0])/Number(scoreText.split('/')[1]||1) >=0.6 ? '#f59e0b' : '#ef4444') : '#fff') }}>скор {scoreText}</span>
                  </div>
                  {sel && <div style={{ fontSize:10, color:'#fff', opacity:0.78, lineHeight:1.35, marginTop:6 }}><b>Подходит из-за:</b> {sel.rationale.slice(0,2).join(' · ') || 'баланс по дням и уровню'}</div>}
                  <div style={{ fontSize:10, color:'#fff', opacity:0.62, lineHeight:1.35, marginTop:4 }}>Альтернативы топ-3: {topAlt || '—'} · слабые: {weakPoints.join(', ')||'баланс'} · специализация: {specText}</div>
                  {sel?.warnings?.length ? <div style={{ fontSize:10, color:'#f59e0b', marginTop:4 }}>⚠ {sel.warnings.slice(0,2).join(' · ')}</div> : null}
                </CollapsibleCard>
                <CollapsibleCard title="3 · Периодизация — как меняется нагрузка" defaultOpen={false} headerStyle={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.10), rgba(34,197,94,0.03))', color: '#22c55e' }}>
                  <div style={{ display:'flex', gap:2, height:8, borderRadius:6, overflow:'hidden', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)' }}>
                    {builtPlan.weeks.map(w=>{ const pr = ((w as any).phase || 'accumulation') as BBPhase; return <div key={w.week} title={`Нед ${w.week}: ${phaseRu[pr]||pr}`} style={{ flex:1, background: PHASE_COLORS[pr]||'#fff', opacity:0.9 }} />; })}
                  </div>
                  <div style={{ fontSize:10, color:'#fff', lineHeight:1.35, marginTop:6 }}><b>Фазы:</b> {phaseText} · <b>RIR:</b> накопление {String((getPhaseConfig('accumulation', bbTrainingFocus as any) as any).rir || '2–3')} → интенсификация {String((getPhaseConfig('intensification', bbTrainingFocus as any) as any).rir || '1–2')} · <b>темп:</b> {getPhaseConfig('accumulation', bbTrainingFocus as any).tempo} → {getPhaseConfig('intensification', bbTrainingFocus as any).tempo}</div>
                  <div style={{ fontSize:10, color:'#fff', opacity:0.62, marginTop:4 }}>Прогрессия весов: {stratRu[loadStrategy]||loadStrategy} · делод: {DELOAD_PROTOCOLS[deloadType]?.description || deloadType} · DUP {dupMode} · суперсеты {supersetMode} · схемы {volumeScheme}</div>
                </CollapsibleCard>
                <CollapsibleCard title="4 · Объём и восстановление — стратегия" defaultOpen={false} headerStyle={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.10), rgba(245,158,11,0.03))', color: '#f59e0b' }}>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                    <span style={{ fontSize:10, color:'#fff', background: pedMult>1?'rgba(245,158,11,0.12)':'rgba(255,255,255,0.04)', border:`1px solid ${pedMult>1?'rgba(245,158,11,0.22)':'rgba(255,255,255,0.06)'}`, padding:'3px 7px', borderRadius:20 }}>{pedLabel}</span>
                    <span style={{ fontSize:10, color:'#fff', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', padding:'3px 7px', borderRadius:20 }}>лимиты {builtPlan.maxWorkingSets} сетов / {builtPlan.maxExercises} упр. · режим {sessionLimitsFor({onCourse: pedMult>1, level: bbLevel, trainingYears: bbTrainingYears, trainingVolumeMode} as any).weeklyWorkingSets} в неделю</span>
                  </div>
                  <div style={{ fontSize:10, color:'#fff', opacity:0.7, lineHeight:1.35, marginTop:6 }}>Детализация по мышцам — в карточке «Тренировочный объём» ниже: там прямой/косвенный, недельный и общий, подмышцы и статус MEV/MAV/MRV.</div>
                </CollapsibleCard>
                <CollapsibleCard title="5 · Приоритеты" defaultOpen={false} headerStyle={{ background: 'linear-gradient(135deg, rgba(236,72,153,0.10), rgba(236,72,153,0.03))', color: '#ec4899' }}>
                  <div style={{ fontSize:10, color:'#fff', lineHeight:1.45 }}>
                    <div><b>Слабые:</b> {weakPoints.length? weakPoints.join(' · ') : 'баланс — без акцента'}</div>
                    <div><b>Специализация:</b> {specText}{specTargets.length? ` · блоки: ${specTargets.length} (по ${Math.round(bbWeeks/Math.max(1,specTargets.length))} нед)` : ''}</div>
                    {builtPlan.rationale?.some((r:string)=> /специализ|донор/i.test(r)) && <div style={{ opacity:0.75, marginTop:4 }}>Донорское перераспределение сохраняет косвенную нагрузку до MEV — прямой объём донора снижается, целевой растёт.</div>}
                  </div>
                </CollapsibleCard>
                <CollapsibleCard title="6 · Безопасность" defaultOpen={false} headerStyle={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.10), rgba(239,68,68,0.03))', color: '#ef4444' }}>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                    <span style={{ fontSize:10, color:'#fff', background: injuries.length?'rgba(239,68,68,0.10)':'rgba(34,197,94,0.08)', border:`1px solid ${injuries.length?'rgba(239,68,68,0.18)':'rgba(34,197,94,0.16)'}`, padding:'3px 7px', borderRadius:20 }}>травмы: {injText}</span>
                    <span style={{ fontSize:10, color:'#fff', background: mobilityRestrictions.length?'rgba(245,158,11,0.10)':'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', padding:'3px 7px', borderRadius:20 }}>мобильность: {mobText}</span>
                    <span style={{ fontSize:10, color:'#fff', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', padding:'3px 7px', borderRadius:20 }}>оборудование: {equipText}</span>
                    {avoidAxialLoadUi || (builtPlan.safetyConstraints as any)?.avoidAxialLoad ? <span style={{ fontSize:10, color:'#f59e0b', background:'rgba(245,158,11,0.12)', border:'1px solid rgba(245,158,11,0.22)', padding:'3px 7px', borderRadius:20 }}>без осевой</span> : null}
                    {fewerCompound ? <span style={{ fontSize:10, color:'#fff', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', padding:'3px 7px', borderRadius:20 }}>меньше многосуставных</span> : null}
                    {abRotation && isAbRotationActive(builtPlan) ? <span style={{ fontSize:10, color:'#22d3ee', background:'rgba(34,211,238,0.10)', border:'1px solid rgba(34,211,238,0.25)', padding:'3px 7px', borderRadius:20 }}>🔀 A/B ротация</span> : null}
                    {packingV2 && isPackingActive(builtPlan) ? <span style={{ fontSize:10, color:'#a78bfa', background:'rgba(167,139,250,0.10)', border:'1px solid rgba(167,139,250,0.25)', padding:'3px 7px', borderRadius:20 }}>📦 Packing заливка</span> : null}
                    {packingV2 && !isPackingActive(builtPlan) ? <span title="Тогл включён, но заливка не сработала (weak/focus-цель, deload или нечего паковать)" style={{ fontSize:10, color:'#fff', opacity:0.55, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', padding:'3px 7px', borderRadius:20 }}>Packing — не применён</span> : null}
                    {abRotation && !isAbRotationActive(builtPlan) ? <span title="Тогл включён, но план дословный (faithful) или без sibling-сессий — ротировать нечего" style={{ fontSize:10, color:'#fff', opacity:0.55, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', padding:'3px 7px', borderRadius:20 }}>A/B ротация — не применена</span> : null}
                  </div>
                </CollapsibleCard>
                <CollapsibleCard title="7 · Выбранные методики — детально" defaultOpen={false} headerStyle={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(139,92,246,0.04))', color: '#a78bfa' }} badge={`${[bbMethodology, loadStrategy, intensityTech, volumeScheme, supersetMode, dupMode, deloadType].filter(v=>v!=='none'&&v!=='standard'&&v!=='compound_first').length} активных`}>
                  <div style={{ display:'grid', gap:8 }}>
                    {(() => {
                      const methRu: Record<string,string> = { compound_first:'База → изоляция', pre_exhaust:'Пред-истощение', post_exhaust:'Пост-истощение', mountain_dog:'Mountain Dog', fst7:'FST-7 порядок', hyperemia:'Гиперемия', antagonistic:'Антагонисты', giant_sets:'Гигант-сеты' };
                      const stratRu: Record<string,string> = { double_progression:'Двойная прогрессия', linear:'Линейная', wave:'Волновая', rpe_based:'RPE-авто', undulating:'Волновая', block:'Блочная' };
                      const techRu: Record<string,string> = { none:'—', drop_set:'Дроп-сет', rest_pause:'Рест-пауза', myo_rep:'Мио-репс', giant_set:'Гигант-сет', superset:'Суперсет' } as any;
                      const schemeRu: Record<string,string> = { standard:'Стандарт', gvt:'GVT 10×10', fst7:'FST-7', gironda:'8×8 Жиронда' };
                      const superRu: Record<string,string> = { none:'—', antagonist:'Антагонисты', same_muscle:'Одна группа', giant:'Гигант' };
                      const dupRu: Record<string,string> = { none:'—', heavy_light:'Тяж/Лёг', strength_hypertrophy:'Сила/Гипер', full_dup:'Полный DUP' };
                      const deloadRu: Record<string,string> = { pump:'Памп', strength:'Силовая', custom:'Кастом' } as any;
                      const focusRu: Record<string,string> = { hypertrophy:'Гипертрофия', strength:'Сила', endurance:'Выносливость' };
                      const p: any = builtPlan as any;
                      const actualMeth = p.methodology || bbMethodology;
                      const actualStrat = p.loadStrategy || loadStrategy;
                      const actualScheme = p.volumeScheme || volumeScheme;
                      const actualSuper = p.supersetMode || supersetMode;
                      const actualDup = p.dupMode || dupMode;
                      const actualDeload = p.deloadType || deloadType;
                      const actualFocus = p.trainingFocus || bbTrainingFocus;
                      const actualVolMode = p.trainingVolumeMode || trainingVolumeMode;
                      const selItems: Array<{label:string, selected:string, actual:string, selectedRu:string, actualRu:string, changed:boolean}> = [
                        { label:'Порядок упражнений', selected: bbMethodology, actual: actualMeth, selectedRu: methRu[bbMethodology]||bbMethodology, actualRu: methRu[actualMeth]||actualMeth, changed: bbMethodology!==actualMeth },
                        { label:'Прогрессия нагрузки', selected: loadStrategy, actual: actualStrat, selectedRu: stratRu[loadStrategy]||loadStrategy, actualRu: stratRu[actualStrat]||actualStrat, changed: loadStrategy!==actualStrat },
                        { label:'Интенсив-техника', selected: intensityTech, actual: (p.intensityTechnique||intensityTech||'none'), selectedRu: techRu[intensityTech]||intensityTech, actualRu: techRu[p.intensityTechnique||intensityTech||'none']|| (p.intensityTechnique||intensityTech), changed: intensityTech!==(p.intensityTechnique||intensityTech) },
                        { label:'Схема объёма', selected: volumeScheme, actual: actualScheme, selectedRu: schemeRu[volumeScheme]||volumeScheme, actualRu: schemeRu[actualScheme]||actualScheme, changed: volumeScheme!==actualScheme },
                        { label:'Суперсеты', selected: supersetMode, actual: actualSuper, selectedRu: superRu[supersetMode]||supersetMode, actualRu: superRu[actualSuper]||actualSuper, changed: supersetMode!==actualSuper },
                        { label:'DUP', selected: dupMode, actual: actualDup, selectedRu: dupRu[dupMode]||dupMode, actualRu: dupRu[actualDup]||actualDup, changed: dupMode!==actualDup },
                        { label:'Разгрузка', selected: deloadType, actual: actualDeload, selectedRu: deloadRu[deloadType]||deloadType, actualRu: deloadRu[actualDeload]||actualDeload, changed: deloadType!==actualDeload },
                        { label:'Фокус', selected: bbTrainingFocus, actual: actualFocus, selectedRu: focusRu[bbTrainingFocus]||bbTrainingFocus, actualRu: focusRu[actualFocus]||actualFocus, changed: bbTrainingFocus!==actualFocus },
                        { label:'Объёмный режим', selected: trainingVolumeMode, actual: actualVolMode, selectedRu: trainingVolumeMode==='high'?'Объёмный':'Стандарт', actualRu: actualVolMode==='high'?'Объёмный':'Стандарт', changed: trainingVolumeMode!==actualVolMode },
                      ];
                      const abActive = isAbRotationActive(builtPlan);
                      const packActive = isPackingActive(builtPlan);
                      const extraItems: Array<{label:string, value:string, active:boolean}> = [
                        { label:'A/B ротация', value: !abRotation ? 'Выкл' : (abActive ? 'Вкл' : 'Вкл (не применена)'), active: abRotation && abActive },
                        { label:'Packing заливка', value: !packingV2 ? 'Выкл' : (packActive ? 'Вкл' : 'Вкл (не применён)'), active: packingV2 && packActive },
                        { label:'BFR', value: bfrMode ? 'Вкл' : 'Выкл', active: bfrMode },
                        { label:'Blast/Cruise', value: blastCruiseEnabled ? `${blastWeeks}н/${cruiseWeeks}н` : 'Выкл', active: blastCruiseEnabled },
                        { label:'Авто-разгрузка', value: autoDeload ? 'Вкл' : 'Выкл', active: autoDeload },
                        { label:'Ротация', value: rotationMode, active: rotationMode!=='variety' },
                        { label:'Меньше базы', value: fewerCompound ? 'Да' : 'Нет', active: fewerCompound },
                        { label:'Силовые лифты', value: allowStrengthLifts ? 'Да' : 'Нет', active: allowStrengthLifts },
                        { label:'Без осевой', value: avoidAxialLoadUi ? 'Да' : 'Нет', active: avoidAxialLoadUi },
                        { label:'Эксцентрик', value: `×${eccentricMult}`, active: eccentricMult!==1 },
                        { label:'PED', value: peds.length? peds.join(', '):'—', active: peds.length>0 },
                      ];
                      const methodsSummary = (()=>{ try{ return buildBBMethodologySummary(builtPlan); } catch{ return []; } })();
                      return (
                        <div style={{ display:'grid', gap:8 }}>
                          <div style={{ fontSize:10, color:'#fff', opacity:0.7, lineHeight:1.35 }}>Показано что выбрал пользователь и что реально используется в плане. Если отличается — применена автокоррекция (уровень, травмы, оборудование).</div>
                          <div style={{ display:'grid', gap:6 }}>
                            {selItems.map((it,i)=> (
                              <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, padding:'6px 8px', borderRadius:8, background: it.changed? 'rgba(245,158,11,0.08)':'rgba(255,255,255,0.03)', border: it.changed? '1px solid rgba(245,158,11,0.18)':'1px solid rgba(255,255,255,0.05)' }}>
                                <span style={{ fontSize:11, fontWeight:700, color:'#fff' }}>{it.label}</span>
                                <span style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap', justifyContent:'flex-end' }}>
                                  <span style={{ fontSize:10, color: it.changed? '#f59e0b':'#fff', background:'rgba(255,255,255,0.04)', padding:'2px 6px', borderRadius:6, textDecoration: it.changed? 'line-through': undefined, opacity: it.changed?0.6:1 }}>{it.selectedRu}</span>
                                  <span style={{ fontSize:10, color:'#fff', opacity:0.5 }}>→</span>
                                  <span style={{ fontSize:10, fontWeight:800, color: it.changed? '#f59e0b':'#22c55e', background: it.changed? 'rgba(245,158,11,0.12)':'rgba(34,197,94,0.10)', padding:'2px 6px', borderRadius:6, border: it.changed? '1px solid rgba(245,158,11,0.22)':'1px solid rgba(34,197,94,0.18)' }}>{it.actualRu}{it.changed?' ⚠️':''}</span>
                                </span>
                              </div>
                            ))}
                          </div>
                          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px, 1fr))', gap:6 }}>
                            {extraItems.map((it,i)=> (
                              <div key={i} style={{ padding:'5px 7px', borderRadius:8, background: it.active? 'rgba(139,92,246,0.10)':'rgba(255,255,255,0.03)', border: it.active? '1px solid rgba(139,92,246,0.18)':'1px solid rgba(255,255,255,0.05)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                <span style={{ fontSize:10, color:'#fff', opacity:0.7 }}>{it.label}</span>
                                <span style={{ fontSize:10, fontWeight:700, color: it.active? '#a78bfa':'#fff' }}>{it.value}</span>
                              </div>
                            ))}
                          </div>
                          {methodsSummary.length>0 && (
                            <div style={{ padding:'6px 8px', borderRadius:8, background:'rgba(139,92,246,0.06)', border:'1px solid rgba(139,92,246,0.12)' }}>
                              <div style={{ fontSize:10, fontWeight:800, color:'#a78bfa', marginBottom:4 }}>🧩 Фактически применённые методики в плане:</div>
                              {methodsSummary.map((m,idx)=> <div key={idx} style={{ fontSize:10, color:'#fff', marginBottom:2, paddingLeft:6, borderLeft:'2px solid rgba(139,92,246,0.3)' }}>{m}</div>)}
                            </div>
                          )}
                          <div style={{ fontSize:9, color:'#fff', opacity:0.5, lineHeight:1.3, padding:'4px 6px', background:'rgba(255,255,255,0.02)', borderRadius:6, border:'1px solid rgba(255,255,255,0.04)' }}>
                            Источник: `inputSnapshot` (выбор) vs `builtPlan` (факт) + `buildBBMethodologySummary` (анализ комментариев плана). Отличия — автокоррекция по уровню/травмам/оборудованию.
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </CollapsibleCard>
              </div>
            </div></CollapsibleCard>
          ;
         })()}
        <div style={{ ...CARD, padding:0, overflow:'hidden', marginBottom:8, border:'1px solid rgba(96,165,250,0.22)', background:'rgba(15,23,42,0.32)' }}>
          <button type="button" onClick={() => setGeneralSafetyLoadOpen(v=>!v)} aria-expanded={generalSafetyLoadOpen} style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 14px', cursor:'pointer', background:'linear-gradient(135deg, rgba(239,68,68,0.16), rgba(96,165,250,0.06))', border:'none', borderBottom: generalSafetyLoadOpen ? '1px solid rgba(255,255,255,0.06)' : 'none', textAlign:'left' }}>
             <span style={{ fontSize:14, fontWeight:900, color:'#fff' }}>🛡️ Безопасность плана</span>
            <span style={{ width:32, height:32, borderRadius:8, display:'inline-flex', alignItems:'center', justifyContent:'center', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', color:'#fff', fontSize:13, transform: generalSafetyLoadOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition:'transform 0.2s' }}>▼</span>
          </button>
          <div style={{ display: generalSafetyLoadOpen ? 'block' : 'none', padding:'8px 12px' }}>
            {safetyScore && (
              <div role="status" aria-label={`SafetyScore ${safetyScore.score} из 100`} style={{ marginBottom: 10, borderRadius: 14, border: `1px solid ${safetyScore.riskLevel === 'safe' ? '#22c55e' : safetyScore.riskLevel === 'caution' ? '#f59e0b' : '#ef4444'}`, background: 'rgba(255,255,255,0.03)', overflow:'hidden' }}>
                <button type="button" onClick={() => setSafetyOpen(v=>!v)} aria-expanded={safetyOpen} style={{ width:'100%', display:'flex', gap:12, alignItems:'center', padding:12, cursor:'pointer', background: `linear-gradient(135deg, ${safetyScore.riskLevel==='safe'?'rgba(34,197,94,0.14)': safetyScore.riskLevel==='caution'?'rgba(245,158,11,0.14)':'rgba(239,68,68,0.14)'}, transparent)`, border:'none', borderBottom: safetyOpen ? '1px solid rgba(255,255,255,0.06)' : 'none', textAlign:'left' }}>
                  <div style={{ width:62, height:62, borderRadius:16, display:'flex', alignItems:'center', justifyContent:'center', background: safetyScore.riskLevel==='safe'?'#22c55e': safetyScore.riskLevel==='caution'?'#f59e0b':'#ef4444', color:'#000', fontWeight:900, fontSize:22, boxShadow:'0 4px 12px rgba(0,0,0,0.25)' }}>{safetyScore.score}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:800, color:'#fff' }}>🛡 Безопасность плана: {safetyScore.score}/100 · {safetyScore.riskLevel === 'safe' ? 'Безопасный' : safetyScore.riskLevel === 'caution' ? 'Требует внимания' : 'Опасный'}</div>
                    <div style={{ fontSize:11, color:'#fff', opacity:0.9, marginTop:2, lineHeight:1.3 }}>{safetyScore.recommendations[0]}</div>
                    <div style={{ fontSize:10, color:'#fff', opacity:0.55, marginTop:4 }}>Веса: суставы 20 · ACWR 20 · восстановление 15 · травмы 15 · MRV 15 · частота 5 · баланс 10 = 100 · Формула каждого фактора — ниже</div>
                  </div>
                  <span style={{ width:32, height:32, borderRadius:8, display:'inline-flex', alignItems:'center', justifyContent:'center', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', color:'#fff', fontSize:13, transform: safetyOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition:'transform 0.2s' }}>▼</span>
                </button>
                <div style={{ display: safetyOpen ? 'block' : 'none' }}>
                  {/* Factor breakdown — сворачиваемая карточка с кнопкой */}
                  {safetyScore.details?.factorBreakdown && (
                    <div style={{ padding:0, overflow:'hidden', background:'rgba(0,0,0,0.08)', borderBottom:'1px solid rgba(255,255,255,0.06)', borderRadius:8 }}>
                      <button type="button" onClick={() => setSafetyFactorsOpen(v=>!v)} aria-expanded={safetyFactorsOpen} style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', cursor:'pointer', background:'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))', border:'none', borderBottom: safetyFactorsOpen ? '1px solid rgba(255,255,255,0.06)' : 'none', textAlign:'left' }}>
                        <span style={{ fontSize:10, fontWeight:800, color:'#fff', opacity:0.7, letterSpacing:0.3, textTransform:'uppercase' }}>🧮 Расчёт по факторам — откуда баллы</span>
                        <span style={{ width:24, height:24, borderRadius:7, display:'inline-flex', alignItems:'center', justifyContent:'center', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:11, transform: safetyFactorsOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition:'transform 0.2s' }}>▼</span>
                      </button>
                      <div style={{ display: safetyFactorsOpen ? 'grid' : 'none', padding:'8px 12px', gridTemplateColumns:'1fr', gap:6 }}>
                        {safetyScore.details.factorBreakdown.map(f=> (
                          <div key={f.key} style={{ padding:'7px 9px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                              <span style={{ fontSize:11, fontWeight:700, color: f.status==='ok'?'#22c55e': f.status==='warn'?'#f59e0b':'#ef4444' }}>{f.label}</span>
                              <span style={{ fontSize:11, fontWeight:800, color:'#fff' }}>{f.score}/{f.max}</span>
                            </div>
                            <div style={{ height:6, borderRadius:6, background:'rgba(255,255,255,0.08)', marginTop:4, overflow:'hidden' }}>
                              <div style={{ height:'100%', width:`${(f.score/f.max)*100}%`, background: f.status==='ok'?'#22c55e': f.status==='warn'?'#f59e0b':'#ef4444', transition:'width 0.3s' }} />
                            </div>
                            <div style={{ fontSize:10, color:'#fff', opacity:0.68, marginTop:4, lineHeight:1.35, fontFamily:'ui-monospace, SFMono-Regular, monospace' }}>{f.calculation}</div>
                          </div>
                        ))}
                        <div style={{ padding:'7px 9px', borderRadius:8, background:'rgba(96,165,250,0.05)', border:'1px solid rgba(96,165,250,0.12)', fontSize:9, color:'#fff', opacity:0.78, lineHeight:1.45 }}>
                          <b style={{ color:'#60a5fa' }}>Почему «Суставной стресс» и «Баланс» почти всегда показывают полный балл:</b> оба фактора вычитаются ТОЛЬКО при выявленной проблеме. Суставной стресс −20/−10 лишь если риск высокий/умеренный — при низком риске это 20, а детали по каждому суставу (пик/среднее/пороги) видны в карточке «🦴 Суставная нагрузка» ниже. Баланс −2 за каждую проблему антагонистов/симметрии (analyzeBBBalance) — если нарушений нет, честно остаётся 10. Полный балл ≠ «не считается», это «нарушений нет».
                        </div>
                      </div>
                    </div>
                  )}
                  {/* 🦴 Единый суставный анализ — качественная оценка нагрузки */}
                  {(safetyScore.details?.jointStressDetails || safetyScore.details?.orthopedic || safetyScore.details?.loadDistribution || (safetyScore.details?.jointDiagnoses && safetyScore.details.jointDiagnoses.length>0)) && (
                    <div style={{ padding:'8px 12px' }}>
                      <div style={{ ...CARD, padding:0, overflow:'hidden', border:'1px solid rgba(96,165,250,0.22)', background:'rgba(15,23,42,0.42)' }}>
                        <button type="button" onClick={() => setJointAnalysisOpen(v=>!v)} aria-expanded={jointAnalysisOpen} style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', cursor:'pointer', background: safetyScore.details?.jointStressDetails?.overallRisk==='high' ? 'linear-gradient(135deg, rgba(239,68,68,0.18), rgba(239,68,68,0.06))' : safetyScore.details?.jointStressDetails?.overallRisk==='moderate' ? 'linear-gradient(135deg, rgba(245,158,11,0.16), rgba(245,158,11,0.05))' : 'linear-gradient(135deg, rgba(34,197,94,0.14), rgba(34,197,94,0.04))', border:'none', borderBottom: jointAnalysisOpen ? '1px solid rgba(255,255,255,0.06)' : 'none', textAlign:'left' }}>
                          <span style={{ fontSize:13, fontWeight:900, color:'#fff' }}>🦴 Суставная нагрузка — качественный анализ</span>
                          <span style={{ width:24, height:24, borderRadius:7, display:'inline-flex', alignItems:'center', justifyContent:'center', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:11, transform: jointAnalysisOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition:'transform 0.2s' }}>▼</span>
                        </button>
                        <div style={{ display: jointAnalysisOpen ? 'block' : 'none' }}>
                          <div style={{ padding:'10px 12px', background: safetyScore.details?.jointStressDetails?.overallRisk==='high' ? 'linear-gradient(135deg, rgba(239,68,68,0.18), rgba(239,68,68,0.06))' : safetyScore.details?.jointStressDetails?.overallRisk==='moderate' ? 'linear-gradient(135deg, rgba(245,158,11,0.16), rgba(245,158,11,0.05))' : 'linear-gradient(135deg, rgba(34,197,94,0.14), rgba(34,197,94,0.04))', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                              <span style={{ fontSize:13, fontWeight:900, color:'#fff' }}>🦴 Суставная нагрузка — качественный анализ</span>
                              {(() => {
                                const r = safetyScore.details?.jointStressDetails?.overallRisk || 'low';
                                const label = r==='high'?'Высокий риск': r==='moderate'?'Умеренно':'Низкий риск';
                                const bg = r==='high'?'rgba(239,68,68,0.16)': r==='moderate'?'rgba(245,158,11,0.16)':'rgba(34,197,94,0.14)';
                                const color = r==='high'?'#ef4444': r==='moderate'?'#f59e0b':'#22c55e';
                                const border = r==='high'?'rgba(239,68,68,0.28)': r==='moderate'?'rgba(245,158,11,0.28)':'rgba(34,197,94,0.28)';
                                return <span style={{ marginLeft:'auto', fontSize:10, fontWeight:800, padding:'3px 9px', borderRadius:20, background:bg, color, border:`1px solid ${border}` }}>{label}</span>;
                              })()}
                            </div>
                            <div style={{ fontSize:10, color:'#fff', opacity:0.78, marginTop:4, lineHeight:1.45 }}>
                              {(() => {
                                const d = safetyScore.details?.jointStressDetails;
                                if (!d) return 'Оценка по фактическому плану: стресс суставов, ортопедические блоки, распределение по неделе и точечная профилактика.';
                                const peak = d.peakWeek ? `пик — нед ${d.peakWeek}` : 'пиковая неделя —';
                                const avg = `средний нед. стресс ${Math.round(d.avgWeeklyStress)}`;
                                const most = d.mostLoadedJoint ? `лидер: ${(({ shoulder:'плечо', knee:'колено', hip:'таз', spine:'поясница', lower_back:'поясница', elbow:'локоть', wrist:'запястье', ankle:'голеностоп', neck:'шея'} as any)[d.mostLoadedJoint.joint] || d.mostLoadedJoint.joint)} · ${Math.round(d.mostLoadedJoint.stress)}` : 'лидер —';
                                const phase = safetyScore.details?.orthopedic?.phase;
                                const phaseRu = phase==='acute'?'острая': phase==='subacute'?'подострая': phase==='chronic'?'хроническая': phase==='maintenance'?'восстановление':'—';
                                return `${peak} · ${avg} · ${most} · фаза: ${phaseRu}`;
                              })()}
                            </div>
                          </div>
                  <div style={{ padding:'10px 12px', display:'grid', gap:12 }}>
                    {/* 1 · Нагрузка по суставам */}
                    {(() => {
                      const d = safetyScore.details?.jointStressDetails;
                      if (!d || Object.keys(d.byJointPeak).length===0) {
                        return <div style={{ fontSize:10, color:'#fff', opacity:0.6, padding:'8px 10px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)' }}>Нет данных о суставной нагрузке — план без силовых сессий или только разгрузочные недели.</div>;
                      }
                      // Нормализация: lower_back → spine (сумма), чтобы поясница не дублировалась и не терялась
                      const normMap: Record<string, number> = {};
                      for (const [j, v] of Object.entries(d.byJointPeak as Record<string, number>)) {
                        const key = j === 'lower_back' ? 'spine' : j;
                        normMap[key] = (normMap[key] || 0) + (v || 0);
                      }
                      const normAvg: Record<string, number> = {};
                      for (const [j, v] of Object.entries(d.byJointAvg as Record<string, number>)) {
                        const key = j === 'lower_back' ? 'spine' : j;
                        normAvg[key] = (normAvg[key] || 0) + (v || 0);
                      }
                      const entries = Object.entries(normMap).sort((a,b)=> (b[1] as number)-(a[1] as number));
                      const RU: Record<string,{label:string,icon:string}> = { shoulder:{label:'Плечо',icon:'🤸'}, knee:{label:'Колено',icon:'🦵'}, hip:{label:'Таз',icon:'🦵'}, spine:{label:'Поясница',icon:'🦴'}, lower_back:{label:'Поясница',icon:'🦴'}, elbow:{label:'Локоть',icon:'💪'}, wrist:{label:'Запястье',icon:'🤚'}, ankle:{label:'Голеностоп',icon:'🦶'}, neck:{label:'Шея',icon:'🧣'} };
                      return (
                        <CollapsibleCard title="1 · Нагрузка по суставам" defaultOpen={true} headerStyle={{ background: 'linear-gradient(135deg, rgba(96,165,250,0.10), rgba(96,165,250,0.03))', color: '#60a5fa' }}>
                          <div style={{ display:'grid', gap:6 }}>
                            {entries.map(([joint, peak])=>{
                              const meta = RU[joint] || {label: joint, icon:'🦴'};
                              const avg = normAvg[joint] || 0;
                              const thresh = d.thresholds as any;
                              const lvl = (peak as number) > thresh.high ? 'high' : (peak as number) > thresh.moderate ? 'moderate' : (peak as number) > thresh.low ? 'low' : 'none';
                              const color = lvl==='high'?'#ef4444': lvl==='moderate'?'#f59e0b': lvl==='low'?'#eab308':'#22c55e';
                              const levelRu = lvl==='high'?'высокий': lvl==='moderate'?'умеренный': lvl==='low'?'низкий':'минимальный';
                              const pct = Math.min(100, ((peak as number)/(thresh.high*1.5))*100);
                              const tip = lvl==='high' ? 'Снизьте объём на 20–30% · RIR +1–2 · замените часть high-стресс упражнений на тренажёры/блоки' : lvl==='moderate' ? 'Держите технику, чередуйте тяжёлые и лёгкие дни, не ставьте тяжёлые подряд' : 'В пределах нормы — сохраняйте технику и контроль RIR';
                              return (
                                <div key={joint} style={{ padding:'8px 9px', borderRadius:10, background:'rgba(255,255,255,0.04)', border:`1px solid ${color}18` }}>
                                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                                    <span style={{ fontSize:11, fontWeight:800, color:'#fff', display:'flex', alignItems:'center', gap:6 }}><span>{meta.icon}</span>{meta.label}</span>
                                    <span style={{ fontSize:10, fontWeight:800, padding:'2px 7px', borderRadius:20, background: color+'18', color, border:`1px solid ${color}22` }}>{levelRu}</span>
                                  </div>
                                  <div style={{ display:'flex', gap:8, marginTop:4, alignItems:'center', fontSize:11 }}>
                                    <span style={{ color:'#fff', fontWeight:700 }}>пик {Math.round(peak as number)}</span>
                                    <span style={{ color:'#fff', opacity:0.7 }}>средн. {Math.round(avg as number)}</span>
                                    <span style={{ marginLeft:'auto', fontSize:10, color:'#fff', opacity:0.55 }}>пороги {thresh.low} / {thresh.moderate} / {thresh.high}</span>
                                  </div>
                                  <div style={{ height:5, borderRadius:5, background:'rgba(255,255,255,0.08)', marginTop:6, overflow:'hidden' }}>
                                    <div style={{ width:`${pct}%`, height:'100%', background: color }} />
                                  </div>
                                  <div style={{ fontSize:10, color:'#fff', opacity:0.72, marginTop:4, lineHeight:1.35 }}>{tip}</div>
                                </div>
                              );
                            })}
                          </div>
                          <div style={{ fontSize:9, color:'#fff', opacity:0.42, marginTop:6, lineHeight:1.3 }}>Расчёт: база 3/6/10 (low/med/high из каталога) × подходы × близость к отказу × вес. Сумма по упражнениям → пик и среднее по неделям (без учёта разгрузочных).</div>
                        </CollapsibleCard>
                      );
                    })()}

                    {/* 2 · Ортопедия */}
                    {(() => {
                      const o = safetyScore.details?.orthopedic;
                      if (!o) return null;
                      const phaseRu = o.phase==='acute'?'Острая': o.phase==='subacute'?'Подострая': o.phase==='chronic'?'Хроническая':'Поддержание';
                      const phaseColor = o.phase==='acute'?'#ef4444': o.phase==='subacute'?'#f59e0b': o.phase==='chronic'?'#60a5fa':'#22c55e';
                      const PAT_RU: Record<string,string> = { squat:'присед', hinge:'наклон/тяга', lunge:'выпад', carry:'перенос', vertical_push:'жим вертик.', horizontal_push:'жим гориз.', vertical_pull:'тяга вертик.', horizontal_pull:'тяга гориз.', rotation:'вращение', anti_rotation:'анти-вращение', accessory:'изоляция' };
                      const tr = (p:string)=> PAT_RU[p] || p;
                      const jLabel = (j:string)=> ({ shoulder:'Плечо', spine:'Поясница', hip:'Таз', knee:'Колено', elbow:'Локоть', ankle:'Голеностоп', wrist:'Запястье', lower_back:'Поясница', neck:'Шея'} as any)[j] || j;
                      return (
                        <CollapsibleCard title="2 · Ортопедика и ограничения" defaultOpen={true} headerStyle={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.10), rgba(168,85,247,0.03))', color: '#a78bfa' }}>
                          <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', marginBottom:8 }}>
                            <span style={{ fontSize:11, fontWeight:800, color:'#fff' }}>Фаза:</span>
                            <span style={{ fontSize:11, fontWeight:800, padding:'3px 8px', borderRadius:20, background: phaseColor+'18', color: phaseColor, border:`1px solid ${phaseColor}22` }}>{phaseRu}</span>
                            <span style={{ fontSize:10, color:'#fff', opacity:0.6 }}>{o.phase==='acute'?'есть боль/воспаление — щадим': o.phase==='subacute'?'3+ блока — много ограничений': o.phase==='chronic'?'1–2 блока — контроль объёма':'блоков нет — работаем в штатном режиме'}</span>
                          </div>
                          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                            <div style={{ padding:'8px 9px', borderRadius:10, background: o.blockedPatterns.length?'rgba(239,68,68,0.07)':'rgba(34,197,94,0.07)', border:`1px solid ${o.blockedPatterns.length?'rgba(239,68,68,0.14)':'rgba(34,197,94,0.14)'}` }}>
                              <div style={{ fontSize:10, fontWeight:800, color: o.blockedPatterns.length?'#ef4444':'#22c55e' }}>Исключённые паттерны</div>
                              <div style={{ fontSize:11, color:'#fff', marginTop:3, lineHeight:1.35 }}>{o.blockedPatterns.length ? o.blockedPatterns.map(tr).join(', ') : '— нет, все движения разрешены'}</div>
                            </div>
                            <div style={{ padding:'8px 9px', borderRadius:10, background:'rgba(96,165,250,0.07)', border:'1px solid rgba(96,165,250,0.14)' }}>
                              <div style={{ fontSize:10, fontWeight:800, color:'#60a5fa' }}>Разрешённые</div>
                              <div style={{ fontSize:11, color:'#fff', marginTop:3, lineHeight:1.35 }}>{o.allowedPatterns.map(tr).join(', ') || '—'}</div>
                            </div>
                          </div>
                          {Object.keys(o.romLimits).length>0 && (
                            <div style={{ marginBottom:8 }}>
                              <div style={{ fontSize:10, fontWeight:800, color:'#c084fc', marginBottom:4 }}>ROM-лимиты</div>
                              <div style={{ display:'grid', gap:4 }}>
                                {Object.entries(o.romLimits as any).map(([j,lim]:any)=> (
                                  <div key={j} style={{ display:'flex', justifyContent:'space-between', padding:'5px 8px', borderRadius:8, background:'rgba(255,255,255,0.04)', fontSize:11 }}>
                                    <span style={{ color:'#fff' }}>{jLabel(j)}</span><span style={{ fontWeight:800, color:'#fff' }}>{lim.min}° – {lim.max}°</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {Object.keys(o.jointStressLimits).length>0 && (
                            <div style={{ marginBottom:8 }}>
                              <div style={{ fontSize:10, fontWeight:800, color:'#f59e0b', marginBottom:4 }}>Лимиты стресса по суставам (1 — жёстко, 4 — мягко)</div>
                              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:4 }}>
                                {Object.entries(o.jointStressLimits as any).map(([j,lim]:any)=> {
                                  const col = (lim as number)<=1?'#ef4444': (lim as number)<=2?'#f59e0b':'#22c55e';
                                  const bg = (lim as number)<=1?'rgba(239,68,68,0.10)': (lim as number)<=2?'rgba(245,158,11,0.10)':'rgba(255,255,255,0.04)';
                                  return <div key={j} style={{ padding:'6px 6px', borderRadius:8, background:bg, border:'1px solid rgba(255,255,255,0.06)', textAlign:'center' }}><div style={{ fontSize:9, color:'#fff', opacity:0.7 }}>{jLabel(j)}</div><div style={{ fontSize:13, fontWeight:900, color: col }}>{String(lim)}</div></div>;
                                })}
                              </div>
                            </div>
                          )}
                          {o.recommendations.length>0 && (
                            <div>
                              <div style={{ fontSize:10, fontWeight:800, color:'#00e68a', marginBottom:4 }}>Что учесть прямо сейчас</div>
                              {o.recommendations.map((r,i)=> <div key={i} style={{ fontSize:11, color:'#fff', marginBottom:3, paddingLeft:8, borderLeft:'2px solid rgba(0,230,138,0.5)', lineHeight:1.35 }}>{r}</div>)}
                            </div>
                          )}
                        </CollapsibleCard>
                      );
                    })()}

                    {/* 3 · Профилактика */}
                    {(() => {
                      const diags = (safetyScore.details?.jointDiagnoses || []) as any[];
                      if (!diags || diags.length===0) return null;
                      return (
                        <div style={{ borderRadius:10, overflow:'hidden', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(34,197,94,0.14)' }}>
                          <button type="button" onClick={() => setSafetyPreventionOpen(v => !v)} aria-expanded={safetyPreventionOpen} style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', cursor:'pointer', background:'linear-gradient(135deg, rgba(34,197,94,0.10), rgba(34,197,94,0.03))', border:'none', borderBottom: safetyPreventionOpen ? '1px solid rgba(34,197,94,0.14)' : 'none', textAlign:'left' }}>
                            <span style={{ fontSize:10, fontWeight:800, color:'#22c55e', letterSpacing:0.3, textTransform:'uppercase' }}>3 · Профилактика и точечная коррекция — по каждому суставу ({diags.length})</span>
                            <span style={{ width:24, height:24, borderRadius:7, display:'inline-flex', alignItems:'center', justifyContent:'center', background:'rgba(34,197,94,0.12)', border:'1px solid rgba(34,197,94,0.22)', color:'#22c55e', fontSize:11, transform: safetyPreventionOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition:'transform 0.2s' }}>▼</span>
                          </button>
                          <div style={{ display: safetyPreventionOpen ? 'block' : 'none', padding:'8px 10px' }}>
                          <div style={{ fontSize:9, color:'#fff', opacity:0.55, marginBottom:8, lineHeight:1.35 }}>Каждый нагруженный сустав расписан так же детально как колено/таз: опасные структуры, фаза, метод, ассисты и протокол. Плечо и остальные показаны наравне с нагруженными.</div>
                          <div style={{ display:'grid', gap:8 }}>
                            {diags.map((jd:any)=> (
                              <CollapsibleCard key={jd.joint.id} title={`${jd.joint.icon} ${jd.joint.label}`} defaultOpen={jd.joint.id==='shoulder' || jd.joint.id==='knee' || jd.joint.id==='hip' || jd.joint.id==='spine'} headerStyle={{ background: jd.phase==='acute'?'linear-gradient(135deg, rgba(239,68,68,0.14), rgba(239,68,68,0.06))': jd.phase==='subacute'?'linear-gradient(135deg, rgba(245,158,11,0.14), rgba(245,158,11,0.06))': jd.phase==='chronic'?'linear-gradient(135deg, rgba(96,165,250,0.14), rgba(96,165,250,0.06))':'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(34,197,94,0.04))', color: jd.phase==='acute'?'#ef4444':jd.phase==='subacute'?'#f59e0b':jd.phase==='chronic'?'#60a5fa':'#22c55e' }} badge={jd.joint.dangerous.slice(0,2).join(' · ')}>
                                <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:4, flexWrap:'wrap' }}>
                                  <span style={{ fontSize:13 }}>{jd.joint.icon}</span>
                                  <span style={{ fontSize:11, fontWeight:800, color:'#fff' }}>{jd.joint.label}</span>
                                  <span style={{ fontSize:10, padding:'2px 6px', borderRadius:6, background: jd.phase==='acute'?'rgba(239,68,68,0.14)': jd.phase==='subacute'?'rgba(245,158,11,0.14)': jd.phase==='chronic'?'rgba(96,165,250,0.14)':'rgba(34,197,94,0.12)', color: jd.phase==='acute'?'#ef4444': jd.phase==='subacute'?'#f59e0b': jd.phase==='chronic'?'#60a5fa':'#22c55e', fontWeight:700 }}>{jd.phase==='acute'?'острая': jd.phase==='subacute'?'подострая': jd.phase==='chronic'?'хроническая':'поддержание'}</span>
                                  <span style={{ fontSize:10, color:'#fff', opacity:0.55, marginLeft:'auto' }}>{jd.joint.dangerous.join(' · ')}</span>
                                </div>
                                <div style={{ fontSize:10, color:'#fff', opacity:0.75, lineHeight:1.35, marginBottom:6 }}>{jd.joint.description}</div>
                                {jd.joint.relatedLifts?.length>0 && <div style={{ fontSize:9, color:'#fff', opacity:0.6, marginBottom:6 }}><b>Связанные движения:</b> {jd.joint.relatedLifts.join(', ')}</div>}
                                {jd.options?.length>0 && (
                                  <div style={{ display:'grid', gap:6 }}>
                                      {jd.options.map((opt:any)=> {
                                       const lvlRu = opt.level==='critical'?'критический': opt.level==='high'?'высокий': opt.level==='moderate'?'умеренный':'низкий';
                                       const lvlColor = opt.level==='critical'?'#ef4444': opt.level==='high'?'#f59e0b': opt.level==='moderate'?'#60a5fa':'#22c55e';
                                       return (
                                         <CollapsibleCard key={opt.id} title={`Профилактика: ${opt.label}`} defaultOpen={false} badge={lvlRu} headerStyle={{ background: opt.level==='critical'?'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.04))': opt.level==='high'?'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.04))':'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))', color: lvlColor }}>
                                         <div style={{ padding:'0 0 2px' }}>
                                           <div style={{ fontSize:11, fontWeight:700, color: lvlColor, display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}><span>{opt.label}</span><span style={{ fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:6, background:lvlColor+'18', border:`1px solid ${lvlColor}22` }}>{lvlRu}</span></div>
                                           <div style={{ fontSize:10, color:'#fff', opacity:0.8, marginTop:2, lineHeight:1.35 }}>{opt.description}</div>
                                           <div style={{ fontSize:10, color:'#00e68a', marginTop:3 }}><b>Метод:</b> {opt.method}</div>
                                           {opt.assistance?.length>0 && <div style={{ fontSize:10, color:'#fff', opacity:0.7, marginTop:2 }}><b>Ассисты:</b> {opt.assistance.join(', ')}</div>}
                                           {opt.rationale && <div style={{ fontSize:9, color:'#fff', opacity:0.55, marginTop:2, fontStyle:'italic' }}>{opt.rationale}</div>}
                                           <div style={{ fontSize:10, color:'#fff', marginTop:3, padding:'3px 6px', borderRadius:6, background:'rgba(0,0,0,0.18)', display:'inline-block' }}>Протокол: {opt.protocol.sets}×{opt.protocol.reps}{opt.protocol.pct?` @${opt.protocol.pct}%`:''} · RIR{opt.protocol.rir}{opt.protocol.tempo?` · ${opt.protocol.tempo}`:''}{opt.protocol.rest?` · ${opt.protocol.rest}`:''}{opt.protocol.note?` · ${opt.protocol.note}`:''}</div>
                                         </div>
                                         </CollapsibleCard>
                                       );
                                     })}
                                  </div>
                                )}
                              </CollapsibleCard>
                            ))}
                          </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* 4 · Распределение — сворачиваемая */}
                    {(() => {
                      const ld = safetyScore.details?.loadDistribution as any;
                      if (!ld) return null;
                      return (
                        <div style={{ borderRadius:10, overflow:'hidden', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(96,165,250,0.14)' }}>
                          <button type="button" onClick={() => setSafetyDistributionOpen(v => !v)} aria-expanded={safetyDistributionOpen} style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', cursor:'pointer', background:'linear-gradient(135deg, rgba(96,165,250,0.10), rgba(96,165,250,0.03))', border:'none', borderBottom: safetyDistributionOpen ? '1px solid rgba(96,165,250,0.14)' : 'none', textAlign:'left' }}>
                            <span style={{ fontSize:10, fontWeight:800, color:'#60a5fa', letterSpacing:0.3, textTransform:'uppercase' }}>4 · Недельное распределение — восстановление суставов</span>
                            <span style={{ width:24, height:24, borderRadius:7, display:'inline-flex', alignItems:'center', justifyContent:'center', background:'rgba(96,165,250,0.12)', border:'1px solid rgba(96,165,250,0.22)', color:'#60a5fa', fontSize:11, transform: safetyDistributionOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition:'transform 0.2s' }}>▼</span>
                          </button>
                          <div style={{ display: safetyDistributionOpen ? 'block' : 'none', padding:'8px 10px' }}>
                           <div style={{ fontSize:10, fontWeight:800, color:'#60a5fa', letterSpacing:0.3, textTransform:'uppercase', marginBottom:6 }}>4 · Недельное распределение — восстановление суставов</div>
                          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginBottom:8 }}>
                            {ld.weekPlan.map((d:any)=> (
                              <div key={d.day} style={{ padding:'6px 4px', borderRadius:8, textAlign:'center', background: d.difficulty==='hard'?'rgba(239,68,68,0.10)': d.difficulty==='medium'?'rgba(245,158,11,0.10)': d.difficulty==='light'?'rgba(96,165,250,0.10)': d.difficulty==='rehab'?'rgba(168,85,247,0.10)':'rgba(255,255,255,0.04)', border:`1px solid ${d.difficulty==='hard'?'rgba(239,68,68,0.16)': d.difficulty==='medium'?'rgba(245,158,11,0.14)': d.difficulty==='light'?'rgba(96,165,250,0.12)':'rgba(255,255,255,0.06)'}` }}>
                                <div style={{ fontSize:9, color:'#fff', opacity:0.6 }}>Дн {d.day}</div>
                                <div style={{ fontSize:10, fontWeight:800, color:'#fff' }}>{d.difficulty==='off'?'отдых': d.difficulty==='hard'?'тяж': d.difficulty==='medium'?'сред': d.difficulty==='light'?'лёг':'реаб'}</div>
                                {d.difficulty!=='off' && <><div style={{ fontSize:9, color:'#fff' }}>V{d.volumeTarget}</div><div style={{ fontSize:9, color:'#fff', opacity:0.7 }}>I{d.intensityTarget}</div></>}
                              </div>
                            ))}
                          </div>
                          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginBottom:6 }}>
                            <div style={{ padding:'6px 8px', borderRadius:8, background:'rgba(255,255,255,0.04)', textAlign:'center' }}><div style={{ fontSize:9, color:'#fff', opacity:0.6 }}>Объём</div><div style={{ fontSize:12, fontWeight:800, color:'#fff' }}>{ld.totalVolume}</div></div>
                            <div style={{ padding:'6px 8px', borderRadius:8, background:'rgba(255,255,255,0.04)', textAlign:'center' }}><div style={{ fontSize:9, color:'#fff', opacity:0.6 }}>Интенсивность</div><div style={{ fontSize:12, fontWeight:800, color:'#fff' }}>{ld.avgIntensity}</div></div>
                            <div style={{ padding:'6px 8px', borderRadius:8, background: ld.hardDays>=4?'rgba(239,68,68,0.10)':'rgba(34,197,94,0.08)', textAlign:'center' }}><div style={{ fontSize:9, color:'#fff', opacity:0.6 }}>Тяж. дней</div><div style={{ fontSize:12, fontWeight:800, color: ld.hardDays>=4?'#ef4444':'#22c55e' }}>{ld.hardDays}</div></div>
                          </div>
                          {ld.warnings.length>0 && <div>{ld.warnings.map((w:string,i:number)=> <div key={i} style={{ fontSize:10, color:'#f59e0b', marginTop:2, lineHeight:1.3 }}>⚠ {w}</div>)}</div>}
                          </div>
                        </div>
                      );
                    })()}

                    {/* 5 · Вывод — сворачиваемая */}
                    <div style={{ borderRadius:10, overflow:'hidden', background: safetyScore.riskLevel==='dangerous'?'rgba(239,68,68,0.08)': safetyScore.riskLevel==='caution'?'rgba(245,158,11,0.08)':'rgba(34,197,94,0.08)', border:`1px solid ${safetyScore.riskLevel==='dangerous'?'rgba(239,68,68,0.16)': safetyScore.riskLevel==='caution'?'rgba(245,158,11,0.16)':'rgba(34,197,94,0.16)'}` }}>
                      <button type="button" onClick={() => setSafetyConclusionOpen(v => !v)} aria-expanded={safetyConclusionOpen} style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 10px', cursor:'pointer', background: safetyScore.riskLevel==='dangerous'?'linear-gradient(135deg, rgba(239,68,68,0.14), rgba(239,68,68,0.06))': safetyScore.riskLevel==='caution'?'linear-gradient(135deg, rgba(245,158,11,0.14), rgba(245,158,11,0.06))':'linear-gradient(135deg, rgba(34,197,94,0.14), rgba(34,197,94,0.06))', border:'none', borderBottom: safetyConclusionOpen ? `1px solid ${safetyScore.riskLevel==='dangerous'?'rgba(239,68,68,0.16)': safetyScore.riskLevel==='caution'?'rgba(245,158,11,0.16)':'rgba(34,197,94,0.16)'}` : 'none', textAlign:'left' }}>
                        <span style={{ fontSize:11, fontWeight:800, color: safetyScore.riskLevel==='dangerous'?'#ef4444': safetyScore.riskLevel==='caution'?'#f59e0b':'#22c55e' }}>{safetyScore.riskLevel==='dangerous'?'🚨 Требуется коррекция': safetyScore.riskLevel==='caution'?'⚠ На контроле — есть что улучшить':'✅ Суставы в порядке'} · 5 · Вывод</span>
                        <span style={{ width:24, height:24, borderRadius:7, display:'inline-flex', alignItems:'center', justifyContent:'center', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', color: safetyScore.riskLevel==='dangerous'?'#ef4444': safetyScore.riskLevel==='caution'?'#f59e0b':'#22c55e', fontSize:11, transform: safetyConclusionOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition:'transform 0.2s' }}>▼</span>
                      </button>
                      <div style={{ display: safetyConclusionOpen ? 'block' : 'none', padding:'9px 10px' }}>
                      <div style={{ fontSize:11, fontWeight:800, color: safetyScore.riskLevel==='dangerous'?'#ef4444': safetyScore.riskLevel==='caution'?'#f59e0b':'#22c55e', display:'none' }}>
                        {safetyScore.riskLevel==='dangerous'?'🚨 Требуется коррекция': safetyScore.riskLevel==='caution'?'⚠ На контроле — есть что улучшить':'✅ Суставы в порядке'}
                      </div>
                      <div style={{ fontSize:11, color:'#fff', marginTop:4, lineHeight:1.45 }}>
                        {(() => {
                          const d = safetyScore.details?.jointStressDetails as any;
                          const highJoints = d ? Object.entries(d.byJointPeak as Record<string, number>).filter(([_,v])=> (v as number) > d.thresholds.high).map(([k])=> ({ shoulder:'плечо', knee:'колено', hip:'таз', spine:'поясница', lower_back:'поясница', elbow:'локоть', wrist:'запястье', ankle:'голеностоп', neck:'шея'} as any)[k] || k) : [];
                          if (highJoints.length>0) return `Перегружены: ${highJoints.join(', ')} — снизьте объём на 20–30%, повысьте RIR на 1–2, замените часть высокострессовых упражнений на тренажёры/блоки и проверьте технику.`;
                          if (d?.overallRisk==='moderate') return 'Нагрузка умеренная — следите за техникой, чередуйте тяжёлые и лёгкие дни, не ставьте тяжёлые подряд, добавляйте 5–10 мин мобилити.';
                          return 'Нагрузка сбалансирована. Сохраняйте технику, объём и равномерное распределение — суставы успевают восстанавливаться.';
                        })()}
                      </div>
                      {(() => {
                        const recs: string[] = [];
                        const d = safetyScore.details?.jointStressDetails as any;
                        const o = safetyScore.details?.orthopedic as any;
                        const ld = safetyScore.details?.loadDistribution as any;
                        if (d && d.overallRisk==='high') recs.push('Снизьте общий недельный объём на 10–15% или добавьте лёгкий/восстановительный день.');
                        if (o && o.blockedPatterns?.length>0) recs.push(`Избегайте паттернов: ${o.blockedPatterns.map((p:string)=> (({squat:'присед', hinge:'наклон/тяга', lunge:'выпад', carry:'перенос', vertical_push:'жим верт.', horizontal_push:'жим гориз.', vertical_pull:'тяга верт.', horizontal_pull:'тяга гориз.'} as any)[p]||p)).join(', ')} — используйте разрешённые.`);
                        if (ld && ld.hardDays>=4) recs.push('Сократите тяжёлые дни до 2–3 и разнесите их днями отдыха.');
                        if (d && Object.values((d.byJointPeak as any)||{}).some((v:any)=> v>40)) recs.push('Для пикового сустава: RIR +1–2, темп 3-1-1-0, больше машин вместо штанги, изометрия для сухожилий.');
                        if ((pedAdapt as any)?.combinedMrvMultiplier >= 1.3) recs.push('PED ×≥1.3: сухожилия отстают от мышц — при боли снижайте веса, еженедельно проверяйте суставы, коллаген/омега-3.');
                        if (recs.length===0) recs.push('Профилактика: суставная разминка 5 мин, мобилити голеностопа/плеча, контроль RIR 2–3 в базе, сон ≥7 ч.');
                        return <div style={{ marginTop:6 }}>{recs.slice(0,4).map((r,i)=> <div key={i} style={{ fontSize:10, color:'#fff', marginTop:3, paddingLeft:7, borderLeft:`2px solid ${safetyScore.riskLevel==='dangerous'?'rgba(239,68,68,0.5)': safetyScore.riskLevel==='caution'?'rgba(245,158,11,0.5)':'rgba(34,197,94,0.5)'}`, lineHeight:1.35 }}>{r}</div>)}</div>;
                      })()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              </div>
            )}
            </div>
          </div>
        )}
        </div>
        </div>
        <div style={{ ...CARD, padding:0, overflow:'hidden', marginBottom:8, border:'1px solid rgba(0,230,138,0.22)', background:'rgba(6,22,18,0.32)' }}>
          <button type="button" onClick={() => setQualityOpen(v => !v)} aria-expanded={qualityOpen} style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 14px', cursor:'pointer', background:'linear-gradient(135deg, rgba(0,230,138,0.16), rgba(16,185,129,0.06))', border:'none', borderBottom: qualityOpen ? '1px solid rgba(255,255,255,0.06)' : 'none', textAlign:'left' }}>
            <span style={{ fontSize:14, fontWeight:900, color:'#fff' }}>🏋️ Тренировочная нагрузка плана</span>
            <span style={{ width:32, height:32, borderRadius:8, display:'inline-flex', alignItems:'center', justifyContent:'center', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', color:'#fff', fontSize:13, transform: qualityOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition:'transform 0.2s' }}>▼</span>
          </button>
        </div>
        <div style={{ display: qualityOpen ? 'block' : 'none' }}>
<CollapsibleCard title="📋 Общая информация о плане" defaultOpen={true} headerStyle={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.12), rgba(168,85,247,0.04))', color: '#a855f7' }} badge={`${builtPlan.pattern?.name || '—'} · ${W.length} нед · ${builtPlan.weeks[0]?.sessions.length || bbDays}×/нед`}>
          <div style={{ display:'grid', gap:8, fontSize:11 }}>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              <span style={{ padding:'3px 7px', borderRadius:20, background:'rgba(168,85,247,0.08)', border:'1px solid rgba(168,85,247,0.14)', color:'#a855f7' }}>{builtPlan.pattern?.name || '—'} · {W.length} нед · {builtPlan.weeks[0]?.sessions.length || bbDays}×/нед</span>
              <span style={{ padding:'3px 7px', borderRadius:20, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', color:'#fff' }}>Уровень {bbLevel} · Цель {bbGoal} · Фокус {bbTrainingFocus}</span>
              <span style={{ padding:'3px 7px', borderRadius:20, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', color:'#fff' }}>Методика {bbMethodology} · Объём {bbVolGoal}{trainingVolumeMode==='high'?' · объёмный':''}</span>
              <span style={{ padding:'3px 7px', borderRadius:20, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', color:'#fff' }}>Прогрессия {loadStrategy} · RIR {String((getPhaseConfig('accumulation', bbTrainingFocus as any) as any).rir ?? '2-3')}→{String((getPhaseConfig('intensification', bbTrainingFocus as any) as any).rir ?? '1-2')}</span>
              {peds.length>0 && <span style={{ padding:'3px 7px', borderRadius:20, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.14)', color:'#f59e0b' }}>PED ×{pedAdapt.combinedMrvMultiplier.toFixed(2)} · {peds.join(', ')}</span>}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, fontSize:10, color:'#fff' }}>
              <div style={{ padding:'6px 8px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}><b>Слабые:</b> {weakPoints.join(', ')||'— баланc'}</div>
              <div style={{ padding:'6px 8px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}><b>Травмы:</b> {injuries.length? injuries.map(i=> `${i.muscle}${i.exclude?' (искл.)':''}`).join(', ') : 'нет'} · <b>Мобильность:</b> {mobilityRestrictions.join(', ')||'нет'}</div>
              <div style={{ padding:'6px 8px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}><b>Оборудование:</b> {bbEquipment.slice(0,3).join(', ')||'всё'} · <b>Слабые:</b> {specTargets.join(' + ')||'баланс'}</div>
              <div style={{ padding:'6px 8px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}><b>Сплит:</b> {builtPlan.pattern?.name || '—'} · скор {ranked.find(r=>r.pattern.id===builtPlan.pattern?.id)?.score ?? bestSplit?.score ?? 0} · {bbDays}×/нед</div>
            </div>
            <div style={{ fontSize:10, color:'#fff', opacity:0.6, display:'flex', flexWrap:'wrap', gap:6 }}>
              <span>Уровень «{bbLevel}»</span><span>Цель «{bbGoal}»</span><span>Фокус «{bbTrainingFocus}»</span><span>Методика «{bbMethodology}»</span><span>PED ×{pedAdapt.combinedMrvMultiplier.toFixed(2)}</span><span>ACWR {ratio ? ratio.ratio.toFixed(2) : '—'}</span>
            </div>
          </div>
        </CollapsibleCard>
        <CollapsibleCard title="⭐ Качество плана — объём и PRO (понедельно)" defaultOpen={true} headerStyle={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.12), rgba(168,85,247,0.04))', color: '#a855f7' }} badge={`Объём ${quality.viewVolume}/100 · PRO ${quality.viewPro}/100 · ${quality.viewTag}`}>
          <div style={{ display:'grid', gap:8, fontSize:11 }}>
            <div style={{ fontSize:10, color:'#fff', opacity:0.6, lineHeight:1.35 }}>
              Две отдельные шкалы (не суммируются): «Объём» — факт недели vs собственные цели/капы/параметры плана; «PRO» — факт исполнения (паттерны/углы/растяжка/техники). Каждая неделя — по правилам своей фазы; «Среднее» — среднее понедельных.
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, alignItems:'center' }}>
              <button type="button" onClick={() => setQualityWeek('avg')} aria-pressed={quality.mode === 'avg'} style={{ padding:'4px 10px', borderRadius:8, fontSize:11, cursor:'pointer', border: quality.mode === 'avg' ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.08)', background: quality.mode === 'avg' ? 'rgba(168,85,247,0.15)' : 'transparent', color: quality.mode === 'avg' ? '#a855f7' : '#fff', fontWeight: quality.mode === 'avg' ? 800 : 400 }}>Среднее</button>
              {builtPlan.weeks.map((w:any) => {
                const phColor = (PHASE_COLORS as any)[String((w as any).phase || ((w as any).deload ? 'deload' : 'accumulation'))] || '#fff';
                const active = quality.mode === w.week;
                return (
                <button key={w.week} type="button" onClick={() => setQualityWeek(w.week)} aria-pressed={active} title={`Нед ${w.week}: ${(w as any).phase || ''}${(w as any).deload ? ' (делод)' : ''}${(w as any).taper ? ' (taper)' : ''}`} style={{ padding:'4px 8px', borderRadius:8, fontSize:11, cursor:'pointer', border: active ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.08)', background: active ? 'rgba(168,85,247,0.15)' : 'transparent', color: active ? '#a855f7' : '#fff', fontWeight: active ? 800 : 400, display:'inline-flex', alignItems:'center', gap:5 }}><span style={{ width:6, height:6, borderRadius:'50%', background: phColor, flexShrink:0 }} />{w.week}</button>
                );
              })}
            </div>
            <div style={{ display:'flex', gap:3, alignItems:'flex-end', flexWrap:'wrap' }} title="Понедельные скоры: зелёный — объём, голубой — PRO">
              {quality.perWeek.map((p:any) => (
                <button key={p.week} type="button" onClick={() => setQualityWeek(p.week)} title={`Нед ${p.week}: объём ${p.volume}, PRO ${p.pro}`} style={{ background:'transparent', border: quality.mode === p.week ? '1px solid #a855f7' : '1px solid transparent', borderRadius:6, padding:2, cursor:'pointer', display:'flex', gap:2, alignItems:'flex-end' }}>
                  <span style={{ display:'block', width:8, height: Math.max(3, Math.round(p.volume / 4)), borderRadius:2, background: p.volume >= 85 ? '#22c55e' : p.volume >= 65 ? '#eab308' : p.volume >= 45 ? '#f97316' : '#ef4444' }} />
                  <span style={{ display:'block', width:8, height: Math.max(3, Math.round(p.pro / 4)), borderRadius:2, background:'#60a5fa', opacity:0.85 }} />
                </button>
              ))}
              <span style={{ fontSize:9, color:'#fff', opacity:0.5, marginLeft:6 }}>🟩 объём · 🟦 PRO · клик — неделя</span>
            </div>
            <div style={{ display:'grid', gap:4 }}>
              {quality.selVolume.muscles.map((m:any) => {
                const stColor = m.status === 'ok' ? '#22c55e' : m.status === 'by_design' ? '#60a5fa' : m.status === 'low' ? '#f59e0b' : m.status === 'high' ? '#eab308' : m.status === 'over' ? '#ef4444' : '#888';
                const stLabel = m.status === 'ok' ? 'в цели' : m.status === 'by_design' ? 'по дизайну' : m.status === 'low' ? 'ниже' : m.status === 'high' ? 'выше цели' : m.status === 'over' ? 'перебор' : '—';
                return (
                  <div key={m.muscle} style={{ display:'grid', gridTemplateColumns:'1.1fr 1fr 1.4fr', gap:6, alignItems:'center', padding:'5px 8px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)', fontSize:10 }}>
                    <span style={{ fontWeight:700, color:'#fff' }}>{m.label || m.muscle}</span>
                    <span style={{ color:'#fff' }}>{m.effectiveSets} эфф <span style={{ opacity:0.55 }}>({m.directSets} прям{m.targetSets > 0 ? ` · цель ${m.targetSets}` : ''})</span></span>
                    <span style={{ color: stColor, fontWeight:700 }}>{stLabel} <span style={{ opacity:0.7, fontWeight:400 }}>· MEV {m.mev}/MAV {m.mav}/MRV {m.mrv}{m.note ? ` · ${m.note}` : ''}</span></span>
                  </div>
                );
              })}
            </div>
            <div style={{ display:'grid', gap:3, fontSize:10 }}>
              {quality.selVolume.issues.filter((i:any) => i.severity !== 'info').slice(0, 5).map((i:any, idx:number) => (
                <div key={'v' + idx} style={{ color:'#fff' }}>{i.severity === 'error' ? '🔴' : '🟡'} {i.message} <span style={{ opacity:0.55 }}>[{i.source}]</span></div>
              ))}
              {quality.selPro.totalIssues.slice(0, 3).map((iss:string, idx:number) => (
                <div key={'p' + idx} style={{ color:'#fff' }}>🔵 {iss}</div>
              ))}
              {quality.selVolume.issues.filter((i:any) => i.severity === 'info').slice(0, 2).map((i:any, idx:number) => (
                <div key={'n' + idx} style={{ color:'#fff', opacity:0.55 }}>ℹ️ {i.message} <span style={{ opacity:0.7 }}>[{i.source}]</span></div>
              ))}
              {quality.selVolume.issues.filter((i:any) => i.severity !== 'info').length === 0 && quality.selPro.totalIssues.length === 0 && (
                <div style={{ color:'#22c55e' }}>✅ Неделя в целях плана — отклонений нет</div>
              )}
            </div>
          </div>
        </CollapsibleCard>
        <CollapsibleCard title="📊 Общие сведения о нагрузке" defaultOpen={true} headerStyle={{ background: 'linear-gradient(135deg, rgba(0,230,138,0.12), rgba(0,230,138,0.04))', color: '#00e68a' }} badge={`${metrics.totalSets} сетов · тяж ${(metrics.тяжPct*100).toFixed(0)}% · памп ${(metrics.пампPct*100).toFixed(0)}%`}>
          <div style={{ display:'grid', gap:8, fontSize:11 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
              <div style={{ padding:'6px 8px', borderRadius:8, background:'rgba(255,255,255,0.04)', textAlign:'center' }}><div style={{ fontSize:9, color:'#fff', opacity:0.6 }}>Сетов пик</div><div style={{ fontSize:14, fontWeight:800, color:'#00e68a' }}>{metrics.totalSets}</div><div style={{ fontSize:9, color:'#fff', opacity:0.5 }}>средн. {Math.round(W.reduce((a,w)=>a+w.sessions.reduce((b,s)=>b+s.exercises.reduce((c,e)=>c+e.sets,0),0),0)/W.length)}/нед</div></div>
              <div style={{ padding:'6px 8px', borderRadius:8, background:'rgba(239,68,68,0.06)', textAlign:'center' }}><div style={{ fontSize:9, color:'#fff', opacity:0.6 }}>Тяж</div><div style={{ fontSize:14, fontWeight:800, color:'#ef4444' }}>{(metrics.тяжPct*100).toFixed(0)}%</div><div style={{ fontSize:9, color:'#fff', opacity:0.5 }}>RIR {metrics.avgRir.toFixed(1)}</div></div>
              <div style={{ padding:'6px 8px', borderRadius:8, background:'rgba(96,165,250,0.06)', textAlign:'center' }}><div style={{ fontSize:9, color:'#fff', opacity:0.6 }}>Памп</div><div style={{ fontSize:14, fontWeight:800, color:'#60a5fa' }}>{(metrics.пампPct*100).toFixed(0)}%</div><div style={{ fontSize:9, color:'#fff', opacity:0.5 }}>{W.length} нед · {W[0]?.sessions.length || 0} дн/нед</div></div>
            </div>
            {(() => {
              const proQ = (quality as any).proResult as any;
              if (!proQ) return null;
              return (
                <div style={{ display:'grid', gap:6 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, fontSize:10 }}>
                    <div style={{ padding:'6px 8px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}><b>Паттерны:</b> {proQ.patterns.filter((p:any)=>p.ok).length}/{proQ.patterns.length} в норме {proQ.patterns.filter((p:any)=>!p.ok).map((p:any)=>p.issue).slice(0,1).join('; ')||'—'}</div>
                    <div style={{ padding:'6px 8px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}><b>Углы:</b> {proQ.angles.filter((a:any)=>a.ok).length}/{proQ.angles.length} в норме {proQ.angles.filter((a:any)=>!a.ok).map((a:any)=>a.issue).slice(0,1).join('; ')||'—'}</div>
                    <div style={{ padding:'6px 8px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}><b>Растяжка:</b> {proQ.stretches.filter((s:any)=>s.ok).length}/{proQ.stretches.length} в норме</div>
                    <div style={{ padding:'6px 8px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}><b>Техники:</b> {proQ.technique.pct}% {proQ.technique.ok ? '✅' : '⚠️ ' + (proQ.technique.issue || '')}</div>
                  </div>
                  <div style={{ fontSize:10, color:'#fff', opacity:0.6 }}>Цель «{proQ.goalAlignment?.goal || bbGoal}» — {proQ.goalAlignment?.ok ? 'согласована с фокусом ✅' : '⚠️ ' + (proQ.goalAlignment?.issue || '')} · техники {proQ.technique.pct}%{proQ.goalAlignment?.recommendation ? ' · ' + proQ.goalAlignment.recommendation : ''}</div>
                  {proQ.totalIssues.length > 0 && <div style={{ fontSize:10, color:'#fff' }}>{proQ.totalIssues.slice(0,3).map((iss:any,i:number)=><div key={i}>• {iss}</div>)}</div>}
                  {proQ.totalRecommendations.length > 0 && <div style={{ fontSize:10, color:'#22c55e' }}>{proQ.totalRecommendations.slice(0,3).map((rec:any,i:number)=><div key={i}>→ {rec}</div>)}</div>}
                  <div style={{ fontSize:10, color:'#22c55e' }}>PRO-скор {quality.viewTag}: {quality.viewPro}/100 {quality.proLabel} (отдельная шкала по факту исполнения — в скор объёма не входит)</div>
                </div>
              );
            })()}
            <div style={{ fontSize:10, color:'#fff', opacity:0.5 }}>Фаз: {Array.from(new Set(W.map((w:any)=>(w as any).phase || 'accumulation'))).length} · {W.map(w=>`${PHASE_LABELS[((w as any).phase || 'accumulation') as BBPhase] || (w as any).phase}`).join(' → ').slice(0,80)} · PED ×{pedAdapt.combinedMrvMultiplier.toFixed(2)}</div>
          </div>
        </CollapsibleCard>
        {/* Фаза — факт из плана, а не синтетика distributePhases */}
        {(() => {
          const Wq = builtPlan.weeks;
          const wkq = Wq[Math.min(bbWeekSel, Wq.length) - 1] || Wq[0];
          const curPhRaw = ((wkq as any).phase || (wkq as any).deload ? 'deload' : 'accumulation') as BBPhase;
          const curPh = (['accumulation','intensification','deload','peaking'].includes(curPhRaw) ? curPhRaw : 'accumulation') as BBPhase;
          const acwrQ = ratio;
          const needsDeloadQ = autoDeload && acwrQ && acwrQ.ratio > 1.3;
          const wkExs = wkq.sessions.flatMap(s => s.exercises);
          const avgRirFact = wkExs.length ? (wkExs.reduce((a,e) => a + (Number.isFinite(e.rir) ? e.rir * e.sets : 0), 0) / wkExs.reduce((a,e) => a + e.sets, 0) || 1) : 0;
          const repsAll = wkExs.flatMap(e => e.workSets?.map((ws:any) => ws.reps) ?? [e.repsRange?.[0] ?? 10]);
          const repMin = repsAll.length ? Math.min(...repsAll) : 0;
          const repMax = repsAll.length ? Math.max(...repsAll) : 0;
          const tempoFact = wkExs[0]?.tempoSpec || getPhaseConfig(curPh, bbTrainingFocus as any).tempo;
          const cfg = getPhaseConfig(curPh, bbTrainingFocus as any);
          const totalW = builtPlan.weeks.length;
          const phaseGroups: Record<string, number[]> = {};
          for (const w of builtPlan.weeks) {
            const p = ((w as any).phase || 'accumulation') as string;
            if (!phaseGroups[p]) phaseGroups[p] = [];
            phaseGroups[p].push(w.week);
          }
          const distText = Object.entries(phaseGroups).map(([p, weeks]) => `${PHASE_LABELS[p as BBPhase] || p}: нед ${weeks.join(',')}`).join(' · ');
          const totalSetsWeek = wkExs.reduce((a,e)=> a+ (e.sets||0),0);
          return <CollapsibleCard title={`📌 Фаза (факт) — ${PHASE_LABELS[curPh] || curPh}`} defaultOpen={true} headerStyle={{ background: `linear-gradient(135deg, ${PHASE_COLORS[curPh]}18, ${PHASE_COLORS[curPh]}08)`, color: PHASE_COLORS[curPh] }}><div style={{ marginBottom:6, padding:'10px 12px', borderRadius:12, background:PHASE_COLORS[curPh] + '18', border:'1px solid ' + PHASE_COLORS[curPh] + '30' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:6 }}>
                <span style={{ fontSize:12, fontWeight:800, color:PHASE_COLORS[curPh] }}>📌 Фаза (факт): {PHASE_LABELS[curPh]} · нед {wkq.week}/{Wq.length}</span>
                <div style={{ display:'flex', alignItems:'center', gap:8, flex:1, minWidth:220, maxWidth:360 }}>
                  <span style={{ fontSize:10, color:'#fff', opacity:0.6, whiteSpace:'nowrap' }}>1</span>
                  <input type="range" min={1} max={Wq.length} value={wkq.week} aria-label="Выбрать неделю для анализа фазы" onChange={e => setBbWeekSel(Number(e.target.value))} style={{ flex:1, accentColor: PHASE_COLORS[curPh] }} />
                  <span style={{ fontSize:10, color:'#fff', opacity:0.6, whiteSpace:'nowrap' }}>{Wq.length}</span>
                </div>
                <span style={{ fontSize:11, color:'#fff', background:'rgba(255,255,255,0.06)', padding:'2px 8px', borderRadius:20 }}>RIR факт {avgRirFact.toFixed(1)} · Повт {repMin}-{repMax} · Темп {tempoFact} · Сетов {totalSetsWeek}</span>
              </div>
              <div style={{ marginTop:8, display:'flex', gap:2, height:8, borderRadius:6, overflow:'hidden', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)' }}>
                {builtPlan.weeks.map(w=>{
                  const p = ((w as any).phase || 'accumulation') as BBPhase;
                  const isCur = w.week===wkq.week;
                  return <div key={w.week} title={`Нед ${w.week}: ${PHASE_LABELS[p] || p}`} style={{ flex:1, background: PHASE_COLORS[p] || '#fff', opacity: isCur?1:0.55, borderLeft: isCur?'1px solid #fff': 'none', borderRight: isCur?'1px solid #fff':'none' }} />
                })}
              </div>
              <div style={{ marginTop:8, display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div style={{ padding:'8px 9px', borderRadius:8, background:'rgba(0,0,0,0.18)', border:'1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize:10, fontWeight:800, color:PHASE_COLORS[curPh], marginBottom:4 }}>Конфиг фазы ({bbTrainingFocus || 'hypertrophy'})</div>
                  <div style={{ display:'grid', gap:2, fontSize:10, color:'#fff', lineHeight:1.35, fontFamily:'ui-monospace, monospace' }}>
                    <div>repRange: {cfg.repRange[0]}–{cfg.repRange[1]} · RIR {String((cfg as any).rir ?? '2-3')} · tempo {cfg.tempo} · отдых {cfg.restBase}с</div>
                    <div>volume ×{cfg.volumeMultiplier ?? 1} · intensity ×{cfg.intensityMultiplier ?? 1} · {curPh==='deload'?'разгрузка':curPh==='accumulation'?'накопление':curPh==='intensification'?'интенсификация':'пик'}</div>
                    <div style={{ opacity:0.55 }}>Источник: getPhaseConfig('{curPh}', '{bbTrainingFocus}') · PED ×{pedAdapt.combinedMrvMultiplier.toFixed(2)} · уровень {bbLevel}</div>
                  </div>
                </div>
                <div style={{ padding:'8px 9px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize:10, fontWeight:800, color:'#fff', marginBottom:4 }}>Факт недели {wkq.week} — расчёт</div>
                  <div style={{ display:'grid', gap:2, fontSize:10, color:'#fff', lineHeight:1.35, fontFamily:'ui-monospace, monospace' }}>
                    <div>сетов: {totalSetsWeek} · упражнений: {wkExs.length} · RIR средн. {avgRirFact.toFixed(1)} = Σ(rir×sets)/Σsets</div>
                    <div>повторы факт: {repMin}-{repMax} (из workSets) vs конфиг {cfg.repRange[0]}–{cfg.repRange[1]} {Math.abs(repMin - cfg.repRange[0])>3 || Math.abs(repMax - cfg.repRange[1])>3 ? '⚠ отклонение' : '✓ соответствует'}</div>
                    <div>темп факт: {tempoFact} vs конфиг {cfg.tempo} · {avgRirFact.toFixed(1)} vs {(cfg as any).rir ?? '—'}</div>
                  </div>
                </div>
              </div>
              <div style={{ marginTop:6, fontSize:11, color:'#fff', lineHeight:1.4 }}>
                {curPh === 'accumulation' && '🎯 Накопление: метаболический стресс, больший объём, умеренные веса. Дрифт RIR −1/2н, повторы −1/2н, объём ×1.0.'}
                {curPh === 'intensification' && '🎯 Интенсификация: механическое натяжение, снижение объёма ×0.85, рост весов, RIR ↓.'}
                {curPh === 'deload' && '🎯 Разгрузка: активное восстановление, объём ×0.6, RIR+2, темп контроль.'}
                {curPh === 'peaking' && '🎯 Пик: реализация, низкий объём ×0.7, RIR 0-1, высокая интенсивность.'}
              </div>
              <div style={{ marginTop:6, fontSize:10, color:'#fff', opacity:0.7, display:'flex', flexWrap:'wrap', gap:8 }}>
                <span>Уровень «{bbLevel}»</span><span>Цель «{bbGoal}»</span><span>Фокус «{bbTrainingFocus}»</span><span>Методика «{bbMethodology}»</span><span>Сплит «{builtPlan.pattern?.name || ''}»</span><span>PED ×{pedAdapt.combinedMrvMultiplier.toFixed(2)}</span><span>ACWR {acwrQ ? acwrQ.ratio.toFixed(2) : '—'}</span><span>Стадий {Object.keys(phaseGroups).length}</span>
                {(() => {
                  const peakW = W.reduce((best, w) => { const ts = w.sessions.reduce((s, ss) => s + ss.exercises.reduce((ss2, e) => ss2 + e.sets, 0), 0); return ts > best.ts ? { wk: w.week, ts } : best; }, { wk: 1, ts: 0 });
                  const delW = W.filter((w:any) => (w as any).phase === 'deload' || (w as any).deload).map((w:any) => w.week);
                  const accW = W.filter((w:any) => ((w as any).phase || 'accumulation') === 'accumulation');
                  const intW = W.filter((w:any) => ((w as any).phase || '') === 'intensification');
                  const avgRirFor = (ws: any[]) => { const exs = ws.flatMap((w:any) => w.sessions.flatMap((s:any) => s.exercises)); if (!exs.length) return '—'; return (exs.reduce((a:any,e:any) => a + (Number.isFinite(e.rir) ? e.rir : 2), 0) / exs.length).toFixed(1); };
                  return (<>
                    <span style={{ fontSize:10, color:'#f59e0b' }}>📈 пик нед {peakW.wk} ({peakW.ts} сетов)</span>
                    <span style={{ fontSize:10, color: delW.length ? '#22c55e' : '#ef4444' }}>🔻 делод: {delW.length ? 'нед '+delW.join(',') : '⚠ не запланирована'}</span>
                    {accW.length ? <span style={{ fontSize:10, color:'#60a5fa' }}>⬆ накопл {accW.length} нед (RIR {avgRirFor(accW)})</span> : null}
                    {intW.length ? <span style={{ fontSize:10, color:'#ef4444' }}>⬇ интенсиф {intW.length} нед (RIR {avgRirFor(intW)})</span> : null}
                  </>);
                })()}  
              </div>
            </div>
            {needsDeloadQ && curPh !== 'deload' && (
              <div style={{ marginBottom:6, padding:8, borderRadius:10, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)', color:'#ef4444', fontSize:11, fontWeight:600 }}>🚨 ACWR {acwrQ?.ratio.toFixed(2)} &gt; 1.3 — рекомендуется разгрузка (факт фаза {PHASE_LABELS[curPh]} не делод).</div>
            )}
            {curPh === 'deload' && (() => {
              const dp = DELOAD_PROTOCOLS[deloadType] || DELOAD_PROTOCOLS.pump;
              return <div style={{ marginBottom:8, padding:10, borderRadius:12, background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.2)' }}><div style={{ fontSize:12, fontWeight:800, color:'#22c55e', marginBottom:6 }}>🔋 Разгрузка — активное восстановление (параметры из DELOAD_PROTOCOLS['{deloadType}'])</div><div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:6, fontSize:11 }}><div style={{ textAlign:'center', padding:6, borderRadius:8, background:'rgba(34,197,94,0.06)' }}><div style={{ color:'#fff', fontSize:10 }}>Объём</div><div style={{ fontWeight:700, color:'#22c55e' }}>−{Math.round((1-dp.volumeMultiplier)*100)}%</div></div><div style={{ textAlign:'center', padding:6, borderRadius:8, background:'rgba(34,197,94,0.06)' }}><div style={{ color:'#fff', fontSize:10 }}>Интенсивность</div><div style={{ fontWeight:700, color:'#22c55e' }}>−{Math.round((1-dp.intensityMultiplier)*100)}%</div></div><div style={{ textAlign:'center', padding:6, borderRadius:8, background:'rgba(34,197,94,0.06)' }}><div style={{ color:'#fff', fontSize:10 }}>RIR</div><div style={{ fontWeight:700, color:'#22c55e' }}>→{dp.rirTarget}</div></div><div style={{ textAlign:'center', padding:6, borderRadius:8, background:'rgba(34,197,94,0.06)' }}><div style={{ color:'#fff', fontSize:10 }}>Повторения</div><div style={{ fontWeight:700, color:'#22c55e' }}>{dp.repRange[0]}-{dp.repRange[1]}</div></div></div></div>;
            })()}
          </CollapsibleCard>;
        })()}
        {/* 📊 Тренировочный объём — PRO (единственная карточка объёма, без дублей) */}
        {metrics && (() => {
          // — агрегаты по мезоциклу (все недели) для общего объёма
          const totalAgg: Record<string, { direct:number; effective:number }> = {};
          let totalDirectMeso = 0;
          for (const w of W) {
            const agg = aggregateBBVolume((w as any).sessions);
            for (const [m, v] of Object.entries(agg as any)) {
              if (!totalAgg[m]) totalAgg[m] = { direct:0, effective:0 };
              totalAgg[m].direct += (v as any).directSets || 0;
              totalAgg[m].effective += (v as any).effectiveSets || 0;
            }
            // totalDirectMeso — сумма прямых по неделе (без двойного учёта косвенного)
            totalDirectMeso += Object.values(agg as any).reduce((s:number, vv:any)=> s + (vv.directSets||0), 0);
          }
          const totalWeeks = W.length || 1;
          const avgWeeklyDirect = Math.round(totalDirectMeso / totalWeeks);
          // пик-неделя уже в metrics (пиковая по effective)
          const peakWeekDirect = metrics.totalSets;
          const peakWeekEffective = Math.round(metrics.perMuscle.reduce((s,m)=> s + m.effectiveSets, 0));
          // подгруппа спины (ширина/толщина) для пика и мезо
          const backSubPeak: Record<string, number> = {};
          const backSubTotal: Record<string, number> = {};
          const peakIdx = (()=>{ let best=0, idx=0; W.forEach((w:any,i:number)=>{ const ts = (w.sessions as any[]).reduce((a:number,s:any)=> a + s.exercises.reduce((b:number,e:any)=> b + (e.sets||0),0),0); if(ts>best){best=ts; idx=i;}}); return idx; })();
          const peakSessions = (W[peakIdx] as any)?.sessions || [];
          for (const s of peakSessions) for (const e of (s as any).exercises) if (e.muscle==='back') { const sub=(e as any).backSubgroup||'back'; backSubPeak[sub]=(backSubPeak[sub]||0)+(e.sets||0); }
          for (const w of W) for (const s of (w as any).sessions) for (const e of (s as any).exercises) if (e.muscle==='back') { const sub=(e as any).backSubgroup||'back'; backSubTotal[sub]=(backSubTotal[sub]||0)+(e.sets||0); }
          const SUB_LABEL: Record<string,string> = { back_width:'ширина (латы)', back_thickness:'толщина (ромб/трап)', upper_back:'верх спины', traps:'трапеции', rear_delts:'задние дельты', erectors:'разгибатели' };
          const GROUPS: Array<{ id:string; label:string; icon:string; muscles:string[] }> = [
            { id:'chest', label:'Грудь', icon:'🧱', muscles:['chest'] },
            { id:'back', label:'Спина', icon:'🦴', muscles:['back'] },
            { id:'shoulders', label:'Плечи', icon:'🤸', muscles:['delt_front','delt_mid','delt_rear'] },
            { id:'legs', label:'Ноги', icon:'🦵', muscles:['quads','hamstrings','glutes','calves'] },
            { id:'arms', label:'Руки', icon:'💪', muscles:['biceps','triceps','forearms'] },
            { id:'core', label:'Кор', icon:'🧘', muscles:['abs'] },
          ];
          const ru = (m:string)=> (MUSCLE_LABEL_RU as any)[m] || m;
          const statusMeta: Record<string,{label:string;color:string}> = { below_mev:{label:'недотрен',color:'#60a5fa'}, optimal:{label:'оптимум',color:'#22c55e'}, approaching_mrv:{label:'около MRV',color:'#f59e0b'}, exceeding_mrv:{label:'перегруз',color:'#ef4444'} };
          const order: Record<string,number> = { exceeding_mrv:0, approaching_mrv:1, below_mev:2, optimal:3 };
          // сортировка внутри группы по статусу и объёму
          return (
            <div style={{ ...CARD, padding:0, overflow:'hidden', border:'1px solid rgba(0,230,138,0.22)', background:'rgba(6,22,18,0.42)', marginBottom:8 }}>
              <button type="button" onClick={() => setQualityVolumeOpen(v=>!v)} aria-expanded={qualityVolumeOpen} style={{ width:'100%', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', padding:'10px 12px', cursor:'pointer', background:'linear-gradient(135deg, rgba(0,230,138,0.14), rgba(16,185,129,0.06))', border:'none', borderBottom: qualityVolumeOpen ? '1px solid rgba(255,255,255,0.06)' : 'none', textAlign:'left' }}>
                <span style={{ fontSize:12, fontWeight:900, color:'#fff' }}>📊 Тренировочный объём — PRO</span>
                <span style={{ marginLeft:'auto', fontSize:10, fontWeight:700, color:'#fff', background:'rgba(255,255,255,0.06)', padding:'3px 8px', borderRadius:20, border:'1px solid rgba(255,255,255,0.08)' }}>пик {peakWeekDirect} прям · {peakWeekEffective} эфф · среднее {avgWeeklyDirect}/нед · мезоцикл {totalDirectMeso} прям</span>
                <span style={{ width:24, height:24, borderRadius:7, display:'inline-flex', alignItems:'center', justifyContent:'center', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:11, transform: qualityVolumeOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition:'transform 0.2s', marginLeft:8 }}>▼</span>
              </button>
              <div style={{ display: qualityVolumeOpen ? 'block' : 'none' }}>
                <div style={{ padding:'10px 12px', background:'rgba(255,255,255,0.02)', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ fontSize:10, color:'#fff', opacity:0.72, lineHeight:1.35 }}>
                    Пиковая неделя — максимум нагрузки · мезоцикл {totalWeeks} нед · прямой / косвенный / эффективный (с учётом вторичной работы) · подмышцы · частота · статус MEV/MAV/MRV · паттерны/углы/растяжка
                    {pedAdapt.combinedMrvMultiplier>1 && <span style={{ marginLeft:6, color:'#f59e0b', background:'rgba(245,158,11,0.10)', padding:'2px 6px', borderRadius:6, border:'1px solid rgba(245,158,11,0.18)' }}>MRV ×{pedAdapt.combinedMrvMultiplier.toFixed(2)}</span>}
                  </div>
                  <div style={{ marginTop:6, display:'flex', gap:6, flexWrap:'wrap', fontSize:10, color:'#fff' }}>
                    <span><span style={{ color:'#22c55e' }}>●</span> MEV минимум</span>
                    <span><span style={{ color:'#f59e0b' }}>●</span> MAV оптимум</span>
                    <span><span style={{ color:'#ef4444' }}>●</span> MRV максимум</span>
                    <span style={{ opacity:0.6 }}>· пороги уже с учётом уровня, PED и восстановления</span>
                  </div>
                </div>
                <div style={{ padding:'10px 12px', display:'grid', gap:10 }}>
                {GROUPS.map(g=>{
                  const rows = g.muscles.map(mid=> metrics.perMuscle.find(mm=> mm.muscle===mid)).filter(Boolean) as any[];
                  if (rows.length===0) return null;
                  // сортировка внутри группы
                  const sorted = [...rows].sort((a,b)=> (order[a.status]??9)-(order[b.status]??9) || b.effectiveSets - a.effectiveSets);
                  return (
                     <CollapsibleCard key={g.id} title={`${g.icon} ${g.label}`} defaultOpen={true} badge={`${sorted.length} мышц`} headerStyle={{ background:'linear-gradient(135deg, rgba(0,230,138,0.09), rgba(0,230,138,0.03))', color:'#00e68a' }}>
                       <div style={{ display:'grid', gap:8 }}>
                        {sorted.map((m:any)=>{
                          const st = statusMeta[m.status] || statusMeta.optimal;
                          const tot = totalAgg[m.muscle] || { direct:0, effective:0 };
                          const indirectW = Math.max(0, Math.round((m.effectiveSets - m.directSets)*10)/10);
                          const indirectT = Math.max(0, Math.round((tot.effective - tot.direct)*10)/10);
                          const barMax = Math.max(m.mrv, m.effectiveSets, 1);
                          const pct = (v:number)=> Math.max(0, Math.min(100, v/barMax*100));
                          const тяжPct = m.totalSets>0 ? Math.round(m.тяжSets/m.totalSets*100) : 0;
                          const isBack = m.muscle==='back';
                          return (
                             <CollapsibleCard key={m.muscle} title={`${g.icon} ${ru(m.muscle)}`} defaultOpen={false} badge={`${Math.round(m.effectiveSets)} эфф`} headerStyle={{ background:'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))', color:'#fff' }}>
                               <div style={{ padding:0, borderRadius:9, background:'rgba(0,0,0,0.14)' }}>
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                                <span style={{ fontSize:11, fontWeight:800, color:'#fff' }}>{ru(m.muscle)}</span>
                                <span style={{ fontSize:10, fontWeight:800, padding:'2px 7px', borderRadius:20, background: st.color+'18', color: st.color, border:`1px solid ${st.color}22` }}>{st.label}</span>
                               </div>
                               <div style={{ marginTop:5, display:'flex', gap:6, flexWrap:'wrap', fontSize:10, color:'#fff', lineHeight:1.35 }}>
                                <span style={{ background:'rgba(255,255,255,0.04)', padding:'2px 6px', borderRadius:6, border:'1px solid rgba(255,255,255,0.05)' }} title="Прямая / косвенная = эффективная">неделя: <b>{m.directSets}</b> / {indirectW} <span style={{ opacity:0.6 }}>(прям/косв)</span> · <b>{m.effectiveSets}</b> эфф {m.directSets===0 && indirectW>0 ? <span style={{ fontSize:9, color:'#60a5fa', background:'rgba(96,165,250,0.12)', padding:'1px 4px', borderRadius:4, marginLeft:4, border:'1px solid rgba(96,165,250,0.18)' }}>косвенная</span> : null}</span>
                                <span style={{ background:'rgba(255,255,255,0.04)', padding:'2px 6px', borderRadius:6, border:'1px solid rgba(255,255,255,0.05)' }} title="Прямая / косвенная = эффективная">мезоцикл: {tot.direct} / {indirectT} <span style={{ opacity:0.6 }}>(прям/косв)</span> · <b>{Math.round(tot.effective)}</b> эфф · средн. {Math.round(tot.effective/totalWeeks*10)/10}/нед</span>
                              </div>
                              <div style={{ position:'relative', height:10, borderRadius:5, background:'rgba(255,255,255,0.06)', overflow:'hidden', marginTop:6 }}>
                                <div style={{ position:'absolute', left:0, top:0, bottom:0, width: pct(m.effectiveSets)+'%', background: st.color, borderRadius:5, opacity:0.88 }} />
                                <div title={`MEV ${m.mev}`} style={{ position:'absolute', left: pct(m.mev)+'%', top:-2, bottom:-2, width:2, background:'#22c55e' }} />
                                <div title={`MAV ${m.mav}`} style={{ position:'absolute', left: pct(m.mav)+'%', top:-2, bottom:-2, width:2, background:'#f59e0b' }} />
                                <div title={`MRV ${m.mrv}`} style={{ position:'absolute', left: pct(m.mrv)+'%', top:-2, bottom:-2, width:2, background:'#ef4444' }} />
                              </div>
                              <div style={{ display:'flex', justifyContent:'space-between', gap:8, fontSize:10, color:'#fff', marginTop:4, flexWrap:'wrap' }}>
                                <span>MEV {m.mev} · MAV {m.mav} · MRV {m.mrv}</span>
                                <span style={{ opacity:0.85 }}>{m.frequencyPerRotation}×/нед · тяж {тяжPct}% · RIR {m.avgRir.toFixed(1)}</span>
                              </div>
                              <div style={{ fontSize:10, color: st.color, fontWeight:600, marginTop:4 }}>{(()=>{ const eff=m.effectiveSets; if(eff < m.mev) return `Недотрен: +${(m.mev - eff).toFixed(1)} эфф до MEV`; if(eff >= m.mrv) return `Перегруз: −${(eff - m.mrv).toFixed(1)} эфф (выше MRV)`; if(eff > m.mav) return `Выше оптимума: ${m.mav}–${m.mrv}, можно держать или −${(eff - m.mav).toFixed(1)} до MAV`; if(eff < m.mav) return `Ниже оптимума: +${(m.mav - eff).toFixed(1)} эфф до MAV`; return 'Оптимум — в точке MAV'; })()}</div>
                              {(() => {
                                const proQ = (quality as any).proResult as any;
                                if (!proQ) return null;
                                const findPat = proQ.patterns.find((p:any)=> p.muscle===m.muscle || (m.muscle==='chest' && p.muscle==='chest') || (m.muscle==='back' && p.muscle==='back') || (['quads','hamstrings','glutes','calves'].includes(m.muscle) && p.muscle==='legs') || (['delt_front','delt_mid','delt_rear'].includes(m.muscle) && p.muscle==='shoulders') || (['biceps','triceps','forearms'].includes(m.muscle) && p.muscle==='arms') || (m.muscle==='abs' && p.muscle==='core'));
                                const findAng = proQ.angles.find((a:any)=> a.muscle===m.muscle || (['quads','hamstrings','glutes'].includes(m.muscle) && a.muscle==='legs') || (['delt_front','delt_mid','delt_rear'].includes(m.muscle) && a.muscle==='shoulders') || (m.muscle==='chest' && a.muscle==='chest') || (m.muscle==='back' && a.muscle==='back'));
                                const findStr = proQ.stretches.find((s:any)=> s.muscle===m.muscle || (['delt_front','delt_mid','delt_rear'].includes(m.muscle) && s.muscle==='shoulders') || (['quads','hamstrings','glutes','calves'].includes(m.muscle) && s.muscle==='legs') || (['biceps','triceps','forearms'].includes(m.muscle) && s.muscle==='arms') || (m.muscle==='abs' && s.muscle==='core'));
                                if (!findPat && !findAng && !findStr) return null;
                                return (
                                  <div style={{ marginTop:6, padding:'6px 8px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)', fontSize:10, color:'#fff', lineHeight:1.35 }}>
                                    {findPat && <div><b>Паттерны:</b> {findPat.patterns.join(', ')||'—'} {findPat.ok ? '✅' : `⚠️ ${findPat.issue || ''}`} {findPat.expected?.length ? <span style={{ opacity:0.6 }}>(ожид: {findPat.expected.join(', ')})</span> : null}</div>}
                                    {findAng && <div><b>Углы:</b> {findAng.angles.join(', ')||'—'} {findAng.ok ? '✅' : `⚠️ ${findAng.issue || ''}`} {findAng.expected?.length ? <span style={{ opacity:0.6 }}>(ожид: {findAng.expected.join(', ')})</span> : null} · покрытие {Math.round((findAng.coverage||0)*100)}%</div>}
                                    {findStr && <div><b>Растяжка:</b> {findStr.hasStretch ? `✅ ${findStr.stretchExercises.slice(0,2).join(', ')}` : '❌ нет stretch-фазы'} {findStr.ok ? '' : '— добавьте'}</div>}
                                  </div>
                                );
                              })()}
                              {isBack && Object.keys(backSubPeak).length>0 && (
                                <div style={{ marginTop:6, display:'grid', gap:4 }}>
                                  <div style={{ fontSize:9, fontWeight:700, color:'#fff', opacity:0.6 }}>Подмышцы спины (пик / мезо) + паттерны/углы/растяжка:</div>
                                  {Object.entries(backSubPeak).sort((a,b)=> (b[1] as number)-(a[1] as number)).slice(0,4).map(([sub, v])=> {
                                    const subPro = (quality as any).proResult as any;
                                    const subFindPat = subPro?.patterns.find((pp:any)=> pp.muscle==='back' && (pp as any).subgroup===sub);
                                    const subFindAng = subPro?.angles.find((aa:any)=> aa.muscle==='back' && (aa as any).subgroup===sub);
                                    const subFindStr = subPro?.stretches.find((ss:any)=> ss.muscle==='back' && (ss as any).subgroup===sub);
                                    return (
                                    <div key={sub} style={{ display:'grid', gap:3, padding:'5px 6px', borderRadius:6, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)' }}>
                                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#fff' }}>
                                        <span style={{ fontWeight:700 }}>{SUB_LABEL[sub]||sub}</span>
                                        <span>пик {v as number} · всего {backSubTotal[sub]||0} · средн. {Math.round((backSubTotal[sub]||0)/totalWeeks*10)/10}/нед</span>
                                      </div>
                                      {(subFindPat || subFindAng || subFindStr) && (
                                        <div style={{ fontSize:9, color:'#fff', lineHeight:1.3, opacity:0.85 }}>
                                          {subFindPat && <div><b>Паттерн:</b> {subFindPat.patterns?.join(', ')||'—'} {subFindPat.ok?'✅':'⚠️ '+(subFindPat.issue||'')}</div>}
                                          {subFindAng && <div><b>Угол:</b> {subFindAng.angles?.join(', ')||'—'} {subFindAng.ok?'✅':'⚠️ '+(subFindAng.issue||'')} · {Math.round((subFindAng.coverage||0)*100)}%</div>}
                                          {subFindStr && <div><b>Растяжка:</b> {subFindStr.hasStretch?`✅ ${subFindStr.stretchExercises?.slice(0,1).join(', ')}`:'❌ нет'}</div>}
                                        </div>
                                      )}
                                      {!subFindPat && !subFindAng && !subFindStr && (
                                        <div style={{ fontSize:9, color:'#fff', opacity:0.6 }}>Паттерны спины общие: тяги вертикаль/горизонталь · углы в норме · растяжка: тяга с паузой</div>
                                      )}
                                    </div>
                                  )})}
                                </div>
                              )}
                            </div>
                            </CollapsibleCard>
                          );
                        })}
                       </div>
                     </CollapsibleCard>
                  );
                })}
                <div style={{ fontSize:9, color:'#fff', opacity:0.5, lineHeight:1.35, padding:'6px 8px', background:'rgba(255,255,255,0.02)', borderRadius:8, border:'1px solid rgba(255,255,255,0.04)' }}>
                  Прямой — сеты упражнений целевыми на мышцу · косвенный — от базы (жимы → трицепс/плечи, тяги → бицепс, приседы → ягодицы/бицепс бедра) · эффективный = прямой + косвенный · недельный — пиковая неделя, общий — сумма по всем неделям мезоцикла · статус по эффективному.
                </div>
              </div>
              </div>
            </div>
          );
        })()}
        {/* Прогрессия весов по неделям (основные упражнения) — факт из плана */}
        {(() => {
          const totalW = W.length;
          const selW = Math.min(Math.max(1, bbWeekSel), totalW);
          const primaryExs = new Map<string, { name: string; muscle: string; weights: number[] }>();
          for (const w of W) {
            for (const s of w.sessions) {
              for (const e of s.exercises) {
                if (e.role !== 'primary') continue;
                const key = e.name;
                if (!primaryExs.has(key)) primaryExs.set(key, { name: e.name, muscle: e.muscle, weights: new Array(totalW).fill(0) });
                const rec = primaryExs.get(key)!;
                rec.weights[w.week - 1] = e.workSets[0]?.weight || 0;
              }
            }
          }
          if (primaryExs.size === 0) return null;
          const top = [...primaryExs.values()].filter(e => e.weights.some(w => w > 0)).slice(0, 6);
          if (top.length === 0) return null;
          const startW = 0;
          return <CollapsibleCard title="📈 Прогрессия весов (кг) — факт плана" defaultOpen={true} headerStyle={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.04))', color: '#f59e0b' }} badge={`нед ${selW}/${totalW}`}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
              <span style={{ fontSize:10, color:'#fff', opacity:0.6, whiteSpace:'nowrap' }}>1</span>
              <input type="range" min={1} max={totalW} value={selW} aria-label="Выбрать неделю для анализа прогрессии весов" onChange={e => setBbWeekSel(Number(e.target.value))} style={{ flex:1, accentColor:'#f59e0b' }} />
              <span style={{ fontSize:10, color:'#fff', opacity:0.6, whiteSpace:'nowrap' }}>{totalW}</span>
            </div>
            <div style={{ display:'grid', gap:6 }}>
              {top.map(ex => {
                const wSel = ex.weights[selW - 1] || 0;
                const wStart = ex.weights[startW] || 0;
                const prev = selW > 1 ? (ex.weights[selW - 2] || 0) : 0;
                const up = prev > 0 && wSel > prev;
                const down = prev > 0 && wSel < prev;
                const delta = wStart > 0 ? wSel - wStart : 0;
                const deltaStr = delta > 0 ? '+' + delta : delta < 0 ? String(delta) : '0';
                const pct = (() => {
                  const nonZero = ex.weights.filter(v => v > 0);
                  if (nonZero.length < 2) return null;
                  const mn = Math.min(...nonZero), mx = Math.max(...nonZero);
                  if (mx === mn) return 100;
                  return Math.round(((wSel - mn) / (mx - mn)) * 100);
                })();
                return (
                  <div key={ex.name} style={{ display:'grid', gridTemplateColumns:'1.4fr 0.7fr 0.7fr 1fr', gap:6, alignItems:'center', padding:'7px 9px', borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontWeight:600, color:'#fff', fontSize:11, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={ex.name}>{ex.name.substring(0, 22)}</span>
                    <span style={{ fontSize:10, color:'#fff', opacity:0.55 }}>нед 1: <b style={{ color:'#fff' }}>{wStart || '—'}</b> кг</span>
                    <span style={{ fontSize:11, fontWeight:800, color: up ? '#22c55e' : down ? '#ef4444' : '#f59e0b' }}>{wSel ? wSel + ' кг' : '—'}{wSel > 0 && delta !== 0 ? <span style={{ fontSize:9, opacity:0.8, marginLeft:4 }}>({deltaStr})</span> : null}</span>
                    <span style={{ height:6, borderRadius:6, background:'rgba(255,255,255,0.08)', overflow:'hidden' }}>
                      <span style={{ display:'block', height:'100%', width: (pct ?? 0) + '%', background: up ? '#22c55e' : down ? '#ef4444' : '#f59e0b', transition:'width 0.2s' }} />
                    </span>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop:6, fontSize:10, color:'#fff', display:'flex', gap:12 }}>
              <span>🟢 +вес</span><span>🟡 стабильно</span><span>🔴 −вес (разгрузка)</span><span style={{ opacity:0.6, marginLeft:'auto' }}>ползунок — выбор недели</span>
            </div>
          </CollapsibleCard>;
        })()}
        <CollapsibleCard title="🗑 Мусорный объём" defaultOpen={false} headerStyle={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.03))', color: '#ef4444' }}>
        {(() => {
          const garbage = detectGarbageVolume(builtPlan.weeks, weakPoints, { level: bbLevel, trainingYears: bbTrainingYears, focusGroup: '', specialization: specializationMode, specializationTargets: specTargets });
          const ruMuscleG = (m: string) => (MUSCLE_LABEL_RU as any)[m] || m;
          const ruReason = (r: string) => r
            .replace(/Дублирование паттерна (\S+) для (\S+)/, 'Дубль изоляции «$1» для «$2» — в одной сессии достаточно одной')
            .replace(/Мышца (\S+) не входит в тег сессии (\S+)/, 'Мышца «$1» не входит в день «$2» — проверьте совместимость сплита с выбранными группами');
          const paramChips: string[] = [];
          paramChips.push(`уровень ${bbLevel}`);
          if (bbTrainingYears!==undefined) paramChips.push(`стаж ${bbTrainingYears}л`);
          paramChips.push(`цель ${bbGoal}`);
          paramChips.push(`фокус ${bbTrainingFocus}`);
          paramChips.push(`методика ${bbMethodology}`);
          paramChips.push(`сплит ${builtPlan.pattern?.name || builtPlan.pattern?.id || '—'}`);
          paramChips.push(`объём ${bbVolGoal}${trainingVolumeMode==='high'?' (объёмный)':''}`);
          if (weakPoints.length) paramChips.push(`слабые: ${weakPoints.join(', ')}`);
          if (specializationMode) paramChips.push(`специализация ${specTargets.join('+')}`);
          if (bbEquipment.length) paramChips.push(`оборудование ${bbEquipment.slice(0,3).join(', ')}${bbEquipment.length>3?'…':''}`);
          if (injuries.length) paramChips.push(`травмы ${injuries.length}`);
          if (garbage.length === 0) {
            return (
              <div style={{ ...CARD, background:'linear-gradient(135deg, rgba(34,197,94,0.08), rgba(16,185,129,0.04))', border:'1px solid rgba(34,197,94,0.18)', position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', top:-12, right:-12, width:80, height:80, borderRadius:80, background:'radial-gradient(circle, rgba(34,197,94,0.12), transparent 70%)' }} />
                <div style={{ fontSize:12, fontWeight:800, color:'#22c55e', display:'flex', alignItems:'center', gap:6 }}>🗑 Мусорный объём: чисто ✅ <span style={{ fontSize:10, fontWeight:600, color:'#22c55e', background:'rgba(34,197,94,0.12)', padding:'2px 7px', borderRadius:20, border:'1px solid rgba(34,197,94,0.22)' }}>соответствует параметрам</span></div>
                <div style={{ fontSize:11, color:'#fff', marginTop:6, lineHeight:1.5 }}>Дублей изоляций не найдено. Для слабых/фокусных групп повтор паттерна допустим — учтена каноника <span style={{ fontFamily:'ui-monospace, monospace', background:'rgba(255,255,255,0.06)', padding:'1px 4px', borderRadius:4 }}>chest_upper→chest, delt_mid→shoulders</span>. Икры «стоя+сидя» — по дизайну 2 разных упражнения, не дубль. Проверка: compound-паттерны (жим/тяга/присед) — не считаются мусором (разные углы — норма).</div>
                <div style={{ marginTop:8, display:'flex', flexWrap:'wrap', gap:4 }}>
                  {paramChips.map((p,i)=> <span key={i} style={{ fontSize:10, color:'#fff', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', padding:'2px 7px', borderRadius:20 }}>{p}</span>)}
                </div>
              </div>
            );
          }
          return (
            <div style={{ ...CARD, background:'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(245,158,11,0.04))', border:'1px solid rgba(239,68,68,0.18)', position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:-10, right:-10, width:90, height:90, borderRadius:90, background:'radial-gradient(circle, rgba(239,68,68,0.12), transparent 70%)' }} />
              <div style={{ fontSize:12, fontWeight:800, color:'#ef4444', display:'flex', alignItems:'center', gap:8 }}>🗑 Мусорный объём: найдено {garbage.length} <span style={{ fontSize:10, fontWeight:600, color:'#ef4444', background:'rgba(239,68,68,0.12)', padding:'2px 7px', borderRadius:20, border:'1px solid rgba(239,68,68,0.22)' }}>несоответствие параметрам</span></div>
              <div style={{ fontSize:11, color:'#fff', marginTop:6, lineHeight:1.5 }}>
                Дублирование изоляций: план содержит повторы одного паттерна для одной мышцы в одной сессии — при выбранных параметрах это избыточно. Для слабых/фокусных групп дубль <b>допустим</b> (учтена каноника), для остальных — мусор. Проверено по: {paramChips.slice(0,6).join(' · ')}{paramChips.length>6?' …':''}.
              </div>
              <div style={{ marginTop:8, display:'grid', gap:6 }}>
                {garbage.slice(0, 6).map((g, i) => (
                  <div key={i} style={{ display:'flex', gap:8, alignItems:'flex-start', padding:'7px 9px', borderRadius:8, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.12)' }}>
                    <span style={{ flexShrink:0, width:22, height:22, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(239,68,68,0.14)', color:'#ef4444', fontWeight:800, fontSize:11 }}>{i+1}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>{g.exerciseName} <span style={{ fontWeight:400, opacity:0.7 }}>· {ruMuscleG(g.muscle)} · {g.sessionTag || 'день'}</span></div>
                      <div style={{ fontSize:10, color:'#fbbf24', marginTop:2 }}>{ruReason(g.reason)}</div>
                      <div style={{ fontSize:10, color:'#fff', opacity:0.6, marginTop:2 }}>Исправление: заменить на другой угол/хват или убрать (для слабых — оставить, если цель — специализация).</div>
                    </div>
                  </div>
                ))}
              </div>
              {garbage.length > 6 && <div style={{ marginTop:6, fontSize:11, color:'#fff', textAlign:'center', opacity:0.7 }}>…и ещё {garbage.length - 6} — откройте план, проверьте сессии</div>}
              <div style={{ marginTop:8, display:'flex', flexWrap:'wrap', gap:4 }}>
                {paramChips.map((p,i)=> <span key={i} style={{ fontSize:10, color:'#fff', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', padding:'2px 7px', borderRadius:20 }}>{p}</span>)}
              </div>
            </div>
          );
        })()}</CollapsibleCard>
        {/* Рекомендации — единственные, детали уже в них (quality.details убраны как дубль) */}
        <CollapsibleCard title="💡 Рекомендации по качеству плана" defaultOpen={false} headerStyle={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.03))', color: '#f59e0b' }}>{quality.recommendations && quality.recommendations.length > 0 && (
          <div style={{ ...CARD, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.15)' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b', marginBottom:6, display:'none' }}>💡 Рекомендации по качеству плана</div>
            {quality.recommendations.map((r, i) => (
              <div key={i} style={{ fontSize:11, color:'#fff', marginBottom:3, paddingLeft:4, borderLeft:'2px solid #f59e0b' }}>{r}</div>
            ))}
          </div>
        )}</CollapsibleCard>
        <CollapsibleCard title="📊 Объём по неделям (сетов)" defaultOpen={false} headerStyle={{ background: 'linear-gradient(135deg, rgba(96,165,250,0.08), rgba(96,165,250,0.03))', color: '#60a5fa' }}>{(() => {
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
        })()}</CollapsibleCard>
        <CollapsibleCard title="📉 Динамика RIR по неделям" defaultOpen={false} headerStyle={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.08), rgba(168,85,247,0.03))', color: '#a855f7' }}>{(() => {
          const rdata: RirRecord[] = [];
          W.forEach(w => w.sessions.forEach(s => s.exercises.forEach(e => rdata.push({ week: w.week, exercise: e.name || e.muscle || '', rir: e.rir || 0 }))));
          if (rdata.length < 2) return null;
          return (
            <div style={{ ...CARD, marginTop:8 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#a855f7', marginBottom:6 }}>📉 Динамика RIR по неделям</div>
              <RirDriftChart data={rdata} />
            </div>
          );
        })()}</CollapsibleCard>
        <CollapsibleCard title="📈 Оценка тренировочной нагрузки" defaultOpen={false} headerStyle={{ background: 'linear-gradient(135deg, rgba(96,165,250,0.08), rgba(96,165,250,0.03))', color: '#60a5fa' }}><div style={{ ...CARD, background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.15)' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#60a5fa', marginBottom:6, display:'none' }}>📈 Оценка тренировочной нагрузки</div>
          {!ratio ? <div style={SMALL}>Недостаточно данных sRPE для расчёта ACWR. Ведите дневник тренировок.</div> : (
            <div>
              <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                <span style={SMALL}>ACWR: <b style={{ color:ratio.ratio>1.5?'#ef4444':ratio.ratio>1.3?'#eab308':'#22c55e', fontSize:14 }}>{ratio.ratio.toFixed(2)}</b></span>
                <span style={{ padding:'3px 8px', borderRadius:8, fontSize:11, fontWeight:700, background:ratio.zone==='dangerous'?'rgba(239,68,68,0.15)':ratio.zone==='caution'?'rgba(234,179,8,0.15)':'rgba(34,197,94,0.15)', color:ratio.zone==='dangerous'?'#ef4444':ratio.zone==='caution'?'#eab308':'#22c55e' }}>{ratio.zone === 'dangerous' ? '⛔ Опасно' : ratio.zone === 'caution' ? '⚠ Осторожно' : ratio.zone === 'optimal' ? '✅ Оптимум' : '⬇ Недотрен'}</span>
              </div>
              <div style={{ marginTop:6, ...SMALL }}>Хроническая нагрузка (28д) vs острая (7д). Цель: 0.8-1.3. Разгрузка при {`>`}1.5.</div>
            </div>
          )}
        </div></CollapsibleCard>
        {/* Дополнительно: прогноз прогрессии — карточка в стиле всех карточек шага */}
        <CollapsibleCard title="🔧 Дополнительно: прогноз прогрессии" defaultOpen={false} headerStyle={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.10), rgba(59,130,246,0.03))', color: '#60a5fa' }} badge={`${W.length} нед`}>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <MesocycleProgressionCard weeks={W.length} startVolumeSets={Math.round(W.reduce((s,w)=>s+w.sessions.reduce((ss,sess)=>ss+sess.exercises.reduce((sss,e)=>sss+e.sets,0),0),0)/W.length)} startIntensityPct={0.7} startRIR={2} goal="hypertrophy" title="Прогрессия мезоцикла (ББ)" hideApply />
          </div>
        </CollapsibleCard>
        <div style={{ display:'flex', gap:8, marginTop:10 }}>
          <button style={{ ...BTN, flex:1 }} onClick={() => setStep('adjust')}>Далее: ручная коррекция →</button>
          <button style={BTN_GHOST} onClick={() => setStep('weights')}>← Назад</button>
        </div>
        {renderActionRow(true)}
          </div>
        <CollapsibleCard title="📤 Экспорт плана" defaultOpen={false} headerStyle={{ background: 'linear-gradient(135deg, rgba(96,165,250,0.12), rgba(96,165,250,0.04))', color: '#60a5fa' }} badge="PDF · CSV · тренеру">{quality && (
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
              hasDeload={(quality as any).hasDeloadActual ?? autoDeload}
              meta={{ splitName: builtPlan.pattern?.name || 'BB-сплит', weeks: W.length, corrections: builtPlan.rationale }}
            />
          </div>
        )}</CollapsibleCard>
      </div>
    );
  };

  const renderAdjust = () => (
    <BbAdjustStep
      builtPlan={builtPlan}
      metrics={metrics}
      setBuiltPlan={setBuiltPlan}
      bbWorkMax={bbWorkMax}
      loadStrategy={loadStrategy}
      exerciseEdits={exerciseEdits}
      setExerciseEdits={setExerciseEdits}
      editsRef={editsRef}
      commitEdits={commitEdits}
      editsHistory={editsHistory}
      redosHistory={redosHistory}
      undoEdits={undoEdits}
      redoEdits={redoEdits}
      bulkModal={bulkModal}
      setBulkModal={setBulkModal}
      bulkField={bulkField}
      setBulkField={setBulkField}
      bulkMode={bulkMode}
      setBulkMode={setBulkMode}
      bulkValue={bulkValue}
      setBulkValue={setBulkValue}
      bbWeekSel={bbWeekSel}
      setBbWeekSel={setBbWeekSel}
      bbWeeks={bbWeeks}
      startDateInput={startDateInput}
      setStartDateInput={setStartDateInput}
      currentWeek={currentWeek}
      savedPlans={savedPlans}
      showCompare={showCompare}
      setShowCompare={setShowCompare}
      diffVariantId={diffVariantId}
      setDiffVariantId={setDiffVariantId}
      diffPlan={diffPlan}
      showPeakWeek={showPeakWeek}
      peakPrep={peakPrep}
      peakWeekCategory={peakWeekCategory}
      peakSpec={peakSpec}
      weakPoints={weakPoints}
      dupMode={dupMode}
      flash={flash}
      setStep={setStep}
      setExSwapModal={setExSwapModal}
      adjustVolume={adjustVolume}
      adjustWeight={adjustWeight}
      handleSavePlan={handleSavePlan}
      handleSaveToMyPlans={handleSaveToMyPlans}
      handleSaveAsUserProgram={handleSaveAsUserProgram}
      handleSaveVariant={handleSaveVariant}
      handleSendToNutrition={handleSendToNutrition}
      handleSendToExecution={handleSendToExecution}
      handlePrintPlan={handlePrintPlan}
      handleExportIcs={handleExportIcs}
      handlePrintMesocycleTable={handlePrintMesocycleTable}
      handleExportQualityReport={handleExportQualityReport}
      handleExportCSV={handleExportCSV}
      handleLoadVariant={handleLoadVariant}
      handleDeleteVariant={handleDeleteVariant}
      handleMoveExercise={handleMoveExercise}
      applyPeakWeekToCurrentPlan={applyPeakWeekToCurrentPlan}
      applyEditsToPlan={applyEditsToPlan}
    />
  );

  // ── 🏁 Contest prep (опциональный шаг 7) ──
  const renderContestPrep = () => {
    const today = isoToday();
    const phaseNow = prepPlan ? prepPhaseForDate(prepPlan, today) : null;
    const strategySafe = !prepWaterMode || !prepSodiumMode; // всегда true — для читаемости
    void strategySafe;
    return (
      <div>
        <div style={H}>🏁 Contest Prep — подготовка к соревнованию</div>
        <div style={SMALL}>
          Опциональный цикл: <b>подготовка → taper → peak week → show day</b>. План тренировок строится как
          обычный; этот шаг накладывает фазы поверх него (копию) и генерирует дневные цели питания.
          Можно пропустить — план останется обычным.
        </div>
        {/* PRO Wizard 5 шагов */}
        <div style={{ display:'flex', gap:6, marginTop:10, flexWrap:'wrap' }}>
          {[1,2,3,4,5].map(n => {
            const labels=['1 Атлет','2 Кондиция','3 Стратегии','4 Trial','5 Preview'] as const;
            const active=contestWizard===n;
            const disabled=false;
            return <button key={n} onClick={()=>setContestWizard(n as any)} disabled={disabled} style={{ flex:1, minWidth:70, padding:'6px 8px', borderRadius:8, fontSize:10, fontWeight: active?800:600, background: active?'rgba(236,72,153,0.2)':'rgba(255,255,255,0.04)', border: active?'1px solid #ec4899':'1px solid rgba(255,255,255,0.08)', color: active?'#ec4899':'#fff', cursor:'pointer' }}>{labels[n-1]}</button>;
          })}
        </div>
        <div style={{ fontSize:9, color:'#fff', marginTop:4, textAlign:'center' }}>
          {contestWizard===1 && 'Шаг 1: атлет, дата, категория, специализация'}
          {contestWizard===2 && 'Шаг 2: кондиция BF gap, spillRisk, готовность'}
          {contestWizard===3 && 'Шаг 3: стратегии вода/натрий/карбы (gate: BF>14% + light → не front/high)'}
          {contestWizard===4 && 'Шаг 4: репетиция trial peak за 21-28д (фото/вес) → рекомендация'}
          {contestWizard===5 && 'Шаг 5: preview taper curve, peakWeek, warnings, экспорт'}
        </div>

        {/* Параметры */}
        <div style={{ ...CARD, marginTop:10 }}>
          <div style={{ fontSize:12, fontWeight:800, color:'#ec4899', marginBottom:8 }}>📅 Параметры подготовки</div>
          <div style={{ display: contestWizard===1 ? 'grid' : 'none', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
            <div>
              <div style={{ ...SMALL, marginBottom:4 }}>📆 Дата шоу</div>
              <input type="date" value={prepShowDate} onChange={e => handleShiftPrepShowDate(e.target.value)} style={{ ...IN, width:'100%' }} />
            </div>
            <div>
              <PopupSelect
                label="🎭 Категория"
                value={peakWeekCategory}
                onChange={v => setPeakWeekCategory(v as BBContestCategory)}
                options={(Object.keys(CATEGORY_PROFILES) as BBContestCategory[]).map(c => ({ id: c, label: CONTEST_CATEGORY_LABELS[c] }))}
              />
            </div>
            <div>
              <PopupSelect
                label="⭐ Специализация"
                value={peakSpec}
                onChange={v => setPeakSpec(v as ContestSpecialization)}
                options={(Object.keys(CONTEST_SPECIALIZATION_LABELS) as ContestSpecialization[]).map(s => ({ id: s, label: CONTEST_SPECIALIZATION_LABELS[s] }))}
              />
            </div>
            <div>
              <div style={{ ...SMALL, marginBottom:4 }}>Противопоказания (из профиля + ручные)</div>
              <input
                value={prepContraExtra.join(', ')}
                onChange={e => setPrepContraExtra(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                placeholder={prepContra.length ? prepContra.join(', ') : 'kidney, heart, hypertension, diabetes…'}
                style={{ ...IN, width:'100%' }}
              />
            </div>
          </div>
          {/* Step 2 Кондиция — readiness + spillRisk (wizard) */}
          <div style={{ display: contestWizard===2 ? 'block' : 'none', marginBottom:8, padding:8, borderRadius:8, background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.15)' }}>
            <div style={{ ...SMALL, color:'#60a5fa', fontWeight:700, marginBottom:4 }}>📊 Кондиция (BF gap, spill)</div>
            <div style={{ fontSize:11, color: readiness.verdict==='behind' ? '#f87171' : readiness.verdict==='ahead' ? '#4ade80' : '#fff' }}>{readiness.note} {readiness.gap!=null ? `(gap ${readiness.gap}%)` : ''}</div>
            <div style={{ fontSize:11, marginTop:4, color: spillRisk.level==='high' ? '#ef4444' : spillRisk.level==='medium' ? '#f59e0b' : '#4ade80' }}>Spill риск {spillRisk.level}: {spillRisk.note}</div>
            {spillRisk.level==='high' && <div style={{ fontSize:9, color:'#ef4444', marginTop:4 }}>⛔ High: смените carb на moderate/linear, stable вода</div>}
            {isShortCycle(prepWeeks + prepTaperWeeks + 1) && <div style={{ fontSize:9, color:'#fbbf24', marginTop:4 }}>⚠ ShortCycle 4-6 нед: linear/moderate без final каскада</div>}
          </div>
          {/* Соревнования — единый словарь A/B/C — wizard 3 */}
          <div style={{ display: contestWizard===3 ? 'block' : 'none', marginBottom:8, padding:8, borderRadius:8, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.15)' }}>
            <div style={{ ...SMALL, marginBottom:4, color:'#f87171', fontWeight:700 }}>🏁 Соревнования (необязательно)</div>
            {(prepCompetitions && prepCompetitions.length > 0) ? (
              <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:6 }}>
                {prepCompetitions.map(c => (
                  <div key={c.id} style={{ display:'flex', gap:6, alignItems:'center', padding:'4px 6px', borderRadius:6, background:'rgba(255,255,255,0.04)', border: c.id===prepMainCompetitionId ? '1px solid rgba(251,191,36,0.4)' : '1px solid rgba(255,255,255,0.06)' }}>
                    <button onClick={() => setPrepMainCompetitionId(c.id===prepMainCompetitionId ? undefined : c.id)} style={{ fontSize:11, padding:'2px 6px', borderRadius:4, background: c.id===prepMainCompetitionId ? 'rgba(251,191,36,0.2)' : 'transparent', color: c.id===prepMainCompetitionId ? '#fbbf24' : 'rgba(255,255,255,0.5)', border:'1px solid rgba(255,255,255,0.1)', cursor:'pointer' }}>{c.id===prepMainCompetitionId ? '★' : '☆'}</button>
                    <input value={c.name} onChange={e => setPrepCompetitions(prev => (prev||[]).map(x => x.id===c.id ? {...x, name:e.target.value} : x))} style={{ flex:1, background:'transparent', color:'#fff', border:'1px solid rgba(255,255,255,0.1)', borderRadius:4, padding:'2px 6px', fontSize:11 }} />
                    <PopupSelect
                      label="Приоритет"
                      value={c.priority || 'B'}
                      onChange={v => setPrepCompetitions(prev => (prev||[]).map(x => x.id===c.id ? {...x, priority: v as any} : x))}
                      options={[{ id: 'A', label: 'A главный' }, { id: 'B', label: 'B контроль' }, { id: 'C', label: 'C тренир.' }]}
                    />
                    <input type="date" value={c.date || ''} onChange={e => setPrepCompetitions(prev => (prev||[]).map(x => x.id===c.id ? {...x, date:e.target.value || undefined} : x))} style={{ background:'transparent', color:'#fbbf24', border:'1px solid rgba(255,255,255,0.1)', borderRadius:4, fontSize:10 }} />
                    <button onClick={() => setPrepCompetitions(prev => (prev||[]).filter(x => x.id!==c.id))} style={{ color:'#f87171', background:'transparent', border:'none', cursor:'pointer', fontSize:12 }}>✕</button>
                  </div>
                ))}
              </div>
            ) : <div style={{ fontSize:10, color:'rgba(255,255,255,0.55)', marginBottom:6 }}>Одно шоу — дата выше. Добавьте старты для мульти-пика A/B/C.</div>}
            <button onClick={() => setPrepCompetitions(prev => [...(prev||[]), { id:`comp_${Date.now().toString(36)}`, name:`Старт ${((prev||[]).length)+1}`, priority:'B' }])} style={{ fontSize:10, padding:'4px 8px', borderRadius:6, background:'rgba(239,68,68,0.1)', color:'#f87171', border:'1px dashed rgba(239,68,68,0.3)', cursor:'pointer' }}>＋ Добавить соревнование</button>
          </div>
          <div style={{ display: contestWizard===3 ? 'block' : 'none' }}>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center', marginBottom:8 }}>
            <span style={{ ...SMALL }}>Недели подготовки:</span>
            <button style={BTN_GHOST} onClick={() => handleExtendPrep(-1)}>−</button>
            <b style={{ fontSize:15, color:'#fff', minWidth:28, textAlign:'center' }}>{prepPlan ? prepPlan.preparation.weeks : prepWeeks}</b>
            <button style={BTN_GHOST} onClick={() => handleExtendPrep(1)}>+</button>
            <span style={{ ...SMALL, marginLeft:10 }}>Недели taper (1-4):</span>
            <button style={BTN_GHOST} onClick={() => setPrepTaperWeeks(w => Math.max(1, w - 1))}>−</button>
            <b style={{ fontSize:15, color:'#fff', minWidth:24, textAlign:'center' }}>{prepTaperWeeks}</b>
            <button style={BTN_GHOST} onClick={() => setPrepTaperWeeks(w => Math.min(4, w + 1))}>+</button>
          </div>
          {/* 🤖 Адаптивный тапер (Э2): sRPE/ACWR/усталость → рекомендация недель */}
          {adaptiveTaper && (
            <div style={{ marginBottom:8, padding:10, borderRadius:10, background:'rgba(168,85,247,0.07)', border:'1px solid rgba(168,85,247,0.22)' }}>
              <div style={{ fontSize:11, fontWeight:800, color:'#c084fc', marginBottom:4 }}>🤖 Адаптивный тапер <span style={{ fontWeight:400, color:'#fff' }}>· sRPE {adaptiveTaper.srpeN} сесс.{adaptiveTaper.acwrRatio != null ? ` · ACWR ${adaptiveTaper.acwrRatio.toFixed(2)}` : ''}{adaptiveTaper.srpeN >= 3 ? ` · mean ${adaptiveTaper.srpeStat.mean}/monotony ${adaptiveTaper.srpeStat.monotony}` : ''}</span></div>
              {adaptiveTaper.srpeN < 3 && adaptiveTaper.acwrRatio == null && (
                <div style={{ fontSize:10, color:'#fff', marginBottom:4 }}>Нет данных дневника (нужны sRPE-сессии) — рекомендация по базовым неделям. Пик-неделя не двигается.</div>
              )}
              {adaptiveTaper.rec.reasons.length > 0 ? adaptiveTaper.rec.reasons.map((r, i) => (
                <div key={i} style={{ fontSize:10, color:'#fff' }}>• {r}</div>
              )) : (
                <div style={{ fontSize:10, color:'#fff' }}>По дневнику перегрузки нет — держите {prepTaperWeeks} нед.</div>
              )}
              {lastTest?.verdict === 'tested_ok' && adaptiveTaper.rec.weeksOut > 1 && (
                <div style={{ fontSize:10, color:'#4ade80' }}>🧪 Trial peak пройден успешно — допустимо сократить тапер до 1 нед вручную.</div>
              )}
              <div style={{ display:'flex', gap:8, marginTop:6 }}>
                <button style={BTN_GHOST} onClick={handleApplyAdaptiveTaper}>Применить: {adaptiveTaper.rec.weeksOut} нед{adaptiveTaper.rec.volumeMult < 1 ? ' · ×0.85' : ''}</button>
              </div>
              <div style={{ fontSize:9, color:'#fff', marginTop:4 }}>Пик-неделя и дата шоу не двигаются. После применения — «Собрать и применить».</div>
            </div>
          )}
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:8 }}>
            <div>
              <div style={{ ...SMALL, marginBottom:4 }}>💧 Вода</div>
              <div style={{ display:'flex', gap:6 }}>
                {(['stable', 'tapered', 'high'] as WaterStrategy[]).map(m => (
                  <button key={m} onClick={() => setPrepWaterMode(m)} style={{ ...BTN_GHOST, background: prepWaterMode === m ? 'rgba(59,130,246,0.2)' : 'transparent', borderColor: prepWaterMode === m ? '#3b82f6' : undefined, color: prepWaterMode === m ? '#60a5fa' : undefined }}>
                    {m === 'stable' ? 'Stable — рекомендовано' : m === 'tapered' ? 'Tapered — умеренно' : 'High load+cut'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ ...SMALL, marginBottom:4 }}>🧂 Натрий</div>
              <div style={{ display:'flex', gap:6 }}>
                {(['stable', 'tapered'] as SodiumStrategy[]).map(m => (
                  <button key={m} onClick={() => setPrepSodiumMode(m)} style={{ ...BTN_GHOST, background: prepSodiumMode === m ? 'rgba(245,158,11,0.2)' : 'transparent', borderColor: prepSodiumMode === m ? '#f59e0b' : undefined, color: prepSodiumMode === m ? '#fbbf24' : undefined }}>
                    {m === 'stable' ? 'Stable — не трогаем' : 'Tapered −30% за 48ч'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ ...SMALL, marginBottom:4 }}>🍚 Карб-загрузка</div>
              <div style={{ display:'flex', gap:6 }}>
                {(['back', 'moderate', 'front'] as CarbLoadStrategy[]).map(m => (
                  <button key={m} onClick={() => setPrepCarbMode(m)} style={{ ...BTN_GHOST, background: prepCarbMode === m ? 'rgba(34,197,94,0.2)' : 'transparent', borderColor: prepCarbMode === m ? '#22c55e' : undefined, color: prepCarbMode === m ? '#4ade80' : undefined }}>
                    {m === 'back' ? 'Back-load' : m === 'moderate' ? 'Классика 3/3' : 'Front-load'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ ...SMALL, marginBottom:4 }}>🏋️ Протокол (Библиотека)</div>
              <div style={{ display:'flex', gap:6, marginBottom:8 }}>
                {(['bb', 'classic', 'pl'] as PeakingProtocol[]).map(m => (
                  <button key={m} onClick={() => setPrepTrainingProtocol(m)} style={{ ...BTN_GHOST, background: prepTrainingProtocol === m ? 'rgba(236,72,153,0.2)' : 'transparent', borderColor: prepTrainingProtocol === m ? '#ec4899' : undefined, color: prepTrainingProtocol === m ? '#f472b6' : undefined }}>
                    {m === 'bb' ? 'BB 4н' : m === 'classic' ? 'Classic WF' : 'PL 3н'}
                  </button>
                ))}
              </div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
                <BbToggleChip
                  checked={prepPreferLowFiber}
                  onChange={setPrepPreferLowFiber}
                  label="Низковолокнистые карбс"
                  accent="#22c55e"
                  ariaLabel="Низковолокнистые углеводы"
                />
                <BbToggleChip
                  checked={prepCreatineStop}
                  onChange={setPrepCreatineStop}
                  label="Стоп креатин"
                  accent="#f87171"
                  ariaLabel="Отмена креатина"
                />
              </div>
            </div>
            <div>
              <div style={{ ...SMALL, marginBottom:4 }}>🏋️ Режим подготовки</div>
              <div style={{ display:'flex', gap:6 }}>
                {([1.0, 0.85] as number[]).map(m => (
                  <button key={m} onClick={() => setPrepVolumeMode(m)} style={{ ...BTN_GHOST, background: prepVolumeMode === m ? 'rgba(96,165,250,0.2)' : 'transparent', borderColor: prepVolumeMode === m ? '#60a5fa' : undefined, color: prepVolumeMode === m ? '#60a5fa' : undefined }}>
                    {m === 1.0 ? 'Сохранение (RIR 1–3)' : 'Поддерживающий ×0.85'}
                  </button>
                ))}
              </div>
              <div style={{ fontSize:9, color:'#fff', marginTop:3 }}>
                {prepVolumeMode === 1.0 ? 'Объём как в плане, RIR 1–3, без отказных техник, веса сохраняются' : 'Объём ×0.85 (дефицит), RIR 2–3, без отказных техник'}
                {' · '}{peds.length > 0 ? '💉 на курсе — восстановление выше, объём можно сохранять (×1.0)' : expYearsForPrep >= 2 ? 'natural: при дефиците рекомендуем ×0.85' : 'новичок: объём не снижать (×1.0), RIR 2–3'}
              </div>
            </div>
          </div>
          </div>
          {(prepWaterMode !== 'stable' || prepSodiumMode !== 'stable') && (
            <BbRowSwitch
              checked={prepConfirmedManip}
              onChange={setPrepConfirmedManip}
              icon="⚠"
              accent="#fbbf24"
              title="Я понимаю: умеренная модуляция воды/натрия допустима только при стабильном здоровье, без противопоказаний"
              desc="Диуретики не назначаются; при симптомах нарушения электролитов — план остановить. Подтверждаю выбор."
              ariaLabel="Подтверждаю модуляцию воды и натрия"
            />
          )}
          {/* PRO-2 P1: замок high-манипуляций без trial (движок back-compat, гейт на поверхности сборки) */}
          {(() => {
            try {
              const note = manipulationLockNote(buildContestPrepConfig());
              if (!note) return null;
              return (
                <div style={{ fontSize:10, color:'#fbbf24', background:'rgba(251,191,36,0.07)', border:'1px solid rgba(251,191,36,0.25)', borderRadius:8, padding:8, marginBottom:8, lineHeight:1.5 }}>
                  {note} Сборка с High заблокирована до trial (кнопка ниже вернёт ошибку) — tapered доступен с подтверждением выше.
                </div>
              );
            } catch { return null; }
          })()}
          <div style={{ fontSize:10, color:'#fff', background:'rgba(96,165,250,0.05)', border:'1px solid rgba(96,165,250,0.12)', borderRadius:8, padding:8, marginBottom:8, lineHeight:1.5 }}>
            <b style={{ color:'#60a5fa' }}>Что изменится в плане:</b> только финальная подготовка (×0.9, RIR 2–3), taper (объём 85%→60%, веса сохраняются, RIR 2–4) и пик-неделя (памп). Недели подготовки остаются по объёму 100% (режим подготовки: RIR 1–3, без отказных техник). Весь цикл НЕ переделывается; короткий план не расширяется автоматически — при необходимости добавьте недели подготовки.
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <button
              style={{ ...BTN, flex:1, background: 'linear-gradient(135deg,#ec4899,#db2777)', color:'#fff' }}
              disabled={prepBusy || !builtPlan}
              onClick={() => assembleContestPrep(true)}
            >
              {prepBusy ? 'Собираю…' : prepApplied ? '🔄 Пересобрать и применить' : '🏁 Собрать contest prep и применить'}
            </button>
            <button style={BTN_GHOST} onClick={() => assembleContestPrep(false)} disabled={prepBusy || !builtPlan}>💾 Только сохранить настройки</button>
            <button style={BTN_GHOST} onClick={() => setStep('adjust')}>Пропустить →</button>
          </div>
          {!builtPlan && <div style={{ fontSize:11, color:'#ef4444', marginTop:6 }}>Сначала соберите план тренировок (шаги 1-4).</div>}
        </div>

        {/* Результат — wizard 5 Preview */}
        {prepPlan && (
          <div style={{ display: contestWizard===5 ? 'block' : 'none', marginTop:10, padding:12, borderRadius:12, background:'rgba(236,72,153,0.05)', border:'1px solid rgba(236,72,153,0.2)' }}>
            <div style={{ fontSize:13, fontWeight:800, color:'#ec4899', marginBottom:4 }}>
              🏁 Contest prep · шоу {prepPlan.showDate} · {CONTEST_CATEGORY_LABELS[prepPlan.category]}
            </div>
            <div style={{ fontSize:10, color:'#fff', marginBottom:8 }}>
              {prepPlan.preparation.weeks} нед подготовки (финал {prepPlan.preparation.finalWeeks}) · taper {prepPlan.taper.weeks} нед · пик-неделя 7 дн · темп {prepPlan.preparation.targetRatePctPerWeek}%/нед · {prepPlan.preparation.currentCalories} ккал · {prepPlan.preparation.stepsPerDay} шагов
            </div>
            <div style={{ fontSize:10, color:'#fff', marginBottom:8 }}>
              {peds.length > 0 ? '💉 курс: объём ×1.0 (восстановление выше)' : '🌱 natural'} · стаж {expYearsForPrep} г ({prepPlan.safety.requiresReview ? '' : ''}{' '}
              {(() => { const e = buildContestPrepConfig().experienceLevel; return e === 'advanced' ? 'продвинутый' : e === 'beginner' ? 'новичок' : 'средний'; })()}
              ) · режим подготовки: объём {Math.round((prepPlan.preparation.volumeMult ?? 1) * 100)}%
            </div>
            {phaseNow && (
              <div style={{ fontSize:11, fontWeight:700, color:PREP_PHASE_COLORS[phaseNow.key], marginBottom:4 }}>
                📍 Сейчас: {PREP_PHASE_LABELS[phaseNow.key]} ({phaseNow.dateStart} — {phaseNow.dateEnd})
              </div>
            )}
            {(() => {
              const totalWeeks = prepPlan.phases.reduce((m, p) => Math.max(m, p.weekEnd), 0);
              const passedWeeks = Math.max(0, Math.min(totalWeeks, (() => {
                const now = isoToday();
                const p = prepPhaseForDate(prepPlan, now);
                if (!p) return now > prepPlan.showDate ? totalWeeks : 0;
                return p.weekStart;
              })()));
              const pct = totalWeeks > 0 ? Math.round((passedWeeks / totalWeeks) * 100) : 0;
              return (
                <div style={{ marginBottom:8 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'#fff', marginBottom:2 }}>
                    <span>Прогресс подготовки</span>
                    <span>неделя {passedWeeks} из {totalWeeks} ({pct}%)</span>
                  </div>
                  <div style={{ height:5, borderRadius:3, background:'rgba(255,255,255,0.08)', overflow:'hidden' }}>
                    <div style={{ width:`${pct}%`, height:'100%', borderRadius:3, background:'linear-gradient(90deg,#3b82f6,#ec4899)' }} />
                  </div>
                </div>
              );
            })()}

            {/* Фазы календарём */}
            <div style={{ overflowX:'auto', marginBottom:10 }}>
              <table style={{ width:'100%', fontSize:10, borderCollapse:'collapse', minWidth:520 }}>
                <thead>
                  <tr style={{ color:'#fff', textAlign:'left' }}>
                    <th style={{ padding:'4px 6px' }}>Фаза</th>
                    <th style={{ padding:'4px 6px' }}>Недели</th>
                    <th style={{ padding:'4px 6px' }}>Даты</th>
                    <th style={{ padding:'4px 6px' }}>Задача</th>
                  </tr>
                </thead>
                <tbody>
                  {prepPlan.phases.map(p => (
                    <tr key={p.key} style={{ borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding:'4px 6px', fontWeight:700, color:PREP_PHASE_COLORS[p.key] }}>
                        {p.weekStart === p.weekEnd && p.key === 'show_day' ? '🎬' : ''} {p.label}
                      </td>
                      <td style={{ padding:'4px 6px' }}>
                        {p.key === 'show_day' ? 'день шоу' : p.key === 'post_show' ? 'после шоу' : `${p.weekStart}–${p.weekEnd}`}
                      </td>
                      <td style={{ padding:'4px 6px', color:'#fff' }}>{p.dateStart} — {p.dateEnd}</td>
                      <td style={{ padding:'4px 6px', color:'#fff' }}>{p.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 🗺 Гент-диаграмма фаз по неделям */}
            {(() => {
              const maxWeek = prepPlan.phases.reduce((m, p) => Math.max(m, p.weekEnd), 0);
              const cells: { color: string; label: string; week: number }[] = [];
              for (let wk = 1; wk <= maxWeek; wk++) {
                const p = prepPlan.phases.find(q => q.key !== 'show_day' && wk >= q.weekStart && wk <= q.weekEnd);
                cells.push({ color: p?.color ?? 'rgba(255,255,255,0.06)', label: p?.label ?? '', week: wk });
              }
              const todayWeek = (() => {
                const now = isoToday();
                const p = prepPhaseForDate(prepPlan, now);
                return p && p.weekStart >= 1 && p.weekStart <= maxWeek ? p.weekStart : null;
              })();
              return (
                <div style={{ marginBottom:10 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#fff', marginBottom:4 }}>🗺 Фазы по неделям {todayWeek ? `· 📍 сейчас: неделя ${todayWeek}` : ''}</div>
                  <div style={{ display:'flex', gap:2, overflowX:'auto', paddingBottom:4 }}>
                    {cells.map((c, i) => (
                      <div key={i} style={{ flex:'0 0 auto', width:22, textAlign:'center' }} title={`Нед ${c.week}: ${c.label}`}>
                        <div style={{ height:34, borderRadius:4, background:c.color, border: c.week === todayWeek ? '2px solid #fff' : '1px solid rgba(255,255,255,0.08)' }} />
                        <div style={{ fontSize:8, color:'#fff', marginTop:2 }}>{c.week}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:4 }}>
                    {prepPlan.phases.filter(p => p.key !== 'show_day').map(p => (
                      <span key={p.key} style={{ fontSize:9, color:'#fff', display:'flex', alignItems:'center', gap:4 }}>
                        <span style={{ width:8, height:8, borderRadius:2, background:PREP_PHASE_COLORS[p.key], display:'inline-block' }} />
                        {PREP_PHASE_LABELS[p.key]}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Taper-кривая */}
            <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b', marginBottom:4 }}>📉 Кривая taper (объём ↓, интенсивность сохраняется, RIR 2–4)</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
              {prepPlan.taper.volumeProfile.map((v, i) => (
                <div key={i} style={{ padding:'6px 10px', borderRadius:8, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)', fontSize:10 }}>
                  <div style={{ color:'#fff' }}>Нед {prepPlan.taper.weeks - i}</div>
                  <div style={{ color:'#fbbf24', fontWeight:700 }}>объём {Math.round(v * 100)}%</div>
                  <div style={{ color:'#60a5fa' }}>вес {Math.round(prepPlan.taper.intensityProfile[i] * 100)}%</div>
                  <div style={{ color:'#4ade80' }}>RIR {prepPlan.taper.rirProfile[i]?.[0]}–{prepPlan.taper.rirProfile[i]?.[1]}</div>
                </div>
              ))}
            </div>

            {/* 📉 Недели taper — тренировочный цикл, наложенный на план */}
            {prepApplied && builtPlan && (() => {
              const taperWeeksList = builtPlan.weeks
                .filter((w: any) => w.contestPhase === 'taper' || w.contestPhase === 'peak_week')
                .map((w: any, wi: number) => {
                  const totalSets = w.sessions.reduce((a: number, s: any) => a + s.exercises.reduce((b: number, e: any) => b + (e.sets || 0), 0), 0);
                  const rirMin = Math.min(...w.sessions.flatMap((s: any) => s.exercises.map((e: any) => e.rir ?? 3)));
                  const firstEx = w.sessions[0]?.exercises?.[0];
                  return { w, wi, totalSets, rirMin, firstEx };
                });
              if (taperWeeksList.length === 0) return null;
              return (
                <div style={{ marginBottom:10 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#f472b6', marginBottom:4 }}>📉 Недели taper (тренировочный цикл в плане)</div>
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', fontSize:10, borderCollapse:'collapse', minWidth:460 }}>
                      <thead>
                        <tr style={{ color:'#fff', textAlign:'left' }}>
                          <th style={{ padding:'4px 6px' }}>Нед</th>
                          <th style={{ padding:'4px 6px' }}>Фаза</th>
                          <th style={{ padding:'4px 6px', textAlign:'right' }}>Сетов</th>
                          <th style={{ padding:'4px 6px', textAlign:'right' }}>RIR</th>
                          <th style={{ padding:'4px 6px' }}>Нагрузка</th>
                        </tr>
                      </thead>
                      <tbody>
                        {taperWeeksList.map(({ w, wi, totalSets, rirMin, firstEx }) => (
                          <tr key={wi} style={{ borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding:'4px 6px', fontWeight:700 }}>{(w as any).week}</td>
                            <td style={{ padding:'4px 6px', color: PREP_PHASE_COLORS[(w as any).contestPhase as PrepPhaseKey] ?? '#f472b6', fontWeight:700 }}>
                              {(w as any).contestPhase === 'peak_week' ? '🎭 Пик-неделя' : 'Тапер'}
                            </td>
                            <td style={{ padding:'4px 6px', textAlign:'right' }}>{totalSets}</td>
                            <td style={{ padding:'4px 6px', textAlign:'right' }}>{rirMin}–4</td>
                            <td style={{ padding:'4px 6px', color:'#fff' }}>
                              {firstEx ? `${firstEx.name}${firstEx.workSets?.[0]?.weight ? ` · ${firstEx.workSets[0].weight} кг` : ''}` : 'памп/отдых'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ fontSize:9, color:'#fff', marginTop:3 }}>
                    Объём снижается, веса сохраняются, RIR 2–4, без отказа и новых упражнений. Изменения настроек ниже пересобирают эти недели.
                  </div>
                  {/* PRO-2 P4: тапер≠делод + last-hard по группам */}
                  <div style={{ fontSize:9, color:'#fff', marginTop:4, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.15)', borderRadius:6, padding:6 }}>
                    {TAPER_VS_DELOAD_NOTE}
                  </div>
                  <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:4 }}>
                    {([['legs','Ноги'],['back','Спина'],['chest','Грудь+дельты'],['biceps','Руки']] as const).map(([key, ru]) => (
                      <span key={key} style={{ fontSize:9, color:'#fff', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:999, padding:'3px 8px' }}>
                        {ru}: <b>{lastHardDayForMuscle(key).slice(0, 4)}</b>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* 🏋️ Недели подготовки (режим подготовки) */}
            {prepApplied && builtPlan && (() => {
              const prepWeeksList = builtPlan.weeks
                .filter((w: any) => w.contestPhase === 'preparation' || w.contestPhase === 'final_preparation')
                .map((w: any) => {
                  const totalSets = w.sessions.reduce((a: number, s: any) => a + s.exercises.reduce((b: number, e: any) => b + (e.sets || 0), 0), 0);
                  const rir = Math.min(...w.sessions.flatMap((s: any) => s.exercises.map((e: any) => e.rir ?? 3)));
                  return { w, totalSets, rir };
                });
              if (prepWeeksList.length === 0) return null;
              const shown = prepWeeksList.slice(0, 4);
              const rest = prepWeeksList.length - shown.length;
              return (
                <div style={{ marginBottom:10 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#60a5fa', marginBottom:4 }}>🏋️ Недели подготовки (режим подготовки)</div>
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', fontSize:10, borderCollapse:'collapse', minWidth:420 }}>
                      <thead>
                        <tr style={{ color:'#fff', textAlign:'left' }}>
                          <th style={{ padding:'4px 6px' }}>Нед</th>
                          <th style={{ padding:'4px 6px' }}>Фаза</th>
                          <th style={{ padding:'4px 6px', textAlign:'right' }}>Сетов</th>
                          <th style={{ padding:'4px 6px', textAlign:'right' }}>RIR</th>
                          <th style={{ padding:'4px 6px' }}>Режим</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shown.map(({ w, totalSets, rir }) => (
                          <tr key={(w as any).week} style={{ borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding:'4px 6px', fontWeight:700 }}>{(w as any).week}</td>
                            <td style={{ padding:'4px 6px', color: PREP_PHASE_COLORS[(w as any).contestPhase as PrepPhaseKey] ?? '#60a5fa', fontWeight:700 }}>
                              {(w as any).contestPhase === 'final_preparation' ? 'Финальная' : 'Подготовка'}
                            </td>
                            <td style={{ padding:'4px 6px', textAlign:'right' }}>{totalSets}</td>
                            <td style={{ padding:'4px 6px', textAlign:'right' }}>{rir}</td>
                            <td style={{ padding:'4px 6px', color:'#fff', fontSize:9 }}>
                              {String((w as any).prepProtocol || '').startsWith('Подготовка') ? 'RIR 1–3, без отказа' : String((w as any).prepProtocol || '').startsWith('Финальная') ? '×0.9, RIR 2–3' : 'как в плане'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ fontSize:9, color:'#fff', marginTop:3 }}>
                    {rest > 0 ? `и ещё ${rest} недель подготовки с тем же режимом. ` : ''}
                    Объём подготовки не переделывает цикл: меняются только RIR/техники (+объём при выборе ×0.85), веса сохраняются.
                  </div>
                  {/* PRO-2 P7: diet-break длинного препа */}
                  {prepPlan.preparation.weeks >= 16 && (() => {
                    const breaks = prepDietBreaks(prepPlan);
                    if (breaks.length === 0) return null;
                    const start = prepPlan.preparation.startDate;
                    const nums = Array.from(new Set(breaks.map(d => {
                      const [y, m, dd] = d.split('-').map(Number);
                      const [sy, sm, sd] = start.split('-').map(Number);
                      return Math.floor((new Date(y, m - 1, dd).getTime() - new Date(sy, sm - 1, sd).getTime()) / 604800000) + 1;
                    }))).sort((a, b) => a - b);
                    return (
                      <div style={{ fontSize:9, color:'#fff', marginTop:4, background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.15)', borderRadius:6, padding:6 }}>
                        🏖 Diet break: нед {nums.join(', ')} — на поддержании дня (гормоны/психика). Цели рациона переключатся автоматически.
                      </div>
                    );
                  })()}
                </div>
              );
            })()}

            {/* 📈 Выполнение подготовки (план vs факт по дневнику) */}
            {prepApplied && builtPlan && (() => {
              try {
                const compliance = prepTrainingCompliance(
                  prepPlan,
                  builtPlan.weeks.map((w: any) => ({
                    week: (w as any).week,
                    contestPhase: (w as any).contestPhase,
                    plannedSets: w.sessions.reduce((a: number, s: any) => a + s.exercises.reduce((b: number, e: any) => b + (e.sets || 0), 0), 0),
                  })),
                  loadSessions().map(s => ({ date: s.date, totalSets: s.totalSets })),
                );
                const shown = compliance.weeks.slice(0, 8);
                const statusColor: Record<string, string> = { done: '#4ade80', partial: '#fbbf24', missed: '#f87171', upcoming: '#fff' };
                const statusLabel: Record<string, string> = { done: '✓', partial: '◐', missed: '✗', upcoming: '…' };
                return (
                  <div style={{ marginBottom:10 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#4ade80', marginBottom:4 }}>
                      📈 Выполнение подготовки · {Math.round(compliance.overallPct * 100)}% от плана · завершено недель: {compliance.completedWeeks}/{compliance.elapsedWeeks}
                    </div>
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%', fontSize:10, borderCollapse:'collapse', minWidth:460 }}>
                        <thead>
                          <tr style={{ color:'#fff', textAlign:'left' }}>
                            <th style={{ padding:'4px 6px' }}>Нед</th>
                            <th style={{ padding:'4px 6px' }}>Фаза</th>
                            <th style={{ padding:'4px 6px', textAlign:'right' }}>План</th>
                            <th style={{ padding:'4px 6px', textAlign:'right' }}>Факт</th>
                            <th style={{ padding:'4px 6px', textAlign:'right' }}>%</th>
                            <th style={{ padding:'4px 6px' }}>Статус</th>
                          </tr>
                        </thead>
                        <tbody>
                          {shown.map(c => (
                            <tr key={c.week} style={{ borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                              <td style={{ padding:'4px 6px', fontWeight:700 }}>{c.week}</td>
                              <td style={{ padding:'4px 6px', color: PREP_PHASE_COLORS[c.phase ?? 'preparation'] ?? '#fff' }}>
                                {c.phase === 'preparation' ? 'Подготовка' : c.phase === 'final_preparation' ? 'Финальная' : c.phase === 'taper' ? 'Тапер' : 'Пик'}
                              </td>
                              <td style={{ padding:'4px 6px', textAlign:'right' }}>{c.plannedSets}</td>
                              <td style={{ padding:'4px 6px', textAlign:'right' }}>{c.actualSets}</td>
                              <td style={{ padding:'4px 6px', textAlign:'right' }}>{Math.round(c.pct * 100)}%</td>
                              <td style={{ padding:'4px 6px', color: statusColor[c.status] ?? '#fff', fontWeight:700 }}>{statusLabel[c.status] ?? c.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ fontSize:9, color:'#fff', marginTop:3 }}>{compliance.recommendation}</div>
                  </div>
                );
                } catch { return null; }
              })()}

            {/* 📊 Недели подготовки — недельный луп чек-инов (Э4) */}
            {prepPlan && weekRefs.length > 0 && (
              <div style={{ marginBottom:10, padding:10, borderRadius:10, background:'rgba(59,130,246,0.06)', border:'1px solid rgba(59,130,246,0.18)' }}>
                <div style={{ fontSize:11, fontWeight:800, color:'#60a5fa', marginBottom:6 }}>
                  📊 Недели подготовки · чек-ины {weeklyLog.length}/{weekRefs.length}
                </div>
                {strengthDowns.length > 0 && (
                  <div style={{ fontSize:10, color:'#fbbf24', marginBottom:6 }}>
                    {strengthDowns.map(s => `📉 ${s.exercise}: e1RM ${s.before} → ${s.after} кг (${s.deltaPct}%)`).join(' · ')}
                    <div style={{ color:'#fff' }}>Сила падает на дефиците — не заглубляйте дефицит и не добавляйте кардио; проверьте сон/белок.</div>
                  </div>
                )}
                {(() => {
                  const last = weeklyLog[weeklyLog.length - 1];
                  const prev = weeklyLog[weeklyLog.length - 2];
                  const stuck = last && prev && last.advice !== 'on_track' && last.advice !== 'no_data' && last.advice === prev.advice
                    && (last.advice === 'too_fast' || last.advice === 'too_slow');
                  return stuck ? (
                    <div style={{ fontSize:10, color:'#fbbf24', marginBottom:6 }}>
                      ⚠ {last.advice === 'too_fast' ? 'Темп выше цели 2 недели подряд' : 'Темп ниже цели 2 недели подряд'} — примените одну переменную в блоке «⚖️ Адаптация по весу» ниже.
                    </div>
                  ) : null;
                })()}
                <div style={{ overflowX:'auto', marginBottom:8 }}>
                  <table style={{ width:'100%', fontSize:9, borderCollapse:'collapse', minWidth:520 }}>
                    <thead>
                      <tr style={{ color:'#fff', textAlign:'left' }}>
                        <th style={{ padding:'3px 5px' }}>Нед</th>
                        <th style={{ padding:'3px 5px' }}>Даты</th>
                        <th style={{ padding:'3px 5px' }}>Фаза</th>
                        <th style={{ padding:'3px 5px', textAlign:'right' }}>Вес ср</th>
                        <th style={{ padding:'3px 5px', textAlign:'right' }}>Δ</th>
                        <th style={{ padding:'3px 5px', textAlign:'right' }}>Сон</th>
                        <th style={{ padding:'3px 5px', textAlign:'right' }}>Сесс</th>
                        <th style={{ padding:'3px 5px', textAlign:'right' }}>Пси</th>
                        <th style={{ padding:'3px 5px' }}>Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weekRefs.map(r => {
                        const c = weeklyLog.find(x => x.week === r.week);
                        const prevC = weeklyLog.find(x => x.week === r.week - 1);
                        const delta = c?.weightAvg != null && prevC?.weightAvg != null
                          ? Math.round((c.weightAvg - prevC.weightAvg) * 10) / 10 : null;
                        const isCur = r.week === currentPrepWeek;
                        return (
                          <tr key={r.week} style={{ borderTop:'1px solid rgba(255,255,255,0.05)', background: isCur ? 'rgba(59,130,246,0.08)' : undefined }}>
                            <td style={{ padding:'3px 5px', fontWeight:800 }}>{r.week}{isCur ? ' ●' : ''}</td>
                            <td style={{ padding:'3px 5px', color:'#fff' }}>{r.dateStart.slice(5).replace('-','.')}–{r.dateEnd.slice(5).replace('-','.')}</td>
                            <td style={{ padding:'3px 5px', color:'#fff' }}>{r.phaseLabel}</td>
                            <td style={{ padding:'3px 5px', textAlign:'right' }}>{c?.weightAvg ?? '—'}</td>
                            <td style={{ padding:'3px 5px', textAlign:'right', color: delta != null && delta > 0 ? '#fbbf24' : '#fff' }}>{delta != null ? (delta > 0 ? `+${delta}` : `${delta}`) : '—'}</td>
                            <td style={{ padding:'3px 5px', textAlign:'right' }}>{c?.sleepAvg ?? '—'}</td>
                            <td style={{ padding:'3px 5px', textAlign:'right' }}>{c?.sessionsDone ?? '—'}</td>
                            <td style={{ padding:'3px 5px', textAlign:'right' }}>{c?.psyche ?? '—'}</td>
                            <td style={{ padding:'3px 5px', color:'#fff' }}>{c?.advice && c.advice !== 'no_data' ? c.advice : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', marginBottom:6 }}>
                  <span style={{ fontSize:10, color:'#fff' }}>Нед:</span>
                  <input type="number" min={1} max={weekRefs.length} value={wkWeek ?? currentPrepWeek} onChange={e => setWkWeek(Math.min(weekRefs.length, Math.max(1, parseInt(e.target.value) || currentPrepWeek)))} style={{ width:56, ...IN }} />
                  <input type="number" step={0.1} placeholder="Вес ср, кг" value={wkWeight} onChange={e => setWkWeight(e.target.value)} style={{ width:86, ...IN }} />
                  <input type="number" step={0.5} placeholder="Талия, см" value={wkWaist} onChange={e => setWkWaist(e.target.value)} style={{ width:86, ...IN }} />
                  <input type="number" step={0.5} placeholder="Сон, ч" value={wkSleep} onChange={e => setWkSleep(e.target.value)} style={{ width:70, ...IN }} />
                  <input type="number" step={1} placeholder="Сессии" value={wkSessions} onChange={e => setWkSessions(e.target.value)} style={{ width:70, ...IN }} />
                  <input type="number" step={1} min={1} max={5} placeholder="Пси 1-5" value={wkPsyche} onChange={e => setWkPsyche(e.target.value)} style={{ width:70, ...IN }} />
                  <input placeholder="Заметка" value={wkNote} onChange={e => setWkNote(e.target.value)} style={{ flex:'1 1 120px', ...IN }} />
                  <button style={BTN_GHOST} onClick={handleSaveWeekCheckin}>💾 Чек-ин</button>
                </div>
                {!prepPlan.testPeakWeekId && (
                  <div style={{ fontSize:10, color:'#fff' }}>🧪 Trial peak ещё не сделан — прогоните репетицию за 21–28 дней до шоу (блок ниже), стратегия пика станет точнее.</div>
                )}
              </div>
            )}

            {/* 🧪 Test Peak Week — wizard 4 */}
            <div style={{ display: contestWizard===4 ? 'block' : 'none', marginBottom:10, padding:10, borderRadius:10, background:'rgba(168,85,247,0.05)', border:'1px solid rgba(168,85,247,0.18)' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#a855f7', marginBottom:6 }}>🧪 Test Peak Week (не меняет основной план)</div>
              <div style={{ fontSize:10, color:'#fff', marginBottom:8 }}>
                Прогоните протокол за 3–4 недели до шоу и зафиксируйте реакцию — результат сохраняется ({'testPeakWeekId'}) и влияет на стратегию основной пик-недели.
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                {([
                  ['carbTolerance', 'Переносимость углеводов'],
                  ['digestion', 'Пищеварение'],
                  ['fullness', 'Наполненность'],
                  ['waterRetention', 'Вода ушла (5 = ушла)'],
                  ['pump', 'Пампинг'],
                  ['sleep', 'Сон'],
                ] as const).map(([key, label]) => (
                  <div key={key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6, fontSize:10 }}>
                    <span style={{ color:'#fff' }}>{label}</span>
                    <div style={{ display:'flex', gap:3 }}>
                      {[1, 2, 3, 4, 5].map(v => (
                        <button
                          key={v}
                          onClick={() => setTestRatings(r => ({ ...r, [key]: v }))}
                          style={{
                            width: 22, height: 22, borderRadius: 6, fontSize: 9, cursor: 'pointer', color: '#fff',
                            border: '1px solid rgba(168,85,247,0.3)',
                            background: (testRatings[key] ?? 3) === v ? 'rgba(168,85,247,0.5)' : 'rgba(255,255,255,0.03)',
                          }}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:8, flexWrap:'wrap' }}>
                <span style={{ fontSize:10, color:'#fff' }}>Δ веса за неделю, кг:</span>
                <input type="number" step={0.1} value={testWeightDelta} onChange={e => setTestWeightDelta(parseFloat(e.target.value) || 0)} style={{ width:70, ...IN }} />
                <button style={{ ...BTN_GHOST, borderColor:'#a855f7', color:'#a855f7' }} onClick={handleRunTestPeakWeek}>💾 Сохранить тест</button>
              </div>
              {lastTest && (
                <div style={{ marginTop:8, fontSize:10, color:'#fff' }}>
                  <div style={{ fontWeight:700, color: lastTest.verdict === 'tested_ok' ? '#4ade80' : lastTest.verdict === 'adjust' ? '#ef4444' : '#fbbf24' }}>
                    {lastTest.verdict === 'tested_ok' ? '✅ Протокол подходит (strategy: tested)' : lastTest.verdict === 'adjust' ? '⚠ Нужна коррекция' : '🔶 Консервативный режим'}
                  </div>
                  <div style={{ color:'#fff', marginTop:2 }}>{lastTest.recommendation}</div>
                  <div style={{ color:'#a78bfa', marginTop:4 }}>PRO рекомендация загрузки: <b>{recommendCarbStrategyFromTrial(lastTest)}</b> (spill→back, flat→front, волна→undulating)</div>
                  {/* PRO-2 P2: персональная доза загрузки из trial (Homer 2024: 3–12 г/кг, титрация по trial) */}
                  <div style={{ color:'#4ade80', marginTop:2 }}>
                    Доза trial: <b>{trialCarbDoseGPerKg(lastTest, prepPlan.category, prepPlan.sex)} г/кг</b> total за 36–48 ч
                    (коридор {CATEGORY_PROFILES[prepPlan.category]?.carbTotalBudgetGPerKg?.join('–') ?? ''} г/кг) — применится к финальной пик-неделе через «Пересобрать и применить».
                  </div>
                  <div style={{ color:'#38bdf8', marginTop:2 }}>Live-adjust D-1: {liveAdjustForPeakDay(lastTest.responses.fullness, 6 - lastTest.responses.waterRetention, lastTest.responses.waterRetention).note}</div>
                  {prepPlan.testPeakWeekId && (
                    <div style={{ color:'#fff', marginTop:4 }}>
                      Стратегия основной пик-недели: <b>{resolvePeakStrategy(prepPlan)}</b>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Безопасность */}
            {prepPlan.safety.warnings.length > 0 && (
              <div style={{ marginBottom:10 }}>
                {prepPlan.safety.warnings.map((w, i) => (
                  <div key={i} style={{ fontSize:10, color: w.startsWith('⛔') ? '#ef4444' : '#f87171', marginTop:2 }}>{w}</div>
                ))}
              </div>
            )}
            {prepPlan.safety.requiresReview && (
              <div style={{ fontSize:11, fontWeight:700, color:'#ef4444', marginBottom:6 }}>
                🩺 Требуется профессиональное сопровождение (противопоказания: {prepPlan.safety.contraindications.join(', ')}). Агрессивные режимы отключены.
              </div>
            )}

            {/* 📋 Чек-лист шоу D-10…D-0 + live-adjust (Э5) */}
            {(() => {
              const items = buildShowChecklist(prepPlan.showDate);
              const done = items.filter(i => showCheck[`${prepPlan.showDate}_${i.id}`]).length;
              const live = liveAdjustForPeakDay(liveFull, 6 - liveWater, liveWater);
              return (
                <div style={{ marginBottom:10, padding:10, borderRadius:10, background:'rgba(251,191,36,0.06)', border:'1px solid rgba(251,191,36,0.22)' }}>
                  <div style={{ fontSize:11, fontWeight:800, color:'#fbbf24', marginBottom:6 }}>
                    📋 Чек-лист шоу · {done}/{items.length}
                  </div>
                  {items.map(item => {
                    const key = `${prepPlan.showDate}_${item.id}`;
                    const checked = !!showCheck[key];
                    return (
                      <div key={item.id} style={{ padding:'2px 0' }}>
                        <BbToggleChip
                          checked={checked}
                          ariaLabel={item.label}
                          onChange={() => {
                            try { setShowCheck(toggleShowChecklistItem(prepPlan.showDate, item.id)); } catch { /* ignore */ }
                          }}
                          label={(
                            <span style={{ textDecoration: checked ? 'line-through' : 'none' }}>
                              <b style={{ color:'#fbbf24' }}>{item.dayOffset === 0 ? 'D-0' : `D-${item.dayOffset}`}</b>
                              {' · '}{item.date.slice(5).replace('-','.')} · {item.label}
                              {item.detail && <span style={{ color:'#fff' }}> — {item.detail}</span>}
                            </span>
                          )}
                        />
                      </div>
                    );
                  })}
                  <div style={{ marginTop:8, paddingTop:8, borderTop:'1px solid rgba(251,191,36,0.2)' }}>
                    <div style={{ fontSize:10, fontWeight:800, color:'#fbbf24', marginBottom:4 }}>🎯 Live-adjust (утро D-3…D-1 реальной пик-недели)</div>
                    <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center', fontSize:10, color:'#fff' }}>
                      <span>Наполненность (1=плоско):</span>
                      <span style={{ display:'flex', gap:3 }}>
                        {[1,2,3,4,5].map(v => (
                          <button key={v} onClick={() => setLiveFull(v)} style={{ width:24, height:24, borderRadius:6, fontSize:10, cursor:'pointer', color:'#fff', border:'1px solid rgba(251,191,36,0.35)', background: liveFull === v ? 'rgba(251,191,36,0.45)' : 'rgba(255,255,255,0.03)' }}>{v}</button>
                        ))}
                      </span>
                      <span>Вода ушла (5=ушла):</span>
                      <span style={{ display:'flex', gap:3 }}>
                        {[1,2,3,4,5].map(v => (
                          <button key={v} onClick={() => setLiveWater(v)} style={{ width:24, height:24, borderRadius:6, fontSize:10, cursor:'pointer', color:'#fff', border:'1px solid rgba(251,191,36,0.35)', background: liveWater === v ? 'rgba(251,191,36,0.45)' : 'rgba(255,255,255,0.03)' }}>{v}</button>
                        ))}
                      </span>
                    </div>
                    <div style={{ fontSize:10, color: live.status === 'on_track' ? '#4ade80' : '#fbbf24', marginTop:4 }}>
                      {live.status === 'flat' ? '📉 ' : live.status === 'spill' ? '💧 ' : '✅ '}{live.note}
                    </div>
                    {/* PRO-2 P2-доводка: пересчёт оставшихся load-дней по визуалу */}
                    <div style={{ marginTop:6, paddingTop:6, borderTop:'1px solid rgba(251,191,36,0.2)' }}>
                      <div style={{ fontSize:10, fontWeight:800, color:'#fbbf24', marginBottom:4 }}>🔄 Пересчёт load-дней по визуалу (остаток пик-недели)</div>
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', fontSize:10, color:'#fff' }}>
                        {([['flat', '📉 Плоско'], ['full', '✅ Норма'], ['spill', '💧 Залило']] as const).map(([v, label]) => (
                          <button key={v} onClick={() => { setLiveVisual(v); setRecarb(null); }} aria-pressed={liveVisual === v} style={{ minHeight:44, padding:'6px 10px', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer', color: liveVisual === v ? '#fbbf24' : '#fff', border:'1px solid rgba(251,191,36,0.35)', background: liveVisual === v ? 'rgba(251,191,36,0.25)' : 'rgba(255,255,255,0.03)' }}>{label}</button>
                        ))}
                        <button
                          onClick={() => {
                            try {
                              const base = buildPeakWeek(configFromPlan(prepPlan), prepPlan.peakWeek.carbDoseGPerKg != null ? { carbDoseGPerKg: prepPlan.peakWeek.carbDoseGPerKg } : undefined);
                              const loads = base.filter(d => d.phase.startsWith('load'));
                              const adj = recarbLoadFromVisual(loads, liveVisual);
                              setRecarb(adj.map(d => ({ day: d.day, phase: d.phaseLabel, carbsG: d.carbsG, kcal: d.kcal })));
                              try { localStorage.setItem(`he_peak_recarb_${prepPlan.showDate}`, JSON.stringify({ visual: liveVisual, at: new Date().toISOString(), days: adj.map(d => ({ day: d.day, carbsG: d.carbsG, kcal: d.kcal })) })); } catch { /* ignore */ }
                              flash(`🔄 Load-дни пересчитаны (${liveVisual === 'flat' ? '+75г' : liveVisual === 'spill' ? '−100г' : 'без изменений'} на остаток)`);
                            } catch { flash('Не удалось пересчитать load-дни'); }
                          }}
                          style={{ minHeight:44, padding:'6px 12px', borderRadius:8, fontSize:11, fontWeight:800, cursor:'pointer', color:'#fff', border:'1px solid #fbbf24', background:'rgba(251,191,36,0.2)' }}
                        >
                          🔄 Пересчитать load-дни
                        </button>
                      </div>
                      {recarb && recarb.length > 0 && (
                        <div style={{ fontSize:10, color:'#fff', marginTop:6 }}>
                          {recarb.map(r => (
                            <div key={r.day}>Д{r.day} ({r.phase}): <b>{r.carbsG}г</b> · {r.kcal} ккал</div>
                          ))}
                          <div style={{ fontSize:9, color:'#fff', marginTop:2 }}>Цифры для приёмов пищи (persist — переживает перезапуск). Дневник/рацион не переписываются.</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 🩺 Мед-процесс подготовки (Э6): лаба к шоу + процедуры doctorOnly + гидратация */}
            <CollapsibleCard title="🩺 Мед-процесс подготовки · анализы и мониторинг" badge="не назначения">
              <div style={{ fontSize:10, color:'#fbbf24', marginBottom:6 }}>
                ⚠ Медицинский чек-лист и мониторинг, НЕ назначения. Процедуры/анализы — только под контролем врача.
              </div>
              <div style={{ fontSize:11, fontWeight:800, color:'#fff', margin:'6px 0 4px' }}>🧪 Панель анализов к шоу</div>
              {PREP_LAB_PANEL.map(item => {
                const contra = prepPlan.safety.contraindications.join(' ').toLowerCase();
                const hot = (contra.includes('kidney') && /почк|eGFR|ОАМ/i.test(item.name))
                  || ((contra.includes('heart') || contra.includes('hypertension') || contra.includes('hyper')) && /кардио|ЭКГ|АД/i.test(item.name + item.why))
                  || /электролит|гипонатрием/i.test(item.name + item.why);
                return (
                  <div key={item.name} style={{ fontSize:10, color:'#fff', padding:'4px 6px', marginBottom:3, borderRadius:6, background: hot ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)', border: hot ? '1px solid rgba(239,68,68,0.35)' : '1px solid rgba(255,255,255,0.06)' }}>
                    <b>{item.name}</b> <span style={{ color:'#fff' }}>· {item.when}</span>
                    <div style={{ color:'#fff' }}>{item.why}</div>
                  </div>
                );
              })}
              <div style={{ fontSize:11, fontWeight:800, color:'#fff', margin:'8px 0 4px' }}>👨‍⚕️ Процедуры — только по назначению врача</div>
              {PREP_PROCEDURES.map(p => (
                <div key={p.id} style={{ fontSize:10, color:'#fff', padding:'4px 6px', marginBottom:3, borderRadius:6, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
                  <b>{p.name}</b> <span style={{ fontSize:8, fontWeight:800, color:'#fbbf24', border:'1px solid rgba(251,191,36,0.4)', borderRadius:999, padding:'0 6px' }}>👨‍⚕️ doctorOnly</span>
                  <div>{p.indication}</div>
                  <div style={{ color:'#f87171' }}>{p.warning}</div>
                </div>
              ))}
              <div style={{ fontSize:11, fontWeight:800, color:'#fff', margin:'8px 0 4px' }}>💧 Гидратация</div>
              {PREP_HYDRATION_GUIDELINES.map((g, i) => (
                <div key={i} style={{ fontSize:10, color:'#fff', marginBottom:2 }}>• {g}</div>
              ))}
            </CollapsibleCard>

            {/* Дневные цели питания на сегодня */}
            <div style={{ fontSize:11, fontWeight:700, color:'#22c55e', marginBottom:4 }}>🍽 Питание на сегодня</div>
            {(() => {
              const w = prepPlan.preparation.startingWeightKg;
              const base = {
                kcal: prepPlan.preparation.currentCalories,
                proteinG: Math.round(w * 2.2),
                fatG: Math.max(30, Math.round(w * (prepPlan.sex === 'female' ? 0.8 : 0.6))),
                carbsG: 0,
                waterMl: 3000,
                sodiumMg: 2800,
              };
              const t = nutritionTargetsForPrepDate(today, prepPlan, base);
              return (
                <div style={{ fontSize:11, color:'#fff', background:'rgba(34,197,94,0.06)', padding:10, borderRadius:8, border:'1px solid rgba(34,197,94,0.15)' }}>
                  <div><b>{t.kcal} ккал</b> · Б {t.proteinG} г · У {t.carbsG} г · Ж {t.fatG} г · 💧 {(t.waterMl / 1000).toFixed(1)} л · Na {t.sodiumMg} мг {t.phaseLabel ? `· ${t.phaseLabel}` : ''}</div>
                  {t.note && <div style={{ color:'#fff', marginTop:4 }}>{t.note}</div>}
                  <div style={{ marginTop:4, fontSize:10, color:'#fff' }}>
                    План отделён от факта: цели переносятся в «Планировщик питания» → дневник сохраняет только фактическое питание.
                  </div>
                </div>
              );
            })()}

            {/* ⚖️ Адаптация подготовки по весу */}
            <div style={{ marginTop:10 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#60a5fa', marginBottom:4 }}>⚖️ Адаптация по весу (среднее за 7 дней)</div>
              {weightAdvice && (
                <div style={{ background:'rgba(96,165,250,0.05)', border:'1px solid rgba(96,165,250,0.15)', borderRadius:8, padding:10, fontSize:10 }}>
                  <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'center' }}>
                    <span style={{ color:'#fff' }}>
                      Последний вес: <b style={{ color:'#fff' }}>{weightAdvice.lastWeight ?? '—'} кг</b>
                      {weightAdvice.lastDate ? ` (${weightAdvice.lastDate})` : ''}
                    </span>
                    {weightAdvice.delta7d != null && (
                      <span style={{ color:'#fff' }}>
                        Δ7д: <b style={{ color: weightAdvice.delta7d < 0 ? '#4ade80' : '#fbbf24' }}>{weightAdvice.delta7d > 0 ? '+' : ''}{weightAdvice.delta7d.toFixed(2)} кг</b>
                      </span>
                    )}
                    {weightAdvice.delta14d != null && (
                      <span style={{ color:'#fff' }}>
                        Δ14д: <b style={{ color: weightAdvice.delta14d < 0 ? '#4ade80' : '#fbbf24' }}>{weightAdvice.delta14d > 0 ? '+' : ''}{weightAdvice.delta14d.toFixed(2)} кг</b>
                      </span>
                    )}
                    {weightAdvice.weeklyRatePct != null && (
                      <span style={{ color:'#fff' }}>
                        Темп: <b style={{ color:'#fff' }}>{weightAdvice.weeklyRatePct.toFixed(2)}%/нед</b> (цель {weightAdvice.targetRatePctPerWeek}%/нед)
                      </span>
                    )}
                    <span style={{
                      padding: '2px 8px', borderRadius: 999, fontWeight: 700,
                      background: weightAdvice.status === 'on_track' ? 'rgba(34,197,94,0.15)' : weightAdvice.status === 'no_data' ? 'rgba(255,255,255,0.08)' : weightAdvice.status === 'too_fast' ? 'rgba(239,68,68,0.15)' : weightAdvice.status === 'taper' ? 'rgba(168,85,247,0.15)' : 'rgba(245,158,11,0.15)',
                      color: weightAdvice.status === 'on_track' ? '#4ade80' : weightAdvice.status === 'no_data' ? '#fff' : weightAdvice.status === 'too_fast' ? '#ef4444' : weightAdvice.status === 'taper' ? '#a855f7' : '#fbbf24',
                    }}>
                      {weightAdvice.status === 'on_track' ? '✓ По графику' : weightAdvice.status === 'no_data' ? 'Мало данных' : weightAdvice.status === 'too_fast' ? '⚠ Быстрее цели' : weightAdvice.status === 'taper' ? '🛑 Taper' : '🔶 Плато/медленно'}
                    </span>
                    {weightAdvice.measurements > 0 && <span style={{ color:'#fff' }}>замеров 14д: {weightAdvice.measurements}</span>}
                  </div>
                  {weightAdvice.progressToTargetPct != null && (
                    <div style={{ marginTop:6 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'#fff', marginBottom:2 }}>
                        <span>Прогресс к целевому весу</span>
                        <span>{Math.min(100, Math.max(0, weightAdvice.progressToTargetPct))}%</span>
                      </div>
                      <div style={{ height:5, borderRadius:3, background:'rgba(255,255,255,0.08)', overflow:'hidden' }}>
                        <div style={{ width:`${Math.min(100, Math.max(0, weightAdvice.progressToTargetPct))}%`, height:'100%', borderRadius:3, background:'linear-gradient(90deg,#60a5fa,#00e68a)' }} />
                      </div>
                    </div>
                  )}
                  <div style={{ color:'#fff', marginTop:6, lineHeight:1.45 }}>{weightAdvice.recommendation}</div>
                  {(weightAdvice.adjustCalories !== 0 || weightAdvice.adjustCardioMin !== 0) && (
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:8 }}>
                      {weightAdvice.adjustCalories !== 0 && (
                        <button style={{ ...BTN_GHOST, borderColor:'#60a5fa', color:'#60a5fa' }} onClick={() => handleApplyWeightAdjustment(weightAdvice.adjustCalories, 0)}>
                          {weightAdvice.adjustCalories > 0 ? '➕' : '➖'} Применить калории {weightAdvice.adjustCalories > 0 ? '+' : ''}{weightAdvice.adjustCalories} ккал
                        </button>
                      )}
                      {weightAdvice.adjustCardioMin !== 0 && (
                        <button style={{ ...BTN_GHOST, borderColor:'#34d399', color:'#34d399' }} onClick={() => handleApplyWeightAdjustment(0, weightAdvice.adjustCardioMin)}>
                          {weightAdvice.adjustCardioMin > 0 ? '➕' : '➖'} Кардио {weightAdvice.adjustCardioMin > 0 ? '+' : ''}{weightAdvice.adjustCardioMin} мин/нед
                        </button>
                      )}
                      <span style={{ fontSize:9, color:'#fff', alignSelf:'center' }}>Одна переменная за раз · эффект оценивать через 5–7 дней</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 🎬 Таймлайн Show Day */}
            <div style={{ marginTop:10 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#fbbf24', marginBottom:4 }}>🎬 Таймлайн Show Day</div>
              <div style={{ background:'rgba(251,191,36,0.04)', border:'1px solid rgba(251,191,36,0.12)', borderRadius:8, padding:8 }}>
                {buildShowTimeline(configFromPlan(prepPlan)).map((t, i) => (
                  <div key={i} style={{ display:'grid', gridTemplateColumns:'80px 1fr', gap:8, padding:'4px 0', borderBottom: i < buildShowTimeline(configFromPlan(prepPlan)).length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', fontSize:10 }}>
                    <span style={{ color:'#fbbf24', fontWeight:700 }}>{t.time}</span>
                    <span style={{ color:'#fff' }}><b>{t.action}</b> — {t.detail}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 📋 Контроль готовности (чек-лист дня) */}
            <div style={{ marginTop:10 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#4ade80', marginBottom:4 }}>
                📋 Контроль готовности · {isoToday()} · {prepCheckinDone}/{PREP_CHECKIN_ITEMS.length}
              </div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {PREP_CHECKIN_ITEMS.map((label, i) => {
                  const checked = !!prepCheckin[`${isoToday()}_${i}`];
                  return (
                    <button key={label} onClick={() => togglePrepCheckin(i)} style={{
                      padding: '6px 10px', borderRadius: 999, fontSize: 10, cursor: 'pointer',
                      background: checked ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.03)',
                      border: checked ? '1px solid rgba(34,197,94,0.5)' : '1px solid rgba(255,255,255,0.1)',
                      color: checked ? '#4ade80' : '#fff',
                    }}>
                      {checked ? '✓ ' : ''}{label}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize:9, color:'#fff', marginTop:3 }}>
                Контрольные показатели подготовки (раздел 3.1): вес по среднему 7 дней, сон, выполнение, шаги/кардио, пищеварение, визуальная форма.
              </div>
            </div>

            {/* 🔄 Post-show: восстановление после шоу */}
            <div style={{ marginTop:10 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#22c55e', marginBottom:4 }}>🔄 Post-show (восстановление после шоу)</div>
              {(() => {
                const post = buildPostShowPlan(prepPlan);
                return (
                  <div style={{ background:'rgba(34,197,94,0.04)', border:'1px solid rgba(34,197,94,0.15)', borderRadius:8, padding:10, fontSize:10 }}>
                    <div style={{ color:'#fff', marginBottom:4 }}>
                      <b>{post.kcal} ккал</b> (поддержание) · Б {post.proteinG} г · 💧 {post.waterLiters} л стабильно · {post.durationDays} дней
                    </div>
                    {/* PRO-2 P5: трек восстановления — recovery (дефолт) vs reverse (opt-in) */}
                    <div style={{ display:'flex', gap:6, marginBottom:6 }}>
                      {([
                        ['recovery', '🔄 Recovery — сразу maintenance', 'гликоген/гормоны/сон быстрее, +5–10% веса'],
                        ['reverse', '🐢 Reverse — +100/нед', 'медленнее, только осознанно'],
                      ] as const).map(([track, label, sub]) => {
                        const active = (prepPlan.postShowTrack ?? 'recovery') === track;
                        return (
                          <button
                            key={track}
                            onClick={() => {
                              const next = { ...prepPlan, postShowTrack: track, updatedAt: new Date().toISOString() };
                              setPrepPlan(next);
                              try { savePrepToProfile(next, buildContestPrepConfig()); } catch { /* ignore */ }
                              flash(track === 'recovery' ? '🔄 Recovery-трек: сразу к maintenance' : '🐢 Reverse-трек: медленно +100/нед');
                            }}
                            aria-pressed={active}
                            style={{
                              flex:1, minHeight:56, borderRadius:10, padding:'6px 8px', cursor:'pointer', textAlign:'left',
                              fontSize:10, fontWeight:800, color: active ? '#4ade80' : '#fff',
                              background: active ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.03)',
                              border: active ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.1)',
                            }}
                          >
                            {label}
                            <span style={{ display:'block', fontSize:8, fontWeight:400, color:'#fff', marginTop:2 }}>{sub}</span>
                          </button>
                        );
                      })}
                    </div>
                    {(() => {
                      const curve = postShowRecoveryDiet(prepPlan);
                      const w0 = prepPlan.preparation.startingWeightKg;
                      return (
                        <div style={{ fontSize:9, color:'#fff', marginBottom:4 }}>
                          Recovery-кривая: {curve.map(wk => `${wk.week}н ${wk.kcal}`).join(' → ')} ккал · regain-цель +5–10% веса сцены (~{Math.round(w0 * 1.05)}–{Math.round(w0 * 1.1)} кг при сцене {w0} кг)
                        </div>
                      );
                    })()}
                    {post.notes.map((n, i) => <div key={`n${i}`} style={{ color:'#fff', marginTop:2 }}>• {n}</div>)}
                    <div style={{ marginTop:4, fontSize:9, color:'#fff' }}>🏋️ {post.training.join(' ')}</div>
                    <div style={{ marginTop:4, color:'rgba(96,165,250,0.75)' }}>⚖️ {post.weightCheck}</div>
                  </div>
                );
              })()}
            </div>

            {/* PRO-2 P6: лог восстановления post-show (6 нед) + comedown-памятка */}
            {(() => {
              void postLogTick;
              const entries = getPostShowLog(prepPlan.id);
              const last = entries[entries.length - 1];
              const markers = postShowRecoveryMarkers(last ?? null, prepPlan.preparation.startingWeightKg);
              const markRow: Array<[string, boolean]> = [
                ['Вес +5%', markers.weightRegained],
                ['Сон ≥7ч', markers.sleepOk],
                ['Голод ≤3', markers.hungerOk],
                ['Цикл/гормоны', markers.cycleOk],
                ['Сила ≥95%', markers.strengthOk],
              ];
              return (
                <div style={{ marginTop:10, background:'rgba(34,197,94,0.04)', border:'1px solid rgba(34,197,94,0.15)', borderRadius:8, padding:10 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#4ade80', marginBottom:4 }}>
                    🔄 Восстановление · {markers.recoveredCount}/5 {markers.allRecovered ? '— восстановлены ✅' : ''}
                  </div>
                  <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:6 }}>
                    {markRow.map(([label, ok]) => (
                      <span key={label} style={{ fontSize:9, color:'#fff', background: ok ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.05)', border: ok ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.1)', borderRadius:999, padding:'3px 8px' }}>
                        {ok ? '✓ ' : ''}{label}
                      </span>
                    ))}
                  </div>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', fontSize:10, color:'#fff', marginBottom:6 }}>
                    <span>Нед:</span>
                    <button style={BTN_GHOST} onClick={() => setPostLogWeek(w => Math.max(1, w - 1))}>−</button>
                    <b style={{ minWidth:18, textAlign:'center' }}>{postLogWeek}</b>
                    <button style={BTN_GHOST} onClick={() => setPostLogWeek(w => Math.min(6, w + 1))}>+</button>
                    <input type="number" step={0.1} placeholder="Вес кг" value={postLogWeight} onChange={e => setPostLogWeight(e.target.value)} style={{ width:74, ...IN }} />
                    <input type="number" step={0.5} placeholder="Сон ч" value={postLogSleep} onChange={e => setPostLogSleep(e.target.value)} style={{ width:64, ...IN }} />
                    <span>Голод:</span>
                    <span style={{ display:'flex', gap:3 }}>
                      {[1,2,3,4,5].map(v => (
                        <button key={v} onClick={() => setPostLogHunger(v)} style={{ width:24, height:24, borderRadius:6, fontSize:10, cursor:'pointer', color:'#fff', border:'1px solid rgba(34,197,94,0.35)', background: postLogHunger === v ? 'rgba(34,197,94,0.45)' : 'rgba(255,255,255,0.03)' }}>{v}</button>
                      ))}
                    </span>
                    <PopupSelect
                      label="Цикл"
                      value={postLogCycle}
                      onChange={v => setPostLogCycle(v as typeof postLogCycle)}
                      options={[
                        { id: 'na', label: 'М — н/п' },
                        { id: 'restored', label: 'Цикл вернулся' },
                        { id: 'irregular', label: 'Нерегулярно' },
                        { id: 'absent', label: 'Нет цикла' },
                      ]}
                    />
                    <input type="number" step={1} placeholder="Сила %" value={postLogStrength} onChange={e => setPostLogStrength(e.target.value)} style={{ width:64, ...IN }} />
                    <button
                      style={{ ...BTN_GHOST, borderColor:'#22c55e', color:'#4ade80' }}
                      onClick={() => {
                        savePostShowEntry(prepPlan.id, {
                          week: postLogWeek as 1|2|3|4|5|6,
                          dateIso: isoToday(),
                          weightKg: parseFloat(postLogWeight) || undefined,
                          sleepH: parseFloat(postLogSleep) || undefined,
                          hunger1_5: postLogHunger,
                          cycle: postLogCycle,
                          strengthReturnPct: parseFloat(postLogStrength) || undefined,
                        });
                        setPostLogTick(t => t + 1);
                        setPostLogWeight(''); setPostLogSleep(''); setPostLogStrength('');
                        flash(`🔄 Запись нед ${postLogWeek} сохранена`);
                      }}
                    >
                      💾 Сохранить нед {postLogWeek}
                    </button>
                  </div>
                  {entries.length > 0 && (
                    <div style={{ fontSize:9, color:'#fff', marginBottom:4 }}>
                      {entries.map(e => (
                        <span key={e.week} style={{ marginRight:8 }}>
                          Н{e.week}: {e.weightKg ? `${e.weightKg} кг` : '—'}
                          <button onClick={() => { removePostShowEntry(prepPlan.id, e.week); setPostLogTick(t => t + 1); }} style={{ marginLeft:3, color:'#f87171', background:'transparent', border:'none', cursor:'pointer', fontSize:10 }} aria-label={`Удалить запись недели ${e.week}`}>✕</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{ fontSize:9, color:'#fff', borderTop:'1px solid rgba(34,197,94,0.15)', paddingTop:6 }}>
                    {postShowComedownNotes().map((n, i) => <div key={i} style={{ marginTop:2 }}>• {n}</div>)}
                  </div>
                </div>
              );
            })()}

            {/* 🔎 Сравнение до/после: какие недели изменились (diff тренировочного цикла) */}
            {prepApplied && builtPlan && prepBasePlan && (() => {
              const weekSets = (p: any, i: number) => {
                const w = p.weeks[i];
                if (!w) return null;
                return w.sessions.reduce((a: number, s: any) => a + s.exercises.reduce((b: number, e: any) => b + (e.sets || 0), 0), 0);
              };
              const weekRir = (p: any, i: number) => {
                const w = p.weeks[i];
                if (!w) return null;
                const rirs = w.sessions.flatMap((s: any) => s.exercises.map((e: any) => e.rir ?? 3));
                return rirs.length ? Math.min(...rirs) : null;
              };
              const rows = builtPlan.weeks.map((w: any, i: number) => {
                const before = weekSets(prepBasePlan, i);
                const after = weekSets(builtPlan, i);
                const rirB = weekRir(prepBasePlan, i);
                const rirA = weekRir(builtPlan, i);
                const changed = before != null && after != null && (before !== after || rirB !== rirA);
                const cp = (w as any).contestPhase as PrepPhaseKey | undefined;
                return { week: (w as any).week, cp, before, after, rirB, rirA, changed };
              });
              const changedCount = rows.filter(r => r.changed).length;
              return (
                <div style={{ marginTop:10 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#fff', marginBottom:4 }}>
                    🔎 Сравнение до/после {changedCount > 0 ? `· изменено недель: ${changedCount}` : '· изменений нет'}
                  </div>
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', fontSize:10, borderCollapse:'collapse', minWidth:520 }}>
                      <thead>
                        <tr style={{ color:'#fff', textAlign:'left' }}>
                          <th style={{ padding:'4px 6px' }}>Нед</th>
                          <th style={{ padding:'4px 6px' }}>Фаза</th>
                          <th style={{ padding:'4px 6px', textAlign:'right' }}>Сетов до</th>
                          <th style={{ padding:'4px 6px', textAlign:'right' }}>Сетов после</th>
                          <th style={{ padding:'4px 6px', textAlign:'right' }}>RIR до</th>
                          <th style={{ padding:'4px 6px', textAlign:'right' }}>RIR после</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(r => {
                          const bg = !r.changed ? 'transparent' : r.cp === 'preparation' ? 'rgba(34,197,94,0.08)' : r.cp === 'final_preparation' ? 'rgba(139,92,246,0.08)' : r.cp === 'taper' ? 'rgba(245,158,11,0.08)' : 'rgba(236,72,153,0.08)';
                          return (
                            <tr key={r.week} style={{ borderTop:'1px solid rgba(255,255,255,0.05)', background: bg }}>
                              <td style={{ padding:'4px 6px', fontWeight:700 }}>{r.week}</td>
                              <td style={{ padding:'4px 6px', color: PREP_PHASE_COLORS[r.cp ?? 'preparation'] ?? '#fff' }}>
                                {r.cp === 'preparation' ? '🏁 Подготовка' : r.cp === 'final_preparation' ? 'Финальная' : r.cp === 'taper' ? '📉 Тапер' : '🎭 Пик'}
                              </td>
                              <td style={{ padding:'4px 6px', textAlign:'right', color: r.changed ? '#fff' : '#fff' }}>{r.before ?? '—'}</td>
                              <td style={{ padding:'4px 6px', textAlign:'right', fontWeight: r.changed ? 800 : 400, color: r.changed ? '#fbbf24' : '#fff' }}>{r.after ?? '—'}</td>
                              <td style={{ padding:'4px 6px', textAlign:'right', color: r.changed ? '#fff' : '#fff' }}>{r.rirB ?? '—'}</td>
                              <td style={{ padding:'4px 6px', textAlign:'right', fontWeight: r.changed ? 800 : 400, color: r.changed ? '#fbbf24' : '#fff' }}>{r.rirA ?? '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ fontSize:9, color:'#fff', marginTop:3 }}>
                    Зелёный — подготовка (режим RIR 1–3), фиолетовый — финальная (×0.9), оранжевый — taper (объём ↓, вес сохранён), розовый — пик-неделя.
                  </div>
                </div>
              );
            })()}

            {/* 📝 История корректировок */}
            {(prepPlan.adjustments?.length ?? 0) > 0 && (
              <div style={{ marginTop:10 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#60a5fa', marginBottom:4 }}>📝 История корректировок</div>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', fontSize:10, borderCollapse:'collapse', minWidth:420 }}>
                    <thead>
                      <tr style={{ color:'#fff', textAlign:'left' }}>
                        <th style={{ padding:'4px 6px' }}>Дата</th>
                        <th style={{ padding:'4px 6px', textAlign:'right' }}>Ккал</th>
                        <th style={{ padding:'4px 6px', textAlign:'right' }}>Кардио</th>
                        <th style={{ padding:'4px 6px' }}>Статус</th>
                        <th style={{ padding:'4px 6px' }}>Причина</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...(prepPlan.adjustments ?? [])].reverse().map((a, i) => (
                        <tr key={i} style={{ borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding:'4px 6px' }}>{a.date}</td>
                          <td style={{ padding:'4px 6px', textAlign:'right', color: a.caloriesDelta !== 0 ? (a.caloriesDelta > 0 ? '#4ade80' : '#f87171') : '#fff' }}>{a.caloriesDelta > 0 ? '+' : ''}{a.caloriesDelta}</td>
                          <td style={{ padding:'4px 6px', textAlign:'right', color: a.cardioDelta !== 0 ? (a.cardioDelta > 0 ? '#4ade80' : '#f87171') : '#fff' }}>{a.cardioDelta > 0 ? '+' : ''}{a.cardioDelta}</td>
                          <td style={{ padding:'4px 6px', color:'#fff' }}>{a.weightStatus}</td>
                          <td style={{ padding:'4px 6px', color:'#fff', fontSize:9 }}>{a.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:10 }}>
              <button style={BTN_GHOST} onClick={() => handleExtendPrep(1)}>➕ Неделя подготовки</button>
              <button style={BTN_GHOST} onClick={() => handleExtendPrep(-1)}>➖ Неделя подготовки</button>
              <button style={{ ...BTN_GHOST, borderColor:'#22c55e', color:'#22c55e' }} onClick={handlePrintPrepSummary}>🖨 Сводка prep (PDF)</button>
              <button style={{ ...BTN_GHOST, borderColor:'#60a5fa', color:'#60a5fa' }} onClick={handleExportPrepIcs}>📅 Фазы (.ics)</button>
              <button style={{ ...BTN_GHOST, borderColor:'#a78bfa', color:'#a78bfa' }} onClick={handleExportPrepJson}>📥 JSON тренеру</button>
              <button style={{ ...BTN_GHOST, borderColor:'#f59e0b', color:'#f59e0b' }} onClick={handleExportWeeklyReport}>📥 Отчёт тренеру</button>
              <button style={{ ...BTN_GHOST, borderColor:'#f59e0b', color:'#f59e0b' }} onClick={handleExportCheckinsCsv}>📥 Чек-ины (CSV)</button>
              <button style={{ ...BTN_GHOST, borderColor:'#ec4899', color:'#ec4899' }} onClick={() => setStep('adjust')}>← К коррекции плана</button>
              {prepApplied && <span style={{ fontSize:10, color:'#4ade80', alignSelf:'center' }}>✓ Применено к плану</span>}
            </div>
            </div>
          )}
          <div style={{ display:'flex', gap:8, marginTop:12 }}>
            <button style={{ ...BTN, flex:1 }} onClick={() => setStep('annual')}>Далее: Годовой план →</button>
            <button style={BTN_GHOST} onClick={() => setStep('adjust')}>← Назад</button>
          </div>
        </div>
      );
    };

  // ── 🏁 Prep-цикл: отдельный режим подготовки к соревнованиям ──
  const minRec = recommendMinimalMode({ category: prepCat, enhanced: peds.length > 0, trainingYears: bbTrainingYears, level: bbLevel, minimalMuscles: prepMinimal });

  const buildPrepCycleCfg = (): PrepCycleConfig => ({
    category: prepCat,
    sex: prepSex,
    accentMuscles: prepAccent,
    minimalMuscles: prepMinimal,
    minimalMode: prepMinMode,
    prepVolumeStrategy,
    prepDeloadEvery,
    splitPatternId: prepSplit || undefined,
    weeks: pcWeeks,
    taperWeeks: prepTaper,
    showDate: pcShowDate,
    competitions: prepComps.length ? prepComps : undefined,
    mainCompetitionId: prepMainId || undefined,
    level: bbLevel,
    trainingYears: bbTrainingYears,
    equipment: bbEquipment,
    injuries: (injuries || []).map(i => ({ muscle: i.muscle, from: i.from, to: i.to, exclude: i.exclude, weightPct: i.weightPct, volumePct: i.volumePct, repsCap: i.repsCap })),
    mobilityRestrictions,
    workMax: bbWorkMax,
    bodyFat: Number((linked.profile?.settings as any)?.personal?.bodyFat) || undefined,
    leanMass: Number((linked.profile?.settings as any)?.personal?.leanMass) || undefined,
    hrvMs: Number((linked.profile?.settings as any)?.lifestyle?.morningHRV) || undefined,
    sleepHours: Number((linked.profile?.settings as any)?.lifestyle?.sleepHours) || undefined,
    stressLevel: Number((linked.profile?.settings as any)?.lifestyle?.stressLevel) || undefined,
    labMrvMultiplier: labAdjust?.mrvMultiplier,
    labWarnings: labAdjust?.warnings,
    labIntensityNote: labAdjust?.intensityNote,
    enhanced: peds.length > 0,
    pedDoses,
    courseIntensity,
    trainingFocus: bbTrainingFocus,
    bodyweightCapability: (prof as any)?.bodyweightCapability,
    favoriteExercises: bbFavEx,
    excludedExercises: bbExclEx,
    avoidAxialLoad: (prof as any)?.avoidAxialLoad || false,
    intensityTechnique: intensityTech,
    autoDeload,
    deloadType,
    loadStrategy,
    autoRegResult: (autoRegOn && autoRegResult) ? { volumeMultiplier: autoRegResult.volumeMultiplier, topSetPctMultiplier: autoRegResult.topSetPctMultiplier, rirShift: autoRegResult.rirShift } : undefined,
    methodology: bbMethodology,
    eccentricMult,
    previousPlan: usePreviousPlan && savedPlans.length > 0 ? savedPlans[0].plan : undefined,
    supersetMode,
    volumeScheme,
    dupMode,
    proteinPerKg: Number((linked.profile?.settings as any)?.nutrition?.proteinPerKg) || undefined,
    calorieSurplus: Number((linked.profile?.settings as any)?.nutrition?.calorieSurplus) || undefined,
    weightKg: profileWeight,
    bodyFatPct: prepBodyFat,
    experienceLevel: (bbLevel === 'enhanced' || bbLevel === 'advanced' ? 'advanced' : bbLevel === 'beginner' ? 'beginner' : 'intermediate') as 'beginner' | 'intermediate' | 'advanced',
    prepCount: 0,
  });

  const handleBuildPrep = () => {
    setPcBusy(true);
    try {
      const res = buildPrepCycle(buildPrepCycleCfg());
      setPrepResult(res);
      // Синхронизируем общий prep-контекст (печать/.ics/JSON/адаптация по весу работают на prepPlan).
      setPrepPlan(res.prepPlan);
      setPrepShowDate(res.prepPlan.showDate);
      setPrepWeeks(res.prepPlan.preparation.weeks);
      setPrepTaperWeeks(res.prepPlan.taper.weeks);
      setPeakWeekCategory(res.prepPlan.category);
      setPrepWaterMode(res.prepPlan.peakWeek.waterMode === 'stable' ? 'stable' : 'tapered' as WaterStrategy);
      setPrepSodiumMode(res.prepPlan.peakWeek.sodiumMode === 'stable' ? 'stable' : 'tapered' as SodiumStrategy);
      setPrepCarbMode(res.prepPlan.peakWeek.carbMode === 'conservative' ? 'back' : res.prepPlan.peakWeek.carbMode === 'high' ? 'front' : 'moderate' as CarbLoadStrategy);
      setBuiltPlan(res.bbPlan);
      setPrepApplied(true);
      // 🏁 Авто-подключение к таперу питания: сохраняем prep-план + конфиг и уведомляем
      // планировщик (вкладка «🏁 Тапер ББ» + дневные цели) СРАЗУ при сборке, без доп. клика.
      try {
        const cfg = configFromPlan(res.prepPlan);
        savePrepToProfile(res.prepPlan, cfg);
      } catch { /* silent */ }
      setPrepStep('result');
    } catch (e) {
      flash(`⚠ ${(e as Error)?.message ?? 'Не удалось собрать prep-цикл'}`);
    }
    setPcBusy(false);
  };

  // ⚠ Stale-механика: параметры изменились после сборки → результат устарел.
  const prepStale = useMemo(() => {
    if (!prepResult) return false;
    const cfg = prepResult.config;
    return cfg.weeks !== pcWeeks
      || cfg.taperWeeks !== prepTaper
      || cfg.showDate !== pcShowDate
      || cfg.category !== prepCat
      || JSON.stringify(cfg.accentMuscles) !== JSON.stringify(prepAccent)
      || JSON.stringify(cfg.minimalMuscles) !== JSON.stringify(prepMinimal)
      || cfg.minimalMode !== prepMinMode
      || cfg.splitPatternId !== (prepSplit || undefined);
  }, [prepResult, pcWeeks, prepTaper, pcShowDate, prepCat, prepAccent, prepMinimal, prepMinMode, prepSplit]);

  // 🏁 Сезон: цепочка prep-циклов под все старты (P3.3).
  const buildPrepSeasonCfg = (): PrepSeasonConfig => {
    const c = buildPrepCycleCfg();
    return {
      category: c.category, sex: c.sex,
      accentMuscles: c.accentMuscles, minimalMuscles: c.minimalMuscles, minimalMode: c.minimalMode,
      prepVolumeStrategy,
      prepDeloadEvery,
      splitPatternId: c.splitPatternId,
      level: c.level, trainingYears: c.trainingYears, equipment: c.equipment, injuries: c.injuries,
      mobilityRestrictions: c.mobilityRestrictions, workMax: c.workMax, avoidAxialLoad: c.avoidAxialLoad,
      bodyFat: c.bodyFat, leanMass: c.leanMass, hrvMs: c.hrvMs, sleepHours: c.sleepHours, stressLevel: c.stressLevel,
      labMrvMultiplier: c.labMrvMultiplier,
      enhanced: c.enhanced, pedDoses: c.pedDoses, courseIntensity: c.courseIntensity,
      weightKg: c.weightKg, bodyFatPct: c.bodyFatPct, experienceLevel: c.experienceLevel, prepCount: c.prepCount,
      prepVolumeMult: c.prepVolumeMult, currentCalories: c.currentCalories,
      carbLoadStrategy: c.carbLoadStrategy, waterStrategy: c.waterStrategy, sodiumStrategy: c.sodiumStrategy,
      confirmedManipulation: c.confirmedManipulation, contraindications: c.contraindications,
      competitions: prepComps, prepWeeksPerComp: pcWeeks, taperWeeks: prepTaper,
    };
  };

  const handleBuildSeason = () => {
    if (prepComps.length < 2) { flash('Добавьте минимум 2 старта в параметрах, чтобы собрать сезон'); return; }
    setPcBusy(true);
    try {
      const res = buildPrepSeason(buildPrepSeasonCfg());
      setPrepSeason(res);
      setPrepResult(res.cycles[res.cycles.length - 1] ?? null);
      setPrepStep('result');
      // Авто-подключение к таперу питания: сохраняем главный (A) или последний цикл сезона.
      const mainIdx = res.summary.findIndex(s => s.priority === 'A');
      const main = res.cycles[mainIdx >= 0 ? mainIdx : res.cycles.length - 1];
      if (main) {
        try {
          const cfg = configFromPlan(main.prepPlan);
          savePrepToProfile(main.prepPlan, cfg);
        } catch { /* silent */ }
      }
      flash(`🏁 Сезон: собрано ${res.cycles.length} цикла (по одному на старт)`);
    } catch (e) {
      flash(`⚠ ${(e as Error)?.message ?? 'Не удалось собрать сезон'}`);
    }
    setPcBusy(false);
  };

  const handleSavePrepCycle = () => {
    if (!prepResult) return;
    try {
      const cfg = configFromPlan(prepResult.prepPlan);
      savePrepToProfile(prepResult.prepPlan, cfg);
      flash('✅ Prep-цикл сохранён. Питание/тапер/пик-неделя применены в планировщике питания (вкладка «🏁 Тапер ББ» и дневные цели)');
    } catch { flash('⚠ Не удалось сохранить prep-цикл'); }
  };

  const handleOpenPrepPlan = () => {
    if (!prepResult) return;
    setBuiltPlan(prepResult.bbPlan);
    setPrepMode(false);
    setStep('plan');
    flash('🏁 Prep-цикл загружен в план — можно смотреть/выполнять');
  };

  const renderPrepCycleMode = () => (
    <BbPrepCycleStep
      prepStep={prepStep}
      setPrepStep={setPrepStep}
      setPrepMode={setPrepMode}
      setPrepResult={setPrepResult}
      prepSex={prepSex}
      prepCat={prepCat}
      setPrepCat={setPrepCat}
      pcWeeks={pcWeeks}
      setPcWeeks={setPcWeeks}
      prepTaper={prepTaper}
      setPrepTaper={setPrepTaper}
      pcShowDate={pcShowDate}
      setPcShowDate={setPcShowDate}
      prepComps={prepComps}
      setPrepComps={setPrepComps}
      prepMainId={prepMainId}
      setPrepMainId={setPrepMainId}
      prepCompDraft={prepCompDraft}
      setPrepCompDraft={setPrepCompDraft}
      prepBodyFat={prepBodyFat}
      setPrepBodyFat={setPrepBodyFat}
      prepAccent={prepAccent}
      setPrepAccent={setPrepAccent}
      prepMinimal={prepMinimal}
      setPrepMinimal={setPrepMinimal}
      prepMinMode={prepMinMode}
      setPrepMinMode={setPrepMinMode}
      minRec={minRec}
      prepSplit={prepSplit}
      setPrepSplit={setPrepSplit}
      prepStale={prepStale}
      profileWeight={profileWeight}
      prepVolumeStrategy={prepVolumeStrategy}
      setPrepVolumeStrategy={setPrepVolumeStrategy}
      prepDeloadEvery={prepDeloadEvery}
      setPrepDeloadEvery={setPrepDeloadEvery}
      pcBusy={pcBusy}
      prepResult={prepResult}
      prepSeason={prepSeason}
      weightAdvice={weightAdvice}
      handleApplyWeightAdjustment={handleApplyWeightAdjustment}
      posingMin={posingMin}
      setPosingMin={setPosingMin}
      posingList={posingList}
      setPosingList={setPosingList}
      handleBuildPrep={handleBuildPrep}
      handleBuildSeason={handleBuildSeason}
      handleSavePrepCycle={handleSavePrepCycle}
      handleOpenPrepPlan={handleOpenPrepPlan}
      handleSaveVariant={handleSaveVariant}
      handlePrintPrepSummary={handlePrintPrepSummary}
      handleExportPrepIcs={handleExportPrepIcs}
      handleExportPrepJson={handleExportPrepJson}
      flash={flash}
    />
  );

  // ── Exercise swap modal ──
  const renderExSwapModal = () => (
    <BbExSwapModal
      builtPlan={builtPlan}
      exSwapModal={exSwapModal}
      exSwapSearch={exSwapSearch}
      setExSwapSearch={setExSwapSearch}
      dialogRef={exSwapDialogRef}
      onReplace={handleReplaceExercise}
      onClose={() => { setExSwapModal(null); setExSwapSearch(''); }}
    />
  );

  return (
    <div>
      {/* Заголовок ББ-авто + кнопка «Начать заново» (как в ПЛ-авто) */}
      <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 12, background: 'var(--accent-dim)', border: '1px solid var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)' }}>💪 ББ-авто</span>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={() => { setPrepMode(true); setPrepResult(null); }} title="Отдельный режим подготовки к соревнованиям: категория, акценты/минимум, сплит 4-26 нед, тапер, даты" aria-label="Prep-цикл" style={{ padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: 'pointer', border: '1px solid rgba(236,72,153,0.4)', background: prepMode ? 'linear-gradient(135deg,#ec4899,#be185d)' : 'rgba(236,72,153,0.1)', color: prepMode ? '#fff' : '#ec4899', minHeight: 30 }}>🏁 Prep-цикл</button>
          <button onClick={() => setResetAsk(true)} title="Сбросить сборку и начать заново" aria-label="Начать заново" style={{ padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(244,63,94,0.35)', background: 'rgba(244,63,94,0.08)', color: '#fb7185', minHeight: 30, flexShrink: 0 }}>🔄 Начать заново</button>
        </div>
      </div>
      {prepMode ? (
        <>{renderPrepCycleMode()}</>
      ) : (
        <>
      {/* Шаги конструктора — ряд с переносом, помещается на экране без прокрутки */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {renderStepNav()}
      </div>
      {step === 'annual' && (
        <div className="bb-annual-planner-page">
          <div className="bb-annual-planner-page__header">
            <div>
              <div style={H}>🗓 Годовое планирование ББ</div>
              <div style={SMALL}>Постройте макроцикл и начните работу по нему — или стройте план с нуля, как раньше.</div>
            </div>
          </div>
          <MacrocyclePanel level={bbLevel} goal="bodybuilding" onLevelChange={setBbLevel} onGoalChange={() => undefined} storageKey="he_bb_macro" onApplyMacrocycle={source => {
            if (!('trainingFocus' in source)) {
              // Раньше — тихий return: кнопка «Начать работу по циклу» молча
              // ничего не делала, если в he_bb_macro лежал ПЛ-макроцикл.
              flash('⚠ В хранилище ПЛ-макроцикл. Постройте ББ-макроцикл заново (кнопка «Построить макроцикл»)');
              return;
            }
            setBbAnnualMacrocycle(source as BBMacrocycle);
            setPlanMode('generic_split');
            setBbWeeks(source.totalWeeks);
            setBbTrainingFocus(source.trainingFocus);
            setStep('params');
            }} />
          {(() => {
            const line = annualActiveBlockLine(annualPlan, isoToday());
            if (!line) return null;
            return (
              <div style={{ marginTop: 8, padding: '7px 9px', borderRadius: 10, fontSize: 11, lineHeight: 1.5,
                background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.25)', color: '#fff' }}>
                {line}
              </div>
            );
          })()}
          <div style={{ marginTop: 8 }}><CardioLinkCard /></div>
          <div style={{ display:'flex', gap:8, marginTop:12 }}>
            <button style={{ ...BTN, flex:1 }} onClick={() => setStep('tools')}>Далее: Инструменты →</button>
            <button style={BTN_GHOST} onClick={() => setStep('contest')}>← Назад</button>
          </div>
        </div>
      )}
      {/* Глобальное уведомление (flash) — видно на ВСЕХ шагах, не только в параметрах */}
      {bridgeMsg && (
        <div role="status" style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 10, background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.2)', color: '#00e68a', fontSize: 11, fontWeight: 700 }}>
          {bridgeMsg}
        </div>
      )}
      {step === 'params' && renderParams()}
      {step === 'ped' && renderPedWorkMax()}
      {step === 'split' && renderSplit()}
      {step === 'plan' && renderPlanWithComments()}
      {step === 'weights' && renderWeights()}
      {step === 'quality' && renderQuality()}
      {step === 'adjust' && renderAdjust()}
      {step === 'contest' && renderContestPrep()}
      {step === 'tools' && (
        <div style={{ minWidth: 0, maxWidth: '100%' }}>
          <div style={H}>🔧 Инструменты ББ</div>
          <PlannerToolsPanel mode="bb" />
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', gap: 4, flexWrap: 'wrap' }}>
            <button style={{ ...BTN_GHOST, minHeight: 36, fontSize: 10 }} onClick={() => setStep('annual')}>← 🗓 Годовой план</button>
            <button style={{ ...BTN_GHOST, minHeight: 36, fontSize: 10 }} onClick={() => setStep('params')}>1 Параметры →</button>
          </div>
        </div>
      )}
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
      {/* Модалка ввода имени вместо prompt() — prompt не работает в Telegram Mini App */}
      {namePrompt && (
        <div style={{ position:'fixed', inset:0, zIndex:260, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.85)', padding:16 }}
          onClick={() => setNamePrompt(null)}>
          <div onClick={e => e.stopPropagation()} ref={namePromptDialogRef} role="dialog" aria-modal="true" aria-label={namePrompt.title} tabIndex={-1} style={{ width:'100%', maxWidth:400, borderRadius:16, background:'#18181b', border:'1px solid rgba(255,255,255,0.12)', padding:16, boxSizing:'border-box', boxShadow:'0 20px 60px rgba(0,0,0,0.6)', outline:'none' }}>
            <div style={{ fontSize:14, fontWeight:800, color:'#00e68a', marginBottom:10 }}>{namePrompt.title}</div>
            <input autoFocus value={namePrompt.value}
              onChange={e => setNamePrompt({ ...namePrompt, value: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') confirmName(); }}
              style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1px solid rgba(255,255,255,0.12)', background:'rgba(0,0,0,0.3)', color:'#fff', fontSize:16, boxSizing:'border-box', marginBottom:12 }} />
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setNamePrompt(null)} style={{ flex:1, padding:'10px', borderRadius:10, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer', minHeight:44 }}>Отмена</button>
              <button onClick={confirmName} style={{ flex:1, padding:'10px', borderRadius:10, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#00e68a,#00c853)', color:'#000', fontWeight:800, fontSize:12, minHeight:44 }}>✓ Сохранить</button>
            </div>
          </div>
        </div>
      )}
      {/* Модалка подтверждения «Начать заново» */}
      {resetAsk && (
        <div style={{ position:'fixed', inset:0, zIndex:260, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.85)', padding:16 }}
          onClick={() => setResetAsk(false)}>
          <div onClick={e => e.stopPropagation()} ref={resetAskDialogRef} role="dialog" aria-modal="true" aria-label="Начать заново?" tabIndex={-1} style={{ width:'100%', maxWidth:400, borderRadius:16, background:'#18181b', border:'1px solid rgba(255,255,255,0.12)', padding:16, boxSizing:'border-box', boxShadow:'0 20px 60px rgba(0,0,0,0.6)', outline:'none' }}>
            <div style={{ fontSize:14, fontWeight:800, color:'#fb7185', marginBottom:8 }}>🔄 Начать заново?</div>
            <div style={{ fontSize:12, color:'#fff', lineHeight:1.5, marginBottom:12 }}>
              Собранный план, все правки и contest prep будут сброшены. Параметры останутся на месте — можно собрать план заново с шага 1.
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setResetAsk(false)} style={{ flex:1, padding:'10px', borderRadius:10, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer', minHeight:44 }}>Отмена</button>
              <button onClick={resetBuild} style={{ flex:1, padding:'10px', borderRadius:10, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#f43f5e,#e11d48)', color:'#fff', fontWeight:800, fontSize:12, minHeight:44 }}>🔄 Сбросить</button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};
