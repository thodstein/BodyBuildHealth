/**
 * lms-speed-index.test.ts — индекс скорости/координации СРЦ-циклов (Фаза 1).
 */
import { describe, expect, it } from 'vitest';
import { SPEED_CYCLE_IDS, speedOrientationOf, isSpeedCycle } from '../../../data/lms-cycles/lms-speed-index';
import { getCycleById } from '../../../data/lms-cycles/lms-cycle-index';
import { CYCLE_01 } from '../../../data/lms-cycles/cycle-01';
import { CYCLE_03 } from '../../../data/lms-cycles/cycle-03';
import { CYCLE_04 } from '../../../data/lms-cycles/cycle-04';

describe('lms-speed-index', () => {
  it('индекс непуст и содержит только канонические id из реестра', () => {
    const ids = Object.keys(SPEED_CYCLE_IDS);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9-]+$/);
      expect(Array.isArray(SPEED_CYCLE_IDS[id])).toBe(true);
      expect(SPEED_CYCLE_IDS[id].length).toBeGreaterThan(0);
    }
  });

  it('speedOrientationOf: найденный цикл — массив ориентаций, ненайденный — []', () => {
    expect(speedOrientationOf(CYCLE_01)).toEqual([]);
    expect(speedOrientationOf(CYCLE_03)).toEqual([]);
    expect(speedOrientationOf(CYCLE_04)).toContain('coordination');
  });

  it('speedOrientationOf: null/undefined/битый цикл — []', () => {
    expect(speedOrientationOf(null)).toEqual([]);
    expect(speedOrientationOf(undefined)).toEqual([]);
    expect(speedOrientationOf({} as never)).toEqual([]);
    expect(speedOrientationOf({ meta: {} } as never)).toEqual([]);
  });

  it('isSpeedCycle: маркированные циклы распознаются, обычные — нет', () => {
    expect(isSpeedCycle(CYCLE_01)).toBe(false);
    const fake = { meta: { id: 'src2-dpsm' } } as never;
    expect(isSpeedCycle(fake as never)).toBe(true);
  });

  it('все id индекса существуют в реестре циклов (нет мёртвых ключей)', () => {
    for (const id of Object.keys(SPEED_CYCLE_IDS)) {
      expect(getCycleById(id), `цикл ${id} должен существовать в реестре`).toBeTruthy();
    }
  });
});