/**
 * build-tz-input.test.ts — guard реальных доз входа механизм-модели.
 *
 * Аудит 2026-11 (P0): `buildTzInput` собирал препараты из списка курса, но
 * GH/IGF/инсулин/клен/T3 брались по флажкам с ХАРДКОДОМ дозы (cjc1295 300,
 * igf1_lr3 100, ins_short 10) — поэтому риск считался для несуществующей
 * дозировки, а иногда и для другого класса препарата. Теперь сюда идут
 * реальные дозы из PED-попапов и длина курса из списка веществ.
 */
import { describe, it, expect } from 'vitest';
import { buildTzInput } from '../support-plan/engine-helpers';
import type { CalculatorState } from '../support-plan/types';

function mockState(overrides: Partial<CalculatorState> = {}): CalculatorState {
  return {
    profile: { weight: 80, age: 30, sex: 'male', workoutsPerWeek: 4, avgWorkoutMinutes: 60, sleepHours: 7, stressLevel: 3, smoker: false, alcohol: 'never', caffeineMg: 200 },
    neuro: { dopamineScore: 5, serotoninScore: 5, gabaBalance: 'balance', memoryIssues: false, focusIssues: false, slowThinking: false, coordinationIssues: false, aggressionScore: 3, headaches: false, weatherDependent: false, sleepQuality: 'good' },
    pharma: { phase: 'course', aas: [], hasGH: false, hasIGF: false, hasInsulin: false, hasHCG: false, hasAI: false, hasCaber: false, hasSERM: false, hasSARMs: false, hasMGF: false, hasGLP1: false },
    goals: { healthMaintenance: true, competitionPrep: false, sleepRecovery: false, lipidCorrection: false, bloodThinning: false, liverDetox: false, bpControl: false, trainingCycle: 'maintenance', cycleWeeks: 12, previousCycles: 1, timeSinceLastCycle: '3m' },
    hepatobiliary: { altAstElevation: 'normal', ggtElevation: 'normal', bilirubinElevation: 'normal', fattyLiver: false, cholecystitis: false, alcoholHistory: 'none' },
    urinary: { creatinineElevation: 'normal', ureaElevation: 'normal', proteinuria: false, nephrotoxicDrugs: false, hypertension: false, diabetes: false, urinationPattern: 'normal' },
    cardio: { bpStage: 'normal', heartRate: 70, ldlElevation: 'normal', hdlLow: false, triglycerides: 'normal', hctElevation: 'normal', previousCVD: false, familyCVD: false },
    oda: { jointPain: 'none', ligamentIssues: false, backPain: false, injuries: [] },
    labs: { preCourse: null, midCourse: null, postPCT: null, fullPanel: null },
    nutrition: { calories: 2500, proteinG: 150, fatG: 80, carbsG: 250, waterL: 3, saltIntake: 'normal', omega3: false, fiberG: 25, proteinGPerKg: 1.8, sodiumMg: 3000, potassiumMg: 3000 },
    contraindications: { allergies: '', hasCVD: false, hasThrombophilia: false, hasGI: false, hasProstateIssues: false, hasDiabetes: false, hasEpilepsy: false, hasMentalIllness: false, hasLiverDisease: false, hasKidneyDisease: false },
    journal: { positive: [], negative: [] },
    epicrisis: { pastGyno: false, pastLibidoDrop: false, pastHctSpike: false, pastLiverIssues: false, pastKidneyIssues: false },
    toxicLoad: { hazardousWork: false, regularNSAIDs: false, otherHeavyDrugs: false, bowelFrequency: 'regular' },
    dental: { bleedingGums: false, looseTeeth: false, nightGrinding: false, boneFractures: false, cramps: false },
    genetics: { cyp19a1: 'normal', srd5a2: 'normal', arSensitivity: 'normal', mthfr: 'normal' },
    gi: { bloating: false, heartburn: false, diarrhea: false, constipation: false, diagnosedIBS: false, enzymeSupport: false, probioticUse: false },
    psych: { fearOfLoss: 0, mirrorObsession: 0, apathyOffCycle: 0 },
    injection: { glutes: 'ok', quads: 'ok', delts: 'ok', localAreas: 'ok' },
    powerLevel: 'mid',
    courseWeek: 6,
    ...overrides,
  } as CalculatorState;
}

/** Достаёт дозу препарата по канонич. имени из результата. */
function doseOf(input: ReturnType<typeof buildTzInput>, name: string): number | undefined {
  return input?.drugs?.find((d) => d.drugName === name)?.dose;
}

