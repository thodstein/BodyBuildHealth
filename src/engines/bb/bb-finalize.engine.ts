import type { BBPlan } from './bb-builder.engine';
import { syncBBPlanSetShape, validateBBPlan } from './bb-validator.engine';
import { tidySessionExercises } from './bb-session-order.engine';
import { aggregateBBVolume, buildBBVolumeTarget, exerciseVolumeContributions } from './bb-volume.engine';
import { estimateBBSessionCost, fitBBSessionToBudget } from './bb-fatigue.engine';
import { analyzeBBRotation } from './bb-rotation.engine';
import { EXERCISE_CATALOG } from '../../core/exercise-catalog';
import { trueMuscleOf, derivePattern } from '../movement-pattern';
import { bbExerciseTier } from './bb-exercise-tier.engine';
import { isAxialLoadExercise } from '../exercise-selector.engine';
import { computeVolumeLandmarks, getVolumeLandmarks } from '../volume-landmarks.engine';
import { buildBBPlanReport } from './bb-report.engine';
import { analyzeBBBalance } from './bb-balance.engine';
import { applyTaperToFinalWeeks } from './bb-autocoach.engine';
import { annotateBackExercise, backQualityIssues, verticalPullProfile, classifyLegExercise } from './bb-back-quality.engine';

const SMALL_MUSCLES = new Set(['biceps', 'triceps', 'forearms', 'calves', 'traps', 'abs', 'shoulders']);

function dedupeAdaptivePatterns(session: { exercises: any[] }, priorityMuscles: string[] = [], optionsHighVolumeBack = false): void {
  const priority = new Set(priorityMuscles);
  const counts = new Map<string, number>();
  const ranked = session.exercises.map((exercise, index) => ({ exercise, index })).sort((a, b) => {
    const primary = (b.exercise.role === 'primary' ? 1 : 0) - (a.exercise.role === 'primary' ? 1 : 0);
    if (primary) return primary;
    const priorityDiff = (priority.has(a.exercise.muscle) ? 1 : 0) - (priority.has(b.exercise.muscle) ? 1 : 0);
    return priorityDiff || a.index - b.index;
  });
  const keep = new Set<any>();
  for (const item of ranked) {
    const muscle = item.exercise.muscle || '';
    const pattern = item.exercise.muscle === 'back'
      ? (annotateBackExercise(item.exercise).movementPattern || derivePattern(item.exercise))
      : derivePattern(item.exercise);
    const key = `${muscle}:${pattern}`;
    const highVolumeBack = muscle === 'back' && optionsHighVolumeBack;
    const cap = highVolumeBack
      ? (pattern === 'vertical_pull' ? 1 : pattern === 'heavy_row' ? 2 : 1)
      : (SMALL_MUSCLES.has(muscle) ? 1 : 2);
    const count = counts.get(key) || 0;
    // Back specialization is not a license for repeated primary rows. Keep
    // the pattern cap even for primary exercises; volume is distributed into
    // distinct patterns/sets instead of duplicating the same row every day.
    if (count >= cap && (item.exercise.role !== 'primary' || (optionsHighVolumeBack && muscle === 'back'))) continue;
    counts.set(key, count + 1);
    keep.add(item.exercise);
  }
  session.exercises = session.exercises.filter(exercise => keep.has(exercise));
}

/**
 * Финальная раскладка back-бюджета для experienced enhanced.
 * Нельзя оставлять вторую Upper/Pull-сессию с одним движением только из-за
 * freshness/rotation. Добавляются реальные упражнения из каталога, а не
 * переименованные копии; затем бюджет распределяется по ним.
 */
function allocateExperiencedBackSession(session: any, options: BBFinalizeOptions): void {
  if (options.preserveSource || options.level !== 'enhanced' || (options.trainingYears ?? 0) < 3) return;
  // FullBody уже планирует back штатно через buildSession; дополнительный
  // allocation здесь вытесняет ноги/руки/плечи из остальных FullBody-сессий.
  if (!/^(Upper|UpperPower|UpperHyp|Pull|Back|ChestBack|Torso)$/i.test(session.sessionTag || '')) return;

  let current: any[] = session.exercises.filter((e: any) => e.muscle === 'back');
  // В adapt библиотечная FullBody-программа может вообще не содержать back
  // после исходной фильтрации. Добавляем back-блок только в каждую вторую
  // подходящую сессию, чтобы не превратить FullBody в ежедневный Pull-день.
  if (!current.length) {
    if (session.day % 2 === 0) return;
    const seed = EXERCISE_CATALOG.find((x: any) => trueMuscleOf(x) === 'back' && /row|тяга/i.test(x.name));
    if (!seed) return;
    const wm = options.workMax?.back || 80;
    const base = {
      muscle: 'back', name: seed.name, exerciseName: seed.name, role: 'primary', character: 'тяж',
      sets: 4, repsRange: [8, 12], rir: 2, exerciseType: seed.type || 'compound', restSeconds: 150,
      workSets: Array.from({ length: 4 }, () => ({ reps: 10, rir: 2, weight: Math.round(wm * 0.65 * 10) / 10, restSeconds: 150 })),
      warmupSets: [], rationale: 'Experienced enhanced adapt: back budget allocation', comment: 'Адаптация: добавлен полноценный блок спины.',
    };
    session.exercises.push(base);
    current = [base];
  }
  const years = options.trainingYears ?? 0;
  // FullBody — не back-день: здесь спина не должна вытеснять ноги/руки/плечи.
  // В FullBody-сессии back-блок ограничен до 3 упражнений / 12 сетов.
  const isFullBody = /FullBody/i.test(session.sessionTag || '');
  const targetExercises = isFullBody ? 3 : (years >= 6 ? 6 : 5);
  const targetSets = isFullBody ? 12 : (years >= 6 ? 22 : 18);
  const usedNames = new Set(current.map(e => e.name));
  const usedPatterns = new Set(current.map(e => annotateBackExercise(e).movementPattern));
  const template = current[0];
  const allowed = (candidate: any) => {
    if (trueMuscleOf(candidate) !== 'back') return false;
    if (usedNames.has(candidate.name)) return false;
    if (options.avoidAxialLoad && isAxialLoadExercise(candidate)) return false;
    // Bodyweight capability: без подтверждённой способности подтягивания не
    // выбираются как primary — берём pulldown/машину вместо.
    if (/подтяг|pull.?up|chin/i.test(candidate.name || '')) {
      const cap = options.bodyweightCapability;
      const canPullUp = cap && ((cap.pullUpsStrict ?? 0) >= 5 || (cap.chinUpsStrict ?? 0) >= 5 || (cap.weightedPullUpLoad ?? 0) > 0);
      if (!canPullUp) return false;
    }
    if (options.equipment?.length) {
      const eq = Array.isArray(candidate.equipment) ? candidate.equipment : [String(candidate.equipment || '')];
      if (eq.length && !eq.some((x: string) => options.equipment!.includes(x))) return false;
    }
    return true;
  };

  // Приоритет: закрыть разные функциональные классы, а не набрать ещё один
  // верхний блок. Каталог остаётся источником реального названия упражнения.
  const wanted = ['heavy_row', 'supported_row', 'vertical_pull', 'unilateral_row', 'lat_isolation', 'upper_back'];
  for (const wantedPattern of wanted) {
    if (current.length >= targetExercises) break;
    if (usedPatterns.has(wantedPattern)) continue;
    const candidate = EXERCISE_CATALOG.find((x: any) => allowed(x) && annotateBackExercise({ ...template, name: x.name } as any).movementPattern === wantedPattern);
    if (!candidate) continue;
    const tagged: any = annotateBackExercise({ ...template, name: candidate.name } as any);
    const added: any = structuredClone(template);
    added.name = candidate.name;
    added.exerciseName = candidate.name;
    added.movementPattern = tagged.movementPattern;
    added.backSubgroup = tagged.backSubgroup;
    added.role = 'primary';
    added.sets = Math.max(3, Math.min(5, template.sets || 4));
    const sample = template.workSets?.[template.workSets.length - 1] || { reps: 10, rir: 2, weight: 0 };
    added.workSets = Array.from({ length: added.sets }, () => ({ ...sample }));
    session.exercises.push(added);
    current.push(added);
    usedNames.add(candidate.name);
    usedPatterns.add(wantedPattern);
  }

  // Если каталог не дал все классы, увеличиваем рабочие подходы в уже
  // выбранных реальных движениях до profile target.
  let total = current.reduce((sum, e) => sum + (e.sets || 0), 0);
  for (const exercise of current) {
    while (total < targetSets && exercise.sets < 8) {
      const sample = exercise.workSets?.[exercise.workSets.length - 1] || { reps: 10, rir: 2, weight: 0 };
      exercise.sets += 1;
      exercise.workSets.push({ ...sample });
      total += 1;
    }
    if (total >= targetSets) break;
  }
}

