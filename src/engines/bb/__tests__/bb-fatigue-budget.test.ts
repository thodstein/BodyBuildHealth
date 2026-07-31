import { describe, expect, it } from 'vitest';
import { fitBBSessionToBudget } from '../bb-fatigue.engine';

const exercise = (name: string, role: 'primary' | 'accessory', character: 'тяж' | 'памп', sets = 4) => ({
  muscle: name.includes('груд') ? 'chest' : 'shoulders', name, role, character, sets,
  repsRange: character === 'памп' ? [15, 20] as [number, number] : [6, 8] as [number, number], rir: 2,
  workSets: Array.from({ length: sets }, () => ({ reps: character === 'памп' ? 18 : 8, rir: 2, weight: 50 })),
});

describe('BB fatigue budget fitting', () => {
  it('removes secondary finishers before primary work', () => {
    const session: any = { day: 1, weekOffset: 1, character: 'тяж', sessionTag: 'Chest', exercises: [
      exercise('Жим грудью', 'primary', 'тяж', 4),
      exercise('Разводка грудью', 'accessory', 'памп', 5),
      exercise('Махи плечами', 'accessory', 'памп', 5),
    ] };
    const result = fitBBSessionToBudget(session, { maxTimeSeconds: 60 });
    expect(result.removed.length).toBeGreaterThan(0);
    expect(session.exercises.some((e: any) => e.role === 'primary')).toBe(true);
  });
});
