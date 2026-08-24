import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { parseNutritionText } from '../src/engines/nutrition-ocr-parser.ts';

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
    const result = await withTimeout(worker.recognize(buffer), OCR_TIMEOUT_MS, 'recognition');
    return typeof result.data.text === 'string' ? result.data.text : '';
  } finally {
    await worker.terminate();
  }
}

async function recognizeImage(buffer: Buffer): Promise<string> {
  const text = (await recognizePass(buffer, 'rus')).trim();
  if (text) return text;
  throw new Error('OCR returned empty text');
}

function nutritionOcrScore(text: string, language: keyof typeof TESSERACT_LANG_PATHS): number {
  const labels = text.match(/жир|углев|белк|ккал|калори|fat|carb|protein|calor|завтрак|обед|ужин|breakfast|lunch|dinner/gi)?.length || 0;
  const foodWords = text.match(/куриц|рис|манк|протеин|масло|chicken|rice|protein|oil|oat|beef|salmon/gi)?.length || 0;
  const numericRows = text.split(/\r?\n/).filter(line => (line.match(/\d+(?:[.,]\d+)?/g)?.length || 0) >= 3).length;
  const scriptWords = language === 'rus'
    ? (text.match(/[А-Яа-яЁё]{3,}/g)?.length || 0)
    : (text.match(/[A-Za-z]{3,}/g)?.length || 0);
  return labels * 10 + foodWords * 8 + numericRows * 3 + scriptWords;
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
    let meals: unknown = undefined;
    try { meals = parseNutritionText(text); } catch { meals = []; }
    return res.status(200).json({ ok: true, text, meals });
  } catch (error: any) {
    console.error('[ocr-image]', error);
    return res.status(422).json({ ok: false, error: error?.message || 'Server OCR failed' });
  }
}
