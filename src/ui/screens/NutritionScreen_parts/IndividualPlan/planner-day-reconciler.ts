/**
 * planner-day-reconciler.ts — E0 (PRO-план §3): финальный пасс сходимости
 * продуктового дня. По образцу `planner-recipe-optimizer.ts` (MIGP-lite), но на
 * ПОРЦИЯХ отдельных пунктов flex-приёмов, а не шагах рецепта.
 *
 * Задача: после всех писателей движка минимизировать максимальное относительное
 * отклонение дня по 4 макросам (ккал/Б/Ж/У), двигая порции на дискретной сетке.
 * Не добавляет/не удаляет пункты, не меняет их вид — только граммы. Защищены
 * peri-окна уколов, добавки/жидкости/овощи/фрукты; цельный белок основных
 * приёмов не уходит ниже стража реалистичности (75 г по умолчанию).
 *
 * Чистая функция: не знает FOOD_DB; снап-функция порций передаётся снаружи
 * (по умолчанию — грубая сетка 5 г). Ничего не мутирует (работает по копиям).
 */

export interface ReconItem {
  id: string;
  role?: string;
  amount: number;
  kcal: number;
  p: number;
  f: number;
  c: number;
  fiber?: number;
  leucine_mg?: number;
  _fixedGrams?: boolean;
  [k: string]: any;
}
export interface ReconMeal {
  label?: string;
  type?: string;
  items: ReconItem[];
  _insulinWindow?: boolean;
  [k: string]: any;
}
export interface ReconTargets { kcal: number; p: number; f: number; c: number; }
export interface ReconOptions {
  /** Приёмы, которые НЕ трогаем (peri/intra — физиология окна). */
  protectTypes?: string[];
  /** Снап граммов к человеческой/продуктовой сетке. */
  snap?: (item: ReconItem, grams: number) => number;
  /** Нижний страж цельного белка основного приёма (реализм). 0 = без стража. */
  mainProteinFloor?: number;
  /** Верхний предел белка одного приёма (г) при росте белка (напр. ≤60 г). */
  mealProteinCap?: number;
  /** Верхняя граница роста для пункта (граммы). По умолчанию — роль-зависимый
   *  множитель. Движок передаёт функцию, уважающую дневные капы (орехи/масла). */
  growCap?: (item: ReconItem, role: string) => number;
  maxIter?: number;
}
export interface ReconResult {
  meals: ReconMeal[];
  devPct: number;
  adjusted: boolean;
}

const KNOB_ROLES = new Set(['protein', 'fast_protein', 'carb_slow', 'carb_fast', 'fat']);

/** Нижний пол белка по типу приёма (граммы). Peri/pre-sleep можно подрезать —
 *  иначе белок трен-дня всегда «в плюс» (peri 20/28/28 = 76 г) и день не сходится. */
function proteinFloorByType(mealType: string, mainFloor: number, amount: number): number {
  switch (mealType) {
    case 'breakfast':
    case 'lunch':
    case 'dinner': return mainFloor;
    case 'snack':
    case 'snack2': return Math.min(mainFloor, 50);
    case 'preworkout': return 15;
    case 'postworkout': return 20;
    case 'presleep': return 25;
    default: return Math.min(amount, 40);
  }
}

function cloneMeals(meals: ReconMeal[]): ReconMeal[] {
  return meals.map(m => ({ ...m, items: (m.items || []).map(it => ({ ...it })) }));
}

function sumDay(meals: ReconMeal[], fixed?: ReconTargets): ReconTargets {
  const t: ReconTargets = fixed ? { ...fixed } : { kcal: 0, p: 0, f: 0, c: 0 };
  for (const m of meals) for (const it of m.items) {
    t.kcal += it.kcal || 0; t.p += it.p || 0; t.f += it.f || 0; t.c += it.c || 0;
  }
  return t;
}

export function reconMaxDev(total: ReconTargets, target: ReconTargets): number {
  let dev = 0;
  const pairs: [number, number][] = [[total.kcal, target.kcal], [total.p, target.p], [total.f, target.f], [total.c, target.c]];
  for (const [v, t] of pairs) if (t > 0) dev = Math.max(dev, Math.abs(v - t) / t);
  return dev;
}

function absDev(total: ReconTargets, target: ReconTargets): number {
  return Math.abs(total.kcal - target.kcal) / Math.max(1, target.kcal)
    + Math.abs(total.p - target.p) / Math.max(1, target.p)
    + Math.abs(total.f - target.f) / Math.max(1, target.f)
    + Math.abs(total.c - target.c) / Math.max(1, target.c);
}

function rescaleItem(it: ReconItem, newAmount: number): void {
  const r = newAmount / Math.max(1e-6, it.amount || 0);
  it.p = +(it.p * r).toFixed(1);
  it.f = +(it.f * r).toFixed(1);
  it.c = +(it.c * r).toFixed(1);
  it.kcal = Math.round(4 * it.p + 9 * it.f + 4 * it.c);
  if (typeof it.fiber === 'number') it.fiber = +(it.fiber * r).toFixed(1);
  if (typeof it.leucine_mg === 'number') it.leucine_mg = Math.round(it.leucine_mg * r);
  it.amount = newAmount;
}

/**
 * Дискретный спуск по граммам flex-пунктов. Возвращает копии приёмов и достигнутое
 * max-отклонение. Работает только в сторону улучшения (детерминированно).
 */
