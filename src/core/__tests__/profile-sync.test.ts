/**
 * profile-sync.test.ts — интеграционные тесты синхронизации профиля между блоками.
 * Покрывает: profileEvents.onAnyProfileChange, useDataLink подписку,
 *            updateSection → notifyAll цепочку, мульти-секционные обновления.
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

describe('Profile Event Bus', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('1. onAnyProfileChange срабатывает на updateSection', async () => {
    const { updateSection } = await import('../profile-manager');
    const { onAnyProfileChange } = await import('../profile-events');
    let called = 0;
    const unsub = onAnyProfileChange(() => { called++; });
    updateSection('personal', { weight: 80 });
    updateSection('personal', { weight: 85 });
    expect(called).toBe(2);
    unsub();
  });

  it('2. onProfileSectionChange срабатывает ТОЛЬКО на свою секцию', async () => {
    const { updateSection } = await import('../profile-manager');
    const { onProfileSectionChange } = await import('../profile-events');
    let personalCalled = 0;
    let trainingCalled = 0;
    const unsub1 = onProfileSectionChange('personal', () => { personalCalled++; });
    const unsub2 = onProfileSectionChange('training', () => { trainingCalled++; });
    updateSection('personal', { weight: 80 });
    updateSection('training', { level: 'beginner' });
    updateSection('personal', { age: 30 });
    expect(personalCalled).toBe(2);
    expect(trainingCalled).toBe(1);
    unsub1();
    unsub2();
  });

  it('3. broadcastProfileChange доставляет payload с section', async () => {
    const { onProfileSectionChange, broadcastProfileChange } = await import('../profile-events');
    const received: any[] = [];
    const unsub = onProfileSectionChange('nutrition', (p) => received.push(p));
    broadcastProfileChange(['nutrition']);
    expect(received.length).toBe(1);
    expect(received[0].section).toBe('nutrition');
    unsub();
  });

  it('4. updateProfile → event-bus доставляет уведомления', async () => {
    const { updateProfile } = await import('../profile-manager');
    const { onAnyProfileChange } = await import('../profile-events');
    let called = 0;
    const unsub = onAnyProfileChange(() => { called++; });
    updateProfile({ name: 'Test' });
    expect(called).toBeGreaterThanOrEqual(1);
    unsub();
  });

  it('5. broadcastProfileChange пустой массив → all listeners', async () => {
    const { onAnyProfileChange } = await import('../profile-events');
    const { broadcastProfileChange } = await import('../profile-events');
    let called = 0;
    const unsub = onAnyProfileChange(() => { called++; });
    broadcastProfileChange();
    broadcastProfileChange();
    expect(called).toBe(2);
    unsub();
  });
});

describe('Profile Sync между блоками', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('6. updateSection → getProfile возвращает обновлённое значение', async () => {
    const { updateSection, getProfile } = await import('../profile-manager');
    updateSection('personal', { weight: 85, age: 30 });
    const p = getProfile();
    expect((p.settings as any).personal.weight).toBe(85);
    expect((p.settings as any).personal.age).toBe(30);
  });

  it('7. updateSection сохраняет в localStorage', async () => {
    const { updateSection } = await import('../profile-manager');
    updateSection('training', { pmSquat: 200, level: 'intermediate' });
    const raw = JSON.parse(localStorage.getItem('he_profile_v2') || '{}');
    expect(raw.settings?.training?.pmSquat).toBe(200);
    expect(raw.settings?.training?.level).toBe('intermediate');
  });

  it('8. Несколько updateSection подряд → все накапливаются', async () => {
    const { updateSection, getProfile } = await import('../profile-manager');
    updateSection('personal', { weight: 80 });
    updateSection('personal', { age: 30 });
    updateSection('personal', { bodyFat: 15 });
    const p = getProfile();
    const pers = (p.settings as any).personal;
    expect(pers.weight).toBe(80);
    expect(pers.age).toBe(30);
    expect(pers.bodyFat).toBe(15);
  });

  it('9. updateSection не сбрасывает другие секции', async () => {
    const { updateSection, getProfile } = await import('../profile-manager');
    updateSection('personal', { weight: 80, age: 30 });
    updateSection('training', { pmSquat: 200 });
    const p = getProfile();
    expect((p.settings as any).personal.weight).toBe(80);
    expect((p.settings as any).personal.age).toBe(30);
    expect((p.settings as any).training.pmSquat).toBe(200);
  });

  it('10. updateSection сохраняет вложенные массивы', async () => {
    const { updateSection, getProfile } = await import('../profile-manager');
    updateSection('health', { chronicConditions: ['diabetes', 'asthma'] });
    const p = getProfile();
    expect((p.settings as any).health.chronicConditions).toEqual(['diabetes', 'asthma']);
    // Дописисываем
    updateSection('health', { chronicConditions: ['thyroid'] });
    const p2 = getProfile();
    // patch перезаписывает весь массив — это by design (патчится вся секция)
    expect((p2.settings as any).health.chronicConditions).toEqual(['thyroid']);
  });

  it('11. pushSnapshot + undoLastSnapshot восстанавливает предыдущее значение секции', async () => {
    const { updateSection, pushSnapshot, undoLastSnapshot, getProfile } = await import('../profile-manager');
    updateSection('personal', { weight: 80 });
    pushSnapshot();
    updateSection('personal', { weight: 90 });
    expect((getProfile().settings as any).personal.weight).toBe(90);
    undoLastSnapshot();
    expect((getProfile().settings as any).personal.weight).toBe(80);
  });

  it('12. Цепочка: pushSnapshot + updateSection + undo работают для разных секций', async () => {
    const { updateSection, pushSnapshot, undoLastSnapshot, getProfile } = await import('../profile-manager');
    updateSection('personal', { weight: 80 });
    updateSection('training', { pmSquat: 200 });
    pushSnapshot();
    updateSection('personal', { weight: 90 });
    updateSection('training', { pmSquat: 220 });
    undoLastSnapshot();
    const p = getProfile();
    expect((p.settings as any).personal.weight).toBe(80);
    expect((p.settings as any).training.pmSquat).toBe(200);
  });
});

describe('Profile Section Versioning', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('13. sectionVersions инкрементируется при updateSection', async () => {
    const { updateSection, getSectionVersion } = await import('../profile-manager');
    const v0 = getSectionVersion('personal');
    updateSection('personal', { weight: 80 });
    const v1 = getSectionVersion('personal');
    updateSection('personal', { weight: 85 });
    const v2 = getSectionVersion('personal');
    expect(v1).toBe(v0 + 1);
    expect(v2).toBe(v1 + 1);
  });

  it('14. getSectionVersion для новой секции = 0 (или fallback)', async () => {
    const { getSectionVersion } = await import('../profile-manager');
    const v = getSectionVersion('labs' as any);
    expect(typeof v).toBe('number');
    expect(v).toBeGreaterThanOrEqual(0);
  });

  it('15. profileVersion инкрементируется глобально', async () => {
    const { getProfileVersion, updateSection } = await import('../profile-manager');
    const v0 = getProfileVersion();
    updateSection('personal', { weight: 80 });
    const v1 = getProfileVersion();
    updateSection('training', { pmSquat: 200 });
    const v2 = getProfileVersion();
    expect(v1).toBeGreaterThan(v0);
    expect(v2).toBeGreaterThan(v1);
  });
});
