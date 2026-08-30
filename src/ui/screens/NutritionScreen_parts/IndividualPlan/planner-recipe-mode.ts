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
import { createDailyQuota, registerMealInQuota, blockedIdsForNextMeal, foodAvailableWithQuota, isProteinPowderId, stapleFamilyOf } from './food-availability';
import { applyRealisticFloors } from './meal-plan-engine';
import { correctDayToTargets } from './day-target-corrector';
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
  /** Масштаб порции рецепта к цели приёма (Aug 28, ×0.7-2.2) */
  appliedScale?: number;
  /** Р-2.2: «закрывает приём на ~N%» после масштаба с капами (90-110% = зелёный) */
  fitPct?: number;
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
  /** Второй рецепт в этом же приёме (два блюда на один приём) */
  recipeApplied2?: string;
  /** Данные второго рецепта */
  recipeAppliedData2?: FlatRecipeOption;
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
 * Совместимость двух рецептов в ОДНОМ приёме. Два блюда не должны быть:
 *  (а) одним и тем же рецептом (дубль);
 *  (б) из одного «профиля» основного белка (две курицы / два коровьих);
 *  (в) однотипной углеводной основой (две каши / две пасты).
 * Возвращает {compatible, reason} — reason = подсказка пользователю при отказе.
 */
