/**
 * female-phase2-risk.test.ts — «Фаза 2 женского слоя» (§10 SUPPORT-CALC-FULL-AUDIT-PLAN):
 *  Ж2: getDrugThreshold(id, sex) + computeDrugContributions/androgenicLoad/TZ/weekly-dynamics;
 *  Ж1: femaleDrugThresholdView (единый источник FEMALE_AAS_PROFILES);
 *  Ж3: mapStackToPathologies(drugs, sex) — женские патологии стека;
 *  Ж4: analyzeLabDrugCorrelation(..., sex) — женские пороги.
 *
 * Ключевой контракт: мужской путь (без sex / 'male') — байт-в-байт (JSON-lock).
 */
import { describe, expect, it } from 'vitest';
import {
  DRUG_THRESHOLDS_V7,
  getDrugThreshold,
  drugContributionScale,
  computeV7Matrix,
  type MatrixInput,
} from '../risk-engine-v7-matrix';
import { computeReproductiveRisk, type ReproductiveDrugInput } from '../risk-engine-v7-extensions';
import { calculateTZRisk, type TZRiskInput } from '../risk-engine-tz';
import { calculateWeeklyRiskDynamics } from '../weekly-risk-dynamics.engine';
import { femaleDrugThresholdView, FEMALE_AAS_PROFILES } from '../female-aas-risk';
import { mapStackToPathologies } from '../drug-mapper.engine';
import { analyzeLabDrugCorrelation } from '../lab-pharma-correlation.engine';
import type { CourseEntry, LabPoint } from '../../core/types';

const course = (substanceId: string, doseValue: number, frequency = 1): CourseEntry => ({
  id: substanceId, substanceId, doseValue, doseUnit: 'mg', frequency, startWeek: 0, endWeek: 10,
});
const lab = (code: string, value: number): LabPoint => ({
  id: `${code}-1`, code, name: code, value, unit: '', date: '2026-09-01', phase: 'mid',
} as LabPoint);

// ── Ж2: getDrugThreshold ─────────────────────────────────────────────────────

describe('Ж2: getDrugThreshold(id, sex)', () => {
  it('без sex / male — ровно та же ссылка таблицы (мужской путь)', () => {
    for (const id of Object.keys(DRUG_THRESHOLDS_V7)) {
      expect(getDrugThreshold(id), id).toBe(DRUG_THRESHOLDS_V7[id]);
      expect(getDrugThreshold(id, 'male'), id).toBe(DRUG_THRESHOLDS_V7[id]);
    }
    expect(getDrugThreshold('unknown_drug')).toBeUndefined();
  });

  it('female: красный порог = тир-эквивалент (dosePerWeek = red/2), поля профиля', () => {
    const t = getDrugThreshold('test_enan', 'female')!;
    expect(t).not.toBe(DRUG_THRESHOLDS_V7.test_enan);
    expect(t.dosePerWeek).toBe(10); // red 20 / 2
    expect(t.female?.name).toBe('Тестостерон');
    expect(t.female?.red).toBe(20);
    expect(t.femaleEscalation).toBeUndefined();
    // системы/андрогенность не переопределяются
    expect(t.systems).toBe(DRUG_THRESHOLDS_V7.test_enan.systems);
    expect(t.androgenicity).toBe(DRUG_THRESHOLDS_V7.test_enan.androgenicity);
  });

  it('female: противопоказание → жёсткая эскалация ×3, порог-заглушка 1', () => {
    const t = getDrugThreshold('tren_acet', 'female')!;
    expect(t.female?.contraindicated).toBe(true);
    expect(t.femaleEscalation).toBe(3);
    expect(t.dosePerWeek).toBe(1);
    expect(drugContributionScale('tren_acet', 'female')).toBe(3);
    expect(drugContributionScale('tren_acet')).toBe(1);
    expect(drugContributionScale('test_enan', 'female')).toBe(1);
  });

  it('female: препарат без женского профиля (GH/инсулин) — базовая таблица', () => {
    expect(getDrugThreshold('hgh', 'female')).toBe(DRUG_THRESHOLDS_V7.hgh);
    expect(getDrugThreshold('ins_short', 'female')).toBe(DRUG_THRESHOLDS_V7.ins_short);
  });
});

