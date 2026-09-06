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
import { foodAvailableForPlan, stapleFamilyOf, isProteinPowderId, isPortableFood, isWorkWindowMeal, isHvStapleBanned, isBreakfastBannedCarb, isBreakfastBannedProtein, isBreakfastBannedFat, isHeavyAnimalFat, isSweetBaseId } from './food-availability';
// Порошок — не больше скупа (60 г) в одном пункте, иначе «изолят 186 г в перекусе».
// Универсально (не HV-гейт): таких порций не бывает и на обычных днях.
const POWDER_PORTION_CAP_G = 60;
// Маркер инсулин-окна (тип 'snack', закрыт для коррекций как peri). NB: проверять ТОЛЬКО
// маркер, а не isPeriLikeMeal(): старые гейты по типам разные в каждой ветке
// (swap скипает prew, cut — нет) и их расширение ломает peri-поведение.

export interface DayTargets { kcal: number; p: number; f: number; c: number; }
export interface CorrectorItem { id: string; name: string; amount: number; kcal: number; p: number; f: number; c: number; fiber?: number; leucine_mg?: number; role?: string; _fixedGrams?: number; }
export interface CorrectorMeal { label?: string; type?: string; time?: string; items: CorrectorItem[]; totals?: { kcal: number; p: number; f: number; c: number; fiber?: number }; recipeApplied?: string; recipeAppliedData?: { ingredientIds?: string[] }; recipeApplied2?: string; recipeAppliedData2?: { ingredientIds?: string[] }; }

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
 * P1a: проверка консистентности целей приёмов с целью дня. Таргет-гарды (не растим
 * закрытый приём) верны, только если цели суммируются в цель (рефид/инсулин-инфляция/
 * recipe-сборка могут давать stale-цели — тогда гарды душат сходимость).
 * Порог: угли ±15%, белок ±20% (доля peri/preSleep-окон и округлений).
 */
export function mealTargetsStale(meals: Array<any>, goalC: number, goalP: number): boolean {
  let sc = 0, sp = 0, n = 0;
  for (const m of meals || []) {
    const t = (m as any)?.target;
    if (!t || (typeof t.c !== 'number' && typeof t.p !== 'number')) continue;
    n++; sc += t.c || 0; sp += t.p || 0;
  }
  if (n === 0) return true;
  if (goalC > 0 && Math.abs(sc - goalC) / goalC > 0.15) return true;
  if (goalP > 0 && Math.abs(sp - goalP) / goalP > 0.20) return true;
  return false;
}

/**
 * P1a: адаптивный гейт улучшения для ДОБОРОВ (grow). Строгий (±5 п.п.) вблизи цели
 * (анти-чурн add/cut-пинг-понга), мягкий (±0.5 п.п.) при большом отклонении (>10 п.п.) —
 * иначе мелкие честные доборы отклоняются и день зависает в недоборе
 * (кейс рефид −20%: фикс +3% отклонялся гейтом). Своп/резка остаются строгими
 * (деструктивные операции требуют веского улучшения).
 */
function improveGate(beforeDev: number): number {
  return beforeDev > 0.10 ? 0.005 : 0.05;
}

/**
 * Пул носителей макроса. convenientCarbs=true (только рецептурный путь):
 * для углеводов — низкая клетчатка вместо низкого GI, иначе low-GI фильтр
 * систематически выбирает булгур/батат и отбрасывает рис/рисовый крем.
 * Legacy (products): поведение бит-идентично прежнему.
 */
