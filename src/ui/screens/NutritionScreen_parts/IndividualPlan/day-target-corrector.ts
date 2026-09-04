/**
 * day-target-corrector.ts — единый корректор дневных КБЖУ к целям.
 *
 * Задача: после ВСЕХ порционных капов/полов/квот/санитарий довести день до ≤3%
 * отклонения по каждому из 4 осей (ккал, Б, Ж, У). Работает для обоих путей:
 *  - products-path (buildDayPlan) — гибкие items, _fixedGrams неприкосновенны
 *  - recipe-path (assembleRecipeDay / rebalanceDayAfterRecipes) — ядро рецепта
 *    трогается только в крайнем случае и в коридоре ±10% кумулятивно.
 *
 * Корректор детерминирован, без рандома, чистый (клонирует вход).
 */

import { FOOD_DB } from '../../../../core/nutrition-database';
import type { FoodItem } from '../../../../core/nutrition-database';
import { foodAvailableForPlan, stapleFamilyOf } from './food-availability';
// Маркер инсулин-окна (тип 'snack', закрыт для коррекций как peri). NB: проверять ТОЛЬКО
// маркер, а не isPeriLikeMeal(): старые гейты по типам разные в каждой ветке
// (swap скипает prew, cut — нет) и их расширение ломает peri-поведение.

export interface DayTargets { kcal: number; p: number; f: number; c: number; }
export interface CorrectorItem { id: string; name: string; amount: number; kcal: number; p: number; f: number; c: number; fiber?: number; leucine_mg?: number; role?: string; _fixedGrams?: number; }
export interface CorrectorMeal { label?: string; type?: string; items: CorrectorItem[]; totals?: { kcal: number; p: number; f: number; c: number; fiber?: number }; recipeApplied?: string; recipeAppliedData?: { ingredientIds?: string[] }; recipeApplied2?: string; recipeAppliedData2?: { ingredientIds?: string[] }; }

function sumTotals(meals: CorrectorMeal[]): DayTargets & { fiber: number } {
  let kcal = 0, p = 0, f = 0, c = 0, fiber = 0;
  for (const m of meals) for (const it of m.items || []) { kcal += it.kcal || 0; p += it.p || 0; f += it.f || 0; c += it.c || 0; fiber += it.fiber || 0; }
  return { kcal: Math.round(kcal), p: Math.round(p * 10) / 10, f: Math.round(f * 10) / 10, c: Math.round(c * 10) / 10, fiber: Math.round(fiber * 10) / 10 };
}

function maxDevPct(totals: DayTargets, targets: DayTargets): number {
  const dk = targets.kcal ? Math.abs(totals.kcal - targets.kcal) / targets.kcal * 100 : 0;
  const dp = targets.p ? Math.abs(totals.p - targets.p) / targets.p * 100 : 0;
  const df = targets.f ? Math.abs(totals.f - targets.f) / targets.f * 100 : 0;
  const dc = targets.c ? Math.abs(totals.c - targets.c) / targets.c * 100 : 0;
  return Math.max(dk, dp, df, dc);
}

function perDev(totals: DayTargets, targets: DayTargets): { k: number; p: number; f: number; c: number } {
  return {
    k: targets.kcal ? (totals.kcal - targets.kcal) / targets.kcal : 0,
    p: targets.p ? (totals.p - targets.p) / targets.p : 0,
    f: targets.f ? (totals.f - targets.f) / targets.f : 0,
    c: targets.c ? (totals.c - targets.c) / targets.c : 0,
  };
}

function cloneMeals(meals: CorrectorMeal[]): CorrectorMeal[] {
  return meals.map(m => ({ ...m, items: (m.items || []).map(it => ({ ...it })), totals: m.totals ? { ...m.totals } : undefined }));
}

function recalcMealTotals(meals: CorrectorMeal[]): void {
  for (const m of meals) {
    let kcal = 0, p = 0, f = 0, c = 0, fiber = 0;
    for (const it of m.items) { kcal += it.kcal || 0; p += it.p || 0; f += it.f || 0; c += it.c || 0; fiber += it.fiber || 0; }
    m.totals = { kcal: Math.round(kcal), p: Math.round(p * 10) / 10, f: Math.round(f * 10) / 10, c: Math.round(c * 10) / 10, fiber: Math.round(fiber * 10) / 10 };
  }
}

function scaleItem(it: CorrectorItem, newAmount: number): void {
  if (it._fixedGrams) return;
  const r = newAmount / Math.max(1, it.amount);
  it.amount = newAmount;
  it.p = Math.round((it.p || 0) * r * 10) / 10;
  it.f = Math.round((it.f || 0) * r * 10) / 10;
  it.c = Math.round((it.c || 0) * r * 10) / 10;
  it.fiber = it.fiber != null ? Math.round(it.fiber * r * 10) / 10 : undefined;
  it.leucine_mg = it.leucine_mg != null ? Math.round(it.leucine_mg * r) : undefined;
  it.kcal = Math.round(4 * (it.p || 0) + 9 * (it.f || 0) + 4 * (it.c || 0));
}

