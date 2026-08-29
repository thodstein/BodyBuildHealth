/**
 * combat-periodization.engine.ts — периодизация для единоборств.
 * ATR (Issurin) 5/3/2, Linear 12, Conjugate — short notice.
 * Изолировано.
 * Источники: Issurin ATR 10нед, Vitruve Off/Pre/Camp, Performance MMA 4 фазы.
 */
import type { CombatPhase } from './combat.types';
export type { CombatPhase };
export type CombatPeriodizationModel = 'atr_10' | 'linear_12' | 'conjugate' | 'camp_8' | 'linear';

function clamp(n: number, min: number, max: number): number { return Math.max(min, Math.min(max, n)); }

// ATR: для totalWeeks >=8 — 50%/30%/20% (5/3/2 на 10нед)
// для <8 — линейная 40%/40%/20% с делодом 3/1
function atrBounds(totalWeeks: number): { accum: number; trans: number; real: number } {
  if (totalWeeks >= 9) {
    const accum = Math.round(totalWeeks * 0.5);
    const trans = Math.round(totalWeeks * 0.3);
    const real = totalWeeks - accum - trans;
    return { accum, trans, real: Math.max(1, real) };
  }
  if (totalWeeks >= 6) {
    const accum = Math.round(totalWeeks * 0.4);
    const trans = Math.round(totalWeeks * 0.4);
    const real = totalWeeks - accum - trans;
    return { accum, trans, real: Math.max(1, real) };
  }
  return { accum: Math.round(totalWeeks * 0.5), trans: 0, real: totalWeeks - Math.round(totalWeeks * 0.5) };
}

export function isDeloadWeekATR(week: number, totalWeeks: number, model: CombatPeriodizationModel, goal: string): boolean {
  // camp/conjugate — делод чаще: каждые 3 недели (2/1)
  if (goal === 'camp' || model === 'conjugate' || model === 'camp_8') {
    return week % 3 === 0 && week !== totalWeeks; // последняя — taper, не deload
  }
  // ATR/linear — 3/1 внутри Accum/Trans
  return week % 4 === 0 && week !== totalWeeks;
}

export function isTaperWeek(week: number, totalWeeks: number, model: CombatPeriodizationModel, goal: string): boolean {
  if (model === 'atr_10' || goal === 'camp') {
    const { real } = atrBounds(totalWeeks);
    return week > totalWeeks - real;
  }
  // linear: последние 2 недели — taper
  if (totalWeeks <= 3) return false;
  if (week === totalWeeks) return true;
  if (week === totalWeeks - 1 && totalWeeks >= 8) return true;
  return false;
}

export function phaseForCombatWeekATR(
  week: number,
  totalWeeks: number,
  goal: string,
  model: CombatPeriodizationModel = 'linear'
): CombatPhase {
  const w = clamp(Math.round(week), 1, totalWeeks);
  // weight_cut — особый: taper всегда последние 2 нед
  if (goal === 'weight_cut') {
    if (w === totalWeeks) return 'deload';
    if (w >= totalWeeks - 1) return 'taper';
    if (w <= Math.round(totalWeeks * 0.4)) return 'gpp';
    return 'power';
  }
  if (model === 'conjugate') {
    if (isDeloadWeekATR(w, totalWeeks, model, goal)) return 'deload';
    if (isTaperWeek(w, totalWeeks, model, goal)) return 'taper';
    return 'conjugate';
  }
  if (model === 'atr_10') {
    if (isDeloadWeekATR(w, totalWeeks, model, goal)) return 'deload';
    if (isTaperWeek(w, totalWeeks, model, goal)) return 'realization';
    const { accum } = atrBounds(totalWeeks);
    if (w <= accum) return 'accumulation';
    if (w <= accum + atrBounds(totalWeeks).trans) return 'transmutation';
    return 'realization';
  }
  // linear / linear_12 / camp_8 — совместимость со старой логикой, но с делодом 3/1
  if (isDeloadWeekATR(w, totalWeeks, model, goal)) return 'deload';
  if (isTaperWeek(w, totalWeeks, model, goal)) return 'taper';
  if (goal === 'camp' && totalWeeks >= 6) {
    if (w <= Math.round(totalWeeks * 0.5)) return 'gpp';
    if (w <= totalWeeks - 2) return 'power';
    return 'taper';
  }
  if (totalWeeks <= 3) return 'gpp';
  if (w <= Math.round(totalWeeks * 0.4)) return 'gpp';
  if (w <= Math.round(totalWeeks * 0.8)) return 'power';
  return 'taper';
}

// Conjugate внутри-недельная ротация (для builder)
// max effort / dynamic effort / repetition
export type ConjugateMethod = 'max_effort' | 'dynamic_effort' | 'repetition_method';
export function conjugateMethodForSession(tag: string, week: number): ConjugateMethod {
  const isUpper = tag.includes('upper');
  const isLower = tag.includes('lower');
  const mod = week % 3;
  if (isUpper) {
    if (mod === 1) return 'max_effort';
    if (mod === 2) return 'dynamic_effort';
    return 'repetition_method';
  }
  if (isLower) {
    if (mod === 1) return 'dynamic_effort';
    if (mod === 2) return 'max_effort';
    return 'repetition_method';
  }
  // full
  if (mod === 1) return 'max_effort';
  if (mod === 2) return 'repetition_method';
  return 'dynamic_effort';
}

export function rirForCombatPhase(phase: CombatPhase, character: 'тяж' | 'памп' | 'лёг', goal: string): number {
  if (goal === 'weight_cut') return 4;
  if (goal === 'maintenance') return 3;
  if (phase === 'deload' || phase === 'taper' || phase === 'realization') return 4;
  if (phase === 'accumulation' || phase === 'gpp') return character === 'тяж' ? 2 : 3;
  if (phase === 'transmutation' || phase === 'power') return character === 'тяж' ? 1 : 2;
  if (phase === 'conjugate') return character === 'тяж' ? 2 : 3;
  return 2;
}

export function repsForCombatPhase(phase: CombatPhase, character: 'тяж' | 'памп' | 'лёг', goal: string): [number, number] {
  if (phase === 'conjugate') {
    if (character === 'тяж') return [1, 3]; // max effort
    return [8, 12];
  }
  if (goal === 'weight_cut') return character === 'тяж' ? [5, 8] : [10, 15];
  if (phase === 'accumulation' || phase === 'gpp') return character === 'тяж' ? [6, 10] : [12, 20];
  if (phase === 'transmutation' || phase === 'power') return character === 'тяж' ? [3, 6] : [8, 12];
  if (phase === 'realization' || phase === 'taper') return character === 'тяж' ? [3, 5] : [8, 12];
  return [5, 8];
}

// Для старых вызовов — совместимый алиас
export const phaseForCombatWeekNew = phaseForCombatWeekATR;
