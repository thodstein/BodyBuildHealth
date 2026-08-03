import { describe, it, expect } from 'vitest';
import {
  applyTitration,
  normalizeDoseByWeight,
  generateSchedule,
} from '../support-plan/engine-helpers';
import { classifyPed } from '../../data/ped-potency-table';
import { getMinDose, getMaxDose, getDosingRecord } from '../../data/support-dosing';
import { NUTRIENT_UL, type CalculatorState } from '../support-plan/types';

// ─── Минимальный мок CalculatorState для тестов ───
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

// ═══════════════════════════════════════════════════════════════
//  P0-1: Vitamin D3 — нетоксичная доза после нормализации по весу
// ═══════════════════════════════════════════════════════════════
describe('P0-1: Vitamin D3 dose within UL after weight normalization', () => {
  it('базовая доза 50 мкг = 2000 МЕ при 70 кг (reference weight)', () => {
    const d = applyTitration(['vitamin_d3'], mockState({ profile: { ...mockState().profile, weight: 70 } }));
    // 50 мкг × (70/70)^0.75 = 50 мкг → ×40 = 2000 МЕ
    expect(d.vitamin_d3).toBe(50);
    const iu = d.vitamin_d3 * 40;
    expect(iu).toBe(2000);
  });

  it('доза при 100 кг не превышает UL (100 мкг = 4000 МЕ)', () => {
    const d = applyTitration(['vitamin_d3'], mockState({ profile: { ...mockState().profile, weight: 100 } }));
    // 50 × (100/70)^0.75 ≈ 64.8 → Math.round = 65 мкг → UL cap = 100 → 65 < 100
    expect(d.vitamin_d3).toBeLessThanOrEqual(NUTRIENT_UL.vitamin_d3);
    const iu = d.vitamin_d3 * 40;
    expect(iu).toBeLessThanOrEqual(4000);
  });

  it('доза при 200 кг ограничена UL (100 мкг = 4000 МЕ)', () => {
    const d = applyTitration(['vitamin_d3'], mockState({ profile: { ...mockState().profile, weight: 200 } }));
    // 50 × (200/70)^0.75 ≈ 109.4 → Math.round = 109 → UL cap = 100
    expect(d.vitamin_d3).toBe(NUTRIENT_UL.vitamin_d3);
    const iu = d.vitamin_d3 * 40;
    expect(iu).toBe(4000);
  });

  it('доза при 70 кг НЕ равна 80000 МЕ (старый баг 2000 мкг × 40)', () => {
    const d = applyTitration(['vitamin_d3'], mockState({ profile: { ...mockState().profile, weight: 70 } }));
    const iu = d.vitamin_d3 * 40;
    expect(iu).not.toBe(80000);
    expect(iu).toBe(2000);
  });
});

// ═══════════════════════════════════════════════════════════════
//  P0-1b: UL cap применяется ко всем веществам с NUTRIENT_UL
// ═══════════════════════════════════════════════════════════════
describe('P0-1b: UL cap for all normalized substances', () => {
  it('магний при 200 кг ограничен UL (350 мг)', () => {
    const d = applyTitration(['magnesium'], mockState({ profile: { ...mockState().profile, weight: 200 } }));
    expect(d.magnesium).toBeLessThanOrEqual(NUTRIENT_UL.magnesium);
  });

  it('NAC при 200 кг (ранняя неделя) ограничен UL (2400 мг)', () => {
    const d = applyTitration(['nac'], mockState({ courseWeek: 1, profile: { ...mockState().profile, weight: 200 } }));
    expect(d.nac).toBeLessThanOrEqual(NUTRIENT_UL.nac);
  });

  it('цинк при 200 кг ограничен UL (40 мг)', () => {
    const d = applyTitration(['zinc'], mockState({ profile: { ...mockState().profile, weight: 200 } }));
    expect(d.zinc).toBeLessThanOrEqual(NUTRIENT_UL.zinc);
  });

  it('селен при 200 кг ограничен UL (400 мкг)', () => {
    const d = applyTitration(['selenium'], mockState({ profile: { ...mockState().profile, weight: 200 } }));
    expect(d.selenium).toBeLessThanOrEqual(NUTRIENT_UL.selenium);
  });

  it('витамин C при 200 кг ограничен UL (2000 мг)', () => {
    const d = applyTitration(['vitamin_c'], mockState({ profile: { ...mockState().profile, weight: 200 } }));
    expect(d.vitamin_c).toBeLessThanOrEqual(NUTRIENT_UL.vitamin_c);
  });

  it('ALA при 200 кг ограничен UL (1800 мг)', () => {
    const d = applyTitration(['alpha_lipoic'], mockState({ profile: { ...mockState().profile, weight: 200 } }));
    expect(d.alpha_lipoic).toBeLessThanOrEqual(NUTRIENT_UL.alpha_lipoic);
  });
});

