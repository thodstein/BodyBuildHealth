/**
 * barcode-lookup.engine.ts — ОДНА цепочка «штрихкод → продукт» для всех входов.
 *
 * Раньше цепочка жила только внутри `BarcodeScanner.tsx`, а штрихкод, введённый
 * в поле поиска, спрашивал один Open Food Facts. Из-за этого один и тот же код
 * находился камерой и не находился руками. Теперь порядок один:
 *   свои продукты (offline) → OFF → общая база сканирований → каталоги сетей.
 *
 * Продукт без КБЖУ не выбрасываем молча: возвращаем его с флагом `incomplete`,
 * и UI честно предлагает снять этикетку или ввести значения вручную. Раньше
 * такой товар выглядел как «не найден», хотя он есть в базе.
 */
import { searchByBarcode, saveToCache, type OFFProduct } from './openfoodfacts.engine';
import { saveSharedBarcode, searchSharedBarcode } from './food-barcode-catalog.engine';
import { guessRetailCategory, searchRetailProductByBarcode } from './retail-search.engine';
import { findCustomFoodByBarcode, type CustomFoodEntry } from './meal-custom-food';

export type BarcodeSource = 'custom' | 'off' | 'shared' | 'retail';

export interface BarcodeLookupHit {
  product: OFFProduct;
  source: BarcodeSource;
  /** Источник нашёлся, но КБЖУ в нём нет: нужен снимок этикетки или ручной ввод. */
  incomplete: boolean;
}

export interface BarcodeLookupResult {
  /** Нормализованный код (только цифры). */
  barcode: string;
  hit: BarcodeLookupHit | null;
  /** Пройденные шаги — для подписи «что ищем» под спиннером. */
  steps: string[];
}

export interface BarcodeLookupOptions {
  onStep?: (label: string) => void;
}

/** Штрихкод без цифр или короче EAN-8 — это не штрихкод. */
export function normalizeScannedBarcode(raw: string | undefined): string {
  return (raw || '').replace(/\D/g, '').trim();
}

export function isNutritionComplete(p: {
  kcal?: number | null;
  protein?: number | null;
  fat?: number | null;
  carbs?: number | null;
}): boolean {
  return (
    (Number(p.kcal) || 0) > 0 || (Number(p.protein) || 0) > 0 || (Number(p.fat) || 0) > 0 || (Number(p.carbs) || 0) > 0
  );
}

/** Своя запись пользователя (ручная или с фото упаковки) → продукт для дневника. */
export function customFoodToOFFProduct(entry: CustomFoodEntry): OFFProduct {
  return {
    id: entry.barcode || entry.id,
    barcode: entry.barcode || '',
    name: entry.name,
    brand: entry.brand,
    category: entry.category,
    kcal: entry.kcal,
    protein: entry.protein,
    fat: entry.fat,
    carbs: entry.carbs,
    fiber: entry.fiber,
    servingSize: entry.servingSize || '100 г',
    cachedAt: Date.now(),
  };
}

/** Каталог сети (ВкусВилл и др.) → продукт для дневника. */
export function retailToOFFProduct(
  retail: { name: string; brand?: string; kcal: number; protein: number; fat: number; carbs: number },
  barcode: string,
): OFFProduct {
  return {
    id: barcode,
    barcode,
    name: retail.name,
    brand: retail.brand || 'ВкусВилл',
    category: guessRetailCategory(retail.name),
    kcal: retail.kcal,
    protein: retail.protein,
    fat: retail.fat,
    carbs: retail.carbs,
    fiber: 0,
    servingSize: '100 г',
    cachedAt: Date.now(),
  };
}

export async function lookupBarcode(
  rawBarcode: string,
  options: BarcodeLookupOptions = {},
): Promise<BarcodeLookupResult> {
  const barcode = normalizeScannedBarcode(rawBarcode);
  const steps: string[] = [];
  const step = (label: string) => {
    steps.push(label);
    try {
      options.onStep?.(label);
    } catch {
      /* подпись не должна ломать поиск */
    }
  };

  if (!barcode || barcode.length < 8) {
    return { barcode, hit: null, steps };
  }

  // 1. Свои продукты — до сети: одинаковый код должен находить ровно ту запись,
  //    которую сохранил пользователь (в т.ч. распознанную с упаковки).
  step('Проверяем свои продукты…');
  const local = findCustomFoodByBarcode(barcode);
  if (local) {
    const product = customFoodToOFFProduct(local);
    try {
      await saveToCache(product);
    } catch {
      /* кэш не обязателен */
    }
    return { barcode, hit: { product, source: 'custom', incomplete: !isNutritionComplete(product) }, steps };
  }

  // 2. Open Food Facts (кэш → сеть). Движок сам кладёт найденное в кэш —
  //    повторное сохранение здесь дало бы лишнюю запись в IndexedDB.
  step('Проверяем кэш и Open Food Facts…');
  const off = await searchByBarcode(barcode);
  if (off) {
    return { barcode, hit: { product: off, source: 'off', incomplete: !isNutritionComplete(off) }, steps };
  }

  // 3. Общая база сканирований.
  step('Ищем в общей базе сканирований…');
  const shared = await searchSharedBarcode(barcode);
  if (shared) {
    try {
      await saveToCache(shared);
    } catch {
      /* кэш не обязателен */
    }
    return { barcode, hit: { product: shared, source: 'shared', incomplete: !isNutritionComplete(shared) }, steps };
  }

  // 4. Каталоги сетей.
  step('Проверяем каталоги магазинов…');
  const retail = await searchRetailProductByBarcode(barcode);
  if (retail) {
    const product = retailToOFFProduct(retail, barcode);
    return { barcode, hit: { product, source: 'retail', incomplete: !isNutritionComplete(product) }, steps };
  }

  return { barcode, hit: null, steps };
}

/**
 * Найденное по коду — в общую базу, чтобы следующий телефон находил без сети.
 * Fire-and-forget: ошибка общей базы не должна ломать сценарий.
 */
export function rememberScannedProduct(product: OFFProduct): void {
  if (!product?.barcode || !isNutritionComplete(product)) return;
  try {
    void saveSharedBarcode(product);
  } catch {
    /* нет общей базы — работаем локально */
  }
}
