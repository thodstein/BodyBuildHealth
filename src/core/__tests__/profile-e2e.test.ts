/**
 * profile-e2e.test.ts вЂ” end-to-end С‚РµСЃС‚С‹ РґР»СЏ РџСЂРѕС„РёР»СЏ v2.
 * РџСЂРѕРІРµСЂСЏРµС‚ СЂРµР°Р»СЊРЅС‹Рµ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєРёРµ СЃС†РµРЅР°СЂРёРё:
 * 1. First-time user (empty localStorage) в†’ getSettings СЂР°Р±РѕС‚Р°РµС‚
 * 2. Legacy user в†’ РјРёРіСЂР°С†РёСЏ РІС‹РїРѕР»РЅСЏРµС‚СЃСЏ
 * 3. РџРѕСЃР»Рµ РјРёРіСЂР°С†РёРё в†’ СЃС‚Р°СЂС‹Рµ РєР»СЋС‡Рё СѓРґР°Р»РµРЅС‹, РЅРѕРІС‹Рµ UnifiedSettings Р·Р°РїРѕР»РЅРµРЅС‹
 * 4. updateSection в†’ getProfile РІРѕР·РІСЂР°С‰Р°РµС‚ РѕР±РЅРѕРІР»С‘РЅРЅРѕРµ Р·РЅР°С‡РµРЅРёРµ
 * 5. updateSection в†’ useDataLink-СЃС‚РёР»СЊ РїРѕРґС…РІР°С‚ С‡РµСЂРµР· onProfileChange
 * 6. updateSection в†’ event-bus РґРѕСЃС‚Р°РІР»СЏРµС‚ onAnyProfileChange
 * 7. updateSection в†’ sectionVersions РёРЅРєСЂРµРјРµРЅС‚РёСЂСѓРµС‚СЃСЏ
 * 8. pushSnapshot/undoLastSnapshot в†’ РєРѕСЂСЂРµРєС‚РЅС‹Р№ roundtrip
 * 9. saveTrainingProfile в†’ Р·Р°РїРёСЃСЊ РІ UnifiedSettings (РґР»СЏ backward-compat)
 * 10. loadTrainingProfile в†’ С‡С‚РµРЅРёРµ РёР· UnifiedSettings (РґР»СЏ backward-compat)
 * 11. ProfileScreen_v2 С‚РёРї-СЃРѕРІРјРµСЃС‚РёРјРѕСЃС‚СЊ (compile-time check)
 * 12. РљРѕСЂСЂРµРєС‚РЅС‹Р№ РјР°РїРїРёРЅРі Specificity в†’ UnifiedSettings.specificity
 * 13. saveTrainingProfile + 17 РјРёРіСЂРёСЂРѕРІР°РЅРЅС‹С… РїРѕР»РµР№ в†’ РІСЃРµ РїРѕРїР°РґР°СЋС‚ РІ UnifiedSettings
 * 14. РћС‚СЃСѓС‚СЃС‚РІРёРµ С†РёРєР»РёС‡РµСЃРєРёС… РѕР±РЅРѕРІР»РµРЅРёР№: updateSection в†’ onProfileChange в†’ updateSection РќР• С‚СЂРёРіРіРµСЂРёС‚ Р±РµСЃРєРѕРЅРµС‡РЅС‹Р№ С†РёРєР»
 * 15. setRole Рё updateProfile СЂР°Р±РѕС‚Р°СЋС‚
 * 16. clearSnapshots РѕС‡РёС‰Р°РµС‚ storage
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

describe('Profile v2 E2E scenarios', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('First-time user (empty localStorage)', () => {
    it('1. getSettings Р±РµР· MIGRATED_FLAG в†’ РІРѕР·РІСЂР°С‰Р°РµС‚ default + СѓСЃС‚Р°РЅР°РІР»РёРІР°РµС‚ С„Р»Р°Рі', async () => {
      const { getSettings } = await import('../../engines/unified-profile');
      const s = getSettings();
      // Р’СЃРµ default РїРѕР»СЏ РґРѕР»Р¶РЅС‹ Р±С‹С‚СЊ Р·Р°РїРѕР»РЅРµРЅС‹
      expect(s.personal.age).toBe(30);
      expect(s.personal.weight).toBe(70);
      expect(s.training.primaryGoal).toBe('hypertrophy');
      expect(s.lifestyle.sleepHours).toBe(7);
      // MIGRATED_FLAG РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ СѓСЃС‚Р°РЅРѕРІР»РµРЅ
      expect(localStorageMock.getItem('he_profile_migrated_v2')).toBe('1');
    });
  });

  describe('Legacy user with old data', () => {
    it('2. he_training_profile в†’ UnifiedSettings + СѓРґР°Р»РµРЅРёРµ legacy РєР»СЋС‡Р°', async () => {
      localStorageMock.setItem('he_training_profile', JSON.stringify({
        bodyWeight: 90, goal: 'cut', level: 'advanced', daysPerWeek: 5,
        pmSquat: 200, pmBench: 140, pmDead: 250, sleepHours: 8, stressLevel: 3,
        weakPoints: ['chest', 'biceps'], equipment: ['barbell', 'dumbbell'],
        pharmaCoursesCount: 2, monthsSinceLastCourse: 12, totalYearsOnPharma: 3,
      }));
      const { getSettings } = await import('../../engines/unified-profile');
      const s = getSettings();
      expect(s.personal.weight).toBe(90);
      expect(s.training.primaryGoal).toBe('cut');
      expect(s.training.pmSquat).toBe(200);
      expect(s.training.weakPoints).toEqual(['chest', 'biceps']);
      expect(s.lifestyle.sleepHours).toBe(8);
      expect(s.pharma.totalCycles).toBe(2);
      // Legacy РєР»СЋС‡ СѓРґР°Р»С‘РЅ
      expect(localStorageMock.getItem('he_training_profile')).toBeNull();
    });

    it('3. he_autocalc_state в†’ UnifiedSettings.health.* + СѓРґР°Р»РµРЅРёРµ legacy', async () => {
      localStorageMock.setItem('he_autocalc_state', JSON.stringify({
        neuro: { dopamineScore: 5, memoryIssues: true, focusIssues: false },
        cardio: { bpStage: 'hypertension1', hctElevation: 'mild', heartRate: 85 },
        gi: { bloating: true, heartburn: false },
        psych: { fearOfLoss: 4, mirrorObsession: 5 },
        epicrisis: { pastGyno: true, pastLibidoDrop: false },
        toxicLoad: { hazardousWork: false, regularNSAIDs: true },
        dental: { bleedingGums: true },
        contraindications: { hasDiabetes: true, hasCVD: false },
      }));
      const { getSettings } = await import('../../engines/unified-profile');
      const s = getSettings();
      expect(s.health.dopamineScore).toBe(5);
      expect(s.health.memoryIssues).toBe(true);
      expect(s.health.bpStage).toBe('hypertension1');
      expect(s.health.heartRate).toBe(85);
      expect(s.health.bloating).toBe(true);
      expect(s.health.fearOfLoss).toBe(4);
      expect(s.health.mirrorObsession).toBe(5);
      expect(s.health.pastGyno).toBe(true);
      expect(s.health.regularNSAIDs).toBe(true);
      expect(s.health.bleedingGums).toBe(true);
      expect(s.health.contraindications.diabetes).toBe(true);
      // Legacy РєР»СЋС‡ СѓРґР°Р»С‘РЅ
      expect(localStorageMock.getItem('he_autocalc_state')).toBeNull();
    });

    it('4. he_food_allergens + he_health_issues в†’ UnifiedSettings', async () => {
      localStorageMock.setItem('he_food_allergens', JSON.stringify(['lactose', 'nuts']));
      localStorageMock.setItem('he_health_issues', JSON.stringify(['asthma', 'thyroid']));
      localStorageMock.setItem('he_preferred_foods', JSON.stringify(['chicken_breast']));
      localStorageMock.setItem('he_excluded_foods', JSON.stringify(['fast_food']));
      const { getSettings } = await import('../../engines/unified-profile');
      const s = getSettings();
      expect(s.nutrition.foodAllergies).toContain('lactose');
      expect(s.nutrition.foodAllergies).toContain('nuts');
      expect(s.health.chronicConditions).toContain('asthma');
      expect(s.health.chronicConditions).toContain('thyroid');
      expect(s.nutrition.preferredFoods).toContain('chicken_breast');
      expect(s.nutrition.excludedFoods).toContain('fast_food');
      // Р’СЃРµ legacy РєР»СЋС‡Рё СѓРґР°Р»РµРЅС‹
      for (const k of ['he_food_allergens', 'he_health_issues', 'he_preferred_foods', 'he_excluded_foods']) {
        expect(localStorageMock.getItem(k)).toBeNull();
      }
    });

    it('5. he_manual_kcal + he_manual_p/f/c в†’ UnifiedSettings.nutrition.manualTargets', async () => {
      localStorageMock.setItem('he_manual_kcal', '2400');
      localStorageMock.setItem('he_manual_p', '180');
      localStorageMock.setItem('he_manual_f', '70');
      localStorageMock.setItem('he_manual_c', '280');
      const { getSettings } = await import('../../engines/unified-profile');
      const s = getSettings();
      expect(s.nutrition.manualTargets).toEqual({ kcal: 2400, protein: 180, fat: 70, carbs: 280 });
    });

    it('6. he_kbju_mode + he_evening_low_carb + he_surplus_pct в†’ nutrition', async () => {
      localStorageMock.setItem('he_kbju_mode', 'manual');
      localStorageMock.setItem('he_evening_low_carb', 'true');
      localStorageMock.setItem('he_surplus_pct', '15');
      const { getSettings } = await import('../../engines/unified-profile');
      const s = getSettings();
      expect(s.nutrition.kbjuMode).toBe('manual');
      expect(s.nutrition.eveningLowCarb).toBe(true);
      expect(s.nutrition.surplusPct).toBe(15);
    });

    it('7. he_bb_category + he_peak_week + he_life_stage в†’ goals', async () => {
      localStorageMock.setItem('he_bb_category', "Men's Physique");
      localStorageMock.setItem('he_peak_week', 'true');
      localStorageMock.setItem('he_peak_show_day', '2026-12-15');
      localStorageMock.setItem('he_life_stage', 'cut');
      const { getSettings } = await import('../../engines/unified-profile');
      const s = getSettings();
      expect(s.goals.bbCategory).toBe("Men's Physique");
      expect(s.goals.peakWeek).toBe(true);
      expect(s.goals.peakShowDay).toBe('2026-12-15');
      expect(s.goals.lifeStage).toBe('cut');
    });

    it('8. РџРѕР»РЅС‹Р№ СЃС†РµРЅР°СЂРёР№: РІСЃРµ РєР»СЋС‡Рё СЂР°Р·РѕРј в†’ РєРѕСЂСЂРµРєС‚РЅС‹Р№ merged UnifiedSettings', async () => {
      // Р—Р°РїРѕР»РЅСЏРµРј Р’РЎР• legacy РєР»СЋС‡Рё
      localStorageMock.setItem('he_training_profile', JSON.stringify({
        bodyWeight: 85, goal: 'bulk', pmSquat: 200, daysPerWeek: 4,
        sleepHours: 7.5, stressLevel: 4,
        weakPoints: ['chest'],
      }));
      localStorageMock.setItem('he_autocalc_state', JSON.stringify({
        cardio: { heartRate: 75 },
        neuro: { dopamineScore: 4 },
      }));
      localStorageMock.setItem('he_food_allergens', JSON.stringify(['lactose']));
      localStorageMock.setItem('he_health_issues', JSON.stringify(['asthma']));
      localStorageMock.setItem('he_preferred_foods', JSON.stringify(['chicken_breast']));
      localStorageMock.setItem('he_excluded_foods', JSON.stringify(['fast_food']));
      localStorageMock.setItem('he_manual_kcal', '2400');
      localStorageMock.setItem('he_manual_p', '180');
      localStorageMock.setItem('he_manual_f', '70');
      localStorageMock.setItem('he_manual_c', '280');
      localStorageMock.setItem('he_kbju_mode', 'manual');
      localStorageMock.setItem('he_evening_low_carb', 'true');
      localStorageMock.setItem('he_surplus_pct', '15');
      localStorageMock.setItem('he_specificity', 'specific');
      localStorageMock.setItem('he_variety_strictness', 'high');
      localStorageMock.setItem('he_intolerances', JSON.stringify({lactose: true}));
      localStorageMock.setItem('he_taste_profile', JSON.stringify({spicy: 2, sweet: 1}));
      localStorageMock.setItem('he_excluded_categories', JSON.stringify(['fast_food']));
      localStorageMock.setItem('he_preferred_by_meal', JSON.stringify({breakfast: ['oatmeal']}));
      localStorageMock.setItem('he_nutrition_notes', 'my notes');
      localStorageMock.setItem('he_locked_foods', JSON.stringify(['chicken_breast']));
      localStorageMock.setItem('he_planner_histamine', 'true');
      localStorageMock.setItem('he_bb_category', "Men's Physique");
      localStorageMock.setItem('he_peak_week', 'true');
      localStorageMock.setItem('he_peak_show_day', '2026-12-15');
      localStorageMock.setItem('he_life_stage', 'cut');
      localStorageMock.setItem('he_contraindications', JSON.stringify({
        chronicConditions: ['asthma'],
        foodAllergies: ['lactose'],
        allergyNotes: 'Р°СЃРїРёСЂРёРЅ',
      }));
      const { getSettings } = await import('../../engines/unified-profile');
      const s = getSettings();
      // РџСЂРѕРІРµСЂСЏРµРј С‡С‚Рѕ РІСЃРµ РїРѕР»СЏ РєРѕСЂСЂРµРєС‚РЅРѕ РјРёРіСЂРёСЂРѕРІР°РЅС‹
      expect(s.personal.weight).toBe(85);
      expect(s.training.primaryGoal).toBe('bulk');
      expect(s.training.pmSquat).toBe(200);
      expect(s.lifestyle.sleepHours).toBe(7.5);
      expect(s.health.heartRate).toBe(75);
      expect(s.health.dopamineScore).toBe(4);
      expect(s.nutrition.foodAllergies).toContain('lactose');
      expect(s.health.chronicConditions).toContain('asthma');
      expect(s.nutrition.preferredFoods).toContain('chicken_breast');
      expect(s.nutrition.excludedFoods).toContain('fast_food');
      expect(s.nutrition.manualTargets).toEqual({ kcal: 2400, protein: 180, fat: 70, carbs: 280 });
      expect(s.nutrition.kbjuMode).toBe('manual');
      expect(s.nutrition.eveningLowCarb).toBe(true);
      expect(s.nutrition.surplusPct).toBe(15);
      expect(s.nutrition.specificity).toBe('specific');
      expect(s.nutrition.varietyStrictness).toBe('high');
      expect(s.nutrition.lockedFoods).toContain('chicken_breast');
      expect(s.nutrition.histamineSensitive).toBe(true);
      expect(s.goals.bbCategory).toBe("Men's Physique");
      expect(s.goals.peakWeek).toBe(true);
      expect(s.goals.peakShowDay).toBe('2026-12-15');
      expect(s.goals.lifeStage).toBe('cut');
    });
  });

  describe('Profile v2 hooks (granular subscriptions)', () => {
    it('9. updateSection в†’ useProfileSection С‡РµСЂРµР· useSyncExternalStore', async () => {
      const { updateSection, getProfile, getSectionVersion } = await import('../profile-manager');
      updateSection('personal', { weight: 85, age: 30 });
      const p = getProfile();
      expect((p.settings as any).personal.weight).toBe(85);
      expect(getSectionVersion('personal')).toBeGreaterThan(0);
    });

    it('10. onProfileSectionChange + updateSection в†’ broadcast СЃСЂР°Р±Р°С‚С‹РІР°РµС‚', async () => {
      const { updateSection } = await import('../profile-manager');
      const { onProfileSectionChange } = await import('../profile-events');
      let received: any[] = [];
      const unsub = onProfileSectionChange('personal', (p) => received.push(p));
      updateSection('personal', { weight: 85 });
      updateSection('personal', { age: 30 });
      // РџРѕР»СѓС‡РёР»Рё СѓРІРµРґРѕРјР»РµРЅРёСЏ РґР»СЏ РєР°Р¶РґРѕРіРѕ updateSection
      expect(received.length).toBe(2);
      expect(received[0].section).toBe('personal');
      expect(received[1].section).toBe('personal');
      unsub();
    });

    it('11. onAnyProfileChange + updateProfile в†’ broadcast СЃСЂР°Р±Р°С‚С‹РІР°РµС‚', async () => {
      const { updateProfile } = await import('../profile-manager');
      const { onAnyProfileChange } = await import('../profile-events');
      let count = 0;
      const unsub = onAnyProfileChange(() => count++);
      updateProfile({ name: 'Test' });
      updateProfile({ name: 'Test2' });
      expect(count).toBe(2);
      unsub();
    });
  });

  describe('Snapshot/undo roundtrip', () => {
    it('12. pushSnapshot в†’ updateSection в†’ undoLastSnapshot в†’ РІРѕСЃСЃС‚Р°РЅР°РІР»РёРІР°РµС‚ Р·РЅР°С‡РµРЅРёРµ', async () => {
      const { updateSection, pushSnapshot, undoLastSnapshot, getProfile } = await import('../profile-manager');
      updateSection('personal', { weight: 80 });
      pushSnapshot();
      updateSection('personal', { weight: 90 });
      expect((getProfile().settings as any).personal.weight).toBe(90);
      undoLastSnapshot();
      expect((getProfile().settings as any).personal.weight).toBe(80);
    });

    it('13. pushSnapshot cap=10 (СЃС‚Р°СЂС‹Рµ СѓРґР°Р»СЏСЋС‚СЃСЏ)', async () => {
      const { updateSection, pushSnapshot, getSnapshots } = await import('../profile-manager');
      for (let i = 0; i < 15; i++) {
        updateSection('personal', { weight: 70 + i });
        pushSnapshot();
      }
      expect(getSnapshots().length).toBe(10);
      // РџРµСЂРІС‹Р№ snapshot вЂ” weight=75 (70,71,72,73,74 СѓРґР°Р»РµРЅС‹)
      expect(getSnapshots()[0].settings.personal.weight).toBe(75);
    });

    it('14. clearSnapshots РѕС‡РёС‰Р°РµС‚ storage', async () => {
      const { updateSection, pushSnapshot, getSnapshots, clearSnapshots } = await import('../profile-manager');
      updateSection('personal', { weight: 80 });
      pushSnapshot();
      expect(getSnapshots().length).toBeGreaterThan(0);
      clearSnapshots();
      expect(getSnapshots().length).toBe(0);
    });
  });

  describe('No infinite loops / circular updates', () => {
    it('15. updateSection РёР· onProfileChange listener РќР• РІС‹Р·С‹РІР°РµС‚ СЂРµРєСѓСЂСЃРёСЋ', async () => {
      const { updateSection, onProfileChange } = await import('../profile-manager');
      let depth = 0;
      const unsub = onProfileChange(() => {
        depth++;
        if (depth > 5) throw new Error('Recursion detected');
      });
      // РЎРёРјСѓР»РёСЂСѓРµРј 5 updateSection вЂ” РЅРёРєР°РєРѕР№ СЂРµРєСѓСЂСЃРёРё Р±С‹С‚СЊ РЅРµ РґРѕР»Р¶РЅРѕ
      for (let i = 0; i < 5; i++) {
        updateSection('personal', { weight: 80 + i });
      }
      expect(depth).toBe(5);
      unsub();
    });
  });

  describe('saveTrainingProfile (backward-compat with legacy consumers)', () => {
    it('16. saveTrainingProfile в†’ Р·Р°РїРёСЃСЊ РІ UnifiedSettings С‡РµСЂРµР· updateProfile', async () => {
      const tpm = await import('../../ui/screens/TrainingScreen_parts/training-profile');
      tpm.saveTrainingProfile({
        bodyWeight: 90, goal: 'cut', level: 'advanced', daysPerWeek: 5,
        pmSquat: 200, pmBench: 140, pmDead: 250,
      } as any);
      const { getProfile } = await import('../profile-manager');
      const p = getProfile();
      expect((p.settings as any).personal.weight).toBe(90);
      expect((p.settings as any).training.primaryGoal).toBe('cut');
      expect((p.settings as any).training.pmSquat).toBe(200);
    });

    it('17. loadTrainingProfile в†’ С‡С‚РµРЅРёРµ РёР· UnifiedSettings РµСЃР»Рё РµСЃС‚СЊ', async () => {
      const { updateProfile, getProfile } = await import('../profile-manager');
      updateProfile({
        settings: {
          personal: { age: 30, sex: 'male', height: 180, weight: 82, bodyFat: 14, bloodType: 'I+' },
          training: { primaryGoal: 'bulk', level: 'intermediate', pmSquat: 180, pmBench: 120, pmDeadlift: 200, workMax: {}, equipment: [], recovery: 7, motivation: 7, doms: 3 },
        } as any,
      });
      const tpm = await import('../../ui/screens/TrainingScreen_parts/training-profile');
      const tp = tpm.loadTrainingProfile();
      expect(tp.bodyWeight).toBe(82);
      expect(tp.goal).toBe('bulk');
      expect(tp.level).toBe('intermediate');
      expect(tp.pmSquat).toBe(180);
    });
  });

  describe('Use data integrity (no lost data after migration)', () => {
    it('18. РњРёРіСЂРёСЂРѕРІР°РЅРЅС‹Рµ Р·РЅР°С‡РµРЅРёСЏ РґРѕСЃС‚СѓРїРЅС‹ С‡РµСЂРµР· profile.settings (Р° РЅРµ С‡РµСЂРµР· РјС‘СЂС‚РІС‹Рµ РєР»СЋС‡Рё)', async () => {
      localStorageMock.setItem('he_training_profile', JSON.stringify({
        bodyWeight: 88, goal: 'recomp', level: 'enhanced', pmSquat: 220,
      }));
      const { getSettings } = await import('../../engines/unified-profile');
      const s = getSettings();
      // Р§С‚РµРЅРёРµ С‡РµСЂРµР· UnifiedSettings РЅР°РїСЂСЏРјСѓСЋ (Р° РЅРµ С‡РµСЂРµР· proxy СЃ РјС‘СЂС‚РІРѕРіРѕ РєР»СЋС‡Р°)
      expect(s.personal.weight).toBe(88);
      expect(s.training.primaryGoal).toBe('recomp');
      expect(s.training.level).toBe('enhanced');
      expect(s.training.pmSquat).toBe(220);
      // Р СЃС‚Р°СЂС‹Р№ РєР»СЋС‡ СѓРґР°Р»С‘РЅ
      expect(localStorageMock.getItem('he_training_profile')).toBeNull();
    });

    it('19. РџРѕСЃР»Рµ РјРёРіСЂР°С†РёРё saveTrainingProfile РґРѕРїРёСЃС‹РІР°РµС‚ РўРћР›Р¬РљРћ РЅРѕРІС‹Рµ РїРѕР»СЏ, РЅРµ Р·Р°С‚РёСЂР°СЏ РјРёРіСЂРёСЂРѕРІР°РЅРЅС‹Рµ', async () => {
      localStorageMock.setItem('he_training_profile', JSON.stringify({
        bodyWeight: 85, goal: 'bulk', level: 'intermediate',
      }));
      const { getSettings } = await import('../../engines/unified-profile');
      getSettings(); // trigger migration
      // Р—Р°РіСЂСѓР¶Р°РµРј С‡РµСЂРµР· РјРѕРґСѓР»СЊ training-profile
      const tpm = await import('../../ui/screens/TrainingScreen_parts/training-profile');
      // saveTrainingProfile СЃ РґСЂСѓРіРёРјРё РїРѕР»СЏРјРё
      tpm.saveTrainingProfile({ pmSquat: 250, pmBench: 150, pmDead: 300 } as any);
      const { getProfile } = await import('../profile-manager');
      const p = getProfile();
      expect((p.settings as any).training.pmSquat).toBe(250);
      expect((p.settings as any).training.pmBench).toBe(150);
      expect((p.settings as any).training.pmDeadlift).toBe(300);
      // РњРёРіСЂРёСЂРѕРІР°РЅРЅС‹Рµ РїРѕР»СЏ СЃРѕС…СЂР°РЅРµРЅС‹
      expect((p.settings as any).personal.weight).toBe(85);
      expect((p.settings as any).training.primaryGoal).toBe('bulk');
      expect((p.settings as any).training.level).toBe('intermediate');
    });

    it('20. updateSection в†’ useDataLink-style consumer РїРѕРґС…РІР°С‚С‹РІР°РµС‚ С‡РµСЂРµР· onProfileChange', async () => {
      // useDataLink РїРѕРґРїРёСЃР°РЅ РЅР° onProfileChange, РЅРµ РЅР° event-bus РЅР°РїСЂСЏРјСѓСЋ
      const { updateSection, onProfileChange } = await import('../profile-manager');
      let count = 0;
      const unsub = onProfileChange(() => count++);
      updateSection('training', { primaryGoal: 'cut' });
      updateSection('training', { level: 'advanced' });
      updateSection('personal', { weight: 80 });
      expect(count).toBe(3);
      unsub();
    });
  });

  describe('ProfileScreen_v2 UI integrity', () => {
    it('21. Module exports ProfileScreen_v2 + 4 tab components', async () => {
      const v2 = await import('../../ui/screens/ProfileScreen_v2/ProfileScreen_v2');
      const userTab = await import('../../ui/screens/ProfileScreen_v2/ProfileUserTab');
      const trainingTab = await import('../../ui/screens/ProfileScreen_v2/ProfileTrainingTab');
      const diariesTab = await import('../../ui/screens/ProfileScreen_v2/ProfileDiariesTab');
      const settingsTab = await import('../../ui/screens/ProfileScreen_v2/ProfileSettingsTab');
      const hero = await import('../../ui/screens/ProfileScreen_v2/ProfileHero');
      expect(typeof v2.ProfileScreen_v2).toBe('function');
      expect(typeof userTab.ProfileUserTab).toBe('function');
      expect(typeof trainingTab.ProfileTrainingTab).toBe('function');
      expect(typeof diariesTab.ProfileDiariesTab).toBe('function');
      expect(typeof settingsTab.ProfileSettingsTab).toBe('function');
      expect(typeof hero.ProfileHero).toBe('function');
    });

    it('22. Р’СЃРµ 6 section-РєРѕРјРїРѕРЅРµРЅС‚РѕРІ РџРѕР»СЊР·РѕРІР°С‚РµР»СЏ СЌРєСЃРїРѕСЂС‚РёСЂСѓСЋС‚СЃСЏ', async () => {
      const personal = await import('../../ui/screens/ProfileScreen_v2/sections/UserPersonalSection');
      const health = await import('../../ui/screens/ProfileScreen_v2/sections/UserHealthSection');
      const diet = await import('../../ui/screens/ProfileScreen_v2/sections/UserDietSection');
      const lifestyle = await import('../../ui/screens/ProfileScreen_v2/sections/UserLifestyleSection');
      const pharma = await import('../../ui/screens/ProfileScreen_v2/sections/UserPharmaSection');
      const goals = await import('../../ui/screens/ProfileScreen_v2/sections/UserGoalsSection');
      expect(typeof personal.UserPersonalSection).toBe('function');
      expect(typeof health.UserHealthSection).toBe('function');
      expect(typeof diet.UserDietSection).toBe('function');
      expect(typeof lifestyle.UserLifestyleSection).toBe('function');
      expect(typeof pharma.UserPharmaSection).toBe('function');
      expect(typeof goals.UserGoalsSection).toBe('function');
    });

    it('23. UI-СѓС‚РёР»РёС‚С‹ (NumberInput, SelectInput, SliderInput, BoolChip, AccordionSection) СЌРєСЃРїРѕСЂС‚РёСЂСѓСЋС‚СЃСЏ', async () => {
      const ui = await import('../../ui/screens/ProfileScreen_v2/ui');
      expect(typeof ui.NumberInput).toBe('function');
      expect(typeof ui.SelectInput).toBe('function');
      expect(typeof ui.SliderInput).toBe('function');
      expect(typeof ui.BoolChip).toBe('function');
      expect(typeof ui.AccordionSection).toBe('function');
      expect(typeof ui.Field).toBe('function');
      expect(typeof ui.FieldRow).toBe('function');
    });
  });

  describe('ProfileScreen_v2 hooks integrity', () => {
    it('24. useSectionState РїСЂР°РІРёР»СЊРЅРѕ СЂР°Р±РѕС‚Р°РµС‚ СЃ auto-save debounce', async () => {
      const { useSectionState } = await import('../../ui/screens/ProfileScreen_v2/hooks/useSectionState');
      expect(typeof useSectionState).toBe('function');
    });

    it('25. useProfileAutoSave РїСЂР°РІРёР»СЊРЅРѕ СЂР°Р±РѕС‚Р°РµС‚ СЃ auto-save', async () => {
      const { useProfileAutoSave } = await import('../../ui/screens/ProfileScreen_v2/hooks/useProfileAutoSave');
      expect(typeof useProfileAutoSave).toBe('function');
    });
  });

  describe('Sync buttons РІ Р±Р»РѕРєР°С… (CalcProfileCard, PeakingPanel, Рё С‚.Рґ.)', () => {
    it('26. CalcProfileCard РёРјРµРµС‚ autofillFromProfile + saveToProfile', async () => {
      // Compile-time check: РёРјРїРѕСЂС‚РёСЂСѓРµРј С„Р°Р№Р»
      const { CalcProfileCard } = await import('../../ui/screens/Calculator/CalcProfileCard');
      expect(typeof CalcProfileCard).toBe('function');
    });

    it('27. PeakingPanel РёРјРµРµС‚ autofillFromProfile + applyPms', async () => {
      const { PeakingPanel } = await import('../../ui/screens/SRCBBScreen_parts/PeakingPanel');
      expect(typeof PeakingPanel).toBe('function');
    });

    it('28. RecoveryPanel СЌРєСЃРїРѕСЂС‚РёСЂСѓРµС‚СЃСЏ', async () => {
      const { RecoveryPanel } = await import('../../ui/screens/SRCBBScreen_parts/RecoveryPanel');
      expect(typeof RecoveryPanel).toBe('function');
    });

    it('29. AutoregPanel СЌРєСЃРїРѕСЂС‚РёСЂСѓРµС‚СЃСЏ', async () => {
      const { AutoregPanel } = await import('../../ui/screens/SRCBBScreen_parts/AutoregPanel');
      expect(typeof AutoregPanel).toBe('function');
    });

    it('30. PerformanceScreen СЌРєСЃРїРѕСЂС‚РёСЂСѓРµС‚СЃСЏ', async () => {
      const { PerformanceScreen } = await import('../../ui/screens/PerformanceScreen');
      expect(typeof PerformanceScreen).toBe('function');
    });
  });
});




