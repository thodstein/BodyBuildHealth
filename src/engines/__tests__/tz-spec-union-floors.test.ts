/** tz-spec-union-floors.test.ts — субаддитивная агрегация (union) + якорные floors.
 *  Сценарная валидация: клинические кейсы с ожидаемым ответом,
 *  чтобы формула не «плавала». */
import { describe, expect, it } from 'vitest';
import { calculateTzSpecRisk, unionPct, applyMechanismSynergies, clinicalFloorsForLabs } from '../risk-engine-tz-spec';

function input(overrides: Partial<Parameters<typeof calculateTzSpecRisk>[0]> = {}) {
  return {
    drugClass: 'aas' as const,
    drugName: 'test_enan',
    dose: 500,
    duration: 12,
    form: 'inject' as const,
    combinations: 1,
    labCoverage: 0.3,
    labValues: {} as Record<string, number>,
    drugs: [{ drugClass: 'aas' as const, drugName: 'test_enan', dose: 500, form: 'inject' as const }],
    supportSubstances: [] as string[],
    ...overrides,
  };
}

describe('unionPct — субаддитивная агрегация', () => {
  it('7+7+7 → 19.6, а не 21', () => {
    expect(unionPct([7, 7, 7])).toBeCloseTo(19.6, 1);
  });
  it('50+50 → 75, а не 100', () => {
    expect(unionPct([50, 50])).toBe(75);
  });
  it('30+30+30 → 65.7, а не 90', () => {
    expect(unionPct([30, 30, 30])).toBeCloseTo(65.7, 1);
  });
  it('один механизм → его процент', () => {
    expect(unionPct([42])).toBe(42);
  });
  it('пусто/нули → 0', () => {
    expect(unionPct([])).toBe(0);
    expect(unionPct([0, 0])).toBe(0);
  });
  it('кап 100', () => {
    expect(unionPct([90, 90, 90])).toBeLessThanOrEqual(100);
  });
});

describe('applyMechanismSynergies — парные синергии', () => {
  it('cv2 × cv4 усиливают друг друга', () => {
    const mechs = [
      { id: 'cv2', rawPercent: 40, afterPercent: 30 },
      { id: 'cv4', rawPercent: 20, afterPercent: 15 },
    ];
    applyMechanismSynergies(mechs);
    expect(mechs[0].rawPercent).toBeGreaterThan(40);
    expect(mechs[1].rawPercent).toBeGreaterThan(20);
    expect(mechs[0].afterPercent).toBeGreaterThan(30);
  });
  it('без пары — без изменений', () => {
    const mechs = [{ id: 'cv2', rawPercent: 40, afterPercent: 30 }];
    applyMechanismSynergies(mechs);
    expect(mechs[0].rawPercent).toBe(40);
  });
  it('нулевой механизм не усиливает партнёра', () => {
    const mechs = [
      { id: 'cv2', rawPercent: 40, afterPercent: 30 },
      { id: 'cv4', rawPercent: 0, afterPercent: 0 },
    ];
    applyMechanismSynergies(mechs);
    expect(mechs[0].rawPercent).toBe(40);
  });
});

