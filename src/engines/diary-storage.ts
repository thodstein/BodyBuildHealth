/**
 * diary-storage.ts — единый слой доступа к localStorage дневников.
 * Единственная точка нормализации: безопасный JSON.parse, защита от не-массивов,
 * кап записей (по умолчанию 365 новейших), устойчивость к quota.
 * Используется ProfileDiariesTab, diary-modals (readDiaryEntries) и новыми дневниками.
 */

export const DEFAULT_DIARY_CAP = 365;

/** Безопасное чтение массива записей из localStorage. */
export function readDiaryEntries<T>(key: string): T[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}

/** Чтение любого JSON с fallback (для не-массивов, напр. объекты настроек). */
export function readJSONSafe<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === '') return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Безопасная запись массива записей: валидные элементы, кап N новейших по дате
 * (устойчив к любому порядку входа — как ASC от quick-add, так и DESC от страниц).
 * Возвращает true при успехе, false при quota-ошибке.
 */
export function saveDiaryEntries<T>(key: string, entries: T[], cap = DEFAULT_DIARY_CAP): boolean {
  try {
    const arr = Array.isArray(entries) ? entries : [];
    const trimmed = capEntriesByDate(arr, cap);
    localStorage.setItem(key, JSON.stringify(trimmed));
    return true;
  } catch {
    try {
      // Quota: жёсткий кап по дате — только элементы с корректной датой.
      const hardCut = capEntriesByDate(Array.isArray(entries) ? entries : [], 90);
      localStorage.setItem(key, JSON.stringify(hardCut));
      return true;
    } catch {
      return false;
    }
  }
}

/** Оставляет N новейших по полю date; элементы без date — в конец. */
export function capEntriesByDate<T>(entries: T[], cap: number): T[] {
  const withDates = entries
    .filter((e): e is T & { date: string } => !!e && typeof (e as { date?: unknown }).date === 'string')
    .sort((a, b) => b.date.localeCompare(a.date));
  const withoutDates = entries.filter((e) => !e || typeof (e as { date?: unknown }).date !== 'string');
  return [...withDates.slice(0, cap), ...withoutDates];
}

/** Удаление ключа дневника. */
export function removeDiaryKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {}
}

/** Полный размер (байт) значения localStorage — для контроля фото. */
export function diaryStorageBytes(key: string): number {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return 0;
    return new Blob([raw]).size;
  } catch {
    return 0;
  }
}

/** Суммарный размер всех переданных ключей (для мониторинга quota). */
export function diaryStorageTotalBytes(keys: string[]): number {
  return keys.reduce((sum, k) => sum + diaryStorageBytes(k), 0);
}
