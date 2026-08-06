import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { runSupportUnified, calculateSupportTZ, hydrateState } from '../index';

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
};
vi.stubGlobal('localStorage', localStorageMock);

describe('support-plan with malformed hydrateState (he_course_data)', () => {
  beforeAll(() => {
    store['he_course_data'] = JSON.stringify({
      phase: 'course',
      substances: [
        { id: 'test_enan', isAAS: true, dose: 500, durationWeeks: 12 },
        { id: '', isAAS: true, dose: 0, durationWeeks: 0 },
        { substanceId: 'tren_ace', isAAS: true, doseMgWeek: 300, weeks: 8 },
      ],
    });
    store['he_autocalc_state'] = JSON.stringify({
      pharma: { phase: 'course', aas: [{ id: 'test_enan', doseMgWeek: 500, weeks: 12 }] },
      labs: { fullPanel: null, preCourse: null, midCourse: null, postPCT: null },
    });
  });
  afterAll(() => localStorageMock.clear());

  it('hydrateState returns pharma.aas without throwing', () => {
    const h = hydrateState();
    console.log('hydrateState pharma:', JSON.stringify(h.pharma));
    expect(h.pharma).toBeDefined();
  });

  it('runSupportUnified does not throw with malformed course data', () => {
    const h = hydrateState();
    const state = {
      profile: { weight: 80, age: 30, sex: 'male', workoutsPerWeek: 3, avgWorkoutMinutes: 60, sleepHours: 7, stressLevel: 4, smoker: false, alcohol: 'rare', caffeineMg: 100 },
      neuro: { dopamineScore: 1, serotoninScore: 1, gabaBalance: 'balance', memoryIssues: false, focusIssues: false, slowThinking: false, coordinationIssues: false, aggressionScore: 1, headaches: false, weatherDependent: false, sleepQuality: 'good' },
      pharma: h.pharma!,
      goals: { healthMaintenance: true, competitionPrep: false, sleepRecovery: false, lipidCorrection: false, bloodThinning: false, liverDetox: false, bpControl: false, trainingCycle: 'mass', cycleWeeks: 12, previousCycles: 0, timeSinceLastCycle: 'none' },
      hepatobiliary: { altAstElevation: 'none', ggtElevation: 'none', bilirubinElevation: 'none', fattyLiver: false, cholecystitis: false, alcoholHistory: 'none' },
      urinary: { creatinineElevation: 'none', ureaElevation: 'none', proteinuria: false, nephrotoxicDrugs: false, hypertension: false, diabetes: false, urinationPattern: 'normal' },
      cardio: { bpStage: 'normal', heartRate: 72, ldlElevation: 'none', hdlLow: false, triglycerides: 'normal', hctElevation: 'none', previousCVD: false, familyCVD: false },
      oda: { jointPain: 'none', ligamentIssues: false, backPain: false, injuries: [] },
      labs: h.labs || { preCourse: null, midCourse: null, postPCT: null, fullPanel: null },
      nutrition: { calories: 2500, proteinG: 160, fatG: 80, carbsG: 300, waterL: 2, saltIntake: 'normal', omega3: false, fiberG: 25, proteinGPerKg: 1.8, sodiumMg: 3500, potassiumMg: 4500 },
      contraindications: { allergies: '', hasCVD: false, hasThrombophilia: false, hasGI: false, hasProstateIssues: false, hasDiabetes: false, hasEpilepsy: false, hasMentalIllness: false, hasLiverDisease: false, hasKidneyDisease: false },
      journal: { positive: [], negative: [] },
      epicrisis: { pastGyno: false, pastLibidoDrop: false, pastHctSpike: false, pastLiverIssues: false, pastKidneyIssues: false },
      toxicLoad: { hazardousWork: false, regularNSAIDs: false, otherHeavyDrugs: false, bowelFrequency: 'regular' },
      dental: { bleedingGums: false, looseTeeth: false, nightGrinding: false, boneFractures: false, cramps: false },
      genetics: { cyp19a1: 'unknown', srd5a2: 'unknown', arSensitivity: 'unknown', mthfr: 'unknown' },
      gi: { bloating: false, heartburn: false, diarrhea: false, constipation: false, diagnosedIBS: false, enzymeSupport: false, probioticUse: false },
      psych: { fearOfLoss: 1, mirrorObsession: 1, apathyOffCycle: 1 },
      injection: { glutes: '', quads: '', delts: '', localAreas: '' },
      powerLevel: 'mid' as const,
      courseWeek: 6,
    } as any;
    expect(() => runSupportUnified(state)).not.toThrow();
    expect(() => calculateSupportTZ(state)).not.toThrow();
  });
});
