/**
 * calcium-phosphorus-low-tier.test.ts — проход 187: низкая ступень «лечение»
 * у кальция и фосфора достижима.
 *
 * В документации (`docs/LAB-NORMS-SINGLE-SOURCE.md`, §4) стояла запись, что
 * ступень «лечение» на низкой стороне недостижима, потому что `emergencyLow`
 * совпадает с `treatment[0]` (1.8 и 0.4 ммоль/л), — и что 1.75 сразу даёт
 * «экстренно». Проверка поведением показала обратное: `treatment[0]` — нижний
 * край полосы лечения, поэтому 1.9 и 0.5 дают tier 2, а «экстренно» начинается
 * с 1.8 и 0.4. Числа не менялись — изменился только вывод о них.
 */
import { describe, it, expect } from 'vitest';
import { LAB_TIERS, deriveTier } from '../lab-tier-ranges';

describe('проход 187: кальций/фосфор — низкая ступень лечения достижима', () => {
  it('полосы шкалы: лечение выше границы «экстренно»', () => {
    for (const code of ['CALCIUM', 'PHOSPHORUS'] as const) {
      const row = LAB_TIERS[code];
      expect(row.direction).toBe('both');
      expect(row.treatment![0]).toBe(row.emergencyLow);
      expect(row.treatment![1]).toBeGreaterThan(row.treatment![0]);
    }
  });

  it('кальций: 1.9 — лечение, 1.8 и ниже — экстренно', () => {
    expect(LAB_TIERS.CALCIUM.normal).toEqual([2.2, 2.6]);
    expect(deriveTier('CALCIUM', 1.9, 'male')).toBe(2);
    expect(deriveTier('CALCIUM', 1.8, 'male')).toBe(3);
    expect(deriveTier('CALCIUM', 1.5, 'male')).toBe(3);
    expect(deriveTier('CALCIUM', 2.4, 'male')).toBe(0);
  });

  it('фосфор: 0.5 — лечение, 0.4 и ниже — экстренно', () => {
    expect(deriveTier('PHOSPHORUS', 0.5, 'male')).toBe(2);
    expect(deriveTier('PHOSPHORUS', 0.4, 'male')).toBe(3);
    expect(deriveTier('PHOSPHORUS', 1.0, 'male')).toBe(0);
  });
});