export function reconcileDay(mealsIn: ReconMeal[], targets: ReconTargets, opts?: ReconOptions): ReconResult {
  const protect = new Set(opts?.protectTypes ?? ['intra']);
  const snap = opts?.snap ?? ((_it: ReconItem, g: number) => Math.max(0, Math.round(g / 5) * 5));
  const mainProteinFloor = opts?.mainProteinFloor ?? 75;
  const maxIter = opts?.maxIter ?? 6;

  const meals = cloneMeals(Array.isArray(mealsIn) ? mealsIn : []);
  if (!targets || (targets.kcal <= 0 && targets.p <= 0 && targets.f <= 0 && targets.c <= 0)) {
    return { meals, devPct: 0, adjusted: false };
  }
  const before = reconMaxDev(sumDay(meals), targets);
  if (before <= 0.03) return { meals, devPct: before, adjusted: false };

  // Knobs: (mealIdx, itemIdx) с [lo, hi].
  interface Knob { mi: number; ii: number; lo: number; hi: number; }
  const knobs: Knob[] = [];
  const mealProteinCap = opts?.mealProteinCap ?? 60;
  meals.forEach((m, mi) => {
    if (protect.has(String(m.type || '')) || m._insulinWindow) return;
    const mealPNow = m.items.reduce((s, x) => s + (x.p || 0), 0);
    m.items.forEach((it, ii) => {
      if (it._fixedGrams) return;
      const role = String(it.role || '');
      if (!KNOB_ROLES.has(role)) return;
      if (!(it.amount > 0)) return;
      let lo: number; let hi: number;
      const _growCap = opts?.growCap ? opts.growCap(it, role) : Infinity;
      if (role === 'protein' || role === 'fast_protein') {
        // Пол — по типу приёма (цельный белок основного приёма ≥ стража реализма;
        // peri/pre-sleep/мелкие можно подрезать). Рост разрешён при недоборе белка
        // дня, но так, чтобы белок приёма не превысил mealProteinCap (≤60 г).
        const pPerG = (it.p || 0) / Math.max(1e-6, it.amount || 0);
        const roomP = Math.max(0, mealProteinCap - mealPNow);
        const hiByMeal = pPerG > 0 ? it.amount + roomP / pPerG : it.amount;
        lo = Math.min(it.amount, proteinFloorByType(String(m.type || ''), mainProteinFloor, it.amount));
        hi = Math.min(Math.max(it.amount, hiByMeal), it.amount * 1.5, _growCap);
      } else if (role === 'carb_slow' || role === 'carb_fast') {
        lo = Math.min(it.amount, 30);
        hi = Math.min(it.amount * 1.6, _growCap);
      } else { // fat — срез до 0 и рост в пределах дневного капа (орехи/масла)
        lo = 0;
        hi = Math.min(it.amount * 1.6, _growCap);
      }
      if (hi - lo < 5) return;
      knobs.push({ mi, ii, lo, hi });
    });
  });
  if (knobs.length === 0) return { meals, devPct: before, adjusted: false };

  let bestDev = before;
  let bestAbs = absDev(sumDay(meals), targets);
  const evalAmount = (k: Knob, amount: number): void => {
    if (amount === meals[k.mi].items[k.ii].amount) return;
    rescaleItem(meals[k.mi].items[k.ii], amount);
  };
  const snapV = (k: Knob, v: number): number => {
    const s = snap(meals[k.mi].items[k.ii], v);
    return Math.max(k.lo, Math.min(k.hi, s));
  };

  for (let pass = 0; pass < maxIter; pass++) {
    let improved = false;
    for (const k of knobs) {
      const item = meals[k.mi].items[k.ii];
      const cur = item.amount;
      const orig = { p: item.p, f: item.f, c: item.c, kcal: item.kcal, fiber: item.fiber, leucine_mg: item.leucine_mg, amount: item.amount };
      // Кандидаты: 7 точек сетки между lo и hi (детерминированно).
      const cands: number[] = [];
      const FR = [0, 0.25, 0.5, 0.75, 1, 1.5, 2];
      for (const fr of FR) {
        const base = Math.max(k.lo, cur * fr);
        const v = snapV(k, base === 0 ? k.lo : base);
        if (v >= k.lo - 0.1 && v <= k.hi + 0.1) cands.push(v);
      }
      // Гарантируем края диапазона.
      cands.push(snapV(k, k.lo));
      cands.push(snapV(k, k.hi));
      let localBestV = cur; let localBestDev = bestDev; let localBestAbs = bestAbs;
      for (const v of cands) {
        if (v === cur) continue;
        evalAmount(k, v);
        const tot = sumDay(meals);
        const d = reconMaxDev(tot, targets);
        const a = absDev(tot, targets);
        const better = d < localBestDev - 1e-9 || (Math.abs(d - localBestDev) <= 1e-9 && a < localBestAbs - 1e-9);
        // откатываем и запоминаем лучшего
        Object.assign(item, orig);
        if (better) { localBestV = v; localBestDev = d; localBestAbs = a; }
      }
      if (localBestV !== cur) {
        const accepted = localBestDev < bestDev - 1e-9
          || (Math.abs(localBestDev - bestDev) <= 1e-9 && localBestAbs < bestAbs - 1e-9);
        // Применяем ТОЛЬКО принятое изменение (иначе «отклонённая» мутация уводила
        // день от лучшего найденного состояния — доказано дампом 500Б 4.8%→9.6%).
        if (accepted) {
          evalAmount(k, localBestV);
          bestDev = localBestDev; bestAbs = localBestAbs; improved = true;
        }
      }
    }
    if (!improved) break;
  }

  // devPct ОБЯЗАН отражать фактически возвращаемое состояние (защита от рассинхрона).
  const finalDev = reconMaxDev(sumDay(meals), targets);
  return { meals, devPct: finalDev, adjusted: true };
}
