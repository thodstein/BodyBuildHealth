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
import { EXERCISE_CATALOG, getExerciseById } from '../../../core/exercise-catalog';
import { SubstitutionPopup } from './SubstitutionPopup';
import { SPLIT_PATTERNS } from '../../../engines/bb/bb-split-patterns';
import { rankBBSplits, splitFitWarnings } from '../../../engines/bb/bb-selector.engine';
import { buildBBPlan, applyMacrocycleToBBPlan, type BBPlan } from '../../../engines/bb/bb-builder.engine';
import { autoCalibrateFromStored, type PlanWeightEntry } from '../../../engines/bb/bb-weight-calibration.engine';
import type { DUPMode } from '../../../engines/bb/bb-dup.engine';
import { applyDUPOverlay, recommendDUPMode } from '../../../engines/bb/bb-dup.engine';
import { applyExecutionCorrections, type ExecutionCorrection } from '../../../engines/bb/bb-execution-corrections.engine';
import { validateBBPlan, generateActionableRecommendations } from '../../../engines/bb/bb-validator.engine';
import { finalizeBBPlan } from '../../../engines/bb/bb-finalize.engine';
import { exerciseFeatureBadges, techniqueChainParts, canonTechniqueId } from './bb-technique-display';
import { calcBBPlanMetrics } from '../../../engines/bb/bb-metrics.engine';
import { buildBBPlanReportText } from '../../../engines/bb/bb-report.engine';
import { averageWeeklyScores, scoreVolumeWeek, scoreProWeek, gradeFor } from '../../../engines/bb/bb-quality-weekly.engine';
import { computeRegimeMrvMult, sessionLimitsFor } from '../../../engines/bb/bb-volume.engine';
import { bbExerciseExplanation } from '../../../engines/bb/bb-summary.engine';
import { buildMEVCalibration, recordMEVCalibrationWeek, isMEVCalibrationComplete, saveMEVCalibration, loadMEVCalibration, clearMEVCalibration, type MEVCalibration, type MEVSignal } from '../../../engines/bb/bb-mev-calibration.engine';
import { adaptForPEDs, type PED } from '../../../engines/bb/bb-ped-adaptation.engine';
import { suggestMethodologyForStack, recommendPEDMethodology, applyPEDMethodologyToPlan } from '../../../engines/bb/bb-ped-methodology.engine';
import { getAllVolumeLandmarks } from '../../../engines/volume-landmarks.engine';
import { canonicalMuscle, expandDonorMuscles, isSpecializationTargetConflict as isRegionConflict, normalizeSpecializationTargets } from '../../../engines/bb/bb-specialization.engine';
import { loadSRPESessions } from '../../../engines/pro/srpe-store';
import { loadSessions } from '../../../engines/workout-logger.engine';
import { acuteChronicRatio, toDailyLoads } from '../../../engines/pro/training-load.engine';
import { autoRegulate } from '../../../engines/pro/autoregulation-pro.engine';
import { riskyOpenChainIds, decideBbOrthoIntake, subtractTracked } from '../../../engines/pro/ortho-screen.engine';
import { resolveBbDiagIntakeExtras } from '../../../engines/bb/bb-diag-intake.engine';
import { buildBbMovementPrintBlock } from '../../../engines/bb/bb-diagnostics-export.engine';
import { loadTrainingProfile, saveTrainingProfile, type TrainingProfile } from './training-profile';
import { subscribePlannerApply, applyToPlanner, getPlannerApply, clearPlannerApply, type PlannerApply, type WeakpointsPayload } from './planner-bridge';
import { loadAnnualTrainingPlan } from '../../../engines/annual-training/annual-training-storage';
import { CARD, SMALL, BTN, BTN_GHOST, H, STEP_PILL } from './training-ui';
import { PopupNumber } from '../SRCBBScreen_parts/TrainingPopups';
import type { InjurySelectEntry } from './InjurySelectCard';
import { DELOAD_PROTOCOLS, type LoadStrategy, type DeloadType, type IntensityTechnique } from '../../../engines/bb/bb-autocoach.engine';
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

import { PlanExportCard } from './PlanExportCard';
import { loadSavedBBPlans, saveBBPlanVariant, deleteBBPlanVariant, type SavedBBPlan } from './bb-plans-store';
import { deserializeBBPrepConfig, legacyConfigFromProfile, isoAddDays, isoToday, CATEGORY_PROFILES, buildBBContestPrepPlan, applyContestPrepToBBPlan, extendBBPlanPreparation, addPrepWeeks, shiftBBContestPrepShowDate, prepPhaseForDate, configFromPlan, computeReadiness, spillRiskScore, isShortCycle, saveTestPeakWeekResult, latestTestPeakWeek, planFromStored, prepWeightAdvice, syncPrepDietBreaksWithPlan, recommendBBTaperConfig, sRPEAdjustment, loadShowChecklist, type BBTaperRecommendation, buildContestPrepPrintHtml, recordPrepAdjustment, buildPrepIcs, buildPrepCoachJson, prepTrainingCompliance, buildPrepWeeklyReportHtml, buildPrepCheckinsCsv, trialCarbDoseGPerKg, type BBContestPrepConfig, type BBContestCategory, type ContestSpecialization, type BBContestPrepPlan, type BBPlanWithPrep, type ContestEventEntry, type WaterStrategy, type SodiumStrategy, type CarbLoadStrategy } from '../../../engines/bb/bb-contest-prep.engine';
import { CONTEST_PREP_UPDATED_EVENT, migrateLegacyContestPrepIfNeeded, storeContestPrepPlan } from '../../../engines/bb/bb-contest-prep-sync';
import { loadPeakWeekLog, peakWeekAdherence, peakWeekTrendAdvice, emergencyLines } from '../../../engines/bb/bb-peak-pro.engine';
import type { PeakingProtocol } from '../../../engines/peaking-protocols.engine';
import { buildPrepCycle, buildPrepSeason, recommendMinimalMode, getPosingCheckins, type PrepCycleConfig, type PrepCycleResult, type PrepSeasonConfig } from '../../../engines/bb/bb-prep-cycle.engine';
import { PREP_SPLIT_PROFILES, type PrepMinimalMode } from '../../../engines/bb/bb-prep-splits';
import { optimizeMuscleFrequency, type FrequencyOptimizationResult } from '../../../engines/bb/bb-frequency-optimizer.engine';
import { calculatePlanSafetyScore, type PlanSafetyScore } from '../../../engines/bb/bb-safety-score.engine';
import { assessReadiness, calculateACWR, getAutoRegulationOverride } from '../../../engines/bb/bb-auto-regulation.engine';
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

import { getProfile } from '../../../core/profile-manager';
import { getWeightLog } from '../../../engines/profile-store';
import { loadPrepWeekCheckins, savePrepWeekCheckin, prepWeekRefs, prepStrengthTrend, avgWeight7d, avgSleep7d, type PrepWeekCheckin } from '../../../engines/bb/bb-prep-weekly-log';
import { getPostShowLog } from '../../../engines/bb/bb-prep-post-show-log.engine';

/* ── Вынесенный служебный слой (этап 1 §4.3): CollapsibleCard, типы шагов/фаз,
   константы групп и чистые хелперы — в `bb-auto-constructor-shared.tsx`. ── */
