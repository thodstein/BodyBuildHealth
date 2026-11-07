/**
 * auto-fill-draft.ts — P0-4: Extracted autoFillDraft into per-direction functions.
 *
 * Each direction (BB/PL/Hybrid) has its own function that can be tested in isolation.
 * The dispatcher reads the direction from the program and calls the appropriate handler.
 */
import type { UserProgram, UserWeek, ProgramProgression } from '../../../engines/user-program/user-program.types';
import { newId } from '../../../engines/user-program/user-program.types';
import { autodraftBBPlan, applyPhaseModulation } from '../../../engines/manual-constructor';
import { autodraftBBPlanAsync } from '../../../engines/bb/bb-build-async';
import { createFromBuild } from '../../../engines/user-program/program-store';
import { LMS_CYCLES } from '../../../data/lms-cycles/lms-cycle-index';
import { rankCycles } from '../../../engines/lms/lms-selector.engine';
import type { TrainingProfile } from './training-profile';

export interface AutoFillCtx {
  program: UserProgram;
  prof: TrainingProfile;
  days: number;
  bodyFat?: number;
  leanMass?: number;
  hrvMs?: number;
  sleepHours?: number;
  stressLevel?: number;
  labMrvMultiplier: number;
  update: (patch: Partial<UserProgram>) => void;
  showToast: (m: string) => void;
}

export interface BBUserProgramOptions {
  title: string;
  goal: string;
  level: string;
  days: number;
  weeks: number;
  prof: TrainingProfile;
  trainingFocus?: import('../../../engines/bb/bb-goal-types').BBTrainingFocus;
  bodyFat?: number;
  leanMass?: number;
  hrvMs?: number;
  sleepHours?: number;
  stressLevel?: number;
  labMrvMultiplier?: number;
}

/** Вход авто-черновика (общий для синхронной и воркерной сборки). */
function bbDraftOptions(options: BBUserProgramOptions) {
  const { goal, level, days, weeks, prof, trainingFocus, bodyFat, leanMass, hrvMs, sleepHours, stressLevel, labMrvMultiplier } = options;
  return {
    level,
    goal,
    daysPerWeek: days,
    weeks,
    equipment: prof.equipment ?? [],
    weakPoints: prof.weakPoints ?? [],
    avoidAxialLoad: prof.avoidAxialLoad ?? false,
    favoriteExercises: prof.favoriteExercises ?? [],
    excludedExercises: prof.excludedExercises ?? [],
    workMax: prof.workMax ?? {},
    onCourse: prof.onCourse ?? false,
    courseIntensity: prof.courseIntensity ?? 'moderate',
    injuries: prof.injuries ?? [],
    trainingFocus,
    bodyFat,
    leanMass,
    hrvMs,
    sleepHours,
    stressLevel,
    labMrvMultiplier,
  } as any;
}

/** Пост-обработка готового BB-плана → UserProgram (одинакова для sync и worker). */
function finishBBUserProgram(bbPlan: any, options: BBUserProgramOptions): UserProgram {
  const { title, goal, level, days, weeks, prof, trainingFocus } = options;
  const userProgram = createFromBuild(bbPlan, {
    title,
    goal,
    level,
    weakPoints: prof.weakPoints ?? [],
    equipment: prof.equipment ?? [],
  });
  userProgram.meta.title = title;
  userProgram.meta.weeks = weeks;
  userProgram.meta.daysPerWeek = days;
  if (trainingFocus) userProgram.meta.trainingFocus = trainingFocus;
  if (userProgram.bb && userProgram.bb.weeks.length >= 4) {
    userProgram.bb.weeks = applyPhaseModulation(userProgram.bb.weeks, {
      goal,
      level,
      weeksTotal: weeks,
    });
  }
  return userProgram;
}

/** Shared BB builder for quick templates and profile-based editor filling. */
export function buildBBUserProgramFromProfile(options: BBUserProgramOptions): UserProgram {
  return finishBBUserProgram(autodraftBBPlan(bbDraftOptions(options)), options);
}

/**
 * То же, но сборка плана (~240 мс) считается в воркере — для КНОПОК, где
 * заморозка интерфейса заметна. Ошибки пробрасываются как раньше.
 */
