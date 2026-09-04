/**
 * strength-sport-sm-progress.engine.ts — ПРОГРЕСС СТРОНГМЕНА (SM PRO)
 *
 * Трекинг ключевых метрик: йок 20м время + фермер 40м время + лог макс + камень лестница.
 * Parity с TA ta-progress (история + тренд + best), без Sinclair (у SM — очки/места/скорость).
 * Источники: Hindle yoke 1.69 м/с / farmers HP stride+rate, FitnessVolt levels,
 * PoinT GO MHV 1.4-1.9 + декремент 15%.
 *
 * Чистый движок + storage-хелперы (try/catch).
 */

export const SM_PROGRESS_KEY = 'he_sm_progress_hist_v1';

export interface SMProgressEntry {
  date: string; // yyyy-mm-dd
  bodyweightKg: number;
  yoke20mS?: number | null; // время йок 20м, с
  farmers40mS?: number | null; // время фермер 40м, с
  logKg?: number | null;
  stoneLadderKg?: number | null; // последний камень лестницы
}

export function smProgressScore(e: SMProgressEntry): number {
  // Условный скор для тренда: лог + камень − штраф времени (меньше время = лучше)
  const log = Number(e.logKg) || 0;
  const stone = Number(e.stoneLadderKg) || 0;
  const yoke = Number(e.yoke20mS) || 0;
  const farm = Number(e.farmers40mS) || 0;
  return Math.round((log + stone - yoke * 2 - farm) * 10) / 10;
}

/** Добавить/заменить снимок дня (кап 60). */
export function appendSMProgress(hist: SMProgressEntry[], entry: SMProgressEntry): SMProgressEntry[] {
  const clean = (Array.isArray(hist) ? hist : []).filter((s) => s && typeof s.date === 'string');
  const next = [...clean.filter((s) => s.date !== entry.date), entry]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(-60);
  return next;
}

export interface SMProgressTrend {
  n: number;
  scoreDelta: number;
  bwDelta: number;
  yokeDeltaS: number | null; // отрицательный = быстрее
  farmersDeltaS: number | null;
  logDeltaKg: number | null;
  stoneDeltaKg: number | null;
  bestScore: number | null;
  bestDate: string | null;
}

export function smProgressTrend(hist: SMProgressEntry[]): SMProgressTrend | null {
  const clean = (Array.isArray(hist) ? hist : []).filter(
    (s) => s && (Number.isFinite(s.logKg) || Number.isFinite(s.yoke20mS) || Number.isFinite(s.stoneLadderKg)),
  );
  if (clean.length < 2) return null;
  const sorted = [...clean].sort((a, b) => (a.date < b.date ? -1 : 1));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const scoreDelta = Math.round((smProgressScore(last) - smProgressScore(first)) * 10) / 10;
  const bwDelta = Math.round(((Number(last.bodyweightKg) || 0) - (Number(first.bodyweightKg) || 0)) * 10) / 10;
  const d = (a: number | null | undefined, b: number | null | undefined): number | null => {
    if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b)) return null;
    return Math.round((a - b) * 10) / 10;
  };
  let bestScore: number | null = null;
  let bestDate: string | null = null;
  for (const s of sorted) {
    const sc = smProgressScore(s);
    if (bestScore == null || sc > bestScore) {
      bestScore = sc;
      bestDate = s.date;
    }
  }
  return {
    n: sorted.length,
    scoreDelta,
    bwDelta,
    yokeDeltaS: d(last.yoke20mS, first.yoke20mS),
    farmersDeltaS: d(last.farmers40mS, first.farmers40mS),
    logDeltaKg: d(last.logKg, first.logKg),
    stoneDeltaKg: d(last.stoneLadderKg, first.stoneLadderKg),
    bestScore,
    bestDate,
  };
}

export function loadSMProgress(): SMProgressEntry[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(SM_PROGRESS_KEY) : null;
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveSMProgress(hist: SMProgressEntry[]): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(SM_PROGRESS_KEY, JSON.stringify(hist.slice(-60)));
  } catch { /* noop */ }
}
