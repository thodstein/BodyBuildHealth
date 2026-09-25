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

  it('preserves all supported order methodologies and sanitizes intensity technique', () => {
    localStorage.setItem('he_bb_plans', JSON.stringify([
      ...['mountain_dog', 'fst7', 'hyperemia'].map((methodology, index) => ({
        id: methodology,
        plan: { weeks: [{ week: 1, sessions: [] }] },
        params: { methodology, intensityTechnique: index === 0 ? 'drop_set' : 'invalid' },
      })),
    ]));
    const plans = loadSavedBBPlans();
    expect(plans.map(plan => plan.params.methodology)).toEqual(['mountain_dog', 'fst7', 'hyperemia']);
    expect(plans.map(plan => plan.params.intensityTechnique)).toEqual(['drop_set', 'none', 'none']);
  });

  it('persists шаг 1-2 настройки (пресет/режим объёма/схема/особые режимы), дефолты → undefined', () => {
    localStorage.setItem('he_bb_plans', JSON.stringify([
      {
        id: 'cfg-on', plan: { weeks: [{ week: 1, sessions: [] }] }, params: {
          proPreset: 'fortitude', trainingVolumeMode: 'high', volumeScheme: 'fst7', supersetMode: 'giant',
          intensityLevel: 'high', rotationMode: 'forbid', calorieSurplus: 300, eccentricMult: 1.2,
          bfrMode: true, blastCruiseEnabled: true, blastWeeks: 6, cruiseWeeks: 3,
          platePreset: 'micro', targetBodyFat: 10, cycleDay: 14,
        },
      },
      {
        id: 'cfg-defaults', plan: { weeks: [{ week: 1, sessions: [] }] }, params: {
          proPreset: 'none', trainingVolumeMode: 'standard', volumeScheme: 'standard', supersetMode: 'none',
          intensityLevel: 'moderate', rotationMode: 'variety', calorieSurplus: 0, eccentricMult: 1,
          bfrMode: false, blastCruiseEnabled: false, blastWeeks: 8, cruiseWeeks: 4, platePreset: 'standard',
        },
      },
      { id: 'legacy', plan: { weeks: [{ week: 1, sessions: [] }] }, params: {} },
    ]));
    const plans = loadSavedBBPlans();
    const on = plans.find(p => p.id === 'cfg-on')!.params as any;
    expect(on.proPreset).toBe('fortitude');
    expect(on.trainingVolumeMode).toBe('high');
    expect(on.volumeScheme).toBe('fst7');
    expect(on.supersetMode).toBe('giant');
    expect(on.intensityLevel).toBe('high');
    expect(on.rotationMode).toBe('forbid');
    expect(on.calorieSurplus).toBe(300);
    expect(on.eccentricMult).toBe(1.2);
    expect(on.bfrMode).toBe(true);
    expect(on.blastCruiseEnabled).toBe(true);
    expect(on.blastWeeks).toBe(6);
    expect(on.cruiseWeeks).toBe(3);
    expect(on.platePreset).toBe('micro');
    expect(on.targetBodyFat).toBe(10);
    expect(on.cycleDay).toBe(14);
    const off = plans.find(p => p.id === 'cfg-defaults')!.params as any;
    for (const k of ['proPreset', 'trainingVolumeMode', 'volumeScheme', 'supersetMode', 'intensityLevel', 'rotationMode', 'calorieSurplus', 'eccentricMult', 'bfrMode', 'blastCruiseEnabled', 'blastWeeks', 'cruiseWeeks', 'platePreset', 'targetBodyFat', 'cycleDay']) {
      expect(off[k], k).toBeUndefined();
    }
    const legacy = plans.find(p => p.id === 'legacy')!.params as any;
    expect(legacy.proPreset).toBeUndefined();
    expect(legacy.trainingVolumeMode).toBeUndefined();
    expect(legacy.volumeScheme).toBeUndefined();
  });
});
