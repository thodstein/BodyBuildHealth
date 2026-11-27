/**
 * barcode-lookup.engine.test.ts — замки единой цепочки «штрихкод → продукт».
 *
 * Главное: поиск руками и сканер должны идти ОДНИМ путём (свои продукты → OFF →
 * общая база → каталоги сетей), а продукт без КБЖУ должен возвращаться с флагом
 * `incomplete`, а не исчезать под видом «не найдено».
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const searchByBarcode = vi.fn();
const saveToCache = vi.fn(async () => undefined);
const searchSharedBarcode = vi.fn();
const saveSharedBarcode = vi.fn(async () => true);
const searchRetailProductByBarcode = vi.fn();
const findCustomFoodByBarcode = vi.fn();

vi.mock('../openfoodfacts.engine', () => ({
  searchByBarcode: (...args: unknown[]) => searchByBarcode(...args),
  saveToCache: (...args: unknown[]) => saveToCache(...args),
}));

vi.mock('../food-barcode-catalog.engine', () => ({
  searchSharedBarcode: (...args: unknown[]) => searchSharedBarcode(...args),
  saveSharedBarcode: (...args: unknown[]) => saveSharedBarcode(...args),
}));

vi.mock('../retail-search.engine', () => ({
  searchRetailProductByBarcode: (...args: unknown[]) => searchRetailProductByBarcode(...args),
  guessRetailCategory: (name: string) => (/рис/i.test(name) ? 'carb' : 'other'),
}));

vi.mock('../meal-custom-food', () => ({
  findCustomFoodByBarcode: (...args: unknown[]) => findCustomFoodByBarcode(...args),
}));

import {
  isNutritionComplete,
  lookupBarcode,
  normalizeScannedBarcode,
  rememberScannedProduct,
} from '../barcode-lookup.engine';

const offProduct = (over: Record<string, unknown> = {}) => ({
  id: '4600680251387',
  barcode: '4600680251387',
  name: 'Овсянка по-новому',
  kcal: 370,
  protein: 11,
  fat: 6.2,
  carbs: 63,
  fiber: 8,
  servingSize: '100 г',
  cachedAt: Date.now(),
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  findCustomFoodByBarcode.mockReturnValue(null);
  searchByBarcode.mockResolvedValue(null);
  searchSharedBarcode.mockResolvedValue(null);
  searchRetailProductByBarcode.mockResolvedValue(null);
});

describe('normalizeScannedBarcode / isNutritionComplete', () => {
  it('код чистится от нецифр и пробелов', () => {
    expect(normalizeScannedBarcode(' 4600 6802-51387 ')).toBe('4600680251387');
    expect(normalizeScannedBarcode('abc')).toBe('');
  });

  it('продукт с одними макросами (ккал=0) считается полным — не выбрасываем', () => {
    expect(isNutritionComplete({ kcal: 0, protein: 0, fat: 0, carbs: 12 })).toBe(true);
  });

  it('пустые КБЖУ — это неполный продукт', () => {
    expect(isNutritionComplete({ kcal: 0, protein: 0, fat: 0, carbs: 0 })).toBe(false);
    expect(isNutritionComplete({})).toBe(false);
  });
});

describe('lookupBarcode: порядок источников', () => {
  it('свой продукт важнее сети и не ходит в OFF', async () => {
    findCustomFoodByBarcode.mockReturnValue({
      id: 'custom-1',
      name: 'Мой творог',
      barcode: '4600680251387',
      kcal: 120,
      protein: 16,
      fat: 5,
      carbs: 3,
      fiber: 0,
      servingSize: '180 г',
    });
    const result = await lookupBarcode('4600680251387');
    expect(result.hit?.source).toBe('custom');
    expect(result.hit?.product.name).toBe('Мой творог');
    expect(searchByBarcode).not.toHaveBeenCalled();
  });

  it('нет в своих — берём OFF (кэш пишет сам движок, второй раз не дублируем)', async () => {
    searchByBarcode.mockResolvedValue(offProduct());
    const steps: string[] = [];
    const result = await lookupBarcode('4600680251387', { onStep: (s) => steps.push(s) });
    expect(result.hit?.source).toBe('off');
    expect(result.hit?.incomplete).toBe(false);
    expect(saveToCache).not.toHaveBeenCalled();
    expect(steps[0]).toContain('свои продукты');
  });

  it('продукт из OFF без КБЖУ возвращается с incomplete, а не «не найден»', async () => {
    searchByBarcode.mockResolvedValue(offProduct({ kcal: 0, protein: 0, fat: 0, carbs: 0 }));
    const result = await lookupBarcode('4610009511207');
    expect(result.hit?.product.name).toBe('Овсянка по-новому');
    expect(result.hit?.incomplete).toBe(true);
  });

  it('OFF молчит — ищем в общей базе, затем в каталоге сети', async () => {
    searchSharedBarcode.mockResolvedValue(null);
    searchRetailProductByBarcode.mockResolvedValue({
      name: 'Рис отварной',
      brand: 'ВкусВилл',
      kcal: 116,
      protein: 2.2,
      fat: 0.5,
      carbs: 25,
    });
    const result = await lookupBarcode('4607016245515');
    expect(result.hit?.source).toBe('retail');
    expect(result.hit?.product.kcal).toBe(116);
    expect(result.hit?.product.brand).toBe('ВкусВилл');
  });

  it('короче EAN-8 — не ищем вовсе и не тратим сеть', async () => {
    const result = await lookupBarcode('12345');
    expect(result.hit).toBeNull();
    expect(searchByBarcode).not.toHaveBeenCalled();
  });

  it('пустой ввод не роняет цепочку', async () => {
    const result = await lookupBarcode('');
    expect(result.barcode).toBe('');
    expect(result.hit).toBeNull();
  });
});

describe('rememberScannedProduct', () => {
  it('в общую базу уходит только полный продукт со штрихкодом', () => {
    rememberScannedProduct(offProduct() as never);
    expect(saveSharedBarcode).toHaveBeenCalledTimes(1);

    saveSharedBarcode.mockClear();
    rememberScannedProduct(offProduct({ kcal: 0, protein: 0, fat: 0, carbs: 0 }) as never);
    expect(saveSharedBarcode).not.toHaveBeenCalled();

    rememberScannedProduct(offProduct({ barcode: '' }) as never);
    expect(saveSharedBarcode).not.toHaveBeenCalled();
  });
});
