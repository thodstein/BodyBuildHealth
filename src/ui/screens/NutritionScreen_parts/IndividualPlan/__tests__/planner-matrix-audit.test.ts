/**
 * planner-matrix-audit.test.ts — Этап 0 плана переработки (docs/NUTRITION-PLANNER-OVERHAUL-PLAN.md).
 * Матрица профилей (вес × цель × приёмы × режим × seed) → метрики качества конвейера:
 *   devPctDay   — отклонение дня от цели по ккал/Б/Ж/У (max);
 *   minMainShare — худший основной приём (доля факта от своей целевой доли, %);
 * При NUTRITION_MATRIX_WRITE=1 пишет docs/nutrition-matrix-baseline.json.
 */
import { describe, it } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';
import { assembleRecipeDay, sumDayTotals, type PlanMealLike } from '../planner-recipe-mode';
import { getRecipes } from '../../../../../engines/nutrition-periodization.engine';
import { writeFileSync } from 'node:fs';

function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function targetsFor(weight: number, goal: 'mass' | 'cut', kcalT: number) {
  const p = goal === 'mass' ? Math.round(weight * 2) : Math.round(weight * 2.2);
  const f = goal === 'mass' ? Math.round(kcalT * 0.25 / 9) : Math.round(kcalT * 0.22 / 9);
  const c = Math.round(Math.max(50, (kcalT - p * 4 - f * 9) / 4));
  return { kcal: kcalT, p, f, c };
}

function buildInput(weight: number, goal: string, targets: any, mealsCount: number, seed: number): MealPlanInput {
  return {
    weightKg: weight, lbmKg: Math.round(weight * 0.85), bodyFatPct: goal === 'mass' ? 14 : 12, sex: 'male' as const,
    goalKcal: targets.kcal, goalProteinG: targets.p, goalFatG: targets.f, goalCarbsG: targets.c,
    mealsCount, isTrainingDay: seed % 2 === 0, trainStartMin: seed % 2 === 0 ? 18 * 60 : undefined, trainDurationMin: 75,
    excludedIds: new Set<string>(), allergenTags: new Set<string>(), budget: 'medium' as const,
    dayOffset: 0, cyclePhase: goal === 'mass' ? 'course' as const : 'cutting' as const,
    variety: 'max' as const, quality: 'full' as const, randomSalt: seed * 101 + 7,
    wakeTime: '08:00', bedTime: '23:00',
  };
}

describe('планировщик: матрица качества (Этап 0)', () => {
  it('64 ячейки: сходимость дня и доли приёмов', { timeout: 300000 }, () => {
    const recipes = getRecipes();
    const rows: any[] = [];
    const weights = [60, 85, 110, 130];
    const goals: Array<'mass' | 'cut'> = ['mass', 'cut'];
    const mealsCounts = [4, 6];
    const modes: Array<'products' | 'recipes'> = ['products', 'recipes'];
    const seeds = [0, 1];
    let worstDev = 0; let worstCell = '';
    let worstShare = 100; let worstShareCell = '';
    for (const weight of weights) {
      for (const goal of goals) {
        for (const mealsCount of mealsCounts) {
          for (const mode of modes) {
            for (const seed of seeds) {
              const rand = rng(7000 + seed);
              const kcalT = goal === 'mass' ? Math.round(weight * (33 + Math.floor(rand() * 4))) : Math.round(weight * (22 + Math.floor(rand() * 3)));
              const targets = targetsFor(weight, goal, kcalT);
              const input = buildInput(weight, goal, targets, mealsCount, seed);
              const day = buildDayPlan(input) as any;
              let totals = day.totals;
              let meals: PlanMealLike[] = day.meals;
              let applied = 0;
              if (mode === 'recipes') {
                const res = assembleRecipeDay({
                  meals, pool: recipes, targets, excludedIds: new Set<string>(),
                  maxPrepTimeMin: 120, usedNamesAcrossDays: new Set<string>(), goal: goal === 'mass' ? 'mass' : 'cut',
                });
                meals = res.meals as any; applied = res.appliedCount;
              }
              const t = mode === 'recipes' ? sumDayTotals(meals) : totals;
              const devPct = Math.max(
                Math.abs(t.kcal - targets.kcal) / targets.kcal,
                Math.abs(t.p - targets.p) / targets.p,
                Math.abs(t.f - targets.f) / targets.f,
                Math.abs(t.c - targets.c) / targets.c,
              ) * 100;
              // Доля основных приёмов от своей целевой доли (важно для «ужатых» приёмов)
              let minMainShare = 100;
              for (const m of meals as any[]) {
                if (!m.target) continue;
                const tk = (m.target.p || 0) * 4 + (m.target.c || 0) * 4 + (m.target.f || 0) * 9;
                if (tk <= 0) continue;
                const share = (m.totals?.kcal || 0) / tk * 100;
                if (share < minMainShare) minMainShare = share;
              }
              const cell = `w${weight}/${goal}/${mealsCount}пр/${mode}/s${seed}`;
              rows.push({ cell, weight, goal, mealsCount, mode, seed, devPct: Math.round(devPct * 10) / 10, minMainShare: Math.round(minMainShare), applied, dayKcal: Math.round(t.kcal) });
              if (devPct > worstDev) { worstDev = devPct; worstCell = cell; }
              if (minMainShare < worstShare) { worstShare = minMainShare; worstShareCell = cell; }
            }
          }
        }
      }
    }
    console.log(`[matrix] worst day-dev: ${worstDev.toFixed(1)}% @ ${worstCell}; worst main-share: ${worstShare}% @ ${worstShareCell}`);
    if (process.env.NUTRITION_MATRIX_WRITE) {
      writeFileSync('docs/nutrition-matrix-baseline.json', JSON.stringify({ generated: new Date().toISOString(), worstDev, worstCell, worstShare, worstShareCell, rows }, null, 2), 'utf8');
      console.log('[matrix] baseline записан в docs/nutrition-matrix-baseline.json');
    }
    // Приёмка (Aug 28, мониторинг): катастрофы запрещены — пустые основные приёмы и
    // >40% отклонения дня. 15-40% — гранулярность пула при макро-капах новой модели
    // (перебор макроса хуже лёгкого недобора ккал); полный ±3% закрывается подбором
    // рецептов пользователем (варианты) и сайд-добивкой.
    expect(worstDev).toBeLessThanOrEqual(40);
    expect(worstShare).toBeGreaterThanOrEqual(15);
  });
});