// ── Ж2: контуры (V7 matrix / TZ / weekly / AR-нагрузка) ──────────────────────

const matrixInput = (sex?: 'male' | 'female', c: CourseEntry[] = []): MatrixInput => ({
  labs: [], course: c, genetics: {},
  nutrition: { proteinPerKg: 2, fiberG: 30, omega3G: 1, sodiumG: 3, potassiumG: 3 },
  training: { workoutsPerWeek: 4, avgWorkoutMinutes: 60, hasHIIT: false, volumeTonnes: 8, lissMinutesPerWeek: 60 },
  mode: 'bulk', stazhWeeks: 100, continuousWeeks: 12,
  ...(sex ? { sex } : {}),
});

const tzInput = (sex: 'male' | 'female', c: CourseEntry[] = []): TZRiskInput => ({
  course: c, labs: [], genetics: {},
  nutrition: { proteinPerKg: 2, fiberG: 25, omega3G: 1.5, sodiumG: 3, potassiumG: 3, waterL: 2, calories: 2500 },
  training: { hasHIIT: false, weeklyMinutes: 240, volumeTonnes: 8000, lissMinutesPerWeek: 60 },
  weight: 80, age: 30, sex, supportSubstances: [],
});

describe('Ж2: computeV7Matrix + TZ + weekly dynamics — мужской JSON-lock', () => {
  const c = [course('test_enan', 500), course('tren_acet', 300), course('oxan', 50)];

  it('V7: без sex === male байт-в-байт (с курсом)', () => {
    expect(JSON.stringify(computeV7Matrix(matrixInput(undefined, c)))).toBe(JSON.stringify(computeV7Matrix(matrixInput('male', c))));
  });

  it('TZ: без sex === male байт-в-байт (с курсом)', () => {
    const noSex = calculateTZRisk({ ...tzInput('male', c), sex: undefined as unknown as 'male' });
    expect(JSON.stringify(noSex)).toBe(JSON.stringify(calculateTZRisk(tzInput('male', c))));
  });

  it('weekly: без sex === male байт-в-байт (с курсом)', () => {
    const base = { genetics: {}, nutritionFactor: 0.8, trainingFactor: 0.7, activeDrugs: { test_enan: { dosePerWeek: 500 }, tren_acet: { dosePerWeek: 300 } }, supportCoverage: {} };
    const noSex = calculateWeeklyRiskDynamics(base, c);
    const male = calculateWeeklyRiskDynamics({ ...base, sex: 'male' }, c);
    expect(JSON.stringify(noSex)).toBe(JSON.stringify(male));
  });

  it('V7: female контур жёстче на тренболоне (female threshold + escalations)', () => {
    const male = computeV7Matrix(matrixInput('male', c));
    const fem = computeV7Matrix(matrixInput('female', c));
    expect(fem.overallRaw).toBeGreaterThan(male.overallRaw);
    expect(fem.overallNet).toBeGreaterThan(male.overallNet);
  });

  it('TZ: female контур жёстче на тренболоне; без курса совпадает', () => {
    const male = calculateTZRisk(tzInput('male', c));
    const fem = calculateTZRisk(tzInput('female', c));
    expect(fem.overallRaw).toBeGreaterThan(male.overallRaw);
    const maleEmpty = calculateTZRisk(tzInput('male'));
    const femEmpty = calculateTZRisk(tzInput('female'));
    expect(femEmpty.overallRaw).toBe(maleEmpty.overallRaw);
  });

  it('weekly dynamics: female пик выше мужского на тренболоне', () => {
    const base = { genetics: {}, nutritionFactor: 0.8, trainingFactor: 0.7, activeDrugs: { test_enan: { dosePerWeek: 500 }, tren_acet: { dosePerWeek: 300 } }, supportCoverage: {} };
    const male = calculateWeeklyRiskDynamics({ ...base, sex: 'male' }, c);
    const fem = calculateWeeklyRiskDynamics({ ...base, sex: 'female' }, c);
    expect(fem.peakRiskValue).toBeGreaterThan(male.peakRiskValue);
  });
});

