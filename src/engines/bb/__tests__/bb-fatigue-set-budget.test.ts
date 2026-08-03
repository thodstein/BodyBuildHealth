import { describe, expect, it } from 'vitest';
import { fitBBSessionToBudget } from '../bb-fatigue.engine';

const makeExercise = (name: string, muscle: string, sets: number, role: 'primary' | 'accessory' = 'accessory') => ({
  muscle, name, role, character: role === 'primary' ? 'тяж' as const : 'памп' as const,
  sets, repsRange: role === 'primary' ? [6, 8] as [number, number] : [15, 20] as [number, number], rir: 2,
  workSets: Array.from({ length: sets }, () => ({ reps: role === 'primary' ? 8 : 15, rir: 2, weight: 50 })),
});

describe('BB fatigue budget set distribution', () => {
  it('reduces secondary sets before removing an exercise', () => {
    const session: any = {
      day: 1, weekOffset: 1, character: 'тяж', sessionTag: 'Chest',
      exercises: [
        makeExercise('Жим лёжа', 'chest', 4, 'primary'),
        makeExercise('Разводка в тренажёре', 'chest', 5),
      ],
    };

    const result = fitBBSessionToBudget(session, { maxTimeSeconds: 1210 });

    expect(result.removed).toHaveLength(0);
    expect(session.exercises[0].sets).toBe(4);
    expect(session.exercises[1].sets).toBe(2);
    expect(session.exercises[1].workSets).toHaveLength(2);
  });

  it('preserves the only exercise for a muscle', () => {
    const session: any = {
      day: 1, weekOffset: 1, character: 'тяж', sessionTag: 'Chest',
      exercises: [makeExercise('Жим лёжа', 'chest', 3, 'primary')],
    };

    const result = fitBBSessionToBudget(session, { maxTimeSeconds: 5 });

    expect(result.removed).toHaveLength(0);
    expect(session.exercises).toHaveLength(1);
    expect(session.exercises[0].sets).toBe(3);
  });

  it('never reduces an accessory below the configured minimum', () => {
    const session: any = {
      day: 1, weekOffset: 1, character: 'тяж', sessionTag: 'Chest',
      exercises: [
        makeExercise('Жим лёжа', 'chest', 4, 'primary'),
        makeExercise('Разводка', 'chest', 3),
      ],
    };
    fitBBSessionToBudget(session, { maxWorkingSets: 5, minSetsPerExercise: 2, maxTimeSeconds: 99999, maxAxial: 99999 });
    expect(session.exercises.every((exercise: any) => exercise.sets >= 2)).toBe(true);
    expect(session.exercises.every((exercise: any) => exercise.workSets.length === exercise.sets)).toBe(true);
  });
});
