/** ped-catalog-audit.test.ts — полный аудит каталога фармакологии:
 *  единый резолвер id, категории каждого препарата, potency, ped-risk по 7 системам,
 *  lab-маркеры, V7-поддержка, ребаунд с поддержкой, механизм-модель с поддержкой. */
import { describe, it, expect } from 'vitest';
import { classifyPed, computeIntensityFactor, derivePEDFlags, type PEDDose } from '../../data/ped-potency-table';
import { resolvePedAlias } from '../../data/ped-alias-map';
import { assessPedRisk, computeResidualRisk, type PedRiskAssessment } from '../ped-risk-matrix';
import { getNeuroBoosterSubstanceIds } from '../tz-bridge-boosters';
import { getPharmaLabMarkers } from '../../data/pharma-lab-marker-map';
import { computeV7Matrix, type MatrixInput } from '../risk-engine-v7-matrix';
import { calculateReboundTrajectory } from '../rebound-modeling.engine';
import { calculateTzSpecRisk } from '../risk-engine-tz-spec';
import { SUPPLEMENTS_DB } from '../../data/support-db/supplements';
import { SUPPORT_CATALOG_DATA } from '../../data/support-catalog-data';
import { registerCatalogExtras } from '../../data/support-catalog-extras';
registerCatalogExtras(SUPPORT_CATALOG_DATA);

const ped = (id: string, pClass: string, mgPerWeek = 500, form: 'inject' | 'oral' = 'inject'): PEDDose => ({ id, pClass, mgPerWeek, form });

describe('resolvePedAlias — единая система id', () => {
  it('сводит все системы именования к канону pharma-db', () => {
    expect(resolvePedAlias('tren_ace')).toBe('tren_acet');
    expect(resolvePedAlias('trenbolone_acetate')).toBe('tren_acet');
    expect(resolvePedAlias('tren_a')).toBe('tren_acet');
    expect(resolvePedAlias('trenbolone_enan')).toBe('tren_enan');
    expect(resolvePedAlias('nandrolone_decanoate')).toBe('deca');
    expect(resolvePedAlias('nand_dec')).toBe('deca');
    expect(resolvePedAlias('nandrolone_phenylprop')).toBe('npp');
    expect(resolvePedAlias('oxymetholone')).toBe('anadrol');
    expect(resolvePedAlias('oximetholone')).toBe('anadrol'); // опечатка lab-map
    expect(resolvePedAlias('stanozolol_oral')).toBe('stan');
    expect(resolvePedAlias('winstrol')).toBe('stan');
    expect(resolvePedAlias('methandienone')).toBe('methand');
    expect(resolvePedAlias('turinabol')).toBe('trena');
    expect(resolvePedAlias('halotestin')).toBe('halo');
    expect(resolvePedAlias('methyltestosterone')).toBe('methyltest');
    expect(resolvePedAlias('masteron')).toBe('drostanolone_prop');
    expect(resolvePedAlias('masteron_enan')).toBe('drostanolone_enan');
    expect(resolvePedAlias('primobolan')).toBe('prim_enan');
    expect(resolvePedAlias('trestolone')).toBe('trest_enan');
    expect(resolvePedAlias('somatropin')).toBe('hgh');
    expect(resolvePedAlias('insulin_rapid')).toBe('ins_short');
    expect(resolvePedAlias('insulin_lantus')).toBe('ins_long');
    expect(resolvePedAlias('igf1lr3')).toBe('igf1_lr3');
    expect(resolvePedAlias('igf_des')).toBe('igf1_des');
    expect(resolvePedAlias('ligandrol')).toBe('lgd');
    expect(resolvePedAlias('mk2866')).toBe('ostarine');
    expect(resolvePedAlias('dhb_acetate')).toBe('dhb_acetate'); // канон уже
    expect(resolvePedAlias('dihydroboldenone')).toBe('dhb');
    // канонические id не меняются
    expect(resolvePedAlias('test_enan')).toBe('test_enan');
    expect(resolvePedAlias('dhb_cyp')).toBe('dhb_cyp');
    expect(resolvePedAlias('ghrp6')).toBe('ghrp6');
  });

  it('канонизирует регистр и дефисы', () => {
    expect(resolvePedAlias('Trenbolone-Acetate')).toBe('tren_acet');
    expect(resolvePedAlias('  NANDROLONE DECANOATE ')).toBe('deca');
  });
});

