import { db } from '../core/db';

export interface OFFProduct {
  id: string;
  barcode: string;
  name: string;
  nameRu?: string;
  brand?: string;
  categories?: string;
  category?: string;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
  servingSize: string;
  imageUrl?: string;
  cachedAt: number;
  micros?: {
    saturatedFat?: number;
    sugars?: number;
    sodium?: number;
    calcium?: number;
    iron?: number;
    magnesium?: number;
    potassium?: number;
    vitaminC?: number;
    vitaminD?: number;
    vitaminB12?: number;
  };
}

const OFF_API_RU = 'https://ru.openfoodfacts.org/api/v0';
const OFF_API_WORLD = 'https://world.openfoodfacts.org/api/v0';
const OFF_API_US = 'https://us.openfoodfacts.org/api/v0';
const CACHE_STORE = 'food_cache';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const LS_CACHE_KEY = 'he_off_cache';

const CAT_KEYWORDS: Record<string, string[]> = {
  protein: ['meat', 'мясо', 'chicken', 'куриц', 'fish', 'рыб', 'beef', 'говяд', 'pork', 'свинин',
    'turkey', 'индейк', 'egg', 'яйц', 'seafood', 'морепродукт', 'tuna', 'тунец', 'salmon', 'лосос',
    'sausage', 'колбас', 'ham', 'ветчин'],
  dairy: ['milk', 'молок', 'cheese', 'сыр', 'yogurt', 'йогурт', 'cream', 'сливк', 'butter', 'масл',
    'kefir', 'кефир', 'curd', 'творог'],
  carb: ['rice', 'рис', 'pasta', 'макарон', 'bread', 'хлеб', 'potato', 'картофел', 'noodle', 'лапш',
    'cereal', 'хлопь', 'tortilla', 'лепёшк'],
  grain: ['oat', 'овсян', 'buckwheat', 'гречк', 'quinoa', 'киноа', 'bulgur', 'булгур', 'barley', 'перлов',
    'couscous', 'кускус', 'millet', 'пшен', 'lentil', 'чечевиц'],
  fat: ['oil', 'масл', 'avocado', 'авокад', 'nut', 'орех', 'seed', 'семечк', 'olive', 'оливк',
    'coconut', 'кокос'],
  veg_fruit: ['vegetable', 'овощ', 'fruit', 'фрукт', 'salad', 'салат', 'tomato', 'помидор',
    'cucumber', 'огурец', 'broccoli', 'брокколи', 'berry', 'ягод'],
  fast_food: ['pizza', 'пицц', 'burger', 'бургер', 'fries', 'фри', 'snack', 'чипс', 'chocolate', 'шоколад',
    'candy', 'конфет', 'cookie', 'печень', 'cake', 'торт', 'soda', 'газировк'],
  supplement: ['protein', 'протеин', 'vitamin', 'витамин', 'supplement', 'добавк', 'whey', 'сывороточн',
    'bcaa', 'аминокислот', 'creatine', 'креатин'],
};

function detectCategory(categories?: string, name?: string): string {
  const text = ((categories || '') + ' ' + (name || '')).toLowerCase();
  for (const [cat, keywords] of Object.entries(CAT_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) return cat;
  }
  return 'other';
}

function round1(v: number | undefined, digits = 1): number | undefined {
  if (v === undefined || v === null) return undefined;
  const factor = 10 ** digits;
  return Math.round(v * factor) / factor;
}

/** Пересчёт единиц OFF → приложение. Отсутствующее значение остаётся undefined. */
function convertUnit(value: unknown, factor: number): number | undefined {
  if (value === undefined || value === null) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? round1(num * factor, 2) : undefined;
}

