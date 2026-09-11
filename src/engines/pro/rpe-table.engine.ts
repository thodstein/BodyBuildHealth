/**
 * rpe-table.engine.ts — StrengthAnalysisHub PRO P1: RPE/RIR → %1RM сетка.
 *
 * Метод: Brzycki от (повторы + RIR), где RIR = 10 − RPE (Zourdos 2016).
 * Верифицирована клетка-в-клетку по опубликованной сетке Cornerstone Strength RPE chart 2026
 * (8 повторов × 9 RPE, все 72 ячейки ±0.5 п.п.): 1@9=97, 5@8=83, 8@7=72, 10@6=64.
 * Tuchscherer-ориентиры (calculaterpe, Tuchscherer RPE table): 1@9=96, 5@8=80, 8@7=72, 10@6=64 —
 * совпадают кроме 5@8 (Brzycki 83 vs Tuchscherer 80–81): индивидуальные различия ±3%, см. подпись в UI.
 *
 * Epley-обратная (pctForRPE в autoregulation-pro.engine) НЕ тронута — её используют
 * авторегуляция/diay-контуры; здесь отдельный канон для калькулятора (без дубля логики).
 */

function r3(v: number) { return Math.round(v * 1000) / 1000; }
function r1(v: number) { return Math.round(v * 10) / 10; }

/** RIR из RPE (RPE + RIR = 10, шкала 6–10; вне шкалы — кламп). */
export function rpeRir(rpe: number): number {
  if (!Number.isFinite(rpe)) return 0;
  return Math.max(0, Math.min(4, 10 - rpe));
}

/**
 * %1RM (доля 0–1) для повторов @ RPE через Brzycki от эквивалента до отказа n = reps + RIR.
 * n ≥ 37 математически нестабилен (асимптота Brzycki) — кламп к n=36.
 */
export function rpePctBrzycki(reps: number, rpe: number): number {
  const r = Math.max(1, Math.min(15, Math.round(reps)));
  const n = Math.min(36, Math.max(1, r + rpeRir(rpe)));
  if (n <= 1) return 1;
  return r3(1 / (36 / (37 - n)));
}

/** Рабочий вес для повторов @ RPE при известном e1RM. */
export function rpeWeightFor(e1RM: number, reps: number, rpe: number): number {
  if (e1RM <= 0) return 0;
  return r1(e1RM * rpePctBrzycki(reps, rpe));
}

/** Обратная оценка: e1RM из факта (вес × повторы @ RPE). */
export function e1RMFromRpeSet(weight: number, reps: number, rpe: number): number {
  if (weight <= 0) return 0;
  const pct = rpePctBrzycki(reps, rpe);
  if (pct <= 0) return 0;
  return r1(weight / pct);
}
