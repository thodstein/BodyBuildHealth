export interface CompetitionAttempts {
  opener: number;
  second: number;
  third: number;
  openerRange: [number, number];
  secondRange: [number, number];
  thirdRange: [number, number];
}

export type MeetStrategy = 'conservative' | 'balanced' | 'aggressive';

export interface MeetAttemptSet {
  opener: number;
  second: number;
  third: number;
  target: number;
}

/** Проценты прикидов от ПМ — зеркально калькулятору (taper.engine: peakWeekAttempts). */
export const MEET_STRATEGY_PCT: Record<MeetStrategy, { opener: number; second: number; third: number }> = {
  conservative: { opener: 0.90, second: 0.955, third: 1.00 },
  balanced: { opener: 0.92, second: 0.96, third: 1.02 },
  aggressive: { opener: 0.93, second: 0.97, third: 1.05 },
};

export const MEET_STRATEGY_LABEL: Record<MeetStrategy, string> = {
  conservative: 'Консервативная',
  balanced: 'Сбалансированная',
  aggressive: 'Агрессивная',
};

/** Короткая метка процентов прикидов для UI (включая дефолтную «Сбалансированную»). */
export const MEET_STRATEGY_PCT_LABEL: Record<MeetStrategy, string> = {
  conservative: '90/95.5/100%',
  balanced: '92/96/102%',
  aggressive: '93/97/105%',
};

/** Проценты прикидов от опенера для разминочной последовательности (40→90%). */
export const MEET_WARMUP_STEPS = [0.40, 0.55, 0.70, 0.80, 0.90];

/** Suggested attempts from a tested max, rounded to the nearest 2.5 kg. */
export function competitionAttempts(pm: number): CompetitionAttempts {
  const round = (value: number) => Math.round(value / 2.5) * 2.5;
  const range = (low: number, high: number): [number, number] => [round(pm * low), round(pm * high)];
  return {
    opener: round(pm * 0.875),
    second: round(pm * 0.925),
    third: round(pm * 1.0),
    openerRange: range(0.85, 0.9),
    secondRange: range(0.9, 0.95),
    thirdRange: range(0.95, 1.05),
  };
}

/**
 * Прикиды соревновательного дня по стратегии (как в тапер-калькуляторе):
 * консервативная 90/95.5/100%, сбалансированная 92/96/102%,
 * агрессивная 93/97/105% (выход на пик 105% от ПМ).
 * Округление до ближайших 2.5 кг — стандартный шаг блинов в пауэрлифтинге.
 */
export function meetAttemptsFor(pm: number, strategy: MeetStrategy = 'balanced'): MeetAttemptSet {
  const round = (value: number) => Math.round(value / 2.5) * 2.5;
  const pct = MEET_STRATEGY_PCT[strategy] || MEET_STRATEGY_PCT.balanced;
  const opener = round(pm * pct.opener);
  const second = round(pm * pct.second);
  const third = round(pm * pct.third);
  return { opener, second, third, target: third };
}

export type CompetitionLift = 'squat' | 'bench' | 'deadlift';

export interface ResolvedCompetitionLift {
  lift: CompetitionLift;
  key: string;
  pm: number;
}

const COMPETITION_LIFT_PATTERNS: Record<CompetitionLift, RegExp[]> = {
  squat: [/присед/i, /приседан/i, /squat/i],
  bench: [/жим\s+(?:штангой\s+)?(?:леж|лёж)/i, /жим\s+на\s+скам/i, /^bench$/i, /bench\s*press/i],
  deadlift: [/станов/i, /тяга\s+(?:штанги\s+)?(?:становая|классическая)/i, /deadlift/i, /сумо/i],
};

function normalizedLiftName(value: string): string {
  return value.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

export function resolveCompetitionLifts(pmRow: Record<string, number>): ResolvedCompetitionLift[] {
  const entries = Object.entries(pmRow)
    .filter(([, value]) => Number.isFinite(value) && value > 0)
    .map(([key, pm]) => ({ key, pm, normalized: normalizedLiftName(key) }));
  const seen = new Set<string>();
  const resolved: ResolvedCompetitionLift[] = [];
  for (const lift of ['squat', 'bench', 'deadlift'] as CompetitionLift[]) {
    const matches = entries
      .filter(entry => !seen.has(entry.key) && COMPETITION_LIFT_PATTERNS[lift].some(pattern => pattern.test(entry.normalized)))
      .sort((a, b) => b.pm - a.pm || a.key.localeCompare(b.key))[0];
    if (!matches) continue;
    seen.add(matches.key);
    resolved.push({ lift, key: matches.key, pm: matches.pm });
  }
  return resolved;
}

export function resolveCompetitionLiftPm(pmRow: Record<string, number>, lift: CompetitionLift): number {
  return resolveCompetitionLifts(pmRow).find(item => item.lift === lift)?.pm ?? 0;
}

export interface MeetAttemptsInfo {
  strategy: MeetStrategy;
  lifts: {
    name: string;
    opener: number;
    second: number;
    third: number;
    target: number;
    /** Разминочная последовательность к опенеру (40→90% от опенера), канон MEET_WARMUP_STEPS. */
    warmup: { pct: number; weight: number; reps: number }[];
  }[];
}

/** Разминочная последовательность к опенеру (40→90%), с весами и повторами. */
export function warmupToOpener(opener: number, round = (v: number) => Math.round(v / 2.5) * 2.5): { pct: number; weight: number; reps: number }[] {
  return MEET_WARMUP_STEPS.map(p => ({
    pct: p,
    weight: round(opener * p),
    reps: p < 0.7 ? 5 : p < 0.85 ? 3 : 1,
  }));
}
