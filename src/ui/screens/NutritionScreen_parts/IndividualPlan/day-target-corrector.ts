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

export interface DayTargets { kcal: number; p: number; f: number; c: number; }
export interface CorrectorItem { id: string; name: string; amount: number; kcal: number; p: number; f: number; c: number; fiber?: number; leucine_mg?: number; role?: string; _fixedGrams?: number; }
export interface CorrectorMeal { label?: string; type?: string; items: CorrectorItem[]; totals?: { kcal: number; p: number; f: number; c: number; fiber?: number }; recipeApplied?: string; recipeAppliedData?: { ingredientIds?: string[] }; }

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
  if (!meal.recipeApplied) return false;
  const ids = meal.recipeAppliedData?.ingredientIds;
  if (ids && ids.length > 0) return ids.includes(itemId);
  // без ids — консервативно считаем весь приём ядром (не трогаем без нужды)
  return true;
}

const TOPUP_PROTEIN_IDS = ['chicken_breast', 'cottage_cheese_5', 'whey_isolate', 'turkey_breast', 'beef_lean', 'casein', 'egg_whole', 'tuna_canned'];
const TOPUP_CARB_IDS = ['rice_white', 'oats_dry', 'buckwheat', 'potato_boiled', 'pasta_durum', 'sweet_potato', 'banana', 'rice_brown'];
const TOPUP_FAT_IDS = ['olive_oil', 'walnuts', 'almonds', 'avocado', 'peanut_butter'];

function poolFor(macro: 'p' | 'c' | 'f', excludedIds?: Set<string>): FoodItem[] {
  const ids = macro === 'p' ? TOPUP_PROTEIN_IDS : macro === 'c' ? TOPUP_CARB_IDS : TOPUP_FAT_IDS;
  let pool = ids.map(id => FOOD_DB.find(f => f.id === id)).filter((f): f is FoodItem => !!f && !(excludedIds && excludedIds.has(f.id)) && foodAvailableForPlan(f));
  // для углеводов — предпочитаем низкий GI (≤55) чтобы не раздувать GL, если есть выбор
  if (macro === 'c' && pool.length >= 2) {
    const lowGi = pool.filter(f => (f.gi || 100) <= 55);
    if (lowGi.length >= 2) pool = lowGi;
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
 */
export function correctDayToTargets(
  mealsIn: CorrectorMeal[],
  targets: DayTargets,
  opts?: { excludedIds?: Set<string>; allowCoreScale?: boolean; maxIter?: number },
): { meals: CorrectorMeal[]; withinTolerance: boolean; deviationPct: number } {
  const maxIter = opts?.maxIter ?? 40;
  const meals = cloneMeals(mealsIn);
  // кумулятивная шкала ядра рецепта (не более ±10% от исходного)
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

  const maxCoreScale = opts?.allowCoreScale ? 1.15 : 1.10;
  for (let iter = 0; iter < maxIter; iter++) {
    // человечность: орехи/семена ≤85г и клетчатка ≤85г — режем перебор до сведения КБЖУ
    const nutG = currentNutGrams(meals);
    const fibG = currentFiber(meals);
    if (nutG > 85 || fibG > 85) {
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
      for (const cand of cands) {
        if ((cand.it.amount || 0) < 20) continue;
        const newAmount = Math.max(15, Math.round(cand.it.amount * 0.85));
        const before = cand.it.amount;
        scaleItem(cand.it, newAmount);
        recalcMealTotals(meals);
        cut = true; break;
      }
      if (cut) continue;
    }
    const totals = sumTotals(meals);
    const dev = maxDevPct(totals as DayTargets, safeTargets);
    if (dev <= 3) break;
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
      // кандидаты: не-fixed, не-presleep/intra, сначала гибкие (не ядро), затем ядро
      type Cand = { mi: number; ii: number; it: CorrectorItem; per100: number; totalMacro: number };
      const cands: Cand[] = [];
      meals.forEach((m, mi) => {
        if (m.type === 'presleep' || m.type === 'intra') return;
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
        // реалистичный пол: белок 80/60, гарнир 50/30, иначе 14г каши — пустой рацион
        let floor = 15;
        if (cand.it.role === 'protein' || cand.it.role === 'fast_protein' || cand.it.role === 'slow_protein') {
          const mType = meals[cand.mi].type || '';
          const isMain = ['breakfast', 'lunch', 'dinner'].includes(mType);
          const food = FOOD_DB.find(f => f.id === cand.it.id);
          const isPowder = food?.category === 'supplement';
          floor = isPowder ? 20 : (isMain ? 80 : 60);
        } else if (cand.it.role === 'carb_slow' || cand.it.role === 'carb_fast') {
          const mType = meals[cand.mi].type || '';
          const isMain = ['breakfast', 'lunch', 'dinner'].includes(mType);
          floor = isMain ? 50 : 30;
        } else if (cand.it.role === 'fruit') {
          floor = 30;
        }
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
        if (m.type === 'presleep' || m.type === 'intra') return;
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
      const pool = poolFor(eff, opts?.excludedIds);
      if (pool.length === 0) break;
      // выбираем самый плотный по нужному макро
      const best = [...pool].sort((a, b) => {
        const av = eff === 'p' ? (a.protein || 0) / Math.max(1, a.kcal || 1) : eff === 'c' ? (a.carbs || 0) / Math.max(1, a.kcal || 1) : (a.fat || 0) / Math.max(1, a.kcal || 1);
        const bv = eff === 'p' ? (b.protein || 0) / Math.max(1, b.kcal || 1) : eff === 'c' ? (b.carbs || 0) / Math.max(1, b.kcal || 1) : (b.fat || 0) / Math.max(1, b.kcal || 1);
        return bv - av;
      })[0];
      const per100Best = eff === 'p' ? (best.protein || 0) : eff === 'c' ? (best.carbs || 0) : (best.fat || 0);
      if (per100Best <= 0) break;
      let grams = Math.max(20, Math.min(200, Math.round(need / per100Best * 100 / 10) * 10));
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
      if (grams < 10) break;
      // выбираем приём с минимальной долей ккал (недогруженный)
      let targetMeal = meals.filter(m => m.type !== 'presleep' && m.type !== 'intra' && m.type !== 'preworkout').reduce((a, b) => {
        const aShare = a.totals ? a.totals.kcal / Math.max(1, (a as any).target ? ((a as any).target.p * 4 + (a as any).target.c * 4 + (a as any).target.f * 9) : 500) : 0;
        const bShare = b.totals ? b.totals.kcal / Math.max(1, (b as any).target ? ((b as any).target.p * 4 + (b as any).target.c * 4 + (b as any).target.f * 9) : 500) : 0;
        return aShare <= bShare ? a : b;
      }, meals[0] || meals[meals.length - 1]);
      if (!targetMeal) targetMeal = meals[meals.length - 1];
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
