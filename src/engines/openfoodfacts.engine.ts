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

function round1(v: number | undefined): number | undefined {
  return v !== undefined && v !== null ? Math.round(v * 10) / 10 : undefined;
}

function normalizeProduct(p: any): OFFProduct | null {
  const nutriments = p.nutriments || {};
  const name = p.product_name_ru || p.product_name || '';
  if (!name) return null;
  const n = (field: string) => nutriments[field + '_100g'] ?? nutriments[field];
  return {
    id: p.code || p._id || '',
    barcode: p.code || '',
    name,
    nameRu: p.product_name_ru || undefined,
    brand: p.brands || undefined,
    categories: p.categories || undefined,
    category: detectCategory(p.categories, name),
    kcal: Math.round(n('energy-kcal') || 0),
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
      sodium: round1(n('sodium')),
      calcium: round1(n('calcium')),
      iron: round1(n('iron')),
      magnesium: round1(n('magnesium')),
      potassium: round1(n('potassium')),
      vitaminC: round1(n('vitamin-c')),
      vitaminD: n('vitamin-d'),
      vitaminB12: n('vitamin-b12'),
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

  for (const qq of tryQueries) {
    // 1. Новый Search-a-licious (лучше для РФ)
    try {
      const encoded = encodeURIComponent(qq);
      const res = await fetch(`https://search.openfoodfacts.org/search?q=${encoded}&page_size=${pageSize}`, { signal: AbortSignal.timeout(7000), headers: { 'Accept': 'application/json' } as any });
      if (res.ok) {
        const data = await res.json();
        const hits = (data.hits || data.products || []) as any[];
        if (hits.length > 0) {
          const products: OFFProduct[] = [];
          for (const p of hits) {
            const src = p.product || p;
            const norm = normalizeProduct(src.code ? src : { ...src, code: src.code || src._id, product_name: src.product_name || src.product_name_ru, nutriments: src.nutriments });
            if (norm) {
              await saveToCache(norm);
              products.push(norm);
            }
          }
          if (products.length > 0) return products;
        }
      }
    } catch {}
    // 2. Fallback старый API
    const apis = [OFF_API_RU, OFF_API_WORLD];
    for (const api of apis) {
      try {
        const encoded = encodeURIComponent(qq);
        const res = await fetch(`${api}/cgi/search.pl?search_terms=${encoded}&page_size=${pageSize}&json=1&fields=code,product_name,product_name_ru,brands,categories,nutriments,image_small_url`, { signal: AbortSignal.timeout(7000), headers: { 'Accept': 'application/json' } as any });
        if (!res.ok) continue;
        const data = await res.json();
        if (!data.products) continue;
        const products: OFFProduct[] = [];
        for (const p of data.products) {
          const norm = normalizeProduct(p);
          if (norm) {
            await saveToCache(norm);
            products.push(norm);
          }
        }
        if (products.length > 0) return products;
      } catch {}
    }
  }
  return [];
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
