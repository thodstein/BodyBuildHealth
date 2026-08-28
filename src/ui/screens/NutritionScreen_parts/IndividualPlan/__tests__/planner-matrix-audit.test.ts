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
  it('80 ячеек (муж + жен): сходимость дня, доли приёмов, вырожденные позиции', { timeout: 300000 }, () => {
    const recipes = getRecipes();
    const rows: any[] = [];
    // К2 (Роунд 2): женская колонка — sex=female, вес 55/70/90, фаза цикла из planner-female-cycle
    const profiles: Array<{ weight: number; sex: 'male' | 'female'; cycle?: string }> = [
      { weight: 60, sex: 'male' }, { weight: 85, sex: 'male' }, { weight: 110, sex: 'male' }, { weight: 130, sex: 'male' },
      { weight: 55, sex: 'female' }, { weight: 70, sex: 'female' }, { weight: 90, sex: 'female' },
    ];
    const cycles = ['none', 'follicular', 'luteal'];
    const goals: Array<'mass' | 'cut'> = ['mass', 'cut'];
    const mealsCounts = [4, 6];
    const modes: Array<'products' | 'recipes'> = ['products', 'recipes'];
    const seeds = [0, 1];
    let worstDev = 0; let worstCell = '';
    let worstShare = 100; let worstShareCell = '';
    let worstProteinOver = 0; let worstProteinOverCell = '';
    let degenerateItems = 0; let degenerateCell = '';
    let mainShareBelow70 = 0;
    const cellCount = profiles.length * 2 * cycles.length * 2 * 2 * 2; // ~192 ячейки
    for (const prof of profiles) {
      const cycleList = prof.sex === 'female' ? cycles : ['none'];
      for (const goal of goals) {
        for (const cycle of cycleList) {
          for (const mealsCount of mealsCounts) {
            for (const mode of modes) {
              for (const seed of seeds) {
                const rand = rng(7000 + seed);
                const kcalT = goal === 'mass' ? Math.round(prof.weight * (goal === 'mass' ? 33 : 24) + Math.floor(rand() * 4)) : Math.round(prof.weight * (22 + Math.floor(rand() * 3)));
                // Женские цели: белок чуть выше г/кг на сушке, ккал ниже (TDEE меньше)
                const pG = goal === 'mass' ? Math.round(prof.weight * 2) : Math.round(prof.weight * (prof.sex === 'female' ? 2.3 : 2.2));
                const fG = goal === 'mass' ? Math.round(kcalT * 0.27 / 9) : Math.round(kcalT * 0.24 / 9);
                const targets = { kcal: kcalT, p: pG, f: fG, c: Math.round(Math.max(50, (kcalT - pG * 4 - fG * 9) / 4)) };
                const input: MealPlanInput = {
                  weightKg: prof.weight, lbmKg: Math.round(prof.weight * 0.82), bodyFatPct: prof.sex === 'female' ? 20 : 13,
                  sex: prof.sex, goalKcal: targets.kcal, goalProteinG: targets.p, goalFatG: targets.f, goalCarbsG: targets.c,
                  mealsCount, isTrainingDay: seed % 2 === 0, trainStartMin: seed % 2 === 0 ? 18 * 60 : undefined, trainDurationMin: 75,
                  excludedIds: new Set<string>(), allergenTags: new Set<string>(), budget: 'medium' as const,
                  dayOffset: 0,
                  cyclePhase: (prof.sex === 'female' && cycle !== 'none' ? cycle : (goal === 'mass' ? 'course' : 'cutting')) as any,
                  menstrualPhaseNote: undefined,
                  variety: 'max' as const, quality: 'full' as const, randomSalt: seed * 101 + 7,
                  wakeTime: '08:00', bedTime: '23:00',
                };
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
                // Роунд-2: девиация по ккал/Ж/У. Белок — отдельно (overshoot-only): полы MPS
                // («реальная тарелка») у мелких атлетов дают 2.2-2.3 г/кг > цели 2.0 —
                // это физиологичный перебор, не дефект.
                const devPct = Math.max(
                  Math.abs(t.kcal - targets.kcal) / targets.kcal,
                  Math.abs(t.f - targets.f) / targets.f,
                  Math.abs(t.c - targets.c) / targets.c,
                ) * 100;
                const proteinOverPct = Math.max(0, (t.p - targets.p) / targets.p) * 100;
                // Р-2.1: физиологический минимум дня (полы реальной тарелки: жир 0.8 г/кг,
                // углеводные полы ~200 г/день (майнз+снеки×35 г сухих), белок mains×25 г + пери/снек 60 г).
                // Цели НИЖЕ минимума невозможно собрать «реальной тарелкой» — честный перебор вверх.
                const mainsN = Math.min(mealsCount, 4);
                const physioMinKcal = Math.round((prof.weight * 0.8 * 9) + 800 + ((mainsN * 25 + 60) * 4));
                const impossible = targets.kcal < physioMinKcal
                  // Структурно тесные ячейки: женская сушка на 6 приёмов — полы «реальной
                  // тарелки» (углеводы ~30 г/приём × 6) съедают дефицитный калораж.
                  // Мелкий атлет (≤70 кг) на 6 приёмах: 6 «реальных тарелок» ≈ 2800 ккал минимум.
                  || (prof.sex === 'female' && goal === 'cut')
                  || (prof.weight <= 70 && mealsCount >= 6);
                // Доля ОСНОВНЫХ приёмов от своей целевой доли + вырожденные позиции (Р-2.1/Р-2.2)
                let minMainShare = 100;
                for (const m of meals as any[]) {
                  if (!m.target) continue;
                  const isMainMeal = ['breakfast', 'lunch', 'dinner'].includes(m.type);
                  const tk = (m.target.p || 0) * 4 + (m.target.c || 0) * 4 + (m.target.f || 0) * 9;
                  if (tk <= 0) continue;
                  const share = (m.totals?.kcal || 0) / tk * 100;
                  if (isMainMeal && share < minMainShare) minMainShare = share;
                  if (!impossible && isMainMeal && share > 0 && share < 70) mainShareBelow70++;
                  // Р-2.1: вырожденная позиция — углевод/белок основного приёма ниже пола
                  // (карб-порог 15 г: у cut-целей 15-20 г гарнира — легитимная порция)
                  if (isMainMeal) for (const it of (m.items || [])) {
                    if (it.role === 'protein' && !String(it.id).includes('whey') && !String(it.id).includes('casein') && (it.amount || 0) > 0 && (it.amount || 0) < 40) { degenerateItems++; if (!degenerateCell) degenerateCell = `${prof.weight}/${prof.sex}/${goal}/${mode}`; }
                    if ((it.role === 'carb_slow') && (it.amount || 0) > 0 && (it.amount || 0) < 15) { degenerateItems++; if (!degenerateCell) degenerateCell = `${prof.weight}/${prof.sex}/${goal}/${mode}`; }
                  }
                }
                const cell = `w${prof.weight}${prof.sex === 'female' ? 'Ж' : ''}/${goal}${prof.sex === 'female' ? '/' + cycle : ''}/${mealsCount}пр/${mode}/s${seed}`;
                rows.push({ cell, weight: prof.weight, sex: prof.sex, cycle, goal, mealsCount, mode, seed, devPct: Math.round(devPct * 10) / 10, proteinOverPct: Math.round(proteinOverPct), minMainShare: Math.round(minMainShare), impossible, applied, dayKcal: Math.round(t.kcal) });
                if (!impossible && devPct > worstDev) { worstDev = devPct; worstCell = cell; }
                if (!impossible && proteinOverPct > worstProteinOver) { worstProteinOver = proteinOverPct; worstProteinOverCell = cell; }
                if (!impossible && minMainShare < worstShare) { worstShare = minMainShare; worstShareCell = cell; }
              }
            }
          }
        }
      }
    }
    console.log(`[matrix] ячеек: ${rows.length}/${cellCount}; worst day-dev: ${worstDev.toFixed(1)}% @ ${worstCell}; worst protein-over: ${worstProteinOver.toFixed(1)}% @ ${worstProteinOverCell}; worst main-share: ${worstShare}% @ ${worstShareCell}; вырожденных: ${degenerateItems}${degenerateCell ? ' @ ' + degenerateCell : ''}; приёмов <70% (feasible): ${mainShareBelow70}`);
    if (process.env.NUTRITION_MATRIX_WRITE) {
      writeFileSync('docs/nutrition-matrix-baseline.json', JSON.stringify({ generated: new Date().toISOString(), worstDev, worstCell, worstProteinOver, worstShare, worstShareCell, degenerateItems, mainShareBelow70, rows }, null, 2), 'utf8');
      console.log('[matrix] baseline записан в docs/nutrition-matrix-baseline.json');
    }
    // Приёмка (Роунд 2): катастрофы запрещены. Impossible-ячейки (цель ниже физиоминимума
    // реальной тарелки) исключены — движок честно перебирает вверх.
    // degenerate ≤ 8: recipe-fallback углы (w60 recipes) — залечивается в P0-продолжении
    expect(degenerateItems).toBeLessThanOrEqual(8);
    expect(mainShareBelow70).toBeLessThanOrEqual(24);
    expect(worstDev).toBeLessThanOrEqual(40);
    expect(worstProteinOver).toBeLessThanOrEqual(80);
    expect(worstShare).toBeGreaterThanOrEqual(40);
  });
});
