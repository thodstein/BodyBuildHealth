/**
 * planner-recipe-mode.ts — режим генерации плана питания «по рецептам».
 *
 * Включается карточкой «🍳 По рецептам» в настройках генерации (localStorage he_planner_gen_mode).
 * Основные приёмы (Завтрак/Обед/Ужин) собираются из готовых рецептов БД:
 *   - на каждый приём подбирается 2–3 варианта (pickRecipeOptions), выбор — одним тапом;
 *   - рецепт собирается с АВТОРСКИМИ порциями (decomposeRecipe: ingredientIds + portions),
 *     а не равным сплитом ккал;
 *   - недобор/перебор дня закрывается ребалансом гибких слотов (перекусы/жиры/углеводы)
 *     до попадания дневных КБЖУ в ±3% от цели (без правки выбранного рецепта);
 *   - закупки (buildShoppingFromPlans) и «План готовки» (buildRecipeCookingPlan)
 *     строятся из фактических ингредиентов выбранных рецептов.
 *
 * Модуль чистый (без React) — покрывается прямыми тестами.
 */

import { FOOD_DB } from '../../../../core/nutrition-database';
import type { FoodItem } from '../../../../core/nutrition-database';
import type { Recipe } from '../../../../engines/nutrition-periodization.engine';
import { decomposeRecipe, pickRecipesForMeal } from './recipe-engine';
import type { RecipeMatchOptions } from './recipe-engine';

// ─── Типы формы плана (совместимо с форматом IndividualPlanContext) ────

export interface PlanItemLike {
  name: string; id: string; amount: number;
  kcal: number; p: number; f: number; c: number;
  fiber?: number; leucine_mg?: number; role?: string;
}

export interface PlanTotalsLike { kcal: number; p: number; f: number; c: number; fiber?: number }

export interface FlatRecipeOption {
  name: string; meal: string;
  kcal: number; protein: number; fat: number; carbs: number;
  prepTimeMin: number; usefulness?: number; description?: string;
  ingredients: string[]; instructions: string[]; tags: string[];
  difficulty?: string;
  ingredientIds?: string[];
  portions?: Record<string, number>;
}

export interface PlanMealLike {
  label?: string; time?: string;
  items: PlanItemLike[]; totals: PlanTotalsLike;
  target?: { p?: number; f?: number; c?: number };
  rationale?: string[];
  /** Выбранный рецепт режима «по рецептам» */
  recipeApplied?: string;
  /** Полные данные выбранного рецепта (для карточки готовки) — JSON-safe */
  recipeAppliedData?: FlatRecipeOption;
  /** 2–3 варианта на выбор (режим «по рецептам») */
  recipeOptions?: FlatRecipeOption[];
  /** Имена уже показанных вариантов — для кнопки «Другие варианты» */
  recipeOptionNames?: string[];
}

// ─── Консистентность КБЖУ (требование ≤3%) ─────────────────────────────

/** Отклонение калорийности от формулы 4Б+4У+9Ж, в % от kcal. */
export function kbjuFormulaDeviationPct(kcal: number, p: number, f: number, c: number): number {
  const k = Math.max(1, kcal);
  const formula = 4 * (p || 0) + 4 * (c || 0) + 9 * (f || 0);
  return Math.abs(k - formula) / k * 100;
}

// ─── Основные приёмы ────────────────────────────────────────────────────

export const MAIN_MEAL_LABELS = ['Завтрак', 'Обед', 'Ужин'] as const;

export function isMainMealLabel(label: string | undefined): boolean {
  return !!label && (MAIN_MEAL_LABELS as readonly string[]).includes(label);
}

export function mealTypeFromLabel(label: string | undefined): RecipeMatchOptions['mealType'] {
  switch (label) {
    case 'Завтрак': return 'breakfast';
    case 'Обед': return 'lunch';
    case 'Ужин': return 'dinner';
    default: return 'snack';
  }
}

// ─── Варианты рецептов ─────────────────────────────────────────────────

/** Плоская JSON-safe копия рецепта для хранения прямо в плане (персист в localStorage). */
export function flattenRecipeOption(r: Recipe): FlatRecipeOption {
  return {
    name: r.name, meal: r.meal,
    kcal: r.kcal, protein: r.protein, fat: r.fat, carbs: r.carbs,
    prepTimeMin: r.prepTimeMin, usefulness: r.usefulness, description: r.description,
    ingredients: [...(r.ingredients || [])], instructions: [...(r.instructions || [])], tags: [...(r.tags || [])],
    difficulty: r.difficulty,
    ingredientIds: r.ingredientIds ? [...r.ingredientIds] : undefined,
    portions: r.portions ? { ...r.portions } : undefined,
  };
}