describe('classifyPed — категории всех препаратов (0 "other" для PED)', () => {
  const cases: Array<[string, string]> = [
    ['test_enan', 'aas_test'], ['test_cyp', 'aas_test'], ['test_prop', 'aas_test'], ['test_undec', 'aas_test'], ['sustanon', 'aas_test'],
    ['npp', 'aas_nandrolone'], ['deca', 'aas_nandrolone'], ['nandrolone_decanoate', 'aas_nandrolone'],
    ['tren_acet', 'aas_tren'], ['tren_enan', 'aas_tren'], ['tren_hex', 'aas_tren'], ['parabolan', 'aas_tren'],
    ['trest_acet', 'aas_nandrolone'], ['trest_enan', 'aas_nandrolone'], ['trestolone', 'aas_nandrolone'],
    ['bold_undec', 'aas_bold'], ['boldenone_undecylenate', 'aas_bold'],
    ['dhb', 'aas_dht_inject'], ['dhb_cyp', 'aas_dht_inject'], ['dhb_acetate', 'aas_dht_inject'], ['dhb_propionate', 'aas_dht_inject'],
    ['prim_enan', 'aas_dht_inject'], ['primobolan_enan', 'aas_dht_inject'], ['methenolone_acetate', 'aas_dht_inject'],
    ['drostanolone_prop', 'aas_dht_inject'], ['drostanolone_enan', 'aas_dht_inject'], ['masteron_prop', 'aas_dht_inject'],
    ['methand', 'aas_oral_dbol'], ['methandienone', 'aas_oral_dbol'], ['dbol', 'aas_oral_dbol'],
    ['anadrol', 'aas_oral_oxy'], ['oxymetholone', 'aas_oral_oxy'],
    ['stan', 'aas_oral_winny'], ['stanozolol', 'aas_oral_winny'], ['stanozolol_oral', 'aas_oral_winny'], ['stanozolol_inj', 'aas_oral_winny'],
    ['oxan', 'aas_oral_anavar'], ['oxandrolone', 'aas_oral_anavar'],
    ['trena', 'aas_oral_tbol'], ['turinabol', 'aas_oral_tbol'],
    ['halo', 'aas_oral_halo'], ['halotestin', 'aas_oral_halo'],
    ['superdrol', 'aas_oral_other'], ['methyltest', 'aas_oral_other'], ['methyltestosterone', 'aas_oral_other'],
    ['ostarine', 'sarm'], ['lgd', 'sarm'], ['rad140', 'sarm'], ['s23', 'sarm'], ['yk11', 'sarm'], ['mk677', 'gh'],
    ['somatropin', 'gh'], ['hgh', 'gh'], ['cjc1295', 'gh'], ['ghrp6', 'gh'], ['ipamorelin', 'gh'], ['sermorelin', 'gh'],
    ['igf1_lr3', 'igf'], ['igf1_des', 'igf'], ['mgf', 'mgf'],
    ['ins_short', 'insulin'], ['ins_long', 'insulin'], ['ins_aspart', 'insulin'], ['ins_detemir', 'insulin'], ['insulin_rapid', 'insulin'],
    ['semaglutide', 'glp1'], ['tirzepatide', 'glp1'],
    ['clenbuterol', 'clenbut'], ['t3', 't3'], ['t4', 't4'],
    ['mesterolone', 'other'], ['proviron', 'other'], // не PED-класс (оральный DHT, риски отдельным правилом)
  ];
  for (const [id, expected] of cases) {
    it(`${id} → ${expected}`, () => {
      expect(classifyPed(id)).toBe(expected);
    });
  }
});

