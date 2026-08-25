import type { BBPlan } from './bb-builder.engine';
import { derivePattern } from '../movement-pattern';
import { MUSCLE_LABEL_RU } from '../volume-landmarks.engine';

const PATTERN_RU: Record<string, string> = {
  vertical_pull: 'вертикальная тяга', horizontal_pull: 'горизонтальная тяга',
  horizontal_push: 'горизонтальный жим', vertical_push: 'вертикальный жим',
  squat: 'присед', hinge: 'шарнир', lunge: 'выпады',
  isolation_chest: 'изоляция груди', isolation_back: 'изоляция спины',
  isolation_shoulders: 'изоляция плеч', isolation_arms: 'изоляция рук',
  isolation_legs_quad: 'разгибание ног', isolation_legs_ham: 'сгибание ног',
  isolation_calves: 'икры', core: 'кор', glute_squat: 'ягодичный мост',
  anti_rotation: 'анти-ротация', carry: 'переноска', unknown: 'прочее', other: 'прочее',
};

function ruMuscle(m: string): string { return MUSCLE_LABEL_RU[m] || m; }
function ruPattern(p: string): string { return PATTERN_RU[p] || p; }

export interface BBRotationIssue {
  code: 'primary_changed' | 'accessory_repeated' | 'no_accessory_rotation';
  message: string;
  muscle: string;
  phase?: string;
}

export interface BBRotationReport {
  primaryByMuscle: Record<string, string[]>;
  accessoryPatternsByMuscle: Record<string, string[]>;
  issues: BBRotationIssue[];
}

/**
 * Проверяет недельную ротацию без изменения исходной программы.
 * Главные упражнения должны быть стабильными, вариативность относится к
 * вторичным движениям и изоляции. Faithful и adapt получают одинаковую
 * диагностику, но только вызывающий adapt-путь может использовать её для
 * последующей замены.
 */
export function analyzeBBRotation(plan: BBPlan): BBRotationReport {
  const primaryByMuscle: Record<string, string[]> = {};
  const accessoryPatternsByMuscle: Record<string, string[]> = {};
  const issues: BBRotationIssue[] = [];
  // Stability is measured inside a phase block. A deliberate phase boundary
  // may rotate the primary, but it must not change mid-block.
  const primaryNames = new Map<string, string>();
   const previousAccessories = new Map<string, string>();

  for (const week of plan.weeks) {
    for (const session of week.sessions) {
      for (const exercise of session.exercises) {
        const muscle = exercise.muscle;
        const phase = String((week as any).phase || 'accumulation').toLowerCase();
        const phaseMuscle = `${phase}|${muscle}`;
        const pattern = derivePattern(exercise);
        if (exercise.role === 'primary') {
          (primaryByMuscle[muscle] ||= []).push(exercise.name);
          const previous = primaryNames.get(phaseMuscle);
          if (previous && previous !== exercise.name) {
            issues.push({ code: 'primary_changed', muscle, phase, message: `${ruMuscle(muscle)}: основное движение сменилось внутри фазы «${phase}» — было «${previous}», стало «${exercise.name}». Держите базу стабильной внутри блока.` });
          } else if (!previous) {
            primaryNames.set(phaseMuscle, exercise.name);
          }
        } else {
          (accessoryPatternsByMuscle[muscle] ||= []).push(pattern);
           const previous = previousAccessories.get(phaseMuscle);
           if (previous === pattern && !issues.some(issue => issue.code === 'accessory_repeated' && issue.muscle === muscle && issue.phase === phase)) {
             issues.push({ code: 'accessory_repeated', muscle, phase, message: `${ruMuscle(muscle)}: паттерн изоляции «${ruPattern(pattern)}» повторяется подряд — добавьте ротацию (разный угол/хват).` });
          }
           previousAccessories.set(phaseMuscle, pattern);
        }
      }
    }
  }

  for (const [muscle, names] of Object.entries(accessoryPatternsByMuscle)) {
    if (names.length >= 3 && new Set(names).size === 1) {
      issues.push({ code: 'no_accessory_rotation', muscle, message: `${ruMuscle(muscle)}: нет ротации изоляции — один и тот же паттерн «${ruPattern(names[0])}» на протяжении всего плана. Меняйте угол/хват каждую неделю.` });
    }
  }
  return { primaryByMuscle, accessoryPatternsByMuscle, issues };
}
