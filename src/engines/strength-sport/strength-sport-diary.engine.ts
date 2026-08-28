/**
 * strength-sport-diary.engine.ts — per-exercise e1RM тренд для ТА/стронга.
 * Порт bb-progression-feedback + lms-progression-feedback → изолированно.
 * Читает логи дневника (he_workout_log / he_training_log) и считает epley тренд 28д.
 */

export interface DiaryTrendSS {
  lift: string; // snatch | clean | squat | deadlift (канон)
  changePct: number;
  recentMax: number;
  prevMax: number;
}

function epley(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

function liftKeyForExercise(name: string): string | null {
  const n = name.toLowerCase();
  if (n.includes('snatch') || n.includes('рывок')) return 'snatch';
  if (n.includes('clean') || n.includes('толчок') || n.includes('jerk')) return 'clean';
  if (n.includes('squat') || n.includes('присед') || n.includes('front_squat')) return 'squat';
  if (n.includes('deadlift') || n.includes('тяга') || n.includes('rdl')) return 'deadlift';
  if (n.includes('press') || n.includes('log') || n.includes('ohp') || n.includes('жим')) return 'overhead';
  if (n.includes('farmers') || n.includes('yoke') || n.includes('carry')) return 'carry';
  if (n.includes('stone') || n.includes('sandbag') || n.includes('tire')) return 'stone';
  return null;
}

export function buildDiaryTrendSS(logs: any[]): DiaryTrendSS[] | null {
  if (!Array.isArray(logs) || logs.length === 0) return null;
  const now = Date.now();
  const dayMs = 24 * 3600 * 1000;
  const lifts = ['snatch', 'clean', 'squat', 'deadlift', 'overhead', 'carry', 'stone'] as const;
  const out: DiaryTrendSS[] = [];
  for (const lift of lifts) {
    const recentVals: number[] = [];
    const prevVals: number[] = [];
    for (const e of logs) {
      const n: string = String(e.exerciseName || e.name || '').toLowerCase();
      const key = liftKeyForExercise(n);
      if (key !== lift) continue;
      if (!Array.isArray(e.sets) || e.sets.length === 0) continue;
      const d = String(e.date || '');
      const t = new Date(d).getTime();
      if (!Number.isFinite(t)) continue;
      const maxE1 = Math.max(...(e.sets as any[]).map((s: any) => epley(Number(s.weight) || 0, Number(s.reps) || 0))).valueOf();
      if (!maxE1 || maxE1 <= 0) continue;
      const diff = now - t;
      if (diff >= 0 && diff <= 28 * dayMs) recentVals.push(maxE1);
      else if (diff > 28 * dayMs && diff <= 56 * dayMs) prevVals.push(maxE1);
    }
    if (recentVals.length && prevVals.length) {
      const maxR = Math.max(...recentVals);
      const maxP = Math.max(...prevVals);
      if (maxP > 0) {
        const changePct = Math.round(((maxR - maxP) / maxP * 100) * 10) / 10;
        out.push({ lift, changePct, recentMax: Math.round(maxR), prevMax: Math.round(maxP) });
      }
    }
  }
  return out.length ? out : null;
}

export function loadDiaryLogsSS(): any[] {
  try {
    for (const key of ['he_workout_log', 'he_training_log', 'he_workout_history', 'he_srpe_sessions']) {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
      if (!raw) continue;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length) return arr;
    }
  } catch {}
  return [];
}

export function getDiaryTrendSS(): DiaryTrendSS[] | null {
  const logs = loadDiaryLogsSS();
  return buildDiaryTrendSS(logs);
}
