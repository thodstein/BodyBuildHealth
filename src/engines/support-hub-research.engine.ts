/**
 * support-hub-research.engine.ts — P8: тестируемый кэш PubMed-поиска.
 * Калькулятор поддержки не тронут. Чистые функции, storage инжектится
 * (в проде — localStorage, в тестах — мок). Поведение канона:
 * TTL 24 ч, кап 30 запросов, в кэше до 50 статей на запрос, ключ lowercased.
 */

export interface PubmedCacheRecord {
  at: number;
  results: unknown[];
}

export type PubmedCache = Record<string, PubmedCacheRecord>;

export interface MiniStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const PUBMED_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const PUBMED_CACHE_CAP = 30;
export const PUBMED_CACHE_PER_QUERY = 50;

export function readPubmedCache(storage: MiniStorage, cacheKey: string): PubmedCache {
  try {
    const raw = storage.getItem(cacheKey);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as PubmedCache;
  } catch {
    return {};
  }
}

/** Возвращает закэшированные результаты или null (мимо/протух/битый). */
export function getCachedPubmed(
  storage: MiniStorage,
  cacheKey: string,
  query: string,
  now: number = Date.now(),
  ttlMs: number = PUBMED_CACHE_TTL_MS,
): unknown[] | null {
  const q = (query || '').trim().toLowerCase();
  if (!q) return null;
  const hit = readPubmedCache(storage, cacheKey)[q];
  if (!hit || !Array.isArray(hit.results)) return null;
  if (typeof hit.at !== 'number' || now - hit.at >= ttlMs) return null;
  return hit.results;
}

/**
 * Кладёт результаты в кэш (LRU по времени: старые сверх капа дропаются).
 * Возвращает false только если storage упал (quota/private) — молча, без исключений.
 */
export function writePubmedCache(
  storage: MiniStorage,
  cacheKey: string,
  query: string,
  results: unknown[],
  now: number = Date.now(),
  cap: number = PUBMED_CACHE_CAP,
  perQuery: number = PUBMED_CACHE_PER_QUERY,
): boolean {
  const q = (query || '').trim().toLowerCase();
  if (!q || !Array.isArray(results) || results.length === 0) return false;
  try {
    const cache = readPubmedCache(storage, cacheKey);
    cache[q] = { at: now, results: results.slice(0, perQuery) };
    const keys = Object.keys(cache);
    if (keys.length > cap) {
      keys.sort((a, b) => (cache[a]?.at || 0) - (cache[b]?.at || 0));
      for (const k of keys.slice(0, keys.length - cap)) delete cache[k];
    }
    storage.setItem(cacheKey, JSON.stringify(cache));
    return true;
  } catch {
    return false;
  }
}
