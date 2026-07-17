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
import { FORCE_HEAVY_GROUPS, getPair, resolveCharacter, TAG_MUSCLES, type DayCharacter, type MuscleSlot } from './bb-day-types';
import { getAllVolumeLandmarks, landmarksForRotation, normLevel, type TrainingLevel, type MuscleVolumeLandmarks } from '../volume-landmarks.engine';
import { tempoFor, REST_BY_CHARACTER, type TempoSpec } from './bb-tempo-rest';
import { EXERCISE_CATALOG } from '../../core/exercise-catalog';
import { selectExercisesSmart } from '../exercise-selector.engine';
import { trueMuscleOf, musclesForRole, derivePattern } from '../movement-pattern';
import { PCT_FOR_RIR, S_MRV_FACTOR } from '../rir-table';
import type { PEDAdaptation } from './bb-ped-adaptation.engine';
import type { Injury } from '../manual-plan-builder';
import { prescribeLoad, applyPostPhaseProcessing, type LoadStrategy, type IntensityTechnique, type DeloadType } from './bb-autocoach.engine';
import { getActiveInjuries, getExcludedMuscles, getGradedInjuries, getInjuryVolumeFactor } from '../manual-plan-builder';
import { findSubstitutions } from '../exercise-substitution.engine';
import { computeVolumeLandmarks, type VolumeLandmarkRow } from '../volume-landmarks.engine';
// Фазовая периодизация (distributePhases) — ЕДИНЫЙ источник RIR/фаз/deload для ББ-плана.
// Импорт distributePhases/getPhaseVolumeMult из UI-модуля намеренный: это каноническая
// реализация, которую использует и ручной конструктор (phase-periodization).
import { distributePhases, PHASE_CONFIGS, getPhaseVolumeMult, type BBPhase } from '../../ui/screens/TrainingScreen_parts/TrainingConstructor/phase-periodization';
import { loadSRPESessions } from '../../engines/pro/srpe-store';
import { acuteChronicRatio, toDailyLoads } from '../../engines/pro/training-load.engine';

// P7: приоритет equipment по фазе (формирует пропорцию compound/isolation/cable/machine из PHASE_CONFIGS)
export const PHASE_EQUIPMENT_PREF: Record<string, string[]> = {
  accumulation: ['cable', 'dumbbell', 'machine', 'barbell'],
  intensification: ['barbell', 'machine', 'dumbbell', 'cable'],
  peaking: ['barbell', 'machine', 'dumbbell', 'cable'],
  deload: ['cable', 'bodyweight', 'dumbbell', 'machine'],
};

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
  planStartWeek?: string;        // ISO-дата начала мезоцикла (неделя 1) — для per-week оценки травм (fix F)
  favoriteExercises?: string[];  // Любимые упражнения — +15 приоритет при отборе
  excludedExercises?: string[];  // Нелюбимые упражнения — полностью исключаются из пула
  avoidAxialLoad?: boolean;      // Убрать осевую нагрузку (присед/становая/жим стоя/гудморнинг)
  intensityTechnique?: IntensityTechnique; // П6: техника интенсивности для каждого primary
  autoDeload?: boolean;          // авто-делод по ACWR
  deloadType?: DeloadType;       // тип делода (pump/strength/rest)
  loadStrategy?: LoadStrategy;   // стратегия прогрессии нагрузки
  autoRegResult?: {              // результат авторегуляции (объём/вес/RIR)
    volumeMultiplier: number;
    topSetPctMultiplier: number;
    rirShift: number;
  };
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
  rationale?: string;       // PRO: почему выбрано именно это упражнение
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
  /** Volume-landmarks (MEV/MAV/MRV) по пиковой неделе — единый источник, как в PL/ручном. */
  volumeLandmarks?: VolumeLandmarkRow[];
}

/**
 * Агрегация объёма BB-плана по группам мышц и сравнение с volume-landmarks (MEV/MAV/MRV).
 * Берётся пиковая по суммарному объёму неделя (наиболее нагруженная) — «худший случай».
 * PRO-ключи мышц (delt_front/mid/rear и т.п.) коллапсируются к каноническому EN-ключу.
 */
export function getBBVolumeLandmarks(plan: BBPlan, level: string, pedMrvMult = 1): VolumeLandmarkRow[] {
  let peakIdx = 0, peakTotal = -1;
  const weekGroups: Record<number, Record<string, number>> = {};
  plan.weeks.forEach((wk, i) => {
    const g: Record<string, number> = {};
    for (const s of wk.sessions) for (const ex of s.exercises) {
      const ck = collapseKey(ex.muscle);
      g[ck] = (g[ck] || 0) + (ex.sets || 0);
    }
    weekGroups[i] = g;
    const total = Object.values(g).reduce((a, b) => a + b, 0);
    if (total > peakTotal) { peakTotal = total; peakIdx = i; }
  });
  const peak = weekGroups[peakIdx] || {};
  return computeVolumeLandmarks(peak, level, { labMult: pedMrvMult, peakWeek: peakIdx + 1 });
}

// sessionTag -> мышцы (канонические EN-ключи) — импортированы из bb-day-types (FIX-8, единый источник)

/** Для каких мышц в BB-контексте ВСЕГДА брать только изоляцию (нет compound аналогов). */
const ALWAYS_ISOLATION: Set<string> = new Set(['calves', 'forearms', 'abs']);
/** Маппинг PRO-мышц в group каталога для getExercisesByGroup(). */
const PRO_MUSCLE_TO_GROUP: Record<string, string> = {
  delt_front: 'shoulders', delt_mid: 'shoulders', delt_rear: 'shoulders',
  traps: 'back', calves: 'legs', glutes: 'legs', abs: 'core', forearms: 'arms',
  quads: 'legs', hamstrings: 'legs', biceps: 'arms', triceps: 'arms',
  chest: 'chest', back: 'back', shoulders: 'shoulders', legs: 'legs',
  arms: 'arms', core: 'core',
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
  delt_front: wm => (wm['shoulders'] || DEFAULT_WORKMAX['shoulders']) * 0.50,
  delt_mid:   wm => (wm['shoulders'] || DEFAULT_WORKMAX['shoulders']) * 0.45,
  delt_rear:  wm => (wm['shoulders'] || DEFAULT_WORKMAX['shoulders']) * 0.35,
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
 * Доля объёма мышцы на ОДНУ сессию (fix C + P5):
 * - 1 сессия/нед → вся цель на эту сессию, но cap MAV×1.3 (анти-перетрен).
 *   Раньше: 1.5× MAV → для chest=21 сет/день, что в 1.5 раза выше нормы для 1×/нед группы.
 *   Schoenfeld BJ et al. (2016, J Sports Sci): 1×/нед chest 12-16 сетов оптимум, >20 — нет данных.
 * - 2 сессии/нед → primary 1.4×, accessory 0.6× (сбалансировано).
 * - ≥3 сессии/нед → primary 1.5×, accessory 0.75× (compound щедро, изоляция 3-4×N).
 * Итоговый недельный объём дополнительно капается по MRV в normalizeWeekMrv.
 */
function sessionShareFor(mavRot: number, sessionsPerWeek: number, role: 'primary' | 'accessory'): number {
  if (sessionsPerWeek <= 1) {
    // P5: cap на 1×/нед — не более MAV×1.3. Иначе bro-split chest=25+ сетов.
    return Math.min(Math.round(mavRot), Math.round(mavRot * 1.3));
  }
  if (sessionsPerWeek === 2) {
    const base = mavRot / 2;
    const factor = role === 'primary' ? 1.4 : 0.6;
    return Math.max(1, Math.round(base * factor));
  }
  // 3+ сессии/нед
  const base = mavRot / sessionsPerWeek;
  const factor = role === 'primary' ? 1.5 : 0.75;
  return Math.max(1, Math.round(base * factor));
}

/** fix D: недельный кап объёма каждой мышцы по её истинному MRV (после всех множителей).
 *  + per-exercise кап: максимум 8 сетов на упражнение (ББ-практика). */
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
    // Per-exercise cap: не более 8 сетов на одно упражнение
    for (const ex of info.exs) {
      if (ex.sets > 8) ex.sets = 8;
    }
    // Пересчитать total после per-exercise капа
    info.total = info.exs.reduce((s, ex) => s + ex.sets, 0);
    // MRV-кап
    const cap = mrvByMuscle[m];
    if (cap && info.total > cap) {
      const factor = cap / info.total;
      for (const ex of info.exs) ex.sets = Math.max(1, Math.round(ex.sets * factor));
    }
  }
}

