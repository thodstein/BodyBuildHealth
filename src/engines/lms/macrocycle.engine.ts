/**
 * macrocycle.engine.ts — годовое планирование (Этап T0, REUSE+EXTEND training-cycle-planner/cycle.engine).
 * Последовательность фаз: выносливость → силовой → выход на пик → соревнования → переход.
 * Чейнит СРЦ/BB-циклы один за другим по фазам годового макроцикла.
 *
 * Расширение (годовое планирование ПЛ-авто):
 *  - weekOffset в каждом блоке (стартовая неделя в году)
 *  - competitionDate → авто-расчёт competitionWeek
 *  - macrocycleToActiveCycle(macro, week) → активный cycleId на неделе N
 *  - rebalanceMacrocycle(macro, edits) → ручная правка длительности фаз
 *  - serialize/deserialize для localStorage
 *  - direction-фильтр (powerlifting/bench/...) при подборе циклов
 */
import type { SRCycleTemplate } from '../../data/lms-cycles/lms-types';
import { LMS_CYCLES } from '../../data/lms-cycles/lms-cycle-index';
import { normalizeCycleDirection } from '../../data/lms-cycles/lms-cycle-index';

export type MacroPhase = 'endurance' | 'strength' | 'peak' | 'competition' | 'transition';
export type CycleKind = 'SRC' | 'BB';

export interface MacroBlock {
  phase: MacroPhase;
  weeks: number;
  weekOffset: number;        // стартовая неделя (1-индекс) в макроцикле
  kind: CycleKind;
  cycleId?: string;          // для SRC — id из lms-cycle-index
  description: string;
}

export interface Macrocycle {
  blocks: MacroBlock[];
  totalWeeks: number;
  competitionWeek?: number;  // неделя соревнований (если задана)
  competitionDate?: string;  // ISO-дата соревнований (если задана)
  rationale: string[];
}

const PHASE_TO_PERIOD: Record<MacroPhase, string[]> = {
  endurance: ['endurance'],
  strength: ['strength', 'mixed', 'mass'],
  peak: ['peak'],
  competition: ['peak'],
  transition: ['endurance', 'strength'],
};

const PHASE_COLOR: Record<MacroPhase, string> = {
  endurance: '#22c55e',
  strength: '#3b82f6',
  peak: '#f59e0b',
  competition: '#ef4444',
  transition: '#71717a',
};

const PHASE_LABEL_RU: Record<MacroPhase, string> = {
  endurance: 'Выносливость',
  strength: 'Силовой',
  peak: 'Выход на пик',
  competition: 'Соревнования',
  transition: 'Переход',
};

/** Подобрать СРЦ-цикл под фазу макроцикла (с учётом направления). */
function pickCycleForPhase(phase: MacroPhase, level: string, goal: 'powerlifting' | 'bodybuilding' | 'general'): SRCycleTemplate | undefined {
  const periods = PHASE_TO_PERIOD[phase];
  const wantStrength = goal === 'powerlifting';
  const candidates = LMS_CYCLES.filter(c => periods.includes(c.meta.period));
  // Фильтр по направлению: для powerlifting — только strength-циклы, для bodybuilding — BB
  const dirFiltered = candidates.filter(c => {
    const nd = normalizeCycleDirection(c.meta.direction);
    return wantStrength ? nd === 'strength' : nd !== 'strength';
  });
  // 1) точное совпадение уровня + направления
  const byLevelDir = dirFiltered.find(c => c.meta.level === level);
  if (byLevelDir) return byLevelDir;
  // 2) точное совпадение уровня (любое направление)
  const byLevel = candidates.find(c => c.meta.level === level);
  if (byLevel) return byLevel;
  // 3) любой подходящий по направлению
  if (dirFiltered.length > 0) return dirFiltered[0];
  // 4) fallback — любой по периоду
  return candidates[0];
}

export interface MacroInput {
  level: string;
  goal: 'powerlifting' | 'bodybuilding' | 'general';
  competitionWeek?: number;   // неделя соревнований (если есть)
  competitionDate?: string;   // ISO-дата соревнований (альтернатива competitionWeek)
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
      const cyc = pickCycleForPhase(phase, input.level, input.goal);
      cycleId = cyc?.meta.id;
      desc = cyc ? `СРЦ «${cyc.meta.title}»` : `СРЦ-цикл под период ${phase}`;
    } else {
      desc = `BB-мезоцикл (${phase})`;
    }
    blocks.push({ phase, weeks, weekOffset: w + 1, kind, cycleId, description: desc });
    rationale.push(`${phase}: ${weeks} нед (с ${w + 1}), ${kind}${cycleId ? ' (' + cycleId + ')' : ''}`);
    w += weeks;
  }
  // подогнать под total
  if (w !== total) blocks[blocks.length - 1].weeks += total - w;

  const competitionWeek = input.competitionWeek ?? (input.competitionDate ? estimateCompetitionWeek(input.competitionDate, total) : undefined);

  return { blocks, totalWeeks: total, competitionWeek, competitionDate: input.competitionDate, rationale };
}

