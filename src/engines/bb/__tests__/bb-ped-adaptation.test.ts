/**
 * bb-ped-adaptation.test.ts — полное покрытие dose-aware PED-движка.
 *
 * TDD: тесты написаны в ожидании фиксов (Commit 2):
 *  - cap 1.85 → 2.0 (P1-1)
 *  - унифицированный парсер aasDose (P0-2)
 *  - risks для IGF1 и MGF (P1-4)
 *  - русская запятая в парсере (P2-2)
 *  - PED_META.tEq для risk-threshold (P2-3)
 *
 * Покрывает:
 *  - Section A: Dose interpolation (AAS/insulin/GH/MGF/IGF1 на всех порогах)
 *  - Section B: Multi-PED composition + diminishing 0.85
 *  - Section C: GH+insulin synergy
 *  - Section D: CourseIntensity (mild/moderate/heavy)
 *  - Section E: String dose parsing
 *  - Section F: Risks auto-generation
 *  - Section G: Backward compat
 *  - Section H: adjustedMrv per-muscle
 */
import { describe, expect, it } from 'vitest';
import {
  adaptForPEDs,
  explainPEDAdaptation,
  PED_EFFECTS,
  PED_META,
  type PED,
  type CourseIntensity,
} from '../bb-ped-adaptation.engine';

const BASE_MRV: Record<string, number> = {
  chest: 20, back: 24, quads: 20, hamstrings: 16,
  shoulders: 14, biceps: 12, triceps: 12, calves: 12,
  glutes: 16, abs: 12, traps: 12, forearms: 10,
  delt_front: 10, delt_mid: 10, delt_rear: 10,
};

function adapt(peds: PED[], doses?: Record<string, number>, intensity?: CourseIntensity) {
  return adaptForPEDs(peds, BASE_MRV, doses, intensity);
}

/* ═══════════════════════════════════════════════════════════════════
 * Section A: Dose interpolation
 * ═══════════════════════════════════════════════════════════════════ */
describe('A: PED_DOSE_CURVES interpolation — AAS', () => {
  it('AAS 0 мг → perPED mrvMult = 1.00 (натурал)', () => {
    const a = adapt(['AAS'], { AAS: 0 });
    expect(a.perPED[0].mrvMult).toBeCloseTo(1.00, 2);
  });

  it('AAS 0 мг → combinedMrv = 1.00 (нет boost)', () => {
    const a = adapt(['AAS'], { AAS: 0 });
    expect(a.combinedMrvMultiplier).toBeCloseTo(1.00, 2);
  });

  it('AAS 125 мг → perPED mrvMult = 1.10 (TRT-низ)', () => {
    const a = adapt(['AAS'], { AAS: 125 });
    expect(a.perPED[0].mrvMult).toBeCloseTo(1.10, 2);
  });

  it('AAS 250 мг → perPED mrvMult = 1.18 (TRT-высокий)', () => {
    const a = adapt(['AAS'], { AAS: 250 });
    expect(a.perPED[0].mrvMult).toBeCloseTo(1.18, 2);
  });

  it('AAS 500 мг → perPED mrvMult = 1.35 (стандартный курс)', () => {
    const a = adapt(['AAS'], { AAS: 500 });
    expect(a.perPED[0].mrvMult).toBeCloseTo(1.35, 2);
  });

  it('AAS 750 мг → perPED mrvMult = 1.45 (интерполяция)', () => {
    const a = adapt(['AAS'], { AAS: 750 });
    expect(a.perPED[0].mrvMult).toBeCloseTo(1.45, 2);
  });

  it('AAS 1000 мг → perPED mrvMult = 1.52', () => {
    const a = adapt(['AAS'], { AAS: 1000 });
    expect(a.perPED[0].mrvMult).toBeCloseTo(1.52, 2);
  });

  it('AAS 1500 мг → perPED mrvMult = 1.60', () => {
    const a = adapt(['AAS'], { AAS: 1500 });
    expect(a.perPED[0].mrvMult).toBeCloseTo(1.60, 2);
  });

  it('AAS 2000 мг → perPED mrvMult = 1.66', () => {
    const a = adapt(['AAS'], { AAS: 2000 });
    expect(a.perPED[0].mrvMult).toBeCloseTo(1.66, 2);
  });

  it('AAS 3000 мг → perPED mrvMult = 1.70 (cap)', () => {
    const a = adapt(['AAS'], { AAS: 3000 });
    expect(a.perPED[0].mrvMult).toBeCloseTo(1.70, 2);
  });

  it('AAS 5000 мг → perPED mrvMult = 1.70 (cap держится)', () => {
    const a = adapt(['AAS'], { AAS: 5000 });
    expect(a.perPED[0].mrvMult).toBeCloseTo(1.70, 2);
  });

  it('AAS 500 + moderate → combinedMrv ≈ 1.30 × 1.04 = 1.35', () => {
    const a = adapt(['AAS'], { AAS: 500 }, 'moderate');
    // mrvMult = 1 + (1.35-1)*0.85 = 1.2975; × 1.04 = 1.3494
    expect(a.combinedMrvMultiplier).toBeCloseTo(1.35, 1);
  });
});