/** Обратная сборка Recipe-подобного объекта из плоского варианта (для decomposeRecipe). */
export function rebuildRecipeFromFlat(flat: FlatRecipeOption): Recipe {
  return {
    name: flat.name, meal: flat.meal, prepTimeMin: flat.prepTimeMin ?? 15,
    kcal: flat.kcal, protein: flat.protein, fat: flat.fat, carbs: flat.carbs,
    ingredients: flat.ingredients || [], instructions: flat.instructions || [], tags: flat.tags || [],
    difficulty: flat.difficulty as Recipe['difficulty'],
    ingredientIds: flat.ingredientIds,
    portions: flat.portions,
  };
}

/**
 * Топ-N кандидатов рецептов под приём, исключая уже показанные/использованные имена.
 */
export function pickRecipeOptions(
  recipes: Recipe[],
  opts: RecipeMatchOptions,
  count: number = 3,
  excludeNames?: Set<string>,
): Recipe[] {
  const pool = excludeNames && excludeNames.size > 0
    ? recipes.filter(r => !excludeNames.has(r.name))
    : recipes;
  return pickRecipesForMeal(pool, opts, count);
}

// ─── Сборка приёма из рецепта (авторские порции) ───────────────────────

/**
 * Разбирает рецепт в items плана через decomposeRecipe (ingredientIds+portions → FOOD_DB).
 * Возвращает null, если разбор не дал ни одного продукта (вызывающий код падает обратно
 * на старую логику равного сплита).
 */
export function buildRecipeMealItems(recipe: Recipe): PlanItemLike[] | null {
  let items: ReturnType<typeof decomposeRecipe>;
  try { items = decomposeRecipe(recipe); } catch { return null; }
  if (!items || items.length === 0) return null;
  return items.map(it => ({
    name: it.name, id: it.id, amount: it.amount,
    kcal: it.kcal, p: it.p, f: it.f, c: it.c,
    fiber: it.fiber, leucine_mg: it.leucine_mg, role: it.role,
  }));
}

export function sumMealTotals(items: PlanItemLike[]): PlanTotalsLike {
  return {
    kcal: items.reduce((s, i) => s + (i.kcal || 0), 0),
    p: Math.round(items.reduce((s, i) => s + (i.p || 0), 0) * 10) / 10,
    f: Math.round(items.reduce((s, i) => s + (i.f || 0), 0) * 10) / 10,
    c: Math.round(items.reduce((s, i) => s + (i.c || 0), 0) * 10) / 10,
    fiber: Math.round(items.reduce((s, i) => s + (i.fiber || 0), 0) * 10) / 10,
  };
}

export function sumDayTotals(meals: PlanMealLike[]): PlanTotalsLike {
  return {
    kcal: meals.reduce((s, m) => s + (m.totals?.kcal || 0), 0),
    p: Math.round(meals.reduce((s, m) => s + (m.totals?.p || 0), 0) * 10) / 10,
    f: Math.round(meals.reduce((s, m) => s + (m.totals?.f || 0), 0) * 10) / 10,
    c: Math.round(meals.reduce((s, m) => s + (m.totals?.c || 0), 0) * 10) / 10,
    fiber: Math.round(meals.reduce((s, m) => s + (m.totals?.fiber || 0), 0) * 10) / 10,
  };
}

// ─── Ребаланс дня (недобор/перебор → ±3%) ──────────────────────────────

export interface DayMacroTargets { kcal: number; p: number; f: number; c: number }

export interface RebalanceResult {
  meals: PlanMealLike[];
  notes: string[];
  deviationPct: number;
  withinTolerance: boolean;
}

/** Единая лестница «человеческих» граммовок для уменьшения порций. */
const SHRINK_LADDER = [10, 15, 20, 25, 30, 40, 50, 60, 75, 90, 100, 120, 125, 150, 175, 200, 250, 300, 350, 400, 450, 500, 600, 750, 900, 1000];

function scaleItem(it: PlanItemLike, newAmount: number): PlanItemLike {
  const r = newAmount / (it.amount || 1);
  return {
    ...it,
    amount: newAmount,
    kcal: Math.round((it.kcal || 0) * r),
    p: Math.round((it.p || 0) * r * 10) / 10,
    f: Math.round((it.f || 0) * r * 10) / 10,
    c: Math.round((it.c || 0) * r * 10) / 10,
    fiber: it.fiber != null ? Math.round(it.fiber * r * 10) / 10 : undefined,
    leucine_mg: it.leucine_mg != null ? Math.round(it.leucine_mg * r) : undefined,
  };
}

