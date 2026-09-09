export interface DiaryMealItem {
  name: string;
  kcal: number;
  p: number;
  f: number;
  c: number;
  qty?: number;
  category?: string;
  foodId?: string;
  micros?: Record<string, number>;
}

export function aggregateDiaryMicros(day: DiaryDay | undefined): Record<string, number> {
  const totals: Record<string, number> = {};
  if (!day?.meals) return totals;
  Object.values(day.meals).forEach(items => items.forEach(item => {
    Object.entries(item.micros || {}).forEach(([key, value]) => {
      const numeric = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
      if (Number.isFinite(numeric)) totals[key] = (totals[key] || 0) + numeric;
    });
  }));
  return Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, Math.round(value * 100) / 100]));
}

export interface DiaryMeals {
  [mealType: string]: DiaryMealItem[];
}

export interface DiaryDay {
  meals: DiaryMeals;
}

export interface DiaryData {
  [dateISO: string]: DiaryDay;
}

const DIARY_KEY = 'nutrition_diary';

// --- Legacy v1 API ниже — мёртв: в проде и тестах используется только
// diary-storage-v2 (+типы и aggregateDiaryMicros из этого файла).
// Помечено @deprecated, тела не тронуты. Новому коду — только v2. ---

/** @deprecated Legacy v1-ключ. Используйте readDiaryV2 из diary-storage-v2. */
export function readDiary(): DiaryData {
  try {
    const raw = localStorage.getItem(DIARY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as DiaryData;
  } catch {
    return {};
  }
}

/** @deprecated Legacy v1-ключ. Используйте writeDiaryV2 из diary-storage-v2. */
export function writeDiary(data: DiaryData): void {
  try {
    localStorage.setItem(DIARY_KEY, JSON.stringify(data));
  } catch {
    // quota exceeded — silently drop
  }
}

/** @deprecated Legacy v1-ключ. Используйте getDayV2 из diary-storage-v2. */
export function getDay(dateISO: string): DiaryDay | undefined {
  return readDiary()[dateISO];
}

/** @deprecated Legacy v1. Пишите через writeDiaryV2 из diary-storage-v2. */
export function setDay(dateISO: string, day: DiaryDay): void {
  const data = readDiary();
  data[dateISO] = day;
  writeDiary(data);
}

/** @deprecated Legacy v1. Используйте deleteDayV2 из diary-storage-v2. */
export function deleteDay(dateISO: string): void {
  const data = readDiary();
  delete data[dateISO];
  writeDiary(data);
}

/** @deprecated Legacy v1. Используйте addMealEntryV2 из diary-storage-v2. */
export function addMealEntry(dateISO: string, mealType: string, item: DiaryMealItem): void {
  const data = readDiary();
  if (!data[dateISO]) data[dateISO] = { meals: {} };
  if (!data[dateISO].meals[mealType]) data[dateISO].meals[mealType] = [];
  data[dateISO].meals[mealType].push(item);
  writeDiary(data);
}

/** @deprecated Legacy v1-ключ. Используйте onDiaryChangeV2 из diary-storage-v2. */
export function onDiaryChange(callback: () => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key === DIARY_KEY) callback();
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}
