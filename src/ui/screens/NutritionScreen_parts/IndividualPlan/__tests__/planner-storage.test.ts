import { describe, it, expect, beforeEach, vi } from 'vitest';

// Minimal localStorage polyfill for Node test environment
const memStore: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((k: string) => (k in memStore ? memStore[k] : null)),
  setItem: vi.fn((k: string, v: string) => { memStore[k] = String(v); }),
  removeItem: vi.fn((k: string) => { delete memStore[k]; }),
  clear: vi.fn(() => { Object.keys(memStore).forEach(k => delete memStore[k]); }),
  key: vi.fn((i: number) => Object.keys(memStore)[i] ?? null),
  get length() { return Object.keys(memStore).length; },
};
(globalThis as any).localStorage = localStorageMock;

import { readJSONSafe, migratePlannerStorage, PLANNER_SCHEMA_VERSION } from '../planner-storage';

describe('planner-storage — defensive localStorage', () => {
  beforeEach(() => {
    Object.keys(memStore).forEach(k => delete memStore[k]);
    vi.clearAllMocks();
  });

  it('readJSONSafe: returns fallback for missing key', () => {
    expect(readJSONSafe('he_test', [1, 2, 3], Array.isArray)).toEqual([1, 2, 3]);
  });

  it('readJSONSafe: returns fallback for invalid JSON', () => {
    memStore['he_test'] = 'not-json{';
    expect(readJSONSafe('he_test', ['fallback'], Array.isArray)).toEqual(['fallback']);
  });

  it('readJSONSafe: returns fallback for wrong shape (object instead of array)', () => {
    memStore['he_test'] = JSON.stringify({ a: 1 });
    expect(readJSONSafe('he_test', ['fallback'], Array.isArray)).toEqual(['fallback']);
  });

  it('readJSONSafe: returns parsed value when shape matches', () => {
    memStore['he_test'] = JSON.stringify(['a', 'b']);
    expect(readJSONSafe('he_test', [], Array.isArray)).toEqual(['a', 'b']);
  });

  it('migratePlannerStorage: drops non-object localStorage entries that should be arrays', () => {
    memStore['he_excluded_foods'] = '"not an array"';
    memStore['he_saved_nutrition_plans'] = '12345';
    memStore['he_preferred_foods'] = '["chicken","rice"]';
    migratePlannerStorage();
    expect(memStore['he_excluded_foods']).toBeUndefined();
    expect(memStore['he_saved_nutrition_plans']).toBeUndefined();
    expect(memStore['he_preferred_foods']).toBe('["chicken","rice"]');
    expect(memStore['he_planner_schema_version']).toBe(String(PLANNER_SCHEMA_VERSION));
  });

  it('migratePlannerStorage: is idempotent (no-op after first run)', () => {
    memStore['he_excluded_foods'] = '"bad"';
    migratePlannerStorage();
    expect(memStore['he_planner_schema_version']).toBe(String(PLANNER_SCHEMA_VERSION));
    memStore['he_saved_nutrition_plans'] = JSON.stringify([{ id: 1 }]);
    migratePlannerStorage();
    expect(memStore['he_saved_nutrition_plans']).toBe(JSON.stringify([{ id: 1 }]));
  });
});