function isCoreRecipeItem(meal: CorrectorMeal, itemId: string): boolean {
  const inCore = (d: { ingredientIds?: string[] } | undefined): boolean | null => {
    // null = «без ingredientIds → консервативно весь приём ядро»
    if (!d || !d.ingredientIds || d.ingredientIds.length === 0) return null;
    return d.ingredientIds.includes(itemId);
  };
  if (meal.recipeApplied) {
    const r = inCore(meal.recipeAppliedData);
    if (r !== null) return r;
    if (!meal.recipeApplied2) return true; // один рецепт без ids — весь приём ядро (старое поведение)
  }
  if (meal.recipeApplied2) {
    const r2 = inCore(meal.recipeAppliedData2);
    if (r2 !== null) return r2;
    return true; // второй рецепт без ids — его часть ядро
  }
  return false;
}

// B7 (Эпик B): экспорт для теста id-безопасности (planner-id-safety.test.ts).
// NB: порядок/состав влияет на products-путь (legacy low-GI фильтр ниже) —
// новые носители только в ХВОСТ, чтобы legacy-пул был бит-идентичен.
export const TOPUP_PROTEIN_IDS = ['chicken_breast', 'cottage_cheese_5', 'whey_isolate', 'turkey_breast', 'beef_lean', 'casein', 'egg_whole', 'tuna_canned'];
export const TOPUP_CARB_IDS = ['rice_white', 'oats_dry', 'buckwheat', 'potato_boiled', 'pasta_durum', 'sweet_potato', 'rice_brown', 'bulgur', 'bread_white', 'whole_grain_bread', 'cream_of_rice', 'rice_basmati'];
export const TOPUP_FAT_IDS = ['olive_oil', 'walnuts', 'almonds', 'avocado', 'peanut_butter'];

/**
 * Пул носителей макроса. convenientCarbs=true (только рецептурный путь):
 * для углеводов — низкая клетчатка вместо низкого GI, иначе low-GI фильтр
 * систематически выбирает булгур/батат и отбрасывает рис/рисовый крем.
 * Legacy (products): поведение бит-идентично прежнему.
 */
function poolFor(macro: 'p' | 'c' | 'f', excludedIds?: Set<string>, convenientCarbs?: boolean): FoodItem[] {
  const ids = macro === 'p' ? TOPUP_PROTEIN_IDS : macro === 'c' ? TOPUP_CARB_IDS : TOPUP_FAT_IDS;
  let pool = ids.map(id => FOOD_DB.find(f => f.id === id)).filter((f): f is FoodItem => !!f && !(excludedIds && excludedIds.has(f.id)) && foodAvailableForPlan(f));
  if (macro === 'c' && pool.length >= 2) {
    if (convenientCarbs) {
      const lowFiber = pool.filter(f => (f.fiber || 0) <= 3);
      if (lowFiber.length >= 2) pool = lowFiber;
    } else {
      // для углеводов — предпочитаем низкий GI (≤55) чтобы не раздувать GL, если есть выбор
      const lowGi = pool.filter(f => (f.gi || 100) <= 55);
      if (lowGi.length >= 2) pool = lowGi;
    }
  }
  return pool;
}

function currentNutGrams(meals: CorrectorMeal[]): number {
  return meals.flatMap(m => m.items).filter(it => ['nuts', 'seeds'].includes(stapleFamilyOf(it.id) || '')).reduce((s, it) => s + (it.amount || 0), 0);
}
function currentFiber(meals: CorrectorMeal[]): number {
  return meals.flatMap(m => m.items).reduce((s, it) => s + (it.fiber || 0), 0);
}

/**
 * Единый корректор: доводит день до targets в пределах ±3% по каждому макросу.
 * После порционных капов/квот/финальной санитарии — последний шанс закрыть разбег.
 * convenientCarbs=true — только рецептурный путь (удобные носители, дедуп, защита
 * снеков); products-путь вызывает без флага и идёт бит-идентично прежнему.
 */
