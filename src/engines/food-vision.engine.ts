/**
 * food-vision.engine.ts — клиент AI-распознавания еды/этикетки/бланка.
 *
 * Разделение ответственности (почему так):
 *  1. AI узнаёт ЧТО на фото (продукт, граммы, уверенность) — это его сильная сторона.
 *  2. КБЖУ берёт локальная FOOD_DB через `findFood` — это источник истины, он
 *     проверяем, не галлюцинирует и не меняется от версии модели.
 *  3. Оценка модели (`estimate`) используется только для продукта, которого в
 *     базе нет, и помечается низкой уверенностью + предупреждением в UI.
 *
 * Инвариант формата: `ParsedMeal.items` — КБЖУ **на 100 г** + `qtyGrams`
 * (как у `normalizeItem` в nutrition-ocr-parser). Дневник умножает значения
 * на `qty/100` при сохранении, поэтому отдавать сюда КБЖУ порции нельзя —
 * получится двойной пересчёт.
 *
 * Эндпоинт: `/api/food-vision` в web/Vercel. В APK (Capacitor) относительный
 * `/api` резолвится в `https://localhost` и падает — там нужен абсолютный
 * `VITE_FOOD_VISION_URL`; без него движок честно говорит «выключено», и
 * приложение остаётся на офлайн-OCR.
 */
import { readFileAsArrayBuffer } from '../core/ocr-engine';
import { isCapacitorNative } from '../core/app-platform';
import {
  fillMissingMicros,
  findFood,
  localTodayDate,
  type NutritionMicros,
  type ParsedMeal,
} from './nutrition-ocr-parser';
import type { ParsedNutritionLabel } from './nutrition-label-parser';
import type { FoodItem } from '../core/nutrition-database';
import {
  isFoodVisionFoodPayload,
  isFoodVisionLabPayload,
  isFoodVisionLabelPayload,
  type FoodVisionApiResponse,
  type FoodVisionClientResult,
  type FoodVisionFoodPayload,
  type FoodVisionItem,
  type FoodVisionLabPayload,
  type FoodVisionLabelPayload,
  type FoodVisionPayload,
  type FoodVisionPurpose,
} from './food-vision.types';

/** Относительный адрес эндпоинта в web-сборке. */
export const FOOD_VISION_PATH = '/api/food-vision';

/**
 * Продовый деплой для APK. В Capacitor относительный `/api` резолвится в
 * `https://localhost`, поэтому без явного адреса vision не работал бы вовсе.
 * Абсолютный URL можно переопределить при сборке через VITE_FOOD_VISION_URL.
 */
const DEFAULT_NATIVE_VISION_URL = 'https://body-build-health.vercel.app/api/food-vision';

/** Бюджет ответа: серверная функция живёт 60 с. */
const REQUEST_TIMEOUT_MS = 50_000;

const MIN_GRAMS = 1;
const MAX_GRAMS = 5000;

/** Мини-кэш по хэшу картинки: повторная загрузка того же фото не тратит квоту. */
const CACHE_LIMIT = 8;
const responseCache = new Map<string, FoodVisionClientResult>();

/** Сброс кэша — только для тестов. */
export function resetFoodVisionCache(): void {
  responseCache.clear();
}

/**
 * Адрес эндпоинта: явный `VITE_FOOD_VISION_URL` (АПК), иначе `/api/food-vision`
 * в web. `undefined` = vision недоступен в этом окружении.
 */
export function resolveFoodVisionEndpoint(): string | undefined {
  let configured = '';
  // ВАЖНО: только буквальный import.meta.env.VITE_FOOD_VISION_URL подхватывается
  // подстановкой Vite в прод-сборке (через `import.meta.env?.X` замена не
  // срабатывает — проверено на VITE_APP_PLATFORM, см. core/app-platform.ts).
  try {
    const value: string | undefined = import.meta.env.VITE_FOOD_VISION_URL;
    configured = typeof value === 'string' ? value.trim() : '';
  } catch {
    configured = '';
  }
  if (configured) return configured.replace(/\/+$/, '');
  if (isCapacitorNative()) return DEFAULT_NATIVE_VISION_URL;
  return FOOD_VISION_PATH;
}

export function isFoodVisionAvailable(): boolean {
  return Boolean(resolveFoodVisionEndpoint());
}

