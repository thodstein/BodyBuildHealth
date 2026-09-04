/**
 * arm-plan-audit.engine.ts — аудит арм-плана по 12 мёртвым точкам (E1 P0).
 * Parity: bb `auditPlanExercises` + TA E1 `auditTAPlan`, упрощённо под арм.
 * Чистые функции: какие точки покрыты планом, table/gym и static/dynamic сплиты, дубли.
 */
import type { ArmPlan } from './arm-types';
import type { ArmWeakPoint } from './arm-biomechanics.engine';
import { ARM_WEAK_POINTS } from './arm-biomechanics.engine';
import { ARM_CORRECTIONS } from './arm-weakpoint-corrections';

export interface ArmPlanAudit {
  covered: ArmWeakPoint[];
  missing: ArmWeakPoint[];
  coveragePct: number;
  tableSets: number;
  gymSets: number;
  tableRatio: number;
  staticSets: number;
  dynamicSets: number;
  byPoint: Record<string, { sets: number; sessions: string[] }>;
  duplicates: string[];
}

function planExerciseIds(plan: ArmPlan): Array<{ id: string; sessionTag: string; sets: number; isTable?: boolean; isStatic?: boolean }> {
  const out: Array<{ id: string; sessionTag: string; sets: number; isTable?: boolean; isStatic?: boolean }> = [];
  try {
    for (const wk of plan?.weeks || []) {
      for (const s of wk?.sessions || []) {
        for (const ex of (s as any)?.exercises || []) {
          const id = String((ex as any)?.exerciseId || '').toLowerCase();
          if (!id) continue;
          out.push({ id, sessionTag: String((s as any)?.sessionTag || ''), sets: Number((ex as any)?.sets || 0), isTable: !!(ex as any)?.isTable, isStatic: !!(ex as any)?.isStatic });
        }
      }
    }
  } catch { /* noop */ }
  return out;
}

export function auditArmPlan(plan: ArmPlan | null | undefined): ArmPlanAudit | null {
  if (!plan || !Array.isArray((plan as any)?.weeks) || (plan as any).weeks.length === 0) return null;
  const items = planExerciseIds(plan);
  const byPoint: Record<string, { sets: number; sessions: string[] }> = {};
  const covered: ArmWeakPoint[] = [];
  for (const wp of ARM_WEAK_POINTS) {
    const corr = ARM_CORRECTIONS[wp];
    let sets = 0;
    const sessions = new Set<string>();
    for (const cand of corr?.exercises || []) {
      const low = cand.toLowerCase();
      for (const it of items) {
        if (it.id === low) {
          sets += it.sets;
          if (it.sessionTag) sessions.add(it.sessionTag);
        }
      }
    }
    byPoint[wp] = { sets, sessions: Array.from(sessions) };
    if (sets > 0) covered.push(wp);
  }
  const missing = ARM_WEAK_POINTS.filter((w) => !covered.includes(w));
  const coveragePct = Math.round((covered.length / ARM_WEAK_POINTS.length) * 100);
  let tableSets = 0;
  let gymSets = 0;
  let staticSets = 0;
  let dynamicSets = 0;
  for (const it of items) {
    if (it.isTable) tableSets += it.sets;
    else gymSets += it.sets;
    if (it.isStatic) staticSets += it.sets;
    else dynamicSets += it.sets;
  }
  const total = tableSets + gymSets;
  // дубли: один id в 2+ сессиях недели-1 (норма для ротации — помечаем только 3+)
  const byIdSessions = new Map<string, Set<string>>();
  for (const it of items) {
    if (!byIdSessions.has(it.id)) byIdSessions.set(it.id, new Set());
    if (it.sessionTag) byIdSessions.get(it.id)!.add(it.sessionTag);
  }
  const duplicates: string[] = [];
  for (const [id, set] of byIdSessions) if (set.size >= 3) duplicates.push(id);
  return {
    covered,
    missing,
    coveragePct,
    tableSets,
    gymSets,
    tableRatio: total > 0 ? Math.round((tableSets / total) * 100) / 100 : 0,
    staticSets,
    dynamicSets,
    byPoint,
    duplicates,
  };
}

/** Худшая точка плана среди выбранных: минимум сетов покрытия (0 = дыра). */
export function worstArmPoint(plan: ArmPlan | null | undefined, weakPoints: ArmWeakPoint[]): ArmWeakPoint | null {
  if (!weakPoints || weakPoints.length === 0) return null;
  const audit = auditArmPlan(plan);
  if (!audit) return weakPoints[0] || null;
  let worst: ArmWeakPoint | null = null;
  let worstSets = Infinity;
  for (const wp of weakPoints) {
    const sets = audit.byPoint[wp]?.sets ?? 0;
    if (sets < worstSets) {
      worstSets = sets;
      worst = wp;
    }
  }
  return worst;
}
