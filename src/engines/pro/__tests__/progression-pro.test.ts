import { describe, expect, it } from 'vitest';
import { getScheme, listSchemes, generateProgression, PROGRESSION_SCHEMES } from '../progression-pro.engine';

describe('progression-pro', () => {
  it('lists every registered scheme', () => {
    expect(listSchemes()).toHaveLength(Object.keys(PROGRESSION_SCHEMES).length);
    expect(getScheme('531')?.trainingMaxFactor).toBe(0.9);
  });
  it('generates rounded weights from training max', () => {
    const weeks = generateProgression('531', 200);
    expect(weeks).toHaveLength(4);
    expect(weeks![0].trainingMax).toBe(180);
    expect(weeks![0].days[0].sets[0].weight).toBe(117);
  });
  it('returns null for invalid e1RM', () => {
    expect(generateProgression('dup', 0)).toBeNull();
  });
});
