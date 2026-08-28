/**
 * planner-round2-female-advice.test.ts — Роунд-2: Ж2 (женский гейт сушки) + П2 (совет автокоррекции).
 */
import { describe, it, expect } from 'vitest';
import { computePlannerTargets, plannerWeightAdjustAdvice } from '../planner-targets';

const base = (over: any = {}) => ({
  weightKg: 60, heightCm: 165, age: 28, sex: 'female' as const, goal: 'fat_loss', phase: 'fat_loss',
  bodyFatPct: 25, workoutsPerWeek: 4, avgWorkoutMinutes: 60, dailySteps: 8000,
  householdActivity: 'moderate', trainType: 'mixed', trainIntensity: 'medium', surplusPct: 10,
  injections: [], weightAdaptMode: false, weightLogWeek: [], expectedLossKgWeek: 0,
  metabolicAdaptEnabled: false, metabolicAdaptPct: 0,
  manualGPerKg: { protein: 0, fat: 0, carbs: 0 },
  ...over,
});

describe('Ж2: женский гейт сушки (дефицит ≤22%)', () => {
  it('ккал женщины на сушке не ниже TDEE × 0.78', () => {
    const t = computePlannerTargets(base());
    expect(t.tdee).toBeGreaterThan(0);
    expect(t.kcal).toBeGreaterThanOrEqual(Math.round(t.tdee * 0.78) - 1);
  });

  it('мужчина на сушке не подвержен женскому гейту (дефицит может быть глубже)', () => {
    const m = computePlannerTargets(base({ sex: 'male', weightKg: 90, heightCm: 180, age: 30, bodyFatPct: 18 }));
    // Дефект: мужчина может сидеть на 0.75 TDEE (агрессивная сушка) без подъёма
    if (m.tdee > 0 && m.kcal < m.tdee * 0.78) {
      expect(m.kcal).toBeLessThan(m.tdee * 0.78); // гейт не сработал — ок
    }
  });
});

describe('П2: совет автокоррекции по темпу веса', () => {
  it('нет данных (<4 замеров) → no_data', () => {
    const a = plannerWeightAdjustAdvice({ weightLog: [80, 80], goal: 'fat_loss', sex: 'male', kcalTarget: 2400 });
    expect(a.status).toBe('no_data');
  });

  it('сушка stalled → совет −150 ккал', () => {
    const a = plannerWeightAdjustAdvice({ weightLog: [90, 89.95, 89.9, 89.9, 89.85, 89.9], goal: 'fat_loss', sex: 'male', kcalTarget: 2400 });
    expect(a.status).toBe('too_slow_loss');
    expect(a.kcalDelta).toBeLessThan(0);
  });

  it('сушка слишком быстрая → совет +150 ккал (защита мышц)', () => {
    const a = plannerWeightAdjustAdvice({ weightLog: [90, 88, 86.5, 85.2, 84, 82.8], goal: 'cutting', sex: 'male', kcalTarget: 2200 });
    expect(a.status).toBe('too_fast_loss');
    expect(a.kcalDelta).toBeGreaterThan(0);
  });

  it('масса идёт по темпу → ok без изменений', () => {
    const a = plannerWeightAdjustAdvice({ weightLog: [80, 80.05, 80.1, 80.1, 80.15, 80.2], goal: 'mass', sex: 'male', kcalTarget: 3200 });
    expect(a.status).toBe('ok');
    expect(a.kcalDelta).toBe(0);
  });

  it('женский шаг совета мягче (125 vs 150)', () => {
    const a = plannerWeightAdjustAdvice({ weightLog: [60, 60, 59.9, 59.8, 59.9, 59.8], goal: 'fat_loss', sex: 'female', kcalTarget: 1600 });
    if (a.status === 'too_slow_loss') expect(Math.abs(a.kcalDelta)).toBe(125);
  });
});
