import { describe, expect, it } from 'vitest';
import { finalizeBBPlan } from '../bb-finalize.engine';

describe('BB faithful exact mode', () => {
  it('does not apply taper, budget, rotation, feeders or phase rewrite', () => {
    const plan: any = {
      pattern: {}, rationale: [],
      weeks: Array.from({ length: 5 }, (_, i) => ({ week: i + 1, phase: i === 4 ? 'peaking' : 'accumulation', sessions: [{ day: 1, sessionTag: 'Chest', exercises: [{ muscle: 'chest', name: 'Разводка', role: 'accessory', character: 'памп', sets: 5, repsRange: [15, 20], rir: 2, workSets: Array.from({ length: 5 }, () => ({ reps: 15, rir: 2, weight: 20 })) }] }] })),
      rotationMuscleVolume: {},
    };
    const result = finalizeBBPlan(plan, { preserveSource: true, reorder: false, phaseSafety: true, ensureMinimumVolume: true, controlledRotation: true, level: 'intermediate' });
    expect(result.weeks.map(week => week.sessions[0].exercises[0].sets)).toEqual([5, 5, 5, 5, 5]);
    expect(result.weeks[0].sessions[0].exercises).toHaveLength(1);
    expect(result.weeks[0].sessions[0].exercises[0].rationale).toContain('final position:');
  });
});
