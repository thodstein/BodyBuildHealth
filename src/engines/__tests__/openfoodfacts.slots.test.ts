/**
 * openfoodfacts.slots.test.ts — товары без пищевой ценности не занимают слоты.
 *
 * Живой факт (2026-11-27): в выдаче search-a-licious по «ветчина» первые три
 * записи OFF не имеют КБЖУ (0 ккал / 0 БЖУ), поэтому раньше список выглядел как
 * три пустые строки, а UI их выкидывал по фильтру `kcal > 0`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { searchByName } from '../openfoodfacts.engine';

const dbMock = vi.hoisted(() => ({
  getAll: vi.fn(async () => [] as any[]),
  get: vi.fn(async () => undefined as any),
  put: vi.fn(async () => undefined),
  delete: vi.fn(async () => undefined),
}));
vi.mock('../../core/db', () => ({ db: dbMock }));

const originalFetch = globalThis.fetch;

const jsonOk = (data: any) => ({ ok: true, status: 200, json: async () => data }) as any;
const isSearch = (url: string) => url.includes('search.openfoodfacts.org');
const isProductV2 = (url: string, code: string) => url.includes(`/api/v2/product/${code}.json`);

describe('searchByName: записи без КБЖУ не занимают слоты', () => {
  beforeEach(() => {
    globalThis.localStorage?.clear?.();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('пустая запись OFF отбрасывается, товар с КБЖУ остаётся', async () => {
    globalThis.fetch = vi.fn(async (input: any) => {
      const url = String(input);
      if (isSearch(url)) {
        return jsonOk({ hits: [{ code: '4600000000001' }, { code: '4610009511207' }] });
      }
      // Первый код — запись без nutriments, второй — ветчина Черкизово.
      if (isProductV2(url, '4600000000001')) {
        return jsonOk({ status: 1, product: { code: '4600000000001', product_name_ru: 'ветчина', nutriments: {} } });
      }
      if (isProductV2(url, '4610009511207')) {
        return jsonOk({
          status: 1,
          product: {
            code: '4610009511207',
            product_name_ru: 'ветчина',
            nutriments: { 'energy-kcal_100g': 236, proteins_100g: 11, fat_100g: 20, carbohydrates_100g: 3 },
          },
        });
      }
      return { ok: false, status: 404, json: async () => ({}) } as any;
    }) as any;

    const result = await searchByName('ветчина', 16);

    expect(result).toHaveLength(1);
    expect(result[0].barcode).toBe('4610009511207');
    expect(result[0].kcal).toBe(236);
  });
});
