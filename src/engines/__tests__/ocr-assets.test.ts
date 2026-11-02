import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch for localAssetAvailable HEAD checks.
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

// Import after stubbing fetch.
import {
  getOcrAssetPaths,
  resolveTesseractOptions,
  resolvePdfjsWorkerSrc,
  configurePdfjsWorker,
  localAssetAvailable,
  resetOcrLangProbeCache,
} from '../ocr-assets';

/**
 * URL-осведомлённая подмена fetch: порядок запросов больше не важен, потому что
 * резолвер сначала определяет ФОРМАТ языковых моделей (в APK они лежат без
 * `.gz`), а уже потом проверяет воркер и ядро.
 */
function stubAssets(opts: {
  plainLang?: boolean;
  gzLang?: boolean;
  worker?: boolean;
  core?: boolean;
} = {}) {
  const { plainLang = true, gzLang = false, worker = true, core = true } = opts;
  fetchMock.mockImplementation(async (input: any) => {
    const url = String(input);
    const present = /\.traineddata\.gz$/.test(url)
      ? gzLang
      : /\.traineddata$/.test(url)
        ? plainLang
        : /worker\.min\.js$/.test(url)
          ? worker
          : /tesseract-core-lstm\.wasm\.js$/.test(url)
            ? core
            : false;
    return {
      ok: present,
      status: present ? 200 : 404,
      headers: { get: () => (present ? 'application/octet-stream' : 'text/plain') },
      body: { cancel: async () => {} },
    };
  });
}

