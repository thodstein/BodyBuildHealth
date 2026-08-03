/**
 * macrocycle-to-bb.ts - конвертация макроцикла ПЛ-авто (Macrocycle) → UserProgram (ББ).
 *
 * Macrocycle (5 фаз: endurance→strength→peak→competition→transition) - годовой план
 * ПЛ-авто. Для ручного планировщика ББ нужна UserProgram с weeks[] и канонической
 * Phase (4 значения). Стратегия:
 *
 *  1. autodraftBBPlan ОДИН раз на totalWeeks → BBPlan с прогрессией по всем неделям.
 *  2. createFromBuild → UserProgram с weeks[] (упражнения/блоки/сеты).
 *  3. Переразметить weeks[i].phase через macrocycleToActiveCycle + macroPhaseToUserPhase.
 *  4. Для всех фаз макроцикла корректировать объём/RIR (Bosquet 2005 / Helms 2022).
 *
 * Не вызываем buildBBPlan для каждой фазы - получили бы 5 разрывных планов с разными
 * сплитами. Один непрерывный план + переразметка фаз + phase-specific volume - корректнее.
 */
import type { Macrocycle, MacroBlock, MacroPhase } from './macrocycle.engine';
import { macrocycleToActiveCycle, bbMacroToActiveBlock, BBMacroPhase, BBMacrocycle } from './macrocycle.engine';
import { newId } from '../user-program/user-program.types';
import type { UserProgram, UserWeek, UserSet, Phase } from '../user-program/user-program.types';
import { macroPhaseToUserPhase, isDeloadLikeMacroPhase, bbMacroPhaseToUserPhase, isDeloadLikeBbMacroPhase } from '../periodization/phase-bridge';
import { autodraftBBPlan } from '../manual-constructor/manual-draft.engine';
import { createFromBuild } from '../user-program/program-store';
import type { BBTrainingFocus } from '../bb/bb-goal-types';

export interface MacrocycleToBBOptions {
  level: string;
  goal: string;
  daysPerWeek: number;
  weakPoints?: string[];
  equipment?: string[];
  title?: string;
  trainingFocus?: BBTrainingFocus;
  bodyFat?: number;
  leanMass?: number;
  hrvMs?: number;
  sleepHours?: number;
  stressLevel?: number;
  labMrvMultiplier?: number;
  injuries?: any[];
  avoidAxialLoad?: boolean;
  excludedExercises?: string[];
  favoriteExercises?: string[];
}

/** Структурированная разгрузка каждые 4 недели внутри базовых фаз. */
export function shouldPeriodicDeload(phase: string, weekNumber: number, weekOffset: number): boolean {
  if (phase !== 'hypertrophy' && phase !== 'strength' && phase !== 'endurance') return false;
  return (weekNumber - weekOffset + 1) % 4 === 0;
}

// ─── BB-макроцикл: volume multipliers и RIR ─────────────────────────────────

/**
 * Phase-specific volume multipliers for BB year plan (Helms 2022, Bompa 2009).
 * compound = compound exercises, accessory = assistance/finisher.
 */
const BB_PHASE_VOLUME_MULT: Record<BBMacroPhase, { compound: number; accessory: number }> = {
  hypertrophy:   { compound: 1.0,  accessory: 1.0 },
  strength:      { compound: 0.85, accessory: 0.8 },
  contest_prep:  { compound: 0.5,  accessory: 0.3 },
  transition:    { compound: 0.5,  accessory: 0.3 },  // transition normal=0.5, deload=0.5*0.75=0.375
};

/**
 * Target RIR ranges per macro phase.
 * compound = compounds (squat, bench, deadlift, OHP), accessory = others.
 * Format: [minRIR, maxRIR] - sets get adjusted to fall within this range.
 */
