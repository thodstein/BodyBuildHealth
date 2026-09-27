import { describe, it, expect } from 'vitest';
import {
  FEMALE_LAYER_SUBS,
  FEMALE_BONE_SUBS,
  FEMALE_LAB_GATED_SUBS,
  FEMALE_ALL_LAYER_SUBS,
  applyFemaleSupport,
  detectFemaleCyclePhase,
  femaleVirilizationWarnings,
  femaleIronGate,
  hctAtOrAbove48,
  type FemaleLayerSub,
} from '../female-support-layer';
import { generatePCTPlan, type PCTOptions } from '../pct-planner.engine';

const baseCtx = {
  sex: 'female' as const,
  onCourse: true,
  level: 'intermediate' as const,
  labs: {},
  age: 25,
  weight: 60,
  height: 165,
  bodyFat: 25,
  leanMass: 45,
  hrvMs: 50,
  sleepHours: 7,
  stressLevel: 5,
  genetics: {},
  symptoms: [],
  pedRisk: {},
  femaleFlags: [],
};

const baseRec = {
  subs: [],
  rationale: 'test',
  protocolWarnings: [],
  femaleLayer: undefined,
  pedRisk: {},
};

describe('female-support-layer: расширенный набор', () => {
  it('FEMALE_LAYER_SUBS содержит 6 позиций (vitex, inositol, folate, B6, omega3, probiotics)', () => {
    expect(FEMALE_LAYER_SUBS.length).toBeGreaterThanOrEqual(6);
    const ids = FEMALE_LAYER_SUBS.map(s => s.substanceId);
    expect(ids).toContain('vitex');
    expect(ids).toContain('inositol');
    expect(ids).toContain('folate');
    expect(ids).toContain('vitamin_b6');
    expect(ids).toContain('omega3');
    expect(ids).toContain('probiotics');
  });

  it('FEMALE_ALL_LAYER_SUBS объединяет все группы', () => {
    expect(FEMALE_ALL_LAYER_SUBS.length).toBeGreaterThanOrEqual(11);
  });

  it('applyFemaleSupport добавляет новые позиции при sex=female и onCourse', () => {
    const result = applyFemaleSupport(baseRec, baseCtx);
    expect(result.femaleLayer?.added.length).toBeGreaterThan(0);
    expect(result.femaleLayer?.labels?.[0]).toContain('Витекс');
  });

  it('applyFemaleSupport НЕ добавляет при sex=male', () => {
    const maleCtx = { ...baseCtx, sex: 'male' as const };
    const result = applyFemaleSupport(baseRec, maleCtx);
    expect(result.femaleLayer).toBeUndefined();
  });

  it('applyFemaleSupport НЕ добавляет при onCourse=false', () => {
    const offCtx = { ...baseCtx, onCourse: false };
    const result = applyFemaleSupport(baseRec, offCtx);
    expect(result.femaleLayer).toBeUndefined();
  });
});

describe('female-support-layer: фазовый учё цикла', () => {
  it('detectFemaleCyclePhase: день 1-7 = menstrual', () => {
    const phase = detectFemaleCyclePhase(3);
    expect(phase.phase).toBe('menstrual');
    expect(phase.boostSubs).toContain('iron_bisglycinate');
  });

  it('detectFemaleCyclePhase: день 8-14 = follicular', () => {
    const phase = detectFemaleCyclePhase(10);
    expect(phase.phase).toBe('follicular');
  });

  it('detectFemaleCyclePhase: день 15-21 = luteal', () => {
    const phase = detectFemaleCyclePhase(18);
    expect(phase.phase).toBe('luteal');
    expect(phase.boostSubs).toContain('calcium');
    expect(phase.boostSubs).toContain('magnesium');
  });

  it('detectFemaleCyclePhase: день 22+ = luteal (поздняя)', () => {
    const phase = detectFemaleCyclePhase(25);
    expect(phase.phase).toBe('luteal');
  });

  it('detectFemaleCyclePhase: без дня цикла = follicular (default)', () => {
    const phase = detectFemaleCyclePhase(undefined);
    expect(phase.phase).toBe('follicular');
  });
});