describe('buildTzInput: препараты списка курса', () => {
  it('берёт дозу и недели из списка, а не из хардкода', () => {
    const state = mockState({
      pharma: {
        ...mockState().pharma,
        aas: [{ id: 'testosterone_enanthate', doseMgWeek: 500, weeks: 16 }],
      },
    } as Partial<CalculatorState>);
    const input = buildTzInput(state, []);
    expect(input).toBeTruthy();
    expect(input!.drugs).toHaveLength(1);
    expect(input!.drugs![0].dose).toBe(500);
    // Длительность = самый длинный препарат курса.
    expect(input!.duration).toBe(16);
  });

  it('форма препарата и класс берутся из DRUG_DB (таблетки — oral, AAS)', () => {
    const state = mockState({
      pharma: {
        ...mockState().pharma,
        aas: [{ id: 'methandienone', doseMgWeek: 30, weeks: 6 }],
      },
    } as Partial<CalculatorState>);
    const d = buildTzInput(state, [])!.drugs![0];
    expect(d.drugClass).toBe('aas');
    expect(d.form).toBe('oral');
  });

  it('нет препаратов — честный null (а не выдуманный курс)', () => {
    expect(buildTzInput(mockState(), [])).toBeNull();
  });
});

describe('buildTzInput: PED-попапы с реальными дозами', () => {
  it('GH/инсулин/IGF/клен/T3 идут с дозами пользователя и верными классами', () => {
    const state = mockState({
      pharma: {
        ...mockState().pharma,
        hasGH: true,
        hasInsulin: true,
        hasIGF: true,
        ghIU: 8,
        insulinIU: 12,
        igfMcg: 40,
        clenMcg: 60,
        t3Mcg: 25,
      },
    } as Partial<CalculatorState>);
    const input = buildTzInput(state, []);
    expect(input).toBeTruthy();
    expect(doseOf(input, 'hgh')).toBe(8);
    expect(doseOf(input, 'ins_short')).toBe(12);
    expect(doseOf(input, 'igf1_lr3')).toBe(40);
    expect(doseOf(input, 'clenbuterol')).toBe(60);
    expect(doseOf(input, 't3')).toBe(25);
    const byName = (n: string) => input!.drugs!.find((d) => d.drugName === n)!;
    expect(byName('hgh').drugClass).toBe('gh');
    expect(byName('ins_short').drugClass).toBe('insulin');
    expect(byName('clenbuterol').drugClass).toBe('thermo');
    expect(byName('t3').drugClass).toBe('thyroid');
  });

  it('доза не задана — дефолт только как fallback', () => {
    const state = mockState({
      pharma: { ...mockState().pharma, hasGH: true },
    } as Partial<CalculatorState>);
    expect(doseOf(buildTzInput(state, []), 'hgh')).toBe(4);
  });

  it('IGF только по дозе (без флажка) тоже попадает в расчёт', () => {
    const state = mockState({
      pharma: { ...mockState().pharma, igfMcg: 50 },
    } as Partial<CalculatorState>);
    expect(doseOf(buildTzInput(state, []), 'igf1_lr3')).toBe(50);
  });

  it('препарат не дублируется, если он и в списке, и во флажке', () => {
    const state = mockState({
      pharma: {
        ...mockState().pharma,
        hasGH: true,
        ghIU: 6,
        aas: [{ id: 'hgh', doseMgWeek: 6, weeks: 12 }],
      },
    } as Partial<CalculatorState>);
    const input = buildTzInput(state, [])!;
    const gh = input.drugs!.filter((d) => d.drugName === 'hgh');
    expect(gh).toHaveLength(1);
    expect(gh[0].dose).toBe(6);
    expect(input.combinations).toBe(input.drugs!.length);
  });
});

describe('buildTzInput: поддержка и профиль', () => {
  it('поддержка уходит в supportSubstances, гены/питание — в модель', () => {
    const state = mockState({
      pharma: {
        ...mockState().pharma,
        aas: [{ id: 'testosterone_enanthate', doseMgWeek: 400, weeks: 10 }],
      },
    } as Partial<CalculatorState>);
    const input = buildTzInput(state, ['nac', 'vitamin_d3'])!;
    expect(input.supportSubstances).toEqual(['nac', 'vitamin_d3']);
    expect(input.genetics?.cyp19a1).toBe('normal');
    expect(input.nutrition?.proteinPerKg).toBeCloseTo(1.8, 5);
    expect(input.courseWeek).toBe(6);
  });
});
