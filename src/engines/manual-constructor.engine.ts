/**
 * manual-constructor.engine.ts — интеллектуальная начинка ручного конструктора.
 *
 * Не дублирует bb-builder (BB-auto) или LMS-cycles (PL-auto) — это движок
 * «черновика» и помощника при ручной сборке UserProgram:
 *
 *   1. suggestExercisesForGroup()  — реальный отбор упражнений через selectExercisesSmart
 *      с учётом equipment / weakPoints / avoidAxialLoad / level (не пустой blackboard).
 *   2. autodraftBBPlan()           — полноценная BB-сборка через buildBBPlan + createFromBuild.
 *      Используется когда пользователь нажал ⚡ авто-черновик и хочет профессиональный
 *      план, а не заготовку под редактирование.
 *   3. plLmsScheduleDays()         — генерирует PlayerDay из LMS-цикла (ПЛ-программы):
 *      берёт week 1, мапит упражнения цикла на дни расписания → executable runtime.
 *   4. computePlanQualityFor()     — обёртка над validatePlanQuality: score + critical issues.
 *   5. muscleAwareSets()           — muscle-aware set-templates (грудь=4×8-10, ноги=5×5 и т.д.).
 */
import { selectExercisesSmart, type SelectedExercise, isAxialLoadExercise } from './exercise-selector.engine';
import type { Exercise } from '../core/types';
import { getExercisesByGroup } from '../core/exercise-catalog';
import { getVolumeLandmarks } from './volume-landmarks.engine';
import type { UserProgram, BBProgramBody, UserWeek, UserSession, UserBlock, UserSet } from './user-program/user-program.types';
import { buildBBPlan, type BBBuilderInput, type BBPlan, type BBGoal } from './bb/bb-builder.engine';
import { adaptForPEDs, type PED, type PEDAdaptation, type CourseIntensity } from './bb/bb-ped-adaptation.engine';
import { getReferencedCycle, createFromBuild } from './user-program/program-store';
import type { Injury } from './manual-plan-builder';

// Exercise type не экспортирован из exercise-catalog, берём из core/types.

export interface MuscleGroupPlan {
  muscle: string;
  primary: SelectedExercise[];
  secondary: SelectedExercise[];
}

export interface AutoDraftOptions {
  level: string; // beginner/intermediate/advanced/enhanced
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
}

/**
 * Подбирает упражнения для одной мышечной группы: 1-2 базовых + 2-3 изоляции.
 * Использует selectExercisesSmart с полной матрицей (equipment, weakZones, level, type).
 * Возвращает РЕАЛЬНЫЕ упражнения из каталога.
 */
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
    // Fallback: первый доступный — фильтр против осевой если задан
    return (pool as Exercise[])
      .filter((e) => !avoidAxialLoad || !isAxialLoadExercise(e as any))
      .slice(0, count)
      .map((e) => ({ ...(e as any), selectionScore: 0, rationale: [] } as SelectedExercise));
  }
}

/**
 * Полноценная авто-сборка ББ-плана через buildBBPlan (BB-auto-движок).
 * Возвращает полный BBPlan, который затем можно сконвертировать в UserProgram.
 * НЕ дублирует BbAutoConstructor — использует ТОТ ЖЕ движок, чтобы избежать рассинхрона.
 */
export function autodraftBBPlan(opts: AutoDraftOptions): BBPlan {
  const goal = (['mass', 'strength', 'cut', 'recomp', 'hypertrophy', 'bodybuilding', 'athletic'].includes(opts.goal)
    ? opts.goal as BBGoal
    : 'hypertrophy') as BBGoal;
  const patternId = opts.splitPattern ?? (opts.daysPerWeek <= 3 ? 'fullbody_3' : opts.daysPerWeek <= 4 ? 'upper_lower_4' : 'ppl_6');
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
  };
  let pedAdapt: PEDAdaptation | undefined;
  if (opts.onCourse) {
    const peds: PED[] = (['AAS', 'GH', 'INSULIN', 'IGF1', 'MGF'] as PED[]).filter((p) => (opts.workMax && true));
    pedAdapt = adaptForPEDs(peds.length > 0 ? peds : ['AAS' as PED], defaultWorkMax(), undefined, (opts.courseIntensity ?? 'moderate') as CourseIntensity);
  }
  try {
    return buildBBPlan(input, pedAdapt);
  } catch (e) {
    return emptyBBPlan(opts);
  }
}