export async function buildBBUserProgramFromProfileAsync(options: BBUserProgramOptions): Promise<UserProgram> {
  return finishBBUserProgram(await autodraftBBPlanAsync(bbDraftOptions(options)), options);
}

/** Вход авто-черновика ББ из контекста редактора (общий для sync и worker). */
function bbDraftOptionsFromCtx(ctx: AutoFillCtx): BBUserProgramOptions {
  const { program, prof, days, bodyFat, leanMass, hrvMs, sleepHours, stressLevel, labMrvMultiplier } = ctx;
  return {
    title: '[Черновик] ' + (program.meta.title || 'Моя программа'),
    goal: program.meta.goal,
    level: program.meta.level,
    days,
    weeks: Math.max(1, program.meta.weeks || 4),
    prof,
    trainingFocus: program.meta.trainingFocus,
    bodyFat, leanMass, hrvMs, sleepHours, stressLevel, labMrvMultiplier,
  };
}

/** Записать готовый ББ-черновик в программу (общая часть sync/async). */
function applyBBDraft(ctx: AutoFillCtx, userProg: UserProgram): boolean {
  const { prof, update } = ctx;
  if (userProg.bb) {
    userProg.bb.constraints = {
      equipment: (prof.equipment ?? []) as string[],
      avoidAxialLoad: prof.avoidAxialLoad ?? false,
      injuries: (prof.injuries ?? []).map((inj) => ({ muscle: inj.muscle, grade: inj.exclude ? 'excluded' : 'graded' })),
      favoriteExercises: (prof.favoriteExercises ?? []) as string[],
      excludedExercises: (prof.excludedExercises ?? []) as string[],
    };
    userProg.bb.progression = {
      loadStrategy: (prof.loadStrategy ?? 'double_progression') as ProgramProgression['loadStrategy'],
      deloadProtocol: 'pump',
      intensityTechniques: ['none'],
    };
  }
  update({ bb: userProg.bb });
  return true;
}

/** Заготовка, если авто-сборка упала (общая часть sync/async). */
function applyBBFallbackDraft(ctx: AutoFillCtx, err: unknown): boolean {
  const { program, days, update, showToast } = ctx;
  if (!program.bb) return false;
  console.error('autodraftBBPlan failed:', err);
  showToast('⚠ Авто-сборка не удалась: ' + (err as Error)?.message + ' — создана заготовка, заполните вручную');
  const weeks: UserWeek[] = Array.from({ length: Math.max(1, program.meta.weeks || 4) }, (_, wi) => ({
    week: wi + 1, phase: 'accumulation' as const, deload: false,
    sessions: Array.from({ length: days }, (_, si) => ({
      id: newId('ses'), name: 'День ' + (si + 1), focus: '',
      blocks: [
        { id: newId('blk'), type: 'compound' as const, exerciseName: '', muscle: '', role: 'primary' as const,
          sets: [{ reps: 8, rir: 2, weight: 0, restSec: 120 }] },
        { id: newId('blk'), type: 'accessory' as const, exerciseName: '',
          muscle: '', role: 'accessory' as const,
          sets: [{ reps: 12, rir: 2, weight: 0, restSec: 90 }] },
      ],
    })),
  }));
  update({ bb: { ...program.bb, weeks } });
  return false;
}

/** BB direction: autodraftBBPlan + createFromBuild + applyPhaseModulation. */
export function autoFillBBDraft(ctx: AutoFillCtx): boolean {
  if (!ctx.program.bb) return false;
  try {
    return applyBBDraft(ctx, buildBBUserProgramFromProfile(bbDraftOptionsFromCtx(ctx)));
  } catch (err) {
    return applyBBFallbackDraft(ctx, err);
  }
}

/** То же, но сборка плана идёт в воркере (кнопка «автозаполнить» не морозит UI). */
export async function autoFillBBDraftAsync(ctx: AutoFillCtx): Promise<boolean> {
  if (!ctx.program.bb) return false;
  try {
    return applyBBDraft(ctx, await buildBBUserProgramFromProfileAsync(bbDraftOptionsFromCtx(ctx)));
  } catch (err) {
    return applyBBFallbackDraft(ctx, err);
  }
}

