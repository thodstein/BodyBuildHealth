/**
 * lms-cycle-clone.ts — контракт неизменности реестра СРЦ-циклов.
 *
 * ОРИГИНАЛ ЦИКЛА (LMS_CYCLES) — неприкосновенный канон: он меняется только
 * решением пользователя в приложении (правка исходника), но НЕ кодом сборки.
 * Любые производные (подгонка под окно, растяжение/сжатие, адаптация) обязаны
 * работать на копии — cloneCycleTemplate — и проходить через согласие
 * (needsConsent/applyFitConsent в lms-season.engine).
 */
import type {
  SRCycleTemplate, SRCycleMeta, SRDaySpec, SRExerciseSpec, SRSetSpec, SRPhaseBlock,
} from './lms-types';

function clonePhaseBlock(block: SRPhaseBlock): SRPhaseBlock {
  return {
    ...block,
    rirProgression: block.rirProgression ? { ...block.rirProgression } : undefined,
    repRange: block.repRange ? [block.repRange[0], block.repRange[1]] : undefined,
  };
}

function cloneSet(set: SRSetSpec): SRSetSpec {
  return { ...set };
}

function cloneExercise(exercise: SRExerciseSpec): SRExerciseSpec {
  return { ...exercise, sets: exercise.sets.map(cloneSet) };
}

/** Глубокая копия одного дня раскладки (дни/упражнения/сеты независимы). */
export function cloneCycleDay(day: SRDaySpec): SRDaySpec {
  return { exercises: day.exercises.map(cloneExercise) };
}

function cloneCycleMeta(meta: SRCycleMeta): SRCycleMeta {
  return {
    ...meta,
    conditions: Array.isArray(meta.conditions) ? [...meta.conditions] : [],
    tags: meta.tags ? [...meta.tags] : undefined,
    deloadWeeks: meta.deloadWeeks ? [...meta.deloadWeeks] : undefined,
    rirProgression: meta.rirProgression ? { ...meta.rirProgression } : undefined,
    phases: meta.phases ? meta.phases.map(clonePhaseBlock) : undefined,
    sourcePhases: meta.sourcePhases ? meta.sourcePhases.map(clonePhaseBlock) : undefined,
  };
}

/** Глубокая копия шаблона цикла — единственный легальный способ получить изменяемую версию. */
export function cloneCycleTemplate(template: SRCycleTemplate): SRCycleTemplate {
  return {
    meta: cloneCycleMeta(template.meta),
    week1: template.week1.map(cloneCycleDay),
    weeks: template.weeks ? template.weeks.map(week => week.map(cloneCycleDay)) : undefined,
  };
}

function freezeDay(day: SRDaySpec): void {
  for (const exercise of day.exercises) {
    for (const set of exercise.sets) Object.freeze(set);
    Object.freeze(exercise.sets);
    Object.freeze(exercise);
  }
  Object.freeze(day.exercises);
  Object.freeze(day);
}

function freezePhaseBlock(block: SRPhaseBlock): void {
  if (block.rirProgression) Object.freeze(block.rirProgression);
  if (block.repRange) Object.freeze(block.repRange);
  Object.freeze(block);
}

function freezeMeta(meta: SRCycleMeta): void {
  if (Array.isArray(meta.conditions)) Object.freeze(meta.conditions);
  if (meta.tags) Object.freeze(meta.tags);
  if (meta.deloadWeeks) Object.freeze(meta.deloadWeeks);
  if (meta.rirProgression) Object.freeze(meta.rirProgression);
  meta.phases?.forEach(freezePhaseBlock);
  if (meta.phases) Object.freeze(meta.phases);
  meta.sourcePhases?.forEach(freezePhaseBlock);
  if (meta.sourcePhases) Object.freeze(meta.sourcePhases);
  Object.freeze(meta);
}

/**
 * Глубоко замораживает реестр: любая попытка кода изменить оригинал цикла
 * бросает TypeError (ES-модули — strict mode), а не тихо портит канон.
 */
export function deepFreezeCycleTemplates(cycles: SRCycleTemplate[]): void {
  for (const cycle of cycles) {
    Object.freeze(cycle.week1);
    cycle.week1.forEach(freezeDay);
    cycle.weeks?.forEach(week => week.forEach(freezeDay));
    if (cycle.weeks) cycle.weeks.forEach(Object.freeze);
    if (cycle.weeks) Object.freeze(cycle.weeks);
    freezeMeta(cycle.meta);
    Object.freeze(cycle);
  }
  Object.freeze(cycles);
}
