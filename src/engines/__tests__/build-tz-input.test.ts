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
import { getMiFromLab } from '../risk-engine-tz-spec';
import { PROTEINURIA_STEPS } from '../lab-norms.engine';
import { UCUM_MAP } from '../../core/constants';
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

/** Вход модели с одним заполненным полным бланком (проходы 130–131). */
function tzInputWithLabs(panels: Record<string, unknown>, units?: Record<string, Record<string, string>>) {
  const state = mockState({
    // Без препаратов `buildTzInput` честно возвращает null (моделировать нечего).
    pharma: {
      ...mockState().pharma,
      aas: [{ id: 'testosterone_enanthate', doseMgWeek: 400, weeks: 10 }],
    },
  } as Partial<CalculatorState>);
  state.labs = {
    ...state.labs,
    fullPanel: { date: '2026-01-10', ...panels, ...(units ? { units } : {}) },
  } as any;
  return buildTzInput(state, [])!;
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

/**
 * Проход 130: белок мочи.
 *
 * Поле «Белок» общего анализа мочи уезжало в `UACR` — альбумин/креатинин мочи
 * в мг/г, то есть другой анализ в другой единице. Белок 3 г/л (нефротическая
 * протеинурия) читался как «UACR 3» и не давал вклада в почечный риск, а полоска
 * «1+» через `parseFloat('1+')` становилась 1 г/л — протеинурией из ничего.
 * Теперь это `PROTEIN_URINE` в г/л: канон каталога UCUM, тиров и моста механизма.
 *
 * Тут же вчСРБ: он и СРБ — один белок в одной единице, и при заполненных обоих
 * полях молча выигрывала биохимия (СРБ 1 при вчСРБ 7 = «воспаления нет»).
 */
describe('проход 130: белок мочи — свой маркер, а не UACR', () => {
  const inputWith = tzInputWithLabs;

  it('г/л уходит в PROTEIN_URINE, UACR не выдумывается', () => {
    const input = inputWith({ panelUrinalysis: { Protein: '0.3' } });
    expect(input.labValues!['PROTEIN_URINE']).toBe(0.3);
    expect(input.labValues!['UACR']).toBeUndefined();
  });

  it('единица бланка главнее: 300 мг/л = 0.3 г/л', () => {
    const input = inputWith({ panelUrinalysis: { Protein: '300' } }, { panelUrinalysis: { Protein: 'мг/л' } });
    expect(input.labValues!['PROTEIN_URINE']).toBeCloseTo(0.3, 6);
  });

  it('полоска «1+/2+/++» — не концентрация', () => {
    for (const raw of ['1+', '2+', '++', '+']) {
      const input = inputWith({ panelUrinalysis: { Protein: raw } });
      expect(input.labValues!['PROTEIN_URINE'], raw).toBeUndefined();
    }
  });

  it('ren3 видит белок мочи: 0.05 → 0, 0.3 → 1, 3 г/л → 3', () => {
    const mi = (protein: string) =>
      getMiFromLab('ren3', inputWith({ panelUrinalysis: { Protein: protein } }).labValues!);
    expect(mi('0.05')).toBe(0);
    expect(mi('0.3')).toBe(1);
    expect(mi('3')).toBe(3);
  });

  it('ступени протеинурии — ВГН каталога + границы тиров, без новых чисел', () => {
    expect(PROTEINURIA_STEPS).toEqual([UCUM_MAP.PROTEIN_URINE.uln, 0.5, 1.0]);
  });

  it('UACR остаётся своим маркером: белок мочи его не подменяет', () => {
    expect(getMiFromLab('ren3', { UACR: 100, PROTEIN_URINE: 0.1 })).toBe(1);
    expect(getMiFromLab('ren3', { UACR: 10, PROTEIN_URINE: 3 })).toBe(3);
  });

  it('вчСРБ и СРБ не теряются: при заполненных обоих берётся худшее', () => {
    const input = inputWith({ panelBiochem: { CRP: '1' }, panelInflammatory: { hsCRP: '7' } });
    expect(input.labValues!['CRP']).toBe(7);
  });
  it('вчСРБ без СРБ читается как СРБ', () => {
    const input = inputWith({ panelInflammatory: { hsCRP: '7' } });
    expect(input.labValues!['CRP']).toBe(7);
  });
});

/**
 * Проход 131: граница вместо числа.
 *
 * Бланк печатает «>1000» и «<0.5». `parseFloat` на такой строке даёт NaN, и анализ
 * пропадал целиком: ферритин «>1000» (перегрузка железом) не давал ни находки, ни
 * вклада в риск. Границу читаем как её число — так же, как это уже делает авто-разбор
 * бланка (`core/lab-auto-parser`), — а интерфейс называет это баннером
 * «граница вместо числа» (`labBoundNotes`).
 */
describe('проход 131: граница «>N» / «<N» не теряет анализ', () => {
  it('ферритин «>1000» читается как 1000 и даёт m_i 3', () => {
    const input = tzInputWithLabs({ panelIron: { Ferritin: '>1000' } });
    expect(input.labValues!['FERRITIN']).toBe(1000);
    expect(getMiFromLab('cns2', input.labValues!)).toBe(3);
  });

  it('«<0,5» СРБ — это 0.5, «>300» — 300', () => {
    expect(tzInputWithLabs({ panelBiochem: { CRP: '<0,5' } }).labValues!['CRP']).toBe(0.5);
    expect(tzInputWithLabs({ panelBiochem: { CRP: '>300' } }).labValues!['CRP']).toBe(300);
  });

  it('белок мочи «>1» — 1 г/л, полоска «1+» по-прежнему не число', () => {
    expect(tzInputWithLabs({ panelUrinalysis: { Protein: '>1' } }).labValues!['PROTEIN_URINE']).toBe(1);
    expect(tzInputWithLabs({ panelUrinalysis: { Protein: '1+' } }).labValues!['PROTEIN_URINE']).toBeUndefined();
  });

  it('граница без числа ничего не выдумывает', () => {
    const input = tzInputWithLabs({ panelBiochem: { CRP: '>—' } });
    expect(input.labValues!['CRP']).toBeUndefined();
  });
});

/**
 * Проход 134: инсулин — поле формы, а не только импорт.
 *
 * `extractLabValues` считал HOMA-IR по инсулину и глюкозе ещё с самого начала, но в
 * форме поля «Инсулин» не было: `FULL_PANELS.panelBiochem` его не перечислял. Значит
 * механизм инсулинорезистентности (`hem2`, ступени HOMA 2.0/3.0/5.0) не мог
 * сработать с бланка — только если инсулин приходил импортом в склад анализов.
 */
describe('проход 134: инсулин и HOMA-IR', () => {
  it('глюкоза 6 + инсулин 20 → HOMA 5.33 и m_i 3 у hem2', () => {
    const input = tzInputWithLabs({ panelBiochem: { Glucose: '6', Insulin: '20' } });
    expect(input.labValues!['HOMA']).toBeCloseTo(5.33, 2);
    expect(getMiFromLab('hem2', input.labValues!)).toBe(3);
  });

  it('без инсулина HOMA не выдумывается — hem2 читает только глюкозу', () => {
    const input = tzInputWithLabs({ panelBiochem: { Glucose: '6' } });
    expect(input.labValues!['HOMA']).toBeUndefined();
    expect(getMiFromLab('hem2', input.labValues!)).toBe(1);
  });

  it('инсулин без глюкозы не даёт HOMA', () => {
    const input = tzInputWithLabs({ panelBiochem: { Insulin: '20' } });
    expect(input.labValues!['HOMA']).toBeUndefined();
  });
});
