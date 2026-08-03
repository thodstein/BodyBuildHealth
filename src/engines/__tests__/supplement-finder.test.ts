import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  findSupplements,
  findReplacement,
  buildStack,
  explainStack,
  autoCompleteStack,
  getDefaultProfile,
  type FinderProfile,
  type FinderQuery,
  type StackQuery,
} from '../supplement-finder.engine';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    getAll: () => store,
  };
})();

vi.stubGlobal('localStorage', localStorageMock);

describe('supplement-finder.engine', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('getDefaultProfile', () => {
    it('should return a valid profile', () => {
      const profile = getDefaultProfile();
      expect(profile.age).toBe(30);
      expect(profile.weight).toBe(80);
      expect(profile.goals).toContain('muscle_gain');
    });
  });

  describe('findSupplements', () => {
    it('should return results for valid query', () => {
      const query: FinderQuery = {
        maxResults: 10,
      };
      const results = findSupplements(query);
      expect(results).toBeInstanceOf(Array);
    });

    it('should filter by goal when provided', () => {
      const query: FinderQuery = {
        goal: 'liver_health',
        maxResults: 10,
      };
      const results = findSupplements(query);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should return results with correct structure', () => {
      const query: FinderQuery = {
        goal: 'sleep',
        maxResults: 5,
      };
      const results = findSupplements(query);
      if (results.length > 0) {
        const r = results[0];
        expect(r).toHaveProperty('id');
        expect(r).toHaveProperty('name');
        expect(r).toHaveProperty('relevanceScore');
        expect(r).toHaveProperty('tier');
        expect(r).toHaveProperty('categories');
      }
    });
  });

  describe('findReplacement', () => {
    it('should return an array for valid substance', () => {
      const ids = findSupplements({ maxResults: 1 });
      if (ids.length > 0) {
        const replacements = findReplacement(ids[0].id, 'direct_analog');
        expect(replacements).toBeInstanceOf(Array);
      }
    });
  });

  describe('buildStack', () => {
    it('should build a stack with base IDs', () => {
      const query: StackQuery = {
        baseIds: [],
        targetSize: 5,
        autoFill: true,
        maxResults: 20,
      };
      const result = buildStack(query);
      expect(result.stack).toBeInstanceOf(Array);
      expect(result.explanation).toBeDefined();
    });
  });

  describe('explainStack', () => {
    it('should explain an empty stack', () => {
      const explanation = explainStack([]);
      expect(explanation.name).toBeDefined();
    });
  });

  describe('autoCompleteStack', () => {
    it('should return an array', () => {
      const result = autoCompleteStack([], 5);
      expect(result).toBeInstanceOf(Array);
    });
  });
});
