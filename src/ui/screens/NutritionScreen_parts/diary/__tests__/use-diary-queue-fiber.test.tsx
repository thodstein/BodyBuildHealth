/**
 * use-diary-queue-fiber.test.tsx — клетчатка продукта не теряется в очереди.
 *
 * Микро дневника считаются по полю `fiber_g`, а продукт хранит клетчатку либо
 * в верхнеуровневом `fiber` (FOOD_DB/OFF/USDA), либо уже в `micros.fiber_g`
 * (этикетка/фото). Раньше очереди клали только минералы/витамины — клетчатка
 * продукта в дневник не доезжала ни одним путём добавления.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDiaryQueue } from '../hooks/useDiaryQueue';
import { FOOD_DB } from '../../../../../core/nutrition-database';
import { FIBER_FOODS } from '../../../../../data/fiber-foods';

// `addCustomEntryToQueue` не отдаётся наружу: хук передаёт его сканеру этикетки.
// Забираем колбэк через мок useLabelScan, чтобы проверить, что делает дневник.
vi.mock('../hooks/useLabelScan', () => ({
  useLabelScan: (opts: any) => ({ labelScanOptions: opts }),
}));

const DATE = '2026-11-20';
const MEAL = 'Обед';

function setup(diaryData: Record<string, any> = {}) {
  const saveDiary = vi.fn();
  const { result } = renderHook(() =>
    useDiaryQueue({
      diaryData,
      selectedDate: DATE,
      mealType: MEAL,
      usdaFoods: [],
      saveDiary,
      showToast: vi.fn(),
      bumpRefresh: vi.fn(),
      setShowBarcode: vi.fn(),
    }),
  );
  return { result, saveDiary };
}

describe('useDiaryQueue: клетчатка в микросах', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('addFoodFromDB пересчитывает клетчатку FOOD_DB на граммовку порции', () => {
    const food = FOOD_DB.find((f) => f.id === 'oats_dry');
    expect(food?.fiber).toBeGreaterThan(0);
    const { result } = setup();

    act(() => result.current.addFoodFromDB(food as any, 150));

    expect(result.current.parsedItems[0].micros?.fiber_g).toBe(Math.round(food!.fiber * 1.5 * 10) / 10);
  });

  it('верхнеуровневая fiber у продукта из сети (OFF) тоже даёт fiber_g', () => {
    const { result } = setup();

    act(() =>
      result.current.addFoodFromDB(
        {
          id: '4600680251387',
          name: 'Хлеб цельнозерновой',
          kcal: 220,
          protein: 8,
          fat: 3,
          carbs: 40,
          fiber: 2,
          category: 'grain',
        } as any,
        150,
      ),
    );

    expect(result.current.parsedItems[0].micros?.fiber_g).toBe(3);
  });

  it('addCustomEntryToQueue кладёт клетчатку этикетки на 100 г', () => {
    const { result } = setup();

    act(() =>
      (result.current as any).labelScanOptions.onAddToQueue({
        id: 'label-1',
        name: 'Йогурт с клетчаткой',
        kcal: 60,
        protein: 5,
        fat: 2,
        carbs: 7,
        fiber: 2.6,
        category: 'dairy',
        servingSize: '100 г',
      } as any),
    );

    const item = result.current.parsedItems[0];
    expect(item.qty).toBe(100);
    expect(item.micros?.fiber_g).toBe(2.6);
  });

  it('уже посчитанная micros.fiber_g не двоится и не перетирается', () => {
    const { result } = setup();

    act(() =>
      result.current.addFoodFromDB(
        {
          id: 'off-fiber',
          name: 'Отруби пшеничные',
          kcal: 216,
          protein: 15,
          fat: 3,
          carbs: 64,
          fiber: 0,
          micros: { fiber_g: 4 },
        } as any,
        150,
      ),
    );

    // 4 г/100 г × 1.5 = 6 г: значение масштабируется один раз, верхнеуровневый
    // «0» не добавляет вторую порцию клетчатки.
    expect(result.current.parsedItems[0].micros?.fiber_g).toBe(6);
  });

  it('порция сухой клетчатки 4 г не поднимается до 10 г и даёт 3 г клетчатки', () => {
    const psyllium = FIBER_FOODS.find((f) => f.id === 'psyllium_husk_powder')!;
    const { result } = setup();

    act(() => result.current.addFoodFromDB(psyllium as any, psyllium.defaultPortion || 4));

    // Флор 10 г в очереди завышал чайную ложку в 2,5 раза: 4 г → 3 г клетчатки,
    // а не 10 г → 7,5 г.
    expect(result.current.parsedItems[0].qty).toBe(4);
    expect(result.current.parsedItems[0].micros?.fiber_g).toBe(3);
  });
});
