/**
 * bb-builder.engine.ts — генератор бодибилдинг-плана из раскладки ротации (Этап BB6).
 * Связывает: bb-split-patterns (расписание) + bb-day-types (тяж/памп/первичная-добивка) +
 * volume-landmarks (MEV/MAV/MRV) + rir-matrix (RIR-прогрессия по неделям).
 *
 * Логика:
 *  - MAV мышц берётся из volume-landmarks, масштабируется под длину ротации.
 *  - Каждая мышца в ротации: одна сессия = первичная (тяж, ~65% MAV), другие = добивка (памп, ~35%).
 *    Ноги (forceDayType) — всегда тяж; их «добивка» тоже тяж-лёг, не памп.
 *  - Сеты/репы/RIR по характеру: тяж 5-8/RIR1-2; памп 12-20/RIR3; лёг 10-15/RIR4.
 *  - Вес = workMax × %1RM(RIR, reps). Недели 2..N: RIR ↓ (rir-matrix) → вес ↑.
 */

import { SPLIT_PATTERNS, getPattern, sessionsOf, type SplitPattern, type ScheduleDay } from './bb-split-patterns';
import { FORCE_HEAVY_GROUPS, getPair, resolveCharacter, type DayCharacter, type MuscleSlot } from './bb-day-types';
import { getAllVolumeLandmarks, landmarksForRotation, normLevel, type TrainingLevel, type MuscleVolumeLandmarks } from '../volume-landmarks.engine';
import { tempoFor, REST_BY_CHARACTER, type TempoSpec } from './bb-tempo-rest';
import { EXERCISE_CATALOG, getExercisesByGroup } from '../../core/exercise-catalog';
import { selectExercisesSmart } from '../exercise-selector.engine';
import { PCT_FOR_RIR, S_MRV_FACTOR } from '../rir-table';
import type { PEDAdaptation } from './bb-ped-adaptation.engine';

export type BBGoal = 'mass' | 'cut' | 'recomp' | 'maintenance' | 'strength_mass';
export type BBVolumeGoal = 'mev' | 'mav' | 'mrv';

export interface BBBuilderInput {
  patternId: string;
  level: string;                 // beginner/intermediate/advanced/enhanced
  goal: BBGoal;
  weeks: number;                 // длительность мезоцикла
  workMax?: Record<string, number>; // рабочий максимум на мышцу/движение (кг)
  weakPoints?: string[];         // отстающие группы → MAV↑
  focusGroup?: string;           // группа специализации → MAV↑↑
  volumeGoal?: BBVolumeGoal;     // цель по объёму: MEV | MAV | MRV
  specialization?: boolean;      // true = слабые на MAV+10%, остальные на MEV
}

export interface BBSet {
  reps: number;
  rir: number;
  weight: number;   // кг
  technique?: string;
  tempo?: string;       // PRO: нотация темпа (напр. "2-1-1-0")
  restSeconds?: number; // PRO: отдых между подходами
}

export interface BBExercise {
  muscle: string;
  name: string;         // Добавлено: конкретное упражнение из каталога
  role: 'primary' | 'accessory';
  character: DayCharacter;
  sets: number;
  repsRange: [number, number];
  rir: number;
  workSets: BBSet[];
  exerciseName?: string;
  tempoSpec?: string;       // PRO: нотация темпа из bb-tempo-rest
  restSeconds?: number;     // PRO: отдых между подходами
}

export interface BBSession {
  day: number;             // 1-based в ротации
  weekOffset: number;      // абсолютный день с учётом повторов ротации
  character: DayCharacter;
  sessionTag?: string;
  exercises: BBExercise[];
}

export interface BBWeek {
  week: number;
  sessions: BBSession[];
}

export interface BBPlan {
  pattern: SplitPattern;
  weeks: BBWeek[];
  rotationMuscleVolume: Record<string, number>; // MAV×ротация на мышцу
  rationale: string[];
}

