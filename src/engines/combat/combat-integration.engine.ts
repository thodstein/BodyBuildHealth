/**
 * combat-integration.engine.ts — мосты к дневнику/питанию/кардио (изолировано).
 */

import type { CombatPlan } from './combat.types';

export interface CombatDiaryStats {
  totalSetsLastWeek: number;
  avgRPE: number;
  acwrRatio: number | null;
  acwrZone: string | null;
}

export function combatDiaryStatsFromSessions(sessions: Array<{ date: string; load?: number; rpe?: number }>): CombatDiaryStats | null {
  if (!Array.isArray(sessions) || sessions.length === 0) return null;
  const lastWeek = sessions.slice(-7);
  const totalSetsLastWeek = lastWeek.reduce((a, s: any) => a + (s.sets || s.load || 0), 0);
  const avgRPE = lastWeek.reduce((a, s: any) => a + (s.rpe || s.sRPE || 5), 0) / Math.max(1, lastWeek.length);
  return { totalSetsLastWeek, avgRPE: Math.round(avgRPE * 10) / 10, acwrRatio: null, acwrZone: null };
}

export function combatToNutritionPayload(plan: CombatPlan): { kcal: number | null; proteinG: number | null; carbsG: number | null; note: string } {
  const weeks = plan.weeksData;
  const avgSets = weeks.reduce((a, w) => a + (w.totalSets || 0), 0) / Math.max(1, weeks.length);
  // грубая оценка: 40ккал/сет тяж, 25/памп
  const kcal = Math.round(avgSets * 38 * (plan.weeksData[0]?.sessions.length || 3) / 3);
  const bw = (plan.inputSnapshot as any)?.bodyweight || 80;
  const protein = Math.round(bw * ((plan.goal === 'weight_cut') ? 2.3 : 2.0));
  const carbs = Math.round(bw * ((plan.goal === 'weight_cut') ? 3 : 5));
  return { kcal, proteinG: protein, carbsG: carbs, note: `Оценка под план ${plan.discipline} avg ${Math.round(avgSets)} сетов/нед — ккал ${kcal} ориентир + TDEE` };
}

export function combatToCardioPayload(plan: CombatPlan): { zone2MinPerWeek: number; hiitSessions: number } | null {
  const cond = (plan as any).conditioning as { sessions: any[][] } | null | undefined;
  if (!cond) return null;
  let zone2 = 0; let hiit = 0;
  for (const week of cond.sessions) for (const s of (week as any[])) {
    if ((s as any).modality === 'aerobic') zone2 += (s as any).durationMin || 0;
    if ((s as any).modality === 'alactic' || (s as any).modality === 'lactic') hiit += 1;
  }
  const weeks = (plan as any).weeks || 1;
  return { zone2MinPerWeek: Math.round(zone2 / weeks), hiitSessions: Math.round(hiit / weeks) };
}