const BB_PHASE_RIR: Record<BBMacroPhase, { compound: [number, number]; accessory: [number, number] }> = {
  hypertrophy:  { compound: [2, 3], accessory: [3, 4] },
  strength:     { compound: [1, 2], accessory: [2, 3] },
  contest_prep: { compound: [0, 1], accessory: [1, 2] },
  transition:   { compound: [3, 4], accessory: [4, 5] },
};

/** Volume multiplier for a specific phase and block type. */
function bbVolumeMultiplierFor(phase: BBMacroPhase, isCompound: boolean): number {
  const m = BB_PHASE_VOLUME_MULT[phase];
  return isCompound ? m.compound : m.accessory;
}

/**
 * Target RIR range for a given phase and block type.
 */
function bbTargetRirRange(phase: BBMacroPhase, isCompound: boolean): [number, number] {
  const r = BB_PHASE_RIR[phase];
  return isCompound ? r.compound : r.accessory;
}

/**
 * Сопоставить фазу MacroPhase → BBMacroPhase (для PL-макроциклов).
 * Используется при конвертации PL-макроцикла → BB-план.
 */
const MACRO_PHASE_TO_BB: Record<MacroPhase, BBMacroPhase> = {
  endurance: 'hypertrophy',
  strength: 'strength',
  peak: 'contest_prep',
  competition: 'contest_prep',
  transition: 'transition',
};

/**
 * Конвертировать MacroPhase → BBMacroPhase.
 * Позволяет использовать единый BB_PHASE_VOLUME_MULT для обоих путей.
 */
function macroPhaseToBbPhase(mp: MacroPhase): BBMacroPhase {
  return MACRO_PHASE_TO_BB[mp];
}

/**
 * Конвертировать макроцикл → UserProgram (ББ).
 * Поддерживает и Macrocycle (PL, 5 фаз), и BBMacrocycle (BB, 4 фазы).
 * Возвращает UserProgram с direction='bb' и заполненными weeks (упражнения/фазы).
 */
export function macrocycleToBBProgram(
  macro: Macrocycle | BBMacrocycle,
  opts: MacrocycleToBBOptions,
): UserProgram {
  const total = Math.max(1, macro.totalWeeks || 1);
  const isBbMacro = 'trainingFocus' in macro;
  const effectiveOpts = isBbMacro
    ? { ...opts, trainingFocus: (macro as BBMacrocycle).trainingFocus }
    : opts;
  // 1. Попытаться собрать ББ-план с упражнениями.
  let baseProgram: UserProgram | null = null;
  try {
    baseProgram = buildBaseBBProgram(total, effectiveOpts);
  } catch {
    baseProgram = null;
  }

  // 2. Если сборка удалась - переразметить фазы недель из макроцикла.
  let weeks: UserWeek[];
  let meta: UserProgram['meta'];
  if (baseProgram && baseProgram.bb && baseProgram.bb.weeks.length > 0) {
    weeks = isBbMacro
      ? remapWeeksFromBbMacrocycle(baseProgram.bb.weeks, macro as BBMacrocycle)
      : remapWeeksFromMacrocycle(baseProgram.bb.weeks, macro as Macrocycle);
    meta = baseProgram.meta;
  } else {
    // Fallback: скелет с пустыми sessions + переразмеченные фазы.
    weeks = skeletonWeeksFromBbMacrocycle(macro as any, opts.daysPerWeek);
    meta = makeMeta(opts, total);
  }

  // 3. Заголовок
  const title = opts.title ?? `Годовой план ББ (${total} нед)`;
  meta = {
    ...meta,
    title,
    weeks: total,
    ...(effectiveOpts.trainingFocus ? { trainingFocus: effectiveOpts.trainingFocus } : {}),
  };

  return {
    meta,
    bb: {
      direction: 'bb',
      microcycleTemplate: baseProgram?.bb?.microcycleTemplate ?? { daySlots: [] },
      weeks,
      volumeBudget: baseProgram?.bb?.volumeBudget ?? {},
      progression: baseProgram?.bb?.progression ?? {
        loadStrategy: 'double_progression',
        deloadProtocol: 'pump',
        intensityTechniques: ['none'],
      },
      constraints: baseProgram?.bb?.constraints ?? { equipment: opts.equipment ?? [] },
    },
  };
}

