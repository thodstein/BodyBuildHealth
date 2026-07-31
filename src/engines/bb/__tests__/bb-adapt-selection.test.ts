import { describe, expect, it } from 'vitest';
import { finalizeBBPlan } from '../bb-finalize.engine';

const makeExercise = (name: string, muscle: string, role: 'primary' | 'accessory' = 'accessory') => ({
  muscle, name, role, character: 'тяж' as const, sets: 2,
  repsRange: [8, 10] as [number, number], rir: 2,
  workSets: [{ reps: 8, rir: 2, weight: 50 }, { reps: 8, rir: 2, weight: 50 }],
});

describe('BB adaptive exercise selection final pass', () => {
  it('caps redundant muscle exercise spam in adapt outputs', () => {
    const exercises = [
      makeExercise('Шраг со штангой', 'traps', 'primary'),
      makeExercise('Шраг с гантелями', 'traps'),
      makeExercise('Шраги на блоке', 'traps'),
      makeExercise('Шраг в тренажёре', 'traps'),
    ];
    const plan: any = {
      pattern: {}, weeks: [{ week: 1, sessions: [{ day: 1, weekOffset: 1, character: 'тяж', sessionTag: 'Back', exercises }] }],
      rotationMuscleVolume: {}, rationale: [],
    };
    const result = finalizeBBPlan(plan, { reorder: true, level: 'intermediate' });
    expect(result.weeks[0].sessions[0].exercises.length).toBeLessThanOrEqual(2);
    expect(result.weeks[0].sessions[0].exercises.some(ex => ex.role === 'primary')).toBe(true);
  });

  it('does not rewrite faithful exercise selection', () => {
    const exercises = [
      makeExercise('Шраг со штангой', 'traps'),
      makeExercise('Шраг с гантелями', 'traps'),
      makeExercise('Шраги на блоке', 'traps'),
    ];
    const plan: any = {
      pattern: {}, weeks: [{ week: 1, sessions: [{ day: 1, weekOffset: 1, character: 'тяж', sessionTag: 'Back', exercises }] }],
      rotationMuscleVolume: {}, rationale: [],
    };
    const result = finalizeBBPlan(plan, { reorder: false, level: 'intermediate' });
    expect(result.weeks[0].sessions[0].exercises).toHaveLength(3);
  });
});
