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
import { rankBBSplits, getMuscleFrequencies, type BBRankedPattern } from '../../../engines/bb/bb-selector.engine';
import { buildBBPlan, buildWarmup, applyMacrocycleToBBPlan, buildBBPlanWithDUP, type BBPlan, type BBExercise } from '../../../engines/bb/bb-builder.engine';
import type { DUPMode } from '../../../engines/bb/bb-dup.engine';
import { applyDUPOverlay } from '../../../engines/bb/bb-dup.engine';
import { validateBBPlan } from '../../../engines/bb/bb-validator.engine';
import { finalizeBBPlan, markAntagonistSupersets, applyVolumeScheme } from '../../../engines/bb/bb-finalize.engine';
import { exerciseFeatureBadges, planSetsBreakdown, techniqueLabel, lastSetTechnique, techniqueChainParts } from './bb-technique-display';
import { calcBBPlanMetrics, type BBPlanMetrics } from '../../../engines/bb/bb-metrics.engine';
import { buildBBMethodologySummary } from '../../../engines/bb/bb-report.engine';
import { tempoExplain, buildExerciseInstructions } from '../../../engines/bb/bb-exercise-instructions.engine';
import { analyzeProQuality } from '../../../engines/manual-constructor/pro-quality-analysis.engine';
import { computeRegimeMrvMult, sessionLimitsFor } from '../../../engines/bb/bb-volume.engine';
import { PlanFeedbackCard } from './PlanFeedbackCard';
import { VolumeBudgetCard } from './VolumeBudgetCard';
import { PedInputPanel, PedAdaptationCard } from './PedCoursePanel';
import { PATTERN_RU as SUMMARY_PATTERN_RU, SUBGROUP_MAP, SUBGROUP_LABEL_RU as SUMMARY_SUBGROUP_LABEL_RU } from '../../../engines/bb/bb-summary.engine';
import { MUSCLE_LABEL_RU } from '../../../engines/volume-landmarks.engine';
import { adaptForPEDs, type PED, type PEDAdaptation } from '../../../engines/bb/bb-ped-adaptation.engine';
import { recommendPEDMethodology } from '../../../engines/bb/bb-ped-methodology.engine';
import { getAllVolumeLandmarks } from '../../../engines/volume-landmarks.engine';
import { canonicalMuscle, expandDonorMuscles, isSpecializationTargetConflict as isRegionConflict, normalizeSpecializationTargets } from '../../../engines/bb/bb-specialization.engine';
import { loadSRPESessions } from '../../../engines/pro/srpe-store';
import { loadSessions } from '../../../engines/workout-logger.engine';
import { acuteChronicRatio, toDailyLoads } from '../../../engines/pro/training-load.engine';
import { autoRegulate, shouldTrainToday } from '../../../engines/pro/autoregulation-pro.engine';
import { loadTrainingProfile, saveTrainingProfile, type TrainingProfile } from './training-profile';
import { subscribePlannerApply } from './planner-bridge';
import { loadAnnualTrainingPlan } from '../../../engines/annual-training/annual-training-storage';
import { activeBlockForWeek, weekForDate } from '../../../engines/annual-training/block-builders.engine';
import type { AnnualTrainingPlan } from '../../../engines/annual-training/annual-training.types';
import { ACCENT, CARD, SMALL, BTN, BTN_GHOST, H, STEP_PILL, IN, Chip } from './training-ui';
import { MesocycleProgressionCard } from './MesocycleProgressionCard';
import { PopupNumber, PopupSelect, PopupSelectSmart, PopupExerciseList, ExpandableCard, SaveButton } from '../SRCBBScreen_parts/TrainingPopups';
import { InjurySelectCard } from './InjurySelectCard';
import type { InjurySelectEntry } from './InjurySelectCard';
import { prescribeLoad, DELOAD_PROTOCOLS, applyDeloadToWeek, rirDrift, suggestFeeders, detectGarbageVolume, type LoadStrategy, type DeloadType, INTENSITY_TECHNIQUES, DEFAULT_TECHNIQUE_BY_PHASE, type IntensityTechnique } from '../../../engines/bb/bb-autocoach.engine';
import type { SessionMethodology } from '../../../engines/bb/bb-session-order.engine';
import { isCompoundEx } from '../../../engines/bb/bb-session-order.engine';
import { PCT_FOR_RIR } from '../../../engines/rir-table';
import { labTrainingAdjust } from './lab-training-adjust';
import { getCycleById, normalizeCycleDirection, getCyclesByDirection } from '../../../data/lms-cycles/lms-cycle-index';
import { programToBBPlan, cycleTemplateToFullProgram } from '../../../engines/bb/cycle-to-plan';
import type { SRCycleTemplate } from '../../../data/lms-cycles/lms-types';
import { FULL_PROGRAM_LIBRARY } from '../../../engines/complete-program-library.engine';
import type { FullProgram } from '../../../engines/complete-program-library.engine';
import { WOMENS_PROGRAMS, CUSTOM_PROGRAMS } from './programs-data';
import { useOriginalPrograms } from './useOriginalPrograms';
import { BbProgramLibraryPicker } from './BbProgramLibraryPicker';
import { getPlanFeedback } from '../../../engines/plan-execution-feedback.engine';

import { VolumeByWeekChart, RirDriftChart, type WeekVolume, type RirRecord } from './PlanCharts';
import { distributePhases as distributePhasesUnified, PHASE_CONFIGS, getPhaseConfig, type PhaseDistribution } from '../../../engines/periodization';
import { validatePlanQuality, bbPlanToQualityInput, type PlanQualityResult } from '../../../engines/plan-quality.engine';
import { PlanExportCard } from './PlanExportCard';
import { DayCard, PHASE_COLORS, PHASE_LABELS } from './PlanOutput';
import { loadSavedBBPlans, saveBBPlanVariant, deleteBBPlanVariant, type SavedBBPlan } from './bb-plans-store';
import {
  buildBBContestPrep, applyPeakWeekOverlayToBBPlan, deserializeBBPrepConfig, legacyConfigFromProfile,
  isoAddDays, isoToday, CATEGORY_PROFILES, CONTEST_CATEGORY_LABELS, PHASE_LABELS_RU, CONTEST_SPECIALIZATION_LABELS,
  buildBBContestPrepPlan, applyContestPrepToBBPlan, extendBBPlanPreparation, replanBBContestPrep,
  shiftBBContestPrepShowDate, serializeBBContestPrepPlan, nutritionTargetsForPrepDate,
  prepPhaseForDate, PREP_PHASE_LABELS, PREP_PHASE_COLORS,   buildShowTimeline, configFromPlan,
  computeReadiness,
  saveTestPeakWeekResult, latestTestPeakWeek, resolvePeakStrategy, planFromStored, prepWeightAdvice,
  buildPostShowPlan, buildContestPrepPrintHtml, recordPrepAdjustment, buildPrepIcs, buildPrepCoachJson,
  prepTrainingCompliance,
  type PrepAdjustment,
  type BBContestPrepConfig, type BBContestPrepResult, type BBContestCategory, type ContestSpecialization,
  type BBContestPrepPlan, type PrepWaterMode, type PrepSodiumMode, type PrepCarbMode, type BBPlanWithPrep,
  type PrepPhaseKey, type ContestEventEntry, type PeakNutritionBase,
  type WaterStrategy, type SodiumStrategy, type CarbLoadStrategy,
} from '../../../engines/bb/bb-contest-prep.engine';
import { CONTEST_PREP_UPDATED_EVENT, migrateLegacyContestPrepIfNeeded } from '../../../engines/bb/bb-contest-prep-sync';
import type { PeakingProtocol } from '../../../engines/peaking-protocols.engine';
import { ContestPrepConfigEditor } from '../../components/contest-prep/ContestPrepConfigEditor';
import { buildPrepCycle, buildPrepSeason, recommendMinimalMode, prepCutProjection, posingPlanForCategory, savePosingCheckin, getPosingCheckins, posingWeekStats, prepCardioPlan, buildPrepNutritionPlan, type PrepCycleConfig, type PrepCycleResult, type PrepSeasonConfig } from '../../../engines/bb/bb-prep-cycle.engine';
import {
  PREP_SPLIT_PROFILES, prepSplitProfile, PREP_MINIMAL_MODE_LABELS,
  PREP_ACCENT_OPTIONS, PREP_MINIMAL_OPTIONS, type PrepMinimalMode,
} from '../../../engines/bb/bb-prep-splits';
import { getPattern } from '../../../engines/bb/bb-split-patterns';
import { optimizeMuscleFrequency, type FrequencyOptimizationResult } from '../../../engines/bb/bb-frequency-optimizer.engine';
import { calculatePlanSafetyScore, type PlanSafetyScore } from '../../../engines/bb/bb-safety-score.engine';
import { assessReadiness, calculateACWR, getAutoRegulationOverride } from '../../../engines/bb/bb-auto-regulation.engine';
import { summarizeAutoRegulation } from '../../../engines/bb/bb-progression-feedback.engine';
import { createFromBuild as createUserProgramFromBuild, saveUserProgram as saveUserProgramStore } from '../../../engines/user-program/program-store';
import { getBBSuggestions } from './bb-compat';
import { sessionTagLabel, muscleLabel, exerciseTargetNote } from './bb-labels';
import { WhatIfCard } from './WhatIfCard';
import { MacrocyclePanel } from '../SRCBBScreen_parts/MacrocyclePanel';
import { CardioLinkCard } from './CardioLinkCard';
import { PlannerToolsPanel } from './PlannerToolsPanel';
import { type BBMacrocycle } from '../../../engines/lms/macrocycle.engine';

import { getProfile, updateProfile } from '../../../core/profile-manager';
import { getWeightLog } from '../../../engines/profile-store';

type Step = 'params' | 'ped' | 'split' | 'plan' | 'quality' | 'adjust' | 'contest' | 'annual' | 'tools';
type BBPhase = 'accumulation' | 'intensification' | 'deload' | 'peaking';
type PlanMode = 'generic_split' | 'bb_cycle' | 'programs';

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

