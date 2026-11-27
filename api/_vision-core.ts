/**
 * _vision-core.ts — провайдер-независимое ядро vision-эндпоинта.
 *
 * Задача ядра — ровно одна: «картинка → проверенный JSON по контракту
 * `src/engines/food-vision.types.ts`». Никакой диетологии здесь нет: числа
 * КБЖУ из базы подставляет клиент (`src/engines/food-vision.engine.ts`),
 * а поле `estimate` — единственная поблажка для продукта, которого в базе нет.
 *
 * Почему провайдер определяется по имени переменной окружения: точное имя
 * секрета в Vercel заранее неизвестно, а один эндпоинт должен переживать
 * смену провайдера без правки кода. Ключ живёт только в process.env и никогда
 * не попадает в ответ, в тело запроса к провайдеру и в логи.
 *
 * Файл намеренно без внешних зависимостей (только типы): его импортирует
 * serverless-функция, и лишний require увеличивает холодный старт.
 */
import type {
  FoodVisionEstimate,
  FoodVisionFoodPayload,
  FoodVisionItem,
  FoodVisionLabPayload,
  FoodVisionLabValue,
  FoodVisionLabelPayload,
  FoodVisionPayload,
  FoodVisionPurpose,
} from '../src/engines/food-vision.types';

export type VisionProviderKind = 'gemini' | 'openai' | 'openrouter' | 'groq' | 'gateway' | 'cloudflare' | 'custom';

export interface VisionProvider {
  kind: VisionProviderKind;
  /** Публичное имя провайдера для ответа клиенту (без ключей). */
  name: string;
  model: string;
  apiKey: string;
  /** OpenAI-совместимая база без завершающего слэша. */
  baseUrl?: string;
  /** Cloudflare Workers AI: account id. */
  accountId?: string;
}

export type VisionEnv = Record<string, string | undefined>;

export interface VisionRequestInput {
  imageBase64: string;
  mimeType?: string;
  purpose?: FoodVisionPurpose;
  locale?: string;
  /**
   * Текст, который OCR уже прочитал на этом же фото. Передаётся модели как
   * подсказка (особенно важно для мелкой таблицы этикетки), но с явной
   * оговоркой, что OCR может ошибаться: приоритет у изображения.
   */
  hint?: string;
}

export interface VisionDeps {
  env?: VisionEnv;
  fetchImpl?: typeof fetch;
  /**
   * Предел одной попытки у провайдера, мс. Именно попытки: повтор после 429/5xx
   * получает столько времени, сколько осталось от `budgetMs`.
   */
  timeoutMs?: number;
  /** Бюджет всего вызова (функция живёт 60 с, клиент ждёт 50 с). */
  budgetMs?: number;
  /** Принудительный провайдер: `VISION_PROVIDER` или параметр. */
  preferredProvider?: string;
  /** Один повтор при 429/5xx (по умолчанию включён). */
  retry?: boolean;
  /** Пауза перед повтором, мс. */
  retryDelayMs?: number;
}

/**
 * Ошибка с машиночитаемым кодом: клиент по нему решает, показывать ошибку
 * или тихо остаться на OCR. Сообщение попадает в ответ, поэтому в нём нет
 * ни ключей, ни тела ответа провайдера.
 */
export class VisionError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'VisionError';
    this.code = code;
  }
}

/**
 * Резервные модели Gemini, если основная снята или перегружена.
 *
 * Проверено на живом ключе 2026-11: `gemini-2.5-flash` отвечает 404
 * («no longer available to new users»), `gemini-flash-latest` резолвится в
 * `gemini-3.8-flash` и в час пик отдаёт 503 либо висит 80 с на одной этикетке,
 * а `gemini-3.5-flash` читает ту же этикетку за ~4 с и `-lite` за ~1 с.
 */
const GEMINI_FALLBACK_MODELS = ['gemini-3.5-flash', 'gemini-3.5-flash-lite'];

/** Дефолтные модели: переопределяются `VISION_MODEL` / `AI_MODEL`. */
export const DEFAULT_VISION_MODELS: Record<VisionProviderKind, string> = {
  gemini: 'gemini-3.5-flash',
  openai: 'gpt-4o-mini',
  openrouter: 'google/gemini-2.0-flash-exp:free',
  groq: 'meta-llama/llama-4-scout-17b-16e-instruct',
  gateway: 'google/gemini-2.5-flash',
  cloudflare: '@cf/meta/llama-3.2-11b-vision-instruct',
  custom: 'gpt-4o-mini',
};

/** Порядок важен: первым берётся самый «бесплатный» провайдер. */
const PROVIDER_ORDER: VisionProviderKind[] = [
  'gemini',
  'openai',
  'openrouter',
  'groq',
  'gateway',
  'cloudflare',
  'custom',
];

