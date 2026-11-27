/**
 * addfood-barcode-typing.test.tsx — штрихкод, набранный руками, не должен
 * запускать полную сетевую цепочку на каждой паузе.
 *
 * Дебаунс поиска (250 мс) отдаёт 8,9,10,…,14 цифр по мере набора: раньше каждая
 * длина запускала свой lookupBarcode (OFF ru → world → shared → сети), и OFF
 * отвечал 429/503. Ищем только на реальных длинах GTIN и не повторяем тот же код.
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

const lookupMock = vi.hoisted(() => ({ lookupBarcode: vi.fn() }));
vi.mock('../../../../../engines/barcode-lookup.engine', () => ({
  lookupBarcode: lookupMock.lookupBarcode,
  normalizeScannedBarcode: (raw: string) => (raw || '').replace(/\D/g, '').trim(),
  rememberScannedProduct: () => {},
  customFoodToOFFProduct: (entry: any) => entry,
  retailToOFFProduct: (retail: any, barcode: string) => ({ ...retail, barcode }),
  isNutritionComplete: () => true,
}));

import { NutritionDiary } from '../../NutritionDiary';

const renderDiaryAdd = () => {
  const utils = render(<NutritionDiary foodEntries={[]} />);
  fireEvent.click(screen.getByRole('tab', { name: 'Добавить' }));
  return utils;
};

const oatHit = (barcode: string) => ({
  barcode,
  hit: {
    product: {
      id: barcode,
      barcode,
      name: 'Овсянка Русская',
      kcal: 366,
      protein: 12.3,
      fat: 6.2,
      carbs: 61.8,
    },
    source: 'off',
    incomplete: false,
  },
  steps: [],
});

beforeEach(() => {
  localStorage.clear();
  lookupMock.lookupBarcode.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('Лист добавления: штрихкод, набранный руками', () => {
  it('9 цифр сеть не трогают, 13 цифр — ровно один запрос, повтор кода — без запроса', async () => {
    lookupMock.lookupBarcode.mockResolvedValue(oatHit('4600494400795'));
    renderDiaryAdd();
    const input = screen.getByLabelText('Поиск продуктов');

    // 9 — не длина GTIN: подсказка есть, сети нет.
    fireEvent.change(input, { target: { value: '460049440' } });
    await waitFor(() => expect(document.querySelector('.nd-barcode-hint')?.textContent).toContain('8–14 цифр'));
    expect(lookupMock.lookupBarcode).not.toHaveBeenCalled();

    // 13 (EAN-13) — одна цепочка на весь код.
    fireEvent.change(input, { target: { value: '4600494400795' } });
    await waitFor(() => expect(lookupMock.lookupBarcode).toHaveBeenCalledTimes(1));
    expect(lookupMock.lookupBarcode).toHaveBeenCalledWith('4600494400795');
    await waitFor(() => expect(document.querySelector('.nd-barcode-result')?.textContent).toContain('Овсянка Русская'));

    // Очистили и ввели тот же код заново — уже искомый код сеть не дёргает.
    fireEvent.change(input, { target: { value: '' } });
    await waitFor(() => expect(document.querySelector('.nd-barcode-result')).toBeNull());
    fireEvent.change(input, { target: { value: '4600494400795' } });
    await waitFor(() => expect(document.querySelector('.nd-barcode-result')?.textContent).toContain('Овсянка Русская'));
    expect(lookupMock.lookupBarcode).toHaveBeenCalledTimes(1);
  });
});
