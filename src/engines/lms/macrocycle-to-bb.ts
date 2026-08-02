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
import { macrocycleToActiveCycle } from './macrocycle.engine';
import { newId } from '../user-program/user-program.types';
import type { UserProgram, UserWeek, UserSet, Phase } from '../user-program/user-program.types';
import { macroPhaseToUserPhase, isDeloadLikeMacroPhase } from '../periodization/phase-bridge';
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

/**
 * Phase-specific volume multipliers for BB year plan (Helms 2022, Bompa 2009).
 * When a 16-week BB plan is cycled to fill a longer macrocycle, each macro phase
 * gets different volume/RIR to provide real periodization across the year.
 */
const PHASE_VOLUME_MULT: Record<MacroPhase, { compound: number; accessory: number }> = {
  endurance:   { compound: 1.0,  accessory: 1.0 },
  strength:    { compound: 0.85, accessory: 0.8 },
  peak:        { compound: 0.5,  accessory: 0.3 },
  competition: { compound: 0.3,  accessory: 0.0 },
  transition:  { compound: 0.5,  accessory: 0.4 },
};

/** Volume multiplier for a specific block type within a macro phase. */
function volumeMultiplierFor(phase: MacroPhase, isCompound: boolean): number {
  const m = PHASE_VOLUME_MULT[phase];
  return isCompound ? m.compound : m.accessory;
}

/**
 * Конвертировать макроцикл ПЛ-авто → UserProgram (ББ).
 * Возвращает UserProgram с direction='bb' и заполненными weeks (упражнения/фазы).
 * При ошибке сборки (autodraftBBPlan бросает) - fallback на createBlank-подобный
 * скелет с переразмеченными фазами и пустыми sessions.
 */
export function macrocycleToBBProgram(
  macro: Macrocycle,
  opts: MacrocycleToBBOptions,
): UserProgram {
  const total = Math.max(1, macro.totalWeeks || 1);
  // 1. Попытаться собрать ББ-план с упражнениями.
  let baseProgram: UserProgram | null = null;
  try {
    baseProgram = buildBaseBBProgram(total, opts);
  } catch {
    baseProgram = null;
  }

  // 2. Если сборка удалась - переразметить фазы недель из макроцикла.
  let weeks: UserWeek[];
  let meta: UserProgram['meta'];
  if (baseProgram && baseProgram.bb && baseProgram.bb.weeks.length > 0) {
    weeks = remapWeeksFromMacrocycle(baseProgram.bb.weeks, macro);
    meta = baseProgram.meta;
  } else {
    // Fallback: скелет с пустыми sessions + переразмеченные фазы.
    weeks = skeletonWeeksFromMacrocycle(macro, opts.daysPerWeek);
    meta = makeMeta(opts, total);
  }

  // 3. Заголовок
  const title = opts.title ?? `Годовой план ББ (${total} нед)`;
  meta = { ...meta, title, weeks: total };

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
      fullWeeks.push(cloneWeekWithFreshIds(src, w));
    }
    userProg.bb.weeks = fullWeeks;
  }
  return userProg;
}

/**
 * Переразметить phase/deload недель UserProgram из макроцикла.
 * Сохраняет все упражнения/блоки/сеты. Применяет phase-specific volume/RIR
 * для каждой фазы макроцикла (Helms 2022, Bompa 2009, NSCA 2021).
 */
function remapWeeksFromMacrocycle(weeks: UserWeek[], macro: Macrocycle): UserWeek[] {
  return weeks.map(w => {
    const active = macrocycleToActiveCycle(macro, w.week);
    const block: MacroBlock | undefined = active?.block;
    if (!block) return w;
    const phase = macroPhaseToUserPhase(block.phase);
    const deload = isDeloadLikeMacroPhase(block.phase);
    const periodicDeload = !deload
      && (block.phase === 'endurance' || block.phase === 'strength')
      && ((w.week - block.weekOffset + 1) % 4 === 0);
    // Phase-specific volume and RIR adjustments for ALL macro phases
    const adjustedSessions = w.sessions
      .map(s => adjustSessionForPhase(s, block.phase, phase, deload || periodicDeload))
      .filter((s): s is UserWeek['sessions'][number] => s !== null);
    return { ...w, phase, deload: deload || periodicDeload, sessions: adjustedSessions };
  });
}

