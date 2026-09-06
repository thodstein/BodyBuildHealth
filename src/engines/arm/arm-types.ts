/**
 * arm-types.ts — канонические типы армрестлинг/армлифтинг PRO-планировщика.
 * Изолирован: не импортирует bb-builder (разрыв циклов), только shared.
 */
import type { SplitPattern } from '../bb/bb-split-patterns';
import type { VolumeLandmarkRow } from '../volume-landmarks.engine';

export type ArmDiscipline = 'armwrestling' | 'armlifting' | 'hybrid';
export type ArmTechnique = 'hook' | 'toproll' | 'press' | 'balanced';
export type ArmGripType = 'support' | 'pinch' | 'crush' | 'hub';
export type ArmImplement =
  | 'rolling_thunder'
  | 'apollon_axle'
  | 'saxon_bar'
  | 'hub'
  | 'pinch_block'
  | 'coc_bullet'
  | 'farmer_handles'
  | 'fat_gripz'
  | 'none';

export type ArmGoal = 'strength' | 'peaking' | 'hypertrophy' | 'endurance' | 'maintenance';
export type ArmGoalBB = ArmGoal; // alias для совместимости
export type ArmPhase = 'accumulation' | 'intensification' | 'deload' | 'peaking';
export type ArmLevel = 'beginner' | 'intermediate' | 'advanced' | 'enhanced';
export type ArmDayCharacter = 'тяж' | 'памп' | 'техника' | 'лёг';

export type ArmMuscle =
  | 'wrist_flexors'
  | 'wrist_extensors'
  | 'pronators'
  | 'supinators'
  | 'risers'
  | 'ulnar_deviators'
  | 'radial_deviators'
  | 'brachialis'
  | 'biceps_long'
  | 'biceps_short'
  | 'brachioradialis'
  | 'back_pressure'
  | 'side_pressure'
  | 'grip_support'
  | 'grip_pinch'
  | 'grip_crush'
  | 'thumb'
  | 'shoulder_stab'
  | 'core_anchor';

export const ARM_MUSCLES: readonly ArmMuscle[] = [
  'wrist_flexors','wrist_extensors','pronators','supinators','risers',
  'ulnar_deviators','radial_deviators','brachialis','biceps_long','biceps_short',
  'brachioradialis','back_pressure','side_pressure','grip_support','grip_pinch',
  'grip_crush','thumb','shoulder_stab','core_anchor',
] as const;

export function isArmMuscle(v: string): v is ArmMuscle {
  return (ARM_MUSCLES as readonly string[]).includes(v);
}

export type ArmWorkingDirection = 'to_little' | 'to_middle' | 'to_thumb';
export interface ArmWorkingAngle {
  elbowDeg: 90 | 110 | 120;
  wrist: 'flexed' | 'neutral' | 'extended';
  forearm: 'pronated' | 'supinated' | 'neutral';
  direction: ArmWorkingDirection;
}

