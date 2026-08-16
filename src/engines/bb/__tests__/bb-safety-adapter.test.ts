import { describe, expect, it } from 'vitest';
import { applySafetyReportToBBPlan } from '../bb-safety-adapter.engine';
import type { BBPlan } from '../bb-builder.engine';
import type { TrainingSafetyReport } from '../../training-safety.types';

const plan = (): BBPlan => ({
  pattern: { id: 'test', name: 'Test', description: '', rotationDays: 1, schedule: ['Push'], sessionsPerRotation: 1 } as any,
  weeks: [{ week: 1, sessions: [{ day: 1, weekOffset: 0, character: 'тяж', exercises: [{ muscle: 'chest', name: 'Жим', role: 'primary', character: 'тяж', sets: 4, repsRange: [6, 8], rir: 2, workSets: Array.from({ length: 4 }, () => ({ reps: 6, rir: 2, weight: 100 })) }] }] }],
  rotationMuscleVolume: {}, rationale: [],
});

const report: TrainingSafetyReport = {
  score: 50, level: 'dangerous', factors: {}, issues: [], recommendations: [], generatedAt: 'test',
  exercises: [],
  adjustments: [{ kind: 'volume_multiplier', value: 0.7, reason: 'ACWR' }, { kind: 'rir_shift', value: 1, reason: 'ACWR' }],
};

describe('bb-safety-adapter', () => {
  it('applies volume/RIR to a clone without mutating the source', () => {
    const source = plan();
    const result = applySafetyReportToBBPlan(source, report);
    const exercise = result.plan.weeks[0].sessions[0].exercises[0];

    expect(result.applied).toBe(true);
    expect(exercise.sets).toBe(3);
    expect(exercise.rir).toBe(3);
    expect(exercise.workSets).toHaveLength(3);
    expect(exercise.workSets[0].rir).toBe(3);
    expect(source.weeks[0].sessions[0].exercises[0].sets).toBe(4);
    expect(source.weeks[0].sessions[0].exercises[0].rir).toBe(2);
  });

  it('is idempotent for the same overlay', () => {
    const first = applySafetyReportToBBPlan(plan(), report);
    const second = applySafetyReportToBBPlan(first.plan, report);

    expect(second.applied).toBe(false);
    expect(second.skipped).toContain('Эта корректировка уже применена');
  });
});
