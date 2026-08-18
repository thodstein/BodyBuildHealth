import { describe, it, expect, beforeEach } from 'vitest';
import { calcNutritionV2 } from '../nutrition-v2.engine';

// Профиль V2 по умолчанию диктует proteinGPerKg 2.0 / fatMinGPerKg 0.8 —
// для проверки веток движка (2.5 г/кг на дефиците, 0.85 г/кг жира)
// сидируем пустой профиль (0 = использовать дефолты по цели).
beforeEach(() => {
  localStorage.setItem('he_nutrition_v2', JSON.stringify({ proteinGPerKg: 0, fatMinGPerKg: 0, dietWeeks: 0, weightHistory: [] }));
});

const base = {
  weightKg: 90,
  heightCm: 180,
  age: 30,
  sex: 'male' as const,
  pal: 1.55,
  bodyFatPercent: 15,
  trainingDaysPerWeek: 3,
  avgTrainingMinutes: 60,
};

describe("calcNutritionV2 — аудит: 'cut' = дефицит", () => {
  it('cut даёт те же ккал/белок, что и deficit (goalMult 0.85, белок 2.5 г/кг LBM)', () => {
    const cut = calcNutritionV2({ ...base, goal: 'cut' });
    const deficit = calcNutritionV2({ ...base, goal: 'deficit' });
    expect(cut.kcal).toBe(deficit.kcal);
    expect(cut.proteinG).toBe(deficit.proteinG);
    expect(cut.proteinG).toBe(Math.round(90 * 0.85 * 2.5));
  });

  it('maintenance > cut > mini_cut по ккал', () => {
    const maint = calcNutritionV2({ ...base, goal: 'maintenance' });
    const cut = calcNutritionV2({ ...base, goal: 'cut' });
    const mini = calcNutritionV2({ ...base, goal: 'mini_cut' });
    expect(cut.kcal).toBeLessThan(maint.kcal);
    expect(mini.kcal).toBeLessThan(cut.kcal);
  });
});

describe('calcNutritionV2 — аудит: тренировочный карб-флор', () => {
  // Тяжёлый/высокопроцентный спортсмен: базовые углеводы (residual/4) ниже
  // тренировочного флора, флор должен поднять carbsG (раньше перезатирался).
  const heavy = { ...base, weightKg: 120, bodyFatPercent: 30 };

  it('высокий объём тренировок поднимает углеводы (флор больше не затирается)', () => {
    const low = calcNutritionV2({ ...heavy, goal: 'bulk', trainingDaysPerWeek: 3, avgTrainingMinutes: 60 });
    const high = calcNutritionV2({ ...heavy, goal: 'bulk', trainingDaysPerWeek: 7, avgTrainingMinutes: 120 });
    expect(high.carbsG).toBeGreaterThan(low.carbsG);
  });

  it('карб-флор не превышает калорийный бюджет (лимит по /3.5)', () => {
    const r = calcNutritionV2({ ...heavy, goal: 'bulk', trainingDaysPerWeek: 7, avgTrainingMinutes: 120 });
    const maxByBudget = Math.round((r.kcal - r.proteinG * 4 - r.fatG * 9) / 3.5);
    expect(r.carbsG).toBeLessThanOrEqual(Math.round(maxByBudget * 1.001) + 1);
    expect(Number.isFinite(r.carbsG)).toBe(true);
  });
});
