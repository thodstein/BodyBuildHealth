/**
 * armlift-history.engine.ts — история диагнозов + вердикт перетеста (PRO-5 D11 E4 / D12 E7).
 * Снапшот: дата, снаряд, звено, причина, тесты. Вердикт: рост ≥5% → повышай;
 * стоит ≥4 нед → меняй стимул; падает → делод. Правила: pinch 60с → следующий вес,
 * CoC 10–12 → следующий гриппер. Чистые функции + тонкий storage-слой.
 */

export interface ArmliftDiagSnapshot {
  date: string;
  implement: string;
  weakLink: string;
  cause: string;
  pinchHoldSec?: number | null;
  farmerHoldSec?: number | null;
  cocLevel?: number | null;
  silverSec?: number | null;
  /** D21: полнота диагностики на момент снапшота (0–100). */
  completenessPct?: number | null;
}

export type ArmliftRetestVerdict = 'up' | 'hold' | 'stagnant' | 'deload' | 'no_data';

export interface ArmliftRetestResult {
  verdict: ArmliftRetestVerdict;
  text: string;
}

const HISTORY_KEY = 'he_armlifting_diag_history';
const HISTORY_CAP = 12;

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function saveDiagSnapshot(s: ArmliftDiagSnapshot): ArmliftDiagSnapshot[] {
  const next = [...loadDiagHistory(), { ...s, date: s.date || new Date().toISOString().slice(0, 10) }].slice(-HISTORY_CAP);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch { /* noop */ }
  return next;
}

export function clearDiagHistory(): void {
  try { localStorage.removeItem(HISTORY_KEY); } catch { /* noop */ }
}

export function loadDiagHistory(): ArmliftDiagSnapshot[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(HISTORY_KEY) : null;
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr.filter((s: any) => s && typeof s.date === 'string').slice(-HISTORY_CAP);
  } catch { return []; }
}

export function lastSnapshotFor(implement: string, excludeToday = true): ArmliftDiagSnapshot | null {
  const today = new Date().toISOString().slice(0, 10);
  const list = loadDiagHistory().filter((s) => s.implement === implement && (!excludeToday || s.date !== today));
  return list.length ? list[list.length - 1] : null;
}

/** Вердикт перетеста одного теста: порог роста 5%, стагнация от 4 нед. */
export function retestVerdict(prev: number | null | undefined, curr: number | null | undefined, weeksApart?: number | null): ArmliftRetestResult {
  const p = num(prev);
  const c = num(curr);
  if (p == null || c == null) return { verdict: 'no_data', text: 'Нет пары замеров — вердикта нет' };
  const delta = (c - p) / p;
  if (delta >= 0.05) return { verdict: 'up', text: `Рост +${Math.round(delta * 100)}% — повышай по правилу (60с/10–12)` };
  if (delta <= -0.05) return { verdict: 'deload', text: `Падение ${Math.round(delta * 100)}% — делод 50% + проверь сон/частоту` };
  if (weeksApart != null && weeksApart >= 4) return { verdict: 'stagnant', text: 'Стоит ≥4 нед — меняй стимул (другое упражнение/динамика)' };
  return { verdict: 'hold', text: 'Держится — продолжай блок до 4 нед, потом решай' };
}

/**
 * D19: дельта двух последних снапшотов снаряда (звено/причина сменились?).
 * null — сравнивать нечего (меньше 2 снапшотов).
 */
export function historyDeltaFor(history: ArmliftDiagSnapshot[], implement: string): string | null {
  try {
    const list = (Array.isArray(history) ? history : []).filter((s) => s && s.implement === implement);
    if (list.length < 2) return null;
    const a = list[list.length - 2];
    const b = list[list.length - 1];
    const bits: string[] = [];
    if (a.weakLink !== b.weakLink) bits.push(`звено: ${a.weakLink} → ${b.weakLink}`);
    if (a.cause !== b.cause) bits.push(`причина: ${a.cause} → ${b.cause}`);
    if (a.completenessPct != null && b.completenessPct != null && a.completenessPct !== b.completenessPct) {
      bits.push(`полнота: ${a.completenessPct}% → ${b.completenessPct}%`);
    }
    if (!bits.length) return `без смены (${b.weakLink}/${b.cause} держится с ${a.date})`;
    return bits.join(' · ');
  } catch { return null; }
}

/** D21: простые sparkline данные полноты по истории снаряда. */
export function completenessTrend(history: ArmliftDiagSnapshot[], implement: string): number[] {
  try {
    return (Array.isArray(history) ? history : [])
      .filter((s) => s && s.implement === implement && s.completenessPct != null)
      .map((s) => Number(s.completenessPct))
      .filter((n) => Number.isFinite(n));
  } catch { return []; }
}

/** Недель между датами ISO (округление вниз, минимум 0). */
export function weeksBetween(aIso: string, bIso: string): number {
  try {
    const ms = new Date(bIso).getTime() - new Date(aIso).getTime();
    if (!Number.isFinite(ms) || ms < 0) return 0;
    return Math.floor(ms / (7 * 86400000));
  } catch { return 0; }
}
