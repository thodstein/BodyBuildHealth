import { beforeEach, describe, expect, it, vi } from 'vitest';
import { optimizeStack, type StackInput } from '../supplement-optimizer.engine';
import {
  BIOSTACK_STACKS_KEY,
  LEGACY_SUPPORT_STACKS_KEY,
  LEGACY_FINDER_STACKS_KEY,
  LEGACY_BIOSTACK_STACKS_KEY,
  readBioStackStacks,
  writeBioStackStacks,
  type StoredBioStack,
} from '../biostack-storage';

const storage = (() => {
  let data: Record<string, string> = {};
  return {
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => { data[key] = value; },
    removeItem: (key: string) => { delete data[key]; },
    clear: () => { data = {}; },
  };
})();

vi.stubGlobal('localStorage', storage);

const baseInput = (): StackInput => ({
  compounds: [],
  riskLevels: {
    hepatic: 'low', renal: 'low', cardiac: 'low', lipids: 'low', bp: 'low',
    prostate: 'low', cns: 'low', blood: 'low', joints: 'low',
  },
  hasOrals: false, has19nor: false, hasTren: false, hasGH: false, hasInsulin: false,
  goal: 'maintenance',
});

describe('BioStack storage and parameterized optimizer', () => {
  beforeEach(() => storage.clear());

  it('migrates legacy savedStacks into the canonical key', () => {
    storage.setItem(LEGACY_SUPPORT_STACKS_KEY, JSON.stringify([
      { id: 'legacy-1', name: 'Старый стек', date: '2026-01-01', subs: ['nac'], dosages: {} },
    ]));

    const stacks = readBioStackStacks();
    expect(stacks).toHaveLength(1);
    expect(stacks[0].ids).toEqual(['nac']);
    expect(storage.getItem(BIOSTACK_STACKS_KEY)).toContain('legacy-1');
  });

  it('does not build a generic stack when no risk parameter is active', () => {
    const result = optimizeStack(baseInput());
    expect([...result.essential, ...result.recommended, ...result.optional]).toHaveLength(0);
  });

  it('limits candidates to active high-risk domains', () => {
    const input = baseInput();
    input.riskLevels.hepatic = 'high';
    input.riskLevels.cardiac = 'high';
    const result = optimizeStack(input);
    const selected = [...result.essential, ...result.recommended, ...result.optional];

    expect(selected.length).toBeGreaterThan(0);
    expect(selected.length).toBeLessThanOrEqual(5);
    expect(selected.every(item => item.id && item.name && item.reason && item.evidence)).toBe(true);
    expect(selected.every(item => item.category === 'liver' || item.category === 'heart' || item.category === 'general')).toBe(true);
  });

  it('does not recommend medicines or stimulant categories', () => {
    const input = baseInput();
    input.riskLevels.bp = 'high';
    input.riskLevels.cns = 'high';
    const result = optimizeStack(input);
    const selected = [...result.essential, ...result.recommended, ...result.optional];
    expect(selected.every(item => !/телмисартан|аспирин|кофеин|йохимбин/i.test(item.name))).toBe(true);
  });

  describe('storage lifecycle', () => {
    const mkStack = (id: string, ids: string[]): StoredBioStack => ({
      id, name: `Стек ${id}`, ids, subs: ids, profileSnapshot: null,
      createdAt: '2026-01-01T00:00:00.000Z', version: 2,
    });

    it('round-trips stacks through write/read', () => {
      writeBioStackStacks([mkStack('rt-1', ['nac', 'tudca'])]);
      const read = readBioStackStacks();
      expect(read).toHaveLength(1);
      expect(read[0].ids).toEqual(['nac', 'tudca']);
    });

    it('migrates legacy BioStack he_biostack_stacks and dedupes by id', () => {
      storage.setItem(LEGACY_BIOSTACK_STACKS_KEY, JSON.stringify([
        mkStack('dup-1', ['zinc']), mkStack('dup-1', ['zinc']),
      ]));
      const stacks = readBioStackStacks();
      expect(stacks).toHaveLength(1);
      expect(stacks[0].id).toBe('dup-1');
    });

    it('merges all three legacy sources and removes the biostack legacy key', () => {
      storage.setItem(LEGACY_SUPPORT_STACKS_KEY, JSON.stringify([mkStack('s-1', ['omega3'])]));
      storage.setItem(LEGACY_FINDER_STACKS_KEY, JSON.stringify([[ 'magnesium' ]]));
      storage.setItem(LEGACY_BIOSTACK_STACKS_KEY, JSON.stringify([mkStack('b-1', ['nac'])]));
      const stacks = readBioStackStacks();
      expect(stacks).toHaveLength(3);
      expect(stacks.flatMap(s => s.ids).sort()).toEqual(['magnesium', 'nac', 'omega3']);
      expect(storage.getItem(LEGACY_BIOSTACK_STACKS_KEY)).toBeNull();
    });

    it('preserves dosages and notes through normalisation', () => {
      writeBioStackStacks([{
        ...mkStack('meta-1', ['zinc']),
        dosages: { zinc: { mg: 25, timing: 'утро' } },
        notes: 'тестовая заметка',
      }]);
      const stacks = readBioStackStacks();
      expect(stacks[0].dosages?.zinc?.mg).toBe(25);
      expect(stacks[0].notes).toBe('тестовая заметка');
    });

    it('ignores malformed entries without crashing', () => {
      storage.setItem(LEGACY_SUPPORT_STACKS_KEY, JSON.stringify([
        { id: 'bad', subs: 'not-an-array' },
        null,
        42,
      ]));
      const stacks = readBioStackStacks();
      expect(stacks).toEqual([]);
    });
  });
});
