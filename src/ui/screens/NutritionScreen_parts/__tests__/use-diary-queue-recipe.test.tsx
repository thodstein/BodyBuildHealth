/**
 * use-diary-queue-recipe.test.tsx — рецепт в очереди и в дневнике.
 *
 * Проверяем путь, которым рецепт попадает в приём: очередь хранит КБЖУ на 100 г
 * и общий вес, при сохранении продукты пересчитываются на фактический вес,
 * микронутриенты блюда берутся из состава, а набор из дневника не теряет
 * состав рецепта.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDiaryQueue } from '../diary/hooks/useDiaryQueue';
import { buildRecipeDiaryEntry } from '../diary/recipe-to-diary';
import { RECIPE_DB } from '../../../../data/recipe-db';

const DATE = '2026-11-20';
const MEAL = 'Обед';

function setup(diaryData: Record<string, any> = {}) {
  const saveDiary = vi.fn();
  const { result } = renderHook(() => useDiaryQueue({
    diaryData,
    selectedDate: DATE,
    mealType: MEAL,
    usdaFoods: [],
    saveDiary,
    showToast: vi.fn(),
    bumpRefresh: vi.fn(),
    setShowBarcode: vi.fn(),
  }));
  return { result, saveDiary };
}

const savedEntry = (saveDiary: ReturnType<typeof vi.fn>) =>
  saveDiary.mock.calls[0][0][DATE].meals[MEAL][0];

describe('useDiaryQueue: рецепт', () => {
  beforeEach(() => { localStorage.clear(); });

  it('сохраняет блюдо с составом и микронутриентами', () => {
    const { result, saveDiary } = setup();

    act(() => result.current.addRecipeToQueue(RECIPE_DB[0], 1, false));
    expect(result.current.parsedItems).toHaveLength(1);
    expect(result.current.parsedItems[0].recipe?.components.length).toBeGreaterThan(0);

    act(() => result.current.saveItemsToDiary(result.current.parsedItems));

    const saved = savedEntry(saveDiary);
    expect(saved.name).toBe(RECIPE_DB[0].name);
    // qty — число граммов (DiaryMealItem.qty: number), а не строка «250 г».
    expect(typeof saved.qty).toBe('number');
    expect(saved.recipe?.components.length).toBeGreaterThan(0);
    // Без foodId витамины/минералы у блюда считаются по продуктам состава.
    expect(saved.micros).toBeDefined();
    expect(Object.keys(saved.micros || {}).length).toBeGreaterThan(0);
  });

  it('прямое добавление пишет число граммов в qty', () => {
    const { result, saveDiary } = setup();

    act(() => result.current.handleDirectAdd({
      id: 'rice', name: 'Рис', kcal: 130, protein: 3, fat: 1, carbs: 28, category: 'grains',
    } as any, 150));

    const saved = saveDiary.mock.calls[0][0][DATE].meals[MEAL][0];
    expect(saved.qty).toBe(150);
    expect(saved.kcal).toBe(195);
  });

  it('пересчитывает состав при изменении веса в очереди', () => {
    const { result, saveDiary } = setup();

    act(() => result.current.addRecipeToQueue(RECIPE_DB[0], 1, false));
    act(() => result.current.updateParsedItemQty(0, 200));
    act(() => result.current.saveItemsToDiary(result.current.parsedItems));

    const saved = savedEntry(saveDiary);
    const componentsWeight = saved.recipe.components.reduce(
      (sum: number, c: any) => sum + (Number(c.qty) || 0), 0,
    );
    expect(Math.abs(componentsWeight - 200)).toBeLessThanOrEqual(5);
    // Итог записи = КБЖУ на 100 г × вес / 100 (макросы и состав сходятся).
    expect(saved.kcal).toBeGreaterThan(0);
    expect(saved.kcal).toBeLessThan(2000);
  });

  it('вес больше 1 кг не упирается в старый потолок 1000 г', () => {
    const { result } = setup();

    act(() => result.current.setParsedItems([{
      name: 'Плов', kcal: 180, p: 8, f: 6, c: 22, qty: 100,
    }]));
    act(() => result.current.updateParsedItemQty(0, 1500));

    expect(result.current.parsedItems[0].qty).toBe(1500);
  });
});

describe('useDiaryQueue: микронутриенты и наборы', () => {
  beforeEach(() => { localStorage.clear(); });

  it('пересчитывает микронутриенты вместе с граммовкой', () => {
    const { result } = setup();

    act(() => result.current.setParsedItems([{
      name: 'Куриная грудка', kcal: 110, p: 21, f: 2, c: 0, qty: 100,
      micros: { sodium_mg: 70, iron_mg: 1 },
    }]));
    act(() => result.current.updateParsedItemQty(0, 200));

    expect(result.current.parsedItems[0].micros?.sodium_mg).toBeCloseTo(140, 1);
    expect(result.current.parsedItems[0].micros?.iron_mg).toBeCloseTo(2, 1);
  });

  it('набор из дневника сохраняет состав рецепта', () => {
    const { result } = setup();
    const entry = buildRecipeDiaryEntry(RECIPE_DB[0]);

    act(() => result.current.addPresetItems([entry]));

    const queued = result.current.parsedItems[0];
    expect(queued.name).toBe(entry.name);
    expect(queued.recipe?.components.length).toBe(entry.recipe?.components.length);
  });
});