/** Map PL manual goal → UserGoal for LMS selector (speed/new). */
function plGoalToUserGoal(goal: string): import('../../../engines/lms/lms-selector.engine').UserGoal {
  const g = (goal||'').toLowerCase();
  if (g === 'pl_endurance' || g === 'endurance') return 'endurance';
  if (g === 'pl_speed' || g === 'speed') return 'speed';
  if (g === 'pl_peaking' || g === 'peaking' || g === 'peak') return 'peak';
  if (g === 'pl_strength' || g === 'strength' || g === 'powerlifting') return 'strength';
  return 'strength';
}

/** PL direction: auto-select LMS cycle by level, days и цели (speed/coordin). */
export function autoFillPLDraft(ctx: AutoFillCtx): boolean {
  const { program, prof, days, update, showToast } = ctx;
  if (!program.pl) return false;
  const sessCount = Math.max(2, Math.min(6, days));
  // rankCycles с учётом цели — speed получит strength/mixed/endurance блок (Verkhoshansky speed block)
  let foundCycle: typeof LMS_CYCLES[0] | undefined;
  try {
    const goal = plGoalToUserGoal(program.meta.goal);
    const ranked = rankCycles({ goal, level: program.meta.level as any, daysPerWeek: sessCount, direction: 'powerlifting', mode: 'natural' });
    foundCycle = ranked[0]?.cycle;
  } catch { /* fallback */ }
  if (!foundCycle) {
    foundCycle = LMS_CYCLES.find(c =>
      c.meta.level === program.meta.level &&
      Math.abs(c.meta.sessionsPerWeek - sessCount) <= 1
    );
  }
  if (!foundCycle) {
    foundCycle = LMS_CYCLES.find(c =>
      Math.abs(c.meta.sessionsPerWeek - sessCount) <= 1
    );
  }
  update({
    pl: {
      ...program.pl,
      sourceCycleId: foundCycle ? foundCycle.meta.id : program.pl.sourceCycleId,
      schedule: Array.from({ length: sessCount }, (_, i) => ({ sessionIdx: i, dayOfWeek: i })),
      workMax: { squat: prof.pmSquat, bench: prof.pmBench, dead: prof.pmDead },
      weakPoints: (prof.weakPoints ?? []) as string[],
      notes: foundCycle
        ? `Цикл: ${foundCycle.meta.title} (${foundCycle.meta.weeks} нед, ${foundCycle.meta.sessionsPerWeek}д/нед). Процентки неизменны — ваш оверлей.`
        : 'Цикл не выбран. Нажмите «🔍 ПЛ-циклы» чтобы подключить.',
    },
  });
  if (foundCycle) showToast('🏆 ПЛ-цикл подобран: ' + foundCycle.meta.title);
  return Boolean(foundCycle);
}

/** Hybrid: ПЛ-цикл из LMS + ББ-недели. Общая запись результата для sync/async. */
function applyHybridDraft(ctx: AutoFillCtx, bbWeeks: UserWeek[], foundCycle: typeof LMS_CYCLES[0] | undefined, bbDays: number): boolean {
  const { program, prof, update, showToast } = ctx;
  if (!program.hybrid) return false;
  update({
    hybrid: {
      ...program.hybrid,
      plRef: { sourceCycleId: foundCycle?.meta.id ?? '', sessionIndices: foundCycle ? Array.from({ length: foundCycle.meta.sessionsPerWeek }, (_, i) => i) : [] },
      bbWeeks,
      workMax: { squat: prof.pmSquat ?? 120, bench: prof.pmBench ?? 100, deadlift: prof.pmDead ?? 140 },
    },
  });
  if (foundCycle) showToast('⚡ Hybrid: ПЛ=' + foundCycle.meta.title + ' + ББ=' + bbDays + 'д/нед');
  return Boolean(foundCycle && bbWeeks.length > 0);
}

