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

// ─────────────────────────────────────────────────────────────────────────────
// Фаза 6, п.1: адаптивные попытки соревновательного дня.
//
// Задача: опенер уже сделан/провален, а 2-ю и 3-ю надо выбрать с учётом факта,
// не нарушая ПРАВИЛ соревнований. Правила (IPF и большинство федераций):
//   • вес последующей попытки НЕ МОЖЕТ быть меньше веса предыдущей — только
//     равен или больше (поэтому повтор проваленного веса разрешён, «сброс» — нет);
//   • попыток ровно три; провал всех трёх — «баранка» (в этом движении нет
//     зачётного результата, итог (тотал) не идёт).
//
// Доли ниже — ПРОЗРАЧНАЯ ЭВРИСТИКА (не физиология, не гарантия): после тяжёлой
// («grind») попытки шаг вверх ограничивается 3 %, после лёгкой — 3 % вверх,
// между попытками — стандартный шаг 2.5 кг (блины).
// ─────────────────────────────────────────────────────────────────────────────

/** Как попытка далась спортсмену (субъективно, только для ЗАЧЁТНОЙ попытки). */
export type MeetAttemptEffort = 'easy' | 'normal' | 'grind';

export interface MeetAttemptResult {
  /** Номер попытки в подходе (1..3). */
  attempt: 1 | 2 | 3;
  /** Вес, который был на штанге. */
  weight: number;
  /** Зачёт (true) / баранка (false). */
  made: boolean;
  /** Субъективная тяжесть зачётной попытки. */
  effort?: MeetAttemptEffort;
}

export interface MeetAdaptiveAdvice {
  /** Рекомендация на 2-ю попытку (null — уже сделана/невозможна). */
  second: number | null;
  /** Рекомендация на 3-ю попытку (null — уже сделана/невозможна). */
  third: number | null;
  /** Человекочитаемые обоснования (в UI — построчно). */
  notes: string[];
  /** Попытки в движении исчерпаны без зачёта — итог (тотал) без этого движения. */
  bombed: boolean;
}

const PLATE_STEP = 2.5;
const roundPlate = (v: number): number => Math.round(v / PLATE_STEP) * PLATE_STEP;
const stepUp = (base: number, pct: number): number => roundPlate(base * (1 + pct));

/** Шаг вверх после тяжёлой попытки (grind) — 3 % от сделанного веса. */
export const MEET_GRIND_STEP_PCT = 0.03;
/** Шаг вверх после лёгкой попытки — 3 % от сделанного веса. */
export const MEET_EASY_STEP_PCT = 0.03;

/**
 * Пересчёт 2-й/3-й попытки по факту предыдущих (стек: можно вызывать после
 * каждой попытки — рекомендация для ещё не выполненных).
 *
 * `planned` — то, что собирались делать по стратегии (meetAttemptsFor).
 * Уже выполненные попытки берутся из `results`; их веса — источник истины
 * (в зачёт идёт фактический вес со штанги, а не план).
 */
export function adaptMeetAttempts(planned: MeetAttemptSet, results: MeetAttemptResult[]): MeetAdaptiveAdvice {
  const notes: string[] = [];
  const sorted = [...results]
    .filter(r => r.attempt >= 1 && r.attempt <= 3 && Number.isFinite(r.weight) && r.weight > 0)
    .sort((a, b) => a.attempt - b.attempt);
  const first = sorted.find(r => r.attempt === 1);
  const second = sorted.find(r => r.attempt === 2);
  const third = sorted.find(r => r.attempt === 3);

  // 3-я уже выполнена — рекомендаций больше нет.
  if (third) {
    return {
      second: null,
      third: null,
      notes: [third.made
        ? `3-я попытка зачтена: ${third.weight} кг — подход закрыт.`
        : `3-я попытка не зачтена (${third.weight} кг) — в этом движении «баранка», итог (тотал) не идёт.`],
      bombed: !third.made,
    };
  }

  let secondPlan = planned.second > 0 ? planned.second : null;
  let thirdPlan = planned.third > 0 ? planned.third : null;

  if (!first) {
    notes.push('Факта 1-й попытки нет — рекомендации по стратегии.');
  } else if (!first.made) {
    // Правило: вес нельзя уменьшать → повторяем тот же вес.
    secondPlan = first.weight;
    notes.push(`1-я попытка не зачтена (${first.weight} кг) — повторяем тот же вес: уменьшать по правилам нельзя.`);
  } else if (first.effort === 'grind') {
    const cap = stepUp(first.weight, MEET_GRIND_STEP_PCT);
    const capped = Math.min(planned.second, cap);
    secondPlan = capped;
    notes.push(capped < planned.second
      ? `Опенер дался тяжело — 2-я снижена до ${capped} кг (по стратегии было ${planned.second} кг).`
      : `Опенер дался тяжело — 2-я без изменений (${capped} кг).`);
    thirdPlan = Math.min(planned.third, stepUp(capped, MEET_EASY_STEP_PCT));
  } else if (first.effort === 'easy') {
    secondPlan = planned.second;
    notes.push('Опенер лёгкий — 2-я по стратегии; при такой же лёгкости 3-ю можно добавить.');
  } else {
    secondPlan = planned.second;
    notes.push('Опенер нормальный — 2-я по стратегии.');
  }

  if (second) {
    if (!second.made) {
      thirdPlan = second.weight;
      notes.push(`2-я попытка не зачтена (${second.weight} кг) — 3-я на том же весе.`);
    } else if (second.effort === 'grind') {
      const capped = Math.min(planned.third, stepUp(second.weight, MEET_GRIND_STEP_PCT));
      thirdPlan = capped;
      notes.push(capped < planned.third
        ? `2-я далась тяжело — 3-я снижена до ${capped} кг (по стратегии было ${planned.third} кг).`
        : `2-я далась тяжело — 3-я без изменений (${capped} кг).`);
    } else if (second.effort === 'easy' && planned.third <= second.weight) {
      const up = stepUp(second.weight, MEET_EASY_STEP_PCT);
      thirdPlan = up;
      notes.push(`2-я легла легко — 3-я ${up} кг.`);
    }
  } else if (first?.made && !secondPlan) {
    // Нет 2-й в плане (странный оверрайд) — предлагаем шаг от опенера.
    secondPlan = stepUp(first.weight, MEET_EASY_STEP_PCT);
    notes.push(`2-я в плане не задана — от опенера ${secondPlan} кг.`);
  }

  // Инвариант правил: вес не уменьшается относительно предыдущей попытки.
  const monotonic = (value: number | null, prev: number, label: string): number | null => {
    if (value === null) return null;
    if (prev > 0 && value < prev) {
      notes.push(`${label} приведена к весу предыдущей попытки (${prev} кг): уменьшать нельзя.`);
      return prev;
    }
    return value;
  };
  if (second) {
    secondPlan = null; // уже сделана
    thirdPlan = monotonic(thirdPlan, second.weight, '3-я попытка');
  } else {
    secondPlan = monotonic(secondPlan, first?.weight ?? 0, '2-я попытка');
  }
  // Подсказка: 3-я не должна быть ниже 2-й (иначе бессмысленный повтор плана).
  if (secondPlan !== null && thirdPlan !== null && thirdPlan < secondPlan) {
    thirdPlan = secondPlan;
    notes.push(`3-я поднята до веса 2-й (${secondPlan} кг).`);
  }

  const bombed = !!(second && !second.made && thirdPlan === null);
  return { second: secondPlan, third: thirdPlan, notes, bombed };
}
