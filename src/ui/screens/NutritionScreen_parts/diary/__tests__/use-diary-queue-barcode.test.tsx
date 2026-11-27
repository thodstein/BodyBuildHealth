/**
 * use-diary-queue-barcode.test.tsx — штрихкод не теряется при быстром «＋».
 *
 * Раньше addFoodFromDB/handleDirectAdd клали только название и КБЖУ: у товара
 * из сети (OFF/сканер) пропадал единственный стабильный ключ — barcode.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDiaryQueue } from '../hooks/useDiaryQueue';

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

describe('useDiaryQueue: штрихкод из выдачи', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('addFoodFromDB сохраняет barcode и foodId товара из сети', () => {
    const { result } = setup();

    act(() =>
      result.current.addFoodFromDB({
        id: '4600680251387',
        barcode: '4600680251387',
        name: 'Молоко отборное',
        kcal: 60,
        protein: 3,
        fat: 3,
        carbs: 4.7,
        category: 'dairy',
      }),
    );

    expect(result.current.parsedItems[0].barcode).toBe('4600680251387');
    expect(result.current.parsedItems[0].foodId).toBe('4600680251387');
  });

  it('id, который сам является GTIN, тоже становится штрихкодом', () => {
    const { result } = setup();

    act(() =>
      result.current.addFoodFromDB({
        id: '4600494400795',
        name: 'Овсянка, хлопья',
        kcal: 366,
        protein: 12.3,
        fat: 6.2,
        carbs: 61.8,
      }),
    );

    expect(result.current.parsedItems[0].barcode).toBe('4600494400795');
  });

  it('id продукта из FOOD_DB (не GTIN) не выдаётся за штрихкод', () => {
    const { result } = setup();

    act(() =>
      result.current.addFoodFromDB({
        id: 'rice',
        name: 'Рис',
        kcal: 130,
        protein: 3,
        fat: 1,
        carbs: 28,
      }),
    );

    expect(result.current.parsedItems[0].foodId).toBe('rice');
    expect(result.current.parsedItems[0].barcode).toBeUndefined();
  });

  it('прямое добавление в дневник пишет barcode рядом с foodId', () => {
    const { result, saveDiary } = setup();

    act(() =>
      result.current.handleDirectAdd(
        {
          id: '4600680251387',
          barcode: '4600680251387',
          name: 'Молоко отборное',
          kcal: 60,
          protein: 3,
          fat: 3,
          carbs: 4.7,
          category: 'dairy',
        },
        150,
      ),
    );

    const saved = saveDiary.mock.calls[0][0][DATE].meals[MEAL][0];
    expect(saved.barcode).toBe('4600680251387');
    expect(saved.foodId).toBe('4600680251387');
  });
});
