/**
 * combat-graphs.ts — чистый слой данных для графиков лагеря (E6).
 *
 * Раньше всё показывалось чипами: сравнить две недели «на глаз» было
 * невозможно, а динамику нагрузки не видел никто. Здесь считаются ТОЛЬКО
 * ряды и разметка; рисует UI.
 */
import type { CombatPlan, CombatPhase } from './combat.types';

export interface CampWeekPoint {
  week: number;
  phase: CombatPhase;
  deload: boolean;
  taper: boolean;
  sets: number;
  tonnage: number;
  sessions: number;
  exercises: number;
  /** Интенсивность недели = средняя доля 1ПМ по подходам, 0..1. */
  intensity: number;
  /** Доля недели от пиковой по объёму, 0..1. */
  volumeShare: number;
}

export interface CampSeries {
  points: CampWeekPoint[];
  maxSets: number;
  maxTonnage: number;
  /** Неделя с максимальным объёмом. */
  peakWeek: number;
  /** Средний объём по неделям. */
  avgSets: number;
  /** Сколько недель деload / taper. */
  deloadWeeks: number;
  taperWeeks: number;
  /** Размах объёма максимум/минимум. */
  volumeRange: number;
}

const num = (v: any) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function weekIntensity(plan: CombatPlan, wi: number): number {
  // Средняя интенсивность по подходам: для каждого сета вес / эталон 1ПМ.
  // Эталона 1ПМ в плане нет, поэтому берём отношение веса к максимуму
  // внутри своей группы упражнений — это честная относительная мера,
  // а не выдуманный процент 1ПМ.
  const w = plan.weeksData?.[wi];
  if (!w) return 0;
  const perMuscleMax = new Map<string, number>();
  for (const s of w.sessions || []) for (const e of s.exercises || []) {
    const m = perMuscleMax.get(e.group) ?? 0;
    if (num(e.weight) > m) perMuscleMax.set(e.group, num(e.weight));
  }
  let sum = 0, n = 0;
  for (const s of w.sessions || []) for (const e of s.exercises || []) {
    const mx = perMuscleMax.get(e.group) ?? 0;
    if (mx <= 0) continue;
    for (const set of e.workSets || []) {
      const v = num(set.weight) > 0 ? num(set.weight) : num(e.weight);
      if (v <= 0) continue;
      sum += Math.min(1.4, v / mx) / 1.4; n++;
    }
  }
  return n ? sum / n : 0;
}

export function buildCampSeries(plan: CombatPlan | null | undefined): CampSeries {
  const weeks = plan?.weeksData || [];
  const points: CampWeekPoint[] = weeks.map((w: any, i: number) => {
    const sets = num(w.totalSets);
    const sessions = (w.sessions || []).length;
    const exercises = (w.sessions || []).reduce((a: number, s: any) => a + (s.exercises?.length || 0), 0);
    const tonnage = (w.sessions || []).reduce(
      (a: number, s: any) => a + (s.exercises || []).reduce((b: number, e: any) => {
        const setsN = Math.max(1, num(e.sets) || (e.workSets?.length ?? 1));
        const reps = String(e.reps || '').split('-').reduce((mx, tok) => {
          const n = parseInt(tok, 10);
          return Number.isFinite(n) ? Math.max(mx, n) : mx;
        }, 0) || 1;
        return b + num(e.weight) * setsN * reps;
      }, 0), 0);
    return {
      week: num(w.week) || i + 1,
      phase: (w.phase || 'accumulation') as CombatPhase,
      deload: !!w.deload,
      taper: !!w.taper,
      sets: sets,
      tonnage: Math.round(tonnage),
      sessions,
      exercises,
      intensity: weekIntensity(plan!, i),
      volumeShare: 0,
    };
  });

  const maxSets = Math.max(0, ...points.map(p => p.sets));
  const maxTonnage = Math.max(0, ...points.map(p => p.tonnage));
  for (const p of points) p.volumeShare = maxSets > 0 ? p.sets / maxSets : 0;
  const peakWeek = points.reduce((b, p) => (p.sets > b.sets ? p : b), points[0] || ({ week: 0, sets: -1 } as CampWeekPoint)).week;
  const avgSets = points.length ? points.reduce((a, p) => a + p.sets, 0) / points.length : 0;
  const deloadWeeks = points.filter(p => p.deload).length;
  const taperWeeks = points.filter(p => p.taper).length;
  const minSets = points.length ? Math.min(...points.map(p => p.sets)) : 0;
  return {
    points, maxSets, maxTonnage, peakWeek, avgSets, deloadWeeks, taperWeeks,
    volumeRange: points.length > 1 ? maxSets - minSets : 0,
  };
}

/** Точки ломаной для SVG (x = 0..W, y = 0..H, y инвертирован — 0 сверху). */
export function polylinePoints(values: number[], max: number, w: number, h: number, pad = 2): { x: number; y: number }[] {
  const n = values.length;
  if (!n) return [];
  const stepX = n > 1 ? (w - pad * 2) / (n - 1) : 0;
  return values.map((v, i) => ({
    x: pad + i * stepX,
    y: pad + (1 - (max > 0 ? Math.max(0, Math.min(1, v / max)) : 0)) * (h - pad * 2),
  }));
}
