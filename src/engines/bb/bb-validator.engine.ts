import type { BBPlan, BBSession } from './bb-builder.engine';
import { trueMuscleOf } from '../movement-pattern';
import { estimateBBSessionCost } from './bb-fatigue.engine';
import { aggregateBBVolume, sessionLimitsFor as centralizedSessionLimits } from './bb-volume.engine';
import { getVolumeLandmarks } from '../volume-landmarks.engine';
import { isAxialLoadExercise } from '../exercise-selector.engine';
import { EXERCISE_CATALOG } from '../../core/exercise-catalog';
import { TAG_MUSCLES } from './bb-day-types';
import { isCompoundEx } from './bb-session-order.engine';

export interface BBPlanValidationIssue {
  level: 'error' | 'warning';
  code: string;
  message: string;
  week?: number;
  session?: number;
  exercise?: string;
}

export interface BBPlanValidationResult {
  valid: boolean;
  issues: BBPlanValidationIssue[];
}

export const BB_MRV_TOLERANCE = 1.15;

export interface BBPlanValidationOptions {
  level?: string;
  mrvMultiplier?: number;
  equipment?: string[];
  excludedExercises?: string[];
  excludedMuscles?: string[];
  avoidAxialLoad?: boolean;
  checkOrder?: boolean;
  methodology?: 'compound_first' | 'pre_exhaust' | 'post_exhaust';
  /** Опыт в годах — для enhanced-лимитов сессии (60/18 вместо 24/10). */
  trainingYears?: number;
}

/** Лимиты сессии зависят от уровня: natural 24/10, enhanced 60/18 (3+ лет)
 *  и 40/14 (1-2 года) — делегирует в централизованный sessionLimitsFor (bb-volume),
 *  чтобы не дублировать логику в 13 местах. */
export function sessionLimitsFor(options: BBPlanValidationOptions): { maxExercises: number; maxWorkingSets: number } {
  const l = centralizedSessionLimits({ level: options.level, trainingYears: options.trainingYears });
  return { maxExercises: l.maxExercises, maxWorkingSets: l.maxWorkingSets };
}

/** Синхронизирует агрегированное число sets с фактическими рабочими сетами. */
export function syncBBPlanSetShape(plan: BBPlan): BBPlan {
  for (const week of plan.weeks) {
    for (const session of week.sessions) {
    for (const exercise of session.exercises) {
        // F0 guard: NaN sets → 0 (капы freeze, только защита от NaN)
        const rawSets = Number(exercise.sets);
        const target = Number.isFinite(rawSets) ? Math.max(0, rawSets) : 0;
        const current = Array.isArray(exercise.workSets) ? exercise.workSets : [];
        if (current.length > target) {
          exercise.workSets = current.slice(0, target);
        } else if (current.length < target) {
          const template = current[current.length - 1] || {
            reps: exercise.repsRange?.[0] || 8,
            rir: exercise.rir ?? 2,
            weight: 0,
          };
          exercise.workSets = [...current, ...Array.from({ length: target - current.length }, () => ({ ...template }))];
        }
      }
    }
  }
  return plan;
}

