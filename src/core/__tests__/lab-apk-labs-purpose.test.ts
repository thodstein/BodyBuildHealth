/**
 * lab-apk-labs-purpose.test.ts — purpose='labs' в оффлайн-OCR АПК.
 *
 * Раньше АПК-ветка фото бланка всегда шла в recognizeImageTextOffline с
 * purpose='nutrition': лабовые проходы (PSM-4 плотной таблицы, английский
 * проход для латинских аббревиатур HbA1c/TSH/ALT, рейт проходов по числу
 * распознанных маркеров) не включались никогда, хотя были написаны.
 * Тест доказывает, что processUploadedFile(file, { purpose: 'labs' })
 * прогоняет лабовый пайплайн проходов, а дефолтный вызов (дневник еды) — нет.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const psmModes: string[] = [];
const workerLangs: string[] = [];

vi.mock('../app-platform', () => ({
  isNativeApp: () => true,
  isCapacitorNative: () => true,
}));

vi.mock('tesseract.js', () => ({
  createWorker: vi.fn(async (lang: string) => {
    workerLangs.push(lang);
    return {
      setParameters: vi.fn(async (p: Record<string, string>) => {
        if (p?.tessedit_pageseg_mode) psmModes.push(p.tessedit_pageseg_mode);
      }),
      recognize: async () => ({
        data: {
          text: 'АЛТ 35 Е/л 0-41\nГлюкоза 5,4 ммоль/л 3,9-5,5',
        },
      }),
      terminate: async () => {},
    };
  }),
}));

import { createWorker } from 'tesseract.js';
import { processUploadedFile } from '../ocr-engine';

beforeEach(() => {
  psmModes.length = 0;
  workerLangs.length = 0;
  (createWorker as any).mockClear();
});

describe('АПК: purpose=labs включает лабовые проходы OCR', () => {
  it('PSM-4 и английский проход выполняются только в лабовом режиме', async () => {
    const file = new File(['x'.repeat(64)], 'lab-photo.jpg', { type: 'image/jpeg' });
    const result = await processUploadedFile(file, { purpose: 'labs' });

    // Основной двуязычный воркер + дополнительный английский (HbA1c/TSH/ALT).
    expect(workerLangs[0]).toBe('rus+eng');
    expect(workerLangs).toContain('eng');

    // Блочный PSM-6 → PSM-4 плотной таблицы → PSM-11 разреженный.
    expect(psmModes).toContain('6');
    expect(psmModes).toContain('4');
    expect(psmModes).toContain('11');

    // Результат доведён до маркеров.
    expect(result.labs.map(l => l.code)).toEqual(expect.arrayContaining(['ALT', 'GLU']));
  });

  it('дефолтный режим (дневник еды) не запускает лабовые проходы', async () => {
    const file = new File(['x'.repeat(64)], 'food.jpg', { type: 'image/jpeg' });
    await processUploadedFile(file);

    expect(workerLangs).toEqual(['rus+eng']);
    expect(psmModes).not.toContain('4');
  });
});