export const VISION_PURPOSES: FoodVisionPurpose[] = ['food', 'label', 'lab'];

// Vercel Functions принимают тело запроса до 4.5 МБ, а клиент шлёт картинку
// внутри JSON/base64 (4/3 от байт). 3.3 МБ байт ≈ 4.4 МБ тела — предел, при
// котором платформа ещё отдаёт наш JSON-ответ с CORS, а не свой 413 без него.
const MAX_IMAGE_BYTES = 3_300_000;
const MAX_PROVIDER_TEXT = 200_000;

function clean(value: string | undefined | null): string | undefined {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed ? trimmed : undefined;
}

function readEnv(env?: VisionEnv): VisionEnv {
  if (env) return env;
  return typeof process !== 'undefined' && process.env ? (process.env as VisionEnv) : {};
}

function pickModel(env: VisionEnv, kind: VisionProviderKind): string {
  return clean(env.VISION_MODEL) || clean(env.AI_MODEL) || DEFAULT_VISION_MODELS[kind];
}

function providerFor(kind: VisionProviderKind, env: VisionEnv): VisionProvider | null {
  switch (kind) {
    case 'gemini': {
      const apiKey = clean(env.GEMINI_API_KEY) || clean(env.GOOGLE_API_KEY) || clean(env.GOOGLE_GENERATIVE_AI_API_KEY);
      return apiKey ? { kind, name: 'gemini', model: pickModel(env, kind), apiKey } : null;
    }
    case 'openai': {
      const apiKey = clean(env.OPENAI_API_KEY);
      return apiKey
        ? { kind, name: 'openai', model: pickModel(env, kind), apiKey, baseUrl: 'https://api.openai.com/v1' }
        : null;
    }
    case 'openrouter': {
      const apiKey = clean(env.OPENROUTER_API_KEY);
      return apiKey
        ? {
            kind,
            name: 'openrouter',
            model: pickModel(env, kind),
            apiKey,
            baseUrl: 'https://openrouter.ai/api/v1',
          }
        : null;
    }
    case 'groq': {
      const apiKey = clean(env.GROQ_API_KEY);
      return apiKey
        ? { kind, name: 'groq', model: pickModel(env, kind), apiKey, baseUrl: 'https://api.groq.com/openai/v1' }
        : null;
    }
    case 'gateway': {
      // Vercel AI Gateway: на деплое Vercel токен OIDC приходит автоматически
      // (если OIDC включён), явный ключ AI_GATEWAY_API_KEY имеет приоритет.
      const apiKey = clean(env.AI_GATEWAY_API_KEY) || clean(env.VERCEL_OIDC_TOKEN);
      return apiKey
        ? { kind, name: 'ai-gateway', model: pickModel(env, kind), apiKey, baseUrl: 'https://ai-gateway.vercel.sh/v1' }
        : null;
    }
    case 'cloudflare': {
      const apiKey = clean(env.CLOUDFLARE_API_TOKEN);
      const accountId = clean(env.CLOUDFLARE_ACCOUNT_ID);
      return apiKey && accountId ? { kind, name: 'cloudflare', model: pickModel(env, kind), apiKey, accountId } : null;
    }
    case 'custom': {
      const apiKey = clean(env.AI_API_KEY);
      const baseUrl = clean(env.AI_BASE_URL)?.replace(/\/+$/, '');
      if (!apiKey || !baseUrl) return null;
      return { kind, name: 'custom', model: pickModel(env, kind), apiKey, baseUrl };
    }
    default:
      return null;
  }
}

/** Первый настроенный провайдер; `preferred` поднимается в начало очереди. */
export function detectVisionProvider(rawEnv?: VisionEnv, preferredProvider?: string): VisionProvider | null {
  const env = readEnv(rawEnv);
  const want = clean(preferredProvider)?.toLowerCase();
  const order =
    want && (PROVIDER_ORDER as string[]).includes(want)
      ? [want as VisionProviderKind, ...PROVIDER_ORDER.filter((kind) => kind !== want)]
      : PROVIDER_ORDER;
  for (const kind of order) {
    const provider = providerFor(kind, env);
    if (provider) return provider;
  }
  return null;
}

/** Статус для GET: что настроено, без единого символа секрета. */
export function visionStatus(rawEnv?: VisionEnv): {
  configured: boolean;
  provider?: string;
  model?: string;
  purposes: FoodVisionPurpose[];
} {
  const env = readEnv(rawEnv);
  const provider = detectVisionProvider(env, clean(env.VISION_PROVIDER));
  return provider
    ? { configured: true, provider: provider.name, model: provider.model, purposes: VISION_PURPOSES }
    : { configured: false, purposes: VISION_PURPOSES };
}

