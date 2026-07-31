import { describe, expect, it } from 'vitest';
import { loadSavedBBPlans } from '../bb-plans-store';

const storage = new Map<string, string>();
(globalThis as any).localStorage = { setItem: (key: string, value: string) => storage.set(key, value), getItem: (key: string) => storage.get(key) || null };

describe('Saved BB plan legacy migration', () => {
  it('provides safe defaults for old variants', () => {
    localStorage.setItem('he_bb_plans', JSON.stringify([{ id: 'old', name: 'old', plan: { weeks: [{ week: 1 }], pattern: { name: 'Generic' } } }]));
    const plans = loadSavedBBPlans();
    expect(plans[0].params.loadStrategy).toBe('double_progression');
    expect(plans[0].metrics.mrvMult).toBe(1);
    expect(plans[0].params.weeks).toBe(1);
  });
});
