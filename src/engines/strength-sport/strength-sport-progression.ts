/**
 * strength-sport-progression.ts — прогрессия ПМ для ТА/стронга.
 * Reuse LMS PM-кривая: PM_w = PM0 * (1+k)^(w-1), кап natural 1.25 / heavy 1.5.
 * k по уровню/режиму + outside/goal коррекция.
 */
import type { StrengthSportInput } from './strength-sport.types';

const LEVEL_K: Record<string, number> = {
  beginner: 0.012,
  intermediate: 0.007,
  advanced: 0.004,
  enhanced: 0.006,
};

function intensityK(input: StrengthSportInput): number {
  if (input.goal === 'technique') return 0.002;
  if (input.goal === 'peaking') return 0.008;
  if (input.peds && input.peds.length > 0) {
    if (input.courseIntensity === 'heavy') return 0.012;
    if (input.courseIntensity === 'moderate') return 0.009;
    return 0.007;
  }
  return LEVEL_K[input.level] ?? 0.007;
}

function pmCap(k: number, weeks: number): number {
  const raw = Math.pow(1 + k, weeks - 1);
  if (k >= 0.01) return Math.min(raw, 1.5);
  if (k > 0.005) return Math.min(raw, 1.35);
  return Math.min(raw, 1.25);
}

/** PM на неделю w (1-индекс) */
export function pmForWeek(pm0: number, week: number, input: StrengthSportInput): number {
  if (!Number.isFinite(pm0) || pm0 <= 0) return 0;
  if (week <= 1) return pm0;
  const k = intensityK(input);
  const cap = pmCap(k, input.weeks);
  const raw = pm0 * Math.pow(1 + k, week - 1);
  const capped = pm0 * Math.min(Math.pow(1 + k, week - 1), cap);
  // outside high → чуть ниже прогрессия
  const outsidePenalty = input.outsideLoad && input.outsideLoad.sessionsPerWeek >= 4 ? 0.97 : 1;
  return Math.round(capped * outsidePenalty * 2) / 2; // шаг 0.5 кг
}

/** RIR по фазе/неделе для ТА/стронга */
export function rirForWeek(week: number, totalWeeks: number, goal: string): number {
  const phase = phaseForWeek(week, totalWeeks);
  if (goal === 'technique') return 4;
  if (goal === 'peaking' && phase === 'peaking') return 0;
  if (phase === 'accumulation') return goal === 'strength' ? 2 : 3;
  if (phase === 'intensification') return goal === 'strength' ? 1 : 2;
  if (phase === 'peaking') return 1;
  if (phase === 'deload') return 4;
  return 2;
}

export function phaseForWeek(week: number, totalWeeks: number): string {
  if (totalWeeks <= 3) return 'accumulation';
  const deloadWeek = totalWeeks; // последняя — делод/тейпер
  if (week === deloadWeek && totalWeeks >= 4) return 'deload';
  if (totalWeeks >= 8) {
    if (week <= Math.round(totalWeeks * 0.4)) return 'accumulation';
    if (week <= Math.round(totalWeeks * 0.75)) return 'intensification';
    return 'peaking';
  }
  if (totalWeeks >= 5) {
    if (week <= 2) return 'accumulation';
    if (week <= totalWeeks - 2) return 'intensification';
    return 'peaking';
  }
  return 'accumulation';
}

/** Classic progression row для отчёта */
export function buildProgressionRow(pm0: number, input: StrengthSportInput): Array<{ week: number; pm: number; rir: number; phase: string }> {
  const out: Array<{ week: number; pm: number; rir: number; phase: string }> = [];
  for (let w = 1; w <= input.weeks; w++) {
    out.push({ week: w, pm: pmForWeek(pm0, w, input), rir: rirForWeek(w, input.weeks, input.goal), phase: phaseForWeek(w, input.weeks) });
  }
  return out;
}
