/**
 * АПК: pdfjs обязан работать на главном потоке.
 *
 * WebView в приложении нередко не поднимает module-worker (pdfjs создаёт
 * `new Worker(src, { type: 'module' })`). Тогда pdfjs навсегда ждёт от воркера
 * сообщение «ready» — импорт PDF «зависает» без ошибки. Поэтому в нативном
 * режиме pdfjs переводится на главный поток через `globalThis.pdfjsWorker`
 * (штатный путь pdfjs без воркера), а скрипт воркера не скачивается вовсе.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  native: true,
  documents: [] as Array<{ workerAtCall: unknown; dataLen: number }>,
  fetchCalls: [] as string[],
}));

vi.mock('../../core/app-platform', () => ({
  isNativeApp: () => hoisted.native,
  isCapacitorNative: () => hoisted.native,
}));

vi.mock('pdfjs-dist/legacy/build/pdf.worker.min.mjs', () => ({
  WorkerMessageHandler: { name: 'fake-main-thread-handler' },
}));

const fakePdf = {
  numPages: 1,
  getPage: async () => ({
    getTextContent: async () => ({
      items: [{ str: 'АЛТ 35 Е/л 0-41' }, { str: 'Глюкоза 5,4 ммоль/л 3,9-5,5' }],
    }),
    cleanup: () => {},
  }),
  cleanup: async () => {},
  destroy: async () => {},
};

vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: (opts: { data: Uint8Array }) => {
    hoisted.documents.push({
      workerAtCall: (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker,
      dataLen: opts.data?.length ?? 0,
    });
    return { promise: Promise.resolve(fakePdf) };
  },
}));

import { parsePDF } from '../pdf-parser.engine';

const PDF_BYTES = '%PDF-1.7\nfake pdf payload';

describe('АПК: pdfjs без воркера (главный поток)', () => {
  beforeEach(() => {
    hoisted.documents.length = 0;
    hoisted.fetchCalls.length = 0;
    delete (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker;
    const original = globalThis.fetch;
    (globalThis as { fetch?: unknown }).fetch = async (input: unknown) => {
      hoisted.fetchCalls.push(String(input));
      throw new Error('сеть в АПК не нужна');
    };
    return () => { (globalThis as { fetch?: unknown }).fetch = original; };
  });

  afterEach(() => {
    delete (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker;
  });

  it('настраивает главный поток до открытия документа и не качает скрипт воркера', async () => {
    hoisted.native = true;
    const buffer = Uint8Array.from(PDF_BYTES, (ch) => ch.charCodeAt(0)).buffer;

    const result = await parsePDF(buffer);

    expect(hoisted.documents).toHaveLength(1);
    // Ключевое: pdfjs уже знает про главный поток, значит воркер не создаётся
    // и «вечного ожидания ready» быть не может.
    expect(hoisted.documents[0].workerAtCall).toEqual({
      WorkerMessageHandler: { name: 'fake-main-thread-handler' },
    });
    // Данные передаются копией: оригинальный буфер не должен стать detached.
    expect(hoisted.documents[0].dataLen).toBe(PDF_BYTES.length);
    expect(hoisted.fetchCalls).toHaveLength(0);
    expect(result.values.map((v) => v.code)).toContain('GLU');
  });

  it('в браузере остаётся воркер и главный поток не используется', async () => {
    hoisted.native = false;
    const buffer = Uint8Array.from(PDF_BYTES, (ch) => ch.charCodeAt(0)).buffer;

    await parsePDF(buffer);

    expect(hoisted.documents).toHaveLength(1);
    expect((globalThis as { pdfjsWorker?: unknown }).pdfjsWorker).toBeUndefined();
  });
});
