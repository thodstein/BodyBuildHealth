import { describe, expect, it } from 'vitest';
import { forceVector, prescribeExercises, lengthenedPartials } from '../exercise-prescription.engine';

describe('exercise-prescription', () => {
  it('maps force vectors', () => {
    expect(forceVector('chest', 'compound')).toBe('horizontal_push');
    expect(forceVector('back', 'compound', 'Подтягивания')).toBe('vertical_pull');
    expect(forceVector('legs', 'compound', 'Румынская тяга')).toBe('hip_dominant');
    expect(forceVector('core', 'isolation')).toBe('core_anti');
  });
  it('returns bounded prescriptions and respects equipment/constraints', () => {
    const result = prescribeExercises({ muscle: 'chest', goal: 'hypertrophy', equipment: ['barbell'], constraints: ['shoulder'], limit: 4 });
    expect(result.length).toBeLessThanOrEqual(7);
    expect(result.every(ex => ex.id && ex.forceVector)).toBe(true);
  });
  it('provides regional hypertrophy exercises', () => {
    expect(lengthenedPartials('legs').length).toBeGreaterThan(0);
    expect(lengthenedPartials('unknown')).toEqual([]);
  });
});
