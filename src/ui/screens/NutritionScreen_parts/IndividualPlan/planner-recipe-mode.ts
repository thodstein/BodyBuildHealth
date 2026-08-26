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
import type { RecipeMatchOptions, CookProfile } from './recipe-engine';

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
  const maxIter = opts?.maxIter ?? 16;
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

    const dKcalEquiv = Math.max(
      dKcal > 0 ? dKcal : 0,
      dP > 0 ? dP * 4 : 0,
      dF > 0 ? dF * 9 : 0,
      dC > 0 ? dC * 4 : 0,
    );
    // Недобор «осмысленный», только если он ≥ ~120 ккал в эквиваленте любого макроса —
    // иначе микро-хвосты (например +7 г углеводов при переборе жиров на 80 г) не должны
    // блокировать резку перебора.
    if (dKcalEquiv >= 120) {
      // ── Недобор: добавляем топ-ап в гибкий слот ──
      const fi = flexMealIndex(work);
      if (fi < 0 || !work[fi]) break;
      const relP = dP / Math.max(1, validTargets.p);
      const relF = dF / Math.max(1, validTargets.f);
      const relC = dC / Math.max(1, validTargets.c);
      const dominant = Math.max(relP, relC, relF);
      if (dominant <= 0) break; // все дефициты закрыты — дальше резаем перебор
      // Выбор роли доминирующего дефицита
      let rolePool: FoodItem[]; let chosenRole: 'p' | 'c' | 'f';
      if (relP >= relC && relP >= relF) { rolePool = topupFoods(TOPUP_PROTEIN_IDS, opts?.excludedIds); chosenRole = 'p'; }
      else if (relC >= relF) { rolePool = topupFoods(TOPUP_CARB_IDS, opts?.excludedIds); chosenRole = 'c'; }
      else { rolePool = topupFoods(TOPUP_FAT_IDS, opts?.excludedIds); chosenRole = 'f'; }
      if (rolePool.length === 0) break;
      const macroOf = (f: FoodItem) => chosenRole === 'p' ? (f.protein || 0) : chosenRole === 'c' ? (f.carbs || 0) : (f.fat || 0);
      const dMacro = chosenRole === 'p' ? dP : chosenRole === 'c' ? dC : dF;
      // Кандидат: максимум «макрос на ккал» (влезает больше дефицита при ограниченной
      // ккал-комнате), tie-break по качеству. Без ккал-комнаты — просто максимум макро.
      const kcalRoomOk = dKcal > Math.max(80, dMacro * 2);
      const usable = rolePool.filter(f => macroOf(f) > 0);
      if (usable.length === 0) break;
      const chosen = [...usable].sort((a, b) => {
        if (kcalRoomOk) {
          const ra = macroOf(a) / Math.max(1, a.kcal || 1);
          const rb = macroOf(b) / Math.max(1, b.kcal || 1);
          if (Math.abs(ra - rb) > 0.01) return rb - ra;
        }
        return (b.bb_quality_score || 0) - (a.bb_quality_score || 0);
      })[0];
      const per100 = macroOf(chosen);
      // Граммовка ровно под дефицит макроса; ккал-кап применяется только если он реально жмёт
      const gramsForMacroG = dMacro / per100 * 100;
      const gramsForKcalG = dKcal > 0 ? dKcal / Math.max(1, chosen.kcal || 1) * 100 : gramsForMacroG;
      let grams = Math.min(gramsForMacroG, gramsForKcalG);
      grams = Math.floor(Math.min(grams, 500) / 10) * 10;
      if (grams < 30) {
        // этот дефицит не пролезает без перебора ккал — переходим к резке перебора
      } else {
        const item = scaleItem({
          name: chosen.name, id: chosen.id, amount: 100,
          kcal: Math.round(chosen.kcal || 0), p: chosen.protein || 0, f: chosen.fat || 0, c: chosen.carbs || 0,
          fiber: chosen.fiber || 0,
        }, grams);
        work[fi] = { ...work[fi], items: [...work[fi].items, item], totals: sumMealTotals([...work[fi].items, item]) };
        notes.push(`➕ Недобор закрыт: ${chosen.name} ${grams} г → «${work[fi].label || 'Приём'}»`);
        continue;
      }
    }

    // ── Перебор калорий при недоборе белка → замена худшего продукта перекуса
    // на белковый источник (иначе резка только усугубила бы дефицит белка).
    // A2-гейт: замена принимается только при снижении max-dev дня (монотонность). ──
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
          const ntTotals = sumMealTotals(nextItems);
          const ntDay = { ...totals, kcal: totals.kcal - items[wi].kcal + ntTotals.kcal, p: totals.p - items[wi].p + ntTotals.p, f: totals.f - items[wi].f + ntTotals.f, c: totals.c - items[wi].c + ntTotals.c };
          if (maxDeviationPct(ntDay as any, validTargets) < dev - 0.0005) {
            work[fi] = { ...work[fi], items: nextItems, totals: ntTotals };
            notes.push(`🔁 ${items[wi].name} → ${pf.name} ${g} г (белок вверх при переборе калорий)`);
            continue;
          }
        }
      }
    }

    // ── Перебор ккал/макроса при недоборе другого макроса → замена худшего по
    // «пригодности» продукта перекуса на источник дефицитного макроса того же
    // ккал-достоинства (резка тут только углубила бы дефицит) ──
    {
      const underEquiv = Math.max(dP > 0 ? dP * 4 : 0, dF > 0 ? dF * 9 : 0, dC > 0 ? dC * 4 : 0);
      const overKcal = -dKcal;
      if (underEquiv >= 120 && overKcal >= 120) {
        const role: 'p' | 'c' | 'f' = (dP > 0 && dP * 4 >= Math.max(dF > 0 ? dF * 9 : 0, dC > 0 ? dC * 4 : 0)) ? 'p'
          : (dC > 0 && dC * 4 >= (dF > 0 ? dF * 9 : 0)) ? 'c' : 'f';
        const dMacro = role === 'p' ? dP : role === 'c' ? dC : dF;
        const ids = role === 'p' ? TOPUP_PROTEIN_IDS : role === 'c' ? TOPUP_CARB_IDS : TOPUP_FAT_IDS;
        const poolFit = topupFoods(ids, opts?.excludedIds);
        const macroOf = (f: FoodItem) => role === 'p' ? (f.protein || 0) : role === 'c' ? (f.carbs || 0) : (f.fat || 0);
        const fitPool = poolFit.filter(f => macroOf(f) > 0 && (f.kcal || 0) > 0);
        const bestFood = fitPool.sort((a, b) =>
          macroOf(b) / (b.kcal || 1) - macroOf(a) / (a.kcal || 1) || (b.bb_quality_score || 0) - (a.bb_quality_score || 0))[0];
        // худший продукт: минимум целевого макро на ккал среди гибких не-рецептурных приёмов
        const fi = flexMealIndex(work);
        let wi = -1; let worstFit = Infinity;
        if (fi >= 0 && bestFood) {
          work[fi].items.forEach((it, ii) => {
            if ((it.amount || 0) < 30) return;
            const itMacro = role === 'p' ? (it.p || 0) : role === 'c' ? (it.c || 0) : (it.f || 0);
            const fit = itMacro / Math.max(1, it.kcal || 1);
            if (fit < worstFit) { worstFit = fit; wi = ii; }
          });
          const bestFitRatio = macroOf(bestFood) / Math.max(1, bestFood.kcal || 1);
          if (wi >= 0 && worstFit < bestFitRatio * 0.6) { // заметно хуже лучшего источника — меняем
            const victim = work[fi].items[wi];
            const freed = victim.kcal || 0;
            let g = Math.min(dMacro / macroOf(bestFood) * 100, freed / Math.max(1, bestFood.kcal || 1) * 100);
            g = Math.floor(Math.min(g, 400) / 10) * 10;
            if (g >= 30) {
              const swapped = scaleItem({
                name: bestFood.name, id: bestFood.id, amount: 100,
                kcal: Math.round(bestFood.kcal || 0), p: bestFood.protein || 0, f: bestFood.fat || 0, c: bestFood.carbs || 0,
                fiber: bestFood.fiber || 0,
              }, g);
              const nextItems = work[fi].items.map((x, k) => (k === wi ? swapped : x));
              const ntTotals = sumMealTotals(nextItems);
              const ntDay = { ...totals, kcal: totals.kcal - victim.kcal + ntTotals.kcal, p: totals.p - victim.p + ntTotals.p, f: totals.f - victim.f + ntTotals.f, c: totals.c - victim.c + ntTotals.c };
              // A2-гейт: замена обязана снижать max-dev дня (иначе жёём итерации во вред)
              if (maxDeviationPct(ntDay as any, validTargets) < dev - 0.0005) {
                work[fi] = { ...work[fi], items: nextItems, totals: ntTotals };
                notes.push(`🔁 ${victim.name} → ${bestFood.name} ${g} г (${role === 'p' ? 'белок' : role === 'c' ? 'углеводы' : 'жиры'} вверх при переборе калорий)`);
                continue;
              }
            }
          }
        }
      }
    }

    // ── Перебор: жадный спуск по лестнице порций не-рецептурных приёмов.
    // Кандидат принимается ТОЛЬКО если снижает максимальное отклонение дня от целей
    // (монотонность → нет осцилляций и «блокирующих комнат»); приоритет перекусам
    // и большему шагу вниз. ──
    type Cut = { mi: number; ii: number; newAmount: number; label: string; score: number };
    let bestCut: Cut | null = null;
    let bestDev = maxDeviationPct(totals, validTargets);
    work.forEach((m, mi) => {
      if (m.recipeApplied) return; // авторские порции рецепта не трогаем
      const isSnackish = /Перекус|Полдник|Второй завтрак|Перед сном/i.test(m.label || '');
      (m.items || []).forEach((it, ii) => {
        const a = it.amount || 0;
        if (a < 20) return;
        const steps = [...SHRINK_LADDER.filter(v => v < a && v >= 20), 0];
        for (const v of steps) {
          const ratio = v / a;
          const nt = {
            kcal: totals.kcal - (it.kcal || 0) * (1 - ratio),
            p: totals.p - (it.p || 0) * (1 - ratio),
            f: totals.f - (it.f || 0) * (1 - ratio),
            c: totals.c - (it.c || 0) * (1 - ratio),
          };
          const dv = maxDeviationPct(nt as any, validTargets);
          if (dv >= bestDev - 0.0005) continue; // строгое улучшение — иначе осцилляции
          const score = (isSnackish ? 0 : 1e6) + (1000 - Math.min(999, a - v));
          if (!bestCut || score < bestCut.score || (score === bestCut.score && v < bestCut.newAmount)) {
            bestDev = dv;
            bestCut = { mi, ii, newAmount: v, label: m.label || '', score };
          }
        }
      });
    });
    if (!bestCut) break; // улучшений больше нет — локальный оптимум достигнут
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
  let devFinal = maxDeviationPct(finalTotals, validTargets);

  // Финальная точная посадка: если после всех ходов всё ещё >3%, равномерно масштабируем
  // items применённых рецептов в КУМУЛЯТИВНОМ коридоре ±8% (пропорции/вкус не меняются —
  // это компенсация дрейфа декомпозиции, а не правка авторских пропорций).
  if (devFinal > 3) {
    const cumScale = new Map<number, number>();
    for (let iter = 0; iter < 8 && devFinal > 3; iter++) {
      let improved = false;
      for (let mi = 0; mi < work.length; mi++) {
        const m = work[mi];
        if (!m.recipeApplied || !m.items?.length) continue;
        const used = cumScale.get(mi) ?? 1;
        let bestS = 1; let bestDev = devFinal;
        for (let sPct = -10; sPct <= 10; sPct += 1) {
          const s = 1 + sPct / 100;
          if (s === 1) continue;
          const nextCum = used * s;
          if (nextCum < 0.9 || nextCum > 1.1) continue; // общий коридор посадки
          const ntMealTotals = {
            kcal: m.totals.kcal * s, p: m.totals.p * s, f: m.totals.f * s, c: m.totals.c * s,
          };
          const ntDay = {
            kcal: finalTotals.kcal - m.totals.kcal + ntMealTotals.kcal,
            p: finalTotals.p - m.totals.p + ntMealTotals.p,
            f: finalTotals.f - m.totals.f + ntMealTotals.f,
            c: finalTotals.c - m.totals.c + ntMealTotals.c,
          };
          const dv = maxDeviationPct(ntDay as any, validTargets);
          if (dv < bestDev - 0.0005) { bestDev = dv; bestS = s; }
        }
        if (bestS !== 1) {
          const scaledItems = m.items.map(it => scaleItem(it, Math.max(5, Math.round((it.amount || 0) * bestS))));
          work[mi] = { ...m, items: scaledItems, totals: sumMealTotals(scaledItems) };
          cumScale.set(mi, (cumScale.get(mi) ?? 1) * bestS);
          notes.push(`⚖️ Порция «${m.recipeApplied}» ×${Math.round(bestS * 100)}% для сходимости КБЖУ дня`);
          improved = true;
          break; // пересчитать тоталы и попробовать ещё
        }
      }
      if (!improved) break;
      const t2 = sumDayTotals(work);
      devFinal = maxDeviationPct(t2, validTargets);
    }
    void finalTotals;
  }

  const totalsOut = sumDayTotals(work);
  const devOut = maxDeviationPct(totalsOut, validTargets);
  return { meals: work, notes, deviationPct: Math.round(devOut * 10) / 10, withinTolerance: devOut <= 3 };
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

