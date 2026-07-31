import { describe, expect, it } from 'vitest';
import { fitBBSessionToBudget } from '../bb-fatigue.engine';

describe('BB session working-set cap', () => {
  it('reduces secondary sets before primary work', () => {
    const make = (name: string, role: 'primary' | 'accessory', sets: number) => ({
      muscle: name === 'Жим' ? 'chest' : 'shoulders', name, role, character: role === 'primary' ? 'тяж' as const : 'памп' as const,
      sets, repsRange: [8, 12] as [number, number], rir: 2,
      workSets: Array.from({ length: sets }, () => ({ reps: 8, rir: 2, weight: 40 })),
    });
    const session: any = { day: 1, weekOffset: 1, sessionTag: 'Upper', character: 'тяж', exercises: [make('Жим', 'primary', 8), make('Махи', 'accessory', 10), make('Разводка', 'accessory', 10)] };
    fitBBSessionToBudget(session, { maxExercises: 10, maxWorkingSets: 24, maxTimeSeconds: 99999, maxAxial: 99999 });
    expect(session.exercises.reduce((sum: number, exercise: any) => sum + exercise.sets, 0)).toBeLessThanOrEqual(24);
    expect(session.exercises[0].sets).toBe(8);
  });
});
