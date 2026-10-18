/** APK regression for FatSecret's column-heavy nutrition screenshots. */
import { describe, expect, it, vi } from 'vitest';

const recognize = vi.fn();
const setParameters = vi.fn(async () => undefined);

vi.mock('tesseract.js', () => ({
  createWorker: vi.fn(async () => ({
    setParameters,
    recognize,
    terminate: vi.fn(async () => undefined),
  })),
}));

vi.mock('../../core/db', () => ({ db: { init: vi.fn(), put: vi.fn() } }));
vi.mock('../../core/data-link', () => ({ notifyDataChange: vi.fn() }));

import { processUploadedFile } from '../../core/ocr-engine';
import { isNutritionDiaryOcrText } from '../ocr-preprocess';

describe('АПК: FatSecret screenshot OCR', () => {
  it('объединяет блочный и разреженный OCR-проходы в блюда дневника', async () => {
    // Детерминированный «оффлайн»: иначе resolveTesseractOptions/serverOcrImage
    // делают реальные сетевые пробы (HEAD/Range к localhost), которые в CI
    // могут висеть секунды и ронять тест по таймауту.
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new TypeError('offline test env');
    }) as typeof fetch;
    // jsdom не декодирует изображения: createImageBitmap/HTMLImageElement
    // молчат до 15с-таймаутов prepareImageForServer. Подаём «API нет» —
    // тогда prepareImageForServer сразу возвращает исходный файл.
    vi.stubGlobal('createImageBitmap', undefined as unknown as typeof createImageBitmap);
    const cobDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
    if (cobDescriptor) Object.defineProperty(URL, 'createObjectURL', { ...cobDescriptor, value: undefined });
    try {
      recognize
        .mockResolvedValueOnce({ data: { text: 'Завтрак\nКуриная грудка\n200 г\n330 ккал' } })
        .mockResolvedValueOnce({ data: { text: 'Белки 40 г\nЖиры 10 г\nУглеводы 0 г' } });

      const result = await processUploadedFile(new File(['screenshot'], 'fatsecret.png', { type: 'image/png' }));

      expect(setParameters).toHaveBeenCalledWith(expect.objectContaining({ tessedit_pageseg_mode: '6' }));
      expect(setParameters).toHaveBeenCalledWith(expect.objectContaining({ tessedit_pageseg_mode: '11' }));
      expect(result.meals.flatMap(meal => meal.items)).toEqual(expect.arrayContaining([
        expect.objectContaining({ foodId: 'chicken_breast', qtyGrams: 200, p: 20, f: 5, c: 0 }),
      ]));
    } finally {
      globalThis.fetch = originalFetch;
      vi.unstubAllGlobals();
      if (cobDescriptor) Object.defineProperty(URL, 'createObjectURL', cobDescriptor);
    }
  }, 30_000);

  it('распознаёт маркеры строк приложения для продолжения OCR вторым проходом', () => {
    expect(isNutritionDiaryOcrText('MyFitnessPal\nBreakfast\nChicken 4 oz 190 kcal')).toBe(true);
    expect(isNutritionDiaryOcrText('FatSecret\nКурица 100 г 165 ккал\nРис 150 г 180 ккал')).toBe(true);
  });
});
