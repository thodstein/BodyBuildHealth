/**
 * profile-extra.test.ts — edge case тесты для profile-manager.
 * Проверяет: undo, race conditions, circular calls, SSR, sectionVersioning.
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

describe('Profile Manager Edge Cases', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('1. onProfileSectionChange в подписчике НЕ вызывает рекурсию при updateSection', async () => {
    const { updateSection } = await import('../profile-manager');
    const { onProfileSectionChange } = await import('../profile-events');
    let depth = 0;
    const unsub = onProfileSectionChange('personal', () => {
      depth++;
      if (depth > 5) throw new Error('Recursion detected');
    });
    for (let i = 0; i < 5; i++) {
      updateSection('personal', { weight: 80 + i });
    }
    expect(depth).toBe(5);
    unsub();
  });

  it('2. setRole не падает и сохраняет в localStorage', async () => {
    const { setRole, getProfile } = await import('../profile-manager');
    setRole('admin');
    const p = getProfile();
    expect(p.role).toBe('admin');
  });

  it('3. pushSnapshot не падает при отсутствии settings', async () => {
    const { pushSnapshot, getSnapshots } = await import('../profile-manager');
    pushSnapshot();
    const snaps = getSnapshots();
    expect(snaps.length).toBe(1);
  });

  it('4. undoLastSnapshot при отсутствии snapshots возвращает false', async () => {
    const { undoLastSnapshot } = await import('../profile-manager');
    expect(undoLastSnapshot()).toBe(false);
  });

  it('5. clearSnapshots очищает storage', async () => {
    const { pushSnapshot, getSnapshots, clearSnapshots } = await import('../profile-manager');
    pushSnapshot();
    expect(getSnapshots().length).toBe(1);
    clearSnapshots();
    expect(getSnapshots().length).toBe(0);
  });

  it('6. getProfile с corrupted JSON возвращает дефолтный профиль', async () => {
    localStorageMock.setItem('he_profile_v2', '{invalid json');
    const { getProfile } = await import('../profile-manager');
    const p = getProfile();
    expect(p).toBeDefined();
    expect(p.settings).toBeDefined();
    expect(p.settings.personal.age).toBe(30); // default
  });

  it('7. getProfile с неполным settings (без personal) корректно проксирует', async () => {
    localStorageMock.setItem('he_profile_v2', JSON.stringify({
      name: 'Test',
      settings: { training: { level: 'beginner' } }
    }));
    const { getProfile } = await import('../profile-manager');
    const p = getProfile();
    // Proxy должен инициализировать personal = {}
    expect(p.settings.personal).toBeDefined();
  });

  it('8. sectionVersioning — разные секции изолированы', async () => {
    const { updateSection, getSectionVersion } = await import('../profile-manager');
    const v0 = getSectionVersion('personal');
    const vT0 = getSectionVersion('training');
    updateSection('personal', { weight: 80 });
    const v1 = getSectionVersion('personal');
    const vT1 = getSectionVersion('training');
    expect(v1).toBe(v0 + 1);
    expect(vT1).toBe(vT0); // training не изменился
  });

  it('9. updateProfile с name+settings обновляет оба', async () => {
    const { updateProfile, getProfile } = await import('../profile-manager');
    updateProfile({ name: 'NewName', settings: { personal: { age: 30, sex: 'male', height: 180, weight: 80, bodyFat: 15, bloodType: 'I+' } } as any });
    const p = getProfile();
    expect(p.name).toBe('NewName');
    expect(p.settings.personal.age).toBe(30);
  });

  it('10. broadcastProfileChange с пустым массивом → уведомляет только all', async () => {
    const { onAnyProfileChange, onProfileSectionChange } = await import('../profile-events');
    const { broadcastProfileChange } = await import('../profile-events');
    let allCount = 0;
    let nutritionCount = 0;
    const u1 = onAnyProfileChange(() => { allCount++; });
    const u2 = onProfileSectionChange('nutrition', () => { nutritionCount++; });
    broadcastProfileChange([]); // пустой массив
    expect(allCount).toBe(1);
    expect(nutritionCount).toBe(0); // не уведомляет секцию если массив пуст
    u1();
    u2();
  });
});