describe('Ж2: androgenicLoad (computeReproductiveRisk)', () => {
  const drug = (id: string, dosePerWeek: number, threshold: number): ReproductiveDrugInput => ({
    substanceId: id, dosePerWeek, androgenicity: 1.0, threshold,
    aromatization: 0, progestogenic: 0, fiveAlpha: 0, isHCG: false, hcgDose: 0, isSERM: false, sermFactor: 0,
  });

  it('мужской путь: без sex === male байт-в-байт', () => {
    const drugs = [drug('test_enan', 500, 300), drug('tren_acet', 200, 100)];
    expect(JSON.stringify(computeReproductiveRisk(drugs, {}))).toBe(JSON.stringify(computeReproductiveRisk(drugs, {}, 'male')));
  });

  it('female: женский порог поднимает AR-нагрузку; контраиндикация ×3', () => {
    const drugs = [drug('test_enan', 20, 300)];
    const male = computeReproductiveRisk(drugs, {}, 'male').atrophy;
    const fem = computeReproductiveRisk(drugs, {}, 'female').atrophy;
    expect(fem).toBeGreaterThan(male);
    const contra = [drug('tren_acet', 100, 100)];
    const contraFem = computeReproductiveRisk(contra, {}, 'female').atrophy;
    const contraMale = computeReproductiveRisk(contra, {}, 'male').atrophy;
    expect(contraFem).toBeGreaterThan(contraMale);
  });
});

// ── Ж1: femaleDrugThresholdView ──────────────────────────────────────────────

describe('Ж1: femaleDrugThresholdView', () => {
  it('male/без sex → пусто (мужской путь карточек не трогается)', () => {
    expect(femaleDrugThresholdView([{ id: 'test_enan', mgPerWeek: 500 }])).toEqual([]);
    expect(femaleDrugThresholdView([{ id: 'test_enan', mgPerWeek: 500 }], 'male')).toEqual([]);
  });

  it('female: полный каталог профилей, статус not_in_stack без доз', () => {
    const rows = femaleDrugThresholdView([], 'female');
    expect(rows.length).toBe(FEMALE_AAS_PROFILES.length);
    expect(rows.every((r) => r.level === 'not_in_stack')).toBe(true);
    expect(rows.filter((r) => r.contraindicated).length).toBeGreaterThanOrEqual(7);
    expect(rows.find((r) => r.name === 'Тестостерон')!.red).toBe(20);
  });

  it('female: доза 25 мг/нед теста → red (красный порог 20)', () => {
    const rows = femaleDrugThresholdView([{ id: 'test_enan', mgPerWeek: 25 }], 'female');
    const t = rows.find((r) => r.name === 'Тестостерон')!;
    expect(t.level).toBe('red');
    expect(t.doseMgWeek).toBe(25);
  });

  it('female: тренболон любой дозы → contraindicated', () => {
    const rows = femaleDrugThresholdView([{ id: 'trenbolone_enanthate', mgPerWeek: 50 }], 'female');
    expect(rows.find((r) => r.name === 'Тренболон')!.level).toBe('contraindicated');
  });

  it('female: оральный оксандролон 20 мг/сут → 140 мг/нед (нормализация oral)', () => {
    const rows = femaleDrugThresholdView([{ id: 'oxandrolone', mgPerWeek: 20, form: 'oral' }], 'female');
    const ox = rows.find((r) => r.name === 'Оксандролон')!;
    expect(ox.doseMgWeek).toBe(140);
    expect(ox.level).toBe('yellow'); // 140/140 = 1.0 → ровно граница
  });
});

// ── Ж3: mapStackToPathologies(drugs, sex) ────────────────────────────────────

