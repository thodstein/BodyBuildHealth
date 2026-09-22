/**
 * pl-attempts.engine.ts — StrengthAnalysisHub PRO P5: раскладка попыток ПЛ (3 попытки на движение).
 * Проценты — ЕДИНЫЙ канон `competition-attempts.MEET_STRATEGY_PCT` (раньше здесь жил
 * второй набор 92.5/97.5/100, из-за чего калькулятор нормативов и ПЛ-план расходились).
 * Шаг 2.5 кг (соревновательный минимум). Чистые функции — без плана/цикла.
 */
import { MEET_STRATEGY_PCT, type MeetStrategy } from '../lms/competition-attempts';

export type AttemptGoal = 'safe' | 'standard' | 'record';

export interface LiftAttempts {
  opener: number;
  second: number;
  third: number;
}

function round25(v: number): number {
  return Math.round(v / 2.5) * 2.5;
}

/** Цели StrengthAnalysisHub → канонические стратегии прикидов ПЛ-авто. */
const GOAL_TO_STRATEGY: Record<AttemptGoal, MeetStrategy> = {
  safe: 'conservative',
  standard: 'balanced',
  record: 'aggressive',
};

/** Раскладка одного движения от 1ПМ. oneRM ≤ 0 → нули (честно, без выдумок). */
export function planPLAttempts(oneRM: number, goal: AttemptGoal = 'standard'): LiftAttempts {
  if (!Number.isFinite(oneRM) || oneRM <= 0) return { opener: 0, second: 0, third: 0 };
  const pct = MEET_STRATEGY_PCT[GOAL_TO_STRATEGY[goal]] ?? MEET_STRATEGY_PCT.balanced;
  const opener = round25(oneRM * pct.opener);
  const second = round25(oneRM * pct.second);
  const third = Math.max(second, round25(oneRM * pct.third));
  return { opener, second, third };
}

export interface MeetAttempts {
  squat: LiftAttempts;
  bench: LiftAttempts;
  deadlift: LiftAttempts;
  /** Сумма третьих попыток (прогноз тотала при удаче). */
  totalThird: number;
}

/** Раскладка всей тройки + прогноз тотала. */
export function planMeetAttempts(squat: number, bench: number, deadlift: number, goal: AttemptGoal = 'standard'): MeetAttempts {
  const s = planPLAttempts(squat, goal);
  const b = planPLAttempts(bench, goal);
  const d = planPLAttempts(deadlift, goal);
  return { squat: s, bench: b, deadlift: d, totalThird: Math.round((s.third + b.third + d.third) * 10) / 10 };
}
