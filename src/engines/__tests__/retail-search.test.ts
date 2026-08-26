import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type Engine = typeof import('../retail-search.engine');

async function loadEngine(url = '', key = ''): Promise<Engine> {
  vi.resetModules();
  vi.stubEnv('VITE_SUPABASE_URL', url);
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', key);
  return await import('../retail-search.engine');
}

const FETCH_OK = {
  ok: true,
  json: async () => ({
    items: [
      { id: '1', source: 'vkusvill', name: 'Творог обезжиренный', kcal: 71, protein: 12, fat: 0.2, carbs: 4.7 },
      { id: '2', source: 'pyaterochka', name: 'Творог 5%', kcal: 121, protein: 17, fat: 5, carbs: 1.8 },
    ],
    sources: ['vkusvill', 'pyaterochka'],
  }),
} as Response;

describe('retail-search engine', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('normalizeRetailQuery: ё→е, trim, collapse spaces, lowercase', async () => {
    const e = await loadEngine();
    expect(e.normalizeRetailQuery('  ТворОг   Ёлки  ')).toBe('творог елки');
    expect(e.normalizeRetailQuery('')).toBe('');
  });

  it('guessRetailCategory: основные категории', async () => {
    const e = await loadEngine();
    expect(e.guessRetailCategory('Творог обезжиренный')).toBe('dairy');
    expect(e.guessRetailCategory('Курица гриль')).toBe('protein');
    expect(e.guessRetailCategory('Овсяные хлопья')).toBe('grain');
    expect(e.guessRetailCategory('Хлеб бородинский')).toBe('carb');
    expect(e.guessRetailCategory('Масло оливковое Extra Virgin')).toBe('fat');
    expect(e.guessRetailCategory('Протеин сывороточный')).toBe('supplement');
    expect(e.guessRetailCategory('Яблоко Голден')).toBe('veg_fruit');
    expect(e.guessRetailCategory('Чипсы со вкусом сыра')).toBe('fast_food');
    expect(e.guessRetailCategory('Нечто невнятное')).toBe('other');
  });

  it('retailToFoodItem: префикс id, 100 г, описание с сетью и брендом', async () => {
    const e = await loadEngine();
    const item = e.retailToFoodItem({
      id: '42', source: 'vkusvill', name: 'Хумус классический', brand: 'ВкусВилл',
      kcal: 236, protein: 8.6, fat: 17.8, carbs: 14.3, weight: '300 г',
    });
    expect(item.id).toBe('retail:vkusvill:42');
    expect(item.servingSize).toBe('100 г');
    expect(item.description).toContain('ВкусВилл');
    expect(item.tier).toBe('basic');
    expect(item.kcal).toBe(236);
    expect(item.fiber).toBe(0);
    expect(['other', 'protein']).toContain(item.category);
  });

  it('sanitizeRetailItems: режет мусор и дедуп по сети+имя', async () => {
    const e = await loadEngine();
    const out = e.sanitizeRetailItems([
      { id: 'a', source: 'vkusvill', name: 'Кефир 1%', kcal: 40, protein: 3, fat: 1, carbs: 4 },
      { id: 'b', source: 'vkusvill', name: 'кефир 1%', kcal: 40, protein: 3, fat: 1, carbs: 4 },
      { id: 'c', source: 'unknown_shop', name: 'X', kcal: 10, protein: 0, fat: 0, carbs: 0 },
      { id: 'd', source: 'magnit', name: '', kcal: 10, protein: 0, fat: 0, carbs: 0 },
      { id: 'e', source: 'pyaterochka', name: 'Нулевая позиция', kcal: 0, protein: 0, fat: 0, carbs: 0 },
      { id: 'f', source: 'magnit', name: 'Позиция NaN', kcal: 'abc', protein: -5, fat: 999, carbs: 0 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('Кефир 1%');
    expect(out[0].source).toBe('vkusvill');
  });

  it('sanitizeRetailItems: не-массив → пусто', async () => {
    const e = await loadEngine();
    expect(e.sanitizeRetailItems(null)).toEqual([]);
    expect(e.sanitizeRetailItems({})).toEqual([]);
  });

  it('searchRetailProducts без конфига Supabase: available=false, fetch не зовётся', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const e = await loadEngine('', '');
    const res = await e.searchRetailProducts('творог');
    expect(res.available).toBe(false);
    expect(res.items).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('короткий запрос: available=true без сети', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const e = await loadEngine('https://x.supabase.co', 'anon');
    const res = await e.searchRetailProducts('т');
    expect(res.available).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('успешный поиск → парсинг + кэш (второй вызов без fetch)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(FETCH_OK);
    vi.stubGlobal('fetch', fetchSpy);
    const e = await loadEngine('https://x.supabase.co', 'anon');
    const r1 = await e.searchRetailProducts('творог');
    expect(r1.available).toBe(true);
    expect(r1.items).toHaveLength(2);
    expect(r1.items[0].source).toBe('vkusvill');
    expect(r1.items[0].kcal).toBe(71);
    const r2 = await e.searchRetailProducts('Творог');
    expect(r2.items).toHaveLength(2);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('просроченный кэш (24ч) → повторный fetch', async () => {
    vi.useFakeTimers();
    try {
      const fetchSpy = vi.fn().mockResolvedValue(FETCH_OK);
      vi.stubGlobal('fetch', fetchSpy);
      const e = await loadEngine('https://x.supabase.co', 'anon');
      await e.searchRetailProducts('творог');
      const raw = JSON.parse(localStorage.getItem('he_retail_search_cache_v2')!);
      raw['творог'].ts -= 25 * 60 * 60 * 1000;
      localStorage.setItem('he_retail_search_cache_v2', JSON.stringify(raw));
      vi.advanceTimersByTime(25 * 60 * 60 * 1000);
      await e.searchRetailProducts('творог');
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('HTTP 500 → available=false, ответ не кэшируется', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: false } as Response);
    vi.stubGlobal('fetch', fetchSpy);
    const e = await loadEngine('https://x.supabase.co', 'anon');
    const r1 = await e.searchRetailProducts('хумус');
    expect(r1.available).toBe(false);
    const r2 = await e.searchRetailProducts('хумус');
    expect(r2.available).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem('he_retail_search_cache_v2')).toBeNull();
  });

  it('сетевой сбой → available=false', async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetchSpy);
    const e = await loadEngine('https://x.supabase.co', 'anon');
    const res = await e.searchRetailProducts('сыр');
    expect(res.available).toBe(false);
    expect(res.items).toEqual([]);
  });

  it('мусор в ответе функции фильтруется sanitize-слоем', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [{ source: 'vkusvill', name: 'NoKcal' }, { foo: 1 }, null] }),
    } as Response);
    vi.stubGlobal('fetch', fetchSpy);
    const e = await loadEngine('https://x.supabase.co', 'anon');
    const res = await e.searchRetailProducts('что-то');
    expect(res.available).toBe(true);
    expect(res.items).toEqual([]);
  });

  it('clearRetailCache удаляет ключ кэша', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(FETCH_OK);
    vi.stubGlobal('fetch', fetchSpy);
    const e = await loadEngine('https://x.supabase.co', 'anon');
    await e.searchRetailProducts('творог');
    expect(localStorage.getItem('he_retail_search_cache_v2')).not.toBeNull();
    e.clearRetailCache();
    expect(localStorage.getItem('he_retail_search_cache_v2')).toBeNull();
  });

  it('searchRetailProductByBarcode: без конфига → null, короткий код → null без сети', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const e0 = await loadEngine('', '');
    expect(await e0.searchRetailProductByBarcode('4600682180435')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    const e = await loadEngine('https://x.supabase.co', 'anon');
    expect(await e.searchRetailProductByBarcode('12345')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('searchRetailProductByBarcode: успех → товар + кэш; промах → null и кэш негативного ответа', async () => {
    const milk = {
      ok: true,
      json: async () => ({
        items: [{ id: '77', source: 'vkusvill', name: 'Молоко 3.2%', kcal: 60, protein: 2.9, fat: 3.2, carbs: 4.7 }],
        sources: ['vkusvill'],
      }),
    } as Response;
    const empty = { ok: true, json: async () => ({ items: [], sources: [] }) } as Response;
    const fetchSpy = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || '{}'));
      return body?.barcode === '4690228016928' ? empty : milk;
    });
    vi.stubGlobal('fetch', fetchSpy);
    const e = await loadEngine('https://x.supabase.co', 'anon');
    const hit = await e.searchRetailProductByBarcode('4600682180435');
    expect(hit).not.toBeNull();
    expect(hit!.name).toBe('Молоко 3.2%');
    const hit2 = await e.searchRetailProductByBarcode('4600682180435');
    expect(hit2!.kcal).toBe(60);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const miss = await e.searchRetailProductByBarcode('4690228016928');
    expect(miss).toBeNull();
    const miss2 = await e.searchRetailProductByBarcode('4690228016928');
    expect(miss2).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
