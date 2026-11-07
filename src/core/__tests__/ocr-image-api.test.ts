// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import handler, { mergeOcrPasses } from '../../../api/ocr-image';

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
