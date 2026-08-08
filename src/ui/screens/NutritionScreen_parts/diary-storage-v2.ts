/**
 * Enhanced nutrition diary storage system with:
 * - Data validation
 * - Migration support
 * - Quota error handling
 * - Type safety
 * - Unified storage (replaces dual nutrition_diary / he_food_log)
 */

import { DiaryMealItem, DiaryDay, DiaryData } from './diary-storage';

// Version tracking for migrations
const STORAGE_VERSION = 2;
const DIARY_KEY = 'nutrition_diary_v2';
const LEGACY_KEYS = ['nutrition_diary', 'he_food_log'];
const diaryListeners = new Set<(data: DiaryData) => void>();

// Validation helpers
function isValidMealItem(item: unknown): item is DiaryMealItem {
  if (typeof item !== 'object' || item === null) return false;
  const m = item as Record<string, unknown>;
  return (
    typeof m['name'] === 'string' &&
    typeof m['kcal'] === 'number' &&
    typeof m['p'] === 'number' &&
    typeof m['f'] === 'number' &&
    typeof m['c'] === 'number' &&
    Number.isFinite(m['kcal'] as number) && Number.isFinite(m['p'] as number) &&
    Number.isFinite(m['f'] as number) && Number.isFinite(m['c'] as number)
  );
}

function isValidDay(day: unknown): day is DiaryDay {
  if (typeof day !== 'object' || day === null) return false;
  const d = day as Record<string, unknown>;
  if (typeof d['meals'] !== 'object' || d['meals'] === null) return false;
  const meals = d['meals'] as Record<string, unknown>;
  return Object.values(meals).every((items: unknown) =>
    Array.isArray(items) && items.every(isValidMealItem)
  );
}

function isValidData(data: unknown): data is DiaryData {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return false;
  return Object.entries(data).every(
    ([date, day]) =>
      typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/) && isValidDay(day)
  );
}

// Migration functions
function migrateV1ToV2(data: DiaryData): DiaryData {
  // V1 → V2: normalize micros, ensure qty is number
  const migrated: DiaryData = {};
  for (const [date, day] of Object.entries(data)) {
    const newMeals: Record<string, DiaryMealItem[]> = {};
    for (const [mealType, items] of Object.entries(day.meals || {})) {
      newMeals[mealType] = items.map((item) => ({
        ...item,
        qty: typeof item.qty === 'string' ? Number(item.qty) || 100 : item.qty || 100,
        micros: item.micros || {},
      }));
    }
    migrated[date] = { meals: newMeals };
  }
  return migrated;
}

function runMigrations(data: DiaryData, fromVersion: number): DiaryData {
  let result = data;
  if (fromVersion < 2) result = migrateV1ToV2(result);
  return result;
}

// Storage error handling
export class StorageQuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageQuotaError';
  }
}

export class StorageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageValidationError';
  }
}

// Main storage API
export function readDiaryV2(): DiaryData {
  try {
    const raw = localStorage.getItem(DIARY_KEY);
    if (!raw) return migrateFromLegacy();
    
    const parsed = JSON.parse(raw);
    const version = typeof parsed?.__version === 'number' ? parsed.__version : 1;
    const { __version: _version, ...dataWithoutVersion } = parsed;

    if (!isValidData(dataWithoutVersion)) {
      console.warn('[DiaryStorage] Invalid data format, resetting');
      localStorage.removeItem(DIARY_KEY);
      return migrateFromLegacy();
    }
    
    const migrated = runMigrations(dataWithoutVersion, version);
    if (version < STORAGE_VERSION) writeDiaryV2(migrated);
    return migrated;
  } catch (e) {
    console.error('[DiaryStorage] Read error:', e);
    return {};
  }
}

export function writeDiaryV2(data: DiaryData): void {
  try {
    const payload = JSON.stringify({ ...data, __version: STORAGE_VERSION });
    localStorage.setItem(DIARY_KEY, payload);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      // Try to free space: remove oldest entries beyond 90 days
      const trimmed = trimOldEntries(data, 90);
      try {
        localStorage.setItem(DIARY_KEY, JSON.stringify({ ...trimmed, __version: STORAGE_VERSION }));
        console.warn('[DiaryStorage] Quota exceeded, trimmed to 90 days');
      } catch {
        throw new StorageQuotaError('LocalStorage quota exceeded. Please export your data and clear old entries.');
      }
    } else {
      throw e;
    }
  }
  diaryListeners.forEach(listener => {
    try { listener(data); } catch (error) { console.error('[DiaryStorage] Listener error:', error); }
  });
}

function trimOldEntries(data: DiaryData, keepDays: number): DiaryData {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - keepDays);
  const result: DiaryData = {};
  for (const [date, day] of Object.entries(data)) {
    if (new Date(date) >= cutoff) result[date] = day;
  }
  return result;
}