// ─── Пресеты рецептов (чипы над вариантами/подсказками) ────────────────

export interface RecipePresetTarget {
  tags?: string[]; carbs?: number; protein?: number; fat?: number; prepTimeMin?: number;
}

export interface RecipePreset {
  id: string;
  label: string;
  hint: string;
  match: (r: RecipePresetTarget) => boolean;
}

const hasTag = (r: RecipePresetTarget, t: string): boolean =>
  (r.tags || []).some(x => (x || '').toLowerCase().includes(t));

/**
 * Фиксированные пресеты подбора рецептов. «Масса» — акцент на углеводы
 * (большое У): тег массы/загрузки ИЛИ carbs ≥ 45 г на порцию.
 */
export const RECIPE_PRESETS: RecipePreset[] = [
  {
    id: 'mass', label: '🏋️ Масса', hint: 'Набор: рецепты с большим У (углеводная загрузка)',
    match: r => hasTag(r, 'масса') || hasTag(r, 'загрузка') || (r.carbs ?? 0) >= 45,
  },
  {
    id: 'cut', label: '🔥 Сушка', hint: 'Дефицит: мало жиров, много белка',
    match: r => hasTag(r, 'сушк') || hasTag(r, 'рельеф') || ((r.fat ?? 99) <= 12 && (r.protein ?? 0) >= 35),
  },
  {
    id: 'protein', label: '🥩 Белок 40+', hint: 'Максимум белка на порцию',
    match: r => (r.protein ?? 0) >= 38 || hasTag(r, 'высокий белок'),
  },
  {
    id: 'fast', label: '⚡ Быстро', hint: 'До 15 минут',
    match: r => (r.prepTimeMin ?? 99) <= 15 || hasTag(r, 'быстро') || hasTag(r, 'без готовки'),
  },
  {
    id: 'lowcarb', label: '🌾 Low-carb', hint: 'Мало углеводов / кето',
    match: r => hasTag(r, 'low-carb') || hasTag(r, 'кето') || ((r.carbs ?? 99) <= 20),
  },
  {
    id: 'pp', label: '🥦 ПП', hint: 'Сбалансированное правильное питание',
    match: r => hasTag(r, 'пп') || hasTag(r, 'здоровое') || hasTag(r, 'сбалансир'),
  },
];

