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
import { refreshBBPlanSnapshots } from './bb-plan-snapshot.engine';
import { stampBBPlanFinalizeSignature } from './bb-finalize.engine';
import { SPLIT_PATTERNS } from './bb-split-patterns';
import { normalizeBBMuscle } from './bb-volume.engine';
import type { WorkoutSession } from '../workout-logger.engine';

function addDaysIsoLocal(iso: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days, 12, 0, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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
  sessions: WorkoutSession[],
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
  // Аудит 2026-11: план из «ПРОФ-программы/цикла» несёт pattern.id = program.id —
  // это НЕ id сплита. `buildBBPlan` на неизвестном id молча падает в SPLIT_PATTERNS[0],
  // поэтому пересборка остатка программы выдавала бы ЧУЖОЙ сплит. Честный null.
  if (!SPLIT_PATTERNS.some(p => p.id === patternId)) return null;

  const frozen = plan.weeks.slice(0, current - 1);
  const previousPlan: BBPlan = { ...plan, weeks: frozen };
  // P0-16: реальный анализ факта дневника (sessions) за прожитые недели:
  // пересчитываем e1RM → workMax, adherence и RIR-отклонение → адаптивный recoveryMultOverride.
  const baseStartIso = opts.planStartWeek || snap.planStartWeek;
  const frozenEndIso = baseStartIso ? addDaysIsoLocal(baseStartIso, (current - 1) * 7 - 1) : undefined;
  const relevantSessions = (Array.isArray(sessions) ? sessions : []).filter(s => {
    if (!s || !Array.isArray(s.exercises)) return false;
    if (!baseStartIso || !frozenEndIso) return true;
    const d = String(s.date || '').slice(0, 10);
    return !d || (d >= baseStartIso && d <= frozenEndIso);
  });
  const baseWorkMax: Record<string, number> = { ...(((plan as any).workMax || {}) as Record<string, number>) };
  const factE1rmByMuscle: Record<string, number> = {};
  let loggedSets = 0;
  let actualRirSum = 0;
  let actualRirCount = 0;
  for (const sess of relevantSessions) {
    for (const ex of sess.exercises || []) {
      const m = normalizeBBMuscle((ex as any).muscle || ex.muscleGroup || '');
      for (const st of ex.sets || []) {
        loggedSets += 1;
        const w = Number(st?.weightKg ?? (st as any)?.weight ?? 0);
        const r = Number(st?.reps ?? 0);
        if (m && w > 0 && r > 0) {
          const e1rm = Math.round(w * (1 + r / 30) * 10) / 10;
          if (e1rm > (factE1rmByMuscle[m] || 0)) factE1rmByMuscle[m] = e1rm;
        }
        const rirVal = Number(st?.rir);
        if (Number.isFinite(rirVal) && rirVal >= 0 && rirVal <= 6) {
          actualRirSum += rirVal;
          actualRirCount += 1;
        }
      }
    }
  }
  const factChanges: string[] = [];
  let updatedMaxCount = 0;
  for (const [m, e1rm] of Object.entries(factE1rmByMuscle)) {
    const prevWm = Number(baseWorkMax[m]) || 0;
    if (e1rm > prevWm * 1.02 || (prevWm > 0 && e1rm < prevWm * 0.90)) {
      baseWorkMax[m] = Math.round(e1rm * 10) / 10;
      updatedMaxCount += 1;
    }
  }
  const plannedFrozenSets = frozen.reduce(
    (sum, wk) => sum + (wk.sessions || []).reduce(
      (s2, sess) => s2 + (sess.exercises || []).filter((e: any) => !e.warmupActivator).reduce((s3, e) => s3 + (e.sets || 0), 0),
      0,
    ),
    0,
  );
  const adherence = plannedFrozenSets > 0 && relevantSessions.length > 0 ? loggedSets / plannedFrozenSets : null;
  let factRecoveryMult: number | undefined = Number.isFinite(snap.recoveryMultOverride) ? snap.recoveryMultOverride : undefined;
  if (adherence != null && adherence < 0.70) {
    factRecoveryMult = Math.max(0.75, Math.round(((factRecoveryMult ?? 1) * 0.9) * 100) / 100);
    factChanges.push(`📉 Факт adherence ${Math.round(adherence * 100)}% (<70%) — объём остатка смягчён (×${factRecoveryMult}).`);
  }
  if (actualRirCount >= 6) {
    const avgActualRir = actualRirSum / actualRirCount;
    if (avgActualRir < 1.0) {
      factRecoveryMult = Math.max(0.75, Math.round(((factRecoveryMult ?? 1) * 0.92) * 100) / 100);
      factChanges.push(`🔥 Фактический средний RIR ${avgActualRir.toFixed(1)} (высокая усталость) — добавлен запас восстановления.`);
    }
  }
  if (updatedMaxCount > 0) {
    factChanges.push(`🏋️ Обновлён рабочий максимум по факту дневника (${updatedMaxCount} мышц).`);
  }
  // Fallback для планов, собранных до расширения снапшота: buildContext/plan
  // хранят пол, PED-адаптацию и капы, без которых реплан стартовал «натуралом».
  const ctx: any = (plan as any).buildContext || {};
  const pedDoses: Record<string, number> | undefined = (snap.pedDoses && typeof snap.pedDoses === 'object')
    ? { ...snap.pedDoses }
    : (plan as any).pedAdaptation?.pedDoses
      ? { ...(plan as any).pedAdaptation.pedDoses }
      : undefined;

  const tailStartWeek = baseStartIso ? addDaysIsoLocal(baseStartIso, (current - 1) * 7) : undefined;
  const input: BBBuilderInput = {
    patternId,
    level: String(snap.level || (plan as any).level || 'intermediate'),
    goal: (snap.goal || 'mass') as BBBuilderInput['goal'],
    weeks: remaining,
    workMax: baseWorkMax,
    weakPoints: Array.isArray(snap.weakPoints) ? snap.weakPoints : [],
    focusGroup: snap.focusGroup || undefined,
    specialization: snap.specialization,
    specializationSchedule: Array.isArray(snap.specializationSchedule) ? snap.specializationSchedule : undefined,
    equipment: Array.isArray(snap.equipment) ? snap.equipment : [],
    volumeGoal: (snap.volumeGoal || 'mav') as BBBuilderInput['volumeGoal'],
    trainingFocus: snap.trainingFocus,
    methodology: snap.methodology,
    supersetMode: snap.supersetMode,
    volumeScheme: snap.volumeScheme,
    dupMode: snap.dupMode,
    dupMuscles: Array.isArray(snap.dupMuscles) ? snap.dupMuscles : undefined,
    trainingVolumeMode: snap.trainingVolumeMode,
    trainingYears: Number.isFinite(snap.trainingYears) ? snap.trainingYears : undefined,
    courseIntensity: snap.courseIntensity as BBBuilderInput['courseIntensity'],
    fewerCompound: snap.fewerCompound,
    allowStrengthLifts: snap.allowStrengthLifts,
    rotationMode: snap.rotationMode,
    abPatternRotation: snap.abPatternRotation,
    packingV2: snap.packingV2,
    intensityLevel: snap.intensityLevel,
    avoidAxialLoad: snap.avoidAxialLoad,
    injuries: Array.isArray(snap.injuries) ? snap.injuries : [],
    mobilityRestrictions: Array.isArray(snap.mobilityRestrictions) ? snap.mobilityRestrictions : [],
    favoriteExercises: Array.isArray(snap.favoriteExercises) ? snap.favoriteExercises : [],
    excludedExercises: Array.isArray(snap.excludedExercises) ? snap.excludedExercises : [],
    bannedPatterns: Array.isArray(snap.bannedPatterns) ? snap.bannedPatterns : undefined,
    autoDeload: snap.autoDeload,
    deloadType: snap.deloadType,
    loadStrategy: snap.loadStrategy,
    eccentricMult: snap.eccentricMult,
    calorieSurplus: snap.calorieSurplus,
    proteinPerKg: snap.proteinPerKg,
    labMrvMultiplier: snap.labMrvMultiplier,
    labWarnings: Array.isArray(snap.labWarnings) ? snap.labWarnings : undefined,
    labIntensityNote: snap.labIntensityNote,
    bodyFat: snap.bodyFat,
    targetBodyFat: snap.targetBodyFat,
    leanMass: snap.leanMass,
    hrvMs: snap.hrvMs,
    hrvBaseline: snap.hrvBaseline,
    hrvBaselineZ: snap.hrvBaselineZ,
    sleepHours: snap.sleepHours,
    stressLevel: snap.stressLevel,
    recoveryMultOverride: factRecoveryMult,
    wearable: snap.wearable,
    vbt: snap.vbt,
    deloadReadiness: snap.deloadReadiness,
    mevCalibration: snap.mevCalibration,
    cooldownHistory: Array.isArray(snap.cooldownHistory) ? snap.cooldownHistory : undefined,
    bfrMode: snap.bfrMode,
    dcMode: snap.dcMode,
    pedPhaseOverride: snap.pedPhaseOverride,
    blastCruiseEnabled: snap.blastCruiseEnabled,
    blastWeeks: snap.blastWeeks,
    cruiseWeeks: snap.cruiseWeeks,
    // P0: сквозной контракт входа. Без пола реплан терял женские минимумы,
    // без PED-доз — onCourse/MRV/DC, без техник/авторегуляции — интенсивность.
    sex: (snap.sex || (plan as any).sex || ctx.sex
      || (/^female_/i.test(String(patternId)) ? 'female' : undefined)) as BBBuilderInput['sex'],
    pedDoses,
    // Проход 17: та же фарма и режим, что при сборке — иначе реплан остатка
    // переводил IGF1-план в курс (или наоборот).
    peds: Array.isArray(snap.peds)
      ? snap.peds
      : (Array.isArray((plan as any).pedAdaptation?.activePEDs) ? (plan as any).pedAdaptation.activePEDs : undefined),
    onCourse: typeof snap.onCourse === 'boolean' ? snap.onCourse : undefined,
    intensityTechnique: snap.intensityTechnique as BBBuilderInput['intensityTechnique'],
    autoRegResult: snap.autoRegResult,
    volumeWave: snap.volumeWave,
    volumeRamp: snap.volumeRamp as BBBuilderInput['volumeRamp'],
    age: Number.isFinite(snap.age) ? snap.age : undefined,
    cycleDay: Number.isFinite(snap.cycleDay) ? snap.cycleDay : undefined,
    cycleLength: Number.isFinite(snap.cycleLength) ? snap.cycleLength : undefined,
    painLevel: snap.painLevel,
    painLocation: snap.painLocation,
    soreness010: snap.soreness010,
    rehabMuscles: Array.isArray(snap.rehabMuscles) ? snap.rehabMuscles : undefined,
    rehabWeekStart: Number.isFinite(snap.rehabWeekStart) ? snap.rehabWeekStart : undefined,
    bodyweightCapability: snap.bodyweightCapability,
    availablePlates: Array.isArray(snap.availablePlates) ? snap.availablePlates : undefined,
    // Продолжение от фактического пика прожитых недель (без загрязнения невыполненным хвостом).
    previousPlan,
    previousPlans: [previousPlan],
    planStartWeek: tailStartWeek,
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
    workMax: (rebuilt as any).workMax || input.workMax || (plan as any).workMax,
    validation: (rebuilt as any).validation || (plan as any).validation,
    rationale: [
      ...((plan as any).rationale || []),
      `🔁 Пересборка остатка: заморожено недель ${frozen.length} (факт не переписан), пересобрано ${tail.length} от фактического пика.`,
    ],
    inputSnapshot: {
      ...(snap as Record<string, unknown>),
      ...((rebuilt as any).inputSnapshot || {}),
      workMax: input.workMax,
    },
  } as BBPlan;

  // Пересобрать derived-снапшоты на ВСЁМ итоговом плане: раньше weeklyVolume
  // покрывал только пересобранный остаток (8-нед план → ключи 1–6) и
  // валидация не видела замороженный префикс.
  const finalCtx: any = (rebuilt as any).buildContext || ctx;
  refreshBBPlanSnapshots(out, {
    validationOptions: {
      level: finalCtx.level || input.level,
      trainingYears: finalCtx.trainingYears ?? input.trainingYears,
      onCourse: finalCtx.onCourse ?? (rebuilt as any).onCourse,
      trainingVolumeMode: finalCtx.trainingVolumeMode ?? input.trainingVolumeMode,
      patternId: finalCtx.patternId || patternId,
      maxWorkingSets: finalCtx.maxWorkingSets,
      maxExercises: finalCtx.maxExercises,
      equipment: input.equipment,
      excludedExercises: input.excludedExercises,
      excludedMuscles: (plan as any).safetyConstraints?.excludedMuscles,
      avoidAxialLoad: input.avoidAxialLoad,
      specializationTargets: finalCtx.priorityMuscles,
      checkOrder: true,
    },
    specTargets: finalCtx.priorityMuscles || [],
    refreshFrequency: true,
    refreshValidationRationale: true,
    refreshRotationRationale: true,
  });
  stampBBPlanFinalizeSignature(out);

  return {
    plan: out,
    changes: [
      `🔁 Остаток мезоцикла пересобран: недели ${frozen.length + 1}–${total} (${tail.length} нед) от фактического пика прожитых недель.`,
      ...factChanges,
    ],
    frozenWeeks: frozen.length,
    rebuiltWeeks: tail.length,
  };
}