/** Предупреждения о рисках для конкретных упражнений. */
function exerciseRiskWarning(name: string): string {
  const n = (name || '').toLowerCase();
  if (n.includes('становая') || n.includes('мёртвая') || n.includes('мертвая'))
    return '⚠ Поясница: строгая техника, не круглить спину. При боли — заменить на гиперэкстензию.';
  if (n.includes('присед') && !n.includes('гантел') && !n.includes('гудмор'))
    return '⚠ Колени не выходят за носки, спина прямая. При дискомфорте — заменить на жим ногами.';
  if (n.includes('гудморнинг') || (n.includes('наклон') && n.includes('штанг')))
    return '⚠ Высокий риск поясницы. Спина прямая, колени чуть согнуты. Только для продвинутых.';
  if (n.includes('тяга') && n.includes('штанги') && n.includes('наклоне'))
    return '⚠ Поясница: держать спину прямой, не дёргать вес. При боли — заменить на тягу блока.';
  if (n.includes('жим') && (n.includes('стоя') || n.includes('сидя') || n.includes('армейский')))
    return '⚠ Плечевой сустав: не опускать гриф ниже подбородка. При боли — заменить на жим гантелей.';
  if (n.includes('французский') || (n.includes('разгиб') && n.includes('лёжа')))
    return '⚠ Локтевой сустав: не переразгибать. При боли — заменить на разгибания на блоке.';
  return '';
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
  const warn = exerciseRiskWarning(name);
  if (warn) parts.push(warn);
  return parts.join('. ');
}

/** Разминочная пирамида для compound упражнений. */
export function buildWarmup(workWeight: number, isCompound: boolean): { load: number; reps: number }[] {
  if (!isCompound || workWeight <= 0) return [];
  const steps = workWeight <= 60 ? 2 : workWeight <= 100 ? 3 : 4;
  const warmups: { load: number; reps: number }[] = [];
  for (let i = 1; i <= steps; i++) {
    const pct = 0.3 + (0.55 / steps) * i;
    warmups.push({ load: Math.round(workWeight * pct), reps: Math.min(8, 5 + i) });
  }
  return warmups;
}

