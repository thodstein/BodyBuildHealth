/**
 * strength-sport-ta-spec-block.engine.ts — СПЕЦ-БЛОК ТА 4–8 НЕД (E5 PRO-v2)
 *
 * Волна объёма коррекций на слабые фазы: нед.1–2 техника 3×5, нед.3–4 объём 4×5,
 * нед.5–6 интенсивность 4×4, нед.7–8 подводка 3×3. technique-день приоритет (dayMap → день 1,
 * инъекция резолвит technique_day с fallback — см. ta-injection E6).
 * Parity с bb bb-spec-block.engine.ts (волна + dayMap + targetSets, без TDEE/фармы).
 *
 * Чистый движок, без UI/storage.
 */

import type { WLWeakPoint } from './strength-sport-weakpoint';

export interface TASpecWeek {
  week: number; // 1-индекс
  targetSets: Record<string, number>; // weakPoint → сетов в неделю
  note: string;
}

export interface TASpecBlock {
  weakPoints: WLWeakPoint[];
  totalWeeks: number;
  weeks: TASpecWeek[];
  dayMap: Record<string, number[]>; // weakPoint → дни 1-индекс (техника — день 1)
  rationale: string[];
}

export interface TASpecInput {
  weakPoints: WLWeakPoint[];
  level?: string;
  weeks?: number; // 4-8, дефолт 6
}

/** Сетов в неделю по индексу недели волны (0-индекс): 3,3,4,4,4,4,3,3. */
export function specSetsForWeekIndex(wi: number): number {
  if (wi <= 1) return 3;
  if (wi <= 5) return 4;
  return 3;
}

export function specNoteForWeekIndex(wi: number, total: number): string {
  if (wi <= 1) return 'Техника 3×5 @65–70% — чистота фазы';
  if (wi <= 3) return 'Объём 4×5 — накопление';
  if (wi <= 5) return 'Интенсивность 4×4 @+5% — перенос';
  return total >= 7 ? 'Подводка 3×3 — свежесть к пику' : 'Закрепление 3×5';
}

export function buildTASpecBlock(input: TASpecInput): TASpecBlock {
  const uniq = [...new Set((input.weakPoints || []).map(s => String(s)).filter(Boolean))].slice(0, 3) as WLWeakPoint[];
  let total = Math.round(input.weeks ?? 6);
  if (!Number.isFinite(total)) total = 6;
  total = Math.max(4, Math.min(8, total));
  const weeks: TASpecWeek[] = [];
  if (uniq.length > 0) {
    for (let wi = 0; wi < total; wi++) {
      const sets = specSetsForWeekIndex(wi);
      const targetSets: Record<string, number> = {};
      for (const wp of uniq) targetSets[wp] = sets;
      weeks.push({ week: wi + 1, targetSets, note: specNoteForWeekIndex(wi, total) });
    }
  }
  const dayMap: Record<string, number[]> = {};
  for (const wp of uniq) dayMap[wp] = [1];
  const rationale = uniq.length
    ? [`ТА спец-блок: ${uniq.join(', ')} × ${total} нед (3×5 → 4×5 → 4×4 → 3×3), technique-день приоритет`]
    : ['Нет слабых фаз — спец-блок пуст'];
  return { weakPoints: uniq, totalWeeks: total, weeks, dayMap, rationale };
}
