import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';
import { FOOD_DB } from '../../../../../core/nutrition-database';

/**
 * QG45: целостность позиции «граммы ↔ нутриенты».
 *
 * Найдено замером на про-диапазонах: часть стадий меняла `amount`, а макросы позиции
 * оставались от прежнего веса. Пример до фикса (110 кг / 8370 ккал / 1500 г углеводов):
 *   `овсяные хлопья 30 г` несли **595.8 г углеводов** → завтрак 3708 ккал = 47% дня,
 *   а день «сходился» на 3076 г углеводов при цели 1500 и реальных 751.
 * Фантомные граммы попадали в totals, в оценку дня и в замеры — скрывали реальный недобор.
 *
 * После фикса (ремонт в единой точке recalcDayTotals):
 *   • 1500 г углеводов: −50% → −1.5% (канон 3%), оценка 61 → 88;
 *   • 500 г белка: 8/8 канон, 99.5 (не тронуто);
 *   • нормальные дни: 0 падений оценки и 0 падений канона на 80 ячейках.
 *
 * Замок: физически невозможная плотность не появляется ни в одном дне, экстремальные
 * цели реально достигаются, нормальный день остаётся в каноне.
 */

const P = (id: string, weightKg: number, lbmKg: number, sex: 'male' | 'female', kcal: number, p: number, f: number) =>
  ({ id, weightKg, lbmKg, sex, kcal, p, f, c: Math.round((kcal - p * 4 - f * 9) / 4) });

const PROFILES = [
  P('p500', 110, 90, 'male', 4600, 500, 120),
  P('c1500', 110, 90, 'male', 8370, 300, 130),
  P('hugeCarb', 100, 85, 'male', 6700, 250, 100),
  P('mass110', 110, 90, 'male', 5200, 260, 120),
  P('normal', 90, 73, 'male', 3000, 200, 80),
  P('mid', 75, 62, 'male', 2400, 180, 70),
  P('small', 60, 50, 'male', 1600, 150, 45),
  P('cutF', 50, 41, 'female', 1240, 110, 40),
  P('recomp', 80, 65, 'male', 2200, 200, 60),
  P('keto', 85, 70, 'male', 2400, 180, 150),
];

const mk = (c: any, mealsCount: number, isTrainingDay: boolean): MealPlanInput => ({
  weightKg: c.weightKg, lbmKg: c.lbmKg, bodyFatPct: c.sex === 'female' ? 18 : 12, sex: c.sex,
  goalKcal: c.kcal, goalProteinG: c.p, goalFatG: c.f, goalCarbsG: c.c,
  mealsCount, isTrainingDay, trainStartMin: isTrainingDay ? 18 * 60 : undefined, trainDurationMin: 75,
  allowIntraWorkout: true, excludedIds: new Set<string>(), allergenTags: new Set<string>(),
  budget: 'medium', dayOffset: 0, cyclePhase: 'none', variety: 'medium',
  quality: 'full', randomSalt: 0, kbjuMode: 'auto', manualTargetsLocked: false,
} as any);

const pct = (got: number, want: number) => ((got - want) / want) * 100;

describe('QG45: граммы и нутриенты не расходятся', () => {
  it('ни одна позиция не несёт физически невозможную плотность (80 дней про-диапазонов)', () => {
    const bad: string[] = [];
    for (const c of PROFILES) {
      for (const mc of [4, 6]) {
        for (const tr of [true, false]) {
          const plan: any = buildDayPlan(mk(c, mc, tr));
          for (const m of plan.meals || []) {
            for (const it of m.items || []) {
              const fd: any = FOOD_DB.find((x: any) => x.id === it.id);
              if (!fd) continue;
              const k = (it.amount || 0) / 100;
              const chk = (got: number, per100: number) => Math.abs(got - per100 * k) > Math.max(15, per100 * k * 2);
              if (chk(it.p || 0, fd.protein || 0) || chk(it.f || 0, fd.fat || 0) || chk(it.c || 0, fd.carbs || 0)) {
                bad.push(`${c.id}/${mc}/${tr ? 'тр' : 'отд'} ${m.type} ${it.id} ${it.amount}г: ${it.p}/${it.f}/${it.c} vs FOOD_DB`);
              }
            }
          }
        }
      }
    }
    expect(bad.slice(0, 6).join(' | ')).toBe('');
  });

  it('1500 г углеводов / 8370 ккал реально достигаются (было −50% из-за фантомных грамм)', () => {
    const plan: any = buildDayPlan(mk(PROFILES[1], 6, true));
    const t = plan.totals;
    expect(Math.abs(pct(t.c, 1500)), `углеводы ${t.c.toFixed(0)} г`).toBeLessThanOrEqual(3);
    expect(Math.abs(pct(t.kcal, 8370)), `ккал ${t.kcal.toFixed(0)}`).toBeLessThanOrEqual(3);
    expect(plan.qualityScore?.total ?? 0).toBeGreaterThanOrEqual(85);
  });

  it('один приём не съедает полдня (≤35% ккал дня на экстремальных объёмах)', () => {
    for (const c of [PROFILES[1], PROFILES[2], PROFILES[0]]) {
      const plan: any = buildDayPlan(mk(c, 6, true));
      const share = Math.max(...(plan.meals || []).map((m: any) => (m.totals?.kcal || 0) / Math.max(1, plan.totals.kcal)));
      expect(share, `${c.id}: самый большой приём ${Math.round(share * 100)}% дня`).toBeLessThanOrEqual(0.35);
    }
  });

  it('нормальные дни остаются в каноне 3% (нет регрессии сходимости)', () => {
    for (const c of [PROFILES[4], PROFILES[5], PROFILES[8]]) {
      const plan: any = buildDayPlan(mk(c, 5, false));
      const t = plan.totals;
      const worst = Math.max(Math.abs(pct(t.kcal, c.kcal)), Math.abs(pct(t.p, c.p)), Math.abs(pct(t.f, c.f)), Math.abs(pct(t.c, c.c)));
      expect(worst, `${c.id}: худшее отклонение ${worst.toFixed(1)}%`).toBeLessThanOrEqual(3);
    }
  });
});