/** Матчинг рецепта по пресету (для фильтра чипов в UI). */
export function recipeMatchesPreset(r: RecipePresetTarget | null | undefined, presetId: string | null): boolean {
  if (!presetId) return true;
  if (!r) return false;
  const p = RECIPE_PRESETS.find(x => x.id === presetId);
  return p ? p.match(r) : true;
}

// ─── Сборка рецептурного дня (чистая функция, экстракция из generatePlan) ──

export interface AssembleRecipeDayArgs {
  meals: PlanMealLike[];
  /** Отфильтрованный пул рецептов (по навыку/бюджету — как его готовит контекст) */
  pool: Recipe[];
  targets: DayMacroTargets;
  excludedIds: Set<string>;
  cookProfile?: CookProfile;
  maxPrepTimeMin?: number;
  isVegetarian?: boolean;
  /** ⭐ Избранные рецепты — бонус к скорингу подбора */
  preferredRecipeNames?: Set<string>;
  goal?: RecipeMatchOptions['goal'];
  /** Имена, уже использованные в других днях генерации (разнообразие) */
  usedNamesAcrossDays?: Set<string>;
}

export interface AssembleRecipeDayResult {
  meals: PlanMealLike[];
  notes: string[];
  withinTolerance: boolean;
  deviationPct: number;
  appliedCount: number;
}