describe('potency — все препараты с реальными значениями', () => {
  it('tren_acet (канон) получает potency 3.0, а не 1.0', () => {
    const f = computeIntensityFactor([ped('tren_acet', 'aas_tren', 200)]);
    expect(f).toBeCloseTo(0.35 + (200 / 500) * 3.0, 2);
  });
  it('trenbolone_acetate (PED_LIST id) — тот же potency', () => {
    const f = computeIntensityFactor([ped('trenbolone_acetate', 'aas_tren', 200)]);
    expect(f).toBeCloseTo(0.35 + (200 / 500) * 3.0, 2);
  });
  it('dhb и эфиры — potency 0.8', () => {
    for (const id of ['dhb', 'dhb_cyp', 'dhb_acetate', 'dhb_propionate']) {
      const f = computeIntensityFactor([ped(id, 'aas_dht_inject', 500)]);
      expect(f).toBeCloseTo(0.35 + 0.8, 2);
    }
  });
  it('канонические оралы — реальные potency', () => {
    expect(computeIntensityFactor([ped('methand', 'aas_oral_dbol', 300)])).toBeCloseTo(0.35 + (300 / 500) * 3.5, 2);
    expect(computeIntensityFactor([ped('stan', 'aas_oral_winny', 200)])).toBeCloseTo(0.35 + (200 / 500) * 2.0, 2);
    expect(computeIntensityFactor([ped('oxan', 'aas_oral_anavar', 200)])).toBeCloseTo(0.35 + (200 / 500) * 0.8, 2);
    expect(computeIntensityFactor([ped('trena', 'aas_oral_tbol', 300)])).toBeCloseTo(0.35 + (300 / 500) * 1.5, 2);
    expect(computeIntensityFactor([ped('superdrol', 'aas_oral_other', 140)])).toBeCloseTo(0.35 + (140 / 500) * 4.0, 2);
  });
  it('tren_hex / bold_undec / prim_enan / мастерон — реальные potency', () => {
    expect(computeIntensityFactor([ped('tren_hex', 'aas_tren', 200)])).toBeCloseTo(0.35 + (200 / 500) * 4.0, 2);
    expect(computeIntensityFactor([ped('bold_undec', 'aas_bold', 500)])).toBeCloseTo(0.35 + 0.7, 2);
    expect(computeIntensityFactor([ped('prim_enan', 'aas_dht_inject', 400)])).toBeCloseTo(0.35 + (400 / 500) * 0.5, 2);
    expect(computeIntensityFactor([ped('drostanolone_prop', 'aas_dht_inject', 400)])).toBeCloseTo(0.35 + (400 / 500) * 0.9, 2);
  });
});

