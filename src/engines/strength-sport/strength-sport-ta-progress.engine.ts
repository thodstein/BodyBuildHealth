/**
 * strength-sport-ta-progress.engine.ts — ПРОГРЕСС ДВОЕБОРЬЯ + SINCLAIR (V3-A)
 *
 * Sinclair Total = total × 10^(A × (log10(BW/B))²), BW ≤ B иначе 1.0.
 * Коэффициенты IWF «The Sinclair Coefficients for the Olympiad 2021–2024»
 * (iwf.sport, Alberta WA PDF): Men A=0.722762521 B=193.609; Women A=0.787004341 B=153.757.
 * Проверка: F 67.9кг/257 → ≈322.9 (в PDF опечатка 67.8/67.9 — там 323.187);
 * M 81кг/305 → ≈387.07 (rpetraining: 387.09 ✓).
 * История замеров (вес+рывок+толчок) + тренд. Чистый движок + storage-хелперы.
 */

export const SINCLAIR_MEN = { A: 0.722762521, B: 193.609 };
export const SINCLAIR_WOMEN = { A: 0.787004341, B: 153.757 };

export const TA_PROGRESS_KEY = 'he_ta_progress_hist_v1';

/** Коэффициент Sinclair (null при нет данных). */
export function sinclairCoefficient(bwKg: number | null | undefined, sex?: string | null): number | null {
  if (bwKg == null || !Number.isFinite(bwKg) || bwKg <= 0) return null;
  const { A, B } = sex === 'female' ? SINCLAIR_WOMEN : SINCLAIR_MEN;
  if (bwKg >= B) return 1;
  const x = Math.log10(bwKg / B);
  return Math.pow(10, A * x * x);
}

/** Sinclair Total (округление 0.01). */
export function sinclairTotal(totalKg: number | null | undefined, bwKg: number | null | undefined, sex?: string | null): number | null {
  if (totalKg == null || !Number.isFinite(totalKg) || totalKg <= 0) return null;
  const c = sinclairCoefficient(bwKg, sex);
  if (c == null) return null;
  return Math.round(totalKg * c * 100) / 100;
}

export interface TAProgressEntry {
  date: string; // yyyy-mm-dd
  bodyweightKg: number;
  snatchKg: number;
  cleanJerkKg: number;
}

/** Сумма двоеборья записи. */
export function progressTotal(e: TAProgressEntry): number {
  return (Number(e.snatchKg) || 0) + (Number(e.cleanJerkKg) || 0);
}

/** Добавить/заменить снимок дня (кап 60). */
export function appendTAProgress(hist: TAProgressEntry[], entry: TAProgressEntry): TAProgressEntry[] {
  const clean = (Array.isArray(hist) ? hist : []).filter(s => s && typeof s.date === 'string');
  const next = [...clean.filter(s => s.date !== entry.date), entry]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(-60);
  return next;
}

export interface TAProgressTrend {
  n: number;
  totalDelta: number;
  bwDelta: number;
  sinclairDelta: number | null;
  bestSinclair: number | null;
  bestDate: string | null;
}

/** Тренд: последний vs первый + лучший Sinclair. */
export function taProgressTrend(hist: TAProgressEntry[], sex?: string | null): TAProgressTrend | null {
  const clean = (Array.isArray(hist) ? hist : []).filter(s => s && Number.isFinite(s.snatchKg) && Number.isFinite(s.cleanJerkKg));
  if (clean.length < 2) return null;
  const sorted = [...clean].sort((a, b) => (a.date < b.date ? -1 : 1));
  const first = sorted[0], last = sorted[sorted.length - 1];
  const totalDelta = Math.round((progressTotal(last) - progressTotal(first)) * 10) / 10;
  const bwDelta = Math.round(((Number(last.bodyweightKg) || 0) - (Number(first.bodyweightKg) || 0)) * 10) / 10;
  let bestSinclair: number | null = null;
  let bestDate: string | null = null;
  let lastSinclair: number | null = null;
  let firstSinclair: number | null = null;
  for (const s of sorted) {
    const st = sinclairTotal(progressTotal(s), Number(s.bodyweightKg) || null, sex);
    if (st != null && (bestSinclair == null || st > bestSinclair)) { bestSinclair = st; bestDate = s.date; }
  }
  firstSinclair = sinclairTotal(progressTotal(first), Number(first.bodyweightKg) || null, sex);
  lastSinclair = sinclairTotal(progressTotal(last), Number(last.bodyweightKg) || null, sex);
  const sinclairDelta = firstSinclair != null && lastSinclair != null ? Math.round((lastSinclair - firstSinclair) * 100) / 100 : null;
  return { n: sorted.length, totalDelta, bwDelta, sinclairDelta, bestSinclair, bestDate };
}

export function loadTAProgress(): TAProgressEntry[] {
  try {
    const raw = localStorage.getItem(TA_PROGRESS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter(s => s && typeof s.date === 'string') : [];
  } catch { return []; }
}

export function saveTAProgress(hist: TAProgressEntry[]): boolean {
  try {
    localStorage.setItem(TA_PROGRESS_KEY, JSON.stringify(Array.isArray(hist) ? hist.slice(-60) : []));
    return true;
  } catch { return false; }
}
