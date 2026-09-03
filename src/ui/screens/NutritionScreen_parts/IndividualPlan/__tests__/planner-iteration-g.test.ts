/**
 * planner-iteration-g.test.ts — итерация G (HIGH-VOLUME план, разд. 6–8).
 * G1 сырое/готовое, G2 селектор видимых планов + buyAmount, G3 второй рецепт.
 */
import { describe, it, expect } from 'vitest';
import {
  displayAmount, toRawPurchaseAmount, foodWeightState, cookFactorFor,
  recipeMeasureLint, readWeightMode,
} from '../planner-weight-mode';
import {
  buildShoppingFromPlans, rebalanceDayAfterRecipes, scaleRecipeToTarget,
  sumMealTotals,
} from '../planner-recipe-mode';
import { selectVisiblePlans } from '../planner-derived-sync';
import { RECIPE_DB } from '../../../../../data/recipe-db';
import type { Recipe } from '../../../../../engines/nutrition-periodization.engine';

describe('G1: режим веса сырое/готовое (display-слой, математика не трогается)', () => {
  it('готовая крупа в raw-режиме → сухой вес (рис 280 гот. → 100 сух.)', () => {
    expect(foodWeightState('rice_white')).toBe('cooked');
    const d = displayAmount('rice_white', 280, 'raw');
    expect(d.suffix).toBe('сух.');
    expect(d.grams).toBeGreaterThanOrEqual(90);
    expect(d.grams).toBeLessThanOrEqual(110);
  });

  it('сухая крупа в cooked-режиме → готовый вес (oats_dry 40 → ~120 гот.)', () => {
    expect(foodWeightState('oats_dry')).toBe('dry');
    const d = displayAmount('oats_dry', 40, 'cooked');
    expect(d.suffix).toBe('гот.');
    expect(d.grams).toBeGreaterThanOrEqual(100);
    expect(d.grams).toBeLessThanOrEqual(140);
  });

  it('мясо/не-крупы — без суффикса и без конверсии', () => {
    const d = displayAmount('chicken_breast', 250, 'raw');
    expect(d.suffix).toBe('');
    expect(d.grams).toBe(250);
  });

  it('закупки: готовая крупа → сырой вес (купить), сухая — как есть', () => {
    expect(toRawPurchaseAmount('rice_white', 280)).toBeLessThanOrEqual(110);
    expect(toRawPurchaseAmount('oats_dry', 40)).toBe(40);
    expect(toRawPurchaseAmount('chicken_breast', 250)).toBe(250);
  });

  it('roundtrip сух→гот→сух в пределах ±5г', () => {
    const raw = 60;
    const cooked = displayAmount('oats_dry', raw, 'cooked').grams;
    const back = toRawPurchaseAmount('oats_dry', displayAmount('rice_white', cooked, 'cooked').grams);
    expect(Math.abs(toRawPurchaseAmount('rice_white', cooked) - raw)).toBeLessThanOrEqual(5);
    expect(back).toBeGreaterThan(0);
  });

  it('линт рецепта: две основы в разных мерах ловятся, панировка/связка — нет', () => {
    expect(recipeMeasureLint(['rice_white', 'oats_dry'], { rice_white: 150, oats_dry: 80 }).length).toBeGreaterThan(0);
    // мелкая сухая связка (<50 г) + готовая основа — чисто (суффикс «сух.» disambiguates)
    expect(recipeMeasureLint(['chickpeas', 'oats_dry'], { chickpeas: 80, oats_dry: 20 })).toEqual([]);
    expect(recipeMeasureLint(['chicken_breast', 'rice_white'])).toEqual([]);
    expect(recipeMeasureLint(['chicken_breast', 'oats_dry'])).toEqual([]);
    expect(recipeMeasureLint(undefined)).toEqual([]);
  });

  it('RECIPE_DB: рецепты без смеси мер крупяных основ', () => {
    const bad = (RECIPE_DB as Recipe[]).filter(r => recipeMeasureLint(r.ingredientIds, r.portions).length > 0);
    expect(bad.map(r => r.name)).toEqual([]);
  });

  it('readWeightMode: дефолт cooked при пустом storage', () => {
    try { localStorage.removeItem('he_planner_weight_mode'); } catch {}
    expect(readWeightMode()).toBe('cooked');
  });

  it('cookFactorFor неизвестного продукта = 1', () => {
    expect(cookFactorFor('no_such_food_xyz')).toBe(1);
  });
});

