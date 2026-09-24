/**
 * ocr-preprocess.ts — предобработка кадров для оффлайн-OCR скриншотов питания (АПК).
 *
 * Почему это отдельный модуль:
 * - скриншоты FatSecret/МФП чаще тёмные (светлый текст на тёмном фоне) —
 *   tesseract на таком входе возвращает почти пусто;
 * - createImageBitmap с парой resizeWidth+resizeHeight сплющивает высокий
 *   скриншот в квадрат — текст сжимается по вертикали вдвое и не читается;
 * - один проход по «сырому» фото недостаточен: готовим 2–3 варианта
 *   (grayscale / инверсия / контраст) и берём самый текстовый.
 *
 * Всё чистое, кроме canvas-ветки (DOM-guarded: без 2d-контекста — []).
 */

/** data: URL → Blob без fetch (в части WebView fetch(data:) режется CSP). */
export function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl || '');
    if (!match) return null;
    const mime = match[1] || 'image/jpeg';
    const raw = match[3] || '';
    if (match[2]) {
      const bin = atob(raw);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new Blob([bytes.buffer as ArrayBuffer], { type: mime });
    }
    return new Blob([decodeURIComponent(raw)], { type: mime });
  } catch {
    return null;
  }
}

/** Средняя яркость кадра (0–255) по RGBA-пикселям. Чистая, тестируемая. */
export function meanLuminance(data: Uint8ClampedArray | number[], step = 4): number {
  let sum = 0;
  let count = 0;
  for (let i = 0; i + 2 < data.length; i += 4 * Math.max(1, step)) {
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    count += 1;
  }
  return count > 0 ? sum / count : 128;
}

/** Тёмный ли кадр (тёмная тема приложения): инверсия обязательна. */
export function isDarkFrame(data: Uint8ClampedArray | number[], step = 4): boolean {
  return meanLuminance(data, step) < 110;
}

/**
 * Оценка «текстовости» OCR-результата. Длинный осмысленный текст выигрывает;
 * цифры и КБЖУ-маркеры (ккал/г/Б/Ж/У/%) дают бонус — для скриншотов питания
 * строка «Курица 200 г 330 ккал» ценнее абзаца мусора без цифр.
 * Чистая, тестируемая.
 */
export function scoreOcrText(text: string): number {
  if (!text) return 0;
  const meaningful = (text.match(/[A-Za-zА-Яа-яЁё0-9]/g) || []).length;
  const digits = (text.match(/[0-9]/g) || []).length;
  const macroHits = (text.match(/ккал|kcal|кал\b|г\b|мл\b|бел|жир|угл|protein|fat|carb/gi) || []).length;
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length >= 3).length;
  return meaningful + digits * 2 + macroHits * 12 + lines * 3;
}

/** Лучший из вариантов (первый при равенстве — детерминизм). */
export function pickBestOcrText(texts: string[]): string {
  let best = '';
  let bestScore = -1;
  for (const t of texts) {
    const s = scoreOcrText(t || '');
    if (s > bestScore) {
      bestScore = s;
      best = t || '';
    }
  }
  return best;
}

/** Достаточно ли текста, чтобы не гнать второй (медленный) проход. */
export function isGoodOcrText(text: string): boolean {
  if (!text) return false;
  const t = text.trim();
  if (t.length < 24) return false;
  const digits = (t.match(/[0-9]/g) || []).length;
  const letters = (t.match(/[A-Za-zА-Яа-яЁё]/g) || []).length;
  return digits >= 3 && letters >= 6;
}

/**
 * Есть ли в тексте строки с макросами (Б:/Ж:/У:, Белки/Жиры/Углеводы, ...).
 * FatSecret кладёт макросы отдельными колонками, которые PSM-6 часто роняет:
 * без таких строк разреженный PSM-11 обязателен даже при «хорошем» тексте.
 */
export function hasMacroLabels(text: string): boolean {
  if (!text) return false;
  return /(?:^|\s)(?:Б|Ж|У)\s*:|белки?|жиры?|углеводы?|угл\b|protein|fat|carbs?/i.test(text);
}

/** Полный гейт раннего выхода: хороший текст УЖЕ с макросами. */
export function isCompleteOcrText(text: string): boolean {
  return isGoodOcrText(text) && hasMacroLabels(text);
}

