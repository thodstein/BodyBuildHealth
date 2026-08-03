/**
 * auto-fill-draft.ts — P0-4: Extracted autoFillDraft into per-direction functions.
 *
 * Each direction (BB/PL/Hybrid) has its own function that can be tested in isolation.
 * The dispatcher reads the direction from the program and calls the appropriate handler.
 */
import type { UserProgram, UserWeek, ProgramProgression } from '../../../engines/user-program/user-program.types';
import { newId } from '../../../engines/user-program/user-program.types';
import { autodraftBBPlan, applyPhaseModulation } from '../../../engines/manual-constructor';
import { createFromBuild } from '../../../engines/user-program/program-store';
import { LMS_CYCLES } from '../../../data/lms-cycles/lms-cycle-index';
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

/** BB direction: autodraftBBPlan + createFromBuild + applyPhaseModulation. */
export function autoFillBBDraft(ctx: AutoFillCtx): void {
  const { program, prof, days, bodyFat, leanMass, hrvMs, sleepHours, stressLevel, labMrvMultiplier, update, showToast } = ctx;
  if (!program.bb) return;
  try {
    const bbPlan = autodraftBBPlan({
      level: program.meta.level,
      goal: program.meta.goal,
      daysPerWeek: days,
      weeks: Math.max(1, program.meta.weeks || 4),
      equipment: (prof.equipment ?? []) as string[],
      weakPoints: (prof.weakPoints ?? []) as string[],
      avoidAxialLoad: prof.avoidAxialLoad ?? false,
      favoriteExercises: (prof.favoriteExercises ?? []) as string[],
      excludedExercises: (prof.excludedExercises ?? []) as string[],
      workMax: prof.workMax ?? {},
      onCourse: prof.onCourse ?? false,
      courseIntensity: prof.courseIntensity ?? 'moderate',
      injuries: prof.injuries ?? [],
      trainingFocus: program.meta.trainingFocus,
      bodyFat, leanMass, hrvMs, sleepHours, stressLevel, labMrvMultiplier,
    });
    const userProg = createFromBuild(bbPlan, {
      title: program.meta.title || `${days}д/нед · ${program.meta.weeks}нед`,
      goal: program.meta.goal,
      level: program.meta.level,
      weakPoints: (prof.weakPoints ?? []) as string[],
      equipment: (prof.equipment ?? []) as string[],
    });
    userProg.meta.title = '[Черновик] ' + (program.meta.title || 'Моя программа');
    userProg.meta.weeks = program.meta.weeks;
    userProg.meta.daysPerWeek = days;
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
      if ((userProg.bb.weeks?.length ?? 0) >= 4) {
        userProg.bb.weeks = applyPhaseModulation(userProg.bb.weeks!, {
          goal: program.meta.goal,
          level: program.meta.level,
          weeksTotal: program.meta.weeks || 4,
        });
      }
    }
    update({ bb: userProg.bb });
  } catch (err) {
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
  }
}

/** PL direction: auto-select LMS cycle by level and days. */
export function autoFillPLDraft(ctx: AutoFillCtx): void {
  const { program, prof, days, update, showToast } = ctx;
  if (!program.pl) return;
  const sessCount = Math.max(2, Math.min(6, days));
  let foundCycle = LMS_CYCLES.find(c =>
    c.meta.level === program.meta.level &&
    Math.abs(c.meta.sessionsPerWeek - sessCount) <= 1
  );
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
}

/** Hybrid direction: PL from LMS + BB from bb-builder. */
export function autoFillHybridDraft(ctx: AutoFillCtx): void {
  const { program, prof, days, bodyFat, leanMass, hrvMs, sleepHours, stressLevel, labMrvMultiplier, update, showToast } = ctx;
  if (!program.hybrid) return;
  const sessCount = Math.max(2, Math.min(4, days));
  let foundCycle = LMS_CYCLES.find(c => c.meta.level === program.meta.level && Math.abs(c.meta.sessionsPerWeek - sessCount) <= 1);
  if (!foundCycle) foundCycle = LMS_CYCLES.find(c => Math.abs(c.meta.sessionsPerWeek - sessCount) <= 1);
  const bbDays = Math.max(1, days - sessCount);
  let bbWeeks: UserWeek[] = [];
  try {
    const bbPlan = autodraftBBPlan({
      level: program.meta.level, goal: 'hypertrophy', daysPerWeek: bbDays,
      weeks: Math.max(1, program.meta.weeks || 4),
      equipment: (prof.equipment ?? []) as string[], weakPoints: (prof.weakPoints ?? []) as string[],
      avoidAxialLoad: prof.avoidAxialLoad ?? false, workMax: prof.workMax ?? {},
      onCourse: prof.onCourse ?? false, courseIntensity: prof.courseIntensity ?? 'moderate', injuries: prof.injuries ?? [],
      trainingFocus: program.meta.trainingFocus,
      bodyFat, leanMass, hrvMs, sleepHours, stressLevel, labMrvMultiplier,
    });
    const bbUserProg = createFromBuild(bbPlan, { title: 'hybrid-bb', goal: 'hypertrophy', level: program.meta.level });
    if (bbUserProg.bb?.weeks && (bbUserProg.bb.weeks.length ?? 0) >= 4) {
      bbUserProg.bb.weeks = applyPhaseModulation(bbUserProg.bb.weeks, { goal: 'hypertrophy', level: program.meta.level, weeksTotal: program.meta.weeks || 4 });
    }
    bbWeeks = bbUserProg.bb?.weeks ?? [];
  } catch { bbWeeks = []; }
  update({
    hybrid: {
      ...program.hybrid,
      plRef: { sourceCycleId: foundCycle?.meta.id ?? '', sessionIndices: foundCycle ? Array.from({ length: foundCycle.meta.sessionsPerWeek }, (_, i) => i) : [] },
      bbWeeks,
      workMax: { squat: prof.pmSquat ?? 120, bench: prof.pmBench ?? 100, deadlift: prof.pmDead ?? 140 },
    },
  });
  if (foundCycle) showToast('⚡ Hybrid: ПЛ=' + foundCycle.meta.title + ' + ББ=' + bbDays + 'д/нед');
}

/** Dispatcher: calls the appropriate direction handler based on program.meta.direction. */
export function autoFillDraftDispatch(ctx: AutoFillCtx): void {
  const dir = ctx.program.meta.direction;
  if (dir === 'bb') autoFillBBDraft(ctx);
  else if (dir === 'pl') autoFillPLDraft(ctx);
  else if (dir === 'hybrid') autoFillHybridDraft(ctx);
  ctx.showToast('⚡ Черновик создан из профиля — заполните упражнения и ПМ');
}