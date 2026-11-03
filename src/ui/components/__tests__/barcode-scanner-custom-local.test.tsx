/**
 * barcode-scanner-custom-local.test.tsx — сканер находит продукт, который
 * сохранили с фото упаковки, даже без Open Food Facts и без Supabase.
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';

vi.mock('html5-qrcode', () => ({
  Html5Qrcode: class {
    start = vi.fn(async () => {});
    stop = vi.fn(async () => {});
    clear = vi.fn(async () => {});
    scanFile = vi.fn(async () => { throw new Error('no barcode'); });
  },
}));

vi.mock('../../../engines/openfoodfacts.engine', () => ({
  searchByBarcode: vi.fn(async () => null),
  searchByName: vi.fn(async () => []),
  saveToCache: vi.fn(async () => undefined),
}));

vi.mock('../../../engines/food-barcode-catalog.engine', () => ({
  searchSharedBarcode: vi.fn(async () => null),
  saveSharedBarcode: vi.fn(async () => true),
}));

vi.mock('../../../engines/retail-search.engine', () => ({
  searchRetailProductByBarcode: vi.fn(async () => null),
  guessRetailCategory: () => 'other',
}));

import { BarcodeScanner } from '../BarcodeScanner';
import { saveCustomFood } from '../../../engines/meal-custom-food';
import { searchByBarcode } from '../../../engines/openfoodfacts.engine';

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('Сканер штрихкодов: локальные продукты с упаковки', () => {
  it('находит сохранённый по фото продукт до запроса в сеть', async () => {
    saveCustomFood({
      id: 'custom_label_1', name: 'Творог с упаковки', kcal: 121, protein: 16, fat: 5, carbs: 3,
      fiber: 0, category: 'dairy', servingSize: '100 г', barcode: '4601234567890', source: 'label_photo',
    });
    const found: Array<{ name: string }> = [];
    const { getByLabelText, getByText } = render(<BarcodeScanner onProductFound={p => found.push(p)} onClose={() => {}} />);
    fireEvent.change(getByLabelText('Штрихкод'), { target: { value: '4601234567890' } });
    fireEvent.click(getByText('Найти по штрихкоду'));
    await waitFor(() => expect(found).toHaveLength(1));
    expect(found[0].name).toBe('Творог с упаковки');
    expect(searchByBarcode).not.toHaveBeenCalled();
  });
});