/* ───────────────────────────── Prompt ───────────────────────────── */

const JSON_COMMON = [
  'Верни СТРОГО один JSON-объект. Без markdown, без ```, без пояснений до или после.',
  'Не придумывай данные: если значение не видно на изображении — не включай поле.',
  'Все числа — обычные десятичные (точка как разделитель), без единиц внутри значения.',
].join('\n');

function foodPrompt(locale: string): string {
  return [
    'Ты анализируешь фотографию еды и возвращаешь состав блюда для дневника питания.',
    `Названия продуктов — на языке "${locale}" (по умолчанию русский), как их назвал бы человек.`,
    '',
    'Правила:',
    '1. Перечисли КАЖДЫЙ различимый компонент отдельной позицией: гарнир, мясо/рыба, овощи, соус, масло, хлеб.',
    '2. grams — масса съедобной порции ЭТОГО компонента в граммах, не вес упаковки и не вес всей тарелки.',
    '3. Оценивай по размеру относительно вилки/ложки/тарелки/руки. Типичная порция гарнира 100–250 г, мяса 100–250 г.',
    '4. nameEn — каноничное английское название простого ингредиента (chicken breast, white rice, olive oil) для поиска в базе.',
    '5. state — "cooked" если продукт приготовлен, "raw" если сырой, "unknown" если не видно.',
    '6. confidence 0..1: 0.9+ — уверен; 0.5–0.8 — уверен в продукте, но не в порции; <0.5 — догадка.',
    '7. estimate — типичные КБЖУ на 100 г готового продукта. Заполняй только если знаешь типичные значения для этого продукта; иначе не включай.',
    '8. needsUserInput — что критично уточнить: масло/соус/сахар/размер порции.',
    '9. Воду, соль и специи без калорий не включай. Напитки включай, если у них есть калории.',
    '10. Если на фото упаковка/этикетка, а не готовая тарелка: верни сам продукт одной позицией, grams — масса порции с упаковки (если указана), иначе 100, estimate — КБЖУ с этикетки на 100 г. Не выдумывай «блюдо из упаковки».',
    '',
    'Схема:',
    '{"dish":"краткое название блюда","items":[{"name":"куриная грудка","nameEn":"chicken breast","grams":180,"confidence":0.8,"state":"cooked","category":"protein","estimate":{"kcalPer100g":165,"proteinPer100g":31,"fatPer100g":3.6,"carbsPer100g":0}}],"needsUserInput":["масло?"],"overallConfidence":0.75}',
    '',
    JSON_COMMON,
  ].join('\n');
}

function labelPrompt(locale: string): string {
  return [
    'Ты читаешь фотографию пищевой этикетки упаковки и возвращаешь КБЖУ на 100 г продукта.',
    `productName — на языке "${locale}", brand — как на упаковке.`,
    '',
    'Правила:',
    '1. per100g — ОБЯЗАТЕЛЬНО пересчитай на 100 г. Если на этикетке «на порцию», раздели на массу порции и умножь на 100.',
    '2. kcalPer100g, proteinPer100g, fatPer100g, carbsPer100g — числа с этикетки, не оценки.',
    '3. fiber и sodiumMg добавляй, только если они напечатаны.',
    '4. servingSize — строка с порцией как на упаковке («30 г», «250 мл»), если видна.',
    '5. confidence 0..1 — уверенность в прочитанных цифрах.',
    '6. Если на упаковке есть колонки «на 100 г» и «на порцию» — бери колонку «на 100 г» и не пересчитывай её.',
    '7. Если энергия указана только в кДж — переведи: ккал = кДж / 4,184 (100 ккал ≈ 418 кДж).',
    '8. Не путай общие жиры/углеводы со строками «в том числе насыщенные жиры / сахара» — бери общие значения.',
    '9. Если блока «Пищевая ценность» не видно или цифры нечитаемы — верни {"error":"no_nutrition_table"}; не придумывай значения.',
    '',
    'Схема:',
    '{"productName":"Творог 5%","brand":"Простоквашино","per100g":{"kcalPer100g":121,"proteinPer100g":16,"fatPer100g":5,"carbsPer100g":3,"fiber":0,"sodiumMg":40},"servingSize":"200 г","confidence":0.9}',
    '',
    JSON_COMMON,
  ].join('\n');
}