export function correctDayToTargets(
  mealsIn: CorrectorMeal[],
  targets: DayTargets,
  opts?: { excludedIds?: Set<string>; allowCoreScale?: boolean; maxIter?: number; weightKg?: number; convenientCarbs?: boolean },
): { meals: CorrectorMeal[]; withinTolerance: boolean; deviationPct: number } {
  const maxIter = opts?.maxIter ?? 80;
  const weightKg = opts?.weightKg ?? 80;
  const conv = opts?.convenientCarbs === true;
  const weightScaleCorr = Math.max(1, Math.min(1.6, weightKg / 80));
  const meals = cloneMeals(mealsIn);
  // кумулятивная шкала ядра рецепта (не более ±25% для тяжей, иначе 7-12% разбег)
  const coreScale = new Map<string, number>(); // key = mealIdx:itemId

  const safeTargets: DayTargets = {
    kcal: Number.isFinite(targets.kcal) && targets.kcal > 0 ? targets.kcal : 0,
    p: Number.isFinite(targets.p) && targets.p > 0 ? targets.p : 0,
    f: Number.isFinite(targets.f) && targets.f > 0 ? targets.f : 0,
    c: Number.isFinite(targets.c) && targets.c > 0 ? targets.c : 0,
  };
  if (safeTargets.kcal === 0 && safeTargets.p === 0 && safeTargets.f === 0 && safeTargets.c === 0) {
    return { meals, withinTolerance: true, deviationPct: 0 };
  }

  const maxCoreScale = opts?.allowCoreScale ? 1.30 : 1.20;
  for (let iter = 0; iter < maxIter; iter++) {
    // человечность: орехи/семена ≤85г и клетчатка ≤85г — режем перебор ДО сведения КБЖУ.
    // ВАЖНО: тримим ТОЛЬКО при переборе ккал или в норме — при недоборе ккал срезка углеводов
    // (носитель клетчатки) рушит калораж (800г углей → клетчатка 200г+ → 5089→4307 ккал).
    const nutG = currentNutGrams(meals);
    const fibG = currentFiber(meals);
    const _kcalNow = sumTotals(meals).kcal;
    if (!(safeTargets.kcal > 0 && _kcalNow < safeTargets.kcal * 0.97) && (nutG > 85 || fibG > 85)) {
      const isNutOver = nutG > 85;
      const cands = meals.flatMap((m, mi) => m.items.map((it, ii) => ({ mi, ii, it, m })))
        .filter(x => !((x.it as any)._fixedGrams) && x.m.type !== 'presleep' && x.m.type !== 'intra')
        .filter(x => {
          const fam = stapleFamilyOf(x.it.id) || '';
          if (isNutOver) return fam === 'nuts' || fam === 'seeds';
          return (x.it.fiber || 0) > 1 && x.it.role !== 'protein' && x.it.role !== 'fast_protein' && x.it.role !== 'slow_protein';
        })
        .sort((a, b) => (b.it.fiber || 0) - (a.it.fiber || 0));
      let cut = false;
      const beforeDevAll = maxDevPct(sumTotals(meals) as DayTargets, safeTargets);
      for (const cand of cands) {
        if ((cand.it.amount || 0) < 20) continue;
        const newAmount = Math.max(15, Math.round(cand.it.amount * 0.85));
        const prevAmount = cand.it.amount;
        scaleItem(cand.it, newAmount);
        recalcMealTotals(meals);
        const afterDevAll = maxDevPct(sumTotals(meals) as DayTargets, safeTargets);
        // мягкий допуск +0.5%: мелкий трим (85.2→85г клетчатки) проходит, катастрофическая
        // срезка (217→85г при 800г углей, рушит ~1000 ккал) отклоняется.
        if (afterDevAll < beforeDevAll + 0.5) { cut = true; break; }
        // откат — срезка клетчатки не должна ломать КБЖУ
        scaleItem(cand.it, prevAmount);
        recalcMealTotals(meals);
      }
      if (cut) continue;
    }
    const totals = sumTotals(meals);
    const dev = maxDevPct(totals as DayTargets, safeTargets);
    if (dev <= 3) break;
    // SWAP (до выбора оси): универсально — любая ПЕРЕБРАННАЯ ось (жир/угли/белок) меняется
    // на любую НЕДОБРАННУЮ, по ккал-паритету. Иначе при конфликте «жир перебран + угли
    // недобраны» (или «белок недобран + жир перебран») корректор по одной оси застревает:
    // добавление недобранного ухудшает перебранное → maxDev не падает → разбег 12-28%.
    {
      const dP = safeTargets.p - totals.p;
      const dF = safeTargets.f - totals.f;
      const dC = safeTargets.c - totals.c;
      // under/over по осям (порог: белк/угли >5г, жир >2г)
      const unders: Array<'p' | 'f' | 'c'> = [];
      const overs: Array<'p' | 'f' | 'c'> = [];
      if (dP > 5) unders.push('p'); else if (dP < -5) overs.push('p');
      if (dF > 2) unders.push('f'); else if (dF < -2) overs.push('f');
      if (dC > 5) unders.push('c'); else if (dC < -5) overs.push('c');
      // сортируем по величине |отклонения| (г) — правим самую больную ось
      const magOf = (a: 'p' | 'f' | 'c') => a === 'p' ? Math.abs(dP) : a === 'f' ? Math.abs(dF) : Math.abs(dC);
      unders.sort((a, b) => magOf(b) - magOf(a));
      overs.sort((a, b) => magOf(b) - magOf(a));
      if (unders.length > 0 && overs.length > 0) {
        const under = unders[0];
        const over = overs[0];
        const needFor = (f: FoodItem) => under === 'p' ? (f.protein || 0) : under === 'c' ? (f.carbs || 0) : (f.fat || 0);
        const overFor = (f: FoodItem) => over === 'p' ? (f.protein || 0) : over === 'c' ? (f.carbs || 0) : (f.fat || 0);
        const underPool = poolFor(under, opts?.excludedIds, conv).filter(f => needFor(f) > 0);
        if (underPool.length > 0) {
          // Углеводы в convenient-режиме: удобство первым (низкая клетчатка) — иначе swap тащит батат.
          const bestU = [...underPool].sort((a, b) => {
            if (conv && under === 'c') {
              const ca = (a.carbs || 0) / (1 + (a.fiber || 0) * 2);
              const cb = (b.carbs || 0) / (1 + (b.fiber || 0) * 2);
              if (Math.abs(ca - cb) > 0.5) return cb - ca;
            }
            return needFor(b) / Math.max(1, b.kcal || 1) - needFor(a) / Math.max(1, a.kcal || 1);
          })[0];
          const bestUFood = FOOD_DB.find(f => f.id === bestU.id);
          const bestUMacros = bestUFood ? { p: bestUFood.protein || 0, f: bestUFood.fat || 0, c: bestUFood.carbs || 0 } : { p: 0, f: 0, c: 0 };
          let victimMi = -1, victimIi = -1, victimBad = -1;
          let victimIt: CorrectorItem = { id: '', name: '', amount: 0, kcal: 0, p: 0, f: 0, c: 0 };
          meals.forEach((m, mi) => {
            if (m.type === 'presleep' || m.type === 'intra' || m.type === 'preworkout' || (m as any)._insulinWindow) return;
            (m.items || []).forEach((it, ii) => {
              if ((it as any)._fixedGrams) return;
              if (isCoreRecipeItem(m, it.id)) return;
              const food = FOOD_DB.find(f => f.id === it.id);
              if (!food) return;
              // Чистка-2026 (распределение КБЖУ): свап не убивает белковый пункт приёма.
              // Завтрак — канон «яйца/творог/сыворотка» (D1, без мяса и без замены на углеводы);
              // в остальных приёмах единственный белковый пункт не трогаем («батат 290 г без белка»).
              const _vr = it.role || '';
              const _isProtRole = _vr === 'protein' || _vr === 'fast_protein' || _vr === 'slow_protein';
              if (_isProtRole) {
                if (m.type === 'breakfast') return;
                const _protCount = m.items.filter(x => x.role === 'protein' || x.role === 'fast_protein' || x.role === 'slow_protein').length;
                if (_protCount <= 1) return;
              }
              const ov = overFor(food);
              if (ov < 2) return;
              const k = Math.max(1, food.kcal || 1);
              const vm = { p: (food.protein || 0) / k, f: (food.fat || 0) / k, c: (food.carbs || 0) / k };
              const bm = { p: bestUMacros.p / Math.max(1, bestU.kcal || 1), f: bestUMacros.f / Math.max(1, bestU.kcal || 1), c: bestUMacros.c / Math.max(1, bestU.kcal || 1) };
              // Замена на bestU должна НЕ ухудшать недобранные оси и СНИЖАТЬ перебранные.
              for (const u of unders) if (bm[u] + 0.001 < vm[u]) return;
              for (const o of overs) if (vm[o] + 0.001 < bm[o]) return;
              const bad = ov * (it.amount || 0) / 100;
              if (bad > victimBad) { victimBad = bad; victimMi = mi; victimIi = ii; victimIt = it; }
            });
          });
          if (victimBad >= 0 && victimMi >= 0 && bestU) {
            const freedKcal = victimIt.kcal || 0;
            const swapG = Math.max(20, Math.round(freedKcal / Math.max(1, bestU.kcal || 1) * 100 / 10) * 10);
            if (swapG >= 20) {
              const beforeTotals = sumTotals(meals);
              const beforeDev = maxDevPct(beforeTotals as DayTargets, safeTargets);
              const newIt: CorrectorItem = {
                id: bestU.id, name: bestU.name, amount: swapG,
                kcal: Math.round((bestU.kcal || 0) * swapG / 100),
                p: Math.round((bestU.protein || 0) * swapG / 100 * 10) / 10,
                f: Math.round((bestU.fat || 0) * swapG / 100 * 10) / 10,
                c: Math.round((bestU.carbs || 0) * swapG / 100 * 10) / 10,
                fiber: Math.round((bestU.fiber || 0) * swapG / 100 * 10) / 10,
                role: under === 'p' ? 'protein' : under === 'c' ? 'carb_slow' : 'fat',
              } as any;
              newIt.kcal = Math.round(4 * newIt.p + 9 * newIt.f + 4 * newIt.c);
              meals[victimMi].items[victimIi] = newIt;
              recalcMealTotals(meals);
              const afterTotals = sumTotals(meals);
              const afterDev = maxDevPct(afterTotals as DayTargets, safeTargets);
              if (afterDev < beforeDev - 0.05) continue;
              meals[victimMi].items[victimIi] = victimIt;
              recalcMealTotals(meals);
            }
          }
        }
      }
    }
    const pd = perDev(totals as DayTargets, safeTargets);
    // выбираем ось с максимальным |dev|
    const abs = { k: Math.abs(pd.k), p: Math.abs(pd.p), f: Math.abs(pd.f), c: Math.abs(pd.c) };
    let worst: 'k' | 'p' | 'f' | 'c' = 'k';
    if (abs.p > abs[worst]) worst = 'p';
    if (abs.f > abs[worst]) worst = 'f';
    if (abs.c > abs[worst]) worst = 'c';
    let eff: 'p' | 'f' | 'c' = worst === 'k'
      ? (abs.p >= abs.c && abs.p >= abs.f ? 'p' : abs.c >= abs.f ? 'c' : 'f')
      : worst as 'p' | 'f' | 'c';
    const need = (eff === 'p' ? safeTargets.p - totals.p : eff === 'f' ? safeTargets.f - totals.f : safeTargets.c - totals.c);
    if (Math.abs(need) < 0.3) break;

    if (need < 0) {
      // перебор — урезаем
      // кандидаты: не-fixed, не-presleep/intra, сначала гибкие (не ядро), затем ядро.
      // convenient: при недоборе ккал дня маленькие приёмы (<250 ккал) не трогаем —
      // им добивка нужна, не резка («Перекус 488→107» на 1500У).
      type Cand = { mi: number; ii: number; it: CorrectorItem; per100: number; totalMacro: number };
      const cands: Cand[] = [];
      const _dayUnderKcal = conv && totals.kcal < safeTargets.kcal * 0.97;
      meals.forEach((m, mi) => {
        if (m.type === 'presleep' || m.type === 'intra' || (m as any)._insulinWindow) return;
        if (_dayUnderKcal && (m.totals?.kcal || 0) < 250) return;
        (m.items || []).forEach((it, ii) => {
          if ((it as any)._fixedGrams) return;
          if ((it.amount || 0) < 15) return;
          const food = FOOD_DB.find(f => f.id === it.id);
          const per100 = food ? (eff === 'p' ? (food.protein || 0) : eff === 'c' ? (food.carbs || 0) : (food.fat || 0)) : (eff === 'p' ? it.p : eff === 'c' ? it.c : it.f) / Math.max(1, it.amount) * 100;
          if (per100 <= 0) return;
          // для жира — режем жирные продукты, для углей — углеводные и т.д.
          cands.push({ mi, ii, it, per100, totalMacro: (it.amount || 0) * per100 / 100 });
        });
      });
      if (cands.length === 0) break;
      // приоритет: гибкие (не ядро) выше, внутри — больше макро на порцию
      cands.sort((a, b) => {
        const aCore = isCoreRecipeItem(meals[a.mi], a.it.id) ? 1 : 0;
        const bCore = isCoreRecipeItem(meals[b.mi], b.it.id) ? 1 : 0;
        if (aCore !== bCore) return aCore - bCore;
        return b.totalMacro - a.totalMacro;
      });
      let improved = false;
      for (const cand of cands) {
        const isCore = isCoreRecipeItem(meals[cand.mi], cand.it.id);
        if (isCore && opts?.allowCoreScale === false) continue;
        const key = `${cand.mi}:${cand.it.id}`;
        const curScale = coreScale.get(key) ?? 1;
        // реалистичный пол: белок 80/60*scale, гарнир 50/30*scale, иначе 14г каши — пусто
        let floor = 15;
        if (cand.it.role === 'protein' || cand.it.role === 'fast_protein' || cand.it.role === 'slow_protein') {
          const mType = meals[cand.mi].type || '';
          const isMain = ['breakfast', 'lunch', 'dinner'].includes(mType);
          const food = FOOD_DB.find(f => f.id === cand.it.id);
          const isPowder = food?.category === 'supplement';
          floor = isPowder ? 20 : Math.round((isMain ? 80 : 60) * weightScaleCorr);
        } else if (cand.it.role === 'carb_slow' || cand.it.role === 'carb_fast') {
          const mType = meals[cand.mi].type || '';
          const isMain = ['breakfast', 'lunch', 'dinner'].includes(mType);
          floor = Math.round((isMain ? 50 : 30) * weightScaleCorr);
        } else if (cand.it.role === 'fruit') {
          floor = Math.round(30 * weightScaleCorr);
        }
        const minFactor = opts?.allowCoreScale ? 0.75 : 0.85;
        const minAmount = isCore ? Math.max(floor, Math.round(cand.it.amount * minFactor / curScale)) : Math.max(floor, 15);
        // шаг — до 15% за итерацию
        const targetCutG = Math.min(cand.it.amount - minAmount, Math.ceil(Math.abs(need) / cand.per100 * 100 * 0.7));
        if (targetCutG < 5) continue;
        const newAmount = Math.max(minAmount, cand.it.amount - targetCutG);
        const beforeTotals = sumTotals(meals);
        const beforeDev = maxDevPct(beforeTotals as DayTargets, safeTargets);
        const prevAmount = cand.it.amount;
        scaleItem(cand.it, newAmount);
        if (isCore) coreScale.set(key, curScale * newAmount / prevAmount);
        recalcMealTotals(meals);
        const afterTotals = sumTotals(meals);
        const afterDev = maxDevPct(afterTotals as DayTargets, safeTargets);
        if (afterDev < beforeDev - 0.05) { improved = true; break; }
        // откат если не улучшило
        scaleItem(cand.it, prevAmount);
        if (isCore) coreScale.set(key, curScale);
        recalcMealTotals(meals);
      }
      if (!improved) break;
    } else {
      // недобор — наращиваем существующий item или добавляем новый
      // 1) пробуем нарастить существующий подходящий item
      type Cand = { mi: number; ii: number; it: CorrectorItem; per100: number };
      const cands: Cand[] = [];
      meals.forEach((m, mi) => {
        if (m.type === 'presleep' || m.type === 'intra' || (m as any)._insulinWindow) return;
        // Чистка-2026: недобор закрываем ТОЛЬКО в полноценные приёмы — пери-окна (предтрен/
        // пост-трен) имеют фиксированные капы углей и 0 жиров («мёд 69 г в предтрен» — баг).
        if (m.type === 'preworkout' || m.type === 'postworkout') return;
        // на недобор Ж не трогаем ужин-morningLoad и пост-трен (как в основном движке)
        if (eff === 'f' && (m.type === 'postworkout')) return;
        (m.items || []).forEach((it, ii) => {
          if ((it as any)._fixedGrams) return;
          const isCore = isCoreRecipeItem(m, it.id);
          if (isCore && opts?.allowCoreScale === false) return;
          const food = FOOD_DB.find(f => f.id === it.id);
          const per100 = food ? (eff === 'p' ? (food.protein || 0) : eff === 'c' ? (food.carbs || 0) : (food.fat || 0)) : 0;
          if (per100 <= 0) return;
          if (isCore) {
            const key = `${mi}:${it.id}`;
            const curScale = coreScale.get(key) ?? 1;
            if (curScale >= maxCoreScale) return; // ядро не выше maxCoreScale
          }
          cands.push({ mi, ii, it, per100 });
        });
      });
      // сортируем по макро-плотности (выше — лучше для недобора)
      cands.sort((a, b) => b.per100 - a.per100);
      let done = false;
      // пробуем нарастить первый подходящий
      for (const cand of cands) {
        const isCore = isCoreRecipeItem(meals[cand.mi], cand.it.id);
        const key = `${cand.mi}:${cand.it.id}`;
        const curScale = coreScale.get(key) ?? 1;
        const maxAdd = isCore ? Math.round(cand.it.amount * (maxCoreScale / curScale - 1)) : 150;
        if (maxAdd < 5) continue;
        const needG = Math.ceil(need / cand.per100 * 100);
        let addG = Math.min(maxAdd, Math.max(10, Math.min(needG, 80)));
        // «Комфортные»/концентраты (сухофрукты, мёд, хлеб, удовольствия) — дегустационный
        // потолок ОТНОСИТЕЛЬНО текущей порции: иначе корректор наращивал самый плотный
        // источник (Финик Меджул → 150 г ×2 за день — жалоба «финики по 200 грам»).
        const COMFORT_TOTAL_CAP: Record<string, number> = {
          honey: 40, raisins: 60, dates_dried: 60, dates: 60, dried_apricots: 60, fruit_date_medjool: 60,
          pryaniki: 50, jam: 35, zefir: 50, pastila: 45, sushki: 40, sugar_cookies: 40, marmalade: 35,
          bread_white: 110, bread_rye: 110, bread_borodinsky: 110, bread_fitness: 110, whole_grain_bread: 110,
        };
        if (COMFORT_TOTAL_CAP[cand.it.id] !== undefined) {
          addG = Math.min(addG, Math.max(0, COMFORT_TOTAL_CAP[cand.it.id] - cand.it.amount));
          if (addG < 10) continue;
        }
        // кап орехов/семян 85г и клетчатки 85г — не превышаем
        const fam = stapleFamilyOf(cand.it.id) || '';
        if ((fam === 'nuts' || fam === 'seeds') && currentNutGrams(meals) + addG > 85) {
          addG = Math.max(0, 85 - currentNutGrams(meals));
          if (addG < 10) continue;
        }
        // орехи/семена — только добивка 15г/приём
        if (fam === 'nuts' || fam === 'seeds') {
          const perItemCap = 15;
          const maxByPerItem = perItemCap - cand.it.amount;
          if (maxByPerItem <= 0) continue;
          addG = Math.min(addG, maxByPerItem);
        }
        const candFood = FOOD_DB.find(f => f.id === cand.it.id);
        if (candFood && currentFiber(meals) + (candFood.fiber || 0) * addG / 100 > 85) {
          const fiberRoom = 85 - currentFiber(meals);
          const maxByFiber = Math.floor(fiberRoom / Math.max(0.1, candFood.fiber || 1) * 100);
          addG = Math.min(addG, maxByFiber);
          if (addG < 10) continue;
        }
        const newAmount = cand.it.amount + addG;
        // капы: белок ≤300, фрукт ≤150, клетчатка ≤10, общие ≤600
        let cap = 600;
        const isFiberSuppCap = candFood && candFood.category === 'supplement' && (candFood.fiber || 0) >= 30;
        if (isFiberSuppCap) cap = 10;
        else if (eff === 'p' && (cand.it.role === 'protein' || cand.it.role === 'fast_protein' || cand.it.role === 'slow_protein')) cap = 300;
        else if (cand.it.role === 'fruit') cap = 150;
        if (newAmount > cap) continue;
        const beforeTotals = sumTotals(meals);
        const beforeDev = maxDevPct(beforeTotals as DayTargets, safeTargets);
        const prevAmount = cand.it.amount;
        scaleItem(cand.it, Math.min(cap, newAmount));
        if (isCore) coreScale.set(key, curScale * cand.it.amount / prevAmount);
        recalcMealTotals(meals);
        const afterTotals = sumTotals(meals);
        const afterDev = maxDevPct(afterTotals as DayTargets, safeTargets);
        if (afterDev < beforeDev - 0.05) { done = true; break; }
        scaleItem(cand.it, prevAmount);
        if (isCore) coreScale.set(key, curScale);
        recalcMealTotals(meals);
      }
      if (done) continue;
      // 2) не нашли куда нарастить — добавляем новый item из пула
      const pool = poolFor(eff, opts?.excludedIds, conv);
      if (pool.length === 0) break;
      // выбираем самый плотный по нужному макро; для углеводов в convenient-режиме —
      // сначала удобство (низкая клетчатка): иначе «макрос/ккал» вечно выигрывает батат (20У при 86 ккал).
      const best = [...pool].sort((a, b) => {
        if (conv && eff === 'c') {
          const ca = (a.carbs || 0) / (1 + (a.fiber || 0) * 2);
          const cb = (b.carbs || 0) / (1 + (b.fiber || 0) * 2);
          if (Math.abs(ca - cb) > 0.5) return cb - ca;
        }
        const av = eff === 'p' ? (a.protein || 0) / Math.max(1, a.kcal || 1) : eff === 'c' ? (a.carbs || 0) / Math.max(1, a.kcal || 1) : (a.fat || 0) / Math.max(1, a.kcal || 1);
        const bv = eff === 'p' ? (b.protein || 0) / Math.max(1, b.kcal || 1) : eff === 'c' ? (b.carbs || 0) / Math.max(1, b.kcal || 1) : (b.fat || 0) / Math.max(1, b.kcal || 1);
        return bv - av;
      })[0];
      const per100Best = eff === 'p' ? (best.protein || 0) : eff === 'c' ? (best.carbs || 0) : (best.fat || 0);
      if (per100Best <= 0) break;
      // «Комфортные» доборки (хлеб/мёд/сухофрукты) — дегустационные капы и ЗАПРЕТ дубля
      // в одном приёме (иначе «Финики 180г + Финики 70г» в обеде).
      const COMFORT_CAP: Record<string, number> = {
        honey: 40, raisins: 60, dates_dried: 60, dates: 60, dried_apricots: 60,
        bread_white: 100, bread_rye: 100, bread_borodinsky: 100, bread_fitness: 100, whole_grain_bread: 100,
      };
      let grams = Math.max(20, Math.min(200, Math.round(need / per100Best * 100 / 10) * 10));
      if (COMFORT_CAP[best.id] !== undefined) grams = Math.min(grams, COMFORT_CAP[best.id]);
      // кап орехов/семян и клетчатки — не превышаем 85г
      const bestFam = stapleFamilyOf(best.id) || '';
      if ((bestFam === 'nuts' || bestFam === 'seeds') && currentNutGrams(meals) + grams > 85) {
        grams = Math.max(0, 85 - currentNutGrams(meals));
        if (grams < 15) break;
      }
      if (currentFiber(meals) + (best.fiber || 0) * grams / 100 > 85) {
        const fiberRoom = 85 - currentFiber(meals);
        const maxByFiber = Math.floor(fiberRoom / Math.max(0.1, best.fiber || 1) * 100);
        grams = Math.min(grams, maxByFiber);
        if (grams < 15) break;
      }
      // псиллиум и т.д. ≤10г — только добивка
      const isFiberSuppBest = best.category === 'supplement' && (best.fiber || 0) >= 30;
      if (isFiberSuppBest) grams = Math.min(grams, 10);
      // не выходить за 1.03× цели по этому макро
      const curMacro = eff === 'p' ? sumTotals(meals).p : eff === 'c' ? sumTotals(meals).c : sumTotals(meals).f;
      const maxMacro = (eff === 'p' ? safeTargets.p : eff === 'c' ? safeTargets.c : safeTargets.f) * 1.03;
      const over = curMacro + per100Best * grams / 100 - maxMacro;
      if (over > 0) grams = Math.max(0, grams - Math.ceil(over / per100Best * 100 / 10) * 10);
      // стабы не кладём («рис 15 г» — шум в тарелке, а не добор);
      // legacy-порог 10 (products-точностям нужны мелкие топ-апы для 1.2%).
      if (grams < (conv ? 20 : 10)) break;
      // выбираем приём с минимальной долей ккал (недогруженный).
      // convenient: дубли запрещены для ВСЕХ id (legacy — только комфортные),
      // иначе корректор кладёт «батат 75 + 75 + 75» — растим существующий пункт.
      const _dupFilter = (m: CorrectorMeal) => conv ? !m.items.some(it => it.id === best.id) : (COMFORT_CAP[best.id] === undefined || !m.items.some(it => it.id === best.id));
      const _freeMeals = meals.filter(m => m.type !== 'presleep' && m.type !== 'intra' && m.type !== 'preworkout' && !(m as any)._insulinWindow)
        .filter(_dupFilter);
      let targetMeal: CorrectorMeal | undefined;
      if (_freeMeals.length > 0) {
        targetMeal = _freeMeals.reduce((a, b) => {
          const aShare = a.totals ? a.totals.kcal / Math.max(1, (a as any).target ? ((a as any).target.p * 4 + (a as any).target.c * 4 + (a as any).target.f * 9) : 500) : 0;
          const bShare = b.totals ? b.totals.kcal / Math.max(1, (b as any).target ? ((b as any).target.p * 4 + (b as any).target.c * 4 + (b as any).target.f * 9) : 500) : 0;
          return aShare <= bShare ? a : b;
        });
      }
      if (!targetMeal) {
        // все приёмы уже содержат best.id — растим самый недогруженный из них
        const withBest = meals.filter(m => m.type !== 'presleep' && m.type !== 'intra' && m.type !== 'preworkout' && !(m as any)._insulinWindow && m.items.some(it => it.id === best.id));
        targetMeal = withBest.length > 0 ? withBest.reduce((a, b) => ((a.totals?.kcal || 0) <= (b.totals?.kcal || 0) ? a : b)) : meals[meals.length - 1];
        const ex = targetMeal.items.find(it => it.id === best.id);
        if (ex && !(ex as any)._fixedGrams) {
          const beforeTotals = sumTotals(meals);
          const beforeDev = maxDevPct(beforeTotals as DayTargets, safeTargets);
          const prevAmount = ex.amount;
          scaleItem(ex, ex.amount + grams);
          recalcMealTotals(meals);
          const afterTotals = sumTotals(meals);
          const afterDev = maxDevPct(afterTotals as DayTargets, safeTargets);
          if (afterDev < beforeDev - 0.05) continue;
          scaleItem(ex, prevAmount);
          recalcMealTotals(meals);
        }
        break;
      }
      const role: string = eff === 'p' ? 'protein' : eff === 'c' ? 'carb_slow' : 'fat';
      const newItem: CorrectorItem = {
        id: best.id, name: best.name, amount: grams,
        kcal: Math.round((best.kcal || 0) * grams / 100),
        p: Math.round((best.protein || 0) * grams / 100 * 10) / 10,
        f: Math.round((best.fat || 0) * grams / 100 * 10) / 10,
        c: Math.round((best.carbs || 0) * grams / 100 * 10) / 10,
        fiber: Math.round((best.fiber || 0) * grams / 100 * 10) / 10,
        role,
      } as any;
      // kcal из формулы для консистентности
      newItem.kcal = Math.round(4 * newItem.p + 9 * newItem.f + 4 * newItem.c);
      const beforeTotals = sumTotals(meals);
      const beforeDev = maxDevPct(beforeTotals as DayTargets, safeTargets);
      // Слияние-паранойя: если пункт уже есть (межфазный дубль — сайд tryBuild +
      // топ-ап ребаланса + добор корректора), растим его, а не кладём второй.
      const _dup = targetMeal.items.find(it => it.id === newItem.id && !(it as any)._fixedGrams);
      if (_dup) {
        const _prev = _dup.amount;
        // Кап слияния: комфортные — дегустационный кап, остальные — 600 г.
        const _mergeCap = COMFORT_CAP[newItem.id] !== undefined ? COMFORT_CAP[newItem.id] : 600;
        if (_dup.amount + newItem.amount > _mergeCap) break;
        scaleItem(_dup, _dup.amount + newItem.amount);
        recalcMealTotals(meals);
        const afterTotals = sumTotals(meals);
        const afterDev = maxDevPct(afterTotals as DayTargets, safeTargets);
        if (afterDev < beforeDev - 0.05) continue;
        scaleItem(_dup, _prev);
        recalcMealTotals(meals);
        break;
      }
      targetMeal.items.push(newItem);
      recalcMealTotals(meals);
      const afterTotals = sumTotals(meals);
      const afterDev = maxDevPct(afterTotals as DayTargets, safeTargets);
      if (afterDev >= beforeDev - 0.05) {
        targetMeal.items.pop();
        recalcMealTotals(meals);
        break;
      }
    }
  }

  const finalTotals = sumTotals(meals);
  const devOut = maxDevPct(finalTotals as DayTargets, safeTargets);
  // финальный пересчёт kcal по формуле для каждого item/meal
  for (const m of meals) for (const it of m.items) it.kcal = Math.round(4 * (it.p || 0) + 9 * (it.f || 0) + 4 * (it.c || 0));
  recalcMealTotals(meals);
  return { meals, withinTolerance: devOut <= 3, deviationPct: Math.round(devOut * 10) / 10 };
}

export function deviationPct(totals: DayTargets, targets: DayTargets): number {
  return Math.round(maxDevPct(totals, targets) * 10) / 10;
}