// sessionTag -> мышцы (канонические EN-ключи)
// PRO-расширение: дельта разделена на пучки (Push: передняя+средняя, Pull: задняя)
// Для Upper/FullBody оставлен aggregate shoulders (одно упр на все пучки)
// traps/forearms добавлены в Pull (трен. спины)
// Новые теги: ChestBack, ShouldersArms, Chest, Back, Shoulders, Arms,
// Torso, Limbs, UpperPower, LowerPower, UpperHyp, LowerHyp
const TAG_MUSCLES: Record<string, string[]> = {
  Push: ['chest', 'delt_front', 'delt_mid', 'triceps'],
  Pull: ['back', 'biceps', 'delt_rear', 'traps'],
  Legs: ['quads', 'hamstrings', 'glutes', 'calves'],
  Upper: ['chest', 'back', 'shoulders', 'biceps', 'triceps'],
  Lower: ['quads', 'hamstrings', 'glutes', 'calves', 'abs'],
  FullBody: ['chest', 'back', 'quads', 'hamstrings', 'shoulders', 'arms'],
  // PRO-расширенные сплиты:
  Chest: ['chest', 'delt_front', 'triceps'],
  Back: ['back', 'biceps', 'delt_rear', 'traps'],
  Shoulders: ['delt_front', 'delt_mid', 'delt_rear', 'traps'],
  Arms: ['biceps', 'triceps', 'forearms'],
  ChestBack: ['chest', 'back', 'delt_front', 'delt_rear', 'traps', 'forearms'],
  ShouldersArms: ['delt_front', 'delt_mid', 'delt_rear', 'biceps', 'triceps', 'traps', 'forearms'],
  Torso: ['chest', 'back', 'shoulders', 'traps', 'abs'],
  Limbs: ['quads', 'hamstrings', 'glutes', 'biceps', 'triceps', 'calves', 'forearms'],
  UpperPower: ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'traps'],
  LowerPower: ['quads', 'hamstrings', 'glutes', 'calves', 'abs', 'lower_back'],
  UpperHyp: ['chest', 'back', 'delt_front', 'delt_mid', 'delt_rear', 'biceps', 'triceps'],
  LowerHyp: ['quads', 'hamstrings', 'glutes', 'calves', 'abs'],
};
/** Для каких мышц в BB-контексте ВСЕГДА брать только изоляцию (нет compound аналогов). */
const ALWAYS_ISOLATION: Set<string> = new Set(['calves', 'forearms', 'abs']);
/** Маппинг PRO-мышц в group каталога для getExercisesByGroup(). */
const PRO_MUSCLE_TO_GROUP: Record<string, string> = {
  delt_front: 'shoulders', delt_mid: 'shoulders', delt_rear: 'shoulders',
  traps: 'back', calves: 'legs', glutes: 'legs', abs: 'core', forearms: 'arms',
};
function catalogGroupFor(muscle: string): string {
  return PRO_MUSCLE_TO_GROUP[muscle] || muscle;
}
/** Родительские мышцы: delt_front → shoulders (для weakPoints-обратной совместимости). */
const PARENT_MUSCLE: Record<string, string> = {
  delt_front: 'shoulders', delt_mid: 'shoulders', delt_rear: 'shoulders',
};
function isWeak(muscle: string, weakPoints: string[]): boolean {
  if (weakPoints.includes(muscle)) return true;
  return weakPoints.includes(PARENT_MUSCLE[muscle] ?? '');
}
/** Развернуть родительские группы (shoulders→3 delt) для проверки специализации. */
function expandWeakForSpecialization(weakPoints: string[]): string[] {
  const expanded = [...weakPoints];
  if (weakPoints.includes('shoulders')) expanded.push('delt_front', 'delt_mid', 'delt_rear');
  return expanded;
}
function musclesForTag(tag?: string): string[] {
  if (!tag) return [];
  if (TAG_MUSCLES[tag]) return TAG_MUSCLES[tag];
  return [];
}

// Коэффициенты workMax для PRO-мышц (% от родительской группы)
const PRO_WORKMAX_RATIO: Record<string, (wm: Record<string, number>) => number> = {
  delt_front: wm => (wm['shoulders'] || 80) * 0.50,
  delt_mid:   wm => (wm['shoulders'] || 80) * 0.45,
  delt_rear:  wm => (wm['shoulders'] || 80) * 0.35,
  traps:      wm => (wm['back'] || 100) * 0.55,
  forearms:   wm => (wm['arms'] || wm['biceps'] || 60) * 0.45,
  abs:        wm => wm['core'] || 40,
};

function charReps(c: DayCharacter): [number, number] {
  if (c === 'тяж') return [5, 8];
  if (c === 'памп') return [12, 20];
  return [10, 15];
}
function charRir(c: DayCharacter, week: number): number {
  if (c === 'лёг') return 4;
  const base = c === 'тяж' ? 2 : 3;
  return Math.max(0, base - Math.floor((week - 1) / 2));
}

