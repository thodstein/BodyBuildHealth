/**
 * manual-draft.engine.ts — авто-сборка ББ-планов и подбор упражнений.
 * F4.2: вынесено из manual-constructor.engine.ts.
 */
import { selectExercisesSmart, type SelectedExercise, isAxialLoadExercise } from '../exercise-selector.engine';
import type { Exercise } from '../../core/types';
import { getExercisesByGroup } from '../../core/exercise-catalog';
import type { UserProgram, BBProgramBody } from '../user-program/user-program.types';
import { buildBBPlan, type BBBuilderInput, type BBPlan, type BBGoal } from '../bb/bb-builder.engine';
import { adaptForPEDs, type PED, type PEDAdaptation, type CourseIntensity } from '../bb/bb-ped-adaptation.engine';
import { selectBestBBSplit } from '../bb/bb-selector.engine';
import { createFromBuild } from '../user-program/program-store';
import type { Injury } from '../manual-plan-builder';
import type { BBTrainingFocus } from '../bb/bb-goal-types';

export interface MuscleGroupPlan {
  muscle: string;
  primary: SelectedExercise[];
  secondary: SelectedExercise[];
}

export interface AutoDraftOptions {
  level: string;
  goal: string;
  weakPoints?: string[];
  equipment?: string[];
  avoidAxialLoad?: boolean;
  daysPerWeek: number;
  weeks: number;
  splitPattern?: string;
  favoriteExercises?: string[];
  excludedExercises?: string[];
  workMax?: Record<string, number>;
  onCourse?: boolean;
  courseIntensity?: string;
  injuries?: { muscle: string; from?: string; to?: string; exclude?: boolean; volumePct?: number; weightPct?: number; repsCap?: number }[];
  /** Training focus для RIR/reps/tempo (Schoenfeld 2021, Roberts 2022). */
  trainingFocus?: BBTrainingFocus;
  /** Recovery-метрики → MRV soft-cap (Helms 2022, Plews 2022, Watson 2022). */
  bodyFat?: number;
  leanMass?: number;
  hrvMs?: number;
  sleepHours?: number;
  stressLevel?: number;
  /** Lab-based MRV multiplier (ALT/CRP/HCT/гормоны). */
  labMrvMultiplier?: number;
  /** Eccentric overload multiplier (ACSM 2023). */
  eccentricMult?: number;
  /** Nutrition → MRV (calorie surplus/protein intake). */
  calorieSurplus?: number;
  proteinPerKg?: number;
}

/** Подбирает упражнения для одной мышечной группы: 1-2 базовых + 2-3 изоляции. */
export function suggestExercisesForGroup(
  group: string,
  level: string,
  count: number,
  equipment: string[],
  weakZones: string[] = [],
  injuryProfile: string[] = [],
  avoidAxialLoad = false,
  favoriteIds: string[] = [],
  excludeIds: string[] = [],
): SelectedExercise[] {
  const pool: Exercise[] = getExercisesByGroup(group);
  if (pool.length === 0) return [];
  const wantCompound = count >= 2;
  const primaryCount = Math.min(wantCompound ? 1 : 0, pool.length);
  const secondaryCount = Math.max(0, Math.min(count - primaryCount, pool.length - primaryCount));
  try {
    const primary = selectExercisesSmart({
      candidates: pool,
      muscleGroup: group,
      count: primaryCount,
      selectedIds: [],
      selectedNames: [],
      equipment,
      weakZones,
      level,
      injuryProfile,
      type: 'compound',
      preferEquipment: equipment.slice(0, 3),
      preferBB: true,
      favoriteIds,
      excludeIds,
      avoidAxialLoad,
    });
    const primaryIds = primary.map((e) => e.id);
    const primaryNames = primary.map((e) => e.name);
    const secondary = selectExercisesSmart({
      candidates: pool,
      muscleGroup: group,
      count: secondaryCount,
      selectedIds: primaryIds,
      selectedNames: primaryNames,
      equipment,
      weakZones,
      level,
      injuryProfile,
      type: 'any',
      preferEquipment: equipment.slice(0, 3),
      preferBB: true,
      favoriteIds,
      excludeIds,
      avoidAxialLoad,
    }).filter((e) => !primaryIds.includes(e.id));
    return [...primary, ...secondary].slice(0, count);
  } catch (e) {
    return (pool as Exercise[])
      .filter((ex) => !avoidAxialLoad || !isAxialLoadExercise(ex as any))
      .slice(0, count)
      .map((e) => ({ ...(e as any), selectionScore: 0, rationale: [] } as SelectedExercise));
  }
}

