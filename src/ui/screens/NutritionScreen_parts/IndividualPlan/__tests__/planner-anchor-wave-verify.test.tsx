/**
 * planner-anchor-wave-verify.test.ts — верификация плана Anchor-Wave (P0a/P1/P1b/P2/P4).
 * Покрывает именно новые пути (базовые инварианты — в остальных файлах):
 *  - P1b: коктейльные теги (_cocktail) на порошках и rationale-строка;
 *  - P1: структурные инварианты (кап гарниров, бан завтрака, якоря lunch/dinner);
 *  - P1a-fix2: семейные капы гарниров (рис ≤3/день, крем ≤2, без внутриприёмных дублей);
 *  - P4a: secondRecipeRoomDecision — явное решение вместо тихой мини-порции;
 *  - P4b: 🎯-цель применяется сразу (UI: модал → рескейл без регенерации);
 *  - P1b/P2: бейдж коктейля в выдаче (UI: 🥣 комбо → 🥤).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';
import { correctDayToTargets } from '../day-target-corrector';
import { IndividualPlan } from '../index';
import { secondRecipeRoomDecision, freeSnackRoomForSecond } from '../IndividualPlanContext';
import { recommendMealCount } from '../IndividualPlanSettings';
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

describe('P1a-fix2: семейные капы гарниров (жалоба «везде рисовый крем»)', () => {
  const riceMealsOf = (plan: any) =>
    plan.meals.filter((m: any) => (m.items || []).some((it: any) =>
      (it.role === 'carb_slow' || it.role === 'carb_fast') && /rice|cream_of_rice|rice_cream|rice_flakes/.test(it.id)));
  const creamMealsOf = (plan: any) =>
    plan.meals.filter((m: any) => (m.items || []).some((it: any) =>
      (it.role === 'carb_slow' || it.role === 'carb_fast') && /cream_of_rice|rice_cream/.test(it.id)));

  it('HV 900У: рис-семья ≤4 приёмов, крем ≤2 (было 5–6/3+ до фикса)', () => {
    const plan = buildDayPlan(trainBase());
    expect(riceMealsOf(plan).length).toBeLessThanOrEqual(4);
    expect(creamMealsOf(plan).length).toBeLessThanOrEqual(2);
  });

  it('база 320У: рис-семья ≤3 приёмов', () => {
    const plan = buildDayPlan(base());
    expect(riceMealsOf(plan).length).toBeLessThanOrEqual(3);
  });

  it('внутри приёма нет двух ПОЛНОЦЕННЫХ гарниров одного семейства (рис + крем)', () => {
    // Микро-топ-апы <30 г (корректор доводит У чистым носителем вместо роста риса
    // с белком) — не «рисовый крем везде», их разрешаем осознанно.
    for (const input of [base(), trainBase()]) {
      const plan = buildDayPlan(input);
      for (const m of plan.meals) {
        const carbs = (m.items || [])
          .filter((it: any) => it.role === 'carb_slow' || it.role === 'carb_fast');
        const riceOnes = carbs.filter((it: any) => /rice|cream_of_rice|rice_cream|rice_flakes/.test(it.id));
        const bigDups = riceOnes.filter((it: any) => (it.amount || 0) >= 30);
        expect(bigDups.length, `${m.label}: ${riceOnes.map((x: any) => `${x.id}:${x.amount}`).join(',')}`).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('P1b-конструктор: большой дефицит закрывается коктейлем 2–3 носителей', () => {
  const mkMeal = (label: string, type: string, items: any[]): any => {
    const totals = items.reduce((s: any, it: any) => ({
      kcal: s.kcal + it.kcal, p: s.p + it.p, f: s.f + it.f, c: s.c + it.c, fiber: (s.fiber || 0) + (it.fiber || 0),
    }), { kcal: 0, p: 0, f: 0, c: 0, fiber: 0 });
    return { label, type, items, totals, rationale: [] };
  };
  const protItem = (id: string, name: string, amount: number, p: number): any => ({
    id, name, amount, p, f: 2, c: 1, kcal: Math.round(4 * p + 18 + 4), fiber: 0, role: 'protein',
  });
  const carbItem = (id: string, name: string, amount: number, c: number): any => ({
    id, name, amount, p: 3, f: 1, c, kcal: Math.round(12 + 9 + 4 * c), fiber: 2, role: 'carb_slow',
  });

  it('белковый дефицит ≥30 г → 🥤 коктейль одной группой (мясо + жидкий белок и/или порошок)', () => {
    // Угли/жиры почти в норме (иначе worst-ось не белковая), хост с комнатой 60 г.
    const meals = [
      mkMeal('Завтрак', 'breakfast', [protItem('egg_whole', 'Яйца', 150, 19), carbItem('oats_dry', 'Овсянка', 100, 60)]),
      mkMeal('Обед', 'lunch', [protItem('chicken_breast', 'Курица', 150, 46), carbItem('potato_boiled', 'Картофель', 250, 42)]),
      mkMeal('Ужин', 'dinner', [protItem('turkey_breast', 'Индейка', 150, 43), carbItem('pasta_durum', 'Паста', 150, 45)]),
    ];
    const res = correctDayToTargets(meals as any, { kcal: 2500, p: 220, f: 12, c: 160 }, { weightKg: 90 });
    const tagged = res.meals.flatMap((m: any) => (m.items || []).filter((it: any) => (it as any)._cocktail?.kind === 'protein'));
    expect(tagged.length).toBeGreaterThanOrEqual(2);
    const groups = new Set(tagged.map((it: any) => (it as any)._cocktail.group));
    expect(groups.size).toBe(1);
    expect(res.meals.some((m: any) => ((m as any).rationale || []).some((r: string) => /Назначено коктейлем/.test(r)))).toBe(true);
  });

  it('углеводный дефицит ≥60 г → 🍯 добор одной группой (база + сладость, сахар в капе)', () => {
    const meals = [
      mkMeal('Завтрак', 'breakfast', [protItem('egg_whole', 'Яйца', 150, 19), carbItem('oats_dry', 'Овсянка', 80, 48)]),
      mkMeal('Полдник', 'snack', [protItem('cottage_cheese_5', 'Творог', 150, 25)]),
      mkMeal('Обед', 'lunch', [protItem('chicken_breast', 'Курица', 120, 37), carbItem('potato_boiled', 'Картофель', 200, 34)]),
      mkMeal('Ужин', 'dinner', [protItem('turkey_breast', 'Индейка', 120, 35), carbItem('pasta_durum', 'Паста', 120, 36)]),
    ];
    const res = correctDayToTargets(meals as any, { kcal: 4200, p: 150, f: 15, c: 400 }, { weightKg: 100, highCarb: true });
    const tagged = res.meals.flatMap((m: any) => (m.items || []).filter((it: any) => (it as any)._cocktail?.kind === 'carb'));
    expect(tagged.length).toBeGreaterThanOrEqual(2);
    const groups = new Set(tagged.map((it: any) => (it as any)._cocktail.group));
    expect(groups.size).toBe(1);
  });

  it('малый дефицит — без коктейля (legacy single-путь, без тегов)', () => {
    const meals = [
      mkMeal('Завтрак', 'breakfast', [protItem('egg_whole', 'Яйца', 150, 19), carbItem('oats_dry', 'Овсянка', 100, 60)]),
      mkMeal('Обед', 'lunch', [protItem('chicken_breast', 'Курица', 150, 46), carbItem('potato_boiled', 'Картофель', 250, 42)]),
      mkMeal('Ужин', 'dinner', [protItem('turkey_breast', 'Индейка', 150, 43), carbItem('pasta_durum', 'Паста', 150, 45)]),
    ];
    const tot = meals.reduce((s: any, m: any) => ({ p: s.p + m.totals.p, c: s.c + m.totals.c }), { p: 0, c: 0 });
    const res = correctDayToTargets(meals as any, { kcal: 2500, p: tot.p + 10, f: 70, c: tot.c + 20 }, { weightKg: 90 });
    const tagged = res.meals.flatMap((m: any) => (m.items || []).filter((it: any) => (it as any)._cocktail));
    expect(tagged.length).toBe(0);
  });
});

describe('Рекомендация числа приёмов: часы + макросы (не 5 при 800У)', () => {
  it('16 ч + обычные макросы → 5 (как раньше)', () => {
    expect(recommendMealCount(16, 180, 320)).toBe(5);
  });
  it('800У/300Б → 7 (тарелка и MPS, а не ведро)', () => {
    expect(recommendMealCount(16, 300, 800)).toBe(7);
  });
  it('600У/220Б → 5–6 по углям', () => {
    expect(recommendMealCount(16, 220, 600)).toBe(5);
  });
  it('короткий день не ниже 3, потолок 10', () => {
    expect(recommendMealCount(10, 100, 150)).toBe(3);
    expect(recommendMealCount(16, 500, 1500)).toBe(10);
  });
});

describe('P4a: secondRecipeRoomDecision — явное решение', () => {  it('остатка нет (0/минус) → abort без комнаты', () => {
    expect(secondRecipeRoomDecision(800, 800)).toEqual({ action: 'abort', roomKcal: 0 });
    expect(secondRecipeRoomDecision(800, 950)).toEqual({ action: 'abort', roomKcal: 0 });
  });

  it('мало места (<25% цели) → mini с честной комнатой', () => {
    expect(secondRecipeRoomDecision(800, 700)).toEqual({ action: 'mini', roomKcal: 100 });
    expect(secondRecipeRoomDecision(800, 650)).toEqual({ action: 'mini', roomKcal: 150 });
  });

  it('freeSnackRoomForSecond: ужимает перекусы на need, целевой приём и залоченное не трогает', () => {
    const snackItem = (id: string, amount: number, kcal: number): any => ({ id, name: id, amount, kcal, p: 5, f: 5, c: 20, fiber: 1, role: 'carb_slow' });
    const meals = [
      { label: 'Обед', type: 'lunch', items: [snackItem('rice_white', 250, 325)], totals: { kcal: 325, p: 5, f: 5, c: 70, fiber: 1 } },
      { label: 'Полдник', type: 'snack', items: [snackItem('corn_flakes', 100, 360), snackItem('jam', 50, 139)], totals: { kcal: 499, p: 10, f: 10, c: 100, fiber: 2 } },
      { label: 'Перекус', type: 'snack2', items: [snackItem('bread_white', 100, 265)], totals: { kcal: 265, p: 5, f: 5, c: 50, fiber: 1 } },
    ];
    const res = freeSnackRoomForSecond(meals as any, 0, 300);
    // Освободили ≥300, обед (idx 0) цел, математика пунктов сошлась с итогами.
    expect(res.freedKcal).toBeGreaterThanOrEqual(300);
    expect(res.meals[0].items[0].amount).toBe(250);
    for (const m of res.meals) {
      const sum = (m.items || []).reduce((s: number, it: any) => s + (it.kcal || 0), 0);
      expect(Math.abs(sum - m.totals.kcal)).toBeLessThanOrEqual(2);
      for (const it of (m.items || []) as any[]) {
        const orig = (meals as any[])[res.meals.indexOf(m)].items.find((x: any) => x.id === it.id);
        if (orig) expect(it.amount).toBeGreaterThanOrEqual(Math.max(10, orig.amount * 0.5) - 1);
      }
    }
  });

  it('freeSnackRoomForSecond: залоченные пункты и _fixedGrams не ужимаются', () => {    const meals = [
      { label: 'Обед', type: 'lunch', items: [{ id: 'a', name: 'a', amount: 100, kcal: 300, p: 5, f: 5, c: 50, fiber: 1, role: 'carb_slow' }], totals: { kcal: 300, p: 5, f: 5, c: 50, fiber: 1 } },
      { label: 'Полдник', type: 'snack', items: [{ id: 'b', name: 'b', amount: 100, kcal: 300, p: 5, f: 5, c: 50, fiber: 1, role: 'carb_slow', _fixedGrams: true }], totals: { kcal: 300, p: 5, f: 5, c: 50, fiber: 1 } },
      { label: 'Перекус', type: 'snack2', items: [{ id: 'c', name: 'c', amount: 100, kcal: 300, p: 5, f: 5, c: 50, fiber: 1, role: 'carb_slow' }], totals: { kcal: 300, p: 5, f: 5, c: 50, fiber: 1 } },
    ];
    const res = freeSnackRoomForSecond(meals as any, 0, 200, new Set(['c']));
    expect(res.meals[1].items[0].amount).toBe(100);
    expect(res.meals[2].items[0].amount).toBe(100);
    expect(res.freedKcal).toBe(0);
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
