/**
 * planner-day-reconciler.ts — E0 (PRO-план §3): финальный пасс сходимости
 * продуктового дня. По образцу `planner-recipe-optimizer.ts` (MIGP-lite), но на
 * ПОРЦИЯХ отдельных пунктов flex-приёмов, а не шагах рецепта.
 *
 * Задача: после всех писателей движка минимизировать максимальное относительное
 * отклонение дня по 4 макросам (ккал/Б/Ж/У), двигая порции на дискретной сетке.
 * Сама по себе не удаляет пункты и не меняет их вид — только граммы; НОВЫЙ пункт
 * может появиться единственным путём: `tryAddCarrier` (E16) — движок отдаёт
 * lean-носитель, если роста существующих не хватает (см. ниже). Защищены
 * peri-окна уколов, добавки/жидкости/овощи/фрукты; цельный белок основных
 * приёмов не уходит ниже стража реалистичности (75 г по умолчанию).
 *
 * E10 (аудит-2, малые атлеты): (а) pre-sleep slow_protein тоже «крутилка» —
 * иначе белок выше пола нечем срезать; (б) ПАРНЫЙ ход «срез переполненной оси →
 * рост недобранной» — одиночный жадный застревает на сцепленных осях (рост
 * углеводов тянет белок, срез белка роняет жир); (в) окно роста углеводов ×2.5
 * (верх всё равно ограничен growCap движка). Функция остаётся детерминированной.
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
  /** E15: пол белка ночного приёма (г) — вес-зависимый бюджет (0.4 г/кг, 20–45 г).
   *  Если задан — pre-sleep не режется ниже него (иначе «зависит от веса» не доедет
   *  до факта: reconciler ужимал ночь к LBM-полу 25 г на всех). */
  preSleepFloorP?: number;
  /** Верхняя граница роста для пункта (граммы). По умолчанию — роль-зависимый
   *  множитель. Движок передаёт функцию, уважающую дневные капы (орехи/масла) и
   *  (E14) бюджет тарелки приёма — третий аргумент meal даёт текущий приём. */
  growCap?: (item: ReconItem, role: string, meal?: ReconMeal) => number;
  /** E16: финальный «долив» lean-носителем, когда одиночные и парные ходы исчерпаны,
   *  а день недобирает углеводы (M85 R s2: все носители уже выше капов роста → без
   *  НОВОГО пункта углеводная ось висела на −12.7%). Продукт и граммы выбирает движок
   *  (FOOD_DB, исключения/аллергены/семейные капы/съедобность); reconciler принимает
   *  ход только если он улучшает max-отклонение — сам или в паре «+носитель / −белок». */
  tryAddCarrier?: (meal: ReconMeal, deficitC: number) => ReconItem | null;
  maxIter?: number;
}
export interface ReconResult {
  meals: ReconMeal[];
  devPct: number;
  adjusted: boolean;
  debugInfo?: string;
}

const KNOB_ROLES = new Set(['protein', 'fast_protein', 'slow_protein', 'carb_slow', 'carb_fast', 'fat']);

/** Нижний пол белка по типу приёма (граммы). Peri/pre-sleep/перекусы — в граммах
 *  БЕЛКА (в knob-коде конвертируются по плотности продукта), основные — в граммах ЕДЫ.
 *  Аудит-2/E16 (решение пользователя): полы peri-окна масштабируются LBM —
 *  крупные атлеты держат прежние полы (prew 15 / postw 20 для LBM ≥75), малые
 *  ужимаются: prew = clamp(0.20 г/кг LBM, 6–15), postw = clamp(0.27 г/кг LBM, 9–20).
 *  Было: 15/20 × lbm/55 — для LBM 49 это 13+18=31 г = 0.63 г/кг LBM на окно
 *  (выше рекомендации Schoenfeld & Aragon 2018: 0.4–0.55 г/кг), из-за чего F60
 *  не сходился (P +19.5%). Стало: LBM 49 → 10/13 (0.47 г/кг), LBM 41 → 8/11.
 *  Перекусы: было «50 г ЕДЫ» (шот whey 20 г = 17 г Б неприкосновенен), стало
 *  10 г БЕЛКА — срезаем powder на переборе белка (реализм еды держат полы основных).
 *  fast_protein (порошок peri) дополнительно защищён полом 20 г ЕДЫ (D-28/E15:
 *  MPS-порция сыворотки не ужимается — только в knob-коде, см. ниже). */
