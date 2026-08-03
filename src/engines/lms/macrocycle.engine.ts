/**
 * macrocycle.engine.ts - годовое планирование (Этап T0, REUSE+EXTEND training-cycle-planner/cycle.engine).
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
import { LMS_CYCLES, normalizeCycleDirection, getCycleById } from '../../data/lms-cycles/lms-cycle-index';
import type { BBTrainingFocus } from '../bb/bb-goal-types';

// ─── PL-макроцикл (5 фаз: endurance → strength → peak → competition → transition) ───

export type MacroPhase = 'endurance' | 'strength' | 'peak' | 'competition' | 'transition';
export type CycleKind = 'SRC' | 'BB';

export interface MacroBlock {
  phase: MacroPhase;
  weeks: number;
  weekOffset: number;        // стартовая неделя (1-индекс) в макроцикле
  kind: CycleKind;
  cycleId?: string;          // для SRC - id из lms-cycle-index
  description: string;
  /** id соревнования, к которому относится блок (если phase=peak/competition). */
  competitionId?: string;
}

export interface Macrocycle {
  blocks: MacroBlock[];
  totalWeeks: number;
  competitionWeek?: number;  // устаревшее: неделя главного соревнования (обратно-совместимо)
  competitionDate?: string;  // устаревшее: ISO-дата главного соревнования
  /** Несколько соревнований (новое поле). competitionWeek - алиас для events[0].week. */
  competitions?: CompetitionEvent[];
  rationale: string[];
}

// ─── BB-макроцикл (4 фазы: hypertrophy → strength → contest_prep → transition) ───

/** BB-специфичные фазы годового планирования (бодибилдинг). */
export type BBMacroPhase = 'hypertrophy' | 'strength' | 'contest_prep' | 'transition';

/** Блок BB-макроцикла. Всегда BB, без СРЦ-циклов. */
export interface BBMacroBlock {
  phase: BBMacroPhase;
  weeks: number;
  weekOffset: number;
  description: string;
  /** id соревнования, к которому относится блок (contest_prep). */
  competitionId?: string;
  /** Training focus для фазы (по умолчанию - hypertrophy для hypertrophy, strength для strength и т.д.). */
  trainingFocus?: BBTrainingFocus;
}

/** BB-макроцикл: 4 фазы со своими кол-вами недель, соревнованиями и training focus. */
export interface BBMacrocycle {
  blocks: BBMacroBlock[];
  totalWeeks: number;
  competitions?: CompetitionEvent[];
  trainingFocus: BBTrainingFocus;  // общий focus на цикл
  rationale: string[];
}

/** Соревнование в макроцикле (общий для PL/BB). */
export interface CompetitionEvent {
  id: string;                // уникальный id (для связи с блоками)
  name: string;              // название (например, "Первенство области")
  week: number;              // неделя соревнований (1-индекс)
  date?: string;             // ISO-дата (опционально)
  priority: 'A' | 'B' | 'C'; // A - главное, B - отборочное/контрольное, C - тренировочное
  notes?: string;
  /** ID СРЦ-цикла для peak/competition фаз (обратно-совместимый, первый/основной цикл). */
  cycleId?: string;
  /** Список ID СРЦ-циклов (несколько циклов на одно соревнование, последовательно по неделям пика).
   *  Если задан - пик делится на под-блоки, каждому присваивается свой cycleId по индексу. */
  cycleIds?: string[];
}

/**
 * Входные параметры для buildBbMacrocycle.
 */
export interface BbMacroInput {
  level: string;
  totalWeeks?: number;         // по умолчанию 52
  competitions?: CompetitionEvent[];
  trainingFocus?: BBTrainingFocus;  // общий focus на весь макроцикл
}

