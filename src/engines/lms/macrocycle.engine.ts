/**
 * macrocycle.engine.ts — годовое планирование (Этап T0, REUSE+EXTEND training-cycle-planner/cycle.engine).
 * Последовательность фаз: выносливость → силовой → выход на пик → соревнования → переход.
 * Чейнит СРЦ/BB-циклы один за другим по фазам годового макроцикла.
 */
import type { SRCycleTemplate } from '../../data/lms-cycles/lms-types';
import { LMS_CYCLES } from '../../data/lms-cycles/lms-cycle-index';

export type MacroPhase = 'endurance' | 'strength' | 'peak' | 'competition' | 'transition';
export type CycleKind = 'SRC' | 'BB';

export interface MacroBlock {
  phase: MacroPhase;
  weeks: number;
  kind: CycleKind;
  cycleId?: string;          // для SRC — id из lms-cycle-index
  description: string;
}

export interface Macrocycle {
  blocks: MacroBlock[];
  totalWeeks: number;
  rationale: string[];
}

const PHASE_TO_PERIOD: Record<MacroPhase, string[]> = {
  endurance: ['endurance'],
  strength: ['strength', 'mixed', 'mass'],
  peak: ['peak'],
  competition: ['peak'],
  transition: ['endurance', 'strength'],
};

/** Подобрать СРЦ-цикл под фазу макроцикла. */
function pickCycleForPhase(phase: MacroPhase, level: string): SRCycleTemplate | undefined {
  const periods = PHASE_TO_PERIOD[phase];
  return LMS_CYCLES.find(c => periods.includes(c.meta.period) && c.meta.level === level)
    || LMS_CYCLES.find(c => periods.includes(c.meta.period));
}

export interface MacroInput {
  level: string;
  goal: 'powerlifting' | 'bodybuilding' | 'general';
  competitionWeek?: number;   // неделя соревнований (если есть)
  totalWeeks?: number;        // по умолчанию 52
}

export function buildMacrocycle(input: MacroInput): Macrocycle {
  const total = input.totalWeeks || 52;
  const blocks: MacroBlock[] = [];
  const rationale: string[] = [];
  // распределение фаз (доли года): endurance 25%, strength 40%, peak 15%, competition 5%, transition 15%
  const dist: Record<MacroPhase, number> = { endurance: 0.25, strength: 0.40, peak: 0.15, competition: 0.05, transition: 0.15 };
  const order: MacroPhase[] = ['endurance', 'strength', 'peak', 'competition', 'transition'];
  let w = 0;
  for (const phase of order) {
    const weeks = Math.max(2, Math.round(total * dist[phase]));
    const isBB = input.goal === 'bodybuilding' && (phase === 'endurance' || phase === 'strength' || phase === 'transition');
    const kind: CycleKind = isBB ? 'BB' : 'SRC';
    let cycleId: string | undefined;
    let desc = '';
    if (kind === 'SRC') {
      const cyc = pickCycleForPhase(phase, input.level);
      cycleId = cyc?.meta.id;
      desc = cyc ? `СРЦ «${cyc.meta.title}»` : `СРЦ-цикл под период ${phase}`;
    } else {
      desc = `BB-мезоцикл (${phase})`;
    }
    blocks.push({ phase, weeks, kind, cycleId, description: desc });
    rationale.push(`${phase}: ${weeks} нед, ${kind}${cycleId ? ' (' + cycleId + ')' : ''}`);
    w += weeks;
  }
  // подогнать под total
  if (w !== total) blocks[blocks.length - 1].weeks += total - w;
  return { blocks, totalWeeks: total, rationale };
}