describe('assessPedRisk — риски по 7 системам (тренболон/нандролон дают реальные риски)', () => {
  it('тренболон 500 мг/нед: neuro high + cardio high + hepatic moderate + renal moderate + rep high', () => {
    const r = assessPedRisk([ped('tren_acet', 'aas_tren', 500)]);
    expect(r.neuroRisk).toBe('high');
    expect(r.hematoRisk).toBe('moderate');
    expect(r.hepaticRisk).toBe('moderate');
    expect(r.cardioRisk).toBe('high');
    expect(r.renalRisk).toBe('moderate');
    expect(r.reproductiveRisk).toBe('high');
    expect(r.neuroBoosterTier).toBe(3);
  });

  it('тренболон 200 мг/нед (порог AGENTS): moderate, без hepatic', () => {
    const r = assessPedRisk([ped('tren_acet', 'aas_tren', 200)]);
    expect(r.neuroRisk).toBe('moderate');
    expect(r.hepaticRisk).toBe('low');
    expect(r.cardioRisk).toBe('moderate');
  });

  it('нандролон 400 мг/нед: cardio moderate + rep high + hemato high + joints protective', () => {
    const r = assessPedRisk([ped('deca', 'aas_nandrolone', 400)]);
    expect(r.neuroRisk).toBe('moderate');
    expect(r.jointsRisk).toBe('protective');
    expect(r.hematoRisk).toBe('high');
    expect(r.hepaticRisk).toBe('none');
    expect(r.cardioRisk).toBe('moderate');
    expect(r.reproductiveRisk).toBe('high');
  });

  it('метан 50 мг oral (день): hepatic high + TUDCA/NAC в рекомендуемой поддержке', () => {
    const r = assessPedRisk([ped('methand', 'aas_oral_dbol', 50, 'oral')]);
    expect(r.hepaticRisk).toBe('high');
    expect(r.cardioRisk).toBe('moderate');
    const m = r.perSubstance.find(p => p.substanceId === 'methand');
    expect(m?.support).toEqual(expect.arrayContaining(['tudca', 'nac']));
  });

  it('DHB: hemato high + cardio moderate + hepatic moderate, категория dht_inject', () => {
    expect(classifyPed('dhb')).toBe('aas_dht_inject');
    const r = assessPedRisk([ped('dhb', 'aas_dht_inject', 400)]);
    expect(r.hematoRisk).toBe('high');
    expect(r.cardioRisk).toBe('moderate');
    expect(r.hepaticRisk).toBe('moderate');
    expect(r.reproductiveRisk).toBe('moderate');
  });

  it('DHB ацетат/пропионат — те же риски', () => {
    for (const id of ['dhb_acetate', 'dhb_propionate', 'dhb_cyp']) {
      const r = assessPedRisk([ped(id, 'aas_dht_inject', 400)]);
      expect(r.hematoRisk).toBe('high');
      expect(r.cardioRisk).toBe('moderate');
    }
  });

  it('prim_enan / trena / yk11 / s23 — правила существуют', () => {
    const prim = assessPedRisk([ped('prim_enan', 'aas_dht_inject', 400)]);
    expect(prim.perSubstance.length).toBe(1);
    expect(prim.perSubstance[0].matchedBy).toContain('prim');
    const trena = assessPedRisk([ped('trena', 'aas_oral_tbol', 300, 'oral')]);
    expect(trena.perSubstance.length).toBe(1);
    const yk = assessPedRisk([ped('yk11', 'sarm', 20)]);
    expect(yk.perSubstance.length).toBe(1);
    const s23r = assessPedRisk([ped('s23', 'sarm', 20)]);
    expect(s23r.perSubstance.length).toBe(1);
  });

  it('инсулины и GLP-1 — правила есть (риски none/low, не пропускаются молча)', () => {
    const ins = assessPedRisk([{ id: 'ins_short', pClass: 'insulin', iuPerDay: 10 }]);
    expect(ins.perSubstance.length).toBe(1);
    const glp = assessPedRisk([{ id: 'semaglutide', pClass: 'glp1', mgPerWeek: 1 }]);
    expect(glp.perSubstance.length).toBe(1);
    expect(glp.neuroRisk).toBe('low');
  });

  it('трен + нандролон: эскалация 2+ 19-нор → neuro high', () => {
    const r = assessPedRisk([ped('tren_acet', 'aas_tren', 300), ped('deca', 'aas_nandrolone', 400)]);
    expect(r.neuroRisk).toBe('high');
  });

  it('нандролон + станозолол 300: компенсация суставного риска high→moderate', () => {
    const r = assessPedRisk([ped('deca', 'aas_nandrolone', 400), ped('stan', 'aas_oral_winny', 300, 'oral')]);
    expect(r.jointsRisk).toBe('moderate');
  });
});

describe('computeResidualRisk — покрытие по механизмам (бустеры ∪ протокольная поддержка)', () => {
  it('TUDCA/NAC из протокола дают hepatic-покрытие (ранее — только бустер-списки)', () => {
    const gross = assessPedRisk([ped('tren_acet', 'aas_tren', 500)]);
    const net = computeResidualRisk(gross, ['nebivolol', 'tudca', 'nac', 'astragalus', 'magnesium_l_threonate', 'phosphatidylserine', 'vitamin_b12', 'theanine', 'glycine']);
    // neuroRecommended теперь включает поддержку из правила (не только бустеры LV3)
    expect(net.neuroRecommended!).toBeGreaterThan(0);
    expect(net.neuroCovered!).toBeGreaterThan(0);
    expect(net.grossNeuroTier).toBe(3);
  });

  it('полное покрытие (все бустеры LV1-LV3 + протокол) → tier 0', () => {
    const gross = assessPedRisk([ped('tren_acet', 'aas_tren', 500)]);
    const fullPlan = [...getNeuroBoosterSubstanceIds(3), 'nebivolol', 'tudca', 'nac', 'astragalus'];
    const net = computeResidualRisk(gross, fullPlan);
    expect(net.neuroCoverage!).toBeGreaterThanOrEqual(80);
    expect(net.neuroBoosterTier).toBe(0);
  });

  it('без покрытия — gross = net', () => {
    const gross = assessPedRisk([ped('tren_acet', 'aas_tren', 500)]);
    const net = computeResidualRisk(gross, ['creatine']);
    expect(net.neuroBoosterTier).toBe(gross.neuroBoosterTier);
    expect(net.neuroCovered).toBe(0);
  });
});

