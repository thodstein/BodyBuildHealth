import { describe, expect, it } from 'vitest';
import { finalizeBBPlan } from '../bb-finalize.engine';

describe('BB rationale export parity', () => {
  it('keeps final position rationale in the export-safe plan snapshot', () => {
    const result = finalizeBBPlan({ pattern: {} as any, rationale: [], rotationMuscleVolume: {}, weeks: [{ week: 1, sessions: [{ day: 1, sessionTag: 'Chest', character: 'тяж', exercises: [{ muscle: 'chest', name: 'Жим лёжа', role: 'primary', character: 'тяж', sets: 2, repsRange: [6, 8], rir: 2, workSets: [{ reps: 8, rir: 2, weight: 80 }, { reps: 8, rir: 2, weight: 80 }] }] }] }] } as any, { reorder: true, level: 'intermediate' });
    expect(result.weeks[0].sessions[0].exercises[0].rationale).toContain('final position:');
  });
});
