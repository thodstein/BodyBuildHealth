/**
 * arm-force-history.store.ts — недельные avg/max/min + fatigue index (WO2026106582A1 патент-график).
 * Хранение: localStorage he_arm_force_history + he_arm_force_trials (для Bezkorovainyi F100/F500).
 * avg 200→260, max 250→310, min 180→240, fatigue 10%→4.5% за 12 нед — тренд адаптации.
 */
import type { ArmForceTrial } from './arm-dynamic-force.engine';

export interface WeeklyForceStats {
  week: number; // 1..52
  weekStartIso: string;
  avg: number; // средний кг за неделю
  max: number;
  min: number;
  fatiguePct: number; // (max-min)/max*100 %
  trials: number;
}
const LS_KEY = 'he_arm_force_history';
const TRIALS_KEY = 'he_arm_force_trials';

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  try { return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
}
function toIso(d: Date): string { return d.toISOString().slice(0, 10); }
function weekStartIso(dateIso: string): string {
  const d = new Date(dateIso + 'T12:00:00');
  const day = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - day);
  return toIso(d);
}

export function loadForceTrials(): ArmForceTrial[] {
  return safeJsonParse<ArmForceTrial[]>(typeof localStorage !== 'undefined' ? localStorage.getItem(TRIALS_KEY) : null, []);
}
export function saveForceTrials(trials: ArmForceTrial[]): void {
  try { localStorage.setItem(TRIALS_KEY, JSON.stringify(trials.slice(-300))); } catch {}
}
export function addForceTrial(t: ArmForceTrial): void {
  const arr = loadForceTrials();
  arr.push({ ...t, dateIso: t.dateIso || toIso(new Date()) });
  saveForceTrials(arr);
}
export function loadWeeklyForceStats(): WeeklyForceStats[] {
  return safeJsonParse<WeeklyForceStats[]>(typeof localStorage !== 'undefined' ? localStorage.getItem(LS_KEY) : null, []);
}
export function saveWeeklyForceStats(stats: WeeklyForceStats[]): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify(stats.slice(-52))); } catch {}
}

export function buildWeeklyStats(trials: ArmForceTrial[], weeks = 12): WeeklyForceStats[] {
  if (!trials.length) return [];
  // группируем по weekStartIso
  const byWeek = new Map<string, ArmForceTrial[]>();
  for (const t of trials) {
    const iso = t.dateIso || toIso(new Date());
    const ws = weekStartIso(iso);
    if (!byWeek.has(ws)) byWeek.set(ws, []);
    byWeek.get(ws)!.push(t);
  }
  const sorted = Array.from(byWeek.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(-weeks);
  return sorted.map(([ws, arr], idx) => {
    const forces = arr.map(x => x.forceKg).filter(v => Number.isFinite(v) && v > 0);
    const avg = forces.length ? forces.reduce((a, b) => a + b, 0) / forces.length : 0;
    const mx = forces.length ? Math.max(...forces) : 0;
    const mn = forces.length ? Math.min(...forces) : 0;
    const fatiguePct = mx > 0 ? Math.round(((mx - mn) / mx) * 1000) / 10 : 0;
    return { week: idx + 1, weekStartIso: ws, avg: Math.round(avg * 10) / 10, max: Math.round(mx * 10) / 10, min: Math.round(mn * 10) / 10, fatiguePct, trials: arr.length };
  });
}

export function recalcWeeklyHistory(): WeeklyForceStats[] {
  const trials = loadForceTrials();
  const stats = buildWeeklyStats(trials, 12);
  saveWeeklyForceStats(stats);
  return stats;
}

export function fatigueTrend(stats: WeeklyForceStats[]): { first: number; last: number; delta: number; improving: boolean; text: string } | null {
  if (stats.length < 2) return null;
  const first = stats[0].fatiguePct;
  const last = stats[stats.length - 1].fatiguePct;
  const delta = Math.round((last - first) * 10) / 10;
  const improving = last < first;
  const text = improving ? `Усталость ↓ ${Math.abs(delta)}% за ${stats.length} нед — адаптация (как патент 10%→4.5%)` : `Усталость ↑ ${Math.abs(delta)}% — недовосстановление, добавить делод`;
  return { first, last, delta, improving, text };
}

export function forceTrend(stats: WeeklyForceStats[]): { avgDelta: number; maxDelta: number; text: string } | null {
  if (stats.length < 2) return null;
  const first = stats[0];
  const last = stats[stats.length - 1];
  const avgDelta = Math.round((last.avg - first.avg) * 10) / 10;
  const maxDelta = Math.round((last.max - first.max) * 10) / 10;
  const text = avgDelta > 0 ? `Avg +${avgDelta}кг, Max +${maxDelta}кг за ${stats.length}нед — прогресс (патент 200→260 avg, 250→310 max)` : `Стагнация avg ${avgDelta}кг — проверить объём/восстановление`;
  return { avgDelta, maxDelta, text };
}

export function weeklyForceAdvice(stats: WeeklyForceStats[]): string[] {
  const out: string[] = [];
  const ft = fatigueTrend(stats);
  if (ft) out.push(ft.text);
  const tr = forceTrend(stats);
  if (tr) out.push(tr.text);
  if (stats.length && stats[stats.length - 1].fatiguePct > 15) out.push('Fatigue >15% — снизить side/stress недели, +1 день отдыха');
  return out;
}
