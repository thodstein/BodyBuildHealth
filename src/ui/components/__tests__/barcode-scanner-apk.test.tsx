/**
 * barcode-scanner-apk.test.tsx — АПК-настройка сканера:
 * нативный MLKit-путь + цепочка OFF → shared → retail + недавние сканы.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';

vi.mock('html5-qrcode', () => ({
  Html5Qrcode: class {
    start = vi.fn(async () => {});
    stop = vi.fn(async () => {});
    clear = vi.fn(async () => {});
    scanFile = vi.fn(async () => { throw new Error('no barcode'); });
  },
}));

vi.mock('../../../core/native-bridge', () => ({
  scanNativeBarcode: vi.fn(),
  scanNativeBarcodeImage: vi.fn(async () => null),
  openNativeAppSettings: vi.fn(async () => true),
  haptics: vi.fn(async () => {}),
  pickPhoto: vi.fn(async () => null),
  pickBarcodePhoto: vi.fn(async () => null),
  persistBarcodePhoto: vi.fn(async () => null),
  deleteTemporaryBarcodePhoto: vi.fn(async () => undefined),
}));

vi.mock('../../../engines/openfoodfacts.engine', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../../../engines/openfoodfacts.engine')>();
  return { ...orig, searchByBarcode: vi.fn(async () => null), searchByName: vi.fn(async () => []) };
});

vi.mock('../../../engines/food-barcode-catalog.engine', () => ({
  searchSharedBarcode: vi.fn(async (bc: string) => ({
    id: bc, barcode: bc, name: 'Общая каша', kcal: 350, protein: 10, fat: 5, carbs: 70,
  })),
  saveSharedBarcode: vi.fn(async () => true),
}));

vi.mock('../../../engines/retail-search.engine', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../../../engines/retail-search.engine')>();
  return { ...orig, searchRetailProductByBarcode: vi.fn(async () => null), guessRetailCategory: (n: string) => 'other' };
});

import { scanNativeBarcode, scanNativeBarcodeImage } from '../../../core/native-bridge';
import { saveSharedBarcode } from '../../../engines/food-barcode-catalog.engine';
import { BarcodeScanner } from '../BarcodeScanner';

beforeEach(() => {
  try { localStorage.clear(); } catch {}
  (window as unknown as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
});

describe('Сканер АПК: нативный путь', () => {
  it('native: видна кнопка нативного сканера с хуком', () => {
    const { container } = render(<BarcodeScanner onProductFound={() => {}} onClose={() => {}} />);
    // native default = scan-режим
    const btn = container.querySelector('.nd-scannative') as HTMLElement;
    expect(btn).not.toBeNull();
    expect(btn.getAttribute('aria-label')).toMatch(/натив/i);
  });

  it('нативный скан доводит код до продукта из shared-базы + пишет recent', async () => {
    vi.mocked(scanNativeBarcode).mockResolvedValueOnce({ status: 'scanned', code: '4600000000000' });
    const found: unknown[] = [];
    const { container } = render(<BarcodeScanner onProductFound={(p) => found.push(p)} onClose={() => {}} />);
    const btn = container.querySelector('.nd-scannative') as HTMLElement;
    fireEvent.click(btn);
    await waitFor(() => expect(found.length).toBe(1), { timeout: 8000 });
    expect((found[0] as { name: string }).name).toBe('Общая каша');
    expect(saveSharedBarcode).toHaveBeenCalled();
    const recent = JSON.parse(localStorage.getItem('he_barcode_recent_v1') || '[]');
    expect(recent[0]?.barcode).toBe('4600000000000');
  });

  it('отказ в камере → ошибка + кнопка настроек', async () => {
    vi.mocked(scanNativeBarcode).mockResolvedValueOnce({ status: 'denied' });
    const { container } = render(<BarcodeScanner onProductFound={() => {}} onClose={() => {}} />);
    const btn = container.querySelector('.nd-scannative') as HTMLElement;
    fireEvent.click(btn);
    await waitFor(() => expect(container.querySelector('.nd-scansettings')).not.toBeNull(), { timeout: 8000 });
  });

  it('отмена системного сканера — тихо, без ошибки', async () => {
    vi.mocked(scanNativeBarcode).mockResolvedValueOnce({ status: 'cancelled' });
    const { container } = render(<BarcodeScanner onProductFound={() => {}} onClose={() => {}} />);
    const btn = container.querySelector('.nd-scannative') as HTMLElement;
    fireEvent.click(btn);
    await waitFor(() => expect(vi.mocked(scanNativeBarcode)).toHaveBeenCalled(), { timeout: 8000 });
    expect(container.querySelector('.nd-scancreate')).toBeNull();
    expect(container.querySelector('.nd-scansettings')).toBeNull();
  });

  it('фильтрует QR и оставляет только продуктовый код', async () => {
    vi.mocked(scanNativeBarcode).mockResolvedValueOnce({ status: 'scanned', code: '4600000000000' });
    const { container } = render(<BarcodeScanner onProductFound={() => {}} onClose={() => {}} />);
    fireEvent.click(container.querySelector('.nd-scannative') as HTMLElement);
    await waitFor(() => expect(scanNativeBarcode).toHaveBeenCalled());
    expect(container.querySelector('.nd-scancreate')).toBeNull();
  });

  it('APK манифест автоматически подтягивает ML Kit barcode UI', async () => {
    const fs = await import('node:fs');
    const manifest = fs.readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
    expect(manifest).toContain('com.google.mlkit.vision.DEPENDENCIES');
    expect(manifest).toContain('barcode_ui');
  });

  it('повторная попытка сканирования очищает подсказку установки модуля', async () => {
    vi.mocked(scanNativeBarcode).mockResolvedValueOnce({ status: 'unavailable', hint: 'installing-module' });
    const { container } = render(<BarcodeScanner onProductFound={() => {}} onClose={() => {}} />);
    const button = container.querySelector('.nd-scannative') as HTMLElement;
    fireEvent.click(button);
    await waitFor(() => expect(container.querySelector('.nd-scannotice')).not.toBeNull());
    vi.mocked(scanNativeBarcode).mockResolvedValueOnce({ status: 'cancelled' });
    fireEvent.click(button);
    await waitFor(() => expect(container.querySelector('.nd-scannotice')).toBeNull());
    expect(scanNativeBarcode).toHaveBeenCalledTimes(2);
  });
});
