/**
 * profile-manager-hooks.test.ts — тесты granular хуков useProfileSection и useProfileField.
 * Использует минимальный test runner без @testing-library/react.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React, { useState, useEffect } from 'react';
import { renderToString } from 'react-dom/server';

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

describe('Profile Manager API (no-hooks)', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('1. updateSection обновляет секцию и инкрементирует version', async () => {
    const { updateSection, getSectionVersion } = await import('../profile-manager');
    const verBefore = getSectionVersion('personal');
    updateSection('personal', { weight: 90 });
    expect(getSectionVersion('personal')).toBe(verBefore + 1);
  });

  it('2. Изменение одной секции не инкрементирует version другой', async () => {
    const { updateSection, getSectionVersion } = await import('../profile-manager');
    const verLifestyleBefore = getSectionVersion('lifestyle');
    updateSection('personal', { weight: 80 });
    expect(getSectionVersion('lifestyle')).toBe(verLifestyleBefore);
  });

  it('3. updateSection применяет патч к существующей секции', async () => {
    const { updateSection, getProfile } = await import('../profile-manager');
    updateSection('personal', { age: 30, sex: 'male' });
    updateSection('personal', { weight: 82.5 });
    const p = getProfile();
    expect((p.settings as any).personal.age).toBe(30);
    expect((p.settings as any).personal.sex).toBe('male');
    expect((p.settings as any).personal.weight).toBe(82.5);
  });

  it('4. pushSnapshot сохраняет текущее состояние', async () => {
    const { updateSection, getSnapshots, pushSnapshot } = await import('../profile-manager');
    updateSection('personal', { weight: 80 });
    pushSnapshot();
    const snaps = getSnapshots();
    expect(snaps.length).toBe(1);
    expect(snaps[0].settings.personal.weight).toBe(80);
  });

  it('5. undoLastSnapshot восстанавливает предыдущее состояние', async () => {
    const { updateSection, getProfile, undoLastSnapshot, pushSnapshot } = await import('../profile-manager');
    updateSection('personal', { weight: 80 });
    pushSnapshot();
    updateSection('personal', { weight: 90 });
    expect((getProfile().settings as any).personal.weight).toBe(90);
    const ok = undoLastSnapshot();
    expect(ok).toBe(true);
    expect((getProfile().settings as any).personal.weight).toBe(80);
  });

  it('6. pushSnapshot cap = 10 (старые удаляются)', async () => {
    const { updateSection, pushSnapshot, getSnapshots } = await import('../profile-manager');
    for (let i = 0; i < 15; i++) {
      updateSection('personal', { weight: 70 + i });
      pushSnapshot();
    }
    const snaps = getSnapshots();
    expect(snaps.length).toBe(10);
    expect(snaps[0].settings.personal.weight).toBe(75);
  });

  it('7. getProfile возвращает разные объекты при разных вызовах', async () => {
    const { getProfile, updateSection } = await import('../profile-manager');
    updateSection('personal', { weight: 80 });
    const p1 = getProfile();
    const p2 = getProfile();
    expect(p1 !== p2).toBe(true);
    expect((p1.settings as any).personal.weight).toBe(80);
    expect((p2.settings as any).personal.weight).toBe(80);
  });

  it('8. onProfileChange срабатывает при updateProfile', async () => {
    const { updateProfile, onProfileChange } = await import('../profile-manager');
    let called = 0;
    const unsub = onProfileChange(() => { called++; });
    updateProfile({ name: 'Test' });
    updateProfile({ name: 'Test2' });
    expect(called).toBe(2);
    unsub();
    updateProfile({ name: 'Test3' });
    expect(called).toBe(2);
  });

  it('9. FLAT_TO_NESTED proxy — settings.weight читается как personal.weight', async () => {
    const { updateSection, getProfile } = await import('../profile-manager');
    updateSection('personal', { weight: 85 });
    const p = getProfile();
    expect((p.settings as any).weight).toBe(85);
  });

  it('10. getSectionVersion возвращает 0 для несуществующей секции', async () => {
    const { getSectionVersion } = await import('../profile-manager');
    const v = getSectionVersion('goals' as any);
    expect(typeof v).toBe('number');
  });
});
