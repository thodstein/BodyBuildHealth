import { describe, expect, it } from 'vitest';
import { applyFeedbackToBuild } from '../bb-progression-feedback.engine';

const exercise = (phase?: string) => ({
  muscle: 'chest', name: 'Жим лёжа', role: 'primary' as const, character: 'тяж' as const,
  sets: 2, repsRange: [6, 8] as [number, number], rir: 2,
  workSets: [{ reps: 8, rir: 2, weight: 80 }, { reps: 8, rir: 2, weight: 80 }],
  phase,
});

describe('BB feedback across adaptive sources', () => {
  it('applies fact-driven progression to adapt-shaped plans and preserves deload', () => {
    const plan: any = {
      pattern: {}, rationale: [], weeks: [
        { week: 1, phase: 'accumulation', sessions: [{ day: 1, exercises: [exercise('accumulation')] }] },
        { week: 2, phase: 'intensification', sessions: [{ day: 1, exercises: [exercise('intensification')] }] },
        { week: 3, phase: 'deload', deload: true, sessions: [{ day: 1, exercises: [exercise('deload')] }] },
      ],
    };
    const sessions: any[] = [{ date: '2026-07-01', exercises: [{ exerciseName: 'Жим лёжа', muscleGroup: 'chest', sets: [{ weight: 90, reps: 8, rir: 1 }] }] }];
    const result = applyFeedbackToBuild(plan, sessions, { chest: 120 }, 'double_progression');
    expect(result.weeks[1].sessions[0].exercises[0].workSets[0].weight).not.toBe(80);
    expect(result.weeks[2].sessions[0].exercises[0].workSets[0].weight).toBe(80);
  });
});
