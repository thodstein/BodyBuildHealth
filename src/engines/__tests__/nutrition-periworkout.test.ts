import { describe, it, expect } from 'vitest';
import { computePeriWorkoutNutrition } from '../nutrition-periworkout.engine';

describe('computePeriWorkoutNutrition', () => {
  it('стандартная сессия 80кг/60мин/10000 — разумные значения', () => {
    const p = computePeriWorkoutNutrition({ sessionVolume: 10000, durationMin: 60, bodyWeight: 80, goal: 'strength' });
    expect(p.pre.carbsG).toBeGreaterThan(80);
    expect(p.post.proteinG).toBeGreaterThan(20);
    expect(p.intra.carbsGPerH).toBeGreaterThan(0);
    expect(p.fluidTotalMl).toBeGreaterThan(500);
  });

  it('на сушке пост-углеводы ниже, чем на массе', () => {
    const cut = computePeriWorkoutNutrition({ sessionVolume: 10000, durationMin: 60, bodyWeight: 80, goal: 'cut' });
    const bulk = computePeriWorkoutNutrition({ sessionVolume: 10000, durationMin: 60, bodyWeight: 80, goal: 'bulk' });
    expect(cut.post.carbsG).toBeLessThan(bulk.post.carbsG);
  });

  it('короткая лёгкая сессия — без интра-углеводов', () => {
    const p = computePeriWorkoutNutrition({ sessionVolume: 1000, durationMin: 30, bodyWeight: 80 });
    expect(p.intra.carbsGPerH).toBe(0);
  });

  it('длинная тяжёлая сессия — интра-углеводы есть', () => {
    const p = computePeriWorkoutNutrition({ sessionVolume: 25000, durationMin: 95, bodyWeight: 90 });
    expect(p.intra.carbsGPerH).toBeGreaterThanOrEqual(30);
  });

  it('обоснование непустое', () => {
    const p = computePeriWorkoutNutrition({ sessionVolume: 8000, durationMin: 70, bodyWeight: 80 });
    expect(p.rationale.length).toBeGreaterThan(3);
  });

  it('высокая интенсивность увеличивает peri-workout топливо', () => {
    const low = computePeriWorkoutNutrition({ sessionVolume: 10000, durationMin: 60, bodyWeight: 80, intensity: 'low' });
    const high = computePeriWorkoutNutrition({ sessionVolume: 10000, durationMin: 60, bodyWeight: 80, intensity: 'high' });
    expect(high.pre.carbsG).toBeGreaterThan(low.pre.carbsG);
    expect(high.post.carbsG).toBeGreaterThan(low.post.carbsG);
    expect(high.intensity).toBe('high');
  });

  it('goal fat_loss/cutting получает дефицитный post-профиль', () => {
    const cut = computePeriWorkoutNutrition({ sessionVolume: 10000, durationMin: 60, bodyWeight: 80, goal: 'fat_loss' });
    const bulk = computePeriWorkoutNutrition({ sessionVolume: 10000, durationMin: 60, bodyWeight: 80, goal: 'bulk' });
    expect(cut.post.carbsG).toBeLessThan(bulk.post.carbsG);
  });

  it('PED-контекст даёт предупреждение, но не назначает дозировки', () => {
    const p = computePeriWorkoutNutrition({ sessionVolume: 12000, durationMin: 75, bodyWeight: 80, ped: { hasInsulin: true, insulinIU: 10 } });
    expect(p.ped.insulin).toBe(true);
    expect(p.safetyWarnings.some(w => w.includes('Инсулин'))).toBe(true);
    expect(p.safetyWarnings.join(' ')).not.toMatch(/\b\d+\s*(МЕ|IU)\b/);
  });
});
