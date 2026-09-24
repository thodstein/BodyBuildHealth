/**
 * APK regression: some Android WebViews expose FileReader but not
 * Blob/File.arrayBuffer(). PDF import must still reach the parser.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../db', () => ({
  db: { init: vi.fn(), put: vi.fn() },
}));

vi.mock('../data-link', () => ({ notifyDataChange: vi.fn() }));
vi.mock('../app-platform', () => ({
  isNativeApp: () => true,
  isCapacitorNative: () => true,
}));

vi.mock('tesseract.js', () => ({
  createWorker: vi.fn(),
}));

import { readFileAsArrayBuffer, processUploadedFile } from '../ocr-engine';
import { resolveTesseractOptions } from '../../engines/ocr-assets';
import { resolvePdfjsWorkerSrc } from '../../engines/ocr-assets';
import { pickBetterLabOcrPass } from '../../engines/pdf-parser.engine';

describe('АПК: импорт PDF без Blob.arrayBuffer()', () => {
  it('использует FileReader fallback и передаёт буфер в PDF-парсер', async () => {
    const file = new File(['%PDF-1.7 fake'], 'labs.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'arrayBuffer', { value: undefined, configurable: true });
    Object.defineProperty(file, 'text', { value: undefined, configurable: true });

    const buffer = await readFileAsArrayBuffer(file);

    expect(buffer).toBeInstanceOf(ArrayBuffer);
    expect(new TextDecoder().decode(buffer)).toContain('%PDF-1.7');
  });

  it('не заменяет локальные APK-ассеты CDN-путями', async () => {
    const options = await resolveTesseractOptions();
    expect(options.source).toBe('local');
    expect(options.workerPath).toMatch(/tesseract/);
    expect(options.langPath).toMatch(/lang/);
  });

  it('оставляет PDF.js на локальном APK-пути', async () => {
    const options = await resolvePdfjsWorkerSrc();
    expect(options.source).toBe('local');
    expect(options.workerSrc).toMatch(/pdfjs\/pdf\.worker\.min\.mjs$/);
  });

  it('АПК-фото не ходит на сервер: оффлайн-текст доводится до labs', async () => {
    const { createWorker } = await import('tesseract.js');
    (createWorker as any).mockResolvedValue({
      setParameters: async () => {},
      recognize: async () => ({ data: { text: 'АЛТ 35 Е/л 0-41\nГлюкоза 5,4 ммоль/л 3,9-5,5' } }),
      terminate: async () => {},
    });
    const fetchSpy = vi.fn(async () => { throw new Error('server must not be called in APK'); });
    const prevFetch = (globalThis as any).fetch;
    (globalThis as any).fetch = fetchSpy;
    try {
      const file = new File(['x'.repeat(64)], 'lab-photo.jpg', { type: 'image/jpeg' });
      const result = await processUploadedFile(file);
      expect(result.labs.length).toBeGreaterThan(0);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(result.warnings.join(' ')).toMatch(/оффлайн/i);
    } finally {
      (globalThis as any).fetch = prevFetch;
    }
  });

  it('АПК-фото с пустым OCR честно возвращается без сервера', async () => {
    const { createWorker } = await import('tesseract.js');
    (createWorker as any).mockResolvedValue({
      setParameters: async () => {},
      recognize: async () => ({ data: { text: '   ' } }),
      terminate: async () => {},
    });
    const fetchSpy = vi.fn(async () => { throw new Error('server must not be called in APK'); });
    const prevFetch = (globalThis as any).fetch;
    (globalThis as any).fetch = fetchSpy;
    try {
      const file = new File(['x'.repeat(64)], 'lab-photo.jpg', { type: 'image/jpeg' });
      const result = await processUploadedFile(file);
      expect(result.labs).toHaveLength(0);
      expect(result.confidence).toBe(0);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(result.warnings.join(' ')).toMatch(/пустой текст/i);
    } finally {
      (globalThis as any).fetch = prevFetch;
    }
  });

  it('склеивает два прохода только если вместе они находят больше показателей', () => {
    const dense = 'АЛТ 35 Е/л 0-41\nГлюкоза 5,4 ммоль/л 3,9-5,5';
    const sparse = 'Креатинин 92 мкмоль/л 62-106\nТТГ 2,1 мЕд/л 0,4-4,0';
    const chosen = pickBetterLabOcrPass(dense, sparse);
    expect(chosen).toContain('АЛТ');
    expect(chosen).toContain('Креатинин');
    expect(chosen.match(/АЛТ/g)).toHaveLength(1);
  });
});
