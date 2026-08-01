import type { BBPlan } from './bb-builder.engine';
import { derivePattern } from '../movement-pattern';

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
            issues.push({ code: 'primary_changed', muscle, phase, message: `${muscle}: primary lift changed within ${phase} from «${previous}» to «${exercise.name}».` });
          } else if (!previous) {
            primaryNames.set(phaseMuscle, exercise.name);
          }
        } else {
          (accessoryPatternsByMuscle[muscle] ||= []).push(pattern);
          const previous = previousAccessories.get(muscle);
          if (previous === pattern && !issues.some(issue => issue.code === 'accessory_repeated' && issue.muscle === muscle)) {
             issues.push({ code: 'accessory_repeated', muscle, phase, message: `${muscle}: accessory pattern «${pattern}» повторяется последовательно.` });
          }
          previousAccessories.set(muscle, pattern);
        }
      }
    }
  }

  for (const [muscle, names] of Object.entries(accessoryPatternsByMuscle)) {
    if (names.length >= 3 && new Set(names).size === 1) {
      issues.push({ code: 'no_accessory_rotation', muscle, message: `${muscle}: нет ротации accessory pattern на протяжении плана.` });
    }
  }
  return { primaryByMuscle, accessoryPatternsByMuscle, issues };
}