const PHASE_TO_PERIOD: Record<MacroPhase, string[]> = {
  endurance: ['endurance', 'mixed', 'mass'],  // expanded: endurance cycles may use mixed/mass periods
  strength: ['strength', 'mixed', 'mass'],
  peak: ['peak'],
  competition: ['peak'],
  transition: ['endurance', 'strength', 'mixed'],
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

/** Проверить ISO дату соревнования без принятия JS-нормализации вроде 2025-02-30. */
function isValidCompetitionDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isFinite(new Date(value).getTime())
    && date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

/**
 * Подобрать СРЦ-цикл под фазу макроцикла (с учётом направления).
 *
 * Fixes from audit:
 * - endurance phase + powerlifting goal: no 'endurance' period cycles with 'strength'
 *   direction exist. Expanded PHASE_TO_PERIOD to include mixed/mass for endurance.
 * - competition phase: returns undefined (competition is 1 week, no training cycle needed).
 * - fallback chain: byLevelDir → byLevel → dirFiltered → candidates by period → undefined.
 */
function pickCycleForPhase(phase: MacroPhase, level: string, goal: 'powerlifting' | 'bodybuilding' | 'general'): SRCycleTemplate | undefined {
  // Competition is 1 week of actual competition - no training cycle assigned.
  if (phase === 'competition') return undefined;

  const periods = PHASE_TO_PERIOD[phase];
  const wantStrength = goal === 'powerlifting';
  const candidates = LMS_CYCLES.filter(c => periods.includes(c.meta.period));
  // Для general направление не ограничиваем: выбираем прежде всего по периоду и уровню.
  const dirFiltered = candidates.filter(c => {
    const nd = normalizeCycleDirection(c.meta.direction);
    if (goal === 'general') return true;
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
  // 4) fallback - любой по периоду
  if (candidates.length > 0) return candidates[0];
  // 5) fallback - любой strength/peak cycle (last resort)
  const anyPeak = LMS_CYCLES.filter(c => c.meta.period === 'peak');
  if (anyPeak.length > 0) return anyPeak[0];
  return undefined;
}

export interface MacroInput {
  level: string;
  goal: 'powerlifting' | 'bodybuilding' | 'general';
  competitionWeek?: number;   // неделя соревнований (если есть, одиночное)
  competitionDate?: string;   // ISO-дата соревнований (альтернатива competitionWeek)
  totalWeeks?: number;        // по умолчанию 52
  /** Несколько соревнований (новое). Если задано - competitionWeek игнорируется. */
  competitions?: CompetitionEvent[];
}

export function buildMacrocycle(input: MacroInput): Macrocycle {
  // Если заданы несколько соревнований - использовать мульти-режим.
  if (input.competitions && input.competitions.length > 0) {
    return buildMacrocycleMulti(input.competitions, input);
  }
  // Явная дата/неделя соревнования должна влиять на timeline, а не только
  // сохраняться в metadata. Используем тот же алгоритм, что и для multi-mode.
  if (input.competitionWeek != null || input.competitionDate) {
    const total = Math.max(12, Math.min(104, input.totalWeeks || 52));
    const week = input.competitionWeek != null
      ? Math.max(1, Math.min(total, Math.round(input.competitionWeek)))
      : estimateCompetitionWeek(input.competitionDate!, total);
    return buildMacrocycleMulti([{
      id: 'competition_main',
      name: 'Главное соревнование',
      week,
      date: input.competitionDate,
      priority: 'A',
    }], { level: input.level, goal: input.goal, totalWeeks: total });
  }
  // Одиночный режим (обратно-совместимый с предыдущей версией).
  const total = Math.max(12, Math.min(104, input.totalWeeks || 52));
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
      desc = cyc ? `СРЦ «${cyc.meta.title}»` : phase === 'competition' ? 'Соревновательная неделя' : `СРЦ-цикл под период ${phase}`;
    } else {
      desc = `BB-мезоцикл (${phase})`;
    }
    blocks.push({ phase, weeks, weekOffset: w + 1, kind, cycleId, description: desc });
    rationale.push(`${phase}: ${weeks} нед (с ${w + 1}), ${kind}${cycleId ? ' (' + cycleId + ')' : ''}`);
    w += weeks;
  }
  // Подогнать под total, не создавая нулевых/отрицательных фаз при коротких
  // валидных макроциклах (например, 12 недель: округлённые минимумы дают 14).
  let difference = total - w;
  if (difference < 0) {
    while (difference < 0) {
      const candidate = blocks
        .filter(block => block.weeks > 2)
        .sort((a, b) => b.weeks - a.weeks)[0];
      if (!candidate) break;
      candidate.weeks -= 1;
      difference += 1;
    }
  } else if (difference > 0) {
    blocks[blocks.length - 1].weeks += difference;
  }
  let offset = 1;
  for (const block of blocks) {
    block.weekOffset = offset;
    offset += block.weeks;
  }

  const competitionWeek = input.competitionWeek ?? (input.competitionDate ? estimateCompetitionWeek(input.competitionDate, total) : undefined);

  return { blocks, totalWeeks: total, competitionWeek, competitionDate: input.competitionDate, rationale };
}

/**
 * Построить макроцикл под НЕСКОЛЬКО соревнований.
 *
 * Стратегия (Bompa/Haff - Theory and Methodology of Training):
 *  - Главное соревнование (priority 'A') → полный макроцикл: подготовка → пик → соревнование → переход.
 *  - Контрольные (priority 'B') → короткий пик (2-3 нед) + соревнование (1 нед), без перехода.
 *  - Тренировочные (priority 'C') → встроены в подготовку, отдельного пика нет (mock meet).
 *
 * Между соревнованиями - фаза GPP/accumulation (возврат к базе).
 * Сплит (endurance→strength) заполняет промежутки между соревнованиями.
 *
 * @param events - список соревнований (отсортируются по неделе)
 * @param input - базовые параметры (level, goal, totalWeeks)
 */
export function buildMacrocycleMulti(events: CompetitionEvent[], input: Omit<MacroInput, 'competitions' | 'competitionWeek' | 'competitionDate'>): Macrocycle {
  const total = Math.max(12, Math.min(104, input.totalWeeks || 52));
  const goal = input.goal;
  const level = input.level;
  const eventIds = new Set<string>();
  for (const event of events) {
    if (!event || typeof event.id !== 'string' || !event.id || typeof event.name !== 'string' || !Number.isFinite(event.week) || !Number.isInteger(event.week) || event.week < 1 || event.week > total || !['A', 'B', 'C'].includes(event.priority) || (event.date != null && !isValidCompetitionDate(event.date))) {
      throw new Error('Некорректное соревнование в макроцикле');
    }
    if (eventIds.has(event.id)) throw new Error(`Дублирующийся ID соревнования: ${event.id}`);
    eventIds.add(event.id);
    if (event.cycleIds && (!Array.isArray(event.cycleIds) || event.cycleIds.some(id => typeof id !== 'string'))) {
      throw new Error(`Некорректные циклы соревнования: ${event.id}`);
    }
  }
  const normalizedEvents = events.map(event => ({
    ...event,
    week: event.week,
  }));
  // Сортируем события по неделе, главное (A) - приоритетнее при равенстве.
  const sorted = normalizedEvents.sort((a, b) => {
    if (a.week !== b.week) return a.week - b.week;
    const pr = { A: 0, B: 1, C: 2 };
    return pr[a.priority] - pr[b.priority];
  });
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].week === sorted[i - 1].week) {
      throw new Error(`Соревнования не могут проходить на одной неделе (${sorted[i].week})`);
    }
  }

  const blocks: MacroBlock[] = [];
  const rationale: string[] = [];
  let cursor = 1; // текущая неделя (1-индекс)

  // Если первое соревнование далеко - добавить начальную фазу endurance/strength.
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

    if (comp.priority === 'C') {
      rationale.push(`🏁 «${comp.name}» (C, нед ${comp.week}): тренировочное, встроено в подготовку.`);
      continue;
    }
    const peakWeeks = isMain ? 4 : isControl ? 2 : 2;
    const compWeeks = 1;
    if (cursor > comp.week) {
      throw new Error(`Недостаточно места до соревнования «${comp.name}» (неделя ${comp.week})`);
    }
    const peakStart = comp.week - peakWeeks;
    const effPeakStart = Math.max(cursor, peakStart);
    const effPeakWeeks = Math.max(0, comp.week - effPeakStart);
    if (effPeakStart > cursor) {
      const gap = effPeakStart - cursor;
      if (gap >= 6) {
        pushPhaseBlock('strength', Math.max(2, Math.round(gap * 0.7)));
        if (gap - Math.round(gap * 0.7) >= 2) pushPhaseBlock('endurance', gap - Math.round(gap * 0.7));
      } else {
        pushPhaseBlock('strength', gap);
      }
    }
    const compCycles = comp.cycleIds && comp.cycleIds.length > 0
      ? comp.cycleIds.filter((cid): cid is string => Boolean(cid))
      : null;
    if (compCycles && compCycles.length > effPeakWeeks) {
      throw new Error(`Для соревнования «${comp.name}» выбрано ${compCycles.length} циклов, но пик длится только ${effPeakWeeks} нед.`);
    }
    if (compCycles && compCycles.length > 0 && effPeakWeeks >= compCycles.length) {
      const base = Math.floor(effPeakWeeks / compCycles.length);
      const remainder = effPeakWeeks - base * compCycles.length;
      for (let ci = 0; ci < compCycles.length; ci++) {
        const subWeeks = base + (ci < remainder ? 1 : 0);
        if (subWeeks <= 0) continue;
        pushPhaseBlock('peak', subWeeks, comp.id, compCycles[ci]);
      }
    } else if (effPeakWeeks > 0) {
      pushPhaseBlock('peak', effPeakWeeks, comp.id);
    }
    // Competition блок (1 неделя) - ровно на comp.week. Competition phase gets no cycleId.
    pushPhaseBlock('competition', compWeeks, comp.id);
    rationale.push(`🏁 «${comp.name}» (${comp.priority}, нед ${comp.week}): peak ${effPeakWeeks} нед${compCycles && compCycles.length > 1 ? ` (${compCycles.length} циклов)` : ''} + competition ${compWeeks} нед.`);

    if (isMain && !isLast) {
      const next = sorted[i + 1];
      const gapAfter = next.week - (comp.week + compWeeks);
      if (gapAfter >= 4) {
        pushPhaseBlock('transition', Math.min(4, Math.round(gapAfter * 0.4)));
      }
    }
  }

  // Заполнить хвост (если cursor < total) - transition/endurance.
  if (cursor <= total) {
    const tail = total - cursor + 1;
    if (tail >= 6) {
      pushPhaseBlock('transition', Math.max(2, Math.round(tail * 0.4)));
      pushPhaseBlock('endurance', tail - Math.round(tail * 0.4));
    } else {
      pushPhaseBlock('transition', tail);
    }
  }
  // Если cursor > total - обрезать последний блок.
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
  const mainComp = sorted.find(c => c.priority === 'A') ?? sorted[0];
  return {
    blocks,
    totalWeeks: total,
    competitionWeek: mainComp?.week,
    competitionDate: mainComp?.date,
    competitions,
    rationale,
  };

  function pushPhaseBlock(phase: MacroPhase, weeks: number, competitionId?: string, forceCycleId?: string): void {
    if (weeks <= 0) return;
    const isBB = goal === 'bodybuilding' && (phase === 'endurance' || phase === 'strength' || phase === 'transition');
    const kind: CycleKind = isBB ? 'BB' : 'SRC';
    let cycleId: string | undefined;
    let desc = '';
    if (kind === 'SRC') {
      const comp = competitionId ? sorted.find(c => c.id === competitionId) : undefined;
      const userCycleId = forceCycleId ?? comp?.cycleId;
      if (userCycleId) {
        const cyc = getCycleById(userCycleId);
        cycleId = userCycleId;
        desc = cyc ? `СРЦ «${cyc.meta.title}» (выбран)` : `СРЦ ${userCycleId} (не найден - проверьте выбор)`;
      } else if (phase === 'competition') {
        // Competition is 1 week - no training cycle needed.
        desc = 'Соревновательная неделя';
      } else {
        const cyc = pickCycleForPhase(phase, level, goal);
        cycleId = cyc?.meta.id;
        desc = cyc ? `СРЦ «${cyc.meta.title}»` : `СРЦ-цикл под период ${phase}`;
      }
    } else {
      desc = `BB-мезоцикл (${phase})`;
    }
    blocks.push({ phase, weeks, weekOffset: cursor, kind, cycleId, description: desc, competitionId });
    rationale.push(`${phase}: ${weeks} нед (с ${cursor}), ${kind}${cycleId ? ' (' + cycleId + ')' : ''}${competitionId ? ' [🏁 ' + competitionId + ']' : ''}`);
    cursor += weeks;
  }
}

