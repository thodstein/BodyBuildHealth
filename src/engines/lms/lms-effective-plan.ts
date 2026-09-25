import type { LMSBuildOutput, LMSPlanDay, LMSPlanExercise, LMSPlanWeek, LMSWorkSet } from './lms-builder.engine';
import { calcCycleMetrics, calcSessionMetrics, type SRExercise } from './lms-metrics.engine';

export interface PLEffectiveEdit {
  weight?: number;
  reps?: number;
  sets?: number;
  tempo?: string;
  pct?: number;
  rir?: number;
}

export interface PLEffectiveAddition {
  uid: string;
  name: string;
  group: string;
  sets: number;
  reps: number;
  weight: number;
}

export interface PLEffectiveOptions {
  edits?: Record<string, PLEffectiveEdit>;
  additions?: Record<string, PLEffectiveAddition[]>;
  autoReg?: { topSetPctMultiplier?: number; volumeMultiplier?: number; rirShift?: number; deload?: boolean } | null;
  diary?: Map<string, { adjustedWeight: number; adjustedSets: number; adjustedRir: number }> | null;
  volumeMultiplier?: number;
  rirShift?: number;
  rirTarget?: number;
  tempo?: string;
}

function keyOf(w: number, d: number, e: number, s: number): string {
  return `${w}_${d}_${e}_${s}`;
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeWorkSet(ws: LMSWorkSet, autoReg: PLEffectiveOptions['autoReg'], volumeMultiplier: number, rirShift: number, rirTarget: number | undefined): LMSWorkSet {
  const sets = Math.max(1, Math.round(ws.sets * volumeMultiplier * finite(autoReg?.volumeMultiplier, 1)));
  const weight = Math.round(ws.weight * finite(autoReg?.topSetPctMultiplier, 1) * 10) / 10;
  const rir = Math.max(0, Math.min(6, rirTarget != null ? rirTarget : ws.rir + rirShift + finite(autoReg?.rirShift, 0)));
  return {
    ...ws,
    sets: autoReg?.deload ? Math.min(sets, Math.max(1, Math.round(sets * 0.6))) : sets,
    weight,
    rir,
  };
}

function toMetricExercise(exercise: LMSPlanExercise): SRExercise {
  return {
    name: exercise.name,
    group: exercise.group,
    coef: exercise.coef,
    mnosz: exercise.mnosz,
    pm: exercise.pm,
    load: exercise.load as 'Тяжелая' | 'Средняя' | 'Легкая' | undefined,
    sets: exercise.workSets.map(ws => ({ weight: ws.weight, reps: ws.reps, sets: ws.sets })),
  };
}

function applyDay(day: LMSPlanDay, week: number, dayIndex: number, opts: PLEffectiveOptions): LMSPlanDay {
  const exercises = day.exercises.map((exercise, exerciseIndex) => {
    const diary = opts.diary?.get(exercise.name);
    let flatSetIndex = 0;
    const workSets = exercise.workSets.map((ws) => {
      const edit = opts.edits?.[keyOf(week, dayIndex, exerciseIndex, flatSetIndex)];
      flatSetIndex += ws.sets;
      const edited: LMSWorkSet = { ...ws };
      if (diary) {
        edited.weight = diary.adjustedWeight;
        edited.sets = Math.max(1, Math.round(diary.adjustedSets));
        edited.rir = Math.max(0, Math.min(6, diary.adjustedRir));
      }
      if (edit?.pct != null && edit.pct > 0) {
        edited.pct = edit.pct;
        edited.weight = Math.round((edited.weight / ws.pct) * edit.pct * 10) / 10;
      } else if (edit?.weight != null) {
        edited.weight = edit.weight;
      }
      if (edit?.reps != null) edited.reps = edit.reps;
      if (edit?.sets != null) edited.sets = Math.max(1, Math.round(edit.sets));
      if (edit?.rir != null) edited.rir = Math.max(0, Math.min(6, edit.rir));
      return normalizeWorkSet(edited, opts.autoReg, finite(opts.volumeMultiplier, 1), finite(opts.rirShift, 0), opts.rirTarget);
    });
    return { ...exercise, rir: workSets[0]?.rir ?? exercise.rir, workSets };
  });
  const additions = opts.additions?.[`${week}_${dayIndex}`] ?? [];
  if (additions.length > 0) {
    for (const addition of additions) {
      exercises.push({
        name: addition.name,
        group: addition.group,
        coef: 1,
        mnosz: 1,
        load: 'additional',
        pm: Math.max(1, addition.weight * 1.4),
        rir: 2,
        workSets: [normalizeWorkSet({ pct: 1, reps: addition.reps, sets: Math.max(1, addition.sets), weight: addition.weight, rir: 2 }, opts.autoReg, finite(opts.volumeMultiplier, 1), finite(opts.rirShift, 0), opts.rirTarget)],
      });
    }
  }
  return { ...day, exercises, metrics: calcSessionMetrics(exercises.map(toMetricExercise)) };
}

export function applyPLEffectiveOverlay(plan: LMSBuildOutput, opts: PLEffectiveOptions = {}): LMSBuildOutput {
  const hasEdits = Object.keys(opts.edits ?? {}).length > 0;
  const hasAdditions = Object.values(opts.additions ?? {}).some(list => list.length > 0);
  const hasDiary = (opts.diary?.size ?? 0) > 0;
  const hasAutoReg = !!opts.autoReg && (finite(opts.autoReg?.volumeMultiplier, 1) !== 1 || finite(opts.autoReg?.topSetPctMultiplier, 1) !== 1 || finite(opts.autoReg?.rirShift, 0) !== 0 || !!opts.autoReg?.deload);
  const hasOverlay = finite(opts.volumeMultiplier, 1) !== 1 || finite(opts.rirShift, 0) !== 0 || opts.rirTarget != null;
  if (!hasEdits && !hasAdditions && !hasDiary && !hasAutoReg && !hasOverlay) return plan;
  const weeks: LMSPlanWeek[] = plan.weeks.map(week => ({
    ...week,
    days: week.days.map((day, dayIndex) => applyDay(day, week.week, dayIndex, opts)),
  }));
  return { ...plan, weeks, cycleMetrics: calcCycleMetrics(weeks.flatMap(week => week.days.map(day => day.exercises.map(toMetricExercise)))) };
}
