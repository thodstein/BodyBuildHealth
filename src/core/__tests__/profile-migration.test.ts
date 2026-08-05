/**
 * profile-migration.test.ts — тесты миграции дублей в UnifiedSettings.
 * Покрывает: he_training_profile, he_autocalc_state, he_contraindications,
 *            he_nutrition_profile, nutrition planner keys, BB/peak/life stage.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock localStorage
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

describe('Profile Migration', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('1. Мигрирует he_training_profile → UnifiedSettings', async () => {
    localStorage.setItem('he_training_profile', JSON.stringify({
      bodyWeight: 85, goal: 'bulk', level: 'intermediate', daysPerWeek: 5,
      recovery: 8, fatigue: 2, sleepHours: 7.5, stressLevel: 4,
      weakPoints: ['chest', 'biceps'], equipment: ['barbell', 'dumbbell'],
      pmSquat: 180, pmBench: 130, pmDead: 200,
      workMax: { chest: 100, back: 110 },
      onCourse: true, courseIntensity: 'moderate',
      pharmaCoursesCount: 3, monthsSinceLastCourse: 6, totalYearsOnPharma: 4,
      trainingYears: 6,
    }));
    const { getSettings } = await import('../../engines/unified-profile');
    const s = getSettings();
    expect(s.personal.weight).toBe(85);
    expect(s.training.primaryGoal).toBe('bulk');
    expect(s.training.level).toBe('intermediate');
    expect(s.training.daysPerWeek).toBe(5);
    expect(s.training.recovery).toBe(8);
    expect(s.training.experience).toBe(6);
    expect(s.lifestyle.fatigueLevel).toBe(2);
    expect(s.lifestyle.sleepHours).toBe(7.5);
    expect(s.lifestyle.stressLevel).toBe(4);
    expect(s.training.weakPoints).toEqual(['chest', 'biceps']);
    expect(s.training.equipment).toEqual(['barbell', 'dumbbell']);
    expect(s.training.pmSquat).toBe(180);
    expect(s.training.pmBench).toBe(130);
    expect(s.training.pmDeadlift).toBe(200);
    expect(s.training.workMax.chest).toBe(100);
    expect(s.pharma.phase).toBe('course');
    expect(s.pharma.totalCycles).toBe(3);
    expect(s.pharma.monthsSinceLastCourse).toBe(6);
    expect(s.pharma.yearsOnGear).toBe(4);
  });

  it('2. Мигрирует he_autocalc_state (neuro, cardio, gi, psych)', async () => {
    localStorage.setItem('he_autocalc_state', JSON.stringify({
      profile: { age: 30, weight: 80, height: 180, sex: 'male' },
      neuro: { dopamineScore: 4, serotoninScore: 3, aggressionScore: 5, memoryIssues: true, focusIssues: false },
      cardio: { bpStage: 'prehypertension', hctElevation: 'mild', heartRate: 78, ldlElevation: 'high', hdlLow: true, previousCVD: false, familyCVD: true, triglycerides: 'normal' },
      gi: { bloating: true, heartburn: false, constipation: false, diarrhea: false },
      psych: { fearOfLoss: 4, mirrorObsession: 5, apathyOffCycle: 2 },
      oda: { jointPain: 'mild', ligamentIssues: false, backPain: true },
      epicrisis: { pastGyno: true, pastLibidoDrop: false, pastHctSpike: false, pastLiverIssues: false, pastKidneyIssues: false },
      toxicLoad: { hazardousWork: false, regularNSAIDs: true },
      dental: { bleedingGums: false, looseTeeth: false, cramps: true },
      contraindications: { hasDiabetes: true, hasCVD: false, hasThrombophilia: false },
    }));
    const { getSettings } = await import('../../engines/unified-profile');
    const s = getSettings();
    expect(s.health.dopamineScore).toBe(4);
    expect(s.health.memoryIssues).toBe(true);
    expect(s.health.bpStage).toBe('prehypertension');
    expect(s.health.heartRate).toBe(78);
    expect(s.health.previousCVD).toBe(false);
    expect(s.health.familyCVD).toBe(true);
    expect(s.health.bloating).toBe(true);
    expect(s.health.fearOfLoss).toBe(4);
    expect(s.health.jointPain).toBe(true); // oda.jointPain='mild' → true
    expect(s.health.ligamentIssues).toBe(false);
    expect(s.health.backPain).toBe(true);
    expect(s.health.pastGyno).toBe(true);
    expect(s.health.regularNSAIDs).toBe(true);
    expect(s.health.cramps).toBe(true);
    expect(s.health.contraindications.diabetes).toBe(true);
  });

  it('3. Мигрирует he_food_allergens, he_health_issues, he_preferred_foods', async () => {
    localStorage.setItem('he_food_allergens', JSON.stringify(['lactose', 'gluten']));
    localStorage.setItem('he_health_issues', JSON.stringify(['diabetes', 'asthma']));
    localStorage.setItem('he_preferred_foods', JSON.stringify(['chicken_breast', 'rice_white']));
    localStorage.setItem('he_excluded_foods', JSON.stringify(['fast_food_burger']));
    const { getSettings } = await import('../../engines/unified-profile');
    const s = getSettings();
    expect(s.nutrition.foodAllergies).toContain('lactose');
    expect(s.nutrition.foodAllergies).toContain('gluten');
    expect(s.health.chronicConditions).toContain('diabetes');
    expect(s.health.chronicConditions).toContain('asthma');
    expect(s.nutrition.preferredFoods).toContain('chicken_breast');
    expect(s.nutrition.excludedFoods).toContain('fast_food_burger');
  });

  it('4. Мигрирует he_manual_kcal/p/f/c → nutrition.manualTargets', async () => {
    localStorage.setItem('he_manual_kcal', '2400');
    localStorage.setItem('he_manual_p', '180');
    localStorage.setItem('he_manual_f', '70');
    localStorage.setItem('he_manual_c', '280');
    const { getSettings } = await import('../../engines/unified-profile');
    const s = getSettings();
    expect(s.nutrition.manualTargets).toEqual({ kcal: 2400, protein: 180, fat: 70, carbs: 280 });
  });

  it('5. Мигрирует he_kbju_mode, he_evening_low_carb, he_surplus_pct', async () => {
    localStorage.setItem('he_kbju_mode', 'manual');
    localStorage.setItem('he_evening_low_carb', 'true');
    localStorage.setItem('he_surplus_pct', '15');
    localStorage.setItem('he_variety_strictness', 'high');
    localStorage.setItem('he_specificity', 'specific');
    const { getSettings } = await import('../../engines/unified-profile');
    const s = getSettings();
    expect(s.nutrition.kbjuMode).toBe('manual');
    expect(s.nutrition.eveningLowCarb).toBe(true);
    expect(s.nutrition.surplusPct).toBe(15);
    expect(s.nutrition.varietyStrictness).toBe('high');
    expect(s.nutrition.specificity).toBe('specific');
  });

  it('6. Мигрирует he_bb_category, he_peak_week, he_life_stage → goals', async () => {
    localStorage.setItem('he_bb_category', "Men's Physique");
    localStorage.setItem('he_peak_week', 'true');
    localStorage.setItem('he_peak_show_day', '2026-12-15');
    localStorage.setItem('he_life_stage', 'cut');
    const { getSettings } = await import('../../engines/unified-profile');
    const s = getSettings();
    expect(s.goals.bbCategory).toBe("Men's Physique");
    expect(s.goals.peakWeek).toBe(true);
    expect(s.goals.peakShowDay).toBe('2026-12-15');
    expect(s.goals.lifeStage).toBe('cut');
  });

  it('7. Мигрирует he_planner_histamine → nutrition.histamineSensitive', async () => {
    localStorage.setItem('he_planner_histamine', 'true');
    const { getSettings } = await import('../../engines/unified-profile');
    const s = getSettings();
    expect(s.nutrition.histamineSensitive).toBe(true);
  });

  it('8. Мигрирует he_preferred_by_meal → nutrition.preferredByMeal', async () => {
    localStorage.setItem('he_preferred_by_meal', JSON.stringify({
      breakfast: ['oatmeal', 'egg_whole'],
      lunch: ['chicken_breast', 'rice_white'],
    }));
    const { getSettings } = await import('../../engines/unified-profile');
    const s = getSettings();
    expect(s.nutrition.preferredByMeal).toEqual({
      breakfast: ['oatmeal', 'egg_whole'],
      lunch: ['chicken_breast', 'rice_white'],
    });
  });

  it('9. Удаляет старые ключи после миграции', async () => {
    localStorage.setItem('he_training_profile', JSON.stringify({ bodyWeight: 80 }));
    localStorage.setItem('he_autocalc_state', JSON.stringify({}));
    localStorage.setItem('he_food_allergens', JSON.stringify(['lactose']));
    const { getSettings } = await import('../../engines/unified-profile');
    getSettings();
    expect(localStorage.getItem('he_training_profile')).toBeNull();
    expect(localStorage.getItem('he_autocalc_state')).toBeNull();
    expect(localStorage.getItem('he_food_allergens')).toBeNull();
  });

  it('10. Идемпотентность — повторный getSettings не сбрасывает данные', async () => {
    localStorage.setItem('he_training_profile', JSON.stringify({ bodyWeight: 85, goal: 'cut' }));
    const { getSettings } = await import('../../engines/unified-profile');
    const s1 = getSettings();
    const s2 = getSettings();
    expect(s1.personal.weight).toBe(85);
    expect(s2.personal.weight).toBe(85);
    expect(s1.training.primaryGoal).toBe('cut');
    expect(s2.training.primaryGoal).toBe('cut');
  });

  it('11. corrupted data — не падает', async () => {
    localStorage.setItem('he_training_profile', '{invalid json');
    localStorage.setItem('he_food_allergens', 'null');
    const { getSettings } = await import('../../engines/unified-profile');
    const s = getSettings();
    expect(s).toBeDefined();
    expect(s.personal.age).toBeGreaterThan(0);
  });

  it('12. Мигрирует he_contraindications → profile (legacy compat)', async () => {
    localStorage.setItem('he_contraindications', JSON.stringify({
      chronicConditions: ['asthma', 'thyroid'],
      foodAllergies: ['nuts'],
      foodIntolerances: ['lactose'],
      excludedFoods: ['fast_food'],
      allergyNotes: 'аспирин',
    }));
    const { getContraindications } = await import('../../core/contraindications');
    const data = getContraindications();
    expect(data.chronicConditions).toContain('asthma');
    expect(data.foodAllergies).toContain('nuts');
    expect(data.allergyNotes).toBe('аспирин');
  });
});
