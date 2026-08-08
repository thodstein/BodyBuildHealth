/**
 * Tests for enhanced diary storage system (diary-storage-v2.ts)
 */

import {
  readDiaryV2,
  writeDiaryV2,
  addMealEntryV2,
  removeMealEntryV2,
  deleteDayV2,
  clearDiaryV2,
  exportDiaryJSON,
  importDiaryJSON,
  exportDiaryCSV,
  getStorageInfo,
  onDiaryChangeV2,
  StorageQuotaError,
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

describe('diary-storage-v2', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  const sampleItem: DiaryMealItem = {
    name: 'Chicken Breast',
    kcal: 165,
    p: 31,
    f: 3.6,
    c: 0,
    qty: 100,
    category: 'meat',
  };

  const sampleDay: DiaryDay = {
    meals: {
      'Завтрак': [sampleItem],
    },
  };

  describe('readDiaryV2 / writeDiaryV2', () => {
    it('should return empty object when no data stored', () => {
      const data = readDiaryV2();
      expect(data).toEqual({});
    });

    it('should write and read data correctly', () => {
      writeDiaryV2({ '2024-01-01': sampleDay });
      const data = readDiaryV2();
      expect(data['2024-01-01']).toBeDefined();
      expect(data['2024-01-01'].meals['Завтрак'][0].name).toBe('Chicken Breast');
    });

    it('should handle invalid JSON gracefully', () => {
      localStorageMock.setItem('nutrition_diary_v2', 'invalid json');
      const data = readDiaryV2();
      expect(data).toEqual({});
    });

    it('should handle invalid data format gracefully', () => {
      localStorageMock.setItem('nutrition_diary_v2', JSON.stringify({ not: 'valid' }));
      const data = readDiaryV2();
      expect(data).toEqual({});
    });

    it('should include version in stored data', () => {
      writeDiaryV2({ '2024-01-01': sampleDay });
      const raw = localStorageMock.getItem('nutrition_diary_v2');
      const parsed = JSON.parse(raw);
      expect(parsed.__version).toBe(2);
    });
  });

  describe('addMealEntryV2', () => {
    it('should add entry to existing day', () => {
      addMealEntryV2('2024-01-01', 'Обед', sampleItem);
      const day = readDiaryV2()['2024-01-01'];
      expect(day.meals['Обед']).toHaveLength(1);
      expect(day.meals['Обед'][0].name).toBe('Chicken Breast');
    });

    it('should create day if it does not exist', () => {
      addMealEntryV2('2024-01-02', 'Ужин', sampleItem);
      const day = readDiaryV2()['2024-01-02'];
      expect(day).toBeDefined();
      expect(day.meals['Ужин']).toHaveLength(1);
    });

    it('should throw on invalid meal item', () => {
      const invalidItem = { name: 'Test' } as DiaryMealItem; // missing required fields
      expect(() => addMealEntryV2('2024-01-01', 'Завтрак', invalidItem)).toThrow();
    });
  });

  describe('removeMealEntryV2', () => {
    it('should remove entry by index', () => {
      addMealEntryV2('2024-01-01', 'Завтрак', sampleItem);
      addMealEntryV2('2024-01-01', 'Завтрак', { ...sampleItem, name: 'Eggs' });
      removeMealEntryV2('2024-01-01', 'Завтрак', 0);
      const day = readDiaryV2()['2024-01-01'];
      expect(day.meals['Завтрак']).toHaveLength(1);
      expect(day.meals['Завтрак'][0].name).toBe('Eggs');
    });

    it('should remove meal type if empty after removal', () => {
      // Add two items, remove one - meal type should still exist
      addMealEntryV2('2024-01-01', 'Завтрак', sampleItem);
      addMealEntryV2('2024-01-01', 'Завтрак', { ...sampleItem, name: 'Eggs' });
      removeMealEntryV2('2024-01-01', 'Завтрак', 0);
      const day = readDiaryV2()['2024-01-01'];
      expect(day).toBeDefined();
      expect(day?.meals['Завтрак']).toHaveLength(1);
    });

    it('should remove day if no meals left', () => {
      addMealEntryV2('2024-01-01', 'Завтрак', sampleItem);
      removeMealEntryV2('2024-01-01', 'Завтрак', 0);
      const data = readDiaryV2();
      expect(data['2024-01-01']).toBeUndefined();
    });
  });

  describe('deleteDayV2', () => {
    it('should delete entire day', () => {
      addMealEntryV2('2024-01-01', 'Завтрак', sampleItem);
      deleteDayV2('2024-01-01');
      const data = readDiaryV2();
      expect(data['2024-01-01']).toBeUndefined();
    });
  });

  describe('exportDiaryJSON / importDiaryJSON', () => {
    it('should export data as JSON string', () => {
      writeDiaryV2({ '2024-01-01': sampleDay });
      const json = exportDiaryJSON();
      expect(() => JSON.parse(json)).not.toThrow();
      const parsed = JSON.parse(json);
      expect(parsed['2024-01-01']).toBeDefined();
    });

    it('should import valid JSON correctly', () => {
      const json = JSON.stringify({ '2024-02-01': sampleDay });
      const result = importDiaryJSON(json);
      expect(result.success).toBe(true);
      const data = readDiaryV2();
      expect(data['2024-02-01']).toBeDefined();
    });

    it('should reject invalid JSON', () => {
      const result = importDiaryJSON('invalid json');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject invalid data format', () => {
      const result = importDiaryJSON(JSON.stringify({ not: 'valid' }));
      expect(result.success).toBe(false);
    });

    it('should merge imported data with existing', () => {
      writeDiaryV2({ '2024-01-01': sampleDay });
      const newDay = { meals: { 'Ужин': [{ ...sampleItem, name: 'Fish' }] } };
      importDiaryJSON(JSON.stringify({ '2024-01-02': newDay }));
      const data = readDiaryV2();
      expect(data['2024-01-01']).toBeDefined();
      expect(data['2024-01-02']).toBeDefined();
    });

    it('should merge meals when importing an existing date', () => {
      writeDiaryV2({ '2024-01-01': sampleDay });
      importDiaryJSON(JSON.stringify({ '2024-01-01': { meals: { 'Ужин': [{ ...sampleItem, name: 'Fish' }] } } }));
      const day = readDiaryV2()['2024-01-01'];
      expect(day.meals['Завтрак']).toHaveLength(1);
      expect(day.meals['Ужин']).toHaveLength(1);
    });
  });

  describe('exportDiaryCSV', () => {
    it('should export data as CSV string', () => {
      writeDiaryV2({ '2024-01-01': sampleDay });
      const csv = exportDiaryCSV();
      expect(csv).toContain('Date,Meal,Food,Qty');
      expect(csv).toContain('Chicken Breast');
    });

    it('should handle empty diary', () => {
      const csv = exportDiaryCSV();
      expect(csv).toContain('Date,Meal,Food'); // header only
    });

    it('should quote commas and quotes in CSV fields', () => {
      writeDiaryV2({ '2024-01-01': { meals: { 'Обед, поздний': [{ ...sampleItem, name: 'Food "special"' }] } } });
      const csv = exportDiaryCSV();
      expect(csv).toContain('"2024-01-01","Обед, поздний","Food ""special"""');
    });
  });

  describe('same-tab change notifications', () => {
    it('notifies listeners after writes and clear', () => {
      const changes: unknown[] = [];
      const unsubscribe = onDiaryChangeV2(data => changes.push(data));
      writeDiaryV2({ '2024-01-01': sampleDay });
      clearDiaryV2();
      unsubscribe();
      expect(changes).toHaveLength(2);
      expect(changes[0]).toHaveProperty('2024-01-01');
      expect(changes[1]).toEqual({});
    });
  });

  describe('getStorageInfo', () => {
    it('should return correct storage info', () => {
      writeDiaryV2({ '2024-01-01': sampleDay, '2024-01-02': sampleDay });
      const info = getStorageInfo();
      expect(info.daysStored).toBe(2);
      expect(info.version).toBe(2);
      expect(info.estimatedSizeKB).toBeGreaterThan(0);
    });

    it('should return zero values for empty diary', () => {
      const info = getStorageInfo();
      expect(info.daysStored).toBe(0);
    });
  });

  describe('legacy migration', () => {
    it('should migrate from legacy nutrition_diary key', () => {
      localStorageMock.setItem('nutrition_diary', JSON.stringify({ '2023-01-01': sampleDay }));
      const data = readDiaryV2();
      expect(data['2023-01-01']).toBeDefined();
      expect(localStorageMock.getItem('nutrition_diary')).toBeNull(); // legacy removed
    });

    it('should migrate from legacy he_food_log key', () => {
      localStorageMock.setItem('he_food_log', JSON.stringify({ '2023-02-01': sampleDay }));
      const data = readDiaryV2();
      expect(data['2023-02-01']).toBeDefined();
      expect(localStorageMock.getItem('he_food_log')).toBeNull();
    });
  });

  describe('quota error handling', () => {
    it('should throw StorageQuotaError on quota exceeded', () => {
      const hugeData = { 'test': { meals: { 'test': new Array(100000).fill(sampleItem) } } };
      // Mock localStorage to throw QuotaExceededError
      const originalSetItem = localStorageMock.setItem;
      localStorageMock.setItem = () => {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      };
      
      expect(() => writeDiaryV2(hugeData)).toThrow(StorageQuotaError);
      
      localStorageMock.setItem = originalSetItem;
    });
  });
});
