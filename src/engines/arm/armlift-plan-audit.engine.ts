/**
 * armlift-plan-audit.engine.ts — ROUND-10: аудит собранного армлифтинг-плана по 5 звеньям.
 * Parity: arm `auditArmPlan` (12 точек), TA `auditTAPlan`, SM `auditSMPlan`, BB plan-audit.
 * Чистые функции: какие звенья закрыты планом (по пулам библиотеки коррекции), table/gym,
 * дубли. Ничего не мутирует, сборку не меняет — только чтение плана.
 */
import type { ArmliftWeakLink } from './armlift-diagnosis.engine';
import { armliftLinkPoolIds } from './armlift-correction.engine';

export const ARMLIFT_AUDIT_LINKS: ArmliftWeakLink[] = ['thumb', 'fingers', 'wrist_ext', 'support_endurance', 'crush'];

export interface ArmliftPlanAudit {
  covered: ArmliftWeakLink[];
  missing: ArmliftWeakLink[];
  coveragePct: number;
  byLink: Record<string, { sets: number; sessions: string[] }>;
  tableSets: number;
  gymSets: number;
  tableRatio: number;
  totalSets: number;
  duplicates: string[];
}

interface PlanItem {
  id: string;
  sessionTag: string;
  sets: number;
  isTable?: boolean;
}

function planItems(plan: unknown): PlanItem[] {
  const out: PlanItem[] = [];
  try {
    const weeks = (plan as { weeks?: unknown[] })?.weeks || [];
    for (const wk of weeks) {
      for (const s of ((wk as { sessions?: unknown[] })?.sessions || [])) {
        for (const ex of ((s as { exercises?: unknown[] })?.exercises || [])) {
          const id = String((ex as { exerciseId?: unknown })?.exerciseId || '').toLowerCase();
          if (!id) continue;
          out.push({
            id,
            sessionTag: String((s as { sessionTag?: unknown })?.sessionTag || ''),
            sets: Number((ex as { sets?: unknown })?.sets || 0),
            isTable: !!(ex as { isTable?: unknown })?.isTable,
          });
        }
      }
    }
  } catch { /* noop */ }
  return out;
}

export function auditArmliftPlan(plan: unknown): ArmliftPlanAudit | null {
  if (!plan || !Array.isArray((plan as { weeks?: unknown[] })?.weeks) || !(plan as { weeks: unknown[] }).weeks.length) return null;
  const items = planItems(plan);
  const byLink: Record<string, { sets: number; sessions: string[] }> = {};
  const covered: ArmliftWeakLink[] = [];
  for (const link of ARMLIFT_AUDIT_LINKS) {
    const pool = new Set(armliftLinkPoolIds(link));
    let sets = 0;
    const sessions = new Set<string>();
    for (const it of items) {
      if (!pool.has(it.id)) continue;
      sets += it.sets;
      if (it.sessionTag) sessions.add(it.sessionTag);
    }
    byLink[link] = { sets, sessions: Array.from(sessions) };
    if (sets > 0) covered.push(link);
  }
  const missing = ARMLIFT_AUDIT_LINKS.filter((l) => !covered.includes(l));
  const coveragePct = Math.round((covered.length / ARMLIFT_AUDIT_LINKS.length) * 100);
  let tableSets = 0;
  let gymSets = 0;
  for (const it of items) {
    if (it.isTable) tableSets += it.sets;
    else gymSets += it.sets;
  }
  const total = tableSets + gymSets;
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
    byLink,
    tableSets,
    gymSets,
    tableRatio: total > 0 ? Math.round((tableSets / total) * 100) / 100 : 0,
    totalSets: total,
    duplicates,
  };
}

/** Худшее звено плана: минимум сетов покрытия (0 = дыра); без плана — первый из списка. */
export function worstArmliftLink(plan: unknown, links: ArmliftWeakLink[] = ARMLIFT_AUDIT_LINKS): ArmliftWeakLink | null {
  if (!links || !links.length) return null;
  const audit = auditArmliftPlan(plan);
  if (!audit) return links[0] || null;
  let worst: ArmliftWeakLink | null = null;
  let min = Number.POSITIVE_INFINITY;
  for (const l of links) {
    const sets = audit.byLink[l]?.sets ?? 0;
    if (sets < min) { min = sets; worst = l; }
  }
  return worst;
}
