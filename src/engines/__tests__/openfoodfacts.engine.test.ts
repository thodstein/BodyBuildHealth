/**
 * openfoodfacts.engine.test.ts — сеть OFF без реальной сети.
 *
 * Что замерено живьём 2026-11-27 и что здесь защищается:
 *  - `search.pl` живёт в корне сайта, `/api/v0/cgi/search.pl` всегда отдаёт
 *    `{"status":0,"status_verbose":"no code or invalid code"}`;
 *  - фильтр страны в search-a-licious — `countries:"en:russia"`, а
 *    `countries_tags` даёт 400 (Search field not found in index config);
 *  - search-a-licious не отдаёт nutriments → КБЖУ добираются по code через v2;
 *  - форма ответа зависит от `fields`: `hits` — массив, без `fields` — `hits.hits`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { normalizeProduct, productToFoodItem, searchByBarcode, searchByName } from '../openfoodfacts.engine';

// db-мок объявлен через vi.hoisted, иначе фабрика vi.mock всплывает
// выше инициализации переменных.
const dbMock = vi.hoisted(() => ({
  getAll: vi.fn(async () => [] as any[]),
  get: vi.fn(async () => undefined as any),
  put: vi.fn(async () => undefined),
  delete: vi.fn(async () => undefined),
}));
vi.mock('../../core/db', () => ({ db: dbMock }));

const originalFetch = globalThis.fetch;
let fetchMock: ReturnType<typeof vi.fn>;

function jsonOk(data: any, status = 200) {
  return { ok: true, status, json: async () => data } as any;
}

function httpError(status: number) {
  return { ok: false, status, json: async () => ({}) } as any;
}

/** Подменяет globalThis.fetch: handler(url, номер вызова) → ответ. */
function installFetch(handler: (url: string, call: number) => any) {
  let call = 0;
  fetchMock = vi.fn(async (input: any) => {
    call += 1;
    return handler(String(input), call);
  }) as any;
  globalThis.fetch = fetchMock as any;
}

const calledUrls = () => fetchMock.mock.calls.map((c: any[]) => String(c[0]));

const productResponse = (
  code: string,
  name: string,
  nutriments: Record<string, unknown>,
  extra: Record<string, unknown> = {},
) =>
  jsonOk({
    status: 1,
    code,
    product: { code, product_name_ru: name, brands: 'Бренд', nutriments, serving_quantity: 100, ...extra },
  });

/** Хит выдачи search-a-licious в форме «с fields»: brands — массив, countries — массив. */
const hit = (code: string, countries: string[] = ['en:russia']) => ({
  code,
  product_name: 'товар',
  brands: ['Бренд'],
  countries,
});

const isSearch = (url: string) => url.includes('search.openfoodfacts.org');
const isProductV2 = (url: string, code: string) => url.includes(`/api/v2/product/${code}.json`);

describe('Open Food Facts: поиск по названию', () => {
  beforeEach(() => {
    globalThis.localStorage?.clear?.();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('выдача без countries_tags, КБЖУ добираются по коду через v2', async () => {
    installFetch((url) => {
      if (isSearch(url)) return jsonOk({ hits: [hit('4600680251387')] });
      if (isProductV2(url, '4600680251387')) {
        return productResponse('4600680251387', 'Чипсы', {
          'energy-kcal_100g': 370,
          proteins_100g: 11,
          fat_100g: 6.2,
          carbohydrates_100g: 63,
        });
      }
      return httpError(404);
    });

    const products = await searchByName('овсянка');

    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      barcode: '4600680251387',
      kcal: 370,
      protein: 11,
      fat: 6.2,
      carbs: 63,
    });

    const urls = calledUrls();
    const searchUrl = urls.find(isSearch)!;
    expect(searchUrl).not.toContain('countries_tags');
    expect(searchUrl).toContain('langs=ru');
    expect(urls.some((u) => isProductV2(u, '4600680251387'))).toBe(true);
  });

  it('только energy-kj_100g (1558 кДж) → 372 ккал, а не 0', async () => {
    installFetch((url) => {
      if (isSearch(url)) return jsonOk({ hits: [hit('4610009511207')] });
      if (isProductV2(url, '4610009511207')) {
        return productResponse('4610009511207', 'Ветчина', {
          'energy-kj_100g': 1558,
          proteins_100g: 12.8,
          fat_100g: 4.1,
          carbohydrates_100g: 1.5,
        });
      }
      return httpError(404);
    });

    const [product] = await searchByName('ветчина');

    expect(product.kcal).toBe(372);
    expect(product.protein).toBe(12.8);
  });

  it('ответ без fields (hits — вложенный объект) тоже читается', async () => {
    installFetch((url) => {
      if (isSearch(url)) return jsonOk({ hits: { hits: [hit('4607016245515')] } });
      if (isProductV2(url, '4607016245515')) {
        return productResponse('4607016245515', 'Рис', { 'energy-kcal_100g': 340 });
      }
      return httpError(404);
    });

    const products = await searchByName('рис');

    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({ barcode: '4607016245515', kcal: 340 });
  });

  it('товары из России из общей выдачи поднимаются в начало', async () => {
    installFetch((url) => {
      if (isSearch(url)) {
        return jsonOk({
          hits: [hit('1111111111111', ['en:france']), hit('4607016245515', ['en:russia'])],
        });
      }
      if (isProductV2(url, '1111111111111')) {
        return productResponse('1111111111111', 'Иностранный', { 'energy-kcal_100g': 100 });
      }
      if (isProductV2(url, '4607016245515')) {
        return productResponse('4607016245515', 'Рис Увелка', { 'energy-kcal_100g': 340 });
      }
      return httpError(404);
    });

    const products = await searchByName('рис');

    expect(products.map((p) => p.barcode)).toEqual(['4607016245515', '1111111111111']);
  });

  it('пустая выдача → повторный запрос с фильтром страны countries:"en:russia"', async () => {
    installFetch((url) => {
      if (isSearch(url) && url.includes('countries:"en:russia"')) return httpError(503);
      if (isSearch(url)) return jsonOk({ hits: [] });
      return httpError(404);
    });

    const products = await searchByName('овсянка');

    expect(products).toEqual([]);
    const searchUrls = calledUrls().filter(isSearch);
    expect(searchUrls.length).toBeGreaterThan(1);
    expect(searchUrls.some((u) => u.includes('countries:"en:russia"'))).toBe(true);
    expect(searchUrls.every((u) => !u.includes('countries_tags'))).toBe(true);
  });

  it('битый ответ search-a-licious (hits=undefined) → [] без исключения', async () => {
    installFetch(() => jsonOk({}));

    await expect(searchByName('овсянка')).resolves.toEqual([]);
  });

  it('код, который не добрался по v2, выпадает, остальные остаются', async () => {
    installFetch((url) => {
      if (isSearch(url)) return jsonOk({ hits: [hit('4000000000001'), hit('4607016245515')] });
      if (isProductV2(url, '4607016245515')) {
        return productResponse('4607016245515', 'Рис', { 'energy-kcal_100g': 340 });
      }
      return httpError(404);
    });

    const products = await searchByName('рис');

    expect(products.map((p) => p.barcode)).toEqual(['4607016245515']);
  });
});