/** Food diary structure alone is meaningful even before macro columns are recovered. */
export function isNutritionDiaryOcrText(text: string): boolean {
  if (!text) return false;
  const foodRows = (text.match(/(?:\d+(?:[.,]\d+)?\s*(?:г|g|ml|мл|oz|serving|cup|slice)\s+\d+(?:[.,]\d+)?\s*(?:ккал|kcal|cal)|\d+(?:[.,]\d+)?\s*(?:ккал|kcal|cal)\s+[^\n]{2,})/gi) || []).length;
  const appMarker = /(?:my\s*fitness\s*pal|myfitnesspal|fatsecret|food\s+diary|дневник\s+питания)/i.test(text);
  const mealHeaders = (text.match(/(?:breakfast|lunch|dinner|snacks?|завтрак|обед|ужин|перекус)/gi) || []).length;
  const compactDiaryRows = (text.match(/[^\n]{2,}\s+\d+(?:[.,]\d+)?\s*(?:ккал|kcal|cal)\s+\d+(?:[.,]\d+)?(?:\s+\d+(?:[.,]\d+)?){0,3}(?:\s|$)/gi) || []).length;
  const separateMealRows = (text.match(/(?:breakfast|lunch|dinner|snacks?|завтрак|обед|ужин|перекус)\b/gi) || []).length;
  return foodRows >= 2 || compactDiaryRows >= 2 || (appMarker && mealHeaders >= 1 && /(?:ккал|kcal|calories?)/i.test(text)) || separateMealRows >= 2;
}

export interface OcrVariant {
  kind: 'gray' | 'inverted' | 'contrast';
  blob: Blob;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b), 'image/png');
    } catch {
      resolve(null);
    }
  });
}

/**
 * Готовит варианты кадра для tesseract: grayscale + автоконтраст,
 * инверсия при тёмной теме, контрастный вариант для блёклых скринов.
 * Возвращает [] без DOM/2d-контекста — вызыватель берёт исходник как есть.
 */
export async function preprocessVariantsForOcr(source: HTMLCanvasElement | Blob): Promise<OcrVariant[]> {
  try {
    if (typeof document === 'undefined') return [];
    let base: HTMLCanvasElement;
    if (source instanceof Blob) {
      const bitmap = await createImageBitmap(source).catch(() => null);
      if (!bitmap) return [];
      base = document.createElement('canvas');
      // Кап по длинной стороне: скрин 1080×2400 → ~720×1600, текст цел,
      // воркер на телефоне не задыхается.
      const cap = 1600;
      const scale = Math.min(1, cap / Math.max(bitmap.width, bitmap.height));
      base.width = Math.max(1, Math.round(bitmap.width * scale));
      base.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = base.getContext('2d');
      if (!ctx) {
        try { bitmap.close(); } catch { /* ignore */ }
        return [];
      }
      ctx.drawImage(bitmap, 0, 0, base.width, base.height);
      try { bitmap.close(); } catch { /* ignore */ }
    } else {
      base = source;
    }
    const ctx = base.getContext('2d');
    if (!ctx) return [];
    let image: ImageData;
    try {
      image = ctx.getImageData(0, 0, base.width, base.height);
    } catch {
      return [];
    }
    const px = image.data;
    // Grayscale + гистограмма для автоконтраста.
    const gray = new Uint8ClampedArray((px.length / 4) | 0);
    let lo = 255;
    let hi = 0;
    for (let i = 0, j = 0; i + 3 < px.length; i += 4, j++) {
      const g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      gray[j] = g;
      if (g < lo) lo = g;
      if (g > hi) hi = g;
    }
    const dark = meanLuminance(px, 8) < 110;
    const stretch = hi - lo > 12
      ? (g: number) => Math.max(0, Math.min(255, ((g - lo) * 255) / (hi - lo)))
      : (g: number) => g;
    const paint = (out: HTMLCanvasElement, fn: (g: number) => number): boolean => {
      const c = out.getContext('2d');
      if (!c) return false;
      const img = c.createImageData(out.width, out.height);
      const d = img.data;
      for (let i = 0, j = 0; i + 3 < d.length; i += 4, j++) {
        const v = Math.round(fn(gray[j]));
        d[i] = v;
        d[i + 1] = v;
        d[i + 2] = v;
        d[i + 3] = 255;
      }
      c.putImageData(img, 0, 0);
      return true;
    };
    const variants: OcrVariant[] = [];
    const mk = (w: number, h: number): HTMLCanvasElement | null => {
      try {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        return c;
      } catch {
        return null;
      }
    };
    // 1) grayscale + автоконтраст — базовый вариант всегда.
    const grayCanvas = mk(base.width, base.height);
    if (grayCanvas && paint(grayCanvas, stretch)) {
      const blob = await canvasToBlob(grayCanvas);
      if (blob) variants.push({ kind: 'gray', blob });
    }
    // 2) инверсия — для тёмной темы обязательна, для светлой бесполезна.
    if (dark) {
      const inv = mk(base.width, base.height);
      if (inv && paint(inv, (g) => 255 - stretch(g))) {
        const blob = await canvasToBlob(inv);
        if (blob) variants.push({ kind: 'inverted', blob });
      }
    } else {
      // Светлый, но блёклый скрин: жёсткий порог как запасной вариант.
      const mid = (lo + hi) / 2;
      const hard = mk(base.width, base.height);
      if (hard && paint(hard, (g) => (stretch(g) >= mid ? 255 : 0))) {
        const blob = await canvasToBlob(hard);
        if (blob) variants.push({ kind: 'contrast', blob });
      }
    }
    return variants;
  } catch {
    return [];
  }
}