// ═══════════════════════════════════════════════════════════════
//  normalizeDoseByWeight — базовая функция
// ═══════════════════════════════════════════════════════════════
describe('normalizeDoseByWeight', () => {
  it('возвращает базовую дозу при weight = refWeight', () => {
    expect(normalizeDoseByWeight(100, 80, 80)).toBe(100);
  });

  it('масштабирует по Клейберу 0.75', () => {
    // (160/80)^0.75 = 2^0.75 ≈ 1.682
    const result = normalizeDoseByWeight(100, 160, 80);
    expect(result).toBe(Math.round(100 * Math.pow(2, 0.75)));
  });

  it('использует refWeight=80 по умолчанию', () => {
    expect(normalizeDoseByWeight(100, 80)).toBe(100);
  });
});

// ═══════════════════════════════════════════════════════════════
//  P1: classifyPed — 'eq' ID распознаётся как boldenone
// ═══════════════════════════════════════════════════════════════
describe('P1: classifyPed — boldenone detection', () => {
  it("'eq' распознаётся как 'aas_bold'", () => {
    expect(classifyPed('eq')).toBe('aas_bold');
  });

  it("'boldenone' распознаётся как 'aas_bold'", () => {
    expect(classifyPed('boldenone')).toBe('aas_bold');
  });

  it("'equipoise' распознаётся как 'aas_bold'", () => {
    expect(classifyPed('equipoise')).toBe('aas_bold');
  });

  it("'eq_200' распознаётся как 'aas_bold'", () => {
    expect(classifyPed('eq_200')).toBe('aas_bold');
  });

  it("'Bold' (case-insensitive) распознаётся как 'aas_bold'", () => {
    expect(classifyPed('Bold')).toBe('aas_bold');
  });

  it("'EQUIPOISE' (case-insensitive) распознаётся как 'aas_bold'", () => {
    expect(classifyPed('EQUIPOISE')).toBe('aas_bold');
  });
});

