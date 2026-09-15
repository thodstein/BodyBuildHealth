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
} from '../ocr-assets';

describe('ocr-assets: local path configuration', () => {
  beforeEach(() => {
    fetchMock.mockReset();
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
    expect(p.langPath).toContain('cdn.jsdelivr.net');
    expect(p.langPath).toContain('@tesseract.js-data');
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
    // worker + lstm-core + rus-lang probes (АПК-фикс Sep 2026: 3 пробы).
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    const opts = await resolveTesseractOptions();
    expect(opts.source).toBe('local');
    expect(opts.workerPath).toMatch(/(?:^|\/)tesseract\/worker\.min\.js$/);
    expect(opts.corePath).toMatch(/(?:^|\/)tesseract\/core$/);
    expect(opts.langPath).toMatch(/(?:^|\/)tesseract\/lang$/);
  });

  it('resolveTesseractOptions falls back to CDN when lstm core is missing (stale APK build)', async () => {
    // localAssetAvailable делает HEAD, при 404 — ещё и GET Range. Итого:
    // worker HEAD 200, core HEAD 404 + core GET 404 (false), lang HEAD 200.
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    const opts = await resolveTesseractOptions();
    expect(opts.source).toBe('cdn');
    expect(opts.workerPath).toContain('cdn.jsdelivr.net');
  });

  it('resolveTesseractOptions falls back to CDN when rus traineddata is missing', async () => {
    // worker HEAD 200, core HEAD 200, lang HEAD 404 + lang GET 404 (false).
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: false, status: 404 });
    const opts = await resolveTesseractOptions();
    expect(opts.source).toBe('cdn');
  });

  it('resolveTesseractOptions falls back to CDN when local assets are unreachable', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });
    const opts = await resolveTesseractOptions();
    expect(opts.source).toBe('cdn');
    expect(opts.workerPath).toContain('cdn.jsdelivr.net');
    expect(opts.corePath).toContain('cdn.jsdelivr.net');
  });

  it('resolveTesseractOptions falls back to CDN on network error', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network error'));
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
