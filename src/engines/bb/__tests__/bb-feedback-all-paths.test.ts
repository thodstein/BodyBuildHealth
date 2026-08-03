import { describe, expect, it } from 'vitest';
import { applyFeedbackToBuild } from '../bb-progression-feedback.engine';
import { applyPostPhaseProcessing } from '../bb-autocoach.engine';

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

  it('keeps sets and workSets synchronized after autoregulation volume cut', () => {
    const plan: any = {
      pattern: {}, rationale: [], weeks: [{
        week: 1, phase: 'accumulation', sessions: [{ day: 1, exercises: [exercise('accumulation')] }],
      }],
    };
    const result = applyPostPhaseProcessing({
      plan, totalWeeks: 1, workMax: { chest: 120 }, skipPhaseRedistribution: true,
      autoRegResult: { volumeMultiplier: 0.5, topSetPctMultiplier: 0.95, rirShift: 1 },
    });
    const output = result.weeks[0].sessions[0].exercises[0];
    expect(output.sets).toBe(1);
    expect(output.workSets).toHaveLength(output.sets);
  });

  it('keeps sets and workSets synchronized after ACWR deload cut', () => {
    const source = exercise('deload');
    source.sets = 4;
    source.workSets = Array.from({ length: 4 }, () => ({ reps: 8, rir: 2, weight: 80 }));
    const plan: any = {
      pattern: {}, rationale: [], weeks: [{
        week: 1, phase: 'deload', deload: true,
        sessions: [{ day: 1, exercises: [source] }],
      }],
    };
    const result = applyPostPhaseProcessing({
      plan, totalWeeks: 1, workMax: { chest: 120 }, skipPhaseRedistribution: true,
      autoDeload: true, acwrRatio: 2, deloadType: 'full_rest',
    });
    const output = result.weeks[0].sessions[0].exercises[0];
    expect(output.workSets).toHaveLength(output.sets);
  });
});
