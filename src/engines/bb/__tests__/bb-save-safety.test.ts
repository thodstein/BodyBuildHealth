import { describe, expect, it } from 'vitest';
import { validateBBPlan } from '../bb-validator.engine';

describe('BB save/export safety contract', () => {
  it('marks unsafe plans invalid before save/export', () => {
    const plan: any = { pattern: {}, safetyConstraints: { equipment: ['machine'] }, weeks: [{ week: 1, sessions: [{ day: 1, weekOffset: 1, character: 'тяж', exercises: [{ muscle: 'chest', name: 'Жим штанги лёжа', role: 'primary', character: 'тяж', sets: 2, repsRange: [6, 8], rir: 2, workSets: [{ reps: 8, rir: 2, weight: 80 }, { reps: 8, rir: 2, weight: 80 }] }] }] }], rotationMuscleVolume: {}, rationale: [] };
    expect(validateBBPlan(plan, plan.safetyConstraints).valid).toBe(false);
  });
});
