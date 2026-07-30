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
  /** id соревнования, к которому относится блок (если phase=peak/competition). */
  competitionId?: string;
}

/** Соревнование в макроцикле. */
export interface CompetitionEvent {
  id: string;                // уникальный id (для связи с блоками)
  name: string;              // название (например, "Первенство области")
  week: number;              // неделя соревнований (1-индекс)
  date?: string;             // ISO-дата (опционально)
  priority: 'A' | 'B' | 'C'; // A — главное, B — отборочное/контрольное, C — тренировочное
  notes?: string;
}

export interface Macrocycle {
  blocks: MacroBlock[];
  totalWeeks: number;
  competitionWeek?: number;  // устаревшее: неделя главного соревнования (обратно-совместимо)
  competitionDate?: string;  // устаревшее: ISO-дата главного соревнования
  /** Несколько соревнований (новое поле). competitionWeek — алиас для events[0].week. */
  competitions?: CompetitionEvent[];
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
  competitionWeek?: number;   // неделя соревнований (если есть, одиночное)
  competitionDate?: string;   // ISO-дата соревнований (альтернатива competitionWeek)
  totalWeeks?: number;        // по умолчанию 52
  /** Несколько соревнований (новое). Если задано — competitionWeek игнорируется. */
  competitions?: CompetitionEvent[];
}