function validateSession(session: BBSession, week: number, sessionIndex: number, options: BBPlanValidationOptions = {}): BBPlanValidationIssue[] {
  const issues: BBPlanValidationIssue[] = [];
  // Разминочное упражнение не входит в лимит рабочих упражнений.
  const workingCount = session.exercises.filter(exercise => !(exercise as any).warmupActivator).length;
  const { maxExercises } = sessionLimitsFor(options);
  if (workingCount > maxExercises) {
    issues.push({ level: 'error', code: 'session_exercise_cap', message: `Сессия содержит ${workingCount} рабочих упражнений (максимум ${maxExercises}).`, week, session: sessionIndex });
  }
  const cost = estimateBBSessionCost(session);
  if (options.checkOrder) {
    const primaryIndex = session.exercises.findIndex(exercise => exercise.role === 'primary');
    if (primaryIndex >= 0) {
      const primary = session.exercises[primaryIndex];
      if (options.methodology !== 'pre_exhaust' && !isCompoundEx(primary)) {
        issues.push({ level: 'warning', code: 'primary_not_compound', message: `${primary.name}: primary упражнение не является compound.`, week, session: sessionIndex, exercise: primary.name });
      }
      if (options.methodology !== 'pre_exhaust' && session.exercises.slice(0, primaryIndex).some(exercise => exercise.role !== 'primary')) {
        issues.push({ level: 'warning', code: 'order_primary_after_accessory', message: `Primary упражнение ${primary.name} стоит после accessory в сессии.`, week, session: sessionIndex, exercise: primary.name });
      }
    }
  }
  if (cost.timeSeconds > 100 * 60) {
    issues.push({ level: 'warning', code: 'session_duration', message: `Расчётная длительность сессии около ${Math.round(cost.timeSeconds / 60)} мин.`, week, session: sessionIndex });
  }
  if (cost.axial > 12) {
    issues.push({ level: 'warning', code: 'axial_fatigue', message: `Высокая осевая усталость: ${cost.axial.toFixed(1)} условных единиц.`, week, session: sessionIndex });
  }
  for (const exercise of session.exercises) {
    const sets = exercise.workSets?.length || 0;
    if (sets !== exercise.sets) {
      issues.push({ level: 'error', code: 'sets_mismatch', message: `${exercise.name}: sets=${exercise.sets}, workSets=${sets}.`, week, session: sessionIndex, exercise: exercise.name });
    }
    if (sets > 0 && sets < 2) {
      issues.push({ level: 'warning', code: 'single_work_set', message: `${exercise.name}: только ${sets} рабочий сет.`, week, session: sessionIndex, exercise: exercise.name });
    }
    const canonical = trueMuscleOf({ name: exercise.name, muscle: exercise.muscle } as any);
    // Каталог определяет «основную» мышцу compound-движения; для изоляций
    // (французский жим, махи, разгибания на блоке) target-мышца из плана
    // точнее. Не выдаём false-positive предупреждения для изоляций.
    const name = (exercise.name || '').toLowerCase();
    const isIsolation = /сгибан|разгибан|мах|raise|fly|развод|француз|french|curl|extension|kickback|шраг|кроссовер|pushdown|скручив|crunch|подъём|подъем|сведен/i.test(name);
    if (canonical && canonical !== exercise.muscle && !(canonical === 'shoulders' && /^delt_/.test(exercise.muscle)) && !isIsolation) {
      issues.push({ level: 'warning', code: 'muscle_attribution', message: `${exercise.name}: muscle=${exercise.muscle}, каталог определяет ${canonical}.`, week, session: sessionIndex, exercise: exercise.name });
    }
    if (exercise.workSets.some(ws => !Number.isFinite(ws.weight) || !Number.isFinite(ws.reps) || !Number.isFinite(ws.rir) || ws.weight < 0 || ws.reps <= 0 || ws.rir < 0 || ws.rir > 5)) {
      issues.push({ level: 'error', code: 'invalid_work_set', message: `${exercise.name}: некорректные weight/reps/RIR.`, week, session: sessionIndex, exercise: exercise.name });
    }
    if (options.excludedExercises?.includes(exercise.name) || options.excludedExercises?.includes(exercise.exerciseName || '')) issues.push({ level: 'error', code: 'excluded_exercise_present', message: `${exercise.name}: упражнение находится в excludedExercises.`, week, session: sessionIndex, exercise: exercise.name });
    if (options.excludedMuscles?.includes(exercise.muscle)) issues.push({ level: 'error', code: 'excluded_muscle_present', message: `${exercise.name}: мышца ${exercise.muscle} исключена ограничениями.`, week, session: sessionIndex, exercise: exercise.name });
    if (options.avoidAxialLoad && isAxialLoadExercise({ name: exercise.name, id: exercise.exerciseName } as any)) issues.push({ level: 'error', code: 'axial_restriction_violation', message: `${exercise.name}: осевая нагрузка запрещена.`, week, session: sessionIndex, exercise: exercise.name });
    if (options.equipment?.length) {
        const catalog = EXERCISE_CATALOG.find(item => item.name === exercise.name || item.id === exercise.exerciseName);
        const rawEquipment = catalog?.equipment;
        const equipment = Array.isArray(rawEquipment) ? rawEquipment.map(String) : rawEquipment ? [String(rawEquipment)] : [];
        const syntheticMuscleName = new Set(['chest', 'back', 'shoulders', 'quads', 'hamstrings', 'glutes', 'calves', 'biceps', 'triceps', 'forearms', 'abs', 'traps', 'arms', 'legs', 'core', 'lower_back']).has(exercise.name.toLowerCase());
        if (!catalog && !syntheticMuscleName) {
          issues.push({ level: 'error', code: 'equipment_unknown_exercise', message: `${exercise.name}: упражнение отсутствует в каталоге, оборудование невозможно подтвердить.`, week, session: sessionIndex, exercise: exercise.name });
        } else if (equipment.length > 0 && !equipment.some(item => options.equipment!.includes(item))) {
          issues.push({ level: 'error', code: 'equipment_restriction_violation', message: `${exercise.name}: оборудование не входит в доступный список.`, week, session: sessionIndex, exercise: exercise.name });
        }
      }
  }
  return issues;
}