function buildSession(
  sched: ScheduleDay, dayInRotation: number, week: number,
  muscleVolumeRotation: Record<string, number>,
  muscleSessionCount: Record<string, number>,
  musclePrimaryAssigned: Set<string>,
  workMax: Record<string, number>, weakPoints: string[], focusGroup?: string,
  pedAdapt?: PEDAdaptation,
  dailyCap: number = 12,
  level: string = 'intermediate',
): BBSession {
  const character = sched.character as DayCharacter;
  const muscles = musclesForTag(sched.sessionTag);
  const exercises: BBExercise[] = [];
  
  // S-MRV: Системный бюджет утомления на день.
  const dayFatigueBudget = Math.round(dailyCap * S_MRV_FACTOR * (pedAdapt?.combinedRecoveryMultiplier ?? 1));
  
  // Pre-calculate each muscle's expected volume to allocate budget proportionally
  interface MusclePlan {
    muscle: string; resolved: string; role: 'primary' | 'accessory';
    sets: number; exerciseCount: number; rir: number;
    reps: number; weight: number; pool: any[]; exDatas: any[]; selType: string;
  }
  const plans: MusclePlan[] = [];
  let totalExpectedFatigue = 0;
  
  for (const muscle of muscles) {
    const resolved = resolveCharacter(muscle, character);
    let role: 'primary' | 'accessory' = 'accessory';
    if (!musclePrimaryAssigned.has(muscle) && (resolved === 'тяж')) {
      role = 'primary'; musclePrimaryAssigned.add(muscle);
    }
    const mavRot = muscleVolumeRotation[muscle] || 0;
    let sets = Math.max(1, Math.round(mavRot * (role === 'primary' ? 0.65 : 0.35)));
    if (isWeak(muscle, weakPoints)) sets = Math.round(sets * 1.2);
    if (focusGroup === muscle || (focusGroup && isWeak(muscle, [focusGroup]))) sets = Math.round(sets * 1.3);
    const [rmin, rmax] = charReps(resolved);
    const rir = charRir(resolved, week);
    const wm = workMax[muscle] || PRO_WORKMAX_RATIO[muscle]?.(workMax) || 80;
    const pct = PCT_FOR_RIR[rir] ?? 0.9;
    const reps = Math.round((rmin + rmax) / 2);
    const weight = Math.round(wm * pct * 10) / 10;
    const exerciseCount = role === 'primary' ? (['back', 'quads', 'chest'].includes(muscle) ? 3 : 2) : 1;
    const selType = ALWAYS_ISOLATION.has(muscle) ? 'isolation' : (role === 'primary' ? 'compound' : 'isolation');
    const pool = getExercisesByGroup(catalogGroupFor(muscle));
    const selected = selectExercisesSmart({
      candidates: pool, muscleGroup: muscle, count: exerciseCount,
      selectedIds: [], equipment: [], weakZones: weakPoints, level, injuryProfile: [], type: selType,
    });
    const exDatas = selected.length > 0 ? selected : [pool[0] || { id: muscle, name: muscle, fatigueCost: 5 }];
    const expectedFatigue = exerciseCount * (sets / exerciseCount) * (((exDatas[0] as any)?.fatigueCost || 5));
    totalExpectedFatigue += expectedFatigue;
    plans.push({ muscle, resolved, role, sets, exerciseCount, rir, reps, weight, pool, exDatas, selType });
  }

  // Process each muscle with proportional budget
  for (const pl of plans) {
    const muscleBudget = totalExpectedFatigue > 0
      ? Math.floor(dayFatigueBudget * pl.exerciseCount * Math.max(1, Math.round(pl.sets / pl.exerciseCount)) * ((pl.exDatas[0] as any)?.fatigueCost || 5) / totalExpectedFatigue)
      : Math.floor(dayFatigueBudget / muscles.length);
    let remainingBudget = Math.max(1, Math.min(muscleBudget, Math.floor(dayFatigueBudget * 0.5))); // cap at 50% total to avoid one group hogging
    
    for (const exData of pl.exDatas) {
      const exSets = Math.max(1, Math.round(pl.sets / pl.exDatas.length));
      const cost = ((exData as any)?.fatigueCost || 5) * exSets;
      if (remainingBudget < cost) {
        const reduced = Math.floor(remainingBudget / ((exData as any)?.fatigueCost || 5));
        if (reduced < 1) continue;
        const adjustedSets = Math.min(exSets, reduced);
        const adjCost = ((exData as any)?.fatigueCost || 5) * adjustedSets;
        remainingBudget -= adjCost;
        const tempoSpec = tempoFor(pl.resolved as DayCharacter);
        const restSeconds = REST_BY_CHARACTER[pl.resolved as DayCharacter];
        const workSets: BBSet[] = Array.from({ length: adjustedSets }, () => ({
          reps: pl.reps, rir: pl.rir, weight: pl.weight,
          tempo: tempoSpec.notation, restSeconds,
        }));
        exercises.push({
          muscle: pl.muscle, name: (exData as any).name, role: pl.role, character: pl.resolved as DayCharacter,
          sets: adjustedSets, repsRange: [pl.reps - 2, pl.reps + 2], rir: pl.rir, workSets,
          exerciseName: (exData as any).name, tempoSpec: tempoSpec.notation, restSeconds,
        });
        continue;
      }
      remainingBudget -= cost;
      const tempoSpec = tempoFor(pl.resolved as DayCharacter);
      const restSeconds = REST_BY_CHARACTER[pl.resolved as DayCharacter];
      const workSets: BBSet[] = Array.from({ length: exSets }, () => ({
        reps: pl.reps, rir: pl.rir, weight: pl.weight,
        tempo: tempoSpec.notation, restSeconds,
      }));
      exercises.push({
        muscle: pl.muscle, name: (exData as any).name, role: pl.role, character: pl.resolved as DayCharacter,
        sets: exSets, repsRange: [pl.reps - 2, pl.reps + 2], rir: pl.rir, workSets,
        exerciseName: (exData as any).name, tempoSpec: tempoSpec.notation, restSeconds,
      });
    }
  }
  return { day: dayInRotation, weekOffset: 0, character, sessionTag: sched.sessionTag, exercises };
}