/** Грубая оценка недели соревнований из даты (отсчёт от сегодня). */
export function estimateCompetitionWeek(isoDate: string, totalWeeks: number = 52, referenceDate?: string | Date): number {
  try {
    const target = new Date(isoDate).getTime();
    if (!Number.isFinite(target)) return Math.max(1, Math.min(totalWeeks, Math.round(totalWeeks * 0.85)));
    const reference = referenceDate == null
      ? Date.now()
      : (referenceDate instanceof Date ? referenceDate.getTime() : new Date(referenceDate).getTime());
    const now = Number.isFinite(reference) ? reference : Date.now();
    const daysDiff = Math.round((target - now) / 86400000);
    // Use Math.floor for consistent week boundaries: day 0 = week 1, day 7 = week 2.
    // Math.round caused off-by-one: day 4 would round to week 2 instead of week 1.
    const week = Math.floor(daysDiff / 7) + 1;
    return Math.max(1, Math.min(totalWeeks, week));
  } catch { return Math.max(1, Math.min(totalWeeks, Math.round(totalWeeks * 0.85))); }
}

/**
 * Найти активный блок макроцикла на неделе N (1-индекс).
 * Возвращает блок и cycleId, который должен быть активен.
 */
export function macrocycleToActiveCycle(macro: Macrocycle, weekNumber: number): { block: MacroBlock; cycleId?: string } | null {
  if (macro.blocks.length === 0) return null;
  if (weekNumber < macro.blocks[0].weekOffset) {
    const first = macro.blocks[0];
    return { block: first, cycleId: first.cycleId };
  }
  for (const block of macro.blocks) {
    if (weekNumber >= block.weekOffset && weekNumber < block.weekOffset + block.weeks) {
      return { block, cycleId: block.cycleId };
    }
  }
  // fallback - последний блок
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
 *
 * Fix: allocation ensures minimum 1 week per block to prevent
 * blocks from disappearing when target < number of blocks in a phase group.
 */
export function rebalanceMacrocycle(macro: Macrocycle, edits: MacroRebalanceEdit[]): Macrocycle {
  const editMap = new Map(edits.map(e => [e.phase, Math.max(1, e.weeks)]));
  const phaseGroups = new Map<MacroPhase, MacroBlock[]>();
  for (const block of macro.blocks) {
    const group = phaseGroups.get(block.phase) ?? [];
    group.push(block);
    phaseGroups.set(block.phase, group);
  }
  const newBlocks: MacroBlock[] = [];
  let offset = 1;
  const allocations = new Map<MacroBlock, number>();
  for (const group of phaseGroups.values()) {
    const requested = editMap.get(group[0].phase);
    const originalTotal = group.reduce((sum, block) => sum + block.weeks, 0);
    const target = requested == null ? originalTotal : Math.max(group.length, requested);
    // Ensure target >= group.length so each block gets at least 1 week.
    let allocated = 0;
    group.forEach((block, index) => {
      const weeks = index === group.length - 1
        ? Math.max(1, target - allocated)
        : Math.max(1, Math.floor(target * block.weeks / Math.max(1, originalTotal)));
      allocated += weeks;
      allocations.set(block, weeks);
    });
    // Clamp: if allocated > target due to floor rounding, subtract from last block
    if (allocated > target && group.length > 0) {
      const lastBlock = group[group.length - 1];
      const lastWeeks = allocations.get(lastBlock)!;
      const excess = allocated - target;
      allocations.set(lastBlock, Math.max(1, lastWeeks - excess));
    }
  }
  for (const block of macro.blocks) {
    const weeks = allocations.get(block) ?? block.weeks;
    newBlocks.push({ ...block, weeks, weekOffset: offset });
    offset += weeks;
  }
  // подогнать под totalWeeks: разницу в последний блок
  const sum = newBlocks.reduce((s, b) => s + b.weeks, 0);
  if (sum !== macro.totalWeeks && newBlocks.length > 0) {
    let difference = macro.totalWeeks - sum;
    if (difference > 0) {
      newBlocks[newBlocks.length - 1].weeks += difference;
    } else {
      for (let i = newBlocks.length - 1; i >= 0 && difference < 0; i--) {
        const reducible = Math.min(newBlocks[i].weeks - 1, -difference);
        newBlocks[i].weeks -= reducible;
        difference += reducible;
      }
    }
    // пересчитать offsets
    let off = 1;
    for (const b of newBlocks) { b.weekOffset = off; off += b.weeks; }
  }
  const newTotal = newBlocks.reduce((s, b) => s + b.weeks, 0);
  const rationale = newBlocks.map(b => `${b.phase}: ${b.weeks} нед (с ${b.weekOffset}), ${b.kind}${b.cycleId ? ' (' + b.cycleId + ')' : ''}`);
  const competitions = macro.competitions?.map(competition => {
    const block = newBlocks.find(candidate => candidate.phase === 'competition' && candidate.competitionId === competition.id);
    return block ? { ...competition, week: block.weekOffset } : competition;
  });
  const mainCompetition = competitions?.find(competition => competition.priority === 'A') ?? competitions?.[0];
  return {
    blocks: newBlocks,
    totalWeeks: newTotal,
    competitionWeek: mainCompetition?.week ?? macro.competitionWeek,
    competitionDate: mainCompetition?.date ?? macro.competitionDate,
    competitions,
    rationale,
  };
}

/** Сериализация для localStorage (компактная, без лишних полей). */
export function serializeMacro(macro: Macrocycle): string {
  return JSON.stringify({
    v: 6,
    b: macro.blocks.map(b => [b.phase, b.weeks, b.weekOffset, b.kind, b.cycleId ?? null, b.description, b.competitionId ?? null]),
    t: macro.totalWeeks,
    c: macro.competitionWeek ?? null,
    d: macro.competitionDate ?? null,
    e: macro.competitions ? macro.competitions.map(co => [
      co.id, co.name, co.week, co.date ?? null, co.priority, co.notes ?? null,
      co.cycleId ?? null, co.cycleIds ?? null,
    ]) : null,
    r: macro.rationale,
  });
}

export function deserializeMacro(s: string): Macrocycle | null {
  try {
    const o = JSON.parse(s);
    if (!o || !Array.isArray(o.b)) return null;
    if (o.v != null && o.v !== 6 && o.v !== 5 && o.v !== 4 && o.v !== 3 && o.v !== 2 && o.v !== 1) return null;
    const validPhases: MacroPhase[] = ['endurance', 'strength', 'peak', 'competition', 'transition'];
    const blocks: MacroBlock[] = o.b.map((b: unknown) => {
      if (!Array.isArray(b) || !validPhases.includes(b[0]) || !Number.isInteger(b[1]) || b[1] <= 0 || !Number.isInteger(b[2]) || b[2] < 1) {
        throw new Error('invalid macro block');
      }
      const kind = b[3] || 'SRC';
      if (kind !== 'SRC' && kind !== 'BB') throw new Error('invalid macro block kind');
      if (b[4] != null && typeof b[4] !== 'string') throw new Error('invalid macro cycleId');
      if (b[5] != null && typeof b[5] !== 'string') throw new Error('invalid macro description');
      if (b[6] != null && typeof b[6] !== 'string') throw new Error('invalid macro competitionId');
      return {
        phase: b[0] as MacroPhase,
        weeks: b[1],
        weekOffset: b[2],
        kind: kind as CycleKind,
        cycleId: b[4] || undefined,
        description: b[5] || '',
        competitionId: b[6] || undefined,
      };
    });
    if (!Number.isFinite(o.t) || o.t < 1 || o.t > 104 || blocks.length === 0) return null;
    let expectedOffset = 1;
    for (const block of blocks) {
      if (block.weekOffset !== expectedOffset) return null;
      expectedOffset += block.weeks;
    }
    if (expectedOffset - 1 !== o.t) return null;
    if (blocks.some(block => block.weekOffset + block.weeks - 1 > o.t)) return null;
    let competitions: CompetitionEvent[] | undefined;
    if (Array.isArray(o.e)) {
      competitions = o.e.map((ev: unknown, index: number) => {
        if (Array.isArray(ev)) {
          const priority = ev[4] ?? 'B';
          if (!['A', 'B', 'C'].includes(priority) || !Number.isInteger(ev[2]) || ev[2] < 1 || ev[2] > o.t) throw new Error('invalid competition');
          if (ev[0] != null && typeof ev[0] !== 'string') throw new Error('invalid competition id');
          if (ev[1] != null && typeof ev[1] !== 'string') throw new Error('invalid competition name');
          if (ev[3] != null && !isValidCompetitionDate(ev[3])) throw new Error('invalid competition date');
          if (ev[5] != null && typeof ev[5] !== 'string') throw new Error('invalid competition notes');
          if (ev[6] != null && typeof ev[6] !== 'string') throw new Error('invalid competition cycleId');
          if (ev[7] != null && (!Array.isArray(ev[7]) || ev[7].some((id: unknown) => typeof id !== 'string'))) throw new Error('invalid competition cycleIds');
          if (ev[6] != null && typeof ev[6] !== 'string') throw new Error('invalid competition cycleId');
          if (ev[7] != null && (!Array.isArray(ev[7]) || ev[7].some((id: unknown) => typeof id !== 'string'))) throw new Error('invalid competition cycleIds');
          return {
             id: ev[0] ?? `comp_${index + 1}`,
             name: ev[1] ?? '',
            week: ev[2] ?? 1,
            date: ev[3] ?? undefined,
            priority: priority as CompetitionEvent['priority'],
            notes: ev[5] ?? undefined,
            cycleId: ev[6] ?? undefined,
            cycleIds: Array.isArray(ev[7]) ? ev[7] : undefined,
           };
        }
        if (!ev || typeof ev !== 'object') throw new Error('invalid competition');
        const record = ev as Record<string, unknown>;
        const priority = record.priority ?? record.p ?? 'B';
        const rawWeek = record.week ?? record.w ?? 1;
        if (typeof priority !== 'string' || !['A', 'B', 'C'].includes(priority) || typeof rawWeek !== 'number' || !Number.isInteger(rawWeek) || rawWeek < 1 || rawWeek > (o.t as number)) throw new Error('invalid competition');
        const week = rawWeek;
        const id = record.id ?? record.i;
        const name = record.name ?? record.n;
        const date = record.date ?? record.d;
        const notes = record.notes ?? record.no;
        const cycleId = record.cycleId ?? record.ci ?? record.cy;
        const cycleIds = record.cycleIds;
        if (id != null && typeof id !== 'string') throw new Error('invalid competition id');
        if (name != null && typeof name !== 'string') throw new Error('invalid competition name');
        if (date != null && !isValidCompetitionDate(date)) throw new Error('invalid competition date');
        if (notes != null && typeof notes !== 'string') throw new Error('invalid competition notes');
        if (cycleId != null && typeof cycleId !== 'string') throw new Error('invalid competition cycleId');
        if (cycleIds != null && (!Array.isArray(cycleIds) || cycleIds.some((value: unknown) => typeof value !== 'string'))) throw new Error('invalid competition cycleIds');
        return {
          id: id as string ?? `comp_${index + 1}`,
          name: name as string ?? '',
          week,
          date: date as string | undefined,
          priority: priority as CompetitionEvent['priority'],
          notes: notes as string | undefined,
          cycleId: cycleId as string | undefined,
          cycleIds: cycleIds as string[] | undefined,
        };
      });
      const competitionIds = new Set<string>();
      const competitionWeeks = new Set<number>();
      for (const competition of competitions!) {
        if (competitionIds.has(competition.id)) throw new Error('duplicate competition id');
        competitionIds.add(competition.id);
        if (competitionWeeks.has(competition.week)) throw new Error('duplicate competition week');
        competitionWeeks.add(competition.week);
      }
    }
    if (o.c != null && (!Number.isInteger(o.c) || o.c < 1 || o.c > o.t)) return null;
    if (o.d != null && !isValidCompetitionDate(o.d)) return null;
    if (o.r != null && (!Array.isArray(o.r) || o.r.some((line: unknown) => typeof line !== 'string'))) return null;
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

// ─── BB-макроцикл константы ─────────────────────────────────────────────────

export const BB_PHASES: BBMacroPhase[] = ['hypertrophy', 'strength', 'contest_prep', 'transition'];

const BB_PHASE_ORDER: BBMacroPhase[] = ['hypertrophy', 'strength', 'contest_prep', 'transition'];

const BB_PHASE_COLOR: Record<BBMacroPhase, string> = {
  hypertrophy: '#22c55e',
  strength: '#3b82f6',
  contest_prep: '#f59e0b',
  transition: '#71717a',
};

const BB_PHASE_LABEL_RU: Record<BBMacroPhase, string> = {
  hypertrophy: 'Гипертрофия',
  strength: 'Силовой',
  contest_prep: 'Подготовка',
  transition: 'Переход',
};

const BB_PHASE_ICON: Record<BBMacroPhase, string> = {
  hypertrophy: '💪',
  strength: '🏋️',
  contest_prep: '🏁',
  transition: '🧘',
};

/**
 * Распределение долей фаз BB-макроцикла (Bompa 2009, Helms 2022).
 * - hypertrophy: 40% - массонабор, MEV→MAV→MRV прогрессия
 * - strength: 25% - интенсификация, нейромоторика, lower volume
 * - contest_prep: 20% - пик формы, taper, définition
 * - transition: 15% - восстановление, deload
 */
const BB_DISTRIBUTION: Record<BBMacroPhase, number> = {
  hypertrophy: 0.40,
  strength: 0.25,
  contest_prep: 0.20,
  transition: 0.15,
};

/**
 * Default training focus per BB macro phase (auto-assigned if not overridden).
 */
const BB_PHASE_FOCUS: Record<BBMacroPhase, BBTrainingFocus> = {
  hypertrophy: 'hypertrophy',
  strength: 'strength',
  contest_prep: 'endurance',
  transition: 'hypertrophy',
};

/**
 * Построить BB-макроцикл (4 фазы: hypertrophy → strength → contest_prep → transition).
 *
 * В отличие от PL-макроцикла (5 фаз с СРЦ-циклами), BB-макроцикл:
 *   - использует BB-специфичные фазы (гипертрофия вместо выносливости)
 *   - не назначает СРЦ-циклы (все блоки kind='BB')
 *   - для соревнований: contest_prep блок (перед шоу) вместо peak+competition
 *   - мульти-соревнования: A → полный prep-блок, B → короткий, C → встроено
 *
 * @param input - параметры макроцикла (уровень, соревнования, focus, длительность)
 */
export function buildBbMacrocycle(input: BbMacroInput): BBMacrocycle {
  const total = Math.max(12, Math.min(104, input.totalWeeks || 52));
  const focus = input.trainingFocus ?? 'hypertrophy';
  const events = input.competitions ?? [];
  const blocks: BBMacroBlock[] = [];
  const rationale: string[] = [];

  // Валидация событий
  const eventIds = new Set<string>();
  for (const event of events) {
    if (!event || !event.id || !event.name || !Number.isFinite(event.week) ||
        !Number.isInteger(event.week) || event.week < 1 || event.week > total ||
        !['A', 'B', 'C'].includes(event.priority) ||
        (event.date != null && !isValidCompetitionDate(event.date))) {
      throw new Error('Некорректное соревнование в BB-макроцикле');
    }
    if (eventIds.has(event.id)) {
      throw new Error(`Дублирующийся ID соревнования: ${event.id}`);
    }
    eventIds.add(event.id);
  }

  const sorted = [...events].sort((a, b) => {
    if (a.week !== b.week) return a.week - b.week;
    const pr = { A: 0, B: 1, C: 2 };
    return pr[a.priority] - pr[b.priority];
  });

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].week === sorted[i - 1].week) {
      throw new Error(`Соревнования не могут проходить на одной неделе (${sorted[i].week})`);
    }
  }

  let cursor = 1;

  if (events.length === 0) {
    // Режим без соревнований: простое распределение 4 фаз
    for (const phase of BB_PHASE_ORDER) {
      const weeks = Math.max(2, Math.round(total * BB_DISTRIBUTION[phase]));
      pushPhase(phase, weeks);
    }
    normalizeToTotal(total);
    return buildResult();
  }

  // Режим с соревнованиями
  // 1. Начало: hypertrophy до первого peak-старта
  const firstComp = sorted[0];
  // prepWeeks здесь означает недели до show-week; сама show-week добавляется ниже.
  const firstPrepWeeks = firstComp.priority === 'A' ? 11 : firstComp.priority === 'B' ? 5 : 0;
  const prepStart = firstComp.week - firstPrepWeeks;
  const gapBefore = prepStart - cursor;

  if (gapBefore >= 8) {
    const hypWeeks = Math.max(2, Math.round(gapBefore * 0.6));
    const strWeeks = Math.max(2, gapBefore - hypWeeks);
    pushPhase('hypertrophy', hypWeeks);
    pushPhase('strength', strWeeks);
  } else if (gapBefore >= 4) {
    pushPhase('hypertrophy', gapBefore);
  } else if (gapBefore > 0) {
    pushPhase('hypertrophy', gapBefore);
  }

  // 2. По каждому соревнованию
  for (let i = 0; i < sorted.length; i++) {
    const comp = sorted[i];
    const isLast = i === sorted.length - 1;
    const isMain = comp.priority === 'A';
    const isControl = comp.priority === 'B';

    if (comp.priority === 'C') {
      rationale.push(`🏁 «${comp.name}» (C, нед ${comp.week}): тренировочное, встроено в подготовку.`);
      continue;
    }

    // Contest-prep включает show-week, поэтому до неё резервируем 11/5 недель.
    const prepWeeks = isMain ? 11 : isControl ? 5 : 5;
    if (cursor > comp.week) {
      throw new Error(`Недостаточно места до соревнования «${comp.name}» (неделя ${comp.week})`);
    }
    // prepWeeks includes the competition week itself. Keep the block bounded by
    // its requested window even when an earlier block ends immediately before it.
    const start = comp.week - prepWeeks + 1;
    const effStart = Math.max(cursor, start);
    // Включаем неделю соревнования в contest-prep: отдельной BB-фазы
    // competition нет, поэтому show-week должна оставаться в этом блоке.
    const effWeeks = Math.min(prepWeeks, Math.max(1, comp.week - effStart + 1));

    // Gap перед prep: strength (если достаточно места)
    if (effStart > cursor) {
      const gap = effStart - cursor;
      if (gap >= 4) {
        pushPhase('strength', gap);
      } else {
        pushPhase('hypertrophy', gap);
      }
    }

    // Contest prep блок
    if (effWeeks > 0) {
      const focusForPrep: BBTrainingFocus = isMain ? 'endurance' : 'hypertrophy';
      pushPhase('contest_prep', effWeeks, comp.id, focusForPrep);
    }
    rationale.push(`🏁 «${comp.name}» (${comp.priority}, нед ${comp.week}): prep ${effWeeks} нед.`);

    // Main competition gets transition после
    if (isMain && !isLast) {
      const next = sorted[i + 1];
      const gapAfter = next.week - (comp.week + 1);
      if (gapAfter >= 4) {
        pushPhase('transition', Math.min(4, Math.round(gapAfter * 0.5)));
      }
    }
  }

  // 3. Хвост: transition → finish
  if (cursor <= total) {
    const tail = total - cursor + 1;
    if (tail >= 6) {
      pushPhase('transition', Math.max(2, Math.round(tail * 0.4)));
      pushPhase('hypertrophy', tail - Math.round(tail * 0.4));
    } else {
      pushPhase('transition', tail);
    }
  }

  // Trim overflow
  normalizeToTotal(total);

  return buildResult();

  // ─── Внутренние функции ─────────────────────────────────────

  function pushPhase(phase: BBMacroPhase, weeks: number, competitionId?: string, tFocus?: BBTrainingFocus): void {
    if (weeks <= 0) return;
    const desc = competitionId
      ? `Подготовка к «${sorted.find(c => c.id === competitionId)?.name ?? competitionId}»`
      : `BB-мезоцикл (${BB_PHASE_LABEL_RU[phase]})`;
    blocks.push({
      phase,
      weeks,
      weekOffset: cursor,
      description: desc,
      competitionId,
      trainingFocus: tFocus ?? BB_PHASE_FOCUS[phase],
    });
    rationale.push(`${BB_PHASE_LABEL_RU[phase]}: ${weeks} нед (с ${cursor})${competitionId ? ' [🏁 ' + competitionId + ']' : ''}`);
    cursor += weeks;
  }

  function normalizeToTotal(target: number): void {
    while (blocks.length > 0 && blocks[blocks.length - 1].weekOffset + blocks[blocks.length - 1].weeks - 1 > target) {
      const last = blocks[blocks.length - 1];
      const overflow = last.weekOffset + last.weeks - 1 - target;
      if (last.weeks > overflow) {
        last.weeks -= overflow;
      } else {
        blocks.pop();
      }
    }
    // Adjust offsets
    let off = 1;
    for (const b of blocks) {
      b.weekOffset = off;
      off += b.weeks;
    }
  }

  function buildResult(): BBMacrocycle {
    return {
      blocks,
      totalWeeks: total,
      competitions: sorted,
      trainingFocus: focus,
      rationale,
    };
  }
}