describe('getPharmaLabMarkers — резолвер алиасов + фикс опечатки', () => {
  it('id PED_LIST резолвятся в маркеры', () => {
    expect(getPharmaLabMarkers('trenbolone_acetate').length).toBeGreaterThan(0);
    expect(getPharmaLabMarkers('nandrolone_decanoate').length).toBeGreaterThan(0);
    expect(getPharmaLabMarkers('boldenone_undecylenate').length).toBeGreaterThan(0);
    expect(getPharmaLabMarkers('masteron_prop').length).toBeGreaterThan(0);
    expect(getPharmaLabMarkers('primobolan_enan').length).toBeGreaterThan(0);
    expect(getPharmaLabMarkers('igf1_lr3').length).toBeGreaterThan(0);
    expect(getPharmaLabMarkers('somatropin').length).toBeGreaterThan(0);
    expect(getPharmaLabMarkers('tirzepatide').length).toBeGreaterThan(0);
  });
  it('анадрол: и oxymetholone, и опечатка oximetholone, и канон anadrol дают маркеры', () => {
    expect(getPharmaLabMarkers('oxymetholone').length).toBeGreaterThan(0);
    expect(getPharmaLabMarkers('oximetholone').length).toBeGreaterThan(0);
    expect(getPharmaLabMarkers('anadrol').length).toBeGreaterThan(0);
  });
  it('DHB-эфиры дают маркеры', () => {
    expect(getPharmaLabMarkers('dhb_acetate').length).toBeGreaterThan(0);
    expect(getPharmaLabMarkers('dhb_propionate').length).toBeGreaterThan(0);
  });
  it('exemestane (AI, ранее отсутствовал во всей кодовой базе) — маркеры и мех-записи', () => {
    expect(getPharmaLabMarkers('exemestane').length).toBeGreaterThan(0);
    // в SUPPLEMENTS_DB (каталог автогенерируется из него)
    expect(Array.isArray(SUPPLEMENTS_DB.exemestane)).toBe(true);
    expect(SUPPLEMENTS_DB.exemestane.length).toBeGreaterThan(0);
    expect(SUPPLEMENTS_DB.exemestane[0].mechId).toBe('rep4');
  });
  it('niacin/tadalafil — русские имена и дозировки в каталоге (ранее: английские и без доз)', () => {
    expect(SUPPORT_CATALOG_DATA.niacin.nameRu).toContain('Ниацин');
    expect(SUPPORT_CATALOG_DATA.niacin.dosage.mg).toBe(500);
    expect(SUPPORT_CATALOG_DATA.tadalafil.nameRu).toContain('Тадалафил');
    expect(SUPPORT_CATALOG_DATA.tadalafil.dosage.mg).toBe(5);
    expect(SUPPORT_CATALOG_DATA.lamotrigine.nameRu).toContain('Ламотриджин');
    expect(SUPPORT_CATALOG_DATA.exemestane.nameRu).toContain('Экземестан');
  });
});

describe('derivePEDFlags — DHB сохраняет bold-ветки (фибринолитики)', () => {
  it('dhb → hasBold=true даже в категории dht_inject', () => {
    const flags = derivePEDFlags([ped('dhb', 'aas_dht_inject', 400)]);
    expect(flags.hasBold).toBe(true);
    expect(flags.hasDhtInject).toBe(true);
  });
  it('канонические оралы: multi-oral и winny+oxy детектятся', () => {
    const flags = derivePEDFlags([ped('stan', 'aas_oral_winny', 300, 'oral'), ped('anadrol', 'aas_oral_oxy', 300, 'oral')]);
    expect(flags.isMultiOral).toBe(true);
    expect(flags.isWinnyPlusOxy).toBe(true);
  });
});