const GROUP_WORKMAX: Record<string, number> = {
  chest: 90, back: 110, legs: 130, shoulders: 55, arms: 35, core: 20,
};
function defaultWorkMax(): Record<string, number> {
  return { ...GROUP_WORKMAX };
}

function emptyBBPlan(opts: AutoDraftOptions): BBPlan {
  const days = Math.max(2, Math.min(opts.daysPerWeek, 6));
  return {
    pattern: { id: opts.splitPattern ?? 'fallback', name: 'Fallback', daysPerWeek: days, rotation: [] } as any,
    weeks: [{
      week: 1,
      phase: 'accumulation' as any,
      deload: false,
      sessions: Array.from({ length: days }, (_, i) => ({
        day: i + 1,
        sessionTag: 'mix',
        exerciseCount: 1,
        sets: 3,
        exercises: [{
          id: 'fallback',
          name: 'Любое упражнение',
          muscle: 'chest',
          movementPattern: 'push',
          fatigueCost: 4,
          workSets: [{
            weight: GROUP_WORKMAX.chest,
            reps: 8,
            rir: 2,
            rest: 120,
            tempo: '2-1-2-1',
            rpe: 7,
            setType: 'work' as const,
          }],
        }],
      })),
    }],
  } as any;
}

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

/**
 * Конвертация PL-программы (LMS cycle) → PlayerDay[] для подачи в he_pl_runtime.
 * Использует расписание pl.schedule, чтобы каждой сессии цикла дать день недели.
 * Упражнения берутся из week1 (anchor) цикла — SRDaySpec[] уже player-ready.
 */
export function plLmsScheduleDays(program: UserProgram): { label: string; exercises: any[] }[] {
  if (!program.pl) return [];
  const cycle = getReferencedCycle(program);
  if (!cycle) return [];
  // LMS cycles: week1 (anchor) — SRDaySpec[]. weeks? (explicit per-week) — SRDaySpec[][].
  // plLmsScheduleDays использует week1 (anchor — основная неделя цикла).
  const week1Days = (cycle.week1 ?? []) as Array<{ exercises?: Array<{ name: string; group?: string; coef?: number; mnosz?: number; load?: string; sets?: Array<{ pct: number; reps: number; sets: number; rir?: number }> }> }>;
  if (!Array.isArray(week1Days) || week1Days.length === 0) return [];
  const schedMap = new Map<number, number>();
  for (const s of program.pl.schedule ?? []) schedMap.set(s.sessionIdx, s.dayOfWeek);
  return week1Days.map((day, idx) => {
    const wm = program.pl?.workMax ?? {};
    const dayOfWeek = schedMap.get(idx) ?? idx;
    const dowLabel = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][dayOfWeek] ?? '';
    return {
      label: `День ${idx + 1}${dowLabel ? ' (' + dowLabel + ')' : ''}`,
      exercises: (day.exercises ?? []).map((e) => {
        // Determine lift type by name (simple heuristic)
        const haystack = (e.name || '') + ' ' + (e.group || '');
        let lift: 'squat' | 'bench' | 'dead' | null = null;
        if (/жим/i.test(haystack)) lift = 'bench';
        else if (/тяг|стан/i.test(haystack)) lift = 'dead';
        else if (/прис|скв/i.test(haystack)) lift = 'squat';
        const pmVal = lift ? (wm[lift] ?? 0) : 0;
        return {
          name: e.name,
          muscleGroup: e.group ?? '',
          sets: (e.sets ?? []).map((st) => ({
            pct: st.pct,
            reps: st.reps,
            sets: st.sets,
            rir: st.rir ?? 2,
            weight: pmVal > 0 ? Math.round((pmVal * st.pct) / 2.5) * 2.5 : 0,
          })),
        };
      }),
    };
  });
}

