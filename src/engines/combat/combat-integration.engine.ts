/**
 * combat-integration.engine.ts — мосты к дневнику/питанию/кардио (изолировано).
 */

import type { CombatPlan } from './combat.types';
import { weightCutNutritionForWeek, weightCutFiberForWeek, weightCutOrsProtocol, combatWeightCutToMealInput } from './combat-weight-cut.engine';

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
      fatG: (meal as any)?.fat ?? Math.round(bw * (sex === 'female' ? 0.8 : 0.6)),
      fiberG: fiber,
      waterMl: nut.waterMl ?? null,
      sodiumMg: nut.sodiumMg ?? null,
      weighInType: wcProtocol.weighInType || 'day_before_24h',
      orsMmol: ors.orsSodium,
      mealInput: meal,
      note: `Весогонка ${wcProtocol.targetLossKg}кг (${wcProtocol.weighInType === 'same_day_2h' ? 'взвешивание в день' : 'взвешивание за 24ч'}) — W1: ${nut.kcal}ккал P${nut.proteinG}/C${nut.carbsG} волокно ${fiber}г ${nut.notes.join(' | ')}`,
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
  const snapOutside = (plan.inputSnapshot as any)?.outsideLoad;
  const snapLoad = typeof snapOutside === 'number' ? snapOutside
    : snapOutside && typeof snapOutside === 'object'
      ? Math.round((snapOutside.sessionsPerWeek || 0) * (snapOutside.avgDurationMin || 0) * (snapOutside.avgSRPE || 0))
      : null;
  const outsideLoad = (plan as any).outsideMetrics?.weeklyLoad ?? snapLoad ?? null;
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

// ── P2: типизированные исходящие (тот же канал localStorage + he-combat-updated,
// потребители: IndividualPlanContext слушает he-combat-updated, CardioConstructor читает payload) ──
/** Питание → IndividualPlanContext (слушатель `he-combat-updated`, ключ `he_combat_nutrition_payload`). */
export type CombatNutritionPayload = ReturnType<typeof combatToNutritionPayload> & {
  planId: string; bodyweight: number; discipline: string; goal: string;
};
/** Кардио → CardioConstructor (читает `he_combat_cardio_payload`, кнопка «Применить Zone2»). */
export type CombatCardioPayload = NonNullable<ReturnType<typeof combatToCardioPayload>> & {
  planId: string;
};

/* ── P0-5: экспорт плана единоборств в ручную библиотеку ─────────────────────
 * Раньше UI собирал объект с direction:'combat' без daysPerWeek/weeks и без
 * тела — saveUserProgram молча отбрасывал его (ложный тост «Экспортировано»).
 * Теперь — полноценный UserProgram с CombatProgramBody (та же недельная форма,
 * что BB/arm: session.blocks[].sets). Чистая функция — тестируемая. */

type UserPhase = 'accumulation' | 'intensification' | 'deload' | 'peaking';

function combatPhaseToUserPhase(p: string): UserPhase {
  if (p === 'deload') return 'deload';
  if (p === 'realization' || p === 'taper') return 'peaking';
  if (p === 'transmutation' || p === 'power' || p === 'conjugate') return 'intensification';
  return 'accumulation';
}

export function combatPlanToUserProgram(plan: CombatPlan): any {
  const snap: any = plan.inputSnapshot || {};
  const weeks = (plan.weeksData || []).map(w => ({
    week: w.week,
    phase: combatPhaseToUserPhase(w.phase),
    deload: !!w.deload,
    sessions: (w.sessions || []).map(s => ({
      id: `cbs_${plan.id}_${w.week}_${s.day}`,
      name: s.sessionTag || `День ${s.day}`,
      focus: s.sessionTag,
      character: s.character || null,
      estimatedMin: s.durationMin,
      blocks: (s.exercises || []).map((e, ei) => ({
        id: `cbb_${plan.id}_${w.week}_${s.day}_${ei}`,
        type: e.role === 'primary' ? 'compound' : 'accessory',
        exerciseName: e.name,
        muscle: e.group,
        role: e.role,
        character: e.character,
        note: e.comment,
        sets: (e.workSets || []).map(st => ({
          reps: st.reps,
          rir: st.rir,
          weight: st.weight,
          ...(st.tempo ? { tempo: st.tempo } : {}),
          ...(st.restSeconds != null ? { restSec: st.restSeconds } : {}),
          ...(st.holdSeconds != null ? { holdSeconds: st.holdSeconds } : {}),
        })),
      })),
    })),
  }));
  const firstWeek = plan.weeksData?.[0];
  const daysPerWeek = Math.max(1, Math.min(7, firstWeek?.sessions?.length || snap.daysPerWeek || 3));
  const microcycleTemplate = {
    daySlots: (firstWeek?.sessions || []).map((s, i) => ({ day: i + 1, label: s.sessionTag || `День ${i + 1}`, muscles: [] })),
  };
  const now = new Date().toISOString();
  return {
    meta: {
      id: plan.id,
      title: `Единоборства ${plan.discipline} ${plan.weeks}нед`,
      author: 'BioStack',
      goal: plan.goal,
      level: plan.level,
      daysPerWeek,
      weeks: plan.weeksData.length,
      direction: 'combat',
      createdAt: now,
      updatedAt: now,
      source: 'from_build',
      tags: ['combat', plan.discipline],
      notes: (plan.rationale || []).slice(0, 3).join(' · '),
    },
    combat: {
      direction: 'combat',
      microcycleTemplate,
      weeks,
      volumeBudget: {},
      progression: { loadStrategy: 'double_progression', deloadProtocol: 'pump', intensityTechniques: ['none'] },
      constraints: { equipment: snap.equipment || [] },
      combatMeta: {
        discipline: plan.discipline,
        goal: plan.goal,
        fightStyle: snap.fightStyle,
        patternId: plan.patternId,
        weeks: plan.weeks,
      },
    },
  };
}