/** Гарантирует direct arm-блок после indirect overlap и поздних cap-pass. */
function allocateExperiencedArmSession(session: any, options: BBFinalizeOptions): void {
  if (options.preserveSource || options.level !== 'enhanced' || (options.trainingYears ?? 0) < 3) return;
  const tag = session.sessionTag || '';
  const targetMuscle = /Pull|Back|Upper|Arms/.test(tag) ? 'biceps' : /Push|Chest|Upper|Arms/.test(tag) ? 'triceps' : '';
  if (!targetMuscle) return;
  const existing = session.exercises.filter((e: any) => e.muscle === targetMuscle);
  const targetSets = (options.trainingYears ?? 0) >= 6 ? 6 : 5;
  let total = existing.reduce((sum: number, e: any) => sum + (e.sets || 0), 0);
  // В Upper одновременно доступны оба бюджета; в Pull/Push — соответствующий.
  if (total < targetSets && existing.length) {
    const exercise = existing[0];
    while (total < targetSets && exercise.sets < 8) {
      const sample = exercise.workSets?.[exercise.workSets.length - 1] || { reps: 10, rir: 2, weight: 0 };
      exercise.sets += 1;
      exercise.workSets.push({ ...sample });
      total += 1;
    }
  }
  if (total >= targetSets) return;
  const candidates = EXERCISE_CATALOG.filter((candidate: any) => {
    if (trueMuscleOf(candidate) !== targetMuscle) return false;
    if (options.excludedExercises?.includes(candidate.id) || options.excludedExercises?.includes(candidate.name)) return false;
    if (options.equipment?.length) {
      const eq = Array.isArray(candidate.equipment) ? candidate.equipment : [String(candidate.equipment || '')];
      if (eq.length && !eq.some((e: string) => options.equipment!.includes(e))) return false;
    }
    return true;
  });
  const candidate = candidates.find((e: any) => !session.exercises.some((x: any) => x.name === e.name));
  if (!candidate) return;
  const baseWeight = options.workMax?.[targetMuscle] || 40;
  const sets = targetSets - total;
  session.exercises.push({
    muscle: targetMuscle,
    name: candidate.name,
    exerciseName: candidate.name,
    role: 'accessory',
    character: 'памп',
    sets,
    repsRange: [10, 15],
    rir: 3,
    workSets: Array.from({ length: sets }, () => ({ reps: 12, rir: 3, weight: Math.round(baseWeight * 0.35 * 10) / 10, restSeconds: 75 })),
    restSeconds: 75,
    warmupSets: [],
    rationale: `Experienced enhanced: ${targetMuscle} direct residual volume after indirect overlap`,
  });
}

function allocateExperiencedLegSession(session: any, options: BBFinalizeOptions): void {
  if (options.preserveSource || options.level !== 'enhanced' || (options.trainingYears ?? 0) < 3) return;
  if (!/Legs|Lower|LowerPower|LowerHyp/.test(session.sessionTag || '')) return;
  const legAllocationEnabled = options.level === 'enhanced' && (options.trainingYears ?? 0) >= 3;
  if (!legAllocationEnabled) return;
  const targets: Record<string, number> = (options.trainingYears ?? 0) >= 6
    ? { quads: 16, hamstrings: 16, glutes: 12 }
    : { quads: 12, hamstrings: 12, glutes: 10 };
  for (const [muscle, target] of Object.entries(targets)) {
    // allocation is intentionally post-budget; no shared fatigue cap here
    let items: any[] = session.exercises.filter((e: any) => e.muscle === muscle);
    if (!items.length) {
      const candidate = EXERCISE_CATALOG.find((x: any) => trueMuscleOf(x) === muscle && !options.excludedExercises?.includes(x.id) && !options.excludedExercises?.includes(x.name));
      if (!candidate) continue;
      const added: any = {
        muscle, name: candidate.name, exerciseName: candidate.name, role: 'accessory', character: 'памп',
        sets: 4, repsRange: [10, 15], rir: 3, restSeconds: 75, warmupSets: [],
        workSets: Array.from({ length: 4 }, () => ({ reps: 12, rir: 3, weight: 0, restSeconds: 75 })),
        rationale: `Experienced enhanced: ${muscle} direct leg allocation`,
      };
      session.exercises.push(added);
      items = [added];
    }
    let total = items.reduce((n, e) => n + (e.sets || 0), 0);
    for (const e of items) {
      while (total < target && e.sets < 8) {
        const sample = e.workSets?.[e.workSets.length - 1] || { reps: 10, rir: 2, weight: 0 };
        e.sets += 1; e.workSets.push({ ...sample }); total += 1;
      }
      if (total >= target) break;
    }
    if (total >= target) continue;
    const used = new Set(items.map(e => e.name));
    const usedPatterns = new Set(items.map((e: any) => classifyLegExercise(e.name).pattern));
    for (const candidate of EXERCISE_CATALOG) {
      if (total >= target || trueMuscleOf(candidate) !== muscle || used.has(candidate.name)) continue;
      // Не дублируем функциональный паттерн: два hip thrust в одну тренировку
      // для glutes — это ошибка (нужен hip thrust + kickback/abduction).
      const candidatePattern = classifyLegExercise(candidate.name).pattern;
      if (usedPatterns.has(candidatePattern)) continue;
      const base: any = items[0];
      const added: any = structuredClone(base);
      added.name = candidate.name; added.exerciseName = candidate.name; added.role = 'accessory';
      added.sets = Math.min(4, target - total);
      const sample = base.workSets?.[0] || { reps: 10, rir: 2, weight: 0 };
      added.workSets = Array.from({ length: added.sets }, () => ({ ...sample }));
      session.exercises.push(added); items.push(added); used.add(candidate.name); usedPatterns.add(candidatePattern); total += added.sets;
    }
  }
}

/** Гарантирует в Push/Chest-дне грудь с разными углами, а не 4 одинаковых жима.
 *  Также не допускает rear delt в Push-днях (rear delt — Pull-работа). */
