/**
 * planner-input-validation.test.ts — тесты защиты от некорректного ввода пользователя.
 *
 * Покрытие:
 *  - weightLogWeek с 0/отрицательными записями не искажает калораж (ложный «сброс веса»)
 *  - computePlannerTargets стабилен при пустых/мусорных входах
 */
import { describe, it, expect } from 'vitest';
import { computePlannerTargets } from '../planner-targets';

const base = (overrides: any = {}) => ({
  weightKg: 90, heightCm: 180, age: 30, sex: 'male' as const,
  goal: 'fat_loss', phase: 'cutting', bodyFatPct: 15,
  workoutsPerWeek: 4, avgWorkoutMinutes: 75, dailySteps: 9000,
  householdActivity: 'moderate', trainType: 'mixed', trainIntensity: 'high',
  surplusPct: 10, injections: [] as any[],
  weightAdaptMode: true, weightLogWeek: [80, 80, 80] as number[],
  expectedLossKgWeek: 0.5, metabolicAdaptEnabled: false, metabolicAdaptPct: 0,
  manualGPerKg: { protein: 0, fat: 0, carbs: 0 },
  ...overrides,
});

describe('weight-adapt: защита от нулевых записей веса', () => {
  it('обнулённая последняя запись (80→0) не поднимает калораж до +20%', () => {
    // FIX input-audit: раньше [80,80,0] трактовалось как «потеря 80кг» → weightAdj=+1.2
    const clean = computePlannerTargets(base({ weightLogWeek: [80, 80, 80] }));
    const zeroed = computePlannerTargets(base({ weightLogWeek: [80, 80, 0] }));
    const diffPct = Math.abs(clean.kcal - zeroed.kcal) / clean.kcal;
    expect(diffPct).toBeLessThan(0.02);
  });

  it('отрицательная запись веса игнорируется так же, как нулевая', () => {
    const clean = computePlannerTargets(base({ weightLogWeek: [80, 80, 80] }));
    const neg = computePlannerTargets(base({ weightLogWeek: [80, 80, -5] }));
    const diffPct = Math.abs(clean.kcal - neg.kcal) / clean.kcal;
    expect(diffPct).toBeLessThan(0.02);
  });

  it('реальная потеря веса всё ещё корректирует калораж (2кг за 3 записи)', () => {
    const flat = computePlannerTargets(base({ weightLogWeek: [82, 82, 82] }));
    const losing = computePlannerTargets(base({ weightLogWeek: [82, 81.8, 81.6] }));
    // лёгкая потеря 0.4кг за 2 интервала = 1.4кг/нед > 0.65 → калораж повышается
    expect(losing.kcal).toBeGreaterThan(flat.kcal);
  });

  it('калораж не падает ниже капа 0.8 и не выше 1.2 при экстремальных логах', () => {
    const crazyUp = computePlannerTargets(base({ weightLogWeek: [100, 90, 0, 0] }));
    const crazyDown = computePlannerTargets(base({ weightLogWeek: [70, 80, 90, 0] }));
    const normal = computePlannerTargets(base({ weightLogWeek: [80, 80, 80] }));
    expect(crazyUp.kcal).toBeLessThanOrEqual(normal.kcal * 1.25);
    expect(crazyDown.kcal).toBeGreaterThanOrEqual(normal.kcal * 0.75);
  });
});

describe('computePlannerTargets: мусорные входы', () => {
  it('weight 0 → fallback, без NaN', () => {
    const r = computePlannerTargets(base({ weightKg: 0 }));
    expect(Number.isFinite(r.kcal)).toBe(true);
    expect(Number.isFinite(r.protein)).toBe(true);
    expect(r.kcal).toBeGreaterThan(500);
  });

  it('manualGPerKg с NaN-значениями не ломает расчёт', () => {
    const r = computePlannerTargets(base({ manualGPerKg: { protein: NaN, fat: NaN, carbs: NaN } }));
    expect(Number.isFinite(r.kcal)).toBe(true);
    expect(Number.isFinite(r.protein)).toBe(true);
  });

  it('пустой weightLogWeek с weightAdaptMode → без падения', () => {
    const r = computePlannerTargets(base({ weightLogWeek: [] }));
    expect(Number.isFinite(r.kcal)).toBe(true);
  });
});
