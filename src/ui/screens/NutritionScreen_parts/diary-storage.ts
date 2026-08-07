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

export function writeDiary(data: DiaryData): void {
  try {
    localStorage.setItem(DIARY_KEY, JSON.stringify(data));
  } catch {
    // quota exceeded — silently drop
  }
}

export function getDay(dateISO: string): DiaryDay | undefined {
  return readDiary()[dateISO];
}

export function setDay(dateISO: string, day: DiaryDay): void {
  const data = readDiary();
  data[dateISO] = day;
  writeDiary(data);
}

export function deleteDay(dateISO: string): void {
  const data = readDiary();
  delete data[dateISO];
  writeDiary(data);
}

export function addMealEntry(dateISO: string, mealType: string, item: DiaryMealItem): void {
  const data = readDiary();
  if (!data[dateISO]) data[dateISO] = { meals: {} };
  if (!data[dateISO].meals[mealType]) data[dateISO].meals[mealType] = [];
  data[dateISO].meals[mealType].push(item);
  writeDiary(data);
}

export function onDiaryChange(callback: () => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key === DIARY_KEY) callback();
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}