function diversifyExperiencedChestSession(session: any, options: BBFinalizeOptions): void {
  if (options.preserveSource || options.level !== 'enhanced' || (options.trainingYears ?? 0) < 3) return;
  if (!/^(Push|Chest|ChestBack|Upper|UpperPower|UpperHyp|Torso)$/i.test(session.sessionTag || '')) return;
  const rearDelt = session.exercises.find((e: any) => e.muscle === 'shoulders' && /обратн|rear|задн.*дельт|задн.*пуч/i.test(e.name));
  if (rearDelt) {
    const lateral = EXERCISE_CATALOG.find((x: any) => {
      if (trueMuscleOf(x) !== 'shoulders') return false;
      if (!/мах|lateral|raise|отведен|разведен/i.test(x.name)) return false;
      if (/наклон|задн|rear|обратн/i.test(x.name)) return false;
      if (session.exercises.some((e: any) => e.name === x.name)) return false;
      return true;
    });
    if (lateral) {
      const sample = rearDelt.workSets?.[0] || { reps: 12, rir: 3, weight: 0 };
      rearDelt.name = lateral.name;
      rearDelt.exerciseName = lateral.name;
      rearDelt.workSets = rearDelt.workSets.map((set: any) => ({ ...set }));
      rearDelt.rationale = `${rearDelt.rationale || ''} Адаптация: rear delt заменена на lateral raise в Push-дне.`;
    }
  }
  const chest = session.exercises.filter((e: any) => e.muscle === 'chest');
  if (chest.length < 3) return;
  const isPress = (name: string) => /жим|press|брус|dip|отжим/i.test(name);
  const presses = chest.filter((e: any) => isPress(e.name));
  const fly = chest.find((e: any) => /развод|fly|crossover|кроссовер|сведен|пек.?дек|бабоч|сведение/i.test(e.name));
  // >3 жимов без fly/cable — заменяем последний жим на изоляцию.
  if (presses.length > 3 && !fly) {
    const candidate = EXERCISE_CATALOG.find((x: any) => {
      if (trueMuscleOf(x) !== 'chest') return false;
      if (!/развод|fly|crossover|кроссовер|сведен|пек.?дек|бабоч|сведение/i.test(x.name)) return false;
      if (session.exercises.some((e: any) => e.name === x.name)) return false;
      if (options.excludedExercises?.includes(x.id) || options.excludedExercises?.includes(x.name)) return false;
      return true;
    });
    if (candidate) {
      const target = presses[presses.length - 1];
      const base: any = target;
      const sample = base.workSets?.[0] || { reps: 12, rir: 3, weight: 0 };
      const added: any = structuredClone(base);
      added.name = candidate.name;
      added.exerciseName = candidate.name;
      added.role = 'accessory';
      added.character = 'памп';
      added.sets = 3;
      added.repsRange = [12, 18];
      added.rir = 3;
      added.workSets = Array.from({ length: 3 }, () => ({ ...sample, reps: 15, rir: 3 }));
      added.rationale = 'Experienced enhanced: chest fly/cable diversity вместо 4-го жима';
      session.exercises.splice(session.exercises.indexOf(target), 1, added);
    }
  }
}

/** Гарантирует rear delt работу в Pull-дне (задняя дельта — тяговая мышца). */
function ensureRearDeltInPull(session: any, options: BBFinalizeOptions): void {
  if (options.preserveSource || options.level !== 'enhanced' || (options.trainingYears ?? 0) < 3) return;
  if (!/^(Pull|Back|Upper|UpperPower|UpperHyp|Torso)$/i.test(session.sessionTag || '')) return;
  const hasRear = session.exercises.some((e: any) => e.muscle === 'shoulders' && /обратн|rear|задн.*дельт|задн.*пуч|лиц.*тяга|face.?pull/i.test(e.name));
  if (hasRear) return;
  const candidate = EXERCISE_CATALOG.find((x: any) => {
    if (trueMuscleOf(x) !== 'shoulders') return false;
    if (!/обратн|rear|задн.*дельт|задн.*пуч|лиц.*тяга|face.?pull/i.test(x.name)) return false;
    if (session.exercises.some((e: any) => e.name === x.name)) return false;
    if (options.excludedExercises?.includes(x.id) || options.excludedExercises?.includes(x.name)) return false;
    return true;
  });
  if (!candidate) return;
  const baseWeight = options.workMax?.shoulders || 60;
  session.exercises.push({
    muscle: 'shoulders',
    name: candidate.name,
    exerciseName: candidate.name,
    role: 'accessory',
    character: 'памп',
    sets: 3,
    repsRange: [12, 18],
    rir: 3,
    workSets: Array.from({ length: 3 }, () => ({ reps: 15, rir: 3, weight: Math.round(baseWeight * 0.35 * 10) / 10, restSeconds: 60 })),
    restSeconds: 60,
    warmupSets: [],
    rationale: 'Experienced enhanced: rear delt (Pull-работа)',
  });
}

/** Маппинг целевой группы сессии → разминочное лёгкое изолирующее движение. */
const WARMUP_ACTIVATOR: Record<string, RegExp> = {
  back: /пуловер.*(блок|канат|cable)|тяга.*прям.*рук|straight.?arm/i,
  chest: /сведен.*(кроссовер|блок)|кроссовер|crossover|сведен.*тренаж/i,
  quads: /разгибан.*ног|leg.?extension/i,
  hamstrings: /сгибан.*ног|leg.?curl/i,
  glutes: /отведен.*бедр|abduction|kick.?back|ягодичн.*отвед/i,
  calves: /подъём.*носк|подъем.*носк|calf.?raise/i,
  shoulders: /мах|raise|lateral|отведен.*рук/i,
  biceps: /сгибан.*(блок|кабель|cable)|сгибан.*рук.*блок/i,
  triceps: /разгибан.*блок|pushdown/i,
  abs: /скручиван|crunch/i,
  forearms: /сгибан.*запяст|wrist.?curl/i,
};

/** Разминочное упражнение на целевую группу: 3×10-15 лёгких повторений (~25% workMax).
 *  Добавляется в начало сессии ПОСЛЕ всех проходов, чтобы его не удалил budget/dedupe.
 *  Не входит в объём (warmupActivator отсекается в bb-volume). */
function addWarmupActivator(session: any, options: BBFinalizeOptions): void {
  if (options.preserveSource) return;
  if (session.exercises.some((e: any) => e.warmupActivator)) return;
  const lead = WARMUP_LEAD[session.sessionTag || ''] || session.exercises.find((e: any) => e.role === 'primary')?.muscle;
  const pattern = WARMUP_ACTIVATOR[lead];
  if (!pattern) return;
  const candidate = EXERCISE_CATALOG.find((x: any) => {
    const tm = trueMuscleOf(x);
    if (tm === null || tm !== lead) return false;
    if (!pattern.test(x.name || '')) return false;
    // Уважаем equipment-ограничения пользователя.
    if (options.equipment?.length) {
      const eq = Array.isArray(x.equipment) ? x.equipment : [String(x.equipment || '')];
      if (eq.length > 0 && !eq.some((e: string) => options.equipment!.includes(e))) return false;
    }
    if (options.excludedExercises?.includes(x.id) || options.excludedExercises?.includes(x.name)) return false;
    return true;
  });
  if (!candidate) return;
  const base = options.workMax?.[lead] || 50;
  const weight = Math.max(5, Math.round(base * 0.25 * 10) / 10);
  session.exercises.unshift({
    muscle: lead,
    name: candidate.name,
    exerciseName: candidate.name,
    role: 'accessory',
    character: 'памп',
    sets: 3,
    repsRange: [10, 15],
    rir: 4,
    workSets: Array.from({ length: 3 }, () => ({ reps: 12, rir: 4, weight, tempo: '3-0-1-0', restSeconds: 45 })),
    tempoSpec: '3-0-1-0',
    restSeconds: 45,
    warmupActivator: true,
    warmupSets: [],
    comment: `🌡 Разминка целевой группы ${lead}: ${candidate.name}, 3×12 @ ${weight} кг RIR 4 — активация перед рабочими подходами (не входит в объём).`,
    rationale: 'Warmup activator: лёгкая активация целевой мышцы перед основным объёмом',
  });
}

/** Целевая группа дня (по sessionTag). */
const WARMUP_LEAD: Record<string, string> = {
  Chest: 'chest', Back: 'back', Shoulders: 'shoulders', Arms: 'biceps',
  Push: 'chest', Pull: 'back', ChestBack: 'chest', ShouldersArms: 'shoulders',
  Upper: 'chest', UpperPower: 'chest', UpperHyp: 'chest',
  Torso: 'chest', Legs: 'quads', Lower: 'quads', LowerPower: 'quads', LowerHyp: 'quads',
  Glutes: 'glutes', GlutesHams: 'glutes', LegsBiceps: 'quads', Limbs: 'quads',
};