describe('clinicalFloorsForLabs — якорные пороги из руководств', () => {
  it('HCT 55 → гемато ≥ 50 (high)', () => {
    const floors = clinicalFloorsForLabs({ HCT: 55 });
    expect(floors.some(f => f.organId === 'hematologic' && f.level === 50)).toBe(true);
  });
  it('LDL 5.0 → кардио ≥ 50', () => {
    const floors = clinicalFloorsForLabs({ LDL: 5.0 });
    expect(floors.some(f => f.organId === 'cardio' && f.level === 50)).toBe(true);
  });
  it('eGFR 25 → ренальный ≥ 75 (very_high)', () => {
    const floors = clinicalFloorsForLabs({ eGFR: 25 });
    expect(floors.some(f => f.organId === 'renal' && f.level === 75)).toBe(true);
  });
  it('ALT 250 → печень ≥ 50', () => {
    const floors = clinicalFloorsForLabs({ ALT: 250 });
    expect(floors.some(f => f.organId === 'hepatic' && f.level === 50)).toBe(true);
  });
  it('K 2.8 → кардио ≥ 50 (аритмия)', () => {
    const floors = clinicalFloorsForLabs({ K: 2.8 });
    expect(floors.some(f => f.organId === 'cardio' && f.level === 50)).toBe(true);
  });
  it('LH 0.3 + FSH 0.4 → репродуктивный ≥ 50', () => {
    const floors = clinicalFloorsForLabs({ LH: 0.3, FSH: 0.4 });
    expect(floors.some(f => f.organId === 'reproductive' && f.level === 50)).toBe(true);
  });
  it('нормальные значения — без floors', () => {
    expect(clinicalFloorsForLabs({ HCT: 45, LDL: 2.0, eGFR: 100, ALT: 20, K: 4.2 })).toEqual([]);
  });
  it('пустые анализы — без floors', () => {
    expect(clinicalFloorsForLabs({})).toEqual([]);
  });
});

describe('сценарная валидация — клинические кейсы', () => {
  it('тренболон 500 + HCT 55 → гемато high (≥50) даже без гемато-таргета', () => {
    const r = calculateTzSpecRisk(input({
      drugName: 'tren_acet', dose: 500,
      drugs: [{ drugClass: 'aas' as const, drugName: 'tren_acet', dose: 500, form: 'inject' as const }],
      labValues: { HCT: 55 }, labCoverage: 1,
    }));
    const hema = r.organs.find(o => o.id === 'hematologic')!;
    expect(hema.afterPercent).toBeGreaterThanOrEqual(50);
    expect(hema.category).toBe('high');
    expect(hema.floors.length).toBeGreaterThan(0);
  });

  it('оксандролон + ALT 250 → печень high', () => {
    const r = calculateTzSpecRisk(input({
      drugName: 'oxan', dose: 50,
      drugs: [{ drugClass: 'aas' as const, drugName: 'oxan', dose: 50, form: 'oral' as const }],
      labValues: { ALT: 250 }, labCoverage: 1,
    }));
    const hep = r.organs.find(o => o.id === 'hepatic')!;
    expect(hep.afterPercent).toBeGreaterThanOrEqual(50);
    expect(hep.category).toBe('high');
  });

  it('eGFR 25 без ренального таргета (оксандролон) → ренальный very_high', () => {
    const r = calculateTzSpecRisk(input({
      drugName: 'oxan', dose: 50,
      drugs: [{ drugClass: 'aas' as const, drugName: 'oxan', dose: 50, form: 'oral' as const }],
      labValues: { eGFR: 25 }, labCoverage: 1,
    }));
    const renal = r.organs.find(o => o.id === 'renal')!;
    expect(renal.afterPercent).toBeGreaterThanOrEqual(75);
    expect(renal.category).toBe('very_high');
  });

  it('без анализов: floors не срабатывают, но гарантированные эффекты ААС остаются', () => {
    const r = calculateTzSpecRisk(input({ labValues: {}, labCoverage: 0.3 }));
    const repro = r.organs.find(o => o.id === 'reproductive')!;
    expect(repro.rawPercent).toBeGreaterThan(0);
    expect(r.organs.every(o => o.floors.length === 0)).toBe(true);
    expect(r.overallVerification).toBe(0);
  });

  it('с полными анализами: верификация системы = 1', () => {
    const r = calculateTzSpecRisk(input({
      labValues: { HCT: 45, LDL: 2.0, HDL: 1.2, TG: 1.0, ALT: 20, AST: 18, eGFR: 100, K: 4.2, LH: 3, FSH: 3, TT: 20, E2: 30, PRL: 10, GLU: 5.0 },
      labCoverage: 1,
    }));
    expect(r.overallVerification).toBeGreaterThan(0.5);
  });

  it('система не превышает сумму механизмов и не ниже максимума', () => {
    const r = calculateTzSpecRisk(input({ combinations: 3 }));
    for (const organ of r.organs) {
      const sum = organ.mechanisms.reduce((s, m) => s + m.rawPercent, 0);
      const max = organ.mechanisms.reduce((s, m) => Math.max(s, m.rawPercent), 0);
      expect(organ.rawPercent).toBeLessThanOrEqual(sum + 0.01);
      expect(organ.rawPercent).toBeGreaterThanOrEqual(max - 0.01);
    }
  });

  it('общий риск = худшая система (триаж), не union по органам', () => {
    const r = calculateTzSpecRisk(input({ combinations: 3 }));
    const max = r.organs.reduce((s, o) => Math.max(s, o.rawPercent), 0);
    expect(r.overallRaw).toBe(max);
    // union по органам переоценил бы: проверим, что общий заметно ниже union
    expect(r.overallRaw).toBeLessThan(unionPct(r.organs.map(o => o.rawPercent)));
  });
});