export function normalizeProduct(p: any): OFFProduct | null {
  const nutriments = p.nutriments || {};
  const name = p.product_name_ru || p.product_name || '';
  if (!name) return null;
  const n = (field: string) => nutriments[field + '_100g'] ?? nutriments[field];
  // OFF отдаёт микроэлементы в граммах на 100 г (sodium 0.5 = 500 мг), а
  // остальное приложение хранит натрий/кальций/железо в мг, витамины D/B12 —
  // в мкг. Без пересчёта дневник получал 0,5 мг натрия вместо 500.
  const grams = (field: string) => convertUnit(n(field), 1000);
  const micrograms = (field: string) => convertUnit(n(field), 1_000_000);
  // Энергетическая ценность: в OFF часто есть только energy-kj (или общий
  // energy) в кДж, а energy-kcal отсутствует — раньше такой продукт приходил
  // с 0 ккал. 1 ккал = 4,184 кДж.
  const kcalValue = convertUnit(n('energy-kcal'), 1);
  const kjValue = convertUnit(n('energy-kj'), 1);
  const energyValue = convertUnit(n('energy'), 1);
  let kcal = kcalValue && kcalValue > 0 ? kcalValue : 0;
  if (kcal <= 0) {
    if (kjValue && kjValue > 0) kcal = kjValue / 4.184;
    else if (energyValue && energyValue > 0) kcal = energyValue / 4.184;
  }
  return {
    id: p.code || p._id || '',
    barcode: p.code || '',
    name,
    nameRu: p.product_name_ru || undefined,
    brand: p.brands || undefined,
    categories: p.categories || undefined,
    category: detectCategory(p.categories, name),
    kcal: Math.round(kcal || 0),
    protein: round1(n('proteins')) || 0,
    fat: round1(n('fat')) || 0,
    carbs: round1(n('carbohydrates')) || 0,
    fiber: round1(n('fiber')) || 0,
    servingSize: p.serving_quantity ? `${p.serving_quantity} г` : '100 г',
    imageUrl: p.image_small_url || p.image_front_small_url || undefined,
    cachedAt: Date.now(),
    micros: {
      saturatedFat: round1(n('saturated-fat')),
      sugars: round1(n('sugars')),
      sodium: grams('sodium'),
      calcium: grams('calcium'),
      iron: grams('iron'),
      magnesium: grams('magnesium'),
      potassium: grams('potassium'),
      vitaminC: grams('vitamin-c'),
      vitaminD: micrograms('vitamin-d'),
      vitaminB12: micrograms('vitamin-b12'),
    },
  };
}

async function getCached(barcode: string): Promise<OFFProduct | null> {
  try {
    const cached = await db.get<OFFProduct>(CACHE_STORE, barcode);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL) return cached;
    if (cached) await db.delete(CACHE_STORE, barcode);
  } catch {}
  try {
    const ls = localStorage.getItem(LS_CACHE_KEY);
    if (ls) {
      const map: Record<string, OFFProduct> = JSON.parse(ls);
      const hit = map[barcode];
      if (hit && Date.now() - hit.cachedAt < CACHE_TTL) return hit;
    }
  } catch {}
  return null;
}

export async function saveToCache(product: OFFProduct): Promise<void> {
  try {
    await db.put(CACHE_STORE, product);
  } catch {}
  try {
    const ls = localStorage.getItem(LS_CACHE_KEY);
    const map: Record<string, OFFProduct> = ls ? JSON.parse(ls) : {};
    map[product.barcode] = product;
    const keys = Object.keys(map);
    if (keys.length > 200) delete map[keys[0]];
    localStorage.setItem(LS_CACHE_KEY, JSON.stringify(map));
  } catch {}
}

function sanitizeBarcode(raw: string): string { return (raw || '').replace(/\D/g, '').trim(); }

/** Return equivalent GTIN spellings used by different product databases. */
function barcodeVariants(raw: string): string[] {
  const bc = sanitizeBarcode(raw);
  if (!bc) return [];
  const variants = new Set([bc]);
  // UPC-A is the 12-digit form of EAN-13 with a leading zero.
  if (bc.length === 12) variants.add(`0${bc}`);
  // Some scanners omit a leading zero from an EAN-13 value.
  if (bc.length === 13 && bc.startsWith('0')) variants.add(bc.slice(1));
  return [...variants];
}

