import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';

/**
 * §8.135 «флаг в допуске судится каноном ПУТИ» (замок).
 *
 * Дефект: `withinTolerance` продукт-пути всегда сравнивался с авто-каноном 3 %, хотя ручной
 * день собирается под 2 % (§8.122): ручной день на 2.3 % показывал «в допуске», то есть
 * врал ровно на том, ради чего ручной режим и существует.
 *
 * Правило: флаг и `canonPct` считаются по канону пути — ручной 2 %, авто PLANNER_CONVERGENCE_PCT
 * (3 %). Профиль найден на сетке (10 профилей × 3–6 приёмов × трен/отдых × авто/руч):
 *   100 кг, ручные Б200/Ж13/У330 = 2237 ккал, 4 приёма, день ОТДЫХА — девиация 2.3 %:
 *   ручной путь → withinTolerance=false (было true), авто путь → 2.3 % и withinTolerance=true.
 *   Контроль: 95 кг, Б190/Ж20/У333 = 2272 ккал, 4 приёма, отдых — ручной день 2.0 % остаётся true.
 */

const build = (o: any): any =>
  buildDayPlan({
    weightKg: 100,
    lbmKg: 82,
    bodyFatPct: 18,
    sex: 'male',
    goalKcal: 2237,
    goalProteinG: 200,
    goalFatG: 13,
    goalCarbsG: 330,
    mealsCount: 4,
    isTrainingDay: false,
    trainDurationMin: 75,
    allowIntraWorkout: true,
    budget: 'medium',
    dayOffset: 0,
    cyclePhase: 'none',
    variety: 'medium',
    goal: 'maintenance',
    quality: 'full',
    excludedIds: new Set<string>(),
    allergenTags: new Set<string>(),
    randomSalt: 0,
    ...o,
  } as unknown as MealPlanInput);

const MANUAL = { kbjuMode: 'manual', manualTargetsLocked: true };

describe('§8.135: ручной день в 2–2.5 % честно вне допуска, авто-путь того же профиля — в допуске', () => {
  it('ручной день 2.3 % → withinTolerance=false, canonPct=2', () => {
    const p = build(MANUAL);
    const dev = Number(p.deviationPct);
    expect(dev, `ручной день ${dev}%`).toBeGreaterThan(2);
    expect(dev).toBeLessThanOrEqual(2.5);
    expect(p.withinTolerance, `dev=${dev}%`).toBe(false);
    expect(p.canonPct).toBe(2);
  });

  it('тот же профиль на авто-пути (2.3 %) → withinTolerance=true, canonPct=3', () => {
    const p = build({});
    const dev = Number(p.deviationPct);
    expect(dev).toBeLessThanOrEqual(3);
    expect(p.withinTolerance, `dev=${dev}%`).toBe(true);
    expect(p.canonPct).toBe(3);
  });

  it('контроль: ручной день ровно 2.0 % остаётся в допуске (канон ручного — 2 %, включительно)', () => {
    const p = build({
      ...MANUAL,
      weightKg: 95,
      lbmKg: 78,
      goalKcal: 2272,
      goalProteinG: 190,
      goalFatG: 20,
      goalCarbsG: 333,
    });
    const dev = Number(p.deviationPct);
    expect(dev, `ручной день ${dev}%`).toBeLessThanOrEqual(2);
    expect(p.withinTolerance, `dev=${dev}%`).toBe(true);
    expect(p.canonPct).toBe(2);
  });
});