/**
 * Найти активный блок BB-макроцикла на неделе N (1-индекс).
 */
export function bbMacroToActiveBlock(macro: BBMacrocycle, weekNumber: number): BBMacroBlock | null {
  if (macro.blocks.length === 0) return null;
  for (const block of macro.blocks) {
    if (weekNumber >= block.weekOffset && weekNumber < block.weekOffset + block.weeks) {
      return block;
    }
  }
  return macro.blocks[macro.blocks.length - 1] ?? null;
}

/**
 * Определить training focus для заданной недели BB-макроцикла.
 */
export function bbTrainingFocusForWeek(macro: BBMacrocycle, weekNumber: number): BBTrainingFocus {
  const block = bbMacroToActiveBlock(macro, weekNumber);
  return block?.trainingFocus ?? macro.trainingFocus;
}

/** Перебалансировать длительность BB-фаз, не меняя порядок блоков. */
export function rebalanceBbMacrocycle(
  macro: BBMacrocycle,
  edits: Partial<Record<BBMacroPhase, number>>,
): BBMacrocycle {
  const targetByPhase = new Map<BBMacroPhase, number>();
  for (const phase of BB_PHASES) {
    const current = macro.blocks
      .filter(block => block.phase === phase)
      .reduce((sum, block) => sum + block.weeks, 0);
    if (current > 0 || edits[phase] != null) {
      targetByPhase.set(phase, Math.max(1, Math.round(edits[phase] ?? current)));
    }
  }

  const allocatedByPhase = new Map<BBMacroPhase, number>();
  const blocks = macro.blocks.map((block, index) => {
    const target = targetByPhase.get(block.phase) ?? block.weeks;
    const siblings = macro.blocks.filter(candidate => candidate.phase === block.phase);
    const siblingIndex = siblings.indexOf(block);
    const original = siblings.reduce((sum, candidate) => sum + candidate.weeks, 0);
    const allocated = allocatedByPhase.get(block.phase) ?? 0;
    const weeks = siblingIndex === siblings.length - 1
      ? Math.max(1, target - allocated)
      : Math.max(1, Math.floor(target * block.weeks / Math.max(1, original)));
    allocatedByPhase.set(block.phase, allocated + weeks);
    return { ...block, weeks };
  });

  let difference = macro.totalWeeks - blocks.reduce((sum, block) => sum + block.weeks, 0);
  for (let i = blocks.length - 1; i >= 0 && difference < 0; i--) {
    const reduction = Math.min(blocks[i].weeks - 1, -difference);
    blocks[i].weeks -= reduction;
    difference += reduction;
  }
  if (difference > 0 && blocks.length > 0) blocks[blocks.length - 1].weeks += difference;

  let offset = 1;
  const rebasedBlocks = blocks.map(block => {
    const rebased = { ...block, weekOffset: offset };
    offset += rebased.weeks;
    return rebased;
  });
  const competitions = macro.competitions?.map(competition => {
    const block = rebasedBlocks.find(candidate => candidate.competitionId === competition.id);
    return block ? { ...competition, week: block.weekOffset + block.weeks - 1 } : competition;
  });

  return {
    ...macro,
    blocks: rebasedBlocks,
    competitions,
    rationale: rebasedBlocks.map(block => `${block.phase}: ${block.weeks} нед (с ${block.weekOffset})`),
  };
}

