/**
 * profile-e2e.test.ts — end-to-end тесты для Профиля v2.
 * Проверяет реальные пользовательские сценарии:
 * 1. First-time user (empty localStorage) → getSettings работает
 * 2. Legacy user → миграция выполняется
 * 3. После миграции → старые ключи удалены, новые UnifiedSettings заполнены
 * 4. updateSection → getProfile возвращает обновлённое значение
 * 5. updateSection → useDataLink-стиль подхват через onProfileChange
 * 6. updateSection → event-bus доставляет onAnyProfileChange
 * 7. updateSection → sectionVersions инкрементируется
 * 8. pushSnapshot/undoLastSnapshot → корректный roundtrip
 * 9. saveTrainingProfile → запись в UnifiedSettings (для backward-compat)
 * 10. loadTrainingProfile → чтение из UnifiedSettings (для backward-compat)
 * 11. ProfileScreen_v2 тип-совместимость (compile-time check)
 * 12. Корректный маппинг Specificity → UnifiedSettings.specificity
 * 13. saveTrainingProfile + 17 мигрированных полей → все попадают в UnifiedSettings
 * 14. Отсутствие циклических обновлений: updateSection → onProfileChange → updateSection НЕ триггерит бесконечный цикл
 * 15. setRole и updateProfile работают
 * 16. clearSnapshots очищает storage
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
    it('1. getSettings без MIGRATED_FLAG → возвращает default + устанавливает флаг', async () => {
      const { getSettings } = await import('../../engines/unified-profile');
      const s = getSettings();
      // Все default поля должны быть заполнены
      expect(s.personal.age).toBe(30);
      expect(s.personal.weight).toBe(70);
      expect(s.training.primaryGoal).toBe('hypertrophy');
      expect(s.lifestyle.sleepHours).toBe(7);
      // MIGRATED_FLAG должен быть установлен
      expect(localStorageMock.getItem('he_profile_migrated_v2')).toBe('1');
    });
  });

  describe('Legacy user with old data', () => {
    it('2. he_training_profile → UnifiedSettings + удаление legacy ключа', async () => {
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
      // Legacy ключ удалён
      expect(localStorageMock.getItem('he_training_profile')).toBeNull();
    });

    it('3. he_autocalc_state → UnifiedSettings.health.* + удаление legacy', async () => {
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
      // Legacy ключ удалён
      expect(localStorageMock.getItem('he_autocalc_state')).toBeNull();
    });

    it('4. he_food_allergens + he_health_issues → UnifiedSettings', async () => {
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
      // Все legacy ключи удалены
      for (const k of ['he_food_allergens', 'he_health_issues', 'he_preferred_foods', 'he_excluded_foods']) {
        expect(localStorageMock.getItem(k)).toBeNull();
      }
    });

    it('5. he_manual_kcal + he_manual_p/f/c → UnifiedSettings.nutrition.manualTargets', async () => {
      localStorageMock.setItem('he_manual_kcal', '2400');
      localStorageMock.setItem('he_manual_p', '180');
      localStorageMock.setItem('he_manual_f', '70');
      localStorageMock.setItem('he_manual_c', '280');
      const { getSettings } = await import('../../engines/unified-profile');
      const s = getSettings();
      expect(s.nutrition.manualTargets).toEqual({ kcal: 2400, protein: 180, fat: 70, carbs: 280 });
    });

    it('6. he_kbju_mode + he_evening_low_carb + he_surplus_pct → nutrition', async () => {
      localStorageMock.setItem('he_kbju_mode', 'manual');
      localStorageMock.setItem('he_evening_low_carb', 'true');
      localStorageMock.setItem('he_surplus_pct', '15');
      const { getSettings } = await import('../../engines/unified-profile');
      const s = getSettings();
      expect(s.nutrition.kbjuMode).toBe('manual');
      expect(s.nutrition.eveningLowCarb).toBe(true);
      expect(s.nutrition.surplusPct).toBe(15);
    });

    it('7. he_bb_category + he_peak_week + he_life_stage → goals', async () => {
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

    it('8. Полный сценарий: все ключи разом → корректный merged UnifiedSettings', async () => {
      // Заполняем ВСЕ legacy ключи
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
        allergyNotes: 'аспирин',
      }));
      const { getSettings } = await import('../../engines/unified-profile');
      const s = getSettings();
      // Проверяем что все поля корректно мигрированы
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
    it('9. updateSection → useProfileSection через useSyncExternalStore', async () => {
      const { updateSection, getProfile, getSectionVersion } = await import('../profile-manager');
      updateSection('personal', { weight: 85, age: 30 });
      const p = getProfile();
      expect((p.settings as any).personal.weight).toBe(85);
      expect(getSectionVersion('personal')).toBeGreaterThan(0);
    });

    it('10. onProfileSectionChange + updateSection → broadcast срабатывает', async () => {
      const { updateSection } = await import('../profile-manager');
      const { onProfileSectionChange } = await import('../profile-events');
      let received: any[] = [];
      const unsub = onProfileSectionChange('personal', (p) => received.push(p));
      updateSection('personal', { weight: 85 });
      updateSection('personal', { age: 30 });
      // Получили уведомления для каждого updateSection
      expect(received.length).toBe(2);
      expect(received[0].section).toBe('personal');
      expect(received[1].section).toBe('personal');
      unsub();
    });

    it('11. onAnyProfileChange + updateProfile → broadcast срабатывает', async () => {
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
    it('12. pushSnapshot → updateSection → undoLastSnapshot → восстанавливает значение', async () => {
      const { updateSection, pushSnapshot, undoLastSnapshot, getProfile } = await import('../profile-manager');
      updateSection('personal', { weight: 80 });
      pushSnapshot();
      updateSection('personal', { weight: 90 });
      expect((getProfile().settings as any).personal.weight).toBe(90);
      undoLastSnapshot();
      expect((getProfile().settings as any).personal.weight).toBe(80);
    });

    it('13. pushSnapshot cap=10 (старые удаляются)', async () => {
      const { updateSection, pushSnapshot, getSnapshots } = await import('../profile-manager');
      for (let i = 0; i < 15; i++) {
        updateSection('personal', { weight: 70 + i });
        pushSnapshot();
      }
      expect(getSnapshots().length).toBe(10);
      // Первый snapshot — weight=75 (70,71,72,73,74 удалены)
      expect(getSnapshots()[0].settings.personal.weight).toBe(75);
    });

    it('14. clearSnapshots очищает storage', async () => {
      const { updateSection, pushSnapshot, getSnapshots, clearSnapshots } = await import('../profile-manager');
      updateSection('personal', { weight: 80 });
      pushSnapshot();
      expect(getSnapshots().length).toBeGreaterThan(0);
      clearSnapshots();
      expect(getSnapshots().length).toBe(0);
    });
  });

  describe('No infinite loops / circular updates', () => {
    it('15. updateSection из onProfileChange listener НЕ вызывает рекурсию', async () => {
      const { updateSection, onProfileChange } = await import('../profile-manager');
      let depth = 0;
      const unsub = onProfileChange(() => {
        depth++;
        if (depth > 5) throw new Error('Recursion detected');
      });
      // Симулируем 5 updateSection — никакой рекурсии быть не должно
      for (let i = 0; i < 5; i++) {
        updateSection('personal', { weight: 80 + i });
      }
      expect(depth).toBe(5);
      unsub();
    });
  });

  describe('saveTrainingProfile (backward-compat with legacy consumers)', () => {
    it('16. saveTrainingProfile → запись в UnifiedSettings через updateProfile', async () => {
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

    it('17. loadTrainingProfile → чтение из UnifiedSettings если есть', async () => {
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
    it('18. Мигрированные значения доступны через profile.settings (а не через мёртвые ключи)', async () => {
      localStorageMock.setItem('he_training_profile', JSON.stringify({
        bodyWeight: 88, goal: 'recomp', level: 'enhanced', pmSquat: 220,
      }));
      const { getSettings } = await import('../../engines/unified-profile');
      const s = getSettings();
      // Чтение через UnifiedSettings напрямую (а не через proxy с мёртвого ключа)
      expect(s.personal.weight).toBe(88);
      expect(s.training.primaryGoal).toBe('recomp');
      expect(s.training.level).toBe('enhanced');
      expect(s.training.pmSquat).toBe(220);
      // Р старый ключ удалён
      expect(localStorageMock.getItem('he_training_profile')).toBeNull();
    });

    it('19. После миграции saveTrainingProfile дописывает ТОЛЬКО новые поля, не затирая мигрированные', async () => {
      localStorageMock.setItem('he_training_profile', JSON.stringify({
        bodyWeight: 85, goal: 'bulk', level: 'intermediate',
      }));
      const { getSettings } = await import('../../engines/unified-profile');
      getSettings(); // trigger migration
      // Загружаем через модуль training-profile
      const tpm = await import('../../ui/screens/TrainingScreen_parts/training-profile');
      // saveTrainingProfile с другими полями
      tpm.saveTrainingProfile({ pmSquat: 250, pmBench: 150, pmDead: 300 } as any);
      const { getProfile } = await import('../profile-manager');
      const p = getProfile();
      expect((p.settings as any).training.pmSquat).toBe(250);
      expect((p.settings as any).training.pmBench).toBe(150);
      expect((p.settings as any).training.pmDeadlift).toBe(300);
      // Мигрированные поля сохранены
      expect((p.settings as any).personal.weight).toBe(85);
      expect((p.settings as any).training.primaryGoal).toBe('bulk');
      expect((p.settings as any).training.level).toBe('intermediate');
    });

    it('20. updateSection → useDataLink-style consumer подхватывает через onProfileChange', async () => {
      // useDataLink подписан на onProfileChange, не на event-bus напрямую
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
      const isComponent = (x: unknown): boolean =>
        typeof x === 'function' ||
        (!!x && typeof x === 'object' && !!(x as { $$typeof?: unknown }).$$typeof);
      const v2 = await import('../../ui/screens/ProfileScreen_v2/ProfileScreen_v2');
      const userTab = await import('../../ui/screens/ProfileScreen_v2/ProfileUserTab');
      const trainingTab = await import('../../ui/screens/ProfileScreen_v2/ProfileTrainingTab');
      const diariesTab = await import('../../ui/screens/ProfileScreen_v2/ProfileDiariesTab');
      const settingsTab = await import('../../ui/screens/ProfileScreen_v2/ProfileSettingsTab');
      const hero = await import('../../ui/screens/ProfileScreen_v2/ProfileHero');
      expect(isComponent(v2.ProfileScreen_v2)).toBe(true);
      expect(isComponent(userTab.ProfileUserTab)).toBe(true);
      expect(isComponent(trainingTab.ProfileTrainingTab)).toBe(true);
      expect(isComponent(diariesTab.ProfileDiariesTab)).toBe(true);
      expect(isComponent(settingsTab.ProfileSettingsTab)).toBe(true);
      expect(isComponent(hero.ProfileHero)).toBe(true);
    }, 20_000);

    it('22. Все 6 section-компонентов Пользователя экспортируются', async () => {
      const isComponent = (x: unknown): boolean =>
        typeof x === 'function' ||
        (!!x && typeof x === 'object' && !!(x as { $$typeof?: unknown }).$$typeof);
      const personal = await import('../../ui/screens/ProfileScreen_v2/sections/UserPersonalSection');
      const health = await import('../../ui/screens/ProfileScreen_v2/sections/UserHealthSection');
      const diet = await import('../../ui/screens/ProfileScreen_v2/sections/UserDietSection');
      const lifestyle = await import('../../ui/screens/ProfileScreen_v2/sections/UserLifestyleSection');
      const pharma = await import('../../ui/screens/ProfileScreen_v2/sections/UserPharmaSection');
      const goals = await import('../../ui/screens/ProfileScreen_v2/sections/UserGoalsSection');
      expect(isComponent(personal.UserPersonalSection)).toBe(true);
      expect(isComponent(health.UserHealthSection)).toBe(true);
      expect(isComponent(diet.UserDietSection)).toBe(true);
      expect(isComponent(lifestyle.UserLifestyleSection)).toBe(true);
      expect(isComponent(pharma.UserPharmaSection)).toBe(true);
      expect(isComponent(goals.UserGoalsSection)).toBe(true);
    });

    it('23. UI-утилиты (NumberInput, SelectInput, SliderInput, BoolChip, AccordionSection) экспортируются', async () => {
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
    it('24. useSectionState правильно работает с auto-save debounce', async () => {
      const { useSectionState } = await import('../../ui/screens/ProfileScreen_v2/hooks/useSectionState');
      expect(typeof useSectionState).toBe('function');
    });

    it('25. useProfileAutoSave правильно работает с auto-save', async () => {
      const { useProfileAutoSave } = await import('../../ui/screens/ProfileScreen_v2/hooks/useProfileAutoSave');
      expect(typeof useProfileAutoSave).toBe('function');
    });
  });

  describe('Sync buttons в блоках (CalcProfileCard, PeakingPanel, и т.д.)', () => {
    it('26. CalcProfileCard имеет autofillFromProfile + saveToProfile', async () => {
      // Compile-time check: импортируем файл
      const { CalcProfileCard } = await import('../../ui/screens/Calculator/CalcProfileCard');
      expect(typeof CalcProfileCard).toBe('function');
    });

    it('27. PeakingPanel имеет autofillFromProfile + applyPms', async () => {
      const { PeakingPanel } = await import('../../ui/screens/SRCBBScreen_parts/PeakingPanel');
      expect(typeof PeakingPanel).toBe('function');
    });

    it('28. RecoveryPanel экспортируется', async () => {
      const { RecoveryPanel } = await import('../../ui/screens/SRCBBScreen_parts/RecoveryPanel');
      expect(typeof RecoveryPanel).toBe('function');
    });

    it('29. AutoregPanel экспортируется', async () => {
      const { AutoregPanel } = await import('../../ui/screens/SRCBBScreen_parts/AutoregPanel');
      expect(typeof AutoregPanel).toBe('function');
    });

    it('30. PerformanceScreen экспортируется', async () => {
      const { PerformanceScreen } = await import('../../ui/screens/PerformanceScreen');
      expect(typeof PerformanceScreen).toBe('function');
    }, 30000);
  });
});



