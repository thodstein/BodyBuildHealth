import { describe, it, expect } from 'vitest';
import {
  COMBAT_SCHOOL_STRIKES, STRIKE_SCHOOL, schoolAssistanceValid, schoolDrillFor,
} from '../combat-strike-school.engine';

/** P8: 6 ударов со школой; подсобка только из реального пула; фаза → назначение. */
describe('combat strike-school (P8)', () => {
  it('6 ударов: стойка/ошибки/чекпоинты/дриллы/подсобка непусты', () => {
    expect(COMBAT_SCHOOL_STRIKES).toHaveLength(6);
    for (const s of COMBAT_SCHOOL_STRIKES) {
      const c = STRIKE_SCHOOL[s];
      expect(c.stance.length).toBeGreaterThan(10);
      expect(c.errors.length).toBeGreaterThanOrEqual(3);
      expect(c.checkpoints.length).toBeGreaterThanOrEqual(2);
      expect(c.drills.length).toBeGreaterThanOrEqual(2);
      expect(c.assistance.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('подсобка — только реальные id пула зала', () => {
    const v = schoolAssistanceValid();
    expect(v.bad).toEqual([]);
    expect(v.valid).toBe(true);
  });

  it('слабая фаза маппится в назначение (golden-таблица)', () => {
    const speed = schoolDrillFor('cross', 'speed');
    expect(speed.drills.length).toBe(2);
    expect(speed.assistance.length).toBe(3);
    expect(speed.text).toMatch(/Кросс/);
    const mass = schoolDrillFor('cross', 'mass');
    expect(mass.gapText).toMatch(/Масса не включается/);
    expect(schoolDrillFor('jab', 'path').gapText).toMatch(/Петля/);
    expect(schoolDrillFor('hook', 'asym').gapText).toMatch(/Слабая сторона/);
  });
});