// Migrate from legacy storage systems
function migrateFromLegacy(): DiaryData {
  for (const key of LEGACY_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (isValidData(parsed)) {
        console.log(`[DiaryStorage] Migrated data from ${key}`);
        localStorage.removeItem(key); // Remove legacy data
        writeDiaryV2(parsed);
        return parsed;
      }
    } catch {
      // Ignore parse errors for legacy data
    }
  }
  return {};
}

// CRUD operations with validation
export function getDayV2(dateISO: string): DiaryDay | undefined {
  const data = readDiaryV2();
  return data[dateISO];
}

export function setDayV2(dateISO: string, day: DiaryDay): void {
  if (!isValidDay(day)) throw new StorageValidationError('Invalid day format');
  const data = readDiaryV2();
  data[dateISO] = day;
  writeDiaryV2(data);
}

export function addMealEntryV2(dateISO: string, mealType: string, item: DiaryMealItem): void {
  if (!isValidMealItem(item)) throw new StorageValidationError('Invalid meal item');
  const data = readDiaryV2();
  if (!data[dateISO]) data[dateISO] = { meals: {} };
  if (!data[dateISO].meals[mealType]) data[dateISO].meals[mealType] = [];
  data[dateISO].meals[mealType].push(item);
  writeDiaryV2(data);
}

export function removeMealEntryV2(dateISO: string, mealType: string, index: number): void {
  const data = readDiaryV2();
  if (!data[dateISO]?.meals[mealType]) return;
  if (!Number.isInteger(index) || index < 0 || index >= data[dateISO].meals[mealType].length) return;
  data[dateISO].meals[mealType].splice(index, 1);
  if (data[dateISO].meals[mealType].length === 0) delete data[dateISO].meals[mealType];
  if (Object.keys(data[dateISO].meals).length === 0) delete data[dateISO];
  writeDiaryV2(data);
}

export function deleteDayV2(dateISO: string): void {
  const data = readDiaryV2();
  delete data[dateISO];
  writeDiaryV2(data);
}

export function clearDiaryV2(): void {
  localStorage.removeItem(DIARY_KEY);
  diaryListeners.forEach(listener => {
    try { listener({}); } catch (error) { console.error('[DiaryStorage] Listener error:', error); }
  });
}

// Export/Import
export function exportDiaryJSON(): string {
  const data = readDiaryV2();
  return JSON.stringify(data, null, 2);
}

export function importDiaryJSON(json: string): { success: boolean; error?: string } {
  try {
    const parsed = JSON.parse(json);
    if (!isValidData(parsed)) return { success: false, error: 'Invalid data format' };
    const data = readDiaryV2();
    const merged: DiaryData = { ...data };
    for (const [date, incomingDay] of Object.entries(parsed as DiaryData)) {
      const existing = merged[date];
      if (!existing) {
        merged[date] = incomingDay;
        continue;
      }
      merged[date] = {
        meals: { ...existing.meals },
      };
      for (const [meal, items] of Object.entries(incomingDay.meals)) {
        merged[date].meals[meal] = [
          ...(merged[date].meals[meal] || []),
          ...items,
        ];
      }
    }
    writeDiaryV2(merged);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Parse error' };
  }
}

export function exportDiaryCSV(): string {
  const data = readDiaryV2();
  const csv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const rows: string[] = ['Date,Meal,Food,Qty (g),Kcal,Protein (g),Fat (g),Carbs (g)'];
  for (const [date, day] of Object.entries(data)) {
    for (const [meal, items] of Object.entries(day.meals)) {
      for (const item of items) {
        rows.push([date, meal, item.name, item.qty || 100, item.kcal, item.p, item.f, item.c].map(csv).join(','));
      }
    }
  }
  return rows.join('\n');
}

// Storage event listener
export function onDiaryChangeV2(callback: (data: DiaryData) => void): () => void {
  diaryListeners.add(callback);
  const handler = (e: StorageEvent) => {
    if (e.key === DIARY_KEY) {
      try {
        const data = readDiaryV2();
        callback(data);
      } catch {
        // Ignore read errors
      }
    }
  };
  window.addEventListener('storage', handler);
  return () => {
    diaryListeners.delete(callback);
    window.removeEventListener('storage', handler);
  };
}

// Get storage info
export function getStorageInfo(): { daysStored: number; estimatedSizeKB: number; version: number } {
  const data = readDiaryV2();
  const json = JSON.stringify(data);
  return {
    daysStored: Object.keys(data).length,
    estimatedSizeKB: new Blob([json]).size / 1024,
    version: STORAGE_VERSION,
  };
}

// Re-export types for compatibility
export type { DiaryMealItem, DiaryDay, DiaryData } from './diary-storage';
