import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';

/**
 * QG44 (2026-11): профессиональные диапазоны КБЖУ — цели пользователя не урезаются
 * «диетологическим потолком».
 *
 * Замер до фикса (110 кг, тренировочный день, 8370 ккал):
 *   цели 300 Б / 130 Ж / 1500 У (13.6 г/кг углеводов) усекались потолком 8 г/кг до 880 г
 *   → день −12.1% углеводов, оценка дня 59/100.
 * После фикса: −10.7%, оценка 86/100 (остаток — вместимость приёмов, отдельный долг).
 * Потолок остаётся для РАСЧЁТНЫХ целей (auto/profile): там он защищает от «19 г/кг
 * из ниоткуда». Для ручного ввода число — это инструкция пользователя, а не догадка.
 *
 * Правило проекта: 500 г белка / 1500 г углеводов — реальные кейсы, планировщик обязан
 * их принимать, а не молча менять.
 */

const mk = (over: Partial<MealPlanInput> & { weightKg: number }): MealPlanInput => ({
  lbmKg: Math.round(over.weightKg * 0.82),
  bodyFatPct: 12, sex: 'male',
  goalKcal: 3000, goalProteinG: 200, goalFatG: 80, goalCarbsG: 370,
  mealsCount: 6, isTrainingDay: true, trainStartMin: 18 * 60, trainDurationMin: 75,
  allowIntraWorkout: true, excludedIds: new Set<string>(), allergenTags: new Set<string>(),
  budget: 'medium', dayOffset: 0, cyclePhase: 'none', variety: 'medium',
  quality: 'full', randomSalt: 0,
  ...over,
} as MealPlanInput);

const sum = (plan: any) => plan.totals || { kcal: 0, p: 0, f: 0, c: 0 };
const pct = (got: number, want: number) => ((got - want) / want) * 100;

describe('QG44: экстремальные цели принимаются как есть', () => {
  it('500 г белка (110 кг, 4.5 г/кг) — цель дня достигается', () => {
    const plan: any = buildDayPlan(mk({
      weightKg: 110, lbmKg: 90, goalKcal: 4600, goalProteinG: 500, goalFatG: 120, goalCarbsG: 380,
      manualTargetsLocked: true,
    }));
    const t = sum(plan);
    expect(Math.abs(pct(t.p, 500)), `белок ${t.p.toFixed(1)} г`).toBeLessThanOrEqual(3);
    expect(Math.abs(pct(t.kcal, 4600)), `ккал ${t.kcal.toFixed(0)}`).toBeLessThanOrEqual(3);
  });

  it('1500 г углеводов (110 кг, 13.6 г/кг) в ручном режиме — не режутся потолком 8 г/кг', () => {
    const plan: any = buildDayPlan(mk({
      weightKg: 110, lbmKg: 90, goalKcal: 8370, goalProteinG: 300, goalFatG: 130, goalCarbsG: 1500,
      manualTargetsLocked: true, isTrainingDay: true,
    }));
    const t = sum(plan);
    // потолок 8 г/кг дал бы ≤880 г цели и ≲1320 г факта; проверяем, что ручная цель не усечена
    expect(t.c, `углеводы ${t.c.toFixed(0)} г`).toBeGreaterThan(1150);
    expect(pct(t.c, 1500), `отклонение углеводов ${pct(t.c, 1500).toFixed(1)}%`).toBeGreaterThan(-12);
    // оценка дня не должна рушиться из-за потолка (было 59 — «микро 74/жир 0»)
    expect(plan.qualityScore?.total ?? 0, `оценка ${plan.qualityScore?.total}`).toBeGreaterThanOrEqual(80);
  });

  it('1500 г углеводов в день отдыха — канон 3% по углеводам', () => {
    const plan: any = buildDayPlan(mk({
      weightKg: 110, lbmKg: 90, goalKcal: 8370, goalProteinG: 300, goalFatG: 130, goalCarbsG: 1500,
      manualTargetsLocked: true, isTrainingDay: false, trainStartMin: undefined,
    }));
    const t = sum(plan);
    expect(Math.abs(pct(t.c, 1500)), `углеводы ${t.c.toFixed(1)} г`).toBeLessThanOrEqual(3);
  });

  it('обычный ручной день не меняется (канон 3%)', () => {
    const plan: any = buildDayPlan(mk({
      weightKg: 90, lbmKg: 73, goalKcal: 3000, goalProteinG: 200, goalFatG: 80, goalCarbsG: 370,
      manualTargetsLocked: true,
    }));
    const t = sum(plan);
    expect(Math.abs(pct(t.kcal, 3000))).toBeLessThanOrEqual(3);
    expect(Math.abs(pct(t.p, 200))).toBeLessThanOrEqual(3);
    expect(Math.abs(pct(t.f, 80))).toBeLessThanOrEqual(3);
    expect(Math.abs(pct(t.c, 370))).toBeLessThanOrEqual(3);
  });
});
