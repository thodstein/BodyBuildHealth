/**
 * barcode-photo-flow.test.tsx — сквозной АПК-путь штрихкода:
 * «Снять камерой» → pickPhoto (замокан) → scanFile (замокан) → lookup OFF (замокан)
 * → onProductFound. Доказывает, что фото-декод доводит код до продукта.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';

vi.mock('../../../core/native-bridge', () => ({
  pickPhoto: vi.fn(async () => ({
    uri: 'file:///temporary/food-label.jpg',
    format: 'png',
  })),
  pickBarcodePhoto: vi.fn(async () => ({ uri: 'file:///temporary/food-label.jpg', nativePath: 'file:///temporary/food-label.jpg', format: 'jpg' })),
  scanNativeBarcodeImage: vi.fn(async () => null),
  persistBarcodePhoto: vi.fn(async () => 'file:///temporary/food-label.jpg'),
  deleteTemporaryBarcodePhoto: vi.fn(async () => undefined),
}));

vi.mock('../../../engines/openfoodfacts.engine', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../../../engines/openfoodfacts.engine')>();
  return {
    ...orig,
    searchByBarcode: vi.fn(async (bc: string) => bc === '4601234567890' ? ({
      id: bc, barcode: bc, name: 'Тестовый йогурт', kcal: 60, protein: 3, fat: 2, carbs: 5,
    }) : null),
  };
});

vi.mock('../../../engines/retail-search.engine', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../../../engines/retail-search.engine')>();
  return { ...orig, searchRetailProductByBarcode: vi.fn(async () => null) };
});

import { pickBarcodePhoto, scanNativeBarcodeImage } from '../../../core/native-bridge';
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
    vi.mocked(scanNativeBarcodeImage).mockResolvedValueOnce('4601234567890');
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
        expect(scanNativeBarcodeImage).toHaveBeenCalled();
        expect(found.length).toBe(1);
      },
      { timeout: 8000 },
    );
    expect((found[0] as { name: string }).name).toBe('Тестовый йогурт');
  });

  it('использует native ML Kit для file:// image и не декодирует через WebView', async () => {
    (window as unknown as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true };
    vi.mocked(pickBarcodePhoto).mockResolvedValueOnce({ uri: 'content://food/label.jpg', nativePath: 'content://food/label.jpg', format: 'jpeg' });
    vi.mocked(scanNativeBarcodeImage).mockResolvedValueOnce('4601234567890');
    const found: unknown[] = [];
    const { container } = render(<BarcodeScanner onProductFound={p => found.push(p)} onClose={() => {}} />);
    fireEvent.click(Array.from(container.querySelectorAll('.nd-scanmode')).find(b => b.textContent === 'Камера') as HTMLElement);
    fireEvent.click(container.querySelector('.nd-scanphoto') as HTMLElement);
    await waitFor(() => expect(found).toHaveLength(1));
    expect(scanNativeBarcodeImage).toHaveBeenCalledWith('content://food/label.jpg');
    expect(scanNativeBarcodeImage).toHaveBeenCalledTimes(1);
  });
});
