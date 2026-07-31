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
import { applyTaperToFinalWeeks } from './bb-autocoach.engine';

const SMALL_MUSCLES = new Set(['biceps', 'triceps', 'forearms', 'calves', 'traps', 'abs', 'shoulders']);

function dedupeAdaptivePatterns(session: { exercises: any[] }, priorityMuscles: string[] = []): void {
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
    const pattern = derivePattern(item.exercise);
    const key = `${muscle}:${pattern}`;
    const cap = SMALL_MUSCLES.has(muscle) ? 1 : 2;
    const count = counts.get(key) || 0;
    if (count >= cap && item.exercise.role !== 'primary') continue;
    counts.set(key, count + 1);
    keep.add(item.exercise);
  }
  session.exercises = session.exercises.filter(exercise => keep.has(exercise));
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
    for (const muscle of muscles) {
      const landmarks = getVolumeLandmarks(options.level, muscle);
      const effectiveSets = weekVolume[muscle]?.effectiveSets || 0;
      if (!landmarks || effectiveSets >= landmarks.mev) continue;
      const session = week.sessions.find(item => item.exercises.some(exercise => (trueMuscleOf({ name: exercise.name, muscle: exercise.muscle } as any) || exercise.muscle) === muscle));
      if (!session || session.exercises.length >= 10) continue;
      let remaining = Math.max(0, landmarks.mev - effectiveSets);
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
          comment: `MEV feeder: ${sets}×15-20 для покрытия effective MEV ${landmarks.mev} сетов @${weight} кг.`,
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
    const equipmentOfName = (name: string): string => /гантел/.test(name.toLowerCase()) ? 'dumbbell' : /штанг/.test(name.toLowerCase()) ? 'barbell' : /тренаж|машин/.test(name.toLowerCase()) ? 'machine' : 'other';
    const ratio = (loadRatio[String(replacement.equipment)] || 1) / (loadRatio[equipmentOfName(oldName)] || 1);
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
        );
        dedupeAdaptivePatterns(session, options.priorityMuscles);
      }
      // Faithful сохраняет исходный набор и порядок, но safety-budget
      // обязателен для каждого режима и источника BB-auto.
      const fitted = options.preserveSource ? { removed: [], cost: estimateBBSessionCost(session) } : fitBBSessionToBudget(session, { maxExercises: 10, maxWorkingSets: 24 });
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
  const errors = validation.issues
    .filter(issue => issue.level === 'error')
    .slice(0, 20)
    .map(issue => `🚫 Валидация: ${issue.message}`);
  if (errors.length) next.rationale = [...next.rationale, ...errors];
  next.report = buildBBPlanReport(next);
  return next;
}
