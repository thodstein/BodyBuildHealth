/**
 * ocr-lang-assets.test.ts — формат языковых моделей OCR в разных сборках.
 *
 * Реальная причина отказа в APK (диагностика с устройства, ноябрь 2026):
 *   asset OK  200 https://localhost/tesseract/worker.min.js
 *   asset OK  200 https://localhost/tesseract/core/tesseract-core-lstm.wasm.js
 *   asset FAIL 404 https://localhost/tesseract/lang/rus.traineddata.gz
 *   asset FAIL 404 https://localhost/tesseract/lang/eng.traineddata.gz
 *   error: движок OCR не запустился (worker/core/lang): таймаут 83с
 *
 * AAPT при упаковке APK распаковывает `*.gz`, поэтому внутри APK модели лежат
 * как `rus.traineddata` / `eng.traineddata`. Код же всегда просил `.gz` →
 * 404 → воркер висел до таймаута. В dist/ и в OTA-бандле файлы, наоборот,
 * сжатые. Поэтому формат надо определять на месте, а не хардкодить.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  detectLocalLangAssets,
  resetOcrLangProbeCache,
  tesseractWorkerAttempts,
} from '../ocr-assets';

type Handler = (url: string) => { status: number; contentType?: string } | 'throw';

const originalFetch = globalThis.fetch;

function stubFetch(handler: Handler) {
  globalThis.fetch = vi.fn(async (input: any) => {
    const url = String(input);
    const out = handler(url);
    if (out === 'throw') throw new Error('Failed to fetch');
    return {
      status: out.status,
      headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? out.contentType ?? '' : null) },
      body: { cancel: async () => {} },
    } as any;
  }) as any;
}

const octet = 'application/octet-stream';

describe('формат языковых моделей OCR (APK vs dist)', () => {
  beforeEach(() => {
    resetOcrLangProbeCache();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    resetOcrLangProbeCache();
  });

  it('в APK модели без .gz — определяем gzip:false и берём локальные ассеты', async () => {
    stubFetch((url) => {
      if (/\.traineddata$/.test(url)) return { status: 200, contentType: octet };
      return { status: 404 };
    });

    const probe = await detectLocalLangAssets('/tesseract/lang', ['rus', 'eng']);
    expect(probe).toMatchObject({ kind: 'found', gzip: false, langs: ['rus', 'eng'] });

    resetOcrLangProbeCache();
    const attempts = await tesseractWorkerAttempts({ nativeLike: true, online: true });
    expect(attempts[0]).toMatchObject({ label: 'local-blob', gzip: false, source: 'local' });
    expect(attempts[0].langs).toEqual(['rus', 'eng']);
  });

  it('в dist/OTA модели сжатые — определяем gzip:true', async () => {
    stubFetch((url) => {
      if (/\.traineddata\.gz$/.test(url)) return { status: 200, contentType: octet };
      return { status: 404 };
    });

    const probe = await detectLocalLangAssets('/tesseract/lang', ['rus', 'eng']);
    expect(probe).toMatchObject({ kind: 'found', gzip: true });
  });

  it('нет eng-модели — грузим только rus, а не падаем на "rus+eng"', async () => {
    stubFetch((url) => (/rus\.traineddata$/.test(url) ? { status: 200, contentType: octet } : { status: 404 }));

    const probe = await detectLocalLangAssets('/tesseract/lang', ['rus', 'eng']);
    expect(probe.kind).toBe('found');
    expect(probe.langs).toEqual(['rus']);
  });

  it('моделей нет совсем — локальные попытки не тратят 80с, идём на CDN', async () => {
    stubFetch(() => ({ status: 404 }));

    const attempts = await tesseractWorkerAttempts({ nativeLike: true, online: true });
    expect(attempts.map((a) => a.label)).toEqual(['cdn-blob']);
    expect(attempts[0]).toMatchObject({ source: 'cdn', gzip: true });
  });

  it('офлайн и моделей нет — попыток нет (внятная ошибка вместо таймаута)', async () => {
    stubFetch(() => ({ status: 404 }));

    const attempts = await tesseractWorkerAttempts({ nativeLike: true, online: false });
    expect(attempts).toEqual([]);
  });

  it('проверка не удалась (fetch блокирован) — не считаем ассеты отсутствующими', async () => {
    stubFetch(() => 'throw');

    const probe = await detectLocalLangAssets('/tesseract/lang', ['rus', 'eng']);
    expect(probe).toMatchObject({ kind: 'unknown', gzip: true });

    resetOcrLangProbeCache();
    const attempts = await tesseractWorkerAttempts({ nativeLike: true, online: false });
    expect(attempts.map((a) => a.label)).toEqual(['local-blob', 'local-direct']);
    expect(attempts[0]).toMatchObject({ source: 'local', langs: ['rus', 'eng'] });
  });

  it('SPA-фолбэк с index.html не считается существующим ассетом', async () => {
    stubFetch(() => ({ status: 200, contentType: 'text/html; charset=utf-8' }));

    const probe = await detectLocalLangAssets('/tesseract/lang', ['rus', 'eng']);
    expect(probe.kind).toBe('missing');
  });
});
