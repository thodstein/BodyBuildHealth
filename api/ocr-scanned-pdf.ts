import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createCanvas } from '@napi-rs/canvas';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const MAX_BYTES = 12 * 1024 * 1024;
const MAX_PAGES = 8;
const MAX_PAGE_PIXELS = 4_000_000;
const require = createRequire(import.meta.url);

function localRussianLangPath(): string {
  return require('@tesseract.js-data/rus').langPath;
}

function localEnglishLangPath(): string {
  return require('@tesseract.js-data/eng').langPath;
}

/**
 * Модели OCR, которые прогоняются по одному изображению.
 * Русский бланк анализов содержит ЛАТИНСКИЕ аббревиатуры (HbA1c, TSH, ALT,
 * HDL, LDL, GFR) — они латиницей даже в полностью русском документе. Проход
 * одной русской модели читает их как мусор, и показатель терялся («не найдено
 * показателей»). Проход 'eng' возвращает ровно эти метки, поэтому оба текста
 * склеиваются: парсеры ниже дедуплицируют маркер по коду, дублей строк нет.
 */
const OCR_PASSES: Array<{ lang: string; langPath: string }> = [
  { lang: 'rus', langPath: localRussianLangPath() },
  { lang: 'eng', langPath: localEnglishLangPath() },
];

/** Выполнить fn на воркере каждой модели; воркеры гасятся всегда. */
async function forEachOcrPass<T>(fn: (worker: any) => Promise<T>): Promise<T[]> {
  const { createWorker } = await import('tesseract.js');
  const results: T[] = [];
  for (const pass of OCR_PASSES) {
    const worker = await createWorker(pass.lang, 1, { langPath: pass.langPath, gzip: true } as any);
    try {
      results.push(await fn(worker));
    } finally {
      await worker.terminate();
    }
  }
  return results;
}

export const config = {
  api: { bodyParser: { sizeLimit: '16mb' } },
};

async function recognizeImage(buffer: Buffer): Promise<string> {
  const texts = await forEachOcrPass(async (worker) => {
    await worker.setParameters({ tessedit_pageseg_mode: '3' as any, preserve_interword_spaces: '1', user_defined_dpi: '300' });
    const result = await worker.recognize(buffer);
    return result.data.text || '';
  });
  return texts.filter(t => t.trim()).join('\n');
}

async function recognizePdf(buffer: Buffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // PDF.js v6 still starts its fake worker in Node unless a real worker file
  // is provided. Keep the worker as a static dependency in the serverless
  // function instead of relying on the browser public asset.
  const workerPath = join(dirname(fileURLToPath(import.meta.url)), '../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');
  (pdfjs as any).GlobalWorkerOptions.workerSrc = workerPath;
  const quick = await (pdfjs as any).getDocument({ data: new Uint8Array(buffer), disableWorker: true, useWorker: false } as any).promise;
  try {
    const text: string[] = [];
    for (let number = 1; number <= quick.numPages; number++) {
      const page = await quick.getPage(number);
      const content = await page.getTextContent();
      const row = content.items.map((item: any) => item.str || '').join(' ').trim();
      if (row) text.push(row);
    }
    const quickText = text.join('\n');
    if (quickText.length > 80) return quickText;
  } finally {
    await quick.cleanup?.();
    await (quick as any).destroy?.();
  }
  const { createWorker } = await import('tesseract.js');
  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
    useWorkerFetch: false,
    isEvalSupported: false,
    useWorker: false,
  } as any).promise;
  if (pdf.numPages > MAX_PAGES) throw new Error(`PDF содержит ${pdf.numPages} страниц, максимум ${MAX_PAGES}`);

  const pages: string[] = [];
  try {
    for (const pageTexts of await forEachOcrPass(async (worker) => {
      await worker.setParameters({
        tessedit_pageseg_mode: '3' as any,
        preserve_interword_spaces: '1',
        user_defined_dpi: '300',
      });
      const texts: string[] = [];
      for (let number = 1; number <= pdf.numPages; number++) {
        const page = await pdf.getPage(number);
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(2.5, Math.sqrt(MAX_PAGE_PIXELS / Math.max(1, base.width * base.height)));
        const viewport = page.getViewport({ scale });
        const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        const context = canvas.getContext('2d');
        await page.render({ canvas: canvas as any, canvasContext: context as any, viewport }).promise;
        const result = await worker.recognize(canvas as any);
        if (result.data.text?.trim()) texts.push(result.data.text);
        page.cleanup?.();
      }
      return texts;
    })) {
      for (const t of pageTexts) pages.push(t);
    }
  } finally {
    // pdfjs держит таймеры/память: без этого serverless-инстанс не остывает.
    await pdf.cleanup?.();
    await (pdf as any).destroy?.();
  }
  return pages.join('\n');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  try {
    const encoded = typeof req.body?.data === 'string' ? req.body.data : '';
    if (!encoded) return res.status(400).json({ ok: false, error: 'File data is required' });
    const buffer = Buffer.from(encoded, 'base64');
    if (buffer.length === 0 || buffer.length > MAX_BYTES) {
      return res.status(413).json({ ok: false, error: 'PDF must be between 1 byte and 12 MB' });
    }
    const text = req.body?.kind === 'image' ? await recognizeImage(buffer) : await recognizePdf(buffer);
    return res.status(200).json({ ok: true, text });
  } catch (error: any) {
    console.error('[ocr-scanned-pdf]', error);
    return res.status(422).json({ ok: false, error: error?.message || 'Server OCR failed' });
  }
}