describe('Open Food Facts: штрихкод', () => {
  beforeEach(() => {
    globalThis.localStorage?.clear?.();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('v2-продукт 4607016245515 → 340 ккал', async () => {
    installFetch((url) =>
      isProductV2(url, '4607016245515')
        ? productResponse('4607016245515', 'Рис Увелка', {
            'energy-kcal_100g': 340,
            proteins_100g: 7,
            fat_100g: 0.5,
            carbohydrates_100g: 76,
          })
        : httpError(404),
    );

    const product = await searchByBarcode('4607016245515');

    expect(product).toMatchObject({ barcode: '4607016245515', kcal: 340, carbs: 76 });
  });

  it('503 на первом запросе → один повтор → продукт найден', async () => {
    installFetch((url, call) =>
      call === 1
        ? httpError(503)
        : isProductV2(url, '4600680251387')
          ? productResponse('4600680251387', 'Ветчина Черкизово', { 'energy-kcal_100g': 236 })
          : httpError(404),
    );

    const product = await searchByBarcode('4600680251387');

    expect(product).toMatchObject({ barcode: '4600680251387', kcal: 236 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('503 дважды → null, без исключения', async () => {
    installFetch(() => httpError(503));

    await expect(searchByBarcode('4600680251387')).resolves.toBeNull();
  });
});

describe('Open Food Facts: поиск по названию и кэш', () => {
  const cachedMilk = {
    id: '4600000000001',
    barcode: '4600000000001',
    name: 'Молоко 3.2%',
    kcal: 60,
    protein: 3,
    fat: 3.2,
    carbs: 4.7,
    fiber: 0,
    servingSize: '100 г',
    cachedAt: Date.now(),
  };

  beforeEach(() => {
    globalThis.localStorage?.clear?.();
    dbMock.getAll.mockReset();
    dbMock.getAll.mockResolvedValue([cachedMilk]);
    dbMock.get.mockReset();
    dbMock.get.mockResolvedValue(undefined);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('кэш дополняет сеть, а не заменяет её', async () => {
    installFetch((url) => {
      if (isSearch(url)) return jsonOk({ hits: [hit('4607016245515'), hit('1111111111111', ['en:france'])] });
      if (isProductV2(url, '4607016245515')) {
        return productResponse('4607016245515', 'Молоко Увелка', { 'energy-kcal_100g': 62 });
      }
      if (isProductV2(url, '1111111111111')) {
        return productResponse('1111111111111', 'Milk Foreign', { 'energy-kcal_100g': 50 });
      }
      return httpError(404);
    });

    const products = await searchByName('молоко');
    const barcodes = products.map((p) => p.barcode);

    expect(barcodes).toContain('4600000000001');
    expect(barcodes).toContain('4607016245515');
    expect(barcodes).toContain('1111111111111');
    // Точное кэш-совпадение — первым, РФ-товар из сети — раньше иностранного.
    expect(barcodes).toEqual(['4600000000001', '4607016245515', '1111111111111']);
    expect(calledUrls().some(isSearch)).toBe(true);
  });

  it('пустая сетевая выдача → результат равен кэшу', async () => {
    installFetch((url) => (isSearch(url) ? jsonOk({ hits: [] }) : httpError(404)));

    const products = await searchByName('молоко');

    expect(products.map((p) => p.barcode)).toEqual(['4600000000001']);
    expect(calledUrls().some(isSearch)).toBe(true);
  });
});

describe('Open Food Facts: порядок хостов по штрихкоду', () => {
  beforeEach(() => {
    globalThis.localStorage?.clear?.();
    dbMock.getAll.mockResolvedValue([]);
    dbMock.get.mockResolvedValue(undefined);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  const firstUrlFor = async (barcode: string) => {
    installFetch(() => httpError(404));
    await searchByBarcode(barcode);
    return calledUrls()[0];
  };

  it('код 4600680251387 → первый запрос на ru.openfoodfacts.org', async () => {
    expect(await firstUrlFor('4600680251387')).toContain('https://ru.openfoodfacts.org/');
  });

  it('код 3017620422003 → первый запрос на world.openfoodfacts.org', async () => {
    expect(await firstUrlFor('3017620422003')).toContain('https://world.openfoodfacts.org/');
  });

  it('код 0000000000000 (UPC/EAN без страны) → первый запрос на world.openfoodfacts.org', async () => {
    expect(await firstUrlFor('0000000000000')).toContain('https://world.openfoodfacts.org/');
  });
});

describe('Open Food Facts: карточка → продукт дневника', () => {
  it('переносит barcode (иначе повторное сканирование не дедуплицируется)', () => {
    const item = productToFoodItem({
      id: '4600680251387',
      barcode: '4600680251387',
      name: 'Ветчина Черкизово',
      kcal: 236,
      protein: 12,
      fat: 18,
      carbs: 1,
      fiber: 0,
      servingSize: '100 г',
      cachedAt: Date.now(),
    });

    expect(item.id).toBe('4600680251387');
    expect(item.barcode).toBe('4600680251387');
  });
});

describe('openfoodfacts: нормализация продукта', () => {
  it('считает ккал из energy-kj, когда energy-kcal нет', () => {
    const product = normalizeProduct({
      code: '4600000000000',
      product_name: 'Овсяные хлопья',
      nutriments: { 'energy-kj_100g': 1500, proteins_100g: 12, fat_100g: 6, carbohydrates_100g: 60 },
    })!;
    // Раньше такой продукт приходил в дневник с 0 ккал.
    expect(product.kcal).toBe(359);
  });

  it('берёт общий energy (кДж) как запасной вариант', () => {
    const product = normalizeProduct({
      code: '1',
      product_name: 'Продукт',
      nutriments: { energy_100g: 418.4 },
    })!;
    expect(product.kcal).toBe(100);
  });

  it('предпочитает energy-kcal, когда он есть', () => {
    const product = normalizeProduct({
      code: '2',
      product_name: 'Продукт',
      nutriments: { 'energy-kcal_100g': 250, 'energy-kj_100g': 1200 },
    })!;
    expect(product.kcal).toBe(250);
  });

  it('переводит микроэлементы OFF из граммов в мг/мкг приложения', () => {
    const product = normalizeProduct({
      code: '3',
      product_name: 'Продукт',
      nutriments: {
        'energy-kcal_100g': 100,
        sodium_100g: 0.5,
        calcium_100g: 0.12,
        iron_100g: 0.002,
        potassium_100g: 0.35,
        'vitamin-c_100g': 0.015,
        'vitamin-d_100g': 0.0000015,
        'vitamin-b12_100g': 0.0000024,
        'saturated-fat_100g': 1.2,
      },
    })!;
    // Приложение хранит Na/Ca/Fe/K/витамин C в мг, D/B12 — в мкг.
    expect(product.micros).toMatchObject({
      sodium: 500,
      calcium: 120,
      iron: 2,
      potassium: 350,
      vitaminC: 15,
      vitaminD: 1.5,
      vitaminB12: 2.4,
      saturatedFat: 1.2,
    });
  });

  it('не выдумывает микроэлементы, которых нет в OFF', () => {
    const product = normalizeProduct({ code: '4', product_name: 'Продукт', nutriments: { 'energy-kcal_100g': 10 } })!;
    expect(product.micros?.sodium).toBeUndefined();
    expect(product.micros?.vitaminD).toBeUndefined();
  });

  it('brands массивом (как в search-a-licious) склеивается в строку', () => {
    const product = normalizeProduct({
      code: '4610009511207',
      product_name_ru: 'Ветчина',
      brands: ['Черкизово', 'Мясокомбинат'],
      nutriments: { 'energy-kcal_100g': 236 },
    });

    expect(product).toMatchObject({
      barcode: '4610009511207',
      name: 'Ветчина',
      brand: 'Черкизово, Мясокомбинат',
      kcal: 236,
    });
  });
});