export function validateBBPlan(plan: BBPlan, options: BBPlanValidationOptions = {}): BBPlanValidationResult {
  const issues: BBPlanValidationIssue[] = [];
  if (!plan.weeks.length) issues.push({ level: 'error', code: 'empty_plan', message: 'План не содержит недель.' });
  plan.weeks.forEach((week, wi) => week.sessions.forEach((session, si) => {
    issues.push(...validateSession(session, week.week || wi + 1, si + 1, options));
    const allowedMuscles = TAG_MUSCLES[session.sessionTag || ''];
    if (allowedMuscles?.length) for (const exercise of session.exercises) {
      const canonical = trueMuscleOf({ name: exercise.name, muscle: exercise.muscle } as any) || exercise.muscle;
      const allowed = allowedMuscles.includes(canonical) || (canonical === 'shoulders' && allowedMuscles.some(muscle => /^delt_/.test(muscle)));
      if (!allowed) issues.push({ level: 'warning', code: 'session_muscle_leak', message: `${exercise.name}: мышца ${canonical} не соответствует тегу дня ${session.sessionTag}.`, week: week.week || wi + 1, session: si + 1, exercise: exercise.name });
    }
    const sessionSets = session.exercises
      .filter(exercise => !(exercise as any).warmupActivator)
      .reduce((sum, exercise) => sum + exercise.sets, 0);
    const { maxWorkingSets } = sessionLimitsFor(options);
    if (sessionSets > maxWorkingSets) {
      issues.push({ level: 'warning', code: 'session_working_set_cap', message: `Сессия содержит ${sessionSets} рабочих сетов; target/session cap равен ${maxWorkingSets}.`, week: week.week || wi + 1, session: si + 1 });
    }
  }));
  for (let index = 1; index < plan.weeks.length; index++) {
    const week = plan.weeks[index] as any;
    const previous = plan.weeks[index - 1];
    const phase = String(week.phase || '').toLowerCase();
    if (phase !== 'deload' && phase !== 'transition') continue;
    const currentSets = week.sessions.reduce((sum: number, session: BBSession) => sum + session.exercises.reduce((s, exercise) => s + exercise.sets, 0), 0);
    const previousSets = previous.sessions.reduce((sum, session) => sum + session.exercises.reduce((s, exercise) => s + exercise.sets, 0), 0);
    if (currentSets > Math.ceil(previousSets * 0.75)) {
      issues.push({ level: 'warning', code: 'deload_volume_not_reduced', message: `Неделя ${week.week}: deload объём ${currentSets} не снижен относительно ${previousSets}.` });
    }
    const rirValues = week.sessions.flatMap((session: BBSession) => session.exercises.map(exercise => exercise.rir));
    if (rirValues.length > 0 && Math.min(...rirValues) < 3) {
      issues.push({ level: 'warning', code: 'deload_rir_too_low', message: `Неделя ${week.week}: deload содержит RIR ниже 3.` });
    }
  }
  for (let index = 1; index < plan.weeks.length; index++) {
    const week = plan.weeks[index] as any;
    const previous = plan.weeks[index - 1];
    const phase = String(week.phase || '').toLowerCase();
    const taper = Boolean(week.taper) || /taper|подвод/i.test(String(week.rationale || ''));
    if (!taper && phase !== 'peaking') continue;
    const currentSets = week.sessions.reduce((sum: number, session: BBSession) => sum + session.exercises.reduce((s, exercise) => s + exercise.sets, 0), 0);
    const previousSets = previous.sessions.reduce((sum, session) => sum + session.exercises.reduce((s, exercise) => s + exercise.sets, 0), 0);
    if (currentSets > previousSets) {
      issues.push({ level: 'warning', code: 'taper_volume_increased', message: `Неделя ${week.week}: taper/peak объём ${currentSets} выше предыдущей недели ${previousSets}.` });
    }
  }
  if (options.level && plan.weeks.length > 0) {
    for (const week of plan.weeks) {
      const volume = aggregateBBVolume(week.sessions);
      for (const [muscle, values] of Object.entries(volume)) {
        // Фактический per-muscle MRV-кап после всех множителей (PED/recovery/
        // lab/стаж) имеет приоритет над landmarks.mrv — иначе enhanced-планы
        // получают ложные overflow (landmarks.mrv не учитывает стажевые бусты).
        // Допуск ×1.1: MRV — мягкий ориентир, пограничные ±10% не флагаются
        // (ложные «на грани» предупреждения у natural-планов).
        // Допуск ×1.15 (паритет с plan-validator error-порогом): MRV — мягкий
        // ориентир, пограничные ±15% не флагаются (ложные «на грани» у natural).
        const actualCap = plan.mrvByMuscle?.[muscle];
        const lm = getVolumeLandmarks(options.level, muscle);
        const cap = actualCap ?? (lm ? Math.round(lm.mrv * (options.mrvMultiplier ?? 1)) : 0);
        if (cap > 0 && values.effectiveSets > cap * BB_MRV_TOLERANCE) {
          issues.push({ level: 'warning', code: 'effective_mrv_overflow', message: `Неделя ${week.week}: ${muscle}: effective ${Math.round(values.effectiveSets * 10) / 10} > MRV ${cap}.`, week: week.week });
        }
      }
    }
  }
  if (plan.volumeTargets) {
    for (const [muscle, target] of Object.entries(plan.volumeTargets)) {
      const peakVolume = plan.weeklyVolume
        ? Math.max(...Object.values(plan.weeklyVolume).map(week => week[muscle]?.effectiveSets || 0))
        : 0;
      // Порог 70% MEV: дефициты 70-100% — пограничная точность распределения
      // (шум в rationale для лимитированных natural-сплитов); значимые <70%.
      if (peakVolume < target.mev * 0.7) {
        issues.push({ level: 'warning', code: 'target_volume_deficit', message: `${muscle}: effective volume ${Math.round(peakVolume * 10) / 10} ниже MEV ${target.mev} (${Math.round((peakVolume / target.mev) * 100)}%); проверьте feeder/session cap или ограничения оборудования.`, exercise: muscle });
      }
    }
  }
  return { valid: issues.every(issue => issue.level !== 'error'), issues };
}