/**
 * Собирает основные приёмы дня из рецептов: топ-3 варианта на приём, автовыбор
 * лучшего с авторскими порциями, ребаланс дня до ±3%. Перекусы не трогаются.
 *
 * Важно: финальное ранжирование кандидатов идёт по ФАКТИЧЕСКОЙ декомпозиции
 * (ingredientIds/portions → FOOD_DB), а не по авторским макросам карточки —
 * у легаси-рецептов разбор может отличаться от заявленного КБЖУ.
 */

// Кэш декомпозиции: разбор детерминирован по объекту рецепта
const decompCache = new WeakMap<object, { items: ReturnType<typeof buildRecipeMealItems>; totals: ReturnType<typeof sumMealTotals> | null }>();

function decomposedFacts(r: Recipe): { totals: ReturnType<typeof sumMealTotals> | null } {
  const hit = decompCache.get(r as any);
  if (hit) return { totals: hit.totals };
  const items = buildRecipeMealItems(r);
  const totals = items && items.length > 0 ? sumMealTotals(items) : null;
  decompCache.set(r as any, { items, totals });
  return { totals };
}

function distOf(totals: { kcal: number; p: number; f: number; c: number } | null, tgtKcal: number, tp: number, tf: number, tc: number): number {
  if (!totals) return 999;
  const parts: Array<[number, number]> = [
    [totals.kcal, tgtKcal], [totals.p, tp], [totals.f, tf], [totals.c, tc],
  ];
  let sum = 0; let n = 0;
  for (const [val, tgt] of parts) {
    if (tgt > 0) { sum += Math.abs(val - tgt) / tgt; n++; }
  }
  return n > 0 ? sum / n : 999;
}

