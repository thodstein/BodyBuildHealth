// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import handler, { mergeOcrPasses, resolveOcrPurpose } from '../../../api/ocr-image';

function invoke(req: any) {
  const state: { status: number; body: unknown } = { status: 200, body: undefined };
  const response = {
    status(code: number) { state.status = code; return response; },
    json(body: unknown) { state.body = body; return response; },
  };
  return handler(req, response as any).then(() => state);
}

describe('api/ocr-image', () => {
  it('rejects non-POST requests', async () => {
    const result = await invoke({ method: 'GET', body: {} });
    expect(result.status).toBe(405);
    expect(result.body).toMatchObject({ ok: false });
  });

  it('requires image data', async () => {
    const result = await invoke({ method: 'POST', body: {} });
    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({ ok: false, error: 'Image data is required' });
  });

  it('rejects malformed base64 before starting OCR', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const result = await invoke({ method: 'POST', body: { data: 'not base64!' } });
      expect(result.status).toBe(422);
      expect(result.body).toMatchObject({ ok: false, error: 'Image data must be valid base64' });
    } finally { errorSpy.mockRestore(); }
  });
});

describe('api/ocr-image: слияние языковых проходов', () => {
  it('не добавляет английский дубль к уже прочитанной русской этикетке', () => {
    const rus = 'Завтрак\nОвсянка 100 г 350 ккал\nБелки 12 г';
    const eng = 'Breakfast\nOatmeal 100 g 350 kcal\nProtein 12 g';
    expect(mergeOcrPasses(rus, eng)).toBe(rus);
    expect(mergeOcrPasses(rus, eng, 'nutrition')).toBe(rus);
  });

  it('добавляет латинские метки бланка анализов, которые русский проход не прочитал', () => {
    const rus = 'Глюкоза 5,4 ммоль/л\nХолестерин общий 4,8';
    const eng = 'HbA1c 5.4\nHDL 1.2\nLDL 2.8';
    const merged = mergeOcrPasses(rus, eng);
    expect(merged).toContain('Глюкоза');
    expect(merged).toContain('HbA1c');
  });

  it('возвращает единственный непустой проход как есть', () => {
    expect(mergeOcrPasses('', 'Protein 10 g')).toBe('Protein 10 g');
    expect(mergeOcrPasses('Белки 10 г', '')).toBe('Белки 10 г');
    expect(mergeOcrPasses('', '')).toBe('');
  });
});

describe('api/ocr-image: purpose', () => {
  it('нормализует purpose из body: labs остаётся labs, остальное — nutrition', () => {
    expect(resolveOcrPurpose('labs')).toBe('labs');
    expect(resolveOcrPurpose('food')).toBe('nutrition');
    expect(resolveOcrPurpose(undefined)).toBe('nutrition');
  });
});

describe('api/ocr-image: lab-режим слияния проходов', () => {
  it('labs: «Углеводный обмен» — не маркер еды, английский проход добавляет HbA1c и TSH', () => {
    // Старый lab-safe regex ловил «углев» внутри «Углеводный обмен» и
    // выбрасывал eng-проход с латинскими метками бланка.
    const merged = mergeOcrPasses('Углеводный обмен\nОбщий белок 74 г/л', 'HbA1c 5.4 %\nTSH 2.1 mIU/L', 'labs');
    expect(merged).toContain('Углеводный обмен');
    expect(merged).toContain('HbA1c');
    expect(merged).toContain('TSH');
  });

  it('labs: «Белки» не глушат eng-проход, в отличие от nutrition', () => {
    const rus = 'Белки 12 г';
    const eng = 'HbA1c 5.4 %\nTSH 2.1 mIU/L';
    expect(mergeOcrPasses(rus, eng, 'labs')).toContain('HbA1c');
    expect(mergeOcrPasses(rus, eng, 'nutrition')).toBe(rus);
  });

  it('labs: пустой и пробельный проходы не дают мусора', () => {
    expect(mergeOcrPasses('', '   ', 'labs')).toBe('');
    expect(mergeOcrPasses('  \n\t ', 'HbA1c 5.4 %', 'labs')).toBe('HbA1c 5.4 %');
    expect(mergeOcrPasses('Общий белок 74 г/л', '  \n ', 'labs')).toBe('Общий белок 74 г/л');
  });
});