/**
 * Weekly back-pattern repair for adaptive/generic plans.
 * Volume specialization must not mean repeating pull-ups/vertical pulls in
 * every session. Keep a limited number of vertical slots and replace excess
 * slots with real catalog rows/lat work, preserving the prescribed sets.
 */
function repairBackFrequency(week: any, options: BBFinalizeOptions): void {
  if (options.preserveSource) return;
  const backSessionCount = week.sessions.filter((session: any) => session.exercises.some((e: any) => e.muscle === 'back')).length;
  const keptProfiles = new Set<string>();
  let verticalSessionsSeen = 0;
  const sessions = [...week.sessions].sort((a: any, b: any) => a.day - b.day);
  for (const session of sessions) {
    let sessionHasKeptVertical = false;
    for (const exercise of session.exercises) {
      if (exercise.muscle !== 'back') continue;
      const tagged = annotateBackExercise(exercise);
      if (tagged.movementPattern !== 'vertical_pull') continue;
      const profile = verticalPullProfile(exercise.name) || 'cable_vertical';
      // Один профиль — максимум одна сессия. Вторая встреча того же профиля
      // (pullup в 2-й и 3-й FullBody-сессиях) заменяется на другой профиль
      // или row/lat работу, чтобы специализация не превращалась в ежедневные
      // одинаковые подтягивания.
      const shouldKeep = !sessionHasKeptVertical && !keptProfiles.has(profile);
      if (shouldKeep) {
        sessionHasKeptVertical = true;
        keptProfiles.add(profile);
        verticalSessionsSeen += 1;
        continue;
      }
      // Сначала ищем другой вертикальный профиль (wide ↔ hammer/neutral ↔
      // underhand). Хорошая вертикальная тяга не должна исчезать только
      // потому, что она вертикальная.
      const capAllowed = (candidate: any) => {
        if (!/подтяг|pull.?up|chin/i.test(candidate.name || '')) return true;
        const cap = options.bodyweightCapability;
        return !!(cap && ((cap.pullUpsStrict ?? 0) >= 5 || (cap.chinUpsStrict ?? 0) >= 5 || (cap.weightedPullUpLoad ?? 0) > 0));
      };
      const replacement = EXERCISE_CATALOG.find((candidate: any) => {
        if (trueMuscleOf(candidate) !== 'back') return false;
        if (!capAllowed(candidate)) return false;
        if (isAxialLoadExercise(candidate) && options.avoidAxialLoad) return false;
        if (options.excludedExercises?.includes(candidate.id) || options.excludedExercises?.includes(candidate.name)) return false;
        const next = annotateBackExercise({ ...exercise, name: candidate.name, exerciseName: candidate.name } as any);
        if (next.movementPattern !== 'vertical_pull') return false;
        const candidateProfile = verticalPullProfile(candidate.name);
        return candidateProfile !== null && candidateProfile !== profile && !keptProfiles.has(candidateProfile);
      }) || EXERCISE_CATALOG.find((candidate: any) => {
        if (trueMuscleOf(candidate) !== 'back') return false;
        if (!capAllowed(candidate)) return false;
        if (isAxialLoadExercise(candidate) && options.avoidAxialLoad) return false;
        if (options.excludedExercises?.includes(candidate.id) || options.excludedExercises?.includes(candidate.name)) return false;
        const next = annotateBackExercise({ ...exercise, name: candidate.name, exerciseName: candidate.name } as any);
        return next.movementPattern !== 'vertical_pull';
      });
      if (!replacement) continue;
      const next = annotateBackExercise({ ...exercise, name: replacement.name, exerciseName: replacement.name } as any);
      exercise.name = replacement.name;
      exercise.exerciseName = replacement.name;
      exercise.movementPattern = next.movementPattern;
      exercise.backSubgroup = next.backSubgroup;
      exercise.rationale = `${exercise.rationale || ''} Адаптация частоты: избыток vertical pull заменён на ${next.movementPattern}.`;
      const replacedProfile = verticalPullProfile(replacement.name);
      if (replacedProfile) keptProfiles.add(replacedProfile);
    }
  }
}

/** Ограничивает specialization/weak-point additions по частоте. */
function capAdaptiveSpecializationFrequency(week: any, options: BBFinalizeOptions): void {
  if (options.preserveSource || !options.priorityMuscles?.length) return;
  const priorities = new Set(options.priorityMuscles.map(m => String(m)));
  const maxSessions = options.level === 'enhanced' && (options.trainingYears ?? 0) >= 3 ? 3 : 2;
  const sessionsByMuscle = new Map<string, any[]>();
  for (const session of week.sessions) {
    for (const exercise of session.exercises) {
      const marked = /Weak pump-finisher|Фидер-сет|Auto-MEV-feeder|specialization|специализац|отстающ/i.test(`${exercise.comment || ''} ${exercise.rationale || ''}`);
      if (!marked || !priorities.has(exercise.muscle)) continue;
      const list = sessionsByMuscle.get(exercise.muscle) || [];
      if (!list.includes(session)) list.push(session);
      sessionsByMuscle.set(exercise.muscle, list);
    }
  }
  for (const [muscle, sessions] of sessionsByMuscle) {
    if (sessions.length <= maxSessions) continue;
    for (const session of sessions.slice(maxSessions)) {
      session.exercises = session.exercises.filter((exercise: any) => {
        const marked = /Weak pump-finisher|Фидер-сет|Auto-MEV-feeder|specialization|специализац|отстающ/i.test(`${exercise.comment || ''} ${exercise.rationale || ''}`);
        return !(marked && exercise.muscle === muscle);
      });
    }
  }
}



export interface BBFinalizeOptions {
  reorder?: boolean;
  methodology?: 'compound_first' | 'pre_exhaust' | 'post_exhaust';
  priorityMuscles?: string[];
  level?: string;
  volumeGoal?: 'mev' | 'mav' | 'mrv';
  phaseSafety?: boolean;
  controlledRotation?: boolean;
  equipment?: string[];
  excludedExercises?: string[];
  avoidAxialLoad?: boolean;
  excludedMuscles?: string[];
  ensureMinimumVolume?: boolean;
  workMax?: Record<string, number>;
  mrvMultiplier?: number;
  checkOrder?: boolean;
  preserveSource?: boolean;
  /** Высокообъёмный профиль: лимит всей сессии, а не одной мышцы. */
  maxWorkingSets?: number;
  maxExercises?: number;
  trainingYears?: number;
  /** Способность к bodyweight-упражнениям — фильтр подтягиваний при allocation. */
  bodyweightCapability?: {
    pullUpsStrict?: number;
    chinUpsStrict?: number;
    dipsStrict?: number;
    pushUpsStrict?: number;
    weightedPullUpLoad?: number;
    assistedPullUpLoad?: number;
  };
}