function labPrompt(locale: string): string {
  return [
    'Ты читаешь фотографию бланка лабораторных анализов и возвращаешь показатели.',
    `code — латинская аббревиатура из бланка (HGB, ALT, TSH, LDL), name — по-русски.`,
    '',
    'Правила:',
    '1. value — число ровно как в бланке; unit — единица измерения как напечатана (г/л, ммоль/л, Ед/л).',
    '2. refLow/refHigh — границы нормы из бланка, если напечатаны. Не подставляй нормы по памяти.',
    '3. Нечитаемое значение пропусти и добавь короткое предупреждение в warnings.',
    '4. date — дата забора в формате YYYY-MM-DD, если видна. labName — название лаборатории, если видно.',
    '5. confidence 0..1 — уверенность в цифре.',
    '',
    'Схема:',
    `{"values":[{"code":"HGB","name":"Гемоглобин","value":152,"unit":"г/л","refLow":130,"refHigh":170,"confidence":0.95}],"date":"2026-11-20","labName":"Инвитро","warnings":[]}`,
    `Названия показателей — на языке "${locale}".`,
    '',
    JSON_COMMON,
  ].join('\n');
}

export function buildVisionPrompt(purpose: FoodVisionPurpose, locale = 'ru', hint?: string): string {
  const safeLocale = clean(locale) || 'ru';
  const base =
    purpose === 'label' ? labelPrompt(safeLocale) : purpose === 'lab' ? labPrompt(safeLocale) : foodPrompt(safeLocale);
  const ocrHint = clean(hint);
  if (!ocrHint) return base;
  // OCR-текст — подсказка, а не истина: у мелкой таблицы распознавание путает
  // цифры, поэтому модель обязана сверять его с изображением.
  return [
    base,
    '',
    'Текст, который OCR уже прочитал на этом фото (может содержать ошибки распознавания; используй как подсказку, но проверяй по изображению):',
    ocrHint.slice(0, 1500),
  ].join('\n');
}

/* ───────────────────────── Image / JSON helpers ───────────────────────── */

export function normalizeImageInput(input: string): { base64: string; mimeType: string } {
  const raw = typeof input === 'string' ? input.trim() : '';
  if (!raw) throw new VisionError('no_image', 'Изображение не передано');
  let mimeType = 'image/jpeg';
  let base64 = raw;
  const dataUrl = raw.match(/^data:([^;,]+);base64,(.*)$/is);
  if (dataUrl) {
    mimeType = dataUrl[1] || mimeType;
    base64 = dataUrl[2] || '';
  }
  base64 = base64.replace(/\s+/g, '');
  if (!base64 || !/^[A-Za-z0-9+/=_-]+$/.test(base64)) {
    throw new VisionError('no_image', 'Изображение не в формате base64');
  }
  const approximateBytes = Math.floor((base64.length * 3) / 4);
  if (approximateBytes > MAX_IMAGE_BYTES) {
    throw new VisionError('image_too_large', 'Фото слишком большое для эндпоинта (лимит ≈3.3 МБ) — уменьшите кадр');
  }
  return { base64, mimeType };
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Достаёт JSON-объект из ответа модели: ```json, проза до/после, хвостовые запятые. */
export function extractJsonObject(text: string): unknown {
  const raw = typeof text === 'string' ? text.trim() : '';
  if (!raw) throw new VisionError('invalid_json', 'Модель вернула пустой ответ');
  const unfenced = raw
    .replace(/^```(?:json|JSON)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
  const direct = tryParseJson(unfenced);
  if (direct !== undefined) return direct;
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const slice = unfenced.slice(start, end + 1);
    const sliced = tryParseJson(slice);
    if (sliced !== undefined) return sliced;
    const repaired = tryParseJson(slice.replace(/,\s*([}\]])/g, '$1'));
    if (repaired !== undefined) return repaired;
  }
  throw new VisionError('invalid_json', 'Модель вернула не JSON');
}

/* ───────────────────────── Validation ───────────────────────── */

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(',', '.').replace(/[^\d.+\-]/g, ''));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function asClamped(value: unknown, min: number, max: number): number | undefined {
  const number = asNumber(value);
  if (number === undefined) return undefined;
  return Math.min(max, Math.max(min, number));
}

/**
 * Строгая проверка диапазона: число вне физических границ — это мусор,
 * а не «почти норма». Прижимать 1200 ккал/100 г к 950 нельзя: так в дневник
 * попадёт выдуманное значение, которого модель не называла.
 */
function asInRange(value: unknown, min: number, max: number): number | undefined {
  const number = asNumber(value);
  if (number === undefined || number < min || number > max) return undefined;
  return number;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** КБЖУ на 100 г: физические границы, иначе поле выкидывается целиком. */
function sanitizeEstimate(value: unknown): FoodVisionEstimate | undefined {
  const raw = asRecord(value);
  const kcal = asInRange(raw.kcalPer100g, 0, 950);
  const protein = asInRange(raw.proteinPer100g, 0, 100);
  const fat = asInRange(raw.fatPer100g, 0, 100);
  const carbs = asInRange(raw.carbsPer100g, 0, 100);
  if (kcal === undefined || protein === undefined || fat === undefined || carbs === undefined) return undefined;
  return {
    kcalPer100g: Math.round(kcal),
    proteinPer100g: round1(protein),
    fatPer100g: round1(fat),
    carbsPer100g: round1(carbs),
  };
}

function sanitizeStringList(value: unknown, maxItems: number): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const list = value
    .map((entry) => asText(entry, 120))
    .filter((entry): entry is string => Boolean(entry))
    .slice(0, maxItems);
  return list.length ? list : undefined;
}