describe('ocr-assets: local path configuration', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    // Результат проверки моделей кэшируется на сессию — между тестами сбрасываем.
    resetOcrLangProbeCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('getOcrAssetPaths returns local paths by default', () => {
    const p = getOcrAssetPaths('local');
    expect(p.workerPath).toMatch(/(?:^|\/)tesseract\/worker\.min\.js$/);
    expect(p.corePath).toMatch(/(?:^|\/)tesseract\/core$/);
    expect(p.langPath).toMatch(/(?:^|\/)tesseract\/lang$/);
    expect(p.pdfjsWorkerSrc).toMatch(/(?:^|\/)pdfjs\/pdf\.worker\.min\.mjs$/);
  });

  it('getOcrAssetPaths returns CDN paths when requested', () => {
    const p = getOcrAssetPaths('cdn');
    expect(p.workerPath).toContain('cdn.jsdelivr.net');
    expect(p.workerPath).toContain('tesseract.js@v');
    expect(p.corePath).toContain('cdn.jsdelivr.net');
    expect(p.corePath).toContain('tesseract.js-core@v');
    // Было: langPath = корень пакета 'https://cdn.jsdelivr.net/npm/@tesseract.js-data',
    // и воркер запрашивал '.../@tesseract.js-data/rus.traineddata.gz' — такого файла
    // нет (пакет разложен по <lang>/<version>/), фолбэк был 404-ным по построению.
    // Теперь langPath не задан: tesseract.js строит корректный URL на КАЖДЫЙ язык
    // сам ('.../@tesseract.js-data/<lang>/4.0.0_best_int/<lang>.traineddata.gz').
    expect(p.langPath).toBeUndefined();
    expect(p.pdfjsWorkerSrc).toContain('cdnjs.cloudflare.com');
    expect(p.pdfjsWorkerSrc).toContain('pdf.worker.min.mjs');
  });

  it('localAssetAvailable returns true for HTTP 200', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });
    const ok = await localAssetAvailable('/tesseract/worker.min.js');
    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('/tesseract/worker.min.js', {
      method: 'HEAD',
      cache: 'no-store',
    });
  });

  it('localAssetAvailable returns false for HTTP 404', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });
    const ok = await localAssetAvailable('/tesseract/worker.min.js');
    expect(ok).toBe(false);
  });

  it('localAssetAvailable uses GET when Telegram WebView rejects HEAD', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('HEAD is not supported'))
      .mockResolvedValueOnce({ ok: true, status: 206 });
    expect(await localAssetAvailable('/tesseract/worker.min.js')).toBe(true);
    expect(fetchMock).toHaveBeenLastCalledWith('/tesseract/worker.min.js', {
      method: 'GET', headers: { Range: 'bytes=0-0' }, cache: 'no-store',
    });
  });

  it('localAssetAvailable returns false on network error', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network error'));
    const ok = await localAssetAvailable('/tesseract/worker.min.js');
    expect(ok).toBe(false);
  });

  it('resolveTesseractOptions prefers local when assets are reachable', async () => {
    // Модели в APK лежат распакованными (AAPT снимает .gz) — gzip:false.
    stubAssets({ plainLang: true });
    const opts = await resolveTesseractOptions();
    expect(opts.source).toBe('local');
    expect(opts.workerPath).toMatch(/(?:^|\/)tesseract\/worker\.min\.js$/);
    expect(opts.corePath).toMatch(/(?:^|\/)tesseract\/core$/);
    expect(opts.langPath).toMatch(/(?:^|\/)tesseract\/lang$/);
    expect(opts.gzip).toBe(false);
  });

  it('resolveTesseractOptions prefers local with gzip:true for the dist/OTA layout', async () => {
    // В dist/ и OTA-бандле модели сжатые.
    stubAssets({ plainLang: false, gzLang: true });
    const opts = await resolveTesseractOptions();
    expect(opts.source).toBe('local');
    expect(opts.gzip).toBe(true);
  });

  it('resolveTesseractOptions falls back to CDN when lstm core is missing (stale APK build)', async () => {
    stubAssets({ plainLang: true, core: false });
    const opts = await resolveTesseractOptions();
    expect(opts.source).toBe('cdn');
    expect(opts.workerPath).toContain('cdn.jsdelivr.net');
  });

  it('resolveTesseractOptions falls back to CDN when rus traineddata is missing', async () => {
    // Ни `rus.traineddata`, ни `rus.traineddata.gz` — воркер заведомо не стартует.
    stubAssets({ plainLang: false, gzLang: false });
    const opts = await resolveTesseractOptions();
    expect(opts.source).toBe('cdn');
    expect(opts.gzip).toBe(true);
  });

  it('resolveTesseractOptions falls back to CDN when local assets are unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('network error'));
    const opts = await resolveTesseractOptions();
    expect(opts.source).toBe('cdn');
    expect(opts.workerPath).toContain('cdn.jsdelivr.net');
    expect(opts.corePath).toContain('cdn.jsdelivr.net');
  });

  it('resolveTesseractOptions falls back to CDN when worker script is missing', async () => {
    stubAssets({ worker: false });
    const opts = await resolveTesseractOptions();
    expect(opts.source).toBe('cdn');
  });

  it('resolvePdfjsWorkerSrc prefers local when reachable', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });
    const r = await resolvePdfjsWorkerSrc();
    expect(r.source).toBe('local');
    expect(r.workerSrc).toMatch(/(?:^|\/)pdfjs\/pdf\.worker\.min\.mjs$/);
  });

  it('resolvePdfjsWorkerSrc falls back to CDN when local is unreachable', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });
    const r = await resolvePdfjsWorkerSrc();
    expect(r.source).toBe('cdn');
    expect(r.workerSrc).toContain('cdnjs.cloudflare.com');
  });

  it('configurePdfjsWorker sets workerSrc on pdfjsLib', () => {
    const fakePdfjsLib = { GlobalWorkerOptions: {} };
    const ok = configurePdfjsWorker(fakePdfjsLib, 'local');
    expect(ok).toBe(true);
    expect(fakePdfjsLib.GlobalWorkerOptions.workerSrc).toMatch(/(?:^|\/)pdfjs\/pdf\.worker\.min\.mjs$/);
  });

  it('configurePdfjsWorker with CDN preference sets CDN workerSrc', () => {
    const fakePdfjsLib = { GlobalWorkerOptions: {} };
    const ok = configurePdfjsWorker(fakePdfjsLib, 'cdn');
    expect(ok).toBe(false);
    expect(fakePdfjsLib.GlobalWorkerOptions.workerSrc).toContain('cdnjs.cloudflare.com');
  });
});
