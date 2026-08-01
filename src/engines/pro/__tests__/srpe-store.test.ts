import { beforeEach, describe, expect, it } from 'vitest';
import { clearSRPESessions, loadSRPESessions, saveSRPESession } from '../srpe-store';

const storage = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
  clear: () => storage.clear(),
};

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, configurable: true });

describe('srpe-store', () => {
  beforeEach(() => localStorage.clear());
  it('saves and loads sessions', () => {
    saveSRPESession({ date: '2026-08-01', sRPE: 8, durationMin: 60 });
    expect(loadSRPESessions()).toEqual([{ date: '2026-08-01', sRPE: 8, durationMin: 60 }]);
  });
  it('keeps only the last 200 sessions', () => {
    for (let i = 0; i < 205; i++) saveSRPESession({ date: `2026-08-${String(i + 1).padStart(2, '0')}`, sRPE: 7, durationMin: 60 });
    expect(loadSRPESessions()).toHaveLength(200);
  });
  it('clears sessions', () => {
    saveSRPESession({ date: '2026-08-01', sRPE: 8, durationMin: 60 });
    clearSRPESessions();
    expect(loadSRPESessions()).toEqual([]);
  });
});
