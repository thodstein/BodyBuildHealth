/**
 * combat-integration.engine.ts — мосты к дневнику/питанию/кардио (изолировано).
 */

import type { CombatPlan } from './combat.types';
import { weightCutNutritionForWeek, weightCutFiberForWeek, weightCutOrsProtocol, combatWeightCutToMealInput } from './combat-weight-cut.engine';

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

export function combatToNutritionPayload(plan: CombatPlan): { kcal: number | null; proteinG: number | null; carbsG: number | null; fatG: number | null; fiberG: number | null; waterMl: number | null; sodiumMg: number | null; note: string; weighInType?: string; orsMmol?: number; mealInput?: any } {
  const bw = (plan.inputSnapshot as any)?.bodyweight || 80;
  const sex = (plan.inputSnapshot as any)?.sex || 'male';
  const wcProtocol = (plan.inputSnapshot as any)?.weightCutProtocol || null;
  // если есть весогонка — берём точный nutrition из weight-cut (ISSN) для недели 1 (camp) как payload
  if (wcProtocol && bw > 30) {
    const nut = weightCutNutritionForWeek(1, plan.weeks, wcProtocol, bw, sex);
    const meal = combatWeightCutToMealInput(1, plan.weeks, wcProtocol, bw, sex);
    const fiber = weightCutFiberForWeek(1, plan.weeks, wcProtocol);
    const ors = weightCutOrsProtocol(wcProtocol, wcProtocol.targetLossKg);
    return {
      kcal: nut.kcal ?? null,
      proteinG: nut.proteinG ?? null,
      carbsG: nut.carbsG ?? null,
      fatG: Math.round(bw * (sex === 'female' ? 0.8 : 0.6)),
      fiberG: fiber,
      waterMl: nut.waterMl ?? null,
      sodiumMg: nut.sodiumMg ?? null,
      weighInType: wcProtocol.weighInType || 'day_before_24h',
      orsMmol: ors.orsSodium,
      mealInput: meal,
      note: `Весогонка ${wcProtocol.targetLossKg}кг (${wcProtocol.weighInType}) — W1: ${nut.kcal}ккал P${nut.proteinG}/C${nut.carbsG} волокно ${fiber}г ${nut.notes.join(' | ')}`,
    };
  }
  const weeks = plan.weeksData;
  const avgSets = weeks.reduce((a, w) => a + (w.totalSets || 0), 0) / Math.max(1, weeks.length);
  const kcal = Math.round(avgSets * 38 * (plan.weeksData[0]?.sessions.length || 3) / 3);
  const protein = Math.round(bw * ((plan.goal === 'weight_cut') ? 2.3 : 2.0));
  const carbs = Math.round(bw * ((plan.goal === 'weight_cut') ? 3 : 5));
  const fat = Math.round(bw * (sex === 'female' ? 0.8 : 0.6));
  return { kcal, proteinG: protein, carbsG: carbs, fatG: fat, fiberG: 28, waterMl: Math.round(bw * 35), sodiumMg: 5000, note: `Оценка под план ${plan.discipline} avg ${Math.round(avgSets)} сетов/нед — ккал ${kcal} ориентир + TDEE` };
}

export function combatToCardioPayload(plan: CombatPlan): { zone2MinPerWeek: number; hiitSessions: number; totalConditioningMin: number; outsideLoad: number | null; needsAerobicMaintenance: boolean } | null {
  const cond = (plan as any).conditioning as { sessions: any[][] } | null | undefined;
  const outsideLoad = (plan as any).outsideMetrics?.weeklyLoad ?? (plan.inputSnapshot as any)?.outsideLoad ?? null;
  if (!cond) {
    // даже без кондиции — даём maintenance Zone2 если высокая внезальная (P0-2)
    const outsideSessions = (plan.inputSnapshot as any)?.sparringLoad ? 5 : ((plan.inputSnapshot as any)?.outsideLoad?.sessionsPerWeek ?? 0);
    if (outsideSessions >= 5) return { zone2MinPerWeek: 30, hiitSessions: 0, totalConditioningMin: 30, outsideLoad, needsAerobicMaintenance: true };
    return null;
  }
  let zone2 = 0; let hiit = 0; let total = 0;
  for (const week of cond.sessions) for (const s of (week as any[])) {
    if ((s as any).modality === 'aerobic') zone2 += (s as any).durationMin || 0;
    if ((s as any).modality === 'alactic' || (s as any).modality === 'lactic') hiit += 1;
    total += (s as any).durationMin || 0;
  }
  const weeks = (plan as any).weeks || 1;
  const outsideSessions = (plan.inputSnapshot as any)?.outsideLoad?.sessionsPerWeek ?? 0;
  return { zone2MinPerWeek: Math.round(zone2 / weeks), hiitSessions: Math.round(hiit / weeks), totalConditioningMin: Math.round(total / weeks), outsideLoad, needsAerobicMaintenance: outsideSessions >= 5 };
}

export function combatNutritionEventPayload(plan: CombatPlan): Record<string, any> {
  const nut = combatToNutritionPayload(plan);
  const cardio = combatToCardioPayload(plan);
  return { planId: plan.id, discipline: plan.discipline, goal: plan.goal, weeks: plan.weeks, ...nut, cardio, weighInType: (nut as any).weighInType };
}
