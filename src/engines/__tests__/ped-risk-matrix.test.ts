import { describe, it, expect } from 'vitest';
import { assessPedRisk, describePedRisk, type PedRisk } from '../ped-risk-matrix';
import type { PEDDose } from '../../data/ped-potency-table';

function ped(id: string, mgPerWeek: number, form: 'oral' | 'inject' = 'inject'): PEDDose {
  return { id, pClass: undefined as any, mgPerWeek, form };
}
function ghPed(iuPerDay: number): PEDDose {
  return { id: 'somatropin', pClass: 'gh', iuPerDay, form: 'subq' };
}

describe('ped-risk-matrix: AAS дозозависимость', () => {
  it('тренболон <300 мг → moderate neuro', () => {
    const r = assessPedRisk([ped('trenbolone_acetate', 200)], 'medium');
    expect(r.neuroRisk).toBe('moderate');
    expect(r.neuroBoosterTier).toBe(2);
  });
  it('тренболон 500 мг → high neuro, tier 3', () => {
    const r = assessPedRisk([ped('trenbolone_acetate', 500)], 'medium');
    expect(r.neuroRisk).toBe('high');
    expect(r.neuroBoosterTier).toBe(3);
  });
  it('тренболон 800 мг → high neuro, tier 3', () => {
    const r = assessPedRisk([ped('trenbolone_enan', 800)], 'medium');
    expect(r.neuroRisk).toBe('high');
    expect(r.neuroBoosterTier).toBe(3);
  });
  it('станозолол <210 мг/нед → moderate joints', () => {
    const r = assessPedRisk([ped('stanozolol_oral', 140, 'oral')], 'medium');
    expect(r.jointsRisk).toBe('moderate');
    expect(r.jointsBoosterTier).toBe(2);
  });
  it('станозолол ≥210 мг/нед → high joints, tier 3', () => {
    const r = assessPedRisk([ped('stanozolol_oral', 350, 'oral')], 'medium');
    expect(r.jointsRisk).toBe('high');
    expect(r.jointsBoosterTier).toBe(3);
  });
  it('нандролон <400 мг → protective joints, tier 0', () => {
    const r = assessPedRisk([ped('nandrolone_decanoate', 300)], 'medium');
    expect(r.jointsRisk).toBe('protective');
    expect(r.jointsBoosterTier).toBe(0);
  });
  it('нандролон ≥400 мг → moderate neuro + protective joints', () => {
    const r = assessPedRisk([ped('nandrolone_decanoate', 500)], 'medium');
    expect(r.neuroRisk).toBe('moderate');
    expect(r.jointsRisk).toBe('protective');
    expect(r.neuroBoosterTier).toBe(2);
    expect(r.jointsBoosterTier).toBe(0);
  });
  it('тестостерон 250 мг → low neuro, tier 0', () => {
    const r = assessPedRisk([ped('test_enan', 250)], 'medium');
    expect(r.neuroRisk).toBe('low');
    expect(r.neuroBoosterTier).toBe(0);
  });
  it('тестостерон 750 мг → moderate neuro, tier 2', () => {
    const r = assessPedRisk([ped('test_enan', 750)], 'medium');
    expect(r.neuroRisk).toBe('moderate');
    expect(r.neuroBoosterTier).toBe(2);
  });
  it('halotestin → moderate neuro + moderate joints (люая доза)', () => {
    const r = assessPedRisk([ped('halotestin', 100, 'oral')], 'medium');
    expect(r.neuroRisk).toBe('moderate');
    expect(r.jointsRisk).toBe('moderate');
  });
  it('superdrol <140 мг/нед → moderate neuro', () => {
    // 10 мг/день → normalizeDose ×7 = 70 мг/нед → <140 → moderate
    const r = assessPedRisk([ped('superdrol', 10, 'oral')], 'medium');
    expect(r.neuroRisk).toBe('moderate');
  });
  it('superdrol ≥140 мг/нед → high neuro', () => {
    // 30 мг/день → normalizeDose ×7 = 210 мг/нед → >140 → high
    const r = assessPedRisk([ped('superdrol', 30, 'oral')], 'medium');
    expect(r.neuroRisk).toBe('high');
  });
  it('mibolerone → high neuro + moderate joints', () => {
    const r = assessPedRisk([ped('mibolerone', 50, 'oral')], 'medium');
    expect(r.neuroRisk).toBe('high');
    expect(r.jointsRisk).toBe('moderate');
  });
});

describe('ped-risk-matrix: SARMs', () => {
  it('RAD-140 → moderate neuro', () => {
    const r = assessPedRisk([{ id: 'rad140', pClass: 'sarm' }], 'medium');
    expect(r.neuroRisk).toBe('moderate');
  });
  it('S-23 → moderate neuro', () => {
    const r = assessPedRisk([{ id: 's23', pClass: 'sarm' }], 'medium');
    expect(r.neuroRisk).toBe('moderate');
  });
  it('ostarine → low neuro + protective joints', () => {
    const r = assessPedRisk([{ id: 'ostarine', pClass: 'sarm' }], 'medium');
    expect(r.neuroRisk).toBe('low');
    expect(r.jointsRisk).toBe('protective');
  });
  it('LGD → low neuro', () => {
    const r = assessPedRisk([{ id: 'lgd', pClass: 'sarm' }], 'medium');
    expect(r.neuroRisk).toBe('low');
  });
});

