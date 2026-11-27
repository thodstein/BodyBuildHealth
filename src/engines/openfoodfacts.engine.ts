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

// Корни сайтов, а не /api/v0: `search.pl` живёт в корне
// (`/api/v0/cgi/search.pl` у OFF отвечает `{"status":0,"status_verbose":"no code
// or invalid code"}` — то есть 0 результатов ВСЕГДА), а продукты берутся по
// `/api/v2/product/{code}.json` (измерено 2026-11-27: 0,2–1,2 с на ответ).
const OFF_WEB_RU = 'https://ru.openfoodfacts.org';
const OFF_WEB_WORLD = 'https://world.openfoodfacts.org';
const OFF_SEARCH = 'https://search.openfoodfacts.org/search';
/** Поля v2-продукта: ровно то, из чего normalizeProduct собирает запись. */
const PRODUCT_FIELDS =
  'code,product_name,product_name_ru,brands,categories,nutriments,serving_quantity,image_small_url';
/** Поля search-a-licious: nutriments он не отдаёт вообще — КБЖУ добираем по коду. */
const SEARCH_FIELDS = 'code,product_name,product_name_ru,brands,countries';
const CACHE_STORE = 'food_cache';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const LS_CACHE_KEY = 'he_off_cache';

const CAT_KEYWORDS: Record<string, string[]> = {
  protein: [
    'meat',
    'мясо',
    'chicken',
    'куриц',
    'fish',
    'рыб',
    'beef',
    'говяд',
    'pork',
    'свинин',
    'turkey',
    'индейк',
    'egg',
    'яйц',
    'seafood',
    'морепродукт',
    'tuna',
    'тунец',
    'salmon',
    'лосос',
    'sausage',
    'колбас',
    'ham',
    'ветчин',
  ],
  dairy: [
    'milk',
    'молок',
    'cheese',
    'сыр',
    'yogurt',
    'йогурт',
    'cream',
    'сливк',
    'butter',
    'масл',
    'kefir',
    'кефир',
    'curd',
    'творог',
  ],
  carb: [
    'rice',
    'рис',
    'pasta',
    'макарон',
    'bread',
    'хлеб',
    'potato',
    'картофел',
    'noodle',
    'лапш',
    'cereal',
    'хлопь',
    'tortilla',
    'лепёшк',
  ],
  grain: [
    'oat',
    'овсян',
    'buckwheat',
    'гречк',
    'quinoa',
    'киноа',
    'bulgur',
    'булгур',
    'barley',
    'перлов',
    'couscous',
    'кускус',
    'millet',
    'пшен',
    'lentil',
    'чечевиц',
  ],
  fat: ['oil', 'масл', 'avocado', 'авокад', 'nut', 'орех', 'seed', 'семечк', 'olive', 'оливк', 'coconut', 'кокос'],
  veg_fruit: [
    'vegetable',
    'овощ',
    'fruit',
    'фрукт',
    'salad',
    'салат',
    'tomato',
    'помидор',
    'cucumber',
    'огурец',
    'broccoli',
    'брокколи',
    'berry',
    'ягод',
  ],
  fast_food: [
    'pizza',
    'пицц',
    'burger',
    'бургер',
    'fries',
    'фри',
    'snack',
    'чипс',
    'chocolate',
    'шоколад',
    'candy',
    'конфет',
    'cookie',
    'печень',
    'cake',
    'торт',
    'soda',
    'газировк',
  ],
  supplement: [
    'protein',
    'протеин',
    'vitamin',
    'витамин',
    'supplement',
    'добавк',
    'whey',
    'сывороточн',
    'bcaa',
    'аминокислот',
    'creatine',
    'креатин',
  ],
};

function detectCategory(categories?: string, name?: string): string {
  const text = ((categories || '') + ' ' + (name || '')).toLowerCase();
  for (const [cat, keywords] of Object.entries(CAT_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw))) return cat;
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
    brand: Array.isArray(p.brands) ? p.brands.join(', ') || undefined : p.brands || undefined,
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

