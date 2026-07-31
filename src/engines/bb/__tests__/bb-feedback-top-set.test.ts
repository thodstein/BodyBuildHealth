import { describe, expect, it } from 'vitest';
import { applyFeedbackToBuild } from '../bb-progression-feedback.engine';

describe('BB feedback top-set selection', () => {
  it('tracks the heaviest set rather than volume proxy', () => {
    const plan: any = { pattern: {}, rationale: [], weeks: [
      { week: 1, phase: 'accumulation', sessions: [{ day: 1, exercises: [{ muscle: 'chest', name: 'Жим лёжа', role: 'primary', character: 'тяж', sets: 2, repsRange: [6, 8], rir: 2, workSets: [{ reps: 8, rir: 2, weight: 80 }, { reps: 8, rir: 2, weight: 80 }] }] }] },
      { week: 2, phase: 'intensification', sessions: [{ day: 1, exercises: [{ muscle: 'chest', name: 'Жим лёжа', role: 'primary', character: 'тяж', sets: 2, repsRange: [6, 8], rir: 2, workSets: [{ reps: 8, rir: 2, weight: 80 }, { reps: 8, rir: 2, weight: 80 }] }] }] },
    ] };
    const result = applyFeedbackToBuild(plan, [{ date: '2026-07-01', exercises: [{ exerciseName: 'Жим лёжа', muscleGroup: 'chest', sets: [{ weightKg: 90, reps: 3, rir: 2 }, { weightKg: 70, reps: 12, rir: 2 }] }] }] as any, { chest: 120 });
    expect(result.weeks[1].sessions[0].exercises[0].workSets[0].weight).toBeGreaterThan(80);
  });
});
