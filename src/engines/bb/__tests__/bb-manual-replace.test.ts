import { describe, expect, it } from 'vitest';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';

describe('BB manual replacement contract', () => {
  it('has catalog equipment available for recalculating replacement load', () => {
    const old = EXERCISE_CATALOG.find(x => x.name === 'Разводка гантелей лёжа');
    const next = EXERCISE_CATALOG.find(x => x.name === 'Сведение в тренажёре Butterfly');
    expect(old?.equipment).toBe('dumbbell');
    expect(next?.equipment).toBe('machine');
  });
});