// fix E: реалистичные значения workMax по умолчанию (кг) — используются,
// только если пользователь не ввёл свои рабочие максимумы. Убирает магический «80»
// и даёт осмысленные веса в сгенерированном плане даже без ввода.
export const DEFAULT_WORKMAX: Record<string, number> = {
  chest: 100, back: 120, shoulders: 70, arms: 50,
  quads: 140, hamstrings: 100, glutes: 150, calves: 90, abs: 80, traps: 90,
  delt_front: 70, delt_mid: 70, delt_rear: 70, forearms: 45,
};
export const defaultWorkMax = (key: string): number => DEFAULT_WORKMAX[collapseKey(key)] ?? DEFAULT_WORKMAX[key] ?? 80;

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
  preSelectedIds: string[] = [],
  preSelectedNames: string[] = [],
  rotationBlockIds: string[] = [],
  favoriteIds: string[] = [],
  excludeIds: string[] = [],
  avoidAxialLoad: boolean = false,
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
    rationaleMap: Map<string, string>;
    phaseEquip?: string[];
  }
  const plans: MusclePlan[] = [];
  let totalExpectedFatigue = 0;
  const sessionSelectedIds: string[] = [...preSelectedIds, ...rotationBlockIds];
  const sessionSelectedNames: string[] = [...preSelectedNames];
  
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
    // Какие мышцы являются "главными" для каждого тега сессии.
    // Остальные мышцы тега — добивочные (accessory), даже если тяж-день.
    // Это предотвращает: delt_front=primary в Chest-дне → блокирует Shoulders-день.
    const TAG_PRIMARY_MUSCLES: Record<string, Set<string>> = {
      Chest: new Set(['chest']),
      Back: new Set(['back']),
      Shoulders: new Set(['shoulders']),
      Arms: new Set(['biceps', 'triceps', 'forearms']),
      Legs: new Set(['quads', 'hamstrings', 'glutes', 'calves']),
      Push: new Set(['chest', 'shoulders', 'triceps']),
      Pull: new Set(['back', 'biceps', 'traps']),
      ChestBack: new Set(['chest', 'back']),
      ShouldersArms: new Set(['shoulders', 'biceps', 'triceps', 'forearms']),
      Upper: new Set(['chest', 'back', 'shoulders', 'biceps', 'triceps']),
      Lower: new Set(['quads', 'hamstrings', 'glutes', 'calves']),
      FullBody: new Set(['chest', 'back', 'quads', 'hamstrings', 'shoulders', 'arms']),
      Torso: new Set(['chest', 'back', 'shoulders']),
      Limbs: new Set(['quads', 'hamstrings', 'glutes', 'biceps', 'triceps', 'calves']),
      UpperPower: new Set(['chest', 'back', 'shoulders', 'biceps', 'triceps']),
      LowerPower: new Set(['quads', 'hamstrings', 'glutes', 'calves']),
      UpperHyp: new Set(['chest', 'back', 'shoulders', 'biceps', 'triceps']),
      LowerHyp: new Set(['quads', 'hamstrings', 'glutes', 'calves']),
      LegsBiceps: new Set(['quads', 'hamstrings', 'calves', 'biceps']),
    };
    const tagPrimaries = sched.sessionTag ? TAG_PRIMARY_MUSCLES[sched.sessionTag] : undefined;
    const isMainMuscle = !tagPrimaries || tagPrimaries.has(muscle);
    if (!musclePrimaryAssigned.has(muscle) && (resolved === 'тяж') && isMainMuscle) {
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
    // P1: reps/tempo/rest берутся из PHASE_CONFIGS[phase] — единый источник правды.
    // (Ранее дубль: buildSession ставил charReps → applyPostPhaseProcessing перезаписывал).
    const phaseCfg = PHASE_CONFIGS[phase];
    const isAccessory = role === 'accessory';
    const [baseMin, baseMax] = phaseCfg.repRange;
    // Базовые reps: primary = cfg.repRange; accessory = +2 к мин, +5 к макс (пампинг)
    const repMin = isAccessory ? baseMin + 2 : baseMin;
    const repMax = isAccessory ? baseMax + 5 : baseMax;
    const reps = Math.round((repMin + repMax) / 2);
    // RIR: bbRir (учитывает phase + phaseWeek + характер). Делод → RIR 3-4.
    const rir = bbRir(resolved, phase, phaseWeek);
    const wm = workMax[repKey] || PRO_WORKMAX_RATIO[repKey]?.(workMax) || defaultWorkMax(repKey);
    // P1: вес = workMax × phaseConfig.intensityMultiplier × PCT_FOR_RIR[rir]
    // intensityMultiplier уже включает понижение для делода (0.55) и пика (0.95).
    const pct = PCT_FOR_RIR[rir] ?? 0.9;
    let weight = Math.round(wm * phaseCfg.intensityMultiplier * pct * 10) / 10;
    const accessoryCount = ACCESSORY_2X_GROUPS.has(muscle) ? 2 : 1;
    const exerciseCount = role === 'primary'
      ? (['back', 'quads', 'chest', 'shoulders'].includes(muscle) ? 3 : 2)
      : accessoryCount;
    const selType = ALWAYS_ISOLATION.has(muscle) ? 'isolation' : (role === 'primary' ? 'compound' : 'isolation');
    // Корень фикса: пул строится по ИСТИННОЙ мышце упражнения (movementPattern +
    // targetMuscle), а не по композитной группе каталога. Это устраняет
    // неверную атрибуцию (leg curl → «calves», farmer walk → «biceps»,
    // good morning → «quads») и исключает ПЛ-движения (carry/hinge/становая).
    const roleMuscles = musclesForRole(repKey);
    let pool = EXERCISE_CATALOG.filter((ex: any) => {
      const tm = trueMuscleOf(ex);
      return tm !== null && roleMuscles.includes(tm);
    });
    // Фильтр по контексту сессии (доп. страховка, в основном инертен после
    // фильтрации по истинной мышце)
    const tag = (sched.sessionTag || '').toLowerCase();
    pool = pool.filter(ex => {
      const n = (ex.name || '').toLowerCase();
      if (tag.includes('push') || tag === 'chest' || tag === 'shoulders') {
        if (n.includes('тяга')||n.includes('становая')||n.includes('мёртвая')||n.includes('гиперэкстенз')||n.includes('фермер')||n.includes('carry')) return false;
      }
      if (tag.includes('pull') || tag === 'back') {
        if (n.includes('жим')&&!n.includes('ногами')||n.includes('press')||n.includes('разгиб')||n.includes('extension')) return false;
      }
      if (tag === 'legs' || tag === 'lower') {
        if (n.includes('жим')&&!n.includes('ногами')||n.includes('тяга')||n.includes('подтяг')||n.includes('бицепс')||n.includes('трицепс')) return false;
      }
      return true;
    });
    // Если после фильтра пул опустел — fallback на тот же истинный-мышечный пул
    if (pool.length === 0) pool = EXERCISE_CATALOG.filter((ex: any) => {
      const tm = trueMuscleOf(ex);
      return tm !== null && roleMuscles.includes(tm);
    });
    const selected = selectExercisesSmart({
      candidates: pool, muscleGroup: muscle, count: exerciseCount,
      selectedIds: sessionSelectedIds, selectedNames: sessionSelectedNames,
      equipment: [], weakZones: weakPoints, level, injuryProfile, type: selType,
      targetRir: rir,
      preferBB: true,
      favoriteIds, excludeIds,
      avoidAxialLoad,
      // P7: equipment приоритезируется по фазе (cable для accumulation, barbell для peaking)
      preferEquipment: PHASE_EQUIPMENT_PREF[phase],
    });
    for (const s of selected) { if (s && s.id) sessionSelectedIds.push(s.id); if (s && s.name) sessionSelectedNames.push(s.name); }
    let exDatas = selected.length > 0 ? selected : [pool[0] || { id: muscle, name: muscle, fatigueCost: 5 }];
    // Сохраняем rationale выбора для каждого упражнения
    const rationaleMap = new Map<string, string>();
    for (const s of selected) {
      if (s.selectionRationale?.length) rationaleMap.set(s.name, s.selectionRationale.join('; '));
    }

    // Shoulders diversity: принудительно 1 жим (front) + 1 махи (mid) + 1 задняя (rear)
    if (muscle === 'shoulders' && exerciseCount >= 3 && pool.length >= 3) {
      const isPress = (e: any) => /жим|press|армей|overhead/i.test(e.name || '');
      const isLateral = (e: any) => /мах|подъем|отведение|lateral|raise|side/i.test(e.name || '');
      const isRear = (e: any) => /наклон|rear|тяга.*лиц|face.*pull|бабочка/i.test(e.name || '');
      const presses = pool.filter(e => isPress(e) && !isLateral(e) && !isRear(e));
      const laterals = pool.filter(e => isLateral(e) && !isPress(e) && !isRear(e));
      const rears = pool.filter(e => isRear(e) && !isPress(e) && !isLateral(e));
      const diverse: any[] = [];
      if (presses.length > 0) diverse.push(presses[0]);
      if (laterals.length > 0) diverse.push(laterals[0]);
      if (rears.length > 0) diverse.push(rears[0]);
      // Добрать до exerciseCount если не хватило
      for (const e of pool) {
        if (diverse.length >= exerciseCount) break;
        if (!diverse.some(d => d.id === e.id)) diverse.push(e);
      }
      if (diverse.length >= exerciseCount) {
        exDatas = diverse.slice(0, exerciseCount);
        // P4: дифференцируем рабочий вес по пучкам дельты (жим тяжелее махов/задней дельты).
        // PRO_WORKMAX_RATIO: delt_front 0.50, delt_mid 0.45, delt_rear 0.35 →
        // относительно delt_front: головной коэффициент 1.0 / 0.9 / 0.7.
        // P5: дифференцируем RIR — жим тяж (базовый RIR), махи/задняя дельта памп (RIR+1).
        for (const d of exDatas) {
          let headRatio = 1.0, headRirDelta = 0;
          if (isPress(d) && !isLateral(d) && !isRear(d)) { headRatio = 1.0; headRirDelta = 0; }
          else if (isLateral(d) && !isPress(d) && !isRear(d)) { headRatio = 0.9; headRirDelta = 1; }
          else if (isRear(d) && !isPress(d) && !isLateral(d)) { headRatio = 0.7; headRirDelta = 1; }
          (d as any)._effWeight = Math.round(weight * headRatio * 10) / 10;
          (d as any)._deltRir = Math.min(5, rir + headRirDelta);
        }
      }
    }

    // P9: diversity для chest, back, quads, hamstrings, glutes — разные паттерны/углы.
    // Без этого для chest=3 получаем «жим штанги / жим гантелей / жим гантелей на наклонной» — 2 жима подряд.
    // Логика: 1 horizontal_compound + 1 vertical/angle + 1 isolation/cable.
    if (exerciseCount >= 2 && pool.length >= 2 && muscle !== 'shoulders') {
      const isChest = muscle === 'chest';
      const isBack = muscle === 'back';
      const isQuads = muscle === 'quads';
      const isHam = muscle === 'hamstrings';
      const isGlutes = muscle === 'glutes';
      const isCalves = muscle === 'calves';
      const isArms = muscle === 'arms' || muscle === 'biceps' || muscle === 'triceps';
      if (isChest || isBack || isQuads || isHam || isGlutes || isCalves || isArms) {
        // Классификаторы упражнений
        const isPress = (e: any) => /(жим|press|жимов)/i.test(e.name || '');
        const isRow = (e: any) => /(тяга|row)/i.test(e.name || '');
        const isSquat = (e: any) => /(присед|squat|жим.*ног|hack|leg.*press|выпад|болгар)/i.test(e.name || '');
        const isHinge = (e: any) => /(станов|мёртв|рум|good.?morning|hip.?thrust|ягодичн.*мост)/i.test(e.name || '');
        const isCurl = (e: any) => /(сгибан|curl)/i.test(e.name || '');
        const isExtension = (e: any) => /(разгибан|extension)/i.test(e.name || '');
        const isFlyOrLateral = (e: any) => /(развод|fly|crossover|бабоч|кроссов|отвед|lateral|raise)/i.test(e.name || '');
        const isPullupOrPulldown = (e: any) => /(подтяг|тяга.*верх|pull.?up|lat.?pull.?down|верх)/i.test(e.name || '');
        const isCable = (e: any) => /(блок|кроссов|кабель|cable)/i.test(e.name || '');

        let primaryType: (e: any) => boolean;
        let secondaryType: (e: any) => boolean;
        if (isChest) { primaryType = isPress; secondaryType = isFlyOrLateral; }
        else if (isBack) { primaryType = isRow; secondaryType = isPullupOrPulldown; }
        else if (isQuads) { primaryType = isSquat; secondaryType = isExtension; }
        else if (isHam) { primaryType = isHinge; secondaryType = isCurl; }
        else if (isGlutes) { primaryType = isHinge; secondaryType = isSquat; }
        else if (isCalves) { primaryType = (e: any) => /(подъем.*носк|calf)/i.test(e.name || ''); secondaryType = isCable; }
        else { primaryType = isCurl; secondaryType = isExtension; }

        const primaries = pool.filter(e => primaryType(e));
        const secondaries = pool.filter(e => secondaryType(e) && !primaryType(e));
        const others = pool.filter(e => !primaryType(e) && !secondaryType(e));
        const diverse: any[] = [];
        if (primaries.length > 0) diverse.push(primaries[0]);
        if (secondaries.length > 0) diverse.push(secondaries[0]);
        // Добрать до exerciseCount из others
        for (const e of [...primaries.slice(1), ...secondaries.slice(1), ...others]) {
          if (diverse.length >= exerciseCount) break;
          if (!diverse.some(d => d.id === e.id)) diverse.push(e);
        }
        if (diverse.length >= Math.min(2, exerciseCount)) {
          exDatas = diverse.slice(0, exerciseCount);
        }
      }
    }

    // Per-exercise weight modifier (гантели 80%, наклон 85%, блок 70% etc.)
    function weightModFor(exName: string): number {
      const n = (exName || '').toLowerCase();
      if (n.includes('гантел') || n.includes('dumbbell')) return 0.80;
      if (n.includes('наклон') || n.includes('incline')) return 0.85;
      if (n.includes('смит') || n.includes('smith')) return 0.90;
      if (n.includes('трен') || n.includes('машин') || n.includes('machine')) return 0.75;
      if (n.includes('блок') || n.includes('кабель') || n.includes('cable') || n.includes('кроссов')) return 0.70;
      return 1.0;
    }
    for (const d of exDatas) (d as any)._weightMod = weightModFor((d as any).name || '');

    // P1: DUP-волна повторений внутри фазы (недельная вариация).
    // Ранние недели фазы → больше повторений (метаболический стресс),
    // поздние → меньше (механическое натяжение). Аналог getDupReps в phase-periodization.
    const dupRepsOffset = phaseCfg && phaseWeek > 1 ? -Math.floor((phaseWeek - 1) * 1.5) : 0;
    const adjReps = Math.max(repMin, Math.min(repMax, reps + dupRepsOffset));

    // P7: phaseExerciseMix — приоритет equipment по фазе (accumulation→cable, peaking→barbell).
    // Это формирует пропорцию compound/isolation/cable/machine, заявленную в PHASE_CONFIGS.
    const phaseEquip = PHASE_EQUIPMENT_PREF[phase] || ['barbell', 'dumbbell', 'machine', 'cable'];

    const expectedFatigue = exerciseCount * (sets / exerciseCount) * (((exDatas[0] as any)?.fatigueCost || 5));
    totalExpectedFatigue += expectedFatigue;
    plans.push({ muscle, resolved, role, sets, exerciseCount, rir, reps, weight, pool, exDatas, selType, rationaleMap, phaseEquip });
  }

  // Apply substitution for graded injuries: replace exercises and adjust loads
  for (const pl of plans) {
    const phaseCfg = PHASE_CONFIGS[phase];
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
      // Кроме того, снижаем число упражнений на травмированной группе на 1
      // (реальная разгрузка, а не только вес/объём каждого упражнения).
      const injuredExCount = Math.max(1, pl.exerciseCount - 1);
      pl.exDatas = newExDatas.slice(0, injuredExCount);
    }
  }

  // Process each muscle with proportional budget
  for (const pl of plans) {
    const phaseCfg = PHASE_CONFIGS[phase];
    const [adjMin, adjMax] = phaseCfg.repRange;
    const adjReps = phase === 'peaking' && phaseWeek > 1
      ? Math.max(adjMin, Math.round((adjMin + adjMax) / 2) - Math.floor((phaseWeek - 1) * 1.5))
      : Math.round((adjMin + adjMax) / 2);
    const isAcc = pl.role === 'accessory';
    const repMin = isAcc ? adjMin + 2 : adjMin;
    const repMax = isAcc ? adjMax + 5 : adjMax;
    const muscleBudget = totalExpectedFatigue > 0
      ? Math.floor(dayFatigueBudget * pl.exerciseCount * Math.max(1, Math.round(pl.sets / pl.exerciseCount)) * ((pl.exDatas[0] as any)?.fatigueCost || 5) / totalExpectedFatigue)
      : Math.floor(dayFatigueBudget / Math.max(1, plans.length));
    // Solo-дни (1-2 мышцы): 90% бюджета; multi-дни: 50% (анти-хогинг)
    const budgetCapPct = plans.length <= 2 ? 0.90 : 0.50;
    let remainingBudget = Math.max(1, Math.min(muscleBudget, Math.floor(dayFatigueBudget * budgetCapPct)));
    
    for (const exData of pl.exDatas) {
      const wPct = (exData as any).substitutionWeightPct ?? 1.0;
      const vPct = (exData as any).substitutionVolumePct ?? 1.0;
      const isSubstituted = (exData as any).substituted === true;
      const repsCap = (exData as any).repsCap ?? 20;
      const exSets = Math.max(1, Math.round(Math.round(pl.sets / pl.exDatas.length) * vPct));
      const exWeight = (exData as any)._effWeight ?? pl.weight;
      const finalRir = isSubstituted ? Math.min(pl.rir + 1, 4) : ((exData as any)._deltRir ?? pl.rir);
      const cost = ((exData as any)?.fatigueCost || 5) * exSets;
      // P1: tempo/rest/reps берутся из PHASE_CONFIGS[phase] (не charReps/REST_BY_CHARACTER).
      // Accessory получает чуть меньше отдыха (минус 30с), primary — базу.
      const tempoStr = phaseCfg.tempo;
      const baseRest = phaseCfg.restBase;
      const exRest = pl.role === 'accessory' ? Math.max(45, baseRest - 30) : baseRest;
      if (remainingBudget < cost) {
        const reduced = Math.max(2, Math.floor(remainingBudget / ((exData as any)?.fatigueCost || 5)));
        const adjustedSets = Math.min(exSets, reduced);
        const adjCost = ((exData as any)?.fatigueCost || 5) * adjustedSets;
        remainingBudget -= adjCost;
        const workSets: BBSet[] = Array.from({ length: adjustedSets }, () => ({
          reps: Math.min(adjReps, repsCap), rir: finalRir,
          weight: Math.round(exWeight * wPct * ((exData as any)._weightMod || 1) * 10) / 10,
          tempo: tempoStr, restSeconds: exRest,
        }));
        exercises.push({
          muscle: trueMuscleOf(exData) || pl.muscle, name: (exData as any).name || (exData as any).id, role: pl.role, character: pl.resolved as DayCharacter,
          sets: adjustedSets, repsRange: [Math.min(Math.max(repMin, adjReps - 2), repsCap), Math.min(repMax, repsCap)],
          rir: finalRir,
          workSets, exerciseName: (exData as any).name || (exData as any).id,
          tempoSpec: tempoStr, restSeconds: exRest,
          comment: buildExComment(pl.muscle, (exData as any).name || (exData as any).id, pl.role, pl.resolved as DayCharacter, adjustedSets, Math.min(adjReps, repsCap), Math.round(exWeight * wPct * ((exData as any)._weightMod || 1) * 10) / 10, finalRir, weakPoints, focusGroup, phase, tempoStr, exRest, isSubstituted),
          warmupSets: buildWarmup(Math.round(exWeight * wPct * ((exData as any)._weightMod || 1) * 10) / 10, pl.role === 'primary'),
          rationale: pl.rationaleMap.get((exData as any).name) || '',
        });
        continue;
      }
      remainingBudget -= cost;
      const workSets: BBSet[] = Array.from({ length: exSets }, () => ({
        reps: Math.min(adjReps, repsCap), rir: finalRir,
        weight: Math.round(exWeight * wPct * ((exData as any)._weightMod || 1) * 10) / 10,
        tempo: tempoStr, restSeconds: exRest,
      }));
      exercises.push({
        muscle: pl.muscle, name: (exData as any).name || (exData as any).id, role: pl.role, character: pl.resolved as DayCharacter,
        sets: exSets, repsRange: [Math.min(Math.max(repMin, adjReps - 2), repsCap), Math.min(repMax, repsCap)],
        rir: finalRir,
        workSets, exerciseName: (exData as any).name || (exData as any).id,
        tempoSpec: tempoStr, restSeconds: exRest,
        comment: buildExComment(pl.muscle, (exData as any).name || (exData as any).id, pl.role, pl.resolved as DayCharacter, exSets, Math.min(adjReps, repsCap), Math.round(exWeight * wPct * ((exData as any)._weightMod || 1) * 10) / 10, finalRir, weakPoints, focusGroup, phase, tempoStr, exRest, isSubstituted),
        warmupSets: buildWarmup(Math.round(exWeight * wPct * ((exData as any)._weightMod || 1) * 10) / 10, pl.role === 'primary'),
        rationale: pl.rationaleMap.get((exData as any).name) || '',
      });
    }
  }
  // Кап упражнений в сессии: максимум 10 (реалистичная тренировка)
  if (exercises.length > 10) {
    // Сохраняем primary (первые 8), обрезаем accessory
    const kept = exercises.filter(e => e.role === 'primary').slice(0, 8);
    const acc = exercises.filter(e => e.role === 'accessory');
    const maxAcc = Math.max(0, 10 - kept.length);
    exercises.length = 0;
    exercises.push(...kept, ...acc.slice(0, maxAcc));
  }
  return { day: dayInRotation, weekOffset: 0, character, sessionTag: sched.sessionTag, exercises };
}

