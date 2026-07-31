import { describe, expect, it } from 'vitest';
import { analyzeBBRotation } from '../bb-rotation.engine';

const exercise = (name: string, role: 'primary' | 'accessory', muscle = 'chest') => ({
  muscle, name, role, character: 'тяж' as const, sets: 2,
  repsRange: [8, 10] as [number, number], rir: 2,
  workSets: [{ reps: 8, rir: 2, weight: 50 }, { reps: 8, rir: 2, weight: 50 }],
});

describe('BB exercise rotation diagnostics', () => {
  it('flags a changing primary lift', () => {
    const plan: any = { pattern: {}, weeks: [
      { week: 1, sessions: [{ day: 1, weekOffset: 1, character: 'тяж', exercises: [exercise('Жим лёжа', 'primary')] }] },
      { week: 2, sessions: [{ day: 1, weekOffset: 2, character: 'тяж', exercises: [exercise('Жим на наклонной', 'primary')] }] },
    ], rotationMuscleVolume: {}, rationale: [] };
    expect(analyzeBBRotation(plan).issues.some(issue => issue.code === 'primary_changed')).toBe(true);
  });

  it('flags repeated accessory movement patterns', () => {
    const plan: any = { pattern: {}, weeks: [
      { week: 1, sessions: [{ day: 1, weekOffset: 1, character: 'тяж', exercises: [exercise('Разводка гантелей', 'accessory')] }] },
      { week: 2, sessions: [{ day: 1, weekOffset: 2, character: 'тяж', exercises: [exercise('Разводка в кроссовере', 'accessory')] }] },
      { week: 3, sessions: [{ day: 1, weekOffset: 3, character: 'тяж', exercises: [exercise('Разводка в тренажёре', 'accessory')] }] },
    ], rotationMuscleVolume: {}, rationale: [] };
    expect(analyzeBBRotation(plan).issues.some(issue => issue.code === 'no_accessory_rotation')).toBe(true);
  });
});
