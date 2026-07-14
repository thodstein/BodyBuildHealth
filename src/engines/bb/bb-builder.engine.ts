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
import type { Injury } from '../manual-plan-builder';
import { getActiveInjuries, getExcludedMuscles, getGradedInjuries, getInjuryVolumeFactor } from '../manual-plan-builder';
import { findSubstitutions } from '../exercise-substitution.engine';
// Фазовая периодизация (distributePhases) — ЕДИНЫЙ источник RIR/фаз/deload для ББ-плана.
// Импорт distributePhases/getPhaseVolumeMult из UI-модуля намеренный: это каноническая
// реализация, которую использует и ручной конструктор (phase-periodization).
import { distributePhases, PHASE_CONFIGS, getPhaseVolumeMult, type BBPhase } from '../../ui/screens/TrainingScreen_parts/TrainingConstructor/phase-periodization';

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
  injuries?: Injury[];           // травмы — группы с активной травмой исключаются из плана
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
  comment?: string;         // PRO: тренерский комментарий (роль/слабые/фаза/нагрузка)
  warmupSets?: { load: number; reps: number }[]; // PRO: разминочные подходы (для compounds)
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
  // Специализированные теги для 8-дневного PRO-сплита
  LegsBiceps: ['quads', 'hamstrings', 'calves', 'biceps'],
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
/** fix Z: ключ коллапса для дедупликации.
 *  delt_front/mid/rear — три пучка одной мышцы (shoulders), один пул упражнений →
 *  обрабатываем ОДИН раз как 'shoulders'. Остальные PRO-ключи остаются как есть
 *  (calves/glutes/forearms имеют собственные landmark-записи). */
function collapseKey(muscle: string): string {
  if (muscle === 'delt_front' || muscle === 'delt_mid' || muscle === 'delt_rear') return 'shoulders';
  return muscle;
}
/** fix Z: дедуплицирует PRO-ключи тега по collapseKey.
 *  Возвращает {group, repKey}: group = collapseKey (ключ для volumeRotation/output),
 *  repKey = первый PRO-ключ группы (для workMax/FORCE_HEAVY.pool). */
