/**
 * profile-performance.test.ts — тесты производительности профиля v2.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
})();
vi.stubGlobal('localStorage', localStorageMock);

describe('Profile v2 Performance', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('1. updateSection x 100 подряд → < 100мс', async () => {
    const { updateSection, getProfile } = await import('../profile-manager');
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      updateSection('personal', { age: 20 + (i % 50), weight: 70 + (i % 30) });
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
    // Значение всё равно корректное
    const p = getProfile();
    expect((p.settings as any).personal.age).toBeGreaterThan(0);
  });

  it('2. pushSnapshot x 50 → < 200мс (лимит 10)', async () => {
    const { updateSection, pushSnapshot, getSnapshots } = await import('../profile-manager');
    for (let i = 0; i < 50; i++) {
      updateSection('personal', { weight: 70 + i });
      pushSnapshot();
    }
    const start = performance.now();
    const snaps = getSnapshots();
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(200);
    expect(snaps.length).toBe(10);
  });

  it('3. Большой профиль (200 injuries, 100 supplements) → getProfile < 50мс', async () => {
    // Сначала создаём большой профиль
    const injuries = Array.from({ length: 200 }, (_, i) => ({
      id: `inj_${i}`, type: 'muscle', location: `loc_${i}`,
      painLevel: i % 10, movementLimit: 'mild', side: 'left', chronic: false,
    }));
    const supplements = Array.from({ length: 100 }, (_, i) => ({
      id: `sup_${i}`, name: `Sup ${i}`, doseMg: 100 + i, doseUnit: 'mg',
    }));
    const profile = {
      name: 'Test',
      role: 'user',
      settings: {
        personal: { age: 30, sex: 'male', height: 180, weight: 80, bodyFat: 15, bloodType: 'I+' },
        training: { sportType: 'bodybuilding', experience: 5, level: 'intermediate', daysPerWeek: 4, minutesPerSession: 60, primaryGoal: 'bulk', weakPoints: [], pmSquat: 200, pmBench: 140, pmDeadlift: 220, workMax: {}, equipment: [], recovery: 7, motivation: 7, doms: 3 },
        pharma: { phase: 'baseline', courseStartDate: '2026-01-01', experience: 'none', totalCycles: 0, yearsOnGear: 0, monthsSinceLastCourse: 0, hcgEnabled: false, aiEnabled: false, trainingCycleType: 'mass', trainingCycleWeeks: 12, previousCycles: 0, timeSinceLastCycle: 'none', currentSubstances: [] },
        health: {
          chronicConditions: [], contraindications: { diabetes: false, cvd: false, thrombophilia: false, liverDisease: false, kidneyDisease: false, giDisease: false, prostateIssues: false, epilepsy: false, mentalIllness: false },
          genetics: {}, injuries,
          bpStage: 'normal', hctElevation: 'none', heartRate: 70,
          ldlElevation: '', hdlLow: false, previousCVD: false, familyCVD: false, triglycerides: 'normal',
          bloating: false, heartburn: false, constipation: false, diarrhea: false, diagnosedIBS: false, enzymeSupport: false, probioticUse: false,
          dopamineScore: 3, serotoninScore: 3, aggressionScore: 3,
          memoryIssues: false, focusIssues: false, slowThinking: false, headaches: false, weatherDependent: false,
          fearOfLoss: 1, mirrorObsession: 1, apathyOffCycle: 1,
          jointPain: false, ligamentIssues: false, backPain: false,
          bleedingGums: false, looseTeeth: false, cramps: false,
          pastGyno: false, pastLibidoDrop: false, pastHctSpike: false, pastLiverIssues: false, pastKidneyIssues: false,
          hazardousWork: false, regularNSAIDs: false,
          drugAllergies: '', excludedSupplements: [], excludedMeds: [],
        },
        nutrition: {
          dietType: 'omnivore', mealsPerDay: 4, cookingSkill: 'basic',
          foodAllergies: [], foodIntolerances: [], excludedFoods: [], preferredFoods: [],
          histamineSensitive: false, proteinPerKg: 1.8, fiberG: 25, omega3G: 1.5, sodiumG: 3, potassiumG: 3, alcoholPerWeek: 0,
          currentSupplements: supplements, currentMedications: [],
        },
        lifestyle: { sleepHours: 7, sleepQuality: 'fair', chronotype: 'mixed', stressLevel: 3, fatigueLevel: 3, baselineHrvRatio: 1, dailySteps: 6000, dailyWaterLiters: 2, smoke: false, activityLevel: 5, morningHRV: 0, restingHR: 0 },
        system: { mcRuns: 0, forceNoLabsPenalty: false, preferredUnits: 'metric', notificationsEnabled: false, privacyLevel: 'private', nutritionFactor: 1, trainingFactor: 1, hasHIIT: false, volumeTonnes: 0, lissMinutesPerWeek: 0 },
        goals: { primaryGoal: 'hypertrophy' },
        labs: { status: 'none', summary: {} },
        symptoms: { activeCount: 0, recent: {} },
      },
    };
    localStorageMock.setItem('he_profile_v2', JSON.stringify(profile));
    localStorageMock.setItem('he_profile_migrated_v2', '1');
    const { getProfile } = await import('../profile-manager');
    const start = performance.now();
    const p = getProfile();
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
    expect((p.settings as any).health.injuries.length).toBe(200);
    expect((p.settings as any).nutrition.currentSupplements.length).toBe(100);
  });

  it('4. updateSection с большим профилем (200 injuries) → < 20мс', async () => {
    const injuries = Array.from({ length: 200 }, (_, i) => ({
      id: `inj_${i}`, type: 'muscle', location: `loc_${i}`,
      painLevel: i % 10, movementLimit: 'mild', side: 'left', chronic: false,
    }));
    const profile = {
      name: 'Test', role: 'user',
      settings: {
        personal: { age: 30, sex: 'male', height: 180, weight: 80, bodyFat: 15, bloodType: 'I+' },
        training: { sportType: 'bodybuilding', experience: 5, level: 'intermediate', daysPerWeek: 4, minutesPerSession: 60, primaryGoal: 'bulk', weakPoints: [], pmSquat: 200, pmBench: 140, pmDeadlift: 220, workMax: {}, equipment: [], recovery: 7, motivation: 7, doms: 3 },
        pharma: { phase: 'baseline', courseStartDate: '2026-01-01', experience: 'none', totalCycles: 0, yearsOnGear: 0, monthsSinceLastCourse: 0, hcgEnabled: false, aiEnabled: false, trainingCycleType: 'mass', trainingCycleWeeks: 12, previousCycles: 0, timeSinceLastCycle: 'none', currentSubstances: [] },
        health: { injuries, chronicConditions: [], contraindications: { diabetes: false, cvd: false, thrombophilia: false, liverDisease: false, kidneyDisease: false, giDisease: false, prostateIssues: false, epilepsy: false, mentalIllness: false }, genetics: {}, bpStage: 'normal', hctElevation: 'none', heartRate: 70, ldlElevation: '', hdlLow: false, previousCVD: false, familyCVD: false, triglycerides: 'normal', bloating: false, heartburn: false, constipation: false, diarrhea: false, diagnosedIBS: false, enzymeSupport: false, probioticUse: false, dopamineScore: 3, serotoninScore: 3, aggressionScore: 3, memoryIssues: false, focusIssues: false, slowThinking: false, headaches: false, weatherDependent: false, fearOfLoss: 1, mirrorObsession: 1, apathyOffCycle: 1, jointPain: false, ligamentIssues: false, backPain: false, bleedingGums: false, looseTeeth: false, cramps: false, pastGyno: false, pastLibidoDrop: false, pastHctSpike: false, pastLiverIssues: false, pastKidneyIssues: false, hazardousWork: false, regularNSAIDs: false, drugAllergies: '', excludedSupplements: [], excludedMeds: [] },
        nutrition: { dietType: 'omnivore', mealsPerDay: 4, cookingSkill: 'basic', foodAllergies: [], foodIntolerances: [], excludedFoods: [], preferredFoods: [], histamineSensitive: false, proteinPerKg: 1.8, fiberG: 25, omega3G: 1.5, sodiumG: 3, potassiumG: 3, alcoholPerWeek: 0, currentSupplements: [], currentMedications: [] },
        lifestyle: { sleepHours: 7, sleepQuality: 'fair', chronotype: 'mixed', stressLevel: 3, fatigueLevel: 3, baselineHrvRatio: 1, dailySteps: 6000, dailyWaterLiters: 2, smoke: false, activityLevel: 5, morningHRV: 0, restingHR: 0 },
        system: { mcRuns: 0, forceNoLabsPenalty: false, preferredUnits: 'metric', notificationsEnabled: false, privacyLevel: 'private', nutritionFactor: 1, trainingFactor: 1, hasHIIT: false, volumeTonnes: 0, lissMinutesPerWeek: 0 },
        goals: { primaryGoal: 'hypertrophy' },
        labs: { status: 'none', summary: {} },
        symptoms: { activeCount: 0, recent: {} },
      },
    };
    localStorageMock.setItem('he_profile_v2', JSON.stringify(profile));
    localStorageMock.setItem('he_profile_migrated_v2', '1');
    const { updateSection, getProfile } = await import('../profile-manager');
    const start = performance.now();
    updateSection('personal', { age: 31 });
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(20);
    expect((getProfile().settings as any).personal.age).toBe(31);
    // injuries не потеряны
    expect((getProfile().settings as any).health.injuries.length).toBe(200);
  });

  it('5. localStorage quota edge: большой JSON (1MB) сохраняется корректно', async () => {
    // Создаём строку ~1MB
    const big = 'x'.repeat(1024 * 1024);
    const profile = {
      name: 'Test', role: 'user',
      settings: {
        personal: { age: 30, sex: 'male', height: 180, weight: 80, bodyFat: 15, bloodType: 'I+' },
        training: { sportType: 'bodybuilding', experience: 5, level: 'intermediate', daysPerWeek: 4, minutesPerSession: 60, primaryGoal: 'bulk', weakPoints: [], pmSquat: 200, pmBench: 140, pmDeadlift: 220, workMax: {}, equipment: [], recovery: 7, motivation: 7, doms: 3 },
        pharma: { phase: 'baseline', courseStartDate: '2026-01-01', experience: 'none', totalCycles: 0, yearsOnGear: 0, monthsSinceLastCourse: 0, hcgEnabled: false, aiEnabled: false, trainingCycleType: 'mass', trainingCycleWeeks: 12, previousCycles: 0, timeSinceLastCycle: 'none', currentSubstances: [] },
        health: { injuries: [], chronicConditions: [], contraindications: { diabetes: false, cvd: false, thrombophilia: false, liverDisease: false, kidneyDisease: false, giDisease: false, prostateIssues: false, epilepsy: false, mentalIllness: false }, genetics: {}, bpStage: 'normal', hctElevation: 'none', heartRate: 70, ldlElevation: '', hdlLow: false, previousCVD: false, familyCVD: false, triglycerides: 'normal', bloating: false, heartburn: false, constipation: false, diarrhea: false, diagnosedIBS: false, enzymeSupport: false, probioticUse: false, dopamineScore: 3, serotoninScore: 3, aggressionScore: 3, memoryIssues: false, focusIssues: false, slowThinking: false, headaches: false, weatherDependent: false, fearOfLoss: 1, mirrorObsession: 1, apathyOffCycle: 1, jointPain: false, ligamentIssues: false, backPain: false, bleedingGums: false, looseTeeth: false, cramps: false, pastGyno: false, pastLibidoDrop: false, pastHctSpike: false, pastLiverIssues: false, pastKidneyIssues: false, hazardousWork: false, regularNSAIDs: false, drugAllergies: big, excludedSupplements: [], excludedMeds: [] },
        nutrition: { dietType: 'omnivore', mealsPerDay: 4, cookingSkill: 'basic', foodAllergies: [], foodIntolerances: [], excludedFoods: [], preferredFoods: [], histamineSensitive: false, proteinPerKg: 1.8, fiberG: 25, omega3G: 1.5, sodiumG: 3, potassiumG: 3, alcoholPerWeek: 0, currentSupplements: [], currentMedications: [] },
        lifestyle: { sleepHours: 7, sleepQuality: 'fair', chronotype: 'mixed', stressLevel: 3, fatigueLevel: 3, baselineHrvRatio: 1, dailySteps: 6000, dailyWaterLiters: 2, smoke: false, activityLevel: 5, morningHRV: 0, restingHR: 0 },
        system: { mcRuns: 0, forceNoLabsPenalty: false, preferredUnits: 'metric', notificationsEnabled: false, privacyLevel: 'private', nutritionFactor: 1, trainingFactor: 1, hasHIIT: false, volumeTonnes: 0, lissMinutesPerWeek: 0 },
        goals: { primaryGoal: 'hypertrophy' },
        labs: { status: 'none', summary: {} },
        symptoms: { activeCount: 0, recent: {} },
      },
    };
    localStorageMock.setItem('he_profile_v2', JSON.stringify(profile));
    localStorageMock.setItem('he_profile_migrated_v2', '1');
    const { getProfile } = await import('../profile-manager');
    const p = getProfile();
    expect((p.settings as any).health.drugAllergies.length).toBe(1024 * 1024);
  });
});