function addAdaptiveMEVFeeders(plan: BBPlan, options: BBFinalizeOptions): void {
  if (!options.level) return;
  const excluded = new Set(options.excludedExercises || []);
  const excludedMuscles = new Set(options.excludedMuscles || []);
  const equipment = options.equipment || [];
  const candidates = EXERCISE_CATALOG.filter(candidate => {
    if (candidate.type !== 'isolation' && (candidate as any).exerciseType !== 'isolation' || bbExerciseTier(candidate) > 2) return false;
    if (excluded.has(candidate.id) || excluded.has(candidate.name)) return false;
    if (excludedMuscles.has(candidate.group) || excludedMuscles.has(trueMuscleOf(candidate) || '')) return false;
    if (options.avoidAxialLoad && isAxialLoadExercise(candidate as any)) return false;
    if (equipment.length > 0) {
      const candidateEquipment = Array.isArray(candidate.equipment) ? candidate.equipment : [String(candidate.equipment || '')];
      if (candidateEquipment.length > 0 && !candidateEquipment.some(item => equipment.includes(item))) return false;
    }
    return trueMuscleOf(candidate) !== null;
  });
  const muscles = [...new Set(candidates.map(candidate => trueMuscleOf(candidate) || ''))].filter(Boolean);
  for (const week of plan.weeks) {
    const phase = String((week as any).phase || '').toLowerCase();
    if (phase === 'deload' || week.sessions.some(session => session.exercises.some(exercise => /разгруз|deload/i.test(exercise.comment || '')))) continue;
    const weekVolume = aggregateBBVolume(week.sessions);
    // Prioritize muscles by target-volume deficit (target vs effective), not just MEV.
    const deficitByMuscle = muscles.map((muscle: string) => {
      const landmarks = getVolumeLandmarks(options.level!, muscle);
      const effectiveSets = weekVolume[muscle]?.effectiveSets || 0;
      const target = plan.volumeTargets?.[muscle];
      const targetSets = target?.targetSets ?? landmarks?.mav ?? 0;
      const mev = landmarks?.mev ?? 0;
      const deficit = Math.max(0, targetSets - effectiveSets);
      const mevDeficit = Math.max(0, mev - effectiveSets);
      return { muscle, landmarks, effectiveSets, target, targetSets, deficit, mevDeficit };
    }).filter(item => item.landmarks && item.mevDeficit > 0)
      .sort((a, b) => b.deficit - a.deficit || b.mevDeficit - a.mevDeficit);

    for (const { muscle, landmarks, effectiveSets, target } of deficitByMuscle) {
      if (!landmarks || effectiveSets >= landmarks.mev) continue;
      const session = week.sessions.find(item => item.exercises.some(exercise => (trueMuscleOf({ name: exercise.name, muscle: exercise.muscle } as any) || exercise.muscle) === muscle));
      if (!session || session.exercises.length >= 10) continue;
      // Feeder volume is capped by MEV deficit, not full target deficit,
      // to avoid overloading the session with isolation feeders.
      let remaining = Math.max(0, landmarks.mev - effectiveSets);
      const sessionVolume = aggregateBBVolume([session])[muscle]?.directSets || 0;
      const maxSetsPerSession = target?.maxSetsPerSession ?? Math.max(2, Math.ceil(landmarks.mrv / Math.max(1, target?.frequency || 1)));
      remaining = Math.min(remaining, Math.max(0, maxSetsPerSession - sessionVolume));
      if (remaining <= 0) continue;
      const used = new Set(session.exercises.map(exercise => exercise.name));
      const baseWeight = options.workMax?.[muscle] || 50;
      const weight = Math.max(5, Math.round(baseWeight * 0.3 * 10) / 10);
      for (const candidate of candidates.filter(item => trueMuscleOf(item) === muscle && !used.has(item.name))) {
        if (remaining <= 0 || session.exercises.length >= 10) break;
        const sets = Math.min(2, Math.ceil(remaining));
        const workSets = Array.from({ length: sets }, () => ({ reps: 15, rir: 3, weight, tempo: '3-0-1-0', restSeconds: 45 }));
        session.exercises.push({
          muscle, name: candidate.name, exerciseName: candidate.name, role: 'accessory', character: 'памп', sets,
          repsRange: [12, 20], rir: 3, workSets, tempoSpec: '3-0-1-0', restSeconds: 45,
          comment: `MEV feeder: ${sets}×15-20 для покрытия effective MEV ${landmarks.mev} сетов @${weight} кг; session cap ${maxSetsPerSession}. Target deficit: ${target ? target.targetSets - effectiveSets : 0} sets.`,
          rationale: 'Adaptive MEV coverage feeder', warmupSets: [],
        });
        used.add(candidate.name);
        remaining -= sets;
      }
    }
  }
}

function applyControlledAccessoryRotation(plan: BBPlan, options: Pick<BBFinalizeOptions, 'equipment' | 'excludedExercises' | 'avoidAxialLoad' | 'excludedMuscles'> = {}): void {
  const optionsEquipment = options.equipment || [];
  const excluded = new Set(options.excludedExercises || []);
  const excludedMuscles = new Set(options.excludedMuscles || []);
  const usedNames = new Set<string>();
  const previousPatternByMuscle = new Map<string, string>();
  for (const week of plan.weeks) {
    const phase = String((week as any).phase || '').toLowerCase();
    for (const session of week.sessions) {
      for (const exercise of session.exercises) {
        if (exercise.role === 'primary') continue;
        const pattern = derivePattern(exercise);
        const previousPattern = previousPatternByMuscle.get(exercise.muscle);
        if (previousPattern && previousPattern === pattern) {
          const equipmentOf = (name: string): string => {
            const value = name.toLowerCase();
            if (/кроссовер|блок|кабел|трос/.test(value)) return 'cable';
            if (/гантел/.test(value)) return 'dumbbell';
            if (/штанг/.test(value)) return 'barbell';
            if (/тренажёр|тренажер|машин/.test(value)) return 'machine';
            return 'other';
          };
          const phaseEquipment = phase === 'accumulation'
            ? ['machine', 'cable', 'dumbbell']
            : phase === 'deload'
              ? ['machine', 'cable', 'bodyweight']
              : ['barbell', 'smith', 'machine', 'dumbbell'];
          const replacementScore = (candidate: typeof EXERCISE_CATALOG[number]): number => {
            const eq = String(candidate.equipment || '').toLowerCase();
            const phaseIndex = phaseEquipment.findIndex(preferred => eq.includes(preferred));
            const sameEquipment = eq === equipmentOf(exercise.name) ? 1 : 0;
            const canonical = bbExerciseTier(candidate) === 1 ? 2 : 0;
            const phaseBonus = phaseIndex < 0 ? 0 : (phaseEquipment.length - phaseIndex) * 3;
            return phaseBonus + sameEquipment + canonical;
          };
          const replacement = EXERCISE_CATALOG
            .filter(candidate => {
            if (excluded.has(candidate.id) || excluded.has(candidate.name)) return false;
            if (excludedMuscles.has(candidate.group) || excludedMuscles.has(trueMuscleOf(candidate) || '')) return false;
            if (options.avoidAxialLoad && isAxialLoadExercise(candidate as any)) return false;
            if (usedNames.has(candidate.name) || bbExerciseTier(candidate) > 2) return false;
            if (trueMuscleOf(candidate) !== exercise.muscle) return false;
            if (optionsEquipment.length > 0) {
              const candidateEquipment = Array.isArray(candidate.equipment) ? candidate.equipment : [String(candidate.equipment || '')];
              if (candidateEquipment.length > 0 && !candidateEquipment.some(item => optionsEquipment.includes(item))) return false;
            }
            if (derivePattern(candidate) === pattern && equipmentOf(candidate.name) === equipmentOf(exercise.name)) return false;
            return candidate.type === 'isolation' || (exercise as any).type === 'compound' || (exercise as any).exerciseType === 'compound';
            })
            .sort((a, b) => replacementScore(b) - replacementScore(a))[0];
          if (replacement) {
            const oldName = exercise.name;
            const oldEquipment = equipmentOf(oldName);
            const newEquipment = equipmentOf(replacement.name);
            const equipmentLoadRatio: Record<string, number> = {
              barbell: 1,
              smith: 0.9,
              dumbbell: 0.8,
              machine: 0.85,
              cable: 0.8,
              bodyweight: 0.7,
              other: 1,
            };
            const oldRatio = equipmentLoadRatio[oldEquipment] || 1;
            const newRatio = equipmentLoadRatio[newEquipment] || 1;
            const loadRatio = newRatio / oldRatio;
            exercise.name = replacement.name;
            exercise.exerciseName = replacement.name;
            exercise.workSets = (exercise.workSets || []).map(set => ({
              ...set,
              weight: Math.round(set.weight * loadRatio * 10) / 10,
            }));
            exercise.comment = [exercise.comment, `Оборудование ротации: ${oldEquipment} → ${newEquipment}; вес скорректирован ×${loadRatio.toFixed(2)}`].filter(Boolean).join('. ');
            exercise.rationale = [exercise.rationale, `Controlled rotation: ${oldName} -> ${replacement.name}`].filter(Boolean).join(' | ');
            usedNames.add(replacement.name);
            previousPatternByMuscle.set(exercise.muscle, derivePattern(replacement));
            continue;
          }
        }
        previousPatternByMuscle.set(exercise.muscle, pattern);
        usedNames.add(exercise.name);
      }
    }
  }
}

