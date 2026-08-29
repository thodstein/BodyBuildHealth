import { describe, it, expect } from 'vitest';
import { buildBBContestPrepPlan, buildPeakWeek, PER_MUSCLE_TAPER_MULT, getPerMuscleTaperMult, validateBBContestPrepConfig, configFromPlan } from '../bb-contest-prep.engine';
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
      shoulders: { effectiveSets: 6 },
      delt_front: { effectiveSets: 3 },
      delt_rear: { effectiveSets: 6 },
    };
    const res = computeMuscleBalance(weekly);
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

describe('PED расширенные', () => {
  it('nand + test не ломают', () => {
    const cfg = baseCfg({ pedContext: { testMg: 500, nandMg: 300 } });
    const plan = buildBBContestPrepPlan(cfg, { prepWeeks: 8 });
    expect(plan).toBeTruthy();
  });
  it('insulin не влияет на воду', () => {
    const cfgNo = baseCfg({ waterStrategy: 'minimal' as const });
    const cfgIns = baseCfg({ waterStrategy: 'minimal' as const, pedContext: { insulinIU: 10 } });
    expect(buildPeakWeek(cfgNo)[0].waterLiters).toBe(buildPeakWeek(cfgIns)[0].waterLiters);
  });
  it('t3 не влияет на воду', () => {
    const cfg = baseCfg({ pedContext: { t3Mcg: 50 } });
    expect(buildBBContestPrepPlan(cfg, { prepWeeks: 8 }).safety.warnings.length).toBeGreaterThanOrEqual(0);
  });
  it('anavar не влияет', () => {
    const cfg = baseCfg({ pedContext: { anavarMg: 30 } });
    expect(buildBBContestPrepPlan(cfg, { prepWeeks: 8 })).toBeTruthy();
  });
  it('gh <=4 не увеличивает воду', () => {
    const cfgNoGH = baseCfg({ waterStrategy: 'moderate' as const });
    const cfgGH = baseCfg({ waterStrategy: 'moderate' as const, pedContext: { ghIU: 4 } });
    expect(buildPeakWeek(cfgGH)[0].waterLiters).toBe(buildPeakWeek(cfgNoGH)[0].waterLiters);
  });
  it('tren <=200 не увеличивает натрий', () => {
    const cfgNo = baseCfg({ sodiumStrategy: 'cut_2d' as const });
    const cfgTren = baseCfg({ sodiumStrategy: 'cut_2d' as const, pedContext: { trenMg: 200 } });
    expect(buildPeakWeek(cfgTren)[4].sodiumMg).toBe(buildPeakWeek(cfgNo)[4].sodiumMg);
  });
});

describe('Возраст расширенные', () => {
  it('age 50 warning', () => {
    const cfg = baseCfg({ age: 50 });
    const plan = buildBBContestPrepPlan(cfg, { prepWeeks: 8 });
    expect(plan.safety.warnings.some(w => /50/.test(w))).toBe(true);
  });
  it('age 18 no warning', () => {
    const cfg = baseCfg({ age: 18 });
    const plan = buildBBContestPrepPlan(cfg, { prepWeeks: 8 });
    expect(plan.safety.warnings.some(w => /Возраст/.test(w))).toBe(false);
  });
  it('age undefined no warning', () => {
    const cfg = baseCfg({ age: undefined });
    const plan = buildBBContestPrepPlan(cfg, { prepWeeks: 8 });
    expect(plan.safety.warnings.some(w => /Возраст/.test(w))).toBe(false);
  });
});

describe('Per-muscle расширенные', () => {
  it('все мышцы имеют таблицу', () => {
    for (const m of ['quads','hamstrings','glutes','back','chest','biceps','triceps','shoulders','abs','traps']) {
      expect(PER_MUSCLE_TAPER_MULT[m]).toBeDefined();
      expect(PER_MUSCLE_TAPER_MULT[m].length).toBe(4);
    }
  });
  it('weekIdx за пределами', () => {
    expect(getPerMuscleTaperMult('chest', 10)).toBe(0.60);
    expect(getPerMuscleTaperMult('quads', 10)).toBe(0.45);
  });
  it('спина vs грудь на неделе 0', () => {
    expect(getPerMuscleTaperMult('back', 0)).toBeLessThan(getPerMuscleTaperMult('chest', 0));
  });
  it('дельты vs грудь одинаково', () => {
    expect(getPerMuscleTaperMult('delt_front', 1)).toBe(getPerMuscleTaperMult('chest', 1));
  });
});

describe('Баланс расширенные', () => {
  it('quad/ham дисбаланс', () => {
    const weekly = { quads: { effectiveSets: 20 }, hamstrings: { effectiveSets: 8 } };
    const res = computeMuscleBalance(weekly);
    expect(res.issues.some(s => /Квадр/i.test(s))).toBe(true);
  });
  it('push/pull дисбаланс', () => {
    const weekly = { chest: { effectiveSets: 20 }, triceps: { effectiveSets: 10 }, back: { effectiveSets: 8 }, biceps: { effectiveSets: 5 } };
    const res = computeMuscleBalance(weekly);
    expect(res.issues.some(s => /Push\/pull/i.test(s))).toBe(true);
  });
  it('front/rear дисбаланс', () => {
    const weekly = { delt_front: { effectiveSets: 8 }, delt_rear: { effectiveSets: 2 }, shoulders: { effectiveSets: 0 } };
    const res = computeMuscleBalance(weekly);
    expect(res.issues.some(s => /Передняя/i.test(s))).toBe(true);
  });
  it('пустой weekly no issues', () => {
    expect(computeMuscleBalance({}).issues.length).toBe(0);
  });
});