export function buildMacrocycle(input: MacroInput): Macrocycle {
  // Если заданы несколько соревнований — использовать мульти-режим.
  if (input.competitions && input.competitions.length > 0) {
    return buildMacrocycleMulti(input.competitions, input);
  }
  // Одиночный режим (обратно-совместимый с предыдущей версией).
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

/**
 * Построить макроцикл под НЕСКОЛЬКО соревнований.
 *
 * Стратегия (Bompa/Haff — Theory and Methodology of Training):
 *  - Главное соревнование (priority 'A') → полный макроцикл: подготовка → пик → соревнование → переход.
 *  - Контрольные (priority 'B') → короткий пик (2-3 нед) + соревнование (1 нед), без перехода.
 *  - Тренировочные (priority 'C') → встроены в подготовку, отдельного пика нет (mock meet).
 *
 * Между соревнованиями — фаза GPP/accumulation (возврат к базе).
 * Сплит (endurance→strength) заполняет промежутки между соревнованиями.
 *
 * @param events — список соревнований (отсортируются по неделе)
 * @param input — базовые параметры (level, goal, totalWeeks)
 */
export function buildMacrocycleMulti(events: CompetitionEvent[], input: Omit<MacroInput, 'competitions' | 'competitionWeek' | 'competitionDate'>): Macrocycle {
  const total = input.totalWeeks || 52;
  const goal = input.goal;
  const level = input.level;
  // Сортируем события по неделе, главное (A) — приоритетнее при равенстве.
  const sorted = [...events].sort((a, b) => {
    if (a.week !== b.week) return a.week - b.week;
    const pr = { A: 0, B: 1, C: 2 };
    return pr[a.priority] - pr[b.priority];
  });

  const blocks: MacroBlock[] = [];
  const rationale: string[] = [];
  let cursor = 1; // текущая неделя (1-индекс)

  // Если первое соревнование далеко — добавить начальную фазу endurance/strength.
  // ВАЖНО: оставляем место для peak-блока (peakStart = firstCompWeek - peakWeeks).
  if (sorted.length > 0) {
    const firstComp = sorted[0];
    const firstPeakWeeks = firstComp.priority === 'A' ? 4 : firstComp.priority === 'B' ? 2 : 0;
    const peakStart = firstComp.week - firstPeakWeeks; // неделя, с которой начинается peak
    const gapBefore = peakStart - cursor; // доступное место для подготовки
    if (gapBefore > 8) {
      // Начальная подготовка: 40% endurance, 60% strength
      const enduranceWeeks = Math.max(2, Math.round(gapBefore * 0.4));
      const strengthWeeks = Math.max(2, gapBefore - enduranceWeeks);
      pushPhaseBlock('endurance', enduranceWeeks);
      pushPhaseBlock('strength', strengthWeeks);
    } else if (gapBefore >= 3) {
      // Короткая подготовка
      pushPhaseBlock('strength', gapBefore);
    }
  }

  for (let i = 0; i < sorted.length; i++) {
    const comp = sorted[i];
    const isLast = i === sorted.length - 1;
    const isMain = comp.priority === 'A';
    const isControl = comp.priority === 'B';

    // Длительность пика зависит от приоритета:
    //  A (главное) → 3-4 нед peak + 1 нед competition
    //  B (контрольное) → 2 нед peak + 1 нед competition
    //  C (тренировочное) → 1 нед (встроено в подготовку, отдельного competition-блока нет)
    if (comp.priority === 'C') {
      // Тренировочное соревнование — не создаём отдельные блоки, оно внутри подготовки.
      rationale.push(`🏁 «${comp.name}» (C, нед ${comp.week}): тренировочное, встроено в подготовку.`);
      continue;
    }
    const peakWeeks = isMain ? 4 : isControl ? 2 : 2;
    const compWeeks = 1;
    const peakStart = comp.week - peakWeeks;
    // Если cursor уже зашел за peakStart (подготовка переполнилась) — обрезать peak.
    const effPeakStart = Math.max(cursor, peakStart);
    const effPeakWeeks = Math.max(1, comp.week - effPeakStart); // не выходить за comp.week
    // Если есть зазор между cursor и effPeakStart — заполнить strength/accumulation.
    if (effPeakStart > cursor) {
      const gap = effPeakStart - cursor;
      // Разделить: 70% strength, 30% endurance (если gap большой)
      if (gap >= 6) {
        pushPhaseBlock('strength', Math.max(2, Math.round(gap * 0.7)));
        if (gap - Math.round(gap * 0.7) >= 2) pushPhaseBlock('endurance', gap - Math.round(gap * 0.7));
      } else {
        pushPhaseBlock('strength', gap);
      }
    }
    // Peak блок (привязан к соревнованию) — ровно до comp.week
    pushPhaseBlock('peak', effPeakWeeks, comp.id);
    // Competition блок (1 неделя) — ровно на comp.week
    pushPhaseBlock('competition', compWeeks, comp.id);
    rationale.push(`🏁 «${comp.name}» (${comp.priority}, нед ${comp.week}): peak ${effPeakWeeks} нед + competition ${compWeeks} нед.`);

    // После главного (A) соревнования — переход (transition) 2-4 нед, если не последнее.
    if (isMain && !isLast) {
      const next = sorted[i + 1];
      const gapAfter = next.week - (comp.week + compWeeks);
      if (gapAfter >= 4) {
        pushPhaseBlock('transition', Math.min(4, Math.round(gapAfter * 0.4)));
      }
    }
  }

  // Заполнить хвост (если cursor < total) — transition/endurance.
  if (cursor <= total) {
    const tail = total - cursor + 1;
    if (tail >= 6) {
      pushPhaseBlock('transition', Math.max(2, Math.round(tail * 0.4)));
      pushPhaseBlock('endurance', tail - Math.round(tail * 0.4));
    } else {
      pushPhaseBlock('transition', tail);
    }
  }
  // Если cursor > total — обрезать последний блок.
  while (blocks.length > 0 && blocks[blocks.length - 1].weekOffset + blocks[blocks.length - 1].weeks - 1 > total) {
    const last = blocks[blocks.length - 1];
    const overflow = last.weekOffset + last.weeks - 1 - total;
    if (last.weeks > overflow) {
      last.weeks -= overflow;
    } else {
      blocks.pop();
    }
  }

  const competitions = sorted;
  // Обратно-совместимое поле: главное соревнование (первое A, иначе первое).
  const mainComp = sorted.find(c => c.priority === 'A') ?? sorted[0];
  return {
    blocks,
    totalWeeks: total,
    competitionWeek: mainComp?.week,
    competitionDate: mainComp?.date,
    competitions,
    rationale,
  };

  // Вспомогательная функция — добавить блок фазы.
  function pushPhaseBlock(phase: MacroPhase, weeks: number, competitionId?: string): void {
    if (weeks <= 0) return;
    const isBB = goal === 'bodybuilding' && (phase === 'endurance' || phase === 'strength' || phase === 'transition');
    const kind: CycleKind = isBB ? 'BB' : 'SRC';
    let cycleId: string | undefined;
    let desc = '';
    if (kind === 'SRC') {
      const cyc = pickCycleForPhase(phase, level, goal);
      cycleId = cyc?.meta.id;
      desc = cyc ? `СРЦ «${cyc.meta.title}»` : `СРЦ-цикл под период ${phase}`;
    } else {
      desc = `BB-мезоцикл (${phase})`;
    }
    blocks.push({ phase, weeks, weekOffset: cursor, kind, cycleId, description: desc, competitionId });
    rationale.push(`${phase}: ${weeks} нед (с ${cursor}), ${kind}${cycleId ? ' (' + cycleId + ')' : ''}${competitionId ? ' [🏁 ' + competitionId + ']' : ''}`);
    cursor += weeks;
  }
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
    b: macro.blocks.map(b => [b.phase, b.weeks, b.weekOffset, b.kind, b.cycleId ?? null, b.description, b.competitionId ?? null]),
    t: macro.totalWeeks,
    c: macro.competitionWeek ?? null,
    d: macro.competitionDate ?? null,
    e: macro.competitions ?? null, // новые: список соревнований
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
      kind: (b[3] || 'SRC') as CycleKind, // v1-миграция: если kind falsy → 'SRC'
      cycleId: b[4] || undefined,
      description: b[5] || '',
      competitionId: b[6] || undefined, // v2: competitionId (может отсутствовать в старых данных)
    }));
    // Десериализация competitions (опционально, для обратно-совместимости)
    let competitions: CompetitionEvent[] | undefined;
    if (Array.isArray(o.e)) {
      competitions = o.e.map((ev: any) => ({
        id: ev.id ?? ev.i ?? 'comp_' + Math.random().toString(36).slice(2, 8),
        name: ev.name ?? ev.n ?? '',
        week: ev.week ?? ev.w ?? 1,
        date: ev.date ?? ev.d,
        priority: ev.priority ?? ev.p ?? 'B',
        notes: ev.notes ?? ev.no,
      }));
    }
    return {
      blocks,
      totalWeeks: o.t,
      competitionWeek: o.c ?? undefined,
      competitionDate: o.d ?? undefined,
      competitions,
      rationale: o.r || [],
    };
  } catch { return null; }
}

export { PHASE_COLOR, PHASE_LABEL_RU };