export interface ArmBuilderInput {
  discipline: ArmDiscipline;
  patternId: string;
  level: string;
  goal: ArmGoal;
  technique: ArmTechnique;
  weeks: number;
  daysPerWeek?: number;
  gripFocus?: ArmGripType;
  gripImplement?: ArmImplement;
  workMax?: Record<string, number>;
  weakPoints?: string[];
  focusGroup?: string;
  specialization?: boolean;
  specializationSchedule?: ArmSpecializationBlock[];
  tableTimeRatio?: number;
  equipment?: string[];
  injuries?: ArmInjury[];
  mobilityRestrictions?: string[];
  favoriteExercises?: string[];
  excludedExercises?: string[];
  planStartWeek?: string;
  sex?: 'male' | 'female';
  weightClass?: string;
  bodyFat?: number;
  leanMass?: number;
  hrvMs?: number;
  sleepHours?: number;
  stressLevel?: number;
  labMrvMultiplier?: number;
  labWarnings?: string[];
  pedDoses?: Record<string, number>;
  courseIntensity?: 'mild' | 'moderate' | 'heavy';
  calorieSurplus?: number;
  proteinPerKg?: number;
  previousPlan?: ArmPlan;
  enableHumerusGuard?: boolean;
  // ── PRO A–J (все опциональны, движок обратно совместим) ──
  ageYears?: number;
  bodyWeightKg?: number;
  arm?: 'left' | 'right' | 'both';
  dominantArm?: 'left' | 'right';
  leftKg?: number; // сила левой (RT/прон/cup — одна метрика)
  rightKg?: number; // сила правой
  paraClass?: string; // WAF para: none|PID|PIU|PIDH|PIUH|VI|HI|CPD|CPU
  competitionDateIso?: string; // дата старта → тейпер/весогонка/фаза
  targetWeightKg?: number; // целевой вес (потолок категории)
  supermatch?: boolean; // режим best-of-5/6 (эпик C)
  sparring?: { intensityPct?: 70 | 90 | 100; partnerDeltaKg?: number; sessionsThisWeek?: number };
  strapExpected?: boolean; // ожидается судейский ремень
  diary?: Array<{ dateIso: string; srpe?: number; elbowPain?: number; wristPain?: number; velocityLossPct?: number | null }>;
  trackCsv?: string; // Kinovea-трекинг кисти (эпик I)
  bench?: { wristCurlLb?: number; pronHoldSec?: number; cupHoldSec?: number; cocLevel?: number; rtKg?: number; sideKg?: number };
  // ── TOP T1–T8 (все опциональны, движок обратно совместим) ──
  oppStyle?: string; // стиль оппонента: hook/toproll/press/balanced/unknown
  oppHand?: string; // рука оппонента: high/low/neutral/unknown
  weightDeltaKg?: number; // + = оппонент тяжелее
  rfd?: boolean; // RFD speed-блок в intensification
  explosivePct?: number; // F100/Fmax % (из динамики)
  fastPct?: number; // F500/Fmax %
  slowIndex?: number; // медленная сила кг/с
  gripWeek?: number; // неделя grip-RPE мезоцикла
  gripPhase?: string; // volume/intensification/peak/deload
  gripAuto?: boolean; // авто-волна: объём→интенс→делоад по неделям плана
  ladderFrom?: string; // текущий имплемент лестницы
  ladderValue?: number; // текущий результат (кг/с)
  contestSim?: boolean; // contest-sim неделя вместо техники
  foulIds?: string[]; // история фолов для sim-фокуса
  tableSession?: boolean; // сегодня стол → tendon-fuel тайминг
  tendonFuel?: boolean; // явно включить tendon-fuel строку
  cnsCheck?: boolean; // явно проверить CNS-guard
  heavyGripThisWeek?: number;
  plannedHeavy?: boolean;
  hoursSinceHeavyPull?: number;
  bouts?: Array<{ fouls?: number; slip?: boolean; strap?: boolean; centerHoldSec?: number; win?: boolean; finishSec?: number }>; // Table-IQ журнал
  calStartIso?: string; // календарь: дата старта (дубль competitionDateIso для явности)
  calPriority?: string; // A/B/C
  calSeries?: string; // waf_worlds/east_vs_west/super_series/local
  // ── CYCLES (интернет-библиотека, все опциональны, дефолт = как раньше) ──
  cycleId?: string; // strengthlog_8 | tableready_12 | toproll_6 | src_toproll_12 | kuznica_6_8 | dobrorezov_44 | grinder_hybrid_12 | coc_8 | coc_12 | for_7 | brzenk_1_1 | larratt_table_bloodflow
  cycleConsent?: boolean; // согласие на extend/shrink (fit proposed_*)
  correctionPct?: number; // %/нед прогрессии весов (СРЦ-дефолт 0.5)
  cocWorking?: string; // текущий CoC-уровень (guide..no4) для лестницы
  flatPyramid?: boolean; // Bompa flat pyramid 3→5→7×5 для лифтов хвата
  flatPyramidWeightKg?: number; // стартовый вес пирамиды
  bloodflow?: boolean; // Larratt bloodflow-слой (вне MRV)
  pumpkinArm?: 'left' | 'right'; // Larratt pumpkin-рука
  neverFail?: boolean; // Larratt/школа: RIR≥1, без PR в цикле
  heavySingles?: boolean; // Larratt 17–18 heavy singles
  brzenkMode?: boolean; // Brzenk 1+1 минимализм
  akimovHook?: boolean; // Акимов-блок крюка (Скотт + лямка + резина)
  compPeriod?: boolean; // для Акимова: true — соревновательный
  medleyId?: string; // worlds_2026 | arnold_2026 | super_series_2026 | rt_saxon_hub
  medleyAttempts?: Array<{ eventIdx: number; weightKg: number; success: boolean }>; // факт попыток → сводка simulateMedley
  forMode?: boolean; // FOR-7 overreach (гейт advanced/enhanced)
  forSpecialization?: 'crush' | 'support' | 'pinch' | 'open' | 'wrist';
  axisCheck?: { trunkRotatedTowardAttack?: boolean; wristBehindShoulder?: boolean; wristExtendedDorsally?: boolean; coldNoWarmup?: boolean; fightingFromDefense?: boolean; sideMaxAttempt?: boolean }; // humerus-axis 2026
}

export interface ArmInjury {
  muscle: string;
  from?: string;
  to?: string;
  exclude?: boolean;
  volumePct?: number;
  weightPct?: number;
  repsCap?: number;
}

export interface ArmSpecializationBlock {
  id: string;
  weekStart: number;
  weekEnd: number;
  targets: string[];
  tradeoff?: ArmTradeoffPolicy;
}

export interface ArmTradeoffPolicy {
  mode: 'none' | 'reduce_direct_to_floor' | 'remove_direct_when_indirect_covers_floor';
  donorMuscles: string[];
  preserveIndirect?: boolean;
}

export interface ArmSpecializationSchedule {
  blocks: ArmSpecializationBlock[];
  rationale: string;
  active: boolean;
}

