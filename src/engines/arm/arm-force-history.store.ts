/**
 * arm-force-history.store.ts — недельные avg/max/min + fatigue index (WO2026106582A1 патент-график).
 * Хранение: he_arm_force_trials (для Bezkorovainyi F100/F500); недельная статистика
 * считается на лету (buildWeeklyStats) — отдельного ключа истории нет (26.10.2026:
 * he_arm_force_history писался, но никем не читался — убран по классу «dead write»).
 * avg 200→260, max 250→310, min 180→240, fatigue 10%→4.5% за 12 нед — тренд адаптации.
 */
import { localIsoDate } from '../../core/local-date';
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
const TRIALS_KEY = 'he_arm_force_trials';

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  try { return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
}
// 26.10.2026 было→стало: toISOString() даёт UTC-день — в UTC+X вечерняя запись/снапшот
// уходили под «вчерашней» датой. Канон проекта — core/local-date.
function toIso(d: Date): string { return localIsoDate(d); }
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

const MEASURE_HIST_KEY = 'he_arm_measure_history';

export interface ArmMeasureSnapshot {
  date: string;
  rtKg?: number;
  sideKg?: number;
  backKg?: number;
  leftKg?: number;
  rightKg?: number;
}

/** Снапшоты замеров хвата/давления (E15 P2): кап 52, устойчив к битому JSON. */
export function loadArmMeasureHistory(): ArmMeasureSnapshot[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(MEASURE_HIST_KEY) : null;
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr.filter((e: any) => e && typeof e.date === 'string').slice(-52);
  } catch { return []; }
}

export function saveArmMeasureSnapshot(snap: Omit<ArmMeasureSnapshot, 'date'> & { date?: string }): ArmMeasureSnapshot[] {
  const nums: ArmMeasureSnapshot = { date: snap.date || localIsoDate() };
  for (const k of ['rtKg', 'sideKg', 'backKg', 'leftKg', 'rightKg'] as const) {
    const v = Number((snap as any)[k]);
    if (Number.isFinite(v) && v > 0) (nums as any)[k] = Math.round(v * 10) / 10;
  }
  if (Object.keys(nums).length <= 1) return loadArmMeasureHistory();
  const next = [...loadArmMeasureHistory(), nums].slice(-52);
  try { localStorage.setItem(MEASURE_HIST_KEY, JSON.stringify(next)); } catch { /* noop */ }
  return next;
}