describe('V7-модель — поддержка по каноническим id снижает риск', () => {
  const baseInput = (): MatrixInput => ({
    labs: [{ id: '1', code: 'ALT', name: 'АЛТ', value: 60, unit: 'U/L', date: '2026-08-01', phase: 'mid' }],
    course: [{ id: 'c1', substanceId: 'test_enan', doseValue: 500, doseUnit: 'mg/week', frequency: 1, startWeek: 1, endWeek: 12 }],
    genetics: {},
    nutrition: { proteinPerKg: 2, fiberG: 30, omega3G: 1, sodiumG: 3, potassiumG: 3 },
    training: { workoutsPerWeek: 4, avgWorkoutMinutes: 60, hasHIIT: false, volumeTonnes: 8, lissMinutesPerWeek: 60 },
    mode: 'bulk',
    stazhWeeks: 100,
    continuousWeeks: 12,
  });

  it('nac/tudca (канонические id) снижают hepatic-риск (ранее не матчились с NAC/TUDCA)', () => {
    const without = computeV7Matrix(baseInput(), []);
    const withSupport = computeV7Matrix(baseInput(), ['nac', 'tudca', 'milk_thistle']);
    const hepWithout = without.systems.hepatic?.raw ?? without.systems.liver?.raw ?? 0;
    const hepWith = withSupport.systems.hepatic?.net ?? withSupport.systems.liver?.net ?? 0;
    expect(hepWith).toBeLessThan(hepWithout);
  });

  it('vitamin_d3/zinc/curcumin/anastrozole — алиасы матчатся', () => {
    const without = computeV7Matrix(baseInput(), []);
    const withSupport = computeV7Matrix(baseInput(), ['vitamin_d3', 'zinc', 'curcumin', 'anastrozole', 'cabergoline', 'selenium', 'taurine']);
    expect(withSupport.overallNet).toBeLessThan(without.overallNet);
  });

  it('основные назначения плана (agmatine/hesperidin/dandelion/astragalus/фибринолитики) снижают риск', () => {
    const without = computeV7Matrix(baseInput(), []);
    const withSupport = computeV7Matrix(baseInput(), ['agmatine', 'hesperidin', 'dandelion', 'astragalus', 'nattokinase', 'serrapeptase', 'bromelain', 'lumbrokinase', 'pentoxifylline', 'dipyridamole', 'cordyceps', 'citrulline', 'glycine', 'bergamot', 'betaine']);
    expect(withSupport.overallNet).toBeLessThan(without.overallNet);
  });
});

describe('rebound-modeling — поддержка ускоряет восстановление маркеров', () => {
  const input = () => ({
    peds: [{ id: 'deca', pClass: 'aas_nandrolone', mgPerWeek: 400 }],
    cycleWeeks: 12,
    pctProtocol: 'none' as const,
    userProfile: { age: 30, baselineTT: 500, baselineE2: 30, baselinePRL: 10, baselineCortisol: 400, baselineSHBG: 30, baselineLH: 4, baselineFSH: 4 },
  });

  it('каберголин в поддержке → PRL восстанавливается быстрее', () => {
    const without = calculateReboundTrajectory(input());
    const withCaber = calculateReboundTrajectory({ ...input(), supportSubs: ['cabergoline'] });
    expect(withCaber.prl.recoveryHalfLife).toBeLessThan(without.prl.recoveryHalfLife);
  });

  it('AI в поддержке → E2 нормализуется быстрее', () => {
    const without = calculateReboundTrajectory(input());
    const withAI = calculateReboundTrajectory({ ...input(), supportSubs: ['anastrozole'] });
    expect(withAI.e2.recoveryHalfLife).toBeLessThan(without.e2.recoveryHalfLife);
  });
});

describe('механизм-модель — поддержка с k-записями снижает риск органа', () => {
  it('TUDCA снижает hepatic-риск в calculateTzSpecRisk', () => {
    const base = {
      drugClass: 'aas' as const,
      drugName: 'tren_acet',
      dose: 500,
      duration: 12,
      form: 'inject' as const,
      combinations: 1,
      labCoverage: 1,
      labValues: { ALT: 40, AST: 30 },
      drugs: [{ drugClass: 'aas' as const, drugName: 'tren_acet', dose: 500, form: 'inject' as const, duration: 12 }],
      supportSubstances: [] as string[],
    };
    const without = calculateTzSpecRisk(base);
    const withSupport = calculateTzSpecRisk({ ...base, supportSubstances: ['tudca', 'nac'] });
    const hep = (r: { organs?: { id: string; afterPercent: number }[] }) =>
      (r.organs || []).find(o => o.id === 'hepatic')?.afterPercent ?? 0;
    expect(hep(withSupport as any)).toBeLessThan(hep(without as any));
  });
});
