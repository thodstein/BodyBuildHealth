import { describe, expect, it } from 'vitest';
import { loadUserPrograms } from '../program-store';

const storage = new Map<string, string>();
(globalThis as any).localStorage = { setItem: (key: string, value: string) => storage.set(key, value), getItem: (key: string) => storage.get(key) || null };

describe('BB UserProgram legacy migration', () => {
  it('normalizes old BB weeks and missing body fields', () => {
    localStorage.setItem('he_user_programs', JSON.stringify([{ meta: { id: 'old', direction: 'bb' }, bb: { weeks: [{ week: 1, sessions: null }] } }]));
    const programs = loadUserPrograms();
    expect(programs[0].bb?.weeks[0].phase).toBe('accumulation');
    expect(programs[0].bb?.weeks[0].deload).toBe(false);
    expect(programs[0].bb?.weeks[0].sessions).toEqual([]);
    expect(programs[0].bb?.progression.loadStrategy).toBe('double_progression');
  });
});