function poolFor(macro: 'p' | 'c' | 'f', excludedIds?: Set<string>, convenientCarbs?: boolean, highCarb?: boolean): FoodItem[] {
  const ids = macro === 'p' ? TOPUP_PROTEIN_IDS : macro === 'c' ? TOPUP_CARB_IDS : TOPUP_FAT_IDS;
  let pool = ids.map(id => FOOD_DB.find(f => f.id === id)).filter((f): f is FoodItem => !!f && !(excludedIds && excludedIds.has(f.id)) && foodAvailableForPlan(f));
  // Жидкие peri-носители (декстроза/амилопектин/изотоник/сок) — НИКОГДА не добивка
  // обычных приёмов: только postw/intra/инсулин-окна (отдельные билдеры).
  // Иначе корректор кладёт «декстрозу на завтрак» при недоборе углей.
  if (macro === 'c') {
    pool = pool.filter(f => f.id !== 'dextrose' && f.id !== 'amylopectin' && f.id !== 'maltodextrin'
      && f.id !== 'vitargo' && f.id !== 'cyclic_dextrin' && f.id !== 'isotonic' && f.id !== 'drink_isotonic'
      && f.id !== 'orange_juice' && f.id !== 'isoton');
  }
  // v3: corn_flakes — только HV-добор (обычные дни: legacy-пул бит-идентичен).
  if (macro === 'c' && highCarb && !pool.some(f => f.id === 'corn_flakes') && !(excludedIds && excludedIds.has('corn_flakes'))) {
    const cf = FOOD_DB.find(f => f.id === 'corn_flakes');
    if (cf && foodAvailableForPlan(cf)) pool = [...pool, cf];
  }
  // HV-бан централизованно (перловка/гречка/киноа/батат/крахмал/мука — объём/ЖКТ).
  if (macro === 'c' && highCarb) pool = pool.filter(f => f.id !== 'buckwheat' && f.id !== 'bulgur' && f.id !== 'sweet_potato' && !isHvStapleBanned(f.id));
  if (macro === 'c' && pool.length >= 2) {
    if (convenientCarbs) {
      // HV: плотные comfort (пряники/джем) добирают угли без объёма тарелки.
      for (const hid of ['pryaniki', 'jam']) {
        if (!pool.some(p => p.id === hid) && !(excludedIds && excludedIds.has(hid))) {
          const hf = FOOD_DB.find(f => f.id === hid);
          if (hf && foodAvailableForPlan(hf)) pool.push(hf);
        }
      }
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
  opts?: { excludedIds?: Set<string>; allowCoreScale?: boolean; maxIter?: number; weightKg?: number; convenientCarbs?: boolean; highCarb?: boolean; portableMode?: boolean; isWorkDay?: boolean; workStartMin?: number; workEndMin?: number; anchorCarbIds?: string[]; lbmKg?: number; refeedDay?: boolean },
): { meals: CorrectorMeal[]; withinTolerance: boolean; deviationPct: number } {
  const maxIter = opts?.maxIter ?? 80;
  const weightKg = opts?.weightKg ?? 80;
  const conv = opts?.convenientCarbs === true;
  const hv = opts?.highCarb === true;
  // P1a: якоря дня (primary-гарниры lunch/dinner) — своп их не заменяет (масштабировать можно).
  const anchorSet: Set<string> | null = opts?.anchorCarbIds && opts.anchorCarbIds.length > 0 ? new Set(opts.anchorCarbIds) : null;
  // v3 portable: приём в рабочем окне получает только портативные добивки (хлопья/хлеб/фрукт/порошок).
  const pw = (m: { time?: string }): boolean => !!opts?.portableMode && !!opts?.isWorkDay && isWorkWindowMeal(m?.time, opts?.workStartMin, opts?.workEndMin);
  // Глобальный portable (режим «еда на работе» без привязки к смене: isWorkDay не задан) —
  // тогда портативными должны быть ВСЕ приёмы (зеркало _needPortable движка).
  const _needPortM = (m: { time?: string }): boolean => {
    if (!opts?.portableMode) return false;
    if (opts?.isWorkDay === undefined && opts?.workStartMin === undefined && opts?.workEndMin === undefined) return true;
    return pw(m);
  };
  const weightScaleCorr = Math.max(1, Math.min(1.6, weightKg / 80));
  const meals = cloneMeals(mealsIn);
  // Окна уколов locked: при их наличии посттрен для корректора — тоже фиксированное
  // окно (иначе корректор льёт/режет дозу-окно окружение и дедлочится с peri-стражей).
  // Без окон посттрен — обычный гибкий приём (как раньше).
  const _hasWins = meals.some((m: any) => (m as any)._insulinWindow);
  const _postLocked = (m: CorrectorMeal): boolean => _hasWins && m.type === 'postworkout';
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
  // P1a: stale-цели (рефид/инфляция) — таргет-гарды ниже отключаются, иначе душат сходимость.
  const _staleT = mealTargetsStale(meals, safeTargets.c, safeTargets.p);
  // P1a: рефид — HV-режим для гарнирных капов (520У нужно больше гарниров, чем 2/приём).
  // P1a: MPS-коридор для белковых доборов (тест F2: обед 48 г при LBM 73.8 — второе мясо
  // корректора выбивает приём за 0.62 г/кг). LBM опционально (engine передаёт lbmKg);
  // на ultraP-днях коридор невыполним — гард неактивен.
  const _lbmCorr = opts?.lbmKg && opts.lbmKg > 0 ? opts.lbmKg : 0;
  const _ultraPCorr = (safeTargets.p || 0) >= 350 || (safeTargets.p || 0) / Math.max(40, weightKg) >= 3.5;
  const _corrFull = (m: CorrectorMeal): boolean => _lbmCorr > 0 && !_ultraPCorr &&
    (m.type === 'breakfast' || m.type === 'lunch' || m.type === 'dinner') &&
    (m.totals?.p || 0) >= 0.62 * _lbmCorr;

  const maxCoreScale = opts?.allowCoreScale ? 1.30 : 1.20;
  let _dbgN = 0;
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
    try { if ((globalThis as any).__DBG_CORR && _dbgN++ < 14) console.log(`[DBG-C] it=${iter} dev=${dev.toFixed(1)} dK=${Math.round(safeTargets.kcal - totals.kcal)} dP=${(safeTargets.p - totals.p).toFixed(0)} dF=${(safeTargets.f - totals.f).toFixed(0)} dC=${(safeTargets.c - totals.c).toFixed(0)}`); } catch {}
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
        const underPool = poolFor(under, opts?.excludedIds, conv, hv).filter(f => needFor(f) > 0);
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
            if (m.type === 'presleep' || m.type === 'intra' || m.type === 'preworkout' || _postLocked(m) || (m as any)._insulinWindow) return;
            // v3 portable: не-портативной заменой рабочее окно не трогаем (суп в офис — нет).
            if (_needPortM(m) && !isPortableFood(bestU as any)) return;
            // P1a: своп В завтрак — только завтрашними продуктами (иначе замена жирового
            // пункта кладёт «батат 190 г в завтрак» в обход всех carb-гейтов).
            if (m.type === 'breakfast') {
              const _bu = bestU as FoodItem;
              if ((under === 'c' && isBreakfastBannedCarb(_bu.id)) ||
                (under === 'p' && isBreakfastBannedProtein(_bu.id)) ||
                (under === 'f' && isBreakfastBannedFat(_bu.id))) return;
            }
            (m.items || []).forEach((it, ii) => {
              if ((it as any)._fixedGrams) return;
              if (isCoreRecipeItem(m, it.id)) return;
              // P1a: своп в самого себя — пропуск (иначе «посттрен крем 100 → крем 100» ×5
              // сжигает итерации вхолостую).
              if (it.id === bestU.id) return;
              // P1a: гарнир завтрака не свопаем (курируемая oatFamily-типология; паритет
              // с DENSITY-SWAP, который завтрак скипает целиком — иначе «овсянка → батат»).
              // P1a: якоря дня не свопаем (курированный primary lunch/dinner; их можно
              // масштабировать CUT/GROW, но не заменять другим носителем).
              if ((it.role === 'carb_slow' || it.role === 'carb_fast') &&
                (m.type === 'breakfast' || (anchorSet && anchorSet.has(it.id)))) return;
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
            let swapG = Math.max(20, Math.round(freedKcal / Math.max(1, bestU.kcal || 1) * 100 / 10) * 10);
            // Порошок свопом — не больше скупа (иначе «курица 300 г → изолят 186 г»).
            // Универсально: плотный порошок превращает любое освобождённое ккал в ведро.
            if (isProteinPowderId(bestU.id)) swapG = Math.min(swapG, POWDER_PORTION_CAP_G);
            // Углевод свопом — не больше съедобной порции 250 г ВСЕГДА (раньше кап был только
            // при ≥30У/100 — низкоплотные (батат ~20У) его обходили: «овсянка 143 г → батат 590 г»).
            if (under === 'c') swapG = Math.min(swapG, 250);
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
    // DENSITY-SWAP: чистый недобор углей без переборов (бедному свопу нечего чинить) —
    // меняем низкоплотный гарнир (>100 г, <35У/100: фунчоза, картофель) на плотный
    // (крем/хлопья/рис ≥45У/100) в ккал-паритете: та же тарелка по весу, больше углей.
    // Кейс MC3 (3 приёма, 470У): обед-фунчоза 325 г не даёт закрыть день.
    {
      const _dC = safeTargets.c - totals.c;
      const _hasOver = (safeTargets.p - totals.p) < -5 || (safeTargets.f - totals.f) < -2 || (safeTargets.c - totals.c) < -5;
        if (_dC > 30 && !_hasOver) {
        const _pool = poolFor('c', opts?.excludedIds, conv, hv).filter(f => (f.carbs || 0) >= 45);
        if (_pool.length > 0) {
          let _vMi = -1, _vIi = -1;
          let _vWorst = 0;
          meals.forEach((m, mi) => {
            if (m.type === 'presleep' || m.type === 'intra' || m.type === 'preworkout' || m.type === 'postworkout' || (m as any)._insulinWindow) return;
            // Завтрак не трогаем (курируемая oatFamily-логика + D1-шаблоны:
            // иначе «овсянка» завтрака меняется на крем — регресс D1).
            if (m.type === 'breakfast') return;
            (m.items || []).forEach((it, ii) => {
              if ((it as any)._fixedGrams) return;
              if (isCoreRecipeItem(m, it.id)) return;
              // P1a: якоря дня DENSITY-SWAP не трогает (якорь поставил primary-проход
              // осознанно; иначе якорь и своп дерутся — чурн сходимости).
              if (anchorSet && anchorSet.has(it.id)) return;
              if (it.role !== 'carb_slow' && it.role !== 'carb_fast') return;
              const _fd = FOOD_DB.find(f => f.id === it.id);
              const _den = _fd ? (_fd.carbs || 0) : 0;
              if (_den >= 35 || (it.amount || 0) < 100) return;
              if ((m.type === 'breakfast' || /Завтрак/i.test(m.label || '')) && _pool.every(f => isBreakfastBannedCarb(f.id))) return;
              const _w = (it.amount || 0) * (35 - _den);
              if (_w > _vWorst) { _vWorst = _w; _vMi = mi; _vIi = ii; }
            });
          });
          if (_vMi >= 0) {
            const _vic = meals[_vMi].items[_vIi];
            const _m = meals[_vMi];
            const _isBf = _m.type === 'breakfast' || /Завтрак/i.test(_m.label || '');
            // Portable-режим: не-портативной заменой рабочее окно не трогаем
            // (иначе фунчоза в офис — регресс D-28 portable).
            const _altsAll = _pool.filter(f => f.id !== _vic.id && !(_isBf && isBreakfastBannedCarb(f.id)));
            const _alts = (_needPortM(_m) ? _altsAll.filter(f => isPortableFood(f as any)) : _altsAll);
            if (_alts.length === 0) {
              // В рабочее окно нечего поставить из портативного — пропускаем блок,
              // а не весь цикл (иначе одна рабочая тарелка стопарит весь корректор).
            } else {
            // Сахарный потолок дня уважаем и здесь.
            const _sIds = new Set(['honey', 'jam', 'marmalade', 'zefir', 'pastila', 'pryaniki', 'sushki', 'sugar_cookies', 'dates', 'dates_dried', 'raisins', 'dried_apricots', 'dried_apple_rings', 'fruit_date_medjool', 'prunes', 'dried_pineapple', 'dried_mango', 'dried_cranberry', 'dried_blueberry', 'dried_kiwi', 'dried_pear', 'dried_peach', 'dried_banana_chips']);
            const _sNow = meals.flatMap(mm => mm.items || []).filter(x => _sIds.has(x.id)).reduce((s, x) => s + (x.c || 0), 0);
            const _sCap = safeTargets.c >= 1300 ? 0.25 : safeTargets.c >= 1000 ? 0.20 : 0.15;
            const _sugarFull = _sNow >= safeTargets.c * _sCap;
            const _best = [..._alts.filter(f => !_sugarFull || !_sIds.has(f.id))]
              .sort((a, b) => (b.carbs || 0) / Math.max(1, b.kcal || 1) - (a.carbs || 0) / Math.max(1, a.kcal || 1))[0];
            if (_best) {
              const _g = Math.max(30, Math.min(250, Math.round((_vic.kcal || 0) / Math.max(1, _best.kcal || 1) * 100 / 10) * 10));
              const _before = sumTotals(meals);
              const _beforeDev = maxDevPct(_before as DayTargets, safeTargets);
              const _nit: CorrectorItem = {
                id: _best.id, name: _best.name, amount: _g,
                kcal: Math.round((_best.kcal || 0) * _g / 100),
                p: Math.round((_best.protein || 0) * _g / 100 * 10) / 10,
                f: Math.round((_best.fat || 0) * _g / 100 * 10) / 10,
                c: Math.round((_best.carbs || 0) * _g / 100 * 10) / 10,
                fiber: Math.round((_best.fiber || 0) * _g / 100 * 10) / 10,
                role: 'carb_slow',
              } as any;
              _nit.kcal = Math.round(4 * _nit.p + 9 * _nit.f + 4 * _nit.c);
              meals[_vMi].items[_vIi] = _nit;
              recalcMealTotals(meals);
              const _after = sumTotals(meals);
              const _afterDev = maxDevPct(_after as DayTargets, safeTargets);
              if (_afterDev < _beforeDev - 0.05) continue;
              meals[_vMi].items[_vIi] = _vic;
              recalcMealTotals(meals);
            }
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
        // P1a: peri-окна (pre/post) НЕ режем вообще (фиксированные бюджеты; пол CUT 30 г
        // срезал предтрен-пасту 222→34 г, а GROW peri не восстанавливает — асимметрия
        // давала вечный недобор peri. Зеркало GROW-гейта выше). Перебор peri чистят
        // peri-капы (_periGuard/trimPeriCarbs), а не CUT.
        if (m.type === 'presleep' || m.type === 'intra' || m.type === 'preworkout' || m.type === 'postworkout' || (m as any)._insulinWindow) return;
        // P1a: белок peri-окон не режем вообще (фиксированные бюджеты periProteinBudget;
        // восстановить некому — все доборы peri скипают; тест пери-окна 0.45 г/кг).
        // Жиры/угли peri режем как раньше (у них свои капы окон).
        const _periProt = eff === 'p' && (m.type === 'preworkout' || m.type === 'postworkout');
        if (_dayUnderKcal && (m.totals?.kcal || 0) < 250) return;
        (m.items || []).forEach((it, ii) => {
          if ((it as any)._fixedGrams) return;
          if ((it.amount || 0) < 15) return;
          if (_periProt && (it.role === 'protein' || it.role === 'fast_protein' || it.role === 'slow_protein')) return;
          // convenient: единственный белковый пункт перекуса не режем — иначе снек
          // остаётся без белка на голодном дне (R-1500: перекус с яйцом 50 г → без).
          // (Паритет с защитой swap от съедения единственного белка приёма.)
          if (conv && (it.role === 'protein' || it.role === 'fast_protein' || it.role === 'slow_protein')
            && String(m.type || '').startsWith('snack')) {
            const _pc = (m.items || []).filter(x => x.role === 'protein' || x.role === 'fast_protein' || x.role === 'slow_protein').length;
            if (_pc <= 1) return;
          }
          const food = FOOD_DB.find(f => f.id === it.id);
          const per100 = food ? (eff === 'p' ? (food.protein || 0) : eff === 'c' ? (food.carbs || 0) : (food.fat || 0)) : (eff === 'p' ? it.p : eff === 'c' ? it.c : it.f) / Math.max(1, it.amount) * 100;
          if (per100 <= 0) return;
          // для жира — режем жирные продукты, для углей — углеводные и т.д.
          cands.push({ mi, ii, it, per100, totalMacro: (it.amount || 0) * per100 / 100 });
        });
      });
      if (cands.length === 0) break;
      // приоритет: гибкие (не ядро) выше; при голодном дне (convenient) — сначала
      // БОЛЬШИЕ приёмы (маленькие снеки не выедаем: «перекус с яйцом» живёт);
      // внутри — больше макро на порцию.
      cands.sort((a, b) => {
        const aCore = isCoreRecipeItem(meals[a.mi], a.it.id) ? 1 : 0;
        const bCore = isCoreRecipeItem(meals[b.mi], b.it.id) ? 1 : 0;
        if (aCore !== bCore) return aCore - bCore;
        if (_dayUnderKcal) {
          const ak = meals[a.mi].totals?.kcal || 0, bk = meals[b.mi].totals?.kcal || 0;
          if (bk !== ak) return bk - ak;
        }
        return b.totalMacro - a.totalMacro;
      });
      let improved = false;
      for (const cand of cands) {
        // P1a: MPS-коридор — белок в полном приёме не растим (тест F2).
        if (eff === 'p' && _corrFull(meals[cand.mi])) continue;
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
      // P1a: не растим гарнир в приёме, уже закрывшем углеводную цель (+15 г запас):
      // иначе «макароны 269 г в лёгком ужине» при цели 30 г (eveningLowCarb-тест).
      // Если все приёмы закрыты — legacy-порядок (сходимость не блокируем).
      // Stale-цели (рефид/инфляция) — гард отключён.
      let _growList = cands;
      if (eff === 'c' && !_staleT) {
        const _roomy = cands.filter(c => {
          const _tc = (meals[c.mi] as any).target?.c;
          if (!(_tc > 0)) return true;
          const _mc = (meals[c.mi].items || []).filter((x: any) => x.role === 'carb_slow' || x.role === 'carb_fast').reduce((s: number, x: any) => s + (x.c || 0), 0);
          return _mc < _tc + 15;
        });
        if (_roomy.length > 0) _growList = _roomy;
      }
      // P1a: белок — не доливаем приём выше его цели +8 (низкобелковые дни: иначе добор
      // переливает сытые приёмы поверх сведённого дня; тест белка ±5%).
      // Stale-цели — гард отключён.
      if (eff === 'p' && !_staleT) {
        const _roomyP = _growList.filter(c => {
          const _tp = (meals[c.mi] as any).target?.p;
          if (!(_tp > 0)) return true;
          return ((meals[c.mi] as any).totals?.p || 0) < _tp + 8;
        });
        if (_roomyP.length > 0) _growList = _roomyP;
      }
      let done = false;
      // пробуем нарастить первый подходящий
      for (const cand of _growList) {
        if (eff === 'p' && _corrFull(meals[cand.mi])) continue;
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
          honey: 40, raisins: 60, dates_dried: 60, dates: 60, dried_apricots: 60, fruit_date_medjool: 60, prunes: 60,
          dried_pineapple: 60, dried_mango: 60, dried_cranberry: 60, dried_blueberry: 60, dried_kiwi: 60, dried_pear: 60, dried_peach: 60, dried_banana_chips: 40,
          pryaniki: 80, jam: 55, zefir: 50, pastila: 50, sushki: 40, sugar_cookies: 40, marmalade: 35,
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
        // Порошок растим только до скупа (60 г) — дальше новый приём/носитель.
        if (isProteinPowderId(cand.it.id) && newAmount > POWDER_PORTION_CAP_G) continue;
        // капы: белок ≤300, фрукт ≤150, клетчатка ≤10, общие ≤600, порошок ≤60
        // P1a: фунчоза/стеклянная лапша — сайд ≤100 г (типология), иначе рост даёт ведро 400 г.
        let cap = 600;
        if (/glass|funchose|rice_noodles/.test(cand.it.id)) cap = 100;
        const isFiberSuppCap = candFood && candFood.category === 'supplement' && (candFood.fiber || 0) >= 30;
        if (isFiberSuppCap) cap = 10;
        else if (isProteinPowderId(cand.it.id)) cap = POWDER_PORTION_CAP_G;
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
        if (afterDev < beforeDev - improveGate(beforeDev)) { done = true; break; }
        scaleItem(cand.it, prevAmount);
        if (isCore) coreScale.set(key, curScale);
        recalcMealTotals(meals);
      }
      if (done) continue;
      // 2) не нашли куда нарастить — добавляем новый item из пула
      let pool = poolFor(eff, opts?.excludedIds, conv, hv);
      // Сахарный потолок дня — скользящий: 15% база, 20% при ≥1000У, 25% при ≥1300У.
      // Интернет-практика высокоуровневых дней (рис/крем + мёд/джем/финики/сок):
      // 1500У из одних круп — 190У/приём сверх сухих капов, без сахара не закрыть.
      // Декстроза/сок — peri, не в счёт.
      if (eff === 'c') {
        const _sugarIds = new Set(['honey', 'jam', 'marmalade', 'zefir', 'pastila', 'pryaniki', 'sushki', 'sugar_cookies', 'dates', 'dates_dried', 'raisins', 'dried_apricots', 'dried_apple_rings', 'fruit_date_medjool', 'prunes', 'dried_pineapple', 'dried_mango', 'dried_cranberry', 'dried_blueberry', 'dried_kiwi', 'dried_pear', 'dried_peach', 'dried_banana_chips']);
        const _sugarNow = meals.flatMap(m => m.items || []).filter(it => _sugarIds.has(it.id)).reduce((s, it) => s + (it.c || 0), 0);
        const _sugarCap = (safeTargets.c || 0) >= 1300 ? 0.25 : (safeTargets.c || 0) >= 1000 ? 0.20 : 0.15;
        if (_sugarNow >= (safeTargets.c || 0) * _sugarCap) {
          const _realOnly = pool.filter(f => !_sugarIds.has(f.id));
          if (_realOnly.length > 0) pool = _realOnly;
        }
      }
      if (pool.length === 0) break;
      // выбираем самый плотный по нужному макро; для углеводов в convenient-режиме —
      // сначала удобство (низкая клетчатка): иначе «макрос/ккал» вечно выигрывает батат (20У при 86 ккал).
      // Порошок, забитый до скупа ВО ВСЕХ годных приёмах, пропускаем к следующему
      // носителю (иначе «изолят 60 + 126 = 186» в ветке роста ниже и дедлок топ-апа).
      const _eligibleTypes = (m: CorrectorMeal) => m.type !== 'presleep' && m.type !== 'intra' && m.type !== 'preworkout' && !_postLocked(m) && !(m as any)._insulinWindow;
      const _sortedPool = [...pool].sort((a, b) => {
        if (conv && eff === 'c') {
          const ca = (a.carbs || 0) / (1 + (a.fiber || 0) * 2);
          const cb = (b.carbs || 0) / (1 + (b.fiber || 0) * 2);
          if (Math.abs(ca - cb) > 0.5) return cb - ca;
        }
        const av = eff === 'p' ? (a.protein || 0) / Math.max(1, a.kcal || 1) : eff === 'c' ? (a.carbs || 0) / Math.max(1, a.kcal || 1) : (a.fat || 0) / Math.max(1, a.kcal || 1);
        const bv = eff === 'p' ? (b.protein || 0) / Math.max(1, b.kcal || 1) : eff === 'c' ? (b.carbs || 0) / Math.max(1, b.kcal || 1) : (b.fat || 0) / Math.max(1, b.kcal || 1);
        return bv - av;
      });
      let best: FoodItem | undefined;
      // P1a: единый счётчик добивок — углеводный носитель, уже стоявший в 2 приёмах дня,
      // пропускаем (иначе корректор кладёт 3-й крем поверх primary+хвоста). На ВСЕХ днях
      // (раньше только HV — фунчоза дублировалась в обед и ужин). Если все по 2 —
      // наименее использованный, а не первый пула.
      const _dayUses = (id: string): number => meals.reduce((s, m) => s + (m.items || []).filter(it => it.id === id && ((it as any).role === 'carb_slow' || (it as any).role === 'carb_fast')).length, 0);
      const _leastUsedFirst = (arr: FoodItem[]): FoodItem[] => {
        let _min = Infinity;
        for (const f of arr) _min = Math.min(_min, _dayUses(f.id));
        const _least = arr.filter(f => _dayUses(f.id) <= _min);
        return _least.length > 0 ? _least : arr;
      };
      const _freshSorted = _sortedPool.filter(c => {
        if (eff !== 'c') return true;
        const _u = _dayUses(c.id);
        if (_u === 0) return true;
        if (_u >= (anchorSet && anchorSet.has(c.id) ? 3 : 2)) return false;
        // P1a: повтор — только lean-носители (Б<8/100): иначе ротация ради новизны
        // тащит белковые крупы (овёс/булгур/ржанка/хлеб 9-13Б) вместо повторного риса,
        // и день перебирает белок скрытыми +15-30 г (кейс HV900 +13%).
        return (c.protein || 0) < 8;
      });
      const _candIter = (_freshSorted.length > 0 ? _freshSorted : _leastUsedFirst(_sortedPool));
      for (const cand of _candIter) {
        if (isProteinPowderId(cand.id)) {
          const _roomAny = meals.some(m => {
            if (!_eligibleTypes(m)) return false;
            const ex = m.items.find(it => it.id === cand.id);
            if (ex && (ex as any)._fixedGrams) return false;
            return (ex ? ex.amount : 0) < POWDER_PORTION_CAP_G;
          });
          if (!_roomAny) continue;
          // Порошковые приёмы: норма — 2/день, ultraP-коктейли — до 4.
          const _up = safeTargets.p >= 350 || safeTargets.p / Math.max(40, weightKg) >= 3.5;
          const _pmCnt = meals.filter(m => (m.items || []).some(it => isProteinPowderId(it.id))).length;
          if (_pmCnt >= (_up ? 4 : 2)) continue;
        }
        best = cand;
        break;
      }
      if (!best) break;
      let per100Best = eff === 'p' ? (best.protein || 0) : eff === 'c' ? (best.carbs || 0) : (best.fat || 0);
      if (per100Best <= 0) break;
      // «Комфортные» доборки (хлеб/мёд/сухофрукты) — дегустационные капы и ЗАПРЕТ дубля
      // в одном приёме (иначе «Финики 180г + Финики 70г» в обеде).
      const COMFORT_CAP: Record<string, number> = {
        honey: 40, raisins: 60, dates_dried: 60, dates: 60, dried_apricots: 60, prunes: 60,
        dried_pineapple: 60, dried_mango: 60, dried_cranberry: 60, dried_blueberry: 60, dried_kiwi: 60, dried_pear: 60, dried_peach: 60, dried_banana_chips: 40,
        pryaniki: 80, jam: 55, zefir: 50, pastila: 50, sushki: 40, sugar_cookies: 40, marmalade: 35,
        bread_white: 100, bread_rye: 100, bread_borodinsky: 100, bread_fitness: 100, whole_grain_bread: 100,
        // PRO: шиповник/облепиха — вит-C бомба (80г = 2371мг > UL 2000). Кап 30г на добор.
        fruit_rosehip: 30, sea_buckthorn: 30, acerola: 30, blackcurrant: 60,
        // PRO: фунчоза — только сайд ≤100г, никогда ведром.
        pasta_glass_noodles: 100, glass_noodles: 100, rice_noodles: 120,
      };
      let grams = Math.max(20, Math.min(200, Math.round(need / per100Best * 100 / 10) * 10));
      if (COMFORT_CAP[best.id] !== undefined) grams = Math.min(grams, COMFORT_CAP[best.id]);
      // Сухие плотные крупы (крем риса 82У, хлопья 80У, oats_dry 60У) — потолок 150 г
      // за добавку, ТОЛЬКО HV: иначе корректор растит «крем 250 г» поверх primary 150 г
      // (ведро 400 г). На обычных днях — legacy 200 (иначе 3-приёмные дни не сходятся).
      if (hv && eff === 'c' && (best.carbs || 0) >= 55 && COMFORT_CAP[best.id] === undefined) grams = Math.min(grams, 150);
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
      // Порошок — не больше скупа новым пунктом (иначе «изолят 150 г» за раз).
      if (isProteinPowderId(best.id)) grams = Math.min(grams, POWDER_PORTION_CAP_G);
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
      const _dupFilter = (m: CorrectorMeal) => conv ? !m.items.some(it => it.id === best!.id) : (COMFORT_CAP[best!.id] === undefined || !m.items.some(it => it.id === best!.id));
      const _freeMeals = meals.filter(m => m.type !== 'presleep' && m.type !== 'intra' && m.type !== 'preworkout' && !_postLocked(m) && !(m as any)._insulinWindow)
        .filter(_dupFilter)
        // P1a: MPS-коридор — новый белок не кладём в полный приём (тест F2: второе мясо
        // корректора выбивало обед за 0.62 г/кг; недобор закроют другие приёмы).
        .filter(m => eff !== 'p' || !_corrFull(m));
      // Защита от «завтрака на 2500 ккал»: в уже тяжёлый приём (≥1000 ккал)
      // добивку не льём, пока есть недогруженные альтернативы.
      const _lightFree = _freeMeals.filter(m => (m.totals?.kcal || 0) < 1000);
      let _pickFrom = _lightFree.length > 0 ? _lightFree : _freeMeals;
      // Лимит 2 гарнира/приём — ТОЛЬКО HV (на обычных днях 3-й гарнир иногда нужен:
      // 3 приёма × 157У двумя гарнирами при пуловых ограничениях не закрыть).
      // Завтрак-бан: лапшу/батат/перловку в завтрак не льём (все дни).
      // Aug-28 гейт: второй гарнир — только в БОЛЬШОЙ приём (target.c ≥ 100);
      // умеренный обед (~95У) держит один крупяной источник, иначе «гречка+рис».
      if (eff === 'c' && best) {
        const _roomy = _pickFrom.filter(m => {
          const _carbs = (m.items || []).filter(it => it.role === 'carb_slow' || it.role === 'carb_fast').length;
          // P1a: 2 гарнира — потолок (третий — мусор). Было только HV; расширено на дни
          // с ≥5 приёмами (там 2/приём хватает; HV и рефид — потолок 3). Дни ≤4 приёмов —
          // legacy (3-приёмные дни иначе не сходятся: MC3-обед с 3 гарнирами — крайний кейс,
          // честно помечен нотой «добавьте приём»).
          const _capHv = hv || !!opts?.refeedDay;
          const _capC = _capHv ? 3 : 2;
          if (_carbs >= _capC && !m.items.some(it => it.id === (best as FoodItem).id) && (_capHv || meals.length >= 5)) return false;
          if ((m.type === 'breakfast' || /Завтрак/i.test(m.label || '')) && isBreakfastBannedCarb((best as FoodItem).id)) return false;
          if (_carbs >= 1 && !m.items.some(it => it.id === (best as FoodItem).id) && ((m as any).target?.c || 0) < 100) return false;
          // PRO-типология: сладость — не добивка в основные приёмы (печенье в обед — мусор).
          // Сладости живут только в перекусах мелким топ-апом.
          if (isSweetBaseId((best as FoodItem).id) && (m.type === 'breakfast' || m.type === 'lunch' || m.type === 'dinner')) return false;
          return true;
        });
        if (_roomy.length > 0) _pickFrom = _roomy;
      }
      // PRO-типология корректора (все дни): мясо в завтрак — нет; масла в завтрак — нет;
      // сало ложкой — никуда. Второе мясо в корректоре РАЗРЕШАЕМ (малый добор 30-60г —
      // реальная готовка); крупное второе мясо (треска+креветки ведром) чистит финальный
      // проход HV (с компенсацией первого). Блок второго мяса ломал сходимость белка 25%.
      if (best) {
        const _b = best as FoodItem;
        _pickFrom = _pickFrom.filter(m => {
          const _isBf = m.type === 'breakfast' || /Завтрак/i.test(m.label || '');
          if (_isBf && eff === 'p' && isBreakfastBannedProtein(_b.id)) return false;
          if (_isBf && eff === 'f' && isBreakfastBannedFat(_b.id)) return false;
          if (isHeavyAnimalFat(_b.id)) return false;
          return true;
        });
        if (_pickFrom.length === 0) break;
      }
      let targetMeal: CorrectorMeal | undefined;
      if (_pickFrom.length > 0) {
        targetMeal = _pickFrom.reduce((a, b) => {
          const aShare = a.totals ? a.totals.kcal / Math.max(1, (a as any).target ? ((a as any).target.p * 4 + (a as any).target.c * 4 + (a as any).target.f * 9) : 500) : 0;
          const bShare = b.totals ? b.totals.kcal / Math.max(1, (b as any).target ? ((b as any).target.p * 4 + (b as any).target.c * 4 + (b as any).target.f * 9) : 500) : 0;
          return aShare <= bShare ? a : b;
        });
      }
      // v3 portable: в рабочее окно — только портативное. Сначала уводим добивку в
      // не-рабочий приём; если все свободные — рабочие, берём портативную альтернативу.
      if (targetMeal && _needPortM(targetMeal) && best && !isPortableFood(best as any)) {
        const _nonWork = _freeMeals.filter(m => !_needPortM(m));
        if (_nonWork.length > 0) {
          targetMeal = _nonWork.reduce((a, b) => {
            const aShare = a.totals ? a.totals.kcal / Math.max(1, (a as any).target ? ((a as any).target.p * 4 + (a as any).target.c * 4 + (a as any).target.f * 9) : 500) : 0;
            const bShare = b.totals ? b.totals.kcal / Math.max(1, (b as any).target ? ((b as any).target.p * 4 + (b as any).target.c * 4 + (b as any).target.f * 9) : 500) : 0;
            return aShare <= bShare ? a : b;
          });
        } else {
          const _macroOf = (f: FoodItem) => eff === 'p' ? (f.protein || 0) : eff === 'c' ? (f.carbs || 0) : (f.fat || 0);
          const _alt = _sortedPool.find(c => c.id !== best!.id && isPortableFood(c as any) && _macroOf(c) > 0 && !targetMeal!.items.some(it => it.id === c.id));
          if (!_alt) break;
          best = _alt;
          // Пересчёт граммовки под альтернативу (те же капы, что выше для best).
          per100Best = _macroOf(_alt);
          if (per100Best <= 0) break;
          grams = Math.max(20, Math.min(200, Math.round(need / per100Best * 100 / 10) * 10));
          if (COMFORT_CAP[best.id] !== undefined) grams = Math.min(grams, COMFORT_CAP[best.id]);
          if (isProteinPowderId(best.id)) grams = Math.min(grams, POWDER_PORTION_CAP_G);
          {
            const _curMacro = eff === 'p' ? sumTotals(meals).p : eff === 'c' ? sumTotals(meals).c : sumTotals(meals).f;
            const _maxMacro = (eff === 'p' ? safeTargets.p : eff === 'c' ? safeTargets.c : safeTargets.f) * 1.03;
            const _over = _curMacro + per100Best * grams / 100 - _maxMacro;
            if (_over > 0) grams = Math.max(0, grams - Math.ceil(_over / per100Best * 100 / 10) * 10);
          }
          if (grams < (conv ? 20 : 10)) break;
        }
      }
      if (!targetMeal) {
        // все приёмы уже содержат best.id — растим самый недогруженный из них.
        // Кап итога обязателен: иначе «изолят 60 + 126 = 186» (500Б-проба).
        const withBest = meals.filter(m => m.type !== 'presleep' && m.type !== 'intra' && m.type !== 'preworkout' && !_postLocked(m) && !(m as any)._insulinWindow && m.items.some(it => it.id === best.id));
        targetMeal = withBest.length > 0 ? withBest.reduce((a, b) => ((a.totals?.kcal || 0) <= (b.totals?.kcal || 0) ? a : b)) : meals[meals.length - 1];
        const ex = targetMeal.items.find(it => it.id === best.id);
        if (ex && !(ex as any)._fixedGrams) {
          const _isDryCarb = hv && eff === 'c' && (best.carbs || 0) >= 55 && COMFORT_CAP[best.id] === undefined;
          const _growCap = COMFORT_CAP[best.id] !== undefined ? COMFORT_CAP[best.id]
            : isProteinPowderId(best.id) ? POWDER_PORTION_CAP_G
            : _isDryCarb ? 150
            : (ex.role === 'protein' || ex.role === 'fast_protein' || ex.role === 'slow_protein') ? 300
            : (conv && (ex.role === 'carb_slow' || ex.role === 'carb_fast')) ? 350 : 600;
          const _growRoom = Math.max(0, _growCap - ex.amount);
          if (_growRoom < 10) break;
          grams = Math.min(grams, _growRoom);
          const beforeTotals = sumTotals(meals);
          const beforeDev = maxDevPct(beforeTotals as DayTargets, safeTargets);
          const prevAmount = ex.amount;
          scaleItem(ex, ex.amount + grams);
          recalcMealTotals(meals);
          const afterTotals = sumTotals(meals);
          const afterDev = maxDevPct(afterTotals as DayTargets, safeTargets);
          if (afterDev < beforeDev - improveGate(beforeDev)) continue;
          scaleItem(ex, prevAmount);
          recalcMealTotals(meals);
        }
        break;
      }
      const role: string = eff === 'p' ? 'protein' : eff === 'c' ? 'carb_slow' : 'fat';
      // D-28 П6: белок приёма — не больше 60 г (нет сливания всего дневного белка
      // в один приём). На ultraP-днях (≥350 г/д) кап не действует (коктейльный режим).
      // Без комнаты — не break, а выбор другого приёма (иначе стопорим весь добор).
      if (eff === 'p' && targetMeal && !(safeTargets.p >= 350 || safeTargets.p / Math.max(40, weightKg) >= 3.5)) {
        const _roomOf = (m: CorrectorMeal): number => 60 - m.items
          .filter(x => x.role === 'protein' || x.role === 'fast_protein' || x.role === 'slow_protein')
          .reduce((s, x) => s + (x.p || 0), 0);
        if (_roomOf(targetMeal) < 10) {
          const _altP = _pickFrom.filter(m => m !== targetMeal && _roomOf(m) >= 10)
            .sort((a, b) => {
              const aShare = a.totals ? a.totals.kcal / Math.max(1, (a as any).target ? ((a as any).target.p * 4 + (a as any).target.c * 4 + (a as any).target.f * 9) : 500) : 0;
              const bShare = b.totals ? b.totals.kcal / Math.max(1, (b as any).target ? ((b as any).target.p * 4 + (b as any).target.c * 4 + (b as any).target.f * 9) : 500) : 0;
              return aShare - bShare;
            })[0];
          if (!_altP) break;
          targetMeal = _altP;
        }
        const _roomP = _roomOf(targetMeal);
        const _maxByRoom = Math.floor(_roomP / Math.max(1, per100Best) * 100 / 10) * 10;
        if (_maxByRoom < 10) break;
        grams = Math.min(grams, _maxByRoom);
      }
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
        // Кап слияния: комфортные — дегустационный кап, порошок — скуп (60 г),
        // сухие крупы — 150 г (только HV), остальные — 600 г.
        const _mergeCap = COMFORT_CAP[newItem.id] !== undefined ? COMFORT_CAP[newItem.id]
          : isProteinPowderId(newItem.id) ? POWDER_PORTION_CAP_G
          : (hv && eff === 'c' && (best.carbs || 0) >= 55) ? 150 : 600;
        if (_dup.amount + newItem.amount > _mergeCap) break;
        scaleItem(_dup, _dup.amount + newItem.amount);
        recalcMealTotals(meals);
        const afterTotals = sumTotals(meals);
        const afterDev = maxDevPct(afterTotals as DayTargets, safeTargets);
        if (afterDev < beforeDev - improveGate(beforeDev)) continue;
        scaleItem(_dup, _prev);
        recalcMealTotals(meals);
        break;
      }
      targetMeal.items.push(newItem);
      recalcMealTotals(meals);
      const afterTotals = sumTotals(meals);
      const afterDev = maxDevPct(afterTotals as DayTargets, safeTargets);
      if (afterDev >= beforeDev - improveGate(beforeDev)) {
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
