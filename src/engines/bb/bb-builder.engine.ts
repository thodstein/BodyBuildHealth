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
import { computeVolumeLandmarks, type VolumeLandmarkRow } from '../volume-landmarks.engine';
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
  preSelectedIds: string[] = [],
  preSelectedNames: string[] = [],
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
  }
  const plans: MusclePlan[] = [];
  let totalExpectedFatigue = 0;
  const sessionSelectedIds: string[] = [...preSelectedIds];
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
    const [rmin, rmax] = charReps(resolved);
    const rir = bbRir(resolved, phase, phaseWeek);
    const wm = workMax[repKey] || PRO_WORKMAX_RATIO[repKey]?.(workMax) || 80;
    const pct = PCT_FOR_RIR[rir] ?? 0.9;
    const reps = Math.round((rmin + rmax) / 2);
    const weight = Math.round(wm * pct * 10) / 10;
    const accessoryCount = ACCESSORY_2X_GROUPS.has(muscle) ? 2 : 1;
    const exerciseCount = role === 'primary'
      ? (['back', 'quads', 'chest', 'shoulders'].includes(muscle) ? 3 : 2)
      : accessoryCount;
    const selType = ALWAYS_ISOLATION.has(muscle) ? 'isolation' : (role === 'primary' ? 'compound' : 'isolation');
    let pool = getExercisesByGroup(catalogGroupFor(repKey));
    // Фильтр: убираем упражнения, не соответствующие контексту сессии
    const tag = (sched.sessionTag || '').toLowerCase();
    pool = pool.filter(ex => {
      const n = (ex.name || '').toLowerCase();
      const id = (ex.id || '').toLowerCase();
      // Push/Chest/Shoulders день: исключаем тяги, становую, carries
      if (tag.includes('push') || tag === 'chest' || tag === 'shoulders') {
        if (n.includes('тяга')||n.includes('становая')||n.includes('мёртвая')||n.includes('гиперэкстенз')||n.includes('фермер')||n.includes('carry')) return false;
      }
      // Pull/Back день: исключаем жимы, фронтальные махи
      if (tag.includes('pull') || tag === 'back') {
        if (n.includes('жим')&&!n.includes('ногами')||n.includes('press')||n.includes('разгиб')||n.includes('extension')) return false;
      }
      // Legs день: исключаем верх тела
      if (tag === 'legs' || tag === 'lower') {
        if (n.includes('жим')&&!n.includes('ногами')||n.includes('тяга')||n.includes('подтяг')||n.includes('бицепс')||n.includes('трицепс')) return false;
      }
      return true;
    });
    // Если после фильтра пул опустел — возвращаем полный
    if (pool.length === 0) pool = getExercisesByGroup(catalogGroupFor(repKey));
    const selected = selectExercisesSmart({
      candidates: pool, muscleGroup: muscle, count: exerciseCount,
      selectedIds: sessionSelectedIds, selectedNames: sessionSelectedNames,
      equipment: [], weakZones: weakPoints, level, injuryProfile, type: selType,
      targetRir: rir,
      preferBB: true,
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

    const expectedFatigue = exerciseCount * (sets / exerciseCount) * (((exDatas[0] as any)?.fatigueCost || 5));
    totalExpectedFatigue += expectedFatigue;
    plans.push({ muscle, resolved, role, sets, exerciseCount, rir, reps, weight, pool, exDatas, selType, rationaleMap });
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
      // Кроме того, снижаем число упражнений на травмированной группе на 1
      // (реальная разгрузка, а не только вес/объём каждого упражнения).
      const injuredExCount = Math.max(1, pl.exerciseCount - 1);
      pl.exDatas = newExDatas.slice(0, injuredExCount);
    }
  }

  // Process each muscle with proportional budget
  for (const pl of plans) {
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
      if (remainingBudget < cost) {
        const reduced = Math.max(2, Math.floor(remainingBudget / ((exData as any)?.fatigueCost || 5)));
        const adjustedSets = Math.min(exSets, reduced);
        const adjCost = ((exData as any)?.fatigueCost || 5) * adjustedSets;
        remainingBudget -= adjCost;
        const tempoSpec = tempoFor(pl.resolved as DayCharacter);
        const restSeconds = REST_BY_CHARACTER[pl.resolved as DayCharacter];
        const workSets: BBSet[] = Array.from({ length: adjustedSets }, () => ({
          reps: Math.round(Math.min(pl.reps, repsCap)), rir: finalRir,
          weight: Math.round(exWeight * wPct * ((exData as any)._weightMod || 1) * 10) / 10,
          tempo: tempoSpec.notation, restSeconds,
        }));
        exercises.push({
          muscle: pl.muscle, name: (exData as any).name || (exData as any).id, role: pl.role, character: pl.resolved as DayCharacter,
          sets: adjustedSets, repsRange: [Math.round(Math.min(pl.reps - 2, repsCap)), Math.round(Math.min(pl.reps + 2, repsCap))],
          rir: finalRir,
          workSets, exerciseName: (exData as any).name || (exData as any).id,
          tempoSpec: tempoSpec.notation, restSeconds,
          comment: buildExComment(pl.muscle, (exData as any).name || (exData as any).id, pl.role, pl.resolved as DayCharacter, adjustedSets, Math.round(Math.min(pl.reps, repsCap)), Math.round(exWeight * wPct * ((exData as any)._weightMod || 1) * 10) / 10, finalRir, weakPoints, focusGroup, phase, tempoSpec.notation, restSeconds, isSubstituted),
          warmupSets: buildWarmup(Math.round(exWeight * wPct * ((exData as any)._weightMod || 1) * 10) / 10, pl.role === 'primary'),
          rationale: pl.rationaleMap.get((exData as any).name) || '',
        });
        continue;
      }
      remainingBudget -= cost;
      const tempoSpec = tempoFor(pl.resolved as DayCharacter);
      const restSeconds = REST_BY_CHARACTER[pl.resolved as DayCharacter];
      const workSets: BBSet[] = Array.from({ length: exSets }, () => ({
        reps: Math.round(Math.min(pl.reps, repsCap)), rir: finalRir,
        weight: Math.round(exWeight * wPct * ((exData as any)._weightMod || 1) * 10) / 10,
        tempo: tempoSpec.notation, restSeconds,
      }));
      exercises.push({
        muscle: pl.muscle, name: (exData as any).name || (exData as any).id, role: pl.role, character: pl.resolved as DayCharacter,
        sets: exSets, repsRange: [Math.round(Math.min(pl.reps - 2, repsCap)), Math.round(Math.min(pl.reps + 2, repsCap))],
        rir: finalRir,
        workSets, exerciseName: (exData as any).name || (exData as any).id,
        tempoSpec: tempoSpec.notation, restSeconds,
        comment: buildExComment(pl.muscle, (exData as any).name || (exData as any).id, pl.role, pl.resolved as DayCharacter, exSets, Math.round(Math.min(pl.reps, repsCap)), Math.round(exWeight * wPct * ((exData as any)._weightMod || 1) * 10) / 10, finalRir, weakPoints, focusGroup, phase, tempoSpec.notation, restSeconds, isSubstituted),
        warmupSets: buildWarmup(Math.round(exWeight * wPct * ((exData as any)._weightMod || 1) * 10) / 10, pl.role === 'primary'),
        rationale: pl.rationaleMap.get((exData as any).name) || '',
      });
    }
  }
  // Кап упражнений в сессии: максимум 10 (реалистичная тренировка)
  if (exercises.length > 10) {
    // Сохраняем primary, обрезаем accessory с конца
    const kept = exercises.filter(e => e.role === 'primary');
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
      // Solo-дни (1-2 группы мышц): увеличиваем бюджет на 50% — вся энергия дня идёт на эти мышцы
      const sessDailyCap = sessMuscles.length <= 2 ? Math.round(dailyCap * 1.5) : dailyCap;
      const mrvRot = Math.max(12, ...sessMuscles.map(m => mrvByMuscle[m] || 0));
      const sess = buildSession(s, i + 1, w, muscleVolumeRotation, muscleSessionCount, musclePrimaryAssigned, workMax, weakPoints, focusGroup, pedAdapt, sessDailyCap, level, injuryProfile, new Set(injuryProfile), excludedMuscles, gradedInjuries, today, phase, phaseWeek, mrvRot, isFB ? fbUsedIds : [], isFB ? fbUsedNames : []);
      sess.weekOffset = (w - 1) * pattern.rotationDays + (i + 1);
      // FB: собираем ID и имена упражнений для запрета повторов
      if (isFB) for (const ex of sess.exercises) {
        if (ex.exerciseName) { fbUsedIds.push(ex.exerciseName); fbUsedNames.push(ex.exerciseName); }
      }
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

  const pedMrvMult = (pedAdapt?.combinedMrvMultiplier ?? 1);
  const volumeLandmarks = getBBVolumeLandmarks({ pattern, weeks, rotationMuscleVolume: muscleVolumeRotation, rationale }, level, pedMrvMult);
  return { pattern, weeks, rotationMuscleVolume: muscleVolumeRotation, rationale, volumeLandmarks };
}
