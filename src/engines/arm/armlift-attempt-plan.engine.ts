/**
 * armlift-attempt-plan.engine.ts — тактика помоста лайт (PRO-6 M7).
 * D7 вырезал журнал попыток и LMS из хаба как «соревы» — и правильно:
 * журнал живёт в конструкторе. Но выбор opener и 60-сек окно — это движение
 * помоста, диагностика без него не доводится до заявки.
 * Здесь только read-only план попыток от замера: opener ~92% / вторая ~98% /
 * третья — рекорд, шаг округления по величине снаряда. Без стораджа.
 */

export interface ArmliftAttemptPlan {
  implement: string;
  label: string;
  opener: number;
  second: number;
  third: number;
  note: string;
}

/** Шаг округления по величине снаряда (Hub мелкий — 0.5, RT — 2.5). */
export function attemptStepFor(weightKg: number): number {
  if (!Number.isFinite(weightKg) || weightKg <= 0) return 1;
  if (weightKg >= 100) return 2.5;
  if (weightKg >= 20) return 1;
  return 0.5;
}

function roundToStep(v: number, step: number): number {
  return Math.round(v / step) * step;
}

export function planArmliftAttempts(
  bestKg: number,
  implement = 'rolling_thunder',
  label?: string,
): ArmliftAttemptPlan | null {
  if (!Number.isFinite(bestKg) || bestKg <= 0) return null;
  const step = attemptStepFor(bestKg);
  const opener = roundToStep(bestKg * 0.92, step);
  const second = roundToStep(bestKg * 0.98, step);
  const third = roundToStep(bestKg * 1.02, step);
  return {
    implement,
    label: label || implement,
    opener,
    second,
    third,
    note: '60 сек на попытку, промах = выбыл (AUSA/IronMind); opener обязан сесть — третья за рекордом',
  };
}