export function recipeCompatibility(a: Recipe & { ingredientIds?: string[] }, b: Recipe & { ingredientIds?: string[] }): { compatible: boolean; reason: string } {
  if (a.name === b.name) return { compatible: false, reason: 'Это уже выбранный рецепт этого приёма' };
  const idsA = a.ingredientIds || [];
  const idsB = b.ingredientIds || [];
  const aSet = new Set(idsA);
  // Пересечение ингредиентов-«основ»: если два рецепта делят ≥2 ключевых продукта, вероятен дубль-профиль.
  const shared = idsB.filter(id => aSet.has(id));
  const sharedKey = shared.filter(id => {
    const f = FOOD_DB.find(x => x.id === id);
    if (!f) return false;
    const cat = f.category;
    return cat === 'protein' || cat === 'grain' || cat === 'carb' || cat === 'veg_fruit' || cat === 'fast_food';
  });
  if (sharedKey.length >= 3) return { compatible: false, reason: `Слишком похожи по составу (${sharedKey.length} общих ключевых продукта)` };
  if (sharedKey.length >= 2) {
    // Два общих — только если это «фоновые» (масло/специи) не критично; но 2 ключевых = осторожно
    return { compatible: false, reason: 'Похожие рецепты (много общих ингредиентов) — второй не добавит разнообразия' };
  }
  return { compatible: true, reason: '' };
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

/**
 * Масштабирует декомпозицию рецепта под ЦЕЛЬ приёма по КБЖУ (порции автора растут/сжимаются
 * пропорционально). Атлет 100 кг и 80 кг получают РАЗНЫЕ граммовки одного рецепта:
 * цель приёма у тяжа крупнее → порция ×больше. Масштаб клампуется в 0.7–2.2 (3.0 для 120кг+),
 * капится по белку (1.2×) и жиру (1.5×) — перебор макроса хуже лёгкого недобора ккал.
 * Возвращает null при пустой декомпозиции, иначе {items, scale}.
 */
export function scaleRecipeToTarget(
  recipe: Recipe,
  target: { kcal: number; p?: number; f?: number; c?: number },
  athleteWeightKg: number = 80,
): { items: PlanItemLike[]; scale: number } | null {
  const built = buildRecipeMealItems(recipe);
  if (!built || built.length === 0) return null;
  const t = sumMealTotals(built);
  const kcal = Math.max(50, t.kcal || 1);
  const heavyScaleMax = athleteWeightKg >= 120 ? 3.0 : athleteWeightKg >= 110 ? 2.8 : athleteWeightKg >= 100 ? 2.5 : 2.2;
  const tp = target.p ?? 30, tf = target.f ?? 15, tc = target.c ?? 40;
  let s = Math.max(0.7, Math.min(heavyScaleMax, target.kcal / kcal));
  if (t.p > 0) s = Math.min(s, (1.2 * tp) / t.p);
  if (t.f > 0) s = Math.min(s, (1.5 * tf) / t.f);
  if (t.c > 0) s = Math.min(s, (1.2 * tc) / t.c);
  s = Math.max(0.7, Math.round(s * 20) / 20);
  const scaled = built.map(it => scaleItem(it, Math.max(5, Math.round((it.amount || 0) * s / 5) * 5)));
  return { items: scaled, scale: s };
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
  const p = Math.round((it.p || 0) * r * 10) / 10;
  const f = Math.round((it.f || 0) * r * 10) / 10;
  const c = Math.round((it.c || 0) * r * 10) / 10;
  // KBЖУ-консистентность ≤3%: kcal пересчитываем из формулы, а не линейно от старых kcal
  return {
    ...it,
    amount: newAmount,
    kcal: Math.round(4 * p + 9 * f + 4 * c),
    p,
    f,
    c,
    fiber: it.fiber != null ? Math.round(it.fiber * r * 10) / 10 : undefined,
    leucine_mg: it.leucine_mg != null ? Math.round(it.leucine_mg * r) : undefined,
  };
}

// B7 (Эпик B): экспорт для теста id-безопасности (planner-id-safety.test.ts).
export const TOPUP_PROTEIN_IDS = ['chicken_breast', 'cottage_cheese_5', 'whey_isolate', 'turkey_breast', 'beef_lean', 'casein'];
export const TOPUP_CARB_IDS = ['rice_white', 'oats', 'banana', 'buckwheat', 'potato_boiled', 'sweet_potato', 'rice_basmati'];
export const TOPUP_FAT_IDS = ['olive_oil', 'walnuts', 'almonds', 'peanut_butter', 'avocado'];

// C5 (Эпик C): субротация фиксированных пулов по seed дня — иначе каждый недобор
// закрывается ПЕРВОЙ позицией списка («рис/гречка/оливковое масло» в каждом дне).
function subrot(ids: string[], seed?: number): string[] {
  const s = Math.abs(Math.round(seed ?? 0)) % Math.max(1, ids.length);
  return [...ids.slice(s), ...ids.slice(0, s)];
}

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
  return -1; // все приёмы из рецептов — вызывающий код создаст «Добор»
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
  opts?: { excludedIds?: Set<string>; maxIter?: number; seed?: number },
): RebalanceResult {
  const notes: string[] = [];
  const maxIter = opts?.maxIter ?? 24;
  const _sub = (ids: string[]) => subrot(ids, opts?.seed);
  const work: PlanMealLike[] = meals.map(m => ({ ...m, items: [...(m.items || [])], totals: { ...(m.totals || { kcal: 0, p: 0, f: 0, c: 0 }) } }));

  const validTargets: DayMacroTargets = {
    kcal: Number.isFinite(targets?.kcal) && (targets.kcal || 0) > 0 ? targets.kcal : 0,
    p: Number.isFinite(targets?.p) && (targets.p || 0) > 0 ? targets.p : 0,
    f: Number.isFinite(targets?.f) && (targets.f || 0) > 0 ? targets.f : 0,
    c: Number.isFinite(targets?.c) && (targets.c || 0) > 0 ? targets.c : 0,
  };

  // Aug 28: анти-осцилляция — только что добавленный top-ап не режется на следующей
  // итерации (иначе add/cut одной позиции сжигают maxIter, отклонение не падает).
  let lastAddedMeal = -1;
  let lastAddedId: string | null = null;

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
      let fi = flexMealIndex(work);
      if (fi < 0 || !work[fi]) {
        // Все приёмы из рецептов — создаём «Добор», чтобы не портить основные приёмы
        // (раньше флекс падал на последний РЕЦЕПТУРНЫЙ приём и «ужимал» обед).
        work.push({ label: 'Добор', time: '', items: [], totals: { kcal: 0, p: 0, f: 0, c: 0 } } as PlanMealLike);
        fi = work.length - 1;
        notes.push('➕ Добавлен приём «Добор» — основные приёмы собраны из рецептов');
      }
      const relP = dP / Math.max(1, validTargets.p);
      const relF = dF / Math.max(1, validTargets.f);
      const relC = dC / Math.max(1, validTargets.c);
      const dominant = Math.max(relP, relC, relF);
      if (dominant <= 0) break; // все дефициты закрыты — дальше резаем перебор
      // Выбор роли доминирующего дефицита
      let rolePool: FoodItem[]; let chosenRole: 'p' | 'c' | 'f';
      if (relP >= relC && relP >= relF) { rolePool = topupFoods(_sub(TOPUP_PROTEIN_IDS), opts?.excludedIds); chosenRole = 'p'; }
      else if (relC >= relF) { rolePool = topupFoods(_sub(TOPUP_CARB_IDS), opts?.excludedIds); chosenRole = 'c'; }
      else { rolePool = topupFoods(_sub(TOPUP_FAT_IDS), opts?.excludedIds); chosenRole = 'f'; }
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
        lastAddedMeal = fi;
        lastAddedId = chosen.id;
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
      const pfPool = topupFoods(_sub(TOPUP_PROTEIN_IDS), opts?.excludedIds).sort((a, b) => (b.protein || 0) / Math.max(1, b.kcal || 1) - (a.protein || 0) / Math.max(1, a.kcal || 1));
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
        const ids = role === 'p' ? _sub(TOPUP_PROTEIN_IDS) : role === 'c' ? _sub(TOPUP_CARB_IDS) : _sub(TOPUP_FAT_IDS);
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
      // Aug 28: в рецептурных приёмах авторское ЯДРО не трогается, но САЙД-добивка
      // (продукт не из ingredientIds рецепта) — сжимаема, иначе перебор неустраним.
      // Без ingredientIds в данных — консервативно считаем ВСЁ ядром. Второй рецепт — тоже ядро.
      const _coreOfMeal = (d: FlatRecipeOption | undefined): Set<string> | null =>
        d && d.ingredientIds && d.ingredientIds.length > 0
          ? new Set<string>(d.ingredientIds)
          : null; // без ids → весь приём ядро
      const coreIds = (() => {
        if (!m.recipeApplied && !(m as any).recipeApplied2) return null;
        // собираем явные ingredientIds всех рецептов; если хотя бы у одного нет ids — весь приём ядро
        const s = new Set<string>();
        let allAll = false;
        const addOf = (d: FlatRecipeOption | undefined) => {
          const c = _coreOfMeal(d);
          if (c) c.forEach(x => s.add(x));
          else allAll = true;
        };
        if (m.recipeApplied) addOf(m.recipeAppliedData);
        if ((m as any).recipeApplied2) addOf((m as any).recipeAppliedData2);
        return allAll ? new Set<string>((m.items || []).map(i => i.id)) : s;
      })();
      (m.items || []).forEach((it, ii) => {
        if (coreIds && coreIds.has(it.id)) return;
        if (mi === lastAddedMeal && it.id === lastAddedId) return; // свежий top-ап не режем
        const a = it.amount || 0;
        if (a < 20) return;
        // Пери-приёмы функциональны (анаболическое окно) — не вырезаем до нуля,
        // минимум 30% порции (раньше предтрен выпадал целиком при жир-переборе).
        const isPeri = /предтрен|пост-трен|intra/i.test(m.label || '') || ['preworkout', 'postworkout', 'intra'].includes(String((m as any).type));
        const floor = isPeri ? 30 : 20;
        const steps = [...SHRINK_LADDER.filter(v => v < a && v >= floor), ...(isPeri ? [] : [0])];
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
          const isSnackish = /Перекус|Полдник|Второй завтрак|Перед сном/i.test(m.label || '');
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
  // items применённых рецептов в КУМУЛЯТИВНОМ коридоре ±10% (пропорции/вкус не меняются —
  // это компенсация небольшого дрейфа декомпозиции, а не правка авторских порций).
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
    const items = (a.recipe.instructions || []).slice(0, 8);
    // C8 (Эпик C): при готовке на N дней показываем РЕАЛЬНУЮ граммовку партии
    // (portions × days), а не абстрактную «упаковку» — раньше масштаб порций не считался.
    if (days > 1 && a.recipe.portions && Object.keys(a.recipe.portions).length > 0) {
      const batchLines = Object.entries(a.recipe.portions).slice(0, 10).map(([id, g]) => {
        const food = FOOD_DB.find(f => f.id === id);
        return `${food?.name || id}: ${Math.round((g || 0) * days)} г`;
      });
      items.push(`📦 Партия на ${days} дн (×${days}):`, ...batchLines);
    }
    steps.push({ step: n++, action: `${a.label}: ${a.recipe.name}`, duration: days > 1 ? dur * Math.min(2, days) : dur, items });
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

/** Собирает применённые рецепты из плана дня (для карточки готовки). Поддерживает 2 рецепта на приём. */
export function collectAppliedRecipes(plan: any): { label: string; recipe: FlatRecipeOption }[] {
  const out: { label: string; recipe: FlatRecipeOption }[] = [];
  (plan?.meals || []).forEach((m: any) => {
    if (m.recipeApplied && m.recipeAppliedData) out.push({ label: m.label || 'Приём', recipe: m.recipeAppliedData });
    if (m.recipeApplied2 && m.recipeAppliedData2) out.push({ label: m.label || 'Приём', recipe: m.recipeAppliedData2 });
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
  /** D5: вес атлета — prefer-матчинг порционных якорей рецептов */
  athleteWeightKg?: number;
  /** C2 (Эпик C): тренировочный день? — peri-рецепты (p32: preworkout/postworkout) только в трен-день */
  trainDay?: boolean;
  /** C5 (Эпик C): seed дня — субротация TOPUP-пулов (анти-однообразие доборов) */
  seed?: number;
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

function decomposedFacts(r: Recipe): { items: PlanItemLike[] | null; totals: ReturnType<typeof sumMealTotals> | null } {
  const hit = decompCache.get(r as any);
  if (hit) return { items: hit.items, totals: hit.totals };
  const items = buildRecipeMealItems(r);
  const totals = items && items.length > 0 ? sumMealTotals(items) : null;
  decompCache.set(r as any, { items, totals });
  return { items, totals };
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
  // C1 (Эпик C): дневные квоты реалистичной тарелки ДЕЙСТВУЮТ на рецептурный путь.
  // Раньше assembleRecipeDay ограничивал только порошок — семейство гарниров (рис ×3+),
  // орехи ≤60 г, масла ≤25 г, яйца ≤230 г игнорировались.
  const quota = createDailyQuota(args.athleteWeightKg);
  meals.forEach(m => {
    if (m.recipeApplied || !m.items?.length) return;
    try { registerMealInQuota(quota, m.items as any); } catch {}
  });
  // Финальный грамм-трим орехов/масел/яиц после корректора (он идёт мимо квот).
  const trimQuotaOverflow = (ms: PlanMealLike[]): string[] => {
    const out: string[] = [];
    const _sc = quota.weightScale || 1;
    const trimByFam = (fams: string[], cap: number, minG: number, label: string) => {
      let total = ms.flatMap(m => m.items).filter(it => fams.includes(stapleFamilyOf(it.id) || '')).reduce((s, it) => s + (it.amount || 0), 0);
      if (total <= cap) return;
      const cutShare = Math.min(0.6, (total - cap) / total);
      for (const m of ms) {
        for (let ii = 0; ii < (m.items || []).length; ii++) {
          const it = m.items[ii];
          if (!fams.includes(stapleFamilyOf(it.id) || '')) continue;
          const ng = Math.max(minG, Math.floor((it.amount || 0) * (1 - cutShare)));
          if (ng >= (it.amount || 0)) continue;
          const r = ng / (it.amount || 1);
          m.items[ii] = scaleItem(it, ng);
          total -= (it.amount || 0) * (1 - r);
        }
      }
      out.push(`⚖️ ${label}: приведено к квоте ${cap} г/день`);
    };
    trimByFam(['nuts', 'seeds'], Math.round(60 * _sc), 8, 'Орехи/семена');
    trimByFam(['oils'], Math.round(25 * _sc), 5, 'Масла');
    const eggs = ms.flatMap(m => m.items).filter(it => it.id === 'egg_whole').reduce((s, it) => s + (it.amount || 0), 0);
    const eggCap = Math.round(230 * _sc);
    if (eggs > eggCap) {
      const cutShare = Math.min(0.5, (eggs - eggCap) / eggs);
      for (const m of ms) {
        for (let ii = 0; ii < (m.items || []).length; ii++) {
          const it = m.items[ii];
          if (it.id !== 'egg_whole') continue;
          const ng = Math.max(50, Math.floor((it.amount || 0) * (1 - cutShare)));
          if (ng >= (it.amount || 0)) continue;
          m.items[ii] = scaleItem(it, ng);
        }
      }
      out.push(`⚖️ Яйца: приведено к квоте ${eggCap} г/день`);
    }
    return out;
  };
  // D4 (эпик «реалистичная тарелка»): дневной лимит порошка в рецептурном пути.
  const _powderMealsUsed = new Set<number>();
  const _recipeHasPowder = (r: Recipe): boolean => (r.ingredientIds || []).some(fid => isProteinPowderId(fid));
  const _powderCount = (): number => {
    let n = 0;
    for (const [mi, m] of meals.entries()) {
      const _mealsAny = m as any;
      if (_mealsAny.recipeAppliedData && _powderMealsUsed.has(mi)) n++;
      else if (_mealsAny.items?.some?.((it: any) => isProteinPowderId(it.id || ''))) n++;
    }
    return n;
  };

  // C2 (Эпик C): peri-слоты по рецептам. Раньше 38 peri-рецептов (p32/p35) были
  // НЕДОСТИЖИМЫ автогенерацией — слот-разметка ставила рецепты только в
  // Завтрак/Обед/Ужин/один снек, при том что V2-движок строит предтрен/пост-трен/
  // перед сном продуктами в 100% дней.
  const PERI_LABEL_TYPES: Record<string, 'preworkout' | 'postworkout' | 'presleep'> = {
    'Предтрен': 'preworkout', 'Пост-трен': 'postworkout', 'Перед сном': 'presleep',
  };
  // C2: пери-рецепты не должны красться ОБЫЧНЫМИ слотами (ужин = «PostW-шейкер» — нет).
  const PERI_TYPES_SET = new Set<string>(['preworkout', 'postworkout', 'presleep']);

  // Aug 28: снек-рецепты в режиме «по рецептам» — только на САМЫЙ БОЛЬШОЙ снек-слот дня
  // (остальные перекусы остаются продуктовыми и служат гибкими слотами ребаланса).
  const snackIdxs = meals
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => /Перекус|Полдник|Второй завтрак/i.test(m.label || ''))
    .sort((a, b) => (b.m.target ? (b.m.target.p || 0) * 4 + (b.m.target.c || 0) * 4 + (b.m.target.f || 0) * 9 : 0) - (a.m.target ? (a.m.target.p || 0) * 4 + (a.m.target.c || 0) * 4 + (a.m.target.f || 0) * 9 : 0));
  const hasSnackRecipes = pool.some(r => r.meal === 'snack');
  const recipeSnackIdx = (hasSnackRecipes && snackIdxs.length > 0) ? snackIdxs[0].i : -1;

  meals.forEach((m, mi) => {
    const mealAny = m as any;
    const label = mealAny.label || '';
    const isMain = isMainMealLabel(label);
    const periType = PERI_LABEL_TYPES[label] || null;
    // C2: peri-рецепт ставим только если тип доступен в пуле; пред/пост-трен — только в трен-день.
    const isPeriSlot = !!periType
      && pool.some(r => r.meal === periType)
      && ((periType !== 'preworkout' && periType !== 'postworkout') || !!args.trainDay);
    // Снек-рецепт — только при явном target (в реальном потоке движок задаёт target
    // снекам; приём без target — продуктовый, его не заменяем).
    const isSnackSlot = (mi === recipeSnackIdx) && !!mealAny.target;
    if (!isMain && !isSnackSlot && !isPeriSlot) return;
    const tgt = mealAny.target || { p: mealAny.totals?.p ?? 30, c: mealAny.totals?.c ?? 40, f: mealAny.totals?.f ?? 15 };
    // Ккал-цель приёма: фактические тоталы, а для пустого приёма — формула из макро-цели
    // (раньше пустой приём скорился против дефолтных 300 ккал и ломал выбор рецепта).
    const targetKcal = mealAny.totals?.kcal
      || Math.round((tgt.p || 0) * 4 + (tgt.c || 0) * 4 + (tgt.f || 0) * 9)
      || 300;
    const excludeNames = new Set<string>([...(mealAny.recipeOptionNames || []), ...dayUsedNames, ...(usedNamesAcrossDays || [])]);
    // C2: peri-слот матчится своим типом (breakfast/lunch/dinner/snak — прежнее поведение).
    const matchMealType: RecipeMatchOptions['mealType'] = periType ?? mealTypeFromLabel(label || undefined);
    const matchOpts: RecipeMatchOptions = {
      mealType: matchMealType,
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
      athleteWeightKg: args.athleteWeightKg,
    };
    // Шире сеть кандидатов — финальный отбор по фактической декомпозиции ниже
    // Для тяжей 100-120кг — масштабирование до 3.0 и 2-3 порции, иначе 14г каши
    const heavyScaleMax = (args.athleteWeightKg ?? 80) >= 120 ? 3.0 : (args.athleteWeightKg ?? 80) >= 110 ? 2.8 : (args.athleteWeightKg ?? 80) >= 100 ? 2.5 : 2.2;
    // КБЖУ ≤3%: рецепт не должен масштабироваться вверх по белку/углям сильнее 1.2×
    // цели приёма — иначе день систематически перебирает белок (+18%) и недобирает угли.
    const heavyProteinCap = 1.2;
    const heavyCarbCap = 1.2;
    const scaleOf = (kcal: number, p: number, f: number, c: number): number => {
      let s = Math.max(0.7, Math.min(heavyScaleMax, targetKcal / Math.max(50, kcal)));
      if (p > 0) s = Math.min(s, (heavyProteinCap * (tgt.p || 30)) / p);
      if (f > 0) s = Math.min(s, (1.5 * (tgt.f || 15)) / f);
      if (c > 0) s = Math.min(s, (heavyCarbCap * (tgt.c || 40)) / c);
      return Math.max(0.7, Math.round(s * 20) / 20);
    };
    const rankCands = (candidatePool: Recipe[]): Recipe[] => candidatePool
      .map(r => {
        const t = decomposedFacts(r).totals;
        const s = t && t.kcal > 0 ? scaleOf(t.kcal, t.p, t.f, t.c) : 1;
        const scaled = t ? { kcal: t.kcal * s, p: t.p * s, f: t.f * s, c: t.c * s } : null;
        return { r, d: distOf(scaled, targetKcal, tgt.p || 30, tgt.f || 15, tgt.c || 40) };
      })
      .sort((a, b) => a.d - b.d)
      .map(x => x.r);
    let cands = pickRecipeOptions(pool, matchOpts, 6, excludeNames);
    // C2: обычные слоты НЕ получают peri-рецепты; peri-слот — только свой тип.
    if (periType) cands = cands.filter(r => r.meal === periType);
    else cands = cands.filter(r => !PERI_TYPES_SET.has(r.meal));
    // Aug 28: fallback — если скоринг с жёсткими гейтами опустошил выборку (экстремальные
    // цели: hardReject по девиации отсеял всё), основной приём НЕ должен остаться пустым.
    // Берём лучшие по макро-дистанции среди рецептов своего типа приёма (с ingredientIds).
    if (cands.length === 0) {
      const mealType = periType ?? mealTypeFromLabel(label || undefined);
      const sameType = pool.filter(r => r.meal === mealType && !excludeNames.has(r.name) && r.ingredientIds && r.ingredientIds.length > 0);
      cands = rankCands(sameType).slice(0, 6);
    }
    if (cands.length === 0) return;
    // D4: порошковый гейт — если 2 приёма дня уже с порошком (продуктом или рецептом),
    // убираем порошковые рецепты из кандидатов (fallback: цельная еда).
    // C2: пост-трен — зарезервированный порошковый слот (как в продуктовом движке).
    if (_powderCount() >= 2 && periType !== 'postworkout') {
      const _wholeFood = cands.filter(r => !_recipeHasPowder(r));
      if (_wholeFood.length > 0) cands = _wholeFood;
    }
    // C1: гейт квот дня — двухпроходный. Сначала кандидаты БЕЗ жёстких нарушений
    // грамм-квот (орехи/масла/яйца/порошок); мягкий кап семейства — демотировка.
    // Если ни один чистый не закрыл приём (КБЖУ-гейт) — второй проход по всем:
    // лучше осознанное нарушение квоты, чем раздутый ×2.3 чужой рецепт.
    const _quotaBlocked = blockedIdsForNextMeal(quota, String(matchMealType));
    const HARD_QUOTA_FAMS = new Set(['nuts', 'seeds', 'oils']);
    const quotaClass = (r: Recipe): 0 | 1 | 2 => {
      const its = decomposedFacts(r).items;
      if (!its || its.length === 0) return 0;
      let worst: 0 | 1 | 2 = 0;
      for (const it of its) {
        const fd = FOOD_DB.find(f => f.id === it.id);
        if (!foodAvailableWithQuota({ id: it.id, category: fd?.category, carbs: it.c, fiber: it.fiber } as any, _quotaBlocked)) {
          const fam = stapleFamilyOf(it.id) || '';
          if (!_quotaBlocked.has(`__FAM__${fam}`) || HARD_QUOTA_FAMS.has(fam)) return 2; // жёсткое нарушение
          worst = 1; // мягкое (семейство)
        }
      }
      return worst;
    };
    const rankedAll = rankCands(cands);
    const _clean = cands.filter(r => quotaClass(r) === 0);
    const ranked = (_clean.length > 0 && _clean.length < cands.length) ? rankCands(_clean) : rankedAll;
    // Р-2.2: fitPct — «закрывает приём на ~N%» для каждого варианта (после масштаба
    // с капами); 90-110% подсвечивается зелёным в UI, крайние значения — варн.
    const flats: FlatRecipeOption[] = ranked.slice(0, 3).map(r => {
      const f = flattenRecipeOption(r);
      const t = decomposedFacts(r).totals;
      if (t && t.kcal > 0 && targetKcal > 0) {
        f.fitPct = Math.round(scaleOf(t.kcal, t.p, t.f, t.c) * t.kcal / Math.max(50, targetKcal) * 100);
      }
      return f;
    });
    mealAny.recipeOptions = flats;
    mealAny.recipeOptionNames = flats.map(f => f.name);
    // Автовыбор лучшего кандидата — Р-2.2 «контур приёмки»: каждый ranked-кандидат
    // собирается ЦЕЛИКОМ (масштаб ×0.7-2.2 с капами по Б/Ж/У → пол реалистичных порций
    // → сайд-добивка в приём) и должен пройти гейт соответствия цели приёма:
    //   |ккал − цель| ≤ 25%, Б ≥ 0.80×цели, Ж ≤ 1.35×цели, У ≥ 0.70×цели.
    // Первый ПРОШЕДШИЙ берётся; ни один не прошёл — лучший по дистанции (как раньше)
    // + вариант остаётся доступным пользователю. Пустая декомпозиция → следующий.
    const tryBuild = (cand: Recipe): { flat: FlatRecipeOption; items: PlanItemLike[]; totals: PlanTotalsLike; sideNote: string | null } | null => {
      const flat = flattenRecipeOption(cand);
      const built = buildRecipeMealItems(rebuildRecipeFromFlat(flat));
      if (!built || built.length === 0) return null;
      const decompTot = sumMealTotals(built);
      const s = scaleOf(decompTot.kcal || 1, decompTot.p, decompTot.f, decompTot.c);
      let finalItems: PlanItemLike[] = (s !== 1)
        ? built.map(it => scaleItem(it as PlanItemLike, Math.max(5, Math.round((it.amount || 0) * s / 5) * 5)))
        : built as PlanItemLike[];
      flat.appliedScale = s;
      // Р-2.1: пол реалистичных порций в рецептурном ядре («18 г каши» — нет),
      // бюджет строго ×1.03 от цели приёма — пол не рушит сходимость дня ±3%.
      const _mealkT = (tgt.p || 0) * 4 + (tgt.c || 0) * 4 + (tgt.f || 0) * 9;
      finalItems = applyRealisticFloors(finalItems.map(it => ({ ...it, role: (it.role as any) || 'protein' })) as any, !!mealAny.target && /Перекус|Полдник|Второй завтрак/i.test(label), _mealkT ? _mealkT * 1.03 : undefined, true, args.athleteWeightKg ?? 80) as any;
      // Сайд-добивка В ТОТ ЖЕ приём: если после масштабирования приём недобирает >15% ккал,
      // добавляем гарнир/жир по доминирующему дефициту (для тяжей 100кг+ — до 2 сайдов, иначе пустой гарнир).
      let sideNote: string | null = null;
      {
        let tNow = sumMealTotals(finalItems);
        let kcalNow = tNow.kcal || 0;
        // Сайд добивка — пока <0.90 (для тяжей до 2 сайдов)
        const maxSides = (args.athleteWeightKg ?? 80) >= 100 ? 2 : 1;
        let sidesAdded = 0;
        while (targetKcal > 0 && kcalNow < targetKcal * 0.90 && sidesAdded < maxSides) {
          const dP = (tgt.p || 0) - tNow.p;
          const dC = (tgt.c || 0) - tNow.c;
          const dF = (tgt.f || 0) - tNow.f;
          const rel = (v: number, t: number) => v / Math.max(1, t);
          const used = new Set(finalItems.map(i => i.id));
          const sidePoolFor = (ids: string[]) => ids.map(id => FOOD_DB.find(f => f.id === id)).filter((f): f is FoodItem => !!f && !used.has(f.id) && !excludedIds.has(f.id));
          let pool: FoodItem[]; let macroOf: (f: FoodItem) => number; let dMacro: number; let role: string;
          if (rel(dC, tgt.c || 40) >= rel(dP, tgt.p || 30) && rel(dC, tgt.c || 40) >= rel(dF, tgt.f || 15)) {
            pool = sidePoolFor(['rice_white', 'buckwheat', 'potato_boiled', 'pasta_durum', 'sweet_potato', 'rice_basmati', 'bulgur']);
            macroOf = f => f.carbs || 0; dMacro = dC; role = 'углеводы';
          } else if (rel(dP, tgt.p || 30) >= rel(dF, tgt.f || 15)) {
            pool = sidePoolFor(['chicken_breast', 'cottage_cheese_5', 'turkey_breast', 'egg_whole', 'tuna_fresh']);
            macroOf = f => f.protein || 0; dMacro = dP; role = 'белок';
          } else {
            pool = sidePoolFor(['olive_oil', 'peanut_butter', 'avocado', 'walnuts']);
            macroOf = f => f.fat || 0; dMacro = dF; role = 'жиры';
          }
          const ok = pool.filter(f => macroOf(f) > 5).sort((a, b) => macroOf(b) / Math.max(1, b.kcal || 1) - macroOf(a) / Math.max(1, a.kcal || 1));
          const side = ok[0];
          if (!side || dMacro <= 8) break;
          let g = Math.floor(Math.min(dMacro / macroOf(side) * 100, 300) / 10) * 10;
          if (g < 30) break;
          finalItems = [...finalItems, scaleItem({
            name: side.name, id: side.id, amount: 100,
            kcal: Math.round(side.kcal || 0), p: side.protein || 0, f: side.fat || 0, c: side.carbs || 0,
            fiber: side.fiber || 0, role: role === 'углеводы' ? 'carb_slow' : role === 'белок' ? 'protein' : 'fat',
          }, g)];
          sideNote = sideNote ? sideNote + ` + ${side.name} ${g}г` : `➕ Сайд к «${flat.name}»: ${side.name} ${g} г (${role}) — приём добран до своей доли без «хвоста» в перекус`;
          tNow = sumMealTotals(finalItems);
          kcalNow = tNow.kcal || 0;
          sidesAdded++;
        }
      }
      return { flat, items: finalItems, totals: sumMealTotals(finalItems), sideNote };
    };
    let chosen: { flat: FlatRecipeOption; items: PlanItemLike[]; totals: PlanTotalsLike; sideNote: string | null } | null = null;
    let fallback: { flat: FlatRecipeOption; items: PlanItemLike[]; totals: PlanTotalsLike; sideNote: string | null } | null = null;
    // C5 (Эпик C): ккал-гейт приёмки ±25% пропускал ПОЛОВИННЫЙ недобор (рецепт = 50%
    // приёма, остальное — сайды) — снижаем до ±15% (перекусы ±20%: их догоняет ребаланс).
    const kcalTol = isSnackSlot ? 0.20 : 0.15;
    const _passesGate = (built: { totals: PlanTotalsLike }): boolean => {
      const tk = built.totals.kcal || 1;
      return Math.abs(tk - targetKcal) / Math.max(1, targetKcal) <= kcalTol
        && built.totals.p >= 0.80 * (tgt.p || 30) - 0.5
        && built.totals.p <= 1.25 * (tgt.p || 30) + 0.5
        && built.totals.f <= 1.35 * (tgt.f || 15) + 0.5
        && built.totals.c >= 0.70 * (tgt.c || 40) - 0.5
        && built.totals.c <= 1.30 * (tgt.c || 40) + 0.5;
    };
    for (const cand of ranked) {
      const built = tryBuild(cand);
      if (!built) continue;
      if (!fallback) fallback = built;
      if (_passesGate(built)) { chosen = built; break; }
    }
    // C1 второй проход: чистые кандидаты не закрыли приём по строгому гейту —
    // пробуем нарушителей квот с LEGACY-допуском ±25% (старое поведение гейта):
    // осознанное нарушение квоты лучше, чем раздутый ×2.3 чужой рецепт.
    if (!chosen && rankedAll !== ranked) {
      for (const cand of rankedAll) {
        const built = tryBuild(cand);
        if (!built) continue;
        const tk = built.totals.kcal || 1;
        if (Math.abs(tk - targetKcal) / Math.max(1, targetKcal) <= 0.25
          && built.totals.p >= 0.80 * (tgt.p || 30) - 0.5
          && built.totals.p <= 1.30 * (tgt.p || 30) + 0.5
          && built.totals.f <= 1.35 * (tgt.f || 15) + 0.5
          && built.totals.c >= 0.70 * (tgt.c || 40) - 0.5
          && built.totals.c <= 1.35 * (tgt.c || 40) + 0.5) { chosen = built; break; }
      }
    }
    if (!chosen && !fallback) return;
    const use = chosen || fallback!;
    const chosenFlat = use.flat;
    const finalItems = use.items;
    mealAny.items = finalItems;
    mealAny.totals = use.totals;
    mealAny.recipeApplied = chosenFlat.name;
    mealAny.recipeAppliedData = chosenFlat;
    if (use.sideNote) mealAny.rationale = [...(mealAny.rationale || []), use.sideNote];
    if (!chosen) mealAny.rationale = [...(mealAny.rationale || []), `⚠ Рецепт «${chosenFlat.name}» не закрывает приём точно (${Math.round(use.totals.kcal)} из ~${Math.round(targetKcal)} ккал) — проверьте варианты`];
    dayUsedNames.add(chosenFlat.name);
    usedNamesAcrossDays?.add(chosenFlat.name);
    if (_recipeHasPowder(chosenFlat as unknown as Recipe)) _powderMealsUsed.add(mi);
    // C1: выбранный рецепт (с сайдами) регистрируется в дневных квотах —
    // следующий приём видит актуальный блок-лист семейств/грамм-лимитов.
    try { registerMealInQuota(quota, finalItems as any); } catch {}
    appliedCount++;
  });

  // Ребаланс дня: недобор закрываем топ-апом в перекус, перебор режем по гибким слотам
  // (выбранные рецепты не трогаются). Цель — дневные КБЖУ в ±3%. C5: субротация пулов.
  const rb = rebalanceDayAfterRecipes(meals, targets, { excludedIds, seed: args.seed });
  const notes = [...rb.notes];

  // D4: единый корректор — после всех капов/ребелов доводим день до ≤3% по 4 осям.
  // Ядро рецепта трогается только в крайнем случае (±15% кумулятивно), гибкие слоты — свободно.
  const needCorr = !rb.withinTolerance || rb.deviationPct > 3;
  if (needCorr) {
    const corr = correctDayToTargets(rb.meals as any, targets as any, { excludedIds, allowCoreScale: true, maxIter: 80, weightKg: args.athleteWeightKg ?? 80 });
    const corrDev = corr.deviationPct;
    // C1: финальный грамм-трим квот после корректора (его доборы идут мимо квот).
    const _trimNotes1 = trimQuotaOverflow(corr.meals as any);
    if (corrDev + 1e-9 < rb.deviationPct) {
      if (corr.withinTolerance) {
        return { meals: corr.meals as any, notes: [...notes, ..._trimNotes1, `✓ Корректор дневных целей: ${rb.deviationPct}% → ${corrDev}% (≤3%)`], withinTolerance: true, deviationPct: corrDev, appliedCount };
      }
      // улучшили, но не до ≤3% — отдаём лучшее с предупреждением (>3%)
      return { meals: corr.meals as any, notes: [...notes, ..._trimNotes1, `✓ Корректор дневных целей: ${rb.deviationPct}% → ${corrDev}%`, `⚠ Режим «по рецептам»: дневное отклонение от целей ${corrDev}% (>3%) — попробуйте выбрать другие варианты рецептов.`], withinTolerance: false, deviationPct: corrDev, appliedCount };
    }
  }

  if (!rb.withinTolerance) {
    notes.push(`⚠ Режим «по рецептам»: дневное отклонение от целей ${rb.deviationPct}% (>3%) — попробуйте выбрать другие варианты рецептов.`);
  }
  const _trimNotes = trimQuotaOverflow(rb.meals);
  return { meals: rb.meals, notes: [...notes, ..._trimNotes], withinTolerance: rb.withinTolerance, deviationPct: rb.deviationPct, appliedCount };
}