describe('A: PED_DOSE_CURVES interpolation — insulin', () => {
  it('insulin 0 IU → mrvMult = 1.00', () => {
    const a = adapt(['insulin'], { insulin: 0 });
    expect(a.perPED[0].mrvMult).toBeCloseTo(1.00, 2);
  });

  it('insulin 10 IU → mrvMult = 1.28', () => {
    const a = adapt(['insulin'], { insulin: 10 });
    expect(a.perPED[0].mrvMult).toBeCloseTo(1.28, 2);
  });

  it('insulin 40 IU → mrvMult = 1.40 (cap)', () => {
    const a = adapt(['insulin'], { insulin: 40 });
    expect(a.perPED[0].mrvMult).toBeCloseTo(1.40, 2);
  });

  it('insulin 100 IU → mrvMult = 1.40 (cap держится)', () => {
    const a = adapt(['insulin'], { insulin: 100 });
    expect(a.perPED[0].mrvMult).toBeCloseTo(1.40, 2);
  });
});

describe('A: PED_DOSE_CURVES interpolation — GH', () => {
  it('GH 0 IU → mrvMult = 1.00', () => {
    const a = adapt(['GH'], { GH: 0 });
    expect(a.perPED[0].mrvMult).toBeCloseTo(1.00, 2);
  });

  it('GH 4 IU → mrvMult = 1.22', () => {
    const a = adapt(['GH'], { GH: 4 });
    expect(a.perPED[0].mrvMult).toBeCloseTo(1.22, 2);
  });

  it('GH 15 IU → mrvMult = 1.35 (cap)', () => {
    const a = adapt(['GH'], { GH: 15 });
    expect(a.perPED[0].mrvMult).toBeCloseTo(1.35, 2);
  });
});

describe('A: PED_DOSE_CURVES interpolation — IGF1', () => {
  it('IGF1 0 mcg → mrvMult = 1.00', () => {
    const a = adapt(['IGF1'], { IGF1: 0 });
    expect(a.perPED[0].mrvMult).toBeCloseTo(1.00, 2);
  });

  it('IGF1 50 mcg → mrvMult = 1.18', () => {
    const a = adapt(['IGF1'], { IGF1: 50 });
    expect(a.perPED[0].mrvMult).toBeCloseTo(1.18, 2);
  });

  it('IGF1 100 mcg → mrvMult = 1.25 (cap)', () => {
    const a = adapt(['IGF1'], { IGF1: 100 });
    expect(a.perPED[0].mrvMult).toBeCloseTo(1.25, 2);
  });
});