export function assembleRecipeDay(args: AssembleRecipeDayArgs): AssembleRecipeDayResult {
  const { meals, pool, targets, excludedIds, cookProfile, usedNamesAcrossDays } = args;
  const dayUsedNames = new Set<string>();
  let appliedCount = 0;

  meals.forEach(m => {
    if (!isMainMealLabel((m as any).label)) return;
    const mealAny = m as any;
    const tgt = mealAny.target || { p: mealAny.totals?.p ?? 30, c: mealAny.totals?.c ?? 40, f: mealAny.totals?.f ?? 15 };
    // Ккал-цель приёма: фактические тоталы, а для пустого приёма — формула из макро-цели
    // (раньше пустой приём скорился против дефолтных 300 ккал и ломал выбор рецепта).
    const targetKcal = mealAny.totals?.kcal
      || Math.round((tgt.p || 0) * 4 + (tgt.c || 0) * 4 + (tgt.f || 0) * 9)
      || 300;
    const excludeNames = new Set<string>([...(mealAny.recipeOptionNames || []), ...dayUsedNames, ...(usedNamesAcrossDays || [])]);
    const matchOpts: RecipeMatchOptions = {
      mealType: mealTypeFromLabel(mealAny.label),
      targetKcal,
      targetProteinG: tgt.p || 30,
      targetCarbsG: tgt.c || 40,
      targetFatG: tgt.f || 15,
      excludedIds,
      cookProfile,
      isVegetarian: args.isVegetarian,
      maxPrepTimeMin: args.maxPrepTimeMin ?? 60,
      preferredRecipeNames: args.preferredRecipeNames,
      goal: args.goal,
    };
    // Шире сеть кандидатов — финальный отбор по фактической декомпозиции ниже
    const cands = pickRecipeOptions(pool, matchOpts, 6, excludeNames);
    if (cands.length === 0) return;
    // Переранжирование по декомпозированным фактам (что реально окажется в приёме)
    const ranked = cands
      .map(r => ({ r, d: distOf(decomposedFacts(r).totals, targetKcal, tgt.p || 30, tgt.f || 15, tgt.c || 40) }))
      .sort((a, b) => a.d - b.d)
      .map(x => x.r);
    const flats: FlatRecipeOption[] = ranked.slice(0, 3).map(flattenRecipeOption);
    mealAny.recipeOptions = flats;
    mealAny.recipeOptionNames = flats.map(f => f.name);
    // Автовыбор лучшего кандидата — авторские порции рецепта (не равный сплит)
    const chosenFlat = flats[0];
    const items = buildRecipeMealItems(rebuildRecipeFromFlat(chosenFlat));
    if (!items || items.length === 0) return;
    mealAny.items = items;
    mealAny.totals = sumMealTotals(items);
    mealAny.recipeApplied = chosenFlat.name;
    mealAny.recipeAppliedData = chosenFlat;
    dayUsedNames.add(chosenFlat.name);
    usedNamesAcrossDays?.add(chosenFlat.name);
    appliedCount++;
  });

  // Ребаланс дня: недобор закрываем топ-апом в перекус, перебор режем по гибким слотам
  // (выбранные рецепты не трогаются). Цель — дневные КБЖУ в ±3%.
  const rb = rebalanceDayAfterRecipes(meals, targets, { excludedIds });
  const notes = [...rb.notes];
  if (!rb.withinTolerance) {
    notes.push(`⚠ Режим «по рецептам»: дневное отклонение от целей ${rb.deviationPct}% (>3%) — попробуйте выбрать другие варианты рецептов.`);
  }
  return { meals: rb.meals, notes, withinTolerance: rb.withinTolerance, deviationPct: rb.deviationPct, appliedCount };
}
