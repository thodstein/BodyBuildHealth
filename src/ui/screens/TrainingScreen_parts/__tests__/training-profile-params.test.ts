/**
 * BB-22 (аудит 2026-11): параметры шага «Параметры» BB-Auto жили только в
 * состоянии компонента — `platePreset` (набор пластин зала) и `targetBodyFat`
 * (цель % жира для cut/recomp) сбрасывались после перезагрузки приложения.
 * Для % жира это ещё и тихо меняло объём: `bodyCompVolumeFactor` считал по
 * канону пола (18/10), а не по цели пользователя.
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

describe('BB-22: параметры плана переживают перезагрузку', () => {
  beforeEach(() => { localStorageMock.clear(); });

  it('platePreset и targetBodyFat читаются обратно после сохранения', async () => {
    const { updateSection } = await import('../../../../core/profile-manager');
    // Профиль должен существовать до записи тренировочных настроек.
    updateSection('training', { daysPerWeek: 4 });

    const { loadTrainingProfile, saveTrainingProfile } = await import('../training-profile');
    saveTrainingProfile({ ...loadTrainingProfile(), platePreset: 'olympic', targetBodyFat: 12 });

    const back = loadTrainingProfile();
    expect(back.platePreset).toBe('olympic');
    expect(back.targetBodyFat).toBe(12);
  });

  it('очистка целевого % жира не залипает на старом значении', async () => {
    const { updateSection } = await import('../../../../core/profile-manager');
    updateSection('training', { daysPerWeek: 4 });

    const { loadTrainingProfile, saveTrainingProfile } = await import('../training-profile');
    saveTrainingProfile({ ...loadTrainingProfile(), platePreset: 'olympic', targetBodyFat: 12 });
    // Пользователь стёр поле → в профиле тоже должно стать пусто,
    // иначе прежнее значение «воскресает» при следующем открытии шага.
    saveTrainingProfile({ ...loadTrainingProfile(), targetBodyFat: undefined });

    const back = loadTrainingProfile();
    expect(back.targetBodyFat).toBeUndefined();
    expect(back.platePreset).toBe('olympic');
  });

  it('оборудование и PED-дозы переживают перезагрузку', async () => {
    const { updateSection } = await import('../../../../core/profile-manager');
    updateSection('training', { daysPerWeek: 4 });

    const { loadTrainingProfile, saveTrainingProfile } = await import('../training-profile');
    saveTrainingProfile({
      ...loadTrainingProfile(),
      equipment: ['barbell', 'cable', 'machine'],
      pedDoses: { AAS: 750, GH: 6 },
    });

    const back = loadTrainingProfile();
    expect(back.equipment).toEqual(['barbell', 'cable', 'machine']);
    expect(back.pedDoses).toEqual({ AAS: 750, GH: 6 });
  });
});
