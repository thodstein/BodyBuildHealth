/**
 * planner-boundaries-e16.test.ts — E16 (Sep 30 2026, решения пользователя):
 *  1) off-slot: овсянку не ставим в ужин (в т.ч. HV-дни) — правило матрицы слотов
 *     (решение: снятие запрета для HV НЕ делаем);
 *  2) peri-полы — LBM-масштаб (0.25/0.40 г/кг, мин 8/12) для малых атлетов;
 *  3) экстремумы HV1500/500Б БЕЗ инсулин-окон: reconcile с плитой ≤900 → ≤3%
 *     («сука я сказал НЕ БОЛЕЕ 3%» — capacity-экстримы снова сводятся).
 *  + E16 addCarrier (M85 R s2: роста носителей нет → новый lean-носитель) и
 *    финальный кап клетчатки ≤85 (несогласованные цели → kcal-derived У).
 */
import { describe, it, expect } from 'vitest';
import { buildDayPlan, periProteinBudget, type MealPlanInput } from '../meal-plan-engine';
import { afAllows } from '../planner-meal-affinity';

const mk = (over: Partial<MealPlanInput>): MealPlanInput => ({
  weightKg: 90, lbmKg: 73.8, bodyFatPct: 18, sex: 'male',
  goalKcal: 3000, goalProteinG: 180, goalFatG: 72, goalCarbsG: 408,
  mealsCount: 5, budget: 'medium', dayOffset: 0, cyclePhase: 'course',
  variety: 'medium', eveningLowCarb: false, ...over,
} as MealPlanInput);

const devOf = (p: any, i: MealPlanInput): number => Math.max(
  Math.abs(p.totals.kcal - i.goalKcal) / i.goalKcal,
  Math.abs(p.totals.p - i.goalProteinG) / i.goalProteinG,
  Math.abs(p.totals.f - i.goalFatG) / i.goalFatG,
  Math.abs(p.totals.c - i.goalCarbsG) / i.goalCarbsG,
);
const solidOf = (m: any): number => (m.items || []).filter((x: any) => x.role !== 'liquid').reduce((s: number, x: any) => s + (x.amount || 0), 0);
const oatIn = (p: any, types: string[]): string[] =>
  (p.meals || []).filter((m: any) => types.includes(String(m.type || '')))
    .flatMap((m: any) => (m.items || []).filter((x: any) => /oat|porridge|muesli|granola/i.test(String(x.id))).map((x: any) => `${m.type}:${x.id}`));

describe('E16-1: овсянка не в ужине (off-slot, HV-дни включительно)', () => {
  it('матрица слотов: овсянка — завтрак, не ужин', () => {
    expect(afAllows('oats_dry', 'breakfast')).toBe(true);
    expect(afAllows('oats_dry', 'dinner')).toBe(false);
    // было→стало (E16): вопрос «снять ли off-slot запрет для HV (гарнир-носитель)»
    // решён ПОЛЬЗОВАТЕЛЕМ отрицательно — запрет остаётся, дни обязаны его держать.
  });

  it('HV1500 (10 приёмов) и контроль-3000: овсянки в обед/ужине нет', { timeout: 240000 }, () => {
    const hv = buildDayPlan(mk({
      weightKg: 120, lbmKg: 100, bodyFatPct: 16, goalKcal: 8900, goalProteinG: 500, goalFatG: 100, goalCarbsG: 1500,
      mealsCount: 10, budget: 'max', quality: 'full', carbCapGPerKg: 0, randomSalt: 3,
      wakeTime: '07:00', bedTime: '23:00', dinnerTime: '19:00',
    } as any));
    expect(oatIn(hv, ['lunch', 'dinner']), `HV: ${oatIn(hv, ['lunch', 'dinner']).join(',')}`).toEqual([]);
    const ctrl = buildDayPlan(mk({ randomSalt: 1 }));
    expect(oatIn(ctrl, ['lunch', 'dinner'])).toEqual([]);
  });
});

describe('E16-2: peri-полы LBM-масштаб', () => {
  it('малый LBM: бюджет ниже фикс-полов 20/25 (F50: 10/16)', () => {
    // было→стало (E16, решение пользователя): фикс-полы 20/25 г душили малые КБЖУ
    // (F50/F60: peri-белок доминировал цель 100–110 г, дни расходились +8…21%).
    // Стало: 0.25/0.40 г/кг LBM, мин 8/12 — LBM 41 → 10/16.
    const b41 = periProteinBudget(41, true, { preworkout: true, postworkout: true });
    expect(b41.preworkoutG).toBe(10);
    expect(b41.postworkoutG).toBe(16);
    const b50 = periProteinBudget(49, true, { preworkout: true, postworkout: true });
    expect(b50.preworkoutG).toBe(12);
    expect(b50.postworkoutG).toBe(20);
    // крупные атлеты не урезаны (прежние полы 20/25: LBM 73.8 → 18/30 ≥ 20/25-паритет по окну)
    const bLarge = periProteinBudget(73.8, true, { preworkout: true, postworkout: true });
    expect(bLarge.preworkoutG).toBe(18);
    expect(bLarge.postworkoutG).toBe(30);
  });
});

