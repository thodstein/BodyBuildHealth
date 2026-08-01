/**
 * macrocycle-to-bb.ts — конвертация макроцикла ПЛ-авто (Macrocycle) → UserProgram (ББ).
 *
 * Macrocycle (5 фаз: endurance→strength→peak→competition→transition) — годовой план
 * ПЛ-авто. Для ручного планировщика ББ нужна UserProgram с weeks[] и канонической
 * Phase (4 значения). Стратегия:
 *
 *  1. autodraftBBPlan ОДИН раз на totalWeeks → BBPlan с прогрессией по всем неделям.
 *  2. createFromBuild → UserProgram с weeks[] (упражнения/блоки/сеты).
 *  3. Переразметить weeks[i].phase через macrocycleToActiveCycle + macroPhaseToUserPhase.
 *  4. Для deload/peaking фаз скорректировать объём/RIR (Bosquet 2005 / Helms).
 *
 * Не вызываем buildBBPlan для каждой фазы — получили бы 5 разрывных планов с разными
 * сплитами. Один непрерывный план + переразметка фаз — корректнее.
 */
import type { Macrocycle, MacroBlock } from './macrocycle.engine';
import { macrocycleToActiveCycle } from './macrocycle.engine';
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
 * Конвертировать макроцикл ПЛ-авто → UserProgram (ББ).
 * Возвращает UserProgram с direction='bb' и заполненными weeks (упражнения/фазы).
 * При ошибке сборки (autodraftBBPlan бросает) — fallback на createBlank-подобный
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

  // 2. Если сборка удалась — переразметить фазы недель из макроцикла.
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
      fullWeeks.push({ ...src, week: w });
    }
    userProg.bb.weeks = fullWeeks;
  }
  return userProg;
}

/**
 * Переразметить phase/deload недель UserProgram из макроцикла.
 * Сохраняет все упражнения/блоки/сеты. Для deload/peaking фаз корректирует RIR.
 */
function remapWeeksFromMacrocycle(weeks: UserWeek[], macro: Macrocycle): UserWeek[] {
  return weeks.map(w => {
    const active = macrocycleToActiveCycle(macro, w.week);
    const block: MacroBlock | undefined = active?.block;
    if (!block) return w;
    const phase = macroPhaseToUserPhase(block.phase);
    const deload = isDeloadLikeMacroPhase(block.phase);
    // Корректировка RIR для deload/peaking фаз
    const adjustedSessions = deload || phase === 'peaking'
      ? w.sessions.map(s => adjustSessionRir(s, phase, deload))
      : w.sessions;
    return { ...w, phase, deload, sessions: adjustedSessions };
  });
}

/**
 * Скорректировать RIR сетов в сессии для deload/peaking фазы.
 * deload: RIR +3 (лёгкая неделя, восстановление).
 * peaking: RIR → 0-1 (максимальная интенсивность).
 */
function adjustSessionRir(session: UserWeek['sessions'][number], phase: Phase, deload: boolean): UserWeek['sessions'][number] {
  const adjustedBlocks = session.blocks.map(b => {
    if (deload) {
      // Deload (Helms, NSCA): RIR +3 and volume reduction. Keep at least one
      // set per block; accessory blocks are reduced a little more than compounds.
      const sets = b.sets.map((s: UserSet) => ({ ...s, rir: Math.min(5, (s.rir ?? 2) + 3) }));
      const volumeMultiplier = b.type === 'compound' ? 0.6 : 0.5;
      const cutSets = sets
        .map((s, i) => i < Math.max(1, Math.ceil(sets.length * volumeMultiplier)) ? s : null)
        .filter((s): s is UserSet => s !== null);
      return { ...b, sets: cutSets.length > 0 ? cutSets : sets };
    }
    if (phase === 'peaking') {
      const isCompound = b.type === 'compound';
      const sets = b.sets.map((s: UserSet) => ({
        ...s,
        rir: isCompound ? Math.max(0, Math.min(1, s.rir ?? 1)) : Math.min(5, (s.rir ?? 2) + 1),
      }));
      return { ...b, sets };
    }
    return b;
  });
  return { ...session, blocks: adjustedBlocks };
}

/**
 * Скелет недель с пустыми sessions (fallback при ошибке сборки).
 */
function skeletonWeeksFromMacrocycle(macro: Macrocycle, daysPerWeek: number): UserWeek[] {
  const total = macro.totalWeeks;
  const weeks: UserWeek[] = [];
  // Паттерн дней недели (Пн/Вт/Чт/Пт для 4д)
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
