/**
 * bb-replan.engine.ts — «пересчитать остаток мезоцикла по факту» (G7).
 *
 * Проблема. План строится на весь мезоцикл вперёд, а живёт он в сессиях. После
 * недели 5 из 12 спортсмен уже дал ФАКТ: собранные веса, выполненный объём,
 * e1RM-кривую. Инструмент до сих пор умел только глобальные «±20% объёма» или
 * пересборку с нуля (которая теряет уже прожитые недели). Профессиональный ответ:
 * заморозить прожитое и пересобрать остаток, продолжив от фактического пика.
 *
 * Контракт:
 * - недели < currentWeek НЕ меняются (прожитый факт не переписывается);
 * - остаток пересобирается через buildBBPlan с `previousPlan = замороженный
 *   префикс`, поэтому continuity (веса/объём/ротация) продолжается от факта,
 *   а не от популяционного ландмарка;
 * - входы восстанавливаются из `plan.inputSnapshot` — если снапшота нет (план из
 *   storage/импорт), возвращается null с честной причиной;
 * - чистая функция: план не мутируется.
 */

import type { BBPlan, BBBuilderInput } from './bb-builder.engine';
import { buildBBPlan } from './bb-builder.engine';
import type { WorkoutSession } from '../workout-logger.engine';

export interface ReplanBBResult {
  plan: BBPlan;
  changes: string[];
  /** Сколько недель заморожено и сколько пересобрано. */
  frozenWeeks: number;
  rebuiltWeeks: number;
}

export interface ReplanBBOptions {
  /** Текущая (1-based) неделя плана — с неё начинается пересбор. */
  currentWeek: number;
  /** ISO-дата недели 1 (для сохранения календаря). */
  planStartWeek?: string;
}

/** Финальный «отчёт» пересборки: что именно изменится в остатке. */
export function replanSummary(replan: ReplanBBResult | null): string {
  if (!replan) return 'Пересборка остатка: нет данных (нужен собранный план)';
  return `Пересобрано недель: ${replan.rebuiltWeeks} (заморожено ${replan.frozenWeeks}); продолжили от фактического пика`;
}

function isRestWeek(w: any): boolean {
  return w?.deload === true || String(w?.phase || '').toLowerCase() === 'deload'
    || (w as any)?.taper === true || (w as any)?.taperApplied === true;
}

/**
 * Пересобрать остаток мезоцикла, продолжив от фактического пика прожитых недель.
 * @returns null — нечего/нельзя пересобирать (нет плана, currentWeek вне диапазона,
 *          нет inputSnapshot для восстановления входов).
 */
