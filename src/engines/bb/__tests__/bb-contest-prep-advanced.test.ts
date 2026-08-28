import { describe, it, expect } from 'vitest';
import { buildBBContestPrepPlan, buildPeakWeek, PER_MUSCLE_TAPER_MULT, getPerMuscleTaperMult, validateBBContestPrepConfig } from '../bb-contest-prep.engine';
import { computeMuscleBalance } from '../bb-volume.engine';

function baseCfg(overrides: any = {}) {
  return {
    sex: 'male' as const,
    category: 'mens_bb' as const,
    weightKg: 90,
    bodyFatPct: 12,
    age: 28,
    experienceLevel: 'intermediate' as const,
    enhanced: false,
    prepCount: 1,
    showDate: '2026-10-10',
    weeksOut: 3,
    trainingProtocol: 'bb' as const,
    carbLoadStrategy: 'moderate' as const,
    waterStrategy: 'minimal' as const,
    sodiumStrategy: 'constant' as const,
    ...overrides,
  };
}

describe('PED дозозависимость', () => {
  it('GH >4 увеличивает воду', () => {
    const cfgNoGH = baseCfg({ waterStrategy: 'moderate' as const });
    const cfgGH = baseCfg({ waterStrategy: 'moderate' as const, pedContext: { ghIU: 6 } });
    const peakNoGH = buildPeakWeek(cfgNoGH);
    const peakGH = buildPeakWeek(cfgGH);
    expect(peakGH[0].waterLiters).toBeGreaterThan(peakNoGH[0].waterLiters);
  });

  it('tren >200 увеличивает натрий', () => {
    const cfgNoTren = baseCfg({ sodiumStrategy: 'cut_2d' as const });
    const cfgTren = baseCfg({ sodiumStrategy: 'cut_2d' as const, pedContext: { trenMg: 300 } });
    const peakNoTren = buildPeakWeek(cfgNoTren);
    const peakTren = buildPeakWeek(cfgTren);
    expect(peakTren[4].sodiumMg).toBeGreaterThan(peakNoTren[4].sodiumMg);
  });

  it('diuretic дает warning', () => {
    const cfg = baseCfg({ pedContext: { diuretic: true }, waterStrategy: 'classic' as const, confirmedManipulation: true });
    const plan = buildBBContestPrepPlan(cfg, { prepWeeks: 8 });
    expect(plan.safety.warnings.some(w => /Диуретик/i.test(w))).toBe(true);
  });
});

describe('Возраст', () => {
  it('age>40 дает warning', () => {
    const cfg = baseCfg({ age: 45 });
    const plan = buildBBContestPrepPlan(cfg, { prepWeeks: 8 });
    expect(plan.safety.warnings.some(w => /Возраст 45/i.test(w))).toBe(true);
  });

  it('age<40 не дает warning', () => {
    const cfg = baseCfg({ age: 30 });
    const plan = buildBBContestPrepPlan(cfg, { prepWeeks: 8 });
    expect(plan.safety.warnings.some(w => /Возраст/i.test(w))).toBe(false);
  });
});

describe('Per-muscle taper', () => {
  it('ноги режутся сильнее груди', () => {
    const legs = getPerMuscleTaperMult('quads', 2);
    const chest = getPerMuscleTaperMult('chest', 2);
    expect(legs).toBeLessThan(chest);
  });

  it('таблица per-muscle完整', () => {
    expect(PER_MUSCLE_TAPER_MULT.quads).toEqual([0.90, 0.75, 0.55, 0.45]);
    expect(PER_MUSCLE_TAPER_MULT.chest).toEqual([0.95, 0.85, 0.70, 0.60]);
  });

  it('неизвестная мышца fallback to chest', () => {
    expect(getPerMuscleTaperMult('unknown_muscle_xyz', 1)).toBe(PER_MUSCLE_TAPER_MULT.chest[1]);
  });
});

describe('Баланс мышц', () => {
  it('chest/back дисбаланс', () => {
    const weekly = {
      chest: { effectiveSets: 22 },
      back: { effectiveSets: 10 },
      quads: { effectiveSets: 12 },
      hamstrings: { effectiveSets: 12 },
    };
    const res = computeMuscleBalance(weekly);
    expect(res.issues.some(s => /грудь\/спина/i.test(s))).toBe(true);
    expect(res.ratios['chest/back']).toBeCloseTo(2.2, 1);
  });

  it('сбалансированный не дает issues', () => {
    const weekly = {
      chest: { effectiveSets: 12 },
      back: { effectiveSets: 12 },
      quads: { effectiveSets: 10 },
      hamstrings: { effectiveSets: 10 },
      triceps: { effectiveSets: 6 },
      biceps: { effectiveSets: 6 },
      shoulders: { effectiveSets: 0 },
      delt_front: { effectiveSets: 4 },
      delt_rear: { effectiveSets: 4 },
    };
    const res = computeMuscleBalance(weekly);
    console.log('BALANCE', res);
    expect(res.issues.length).toBe(0);
  });
});

describe('prepWeeks в профиле', () => {
  it('cfg.prepWeeks приоритет', () => {
    const cfg = baseCfg({ prepWeeks: 16 });
    const plan = buildBBContestPrepPlan(cfg, { prepWeeks: 8 });
    // opts prepWeeks 8 должен переопределить cfg 16
    expect(plan.preparation.weeks).toBe(8);
    const plan2 = buildBBContestPrepPlan(cfg, {});
    expect(plan2.preparation.weeks).toBe(16);
  });
});
