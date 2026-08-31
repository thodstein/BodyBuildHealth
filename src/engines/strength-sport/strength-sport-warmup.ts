/**
 * strength-sport-warmup.ts — изолированный warmup ramp (как bb warmupRampFor но для штанги).
 */
export interface WarmSet { reps: number; rir: number; weight: number; }
export function warmupRampFor(weight: number, id?: string, level?: string): WarmSet[] {
  if (!weight || weight < 15) return [];
  const isOly = !!id && ['snatch','clean','jerk','pull','balance','overhead_squat'].some(k=> id.includes(k));
  const isCarry = !!id && ['yoke','farmers','carry','stone','tire','sled'].some(k=> id.includes(k));
  if (isOly) {
    const out: WarmSet[] = [];
    // PRO: пустой гриф 20кг для ТА <40кг рабочего
    if (weight <= 40) { out.push({ reps: 5, rir: 5, weight: 20 }); return out; }
    out.push({ reps: 5, rir: 4, weight: Math.round(weight * 0.40 / 1) * 1 });
    if (weight > 40) out.push({ reps: 3, rir: 3, weight: Math.round(weight * 0.60 / 1) * 1 });
    if (weight > 70) out.push({ reps: 2, rir: 2, weight: Math.round(weight * 0.80 / 1) * 1 });
    if (level === 'beginner' && weight > 30) out.unshift({ reps: 8, rir: 5, weight: 20 });
    return out;
  }
  if (isCarry) {
    // PRO: фермер/йок — дистанция, brace: 50% 20м + 70% 20м + 85% 10м
    const out: WarmSet[] = [];
    out.push({ reps: 1, rir: 4, weight: Math.round(weight * 0.50 / 2.5) * 2.5 });
    if (weight > 80) out.push({ reps: 1, rir: 3, weight: Math.round(weight * 0.70 / 2.5) * 2.5 });
    if (weight > 140) out.push({ reps: 1, rir: 2, weight: Math.round(weight * 0.85 / 2.5) * 2.5 });
    return out;
  }
  // камень/мешок — lap техника
  if (id && ['stone','sandbag','keg','tire'].some(k=> id.includes(k))) {
    const out: WarmSet[] = [];
    out.push({ reps: 1, rir: 4, weight: Math.round(weight * 0.50 / 2.5) * 2.5 }); // lap
    if (weight > 60) out.push({ reps: 1, rir: 3, weight: Math.round(weight * 0.70 / 2.5) * 2.5 });
    return out;
  }
  const out: WarmSet[] = [];
  out.push({ reps: 12, rir: 5, weight: Math.round(weight * 0.40 / 2.5) * 2.5 });
  if (weight > 40) out.push({ reps: 8, rir: 4, weight: Math.round(weight * 0.55 / 2.5) * 2.5 });
  if (weight > 60) out.push({ reps: 5, rir: 3, weight: Math.round(weight * 0.70 / 2.5) * 2.5 });
  if (weight > 100) out.push({ reps: 3, rir: 2, weight: Math.round(weight * 0.85 / 2.5) * 2.5 });
  return out;
}
