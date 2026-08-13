/**
 * training-integration.engine.ts — мост между СРЦ/BB-планами и существующими движками
 * (Этап INT1-INT4). Объединяет новые планировщики с workout-logger / gym-competition /
 * autoregulation-engine / peaking-engine без дублирования их логики.
 *
 * REUSE: workout-logger.engine, gym-competition.engine, autoregulation-engine, peaking-engine.
 */

import type { LMSBuildOutput, LMSPlanDay, LMSPlanExercise } from './lms/lms-builder.engine';
import type { BBPlan, BBSession, BBExercise } from './bb/bb-builder.engine';
import { calculatePlates, type PlateMathResult } from './gym-competition.engine';
import { autoregulate, type AutoregInput, type AutoregOutput } from './autoregulation-engine';
import { generatePLPeaking, generateBBPeaking, type PLPeakingInput, type BBPeakingInput } from './peaking-engine';

// ── workout-logger shape (локальные типы-мосты, чтобы не тащить весь workout-logger) ──
export interface BridgeSet { setNumber: number; weightKg: number; reps: number; rpe: number; rir: number; isPR: boolean; notes: string; }
export interface BridgeExercise { exerciseId: string; exerciseName: string; pattern: string; muscleGroup: string; order: number; sets: BridgeSet[]; totalVolume: number; best1RM: number; avgRPE: number; }
export interface BridgeSession { sessionId: string; date: string; focus: string; exercises: BridgeExercise[]; totalVolume: number; totalSets: number; totalReps: number; weekNumber: number; planned: boolean; source: 'SRC' | 'BB'; macroPhase?: string; taperWeek?: boolean; mockMeet?: boolean; meetWeek?: boolean; }

// ── INT1: конвертация планов в сессии workout-logger ──
function uid(prefix: string, i: number): string { return `${prefix}-${i}`; }

export function lmsPlanToSessions(plan: LMSBuildOutput): BridgeSession[] {
  const out: BridgeSession[] = [];
  let i = 0;
  for (const wk of plan.weeks) {
    for (let dayIdx = 0; dayIdx < wk.days.length; dayIdx++) {
      const day = wk.days[dayIdx];
      const exercises: BridgeExercise[] = day.exercises.map((ex: LMSPlanExercise, idx: number) => {
        const sets: BridgeSet[] = [];
        let sn = 1;
        for (const ws of ex.workSets) {
          for (let s = 0; s < ws.sets; s++) {
            sets.push({ setNumber: sn++, weightKg: ws.weight, reps: ws.reps, rpe: 10 - (ws.rir ?? 0), rir: ws.rir ?? 0, isPR: false, notes: `${Math.round(ws.pct * 100)}% PM · RIR ${ws.rir ?? 0}` });
          }
        }
        const totalVolume = sets.reduce((sum, s) => sum + s.weightKg * s.reps, 0);
        return { exerciseId: uid('ex', i * 100 + idx), exerciseName: ex.name, pattern: ex.group, muscleGroup: ex.group, order: idx + 1, sets, totalVolume, best1RM: ex.pm, avgRPE: 0 };
      });
      const totalVolume = exercises.reduce((s, e) => s + e.totalVolume, 0);
      const totalSets = exercises.reduce((s, e) => s + e.sets.length, 0);
      const totalReps = exercises.reduce((sum, e) => sum + e.sets.reduce((ss, s) => ss + s.reps, 0), 0);
      out.push({ sessionId: uid('src', i), date: '', focus: `Нед${wk.week} День${dayIdx + 1}`, exercises, totalVolume, totalSets, totalReps, weekNumber: wk.week, planned: true, source: 'SRC', macroPhase: wk.macroPhase, taperWeek: wk.taperWeek, mockMeet: wk.mockMeet, meetWeek: wk.meetWeek });
      i++;
    }
  }
  return out;
}

export function bbPlanToSessions(plan: BBPlan): BridgeSession[] {
  const out: BridgeSession[] = [];
  let i = 0;
  for (const wk of plan.weeks) {
    for (const sess of wk.sessions) {
      const exercises: BridgeExercise[] = sess.exercises.map((ex: BBExercise, idx: number) => {
        const sets: BridgeSet[] = ex.workSets.map((ws, k) => ({ setNumber: k + 1, weightKg: ws.weight, reps: ws.reps, rpe: 0, rir: ws.rir, isPR: false, notes: `${ex.character}/${ex.role}` }));
        const totalVolume = sets.reduce((sum, s) => sum + s.weightKg * s.reps, 0);
        return { exerciseId: uid('bbex', i * 100 + idx), exerciseName: ex.exerciseName || ex.muscle, pattern: sess.sessionTag || '', muscleGroup: ex.muscle, order: idx + 1, sets, totalVolume, best1RM: 0, avgRPE: 0 };
      });
      const totalVolume = exercises.reduce((s, e) => s + e.totalVolume, 0);
      const totalSets = exercises.reduce((s, e) => s + e.sets.length, 0);
      out.push({ sessionId: uid('bb', i), date: '', focus: `${sess.sessionTag || ''} ${sess.character}`, exercises, totalVolume, totalSets, totalReps: 0, weekNumber: wk.week, planned: true, source: 'BB' });
      i++;
    }
  }
  return out;
}

// ── INT2: plate-калькулятор для любого рабочего веса ──
export function platesForWeight(targetWeight: number, barWeight: number = 20): PlateMathResult {
  return calculatePlates(targetWeight, barWeight);
}

