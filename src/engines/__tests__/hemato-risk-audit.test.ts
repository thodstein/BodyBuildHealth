import { describe, it, expect } from 'vitest';
import { assessPedRisk, computeResidualRisk, describePedRisk, type PedRisk } from '../ped-risk-matrix';
import {
  HEMATO_BOOST,
  shouldActivateHemato,
  getHematoBoosterSubstanceIds,
  type BoosterTriggerCtx,
} from '../tz-bridge-boosters';
import type { PEDDose } from '../../data/ped-potency-table';

function ped(id: string, mgPerWeek: number, form: 'oral' | 'inject' = 'inject'): PEDDose {
  return { id, pClass: undefined as any, mgPerWeek, form };
}

// ════════════════════════════════════════════════════════════════════════════
//  Часть 1: PED-matrix hemato — AAS dose-tiers
// ════════════════════════════════════════════════════════════════════════════
describe('ped-risk-matrix: hemato — AAS dose-tiers', () => {
  it('болденон → high hemato (самый сильный ЭПО-эффект)', () => {
    const r = assessPedRisk([ped('boldenone_undecylenate', 400)], 'medium');
    expect(r.hematoRisk).toBe('high');
    expect(r.hematoBoosterTier).toBe(3);
    expect(r.triggeredBy.some(x => x.includes('Болденон'))).toBe(true);
  });

  it('тестостерон <500 мг → low hemato', () => {
    const r = assessPedRisk([ped('testosterone_enanthate', 300)], 'medium');
    expect(r.hematoRisk).toBe('low');
    expect(r.hematoBoosterTier).toBe(0);
  });

  it('тестостерон 500-999 мг → moderate hemato', () => {
    const r = assessPedRisk([ped('testosterone_enanthate', 750)], 'medium');
    expect(r.hematoRisk).toBe('moderate');
    expect(r.hematoBoosterTier).toBe(2);
  });

  it('тестостерон ≥1000 мг → high hemato', () => {
    const r = assessPedRisk([ped('testosterone_enanthate', 1200)], 'medium');
    expect(r.hematoRisk).toBe('high');
    expect(r.hematoBoosterTier).toBe(3);
  });

  it('оксиметолон → high hemato (клинический эритропоэз)', () => {
    const r = assessPedRisk([ped('oxymetholone', 100, 'oral')], 'medium');
    expect(r.hematoRisk).toBe('high');
    expect(r.hematoBoosterTier).toBe(3);
  });

  it('нандролон <400 мг → moderate hemato', () => {
    const r = assessPedRisk([ped('nandrolone_decanoate', 300)], 'medium');
    expect(r.hematoRisk).toBe('moderate');
    expect(r.hematoBoosterTier).toBe(2);
  });

  it('нандролон ≥400 мг → high hemato', () => {
    const r = assessPedRisk([ped('nandrolone_decanoate', 600)], 'medium');
    expect(r.hematoRisk).toBe('high');
    expect(r.hematoBoosterTier).toBe(3);
  });

  it('тренболон ≥600 мг → high hemato', () => {
    const r = assessPedRisk([ped('trenbolone_enanthate', 700)], 'medium');
    expect(r.hematoRisk).toBe('high');
  });

  it('тренболон <600 мг → moderate hemato', () => {
    const r = assessPedRisk([ped('trenbolone_acetate', 400)], 'medium');
    expect(r.hematoRisk).toBe('moderate');
  });

  it('станозолол <210 мг → moderate hemato', () => {
    const r = assessPedRisk([ped('stanozolol', 150, 'oral')], 'medium');
    expect(r.hematoRisk).toBe('moderate');
  });

  it('станозолол ≥210 мг → high hemato', () => {
    const r = assessPedRisk([ped('stanozolol', 300, 'oral')], 'medium');
    expect(r.hematoRisk).toBe('high');
  });

  it('SARMs → none hemato (не стимулируют эритропоэз)', () => {
    const r = assessPedRisk([ped('rad140', 0)], 'medium');
    expect(r.hematoRisk).toBe('none');
    expect(r.hematoBoosterTier).toBe(0);
  });

  it('GH → none hemato', () => {
    const r = assessPedRisk([{ id: 'somatropin', pClass: 'gh', iuPerDay: 4, form: 'subq' } as PEDDose], 'medium');
    expect(r.hematoRisk).toBe('none');
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  Часть 2: Эскалации hemato
// ════════════════════════════════════════════════════════════════════════════
describe('ped-risk-matrix: hemato эскалации', () => {
  it('2+ AAS с moderate+ hemato → high (синергия эритропоэза)', () => {
    const r = assessPedRisk([
      ped('testosterone_enanthate', 600),   // moderate
      ped('nandrolone_decanoate', 300),     // moderate
    ], 'medium');
    expect(r.hematoRisk).toBe('high');
    expect(r.triggeredBy.some(x => x.includes('синергия'))).toBe(true);
  });

  it('3+ PED → +1 hemato уровень', () => {
    const r = assessPedRisk([
      ped('testosterone_enanthate', 300),   // low
      ped('primobolan', 300),               // low
      ped('tbol', 40, 'oral'),             // low
    ], 'medium');
    expect(r.hematoRisk).toBe('moderate');
    expect(r.triggeredBy.some(x => x.includes('3+ PED'))).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  Часть 3: level='max' → hemato tier boost
// ════════════════════════════════════════════════════════════════════════════
describe('ped-risk-matrix: hemato + level=max', () => {
  it('level=max + нет PED → tier 1 (принудительная база)', () => {
    const r = assessPedRisk([], 'max');
    expect(r.hematoBoosterTier).toBe(1);
  });

  it('level=medium + нет PED → tier 0', () => {
    const r = assessPedRisk([], 'medium');
    expect(r.hematoBoosterTier).toBe(0);
  });

  it('level=max + low hemato → tier 1', () => {
    const r = assessPedRisk([ped('primobolan', 200)], 'max');
    expect(r.hematoRisk).toBe('low');
    expect(r.hematoBoosterTier).toBe(1);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  Часть 4: HEMATO_BOOST состав
// ════════════════════════════════════════════════════════════════════════════
describe('HEMATO_BOOST: состав по уровням', () => {
  it('LV1 — гидратация+кардио+электролиты+фибринолитики+телмисартан', () => {
    const lv1 = HEMATO_BOOST.subs.map(s => s.substanceId);
    // ↑Плазма
    expect(lv1).toContain('hydration');
    expect(lv1).toContain('cardio_aerobic');
    expect(lv1).toContain('electrolyte_balance');
    // ↓Тромбоз
    expect(lv1).toContain('nattokinase');
    expect(lv1).toContain('serrapeptase');
    expect(lv1).toContain('bromelain');
    // ↓EPO + ↑PV
    expect(lv1).toContain('telmisartan');
  });

  it('LV2 — +омега/чеснок/цитруллин/NAC/аспирин', () => {
    const lv2 = (HEMATO_BOOST.subsLv2 || []).map(s => s.substanceId);
    expect(lv2).toContain('omega3');
    expect(lv2).toContain('garlic');
    expect(lv2).toContain('citrulline');
    expect(lv2).toContain('nac');
    expect(lv2).toContain('aspirin');
  });

  it('LV3 — +лумброкиназа/пентоксифиллин/дипиридамол/пикногенол/гинкго', () => {
    const lv3 = (HEMATO_BOOST.subsLv3 || []).map(s => s.substanceId);
    expect(lv3).toContain('lumbrokinase');
    expect(lv3).toContain('pentoxifylline');
    expect(lv3).toContain('dipyridamole');
    expect(lv3).toContain('pycnogenol');
    expect(lv3).toContain('ginkgo');
  });

  it('mechs покрывает cv4 (протромботический) и hem1 (эритроцитоз)', () => {
    expect(HEMATO_BOOST.mechs).toContain('cv4');
    expect(HEMATO_BOOST.mechs).toContain('hem1');
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  Часть 5: getHematoBoosterSubstanceIds
// ════════════════════════════════════════════════════════════════════════════
describe('getHematoBoosterSubstanceIds: по tier', () => {
  it('tier 0 → пусто', () => {
    expect(getHematoBoosterSubstanceIds(0)).toEqual([]);
  });

  it('tier 1 → LV1 (7 веществ: гидратация+кардио+электролиты+натто+сера+бромелайн+телмисартан)', () => {
    const ids = getHematoBoosterSubstanceIds(1);
    expect(ids).toContain('hydration');
    expect(ids).toContain('cardio_aerobic');
    expect(ids).toContain('electrolyte_balance');
    expect(ids).toContain('nattokinase');
    expect(ids).toContain('serrapeptase');
    expect(ids).toContain('bromelain');
    expect(ids).toContain('telmisartan');
    expect(ids.length).toBe(7);
  });

  it('tier 2 → LV1+LV2 (12 веществ)', () => {
    const ids = getHematoBoosterSubstanceIds(2);
    expect(ids.length).toBe(12);
    expect(ids).toContain('omega3');
    expect(ids).toContain('aspirin');
  });

  it('tier 3 → LV1+LV2+LV3 (17 веществ)', () => {
    const ids = getHematoBoosterSubstanceIds(3);
    expect(ids.length).toBe(17);
    expect(ids).toContain('pentoxifylline');
    expect(ids).toContain('dipyridamole');
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  Часть 6: shouldActivateHemato
// ════════════════════════════════════════════════════════════════════════════
describe('shouldActivateHemato: триггеры', () => {
  it('PED-risk tier > 0 → активирует', () => {
    const ctx: BoosterTriggerCtx = { pedHematoTier: 2 };
    expect(shouldActivateHemato(ctx)).toBe(true);
  });

  it('forceHemato (level=max) → активирует', () => {
    const ctx: BoosterTriggerCtx = { forceHemato: true };
    expect(shouldActivateHemato(ctx)).toBe(true);
  });

  it('symptomHemato → активирует', () => {
    const ctx: BoosterTriggerCtx = { symptomHemato: true };
    expect(shouldActivateHemato(ctx)).toBe(true);
  });

  it('Hct > 48 → активирует', () => {
    const ctx: BoosterTriggerCtx = { hematocrit: 50 };
    expect(shouldActivateHemato(ctx)).toBe(true);
  });

  it('Hgb > 175 → активирует', () => {
    const ctx: BoosterTriggerCtx = { hemoglobin: 180 };
    expect(shouldActivateHemato(ctx)).toBe(true);
  });

  it('D-димер > 0.5 → активирует', () => {
    const ctx: BoosterTriggerCtx = { dDimer: 0.8 };
    expect(shouldActivateHemato(ctx)).toBe(true);
  });

  it('нет триггеров → НЕ активирует', () => {
    const ctx: BoosterTriggerCtx = {};
    expect(shouldActivateHemato(ctx)).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  Часть 7: describePedRisk — hemato label
// ════════════════════════════════════════════════════════════════════════════
describe('describePedRisk: hemato label', () => {
  it('hemato high → "высокий"', () => {
    const r = assessPedRisk([ped('boldenone_undecylenate', 400)], 'medium');
    const d = describePedRisk(r);
    expect(d.hemato).toBe('высокий');
  });

  it('hemato none → "нет риска"', () => {
    const r = assessPedRisk([ped('rad140', 0)], 'medium');
    const d = describePedRisk(r);
    expect(d.hemato).toBe('нет риска');
  });
});