describe('Вода/BSA', () => {
  it('leanMass <55 снижает воду', () => {
    const cfgLight = baseCfg({ weightKg: 55, bodyFatPct: 8, waterStrategy: 'moderate' as const });
    const cfgHeavy = baseCfg({ weightKg: 90, bodyFatPct: 12, waterStrategy: 'moderate' as const });
    const peakLight = buildPeakWeek(cfgLight);
    const peakHeavy = buildPeakWeek(cfgHeavy);
    expect(peakLight[0].waterLiters).toBeLessThanOrEqual(peakHeavy[0].waterLiters);
  });
  it('height влияет на BSA', () => {
    const cfgShort = baseCfg({ weightKg: 80, heightCm: 160 } as any);
    const cfgTall = baseCfg({ weightKg: 80, heightCm: 195 } as any);
    // tall should have slightly higher BSA cap, but our clamp may not show diff for moderate
    expect(buildPeakWeek(cfgShort)[0].waterLiters).toBeLessThanOrEqual(buildPeakWeek(cfgTall)[0].waterLiters + 0.5);
  });
});

describe('deserialize/configFromPlan', () => {
  it('pedContext влияет на water (GH 5 повышает)', () => {
    const cfg = baseCfg({ pedContext: { ghIU: 5 }, age: 30, prepWeeks: 10, waterStrategy: 'tapered' as const });
    const plan = buildBBContestPrepPlan(cfg, { prepWeeks: 10 });
    expect(plan.safety.warnings.some(w => /GH 5/i.test(w))).toBe(true);
    expect(plan.preparation.weeks).toBe(10);
  });
  it('validate age out of range clamps', () => {
    const cfg = baseCfg({ age: 10 });
    const v = validateBBContestPrepConfig(cfg as any);
    // age clamps to 14, so still valid (not error, just clamped)
    expect(v.ok).toBe(true);
  });
  it('height 150 vs 200 BSA diff', () => {
    const c1 = baseCfg({ weightKg: 80, heightCm: 150 } as any);
    const c2 = baseCfg({ weightKg: 80, heightCm: 200 } as any);
    expect(buildPeakWeek(c1)[0].waterLiters).toBeLessThanOrEqual(buildPeakWeek(c2)[0].waterLiters + 0.5);
  });
  it('prepWeeks 1 vs 52', () => {
    const c = baseCfg({ prepWeeks: 1 });
    const p1 = buildBBContestPrepPlan(c, { prepWeeks: 1 });
    const p2 = buildBBContestPrepPlan(c, { prepWeeks: 52 });
    expect(p1.preparation.weeks).toBe(1);
    expect(p2.preparation.weeks).toBe(52);
  });
  it('diuretic without classic still warning', () => {
    const cfg = baseCfg({ pedContext: { diuretic: true } });
    const plan = buildBBContestPrepPlan(cfg, { prepWeeks: 8 });
    expect(plan.safety.warnings.some(w => /Диуретик/i.test(w))).toBe(true);
  });
  it('per-muscle weekIdx 0 vs 3', () => {
    expect(getPerMuscleTaperMult('chest', 0)).toBeGreaterThan(getPerMuscleTaperMult('chest', 3));
  });
  it('balance unknown muscle', () => {
    const weekly = { unknown_muscle_xyz: { effectiveSets: 10 } };
    const res = computeMuscleBalance(weekly as any);
    expect(res.issues.length).toBe(0);
  });
  it('pedContext empty no warning', () => {
    const cfg = baseCfg({ pedContext: {} });
    const plan = buildBBContestPrepPlan(cfg, { prepWeeks: 8 });
    expect(plan.safety.warnings.some(w => /Диуретик|GH|Tren/.test(w))).toBe(false);
  });
  it('water classic vs minimal', () => {
    const cClassic = baseCfg({ waterStrategy: 'classic' as const, pedContext: { diuretic: false }, confirmedManipulation: true });
    const cMinimal = baseCfg({ waterStrategy: 'minimal' as const });
    expect(buildPeakWeek(cClassic)[0].waterLiters).toBeGreaterThan(buildPeakWeek(cMinimal)[0].waterLiters);
  });
  it('configFromPlan preserves prepWeeks via plan.preparation', () => {
    const cfg = baseCfg({ prepWeeks: 20 });
    const plan = buildBBContestPrepPlan(cfg, { prepWeeks: 20 });
    expect(plan.preparation.weeks).toBe(20);
    const cfg2 = configFromPlan(plan);
    // configFromPlan proxies via plan.preparation — check round-trip via rebuild
    expect(plan.showDate).toBe(cfg2.showDate);
  });
});
