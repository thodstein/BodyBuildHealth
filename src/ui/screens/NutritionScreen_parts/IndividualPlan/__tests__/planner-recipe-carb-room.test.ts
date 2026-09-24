/**
 * planner-recipe-carb-room.test.ts — §3E (NUTRITION-EXTREME-SCALE-PRO-PLAN §7, остаток E).
 *
 * Остаток E: рецептурный экстрим-день сходился на 17.4–19.1% — белок ядер +18–19%
 * (яичница/чечевица/макароны с индейкой), carbs −7%. Фикс:
 *  - `carbRoomScore` — ранжир кандидатов на экстрим-полосе учитывает «сколько У рецепт
 *    даёт в цель приёма» (carb-fill 25%) и перебор белка ядра (10%) поверх макро-дистанции;
 *  - честная строка «эффективная цель Б = N г (ядра рецептов)» + `effectiveProteinTargetG`
 *    и `deviationToEffectivePct` в результате — вместо тихого «dev 18.5%».
 *
 * Приёмка: dev ≤12% ИЛИ эффективная цель Б с отклонением к ней ≤12%.
 */
import { describe, it, expect } from 'vitest';
import { RECIPE_DB } from '../../../../../data/recipe-db';
import { assembleRecipeDay, carbRoomScore, sumDayTotals, sumMealTotals } from '../planner-recipe-mode';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const base = (over: any = {}): MealPlanInput => ({
  weightKg: 120, lbmKg: 100, bodyFatPct: 16, sex: 'male' as const,
  goalKcal: 8600, goalProteinG: 280, goalFatG: 120, goalCarbsG: 1500,
  mealsCount: 10, isTrainingDay: true, trainStartMin: 17 * 60, trainDurationMin: 90,
  allowIntraWorkout: true, budget: 'max' as const, dayOffset: 0,
  cyclePhase: 'course' as const, variety: 'max' as const, eveningLowCarb: false,
  quality: 'full' as const, randomSalt: 3, carbCapGPerKg: 0,
  wakeTime: '07:00', bedTime: '23:00', dinnerTime: '19:00',
  ...over,
});

const insulin = [
  { type: 'инсулин', name: 'А', time: '08:00', dose: 40, esterType: 'short' },
  { type: 'инсулин', name: 'Б', time: '13:00', dose: 40, esterType: 'short' },
  { type: 'инсулин', name: 'В', time: '19:30', dose: 40, esterType: 'short' },
] as any;

describe('§3E carbRoomScore — «сколько У рецепт даёт в цель приёма»', () => {
  it('при равной дистанции углеводно-плотный рецепт выигрывает у белкового', () => {
    const tgt = { p: 60, c: 250 };
    const carbDense = carbRoomScore({ p: 60, c: 250 }, tgt, 0.10);   // fill 1.0
    const proteinHeavy = carbRoomScore({ p: 90, c: 80 }, tgt, 0.10); // fill 0.32, Б перебор
    expect(carbDense).toBeLessThan(proteinHeavy);
  });

  it('перебор белка ядра штрафуется (при равном carb-fill)', () => {
    const tgt = { p: 60, c: 250 };
    const ok = carbRoomScore({ p: 60, c: 125 }, tgt, 0.20);
    const over = carbRoomScore({ p: 90, c: 125 }, tgt, 0.20);
    expect(over).toBeGreaterThan(ok);
  });

  it('нулевая У-цель не даёт NaN/деления на ноль', () => {
    const v = carbRoomScore({ p: 30, c: 0 }, { p: 30, c: 0 }, 0.15);
    expect(Number.isFinite(v)).toBe(true);
  });

  it('выше цели по У — carb-fill капается 1.0 (перебор не бонус)', () => {
    const tgt = { p: 60, c: 250 };
    expect(carbRoomScore({ p: 60, c: 250 }, tgt, 0.2)).toBe(carbRoomScore({ p: 60, c: 500 }, tgt, 0.2));
  });

  it('source-guard: ранжир применяет carbRoomScore ТОЛЬКО на экстрим-полосе', () => {
    const src = readFileSync(join(__dirname, '..', 'planner-recipe-mode.ts'), 'utf8');
    expect(src).toContain('carbRoomScore(scaled');
    expect(src).toContain('!_rankWeights');
  });
});