function repairAdaptiveSafety(plan: BBPlan, options: BBFinalizeOptions): void {
  const equipment = options.equipment || [];
  const excludedExercises = new Set(options.excludedExercises || []);
  const excludedMuscles = new Set(options.excludedMuscles || []);
  for (const week of plan.weeks) for (const session of week.sessions) for (const exercise of session.exercises) {
    const equipmentAllowed = (candidate: typeof EXERCISE_CATALOG[number]) => {
      if (!candidate || !candidate.name) return false;
      const raw = Array.isArray(candidate.equipment) ? candidate.equipment : [String(candidate.equipment || '')];
      return !equipment.length || raw.length === 0 || raw.some(item => equipment.includes(item));
    };
    const catalogExercise = EXERCISE_CATALOG.find(item => item.name === exercise.name || item.id === exercise.exerciseName);
    const unknownWithEquipmentRestriction = equipment.length > 0 && !catalogExercise;
    const unsafe = excludedExercises.has(exercise.name) || excludedExercises.has(exercise.exerciseName || '') || excludedMuscles.has(exercise.muscle) || (options.avoidAxialLoad && isAxialLoadExercise({ name: exercise.name, id: exercise.exerciseName } as any)) || unknownWithEquipmentRestriction || !equipmentAllowed(catalogExercise as any);
    if (excludedMuscles.has(exercise.muscle)) continue;
    if (!unsafe) continue;
    const replacement = EXERCISE_CATALOG
      .filter(candidate => bbExerciseTier(candidate) <= 2 && trueMuscleOf(candidate) === exercise.muscle && !excludedExercises.has(candidate.id) && !excludedExercises.has(candidate.name) && !excludedMuscles.has(candidate.group) && !isAxialLoadExercise(candidate as any) && equipmentAllowed(candidate))
      .sort((a, b) => (exercise.role === 'primary' ? (bbExerciseTier(a) - bbExerciseTier(b)) : ((a.type === 'isolation' ? 0 : 1) - (b.type === 'isolation' ? 0 : 1))))[0];
    if (!replacement) continue;
    const oldName = exercise.name;
    exercise.name = replacement.name;
    exercise.exerciseName = replacement.name;
    const loadRatio: Record<string, number> = { barbell: 1, smith: 0.9, machine: 0.85, dumbbell: 0.8, cable: 0.8, bodyweight: 0.7 };
    const equipmentOfName = (name: string): string => {
      const value = name.toLowerCase();
      if (/гантел|dumbbell/.test(value)) return 'dumbbell';
      if (/штанг|barbell|гриф/.test(value)) return 'barbell';
      if (/тренаж|машин|smith|смит/.test(value)) return 'machine';
      if (/блок|кроссовер|кабел|трос|cable/.test(value)) return 'cable';
      if (/свой вес|собственн|bodyweight|подтяг|отжим/.test(value)) return 'bodyweight';
      return 'other';
    };
    const replacementEquipment = Array.isArray(replacement.equipment)
      ? replacement.equipment.find(item => loadRatio[String(item)] != null)
      : replacement.equipment;
    const ratio = (loadRatio[String(replacementEquipment)] || 1) / (loadRatio[equipmentOfName(oldName)] || 1);
    exercise.workSets = exercise.workSets.map(set => ({ ...set, weight: Math.round(set.weight * ratio * 10) / 10 }));
    exercise.comment = [exercise.comment, `Safety repair: ${oldName} → ${replacement.name}; вес скорректирован ×${ratio.toFixed(2)}`].filter(Boolean).join('. ');
    exercise.rationale = [exercise.rationale, 'Adaptive safety replacement'].filter(Boolean).join(' | ');
  }
}

function applyAdaptivePhaseSafety(plan: BBPlan): void {
  for (let index = 1; index < plan.weeks.length; index++) {
    const week = plan.weeks[index];
    const weekPhase = String((week as any).phase || '').toLowerCase();
    const isDeloadWeek = Boolean((week as any).deload) || weekPhase === 'deload' || weekPhase === 'transition';
    if (!isDeloadWeek && !week.sessions.some(session => session.exercises.some(exercise => exercise.character === 'лёг' || /разгруз|deload/i.test(exercise.comment || '')))) continue;
    const previous = plan.weeks[index - 1];
    for (const session of week.sessions) {
      for (const exercise of session.exercises) {
        const previousExercise = previous.sessions.flatMap(item => item.exercises).find(item => item.name === exercise.name && item.muscle === exercise.muscle);
        const previousSets = previousExercise?.sets ?? exercise.sets;
        const targetSets = Math.max(1, Math.ceil(previousSets * 0.6));
        if (exercise.sets > targetSets) exercise.sets = targetSets;
        exercise.rir = Math.max(3, exercise.rir ?? 2);
        exercise.workSets = (exercise.workSets || []).slice(0, exercise.sets).map(set => ({ ...set, rir: Math.max(3, set.rir ?? 2) }));
      }
    }
  }
}

function enrichExerciseRationale(plan: BBPlan): void {
  for (const week of plan.weeks) for (const session of week.sessions) for (const [index, exercise] of session.exercises.entries()) {
    const contributions = exerciseVolumeContributions(exercise);
    const direct = contributions.find(item => item.source === 'direct');
    const indirect = contributions.filter(item => item.source === 'indirect').map(item => `${item.muscle} +${item.effectiveSets.toFixed(1)}`).join(', ');
    const tags = [exercise.role === 'primary' ? 'primary' : 'accessory', `direct ${direct?.directSets ?? exercise.sets} sets`];
    if (indirect) tags.push(`effective overlap: ${indirect}`);
    if ((exercise as any).substituted) tags.push(`замена: ${(exercise as any).originalName || 'исходное упражнение'}`);
    const position = index === 0 ? 'primary/lead' : exercise.role === 'primary' ? 'secondary compound' : exercise.character === 'памп' ? 'pump finisher' : 'accessory';
    exercise.rationale = [exercise.rationale, tags.join('; '), `final position: ${position} (#${index + 1})`].filter(Boolean).join(' | ');
  }
}

/**
 * Общий последний проход для generic, проф-циклов и библиотечных программ.
 * Не меняет объём и не добавляет упражнения: только приводит форму результата
 * к единому BBPlan-контракту и восстанавливает тренерский порядок там, где
 * выбран adapt-путь.
 */
