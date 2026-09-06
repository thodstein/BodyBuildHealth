/**
 * planner-anchor-wave-verify.test.ts — верификация плана Anchor-Wave (P0a/P1/P1b/P2/P4).
 * Покрывает именно новые пути (базовые инварианты — в остальных файлах):
 *  - P1b: коктейльные теги (_cocktail) на порошках и rationale-строка;
 *  - P1: структурные инварианты (кап гарниров, бан завтрака, якоря lunch/dinner);
 *  - P4a: secondRecipeRoomDecision — явное решение вместо тихой мини-порции;
 *  - P4b: 🎯-цель применяется сразу (UI: модал → рескейл без регенерации);
 *  - P1b/P2: бейдж коктейля в выдаче (UI: 🥣 комбо → 🥤).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';
import { IndividualPlan } from '../index';
import { secondRecipeRoomDecision } from '../IndividualPlanContext';
import { useRenderMealList } from '../MealListRender';

const base = (overrides: any = {}): MealPlanInput => ({
  weightKg: 90, lbmKg: 74, bodyFatPct: 18, sex: 'male' as const,
  goalKcal: 3000, goalProteinG: 190, goalFatG: 80, goalCarbsG: 320,
  mealsCount: 5, isTrainingDay: false, budget: 'medium' as const, dayOffset: 0,
  cyclePhase: 'maintenance' as const, variety: 'max' as const,
  randomSalt: 3, wakeTime: '07:00', bedTime: '23:00', dinnerTime: '19:00',
  ...overrides,
} as any);

const trainBase = (overrides: any = {}) => base({
  weightKg: 110, lbmKg: 90, goalKcal: 5100, goalProteinG: 220, goalFatG: 110, goalCarbsG: 800,
  mealsCount: 6, isTrainingDay: true, trainStartMin: 17 * 60, trainDurationMin: 90,
  allowIntraWorkout: true, ...overrides,
});

describe('P1b: коктейли — единая сущность', () => {
  it('порошок ≥20 г тегирован _cocktail=protein (пост-трен шейк)', () => {
    const plan = buildDayPlan(trainBase());
    const post = plan.meals.find(m => m.type === 'postworkout')!;
    expect(post).toBeTruthy();
    const pow = (post.items || []).find((i: any) => i.id === 'whey_isolate');
    expect(pow).toBeTruthy();
    expect((pow as any)._cocktail?.kind).toBe('protein');
    expect((pow as any)._cocktail?.name).toMatch(/коктейл/i);
  });

  it('rationale приёма содержит строку коктейля', () => {
    const plan = buildDayPlan(trainBase());
    const post = plan.meals.find(m => m.type === 'postworkout')!;
    expect((post.rationale || []).some(r => /Протеиновый коктейль/.test(r))).toBe(true);
  });

  it('теги не ломают математику (итоги = сумма пунктов)', () => {
    const plan = buildDayPlan(trainBase());
    for (const m of plan.meals) {
      const sum = (m.items || []).reduce((s: number, it: any) => s + (it.kcal || 0), 0);
      expect(Math.abs(sum - m.totals.kcal)).toBeLessThanOrEqual(2);
    }
  });
});

describe('P1: структурные инварианты якорей/типологии', () => {
  it('обед и ужин — якорные белки дня (курица/индейка)', () => {
    const plan = buildDayPlan(base());
    const lunch = plan.meals.find(m => m.type === 'lunch')!;
    const dinner = plan.meals.find(m => m.type === 'dinner')!;
    const protOf = (m: any) => (m.items || []).find((i: any) => i.role === 'protein')?.id;
    expect(['chicken_breast', 'turkey_breast']).toContain(protOf(lunch));
    expect(['chicken_breast', 'turkey_breast']).toContain(protOf(dinner));
  });

  it('не-HV приём несёт не больше 2 гарниров', () => {
    const plan = buildDayPlan(base());
    for (const m of plan.meals) {
      const n = (m.items || []).filter((i: any) => i.role === 'carb_slow' || i.role === 'carb_fast').length;
      expect(n, m.label).toBeLessThanOrEqual(2);
    }
  });

  it('в завтраке нет гарниров-нарушителей (рис/картофель/макароны/фунчоза)', () => {
    for (const salt of [1, 2, 3]) {
      const plan = buildDayPlan(base({ randomSalt: salt }));
      const b = plan.meals.find(m => m.type === 'breakfast')!;
      const bad = (b.items || []).filter((i: any) => /rice_white|potato|pasta|noodle|glass|funchose|bulgur/i.test(i.id));
      expect(bad.map((x: any) => x.id), `salt ${salt}`).toEqual([]);
    }
  });

  it('фунчоза нигде не превышает 100 г', () => {
    const plan = buildDayPlan(trainBase());
    for (const m of plan.meals) {
      for (const it of (m.items || []) as any[]) {
        if (/glass|funchose|rice_noodles/i.test(it.id)) {
          expect(it.amount, `${m.label} ${it.id}`).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  it('честная строка Факт: присутствует в приёмах', () => {
    const plan = buildDayPlan(base());
    for (const m of plan.meals) {
      if ((m.items || []).length === 0) continue;
      expect((m.rationale || []).some(r => r.startsWith('Факт:')), m.label).toBe(true);
    }
  });
});

describe('P4a: secondRecipeRoomDecision — явное решение', () => {
  it('остатка нет (0/минус) → abort без комнаты', () => {
    expect(secondRecipeRoomDecision(800, 800)).toEqual({ action: 'abort', roomKcal: 0 });
    expect(secondRecipeRoomDecision(800, 950)).toEqual({ action: 'abort', roomKcal: 0 });
  });

  it('мало места (<25% цели) → mini с честной комнатой', () => {
    expect(secondRecipeRoomDecision(800, 700)).toEqual({ action: 'mini', roomKcal: 100 });
    expect(secondRecipeRoomDecision(800, 650)).toEqual({ action: 'mini', roomKcal: 150 });
  });

  it('места хватает (≥25%) → full', () => {
    expect(secondRecipeRoomDecision(800, 500)).toEqual({ action: 'full', roomKcal: 300 });
    expect(secondRecipeRoomDecision(800, 0)).toEqual({ action: 'full', roomKcal: 800 });
  });

  it('граница 25% — full, вырожденная цель — abort', () => {
    expect(secondRecipeRoomDecision(800, 600).action).toBe('full');
    expect(secondRecipeRoomDecision(0, 0).action).toBe('abort');
    expect(secondRecipeRoomDecision(NaN as any, 100).action).toBe('abort');
  });
});

// ─── UI-верификация P1b/P4 (живой IndividualPlan, паттерн e2e) ───
const bodyHas = (re: RegExp) => !!(document.body.textContent || '').match(re);
function readDayPlan(): any {
  try { return JSON.parse(localStorage.getItem('he_day_plan') || 'null'); } catch { return null; }
}

describe('P1b/P4: UI выдачи (бейдж коктейля, live-цель)', () => {
  beforeEach(() => { try { localStorage.clear(); localStorage.removeItem('he_planner_gen_mode'); } catch {} });
  afterEach(() => { try { cleanup(); } catch {} });

  async function genPlan() {
    render(<IndividualPlan profile={null} course={[]} labs={[]} labAnalysis={null} />);
    const btn = Array.from(document.querySelectorAll<HTMLElement>('button'))
      .find(b => /Сгенерировать план питания/.test(b.textContent || ''))
      ?? Array.from(document.querySelectorAll<HTMLElement>('button'))
        .find(b => /Сгенерировать план по рецептам/.test(b.textContent || ''));
    if (!btn) throw new Error('generate button not found');
    fireEvent.click(btn);
    await waitFor(() => { expect(bodyHas(/Завтрак/)).toBe(true); }, { timeout: 45000 });
  }

  it('P1b: 🥣 комбо в перекусе даёт бейдж 🥤 (коктейль — единая сущность)', async () => {
    // Прямой рендер списка с тегированным шейком (без зависимости от состава автоплана):
    // движок тегирует порошок ≥20 г (проверено выше), UI обязан показать бейдж.
    const stubCtx: any = {
      dayPlan: null, draggedItem: null, dropTarget: null, editItem: null, replacingItem: null,
      editAmount: 0, quickAddMealIdx: null, quickAddSearch: '', preferredFoods: [],
      lockedFoodIds: new Set(), healthIssues: [], plannerMode: 'simple', weightMode: 'cooked',
      findSimilarFoods: () => [], trainStart: '', trainEnd: '', effectiveKcal: 2000, effectiveP: 120,
      effectiveF: 60, effectiveC: 250, weight: 90, calcTargets: { protein: 120, kcal: 2000 },
      drugCompatReport: null,
      nutritionReport: null, waterCalc: null, excludedFoods: [], injections: [], linkToTraining: false,
      moveFoodItem: () => {}, removeFoodItem: () => {}, replaceFoodItem: () => {}, updateItemAmount: () => {},
      addFoodToMeal: () => {}, addSnackComboToMeal: () => {}, saveUndo: () => {}, setExcludedFoods: () => {},
      trainStart: '', trainEnd: '', weightLogEntries: [], setDayPlan: () => {}, setEditAmount: () => {}, setEditItem: () => {}, setDraggedItem: () => {},
      setDropTarget: () => {}, setQuickAddMealIdx: () => {}, setQuickAddSearch: () => {},
      setRecipePickerMeal: () => {}, setReplacingItem: () => {}, toggleLockFood: () => {},
      pickRecipeOption: () => {}, moreRecipeOptions: () => {}, refreshRecipeSuggestions: () => {},
      favoriteRecipes: new Set(), toggleFavoriteRecipe: () => {}, isFavoriteRecipe: () => false,
      removeMealRebalanced: () => {}, rescaleSecondRecipeInMeal: () => {}, removeSecondRecipeFromMeal: () => {},
      proteinPreset: 'base', phase: 'mass', generationMode: 'products', weightModeX: undefined,
      recipePreset: null, selectedDayIndex: 0, planDays: 1, threeDayPlan: null, weekPlan: null,
    };
    const day: any = {
      totals: { kcal: 500, p: 30, f: 10, c: 60, fiber: 5 },
      meals: [{
        label: 'Полдник', time: '16:00', type: 'snack',
        items: [
          { id: 'whey_isolate', name: 'Изолят сывороточного белка', amount: 30, kcal: 114, p: 26, f: 0.3, c: 0.3, fiber: 0, role: 'fast_protein', _cocktail: { kind: 'protein', name: '🥤 Протеиновый коктейль', group: 'protein:Полдник' } },
          { id: 'oats', name: 'Овсянка', amount: 50, kcal: 170, p: 6, f: 3, c: 30, fiber: 5, role: 'carb_slow' },
        ],
        totals: { kcal: 284, p: 32, f: 3.3, c: 30.3, fiber: 5 },
        rationale: ['🥤 Протеиновый коктейль (Изолят 30 г ≈ 26 г белка) — взбить блендером'],
      }],
    };
    const Harness = () => {
      const renderList = useRenderMealList(stubCtx);
      return <>{renderList(day, true, 0)}</>;
    };
    render(<Harness />);
    await waitFor(() => { expect(bodyHas(/🥤/)).toBe(true); }, { timeout: 8000 });
  }, 30000);

  it('P4b: 🎯-цель применяется сразу без регенерации', async () => {
    await genPlan();
    const before = readDayPlan();
    expect(before?.meals?.length).toBeGreaterThan(0);
    const bf = before.meals[0];
    const beforeP = Math.round(bf.totals.p);
    const targetBtn = Array.from(document.querySelectorAll<HTMLElement>('span'))
      .find(s => (s.textContent || '') === '🎯');
    if (!targetBtn) throw new Error('🎯 button not found');
    fireEvent.click(targetBtn);
    await waitFor(() => { expect(bodyHas(/Цель приёма/)).toBe(true); }, { timeout: 8000 });
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="number"]'));
    expect(inputs.length).toBeGreaterThanOrEqual(3);
    fireEvent.change(inputs[0], { target: { value: String(beforeP + 25) } });
    const save = Array.from(document.querySelectorAll<HTMLElement>('button'))
      .find(b => (b.textContent || '').includes('Сохранить'));
    if (!save) throw new Error('save button not found');
    fireEvent.click(save);
    // оверрайд персистентен И приём пересчитан сразу (без повторной генерации)
    await waitFor(() => {
      const ov = JSON.parse(localStorage.getItem('he_meal_target_overrides') || '[]');
      expect(ov.some((o: any) => o && o.label === bf.label)).toBe(true);
      const after = readDayPlan();
      const m2 = after.meals.find((m: any) => m.label === bf.label);
      expect(m2.totals.p).toBeGreaterThan(beforeP);
    }, { timeout: 8000 });
  }, 120000);
});