describe('ped-risk-matrix: пептиды / GH', () => {
  it('GH 3 IU → moderate joints', () => {
    const r = assessPedRisk([ghPed(3)], 'medium');
    expect(r.jointsRisk).toBe('moderate');
    expect(r.jointsBoosterTier).toBe(2);
  });
  it('GH 6 IU → high joints', () => {
    const r = assessPedRisk([ghPed(6)], 'medium');
    expect(r.jointsRisk).toBe('high');
    expect(r.jointsBoosterTier).toBe(3);
  });
  it('GH 10 IU → moderate neuro + high joints', () => {
    const r = assessPedRisk([ghPed(10)], 'medium');
    expect(r.neuroRisk).toBe('moderate');
    expect(r.jointsRisk).toBe('high');
  });
  it('IGF-1 → low neuro + moderate joints', () => {
    const r = assessPedRisk([{ id: 'igf1_lr3', pClass: 'igf', mcgPerDay: 50 }], 'medium');
    expect(r.neuroRisk).toBe('low');
    expect(r.jointsRisk).toBe('moderate');
  });
  it('GHRP → moderate neuro + moderate joints', () => {
    const r = assessPedRisk([{ id: 'ghrp6', pClass: 'other' }], 'medium');
    expect(r.neuroRisk).toBe('moderate');
    expect(r.jointsRisk).toBe('moderate');
  });
  it('MK-677 → low neuro + moderate joints', () => {
    const r = assessPedRisk([{ id: 'mk677', pClass: 'other' }], 'medium');
    expect(r.neuroRisk).toBe('low');
    expect(r.jointsRisk).toBe('moderate');
  });
});

describe('ped-risk-matrix: компенсации', () => {
  it('станозолол + нандролон → joints moderate (частичная компенсация)', () => {
    const r = assessPedRisk([
      ped('stanozolol_oral', 350, 'oral'),
      ped('nandrolone_decanoate', 300),
    ], 'medium');
    expect(r.jointsRisk).toBe('moderate');
    expect(r.triggeredBy.some(t => t.includes('компенс'))).toBe(true);
  });
  it('нандролон соло → joints tier 0 (protective)', () => {
    const r = assessPedRisk([ped('nandrolone_decanoate', 300)], 'medium');
    expect(r.jointsBoosterTier).toBe(0);
  });
});

describe('ped-risk-matrix: эскалации', () => {
  it('2 moderate neuro PED → high', () => {
    const r = assessPedRisk([
      ped('nandrolone_decanoate', 500), // moderate neuro
      { id: 'ghrp6', pClass: 'other' }, // moderate neuro
    ], 'medium');
    expect(r.neuroRisk).toBe('high');
  });
  it('трен + нандролон (2× 19-нор) → high neuro', () => {
    const r = assessPedRisk([
      ped('trenbolone_acetate', 200), // moderate (19-нор)
      ped('nandrolone_decanoate', 300), // low neuro (19-нор)
    ], 'medium');
    expect(r.neuroRisk).toBe('high');
  });
  it('3+ PED → эскалация +1 уровень', () => {
    const r = assessPedRisk([
      ped('test_enan', 250),   // low neuro
      ped('anavar', 50, 'oral'), // low neuro
      { id: 'ostarine', pClass: 'sarm' }, // low neuro
    ], 'medium');
    expect(r.neuroRisk).toBe('moderate'); // low → moderate (эскалация)
  });
});

describe('ped-risk-matrix: tier mapping', () => {
  it('high neuro на base → tier 3', () => {
    const r = assessPedRisk([ped('trenbolone_acetate', 500)], 'base');
    expect(r.neuroBoosterTier).toBe(3);
  });
  it('low neuro на base → tier 0', () => {
    const r = assessPedRisk([ped('test_enan', 250)], 'base');
    expect(r.neuroBoosterTier).toBe(0);
  });
  it('low neuro на max → tier 1 (force)', () => {
    const r = assessPedRisk([ped('test_enan', 250)], 'max');
    expect(r.neuroBoosterTier).toBe(1);
  });
  it('none neuro на max → tier 1 (force)', () => {
    const r = assessPedRisk([], 'max');
    expect(r.neuroBoosterTier).toBe(1);
  });
  it('protective joints на max → tier 0', () => {
    const r = assessPedRisk([ped('nandrolone_decanoate', 300)], 'max');
    expect(r.jointsBoosterTier).toBe(0);
  });
});

describe('ped-risk-matrix: ID-маппинг (edge cases)', () => {
  it('trestolone (classifyPed=other) → корректно moderate/high по substring', () => {
    const r = assessPedRisk([ped('trestolone', 200)], 'medium');
    expect(r.neuroRisk).toBe('moderate');
  });
  it('trestolone 400 мг → high по substring', () => {
    const r = assessPedRisk([ped('trestolone', 400)], 'medium');
    expect(r.neuroRisk).toBe('high');
  });
  it('proviron → none/none (не триггерит бустеры)', () => {
    const r = assessPedRisk([ped('proviron', 50, 'oral')], 'medium');
    expect(r.neuroRisk).toBe('none');
    expect(r.jointsRisk).toBe('none');
    expect(r.neuroBoosterTier).toBe(0);
    expect(r.jointsBoosterTier).toBe(0);
  });
  it('описание для UI', () => {
    const r = assessPedRisk([ped('trenbolone_acetate', 500)], 'medium');
    const d = describePedRisk(r);
    expect(d.neuro).toContain('высокий');
  });
});