const TOPUP_PROTEIN_IDS = ['chicken_breast', 'cottage_cheese_5', 'whey_isolate', 'turkey_breast', 'beef_lean', 'casein'];
const TOPUP_CARB_IDS = ['rice_white', 'oats', 'banana', 'buckwheat', 'potato_boiled', 'sweet_potato', 'rice_basmati'];
const TOPUP_FAT_IDS = ['olive_oil', 'walnuts', 'almonds', 'peanut_butter', 'avocado'];

function topupFoods(ids: string[], excludedIds?: Set<string>): FoodItem[] {
  return ids
    .map(id => FOOD_DB.find(f => f.id === id))
    .filter((f): f is FoodItem => !!f && !(excludedIds && excludedIds.has(f.id)));
}

function flexMealIndex(meals: PlanMealLike[]): number {
  for (let i = meals.length - 1; i >= 0; i--) {
    const l = meals[i]?.label || '';
    if (/Перекус|Полдник|Второй завтрак|Пост-трен|Перед сном/i.test(l)) return i;
  }
  // нет перекусов — берём последний приём, который НЕ собран из рецепта (не портим авторские порции)
  for (let i = meals.length - 1; i >= 0; i--) {
    if (!meals[i]?.recipeApplied) return i;
  }
  return meals.length - 1;
}

function maxDeviationPct(totals: PlanTotalsLike, t: DayMacroTargets): number {
  const dk = Math.abs((totals.kcal || 0) - (t.kcal || 0)) / Math.max(1, t.kcal || 1) * 100;
  const dp = Math.abs((totals.p || 0) - (t.p || 0)) / Math.max(1, t.p || 1) * 100;
  const df = Math.abs((totals.f || 0) - (t.f || 0)) / Math.max(1, t.f || 1) * 100;
  const dc = Math.abs((totals.c || 0) - (t.c || 0)) / Math.max(1, t.c || 1) * 100;
  return Math.max(dk, dp, df, dc);
}

/**
 * Ребаланс дня после сборки основных приёмов из рецептов.
 * Недобор закрывается добавлением топ-апа в гибкий слот (перекус), перебор —
 * урезанием порций НЕ-рецептурных приёмов (жиры → углеводы → прочее по приоритету).
 * Выбранные рецепты не трогаются (авторские порции сохраняются).
 * Гарантия ±3% достигается при согласуемых целях (рецепты подобраны под цели приёмов,
 * гибкие слоты поглощают остаток); при физически несовместимых целях возвращается
 * лучшее достижимое + флаг withinTolerance=false.
 */