describe('Ж3: mapStackToPathologies — женские патологии стека', () => {
  const drugs = [{ name: 'trenbolone', dosageMg: 200 }, { name: 'oxandrolone', dosageMg: 140 }];

  it('без sex === male — прежний результат байт-в-байт, без женских патологий', () => {
    const a = mapStackToPathologies(drugs);
    const b = mapStackToPathologies(drugs, 'male');
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    expect(a.activePathologies.some((p) => p.pathologyId.startsWith('female_'))).toBe(false);
  });

  it('female: добавляются 5 женских патологий с силой из androgenIndex', () => {
    const fem = mapStackToPathologies(drugs, 'female');
    const ids = fem.activePathologies.map((p) => p.pathologyId);
    for (const id of ['female_virilization', 'female_menstrual_disruption', 'female_fertility_suppression', 'female_libido_dysregulation', 'female_bone_hair_effects']) {
      expect(ids, id).toContain(id);
    }
    const vir = fem.activePathologies.find((p) => p.pathologyId === 'female_virilization')!;
    // trenbolone контраиндицирован → сила ≥ 2 (порог высокого риска); oxandrolone AI 0.24
    expect(vir.cumulativeTriggerStrength).toBeGreaterThanOrEqual(2);
    expect(vir.pathologyLabel).toContain('♀');
    expect(vir.contributingDrugs).toContain('trenbolone');
    expect(fem.requiredBiomarkers).toContain('TT');
    expect(fem.requiredBiomarkers).toContain('AMH');
    // мужской путь по-прежнему присутствует
    expect(ids).toContain('cardiac_fibrosis');
  });

  it('female: GH-препараты женских патологий не добавляют', () => {
    const fem = mapStackToPathologies([{ name: 'growth_hormone', dosageMg: 0 }], 'female');
    expect(fem.activePathologies.some((p) => p.pathologyId.startsWith('female_'))).toBe(false);
  });
});

// ── Ж4: analyzeLabDrugCorrelation(..., sex) ──────────────────────────────────

describe('Ж4: lab-pharma женские пороги', () => {
  const c = [course('test_enan', 500)];

  it('мужской путь: без sex === male байт-в-байт', () => {
    const labs = [lab('HCT', 46), lab('TT', 800), lab('E2', 50)];
    const a = analyzeLabDrugCorrelation(labs, c, 'on_cycle');
    const b = analyzeLabDrugCorrelation(labs, c, 'on_cycle', 'male');
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it('female: HCT 49 — высокий (женский ULN 48), у мужчины — норма', () => {
    const labs = [lab('HCT', 49)];
    const male = analyzeLabDrugCorrelation(labs, c, 'on_cycle', 'male');
    const fem = analyzeLabDrugCorrelation(labs, c, 'on_cycle', 'female');
    expect(male.some((x) => x.marker === 'HCT')).toBe(false);
    const hct = fem.find((x) => x.marker === 'HCT')!;
    expect(hct.actualStatus).toBe('high');
    expect(hct.recommendation).toContain('>52%');
  });

  it('female: TT 200 (≈6.9 нмоль/л) — вирилизация, женский текст', () => {
    const fem = analyzeLabDrugCorrelation([lab('TT', 200)], c, 'on_cycle', 'female');
    const tt = fem.find((x) => x.marker === 'TT')!;
    expect(tt.actualStatus).toBe('high');
    expect(tt.recommendation).toContain('ВИРИЛИЗАЦИЯ');
  });

  it('female: E2 high — честная оговорка по фазе цикла; E2 low — остеопороз', () => {
    const high = analyzeLabDrugCorrelation([lab('E2', 450)], c, 'on_cycle', 'female').find((x) => x.marker === 'E2')!;
    expect(high.recommendation).toContain('фазе цикла');
    const low = analyzeLabDrugCorrelation([lab('E2', 5)], c, 'on_cycle', 'female').find((x) => x.marker === 'E2')!;
    expect(low.actualStatus).toBe('low');
    expect(low.recommendation).toContain('остеопороз');
  });

  it('female: PRL 20 — выше женского порога 25? нет; 30 — высокий', () => {
    expect(analyzeLabDrugCorrelation([lab('PRL', 20)], c, 'on_cycle', 'female').some((x) => x.marker === 'PRL')).toBe(false);
    expect(analyzeLabDrugCorrelation([lab('PRL', 30)], c, 'on_cycle', 'female').some((x) => x.marker === 'PRL')).toBe(true);
  });
});