describe('G2: селектор видимых планов + закупки с buyAmount', () => {
  const mkDay = (tag: string) => ({
    meals: [{ label: 'Обед', items: [{ id: 'rice_white', name: 'Рис', amount: 280, kcal: 364, p: 7.6, f: 0.8, c: 78.4 }] }],
    totals: { kcal: 364, p: 7.6, f: 0.8, c: 78.4 },
    tag,
  });

  it('day: один план; three: подмена выбранного дня; week: все дни', () => {
    const d1 = mkDay('d1'); const d2 = mkDay('d2'); const d3 = mkDay('d3');
    expect(selectVisiblePlans({ planDays: 1, dayPlan: d1, threeDayPlan: null, weekPlan: null, selectedDayIndex: 0 })).toEqual([d1]);
    const three = { days: [d1, d2, d3] };
    const vis = selectVisiblePlans({ planDays: 3, dayPlan: { ...d1, tag: 'edited' }, threeDayPlan: three, weekPlan: null, selectedDayIndex: 1 });
    expect(vis[1]).toEqual({ ...d1, tag: 'edited' });
    expect(vis.length).toBe(3);
    const week = { days: [d1, d2] };
    expect(selectVisiblePlans({ planDays: 7, dayPlan: d1, threeDayPlan: three, weekPlan: week, selectedDayIndex: 0 }).length).toBe(2);
  });

  it('пусто без планов', () => {
    expect(selectVisiblePlans({ planDays: 1, dayPlan: null, threeDayPlan: null, weekPlan: null, selectedDayIndex: 0 })).toEqual([]);
  });

  it('buildShoppingFromPlans: buyAmount = сырой вес (рис 280 → ~100 купить)', () => {
    const list = buildShoppingFromPlans([mkDay('d1')] as any);
    const rice = list.find((x: any) => x.id === 'rice_white');
    expect(rice).toBeTruthy();
    expect(rice.amount).toBe(280);
    expect(rice.buyAmount).toBeLessThanOrEqual(110);
  });
});

describe('G3: второй рецепт — ядра не режутся, посадка раздельная', () => {
  const mkMeal = () => ({
    label: 'Обед',
    type: 'lunch',
    target: { p: 55, f: 18, c: 90 },
    items: [
      { id: 'chicken_breast', name: 'Курица', amount: 200, kcal: 330, p: 62, f: 7.2, c: 0 },
      { id: 'rice_white', name: 'Рис', amount: 250, kcal: 325, p: 6.8, f: 0.8, c: 70 },
      { id: 'salmon', name: 'Лосось', amount: 150, kcal: 300, p: 30, f: 20, c: 0 },
      { id: 'buckwheat', name: 'Гречка', amount: 200, kcal: 220, p: 8.4, f: 2.2, c: 40 },
    ],
    totals: { kcal: 1175, p: 107.2, f: 30.2, c: 110 },
    recipeApplied: 'Рецепт1',
    recipeAppliedData: { name: 'Рецепт1', ingredientIds: ['chicken_breast', 'rice_white'] },
    recipeApplied2: 'Рецепт2',
    recipeAppliedData2: { name: 'Рецепт2', ingredientIds: ['salmon', 'buckwheat'] },
  });

  it('перебор дня: ядра обоих рецептов не удаляются (только сайды/масштаб)', () => {
    const meals = [mkMeal()] as any;
    const rb = rebalanceDayAfterRecipes(meals, { kcal: 700, p: 55, f: 18, c: 90 });
    const ids = new Set((rb.meals[0].items || []).map((it: any) => it.id));
    expect(ids.has('chicken_breast')).toBe(true);
    expect(ids.has('rice_white')).toBe(true);
    expect(ids.has('salmon')).toBe(true);
    expect(ids.has('buckwheat')).toBe(true);
  });

  it('мини-остаток 150 ккал → порция ×0.5, items непустые', () => {
    const r: Recipe = {
      name: 'Второй', meal: 'lunch', prepTimeMin: 15, kcal: 480, protein: 45, fat: 15, carbs: 35,
      ingredients: ['Курица 150 г', 'Рис 60 г'], instructions: ['Готовить'], tags: [],
      ingredientIds: ['chicken_breast', 'rice_white'], portions: { chicken_breast: 150, rice_white: 60 },
    } as Recipe;
    const scaled = scaleRecipeToTarget(r, { kcal: 150, p: 55, f: 18, c: 90 }, 100);
    expect(scaled).not.toBeNull();
    expect(scaled!.portions).toBe(0.5);
    expect(scaled!.items.length).toBeGreaterThan(0);
    expect(sumMealTotals(scaled!.items).kcal).toBeLessThan(480);
  });
});
