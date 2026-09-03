/**
 * strength-sport-diary.engine.ts — per-exercise e1RM тренд для ТА/стронга.
 * Порт bb-progression-feedback + lms-progression-feedback → изолированно.
 * Читает логи дневника (he_workout_log / he_training_log) и считает epley тренд 28д.
 */

import { estimate1RMFromVelocitySS } from './strength-sport-vbt.engine';

export interface DiaryTrendSS {
  lift: string; // snatch | clean | squat | deadlift (канон)
  changePct: number;
  recentMax: number;
  prevMax: number;
}

function epley(weight: number, reps: number): number {
  // PRO: для ТА reps>5 невалидны — Epley завышает, используем Brzycki с cap 3 для oly
  if (reps > 5) reps = 5;
  return weight * (1 + reps / 30);
}
function brzycki(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  if (reps > 10) reps = 10;
  return weight * (36 / (37 - reps));
}
function isOlyLift(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes('snatch') || n.includes('рывок') || n.includes('clean') || n.includes('толчок') || n.includes('jerk');
}
function epleyForLift(weight: number, reps: number, name: string, velocity?: number): number {
  // P0-2: если есть velocity и лифт TA/carry — используем LVP e1RM (Wood 2026) — чистый импорт, без require
  if (typeof velocity === 'number' && Number.isFinite(velocity) && velocity > 0.2 && velocity < 4) {
    try {
      const byVel: number = estimate1RMFromVelocitySS(weight, velocity, name);
      if (Number.isFinite(byVel) && byVel > 0) return byVel;
    } catch {}
  }
  // Oly: Brzycki с cap 3, силовые — Epley
  if (isOlyLift(name) && reps > 3) return brzycki(weight, 3);
  if (isOlyLift(name)) return brzycki(weight, reps);
  return epley(weight, reps);
}

function liftKeyForExercise(name: string): string | null {
  const n = name.toLowerCase();
  // порядок: специфичные перед общими (press до deadlift, snatch до pull)
  if (n.includes('snatch') || n.includes('рывок')) return 'snatch';
  if (n.includes('clean') || n.includes('толчок') || n.includes('jerk')) return 'clean';
  if (n.includes('front_squat') || n.includes('back_squat') || n.includes('overhead_squat')) return 'squat';
  if (n.includes('squat') || n.includes('присед')) return 'squat';
  if (n.includes('press') || n.includes('log') || n.includes('ohp') || n.includes('жим')) return 'overhead';
  if (n.includes('deadlift') || n.includes('тяга') || n.includes('rdl')) return 'deadlift';
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
      // PRO: игнорируем warmupSets если есть флаг isWarmup — берём только рабочие (weight > 40% e1RM)
      const workSets = (e.sets as any[]).filter((s: any) => !s.isWarmup && Number(s.weight) > 0);
      if (workSets.length === 0) continue;
      const d = String(e.date || '');
      const t = new Date(d).getTime();
      if (!Number.isFinite(t)) continue;
      const maxE1 = Math.max(...workSets.map((s: any) => epleyForLift(Number(s.weight) || 0, Number(s.reps) || 0, n, typeof s.velocity === 'number' ? s.velocity : typeof s.v === 'number' ? s.v : undefined))).valueOf();
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
        // PRO: plateau детекция: если changePct в [-2,2] и recentVals.length>=3 — plateau
        const isPlateau = Math.abs(changePct) < 2 && recentVals.length >= 3;
        out.push({ lift, changePct, recentMax: Math.round(maxR), prevMax: Math.round(maxP), plateau: isPlateau } as any);
      }
    }
  }
  return out.length ? out : null;
}
export function detectPlateau(logs: any[], lift: string): boolean {
  const trend = buildDiaryTrendSS(logs);
  const t = trend?.find(x => x.lift === lift);
  return !!(t && Math.abs(t.changePct) < 2);
}

/** @deprecated impure — используйте buildDiaryTrendSS(logs) с явным массивом (чистый). Оставлен для обратной совместимости UI. */
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

// ACWR EWMA как в cardio-diary.engine: α=0.25 acute 7д, chronic 28д
export function acwrEwmaSS(dailyLoads: number[], alpha = 0.25): { acute: number; chronic: number; ratio: number; zone: 'undertrained'|'optimal'|'caution'|'dangerous' } | null {
  if (!Array.isArray(dailyLoads) || dailyLoads.length < 7) return null;
  const ewma = (arr: number[]) => {
    let v = arr[0];
    for (let i=1;i<arr.length;i++) v = alpha*arr[i] + (1-alpha)*v;
    return v;
  };
  const acuteArr = dailyLoads.slice(-7);
  const chronicArr = dailyLoads.slice(-28);
  const acute = ewma(acuteArr);
  const chronic = ewma(chronicArr);
  const ratio = chronic > 0 ? acute/chronic : 0;
  let zone: 'undertrained'|'optimal'|'caution'|'dangerous' = 'optimal';
  if (ratio < 0.8) zone = 'undertrained';
  else if (ratio > 1.5) zone = 'dangerous';
  else if (ratio > 1.3) zone = 'caution';
  return { acute: Math.round(acute*10)/10, chronic: Math.round(chronic*10)/10, ratio: Math.round(ratio*100)/100, zone };
}

// Per-exercise last e1RM index как в bb-progression-feedback (P0-2: с velocity)
export function buildLastE1RMIndexSS(logs: any[]): Record<string, number> {
  const idx: Record<string, number> = {};
  for (const e of logs) {
    const name = String(e.exerciseName || e.name || '');
    const sets = Array.isArray(e.sets) ? e.sets : [];
    let best = 0;
    for (const s of sets) {
      const w = Number(s.weight)||0; const r = Number(s.reps)||0;
      const v = typeof (s as any).velocity === 'number' ? (s as any).velocity : typeof (s as any).v === 'number' ? (s as any).v : undefined;
      if (w>0 && (r>0 || (v!=null && v>0))) best = Math.max(best, epleyForLift(w, r>0?r:1, name, v));
    }
    if (best>0) idx[name.toLowerCase()] = Math.max(idx[name.toLowerCase()]||0, best);
  }
  return idx;
}