/** Hybrid direction: PL from LMS + BB from bb-builder. */
export function autoFillHybridDraft(ctx: AutoFillCtx): boolean {
  const { program, prof, days, bodyFat, leanMass, hrvMs, sleepHours, stressLevel, labMrvMultiplier } = ctx;
  if (!program.hybrid) return false;
  const sessCount = Math.max(2, Math.min(4, days));
  let foundCycle = LMS_CYCLES.find(c => c.meta.level === program.meta.level && Math.abs(c.meta.sessionsPerWeek - sessCount) <= 1);
  if (!foundCycle) foundCycle = LMS_CYCLES.find(c => Math.abs(c.meta.sessionsPerWeek - sessCount) <= 1);
  const bbDays = Math.max(1, days - sessCount);
  // Маппинг ПБ-цели гибрида → ББ-цель для bb-части (powerbuilding blend: Helms/Israetel)
  const hybGoal = (program.meta.goal || '').toLowerCase();
  const bbGoalForHybrid = hybGoal === 'pb_strength' ? 'strength_mass' : hybGoal === 'pb_mass' ? 'hypertrophy' : hybGoal === 'pb_peaking' ? 'strength_mass' : 'hypertrophy';
  let bbWeeks: UserWeek[] = [];
  try {
    const bbUserProg = buildBBUserProgramFromProfile({
      title: 'hybrid-bb', goal: bbGoalForHybrid, level: program.meta.level,
      days: bbDays, weeks: Math.max(1, program.meta.weeks || 4), prof,
      trainingFocus: program.meta.trainingFocus,
      bodyFat, leanMass, hrvMs, sleepHours, stressLevel, labMrvMultiplier,
    });
    bbWeeks = bbUserProg.bb?.weeks ?? [];
  } catch { bbWeeks = []; }
  return applyHybridDraft(ctx, bbWeeks, foundCycle, bbDays);
}

/** То же, но ББ-часть (полная сборка плана) идёт в воркере. */
export async function autoFillHybridDraftAsync(ctx: AutoFillCtx): Promise<boolean> {
  const { program, prof, days, bodyFat, leanMass, hrvMs, sleepHours, stressLevel, labMrvMultiplier } = ctx;
  if (!program.hybrid) return false;
  const sessCount = Math.max(2, Math.min(4, days));
  let foundCycle = LMS_CYCLES.find(c => c.meta.level === program.meta.level && Math.abs(c.meta.sessionsPerWeek - sessCount) <= 1);
  if (!foundCycle) foundCycle = LMS_CYCLES.find(c => Math.abs(c.meta.sessionsPerWeek - sessCount) <= 1);
  const bbDays = Math.max(1, days - sessCount);
  const hybGoal = (program.meta.goal || '').toLowerCase();
  const bbGoalForHybrid = hybGoal === 'pb_strength' ? 'strength_mass' : hybGoal === 'pb_mass' ? 'hypertrophy' : hybGoal === 'pb_peaking' ? 'strength_mass' : 'hypertrophy';
  let bbWeeks: UserWeek[] = [];
  try {
    const bbUserProg = await buildBBUserProgramFromProfileAsync({
      title: 'hybrid-bb', goal: bbGoalForHybrid, level: program.meta.level,
      days: bbDays, weeks: Math.max(1, program.meta.weeks || 4), prof,
      trainingFocus: program.meta.trainingFocus,
      bodyFat, leanMass, hrvMs, sleepHours, stressLevel, labMrvMultiplier,
    });
    bbWeeks = bbUserProg.bb?.weeks ?? [];
  } catch { bbWeeks = []; }
  return applyHybridDraft(ctx, bbWeeks, foundCycle, bbDays);
}

/** Dispatcher: calls the appropriate direction handler based on program.meta.direction. */
export function autoFillDraftDispatch(ctx: AutoFillCtx): void {
  const dir = ctx.program.meta.direction;
  const success = dir === 'bb' ? autoFillBBDraft(ctx)
    : dir === 'pl' ? autoFillPLDraft(ctx)
    : dir === 'hybrid' ? autoFillHybridDraft(ctx)
    : false;
  if (success) ctx.showToast('⚡ Черновик создан из профиля — заполните упражнения и ПМ');
}

/** Как `autoFillDraftDispatch`, но ББ-сборка считается в воркере (без фриза UI). */
export async function autoFillDraftDispatchAsync(ctx: AutoFillCtx): Promise<void> {
  const dir = ctx.program.meta.direction;
  const success = dir === 'bb' ? await autoFillBBDraftAsync(ctx)
    : dir === 'pl' ? autoFillPLDraft(ctx)
    : dir === 'hybrid' ? await autoFillHybridDraftAsync(ctx)
    : false;
  if (success) ctx.showToast('⚡ Черновик создан из профиля — заполните упражнения и ПМ');
}
