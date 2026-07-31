import { describe, expect, it } from 'vitest';
import { createFromBuild } from '../program-store';

describe('BB auto round-trip metadata', () => {
  it('preserves final volume, fatigue, validation and safety metadata', () => {
    const plan: any = {
      pattern: { name: 'Round-trip', sessionsPerRotation: 1 },
      weeks: [{ week: 1, phase: 'deload', deload: true, sessions: [{ day: 1, sessionTag: 'Chest', exercises: [{
        name: 'Жим лёжа', muscle: 'chest', role: 'primary', character: 'тяж', sets: 2,
        repsRange: [6, 8], rir: 2, workSets: [{ reps: 8, rir: 2, weight: 80 }, { reps: 8, rir: 2, weight: 80 }],
      }] }] }],
      volumeTargets: { chest: { muscle: 'chest', mev: 8, mav: 12, mrv: 16, targetSets: 10 } },
      weeklyVolume: { 1: { chest: { directSets: 2, effectiveSets: 2, fatigueWeightedSets: 2 } } },
      fatigueReport: [{ week: 1, sessions: [] }],
      rotationReport: { issues: [] },
      report: { validationValid: true },
      validation: { valid: true, issues: [] },
      safetyConstraints: { equipment: ['machine'], avoidAxialLoad: true, excludedExercises: ['deadlift'], excludedMuscles: ['back'] },
      rotationMuscleVolume: {}, rationale: [],
    };

    const program = createFromBuild(plan, { title: 'Round-trip', goal: 'hypertrophy', level: 'intermediate' });
    expect(program.bb?.derived?.weeklyVolume).toEqual(plan.weeklyVolume);
    expect(program.bb?.derived?.fatigueReport).toEqual(plan.fatigueReport);
    expect(program.bb?.derived?.validation).toEqual(plan.validation);
    expect(program.bb?.constraints.equipment).toEqual(['machine']);
    expect(program.bb?.constraints.avoidAxialLoad).toBe(true);
    expect(program.bb?.weeks[0].deload).toBe(true);
  });
});
