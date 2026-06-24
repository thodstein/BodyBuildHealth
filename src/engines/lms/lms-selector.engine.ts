/**
 * lms-selector.engine.ts — авто-подбор СРЦ-цикла по параметрам пользователя (Этап B4).
 * Scoring + rationale, по аналогии с split-selector. Обезличено.
 *
 * Критерии скоринга: направление(цель), уровень, период, мин.вес тела, доступные
 * тренировочные дни/нед, режим (натурал/курс/ПКТ). Возвращает ранжированный список.
 */
import { LMS_CYCLES } from '../../data/lms-cycles/lms-cycle-index';
import type { SRCycleTemplate } from '../../data/lms-cycles/lms-types';

export type UserGoal = 'strength' | 'mass' | 'endurance' | 'peak' | 'mixed';
export type UserLevel = 'novice' | 'II-KMS' | 'KMS-MS' | 'MS-MSMK' | 'II-MS' | 'intermediate';

export interface LMSSelectorInput {
  goal: UserGoal;            // силовая / массонабор / выносливость / пик / смешанный
  level: UserLevel;          // уровень спортсмена
  bodyWeight?: number;       // кг
  daysPerWeek?: number;      // доступных тренировочных дней
  direction?: 'powerlifting' | 'bench' | 'deadlift_bench' | 'armwrestling' | 'bodybuilding';
  mode?: 'natural' | 'on_course' | 'pct';
}

export interface LMSRankedCycle {
  cycle: SRCycleTemplate;
  score: number;
  rationale: string[];
  warnings: string[];
}

const GOAL_TO_PERIOD: Record<UserGoal, string[]> = {
  strength: ['strength', 'mixed'],
  mass: ['mass'],
  endurance: ['endurance'],
  peak: ['peak'],
  mixed: ['mixed', 'strength'],
};

const LEVEL_ORDER = ['novice', 'II-KMS', 'II-MS', 'KMS-MS', 'intermediate', 'KMS-MSMK', 'MS-MSMK'];

function levelRank(lvl: string): number {
  const i = LEVEL_ORDER.indexOf(lvl);
  return i < 0 ? 3 : i;
}

/** Нормализовать уровень пользователя под ключи циклов. */
function normUserLevel(lvl: UserLevel): string {
  return lvl;
}

export function rankCycles(input: LMSSelectorInput): LMSRankedCycle[] {
  const out: LMSRankedCycle[] = [];
  const userLevelRank = levelRank(normUserLevel(input.level));
  const acceptablePeriods = GOAL_TO_PERIOD[input.goal] || [input.goal];

  for (const cycle of LMS_CYCLES) {
    let score = 0;
    const rationale: string[] = [];
    const warnings: string[] = [];
    const m = cycle.meta;

    // период/цель
    if (acceptablePeriods.includes(m.period)) {
      score += 40;
      rationale.push(`период «${m.period}» соответствует цели «${input.goal}»`);
    } else {
      score -= 25;
      warnings.push(`период «${m.period}» не идеален для цели «${input.goal}»`);
    }

    // направление
    if (input.direction && m.direction === input.direction) {
      score += 25;
      rationale.push(`направление «${m.direction}» совпадает`);
    } else if (input.direction) {
      score -= 15;
      warnings.push(`направление «${m.direction}» отличается от запрошенного «${input.direction}»`);
    } else {
      score += 5;
    }

    // уровень (близость)
    const cycleLevelRank = levelRank(m.level);
    const levelDelta = Math.abs(cycleLevelRank - userLevelRank);
    if (levelDelta === 0) { score += 30; rationale.push(`уровень «${m.level}» точное совпадение`); }
    else if (levelDelta === 1) { score += 15; rationale.push(`уровень «${m.level}» близок`); }
    else if (levelDelta === 2) { score -= 5; warnings.push(`уровень «${m.level}» заметно отличается`); }
    else { score -= 20; warnings.push(`уровень «${m.level}» не подходит (Δ=${levelDelta})`); }

    // вес тела
    if (m.minBodyWeight != null && input.bodyWeight != null) {
      if (input.bodyWeight >= m.minBodyWeight) { score += 10; rationale.push(`вес ${input.bodyWeight}кг ≥ минимума ${m.minBodyWeight}кг`); }
      else { score -= 15; warnings.push(`вес ${input.bodyWeight}кг ниже минимума ${m.minBodyWeight}кг`); }
    }

    // тренировочные дни
    if (input.daysPerWeek != null && m.sessionsPerWeek > 0) {
      if (m.sessionsPerWeek <= input.daysPerWeek) { score += 15; rationale.push(`нужно ${m.sessionsPerWeek} дн/нед, доступно ${input.daysPerWeek}`); }
      else { score -= 20; warnings.push(`нужно ${m.sessionsPerWeek} дн/нед, доступно только ${input.daysPerWeek}`); }
    }

    // режим: ПКТ — предпочитаем менее объёмные/интенсивные
    if (input.mode === 'pct' && (m.period === 'endurance' || m.period === 'strength')) {
      score += 5; rationale.push('подходит для ПКТ (умеренная прогрессия)');
    }

    out.push({ cycle, score, rationale, warnings });
  }
  return out.sort((a, b) => b.score - a.score);
}

export function selectBestCycle(input: LMSSelectorInput): LMSRankedCycle | null {
  const ranked = rankCycles(input);
  return ranked[0] ?? null;
}

/** Человекочитаемая сводка выбора. */
export function explainSelection(r: LMSRankedCycle): string {
  const m = r.cycle.meta;
  const lines = [
    `«${m.title}» — скоринг ${r.score}`,
    ...r.rationale.map(x => '✓ ' + x),
    ...r.warnings.map(x => '! ' + x),
  ];
  return lines.join('\n');
}