/**
 * Собрать базовый ББ-план через autodraftBBPlan → createFromBuild.
 * Возвращает UserProgram или бросает при ошибке сборки.
 */
function buildBaseBBProgram(total: number, opts: MacrocycleToBBOptions): UserProgram {
  const bbPlan = autodraftBBPlan({
    level: opts.level,
    goal: opts.goal,
    daysPerWeek: opts.daysPerWeek,
    weeks: Math.min(total, 16), // bb-builder ограничивает 16 неделями
    equipment: opts.equipment ?? [],
    weakPoints: opts.weakPoints ?? [],
    trainingFocus: opts.trainingFocus,
    bodyFat: opts.bodyFat,
    leanMass: opts.leanMass,
    hrvMs: opts.hrvMs,
    sleepHours: opts.sleepHours,
    stressLevel: opts.stressLevel,
    labMrvMultiplier: opts.labMrvMultiplier,
    injuries: opts.injuries,
    avoidAxialLoad: opts.avoidAxialLoad,
    excludedExercises: opts.excludedExercises,
    favoriteExercises: opts.favoriteExercises,
  });
  const userProg = createFromBuild(bbPlan, {
    goal: opts.goal,
    level: opts.level,
    equipment: opts.equipment,
    title: `Годовой план ББ (${total} нед)`,
  });
  // Зациклить план на total недель (bb-plan ≤ 16, макроцикл может быть 52).
  if (userProg.bb && userProg.bb.weeks.length < total) {
    const srcWeeks = userProg.bb.weeks;
    const fullWeeks: UserWeek[] = [];
    for (let w = 1; w <= total; w++) {
      const src = srcWeeks[(w - 1) % srcWeeks.length];
      // The BB builder is capped at 16 weeks. Continue the underlying
      // progression between repeated blocks instead of copying identical loads.
      const blockIndex = Math.floor((w - 1) / srcWeeks.length);
      const progressionFactor = Math.pow(1.005, blockIndex * srcWeeks.length);
      fullWeeks.push(cloneWeekWithFreshIds(src, w, progressionFactor));
    }
    userProg.bb.weeks = fullWeeks;
  }
  return userProg;
}

/**
 * Переразметить phase/deload недель UserProgram из BB-макроцикла.
 * Сохраняет все упражнения/блоки/сеты. Применяет phase-specific volume/RIR
 * для каждой фазы BB-макроцикла (Helms 2022, Bompa 2009, NSCA 2021).
 */
function remapWeeksFromBbMacrocycle(weeks: UserWeek[], macro: BBMacrocycle): UserWeek[] {
  return weeks.map(w => {
    const active = bbMacroToActiveBlock(macro, w.week);
    if (!active) return w;
    const phase = bbMacroPhaseToUserPhase(active.phase);
    const deload = isDeloadLikeBbMacroPhase(active.phase);
    const periodicDeload = !deload && shouldPeriodicDeload(active.phase, w.week, active.weekOffset);
    const adjustedSessions = w.sessions
      .map(s => adjustBbSessionForPhase(s, active.phase, phase, deload || periodicDeload))
      .filter((s): s is UserWeek['sessions'][number] => s !== null);
    return { ...w, phase, deload: deload || periodicDeload, sessions: adjustedSessions };
  });
}

/**
 * Переразметить phase/deload недель UserProgram из PL-макроцикла (Macrocycle).
 * Использует MACRO_PHASE_TO_BB для маппинга фаз в BB-фазы.
 */