interface MuscleGroupPlan { group: string; repKey: string; }
function dedupeMuscles(tag: string | undefined, excluded: Set<string>): MuscleGroupPlan[] {
  const out: MuscleGroupPlan[] = [];
  const seen = new Set<string>();
  for (const m of musclesForTag(tag)) {
    if (excluded.has(m)) continue;
    const ck = collapseKey(m);
    if (seen.has(ck)) continue;
    seen.add(ck);
    out.push({ group: ck, repKey: m });
  }
  return out;
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
/** Базовый RIR фазы (с дрейфом внутри фазы, как в phase-periodization). */
function phaseBaseRir(phase: BBPhase, phaseWeek: number): number {
  const [startRir, endRir] = PHASE_CONFIGS[phase].rirRange;
  const drift = Math.min(startRir - endRir, Math.floor(phaseWeek / 2));
  return Math.max(endRir, startRir - drift);
}
/**
 * RIR упражнения в ББ-плане = фаза (distributePhases) + характер дня.
 * Тяжёлый день — самый низкий RIR (труднее), памп/лёгкий — на +1 выше.
 * В делоде RIR принудительно лёгкий (3-4).
 */
function bbRir(resolved: DayCharacter, phase: BBPhase, phaseWeek: number): number {
  const base = phaseBaseRir(phase, phaseWeek);
  let rir = resolved === 'тяж' ? base : base + 1;
  if (phase === 'deload') rir = Math.max(3, Math.min(4, rir));
  return Math.max(0, Math.min(5, rir));
}

/** Группы, получающие 2 изолирующих упражнения (акцент детализации) — fix B.
 *  Покрываем и PRO-ключи (delt_front/biceps…), и group-ключи (shoulders/arms…),
 *  поскольку в плане могут использоваться оба вида. */
const ACCESSORY_2X_GROUPS = new Set<string>([
  'delt_front', 'delt_mid', 'delt_rear', 'biceps', 'triceps', 'forearms',
  'shoulders', 'arms', 'calves', 'abs',
]);
/**
 * Доля объёма мышцы на ОДНУ сессию (fix C):
 * - 1 сессия/нед → вся цель на эту сессию (было 65% — терялись 35%);
 * - ≥2 сессии → primary забирает бОльшую долю, accessory — меньшую.
 * Итоговый недельный объём дополнительно капается по MRV в normalizeWeekMrv.
 */
function sessionShareFor(mavRot: number, sessionsPerWeek: number, role: 'primary' | 'accessory'): number {
  if (sessionsPerWeek <= 1) return Math.round(mavRot);
  const base = mavRot / sessionsPerWeek;
  const factor = role === 'primary' ? 1.5 : 0.75;
  return Math.max(1, Math.round(base * factor));
}

/** fix D: недельный кап объёма каждой мышцы по её истинному MRV (после всех множителей). */
function normalizeWeekMrv(weekSessions: BBSession[], mrvByMuscle: Record<string, number>): void {
  const sums: Record<string, { total: number; exs: BBExercise[] }> = {};
  for (const s of weekSessions) {
    for (const ex of s.exercises) {
      const info = sums[ex.muscle] || (sums[ex.muscle] = { total: 0, exs: [] });
      info.total += ex.sets;
      info.exs.push(ex);
    }
  }
  for (const [m, info] of Object.entries(sums)) {
    const cap = mrvByMuscle[m];
    if (cap && info.total > cap) {
      const factor = cap / info.total;
      for (const ex of info.exs) ex.sets = Math.max(1, Math.round(ex.sets * factor));
    }
  }
}

/** Построить тренерский комментарий к упражнению. */
function buildExComment(
  muscle: string, name: string, role: 'primary' | 'accessory',
  character: DayCharacter, sets: number, reps: number, weight: number, rir: number,
  weakPoints: string[], focusGroup: string | undefined,
  phase: BBPhase, tempo: string, restSec: number,
  isSubstituted: boolean,
): string {
  const parts: string[] = [];
  const label = role === 'primary' ? '🎯 Основное' : '📌 Добивочное';
  parts.push(`${label}: ${muscle}`);
  if (isWeak(muscle, weakPoints)) parts.push('🔥 Отстающая');
  if (focusGroup && (muscle === focusGroup || isWeak(muscle, [focusGroup]))) parts.push('⭐ Специализация');
  if (isSubstituted) parts.unshift('⚠ Замена (травма):');
  const phaseNames: Record<string, string> = { accumulation: 'Накопление', intensification: 'Интенсификация', deload: 'Разгрузка', peaking: 'Пик' };
  const charLabel = character === 'тяж' ? 'тяж' : character === 'памп' ? 'памп' : 'лёг';
  parts.push(`${phaseNames[phase] || phase}, RIR ${rir} (${charLabel})`);
  parts.push(`${sets}×${reps} @ ${weight} кг`);
  parts.push(`Темп ${tempo}, отдых ${restSec}с`);
  return parts.join('. ');
}

/** Разминочная пирамида для compound упражнений. */
function buildWarmup(workWeight: number, isCompound: boolean): { load: number; reps: number }[] {
  if (!isCompound || workWeight <= 0) return [];
  const steps = workWeight <= 60 ? 2 : workWeight <= 100 ? 3 : 4;
  const warmups: { load: number; reps: number }[] = [];
  for (let i = 1; i <= steps; i++) {
    const pct = 0.3 + (0.55 / steps) * i;
    warmups.push({ load: Math.round(workWeight * pct), reps: Math.min(8, 5 + i) });
  }
  return warmups;
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
  injuryProfile: string[] = [],
  injuredMuscles: Set<string> = new Set(),
  excludedMuscles: Set<string> = new Set(),
  gradedInjuries: Injury[] = [],
  today: string = '',
  phase: BBPhase = 'accumulation',
  phaseWeek: number = 1,
  mrvRot: number = 0,
): BBSession {
  const character = sched.character as DayCharacter;
  const musclePlans = dedupeMuscles(sched.sessionTag, excludedMuscles);
  const exercises: BBExercise[] = [];
  
  // S-MRV: Системный бюджет утомления на день.
  // Формула: dailyCap × S_MRV_FACTOR × pedMult × levelMult
  const levelMultMap: Record<string, number> = { beginner: 0.9, intermediate: 1.0, advanced: 1.15, enhanced: 1.3 };
  const levelMult = levelMultMap[level] ?? 1.0;
  const dayFatigueBudget = Math.round(dailyCap * S_MRV_FACTOR * (pedAdapt?.combinedRecoveryMultiplier ?? 1) * levelMult);
  
  // Pre-calculate each muscle's expected volume to allocate budget proportionally
  interface MusclePlan {
    muscle: string; resolved: string; role: 'primary' | 'accessory';
    sets: number; exerciseCount: number; rir: number;
    reps: number; weight: number; pool: any[]; exDatas: any[]; selType: string;
  }
  const plans: MusclePlan[] = [];
  let totalExpectedFatigue = 0;
  const sessionSelectedIds: string[] = [];
  const sessionSelectedNames: string[] = [];
  
  for (const mp of musclePlans) {
    const muscle = mp.group;      // каталог-группа (shoulders/arms/back/legs/core…)
    const repKey = mp.repKey;     // первый PRO-ключ группы (delt_front/biceps/…)
    // Полностью исключённые группы пропускаем (dedupeMuscles уже отфильтровал, дублируем страховку)
    if (excludedMuscles.has(repKey)) continue;
    // Градированные травмы: не пропускаем, но применим замену ниже
    const isGraded = gradedInjuries.some(inj => catalogGroupFor(inj.muscle) === muscle);
    const injuryFactor = gradedInjuries.find(inj => catalogGroupFor(inj.muscle) === muscle);

    const resolved = resolveCharacter(repKey, character);
    let role: 'primary' | 'accessory' = 'accessory';
    if (!musclePrimaryAssigned.has(muscle) && (resolved === 'тяж')) {
      role = 'primary'; musclePrimaryAssigned.add(muscle);
    }
    const mavRot = muscleVolumeRotation[muscle] || 0;
    const sessionsForMuscle = muscleSessionCount[muscle] || 1;
    let sets = sessionShareFor(mavRot, sessionsForMuscle, role);
    if (isWeak(muscle, weakPoints)) sets = Math.round(sets * 1.2);
    if (focusGroup === muscle || (focusGroup && isWeak(muscle, [focusGroup]))) sets = Math.round(sets * 1.3);
    // Фазовая модуляция объёма (deload/intensification/peaking снижают)
    sets = Math.round(sets * getPhaseVolumeMult(phase));
    // MRV-кап: одна сессия не превышает недельный MRV мышцы (fix D)
    if (mrvRot > 0) sets = Math.max(1, Math.min(sets, mrvRot));
    const [rmin, rmax] = charReps(resolved);
    const rir = bbRir(resolved, phase, phaseWeek);
    const wm = workMax[repKey] || PRO_WORKMAX_RATIO[repKey]?.(workMax) || 80;
    const pct = PCT_FOR_RIR[rir] ?? 0.9;
    const reps = Math.round((rmin + rmax) / 2);
    const weight = Math.round(wm * pct * 10) / 10;
    const accessoryCount = ACCESSORY_2X_GROUPS.has(muscle) ? 2 : 1;
    const exerciseCount = role === 'primary'
      ? (['back', 'quads', 'chest'].includes(muscle) ? 3 : 2)
      : accessoryCount;
    const selType = ALWAYS_ISOLATION.has(muscle) ? 'isolation' : (role === 'primary' ? 'compound' : 'isolation');
    const pool = getExercisesByGroup(catalogGroupFor(repKey));
    const selected = selectExercisesSmart({
      candidates: pool, muscleGroup: muscle, count: exerciseCount,
      selectedIds: sessionSelectedIds, selectedNames: sessionSelectedNames,
      equipment: [], weakZones: weakPoints, level, injuryProfile, type: selType,
      targetRir: rir,
      preferBB: true,
    });
    for (const s of selected) { if (s && s.id) sessionSelectedIds.push(s.id); if (s && s.name) sessionSelectedNames.push(s.name); }
    const exDatas = selected.length > 0 ? selected : [pool[0] || { id: muscle, name: muscle, fatigueCost: 5 }];
    const expectedFatigue = exerciseCount * (sets / exerciseCount) * (((exDatas[0] as any)?.fatigueCost || 5));
    totalExpectedFatigue += expectedFatigue;
    plans.push({ muscle, resolved, role, sets, exerciseCount, rir, reps, weight, pool, exDatas, selType });
  }

  // Apply substitution for graded injuries: replace exercises and adjust loads
  for (const pl of plans) {
    const isGraded = gradedInjuries.some(inj => collapseKey(inj.muscle) === pl.muscle);
    const injuryFactor = gradedInjuries.find(inj => collapseKey(inj.muscle) === pl.muscle);
    if (isGraded && injuryFactor) {
      const postInjuryVolPct = getInjuryVolumeFactor(injuryFactor, today || todayStr());
      const postInjuryWtPct = injuryFactor.weightPct ?? 1.0;
      const newExDatas: any[] = [];
      for (const exData of pl.exDatas) {
        const subs = findSubstitutions((exData as any).name || exData.id, pl.muscle, new Set([pl.muscle]));
        if (subs.length > 0) {
          const sub = subs[0];
          const subEx = sub.exercise;
          // Keep most plan data, overwrite weight/sets/reps
          newExDatas.push({
            ...(subEx as any),
            substitutionWeightPct: sub.weightPct * postInjuryWtPct,
            substitutionVolumePct: sub.volumePct * postInjuryVolPct,
            originalName: (exData as any).name,
            substitutionReason: sub.reason,
            substituted: sub.exercise.name !== ((exData as any).name || exData.id),
          });
        } else {
          newExDatas.push(exData);
        }
      }
      // Ограничиваем пул замен исходным числом упражнений (exerciseCount),
      // иначе изолированная мышца при травме раздувается до 2-3 упражнений
      // (findSubstitutions возвращает до 3 кандидатов) — объём РАСТЁТ вместо снижения.
      pl.exDatas = newExDatas.slice(0, pl.exerciseCount);
    }
  }

  // Process each muscle with proportional budget
  for (const pl of plans) {
    const muscleBudget = totalExpectedFatigue > 0
      ? Math.floor(dayFatigueBudget * pl.exerciseCount * Math.max(1, Math.round(pl.sets / pl.exerciseCount)) * ((pl.exDatas[0] as any)?.fatigueCost || 5) / totalExpectedFatigue)
      : Math.floor(dayFatigueBudget / Math.max(1, plans.length));
    let remainingBudget = Math.max(1, Math.min(muscleBudget, Math.floor(dayFatigueBudget * 0.5))); // cap at 50% total to avoid one group hogging
    
    for (const exData of pl.exDatas) {
      const wPct = (exData as any).substitutionWeightPct ?? 1.0;
      const vPct = (exData as any).substitutionVolumePct ?? 1.0;
      const isSubstituted = (exData as any).substituted === true;
      const repsCap = (exData as any).repsCap ?? 20;
      const exSets = Math.max(1, Math.round(Math.round(pl.sets / pl.exDatas.length) * vPct));
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
          reps: Math.round(Math.min(pl.reps, repsCap)), rir: isSubstituted ? Math.min(pl.rir + 1, 4) : pl.rir,
          weight: Math.round(pl.weight * wPct * 10) / 10,
          tempo: tempoSpec.notation, restSeconds,
        }));
        exercises.push({
          muscle: pl.muscle, name: (exData as any).name || (exData as any).id, role: pl.role, character: pl.resolved as DayCharacter,
          sets: adjustedSets, repsRange: [Math.round(Math.min(pl.reps - 2, repsCap)), Math.round(Math.min(pl.reps + 2, repsCap))],
          rir: isSubstituted ? Math.min(pl.rir + 1, 4) : pl.rir,
          workSets, exerciseName: (exData as any).name || (exData as any).id,
          tempoSpec: tempoSpec.notation, restSeconds,
          comment: buildExComment(pl.muscle, (exData as any).name || (exData as any).id, pl.role, pl.resolved as DayCharacter, adjustedSets, Math.round(Math.min(pl.reps, repsCap)), Math.round(pl.weight * wPct * 10) / 10, isSubstituted ? Math.min(pl.rir + 1, 4) : pl.rir, weakPoints, focusGroup, phase, tempoSpec.notation, restSeconds, isSubstituted),
          warmupSets: buildWarmup(Math.round(pl.weight * wPct * 10) / 10, pl.role === 'primary'),
        });
        continue;
      }
      remainingBudget -= cost;
      const tempoSpec = tempoFor(pl.resolved as DayCharacter);
      const restSeconds = REST_BY_CHARACTER[pl.resolved as DayCharacter];
      const workSets: BBSet[] = Array.from({ length: exSets }, () => ({
        reps: Math.round(Math.min(pl.reps, repsCap)), rir: isSubstituted ? Math.min(pl.rir + 1, 4) : pl.rir,
        weight: Math.round(pl.weight * wPct * 10) / 10,
        tempo: tempoSpec.notation, restSeconds,
      }));
      exercises.push({
        muscle: pl.muscle, name: (exData as any).name || (exData as any).id, role: pl.role, character: pl.resolved as DayCharacter,
        sets: exSets, repsRange: [Math.round(Math.min(pl.reps - 2, repsCap)), Math.round(Math.min(pl.reps + 2, repsCap))],
        rir: isSubstituted ? Math.min(pl.rir + 1, 4) : pl.rir,
        workSets, exerciseName: (exData as any).name || (exData as any).id,
        tempoSpec: tempoSpec.notation, restSeconds,
        comment: buildExComment(pl.muscle, (exData as any).name || (exData as any).id, pl.role, pl.resolved as DayCharacter, exSets, Math.round(Math.min(pl.reps, repsCap)), Math.round(pl.weight * wPct * 10) / 10, isSubstituted ? Math.min(pl.rir + 1, 4) : pl.rir, weakPoints, focusGroup, phase, tempoSpec.notation, restSeconds, isSubstituted),
        warmupSets: buildWarmup(Math.round(pl.weight * wPct * 10) / 10, pl.role === 'primary'),
      });
    }
  }
  return { day: dayInRotation, weekOffset: 0, character, sessionTag: sched.sessionTag, exercises };
}