export interface ArmSet {
  reps: number | 'AMRAP';
  rir: number;
  weight: number;
  holdSeconds?: number;
  tempo?: string;
  restSeconds?: number;
  technique?: 'isometric' | 'static_endurance' | 'stress_single' | 'none';
}

export interface ArmExercise {
  muscle: ArmMuscle | string;
  name: string;
  role: 'primary' | 'accessory';
  character: ArmDayCharacter;
  sets: number;
  repsRange: [number, number];
  rir: number;
  workSets: ArmSet[];
  workingAngle?: ArmWorkingAngle;
  isTable?: boolean;
  isStatic?: boolean;
  holdSeconds?: number;
  tempoSpec?: string;
  restSeconds?: number;
  comment?: string;
  rationale?: string;
  movementPattern?: string;
  substitutionGroup?: string;
  warmupSets?: { load: number; reps: number }[];
  supersetWith?: string;
  supersetGroup?: number;
  supersetSlot?: 0 | 1;
  exerciseId?: string;
  equipment?: string;
}

export interface ArmSession {
  day: number;
  weekOffset: number;
  character: ArmDayCharacter;
  sessionTag: string;
  tableTime?: boolean;
  tableRatio?: number;
  exercises: ArmExercise[];
  note?: string;
}

export interface ArmWeek {
  week: number;
  phase: ArmPhase;
  deload?: boolean;
  taper?: boolean;
  tableRatio?: number;
  sessions: ArmSession[];
  note?: string;
}

export interface ArmPlan {
  pattern: SplitPattern;
  weeks: ArmWeek[];
  rotationMuscleVolume: Record<string, number>;
  rationale: string[];
  level?: string;
  discipline?: ArmDiscipline;
  technique?: ArmTechnique;
  goal?: ArmGoal;
  volumeLandmarks?: VolumeLandmarkRow[];
  muscleFrequency?: Record<string, number>;
  volumeTargets?: Record<string, any>;
  weeklyVolume?: Record<number, Record<string, { directSets: number; effectiveSets: number; tendonSets: number; fatigueWeightedSets: number }>>;
  validation?: ArmValidationResult;
  report?: ArmReport;
  metrics?: ArmMetrics;
  inputSnapshot?: Partial<ArmBuilderInput>;
  specializationSchedule?: ArmSpecializationSchedule;
  mrvByMuscle?: Record<string, number>;
  safetyWarnings?: string[];
}

export interface ArmValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  mrvOverflow?: Array<{ muscle: string; sets: number; mrv: number }>;
  humerusWarnings?: string[];
  balanceWarnings?: string[];
  tendonWarnings?: string[];
}

export interface ArmReport {
  summary: string;
  phaseRationale: string[];
  volumeSummary: string[];
  techniqueRationale?: string[];
  gripRationale?: string[];
  warnings: string[];
}

export interface ArmMetrics {
  totalSetsPerWeek: Record<number, number>;
  avgIntensity: number;
  tableTimePct: number;
  tendonLoad: number;
  sidePressureLoad: number;
}

export interface ArmVolumeTarget {
  muscle: string;
  frequency: number;
  mev: number;
  mav: number;
  mrv: number;
  targetSets: number;
  minSetsPerSession: number;
  maxSetsPerSession: number;
  rationale: string;
}

export const ARM_TECHNIQUE_LABEL: Record<ArmTechnique, string> = {
  hook: 'Хук (inside)',
  toproll: 'Топролл (outside)',
  press: 'Пресс (press)',
  balanced: 'Сбалансировано',
};

export const ARM_DISCIPLINE_LABEL: Record<ArmDiscipline, string> = {
  armwrestling: 'Армрестлинг',
  armlifting: 'Армлифтинг',
  hybrid: 'Гибрид',
};

export const ARM_GOAL_LABEL: Record<ArmGoal, string> = {
  strength: 'Сила',
  peaking: 'Пик к старту',
  hypertrophy: 'Масса предплечья',
  endurance: 'Выносливость (supermatch)',
  maintenance: 'Поддержание',
};

export const ARM_MUSCLE_RU: Record<string, string> = {
  wrist_flexors: 'Сгибатели кисти (cup)',
  wrist_extensors: 'Разгибатели кисти',
  pronators: 'Пронаторы',
  supinators: 'Супинаторы',
  risers: 'Разгибатели пальцев (rising)',
  ulnar_deviators: 'Локтевые девиаторы',
  radial_deviators: 'Лучевые девиаторы',
  brachialis: 'Брахиалис',
  biceps_long: 'Бицепс (длинная)',
  biceps_short: 'Бицепс (короткая)',
  brachioradialis: 'Брахиорадиалис',
  back_pressure: 'Тяга на себя (back pressure)',
  side_pressure: 'Боковое давление',
  grip_support: 'Хват — поддержка',
  grip_pinch: 'Хват — щипок',
  grip_crush: 'Хват — дробление',
  thumb: 'Большой палец',
  shoulder_stab: 'Стабилизаторы плеча',
  core_anchor: 'Кор / якорь',
};
