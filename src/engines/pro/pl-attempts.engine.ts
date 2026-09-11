/**
 * pl-attempts.engine.ts — StrengthAnalysisHub PRO P5: раскладка попыток ПЛ (3 попытки на движение).
 * Канон школы (Шейко/IPF-практика): 1-я 90–92.5% (гарантия), 2-я 97.5–100% (рабочая), 3-я по задаче.
 * Шаг 2.5 кг (соревновательный минимум). Чистые функции — без плана/цикла.
 */

export type AttemptGoal = 'safe' | 'standard' | 'record';

export interface LiftAttempts {
  opener: number;
  second: number;
  third: number;
}

function round25(v: number): number {
  return Math.round(v / 2.5) * 2.5;
}

const THIRD_MULT: Record<AttemptGoal, number> = { safe: 1.0, standard: 1.025, record: 1.04 };

/** Раскладка одного движения от 1ПМ. oneRM ≤ 0 → нули (честно, без выдумок). */
export function planPLAttempts(oneRM: number, goal: AttemptGoal = 'standard'): LiftAttempts {
  if (!Number.isFinite(oneRM) || oneRM <= 0) return { opener: 0, second: 0, third: 0 };
  const opener = round25(oneRM * 0.925);
  const second = round25(oneRM * 0.975);
  const third = Math.max(second, round25(oneRM * THIRD_MULT[goal]));
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
