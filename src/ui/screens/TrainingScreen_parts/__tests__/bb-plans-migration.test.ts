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

  it('drops malformed variants without a valid weeks/sessions structure', () => {
    localStorage.setItem('he_bb_plans', JSON.stringify([
      { id: 'missing-plan', name: 'bad' },
      { id: 'bad-weeks', plan: { weeks: 'not-an-array' } },
      { id: 'valid', plan: { weeks: [{ week: 1, sessions: [] }], pattern: { name: 'Generic' } } },
    ]));
    const plans = loadSavedBBPlans();
    expect(plans).toHaveLength(1);
    expect(plans[0].id).toBe('valid');
  });

  it('sanitizes legacy parameter arrays and enum values', () => {
    localStorage.setItem('he_bb_plans', JSON.stringify([{
      id: 'legacy',
      plan: { weeks: [{ week: 1, sessions: [] }] },
      params: { peds: ['AAS', 42], weakPoints: ['chest', null], trainingFocus: 'invalid', methodology: 'invalid', planMode: 'invalid' },
    }]));
    const plan = loadSavedBBPlans()[0];
    expect(plan.params.peds).toEqual(['AAS']);
    expect(plan.params.weakPoints).toEqual(['chest']);
    expect(plan.params.trainingFocus).toBeUndefined();
    expect(plan.params.methodology).toBeUndefined();
    expect(plan.params.planMode).toBe('generic_split');
  });

  it('ignores removed athleteMode field (legacy values are dropped)', () => {
    localStorage.setItem('he_bb_plans', JSON.stringify([
      { id: 'legacy-mode', plan: { weeks: [{ week: 1, sessions: [] }] } },
      { id: 'female-mode', plan: { weeks: [{ week: 1, sessions: [] }] }, params: { athleteMode: 'female_context' } },
    ]));
    const plans = loadSavedBBPlans();
    expect((plans[0].params as any).athleteMode).toBeUndefined();
    expect((plans[1].params as any).athleteMode).toBeUndefined();
  });

  it('persists abPatternRotation flag, legacy without flag = off', () => {
    localStorage.setItem('he_bb_plans', JSON.stringify([
      { id: 'ab-on', plan: { weeks: [{ week: 1, sessions: [] }] }, params: { abPatternRotation: true } },
      { id: 'ab-off', plan: { weeks: [{ week: 1, sessions: [] }] }, params: { abPatternRotation: false } },
      { id: 'legacy-no-flag', plan: { weeks: [{ week: 1, sessions: [] }] }, params: {} },
    ]));
    const plans = loadSavedBBPlans();
    expect(plans.find(p => p.id === 'ab-on')?.params.abPatternRotation).toBe(true);
    // false нормализуется в undefined (дефолт выкл — байт-в-байт legacy)
    expect(plans.find(p => p.id === 'ab-off')?.params.abPatternRotation).toBeUndefined();
    expect(plans.find(p => p.id === 'legacy-no-flag')?.params.abPatternRotation).toBeUndefined();
  });

  it('persists packingV2 flag, legacy without flag = off', () => {
    localStorage.setItem('he_bb_plans', JSON.stringify([
      { id: 'pack-on', plan: { weeks: [{ week: 1, sessions: [] }] }, params: { packingV2: true } },
      { id: 'pack-off', plan: { weeks: [{ week: 1, sessions: [] }] }, params: { packingV2: false } },
      { id: 'legacy-no-flag', plan: { weeks: [{ week: 1, sessions: [] }] }, params: {} },
    ]));
    const plans = loadSavedBBPlans();
    expect(plans.find(p => p.id === 'pack-on')?.params.packingV2).toBe(true);
    expect(plans.find(p => p.id === 'pack-off')?.params.packingV2).toBeUndefined();
    expect(plans.find(p => p.id === 'legacy-no-flag')?.params.packingV2).toBeUndefined();
  });
});