/** Clone a generated week without sharing editor identities across weeks. */
function cloneWeekWithFreshIds(source: UserWeek, week: number): UserWeek {
  return {
    ...source,
    week,
    sessions: source.sessions.map(session => ({
      ...session,
      id: newId('ses'),
      blocks: session.blocks.map(block => ({ ...block, id: newId('blk') })),
    })),
  };
}

/**
 * Скорректировать объём и RIR сетов для фазы макроцикла.
 *
 * Каждая фаза имеет свои множители объёма и целевые RIR:
 * - endurance: объём ×1.0, RIR baseline (Schoenfeld 2016)
 * - strength: объём ×0.85, RIR 1-2 (Helms 2022)
 * - peak: compounds ×0.5 RIR 0-1, accessory ×0.3 RIR 2-3 (Bompa 2009)
 * - competition: compounds ×0.3 RIR 0, accessory ×0.0 (только сорев. движения)
 * - transition/deload: compounds ×0.5 RIR +3, accessory ×0.4 (восстановление)
 */
function adjustSessionForPhase(
  session: UserWeek['sessions'][number],
  macroPhase: MacroPhase,
  phase: Phase,
  deload: boolean,
): UserWeek['sessions'][number] | null {
  const adjustedBlocks = session.blocks.map(b => {
    const isCompound = b.type === 'compound';
    const volMult = volumeMultiplierFor(macroPhase, isCompound);
    // Additional deload/peaking multiplier on top of phase volume
    const phaseMult = deload ? 0.75 : phase === 'peaking' ? 0.75 : 1.0;
    const volumeMult = volMult * phaseMult;

    if (macroPhase === 'competition' && !isCompound) {
      return null;
    }

    if (deload) {
      // Deload (Helms, NSCA): RIR +3, volume scaled by phase
      const sets = b.sets.map((s: UserSet) => ({ ...s, rir: Math.min(5, (s.rir ?? 2) + 3) }));
      const cutSets = sets
        .map((s, i) => i < Math.max(1, Math.ceil(sets.length * volumeMult)) ? s : null)
        .filter((s): s is UserSet => s !== null);
      return { ...b, sets: cutSets.length > 0 ? cutSets : sets };
    }

    if (phase === 'peaking') {
      // Peaking: compounds RIR 0-1 (Bosquet 2005), accessory gets controlled RIR
      const sets = b.sets.map((s: UserSet) => ({
        ...s,
        rir: isCompound ? Math.max(0, Math.min(1, s.rir ?? 1)) : Math.min(3, (s.rir ?? 2) + 1),
      }));
      const cutSets = sets
        .map((s, i) => i < Math.max(1, Math.ceil(sets.length * volumeMult)) ? s : null)
        .filter((s): s is UserSet => s !== null);
      return { ...b, sets: cutSets.length > 0 ? cutSets : sets };
    }

    // All other phases: apply volume multiplier
    if (volumeMult < 1) {
      const cutSets = b.sets
        .map((s: UserSet, i: number) => i < Math.max(1, Math.ceil(b.sets.length * volumeMult)) ? s : null)
        .filter((s): s is UserSet => s !== null);
      return { ...b, sets: cutSets.length > 0 ? cutSets : b.sets };
    }
    return b;
  }).filter((b): b is NonNullable<typeof b> => b !== null);
  return adjustedBlocks.length > 0 ? { ...session, blocks: adjustedBlocks } : null;
}

/**
 * Скелет недель с пустыми sessions (fallback при ошибке сборки).
 */
function skeletonWeeksFromMacrocycle(macro: Macrocycle, daysPerWeek: number): UserWeek[] {
  const total = macro.totalWeeks;
  const weeks: UserWeek[] = [];
  const dowPattern = [0, 1, 3, 4, 2, 5, 6];
  for (let w = 1; w <= total; w++) {
    const active = macrocycleToActiveCycle(macro, w);
    const block = active?.block;
    const phase = block ? macroPhaseToUserPhase(block.phase) : 'accumulation' as Phase;
    const deload = block ? isDeloadLikeMacroPhase(block.phase) : false;
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
