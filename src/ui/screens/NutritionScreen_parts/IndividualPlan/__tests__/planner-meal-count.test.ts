/**
 * planner-meal-count.test.ts — единая модель АВТО-числа приёмов пищи.
 *
 * Число приёмов больше не выбирается вручную: оно считается по ёмкости
 * нормальной тарелки (белок 0.45 г/кг зажато 45–70 г, угли ≤120 г, ккал ≤900),
 * часы бодрствования — только физиологический пол. Движок использует тот же
 * источник как guardrail (контракт D-24 «3→3, 8→8» сохранён для нормальных дней).
 */
import { describe, it, expect } from 'vitest';
import { recommendMealCount, recommendMealCountDetailed, perMealProteinCapG, awakeHoursFromTimes } from '../planner-meal-count';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';

describe('recommendMealCount — ёмкость тарелки, не время', () => {
  it('legacy-lock (обратная совместимость вызова 3 аргументов)', () => {
    expect(recommendMealCount(16, 180, 320)).toBe(5);   // обычный день → пол по часам
    expect(recommendMealCount(16, 300, 800)).toBe(7);   // 800У → 7
    expect(recommendMealCount(16, 220, 600)).toBe(5);
    expect(recommendMealCount(10, 100, 150)).toBe(3);
    expect(recommendMealCount(16, 500, 1500)).toBe(10); // потолок 10
  });

  it('белок: вес-зависимый кап 0.45 г/кг (45–70 г)', () => {
    expect(perMealProteinCapG(80)).toBe(45);
    expect(perMealProteinCapG(110)).toBe(50);
    expect(perMealProteinCapG(120)).toBe(54);
    expect(recommendMealCount(16, 220, 300, { weightKg: 110 })).toBe(5);
    expect(recommendMealCount(16, 300, 300, { weightKg: 100 })).toBe(7);
    expect(recommendMealCount(16, 500, 300, { weightKg: 120 })).toBe(10);
  });

  it('калории: ≥900 ккал/приём требует больше приёмов', () => {
    expect(recommendMealCount(16, 180, 320, { kcal: 3000 })).toBe(5);   // 4 → пол 5
    expect(recommendMealCount(16, 180, 320, { kcal: 8600 })).toBe(10);  // 8600/900 = 10
  });

  it('binding честно показывает, что связало число приёмов', () => {
    expect(recommendMealCountDetailed(16, 180, 320, {}).binding).toBe('awake');
    expect(recommendMealCountDetailed(16, 300, 800, {}).binding).toBe('carbs');
    expect(recommendMealCountDetailed(16, 300, 300, { weightKg: 100 }).binding).toBe('protein');
    expect(recommendMealCountDetailed(16, 180, 320, { kcal: 8600 }).binding).toBe('kcal');
  });

  it('часы бодрствования: переход через полночь + мусор', () => {
    expect(awakeHoursFromTimes('07:00', '23:00')).toBe(16);
    expect(awakeHoursFromTimes('08:00', '02:00')).toBe(18);
    expect(awakeHoursFromTimes('', '')).toBe(15); // 07:30 → 22:30 fallback
  });
});

const base = (over: Partial<MealPlanInput> = {}): MealPlanInput => ({
  weightKg: 110, lbmKg: 92, bodyFatPct: 16, sex: 'male',
  goalKcal: 5100, goalProteinG: 220, goalFatG: 110, goalCarbsG: 800,
  mealsCount: 5, isTrainingDay: false, budget: 'medium', dayOffset: 0,
  cyclePhase: 'course', variety: 'medium', eveningLowCarb: false,
  quality: 'basic', randomSalt: 3, carbCapGPerKg: 0,
  wakeTime: '07:00', bedTime: '23:00', dinnerTime: '19:00',
  ...over,
} as MealPlanInput);

const hasExpandNote = (p: any) => (p.notes || []).some((n: string) => n.includes('День требует'));

describe('движок: guardrail считает приёмы автоматически', () => {
  it('HC800 на 5 приёмах больше не даёт −50% углей', () => {
    const p = buildDayPlan(base({ mealsCount: 5, goalCarbsG: 800, goalKcal: 5100, goalProteinG: 220 }));
    expect(hasExpandNote(p), 'нота о расширении приёмов').toBe(true);
    const devC = Math.abs(p.totals.c - 800) / 800;
    expect(devC, `угли: факт ${p.totals.c} / цель 800`).toBeLessThanOrEqual(0.15);
  });

  it('нормальный день на 3 приёмах НЕ расширяется (контракт mealsCount)', () => {
    const p = buildDayPlan(base({ mealsCount: 3, goalKcal: 3000, goalProteinG: 180, goalFatG: 72, goalCarbsG: 408, weightKg: 85, lbmKg: 70 }));
    expect(hasExpandNote(p)).toBe(false);
  });

  it('550У/300Б на 6 приёмах — нормальная тарелка, без расширения', () => {
    const p = buildDayPlan(base({ mealsCount: 6, weightKg: 100, lbmKg: 82, goalKcal: 4200, goalProteinG: 300, goalFatG: 95, goalCarbsG: 550 }));
    expect(hasExpandNote(p)).toBe(false);
  });

  it('HP400 на 5 приёмах расширяется (≤75 г белка/приём)', () => {
    const p = buildDayPlan(base({ mealsCount: 5, weightKg: 110, lbmKg: 92, goalKcal: 4700, goalProteinG: 400, goalFatG: 100, goalCarbsG: 520 }));
    expect(hasExpandNote(p)).toBe(true);
  });
});
