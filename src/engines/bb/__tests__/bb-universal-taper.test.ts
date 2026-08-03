import { describe, expect, it } from 'vitest';
import { finalizeBBPlan } from '../bb-finalize.engine';

const plan = (weeks: number) => ({
  pattern: {} as any, rotationMuscleVolume: {}, rationale: [],
  weeks: Array.from({ length: weeks }, (_, index) => ({
    week: index + 1, phase: index >= weeks - 2 ? 'peaking' : 'accumulation',
    sessions: [{ day: 1, weekOffset: index + 1, character: 'тяж' as const, sessionTag: 'Chest', exercises: [{
      muscle: 'chest', name: 'Жим лёжа', role: 'primary' as const, character: 'тяж' as const,
      sets: 4, repsRange: [6, 8] as [number, number], rir: 2,
      workSets: Array.from({ length: 4 }, () => ({ reps: 6, rir: 2, weight: 80 })),
    }] }],
  })),
});

describe('BB universal taper', () => {
  it('applies taper to a FullProgram/cycle-shaped output in the shared finalizer', () => {
    const result = finalizeBBPlan(plan(5) as any, { reorder: false, level: 'intermediate' });
    expect(result.weeks[3].sessions[0].exercises[0].sets).toBeLessThan(4);
    expect(result.weeks[4].sessions[0].exercises[0].sets).toBeLessThan(4);
    expect(result.weeks[4].sessions[0].exercises[0].workSets[0].weight).toBe(80);
    expect(result.weeks[4].sessions[0].exercises[0].workSets).toHaveLength(result.weeks[4].sessions[0].exercises[0].sets);
  });
});
