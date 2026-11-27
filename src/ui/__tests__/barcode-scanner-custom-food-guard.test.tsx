/**
 * barcode-scanner-custom-food-guard.test.tsx — сканер не публикует выдуманные
 * КБЖУ в общую базу и не срабатывает дважды на один код.
 *
 * Раньше форма «Создать свою еду» имела дефолты 100/5/5/10 и сохраняла продукт
 * в общую базу по одному названию: корректные данные OFF уже не перезаписывали
 * такую запись (ignore-duplicates). Плюс на нативе возврат к стриму после quick-add
 * показывал ту же карточку, и второе нажатие добавляло ещё 100 г.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const html5Start = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('html5-qrcode', () => ({
  Html5Qrcode: class {
    start = html5Start;
    stop = vi.fn(async () => {});
    clear = vi.fn(async () => {});
    scanFile = vi.fn(async () => {
      throw new Error('no barcode');
    });
  },
}));

const engineMock = vi.hoisted(() => ({
  lookupBarcode: vi.fn(),
  saveSharedBarcode: vi.fn(async () => true),
  saveToCache: vi.fn(async () => undefined),
}));

vi.mock('../../engines/barcode-lookup.engine', () => ({
  lookupBarcode: engineMock.lookupBarcode,
  normalizeScannedBarcode: (raw: string) => (raw || '').replace(/\D/g, '').trim(),
  rememberScannedProduct: vi.fn(),
  customFoodToOFFProduct: (entry: any) => entry,
  retailToOFFProduct: (retail: any, barcode: string) => ({ ...retail, barcode }),
  isNutritionComplete: () => true,
}));

vi.mock('../../engines/food-barcode-catalog.engine', () => ({
  searchSharedBarcode: vi.fn(async () => null),
  saveSharedBarcode: engineMock.saveSharedBarcode,
}));

vi.mock('../../engines/openfoodfacts.engine', () => ({
  searchByBarcode: vi.fn(async () => null),
  searchByName: vi.fn(async () => []),
  saveToCache: engineMock.saveToCache,
}));

import { BarcodeScanner } from '../components/BarcodeScanner';

const oatHit = (barcode: string, name = 'Овсянка, хлопья') => ({
  barcode,
  hit: {
    product: {
      id: barcode,
      barcode,
      name,
      brand: 'Русский продукт',
      kcal: 366,
      protein: 12.3,
      fat: 6.2,
      carbs: 61.8,
    },
    source: 'off' as const,
    incomplete: false,
  },
  steps: [],
});

const typeAndFind = (code: string) => {
  fireEvent.change(screen.getByLabelText('Штрихкод'), { target: { value: code } });
  fireEvent.click(screen.getByText('Найти по штрихкоду'));
};

beforeEach(() => {
  localStorage.clear();
  engineMock.lookupBarcode.mockReset();
  engineMock.saveSharedBarcode.mockReset();
  engineMock.saveToCache.mockReset();
  html5Start.mockClear();
});

afterEach(() => {
  cleanup();
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
});

describe('Сканер: своя еда без КБЖУ', () => {
  it('одно название — кнопка «✓ Создать» недоступна, в общую базу ничего не уходит', async () => {
    engineMock.lookupBarcode.mockResolvedValue({ barcode: '4600494400795', hit: null, steps: [] });
    const onProductFound = vi.fn();
    render(<BarcodeScanner onProductFound={onProductFound} onClose={() => {}} />);

    typeAndFind('4600494400795');
    fireEvent.click(await screen.findByText('➕ Создать свою еду (оффлайн)'));
    fireEvent.change(screen.getByLabelText('Название продукта'), { target: { value: 'Йогурт 2%' } });

    const saveBtn = screen.getByText('✓ Создать') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
    fireEvent.click(saveBtn);
    expect(engineMock.saveSharedBarcode).not.toHaveBeenCalled();
    expect(engineMock.saveToCache).not.toHaveBeenCalled();
    expect(onProductFound).not.toHaveBeenCalled();

    // Указали калорийность — публикация в общую базу разрешена.
    fireEvent.change(screen.getByLabelText('Ккал'), { target: { value: '120' } });
    const enabled = screen.getByText('✓ Создать') as HTMLButtonElement;
    expect(enabled.disabled).toBe(false);
    fireEvent.click(enabled);
    await waitFor(() => expect(engineMock.saveSharedBarcode).toHaveBeenCalledTimes(1));
    expect(engineMock.saveSharedBarcode.mock.calls[0][0]).toMatchObject({
      barcode: '4600494400795',
      name: 'Йогурт 2%',
      kcal: 120,
    });
    // КБЖУ ввели руками → это найденный продукт, а не «не найдено»: карточка
    // с действиями, как у товара из OFF (в дневник без явного действия не уходит).
    await waitFor(() => expect(document.querySelector('.nd-scanfound')?.textContent).toContain('Йогурт 2%'));
    expect(onProductFound).not.toHaveBeenCalled();
    expect(engineMock.saveToCache).toHaveBeenCalledTimes(1);
  });
});

describe('Сканер: защита от двойного срабатывания', () => {
  it('«＋ 100 г в очередь» добавляет продукт один раз, пока не пришла новая карточка', async () => {
    engineMock.lookupBarcode.mockResolvedValue(oatHit('4600494400795'));
    const onQuickAdd = vi.fn();
    const { container } = render(
      <BarcodeScanner onProductFound={() => {}} onClose={() => {}} onQuickAdd={onQuickAdd} />,
    );

    typeAndFind('4600494400795');
    await waitFor(() => expect(container.querySelector('.nd-scanfound')).not.toBeNull());
    const quick = container.querySelector('.nd-scanquick') as HTMLButtonElement;
    act(() => {
      quick.click();
      quick.click();
    });
    expect(onQuickAdd).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.nd-scanadded')).not.toBeNull();
  });

  it('на нативе после quick-add возврат в ручной режим, html5-стрим не перезапускается', async () => {
    (window as unknown as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true };
    engineMock.lookupBarcode.mockResolvedValue(oatHit('4600494400795'));
    const onQuickAdd = vi.fn();
    const { container } = render(
      <BarcodeScanner onProductFound={() => {}} onClose={() => {}} onQuickAdd={onQuickAdd} />,
    );
    await waitFor(() => expect(html5Start).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByText('Штрихкод'));
    typeAndFind('4600494400795');
    await waitFor(() => expect(container.querySelector('.nd-scanfound')).not.toBeNull());
    fireEvent.click(container.querySelector('.nd-scanquick') as HTMLButtonElement);

    expect(onQuickAdd).toHaveBeenCalledTimes(1);
    // Тот же кадр больше не показывает карточку: поле очищено, стрим не стартовал.
    expect(container.querySelector('.nd-scanfound')).toBeNull();
    const input = screen.getByLabelText('Штрихкод') as HTMLInputElement;
    expect(input.value).toBe('');
    expect(html5Start).toHaveBeenCalledTimes(1);
  });
});
