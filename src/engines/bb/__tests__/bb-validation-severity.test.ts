import { describe, expect, it } from 'vitest';
import { validateBBPlan } from '../bb-validator.engine';

const makePlan = (exercise: any) => ({
  pattern: {} as any,
  rationale: [],
  weeks: [{ week: 1, sessions: [{ day: 1, weekOffset: 1, sessionTag: 'Chest', character: 'тяж', exercises: [exercise] }] }],
  rotationMuscleVolume: {},
});

describe('BB validation severity contract', () => {
  it('keeps safety violations blocking and volume diagnostics non-blocking', () => {
    const exercise = { muscle: 'chest', name: 'Жим штанги лёжа', role: 'primary', character: 'тяж', sets: 2, repsRange: [6, 8], rir: 2, workSets: [{ reps: 8, rir: 2, weight: 80 }, { reps: 8, rir: 2, weight: 80 }] };
    const unsafe = validateBBPlan(makePlan(exercise) as any, { equipment: ['machine'] });
    expect(unsafe.valid).toBe(false);
    expect(unsafe.issues.find(issue => issue.code === 'equipment_restriction_violation')?.level).toBe('error');

    const diagnostic = validateBBPlan({ ...makePlan(exercise), volumeTargets: { chest: { muscle: 'chest', frequency: 2, mev: 8, mav: 12, mrv: 16, targetSets: 10, minSetsPerSession: 2, maxSetsPerSession: 4, rationale: [] } }, weeklyVolume: { 1: { chest: { directSets: 2, effectiveSets: 2, fatigueWeightedSets: 2 } } } } as any, { level: 'intermediate' });
    expect(diagnostic.valid).toBe(true);
    expect(diagnostic.issues.find(issue => issue.code === 'target_volume_deficit')?.level).toBe('warning');
  });
});
