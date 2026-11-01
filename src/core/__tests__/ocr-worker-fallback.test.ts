/**
 * ocr-worker-fallback.test.ts — запуск воркера OCR в АПК.
 *
 * Репорт с устройства: свежесобранный APK, ошибка
 * «Оффлайн-распознавание не удалось: движок OCR не запустился».
 * Причина — единственная попытка createWorker с таймаутом 45с (на первом
 * запуске в WebView компиляция wasm + две языковые модели дольше) и без
 * запасного механизма: если WebView отказывается грузить скрипт воркера по
 * `https://localhost`, распознавание умирало навсегда.
 *
 * Здесь фиксируем контракт: локальные ассеты идут первыми, при быстром отказе
 * механизма пробуется следующий (Blob-воркер), и только потом CDN.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../app-platform', () => ({
  isNativeApp: () => true,
  isCapacitorNative: () => true,
}));

const createWorker = vi.fn();
vi.mock('tesseract.js', () => ({ createWorker: (...args: any[]) => createWorker(...args) }));

import { processUploadedFile } from '../ocr-engine';

const okWorker = () => ({
  setParameters: async () => {},
  recognize: async () => ({ data: { text: 'АЛТ 42 Е/л 0-41\nКреатинин 88 мкмоль/л 62-106\nГлюкоза 5,1 ммоль/л 4,1-5,9' } }),
  terminate: async () => {},
});

describe('АПК: запасные механизмы запуска воркера OCR', () => {
  beforeEach(() => { createWorker.mockReset(); });

  it('при отказе Blob-воркера пробует прямой URL и доходит до маркеров', async () => {
    createWorker.mockImplementation(async (...args: any[]) => {
      // Ломаем штатный Blob-механизм: WebView не даёт выполнить importScripts.
      if (args[2]?.workerBlobURL !== false) throw new Error('Failed to fetch worker script');
      return okWorker();
    });

    const file = new File(['x'.repeat(64)], 'lab-photo.jpg', { type: 'image/jpeg' });
    const result = await processUploadedFile(file, { purpose: 'labs' });

    expect(createWorker.mock.calls.length).toBeGreaterThanOrEqual(2);
    // Первая попытка — локальный Blob-воркер (штатный механизм tesseract.js).
    expect(createWorker.mock.calls[0][2]).toMatchObject({ workerBlobURL: true });
    // Отказ механизма не должен обрывать распознавание: переходим на прямой URL.
    const flags = createWorker.mock.calls.map((c) => c[2]?.workerBlobURL);
    expect(flags).toContain(false);
    expect(result.labs.map((l) => l.code)).toEqual(expect.arrayContaining(['ALT', 'CREATININE', 'GLU']));
  });

  it('локальные ассеты пробуются раньше CDN', async () => {
    createWorker.mockImplementation(async (...args: any[]) => {
      const workerPath = String(args[2]?.workerPath || '');
      // Локальный бандл недоступен, работает только внешний CDN-источник.
      if (!/^https:\/\/cdn\./i.test(workerPath)) throw new Error('Failed to fetch');
      return okWorker();
    });

    const file = new File(['x'.repeat(64)], 'lab-photo.jpg', { type: 'image/jpeg' });
    const result = await processUploadedFile(file, { purpose: 'labs' });

    const paths = createWorker.mock.calls.map((c) => String(c[2]?.workerPath));
    expect(paths[0]).toMatch(/tesseract\/worker\.min\.js$/);
    expect(paths[paths.length - 1]).toMatch(/^https:\/\/cdn\./);
    expect(result.labs.length).toBeGreaterThan(0);
  });
});
