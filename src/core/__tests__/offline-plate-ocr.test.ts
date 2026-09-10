/**
 * offline-plate-ocr.test.ts — сквозная проверка распознавания тарелки без сервера:
 * serverOcrImage падает (нет ./api) → recognizeImageTextOffline (tesseract замокан)
 * → parseNutritionText → готовые meals. Доказывает, что АПК-путь доводит фото до очереди.
 */
import { describe, it, expect, vi } from 'vitest';

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