function hashImage(base64: string): string {
  let hash = 5381;
  for (let i = 0; i < base64.length; i += 1) {
    hash = ((hash << 5) + hash + base64.charCodeAt(i)) | 0;
  }
  return `${(hash >>> 0).toString(36)}-${base64.length.toString(36)}`;
}

function toCacheKey(purpose: FoodVisionPurpose, base64: string): string {
  return `${purpose}:${hashImage(base64)}`;
}

function remember(key: string, result: FoodVisionClientResult): void {
  if (responseCache.size >= CACHE_LIMIT) {
    const oldest = responseCache.keys().next().value;
    if (oldest) responseCache.delete(oldest);
  }
  responseCache.set(key, result);
}

function clampGrams(value: unknown): number {
  const parsed = Number(value);
  const base = Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 100;
  return Math.max(MIN_GRAMS, Math.min(MAX_GRAMS, base));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

const FOOD_STATE_RU: Record<string, string> = {
  raw: 'сырой',
  cooked: 'готовый',
  dry: 'сухой',
  powder: 'порошок',
  liquid: 'жидкий',
  as_is: 'как есть',
};

/**
 * Расхождение «как видит ИИ» и «что лежит в базе» предупреждаем, но числа
 * НЕ переписываем: сухая крупа и варёная отличаются втрое по ккал, и молча
 * подменить продукт — худший вариант, чем показать предупреждение.
 */
function stateWarning(item: FoodVisionItem, food: FoodItem): string | undefined {
  const dbState = food.foodState;
  if (!dbState) return undefined;
  const aiState = item.state;
  const conflict =
    (aiState === 'cooked' && (dbState === 'dry' || dbState === 'powder')) ||
    (aiState === 'raw' && dbState === 'cooked');
  if (!conflict) return undefined;
  return `«${item.name}»: ИИ видит ${FOOD_STATE_RU[aiState as string] || aiState}, а в базе — ${FOOD_STATE_RU[dbState] || dbState} (${food.name}). Проверьте граммовку.`;
}

function pushUnique(target: string[], message: string): void {
  if (message && !target.includes(message)) target.push(message);
}

/**
 * payload модели → позиции для очереди дневника (КБЖУ на 100 г + qtyGrams).
 * Чистая функция: без сети, без состояния — держит поведение тестируемым.
 */
export function mapFoodPayloadToMeals(payload: FoodVisionFoodPayload): {
  meals: ParsedMeal[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const items: ParsedMeal['items'] = [];
  const date = localTodayDate();

  // Что модель сама считает неясным, важнее среднего confidence: «масло?» или
  // «размер порции?» меняют калории вдвое, и пользователь должен это увидеть.
  const overall = Number(payload.overallConfidence);
  if (Number.isFinite(overall) && overall > 0 && overall < 0.6) {
    pushUnique(
      warnings,
      `Низкая уверенность распознавания (${Math.round(overall * 100)}%) — проверьте вес и состав перед сохранением.`,
    );
  }
  for (const need of payload.needsUserInput || []) {
    pushUnique(warnings, `Уточните: ${need}`);
  }

  for (const item of payload.items) {
    const grams = clampGrams(item.grams);
    const confidence = Math.max(0, Math.min(1, Number(item.confidence) || 0));
    const food = findFood(item.name) || (item.nameEn ? findFood(item.nameEn) : undefined) || undefined;

    if (!food) {
      if (item.estimate) {
        const estimate = item.estimate;
        pushUnique(
          warnings,
          `«${item.name}» нет в локальной базе — КБЖУ оценены ИИ (низкая точность), проверьте перед сохранением.`,
        );
        items.push({
          name: item.name,
          qty: `${grams} г`,
          qtyGrams: grams,
          // estimate уже «на 100 г» — формат очереди совпадает, пересчёт не нужен.
          kcal: Math.round(estimate.kcalPer100g),
          p: round1(estimate.proteinPer100g),
          f: round1(estimate.fatPer100g),
          c: round1(estimate.carbsPer100g),
          category: item.category || 'other',
          confidence: round1(Math.min(0.3, confidence || 0.3)),
        });
      } else {
        pushUnique(warnings, `«${item.name}» не найден в базе и без оценки ИИ — позиция пропущена.`);
      }
      continue;
    }

    const warning = stateWarning(item, food);
    if (warning) pushUnique(warnings, warning);
    // Сервер всегда присылает confidence (0..1), поэтому 0 — это «модель не
    // уверена», а не «поля нет»: подставлять 0.6 молча нельзя.
    items.push({
      name: item.name || food.name,
      qty: `${grams} г`,
      qtyGrams: grams,
      kcal: food.kcal,
      p: food.protein,
      f: food.fat,
      c: food.carbs,
      micros: fillMissingMicros(food.name, grams),
      foodId: food.id,
      category: food.category,
      confidence: round1(warning ? Math.min(0.5, confidence) : confidence),
    });
  }

  return {
    meals: items.length ? [{ date, mealType: 'Приём пищи', items }] : [],
    warnings,
  };
}

/** Этикетка → одна позиция на 100 г. */
export function mapLabelPayloadToMeals(payload: FoodVisionLabelPayload): {
  meals: ParsedMeal[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const name = payload.brand ? `${payload.productName} (${payload.brand})` : payload.productName;
  const micros: Record<string, number> = {};
  if (typeof payload.per100g.sodiumMg === 'number' && payload.per100g.sodiumMg > 0) {
    micros.sodium_mg = payload.per100g.sodiumMg;
  }
  if (typeof payload.per100g.fiber === 'number' && payload.per100g.fiber > 0) {
    micros.fiber_g = payload.per100g.fiber;
  }
  pushUnique(warnings, 'Данные прочитаны с этикетки ИИ — сверьте цифры с упаковкой.');
  return {
    meals: [
      {
        date: localTodayDate(),
        mealType: 'Приём пищи',
        items: [
          {
            name,
            qty: '100 г',
            qtyGrams: 100,
            kcal: Math.round(payload.per100g.kcalPer100g),
            p: round1(payload.per100g.proteinPer100g),
            f: round1(payload.per100g.fatPer100g),
            c: round1(payload.per100g.carbsPer100g),
            micros: Object.keys(micros).length ? micros : undefined,
            category: 'other',
            confidence: round1(Math.max(0, Math.min(1, payload.confidence))),
          },
        ],
      },
    ],
    warnings,
  };
}

/**
 * Этикетка ИИ → тот же контракт, что отдаёт OCR-парсер этикетки
 * (`ParsedNutritionLabel`), поэтому панель «КБЖУ с упаковки» принимает
 * результат без отдельной ветки: значения уже на 100 г, basis='100g'.
 */
export function mapLabelPayloadToNutritionLabel(payload: FoodVisionLabelPayload, rawText = ''): ParsedNutritionLabel {
  const micros: NutritionMicros = {};
  if (typeof payload.per100g.sodiumMg === 'number' && payload.per100g.sodiumMg > 0) {
    micros.sodium_mg = payload.per100g.sodiumMg;
  }
  if (typeof payload.per100g.fiber === 'number' && payload.per100g.fiber > 0) {
    micros.fiber_g = payload.per100g.fiber;
  }
  return {
    name: payload.productName,
    brand: payload.brand,
    kcal: Math.round(payload.per100g.kcalPer100g),
    protein: round1(payload.per100g.proteinPer100g),
    fat: round1(payload.per100g.fatPer100g),
    carbs: round1(payload.per100g.carbsPer100g),
    fiber: round1(payload.per100g.fiber || 0),
    micros,
    servingSize: payload.servingSize || '100 г',
    basis: '100g',
    confidence: Math.max(0, Math.min(1, payload.confidence)),
    rawText,
    warnings: ['КБЖУ прочитаны ИИ с фото упаковки — сверьте цифры с этикеткой перед сохранением.'],
  };
}

/** Бланк анализов не попадает в дневник питания: только значения + предупреждения. */
export function mapLabPayload(payload: FoodVisionLabPayload): {
  meals: ParsedMeal[];
  warnings: string[];
  lab: FoodVisionLabPayload['values'];
} {
  const warnings: string[] = [];
  for (const value of payload.values) {
    if (value.confidence < 0.5) {
      pushUnique(warnings, `«${value.name}» прочитан с низкой уверенностью (${Math.round(value.confidence * 100)}%).`);
    }
  }
  for (const warning of payload.warnings || []) pushUnique(warnings, warning);
  return { meals: [], warnings, lab: payload.values };
}

export function mapVisionPayload(
  purpose: FoodVisionPurpose,
  payload: FoodVisionPayload,
): {
  meals: ParsedMeal[];
  warnings: string[];
  lab?: FoodVisionLabPayload['values'];
  label?: FoodVisionLabelPayload;
} {
  if (purpose === 'lab') {
    if (!isFoodVisionLabPayload(payload)) {
      return { meals: [], warnings: ['Ответ ИИ не похож на бланк анализов.'] };
    }
    return mapLabPayload(payload);
  }
  if (purpose === 'label') {
    if (!isFoodVisionLabelPayload(payload)) {
      return { meals: [], warnings: ['Ответ ИИ не похож на этикетку.'] };
    }
    return { ...mapLabelPayloadToMeals(payload), label: payload };
  }
  if (!isFoodVisionFoodPayload(payload)) {
    return { meals: [], warnings: ['Ответ ИИ не содержит списка продуктов.'] };
  }
  return mapFoodPayloadToMeals(payload);
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await readFileAsArrayBuffer(blob);
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...Array.from(bytes.subarray(offset, offset + chunk)));
  }
  return btoa(binary);
}

/**
 * Разрешение vision-кадра: мелкие цифры этикетки на 1280 px расплываются.
 * Проходы идут от лучшего качества к худшему, пока тело запроса влезает в
 * платформенный лимит Vercel (4.5 МБ): base64 раздувает байты в 4/3, поэтому
 * 2048 px/0.92 на плотном кадре легко даёт 413 — платформенный ответ без CORS,
 * который в WebView выглядит как «нет сети».
 */
const VISION_PASSES = [
  { maxSide: 2048, maxPixels: 4_500_000, quality: 0.92 },
  { maxSide: 1600, maxPixels: 2_600_000, quality: 0.85 },
  { maxSide: 1280, maxPixels: 1_600_000, quality: 0.75 },
] as const;

/** Символов base64 в теле: 4.3 МБ ≈ 3.2 МБ картинки + конверт JSON. */
const VISION_BASE64_BUDGET = 4_300_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: any;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error('image prepare timeout')), ms);
    try {
      timer?.unref?.();
    } catch {
      /* не Node */
    }
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Подготовка кадра для модели. Отдельно от `prepareImageForServer`: у OCR-пути
 * свой баланс «размер/читаемость» (1280 px, JPEG 0.65), а этикетке нужны
 * пиксели — иначе «1,5 г» превращается в «15 г». Проходы подбираются по
 * фактическому размеру base64, а не по разрешению: у шумного кадра JPEG
 * тяжелее, чем у текста при том же размере. При недоступном canvas
 * (jsdom/старый WebView) честно отдаём оригинал через OCR-путь.
 */
