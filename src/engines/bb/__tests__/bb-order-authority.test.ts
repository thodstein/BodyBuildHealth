import { describe, expect, it } from 'vitest';
import { orderSessionExercises, explainSessionOrder } from '../bb-session-order.engine';
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

describe('O-1: lead-мышца (слабая/фокус) со своим compound', () => {
  it('compound слабой мышцы идёт раньше изоляции другой мышцы', () => {
    const ordered = orderSessionExercises([
      exercise({ muscle: 'chest', name: 'Разводка гантелей', role: 'accessory', character: 'памп', repsRange: [12, 15] }),
      exercise({ muscle: 'shoulders', name: 'Жим стоя', character: 'тяж', repsRange: [6, 8], workSets: [{ reps: 6, rir: 2, weight: 50 }] }),
      exercise({ muscle: 'chest', name: 'Жим лёжа' }),
    ], { sessionTag: 'Push', leadMuscles: ['shoulders'] });
    const names = ordered.map(item => item.name);
    // Мышца дня по-прежнему первая...
    expect(names[0]).toBe('Жим лёжа');
    // ...но база слабой мышцы обгоняет изоляцию груди.
    expect(names.indexOf('Жим стоя')).toBeLessThan(names.indexOf('Разводка гантелей'));
  });

  it('lead-мышца без compound порядок не меняет', () => {
    const ordered = orderSessionExercises([
      exercise({ muscle: 'chest', name: 'Жим лёжа' }),
      exercise({ muscle: 'shoulders', name: 'Махи гантелями в стороны', role: 'accessory', character: 'памп', repsRange: [15, 20] }),
    ], { sessionTag: 'Push', leadMuscles: ['shoulders'] });
    expect(ordered.map(item => item.name)).toEqual(['Жим лёжа', 'Махи гантелями в стороны']);
  });

  it('без leadMuscles поведение прежнее', () => {
    const a = orderSessionExercises([
      exercise({ muscle: 'chest', name: 'Разводка гантелей', role: 'accessory', character: 'памп', repsRange: [12, 15] }),
      exercise({ muscle: 'chest', name: 'Жим лёжа' }),
      exercise({ muscle: 'shoulders', name: 'Жим стоя', character: 'тяж', repsRange: [6, 8] }),
    ], { sessionTag: 'Push' });
    expect(a[0].name).toBe('Жим лёжа');
  });
});

describe('O-2: FullBody — круги по мышцам вместо группировки', () => {
  const fb = (): BBExercise[] => [
    exercise({ muscle: 'chest', name: 'Жим лёжа' }),
    exercise({ muscle: 'chest', name: 'Разводка гантелей', role: 'accessory', character: 'памп', repsRange: [12, 15] }),
    exercise({ muscle: 'back', name: 'Тяга штанги в наклоне', character: 'тяж', repsRange: [6, 8], workSets: [{ reps: 6, rir: 2, weight: 70 }] }),
    exercise({ muscle: 'back', name: 'Тяга верхнего блока', role: 'accessory', character: 'памп', repsRange: [10, 12] }),
    exercise({ muscle: 'quads', name: 'Присед со штангой', character: 'тяж', repsRange: [6, 8], workSets: [{ reps: 6, rir: 2, weight: 100 }] }),
    exercise({ muscle: 'quads', name: 'Разгибание ног', role: 'accessory', character: 'памп', repsRange: [12, 15] }),
  ];

  it('interleave: тяжёлые базы первым кругом, изоляции вторым', () => {
    const ordered = orderSessionExercises(fb(), { sessionTag: 'FullBody', interleave: true });
    const names = ordered.map(item => item.name);
    // Первый круг — тяжёлые базы, порядок мышц канонический (квадры→спина→грудь).
    expect(names.slice(0, 3)).toEqual(['Присед со штангой', 'Тяга штанги в наклоне', 'Жим лёжа']);
    expect(names.indexOf('Разводка гантелей')).toBeGreaterThan(2);
    expect(names.indexOf('Тяга верхнего блока')).toBeGreaterThan(2);
  });

  it('без interleave — группировка по мышце остаётся', () => {
    const ordered = orderSessionExercises(fb(), { sessionTag: 'FullBody' });
    const muscles = ordered.map(item => item.muscle);
    // Никаких «грудь-грудь» подряд? Наоборот: без interleave группировка ЕСТЬ.
    const firstThree = muscles.slice(0, 3);
    expect(new Set(firstThree).size).toBeLessThan(3);
  });
});

describe('O-4: аксиальная стоимость как тай-брейк', () => {
  const ax = (): BBExercise[] => [
    exercise({ muscle: 'hamstrings', name: 'Румынская тяга', character: 'тяж', repsRange: [6, 8], workSets: [{ reps: 6, rir: 2, weight: 80 }] }),
    exercise({ muscle: 'hamstrings', name: 'Становая тяга', character: 'тяж', repsRange: [5, 6], workSets: [{ reps: 5, rir: 2, weight: 120 }] }),
  ];

  it('axialAware: становая (cost 2) раньше румынской (cost 1) при равном tier', () => {
    const withAxial = orderSessionExercises(ax(), { sessionTag: 'Lower', axialAware: true });
    expect(withAxial[0].name).toBe('Становая тяга');
  });

  it('без axialAware — по весу (становая и так тяжелее), флаг ничего не ломает', () => {
    const plain = orderSessionExercises(ax(), { sessionTag: 'Lower' });
    expect(plain[0].name).toBe('Становая тяга');
  });
});

describe('O-5: explainSessionOrder', () => {
  it('объясняет методику, приоритет и аксиальную нагрузку', () => {
    const notes = explainSessionOrder([
      exercise({ muscle: 'chest', name: 'Жим лёжа' }),
      exercise({ muscle: 'shoulders', name: 'Жим стоя', character: 'тяж' }),
      exercise({ muscle: 'quads', name: 'Становая тяга', character: 'тяж' }),
      exercise({ muscle: 'hamstrings', name: 'Становая тяга', character: 'тяж' }),
    ], { sessionTag: 'FullBody', methodology: 'fst7', leadMuscles: ['shoulders'], interleave: true });
    const text = notes.join('\n');
    expect(text).toMatch(/FST-7/);
    expect(text).toMatch(/плечи/i);
    expect(text).toMatch(/чередуются|круги/i);
    expect(text).toMatch(/осев/i);
  });

  it('пустой список — пустые заметки', () => {
    expect(explainSessionOrder([], { sessionTag: 'Push' })).toEqual([]);
  });
});