/** Грубая оценка недели соревнований из даты (отсчёт от сегодня). */
export function estimateCompetitionWeek(isoDate: string, totalWeeks: number = 52): number {
  try {
    const target = new Date(isoDate).getTime();
    const now = Date.now();
    const daysDiff = Math.round((target - now) / 86400000);
    const week = Math.round(daysDiff / 7);
    return Math.max(1, Math.min(totalWeeks, week));
  } catch { return Math.round(totalWeeks * 0.85); }
}

/**
 * Найти активный блок макроцикла на неделе N (1-индекс).
 * Возвращает блок и cycleId, который должен быть активен.
 */
export function macrocycleToActiveCycle(macro: Macrocycle, weekNumber: number): { block: MacroBlock; cycleId?: string } | null {
  for (const block of macro.blocks) {
    if (weekNumber >= block.weekOffset && weekNumber < block.weekOffset + block.weeks) {
      return { block, cycleId: block.cycleId };
    }
  }
  // fallback — последний блок
  const last = macro.blocks[macro.blocks.length - 1];
  return last ? { block: last, cycleId: last.cycleId } : null;
}

/** Найти блок по фазе (первый совпадающий). */
export function findBlockByPhase(macro: Macrocycle, phase: MacroPhase): MacroBlock | undefined {
  return macro.blocks.find(b => b.phase === phase);
}

export interface MacroRebalanceEdit {
  phase: MacroPhase;
  weeks: number;  // новая длительность
}

/**
 * Ручная правка длительности фаз макроцикла.
 * Пересчитывает weekOffset всех последующих блоков.
 * Сохраняет totalWeeks (разница уходит в transition/последний блок).
 */
export function rebalanceMacrocycle(macro: Macrocycle, edits: MacroRebalanceEdit[]): Macrocycle {
  const editMap = new Map(edits.map(e => [e.phase, Math.max(1, e.weeks)]));
  const newBlocks: MacroBlock[] = [];
  let offset = 1;
  for (const block of macro.blocks) {
    const weeks = editMap.get(block.phase) ?? block.weeks;
    newBlocks.push({ ...block, weeks, weekOffset: offset });
    offset += weeks;
  }
  // подогнать под totalWeeks: разницу в последний блок
  const sum = newBlocks.reduce((s, b) => s + b.weeks, 0);
  if (sum !== macro.totalWeeks && newBlocks.length > 0) {
    newBlocks[newBlocks.length - 1].weeks += macro.totalWeeks - sum;
    // пересчитать offsets
    let off = 1;
    for (const b of newBlocks) { b.weekOffset = off; off += b.weeks; }
  }
  const newTotal = newBlocks.reduce((s, b) => s + b.weeks, 0);
  const rationale = newBlocks.map(b => `${b.phase}: ${b.weeks} нед (с ${b.weekOffset}), ${b.kind}${b.cycleId ? ' (' + b.cycleId + ')' : ''}`);
  return { blocks: newBlocks, totalWeeks: newTotal, competitionWeek: macro.competitionWeek, competitionDate: macro.competitionDate, rationale };
}

/** Сериализация для localStorage (компактная, без лишних полей). */
export function serializeMacro(macro: Macrocycle): string {
  return JSON.stringify({
    b: macro.blocks.map(b => [b.phase, b.weeks, b.weekOffset, b.kind, b.cycleId ?? null, b.description]),
    t: macro.totalWeeks,
    c: macro.competitionWeek ?? null,
    d: macro.competitionDate ?? null,
    r: macro.rationale,
  });
}

export function deserializeMacro(s: string): Macrocycle | null {
  try {
    const o = JSON.parse(s);
    if (!o || !Array.isArray(o.b)) return null;
    const blocks: MacroBlock[] = o.b.map((b: any) => ({
      phase: b[0] as MacroPhase,
      weeks: b[1],
      weekOffset: b[2],
      kind: b[3] as CycleKind,
      cycleId: b[4] || undefined,
      description: b[5] || '',
    }));
    return {
      blocks,
      totalWeeks: o.t,
      competitionWeek: o.c ?? undefined,
      competitionDate: o.d ?? undefined,
      rationale: o.r || [],
    };
  } catch { return null; }
}

export { PHASE_COLOR, PHASE_LABEL_RU };