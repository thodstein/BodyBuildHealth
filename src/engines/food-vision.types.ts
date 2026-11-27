/**
 * food-vision.types.ts — контракт между серверным vision-эндпоинтом
 * (`api/food-vision.ts`) и клиентским движком (`food-vision.engine.ts`).
 *
 * Здесь НЕТ калорий как источника истины: модель отдаёт блюдо, ингредиенты,
 * граммы и уверенность. КБЖУ считает локальная FOOD_DB/recipe-db. Поле
 * `estimate` — только аварийный fallback для продукта, которого нет в базе;
 * клиент обязан пометить такую позицию низкой уверенностью.
 *
 * `purpose` заложен с запасом: `food` — тарелка, `label` — упаковка,
 * `lab` — бланк анализов. Один эндпоинт и один провайдер обслуживают все три,
 * чтобы позже подключить распознавание анализов без второй инфраструктуры.
 */

export type FoodVisionPurpose = 'food' | 'label' | 'lab';

export interface FoodVisionEstimate {
  kcalPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
}

export interface FoodVisionItem {
  /** Русское название, как его увидел пользователь. */
  name: string;
  /** Каноническое английское имя — помогает findFood() и USDA. */
  nameEn?: string;
  /** Съедобная порция в граммах (не вес упаковки). */
  grams: number;
  /** 0..1 */
  confidence: number;
  state?: 'raw' | 'cooked' | 'unknown';
  category?: string;
  /** Альтернативные варианты для низкой уверенности. */
  alternatives?: string[];
  /**
   * Грубая оценка КБЖУ на 100 г. Используется ТОЛЬКО если findFood() не нашёл
   * продукт в локальной базе; в интерфейсе помечается как оценка ИИ.
   */
  estimate?: FoodVisionEstimate;
}

export interface FoodVisionFoodPayload {
  dish: string;
  items: FoodVisionItem[];
  /** Что стоит уточнить у пользователя: масло, соус, порция. */
  needsUserInput?: string[];
  overallConfidence?: number;
  notes?: string;
}

export interface FoodVisionLabelPayload {
  productName: string;
  brand?: string;
  per100g: FoodVisionEstimate & { fiber?: number; sodiumMg?: number };
  servingSize?: string;
  confidence: number;
}

export interface FoodVisionLabValue {
  code: string;
  name: string;
  value: number;
  unit: string;
  refLow?: number;
  refHigh?: number;
  confidence: number;
}

export interface FoodVisionLabPayload {
  values: FoodVisionLabValue[];
  date?: string;
  labName?: string;
  warnings?: string[];
}

export type FoodVisionPayload = FoodVisionFoodPayload | FoodVisionLabelPayload | FoodVisionLabPayload;

export interface FoodVisionRequest {
  /** data URL или чистый base64 (без префикса). */
  imageBase64: string;
  mimeType?: string;
  purpose?: FoodVisionPurpose;
  /** 'ru' по умолчанию: названия блюд должны быть русскими. */
  locale?: string;
  /** Текст, который OCR уже прочитал (подсказка модели, необязательно). */
  hint?: string;
}

export interface FoodVisionSuccess {
  ok: true;
  purpose: FoodVisionPurpose;
  payload: FoodVisionPayload;
  provider: string;
  model: string;
}

export interface FoodVisionFailure {
  ok: false;
  error: string;
  /** Машиночитаемый код: no_provider, provider_error, invalid_json, … */
  code: string;
}

export type FoodVisionApiResponse = FoodVisionSuccess | FoodVisionFailure;

export interface FoodVisionStatus {
  ok: true;
  configured: boolean;
  provider?: string;
  model?: string;
  purposes: FoodVisionPurpose[];
}

/** Ответ клиентского движка: уже готовые meals в формате OCR-парсера. */
export interface FoodVisionClientResult {
  ok: boolean;
  meals: import('./nutrition-ocr-parser').ParsedMeal[];
  warnings: string[];
  provider?: string;
  model?: string;
  cached?: boolean;
  error?: string;
  /**
   * Машиночитаемая причина отказа (`no_provider`, `timeout`, `invalid_payload`, …).
   * По ней вызывающий код решает, имеет ли смысл второй режим: сеть/квоту/
   * отсутствие ключа повторный запрос не лечит.
   */
  code?: string;
  /**
   * `purpose: 'lab'` — распознанные показатели. Дневник их не трогает:
   * запись в лабораторный раздел делает вызывающий код.
   */
  lab?: FoodVisionLabValue[];
  /** `purpose: 'label'` — продукт на 100 г, если нужен штрихкод-подобный снимок. */
  label?: FoodVisionLabelPayload;
}

export function isFoodVisionFoodPayload(value: unknown): value is FoodVisionFoodPayload {
  return Boolean(value && typeof value === 'object' && Array.isArray((value as FoodVisionFoodPayload).items));
}

export function isFoodVisionLabelPayload(value: unknown): value is FoodVisionLabelPayload {
  const candidate = value as FoodVisionLabelPayload | null;
  return Boolean(
    candidate &&
    typeof candidate === 'object' &&
    typeof candidate.productName === 'string' &&
    candidate.per100g &&
    typeof candidate.per100g === 'object',
  );
}

export function isFoodVisionLabPayload(value: unknown): value is FoodVisionLabPayload {
  return Boolean(value && typeof value === 'object' && Array.isArray((value as FoodVisionLabPayload).values));
}
