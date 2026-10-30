/**
 * planner-pro-fixes-ui.test.tsx — поведенческий лок на P0-баг «3-дневный план:
 * правка дня 2/3 писала в день 1». Дефект: renderMealList(d) вызывался без dayIdx
 * (дефолт 0), а updateMealTime/replaceFoodItem/removeMealRebalanced пишут в dayPlan.
 * Лок: клик по чипу порции дня 3 должен открыть лист с dayIdx=2 (0-база + смещение).
 */

import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import React from "react";
import { useRenderMealList } from "../MealListRender";

const baseCtx: any = {
  dayPlan: null, draggedItem: null, dropTarget: null, editItem: null,
  editAmount: 0, quickAddMealIdx: null, quickAddSearch: '', preferredFoods: [],
  lockedFoodIds: new Set(), healthIssues: [], plannerMode: 'simple', weightMode: 'cooked',
  findSimilarFoods: () => [], trainStart: '', trainEnd: '', effectiveKcal: 2000, effectiveP: 120,
  effectiveF: 60, effectiveC: 250, weight: 90, calcTargets: { protein: 120, kcal: 2000 },
  drugCompatReport: null, nutritionReport: null, waterCalc: null, excludedFoods: [], injections: [], linkToTraining: false,
  moveFoodItem: () => {}, removeFoodItem: () => {}, replaceFoodItem: () => {}, updateItemAmount: () => {},
  addFoodToMeal: () => {}, addSnackComboToMeal: () => {}, saveUndo: () => {}, setExcludedFoods: () => {},
  weightLogEntries: [], setDayPlan: () => {}, setEditAmount: () => {}, setEditItem: () => {},
  setDraggedItem: () => {}, setDropTarget: () => {}, setQuickAddMealIdx: () => {}, setQuickAddSearch: () => {},
  setRecipePickerMeal: () => {}, setReplacingItem: () => {}, toggleLockFood: () => {},
  pickRecipeOption: () => {}, moreRecipeOptions: () => {}, refreshRecipeSuggestions: () => {},
  favoriteRecipes: new Set(), toggleFavoriteRecipe: () => {}, isFavoriteRecipe: () => false,
  removeMealRebalanced: () => {}, rescaleSecondRecipeInMeal: () => {}, removeSecondRecipeFromMeal: () => {},
  proteinPreset: 'base', phase: 'mass', generationMode: 'products',
  recipePreset: null, selectedDayIndex: 0, planDays: 3, threeDayPlan: null, weekPlan: null,
};

const day3: any = {
  totals: { kcal: 500, p: 30, f: 10, c: 60, fiber: 5 },
  meals: [{
    label: 'Перекус', time: '16:00', type: 'snack',
    items: [{ id: 'oats', name: 'Овсянка', amount: 50, kcal: 170, p: 6, f: 3, c: 30, fiber: 5, role: 'carb_slow' }],
    totals: { kcal: 170, p: 6, f: 3, c: 30, fiber: 5 },
    rationale: [],
  }],
};

const Harness: React.FC<{ ctx: any }> = ({ ctx }) => {
  const renderList = useRenderMealList(ctx);
  return <div>{renderList(day3, true, 2)}</div>;
};

describe("P0: 3-дневный план — правка дня 3 не пишет в день 1", () => {
  it("клик по чипу порции дня 3 открывает лист с dayIdx=2 (смещение threeDay)", () => {
    const setEditItem = vi.fn();
    const ctx = { ...baseCtx, setEditItem };
    const { getByLabelText } = render(<Harness ctx={ctx} />);
    fireEvent.click(getByLabelText('Порция: Овсянка — открыть настройки'));
    expect(setEditItem).toHaveBeenCalledWith({ dayIdx: 2, mealIdx: 0, itemIdx: 0 });
  });
});