describe('female-support-layer: предупреждения о вирилизации', () => {
  it('femaleVirilizationWarnings: пустой массив без AAS', () => {
    const warnings = femaleVirilizationWarnings([]);
    expect(warnings.length).toBe(0);
  });

  it('femaleVirilizationWarnings: предупреждения при наличии AAS', () => {
    const warnings = femaleVirilizationWarnings(['test_enan', 'tren_acet']);
    expect(warnings.length).toBeGreaterThanOrEqual(3);
    expect(warnings.some(w => w.includes('Вирилизация'))).toBe(true);
    expect(warnings.some(w => w.includes('Контрацепция'))).toBe(true);
    expect(warnings.some(w => w.includes('беременность'))).toBe(true);
  });
});

describe('female-support-layer: гейт железа и HCT', () => {
  it('femaleIronGate: true при ферритин <30 и HCT <48', () => {
    expect(femaleIronGate({ FERRITIN: 25, HCT: 45 })).toBe(true);
  });

  it('femaleIronGate: false при ферритин >=30', () => {
    expect(femaleIronGate({ FERRITIN: 35, HCT: 45 })).toBe(false);
  });

  it('femaleIronGate: false при HCT >=48', () => {
    expect(femaleIronGate({ FERRITIN: 25, HCT: 50 })).toBe(false);
  });

  it('femaleIronGate: false без анализов', () => {
    expect(femaleIronGate(undefined)).toBe(false);
  });

  it('hctAtOrAbove48: true при HCT=48', () => {
    expect(hctAtOrAbove48({ HCT: 48 })).toBe(true);
  });

  it('hctAtOrAbove48: false при HCT=45', () => {
    expect(hctAtOrAbove48({ HCT: 45 })).toBe(false);
  });
});

describe('female-support-layer: фикс TOTAL_LIMIT[undefined]', () => {
  it('applyFemaleSupport работает при неизвестном уровне', () => {
    const unknownLevelCtx = { ...baseCtx, level: undefined as any };
    const result = applyFemaleSupport(baseRec, unknownLevelCtx);
    expect(result.femaleLayer?.added.length).toBeGreaterThan(0);
  });
});

describe('pct-planner: параметризация', () => {
  const course = [
    { substanceId: 'test_enan', startWeek: 0, endWeek: 12, dosePerWeek: 500 },
  ] as any;

  it('generatePCTPlan: дефолтные параметры', () => {
    const plan = generatePCTPlan(course, 12);
    expect(plan.pctProtocol.length).toBeGreaterThanOrEqual(2);
    expect(plan.warnings.some(w => w.includes('HCG'))).toBe(true);
  });

  it('generatePCTPlan: includeHCG=false исключает HCG', () => {
    const plan = generatePCTPlan(course, 12, { includeHCG: false });
    expect(plan.pctProtocol.some(p => p.substanceId === 'hcg')).toBe(false);
  });

  it('generatePCTPlan: includeTamoxifen=true добавляет тамоксифен', () => {
    const plan = generatePCTPlan(course, 12, { includeTamoxifen: true });
    expect(plan.pctProtocol.some(p => p.substanceId === 'tamoxifen')).toBe(true);
  });

  it('generatePCTPlan: кастомная доза кломифена', () => {
    const plan = generatePCTPlan(course, 12, { clomipheneStartDose: 100, clomipheneTaperDose: 50 });
    const first = plan.pctProtocol.find(p => p.substanceId === 'clomi');
    expect(first?.doseValue).toBe('100');
  });

  it('generatePCTPlan: кастомная длительность ПКТ', () => {
    const plan = generatePCTPlan(course, 12, { pctDurationWeeks: 6 });
    expect(plan.pctProtocol.length).toBeGreaterThanOrEqual(2);
  });

  it('generatePCTPlan: кастомная доза HCG', () => {
    const plan = generatePCTPlan(course, 12, { hcgDose: 1000 });
    const hcg = plan.pctProtocol.find(p => p.substanceId === 'hcg');
    expect(hcg?.doseValue).toBe('1000');
  });

  it('generatePCTPlan: кастомная частота HCG', () => {
    const plan = generatePCTPlan(course, 12, { hcgFrequencyPerWeek: 3 });
    const hcg = plan.pctProtocol.find(p => p.substanceId === 'hcg');
    expect(hcg?.dose).toContain('3×/нед');
  });

  it('generatePCTPlan: пустой курс возвращает предупреждение', () => {
    const plan = generatePCTPlan([], 12);
    expect(plan.warnings).toContain('Нет активных препаратов для ПКТ');
  });
});
