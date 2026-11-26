/**
 * diet-coverage-micros.test.ts — покрытие рационом по микронутриентам из
 * дневника питания (`micros` записи DiaryMealItem), а не только по клетчатке.
 *
 * Контракт:
 *  - нутриент считается, только если значение есть у КАЖДОЙ записи за сегодня;
 *    иначе состояние `unknown` и intake = null (не ложный ноль);
 *  - vitamin_d_mcg переводится в МЕ (1 мкг = 40 МЕ), норма 600 МЕ;
 *  - выключенная опция даёт прежний план: пустые dietCoverageNotes/dietCoverage.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { runSupportUnified } from '../index';
import { DEFAULT_STATE } from '../../../ui/screens/Calculator/Calc.types';
import { localIsoDate } from '../../../core/local-date';
import type { CalculatorState } from '../types';

/**
 * Фаза ПКТ: в плане есть позиция `fiber` (рацион её и может закрыть).
 * AAS пуст — иначе план курса, где клетчатки нет.
 */
const pctState = (options?: CalculatorState['options']): CalculatorState =>
  ({
    ...DEFAULT_STATE,
    pharma: { ...DEFAULT_STATE.pharma, phase: 'pct', hasSERM: true, aas: [] },
    options,
  }) as CalculatorState;

/** Дневник на сегодня: записи раскиданы по двум приёмам пищи. */
function seedDiary(entries: Array<Record<string, any>>): void {
  const today = localIsoDate();
  localStorage.setItem(
    'nutrition_diary_v2',
    JSON.stringify({
      [today]: { meals: { breakfast: entries.slice(0, 1), lunch: entries.slice(1) } },
    }),
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('🍽 dietCoverage по микронутриентам дневника', () => {
  it('калий 400+300 мг: intake=700, состояние insufficient (700/3500)', () => {
    seedDiary([
      { kcal: 600, p: 40, f: 15, c: 60, micros: { potassium_mg: 400 } },
      { kcal: 500, p: 30, f: 10, c: 50, micros: { potassium_mg: 300 } },
    ]);
    const on = runSupportUnified(pctState({ dietCoverage: true }));

    const potassium = on.dietCoverage.find((c) => c.key === 'potassiumMg');
    expect(potassium?.intake).toBe(700);
    expect(potassium?.state).toBe('insufficient');
  });

  it('у одной записи нет potassium_mg: калий unknown, клетчатка считается как раньше', () => {
    seedDiary([
      { kcal: 600, p: 40, f: 15, c: 60, fiber: 30, micros: { potassium_mg: 400 } },
      { kcal: 500, p: 30, f: 10, c: 50, fiber: 10, micros: {} },
    ]);
    const on = runSupportUnified(pctState({ dietCoverage: true }));

    const potassium = on.dietCoverage.find((c) => c.key === 'potassiumMg');
    expect(potassium?.state).toBe('unknown');
    expect(potassium?.intake).toBeNull();

    const fiber = on.dietCoverage.find((c) => c.key === 'fiberG');
    expect(fiber?.intake).toBe(40);
    expect(fiber?.state).toBe('covered');
  });

  it('витамин D 10+10 мкг: vitaminDIu = 800 МЕ, состояние covered (800/600)', () => {
    seedDiary([
      { kcal: 600, p: 40, f: 15, c: 60, micros: { vitamin_d_mcg: 10 } },
      { kcal: 500, p: 30, f: 10, c: 50, micros: { vitamin_d_mcg: 10 } },
    ]);
    const on = runSupportUnified(pctState({ dietCoverage: true }));

    const vitaminD = on.dietCoverage.find((c) => c.key === 'vitaminDIu');
    expect(vitaminD?.intake).toBe(800);
    expect(vitaminD?.state).toBe('covered');
  });

  it('опция выключена: dietCoverageNotes и dietCoverage пусты', () => {
    seedDiary([{ kcal: 600, p: 40, f: 15, c: 60, micros: { potassium_mg: 4000 } }]);
    const off = runSupportUnified(pctState());

    expect(off.dietCoverageNotes).toEqual([]);
    expect(off.dietCoverage).toEqual([]);
  });
});