describe('E16-3: экстремумы без инсулин-окон сводятся ≤3%', () => {
  it('HV1500 (120 кг, 10 приёмов, без инсулина): ≤3%, тарелки ≤900, флаг честный', { timeout: 240000 }, () => {
    const inp = mk({
      weightKg: 120, lbmKg: 100, bodyFatPct: 16, goalKcal: 8900, goalProteinG: 500, goalFatG: 100, goalCarbsG: 1500,
      mealsCount: 10, budget: 'max', variety: 'max', quality: 'full', carbCapGPerKg: 0, randomSalt: 3,
      wakeTime: '07:00', bedTime: '23:00', dinnerTime: '19:00',
    } as any);
    const p = buildDayPlan(inp);
    // было→стало (E16): жир-ось +41.7% (R s1) → ≤3% (capacity-дни без окон снова
    // проходят reconciliation с плитой 900 — их собственные проходы исчерпаны).
    expect(devOf(p, inp), `dev=${(devOf(p, inp) * 100).toFixed(1)}%`).toBeLessThanOrEqual(0.03);
    expect(p.withinTolerance).toBe(true);
    for (const m of p.meals) expect(solidOf(m), `${m.label}`).toBeLessThanOrEqual(900);
    expect(p.notes.some(n => n.includes('Сходимость дня сведена'))).toBe(true);
  });

  it('500Б (HV по белку): T s1 ≤3%, R — канон', { timeout: 240000 }, () => {
    const inp = mk({
      weightKg: 110, lbmKg: 90, bodyFatPct: 16, goalKcal: 4500, goalProteinG: 500, goalFatG: 100, goalCarbsG: 400,
      budget: 'max', isTrainingDay: true, trainStartMin: 1050, trainDurationMin: 90, allowIntraWorkout: true, randomSalt: 1,
    });
    const p = buildDayPlan(inp);
    expect(devOf(p, inp)).toBeLessThanOrEqual(0.03);
    const r = buildDayPlan({ ...inp, isTrainingDay: false, trainStartMin: undefined, allowIntraWorkout: false });
    expect(r.withinTolerance).toBe(true);
  });

  it('M85 R s2 (носители выше капов роста): новый lean-носитель сводит У ≤3%', () => {
    // было→стало (E16): −12.9% У при +10.8% Б — роста существующих носителей нет
    // (potato 448 > кап 300); addCarrier добавляет рис парой «+носитель / −белок».
    const inp = mk({ weightKg: 85, lbmKg: 70, goalKcal: 3000, goalProteinG: 170, goalFatG: 75, goalCarbsG: 424, isTrainingDay: false, allowIntraWorkout: false, randomSalt: 2 });
    const p = buildDayPlan(inp);
    expect(devOf(p, inp), `dev=${(devOf(p, inp) * 100).toFixed(1)}%`).toBeLessThanOrEqual(0.03);
    expect(p.withinTolerance).toBe(true);
  });
});

describe('E16: финальный кап клетчатки (несогласованные цели)', () => {
  it('масса 100/6пр/max (530У @ 4200 — kcal-derived 595У): клетчатка ≤85', () => {
    const p = buildDayPlan(mk({
      weightKg: 100, lbmKg: 85, bodyFatPct: 15, goalKcal: 4200, goalProteinG: 230, goalFatG: 100, goalCarbsG: 530,
      mealsCount: 6, isTrainingDay: true, trainStartMin: 17 * 60, trainDurationMin: 90, allowIntraWorkout: true,
      budget: 'max', dayOffset: 3, variety: 'max', randomSalt: 2,
    }));
    expect(p.totals.fiber, `клетчатка ${p.totals.fiber}`).toBeLessThanOrEqual(85);
  });

  it('детерминизм: та же соль → тот же день (F50-1200)', () => {
    const inp = mk({ weightKg: 50, lbmKg: 41, bodyFatPct: 18, sex: 'female', goalKcal: 1200, goalProteinG: 100, goalFatG: 36, goalCarbsG: 119, cyclePhase: 'cutting', isTrainingDay: true, trainStartMin: 17 * 60, trainDurationMin: 90, allowIntraWorkout: true, randomSalt: 1 } as any);
    const a = buildDayPlan(inp);
    const b = buildDayPlan(inp);
    expect(JSON.stringify(a.meals)).toBe(JSON.stringify(b.meals));
    expect(a.deviationPct).toBe(b.deviationPct);
  });
});