function sanitizeBarcode(raw: string): string {
  return (raw || '').replace(/\D/g, '').trim();
}

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 429/503 у OFF — это «сервис занят», а не «продукта нет»: один повтор через ~1,2 с. */
const RETRYABLE_STATUS = new Set([429, 503]);
const RETRY_DELAY_MS = 1200;
const retryDelay = () => RETRY_DELAY_MS + Math.floor(Math.random() * 300);

type OffResponse =
  | { kind: 'ok'; data: any }
  | { kind: 'miss'; status: number }
  /** 429/503 повторились после паузы: хост недоступен, дальше спрашивать смысла нет. */
  | { kind: 'unavailable' };

/**
 * Один GET с Accept: application/json, таймаутом и одним повтором на 429/503.
 * User-Agent намеренно не выставляется — браузер/WebView отбрасывает этот
 * заголовок (forbidden header), и запрос выглядел бы «неотправленным».
 */
async function fetchJson(url: string, timeoutMs = 8000): Promise<OffResponse> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : undefined;
    try {
      const res = await fetch(url, {
        signal: controller?.signal,
        headers: { Accept: 'application/json' } as any,
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        return data ? { kind: 'ok', data } : { kind: 'miss', status: res.status };
      }
      if (RETRYABLE_STATUS.has(res.status) && attempt === 0) {
        await sleep(retryDelay());
        continue;
      }
      return RETRYABLE_STATUS.has(res.status) ? { kind: 'unavailable' } : { kind: 'miss', status: res.status };
    } catch {
      // Сеть/таймаут — повторять бессмысленно, отдаём промах.
      return { kind: 'miss', status: 0 };
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }
  return { kind: 'unavailable' };
}

function productUrl(base: string, version: 'v0' | 'v2', code: string): string {
  return `${base}/api/${version}/product/${encodeURIComponent(code)}.json?fields=${PRODUCT_FIELDS}`;
}

/**
 * Штрихкод → продукт. Порядок фиксированный и короткий: v2 хоста → v0 того же
 * хоста. Раньше одновременно летели 6 запросов (3 хоста × 2 версии) — отсюда
 * 429/503 и «не найден» на живых российских кодах.
 */
async function fetchFromApi(apiUrl: string, barcode: string): Promise<OFFProduct | null> {
  const bc = sanitizeBarcode(barcode);
  if (!bc) return null;
  for (const version of ['v2', 'v0'] as const) {
    const res = await fetchJson(productUrl(apiUrl, version, bc), 9000);
    // 429/503 после повтора — сдаёмся без исключения.
    if (res.kind === 'unavailable') return null;
    if (res.kind !== 'ok') continue;
    const data = res.data;
    const found = data?.status === 1 || data?.status === '1' || data?.status === true;
    if (found && data.product) {
      const product = normalizeProduct({ ...data.product, code: data.product.code || bc });
      if (product) return product;
    }
  }
  return null;
}

