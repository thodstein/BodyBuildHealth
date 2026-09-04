/**
 * strength-sport-sm-spec-block.engine.ts — СПЕЦ-БЛОК СТРОНГМЕНА 4–8 НЕД (SM PRO)
 *
 * Волна объёма коррекций на слабые фазы: нед.1–2 техника 3×5 (carry 3×20м),
 * нед.3–4 объём 4×5, нед.5–6 интенсивность 4×4, нед.7–8 подводка 3×3.
 * Event-день приоритет (dayMap → день event_day, инъекция резолвит event_day с fallback).
 * Parity с TA ta-spec-block и BB bb-spec-block (волна + dayMap + targetSets).
 *
 * Чистый движок, без UI/storage.
 * Источники: StrongmanPlan weak 2× + deload 4/7/11, Winwood taper, Grinder Gym 5-фаз.
 */

import type { SMWeakPoint } from './strength-sport-sm-biomechanics.engine';

export interface SMSpecWeek {
  week: number; // 1-индекс
  targetSets: Record<string, number>; // weakPoint → сетов в неделю
  note: string;
}

export interface SMSpecBlock {
  weakPoints: SMWeakPoint[];
  totalWeeks: number;
  weeks: SMSpecWeek[];
  dayMap: Record<string, number[]>; // weakPoint → дни 1-индекс (event — день 2)
  rationale: string[];
}

export interface SMSpecInput {
  weakPoints: SMWeakPoint[];
  level?: string;
  weeks?: number; // 4-8, дефолт 6
}

/** Сетов в неделю по индексу недели волны (0-индекс): 3,3,4,4,4,4,3,3. */
export function smSpecSetsForWeekIndex(wi: number): number {
  if (wi <= 1) return 3;
  if (wi <= 5) return 4;
  return 3;
}

export function smSpecNoteForWeekIndex(wi: number, total: number): string {
  if (wi <= 1) return 'Техника 3×5 / carry 3×20м @65–70% — чистота фазы + brace 2с';
  if (wi <= 3) return 'Объём 4×5 — накопление (слабые ивенты 2× в неделю)';
  if (wi <= 5) return 'Интенсивность 4×4 @+5% — перенос на контест-вес';
  return total >= 7 ? 'Подводка 3×3 — свежесть к пику (Winwood taper)' : 'Закрепление 3×5';
}

export function buildSMSpecBlock(input: SMSpecInput): SMSpecBlock {
  const uniq = [...new Set((input.weakPoints || []).map((s) => String(s)).filter(Boolean))].slice(0, 3) as SMWeakPoint[];
  let total = Math.round(input.weeks ?? 6);
  if (!Number.isFinite(total)) total = 6;
  total = Math.max(4, Math.min(8, total));
  const weeks: SMSpecWeek[] = [];
  if (uniq.length > 0) {
    for (let wi = 0; wi < total; wi++) {
      const sets = smSpecSetsForWeekIndex(wi);
      const targetSets: Record<string, number> = {};
      for (const wp of uniq) targetSets[wp] = sets;
      weeks.push({ week: wi + 1, targetSets, note: smSpecNoteForWeekIndex(wi, total) });
    }
  }
  const dayMap: Record<string, number[]> = {};
  for (const wp of uniq) dayMap[wp] = [2]; // event-день
  const rationale = uniq.length
    ? [`Стронг спец-блок: ${uniq.join(', ')} × ${total} нед (3×5 → 4×5 → 4×4 → 3×3), event-день приоритет, deload 4/7/11 при ≥8 нед`]
    : ['Нет слабых фаз — спец-блок пуст'];
  return { weakPoints: uniq, totalWeeks: total, weeks, dayMap, rationale };
}
