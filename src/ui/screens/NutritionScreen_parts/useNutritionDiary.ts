/**
 * Custom hook for nutrition diary state management.
 * Centralizes all diary logic with React state, localStorage sync, and error handling.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  readDiaryV2,
  writeDiaryV2,
  addMealEntryV2,
  removeMealEntryV2,
  deleteDayV2,
  getDayV2,
  exportDiaryJSON,
  importDiaryJSON,
  exportDiaryCSV,
  getStorageInfo,
  clearDiaryV2,
  type DiaryDay,
  type DiaryMealItem,
  type DiaryData,
  StorageQuotaError,
} from './diary-storage-v2';

export interface UseNutritionDiaryOptions {
  initialDate?: string; // ISO date string
  autoSave?: boolean; // default: true
}

export interface UseNutritionDiaryReturn {
  // State
  diary: DiaryData;
  currentDate: string;
  currentDay: DiaryDay | undefined;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setCurrentDate: (date: string) => void;
  addEntry: (mealType: string, item: DiaryMealItem) => void;
  removeEntry: (mealType: string, index: number) => void;
  updateEntry: (mealType: string, index: number, item: DiaryMealItem) => void;
  clearDay: () => void;
  clearAll: () => void;
  
  // Import/Export
  exportJSON: () => string;
  importJSON: (json: string) => { success: boolean; error?: string };
  exportCSV: () => string;
  
  // Info
  getStorageInfo: () => { daysStored: number; estimatedSizeKB: number; version: number };
  recalculateDay: () => void;
}

export function useNutritionDiary(options: UseNutritionDiaryOptions = {}): UseNutritionDiaryReturn {
  const { initialDate = new Date().toISOString().split('T')[0], autoSave = true } = options;
  
  const [diary, setDiary] = useState<DiaryData>(() => readDiaryV2());
  const [currentDate, setCurrentDate] = useState(initialDate);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Sync from localStorage on mount and storage events
  useEffect(() => {
    const loadData = () => setDiary(readDiaryV2());
    loadData();
    
    const handler = (e: StorageEvent) => {
      if (e.key === 'nutrition_diary_v2') loadData();
    };
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('storage', handler);
    };
  }, []);
  
  // Derived state
  const currentDay = diary[currentDate];
  
  // Diary writes are synchronous so callers can immediately read the updated data.
  const saveDiary = useCallback((data: DiaryData) => {
    if (!autoSave) return;
    try {
      writeDiaryV2(data);
      setError(null);
    } catch (e) {
      if (e instanceof StorageQuotaError) {
        setError('Хранилище переполнено. Данные старше 90 дней будут удалены автоматически.');
      } else {
        setError('Ошибка сохранения дневника');
      }
    }
  }, [autoSave]);
  
  // Actions
  const addEntry = useCallback((mealType: string, item: DiaryMealItem) => {
    setError(null);
    setDiary((prev) => {
      const next = { ...prev };
      if (!next[currentDate]) next[currentDate] = { meals: {} };
      if (!next[currentDate].meals[mealType]) next[currentDate].meals[mealType] = [];
      next[currentDate].meals[mealType] = [...next[currentDate].meals[mealType], item];
      saveDiary(next);
      return next;
    });
  }, [currentDate, saveDiary]);
  
  const removeEntry = useCallback((mealType: string, index: number) => {
    setError(null);
    setDiary((prev) => {
      const next = { ...prev };
      if (!next[currentDate]?.meals[mealType]) return prev;
      next[currentDate] = { ...next[currentDate] };
      next[currentDate].meals = { ...next[currentDate].meals };
      next[currentDate].meals[mealType] = [...next[currentDate].meals[mealType]];
      next[currentDate].meals[mealType].splice(index, 1);
      if (next[currentDate].meals[mealType].length === 0) {
        delete next[currentDate].meals[mealType];
      }
      if (Object.keys(next[currentDate].meals).length === 0) {
        delete next[currentDate];
      }
      saveDiary(next);
      return next;
    });
  }, [currentDate, saveDiary]);
  
  const updateEntry = useCallback((mealType: string, index: number, item: DiaryMealItem) => {
    setError(null);
    setDiary((prev) => {
      const next = { ...prev };
      if (!next[currentDate]?.meals[mealType]?.[index]) return prev;
      next[currentDate] = { ...next[currentDate] };
      next[currentDate].meals = { ...next[currentDate].meals };
      next[currentDate].meals[mealType] = [...next[currentDate].meals[mealType]];
      next[currentDate].meals[mealType][index] = item;
      saveDiary(next);
      return next;
    });
  }, [currentDate, saveDiary]);
  
  const clearDay = useCallback(() => {
    setError(null);
    setDiary((prev) => {
      const next = { ...prev };
      delete next[currentDate];
      saveDiary(next);
      return next;
    });
  }, [currentDate, saveDiary]);
  
  const clearAll = useCallback(() => {
    setError(null);
    setDiary({});
    try {
      clearDiaryV2();
    } catch {
      setError('Ошибка очистки дневника');
    }
  }, []);
  
  const recalculateDay = useCallback(() => {
    // Force re-read from localStorage (useful after external changes)
    setDiary(readDiaryV2());
  }, []);
  
  return {
    diary,
    currentDate,
    currentDay,
    isLoading,
    error,
    setCurrentDate,
    addEntry,
    removeEntry,
    updateEntry,
    clearDay,
    clearAll,
    exportJSON: () => {
      setError(null);
      try {
        return exportDiaryJSON();
      } catch {
        setError('Ошибка экспорта');
        return '';
      }
    },
    importJSON: (json: string) => {
      setError(null);
      const result = importDiaryJSON(json);
      if (result.success) setDiary(readDiaryV2());
      else setError(result.error || 'Ошибка импорта');
      return result;
    },
    exportCSV: () => {
      setError(null);
      try {
        return exportDiaryCSV();
      } catch {
        setError('Ошибка экспорта CSV');
        return '';
      }
    },
    getStorageInfo: () => {
      try {
        return getStorageInfo();
      } catch {
        return { daysStored: 0, estimatedSizeKB: 0, version: 0 };
      }
    },
    recalculateDay,
  };
}

// Helper hook for frequently used foods
export function useFrequentFoods(diary: DiaryData, topN: number = 10): DiaryMealItem[] {
  return useMemo(() => {
    const counts = new Map<string, { item: DiaryMealItem; count: number }>();
    for (const day of Object.values(diary)) {
      for (const items of Object.values(day.meals)) {
        for (const item of items) {
          const key = item.name;
          const existing = counts.get(key);
          if (existing) {
            existing.count++;
          } else {
            counts.set(key, { item, count: 1 });
          }
        }
      }
    }
    
    const sorted = Array.from(counts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, topN)
      .map((entry) => entry.item);
    
    return sorted;
  }, [diary, topN]);
}

// Helper hook for daily totals
export function useDailyTotals(day: DiaryDay | undefined): { kcal: number; p: number; f: number; c: number; items: number } {
  return useMemo(() => {
    if (!day?.meals) return { kcal: 0, p: 0, f: 0, c: 0, items: 0 };
    
    let kcal = 0, p = 0, f = 0, c = 0, items = 0;
    for (const mealItems of Object.values(day.meals)) {
      for (const item of mealItems) {
        kcal += item.kcal || 0;
        p += item.p || 0;
        f += item.f || 0;
        c += item.c || 0;
        items++;
      }
    }
    
    return { kcal: Math.round(kcal), p: Math.round(p), f: Math.round(f), c: Math.round(c), items };
  }, [day]);
}
