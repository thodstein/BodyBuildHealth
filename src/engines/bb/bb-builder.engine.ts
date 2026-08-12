/**
 * bb-builder.engine.ts — генератор бодибилдинг-плана из раскладки ротации (Этап BB6).
 * Связывает: bb-split-patterns (расписание) + bb-day-types (тяж/памп/первичная-добивка) +
 * volume-landmarks (MEV/MAV/MRV) + rir-matrix (RIR-прогрессия по неделям).
 *
 * Логика:
 *  - MAV мышц берётся из volume-landmarks, масштабируется под длину ротации.
*  - Каждая мышца в ротации: одна сессия = первичная (тяж, ~65% MAV), другие = добивка (памп, ~35%).
*    forearms/traps (forceDayType) — всегда тяж; ноги теперь МОГУТ быть памп-днём (P0-4 audit 2026-07).
*  - Сеты/репы/RIR по характеру: тяж 5-8/RIR1-2; памп 12-20/RIR3; лёг 10-15/RIR4.
 *  - Вес = workMax × %1RM(RIR, reps). Недели 2..N: RIR ↓ (rir-matrix) → вес ↑.
 */

import { SPLIT_PATTERNS, getPattern, sessionsOf, type SplitPattern, type ScheduleDay } from './bb-split-patterns';
import { FORCE_HEAVY_GROUPS, resolveCharacter, TAG_MUSCLES, type DayCharacter, type MuscleSlot } from './bb-day-types';
import { getAllVolumeLandmarks, landmarksForRotation, getVolumeLandmarks, normLevel, type TrainingLevel, type MuscleVolumeLandmarks } from '../volume-landmarks.engine';
import { tempoFor, REST_BY_CHARACTER, type TempoSpec } from './bb-tempo-rest';
import { EXERCISE_CATALOG } from '../../core/exercise-catalog';
import { selectExercisesSmart, isAxialLoadExercise } from '../exercise-selector.engine';
import { trueMuscleOf, musclesForRole, derivePattern } from '../movement-pattern';
import { PCT_FOR_RIR, S_MRV_FACTOR } from '../rir-table';
import type { PEDAdaptation, CourseIntensity } from './bb-ped-adaptation.engine';
import type { Injury } from '../manual-plan-builder';
import { prescribeLoad, applyPostPhaseProcessing, type LoadStrategy, type IntensityTechnique, type DeloadType } from './bb-autocoach.engine';
import { applyFeedbackToBuild, autoUpdateWeakPoints, autoReplaceOnPlateau, computePerMuscleACWR } from './bb-progression-feedback.engine';
import { extractMesocycleProgression, applyWeightProgression, applyVolumeProgression, wasInPreviousMeso, type MesocycleProgression } from './bb-mesocycle-progression.engine';
import { buildExerciseInstructions, formatExerciseInstructions } from './bb-exercise-instructions.engine';
import { loadSessions as loadWorkoutSessions } from '../workout-logger.engine';
import { getActiveInjuries, getExcludedMuscles, getGradedInjuries, getInjuryVolumeFactor } from '../manual-plan-builder';
import { findSubstitutions } from '../exercise-substitution.engine';
import { computeVolumeLandmarks, type VolumeLandmarkRow } from '../volume-landmarks.engine';
// Фазовая периодизация (distributePhases) — ЕДИНЫЙ источник RIR/фаз/deload для ББ-плана.
// Импорт distributePhases/getPhaseVolumeMult из UI-модуля намеренный: это каноническая
// реализация, которую использует и ручной конструктор (phase-periodization).
import { distributePhases, PHASE_CONFIGS, getPhaseVolumeMult, type BBPhase } from '../periodization';
import { orderSessionExercises, type SessionMethodology } from './bb-session-order.engine';
import { type BBTrainingFocus, FOCUS_RIR_TABLE } from './bb-goal-types';
import { clampRir } from './bb-utils';
import { isInappropriateBB, bbExerciseTier } from './bb-exercise-tier.engine';
import { ANGLE_CLASSES, lengthenedBonus } from './bb-exercise-selection.engine';
import { loadSRPESessions } from '../../engines/pro/srpe-store';
import { acuteChronicRatio, toDailyLoads } from '../../engines/pro/training-load.engine';
import type { Macrocycle, MacroPhase, BBMacrocycle, BBMacroPhase } from '../lms/macrocycle.engine';
import { syncBBPlanSetShape, validateBBPlan } from './bb-validator.engine';
import { finalizeBBPlan } from './bb-finalize.engine';
import { buildBBVolumeTarget, type BBVolumeTarget } from './bb-volume.engine';
import type { BBRotationReport } from './bb-rotation.engine';
import type { BBSessionCost } from './bb-fatigue.engine';
import type { BBPlanReport } from './bb-report.engine';
import { applyDUPOverlay, type DUPConfig } from './bb-dup.engine';
import type { BBPlanValidationResult } from './bb-validator.engine';

// P7: приоритет equipment по фазе (формирует пропорцию compound/isolation/cable/machine из PHASE_CONFIGS)
export const PHASE_EQUIPMENT_PREF: Record<string, string[]> = {
  accumulation: ['cable', 'dumbbell', 'machine', 'barbell'],
  intensification: ['barbell', 'machine', 'dumbbell', 'cable'],
  peaking: ['barbell', 'machine', 'dumbbell', 'cable'],
  deload: ['cable', 'bodyweight', 'dumbbell', 'machine'],
};

export type BBGoal = 'mass' | 'cut' | 'recomp' | 'maintenance' | 'strength_mass';
export type BBVolumeGoal = 'mev' | 'mav' | 'mrv';

export interface MusclePlan {
  muscle: string; resolved: string; role: 'primary' | 'accessory';
  sets: number; exerciseCount: number; rir: number;
  reps: number; weight: number; pool: any[]; exDatas: any[]; selType: string;
  rationaleMap: Map<string, string>;
  phaseEquip?: string[];
}

export interface BBBuilderInput {
  patternId: string;
  level: string;                 // beginner/intermediate/advanced/enhanced
  /** Реальный стаж силовых тренировок. Не заменяется ярлыком level. */
  trainingYears?: number;
  /** Способность к bodyweight-упражнениям. Если нет данных — подтягивания
   *  не ставятся как primary; используется pulldown/assisted вместо них. */
  bodyweightCapability?: {
    pullUpsStrict?: number;
    chinUpsStrict?: number;
    dipsStrict?: number;
    pushUpsStrict?: number;
    weightedPullUpLoad?: number;
    assistedPullUpLoad?: number;
  };
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
  sex?: 'male' | 'female';       // Пол — для приоритета glutes в ножные дни (женский сплит)
  intensityTechnique?: IntensityTechnique; // П6: техника интенсивности для каждого primary
  autoDeload?: boolean;          // авто-делод по ACWR
  deloadType?: DeloadType;       // тип делода (pump/strength/rest)
  loadStrategy?: LoadStrategy;   // стратегия прогрессии нагрузки
  autoRegResult?: {              // результат авторегуляции (объём/вес/RIR)
    volumeMultiplier: number;
    topSetPctMultiplier: number;
    rirShift: number;
  };
  /** Дозы PED (мг/нед или МЕ/день или мкг). Ключи: 'AAS','insulin','MGF','IGF1','GH'.
   *  Dose-aware: 250 мг ААС ≠ 2000 мг ААС по влиянию на MRV. */
  pedDoses?: Record<string, number>;
  /** Интенсивность курса — дополнительный MRV boost (mild 1.0 / moderate 1.04 / heavy 1.08). */
  courseIntensity?: CourseIntensity;
  /** Доступное оборудование (штанга/гантели/блок/машина/гири/свой вес) — фильтр отбора упражнений. */
  equipment?: string[];
  /** Методика порядка упражнений в сессии (compound_first по умолчанию; pre_exhaust — изоляция основной мышцы первой). */
  methodology?: SessionMethodology;
  /** P0-5 (audit 2026-07): множитель MRV по данным лаборатории (0.7-1.0).
   *  Источник: labTrainingAdjust(linked.labAnalysis).mrvMultiplier (UI-side).
   *  Применяется ПОСЛЕ PED-множителя: effectiveMrvMult = pedMrvMult × labMrvMultiplier.
   *  ALT↑/CRP↑/HCT↑/низкий тестостерон → снижение допустимого объёма. */
  labMrvMultiplier?: number;
  /** P0-5: текстовые предупреждения лаборатории (пробрасываются в rationale плана). */
  labWarnings?: string[];
  /** P0-5: рекомендация по интенсивности из лаборатории (пробрасывается в rationale). */
  labIntensityNote?: string;
  /** Тип тренировки: strength/hypertrophy/endurance. Влияет на RIR/reps/tempo по Schoenfeld 2021/2022. */
  trainingFocus?: BBTrainingFocus;
  /** % жира в теле (0-50). Влияет на восстановление: >25% → MRV×0.9 (Helms 2022). */
  bodyFat?: number;
  /** Жировая масса тела в кг. Чем выше LBM, тем больше объём способен восстановить (Helms 2022). */
  leanMass?: number;
  /** HRV (мс). >70 = high readiness, 50-70 = medium, <50 = low (Plews 2022). */
  hrvMs?: number;
  /** Часы сна за ночь. >7 = high, 6-7 = medium, <6 = low (Watson 2022). */
  sleepHours?: number;
  /** Субъективный стресс 1-10. Low(1-3)=high readiness, Medium(4-6)=medium, High(7-10)=low (Kreher 2022). */
  stressLevel?: number;
  /** Множитель эксцентрической нагрузки. 1.0 = норма, 1.1-1.2 = eccentric overload (Schoenfeld 2021). */
  eccentricMult?: number;
  /** Профицит калорий (ккал/день). 250-500 = оптимальный рост (Helms 2014). */
  calorieSurplus?: number;
  /** Белок г/кг. 1.6-2.2 = оптимально (Helms 2022). <1.0 → снижение MRV. */
  proteinPerKg?: number;
  /** PRO: ограничения мобильности — фильтр упражнений по биомеханике.
   *  'shoulder' — ограниченная плечевая мобильность → исключить overhead press, behind neck.
   *  'hip' — ограниченная тазобедренная мобильность → исключить deep squats, prefer hack squat.
   *  'ankle' — ограниченная голеностопная мобильность → prefer leg press over squat.
   *  'lower_back' — проблемы с поясницей → исключить conventional deadlift, barbell row.
   *  'wrist' — проблемы с запястьями → исключить straight-bar curl, prefer cable. */
  mobilityRestrictions?: string[];
  /** PRO: предыдущий мезоцикл — для auto-progress весов, ротации упражнений, объёмной прогрессии.
   *  Если передан, buildBBPlan извлекает из него: peak-week веса → стартовые веса +2.5-5кг,
   *  список упражнений → ротация (избегаем повторов), per-muscle volume → +1-2 сета. */
  previousPlan?: BBPlan;
}

/**
 * Объёмный профиль спины для продвинутых атлетов.
 * В старой версии enhanced менял в основном число упражнений, но не имел
 * отдельного недельного бюджета back. Здесь стаж ограничивает доступный
 * enhanced-объём: PED не превращает новичка в pro автоматически.
 */
function backVolumeProfile(level: string, trainingYears?: number): { targetMult: number; capMult: number; extraExercises: number } {
  const years = Number.isFinite(trainingYears) ? Math.max(0, trainingYears as number) : 0;
  if (level !== 'enhanced') return { targetMult: 1, capMult: 1, extraExercises: 0 };
  if (years >= 6) return { targetMult: 2.20, capMult: 2.20, extraExercises: 3 };
  if (years >= 3) return { targetMult: 1.80, capMult: 1.80, extraExercises: 2 };
  if (years >= 1) return { targetMult: 1.15, capMult: 1.15, extraExercises: 0 };
  return { targetMult: 1, capMult: 1, extraExercises: 0 };
}

/**
 * Объёмный профиль ног для продвинутых атлетов.
 */
function legVolumeProfile(level: string, trainingYears?: number): { targetMult: number; capMult: number; extraExercises: number } {
  const years = Number.isFinite(trainingYears) ? Math.max(0, trainingYears as number) : 0;
  if (level !== 'enhanced') return { targetMult: 1, capMult: 1, extraExercises: 0 };
  if (years >= 6) return { targetMult: 1.80, capMult: 1.80, extraExercises: 2 };
  if (years >= 3) return { targetMult: 1.45, capMult: 1.45, extraExercises: 1 };
  if (years >= 1) return { targetMult: 1.15, capMult: 1, extraExercises: 0 };
  return { targetMult: 1, capMult: 1, extraExercises: 0 };
}

/**
 * Объёмный профиль груди/плеч для продвинутых атлетов.
 * Грудь требует разных углов (плоский/наклонный/растянутый), а плечи —
 * разделения front/mid/rear с учётом косвенной нагрузки от жимов.
 */
function torsoVolumeProfile(level: string, trainingYears?: number): { targetMult: number; capMult: number; extraExercises: number } {
  const years = Number.isFinite(trainingYears) ? Math.max(0, trainingYears as number) : 0;
  if (level !== 'enhanced') return { targetMult: 1, capMult: 1, extraExercises: 0 };
  if (years >= 6) return { targetMult: 1.60, capMult: 1.60, extraExercises: 1 };
  if (years >= 3) return { targetMult: 1.35, capMult: 1.35, extraExercises: 1 };
  if (years >= 1) return { targetMult: 1.12, capMult: 1.12, extraExercises: 0 };
  return { targetMult: 1, capMult: 1, extraExercises: 0 };
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
  exerciseType?: string;    // 'compound' | 'isolation' | 'cable' | 'machine' etc. — для prescribeLoad
  tempoSpec?: string;       // PRO: нотация темпа из bb-tempo-rest
  restSeconds?: number;     // PRO: отдых между подходами
  comment?: string;         // PRO: тренерский комментарий (роль/слабые/фаза/нагрузка)
  warmupSets?: { load: number; reps: number }[]; // PRO: разминочные подходы (для compounds)
  rationale?: string;       // PRO: почему выбрано именно это упражнение
  /** Структурированная инструкция из Exercise Lab, без необходимости парсить comment. */
  executionProfile?: import('./bb-exercise-instructions.engine').ExerciseInstructionProfile;
  backSubgroup?: 'back_width' | 'back_thickness' | 'upper_back' | 'rear_delts' | 'traps' | 'erectors';
  movementPattern?: string;
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
  phase?: BBPhase;
  deload?: boolean;
  taper?: boolean;
  sessions: BBSession[];
}