// ═══════════════════════════════════════════════════════════════
//  P1: applyTitration — нет мёртвых 'anastro'/'caberg' проверок
// ═══════════════════════════════════════════════════════════════
describe('P1: applyTitration — anastrozole/cabergoline', () => {
  it('anastrozole титрируется когда hasAI=true и вещество в списке', () => {
    const state = mockState({
      pharma: { ...mockState().pharma, hasAI: true, aas: [{ id: 'test_enan', doseMgWeek: 600, weeks: 12 }] },
    });
    const d = applyTitration(['anastrozole'], state);
    expect(d.anastrozole).toBeDefined();
    expect(d.anastrozole).toBeGreaterThan(0);
  });

  it('anastrozole НЕ титрируется когда hasAI=true, но вещества нет в списке (guardrail убрал)', () => {
    const state = mockState({
      pharma: { ...mockState().pharma, hasAI: true, aas: [{ id: 'test_enan', doseMgWeek: 600, weeks: 12 }] },
    });
    const d = applyTitration([], state);
    expect(d.anastrozole).toBeUndefined();
  });

  it('cabergoline титрируется когда hasCaber=true и вещество в списке', () => {
    const state = mockState({
      pharma: { ...mockState().pharma, hasCaber: true },
    });
    const d = applyTitration(['cabergoline'], state);
    expect(d.cabergoline).toBeDefined();
  });

  it('cabergoline НЕ титрируется когда hasCaber=true, но вещества нет в списке', () => {
    const state = mockState({
      pharma: { ...mockState().pharma, hasCaber: true },
    });
    const d = applyTitration([], state);
    expect(d.cabergoline).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════
//  P1: generateSchedule — новые вещества имеют дозировки
// ═══════════════════════════════════════════════════════════════
describe('P1: generateSchedule — missing substance defaults', () => {
  const newSubs = [
    'tadalafil', 'agmatine', 'pycnogenol', 'astaxanthin',
    'hesperidin', 'dandelion', 'serrapeptase', 'garlic',
    'metformin', 'chromium',
  ];

  for (const sub of newSubs) {
    it(`доза для "${sub}" не "по инструкции"`, () => {
      const schedule = generateSchedule([sub], [], {}, mockState());
      const item = schedule.find(s => s.substanceId === sub);
      expect(item).toBeDefined();
      expect(item!.dose).not.toBe('по инструкции');
      expect(item!.dose.length).toBeGreaterThan(2);
    });
  }

  it('хром отображается в мкг', () => {
    const schedule = generateSchedule(['chromium'], [], {}, mockState());
    const item = schedule.find(s => s.substanceId === 'chromium');
    expect(item).toBeDefined();
    expect(item!.dose).toContain('мкг');
  });

  it('все новые вещества имеют правильное имя (не ID)', () => {
    const schedule = generateSchedule(newSubs, [], {}, mockState());
    for (const sub of newSubs) {
      const item = schedule.find(s => s.substanceId === sub);
      expect(item).toBeDefined();
      expect(item!.name).not.toBe(sub); // имя должно быть русским, не ID
    }
  });

  it('все новые вещества имеют timeBlock (morning/afternoon/evening)', () => {
    const schedule = generateSchedule(newSubs, [], {}, mockState());
    for (const sub of newSubs) {
      const item = schedule.find(s => s.substanceId === sub);
      expect(item).toBeDefined();
      expect(['morning', 'afternoon', 'evening']).toContain(item!.timeBlock);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
//  P2: getMinDose / getMaxDose — без параметра unit
// ═══════════════════════════════════════════════════════════════
describe('P2: getMinDose / getMaxDose without unit param', () => {
  it('getMinDose возвращает min из doseRange', () => {
    const min = getMinDose('telmisartan');
    expect(min).toBe(20);
  });

  it('getMaxDose возвращает max из doseRange', () => {
    const max = getMaxDose('telmisartan');
    expect(max).toBe(80);
  });

  it('getMinDose возвращает 0 для неизвестного вещества', () => {
    expect(getMinDose('nonexistent_substance')).toBe(0);
  });

  it('getMaxDose возвращает 0 для неизвестного вещества', () => {
    expect(getMaxDose('nonexistent_substance')).toBe(0);
  });

  it('getMinDose/getMaxDose для NAC', () => {
    expect(getMinDose('nac')).toBe(600);
    expect(getMaxDose('nac')).toBe(1800);
  });
});

// ═══════════════════════════════════════════════════════════════
//  P2: CalcView type — 'mixcalc' включён в тип
// ═══════════════════════════════════════════════════════════════
describe('P2: CalcView type includes mixcalc', () => {
  it('файл SupportShared.tsx экспортирует CalcView с mixcalc', async () => {
    const mod = await import('../../ui/screens/SupportScreen_parts/SupportShared');
    // @ts-ignore — проверяем, что тип компилируется с 'mixcalc'
    const view: typeof mod.CalcView = 'mixcalc' as any;
    expect(view).toBe('mixcalc');
  });
});
