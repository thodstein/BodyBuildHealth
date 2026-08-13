import type { BBExercise, BBSession } from './bb-builder.engine';

export interface BBExerciseCost {
  systemic: number;
  axial: number;
  joint: number;
  local: number;
  timeSeconds: number;
}

export interface BBSessionCost extends BBExerciseCost {
  exerciseCount: number;
}

export interface BBFatigueBudget {
  maxTimeSeconds?: number;
  maxAxial?: number;
  minSetsPerExercise?: number;
  maxExercises?: number;
  maxWorkingSets?: number;
  /** MEV-guard: минимум рабочих сетов на упражнение по мышце (ceil(MEV/частота)).
   *  Бюджет не режет ниже — иначе natural-планы получают deficit. */
  minSetsByMuscle?: Record<string, number>;
}

function catalogType(exercise: BBExercise): string {
  return String((exercise as any).type || (exercise as any).exerciseType || '').toLowerCase();
}

export function estimateBBExerciseCost(exercise: BBExercise): BBExerciseCost {
  const name = String(exercise.name || '').toLowerCase();
  const sets = Math.max(0, exercise.sets || exercise.workSets?.length || 0);
  const reps = Math.max(1, exercise.workSets?.[0]?.reps || exercise.repsRange?.[0] || 8);
  const rir = Math.max(0, Math.min(5, exercise.rir ?? 2));
  const isolation = catalogType(exercise) === 'isolation' || /curl|сгибан|разгибан|raise|мах|fly|развод|шраг|pushdown|crunch|скручив/i.test(name);
  const axial = /присед|squat|станов|deadlift|румын|rdl|good.?morning|гудморнинг|тяга.*наклон/i.test(name) ? sets * 2 : 0;
  const systemicBase = isolation ? 1.0 : 2.0;
  const proximity = 1 + Math.max(0, 2 - rir) * 0.2;
  const local = sets * (isolation ? 1 : 1.25) * proximity;
  const systemic = sets * systemicBase * proximity;
  const joint = sets * (isolation ? 0.8 : 1.2) * (/француз|behind|за голов|upright|подбород/i.test(name) ? 1.35 : 1);
  const rest = exercise.restSeconds || (exercise.character === 'тяж' ? 180 : exercise.character === 'памп' ? 60 : 90);
  const timeSeconds = sets * (Math.max(20, reps * 4) + rest) + 60;
  return { systemic, axial, joint, local, timeSeconds };
}

export function estimateBBSessionCost(session: BBSession): BBSessionCost {
  const total: BBSessionCost = { systemic: 0, axial: 0, joint: 0, local: 0, timeSeconds: 0, exerciseCount: session.exercises.length };
  for (const exercise of session.exercises) {
    const cost = estimateBBExerciseCost(exercise);
    total.systemic += cost.systemic;
    total.axial += cost.axial;
    total.joint += cost.joint;
    total.local += cost.local;
    total.timeSeconds += cost.timeSeconds;
  }
  return total;
}

/**
 * Сокращает сессию до бюджета без потери primary или единственного стимула
 * мышцы. Сначала уменьшаются сеты вторичных pump/isolation движений, затем
 * удаляются резервные упражнения.
 */