/** Один продукт по коду — для добора КБЖУ у выдачи search-a-licious. */
async function fetchProductByCode(code: string, timeoutMs = 8000): Promise<OFFProduct | null> {
  const bc = sanitizeBarcode(code);
  if (!bc) return null;
  for (const version of ['v2', 'v0'] as const) {
    const res = await fetchJson(productUrl(OFF_WEB_WORLD, version, bc), timeoutMs);
    if (res.kind === 'unavailable') return null;
    if (res.kind !== 'ok' || !res.data?.product) continue;
    return normalizeProduct({ ...res.data.product, code: res.data.product.code || bc });
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

  // Максимум 2 варианта (12↔13 цифр) параллельно, и каждый — не больше 2
  // последовательных запросов на хост. Раньше 6 одновременных запросов сами
  // провоцировали 429/503, и российский код «не находился».
  const results = await Promise.all(
    variants.map(async (variant) => {
      // 46/48 — префиксы GS1, выданные в России: такие коды почти всегда есть
      // только на ru.openfoodfacts.org, а world отвечает двумя промахами
      // (v2+v0) до ~18 с. Остальные коды идём искать на world первым.
      const hosts = /^(46|48)/.test(variant) ? [OFF_WEB_RU, OFF_WEB_WORLD] : [OFF_WEB_WORLD, OFF_WEB_RU];
      for (const host of hosts) {
        const product = await fetchFromApi(host, variant);
        if (product) return product;
      }
      return null;
    }),
  );
  const product = results.find(Boolean) || null;
  if (product) {
    await saveToCache(product);
    return product;
  }
  return null;
}

export async function searchByBarcodeBatch(barcodes: string[]): Promise<(OFFProduct | null)[]> {
  return Promise.all(barcodes.map((b) => searchByBarcode(b)));
}

/**
 * Выдача search-a-licious. Форма ответа зависит от `fields`:
 *   с `fields` — `{"hits":[{...}]}` (массив), без `fields` — `{"hits":{"hits":[...]}}`.
 * Парсим обе, иначе вариант с `fields` читался бы как 0 результатов.
 * `countries:"en:russia"` — синтаксис фильтра в этом индексе; прежний
 * `q=... AND countries_tags:"en:russia"` давал 400 (Search field
 * 'countries_tags' not found in index config) на любой запрос.
 * nutriments этот API не отдаёт вообще (даже при `fields=`) → КБЖУ добираем по
 * code через v2.
 */
async function fetchSearchALiciousHits(query: string, pageSize: number, russiaOnly: boolean): Promise<any[]> {
  const country = russiaOnly ? ' countries:"en:russia"' : '';
  const url =
    `${OFF_SEARCH}?q=${encodeURIComponent(query)}${country}` +
    `&page_size=${pageSize}&langs=ru&fields=${SEARCH_FIELDS}`;
  const res = await fetchJson(url, 8000);
  if (res.kind !== 'ok' || !res.data) return [];
  const data = res.data;
  const hits = Array.isArray(data.hits) ? data.hits : data.hits?.hits || [];
  return Array.isArray(hits) ? hits.filter(Boolean) : [];
}

function isRussiaHit(hit: any): boolean {
  const countries = hit?.countries;
  if (Array.isArray(countries)) return countries.includes('en:russia');
  if (typeof countries === 'string') return countries.includes('en:russia');
  return false;
}

/**
 * Жёсткий фильтр страны слишком узкий («овсянка» — 1 хит, «ветчина» — 5),
 * поэтому основной запрос идёт без него, а товары с `en:russia` в `countries`
 * поднимаются в начало с сохранением исходного порядка релевантности.
 */
function russiaFirst(hits: any[]): any[] {
  const local = hits.filter(isRussiaHit);
  if (local.length === 0 || local.length === hits.length) return hits;
  return [...local, ...hits.filter((hit) => !isRussiaHit(hit))];
}

/**
 * Старый API. `search.pl` живёт в КОРНЕ сайта: `/api/v0/cgi/search.pl` у OFF
 * отвечает `{"status":0,"status_verbose":"no code or invalid code"}` — то есть
 * 0 результатов всегда. Держим как последний резерв: на world/ru этот скрипт
 * часто отдаёт 503 «Page temporarily unavailable».
 */
async function fetchLegacySearch(
  base: string,
  query: string,
  pageSize: number,
  russiaOnly: boolean,
): Promise<OFFProduct[]> {
  const country = russiaOnly ? '&tagtype_0=countries&tag_contains_0=contains&tag_0=en:russia' : '';
  const url =
    `${base}/cgi/search.pl?search_terms=${encodeURIComponent(query)}` +
    `&page_size=${pageSize}&json=1${country}&fields=${PRODUCT_FIELDS}`;
  const res = await fetchJson(url, 8000);
  if (res.kind !== 'ok' || !res.data) return [];
  const products = Array.isArray(res.data.products) ? res.data.products : [];
  return products.map(normalizeProduct).filter(Boolean) as OFFProduct[];
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

/** Сколько кодов добираем по v2 за один поиск и с какой параллельностью. */
const ENRICH_LIMIT = 16;
const ENRICH_CONCURRENCY = 3;
const ENRICH_DEADLINE_MS = 8000;

/**
 * КБЖУ по кодам из выдачи search-a-licious: v2 product, не больше 3 запросов
 * одновременно, общий бюджет 8 с. Порядок — как у поиска, не найденные коды
 * просто выпадают (раньше такой продукт оставался с 0 ккал и UI отбрасывал его
 * как «нет КБЖУ»).
 */
async function hydrateCodes(codes: string[], targetUsable = codes.length): Promise<Map<string, OFFProduct>> {
  const found = new Map<string, OFFProduct>();
  const queue = codes.slice();
  const until = Date.now() + ENRICH_DEADLINE_MS;
  let usable = 0;
  const worker = async () => {
    // Останавливаемся, как только набрали нужное число товаров С КБЖУ: записям
    // без пищевой ценности (их в OFF много) в дневнике делать нечего.
    while (queue.length > 0 && Date.now() < until && usable < targetUsable) {
      const code = queue.shift()!;
      const product = await fetchProductByCode(code);
      if (!product) continue;
      found.set(code, product);
      if (hasNutritionValues(product)) usable += 1;
    }
  };
  await Promise.all(Array.from({ length: ENRICH_CONCURRENCY }, worker));
  return found;
}

/** Коды выдачи в порядке релевантности, без повторов. */
function hitCodes(hits: any[]): string[] {
  const codes: string[] = [];
  const seen = new Set<string>();
  for (const hit of hits) {
    const code = sanitizeBarcode(String(hit?.code ?? hit?.product?.code ?? ''));
    if (!code || seen.has(code)) continue;
    seen.add(code);
    codes.push(code);
  }
  return codes;
}

/** search-a-licious → добор КБЖУ по коду → продукты в порядке релевантности. */
async function collectFromSearch(
  queries: string[],
  pageSize: number,
  russiaOnly: boolean,
  seen: Set<string>,
  expired: () => boolean,
): Promise<OFFProduct[]> {
  const out: OFFProduct[] = [];
  const usableCount = () => out.filter(hasNutritionValues).length;
  for (const qq of queries) {
    if (expired() || usableCount() >= pageSize) break;
    const hits = await fetchSearchALiciousHits(qq, pageSize, russiaOnly);
    const codes = hitCodes(russiaOnly ? hits : russiaFirst(hits))
      .filter((code) => !seen.has(code))
      .slice(0, ENRICH_LIMIT);
    if (codes.length === 0) continue;
    const hydrated = await hydrateCodes(codes, pageSize);
    for (const code of codes) {
      const product = hydrated.get(code);
      if (!product || seen.has(product.barcode || product.id)) continue;
      seen.add(product.barcode || product.id || code);
      // Запись без КБЖУ слот не занимает: иначе «ветчина» = три пустые строки.
      if (!hasNutritionValues(product)) continue;
      out.push(product);
      if (usableCount() >= pageSize) break;
    }
  }
  return out;
}

export async function searchByName(query: string, pageSize = 20): Promise<OFFProduct[]> {
  const q = (query || '').trim();
  if (!q) return [];

  // Кэш — дополнение к сети, а не замена: раньше один раз отсканированное
  // «Молоко 3.2%» оставалось единственным ответом на поиск «молоко», и сеть
  // не спрашивалась вообще (а товар с 0 ккал UI отбрасывал → «ничего не найдено»).
  const cached = await searchCacheByName(q);

  const tryQueries = [q];
  const parts = q.split(/\s+/).filter((p) => p.length > 2);
  if (parts.length > 1) {
    const brand = parts[parts.length - 1];
    if (brand.toLowerCase() !== q.toLowerCase()) tryQueries.push(brand);
    const withoutBrand = parts.slice(0, -1).join(' ');
    if (withoutBrand) tryQueries.push(withoutBrand);
  }

  // RF-first: основной запрос — без фильтра страны (с `langs=ru`), найденное
  // пересортировывается так, чтобы товары из России были первыми; жёсткий
  // фильтр остаётся вторым запросом, если без него пусто. Legacy search.pl —
  // последний резерв. Общий дедлайн, чтобы «ищем ещё…» не крутилось бесконечно.
  const startedAt = Date.now();
  const deadline = 12_000;
  const expired = () => Date.now() - startedAt > deadline;

  const seen = new Set<string>();
  // Точные кэш-совпадения идут первыми; fallback-ступени ниже включаются по
  // пустоте СЕТЕВОЙ выдачи, а не общего списка (кэш не должен их глушить).
  const collected: OFFProduct[] = dedupeOff(cached, seen);
  const network: OFFProduct[] = [];

  // 1. Основная выдача: вся база + страны в хитах, РФ — в начало.
  network.push(...(await collectFromSearch(tryQueries, pageSize, false, seen, expired)));

  // 2. Пусто → тот же поиск с жёстким фильтром страны.
  if (network.length === 0 && !expired()) {
    network.push(...(await collectFromSearch(tryQueries, pageSize, true, seen, expired)));
  }

  // 3. Последний резерв — legacy search.pl в корне сайта (с фильтром и без).
  if (network.length === 0 && !expired()) {
    for (const base of [OFF_WEB_RU, OFF_WEB_WORLD]) {
      for (const russiaOnly of [true, false]) {
        if (expired()) break;
        network.push(...dedupeOff(await fetchLegacySearch(base, q, pageSize, russiaOnly), seen));
        if (network.length > 0) break;
      }
      if (network.length > 0 || expired()) break;
    }
  }

  collected.push(...network);
  // В OFF много записей без пищевой ценности («ветчина» без КБЖУ): для дневника
  // они бесполезны — в него нельзя положить позицию с нулями. Такие товары не
  // отбрасываем совсем (если других нет — пользователь увидит хотя бы название),
  // но слоты выдачи отдаём продуктам с КБЖУ, иначе «ветчина» = три пустые строки.
  const usable = collected.filter(hasNutritionValues);
  const result = (usable.length > 0 ? usable : collected).slice(0, pageSize);
  for (const p of network) {
    if (!result.includes(p)) continue;
    try {
      await saveToCache(p);
    } catch {}
  }
  return result;
}

/** Есть ли хоть одно значение КБЖУ (0 ккал + 0 БЖУ — запись без пищевой ценности). */
function hasNutritionValues(p: { kcal?: number; protein?: number; fat?: number; carbs?: number }): boolean {
  return (
    (Number(p.kcal) || 0) > 0 || (Number(p.protein) || 0) > 0 || (Number(p.fat) || 0) > 0 || (Number(p.carbs) || 0) > 0
  );
}

async function searchCacheByName(query: string): Promise<OFFProduct[]> {
  try {
    const all = await db.getAll<OFFProduct>(CACHE_STORE);
    const q = query.toLowerCase();
    return all
      .filter(
        (p) =>
          Date.now() - p.cachedAt < CACHE_TTL &&
          (p.name.toLowerCase().includes(q) ||
            (p.nameRu && p.nameRu.toLowerCase().includes(q)) ||
            (p.brand && p.brand.toLowerCase().includes(q))),
      )
      .slice(0, 20);
  } catch {
    return [];
  }
}

/**
 * Микросы OFF (`sodium`, `calcium`, … в мг/мкг на 100 г) → канон дневника
 * (`sodium_mg`, `calcium_mg`, …). Без этого очередь и отчёт теряли числа из
 * штрихкода и заполняли витамины «по имени продукта».
 */
export function offMicrosToDiary(micros?: OFFProduct['micros']): Record<string, number> | undefined {
  if (!micros) return undefined;
  const map: Array<[string, number | undefined]> = [
    ['sodium_mg', micros.sodium],
    ['potassium_mg', micros.potassium],
    ['magnesium_mg', micros.magnesium],
    ['calcium_mg', micros.calcium],
    ['iron_mg', micros.iron],
    ['vitamin_c_mg', micros.vitaminC],
    ['vitamin_d_mcg', micros.vitaminD],
    ['vitamin_b12_mcg', micros.vitaminB12],
  ];
  const out: Record<string, number> = {};
  for (const [key, value] of map) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function productToFoodItem(p: OFFProduct) {
  return {
    id: p.barcode || p.id,
    barcode: p.barcode,
    name: p.name,
    category: p.category || 'other',
    kcal: p.kcal,
    protein: p.protein,
    fat: p.fat,
    carbs: p.carbs,
    fiber: p.fiber,
    /** Канон дневника (`sodium_mg`, …) — очередь и отчёт читают именно его. */
    micros: offMicrosToDiary(p.micros),
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
