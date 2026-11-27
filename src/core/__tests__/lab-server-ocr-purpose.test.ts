/**
 * lab-server-ocr-purpose.test.ts — замок серверного lab-OCR (web).
 *
 * Регресс: лабы на web шли через дефолтный nutrition-путь: фото сжималось до
 * 1280px, первым вызывался api/ocr-scanned-pdf (PSM 3 без препроцессинга), а
 * api/ocr-image (PSM 6 + rus/eng merge) мог вообще не выполниться. Здесь
 * проверяем контракт: purpose='labs' → первым ocr-image, body с purpose и
 * реальным именем файла; purpose='nutrition' → прежний порядок и тело.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../app-platform', () => ({
  isNativeApp: () => false,
}));

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

import { processUploadedFile } from '../ocr-engine';

const LAB_TEXT = [
  'ИНВИТРО',
  'Исследование\tРезультат\tЕдиницы\tРеференсные значения',
  'АЛТ\t35\tЕ/л\t0-41',
  'Глюкоза\t5,4\tммоль/л\t3,9-5,5',
  'Креатинин\t92\tмкмоль/л\t62-106',
].join('\n');

function okResponse(text: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ ok: true, text }),
  };
}

function bodyOf(call: unknown[]): any {
  return JSON.parse(String((call[1] as RequestInit).body));
}

describe('server OCR: purpose=labs', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(okResponse(LAB_TEXT));
  });

  it('лабы идут в api/ocr-image первым и передают purpose=labs', async () => {
    const file = new File(['x'.repeat(64)], 'invitro.jpg', { type: 'image/jpeg' });
    const result = await processUploadedFile(file, { purpose: 'labs' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/ocr-image');

    const body = bodyOf(fetchMock.mock.calls[0]);
    expect(body.purpose).toBe('labs');
    expect(body.filename).toBe('invitro.jpg');
    expect(body.kind).toBe('image');
    expect(init).toMatchObject({ method: 'POST' });

    expect(result.labs.map((lab) => lab.code)).toEqual(expect.arrayContaining(['ALT', 'GLU', 'CREATININE']));
  });

  it('питание сохраняет прежний порядок endpoint-ов и не получает lab-поля', async () => {
    const file = new File(['x'.repeat(64)], 'food.jpg', { type: 'image/jpeg' });
    await processUploadedFile(file, { purpose: 'nutrition' });

    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/ocr-scanned-pdf');
    const body = bodyOf(fetchMock.mock.calls[0]);
    expect(body.purpose).toBeUndefined();
    expect(body.mode).toBe('fatsecret');
  });
});
