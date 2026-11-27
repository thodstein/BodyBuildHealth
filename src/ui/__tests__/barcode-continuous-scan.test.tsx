/**
 * barcode-continuous-scan.test.tsx — непрерывное сканирование.
 *
 * Жалоба «неудобно добавлять второй товар»: раньше найденный продукт сразу
 * уводился в дневник и модалка закрывалась. Теперь найденное — карточка с
 * действиями, «＋ 100 г в очередь» пишет продукт в очередь и оставляет сканер
 * открытым, чтобы сразу навести следующий штрихкод.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('html5-qrcode', () => ({
  Html5Qrcode: class {
    start = vi.fn(async () => {});
    stop = vi.fn(async () => {});
    clear = vi.fn(async () => {});
    scanFile = vi.fn(async () => {
      throw new Error('no barcode');
    });
  },
}));

vi.mock('../../engines/barcode-lookup.engine', () => ({
  lookupBarcode: vi.fn(),
  normalizeScannedBarcode: (raw: string) => (raw || '').replace(/\D/g, '').trim(),
  rememberScannedProduct: vi.fn(),
  customFoodToOFFProduct: (entry: any) => entry,
  retailToOFFProduct: (retail: any, barcode: string) => ({ ...retail, barcode }),
  isNutritionComplete: () => true,
}));

import { BarcodeScanner } from '../components/BarcodeScanner';
import { lookupBarcode, rememberScannedProduct } from '../../engines/barcode-lookup.engine';

const oatHit = (barcode: string, name: string) => ({
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
      fiber: 8,
      servingSize: '100 г',
      cachedAt: Date.now(),
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
  vi.mocked(lookupBarcode).mockReset();
  vi.mocked(rememberScannedProduct).mockReset();
});

afterEach(() => {
  cleanup();
});

describe('Сканер: непрерывное сканирование', () => {
  it('найденное показывается карточкой, «＋ 100 г в очередь» не закрывает сканер', async () => {
    vi.mocked(lookupBarcode)
      .mockResolvedValueOnce(oatHit('4600494400795', 'Овсянка, хлопья') as any)
      .mockResolvedValueOnce(oatHit('4600494400796', 'Гречка, ядрица') as any);

    const onProductFound = vi.fn();
    const onQuickAdd = vi.fn();
    const onClose = vi.fn();
    const { container } = render(
      <BarcodeScanner onProductFound={onProductFound} onClose={onClose} onQuickAdd={onQuickAdd} />,
    );

    typeAndFind('4600494400795');
    await waitFor(() => expect(container.querySelector('.nd-scanfound')?.textContent).toContain('Овсянка'));
    // Мгновенного ухода в дневник больше нет: выбор действия — за пользователем.
    expect(onProductFound).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(vi.mocked(rememberScannedProduct)).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText('Добавить Овсянка, хлопья, 100 грамм в очередь'));
    expect(onQuickAdd).toHaveBeenCalledTimes(1);
    expect((onQuickAdd.mock.calls[0][0] as { name: string }).name).toBe('Овсянка, хлопья');
    // Модалка жива, карточка сменилась подсказкой «наведите следующий».
    expect(screen.getByRole('dialog', { name: 'Сканировать продукт' })).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    expect(container.querySelector('.nd-scanfound')).toBeNull();
    expect(container.querySelector('.nd-scanadded')?.textContent).toContain('Овсянка');

    // И сразу можно пробить второй код — без повторного входа в сканер.
    typeAndFind('4600494400796');
    await waitFor(() => expect(container.querySelector('.nd-scanfound')?.textContent).toContain('Гречка'));
    expect(vi.mocked(lookupBarcode)).toHaveBeenCalledTimes(2);
  });

  it('«Указать вес…» отдаёт продукт родителю как раньше', async () => {
    vi.mocked(lookupBarcode).mockResolvedValueOnce(oatHit('4600494400795', 'Овсянка, хлопья') as any);
    const onProductFound = vi.fn();
    const { container } = render(
      <BarcodeScanner onProductFound={onProductFound} onClose={() => {}} onQuickAdd={() => {}} />,
    );

    typeAndFind('4600494400795');
    await waitFor(() => expect(container.querySelector('.nd-scanportion')).not.toBeNull());
    fireEvent.click(screen.getByLabelText('Указать вес продукта'));
    expect(onProductFound).toHaveBeenCalledTimes(1);
    expect((onProductFound.mock.calls[0][0] as { name: string }).name).toBe('Овсянка, хлопья');
  });

  it('товар без КБЖУ: «нет КБЖУ» + кнопка снять этикетку, в дневник ничего не уходит', async () => {
    vi.mocked(lookupBarcode).mockResolvedValueOnce({
      barcode: '4600000000001',
      hit: {
        product: {
          id: '4600000000001',
          barcode: '4600000000001',
          name: 'Вода питьевая',
          kcal: 0,
          protein: 0,
          fat: 0,
          carbs: 0,
        },
        source: 'shared' as const,
        incomplete: true,
      },
      steps: [],
    } as any);
    const onProductFound = vi.fn();
    const onLabelScan = vi.fn();
    const onQuickAdd = vi.fn();
    const { container } = render(
      <BarcodeScanner
        onProductFound={onProductFound}
        onClose={() => {}}
        onQuickAdd={onQuickAdd}
        onLabelScan={onLabelScan}
      />,
    );

    typeAndFind('4600000000001');
    await waitFor(() => expect(container.querySelector('.nd-scancreate')).not.toBeNull());
    expect(container.textContent).toMatch(/нет КБЖУ/i);
    expect(container.textContent).toContain('Вода питьевая');
    expect(onProductFound).not.toHaveBeenCalled();
    // В дневник и в очередь ничего не ушло: сначала КБЖУ.
    expect(onQuickAdd).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('Распознать КБЖУ с фото упаковки'));
    expect(onLabelScan).toHaveBeenCalledTimes(1);
  });

  it('порция из карточки: 60 г уходят вместе с продуктом, а не «молчаливые 100»', async () => {
    vi.mocked(lookupBarcode).mockResolvedValueOnce(oatHit('4600494400795', 'Овсянка, хлопья') as any);
    const onProductFound = vi.fn();
    const onQuickAdd = vi.fn();
    const { container } = render(
      <BarcodeScanner onProductFound={onProductFound} onClose={() => {}} onQuickAdd={onQuickAdd} />,
    );

    typeAndFind('4600494400795');
    await waitFor(() => expect(container.querySelector('.nd-scangrams')).not.toBeNull());
    fireEvent.change(screen.getByLabelText('Граммы порции'), { target: { value: '60' } });
    fireEvent.click(screen.getByLabelText('Добавить Овсянка, хлопья, 60 грамм в очередь'));

    expect(onQuickAdd).toHaveBeenCalledTimes(1);
    expect((onQuickAdd.mock.calls[0][0] as { name: string }).name).toBe('Овсянка, хлопья');
    expect(onQuickAdd.mock.calls[0][1]).toBe(60);
    expect(container.querySelector('.nd-scanadded')?.textContent).toContain('60 г');
    // Без своего sheet'а «Указать вес…» тоже отдаёт порцию, а не 100 г.
    expect(onProductFound).not.toHaveBeenCalled();
  });

  it('9 цифр — не GTIN: в сеть не идём и сразу говорим, что код битый', () => {
    const { container } = render(<BarcodeScanner onProductFound={vi.fn()} onClose={() => {}} />);

    typeAndFind('460049440');

    expect(vi.mocked(lookupBarcode)).not.toHaveBeenCalled();
    expect(container.textContent).toMatch(/8, 12, 13 или 14 цифр/);
  });
});