async function fetchFromApi(apiUrl: string, barcode: string): Promise<OFFProduct | null> {
  const bc = sanitizeBarcode(barcode);
  if (!bc) return null;
  const urls = [
    `${apiUrl}/product/${bc}.json`,
    `${apiUrl.replace('/api/v0', '/api/v2')}/product/${bc}.json`,
  ];
  for (const url of urls) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeout = controller ? setTimeout(() => controller.abort(), 9000) : undefined;
    try {
      const res = await fetch(url, {
        signal: controller?.signal,
        headers: { Accept: 'application/json' } as any,
      });
      if (!res.ok) continue;
      const data = await res.json();
      const found = data.status === 1 || data.status === '1' || data.status === true;
      if (found && data.product) return normalizeProduct(data.product);
    } catch {
      // Try the v2 endpoint before reporting a miss.
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
    }
  }
  return null;
}

// Экспортируем для ручного оффлайн-создания (штрихкод не найден → создать свою еду)
export async function cacheCustomProduct(p: OFFProduct): Promise<void> {
  const prod = { ...p, cachedAt: Date.now() } as OFFProduct;
  await saveToCache(prod);
}

export async function searchByBarcode(barcode: string): Promise<OFFProduct | null> {
  const variants = barcodeVariants(barcode);
  if (variants.length === 0) return null;

  for (const variant of variants) {
    const cached = await getCached(variant);
    if (cached) return cached;
  }

  // РФ-приоритет: 460-469 — российские штрихкоды → RU первым, иначе тот же порядок (RU уже первый)
  const requests = variants.flatMap(variant => [OFF_API_RU, OFF_API_WORLD, OFF_API_US]
    .map(api => fetchFromApi(api, variant)));
  const results = await Promise.all(requests);
  const product = results.find(Boolean);
  if (product) {
    await saveToCache(product);
    return product;
  }
  return null;
}

export async function searchByBarcodeBatch(barcodes: string[]): Promise<(OFFProduct | null)[]> {
  return Promise.all(barcodes.map(b => searchByBarcode(b)));
}

function offProductFromHit(p: any): OFFProduct | null {
  if (!p) return null;
  const src = p.product || p;
  return normalizeProduct(src.code ? src : {
    ...src,
    code: src.code || src._id,
    product_name: src.product_name || src.product_name_ru,
    nutriments: src.nutriments,
  });
}

async function fetchSearchALicious(query: string, pageSize: number, russiaOnly: boolean): Promise<OFFProduct[]> {
  const term = russiaOnly ? `${query} AND countries_tags:"en:russia"` : query;
  try {
    const encoded = encodeURIComponent(term);
    const res = await fetch(`https://search.openfoodfacts.org/search?q=${encoded}&page_size=${pageSize}`, { signal: AbortSignal.timeout(7000), headers: { 'Accept': 'application/json' } as any });
    if (!res.ok) return [];
    const data = await res.json();
    const hits = (data.hits || data.products || []) as any[];
    const products: OFFProduct[] = [];
    for (const p of hits) {
      const norm = offProductFromHit(p);
      if (norm) products.push(norm);
    }
    return products;
  } catch {
    return [];
  }
}

/**
 * Старый API ru.openfoodfacts.org с фильтром страны. Именно он отдаёт
 * российские бренды (Простоквашино, Домик в деревне, Савушкин) — новый
 * Search-a-licious без фильтра ставит первыми иностранные позиции.
 */
async function fetchRussiaLegacy(query: string, pageSize: number): Promise<OFFProduct[]> {
  try {
    const encoded = encodeURIComponent(query);
    const url = `${OFF_API_RU}/cgi/search.pl?search_terms=${encoded}&page_size=${pageSize}&json=1`
      + '&tagtype_0=countries&tag_contains_0=contains&tag_0=russia'
      + '&fields=code,product_name,product_name_ru,brands,categories,nutriments,image_small_url,serving_quantity';
    const res = await fetch(url, { signal: AbortSignal.timeout(7000), headers: { 'Accept': 'application/json' } as any });
    if (!res.ok) return [];
    const data = await res.json();
    const products: OFFProduct[] = [];
    for (const p of (data.products || [])) {
      const norm = normalizeProduct(p);
      if (norm) products.push(norm);
    }
    return products;
  } catch {
    return [];
  }
}

