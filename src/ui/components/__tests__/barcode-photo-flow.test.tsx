/**
 * barcode-photo-flow.test.tsx — сквозной АПК-путь штрихкода:
 * «Снять камерой» → pickPhoto (замокан) → scanFile (замокан) → lookup OFF (замокан)
 * → onProductFound. Доказывает, что фото-декод доводит код до продукта.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';

vi.mock('../../../core/native-bridge', () => ({
  pickPhoto: vi.fn(async () => ({
    uri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    format: 'png',
  })),
}));

vi.mock('../../../engines/openfoodfacts.engine', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../../../engines/openfoodfacts.engine')>();
  return {
    ...orig,
    searchByBarcode: vi.fn(async (bc: string) => ({
      id: bc,
      barcode: bc,
      name: 'Тестовый йогурт',
      kcal: 60,
      protein: 3,
      fat: 2,
      carbs: 5,
    })),
  };
});

vi.mock('../../../engines/retail-search.engine', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../../../engines/retail-search.engine')>();
  return { ...orig, searchRetailProductByBarcode: vi.fn(async () => null) };
});

import { Html5Qrcode } from 'html5-qrcode';
import { BarcodeScanner } from '../BarcodeScanner';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
});

describe('Фото-путь штрихкода (АПК)', () => {
  it('фото доводит код до onProductFound', async () => {
    (window as unknown as { Capacitor?: unknown }).Capacitor = {
      isNativePlatform: () => true,
    };
    const scanSpy = vi
      .spyOn(Html5Qrcode.prototype, 'scanFile')
      .mockResolvedValue('4601234567890' as never);
    const found: unknown[] = [];
    const { container } = render(
      <BarcodeScanner onProductFound={(p) => found.push(p)} onClose={() => {}} />,
    );
    const camera = Array.from(container.querySelectorAll('.nd-scanmode')).find(
      (b) => b.textContent === 'Камера',
    ) as HTMLElement;
    fireEvent.click(camera);
    const photo = container.querySelector('.nd-scanphoto') as HTMLElement;
    expect(photo).not.toBeNull();
    fireEvent.click(photo);
    await waitFor(
      () => {
        expect(scanSpy).toHaveBeenCalled();
        expect(found.length).toBe(1);
      },
      { timeout: 8000 },
    );
    expect((found[0] as { name: string }).name).toBe('Тестовый йогурт');
  });
});