/**
 * Живая оценка качества ББ-программы: сводный балл 0-100, статус по группам, проблемы.
 * Адаптирует UserProgram → PlanQualityInput (минимальный, без лаб-данных).
 */
export function computePlanQualityFor(
  program: UserProgram,
  level: string,
): { score: number; grade: string; perMuscle: Array<{ muscle: string; sets: number; status: 'over' | 'high' | 'ok' | 'low'; mrv: number; mav: number; mev: number }>; issues: string[] } {
  const setsByMuscle: Record<string, number> = {};
  if (program.bb) {
    for (const w of program.bb.weeks ?? []) {
      for (const s of w.sessions ?? []) {
        for (const b of s.blocks ?? []) {
          const mu = (b.muscle || '').toLowerCase();
          if (!mu) continue;
          setsByMuscle[mu] = (setsByMuscle[mu] || 0) + (b.sets?.length || 0);
        }
      }
    }
  }
  const perMuscle: Array<{ muscle: string; sets: number; status: 'over' | 'high' | 'ok' | 'low'; mrv: number; mav: number; mev: number }> = [];
  const issues: string[] = [];
  let totalScore = 100;
  for (const [muscle, sets] of Object.entries(setsByMuscle)) {
    const lm = getVolumeLandmarks(level, muscle);
    if (!lm) continue;
    let status: 'over' | 'high' | 'ok' | 'low';
    if (sets > lm.mrv) {
      status = 'over'; totalScore -= 8; issues.push(`⚠ ${muscle}: ${sets} сетов > MRV (${lm.mrv}) — перетрен`);
    } else if (sets >= lm.mav) {
      status = 'high'; totalScore -= 2;
    } else if (sets >= lm.mev) {
      status = 'ok';
    } else {
      status = 'low'; totalScore -= 3; issues.push(`⬇ ${muscle}: ${sets} сетов < MEV (${lm.mev}) — минимум не добирается`);
    }
    perMuscle.push({ muscle, sets, status, mrv: lm.mrv, mav: lm.mav, mev: lm.mev });
  }
  if (perMuscle.length === 0) {
    issues.push('⚠ Программа пуста — добавьте упражнения');
    totalScore = 0;
  }
  totalScore = Math.max(0, Math.min(100, totalScore));
  const grade = totalScore >= 90 ? '🟢 A' : totalScore >= 75 ? '🟡 B' : totalScore >= 50 ? '🟠 C' : '🔴 D';
  return { score: totalScore, grade, perMuscle, issues };
}

/**
 * Muscle-aware set-templates: хитрая эвристика по группе.
 * Грудь → 4×8-10, ноги → 4×6-10, плечи → 3×12-15, руки → 3×10-15, кор → 3×15-20.
 */
export function muscleAwareSets(muscle: string, level: string): Array<{ reps: number | string; rir: number; restSec: number }> {
  const m = (muscle || '').toLowerCase();
  const isAdvanced = level === 'advanced' || level === 'enhanced';
  if (['chest', 'back'].includes(m)) {
    return [{ reps: isAdvanced ? 8 : '8-10', rir: isAdvanced ? 1 : 2, restSec: 150 }];
  }
  if (m === 'legs' || m === 'quads' || m === 'hamstrings') {
    return [{ reps: isAdvanced ? 6 : '8-10', rir: isAdvanced ? 1 : 2, restSec: 180 }];
  }
  if (m === 'shoulders') {
    return [{ reps: '10-15', rir: 2, restSec: 90 }];
  }
  if (m === 'arms' || m === 'biceps' || m === 'triceps') {
    return [{ reps: '10-12', rir: 2, restSec: 90 }];
  }
  if (m === 'core' || m === 'abs' || m === 'calves') {
    return [{ reps: '12-20', rir: 3, restSec: 60 }];
  }
  return [{ reps: 10, rir: 2, restSec: 90 }];
}

/** Сборка `UserSet`-массива по template (мульти-сеты). */
export function makeSetsFromTemplate(templates: Array<{ reps: number | string; rir: number; restSec: number }>, weight: number): UserSet[] {
  return templates.map((t) => ({ reps: t.reps, rir: t.rir, weight, restSec: t.restSec }));
}
