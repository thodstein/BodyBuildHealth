/**
 * planner-storage.ts — безопасная обёртка над localStorage для планировщика.
 *
 * Проблема: 36 ключей без схемы, всё обёрнуто в try/catch{} (тихая потеря данных),
 * архив отчётов и monthPlan могут переполнить квоту 5 МБ. При QuotaExceededError
 * запись молча проваливается — юзер не знает, что состояние не сохранилось.
 *
 * Решение: safeWriteJSON ловит квоту, пытается очистить архив отчётов и повторить,
 * при неудаче возвращает false (caller может показать уведомление).
 */

const REPORT_ARCHIVE_KEY = 'he_nutrition_report_archive';

export function safeWriteJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e: any) {
    const quota = e && (e.name === 'QuotaExceededError' || (e.code === 22) || (e.code === 1014));
    if (!quota) return false;
    // Prune the report archive (most volatile, least critical) and retry once.
    try {
      const arch = JSON.parse(localStorage.getItem(REPORT_ARCHIVE_KEY) || '[]');
      if (Array.isArray(arch) && arch.length > 5) {
        localStorage.setItem(REPORT_ARCHIVE_KEY, JSON.stringify(arch.slice(0, 5)));
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      }
    } catch {}
    // Last resort: drop the archive entirely.
    try { localStorage.removeItem(REPORT_ARCHIVE_KEY); localStorage.setItem(key, JSON.stringify(value)); return true; } catch {}
    return false;
  }
}

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}