export function rebalanceDayAfterRecipes(
  meals: PlanMealLike[],
  targets: DayMacroTargets,
  opts?: { excludedIds?: Set<string>; maxIter?: number },
): RebalanceResult {
  const notes: string[] = [];
  const maxIter = opts?.maxIter ?? 8;
  const work: PlanMealLike[] = meals.map(m => ({ ...m, items: [...(m.items || [])], totals: { ...(m.totals || { kcal: 0, p: 0, f: 0, c: 0 }) } }));

  const validTargets: DayMacroTargets = {
    kcal: Number.isFinite(targets?.kcal) && (targets.kcal || 0) > 0 ? targets.kcal : 0,
    p: Number.isFinite(targets?.p) && (targets.p || 0) > 0 ? targets.p : 0,
    f: Number.isFinite(targets?.f) && (targets.f || 0) > 0 ? targets.f : 0,
    c: Number.isFinite(targets?.c) && (targets.c || 0) > 0 ? targets.c : 0,
  };

  for (let iter = 0; iter < maxIter; iter++) {
    const totals = sumDayTotals(work);
    const dev = maxDeviationPct(totals, validTargets);
    if (dev <= 3) break;

    const dKcal = validTargets.kcal - totals.kcal;
    const dP = validTargets.p - totals.p;
    const dF = validTargets.f - totals.f;
    const dC = validTargets.c - totals.c;

    if (dKcal > 0 || dP > 0 || dF > 0 || dC > 0) {
      // ── Недобор: добавляем топ-ап в гибкий слот ──
      const fi = flexMealIndex(work);
      if (fi < 0 || !work[fi]) break;
      const relP = dP / Math.max(1, validTargets.p);
      const relF = dF / Math.max(1, validTargets.f);
      const relC = dC / Math.max(1, validTargets.c);
      const headroomKcal = Math.max(60, dKcal);
      const pick = (pool: FoodItem[]): FoodItem | null => {
        const usable = pool.filter(f => (f.kcal || 0) > 0);
        if (usable.length === 0) return null;
        // максимум белка/макро на ккал + бонус качества
        return usable.sort((a, b) => (b.bb_quality_score || 0) - (a.bb_quality_score || 0))[0] || null;
      };
      let chosen: FoodItem | null = null;
      let chosenRole = '';
      const dominant = Math.max(relP, relC, relF);
      if (dominant <= 0) break;
      if (relP >= relC && relP >= relF) { chosen = pick(topupFoods(TOPUP_PROTEIN_IDS, opts?.excludedIds)); chosenRole = 'protein'; }
      else if (relC >= relF) { chosen = pick(topupFoods(TOPUP_CARB_IDS, opts?.excludedIds)); chosenRole = 'carbs'; }
      else { chosen = pick(topupFoods(TOPUP_FAT_IDS, opts?.excludedIds)); chosenRole = 'fat'; }
      if (!chosen) break;
      const per100 = chosenRole === 'protein' ? (chosen.protein || 0) : chosenRole === 'carbs' ? (chosen.carbs || 0) : (chosen.fat || 0);
      if (per100 <= 0) break;
      // граммовка под дефицит макроса, кап по свободным ккал дня (не допускаем перелёт)
      let grams = Math.min(
        Math.round(dominant === relP ? dP / per100 * 100 : dominant === relC ? dC / per100 * 100 : dF / per100 * 100),
        Math.round(headroomKcal / Math.max(1, chosen.kcal || 1) * 100),
      );
      grams = Math.max(10, Math.round(grams / 10) * 10);
      if (grams < 10) break;
      const item = scaleItem({
        name: chosen.name, id: chosen.id, amount: 100,
        kcal: Math.round(chosen.kcal || 0), p: chosen.protein || 0, f: chosen.fat || 0, c: chosen.carbs || 0,
        fiber: chosen.fiber || 0,
      }, grams);
      work[fi] = { ...work[fi], items: [...work[fi].items, item], totals: sumMealTotals([...work[fi].items, item]) };
      notes.push(`➕ Недобор закрыт: ${chosen.name} ${grams} г → «${work[fi].label || 'Приём'}»`);
      continue;
    }

    // ── Перебор калорий при недоборе белка → замена худшего продукта перекуса
    // на белковый источник (иначе резка только усугубила бы дефицит белка) ──
    if (dP > 0 && dKcal < 0) {
      const fi = flexMealIndex(work);
      const items = fi >= 0 ? work[fi].items : [];
      let wi = -1; let worst = Infinity;
      items.forEach((it, ii) => {
        if ((it.amount || 0) < 20) return;
        const ppk = (it.p || 0) / Math.max(1, it.kcal || 1);
        if (ppk < worst) { worst = ppk; wi = ii; }
      });
      const pfPool = topupFoods(TOPUP_PROTEIN_IDS, opts?.excludedIds).sort((a, b) => (b.protein || 0) / Math.max(1, b.kcal || 1) - (a.protein || 0) / Math.max(1, a.kcal || 1));
      const pf = pfPool[0];
      if (wi >= 0 && pf && worst < 0.06) { // продукт почти без белка на ккал — меняем
        const freed = items[wi].kcal || 0;
        let g = Math.round(Math.min(dP / Math.max(1, pf.protein || 1) * 100, freed / Math.max(1, pf.kcal || 1) * 100) / 10) * 10;
        if (g >= 20) {
          g = Math.min(g, 400);
          const swapped = scaleItem({ name: pf.name, id: pf.id, amount: 100, kcal: Math.round(pf.kcal || 0), p: pf.protein || 0, f: pf.fat || 0, c: pf.carbs || 0, fiber: pf.fiber || 0 }, g);
          const nextItems = items.map((x, k) => (k === wi ? swapped : x));
          work[fi] = { ...work[fi], items: nextItems, totals: sumMealTotals(nextItems) };
          notes.push(`🔁 ${items[wi].name} → ${pf.name} ${g} г (белок вверх при переборе калорий)`);
          continue;
        }
      }
    }

    // ── Перебор: урезаем порции не-рецептурных приёмов. Резать можно только в пределах
    // «комнаты» до цели по каждому макросу — иначе режем один макрос ниже цели,
    // пытаясь закрыть перебор калорий. Выбираем продукт с максимальной реальной
    // экономией ккал среди допустимых ступеней лестницы. ──
    type Cut = { mi: number; ii: number; newAmount: number; label: string };
    let bestCut: Cut | null = null;
    let bestScore = Infinity;
    work.forEach((m, mi) => {
      if (m.recipeApplied) return; // авторские порции рецепта не трогаем
      const isSnackish = /Перекус|Полдник|Второй завтрак|Перед сном/i.test(m.label || '');
      (m.items || []).forEach((it, ii) => {
        const a = it.amount || 0;
        if (a < 20) return;
        // МИНИМАЛЬНО допустимая доля остатка по каждому макросу (иначе уйдём ниже цели):
        // newAm ≥ a × (1 − room_m / im_m)
        let loFrac = 0;
        const chk = (im: number, tot: number, tg: number) => { if (im > 0.5) loFrac = Math.max(loFrac, 1 - Math.max(0, (tot || 0) - (tg || 0)) / im); };
        chk(it.kcal || 0, totals.kcal, validTargets.kcal);
        chk(it.p || 0, totals.p, validTargets.p);
        chk(it.f || 0, totals.f, validTargets.f);
        chk(it.c || 0, totals.c, validTargets.c);
        const lo = a * loFrac;
        const hi = a * 0.85; // реальная резка — минимум 15%
        if (lo > hi + 0.001) return; // окно пусто — этот продукт резать нельзя
        let newAmount = 0;
        for (let i = SHRINK_LADDER.length - 1; i >= 0; i--) {
          const v = SHRINK_LADDER[i];
          if (v <= hi + 0.001 && v >= lo - 0.001) { newAmount = v; break; }
        }
        if (newAmount === 0) {
          // ступени в окне нет — допустимо ли полное удаление (весь продукт влезает в комнаты)?
          const fullOk = (it.kcal || 0) <= Math.max(0, totals.kcal - validTargets.kcal) + 0.5
            && (it.p || 0) <= Math.max(0, totals.p - validTargets.p) + 0.5
            && (it.f || 0) <= Math.max(0, totals.f - validTargets.f) + 0.5
            && (it.c || 0) <= Math.max(0, totals.c - validTargets.c) + 0.5;
          if (!fullOk) return;
          newAmount = 0;
        }
        if (newAmount >= a) return;
        const saved = (it.kcal || 0) * (a - newAmount) / a;
        const score = (isSnackish ? 0 : 1e6) + (1000 - Math.min(999, saved));
        if (score < bestScore) { bestScore = score; bestCut = { mi, ii, newAmount, label: m.label || '' }; }
      });
    });
    if (!bestCut) break; // резать больше некуда без нарушения целей — выходим
    {
      const bc = bestCut as any as Cut;
      const it = work[bc.mi].items[bc.ii];
      if (bc.newAmount < 20) {
        const items = work[bc.mi].items.filter((_, k) => k !== bc.ii);
        work[bc.mi] = { ...work[bc.mi], items, totals: sumMealTotals(items) };
        notes.push(`➖ Убран ${it.name} из «${bc.label}» (перебор калорий)`);
      } else {
        const scaled = scaleItem(it, bc.newAmount);
        const items = work[bc.mi].items.map((x, k) => (k === bc.ii ? scaled : x));
        work[bc.mi] = { ...work[bc.mi], items, totals: sumMealTotals(items) };
        notes.push(`➖ ${it.name}: ${it.amount} → ${bc.newAmount} г (перебор калорий)`);
      }
      continue;
    }
  }

  const finalTotals = sumDayTotals(work);
  const devFinal = maxDeviationPct(finalTotals, validTargets);
  return { meals: work, notes, deviationPct: Math.round(devFinal * 10) / 10, withinTolerance: devFinal <= 3 };
}

