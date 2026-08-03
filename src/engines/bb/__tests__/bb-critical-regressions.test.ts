import { describe, expect, it } from 'vitest';
import { applyDeloadToWeek, DELOAD_PROTOCOLS } from '../bb-autocoach.engine';
import type { BBWeek } from '../bb-builder.engine';

function makeWeek(): BBWeek {
  return {
    week: 1,
    phase: 'accumulation',
    sessions: [{
      day: 1,
      weekOffset: 1,
      character: 'тяж',
      sessionTag: 'Chest',
      exercises: [{
        muscle: 'chest',
        name: 'Жим штанги лёжа',
        exerciseName: 'Жим штанги лёжа',
        role: 'primary',
        character: 'тяж',
        sets: 4,
        repsRange: [6, 8],
        rir: 2,
        workSets: [1, 2, 3, 4].map(() => ({ reps: 8, rir: 2, weight: 100 })),
      }],
    }],
  };
}

describe('BB critical regressions', () => {
  it('reduces sets and keeps set shape when deload swaps an exercise', () => {
    const result = applyDeloadToWeek(makeWeek(), DELOAD_PROTOCOLS.pump);
    const exercise = result.sessions[0].exercises[0];
    expect(exercise.name).not.toBe('Жим штанги лёжа');
    expect(exercise.sets).toBe(2);
    expect(exercise.workSets).toHaveLength(2);
    expect(exercise.workSets.every(set => set.rir === 4)).toBe(true);
  });

  it('reduces non-swapped exercises and keeps workSets synchronized', () => {
    const week = makeWeek();
    week.sessions[0].exercises[0].name = 'Разведения гантелей лёжа';
    week.sessions[0].exercises[0].exerciseName = 'Разведения гантелей лёжа';
    const result = applyDeloadToWeek(week, DELOAD_PROTOCOLS.pump);
    const exercise = result.sessions[0].exercises[0];
    expect(exercise.sets).toBe(2);
    expect(exercise.workSets).toHaveLength(2);
  });
});
