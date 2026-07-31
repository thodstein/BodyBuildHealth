import { describe, expect, it } from 'vitest';
import { fitBBSessionToBudget } from '../bb-fatigue.engine';

const ex = (muscle: string, index: number, role: 'primary' | 'accessory' = 'accessory') => ({
  muscle, name: `${muscle}-${index}`, role, character: role === 'primary' ? 'тяж' as const : 'памп' as const,
  sets: 2, repsRange: [12, 15] as [number, number], rir: 2,
  workSets: [{ reps: 12, rir: 2, weight: 20 }, { reps: 12, rir: 2, weight: 20 }],
});

describe('BB universal exercise cap', () => {
  it('caps every source with priority-aware removal', () => {
    const session: any = {
      day: 1, weekOffset: 1, character: 'тяж', sessionTag: 'FullBody',
      exercises: [ex('chest', 0, 'primary'), ...Array.from({ length: 11 }, (_, i) => ex(`muscle${i}`, i))],
    };

    const result = fitBBSessionToBudget(session, { maxExercises: 10, maxTimeSeconds: 99999, maxAxial: 99999 });

    expect(result.removed).toHaveLength(2);
    expect(session.exercises).toHaveLength(10);
    expect(session.exercises[0].role).toBe('primary');
    expect(session.exercises.some((item: any) => item.muscle === 'chest')).toBe(true);
  });
});
