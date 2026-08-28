/**
 * strength-sport-attempts.engine.ts — план 6 попыток ТА (3 рывок + 3 толчок).
 * Изолировано от lms/competition-attempts (порт с WL-спецификой).
 * Источники: Catalyst Athletics (Greg Everett) — opener 88-92%, Torokhtiy 92/97/102%,
 * IWF техническ/тактика — шаг 2.5кг, Sinclair-прогноз.
 */
export type WLStrategy = 'conservative' | 'balanced' | 'aggressive';

export const WL_STRATEGY_PCT: Record<WLStrategy, { opener: number; second: number; third: number }> = {
  conservative: { opener: 0.90, second: 0.95, third: 1.00 },
  balanced: { opener: 0.92, second: 0.97, third: 1.02 },
  aggressive: { opener: 0.93, second: 0.98, third: 1.04 },
};

export const WL_STRATEGY_LABEL: Record<WLStrategy, string> = {
  conservative: 'Консервативная',
  balanced: 'Сбалансированная',
  aggressive: 'Агрессивная',
};

export const WL_STRATEGY_PCT_LABEL: Record<WLStrategy, string> = {
  conservative: '90/95/100%',
  balanced: '92/97/102%',
  aggressive: '93/98/104%',
};

export const WL_WARMUP_STEPS = [0.50, 0.65, 0.75, 0.85, 0.90];

export interface WLAttemptSet {
  opener: number;
  second: number;
  third: number;
  target: number;
}

export function wlAttemptsFor(pm: number, strategy: WLStrategy = 'balanced'): WLAttemptSet {
  const round = (v: number) => Math.round(v / 1) * 1; // ТА шаг 1кг (IWF 1кг)
  const pct = WL_STRATEGY_PCT[strategy] || WL_STRATEGY_PCT.balanced;
  const opener = round(pm * pct.opener);
  const second = round(pm * pct.second);
  const third = round(pm * pct.third);
  return { opener, second, third, target: third };
}

export function wlWarmupToOpener(opener: number): { pct: number; weight: number; reps: number }[] {
  const round = (v: number) => Math.round(v / 1) * 1;
  return WL_WARMUP_STEPS.map(p => ({
    pct: p,
    weight: round(opener * p),
    reps: p < 0.70 ? 3 : p < 0.85 ? 2 : 1,
  }));
}

export interface WLMeetPlan {
  strategy: WLStrategy;
  snatch: WLAttemptSet & { warmup: ReturnType<typeof wlWarmupToOpener> };
  cleanJerk: WLAttemptSet & { warmup: ReturnType<typeof wlWarmupToOpener> };
  total: number;
  sinclair?: number;
  category?: string;
}

export function buildWLMeetPlan(
  snatchPm: number,
  cleanJerkPm: number,
  strategy: WLStrategy = 'balanced',
  opts?: { bodyweight?: number; sex?: string; age?: number },
): WLMeetPlan | null {
  if (!Number.isFinite(snatchPm) || snatchPm <= 0) return null;
  if (!Number.isFinite(cleanJerkPm) || cleanJerkPm <= 0) return null;
  const sn = wlAttemptsFor(snatchPm, strategy);
  const cj = wlAttemptsFor(cleanJerkPm, strategy);
  const total = sn.target + cj.target;
  let sinclair: number | undefined;
  let category: string | undefined;
  if (opts?.bodyweight && opts.bodyweight > 30) {
    try {
      const { calcSinclair, getIWFCategory } = require('./strength-sport-finalize.engine') as any;
      if (typeof calcSinclair === 'function') sinclair = calcSinclair(total, opts.bodyweight, opts.sex || 'male');
      if (typeof getIWFCategory === 'function') category = getIWFCategory(opts.bodyweight, opts.sex || 'male');
    } catch {}
  }
  return {
    strategy,
    snatch: { ...sn, warmup: wlWarmupToOpener(sn.opener) },
    cleanJerk: { ...cj, warmup: wlWarmupToOpener(cj.opener) },
    total,
    sinclair,
    category,
  };
}

export function wlAttemptRationale(plan: WLMeetPlan | null): string[] {
  if (!plan) return ['Нет данных для попыток — укажите ПМ рывка и толчка'];
  const pct = WL_STRATEGY_PCT[plan.strategy];
  const lines: string[] = [];
  lines.push(`Стратегия ${WL_STRATEGY_LABEL[plan.strategy]} ${WL_STRATEGY_PCT_LABEL[plan.strategy]} — шаг 1кг (IWF)`);
  lines.push(`Рывок: ${plan.snatch.opener} / ${plan.snatch.second} / ${plan.snatch.third} кг · Толчок: ${plan.cleanJerk.opener} / ${plan.cleanJerk.second} / ${plan.cleanJerk.third} кг · Тотал ${plan.total}кг`);
  if (plan.sinclair) lines.push(`Sinclair ${plan.sinclair}${plan.category ? ` · кат. ${plan.category}` : ''}`);
  lines.push(`Разминка к опенеру: ${plan.snatch.warmup.map(w => `${w.weight}кг×${w.reps}`).join(' → ')} (рывок) / ${plan.cleanJerk.warmup.map(w => `${w.weight}кг×${w.reps}`).join(' → ')} (толчок)`);
  if (plan.strategy === 'conservative') lines.push('Консервативно: 6/6 попыток, без риска — для первого старта');
  if (plan.strategy === 'aggressive') lines.push('Агрессивно: 3-я на рекорд — только при 100% готовности');
  return lines;
}
