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
        text: 'ИНВИТРО\nАЛТ 35 Е/л 0-41\nГлюкоза 5,4 ммоль/л 3,9-5,5\nКреатинин 92 мкмоль/л 62-106\nТестостерон 18 нмоль/л 8,6-29\nВитамин D 75 нмоль/л 75-250',
      },
    }),
    terminate: async () => {},
  })),
}));

import { pickBestLabOcrText, processUploadedFile } from '../ocr-engine';
import { normalizeLabMeasurement } from '../labs-mapping';

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

  it('для бланка выбирает проход с маркерами, а не длинный текст с макросами еды', () => {
    const foodNoise = 'Завтрак 450 ккал Б 30 г Ж 12 г У 50 г '.repeat(8);
    const labTable = 'АЛТ 35 Е/л 0-41\nГлюкоза 5,4 ммоль/л 3,9-5,5\nКреатинин 92 мкмоль/л 62-106\nТТГ 2,1 мЕд/л 0,4-4,0';
    expect(pickBestLabOcrText([foodNoise, labTable])).toBe(labTable);
  });

  it('нормализует лабораторные единицы в единицы приложения', () => {
    expect(normalizeLabMeasurement('FT', 35, 'пмоль/л')).toEqual({ value: 10.095, unit: 'pg/mL' });
    expect(normalizeLabMeasurement('CA', 10, 'мг/дл')).toEqual({ value: 2.495, unit: 'mmol/L' });
    expect(normalizeLabMeasurement('CRP', 1.2, 'мг/дл')).toEqual({ value: 12, unit: 'mg/L' });
    expect(normalizeLabMeasurement('HbA1c', 53, 'ммоль/моль')).toEqual({ value: 7, unit: '%' });
  });
});