export function finalizeBBPlan(plan: BBPlan, options: BBFinalizeOptions = {}): BBPlan {
  options = {
    ...options,
    equipment: options.equipment ?? plan.safetyConstraints?.equipment,
    excludedExercises: options.excludedExercises ?? plan.safetyConstraints?.excludedExercises,
    excludedMuscles: options.excludedMuscles ?? plan.safetyConstraints?.excludedMuscles,
    avoidAxialLoad: options.avoidAxialLoad ?? plan.safetyConstraints?.avoidAxialLoad,
  };
  const next: BBPlan = {
    ...plan,
    safetyConstraints: {
      ...plan.safetyConstraints,
      ...(options.equipment !== undefined ? { equipment: options.equipment } : {}),
      ...(options.excludedExercises !== undefined ? { excludedExercises: options.excludedExercises } : {}),
      ...(options.excludedMuscles !== undefined ? { excludedMuscles: options.excludedMuscles } : {}),
      ...(options.avoidAxialLoad !== undefined ? { avoidAxialLoad: options.avoidAxialLoad } : {}),
    },
    weeks: plan.weeks.map(week => ({
      ...week,
      sessions: week.sessions.map(session => ({ ...session, exercises: [...session.exercises] })),
    })),
  };
  for (const week of next.weeks) for (const session of week.sessions) {
    session.exercises = session.exercises.map(ex => ex.muscle === 'back' ? annotateBackExercise(ex) : ex);
  }
  syncBBPlanSetShape(next);
  // Final hard invariant for adaptive high-volume leg sessions. This is kept
  // after every other pass so fatigue/rotation cannot silently turn a major
  // leg group into one 3-4 set exercise.
  if (!options.preserveSource && options.level === 'enhanced' && (options.trainingYears ?? 0) >= 3) {
    for (const week of next.weeks) for (const session of week.sessions) {
      if (!/Legs|Lower|LowerPower|LowerHyp/.test(session.sessionTag || '')) continue;
      const target = (options.trainingYears ?? 0) >= 6 ? 12 : 10;
      for (const muscle of ['quads', 'hamstrings', 'glutes']) {
        const items = session.exercises.filter((e: any) => e.muscle === muscle);
        if (!items.length) continue;
        let total = items.reduce((n: number, e: any) => n + e.sets, 0);
        for (const e of items) {
          while (total < target && e.sets < 8) {
            const sample = e.workSets?.[e.workSets.length - 1] || { reps: 10, rir: 2, weight: 0 };
            e.sets += 1; e.workSets.push({ ...sample }); total += 1;
          }
          if (total >= target) break;
        }
        if (total < target) {
          const used = new Set(items.map((e: any) => e.name));
          const candidate = EXERCISE_CATALOG.find((x: any) => trueMuscleOf(x) === muscle && !used.has(x.name));
          if (candidate) {
            const base: any = items[0];
            const added: any = structuredClone(base);
            added.name = candidate.name;
            added.exerciseName = candidate.name;
            added.role = 'accessory';
            added.sets = Math.min(4, target - total);
            const sample = base.workSets?.[0] || { reps: 10, rir: 2, weight: 0 };
            added.workSets = Array.from({ length: added.sets }, () => ({ ...sample }));
            session.exercises.push(added);
          }
        }
      }
    }
  }
  syncBBPlanSetShape(next);
  if (!options.preserveSource && options.phaseSafety) applyAdaptivePhaseSafety(next);
  if (!options.preserveSource && options.reorder !== false) repairAdaptiveSafety(next, options);
  if (!options.preserveSource && options.ensureMinimumVolume) addAdaptiveMEVFeeders(next, options);
  if (!options.preserveSource && options.controlledRotation) applyControlledAccessoryRotation(next, options);
  for (const week of next.weeks) {
    for (const session of week.sessions) {
      if (!options.preserveSource && options.reorder !== false) {
        session.exercises = tidySessionExercises(
          session.exercises,
          undefined,
          session.sessionTag,
          options.priorityMuscles,
          options.methodology,
        );
        dedupeAdaptivePatterns(session, options.priorityMuscles, options.level === 'enhanced' && (options.trainingYears ?? 0) >= 3);
      }
      // Faithful сохраняет исходный набор и порядок, но safety-budget
      // обязателен для каждого режима и источника BB-auto.
      const fitted = options.preserveSource ? { removed: [], cost: estimateBBSessionCost(session) } : fitBBSessionToBudget(session, {
        maxExercises: options.maxExercises ?? 10,
        maxWorkingSets: options.maxWorkingSets ?? 24,
      });
      if (fitted.removed.length > 0) {
        next.rationale.push(`Fatigue budget: ${session.sessionTag || `день ${session.day}`} — удалено ${fitted.removed.length} вторичных упражнений, расчётная длительность ${Math.round(fitted.cost.timeSeconds / 60)} мин.`);
      }
    }
  }
  syncBBPlanSetShape(next);
  // Taper is a source-independent final phase pass. It is deliberately here
  // rather than in the generic builder so cycle/program outputs get it too.
  if (!options.preserveSource) {
    const tapered = applyTaperToFinalWeeks(next, next.weeks.length);
    next.weeks = tapered.weeks;
    syncBBPlanSetShape(next);
  }
  // Последний back allocation после rotation/fatigue/taper: именно здесь
  // проверяем фактические финальные сеты, а не промежуточный план.
  for (const week of next.weeks) for (const session of week.sessions) {
    allocateExperiencedBackSession(session, options);
    allocateExperiencedArmSession(session, options);
    allocateExperiencedLegSession(session, options);
    diversifyExperiencedChestSession(session, options);
    ensureRearDeltInPull(session, options);
  }
  // FullBody/Lower: после всех проходов добираем отсутствующие группы
  // (fbUsedIds может вытеснить мышцы между FullBody-сессиями).
  if (!options.preserveSource && options.level === 'enhanced' && (options.trainingYears ?? 0) >= 3) {
    for (const week of next.weeks) for (const session of week.sessions) {
      const tag = session.sessionTag || '';
      if (!/Legs|Lower|LowerPower|LowerHyp/.test(tag) && !/FullBody/.test(tag)) continue;
      const present = new Set(session.exercises.map((e: any) => e.muscle));
      const template = session.exercises[0];
      if (!template) continue;
      const needMuscles = /FullBody/.test(tag)
        ? ['chest', 'back', 'quads', 'hamstrings', 'glutes', 'shoulders', 'biceps', 'triceps', 'calves', 'forearms', 'abs']
        : ['glutes', 'quads', 'hamstrings'];
      for (const muscle of needMuscles) {
        if (present.has(muscle)) continue;
        const candidate = EXERCISE_CATALOG.find((x: any) => {
          if (trueMuscleOf(x) !== muscle) return false;
          if (options.avoidAxialLoad && isAxialLoadExercise(x)) return false;
          if (options.equipment?.length) {
            const eq = Array.isArray(x.equipment) ? x.equipment : [String(x.equipment || '')];
            if (eq.length && !eq.some((e: string) => options.equipment!.includes(e))) return false;
          }
          return true;
        });
        if (!candidate) continue;
        const added: any = structuredClone(template);
        added.muscle = muscle;
        added.name = candidate.name;
        added.exerciseName = candidate.name;
        added.role = 'accessory';
        added.sets = /FullBody/.test(tag) ? 3 : 4;
        const sample = template.workSets?.[0] || { reps: 10, rir: 2, weight: 0 };
        added.workSets = Array.from({ length: added.sets }, () => ({ ...sample }));
        session.exercises.push(added);
        present.add(muscle);
      }
    }
  }
  // Последний adaptive-проход: после дозаполнения и всех поздних проходов
  // ремонтируем weekly back frequency (повтор одного vertical профиля).
  for (const week of next.weeks) repairBackFrequency(week, options);
  for (const week of next.weeks) capAdaptiveSpecializationFrequency(week, options);
  syncBBPlanSetShape(next);
  if (options.level) {
    const peakWeek = next.weeks.reduce((best, week) => {
      const total = week.sessions.reduce((sum, session) => sum + session.exercises.reduce((s, exercise) => s + exercise.sets, 0), 0);
      return total > best.total ? { total, week } : best;
    }, { total: -1, week: next.weeks[0] });
    const peakSessions = peakWeek.week?.sessions || [];
    const peakVolume = aggregateBBVolume(peakSessions);
    const frequency: Record<string, number> = {};
    for (const week of next.weeks) for (const session of week.sessions) {
      const seen = new Set(session.exercises.map(exercise => exercise.muscle));
      for (const muscle of seen) frequency[muscle] = (frequency[muscle] || 0) + 1 / Math.max(1, next.weeks.length);
    }
    const targets: NonNullable<BBPlan['volumeTargets']> = {};
    for (const [muscle, volume] of Object.entries(peakVolume)) {
      const landmarks = getVolumeLandmarks(options.level, muscle);
      if (!landmarks) continue;
      targets[muscle] = buildBBVolumeTarget({
        muscle,
        frequency: Math.max(1, Math.round(frequency[muscle] || 1)),
        landmarks,
        rotationSets: Math.round(volume.directSets),
        volumeGoal: options.volumeGoal || 'mav',
      });
    }
    next.volumeTargets = targets;
  }
  enrichExerciseRationale(next);
  // FIX-B3: autoAssignIntensityTechniques — автоматическое назначение
  // техник интенсивности (dropset/rest_pause/myo_rep) для ≥intermediate.
  // Проф-тренер назначает: cable fly → dropset, leg extension → myo_rep,
  // curl → rest_pause. Без этого 0% планов имеют intensity techniques.
  if (!options.preserveSource) {
    autoAssignIntensityTechniques(next, options.level || 'intermediate');
  }
  const rotation = analyzeBBRotation(next);
  next.rotationReport = rotation;
  const rotationWarnings = rotation.issues
    .filter(issue => issue.code !== 'primary_changed' || options.reorder === false)
    .slice(0, 20)
    .map(issue => `⚠ Ротация: ${issue.message}`);
  if (rotationWarnings.length) next.rationale = [...next.rationale, ...rotationWarnings];
  const validation = validateBBPlan(next, {
    level: options.level,
    equipment: options.equipment,
    excludedExercises: options.excludedExercises,
    excludedMuscles: options.excludedMuscles,
    avoidAxialLoad: options.avoidAxialLoad,
    checkOrder: options.checkOrder,
    methodology: options.methodology,
  });
  next.validation = validation;
  next.fatigueReport = next.weeks.map(week => ({
    week: week.week,
    sessions: week.sessions.map(session => estimateBBSessionCost(session)),
  }));
    next.weeklyVolume = Object.fromEntries(next.weeks.map(week => [
    week.week,
    aggregateBBVolume(week.sessions),
  ]));
  if (options.level && next.weeks.length > 0) {
    const peak = next.weeks.reduce((best, week) => {
      const total = week.sessions.reduce((sum, session) => sum + session.exercises.reduce((s, exercise) => s + exercise.sets, 0), 0);
      return total > best.total ? { total, week } : best;
    }, { total: -1, week: next.weeks[0] }).week;
    const directPeak: Record<string, number> = {};
    for (const session of peak.sessions) for (const exercise of session.exercises) {
      directPeak[exercise.muscle] = (directPeak[exercise.muscle] || 0) + exercise.sets;
    }
    next.volumeLandmarks = computeVolumeLandmarks(directPeak, options.level, { labMult: options.mrvMultiplier, peakWeek: peak.week });
  }
  const warnings = validation.issues
    .filter(issue => issue.level === 'warning')
    .slice(0, 20)
    .map(issue => `⚠ Валидация: ${issue.message}`);
  if (warnings.length) next.rationale = [...next.rationale, ...warnings];
  // Пересчитываем функциональную разметку спины после всех поздних проходов
  // (rotation/dedupe/taper/fill могут клонировать упражнения без полей).
  for (const week of next.weeks) for (const session of week.sessions) {
    session.exercises = session.exercises.map(ex => ex.muscle === 'back' ? annotateBackExercise(ex) : ex);
  }
  const backQuality = next.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises.filter(e => e.muscle === 'back')).reduce((acc, e) => {
    const pattern = e.movementPattern || 'other';
    acc[pattern] = (acc[pattern] || 0) + e.sets;
    return acc;
  }, {} as Record<string, number>);
  next.rationale.push(`🧩 Спина по паттернам: ${Object.entries(backQuality).map(([k, v]) => `${k}=${v}`).join(', ') || 'нет прямой работы'}`);
  next.rationale.push(...backQualityIssues(next.weeks).map(issue => `⚠ Качество спины: ${issue}`));
  const errors = validation.issues
    .filter(issue => issue.level === 'error')
    .slice(0, 20)
    .map(issue => `🚫 Валидация: ${issue.message}`);
  if (errors.length) next.rationale = [...next.rationale, ...errors];
  // Разминочное упражнение на целевую группу — в самом конце, после всех
  // проходов (budget/dedupe/taper не могут его удалить). Не входит в объём.
  // Только для реальных генераторных планов (pattern.id задан) и не-faithful.
  if (!options.preserveSource && (next as any).pattern?.id) {
    for (const week of next.weeks) for (const session of week.sessions) {
      addWarmupActivator(session, options);
    }
  }
  syncBBPlanSetShape(next);
  next.balanceReport = analyzeBBBalance(next);
  next.report = buildBBPlanReport(next);
  return next;
}

