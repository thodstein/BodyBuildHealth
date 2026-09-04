/**
 * arm-diary-weak-detection.engine.ts — дневник тренировок → слабые арм-мышцы (E7 P0).
 * Parity: PL `detectWeakMusclesByE1rm` + BB `volumeHistory28d/e1rmTrend28d`.
 * e1RM по Epley; два 28-дневных окна: −5% → weak, рост ≤+1% при ≥2 сессиях → plateau.
 */
import type { ArmWeakPoint } from './arm-biomechanics.engine';
import { ARM_BIOMECH } from './arm-biomechanics.engine';

export interface ArmDiarySession {
  date: string;
  exercises: Array<{
    exerciseName?: string;
    name?: string;
    muscleGroup?: string;
    muscle?: string;
    sets: Array<{ weightKg: number; reps: number }>;
  }>;
}

export interface ArmMuscleTrend {
  muscle: string;
  deltaPct: number;
  sessions: number;
  status: 'weak' | 'plateau' | 'ok';
}

export function epley1RM(weightKg: number, reps: number): number {
  const w = Number(weightKg);
  const r = Number(reps);
  if (!Number.isFinite(w) || !Number.isFinite(r) || w <= 0 || r <= 0) return 0;
  if (r === 1) return w;
  return w * (1 + r / 30);
}

const ARM_MUSCLE_ALIASES: Array<{ re: RegExp; muscle: string }> = [
  { re: /пронац/i, muscle: 'pronators' },
  { re: /супинац/i, muscle: 'supinators' },
  { re: /сгибан.*кист|wrist.*curl|cup/i, muscle: 'wrist_flexors' },
  { re: /разгибан.*кист|wrist.*ext/i, muscle: 'wrist_extensors' },
  { re: /riser|rising|пальц/i, muscle: 'risers' },
  { re: /молот|hammer|брахиалис/i, muscle: 'brachialis' },
  { re: /бицепс|biceps|curl/i, muscle: 'biceps_long' },
  { re: /lat.?drag|тяга.*себя|back.?press/i, muscle: 'back_pressure' },
  { re: /боков|side/i, muscle: 'side_pressure' },
  { re: /rolling|axle|support|хват/i, muscle: 'grip_support' },
  { re: /pinch|hub|щипок/i, muscle: 'grip_pinch' },
  { re: /thumb|больш.*палец/i, muscle: 'thumb' },
  { re: /плеч|shoulder/i, muscle: 'shoulder_stab' },
];

export function armMuscleOfExercise(ex: { exerciseName?: string; name?: string; muscleGroup?: string; muscle?: string }): string | null {
  const direct = String((ex as any)?.muscleGroup || (ex as any)?.muscle || '').toLowerCase().trim();
  if (direct) return direct;
  const nm = String((ex as any)?.exerciseName || (ex as any)?.name || '');
  for (const a of ARM_MUSCLE_ALIASES) if (a.re.test(nm)) return a.muscle;
  return null;
}

function dayNum(iso: string): number {
  const t = new Date(iso + 'T12:00:00').getTime();
  return Number.isFinite(t) ? Math.floor(t / 86400000) : NaN;
}

export function armVolumeHistory28d(sessions: ArmDiarySession[]): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  try {
    const today = Math.floor(Date.now() / 86400000);
    for (let w = 3; w >= 0; w--) {
      const from = today - (w + 1) * 7;
      const to = today - w * 7;
      const bucket: Record<string, number> = {};
      for (const s of sessions || []) {
        const d = dayNum(String((s as any)?.date || '').slice(0, 10));
        if (!Number.isFinite(d) || d < from || d >= to) continue;
        for (const ex of (s as any)?.exercises || []) {
          const m = armMuscleOfExercise(ex as any);
          if (!m) continue;
          const cnt = Array.isArray((ex as any)?.sets) ? (ex as any).sets.length : 0;
          bucket[m] = (bucket[m] || 0) + cnt;
        }
      }
      for (const [m, v] of Object.entries(bucket)) {
        if (!out[m]) out[m] = [];
        out[m].push(v);
      }
    }
  } catch { /* noop */ }
  return out;
}

export function detectArmWeakByE1rm(sessions: ArmDiarySession[], referenceIso?: string): ArmMuscleTrend[] {
  const refDay = referenceIso ? dayNum(referenceIso.slice(0, 10)) : Math.floor(Date.now() / 86400000);
  if (!Number.isFinite(refDay)) return [];
  const recent: Record<string, number[]> = {};
  const old: Record<string, number[]> = {};
  const recentSess: Record<string, number> = {};
  const oldSess: Record<string, number> = {};
  try {
    for (const s of sessions || []) {
      const d = dayNum(String((s as any)?.date || '').slice(0, 10));
      if (!Number.isFinite(d)) continue;
      const age = refDay - d;
      const bucket = age >= 0 && age < 28 ? recent : age >= 28 && age < 56 ? old : null;
      if (!bucket) continue;
      const sessCount = bucket === recent ? recentSess : oldSess;
      for (const ex of (s as any)?.exercises || []) {
        const m = armMuscleOfExercise(ex as any);
        if (!m) continue;
        const sets = Array.isArray((ex as any)?.sets) ? (ex as any).sets : [];
        let best = 0;
        for (const st of sets) {
          const e = epley1RM(Number((st as any)?.weightKg), Number((st as any)?.reps));
          if (e > best) best = e;
        }
        if (best <= 0) continue;
        bucket[m] = bucket[m] || [];
        bucket[m].push(best);
        sessCount[m] = (sessCount[m] || 0) + 1;
      }
    }
  } catch { /* noop */ }
  const out: ArmMuscleTrend[] = [];
  for (const m of Object.keys(recent)) {
    const rBest = Math.max(...recent[m]);
    const oBest = old[m] && old[m].length ? Math.max(...old[m]) : null;
    if (oBest == null || oBest <= 0) continue;
    const deltaPct = Math.round(((rBest - oBest) / oBest) * 1000) / 10;
    const sessions = recentSess[m] || 0;
    let status: ArmMuscleTrend['status'] = 'ok';
    if (deltaPct <= -5) status = 'weak';
    else if (deltaPct <= 1 && sessions >= 2) status = 'plateau';
    if (status !== 'ok') out.push({ muscle: m, deltaPct, sessions, status });
  }
  out.sort((a, b) => a.deltaPct - b.deltaPct);
  return out.slice(0, 4);
}

/** Подсказка точек по мышцам дневника: мышца → точки ARM_BIOMECH, её содержащие. */
export function armPointsForMuscles(muscles: string[]): ArmWeakPoint[] {
  const out: ArmWeakPoint[] = [];
  for (const m of muscles) {
    for (const [wp, bio] of Object.entries(ARM_BIOMECH) as Array<[ArmWeakPoint, { weakMuscles: string[] }]>) {
      if (bio.weakMuscles.includes(m) && !out.includes(wp)) out.push(wp);
    }
  }
  return out.slice(0, 3);
}