async function prepareVisionImage(file: File, highRes: boolean): Promise<{ base64: string; mimeType: string }> {
  if (typeof document !== 'undefined' && typeof createImageBitmap === 'function') {
    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await withTimeout(createImageBitmap(file), 15_000);
      // Тарелке 2048 px не нужны: продукты узнаются и на 1600, а лишние
      // ~1 Мп картинки стоят секунд ответа. Мелкие цифры этикетки — наоборот.
      const passes = highRes ? VISION_PASSES : [VISION_PASSES[1], VISION_PASSES[2]];
      let last: { base64: string; mimeType: string } | null = null;
      for (const pass of passes) {
        const scale = Math.min(
          1,
          pass.maxSide / Math.max(bitmap.width, bitmap.height),
          Math.sqrt(pass.maxPixels / Math.max(1, bitmap.width * bitmap.height)),
        );
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('canvas 2d unavailable');
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const blob = await withTimeout(
          new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', pass.quality)),
          12_000,
        );
        if (!blob) throw new Error('canvas encode failed');
        last = { base64: await blobToBase64(blob), mimeType: 'image/jpeg' };
        if (last.base64.length <= VISION_BASE64_BUDGET) return last;
      }
      // Не влезло даже на минимальном проходе: отдаём лучший вариант — сервер
      // ответит понятной ошибкой про размер, а не «сеть недоступна».
      if (last) return last;
    } catch {
      /* ниже — путь без canvas: оригинал + проверка размера */
    } finally {
      bitmap?.close?.();
    }
  }
  // createImageBitmap/canvas недоступны (jsdom, очень старый WebView): шлём
  // оригинал и проверяем фактический размер. Тело > 4.5 МБ платформа режет
  // своим 413 без CORS — в WebView это выглядит как «нет сети», поэтому про
  // размер сообщаем сами.
  const fallbackBase64 = await blobToBase64(file);
  if (fallbackBase64.length > VISION_BASE64_BUDGET) {
    throw new Error('фото слишком большое для распознавания — сделайте снимок меньшего размера');
  }
  return { base64: fallbackBase64, mimeType: file.type || 'image/jpeg' };
}