export function buildBBPlan(input: BBBuilderInput, pedAdapt?: PEDAdaptation): BBPlan {
  const pattern = getPattern(input.patternId) || SPLIT_PATTERNS[0];
  const level = normLevel(input.level) as TrainingLevel;
  const workMax = input.workMax || {};
  const weakPoints = input.weakPoints || [];
  const focusGroup = input.focusGroup;
  const sessions = sessionsOf(pattern);

  // Вычисляем dailyCap (max групп в день) для S-MRV-бюджета
  const maxGroupsPerSession = Math.max(1, ...sessions.map(s => musclesForTag(s.sessionTag).length));
  const dailyCap = Math.max(10, Math.min(16, Math.round(8 + maxGroupsPerSession * 2)));

  const muscleSessionCount: Record<string, number> = {};
  for (const s of sessions) for (const m of musclesForTag(s.sessionTag)) muscleSessionCount[m] = (muscleSessionCount[m] || 0) + 1;

  const muscleVolumeRotation: Record<string, number> = {};
  const specWeak = input.specialization ? expandWeakForSpecialization(input.weakPoints || []).slice(0, 2) : [];
  for (const m of Object.keys(muscleSessionCount)) {
    const lm = landmarksForRotation(level, m, pattern.rotationDays);
    if (lm) {
      let v: number;
      if (input.specialization) {
        // специализация: слабые (топ-2) на MAV+10%, остальные на MEV
        v = specWeak.includes(m) ? Math.round(lm.mav * 1.1) : lm.mev;
      } else {
        v = lm.mav;
        if (input.volumeGoal === 'mev') v = lm.mev;
        else if (input.volumeGoal === 'mrv') v = lm.mrv;
      }
      if (input.goal === 'cut') v = Math.round(v * 0.9);
      if (input.goal === 'mass' || input.goal === 'strength_mass') v = Math.round(v * 1.1);
      muscleVolumeRotation[m] = v;
    }
  }

  const weeks: BBWeek[] = [];
  for (let w = 1; w <= input.weeks; w++) {
    const musclePrimaryAssigned = new Set<string>(); // ← сбрасывается КАЖДУЮ неделю
    const weekSessions: BBSession[] = [];
    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i];
      const sess = buildSession(s, i + 1, w, muscleVolumeRotation, muscleSessionCount, musclePrimaryAssigned, workMax, weakPoints, focusGroup, pedAdapt, dailyCap, level);
      sess.weekOffset = (w - 1) * pattern.rotationDays + (i + 1);
      weekSessions.push(sess);
    }
    weeks.push({ week: w, sessions: weekSessions });
  }

  const rationale: string[] = [
    `Сплит «${pattern.name}» (${pattern.rotationDays}дн ротация, ${pattern.sessionsPerRotation} сессий)`,
    `Уровень ${level}, цель ${input.goal}, ${input.weeks} нед`,
    `Объём ${input.volumeGoal || 'MAV'}: ` + Object.entries(muscleVolumeRotation).map(([m, v]) => `${m}=${v}`).join(', '),
    `Специализация: ${focusGroup || 'нет'}`,
    `RIR-прогрессия: тяж 2→0, памп 3→2 к пику; вес = workMax×%1RM(RIR)`,
    `S-MRV: автоматический кап объёма на основе бюджета утомления сессии.`,
    ...(pedAdapt ? [`PED-адаптация: MRV×${pedAdapt.combinedMrvMultiplier.toFixed(2)}, восстановление×${pedAdapt.combinedRecoveryMultiplier.toFixed(2)}`] : []),
  ];

  return { pattern, weeks, rotationMuscleVolume: muscleVolumeRotation, rationale };
}
