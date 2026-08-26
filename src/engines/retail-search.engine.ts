export type RetailChainId = 'vkusvill' | 'pyaterochka' | 'magnit';

export interface RetailProduct {
  id: string;
  source: RetailChainId;
  name: string;
  brand?: string;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  weight?: string;
}

export interface RetailSearchOutcome {
  items: RetailProduct[];
  available: boolean;
}

export const RETAIL_CHAINS: Record<RetailChainId, { label: string; emoji: string; color: string }> = {
  vkusvill: { label: 'ВкусВилл', emoji: '🥗', color: '#22c55e' },
  pyaterochka: { label: 'Пятёрочка', emoji: '🔴', color: '#ef4444' },
  magnit: { label: 'Магнит', emoji: '⭕', color: '#f59e0b' },
};

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const CACHE_KEY = 'he_retail_search_cache_v2';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_QUERIES = 40;

interface CacheEntry {
  ts: number;
  items: RetailProduct[];
}

function enabled(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON);
}

export function normalizeRetailQuery(raw: string): string {
  return (raw || '').toLowerCase().replace(/ё/g, 'е').trim().replace(/\s+/g, ' ');
}

function readCache(): Record<string, CacheEntry> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeCache(map: Record<string, CacheEntry>): void {
  try {
    const keys = Object.keys(map);
    if (keys.length > CACHE_MAX_QUERIES) {
      keys.sort((a, b) => (map[a]?.ts || 0) - (map[b]?.ts || 0));
      for (const k of keys.slice(0, keys.length - CACHE_MAX_QUERIES)) delete map[k];
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(map));
  } catch {}
}

export function clearRetailCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {}
}

function isValidChain(v: any): v is RetailChainId {
  return v === 'vkusvill' || v === 'pyaterochka' || v === 'magnit';
}

function num10(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : 0;
}

export function sanitizeRetailItems(raw: any): RetailProduct[] {
  if (!Array.isArray(raw)) return [];
  const out: RetailProduct[] = [];
  const seen = new Set<string>();
  for (const it of raw) {
    if (!it || typeof it.name !== 'string' || !it.name.trim()) continue;
    if (!isValidChain(it?.source)) continue;
    const kcal = num10(it.kcal);
    if (kcal <= 0) continue;
    const key = `${it.source}:${it.name.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: String(it.id ?? ''),
      source: it.source,
      name: it.name.trim(),
      brand: typeof it.brand === 'string' && it.brand.trim() ? it.brand.trim() : undefined,
      kcal,
      protein: num10(it.protein),
      fat: num10(it.fat),
      carbs: num10(it.carbs),
      weight: typeof it.weight === 'string' && it.weight.trim() ? it.weight.trim() : undefined,
    });
  }
  return out;
}

export async function searchRetailProducts(query: string, limit = 9): Promise<RetailSearchOutcome> {
  const q = normalizeRetailQuery(query);
  if (q.length < 2) return { items: [], available: true };
  if (!enabled()) return { items: [], available: false };

  const cache = readCache();
  const hit = cache[q];
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) {
    return { items: hit.items.slice(0, limit), available: true };
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/retail-search`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: q, limit }),
      signal: AbortSignal.timeout(12000),
    } as RequestInit);
    if (!res.ok) return { items: [], available: false };
    const data = await res.json();
    const items = sanitizeRetailItems(data?.items);
    cache[q] = { ts: Date.now(), items };
    writeCache(cache);
    return { items: items.slice(0, limit), available: true };
  } catch {
    return { items: [], available: false };
  }
}

export async function searchRetailProductByBarcode(barcode: string): Promise<RetailProduct | null> {
  const bc = (barcode || '').replace(/\D/g, '');
  if (bc.length < 8 || !enabled()) return null;

  const cache = readCache();
  const cacheKey = `bc:${bc}`;
  const hit = cache[cacheKey];
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.items[0] || null;

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/retail-search`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ barcode: bc }),
      signal: AbortSignal.timeout(12000),
    } as RequestInit);
    if (!res.ok) return null;
    const data = await res.json();
    const items = sanitizeRetailItems(data?.items);
    cache[cacheKey] = { ts: Date.now(), items };
    writeCache(cache);
    return items[0] || null;
  } catch {
    return null;
  }
}

const CATEGORY_HINTS: Array<[string, RegExp]> = [
  ['protein', /мяс|куриц|курин|индейк|говяд|свинин|баранин|рыб|лосос|горбуш|тун|креветк|кальмар|минта|сельд|скумбр|яйц|омлет|колбас|ветчин|сосиск|фарш|шашлык/i],
  ['dairy', /молок|кефир|ряженк|йогурт|творог|сыр|сливк|сметан|айран|снежок|простокваш|варенец|моцарелла|фет[ау]|пармезан/i],
  ['grain', /крупа|овсян|геркулес|перловк|пшенн?ая|булгур|киноа|чечевиц|горох|нут|фасол|müsl|мюсл|отруб/i],
  ['carb', /хлеб|батон|лаваш|багет|макарон|спагетти|вермишел|лапш|картофел|пюре|рис\b|греч[ак]|кускус/i],
  ['fat', /масло (подсолнечн|оливков|кукурузн|льнян|сливочн)|оливковое масло|майонез|арахисовая паста|урбеч|миндаль|кешью|грецк|семечк|семен льна|чиа/i],
  ['fast_food', /чипс|шоколад|конфет|печенье|торт|пирож|мороженое|сникер|снек|сухарик|попкорн|газирован|кола|лимонад|энергетик|сок|нектар|хлопь[я]*/i],
  ['veg_fruit', /огурц|помидор|томат|перец|кабач|баклаж|яблок|банан|апельсин|мандарин|грейпфрут|виноград|салат|зелень|капуст|морков|свекл|авокадо|ягода|малин|черник|клубник|смородин|овощ|фрукт|смузи|грибы|шампиньон/i],
  ['supplement', /протеин|bcaa|аминокислот|креатин|витамин|омега-?[03]|добавк/i],
];

export function guessRetailCategory(name: string): string {
  const n = (name || '').toLowerCase();
  if (/чипс|снек|сухарик|попкорн/.test(n)) return 'fast_food';
  for (const [cat, re] of CATEGORY_HINTS) if (re.test(n)) return cat;
  return 'other';
}

export function retailToFoodItem(p: RetailProduct): {
  id: string; name: string; category: string;
  kcal: number; protein: number; fat: number; carbs: number;
  fiber: number; gi: number; servingSize: string; description: string; tier: 'basic';
} {
  const meta = RETAIL_CHAINS[p.source];
  return {
    id: `retail:${p.source}:${p.id || p.name}`,
    name: p.name,
    category: guessRetailCategory(p.name),
    kcal: p.kcal,
    protein: p.protein,
    fat: p.fat,
    carbs: p.carbs,
    fiber: 0,
    gi: 0,
    servingSize: '100 г',
    description: [meta.label, p.brand, p.weight].filter(Boolean).join(' • '),
    tier: 'basic',
  };
}
