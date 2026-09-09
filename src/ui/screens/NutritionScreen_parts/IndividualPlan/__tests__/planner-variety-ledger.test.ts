/**
 * planner-variety-ledger.test.ts — P1-1/P1-3/P1-4 (план NUTRITION-VARIETY-PLAN):
 * скользящий ledger разнообразия (капы, валидация, недельная ротация семейств).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  VARIETY_LEDGER_KEY, LEDGER_FOODS_CAP, LEDGER_RECIPES_CAP, LEDGER_WEEK_FAMILIES_CAP,
  loadVarietyLedger, saveVarietyLedger, familyDaysInWeek, type VarietyLedgerShape,
} from '../planner-variety-ledger';

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