function sanitizeFoodItem(value: unknown): FoodVisionItem | undefined {
  const raw = asRecord(value);
  const name = asText(raw.name, 120) || asText(raw.nameEn, 120);
  const gramsRaw = asNumber(raw.grams);
  // 0 г — это не «маленькая порция», а отсутствие порции: такую позицию
  // нельзя ни посчитать, ни показать. Отбрасываем, а не прижимаем к 1 г.
  if (gramsRaw === undefined || gramsRaw <= 0) return undefined;
  const grams = Math.min(5000, Math.max(1, gramsRaw));
  if (!name) return undefined;
  const item: FoodVisionItem = {
    name,
    grams: Math.round(grams),
    confidence: Math.round((asClamped(raw.confidence, 0, 1) ?? 0.5) * 100) / 100,
  };
  const nameEn = asText(raw.nameEn, 120);
  if (nameEn && nameEn !== name) item.nameEn = nameEn;
  const state = asText(raw.state, 16)?.toLowerCase();
  if (state === 'raw' || state === 'cooked' || state === 'unknown') item.state = state;
  const category = asText(raw.category, 40);
  if (category) item.category = category;
  const alternatives = sanitizeStringList(raw.alternatives, 5);
  if (alternatives) item.alternatives = alternatives;
  const estimate = sanitizeEstimate(raw.estimate);
  if (estimate) item.estimate = estimate;
  return item;
}

function sanitizeLabelPayload(value: unknown): FoodVisionLabelPayload {
  const raw = asRecord(value);
  // Модель честно сообщает, что таблицы на фото нет — отдельный текст ошибки,
  // чтобы пользователь не искал «невидимый продукт».
  if (raw.error) throw new VisionError('invalid_payload', 'На фото нет читаемого блока «Пищевая ценность»');
  const productName = asText(raw.productName, 160);
  const per100g = sanitizeEstimate(raw.per100g);
  if (!productName) throw new VisionError('invalid_payload', 'На этикетке не найден продукт');
  if (!per100g) throw new VisionError('invalid_payload', 'На этикетке не найдены КБЖУ на 100 г');
  const per100Raw = asRecord(raw.per100g);
  const fiber = asClamped(per100Raw.fiber, 0, 100);
  const sodiumMg = asClamped(per100Raw.sodiumMg, 0, 20_000);
  // «900 кДж» вместо 215 ккал проходит физический фильтр (≤ 950) и попадает в
  // базу как 900 ккал — ошибка вчетверо. Пересчитываем ТОЛЬКО когда расхождение
  // ровно того порядка, что даёт путаница кДж/ккал (≈4,184): у полиолов,
  // алкоголя и продуктов с клетчаткой энергия честно не выводится из БЖУ, и
  // «исправление» по Atwater сделало бы из 40 ккал эритрита 360.
  let confidence = asClamped(raw.confidence, 0, 1) ?? 0.6;
  const atwater = per100g.proteinPer100g * 4 + per100g.fatPer100g * 9 + per100g.carbsPer100g * 4;
  const ratio = atwater > 0 ? per100g.kcalPer100g / atwater : 1;
  if (atwater >= 20 && ratio >= 3.2 && ratio <= 5.2) {
    per100g.kcalPer100g = Math.round(atwater);
    confidence = Math.min(confidence, 0.5);
  }
  const payload: FoodVisionLabelPayload = {
    productName,
    per100g: { ...per100g },
    confidence: Math.round(confidence * 100) / 100,
  };
  if (fiber !== undefined) payload.per100g.fiber = round1(fiber);
  if (sodiumMg !== undefined) payload.per100g.sodiumMg = Math.round(sodiumMg);
  const brand = asText(raw.brand, 120);
  if (brand) payload.brand = brand;
  const servingSize = asText(raw.servingSize, 60);
  if (servingSize) payload.servingSize = servingSize;
  return payload;
}

