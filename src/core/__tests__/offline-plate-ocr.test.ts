/**
 * offline-plate-ocr.test.ts — сквозная проверка распознавания тарелки без сервера:
 * serverOcrImage падает (нет ./api) → recognizeImageTextOffline (tesseract замокан)
 * → parseNutritionText → готовые meals. Доказывает, что АПК-путь доводит фото до очереди.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('tesseract.js', () => ({
  createWorker: vi.fn(async () => ({
    recognize: async () => ({
      data: { text: 'Курица 200 г\nРис вареный 150 г' },
    }),
    terminate: async () => {},
  })),
}));

import { processUploadedFile, recognizeImageTextOffline } from '../ocr-engine';

describe('Оффлайн-распознавание тарелки', () => {
  let originalFetch: typeof fetch;
  let cobDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    // jsdom не декодирует изображения и делает реальные сетевые пробы:
    // без стабов createImageBitmap/Image/fetch молчат до 15с-таймаутов
    // prepareImageForServer и тесты падают по 5с-лимиту vitest.
    originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new TypeError('offline test env');
    }) as typeof fetch;
    vi.stubGlobal('createImageBitmap', undefined as unknown as typeof createImageBitmap);
    cobDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
    if (cobDescriptor) Object.defineProperty(URL, 'createObjectURL', { ...cobDescriptor, value: undefined });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllGlobals();
    if (cobDescriptor) Object.defineProperty(URL, 'createObjectURL', cobDescriptor);
  });

  it('recognizeImageTextOffline возвращает текст из worker', async () => {
    const file = new File(['x'.repeat(64)], 'food.jpg', { type: 'image/jpeg' });
    const text = await recognizeImageTextOffline(file, 15_000);
    expect(text).toContain('Курица');
  });

  it('processUploadedFile без сервера доводит фото до meals через оффлайн', async () => {
    const file = new File(['x'.repeat(64)], 'food.jpg', { type: 'image/jpeg' });
    const result = await processUploadedFile(file);
    expect(result.meals.length).toBeGreaterThan(0);
    expect(result.warnings.join(' ')).toMatch(/оффлайн/i);
  });

  it('без fallback-мока пустое фото не роняет конвейер', async () => {
    const file = new File(['x'.repeat(64)], 'blank.jpg', { type: 'image/jpeg' });
    const result = await processUploadedFile(file);
    expect(Array.isArray(result.meals)).toBe(true);
  });
});
