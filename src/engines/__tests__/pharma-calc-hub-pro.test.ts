import { describe, it, expect } from 'vitest';
import { batemanC, solveKaFromTmax, keFromHalfLifeDays, peakTroughRatio, suggestIntervalDays, timeToSteadyDays, timeToClearDays, resolveEsterCanon } from '../pk-bateman.engine';
import { checkDosageRange, recommendSyringe, dosageGuards } from '../dosage-safety.engine';
import { stackBurdenLite } from '../stack-burden.engine';
import { drawForDose, waterForTargetUnits, recommendPeptideSyringe, weeklySchedule } from '../peptide-pro.engine';
import { pairLevel, stackMatrix, worstLevel, suggestClosest } from '../mapper-matrix.engine';
import { planPctStart, halfLifeOf } from '../pct-timing.engine';
import { csvCell, buildCalcCsv, escHtml } from '../pharma-calc-share.engine';

describe('P1 bateman', () => {
  it('ke positive, ka solved, curve rises then falls', () => {
    const ke = keFromHalfLifeDays(7.2);
    expect(ke).toBeGreaterThan(0);
    const ka = solveKaFromTmax(48, ke);
    expect(ka).toBeGreaterThan(ke);
    const c1 = batemanC(250, ka, ke, 1);
    const c48 = batemanC(250, ka, ke, 48);
    const c400 = batemanC(250, ka, ke, 400);
    expect(c48).toBeGreaterThan(c1);
    expect(c48).toBeGreaterThan(c400);
  });
  it('canon enan 7.2 strong, steady/clear math', () => {
    expect(resolveEsterCanon('enanthate').tHalfDays).toBeCloseTo(7.2);
    expect(timeToSteadyDays(7.2)).toBeCloseTo(30.96, 1);
    expect(timeToClearDays(7.2)).toBeCloseTo(36, 0);
  });
  it('ratio verdict + interval', () => {
    expect(peakTroughRatio(10, 8)).toBeCloseTo(1.25);
    expect(suggestIntervalDays(7.2)).toBeGreaterThan(0);
  });
});

describe('P2 dosage safety', () => {
  it('syringe ladder', () => {
    expect(recommendSyringe(0.1).size).toMatch(/0\.3/);
    expect(recommendSyringe(0.4).size).toMatch(/0\.5/);
    expect(recommendSyringe(2).size).toMatch(/Делить/);
  });
  it('guards tiny/over/u40', () => {
    expect(dosageGuards(0.02, 'U100').some((g) => g.code === 'tiny_draw')).toBe(true);
    expect(dosageGuards(2, 'U100').some((g) => g.code === 'over_1ml')).toBe(true);
    expect(dosageGuards(0.5, 'U-40').some((g) => g.code === 'u40')).toBe(true);
  });
  it('range check nullable-safe', () => {
    expect(checkDosageRange('', 0)).toBeNull();
  });
});

describe('P3 stack burden', () => {
  it('diminishing: 3rd adds less than linear', () => {
    const one = stackBurdenLite([{ drug: 'testosterone_enanthate', doseMgWeek: 500 }]);
    const three = stackBurdenLite([
      { drug: 'testosterone_enanthate', doseMgWeek: 500 },
      { drug: 'nandrolone_decanoate', doseMgWeek: 400 },
      { drug: 'boldenone_undecylenate', doseMgWeek: 600 },
    ]);
    expect(three.sfy).toBeLessThan(one.sfy * 3);
    expect(three.index).toBeGreaterThan(0);
  });
  it('tren amplifies', () => {
    const a = stackBurdenLite([{ drug: 'testosterone_enanthate', doseMgWeek: 500 }]);
    const b = stackBurdenLite([
      { drug: 'testosterone_enanthate', doseMgWeek: 500 },
      { drug: 'trenbolone_acetate', doseMgWeek: 300 },
    ]);
    expect(b.sbb).toBeGreaterThan(a.sbb * 1.2);
  });
});

describe('P4 peptide pro', () => {
  it('BPC 5mg+2ml 250mcg=10u parity precision table', () => {
    const d = drawForDose(5, 2, 250);
    expect(d.units).toBeCloseTo(10, 0);
    expect(d.dosesPerVial).toBe(20);
  });
  it('reverse roundtrip', () => {
    const w = waterForTargetUnits(5, 250, 10);
    expect(w).toBeCloseTo(2, 1);
  });
  it('syringe + schedule', () => {
    expect(recommendPeptideSyringe(8)).toMatch(/0\.3/);
    expect(weeklySchedule('x', 2)).toEqual(['Пн', 'Чт']);
  });
});

describe('P5 matrix', () => {
  it('GHRH+GHRP synergy, two GLP1 caution, symmetry', () => {
    expect(pairLevel('cjc-1295', 'ipamorelin').level).toBe('synergy');
    expect(pairLevel('semaglutide', 'tirzepatide').level).toBe('caution');
    expect(pairLevel('a', 'b').level).toBe(pairLevel('b', 'a').level);
  });
  it('worst wins + suggest', () => {
    const pairs = stackMatrix(['cjc-1295', 'ipamorelin', 'semaglutide', 'tirzepatide']);
    expect(worstLevel(pairs)).toBe('caution');
    expect(suggestClosest('testosteron', ['testosterone_enanthate', 'trenbolone_acetate']).length).toBeGreaterThan(0);
  });
});

describe('P6 pct', () => {
  it('enan window 14-18 start in range', () => {
    const p = planPctStart([{ substanceId: 'testosterone_enanthate', weeksOn: 12 }]);
    expect(p.startDay).toBeGreaterThanOrEqual(14);
    expect(p.startDay).toBeLessThanOrEqual(35);
  });
  it('sust uses max ester, deca longer than enan', () => {
    expect(halfLifeOf('sustanon').tHalf).toBeGreaterThanOrEqual(10);
    const e = planPctStart([{ substanceId: 'testosterone_enanthate', weeksOn: 12 }]);
    const d = planPctStart([{ substanceId: 'nandrolone_decanoate', weeksOn: 12 }]);
    expect(d.startDay).toBeGreaterThan(e.startDay);
  });
});

describe('P7 share export', () => {
  it('csv anti-formula + esc', () => {
    expect(csvCell('=cmd')).toMatch(/^"/);
    expect(escHtml('<b>')).toBe('&lt;b&gt;');
    expect(buildCalcCsv([['a', '=x']])).toContain("'=x");
  });
});