/**
 * FIX-B3: autoAssignIntensityTechniques — автоматическое назначение
 * техник интенсивности для упражнений в памп-днях (≥intermediate).
 *
 * Проф-тренер назначает intensity techniques не всем упражнениям, а выборочно:
 *  - Cable fly / сведение → dropset (метаболический стресс)
 *  - Leg extension / разгибание ног → myo_rep (высокая эффективность изоляции)
 *  - Curl / сгибание на бицепс → rest_pause (добивка до отказа)
 *  - Triceps pushdown / разгибание на блоке → dropset
 *  - Lateral raise / махи → rest_pause
 *
 * Только для level >= intermediate. Только для accessory/памп упражнений.
 * Не более 1 техники на упражнение, не более 2-3 на сессию.
 */
function autoAssignIntensityTechniques(plan: BBPlan, level: string): void {
  if (level === 'beginner') return; // новички не используют intensity techniques
  for (const week of plan.weeks) {
    if (week.phase === 'deload') continue; // deload — без intensity techniques
    for (const session of week.sessions) {
      let techniquesInSession = 0;
      const maxPerSession = level === 'enhanced' ? 3 : level === 'advanced' ? 3 : 2;
      for (const ex of session.exercises) {
        if (techniquesInSession >= maxPerSession) break;
        // Только accessory/памп упражнения получают intensity technique
        if (ex.role !== 'accessory') continue;
        if (ex.character !== 'памп') continue;
        // Не перезаписывать если уже есть technique
        if (ex.workSets?.some(ws => ws.technique)) continue;
        const name = (ex.exerciseName || ex.name || '').toLowerCase();
        let technique: string | undefined;
        // Cable fly / сведение → dropset
        if (/кроссовер|crossover|сведение|fly|пек.?дек|бабоч/i.test(name)) {
          technique = 'dropset';
        }
        // Leg extension → myo_rep
        else if (/разгибан.*ног|leg.?extension/i.test(name)) {
          technique = 'myo_rep';
        }
        // Biceps curl → rest_pause
        else if (/сгибан.*бицепс|curl|подъём.*бицепс|подъем.*бицепс/i.test(name) && !/молот|hammer/i.test(name)) {
          technique = 'rest_pause';
        }
        // Triceps pushdown → dropset
        else if (/разгибан.*рук|разгибан.*блок|pushdown|трицепс.*блок/i.test(name)) {
          technique = 'dropset';
        }
        // Lateral raise → rest_pause
        else if (/махи|lateral.?raise|отведен.*рук/i.test(name)) {
          technique = 'rest_pause';
        }
        // Leg curl → dropset
        else if (/сгибан.*ног|leg.?curl/i.test(name)) {
          technique = 'dropset';
        }
        if (technique && ex.workSets && ex.workSets.length > 0) {
          // Назначить технику на последний сет
          const lastSet = ex.workSets[ex.workSets.length - 1];
          lastSet.technique = technique;
          techniquesInSession++;
          // Добавить комментарий
          const techNames: Record<string, string> = {
            dropset: 'Дроп-сет', rest_pause: 'Rest-pause', myo_rep: 'Myo-reps',
          };
          ex.comment = (ex.comment || '') + ` | 💥 ${techNames[technique] || technique} на последнем подходе.`;
        }
      }
    }
  }
}