/**
 * PRO: конвертировать validation issues в actionable рекомендации.
 * Вместо "chest: volume 5 ниже MEV 8" → "Добавьте 3 сета на chest: жим гантелей лёжа в день 2".
 */
export function generateActionableRecommendations(
  plan: BBPlan,
  issues: BBPlanValidationIssue[],
): { priority: 'high' | 'medium' | 'low'; action: string; code: string }[] {
  const recs: { priority: 'high' | 'medium' | 'low'; action: string; code: string }[] = [];

  for (const issue of issues) {
    switch (issue.code) {
      case 'target_volume_deficit': {
        // "muscle: effective volume X ниже MEV Y" → "Добавьте N сетов на muscle"
        const match = issue.message.match(/([\w_]+):.*volume\s+([\d.]+).*MEV\s+(\d+)/);
        if (match) {
          const muscle = match[1];
          const current = parseFloat(match[2]);
          const mev = parseInt(match[3]);
          const deficit = Math.ceil(mev - current);
          recs.push({
            priority: 'high',
            action: `Добавьте ${deficit} сет(а) на ${muscle}: включите feeder-сеты или добавьте изоляцию в ближайший день.`,
            code: issue.code,
          });
        }
        break;
      }
      case 'effective_mrv_overflow': {
        const match = issue.message.match(/([\w_]+):.*effective\s+([\d.]+).*MRV\s+(\d+)/);
        if (match) {
          const muscle = match[1];
          const current = parseFloat(match[2]);
          const mrv = parseInt(match[3]);
          const excess = Math.ceil(current - mrv);
          recs.push({
            priority: 'high',
            action: `Снизьте ${excess} сет(а) на ${muscle}: уберите accessory или уменьшите сеты primary в неделе ${issue.week || ''}.`,
            code: issue.code,
          });
        }
        break;
      }
      case 'deload_volume_not_reduced': {
        recs.push({
          priority: 'medium',
          action: `Deload-неделя: снизьте объём на 25-40% (уберите 1-2 сета на упражнение, оставьте вес).`,
          code: issue.code,
        });
        break;
      }
      case 'deload_rir_too_low': {
        recs.push({
          priority: 'medium',
          action: `Deload-неделя: повысьте RIR до 3-4 (снижение интенсивности для восстановления).`,
          code: issue.code,
        });
        break;
      }
      case 'taper_volume_increased': {
        recs.push({
          priority: 'high',
          action: `Taper/peak: объём не должен расти. Уберите accessory, оставьте только primary compounds с низким объёмом.`,
          code: issue.code,
        });
        break;
      }
      case 'session_working_set_cap': {
        recs.push({
          priority: 'medium',
          action: `Сессия превышает 24 сета: уберите 1-2 accessory упражнения или уменьшите сеты на изоляции.`,
          code: issue.code,
        });
        break;
      }
      case 'session_muscle_leak': {
        recs.push({
          priority: 'low',
          action: `${issue.exercise || 'Упражнение'} не соответствует дню — замените на упражнение целевой группы.`,
          code: issue.code,
        });
        break;
      }
    }
  }

  // Если проблем нет — позитивная рекомендация
  if (recs.length === 0) {
    recs.push({
      priority: 'low',
      action: '✅ План сбалансирован: объём в пределах MEV-MRV, делод и taper корректны.',
      code: 'all_clear',
    });
  }

  return recs.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.priority] - order[b.priority];
  });
}