/**
 * Сериализация BB-макроцикла для localStorage.
 * Формат: v7 (null для блоков BB+PL, т.к. у BB отсутствуют cycleId/kind).
 */
export function serializeBbMacro(macro: BBMacrocycle): string {
  return JSON.stringify({
    v: 7,
    t: macro.totalWeeks,
    b: macro.blocks.map(b => [b.phase, b.weeks, b.weekOffset, b.description, b.competitionId ?? null, b.trainingFocus ?? null]),
    e: macro.competitions ? macro.competitions.map(c => [
      c.id, c.name, c.week, c.date ?? null, c.priority, c.notes ?? null,
      c.cycleId ?? null, c.cycleIds ?? null,
    ]) : null,
    f: macro.trainingFocus,
    r: macro.rationale,
  });
}

/**
 * Десериализация BB-макроцикла из localStorage.
 */
export function deserializeBbMacro(s: string): BBMacrocycle | null {
  try {
    const o = JSON.parse(s);
    if (!o || !Array.isArray(o.b) || o.v !== 7) return null;
    const validPhases: BBMacroPhase[] = ['hypertrophy', 'strength', 'contest_prep', 'transition'];
    const blocks: BBMacroBlock[] = o.b.map((b: unknown) => {
      if (!Array.isArray(b) || !validPhases.includes(b[0]) || !Number.isInteger(b[1]) || b[1] <= 0 || !Number.isInteger(b[2]) || b[2] < 1) {
        throw new Error('invalid bb macro block');
      }
      if (b[3] != null && typeof b[3] !== 'string') throw new Error('invalid bb macro description');
      if (b[4] != null && typeof b[4] !== 'string') throw new Error('invalid bb macro competitionId');
      const trainingFocus = b[5];
      if (trainingFocus != null && !['hypertrophy', 'strength', 'endurance'].includes(trainingFocus)) {
        throw new Error('invalid bb training focus');
      }
      return {
        phase: b[0] as BBMacroPhase,
        weeks: b[1],
        weekOffset: b[2],
        description: (b[3] as string) ?? '',
        competitionId: (b[4] as string) ?? undefined,
        trainingFocus: (trainingFocus as BBTrainingFocus) ?? undefined,
      };
    });
    if (!Number.isFinite(o.t) || o.t < 1 || o.t > 104 || blocks.length === 0) return null;
    let expectedOffset = 1;
    for (const block of blocks) {
      if (block.weekOffset !== expectedOffset) return null;
      expectedOffset += block.weeks;
    }
    if (expectedOffset - 1 !== o.t) return null;

    let competitions: CompetitionEvent[] | undefined;
    if (Array.isArray(o.e)) {
      competitions = o.e.map((ev: unknown, index: number) => {
        if (Array.isArray(ev)) {
          const priority = ev[4] ?? 'B';
          if (!['A', 'B', 'C'].includes(priority) || !Number.isInteger(ev[2]) || ev[2] < 1 || ev[2] > o.t) throw new Error('invalid competition');
          if (ev[0] != null && typeof ev[0] !== 'string') throw new Error('invalid competition id');
          if (ev[1] != null && typeof ev[1] !== 'string') throw new Error('invalid competition name');
          if (ev[3] != null && !isValidCompetitionDate(ev[3])) throw new Error('invalid competition date');
          if (ev[5] != null && typeof ev[5] !== 'string') throw new Error('invalid competition notes');
          return {
            id: (ev[0] as string) ?? `comp_${index + 1}`,
            name: (ev[1] as string) ?? '',
            week: ev[2] as number,
            date: (ev[3] as string) ?? undefined,
            priority: priority as CompetitionEvent['priority'],
            notes: (ev[5] as string) ?? undefined,
            cycleId: (ev[6] as string) ?? undefined,
            cycleIds: Array.isArray(ev[7]) ? ev[7] : undefined,
          };
        }
        return null;
      }).filter(Boolean) as CompetitionEvent[];
      const competitionIds = new Set<string>();
      const competitionWeeks = new Set<number>();
      for (const competition of competitions) {
        if (competitionIds.has(competition.id)) throw new Error('duplicate competition id');
        if (competitionWeeks.has(competition.week)) throw new Error('duplicate competition week');
        competitionIds.add(competition.id);
        competitionWeeks.add(competition.week);
      }
      for (const block of blocks) {
        if (block.competitionId && !competitionIds.has(block.competitionId)) {
          throw new Error('orphan bb competition block');
        }
      }
    } else if (blocks.some(block => Boolean(block.competitionId))) {
      throw new Error('bb competition blocks require competition list');
    }

    const tFocus = o.f;
    if (tFocus && !['hypertrophy', 'strength', 'endurance'].includes(tFocus)) return null;

    return {
      blocks,
      totalWeeks: o.t,
      competitions,
      trainingFocus: (tFocus as BBTrainingFocus) ?? 'hypertrophy',
      rationale: Array.isArray(o.r) ? o.r : [],
    };
  } catch { return null; }
}

export { PHASE_COLOR, PHASE_LABEL_RU, BB_PHASE_COLOR, BB_PHASE_LABEL_RU, BB_PHASE_ICON };