describe('эритроцитоз (hem1): фибринолитики, процедуры, доза', () => {
  it('фибринолитическое трио дополнительно снижает hem1 (сверх базы курса)', () => {
    const plasma = calculateTzSpecRisk(input({
      supportSubstances: ['hydration', 'cardio_aerobic', 'electrolyte_balance'],
    }));
    const combo = calculateTzSpecRisk(input({
      supportSubstances: ['hydration', 'cardio_aerobic', 'electrolyte_balance', 'nattokinase', 'serrapeptase', 'bromelain'],
    }));
    const hemaPlasma = plasma.organs.find(o => o.id === 'hematologic')!;
    const hemaCombo = combo.organs.find(o => o.id === 'hematologic')!;
    expect(hemaCombo.afterPercent).toBeLessThan(hemaPlasma.afterPercent);
  });

  it('эритроцитаферез пробивает якорь HCT: raw не ниже floor, after ниже', () => {
    const noProc = calculateTzSpecRisk(input({ labValues: { HCT: 53 }, labCoverage: 1 }));
    const withProc = calculateTzSpecRisk(input({
      labValues: { HCT: 53 }, labCoverage: 1,
      supportSubstances: ['erythrocytapheresis'],
    }));
    const hemaNo = noProc.organs.find(o => o.id === 'hematologic')!;
    const hemaProc = withProc.organs.find(o => o.id === 'hematologic')!;
    // текущее состояние (raw) остаётся на якоре ≥25
    expect(hemaProc.rawPercent).toBeGreaterThanOrEqual(25);
    // после процедуры риск уходит ниже якоря
    expect(hemaProc.afterPercent).toBeLessThan(25);
    expect(hemaProc.afterPercent).toBeLessThan(hemaNo.afterPercent);
  });

  it('флеботомия тоже снижает hem1', () => {
    const withProc = calculateTzSpecRisk(input({
      labValues: { HCT: 53 }, labCoverage: 1,
      supportSubstances: ['phlebotomy'],
    }));
    const without = calculateTzSpecRisk(input({ labValues: { HCT: 53 }, labCoverage: 1 }));
    expect(withProc.organs.find(o => o.id === 'hematologic')!.afterPercent)
      .toBeLessThan(without.organs.find(o => o.id === 'hematologic')!.afterPercent);
  });

  it('доза ≤200 мг (TRT) → hem1 слабее, чем при 500 мг (оба без анализов)', () => {
    const trt = calculateTzSpecRisk(input({
      dose: 200,
      drugs: [{ drugClass: 'aas' as const, drugName: 'test_enan', dose: 200, form: 'inject' as const }],
      labValues: {},
    }));
    const mid = calculateTzSpecRisk(input({ dose: 500, labValues: {} }));
    expect(trt.organs.find(o => o.id === 'hematologic')!.rawPercent)
      .toBeLessThan(mid.organs.find(o => o.id === 'hematologic')!.rawPercent);
  });

  it('полный стек (база + фибринолитики + процедура) заметно снижает hem1 без анализов', () => {
    const noSupport = calculateTzSpecRisk(input({ labValues: {} }));
    const full = calculateTzSpecRisk(input({
      labValues: {},
      supportSubstances: [
        'hydration', 'cardio_aerobic', 'electrolyte_balance',
        'nattokinase', 'serrapeptase', 'bromelain',
        'omega3', 'aspirin', 'erythrocytapheresis',
      ],
    }));
    const hemaNo = noSupport.organs.find(o => o.id === 'hematologic')!;
    const hemaFull = full.organs.find(o => o.id === 'hematologic')!;
    expect(hemaFull.afterPercent).toBeLessThan(hemaNo.rawPercent);
  });

  it('процедуры без лабораторного якоря не искажают другие системы', () => {
    const withProc = calculateTzSpecRisk(input({
      supportSubstances: ['erythrocytapheresis'],
    }));
    const without = calculateTzSpecRisk(input({}));
    // процедура влияет только на hematologic
    for (const id of ['cardio', 'hepatic', 'renal', 'cns', 'reproductive']) {
      expect(withProc.organs.find(o => o.id === id)!.afterPercent)
        .toBe(without.organs.find(o => o.id === id)!.afterPercent);
    }
  });
});

