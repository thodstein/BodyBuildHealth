import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomFoodEntry } from '../meal-custom-food';
import {
  CUSTOM_FOODS_CHANGED_EVENT,
  customFoodToFoodItem,
  deleteCustomFood,
  findCustomFoodByBarcode,
  loadCustomFoods,
  saveCustomFood,
  saveOrUpdateCustomFood,
} from '../meal-custom-food';

function entry(overrides: Partial<CustomFoodEntry> = {}): CustomFoodEntry {
  return {
    id: 'custom_label_1',
    name: 'Йогурт 2%',
    kcal: 60,
    protein: 3,
    fat: 2,
    carbs: 5,
    fiber: 0,
    category: 'dairy',
    servingSize: '100 г',
    ...overrides,
  };
}

describe('meal-custom-food: своя база продуктов', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('сохраняет и находит продукт по штрихкоду', () => {
    saveCustomFood(entry({ barcode: '4600000000000' }));
    expect(loadCustomFoods()).toHaveLength(1);
    expect(findCustomFoodByBarcode('4600000000000')?.name).toBe('Йогурт 2%');
  });

  it('сравнивает штрихкод с ведущим нулём и без него', () => {
    saveCustomFood(entry({ barcode: '0460000000000' }));
    expect(findCustomFoodByBarcode('460000000000')?.name).toBe('Йогурт 2%');
  });

  it('не плодит дубли при повторном сохранении того же штрихкода', () => {
    const first = saveOrUpdateCustomFood(entry({ barcode: '4600000000000' }));
    const second = saveOrUpdateCustomFood(entry({ id: 'another', name: 'Йогурт обновлённый', kcal: 62, barcode: '4600000000000' }));
    expect(second.id).toBe(first.id);
    expect(loadCustomFoods()).toHaveLength(1);
    expect(loadCustomFoods()[0]).toMatchObject({ id: first.id, name: 'Йогурт обновлённый', kcal: 62 });
  });

  it('обновляет продукт с фото без штрихкода по названию', () => {
    const first = saveOrUpdateCustomFood(entry());
    const second = saveOrUpdateCustomFood(entry({ id: 'new_photo', kcal: 65 }));
    expect(second.id).toBe(first.id);
    expect(loadCustomFoods()).toHaveLength(1);
    expect(loadCustomFoods()[0].kcal).toBe(65);
  });

  it('не сливает два товара с одинаковым названием, но разными штрихкодами', () => {
    saveOrUpdateCustomFood(entry({ barcode: '4600000000000' }));
    saveOrUpdateCustomFood(entry({ id: 'other', kcal: 99, barcode: '4600000000001' }));
    // Раньше второй товар затирал первый, и сканер отдавал чужое КБЖУ.
    expect(loadCustomFoods()).toHaveLength(2);
    expect(findCustomFoodByBarcode('4600000000000')?.kcal).toBe(60);
    expect(findCustomFoodByBarcode('4600000000001')?.kcal).toBe(99);
  });

  it('снимок без штрихкода не стирает уже известный штрихкод', () => {
    saveOrUpdateCustomFood(entry({ barcode: '4600000000000' }));
    const merged = saveOrUpdateCustomFood(entry({ id: 'photo', kcal: 65 }));
    expect(merged.barcode).toBe('4600000000000');
    expect(findCustomFoodByBarcode('4600000000000')?.kcal).toBe(65);
  });

  it('не сливает безымянные «Продукт с упаковки» в одну запись', () => {
    saveOrUpdateCustomFood(entry({ name: 'Продукт с упаковки', barcode: '4600000000000' }));
    saveOrUpdateCustomFood(entry({ id: 'second', name: 'Продукт с упаковки', barcode: '4600000000001' }));
    expect(loadCustomFoods()).toHaveLength(2);
  });

  it('отдаёт FoodItem для поиска в дневнике', () => {
    const food = customFoodToFoodItem(entry({ sodium_mg: 40, barcode: '460' }));
    expect(food).toMatchObject({ id: 'custom_label_1', name: 'Йогурт 2%', kcal: 60, protein: 3, fat: 2, carbs: 5, category: 'dairy', servingSize: '100 г' });
    expect(food.micros?.Na).toBe(40);
  });

  it('уведомляет поиск об изменении базы', () => {
    const handler = vi.fn();
    window.addEventListener(CUSTOM_FOODS_CHANGED_EVENT, handler);
    saveCustomFood(entry());
    expect(handler).toHaveBeenCalled();
    window.removeEventListener(CUSTOM_FOODS_CHANGED_EVENT, handler);
  });

  it('удаляет продукт', () => {
    saveCustomFood(entry());
    deleteCustomFood('custom_label_1');
    expect(loadCustomFoods()).toHaveLength(0);
  });
});