// ── INT4: авторегуляция плана по readiness ──
export interface ReadinessInput {
  priScore: number;      // 0-1
  fatigueScore: number;  // 0-1
  recoveryScore: number; // 0-1
  jointFatigue?: Record<string, number>; // per-joint fatigue (0-1 per joint)
  monotony?: number;     // weekly training monotony (0-5)
  strain?: number;       // weekly training strain
  riskLevel: 'low' | 'medium' | 'high';
  goal: string;
  plannedIntensity: number; // % 1RM (0-1 или 0-100)
  plannedSets: number;
  plannedReps: number;
  plannedFrequency: number;
}
export function autoregPlan(r: ReadinessInput): AutoregOutput {
  const input: AutoregInput = {
    priScore: r.priScore, fatigueScore: r.fatigueScore, recoveryScore: r.recoveryScore,
    jointFatigue: r.jointFatigue || {}, cumulativeLoad: { overload: r.fatigueScore > 0.7, monotony: r.monotony ?? (r.fatigueScore > 0.7 ? 2.5 : 0), strain: r.strain ?? r.fatigueScore },
    riskLevel: r.riskLevel, techniqueScore: r.recoveryScore, velocityTrend: 0,
    goal: r.goal, plannedIntensity: r.plannedIntensity, plannedSets: r.plannedSets,
    plannedReps: r.plannedReps, plannedFrequency: r.plannedFrequency, exerciseJointStress: {},
  };
  return autoregulate(input);
}

// ── INT3: выход на пик / соревновательная подготовка ──
export function peakForPLMeet(input: PLPeakingInput) {
  return generatePLPeaking(input);
}
export function peakForBBShow(input: BBPeakingInput) {
  return generateBBPeaking(input);
}

/** Сводка: применить autorég к сессии → рекомендации по объёму/интенсивности. */
export function explainAutoregForSession(sess: BridgeSession, readiness: ReadinessInput): string {
  const plannedIntensity = sess.exercises.length ? (sess.exercises[0].best1RM ? (sess.exercises[0].sets[0].weightKg / sess.exercises[0].best1RM) : 0.8) : 0.8;
  const r: ReadinessInput = { ...readiness, plannedIntensity: plannedIntensity * 100, plannedSets: sess.totalSets, plannedReps: sess.exercises[0]?.sets[0]?.reps || 8, plannedFrequency: 4 };
  const out = autoregPlan(r);
  return `Сессия «${sess.focus}»: ${out.summary}${out.sessionDowngraded ? ' → понижение нагрузки' : ''}${out.sessionCancelled ? ' → отмена' : ''}`;
}
// ── INT/T2: прогресс-трекинг (REUSE log-analytics-progression + progression.estimate1RM) ──
import { estimate1RM } from './progression.engine';
import { trackExerciseProgression, getAllExerciseProgressions, type ExerciseProgressionData } from './log-analytics-progression.engine';

export interface ProgressSnapshot {
  exercise: string;
  lastWeight: number;
  lastReps: number;
  estimated1RM: number;
  trend: 'up' | 'plateau' | 'down';
  note: string;
}

export function progressFromSessions(sessions: BridgeSession[]): ProgressSnapshot[] {
  // агрегируем лучший подход по каждому упражнению
  const byEx: Record<string, { w: number; r: number }> = {};
  for (const s of sessions) for (const e of s.exercises) {
    for (const set of e.sets) {
      const cur = byEx[e.exerciseName];
      const e1rm = estimate1RM(set.weightKg, set.reps);
      if (!cur || estimate1RM(cur.w, cur.r) < e1rm) byEx[e.exerciseName] = { w: set.weightKg, r: set.reps };
    }
  }
  return Object.entries(byEx).map(([name, v]) => ({
    exercise: name, lastWeight: v.w, lastReps: v.r, estimated1RM: estimate1RM(v.w, v.r),
    trend: 'up' as const, note: `Лучший подход: ${v.w}кг×${v.r} → e1RM ${estimate1RM(v.w, v.r).toFixed(1)}кг`,
  }));
}

// ── INT/T5: план vs факт (REUSE session-metrics-engine) ──
import { estimateSessionDifficulty, type SessionMetricsInput } from './session-metrics-engine';

export interface PlanVsFact {
  sessionFocus: string;
  plannedSets: number;
  plannedVolume: number;
  factSets?: number;
  factVolume?: number;
  realizationPct: number;   // факт/план по объёму
  difficulty?: any;
}

export function planVsFact(planned: BridgeSession, fact?: BridgeSession): PlanVsFact {
  const plannedSets = planned.totalSets;
  const plannedVolume = planned.totalVolume;
  const factSets = fact?.totalSets;
  const factVolume = fact?.totalVolume;
  const realizationPct = factVolume != null && plannedVolume > 0 ? factVolume / plannedVolume : 0;
  let difficulty: any = undefined;
  if (fact) {
    const mi: SessionMetricsInput = { totalVolume: fact.totalVolume, totalSets: fact.totalSets, durationMin: 60, bodyWeight: 80, rpeAvg: 7 } as any;
    try { difficulty = estimateSessionDifficulty(mi as any); } catch { difficulty = undefined; }
  }
  return { sessionFocus: planned.focus, plannedSets, plannedVolume, factSets, factVolume, realizationPct, difficulty };
}
