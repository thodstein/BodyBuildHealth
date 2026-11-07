import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const MAX_BYTES = 12 * 1024 * 1024;
const OCR_TIMEOUT_MS = 25_000;

function withTimeout<T>(promise: Promise<T>, ms: number, stage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`OCR ${stage} timeout after ${ms} ms`)), ms)),
  ]);
}

const TESSERACT_WORKER_PATH = require.resolve('tesseract.js/src/worker-script/node/index.js');
const TESSERACT_CORE_PATH = dirname(require.resolve('tesseract.js-core'));
const TESSERACT_LANG_PATHS = {
  // best_int is faster and produced more coherent FatSecret rows than the
  // full model on mobile diary screenshots.
  rus: join(dirname(require.resolve('@tesseract.js-data/rus')), '4.0.0_best_int'),
  eng: join(dirname(require.resolve('@tesseract.js-data/eng')), '4.0.0_best_int'),
} as const;

export const config = {
  api: { bodyParser: { sizeLimit: '16mb' } },
};

async function preprocessForOcr(buffer: Buffer): Promise<Buffer> {
  try {
    const { createCanvas, loadImage } = await import('@napi-rs/canvas');
    const img: any = await loadImage(buffer as any);
    const w = (img as any).width as number;
    const h = (img as any).height as number;
    if (!w || !h || w * h > 12_000_000) return buffer;
    const canvas: any = createCanvas(w, h);
    const ctx: any = canvas.getContext('2d');
    if (!ctx) return buffer;
    ctx.drawImage(img as any, 0, 0, w, h);
    const image: any = ctx.getImageData(0, 0, w, h);
    const data: Uint8ClampedArray = image.data;
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) sum += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    const avg = sum / (data.length / 4);
    const isDark = avg < 110;
    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      const contrast = Math.max(0, Math.min(255, (gray - 128) * 1.5 + 128));
      let val = gray < 160 ? Math.max(0, contrast - 20) : 255;
      if (isDark) val = 255 - val;
      data[i] = val; data[i + 1] = val; data[i + 2] = val;
    }
    ctx.putImageData(image, 0, 0);
    return canvas.toBuffer('image/png' as any) as Buffer;
  } catch { return buffer; }
}

async function recognizePass(buffer: Buffer, language: keyof typeof TESSERACT_LANG_PATHS): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const worker = await withTimeout(createWorker(language, 1, {
    workerPath: TESSERACT_WORKER_PATH,
    corePath: TESSERACT_CORE_PATH,
    langPath: TESSERACT_LANG_PATHS[language],
    cacheMethod: 'none',
    gzip: true,
    logger: () => {},
  } as any), OCR_TIMEOUT_MS, 'worker initialization');
  try {
    await withTimeout(worker.setParameters({
      tessedit_pageseg_mode: '6' as any,
      preserve_interword_spaces: '1',
      user_defined_dpi: '300',
    }), OCR_TIMEOUT_MS, 'worker configuration');
    const enhanced = await withTimeout(preprocessForOcr(buffer), 5_000, 'preprocess');
    const result = await withTimeout(worker.recognize(enhanced as any), OCR_TIMEOUT_MS, 'recognition');
    return typeof result.data.text === 'string' ? result.data.text : '';
  } finally {
    await worker.terminate();
  }
}

/**
 * Слияние двух языковых проходов OCR.
 *
 * Английский проход нужен, чтобы дочитать латинские метки (HbA1c, TSH, ALT,
 * HDL…), которые русская модель превращает в кириллический мусор. Но если
 * русский проход уже прочитал таблицу КБЖУ, английский добавлял второй набор
 * строк-двойников (латиница вместо кириллицы), и парсер видел позицию дважды.
 */
const CYRILLIC_NUTRITION_MARKER = /ккал|калори|белк|жир|углев|порци|завтрак|обед|ужин|перекус/gi;
const LATIN_OCR_MARKER = /\b(?:hba1c|tsh|alt|ast|hdl|ldl|vldl|crp|psa|gfr|esr|mcv|mch|mchc|rdw|wbc|rbc|plt|hgb|ggt|t3|t4|ft3|ft4|igf|apob|homocysteine|vitamin\s*[a-k]|protein|fat|carbs?|carbohydrates?|kcal|kj|energy|fiber|sodium|potassium|magnesium|calcium|iron|zinc)\b/gi;

function countMatches(text: string, pattern: RegExp): number {
  return (text.match(pattern) || []).length;
}

export function mergeOcrPasses(rusText: string, engText: string): string {
  const rus = (rusText || '').trim();
  const eng = (engText || '').trim();
  if (!rus) return eng;
  if (!eng) return rus;
  // Русская этикетка/дневник уже прочитаны — латинский проход только продублирует строки.
  if (countMatches(rus, CYRILLIC_NUTRITION_MARKER) >= 1) return rus;
  const rusLatin = countMatches(rus, LATIN_OCR_MARKER);
  const engLatin = countMatches(eng, LATIN_OCR_MARKER);
  if (engLatin > rusLatin) return `${rus}\n${eng}`;
  return rus;
}

async function recognizeImage(buffer: Buffer): Promise<string> {
  const rus = (await recognizePass(buffer, 'rus')).trim();
  // Вторая модель — латинские аббревиатуры. На русском бланке анализов метки
  // (HbA1c, TSH, ALT, HDL) печатаются латиницей, и проход 'rus' читает их как
  // мусор — маркер терялся, пользователю «не найдено показателей». Проход
  // 'eng' возвращает ровно эти метки. Сбои модели не роняют ответ: русский
  // текст уже получен.
  let eng = '';
  try { eng = (await recognizePass(buffer, 'eng')).trim(); } catch { /* опциональный проход */ }
  const merged = mergeOcrPasses(rus, eng);
  if (merged) return merged;
  throw new Error('OCR returned empty text');
}

function decodeBase64(value: string): Buffer {
  const normalized = value
    .replace(/^data:[^;,]+;base64,/i, '')
    .replace(/\s+/g, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  if (!normalized || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
    throw new Error('Image data must be valid base64');
  }
  return Buffer.from(normalized, 'base64');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  try {
    const encoded = typeof req.body?.data === 'string' ? req.body.data : '';
    if (!encoded) return res.status(400).json({ ok: false, error: 'Image data is required' });
    const buffer = decodeBase64(encoded);
    if (buffer.length === 0 || buffer.length > MAX_BYTES) {
      return res.status(413).json({ ok: false, error: 'Image must be between 1 byte and 12 MB' });
    }
    const text = await recognizeImage(buffer);
    return res.status(200).json({ ok: true, text });
  } catch (error: any) {
    console.error('[ocr-image]', error);
    return res.status(422).json({ ok: false, error: error?.message || 'Server OCR failed' });
  }
}
