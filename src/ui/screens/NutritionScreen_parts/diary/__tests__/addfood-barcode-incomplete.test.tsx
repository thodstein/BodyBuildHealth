/**
 * addfood-barcode-incomplete.test.tsx — штрихкод в поле поиска идёт по общей
 * цепочке barcode-lookup.engine, а товар без КБЖУ — не «не найден»:
 * показываем его и предлагаем снять КБЖУ с упаковки.
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

// Движок цепочки подменяем: проверяем, что панель спрашивает именно его и
// честно обрабатывает флаг incomplete.
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

beforeEach(() => {
  localStorage.clear();
  lookupMock.lookupBarcode.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('Лист добавления: штрихкод в поиске', () => {
  it('ввод 13 цифр → lookupBarcode; товар без КБЖУ предлагает снять упаковку', async () => {
    lookupMock.lookupBarcode.mockResolvedValue({
      barcode: '4600494400795',
      hit: {
        product: {
          id: '4600494400795',
          barcode: '4600494400795',
          name: 'Овсянка Русская',
          kcal: 0,
          protein: 0,
          fat: 0,
          carbs: 0,
        },
        source: 'off',
        incomplete: true,
      },
      steps: [],
    });

    renderDiaryAdd();
    fireEvent.change(screen.getByLabelText('Поиск продуктов'), { target: { value: '4600494400795' } });

    await waitFor(() => expect(lookupMock.lookupBarcode).toHaveBeenCalledWith('4600494400795'));
    // Товар не пропал: название и честная подпись вместо «не найден».
    await waitFor(() => expect(document.querySelector('.nd-barcode-result')?.textContent).toContain('без КБЖУ'));
    expect(document.querySelector('.nd-barcode-result')?.textContent).toContain('Овсянка Русская');
    expect(screen.getByLabelText('Снять КБЖУ с упаковки')).toBeTruthy();
    // Штрихкод не теряется: ручной ввод открывает форму с этим кодом.
    fireEvent.click(screen.getByLabelText('Ввести КБЖУ вручную'));
    const barcodeInput = (await screen.findByLabelText('Штрихкод')) as HTMLInputElement;
    expect(barcodeInput.value).toBe('4600494400795');
  });

  it('штрихкод не найден → предлагаем создать свою еду с этим кодом', async () => {
    lookupMock.lookupBarcode.mockResolvedValue({ barcode: '4600000000001', hit: null, steps: [] });

    renderDiaryAdd();
    fireEvent.change(screen.getByLabelText('Поиск продуктов'), { target: { value: '4600000000001' } });

    await waitFor(() => expect(screen.getByLabelText('Создать свою еду по штрихкоду')).toBeTruthy());
    fireEvent.click(screen.getByLabelText('Создать свою еду по штрихкоду'));
    const barcodeInput = (await screen.findByLabelText('Штрихкод')) as HTMLInputElement;
    expect(barcodeInput.value).toBe('4600000000001');
  });
});