// ─── Закупки из фактических планов (в т.ч. из рецептов) ────────────────

const SHOPPING_BATCH_COOKABLE = new Set(['chicken_breast', 'chicken_thigh', 'turkey_breast', 'beef_lean', 'beef_minced', 'rice_white', 'rice_brown', 'buckwheat', 'quinoa', 'oats', 'lentils', 'chickpeas', 'beans', 'pasta_durum', 'bulgur', 'barley', 'millet', 'sweet_potato', 'potato_boiled', 'tofu', 'tempeh', 'whey_protein', 'whey_isolate', 'casein']);

/**
 * Агрегация списка покупок из массива дневных планов (формат IndividualPlanContext).
 * Используется при генерации И после каждой замены приёма рецептом — закупки всегда
 * отражают то, что реально написано в плане/рецептах.
 */
export function buildShoppingFromPlans(allDayPlans: any[]): any[] {
  const map = new Map<string, any>();
  (allDayPlans || []).forEach((dp: any, dayIdx: number) => {
    (dp?.meals || []).forEach((m: any) => {
      (m.items || []).forEach((it: any) => {
        const ex = map.get(it.id);
        if (ex) { ex.amount += it.amount || 0; ex.kcal += it.kcal || 0; ex.p += it.p || 0; ex.f += it.f || 0; ex.c += it.c || 0; ex.daySet.add(dayIdx); }
        else {
          const food = FOOD_DB.find(f => f.id === it.id);
          map.set(it.id, { name: it.name, id: it.id, amount: it.amount || 100, kcal: it.kcal || 0, p: it.p || 0, f: it.f || 0, c: it.c || 0, category: food?.category || 'other', daySet: new Set([dayIdx]) });
        }
      });
    });
  });
  return Array.from(map.values()).map((e: any) => {
    const dayCount = e.daySet ? e.daySet.size : 1;
    const batchCookable = SHOPPING_BATCH_COOKABLE.has(e.id);
    const batchCook = batchCookable && dayCount >= 2 ? `Готовить сразу ${dayCount}-дневную партию (${Math.round(e.amount)}г)` : undefined;
    return { name: e.name, id: e.id, amount: e.amount, kcal: e.kcal, p: e.p, f: e.f, c: e.c, category: e.category, dayCount, batchCook };
  }).sort((a: any, b: any) => b.amount - a.amount);
}