function dedupeOff(products: OFFProduct[], seen: Set<string>): OFFProduct[] {
  const out: OFFProduct[] = [];
  for (const p of products) {
    const key = p.barcode || p.id || p.name.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

export async function searchByName(query: string, pageSize = 20): Promise<OFFProduct[]> {
  const q = (query || '').trim();
  if (!q) return [];

  const cached = await searchCacheByName(q);
  if (cached.length > 0) return cached;

  const tryQueries = [q];
  const parts = q.split(/\s+/).filter(p => p.length > 2);
  if (parts.length > 1) {
    const brand = parts[parts.length - 1];
    if (brand.toLowerCase() !== q.toLowerCase()) tryQueries.push(brand);
    const withoutBrand = parts.slice(0, -1).join(' ');
    if (withoutBrand) tryQueries.push(withoutBrand);
  }

  // RF-first: бренды РФ должны быть в начале выдачи, а не после иностранных
  // товаров. Оба российских источника спрашиваем параллельно (последовательно
  // это 2×7 с ожидания при медленной сети), добираем остаток и следим за
  // общим дедлайном — строка «ищем ещё…» не должна крутиться бесконечно.
  const startedAt = Date.now();
  const deadline = 12_000;
  const expired = () => Date.now() - startedAt > deadline;

  const seen = new Set<string>();
  const collected: OFFProduct[] = [];
  for (const qq of tryQueries) {
    if (expired()) break;
    const [legacy, salic] = await Promise.all([
      fetchRussiaLegacy(qq, pageSize),
      fetchSearchALicious(qq, pageSize, true),
    ]);
    collected.push(...dedupeOff(legacy, seen), ...dedupeOff(salic, seen));
    if (collected.length >= pageSize) break;
  }
  // Если по стране данных мало — добираем общий индекс, но только в конец.
  if (collected.length < pageSize && !expired()) {
    for (const qq of tryQueries) {
      if (expired()) break;
      collected.push(...dedupeOff(await fetchSearchALicious(qq, pageSize, false), seen));
      if (collected.length >= pageSize) break;
    }
  }

  if (collected.length === 0 && !expired()) {
    // Последний шанс — старый API без фильтра.
    for (const api of [OFF_API_RU, OFF_API_WORLD]) {
      try {
        const encoded = encodeURIComponent(q);
        const res = await fetch(`${api}/cgi/search.pl?search_terms=${encoded}&page_size=${pageSize}&json=1&fields=code,product_name,product_name_ru,brands,categories,nutriments,image_small_url`, { signal: AbortSignal.timeout(7000), headers: { 'Accept': 'application/json' } as any });
        if (!res.ok) continue;
        const data = await res.json();
        collected.push(...dedupeOff((data.products || []).map(normalizeProduct).filter(Boolean) as OFFProduct[], seen));
        if (collected.length > 0) break;
      } catch {}
    }
  }

  for (const p of collected.slice(0, pageSize)) {
    try { await saveToCache(p); } catch {}
  }
  return collected.slice(0, pageSize);
}

async function searchCacheByName(query: string): Promise<OFFProduct[]> {
  try {
    const all = await db.getAll<OFFProduct>(CACHE_STORE);
    const q = query.toLowerCase();
    return all.filter(p =>
      Date.now() - p.cachedAt < CACHE_TTL &&
      (p.name.toLowerCase().includes(q) || (p.nameRu && p.nameRu.toLowerCase().includes(q)) || (p.brand && p.brand.toLowerCase().includes(q)))
    ).slice(0, 20);
  } catch {
    return [];
  }
}

export function productToFoodItem(p: OFFProduct) {
  return {
    id: p.barcode || p.id,
    name: p.name,
    category: p.category || 'other',
    kcal: p.kcal,
    protein: p.protein,
    fat: p.fat,
    carbs: p.carbs,
    fiber: p.fiber,
    saturatedFat: p.micros?.saturatedFat,
    sugars: p.micros?.sugars,
    sodium: p.micros?.sodium,
    calcium: p.micros?.calcium,
    iron: p.micros?.iron,
    magnesium: p.micros?.magnesium,
    potassium: p.micros?.potassium,
    vitaminC: p.micros?.vitaminC,
    vitaminD: p.micros?.vitaminD,
    vitaminB12: p.micros?.vitaminB12,
    gi: 0,
    servingSize: p.servingSize,
    description: [p.brand, p.categories].filter(Boolean).join(' • '),
    tier: 'basic' as const,
  };
}
