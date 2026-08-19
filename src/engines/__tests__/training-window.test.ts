/**
 * training-window.engine.test.ts — тесты окон тренировки (доп. 4).
 *
 * - все три окна закрыты → good;
 * - только pre → partial/missed;
 * - пустой вход → missed, без NaN.
 */
import { describe, it, expect } from 'vitest';
import { assessTrainingWindows } from '../training-window.engine';

describe('assessTrainingWindows (доп. 4)', () => {
  it('все окна закрыты → good', () => {
    const r = assessTrainingWindows([
      { timing: 'pre_workout', products: [{ foodId: 'chicken_breast', weightGrams: 120 }, { foodId: 'rice_white', weightGrams: 250 }] },
      { timing: 'intra_workout', products: [{ foodId: 'banana', weightGrams: 200 }] },
      { timing: 'post_workout', products: [{ foodId: 'chicken_breast', weightGrams: 150 }, { foodId: 'rice_white', weightGrams: 250 }] },
    ], { bodyWeightKg: 80, ffmKg: 68 });
    expect(r.overall).toBe('good');
    expect(r.windows.every(w => w.covered)).toBe(true);
  });

  it('только pre → не good', () => {
    const r = assessTrainingWindows([
      { timing: 'pre_workout', products: [{ foodId: 'chicken_breast', weightGrams: 150 }, { foodId: 'rice_white', weightGrams: 250 }] },
    ], { bodyWeightKg: 80, ffmKg: 68 });
    expect(['partial', 'missed']).toContain(r.overall);
    expect(r.windows.find(w => w.window === 'pre')?.covered).toBe(true);
  });

  it('пустой вход → missed без NaN', () => {
    const r = assessTrainingWindows([], { bodyWeightKg: 80, ffmKg: 68 });
    expect(r.overall).toBe('missed');
    expect(Number.isFinite(r.windows[0].proteinG)).toBe(true);
    expect(r.rationale.length).toBeGreaterThan(0);
  });
});
