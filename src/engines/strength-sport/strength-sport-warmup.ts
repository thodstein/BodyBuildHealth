/**
 * strength-sport-warmup.ts — изолированный warmup ramp (как bb warmupRampFor но для штанги).
 */
export interface WarmSet { reps: number; rir: number; weight: number; }
export function warmupRampFor(weight: number): WarmSet[] {
  if (!weight || weight < 20) return [];
  const out: WarmSet[] = [];
  // bar x15, 50% x8, 70% x5, 85% x2
  out.push({ reps: 12, rir: 5, weight: Math.round(weight * 0.40 / 2.5) * 2.5 });
  if (weight > 40) out.push({ reps: 8, rir: 4, weight: Math.round(weight * 0.55 / 2.5) * 2.5 });
  if (weight > 60) out.push({ reps: 5, rir: 3, weight: Math.round(weight * 0.70 / 2.5) * 2.5 });
  if (weight > 100) out.push({ reps: 3, rir: 2, weight: Math.round(weight * 0.85 / 2.5) * 2.5 });
  return out;
}