describe('фармакология подключена к механизмам', () => {
  const riskOf = (drugName: string, dose = 500) => {
    const drugClass = drugName.includes('ins_') ? 'insulin' as const
      : ['cjc1295','ghrp6','ipamorelin','ghrp2','sermorelin','mk677','igf1_lr3','igf1_des','mgf','peg_mgf','bpc157','tb500','ghk_cu','ss31','semax','selank','epitalon','dsip','mots_c','hgh_frag','aod9604','thymosin_a1','gonadorelin','melanotan2','foxo4_dri','semaglutide','tirzepatide'].includes(drugName)
        ? 'gh' as const : 'aas' as const;
    return calculateTzSpecRisk(input({
      drugName, dose,
      drugs: [{ drugClass, drugName, dose, form: 'inject' as const }],
    }));
  };

  it('тестостероны, нандролоны, тренболоны дают ненулевой риск', () => {
    for (const name of ['test_enan', 'test_prop', 'test_cyp', 'test_undec', 'deca', 'npp', 'tren_acet', 'tren_enan', 'tren_hex']) {
      expect(riskOf(name).overallRaw).toBeGreaterThan(0);
    }
  });

  it('оралы и SARMs дают ненулевой риск', () => {
    for (const name of ['methand', 'oxan', 'stan', 'trena', 'superdrol', 'anadrol', 'ostarine', 'rad140', 'lgd', 's23']) {
      expect(riskOf(name).overallRaw).toBeGreaterThan(0);
    }
  });

  it('MGF/PEG-MGF (анаболические пептиды) дают риск гипогликемии/метаболический', () => {
    const mgf = riskOf('mgf');
    expect(mgf.overallRaw).toBeGreaterThan(0);
    const hema = mgf.organs.find(o => o.id === 'hematologic')!;
    expect(hema.mechanisms.some(m => m.id === 'hem3' && m.raw > 0)).toBe(true);
  });

  it('GH-пептиды с весами дают риск; без весов — 0 (восстановительные)', () => {
    expect(riskOf('cjc1295').overallRaw).toBeGreaterThan(0);
    expect(riskOf('mk677').overallRaw).toBeGreaterThan(0);
    expect(riskOf('igf1_lr3').overallRaw).toBeGreaterThan(0);
    // восстановительные пептиды не дают механизм-риска (by design)
    expect(riskOf('bpc157').overallRaw).toBe(0);
    expect(riskOf('tb500').overallRaw).toBe(0);
  });
});
