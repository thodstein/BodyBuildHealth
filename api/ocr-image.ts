import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

type ServerMealItem = { name: string; qty: string; qtyGrams: number; kcal: number; p: number; f: number; c: number; foodId: string; category: string; confidence: number };

function n(value: string): number {
  return Number.parseFloat(value.replace(',', '.').replace(/[Оо]/g, '0').replace(/[Зз]/g, '3')) || 0;
}

function serverFood(name: string): { name: string; foodId: string; category: string; confidence: number } | null {
  const value = name.toLowerCase();
  if (/кокосов.*масл|coconut\s+oil/.test(value)) return { name: 'Кокосовое масло', foodId: 'coconut_oil', category: 'fat', confidence: 0.95 };
  if (/рисов.*манк|манк.*рисов/.test(value)) return { name: 'Рисовая манка', foodId: 'cereal_semolina', category: 'grain', confidence: 0.95 };
  if (/яичн.*протеин|протеин.*яичн/.test(value)) return { name: 'Яичный протеин', foodId: 'supp_egg_white_powder', category: 'supplement', confidence: 0.95 };
  if (/куриц|chicken/.test(value)) return { name: 'Куриная грудка', foodId: 'chicken_breast', category: 'protein', confidence: 0.95 };
  if (/греч|buckwheat/.test(value)) return { name: 'Гречка', foodId: 'buckwheat', category: 'grain', confidence: 0.95 };
  if (/овся|oat/.test(value)) return { name: 'Овсянка', foodId: 'oats', category: 'grain', confidence: 0.95 };
  if (/банан|banana/.test(value)) return { name: 'Банан', foodId: 'banana', category: 'fruit', confidence: 0.95 };
  return null;
}

function serverNutritionMeals(text: string): Array<{ date: string; mealType: string; items: ServerMealItem[] }> {
  const lines = text.split(/\r?\n/).map(line => line.replace(/[›>‹<'"]+/g, ' ').trim()).filter(Boolean);
  const items: ServerMealItem[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const quantity = lines[i + 1]?.match(/^([0-9ОоЗз]+(?:[.,][0-9ОоЗз]+)?)\s*(?:г|g|r|мл|ml|шт)$/i);
    const macros = lines[i + 2]?.match(/^([0-9ОоЗз]+(?:[.,][0-9ОоЗз]+)?)\s+([0-9ОоЗз]+(?:[.,][0-9ОоЗз]+)?)\s+([0-9ОоЗз]+(?:[.,][0-9ОоЗз]+)?)\s+\d{1,3}\s*%/i);
    if (!quantity || !macros) continue;
    const calorieLine = lines[i].match(/(.+?)\s*[—-]?\s*([0-9ОоЗз]+)\s*[‹>]?$/i);
    if (!calorieLine) continue;
    const food = serverFood(`${calorieLine[1]} ${lines[i + 1] ? '' : ''}`);
    if (!food) continue;
    const grams = n(quantity[1]);
    if (!(grams > 0)) continue;
    const kcal = n(calorieLine[2]);
    const fat = n(macros[1]);
    const carbs = n(macros[2]);
    const protein = n(macros[3]);
    items.push({ ...food, qty: `${grams} г`, qtyGrams: grams, kcal: Math.round(kcal * 100 / grams), p: Math.round(protein * 100 / grams * 10) / 10, f: Math.round(fat * 100 / grams * 10) / 10, c: Math.round(carbs * 100 / grams * 10) / 10 });
    i += 2;
  }
  return items.length ? [{ date: new Date().toISOString().slice(0, 10), mealType: 'Завтрак', items }] : [];
}

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
    return res.status(200).json({ ok: true, text, meals: serverNutritionMeals(text) });
  } catch (error: any) {
    console.error('[ocr-image]', error);
    return res.status(422).json({ ok: false, error: error?.message || 'Server OCR failed' });
  }
}
