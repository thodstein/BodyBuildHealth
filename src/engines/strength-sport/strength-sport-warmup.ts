/**
 * strength-sport-warmup.ts — изолированный warmup ramp (как bb warmupRampFor но для штанги).
 */
export interface WarmSet { reps: number; rir: number; weight: number; }
export function warmupRampFor(weight: number, id?: string): WarmSet[] {
  if (!weight || weight < 20) return [];
  const isOly = !!id && ['snatch','clean','jerk','pull','balance','overhead_squat'].some(k=> id.includes(k));
  const isCarry = !!id && ['yoke','farmers','carry','stone','tire','sled'].some(k=> id.includes(k));
  if (isOly) {
    const out: WarmSet[] = [];
    out.push({ reps: 5, rir: 4, weight: Math.round(weight * 0.40 / 2.5) * 2.5 });
    if (weight > 40) out.push({ reps: 3, rir: 3, weight: Math.round(weight * 0.60 / 2.5) * 2.5 });
    if (weight > 70) out.push({ reps: 2, rir: 2, weight: Math.round(weight * 0.80 / 2.5) * 2.5 });
    return out;
  }
  if (isCarry) {
    const out: WarmSet[] = [];
    out.push({ reps: 20, rir: 4, weight: Math.round(weight * 0.50 / 2.5) * 2.5 });
    return out;
  }
  const out: WarmSet[] = [];
  out.push({ reps: 12, rir: 5, weight: Math.round(weight * 0.40 / 2.5) * 2.5 });
  if (weight > 40) out.push({ reps: 8, rir: 4, weight: Math.round(weight * 0.55 / 2.5) * 2.5 });
  if (weight > 60) out.push({ reps: 5, rir: 3, weight: Math.round(weight * 0.70 / 2.5) * 2.5 });
  if (weight > 100) out.push({ reps: 3, rir: 2, weight: Math.round(weight * 0.85 / 2.5) * 2.5 });
  return out;
}
