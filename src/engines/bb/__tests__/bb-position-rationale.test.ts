import { describe, expect, it } from 'vitest';
import { finalizeBBPlan } from '../bb-finalize.engine';

describe('BB final position rationale', () => {
  it('stores final order rationale after all shared passes', () => {
    const plan: any = {
      pattern: {}, rationale: [], rotationMuscleVolume: {}, weeks: [{ week: 1, sessions: [{
        day: 1, weekOffset: 1, sessionTag: 'Chest', character: 'тяж', exercises: [
          { muscle: 'chest', name: 'Жим лёжа', role: 'primary', character: 'тяж', sets: 2, repsRange: [6, 8], rir: 2, workSets: [{ reps: 8, rir: 2, weight: 80 }, { reps: 8, rir: 2, weight: 80 }] },
          { muscle: 'chest', name: 'Разводка гантелей лёжа', role: 'accessory', character: 'памп', sets: 2, repsRange: [12, 15], rir: 3, workSets: [{ reps: 12, rir: 3, weight: 15 }, { reps: 12, rir: 3, weight: 15 }] },
        ],
      }] }],
    };
    const result = finalizeBBPlan(plan, { reorder: true, level: 'intermediate' });
    expect(result.weeks[0].sessions[0].exercises[0].rationale).toContain('final position: primary/lead (#1)');
    expect(result.weeks[0].sessions[0].exercises[1].rationale).toContain('final position: pump finisher (#2)');
  });
});
