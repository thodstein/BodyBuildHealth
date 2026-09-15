/**
 * lab-apk-offline.test.ts — АПК-путь "фото бланка → лабы" без сервера.
 * Guard под репорт "распознаватель анализов в АПК не работает" (Sep 2026):
 * серверных ./api/* в нативном WebView нет, весь путь идёт через
 * recognizeImageTextOffline (tesseract замокан) → parseLabTextAllWays.
 * Доказывает, что фото доводится до списка labs, а не до пустого результата.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('tesseract.js', () => ({
  createWorker: vi.fn(async () => ({
    recognize: async () => ({
      data: {
        text: 'ИНВИТРО\nАЛТ 35 Е/л 0-41\nГлюкоза 5,4 ммоль/л 3,9-5,5\nКреатинин 92 мкмоль/л 62-106',
      },
    }),
    terminate: async () => {},
  })),
}));

import { processUploadedFile } from '../ocr-engine';

describe('АПК-оффлайн распознавание анализов (фото → labs)', () => {
  it('фото бланка доводится до labs через оффлайн-OCR', async () => {
    const file = new File(['x'.repeat(64)], 'lab-photo.jpg', { type: 'image/jpeg' });
    const result = await processUploadedFile(file);
    expect(result.labs.length).toBeGreaterThan(0);
    const codes = result.labs.map(l => l.code);
    // Финальные коды — UCUM-канон (mapToUcumCode): креатинин → CREATININE.
    expect(codes).toEqual(expect.arrayContaining(['ALT', 'GLU', 'CREATININE']));
  });

  it('предупреждения честно говорят про оффлайн-режим, а не молчат', async () => {
    const file = new File(['x'.repeat(64)], 'lab-photo.jpg', { type: 'image/jpeg' });
    const result = await processUploadedFile(file);
    expect(result.warnings.join(' ')).toMatch(/оффлайн|сервер/i);
  });
});