export interface BBPlan {
  pattern: SplitPattern;
  weeks: BBWeek[];
  rotationMuscleVolume: Record<string, number>; // MAV×ротация на мышцу
  rationale: string[];
  /** P2-4: уровень пользователя (для bb-metrics без duck-typing). */
  level?: string;
  /** Volume-landmarks (MEV/MAV/MRV) по пиковой неделе — единый источник, как в PL/ручном. */
  volumeLandmarks?: VolumeLandmarkRow[];
  /** Частота тренировок каждой мышцы в неделю (1×/2×/3×) — ключевой фактор гипертрофии. */
  muscleFrequency?: Record<string, number>;
  volumeTargets?: Record<string, BBVolumeTarget>;
  rotationReport?: BBRotationReport;
  fatigueReport?: Array<{ week: number; sessions: Array<BBSessionCost> }>;
  weeklyVolume?: Record<number, Record<string, { directSets: number; effectiveSets: number; fatigueWeightedSets: number }>>;
  report?: BBPlanReport;
  balanceReport?: import('./bb-balance.engine').BBBalanceReport;
  validation?: BBPlanValidationResult;
  safetyConstraints?: {
    equipment?: string[];
    excludedExercises?: string[];
    excludedMuscles?: string[];
    avoidAxialLoad?: boolean;
  };
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

/** Проверить, является ли упражнение задней дельтой (rear delt).
 *  Включает и «чистые» rear-delt движения, и комбинированные средняя+задняя
 *  (Lu raise, Y-raise) — они по факту нагружают заднюю дельту наравне со средней
 *  и должны исключаться из Push/Chest-дней так же, как face pull/rear delt fly. */
export function isRearDeltExercise(name: string): boolean {
  return /наклон.*дельт|rear|тяга.*лиц|face.*pull|бабочка|задн.*дельт|обратн.*сведен|обратн.*бабоч|lu.?raise|y-raise|y raise/i.test(name || '');
}
/** Проверить, является ли день Push/Chest/Shoulders (не Pull/Back). */
function isPushDayTag(sessionTag: string): boolean {
  const t = (sessionTag || '').toLowerCase();
  return t.includes('push') || t === 'chest' || (t.includes('shoulders') && !t.includes('pull'));
}

/**
 * Гранулярные слабые группы → конкретные упражнения для приоритета.
 * При выборе weakPoint='delt_mid' — махи в стороны получают +20 к скору.
 * При выборе weakPoint='back_width' — подтягивания/пуллдауны получают +20.
 * При выборе weakPoint='chest_upper' — жимы на наклонной получают +20.
 */
const WEAK_EXERCISE_BONUS: Record<string, (name: string) => boolean> = {
  chest_upper: (n) => /жим.*(наклон|incline|верх)|incline.*press/i.test(n),
  chest_lower: (n) => /жим.*(сниз|decline|отриц)|decline.*press/i.test(n),
  back_width: (n) => /подтяг|pull.?up|тяга.*верх|lat.?pull|пуллдаун/i.test(n),
  back_thickness: (n) => /тяга.*(наклон|штанг|гантел|груд|пояс)|row/i.test(n) && !/верх|подтяг/i.test(n),
  delt_front: (n) => /жим.*(стоя|сидя|армей|overhead)|кубическ/i.test(n),
  delt_mid: (n) => /мах.*(сторону|гантел|блок|кроссов)|lateral.*raise|отведение/i.test(n),
  delt_rear: (n) => isRearDeltExercise(n),
  glutes: (n) => /ягодичн.*мост|hip.?thrust|glute.?bridge|отведен.*ног|kick.?back/i.test(n),
  hamstrings: (n) => /сгибан.*ног|leg.?curl|румын|rdl/i.test(n),
  quads: (n) => /присед|squat|жим.*ног|leg.?press|разгибан.*ног/i.test(n),
  calves: (n) => /подъём.*носк|подъем.*носк|calf/i.test(n),
  biceps: (n) => /сгибан.*рук|бицепс|curl|молот/i.test(n),
  triceps: (n) => /разгибан.*рук|трицепс|pushdown|француз/i.test(n),
  forearms: (n) => /запяст|предплеч|wrist|пронац/i.test(n),
  traps: (n) => /шраг/i.test(n),
  abs: (n) => /скручиван|crunch|пресс|подъём.*ног|подъем.*ног/i.test(n),
};

/** Получить бонус к скору для упражнения по гранулярной слабой группе. */
function weakExerciseBonus(exName: string, weakPoints: string[]): number {
  let bonus = 0;
  for (const wp of weakPoints) {
    const matcher = WEAK_EXERCISE_BONUS[wp];
    if (matcher && matcher(exName)) bonus += 20;
  }
  return bonus;
}

/** Маппинг гранулярных слабых групп в канонические мышцы (для объёма/MRV).
 *  P0-3 (audit 2026-08): экспортирован для переиспользования в cycle-to-plan / bb-weakpoint / bb-selector,
 *  чтобы гранулярные слабые группы (chest_upper, back_width, delt_mid) корректно
 *  маппились в канонические мышцы (chest, back, shoulders) при проверках. */
export const WEAK_TO_MUSCLE: Record<string, string> = {
  chest: 'chest', chest_upper: 'chest', chest_lower: 'chest',
  back: 'back', back_width: 'back', back_thickness: 'back',
  shoulders: 'shoulders', delt_front: 'shoulders', delt_mid: 'shoulders', delt_rear: 'shoulders',
  quads: 'quads', hamstrings: 'hamstrings', glutes: 'glutes', calves: 'calves',
  biceps: 'biceps', triceps: 'triceps', forearms: 'forearms',
  abs: 'abs', traps: 'traps',
};

/** Для каких мышц в BB-контексте ВСЕГДА брать только изоляцию (нет compound аналогов). */
const ALWAYS_ISOLATION: Set<string> = new Set(['calves', 'forearms', 'abs']);

/** P0-1: arms muscle set — используется в buildSession (budget reserve) и buildBBPlan (arm guarantee). */
const ARM_MUSCLES_SET = new Set(['biceps', 'triceps', 'forearms']);

// "Золотой стандарт" ББ-упражнений (максимально эффективные для гипертрофии).
// Приоритизируются в generic-планах (без специализации/слабых точек).
// ББ-логика: наклонный жим > плоский (верх груди — отстающая у большинства),
// гакк/Смит-присед > свободный присед (безопасность поясницы, изоляция квадрицепса).
// ВНИМАНИЕ: ID должны совпадать с реальными id в exercise-catalog.ts. Ранее здесь были
// выдуманные ID (barbell_row/t_bar_row/lat_pulldown/overhead_press/dumbbell_lateral_raise/
// barbell_curl/dumbbell_curl/tricep_pushdown/bench_press/incline_barbell_press/...),
// из-за чего буст +50 никогда не срабатывал — реальный каталог использует
// row_bar/row_tbar/pulldown/ohp/lateral_raise/curl_bar/curl_db/tricep_pushdown_*/bench_bar/incline_bar/...
const PREFERRED_BB_EXERCISES = new Set([
  // Грудь — наклонные приоритет (верх груди растёт хуже, чем средняя/нижняя)
  'incline_bar', 'incline_db', 'bench_bar', 'bench_db',
  'dips_chest', 'machine_chest_press', 'machine_incline_press',
  // Спина — тяжёлые compound-тяги приоритет (king of back: barbell row + T-bar + pulldown)
  'row_bar', 'row_tbar', 'row_db', 'row_chest_supported', 'row_seal', 'row_pendlay', 'yates_row',
  'pulldown', 'pulldown_wide', 'pullup', 'chinup', 'pullup_wide', 'pulldown_vbar',
  // Ноги — гакк/Смит/лег-пресс приоритет (безопасность поясницы, изоляция)
  'hack_squat', 'squat_smith', 'leg_press', 'bulgarian_split_squat', 'walking_lunge', 'walking_lunge_db',
  'rdl', 'deadlift_romanian', 'leg_curl', 'leg_ext',
  // Плечи
  'ohp', 'ohp_seated', 'ohp_seated_bar', 'ohp_seated_db', 'arnold_press', 'db_press',
  'lateral_raise', 'lateral_raise_cable', 'lateral_raise_machine',
  // Руки
  'tricep_pushdown_rope', 'tricep_pushdown_bar', 'curl_bar', 'curl_db', 'hammer_curl',
  // Икры/Пресс
  'calf_raise', 'crunch',
]);

// Слишком специфические упражнения (исключать для generic плана, если нет weak point).
// "Жим обратным хватом" — пример из запроса: мало эффективен для общего развития груди.
const BLACKLIST_GENERIC = new Set([
  'bench_press_reverse_grip', 'reverse_grip_bench_press',
  'underhand_grip_lat_pulldown',
  'wide_grip_bench_press',
  'smith_machine_squat',
  'leg_press_machine_close_stance',
  'machine preacher_curl',
]);

// Детальные инструкции по выполнению (углы, хват, техника).
// Заменяют абстрактные "постоянный темп" на конкретные команды.
// FIX-A8: dual-key lookup — EN id (bench_press) + RU name (жим штанги лёжа).
// buildExComment сначала ищет по exerciseId (EN), потом по RU-имени.
const EXECUTION_NOTES: Record<string, string> = {
  // EN IDs (canonical from EXERCISE_CATALOG)
  bench_press: "Ловка: на ширине плеч. Хват: прямой. Локти: чуть под грифом (не в стороны). Опускайте до касания груди.",
  incline_barbell_press: "Скамья: 30-45 градусов. Ловка: чуть шире плеч. Спина: плотно прижата.",
  dumbbell_bench_press: "Хват: нейтральный (ладони друг к другу). Опускайте до растяжения груди.",
  squat: "Стопы: на ширине плеч. Спина: прямая, натяжение. Глубина: параллельно полу. Взгляд: вперёд.",
  leg_press: "Стопы: на платформе, плечи защищены. Глубина: до 90 градусов в коленях.",
  romanian_deadlift: "Спина: прямая. Гриф: близко к голеням. Взгляд: вперёд. Не круглить спину!",
  deadlift: "Хват: по ширине плеч или разносторонний. Спина: прямая, грудь вперёд.",
  barbell_row: "Наклон: 45-60 градусов. Тяга к низу живота. Локти: вдоль туловища.",
  dumbbell_row: "Наклон: опора на скамью. Тяга к поясу. Руки параллельно.",
  lat_pulldown: "Хват: широкий. Тяните к верху груди. Не раскачивайтесь корпусом.",
  pull_up: "Хват: широкий. Подбородок над перекладиной. Опускайте до почти полного выпрямления рук.",
  overhead_press: "Хват: чуть шире плеч. Выжимайте над головой. Не прогибайтесь в пояснице.",
  arnold_press: "Хват: нейтральный. Выжимайте вверх, разворачивая ладонями от себя при подъеме.",
  tricep_pushdown: "Хват: узкий V-образный. Локти прижаты к корпусу. Опускайте медленно, вверх взрывно.",
  lying_tricep_extension: "Хват: EZ-гриф. Локти направлены в потолок (не разводите в стороны!).",
  barbell_curl: "Хват: на ширине плеч. Локти прижаты. Не раскачивайтесь корпусом.",
  dumbbell_curl: "Чередуйте супинацию (ладони друг к другу, нейтральный).",
  leg_curl: "Опускайте медленно (эксцентрика), поднимайте быстро (концентрика).",
  leg_extension: "Выпрямляйте полностью (вверху задержка 0.5 сек).",
  calf_raise: "Максимум растяжения внизу, стойте на носках 1 сек вверху.",
  crunch: "Поднимайте лопатки с пола. Руки за головой. Движение короткое, концентрированное.",
  incline_dumbbell_press: "Скамья: 30-45 градусов. Гантели: нейтральный хват. Опускайте до растяжения верхней груди.",
  t_bar_row: "Хват: широкий. Грудь опирается на подушку. Тяните локтями, сводите лопатки.",
  chin_up: "Хват: обратный (ладони к себе). Подбородок над перекладиной. Бицепс+спина.",
  dumbbell_lunge: "Шаг: длинный. Колено передней ноги не выходит за носок. Корпус вертикально.",
  dumbbell_lateral_raise: "Без раскачки. Локти чуть согнуты. Поднимайте до уровня плеч. Большой палец вниз.",
  hack_squat: "Спина плотно прижата к подушке. Стопы: на ширине плеч, ближе к верху платформы. Глубина: до 90° в коленях. Не отрывать таз.",
  smith_squat: "Спина прямая, гриф по траектории Смита. Стопы чуть вперёд от корпуса (снижает нагрузку на колени). Глубина: параллельно.",
  bulgarian_split_squat: "Задняя нога на скамье. Шаг передней: средний. Колено не выходит за носок. Корпус вертикально. Гантель в одной руке или по бокам.",
  // RU name fallbacks (для упражнений, где id может не совпадать)
  'жим штанги лёжа': "Ловка: на ширине плеч. Хват: прямой. Локти: чуть под грифом. Опускайте до касания груди.",
  'жим гантелей лёжа': "Хват: нейтральный. Опускайте до растяжения груди.",
  'жим гантелей на наклонной скамье': "Скамья: 30-45°. Гантели: нейтральный хват. Опускайте до растяжения верхней груди.",
  'жим ногами': "Стопы: на платформе, плечи защищены. Глубина: до 90° в коленях.",
  'румынская тяга': "Спина: прямая. Гриф: близко к голеням. Не круглить спину!",
  'тяга штанги в наклоне': "Наклон: 45-60°. Тяга к низу живота. Локти: вдоль туловища.",
  'тяга верхнего блока': "Хват: широкий. Тяните к верху груди. Не раскачивайтесь.",
  'подтягивания': "Хват: широкий. Подбородок над перекладиной. Опускайте до почти полного выпрямления.",
  'армейский жим': "Хват: чуть шире плеч. Выжимайте над головой. Не прогибайтесь в пояснице.",
  'жим стоя': "Хват: чуть шире плеч. Выжимайте над головой. Не прогибайтесь в пояснице.",
  'разгибание рук на блоке': "Хват: узкий V-образный. Локти прижаты. Опускайте медленно, вверх взрывно.",
  'французский жим': "Хват: EZ-гриф. Локти направлены в потолок (не разводите в стороны!).",
  'подъём штанги на бицепс': "Хват: на ширине плеч. Локти прижаты. Не раскачивайтесь.",
  'сгибание ног': "Опускайте медленно (эксцентрика), поднимайте быстро (концентрика).",
  'разгибание ног': "Выпрямляйте полностью (вверху задержка 0.5 сек).",
  'подъём на носки': "Максимум растяжения внизу, стойте на носках 1 сек вверху.",
  'скручивания': "Поднимайте лопатки с пола. Руки за головой. Движение короткое.",
  'выпады с гантелями': "Шаг: длинный. Колено передней ноги не выходит за носок. Корпус вертикально.",
  'махи гантелями в стороны': "Без раскачки. Локти чуть согнуты. Поднимайте до уровня плеч.",
  'гакк-приседания': "Спина плотно прижата. Стопы: на ширине плеч. Глубина: до 90° в коленях.",
  'болгарские сплит-приседания': "Задняя нога на скамье. Шаг передней: средний. Колено не выходит за носок.",
  'жим гантелей сидя': "Хват: нейтральный. Выжимайте вверх. Не прогибайтесь в пояснице.",
  'тяга нижнего блока': "Тяга к поясу. Локти вдоль туловища. Сводите лопатки.",
  'жим в тренажёре': "Хват: нейтральный/прямой. Спина плотно прижата. Контроль негативной фазы.",
  'жим в тренажёре на наклонной': "Скамья: 30-45°. Контроль негативной фазы. Опускайте до растяжения верхней груди.",
  'сведение в тренажёре': "Сводите руки до касания. Контроль негативной фазы. Растяжение в стартовой позиции.",
  'сведение рук в кроссовере': "Сводите руки до касания. Контроль негативной фазы. Растяжение в стартовой позиции.",
  'отжимания на брусьях': "Корпус: наклон вперёд (грудь) или вертикально (трицепс). Опускайтесь до параллели плеч полу.",
  'гиперэкстензия': "Спина: прямая. Не переразгибайтесь в верхней точке. Движение контролируемое.",
  'ягодичный мост': "Стопы: на ширине плеч. Таз: вверх до полного разгибания. Пиковое сокращение 1 сек.",
  'шраги со штангой': "Плечи: вверх к ушам. Без вращения. Задержка 1 сек вверху.",
  'шраги с гантелями': "Плечи: вверх к ушам. Без вращения. Задержка 1 сек вверху.",
};

// FIX-B4: lengthenedBonus — импортирован из bb-exercise-selection.engine.ts (единственный источник).
// Schoenfeld 2022, Maeo 2023: длина мышцы при натяжении — ключевой драйвер гипертрофии.
// RDL > stiff-leg deadlift, incline curl > preacher curl, sissy squat > leg extension.
// P2-4: trainingFocus модулирует бонус — strength меньше заботит растяжение
// (механическое натяжение важнее), endurance больше (метаболический стресс + растяжение).

/** Ранг упражнения по "тяжести" — определяет порядок внутри угла.
 *  compound barbell (1) > compound dumbbell (2) > compound machine (3) >
 *  compound cable (4) > compound bodyweight (5) > isolation (6) > one-arm (7).
 *  Первое упражнение в дне должно быть самым тяжёлым (наибольшее механическое натяжение). */
function strengthRank(ex: any): number {
  const n = (ex.name || '').toLowerCase();
  const eq = String(ex.equipment || '').toLowerCase();
  const isOneArm = /одной рукой|одной руке|single.?arm|unilateral/i.test(n);
  const isCompound = ex.type === 'compound';
  if (isOneArm) return 7;
  if (!isCompound) return 6;
  if (eq.includes('barbell') || eq.includes('smith')) return 1;
  if (eq.includes('dumbbell')) return 2;
  if (eq.includes('machine')) return 3;
  if (eq.includes('cable')) return 4;
  if (eq.includes('bodyweight') || eq.includes('suspension')) return 5;
  return 5;
}

/** Проверить, является ли упражнение задней дельтой (rear delt). */
/**
 * BB-JUNK: упражнения, не подходящие для гипертрофийного бодибилдинга.
 * Реабилитация/кор-стабильность/функционалка: pallof, bird dog, monster walks,
 * планки (изометрика), copenhagen, spiderman, jack, walkout, superman.
 * Эти упражнения не дают механического натяжения/метаболического стресса для роста мышц.
 * Разрешены: скручивания (crunch), подъём ног, гиперэкстензия (ягодицы/разгибатели спины).
 */
const BB_JUNK_PATTERNS: RegExp = /паллоф|pallof|bird.?dog|птиц.*собак|monster.?walk|резин|banded|band.?walk|планк|plank|copenhagen|копенгаген|spiderman|человек.?паук|plank.?jack|планк.*прыжк|walkout|шагающ.*планк|супермен|superman|gator.?walk|аллигатор|inchworm|гусениц|dead.?bug|мёртв.*жук|мертв.*жук|медбол|med.?ball|medicine.?ball|бросок.*мяч|рубк.*дров|рубк.*дерев|wood.?chop|ротацион|rotational|bradford|брэдфорд|наклон.*сидя.*штанг|seated.*good.?morning|отжимания.*(?:от пол|от скам|на колен|от колен)|push.?up|русск.*твист|russian.?twist|тяга.*за голов|pulldown.*behind|pike.*отжим|pike.*push|индийск|hindu.*push|скольжен.*стен|wall.?slide|кубан|cuban|мельниц.*гир|windmill|пугало|scarecrow|жим.*гир|kb.?press|bent.?press|наклонн.*жим.*гир|лэндмайн|landmine|вис.*полотен|вис.*гриф|вис.*турник|l.?сит|l.?sit|растяжк|stretch|мобильн|mobility|кошк.*корова|cat.?cow|колесо|ab.?wheel|горн.*ключ|mountain.*climb|90\/90|world.?greatest| йога|yoga/i;

/** Проверить, является ли упражнение BB-мусором (не для гипертрофии). */
function isBBJunk(ex: any): boolean {
  const n = (ex.name || '').toLowerCase();
  const id = (ex.id || '').toLowerCase();
  if (BB_JUNK_PATTERNS.test(n) || BB_JUNK_PATTERNS.test(id)) {
    // Исключения: брусья/dips — это ББ-упражнения, не отжимания
    if (/брус|dip/.test(n) && !/отжим.*от пол|narrow|алмаз/i.test(n)) return false;
    // Обратные отжимания от скамьи = bench dips (трицепс) — ок для ББ
    if (/обратн.*отжим|bench.*dip/i.test(n)) return false;
    return true;
  }
  // Изометрические планки/уголки — не для гипертрофии (но подъём ног в висе — OK для abs)
  if (/планк|plank|уголок|l[\s_-]?sit|hollow.?hold|лодочк|boat/.test(n) && !/подъём ног|leg.?raise|скручиван|crunch|пресс.*маши|паук/.test(n)) return true;
  return false;
}

/** PRO: Biomechanics-based filtering — исключить упражнения по ограничениям мобильности.
 *  Экспортируется для использования в cycle-to-plan.ts. */
export const MOBILITY_PATTERNS: Record<string, RegExp> = {
  shoulder: /overhead|жим.*стоя|ohp|за.*голов|behind.?neck|upright.?row|тяга.*подбород|арнольд|arnold/i,
  hip: /atg|ass.?to.?grass|глубок.*присед|гоблет.*присед|goblet.*squat|sissy|сисси/i,
  ankle: /присед.*штанг|back.?squat|front.?squat|выпад|lunge|болгар|bulgarian/i,
  lower_back: /станов.*классич|conventional.*deadlift|тяга.*наклон|barbell.?row|good.?morning|гудморнинг|румынск.*штанг|rdl.*barbell/i,
  wrist: /бицепс.*штанг|barbell.?curl|ez.?bar| француз.*штанг|french.?press.*barbell|skullcrusher.*barbell/i,
};

export function isMobilityRestricted(ex: any, restrictions?: string[]): boolean {
  if (!restrictions || restrictions.length === 0) return false;
  const n = (ex.name || '').toLowerCase();
  for (const r of restrictions) {
    const pattern = MOBILITY_PATTERNS[r];
    if (pattern && pattern.test(n)) return true;
  }
  return false;
}
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
/** Проверить, является ли мышца слабой (с учётом гранулярных групп).
 *  P0-3 (audit 2026-08): экспортирован для переиспользования в cycle-to-plan / bb-weakpoint / bb-selector.
 *  Поддерживает маппинг: chest_upper → chest, back_width → back, delt_mid → shoulders. */
export function isWeak(muscle: string, weakPoints: string[]): boolean {
  if (weakPoints.includes(muscle)) return true;
  // Гранулярные: delt_mid → shoulders, chest_upper → chest, back_width → back
  const parent = WEAK_TO_MUSCLE[muscle];
  if (parent && weakPoints.includes(parent)) return true;
  // Обратное: shoulders weak → delt_front/mid/rear тоже weak
  for (const wp of weakPoints) {
    const wpParent = WEAK_TO_MUSCLE[wp];
    if (wpParent === muscle) return true;
  }
  return weakPoints.includes(PARENT_MUSCLE[muscle] ?? '');
}
/** Развернуть родительские/гранулярные группы для проверки специализации.
 *  P0-2 (audit 2026-08): раньше разворачивало только shoulders → delt_*,
 *  но гранулярные слабые (chest_upper, back_width) НЕ разворачивались в канонические
 *  мышцы (chest, back), и специализация для них не работала (landmarksForRotation
 *  для 'chest_upper' возвращает null). Теперь разворачиваем все гранулярные ключи
 *  через WEAK_TO_MUSCLE в канонические мышцы. */
function expandWeakForSpecialization(weakPoints: string[]): string[] {
  const expanded = [...weakPoints];
  // Разворачиваем родительские группы в дочерние (shoulders → 3 delt)
  if (weakPoints.includes('shoulders')) expanded.push('delt_front', 'delt_mid', 'delt_rear');
  // P0-2: добавляем канонические мышцы для гранулярных слабых групп
  for (const wp of weakPoints) {
    const canonical = WEAK_TO_MUSCLE[wp];
    if (canonical && canonical !== wp && !expanded.includes(canonical)) {
      expanded.push(canonical);
    }
  }
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
 *  (calves/glutes/forearms имеют собственные landmark-записи).
 *  P0-2 (audit 2026-08): гранулярные слабые группы (chest_upper, chest_lower,
 *  back_width, back_thickness) коллапсируются к канонической мышце, чтобы
 *  landmarksForRotation нашёл запись и объём планировался корректно. */
function collapseKey(muscle: string): string {
  if (muscle === 'delt_front' || muscle === 'delt_mid' || muscle === 'delt_rear') return 'shoulders';
  // P0-2: гранулярные группы → канонические мышцы
  const canonical = WEAK_TO_MUSCLE[muscle];
  if (canonical && canonical !== muscle) return canonical;
  return muscle;
}
/** fix Z: дедуплицирует PRO-ключи тега по collapseKey.
 *  Возвращает {group, repKey}: group = collapseKey (ключ для volumeRotation/output),
 *  repKey = первый PRO-ключ группы (для workMax/FORCE_HEAVY.pool). */
interface MuscleGroupPlan { group: string; repKey: string; }
function dedupeMuscles(tag: string | undefined, excluded: Set<string>, focusGroup?: string, allowFocusInjection = true): MuscleGroupPlan[] {
  const out: MuscleGroupPlan[] = [];
  const seen = new Set<string>();
  const muscles = [...musclesForTag(tag)];
  // FIX-A4: если focusGroup задан и его нет в списке мышц тега — добавить.
  // Это гарантирует что мышца специализации (например glutes в FullBody) получит упражнения.
  if (allowFocusInjection && focusGroup && !muscles.includes(focusGroup) && !excluded.has(focusGroup)) {
    muscles.push(focusGroup);
  }
  for (const m of muscles) {
    if (excluded.has(m) || excluded.has(collapseKey(m))) continue;
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

/**
 * P1-4 (audit 2026-07): Brzycki inverse %1RM formula.
 * weight = 1RM × (1.0278 − 0.0278 × reps)
 * Более реп-корректная, чем PCT_FOR_RIR[rir] (которая даёт ~80% для RIR 3,
 * независимо от target reps). Для 18 reps → ~52% (реалистично для памп),
 * для 6 reps → ~86% (тяж), для 10 reps → ~75%.
 * RIR-коррекция: +1 RIR ≈ −2.5% веса (через множитель rirAdj).
 */
export function weightForRepMax(reps: number, workMax: number, rir: number, intensityMult: number): number {
  // Brzycki: 1RM = weight / (1.0278 − 0.0278 × reps) → weight = 1RM × (1.0278 − 0.0278 × reps)
  const brzycki = Math.max(0.4, Math.min(1.0, 1.0278 - 0.0278 * reps));
  // RIR-коррекция: RIR 0 = 100% бrzycki, RIR 4 = ~90% (−2.5% за каждый RIR)
  const rirAdj = Math.max(0.7, 1 - rir * 0.025);
  return Math.round(workMax * brzycki * rirAdj * intensityMult * 10) / 10;
}

/**
 * RIR упражнения в ББ-плане = фаза + характер дня + training focus.
 * strength: RIR 1-2 (Schoenfeld 2021), hypertrophy: RIR 2-3 (Roberts 2022), endurance: RIR 3-4.
 * Памп всегда ≥3 (Schoenfeld 2017: metabolic stress, не failure).
 */
export function bbRir(resolved: DayCharacter, phase: BBPhase, phaseWeek: number, focus?: BBTrainingFocus): number {
  const cfg = focus ? FOCUS_RIR_TABLE[focus] : FOCUS_RIR_TABLE.hypertrophy;
  // Phase adjustment: intensification/peaking → base-1, deload → forced 4
  let base = cfg.base;
  if (phase === 'deload') base = 4;
  else if (phase === 'intensification') base = Math.max(0, base - 1);
  // B1: peaking НЕ снижает base на 1 — пусть drift естественным образом доводит RIR
  // до 0 к концу пика. Ранее base-1 давало RIR=0 для ВСЕХ недель peaking (3 недели
  // на failure — нарушает supercompensation, Zatsiorsky 2006). Теперь:
  // strength base=1: W1=1, W2=0, W3=0 (1 субмакс. неделя перед пиком).
  // hypertrophy base=2: W1=2, W2=1, W3=1 (мягкий пик).
  // Per-week RIR drift: driftPer2Weeks applies every 2 weeks of the SAME phase.
  // strength/hypertrophy: drift=-1 → RIR drops 1 every 2 weeks (W1=base, W2=base-1, W3=base-1, W4=base-2).
  // endurance: drift=0 → RIR stays constant (metabolic focus, no neural peaking).
  const drift = Math.floor(phaseWeek / 2);
  const driftable = Math.max(0, base + cfg.driftPer2Weeks * drift);
  let rir = resolved === 'тяж' ? driftable : driftable + 1;
  if (phase === 'deload') rir = Math.max(3, Math.min(4, rir));
  if (resolved === 'памп') rir = Math.max(cfg.pumpRir, rir);
  return clampRir(rir);
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
function sessionShareFor(mavRot: number, sessionsPerWeek: number, role: 'primary' | 'accessory', muscle?: string, pedAdapt?: PEDAdaptation, isFemale?: boolean): number {
  // PED boost для accessory arms/shoulders — на курсе нужен больший объём
  const pedArmBoost = pedAdapt && pedAdapt.combinedMrvMultiplier >= 1.3 && muscle && ['triceps', 'biceps', 'shoulders', 'forearms'].includes(muscle) ? 1.4 : 1.0;
  // Glute boost для женщин: glutes получают +20% объёма (женская физиология — больший гипертрофический потенциал ягодичных).
  const gluteBoost = isFemale && muscle === 'glutes' ? 1.2 : 1.0;
  const finalMult = pedArmBoost * gluteBoost;
  // P0-1: arms (biceps/triceps/forearms) — accessory factor повышен с 0.6 до 0.85.
  // Раньше: biceps MAV=8, 2×/нед → 8/2×0.6=2.4 → 2 сета/сессию → 1 сет на упражнение (разминка!).
  // Schoenfeld 2016: минимум 2-3 рабочих сета на упражнение, 8-12 сетов/нед на мышцу.
  // Arms — малые мышцы, но требуют dedicated объёма, а не остаточного (как грудныеflyes).
  const isArmMuscle = muscle === 'biceps' || muscle === 'triceps' || muscle === 'forearms';
  if (sessionsPerWeek <= 1) {
    // P5 + BUG-B2: cap на 1×/нед — Schoenfeld 2016 оптимум 12-16 сетов/день для advanced.
    const gluteFactor = isFemale && muscle === 'glutes' ? 1.4 : 1.0;
    if (role === 'accessory') {
      const accFactor = isArmMuscle ? 0.7 : 0.5;
      return Math.max(3, Math.min(Math.round(mavRot * accFactor * gluteFactor), 8));
    }
    return Math.min(Math.round(mavRot * 1.0 * gluteFactor), 16);
  }
  if (sessionsPerWeek === 2) {
    const base = mavRot / 2;
    const factor = role === 'primary' ? 1.4 : (isArmMuscle ? 0.85 : 0.6);
    return Math.max(isArmMuscle ? 3 : 1, Math.round(base * factor * finalMult));
  }
  // 3+ сессии/нед — Schoenfeld 2016: при высокой частоте каждый подход ценнее
  // (frequency bonus), поэтому на сессию нужно МЕНЬШЕ объёма, чем при 2×/нед.
  // Раньше: primary factor=1.5 (>1.4 при 2×/нед) → 3×/нед давало БОЛЬШЕ на сессию.
  // Теперь: factor=1.2 (<1.4) — отражает распределение MAV на больше сессий.
  const base = mavRot / sessionsPerWeek;
  const factor = role === 'primary' ? 1.2 : (isArmMuscle ? 0.85 : 0.65);
  return Math.max(isArmMuscle ? 2 : 1, Math.round(base * factor * finalMult));
}

/** fix D: недельный кап объёма каждой мышцы по её истинному MRV (после всех множителей).
 *  + per-exercise кап: максимум 8 сетов на упражнение (ББ-практика).
 *  C6: isDeload — во время deload floor=2 НЕ применяется (4 упр × 2 = 8 сетов
 *  нарушает intended deload ~4-6 сетов). floor=1 для deload, floor=2 для рабочих недель. */
function normalizeWeekMrv(weekSessions: BBSession[], mrvByMuscle: Record<string, number>, isDeload: boolean = false): void {
  const syncWorkSets = (ex: BBExercise): void => {
    const target = Math.max(0, ex.sets || 0);
    const current = Array.isArray(ex.workSets) ? ex.workSets : [];
    if (current.length > target) {
      ex.workSets = current.slice(0, target);
    } else if (current.length < target && current.length > 0) {
      const template = current[current.length - 1];
      ex.workSets = [...current, ...Array.from({ length: target - current.length }, () => ({ ...template }))];
    }
  };
  const sums: Record<string, { total: number; exs: BBExercise[] }> = {};
  for (const s of weekSessions) {
    for (const ex of s.exercises) {
      const info = sums[ex.muscle] || (sums[ex.muscle] = { total: 0, exs: [] });
      info.total += ex.sets;
      info.exs.push(ex);
    }
  }
  for (const [m, info] of Object.entries(sums)) {
    // Per-exercise cap: не более 8 сетов на одно упражнение (ББ-практика).
    // BUG-B8: для малых мышц (forearms/calves/abs) cap = 6 — они не требуют
    // большого объёма за одно упражнение (Schoenfeld: small muscles 4-6 сетов/упр).
    // P1-4: per-exercise FLOOR — минимум 2 сета (1 сет = разминка, не рабочий объём).
    const perExCap = (m === 'forearms' || m === 'calves' || m === 'abs') ? 6 : 8;
    const floor = isDeload ? 1 : 2; // C6: deload floor=1, рабочая неделя floor=2
    for (const ex of info.exs) {
      if (ex.sets > perExCap) ex.sets = perExCap;
      if (ex.sets < floor) ex.sets = floor;
      syncWorkSets(ex);
    }
    // Пересчитать total после per-exercise капа
    info.total = info.exs.reduce((s, ex) => s + ex.sets, 0);
    // MRV-кап
    const cap = mrvByMuscle[m];
    if (cap && info.total > cap) {
      // D2: Per-day volume budget with redistribution.
      // Если даже при floor=2 для всех упражнений сумма > cap, удалить последние
      // (accessory/памп) упражнения целиком, а не резать до 1 сета.
      // Это даёт чистый план без 1-set "разминочных" упражнений.
      const minTotal = info.exs.length * floor; // C6: deload floor=1, иначе 2
      if (minTotal > cap) {
        // Удалить последние упражнения пока sum(floor × remaining) <= cap
        // Сортируем: primary первыми (accessory удаляем раньше).
        // BUG-FIX: добавлена вторичная сортировка по strengthRank — compound
        // упражнения сохраняются раньше isolation (compound даёт больше гипертрофии).
        const sortedExs = [...info.exs].sort((a, b) => {
          if (a.role === 'primary' && b.role !== 'primary') return -1;
          if (a.role !== 'primary' && b.role === 'primary') return 1;
          // Одинаковая роль → compound раньше isolation (меньший rank = тяжелее = сохраняем)
          return strengthRank(a) - strengthRank(b);
        });
        const toRemove: BBExercise[] = [];
        let keptCount = info.exs.length;
        // BUG-FIX: гарантировать минимум 1 упражнение (floor сетов) даже если cap < floor.
        // Раньше при cap=0 или cap=1 удалялись ВСЕ упражнения → мышца без объёма.
        while (keptCount * floor > cap && keptCount > 1) {
          const removed = sortedExs.pop()!;
          toRemove.push(removed);
          keptCount--;
        }
        // Удалить из сессий
        for (const ex of toRemove) {
          for (const s of weekSessions) {
            const idx = s.exercises.indexOf(ex);
            if (idx >= 0) {
              s.exercises.splice(idx, 1);
              // D2: explicit rationale — почему упражнение удалено
              if (!ex.comment) ex.comment = '';
              ex.comment += ` | ⚠ Исключено: MRV=${cap} сетов/нед для ${m} достигнут. Упражнение удалено для соблюдения бюджета объёма.`;
            }
          }
        }
        // Пересчитать для оставшихся
        info.exs = info.exs.filter(e => !toRemove.includes(e));
        info.total = info.exs.reduce((s, ex) => s + ex.sets, 0);
        if (info.total <= cap) continue; // уже в норме
      }
      // P0-2: пропорциональное распределение с остатком (round съедает кап).
      // Раньше: factor=24/26=0.923, round(4×0.923)=round(3.69)=4 → ничего не изменилось.
      // Теперь: floor для большинства + распределение остатка на первые упражнения.
      const target = cap;
      const factor = target / info.total;
      let allocated = 0;
      const rawSets = info.exs.map(ex => ex.sets * factor);
      // FIX-A7: floor=2 (не 1) — 1 сет = разминка, не рабочий объём (Schoenfeld 2016: минимум 2-3 рабочих сета).
      // C6: deload → floor=1 (разгрузка допускает 1 сет на упражнение).
      const floored = rawSets.map(v => Math.max(floor, Math.floor(v)));
      allocated = floored.reduce((s, v) => s + v, 0);
      // Если allocated > target (мало упражнений, все ≥floor), урезаем последние до floor.
      let overflow = allocated - target;
      for (let i = info.exs.length - 1; i >= 0 && overflow > 0; i--) {
        const cut = Math.min(overflow, Math.max(0, floored[i] - floor));
        floored[i] -= cut;
        overflow -= cut;
      }
      // Распределить остаток (target - allocated) на первые упражнения (compound primary первыми)
      let remainder = target - floored.reduce((s, v) => s + v, 0);
      for (let i = 0; i < info.exs.length && remainder > 0; i++) {
        floored[i]++;
        remainder--;
      }
      for (let i = 0; i < info.exs.length; i++) {
        info.exs[i].sets = Math.max(floor, floored[i]);
        syncWorkSets(info.exs[i]);
      }
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
/** Форматирование темпа в понятные инструкции (2-0-X-0 -> "Опуск 2 сек..."). */
function formatTempoUser(tempo: string): string {
  if (!tempo || tempo === 'auto') return 'Контролируемый темп';
  const parts = tempo.split('-').map(p => p.trim());
  const desc = [];
  if (parts[0]) desc.push(`Опуск ${parts[0]} сек`);
  if (parts[1]) desc.push(`Низ ${parts[1]} сек`);
  if (parts[2]) desc.push(`Вверх ${parts[2]}`);
  if (parts[3]) desc.push(`Верх ${parts[3]}`);
  return desc.join(', ');
}

function buildExComment(
  muscle: string, name: string, role: 'primary' | 'accessory',
  character: DayCharacter, sets: number, reps: number, weight: number, rir: number,
  weakPoints: string[], focusGroup: string | undefined,
  phase: BBPhase, tempo: string, restSec: number,
  isSubstituted: boolean,
  exerciseId?: string,
  trainingFocus?: BBTrainingFocus,
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
  
  // Конкретные инструкции по выполнению (углы, хват, техника).
  // FIX-A8: dual-key lookup — EN id (bench_press) + RU name (жим штанги лёжа).
  // Сначала точный match по exerciseId, потом по name, потом по lowercased name.
  const execNote = exerciseId
    ? EXECUTION_NOTES[exerciseId] || EXECUTION_NOTES[name] || EXECUTION_NOTES[(name || '').toLowerCase()]
    : EXECUTION_NOTES[name] || EXECUTION_NOTES[(name || '').toLowerCase()];
  if (execNote) parts.push(execNote);
  
  // Понятный темп
  parts.push(`Темп: ${formatTempoUser(tempo)}. Отдых: ${restSec}с`);
  
  const warn = exerciseRiskWarning(name);
  if (warn) parts.push(warn);
  parts.push(formatExerciseInstructions({
    exerciseId,
    exerciseName: name,
    muscle,
    role,
    phase,
    trainingFocus,
    tempo,
    restSeconds: restSec,
  }));
  return parts.join('. ');
}

/** Разминочная пирамида для compound упражнений.
 *  FIX-B5: проф-тренерская пирамида (bar×15 → 50%×10 → 70%×5 → 80%×3 → 90%×1).
 *  Раньше: 2-4 сета с 30-85%, фиксированные reps 6-8.
 *  Теперь: градуированная пирамида с уменьшением reps по мере роста веса. */
export function buildWarmup(workWeight: number, isCompound: boolean): { load: number; reps: number }[] {
  if (!isCompound || workWeight <= 0) return [];
  // Проф-пирамида: bar (20кг) → 50% → 70% → 80% → (90% только для тяжёлых)
  const barWeight = 20;
  const warmups: { load: number; reps: number }[] = [];
  // Set 1: empty bar × 15 (разминка суставов, кровоток)
  if (workWeight > barWeight * 2) {
    warmups.push({ load: barWeight, reps: 15 });
  }
  // Set 2: 50% × 10
  warmups.push({ load: Math.round(workWeight * 0.5), reps: 10 });
  // Set 3: 70% × 5
  warmups.push({ load: Math.round(workWeight * 0.7), reps: 5 });
  // Set 4: 80% × 3 (только если workWeight > 60кг — иначе избыток)
  if (workWeight > 60) {
    warmups.push({ load: Math.round(workWeight * 0.8), reps: 3 });
  }
  // Set 5: 90% × 1 (только для тяжёлых упражнений > 100кг — powerlifter-style)
  if (workWeight > 100) {
    warmups.push({ load: Math.round(workWeight * 0.9), reps: 1 });
  }
  return warmups;
}

// BUG-B13/B21: STRETCH_DB и addStretching удалены как мёртвый код (вызов закомментирован с Jul 16).
// Растяжка не относится к ББ-гипертрофии и занимала слоты в плане.

// fix E: реалистичные значения workMax по умолчанию (кг) — используются,
// только если пользователь не ввёл свои рабочие максимумы. Убирает магический «80»
// и даёт осмысленные веса в сгенерированном плане даже без ввода.
export const DEFAULT_WORKMAX: Record<string, number> = {
  chest: 100, back: 120, shoulders: 70, arms: 50,
  quads: 140, hamstrings: 100, glutes: 150, calves: 90, abs: 80, traps: 90,
  delt_front: 70, delt_mid: 70, delt_rear: 70, forearms: 45,
  biceps: 45, triceps: 50,
};
export const defaultWorkMax = (key: string): number => {
  const collapsed = collapseKey(key);
  const val = DEFAULT_WORKMAX[collapsed] ?? DEFAULT_WORKMAX[key];
  if (val === undefined) {
    // C7: warn на неизвестный ключ — помогает отловить опечатки в muscle names.
    console.warn(`[BB] defaultWorkMax: unknown muscle key "${key}" (collapsed: "${collapsed}"), using fallback 80kg`);
    return 80;
  }
  return val;
};

/**
 * C10: TAG_PRIMARY_MUSCLES — вынесено из buildSession на уровень модуля.
 * Зависит только от dayInRotation (для чередования quads/hamstrings на Legs-днях).
 * Ранее реконструировалось при каждом вызове buildSession (~100+ раз на план).
 */
function getTagPrimaryMuscles(dayInRotation: number, highVolumeLegs = false): Record<string, Set<string>> {
  const legPrimary = highVolumeLegs ? new Set(['quads', 'hamstrings', 'glutes']) : (dayInRotation % 2 === 0 ? new Set(['hamstrings', 'glutes']) : new Set(['quads', 'glutes']));
  const lowerPrimary = highVolumeLegs ? new Set(['quads', 'hamstrings', 'glutes', 'calves']) : (dayInRotation % 2 === 0 ? new Set(['hamstrings', 'glutes', 'calves']) : new Set(['quads', 'glutes', 'calves']));
  return {
    Chest: new Set(['chest']),
    Back: new Set(['back']),
    Shoulders: new Set(['shoulders']),
    Arms: new Set(['biceps', 'triceps', 'forearms']),
    Legs: legPrimary,
    Push: new Set(['chest', 'shoulders', 'triceps']),
    Pull: new Set(['back', 'biceps', 'traps']),
    ChestBack: new Set(['chest', 'back']),
    ShouldersArms: new Set(['shoulders', 'biceps', 'triceps', 'forearms']),
    Upper: new Set(['chest', 'back', 'shoulders', 'biceps', 'triceps']),
    Lower: lowerPrimary,
    FullBody: new Set(['chest', 'back', 'quads', 'hamstrings', 'shoulders', 'arms']),
    Torso: new Set(['chest', 'back', 'shoulders']),
    Limbs: new Set(['quads', 'hamstrings', 'glutes', 'biceps', 'triceps', 'calves']),
    UpperPower: new Set(['chest', 'back', 'shoulders', 'biceps', 'triceps']),
    LowerPower: new Set(['quads', 'hamstrings', 'glutes', 'calves']),
    UpperHyp: new Set(['chest', 'back', 'shoulders', 'biceps', 'triceps']),
    LowerHyp: new Set(['quads', 'hamstrings', 'glutes', 'calves']),
    // A1: LegsBiceps — primary = quads (legs) + biceps (arms). Hamstrings/calves = accessory.
    // Ранее biceps отсутствовал в TAG_PRIMARY → всегда accessory на своём «дедицинном» дне.
    LegsBiceps: new Set(['quads', 'biceps']),
    Glutes: new Set(['glutes', 'hamstrings']),
    GlutesHams: new Set(['glutes', 'hamstrings']),
  };
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
  rotationBlockIds: string[] = [],
  favoriteIds: string[] = [],
  excludeIds: string[] = [],
  avoidAxialLoad: boolean = false,
  equipmentList: string[] = [],
  methodology: SessionMethodology = 'compound_first',
  isFemale: boolean = false,
  intensityTechnique?: IntensityTechnique,
  autoDeload?: boolean,
  loadStrategy?: LoadStrategy,
  autoRegResult?: { volumeMultiplier: number; topSetPctMultiplier: number; rirShift: number },
  specialization?: boolean,
  pedDoses?: Record<string, number>,
  courseIntensity?: CourseIntensity,
  onCourse: boolean = false,
  sex: 'male' | 'female' = 'male',
  weekLocalUsed: Map<string, Set<string>> = new Map(),
  primaryBySlot: Map<string, string> = new Map(),
  trainingFocus?: BBTrainingFocus,
  eccentricMult?: number,
  mobilityRestrictions?: string[],
  trainingYears?: number,
  bodyweightCapability?: BBBuilderInput['bodyweightCapability'],
): BBSession {
  const character = sched.character as DayCharacter;
    // Focus-группа инжектируется в сессию, только если тег совместим:
    // FullBody — всегда, Legs/Lower — только для ног/ягодиц,
    // Upper/Push/Pull — только для верхних групп.
    const focusIsLegs = !!focusGroup && ['quads', 'hamstrings', 'glutes', 'calves'].includes(collapseKey(focusGroup));
    const focusIsUpper = !!focusGroup && ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'traps', 'arms'].includes(collapseKey(focusGroup));
    const tagHasFocus = !!focusGroup && (
      musclesForTag(sched.sessionTag).some(m => collapseKey(m) === collapseKey(focusGroup))
      || /FullBody/.test(sched.sessionTag || '')
      || (/Legs|Lower|Glute/i.test(sched.sessionTag || '') && focusIsLegs)
      || (/Upper|Push|Pull|Chest|Back|Shoulders|Arms/i.test(sched.sessionTag || '') && focusIsUpper)
    );
    const musclePlans = dedupeMuscles(sched.sessionTag, excludedMuscles, focusGroup, tagHasFocus);
  const exercises: BBExercise[] = [];

  // BUG-B11: leadMuscle для orderSessionExercises — основная мышца дня (первый compound).
  // Раньше: orderSessionExercises брал tagMuscles[0] → FullBody всегда 'chest' даже в день ног.
  // Теперь: вычисляем leadMuscle ОДИН раз для сессии и передаём в orderSessionExercises.
  const LEAD_MUSCLE: Record<string, string> = {
    Chest: 'chest', Back: 'back', Shoulders: 'shoulders', Arms: 'triceps',
    Push: 'chest', Pull: 'back', ChestBack: 'chest', ShouldersArms: 'shoulders',
    Upper: 'chest', UpperPower: 'chest', UpperHyp: 'chest',
    Torso: 'chest', Limbs: 'quads', LegsBiceps: 'quads', Glutes: 'glutes', GlutesHams: 'glutes',
    Legs: dayInRotation % 2 === 0 ? 'hamstrings' : 'quads',
    Lower: dayInRotation % 2 === 0 ? 'hamstrings' : 'quads',
    LowerPower: dayInRotation % 2 === 0 ? 'hamstrings' : 'quads',
    LowerHyp: dayInRotation % 2 === 0 ? 'hamstrings' : 'quads',
    FullBody: '', // FullBody — особый случай: primary определяется по musclePrimaryAssigned
  };
  const sessionLeadMuscle = LEAD_MUSCLE[sched.sessionTag || ''] || ((musclePlans[0] as any)?.group || '');
  // FB primary distribution — ВНУТРИ buildSession (надёжнее, чем в buildBBPlan).
  // Day 1: chest+back primary, Day 2: legs primary, Day 3: shoulders+arms primary.
  // Блокируем не-fbPrimary мышцы ДО цикла, чтобы они не получили role='primary'.
  if (sched.sessionTag === 'FullBody') {
    musclePrimaryAssigned.clear();
    const fbSchedule = [['chest', 'back'], ['quads', 'hamstrings'], ['shoulders', 'arms']];
    const fbPrimary = fbSchedule[(dayInRotation - 1) % fbSchedule.length];
    for (const mp of musclePlans) {
      if (!fbPrimary.includes(mp.group)) musclePrimaryAssigned.add(mp.group);
    }
  }
  // S-MRV: Системный бюджет утомления на день.
  // Формула: dailyCap × S_MRV_FACTOR × pedMult × levelMult
  const levelMultMap: Record<string, number> = { beginner: 0.9, intermediate: 1.0, advanced: 1.15, enhanced: 1.3 };
  const levelMult = levelMultMap[level] ?? 1.0;
  // Экзотика (гиря/олимп/стронгмен/мобилити) — только для advanced/enhanced; каноника по умолчанию.
  const allowExotic = level === 'advanced' || level === 'enhanced';
  const dayFatigueBudget = Math.round(dailyCap * S_MRV_FACTOR * (pedAdapt?.combinedRecoveryMultiplier ?? 1) * levelMult);
  
  // Pre-calculate each muscle's expected volume to allocate budget proportionally
  const plans: MusclePlan[] = [];
  let totalExpectedFatigue = 0;
  const sessionSelectedIds: string[] = [...preSelectedIds, ...rotationBlockIds];
  const sessionSelectedNames: string[] = [...preSelectedNames];
  const rotationNamesSet = new Set(preSelectedNames); // cross-session rotation only (excludes prior days/weeks, not this session's own picks)
  // У опытного enhanced-профиля ротация упражнений спины не должна оставлять
  // вторую back-сессию с одним движением. Повтор разрешён между сессиями,
  // но внутри одной сессии dedupe по функциональному паттерну остаётся.
  const relaxBackRotation = level === 'enhanced' && (trainingYears ?? 0) >= 3;
  
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
    // C10: вынесено в getTagPrimaryMuscles (модульный уровень) — без реконструкции на каждый вызов.
    const TAG_PRIMARY_MUSCLES = getTagPrimaryMuscles(dayInRotation, level === 'enhanced' && (trainingYears ?? 0) >= 3);
    const tagPrimaries = sched.sessionTag ? TAG_PRIMARY_MUSCLES[sched.sessionTag] : undefined;
    // Glute priority для женщин ИЛИ при focusGroup='glutes': glutes всегда primary в любом ножном дне.
    // Также для FullBody — glutes добавляется в fbPrimaryToday при focus.
    const isGlutePriority = (isFemale || focusGroup === 'glutes') && muscle === 'glutes' && /leg|lower|glute|limbs|fullbody/i.test(sched.sessionTag || '');
    const isMainMuscle = !tagPrimaries || tagPrimaries.has(muscle) || isGlutePriority;
    const SMALL_NEVER_PRIMARY = new Set(['traps', 'forearms', 'calves']);
    // FB: проверить, является ли мышца fbPrimary для этого дня.
    // Если нет — НЕ primary, даже если musclePrimaryAssigned почему-то не сработал.
    // ИСКЛЮЧЕНИЕ: focusGroup — мышца специализации ВСЕГДА допускается до primary (даже в FullBody).
    const fbPrimaryToday = sched.sessionTag === 'FullBody'
      ? [['chest', 'back'], ['quads', 'hamstrings'], ['shoulders', 'arms']][(dayInRotation - 1) % 3]
      : null;
    const fbAllowsPrimary = fbPrimaryToday ? (fbPrimaryToday.includes(muscle) || muscle === focusGroup) : true;
    // ★ Primary-dominance: в multi-day только lead-мышца (back в Pull, chest в Push)
    // должна стать primary. Раньше ЛЮБАЯ mainMuscle в тяж-дне (biceps/traps в Pull,
    // triceps в Push) получала primary → exerciseCount=4 и sessionShareFor factor=1.4
    // → accessories перевешивали lead-мышцу (back=3ex vs biceps+traps+delt=7ex).
    // Теперь: primary назначается только если ещё нет primary (size===0) ИЛИ это
    // lead-мышца дня. WeakPoints обходят через отдельное условие ниже.
    // ИСКЛЮЧЕНИЕ: dual-primary теги (ChestBack, ShouldersArms, Upper, Torso) — 2 primary
    // (chest+back, shoulders+arms), иначе back=1ex в ChestBack — недопустимо.
    const DUAL_PRIMARY_TAGS = new Set(['ChestBack', 'ShouldersArms', 'Upper', 'UpperPower', 'UpperHyp', 'Torso', 'LegsBiceps']);
    // Для опытного enhanced: Lower-день получает 2 primary (quads+hamstrings),
    // а не только одну группу по ротации. Это даёт обеим группам полноценный бюджет.
    const highVolumeLegsSession = level === 'enhanced' && (trainingYears ?? 0) >= 3 && /Legs|Lower|LowerPower|LowerHyp/.test(sched.sessionTag || '');
    const maxPrimaries = highVolumeLegsSession ? 4 : (DUAL_PRIMARY_TAGS.has(sched.sessionTag || '') ? 2 : 1);
    // Для high-volume legs: quads принудительно primary даже если hamstrings
    // уже занял primary-слот. Без этого quads всегда accessory в чётные дни.
    const forceLegsPrimary = highVolumeLegsSession && ['quads', 'hamstrings', 'glutes'].includes(muscle);
    // focusGroup: мышца специализации получает primary-слот даже если maxPrimaries достигнут.
    const isFocusMuscle = focusGroup && (muscle === focusGroup || isWeak(muscle, [focusGroup]));
    if (!musclePrimaryAssigned.has(muscle) && (resolved === 'тяж') && isMainMuscle && !SMALL_NEVER_PRIMARY.has(muscle) && fbAllowsPrimary && (musclePrimaryAssigned.size < maxPrimaries || muscle === sessionLeadMuscle || isFocusMuscle || forceLegsPrimary)) {
      role = 'primary'; musclePrimaryAssigned.add(muscle);
    }
    // High-volume legs: принудительно primary для quads/hamstrings/glutes
    // даже если maxPrimaries уже достигнут.
    if (forceLegsPrimary && !musclePrimaryAssigned.has(muscle) && !SMALL_NEVER_PRIMARY.has(muscle)) {
      role = 'primary'; musclePrimaryAssigned.add(muscle);
    }
    // Слабые группы (weakPoints): структурное повышение до primary —
    // compound-первым + больше упражнений + объём, а не только +15 в скоринге.
    // БЕЗ проверки musclePrimaryAssigned: слабые мышцы получают primary в КАЖДОЙ
    // сессии (двойной стимул в неделю: тяж + памп → оба с compound-первым).
    if (isMainMuscle && isWeak(muscle, weakPoints)) {
      role = 'primary'; musclePrimaryAssigned.add(muscle);
    }
    // focusGroup: принудительно primary в любой сессии, где мышца присутствует.
    if (isFocusMuscle && !excludedMuscles.has(repKey)) {
      role = 'primary'; musclePrimaryAssigned.add(muscle);
    }
    // Small FORCE_HEAVY muscles (traps/forearms/calves) never lead a day — always accessory
    // unless they're the day's explicit lead. Stops shrugs / wrist-curls stealing the primary
    // lead on pump days.
    if (role === 'primary' && SMALL_NEVER_PRIMARY.has(muscle)) role = 'accessory';
    // Force the day's lead compound muscle to primary so the session opens with a big compound
    // (bench / squat / row / OHP / close-grip bench) instead of a small isolation on pump days.
    const leadMuscle = sessionLeadMuscle;
    if (muscle === leadMuscle && !excludedMuscles.has(repKey)) { role = 'primary'; musclePrimaryAssigned.add(muscle); }
    const mavRot = muscleVolumeRotation[muscle] || 0;
    const sessionsForMuscle = muscleSessionCount[muscle] || 1;
    let sets = sessionShareFor(mavRot, sessionsForMuscle, role, muscle, pedAdapt, isFemale);
    // High-volume enhanced back: это прямой бюджет спины на одну сессию,
    // а не общий лимит Pull-дня. Минимум зависит от подтверждённого стажа.
    // 3+ лет — 18 сетов, 6+ лет — 22 сета до дальнейшего fatigue/recovery fit.
    if (muscle === 'back' && level === 'enhanced' && (trainingYears ?? 0) >= 3 && phase !== 'deload') {
      sets = Math.max(sets, (trainingYears ?? 0) >= 6 ? 22 : 18);
    }
    // High-volume enhanced legs: ноги тоже получают повышенный минимум,
    // а не остаточный бюджет после рук/пресса.
    if (['quads', 'hamstrings', 'glutes'].includes(muscle) && level === 'enhanced' && (trainingYears ?? 0) >= 3 && phase !== 'deload') {
      sets = Math.max(sets, (trainingYears ?? 0) >= 6 ? 20 : 14);
    }
    // Glutes гарантированно получают минимум в каждой Lower-сессии,
    // даже если они не primary по ротации.
    if (muscle === 'glutes' && level === 'enhanced' && (trainingYears ?? 0) >= 3 && /Legs|Lower/.test(sched.sessionTag || '') && phase !== 'deload') {
      sets = Math.max(sets, (trainingYears ?? 0) >= 6 ? 8 : 6);
    }
    // High-volume enhanced chest/shoulders: грудь и плечи получают
    // повышенный минимум, а не остаток после спины.
    if (['chest', 'shoulders'].includes(muscle) && level === 'enhanced' && (trainingYears ?? 0) >= 3 && phase !== 'deload') {
      sets = Math.max(sets, (trainingYears ?? 0) >= 6 ? 14 : 10);
    }
    // Shoulders в Upper-днях: даже если плечи не lead-мышца, опытный enhanced
    // должен получать минимум работы на среднюю дельту в каждой Upper-сессии.
    if (muscle === 'shoulders' && level === 'enhanced' && (trainingYears ?? 0) >= 3 && /Upper|Push|Pull/.test(sched.sessionTag || '') && phase !== 'deload') {
      sets = Math.max(sets, 6);
    }
    // Руки в Push/Pull: опытный enhanced должен получать минимум работы
    // на biceps в Pull и triceps в Push в каждой сессии.
    if (muscle === 'biceps' && level === 'enhanced' && (trainingYears ?? 0) >= 3 && /Pull|Upper|Arms/.test(sched.sessionTag || '') && phase !== 'deload') {
      sets = Math.max(sets, (trainingYears ?? 0) >= 6 ? 8 : 6);
    }
    if (muscle === 'triceps' && level === 'enhanced' && (trainingYears ?? 0) >= 3 && /Push|Upper|Arms/.test(sched.sessionTag || '') && phase !== 'deload') {
      sets = Math.max(sets, (trainingYears ?? 0) >= 6 ? 8 : 6);
    }
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
    // FIX-B1: phaseRepShift — rep range двигается по неделям внутри фазы.
    // Как RIR дрифтит вниз (drift = floor(phaseWeek/2)), так и reps снижаются
    // для поддержания интенсивности. W1 accumulation = 12 reps, W3 = 11, W5 = 10.
    // deload — без shift (recovery, высокий reps сохранён).
    const repShift = phase === 'deload' ? 0 : Math.floor(phaseWeek / 2);
    const shiftedMin = Math.max(3, repMin - repShift);
    const shiftedMax = Math.max(shiftedMin + 2, repMax - repShift);
    // B4: для non-deload фаз используем shiftedMin (нижняя граница) вместо midpoint.
    // Ранее midpoint accumulation [10,15] = 12 = repCap в prescribeLoad → неделя 2
    // сразу получала +5% вес и reps=8 (нет окна для rep progression).
    // Теперь: W1=10, W2=11, W3=12 (prescribeLoad), W4=8+weight jump — корректный
    // double progression с 3 неделями rep buildup. Deload сохраняет midpoint
    // (больше reps = легче вес для разгрузки).
    const reps = phase === 'deload' ? Math.round((shiftedMin + shiftedMax) / 2) : shiftedMin;
    // RIR: bbRir (учитывает phase + phaseWeek + характер). Делод → RIR 3-4.
    const rir = bbRir(resolved, phase, phaseWeek, trainingFocus);
    const wm = workMax[repKey] || PRO_WORKMAX_RATIO[repKey]?.(workMax) || defaultWorkMax(repKey);
    // P1-4 (audit 2026-07): Brzycki inverse %1RM formula — реп-корректный вес.
    // Раньше: weight = workMax × intensityMult × PCT_FOR_RIR[rir] (не учитывала reps).
    // Теперь: weight = workMax × (1.0278 − 0.0278 × reps) × rirAdj × intensityMult.
    // Для 18 reps → ~52% (памп), для 6 reps → ~86% (тяж), для 10 reps → ~75%.
    const pct = PCT_FOR_RIR[rir] ?? 0.9; // fallback если Brzycki не подходит
    let weight = weightForRepMax(reps, wm, rir, phaseCfg.intensityMultiplier);
    // P4: Eccentric overload (Schoenfeld 2021) - advanced/enhanced can handle 110-120% eccentric
    if (eccentricMult && eccentricMult > 1.0 && role === 'primary') {
      weight = Math.round(weight * eccentricMult * 10) / 10;
    }
    // P1-8 (audit 2026-07): pre_exhaust methodology → compound weight ×0.90.
    // После pre-exhaust изоляции целевая мышца уже утомлена → compound Fails ниже
    // обычного на ~10-15% (Augustsson 2003; Gentil 2013). Авто-снижение веса compound.
    if (methodology === 'pre_exhaust' && role === 'primary') {
      weight = Math.round(weight * 0.90 * 10) / 10;
    }
    const accessoryCount = ACCESSORY_2X_GROUPS.has(muscle) ? 2 : 1;
    // exerciseCount зависит от уровня И PED — на курсе больше тяжёлых compounds.
    // В multi-днях (Push/Pull с 3+ мышцами) ограничить big muscle primary до 3 —
    // оставить бюджет для arms. В solo-днях (Chest/Back) — 4 (вся сессия на одну мышцу).
    const isMultiDay = musclePlans.length > 2;
    const pedBoost = pedAdapt ? Math.max(0, Math.round((pedAdapt.combinedMrvMultiplier - 1.0) / 0.2)) : 0;
    // B13: levelBase монотонно растёт с уровнем (beginner=1, intermediate=2, advanced=3, enhanced=4).
    const levelBase = level === 'beginner' ? 1 : level === 'intermediate' ? 2 : level === 'enhanced' ? 4 : 3;
    const isSingleFreq = (muscleSessionCount[muscle] || 1) === 1;
    const isArm = ['triceps','biceps','shoulders','forearms','arms'].includes(muscle);
    const isLeg = ['quads','hamstrings','glutes','calves'].includes(muscle);
    const onPED = pedAdapt ? pedAdapt.combinedMrvMultiplier >= 1.3 : false;
    // ★ E: Снижен exerciseCount — качество > количество.
    // Primary: 2-4 упр на мышцу (3 для multi-day, 4 single-freq natural, 5 PED single-freq)
    // Accessory: 1-2 упр (2 для arms на PED)
    // FIX (Баг 2): ранее ACCESSORY_2X_GROUPS (delt/biceps/triceps/forearms/shoulders/arms/calves/abs)
    // не включал chest/back/quads/hamstrings/glutes — у этих больших мышц accessory всегда
    // был exerciseCount=1, поэтому diversity-логика выбирала ОДНО упражнение (всегда первый
    // angle-class = fly/растяжка для груди). Расширяем ACCESSORY_2X_GROUPS на big-muscle
    // accessory тоже — даёт 2 изоляции на добивку, что устраняет «одна и та же растяжка».
    const isBigMuscle = ['chest','back','quads','hamstrings','glutes','shoulders'].includes(muscle);
    // ★ Primary-dominance fix: primary мышца дня должна иметь больше упражнений, чем
    // любая accessory. Раньше в multi-day (Pull: back/biceps/shoulders/traps/forearms)
    // primary=3, а accessories суммарно = 2+2+2+1 = 7 (back=3 vs accessories=7 — бред!).
    // Теперь: multi-day primary = 4 (доминирует), multi-day accessory = 1 (добивка),
    // кроме biceps/triceps на PED (=2). В solo-day (1-2 мышцы) — как раньше (accessory=2).
    const backProfile = muscle === 'back' ? backVolumeProfile(level, trainingYears) : { targetMult: 1, capMult: 1, extraExercises: 0 };
    const legProfile = muscle === 'quads' || muscle === 'hamstrings' || muscle === 'glutes' ? legVolumeProfile(level, trainingYears) : { targetMult: 1, capMult: 1, extraExercises: 0 };
    const torsoProfile = muscle === 'chest' || muscle === 'shoulders' ? torsoVolumeProfile(level, trainingYears) : { targetMult: 1, capMult: 1, extraExercises: 0 };
    let exerciseCount = role === 'primary'
      ? (isMultiDay ? 4 : (isSingleFreq ? (onPED ? 4 : 3) : (onPED ? 5 : 4)))
      : (isMultiDay
          ? (isArm && onPED && (muscle === 'biceps' || muscle === 'triceps') ? (level === 'enhanced' && (trainingYears ?? 0) >= 3 ? 1 : 2) : 1)
          : (isArm && onPED ? 4 : (isArm ? 2 : (isBigMuscle ? 2 : 1))));
    // P3: Level-based exerciseCount (Schoenfeld 2022: advanced → more exercises for detail)
    if (levelBase <= 1 && exerciseCount > 2) exerciseCount = Math.max(2, exerciseCount - 1);
    else if (levelBase >= 4 && role === 'primary') exerciseCount = Math.min(8, exerciseCount + 1);
    if (muscle === 'back' && role === 'primary' && backProfile.extraExercises > 0) {
      exerciseCount = Math.min(8, exerciseCount + backProfile.extraExercises);
    }
    // Опытный enhanced: ноги получают дополнительные качественные слоты
    // (не только один присед + изоляция).
    if (['quads', 'hamstrings', 'glutes'].includes(muscle) && role === 'primary' && legProfile.extraExercises > 0) {
      exerciseCount = Math.min(8, exerciseCount + legProfile.extraExercises);
    }
    // Опытный enhanced: грудь/плечи получают дополнительный качественный слот
    // для разных углов жима/махов, а не только один жим.
    if (['chest', 'shoulders'].includes(muscle) && role === 'primary' && torsoProfile.extraExercises > 0) {
      exerciseCount = Math.min(8, exerciseCount + torsoProfile.extraExercises);
    }
    // В Upper/Lower back может быть не lead-мышцей, но опытный enhanced
    // профиль всё равно требует полноценного back-блока, а не одного
    // случайного упражнения между грудью и руками.
    if (muscle === 'back' && trainingYears !== undefined && trainingYears >= 3 && level === 'enhanced' && role === 'primary') {
      exerciseCount = Math.max(exerciseCount, trainingYears >= 6 ? 7 : 6);
    }
    if (muscle === 'back' && trainingYears !== undefined && trainingYears >= 3 && level === 'enhanced' && role === 'accessory') {
      exerciseCount = Math.max(exerciseCount, trainingYears >= 6 ? 6 : 5);
    }
    // ★ B: focusGroup/weakPoint — больше СЕТОВ (не упражнений).
    // Объём уже усилен через sessionShareFor (×1.2 weak, ×1.3 focus).
    // exerciseCount НЕ повышаем — качество > количество.
    // selType: primary → compound; accessory → isolation (но на enhanced/курсе —
    // accessory может быть compound для большего механического натяжения).
    // triceps/biceps в Push/Pull-днях могут получить compound (жим узким хватом,
    // подтягивания обратным хватом) при PED MRV×1.3+.
    const allowAccessoryCompound = pedAdapt ? pedAdapt.combinedMrvMultiplier >= 1.3 : false;
    const selType = ALWAYS_ISOLATION.has(muscle) ? 'isolation'
      : (role === 'primary' ? 'compound' : (allowAccessoryCompound && (muscle === 'triceps' || muscle === 'biceps' || muscle === 'back') ? 'compound' : 'isolation'));
    // ПАМП-дни: для главных мышц сессии разрешить compound в пуле,
    // чтобы первое упражнение было базовым (compound-first порядок),
    // даже если роль accessory. Без этого памп-день открывается изоляцией.
     const highVolumeBack = muscle === 'back' && level === 'enhanced' && (trainingYears ?? 0) >= 3;
     const effectiveSelType = highVolumeBack ? 'any' : ((role === 'accessory' && character === 'памп' && isMainMuscle) ? 'any' : selType);
    // Корень фикса: пул строится по ИСТИННОЙ мышце упражнения (movementPattern +
    // targetMuscle), а не по композитной группе каталога. Это устраняет
    // неверную атрибуцию (leg curl → «calves», farmer walk → «biceps»,
    // good morning → «quads») и исключает ПЛ-движения (carry/hinge/становая).
    const roleMuscles = musclesForRole(repKey);
    const pushDay = isPushDayTag(sched.sessionTag || '');
    const tag = (sched.sessionTag || '').toLowerCase();
    const isPurePull = /pull|back/.test(tag) && !/push|chest/.test(tag);
    let pool = EXERCISE_CATALOG.filter((ex: any) => {
      const tm = trueMuscleOf(ex);
      if (tm === null || !roleMuscles.includes(tm)) return false;
      if (isBBJunk(ex)) return false;
      { const _t = bbExerciseTier(ex); if (_t === 4 || (!allowExotic && _t === 3)) return false; }
      if (!isPurePull && tm === 'shoulders' && isRearDeltExercise(ex.name)) return false;
      if (avoidAxialLoad && ex.name && isAxialLoadExercise(ex as any)) return false;
      if (mobilityRestrictions && isMobilityRestricted(ex, mobilityRestrictions)) return false;
      // Bodyweight capability: подтягивания не ставятся без подтверждённой
      // способности ни в какую роль — заменяются pulldown/машиной.
      if (/подтяг|pull.?up|chin.?up/i.test(ex.name || '')) {
        const cap = bodyweightCapability;
        const canPullUp = cap && ((cap.pullUpsStrict ?? 0) >= 5 || (cap.chinUpsStrict ?? 0) >= 5 || (cap.weightedPullUpLoad ?? 0) > 0);
        if (!canPullUp) return false;
      }
      if (equipmentList.length > 0) {
        const rawEq = ex.equipment;
        const exEq: string[] = Array.isArray(rawEq) ? rawEq : (rawEq ? [String(rawEq)] : []);
        if (exEq.length > 0 && !exEq.some(eq => equipmentList.includes(eq))) return false;
      }
      return true;
    });
    // Фильтр по контексту сессии (доп. страховка, в основном инертен после
    // фильтрации по истинной мышце)
    pool = pool.filter(ex => {
      const n = (ex.name || '').toLowerCase();
      if (tag.includes('push') || tag === 'chest' || tag === 'shoulders') {
        if (n.includes('тяга')||n.includes('становая')||n.includes('мёртвая')||n.includes('мертвая')||n.includes('гиперэкстенз')||n.includes('фермер')||n.includes('carry')||n.includes('rdl')||n.includes('romanian')||n.includes('deadlift')||n.includes('good morning')||n.includes('гудморнинг')) return false;
      }
      if (tag.includes('pull') || tag === 'back') {
        if (n.includes('жим')&&!n.includes('ногами')||n.includes('press')||n.includes('разгиб')||n.includes('extension')) return false;
      }
      if (tag === 'legs' || tag === 'lower') {
        // Раньше: `n.includes('тяга')` блокировало ВСЕ тяги для ножного дня (включая RDL).
        // Теперь релей-блокировка 'тяга' для всего что НЕ относится к ББ-поза-цепи (RDL/мёртвая
        // на прямых ногах/гудморнинг/гиперэкстензия/обратная гипер). Эти лифты разрешены в
        // хамстринг/поясничных днях — иначе хамстринги остаются только с leg_curl (изоляция).
        // Паттерн `Тяга штанги в наклоне` (row) → всё ещё блокируется (BB-posterior не совпадает).
        const isBbPosteriorChain = /румын|мёртв|stiff.?leg|мёртв.*в смите|мёртв.*на прям|мёртв.*на одной|гудморнинг|good.?morning|rdl|гиперэкстенз|обратн.*гипер|reverse.?hyper/.test(n);
        if ((n.includes('жим') && !n.includes('ногами')) || (!isBbPosteriorChain && n.includes('тяга')) || n.includes('подтяг') || n.includes('бицепс') || n.includes('трицепс')) return false;
      }
      return true;
    });
    // Если после фильтра пул опустел — fallback на тот же истинный-мышечный пул
    if (pool.length === 0) pool = EXERCISE_CATALOG.filter((ex: any) => {
      const tm = trueMuscleOf(ex);
      if (tm === null || !roleMuscles.includes(tm)) return false;
      if (isBBJunk(ex)) return false;
      { const _t = bbExerciseTier(ex); if (_t === 4 || (!allowExotic && _t === 3)) return false; }
      // B12: equipment-fallback ТОЛЬКО если оборудование НЕ указано или совпадает (иначе — нет упражнений).
      if (equipmentList.length > 0) {
        const rawEq = ex.equipment;
        const exEq: string[] = Array.isArray(rawEq) ? rawEq : (rawEq ? [String(rawEq)] : []);
        if (exEq.length > 0 && !exEq.some(eq => equipmentList.includes(eq))) return false;
      }
      // B5: avAxial — даже в fallback НЕ берём осевые упражнения
      if (avoidAxialLoad && ex.name && isAxialLoadExercise(ex)) return false;
      // Bodyweight capability — и в fallback не берём подтягивания без способности.
      if (/подтяг|pull.?up|chin.?up/i.test(ex.name || '')) {
        const cap = bodyweightCapability;
        const canPullUp = cap && ((cap.pullUpsStrict ?? 0) >= 5 || (cap.chinUpsStrict ?? 0) >= 5 || (cap.weightedPullUpLoad ?? 0) > 0);
        if (!canPullUp) return false;
      }
      return true;
    });

    // ━━━ BB: минимальный фильтр non-BB упражнений (всегда, не только generic) ━━━
    // trueMuscleOf уже отсекает deadlift/snatch/clean/jerk/carry (~80 упражнений).
    // bbExerciseTier отсекает tier 3-4: доски/пины/спото/цепи/кольца/TRX/strongman (~60).
    // Здесь — только 2 известных просачивающихся упражнения, проходящих tier=1:
    // overhead squat и pistol squat (имеют "присед"/"squat" в имени → tier canonical).
    pool = pool.filter((ex: any) => {
      const n = (ex.name || '').toLowerCase();
      const id = (ex.id || '').toLowerCase();
      if (/над голов|overhead.*squat|пистол.*присед|pistol.*squat/i.test(n)) return false;
      return true;
    });

    // ━━━ _score: BB-приоритет ВСЕГДА (не только generic) ━━━
    // Гакк/Смит > свободный присед, наклонный жим > плоский, стандартные
    // compound'ы приоритетны. Этот скор используется multi-angle diversity
    // для выбора лучшего упражнения из каждого угла.
    pool = pool.map((ex: any) => {
      let score = 0;
      const n = (ex.name || '').toLowerCase();
      const id = (ex.id || '').toLowerCase();
      if (PREFERRED_BB_EXERCISES.has(ex.id)) score += 50;
      else if (favoriteIds.includes(ex.id)) score += 20;
      if (id.includes('incline') || n.includes('наклон')) score += 15;
      if (id.includes('hack') || n.includes('гакк')) score += 15;
      if (id.includes('smith') && id.includes('squat')) score += 10;
      if ((id === 'bench_press' || id === 'barbell_bench_press') && !id.includes('incline')) score -= 10;
      if ((id === 'squat' || id === 'barbell_squat' || id === 'back_squat') && !id.includes('hack') && !id.includes('smith')) score -= 10;
      // Редкие/специфичные вариации (не для массонабора)
      if (n.includes('обратн') || n.includes('обрат') || n.includes('reverse')) score -= 10;
      if (n.includes('узкий') || n.includes('узк') || n.includes('narrow')) score -= 5;
      return { ...ex, _score: score };
    }).sort((a: any, b: any) => (b._score || 0) - (a._score || 0));

    // Generic-план (без специализации/слабых точек): убираем слишком специфичные вариации
    // (обратный хват, узкая стойка) — они уже оштрафованы в _score, но при generic
    // без weak-point лучше их полностью исключить.
    const isGeneric = !focusGroup && !weakPoints.some(wp => {
      const parent = WEAK_TO_MUSCLE[wp];
      return wp === muscle || (parent && parent === muscle);
    });
    if (isGeneric) {
      pool = pool.filter((ex: any) => {
        const id = (ex.id || '').toLowerCase();
        const n = (ex.name || '').toLowerCase();
        const isBlacklisted = Array.from(BLACKLIST_GENERIC).some(bid =>
          id.includes(bid) || n.includes(bid.replace(/_/g, ' ')));
        return !isBlacklisted;
      });
    }

    let selected = selectExercisesSmart({
      candidates: pool, muscleGroup: muscle, count: exerciseCount,
      selectedIds: sessionSelectedIds, selectedNames: sessionSelectedNames,
      equipment: equipmentList, weakZones: weakPoints, level, injuryProfile, type: effectiveSelType,
      targetRir: rir,
      preferBB: true,
      favoriteIds, excludeIds,
      avoidAxialLoad,
      // P7: equipment приоритезируется по фазе (cable для accumulation, barbell для peaking)
      preferEquipment: PHASE_EQUIPMENT_PREF[phase],
    });
    for (const s of selected) { if (s && s.id) sessionSelectedIds.push(s.id); if (s && s.name) sessionSelectedNames.push(s.name); }
    let exDatas = selected.length > 0 ? selected : [pool[0] || { id: muscle, name: muscle, fatigueCost: 5, _score: 0 }];
    // Keep the first compound stable for the same session slot across weeks;
    // accessory movements remain eligible for phase rotation.
    const primarySlot = `${phase}|${sched.sessionTag || dayInRotation}|${muscle}`;
    const stablePrimary = primaryBySlot.get(primarySlot);
    if (stablePrimary && (muscle === sessionLeadMuscle || (exDatas[0] as any)?.type === 'compound')) {
      const stable = pool.find(ex => ex.name === stablePrimary);
      if (stable) {
        exDatas = [stable, ...exDatas.filter(ex => ex.name !== stable.name)].slice(0, exerciseCount);
      }
    } else if ((exDatas[0] as any)?.type === 'compound' && muscle !== 'traps' && muscle !== 'calves' && muscle !== 'forearms') {
      primaryBySlot.set(primarySlot, (exDatas[0] as any).name);
    }
    // Freshness guard: не повторять упражнение в той же неделе на той же мышце.
     {
       const weekUsedForMuscle = weekLocalUsed.get(muscle) || new Set<string>();
       const fresh = exDatas.filter(d => !weekUsedForMuscle.has((d as any).name || ''));
       // Для high-volume enhanced back не сокращаем второй back-день до
       // одного упражнения из-за freshness-guard: повтор паттерна между
       // сессиями допустим, а недобор недельного бюджета — нет.
        // High-volume enhanced профили не должны терять упражнение из-за
        // недельной ротации: объём распределяется по реальным движениям,
        // а не превращается в 1 упражнение × несколько подходов.
        const preserveHighVolume = level === 'enhanced' && (trainingYears ?? 0) >= 3 &&
          ['back', 'quads', 'hamstrings', 'glutes', 'chest', 'shoulders'].includes(muscle);
        if (fresh.length > 0 && !preserveHighVolume) exDatas = fresh;
      for (const d of exDatas) weekUsedForMuscle.add((d as any).name || '');
      weekLocalUsed.set(muscle, weekUsedForMuscle);
    }
    // Phase-aware equipment hard bias: если первое упражнение НЕ из preferred-списка фазы —
    // поднимаем ближайшее подходящее на первое место (не удаляя остальные).
    {
      const phaseEquip = PHASE_EQUIPMENT_PREF[phase] || ['barbell','dumbbell','machine','cable'];
      if (phaseEquip.length > 0 && exDatas.length > 1) {
        const firstEq = String((exDatas[0] as any)?.equipment || '').toLowerCase();
        const firstOk = phaseEquip.some(eq => firstEq.includes(eq));
        if (!firstOk) {
          const betterIdx = exDatas.findIndex((d: any) => {
            const eq = String(d.equipment || '').toLowerCase();
            return phaseEquip.some(p => eq.includes(p));
          });
          if (betterIdx > 0) { const [moved] = exDatas.splice(betterIdx, 1); exDatas.unshift(moved); }
        }
      }
    }
    // Movement-pattern diversity: минимум 2 уникальных паттерна в сессии.
    {
      const patts = new Set(exDatas.map(d => derivePattern(d as any)));
      if (patts.size < 2 && pool.length > 1) {
        const usedNames = new Set(exDatas.map(d => (d as any).name || ''));
        const alt = pool.find(d => !usedNames.has((d as any).name || '') && !patts.has(derivePattern(d as any)) && !rotationNamesSet.has((d as any).name || '') && !sessionSelectedNames.includes((d as any).name || ''));
        if (alt && exDatas.length > 0) { exDatas[exDatas.length - 1] = alt; patts.add(derivePattern(alt)); }
      }
    }
    // Сохраняем rationale выбора для каждого упражнения
    const rationaleMap = new Map<string, string>();
    for (const s of selected) {
      if (s.selectionRationale?.length) rationaleMap.set(s.name, s.selectionRationale.join('; '));
    }

    // Shoulders diversity: принудительно 1 жим (front) + 1 махи (mid) + опционально задняя (rear).
    // Rear delt — ТОЛЬКО в Pull/Back-днях (где она естественно работает со спиной).
    // В Push/Chest/Shoulders-днях — только press + lateral (mid delt), без rear.
    // СМЕЩЕНИЕ: разное упражнение из каждого пучка для разных сессий/недель
    if (muscle === 'shoulders' && exerciseCount >= 2 && pool.length >= 2) {
      const isPress = (e: any) => /жим|press|армей|overhead/i.test(e.name || '');
      const isLateral = (e: any) => /мах|подъем|отведение|lateral|raise|side/i.test(e.name || '');
      const isRear = (e: any) => isRearDeltExercise(e.name || '');
      // Rear delt только в Pull/Back-днях
      const tag = (sched.sessionTag || '').toLowerCase();
      const allowRear = tag.includes('pull') || tag.includes('back') || tag === 'back';
      const presses = pool.filter(e => isPress(e) && !isLateral(e) && !isRear(e) && !sessionSelectedIds.includes(e.id) && !sessionSelectedNames.includes(e.name)).sort((a,b) => bbExerciseTier(a) - bbExerciseTier(b));
      const laterals = pool.filter(e => isLateral(e) && !isPress(e) && !isRear(e) && !sessionSelectedIds.includes(e.id) && !sessionSelectedNames.includes(e.name)).sort((a,b) => bbExerciseTier(a) - bbExerciseTier(b));
      const rears = allowRear ? pool.filter(e => isRear(e) && !isPress(e) && !isLateral(e) && !sessionSelectedIds.includes(e.id) && !sessionSelectedNames.includes(e.name)).sort((a,b) => bbExerciseTier(a) - bbExerciseTier(b)) : [];
      const diverse: any[] = [];
      // Press (front delt) — 1-2 упражнения если primary
      if (presses.length > 0) {
        const p1 = (week*31+dayInRotation*17) % presses.length;
        diverse.push(presses[p1]); sessionSelectedIds.push(presses[p1].id); sessionSelectedNames.push(presses[p1].name);
        // На enhanced — 2 жима (разные углы)
        if (exerciseCount >= 4 && presses.length > 1) {
          const p2 = (p1 + 1 + Math.floor(presses.length / 2)) % presses.length;
          if (presses[p2] && !diverse.some(d => d.id === presses[p2].id)) {
            diverse.push(presses[p2]); sessionSelectedIds.push(presses[p2].id); sessionSelectedNames.push(presses[p2].name);
          }
        }
      }
      // Lateral (mid delt) — 1-2 упражнения (всегда, mid delt нужна во всех днях плеч)
      if (laterals.length > 0) {
        const l1 = (week*31+dayInRotation*17+7) % laterals.length;
        diverse.push(laterals[l1]); sessionSelectedIds.push(laterals[l1].id); sessionSelectedNames.push(laterals[l1].name);
        // На enhanced — 2 маха (разные углы/снаряды)
        if (exerciseCount >= 4 && laterals.length > 1) {
          const l2 = (l1 + 2) % laterals.length;
          if (laterals[l2] && !diverse.some(d => d.id === laterals[l2].id)) {
            diverse.push(laterals[l2]); sessionSelectedIds.push(laterals[l2].id); sessionSelectedNames.push(laterals[l2].name);
          }
        }
      }
      // Rear delt — только в Pull/Back
      if (allowRear && rears.length > 0) {
        const r1 = (week*31+dayInRotation*17+13) % rears.length;
        diverse.push(rears[r1]); sessionSelectedIds.push(rears[r1].id); sessionSelectedNames.push(rears[r1].name);
      }
      // Добрать до exerciseCount если не хватило.
      // ВАЖНО: в Push/Chest-днях исключаем rear delt (она тренируется в Pull-дне).
      for (const e of pool) {
        if (diverse.length >= exerciseCount) break;
        if (!diverse.some(d => d.id === e.id) && !sessionSelectedIds.includes(e.id)) {
          // Запрет rear delt в не-Pull-днях
          if (!allowRear && isRear(e)) continue;
          diverse.push(e); sessionSelectedIds.push(e.id); sessionSelectedNames.push(e.name);
        }
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

    // P9: MULTI-ANGLE diversity — гарантированное покрытие разных углов/паттернов.
    // Для каждой мышцы — 3-4 разных угла/паттерна, не просто "compound + isolation".
    // Это устраняет "3 жима лёжа подряд" и обеспечивает полноценное развитие.
    // ANGLE_CLASSES импортирован из bb-exercise-selection.engine.ts (единственный источник истины).
    if (exerciseCount >= 2 && pool.length >= 2 && muscle !== 'shoulders') {
      const classes = ANGLE_CLASSES[muscle];
      if (classes && classes.length > 0) {
        const diverse: any[] = [];
        const usedIds = new Set<string>();
        // Берём по 1 упражнению из каждого угла, пока не наберём exerciseCount.
        // Сортировка внутри угла: compound barbell → dumbbell → machine → cable → one-arm.
        // Первое упражнение мышцы = самое тяжёлое (максимальное механическое натяжение).
        for (let ci = 0; ci < classes.length; ci++) {
          const ac = classes[ci];
          if (diverse.length >= exerciseCount) break;
           let candidates = pool.filter(e => ac.match(e) && !usedIds.has(e.id) && (relaxBackRotation && muscle === 'back' ? true : !rotationNamesSet.has(e.name)));
          // _score BB-приоритет ВСЕГДА (hack +15 > barbell -10, incline +15 > flat -10)
          // FIX-B4: lengthenedBonus — +10 для упражнений в растянутой позиции
          // (Schoenfeld 2022, Maeo 2023: lengthened-position → больше гипертрофии).
          candidates = candidates.sort((a, b) => {
            const sa = (a as any)._score ?? 0;
            const sb = (b as any)._score ?? 0;
            const la = lengthenedBonus(a.name || '', trainingFocus);
            const lb = lengthenedBonus(b.name || '', trainingFocus);
            const saTotal = sa + la;
            const sbTotal = sb + lb;
            if (saTotal !== sbTotal) return sbTotal - saTotal;
            const rankDiff = strengthRank(a) - strengthRank(b);
            if (rankDiff !== 0) return rankDiff;
            // tie-break by coaching tier: canonical (barbell bench) before acceptable (reverse-grip bench)
            // so a niche/advanced lift doesn't lead a day over the canonical compound at the same load.
            const tierDiff = bbExerciseTier(a) - bbExerciseTier(b);
            if (tierDiff !== 0) return tierDiff;
            const weakDiff = weakExerciseBonus(b.name || '', weakPoints) - weakExerciseBonus(a.name || '', weakPoints);
            return weakDiff;
          });
          if (candidates.length > 0) {
            // Для первого упражнения (ci=0) — всегда брать самое тяжёлое (rank 1-2).
            // Для последующих — offset для вариативности между неделями.
            const offset = ci === 0 ? 0 : (week * 31 + dayInRotation * 17 + ci * 7) % Math.max(1, candidates.length);
            const pick = candidates[offset];
            diverse.push(pick);
            usedIds.add(pick.id);
            sessionSelectedIds.push(pick.id);
            sessionSelectedNames.push(pick.name);
          }
        }
        // Fallback: если класс пуст (все исключены ротацией) — взять из класса без фильтра ротации
        for (let ci = 0; ci < classes.length; ci++) {
          const ac = classes[ci];
          if (diverse.length >= exerciseCount) break;
           let candidates = pool.filter(e => ac.match(e) && !usedIds.has(e.id));
          candidates = candidates.sort((a, b) => {
            const sa = (a as any)._score ?? 0;
            const sb = (b as any)._score ?? 0;
            if (sa !== sb) return sb - sa;
            const rankDiff = strengthRank(a) - strengthRank(b);
            if (rankDiff !== 0) return rankDiff;
            const tierDiff = bbExerciseTier(a) - bbExerciseTier(b);
            if (tierDiff !== 0) return tierDiff;
            return weakExerciseBonus(b.name || '', weakPoints) - weakExerciseBonus(a.name || '', weakPoints);
          });
          if (candidates.length > 0) {
            const offset = ci === 0 ? 0 : (week * 31 + dayInRotation * 17 + ci * 7 + 3) % Math.max(1, candidates.length);
            const pick = candidates[offset];
            diverse.push(pick);
            usedIds.add(pick.id);
            sessionSelectedIds.push(pick.id);
            sessionSelectedNames.push(pick.name);
          }
        }
        // Добрать из остатка пула, если не набрали
        for (const e of pool) {
          if (diverse.length >= exerciseCount) break;
          if (!usedIds.has(e.id) && !sessionSelectedIds.includes(e.id)) {
            diverse.push(e); usedIds.add(e.id);
            sessionSelectedIds.push(e.id); sessionSelectedNames.push(e.name);
          }
        }
        if (diverse.length >= Math.min(2, exerciseCount)) {
          exDatas = diverse.slice(0, exerciseCount);
        }
        // Lead-muscle compound does not rotate: the day's main lift (RDL / close-grip bench /
        // OHP / squat) opens the session even if it was used in a prior session this week —
        // main lifts repeat; variety is for accessories. Stops an isolation (leg curl / french
        // press) leading an alternate hamstrings / arms day after rotation exhausts the compound.
        if (muscle === leadMuscle && exDatas.length > 0 && (exDatas[0] as any).type !== 'compound') {
          const ciComp = exDatas.findIndex((d: any) => (d as any).type === 'compound');
          if (ciComp > 0) { const [c] = exDatas.splice(ciComp, 1); exDatas.unshift(c); }
          else {
            const comp = pool.find((d: any) => (d as any).type === 'compound' && !usedIds.has((d as any).id) && !sessionSelectedIds.includes((d as any).id));
            if (comp) { exDatas[0] = comp; usedIds.add(comp.id); sessionSelectedIds.push(comp.id); sessionSelectedNames.push(comp.name); }
          }
        }
      }
    }

    // Back high-volume composition: если rotation/selector оставили слишком
    // мало движений, добираем только неповторяющиеся функциональные классы.
    if (muscle === 'back' && level === 'enhanced' && (trainingYears ?? 0) >= 3) {
      const targetExercises = Math.min((trainingYears ?? 0) >= 6 ? 7 : 6, exerciseCount);
      const used = new Set(exDatas.map(e => e.id));
      for (const ac of ANGLE_CLASSES.back) {
        if (exDatas.length >= targetExercises) break;
        const candidate = [...pool, ...EXERCISE_CATALOG].find(e => !used.has(e.id) && trueMuscleOf(e) === 'back' && !isBBJunk(e) && ac.match(e));
        if (!candidate) continue;
        exDatas.push(candidate);
        used.add(candidate.id);
      }
    }

    // Per-exercise weight modifier. Evidence-based:
    //  - наклон 30°: -5-10% vs flat (Biel 2017), не -15%
    //  - машина: стабильнее → 1RM ~85% свободных (Schoenfeld 2021)
    //  - кабель: ~80% свободных (constant tension, Schoenfeld 2021)
    //  - Смит: ~90% (фиксированная траектория, больше стабильности)
    //  - гантели: ~80% (стабилизация, нейтральный хват)
    function weightModFor(exName: string): number {
      const n = (exName || '').toLowerCase();
      if (n.includes('гантел') || n.includes('dumbbell')) return 0.80;
      if (n.includes('наклон') || n.includes('incline')) return 0.95;
      if (n.includes('смит') || n.includes('smith')) return 0.90;
      if (n.includes('трен') || n.includes('машин') || n.includes('machine')) return 0.85;
      if (n.includes('блок') || n.includes('кабель') || n.includes('cable') || n.includes('кроссов')) return 0.80;
      return 1.0;
    }
    for (const d of exDatas) (d as any)._weightMod = weightModFor((d as any).name || '');

    // P0-1 (audit 2026-07): _pumpOverride УБРАН — механическое натяжение (Schoenfeld 2010/2017,
    // последний тяж-сет — главный драйвер гипертрофии). Памп добирается отдельной изоляцией
    // через A1 pump-finisher / fix K (L1501-1558, L1943-2000), а не ЗАМЕНЯЕТ тяж.

    // P1 + BUG-B7: DUP-волна повторений внутри фазы (недельная вариация).
    // Ранние недели фазы → больше повторений (метаболический стресс),
    // поздние → меньше (механическое натяжение). Аналог getDupReps в phase-periodization.
    // BUG-B7: в deload reps должны РАСТИ (recovery), а не падать.
    //   Раньше: offset = -floor((phaseWeek-1)×1.5) → всегда отрицательный →
    //   deload wk4 = 12-4 = 8 (вместо 16-20 recovery-повторов).
    // Теперь: deload → +offset (растём к концу deload-недели = восстановление),
    //          accumulation/intensification/peaking → -offset (механическое натяжение растёт).
    const dupSign = phase === 'deload' ? +1 : -1;
    const dupRepsOffset = phaseCfg && phaseWeek > 1 ? dupSign * Math.floor((phaseWeek - 1) * 1.5) : 0;

    // P7: phaseExerciseMix — приоритет equipment по фазе (accumulation→cable, peaking→barbell).
    // Это формирует пропорцию compound/isolation/cable/machine, заявленную в PHASE_CONFIGS.
    const phaseEquip = PHASE_EQUIPMENT_PREF[phase] || ['barbell', 'dumbbell', 'machine', 'cable'];

    const expectedFatigue = exerciseCount * (sets / exerciseCount) * (((exDatas[0] as any)?.fatigueCost || 5));
    totalExpectedFatigue += expectedFatigue;
    plans.push({ muscle, resolved, role, sets, exerciseCount, rir, reps, weight, pool, exDatas, selType, rationaleMap, phaseEquip });
  }

  // FB: финальная проверка — заблокированные мышцы НЕ должны быть primary.
  // Если по какой-то причине role='primary' для заблокированной мышцы — понизить до accessory.
  if (sched.sessionTag === 'FullBody') {
    const fbSchedule = [['chest', 'back'], ['quads', 'hamstrings'], ['shoulders', 'arms']];
    const fbPrimary = fbSchedule[(dayInRotation - 1) % fbSchedule.length];
    for (const pl of plans) {
      if (!fbPrimary.includes(pl.muscle) && pl.role === 'primary') {
        pl.role = 'accessory';
      }
    }
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
          // BUG-B3: для градированной травмы нужна мягкая замена (min volumePct),
          // а не первая попавшаяся (которая может быть полной заменой volumePct=1.0).
          // Сортируем по volumePct ascending и берём самую мягкую.
          // Это гарантирует снижение нагрузки, а не её сохранение/рост.
          const sortedSubs = [...subs].sort((a, b) => (a.volumePct || 1) - (b.volumePct || 1));
          const sub = sortedSubs[0];
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

  // Process each muscle with proportional budget.
  // P0-1: резервируем бюджет для arms (biceps/triceps) ДО того, как chest/back его потратят.
  // Раньше: chest/back забирали весь fatigue budget → biceps/triceps получали 0 упражнений.
  const armPlans = plans.filter(p => ARM_MUSCLES_SET.has(p.muscle));
  // Indirect arm overlap: жимы дают трицепсу ~0.5 effective sets на каждый сет,
  // тяги дают бицепсу ~0.5. Это должно снижать прямой объём рук, а не
  // добавляться поверх.
  let indirectBiceps = 0;
  let indirectTriceps = 0;
  for (const pl of plans) {
    if (ARM_MUSCLES_SET.has(pl.muscle)) continue;
    const n = (pl.exDatas[0]?.name || '').toLowerCase();
    const totalSets = pl.sets || 0;
    if (/жим|bench|press|dip|отжим.*брус|жим.*узк|close.?grip/i.test(n) && !/ног|leg|сгибан|curl/i.test(n)) {
      indirectTriceps += totalSets * 0.5;
    }
    if (/подтяг|pull.?up|chin|тяга|row|пуллдаун|верхн.*блок|lat.?pull/i.test(n) && !/лиц|face/i.test(n)) {
      indirectBiceps += totalSets * 0.5;
    }
  }
  // Базовый резерв для рук снижается пропорционально косвенной нагрузке.
  // Если косвенный объём уже покрывает 50% target — прямой объём сокращается.
  const armReserveBudget = armPlans.length * 6 * 5; // 6 sets (2 ex × 3 sets) × fatigueCost 5 per arm muscle
  let availableBudget = dayFatigueBudget;
  if (armPlans.length > 0 && availableBudget > armReserveBudget) {
    availableBudget -= armReserveBudget; // резервируем для arms
  }
  let armAllocatedBudget = 0;
  for (const pl of plans) {
    const phaseCfg = PHASE_CONFIGS[phase];
    const [adjMin, adjMax] = phaseCfg.repRange;
    const isAcc = pl.role === 'accessory';
    const repMin = isAcc ? adjMin + 2 : adjMin;
    const repMax = isAcc ? adjMax + 5 : adjMax;
    const isArmMuscle = ARM_MUSCLES_SET.has(pl.muscle);
    // Indirect overlap reduction: если жимы/тяги уже дали существенный
    // косвенный объём, прямой объём рук снижается, а не добавляется поверх.
    const indirectOverlap = pl.muscle === 'biceps' ? indirectBiceps : pl.muscle === 'triceps' ? indirectTriceps : 0;
    const indirectReduction = indirectOverlap > 8 ? 0.5 : indirectOverlap > 4 ? 0.75 : 1.0;
    // P0-1: для arms — используем зарезервированный бюджет напрямую (не пропорционально totalExpectedFatigue).
    // Раньше: muscleBudget = floor(15 × 1 × 3 × 5 / 130) = 1 (chest/back размывают резерв).
    // Теперь: arms получают гарантированный budget = armReserve / armPlans.length.
    const armBudgetPerMuscle = armPlans.length > 0 ? (armReserveBudget / armPlans.length) : 0;
    const budgetSource = isArmMuscle ? armBudgetPerMuscle * indirectReduction : availableBudget;
    const muscleBudget = isArmMuscle
      ? Math.max(armBudgetPerMuscle, 15) // минимум 3 сета × 5 fatigue
      : (totalExpectedFatigue > 0
        ? Math.floor(budgetSource * pl.exerciseCount * Math.max(1, Math.round(pl.sets / pl.exerciseCount)) * ((pl.exDatas[0] as any)?.fatigueCost || 5) / totalExpectedFatigue)
        : Math.floor(budgetSource / Math.max(1, plans.length)));
    // Solo-дни (1-2 мышцы): 90% бюджета; multi-дни: 60% (70% на PED — больше recovery).
    const highVolumeBack = pl.muscle === 'back' && level === 'enhanced' && (trainingYears ?? 0) >= 3;
    const highVolumeLegs = ['quads', 'hamstrings', 'glutes'].includes(pl.muscle) && level === 'enhanced' && (trainingYears ?? 0) >= 3;
    const highVolumeTorso = ['chest', 'shoulders'].includes(pl.muscle) && level === 'enhanced' && (trainingYears ?? 0) >= 3;
    const highVolumeArms = ['biceps', 'triceps'].includes(pl.muscle) && level === 'enhanced' && (trainingYears ?? 0) >= 3;
    const budgetCapPct = plans.length <= 2 ? 0.90 : (pedAdapt && pedAdapt.combinedRecoveryMultiplier >= 1.3 ? 0.70 : 0.60);
    let remainingBudget = highVolumeBack
      ? Math.max(muscleBudget, pl.sets * 10)
      : highVolumeLegs
        // Независимый budget floor: quads не может забрать весь котёл,
        // оставив hamstrings/glutes с одним упражнением.
        ? Math.max(muscleBudget, (trainingYears ?? 0) >= 6 ? 120 : 90)
        : highVolumeTorso
          ? Math.max(muscleBudget, pl.sets * 6)
          : highVolumeArms
            ? Math.max(muscleBudget, 30) // минимум 6 сетов × 5 fatigue
            : Math.max(1, Math.min(muscleBudget, Math.floor(budgetSource * (isArmMuscle ? 1.0 : budgetCapPct))));
    // High-volume legs: fatigue budget не должен резать ноги до остатка.
    // Минимум — целевые сеты × fatigueCost, а не пропорция от общего бюджета.
    if (highVolumeLegs && remainingBudget < pl.sets * 5) {
      remainingBudget = pl.sets * 5;
    }
    // Гарантированный минимум для arms/shoulders — на PED нужно минимум 3-4 сета
    // даже если бюджет мал (chest забирал большую часть). Без этого triceps получает 1 сет.
    // minBudget = fatigueCost(5) × minSets(3-4) × minExercises(2) = 30-40
    const isArmOrShoulder = ['triceps', 'biceps', 'shoulders', 'forearms'].includes(pl.muscle);
    const minSetsArms = isArmOrShoulder && pedAdapt && pedAdapt.combinedMrvMultiplier >= 1.3 ? 4 : 3;
    const minExercisesArms = isArmOrShoulder && pedAdapt && pedAdapt.combinedMrvMultiplier >= 1.3 ? 2 : 1;
    const minBudgetForArms = isArmOrShoulder ? minSetsArms * minExercisesArms * ((pl.exDatas[0] as any)?.fatigueCost || 5) : 0;
    if (isArmOrShoulder && remainingBudget < minBudgetForArms) {
      remainingBudget = minBudgetForArms;
    }
    // Для primary больших мышц (chest/back/quads) — ограничить per-exercise sets до 5
    // чтобы не забирать весь бюджет (7 sets на жим = 35 fatigue = весь день)
    
    for (const exData of pl.exDatas) {
      const wPct = (exData as any).substitutionWeightPct ?? 1.0;
      const vPct = (exData as any).substitutionVolumePct ?? 1.0;
      const isSubstituted = (exData as any).substituted === true;
      const repsCap = (exData as any).repsCap ?? 20;
      // P1-4: минимум 2 сета на упражнение (1 сет = разминка, не рабочий объём для гипертрофии).
       // back target уже масштабирован на недельном prescription-уровне выше;
       // не умножаем каждый exercise повторно, иначе стаж давал бы двойной boost.
       const setCap = (pl.muscle === 'back' && trainingYears !== undefined) ? 10
         : (['quads', 'hamstrings', 'glutes'].includes(pl.muscle) && trainingYears !== undefined) ? 8
         : 5;
       const exSetsRaw = Math.round(Math.round(pl.sets / pl.exDatas.length) * vPct);
       // Минимум 3 сета на упражнение для enhanced 3+ — 2 сета недостаточно
       // для гипертрофии опытного атлета.
       const exMin = level === 'enhanced' && (trainingYears ?? 0) >= 3 ? 3 : 2;
       const exSets = Math.max(exMin, Math.min(setCap, exSetsRaw));
      const exWeight = (exData as any)._effWeight ?? pl.weight;
      const finalRir = isSubstituted ? Math.min(pl.rir + 1, 4) : ((exData as any)._deltRir ?? pl.rir);
      const cost = ((exData as any)?.fatigueCost || 5) * exSets;
      // P1: tempo/rest/reps берутся из PHASE_CONFIGS[phase] (не charReps/REST_BY_CHARACTER).
      // Accessory получает чуть меньше отдыха (минус 30с), primary — базу.
      // FIX-B2: per-exercise tempo override (проф-тренер назначает разный темп разным упр).
      const exName = (exData as any)?.name || (exData as any)?.id || '';
      const tempoOverride = tempoFor(pl.resolved as DayCharacter, undefined, phase, exName);
      const tempoStr = tempoOverride.notation;
      const baseRest = phaseCfg.restBase;
      // P5: Rest progression. Накопление/интенсификация/пик → -15s/нед (плотность растёт).
      // Делод → +30с (восстановление: больше отдыха = меньше утомления, Schoenfeld 2016).
      // FIX: используем phaseWeek (не absolute week) — прогрессия рестартует с каждой фазой,
      // как RIR drift. Ранее week=9 → restProgression=120с → baseRest-120=0 → clamped to 60
      // на всей фазе intensification. Теперь phaseWeek=1-4 → max 45s сокращения.
      const restProgression = phase === 'deload' ? -30 : Math.max(0, (phaseWeek - 1) * 15);
      const exRest = phase === 'deload'
        ? Math.min(180, (pl.role === 'accessory' ? baseRest : baseRest + 30) - restProgression)
        : Math.max(60, (pl.role === 'accessory' ? Math.max(45, baseRest - 30) : baseRest) - restProgression);
      if (remainingBudget < cost) {
        const reduced = Math.max(2, Math.floor(remainingBudget / ((exData as any)?.fatigueCost || 5)));
        const adjustedSets = Math.min(exSets, reduced);
        const adjCost = ((exData as any)?.fatigueCost || 5) * adjustedSets;
        remainingBudget -= adjCost;
        // B1: DUP-волна и при обрезке
        const dupReps: number[] = [];
        for (let k = 0; k < adjustedSets; k++) {
          let wave: number;
          if (k === 0) wave = repMin;
          else if (k === adjustedSets - 1) wave = repMax;
          else wave = k % 2 === 1 ? repMax : repMin;
          dupReps.push(Math.min(wave, repsCap));
        }
        const workSets: BBSet[] = dupReps.map(reps => ({
          reps, rir: finalRir,
          weight: Math.round(exWeight * wPct * ((exData as any)._weightMod || 1) * 10) / 10,
          tempo: tempoStr, restSeconds: exRest,
        }));
        // P0-1 (audit 2026-07): _pumpOverride удалён. Тяжёлый сет остаётся тяжёлым.
        const effChar: DayCharacter = pl.resolved as DayCharacter;
        const effReps: [number, number] = [Math.min(repMin, repsCap), Math.min(repMax, repsCap)];
        exercises.push({
          muscle: trueMuscleOf(exData) || pl.muscle, name: (exData as any).name || (exData as any).id, role: pl.role, character: effChar,
          sets: adjustedSets, repsRange: effReps,
          rir: finalRir,
          workSets, exerciseName: (exData as any).name || (exData as any).id,
          exerciseType: (exData as any).exerciseType || (exData as any).type || 'compound',
          tempoSpec: tempoStr, restSeconds: exRest,
            comment: buildExComment(pl.muscle, (exData as any).id || (exData as any).name, pl.role, pl.resolved as DayCharacter, adjustedSets, Math.min(repMin, repsCap), Math.round(exWeight * wPct * ((exData as any)._weightMod || 1) * 10) / 10, finalRir, weakPoints, focusGroup, phase, tempoStr, exRest, isSubstituted, (exData as any).id, trainingFocus),
          executionProfile: buildExerciseInstructions({ exerciseId: (exData as any).id, exerciseName: (exData as any).name || (exData as any).id, muscle: pl.muscle, role: pl.role, phase, trainingFocus, tempo: tempoStr, restSeconds: exRest, orderIndex: exercises.length, totalExercises: pl.exDatas.length }),
          warmupSets: buildWarmup(Math.round(exWeight * wPct * ((exData as any)._weightMod || 1) * 10) / 10, pl.role === 'primary' || (exData as any).type === 'compound'),
          rationale: pl.rationaleMap.get((exData as any).name) || '',
        });
        continue;
      }
      remainingBudget -= cost;
      // B1: DUP-волна повторений (Daily Undulating Periodization) — реалистичная PRO-практика.
      // Все 4 сета НЕ одинаковые. Вместо [r, r, r, r] генерируем [repMin, repMax, repMin, repMax, ...]
      // или [repMid, repMin, repMax, repMid] для большего разнообразия.
      const dupReps: number[] = [];
      for (let k = 0; k < exSets; k++) {
        // Схема: тяжёлый первый сет (repMin), затем чередование repMax/repMin
        let wave: number;
        if (k === 0) wave = repMin;
        else if (k === exSets - 1) wave = repMax; // последний — высокий reps (finish)
        else wave = k % 2 === 1 ? repMax : repMin;
        // Fatigue-aware DUP: middle sets are nudged down after the first
        // hard set, without leaving the phase/focus rep range.
        if (k >= 2 && exSets >= 4 && phase !== 'deload') wave = Math.max(repMin, wave - 1);
        dupReps.push(Math.min(wave, repsCap));
      }
      const workSets: BBSet[] = dupReps.map(reps => ({
        reps, rir: finalRir,
        weight: Math.round(exWeight * wPct * ((exData as any)._weightMod || 1) * 10) / 10,
        tempo: tempoStr, restSeconds: exRest,
      }));
      exercises.push({
        muscle: pl.muscle, name: (exData as any).name || (exData as any).id, role: pl.role, character: pl.resolved as DayCharacter,
        sets: exSets, repsRange: [Math.min(repMin, repsCap), Math.min(repMax, repsCap)] as [number,number],
        rir: finalRir,
        workSets, exerciseName: (exData as any).name || (exData as any).id,
        exerciseType: (exData as any).exerciseType || (exData as any).type || 'compound',
        tempoSpec: tempoStr, restSeconds: exRest,
         comment: buildExComment(pl.muscle, (exData as any).id || (exData as any).name, pl.role, pl.resolved as DayCharacter, exSets, Math.min(repMin, repsCap), Math.round(exWeight * wPct * ((exData as any)._weightMod || 1) * 10) / 10, finalRir, weakPoints, focusGroup, phase, tempoStr, exRest, isSubstituted, (exData as any).id, trainingFocus),
        executionProfile: buildExerciseInstructions({ exerciseId: (exData as any).id, exerciseName: (exData as any).name || (exData as any).id, muscle: pl.muscle, role: pl.role, phase, trainingFocus, tempo: tempoStr, restSeconds: exRest, orderIndex: exercises.length, totalExercises: pl.exDatas.length }),
        warmupSets: buildWarmup(Math.round(exWeight * wPct * ((exData as any)._weightMod || 1) * 10) / 10, pl.role === 'primary'),
        rationale: pl.rationaleMap.get((exData as any).name) || '',
      });
    }
  }
  // ▓▓ Технически грамотный порядок упражнений (до обрезки по exCap) ▓▓
  // Базовые основной мышцы → базовые вторичных → изоляция (растяжка первой) → финиши.
  // BUG-B11: передаём sessionLeadMuscle (для FullBody — пустая строка, но orderSessionExercises
  // в этом случае fallback на первый primary+тяж exercise → корректно для FB day 2/3).
  const _ordered = orderSessionExercises(exercises, {
    sessionTag: sched.sessionTag,
    methodology,
    primaryMuscle: sessionLeadMuscle || undefined,
    priorityMuscles: [...weakPoints, ...(focusGroup ? [focusGroup] : [])],
  });
  exercises.length = 0; exercises.push(..._ordered);
  // После финальной сортировки обновляем порядок в тренерской инструкции.
  // Это точнее, чем порядок до orderSessionExercises: методика может переставить
  // primary/accessory, stretch-biased и priority-muscle упражнения.
  exercises.forEach((exercise, index) => {
    const orderText = exercise.role === 'primary'
      ? (index === 0 ? 'первое основное упражнение дня' : `основное упражнение №${index + 1} в дне`)
      : `упражнение №${index + 1} в дне, после базовых движений`;
    if (exercise.comment) exercise.comment = exercise.comment.replace(/Порядок: [^.]+/, `Порядок: ${orderText}`);
    if (exercise.executionProfile) exercise.executionProfile.order = orderText;
  });

  // Кап упражнений в сессии: просто берём первые exCap из уже отсортированного массива.
  // Сортировка выше уже гарантирует: primary → accessory, мышца дня → остальные.
  // P0-1: exCap зависит от числа мышц в дне — 5 мышц по 2 упражнения = 10 минимум.
  // Раньше exCap=8 → biceps/triceps отрезались в Upper днях (5 мышц).
  // Теперь: exCap = max(8, musclePlans.length × 2) — гарантия 2 упражнений на мышцу.
  const exCap = Math.max(8, Math.min(12, musclePlans.length * 2));
  if (exercises.length > exCap) {
    exercises.length = exCap;
  }
  // P0-1: arm guarantee перенесена в финальную пост-обработку (после всех обрезок/dedup).

  // ▓▓ A1: Pump-finisher слабых групп (структурная добивка метаболическим стрессом) ▓▓
  // Если в текущей сессии слабая группа уже представлена (но не primary этой сессии) —
  // добавить 1 памп-сет в конце (3×15-20 @ 50% workMax, RIR 4). Это не "множитель",
  // а структурная тренерская техника: добивание мышцы после основного объёма.
  // Skip если день-сессия уже близка к exCap (защита от перегрузки)
  let SESSION_USED = exercises.length;
  const SESSION_FINAL_CAP = Math.min(exCap, SESSION_USED + 2);
  if (weakPoints.length > 0 && SESSION_USED < SESSION_FINAL_CAP) {
    const sessionMusclesPush = new Set(exercises.map(e => e.muscle));
    const tagPush = (sched.sessionTag || '').toLowerCase();
    const isLegsDay = tagPush === 'legs' || tagPush.startsWith('lower');
    const isUpperDay = !isLegsDay;
    // только слабые группы совместимые с днём
    for (const wp of weakPoints) {
      if (SESSION_USED >= SESSION_FINAL_CAP) break;
      const isWpLegs = ['quads','hamstrings','glutes','calves'].includes(wp);
      const isWpUpper = ['chest','back','shoulders','biceps','triceps','forearms','arms'].includes(wp);
      if (isWpLegs && !isLegsDay) continue;
      if (isWpUpper && !isUpperDay) continue;
      // Не делать finisher если эта группа уже primary сегодня (есть большой compound-объём —
      // finisher только для accessory мышцы)
      const isPrimaryToday = exercises.some(e => e.role === 'primary' && e.muscle === wp);
      if (isPrimaryToday) continue;
      // Не делать finisher, если не было accessory этой группы сегодня (метаболический
      // стимул без предшествующего базового объёма — неэффективно)
      if (!sessionMusclesPush.has(wp)) continue;
      const seenNamesList = new Set(exercises.map(e => e.name));
      const pumpPool = EXERCISE_CATALOG.filter((ex: any) => {
        const tm = trueMuscleOf(ex);
        if (tm === null || tm !== wp) return false;
        if (seenNamesList.has(ex.name)) return false;
        if (isBBJunk(ex)) return false;
      { const _t = bbExerciseTier(ex); if (_t === 4 || (!allowExotic && _t === 3)) return false; }
        const n = (ex.name || '').toLowerCase();
        if (n.includes('становая') || n.includes('жим стоя') || n.includes('армей')) return false;
        if (equipmentList.length > 0) {
          const rawEq = ex.equipment;
          const exEq: string[] = Array.isArray(rawEq) ? rawEq : (rawEq ? [String(rawEq)] : []);
          if (exEq.length > 0 && !exEq.some(eq => equipmentList.includes(eq))) return false;
        }
        return true;
      });
      if (pumpPool.length === 0) continue;
      const iso = pumpPool.find((e: any) => e.type === 'isolation') || pumpPool[0];
      const wm = workMax[wp] || PRO_WORKMAX_RATIO[wp]?.(workMax) || defaultWorkMax(wp);
      const wu = Math.round(wm * 0.50 * 10) / 10; // 50% workMax — памп-финишер
      exercises.push({
        muscle: wp, name: iso.name, role: 'accessory', character: 'памп',
        sets: 3, repsRange: [15, 20], rir: 4,
        workSets: Array.from({length: 3}, () => ({ reps: 15, rir: 4, weight: wu, tempo: '2-1-2-0', restSeconds: 45 })),
        exerciseName: iso.name, tempoSpec: '2-1-2-0', restSeconds: 45,
        comment: `🔥 Weak pump-finisher: ${iso.name}, 3×15 @${wu} кг RIR 4 — метаболический стресс на отстающую группу.`,
        warmupSets: [], rationale: 'Pump finisher для слабой группы',
      });
      seenNamesList.add(iso.name);
      SESSION_USED++;
    }
  }

  // The shared order engine is intentionally the last ordering authority.
  // Do not add a second role/equipment sort here: it can move a weak-point
  // isolation ahead of the day's primary compound and undo methodology rules.
  const finalOrdered = orderSessionExercises(exercises, {
    sessionTag: sched.sessionTag,
    methodology,
    primaryMuscle: sessionLeadMuscle || undefined,
    priorityMuscles: [...weakPoints, ...(focusGroup ? [focusGroup] : [])],
  });
  exercises.length = 0;
  exercises.push(...finalOrdered);

  // Добавляем растяжку в конец сессии (динамическая растяжка для основных групп мышц)
  // BUG-B13/B21: Stretching удалён (мёртвый код с Jul 16 — не ББ-гипертрофия, занимал слоты).

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
  const foundPattern = getPattern(input.patternId);
  if (!foundPattern) {
    console.warn(`[bb-builder] buildBBPlan: patternId="${input.patternId}" не найден — fallback на SPLIT_PATTERNS[0] (${SPLIT_PATTERNS[0].id}). Проверьте, что передаёте patternId (не split).`);
  }
  const pattern = foundPattern || SPLIT_PATTERNS[0];
  const level = normLevel(input.level) as TrainingLevel;
  const inputWorkMax = input.workMax || {};
  // PRO: cross-mesocycle continuity — прогрессия весов и объёма из предыдущего плана.
  const mesoProgression = input.previousPlan
    ? extractMesocycleProgression(input.previousPlan, level, input.goal)
    : null;
  const workMax = mesoProgression
    ? applyWeightProgression(inputWorkMax, mesoProgression)
    : inputWorkMax;
  const weakPoints = input.weakPoints || [];
  const focusGroup = input.focusGroup;
  const sessions = sessionsOf(pattern);
  const injuries = input.injuries || [];
  const favIds = input.favoriteExercises || [];
  const exclIds = input.excludedExercises || [];
  const avAxial = input.avoidAxialLoad || false;
  const eqList = input.equipment || [];
  const backProfile = backVolumeProfile(level, input.trainingYears);
  const legProfile = legVolumeProfile(level, input.trainingYears);
  const torsoProfile = torsoVolumeProfile(level, input.trainingYears);

  const today = todayStr();
  const excludedMuscles = getExcludedMuscles(injuries, today);
  const gradedInjuries = getGradedInjuries(injuries, today);
  // Общий пул травмированных мышц (для injuryProfile — передаётся в selectExercisesSmart)
  const injuredMuscles = new Set([...excludedMuscles, ...gradedInjuries.map(inj => inj.muscle)]);
  const injuryProfile = [...injuredMuscles];

  // Вычисляем dailyCap (max групп в день) для S-MRV-бюджета — по дедуплицированным каталог-группам (fix Z)
  const maxGroupsPerSession = Math.max(1, ...sessions.map(s => dedupeMuscles(s.sessionTag, excludedMuscles).length));
  const dailyCap = level === 'enhanced' && (input.trainingYears ?? 0) >= 3
    ? Math.max(14, Math.min(22, Math.round(8 + maxGroupsPerSession * 3)))
    : Math.max(10, Math.min(16, Math.round(8 + maxGroupsPerSession * 2)));

  // fix Z + BUG-B5: muscleSessionCount ключом является collapseKey (delt heads→shoulders, остальные как есть).
  // BUG-B5 РАНЬШЕ: musclesForTag('Push') = [chest, delt_front, delt_mid, triceps] →
  //   delt_front И delt_mid оба → shoulders += 2 (вместо 1 за сессию).
  //   PPL: 2 Push × 2 delt + 2 Pull × 1 delt_rear = shoulders = 6 (вместо реальных 2×/нед).
  // ФИКС: подсчёт ведём по Set<collapseKey> per-session → каждая мышца считается 1 раз за сессию.
  const muscleSessionCount: Record<string, number> = {};
  for (const s of sessions) {
    const seenThisSession = new Set<string>();
    for (const m of musclesForTag(s.sessionTag)) {
      const ck = collapseKey(m);
      if (excludedMuscles.has(m)) continue;
      if (seenThisSession.has(ck)) continue; // дедуп внутри одной сессии
      seenThisSession.add(ck);
      muscleSessionCount[ck] = (muscleSessionCount[ck] || 0) + 1;
    }
  }

  const muscleVolumeRotation: Record<string, number> = {};
  const mrvByMuscle: Record<string, number> = {};
  const volumeTargets: Record<string, BBVolumeTarget> = {};
  const specWeak = input.specialization ? expandWeakForSpecialization(input.weakPoints || []).slice(0, 2) : [];
  // Recovery multiplier from body composition + recovery metrics (Helms 2022, Plews 2022, Watson 2022)
  // BUG-FIX: используем Number.isFinite() вместо != null для защиты от строк/NaN/undefined.
  const recoveryMult = Math.max(0.6, Math.min(1.5, (() => {
    let r = 1.0;
    if (Number.isFinite(input.bodyFat)) r *= (input.bodyFat as number) > 25 ? 0.9 : (input.bodyFat as number) > 20 ? 0.95 : 1.0;
    if (Number.isFinite(input.leanMass)) r *= (input.leanMass as number) >= 90 ? 1.15 : (input.leanMass as number) >= 75 ? 1.05 : (input.leanMass as number) >= 60 ? 1.0 : 0.9;
    if (Number.isFinite(input.hrvMs)) r *= (input.hrvMs as number) > 70 ? 1.1 : (input.hrvMs as number) >= 50 ? 1.0 : 0.85;
    if (Number.isFinite(input.sleepHours)) r *= (input.sleepHours as number) >= 7 ? 1.05 : (input.sleepHours as number) >= 6 ? 1.0 : 0.85;
    if (Number.isFinite(input.stressLevel)) r *= (input.stressLevel as number) < 3 ? 1.05 : (input.stressLevel as number) < 6 ? 1.0 : 0.85;
    return r;
  })()));
  const nutritionMult = Math.max(0.6, Math.min(1.5, (() => {
    let n = 1.0;
    if (Number.isFinite(input.calorieSurplus)) n *= (input.calorieSurplus as number) > 300 ? 1.1 : (input.calorieSurplus as number) > 100 ? 1.05 : (input.calorieSurplus as number) < -200 ? 0.8 : 1.0;
    if (Number.isFinite(input.proteinPerKg)) n *= (input.proteinPerKg as number) >= 2.0 ? 1.1 : (input.proteinPerKg as number) >= 1.6 ? 1.05 : (input.proteinPerKg as number) < 1.0 ? 0.85 : 1.0;
    return n;
  })()));
  for (const m of Object.keys(muscleSessionCount)) {
    const lm = landmarksForRotation(level, m, pattern.rotationDays);
    if (lm) {
      let v: number;
      if (input.specialization) {
        // P1-6 (audit 2026-07): специализация — слабые (топ-2) на MAV+10%,
        // остальные на MEV×1.5 (maintenance-higher MEV, антиатрофия).
        // Раньше: 0.85×MAV (близко к MEV) → спад массы в не-слабых.
        // MEV×1.5 = достаточно для сохранения без атрофии (Schoenfeld 2017).
        v = specWeak.includes(m) ? Math.round(lm.mav * 1.1) : Math.round(lm.mev * 1.5);
      } else {
        v = lm.mav;
        if (input.volumeGoal === 'mev') v = lm.mev;
        else if (input.volumeGoal === 'mrv') v = lm.mrv;
      }
      // B7: при смене cut (×0.75) → mass (×1.1) скачок 1.47x. Капнем mass на ×1.05, чтобы плавнее.
      if (input.goal === 'cut') v = Math.round(v * 0.75);  // дефицит калорий → восстановление ↓25%, объём соответственно
      if (input.goal === 'mass' || input.goal === 'strength_mass') v = Math.round(v * 1.05);
      // PED-адаптация: увеличиваем целевой объём пропорционально MRV-множителю
      v = Math.round(v * (pedAdapt?.combinedMrvMultiplier ?? 1));
      if (m === 'back' && input.trainingYears !== undefined) {
        v = Math.round(v * backProfile.targetMult);
      }
      // Enhanced объём ног масштабируется подтверждённым стажем.
      // quads/hamstrings/glutes — большие группы, на курсе восстанавливаются
      // быстрее, но объём не должен расти только из-за флага enhanced.
      if (['quads', 'hamstrings', 'glutes'].includes(m) && input.trainingYears !== undefined) {
        v = Math.round(v * legProfile.targetMult);
      }
      // Enhanced объём груди/плеч масштабируется подтверждённым стажем.
      if (['chest', 'shoulders'].includes(m) && input.trainingYears !== undefined) {
        v = Math.round(v * torsoProfile.targetMult);
      }
      // P0-5: лабораторная коррекция - снижение объёма при ALT/CRP/HCT/гормонах
      v = Math.round(v * (input.labMrvMultiplier ?? 1));
      // PRO: cross-mesocycle volume progression — +1-2 сета per muscle из предыдущего мезо
      if (mesoProgression) {
        v = applyVolumeProgression(m, v, mesoProgression);
      }
      v = muscleVolumeRotation[m] = v;
      volumeTargets[m] = buildBBVolumeTarget({
        muscle: m,
        frequency: muscleSessionCount[m] || 1,
        landmarks: lm,
        rotationSets: v,
        volumeGoal: input.volumeGoal || 'mav',
        weakPoint: isWeak(m, weakPoints),
        focus: focusGroup === m || (focusGroup ? isWeak(m, [focusGroup]) : false),
        // BUG-FIX: recoveryMultiplier уже применён к rotationSets (v) на строках выше
        // (v *= recoveryMult * nutritionMult * pedAdapt * labMrvMultiplier * goal).
        // Передаём 1.0 чтобы избежать двойного применения.
        // MRV cap (mrvByMuscle[m]) вычисляется отдельно на строке 1977 с учётом recovery.
        recoveryMultiplier: 1,
      });
      // fix D: истинный MRV — потолок для капа.
      // fix C: для отстающих/фокус-групп поднимаем потолок в такт объёмному
      // бусту (weak ×1.2, focus ×1.3), иначе normalizeWeekMrv стирает акцент.
      // PED: базовый MRV умножается на combinedMrvMultiplier ДО корректировок
      let capMrv = Math.round(lm.mrv * (pedAdapt?.combinedMrvMultiplier ?? 1) * (input.labMrvMultiplier ?? 1) * recoveryMult * nutritionMult * (m === 'back' && input.trainingYears !== undefined ? backProfile.capMult : 1) * (['quads', 'hamstrings', 'glutes'].includes(m) && input.trainingYears !== undefined ? legProfile.capMult : 1) * (['chest', 'shoulders'].includes(m) && input.trainingYears !== undefined ? torsoProfile.capMult : 1));
      if (isWeak(m, weakPoints)) capMrv = Math.round(capMrv * 1.2);
      if (focusGroup === m || (focusGroup && isWeak(m, [focusGroup]))) capMrv = Math.round(capMrv * 1.3);
      mrvByMuscle[m] = capMrv;
    }
  }
  // B6: расширяем mrvByMuscle для PRO-ключей (delt_front/mid/rear, forearms, traps, lower_back, abs).
  // Раньше cap отсутствовал → normalizeWeekMrv игнорировал эти мышцы при `mrvByMuscle[m] || 0 = 0`.
  const PRO_KEYS = ['delt_front', 'delt_mid', 'delt_rear', 'forearms', 'traps', 'lower_back', 'abs'];
  for (const m of PRO_KEYS) {
    if (mrvByMuscle[m]) continue;
    // BUG-FIX: проверяем excludedMuscles для PRO-ключей (и их collapseKey).
    // Раньше травмированные PRO-мышцы (например forearms) получали MRV cap,
    // и normalizeWeekMrv пытался капать упражнения для них.
    if (excludedMuscles.has(m) || excludedMuscles.has(collapseKey(m))) continue;
    const lm = landmarksForRotation(level, m, pattern.rotationDays);
    if (lm) {
      let capMrv = Math.round(lm.mrv * (pedAdapt?.combinedMrvMultiplier ?? 1) * (input.labMrvMultiplier ?? 1) * recoveryMult * nutritionMult);
      if (isWeak(m, weakPoints)) capMrv = Math.round(capMrv * 1.2);
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
  // P0-7 (audit 2026-07): ACWR thresholds — 1.3 = caution (display only),
  // 1.5 = enforce deload (Grgic 2020; optimum 0.8-1.3, caution 1.3-1.5, danger >1.5).
  const acwrCaution = acwrRatio > 1.3 && acwrRatio <= 1.5 && input.weeks >= 3;
  const acwrDanger = acwrRatio > 1.5 && input.weeks >= 3;
  if (acwrDanger) {
    deloadFreq = Math.max(1, Math.min(deloadFreq || 3, 3));
  }
  const phaseDist = distributePhases(input.weeks, deloadFreq, input.goal || 'mass');
  // P2: принудительный финальный делод для 4-5 нед планов (через замену последней недели)
  if (forceFinalDeload && input.weeks >= 4) {
    const lastIdx = phaseDist.findIndex(pd => pd.startWeek === input.weeks);
    if (lastIdx >= 0) {
      phaseDist[lastIdx] = { phase: 'deload', startWeek: input.weeks, endWeek: input.weeks, weeks: [input.weeks], config: PHASE_CONFIGS.deload };
    }
  }
  const phaseByWeek = new Map<number, BBPhase>();
  // Store the phase for every week in the block, not only its first week.
  // Otherwise weeks inside a multi-week phase silently fall back to
  // accumulation and receive the wrong volume/RIR/tempo.
  for (const pd of phaseDist) {
    for (const week of pd.weeks) phaseByWeek.set(week, pd.phase);
  }
  const phaseWeekCounter: Record<string, number> = { accumulation: 0, intensification: 0, deload: 0, peaking: 0 };

  const weeks: BBWeek[] = [];
  // FIX-1: Ротация упражнений — НАКАПЛИВАЕТ использованные упражнения весь план.
  // НЕ сбрасываем каждые 4 нед — вместо этого selectExercisesSmart исключает
  // все ранее использованные → недели получают РАЗНЫЕ упражнения (ротация).
  // Fallback: если пул исчерпан (все исключены) — selectExercisesSmart вернёт 0,
  // тогда buildSession очистит rotationIds для этой мышцы и пересоберёт.
  const rotationUsedByMuscle = new Map<string, string[]>(); // muscle → [exerciseName, ...]
  const primaryBySlot = new Map<string, string>();
  const weekRotationByMuscle = new Map<string, Set<string>>(); // muscle →Set<name> внутри недели
  const prevWeekUsedByMuscle = new Map<string, Set<string>>(); // muscle →Set<name> за предыдущую неделю
  // fix L: паттерны движений, уже задействованные для отстающих групп внутри текущей недели.
  // Сбрасывается каждую неделю; позволяет не повторять один и тот же паттерн на разных днях.
  const weekWeakPatterns = new Map<string, Set<string>>(); // weakMuscle → Set<pattern>

  for (let w = 1; w <= input.weeks; w++) {
    // P5: Volume progression MEV→MAV→MRV (Helms 2022)
    // Week 1 = 0.85× (MEV), mid = 1.0× (MAV), last = 1.10× (MRV), deload = 0.6×
    const weekPhase = phaseByWeek.get(w) || 'accumulation';
    const weekVolumeMult = weekPhase === 'deload' ? 0.6
      : Math.min(1.10, 0.85 + ((w - 1) / Math.max(1, input.weeks - 1)) * 0.25);
    const scaledVolumeRotation: Record<string, number> = {};
    for (const [m, v] of Object.entries(muscleVolumeRotation)) {
      scaledVolumeRotation[m] = Math.round(v * weekVolumeMult);
    }
    // Ротация: НЕ сбрасываем — накапливаем все использованные упражнения
    // (каждая неделя получает новые упражнения, пока пул не исчерпан)
    // fix L: паттерны отстающих групп сбрасываются раз в неделю (свежий выбор движений)
    weekWeakPatterns.clear();
    const musclePrimaryAssigned = new Set<string>(); // ← сбрасывается КАЖДУЮ неделю
    const weekUsedByMuscle = new Map<string, Set<string>>(); // muscle →Set<name> внутри недели
    const weekSessions: BBSession[] = [];
    const phase = phaseByWeek.get(w) || 'accumulation';
    phaseWeekCounter[phase] = (phaseWeekCounter[phase] || 0) + 1;
    const phaseWeek = phaseWeekCounter[phase];
    // Soft freshness: упражнения предыдущей недели — в штрафном списке (не хард-блок).
    const prevWeekNames = (() => {
      const out: string[] = [];
      for (const set of prevWeekUsedByMuscle.values()) out.push(...set);
      return out;
    })();
    // FB-ротация: запрещаем повтор упражнений между днями
    const fbUsedIds: string[] = [];
    const fbUsedNames: string[] = [];
    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i];
      // FB primary distribution перенесён ВНУТРИ buildSession (надёжнее).
      const isFB = s.sessionTag === 'FullBody';
      // fix Z: sessMuscles по collapseKey (delt heads→shoulders) для mrvByMuscle-lookup
      const sessMuscles = [...new Set(musclesForTag(s.sessionTag).map(m => collapseKey(m)))];
      // Ротация: собираем ID упражнений, использованных ранее для этих мышц.
      // rotationUsedByMuscle хранит exerciseName (имена) → конвертируем в IDs для selectExercisesSmart.
      const rotationIds: string[] = [];
      const rotationNames: string[] = [];
      for (const m of sessMuscles) {
        const prevNames = rotationUsedByMuscle.get(m) || [];
        rotationNames.push(...prevNames);
        // Конвертировать имена в IDs через каталог
        for (const name of prevNames) {
          const cat = EXERCISE_CATALOG.find((e: any) => e.name === name);
          if (cat && cat.id) rotationIds.push(cat.id);
        }
      }
      // PRO: cross-mesocycle rotation — добавляем упражнения из предыдущего мезо
      // в rotationNames (мягкое понижение приоритета, не полный запрет).
      if (mesoProgression) {
        for (const name of mesoProgression.previousExercises) {
          if (!rotationNames.includes(name)) rotationNames.push(name);
        }
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
       const sess = buildSession(s, i + 1, w, scaledVolumeRotation, muscleSessionCount, musclePrimaryAssigned, workMax, weakPoints, focusGroup, pedAdapt, sessDailyCap, level, weekInjuryProfile, new Set(weekInjuryProfile), weekExcluded, weekGraded, weekDate, phase, phaseWeek, mrvRot, isFB ? fbUsedIds : [], [...(isFB ? fbUsedNames : []), ...rotationNames], rotationIds, favIds, exclIds, avAxial, eqList, input.methodology, input.sex === 'female', undefined, undefined, undefined, undefined, undefined, undefined, undefined, false, input.sex, new Map(), primaryBySlot, input.trainingFocus, input.eccentricMult, input.mobilityRestrictions, input.trainingYears, input.bodyweightCapability);
      sess.weekOffset = (w - 1) * pattern.rotationDays + (i + 1);
      // FB: собираем ID и имена упражнений для запрета повторов
      if (isFB) for (const ex of sess.exercises) {
        if (ex.exerciseName) { fbUsedIds.push(ex.exerciseName); fbUsedNames.push(ex.exerciseName); }
      }
      // Ротация: запоминаем только accessory-упражнения для следующих недель.
      // Primary lifts are deliberately stable across the phase block; putting
      // them into the rotation blacklist made the main compound change weekly.
      // BUG-B19: при накоплении на 12-нед плане пул упражнений исчерпывается → fallback на
      // повтор упражнений. Сбрасываем каждые 4 недели (ротация обновляется), сохраняя свежесть.
      if (w > 1 && (w - 1) % 4 === 0) {
        // Оставляем только последние 4 недели упражнений (свежая память)
        for (const [m, arr] of rotationUsedByMuscle) {
          if (arr.length > 8) rotationUsedByMuscle.set(m, arr.slice(-8));
        }
      }
      for (const ex of sess.exercises) {
        if (ex.role === 'primary') continue;
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
          const raw = e.group;
          const mg = collapseKey(trueMuscleOf(e) || raw);
          if (raw !== wm && mg !== wm) return false;
          if (e.exerciseType !== 'isolation' && e.type !== 'isolation') return false;
          if (isBBJunk(e)) return false;
          // Equipment filter (same as main pool)
          if (eqList.length > 0) {
            const rawEq = e.equipment;
            const exEq: string[] = Array.isArray(rawEq) ? rawEq : (rawEq ? [String(rawEq)] : []);
            if (exEq.length > 0 && !exEq.some(eq => eqList.includes(eq))) return false;
          }
          if (avAxial && isAxialLoadExercise(e as any)) return false; // осевая исключена
          // Rear delt НЕ в Push/Chest-днях (только в Pull/Back)
          if (isPushDayTag(s.sessionTag || '') && isRearDeltExercise(e.name)) return false;
          return true;
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
        const fTempo = tempoFor('памп', undefined, phase);
        // Realistic weak-feeder: 2×15-20 (а не 1×18) — даёт значимый объём для достижения MEV.
        const feederSetCount = 2;
        sess.exercises.push({
          muscle: wm, name: fName, role: 'accessory' as const, character: 'памп' as DayCharacter,
          sets: feederSetCount, repsRange: [15, 20] as [number, number], rir: 3,
          workSets: Array.from({ length: feederSetCount }, () => ({ reps: 18, rir: 3, weight: feederWeight, tempo: fTempo.notation, restSeconds: 30 })),
          exerciseName: fName, tempoSpec: fTempo.notation, restSeconds: 30,
          comment: `Фидер-сет (grease-the-groove) для отстающей группы ${wm}: 2×15-20 RIR 3 @${feederWeight}кг, ~30% рабочего веса, пампинг.`,
          warmupSets: [], rationale: 'Акцент на отстающую группу: добивочный кровенаполнительный сет в конце дня.',
        });
        addedFeeders.add(wm);
        addedFeeders.add(fName);
        usedPatterns.add(derivePattern(fData));
      }
      // fix K: памп-финишер для первичных групп, у которых день — толко «тяж» (без метаболического стресса).
      // P1-1 (audit 2026-07): убран weak-gate — pump-finisher добавляется для ВСЕХ primary muscles,
      // не только не-weak. Bro-split (1 группа/день) иначе = только тяжёлые сеты для lead-muscle.
      // Schoenfeld 2018: metabolic stress work after heavy compounds +5-10% hypertrophy.
      // ★ Primary-dominance fix: pump-finisher только для lead-мышцы + weakPoints.
      // Раньше добавлялся для ВСЕХ sessMuscles (biceps/traps в Pull) → accessory получали
      // 2-е упражнение (pump) → biceps=2ex при back=4ex, и сеты accessories > primary.
      for (const pm of sessMuscles) {
        if (Array.from(weekExcluded).includes(pm)) continue;
        if (pm !== sessMuscles[0] && !isWeak(pm, weakPoints)) continue;
        if (sess.exercises.some(e => (e.muscle === pm || collapseKey(e.muscle) === pm) && (e as any).character === 'памп')) continue;
        const pumpPool = (EXERCISE_CATALOG as any[]).filter((e: any) => {
          const raw = e.group;
          const mg = collapseKey(trueMuscleOf(e) || raw);
          if (raw !== pm && mg !== pm) return false;
          if (e.exerciseType !== 'isolation' && e.type !== 'isolation') return false;
          if (isBBJunk(e)) return false;
          if (eqList.length > 0) {
            const rawEq = e.equipment;
            const exEq: string[] = Array.isArray(rawEq) ? rawEq : (rawEq ? [String(rawEq)] : []);
            if (exEq.length > 0 && !exEq.some(eq => eqList.includes(eq))) return false;
          }
          if (avAxial && isAxialLoadExercise(e as any)) return false;
          // Rear delt НЕ в Push/Chest-днях (только в Pull/Back)
          if (isPushDayTag(s.sessionTag || '') && isRearDeltExercise(e.name)) return false;
          return true;
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
        const pTempo = tempoFor('памп', undefined, phase);
        // B3/B11: реалистичный pump-finisher с MRV-капом. Считаем текущие сеты мышцы pm,
        // и уменьшаем pumpSetCount, если добавление 2×15-20 превысит недельный MRV.
        const mrvCap = mrvByMuscle[pm] || 0;
        let currentForPm = 0;
        for (const ex of sess.exercises) {
          if (collapseKey(ex.muscle) === pm) currentForPm += ex.workSets?.length || ex.sets || 0;
        }
        const maxPumpSets = Math.max(0, mrvCap - currentForPm);
        const pumpSetCount = Math.min(2, maxPumpSets);
        if (pumpSetCount === 0) continue;
        sess.exercises.push({
          muscle: pm, name: pName, role: 'accessory' as const, character: 'памп' as DayCharacter,
          sets: pumpSetCount, repsRange: [15, 20] as [number, number], rir: 3,
          workSets: Array.from({ length: pumpSetCount }, () => ({ reps: 18, rir: 3, weight: pumpWeight, tempo: pTempo.notation, restSeconds: 30 })),
          exerciseName: pName, tempoSpec: pTempo.notation, restSeconds: 30,
          comment: `Памп-финишер для ${pm}: ${pumpSetCount}×15-20 RIR 3 @${pumpWeight}кг, ~30% рабочего веса, метаболический стресс в конце тяжёлого дня.`,
          warmupSets: [], rationale: 'Баланс тяж/памп: добивочный high-rep сет для гипертрофии.',
        });
        addedFeeders.add(pm);
        addedFeeders.add(pName);
      }
      // Re-sort after feeders/pump-finishers to restore muscle grouping
      const reordered = orderSessionExercises(sess.exercises, {
        sessionTag: s.sessionTag,
        methodology: input.methodology as any,
        priorityMuscles: [...weakPoints, ...(focusGroup ? [focusGroup] : [])],
      });
      sess.exercises.length = 0; sess.exercises.push(...reordered);
      weekSessions.push(sess);
    }
    // fix D: капаем недельный объём каждой мышцы по её истинному MRV
    normalizeWeekMrv(weekSessions, mrvByMuscle, phase === 'deload');
    weeks.push({ week: w, phase, deload: phase === 'deload', sessions: weekSessions });
    // Запоминаем упражнения этой недели для мягкого freshness блокировки следующей.
    prevWeekUsedByMuscle.clear();
    for (const sess of weekSessions) {
      for (const ex of sess.exercises) {
        const m = collapseKey(ex.muscle);
        if (!prevWeekUsedByMuscle.has(m)) prevWeekUsedByMuscle.set(m, new Set());
        prevWeekUsedByMuscle.get(m)!.add(ex.exerciseName || ex.name || '');
      }
    }
  }

  // FIX-2: Прогрессия весов (double_progression) — реальный прогресс от недели к неделе.
  // До fix веса менялись ТОЛЬКО от сжатия RIR (3→0 = +14% за 8 нед), без истинной перегрузки.
  // Теперь каждая следующая неделя берёт вес предыдущей и применяет prescribeLoad.
  // FIX-A5: prescribeLoad возвращает nextWeight + nextReps + nextRIR, но старый код
  // применял ТОЛЬКО nextWeight. Для double_progression при currentReps < repCap
  // nextWeight = currentWeight (без изменения!) → вес не рос неделями.
  // Теперь: применяем nextReps (прогрессия повторов) и nextRIR (дрифт RIR) тоже.
  for (let wi = 1; wi < weeks.length; wi++) {
    const prevWeek = weeks[wi - 1];
    const curWeek = weeks[wi];
    const curPhase = phaseByWeek.get(curWeek.week) || 'accumulation';
    // Пропускаем делод-неделю: вес не растёт, объём уже срезан normalizeWeekMrv.
    if (curPhase === 'deload') continue;
    // C1: Если предыдущая неделя была deload — ищем ОЦЕПКУ назад до первой
    // non-deload недели (а не просто wi-2, которая тоже может быть deload).
    // Ранее: двойной deload (W2+W3) → W4 брала базу из W3 (deload) → заниженный старт.
    let useWeek: typeof prevWeek | null = null;
    for (let back = wi - 1; back >= 0; back--) {
      const bk = weeks[back];
      const bkPhase = phaseByWeek.get(bk.week) || 'accumulation';
      if (bkPhase !== 'deload') { useWeek = bk; break; }
    }
    if (!useWeek) continue;
    for (const curSess of curWeek.sessions) {
      for (const curEx of curSess.exercises) {
        // B5: exact name match + fuzzy fallback для rotated/substituted exercises.
        // Ранее: pe.name === curEx.name → сбой при ротации (жим лёжа ↔ жим штанги лёжа).
        const prevExercises = useWeek.sessions.flatMap(s => s.exercises);
        let prevEx = prevExercises.find(pe => pe.name === curEx.name && pe.muscle === curEx.muscle);
        if (!prevEx) {
          // Fuzzy: та же мышца + нормализованный token overlap ≥ 2 OR substring
          const curNorm = (curEx.name || '').toLowerCase().replace(/ё/g, 'е').trim();
          const curTokens = curNorm.split(/\s+/).filter(t => t.length > 2);
          prevEx = prevExercises.find(pe => {
            if (pe.muscle !== curEx.muscle) return false;
            const peNorm = (pe.name || '').toLowerCase().replace(/ё/g, 'е').trim();
            if (curNorm === peNorm) return true;
            const overlap = curTokens.filter(t => peNorm.includes(t)).length;
            return overlap >= 2 || (curTokens.length >= 2 && overlap >= 1 && peNorm.includes(curNorm));
          });
        }
        if (!prevEx) continue;
        const maxW = workMax[curEx.muscle] || defaultWorkMax(curEx.muscle);
        const prevWs = prevEx.workSets[0];
        if (!prevWs) continue;
        const prescr = prescribeLoad(
          'double_progression',
          prevWs.weight, prevWs.reps, prevEx.rir,
          maxW, curWeek.week, input.weeks, curPhase,
          curEx.exerciseType || (curEx as any).type || 'compound',
          curEx.role,
        );
        // Применяем weight + reps (progression). RIR НЕ трогаем — он управляется
        // bbRir (phase-based periodization). prescribeLoad возвращает nextRIR,
        // но он предназначен для feedback-loop (plannedRir), а не для base progression.
        for (const ws of curEx.workSets) {
          ws.weight = Math.round(prescr.nextWeight * 10) / 10;
          ws.reps = prescr.nextReps;
        }
        // Обновляем repsRange для отображения актуального диапазона.
        if (curEx.repsRange && curEx.repsRange.length === 2) {
          curEx.repsRange = [prescr.nextReps, prescr.nextReps + 2];
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
    `Ротация упражнений: накапливает использованные весь план — недели получают РАЗНЫЕ упражнения (пока пул не исчерпан, затем fallback).`,
    `S-MRV: автоматический кап объёма на основе бюджета утомления сессии + потолок по MRV мышцы.`,
    ...(pedAdapt ? [`PED-адаптация: MRV×${pedAdapt.combinedMrvMultiplier.toFixed(2)}, восстановление×${pedAdapt.combinedRecoveryMultiplier.toFixed(2)}${pedAdapt.activePEDs.length > 0 ? ' (' + pedAdapt.perPED.map(p => `${p.ped}${p.dose > 0 ? ' ' + p.dose : ''}`).join(' + ') + (pedAdapt.courseIntensity !== 'moderate' ? ', ' + pedAdapt.courseIntensity : '') + ')' : ''}`] : []),
    ...(injuries.length > 0 ? [`Травмы (per-week по дате плана${input.planStartWeek ? ` со старта ${input.planStartWeek}` : ''}): исключены ${[...new Set(injuries.filter(i => i.exclude !== false).map(i => i.muscle))].join(', ') || '—'}; градация ${[...new Set(injuries.filter(i => i.exclude === false).map(i => i.muscle))].join(', ') || '—'} — упражнения заменяются на безопасные альтернативы с пониженным весом/объёмом.`] : []),
    // P0-7: ACWR cautions
    ...(acwrCaution ? [`⚠ ACWR=${acwrRatio.toFixed(2)} — зона осторожности (1.3-1.5). Рассмотрите снижение объёма или разгрузочную неделю.`] : []),
    ...(acwrDanger ? [`🚨 ACWR=${acwrRatio.toFixed(2)} — опасная зона (>1.5). Принудительная разгрузка каждые 3 нед.`] : []),
    // P1-2: bro_5 warning
    ...(pattern.id === 'bro_5' ? [`⚠ Bro Split 5×/нед — низкая частота 1×/нед на группу; ≥2×/нед результативнее для натуралов (Schoenfeld 2018 мета-анализ).`] : []),
  ];

  const basePlan: BBPlan = { pattern, weeks, rotationMuscleVolume: muscleVolumeRotation, rationale, volumeTargets };
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
  // P0-5 (audit 2026-07): лабораторная коррекция MRV.
  // labMrvMultiplier (0.7-1.0) от labTrainingAdjust(linked.labAnalysis).mrvMultiplier:
  // ALT↑/CRP↑/HCT↑/почечный стресс/низкий тестостерон → снижение допустимого объёма.
  // Применяется ПОСЛЕ PED-множителя (PED повышает MRV, лаборатория снижает — независимые оси).
  const labMult = input.labMrvMultiplier ?? 1;
  const effectiveMrvMult = pedMrvMult * labMult;
  if (labMult < 1) {
    rationale.push(`🧪 Лабораторная коррекция: MRV ×${labMult.toFixed(2)} (печень/почки/воспаление/гормоны) → эффективный MRV-множитель ×${effectiveMrvMult.toFixed(2)}.`);
    if (input.labWarnings && input.labWarnings.length > 0) {
      rationale.push(...input.labWarnings.map(w => `⚠ ${w}`));
    }
    if (input.labIntensityNote) {
      rationale.push(`🧪 Интенсивность: ${input.labIntensityNote}`);
    }
  }
  // PRO: cross-mesocycle continuity — отчёт о прогрессии
  if (mesoProgression) {
    const musclesProgressed = Object.keys(mesoProgression.weightProgression).length;
    const avgDelta = musclesProgressed > 0
      ? Math.round(Object.values(mesoProgression.weightProgression).reduce((s, v) => s + v, 0) / musclesProgressed * 10) / 10
      : 0;
    rationale.push(`🔗 Cross-mesocycle: веса +${avgDelta} кг (${musclesProgressed} мышц), объём +${Object.values(mesoProgression.volumeDelta).filter(v => v > 0).length} групп, ротация ${mesoProgression.previousExercises.length} упр.`);
    if (mesoProgression.needsDeload) {
      rationale.push(`⚠ Cross-mesocycle: предыдущий мезо был длинным/объёмным — рекомендуется deload-неделя в начале нового плана.`);
    }
  }
  // Cross-day weakPoints compensation: если слабая группа получает < MEV за неделю (потому что
  // не входит ни в один дневной тег), добавить feeder-сет в ближайший релевантный день.
  finalPlan = weakPoints.length > 0
    ? compensateCrossDayWeakPoints(finalPlan, weakPoints, level, workMax, eqList, effectiveMrvMult, avAxial, phaseByWeek)
    : finalPlan;
  // Final re-sort: compensateCrossDayWeakPoints may have added feeders that break grouping
  for (const w of finalPlan.weeks) {
    for (const s of w.sessions) {
      // ━━━ ДЕДУПЛИКАЦИЯ ━━━
      // 1. Точные дубликаты по имени
      const seenNames = new Set<string>();
      s.exercises = s.exercises.filter(e => {
        const n = (e.exerciseName || e.name || '').toLowerCase();
        if (seenNames.has(n)) return false;
        seenNames.add(n);
        return true;
      });
      // 2. Дубликаты по паттерну (5 ягодичных мостов → оставить 2)
       const PER_MUSCLE_MAX: Record<string, number> = {
         glutes: 3, hamstrings: 3, quads: 4, chest: 4, back: (level === 'enhanced' && (input.trainingYears ?? 0) >= 3) ? 8 : 4,
        shoulders: 3, biceps: 3, triceps: 3, calves: 2, abs: 3,
        traps: 2, forearms: 2, core: 2, lower_back: 2,
      };
      const perMuscleCount: Record<string, number> = {};
      // 3. Подсчёт similarity: "ягодичный мост на скамье" ~ "ягодичный мост на полу" → один паттерн
      const patternOf = (name: string): string => {
        const n = name.toLowerCase();
        if (/ягодичн.*мост|hip.?thrust|glute.?bridge/i.test(n)) return 'hip_thrust';
        if (/сгибан.*ног|leg.?curl/i.test(n)) return 'leg_curl';
        if (/разгибан.*ног|leg.?ext/i.test(n)) return 'leg_ext';
        if (/выпад|lunge|болгар|реверанс/i.test(n)) return 'lunge';
        if (/присед|squat/i.test(n) && !/над голов|overhead|пистол/i.test(n)) return 'squat';
        if (/жим.*ног|leg.?press/i.test(n)) return 'leg_press';
        if (/жим.*лёж|bench.*press/i.test(n) && !/наклон|incline/i.test(n)) return 'bench_press';
        if (/жим.*наклон|incline.*press/i.test(n)) return 'incline_press';
        if (/развод|fly|сведен|пек.?дек|butterfly|кроссовер.*сведен/i.test(n)) return 'fly';
        // Подтягивание и верхний блок — один функциональный vertical-pull
        // паттерн. Разный хват не делает их двумя независимыми слотами.
        if (/подтяг|pull.?up|chin|тяга.*верхн.*блок|lat.?pull|пуллдаун|верхн.*блок/i.test(n)) return 'vertical_pull';
        if (/тяга.*лиц|face.?pull/i.test(n)) return 'face_pull';
        if (/тяга|row|йейтс|seal|пендл/i.test(n) && !/подтяг|лиц|резин/i.test(n)) return 'row';
        if (/шраг/i.test(n)) return 'shrug';
        if (/молот|hammer/i.test(n)) return 'hammer_curl';
        if (/подъём.*бицепс|сгибан.*бицепс|сгибан.*рук|curl/i.test(n)) return 'biceps_curl';
        if (/разгибан.*трицепс|pushdown|француз|tricep/i.test(n)) return 'tricep_ext';
        if (/жим.*армейск|жим.*standing|жим.*сидя|arnold|арнольд|жим.*гантел.*стоя|жим.*гантел.*сидя|ohp|жим.*смите.*сидя/i.test(n)) return 'shoulder_press';
        if (/лэндмайн|landmine/i.test(n)) return 'landmine_press';
        if (/мах|raise|отведен|разведен/i.test(n) && /наклон|задн|rear/i.test(n)) return 'rear_delt';
        if (/мах|raise|в сторон|lateral/i.test(n)) return 'lateral_raise';
        if (/подъём.*носк|calf/i.test(n)) return 'calf_raise';
        if (/сгибан.*запяст|разгибан.*кист|сгибан.*предплеч|forearm|wrist/i.test(n)) return 'forearm';
        if (/скручив|crunch/i.test(n)) return 'crunch';
        if (/отжиман.*брус|dip/i.test(n)) return 'dips';
        return n; // уникальное имя = уникальный паттерн
      };
      const perPatternCount: Record<string, number> = {};
      // ★ C: Малые мышцы — макс 1 упражнение одного паттерна (достаточно),
      // крупные — макс 2 (разные углы жима/тяги — нормально)
      const SINGLE_PATTERN_MUSCLES = new Set(['glutes', 'calves', 'traps', 'forearms', 'abs', 'biceps', 'triceps', 'shoulders', 'delt_front', 'delt_mid', 'delt_rear']);
      s.exercises = s.exercises.filter(e => {
        const m = collapseKey(e.muscle || '');
        const name = (e.exerciseName || e.name || '');
        const pat = patternOf(name);
        const muscleCap = PER_MUSCLE_MAX[m] ?? 4;
        // Кап по мышце
        perMuscleCount[m] = (perMuscleCount[m] || 0) + 1;
        if (perMuscleCount[m] > muscleCap) return false;
        // Кап по паттерну (1 для малых мышц, 2 для крупных)
         // Для спины два разных vertical-pull в одной сессии — это обычно
         // дубль функции, а не второй качественный слот. Разводить ширину
         // следует между сессиями/неделями, а не двумя верхними тягами подряд.
      const patMax = m === 'back' && (pat === 'vertical_pull' || pat === 'pulldown' || pat === 'pullup')
           ? 1
           : (SINGLE_PATTERN_MUSCLES.has(m) ? 1 : 2);
        const patKey = m + ':' + pat;
        perPatternCount[patKey] = (perPatternCount[patKey] || 0) + 1;
        if (perPatternCount[patKey] > patMax) return false;
        return true;
      });
      // Re-sort после дедупликации (с сохранением методики пользователя — pre_exhaust/post_exhaust).
      // Ранее здесь вызывался orderSessionExercises БЕЗ methodology, что сбрасывало pre_exhaust
      // обратно в compound_first — выбор методики в UI не имел эффекта на финальный порядок.
      const reordered = orderSessionExercises(s.exercises, {
        sessionTag: s.sessionTag || '',
        methodology: input.methodology,
        priorityMuscles: [...weakPoints, ...(focusGroup ? [focusGroup] : [])],
      });
      s.exercises.length = 0; s.exercises.push(...reordered);
      // P0-1: итоговый кап — профессиональный предел 6-10 упражнений на сессию.
      // Раньше: max(9, min(13, muscles×2)) → FullBody (6 мышц × 2 = 12, cap 12) = 19 упражнений!
      // Теперь: max(6, min(10, muscles+2)) → FullBody (6+2=8) = 8 упражнений. Профессионал
      // ставит 6-8 упражнений в полный день, 4-6 в специализированный.
      const sessMuscleCount = new Set(s.exercises.map(e => collapseKey(e.muscle))).size;
       const highVolumeEnhanced = level === 'enhanced' && (input.trainingYears ?? 0) >= 3;
       const finalCap = highVolumeEnhanced
         ? Math.max(10, Math.min(16, sessMuscleCount + 7))
         : Math.max(6, Math.min(10, sessMuscleCount + 2));
      if (s.exercises.length > finalCap) {
        s.exercises.length = finalCap;
      }
      // P0-1: финальная гарантия arms — ПОСЛЕ всех обрезок (exCap, finalCap, dedup).
      // Если biceps/triceps были отрезаны — добавляем принудительно 1 упражнение на каждое.
      const dayMusclePlans = dedupeMuscles(s.sessionTag, new Set());
      const dayArmMuscles = new Set(dayMusclePlans.filter(mp => ARM_MUSCLES_SET.has(mp.group)).map(mp => mp.group));
      if (dayArmMuscles.size > 0) {
        const presentM = new Set(s.exercises.map(e => e.muscle));
        const wPhase = phaseByWeek.get(w.week) || 'accumulation';
        for (const m of dayArmMuscles) {
          if (presentM.has(m)) continue;
          // Найти изоляцию на эту мышцу в каталоге
          const pool = (EXERCISE_CATALOG as any[]).filter((e: any) => {
            const mg = collapseKey(trueMuscleOf(e) || e.group || '');
            if (mg !== m) return false;
            if (e.exerciseType !== 'isolation' && e.type !== 'isolation') return false;
            if (isBBJunk(e)) return false;
            if (isInappropriateBB(e)) return false;
            if (eqList?.length && e.equipment && !eqList.includes(e.equipment)) return false;
            return true;
          });
          if (!pool.length) continue;
          const fData = pool[0];
          const fName = fData.name || fData.id;
          const fBase = (workMax as any)[m] || DEFAULT_WORKMAX[m] || 50;
          const armSets = 3;
          const pcfg = PHASE_CONFIGS[wPhase];
          const armReps = Math.round((pcfg.repRange[0] + pcfg.repRange[1]) / 2) + 2;
          const armWeight = Math.round(fBase * pcfg.intensityMultiplier * 0.88 * 10) / 10;
          s.exercises.push({
            muscle: m, name: fName, role: 'accessory' as const,
            character: 'памп' as DayCharacter, sets: armSets,
            repsRange: [pcfg.repRange[0] + 2, pcfg.repRange[1] + 5] as [number, number],
            rir: 3,
            workSets: Array.from({ length: armSets }, () => ({ reps: armReps, rir: 3, weight: armWeight, tempo: pcfg.tempo, restSeconds: Math.max(45, pcfg.restBase - 30) })),
            exerciseName: fName,
            tempoSpec: pcfg.tempo, restSeconds: Math.max(45, pcfg.restBase - 30),
            comment: `🎯 Arm-guarantee: ${m} — P0-1 (arms защищены от обрезки exCap/finalCap/dedup).`,
            warmupSets: [], rationale: 'Arm guarantee: P0-1',
          });
        }
      }
    }
    // P0-2: финальный MRV-кап ПОСЛЕ всех модификаций (dedup, feeders, re-sort).
    // Раньше normalizeWeekMrv вызывался до compensateCrossDayWeakPoints/dedup,
    // и feeders/dedup могли добавить объём выше MRV.
    normalizeWeekMrv(w.sessions, mrvByMuscle, w.phase === 'deload' || !!w.deload);
  }
  // P1-5: auto-MEV-feeder — мышцы с объёмом < MEV получают feeder в ближайший релевантный день.
  // Актуально для bro_5 (calves=2, glutes=4 при MEV=8) и других 1×/нед сплитов.
  // Берём первую неделю как образец (все недели одинаковы по структуре без weakPoints).
  if (finalPlan.weeks.length > 0) {
    const wk1 = finalPlan.weeks[0];
    const normLvl = normLevel(level);
    const autoFeedMuscles = ['calves', 'glutes', 'abs', 'forearms', 'hamstrings', 'shoulders', 'biceps', 'triceps'];
    for (const m of autoFeedMuscles) {
      let weekSets = 0;
      for (const s of wk1.sessions) for (const e of s.exercises) if (collapseKey(e.muscle) === m) weekSets += e.sets;
      const lm = getVolumeLandmarks(normLvl, m);
      if (!lm) continue;
      const targetMEV = Math.round(lm.mev * effectiveMrvMult);
      if (weekSets >= targetMEV) continue;
      // Найти ближайший день с этой мышцей (или совместимый тег)
      const allowedTags = WEAKPOINT_DAY_TAGS[m] ?? ['Legs', 'Lower', 'FullBody'];
      let bestSlot: BBSession | null = null;
      let bestScore = -Infinity;
      for (const w of finalPlan.weeks) {
        for (const s of w.sessions) {
          const tag = (s.sessionTag || '').toLowerCase();
          if (!allowedTags.some(at => tag.includes(at.toLowerCase()))) continue;
          const score = s.exercises.length * 10;
          if (score > bestScore) { bestScore = score; bestSlot = s; }
        }
      }
      if (!bestSlot) continue;
      // Найти изоляцию на эту мышцу
      const feederPool = (EXERCISE_CATALOG as any[]).filter((e: any) => {
        const mg = collapseKey(trueMuscleOf(e) || e.group || '');
        if (mg !== m) return false;
        if (e.exerciseType !== 'isolation' && e.type !== 'isolation') return false;
        if (isBBJunk(e)) return false;
        if (isInappropriateBB(e)) return false;
        if (eqList?.length && e.equipment && !eqList.includes(e.equipment)) return false;
        if (avAxial && isAxialLoadExercise(e as any)) return false;
        return true;
      });
      if (!feederPool.length) continue;
      feederPool.sort((a, b) => (a.name?.length || 0) - (b.name?.length || 0));
      const fBase = (workMax as any)[m] || DEFAULT_WORKMAX[m] || 50;
      const feederWeight = Math.max(5, Math.round(fBase * 0.3 * 10) / 10);
  const fTempo = tempoFor('памп', undefined, phaseByWeek.get(wk1.week) || 'accumulation');
  const need = Math.max(2, targetMEV - weekSets);
      // P1-5: если need > perExCap (6 для calves/abs/forearms, 8 для остальных) — разбить на 2 упражнения.
      const perExCapM = (m === 'forearms' || m === 'calves' || m === 'abs') ? 6 : 8;
      const useTwoEx = need > perExCapM && feederPool.length >= 2;
      const setsPerEx = useTwoEx ? Math.ceil(need / 2) : need;
      const fData = feederPool[0];
      const fName = fData.name || fData.id;
      const fData2 = useTwoEx ? feederPool[1] : null;
      const fName2 = fData2 ? (fData2.name || fData2.id) : null;
      // Добавить feeder в каждую неделю
      for (const w of finalPlan.weeks) {
        for (const s of w.sessions) {
          const tag = (s.sessionTag || '').toLowerCase();
          if (!allowedTags.some(at => tag.includes(at.toLowerCase()))) continue;
          if (s.exercises.some(e => e.name === fName)) continue;
          s.exercises.push({
            muscle: m, name: fName, role: 'accessory' as const, character: 'памп' as DayCharacter,
            sets: setsPerEx, repsRange: [15, 20] as [number, number], rir: 3,
            workSets: Array.from({ length: setsPerEx }, () => ({ reps: 18, rir: 3, weight: feederWeight, tempo: fTempo.notation, restSeconds: 30 })),
            exerciseName: fName, tempoSpec: fTempo.notation, restSeconds: 30,
            comment: `Auto-MEV-feeder для ${m}: ${setsPerEx}×15-20 RIR 3 @${feederWeight}кг (недельный объём ${weekSets} < MEV ${targetMEV}).`,
            warmupSets: [], rationale: 'MEV coverage: auto-feeder.',
          });
          // Второе упражнение (если need > perExCap)
          if (useTwoEx && fName2 && !s.exercises.some(e => e.name === fName2)) {
            s.exercises.push({
              muscle: m, name: fName2, role: 'accessory' as const, character: 'памп' as DayCharacter,
              sets: need - setsPerEx, repsRange: [15, 20] as [number, number], rir: 3,
              workSets: Array.from({ length: need - setsPerEx }, () => ({ reps: 18, rir: 3, weight: feederWeight, tempo: fTempo.notation, restSeconds: 30 })),
              exerciseName: fName2, tempoSpec: fTempo.notation, restSeconds: 30,
              comment: `Auto-MEV-feeder (2) для ${m}: ${need - setsPerEx}×15-20 RIR 3 @${feederWeight}кг.`,
              warmupSets: [], rationale: 'MEV coverage: auto-feeder (2-е упражнение).',
            });
          }
          break; // только один день
        }
      }
    }
    // Финальный MRV-кап после auto-feeders
    for (const w of finalPlan.weeks) normalizeWeekMrv(w.sessions, mrvByMuscle, w.phase === 'deload' || !!w.deload);
  }
  // P0-6 (audit 2026-07): feedback-driven rebuild из дневника.
  // 1) autoUpdateWeakPoints: e1RM-тренд → exit/add слабых групп
  // 2) applyFeedbackToBuild: веса/RIR/reps из факта (prescribeLoad с фактом как current)
  // 3) autoReplaceOnPlateau: e1RM flat 4+ нед → замена primary на альтернативу
  // Все три — только при наличии WorkoutSession-данных в дневнике.
  const workoutSessions = loadWorkoutSessions();
  if (workoutSessions.length > 0) {
    // 1) Auto-weakPoints update
    const weakUpdate = autoUpdateWeakPoints(weakPoints, workoutSessions, workMax);
    if (weakUpdate.changes.length > 0) {
      rationale.push(...weakUpdate.changes);
    }
    // 2) Feedback-driven rebuild (веса из факта)
    finalPlan = applyFeedbackToBuild(finalPlan, workoutSessions, workMax, input.loadStrategy || 'double_progression');
    // 3) Auto-replace на плато
    const plateauResult = autoReplaceOnPlateau(finalPlan, workoutSessions);
    if (plateauResult.changes.length > 0) {
      finalPlan = plateauResult.plan;
      rationale.push(...plateauResult.changes);
    }
    // 4) Per-muscle ACWR — per-muscle sets ratio (this-week / 4-week-avg).
    // Релевантнее общего sRPE-ACWR для ББ: одна мышца может быть перетренирована
    // при нормальном общем ACWR. Warnings → rationale.
    const perMuscleAcwr = computePerMuscleACWR(workoutSessions);
    const dangerMuscles = Object.entries(perMuscleAcwr).filter(([, v]) => v.zone === 'dangerous');
    const cautionMuscles = Object.entries(perMuscleAcwr).filter(([, v]) => v.zone === 'caution');
    if (dangerMuscles.length > 0) {
      rationale.push(`🚨 Per-muscle ACWR danger: ${dangerMuscles.map(([m, v]) => `${m}=${v.ratio}`).join(', ')} — снизить объём для этих групп.`);
    }
    if (cautionMuscles.length > 0) {
      rationale.push(`⚠ Per-muscle ACWR caution: ${cautionMuscles.map(([m, v]) => `${m}=${v.ratio}`).join(', ')} — контролировать объём.`);
    }
  }
  const volumeLandmarks = getBBVolumeLandmarks(finalPlan, level, effectiveMrvMult);
  // muscleFrequency: muscleSessionCount содержит число сессий на мышцу за ротацию (= неделя для 7-дн паттернов)
  const muscleFrequency: Record<string, number> = {};
  for (const [m, count] of Object.entries(muscleSessionCount)) {
    muscleFrequency[collapseKey(m)] = count;
  }
  // P2-1: частота мышц в rationale (ключевой фактор гипертрофии — Schoenfeld 2018).
  const freqSummary = Object.entries(muscleFrequency)
    .filter(([, f]) => f > 0)
    .map(([m, f]) => `${m}=${f}×`)
    .join(', ');
  if (freqSummary) rationale.push(`Частота на группу/нед: ${freqSummary}`);
  // Exercise cap is enforced by the shared finalizer's priority-aware
  // fatigue budget. Do not truncate the array here: raw tail deletion can
  // remove the only exercise for a muscle or a protected primary.
  const output = { ...finalPlan, level, volumeLandmarks, muscleFrequency, volumeTargets };
  syncBBPlanSetShape(output);
  const validation = validateBBPlan(output, { level });
  const validationWarnings = validation.issues
    .filter(issue => issue.level === 'warning')
    .slice(0, 20)
    .map(issue => `⚠ Валидация: ${issue.message}`);
  if (validationWarnings.length > 0) output.rationale.push(...validationWarnings);
  return finalizeBBPlan(output, {
    reorder: true,
    methodology: input.methodology,
    priorityMuscles: [...weakPoints, ...(focusGroup ? [focusGroup] : [])],
    level,
    volumeGoal: input.volumeGoal,
    phaseSafety: true,
    controlledRotation: true,
    equipment: eqList,
    excludedExercises: exclIds,
    avoidAxialLoad: avAxial,
    excludedMuscles: [...excludedMuscles],
    ensureMinimumVolume: true,
    workMax,
    mrvMultiplier: effectiveMrvMult,
    checkOrder: true,
    // Высокообъёмный предел применяется только при явно переданном стаже
    // enhanced-атлета; натуральные и legacy-вызовы сохраняют 24/10.
    maxWorkingSets: level === 'enhanced' && (input.trainingYears ?? 0) >= 3 ? 60 : 24,
    maxExercises: level === 'enhanced' && (input.trainingYears ?? 0) >= 3 ? 18 : 10,
    trainingYears: input.trainingYears,
    bodyweightCapability: input.bodyweightCapability,
  });
}

/**
 * Явный DUP-вариант генерации. Обычный buildBBPlan сохраняет прежнее
 * поведение, а undulating periodization включается только через этот API.
 */
export function buildBBPlanWithDUP(
  input: BBBuilderInput,
  dup: DUPConfig,
  pedAdapt?: PEDAdaptation,
): BBPlan {
  const plan = buildBBPlan(input, pedAdapt);
  return applyDUPOverlay(plan, dup);
}

/* ───────────────────────── Cross-Day WeakPoints Compensation ───────────────────────── */

/** Карта: слабая мышца → подходящие теги дней, куда можно вставить feeder. */
const WEAKPOINT_DAY_TAGS: Record<string, string[]> = {
  chest:        ['Push', 'Upper', 'FullBody', 'Chest'],
  back:         ['Pull', 'Upper', 'FullBody', 'Back'],
  shoulders:    ['Push', 'Pull', 'Upper', 'FullBody', 'Shoulders'],
  delt_front:   ['Push', 'Upper', 'FullBody', 'Shoulders'],
  delt_mid:     ['Push', 'Upper', 'FullBody', 'Shoulders'],
  delt_rear:    ['Pull', 'Upper', 'FullBody', 'Shoulders'],
  biceps:       ['Pull', 'Upper', 'FullBody', 'Arms'],
  triceps:      ['Push', 'Upper', 'FullBody', 'Arms'],
  forearms:     ['Pull', 'Upper', 'FullBody', 'Arms'],
  traps:        ['Pull', 'Upper', 'FullBody', 'Back'],
  quads:        ['Legs', 'Lower', 'FullBody'],
  hamstrings:   ['Legs', 'Lower', 'FullBody'],
  glutes:       ['Legs', 'Lower', 'FullBody'],
  calves:       ['Legs', 'Lower', 'FullBody'],
  abs:          ['Push', 'Pull', 'Legs', 'Upper', 'Lower', 'FullBody', 'Core'],
  core:         ['Push', 'Pull', 'Legs', 'Upper', 'Lower', 'FullBody', 'Core'],
};

/** Cross-day компенсация: если слабая мышца получает < MEV за неделю, добавляет feeder в ближайший релевантный день. */
function compensateCrossDayWeakPoints(
  plan: BBPlan,
  weakPoints: string[],
  level: string,
  workMax: Record<string, number>,
  equipment: string[],
  pedMrvMult: number,
  avAxial: boolean = false,
  phaseByWeek?: Map<number, BBPhase>,
): BBPlan {
  if (!plan.weeks || plan.weeks.length === 0) return plan;
  const weeks = plan.weeks.map((w) => ({ week: w.week, sessions: w.sessions.map((s) => ({ ...s, exercises: [...s.exercises] })) }));
  const normLvl = normLevel(level);
  const usedAcrossWeeks = new Set<string>(); // (weekIdx|sessionIdx|exName) — глобальная дедупликация по плану

  // BUG-B1: считаем объём PER-WEEK (а не за весь план).
  // Раньше: totalSets суммировал все недели → 12-нед план chest=6×12=72 >> MEV=8 → feeder НИКОГДА.
  // Теперь: для каждой недели отдельно проверяем < MEV и добавляем feeder в эту конкретную неделю.
  for (const wpRaw of weakPoints) {
    const wp = collapseKey(wpRaw);
    const lm = getVolumeLandmarks(normLvl, wp);
    if (!lm) continue;
    const targetMEV = Math.round(lm.mev * (pedMrvMult || 1));
    const allowedTags = WEAKPOINT_DAY_TAGS[wp] ?? ['Upper', 'FullBody'];

    // Идём по каждой неделе отдельно
    for (let wi = 0; wi < weeks.length; wi++) {
      // Считаем недельный объём по слабой мышце
      let weekSets = 0;
      for (const s of weeks[wi].sessions) {
        for (const ex of s.exercises) {
          if (collapseKey(ex.muscle) === wp) weekSets += ex.workSets?.length || ex.sets || 0;
        }
      }
      if (weekSets >= targetMEV) continue; // эта неделя уже достаточно нагружена

      // B2: приоритет дню, в котором мышца УЖЕ есть, но объём < MEV (добиваем до MEV).
      // Только если такого дня нет — ищем день без мышцы (cross-day compensation).
      let bestSlot: { weekIdx: number; sessionIdx: number; session: any } | null = null;
      let bestScore = -Infinity;
      // Сначала — дни С мышцей (добить до MEV)
      for (let si = 0; si < weeks[wi].sessions.length; si++) {
        const sess = weeks[wi].sessions[si];
        const tag = (sess.sessionTag || '').toLowerCase();
        if (!allowedTags.some(at => tag.includes(at.toLowerCase()))) continue;
        const hasMuscle = sess.exercises.some((e: any) => collapseKey(e.muscle) === wp);
        if (!hasMuscle) continue; // в этой итерации ищем только дни С мышцей
        const key = `${wi}|${si}|${wp}`;
        if (usedAcrossWeeks.has(key)) continue;
        const score = sess.exercises.length * 10 + (si === weeks[wi].sessions.length - 1 ? 5 : 0);
        if (score > bestScore) { bestScore = score; bestSlot = { weekIdx: wi, sessionIdx: si, session: sess }; }
      }
      // B2 fallback: если день С мышцей не найден — ищем день БЕЗ мышцы (cross-day)
      if (!bestSlot) {
        bestScore = -Infinity;
        for (let si = 0; si < weeks[wi].sessions.length; si++) {
          const sess = weeks[wi].sessions[si];
          const tag = (sess.sessionTag || '').toLowerCase();
          if (!allowedTags.some(at => tag.includes(at.toLowerCase()))) continue;
          if (sess.exercises.some((e: any) => collapseKey(e.muscle) === wp)) continue; // уже есть
          const key = `${wi}|${si}|${wp}`;
          if (usedAcrossWeeks.has(key)) continue;
          const score = sess.exercises.length * 10 + (si === weeks[wi].sessions.length - 1 ? 5 : 0);
          if (score > bestScore) { bestScore = score; bestSlot = { weekIdx: wi, sessionIdx: si, session: sess }; }
        }
      }
      if (!bestSlot) continue;

      // Выбрать feeder-упражнение: изоляция на wp, не rear-delt в push, не junk
      const feederPool = (EXERCISE_CATALOG as any[]).filter((e: any) => {
        const raw = e.group;
        const mg = collapseKey(trueMuscleOf(e) || raw);
        if (raw !== wp && mg !== wp) return false;
        if (e.exerciseType !== 'isolation' && e.type !== 'isolation') return false;
        if (isBBJunk(e)) return false;
        if (isInappropriateBB(e)) return false;
        if (equipment?.length && e.equipment && !equipment.includes(e.equipment)) return false;
        if (avAxial && isAxialLoadExercise(e as any)) return false;
        if (isRearDeltExercise(e.name) && (bestSlot.session.sessionTag || '').toLowerCase().includes('push')) return false;
        return true;
      });
      if (!feederPool.length) continue;
      // Берём самое короткое (минимизируем время) изоляционное упражнение
      feederPool.sort((a, b) => (a.name?.length || 0) - (b.name?.length || 0));
      const fData = feederPool[0];
      const fName = fData.name || fData.id;
      const fBase = (workMax as any)[wp] || DEFAULT_WORKMAX[wp] || 50;
      const feederWeight = Math.max(5, Math.round(fBase * 0.3 * 10) / 10);
  const fTempo = tempoFor('памп', undefined, phaseByWeek?.get(weeks[bestSlot.weekIdx].week) || 'accumulation');
  const feederSetCount = 2;
  bestSlot.session.exercises.push({
        muscle: wp, name: fName, role: 'accessory' as const, character: 'памп' as DayCharacter,
        sets: feederSetCount, repsRange: [15, 20] as [number, number], rir: 3,
        workSets: Array.from({ length: feederSetCount }, () => ({ reps: 18, rir: 3, weight: feederWeight, tempo: fTempo.notation, restSeconds: 30 })),
        exerciseName: fName, tempoSpec: fTempo.notation, restSeconds: 30,
        comment: `Cross-day weak-point feeder для ${wp}: 2×15-20 RIR 3 @${feederWeight}кг, добивочный памп-сет в ближайшем релевантном дне (недельный объём < MEV ${targetMEV}).`,
        warmupSets: [], rationale: 'Weak-point coverage: вставка feeder-сетов, чтобы достичь MEV.',
      });
      usedAcrossWeeks.add(`${bestSlot.weekIdx}|${bestSlot.sessionIdx}|${wp}`);
    } // for wi
  } // for wpRaw
  return { ...plan, weeks };
}

/* ──────────── Применение макроцикла к ББ-плану ──────────── */

/**
 * Применить фазы макроцикла (5 фаз: endurance/strength/peak/competition/transition)
 * к существующему BBPlan. Перераспределяет объём/интенсивность по неделям.
 *
 * Логика:
 *  - Для каждой недели плана находим макро-блок (по weekOffset+weeks).
 *  - Маппим MacroPhase → BBPhase через phase-bridge (endurance→accumulation, и т.д.).
 *  - Применяем getPhaseVolumeMult() к кол-ву сетов на упражнение.
 *  - Корректируем RIR: competition/peaking → RIR→0-1, transition/deload → +3, остальные → базовый.
 *  - Корректируем deload-флаг: transition/deload → deload=true.
 *  - Возвращаем НОВЫЙ план (immutable). Старый не трогаем.
 */
export function applyMacrocycleToBBPlan(plan: BBPlan, macro: Macrocycle | BBMacrocycle): BBPlan {
  if (!macro?.blocks || macro.blocks.length === 0 || plan.weeks.length === 0) return plan;

  const isBbMacro = 'trainingFocus' in macro;
  if (isBbMacro) {
    return applyBbMacroToBBPlan(plan, macro as BBMacrocycle);
  }

  // PL-макроцикл (Macrocycle, 5 фаз)
  const findBlockForWeek = (weekNum: number) => {
    for (const block of macro.blocks) {
      if (weekNum >= block.weekOffset && weekNum < block.weekOffset + block.weeks) return block;
    }
    return null;
  };

  const macroPhaseToBBPhase: Record<MacroPhase, BBPhase> = {
    endurance: 'accumulation',
    strength: 'intensification',
    peak: 'peaking',
    competition: 'peaking',
    transition: 'deload',
  };

  const newWeeks = plan.weeks.map((wk, wi) => {
    const weekNum = wi + 1;
    const block = findBlockForWeek(weekNum);
    if (!block) return wk;
    const bbPhase: BBPhase = macroPhaseToBBPhase[block.phase] ?? 'accumulation';
    const volMult = getPhaseVolumeMult(bbPhase);
    const isDeload = bbPhase === 'deload';
    const blockWeek = weekNum - block.weekOffset + 1;
    const periodicDeload = !isDeload
      && (block.phase === 'endurance' || block.phase === 'strength')
      && blockWeek % 4 === 0;
    const rirShift = bbPhase === 'peaking' ? -2 : bbPhase === 'deload' ? +3 : 0;
    const sessions = wk.sessions.map((ses) => ({
      ...ses,
      exercises: ses.exercises.map((ex) => {
        const effectiveVolMult = periodicDeload ? volMult * 0.6 : volMult;
        const effectiveRirShift = periodicDeload ? Math.max(rirShift, 2) : rirShift;
        const targetSets = Math.max(1, Math.round((ex.sets || 0) * effectiveVolMult));
        const newRir = Math.max(0, Math.min(5, (ex.rir ?? 2) + effectiveRirShift));
        const workSets = Array.from({ length: targetSets }, (_, i) => {
          const src = ex.workSets[i];
          if (src) {
            return { ...src, rir: Math.max(0, Math.min(5, (src.rir ?? 2) + effectiveRirShift)) };
          }
          const tpl = ex.workSets[0] ?? { reps: 8, rir: 2, weight: 0, restSeconds: 90 };
          return { ...tpl, rir: Math.max(0, Math.min(5, (tpl.rir ?? 2) + effectiveRirShift)) };
        });
        return {
          ...ex,
          sets: targetSets,
          rir: newRir,
          workSets,
        };
      }).filter((ex) => !(block.phase === 'competition' && ex.role !== 'primary')),
    }));
    return { ...wk, deload: isDeload || periodicDeload, sessions };
  });

  const phaseList = macro.blocks.map(b => `${b.phase}×${b.weeks}`).join(' → ');
  const newRationale = [...(plan.rationale ?? []), `Макроцикл применён: ${phaseList} (фазы маппированы, объём × ${getPhaseVolumeMult('accumulation')}/${getPhaseVolumeMult('intensification')}/${getPhaseVolumeMult('peaking')}/${getPhaseVolumeMult('deload')})`];

  return { ...plan, weeks: newWeeks, rationale: newRationale };
}

/**
 * BB-макроцикл → BBPlan. Применяет BB-специфичные volume mult и RIR.
 */
function applyBbMacroToBBPlan(plan: BBPlan, macro: BBMacrocycle): BBPlan {
  const BB_VOLUME = {
    hypertrophy:   { compound: 1.0,  accessory: 1.0 },
    strength:      { compound: 0.85, accessory: 0.8 },
    contest_prep:  { compound: 0.5,  accessory: 0.3 },
    transition:    { compound: 0.5,  accessory: 0.3 },
  };
  const BB_RIR = {
    hypertrophy:  { compound: [2, 3] as [number, number], accessory: [3, 4] as [number, number] },
    strength:     { compound: [1, 2] as [number, number], accessory: [2, 3] as [number, number] },
    contest_prep: { compound: [0, 1] as [number, number], accessory: [1, 2] as [number, number] },
    transition:   { compound: [3, 4] as [number, number], accessory: [4, 5] as [number, number] },
  };

  const findBlockForWeek = (weekNum: number) => {
    for (const block of macro.blocks) {
      if (weekNum >= block.weekOffset && weekNum < block.weekOffset + block.weeks) return block;
    }
    return null;
  };

  const newWeeks = plan.weeks.map((wk, wi) => {
    const weekNum = wi + 1;
    const block = findBlockForWeek(weekNum);
    if (!block) return wk;

    const volC = BB_VOLUME[block.phase].compound;
    const volA = BB_VOLUME[block.phase].accessory;
    const [compRirMin] = BB_RIR[block.phase].compound;
    const [accRirMin] = BB_RIR[block.phase].accessory;

    const isDeload = block.phase === 'transition';
    const blockWeek = weekNum - block.weekOffset + 1;
    const periodicDeload = !isDeload
      && (block.phase === 'hypertrophy' || block.phase === 'strength')
      && blockWeek % 4 === 0;

    const sessions = wk.sessions.map((ses) => ({
      ...ses,
      exercises: ses.exercises.map((ex) => {
        const isCompound = ex.role === 'primary';
        const effectiveVol = periodicDeload
          ? (isCompound ? volC * 0.6 : volA * 0.6)
          : (isCompound ? volC : volA);

        const targetSets = Math.max(1, Math.round((ex.sets || 0) * effectiveVol));
        const targetRir = Math.max(0, Math.min(5, isCompound ? compRirMin : accRirMin));

        const workSets = Array.from({ length: targetSets }, (_, i) => {
          const src = ex.workSets[i];
          if (src) return { ...src, rir: targetRir };
          const tpl = ex.workSets[0] ?? { reps: 8, rir: 2, weight: 0, restSeconds: 90 };
          return { ...tpl, rir: targetRir };
        });

        if (block.phase === 'contest_prep' && ex.role !== 'primary') return null;

        return {
          ...ex,
          sets: targetSets,
          rir: targetRir,
          workSets,
        };
      }).filter((ex): ex is BBExercise => ex !== null),
    }));

    return { ...wk, deload: isDeload || periodicDeload, sessions };
  });

  const phaseList = macro.blocks.map(b => `${b.phase}×${b.weeks}`).join(' → ');
  const newRationale = [...(plan.rationale ?? []), `BB-макроцикл применён: ${phaseList} (BB-фазы, объём × ${BB_VOLUME.hypertrophy.compound}/${BB_VOLUME.strength.compound}/${BB_VOLUME.contest_prep.compound}/${BB_VOLUME.transition.compound})`];

  return { ...plan, weeks: newWeeks, rationale: newRationale };
}