export interface RecognizeFoodPhotoOptions {
  purpose?: FoodVisionPurpose;
  /** Явный адрес эндпоинта (тесты/кастомный прокси). */
  endpoint?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** Готовый base64: пропускает сжатие картинки (тесты, повторный вызов). */
  imageBase64?: string;
  mimeType?: string;
  locale?: string;
  /** Отключить кэш по хэшу картинки. */
  noCache?: boolean;
  /** Текст, который OCR уже прочитал на этом фото: подсказка модели. */
  hint?: string;
  /**
   * Высокое разрешение (2048 px, JPEG 0.92) для мелкой таблицы этикетки.
   * Для фото тарелки не нужно — 1280 px/0.65 экономят квоту.
   */
  highRes?: boolean;
}

function failure(error: string, warnings: string[] = [], code?: string): FoodVisionClientResult {
  return { ok: false, meals: [], warnings, error, ...(code ? { code } : {}) };
}

/**
 * Фото → позиции дневника. Никогда не бросает: любой сбой возвращает
 * `ok: false` и текст причины, чтобы вызывающий код остался на OCR-пути.
 */
export async function recognizeFoodPhoto(
  file: File,
  options: RecognizeFoodPhotoOptions = {},
): Promise<FoodVisionClientResult> {
  const purpose: FoodVisionPurpose = options.purpose || 'food';
  const endpoint = options.endpoint || resolveFoodVisionEndpoint();
  if (!endpoint) {
    return failure(
      'AI-распознавание в этом окружении не настроено: задайте VITE_FOOD_VISION_URL при сборке APK.',
      [],
      'no_provider',
    );
  }

  let base64 = options.imageBase64 || '';
  let mimeType = options.mimeType || '';
  if (!base64) {
    try {
      const prepared = await prepareVisionImage(file, options.highRes === true);
      base64 = prepared.base64;
      mimeType = options.mimeType || prepared.mimeType;
    } catch (error: any) {
      return failure(`Не удалось подготовить фото: ${error?.message || String(error)}`, [], 'bad_request');
    }
  }
  if (!base64) return failure('Пустое изображение', [], 'bad_request');
  mimeType = mimeType || 'image/jpeg';

  const cacheKey = toCacheKey(purpose, base64);
  if (!options.noCache) {
    const cached = responseCache.get(cacheKey);
    if (cached) return { ...cached, cached: true };
  }

  const fetchImpl = options.fetchImpl || (typeof fetch === 'function' ? fetch : undefined);
  if (!fetchImpl) return failure('fetch недоступен в этом окружении', [], 'no_provider');

  const controller = new AbortController();
  const timer: any = setTimeout(() => controller.abort(), options.timeoutMs ?? REQUEST_TIMEOUT_MS);
  try {
    timer?.unref?.();
  } catch {
    /* не Node */
  }

  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        imageBase64: base64,
        mimeType,
        purpose,
        locale: options.locale || 'ru',
        ...(options.hint ? { hint: options.hint.slice(0, 1600) } : {}),
      }),
      signal: controller.signal,
    });
    const raw = await response.text().catch(() => '');
    let body: FoodVisionApiResponse | null = null;
    try {
      body = raw ? (JSON.parse(raw) as FoodVisionApiResponse) : null;
    } catch {
      body = null;
    }

    if (!body) {
      return failure(`Эндпоинт вернул не JSON (HTTP ${response.status})`, [], 'bad_response');
    }
    if (!body.ok) {
      return failure(body.error || `Ошибка AI-распознавания (${body.code})`, [], body.code);
    }
    const mapped = mapVisionPayload(body.purpose, body.payload);
    const result: FoodVisionClientResult = {
      ok: mapped.meals.length > 0 || Boolean(mapped.lab?.length),
      meals: mapped.meals,
      warnings: mapped.warnings,
      provider: body.provider,
      model: body.model,
      ...(mapped.lab ? { lab: mapped.lab } : {}),
      ...(mapped.label ? { label: mapped.label } : {}),
    };
    if (!result.ok && !result.error) {
      result.error = mapped.warnings[0] || 'ИИ не нашёл на фото еду.';
    }
    if (!options.noCache && result.ok) remember(cacheKey, result);
    return result;
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      const seconds = Math.round((options.timeoutMs ?? REQUEST_TIMEOUT_MS) / 1000);
      return failure(`AI-распознавание не ответило за ${seconds} секунд. Попробуйте ещё раз.`, [], 'timeout');
    }
    return failure(`Сеть недоступна: ${error?.message || String(error)}`, [], 'network');
  } finally {
    clearTimeout(timer);
  }
}

