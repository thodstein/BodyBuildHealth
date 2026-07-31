import { describe, expect, it } from 'vitest';
import { orderSessionExercises } from '../bb-session-order.engine';
import type { BBExercise } from '../bb-builder.engine';

function exercise(partial: Partial<BBExercise>): BBExercise {
  return {
    muscle: 'chest', name: 'Жим лёжа', role: 'primary', character: 'тяж',
    sets: 3, repsRange: [6, 8], rir: 2,
    workSets: [{ reps: 6, rir: 2, weight: 100 }],
    ...partial,
  } as BBExercise;
}

describe('BB order engine authority', () => {
  it('keeps the primary compound before weak-point isolation', () => {
    const ordered = orderSessionExercises([
      exercise({ muscle: 'shoulders', name: 'Махи гантелями в стороны', role: 'accessory', character: 'памп', repsRange: [15, 20] }),
      exercise({ muscle: 'chest', name: 'Жим лёжа' }),
    ], { sessionTag: 'ChestBack', priorityMuscles: ['shoulders'] });

    expect(ordered.map(item => item.name)).toEqual(['Жим лёжа', 'Махи гантелями в стороны']);
  });

  it('honours pre-exhaust without a competing post-sort', () => {
    const ordered = orderSessionExercises([
      exercise({ muscle: 'chest', name: 'Жим лёжа' }),
      exercise({ muscle: 'chest', name: 'Разводка гантелей', role: 'accessory', character: 'памп', repsRange: [10, 12] }),
    ], { sessionTag: 'ChestBack', methodology: 'pre_exhaust' });

    expect(ordered[0].name).toBe('Разводка гантелей');
  });
});
