/**
 * BB-07 (аудит 2026-11): травмы из «Профиль → Здоровье» не влияли на план BB-Auto —
 * `loadTrainingProfile` читал только явные записи BB, а `settings.health.injuries`
 * игнорировал. Плюс локация в профиле хранится РУССКОЙ подписью
 * (`core/constants.INJURY_LOCATIONS`), поэтому даже подключённая конверсия с
 * англ. ключами молча возвращала [].
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

const record = (over: Record<string, unknown>) => ({
  id: 'inj', type: 'joint', location: 'Колено', painLevel: 4,
  movementLimit: 'mild', side: 'right', chronic: false, ...over,
});

describe('BB-07: травмы из профиля «Здоровье» → TrainingProfile', () => {
  beforeEach(() => { localStorageMock.clear(); });

  it('русские локации мапятся на канонические мышцы', async () => {
    const { updateSection } = await import('../../../../core/profile-manager');
    updateSection('health', {
      injuries: [
        record({ id: 'knee', location: 'Колено', painLevel: 4, movementLimit: 'mild' }),
        record({ id: 'low', location: 'Поясница', painLevel: 9, movementLimit: 'severe' }),
        record({ id: 'sh', location: 'Плечо', painLevel: 5, movementLimit: 'moderate' }),
      ],
    });
    const { loadTrainingProfile } = await import('../training-profile');
    const byMuscle = Object.fromEntries(loadTrainingProfile().injuries.map(i => [i.muscle, i]));

    expect(byMuscle.quads).toBeTruthy();
    // Мягкая травма = градация (мышца остаётся, вес/объём снижены), не исключение.
    expect(byMuscle.quads.exclude).toBeFalsy();
    expect(Number(byMuscle.quads.weightPct)).toBeGreaterThan(0);
    expect(Number(byMuscle.quads.volumePct)).toBeGreaterThan(0);
    // Тяжёлая (painLevel 9 / severe) = исключение группы.
    expect(byMuscle.lower_back?.exclude).toBe(true);
    expect(byMuscle.shoulders).toBeTruthy();
  });

  it('full_restriction тоже считается тяжёлой', async () => {
    const { updateSection } = await import('../../../../core/profile-manager');
    updateSection('health', {
      injuries: [record({ id: 'fr', location: 'Голеностоп', painLevel: 2, movementLimit: 'full_restriction' })],
    });
    const { loadTrainingProfile } = await import('../training-profile');
    const inv = loadTrainingProfile().injuries.find(i => i.muscle === 'calves');
    expect(inv?.exclude).toBe(true);
  });

  it('явная запись BB-Auto приоритетнее выведенной из профиля', async () => {
    const { updateSection } = await import('../../../../core/profile-manager');
    updateSection('health', {
      injuries: [record({ id: 'knee', location: 'Колено', painLevel: 9, movementLimit: 'severe' })],
    });
    const { loadTrainingProfile, saveTrainingProfile } = await import('../training-profile');
    saveTrainingProfile({
      ...loadTrainingProfile(),
      injuries: [{ muscle: 'quads', from: '2026-01-01', exclude: false, weightPct: 0.8, volumePct: 0.9 }],
    });
    const quads = loadTrainingProfile().injuries.filter(i => i.muscle === 'quads');
    // Дубля нет, и побеждает явная мягкая запись (не «исключить» из health).
    expect(quads).toHaveLength(1);
    expect(quads[0].exclude).toBe(false);
  });
});
