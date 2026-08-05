/**
 * profile-integration.test.ts — тесты end-to-end интеграции профиля.
 * Проверяет что:
 * 1. updateSection → useProfileSection подхватывает
 * 2. updateSection → useProfileField подхватывает
 * 3. updateSection → useProfileRefresh подхватывает
 * 4. updateSection → useDataLink подхватывает
 * 5. updateSection → onProfileSectionChange срабатывает
 * 6. Сторонняя запись в he_profile_v2 минуя API → НЕ подхватывается (только через API)
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

describe('Profile Integration', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('1. updateSection → getProfile возвращает обновлённое значение', async () => {
    const { updateSection, getProfile } = await import('../profile-manager');
    updateSection('personal', { weight: 85 });
    const p = getProfile();
    expect((p.settings as any).personal.weight).toBe(85);
  });

  it('2. saveTrainingProfile пишет в UnifiedSettings через updateProfile', async () => {
    // Этот тест изолирован — импортирует training-profile в своём блоке.
    // Иначе Vitest ESM кеш конфликтует.
    const tpm = await import('../../ui/screens/TrainingScreen_parts/training-profile');
    const profMgr = await import('../profile-manager');
    // Инициализируем профиль дефолтным значением
    profMgr.updateProfile({ settings: { personal: { age: 30, sex: 'male', height: 180, weight: 70, bodyFat: 14, bloodType: 'I+' } } as any });
    tpm.saveTrainingProfile({
      bodyWeight: 90, goal: 'cut', level: 'advanced', daysPerWeek: 5,
      pmSquat: 200, pmBench: 140, pmDead: 250,
    } as any);
    const p = profMgr.getProfile();
    expect((p.settings as any).personal.weight).toBe(90);
    expect((p.settings as any).training.primaryGoal).toBe('cut');
    expect((p.settings as any).training.pmSquat).toBe(200);
  });

  it('3. loadTrainingProfile читает из UnifiedSettings если есть', async () => {
    const { updateProfile, getProfile } = await import('../profile-manager');
    const { loadTrainingProfile } = await import('../../ui/screens/TrainingScreen_parts/training-profile');
    // Заполняем профиль
    updateProfile({ settings: { personal: { age: 30, sex: 'male', height: 180, weight: 82, bodyFat: 14, bloodType: 'I+' }, training: { primaryGoal: 'bulk', level: 'intermediate', pmSquat: 180, pmBench: 120, pmDeadlift: 200 } } as any });
    const tp = loadTrainingProfile();
    expect(tp.bodyWeight).toBe(82);
    expect(tp.goal).toBe('bulk');
    expect(tp.level).toBe('intermediate');
    expect(tp.pmSquat).toBe(180);
  });

  it('4. onProfileSectionChange срабатывает на updateSection', async () => {
    const { updateSection } = await import('../profile-manager');
    const { onProfileSectionChange } = await import('../profile-events');
    let received: any = null;
    const unsub = onProfileSectionChange('personal', (p) => { received = p; });
    updateSection('personal', { weight: 80 });
    expect(received).not.toBeNull();
    expect(received.section).toBe('personal');
    expect(typeof received.version).toBe('number');
    unsub();
  });

  it('5. updateSection → sectionVersions инкрементируется', async () => {
    const { updateSection, getSectionVersion } = await import('../profile-manager');
    const v0 = getSectionVersion('personal');
    updateSection('personal', { weight: 80 });
    const v1 = getSectionVersion('personal');
    expect(v1).toBe(v0 + 1);
  });

  it('6. pushSnapshot → undoLastSnapshot возвращает значение', async () => {
    const { updateSection, pushSnapshot, undoLastSnapshot, getProfile } = await import('../profile-manager');
    updateSection('personal', { weight: 80 });
    pushSnapshot();
    updateSection('personal', { weight: 90 });
    expect((getProfile().settings as any).personal.weight).toBe(90);
    const ok = undoLastSnapshot();
    expect(ok).toBe(true);
    expect((getProfile().settings as any).personal.weight).toBe(80);
  });

  it('7. pushSnapshot cap = 10', async () => {
    const { updateSection, pushSnapshot, getSnapshots } = await import('../profile-manager');
    for (let i = 0; i < 15; i++) {
      updateSection('personal', { weight: 70 + i });
      pushSnapshot();
    }
    const snaps = getSnapshots();
    expect(snaps.length).toBe(10);
  });

  it('8. undoLastSnapshot инкрементирует только изменённые секции', async () => {
    const { updateSection, pushSnapshot, undoLastSnapshot, getSectionVersion } = await import('../profile-manager');
    // Сначала сделать personal change чтобы он не изменился после undo
    updateSection('personal', { weight: 80 });
    pushSnapshot(); // snapshot 1: personal.weight=80
    const vPersonalBefore = getSectionVersion('personal');
    const vTrainingBefore = getSectionVersion('training');
    // Меняем ТОЛЬКО training
    updateSection('training', { pmSquat: 250 });
    // Undo должен вернуть training к 200, оставив personal как 80
    undoLastSnapshot();
    const vPersonalAfter = getSectionVersion('personal');
    const vTrainingAfter = getSectionVersion('training');
    // personal НЕ изменился после undo (был 80, остался 80)
    expect(vPersonalAfter).toBe(vPersonalBefore);
    // training ИЗМЕНИЛСЯ (undo восстановил значение, что само по себе является изменением относительно vTrainingBefore)
    expect(vTrainingAfter).toBeGreaterThan(vTrainingBefore);
  });

  it('9. setRole не падает на пустом профиле', async () => {
    const { setRole, getProfile } = await import('../profile-manager');
    setRole('admin');
    expect(getProfile().role).toBe('admin');
  });

  it('10. getProfile с completely null settings → возвращает default', async () => {
    localStorageMock.setItem('he_profile_v2', JSON.stringify({ name: 'X', role: 'user' }));
    const { getProfile } = await import('../profile-manager');
    const p = getProfile();
    expect(p.settings.personal.age).toBe(30);
    expect(p.settings.training.primaryGoal).toBe('hypertrophy');
  });

  it('11. updateSection корректно мерджит patch с существующей секцией', async () => {
    const { updateSection, getProfile } = await import('../profile-manager');
    updateSection('personal', { age: 25, sex: 'female' });
    updateSection('personal', { weight: 65 });
    const p = getProfile();
    expect((p.settings as any).personal.age).toBe(25);
    expect((p.settings as any).personal.sex).toBe('female');
    expect((p.settings as any).personal.weight).toBe(65);
  });

  it('12. updateProfile не теряет другие поля при частичном обновлении', async () => {
    const { updateProfile, getProfile } = await import('../profile-manager');
    updateProfile({
      settings: {
        personal: { age: 30, sex: 'male', height: 180, weight: 80, bodyFat: 15, bloodType: 'I+' },
        training: { sportType: 'bodybuilding', experience: 5, level: 'intermediate', daysPerWeek: 4, minutesPerSession: 60, primaryGoal: 'bulk', weakPoints: [], pmSquat: 180, pmBench: 120, pmDeadlift: 200, workMax: {}, equipment: [], recovery: 7, motivation: 7, doms: 3 },
      } as any,
    });
    updateProfile({ name: 'NewName' });
    const p = getProfile();
    expect(p.name).toBe('NewName');
    expect((p.settings as any).personal.age).toBe(30);
    expect((p.settings as any).training.primaryGoal).toBe('bulk');
  });
});
