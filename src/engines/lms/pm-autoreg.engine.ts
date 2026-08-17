/**
 * pm-autoreg.engine.ts — авторегуляция ПРОГРЕССИИ ПМ (только ПМ, без объёма).
 *
 * Три режима (независимый переключатель от авторегуляции весов/объёма/RIR):
 *   - off     — ПМ по введённым данным (фикс. недельный % из цикла, как раньше).
 *   - auto    — ПМ по авторасчётам (PED/курс/уровень вместе): недельный % считается
 *               автоматически (courseDefaultPercent / levelPmFloor), а не из correctionPct цикла.
 *   - diary   — ПМ по результатам дневника: фактический e1RM (Epley) из последних сессий
 *               сравнивается с плановым ПМ → множитель кривой ПМ (обгон → ×1.05, отставание → ×0.95).
 */
import type { WorkoutLog } from '../../core/types';
import { findLastFact } from '../pro/diary-autoreg.engine';
import {
  courseDefaultPercent,
  levelPmFloor,
  DEFAULT_WEEKLY_PERCENT,
  type ProgressionMode,
} from './lms-progression.engine';

export type PMAutoRegMode = 'off' | 'auto' | 'diary';

/**
 * АВТО: автоматически рассчитанный недельный % прогрессии ПМ из PED/курса/уровня.
 * Не использует фикс. correctionPct цикла — только авторасчёты.
 */
export function autoWeeklyPercent(input: {
  mode: ProgressionMode;
  courseIntensity?: 'mild' | 'moderate' | 'heavy';
  level?: string;
  weeklyPercent?: number;
}): number {
  if (input.weeklyPercent != null) return input.weeklyPercent;
  if (input.mode === 'on_course') return courseDefaultPercent(input.courseIntensity);
  if (input.mode === 'pct') return DEFAULT_WEEKLY_PERCENT.pct;
  const lk = levelPmFloor(input.level);
  return lk ?? DEFAULT_WEEKLY_PERCENT[input.mode] ?? DEFAULT_WEEKLY_PERCENT.natural;
}

export interface PMDiaryInput {
  historyWorkouts: WorkoutLog[];
  /** name → введённый ПМ0 упражнения. */
  pm0Map: Record<string, number>;
}

export interface PMDiaryResult {
  /** name → множитель кривой ПМ (1.05 / 1.0 / 0.95). */
  multiplier: Record<string, number>;
  decisions: string[];
  adjusted: number;
  noData: number;
}

/** ДНЕВНИК: множитель ПМ по факту дневника (e1RM vs плановый ПМ0). */
export function pmDiaryMultiplier(input: PMDiaryInput): PMDiaryResult {
  const multiplier: Record<string, number> = {};
  const decisions: string[] = [];
  let adjusted = 0;
  let noData = 0;

  for (const [name, pm0] of Object.entries(input.pm0Map)) {
    if (!Number.isFinite(pm0) || pm0 <= 0) {
      multiplier[name] = 1;
      continue;
    }
    const fact = findLastFact(input.historyWorkouts, name);
    if (!fact || !(fact.e1RM > 0)) {
      multiplier[name] = 1;
      noData++;
      continue;
    }
    const ratio = fact.e1RM / pm0;
    if (ratio >= 1.03) {
      multiplier[name] = 1.05;
      adjusted++;
      decisions.push(`${name}: e1RM ${fact.e1RM}кг > ПМ ${pm0}кг (+${Math.round((ratio - 1) * 100)}%) → ПМ ×1.05`);
    } else if (ratio <= 0.97) {
      multiplier[name] = 0.95;
      adjusted++;
      decisions.push(`${name}: e1RM ${fact.e1RM}кг < ПМ ${pm0}кг (−${Math.round((1 - ratio) * 100)}%) → ПМ ×0.95`);
    } else {
      multiplier[name] = 1;
      decisions.push(`${name}: e1RM ${fact.e1RM}кг ≈ ПМ ${pm0}кг — в норме`);
    }
  }

  if (noData > 0) decisions.push(`${noData} упражнений без данных дневника — ПМ без коррекции`);
  return { multiplier, decisions, adjusted, noData };
}