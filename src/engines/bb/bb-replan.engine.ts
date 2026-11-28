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
import { SPLIT_PATTERNS, loadCustomSplitPatterns } from './bb-split-patterns';
import { normalizeBBMuscle } from './bb-volume.engine';
import { adaptWeekForTravel } from './bb-gym-profiles.engine';
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
  /** Опциональные переопределения входов при пересборке (травмы, зал, цели, акценты). */
  overrides?: Partial<BBBuilderInput>;
  /** Пропущено тренировочных дней на текущей неделе (уплотнение/коррекция). */
  missedDays?: number;
  /** Полный пропуск / лёгкая неделя реабилитации на currentWeek. */
  skipWeek?: boolean;
  /** Новые травмы, добавляемые с currentWeek. */
  newInjuries?: any[];
  /** Временный/новый инвентарь зала для оставшихся недель. */
  gymEquipment?: string[];
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
  const customSplits = loadCustomSplitPatterns();
  const resolvedCustomPattern = opts.overrides?.customPattern
    || snap.customPattern
    || customSplits.find(p => p.id === patternId);
  const isKnownSplitPattern = SPLIT_PATTERNS.some(p => p.id === patternId)
    || customSplits.some(p => p.id === patternId)
    || !!snap.customPattern
    || !!opts.overrides?.customPattern;

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
  const baseWorkMax: Record<string, number> = { ...((snap.workMax || (plan as any).workMax || {}) as Record<string, number>) };
  const factE1rmByMuscle: Record<string, number> = {};
  let loggedSets = 0;
  let actualRirSum = 0;
  let actualRirCount = 0;
  const smallDirectWorkMax = new Set(['biceps', 'triceps', 'calves', 'forearms', 'abs']);
  const highRatioNonCompoundRe = /leg.?press|жим ногами|hack|гакк|smith|смит|развод|fly|мах|raise|сгибан|разгибан|curl|extension|кроссов|butterfly|пек.?дек/i;
  for (const sess of relevantSessions) {
    for (const ex of sess.exercises || []) {
      const m = normalizeBBMuscle((ex as any).muscle || ex.muscleGroup || '');
      const exTitle = String((ex as any).name || (ex as any).exerciseName || (ex as any).exerciseId || '');
      const allowWorkMaxSample = !highRatioNonCompoundRe.test(exTitle) || smallDirectWorkMax.has(m);
      for (const st of ex.sets || []) {
        loggedSets += 1;
        const w = Number(st?.weightKg ?? (st as any)?.weight ?? 0);
        const r = Number(st?.reps ?? 0);
        const rirRaw = Number(st?.rir);
        const effRir = (Number.isFinite(rirRaw) && rirRaw >= 0 && rirRaw <= 6) ? rirRaw : 0;
        if (m && w > 0 && r > 0 && allowWorkMaxSample) {
          const e1rm = Math.round(w * (1 + (r + effRir) / 30) * 10) / 10;
          if (e1rm > (factE1rmByMuscle[m] || 0)) factE1rmByMuscle[m] = e1rm;
        }
        if (Number.isFinite(rirRaw) && rirRaw >= 0 && rirRaw <= 6) {
          actualRirSum += rirRaw;
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
      const bounded = prevWm > 0
        ? Math.max(prevWm * 0.85, Math.min(prevWm * 1.15, e1rm))
        : e1rm;
      baseWorkMax[m] = Math.round(bounded * 10) / 10;
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
  const mergedNewInjuries = Array.isArray(opts.newInjuries) && opts.newInjuries.length > 0 ? opts.newInjuries : [];
  const effEquipment = Array.isArray(opts.gymEquipment) && opts.gymEquipment.length > 0
    ? opts.gymEquipment
    : (Array.isArray(snap.equipment) ? snap.equipment : []);

  // Ветка для планов из «Программ / Циклов» (in-place адаптация недель current..total без подмены сплита):
  if (!isKnownSplitPattern) {
    let workingPlan: BBPlan = structuredClone(plan);
    const inPlaceChanges: string[] = [...factChanges];
    const exclInj = new Set(mergedNewInjuries.filter((i: any) => i?.exclude !== false).map((i: any) => normalizeBBMuscle(i.muscle || '')));
    const gradedInj = mergedNewInjuries.filter((i: any) => i?.exclude === false);

    if (mergedNewInjuries.length > 0) {
      inPlaceChanges.push(`🩹 Учтены новые ограничения (${mergedNewInjuries.length}) с недели ${current}`);
    }
    for (let wi = current - 1; wi < workingPlan.weeks.length; wi++) {
      const wObj = workingPlan.weeks[wi];
      if (!wObj) continue;
      if (opts.skipWeek && wObj.week === current) {
        (wObj as any).deload = true;
        (wObj as any).phase = 'deload';
        for (const s of wObj.sessions) {
          for (const e of s.exercises) {
            if ((e as any).warmupActivator) continue;
            e.sets = Math.max(2, Math.round((e.sets || 2) * 0.6));
            e.rir = Math.min(5, (e.rir ?? 2) + 2);
            if (Array.isArray(e.workSets)) {
              e.workSets = e.workSets.slice(0, e.sets).map(ws => ({
                ...ws,
                rir: e.rir,
                weight: ws.weight > 0 ? Math.max(2.5, Math.round(ws.weight * 0.8 * 2) / 2) : 0,
              }));
            }
          }
        }
        inPlaceChanges.push(`⏭ Неделя ${current}: переведена в разгрузочный / реабилитационный режим`);
      }
      if (opts.missedDays && opts.missedDays > 0 && wObj.week === current && wObj.sessions.length > 1) {
        const dropCount = Math.min(opts.missedDays, wObj.sessions.length - 1);
        wObj.sessions = wObj.sessions.slice(0, wObj.sessions.length - dropCount);
        inPlaceChanges.push(`📅 Неделя ${current}: сжата до ${wObj.sessions.length} тренировок (пропуск ${dropCount} дн.)`);
      }
      for (const s of wObj.sessions) {
        if (exclInj.size > 0) {
          s.exercises = s.exercises.filter(e => !exclInj.has(normalizeBBMuscle(e.muscle || '')));
        }
        for (const e of s.exercises) {
          const nm = normalizeBBMuscle(e.muscle || '');
          const g = gradedInj.find((x: any) => normalizeBBMuscle(x.muscle || '') === nm);
          if (g) {
            const vPct = Number.isFinite(g.volumePct) ? Number(g.volumePct) : 0.7;
            const wPct = Number.isFinite(g.weightPct) ? Number(g.weightPct) : 0.8;
            e.sets = Math.max(2, Math.round((e.sets || 2) * vPct));
            e.rir = Math.min(5, (e.rir ?? 2) + 1);
            if (Array.isArray(e.workSets)) {
              e.workSets = e.workSets.slice(0, e.sets).map(ws => ({
                ...ws,
                rir: e.rir,
                weight: ws.weight > 0 ? Math.max(2.5, Math.round(ws.weight * wPct * 2) / 2) : 0,
              }));
            }
          }
        }
      }
    }
    if (opts.gymEquipment && opts.gymEquipment.length > 0) {
      let totalReplaced = 0;
      for (let wNum = current; wNum <= total; wNum++) {
        const adapted = adaptWeekForTravel(workingPlan, wNum, opts.gymEquipment);
        workingPlan = adapted.plan;
        totalReplaced += adapted.replaced;
      }
      inPlaceChanges.push(`✈️ Инвентарь [${opts.gymEquipment.join(', ')}] применён к неделям ${current}–${total} (заменено ${totalReplaced} упр.)`);
    }
    workingPlan.inputSnapshot = {
      ...(snap as Record<string, unknown>),
      workMax: baseWorkMax,
      equipment: effEquipment,
      injuries: [...(Array.isArray(snap.injuries) ? snap.injuries : []), ...mergedNewInjuries],
    } as any;
    refreshBBPlanSnapshots(workingPlan, {
      validationOptions: {
        level: ctx.level || snap.level || (plan as any).level || 'intermediate',
        equipment: effEquipment,
        excludedExercises: snap.excludedExercises,
        excludedMuscles: [...exclInj, ...((plan as any).safetyConstraints?.excludedMuscles || [])],
        checkOrder: true,
        methodology: snap.methodology,
        onCourse: (workingPlan as any).onCourse,
        maxWorkingSets: (workingPlan as any).maxWorkingSets,
        maxExercises: (workingPlan as any).maxExercises,
      },
      specTargets: ctx.priorityMuscles || (workingPlan as any).priorityMuscles || [],
      refreshFrequency: true,
      refreshValidationRationale: true,
    });
    stampBBPlanFinalizeSignature(workingPlan);
    return {
      plan: workingPlan,
      changes: inPlaceChanges.length > 0 ? inPlaceChanges : [`🔁 Остаток программы пересчитан: недели ${current}–${total}`],
      frozenWeeks: frozen.length,
      rebuiltWeeks: Math.max(1, total - frozen.length),
    };
  }

  const pedDoses: Record<string, number> | undefined = (snap.pedDoses && typeof snap.pedDoses === 'object')
    ? { ...snap.pedDoses }
    : (plan as any).pedAdaptation?.pedDoses
      ? { ...(plan as any).pedAdaptation.pedDoses }
      : undefined;

  const tailStartWeek = baseStartIso ? addDaysIsoLocal(baseStartIso, (current - 1) * 7) : undefined;
  const shiftedSpecSchedule = Array.isArray(snap.specializationSchedule)
    ? snap.specializationSchedule
        .map((b: any) => ({
          ...b,
          weekStart: (Number(b?.weekStart) || 1) - (current - 1),
          weekEnd: (Number(b?.weekEnd) || 1) - (current - 1),
        }))
        .filter((b: any) => b.weekEnd >= 1)
        .map((b: any) => ({ ...b, weekStart: Math.max(1, b.weekStart) }))
    : undefined;
  const baseInput: BBBuilderInput = {
    patternId,
    customPattern: resolvedCustomPattern,
    level: String(snap.level || (plan as any).level || 'intermediate'),
    goal: (snap.goal || 'mass') as BBBuilderInput['goal'],
    weeks: remaining,
    workMax: baseWorkMax,
    weakPoints: Array.isArray(snap.weakPoints) ? snap.weakPoints : [],
    focusGroup: snap.focusGroup || undefined,
    specialization: snap.specialization,
    specializationSchedule: shiftedSpecSchedule && shiftedSpecSchedule.length > 0 ? shiftedSpecSchedule : undefined,
    equipment: effEquipment,
    volumeGoal: (snap.volumeGoal || 'mav') as BBBuilderInput['volumeGoal'],
    trainingFocus: snap.trainingFocus,
    methodology: snap.methodology,
    mesoTemplate: snap.mesoTemplate,
    maxSessionMinutes: snap.maxSessionMinutes,
    tempoProfile: snap.tempoProfile,
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
    injuries: [
      ...(Array.isArray(snap.injuries) ? snap.injuries : []),
      ...mergedNewInjuries,
    ],
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
  const input: BBBuilderInput = opts.overrides
    ? { ...baseInput, ...opts.overrides, weeks: remaining, patternId }
    : baseInput;

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
  const wizardNotes: string[] = [];
  if (mergedNewInjuries.length > 0) {
    wizardNotes.push(`🩹 Учтены новые ограничения (${mergedNewInjuries.length}) с недели ${current}`);
  }
  if (opts.gymEquipment && opts.gymEquipment.length > 0) {
    wizardNotes.push(`✈️ Инвентарь обновлён: [${opts.gymEquipment.join(', ')}]`);
  }
  if (opts.skipWeek && tail[0]) {
    (tail[0] as any).deload = true;
    (tail[0] as any).phase = 'deload';
    for (const s of tail[0].sessions) {
      for (const e of s.exercises) {
        if ((e as any).warmupActivator) continue;
        e.sets = Math.max(2, Math.round((e.sets || 2) * 0.6));
        e.rir = Math.min(5, (e.rir ?? 2) + 2);
        if (Array.isArray(e.workSets)) {
          e.workSets = e.workSets.slice(0, e.sets).map(ws => ({
            ...ws,
            rir: e.rir,
            weight: ws.weight > 0 ? Math.max(2.5, Math.round(ws.weight * 0.8 * 2) / 2) : 0,
          }));
        }
      }
    }
    wizardNotes.push(`⏭ Неделя ${current}: переведена в разгрузочный / реабилитационный режим`);
  }
  if (opts.missedDays && opts.missedDays > 0 && tail[0] && tail[0].sessions.length > 1) {
    const dropCount = Math.min(opts.missedDays, tail[0].sessions.length - 1);
    tail[0].sessions = tail[0].sessions.slice(0, tail[0].sessions.length - dropCount);
    wizardNotes.push(`📅 Неделя ${current}: сжата до ${tail[0].sessions.length} тренировок (пропуск ${dropCount} дн.)`);
  }
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
      ...wizardNotes,
      `🔁 Пересборка остатка: заморожено недель ${frozen.length} (факт не переписан), пересобрано ${tail.length} от фактического пика.`,
    ],
    inputSnapshot: {
      ...(snap as Record<string, unknown>),
      ...((rebuilt as any).inputSnapshot || {}),
      workMax: input.workMax,
      customPattern: input.customPattern || (snap as any).customPattern,
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
