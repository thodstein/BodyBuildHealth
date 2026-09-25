import { describe, it, expect } from 'vitest';
import { selectVisiblePlans, plansSignature } from '../planner-derived-sync';
import { sumMealTotals, sumDayTotals } from '../planner-recipe-mode';

const day = (id: string, amount = 100) => ({
  meals: [{ label: 'Обед', items: [{ id, amount, kcal: 100, p: 10, f: 2, c: 12, fiber: 1, leucine_mg: 750 }] }],
  totals: { kcal: 100, p: 10, f: 2, c: 12, fiber: 1, leucine_mg: 750 },
});

const plan7 = () => ({ days: Array.from({ length: 7 }, (_, i) => day(`w${i}`)) });
const plan3 = () => ({ days: Array.from({ length: 3 }, (_, i) => day(`t${i}`)) });

describe('Волна 2 · selectVisiblePlans не теряет правки открытого дня недели', () => {
  it('в режиме недели без открытого дня берутся дни weekPlan', () => {
    const out = selectVisiblePlans({
      planDays: 7, dayPlan: day('edited'), threeDayPlan: null, weekPlan: plan7(), selectedDayIndex: 3, weekEditDay: null,
    });
    expect(out).toHaveLength(7);
    expect(out[3].meals[0].items[0].id).toBe('w3');
  });

  it('РЕГРЕСС: weekEditDay → dayPlan подставляется в свой день (иначе закупки/готовка устаревают)', () => {
    const out = selectVisiblePlans({
      planDays: 7, dayPlan: day('edited'), threeDayPlan: null, weekPlan: plan7(), selectedDayIndex: 4, weekEditDay: 4,
    });
    expect(out).toHaveLength(7);
    expect(out[4].meals[0].items[0].id).toBe('edited');
    expect(out[3].meals[0].items[0].id).toBe('w3');
    expect(out[5].meals[0].items[0].id).toBe('w5');
  });

  it('weekEditDay вне диапазона не ломает выборку', () => {
    const out = selectVisiblePlans({
      planDays: 7, dayPlan: day('edited'), threeDayPlan: null, weekPlan: plan7(), selectedDayIndex: 0, weekEditDay: 99,
    });
    expect(out).toHaveLength(7);
    expect(out.every(d => d.meals[0].items[0].id.startsWith('w'))).toBe(true);
  });

  it('режим 3 дня: dayPlan подставляется в selectedDayIndex (без регрессии)', () => {
    const out = selectVisiblePlans({
      planDays: 3, dayPlan: day('edited3'), threeDayPlan: plan3(), weekPlan: null, selectedDayIndex: 1, weekEditDay: null,
    });
    expect(out).toHaveLength(3);
    expect(out[1].meals[0].items[0].id).toBe('edited3');
  });

  it('без планов возвращает пустой массив, а не исключение', () => {
    expect(selectVisiblePlans({ planDays: 7, dayPlan: null, threeDayPlan: null, weekPlan: null, selectedDayIndex: 0, weekEditDay: null })).toEqual([]);
  });
});

describe('Волна 2 · totals не теряют клетчатку и лейцин', () => {
  it('sumMealTotals агрегирует fiber и leucine_mg', () => {
    const t = sumMealTotals([
      { id: 'a', name: 'A', amount: 100, kcal: 100, p: 10, f: 2, c: 12, fiber: 1.5, leucine_mg: 750 },
      { id: 'b', name: 'B', amount: 50, kcal: 50, p: 5, f: 1, c: 6, fiber: 0.5, leucine_mg: 250 },
    ] as any);
    expect(t.fiber).toBeCloseTo(2, 1);
    expect(t.leucine_mg).toBe(1000);
  });

  it('sumDayTotals агрегирует fiber и leucine_mg по приёмам', () => {
    const meals = [
      { label: 'З', items: [], totals: { kcal: 100, p: 10, f: 2, c: 12, fiber: 1, leucine_mg: 500 } },
      { label: 'О', items: [], totals: { kcal: 200, p: 20, f: 4, c: 24, fiber: 2, leucine_mg: 700 } },
    ] as any;
    const t = sumDayTotals(meals);
    expect(t.fiber).toBeCloseTo(3, 1);
    expect(t.leucine_mg).toBe(1200);
  });

  it('старая форма totals без leucine не ломает агрегат (совместимость)', () => {
    const t = sumDayTotals([{ label: 'О', items: [], totals: { kcal: 100, p: 1, f: 1, c: 1 } }] as any);
    expect(t.leucine_mg).toBe(0);
    expect(t.kcal).toBe(100);
  });
});

describe('Волна 5 · derived-sync сигнатура и ограничения', () => {
  it('второй рецепт и его масштаб входят в сигнатуру даже при одинаковых item id', () => {
    const base = {
      ...day('same'),
      meals: [{
        label: 'Обед',
        items: [{ id: 'rice', amount: 100, kcal: 100, p: 10, f: 2, c: 12 }],
        recipeApplied: 'Первый',
        recipeAppliedData: { name: 'Первый', ingredientIds: ['rice'], portionScale: 1 },
        recipeApplied2: 'Второй',
        recipeAppliedData2: { name: 'Второй', ingredientIds: ['rice'], portionScale: 1 },
      }],
    };
    const changed = {
      ...base,
      meals: [{
        ...base.meals[0],
        recipeAppliedData2: { ...base.meals[0].recipeAppliedData2, portionScale: 2 },
      }],
    };
    expect(plansSignature([base])).not.toBe(plansSignature([changed]));
  });

  it('пустое значение weekEditDay остаётся совместимым со старыми вызовами', () => {
    expect(selectVisiblePlans({ planDays: 1, dayPlan: day('d'), threeDayPlan: null, weekPlan: null, selectedDayIndex: 0 })).toHaveLength(1);
  });
});
