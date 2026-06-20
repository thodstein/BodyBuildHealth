interface CacheEntry<T> { value: T; timestamp: number; ttl: number; }
const cache = new Map<string, CacheEntry<any>>();

export function memoize<T extends (...args: any[]) => any>(fn: T, ttlMs: number = 300000): T {
  return ((...args: any[]) => {
    const key = JSON.stringify(args);
    const entry = cache.get(key);
    if (entry && Date.now() - entry.timestamp < entry.ttl) return entry.value;
    const result = fn(...args);
    cache.set(key, { value: result, timestamp: Date.now(), ttl: ttlMs });
    return result;
  }) as T;
}

export function clearCache(pattern?: string) {
  if (!pattern) { cache.clear(); return; }
  for (const key of cache.keys()) { if (key.includes(pattern)) cache.delete(key); }
}

export function terminateWorkers(workers: Worker[]) {
  workers.forEach(w => { try { w.terminate(); } catch {} });
}

export async function optimizeDBSpace(db: any, maxSizeMB: number = 50) {
  try {
    const usage = await navigator.storage.estimate();
    const usedMB = (usage.usage || 0) / 1024 / 1024;
    if (usedMB > maxSizeMB) {
      // Удаляем логи старше 90 дней
      const stores = await db.getAll('labs_log') || [];
      const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
      const toDelete = stores.filter((l: any) => new Date(l.date).getTime() < cutoff);
      for (const item of toDelete) await db.delete('labs_log', item.id);
    }
  } catch {}
}