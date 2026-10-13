/**
 * arm-plan-audit.engine.ts — аудит арм-плана по 12 мёртвым точкам (E1 P0).
 * Parity: bb `auditPlanExercises` + TA E1 `auditTAPlan`, упрощённо под арм.
 * Чистые функции: какие точки покрыты планом, table/gym и static/dynamic сплиты, дубли.
 *
 * Аудит 2026-10 (3 фикса):
 *  1. Покрытие матчилось ТОЛЬКО по базе ARM_CORRECTIONS, хотя ранжир/инъекция вставляют
 *     упражнения из расширенного пула (POOL_TOPUP) — точка после ротации/⭐ числилась
 *     непокрытой, coveragePct был занижен, worstArmPoint выбирал фактически покрытую точку.
 *     Теперь единый пул `poolWithTopup`.
 *  2. `byPoint.sets` суммировался по ВСЕМ неделям плана, а пороги weak-cause («0–2 сета —
 *     не покрыта») рассчитаны на НЕДЕЛЮ → на 12-недельном плане причина «объём» не
 *     выявлялась никогда. Добавлены setsLastWeek/setsPerWeek.
 *  3. Дубли считались по ВСЕМУ плану, хотя комментарий обещал «неделю-1» — штатная ротация
 *     (wrist_curl_db в трех разных днях) помечалась дублем, а реальное 12-недельное
 *     повторение одного id в одной сессии — нет. Теперь скоуп недели 1.
 */
import type { ArmPlan } from './arm-types';
import type { ArmWeakPoint } from './arm-biomechanics.engine';
import { ARM_WEAK_POINTS } from './arm-biomechanics.engine';
import { poolWithTopup } from './arm-correction-pro2.engine';

export interface ArmPlanAudit {
  covered: ArmWeakPoint[];
  missing: ArmWeakPoint[];
  coveragePct: number;
  tableSets: number;
  gymSets: number;
  tableRatio: number;
  staticSets: number;
  dynamicSets: number;
  byPoint: Record<string, { sets: number; setsLastWeek: number | null; setsPerWeek: number | null; sessions: string[] }>;
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
  const byPoint: Record<string, { sets: number; setsLastWeek: number | null; setsPerWeek: number | null; sessions: string[] }> = {};
  const covered: ArmWeakPoint[] = [];
  for (const wp of ARM_WEAK_POINTS) {
    // Аудит 2026-10 (1): единый пул с топапом — иначе вставленная/ранжированная коррекция
    // из POOL_TOPUP не засчитывалась как покрытие.
    const pool = poolWithTopup(wp).map((s) => s.toLowerCase());
    let sets = 0;
    let setsLastWeek = 0;
    let hasLastWeek = false;
    const sessions = new Set<string>();
    for (const it of items) {
      if (!pool.includes(it.id)) continue;
      sets += it.sets;
      if (it.sessionTag) sessions.add(it.sessionTag);
    }
    // Аудит 2026-10 (2): недельный норм — последняя РАБОЧАЯ неделя плана (не делод)
    for (let i = (plan as any).weeks.length - 1; i >= 0; i--) {
      const wk: any = (plan as any).weeks[i];
      if (!wk || wk.deload || wk.taper) continue;
      let t = 0;
      for (const s of wk?.sessions || []) for (const ex of (s as any)?.exercises || []) {
        const id = String((ex as any)?.exerciseId || '').toLowerCase();
        if (pool.includes(id)) t += (Number((ex as any)?.sets) || 0);
      }
      setsLastWeek = t;
      hasLastWeek = true;
      break;
    }
    byPoint[wp] = {
      sets,
      setsLastWeek: hasLastWeek ? setsLastWeek : null,
      setsPerWeek: hasLastWeek ? Math.round((sets / (plan as any).weeks.length) * 100) / 100 : null,
      sessions: Array.from(sessions),
    };
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
  // Аудит 2026-10 (3): дубли считаются по ПЕРВОЙ неделе (как и обещал комментарий) —
  // по всему плану их давала бы штатная ротация упражнения между днями микро-цикла.
  const byIdSessions = new Map<string, Set<string>>();
  const w0: any = (plan as any).weeks[0];
  for (const s of w0?.sessions || []) {
    for (const ex of (s as any)?.exercises || []) {
      const id = String((ex as any)?.exerciseId || '').toLowerCase();
      if (!id) continue;
      if (!byIdSessions.has(id)) byIdSessions.set(id, new Set());
      if (s?.sessionTag) byIdSessions.get(id)!.add(String(s.sessionTag));
    }
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