// P2-6: ограниченный кеш (max 8 записей — достаточно для типичных значений weeks 4-24).
const _phaseMapCache = new Map<string, Map<number, BBPhase>>();
function getPhaseMap(totalWeeks: number, goal: string = 'mass'): Map<number, BBPhase> {
  const cacheKey = `${totalWeeks}:${goal}`;
  if (_phaseMapCache.has(cacheKey)) return _phaseMapCache.get(cacheKey)!;
  // P2-6: evict oldest if cache > 8 entries (anti-leak)
  if (_phaseMapCache.size >= 8) {
    const firstKey = _phaseMapCache.keys().next().value;
    if (firstKey) _phaseMapCache.delete(firstKey);
  }
  // P1: синхронизируем deloadFreq с движком buildBBPlan (deloadFreq = weeks>=6 ? 4 : 0),
  // иначе календарь/баннер показывал «без делода», а сгенерированный план содержал deload-неделю.
  const deloadFreq = totalWeeks >= 6 ? 4 : 0;
  const dist: PhaseDistribution[] = distributePhasesUnified(totalWeeks, deloadFreq, goal as any);
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

function phaseForWeek(week: number, totalWeeks: number, goal: string = 'mass'): BBPhase {
  return getPhaseMap(totalWeeks, goal).get(week) || 'accumulation';
}

/** Проверка: мышца в списке слабых групп (с учётом родительских групп). */
function isWeakMuscle(muscle: string, weakPoints: string[]): boolean {
  if (weakPoints.includes(muscle)) return true;
  const PARENT: Record<string, string> = { delt_front: 'shoulders', delt_mid: 'shoulders', delt_rear: 'shoulders' };
  return weakPoints.includes(PARENT[muscle] ?? '');
}

const DONOR_GROUPS: readonly (readonly [string, string])[] = [
  ['legs', 'Ноги (квадры+хамсы+ягодицы+икры)'],
  ['arms', 'Руки (бицепс+трицепс+предплечья)'],
  ['core', 'Кор'],
  ...WEAK_GROUPS,
];

function normalizeDonorTargets(donors: string[], targets: string[] = []): string[] {
  const targetCanonical = targets.map(canonicalMuscle);
  const out: string[] = [];
  const expandedOut: string[] = [];
  for (const donor of donors) {
    if (!donor || out.includes(donor) || out.length >= 2) continue;
    const expanded = expandDonorMuscles([donor]);
    if (expanded.some(m => targetCanonical.includes(canonicalMuscle(m)))) continue;
    if (expanded.some(m => expandedOut.includes(canonicalMuscle(m)))) continue;
    out.push(donor);
    expandedOut.push(...expanded.map(canonicalMuscle));
  }
  return out;
}


/** Метка подгруппы спины (backSubgroup) для UI-бейджа. */
export function backSubgroupLabel(sub: string): string {
  switch (sub) {
    case 'back_width': return '📐 Ширина (латы)';
    case 'back_thickness': return '📐 Толщина';
    case 'upper_back': return '📐 Верх спины';
    case 'rear_delts': return '📐 Задние дельты';
    case 'traps': return '📐 Трапеции';
    case 'erectors': return '📐 Разгибатели';
    default: return '';
  }
}

/** Метка головки руки (movementPattern) для UI-бейджа. */
export function armHeadLabel(pattern: string): string {
  switch (pattern) {
    case 'biceps_lengthened': return '🦴 Длинная гол. (растяжка)';
    case 'biceps_shortened': return '🦴 Короткая гол.';
    case 'biceps_hammer': return '🦴 Брахиалис (молот)';
    case 'triceps_overhead': return '🦴 Длинная гол. (overhead)';
    case 'triceps_pushdown': return '🦴 Латер./мед. (pushdown)';
    case 'triceps_compound': return '🦴 Compound (жим узк.)';
    case 'forearm': return '🦴 Предплечья';
    default: return '';
  }
}

/** Мини-чип для параметров упражнения (общий из training-ui). */

/* ─── Годовой план → ББ-авто: маппер контекста блока (he_bb_plan_saved_ctx) ─── */

/** Параметры шага «🏁 Contest prep», предзаполненные из контекста блока года. */
export interface AnnualBlockCtxToPrepPatch {
  peakWeekCategory: BBContestCategory;
  peakSpec: ContestSpecialization;
  prepShowDate: string;
  prepTaperWeeks: number;
  prepWeeks: number;
  prepWaterMode: WaterStrategy;
  prepSodiumMode: SodiumStrategy;
  prepCarbMode: CarbLoadStrategy;
  prepConfirmedManip: boolean;
}

/** Чистый маппер peakConfig блока годового плана → предзаполнение шага contest. */
export function annualBlockCtxToPrepPatch(
  ctx: { peakWeek?: boolean; weeks?: number; peakConfig?: Record<string, unknown> | null },
): AnnualBlockCtxToPrepPatch | null {
  if (!ctx.peakWeek || !ctx.peakConfig) return null;
  const cfg = ctx.peakConfig as Partial<BBContestPrepConfig>;
  const category = cfg.category && cfg.category in CATEGORY_PROFILES
    ? (cfg.category as BBContestCategory) : 'mens_physique';
  return {
    peakWeekCategory: category,
    peakSpec: cfg.specialization ?? 'none',
    prepShowDate: cfg.showDate ?? isoAddDays(isoToday(), 8 * 7),
    prepTaperWeeks: Number.isFinite(cfg.weeksOut) ? Math.min(4, Math.max(1, Math.round(cfg.weeksOut!))) : 2,
    prepWeeks: ctx.weeks && ctx.weeks > 0 ? Math.min(52, Math.max(1, Math.round(ctx.weeks))) : 12,
    prepWaterMode: (cfg.waterStrategy as WaterStrategy) || 'minimal',
    prepSodiumMode: (cfg.sodiumStrategy as SodiumStrategy) || 'constant',
    prepCarbMode: (cfg.carbLoadStrategy as CarbLoadStrategy) || 'moderate',
    prepConfirmedManip: !!cfg.confirmedManipulation,
  };
}

function computePhases(totalWeeks: number, goal: string = 'mass'): { week: number; phase: BBPhase }[] {
  const phases: { week: number; phase: BBPhase }[] = [];
  for (let w = 1; w <= totalWeeks; w++) {
    const p = phaseForWeek(w, totalWeeks, goal);
    phases.push({ week: w, phase: p });
  }
  return phases;
}

function exerciseComment(ex: BBExercise, weakPoints: string[], focusGroup: string, phase: BBPhase): string {
  const parts: string[] = [];
  const ruMuscle = (MUSCLE_LABEL_RU as any)[ex.muscle] || ex.muscle;
  // Роль упражнения — подробно
  if (ex.role === 'primary') {
    parts.push(`🎯 Основное движение для «${ruMuscle}» — тяжёлая база, главный стимул гипертрофии этой группы`);
    if (weakPoints.includes(ex.muscle)) parts.push(`🔥 Акцент на отстающую «${ruMuscle}» — дополнительный объём и приоритет в начале дня`);
    if (focusGroup === ex.muscle) parts.push(`⭐ Группа специализации «${ruMuscle}» — повышенный приоритет объёма`);
  } else {
    parts.push(`📌 Добивочное для «${ruMuscle}» — изоляция/добивка после базы, RIR 2-3, контроль техники`);
  }
  // Характер нагрузки — развёрнуто
  if (ex.character === 'тяж') parts.push('💪 Характер: тяж — 6-10 повторов, RIR 1-2, максимум механического натяга, отдых 2-3 мин');
  else if (ex.character === 'памп') parts.push('🩸 Характер: памп — 12-20 повторов, RIR 3, метаболический стресс и жжение, пауза 45-60 сек');
  else parts.push('🌿 Характер: лёгкий — техника/восстановление, RIR 4');
  // Фаза — адаптация
  const phaseDesc: Record<string, string> = {
    accumulation: 'Фаза «Накопление»: умеренный вес, больший объём, темп 3-1-1-0, акцент на растянутой позиции',
    intensification: 'Фаза «Интенсификация»: тяжёлый вес, RIR 1-2, темп 2-0-1-0, максимум напряжения',
    deload: 'Фаза «Разгрузка»: 50% объёма, RIR 3-4, лёгкие веса — восстановление ЦНС и суставов',
    peaking: 'Фаза «Пик»: минимальный объём, околопредельные веса RIR 0-1 — реализация силы',
  };
  if (phaseDesc[phase]) parts.push(`📅 ${phaseDesc[phase]}`);
  // Паттерн движения — по-русски, из каталога или movementPattern упражнения
  const catalogEx: any = EXERCISE_CATALOG.find((e: any) => e.name === ex.name || e.id === (ex as any).exerciseName);
  const rawPat = catalogEx?.movementPattern || (ex as any).movementPattern || '';
  const patRu = rawPat ? (SUMMARY_PATTERN_RU[rawPat] || rawPat) : '';
  if (patRu) parts.push(`🧬 Паттерн: ${patRu}`);
  // Дополнительные мышцы (синергисты) — по-русски
  if (catalogEx?.targetMuscle) {
    const targets = String(catalogEx.targetMuscle).split(',').map((t: string) => t.trim()).filter((t: string) => t && t !== ex.muscle);
    if (targets.length) parts.push(`🎯 Дополнительно нагружает: ${targets.map((t: string) => (MUSCLE_LABEL_RU as any)[t] || t).join(', ')}`);
  }
  // Суперсет / техника
  const ss = (ex as any).supersetWith;
  if (ss) parts.push(`🔗 Суперсет с «${ss}» — выполняется без отдыха между упражнениями пары`);
  const lastTech: any = (ex as any).workSets?.[ (ex as any).workSets.length - 1]?.technique;
  if (lastTech) {
    const tLabel = techniqueLabel(lastTech);
    if (tLabel) parts.push(`💥 Интенсив-техника: ${tLabel} на последнем подходе — продлевает сет за отказом`);
  }
  // Вес / RIR / отдых — факт плана
  const w = (ex as any).workSets?.[0]?.weight ?? 0;
  const r = (ex as any).workSets?.[0]?.reps ?? ex.sets;
  const rir = (ex as any).rir ?? 2;
  const rest = (ex as any).restSeconds ?? (ex as any).workSets?.[0]?.restSeconds;
  if (w) parts.push(`⚙️ Нагрузка плана: ${ex.sets}×${r} @ ${w} кг, RIR ${rir}${rest ? `, отдых ${rest} сек` : ''}`);
  return parts.join(' · ');
}

/** п.18: строка карточки «📍 Текущий блок года» для даты (null — нет плана/активного блока). */
export function annualActiveBlockLine(plan: AnnualTrainingPlan | null, iso: string): string | null {
  if (!plan) return null;
  const w = weekForDate(iso);
  const active = w != null ? activeBlockForWeek(plan, w) : null;
  if (!active) return null;
  const statusIcon = active.status === 'built' ? '✅' : active.status === 'stale' ? '⚠' : active.status === 'error' ? '❌' : '·';
  const statusLabel = active.status === 'built' ? 'собран' : active.status === 'stale' ? 'устарел' : active.status === 'error' ? 'ошибка' : 'не собран';
  const kindLabel = active.ref.kind === 'PL' ? 'ПЛ' : active.ref.kind === 'BB' ? 'ББ' : '✍ Ручной';
  const prepNote = active.ref.kind === 'BB' && active.ref.phase === 'contest_prep' && active.status === 'built'
    ? ' · 🏁 contest prep — настройте пик в «🏁 Contest prep»' : '';
  return `📍 Текущий блок года: нед ${w} · ${active.ref.phase} (${active.ref.startWeek}–${active.ref.startWeek + active.ref.weeks - 1}) · ${kindLabel} ${statusIcon} ${statusLabel}${prepNote}`;
}


/** Чип-кнопка для выбора акцентов/минимума/режима в Prep-цикле. */
const chipBtn = (label: string, on = false, danger = false): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '8px 11px', borderRadius: 12, cursor: 'pointer',
  minHeight: 36, fontSize: 11, fontWeight: on ? 800 : 600,
  background: on ? (danger ? 'rgba(239,68,68,0.18)' : 'rgba(236,72,153,0.18)') : 'rgba(255,255,255,0.04)',
  border: on ? `1px solid ${danger ? '#ef4444' : '#ec4899'}66` : '1px solid rgba(255,255,255,0.1)',
  color: on ? (danger ? '#f87171' : '#ec4899') : '#fff',
});

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
  const [supersetMode, setSupersetMode] = useState<'none' | 'antagonist' | 'same_muscle' | 'giant'>('none');
  const [volumeScheme, setVolumeScheme] = useState<'standard' | 'gvt' | 'fst7' | 'gironda'>('standard');

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
  // weakPoints — зеркало specTargets (единый источник выбора в UI).
  useEffect(() => { setWeakPoints(specTargets); }, [specTargets]);
  const [injuries, setInjuries] = useState<InjurySelectEntry[]>(prof.injuries || []);
  // PRO: mobility restrictions — biomechanics-based exercise filtering
  const [mobilityRestrictions, setMobilityRestrictions] = useState<string[]>(prof.mobilityRestrictions || []);

  const [selectedSplitId, setSelectedSplitId] = useState<string>('');
  const [builtPlan, setBuiltPlan] = useState<BBPlan | null>(null);
  const [bbWeekSel, setBbWeekSel] = useState<number>(1);
  const [autoRegOn, setAutoRegOn] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [expandedMuscles, setExpandedMuscles] = useState<Set<string>>(new Set());
  const [collapsedDays, setCollapsedDays] = useState<Set<number>>(new Set());
  const [collapsedExercises, setCollapsedExercises] = useState<Set<string>>(new Set());
  // specializationMode больше не выбирается в UI: специализация включается
  // автоматически при выборе 1-2 отстающих мышц (specTargets).
  const specializationMode = specTargets.length > 0;
  const [editMode, setEditMode] = useState<{ dayIdx: number; exIdx: number } | null>(null);
  const [exerciseEdits, setExerciseEdits] = useState<Record<string, { sets: number; reps: number; weight: number }>>({});
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
  // 🔄 «Начать заново»: подтверждение сброса сборки.
  const [resetAsk, setResetAsk] = useState(false);
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
  const [prepWaterMode, setPrepWaterMode] = useState<WaterStrategy>('minimal');
  const [prepSodiumMode, setPrepSodiumMode] = useState<SodiumStrategy>('constant');
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
  const [prepConfirmedManip, setPrepConfirmedManip] = useState(false);
  const [prepBusy, setPrepBusy] = useState(false);
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
    const base: BBContestPrepConfig = {
      sex,
      category: peakWeekCategory,
      weightKg: Math.max(40, Math.min(200, Number(prof?.personal?.weight) || 80)),
      bodyFatPct: Number(prof?.personal?.bodyFat) > 0 ? Number(prof?.personal?.bodyFat) : undefined,
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
    };
    return base;
  };

  /** Собрать единый prep-план, применить к текущему плану и сохранить в профиль. */
  const assembleContestPrep = (applyToPlan: boolean) => {
    if (!builtPlan) { flash('Сначала соберите план тренировок'); return; }
    setPrepBusy(true);
    try {
      const cfg = buildContestPrepConfig();
      const plan = buildBBContestPrepPlan(cfg, {
        prepWeeks: Math.min(52, Math.max(1, prepWeeks)),
        taperWeeks: Math.min(4, Math.max(1, prepTaperWeeks)),
        prepVolumeMult: prepVolumeMode,
        source: 'bb_auto',
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
        });
        setBuiltPlan(updated);
        setPrepApplied(true);
        // Подготовка в плане НЕ переделывается: taper накладывается поверх последних недель.
        const metaWarnings = ((updated as any).contestPrep?.warnings ?? []) as string[];
        const shortPrep = metaWarnings.find(w => w.includes('короче полной подготовки'));
        if (shortPrep) flash(`⚠ ${shortPrep.replace(/^⚠ /, '')}`);
      }
      savePrepToProfile(plan, cfg);
      try {
        window.dispatchEvent(new CustomEvent('he-bb-contest-prep-updated', {
          detail: { prepPlanId: plan.id, trainingPlanId: undefined, nutritionPlanId: undefined, showDate: cfg.showDate },
        }));
      } catch { /* ignore */ }
      flash('🏁 Contest prep собран' + (applyToPlan ? ' и применён к плану' : ''));
    } catch (e) {
      flash(`Не удалось собрать contest prep: ${(e as Error).message}`);
    } finally {
      setPrepBusy(false);
    }
  };

  const savePrepToProfile = (plan: BBContestPrepPlan, cfg: BBContestPrepConfig) => {
    try {
      const cur = getProfile();
      const next: any = JSON.parse(JSON.stringify(cur.settings || {}));
      if (!next.goals) next.goals = {};
      next.goals.bbContestPrepPlan = JSON.stringify(plan);
      next.goals.bbPeakConfig = JSON.stringify(cfg);
      next.goals.peakWeek = true;
      next.goals.peakShowDay = cfg.showDate;
      updateProfile({ settings: next });
    } catch { /* silent */ }
  };

  /** Перенос даты шоу с пересчётом фаз (завершённые недели — с предупреждением). */
  const handleShiftPrepShowDate = (d: string) => {
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
      win.document.write(buildContestPrepPrintHtml(prepPlan, { compliance }));
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
      const blob = new Blob([buildPrepCoachJson(prepPlan)], { type: 'application/json;charset=utf-8' });
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
        setPrepWaterMode(migrated.peakWeek.waterMode === 'stable' ? 'minimal' : 'moderate' as WaterStrategy);
        setPrepSodiumMode(migrated.peakWeek.sodiumMode === 'stable' ? 'constant' : 'cut_2d' as SodiumStrategy);
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
      setPrepWaterMode(stored.peakWeek.waterMode === 'stable' ? 'minimal' : 'moderate' as WaterStrategy);
      setPrepSodiumMode(stored.peakWeek.sodiumMode === 'stable' ? 'constant' : 'cut_2d' as SodiumStrategy);
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
        setPrepWaterMode(stored.peakWeek.waterMode === 'stable' ? 'minimal' : 'moderate' as WaterStrategy);
        setPrepSodiumMode(stored.peakWeek.sodiumMode === 'stable' ? 'constant' : 'cut_2d' as SodiumStrategy);
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
      waterStrategy: 'minimal',
      sodiumStrategy: 'constant',
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
      } else if (payload.kind === 'weakpoints' && Array.isArray((payload.data as any).groups)) {
        const groups = (payload.data as any).groups as string[];
        const normalized = normalizeSpecializationTargets(groups.slice(0, 2));
        if (normalized.length > 0) {
          setSpecBlocks([{ id: 'spec-block-1', weeks: 5, targets: normalized, tradeoffMode: 'none' as const, donors: [] }]);
          setBridgeMsg(`🔗 Слабые группы → ББ-авто: ${normalized.join(', ')}`);
          setTimeout(() => setBridgeMsg(''), 4000);
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
  useEffect(() => { if (bestSplit && !selectedSplitId) setSelectedSplitId(bestSplit.pattern.id); }, [bestSplit]);

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
  // FIX-6: Единый источник качества — validatePlanQuality + pro-quality-analysis (паттерны/углы/растяжка)
  const quality = useMemo(() => {
    if (!builtPlan) return null;
    // Фактический делод по неделям плана (а не тоггл autoDeload)
    const hasDeloadActual = builtPlan.weeks.some((w:any) => (w as any).deload || (w as any).phase === 'deload');
    const deloadWeeksActual = builtPlan.weeks.filter((w:any) => (w as any).deload || (w as any).phase === 'deload').map((w:any) => w.week).filter(Boolean);
    const input = bbPlanToQualityInput(builtPlan, {
      level: bbLevel,
      weakPoints,
      hasDeload: hasDeloadActual,
      deloadWeeks: deloadWeeksActual,
      onCourse: peds.length > 0,
      trainingYears: bbTrainingYears,
      pedMultiplier: pedAdapt.combinedMrvMultiplier,
      injuries: injuries.map(i => ({ muscle: i.muscle, exclude: i.exclude })),
      goal: bbGoal,
      trainingFocus: bbTrainingFocus,
      methodology: bbMethodology,
      volumeGoal: bbVolGoal,
      specialization: specializationMode,
      focusGroup: '',
      splitPattern: builtPlan.pattern?.id,
    });
    const result = validatePlanQuality(input);
    // PRO-качество из интеллектуальных — паттерны/углы/растяжка/техники (читает технику из workSets)
    let proDelta = 0;
    let proIssues: string[] = [];
    let proResult: ReturnType<typeof analyzeProQuality> | null = null;
    try {
      // Передаём технику честно: маппим workSets с technique, иначе PRO всегда 0%
      const dummyProgram: any = {
        bb: {
          weeks: builtPlan.weeks.map((w:any) => ({
            sessions: w.sessions.map((s:any) => ({
              blocks: s.exercises.map((e:any) => {
                const ws = e.workSets || [{ reps: e.repsRange?.[0] || 10, rir: e.rir || 2 }];
                // Техника — из workSets с technique, иначе из коммента/parent
                const tech = (ws[0] as any)?.technique || (e as any).technique || 'none';
                return { exerciseName: e.name, muscle: e.muscle, sets: ws.map((x:any) => ({ reps: x.reps, rir: x.rir ?? e.rir, technique: x.technique || tech })), technique: tech };
              }),
            })),
          })),
        },
        pl: { customWeeks: [] },
        goal: bbGoal,
        level: bbLevel,
      };
      const basePerMuscle = result.muscles.map(m => ({ muscle: m.muscle, peakSets: m.weeklySets, mrv: m.mrv }));
      proResult = analyzeProQuality(dummyProgram, 'bb', bbLevel, bbGoal, basePerMuscle);
      proDelta = proResult.scoreDelta;
      proIssues = proResult.totalIssues.slice(0, 2);
    } catch {}
    const finalScore = Math.max(0, Math.min(100, result.score + proDelta));
    const finalGrade = finalScore >= 85 ? '🟢 Отлично' : finalScore >= 65 ? '🟡 Хорошо' : finalScore >= 45 ? '🟠 Средне' : '🔴 Слабо';
    return {
      score: finalScore,
      label: finalGrade,
      details: [...result.issues.map(i => i.message), ...proIssues],
      perMuscle: result.muscles.map(m => ({
        muscle: m.muscle, sets: m.weeklySets, mev: m.mev, mav: m.mav, mrv: m.mrv,
        pct: m.pctOfMav, status: m.status, contextNote: m.contextNote,
      })),
      recommendations: [...result.recommendations, ...(proDelta < 0 ? [`PRO: ${proIssues.join('; ')}`] : [])],
      proResult,
      hasDeloadActual,
      deloadWeeksActual,
    };
  }, [builtPlan, bbLevel, weakPoints, peds, bbTrainingYears, pedAdapt.combinedMrvMultiplier, bbGoal, injuries]);

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

    if (planMode === 'programs') {
      // Единственный путь: FullProgram → programToBBPlan (faithful / adapt)
      if (customProgram) {
        plan = programToBBPlan(customProgram, {
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
          intensityLevel,
          equipment: bbEquipment,
          peds,
           pedDoses,
           courseIntensity,
            level: bbLevel,
            trainingYears: bbTrainingYears,
            bodyweightCapability: prof.bodyweightCapability,
           volumeGoal: effectiveVolGoal,
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
           });
          if (bbDays !== customProgram.daysPerWeek) setBbDays(customProgram.daysPerWeek);
         if (bbWeeks !== customProgram.durationWeeks) {
           const clamped = Math.max(4, Math.min(24, Math.round(Number(customProgram.durationWeeks) || 8)));
           if (Number.isFinite(clamped)) setBbWeeks(clamped);
         }
      } else {
        flash('Выберите программу из библиотеки');
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
         intensityLevel,
         intensityTechnique: intensityTech,
         autoDeload,
         deloadType,
         loadStrategy,
         autoRegResult: autoRegPayload,
         pedDoses,
         courseIntensity,
         equipment: bbEquipment,
         methodology: bbMethodology,
         sex: linked.profile?.settings?.personal?.sex,
         // P0-5: лабораторная коррекция MRV
         labMrvMultiplier: labAdjust.mrvMultiplier,
          labWarnings: labAdjust.warnings,
          labIntensityNote: labAdjust.intensityNote,
          trainingFocus: bbTrainingFocus,
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
        }, pedAdapt);
    }

    if (bbAnnualMacrocycle) {
      // BB-1 FIX: use applyMacrocycleToBBPlan for proper volume/RIR adjustments
      // (compound×accessory multipliers, RIR ranges, accessory removal in contest_prep)
      plan = applyMacrocycleToBBPlan(plan, bbAnnualMacrocycle);
    }

    // Проф-методики: DUP поверх плана (все ветки). Суперсеты и схемы объёма для всех веток теперь обрабатываются внутри движка (finalize) через BBBuilderInput/CycleToPlanInput — единый путь.
    if (dupMode !== 'none') {
      plan = applyDUPOverlay(plan, { mode: dupMode, cycleDays: dupMode === 'full_dup' ? 3 : 2 });
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
          return {
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
    const exportQuality = validatePlanQuality(bbPlanToQualityInput(exportPlan, { level: bbLevel, weakPoints, hasDeload: autoDeload, onCourse: peds.length > 0 }));
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
         };
        const planMetrics: SavedBBPlan['metrics'] = {
           totalSets: exportMetrics.totalSets,
           avgRir: exportMetrics.avgRir,
           sessionsPerWeek: exportPlan.pattern.sessionsPerRotation,
          phases: phases.map(p => p.phase),
           qualityScore: exportQuality.score,
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
      return `<h2 style="margin:16px 0 6px">Неделя ${wk.week} (${esc(wk.phase || '')}${wk.deload ? ' — DELOAD' : ''})${peakNote}</h2>${prepNote}${sessionsHtml}`;
    }).join('');
    const rationaleHtml = (plan.rationale || []).map(r => `<div style="font-size:10px;color:#666;margin:2px 0">${esc(r)}</div>`).join('');
    w.document.write(`<!DOCTYPE html><html><head><title>${esc(plan.pattern?.name || 'BB-план')}</title><style>@media print{body{font-size:10px}h2{page-break-before:auto}}</style></head><body style="font-family:Arial,sans-serif;max-width:900px;margin:0 auto;padding:20px"><h1>${esc(plan.pattern?.name || 'BB-план')} — ${plan.weeks.length} нед</h1>${rationaleHtml}${weeksHtml}<script>window.print()</script></body></html>`);
    w.document.close();
  };

  /** PRO: CSV export — все сеты плана в CSV для Excel/Google Sheets. */
  const handleExportCSV = () => {
    if (!builtPlan) return;
    const plan = applyEditsToPlan(builtPlan);
    const rows: string[] = [['Неделя', 'День', 'Упражнение', 'Мышца', 'Роль', 'Сет', 'Повторы', 'Вес(кг)', 'RIR', 'Темп', 'Отдых(с)', 'Паттерн', 'Ключи техники', 'Растяжение', 'Пиковое сокращение', 'Ошибки', 'Комментарий', 'Техника/Схема'].join(',')];
    for (const wk of plan.weeks) {
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

  const stepList: Step[] = planMode === 'programs' ? ['params','ped','plan','quality','adjust','contest','annual','tools'] : ['params','ped','split','plan','quality','adjust','contest','annual','tools'];
  const stepLabels: Record<Step,string> = { params:'1 Параметры', ped:'2 PED+Вес', split:'3 Сплит', plan: planMode === 'programs' ? '3 План' : '4 План', quality: planMode === 'programs' ? '4 Качество' : '5 Качество', adjust: planMode === 'programs' ? '5 Коррекция' : '6 Коррекция', contest: '🏁 Contest prep', annual:'🗓 Годовой план', tools:'🔧 Инструменты' };
  const renderStepNav = () => {
    const groups: Record<string, string[]> = planMode === 'programs'
      ? { 'ПАРАМЕТРЫ': ['params','ped'], 'ПЛАН': ['plan','quality','adjust'], 'ЦИКЛ': ['contest','annual','tools'] }
      : { 'ПАРАМЕТРЫ': ['params','ped','split'], 'ПЛАН': ['plan','quality','adjust'], 'ЦИКЛ': ['contest','annual','tools'] };
    const groupEndKeys = new Set(Object.values(groups).map(arr => (arr as string[])[(arr as string[]).length - 1]).filter(Boolean) as string[]);
    return (
      <div style={{ background: 'rgba(24,24,27,0.55)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '5px 6px', marginBottom: 8, display: 'flex', gap: 4, overflowX: 'auto' as const, scrollbarWidth: 'none' as const, WebkitOverflowScrolling: 'touch' as const, alignItems: 'center' }}>
        {stepList.map(s => {
          const active = step === s;
          const disabled = (s === 'plan' || s === 'quality' || s === 'adjust' || s === 'contest') && !builtPlan;
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
    <div>
      <div style={H}>📋 Шаг 1: Базовые параметры</div>

      {/* Plan mode: generic vs programs */}
      <div style={{ marginBottom:10, padding:'8px 10px', borderRadius:10, background:'rgba(168,85,247,0.06)', border:'1px solid rgba(168,85,247,0.15)' }}>
        <div style={{ fontSize:11, fontWeight:700, color:'#a855f7', marginBottom:6 }}>📌 Источник программы</div>
        <div style={{ display:'flex', gap:6 }}>
          <button onClick={() => setPlanMode('generic_split')} style={{
            flex:1, padding:'8px 10px', borderRadius:10, cursor:'pointer', fontWeight:700, fontSize:11,
            border: planMode === 'generic_split' ? '2px solid #a855f7' : '1px solid rgba(255,255,255,0.08)',
            background: planMode === 'generic_split' ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.02)',
            color: planMode === 'generic_split' ? '#a855f7' : '#fff',
          }}>🧩 Генерик-сплит (авто-генерация)</button>
          <button onClick={() => setPlanMode('programs')} style={{
            flex:1, padding:'8px 10px', borderRadius:10, cursor:'pointer', fontWeight:700, fontSize:11,
            border: planMode === 'programs' ? '2px solid #00e68a' : '1px solid rgba(255,255,255,0.08)',
            background: planMode === 'programs' ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.02)',
            color: planMode === 'programs' ? '#00e68a' : '#fff',
          }}>📚 Программы (точно / адаптация)</button>
        </div>
       </div>

      {renderSpecializationSelection()}

      {planMode === 'programs' && (
        <div style={{ marginBottom:10, padding:'10px 12px', borderRadius:10, background:'rgba(0,230,138,0.04)', border:'1px solid rgba(0,230,138,0.12)' }}>
          {/* Под-источник: ПРОФ-цикл / Библиотека программ */}
          <div style={{ display:'flex', gap:6, marginBottom:8 }}>
            <button onClick={() => setBbSource('cycle')} style={{
              flex:1, padding:'7px 8px', borderRadius:9, cursor:'pointer', fontWeight:700, fontSize:11,
              border: bbSource === 'cycle' ? '2px solid #00e68a' : '1px solid rgba(255,255,255,0.08)',
              background: bbSource === 'cycle' ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.02)',
              color: bbSource === 'cycle' ? '#00e68a' : '#fff',
            }}>📋 ПРОФ-цикл</button>
            <button onClick={() => setBbSource('program')} style={{
              flex:1, padding:'7px 8px', borderRadius:9, cursor:'pointer', fontWeight:700, fontSize:11,
              border: bbSource === 'program' ? '2px solid #60a5fa' : '1px solid rgba(255,255,255,0.08)',
              background: bbSource === 'program' ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.02)',
              color: bbSource === 'program' ? '#60a5fa' : '#fff',
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
                  <div style={{ marginTop:6, fontSize:11, color:'#fff', lineHeight: 1.5 }}>
                    <div><span style={{ fontWeight:700, color:'#fff' }}>Уровень:</span> {c.meta.level}</div>
                    <div><span style={{ fontWeight:700, color:'#fff' }}>Фокус:</span> {c.meta.targetFocus || '—'}</div>
                    {c.meta.deloadWeeks && c.meta.deloadWeeks.length > 0 && <div><span style={{ fontWeight:700, color:'#fff' }}>Разгрузка:</span> нед {c.meta.deloadWeeks.join(', ')}</div>}
                    {c.meta.rirProgression && <div><span style={{ fontWeight:700, color:'#fff' }}>RIR:</span> {c.meta.rirProgression.start}→{c.meta.rirProgression.end}</div>}
                    {c.meta.phases && c.meta.phases.length > 0 && <div><span style={{ fontWeight:700, color:'#fff' }}>Фазы:</span> {c.meta.phases.map(ph => ph.title || `нед ${ph.weekStart}-${ph.weekEnd}`).join(', ')}</div>}
                    <div style={{ marginTop:4, padding:'4px 8px', borderRadius:8, background:'rgba(0,230,138,0.06)', fontSize:11, color:'#fff' }}>{c.meta.description?.slice(0, 200)}</div>
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
                <div style={{ marginTop:6, fontSize:11, color:'#fff', lineHeight: 1.5 }}>
                  <div><span style={{ fontWeight:700, color:'#fff' }}>Программа:</span> {customCycle.meta.title}</div>
                  <div><span style={{ fontWeight:700, color:'#fff' }}>Уровень:</span> {customCycle.meta.level}</div>
                  <div><span style={{ fontWeight:700, color:'#fff' }}>Дней/нед:</span> {customCycle.meta.sessionsPerWeek}</div>
                  <div><span style={{ fontWeight:700, color:'#fff' }}>Недель:</span> {customCycle.meta.weeks}</div>
                  <div style={{ marginTop:4, padding:'4px 8px', borderRadius:8, background:'rgba(96,165,250,0.06)', fontSize:11, color:'#fff' }}>{customCycle.meta.description?.slice(0, 200)}</div>
                </div>
              )}
              {bbSource === 'program' && selectedProgramId && !customCycle && (() => {
                const p = bbLibraryPrograms.find(pr => pr.id === selectedProgramId);
                if (!p) return null;
                return (
                  <div style={{ marginTop:6, fontSize:11, color:'#fff', lineHeight: 1.5 }}>
                    <div><span style={{ fontWeight:700, color:'#fff' }}>Программа:</span> {p.name}</div>
                    <div><span style={{ fontWeight:700, color:'#fff' }}>Автор:</span> {p.author}</div>
                    <div><span style={{ fontWeight:700, color:'#fff' }}>Уровень:</span> {p.level}</div>
                    <div><span style={{ fontWeight:700, color:'#fff' }}>Дней/нед:</span> {p.daysPerWeek}</div>
                    <div><span style={{ fontWeight:700, color:'#fff' }}>Недель:</span> {p.durationWeeks}</div>
                    <div><span style={{ fontWeight:700, color:'#fff' }}>Цель:</span> {p.goal}{p.direction && p.direction !== p.goal ? ` (${p.direction})` : ''}</div>
                    {p.targetAudience && <div style={{ marginTop:3, fontSize: 10, color: '#fff' }}><b>Кому:</b> {p.targetAudience.slice(0, 160)}{p.targetAudience.length > 160 ? '…' : ''}</div>}
                    {p.warnings && p.warnings.length > 0 && (
                      <div style={{ marginTop:3, padding:'4px 8px', borderRadius:8, background:'rgba(245,158,11,0.08)', fontSize:10, color:'#fbbf24', lineHeight:1.4 }}>
                        ⚠️ {p.warnings.slice(0, 2).join(' · ')}{p.warnings.length > 2 ? '…' : ''}
                      </div>
                    )}
                    <div style={{ marginTop:4, padding:'4px 8px', borderRadius:8, background:'rgba(96,165,250,0.06)', fontSize:11, color:'#fff' }}>{p.description?.slice(0, 240)}</div>
                  </div>
                );
              })()}

              {/* 🔧 Дополнительная настройка выбранной программы (применяется к генерации ББ-цикла) */}
              {bbSource === 'program' && selectedProgramId && (
                <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 12, background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.18)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#a855f7', marginBottom: 8, display:'flex', alignItems:'center', gap:6 }}>
                    🔧 Дополнительная настройка программы
                  </div>
                  <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.5, marginBottom: 10 }}>
                    Переопределяет параметры выбранной программы под ваш профиль — слабые группы, интенсивность и стратегию прогрессии.
                    Если не менять — берутся разумные дефолты.
                  </div>

                  {/* Режим адаптации (faithful vs adapt) */}
                  {(planMode === 'programs') && (
                    <div style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa', marginBottom: 6 }}>🔒 Режим конвертации программы</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => setBbAdaptMode('faithful')} style={{
                          flex: 1, padding: '7px 8px', borderRadius: 9, cursor: 'pointer', fontWeight: 700, fontSize: 10,
                          border: bbAdaptMode === 'faithful' ? '2px solid #60a5fa' : '1px solid rgba(255,255,255,0.08)',
                          background: bbAdaptMode === 'faithful' ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.02)',
                          color: bbAdaptMode === 'faithful' ? '#60a5fa' : '#fff',
                        }}>🎯 Точно по программе</button>
                        <button onClick={() => setBbAdaptMode('adapt')} style={{
                          flex: 1, padding: '7px 8px', borderRadius: 9, cursor: 'pointer', fontWeight: 700, fontSize: 10,
                          border: bbAdaptMode === 'adapt' ? '2px solid #00e68a' : '1px solid rgba(255,255,255,0.08)',
                          background: bbAdaptMode === 'adapt' ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.02)',
                          color: bbAdaptMode === 'adapt' ? '#00e68a' : '#fff',
                        }}>🔧 Адаптировать</button>
                      </div>
                      <div style={{ marginTop: 6, fontSize: 11, color: '#fff', lineHeight: 1.4 }}>
                        {bbAdaptMode === 'faithful'
                          ? 'Все недели, RIR/множители/фазы/warmup/rest/reps/notes берутся дословно из программы. Применяются только safety-фильтры (травмы/исключённые упражнения/оборудование).'
                          : 'Структура программы сохраняется, но добавляется добивка слабых групп (+isolation), интенсив-техники, авто-делод и стратегия прогрессии.'}
                      </div>
                    </div>
                  )}
                  {/* 🔧 Полная настройка как в генерик-сплите — видна только в adapt режиме */}
                  {bbAdaptMode === 'adapt' && (
                  <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <PopupSelect label="🎯 Фокус тренировки" value={bbTrainingFocus} onChange={v => setBbTrainingFocus(v as 'strength' | 'hypertrophy' | 'endurance')} options={[
                      { id:'strength', label:'Сила: RIR 1-2', desc:'Тяжёлые веса, RIR 1-2 — максимальный натяг.' },
                      { id:'hypertrophy', label:'Гипертрофия: RIR 2-3', desc:'Умеренные веса 8-12 повт, темп 3-1-1-0.' },
                      { id:'endurance', label:'Выносливость: RIR 3-4', desc:'Лёгкие веса 15-20 повт, короткая пауза.' },
                    ]} />
                    <PopupSelect label="🧩 Методика порядка" value={bbMethodology} onChange={v => setBbMethodology(v as SessionMethodology)} hint="Порядок упражнений в дне — в коде: compound_first / pre_exhaust / post_exhaust" options={[
                      { id:'compound_first', label:'Базовые → изоляция', desc:'Сначала тяжёлые многосуставные.' },
                      { id:'pre_exhaust', label:'Pre-exhaust', desc:'Изоляция первой, затем база.' },
                      { id:'post_exhaust', label:'Post-exhaust', desc:'База в полную силу, затем изоляция.' },
                    ]} />
                    <PopupSelect
                      label='🔥 Интенсив-техника'
                      value={intensityTech}
                      onChange={v => setIntensityTech(v as IntensityTechnique)}
                      hint='В коде: none / rest_pause / drop_set / myo_reps / pause_rep / mechanical_drop / negative'
                      options={[
                        { id: 'none', label: 'Авто по фазе', desc:'Accumulation → пауза-репс, intensification → rest-pause/dropset.' },
                        { id: 'rest_pause', label: 'Рест-пауза', desc:'Финал 8 + 15с → 3-4 + 15с → 3-4.' },
                        { id: 'drop_set', label: 'Дроп-сет', desc:'−20% веса → 6 повт, ещё −20% → 4 повт.' },
                        { id: 'myo_reps', label: 'Myo-reps', desc:'12-15 + 4×4 с 5с паузой.' },
                        { id: 'pause_rep', label: 'Пауза-репс', desc:'Пауза 2-3с внизу.' },
                        { id: 'mechanical_drop', label: 'Мех. дроп-сет', desc:'Смена угла/хвата без отдыха.' },
                        { id: 'negative', label: 'Негативы (3-4с)', desc:'Медленный негатив 3-4с.' },
                        { id: 'twenty_ones', label: '21s (7-7-7)', desc:'7 снизу +7 сверху +7 полных — бицепс.' },
                      ]}
                    />
                    <PopupSelect
                      label='🌊 Волновая периодизация (DUP)'
                      value={dupMode}
                      onChange={v => setDupMode(v as DUPMode)}
                      hint='В коде: none / heavy_light / strength_hypertrophy / full_dup'
                      options={[
                        { id: 'none', label: 'Выкл (стандарт)', desc:'Блочная: накопление → интенс. → разгрузка.' },
                        { id: 'heavy_light', label: 'Тяж/лёг (2 дня)', desc:'Тяж сила + лёгк объём.' },
                        { id: 'strength_hypertrophy', label: 'Сила/гипертрофия (2 дня)', desc:'4-6 RIR1 + 10-15 RIR3.' },
                        { id: 'full_dup', label: 'Полный DUP (3 дня)', desc:'Сила/гипер/выносл.' },
                      ]}
                    />
                    <PopupSelect
                      label='🔗 Суперсеты'
                      value={supersetMode}
                      onChange={v => setSupersetMode(v as 'none' | 'antagonist' | 'same_muscle' | 'giant')}
                      hint='В коде: none / antagonist / same_muscle / giant'
                      options={[
                        { id: 'none', label: 'Выкл', desc:'По очереди с отдыхом.' },
                        { id: 'antagonist', label: 'Антагонисты', desc:'Грудь↔спина, биц↔триц.' },
                        { id: 'same_muscle', label: 'Одна группа', desc:'База+изоляция без отдыха.' },
                        { id: 'giant', label: 'Гигант-сет', desc:'Три упр. одной группы.' },
                      ]}
                    />
                    <PopupSelect
                      label='📦 Схема объёма памп-дней'
                      value={volumeScheme}
                      onChange={v => setVolumeScheme(v as any)}
                      hint='В коде: standard / gvt / fst7 / gironda'
                      options={[
                        { id: 'standard', label: 'Стандартная', desc:'Авто: тяж база, памп изоляция.' },
                        { id: 'gvt', label: 'GVT 10×10', desc:'10×10, 60%, 60-90с.' },
                        { id: 'fst7', label: 'FST-7', desc:'7×8-12, 30-45с.' },
                        { id: 'gironda', label: '8×8 Gironda', desc:'8×8, 45-60с.' },
                      ]}
                    />
                    <PopupSelect
                      label='📈 Стратегия прогрессии'
                      value={loadStrategy}
                      onChange={v => setLoadStrategy(v as LoadStrategy)}
                      options={[
                        { id: 'double_progression', label: 'Двойная прогрессия', desc:'Сначала добить повторы, затем +вес.' },
                        { id: 'linear', label: 'Линейная', desc:'+2.5 кг/нед компаунд, +1 кг изоляция.' },
                        { id: 'wave', label: 'Волновая', desc:'3-нед волны тяж/сред/лёг.' },
                        { id: 'rpe_based', label: 'RPE-based', desc:'Вес по ощущению RPE.' },
                      ]}
                    />
                    <PopupSelect
                      label='📉 Тип разгрузки'
                      value={deloadType}
                      onChange={v => setDeloadType(v as DeloadType)}
                      hint='В коде: pump / neural / full_rest'
                      options={[
                        { id: 'pump', label: 'Памп-делод 50%', desc:'Лёгкие веса 15-20 повт.' },
                        { id: 'neural', label: 'Нейр-делод', desc:'Мало сетов, тяж вес.' },
                        { id: 'full_rest', label: 'Полный отдых', desc:'20% объёма, 40% веса.' },
                      ]}
                    />
                    <PopupSelect label="⬇️ Эксцентрик" value={String(eccentricMult)} onChange={v => setEccentricMult(parseFloat(v))} hint="В коде eccentricMult: 1.0 / 1.1 / 1.2 (Schoenfeld 2021)." options={[
                      { id:'1.0', label:'1.0 — Норма', desc:'Стандартный темп.' },
                      { id:'1.1', label:'1.1 — +10%', desc:'Медленнее опускание.' },
                      { id:'1.2', label:'1.2 — +20%', desc:'Выраженный негатив.' },
                    ]} />
                    <PopupNumber label="🍽️ Профицит (ккал/день)" value={calorieSurplus} onChange={v => setCalorieSurplus(Math.round(v))} step={50} min={-500} max={1000} />
                    <PopupSelect label="🔄 Вариативность" value={rotationMode} onChange={v => setRotationMode(v as any)} hint="В коде rotationMode: forbid / strict / variety" options={[
                      { id:'forbid', label:'🚫 Запрет — одни и те же', desc:'Строго одни упражнения.' },
                      { id:'strict', label:'📅 Строгий — раз в 4 недели', desc:'Смена на границе фаз.' },
                      { id:'variety', label:'🎨 Разнообразие — при 2×/мышцу', desc:'Чередование углов.' },
                    ]} />
                    <PopupSelect label="🔥 Интенсивность" value={intensityLevel} onChange={v => setIntensityLevel(v as any)} hint="В коде intensityLevel: light / moderate / high" options={[
                      { id:'light', label:'🌿 Лёгкая — отдых +20%', desc:'Тяж 3 мин, памп 75с.' },
                      { id:'moderate', label:'⚖️ Умеренная — стандарт', desc:'Тяж 2-3 мин, памп 60с.' },
                      { id:'high', label:'🔥 Высокая — отдых −20%', desc:'Тяж 1.5 мин, памп 45с.' },
                    ]} />
                    <PopupSelect label="📦 Цель объёма" value={bbVolGoal} onChange={v => setBbVolGoal(v)} options={[['mev','Минимум (MEV)'],['mav','Оптимум (MAV)'],['mrv','Максимум (MRV)']].map(([id,label]) => ({ id, label }))} />
                    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:10, background:'rgba(59,130,246,0.06)', border:'1px solid rgba(59,130,246,0.12)' }}>
                      <span style={{ fontSize:10, fontWeight:700, color:'#3b82f6' }}>📦 Объёмный</span>
                      <button onClick={() => setTrainingVolumeMode('standard')} style={{ flex:1, padding:'6px 8px', borderRadius:8, fontSize:10, fontWeight:700, cursor:'pointer', border: trainingVolumeMode==='standard' ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.08)', background: trainingVolumeMode==='standard' ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.02)', color: trainingVolumeMode==='standard' ? '#3b82f6' : '#fff' }}>Обычный</button>
                      <button onClick={() => setTrainingVolumeMode('high')} style={{ flex:1, padding:'6px 8px', borderRadius:8, fontSize:10, fontWeight:700, cursor:'pointer', border: trainingVolumeMode==='high' ? '2px solid #f59e0b' : '1px solid rgba(255,255,255,0.08)', background: trainingVolumeMode==='high' ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.02)', color: trainingVolumeMode==='high' ? '#f59e0b' : '#fff' }}>Объёмный</button>
                    </div>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#fff', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Подбор упражнений</div>
                    {[
                      { icon: '🚫', title: 'Исключить осевую нагрузку', desc: 'Убрать приседы, тяги со штангой', on: avoidAxialLoadUi, set: setAvoidAxialLoadUi, accent: '#ef4444', enabled: true },
                      { icon: '🏗️', title: 'Меньше многосуставных', desc: 'Больше тренажёров и изоляций', on: fewerCompound, set: setFewerCompound, accent: '#f59e0b', enabled: true },
                      { icon: '🏋️', title: 'Становая / жим стоя', desc: bbGoal === 'strength_mass' ? 'Включить становую и жим стоя' : 'Доступно в «Сила + Масса»', on: allowStrengthLifts, set: setAllowStrengthLifts, accent: '#3b82f6', enabled: bbGoal === 'strength_mass' },
                    ].map(t => {
                      const active = t.enabled && t.on;
                      return (
                        <button key={t.title} type="button" onClick={() => t.enabled && t.set(!t.on)} aria-pressed={!!active} aria-disabled={!t.enabled} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, padding: '10px 12px', borderRadius: 12, cursor: t.enabled ? 'pointer' : 'not-allowed', textAlign: 'left', boxSizing: 'border-box', fontFamily: 'inherit', background: active ? `linear-gradient(135deg, ${t.accent}1e, rgba(24,24,27,0.35))` : 'rgba(255,255,255,0.03)', border: active ? `1px solid ${t.accent}66` : '1px solid rgba(255,255,255,0.08)', opacity: t.enabled ? 1 : 0.45, transition: 'all .15s' }}>
                          <span style={{ fontSize: 16, flexShrink: 0 }}>{t.icon}</span>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: active ? t.accent : '#fff', lineHeight: 1.2 }}>{t.title}</span>
                            <span style={{ display: 'block', fontSize: 10, color: '#fff', lineHeight: 1.3, marginTop: 2 }}>{t.desc}</span>
                          </span>
                          <span style={{ marginLeft: 'auto', width: 36, height: 20, borderRadius: 10, flexShrink: 0, position: 'relative', background: active ? t.accent : 'rgba(255,255,255,0.15)', transition: 'background .2s' }}>
                            <span style={{ position: 'absolute', top: 2, left: active ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                    <PopupExerciseList label="⭐ Любимые" ids={bbFavEx} onChange={ids => { setBbFavEx(ids); syncProf({ favoriteExercises: ids }); }} accent="#00e68a" />
                    <PopupExerciseList label="✕ Не любимые" ids={bbExclEx} onChange={ids => { setBbExclEx(ids); syncProf({ excludedExercises: ids }); }} accent="#ef4444" />
                  </div>
                  <div style={{ marginTop:8, padding:'8px 10px', borderRadius:10, background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.15)' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#60a5fa', marginBottom:6 }}>🏋️ Оборудование</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                      {([['barbell','Штанга'],['dumbbell','Гантели'],['cable','Блок'],['machine','Тренажёр'],['kettlebell','Гири'],['bodyweight','Свой вес'],['bands','Резинки']] as const).map(([id,label]) => {
                        const on = bbEquipment.includes(id);
                        return <button key={id} onClick={() => setBbEquipment(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])} style={{ padding:'5px 10px', borderRadius:14, fontSize:10, fontWeight:700, cursor:'pointer', minHeight:38, border:on?'1px solid #60a5fa':'1px solid rgba(255,255,255,0.08)', background:on?'rgba(96,165,250,0.15)':'rgba(255,255,255,0.02)', color:on?'#60a5fa':'#fff' }}>{label}{on?' ✓':''}</button>;
                      })}
                    </div>
                  </div>
                  <div style={{ marginTop:8 }}>
                    <InjurySelectCard injuries={injuries} onChange={setInjuries} />
                  </div>
                  <div style={{ marginTop:8, padding:12, borderRadius:12, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.18)' }}>
                    <div style={{ fontSize:12, fontWeight:800, color:'#f59e0b', marginBottom:6 }}>🦴 Ограничения мобильности</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {([
                        { id: 'shoulder', icon: '🤸', label: 'Плечи' },
                        { id: 'hip', icon: '🦵', label: 'Таз' },
                        { id: 'ankle', icon: '🦶', label: 'Голеностоп' },
                        { id: 'lower_back', icon: '🔙', label: 'Поясница' },
                        { id: 'wrist', icon: '✋', label: 'Запястья' },
                      ] as const).map(r => {
                        const active = mobilityRestrictions.includes(r.id);
                        return (
                          <button key={r.id} onClick={() => setMobilityRestrictions(prev => active ? prev.filter(x => x !== r.id) : [...prev, r.id])} style={{ padding:'7px 10px', borderRadius:10, fontSize:11, cursor:'pointer', border: active ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.1)', background: active ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.03)', color: active ? '#f59e0b' : '#fff' }}>
                            {r.icon} {r.label} {active ? '✕' : ''}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  </>
                  )}
                  <button
                    onClick={() => setAutoDeload(a => !a)}
                    style={{
                      width:'100%', marginTop: 8, padding: '8px 10px', borderRadius: 10, cursor: 'pointer',
                      fontSize: 11, fontWeight: 700, textAlign: 'left', boxSizing: 'border-box',
                      background: autoDeload ? 'rgba(0,230,138,0.10)' : 'rgba(255,255,255,0.03)',
                      border: autoDeload ? '1px solid rgba(0,230,138,0.35)' : '1px solid rgba(255,255,255,0.08)',
                      color: autoDeload ? ACCENT : '#fff',
                    }}
                  >
                    {autoDeload ? '✅ Авто-делод при перегрузке' : '⬜ Авто-делод при перегрузке'} (ACWR&gt;1.3)
                  </button>

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
          <div style={{ fontSize:10, color:'#fff', lineHeight:1.5 }}>
            <div><b style={{ color:'#f59e0b' }}>Цель «{bbGoal === 'mass' ? 'Масса' : bbGoal === 'cut' ? 'Сушка' : bbGoal === 'recomp' ? 'Рекомпозиция' : bbGoal === 'maintenance' ? 'Поддержание' : 'Сила+Масса'}»:</b> {bbSuggest.goalDesc}</div>
            <div style={{ marginTop:3 }}><b style={{ color:'#f59e0b' }}>Уровень «{bbLevel === 'beginner' ? 'Новичок' : bbLevel === 'intermediate' ? 'Средний' : bbLevel === 'advanced' ? 'Опытный' : 'Enhanced'}»:</b> {bbSuggest.levelDesc}</div>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        <PopupSelect label="Уровень" value={bbLevel} onChange={setBbLevel} options={[['beginner','Новичок'],['intermediate','Средний'],['advanced','Опытный'],['enhanced','Enhanced (PED)']].map(([id,label]) => ({ id, label }))} />
        <PopupNumber label="Стаж" value={bbTrainingYears} min={0} max={50} step={0.5} suffix=" лет" onChange={v => { setBbTrainingYears(v); syncProf({ trainingYears: v }); }} />
        <PopupSelect label="Цель" value={bbGoal} onChange={setBbGoal} options={[['mass','Мышечная масса'],['cut','Сушка'],['recomp','Рекомпозиция'],['maintenance','Поддержание'],['strength_mass','Сила + Масса']].map(([id,label]) => ({ id, label }))} />
        <PopupNumber label="Дней/нед" value={bbDays} min={3} max={6} onChange={v => setBbDays(v)} />
         <PopupNumber label="Недель мезо" value={bbWeeks} min={4} max={24} suffix=" нед" onChange={v => setBbWeeks(v)} />
          <PopupSelectSmart label="Цель объёма" value={bbVolGoal} onChange={onUserVolGoal} suggestedIds={bbSuggest.volumeGoal} suggestionReason="По цели и уровню" options={[['mev','Минимум (MEV)'],['mav','Оптимум (MAV)'],['mrv','Максимум (MRV)']].map(([id,label]) => ({ id, label }))} />
          <div style={{ gridColumn:'1 / span 2', padding:'10px 12px', borderRadius:12, background:'rgba(59,130,246,0.06)', border:'1px solid rgba(59,130,246,0.18)' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#3b82f6', marginBottom:6, display:'flex', alignItems:'center', gap:6 }}>📦 Объёмный тренинг <span style={{ fontSize:9, fontWeight:400, color:'#fff' }}>капы от уровня — новичок без фармы 60 сетов недоступно</span></div>
            <div style={{ display:'flex', gap:6 }}>
              <button onClick={() => setTrainingVolumeMode('standard')} style={{ flex:1, padding:'8px 10px', borderRadius:10, cursor:'pointer', fontWeight:700, fontSize:11, border: trainingVolumeMode==='standard' ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.08)', background: trainingVolumeMode==='standard' ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.02)', color: trainingVolumeMode==='standard' ? '#3b82f6' : '#fff' }}>Обычный</button>
              {(() => {
                const highDisabled = false;
                const isBeginnerNoPed = bbLevel === 'beginner' && peds.length === 0;
                return (
                  <button
                    disabled={false}
                    title={isBeginnerNoPed ? 'Новичок: объёмный 60 сетов ограничен капами 24/10, но доступен — объём MRV + GVT/FST-7' : 'Объёмный: MRV + GVT/FST-7, капы те же от уровня'}
                    onClick={() => { if (isBeginnerNoPed) flash('Объёмный для новичка: капы 24/10, объём MRV, GVT/FST-7 доступны.'); setTrainingVolumeMode('high'); }}
                    style={{ flex:1, padding:'8px 10px', borderRadius:10, cursor:'pointer', opacity:1, fontWeight:700, fontSize:11, border: trainingVolumeMode==='high' ? '2px solid #f59e0b' : '1px solid rgba(255,255,255,0.08)', background: trainingVolumeMode==='high' ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.02)', color: trainingVolumeMode==='high' ? '#f59e0b' : '#fff' }}
                  >Объёмный</button>
                );
              })()}
            </div>
            <div style={{ marginTop:6, fontSize:10, color:'#fff', lineHeight:1.5 }}>
              {trainingVolumeMode==='standard' ? (
                <>Обычный: цель MAV, без GVT/FST-7, капы по уровню. Лимит: {(() => { try { const l=sessionLimitsFor({level:bbLevel, trainingYears:bbTrainingYears, onCourse:peds.length>0}); return `${l.maxWorkingSets} сетов / ${l.maxExercises} упр.`; } catch { return '24/10'; } })()} (дефолт 24 с фармой — норма). </>
              ) : (
                <>Объёмный: цель MRV + памп-схемы (GVT 10×10/FST-7 — кап 5/упр сохраняется). Капы те же от уровня: новичок 24/10 недоступно 60; enhanced 3г+ 60/18. ACWR/дефицит — отдельной кнопкой Авто-делод.</>
              )}
            </div>
          </div>
          <div style={{ gridColumn:'1 / span 2', marginTop:2, padding:'6px 10px', borderRadius:10, background:'rgba(16,185,129,0.06)', border:'1px solid rgba(16,185,129,0.15)', fontSize:10, color:'#fff', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            {(() => {
              try {
                const srpe: any = (loadSRPESessions as any)();
                if (!srpe || srpe.length < 2) return <><span>📊 ACWR: нет данных sRPE (нужно ≥2 сессии)</span><span style={{ color:'#fff' }}>дефицит/восстановление — кнопкой Авто-делод</span></>;
                const acwr = (acuteChronicRatio as any)((toDailyLoads as any)(srpe));
                const ratio = acwr?.ratio ?? 1;
                const zone = ratio > 1.5 ? '🔴 опасно' : ratio > 1.3 ? '🟡 осторожность' : ratio < 0.8 ? '🔵 недогруз' : '🟢 норма';
                return <><span>📊 ACWR {ratio.toFixed(2)} — {zone}</span><span style={{ fontSize:9, color:'#fff' }}>дефицит/восстановление — Авто-делод</span></>;
              } catch { return <span>📊 ACWR: —</span>; }
            })()}
          </div>
          <PopupSelect label="🎯 Фокус тренировки" value={bbTrainingFocus} onChange={v => setBbTrainingFocus(v as 'strength' | 'hypertrophy' | 'endurance')} options={[
            { id:'strength', label:'Сила: RIR 1-2', desc:'Тяжёлые веса, низкая скорость, RIR 1-2 — максимальный механический натяг, прогрессия через 1ПМ.' },
            { id:'hypertrophy', label:'Гипертрофия: RIR 2-3', desc:'Умеренные веса 8-12 повт, контроль темпа 3-1-1-0, объём для роста.' },
            { id:'endurance', label:'Выносливость: RIR 3-4', desc:'Лёгкие веса 15-20 повт, короткая пауза, метаболический стресс.' },
          ]} />
          <PopupSelect label="🧩 Методика порядка" value={bbMethodology} onChange={v => setBbMethodology(v as SessionMethodology)} hint="Порядок упражнений в дне — влияет на силу и утомление. В коде: compound_first / pre_exhaust / post_exhaust" options={[ 
            { id:'compound_first', label:'Базовые → изоляция (по умолчанию)', desc:'Сначала тяжёлые многосуставные на свежие мышцы — максимум веса и безопасная техника, затем изоляция. Классика для гипертрофии.' }, 
            { id:'pre_exhaust', label:'Pre-exhaust: изоляция первой', desc:'Изоляция целевой мышцы до базы — утомляет заранее, база добивает. Сильный памп, но вес в базе −10-15%.' }, 
            { id:'post_exhaust', label:'Post-exhaust: базовые → изоляция', desc:'База в полную силу, сразу изоляция без отдыха — «пробить» мышцу двойным стимулом.' }, 
          ]} />
          <PopupSelect
            label='🔥 Интенсив-техника'
            value={intensityTech}
            onChange={v => setIntensityTech(v as IntensityTechnique)}
            hint='Техника на последнем подходе — продлевает сет за отказом. В коде: none / rest_pause / drop_set / myo_reps / pause_rep / mechanical_drop / negative'
            options={[
              { id: 'none', label: 'Авто по фазе', desc:'Accumulation → пауза-репс, intensification/peaking → rest-pause/dropset по профилю мышцы.' },
              { id: 'rest_pause', label: 'Рест-пауза', desc:'Финал 8 повт + 15с пауза → 3-4 повт + 15с → 3-4 повт. Продлевает подход без сброса веса.' },
              { id: 'drop_set', label: 'Дроп-сет', desc:'После отказа −20% веса → 6 повт, ещё −20% → 4 повт. Метаболический стресс, жжение.' },
              { id: 'myo_reps', label: 'Myo-reps', desc:'Активация 12-15 повт, затем 4×4 повт с 5с паузой. Эффективна для изоляций.' },
              { id: 'pause_rep', label: 'Пауза-репс', desc:'Пауза 2-3с внизу каждого повтора — убирает читинг, усиливает растянутую.' },
              { id: 'mechanical_drop', label: 'Мех. дроп-сет', desc:'Смена угла/хвата без отдыха (жим гантелей → разводка). Продлевает сет механикой.' },
              { id: 'negative', label: 'Негативы (3-4с)', desc:'Медленный негатив 3-4с, быстрый подъём 1с — акцент на эксцентрике.' },
            ]}
          />
          <PopupSelect
            label='🌊 Волновая периодизация (DUP)'
            value={dupMode}
            onChange={v => setDupMode(v as DUPMode)}
            hint='Чередование стимулов внутри недели — в коде: none / heavy_light / strength_hypertrophy / full_dup (Schoenfeld 2017)'
            options={[
              { id: 'none', label: 'Выкл (стандартная периодизация)', desc:'Блочная периодизация: накопление → интенсификация → разгрузка. Просто и надёжно.' },
              { id: 'heavy_light', label: 'Тяж/лёг (2 дня)', desc:'Чередование тяжёлых и лёгких дней — тяж сила, лёгк объём/техника.' },
              { id: 'strength_hypertrophy', label: 'Сила/гипертрофия (2 дня)', desc:'День силы 4-6 повт RIR 1-2 + день гипертрофии 10-15 RIR 2-3 — оптимум.' },
              { id: 'full_dup', label: 'Полный DUP (3 дня)', desc:'Три стимула: сила / гипертрофия / выносливость. Максимум вариативности, нужен опыт ≥2 года.' },
            ]}
          />
          <PopupSelect
            label='🔗 Суперсеты'
            value={supersetMode}
            onChange={v => setSupersetMode(v as 'none' | 'antagonist' | 'same_muscle' | 'giant')}
            hint='Суперсеты — в коде: none / antagonist / same_muscle / giant. Выполняются без отдыха между упражнениями пары.'
            options={[
              { id: 'none', label: 'Выкл', desc:'По очереди с полным отдыхом. Максимум силы в каждом движении.' },
              { id: 'antagonist', label: 'Антагонисты (пары)', desc:'Пары противоположных групп: грудь ↔ спина, бицепс ↔ трицепс. Экономия 30% времени.' },
              { id: 'same_muscle', label: 'Одна группа (пробить)', desc:'Компаунд + изоляция одной мышцы без отдыха — «пробить» группу, сильный памп.' },
              { id: 'giant', label: 'Гигант-сет (3 упр. одной группы)', desc:'Три упражнения одной группы подряд без отдыха. Только для продвинутых, RIR 3+.' },
            ]}
          />
          <PopupSelect
            label='📦 Схема объёма памп-дней'
            value={volumeScheme}
            onChange={v => setVolumeScheme(v as any)}
            hint='Методики для памп-изоляций (кап 5 сетов/упр сохраняется) — в коде: standard / gvt / fst7 / gironda'
            options={[
              { id: 'standard', label: 'Стандартная (авто)', desc:'Авто-распределение: тяж — база, памп — изоляция по необходимости. Баланс сила/объём.' },
              { id: 'gvt', label: 'GVT 10×10 (10 сетов на мышцу)', desc:'Немецкий объём 10×10, 60% 1ПМ, 60-90с пауза. Экстремальный объём, только для опытных.' },
              { id: 'fst7', label: 'FST-7 (7 сетов, 30-45с)', desc:'7 сетов по 8-12 в конце мышцы с короткой паузой — растягивает фасцию, финальный памп.' },
              { id: 'gironda', label: '8×8 Gironda (60с)', desc:'8×8, 45-60с пауза, умеренный вес — плотный объём Жиронды для сухой массы.' },
            ]}
          />
         <PopupSelect label="⬇️ Эксцентрик" value={String(eccentricMult)} onChange={v => setEccentricMult(parseFloat(v))} hint="Множитель эксцентрики — в коде eccentricMult: 1.0 / 1.1 / 1.2 (Schoenfeld 2021)." options={[
            { id:'1.0', label:'1.0 — Норма', desc:'Концентрика = эксцентрика. Стандартный темп 2-1-1-0.' },
            { id:'1.1', label:'1.1 — Лёгкий эксцентрик +10%', desc:'Медленнее опускание, больше микроповреждений, умеренный рост стимула.' },
            { id:'1.2', label:'1.2 — Выраженный эксцентрик +20%', desc:'Выраженный акцент на негативе, требует техники и восстановления.' },
          ]} />
          <PopupNumber label="🍽️ Профицит калорий (ккал/день)" value={calorieSurplus} onChange={v => setCalorieSurplus(Math.round(v))} step={50} min={-500} max={1000} hint="Профицит >100 → +5% MRV, >300 → +10% MRV. Дефицит <-200 → -20% MRV. 0 = нейтрально (Helms 2022)." />
          <PopupSelect label="🔄 Вариативность упражнений" value={rotationMode} onChange={v => setRotationMode(v as any)} hint="Вариативность — в коде rotationMode: forbid / strict / variety (как часто менять упражнения)." options={[
            { id:'forbid', label:'🚫 Запрет — одни и те же', desc:'Строго одни упражнения весь мезоцикл — стабильная прогрессия по весам.' },
            { id:'strict', label:'📅 Строгий — смена раз в 4 недели', desc:'Смена на границе фаз — баланс стабильности и разнообразия.' },
            { id:'variety', label:'🎨 Разнообразие — смена при 2×/мышцу', desc:'Чередование углов при 2+ тренировках мышцы — снижает привыкание.' },
          ]} />
          <PopupSelect label="🔥 Интенсивность тренинга" value={intensityLevel} onChange={v => setIntensityLevel(v as any)} hint="Плотность тренировки — в коде intensityLevel: light / moderate / high (управляет паузой)." options={[
            { id:'light', label:'🌿 Лёгкая — отдых +20%', desc:'Тяж 3 мин, памп 75с. Низкая плотность, подходит при плохом восстановлении.' },
            { id:'moderate', label:'⚖️ Умеренная — стандарт', desc:'Тяж 2-3 мин, памп 60с. Оптимум для большинства.' },
            { id:'high', label:'🔥 Высокая — отдых −20%', desc:'Тяж 1.5 мин, памп 45с. Высокая плотность, метаболический стресс.' },
          ]} />
        </div>
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Подбор упражнений</div>
          {[
            {
              icon: '🚫', title: 'Исключить осевую нагрузку',
              desc: 'Убрать упражнения с нагрузкой на позвоночник (приседы, тяги со штангой)',
              on: avoidAxialLoadUi, set: setAvoidAxialLoadUi, accent: '#ef4444', enabled: true,
            },
            {
              icon: '🏗️', title: 'Меньше многосуставных',
              desc: 'Больше замен на тренажёры и изолирующие упражнения',
              on: fewerCompound, set: setFewerCompound, accent: '#f59e0b', enabled: true,
            },
            {
              icon: '🏋️', title: 'Становая / жим стоя',
              desc: bbGoal === 'strength_mass' ? 'Включить становую и жим стоя в план' : 'Доступно в цели «Сила + Масса»',
              on: allowStrengthLifts, set: setAllowStrengthLifts, accent: '#3b82f6', enabled: bbGoal === 'strength_mass',
            },
          ].map(t => {
            const active = t.enabled && t.on;
            return (
              <button
                key={t.title}
                type="button"
                onClick={() => t.enabled && t.set(!t.on)}
                aria-pressed={!!active}
                aria-disabled={!t.enabled}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8,
                  padding: '10px 12px', borderRadius: 12, cursor: t.enabled ? 'pointer' : 'not-allowed',
                  textAlign: 'left', boxSizing: 'border-box', fontFamily: 'inherit',
                  background: active ? `linear-gradient(135deg, ${t.accent}1e, rgba(24,24,27,0.35))` : 'rgba(255,255,255,0.03)',
                  border: active ? `1px solid ${t.accent}66` : '1px solid rgba(255,255,255,0.08)',
                  opacity: t.enabled ? 1 : 0.45,
                  transition: 'all .15s',
                }}
              >
                <span style={{ fontSize: 16, flexShrink: 0 }}>{t.icon}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: active ? t.accent : '#fff', lineHeight: 1.2 }}>{t.title}</span>
                  <span style={{ display: 'block', fontSize: 10, color: '#fff', lineHeight: 1.3, marginTop: 2 }}>{t.desc}</span>
                </span>
                <span style={{
                  marginLeft: 'auto', width: 36, height: 20, borderRadius: 10, flexShrink: 0, position: 'relative',
                  background: active ? t.accent : 'rgba(255,255,255,0.15)', transition: 'background .2s',
                }}>
                  <span style={{
                    position: 'absolute', top: 2, left: active ? 18 : 2, width: 16, height: 16, borderRadius: '50%',
                    background: '#fff', transition: 'left .2s',
                  }} />
                </span>
              </button>
            );
          })}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
          <PopupExerciseList
            label="⭐ Любимые упражнения"
            ids={bbFavEx}
            onChange={ids => { setBbFavEx(ids); syncProf({ favoriteExercises: ids }); }}
            accent="#00e68a"
          />
          <PopupExerciseList
            label="✕ Не любимые"
            ids={bbExclEx}
            onChange={ids => { setBbExclEx(ids); syncProf({ excludedExercises: ids }); }}
            accent="#ef4444"
          />
        </div>
        <div style={{ marginTop: 4, fontSize: 10, color: '#fff' }}>
          Любимые получают приоритет при отборе упражнений. Не любимые полностью исключаются из генерации плана. Синхронизируется с профилем (🧬 Профиль тренированности).
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
        <div style={{ marginTop:4, fontSize:11, color:'#fff' }}>
          {loadStrategy === 'double_progression' && 'Стратегия PRO-бодибилдеров: добейте повторы до верхней границы, затем повысьте вес на 5%.'}
          {loadStrategy === 'linear' && 'Классическая силовая прогрессия: еженедельное прибавление веса. Эффективно для новичков и intermediates.'}
          {loadStrategy === 'wave' && 'Продвинутая периодизация: 3-нед циклы тяжёлая/средняя/лёгкая неделя. Управление утомлением.'}
          {loadStrategy === 'rpe_based' && 'Для опытных: вес подбирается по ощущению (RPE). Авто-регуляция под текущее состояние.'}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setAutoDeload(v => !v)}
        aria-pressed={autoDeload}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10, marginTop: 8,
          padding: '11px 12px', borderRadius: 12, cursor: 'pointer', textAlign: 'left', boxSizing: 'border-box', fontFamily: 'inherit',
          background: autoDeload ? `linear-gradient(135deg, ${ACCENT}1e, rgba(24,24,27,0.35))` : 'rgba(255,255,255,0.03)',
          border: autoDeload ? `1px solid ${ACCENT}66` : '1px solid rgba(255,255,255,0.08)',
          transition: 'all .15s',
        }}
      >
        <span style={{ fontSize: 16, flexShrink: 0 }}>🛡️</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: autoDeload ? ACCENT : '#fff', lineHeight: 1.2 }}>Авто-разгрузка при ACWR {`>`} 1.3</span>
          <span style={{ display: 'block', fontSize: 10, color: '#fff', lineHeight: 1.3, marginTop: 2 }}>Автоматически вставить разгрузочную неделю при перегрузке (ACWR &gt; 1.3)</span>
        </span>
        <span style={{
          marginLeft: 'auto', width: 36, height: 20, borderRadius: 10, flexShrink: 0, position: 'relative',
          background: autoDeload ? ACCENT : 'rgba(255,255,255,0.15)', transition: 'background .2s',
        }}>
          <span style={{
            position: 'absolute', top: 2, left: autoDeload ? 18 : 2, width: 16, height: 16, borderRadius: '50%',
            background: '#fff', transition: 'left .2s',
          }} />
        </span>
      </button>
      {savedPlans.length > 0 && (
        <div style={{ marginTop:8, display:'flex', alignItems:'center', gap:8 }}>
          <label style={{ fontSize:11, color:'#fff', fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
            <input type="checkbox" checked={usePreviousPlan} onChange={e => setUsePreviousPlan(e.target.checked)} style={{ accentColor: ACCENT }} />
            🔗 Cross-mesocycle: прогрессия из последнего плана ({savedPlans[0]?.name || ''})
          </label>
        </div>
      )}
      {autoDeload && (
        <div style={{ marginTop:6 }}>
          <PopupSelectSmart label="Тип разгрузки" value={deloadType} onChange={onUserDeloadType} suggestedIds={bbSuggest.deloadType} suggestionReason="По цели" options={[
            { id:'pump', label:'🩸 Pump-разгрузка: лёгкие веса, высокие повторы (рекоменд.)' },
            { id:'neural', label:'🧠 Нейральная: низкий объём, умеренный вес, долгий отдых' },
            { id:'full_rest', label:'😴 Полный отдых: минимальная активность, только при перетрене' },
            { id:'mini', label:'🪶 Мини-делоад: −1-2 сета, вес почти тот же, без смены схемы' },
          ]} />
          <div style={{ marginTop:4, padding:'4px 8px', borderRadius:8, background:'rgba(34,197,94,0.06)', fontSize:11, color:'#fff' }}>
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
        <div style={{ marginTop:4, fontSize:10, color:'#fff' }}>
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
              style={{ padding:'5px 10px', borderRadius:14, fontSize:10, fontWeight:700, cursor:'pointer', minHeight:38, border:on?'1px solid #60a5fa':'1px solid rgba(255,255,255,0.08)', background:on?'rgba(96,165,250,0.15)':'rgba(255,255,255,0.02)', color:on?'#60a5fa':'#fff' }}>{label}{on?' ✓':''}</button>;
          })}
        </div>
        <div style={{ marginTop:4, fontSize:10, color:'#fff' }}>Если ничего не выбрано — используются все упражнения. Выбор ограничивает пул отбора.</div>
      </div>
      {/* Карточка травм */}
      <div style={{ marginTop:8 }}>
        <InjurySelectCard
          injuries={injuries}
          onChange={setInjuries}
        />
      </div>
      {/* PRO: Mobility restrictions — biomechanics-based exercise filtering */}
      <div style={{ marginTop:8, padding:12, borderRadius:12, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.18)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
          <div style={{ fontSize:12, fontWeight:800, color:'#f59e0b' }}>🦴 Ограничения мобильности</div>
          <span style={{ fontSize:9, fontWeight:700, padding:'2px 8px', borderRadius:999, background:'rgba(245,158,11,0.12)', color:'#f59e0b', border:'1px solid rgba(245,158,11,0.3)' }}>биомеханика</span>
        </div>
        <div style={{ fontSize:10, color:'#fff', lineHeight:1.45, marginBottom:8 }}>
          Если какое-то движение даётся тяжело из-за ограниченной подвижности сустава — отметьте зону. Такие упражнения будут <b style={{ color:'#fbbf24' }}>заменены</b> на биомеханически безопасные альтернативы.
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
          {([
            { id: 'shoulder', icon: '🤸', label: 'Плечи', desc: 'жим над головой, за голову, тяга к подбородку' },
            { id: 'hip', icon: '🦵', label: 'Таз', desc: 'глубокие приседы, sissy, гоблет' },
            { id: 'ankle', icon: '🦶', label: 'Голеностоп', desc: 'приседания, выпады, болгарские' },
            { id: 'lower_back', icon: '🔙', label: 'Поясница', desc: 'становая, тяга в наклоне, RDL' },
            { id: 'wrist', icon: '✋', label: 'Запястья', desc: 'сгибания со штангой, франц. жим' },
          ] as const).map(r => {
            const active = mobilityRestrictions.includes(r.id);
            return (
              <button key={r.id} onClick={() => setMobilityRestrictions(prev => active ? prev.filter(x => x !== r.id) : [...prev, r.id])}
                style={{ padding:'7px 10px', borderRadius:10, fontSize:11, cursor:'pointer', textAlign:'left', minWidth:'110px', flex:'1 1 auto',
                  border: active ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.1)', background: active ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.03)', color: active ? '#f59e0b' : '#fff' }}>
                <div style={{ fontWeight:700, display:'flex', alignItems:'center', gap:5 }}>{r.icon} {r.label} {active && <span style={{ marginLeft:'auto', fontSize:10 }}>✕</span>}</div>
                <div style={{ fontSize:8.5, opacity:0.75, marginTop:2, lineHeight:1.3 }}>{r.desc}</div>
              </button>
            );
          })}
        </div>
        <div style={{ marginTop:8, fontSize:9, color:'#fff', lineHeight:1.45 }}>
          💡 <b style={{ color:'#fff' }}>Чем отличается от «Травм»:</b> травмы защищают <b>мышцу</b> (исключение или щадящая нагрузка), а мобильность — конкретные <b>движения</b>. Работают вместе, не дублируя друг друга.
        </div>
      </div>

      <button style={{ ...BTN, width:'100%', marginTop:12 }} onClick={() => setStep('ped')}>Далее: PED и рабочие веса →</button>
    </div>
  );

  const renderPedWorkMax = () => (
    <div>
      <div style={H}>💉 Шаг 2: Фармакология и рабочие веса</div>
      <PedInputPanel
        peds={peds}
        onToggle={p => setPeds(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
        pedDoses={pedDoses}
        onDose={(p, v) => setPedDoses(d => ({ ...d, [p]: v }))}
        courseIntensity={courseIntensity}
        onIntensity={setCourseIntensity}
      />
      <PedAdaptationCard adaptation={pedAdapt} />
      {peds.length > 0 && (() => {
        try {
          const meth = recommendPEDMethodology({ peds: peds as any, pedDoses, level: bbLevel, goal: bbGoal, focus: bbTrainingFocus });
          return (
            <div style={{ marginTop:8, padding:10, borderRadius:10, background:'rgba(139,92,246,0.06)', border:'1px solid rgba(139,92,246,0.18)' }}>
              <div style={{ fontSize:11, fontWeight:800, color:'#a78bfa', marginBottom:6 }}>🧬 PED-методика — адаптация плана под курс (тяж/памп не ломаются)</div>
              {meth.jointGuard && <div style={{ fontSize:11, color:'#fff', marginBottom:4, padding:'5px 7px', background:'rgba(59,130,246,0.08)', borderRadius:6, border:'1px solid rgba(59,130,246,0.15)' }}>🛡️ Защита суставов: тяжёлые базовые остаются тяжёлыми (RIR 1-2), но осевая нагрузка на позвоночник (присед/становая/жим стоя) заменяется на машины/блоки/тросы, темп 4-2-1-0 для контроля. Сухожилия на курсе отстают от мышц — снижаем риск травмы.</div>}
              {meth.insulinPumpWindow && <div style={{ fontSize:11, color:'#fff', marginBottom:4, padding:'5px 7px', background:'rgba(168,85,247,0.08)', borderRadius:6, border:'1px solid rgba(168,85,247,0.15)' }}>💉 Окно пампа GH+инсулин: только в памп-дни — внутри тренировки 30-60 г быстрых углеводов + 10 г EAA (незаменимые аминокислоты) для суперкомпенсации гликогена и пампа. Только на курсе GH+инсулин.</div>}
              {meth.bfrAllowed && !meth.insulinPumpWindow && <div style={{ fontSize:11, color:'#fff', marginBottom:4, padding:'5px 7px', background:'rgba(236,72,153,0.08)', borderRadius:6, border:'1px solid rgba(236,72,153,0.15)' }}>🩸 BFR доступен: окклюзионный тренинг 20-30% от 1ПМ, схема 30-15-15-15 с паузой 30 сек, только для памп-изоляций (бицепс/трицепс/дельты), не для базы. Усиливает метаболический стресс без высокой механической нагрузки.</div>}
              {meth.periWorkout?.intraNote && <div style={{ fontSize:10, color:'#fbbf24', marginBottom:4 }}>🍚 {meth.periWorkout.intraNote}</div>}
              {meth.periWorkout?.warning && <div style={{ fontSize:10, color:'#f87171', marginBottom:4 }}>⚠ {meth.periWorkout.warning}</div>}
              <div style={{ fontSize:10, color:'#fff', opacity:0.85 }}>📋 Тяж: {meth.recommendedScheme.heavy} · Памп: {meth.recommendedScheme.pump} {proPreset !== 'none' ? `· Пресет ${proPreset}` : ''}</div>
              <div style={{ fontSize:10, color:'#fff', opacity:0.7, marginTop:4 }}>🔄 Все сплиты адаптируются под фарму (выбор сохранён, объём ×{(pedAdapt.combinedMrvMultiplier||1).toFixed(2)})</div>
            </div>
          );
        } catch { return null; }
      })()}
      <div style={{ display:'flex', gap:8, marginTop:8, flexWrap:'wrap' }}>
        <button onClick={() => setBfrMode(v=>!v)} style={{ padding:'6px 12px', borderRadius:10, fontSize:11, fontWeight:700, cursor:'pointer', background: bfrMode ? 'rgba(236,72,153,0.18)' : 'rgba(255,255,255,0.04)', border: bfrMode ? '1px solid #ec4899' : '1px solid rgba(255,255,255,0.1)', color: bfrMode ? '#ec4899' : '#fff' }}>{bfrMode ? '🩸 BFR включён (30-15-15-15)' : '🩸 BFR окклюзия (только памп)'}</button>
        <button onClick={() => setBlastCruiseEnabled(v=>!v)} style={{ padding:'6px 12px', borderRadius:10, fontSize:11, fontWeight:700, cursor:'pointer', background: blastCruiseEnabled ? 'rgba(250,204,21,0.18)' : 'rgba(255,255,255,0.04)', border: blastCruiseEnabled ? '1px solid #facc15' : '1px solid rgba(255,255,255,0.1)', color: blastCruiseEnabled ? '#facc15' : '#fff' }}>{blastCruiseEnabled ? `🔄 Blast ${blastWeeks}н / Cruise ${cruiseWeeks}н` : '🔄 Blast/Cruise выкл'}</button>
        {blastCruiseEnabled && <>
          <PopupNumber label='Blast нед' value={blastWeeks} min={4} max={12} onChange={setBlastWeeks} />
          <PopupNumber label='Cruise нед' value={cruiseWeeks} min={2} max={8} onChange={setCruiseWeeks} />
        </>}
        <PopupSelect label='🏆 Pro-пресет (методики профи)' value={proPreset} onChange={v=>{ setProPreset(v); if(v==='dc'&&dupMode==='none') setDupMode('strength_hypertrophy' as any); if(v==='fortitude'){ setSupersetMode('giant' as any); if(volumeScheme==='standard') setVolumeScheme('fst7' as any);} }} hint='Готовые связки методик от профи-тренеров — в коде: none/dc/fortitude/meadows' options={[
          {id:'none',label:'Без пресета',desc:'Стандартная сборка по вашим параметрам без пресета'},
          {id:'dc',label:'DC Training (DoggCrapp)',desc:'Низкообъёмный, высокоинтенсивный: 1 тяжёлый сет Rest-Pause 11-15 повторов, прогрессия каждый раз, для продвинутых (≥3 года)'},
          {id:'fortitude',label:'Fortitude (Скотт Стивенсон)',desc:'4×6, гигант-сеты, FST-7, волновая нагрузка — объёмный пресет для опытных, требует восстановления'},
          {id:'meadows',label:'Meadows (Джон Медоуз)',desc:'Акцент на растянутой позиции, памп, медленный эксцентрик, проработка слабых мест — для гипертрофии'},
        ]} />
      </div>
      {bfrMode && (
        <div style={{ marginTop:8, padding:10, borderRadius:10, background:'rgba(236,72,153,0.06)', border:'1px solid rgba(236,72,153,0.18)', fontSize:11, color:'#fff', lineHeight:1.45 }}>
          <div style={{ fontWeight:800, color:'#ec4899', marginBottom:4 }}>🩸 Что такое BFR и как работает</div>
          <div>Окклюзия — жгуты на верхней части конечности, 20-30% от 1ПМ, схема 30 повторов + 15+15+15 с паузой 30 сек. Кровь задерживается, метаболиты копятся, рост без тяжёлых весов. Только для памп-изоляций (бицепс/трицепс/дельты/икры), не для базы. На курсе — усиливает памп, вне курса — для отстающих с малым весом.</div>
          <div style={{ marginTop:6, fontSize:10, color:'#fff', opacity:0.85, padding:'5px 7px', background:'rgba(236,72,153,0.08)', borderRadius:6 }}>В плане: памп-изоляции получат пометку <b>BFR 30-15-15-15 @25% 1ПМ, отдых 30 сек, RIR 2</b>. Тяжёлые базовые не трогаются. Не для новичков и при проблемах с сосудами.</div>
        </div>
      )}
      {blastCruiseEnabled && (
        <div style={{ marginTop:8, padding:10, borderRadius:10, background:'rgba(250,204,21,0.06)', border:'1px solid rgba(250,204,21,0.18)', fontSize:11, color:'#fff', lineHeight:1.45 }}>
          <div style={{ fontWeight:800, color:'#facc15', marginBottom:4 }}>🔄 Что такое Blast/Cruise и как работает</div>
          <div>Blast — 8 недель высокой дозы (объём ×1.15), Cruise — 4 недели низкой (×0.85), чередование для долгосрочного курса. Позволяет держать высокий объём без перетрена, как периодизация на курсе. Настраивается: Blast 4-12 недель, Cruise 2-8 недель.</div>
          <div style={{ marginTop:6, fontSize:10, color:'#fff', opacity:0.85, padding:'5px 7px', background:'rgba(250,204,21,0.08)', borderRadius:6 }}>В плане: недели Blast получат <b>+15% сетов</b>, Cruise — <b>−15% и RIR +1</b>. Автоматически применяется к объёму и восстановлению. Для натуралов — выкл.</div>
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
                  <div><span style={{ color:'#fff' }}>Калории: </span><span style={{ fontWeight:700, color:'#f59e0b' }}>{adjCal}</span></div>
                  <div><span style={{ color:'#fff' }}>Белок: </span><span style={{ fontWeight:700, color:'#22c55e' }}>{n.pro}</span></div>
                  <div style={{ gridColumn:'1/-1' }}><span style={{ color:'#fff' }}>💡 </span><span style={{ color:'#fff' }}>{n.tip}</span></div>
                  {pedAdapt.combinedMrvMultiplier > 1 && (
                    <div style={{ gridColumn:'1/-1', marginTop:4, fontSize:10, color:'#f59e0b' }}>
                      💉 PED увеличивают потребность в калориях и белке — значения скорректированы.
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
      <div style={H}>💪 Рабочие максимумы (кг)</div>
      <div style={{ marginBottom:8, padding:'6px 10px', borderRadius:10, background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.12)', fontSize:11, color:'#fff' }}>
        💡 Введите <b>рабочий вес на 5-8 повторений</b> (НЕ 1ПМ!) для каждой группы. Например: жим лёжа 100кг×8 → «Грудь 100».
        Для икр/пресса — вес в тренажёре. Веса используются для расчёта нагрузки по RIR и %1RM.
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginBottom:10 }}>
        {BB_WM_KEYS.map(k => <PopupNumber key={k} label={BB_WM_RU[k]} value={bbWorkMax[k] || 80} min={10} max={500} suffix=' кг' onChange={v => setBbWorkMax(p => ({ ...p, [k]: v }))} />)}
      </div>
      <button style={{ ...BTN, width:'100%' }} onClick={() => planMode === 'programs' ? buildBb() : setStep('split')}>
        {planMode === 'programs' ? '⚡ Собрать план по программе →' : 'Далее: выбрать сплит →'}
      </button>
      {planMode === 'programs' && (
        <button style={{ ...BTN_GHOST, width:'100%', marginTop:6 }} onClick={() => setStep('params')}>
          ← Назад к параметрам
        </button>
      )}
    </div>
  );

  const renderSplit = () => (
    <div>
      <div style={H}>🏆 Шаг 3: Выбор сплита</div>
      <div style={{ marginBottom:8, padding:'6px 10px', borderRadius:10, background:'rgba(168,85,247,0.06)', border:'1px solid rgba(168,85,247,0.12)', fontSize:11, color:'#fff' }}>
        📅 Фазы: {phases.filter((p,i,a) => p.phase !== a[i-1]?.phase).map((p,i) => <span key={i} style={{ color:PHASE_COLORS[p.phase], fontWeight:700 }}>{PHASE_LABELS[p.phase]}{i < phases.length - 1 ? ' → ' : ''}</span>)}
      </div>
      <div style={{ marginBottom:10, padding:'6px 10px', borderRadius:10, background:'rgba(0,230,138,0.04)', border:'1px solid rgba(0,230,138,0.1)', fontSize:11, color:'#fff' }}>
        💡 Частота каждой группы — ключевой фактор роста. 2×/нед = оптимум для синтеза белка (Schoenfeld 2016, JSF 2019).
        Чипсы <span style={{ color:'#00e68a' }}>зелёные</span> = 2+×/нед (рекомендуемая частота), <span style={{ color:'#fff' }}>серые</span> = 1×/нед.
      </div>
      {bestSplit && (
        <div style={{ marginBottom:10, padding:12, borderRadius:12, background:'linear-gradient(135deg,rgba(250,204,21,0.08),rgba(250,204,21,0.02))', border:'1px solid rgba(250,204,21,0.25)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
            <span style={{ fontWeight:800, fontSize:13, color:'#facc15' }}>🏆 Рекомендованный сплит: {bestSplit.pattern.name}</span>
            <span style={{ fontSize:12, color:'#facc15', fontWeight:700, background:'rgba(250,204,21,0.15)', padding:'2px 10px', borderRadius:8 }}>скор {bestSplit.score}</span>
          </div>
          <div style={{ fontSize:11, color:'#fff', marginBottom:6 }}>{bestSplit.pattern.description}</div>
          {bestSplit.rationale.slice(0, 3).map((x,i) => <div key={i} style={{ fontSize:11, color:'#fff' }}>✓ {x}</div>)}
          <div style={{ display:'flex', gap:8, marginTop:8 }}>
            <button onClick={() => { setSelectedSplitId(bestSplit.pattern.id); }} style={{ padding:'6px 16px', borderRadius:10, fontSize:11, fontWeight:700, cursor:'pointer', background:'rgba(250,204,21,0.15)', border:'1px solid rgba(250,204,21,0.3)', color:'#facc15' }}>✅ Применить</button>
            <button onClick={buildBb} disabled={isBuilding} style={{ padding:'6px 16px', borderRadius:10, fontSize:11, fontWeight:700, cursor: isBuilding ? 'default' : 'pointer', opacity: isBuilding ? 0.6 : 1, background:'rgba(0,230,138,0.15)', border:'1px solid rgba(0,230,138,0.3)', color:'#00e68a' }}>{isBuilding ? '⏳ Сборка…' : '⚡ Собрать план'}</button>
          </div>
        </div>
      )}
      <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:8 }}>
        {ranked.map(r => {
          const sel = selectedSplitId === r.pattern.id;
          const mf = getMuscleFrequencies(r.pattern);
          const isSugSplit = bbSuggest.splitHints.has(r.pattern.id);
          return <div key={r.pattern.id}
            style={{ padding:'10px 12px', borderRadius:10, border:sel?'1px solid #00e68a':isSugSplit?'1px solid rgba(245,158,11,0.25)':'1px solid rgba(255,255,255,0.06)', background:sel?'rgba(0,230,138,0.08)':isSugSplit?'rgba(245,158,11,0.04)':'rgba(255,255,255,0.02)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontWeight:700, fontSize:12, color:sel?'#00e68a':isSugSplit?'#f59e0b':'#fff' }}>{isSugSplit ? '★ ' : ''}{r.pattern.name}</span>
              <span style={{ fontSize:11, color:ACCENT, fontWeight:700, background:'rgba(0,230,138,0.12)', padding:'2px 8px', borderRadius:8 }}>скор {r.score}</span>
            </div>
            <div style={{ ...SMALL, marginTop:4 }}>{r.pattern.description}</div>
            {isSugSplit && <div style={{ fontSize:10, color:'#f59e0b', marginTop:2 }}>★ Совместим с целью «{bbGoal}» + уровнем «{bbLevel}» — рекомендован, но можно выбрать любой</div>}
            {sel && <div style={{ marginTop:6, fontSize:11, color:'#fff' }}>{r.rationale.map((x,i) => <div key={i}>✓ {x}</div>)}</div>}
            <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:4 }}>
              {mf.map(f => (
                <span key={f.tag} style={{ fontSize:11, padding:'1px 6px', borderRadius:4, background:f.freq >= 2 ? 'rgba(0,230,138,0.08)' : 'rgba(255,255,255,0.03)', color:f.freq >= 2 ? '#00e68a' : '#fff' }}>{TAG_LABELS_RU[f.tag] || f.tag} ~ {f.freq}×/нед</span>
              ))}
            </div>
            <button onClick={() => setSelectedSplitId(r.pattern.id)} style={{ marginTop:8, padding:'6px 12px', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer', background:sel?'#00e68a':'rgba(255,255,255,0.06)', color:sel?'#000':'#fff', border:'1px solid '+(sel?'#00e68a':'rgba(255,255,255,0.1)'), width:'100%' }}>{sel ? '✓ Выбран' : 'Выбрать этот сплит'}</button>
          </div>;
        })}
      </div>
      <div style={{ display:'flex', gap:8, marginTop:12 }}>
        <button style={{ ...BTN, flex:1, opacity: isBuilding ? 0.6 : 1 }} disabled={isBuilding} onClick={buildBb}>{isBuilding ? '⏳ Сборка…' : `✅ Собрать план (${bbWeeks} нед, фазовая периодизация)`}</button>
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
          <div style={{ ...H, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span>📋 Шаг 4: План — {builtPlan.pattern.name}</span>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <button
            style={{ ...BTN_GHOST, borderColor:'#22c55e', color:'#22c55e', fontSize:11, padding:'4px 10px' }}
            onClick={handleSendToExecution}
            aria-label="Начать тренировку с этим планом"
          >
            ▶ Начать работу по циклу/программе
          </button>
          </div>
        </div>

        {/* Верхняя инфо перенесена в шаг Качество — здесь только план упражнений */}
        {(() => {
          const vol = builtPlan.rotationMuscleVolume || {};
          const lm = builtPlan.volumeLandmarks || [];
          const MUSCLE_RU_H: Record<string, string> = { chest: 'Грудь', back: 'Спина', shoulders: 'Плечи', delt_front: 'Передняя дельта', delt_mid: 'Средняя дельта', delt_rear: 'Задняя дельта', quads: 'Квадр', hamstrings: 'Бицепс б', glutes: 'Ягодицы', calves: 'Икры', biceps: 'Бицепс', triceps: 'Трицепс', forearms: 'Предпл', abs: 'Пресс', traps: 'Трапец' };
          const muscles = Object.keys(vol).filter(m => MUSCLE_RU_H[m]);
          if (muscles.length === 0) return null;
          // Color: green (MEV) → yellow (MAV) → red (MRV)
          const colorFor = (sets: number, landmark?: any) => {
            if (!landmark) return '#374151';
            if (sets > landmark.mrv + 1) return '#ef4444'; // red — over MRV
            if (sets > landmark.mav) return '#f59e0b';     // yellow — above MAV
            if (sets >= landmark.mev) return '#22c55e';    // green — MEV-MAV range
            return '#3b82f6';                               // blue — below MEV
          };
          const findLandmark = (m: string) => lm.find((l: any) => l.group === m || l.label === m);
          return (
            <div style={{ marginTop:8, padding:12, borderRadius:12, background:'rgba(59,130,246,0.06)', border:'1px solid rgba(59,130,246,0.15)' }}>
              <div style={{ fontSize:12, fontWeight:800, color:'#60a5fa', marginBottom:8 }}>🔥 Тепловая карта объёма</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(100px, 1fr))', gap:6 }}>
                {muscles.sort((a,b) => (vol[b]||0) - (vol[a]||0)).map(m => {
                  const sets = vol[m] || 0;
                  const landmark = findLandmark(m);
                  const color = colorFor(sets, landmark);
                  const pct = landmark ? Math.min(100, Math.round((sets / (landmark.mrv || sets || 1)) * 100)) : 50;
                  return (
                    <div key={m} style={{ padding:'6px 8px', borderRadius:8, background:'rgba(0,0,0,0.2)', border:`2px solid ${color}` }}>
                      <div style={{ fontSize:10, color:'#fff', fontWeight:600 }}>{MUSCLE_RU_H[m]}</div>
                      <div style={{ fontSize:16, fontWeight:800, color }}>{sets}</div>
                      <div style={{ height:4, borderRadius:2, background:'rgba(255,255,255,0.1)', marginTop:4 }}>
                        <div style={{ height:'100%', borderRadius:2, background:color, width:`${pct}%` }} />
                      </div>
                      {landmark && (
                        <div style={{ fontSize:8, color:'#fff', marginTop:2 }}>
                          Мин {landmark.mev} · Опт {landmark.mav} · Макс {landmark.mrv}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop:6, fontSize:9, color:'#fff', display:'flex', gap:12, flexWrap:'wrap' }}>
                <span>🟢 MEV–MAV (оптимум)</span><span>🟡 Выше оптимума</span><span>🔴 Перегруз (выше максимума)</span><span>🔵 Ниже минимума</span>
              </div>
            </div>
          );
        })()}

        {builtPlan.validation && !builtPlan.validation.valid && (
          <div style={{ marginTop:8, padding:'10px 12px', borderRadius:12, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.3)' }}>
            <div style={{ fontSize:12, fontWeight:800, color:'#ef4444', marginBottom:5 }}>🚫 План требует исправления</div>
            {builtPlan.validation.issues.filter((i: { level?: string }) => i.level === 'error').slice(0, 5).map((issue: { message: string }, i: number) => (
              <div key={i} style={{ fontSize:11, color:'#fff', lineHeight:1.4 }}>{issue.message}</div>
            ))}
          </div>
        )}

        {builtPlan.validation && (() => {
          const warnings = builtPlan.validation.issues.filter((issue: { level?: string; code: string }) => issue.level === 'warning' && ['target_volume_deficit', 'session_working_set_cap', 'effective_mrv_overflow', 'low_training_frequency', 'goal_focus_mismatch'].includes(issue.code));
          if (warnings.length === 0) return null;
          return (
            <div style={{ marginTop:8, padding:'10px 12px', borderRadius:12, background:'rgba(245,158,11,0.07)', border:'1px solid rgba(245,158,11,0.25)' }}>
              <div style={{ fontSize:12, fontWeight:800, color:'#f59e0b', marginBottom:5 }}>⚠️ Объём и бюджет требуют внимания</div>
              {warnings.slice(0, 8).map((issue: { message: string }, i: number) => <div key={i} style={{ fontSize:11, color:'#fff', lineHeight:1.4 }}>{issue.message}</div>)}
              <div style={{ marginTop:5, fontSize:10, color:'#fff' }}>Это предупреждения, а не блокировка. Ограничения оборудования, времени и восстановления могут объяснять недобор.</div>
            </div>
          );
        })()}

        {/* Week selector with phase colors */}
        <div style={{ marginTop:10 }}>
          <div style={{ fontSize:11, color:'#fff', marginBottom:6, fontWeight:700 }}>
            Неделя {wk.week} из {W.length} · <span style={{ color:PHASE_COLORS[currentPhase] }}>{PHASE_LABELS[currentPhase]}</span>
            {(() => {
              const cp = (wk as any).contestPhase as PrepPhaseKey | undefined;
              if (!cp) return null;
              const c = PREP_PHASE_COLORS[cp] ?? '#f472b6';
              return (
                <span style={{ marginLeft: 8, padding: '1px 8px', borderRadius: 999, fontSize: 9, fontWeight: 800, color: c, background: c + '22', border: `1px solid ${c}55` }}>
                  {cp === 'preparation' ? '🏁 Подготовка' : cp === 'final_preparation' ? '🏁 Финальная подготовка' : cp === 'taper' ? '📉 Тапер' : '🎭 Пик-неделя'}
                </span>
              );
            })()}
            {(wk as any).peakWeek === true && !(wk as any).contestPhase && (
              <span style={{ marginLeft: 8, padding: '1px 8px', borderRadius: 999, fontSize: 9, fontWeight: 800, color: '#ec4899', background: 'rgba(236,72,153,0.15)', border: '1px solid rgba(236,72,153,0.4)' }}>
                🎭 Пик-неделя
              </span>
            )}
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
          <div style={{ fontSize:11, fontWeight:700, color:'#fff', marginBottom:6 }}>📅 Календарь мезоцикла (цвет = фаза)</div>
          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
            {W.map(w => {
              const ph = phaseForWeek(w.week, bbWeeks);
              const active = w.week === wk.week;
              const daySets = w.sessions.map(s => s.exercises.reduce((ss, e) => ss + e.sets, 0));
              const maxD = Math.max(1, ...W.flatMap(ww => ww.sessions.map(s => s.exercises.reduce((ss, e) => ss + e.sets, 0))));
              return (
                <div key={w.week} onClick={() => setBbWeekSel(w.week)} style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 6px', borderRadius:8, cursor:'pointer', background:active ? PHASE_COLORS[ph] + '15' : 'transparent', borderLeft: '3px solid ' + PHASE_COLORS[ph] + '60' }}>
                  <span style={{ fontSize:11, fontWeight:700, color:active ? PHASE_COLORS[ph] : '#fff', minWidth:26 }}>Н{w.week}</span>
                  <div style={{ flex:1, display:'flex', gap:2 }}>{daySets.map((ds, di) => <div key={di} style={{ flex:1, height:14, borderRadius:3, background: `linear-gradient(180deg,${PHASE_COLORS[ph]},${PHASE_COLORS[ph]}88)`, opacity: 0.15 + 0.85 * (ds / maxD) }} />)}</div>
                  <span style={{ fontSize:11, color:'#fff', minWidth:30, textAlign:'right' }}>{daySets.reduce((a,b)=>a+b,0)}</span>
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
                  <div style={{ color:'#fff', fontSize:10 }}>Сессий (7д)</div>
                  <div style={{ fontWeight:700, color:'#60a5fa' }}>{last7.length}</div>
                </div>
                <div style={{ textAlign:'center', padding:6, borderRadius:8, background:'rgba(96,165,250,0.06)' }}>
                  <div style={{ color:'#fff', fontSize:10 }}>Средний RPE</div>
                  <div style={{ fontWeight:700, color:'#60a5fa' }}>{avgRPE.toFixed(1)}</div>
                </div>
                <div style={{ textAlign:'center', padding:6, borderRadius:8, background: zoneColor + '10' }}>
                  <div style={{ color:'#fff', fontSize:10 }}>ACWR</div>
                  <div style={{ fontWeight:700, color: zoneColor }}>{acwrData.ratio.toFixed(2)} <span style={{ fontSize:11 }}>{zoneLabel}</span></div>
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
                    <div style={{ color:'#fff', fontSize:10 }}>Объём (сеты)</div>
                    <div style={{ fontWeight:700 }}>{w1Sets} → {wCurSets} <span style={{ color: setsDiff >= 0 ? '#22c55e' : '#ef4444' }}>({setsDiff >= 0 ? '+' : ''}{setsDiff})</span></div>
                  </div>
                  <div style={{ padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)' }}>
                    <div style={{ color:'#fff', fontSize:10 }}>Средний RIR</div>
                    <div style={{ fontWeight:700 }}>{w1Rir.toFixed(1)} → {wCurRir.toFixed(1)} <span style={{ color: rirDiff <= 0 ? '#22c55e' : '#f59e0b' }}>({rirDiff >= 0 ? '+' : ''}{rirDiff.toFixed(1)})</span></div>
                  </div>
                  <div style={{ padding:8, borderRadius:8, background:'rgba(255,255,255,0.03)' }}>
                    <div style={{ color:'#fff', fontSize:10 }}>Тоннаж (кг)</div>
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
            // P2-5: тоннаж = weight × reps × sets (реальный тоннаж, не weight × sets).
            // Раньше: weight × sets → 6 sessions×100kg=600 vs 1×200kg=200 — несравнимо.
            // Теперь: weight × reps × sets → нормализованный тоннаж для сравнения недель.
            const totalWt = exs.reduce((s, e) => s + (e.workSets[0]?.weight || 80) * (e.workSets[0]?.reps || 10) * e.sets, 0);
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
                        color: x.week === bbWeekSel ? PHASE_COLORS[x.phase] : '#fff',
                      }}>{x.week}</button>
                      <div style={{ fontSize:11, fontWeight:600, minWidth:56, color: PHASE_COLORS[x.phase] }}>{PHASE_LABELS[x.phase]}</div>
                      <div style={{ fontSize:11, fontWeight:700, minWidth:20, textAlign:'center', color:x.rir <= 1 ? '#ef4444' : x.rir <= 2 ? '#f59e0b' : '#22c55e' }}>RIR{x.rir.toFixed(0)}</div>
                      <div style={{ flex: 1, display:'flex', gap:2, alignItems:'center' }}>
                        <div style={{ height:8, width: Math.round((x.sets / maxSets) * barW), borderRadius:3, background: PHASE_COLORS[x.phase], opacity:0.6, transition:'width 0.5s', minWidth: x.sets > 0 ? 4 : 0 }} />
                        <span style={{ fontSize:11, fontWeight:600, color:'#fff', minWidth:16 }}>{x.sets}</span>
                      </div>
                      <div style={{ flex: 1, display:'flex', gap:2, alignItems:'center' }}>
                        <div style={{ height:6, width: Math.round((x.tonnage / maxTon) * barW), borderRadius:2, background:'#60a5fa', opacity:0.5, transition:'width 0.5s', minWidth: x.tonnage > 0 ? 4 : 0 }} />
                        <span style={{ fontSize:11, fontWeight:600, color:'#fff', minWidth:24 }}>{(x.tonnage / 1000).toFixed(1)}k</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display:'flex', gap:12, marginTop:4, fontSize:11, color:'#fff', borderTop:'1px solid rgba(255,255,255,0.05)', paddingTop:3 }}>
                <span><span style={{ width:8, height:8, borderRadius:2, background:'#22c55e', display:'inline-block', marginRight:2 }} /> сеты/нед</span>
                <span><span style={{ width:8, height:8, borderRadius:2, background:'#60a5fa', display:'inline-block', marginRight:2 }} /> тоннаж</span>
                <span>RIR: 🟢3+ 🟡1-2 🔴0</span>
              </div>
            </div>
          );
        })()}

        {/* Daily session cards — красивые раскрывающиеся карточки дней */}
        <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:12 }}>
          {wk.sessions.map((s, si) => {
            const dayColor = PHASE_COLORS[currentPhase];
            const daySets = s.exercises.reduce((ss, e) => ss + e.sets, 0);
            const isDayCollapsed = collapsedDays.has(si);
            const dayExCount = s.exercises.length;
            return (
              <div key={si} style={{
                background: 'rgba(20,22,28,0.55)',
                backdropFilter: 'blur(18px) saturate(160%)',
                WebkitBackdropFilter: 'blur(18px) saturate(160%)',
                borderRadius: 14,
                border: `1px solid ${dayColor}30`,
                borderLeft: `4px solid ${dayColor}`,
                overflow: 'hidden',
              }}>
                {/* Красивая кнопка-заголовок дня */}
                <button
                  onClick={() => setCollapsedDays(prev => {
                    const next = new Set(prev);
                    if (next.has(si)) next.delete(si);
                    else next.add(si);
                    return next;
                  })}
                  aria-expanded={!isDayCollapsed}
                  style={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '14px 16px',
                    cursor: 'pointer',
                    background: `linear-gradient(135deg, ${dayColor}18, rgba(255,255,255,0.02))`,
                    border: 'none',
                    textAlign: 'left',
                    gap: 12,
                  }}
                >
                  <div style={{ display:'flex', alignItems:'center', gap:10, flex:1, minWidth:0 }}>
                    <span style={{
                      width:36, height:36, borderRadius:10, display:'inline-flex', alignItems:'center', justifyContent:'center',
                      background: dayColor, color:'#000', fontWeight:900, fontSize:14, flexShrink:0
                    }}>{si+1}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:15, fontWeight:800, color:'#fff', lineHeight:1.2 }}>День {si+1} · {sessionTagLabel(s.sessionTag)}</div>
                      <div style={{ fontSize:11, color:'#fff', opacity:0.85, marginTop:2, display:'flex', gap:8, flexWrap:'wrap' }}>
                        <span style={{ padding:'2px 7px', borderRadius:6, background: dayColor+'22', color:dayColor, border:`1px solid ${dayColor}35`, fontWeight:700 }}>{PHASE_LABELS[currentPhase]}</span>
                        <span>{s.character} · {dayExCount} упр · {daySets} сетов</span>
                      </div>
                    </div>
                  </div>
                  <span style={{
                    width:32, height:32, borderRadius:8, display:'inline-flex', alignItems:'center', justifyContent:'center',
                    background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'#fff', fontSize:14, flexShrink:0,
                    transform: isDayCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition:'transform 0.2s'
                  }}>▼</span>
                </button>
                {!isDayCollapsed && (
                  <div style={{ padding:'8px 10px', borderTop:`1px solid ${dayColor}15` }}>

                {/* Упражнения */}
                <div style={{ padding:'4px 0' }}>
                  {s.exercises.map((e, ei) => {
                    const rawW = e.workSets[0]?.weight || 80;
                    const adjW = autoRegOn && autoRegResult ? Math.round(rawW * autoRegResult.topSetPctMultiplier * 10) / 10 : rawW;
                    const adjSets0 = autoRegOn && autoRegResult ? Math.max(1, Math.round(e.sets * autoRegResult.volumeMultiplier)) : e.sets;
                    const editKey = `${si}-${ei}`;
                    const edit = exerciseEdits[editKey] || { sets: adjSets0, reps: e.workSets[0]?.reps || 10, weight: adjW };
                    const isEditing = editMode?.dayIdx === si && editMode?.exIdx === ei;
                    const comment = e.comment || exerciseComment(e, weakPoints, '', currentPhase);
                    const roleColor = e.role === 'primary' ? '#00e68a' : '#a855f7';
                    const isCompound = isCompoundEx(e);
                    const _cat = EXERCISE_CATALOG.find(c => c.name === (e.exerciseName || e.name));
                    const techniqueBase = _cat?.technique || ((_cat as any)?.targetMuscle ? 'Акцент: ' + (_cat as any).targetMuscle : '');
                    const appliedTech = techniqueLabel(lastSetTechnique(e));
                    const technique = appliedTech ? `💥 ${appliedTech} — финальный подход по технике. ` + (techniqueBase ? '· ' + techniqueBase : '') : techniqueBase;
                    const featureBadges = exerciseFeatureBadges(e, dupMode);
                    const { lines: setLines, chain: setChain } = planSetsBreakdown(e, edit);
                    const charColor = e.character === 'тяж' ? '#ef4444' : '#60a5fa';
                    const exCollapsed = collapsedExercises.has(`${si}-${ei}`);
                    return (
                      <div key={ei} style={{
                        padding:'10px 12px', marginBottom:8,
                        background: 'rgba(255,255,255,0.025)',
                        borderRadius:10, border: '0.5px solid rgba(255,255,255,0.04)',
                      }}>
                        {/* Красивая кнопка-заголовок упражнения — скрыть/раскрыть */}
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom: exCollapsed ? 0 : 6 }}>
                          <button
                            onClick={() => setCollapsedExercises(prev => {
                              const next = new Set(prev);
                              const key = `${si}-${ei}`;
                              if (next.has(key)) next.delete(key);
                              else next.add(key);
                              return next;
                            })}
                            aria-expanded={!exCollapsed}
                            style={{
                              flex:1, display:'flex', flexDirection:'column', gap:6, background:'transparent', border:'none', cursor:'pointer', textAlign:'left', padding:0,
                            }}
                          >
                            <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
                              <span style={{ minWidth:22, height:22, borderRadius:'50%', background:'rgba(0,230,138,0.15)', color:'#00e68a', fontSize:12, fontWeight:800, display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{ei+1}</span>
                              <span style={{ fontSize:14, fontWeight:800, color:'#fff', lineHeight:1.25, letterSpacing:'-0.2px', flex:1 }}>{e.name}</span>
                              <span style={{
                                width:24, height:24, borderRadius:6, display:'inline-flex', alignItems:'center', justifyContent:'center',
                                background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'#fff', fontSize:11, flexShrink:0,
                                transform: exCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition:'transform 0.2s'
                              }}>▼</span>
                            </div>
                            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                              <span style={{ fontSize:11, fontWeight:700, padding:'2px 7px', borderRadius:5, background: (isCompound?'#00e68a':'#f59e0b')+'20', color: isCompound?'#00e68a':'#f59e0b', border: '0.5px solid '+(isCompound?'#00e68a':'#f59e0b')+'30' }}>{isCompound?'База':'Изо'}</span>
                              <span style={{ fontSize:11, fontWeight:700, padding:'2px 7px', borderRadius:5, background: roleColor + '20', color: roleColor, border: '0.5px solid ' + roleColor + '30' }}>
                                {e.role === 'primary' ? '🎯 Основное' : '📌 Добивка'}
                              </span>
                              <span style={{ fontSize:11, fontWeight:700, padding:'2px 7px', borderRadius:5, background: charColor + '20', color: charColor, border: '0.5px solid ' + charColor + '30' }}>
                                {e.character === 'тяж' ? '💪 Тяж' : e.character === 'памп' ? '🩸 Памп' : '🌿 Лёг'}
                              </span>
                              {(e as any).warmupActivator && (
                                <span style={{ fontSize:11, fontWeight:700, padding:'2px 7px', borderRadius:5, background:'rgba(148,163,184,0.15)', color:'#94a3b8', border:'0.5px solid rgba(148,163,184,0.3)' }}>
                                  🔥 Разминка
                                </span>
                              )}
                              {e.muscle === 'back' && backSubgroupLabel((e as any).backSubgroup) && (
                                <span style={{ fontSize:11, fontWeight:700, padding:'2px 7px', borderRadius:5, background:'rgba(45,212,191,0.15)', color:'#2dd4bf', border:'0.5px solid rgba(45,212,191,0.3)' }}>
                                  {backSubgroupLabel((e as any).backSubgroup)}
                                </span>
                              )}
                              {['biceps', 'triceps', 'forearms'].includes(e.muscle) && armHeadLabel((e as any).movementPattern) && (
                                <span style={{ fontSize:11, fontWeight:700, padding:'2px 7px', borderRadius:5, background:'rgba(232,121,249,0.15)', color:'#e879f9', border:'0.5px solid rgba(232,121,249,0.3)' }}>
                                  {armHeadLabel((e as any).movementPattern)}
                                </span>
                              )}
                              {isWeakMuscle(e.muscle, weakPoints) && (
                                <span style={{ fontSize:11, fontWeight:700, padding:'2px 7px', borderRadius:5, background:'rgba(250,204,21,0.15)', color:'#facc15', border:'0.5px solid rgba(250,204,21,0.3)' }}>
                                  🔥 Отстающая
                                </span>
                              )}
                              {featureBadges.map((fb, fbi) => (
                                <span key={fbi} style={{ fontSize:11, fontWeight:700, padding:'2px 7px', borderRadius:5, background:fb.color+'20', color:fb.color, border:'0.5px solid '+fb.color+'35' }}>
                                  {fb.icon} {fb.label}
                                </span>
                              ))}
                            </div>
                          </button>
                          <div style={{ display:'flex', gap:6, marginLeft:8, flexShrink:0 }}>
                            <button onClick={() => setSubTarget({ dayIdx: si, exIdx: ei, sessionIdx: si })} title="Заменить"
                              style={{ padding:'3px 8px', borderRadius:8, fontSize:11, fontWeight:600, cursor:'pointer', border:'1px solid rgba(0,230,138,0.2)', background:'rgba(0,230,138,0.06)', color:'#00e68a' }}>
                              🔄
                            </button>
                            <button onClick={() => setEditMode(isEditing ? null : { dayIdx: si, exIdx: ei })} title="Править"
                              style={{ padding:'3px 8px', borderRadius:8, fontSize:11, fontWeight:600, cursor:'pointer', border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.03)', color:'#fff' }}>
                              {isEditing ? '✓' : '✎'}
                            </button>
                          </div>
                        </div>
                        {!exCollapsed && (
                          <>
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
                          {e.workSets[0]?.restSeconds && <Chip label="Отдых" value={e.workSets[0].restSeconds + 'с'} color="#fff" />}
                          <Chip label="Группа" value={muscleLabel(e.muscle)} color="#fff" />
                        </div>

                        {/* Разбивка по подходам (включая дроп-цепочки финального сета) */}
                        {(setLines.length > 0 || setChain) && (
                          <div style={{ marginTop:6, padding:'7px 9px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'0.5px solid rgba(255,255,255,0.07)' }}>
                            <div style={{ fontSize:10, fontWeight:700, color:'#fff', marginBottom:4 }}>📋 Подходы</div>
                            <div style={{ display:'flex', gap:5, flexWrap:'wrap', alignItems:'center' }}>
                              {setLines.map((ln, li) => (
                                <span key={li} style={{ fontSize:11, fontFamily:'monospace', padding:'2px 7px', borderRadius:5, background:'rgba(34,197,94,0.1)', color:'#86efac', border:'0.5px solid rgba(34,197,94,0.25)' }}>{ln}</span>
                              ))}
                              {setChain && (
                                <span style={{ fontSize:11, fontFamily:'monospace', fontWeight:700, padding:'2px 7px', borderRadius:5, background:'rgba(248,113,113,0.12)', color:'#fca5a5', border:'0.5px solid rgba(248,113,113,0.35)' }}>
                                  💥 {setChain.label}: {setChain.parts.join(' → ')}
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Комментарий и полная тренерская инструкция — разбивка по пунктам */}
                        <details style={{ marginTop:6 }} open={false}>
                          <summary style={{ fontSize:11, fontWeight:700, color:'rgba(0,230,138,0.8)', cursor:'pointer', padding:'5px 8px', borderRadius:8, background:'rgba(0,230,138,0.04)' }}>
                            📖 Полная инструкция — развернуто
                          </summary>
                          <div style={{ marginTop:4, fontSize:10, color:'#fff', lineHeight:1.55, padding:'7px 9px', borderRadius:8, background:'rgba(255,255,255,0.025)', border:'1px solid rgba(255,255,255,0.05)' }}>
                            {String(comment).split(' · ').map((part: string, idx: number) => (
                              <div key={idx} style={{ display:'flex', gap:6, marginBottom:3, alignItems:'flex-start' }}>
                                <span style={{ color:'#00e68a', fontWeight:800, flexShrink:0 }}>{idx+1}.</span>
                                <span style={{ flex:1 }}>{part}</span>
                              </div>
                            ))}
                          </div>
                        </details>
                        {(() => {
                          const prof = e.executionProfile || buildExerciseInstructions({ exerciseName: e.name, muscle: e.muscle, role: e.role, trainingFocus: bbTrainingFocus, level: bbLevel, tempo: e.workSets[0]?.tempo, restSeconds: e.workSets[0]?.restSeconds });
                          return (
                          <details style={{ marginTop:4 }}>
                            <summary style={{ fontSize:11, fontWeight:600, color:'#60a5fa', cursor:'pointer' }}>🧬 Биомеханика и мышечный акцент — {prof.pattern}</summary>
                            <div style={{ marginTop:4, padding:'6px 8px', borderRadius:8, background:'rgba(96,165,250,0.05)', color:'#fff', fontSize:10, lineHeight:1.5 }}>
                              <div><b>Паттерн:</b> {prof.pattern}</div>
                              {prof.mmc && <div><b>Связь мышца-мозг:</b> {prof.mmc}</div>}
                              {prof.stretch && <div><b>Растяжение:</b> {prof.stretch}</div>}
                              {prof.peak && <div><b>Пиковое сокращение:</b> {prof.peak}</div>}
                              {prof.cues.length > 0 && <div><b>Ключи:</b> {prof.cues.join('; ')}</div>}
                              {prof.mistakes.length > 0 && <div><b>Ошибки:</b> {prof.mistakes.join('; ')}</div>}
                              <div style={{ marginTop:4, fontSize:9, color:'#fff' }}>Источник: {prof.source === 'exercise-lab' ? 'лаборатория' : prof.source === 'catalog' ? 'каталог' : 'базовый шаблон'} · Темп {prof.tempo} · {prof.order}</div>
                            </div>
                          </details>
                          );
                        })()}
                        {(() => {
                          const profTech = e.executionProfile || buildExerciseInstructions({ exerciseName: e.name, muscle: e.muscle, role: e.role, trainingFocus: bbTrainingFocus, level: bbLevel, tempo: e.workSets[0]?.tempo, restSeconds: e.workSets[0]?.restSeconds });
                          const tech = technique || (e as any).technique || (e.executionProfile as any)?.technique;
                          const cues = profTech?.cues?.length ? profTech.cues : (tech ? [tech] : []);
                          return (
                          <details style={{ marginTop:4 }} open={false}>
                            <summary style={{ fontSize:11, fontWeight:600, color:'rgba(0,230,138,0.75)', cursor:'pointer' }}>💡 Техника выполнения — пошагово</summary>
                            <div style={{ fontSize:10, color:'#fff', padding:'6px 8px', lineHeight:1.5, marginTop:2, borderRadius:8, background:'rgba(0,230,138,0.05)', border:'1px solid rgba(0,230,138,0.1)' }}>
                              {cues.length > 0 ? (
                                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                                  {cues.map((c: string, idx: number) => (
                                    <div key={idx} style={{ display:'flex', gap:6, alignItems:'flex-start' }}>
                                      <span style={{ minWidth:18, height:18, borderRadius:'50%', background:'rgba(0,230,138,0.15)', color:'#00e68a', fontSize:9, fontWeight:800, display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{idx+1}</span>
                                      <span style={{ flex:1 }}>{c}</span>
                                    </div>
                                  ))}
                                  {profTech?.tempo && <div style={{ marginTop:4, padding:'4px 6px', background:'rgba(255,255,255,0.03)', borderRadius:6 }}><b>Темп:</b> {profTech.tempo} — {tempoExplain(profTech.tempo) || 'контролируйте каждую фазу'}</div>}
                                </div>
                              ) : (
                                <div>{tech || 'Контролируйте эксцентрик 2-3с, без рывков, полная амплитуда, дыхание — выдох на усилии.'}</div>
                              )}
                              <div style={{ marginTop:6, fontSize:9, color:'#fff', opacity:0.85, lineHeight:1.35 }}>Дыхание: выдох на усилии, вдох на опускании. Кор держите напряжённым весь подход.</div>
                            </div>
                          </details>
                          );
                        })()}

                        {/* Разминка */}
                        {(e.warmupSets && e.warmupSets.length > 0 ? e.warmupSets : (e.role === 'primary' && e.character === 'тяж' ? buildWarmup(edit.weight, true) : [])).length > 0 && (
                          <details style={{ marginTop:4 }}>
                            <summary style={{ fontSize:11, fontWeight:600, color:'rgba(96,165,250,0.7)', cursor:'pointer' }}>🔥 Разминка ({(e.warmupSets && e.warmupSets.length > 0 ? e.warmupSets : buildWarmup(edit.weight, true)).length} подхода)</summary>
                            <div style={{ display:'flex', gap:8, marginTop:4, flexWrap:'wrap' }}>
                              {(e.warmupSets && e.warmupSets.length > 0 ? e.warmupSets : buildWarmup(edit.weight, true)).map((w, wi) => (
                                <span key={wi} style={{ fontSize:10, color:'#fff', padding:'2px 6px', borderRadius:4, background:'rgba(96,165,250,0.08)' }}>
                                  {w.reps}×{w.load} кг
                                </span>
                              ))}
                            </div>
                          </details>
                        )}

                        {/* Rationale — подробно, без мусора */}
                        {e.rationale && (() => {
                          const targetNote = exerciseTargetNote(e as any);
                          const cleanRationale = String(e.rationale || '').replace(/Опытный уровень:\s*/g, '').replace(/Малые группы:\s*/g, '').trim();
                          return (
                          <details style={{ marginTop:4 }} open={false}>
                            <summary style={{ fontSize:11, fontWeight:600, color:'rgba(96,165,250,0.6)', cursor:'pointer' }}>🧠 Почему именно это упражнение?</summary>
                            <div style={{ fontSize:10, color:'#fff', padding:'6px 8px', lineHeight:1.55, marginTop:2, background:'rgba(96,165,250,0.05)', borderRadius:8, border:'1px solid rgba(96,165,250,0.1)' }}>
                              <div style={{ marginBottom:4 }}><b>Логика подбора:</b> {cleanRationale || e.rationale}</div>
                              {targetNote && <div style={{ marginTop:6, padding:'6px 8px', background:'rgba(59,130,246,0.06)', borderRadius:6, border:'1px solid rgba(59,130,246,0.12)' }}>{targetNote}</div>}
                              <div style={{ marginTop:6, fontSize:9, color:'#fff', opacity:0.9, lineHeight:1.4 }}>
                                Роль: {e.role === 'primary' ? 'основное движение дня — даёт 60-70% стимула' : 'добивка/изоляция — добивает объём и формирует детали'} · 
                                Характер: {e.character === 'тяж' ? 'тяж (6-10 повт, RIR 1-2)' : e.character === 'памп' ? 'памп (12-20, RIR 3)' : 'лёгкий'} · 
                                Паттерн: {(SUMMARY_PATTERN_RU[(e as any).movementPattern || ''] || (e as any).movementPattern || 'силовой') }
                              </div>
                            </div>
                          </details>
                          );
                        })()}
                        {/* Темп — внизу карты */}
                        {e.workSets[0]?.tempo && (
                          <details style={{ marginTop:4 }}>
                            <summary style={{ fontSize:11, fontWeight:600, color:'#a855f7', cursor:'pointer' }}>⏱ Темп: {e.workSets[0].tempo}</summary>
                            <div style={{ fontSize:10, color:'#fff', padding:'4px 8px', lineHeight:1.4, marginTop:2 }}>{tempoExplain(e.workSets[0].tempo) ? `${e.workSets[0].tempo} — ${tempoExplain(e.workSets[0].tempo)}` : e.workSets[0].tempo}</div>
                          </details>
                        )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {/* Feeder sets — перенесено наверх, см. блок в начале плана */}

        {/* Summary */}
        <div style={{ display:'flex', gap:12, marginTop:10 }}>
          <button style={{ ...BTN, flex:1 }} onClick={() => setStep('quality')}>Далее: отчёт качества →</button>
          <button style={BTN_GHOST} onClick={() => setBbWeekSel(1)}>На первую нед</button>
        </div>
        {renderActionRow(false)}
      </div>
    );
  };

  const renderQuality = () => {
    if (!metrics || !quality || !builtPlan) return null;
    const W = builtPlan.weeks;
    // Единый ACWR из селектора (а не 5 расчётов)
    const ratio = acwrData;
    return (
      <div>
        {safetyScore && (
          <div role="status" aria-label={`SafetyScore ${safetyScore.score} из 100`} style={{ marginBottom: 10, borderRadius: 14, border: `1px solid ${safetyScore.riskLevel === 'safe' ? '#22c55e' : safetyScore.riskLevel === 'caution' ? '#f59e0b' : '#ef4444'}`, background: 'rgba(255,255,255,0.03)', overflow:'hidden' }}>
            {/* Header gauge + overall */}
            <div style={{ padding: 12, display:'flex', gap:12, alignItems:'center', background: `linear-gradient(135deg, ${safetyScore.riskLevel==='safe'?'rgba(34,197,94,0.14)': safetyScore.riskLevel==='caution'?'rgba(245,158,11,0.14)':'rgba(239,68,68,0.14)'}, transparent)`}}>
              <div style={{ width:62, height:62, borderRadius:16, display:'flex', alignItems:'center', justifyContent:'center', background: safetyScore.riskLevel==='safe'?'#22c55e': safetyScore.riskLevel==='caution'?'#f59e0b':'#ef4444', color:'#000', fontWeight:900, fontSize:22, boxShadow:'0 4px 12px rgba(0,0,0,0.25)' }}>{safetyScore.score}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:800, color:'#fff' }}>🛡 Безопасность плана: {safetyScore.score}/100 · {safetyScore.riskLevel === 'safe' ? 'Безопасный' : safetyScore.riskLevel === 'caution' ? 'Требует внимания' : 'Опасный'}</div>
                <div style={{ fontSize:11, color:'#fff', opacity:0.9, marginTop:2, lineHeight:1.3 }}>{safetyScore.recommendations[0]}</div>
                <div style={{ fontSize:10, color:'#fff', opacity:0.55, marginTop:4 }}>Веса: суставы 20 · ACWR 20 · восстановление 15 · травмы 15 · MRV 15 · частота 5 · баланс 10 = 100 · Формула каждого фактора — ниже</div>
              </div>
            </div>
            {/* Factor breakdown with calculations */}
            {safetyScore.details?.factorBreakdown && (
              <div style={{ padding:'8px 12px', display:'grid', gridTemplateColumns:'1fr', gap:6, background:'rgba(0,0,0,0.08)' }}>
                <div style={{ fontSize:10, fontWeight:800, color:'#fff', opacity:0.7, letterSpacing:0.3, textTransform:'uppercase' }}>Расчёт по факторам — откуда баллы</div>
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
              </div>
            )}
            {/* Детали суставов/ортопедики скрыты — дубль бюджета и баланса. Оставлен только factorBreakdown. */}
            {/* Распределение нагрузки скрыто — дубль недельного расписания, не относится к фактическому плану. */}
            {/* Диагностика суставов, MRV и частота скрыты — дублируют бюджет объёма и частоту из VolumeBudgetCard. */}
            {/* All issues compact */}
            <div style={{ padding:'8px 12px', background:'rgba(0,0,0,0.12)', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize:10, fontWeight:800, color:'#fff', opacity:0.7, marginBottom:4 }}>Все сигналы ({safetyScore.issues.length})</div>
              {safetyScore.issues.slice(0,8).map((issue, index) => <div key={index} style={{ marginTop: 3, fontSize: 11, color: issue.includes('высокий')|| issue.includes('опасн')|| issue.includes('КРИТИЧНО')?'#ef4444':'#f59e0b', lineHeight:1.35 }}>⚠ {issue}</div>)}
              {safetyScore.issues.length>8 && <div style={{ fontSize:10, color:'#fff', opacity:0.6, marginTop:4 }}>…и ещё {safetyScore.issues.length-8}</div>}
            </div>
            <div style={{ padding:'8px 12px', background:'rgba(34,197,94,0.06)', borderTop:'1px solid rgba(34,197,94,0.12)' }}>
              <div style={{ fontSize:10, fontWeight:800, color:'#22c55e', marginBottom:4 }}>Рекомендации ({safetyScore.recommendations.length})</div>
              {safetyScore.recommendations.slice(0,6).map((r,i)=> <div key={i} style={{ fontSize:11, color:'#fff', marginTop:3, lineHeight:1.35, paddingLeft:6, borderLeft:'2px solid rgba(34,197,94,0.4)' }}>{r}</div>)}
            </div>
          </div>
        )}
        <div style={H}>📊 Шаг 5: Качество и нагрузка плана</div>
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
          return <>
            <div style={{ marginBottom:6, padding:'10px 12px', borderRadius:12, background:PHASE_COLORS[curPh] + '18', border:'1px solid ' + PHASE_COLORS[curPh] + '30' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:6 }}>
                <span style={{ fontSize:12, fontWeight:800, color:PHASE_COLORS[curPh] }}>📌 Фаза (факт недели {wkq.week} из {totalW}): {PHASE_LABELS[curPh]}</span>
                <span style={{ fontSize:11, color:'#fff', background:'rgba(255,255,255,0.06)', padding:'2px 8px', borderRadius:20 }}>RIR факт {avgRirFact.toFixed(1)} · Повт {repMin}-{repMax} · Темп {tempoFact} · Сетов {totalSetsWeek}</span>
              </div>
              <div style={{ marginTop:8, display:'flex', gap:2, height:8, borderRadius:6, overflow:'hidden', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)' }}>
                {builtPlan.weeks.map(w=>{
                  const p = ((w as any).phase || 'accumulation') as BBPhase;
                  const isCur = w.week===wkq.week;
                  return <div key={w.week} title={`Нед ${w.week}: ${PHASE_LABELS[p] || p}`} style={{ flex:1, background: PHASE_COLORS[p] || '#fff', opacity: isCur?1:0.55, borderLeft: isCur?'1px solid #fff': 'none', borderRight: isCur?'1px solid #fff':'none' }} />
                })}
              </div>
              <div style={{ fontSize:10, color:'#fff', opacity:0.62, marginTop:4, lineHeight:1.35 }}>{distText} · всего {totalW} нед · логика: distributePhases(totalWeeks={totalW}, goal={bbGoal}, trainingFocus={bbTrainingFocus || 'hypertrophy'})</div>
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
              </div>
              <div style={{ marginTop:4, fontSize:10, color:'#fff', opacity:0.5, fontFamily:'ui-monospace, monospace' }}>Логика: distributePhases(totalWeeks={totalW}, goal={bbGoal}, trainingFocus={bbTrainingFocus}) → {distText} · curPh из builtPlan.weeks[{wkq.week}].phase</div>
            </div>
            {needsDeloadQ && curPh !== 'deload' && (
              <div style={{ marginBottom:6, padding:8, borderRadius:10, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)', color:'#ef4444', fontSize:11, fontWeight:600 }}>🚨 ACWR {acwrQ?.ratio.toFixed(2)} &gt; 1.3 — рекомендуется разгрузка (факт фаза {PHASE_LABELS[curPh]} не делод).</div>
            )}
            {curPh === 'deload' && (() => {
              const dp = DELOAD_PROTOCOLS[deloadType] || DELOAD_PROTOCOLS.pump;
              return <div style={{ marginBottom:8, padding:10, borderRadius:12, background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.2)' }}><div style={{ fontSize:12, fontWeight:800, color:'#22c55e', marginBottom:6 }}>🔋 Разгрузка — активное восстановление (параметры из DELOAD_PROTOCOLS['{deloadType}'])</div><div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:6, fontSize:11 }}><div style={{ textAlign:'center', padding:6, borderRadius:8, background:'rgba(34,197,94,0.06)' }}><div style={{ color:'#fff', fontSize:10 }}>Объём</div><div style={{ fontWeight:700, color:'#22c55e' }}>−{Math.round((1-dp.volumeMultiplier)*100)}%</div></div><div style={{ textAlign:'center', padding:6, borderRadius:8, background:'rgba(34,197,94,0.06)' }}><div style={{ color:'#fff', fontSize:10 }}>Интенсивность</div><div style={{ fontWeight:700, color:'#22c55e' }}>−{Math.round((1-dp.intensityMultiplier)*100)}%</div></div><div style={{ textAlign:'center', padding:6, borderRadius:8, background:'rgba(34,197,94,0.06)' }}><div style={{ color:'#fff', fontSize:10 }}>RIR</div><div style={{ fontWeight:700, color:'#22c55e' }}>→{dp.rirTarget}</div></div><div style={{ textAlign:'center', padding:6, borderRadius:8, background:'rgba(34,197,94,0.06)' }}><div style={{ color:'#fff', fontSize:10 }}>Повторения</div><div style={{ fontWeight:700, color:'#22c55e' }}>{dp.repRange[0]}-{dp.repRange[1]}</div></div></div></div>;
            })()}
          </>;
        })()}
        {/* 🧩 Оценка сплита — соответствие выбранным параметрам (скор) */}
        {(() => {
          const sel = ranked.find(r=> r.pattern.id===builtPlan.pattern?.id);
          const sc = sel?.score ?? bestSplit?.score ?? 0;
          const maxSc = Math.max(...ranked.map(r=>r.score), 1);
          const pct = Math.round((sc/maxSc)*100);
          const color = pct>=80?'#22c55e': pct>=60?'#f59e0b':'#ef4444';
          return (
            <div style={{ ...CARD, background:`linear-gradient(135deg, ${color}14, transparent)`, border:`1px solid ${color}22`, marginTop:8 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6, flexWrap:'wrap', gap:6 }}>
                <span style={{ fontSize:12, fontWeight:800, color }}>🧩 Сплит: {builtPlan.pattern?.name || '—'} · скор {sc} ({pct}%)</span>
                <span style={{ fontSize:10, color:'#fff', background:'rgba(255,255,255,0.06)', padding:'2px 8px', borderRadius:20 }}>{bbDays}×/нед · {bbLevel} · {bbGoal} · {weakPoints.length?`слабые ${weakPoints.slice(0,2).join(',')}`:'баланс'}</span>
              </div>
              <div style={{ height:6, borderRadius:6, background:'rgba(255,255,255,0.08)', overflow:'hidden', marginBottom:8 }}>
                <div style={{ width:`${pct}%`, height:'100%', background:color, transition:'width 0.3s' }} />
              </div>
              <div style={{ fontSize:10, color:'#fff', lineHeight:1.5 }}>
                <b>Соответствие:</b> {sel ? sel.rationale.slice(0,3).join(' · ') : '—'}<br/>
                <b>Выбрано:</b> дней {bbDays}, цель {bbGoal}, слабые {weakPoints.join(', ')||'—'}, фокус —, оборудование {bbEquipment.slice(0,2).join(', ')||'все'}, травмы {injuries.length||'нет'} · <b>План:</b> {builtPlan.pattern?.schedule?.length||'?'} дн/ротацию
              </div>
              {sel?.warnings?.length ? <div style={{ marginTop:6, fontSize:11, color:'#f59e0b' }}>{sel.warnings.slice(0,2).map((w,i)=><div key={i}>⚠ {w}</div>)}</div> : null}
              <div style={{ marginTop:6, fontSize:10, color:'#fff', opacity:0.55, fontFamily:'ui-monospace, monospace' }}>Формула: rankBBSplits(level, goal, days, weakPoints, focusGroup, donorMuscles, specialization, equipment, injuries, mobility, peds) → {sc} / max {maxSc}. Топ-3: {ranked.slice(0,3).map(r=>`${r.pattern.id} ${r.score}`).join(' · ')}</div>
            </div>
          );
        })()}
        {/* Legacy cycle info — для старых сохранённых bb_cycle планов */}
        {(planMode === 'programs' || planMode === 'bb_cycle') && selectedCycleId && getCycleById(selectedCycleId) && (() => {
          const c = getCycleById(selectedCycleId);
          if (!c) return null;
          return (
            <div style={{ ...CARD, marginBottom:8, background:'rgba(0,230,138,0.04)', border:'1px solid rgba(0,230,138,0.12)' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#00e68a', marginBottom:4 }}>📋 ПРОФ-цикл: {c.meta.title}</div>
              <div style={{ fontSize:11, color:'#fff' }}>
                <div>Упражнения: заданы циклом ({c.week1.reduce((s, d) => s + d.exercises.length, 0)} упр/день)</div>
                <div>Фазы: {c.meta.phases && c.meta.phases.length > 0 ? c.meta.phases.map(ph => ph.title || `нед ${ph.weekStart}-${ph.weekEnd}`).join(', ') : 'RIR-прогрессия'}</div>
                <div>{c.meta.conditions.slice(0, 2).map((cond, i) => <div key={i}>• {cond}</div>)}</div>
              </div>
            </div>
          );
        })()}
        {/* Score gauge — фактические фазы из плана */}
        <div style={{ ...CARD, textAlign:'center', borderLeft:'3px solid ' + (quality.score >= 85 ? '#22c55e' : quality.score >= 65 ? '#eab308' : '#ef4444') }}>
          <div style={{ fontSize:36, fontWeight:800, color:quality.score >=85?'#22c55e':quality.score >=65?'#eab308':'#ef4444' }}>{quality.score}/100</div>
          <div style={{ fontSize:13, fontWeight:700, color:quality.score >=85?'#22c55e':quality.score >=65?'#eab308':'#ef4444' }}>{quality.label}</div>
          <div style={{ marginTop:8, display:'flex', justifyContent:'center', gap:12, flexWrap:'wrap' }}>
            <div style={SMALL}>Всего сетов (пик): <b style={{ color:'#fff' }}>{metrics.totalSets}</b></div>
            <div style={SMALL}>Тяж: <b style={{ color:'#ef4444' }}>{(metrics.тяжPct*100).toFixed(0)}%</b></div>
            <div style={SMALL}>Памп: <b style={{ color:'#60a5fa' }}>{(metrics.пампPct*100).toFixed(0)}%</b></div>
            <div style={SMALL}>RIR: <b style={{ color:'#f59e0b' }}>{metrics.avgRir.toFixed(1)}</b></div>
            <div style={SMALL}>Фаз: <b style={{ color:'#a855f7' }}>{Array.from(new Set(W.map((w:any) => (w as any).phase || 'accumulation'))).length}</b></div>
          </div>
          {pedAdapt.combinedMrvMultiplier > 1 && (
            <div style={{ marginTop:6, fontSize:11, fontWeight:700, color:'#f59e0b', background:'rgba(245,158,11,0.08)', padding:'4px 10px', borderRadius:8, display:'inline-block' }}>
              💉 PED: MRV ×{pedAdapt.combinedMrvMultiplier.toFixed(2)} — пороги MEV/MAV/MRV увеличены
            </div>
          )}
          <div style={{ marginTop:4, fontSize:10, color:'#fff', opacity:0.6 }}>Средний объём по мезо — в «Бюджете объёма», пик — здесь</div>
        </div>
        {/* Бюджет объёма — единственный источник perMuscle (пиковая неделя) */}
        {metrics && <VolumeBudgetCard metrics={metrics} mrvMultiplier={pedAdapt.combinedMrvMultiplier} />}
        {/* Детальный анализ (ротация/усталость/отчёт/баланс) скрыт — дублирует метрики и бюджет объёма. Оставлен баланс в рекомендациях. */}
                {/* Логика построения — ВСЕ пункты, без обрезки и EN-мусора */}
        {(() => {
          const rationale = builtPlan.rationale || [];
          if (rationale.length === 0) return null;
          // Чистим EN-коды и технический мусор — полностью на русский, с привязкой к выбранным параметрам
          const STRAT_RU_L: Record<string,string> = { double_progression:'двойная прогрессия', linear:'линейная', wave:'волновая', rpe_based:'RPE-авторегуляция', undulating:'волновая', block:'блочная' };
          const clean = (r: string): string => {
            let s = String(r || '');
            s = s.replace(/double_progression|linear|wave|rpe_based|undulating|block/g, m => STRAT_RU_L[m] || m);
            // Полная карта EN → RU для остатков rationale из движков
            const MAP: Array<[RegExp,string]> = [
              [/MEV coverage|Adaptive MEV/g, 'покрытие MEV'],
              [/Experienced enhanced/g, 'опытный на курсе'],
              [/Warmup activator/g, 'разминочная активация'],
              [/back budget allocation/g, 'бюджет спины'],
              [/direct residual volume after indirect overlap/g, 'остаточный прямой объём после косвенной нагрузки'],
              [/Усталость и длительность budget:/g, 'Бюджет утомления:'],
              [/Adaptive safety replacement/g, 'Замена по безопасности'],
              [/Controlled rotation:/g, 'Контролируемая ротация:'],
              [/S-MRV/g, 'С-MRV'],
              [/Cross-mesocycle:/g, 'Межмезоцикл:'],
              [/Per-muscle ACWR/g, 'Помышечный ACWR'],
              [/Doнорское перераспределение/g, 'Донорское перераспределение'],
              [/Due to|due to/g, 'из-за'],
              [/volume/g, 'объём'],
              [/sets/g, 'подходов'],
              [/reps/g, 'повт'],
              [/RIR/g, 'RIR'],
              [/week/g, 'нед'],
              [/day/g, 'день'],
              [/exercise/g, 'упражнение'],
              [/muscle/g, 'мышца'],
              [/level/g, 'уровень'],
              [/goal/g, 'цель'],
              [/focus/g, 'фокус'],
              [/methodology/g, 'методика'],
              [/frequency/g, 'частота'],
              [/intensity/g, 'интенсивность'],
              [/recovery/g, 'восстановление'],
            ];
            for (const [re, ru] of MAP) s = s.replace(re, ru);
            // Удаляем технический мусор, не несущий смысла для пользователя (оставляем факт)
            s = s.replace(/MEV coverage|Adaptive MEV|Experienced enhanced|Warmup activator|back budget allocation|direct residual volume after indirect overlap/g, '');
            s = s.replace(/\.\s*\./g, '.').replace(/\s{2,}/g, ' ').trim();
            // Убираем остатки EN в скобках
            s = s.replace(/\b[A-Z]{2,}\b/g, m => m.length<=3 ? m : m); // оставляем короткие аббр.
            return s;
          };
          const shown = rationale.map(clean).filter(Boolean);
          return (
            <div style={{ ...CARD, marginTop:8, background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.15)' }}>
              <div style={{ fontSize:11, fontWeight:800, color:'#60a5fa', marginBottom:6 }}>🧠 Логика построения — почему план такой (все пункты)</div>
              <div style={{ fontSize:10, color:'#fff', lineHeight:1.5 }}>
                {shown.map((r,i) => <div key={i} style={{ marginBottom:3 }}>• {r}</div>)}
              </div>
            </div>
          );
        })()}
        {/* Прогноз по фазам — факт из плана */}
        {(() => {
          const peakWeek = W.reduce((best, w, i) => {
            const ts = w.sessions.reduce((s, ss) => s + ss.exercises.reduce((ss2, e) => ss2 + e.sets, 0), 0);
            return ts > best.ts ? { wk: w.week, ts } : best;
          }, { wk: 1, ts: 0 });
          const actualDeloadWeeks = W.filter((w:any) => (w as any).phase === 'deload' || (w as any).deload).map((w:any) => w.week);
          const hasDeload = actualDeloadWeeks.length > 0;
          const accWeeks = W.filter((w:any) => ((w as any).phase || 'accumulation') === 'accumulation');
          const intensWeeks = W.filter((w:any) => ((w as any).phase || '') === 'intensification');
          return (
            <div style={{ marginTop:8, padding:10, borderRadius:10, background:'rgba(34,197,94,0.04)', border:'1px solid rgba(34,197,94,0.15)' }}>
              <div style={{ fontSize:11, fontWeight:800, color:'#22c55e', marginBottom:6 }}>🔮 Прогноз по фазам</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:11 }}>
                <div>
                  <span style={{ color:'#fff' }}>Пик объёма: </span>
                  <span style={{ fontWeight:700, color:'#f59e0b' }}>нед {peakWeek.wk}</span>
                  <span style={{ color:'#fff' }}> ({peakWeek.ts} сетов)</span>
                </div>
                <div>
                  <span style={{ color:'#fff' }}>Разгрузка: </span>
                  <span style={{ fontWeight:700, color: hasDeload ? '#22c55e' : '#ef4444' }}>
                    {hasDeload ? 'нед ' + actualDeloadWeeks.join(', ') : 'НЕ ЗАПЛАНИРОВАНА ⚠'}
                  </span>
                </div>
                {(() => {
                  const avgRirFor = (weeks: any[]) => {
                    const exs = weeks.flatMap((w:any) => w.sessions.flatMap((s:any) => s.exercises));
                    if (exs.length === 0) return '—';
                    const avg = exs.reduce((a:any,e:any) => a + (Number.isFinite(e.rir) ? e.rir : 2), 0) / exs.length;
                    return avg.toFixed(1);
                  };
                  return (<>
                    <div>
                      <span style={{ color:'#fff' }}>Накопление: </span>
                      <span style={{ fontWeight:700, color:'#60a5fa' }}>{accWeeks.length} нед</span>
                      <span style={{ color:'#fff' }}> (ср. RIR {avgRirFor(accWeeks)})</span>
                    </div>
                    <div>
                      <span style={{ color:'#fff' }}>Интенсификация: </span>
                      <span style={{ fontWeight:700, color:'#ef4444' }}>{intensWeeks.length} нед</span>
                      <span style={{ color:'#fff' }}> (ср. RIR {avgRirFor(intensWeeks)})</span>
                    </div>
                  </>);
                })()}
              </div>
              {!hasDeload && W.length >= 6 && (
                <div style={{ marginTop:6, padding:'4px 8px', borderRadius:8, background:'rgba(239,68,68,0.1)', fontSize:11, color:'#ef4444' }}>
                  ⚠ Мезоцикл {W.length} нед без разгрузки — высокий риск перетрена. Добавьте разгрузочную неделю.
                </div>
              )}
            </div>
          );
        })()}
        {/* Подробная таблица объёма по мышцам — убрана как дубль «Бюджета объёма» (Step 4 heatmap + Step 5 VolumeBudgetCard) */}
        {/* PRO Quality — отдельный блок, данные из единого quality.proResult */}
        {(() => {
          const proQ = (quality as any).proResult as ReturnType<typeof analyzeProQuality> | null;
          if (!proQ) return null;
          return (
            <div style={{ ...CARD, marginTop:8, background:'rgba(168,85,247,0.06)', border:'1px solid rgba(168,85,247,0.15)' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#a855f7', marginBottom:6 }}>🧠 PRO-качество (паттерны/углы/растяжка)</div>
              <div style={{ fontSize:10, color:'#fff', opacity:0.7, marginBottom:6 }}>Оценка техники/углов/растяжки из интеллектуальных тренировок. Скорректировала базовую оценку на {proQ.scoreDelta>0?'+':''}{proQ.scoreDelta}.</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:10 }}>
                <div><b>Паттерны:</b> {proQ.patterns.filter(p=>p.ok).length}/{proQ.patterns.length} в норме {proQ.patterns.filter(p=>!p.ok).map(p=>p.issue).slice(0,2).join('; ') || '—'}</div>
                <div><b>Углы:</b> {proQ.angles.filter(a=>a.ok).length}/{proQ.angles.length} в норме {proQ.angles.filter(a=>!a.ok).map(a=>a.issue).slice(0,2).join('; ') || '—'}</div>
                <div><b>Растяжка:</b> {proQ.stretches.filter(s=>s.ok).length}/{proQ.stretches.length} в норме</div>
                <div><b>Техники:</b> {proQ.technique.pct}% {proQ.technique.ok ? '✅' : '⚠️ ' + (proQ.technique.issue || '')}</div>
              </div>
              {proQ.totalIssues.length > 0 && <div style={{ marginTop:6, fontSize:10, color:'#fff' }}>{proQ.totalIssues.slice(0,3).map((iss,i)=><div key={i}>• {iss}</div>)}</div>}
              {proQ.totalRecommendations.length > 0 && <div style={{ marginTop:4, fontSize:10, color:'#22c55e' }}>{proQ.totalRecommendations.slice(0,3).map((rec,i)=><div key={i}>→ {rec}</div>)}</div>}
              <div style={{ marginTop:4, fontSize:10, color: proQ.scoreDelta >=0 ? '#22c55e' : '#f59e0b' }}>Изменение оценки: {proQ.scoreDelta >0 ? '+' : ''}{proQ.scoreDelta} (уже включено в итог {quality.score}/100)</div>
            </div>
          );
        })()}

        {/* Прогрессия весов по неделям (основные упражнения) — факт из плана */}
        {(() => {
          const totalW = W.length;
          const cols = Math.min(8, totalW);
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
          return (
            <div style={{ ...CARD, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.15)' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b', marginBottom:6 }}>📈 Прогрессия весов (кг) по неделям — факт плана</div>
              <div style={{ overflowX:'auto' }}>
                <div style={{ display:'grid', gridTemplateColumns:'1.2fr ' + '0.45fr '.repeat(cols), gap:2, fontSize:10, minWidth: cols*40+120 }}>
                  <span style={{ fontWeight:700, color:'#fff' }}>Упражнение</span>
                  {Array.from({ length: cols }, (_, i) => (
                    <span key={i} style={{ fontWeight:700, color:'#fff', textAlign:'center' }}>{i+1}</span>
                  ))}
                </div>
                {top.map(ex => {
                  const weights = ex.weights.slice(0, cols);
                  const first = weights.find(w => w > 0) || 0;
                  const last = weights.filter(w => w > 0).pop() || first;
                  const delta = last > first ? '+' + (last - first) : '';
                  return (
                    <div key={ex.name} style={{ display:'grid', gridTemplateColumns:'1.2fr ' + '0.45fr '.repeat(cols), gap:2, fontSize:10, padding:'2px 0', borderTop:'1px solid rgba(255,255,255,0.04)', alignItems:'center' }}>
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
              <div style={{ marginTop:4, fontSize:10, color:'#fff', display:'flex', gap:12 }}>
                <span>🟢 +вес</span><span>🟡 стабильно</span><span>🔴 −вес (разгрузка)</span>
              </div>
              {totalW > 8 && <div style={{ marginTop:4, fontSize:10, color:'#fff', opacity:0.6 }}>Показаны первые 8 нед из {totalW}</div>}
            </div>
          );
        })()}
        {/* Мусорный объём — полностью на русском, проверка с учётом всех выбранных параметров и плана */}
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
              <div style={{ ...CARD, background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.15)', padding:'8px 10px' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#22c55e' }}>🗑 Мусорный объём: чисто ✅ — дублей изоляций нет (проверка по subGroup, compound исключён, икры стоя+сидя по дизайну, слабые группы — скип)</div>
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
              <div style={{ marginTop:6, fontSize:10, color:'#fff', opacity:0.5, fontFamily:'ui-monospace, monospace' }}>Формула: per session seenPatterns[day-muscle-pattern] → если дубль && !isWeak && !calvesByDesign → мусор. isWeak учитывает weakPoints+focusGroup+specializationTargets.</div>
            </div>
          );
        })()}
        {/* Рекомендации — единственные, детали уже в них (quality.details убраны как дубль) */}
        {quality.recommendations && quality.recommendations.length > 0 && (
          <div style={{ ...CARD, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.15)' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b', marginBottom:6 }}>💡 Рекомендации по качеству плана</div>
            {quality.recommendations.map((r, i) => (
              <div key={i} style={{ fontSize:11, color:'#fff', marginBottom:3, paddingLeft:4, borderLeft:'2px solid #f59e0b' }}>{r}</div>
            ))}
          </div>
        )}
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
              <div style={{ fontSize:11, fontWeight:700, color:'#a855f7', marginBottom:6 }}>📉 Динамика RIR по неделям</div>
              <RirDriftChart data={rdata} />
            </div>
          );
        })()}
        {/* ACWR оценка скрыта — дубль safety.factorBreakdown, уже в карточке безопасности. */}
        {/* Дополнительно: прогрессия мезоцикла + сценарии — свернуто по умолчанию */}
        <ExpandableCard
          title="🔧 Дополнительно: прогноз прогрессии и сценарии"
          icon="🔧"
          short="Прогрессия мезоцикла · сценарии «что если» (калории/сон/курс)"
          full={
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <MesocycleProgressionCard weeks={W.length} startVolumeSets={Math.round(W.reduce((s,w)=>s+w.sessions.reduce((ss,sess)=>ss+sess.exercises.reduce((sss,e)=>sss+e.sets,0),0),0)/W.length)} startIntensityPct={0.7} startRIR={2} goal="hypertrophy" title="Прогрессия мезоцикла (ББ)" />
              <WhatIfCard baseRisk={quality?.score ? 100 - quality.score : 20} baseReadiness={Math.round((linked.readiness?.recovery ?? 80))} />
            </div>
          }
        />
        {/* Экспорт — фактические параметры плана */}
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
              hasDeload={(quality as any).hasDeloadActual ?? autoDeload}
              meta={{ splitName: builtPlan.pattern?.name || 'BB-сплит', weeks: W.length, corrections: builtPlan.rationale }}
            />
          </div>
        )}

        <div style={{ display:'flex', gap:8, marginTop:10 }}>
          <button style={{ ...BTN, flex:1 }} onClick={() => setStep('adjust')}>Далее: ручная коррекция →</button>
          <button style={BTN_GHOST} onClick={() => setStep('plan')}>← Назад</button>
        </div>
        {renderActionRow(true)}
      </div>
    );
  };

  const renderAdjust = () => {
    if (!builtPlan || !metrics) return null;
    const W = builtPlan.weeks;
    const wk = W[Math.min(bbWeekSel, W.length) - 1] || W[0];
    const currentPhase = ((wk as any).phase || ((wk as any).deload ? 'deload' : 'accumulation')) as BBPhase;
    return (
      <div>
        <div style={H}>🛠 Шаг 6: Ручная коррекция</div>
        {(() => {
          const fb = getPlanFeedback();
          return fb.reasons.length > 0 && fb.avgRpe > 0 ? (
            <div style={{ ...CARD, marginBottom:10, background:'rgba(139,92,246,0.06)', border:'1px solid rgba(139,92,246,0.2)' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#a78bfa', marginBottom:6 }}>📊 Фидбэк план→выполнение</div>
              {fb.deloadRecommended && <div style={{ padding:'4px 8px', borderRadius:8, background:'rgba(239,68,68,0.12)', color:'#ef4444', fontSize:11, fontWeight:700, marginBottom:6 }}>⛔ РЕКОМЕНДОВАНА РАЗГРУЗКА</div>}
              {fb.reasons.map((r,i) => <div key={i} style={{ fontSize:11, color:'#fff', marginBottom:3, padding:'3px 0' }}>{r}</div>)}
              <div style={{ display:'flex', gap:8, marginTop:6 }}>
                {fb.weightMultiplier !== 1 && <span style={{ padding:'2px 6px', borderRadius:4, fontSize:11, background:'rgba(96,165,250,0.1)', color:'#60a5fa' }}>Вес ×{fb.weightMultiplier}</span>}
                {fb.rirShift !== 0 && <span style={{ padding:'2px 6px', borderRadius:4, fontSize:11, background:'rgba(245,158,11,0.1)', color:'#f59e0b' }}>RIR {fb.rirShift > 0 ? '+':''}{fb.rirShift}</span>}
                {fb.volumeMultiplier !== 1 && <span style={{ padding:'2px 6px', borderRadius:4, fontSize:11, background:'rgba(34,197,94,0.1)', color:'#22c55e' }}>Объём ×{fb.volumeMultiplier}</span>}
              </div>
            </div>
          ) : null;
        })()}
        <PlanFeedbackCard plan={builtPlan} workMax={bbWorkMax} strategy={loadStrategy} onApply={setBuiltPlan} />
        <div style={{ ...CARD, background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.15)', marginBottom:10 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#60a5fa', marginBottom:6 }}>🔧 Инструменты коррекции</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {builtPlan.validation && !builtPlan.validation.valid && <div style={{ width:'100%', fontSize:11, color:'#f59e0b' }}>⚠ Есть предупреждения валидации — сохранение доступно, но проверьте замечания.</div>}
             <button style={BTN_GHOST} onClick={() => adjustVolume(0.8)}>📦 Объём -20%</button>
             <button style={BTN_GHOST} onClick={() => adjustVolume(1.1)}>📦 Объём +10%</button>
             <button style={BTN_GHOST} onClick={() => adjustWeight(1.05)}>⚖ Вес +5%</button>
             <button style={BTN_GHOST} onClick={() => adjustWeight(0.95)}>⚖ Вес -5%</button>
             <button style={BTN_GHOST} onClick={() => { setExerciseEdits({}); setStep('split'); }}>🔄 Перестроить план</button>
              <button style={BTN_GHOST} onClick={handleSavePlan}>💾 Сохранить план</button>
              <button style={{ ...BTN_GHOST, borderColor:'#60a5fa', color:'#60a5fa' }} onClick={handleSaveToMyPlans}>💾 В Мои тренировки</button>
              <button style={{ ...BTN_GHOST, borderColor:'#a78bfa', color:'#a78bfa' }} onClick={handleSaveAsUserProgram}>📂 В Мои программы</button>
              <button style={{ ...BTN_GHOST, borderColor:'#22c55e', color:'#22c55e' }} onClick={handleSaveVariant}>💾 Вариант ({savedPlans.length})</button>
              <button style={{ ...BTN_GHOST, borderColor:'#f59e0b', color:'#f59e0b' }} onClick={() => setShowCompare(s => !s)}>⚖ Сравнить</button>
               <button style={{ ...BTN_GHOST, borderColor:'#a855f7', color:'#a855f7' }} onClick={handleSendToExecution}>▶ К выполнению</button>
              <button style={{ ...BTN_GHOST, borderColor:'#ec4899', color:'#ec4899' }} onClick={() => applyPeakWeekToCurrentPlan(peakWeekCategory)}>🎭 Peak week</button>
              <button style={{ ...BTN_GHOST, borderColor:'#f472b6', color:'#f472b6' }} onClick={() => setStep('contest')}>🏁 Contest prep</button>
             <button style={BTN_GHOST} onClick={handlePrintPlan}>🖨 PDF</button>
             <button style={BTN_GHOST} onClick={handleExportCSV}>📥 CSV</button>
           </div>

          {/* Пик-неделя: единая система тапера ББ */}
          {showPeakWeek && peakPrep && (
            <div style={{ marginTop:10, padding:12, borderRadius:12, background:'rgba(236,72,153,0.06)', border:'1px solid rgba(236,72,153,0.15)' }}>
              <div style={{ fontSize:13, fontWeight:800, color:'#ec4899', marginBottom:8 }}>🎭 Пик-неделя (тапер ББ) · шоу {peakPrep.config.showDate}</div>
              <div style={{ marginBottom:10, fontSize:11 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ color:'#fff' }}>Категория:</span>
                  <select value={peakWeekCategory} onChange={e => applyPeakWeekToCurrentPlan(e.target.value as BBContestCategory)} style={{ padding:'4px 8px', borderRadius:6, background:'rgba(255,255,255,0.05)', color:'#fff', border:'1px solid rgba(255,255,255,0.1)', fontSize:11 }}>
                    <option value="mens_physique">{CONTEST_CATEGORY_LABELS.mens_physique}</option>
                    <option value="classic_physique">{CONTEST_CATEGORY_LABELS.classic_physique}</option>
                    <option value="bb_212">{CONTEST_CATEGORY_LABELS.bb_212}</option>
                    <option value="mens_bb">{CONTEST_CATEGORY_LABELS.mens_bb}</option>
                    <option value="bikini">{CONTEST_CATEGORY_LABELS.bikini}</option>
                    <option value="figure">{CONTEST_CATEGORY_LABELS.figure}</option>
                    <option value="wellness">{CONTEST_CATEGORY_LABELS.wellness}</option>
                    <option value="womens_physique">{CONTEST_CATEGORY_LABELS.womens_physique}</option>
                    <option value="womens_bb">{CONTEST_CATEGORY_LABELS.womens_bb}</option>
                  </select>
                  <span style={{ color:'#fff' }}>⭐ Специализация:</span>
                  <select value={peakSpec} onChange={e => applyPeakWeekToCurrentPlan(peakWeekCategory, e.target.value as ContestSpecialization)} style={{ padding:'4px 8px', borderRadius:6, background:'rgba(255,255,255,0.05)', color:'#c084fc', border:'1px solid rgba(168,85,247,0.3)', fontSize:11 }}>
                    {(Object.keys(CONTEST_SPECIALIZATION_LABELS) as ContestSpecialization[]).map(s => (
                      <option key={s} value={s}>{CONTEST_SPECIALIZATION_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
                <div style={{ marginTop:4, fontSize:10, color:'#fff' }}>
                  {peakPrep.config.carbLoadStrategy} загрузка · вода {peakPrep.config.waterStrategy} · Na {peakPrep.config.sodiumStrategy} · {peakPrep.config.weightKg} кг
                </div>
                {peakPrep.competitions.length > 0 && (
                  <div style={{ marginTop: 6, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {peakPrep.competitions.map(c => {
                      const isMain = peakPrep.mainCompetition?.id === c.id;
                      return (
                        <span key={c.id} style={{
                          padding: '2px 8px', borderRadius: 999, fontSize: 9, fontWeight: isMain ? 800 : 600,
                          background: isMain ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.05)',
                          border: isMain ? '1px solid rgba(251,191,36,0.5)' : '1px solid rgba(255,255,255,0.12)',
                          color: isMain ? '#fbbf24' : '#fff',
                        }}>
                          {isMain ? '★ ' : ''}{c.name}{c.priority ? ` [${c.priority}]` : ''}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', fontSize:10, borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ color:'#fff', textAlign:'left' }}>
                      <th style={{ padding:'4px 6px' }}>День</th>
                      <th style={{ padding:'4px 6px' }}>Фаза</th>
                      <th style={{ padding:'4px 6px', textAlign:'right' }}>Ккал</th>
                      <th style={{ padding:'4px 6px', textAlign:'right' }}>Б/У/Ж</th>
                      <th style={{ padding:'4px 6px' }}>💧 Вода</th>
                      <th style={{ padding:'4px 6px', textAlign:'right' }}>Na мг</th>
                      <th style={{ padding:'4px 6px' }}>🏋️ Трен.</th>
                      <th style={{ padding:'4px 6px' }}>🎭 Позы</th>
                    </tr>
                  </thead>
                  <tbody>
                    {peakPrep.peakWeek.map(d => (
                      <tr key={d.day} style={{ borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding:'4px 6px', fontWeight:700 }}>{d.day === 7 ? '🎬 Show' : `Д${d.day}`}</td>
                        <td style={{ padding:'4px 6px', color:'#ec4899' }}>{PHASE_LABELS_RU[d.phase]}</td>
                        <td style={{ padding:'4px 6px', textAlign:'right' }}>{d.kcal}</td>
                        <td style={{ padding:'4px 6px', textAlign:'right' }}>{d.proteinG}/{d.carbsG}/{d.fatG}</td>
                        <td style={{ padding:'4px 6px' }}>{d.waterLiters}л</td>
                        <td style={{ padding:'4px 6px', textAlign:'right' }}>{d.sodiumMg}</td>
                        <td style={{ padding:'4px 6px' }}>{d.training.minutes > 0 ? `${d.training.minutes}'` : '—'}</td>
                        <td style={{ padding:'4px 6px' }}>{d.posingMinutes}'</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop:8, fontSize:11, color:'#fff' }}>
                {peakPrep.rationale.map((r, i) => <div key={i}>{r}</div>)}
              </div>
              <div style={{ marginTop:4, fontSize:9, color:'#fff' }}>
                Наложено на финальную неделю плана: памп-режим (15–20 повт, ~60% веса), сессии 4+ → отдых. K {peakPrep.peakWeek[0]?.potassiumMg} мг — не снижать.
              </div>
              <div style={{ marginTop:6 }}>
                {peakPrep.warnings.map((w, i) => (
                  <div key={i} style={{ fontSize:10, color:'#f87171', marginTop:2 }}>{w}</div>
                ))}
              </div>
            </div>
          )}

          {/* Мульти-планы: сравнение вариантов */}
          {showCompare && savedPlans.length > 0 && (
            <div style={{ marginTop:10, padding:12, borderRadius:12, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.15)' }}>
              <div style={{ fontSize:12, fontWeight:800, color:'#f59e0b', marginBottom:8 }}>⚖ Сравнение вариантов ({savedPlans.length})</div>
              <div style={{ overflowX:'auto', scrollbarWidth:'none' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:10, minWidth:500 }}>
                  <thead>
                    <tr style={{ color:'#fff', textAlign:'left' }}>
                      <th style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.1)' }}>Вариант</th>
                      <th style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.1)', textAlign:'center' }}>Сеты</th>
                      <th style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.1)', textAlign:'center' }}>RIR</th>
                      <th style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.1)', textAlign:'center' }}>Дней</th>
                      <th style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.1)', textAlign:'center' }}>Групп</th>
                       <th style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.1)', textAlign:'center' }}>PED MRV</th>
                       <th style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.1)', textAlign:'center' }}>Пик direct/effective</th>
                       <th style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.1)', textAlign:'center' }}>Время/axial</th>
                      <th style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.1)', textAlign:'center' }}>Кач-во</th>
                      <th style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.1)' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {savedPlans.map(v => (
                      <tr key={v.id} style={{ color:'#fff' }}>
                        <td style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.05)', fontWeight:600 }}>{v.name}</td>
                        <td style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.05)', textAlign:'center' }}>{v.metrics.totalSets}</td>
                        <td style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.05)', textAlign:'center' }}>{v.metrics.avgRir.toFixed(1)}</td>
                        <td style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.05)', textAlign:'center' }}>{v.metrics.sessionsPerWeek}</td>
                        <td style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.05)', textAlign:'center' }}>{v.metrics.muscleCount}</td>
                        <td style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.05)', textAlign:'center' }}>×{v.metrics.mrvMult.toFixed(2)}</td>
                         <td style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.05)', textAlign:'center' }}>{v.metrics.peakDirectSets ?? '—'} / {v.metrics.peakEffectiveSets != null ? Math.round(v.metrics.peakEffectiveSets * 10) / 10 : '—'}</td>
                         <td style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.05)', textAlign:'center' }}>{v.metrics.maxSessionMinutes ?? '—'} / {v.metrics.maxAxialCost != null ? v.metrics.maxAxialCost.toFixed(1) : '—'}</td>
                        <td style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.05)', textAlign:'center' }}>
                          <span style={{ color: v.metrics.qualityScore >= 75 ? '#22c55e' : v.metrics.qualityScore >= 50 ? '#f59e0b' : '#ef4444', fontWeight:700 }}>{v.metrics.qualityScore}</span>
                        </td>
                        <td style={{ padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.05)', display:'flex', gap:4 }}>
                          <button onClick={() => handleLoadVariant(v)} style={{ padding:'3px 8px', borderRadius:6, border:'1px solid rgba(0,230,138,0.3)', background:'rgba(0,230,138,0.08)', color:'#00e68a', cursor:'pointer', fontSize:11, fontWeight:700 }}>↩</button>
                          <button onClick={() => handleDeleteVariant(v.id)} style={{ padding:'3px 8px', borderRadius:6, border:'1px solid rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.08)', color:'#ef4444', cursor:'pointer', fontSize:11, fontWeight:700 }}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop:6, fontSize:10, color:'#fff' }}>↩ — загрузить вариант · ✕ — удалить · максимум 8 вариантов</div>
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
                return <button key={w.week} onClick={() => setBbWeekSel(w.week)} style={{ padding:'3px 8px', borderRadius:8, fontSize:11, cursor:'pointer', border:w.week===bbWeekSel?'1px solid ' + PHASE_COLORS[ph]:'1px solid rgba(255,255,255,0.08)', background:w.week===bbWeekSel?PHASE_COLORS[ph]+'20':'transparent', color:w.week===bbWeekSel?PHASE_COLORS[ph]:'#fff' }}>{w.week}</button>;
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
                  const isComp = isCompoundEx(e);
                  const altExercises = getExercisesByGroup(e.muscle).filter(x => x.name !== e.name).slice(0, 5);
                  const editBadges = exerciseFeatureBadges(e, dupMode);
                  const { lines: editSetLines, chain: editSetChain } = planSetsBreakdown(e, edit);
                  return <div key={ei} style={{ marginBottom:8, padding:'8px 10px', borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontWeight:700, fontSize:11, color:'#fff', marginBottom:4 }}>{ei+1}. {e.name} <span style={{ fontWeight:400, fontSize:11, color:'#fff' }}>({muscleLabel(e.muscle)})</span> <span style={{ fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:5, background:(isComp?'#00e68a':'#f59e0b')+'20', color:isComp?'#00e68a':'#f59e0b', marginLeft:6 }}>{isComp?'База':'Изо'}</span>
                      {(e as any).warmupActivator && <span style={{ fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:5, background:'rgba(148,163,184,0.15)', color:'#94a3b8', marginLeft:6 }}>🔥 Разминка</span>}
                      {e.muscle === 'back' && backSubgroupLabel((e as any).backSubgroup) && <span style={{ fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:5, background:'rgba(45,212,191,0.15)', color:'#2dd4bf', marginLeft:6 }}>{backSubgroupLabel((e as any).backSubgroup)}</span>}
                      {['biceps', 'triceps', 'forearms'].includes(e.muscle) && armHeadLabel((e as any).movementPattern) && <span style={{ fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:5, background:'rgba(232,121,249,0.15)', color:'#e879f9', marginLeft:6 }}>{armHeadLabel((e as any).movementPattern)}</span>}
                      {editBadges.map((fb, fbi) => <span key={fbi} style={{ fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:5, background:fb.color+'20', color:fb.color, marginLeft:6 }}>{fb.icon} {fb.label}</span>)}
                    </div>
                    <div style={{ display:'flex', gap:8, marginBottom:6, flexWrap:'wrap', alignItems:'center' }}>
                      <div><span style={{ ...SMALL, fontSize:11 }}>Сеты</span><input type="number" value={edit.sets} min={0} max={20} onChange={e2 => setExerciseEdits(p => ({ ...p, [editKey]: { ...edit, sets: parseInt(e2.target.value) || 0 } }))} style={{ width:45, background:'#18181b', color:'#fff', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, padding:'4px 8px', fontSize:11 }} /></div>
                      <div><span style={{ ...SMALL, fontSize:11 }}>Повт</span><input type="number" value={edit.reps} min={1} max={30} onChange={e2 => setExerciseEdits(p => ({ ...p, [editKey]: { ...edit, reps: parseInt(e2.target.value) || 1 } }))} style={{ width:45, ...IN }} /></div>
                      <div><span style={{ ...SMALL, fontSize:11 }}>Вес, кг</span><input type="number" value={edit.weight} min={0} max={500} onChange={e2 => setExerciseEdits(p => ({ ...p, [editKey]: { ...edit, weight: parseInt(e2.target.value) || 0 } }))} style={{ width:55, ...IN }} /></div>
                      <div><span style={{ ...SMALL, fontSize:11 }}>RIR</span><span style={{ fontSize:11, fontWeight:700, color:'#f59e0b', marginLeft:4 }}>{e.rir}</span></div>
                      <button onClick={() => setExSwapModal({ si, ei, muscle: e.muscle, currentName: e.name })} style={{ padding:'3px 8px', borderRadius:8, fontSize:11, cursor:'pointer', border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.03)', color:'#fff' }}>🔄 Заменить</button>
                      <button onClick={() => handleMoveExercise(si, ei, -1)} disabled={ei === 0} style={{ padding:'3px 8px', borderRadius:8, fontSize:11, cursor:ei===0?'default':'pointer', border:'1px solid rgba(96,165,250,0.2)', background:ei===0?'transparent':'rgba(96,165,250,0.06)', color:ei===0?'rgba(255,255,255,0.2)':'#60a5fa' }}>↑</button>
                      <button onClick={() => handleMoveExercise(si, ei, 1)} disabled={ei === s.exercises.length - 1} style={{ padding:'3px 8px', borderRadius:8, fontSize:11, cursor:ei===s.exercises.length-1?'default':'pointer', border:'1px solid rgba(96,165,250,0.2)', background:ei===s.exercises.length-1?'transparent':'rgba(96,165,250,0.06)', color:ei===s.exercises.length-1?'rgba(255,255,255,0.2)':'#60a5fa' }}>↓</button>
                    </div>
                    {(editSetLines.length > 0 || editSetChain) && (
                      <div style={{ marginTop:6, padding:'6px 8px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'0.5px solid rgba(255,255,255,0.07)', display:'flex', gap:5, flexWrap:'wrap', alignItems:'center' }}>
                        {editSetLines.map((ln, li) => <span key={li} style={{ fontSize:11, fontFamily:'monospace', padding:'2px 7px', borderRadius:5, background:'rgba(34,197,94,0.1)', color:'#86efac', border:'0.5px solid rgba(34,197,94,0.25)' }}>{ln}</span>)}
                        {editSetChain && <span style={{ fontSize:11, fontFamily:'monospace', fontWeight:700, padding:'2px 7px', borderRadius:5, background:'rgba(248,113,113,0.12)', color:'#fca5a5', border:'0.5px solid rgba(248,113,113,0.35)' }}>💥 {editSetChain.label}: {editSetChain.parts.join(' → ')}</span>}
                      </div>
                    )}
                    {altExercises.length > 0 && <div style={{ fontSize:11, color:'#fff' }}>Альтернативы: {altExercises.map(x => x.name).join(', ')}</div>}
                    <div style={{ marginTop:4, padding:'3px 6px', borderRadius:4, background:'rgba(0,230,138,0.04)', fontSize:11, color:'#fff' }}>💡 {exerciseComment(e, weakPoints, '', currentPhase)}</div>
                  </div>;
                })}
              </div>
            } />
          ))}
        </div>
        <div style={{ display:'flex', gap:8, marginTop:12 }}>
          <button style={{ ...BTN, flex:1 }} onClick={() => setStep('contest')}>Далее: Contest prep →</button>
          <button style={BTN_GHOST} onClick={() => setStep('quality')}>← Назад</button>
        </div>
      </div>
    );
  };

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

        {/* Параметры */}
        <div style={{ ...CARD, marginTop:10 }}>
          <div style={{ fontSize:12, fontWeight:800, color:'#ec4899', marginBottom:8 }}>📅 Параметры подготовки</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
            <div>
              <div style={{ ...SMALL, marginBottom:4 }}>📆 Дата шоу</div>
              <input type="date" value={prepShowDate} onChange={e => handleShiftPrepShowDate(e.target.value)} style={{ ...IN, width:'100%' }} />
            </div>
            <div>
              <div style={{ ...SMALL, marginBottom:4 }}>🎭 Категория</div>
              <select value={peakWeekCategory} onChange={e => setPeakWeekCategory(e.target.value as BBContestCategory)} style={{ ...IN, width:'100%' }}>
                {(Object.keys(CATEGORY_PROFILES) as BBContestCategory[]).map(c => (
                  <option key={c} value={c}>{CONTEST_CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ ...SMALL, marginBottom:4 }}>⭐ Специализация</div>
              <select value={peakSpec} onChange={e => setPeakSpec(e.target.value as ContestSpecialization)} style={{ ...IN, width:'100%' }}>
                {(Object.keys(CONTEST_SPECIALIZATION_LABELS) as ContestSpecialization[]).map(s => (
                  <option key={s} value={s}>{CONTEST_SPECIALIZATION_LABELS[s]}</option>
                ))}
              </select>
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
          {/* Соревнования — единый словарь A/B/C */}
          <div style={{ marginBottom:8, padding:8, borderRadius:8, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.15)' }}>
            <div style={{ ...SMALL, marginBottom:4, color:'#f87171', fontWeight:700 }}>🏁 Соревнования (необязательно)</div>
            {(prepCompetitions && prepCompetitions.length > 0) ? (
              <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:6 }}>
                {prepCompetitions.map(c => (
                  <div key={c.id} style={{ display:'flex', gap:6, alignItems:'center', padding:'4px 6px', borderRadius:6, background:'rgba(255,255,255,0.04)', border: c.id===prepMainCompetitionId ? '1px solid rgba(251,191,36,0.4)' : '1px solid rgba(255,255,255,0.06)' }}>
                    <button onClick={() => setPrepMainCompetitionId(c.id===prepMainCompetitionId ? undefined : c.id)} style={{ fontSize:11, padding:'2px 6px', borderRadius:4, background: c.id===prepMainCompetitionId ? 'rgba(251,191,36,0.2)' : 'transparent', color: c.id===prepMainCompetitionId ? '#fbbf24' : 'rgba(255,255,255,0.5)', border:'1px solid rgba(255,255,255,0.1)', cursor:'pointer' }}>{c.id===prepMainCompetitionId ? '★' : '☆'}</button>
                    <input value={c.name} onChange={e => setPrepCompetitions(prev => (prev||[]).map(x => x.id===c.id ? {...x, name:e.target.value} : x))} style={{ flex:1, background:'transparent', color:'#fff', border:'1px solid rgba(255,255,255,0.1)', borderRadius:4, padding:'2px 6px', fontSize:11 }} />
                    <select value={c.priority || 'B'} onChange={e => setPrepCompetitions(prev => (prev||[]).map(x => x.id===c.id ? {...x, priority:e.target.value as any} : x))} style={{ background:'#18181b', color:'#fff', border:'1px solid rgba(255,255,255,0.1)', borderRadius:4, fontSize:10 }}>
                      <option value="A">A главный</option><option value="B">B контроль</option><option value="C">C тренир.</option>
                    </select>
                    <input type="date" value={c.date || ''} onChange={e => setPrepCompetitions(prev => (prev||[]).map(x => x.id===c.id ? {...x, date:e.target.value || undefined} : x))} style={{ background:'transparent', color:'#fbbf24', border:'1px solid rgba(255,255,255,0.1)', borderRadius:4, fontSize:10 }} />
                    <button onClick={() => setPrepCompetitions(prev => (prev||[]).filter(x => x.id!==c.id))} style={{ color:'#f87171', background:'transparent', border:'none', cursor:'pointer', fontSize:12 }}>✕</button>
                  </div>
                ))}
              </div>
            ) : <div style={{ fontSize:10, color:'rgba(255,255,255,0.55)', marginBottom:6 }}>Одно шоу — дата выше. Добавьте старты для мульти-пика A/B/C.</div>}
            <button onClick={() => setPrepCompetitions(prev => [...(prev||[]), { id:`comp_${Date.now().toString(36)}`, name:`Старт ${((prev||[]).length)+1}`, priority:'B' }])} style={{ fontSize:10, padding:'4px 8px', borderRadius:6, background:'rgba(239,68,68,0.1)', color:'#f87171', border:'1px dashed rgba(239,68,68,0.3)', cursor:'pointer' }}>＋ Добавить соревнование</button>
          </div>
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
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:8 }}>
            <div>
              <div style={{ ...SMALL, marginBottom:4 }}>💧 Вода</div>
              <div style={{ display:'flex', gap:6 }}>
                {(['minimal', 'moderate', 'classic'] as WaterStrategy[]).map(m => (
                  <button key={m} onClick={() => setPrepWaterMode(m)} style={{ ...BTN_GHOST, background: prepWaterMode === m ? 'rgba(59,130,246,0.2)' : 'transparent', borderColor: prepWaterMode === m ? '#3b82f6' : undefined, color: prepWaterMode === m ? '#60a5fa' : undefined }}>
                    {m === 'minimal' ? 'Minimal' : m === 'moderate' ? 'Moderate' : 'Classic load+cut'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ ...SMALL, marginBottom:4 }}>🧂 Натрий</div>
              <div style={{ display:'flex', gap:6 }}>
                {(['constant', 'cut_2d', 'cut_3d'] as SodiumStrategy[]).map(m => (
                  <button key={m} onClick={() => setPrepSodiumMode(m)} style={{ ...BTN_GHOST, background: prepSodiumMode === m ? 'rgba(245,158,11,0.2)' : 'transparent', borderColor: prepSodiumMode === m ? '#f59e0b' : undefined, color: prepSodiumMode === m ? '#fbbf24' : undefined }}>
                    {m === 'constant' ? 'Constant' : m === 'cut_2d' ? 'Cut 2д' : 'Cut 3д'}
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
                <label style={{ display:'flex', gap:6, alignItems:'center', fontSize:11, color: prepPreferLowFiber ? '#22c55e' : 'rgba(255,255,255,0.6)', cursor:'pointer' }}>
                  <input type="checkbox" checked={prepPreferLowFiber} onChange={e => setPrepPreferLowFiber(e.target.checked)} /> Низковолокнистые карбс
                </label>
                <label style={{ display:'flex', gap:6, alignItems:'center', fontSize:11, color: prepCreatineStop ? '#f87171' : 'rgba(255,255,255,0.6)', cursor:'pointer' }}>
                  <input type="checkbox" checked={prepCreatineStop} onChange={e => setPrepCreatineStop(e.target.checked)} /> Стоп креатин
                </label>
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
          {(prepWaterMode === 'classic' || prepWaterMode === 'moderate' || prepSodiumMode !== 'constant') && (
            <label style={{ display:'flex', gap:8, alignItems:'flex-start', marginBottom:8, fontSize:11, color:'#fbbf24', background:'rgba(245,158,11,0.08)', padding:10, borderRadius:8 }}>
              <input type="checkbox" checked={prepConfirmedManip} onChange={e => setPrepConfirmedManip(e.target.checked)} />
              <span>⚠ Я понимаю: умеренная модуляция воды/натрия допустима только при стабильном здоровье, без противопоказаний; диуретики не назначаются; при симптомах нарушения электролитов — план остановить. Подтверждаю выбор.</span>
            </label>
          )}
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

        {/* Результат */}
        {prepPlan && (
          <div style={{ marginTop:10, padding:12, borderRadius:12, background:'rgba(236,72,153,0.05)', border:'1px solid rgba(236,72,153,0.2)' }}>
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

            {/* 🧪 Test Peak Week */}
            <div style={{ marginBottom:10, padding:10, borderRadius:10, background:'rgba(168,85,247,0.05)', border:'1px solid rgba(168,85,247,0.18)' }}>
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
                    {post.notes.map((n, i) => <div key={`n${i}`} style={{ color:'#fff', marginTop:2 }}>• {n}</div>)}
                    <div style={{ marginTop:4, fontSize:9, color:'#fff' }}>🏋️ {post.training.join(' ')}</div>
                    <div style={{ marginTop:4, color:'rgba(96,165,250,0.75)' }}>⚖️ {post.weightCheck}</div>
                  </div>
                );
              })()}
            </div>

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
  const PREP_MUSCLE_RU: Record<string, string> = {
    chest: 'Грудь', back: 'Спина', shoulders: 'Плечи', arms: 'Руки', biceps: 'Бицепс', triceps: 'Трицепс',
    quads: 'Квадрицепс', hamstrings: 'Бицепс бедра', glutes: 'Ягодицы', calves: 'Икры', abs: 'Пресс', traps: 'Трапеции',
    legs: 'Ноги', core: 'Кор', forearms: 'Предплечья',
    delt_mid: 'Средняя дельта', delt_front: 'Передняя дельта', delt_rear: 'Задняя дельта',
    back_width: 'Ширина спины', back_thickness: 'Толщина спины', chest_upper: 'Верх груди', chest_lower: 'Низ груди',
  };
  const muscleRu = (m: string) => PREP_MUSCLE_RU[m] || m;

  const catOpts = (Object.keys(CATEGORY_PROFILES) as BBContestCategory[]).filter(c => CATEGORY_PROFILES[c].sex === prepSex);
  const prepProfile = prepSplitProfile(prepCat);
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
      setPrepWaterMode(res.prepPlan.peakWeek.waterMode === 'stable' ? 'minimal' : 'moderate' as WaterStrategy);
      setPrepSodiumMode(res.prepPlan.peakWeek.sodiumMode === 'stable' ? 'constant' : 'cut_2d' as SodiumStrategy);
      setPrepCarbMode(res.prepPlan.peakWeek.carbMode === 'conservative' ? 'back' : res.prepPlan.peakWeek.carbMode === 'high' ? 'front' : 'moderate' as CarbLoadStrategy);
      setBuiltPlan(res.bbPlan);
      setPrepApplied(true);
      // 🏁 Авто-подключение к таперу питания: сохраняем prep-план + конфиг и уведомляем
      // планировщик (вкладка «🏁 Тапер ББ» + дневные цели) СРАЗУ при сборке, без доп. клика.
      try {
        const cfg = configFromPlan(res.prepPlan);
        savePrepToProfile(res.prepPlan, cfg);
        window.dispatchEvent(new CustomEvent('he-bb-contest-prep-updated', { detail: { prepPlanId: res.prepPlan.id } }));
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
          window.dispatchEvent(new CustomEvent('he-bb-contest-prep-updated', { detail: { prepPlanId: main.prepPlan.id } }));
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
      window.dispatchEvent(new CustomEvent('he-bb-contest-prep-updated', { detail: { prepPlanId: prepResult.prepPlan.id } }));
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

  const renderPrepCycleMode = () => {
    const steps: Array<{ id: typeof prepStep; label: string }> = [
      { id: 'params', label: '⚙️ Параметры' },
      { id: 'accent', label: '⭐ Акценты/Минимум' },
      { id: 'split', label: '📐 Сплит' },
      { id: 'nutrition', label: '🍽 Prep-питание' },
      { id: 'result', label: '📋 Результат' },
    ];
    const stepIdx = steps.findIndex(s => s.id === prepStep);

    return (
      <div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#ec4899' }}>🏁 Prep-цикл</span>
          <span style={{ fontSize: 10, color: '#fff' }}>Отдельный режим подготовки к соревнованиям (не трогает обычную сборку)</span>
          <button style={{ ...BTN_GHOST, marginLeft: 'auto', color: '#fb7185', borderColor: 'rgba(244,63,94,0.3)' }} onClick={() => { setPrepMode(false); setPrepResult(null); }}>✕ Выйти из prep</button>
        </div>

        {/* Шаги */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
          {steps.map((s, i) => (
            <button key={s.id} onClick={() => { if (i < stepIdx) setPrepStep(s.id); }} style={{
              padding: '6px 10px', borderRadius: 999, border: 'none', cursor: i < stepIdx ? 'pointer' : 'default',
              fontSize: 10, fontWeight: 800, minHeight: 32,
              background: prepStep === s.id ? 'linear-gradient(135deg,#ec4899,#be185d)' : 'rgba(255,255,255,0.05)',
              color: prepStep === s.id ? '#fff' : '#fff',
            }}>{s.label}</button>
          ))}
        </div>

        {prepStep === 'params' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 800 }}>⚙️ Параметры Prep-цикла</div>
            <label style={{ fontSize: 10, color: '#fff' }}>Категория ({prepSex === 'female' ? 'женские' : 'мужские'})</label>
            <select value={prepCat} onChange={e => setPrepCat(e.target.value as BBContestCategory)} style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', fontSize: 12 }}>
              {catOpts.map(c => <option key={c} value={c}>{CATEGORY_PROFILES[c].label}</option>)}
            </select>
            {prepProfile.balanceNote && <div style={{ fontSize: 10, color: '#fff', padding: '8px 10px', borderRadius: 10, background: 'rgba(236,72,153,0.06)', border: '1px solid rgba(236,72,153,0.2)' }}>💡 {prepProfile.balanceNote}</div>}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 130 }}>
                <div style={{ fontSize: 10, color: '#fff', marginBottom: 4 }}>Длительность, недель (4-26)</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button onClick={() => setPcWeeks(w => Math.max(4, w - 1))} style={chipBtn('-')}>−</button>
                  <span style={{ flex: 1, textAlign: 'center', fontWeight: 800, fontSize: 14 }}>{pcWeeks}</span>
                  <button onClick={() => setPcWeeks(w => Math.min(26, w + 1))} style={chipBtn('+')}>+</button>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 130 }}>
                <div style={{ fontSize: 10, color: '#fff', marginBottom: 4 }}>Тапер, недель (1-4)</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button onClick={() => setPrepTaper(t => Math.max(1, Math.min(4, t - 1)))} style={chipBtn('-')}>−</button>
                  <span style={{ flex: 1, textAlign: 'center', fontWeight: 800, fontSize: 14 }}>{prepTaper}</span>
                  <button onClick={() => setPrepTaper(t => Math.min(4, t + 1))} style={chipBtn('+')}>+</button>
                </div>
              </div>
            </div>
            <div style={{ fontSize: 10, color: '#fff' }}>Подготовка {Math.max(1, pcWeeks - prepTaper - 1)} нед → тапер {prepTaper} нед → пик-неделя (1) → шоу</div>

            <label style={{ fontSize: 10, color: '#fff' }}>Дата соревнования (якорь фаз и тапера)</label>
            <input type="date" value={pcShowDate} onChange={e => e.target.value && setPcShowDate(e.target.value)} style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', fontSize: 12, width: '100%', boxSizing: 'border-box' }} />

            {/* Доп. соревнования сезона (A/B/C) — пик-неделя строится под главный */}
            <div style={{ fontSize: 10, color: '#fff' }}>Доп. старты сезона (необязательно):</div>
            {prepComps.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <span style={{ fontWeight: 700, color: c.priority === 'A' ? '#fbbf24' : c.priority === 'B' ? '#60a5fa' : '#fff' }}>[{c.priority}]</span>
                <span style={{ flex: 1 }}>{c.name}</span>
                <span style={{ color: '#fff' }}>{c.date}</span>
                <button onClick={() => setPrepMainId(c.id)} style={{ ...chipBtn('', prepMainId === c.id), padding: '2px 6px', minHeight: 24, fontSize: 9 }}>★ главный</button>
                <button onClick={() => { setPrepComps(prev => prev.filter(x => x.id !== c.id)); if (prepMainId === c.id) setPrepMainId(''); }} style={{ ...chipBtn('', false), padding: '2px 6px', minHeight: 24, fontSize: 9, color: '#f87171' }}>✕</button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <input value={prepCompDraft.name} placeholder="Название" onChange={e => setPrepCompDraft(d => ({ ...d, name: e.target.value }))} style={{ flex: 1, minWidth: 90, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', fontSize: 10 }} />
              <input type="date" value={prepCompDraft.date} onChange={e => setPrepCompDraft(d => ({ ...d, date: e.target.value }))} style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', fontSize: 10 }} />
              <select value={prepCompDraft.priority} onChange={e => setPrepCompDraft(d => ({ ...d, priority: e.target.value as 'A' | 'B' | 'C' }))} style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', fontSize: 10 }}>
                <option value="A">A</option><option value="B">B</option><option value="C">C</option>
              </select>
              <button onClick={() => {
                const name = prepCompDraft.name.trim();
                const date = prepCompDraft.date;
                if (!name || !date) { flash('Укажите название и дату старта'); return; }
                setPrepComps(prev => [...prev, { id: `comp_${Date.now().toString(36)}`, name, date, priority: prepCompDraft.priority }]);
                setPrepCompDraft({ name: '', date: '', priority: 'B' });
                setPrepResult(null);
              }} style={BTN_GHOST}>➕ Добавить</button>
            </div>

            <label style={{ fontSize: 10, color: '#fff' }}>Текущий % жира (для оценки готовности; необязательно)</label>
            <input type="number" min={3} max={60} value={prepBodyFat ?? ''} onChange={e => setPrepBodyFat(e.target.value ? Number(e.target.value) : undefined)} placeholder="напр. 14" style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', fontSize: 12, width: '100%', boxSizing: 'border-box' }} />

            <button style={{ ...BTN, width: '100%' }} onClick={() => setPrepStep('accent')}>Далее: акценты/минимум →</button>
          </div>
        )}

        {prepStep === 'accent' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 800 }}>⭐ Акцент (1-2 мышцы) — для формы и баланса</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {PREP_ACCENT_OPTIONS.map(m => {
                const on = prepAccent.includes(m);
                const disabled = !on && prepAccent.length >= 2;
                return <button key={m} disabled={disabled} onClick={() => setPrepAccent(prev => on ? prev.filter(x => x !== m) : [...prev, m])} style={{ ...chipBtn(m, on), opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>{muscleRu(m)}</button>;
              })}
            </div>

            <div style={{ fontSize: 12, fontWeight: 800 }}>⬇ Минимальная нагрузка — чтобы акцент получил ресурс (общая форма сохранена)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {PREP_MINIMAL_OPTIONS.map(m => {
                const on = prepMinimal.includes(m);
                return <button key={m} onClick={() => setPrepMinimal(prev => on ? prev.filter(x => x !== m) : [...prev, m])} style={{ ...chipBtn(m, on, true) }}>{muscleRu(m)}</button>;
              })}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {(['reduce_direct_to_floor', 'remove_direct_when_indirect_covers_floor'] as PrepMinimalMode[]).map(mode => {
                const on = prepMinMode === mode;
                return <button key={mode} onClick={() => setPrepMinMode(mode)} style={{ ...chipBtn(mode, on), minHeight: 36, fontSize: 10 }}>⚖ {PREP_MINIMAL_MODE_LABELS[mode]}</button>;
              })}
            </div>
            {prepMinimal.length > 0 && prepMinMode !== minRec.mode && (
              <div style={{ fontSize: 10, color: '#fbbf24', padding: '8px 10px', borderRadius: 10, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}>💡 Рекомендация: «{PREP_MINIMAL_MODE_LABELS[minRec.mode]}» — {minRec.reason}</div>
            )}
            {prepMinimal.length === 0 && <div style={{ fontSize: 10, color: '#fff' }}>Минимальная нагрузка не задана — акцент получит приоритет, остальные мышцы в поддерживающем объёме.</div>}

            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ ...BTN_GHOST, flex: 1 }} onClick={() => setPrepStep('params')}>← Назад</button>
              <button style={{ ...BTN, flex: 1 }} onClick={() => setPrepStep('split')}>Далее: сплит →</button>
            </div>
          </div>
        )}

        {prepStep === 'split' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 800 }}>📐 Сплит подготовки</div>
            <label style={{ fontSize: 10, color: '#fff' }}>Рекомендуемые для {CATEGORY_PROFILES[prepCat].label}:</label>
            <select value={prepSplit} onChange={e => setPrepSplit(e.target.value)} style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', fontSize: 12 }}>
              {prepProfile.recommendedSplits.map(id => {
                const p = getPattern(id);
                return <option key={id} value={id}>{p ? p.name : id}</option>;
              })}
            </select>
            {(() => {
              const p = getPattern(prepSplit);
              if (!p) return null;
              return <div style={{ fontSize: 10, color: '#fff', padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.04)' }}>{p.description}</div>;
            })()}
            <div style={{ fontSize: 10, color: '#fff' }}>Всего дней: {getPattern(prepSplit)?.sessionsPerRotation ?? '—'} / ротация {getPattern(prepSplit)?.rotationDays ?? '—'}</div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ ...BTN_GHOST, flex: 1 }} onClick={() => setPrepStep('accent')}>← Назад</button>
              <button style={{ ...BTN, flex: 1 }} onClick={() => setPrepStep('nutrition')}>Далее: питание →</button>
            </div>
          </div>
        )}

        {prepStep === 'nutrition' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 800 }}>🍽 Prep-питание и тапер</div>
            {prepStale && <div style={{ fontSize: 10, color: '#f87171', padding: '8px 10px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>⚠ Параметры изменены после сборки — результат будет пересобран.</div>}
            <div style={{ fontSize: 11, color: '#fff', lineHeight: 1.5 }}>
              Prep-цикл строит единый план подготовки (дефицит по категории), тапер последних {prepTaper} нед и пик-неделю под дату {pcShowDate}.
              Он будет применён в планировщике питания автоматически (вкладка «🏁 Тапер ББ» и дневные цели).
            </div>
            <div style={{ fontSize: 10, color: '#fff' }}>Текущий вес: {profileWeight} кг · пол: {prepSex === 'female' ? 'женский' : 'мужской'} · категория: {CATEGORY_PROFILES[prepCat].label}</div>

            {/* Стратегия объёма подготовки */}
            <div>
              <div style={{ fontSize: 10, color: '#fff', marginBottom: 4 }}>Стратегия объёма подготовки (как сильно снижать к финалу):</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {([['gentle', '🛡 Сохранить массу'], ['balanced', '⚖ Сбалансированно'], ['aggressive', '🔥 Агрессивная сушка']] as const).map(([id, label]) => {
                  const on = prepVolumeStrategy === id;
                  return <button key={id} type="button" onClick={() => setPrepVolumeStrategy(id)} style={{ ...chipBtn(id, on), minHeight: 36, fontSize: 10 }}>{label}</button>;
                })}
              </div>
              <div style={{ fontSize: 9, color: '#fff', marginTop: 4 }}>Объём держится на уровне обычного ББ-авто (MAV) во всей подготовке; стратегия влияет на финальный спуск к таперу.</div>
            </div>

            {/* Prep-делоды */}
            <div>
              <div style={{ fontSize: 10, color: '#fff', marginBottom: 4 }}>🔄 Prep-делод (разгрузка каждые N недель подготовки):</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {([[0, 'Выкл'], [4, '4 нед'], [5, '5 нед'], [6, '6 нед']] as const).map(([id, label]) => {
                  const on = prepDeloadEvery === id;
                  return <button key={id} type="button" onClick={() => setPrepDeloadEvery(id)} style={{ ...chipBtn(String(id), on), minHeight: 36, fontSize: 10 }}>{label}</button>;
                })}
              </div>
              <div style={{ fontSize: 9, color: '#fff', marginTop: 4 }}>Делод: объём ×0.7, RIR +2 — сброс усталости и сохранение мышц при длительном дефиците (Helms 2017).</div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ ...BTN_GHOST, flex: 1 }} onClick={() => setPrepStep('split')}>← Назад</button>
              <button style={{ ...BTN, flex: 1, background: 'linear-gradient(135deg,#ec4899,#be185d)', color: '#fff' }} disabled={pcBusy} onClick={handleBuildPrep}>{pcBusy ? '⏳ Сборка...' : '🏁 Собрать prep-цикл'}</button>
            </div>
            <button style={{ ...BTN_GHOST, width: '100%', borderColor: '#60a5fa', color: '#60a5fa' }} disabled={pcBusy || prepComps.length < 2} onClick={handleBuildSeason}>
              🏁 Собрать сезон (по всем {prepComps.length >= 2 ? `${prepComps.length} стартам` : 'стартам — добавьте ≥2'})
            </button>
          </div>
        )}

        {prepStep === 'result' && prepResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 800 }}>📋 Готово — Prep-цикл</div>
            {prepSeason && (
              <div style={{ fontSize: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)' }}>
                <div style={{ fontWeight: 800, color: '#60a5fa', marginBottom: 4 }}>🏁 Сезон: {prepSeason.cycles.length} старта</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {prepSeason.summary.map((s, i) => (
                    <button key={i} onClick={() => { setPrepResult(prepSeason.cycles[i]); setPrepStep('result'); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, textAlign: 'left', padding: '6px 8px', borderRadius: 8, cursor: 'pointer', fontSize: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}>
                      <span style={{ fontWeight: 700, color: s.priority === 'A' ? '#fbbf24' : '#fff' }}>[{s.priority ?? '—'}]</span>
                      <span style={{ flex: 1 }}>{s.name}</span>
                      <span style={{ color: '#fff' }}>{s.date} · {s.totalWeeks} нед (подг {s.prepWeeks}+тапер {s.taperWeeks}+пик)</span>
                    </button>
                  ))}
                </div>
                {prepSeason.warnings.length > 0 && <div style={{ color: '#fbbf24', marginTop: 4 }}>{prepSeason.warnings.join(' ')}</div>}
              </div>
            )}
            {prepStale && (
              <div style={{ fontSize: 10, color: '#f87171', padding: '8px 10px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
                ⚠ Параметры изменены после сборки — результат устарел. Вернитесь и нажмите «🏁 Собрать prep-цикл» заново.
              </div>
            )}
            {prepResult.warnings.map((w, i) => <div key={i} style={{ fontSize: 10, color: '#fbbf24', padding: '8px 10px', borderRadius: 10, background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)' }}>{w}</div>)}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {prepResult.phases.map(p => {
                const dateStr = p.dateStart && p.dateEnd
                  ? (p.key === 'show_day' ? ` 📅 ${p.dateStart}` : ` 📅 ${p.dateStart.slice(5)}–${p.dateEnd.slice(5)}`)
                  : '';
                return (
                  <span key={p.key} title={`${p.note ?? ''}`} style={{ padding: '4px 9px', borderRadius: 999, fontSize: 9, fontWeight: 700, background: `${p.color}22`, border: `1px solid ${p.color}55`, color: p.color }}>
                    {p.label} · нед {p.weekStart}-{p.weekEnd}{dateStr}
                  </span>
                );
              })}
            </div>

            <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.5 }}>
              <div>⭐ Акцент: {prepResult.accentMuscles.length ? prepResult.accentMuscles.map(muscleRu).join(', ') : 'без акцента'}</div>
              <div>⬇ Минимальная нагрузка: {prepResult.minimalMuscles.length ? prepResult.minimalMuscles.map(muscleRu).join(', ') : 'не задана'} · {PREP_MINIMAL_MODE_LABELS[prepResult.minimalMode]}</div>
              <div>📐 Сплит: {getPattern(prepResult.config.splitPatternId || '')?.name ?? prepResult.config.splitPatternId}</div>
              <div>🗓 Шоу: {prepResult.prepPlan.showDate} · недель в плане: {prepResult.bbPlan.weeks.length}</div>
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, marginTop: 2 }}>По неделям (фаза · дата):</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {prepResult.bbPlan.weeks.map((w: any, i) => {
                const phaseKey = (w.contestPhase ?? 'preparation') as PrepPhaseKey;
                const ph = PREP_PHASE_LABELS[phaseKey] || String(w.contestPhase);
                const color = PREP_PHASE_COLORS[phaseKey] || '#888';
                const phase = prepResult.prepPlan.phases.find(p => (w.week ?? 0) >= p.weekStart && (w.week ?? 0) <= p.weekEnd);
                const dStr = phase?.dateEnd ? isoAddDays(phase.dateEnd, -7 * (phase.weekEnd - (w.week ?? 0))).slice(5) : '';
                return <span key={i} title={`нед ${w.week}`} style={{ padding: '3px 7px', borderRadius: 8, fontSize: 9, background: `${color}18`, border: `1px solid ${color}44`, color }}>н{w.week} {ph}{dStr ? ` ${dStr}` : ''}</span>;
              })}
            </div>

            {/* ⚖️ Адаптация по весу */}
            {weightAdvice && weightAdvice.status !== 'no_data' && (
              <div style={{ fontSize: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)' }}>
                <div style={{ fontWeight: 800, color: '#60a5fa', marginBottom: 4 }}>⚖️ Адаптация по весу: {weightAdvice.status}</div>
                <div style={{ color: '#fff' }}>{weightAdvice.recommendation}</div>
                {weightAdvice.adjustCalories !== 0 && <button style={{ ...BTN_GHOST, marginTop: 6, marginRight: 6 }} onClick={() => handleApplyWeightAdjustment(weightAdvice.adjustCalories, 0)}>{weightAdvice.adjustCalories > 0 ? '+' : ''}{weightAdvice.adjustCalories} ккал</button>}
                {weightAdvice.adjustCardioMin !== 0 && <button style={{ ...BTN_GHOST, marginTop: 6 }} onClick={() => handleApplyWeightAdjustment(0, weightAdvice.adjustCardioMin)}>{weightAdvice.adjustCardioMin > 0 ? '+' : ''}{weightAdvice.adjustCardioMin} мин кардио/нед</button>}
              </div>
            )}

            {/* Что учтено в объёме */}
            <div style={{ fontSize: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontWeight: 800, color: '#fff', marginBottom: 4 }}>🧮 Что учтено в объёме</div>
              <div style={{ color: '#fff' }}>
                Цель: {prepResult.config.enhanced ? 'поддержание массы (PED)' : prepResult.config.experienceLevel} · стаж {prepResult.config.trainingYears ?? '—'} г · {prepResult.config.enhanced ? 'курс' : 'натурал'}
                {prepResult.config.bodyFat != null ? ` · %жира ${prepResult.config.bodyFat}` : ''}
                {prepResult.config.hrvMs != null ? ` · HRV ${prepResult.config.hrvMs}` : ''}
                {prepResult.config.sleepHours != null ? ` · сон ${prepResult.config.sleepHours}ч` : ''}
                {prepResult.config.stressLevel != null ? ` · стресс ${prepResult.config.stressLevel}` : ''}
                {prepResult.config.labMrvMultiplier != null ? ` · лаб ×${prepResult.config.labMrvMultiplier}` : ''}
                {prepResult.config.pedDoses ? ' · дозы PED' : ''}
              </div>
              <div style={{ color: '#fff', marginTop: 2 }}>MRV-капы и целевой объём рассчитаны с учётом уровня, стажа, PED, восстановления, питания и лаборатории.</div>
            </div>

            {/* 📉 План объёма подготовки (каскад) — долгий режим, а не только тапер */}
            {prepResult.volumePlan && (
              <div style={{ fontSize: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)' }}>
                <div style={{ fontWeight: 800, color: '#60a5fa', marginBottom: 4 }}>📉 Объём подготовки (каскад на весь цикл, не только тапер)</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                  {prepResult.volumePlan.phases.map((ph, i) => (
                    <span key={i} style={{ padding: '3px 8px', borderRadius: 8, fontSize: 9, fontWeight: 700, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: '#93c5fd' }}>
                      нед {Math.max(1, Math.ceil(ph.fromPct * prepResult.prepWeeks))}–{Math.min(prepResult.prepWeeks, Math.ceil(ph.toPct * prepResult.prepWeeks))} · ×{ph.volumeMult.toFixed(2)} · RIR {ph.rir[0]}-{ph.rir[1]}
                    </span>
                  ))}
                  <span style={{ padding: '3px 8px', borderRadius: 8, fontSize: 9, fontWeight: 700, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#fbbf24' }}>→ тапер ×0.6 → пик</span>
                </div>
                <div style={{ color: '#fff' }}>
                  🎯 Целевой объём на группу мышц/нед: базовый {prepResult.volumePlan.targetSetsPerMusclePerWeek[0]}–{prepResult.volumePlan.targetSetsPerMusclePerWeek[1]} сетов
                  → <b style={{ color: '#93c5fd' }}>~{prepResult.volumePlan.scaledTargetSetsPerMusclePerWeek[0]}–{prepResult.volumePlan.scaledTargetSetsPerMusclePerWeek[1]}</b> с учётом PED/стажа/уровня
                </div>
                <div style={{ color: '#fff', marginTop: 2 }}>{prepResult.volumePlan.note}</div>
                <div style={{ color: '#fff', marginTop: 2 }}>База 10–15 сетов/группу/нед — для натурала/среднего стажа. У продвинутого атлета (стаж, PED, уровень) целевой объём выше — это уже заложено в плане. Объём подготовки снижается лишь умеренно; тапер — финальный спуск к пику.</div>
              </div>
            )}

            {/* 🎯 Вердикт готовности по %жира */}
            {(() => {
              try {
                const rd = computeReadiness({ ...configFromPlan(prepResult.prepPlan), bodyFatPct: prepResult.config.bodyFatPct });
                const color = rd.verdict === 'on_track' ? '#4ade80' : rd.verdict === 'ahead' ? '#22c55e' : '#fbbf24';
                return (
                  <div style={{ fontSize: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(34,197,94,0.05)', border: `1px solid ${color}44` }}>
                    <div style={{ fontWeight: 800, color, marginBottom: 4 }}>
                      🎯 Готовность: {rd.verdict === 'on_track' ? 'по графику' : rd.verdict === 'ahead' ? 'уже у цели' : 'сушка не дожата'}
                      {rd.targetBf != null ? ` · цель ~${rd.targetBf}%` : ''}
                      {rd.gap != null ? ` · осталось ${rd.gap}%` : ''}
                    </div>
                    <div style={{ color: '#fff' }}>{rd.note}</div>
                  </div>
                );
              } catch { return null; }
            })()}

            {/* 🏃 Кардио подготовки */}
            {(() => {
              try {
                const cp = prepCardioPlan(prepResult.config);
                return (
                  <div style={{ fontSize: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(251,146,60,0.06)', border: '1px solid rgba(251,146,60,0.2)' }}>
                    <div style={{ fontWeight: 800, color: '#fb923c', marginBottom: 4 }}>🏃 Кардио подготовки: ~{cp.minutesPerWeek} мин/нед · ~{cp.stepsPerDay} шагов/день</div>
                    <div style={{ color: '#fff' }}>{cp.zone}</div>
                    <div style={{ color: '#fff', marginTop: 2 }}>{cp.note}</div>
                  </div>
                );
              } catch { return null; }
            })()}

            {/* 📉 Прогноз сушки к шоу */}
            {(() => {
              const proj = prepCutProjection(prepResult.prepPlan, profileWeight, prepBodyFat);
              const ok = proj.canReachByShow;
              return (
                <div style={{ fontSize: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)' }}>
                  <div style={{ fontWeight: 800, color: ok ? '#4ade80' : '#fbbf24', marginBottom: 4 }}>
                    📉 Сушка к шоу · цель ~{proj.targetBodyFatPct}% · темп {proj.weeklyRateKg} кг/нед
                  </div>
                  <div style={{ color: '#fff' }}>
                    {proj.targetWeightKg != null && <>Целевой вес ~{proj.targetWeightKg} кг · </>}
                    до шоу {proj.weeksToShow} нед · прогноз веса на шоу ~{proj.projectedShowWeightKg} кг.
                  </div>
                  <div style={{ color: ok ? '#fff' : '#fbbf24', marginTop: 2 }}>{proj.note}</div>
                </div>
              );
            })()}

            {/* 📈 Выполнение подготовки по дневнику */}
            {(() => {
              try {
                const compliance = prepTrainingCompliance(
                  prepResult.prepPlan,
                  prepResult.bbPlan.weeks.map((w: any) => ({
                    week: (w as any).week,
                    contestPhase: (w as any).contestPhase,
                    plannedSets: (w.sessions || []).reduce((a: number, s: any) => a + (s.exercises || []).reduce((b: number, e: any) => b + (e.sets || 0), 0), 0),
                  })),
                  loadSessions().map(s => ({ date: s.date, totalSets: s.totalSets })),
                );
                const past = compliance.weeks.filter(w => w.status !== 'upcoming');
                if (compliance.completedWeeks === 0) return null;
                return (
                  <div style={{ fontSize: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)' }}>
                    <div style={{ fontWeight: 800, color: '#a78bfa', marginBottom: 4 }}>📈 Выполнение подготовки: {Math.round(compliance.overallPct * 100)}% · завершено {compliance.completedWeeks} из {compliance.elapsedWeeks} нед</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
                      {compliance.weeks.map((cw, i) => {
                        const color = cw.status === 'upcoming' ? '#fff' : cw.status === 'done' ? '#4ade80' : cw.status === 'partial' ? '#fbbf24' : '#f87171';
                        return <span key={i} title={`нед ${cw.week}: факт ${cw.actualSets}/${cw.plannedSets} сетов (${cw.dateStart}–${cw.dateEnd})`} style={{ padding: '2px 6px', borderRadius: 6, fontSize: 8, background: `${color}22`, border: `1px solid ${color}55`, color }}>н{cw.week} {cw.status === 'upcoming' ? '⏳' : `${Math.round(cw.pct * 100)}%`}</span>;
                      })}
                    </div>
                    <div style={{ color: '#fff' }}>{compliance.recommendation}</div>
                  </div>
                );
              } catch { return null; }
            })()}

            {/* 🍽 Питание на сегодня (из единого prep-плана) */}
            {(() => {
              try {
                const base: PeakNutritionBase = {
                  kcal: Math.round(profileWeight * 31),
                  proteinG: Math.round(profileWeight * 2.2),
                  fatG: Math.round(profileWeight * (prepSex === 'female' ? 0.8 : 0.6)),
                  carbsG: 0,
                  waterMl: 3000,
                  sodiumMg: 2800,
                };
                const nt = nutritionTargetsForPrepDate(isoToday(), prepResult.prepPlan, base);
                return (
                  <div style={{ fontSize: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)' }}>
                    <div style={{ fontWeight: 800, color: '#4ade80', marginBottom: 4 }}>🍽 Питание на сегодня {nt.phaseLabel ? `· ${nt.phaseLabel}` : ''}</div>
                    <div style={{ color: '#fff' }}>
                      {nt.kcal} ккал · Б {nt.proteinG}г · У {nt.carbsG}г · Ж {nt.fatG}г
                      {nt.waterMl ? ` · 💧 ${(nt.waterMl / 1000).toFixed(1)}л` : ''}
                      {nt.sodiumMg ? ` · Na ${nt.sodiumMg}мг` : ''}
                    </div>
                    {nt.note && <div style={{ color: '#fff', marginTop: 2 }}>{nt.note}</div>}
                    <div style={{ color: '#fff', marginTop: 3 }}>Эти цели уже применяет планировщик питания (вкладка «🏁 Тапер ББ»).</div>
                  </div>
                );
              } catch { return null; }
            })()}

            {/* 🍽 План питания подготовки (недели/фазы/макро/рефиды/микро) */}
            {(() => {
              try {
                const np = buildPrepNutritionPlan(prepResult.prepPlan, prepResult.config);
                return (
                  <div style={{ fontSize: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.18)' }}>
                    <div style={{ fontWeight: 800, color: '#4ade80', marginBottom: 4 }}>🍽 План питания подготовки</div>
                    <div style={{ color: '#fff', marginBottom: 4 }}>{np.note}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                      {np.weeks.slice(0, 20).map(w => (
                        <span key={w.week} title={w.note} style={{ padding: '3px 7px', borderRadius: 7, fontSize: 8.5, fontWeight: 700, background: w.phase === 'peak_week' ? 'rgba(236,72,153,0.12)' : w.phase === 'taper' ? 'rgba(245,158,11,0.12)' : w.refeed ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${w.refeed ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)'}`, color: w.phase === 'peak_week' ? '#f472b6' : w.phase === 'taper' ? '#fbbf24' : '#fff' }}>
                          н{w.week} {w.phase === 'preparation' ? (w.refeed ? 'рефид' : 'prep') : w.phase === 'final_preparation' ? 'финал' : w.phase === 'taper' ? 'тапер' : 'пик'} · {w.kcal}кк · Б{w.proteinG}/У{w.carbsG}/Ж{w.fatG}
                        </span>
                      ))}
                    </div>
                    <div style={{ color: '#fff' }}>
                      <div>⚖ {np.refeedStrategy}</div>
                      <div>🍗 {np.mealTiming.join(' ')}</div>
                      <div>💊 {np.micronutrients.join(' ')}</div>
                      <div>💧 {np.hydration}</div>
                      <div>🏃 Кардио-расход: ~{np.cardioKcalPerWeek} ккал/нед</div>
                      {np.femaleNotes.map((f, i) => <div key={i} style={{ color: '#f9a8d4' }}>👩 {f}</div>)}
                    </div>
                  </div>
                );
              } catch { return null; }
            })()}

            {/* 🎭 Позирование */}
            {(() => {
              const pp = posingPlanForCategory(prepCat);
              const todayDone = posingList.find(e => e.date === isoToday());
              const stats = posingWeekStats(posingList, 7);
              return (
                <div style={{ fontSize: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.2)' }}>
                  <div style={{ fontWeight: 800, color: '#c084fc', marginBottom: 4 }}>🎭 Позирование · {pp.minutesPerDay} мин/день · {stats.days ? `за 7д: ${stats.totalMin} мин (сред. ${stats.avgMin})` : 'за 7д: нет отметок'}</div>
                  <div style={{ color: '#fff', marginBottom: 6 }}>{pp.poses.join(' · ')}</div>
                  <div style={{ color: '#fff', marginBottom: 6 }}>{pp.note}</div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input type="number" min={0} max={120} value={posingMin || ''} onChange={e => setPosingMin(e.target.value ? Number(e.target.value) : 0)} placeholder="мин" style={{ width: 70, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', fontSize: 10 }} />
                    <button style={BTN_GHOST} onClick={() => {
                      const next = savePosingCheckin({ date: isoToday(), minutes: posingMin || pp.minutesPerDay });
                      setPosingList(next);
                      setPosingMin(0);
                      flash(`🎭 Позирование отмечено${todayDone ? ' (обновлено)' : ''}`);
                    }}>{todayDone ? '✏️ Обновить отметку' : '✅ Отметить сегодня'}</button>
                    {todayDone && <span style={{ color: '#4ade80' }}>сегодня: {todayDone.minutes} мин ✓</span>}
                  </div>
                </div>
              );
            })()}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
              <button style={{ ...BTN, flex: '1 1 140px', background: 'linear-gradient(135deg,#ec4899,#be185d)', color: '#fff' }} onClick={handleSavePrepCycle}>💾 Сохранить в профиль</button>
              <button style={{ ...BTN_GHOST, flex: '1 1 140px' }} onClick={handleOpenPrepPlan}>🗓 Открыть как план</button>
              <button style={{ ...BTN_GHOST, flex: '1 1 140px', borderColor: '#22c55e', color: '#22c55e' }} onClick={() => handleSaveVariant()}>💾 Вариант</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <button style={BTN_GHOST} onClick={handlePrintPrepSummary}>🖨 Сводка prep (PDF)</button>
              <button style={BTN_GHOST} onClick={handleExportPrepIcs}>📅 Фазы (.ics)</button>
              <button style={BTN_GHOST} onClick={handleExportPrepJson}>📥 JSON тренеру</button>
            </div>
            <button style={{ ...BTN_GHOST, width: '100%' }} onClick={() => setPrepStep('params')}>← Редактировать параметры</button>
          </div>
        )}
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
                  style={{ display:'block', width:'100%', padding:'8px 10px', borderRadius:10, cursor:isCurrent?'default':'pointer', textAlign:'left', fontSize:11, fontWeight:isCurrent?400:500, background:isCurrent?'rgba(255,255,255,0.02)':'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', color:isCurrent?'#fff':'#fff', opacity:isCurrent?0.5:1 }}>
                  <div style={{ display:'flex', justifyContent:'space-between' }}>
                    <span>{ex.name}</span>
                    <span style={{ fontSize:11, color:'#fff' }}>{ex.type} · {ex.equipment}</span>
                  </div>
                  {isCurrent && <div style={{ fontSize:11, color:'#00e68a', marginTop:2 }}>✓ текущее</div>}
                </button>;
              })}
              {filtered.length === 0 && <div style={{ padding:12, textAlign:'center', fontSize:11, color:'#fff' }}>Ничего не найдено</div>}
            </div>
            <button onClick={() => { setExSwapModal(null); setExSwapSearch(''); }} style={{ width:'100%', marginTop:10, padding:'10px', borderRadius:10, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer' }}>Закрыть</button>
          </div>
        </div>
      </div>
    );
  };

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
            }} onApplyCycle={() => {
             // BB macro blocks have no LMS cycleId. Keep the annual macrocycle
             // intact instead of switching to an unrelated BB cycle path.
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
          <div onClick={e => e.stopPropagation()} style={{ width:'100%', maxWidth:400, borderRadius:16, background:'#18181b', border:'1px solid rgba(255,255,255,0.12)', padding:16, boxSizing:'border-box', boxShadow:'0 20px 60px rgba(0,0,0,0.6)' }}>
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
          <div onClick={e => e.stopPropagation()} style={{ width:'100%', maxWidth:400, borderRadius:16, background:'#18181b', border:'1px solid rgba(255,255,255,0.12)', padding:16, boxSizing:'border-box', boxShadow:'0 20px 60px rgba(0,0,0,0.6)' }}>
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
