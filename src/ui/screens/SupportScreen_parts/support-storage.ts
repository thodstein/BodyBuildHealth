/**
 * support-storage.ts — безопасные чтения localStorage вкладки «БАДы».
 *
 * Классика крашей приложения: useState-инициализаторы и клик-хендлеры делают
 * JSON.parse(localStorage.getItem(key) || '[]') без проверки формы. Достаточно
 * скаляра/объекта от старой версии — и .map/.filter/.find/spread роняют рендер
 * (чёрный экран) или кнопку. Тот же класс, что чинился в планировщике
 * (planner-storage readJSONSafe + migratePlannerStorage).
 * Здесь — только чтение/запись с валидацией, миграций ключей нет.
 */

/** Прочитать массив; всё не-массив (скаляр, объект, битый JSON, null) → fallback. */
export function readSupportArr(key: string, fallback: unknown[] = []): unknown[] {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

/** Прочитать строковый массив (id избранного/стеков); мусорные элементы режутся. */
export function readSupportStrArr(key: string): string[] {
  const arr = readSupportArr(key);
  return arr.filter((x): x is string => typeof x === 'string');
}

/** Прочитать объект-словарь; всё не-объект → fallback. */
export function readSupportObj<T extends Record<string, unknown>>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Записать JSON; quota/private — молча false. */
export function writeSupportJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
