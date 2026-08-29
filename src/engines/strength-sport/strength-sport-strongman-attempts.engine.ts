/**
 * strength-sport-strongman-attempts.engine.ts — план попыток для стронг-ивентов (лог, йок, камни).
 * Изолировано. Для каждого ивента — 3 попытки по % от ПМ + разминка.
 */

export type SMStrategy = 'conservative' | 'balanced' | 'aggressive';

export const SM_STRATEGY_PCT: Record<SMStrategy, { opener: number; second: number; third: number }> = {
  conservative: { opener: 0.85, second: 0.92, third: 0.98 },
  balanced: { opener: 0.88, second: 0.95, third: 1.00 },
  aggressive: { opener: 0.90, second: 0.97, third: 1.02 },
};

export interface SMAttemptSet {
  opener: number;
  second: number;
  third: number;
  target: number;
}

export function smAttemptsFor(pm: number, strategy: SMStrategy = 'balanced', stepKg = 2.5): SMAttemptSet {
  const round = (v: number) => Math.round(v / stepKg) * stepKg;
  const pct = SM_STRATEGY_PCT[strategy] || SM_STRATEGY_PCT.balanced;
  return {
    opener: round(pm * pct.opener),
    second: round(pm * pct.second),
    third: round(pm * pct.third),
    target: round(pm * pct.third),
  };
}

export const SM_EVENT_STEP: Record<string, number> = {
  log_press: 2.5, circus_db_press: 2.5, axle_deadlift: 5, deadlift: 5,
  yoke_walk: 10, farmers_walk_heavy: 5, atlas_stone_load: 5, stone_lift: 5,
};

export const SM_EVENT_LABEL: Record<string, string> = {
  log_press: 'Лог-пресс', yoke_walk: 'Йок', farmers_walk_heavy: 'Фермер', atlas_stone_load: 'Атлас-камень', axle_deadlift: 'Аксель-тяга',
};

export interface SMEventPlan {
  event: string;
  attempts: SMAttemptSet;
  warmup: { pct: number; weight: number; reps?: number }[];
  strategy: SMStrategy;
}

export function buildSMEventPlan(
  eventId: string,
  pm: number,
  strategy: SMStrategy = 'balanced',
): SMEventPlan | null {
  if (!Number.isFinite(pm) || pm <= 0) return null;
  const step = SM_EVENT_STEP[eventId] || 2.5;
  const attempts = smAttemptsFor(pm, strategy, step);
  const warmupPct = [0.50, 0.65, 0.75, 0.85];
  const warmup = warmupPct.map(p => ({ pct: p, weight: Math.round(pm * p / step) * step, reps: p < 0.65 ? 3 : p < 0.80 ? 2 : 1 }));
  return { event: eventId, attempts, warmup, strategy };
}

export function smEventRationale(plan: SMEventPlan | null): string[] {
  if (!plan) return ['Нет данных для ивента'];
  const label = SM_EVENT_LABEL[plan.event] || plan.event;
  return [
    `${label} ${plan.strategy} ${SM_STRATEGY_PCT[plan.strategy].opener * 100}/${SM_STRATEGY_PCT[plan.strategy].second * 100}/${SM_STRATEGY_PCT[plan.strategy].third * 100}% — шаг ${SM_EVENT_STEP[plan.event] || 2.5}кг`,
    `Попытки: ${plan.attempts.opener} / ${plan.attempts.second} / ${plan.attempts.third} кг`,
    `Разминка: ${plan.warmup.map(w => `${w.weight}кг×${w.reps}`).join(' → ')}`,
  ];
}