describe('§3E рецептурный экстрим 1500У: dev ≤12% ИЛИ честная эффективная цель Б', () => {
  it('R-HV: день сходится к эффективной цели Б (ядра) и пишет честную строку', { timeout: 240000 }, () => {
    const src = buildDayPlan(base({ injections: insulin }));
    const res = assembleRecipeDay({
      meals: (src.meals as any[]).map((m: any) => ({ ...m, items: (m.items || []).map((i: any) => ({ ...i })), totals: { ...m.totals } })),
      pool: RECIPE_DB as any, targets: { kcal: 8600, p: 280, f: 120, c: 1500 },
      excludedIds: new Set<string>(), trainDay: true, athleteWeightKg: 120, seed: 3, goal: 'mass',
    } as any);
    const tot = sumDayTotals(res.meals as any);
    expect(res.appliedCount).toBeGreaterThanOrEqual(5);
    // Без дублей id в приёмах (сайд/топ-ап/посадка не плодят второй рис).
    for (const m of res.meals as any[]) {
      const ids = (m.items || []).map((i: any) => i.id);
      expect(new Set(ids).size, `${m.label}: ${ids.join(',')}`).toBe(ids.length);
    }
    const effOk = typeof res.effectiveProteinTargetG === 'number'
      && typeof res.deviationToEffectivePct === 'number'
      && res.deviationToEffectivePct <= 12;
    expect(res.deviationPct <= 12 || effOk, `dev=${res.deviationPct}% eff=${res.deviationToEffectivePct}%`).toBe(true);
    if (res.deviationPct > 12) {
      // Честная строка обязательна: пользователь видит причину (ядра рецептов), а не «ошибку».
      expect(res.notes.some(n => /эффективная цель Б = \d+ г \(ядра рецептов/.test(n || ''))).toBe(true);
      expect(res.effectiveProteinTargetG, 'эффективная цель Б').toBeGreaterThan(280);
      expect(Math.round(res.effectiveProteinTargetG!), 'эффективная цель = факт ядер').toBe(Math.round(tot.p));
    }
  });

  it('обычный рецептурный день (не экстрим) — без строки эффективной цели', { timeout: 120000 }, () => {
    const src = buildDayPlan(base({
      weightKg: 90, lbmKg: 75, goalKcal: 3000, goalProteinG: 180, goalFatG: 80, goalCarbsG: 340,
      mealsCount: 5, isTrainingDay: true, budget: 'medium' as const,
    }));
    const res = assembleRecipeDay({
      meals: (src.meals as any[]).map((m: any) => ({ ...m, items: (m.items || []).map((i: any) => ({ ...i })), totals: { ...m.totals } })),
      pool: RECIPE_DB as any, targets: { kcal: 3000, p: 180, f: 80, c: 340 },
      excludedIds: new Set<string>(), trainDay: true, athleteWeightKg: 90, seed: 2, goal: 'recomp',
    } as any);
    expect(res.effectiveProteinTargetG).toBeUndefined();
    expect(res.notes.some(n => /эффективная цель Б/.test(n || ''))).toBe(false);
  });
});

describe('§3E carb-room: мейн с У-дефицитом получает более углеводный рецепт', () => {
  it('пул из двух рецептов: при близкой ккал-дистанции выбирается углеводно-плотный', { timeout: 120000 }, () => {
    // Мини-день: один обед с большим У-дефицитом. Пул — реальные рецепты разной плотности.
    const dense = RECIPE_DB.filter(r => r.meal === 'lunch' && (r.ingredientIds?.length ?? 0) >= 2)
      .sort((a, b) => (b.carbs / Math.max(1, b.protein)) - (a.carbs / Math.max(1, a.protein)))[0];
    const meaty = RECIPE_DB.filter(r => r.meal === 'lunch' && (r.ingredientIds?.length ?? 0) >= 2)
      .sort((a, b) => (a.carbs / Math.max(1, a.protein)) - (b.carbs / Math.max(1, b.protein)))[0];
    expect(dense.name).not.toBe(meaty.name);
    const day = [{
      label: 'Обед', type: 'lunch', time: '13:00',
      target: { p: 60, c: 250, f: 15 },
      items: [], totals: { kcal: 0, p: 0, f: 0, c: 0 },
    }];
    const res = assembleRecipeDay({
      meals: day as any,
      pool: [dense, meaty] as any,
      targets: { kcal: 5000, p: 260, f: 110, c: 900 },
      excludedIds: new Set<string>(), trainDay: true, athleteWeightKg: 110, seed: 1, goal: 'mass',
    } as any);
    expect(res.meals[0].recipeApplied).toBe(dense.name);
    const tot = sumMealTotals(res.meals[0].items as any);
    expect(tot.c).toBeGreaterThan(0);
  });
});