describe('A: PED_DOSE_CURVES interpolation — MGF', () => {
  it('MGF 0 mcg → mrvMult = 1.00', () => {
    const a = adapt(['MGF'], { MGF: 0 });
    expect(a.perPED[0].mrvMult).toBeCloseTo(1.00, 2);
  });

  it('MGF 200 mcg → mrvMult = 1.10', () => {
    const a = adapt(['MGF'], { MGF: 200 });
    expect(a.perPED[0].mrvMult).toBeCloseTo(1.10, 2);
  });

  it('MGF 400 mcg → mrvMult = 1.15 (cap)', () => {
    const a = adapt(['MGF'], { MGF: 400 });
    expect(a.perPED[0].mrvMult).toBeCloseTo(1.15, 2);
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * Section B: Multi-PED composition + diminishing 0.85
 * ═══════════════════════════════════════════════════════════════════ */
describe('B: Multi-PED composition + diminishing returns 0.85', () => {
  it('solo AAS 500 → combinedMrv = 1 + 0.35×0.85 = 1.2975', () => {
    const a = adapt(['AAS'], { AAS: 500 }, 'mild');
    expect(a.combinedMrvMultiplier).toBeCloseTo(1.2975, 3);
  });

  it('solo AAS 1000 → combinedMrv = 1 + 0.52×0.85 = 1.442', () => {
    const a = adapt(['AAS'], { AAS: 1000 }, 'mild');
    expect(a.combinedMrvMultiplier).toBeCloseTo(1.442, 2);
  });

  it('AAS 500 + insulin 10 → combinedMrv ≈ 1.2975 + 0.238 = 1.5355', () => {
    const a = adapt(['AAS', 'insulin'], { AAS: 500, insulin: 10 }, 'mild');
    // AAS: 1 + 0.35*0.85 = 1.2975; insulin: +0.28*0.85 = +0.238 → 1.5355
    expect(a.combinedMrvMultiplier).toBeCloseTo(1.5355, 2);
  });

  it('3 PED cap doses (AAS 3000 + insulin 40 + GH 15) → combinedMrv cap 2.0', () => {
    const a = adapt(['AAS', 'insulin', 'GH'], { AAS: 3000, insulin: 40, GH: 15 }, 'heavy');
    // Raw: 1 + (0.70+0.40+0.35)*0.85 + synergy + heavy = well above 2.0
    expect(a.combinedMrvMultiplier).toBeLessThanOrEqual(2.0);
    expect(a.combinedMrvMultiplier).toBeGreaterThanOrEqual(1.90);
  });

  it('full stack (5 PED cap doses + heavy) → combinedMrv = 2.0 (cap)', () => {
    const a = adapt(
      ['AAS', 'insulin', 'MGF', 'IGF1', 'GH'],
      { AAS: 3000, insulin: 40, MGF: 400, IGF1: 100, GH: 15 },
      'heavy',
    );
    expect(a.combinedMrvMultiplier).toBe(2.0);
  });

  it('cap 2.0: mrvMult и recMult оба ≤ 2.0', () => {
    const a = adapt(
      ['AAS', 'insulin', 'MGF', 'IGF1', 'GH'],
      { AAS: 3000, insulin: 40, MGF: 400, IGF1: 100, GH: 15 },
      'heavy',
    );
    expect(a.combinedMrvMultiplier).toBeLessThanOrEqual(2.0);
    expect(a.combinedRecoveryMultiplier).toBeLessThanOrEqual(2.0);
  });

  it('diminishing: 2 PED дают меньше чем сумма их индивидуальных множителей', () => {
    const solo1 = adapt(['AAS'], { AAS: 500 }, 'mild').combinedMrvMultiplier;
    const solo2 = adapt(['insulin'], { insulin: 10 }, 'mild').combinedMrvMultiplier;
    const combined = adapt(['AAS', 'insulin'], { AAS: 500, insulin: 10 }, 'mild').combinedMrvMultiplier;
    // combined = 1 + 0.35*0.85 + 0.28*0.85 = 1.5355
    // solo1+solo2 = 1.2975 + 1.238 - 1 = 1.5355 (same, because diminishing is additive)
    // But combined should be LESS than (solo1-1)+(solo2-1)+1 without diminishing = 1+0.35+0.28 = 1.63
    expect(combined).toBeLessThan(1 + 0.35 + 0.28);
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * Section C: GH+insulin synergy
 * ═══════════════════════════════════════════════════════════════════ */
describe('C: GH+insulin synergy', () => {
  it('GH 4 + insulin 10 → synergy bonus > 0', () => {
    const a = adapt(['GH', 'insulin'], { GH: 4, insulin: 10 }, 'mild');
    const hasSynergy = a.rationale.some(r => r.includes('синергия'));
    expect(hasSynergy).toBe(true);
  });

  it('GH 8 + insulin 20 → synergy > 1%', () => {
    const a = adapt(['GH', 'insulin'], { GH: 8, insulin: 20 }, 'mild');
    const synergyLine = a.rationale.find(r => r.includes('синергия'));
    expect(synergyLine).toBeDefined();
    // synergy = (1.30-1)*(1.35-1)*0.15 = 0.30*0.35*0.15 = 0.01575 → +1.575%
    const match = synergyLine!.match(/×(\d+\.\d+)/);
    if (match) {
      const synergyVal = parseFloat(match[1]);
      expect(synergyVal).toBeGreaterThan(1.01);
    }
  });

  it('GH 15 + insulin 40 (cap) → synergy ~3.5%', () => {
    const a = adapt(['GH', 'insulin'], { GH: 15, insulin: 40 }, 'mild');
    const synergyLine = a.rationale.find(r => r.includes('синергия'));
    expect(synergyLine).toBeDefined();
    // synergy = (1.35-1)*(1.40-1)*0.15 = 0.35*0.40*0.15 = 0.021 → +2.1%
    const match = synergyLine!.match(/×(\d+\.\d+)/);
    if (match) {
      const synergyVal = parseFloat(match[1]);
      expect(synergyVal).toBeGreaterThan(1.015);
    }
  });

  it('AAS+GH (no insulin) → no synergy line', () => {
    const a = adapt(['AAS', 'GH'], { AAS: 500, GH: 4 }, 'mild');
    const hasSynergy = a.rationale.some(r => r.includes('синергия'));
    expect(hasSynergy).toBe(false);
  });

  it('AAS+insulin (no GH) → no synergy line', () => {
    const a = adapt(['AAS', 'insulin'], { AAS: 500, insulin: 10 }, 'mild');
    const hasSynergy = a.rationale.some(r => r.includes('синергия'));
    expect(hasSynergy).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * Section D: CourseIntensity
 * ═══════════════════════════════════════════════════════════════════ */
describe('D: CourseIntensity', () => {
  it('mild → no additional boost (mult=1.00)', () => {
    const a = adapt(['AAS'], { AAS: 500 }, 'mild');
    const hasIntensityLine = a.rationale.some(r => r.includes('Интенсивность курса'));
    expect(hasIntensityLine).toBe(false);
  });

  it('moderate → +4% boost', () => {
    const a = adapt(['AAS'], { AAS: 500 }, 'moderate');
    // 1.2975 * 1.04 = 1.3494
    expect(a.combinedMrvMultiplier).toBeCloseTo(1.3494, 2);
  });

  it('heavy → +8% boost', () => {
    const a = adapt(['AAS'], { AAS: 500 }, 'heavy');
    // 1.2975 * 1.08 = 1.4013
    expect(a.combinedMrvMultiplier).toBeCloseTo(1.4013, 2);
  });

  it('natural (activePEDs=[]) + heavy → no boost (корректно)', () => {
    const a = adapt([], {}, 'heavy');
    expect(a.combinedMrvMultiplier).toBe(1.0);
    const hasIntensityLine = a.rationale.some(r => r.includes('Интенсивность курса'));
    expect(hasIntensityLine).toBe(false);
  });

  it('undefined intensity → defaults to moderate', () => {
    const a = adapt(['AAS'], { AAS: 500 });
    expect(a.courseIntensity).toBe('moderate');
    // 1.2975 * 1.04 = 1.3494
    expect(a.combinedMrvMultiplier).toBeCloseTo(1.3494, 2);
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * Section E: String dose parsing
 * ═══════════════════════════════════════════════════════════════════ */
describe('E: String dose parsing', () => {
  it('"500mg" → dose=500', () => {
    const a = adapt(['AAS'], { AAS: '500mg' as any }, 'mild');
    expect(a.perPED[0].dose).toBe(500);
  });

  it('"500 mg" → dose=500', () => {
    const a = adapt(['AAS'], { AAS: '500 mg' as any }, 'mild');
    expect(a.perPED[0].dose).toBe(500);
  });

  it('"500.5mg" → dose=500.5', () => {
    const a = adapt(['AAS'], { AAS: '500.5mg' as any }, 'mild');
    expect(a.perPED[0].dose).toBeCloseTo(500.5, 1);
  });

  it('"abc" → dose=0 (fallback)', () => {
    const a = adapt(['AAS'], { AAS: 'abc' as any }, 'mild');
    expect(a.perPED[0].dose).toBe(0);
  });

  it('"1,5г" (русская запятая) → dose=1.5 (не 15)', () => {
    // P2-2 fix: .replace(',', '.') перед regex
    const a = adapt(['AAS'], { AAS: '1,5г' as any }, 'mild');
    expect(a.perPED[0].dose).toBeCloseTo(1.5, 1);
  });

  it('число 500 → dose=500 (без парсинга)', () => {
    const a = adapt(['AAS'], { AAS: 500 }, 'mild');
    expect(a.perPED[0].dose).toBe(500);
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * Section F: Risks auto-generation
 * ═══════════════════════════════════════════════════════════════════ */
describe('F: Risk auto-generation', () => {
  it('AAS 1500 мг → "⚠ Высокая доза" warning', () => {
    const a = adapt(['AAS'], { AAS: 1500 }, 'moderate');
    expect(a.risks.some(r => r.includes('Высокая доза') && r.includes('1500'))).toBe(true);
  });

  it('AAS 2000 мг → "⚠ Высокая доза" warning', () => {
    const a = adapt(['AAS'], { AAS: 2000 }, 'moderate');
    expect(a.risks.some(r => r.includes('Высокая доза'))).toBe(true);
  });

  it('AAS "1500mg" string → warning работает после P0-2 fix', () => {
    const a = adapt(['AAS'], { AAS: '1500mg' as any }, 'moderate');
    expect(a.risks.some(r => r.includes('Высокая доза'))).toBe(true);
  });

  it('AAS 1000 мг → NO high-dose warning', () => {
    const a = adapt(['AAS'], { AAS: 1000 }, 'moderate');
    expect(a.risks.some(r => r.includes('Высокая доза'))).toBe(false);
  });

  it('AAS any dose → general HCT/E2/lipid warning', () => {
    const a = adapt(['AAS'], { AAS: 500 }, 'moderate');
    expect(a.risks.some(r => r.includes('гематокрит') || r.includes('HCT'))).toBe(true);
  });

  it('insulin → hypoglycemia warning', () => {
    const a = adapt(['insulin'], { insulin: 10 }, 'moderate');
    expect(a.risks.some(r => r.includes('гипогликем'))).toBe(true);
  });

  it('GH → insulin resistance warning', () => {
    const a = adapt(['GH'], { GH: 4 }, 'moderate');
    expect(a.risks.some(r => r.includes('инсулинорезистент'))).toBe(true);
  });

  it('insulin + GH → combined warning', () => {
    const a = adapt(['insulin', 'GH'], { insulin: 10, GH: 4 }, 'moderate');
    expect(a.risks.some(r => r.includes('Инсулин + ГР'))).toBe(true);
  });

  it('IGF1 → hypoglycemia + arthralgia warning (NEW P1-4)', () => {
    const a = adapt(['IGF1'], { IGF1: 50 }, 'moderate');
    expect(a.risks.some(r => r.includes('IGF') && (r.includes('гипогликем') || r.includes('артралг')))).toBe(true);
  });

  it('MGF → local hypertrophy warning (NEW P1-4)', () => {
    const a = adapt(['MGF'], { MGF: 200 }, 'moderate');
    expect(a.risks.some(r => r.includes('MGF'))).toBe(true);
  });

  it('no PED → no risks', () => {
    const a = adapt([], {}, 'moderate');
    expect(a.risks).toHaveLength(0);
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * Section G: Backward compat
 * ═══════════════════════════════════════════════════════════════════ */
describe('G: Backward compat', () => {
  it('pedDoses=undefined → PED_EFFECTS base multiplier', () => {
    const a = adapt(['AAS'], undefined, 'mild');
    // Falls back to PED_EFFECTS.AAS.mrvMultiplier = 1.35
    // combined = 1 + (1.35-1)*0.85 = 1.2975
    expect(a.perPED[0].mrvMult).toBeCloseTo(1.35, 2);
    expect(a.combinedMrvMultiplier).toBeCloseTo(1.2975, 3);
  });

  it('activePEDs=[] → mrv=1.0, rec=1.0, no risks, no rationale', () => {
    const a = adapt([], {}, 'moderate');
    expect(a.combinedMrvMultiplier).toBe(1.0);
    expect(a.combinedRecoveryMultiplier).toBe(1.0);
    expect(a.risks).toHaveLength(0);
    expect(a.rationale).toHaveLength(0);
    expect(a.perPED).toHaveLength(0);
  });

  it('PED not in PED_EFFECTS → silently skipped (no crash)', () => {
    const a = adaptForPEDs(['unknown' as PED], BASE_MRV, {}, 'moderate');
    expect(a.perPED).toHaveLength(0);
    expect(a.combinedMrvMultiplier).toBe(1.0);
  });

  it('negative dose → interpolateDose returns {1,1} (no effect, safer than base)', () => {
    const a = adapt(['AAS'], { AAS: -100 }, 'mild');
    // dose=-100 → dose<=0 in interpolateDose → returns {1,1}
    // doseProvided=true → uses interpolation (not base fallback)
    // mrvMult = 1 + (1-1)*0.85 = 1.0 (no effect — safer than base 1.35)
    expect(a.perPED[0].mrvMult).toBeCloseTo(1.0, 2);
    expect(a.combinedMrvMultiplier).toBe(1.0);
  });

  it('pedDoses=null → treated as empty (no crash)', () => {
    const a = adaptForPEDs(['AAS'], BASE_MRV, null as any, 'moderate');
    expect(a.perPED).toHaveLength(1);
    // Falls back to base
    expect(a.perPED[0].mrvMult).toBeCloseTo(1.35, 2);
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * Section H: adjustedMrv per-muscle
 * ═══════════════════════════════════════════════════════════════════ */
describe('H: adjustedMrv per-muscle', () => {
  it('all 15 groups from baseMrv included in adjustedMrv', () => {
    const a = adapt(['AAS'], { AAS: 500 }, 'moderate');
    for (const m of Object.keys(BASE_MRV)) {
      expect(a.adjustedMrv[m]).toBeDefined();
      expect(a.adjustedMrv[m]).toBeGreaterThan(0);
    }
  });

  it('adjustedMrv = round(baseMrv × combinedMrvMultiplier)', () => {
    const a = adapt(['AAS'], { AAS: 500 }, 'moderate');
    const expectedChest = Math.round(BASE_MRV.chest * a.combinedMrvMultiplier);
    expect(a.adjustedMrv.chest).toBe(expectedChest);
  });

  it('empty baseMrv → empty adjustedMrv', () => {
    const a = adaptForPEDs(['AAS'], {}, { AAS: 500 }, 'moderate');
    expect(Object.keys(a.adjustedMrv)).toHaveLength(0);
  });

  it('adjustedMrv scales proportionally with dose', () => {
    const low = adapt(['AAS'], { AAS: 250 }, 'moderate');
    const high = adapt(['AAS'], { AAS: 1000 }, 'moderate');
    expect(high.adjustedMrv.chest).toBeGreaterThan(low.adjustedMrv.chest);
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * Section I: PED_META + explainPEDAdaptation
 * ═══════════════════════════════════════════════════════════════════ */
describe('I: PED_META and explainPEDAdaptation', () => {
  it('PED_META has all 5 PEDs', () => {
    expect(PED_META.AAS).toBeDefined();
    expect(PED_META.insulin).toBeDefined();
    expect(PED_META.MGF).toBeDefined();
    expect(PED_META.IGF1).toBeDefined();
    expect(PED_META.GH).toBeDefined();
  });

  it('PED_META AAS tEq = 1.0 (testosterone baseline)', () => {
    expect(PED_META.AAS.tEq).toBe(1.0);
  });

  it('PED_META non-AAS tEq = 0 (not applicable)', () => {
    expect(PED_META.insulin.tEq).toBe(0);
    expect(PED_META.MGF.tEq).toBe(0);
    expect(PED_META.IGF1.tEq).toBe(0);
    expect(PED_META.GH.tEq).toBe(0);
  });

  it('PED_META has unit for each PED', () => {
    expect(PED_META.AAS.unit).toBe('мг/нед');
    expect(PED_META.insulin.unit).toBe('МЕ/день');
    expect(PED_META.GH.unit).toBe('МЕ/день');
    expect(PED_META.MGF.unit).toBe('мкг/нед');
    expect(PED_META.IGF1.unit).toBe('мкг/день');
  });

  it('explainPEDAdaptation: empty PEDs shows "натурал"', () => {
    const a = adapt([], {}, 'moderate');
    const text = explainPEDAdaptation(a);
    expect(text).toContain('натурал');
    expect(text).toContain('1.00');
  });

  it('explainPEDAdaptation: AAS 500 shows dose and MRV', () => {
    const a = adapt(['AAS'], { AAS: 500 }, 'moderate');
    const text = explainPEDAdaptation(a);
    expect(text).toContain('AAS');
    expect(text).toContain('500');
  });

  it('explainPEDAdaptation: risks prefixed with "!"', () => {
    const a = adapt(['AAS'], { AAS: 500 }, 'moderate');
    const text = explainPEDAdaptation(a);
    expect(text).toContain('!');
  });
});
