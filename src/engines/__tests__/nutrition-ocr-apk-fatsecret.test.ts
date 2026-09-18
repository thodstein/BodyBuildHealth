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

describe('АПК: FatSecret screenshot OCR', () => {
  it('объединяет блочный и разреженный OCR-проходы в блюда дневника', async () => {
    recognize
      .mockResolvedValueOnce({ data: { text: 'Завтрак\nКуриная грудка\n200 г\n330 ккал' } })
      .mockResolvedValueOnce({ data: { text: 'Белки 40 г\nЖиры 10 г\nУглеводы 0 г' } });

    const result = await processUploadedFile(new File(['screenshot'], 'fatsecret.png', { type: 'image/png' }));

    expect(setParameters).toHaveBeenCalledWith(expect.objectContaining({ tessedit_pageseg_mode: '6' }));
    expect(setParameters).toHaveBeenCalledWith(expect.objectContaining({ tessedit_pageseg_mode: '11' }));
    expect(result.meals.flatMap(meal => meal.items)).toEqual(expect.arrayContaining([
      expect.objectContaining({ foodId: 'chicken_breast', qtyGrams: 200, p: 20, f: 5, c: 0 }),
    ]));
  });
});
