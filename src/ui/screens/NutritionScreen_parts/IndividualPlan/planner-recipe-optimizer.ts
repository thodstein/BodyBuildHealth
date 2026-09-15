/**
 * planner-recipe-optimizer.ts — E4 (MIGP-lite) фундамент: совместный подбор
 * дискретных порций рецептов ДНЯ, а не по одному приёму.
 *
 * Проблема (жалоба «цель по КБЖУ и рецептам не сходится»): приёмы скейлятся
 * независимо (ближайший шаг ряда к цели приёма), из-за чего сумма дня уезжает,
 * а на высоких углеводах капы отдельных приёмов не дают добрать остаток.
 * Решение класса MIGP: перебрать дискретные шаги порций по всем основным
 * приёмам и выбрать комбинацию, минимизирующую максимальное относительное
 * отклонение дня (soft-goal), а не раундить каждый приём отдельно.
 *
 * Чистая функция: без FOOD_DB/движка — принимает уже разложенные макросы
 * ядра рецепта при шаге ×1 и цель дня. Ничего не мутирует.
 */

export interface RecipeMacros {
  kcal: number;
  p: number;
  f: number;
  c: number;
}

export interface OptimizeResult {
  /** Выбранный шаг на каждый приём (индекс совпадает с входом). */
  scales: number[];
  /** Максимальное относительное отклонение сумм дня (0.03 = 3%). */
  devPct: number;
  /** Взвешенная сумма абсолютных отклонений (тай-брейк). */
  absDev: number;
}

const ZERO: RecipeMacros = { kcal: 0, p: 0, f: 0, c: 0 };

function sumScaled(cores: (RecipeMacros | null)[], scales: number[], i: number): RecipeMacros {
  const core = cores[i] || ZERO;
  const s = scales[i];
  return { kcal: core.kcal * s, p: core.p * s, f: core.f * s, c: core.c * s };
}

function totalOf(cores: (RecipeMacros | null)[], scales: number[], fixed?: RecipeMacros): RecipeMacros {
  const t: RecipeMacros = fixed ? { ...fixed } : { ...ZERO };
  for (let i = 0; i < cores.length; i++) {
    const m = sumScaled(cores, scales, i);
    t.kcal += m.kcal; t.p += m.p; t.f += m.f; t.c += m.c;
  }
  return t;
}

/** Максимальное относительное отклонение по ненулевым целям. */
export function maxRelativeDeviation(total: RecipeMacros, target: RecipeMacros): number {
  const parts: Array<[number, number]> = [
    [total.kcal, target.kcal], [total.p, target.p], [total.f, target.f], [total.c, target.c],
  ];
  let dev = 0;
  for (const [v, t] of parts) {
    if (t > 0) dev = Math.max(dev, Math.abs(v - t) / t);
  }
  return dev;
}

/**
 * Совместный подбор шагов. cores — ядро рецепта при шаге ×1 (null = приём без
 * рецепта, остаётся как есть); steps — допустимый ряд (например [0.5,1,1.5,2,...]);
 * fixed — то, что уже зафиксировано (перекусы/peri/окна), учитывается в сумме.
 */
export function optimizeRecipePortionScales(
  cores: (RecipeMacros | null)[],
  target: RecipeMacros,
  steps: number[],
  fixed?: RecipeMacros,
): OptimizeResult {
  const usable = (Array.isArray(steps) ? steps : []).filter(s => Number.isFinite(s) && s > 0);
  const stepList = usable.length > 0 ? usable.slice().sort((a, b) => a - b) : [1];
  const n = Array.isArray(cores) ? cores.length : 0;
  if (n === 0) {
    const total = totalOf([], [], fixed);
    return { scales: [], devPct: maxRelativeDeviation(total, target), absDev: 0 };
  }
  // Перебор ограничен: >4 рецептов с полным рядом — жадный спуск (иначе 9^6).
  const bruteLimit = 4;
  const best: OptimizeResult = { scales: new Array(n).fill(stepList[0]), devPct: Infinity, absDev: Infinity };
  const evaluate = (scales: number[]): OptimizeResult => {
    const total = totalOf(cores, scales, fixed);
    const dev = maxRelativeDeviation(total, target);
    const abs = Math.abs(total.kcal - target.kcal) / Math.max(1, target.kcal)
      + Math.abs(total.p - target.p) / Math.max(1, target.p)
      + Math.abs(total.f - target.f) / Math.max(1, target.f)
      + Math.abs(total.c - target.c) / Math.max(1, target.c);
    return { scales: scales.slice(), devPct: dev, absDev: abs };
  };
  const better = (a: OptimizeResult, b: OptimizeResult) =>
    a.devPct < b.devPct - 1e-9 || (Math.abs(a.devPct - b.devPct) <= 1e-9 && a.absDev < b.absDev - 1e-9);
  const apply = (r: OptimizeResult) => { if (better(r, best)) { best.scales = r.scales; best.devPct = r.devPct; best.absDev = r.absDev; } };

  const idx = cores.map((c, i) => (c ? i : -1)).filter(i => i >= 0);
  if (idx.length <= bruteLimit) {
    const scales = new Array(n).fill(stepList[0]);
    // null-приёмы не участвуют — фиксируем ×1 там, где ядро есть по факту.
    const rec = (k: number) => {
      if (k === idx.length) { apply(evaluate(scales)); return; }
      const i = idx[k];
      for (const s of stepList) { scales[i] = s; rec(k + 1); }
    };
    rec(0);
    return best;
  }
  // Жадный спуск: старт с ближайшего к доле цели, затем по одному улучшаем.
  const scales = new Array(n).fill(stepList[0]);
  const share = target.kcal / Math.max(1, idx.length);
  for (const i of idx) {
    const core = cores[i] || ZERO;
    let bestS = stepList[0]; let bestD = Infinity;
    for (const s of stepList) { const d = Math.abs(core.kcal * s - share); if (d < bestD - 1e-9) { bestD = d; bestS = s; } }
    scales[i] = bestS;
  }
  apply(evaluate(scales));
  for (let pass = 0; pass < 3; pass++) {
    for (const i of idx) {
      const cur = scales[i];
      for (const s of stepList) {
        scales[i] = s;
        apply(evaluate(scales));
      }
      scales[i] = best.scales[i] !== undefined ? best.scales[i] : cur;
    }
  }
  return best;
}