function remapWeeksFromMacrocycle(weeks: UserWeek[], macro: Macrocycle): UserWeek[] {
  return weeks.map(w => {
    const active = macrocycleToActiveCycle(macro, w.week);
    const block: MacroBlock | undefined = active?.block;
    if (!block) return w;
    const bbPhase = macroPhaseToBbPhase(block.phase);
    const phase = bbMacroPhaseToUserPhase(bbPhase);
    const deload = isDeloadLikeMacroPhase(block.phase);
    const periodicDeload = !deload && shouldPeriodicDeload(block.phase, w.week, block.weekOffset);
    const adjustedSessions = w.sessions
      .map(s => adjustBbSessionForPhase(s, bbPhase, phase, deload || periodicDeload, block.phase))
      .filter((s): s is UserWeek['sessions'][number] => s !== null);
    return { ...w, phase, deload: deload || periodicDeload, sessions: adjustedSessions };
  });
}

/** Clone a generated week without sharing editor identities across weeks. */
function cloneWeekWithFreshIds(source: UserWeek, week: number, weightFactor = 1): UserWeek {
  return {
    ...source,
    week,
    sessions: source.sessions.map(session => ({
      ...session,
      id: newId('ses'),
      blocks: session.blocks.map(block => ({
        ...block,
        id: newId('blk'),
        sets: block.sets.map(set => ({
          ...set,
          weight: typeof set.weight === 'number'
            ? Math.round(set.weight * weightFactor * 10) / 10
            : set.weight,
        })),
      })),
    })),
  };
}

/**
 * Скорректировать объём и RIR сетов для BB-фазы макроцикла.
 * Использует единую логику для BB и PL макроциклов через BBMacroPhase.
 *
 * Каждая фаза BB-макроцикла:
 * - hypertrophy: объём ×1.0, RIR 2-3 (Schoenfeld 2016)
 * - strength: объём ×0.85, RIR 1-2 (Helms 2022)
 * - contest_prep: compounds ×0.5 RIR 0-1, accessory ×0.3 RIR 1-2 (Bompa 2009)
 * - transition/deload: compounds ×0.4 RIR 3-4, accessory ×0.3 RIR 4-5 (NSCA 2021)
 *
 * @param origMacroPhase - оригинальная MacroPhase для различения peak vs competition.
 *   peak (contest_prep в BB) сохраняет accessory с пониженным объёмом.
 *   competition (contest_prep в BB) удаляет accessory (только сорев. движения).
 */