const GROUP_WORKMAX: Record<string, number> = {
  chest: 90, back: 110, legs: 130, shoulders: 55, arms: 35, core: 20,
};
function defaultWorkMax(): Record<string, number> {
  return { ...GROUP_WORKMAX };
}

/** Полноценная авто-сборка ББ-плана через buildBBPlan (BB-auto-движок). */
export function autodraftBBPlan(opts: AutoDraftOptions): BBPlan {
  const goal = (['mass', 'strength', 'cut', 'recomp', 'hypertrophy', 'bodybuilding', 'athletic'].includes(opts.goal)
    ? opts.goal as BBGoal
    : 'hypertrophy') as BBGoal;
  const patternId = opts.splitPattern ?? (
    (() => {
      try {
        const best = selectBestBBSplit({
          goal,
          level: opts.level,
          daysPerWeek: opts.daysPerWeek,
          weakPoints: opts.weakPoints,
          mode: opts.onCourse ? 'on_course' : 'natural',
        });
        return best?.pattern.id ?? (opts.daysPerWeek <= 3 ? 'fullbody_3' : opts.daysPerWeek <= 4 ? 'upper_lower_4' : 'ppl_6');
      } catch {
        return opts.daysPerWeek <= 3 ? 'fullbody_3' : opts.daysPerWeek <= 4 ? 'upper_lower_4' : 'ppl_6';
      }
    })()
  );
  const injuries: Injury[] = (opts.injuries ?? []).map((inj) => ({ muscle: inj.muscle, from: inj.from ?? new Date().toISOString().split('T')[0], to: inj.to, weightPct: inj.weightPct, volumePct: inj.volumePct, repsCap: inj.repsCap, exclude: inj.exclude }));
  const input: BBBuilderInput = {
    patternId,
    level: opts.level,
    goal,
    weeks: Math.max(1, Math.min(opts.weeks, 16)),
    workMax: opts.workMax ?? defaultWorkMax(),
    weakPoints: opts.weakPoints ?? [],
    equipment: opts.equipment ?? [],
    volumeGoal: 'mav',
    avoidAxialLoad: opts.avoidAxialLoad ?? false,
    favoriteExercises: opts.favoriteExercises ?? [],
    excludedExercises: opts.excludedExercises ?? [],
    injuries,
    courseIntensity: (opts.courseIntensity ?? 'moderate') as CourseIntensity,
    trainingFocus: opts.trainingFocus,
    bodyFat: opts.bodyFat,
    leanMass: opts.leanMass,
    hrvMs: opts.hrvMs,
    sleepHours: opts.sleepHours,
    stressLevel: opts.stressLevel,
    labMrvMultiplier: opts.labMrvMultiplier,
    eccentricMult: opts.eccentricMult,
    calorieSurplus: opts.calorieSurplus,
    proteinPerKg: opts.proteinPerKg,
  };
  let pedAdapt: PEDAdaptation | undefined;
  if (opts.onCourse) {
    const peds: PED[] = ['AAS' as PED];
    pedAdapt = adaptForPEDs(peds, defaultWorkMax(), undefined, (opts.courseIntensity ?? 'moderate') as CourseIntensity);
  }
  try {
    return buildBBPlan(input, pedAdapt);
  } catch (e) {
    throw new Error(`autodraftBBPlan: не удалось собрать план (${opts.level}/${opts.daysPerWeek}d/${opts.weeks}w): ${(e as Error)?.message ?? e}`);
  }
}

/** Конвертирует BBPlan → UserProgram через program-store. */
export function buildUserProgramFromBB(
  title: string,
  bbPlan: BBPlan,
  opts: AutoDraftOptions,
): { meta: UserProgram['meta']; bb: BBProgramBody } {
  const sourceProg: any = { meta: { title: '', goal: opts.goal, level: opts.level }, weeks: bbPlan.weeks };
  const wp = createFromBuild(bbPlan, {
    title,
    goal: opts.goal,
    level: opts.level,
    weakPoints: opts.weakPoints,
    equipment: opts.equipment,
    originalProgram: sourceProg,
  });
  return { meta: wp.meta, bb: wp.bb! };
}
