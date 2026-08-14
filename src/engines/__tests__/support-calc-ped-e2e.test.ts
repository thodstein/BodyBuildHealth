/** support-calc-ped-e2e.test.ts — сквозной E2E калькулятора поддержки:
 *  препарат → категория/potency → PED-риск по 7 системам → протокол → план поддержки.
 *  Проверяет, что изменения каталога фармакологии учтены во всём конвейере калькулятора. */
import { describe, expect, it } from 'vitest';
import { buildMapperCtx } from '../support-plan/mapper-ctx';
import { resolvePlan } from '../tz-mapper-engine';
import { buildTzInput } from '../support-plan/engine-helpers';
import { calculateTzSpecRisk } from '../risk-engine-tz-spec';
import { classifyPed, computeIntensityFactor } from '../../data/ped-potency-table';
import { canonId } from '../support-plan/shared-constants';
import { detectActivePedClasses } from '../../data/ped-class-matrix';
import { DEFAULT_STATE } from '../../ui/screens/Calculator/Calc.types';

function stateWith(ids: Array<{ id: string; doseMgWeek?: number; weeks?: number } | string>, overrides: any = {}) {
  return {
    ...DEFAULT_STATE,
    pharma: {
      ...DEFAULT_STATE.pharma,
      phase: 'course',
      aas: ids.map(x => typeof x === 'string' ? { id: x, doseMgWeek: 500, weeks: 12 } : { doseMgWeek: 500, weeks: 12, ...x }),
    },
    ...overrides,
  };
}

const planIds = (rec: any): string[] => rec.subs.map((s: any) => canonId(s.substanceId));

describe('E2E калькулятора: тренболон 500 → реальные риски по всем системам + протокол', () => {
  it('classifyPed/potency/pedRisk корректны', () => {
    expect(classifyPed('trenbolone_acetate')).toBe('aas_tren');
    expect(computeIntensityFactor([{ id: 'trenbolone_acetate', pClass: 'aas_tren', mgPerWeek: 200 }])).toBeCloseTo(0.35 + 1.2, 2);
  });

  it('pedRisk: 7 систем и тиры', () => {
    const ctx = buildMapperCtx(stateWith(['trenbolone_acetate', 'test_enan']), 'medium');
    const pr = ctx.pedRisk!;
    expect(pr.neuroRisk).toBe('high');
    expect(pr.cardioRisk).toBe('high');
    expect(pr.hepaticRisk).toBe('moderate');
    expect(pr.renalRisk).toBe('moderate');
    expect(pr.reproductiveRisk).toBe('high');
    expect(pr.neuroBoosterTier).toBe(3);
  });

  it('план: трен-протокол (nebivolol/astragalus/Mg/PS/B12/теанин/глицин)', () => {
    const rec = resolvePlan(buildMapperCtx(stateWith(['trenbolone_acetate', 'test_enan']), 'medium'));
    const ids = planIds(rec);
    for (const must of ['nebivolol', 'astragalus', 'phosphatidylserine', 'vitamin_b12', 'theanine', 'glycine', 'hcg']) {
      expect(ids).toContain(must);
    }
    // магний: l-треонат (протокол) или magnesium (бустер) — зависит от лимита плана
    expect(ids.some(id => id === 'magnesium_l_threonate' || id === 'magnesium')).toBe(true);
  });

  it('механизм-модель: legacy id trenbolone_acetate резолвится в DRUG_DB (риск > 0, без падений)', () => {
    const state = stateWith(['trenbolone_acetate']);
    const rec = resolvePlan(buildMapperCtx(state, 'medium'));
    const inp = buildTzInput(state, rec.subs.map((s: any) => s.substanceId))!;
    expect(inp.drugs.some(d => d.drugName === 'tren_acet')).toBe(true);
    const risk = calculateTzSpecRisk(inp);
    expect(risk.overallRaw).toBeGreaterThan(0);
  });
});