function sanitizeLabValue(value: unknown): FoodVisionLabValue | undefined {
  const raw = asRecord(value);
  const code = (asText(raw.code, 24) || asText(raw.name, 24) || '').toUpperCase();
  const name = asText(raw.name, 120) || code;
  const numeric = asNumber(raw.value);
  if (!code || numeric === undefined) return undefined;
  const result: FoodVisionLabValue = {
    code,
    name,
    value: numeric,
    unit: asText(raw.unit, 24) || '',
    confidence: Math.round((asClamped(raw.confidence, 0, 1) ?? 0.7) * 100) / 100,
  };
  const refLow = asNumber(raw.refLow);
  const refHigh = asNumber(raw.refHigh);
  if (refLow !== undefined) result.refLow = refLow;
  if (refHigh !== undefined) result.refHigh = refHigh;
  return result;
}

function sanitizeLabPayload(value: unknown): FoodVisionLabPayload {
  const raw = asRecord(value);
  const incoming = Array.isArray(raw.values) ? raw.values.slice(0, 200) : [];
  const values = incoming.map(sanitizeLabValue).filter((entry): entry is FoodVisionLabValue => Boolean(entry));
  if (!values.length) throw new VisionError('empty_payload', 'На бланке не найдено ни одного показателя');
  const payload: FoodVisionLabPayload = { values };
  const date = asText(raw.date, 10);
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) payload.date = date;
  const labName = asText(raw.labName, 120);
  if (labName) payload.labName = labName;
  const warnings = sanitizeStringList(raw.warnings, 10);
  if (warnings) payload.warnings = warnings;
  return payload;
}

function sanitizeFoodPayload(value: unknown): FoodVisionFoodPayload {
  const raw = asRecord(value);
  const incoming = Array.isArray(raw.items) ? raw.items.slice(0, 25) : [];
  const items = incoming.map(sanitizeFoodItem).filter((entry): entry is FoodVisionItem => Boolean(entry));
  if (!items.length) throw new VisionError('empty_payload', 'На фото не найдено ни одного продукта');
  const payload: FoodVisionFoodPayload = {
    dish: asText(raw.dish, 120) || items[0].name,
    items,
  };
  const needsUserInput = sanitizeStringList(raw.needsUserInput, 6);
  if (needsUserInput) payload.needsUserInput = needsUserInput;
  const overallConfidence = asClamped(raw.overallConfidence, 0, 1);
  if (overallConfidence !== undefined) payload.overallConfidence = Math.round(overallConfidence * 100) / 100;
  const notes = asText(raw.notes, 500);
  if (notes) payload.notes = notes;
  return payload;
}

/** Проверка «сырого» ответа модели по контракту purpose. */
export function sanitizeVisionPayload(purpose: FoodVisionPurpose, value: unknown): FoodVisionPayload {
  switch (purpose) {
    case 'label':
      return sanitizeLabelPayload(value);
    case 'lab':
      return sanitizeLabPayload(value);
    case 'food':
    default:
      return sanitizeFoodPayload(value);
  }
}

/* ───────────────────────── Provider call ───────────────────────── */

function openAiCompatibleBody(provider: VisionProvider, prompt: string, imageUrl: string) {
  return {
    model: provider.model,
    temperature: 0.1,
    // 25 позиций с estimate не влезают в 2048 токенов, обрезанный JSON — это
    // потеря всего ответа. 8192 оставляет место и «мыслям» Gemini 3.x, которые
    // тоже списываются из этого лимита.
    max_tokens: 8192,
    messages: [
      { role: 'system', content: prompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Распознай изображение и верни JSON по инструкции.' },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
      },
    ],
  };
}

function readOpenAiText(json: any): string {
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part: any) => (typeof part === 'string' ? part : typeof part?.text === 'string' ? part.text : ''))
      .join('');
  }
  return '';
}

async function postJson(
  fetchImpl: typeof fetch,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal: AbortSignal,
): Promise<any> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error: any) {
    if (error?.name === 'AbortError') throw new VisionError('timeout', 'Провайдер не ответил вовремя');
    throw new VisionError('provider_error', `Сеть недоступна: ${error?.message || String(error)}`);
  }
  const rawText = await response.text().catch(() => '');
  if (!response.ok) {
    const detail = rawText.replace(/\s+/g, ' ').slice(0, 300);
    throw new VisionError('provider_error', `Провайдер ответил ${response.status}${detail ? `: ${detail}` : ''}`);
  }
  if (rawText.length > MAX_PROVIDER_TEXT) {
    throw new VisionError('provider_error', 'Ответ провайдера неожиданно большой');
  }
  const parsed = tryParseJson(rawText);
  if (parsed === undefined) throw new VisionError('provider_error', 'Провайдер вернул не JSON-конверт');
  return parsed;
}