function proteinFloorByType(mealType: string, mainFloor: number, amount: number, lbmKg = 0, preSleepFloorP = 0): number {
  const scale = lbmKg > 0 ? Math.min(1, lbmKg / 55) : 1;
  switch (mealType) {
    case 'breakfast':
    case 'lunch':
    case 'dinner': return mainFloor;
    case 'snack':
    case 'snack2':
    case 'snack3':
    case 'snack4':
    case 'snack5':
    case 'snack6': return Math.max(10, Math.round(10 * scale));
    // peri: прежние крупные полы (15/20) с LBM-масштабом вниз для малых.
    case 'preworkout': return lbmKg > 0 ? Math.max(6, Math.min(15, Math.round(0.20 * lbmKg))) : 15;
    case 'postworkout': return lbmKg > 0 ? Math.max(9, Math.min(20, Math.round(0.27 * lbmKg))) : 20;
    case 'presleep': return preSleepFloorP > 0 ? preSleepFloorP : Math.max(15, Math.round(25 * scale));
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
      const _growCap = opts?.growCap ? opts.growCap(it, role, m) : Infinity;
      if (role === 'protein' || role === 'fast_protein' || role === 'slow_protein') {
        // Пол белка: у ОСНОВНЫХ приёмов — в граммах ЕДЫ (страж реализма тарелки),
        // у peri/pre-sleep/перекуса — в граммах БЕЛКА (переводим в еду по плотности;
        // раньше единицы путались и пол был бессмысленным). Рост разрешён при
        // недоборе белка дня, но белок приёма не превысит mealProteinCap (≤60 г).
        // E10: slow_protein (казеин/творог pre-sleep) — тоже регулируемый белок:
        // на малых КБЖУ это единственная позиция белка выше пола, без неё день не сходится.
        const _mt = String(m.type || '');
        const _isPeri = _mt === 'preworkout' || _mt === 'postworkout' || _mt === 'presleep' || /^snack/.test(_mt);
        const _floor = proteinFloorByType(_mt, mainProteinFloor, it.amount, opts?.lbmKg ?? 0, opts?.preSleepFloorP ?? 0);
        if (_isPeri) {
          // пол в граммах БЕЛКА: переводим в граммы еды по плотности продукта
          // (перекусы с E16 тоже здесь: powder-шот срезается на переборе белка).
          lo = (it.p || 0) > 0 ? Math.min(it.amount, Math.max(0, ((it.amount || 0) * _floor) / it.p)) : it.amount;
        } else {
          lo = Math.min(it.amount, _floor);
        }
        // D-28/E15: MPS-порция peri-порошка не ужимается ниже 20 г ЕДЫ — но только в
        // peri-ОКНАХ pre/post (D-28 «peri-workout сыворотка не ужимается»): в перекусе
        // сыворотка — обычный белок, её граммовка остаётся крутилкой сведения дня.
        if (role === 'fast_protein' && (String(m.type || '') === 'preworkout' || String(m.type || '') === 'postworkout')) {
          lo = Math.max(lo, Math.min(it.amount, 20));
        }
        const pPerG = (it.p || 0) / Math.max(1e-6, it.amount || 0);
        const roomP = Math.max(0, mealProteinCap - mealPNow);
        const hiByMeal = pPerG > 0 ? it.amount + roomP / pPerG : it.amount;
        hi = Math.min(Math.max(it.amount, hiByMeal), it.amount * 1.5, _growCap);
      } else if (role === 'carb_slow' || role === 'carb_fast') {
        // E10: на малых КБЖУ углеводный носитель приёма нередко стартует с 30–50 г —
        // прежнее окно ×1.6 (50→80 г) физически не закрывало углеводную ось дня.
        // Верхний предел человеческой порции всё равно задаёт growCap (съедобность
        // продукта/кап пункта), поэтому окно расширено до ×2.5.
        lo = Math.min(it.amount, 30);
        hi = Math.min(it.amount * 2.5, _growCap);
      } else { // fat — срез до 5 г (не в ноль: «chia 0 г» — мусор) и рост в пределах капа
        lo = Math.min(it.amount, 5);
        hi = Math.min(it.amount * 1.6, _growCap);
      }
      // §3I/E16: микро-добавка (семечки/морковь на 8000+) защищена до своей граммовки —
      // иначе срез жира обнулял VitE (45% против канона ≥70%). Для ВСЕХ ролей (семечки —
      // жир, не только белок). Выше защищённой граммовки резать по-прежнему можно.
      if ((it as any)._microProtectedG > 0) lo = Math.max(lo, Math.min(it.amount, (it as any)._microProtectedG));
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

    // ─── E10: ПАРНЫЙ ОБМЕН (срез переполненной оси → рост недобранной) ────────
    // Жадный одиночный шаг застревает, когда оси «сцеплены»: рост углеводов любой
    // крупой тянет белок (у малых атлетов он уже в переборе из-за полов peri/pre-sleep),
    // а срез белка роняет жир. Совместный шаг «белок/жир вниз + углевод/жир вверх»
    // решает это в одном принятии. Только если одиночные шаги не дали улучшения.
    if (!improved) {
      const shrinkables = knobs.filter(k => {
        const r = String(meals[k.mi].items[k.ii].role || '');
        return (r === 'protein' || r === 'fast_protein' || r === 'slow_protein' || r === 'fat') && k.lo < meals[k.mi].items[k.ii].amount - 2;
      });
      const growables = knobs.filter(k => k.hi > meals[k.mi].items[k.ii].amount + 2);
      let pairBestDev = bestDev; let pairBestAbs = bestAbs;
      let pairBest: { k1: Knob; v1: number; k2: Knob; v2: number } | null = null;
      for (const k1 of shrinkables) {
        const it1 = meals[k1.mi].items[k1.ii];
        const cur1 = it1.amount;
        const o1 = { p: it1.p, f: it1.f, c: it1.c, kcal: it1.kcal, fiber: it1.fiber, leucine_mg: it1.leucine_mg, amount: it1.amount };
        const v1s = [snapV(k1, k1.lo), snapV(k1, (cur1 + k1.lo) / 2)];
        for (const k2 of growables) {
          if (k2.mi === k1.mi && k2.ii === k1.ii) continue;
          const it2 = meals[k2.mi].items[k2.ii];
          const cur2 = it2.amount;
          const o2 = { p: it2.p, f: it2.f, c: it2.c, kcal: it2.kcal, fiber: it2.fiber, leucine_mg: it2.leucine_mg, amount: it2.amount };
          const v2s = [snapV(k2, k2.hi), snapV(k2, (cur2 + k2.hi) / 2)];
          for (const v1 of v1s) {
            if (!(v1 < cur1 - 1)) continue;
            for (const v2 of v2s) {
              if (!(v2 > cur2 + 1)) continue;
              evalAmount(k1, v1); evalAmount(k2, v2);
              const tot = sumDay(meals);
              const d = reconMaxDev(tot, targets);
              const a = absDev(tot, targets);
              const better = d < pairBestDev - 1e-9 || (Math.abs(d - pairBestDev) <= 1e-9 && a < pairBestAbs - 1e-9);
              if (better) { pairBestDev = d; pairBestAbs = a; pairBest = { k1, v1, k2, v2 }; }
              Object.assign(it1, o1); Object.assign(it2, o2);
            }
          }
        }
      }
      if (pairBest) {
        evalAmount(pairBest.k1, pairBest.v1);
        evalAmount(pairBest.k2, pairBest.v2);
        bestDev = pairBestDev; bestAbs = pairBestAbs; improved = true;
      }
      // ─── E16: «долив» новым lean-носителем (когда роста существующих нет) ───
      // Движок даёт кандидата (FOOD_DB + исключения/аллергены/семейные капы).
      // Принимаем ход сам по себе ИЛИ в паре со срезом переполненного белка
      // (иначе M85 R s2: −12.7% У при Б +10.8% — обе оси сцеплены, роста нет).
      if (!improved && opts?.tryAddCarrier) {
        const _cDef = (targets.c || 0) - sumDay(meals).c;
        if (_cDef > Math.max(5, (targets.c || 0) * 0.02)) {
          const _shrinkP = knobs.filter(k => {
            const r = String(meals[k.mi].items[k.ii].role || '');
            return (r === 'protein' || r === 'fast_protein' || r === 'slow_protein')
              && k.lo < meals[k.mi].items[k.ii].amount - 2;
          });
          // Порядок: сначала «крошечные» основные приёмы (<180 ккал) — долив делает их
          // полноценными (E11-гарантия), затем остальные (детерминированно по индексу).
          const _kcalOf = (m: ReconMeal): number => (m.items || []).reduce((s, x) => s + (x.kcal || 0), 0);
          const _isMainT = (t: string): boolean => t === 'breakfast' || t === 'lunch' || t === 'dinner';
          const _order = meals.map((_m, i) => i).sort((a, b) => {
            const fa = _isMainT(String(meals[a].type || '')) && _kcalOf(meals[a]) > 0 && _kcalOf(meals[a]) < 180 ? 0 : 1;
            const fb = _isMainT(String(meals[b].type || '')) && _kcalOf(meals[b]) > 0 && _kcalOf(meals[b]) < 180 ? 0 : 1;
            return fa - fb || a - b;
          });
          for (const mi of _order) {
            const m = meals[mi];
            if (protect.has(String(m.type || '')) || m._insulinWindow) continue;
            if ((m.items || []).length >= 8) continue;
            const cand = opts.tryAddCarrier(m, _cDef);
            if (!cand || !(cand.amount > 0)) continue;
            const added: ReconItem = { ...cand };
            m.items.push(added);
            let accepted = false;
            {
              const tot = sumDay(meals);
              const d = reconMaxDev(tot, targets);
              const a = absDev(tot, targets);
              if (d < bestDev - 1e-9 || (Math.abs(d - bestDev) <= 1e-9 && a < bestAbs - 1e-9)) {
                bestDev = d; bestAbs = a; accepted = true; improved = true;
              }
            }
            if (!accepted && _shrinkP.length > 0) {
              let pairDev = bestDev; let pairAbs = bestAbs; let pairK: Knob | null = null; let pairV = 0;
              for (const k1 of _shrinkP) {
                const it1 = meals[k1.mi].items[k1.ii];
                const cur1 = it1.amount;
                const o1 = { p: it1.p, f: it1.f, c: it1.c, kcal: it1.kcal, fiber: it1.fiber, leucine_mg: it1.leucine_mg, amount: it1.amount };
                // Мелкие позиции (шот сыворотки 15 г): снап-сетка округляет 12.5–14 → 15 (=cur)
                // и срез «не существует» — добавляем целые fallback-кандидаты.
                for (const v1 of [snapV(k1, k1.lo), snapV(k1, (cur1 + k1.lo) / 2), Math.max(k1.lo, cur1 - 5), Math.max(k1.lo, Math.round((cur1 + k1.lo) / 2))]) {
                  if (!(v1 < cur1 - 1)) continue;
                  evalAmount(k1, v1);
                  const tot = sumDay(meals);
                  const d = reconMaxDev(tot, targets);
                  const a = absDev(tot, targets);
                  if (d < pairDev - 1e-9 || (Math.abs(d - pairDev) <= 1e-9 && a < pairAbs - 1e-9)) {
                    pairDev = d; pairAbs = a; pairK = k1; pairV = v1;
                  }
                  Object.assign(it1, o1);
                }
              }
              if (pairK) {
                evalAmount(pairK, pairV);
                bestDev = pairDev; bestAbs = pairAbs; accepted = true; improved = true;
              }
            }
            if (accepted) break;
            m.items.pop();
          }
        }
      }
    }
    if (!improved) break;
  }

  // devPct ОБЯЗАН отражать фактически возвращаемое состояние (защита от рассинхрона).
  const finalDev = reconMaxDev(sumDay(meals), targets);
  return { meals, devPct: finalDev, adjusted: true };
}
