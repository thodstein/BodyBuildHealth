import { describe, expect, it } from 'vitest';
import { validateBBPlan } from '../bb-validator.engine';

const exercise = (name: string, muscle = 'chest') => ({
  muscle, name, role: 'primary' as const, character: 'тяж' as const, sets: 2,
  repsRange: [6, 8] as [number, number], rir: 2,
  workSets: [{ reps: 8, rir: 2, weight: 80 }, { reps: 8, rir: 2, weight: 80 }],
});

describe('BB final safety validator', () => {
  it('reports imported plans violating user safety restrictions', () => {
    const result = validateBBPlan({ pattern: {} as any, weeks: [{ week: 1, sessions: [{ day: 1, weekOffset: 1, character: 'тяж', exercises: [exercise('Присед со штангой', 'quads')] }] }], rotationMuscleVolume: {}, rationale: [] }, {
      equipment: ['machine'], avoidAxialLoad: true, excludedMuscles: ['quads'],
    });
    expect(result.issues.some(issue => issue.code === 'axial_restriction_violation')).toBe(true);
    expect(result.issues.some(issue => issue.code === 'excluded_muscle_present')).toBe(true);
  });

  it('checks equipment through the exercise catalog', () => {
    const result = validateBBPlan({ pattern: {} as any, weeks: [{ week: 1, sessions: [{ day: 1, weekOffset: 1, character: 'тяж', exercises: [exercise('Жим штанги лёжа')] }] }], rotationMuscleVolume: {}, rationale: [] }, {
      equipment: ['machine'],
    });
    expect(result.issues.some(issue => issue.code === 'equipment_restriction_violation')).toBe(true);
    expect(result.valid).toBe(false);
  });

  it('rejects unknown exercises when equipment is restricted', () => {
    const result = validateBBPlan({ pattern: {} as any, weeks: [{ week: 1, sessions: [{ day: 1, weekOffset: 1, character: 'тяж', exercises: [exercise('Неизвестное упражнение')] }] }], rotationMuscleVolume: {}, rationale: [] }, {
      equipment: ['machine'],
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some(issue => issue.code === 'equipment_unknown_exercise')).toBe(true);
  });
});
