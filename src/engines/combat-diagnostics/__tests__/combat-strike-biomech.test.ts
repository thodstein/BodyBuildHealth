import { describe, it, expect } from 'vitest';
import {
  COMBAT_STRIKE_BIOMECH, COMBAT_STRIKE_POINTS,
  diagnoseCombatStrikePoint, effectiveMassKg, weakestCombatStrikePoint,
} from '../combat-strike-biomech.engine';

/** P1: 8 точек диагностируются; effective mass cross > hook на тех же данных. */
describe('combat-strike-biomech engine', () => {
  it('все 8 точек имеют биомеханику 4 фазы', () => {
    expect(COMBAT_STRIKE_POINTS).toHaveLength(8);
    for (const p of COMBAT_STRIKE_POINTS) {
      expect(COMBAT_STRIKE_BIOMECH[p].phases).toHaveLength(4);
    }
  });

  it('effective mass = импульс / скорость', () => {
    expect(effectiveMassKg({ impulseNs: 60, handSpeedMs: 7.5 })).toBeCloseTo(8, 5);
    expect(effectiveMassKg({})).toBeNull();
    expect(effectiveMassKg({ impulseNs: 60, handSpeedMs: 0 })).toBeNull();
  });

  it('прямые требуют большей массы, чем боковые (инвариант синтеза)', () => {
    // одинаковый слабый импульс 30 Нс при скорости 8 м/с → масса 3.75 кг:
    // кроссу (band 4–12) не хватает — warn, хуку (band 2.5–8) хватает — ok
    const cross = diagnoseCombatStrikePoint('cross', { handSpeedMs: 8, impulseNs: 30 });
    const hook = diagnoseCombatStrikePoint('rear_hook', { handSpeedMs: 8, impulseNs: 30 });
    expect(cross.effectiveMassKg).toBeCloseTo(3.75, 5);
    expect(hook.effectiveMassKg).toBeCloseTo(3.75, 5);
    expect(cross.level).toBe('warn');
    expect(hook.level).toBe('ok');
    // полный кросс в ориентире — ok
    const full = diagnoseCombatStrikePoint('cross', { handSpeedMs: 8, impulseNs: 58 });
    expect(full.level).toBe('ok');
    // низкая скорость кросса — warn/critical
    const slow = diagnoseCombatStrikePoint('cross', { handSpeedMs: 4 });
    expect(['warn', 'critical']).toContain(slow.level);
  });

  it('пустые замеры — честный no_data', () => {
    const d = diagnoseCombatStrikePoint('jab', {});
    expect(d.level).toBe('no_data');
  });

  it('слабейшая точка находится', () => {
    const w = weakestCombatStrikePoint({
      jab: { handSpeedMs: 8 }, cross: { handSpeedMs: 4 }, lead_hook: { handSpeedMs: 11 },
    });
    expect(w).toBe('cross');
    expect(weakestCombatStrikePoint({ jab: { handSpeedMs: 8 } })).toBeNull();
  });

  it('низкая effective mass — цепь не включена', () => {
    const d = diagnoseCombatStrikePoint('cross', { handSpeedMs: 8, impulseNs: 20 });
    expect(d.effectiveMassKg).toBeCloseTo(2.5, 5);
    expect(d.findings.join(' ')).toMatch(/цепь не включена/);
  });
});
