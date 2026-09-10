/**
 * combat-cycle-library.test.ts — библиотека готовых циклов: валидность,
 * уникальность id, применение цикла = те же параметры сборки.
 */
import { describe, it, expect } from 'vitest';
import { COMBAT_CYCLE_LIBRARY, getCombatCycle, validateCombatCycles } from '../combat-cycle-library';
import { buildCombatPlan } from '../combat-builder.engine';
import { finalizeCombatPlan } from '../combat-finalize.engine';

describe('combat cycle library', () => {
  it('все циклы валидны (паттерн/дни/недели)', () => {
    expect(validateCombatCycles()).toEqual([]);
    expect(COMBAT_CYCLE_LIBRARY.length).toBeGreaterThanOrEqual(12);
  });

  it('каждый вид спорта покрыт: бокс 3, борьба 2, ММА 4, кик 2, общая 2', () => {
    const by = (d: string) => COMBAT_CYCLE_LIBRARY.filter(c => c.discipline === d).length;
    expect(by('boxing')).toBe(3);
    expect(by('wrestling')).toBe(2);
    expect(by('mma')).toBe(4);
    expect(by('kickboxing')).toBe(2);
    expect(by('general')).toBe(2);
  });

  it('id уникальны, getCombatCycle находит/не находит', () => {
    const ids = COMBAT_CYCLE_LIBRARY.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(getCombatCycle('cb-mma-camp-8')?.weeks).toBe(8);
    expect(getCombatCycle('nope')).toBeNull();
  });

  it('цикл собирается движком без ошибок', () => {
    for (const c of COMBAT_CYCLE_LIBRARY) {
      const plan = finalizeCombatPlan(buildCombatPlan({
        discipline: c.discipline, goal: c.goal, level: 'intermediate',
        weeks: c.weeks, daysPerWeek: c.daysPerWeek,
        periodizationModel: c.periodizationModel, patternId: c.patternId,
      } as any));
      expect(plan.weeks).toBe(c.weeks);
      expect(plan.validation.ok).toBe(true);
    }
  });
});