/** Запрос к выбранному провайдеру. Возвращает СЫРОЙ текст модели. */
export async function callVisionProvider(
  provider: VisionProvider,
  input: { base64: string; mimeType: string; purpose: FoodVisionPurpose; locale: string; hint?: string },
  deps: VisionDeps = {},
): Promise<string> {
  const fetchImpl = deps.fetchImpl || (typeof fetch === 'function' ? fetch : undefined);
  if (!fetchImpl) throw new VisionError('no_provider', 'fetch недоступен в этом окружении');
  const prompt = buildVisionPrompt(input.purpose, input.locale, input.hint);
  const dataUrl = `data:${input.mimeType};base64,${input.base64}`;
  const controller = new AbortController();
  const timer: any = setTimeout(() => controller.abort(), deps.timeoutMs ?? 45_000);
  // unref: таймер не должен держать процесс/тест живым после ответа.
  try {
    timer?.unref?.();
  } catch {
    /* не Node — игнорируем */
  }

  try {
    if (provider.kind === 'gemini') {
      const models = [provider.model, ...GEMINI_FALLBACK_MODELS.filter((model) => model !== provider.model)];
      const body = {
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }, { inline_data: { mime_type: input.mimeType, data: input.base64 } }],
          },
        ],
        generationConfig: { temperature: 0.1, maxOutputTokens: 8192, responseMimeType: 'application/json' },
      };
      const attemptBudget = deps.timeoutMs ?? 45_000;
      const startedAt = Date.now();
      let firstError: unknown;
      let lastError: unknown;
      for (const [index, model] of models.entries()) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
        // Свой таймер на модель: иначе «медленный 503» съедает бюджет и резервной
        // модели достаётся 5 с, а исходная причина подменяется таймаутом.
        const left = Math.max(5_000, attemptBudget - (Date.now() - startedAt));
        const moreModels = index < models.length - 1;
        // Основной модели даём не больше 30 с из общего бюджета: если она
        // «задумалась» (в час пик Gemini отвечает 40–80 с), остаток уходит
        // быстрой flash-lite, иначе весь запрос превращается в таймаут.
        const modelLimit = moreModels ? Math.min(left, index === 0 ? 30_000 : left) : left;
        const modelController = new AbortController();
        const modelTimer: any = setTimeout(() => modelController.abort(), modelLimit);
        try {
          modelTimer?.unref?.();
        } catch {
          /* не Node */
        }
        // Общий дедлайн/отмена клиента обязаны прерывать и текущую модель.
        const onOuterAbort = () => modelController.abort();
        controller.signal.addEventListener('abort', onOuterAbort, { once: true });
        try {
          // Ключ — заголовком, а не query-параметром: URL не утекает в логи.
          const json = await postJson(
            fetchImpl,
            url,
            { 'x-goog-api-key': provider.apiKey },
            body,
            modelController.signal,
          );
          const text = Array.isArray(json?.candidates?.[0]?.content?.parts)
            ? json.candidates[0].content.parts
                .map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
                .join('')
            : '';
          if (!text.trim()) throw new VisionError('provider_error', 'Gemini вернул пустой ответ');
          return text;
        } catch (error) {
          lastError = error;
          if (index === 0) firstError = error;
          // 404 — модель снята для новых ключей, 503 — всплеск спроса. Кадр уже
          // сжат и отправлен, поэтому пробуем следующую модель вместо отказа.
          const message = error instanceof Error ? error.message : String(error);
          const providerBusy = /Провайдер ответил (404|503)/.test(message);
          // Зависание основной модели — тоже повод взять резервную, но только
          // если на неё осталось время.
          const primaryStalled =
            moreModels && /не ответил вовремя/.test(message) && attemptBudget - (Date.now() - startedAt) >= 8_000;
          if (!providerBusy && !primaryStalled) {
            throw index === 0 ? error : firstError || error;
          }
        } finally {
          clearTimeout(modelTimer);
          controller.signal.removeEventListener('abort', onOuterAbort);
        }
      }
      throw firstError || lastError;
    }

    if (provider.kind === 'cloudflare') {
      // OpenAI-совместимый путь Workers AI: `/ai/run/{model}` ждёт `{prompt,image}`,
      // а не `messages`, поэтому с нашим телом он всегда отвечал 400.
      const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(provider.accountId || '')}/ai/v1/chat/completions`;
      const body = openAiCompatibleBody(provider, prompt, dataUrl);
      const json = await postJson(
        fetchImpl,
        url,
        { authorization: `Bearer ${provider.apiKey}` },
        body,
        controller.signal,
      );
      if (json?.success === false) {
        const message =
          Array.isArray(json?.errors) && json.errors[0]?.message ? String(json.errors[0].message) : 'ошибка Cloudflare';
        throw new VisionError('provider_error', message);
      }
      const text = readOpenAiText(json);
      if (!text.trim()) throw new VisionError('provider_error', 'Cloudflare вернул пустой ответ');
      return text;
    }

    const baseUrl = (provider.baseUrl || '').replace(/\/+$/, '');
    const url = /\/chat\/completions$/.test(baseUrl) ? baseUrl : `${baseUrl}/chat/completions`;
    const json = await postJson(
      fetchImpl,
      url,
      { authorization: `Bearer ${provider.apiKey}` },
      openAiCompatibleBody(provider, prompt, dataUrl),
      controller.signal,
    );
    const text = readOpenAiText(json);
    if (!text.trim()) {
      const providerMessage = typeof json?.error?.message === 'string' ? json.error.message.slice(0, 200) : '';
      throw new VisionError('provider_error', providerMessage || `${provider.name} вернул пустой ответ`);
    }
    return text;
  } finally {
    clearTimeout(timer);
  }
}

export interface VisionSuccess {
  ok: true;
  purpose: FoodVisionPurpose;
  payload: FoodVisionPayload;
  provider: string;
  model: string;
}

/** Пауза между повторами. `unref`, чтобы тест не держал процесс живым. */
function pause(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer: any = setTimeout(resolve, ms);
    try {
      timer?.unref?.();
    } catch {
      /* не Node */
    }
  });
}

/**
 * Повторяем только явные «попробуй ещё»: лимит запросов и временные сбои
 * провайдера. Таймаут не повторяем — второй 45-секундный запрос не влезет
 * в бюджет функции. Сеть/ключ не повторяем: ответ не изменится.
 */
function isRetryableProviderError(error: unknown): boolean {
  return (
    error instanceof VisionError &&
    error.code === 'provider_error' &&
    /Провайдер ответил (429|5\d\d)/.test(error.message)
  );
}

/** Полный цикл: провайдер → запрос → JSON → проверка. Бросает VisionError. */
export async function runVision(input: VisionRequestInput, deps: VisionDeps = {}): Promise<VisionSuccess> {
  const env = readEnv(deps.env);
  const provider = detectVisionProvider(env, clean(deps.preferredProvider) || clean(env.VISION_PROVIDER));
  if (!provider) {
    throw new VisionError(
      'no_provider',
      'AI-провайдер не настроен: добавьте GEMINI_API_KEY (или OPENAI_API_KEY / OPENROUTER_API_KEY / GROQ_API_KEY / AI_GATEWAY_API_KEY) в переменные окружения Vercel',
    );
  }
  const purpose: FoodVisionPurpose = VISION_PURPOSES.includes(input.purpose as FoodVisionPurpose)
    ? (input.purpose as FoodVisionPurpose)
    : 'food';
  const { base64, mimeType: detectedMime } = normalizeImageInput(input.imageBase64);
  // Явный mimeType важнее эвристики: data URL может нести image/jpeg, а клиент
  // уже сжал кадр в png/сжатый формат — провайдеру нужен фактический тип.
  // Принимаем только картинки: mimeType уходит в `data:` URL провайдера.
  const requestedMime = clean(input.mimeType) || detectedMime;
  const mimeType = /^image\/(jpeg|png|webp|heic|heif)$/i.test(requestedMime) ? requestedMime : 'image/jpeg';
  // locale вставляется в промпт: пропускаем только код языка, иначе текст из
  // публичного тела может переписать инструкции модели.
  const requestedLocale = clean(input.locale) || 'ru';
  const locale = /^[a-z]{2}(-[A-Za-z]{2})?$/.test(requestedLocale) ? requestedLocale : 'ru';
  const callInput = { base64, mimeType, purpose, locale, hint: clean(input.hint) };
  // Один дедлайн на весь вызов: клиент ждёт ответ 50 с, функция живёт 60 с.
  // Бюджет 45 с гарантирует, что сервер успеет вернуть JSON раньше, чем клиент
  // покажет таймаут (иначе работа функции тратится впустую).
  const deadline = Date.now() + (deps.budgetMs ?? 45_000);
  const remaining = () => deadline - Date.now();
  const attemptTimeout = () => Math.max(5_000, Math.min(deps.timeoutMs ?? 45_000, remaining()));
  let text: string;
  try {
    text = await callVisionProvider(provider, callInput, { ...deps, timeoutMs: attemptTimeout() });
  } catch (error) {
    if (deps.retry === false || !isRetryableProviderError(error) || remaining() < 20_000) throw error;
    await pause(deps.retryDelayMs ?? 250);
    text = await callVisionProvider(provider, callInput, { ...deps, timeoutMs: attemptTimeout() });
  }
  const data = extractJsonObject(text);
  const payload = sanitizeVisionPayload(purpose, data);
  return { ok: true, purpose, payload, provider: provider.name, model: provider.model };
}
