import { describe, expect, it } from 'vitest';
import { calculateSupportTZ } from '../engine';
import { runSupportUnified } from '../index';
import { buildMapperCtx } from '../mapper-ctx';
import { resolvePlan } from '../../tz-mapper-engine';
import { canonId } from '../shared-constants';
import { DEFAULT_STATE } from '../../../ui/screens/Calculator/Calc.types';

function stateWithAas(ids: string[]) {
  return {
    ...DEFAULT_STATE,
    pharma: {
      ...DEFAULT_STATE.pharma,
      phase: 'course' as const,
      aas: ids.map(id => ({ id, doseMgWeek: 250, weeks: 12 })),
    },
  };
}

describe('course pharmacology mandatory rules', () => {
  it('adds hCG for any AAS course and does not auto-assign cabergoline', () => {
    const result = calculateSupportTZ(stateWithAas(['test_enan', 'tren_enan']));

    expect(result.selectedSubstances).toContain('hcg');
    expect(result.selectedSubstances).toContain('hydration');
    expect(result.selectedSubstances).toContain('cardio_aerobic');
    expect(result.selectedSubstances).toContain('electrolyte_balance');
    expect(result.selectedSubstances).not.toContain('cabergoline');
  });

  it('adds agmatine for nandrolone and keeps cabergoline lab-gated', () => {
    const result = calculateSupportTZ(stateWithAas(['test_enan', 'nandrolone_decanoate']));

    expect(result.selectedSubstances).toContain('agmatine');
    expect(result.selectedSubstances).not.toContain('cabergoline');
    expect(result.phaseAssignedDrugs?.some(d => d.id === 'agmatine')).toBe(true);
  });

  it('keeps foundation support out of pill burden', () => {
    const result = runSupportUnified(stateWithAas(['test_enan']));
    const foundation = result.substances.filter(s => ['hydration', 'cardio_aerobic', 'electrolyte_balance'].includes(s.id));

    expect(foundation).toHaveLength(3);
    expect(foundation.every(s => s.kind === 'lifestyle' || s.kind === 'mineral')).toBe(true);
    expect(result.pillBurden?.totalSubstances).toBeLessThan(result.substances.length);
  });

  it('builds the combined test + tren + DHB course profile', () => {
    const result = calculateSupportTZ(stateWithAas(['test_enan', 'tren_enan', 'dhb']));
    const ids = new Set(result.selectedSubstances);

    const expected = [
      'hcg', 'tadalafil', 'telmisartan', 'nebivolol',
      'hydration', 'cardio_aerobic', 'electrolyte_balance',
      'nac', 'astragalus', 'cordyceps',
      'magnesium_l_threonate', 'phosphatidylserine', 'vitamin_b12',
      'nattokinase', 'serrapeptase', 'bromelain', 'hesperidin', 'pycnogenol', 'citrulline', 'bergamot',
      'tmg', 'astaxanthin', 'alpha_lipoic', 'curcumin', 'berberine', 'dandelion',
    ];
    for (const id of expected) expect(ids.has(id)).toBe(true);
    expect(ids.has('cabergoline')).toBe(false);
    expect(result.protocolWarnings?.some(w => w.includes('КАБЕРГОЛИН'))).toBe(true);
    expect(result.selectedSubstances.length).toBeLessThanOrEqual(40);
    expect(['warfarin', 'enoxaparin', 'sulodexide', 'lumbrokinase', 'dipyridamole', 'pentoxifylline'].some(id => ids.has(id))).toBe(false);
  });

  it('calculateSupportTZ и resolvePlan дают один и тот же план (единый источник)', () => {
    const state = stateWithAas(['test_enan', 'tren_enan', 'dhb']);
    const engineIds = new Set(calculateSupportTZ(state).selectedSubstances.map((id: string) => canonId(id)));
    const rec = resolvePlan(buildMapperCtx(state, 'medium'));
    const recIds = new Set(rec.subs.map(s => canonId(s.substanceId)));

    for (const id of recIds) expect(engineIds.has(id)).toBe(true);
    for (const id of engineIds) expect(recIds.has(id)).toBe(true);
  });

  it('каберголин появляется ТОЛЬКО при подтверждённом PRL', () => {
    const labs = (panelSex: Record<string, string>) => ({
      ...DEFAULT_STATE.labs,
      fullPanel: { date: '2026-01-01', panelSex } as any,
    });

    const highPrl = stateWithAas(['test_enan', 'tren_enan']);
    highPrl.labs = labs({ Prolactin: '45' });
    const recHigh = resolvePlan(buildMapperCtx(highPrl, 'medium'));
    expect(recHigh.subs.some(s => canonId(s.substanceId) === 'cabergoline')).toBe(true);
    expect(recHigh.protocolWarnings?.some(w => w.includes('КАБЕРГОЛИН НЕ НАЗНАЧЕН'))).toBe(false);

    const normalPrl = stateWithAas(['test_enan', 'tren_enan']);
    normalPrl.labs = labs({ Prolactin: '12' });
    const recNormal = resolvePlan(buildMapperCtx(normalPrl, 'medium'));
    expect(recNormal.subs.some(s => canonId(s.substanceId) === 'cabergoline')).toBe(false);
    expect(recNormal.protocolWarnings?.some(w => w.includes('КАБЕРГОЛИН НЕ НАЗНАЧЕН'))).toBe(true);
  });

  it('popup добавления/удаления проходят через движок (manualChoices на любом уровне)', () => {
    const state = stateWithAas(['test_enan']);
    const baseRec = resolvePlan(buildMapperCtx(state, 'medium'));
    expect(baseRec.subs.some(s => canonId(s.substanceId) === 'hcg')).toBe(true);

    const addedRec = resolvePlan(buildMapperCtx(state, 'medium', { addSubs: ['hydration'] }));
    expect(addedRec.subs.some(s => canonId(s.substanceId) === 'hydration')).toBe(true);

    const removedRec = resolvePlan(buildMapperCtx(state, 'medium', { removeSubs: ['hcg'] }));
    expect(removedRec.subs.some(s => canonId(s.substanceId) === 'hcg')).toBe(false);
    expect(removedRec.suppression?.some(s => s.substanceId === 'hcg')).toBe(true);
  });

  it('процедурная эскалация по HCT', () => {
    const labs = (hct: string) => ({
      ...DEFAULT_STATE.labs,
      fullPanel: { date: '2026-01-01', panelHematology: { HCT: hct } } as any,
    });

    const hct53 = stateWithAas(['test_enan', 'tren_enan']);
    hct53.labs = labs('53');
    const rec53 = resolvePlan(buildMapperCtx(hct53, 'medium'));
    expect(rec53.procedures?.some(p => p.id === 'erythrocytapheresis')).toBe(true);

    const hct50 = stateWithAas(['test_enan', 'tren_enan']);
    hct50.labs = labs('50');
    const rec50 = resolvePlan(buildMapperCtx(hct50, 'medium'));
    expect(rec50.procedures?.some(p => p.id === 'erythrocytapheresis')).toBe(false);
    expect(rec50.procedures?.some(p => p.id === 'hematology_review')).toBe(true);

    const hct45 = stateWithAas(['test_enan', 'tren_enan']);
    hct45.labs = labs('45');
    const rec45 = resolvePlan(buildMapperCtx(hct45, 'medium'));
    expect(rec45.procedures || []).toHaveLength(0);
  });
});
