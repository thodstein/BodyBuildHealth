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

import { readFileAsArrayBuffer } from '../ocr-engine';
import { resolveTesseractOptions } from '../../engines/ocr-assets';
import { resolvePdfjsWorkerSrc } from '../../engines/ocr-assets';

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
});
