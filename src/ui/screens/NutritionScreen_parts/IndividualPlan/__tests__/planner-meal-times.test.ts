/**
 * planner-meal-times.test.ts — §3B EXTREME-SCALE: таймлайн приёмов.
 * При большом числе приёмов (экстрим + инсулин-окна) перекусы больше не сливаются
 * в один час: gapFillTimes заполняет плотные разрывы (≥90 мин) и при переполнении
 * ставит вынужденную точку, максимально удалённую от существующих.
 */
import { describe, it, expect } from 'vitest';
import { _gapFillTimesForTest, buildDayPlan, type MealPlanInput } from '../meal-plan-engine';

const base = (over: any = {}): MealPlanInput => ({
  weightKg: 110, lbmKg: 92, bodyFatPct: 16, sex: 'male' as const,
  goalKcal: 5100, goalProteinG: 220, goalFatG: 110, goalCarbsG: 800,
  mealsCount: 7, isTrainingDay: true, trainStartMin: 17 * 60, trainDurationMin: 90,
  allowIntraWorkout: true, budget: 'max' as const, dayOffset: 0,
  cyclePhase: 'course' as const, variety: 'max' as const, eveningLowCarb: false,
  quality: 'full' as const, randomSalt: 3,
  wakeTime: '07:00', bedTime: '23:00', dinnerTime: '19:00',
  ...over,
});

const toMin = (t: string): number => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

describe('§3B таймлайн приёмов', () => {
  it('gapFillTimes: плотные фикс-точки (07:00…21:30) + 6 перекусов — без дублей и ≥30 мин', () => {
    // Фикс-точки плотного дня: завтрак/обед/предтрен/intra/пост-трен/ужин/преслип.
    const fixed = [7 * 60, 12 * 60 + 30, 15 * 60 + 30, 17 * 60 + 30, 19 * 60, 20 * 60, 21 * 60 + 30];
    const times = _gapFillTimesForTest(fixed, 6);
    expect(times.length).toBe(6);
    const all = [...fixed, ...times].sort((a, b) => a - b);
    expect(new Set(all).size, `дубли времён: ${all.join(',')}`).toBe(all.length);
    for (let i = 1; i < all.length; i++) {
      expect(all[i] - all[i - 1], `${all[i - 1]}→${all[i]}`).toBeGreaterThanOrEqual(30);
    }
    // Все точки — в пределах разумного дня (не ночью).
    for (const t of times) { expect(t).toBeGreaterThanOrEqual(300); expect(t).toBeLessThanOrEqual(1410); }
  });

  it('products-экстрим 1500У/500Б/3×40 ЕД: времена приёмов не дублируются, не-окна ≥20 мин', () => {
    const plan = buildDayPlan(base({
      weightKg: 120, lbmKg: 100, goalKcal: 8900, goalProteinG: 500, goalFatG: 100, goalCarbsG: 1500,
      mealsCount: 10, carbCapGPerKg: 0,
      injections: [
        { type: 'инсулин', name: 'А', time: '08:00', dose: 40, esterType: 'short' },
        { type: 'инсулин', name: 'Б', time: '13:00', dose: 40, esterType: 'short' },
        { type: 'инсулин', name: 'В', time: '19:30', dose: 40, esterType: 'short' },
      ] as any,
    }));
    const times = plan.meals.map(m => String((m as any).time || '')).filter(Boolean);
    expect(new Set(times).size, `дубли времён: ${times.join(',')}`).toBe(times.length);
    const nonWin = plan.meals.filter(m => !(m as any)._insulinWindow).map(m => toMin(String((m as any).time))).sort((a, b) => a - b);
    for (let i = 1; i < nonWin.length; i++) {
      expect(nonWin[i] - nonWin[i - 1], `${nonWin[i - 1]}→${nonWin[i]}`).toBeGreaterThanOrEqual(20);
    }
  });
});