export interface RecognizeFoodOrLabelOptions extends RecognizeFoodPhotoOptions {
  /** Текст, который OCR уже прочитал: подсказка модели и выбор режима. */
  ocrText?: string;
  /** Общий дедлайн на оба режима, мс (по умолчанию — клиентский таймаут). */
  deadlineMs?: number;
}

export interface FoodVisionAutoResult extends FoodVisionClientResult {
  /** Какой режим дал результат; undefined — оба не сработали. */
  mode?: 'food' | 'label';
}

/**
 * Второй режим помогает только при содержательном отказе модели («это не
 * этикетка», пустой список позиций, битый JSON). Сеть, таймаут, отсутствие
 * провайдера, лимиты и 5xx вторым промптом не лечатся — это лишние 50 с и
 * лишняя квота. Решаем по машиночитаемому `code`, а не по тексту ошибки.
 */
const RETRY_OTHER_MODE_CODES = new Set(['invalid_payload', 'empty_payload', 'invalid_json']);

/**
 * Фото → позиции дневника, когда заранее неизвестно, тарелка это или упаковка.
 * Если OCR прочитал текст, но позиций не нашёл — вероятно, это таблица
 * этикетки, поэтому первым идёт `label`. Пустой текст — первым `food`.
 */
export async function recognizeFoodOrLabel(
  file: File,
  options: RecognizeFoodOrLabelOptions = {},
): Promise<FoodVisionAutoResult> {
  const ocrText = (options.ocrText || '').replace(/\s+/g, ' ').trim();
  const alnum = ocrText.replace(/[^\p{L}\p{N}]/gu, '').length;
  // Длина текста сама по себе ничего не значит: вывеска ресторана или меню в
  // кадре тоже дают 20+ символов, но это не таблица КБЖУ. Ждём маркеры состава.
  const labelMarkers = /ккал|калор|энергетическ|пищевая\s+ценность|белк|жир|углевод|kcal|protein|nutrition/i.test(
    ocrText,
  );
  const preferLabel = alnum >= 12 && labelMarkers;
  const order: Array<'food' | 'label'> = preferLabel ? ['label', 'food'] : ['food', 'label'];

  // Один дедлайн на оба режима: спиннер не должен висеть 2×50 с.
  const deadline = Date.now() + (options.deadlineMs ?? REQUEST_TIMEOUT_MS);

  // Кадр готовим под режим: этикетке нужны пиксели (2048), тарелке хватает
  // 1600 — на большом кадре модель тратит десятки секунд на лишние детали.
  const frames = new Map<'food' | 'label', { base64: string; mimeType: string }>();
  const frameFor = async (purpose: 'food' | 'label'): Promise<{ base64: string; mimeType: string }> => {
    if (options.imageBase64) {
      return { base64: options.imageBase64, mimeType: options.mimeType || 'image/jpeg' };
    }
    const cached = frames.get(purpose);
    if (cached) return cached;
    const frame = await prepareVisionImage(file, purpose === 'label' && options.highRes !== false);
    frames.set(purpose, frame);
    return frame;
  };

  let last: FoodVisionClientResult | null = null;
  for (const purpose of order) {
    const remaining = deadline - Date.now();
    // Меньше 8 с на запрос + подготовку кадра — второй режим уже не успеет.
    if (last && remaining < 8_000) break;
    let frame: { base64: string; mimeType: string };
    try {
      frame = await frameFor(purpose);
    } catch (error: any) {
      return {
        ...failure(`Не удалось подготовить фото: ${error?.message || String(error)}`, [], 'bad_request'),
        mode: undefined,
      };
    }
    const result = await recognizeFoodPhoto(file, {
      ...options,
      purpose,
      imageBase64: frame.base64,
      mimeType: frame.mimeType,
      hint: ocrText || options.hint,
      timeoutMs: Math.min(options.timeoutMs ?? REQUEST_TIMEOUT_MS, Math.max(5_000, remaining)),
    });
    last = result;
    if (result.ok && result.meals.length > 0) return { ...result, mode: purpose };
    if (!result.code || !RETRY_OTHER_MODE_CODES.has(result.code)) break;
  }
  return { ...(last || failure('AI-распознавание не дало результата')), mode: undefined };
}