import { CollapsibleCard, WEAK_GROUPS, PHASE_TECHNIQUES, backSubgroupLabel, armHeadLabel, isAbRotationActive, annualBlockCtxToPrepPatch, annualActiveBlockLine, DONOR_GROUPS, normalizeDonorTargets, computePhases, useInlineDialogA11y, BbCard, type Step, type PlanMode } from './bb-auto-constructor-shared';
import { BbSplitStep } from './bb-step-split';
import { BbPedWorkMaxStep } from './bb-step-ped';
import { BbWeightsStep } from './bb-step-weights';
import { BbExSwapModal } from './bb-step-ex-swap';
import { BbAdjustStep } from './bb-step-adjust';
import { BbPrepCycleStep } from './bb-step-prep-cycle';
import { BbParamsStep } from './bb-step-params';
import { BbPlanStep } from './bb-step-plan';
import { BbQualityUnifiedCard, BbQualityPlanLogicCard, BbQualitySafetySection } from './bb-quality-sections';
import { BbQualityLoadOverview, BbQualityLoadVolume, BbQualityLoadChecks, type BbQualityLoadCtx } from './bb-quality-load-sections';
import { BbContestPrepParams, BbContestPrepPreview, BbContestPrepTrialSafety, BbContestPrepPost, type BbContestPrepCtx } from './bb-contest-prep-sections';
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
  const [collapsedDays, setCollapsedDays] = useState<Set<number>>(new Set());
  const [collapsedExercises, setCollapsedExercises] = useState<Set<string>>(new Set());
  const [safetyOpen, setSafetyOpen] = useState(true);
  const [qualityOpen, setQualityOpen] = useState(true);
  const [safetyPreventionOpen, setSafetyPreventionOpen] = useState(true);
  const [safetyDistributionOpen, setSafetyDistributionOpen] = useState(true);
  const [safetyConclusionOpen, setSafetyConclusionOpen] = useState(true);
  const [safetyFactorsOpen, setSafetyFactorsOpen] = useState(true);
  const [generalSafetyLoadOpen, setGeneralSafetyLoadOpen] = useState(true);
  const [jointAnalysisOpen, setJointAnalysisOpen] = useState(true);
  const [qualityVolumeOpen, setQualityVolumeOpen] = useState(true);
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
  // Программы: только FullProgram (библиотека) → programToBBPlan (faithful/adapt).
  // (customCycle/bbProgramPath удалены 2026-09: cycle-путь резолвится из selectedCycleId
  // через getCycleById, а programPath всегда был 'library' — мёртвые состояния.)
  const [customProgram, setCustomProgram] = useState<FullProgram | null>(null);
  const [bbAdaptMode, setBbAdaptMode] = useState<'faithful' | 'adapt'>('faithful');
  const [bbSource, setBbSource] = useState<'cycle' | 'program'>('program');
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
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
  const [wkCycle, setWkCycle] = useState<'' | 'regular' | 'irregular' | 'absent' | 'na'>('');
  const [wkSteps, setWkSteps] = useState('');
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
    // PRO-3 Э10: сон из дневника сна (Retos 2025: сон ↔ FM/SMM), если поле не заполнено вручную.
    let sleepFallback: number | undefined;
    try {
      const raw = localStorage.getItem('he_sleep_diary');
      const arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr)) sleepFallback = avgSleep7d(arr.filter((e: any) => e && typeof e.date === 'string').map((e: any) => ({ date: e.date, hours: Number(e.hours) })), isoToday());
    } catch { /* ignore */ }
    const entry: PrepWeekCheckin = {
      week: w,
      date: isoToday(),
      weightAvg: num(wkWeight) ?? avgWeight7d(weightLog, isoToday()),
      waistCm: num(wkWaist),
      sleepAvg: num(wkSleep) ?? sleepFallback,
      stepsAvg: num(wkSteps) != null ? Math.round(num(wkSteps)!) : undefined,
      sessionsDone: num(wkSessions) != null ? Math.round(num(wkSessions)!) : undefined,
      psyche: num(wkPsyche) != null ? Math.min(5, Math.max(1, Math.round(num(wkPsyche)!))) : undefined,
      cycle: wkCycle || undefined,
      note: wkNote.trim() || undefined,
      advice: (weightAdvice?.status as PrepWeekCheckin['advice']) ?? 'no_data',
    };
    savePrepWeekCheckin(prepPlan.id, entry);
    setWeeklyTick(t => t + 1);
    setWkWeight(''); setWkWaist(''); setWkSleep(''); setWkSessions(''); setWkPsyche(''); setWkCycle(''); setWkSteps(''); setWkNote(''); setWkWeek(null);
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
    // PRO-3 Э3: high-water разблокирует только УСПЕШНЫЙ trial (verdict tested_ok/conservative);
    // провальный прогон (adjust — залив/плоскость) — это не «репетиция состоялась», а урок.
    const hasTrial = (() => {
      try {
        const trial = prepPlan ? latestTestPeakWeek(prepPlan.id) : null;
        return trial?.verdict === 'tested_ok' ? true : undefined;
      } catch { return undefined; }
    })();
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
      if (cfg.waterStrategy==='high' && (!cfg.hasTrialPeak || !cfg.confirmedManipulation)) { flash('⛔ High water требует успешный trial peak за 21-28д + явное подтверждение'); setPrepBusy(false); return; }
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
        testPeakWeekId: lastTest?.id,
        trainingPlanId: prepPlan?.trainingPlanId,
        nutritionPlanId: prepPlan?.nutritionPlanId,
        postShowTrack: keepTrack,
      });
      setPrepPlan(plan);
      let planFinal = plan;
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
        // PRO-3 Э7: diet-break-окна синхронизируются с deload-неделями собранного плана (ICECAP).
        planFinal = syncPrepDietBreaksWithPlan(plan, (updated as any).weeks ?? []);
        if (planFinal !== plan) setPrepPlan(planFinal);
        // Подготовка в плане НЕ переделывается: taper накладывается поверх последних недель.
        const metaWarnings = ((updated as any).contestPrep?.warnings ?? []) as string[];
        const shortPrep = metaWarnings.find(w => w.includes('короче полной подготовки'));
        if (shortPrep) flash(`⚠ ${shortPrep.replace(/^⚠ /, '')}`);
      }
      savePrepToProfile(planFinal, cfg);
      flash('🏁 Contest prep собран' + (applyToPlan ? ' и применён к плану' : ''));
    } catch (e) {
      flash(`Не удалось собрать contest prep: ${(e as Error).message}`);
    } finally {
      setPrepBusy(false);
    }
  };

  // Единая точка записи prep (Э0): готовый план + конфиг — через sync-модуль
  // (оба ключа профиля + событие he-bb-contest-prep-updated). Не пересобирает план.
  const savePrepToProfile = (plan: BBContestPrepPlan, cfg: BBContestPrepConfig): boolean => {
    return storeContestPrepPlan(plan, cfg, { source: plan.source ?? 'bb_auto' });
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
    // PRO-3 Э1/D1: персист под НОВУЮ дату: cfg с явной датой (state prepShowDate ещё stale —
    // setState асинхронен), план сохраняется вместе с ним (раньше перенос терялся до пересборки).
    const cfgShifted = { ...buildContestPrepConfig(), showDate: d };
    savePrepToProfile(plan, cfgShifted);
    if (builtPlan && prepApplied) {
      const updated = applyContestPrepToBBPlan(builtPlan, cfgShifted, {
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
    // PRO-3 Э12: расширение/сужение — через единый хелпер движка (addPrepWeeks).
    const replanned = addPrepWeeks(prepPlan, delta);
    setPrepPlan(replanned);
    // PRO-3 Э1/D2: персист расширения (раньше state/план менялись, профиль — нет, флеш врал).
    const cfg = buildContestPrepConfig();
    if (builtPlan && prepApplied) {
      let base: BBPlanWithPrep = builtPlan as BBPlanWithPrep;
      if (delta > 0) base = extendBBPlanPreparation(base, delta);
      const updated = applyContestPrepToBBPlan(base, cfg, {
        prepWeeks: newWeeks,
        taperWeeks: replanned.taper.weeks,
        prepVolumeMult: prepVolumeMode,
        force: true,
      });
      setBuiltPlan(updated);
    }
    savePrepToProfile(replanned, cfg);
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
      // PRO-4: монитор пик-недели + экстренная карточка — в печатную сводку (тренеру/на шоу).
      let monitorLines: string[] | undefined;
      try {
        const log = loadPeakWeekLog(prepPlan.id);
        if (log.length) {
          const adh = peakWeekAdherence(prepPlan, log);
          const tr = peakWeekTrendAdvice(log);
          monitorLines = [
            `Дней записано: ${adh.loggedDays}/7` +
              (adh.waterPct != null ? ` · вода ${Math.round(adh.waterPct * 100)}% плана` : '') +
              (adh.sodiumPct != null ? ` · Na ${Math.round(adh.sodiumPct * 100)}%` : '') +
              (adh.carbsPct != null ? ` · углеводы ${Math.round(adh.carbsPct * 100)}%` : ''),
            ...log.map(e => `${e.date}: вес ${e.weightKg ?? '—'} кг · вода ${e.waterLiters ?? '—'} л · Na ${e.sodiumMg ?? '—'} мг · углеводы ${e.carbsG ?? '—'} г · визуал ${e.visual ?? '—'} · самочувствие ${e.wellbeing ?? '—'}`),
            `Тренд: ${tr.advice.join(' ')}`,
          ];
        }
      } catch { /* нет стора — без секции */ }
      win.document.write(buildContestPrepPrintHtml(prepPlan, { compliance, postShowLog: getPostShowLog(prepPlan.id), monitor: monitorLines, emergency: emergencyLines() }));
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
    if (!t) {
      flash('⚠ Тест пик-недели не сохранён: хранилище недоступно или переполнено.');
      return;
    }
    setLastTest(t);
    setPrepPlan(p => p ? { ...p, testPeakWeekId: t.id, updatedAt: new Date().toISOString() } : p);
    const saved = savePrepToProfile({ ...prepPlan, testPeakWeekId: t.id }, buildContestPrepConfig());
    flash(saved ? `✅ Тест пик-недели сохранён: ${t.verdict === 'tested_ok' ? 'протокол можно использовать' : t.verdict === 'adjust' ? 'нужна коррекция' : 'консервативный режим'}` : '⚠ Тест сохранён в журнал, но профиль не обновлён: хранилище переполнено.');
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
    // PRO-3 Э12: история корректировок — через единую функцию движка (единый формат/кап 20, было вручную).
    let next: BBContestPrepPlan = {
      ...prepPlan,
      updatedAt: new Date().toISOString(),
      preparation: {
        ...prepPlan.preparation,
        currentCalories: Math.max(1200, prepPlan.preparation.currentCalories + caloriesDelta),
        cardioMinutesPerWeek: Math.max(0, prepPlan.preparation.cardioMinutesPerWeek + cardioDelta),
      },
    };
    try {
      next = recordPrepAdjustment(next, {
        reason: weightAdvice.recommendation,
        caloriesDelta,
        cardioDelta,
        weightStatus: weightAdvice.status,
        source: 'user',
      });
    } catch { /* history — не критично для применения */ }
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
        const restoredCfg = configFromPlan(migrated);
        setPrepWaterMode(restoredCfg.waterStrategy);
        setPrepSodiumMode(restoredCfg.sodiumStrategy);
        setPrepCarbMode(restoredCfg.carbLoadStrategy);
        setPrepTrainingProtocol(restoredCfg.trainingProtocol);
        setPrepPreferLowFiber(!!restoredCfg.preferLowFiberCarbs);
        setPrepCreatineStop(restoredCfg.creatineStrategy === 'stop');
        setPrepConfirmedManip(!!restoredCfg.confirmedManipulation);
        setPrepCompetitions(restoredCfg.competitions);
        setPrepMainCompetitionId(restoredCfg.mainCompetitionId);
        if (migrated.preparation.volumeMult != null) setPrepVolumeMode(migrated.preparation.volumeMult);
        setLastTest(migrated.testPeakWeekId ? latestTestPeakWeek(migrated.id) : null);
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
      const restoredCfg = configFromPlan(stored);
      setPrepWaterMode(restoredCfg.waterStrategy);
      setPrepSodiumMode(restoredCfg.sodiumStrategy);
      setPrepCarbMode(restoredCfg.carbLoadStrategy);
      setPrepTrainingProtocol(restoredCfg.trainingProtocol);
      setPrepPreferLowFiber(!!restoredCfg.preferLowFiberCarbs);
      setPrepCreatineStop(restoredCfg.creatineStrategy === 'stop');
      setPrepConfirmedManip(!!restoredCfg.confirmedManipulation);
      setPrepCompetitions(restoredCfg.competitions);
      setPrepMainCompetitionId(restoredCfg.mainCompetitionId);
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
    const routeApply = (payload: PlannerApply | null) => {
      if (!payload || !payload.data) return;
      const src = (payload as any).source as string | undefined;
      const targetId = (payload as any).targetCycleId as string | undefined;
      if (src === 'pl-auto') return;
      if (src === 'intellectual' && targetId) {
        const c = getCycleById(targetId);
        if (c && normalizeCycleDirection(c.meta.direction) !== 'bodybuilding') return;
      }
      if (payload.kind === 'program' && payload.data) {
        const d = payload.data as any;
        if (d?.program && !d?.meta) {
          // Форма { program: FullProgram } (CardioManageStep и др.) — без SRCycleTemplate-обёртки.
          applyProgramToBb(d.program as FullProgram);
        } else if (d?.meta?.id) {
          // SRCycleTemplate (библиотека циклов/программ) — единый путь: SRCycleTemplate →
          // FullProgram → programToBBPlan. Раньше клали его в customCycle, а сборка
          // program-ветки читает только customProgram → «Сборка» падала в флеш.
          try {
            const prog = cycleTemplateToFullProgram(d as SRCycleTemplate);
            if (prog) applyProgramToBb(prog);
            else flash('⚠ Не удалось конвертировать программу в ББ-план');
          } catch (e) {
            console.warn('[BB-auto] bridge program:', e);
            flash('⚠ Ошибка конвертации программы');
          }
        } else {
          flash('⚠ Программа не распознана (пустой payload)');
        }
      } else if (payload.kind === 'weakpoints' && (() => {
        const d = payload.data as WeakpointsPayload;
        // 3.9: принимаем любой из источников групп (гранулярные → канонические → общие).
        return Array.isArray(d.weakZonesGranular) || Array.isArray(d.weakMusclesCanonical)
          || Array.isArray(d.weakPoints) || Array.isArray(d.groups);
      })()) {
        const bbDiag = payload.data as WeakpointsPayload;
        // D1 (§9 плана BB-AUTO-EXHAUSTIVE-PRO): движения диагностики (driver/singleLeg) — чистое
        // решение в движке (unit-тест); сборку НЕ меняет: bits → строка «диагностика», persist →
        // ключи he_bb_last_movement_driver/single_leg, clean → stale-чистка L/R-канала по маркеру lrVerdicts.
        const diagExtras = resolveBbDiagIntakeExtras({
          movementDriver: bbDiag.movementDriver,
          singleLeg: bbDiag.singleLeg,
          lrVerdicts: bbDiag.lrVerdicts,
          lrTopUp: bbDiag.lrTopUp,
          returnAction: bbDiag.returnAction,
          returnStage: bbDiag.returnStage,
          // D1–D5: плечо/шарнир/YBT/лопатка/видео/замены (движок санитизирует, мусор — тихо)
          shoulder: bbDiag.shoulder,
          hinge: bbDiag.hinge,
          ybt: bbDiag.ybt,
          scapPain: bbDiag.scapPain,
          videoStandard: bbDiag.videoStandard,
          driverSubs: bbDiag.driverSubs,
          asymPriority: bbDiag.asymPriority,
          // PRO-CORR: детали коррекций библиотеки → бит «коррекция:» + персист movementExtra
          correctiveDetail: bbDiag.correctiveDetail,
        });
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
        // LEGACY-канал L/R (старый мост): новые payloads движения этих полей не несут
        // (их закрывает явная D1-чистка ниже); оставлено для чтения сохранённых payload'ов.
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
        // LEGACY-канал возврата (старый мост): returnAction/returnStage новыми payloads не шлются.
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
        // D1: движения ББ-диагностики — персист (инфо для будущих раундов/экспорта) + честная
        // строка в rationale УЖЕ собранного плана (паттерн labDelta: дедуп по строке; сеты/веса/
        // упражнения не трогаются — решение §9.2 «A-инфо / B-сборка»).
        if (diagExtras.persist.movementDriver) {
          try { localStorage.setItem('he_bb_last_movement_driver', JSON.stringify(diagExtras.persist.movementDriver)); } catch {}
        }
        if (diagExtras.persist.singleLeg) {
          try { localStorage.setItem('he_bb_last_single_leg', JSON.stringify(diagExtras.persist.singleLeg)); } catch {}
        }
        // D1–D5: экстра движений (плечо/шарнир/YBT/замены) — инфо-персист для экспорта/будущих раундов.
        if (diagExtras.persist.movementExtra && Object.keys(diagExtras.persist.movementExtra).length) {
          try { localStorage.setItem('he_bb_last_movement_extra', JSON.stringify(diagExtras.persist.movementExtra)); } catch {}
        }
        if (diagExtras.bits.length) {
          const movementLine = `🧭 Скрининг движений: ${diagExtras.bits.join(' · ')}`;
          try {
            setBuiltPlan((prev) => {
              if (!prev || !Array.isArray((prev as { weeks?: unknown }).weeks)) return prev;
              const rat = Array.isArray((prev as { rationale?: unknown }).rationale)
                ? (prev as { rationale: string[] }).rationale
                : [];
              if (rat.some((r) => r === movementLine)) return prev;
              return { ...prev, rationale: [...rat, movementLine] };
            });
          } catch { /* план обновится при следующей сборке (build-time ветка) */ }
        }
        // D1: явная stale-чистка L/R-канала. Маркер канала — ключ lrVerdicts в payload
        // (BB-хаб шлёт всегда; WL/SM/Arm-хабы не шлют → их мосты ничего не сносят). Новый
        // мост движения lrTopUp/returnAction НЕ шлёт — без чистки старые значения висели бы на сборках.
        if (diagExtras.clean.lrTopUp) {
          setLrTopUp({});
          try { localStorage.removeItem('he_bb_lr_topup'); } catch {}
          pro2parts.push('L/R-добивка снята — канал закрыт');
        }
        if (diagExtras.clean.returnAction) {
          setReturnAction(null);
          try { localStorage.removeItem('he_bb_return_action'); } catch {}
          pro2parts.push('возврат снят — канал закрыт');
        }
        // 3.9: ранее неиспользуемые payload-поля диагностики сводим в одну строку моста —
        // ничего не приходит «в никуда» (payload↔потребитель 1:1, без плановых изменений).
        const diagBits: string[] = [...diagExtras.bits];
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
    };
    const unsub = subscribePlannerApply((p) => {
      try { routeApply(p); } catch (e) { console.warn('[BB-auto] planner-bridge:', e); }
    });
    // Pending: payload, отправленный до монтирования ББ-авто (библиотека/кардио/хаб).
    // Берём только свежий (≤5 мин) и только ББ-релевантные kinds; после обработки — чистим,
    // чтобы он не «жил вечно» и не подхватывался другими экранами.
    try {
      const pending = getPlannerApply();
      if (pending && Date.now() - (pending.ts ?? 0) < 5 * 60_000) {
        const isPl = pending.source === 'pl-auto';
        const kindOk = pending.kind === 'program' || pending.kind === 'weakpoints' || pending.kind === 'pm';
        if (!isPl && kindOk) { routeApply(pending); clearPlannerApply(); }
      }
    } catch { /* ignore */ }
    return () => { unsub(); };
  }, []);

  // Применение готовой программы из библиотеки (единственный путь: FullProgram → programToBBPlan faithful/adapt).
  // Все программы (FULL_PROGRAM_LIBRARY + WOMENS + CUSTOM_PROGRAMS + cycle-bb-*) идут через один путь.
  const applyProgramToBb = useCallback((program: FullProgram) => {
    setBbAdaptMode('faithful');
    setCustomProgram(program);
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
  // Авто-синхронизация сплита (аудит 2026-09): раньше once-set `selectedSplitId`
  // навсегда «прилипал» — смена числа дней/уровня/фармы оставляла неподходящий
  // сплит (жалоба: «на 6 днях рекомендует Верх/Низ с 18 упражнениями»).
  // Логика: пока пользователь не выбрал сплит вручную — следуем рекомендации;
  // после ручного выбора автоматически переключаем ТОЛЬКО при жёстком
  // несоответствии (дни/уровень/пол), иначе оставляем (осознанный выбор).
  const splitFitKeyRef = useRef<string>('');
  useEffect(() => {
    if (!bestSplit) return;
    const key = `${bbDays}|${bbLevel}|${bbGoal}|${peds.join(',')}`;
    const keyChanged = splitFitKeyRef.current !== '' && splitFitKeyRef.current !== key;
    splitFitKeyRef.current = key;
    const hard = selectedSplitId
      ? splitFitWarnings({ level: bbLevel, goal: bbGoal as any, daysPerWeek: bbDays, peds, sex: linked.profile?.settings?.personal?.sex }, selectedSplitId)
      : [];
    const shouldSync = !selectedSplitId || (!splitTouched.current ? keyChanged : hard.length > 0);
    if (shouldSync && selectedSplitId !== bestSplit.pattern.id) {
      setSelectedSplitId(bestSplit.pattern.id);
      if (selectedSplitId) flash(`🔄 Сплит обновлён под параметры: «${bestSplit.pattern.name}»`);
    }
  }, [bestSplit, selectedSplitId, bbDays, bbLevel, bbGoal, peds, linked.profile?.settings?.personal?.sex]);

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
        // Акцент = цели специализации ИЛИ слабые группы (аудит 2026-09):
        // не-целевые мышцы на MV-поддержании не штрафуются за «недогруз».
        specTargets: specTargets.length ? specTargets : (weakPoints.length ? weakPoints : undefined),
        acwrRatio: acwrData?.ratio ?? null,
        monotony: srpeMonotony?.monotony ?? null,
        hasDiary: acwrData != null,
      });
    } catch { return null; }
  }, [builtPlan, bbLevel, specTargets, weakPoints, acwrData, srpeMonotony]);
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

  const bbCyclesList = useMemo(
    () => getCyclesByDirection('bodybuilding').filter(c => !c.meta.id.startsWith('embed-')),
    [],
  );

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
            labMrvMultiplier: labMultOverride ?? labAdjust.mrvMultiplier,
            labWarnings: labAdjust.warnings,
            labIntensityNote: labAdjust.intensityNote,
            // Паритет с generic: целевой % жира / женский цикл / ручной оверрайд восстановления
            // (множители объёма adapt-пути; без данных = 1.0 байт-в-байт).
            targetBodyFat,
            cycleDay,
            recoveryMultOverride: recoveryOverride ?? undefined,
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
          // VBT-вход (лучший/последний м/с) — режет объём/RIR по порогу потери (канон bb-vbt).
          // Ранее поля вводились, но в сборку не попадали (жили только в локальной подсказке).
          vbt: (() => {
            const b = Number(vbtInput.best), l = Number(vbtInput.last);
            if (!Number.isFinite(b) || !Number.isFinite(l) || b <= 0 || l <= 0) return undefined;
            return { lift: vbtInput.lift, bestVelocity: b, lastVelocity: l };
          })(),
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

    // Шаг 2 («Фаза MGF/IGF1»): program-путь не звал
    // recommendPEDMethodology/applyPEDMethodologyToPlan (они жили только в
    // bb-builder) — оживляем PED-слой для режима источника (adapt): инсулиновое
    // окно, MGF-акценты, peri-WO. Только пометки/rationale (объём не меняется);
    // joint-guard-строка пропускается — program-путь axial-замены не делает.
    if (planMode === 'programs' && bbAdaptMode === 'adapt' && peds.length > 0) {
      try {
        const wkPhases = (plan.weeks || []).map((w: any) => w?.phase);
        const schemePhase: 'peaking' | 'intensification' | 'accumulation' = wkPhases.includes('peaking')
          ? 'peaking' : wkPhases.includes('intensification') ? 'intensification' : 'accumulation';
        const meth = recommendPEDMethodology({
          peds: peds as any, pedDoses, level: bbLevel, goal: bbGoal,
          focus: bbTrainingFocus, targetMuscles: specTargets,
          totalWeeks: bbWeeks, phaseOverride: pedPhaseOverride, phase: schemePhase,
        });
        plan = applyPEDMethodologyToPlan(plan, meth, { skipGuardNote: true });
      } catch { /* PED-слой информационный — сборку не роняем */ }
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
      // Лимит упражнений сессии — из движка (уровень/стаж/курс/объёмный режим), не хардкод 10
      // (движок даёт 15-20 для advanced/enhanced — добивки больше не глохнут).
      const maxExForInsert = (() => {
        try {
          return sessionLimitsFor({ level: bbLevel as any, trainingYears: bbTrainingYears, onCourse: peds.length > 0, trainingVolumeMode: trainingVolumeMode as any } as any).maxExercises;
        } catch { return 10; }
      })();
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
              const canAdd = targetSession.exercises.length < maxExForInsert;
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
            if (!target || !Array.isArray(target.exercises) || target.exercises.length >= maxExForInsert) continue;
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
      : planMode === 'programs' ? `Программа: ${customProgram?.name || selectedProgramId || selectedCycleId}` : 'Generic-сплит';
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
          // Канон id: UI-легаси (myo_rep/21s) → движковые (myo_reps/twenty_ones).
          if (edit.technique && edit.technique !== 'none') {
            const canonTech = canonTechniqueId(edit.technique) || edit.technique;
            (edited as any).technique = canonTech;
            // Потребители читают технику последнего рабочего сета (bb-technique-display,
            // bb-quality-weekly, bb-report, SessionPlayer targetSets) — пишем и туда.
            if (Array.isArray(edited.workSets) && edited.workSets.length > 0) {
              (edited.workSets[edited.workSets.length - 1] as any).technique = canonTech;
            }
          } else if (edit.technique === 'none') {
            delete (edited as any).technique;
            if (Array.isArray(edited.workSets) && edited.workSets.length > 0) {
              delete (edited.workSets[edited.workSets.length - 1] as any).technique;
            }
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
        injuries,
        mobilityRestrictions,
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
    const saveSafety = calculatePlanSafetyScore(exportPlan, { acwrRatio: calculateACWR(), injuries, mobilityRestrictions });
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
            programId: selectedProgramId || undefined,
            cycleId: planMode === 'programs' ? selectedCycleId : undefined,
            abPatternRotation: abRotation === true ? true : undefined,
            packingV2: packingV2 === true ? true : undefined,
            // Аудит «дубли шаг 1-2»: сохраняем остальные настройки шага 1-2 (дефолты — undefined,
            // паттерн как у abPatternRotation/packingV2).
            proPreset: proPreset !== 'none' ? proPreset : undefined,
            trainingVolumeMode: trainingVolumeMode === 'high' ? 'high' : undefined,
            volumeScheme: volumeScheme !== 'standard' ? volumeScheme : undefined,
            supersetMode: supersetMode !== 'none' ? supersetMode : undefined,
            intensityLevel: intensityLevel !== 'moderate' ? intensityLevel : undefined,
            rotationMode: rotationMode !== 'variety' ? rotationMode : undefined,
            calorieSurplus: calorieSurplus !== 0 ? calorieSurplus : undefined,
            eccentricMult: eccentricMult !== 1 ? eccentricMult : undefined,
            bfrMode: bfrMode === true ? true : undefined,
            blastCruiseEnabled: blastCruiseEnabled === true ? true : undefined,
            blastWeeks: blastWeeks !== 8 ? blastWeeks : undefined,
            cruiseWeeks: cruiseWeeks !== 4 ? cruiseWeeks : undefined,
            platePreset: platePreset !== 'standard' ? platePreset : undefined,
            targetBodyFat: targetBodyFat != null ? targetBodyFat : undefined,
            cycleDay: cycleDay != null ? cycleDay : undefined,
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
    if (v.params.programId) {
      setSelectedProgramId(v.params.programId);
      const sourceProgram = bbLibraryPrograms.find(program => program.id === v.params.programId);
      if (sourceProgram) {
        setCustomProgram(sourceProgram);
      }
    }
    if (v.params.cycleId) setSelectedCycleId(v.params.cycleId);
    setAbRotation(v.params.abPatternRotation === true);
    setPackingV2(v.params.packingV2 === true);
    // Аудит «дубли шаг 1-2»: недостающие настройки варианта (раньше терялись при загрузке).
    // Legacy-варианты без полей — текущие настройки не трогаем (только явно сохранённое).
    const vp = v.params as any;
    if (vp.proPreset) setProPreset(vp.proPreset);
    if (vp.trainingVolumeMode) setTrainingVolumeMode(vp.trainingVolumeMode);
    if (vp.volumeScheme) setVolumeScheme(vp.volumeScheme);
    if (vp.supersetMode) setSupersetMode(vp.supersetMode);
    if (vp.intensityLevel) setIntensityLevel(vp.intensityLevel);
    if (vp.rotationMode) setRotationMode(vp.rotationMode);
    if (Number.isFinite(vp.calorieSurplus)) setCalorieSurplus(Number(vp.calorieSurplus));
    if (Number.isFinite(vp.eccentricMult)) setEccentricMult(Number(vp.eccentricMult));
    if (vp.bfrMode != null) setBfrMode(Boolean(vp.bfrMode));
    if (vp.blastCruiseEnabled != null) setBlastCruiseEnabled(Boolean(vp.blastCruiseEnabled));
    if (Number.isFinite(vp.blastWeeks)) setBlastWeeks(Number(vp.blastWeeks));
    if (Number.isFinite(vp.cruiseWeeks)) setCruiseWeeks(Number(vp.cruiseWeeks));
    if (vp.platePreset) setPlatePreset(vp.platePreset);
    if (Number.isFinite(vp.targetBodyFat)) setTargetBodyFat(Number(vp.targetBodyFat));
    if (Number.isFinite(vp.cycleDay)) setCycleDay(Number(vp.cycleDay));
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
          // §5.2: подмышка/паттерн/пояснение — колонками (раньше подгруппа склеивалась с мышцей, пояснения не было)
          const expl = bbExerciseExplanation(e);
          const subLabel = sub || expl.subgroup || '';
          return `<tr><td style="padding:4px 8px;border:1px solid #ddd">${esc(e.exerciseName || e.name || '')}</td><td style="padding:4px 8px;border:1px solid #ddd">${esc(e.muscle)}</td><td style="padding:4px 8px;border:1px solid #ddd">${esc(subLabel)}</td><td style="padding:4px 8px;border:1px solid #ddd">${esc(expl.pattern)}</td><td style="padding:4px 8px;border:1px solid #ddd">${e.sets}</td><td style="padding:4px 8px;border:1px solid #ddd">${esc(sets)}</td><td style="padding:4px 8px;border:1px solid #ddd">${esc([expl.why, expl.how].filter(Boolean).join(' · '))}</td><td style="padding:4px 8px;border:1px solid #ddd">${esc(feat ? '💥 ' + feat : '')}${esc(e.comment || '')}</td></tr>`;
        }).join('');
        const restNote = s.exercises.length === 0 ? `<p style="font-size:11px;color:#888;margin:6px 0">😴 Полный отдых — позирование, растяжка, сон 8–9 ч.${(s as any).comment ? ' ' + esc((s as any).comment) : ''}</p>` : '';
        return `<h3 style="margin:12px 0 4px">День ${si + 1}${s.sessionTag ? ' — ' + esc(sessionTagLabel(s.sessionTag)) : ''}${(s as any).peakWeekTraining ? ' — 🎭 памп' : ''}${(s as any).peakWeekRest ? ' — 😴 отдых' : ''}</h3>${restNote}<table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="background:#f0f0f0"><th style="padding:4px 8px;border:1px solid #ddd;text-align:left">Упражнение</th><th style="padding:4px 8px;border:1px solid #ddd;text-align:left">Мышца</th><th style="padding:4px 8px;border:1px solid #ddd;text-align:left">Подмышка</th><th style="padding:4px 8px;border:1px solid #ddd;text-align:left">Паттерн</th><th style="padding:4px 8px;border:1px solid #ddd">Сеты</th><th style="padding:4px 8px;border:1px solid #ddd;text-align:left">Вес/Reps</th><th style="padding:4px 8px;border:1px solid #ddd;text-align:left">Пояснение</th><th style="padding:4px 8px;border:1px solid #ddd;text-align:left">Коммент</th></tr></thead><tbody>${exsHtml}</tbody></table>`;
      }).join('');
      const peakNote = (wk as any).peakWeek === true ? ` — 🎭 ПИК-НЕДЕЛЯ (тапер ББ)` : '';
      const prepNote = (wk as any).prepProtocol ? `<p style="font-size:10px;color:#888;margin:2px 0">${esc((wk as any).prepProtocol)}</p>` : '';
      const phaseRu = BB_PHASE_LABEL_RU[String((wk as any).phase || '')] || esc((wk as any).phase || '');
      const phaseColor = BB_PHASE_COLOR[String((wk as any).phase || '')] || '#444';
      return `<h2 style="margin:16px 0 6px;color:${phaseColor};border-left:4px solid ${phaseColor};padding-left:8px">Неделя ${wk.week} (${phaseRu}${wk.deload ? ' — DELOAD' : ''})${peakNote}</h2>${prepNote}${sessionsHtml}`;
    }).join('');
    const rationaleHtml = (plan.rationale || []).map(r => `<div style="font-size:10px;color:#666;margin:2px 0">${esc(r)}</div>`).join('');
    // П3: персист движений в печать (пусто — блока нет, печать байт-в-байт; сборка не тронута).
    let movementHtml = '';
    try { movementHtml = buildBbMovementPrintBlock(); } catch { /* тихо */ }
    // Фаза 4.24: heatmap «мышца × неделя» в печати.
    const hm = buildBBMuscleHeatmap(plan);
    const hmWeeks = [...new Set(hm.map(h => h.week))].sort((a, b) => a - b);
    const hmMuscles = [...new Set(hm.map(h => h.muscle))];
    const hmColor: Record<string, string> = { below_mev: '#f87171', mev_mav: '#22c55e', above_mav: '#f59e0b', over_mrv: '#ef4444', none: '#e5e7eb' };
    const hmHtml = hmMuscles.length ? `<h2 style="font-size:14px;margin:16px 0 4px">🧬 Heatmap «мышца × неделя»</h2><table style="border-collapse:collapse;font-size:10px"><tr><th style="border:1px solid #ddd;padding:3px 6px;text-align:left">Мышца</th>${hmWeeks.map(ww => `<th style="border:1px solid #ddd;padding:3px 6px">Нед ${ww}</th>`).join('')}</tr>${hmMuscles.map(m => `<tr><td style="border:1px solid #ddd;padding:3px 6px">${esc(m)}</td>${hmWeeks.map(ww => { const c = hm.find(h => h.muscle === m && h.week === ww); return `<td style="border:1px solid #ddd;text-align:center;background:${c ? hmColor[c.status] : '#fafafa'}">${c ? c.sets : ''}</td>`; }).join('')}</tr>`).join('')}</table>` : '';
    w.document.write(`<!DOCTYPE html><html><head><title>${esc(plan.pattern?.name || 'BB-план')}</title><style>@media print{body{font-size:10px}h2{page-break-before:auto}}</style></head><body style="font-family:Arial,sans-serif;max-width:900px;margin:0 auto;padding:20px"><h1>${esc(plan.pattern?.name || 'BB-план')} — ${plan.weeks.length} нед</h1>${rationaleHtml}${movementHtml}${weeksHtml}${hmHtml}<script>window.print()</script></body></html>`);
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
      // Калораж/белок — от веса и цели профиля (раньше хардкод 2800/180 без веса/пола/цели);
      // без веса в профиле — прежний оценочный фолбэк.
      const pw = Number(linked.profile?.settings?.personal?.weight) || 0;
      const kcalCoef: Record<string, number> = { mass: 37, strength_mass: 36, cut: 28, recomp: 31, maintenance: 31 };
      const proteinCoef: Record<string, number> = { mass: 2.0, strength_mass: 2.0, cut: 2.2, recomp: 2.1, maintenance: 1.8 };
      const kcal = pw > 0
        ? Math.round(pw * (kcalCoef[bbGoal] || 33))
        : Math.round((plan as any).mrvMultiplier && (plan as any).mrvMultiplier >= 1.3 ? 2800 : 2500 + trainDays.length * 150);
      const proteinG = pw > 0
        ? Math.round(pw * (proteinCoef[bbGoal] || 2.0))
        : (weeklySets > 0 ? 180 : 160);
      applyToPlanner({
        kind: 'bb_nutrition',
        label: `ББ-план → питание (${trainDays.length} трен-дня, ~${weeklySets} сетов/нед)`,
        data: { kcal, proteinG, trainDays, weeklySets, splitId: plan.pattern?.id, weightKg: pw > 0 ? pw : undefined, sex: linked.profile?.settings?.personal?.sex, goal: bbGoal },
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
      const safety = calculatePlanSafetyScore(plan, { acwrRatio: acwrData?.ratio, injuries, mobilityRestrictions });

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
    const rows: string[] = [['Неделя', 'День', 'Упражнение', 'Мышца', 'Подмышка', 'Роль', 'Сет', 'Повторы', 'Вес(кг)', 'RIR', 'Темп', 'Отдых(с)', 'Паттерн', 'Ключи техники', 'Растяжение', 'Пиковое сокращение', 'Ошибки', 'Комментарий', 'Техника/Схема', 'Пояснение'].join(',')];    for (const wk of plan.weeks) {
      for (let si = 0; si < wk.sessions.length; si++) {
        const s = wk.sessions[si];
        for (const ex of s.exercises) {
          const ws = ex.workSets || [];
          const chain = techniqueChainParts(ex);
          const feat = [...exerciseFeatureBadges(ex).map(b => b.label), ...(chain ? [chain.label + ': ' + chain.parts.join(' -> ')] : [])].join('; ');
          // §5.2: подмышка/пояснение — отдельными колонками (паттерн уже был)
          const expl = bbExerciseExplanation(ex);
          for (let i = 0; i < (ws.length || ex.sets); i++) {
            const set = ws[i] || { reps: ex.repsRange?.[0] || 10, weight: 0, rir: ex.rir };
            const esc = (v: any) => `"${String(v || '').replace(/"/g, '""')}"`;
            rows.push([
              wk.week, si + 1, esc(ex.exerciseName || ex.name), esc(ex.muscle), esc(expl.subgroup),
              ex.role, i + 1, set.reps, set.weight, set.rir,
              esc(ex.tempoSpec || ''), ex.restSeconds || '',
              esc(ex.executionProfile?.pattern || expl.pattern),
              esc(ex.executionProfile?.cues.join('; ') || ''),
              esc(ex.executionProfile?.stretch || ''),
              esc(ex.executionProfile?.peak || ''),
              esc(ex.executionProfile?.mistakes.join('; ') || ''),
              esc(ex.comment || ''),
              esc(feat),
              esc([expl.why, expl.how].filter(Boolean).join(' · ')),
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
  // Единая нумерация шагов во всех режимах (аудит 2026-09: в «Программах» номера
  // прыгали 1-2-3-4-5-6, в «Сплите» 1-2-3-4-5-6-7 — пользователь терял ориентацию).
  // Сплит в режиме программ пропускается, поэтому его номер остаётся пропущенным.
  const stepLabels: Record<Step,string> = { params:'1 Параметры', ped:'2 PED+Вес', split:'3 Сплит', plan:'4 План', weights:'5 Реальные веса', quality:'6 Нагрузка и качество', adjust:'7 Коррекция', contest:'🏁 Contest prep', annual:'🗓 Годовой план', tools:'🔧 Инструменты' };
  // Причина блокировки шага — вместо молчаливого «не нажимается».
  const stepLockReason = (s: Step): string | null => {
    if (['plan','weights','quality','adjust'].includes(s) && !builtPlan) return 'Сначала соберите план (шаг «4 План» станет доступен после сборки)';
    if (s === 'contest' && !builtPlan) return 'Contest prep доступен после сборки плана';
    return null;
  };
  const renderStepNav = () => {
    const groups: Record<string, string[]> = planMode === 'programs'
      ? { 'ПАРАМЕТРЫ': ['params','ped'], 'ПЛАН': ['plan','weights','quality','adjust'], 'ЦИКЛ': ['contest','annual','tools'] }
      : { 'ПАРАМЕТРЫ': ['params','ped','split'], 'ПЛАН': ['plan','weights','quality','adjust'], 'ЦИКЛ': ['contest','annual','tools'] };
    const groupEndKeys = new Set(Object.values(groups).map(arr => (arr as string[])[(arr as string[]).length - 1]).filter(Boolean) as string[]);
    return (
      // Без backdrop-filter: blur(12px) — он давал заметные лаги при переключении
      // шагов на телефоне (жалоба «выбор шагов подтупливает»). Плотный фон вместо стекла.
      <div data-bb="step-nav" style={{ background: 'rgba(24,24,27,0.92)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '5px 6px', marginBottom: 8, display: 'flex', gap: 4, overflowX: 'auto' as const, scrollbarWidth: 'none' as const, WebkitOverflowScrolling: 'touch' as const, alignItems: 'center' }}>
        {stepList.map(s => {
          const active = step === s;
          const lockReason = stepLockReason(s);
          const disabled = lockReason != null;
          return (
            <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 as const }}>
              <button
                disabled={disabled}
                aria-current={active ? 'step' : undefined}
                title={disabled ? lockReason! : undefined}
                onClick={() => {
                  if (disabled) { flash(`🔒 ${lockReason}`); return; }
                  if (s === 'annual') { goAnnual(); return; }
                  setStep(s);
                }}
                style={{ ...STEP_PILL(active), flexShrink: 0 as const, opacity: disabled ? 0.45 : 1 }}
              >{stepLabels[s]}</button>
              {groupEndKeys.has(s) && s !== stepList[stepList.length - 1] && <span style={{ width: 1, height: 18, background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.08), transparent)', flexShrink: 0 as const, margin: '0 2px', alignSelf: 'center' }} />}
            </span>
          );
        })}
      </div>
    );
  };

  // Смена шага — наверх и активная пилюля в видимую зону (аудит 2026-09:
  // «выбор шагов подтупливает» — после перехода экран оставался в середине
  // предыдущего шага, а активная пилюля уезжала за край ленты).
  useEffect(() => {
    try {
      const scroller = document.querySelector('.screen.training-screen') as HTMLElement | null;
      if (scroller && typeof scroller.scrollTo === 'function') scroller.scrollTo({ top: 0, behavior: 'smooth' });
      const nav = document.querySelector('[data-bb="step-nav"]') as HTMLElement | null;
      const activeBtn = nav?.querySelector('button[aria-current="step"]') as HTMLElement | null;
      if (activeBtn && typeof activeBtn.scrollIntoView === 'function') {
        activeBtn.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
      }
    } catch { /* среда без DOM (SSR/jsdom) — не критично */ }
  }, [step, planMode]);

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
    setBbWeekSel(1);
    setExerciseEdits({});
    setEditMode(null);
    setSubTarget(null);
    setExSwapModal(null);
    setShowCompare(false);
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
      <BbCard
        icon="🎯" accent="#f59e0b"
        title="Отстающие мышцы (специализация, 1-2)"
        desc="Блоки по 3–6 недель: цели получают акцент (объём и приоритет), доноры перераспределяются. Пусто — план без акцентов."
      >
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
      </BbCard>
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
      daysPerWeek={bbDays}
      isBuilding={isBuilding}
      onBuild={buildBb}
      onBack={() => setStep('ped')}
    />
  );

  const renderPlanWithComments = () => (
    <>
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
      bbTrainingYears={bbTrainingYears}
      onCourse={peds.length > 0}
      trainingVolumeMode={trainingVolumeMode === 'high' ? 'high' : 'standard'}
      setSubTarget={setSubTarget}
      handleSendToExecution={handleSendToExecution}
      setWeightEntries={setWeightEntries}
      setWeightsApplied={setWeightsApplied}
      setStep={setStep}
      actionRow={renderActionRow(false)}
    />
    {freqOptResult && (
      <div data-bb="freq-opt" style={{ marginTop: 10, padding: '10px 12px', borderRadius: 12, background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)' }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#60a5fa', marginBottom: 6 }}>🔧 Оптимизация частоты по мышцам (по дневнику)</div>
        {freqOptResult.recommendations.length === 0
          ? <div style={{ fontSize: 11, color: '#fff' }}>✅ Частота по мышцам оптимальна — ACWR в норме, размер и восстановление учтены.</div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {freqOptResult.recommendations.slice(0, 6).map(r => (
                <div key={r.muscle} style={{ fontSize: 11, color: '#fff' }}>
                  {r.recommendedFrequency > r.currentFrequency ? '↑ повысить' : '↓ снизить'} «{muscleLabel(r.muscle) || r.muscle}»: {r.currentFrequency}→{r.recommendedFrequency}×/нед
                  {r.acwr != null ? ` · ACWR ${r.acwr.toFixed(2)}` : ''}{r.e1rmTrend != null ? ` · e1RM ${r.e1rmTrend > 0 ? '+' : ''}${r.e1rmTrend}%` : ''}
                </div>
              ))}
              <div style={{ fontSize: 10, color: '#fff', opacity: 0.75 }}>Справочно — в сборку не вносится (учтите вручную или через сплит).</div>
            </div>}
      </div>
    )}
    </>
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
    // 4.3: общий снимок plan-basis для под-секций train-load блока (вместо 20+ props каждому).
    const qualityLoadCtx: BbQualityLoadCtx = {
      quality, builtPlan, metrics, ranked, bestSplit, bbLevel, bbGoal, bbTrainingFocus, bbMethodology,
      bbVolGoal, trainingVolumeMode, loadStrategy, pedAdapt, peds, weakPoints, injuries,
      mobilityRestrictions, bbEquipment, specTargets, bbDays, bbTrainingYears, specializationMode, ratio,
    };
    return (
      <div>
        {/* 🛡 Единое качество — агрегат validation/balance/rotation/safety (Epic F) */}
        <BbQualityUnifiedCard
          qualityReport={qualityReport}
          builtPlan={builtPlan}
          vbtInput={vbtInput}
          setVbtInput={setVbtInput}
          readiness={linked?.readiness?.recovery ?? null}
          bbQualityV2={bbQualityV2}
          todayBadge={todayBadge}
          v2Context={{ level: bbLevel, goal: bbGoal, focus: bbTrainingFocus, accent: specTargets.length ? specTargets : weakPoints, peds }}
        />
        {/* 🧠 Логика построения плана — вынесена первой в Шаге 5 */}
        <BbQualityPlanLogicCard
          ranked={ranked}
          builtPlan={builtPlan}
          bbLevel={bbLevel}
          bbTrainingYears={bbTrainingYears}
          bbGoal={bbGoal}
          bbTrainingFocus={bbTrainingFocus}
          bbMethodology={bbMethodology}
          bbVolGoal={bbVolGoal}
          trainingVolumeMode={trainingVolumeMode}
          loadStrategy={loadStrategy}
          deloadType={deloadType}
          dupMode={dupMode}
          supersetMode={supersetMode}
          volumeScheme={volumeScheme}
          bbDays={bbDays}
          bbWeeks={bbWeeks}
          weakPoints={weakPoints}
          specTargets={specTargets}
          injuries={injuries}
          mobilityRestrictions={mobilityRestrictions}
          bbEquipment={bbEquipment}
          pedAdapt={pedAdapt}
          peds={peds}
          bfrMode={bfrMode}
          blastCruiseEnabled={blastCruiseEnabled}
          blastWeeks={blastWeeks}
          cruiseWeeks={cruiseWeeks}
          autoDeload={autoDeload}
          rotationMode={rotationMode}
          fewerCompound={fewerCompound}
          allowStrengthLifts={allowStrengthLifts}
          avoidAxialLoadUi={avoidAxialLoadUi}
          eccentricMult={eccentricMult}
          intensityTech={intensityTech}
          abRotation={abRotation}
          packingV2={packingV2}
        />
        <BbQualitySafetySection
          safetyScore={safetyScore}
          generalSafetyLoadOpen={generalSafetyLoadOpen}
          setGeneralSafetyLoadOpen={setGeneralSafetyLoadOpen}
          safetyOpen={safetyOpen}
          setSafetyOpen={setSafetyOpen}
          safetyFactorsOpen={safetyFactorsOpen}
          setSafetyFactorsOpen={setSafetyFactorsOpen}
          jointAnalysisOpen={jointAnalysisOpen}
          setJointAnalysisOpen={setJointAnalysisOpen}
          safetyPreventionOpen={safetyPreventionOpen}
          setSafetyPreventionOpen={setSafetyPreventionOpen}
          safetyDistributionOpen={safetyDistributionOpen}
          setSafetyDistributionOpen={setSafetyDistributionOpen}
          safetyConclusionOpen={safetyConclusionOpen}
          setSafetyConclusionOpen={setSafetyConclusionOpen}
          pedAdapt={pedAdapt}
        />
        <div style={{ ...CARD, padding:0, overflow:'hidden', marginBottom:8, border:'1px solid rgba(0,230,138,0.22)', background:'rgba(6,22,18,0.32)' }}>
          <button type="button" onClick={() => setQualityOpen(v => !v)} aria-expanded={qualityOpen} style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 14px', cursor:'pointer', background:'linear-gradient(135deg, rgba(0,230,138,0.16), rgba(16,185,129,0.06))', border:'none', borderBottom: qualityOpen ? '1px solid rgba(255,255,255,0.06)' : 'none', textAlign:'left' }}>
            <span style={{ fontSize:14, fontWeight:900, color:'#fff' }}>🏋️ Тренировочная нагрузка плана</span>
            <span style={{ width:32, height:32, borderRadius:8, display:'inline-flex', alignItems:'center', justifyContent:'center', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', color:'#fff', fontSize:13, transform: qualityOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition:'transform 0.2s' }}>▼</span>
          </button>
        </div>
        <div style={{ display: qualityOpen ? 'block' : 'none' }}>
        <BbQualityLoadOverview
          ctx={qualityLoadCtx}
          qualityWeek={qualityWeek}
          setQualityWeek={setQualityWeek}
          bbWeekSel={bbWeekSel}
          setBbWeekSel={setBbWeekSel}
          autoDeload={autoDeload}
          deloadType={deloadType}
        />
        <BbQualityLoadVolume
          ctx={qualityLoadCtx}
          qualityVolumeOpen={qualityVolumeOpen}
          setQualityVolumeOpen={setQualityVolumeOpen}
          bbWeekSel={bbWeekSel}
          setBbWeekSel={setBbWeekSel}
        />
        <BbQualityLoadChecks ctx={qualityLoadCtx} />
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
    // 4.3 остаток-2: снимок внешних привязок шага Contest Prep для под-секций (вместо 80+ props).
    const contestCtx: BbContestPrepCtx = {
      PREP_CHECKIN_ITEMS, adaptiveTaper, assembleContestPrep, buildContestPrepConfig, builtPlan, setBuiltPlan, bbWorkMax,
      contestWizard, currentPrepWeek, expYearsForPrep,
      flash, handleApplyAdaptiveTaper, handleApplyWeightAdjustment, handleExportCheckinsCsv, handleExportPrepIcs, handleExportPrepJson,
      handleExportWeeklyReport, handleExtendPrep, handlePrintPrepSummary, handleRunTestPeakWeek, handleSaveWeekCheckin, handleShiftPrepShowDate,
      lastTest, liveFull,
      liveVisual, liveWater, peakSpec, peakWeekCategory, peds,
      phaseNow, postLogCycle, postLogHunger, postLogSleep, postLogStrength, postLogTick,
      postLogWeek, postLogWeight, prepApplied, prepBasePlan, prepBusy, prepCarbMode,
      prepCheckin, prepCheckinDone, prepCompetitions, prepConfirmedManip, prepContra, prepContraExtra,
      prepCreatineStop, prepMainCompetitionId, prepPlan, prepPreferLowFiber, prepShowDate, prepSodiumMode,
      prepTaperWeeks, prepTrainingProtocol, prepVolumeMode, prepWaterMode, prepWeeks,
      readiness, recarb, savePrepToProfile, setContestWizard, setLiveFull, setLiveVisual,
      setLiveWater, setPeakSpec, setPeakWeekCategory, setPostLogCycle, setPostLogHunger, setPostLogSleep,
      setPostLogStrength, setPostLogTick, setPostLogWeek, setPostLogWeight, setPrepCarbMode, setPrepCompetitions,
      setPrepConfirmedManip, setPrepContraExtra, setPrepCreatineStop, setPrepMainCompetitionId, setPrepPlan, setPrepPreferLowFiber,
      setPrepSodiumMode, setPrepTaperWeeks, setPrepTrainingProtocol, setPrepVolumeMode, setPrepWaterMode, setRecarb,
      setShowCheck, setStep, setTestRatings, setTestWeightDelta, setWkNote, setWkPsyche,
      setWkSessions, setWkSleep, setWkWaist, setWkWeek, setWkWeight, showCheck,
      spillRisk, step, strengthDowns, testRatings, testWeightDelta, today,
      togglePrepCheckin, weekRefs, weeklyLog, weightAdvice, wkNote, wkPsyche,
      wkSessions, wkSleep, wkWaist, wkWeek, wkWeight, wkCycle, setWkCycle, wkSteps, setWkSteps,
    };
    return (
      <div>
        <BbContestPrepParams ctx={contestCtx} />

        {/* Результат — wizard 5 Preview */}
        {prepPlan && (
          <div style={{ display: contestWizard===5 ? 'block' : 'none', marginTop:10, padding:12, borderRadius:12, background:'rgba(236,72,153,0.05)', border:'1px solid rgba(236,72,153,0.2)' }}>
            <BbContestPrepPreview ctx={contestCtx} />
            <BbContestPrepTrialSafety ctx={contestCtx} />
            <BbContestPrepPost ctx={contestCtx} />
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
      const pcCfg = buildPrepCycleCfg();
      // PRO-3 Э4: trial едет в Prep-цикл (доза загрузки + ссылка на испытанный протокол),
      // иначе сохранение из Prep-цикла теряло trial-данные (питание шло по среднему коридору).
      const pcTrialDose = lastTest ? trialCarbDoseGPerKg(lastTest, pcCfg.category, pcCfg.sex) : undefined;
      const res = buildPrepCycle(pcCfg, { carbDoseGPerKg: pcTrialDose, testPeakWeekId: lastTest?.id });
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
      const seasonCfg = buildPrepSeasonCfg();
      const seasonDose = lastTest ? trialCarbDoseGPerKg(lastTest, seasonCfg.category, seasonCfg.sex) : undefined;
      const res = buildPrepSeason(seasonCfg, { carbDoseGPerKg: seasonDose, testPeakWeekId: lastTest?.id });
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
          <MacrocyclePanel level={bbLevel} goal="bodybuilding" onLevelChange={setBbLevel} onGoalChange={(g) => {
            // Раньше здесь был молчаливый no-op: попап «Направление» выглядел рабочим,
            // но не менял ничего. Годовой план ББ-авто — всегда bodybuilding; ПЛ-макро — в ПЛ-авто.
            if (g !== 'bodybuilding') flash('🗓 Годовой план ББ-авто — всегда «Бодибилдинг» (ПЛ-макро строится в ПЛ-авто)');
          }} storageKey="he_bb_macro" onApplyMacrocycle={source => {
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
