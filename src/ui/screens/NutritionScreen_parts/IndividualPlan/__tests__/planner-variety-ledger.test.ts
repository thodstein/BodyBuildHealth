/**
 * planner-variety-ledger.test.ts — P1-1/P1-3/P1-4 (план NUTRITION-VARIETY-PLAN):
 * скользящий ledger разнообразия (капы, валидация, недельная ротация семейств).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  VARIETY_LEDGER_KEY, LEDGER_FOODS_CAP, LEDGER_RECIPES_CAP, LEDGER_WEEK_FAMILIES_CAP,
  loadVarietyLedger, saveVarietyLedger, familyDaysInWeek, type VarietyLedgerShape,
} from '../planner-variety-ledger';
import { weekRotateTopups } from '../planner-recipe-mode';
import { correctDayToTargets, TOPUP_CARB_IDS, TOPUP_PROTEIN_IDS } from '../day-target-corrector';
import { buildDayPlan } from '../meal-plan-engine';
import { FOOD_DB } from '../../../../../core/nutrition-database';

describe('planner-variety-ledger: персист с капами', () => {
  beforeEach(() => { try { localStorage.removeItem(VARIETY_LEDGER_KEY); } catch {} });

  it('пустой/битый сторедж → пустой ledger без падения', () => {
    expect(loadVarietyLedger()).toEqual({ foods: [], recipes: [], recent: [], weekFamilies: [] });
    localStorage.setItem(VARIETY_LEDGER_KEY, 'not-json{{');
    expect(loadVarietyLedger()).toEqual({ foods: [], recipes: [], recent: [], weekFamilies: [] });
    localStorage.setItem(VARIETY_LEDGER_KEY, JSON.stringify({ foods: 42 }));
    expect(loadVarietyLedger()).toEqual({ foods: [], recipes: [], recent: [], weekFamilies: [] });
  });

  it('roundtrip: save → load (foods/recipes/recent/weekFamilies)', () => {
    const l: VarietyLedgerShape = {
      foods: ['chicken_breast', 'rice_white', 'buckwheat'],
      recipes: ['Овсяноблин', 'Курица терияки'],
      recent: [['chicken_breast', 'rice_white'], ['eggs']],
      weekFamilies: [['rice'], ['oats', 'buckwheat'], ['pasta']],
    };
    saveVarietyLedger(l);
    const loaded = loadVarietyLedger();
    expect(loaded.foods).toEqual(l.foods);
    expect(loaded.recipes).toEqual(l.recipes);
    expect(loaded.recent).toEqual(l.recent);
    expect(loaded.weekFamilies).toEqual(l.weekFamilies);
  });

  it('капы: foods ≤60, recipes ≤30, recent ≤2, weekFamilies ≤7 (пишутся хвосты)', () => {
    saveVarietyLedger({
      foods: Array.from({ length: 100 }, (_, i) => `food_${i}`),
      recipes: Array.from({ length: 50 }, (_, i) => `Рецепт ${i}`),
      recent: [['a'], ['b'], ['c']],
      weekFamilies: Array.from({ length: 12 }, (_, i) => [`fam_${i}`]),
    });
    const l = loadVarietyLedger();
    expect(l.foods.length).toBe(LEDGER_FOODS_CAP);
    expect(l.foods[0]).toBe(`food_${100 - LEDGER_FOODS_CAP}`); // новейший хвост
    expect(l.recipes.length).toBe(LEDGER_RECIPES_CAP);
    expect(l.recent.length).toBe(2);
    expect(l.weekFamilies.length).toBe(LEDGER_WEEK_FAMILIES_CAP);
    expect(l.weekFamilies[l.weekFamilies.length - 1]).toEqual(['fam_11']);
  });

  it('familyDaysInWeek: число дней недели с семейством (гейт «≤2 дней недели»)', () => {
    expect(familyDaysInWeek([['rice'], ['rice', 'oats'], ['pasta'], []], 'rice')).toBe(2);
    expect(familyDaysInWeek([['rice'], ['rice']], 'oats')).toBe(0);
    expect(familyDaysInWeek([], 'rice')).toBe(0);
  });
});

describe('P1-5: строгость разнообразия — hard-window движка (strict=всё, soft=стейплы+белки)', () => {
  // Engine effHardRecentIds: 'strict' → полный hard-window; 'soft' → только
  // стейпл-семейства + основные белки предыдущих дней (мягкая еда разрешена).
  const countId = (p: any, id: string): number =>
    p.meals.flatMap((m: any) => m.items || []).filter((it: any) => it.id === id).length;

  it('strict исключает мягкие продукты прошлых дней, soft — разрешает', { timeout: 120000 }, () => {
    const base = {
      weightKg: 80, lbmKg: 70, bodyFatPct: 15, sex: 'male' as const,
      goalKcal: 2900, goalProteinG: 160, goalFatG: 85, goalCarbsG: 330,
      mealsCount: 5, isTrainingDay: true, trainStartMin: 18 * 60, trainDurationMin: 75,
      allowIntraWorkout: true, excludedIds: new Set<string>(), allergenTags: new Set<string>(),
      budget: 'max' as const, dayOffset: 1, cyclePhase: 'course', variety: 'high' as const, quality: 'full' as const,
      randomSalt: 7, wakeTime: '07:00', bedTime: '23:00',
      hardRecentIds: new Set(['pineapple', 'mango', 'kiwi']),
    };
    const strict = buildDayPlan({ ...base, varietyStrictness: 'strict' } as any);
    const soft = buildDayPlan({ ...base, varietyStrictness: 'soft' } as any);
    // strict: ни один из «мягких» вчерашних продуктов не возвращается
    for (const id of ['pineapple', 'mango', 'kiwi']) {
      expect(countId(strict, id), `strict: ${id} вернулся`).toBe(0);
    }
    // soft: хотя бы один мягкий вернулся (жёсткое окно сужено до стейплов)
    const softHits = ['pineapple', 'mango', 'kiwi'].reduce((s, id) => s + countId(soft, id), 0);
    expect(softHits, 'soft: мягкие продукты под полным запретом — strictness не работает').toBeGreaterThan(0);
  });
});
describe('P1-7: недельная субротация топапов (сдвиг порядка, содержимое инвариантно)', () => {
  const BASE = ['a', 'b', 'c', 'd', 'e'];

  it('weekIndex 0 = идентично, сдвиг цикличен, множество сохраняется', () => {
    expect(weekRotateTopups(BASE, 0)).toEqual(BASE);
    expect(weekRotateTopups(BASE, 1)).toEqual(['b', 'c', 'd', 'e', 'a']);
    expect(weekRotateTopups(BASE, 6)).toEqual([...BASE.slice(1), 'a']);
    expect([...weekRotateTopups(BASE, 3)].sort()).toEqual([...BASE].sort());
    expect(weekRotateTopups(BASE, undefined)).toEqual(BASE);
  });

  it('корректор weekIndex=2: пул углей — тот же SET, другой порядок (квоты целы)', () => {
    const _in = { kcal: 3200, p: 170, f: 90, c: 400 };
    const mkMeal = () => ({ type: 'regular', label: 'Приём', items: [{ id: 'chicken_breast', amount: 200, kcal: 330, protein: 62, fat: 7, carbs: 0, fiber: 0 }], totals: { kcal: 330, p: 62, f: 7, c: 0, fiber: 0 } });
    const meals = Array.from({ length: 4 }, mkMeal);
    const a = correctDayToTargets(meals as any, _in as any, { maxIter: 4, weekIndex: 0 });
    const b = correctDayToTargets(meals as any, _in as any, { maxIter: 4, weekIndex: 2 });
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    // содержимое топап-пула инвариантно (порядок не режет доступность)
    const idsA = new Set(TOPUP_CARB_IDS);
    const idsB = new Set(weekRotateTopups(TOPUP_CARB_IDS, 2));
    expect(idsB).toEqual(idsA);
    // weekIndex не убивает сходимость базового дня (dev в разумном коридоре без правок)
    expect(a.deviationPct).toBeLessThan(60);
    expect(b.deviationPct).toBeLessThan(60);
    // неделя 2 ≠ неделя 1 по порядку пулов (детерминированный сдвиг)
    expect(weekRotateTopups(TOPUP_PROTEIN_IDS, 1)[0]).toBe(TOPUP_PROTEIN_IDS[1]);
    // все id существуют в FOOD_DB (sanity: ротация не вводит битые id)
    for (const id of TOPUP_CARB_IDS) expect(FOOD_DB.find(f => f.id === id), id).toBeTruthy();
  });
});