function todayStr(): string {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/** Сдвинуть ISO-дату на N дней (fix F: per-week оценка травм). */
function addDaysISO(from: string, days: number): string {
  const d = new Date(from + 'T00:00:00');
  if (isNaN(d.getTime())) return todayStr();
  d.setDate(d.getDate() + days);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// fix N: реальный auto-deload по ACWR. Читаем sRPE-сессии пользователя и вычисляем
// acute:chronic ratio. При перетренированности (ratio > 1.5) разгрузочные недели
// назначаются чаще, а в коротких планах (≥3 нед) — гарантированно появляется deload.
function computeAcwr(): number {
  try {
    const sessions = loadSRPESessions();
    if (!sessions || sessions.length < 2) return 1;
    const daily = toDailyLoads(sessions as any);
    const r = acuteChronicRatio(daily);
    return r && isFinite(r.ratio) ? r.ratio : 1;
  } catch {
    return 1;
  }
}

export function buildBBPlan(input: BBBuilderInput, pedAdapt?: PEDAdaptation): BBPlan {
  const pattern = getPattern(input.patternId) || SPLIT_PATTERNS[0];
  const level = normLevel(input.level) as TrainingLevel;
  const workMax = input.workMax || {};
  const weakPoints = input.weakPoints || [];
  const focusGroup = input.focusGroup;
  const sessions = sessionsOf(pattern);
  const injuries = input.injuries || [];
  const favIds = input.favoriteExercises || [];
  const exclIds = input.excludedExercises || [];
  const avAxial = input.avoidAxialLoad || false;

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
      if (input.goal === 'cut') v = Math.round(v * 0.75);  // дефицит калорий → восстановление ↓25%, объём соответственно
      if (input.goal === 'mass' || input.goal === 'strength_mass') v = Math.round(v * 1.1);
      // PED-адаптация: увеличиваем целевой объём пропорционально MRV-множителю
      v = Math.round(v * (pedAdapt?.combinedMrvMultiplier ?? 1));
      muscleVolumeRotation[m] = v;
      // fix D: истинный MRV — потолок для капа.
      // fix C: для отстающих/фокус-групп поднимаем потолок в такт объёмному
      // бусту (weak ×1.2, focus ×1.3), иначе normalizeWeekMrv стирает акцент.
      // PED: базовый MRV умножается на combinedMrvMultiplier ДО корректировок
      let capMrv = Math.round(lm.mrv * (pedAdapt?.combinedMrvMultiplier ?? 1));
      if (isWeak(m, weakPoints)) capMrv = Math.round(capMrv * 1.2);
      if (focusGroup === m || (focusGroup && isWeak(m, [focusGroup]))) capMrv = Math.round(capMrv * 1.3);
      mrvByMuscle[m] = capMrv;
    }
  }

  // Фазовая периодизация (distributePhases) — ЕДИНЫЙ источник RIR/deload (fix A)
  // fix N: deload-частота зависит от реальной нагрузки (ACWR). При ratio>1.5 —
  // учащаем разгрузку (каждые 3 нед) и гарантируем deload даже в коротких планах (≥3 нед).
  // P2: для планов 4-5 нед — последняя неделя = делод (4-нед план без разгрузки = перетрен).
  // Для ≥6 нед — стандартная частота каждые 4 нед.
  // Для <4 нед — делода нет (слишком короткий цикл).
  const acwrRatio = computeAcwr();
  let deloadFreq = 0;
  let forceFinalDeload = false;
  if (input.weeks >= 6) {
    deloadFreq = 4;
  } else if (input.weeks >= 4) {
    forceFinalDeload = true;
  }
  if (acwrRatio > 1.5 && input.weeks >= 3) {
    deloadFreq = Math.max(1, Math.min(deloadFreq || 3, 3));
  }
  const phaseDist = distributePhases(input.weeks, deloadFreq, input.goal === 'strength_mass' ? 'mass' : (input.goal || 'mass'));
  // P2: принудительный финальный делод для 4-5 нед планов (через замену последней недели)
  if (forceFinalDeload && input.weeks >= 4) {
    const lastIdx = phaseDist.findIndex(pd => pd.startWeek === input.weeks);
    if (lastIdx >= 0) {
      phaseDist[lastIdx] = { phase: 'deload', startWeek: input.weeks, endWeek: input.weeks, weeks: [input.weeks], config: PHASE_CONFIGS.deload };
    }
  }
  const phaseByWeek = new Map<number, BBPhase>();
  for (const pd of phaseDist) phaseByWeek.set(pd.startWeek, pd.phase);
  const phaseWeekCounter: Record<string, number> = { accumulation: 0, intensification: 0, deload: 0, peaking: 0 };

  const weeks: BBWeek[] = [];
  // FIX-1: Ротация упражнений — каждые ROTATION_INTERVAL недель сбрасываем пул использованных ID,
  // чтобы selectExercisesSmart выбирал свежие упражнения (предотвращает аккомодацию).
  const ROTATION_INTERVAL = 4;
  const rotationUsedByMuscle = new Map<string, string[]>(); // muscle → [exerciseName, ...]
  // fix L: паттерны движений, уже задействованные для отстающих групп внутри текущей недели.
  // Сбрасывается каждую неделю; позволяет не повторять один и тот же паттерн на разных днях.
  const weekWeakPatterns = new Map<string, Set<string>>(); // weakMuscle → Set<pattern>

  for (let w = 1; w <= input.weeks; w++) {
    // Сброс ротации каждые ROTATION_INTERVAL недель (новая фаза → свежий пул)
    if (w > 1 && (w - 1) % ROTATION_INTERVAL === 0) {
      rotationUsedByMuscle.clear();
    }
    // fix L: паттерны отстающих групп сбрасываются раз в неделю (свежий выбор движений)
    weekWeakPatterns.clear();
    const musclePrimaryAssigned = new Set<string>(); // ← сбрасывается КАЖДУЮ неделю
    const weekSessions: BBSession[] = [];
    const phase = phaseByWeek.get(w) || 'accumulation';
    phaseWeekCounter[phase] = (phaseWeekCounter[phase] || 0) + 1;
    const phaseWeek = phaseWeekCounter[phase];
    // FB-ротация: запрещаем повтор упражнений между днями
    const fbUsedIds: string[] = [];
    const fbUsedNames: string[] = [];
    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i];
      // FullBody: распределяем primary равномерно по дням (fix #3)
      // День 1: грудь+спина primary, день 2: ноги primary, день 3: плечи+руки primary
      const isFB = s.sessionTag === 'FullBody';
      if (isFB) {
        const fbSchedule = [
          ['chest', 'back'],
          ['quads', 'hamstrings'],
          ['shoulders', 'arms'],
        ];
        const fbPrimary = fbSchedule[i % fbSchedule.length];
        // Блокируем все мышцы, кроме назначенных на этот день
        const allFbMuscles = (musclesForTag('FullBody') || []).map(m => collapseKey(m));
        for (const m of allFbMuscles) {
          if (!fbPrimary.includes(m)) musclePrimaryAssigned.add(m);
        }
      }
      // fix Z: sessMuscles по collapseKey (delt heads→shoulders) для mrvByMuscle-lookup
      const sessMuscles = [...new Set(musclesForTag(s.sessionTag).map(m => collapseKey(m)))];
      // Ротация: собираем ID упражнений, использованных ранее для этих мышц
      const rotationIds: string[] = [];
      for (const m of sessMuscles) {
        const prevIds = rotationUsedByMuscle.get(m) || [];
        rotationIds.push(...prevIds);
      }
      // Solo-дни (1-2 группы мышц): увеличиваем бюджет на 50% — вся энергия дня идёт на эти мышцы
      // fix I: фазовая модуляция объёма — deload/peak реально снижают число сетов (не только RIR).
      // Бюджет сессии масштабируется по volumeMultiplier фазы (PHASE_CONFIGS), MRV-потолок не трогаем.
      const phaseVol = PHASE_CONFIGS[phase]?.volumeMultiplier ?? 1.0;
      const sessDailyCap = Math.round((sessMuscles.length <= 2 ? dailyCap * 1.5 : dailyCap) * phaseVol);
      const mrvRot = Math.max(12, ...sessMuscles.map(m => mrvByMuscle[m] || 0));
      // fix F: per-week оценка травм относительно даты недели (а не только «сегодня»).
      // Травма с from > даты недели ещё неактивна; травма с to < даты недели уже зажила.
      const weekDate = input.planStartWeek ? addDaysISO(input.planStartWeek, (w - 1) * 7) : today;
      const weekExcluded = getExcludedMuscles(injuries, weekDate);
      const weekGraded = getGradedInjuries(injuries, weekDate);
      const weekInjuryProfile = [...new Set([...weekExcluded, ...weekGraded.map(inj => inj.muscle)])];
      const sess = buildSession(s, i + 1, w, muscleVolumeRotation, muscleSessionCount, musclePrimaryAssigned, workMax, weakPoints, focusGroup, pedAdapt, sessDailyCap, level, weekInjuryProfile, new Set(weekInjuryProfile), weekExcluded, weekGraded, weekDate, phase, phaseWeek, mrvRot, isFB ? fbUsedIds : [], isFB ? fbUsedNames : [], rotationIds, favIds, exclIds, avAxial);
      sess.weekOffset = (w - 1) * pattern.rotationDays + (i + 1);
      // FB: собираем ID и имена упражнений для запрета повторов
      if (isFB) for (const ex of sess.exercises) {
        if (ex.exerciseName) { fbUsedIds.push(ex.exerciseName); fbUsedNames.push(ex.exerciseName); }
      }
      // Ротация: запоминаем использованные упражнения для следующих недель
      for (const ex of sess.exercises) {
        const m = collapseKey(ex.muscle);
        if (!rotationUsedByMuscle.has(m)) rotationUsedByMuscle.set(m, []);
        const arr = rotationUsedByMuscle.get(m)!;
        if (ex.exerciseName && !arr.includes(ex.exerciseName)) arr.push(ex.exerciseName);
      }
      // fix L: фиксируем паттерны основных упражнений отстающих групп этой недели,
      // чтобы фидер-сеты (fix J) и добивки не повторяли тот же паттерн движения.
      for (const ex of sess.exercises) {
        const exm = collapseKey(ex.muscle);
        if (isWeak(exm, weakPoints) && !Array.from(weekExcluded).includes(exm)) {
          const cat = (EXERCISE_CATALOG as any[]).find((c: any) => c.name === ex.exerciseName);
          if (cat) {
            if (!weekWeakPatterns.has(exm)) weekWeakPatterns.set(exm, new Set());
            weekWeakPatterns.get(exm)!.add(derivePattern(cat));
          }
        }
      }
      // fix J: фидер-сеты для отстающих групп — изоляция высоким повторением (grease-the-groove
      // финишер) в дни, где слабая группа уже тренируется. Добивочное кровенаполнение без роста fatigue.
      const addedFeeders = new Set<string>();
      for (const wm of sessMuscles) {
        if (!isWeak(wm, weakPoints)) continue;
        if (Array.from(weekExcluded).includes(wm)) continue;
        if (addedFeeders.has(wm)) continue;
        // Точное совпадение по сырому muscle (или collapseKey) + изоляция: исключаем
        // «чужие» тяговые движения, ошибочно помеченные как эта группа.
        const feederPool = (EXERCISE_CATALOG as any[]).filter((e: any) => {
          const raw = e.muscle;
          const mg = collapseKey(trueMuscleOf(e) || raw);
          return (raw === wm || mg === wm) && (e.exerciseType === 'isolation' || e.type === 'isolation');
        });
        if (!feederPool.length) continue;
        // fix L: паттерны, уже использованные для этой отстающей группы на текущей неделе.
        if (!weekWeakPatterns.has(wm)) weekWeakPatterns.set(wm, new Set());
        const usedPatterns = weekWeakPatterns.get(wm)!;
        // Ранжируем: приоритет — изоляции именно этой группы (плечо/грудь/спина...),
        // штраф — «чужие» тяговые движения, ошибочно помеченные как эта группа,
        // и — критично — повтор уже задействованного паттерна внутри недели (fix L).
        const scoreFeeder = (e: any): number => {
          const nm = (e.name || '').toLowerCase();
          let s = 0;
          if (/(плеч|дельт|латерал|отвод|мах|развод|fly|raise|lateral|rear|face ?pull|передняя|задняя)/.test(nm)) s += 3;
          if (/(тяга|pull|row|наклон|присед|жим|станов|отжим)/.test(nm)) s -= 3;
          if (e.exerciseType === 'isolation' || e.type === 'isolation') s += 1;
          if (usedPatterns.has(derivePattern(e))) s -= 100;
          return s;
        };
        feederPool.sort((a, b) => scoreFeeder(b) - scoreFeeder(a));
        const fData: any = feederPool[0];
        if (!fData) continue;
        const fName = fData.name || fData.id;
        // Дедуп: не добавлять, если такое упражнение уже есть в дне (основное или фидер)
        if (sess.exercises.some(e => e.exerciseName === fName) || addedFeeders.has(fName)) continue;
        const fBase = (workMax as any)[wm] || DEFAULT_WORKMAX[wm] || 50;
        const feederWeight = Math.max(5, Math.round(fBase * 0.3 * 10) / 10);
        const fTempo = tempoFor('памп');
        sess.exercises.push({
          muscle: wm, name: fName, role: 'accessory' as const, character: 'памп' as DayCharacter,
          sets: 1, repsRange: [15, 20] as [number, number], rir: 2,
          workSets: [{ reps: 18, rir: 2, weight: feederWeight, tempo: fTempo.notation, restSeconds: 30 }],
          exerciseName: fName, tempoSpec: fTempo.notation, restSeconds: 30,
          comment: `Фидер-сет (grease-the-groove) для отстающей группы ${wm}: изоляция 18×1, ~30% рабочего веса, пампинг.`,
          warmupSets: [], rationale: 'Акцент на отстающую группу: добивочный кровенаполнительный сет в конце дня.',
        });
        addedFeeders.add(wm);
        addedFeeders.add(fName);
        usedPatterns.add(derivePattern(fData));
      }
      // fix K: памп-финишер для первичных групп, у которых день — толко «тяж» (без метаболического стресса).
      // bro-split (1 группа/день) иначе = только тяжёлые сеты. Добавляем 1 изоляцию высоким повторением.
      for (const pm of sessMuscles) {
        if (isWeak(pm, weakPoints)) continue;
        if (Array.from(weekExcluded).includes(pm)) continue;
        if (sess.exercises.some(e => (e.muscle === pm || collapseKey(e.muscle) === pm) && (e as any).character === 'памп')) continue;
        const pumpPool = (EXERCISE_CATALOG as any[]).filter((e: any) => {
          const raw = e.muscle;
          const mg = collapseKey(trueMuscleOf(e) || raw);
          return (raw === pm || mg === pm) && (e.exerciseType === 'isolation' || e.type === 'isolation');
        });
        if (!pumpPool.length) continue;
        pumpPool.sort((a: any, b: any) => {
          const na = (a.name || '').toLowerCase(), nb = (b.name || '').toLowerCase();
          let sa = 0, sb = 0;
          if (/(плеч|дельт|латерал|отвод|мах|развод|fly|raise|lateral|rear|face ?pull|передняя|задняя)/.test(na)) sa += 3;
          if (/(тяга|pull|row|наклон|присед|жим|станов|отжим)/.test(na)) sa -= 3;
          if (/(плеч|дельт|латерал|отвод|мах|развод|fly|raise|lateral|rear|face ?pull|передняя|задняя)/.test(nb)) sb += 3;
          if (/(тяга|pull|row|наклон|присед|жим|станов|отжим)/.test(nb)) sb -= 3;
          return sb - sa;
        });
        const pData: any = pumpPool[0];
        if (!pData) continue;
        const pName = pData.name || pData.id;
        if (sess.exercises.some(e => e.exerciseName === pName) || addedFeeders.has(pName)) continue;
        const pBase = (workMax as any)[pm] || DEFAULT_WORKMAX[pm] || 50;
        const pumpWeight = Math.max(5, Math.round(pBase * 0.3 * 10) / 10);
        const pTempo = tempoFor('памп');
        sess.exercises.push({
          muscle: pm, name: pName, role: 'accessory' as const, character: 'памп' as DayCharacter,
          sets: 1, repsRange: [15, 20] as [number, number], rir: 2,
          workSets: [{ reps: 18, rir: 2, weight: pumpWeight, tempo: pTempo.notation, restSeconds: 30 }],
          exerciseName: pName, tempoSpec: pTempo.notation, restSeconds: 30,
          comment: `Памп-финишер для ${pm}: изоляция 18×1, ~30% рабочего веса, метаболический стресс в конце тяжёлого дня.`,
          warmupSets: [], rationale: 'Баланс тяж/памп: добивочный high-rep сет для гипертрофии.',
        });
        addedFeeders.add(pm);
        addedFeeders.add(pName);
      }
      weekSessions.push(sess);
    }
    // fix D: капаем недельный объём каждой мышцы по её истинному MRV
    normalizeWeekMrv(weekSessions, mrvByMuscle);
    weeks.push({ week: w, sessions: weekSessions });
  }

  // FIX-2: Прогрессия весов (double_progression) — реальный прогресс от недели к неделе.
  // До fix веса менялись ТОЛЬКО от сжатия RIR (3→0 = +14% за 8 нед), без истинной перегрузки.
  // Теперь каждая следующая неделя берёт вес предыдущей и применяет prescribeLoad.
  for (let wi = 1; wi < weeks.length; wi++) {
    const prevWeek = weeks[wi - 1];
    const curWeek = weeks[wi];
    const curPhase = phaseByWeek.get(curWeek.week) || 'accumulation';
    for (const curSess of curWeek.sessions) {
      for (const curEx of curSess.exercises) {
        const prevEx = prevWeek.sessions
          .flatMap(s => s.exercises)
          .find(pe => pe.name === curEx.name && pe.muscle === curEx.muscle);
        if (!prevEx) continue;
        const maxW = workMax[curEx.muscle] || defaultWorkMax(curEx.muscle);
        const prevWs = prevEx.workSets[0];
        if (!prevWs) continue;
        const prescr = prescribeLoad(
          'double_progression',
          prevWs.weight, prevWs.reps, prevEx.rir,
          maxW, curWeek.week, input.weeks, curPhase,
          (curEx as any).exerciseType,
          curEx.role,
        );
        for (const ws of curEx.workSets) {
          ws.weight = Math.round(prescr.nextWeight * 10) / 10;
        }
      }
    }
  }

  const rationale: string[] = [
    `Сплит «${pattern.name}» (${pattern.rotationDays}дн ротация, ${pattern.sessionsPerRotation} сессий)`,
    `Уровень ${level}, цель ${input.goal}, ${input.weeks} нед`,
    `Объём ${input.volumeGoal || 'MAV'}: ` + Object.entries(muscleVolumeRotation).map(([m, v]) => `${m}=${v}`).join(', '),
    `Специализация: ${focusGroup || 'нет'}`,
    `Фазовая периодизация (distributePhases): накопление → интенсификация${deloadFreq > 0 ? ' → разгрузка (deload)' : ''} (RIR по фазе + волна); вес = workMax×%1RM(RIR)`,
    `Прогрессия весов: double_progression (prescribeLoad) — еженедельный рост от недели к неделе с учётом фазы.`,
    `Ротация упражнений: каждые ${ROTATION_INTERVAL} нед — свежий пул (запрет повторов из предыдущего блока).`,
    `S-MRV: автоматический кап объёма на основе бюджета утомления сессии + потолок по MRV мышцы.`,
    ...(pedAdapt ? [`PED-адаптация: MRV×${pedAdapt.combinedMrvMultiplier.toFixed(2)}, восстановление×${pedAdapt.combinedRecoveryMultiplier.toFixed(2)}`] : []),
    ...(injuries.length > 0 ? [`Травмы (per-week по дате плана${input.planStartWeek ? ` со старта ${input.planStartWeek}` : ''}): исключены ${[...new Set(injuries.filter(i => i.exclude !== false).map(i => i.muscle))].join(', ') || '—'}; градация ${[...new Set(injuries.filter(i => i.exclude === false).map(i => i.muscle))].join(', ') || '—'} — упражнения заменяются на безопасные альтернативы с пониженным весом/объёмом.`] : []),
  ];

  const basePlan = { pattern, weeks, rotationMuscleVolume: muscleVolumeRotation, rationale };
  let finalPlan = basePlan;
  // Применяем пост-обработку (техники/фидеры/авто-делод/загрузка/авторег) внутри buildBBPlan,
  // чтобы оба вызывающих пути (BbAutoConstructor и TrainingConstructor) получали результат.
  // Условие покрывает ВСЕ признаки, а не только technique/weakPoints — иначе loadStrategy
  // и autoDeload теряются (баг: dfa8842fb убрал дубль-вызов из BbAutoConstructor, но не расширил guard).
  if ((input.intensityTechnique && input.intensityTechnique !== 'none') || weakPoints.length > 0 || input.loadStrategy || input.autoDeload || input.autoRegResult) {
    finalPlan = applyPostPhaseProcessing({
      plan: basePlan,
      totalWeeks: input.weeks,
      workMax,
      loadStrategy: input.loadStrategy,
      autoDeload: input.autoDeload,
      deloadType: input.deloadType,
      acwrRatio,
      autoRegResult: input.autoRegResult,
      skipPhaseRedistribution: true,
      intensityTechnique: input.intensityTechnique && input.intensityTechnique !== 'none' ? input.intensityTechnique : undefined,
      weakPoints: weakPoints.length > 0 ? weakPoints : undefined,
    });
  }
  const pedMrvMult = (pedAdapt?.combinedMrvMultiplier ?? 1);
  const volumeLandmarks = getBBVolumeLandmarks(finalPlan, level, pedMrvMult);
  return { ...finalPlan, volumeLandmarks };
}