export function fitBBSessionToBudget(session: BBSession, budget: BBFatigueBudget = {}): { removed: BBExercise[]; cost: BBSessionCost } {
    const maxTime = budget.maxTimeSeconds ?? 100 * 60;
  const maxAxial = budget.maxAxial ?? 16;
  const minSets = Math.max(1, budget.minSetsPerExercise ?? 2);
  const maxExercises = Math.max(1, budget.maxExercises ?? 10);
  const maxWorkingSets = Math.max(1, budget.maxWorkingSets ?? 24);
  const removed: BBExercise[] = [];
  // Нижняя граница сетов по мышце (MEV-guard): floor = max(minSets, guard мышцы).
  const floorFor = (muscle: string): number => Math.max(minSets, budget.minSetsByMuscle?.[muscle] ?? minSets);
  const muscles = () => new Set(session.exercises.map(exercise => exercise.muscle));
  const exerciseSetCount = (exercise: BBExercise): number => Math.max(0, exercise.sets || exercise.workSets?.length || 0);
  const totalWorkingSets = (): number => session.exercises.reduce((sum, exercise) => sum + exerciseSetCount(exercise), 0);
  // Разминочное упражнение не входит в лимит упражнений и рабочий бюджет.
  const workingExercises = (): BBExercise[] => session.exercises.filter(exercise => !(exercise as any).warmupActivator);
  const syncSets = (exercise: BBExercise, sets: number): void => {
    const target = Math.max(floorFor(exercise.muscle), sets);
    exercise.sets = target;
    const current = exercise.workSets || [];
    const template = current[current.length - 1] || {
      reps: exercise.repsRange?.[0] || 8,
      rir: exercise.rir ?? 2,
      weight: 0,
    };
    exercise.workSets = current.slice(0, target);
    while (exercise.workSets.length < target) exercise.workSets.push({ ...template });
  };
  const removable = (exercise: BBExercise): number => {
    // Разминочное упражнение не удаляется (не входит в рабочий бюджет).
    if ((exercise as any).warmupActivator) return -Infinity;
    // Мышца с повышенным MEV-флором (guard > базового minSets): её ПОСЛЕДНЕЕ
    // упражнение не удаляется — иначе план получает deficit (0 сетов мышцы).
    // Дубли удалять можно: стимул сохраняется, лимит сессии соблюдается.
    const floorRaised = floorFor(exercise.muscle) > minSets;
    const lastForMuscle = session.exercises.filter(e => e.muscle === exercise.muscle).length <= 1;
    if (floorRaised && lastForMuscle) return -Infinity;
    const cost = estimateBBExerciseCost(exercise);
    const finisher = exercise.character === 'памп' || exercise.repsRange?.[0] >= 15 ? 20 : 0;
    const accessory = exercise.role === 'accessory' ? 10 : 0;
    const isolation = catalogType(exercise) === 'isolation' ? 5 : 0;
    // Keep categorical priorities dominant while normalizing continuous costs
    // to comparable 0-10 ranges for deterministic ranking.
    const normalizedSystemic = Math.min(10, cost.systemic / 2);
    const normalizedTime = Math.min(10, cost.timeSeconds / 600 * 10);
    return finisher + accessory + isolation + normalizedSystemic + normalizedTime;
  };
  const reducible = (exercise: BBExercise): number => {
    if (exercise.role === 'primary' || exerciseSetCount(exercise) <= floorFor(exercise.muscle)) return -Infinity;
    const finisher = exercise.character === 'памп' || exercise.repsRange?.[0] >= 15 ? 20 : 0;
    const isolation = catalogType(exercise) === 'isolation' ? 10 : 0;
    return finisher + isolation + estimateBBExerciseCost(exercise).timeSeconds / 120;
  };
  while (session.exercises.length > 1) {
    const cost = estimateBBSessionCost(session);
    // Лимит упражнений/сетов считает только рабочие упражнения (без warmup).
    const workingCount = workingExercises().length;
    const workingSets = workingExercises().reduce((sum, ex) => sum + exerciseSetCount(ex), 0);
    if (workingCount <= maxExercises && workingSets <= maxWorkingSets && cost.timeSeconds <= maxTime && cost.axial <= maxAxial) break;
    const present = muscles();
    const setCandidates = session.exercises
      .map((exercise, index) => ({ exercise, index, score: reducible(exercise) }))
      .filter(item => Number.isFinite(item.score))
      .sort((a, b) => b.score - a.score);
    const setCandidate = workingSets > maxWorkingSets || workingCount <= maxExercises ? setCandidates[0] : undefined;
    if (setCandidate) {
      syncSets(setCandidate.exercise, exerciseSetCount(setCandidate.exercise) - 1);
      continue;
    }
    const candidates = session.exercises
      .map((exercise, index) => ({ exercise, index, score: removable(exercise) }))
      .filter(item => Number.isFinite(item.score))
      .filter(item => item.exercise.role !== 'primary')
      .filter(item => session.exercises.filter(ex => ex.muscle === item.exercise.muscle).length > 1 || present.size > 1)
      .sort((a, b) => b.score - a.score);
    const candidate = candidates[0];
    if (!candidate) break;
    removed.push(...session.exercises.splice(candidate.index, 1));
  }
    return { removed, cost: estimateBBSessionCost(session) };
}
