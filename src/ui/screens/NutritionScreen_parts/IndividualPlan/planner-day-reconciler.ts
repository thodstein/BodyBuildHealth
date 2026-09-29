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
  /** LBM атлета — для масштабирования абсолютных полов белка у малых атлетов. */
  lbmKg?: number;
  /** Верхняя граница роста для пункта (граммы). По умолчанию — роль-зависимый
   *  множитель. Движок передаёт функцию, уважающую дневные капы (орехи/масла). */
  growCap?: (item: ReconItem, role: string) => number;
  maxIter?: number;
}
export interface ReconResult {
  meals: ReconMeal[];
  devPct: number;
  adjusted: boolean;
  debugInfo?: string;
}

const KNOB_ROLES = new Set(['protein', 'fast_protein', 'carb_slow', 'carb_fast', 'fat']);

/** Нижний пол белка по типу приёма (граммы). Peri/pre-sleep можно подрезать —
 *  иначе белок трен-дня всегда «в плюс» (peri 20/28/28 = 76 г) и день не сходится.
 *  Small-athlete: у малого LBM абсолютные полы (15/20/25) — уже 0.4-0.6 г/кг и
 *  физически раздувают цель 100 г; масштабируем их вниз (крупные атлеты не тронуты). */
function proteinFloorByType(mealType: string, mainFloor: number, amount: number, lbmKg = 0): number {
  const scale = lbmKg > 0 ? Math.min(1, lbmKg / 55) : 1;
  switch (mealType) {
    case 'breakfast':
    case 'lunch':
    case 'dinner': return mainFloor;
    case 'snack':
    case 'snack2': return Math.min(mainFloor, 50);
    case 'preworkout': return Math.max(8, Math.round(15 * scale));
    case 'postworkout': return Math.max(12, Math.round(20 * scale));
    case 'presleep': return Math.max(15, Math.round(25 * scale));
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

function rescaleItem(it: ReconItem, newAmountRaw: number): void {
  // Порции — ВСЕГДА целые граммы (инвариант P2-2; снап-функция может дать дробь,
  // напр. масло 17.6 г). Крахмалы/белки движок и так держит целыми.
  const newAmount = Math.max(0, Math.round(newAmountRaw));
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
        // Пол белка: у ОСНОВНЫХ приёмов — в граммах ЕДЫ (страж реализма тарелки),
        // у peri/pre-sleep/перекуса — в граммах БЕЛКА (переводим в еду по плотности;
        // раньше единицы путались и пол был бессмысленным). Рост разрешён при
        // недоборе белка дня, но белок приёма не превысит mealProteinCap (≤60 г).
        const _mt = String(m.type || '');
        const _isPeri = _mt === 'preworkout' || _mt === 'postworkout' || _mt === 'presleep';
        const _floor = proteinFloorByType(_mt, mainProteinFloor, it.amount, opts?.lbmKg ?? 0);
        if (_isPeri) {
          lo = (it.p || 0) > 0 ? Math.min(it.amount, Math.max(0, ((it.amount || 0) * _floor) / it.p)) : it.amount;
        } else {
          lo = Math.min(it.amount, _floor);
        }
        const pPerG = (it.p || 0) / Math.max(1e-6, it.amount || 0);
        const roomP = Math.max(0, mealProteinCap - mealPNow);
        const hiByMeal = pPerG > 0 ? it.amount + roomP / pPerG : it.amount;
        hi = Math.min(Math.max(it.amount, hiByMeal), it.amount * 1.5, _growCap);
      } else if (role === 'carb_slow' || role === 'carb_fast') {
        lo = Math.min(it.amount, 30);
        hi = Math.min(it.amount * 1.6, _growCap);
      } else { // fat — срез до 5 г (не в ноль: «chia 0 г» — мусор) и рост в пределах капа
        lo = Math.min(it.amount, 5);
        hi = Math.min(it.amount * 1.6, _growCap);
      }
      // Диапазон: белок/угли ≥5 г, жир ≥2 г (масло 5→8 г закрывает жир-ось).
      if (hi - lo < (role === 'fat' ? 2 : 5)) return;
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
    const item = meals[k.mi].items[k.ii];
    const raw = Math.max(k.lo, Math.min(k.hi, v));
    const s = snap(item, raw);
    const sc = Math.max(k.lo, Math.min(k.hi, s));
    // Сетка порций у мяса/молочки начинается с 100 г, поэтому снап «раздувал»
    // кандидата на СРЕЗ вверх (trim недостижим). При запросе ниже текущего берём
    // ровный 5-г шаг — срез реально исполняется (малое КБЖУ сходится).
    if (raw < (item.amount || 0) && sc > raw) return Math.max(k.lo, Math.round(raw / 5) * 5);
    return sc;
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