export function replanBBMesoFromFact(
  plan: BBPlan | null | undefined,
  _sessions: WorkoutSession[],
  opts: ReplanBBOptions,
): ReplanBBResult | null {
  if (!plan || !Array.isArray(plan.weeks) || plan.weeks.length === 0) return null;
  const total = plan.weeks.length;
  const current = Math.floor(Number(opts.currentWeek));
  if (!Number.isFinite(current) || current < 2 || current > total) return null;
  const remaining = total - current + 1;
  if (remaining < 1) return null;

  // Входы восстанавливаем из снапшота плана. Без него пересборка была бы
  // угадыванием настроек пользователя — честный null лучше молчаливого другого плана.
  const snap: any = (plan as any).inputSnapshot;
  if (!snap || typeof snap !== 'object') return null;

  const patternId = String((plan as any).pattern?.id || (plan as any).patternId || snap.patternId || '');
  if (!patternId) return null;

  const frozen = plan.weeks.slice(0, current - 1);
  const previousPlan: BBPlan = { ...plan, weeks: frozen };

  const input: BBBuilderInput = {
    patternId,
    level: String(snap.level || (plan as any).level || 'intermediate'),
    goal: (snap.goal || 'mass') as BBBuilderInput['goal'],
    weeks: remaining,
    workMax: ((plan as any).workMax || {}) as Record<string, number>,
    weakPoints: Array.isArray(snap.weakPoints) ? snap.weakPoints : [],
    focusGroup: snap.focusGroup || undefined,
    specialization: snap.specialization,
    equipment: Array.isArray(snap.equipment) ? snap.equipment : [],
    volumeGoal: (snap.volumeGoal || 'mav') as BBBuilderInput['volumeGoal'],
    trainingFocus: snap.trainingFocus,
    methodology: snap.methodology,
    supersetMode: snap.supersetMode,
    volumeScheme: snap.volumeScheme,
    dupMode: snap.dupMode,
    trainingVolumeMode: snap.trainingVolumeMode,
    trainingYears: Number.isFinite(snap.trainingYears) ? snap.trainingYears : undefined,
    courseIntensity: snap.courseIntensity as BBBuilderInput['courseIntensity'],
    fewerCompound: snap.fewerCompound,
    rotationMode: snap.rotationMode,
    intensityLevel: snap.intensityLevel,
    avoidAxialLoad: snap.avoidAxialLoad,
    injuries: Array.isArray(snap.injuries) ? snap.injuries : [],
    mobilityRestrictions: Array.isArray(snap.mobilityRestrictions) ? snap.mobilityRestrictions : [],
    favoriteExercises: Array.isArray(snap.favoriteExercises) ? snap.favoriteExercises : [],
    excludedExercises: Array.isArray(snap.excludedExercises) ? snap.excludedExercises : [],
    autoDeload: snap.autoDeload,
    deloadType: snap.deloadType,
    loadStrategy: snap.loadStrategy,
    eccentricMult: snap.eccentricMult,
    calorieSurplus: snap.calorieSurplus,
    proteinPerKg: snap.proteinPerKg,
    labMrvMultiplier: snap.labMrvMultiplier,
    bodyFat: snap.bodyFat,
    leanMass: snap.leanMass,
    hrvMs: snap.hrvMs,
    hrvBaseline: snap.hrvBaseline,
    hrvBaselineZ: snap.hrvBaselineZ,
    sleepHours: snap.sleepHours,
    stressLevel: snap.stressLevel,
    bfrMode: snap.bfrMode,
    blastCruiseEnabled: snap.blastCruiseEnabled,
    blastWeeks: snap.blastWeeks,
    cruiseWeeks: snap.cruiseWeeks,
    // Продолжение от фактического пика прожитых недель.
    previousPlan,
    previousPlans: [plan],
    planStartWeek: opts.planStartWeek,
  } as BBBuilderInput;

  let rebuilt: BBPlan;
  try {
    rebuilt = buildBBPlan(input);
  } catch {
    return null;
  }
  if (!rebuilt || !Array.isArray(rebuilt.weeks) || rebuilt.weeks.length === 0) return null;

  // Склейка: замороженный префикс (нумерация 1..current-1) + пересобранный
  // остаток с продолжением нумерации. Фазы/мета берём у пересобранного плана,
  // но календарь и якоря префикса сохраняем.
  const offset = frozen.length;
  const tail = rebuilt.weeks.map((w, i) => ({
    ...w,
    week: offset + i + 1,
  }));
  const weeks = [...frozen, ...tail];

  const out: BBPlan = {
    ...plan,
    ...rebuilt,
    weeks,
    // Кап MRV/цели берём у пересобранного плана — он посчитан уже с учётом
    // продолжения от фактического пика; иначе валидатор мерил бы против
    // дорепланных капов.
    mrvByMuscle: rebuilt.mrvByMuscle || (plan as any).mrvByMuscle,
    volumeTargets: rebuilt.volumeTargets || (plan as any).volumeTargets,
    workMax: (rebuilt as any).workMax || (plan as any).workMax,
    validation: (rebuilt as any).validation || (plan as any).validation,
    rationale: [
      ...((plan as any).rationale || []),
      `🔁 Пересборка остатка: заморожено недель ${frozen.length} (факт не переписан), пересобрано ${tail.length} от фактического пика.`,
    ],
    inputSnapshot: {
      ...(snap as Record<string, unknown>),
      ...((rebuilt as any).inputSnapshot || {}),
    },
  } as BBPlan;

  return {
    plan: out,
    changes: [
      `🔁 Остаток мезоцикла пересобран: недели ${frozen.length + 1}–${total} (${tail.length} нед) от фактического пика прожитых недель.`,
    ],
    frozenWeeks: frozen.length,
    rebuiltWeeks: tail.length,
  };
}
