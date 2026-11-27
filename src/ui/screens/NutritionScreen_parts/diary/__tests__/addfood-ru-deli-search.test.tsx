/**
 * addfood-ru-deli-search.test.tsx — «ветчина» в дневнике находит продукт с КБЖУ
 * без сети: каталог бытовой гастрономии (src/data/ru-deli-foods.ts) подключён
 * к локальному поиску AddFoodPanel, поэтому в АПК офлайн-поиск тоже не пустой.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('../../useNutritionDiary', () => ({
  useFrequentFoods: () => [],
  useRecentFoods: () => [],
}));

vi.mock('../../diary/hooks/useDiaryToast', () => ({
  useDiaryToast: () => ({
    toast: null,
    showToast: () => {},
    safeSet: (key: string, data: unknown) => {
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch {
        /* quota */
      }
    },
  }),
}));

// Сеть глушим: проверяем именно локальный каталог.
vi.mock('../../../../../engines/openfoodfacts.engine', () => ({
  searchByName: vi.fn(async () => []),
  searchByBarcode: vi.fn(async () => null),
  saveToCache: vi.fn(async () => undefined),
  productToFoodItem: (p: any) => p,
}));

vi.mock('../../../../../engines/retail-search.engine', () => ({
  RETAIL_CHAINS: {},
  RETAIL_RESULT_LIMIT: 24,
  retailToFoodItem: (p: any) => p,
  searchRetailProducts: vi.fn(async () => ({ items: [], available: false })),
}));

vi.mock('../../../../../engines/barcode-lookup.engine', () => ({
  lookupBarcode: vi.fn(async () => null),
  normalizeScannedBarcode: (raw: string) => (raw || '').replace(/\D/g, '').trim(),
  rememberScannedProduct: () => {},
  customFoodToOFFProduct: (entry: any) => entry,
  retailToOFFProduct: (retail: any, barcode: string) => ({ ...retail, barcode }),
  isNutritionComplete: () => false,
}));

import { NutritionDiary } from '../../NutritionDiary';

const renderDiaryAdd = () => {
  const utils = render(<NutritionDiary foodEntries={[]} />);
  fireEvent.click(screen.getByRole('tab', { name: /Добавить/ }));
  return utils;
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe('поиск бытовых названий в дневнике (офлайн-каталог)', () => {
  it('«ветчина» находит варёную ветчину с КБЖУ', async () => {
    renderDiaryAdd();
    const input = screen.getByLabelText('Поиск продуктов');
    fireEvent.change(input, { target: { value: 'ветчина' } });

    const hit = await screen.findByText('Ветчина варёная', undefined, { timeout: 4000 });
    expect(hit).toBeTruthy();
    // КБЖУ реальные (USDA FDC 173864): 164 ккал / 16.6 Б на 100 г — на карточке позиции.
    expect(document.body.textContent).toContain('164');
  }, 20000);
});