function todayStr(): string {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function buildBBPlan(input: BBBuilderInput, pedAdapt?: PEDAdaptation): BBPlan {
  const pattern = getPattern(input.patternId) || SPLIT_PATTERNS[0];
  const level = normLevel(input.level) as TrainingLevel;
  const workMax = input.workMax || {};
  const weakPoints = input.weakPoints || [];
  const focusGroup = input.focusGroup;
  const sessions = sessionsOf(pattern);
  const injuries = input.injuries || [];

  const today = todayStr();
  const excludedMuscles = getExcludedMuscles(injuries, today);
  const gradedInjuries = getGradedInjuries(injuries, today);
  // Общий пул травмированных мышц (для injuryProfile — передаётся в selectExercisesSmart)
  const injuredMuscles = new Set([...excludedMuscles, ...gradedInjuries.map(inj => inj.muscle)]);
  const injuryProfile = [...injuredMuscles];

  // Вычисляем dailyCap (max групп в день) для S-MRV-бюджета — по дедуплицированным каталог-группам (fix Z)
  const maxGroupsPerSession = Math.max(1, ...sessions.map(s => dedupeMuscles(s.sessionTag, excludedMuscles).length));
  const dailyCap = Math.max(10, Math.min(16, Math.round(8 + maxGroupsPerSession * 2)));

  // fix Z: muscleSessionCount ключом является collapseKey (delt heads→shoulders, остальные как есть)
  const muscleSessionCount: Record<string, number> = {};
  for (const s of sessions) for (const m of musclesForTag(s.sessionTag)) {
    const ck = collapseKey(m);
    if (!excludedMuscles.has(m)) muscleSessionCount[ck] = (muscleSessionCount[ck] || 0) + 1;
  }

  const muscleVolumeRotation: Record<string, number> = {};
  const mrvByMuscle: Record<string, number> = {};
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
      // fix D: истинный MRV — потолок для капа.
      // fix C: для отстающих/фокус-групп поднимаем потолок в такт объёмному
      // бусту (weak ×1.2, focus ×1.3), иначе normalizeWeekMrv стирает акцент.
      let capMrv = lm.mrv;
      if (isWeak(m, weakPoints)) capMrv = Math.round(capMrv * 1.2);
      if (focusGroup === m || (focusGroup && isWeak(m, [focusGroup]))) capMrv = Math.round(capMrv * 1.3);
      mrvByMuscle[m] = capMrv;
    }
  }

  // Фазовая периодизация (distributePhases) — ЕДИНЫЙ источник RIR/deload (fix A)
  const deloadFreq = input.weeks >= 6 ? 4 : 0;
  const phaseDist = distributePhases(input.weeks, deloadFreq, input.goal === 'strength_mass' ? 'mass' : (input.goal || 'mass'));
  const phaseByWeek = new Map<number, BBPhase>();
  for (const pd of phaseDist) phaseByWeek.set(pd.startWeek, pd.phase);
  const phaseWeekCounter: Record<string, number> = { accumulation: 0, intensification: 0, deload: 0, peaking: 0 };

  const weeks: BBWeek[] = [];
  for (let w = 1; w <= input.weeks; w++) {
    const musclePrimaryAssigned = new Set<string>(); // ← сбрасывается КАЖДУЮ неделю
    const weekSessions: BBSession[] = [];
    const phase = phaseByWeek.get(w) || 'accumulation';
    phaseWeekCounter[phase] = (phaseWeekCounter[phase] || 0) + 1;
    const phaseWeek = phaseWeekCounter[phase];
    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i];
      // fix Z: sessMuscles по collapseKey (delt heads→shoulders) для mrvByMuscle-lookup
      const sessMuscles = [...new Set(musclesForTag(s.sessionTag).map(m => collapseKey(m)))];
      const mrvRot = Math.max(12, ...sessMuscles.map(m => mrvByMuscle[m] || 0));
      const sess = buildSession(s, i + 1, w, muscleVolumeRotation, muscleSessionCount, musclePrimaryAssigned, workMax, weakPoints, focusGroup, pedAdapt, dailyCap, level, injuryProfile, new Set(injuryProfile), excludedMuscles, gradedInjuries, today, phase, phaseWeek, mrvRot);
      sess.weekOffset = (w - 1) * pattern.rotationDays + (i + 1);
      weekSessions.push(sess);
    }
    // fix D: капаем недельный объём каждой мышцы по её истинному MRV
    normalizeWeekMrv(weekSessions, mrvByMuscle);
    weeks.push({ week: w, sessions: weekSessions });
  }

  const rationale: string[] = [
    `Сплит «${pattern.name}» (${pattern.rotationDays}дн ротация, ${pattern.sessionsPerRotation} сессий)`,
    `Уровень ${level}, цель ${input.goal}, ${input.weeks} нед`,
    `Объём ${input.volumeGoal || 'MAV'}: ` + Object.entries(muscleVolumeRotation).map(([m, v]) => `${m}=${v}`).join(', '),
    `Специализация: ${focusGroup || 'нет'}`,
    `Фазовая периодизация (distributePhases): накопление → интенсификация${deloadFreq > 0 ? ' → разгрузка (deload)' : ''} (RIR по фазе + волна); вес = workMax×%1RM(RIR)`,
    `S-MRV: автоматический кап объёма на основе бюджета утомления сессии + потолок по MRV мышцы.`,
    ...(pedAdapt ? [`PED-адаптация: MRV×${pedAdapt.combinedMrvMultiplier.toFixed(2)}, восстановление×${pedAdapt.combinedRecoveryMultiplier.toFixed(2)}`] : []),
    ...(excludedMuscles.size > 0 ? [`Травмы: исключены ${[...excludedMuscles].join(', ')} — упражнения на эти группы не назначаются.`] : []),
    ...(gradedInjuries.length > 0 ? [`Градированные травмы: ${gradedInjuries.map(i => i.muscle).join(', ')} — упражнения заменены на безопасные альтернативы с пониженным весом/объёмом.`] : []),
  ];

  return { pattern, weeks, rotationMuscleVolume: muscleVolumeRotation, rationale };
}