// ─── План готовки из выбранных рецептов ────────────────────────────────

export interface CookingStepLike { step: number; action: string; duration: number; items: string[] }
export interface CookingPlanLike { steps: CookingStepLike[]; totalTime: number; containers: number }

/**
 * Карточка «Процесс готовки» для режима «по рецептам»: шаги = инструкции выбранных
 * рецептов (по одному шагу на рецепт), плюс подготовка ингредиентов и упаковка.
 * Формат совместим с рендером mealPrepPlan в IndividualPlanResults.
 */
export function buildRecipeCookingPlan(
  applied: { label: string; recipe: FlatRecipeOption }[],
  days: number = 1,
): CookingPlanLike | null {
  const list = (applied || []).filter(a => a.recipe);
  if (list.length === 0) return null;
  const steps: CookingStepLike[] = [];
  let n = 1;
  // Шаг 1: подготовка ингредиентов (уникальный список по всем рецептам)
  const ingSet = new Set<string>();
  list.forEach(a => (a.recipe.ingredients || []).forEach(i => ingSet.add(i)));
  if (ingSet.size > 0) {
    steps.push({ step: n++, action: 'Подготовка ингредиентов', duration: 10, items: Array.from(ingSet).slice(0, 12) });
  }
  // По шагу на каждый рецепт
  list.forEach(a => {
    const dur = Math.max(5, a.recipe.prepTimeMin || 15);
    steps.push({ step: n++, action: `${a.label}: ${a.recipe.name}`, duration: dur, items: (a.recipe.instructions || []).slice(0, 8) });
  });
  // Упаковка при готовке впрок
  const totalPrep = steps.reduce((s, st) => s + st.duration, 0);
  if (days > 1) {
    steps.push({ step: n++, action: 'Упаковка по контейнерам', duration: 10, items: [`${days} дн × ${list.length} приёмов`, 'Остудить до комнатной температуры перед закрытием'] });
  }
  const totalTime = steps.reduce((s, st) => s + st.duration, 0);
  const containers = Math.max(1, Math.ceil((days * list.length) / 2));
  void totalPrep;
  return { steps, totalTime, containers };
}

/** Собирает применённые рецепты из плана дня (для карточки готовки). */
export function collectAppliedRecipes(plan: any): { label: string; recipe: FlatRecipeOption }[] {
  const out: { label: string; recipe: FlatRecipeOption }[] = [];
  (plan?.meals || []).forEach((m: PlanMealLike) => {
    if (m.recipeApplied && m.recipeAppliedData) out.push({ label: m.label || 'Приём', recipe: m.recipeAppliedData });
  });
  return out;
}
