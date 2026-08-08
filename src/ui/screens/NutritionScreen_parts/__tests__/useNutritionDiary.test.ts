/**
 * Tests for useNutritionDiary hook
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import * as storage from '../diary-storage-v2';
import { useNutritionDiary, useFrequentFoods, useDailyTotals } from '../useNutritionDiary';
import {
  writeDiaryV2,
  clearDiaryV2,
  type DiaryMealItem,
  type DiaryDay,
} from '../diary-storage-v2';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('useNutritionDiary', () => {
  beforeEach(() => {
    localStorageMock.clear();
    clearDiaryV2();
  });

  const sampleItem: DiaryMealItem = {
    name: 'Chicken Breast',
    kcal: 165,
    p: 31,
    f: 3.6,
    c: 0,
    qty: 100,
  };

  describe('initialization', () => {
    it('should initialize with current date as default', () => {
      const { result } = renderHook(() => useNutritionDiary());
      const today = new Date().toISOString().split('T')[0];
      expect(result.current.currentDate).toBe(today);
    });

    it('should initialize with provided date', () => {
      const { result } = renderHook(() => useNutritionDiary({ initialDate: '2024-01-01' }));
      expect(result.current.currentDate).toBe('2024-01-01');
    });

    it('should load existing diary data on mount', () => {
      writeDiaryV2({
        '2024-01-01': { meals: { 'Завтрак': [sampleItem] } },
      });
      const { result } = renderHook(() => useNutritionDiary({ initialDate: '2024-01-01' }));
      expect(result.current.currentDay).toBeDefined();
      expect(result.current.currentDay?.meals['Завтрак']).toHaveLength(1);
    });
  });

  describe('date navigation', () => {
    it('should change current date', () => {
      const { result } = renderHook(() => useNutritionDiary());
      act(() => {
        result.current.setCurrentDate('2024-02-15');
      });
      expect(result.current.currentDate).toBe('2024-02-15');
    });

    it('should update currentDay when date changes', () => {
      writeDiaryV2({
        '2024-01-01': { meals: { 'Завтрак': [sampleItem] } },
        '2024-01-02': { meals: { 'Обед': [{ ...sampleItem, name: 'Fish' }] } },
      });
      
      const { result } = renderHook(() => useNutritionDiary({ initialDate: '2024-01-01' }));
      expect(result.current.currentDay?.meals['Завтрак']).toBeDefined();
      
      act(() => {
        result.current.setCurrentDate('2024-01-02');
      });
      
      expect(result.current.currentDay?.meals['Обед']).toBeDefined();
    });
  });

  describe('addEntry', () => {
    it('should add meal entry to current date', () => {
      const { result } = renderHook(() => useNutritionDiary({ initialDate: '2024-01-01' }));
      
      act(() => {
        result.current.addEntry('Завтрак', sampleItem);
      });
      
      expect(result.current.currentDay?.meals['Завтрак']).toHaveLength(1);
      expect(result.current.currentDay?.meals['Завтрак'][0].name).toBe('Chicken Breast');
    });

    it('should add multiple entries to same meal type', () => {
      const { result } = renderHook(() => useNutritionDiary({ initialDate: '2024-01-01' }));
      
      act(() => {
        result.current.addEntry('Завтрак', sampleItem);
        result.current.addEntry('Завтрак', { ...sampleItem, name: 'Eggs' });
      });
      
      expect(result.current.currentDay?.meals['Завтрак']).toHaveLength(2);
    });

    it('should persist data to localStorage', () => {
      const { result } = renderHook(() => useNutritionDiary({ initialDate: '2024-01-01' }));
      
      act(() => {
        result.current.addEntry('Завтрак', sampleItem);
      });
      
      const stored = JSON.parse(localStorageMock.getItem('nutrition_diary_v2') || '{}');
      expect(stored['2024-01-01']).toBeDefined();
    });
  });

  describe('removeEntry', () => {
    it('should remove entry by index', () => {
      const { result } = renderHook(() => useNutritionDiary({ initialDate: '2024-01-01' }));
      
      act(() => {
        result.current.addEntry('Завтрак', sampleItem);
        result.current.addEntry('Завтрак', { ...sampleItem, name: 'Eggs' });
      });
      
      act(() => {
        result.current.removeEntry('Завтрак', 0);
      });
      
      expect(result.current.currentDay?.meals['Завтрак']).toHaveLength(1);
      expect(result.current.currentDay?.meals['Завтрак'][0].name).toBe('Eggs');
    });

    it('should remove meal type if empty after removal', () => {
      const { result } = renderHook(() => useNutritionDiary({ initialDate: '2024-01-01' }));
      
      act(() => {
        result.current.addEntry('Завтрак', sampleItem);
      });
      
      act(() => {
        result.current.removeEntry('Завтрак', 0);
      });
      
      expect(result.current.currentDay?.meals['Завтрак']).toBeUndefined();
    });
  });

  describe('updateEntry', () => {
    it('should update existing entry', () => {
      const { result } = renderHook(() => useNutritionDiary({ initialDate: '2024-01-01' }));
      
      act(() => {
        result.current.addEntry('Завтрак', sampleItem);
      });
      
      act(() => {
        result.current.updateEntry('Завтрак', 0, { ...sampleItem, name: 'Turkey', kcal: 150 });
      });
      
      expect(result.current.currentDay?.meals['Завтрак'][0].name).toBe('Turkey');
      expect(result.current.currentDay?.meals['Завтрак'][0].kcal).toBe(150);
    });
  });

  describe('portion recalculation', () => {
    it('keeps repeated quantity changes proportional to the original portion', () => {
      const { result } = renderHook(() => useNutritionDiary({ initialDate: '2024-01-01' }));
      act(() => {
        result.current.addEntry('Завтрак', { ...sampleItem, qty: 200, kcal: 330, p: 62, f: 7.2 });
      });
      act(() => {
        result.current.updateEntry('Завтрак', 0, { ...result.current.currentDay!.meals['Завтрак'][0], qty: 100, kcal: 165, p: 31, f: 3.6 });
      });
      expect(result.current.currentDay?.meals['Завтрак'][0].kcal).toBe(165);
      expect(result.current.currentDay?.meals['Завтрак'][0].p).toBe(31);
    });
  });

  describe('clearDay / clearAll', () => {
    it('should clear current day', () => {
      const { result } = renderHook(() => useNutritionDiary({ initialDate: '2024-01-01' }));
      
      act(() => {
        result.current.addEntry('Завтрак', sampleItem);
      });
      
      act(() => {
        result.current.clearDay();
      });
      
      expect(result.current.currentDay).toBeUndefined();
    });

    it('should clear all data', () => {
      const { result } = renderHook(() => useNutritionDiary({ initialDate: '2024-01-01' }));
      
      act(() => {
        result.current.addEntry('Завтрак', sampleItem);
        result.current.setCurrentDate('2024-01-02');
        result.current.addEntry('Обед', sampleItem);
      });
      
      act(() => {
        result.current.clearAll();
      });
      
      expect(result.current.diary).toEqual({});
      expect(localStorageMock.getItem('nutrition_diary_v2')).toBeNull();
    });
  });

  describe('import/export', () => {
    it('should export JSON', () => {
      const { result } = renderHook(() => useNutritionDiary({ initialDate: '2024-01-01' }));
      
      act(() => {
        result.current.addEntry('Завтрак', sampleItem);
      });
      
      const json = result.current.exportJSON();
      expect(() => JSON.parse(json)).not.toThrow();
      const parsed = JSON.parse(json);
      expect(parsed['2024-01-01']).toBeDefined();
    });

    it('should import JSON successfully', () => {
      const { result } = renderHook(() => useNutritionDiary({ initialDate: '2024-01-01' }));
      
      const newData = JSON.stringify({
        '2024-02-01': { meals: { 'Ужин': [{ ...sampleItem, name: 'Fish' }] } },
      });
      
      let importResult: { success: boolean; error?: string };
      act(() => {
        importResult = result.current.importJSON(newData);
      });
      expect(importResult.success).toBe(true);
      expect(result.current.diary['2024-02-01']).toBeDefined();
    });

    it('should handle import error', () => {
      const { result } = renderHook(() => useNutritionDiary());
      const importResult = result.current.importJSON('invalid json');
      expect(importResult.success).toBe(false);
      expect(result.current.error).toBeDefined();
    });

    it('should export CSV', () => {
      const { result } = renderHook(() => useNutritionDiary({ initialDate: '2024-01-01' }));
      
      act(() => {
        result.current.addEntry('Завтрак', sampleItem);
      });
      
      const csv = result.current.exportCSV();
      expect(csv).toContain('Chicken Breast');
      expect(csv).toContain('Date,Meal,Food');
    });
  });

  describe('error handling', () => {
    it('should set error on storage failure', () => {
      // Mock writeDiaryV2 to throw
      vi.spyOn(storage, 'writeDiaryV2').mockImplementation(() => {
        throw new Error('Storage error');
      });
      
      const { result } = renderHook(() => useNutritionDiary({ initialDate: '2024-01-01' }));
      
      act(() => {
        result.current.addEntry('Завтрак', sampleItem);
      });
      
      expect(result.current.error).toBeDefined();
      
      vi.restoreAllMocks();
    });
  });

  describe('recalculateDay', () => {
    it('should reload data from localStorage', () => {
      const { result } = renderHook(() => useNutritionDiary({ initialDate: '2024-01-01' }));
      
      // Simulate external change
      writeDiaryV2({
        '2024-01-01': { meals: { 'Завтрак': [{ ...sampleItem, name: 'External Change' }] } },
      });
      
      act(() => {
        result.current.recalculateDay();
      });
      
      expect(result.current.currentDay?.meals['Завтрак'][0].name).toBe('External Change');
    });
  });
});

describe('useFrequentFoods', () => {
  beforeEach(() => {
    localStorageMock.clear();
    clearDiaryV2();
  });

  const sampleItem: DiaryMealItem = {
    name: 'Chicken Breast',
    kcal: 165,
    p: 31,
    f: 3.6,
    c: 0,
    qty: 100,
  };

  it('should return most frequent foods', () => {
    writeDiaryV2({
      '2024-01-01': {
        meals: {
          'Завтрак': [sampleItem, { ...sampleItem, name: 'Eggs' }],
        },
      },
      '2024-01-02': {
        meals: {
          'Обед': [sampleItem, sampleItem, { ...sampleItem, name: 'Fish' }],
        },
      },
    });
    
    const { result } = renderHook(() => {
      const diary = useNutritionDiary().diary;
      return useFrequentFoods(diary, 2);
    });
    
    // Chicken appears 3 times, Eggs 1 time, Fish 1 time
    expect(result.current).toHaveLength(2);
    expect(result.current[0].name).toBe('Chicken Breast');
  });

  it('should limit results to topN', () => {
    const { result } = renderHook(() => useFrequentFoods({}, 5));
    expect(result.current).toHaveLength(0);
  });
});

describe('useDailyTotals', () => {
  const sampleDay: DiaryDay = {
    meals: {
      'Завтрак': [
        { name: 'Eggs', kcal: 150, p: 12, f: 10, c: 1, qty: 100 },
      ],
      'Обед': [
        { name: 'Chicken', kcal: 200, p: 35, f: 5, c: 0, qty: 150 },
        { name: 'Rice', kcal: 130, p: 3, f: 1, c: 28, qty: 100 },
      ],
    },
  };

  it('should calculate daily totals correctly', () => {
    const { result } = renderHook(() => useDailyTotals(sampleDay));
    
    expect(result.current.kcal).toBe(480); // 150 + 200 + 130
    expect(result.current.p).toBe(50); // 12 + 35 + 3
    expect(result.current.f).toBe(16); // 10 + 5 + 1
    expect(result.current.c).toBe(29); // 1 + 0 + 28
    expect(result.current.items).toBe(3);
  });

  it('should return zeros for undefined day', () => {
    const { result } = renderHook(() => useDailyTotals(undefined));
    
    expect(result.current.kcal).toBe(0);
    expect(result.current.items).toBe(0);
  });

  it('should update when day changes', () => {
    const { result, rerender } = renderHook(
      ({ day }) => useDailyTotals(day),
      { initialProps: { day: undefined as DiaryDay | undefined } }
    );
    
    expect(result.current.kcal).toBe(0);
    
    rerender({ day: sampleDay });
    
    expect(result.current.kcal).toBe(480);
  });
});