function adjustBbSessionForPhase(
  session: UserWeek['sessions'][number],
  bbMacroPhase: BBMacroPhase,
  phase: Phase,
  deload: boolean,
  origMacroPhase?: MacroPhase,
): UserWeek['sessions'][number] | null {
  const adjustedBlocks = session.blocks.map(b => {
    const isCompound = b.type === 'compound';
    const volMult = bbVolumeMultiplierFor(bbMacroPhase, isCompound);
    const [targetMin, targetMax] = bbTargetRirRange(bbMacroPhase, isCompound);
    // Additional deload/peaking multiplier on top of phase volume
    const phaseMult = deload ? 0.75 : phase === 'peaking' ? 0.75 : 1.0;
    const volumeMult = volMult * phaseMult;

    // Contest prep: remove accessory blocks ONLY for competition (not peak).
    // Peak keeps accessory with reduced volume for taper.
    if (bbMacroPhase === 'contest_prep' && !isCompound && origMacroPhase === 'competition') {
      return null;
    }

    if (deload) {
      // Deload (Helms, NSCA): RIR +3, volume scaled by phase
      const targetRir = Math.min(5, Math.max(targetMax, (b.sets[0]?.rir ?? 2) + 3));
      const sets = b.sets.map((s: UserSet) => ({ ...s, rir: Math.min(5, (s.rir ?? 2) + 3) }));
      const cutSets = sets
        .map((s, i) => i < Math.max(1, Math.ceil(sets.length * volumeMult)) ? s : null)
        .filter((s): s is UserSet => s !== null);
      return { ...b, sets: cutSets.length > 0 ? cutSets : sets };
    }

    if (phase === 'peaking') {
      // Peaking: compounds RIR targetMin-targetMax (Bosquet 2005), accessory controlled
      const sets = b.sets.map((s: UserSet) => ({
        ...s,
        rir: isCompound
          ? Math.max(targetMin, Math.min(targetMax, s.rir ?? targetMin))
          : Math.max(targetMin, Math.min(targetMax, (s.rir ?? targetMin) + 1)),
      }));
      const cutSets = sets
        .map((s, i) => i < Math.max(1, Math.ceil(sets.length * volumeMult)) ? s : null)
        .filter((s): s is UserSet => s !== null);
      return { ...b, sets: cutSets.length > 0 ? cutSets : sets };
    }

    // All other phases: apply volume multiplier + target RIR
    const sets = b.sets.map((s: UserSet) => ({
      ...s,
      rir: Math.max(targetMin, Math.min(targetMax, s.rir ?? targetMin)),
    }));
    if (volumeMult < 1) {
      const cutSets = sets
        .map((s: UserSet, i: number) => i < Math.max(1, Math.ceil(b.sets.length * volumeMult)) ? s : null)
        .filter((s): s is UserSet => s !== null);
      return { ...b, sets: cutSets.length > 0 ? cutSets : sets };
    }
    return { ...b, sets };
  }).filter((b): b is NonNullable<typeof b> => b !== null);
  return adjustedBlocks.length > 0 ? { ...session, blocks: adjustedBlocks } : null;
}

/**
 * Скелет недель с пустыми sessions (fallback при ошибке сборки).
 * Работает и с BBMacrocycle, и с Macrocycle.
 */
function skeletonWeeksFromBbMacrocycle(macro: BBMacrocycle, daysPerWeek: number): UserWeek[];
function skeletonWeeksFromBbMacrocycle(macro: Macrocycle, daysPerWeek: number): UserWeek[];
function skeletonWeeksFromBbMacrocycle(macro: BBMacrocycle | Macrocycle, daysPerWeek: number): UserWeek[] {
  const total = macro.totalWeeks;
  const weeks: UserWeek[] = [];
  for (let w = 1; w <= total; w++) {
    let phase: Phase = 'accumulation';
    let deload = false;

    if ('blocks' in macro && 'totalWeeks' in macro && 'competitions' in macro && 'trainingFocus' in macro) {
      // BBMacrocycle (4 фазы)
      const block = bbMacroToActiveBlock(macro as BBMacrocycle, w);
      if (block) {
        phase = bbMacroPhaseToUserPhase(block.phase);
        deload = isDeloadLikeBbMacroPhase(block.phase);
      }
    } else {
      // Macrocycle (5 фаз, PL)
      const active = macrocycleToActiveCycle(macro as Macrocycle, w);
      const block = active?.block;
      if (block) {
        phase = macroPhaseToUserPhase(block.phase);
        deload = isDeloadLikeMacroPhase(block.phase);
      }
    }

    weeks.push({
      week: w,
      phase,
      deload,
      sessions: [],
    });
  }
  return weeks;
}

/** Создать базовую meta для fallback-скелета. */
function makeMeta(opts: MacrocycleToBBOptions, totalWeeks: number): UserProgram['meta'] {
  const now = new Date().toISOString();
  return {
    id: 'macro_' + Date.now().toString(36),
    title: `Годовой план ББ (${totalWeeks} нед)`,
    author: 'macrocycle-to-bb',
    goal: opts.goal || 'hypertrophy',
    level: opts.level || 'intermediate',
    daysPerWeek: opts.daysPerWeek,
    weeks: totalWeeks,
    direction: 'bb',
    createdAt: now,
    updatedAt: now,
    source: 'from_build',
    tags: ['from_build', 'macrocycle'],
  };
}