describe('E2E калькулятора: DHB (категория dht_inject + фибринолитики)', () => {
  it('категория и potency', () => {
    expect(classifyPed('dhb')).toBe('aas_dht_inject');
    expect(classifyPed('dhb_acetate')).toBe('aas_dht_inject');
    expect(computeIntensityFactor([{ id: 'dhb', pClass: 'aas_dht_inject', mgPerWeek: 400 }])).toBeCloseTo(0.35 + (400 / 500) * 0.8, 2);
  });

  it('pedRisk: hemato high + cardio moderate + hepatic moderate', () => {
    const ctx = buildMapperCtx(stateWith(['dhb', 'test_enan']), 'medium');
    const pr = ctx.pedRisk!;
    expect(pr.hematoRisk).toBe('high');
    expect(pr.cardioRisk).toBe('moderate');
    expect(pr.hepaticRisk).toBe('moderate');
    expect(pr.hematoBoosterTier).toBe(3);
  });

  it('план: фибринолитики (болденон-протокол сохранён для DHB)', () => {
    const rec = resolvePlan(buildMapperCtx(stateWith(['dhb', 'test_enan']), 'medium'));
    const ids = planIds(rec);
    for (const must of ['nattokinase', 'serrapeptase', 'bromelain', 'aspirin']) {
      expect(ids).toContain(must);
    }
  });

  it('все эфиры DHB дают hemato high', () => {
    for (const id of ['dhb_acetate', 'dhb_propionate', 'dhb_cyp']) {
      const ctx = buildMapperCtx(stateWith([id]), 'medium');
      expect(ctx.pedRisk!.hematoRisk).toBe('high');
    }
  });
});

describe('E2E калькулятора: нандролон 400 → cardio moderate + rep high', () => {
  it('pedRisk и план (agmatine/hesperidin/dandelion/hcg)', () => {
    const state = stateWith([{ id: 'nandrolone_decanoate', doseMgWeek: 400 }]);
    const ctx = buildMapperCtx(state, 'medium');
    expect(ctx.pedRisk!.cardioRisk).toBe('moderate');
    expect(ctx.pedRisk!.reproductiveRisk).toBe('high');
    expect(ctx.pedRisk!.hematoRisk).toBe('high');
    expect(ctx.pedRisk!.jointsRisk).toBe('protective');
    const rec = resolvePlan(buildMapperCtx(state, 'medium'));
    const ids = planIds(rec);
    for (const must of ['agmatine', 'hesperidin', 'dandelion', 'hcg']) expect(ids).toContain(must);
  });
});

describe('E2E калькулятора: метан 50 мг oral → hepatic high + TUDCA/NAC', () => {
  it('pedRisk hepatic high + гепато-протокол в плане', () => {
    const state = stateWith([{ id: 'methandienone', doseMgWeek: 50, weeks: 8 }]);
    const ctx = buildMapperCtx(state, 'medium');
    expect(ctx.pedRisk!.hepaticRisk).toBe('high');
    expect(ctx.pedRisk!.cardioRisk).toBe('moderate');
    const rec = resolvePlan(buildMapperCtx(state, 'medium'));
    const ids = planIds(rec);
    for (const must of ['tudca', 'nac', 'milk_thistle']) expect(ids).toContain(must);
  });
});

describe('E2E калькулятора: SARMs и GLP-1 в фарм-матрице (detectActivePedClasses)', () => {
  it('rad140 → SARM-класс; dhb → DHT-класс; semaglutide → GLP-1', () => {
    const state = stateWith(['rad140', 'dhb', 'semaglutide']);
    const classes = detectActivePedClasses(state).map(c => c.id);
    expect(classes).toContain('sarm');
    expect(classes).toContain('dht_inject');
    expect(classes).toContain('glp1');
  });

  it('legacy id PED_LIST (trenbolone_acetate) тоже детектится', () => {
    const classes = detectActivePedClasses(stateWith(['trenbolone_acetate', 'oxymetholone'])).map(c => c.id);
    expect(classes).toContain('trenbolone');
    expect(classes).toContain('oral17');
  });
});

describe('E2E калькулятора: покрытие резidual с поддержкой из протокола', () => {
  it('план с полным нейро-протоколом тренболона → покрытие > 0', () => {
    const rec = resolvePlan(buildMapperCtx(stateWith(['trenbolone_acetate', 'test_enan']), 'medium'));
    const pr = rec.pedRisk!;
    expect(pr.neuroBoosterTier).toBe(3);
    expect(pr.neuroRisk).toBe('high');
    // протокольные вещества правила покрываются планом
    const support = (pr.perSubstance || []).flatMap((ps: any) => ps.support ?? []);
    expect(support.length).toBeGreaterThan(0);
    const covered = support.filter(id => planIds(rec).includes(canonId(id))).length;
    expect(covered).toBeGreaterThan(0);
  });
});
