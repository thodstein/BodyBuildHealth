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
    expect(COMBAT_CYCLE_LIBRARY.length).toBeGreaterThanOrEqual(25);
  });

  it('каждый вид спорта покрыт: бокс 6, борьба 5, ММА 6, кик 3, общая 5', () => {
    // было→стало (Э5.1 PRO-волна): 13→25 циклов — добавлены весогонка по дисциплинам,
    // кэмпы борьбы/общей, enhanced×2, отель, женская база, teen, поддержание в сезоне
    const by = (d: string) => COMBAT_CYCLE_LIBRARY.filter(c => c.discipline === d).length;
    expect(by('boxing')).toBe(6);
    expect(by('wrestling')).toBe(5);
    expect(by('mma')).toBe(6);
    expect(by('kickboxing')).toBe(3);
    expect(by('general')).toBe(5);
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
