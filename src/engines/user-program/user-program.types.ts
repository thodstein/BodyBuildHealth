/**
 * user-program.types.ts — каноническая модель «Программа пользователя».
 *
 * Единый источник истины для зоны «Планировщик»: создание с нуля, загрузка своей,
 * клонирование из библиотеки/цикла, редактирование. Заменяет собой зоопарк форматов
 * (FullProgram / SRCycleTemplate / SavedBBPlan / ManualResult) на уровне UI-слоя.
 *
 * ПРИНЦИПЫ:
 *  - ПЛ-циклы (LMS, src/data/lms-cycles) — IMMUTABLE, разработаны профессионалами.
 *    UserProgram с direction='pl' лишь СОСЛАЕТСЯ на цикл (sourceCycleId) и хранит
 *    пользовательский оверлей (расписание, заметки, weak points, рабочие максимумы).
 *    Процентки/сеты/повторения цикла НЕ копируются и НЕ мутируются.
 *  - ББ-программы — полностью редактируемые (weeks → sessions → blocks → sets).
 *  - Hybrid (powerbuilder) — зарезервирован, реализуется на следующих итерациях.
 *
 * Структура ББ-программы следует профессиональной иерархии:
 *   Макроцикл (фазы по неделям) → Мезоцикл (недели) → Микроцикл (сессии)
 *     → Сессия (блоки) → Блок (упражнение + схема подходов) → Подход (вес/повт/RIR/темп).
 */
import type { FullProgram } from '../complete-program-library.engine';
import type { SRCycleTemplate } from '../../data/lms-cycles/lms-types';
import type { BBPlan } from '../bb/bb-builder.engine';

/* ───────────────────────── Общие типы ───────────────────────── */

export type ProgramDirection = 'bb' | 'pl' | 'hybrid';
export type ProgramSource = 'custom' | 'cloned_library' | 'cloned_cycle' | 'from_build';

/** Фаза периодизации (зеркалирует BBPhase из phase-periodization, без UI-зависимости). */
export type Phase = 'accumulation' | 'intensification' | 'deload' | 'peaking';

/** Стратегия прогрессии (зеркалирует LoadStrategy из bb-autocoach). */
export type LoadStrategy = 'double_progression' | 'linear' | 'wave' | 'rpe_based';

/** Тип разгрузки (зеркалирует DeloadType из bb-autocoach + 'mini' для микро-делоада). */
export type DeloadProtocol = 'pump' | 'neural' | 'full_rest' | 'mini';

/** Интенсив-техника (зеркалирует IntensityTechnique из bb-autocoach). */
export type IntensityTechnique = 'rest_pause' | 'drop_set' | 'myo_reps' | 'pause_rep' | 'mechanical_drop' | 'negative' | 'twenty_ones' | 'none';

/** Роль блока в сессии. compound/accessory/isolation/finisher — ББ; power_* — ПЛ-вкладка в гибриде. */
export type BlockType = 'compound' | 'accessory' | 'isolation' | 'finisher' | 'power_main' | 'power_accessory';

export type MuscleRole = 'primary' | 'accessory';

/** Канонические мышцы ББ (совместимо с TAG_MUSCLES + гранулярные). Свободная строка сохранена для legacy, но новый код должен использовать BBMuscle. */
export type BBMuscle =
  | 'chest' | 'chest_upper' | 'chest_lower'
  | 'back' | 'back_width' | 'back_thickness'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves'
  | 'shoulders' | 'delt_front' | 'delt_mid' | 'delt_rear'
  | 'biceps' | 'triceps' | 'forearms' | 'traps' | 'abs' | 'lower_back' | 'core' | 'other';

export const BB_MUSCLES: readonly BBMuscle[] = [
  'chest','chest_upper','chest_lower','back','back_width','back_thickness',
  'quads','hamstrings','glutes','calves','shoulders','delt_front','delt_mid','delt_rear',
  'biceps','triceps','forearms','traps','abs','lower_back','core','other',
] as const;

export function isBBMuscle(v: string): v is BBMuscle {
  return (BB_MUSCLES as readonly string[]).includes(v);
}

/** Режим задания нагрузки в подходе. */
export type WeightMode = 'kg' | 'pct' | 'rpe' | 'velocity';

/** Длина микроцикла в днях (5-9 для cycle-based, 7 = недельный). */
export type CycleLength = 5 | 6 | 7 | 8 | 9;

/* ───────────────────────── Подход / Блок / Сессия ───────────────────────── */

export interface UserSet {
  reps: number | string;   // число или 'AMRAP'
  rir: number;            // repetitions in reserve (0-5)
  weight?: number;        // кг (рабочий вес); для ПЛ может быть не задан → считается из %1RM
  pctOf1RM?: number;      // ПЛ-стиль: доля от предельного максимума (0.68 = 68%)
  weightMode?: WeightMode; // как задан вес: кг / % / RPE / velocity
  velocityMs?: number;    // VBT скорость штанги м/с (опционально, для авто-веса)
  technique?: IntensityTechnique;
  /** Мульти-выбор техник - можно комбинировать несколько */
  techniques?: IntensityTechnique[];
  tempo?: string;         // нотация темпа "3-1-1-0"
  restSec?: number;
  note?: string;
  // Динамические поля для техник
  dropWeight?: number;    // вес дропа (кг) для drop_set
  dropReps?: number;      // повторения дропа для drop_set
  miniReps?: number;      // мини-повторения для myo_reps
  miniRestSec?: number;   // мини-отдых (сек) для myo_reps
  pauseSec?: number;      // пауза (сек) для pause_rep
  /** First-class set types (Colossus): amrap / emom / cluster / dropset-steps — хранятся как technique + note, но флаг для экспорта/логгера. */
  setKind?: 'normal' | 'amrap' | 'emom' | 'cluster' | 'dropset' | 'myo';
}

export interface UserBlock {
  id: string;
  type: BlockType;
  exerciseName: string;
  muscle: string;          // первичная мышечная группа (BBMuscle, legacy — свободная строка)
  role: MuscleRole;
  sets: UserSet[];
  /** id блока-партнёра для суперсета/антагониста/pre-exhaust (скобка объединения). */
  supersetWith?: string;
  /** Валидация суперсета: не допускать цикл A→B→A — проверяется в program-store validate. */
  supersetKind?: 'superset' | 'giant' | 'pre_exhaust' | 'post_exhaust';
  /** Обоснование выбора (почему это упражнение) — прозрачность для пользователя. */
  rationale?: string;
  note?: string;
  /** Характер упражнения (из BBPlan.character): 'тяж' | 'памп' | 'лёг' — дневник использует для раздела тяжёлых/лёгких подходов. */
  character?: 'тяж' | 'памп' | 'лёг';
  /** Диапазон повторений [min, max] (из BBPlan.repsRange) — для прогрессий 5/3/1 и пр. */
  repsRange?: [number, number];
  /** PRO-темп (из BBPlan.tempoSpec) — нотация "2-1-1-0". Также может жить в sets[].tempo. */
  tempoSpec?: string;
  /** Схема разминки compounds (из BBPlan.warmupSets). Пирамида bar×15→50%×10→70%×5→80%×3 как в BB-builder. */
  warmupSets?: { load: number; reps: number }[];
  /** Тренерский комментарий из BBPlan.comment (роль/слабые/фаза/нагрузка/⚠ Замена/⭐ Фокус). */
  comment?: string;
  /** Угол/паттерн для multi-angle покрытия (ANGLE_CLASSES). */
  angleClass?: string;
  /** Длина мышцы в упражнении (lengthened bias). */
  isLengthened?: boolean;
}

export interface UserSession {
  id: string;
  name: string;           // "День 1: Грудь / Трицепс"
  /** 0-6 — день недели (необязательная привязка к календарю). Для cycleLength 5-9 раскладывается по календарю независимо от недели. */
  dayOfWeek?: number;
  /** Переопределение фазы на уровне сессии (DUP внутри недели: тяж/лёг/памп). Если задано — переопределяет UserWeek.phase для этой сессии. */
  phaseOverride?: Phase;
  /** Характер сессии для DUP: 'тяж' | 'памп' | 'лёг' | null (вычисляется из phaseOverride/RIR). */
  character?: 'тяж' | 'памп' | 'лёг' | null;
  focus: string;          // "Upper" / "Push" / список мышц
  blocks: UserBlock[];
  warmup?: string;
  cooldown?: string;
  estimatedMin?: number;
  /** Заметка к тренировке (для тренера, отображается в редакторе/экспорте/PDF). */
  note?: string;
}

export interface UserWeek {
  week: number;           // 1-based
  phase: Phase;
  deload: boolean;
  /** Сессии недели. Пустой массив → рендерится из microcycleTemplate (скелет сплита). */
  sessions: UserSession[];
  /** Заметка к неделе (для тренера, отображается в редакторе/экспорте/PDF). */
  note?: string;
}

/* ───────────────────────── Бюджет объёма по мышцам ───────────────────────── */

export interface VolumeBudgetEntry {
  muscle: string;
  mev: number;            // минимальный эффективный объём, сетов/нед
  mav: number;            // максимальный адаптивный объём
  mrv: number;            // максимальный восстанавливаемый объём
  target: number;         // целевой объём (что планирует пользователь)
}

export type VolumeBudget = Record<string, VolumeBudgetEntry>;

/* ───────────────────────── Ограничения и прогрессия ───────────────────────── */

export interface ProgramConstraints {
  equipment: string[];
  injuries?: { muscle: string; grade: string }[];
  avoidAxialLoad?: boolean;
  favoriteExercises?: string[];
  excludedExercises?: string[];
}

export interface ProgramProgression {
  loadStrategy: LoadStrategy;
  deloadProtocol: DeloadProtocol;
  intensityTechniques: IntensityTechnique[];
}

/* ───────────────────────── Тело программы (по направлению) ───────────────────────── */

/** Скелет сплита: какие мышцы в какой день микроцикла, с ролью. */
export interface MicrocycleTemplate {
  daySlots: {
    day: number;          // 1-based
    label: string;        // "Upper" / "Push" / "День 1"
    muscles: { muscle: string; role: MuscleRole }[];
  }[];
}

/* ───────────────────────── Валидация программы (P2.8) ───────────────────────── */
export interface ValidationIssue {
  level: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  /** Недельный объём по мышце, если проблема связана с объёмом. */
  muscle?: string;
  week?: number;
}

/** ББ-тело: полностью редактируемая структура. */
export interface BBProgramBody {
  direction: 'bb';
  microcycleTemplate: MicrocycleTemplate;
  weeks: UserWeek[];
  volumeBudget: VolumeBudget;
  progression: ProgramProgression;
  constraints: ProgramConstraints;
  /** Final BB-auto snapshot retained across import/save round-trips. */
  derived?: {
    volumeTargets?: Record<string, unknown>;
    weeklyVolume?: Record<number, unknown>;
    fatigueReport?: unknown[];
    rotationReport?: unknown;
    report?: unknown;
    balanceReport?: unknown;
    validation?: unknown;
  };
}

/** ПЛ-тело: ссылка на иммутабельный LMS-цикл + пользовательский оверлей.
 *  При sourceCycleId=null — полностью свой (custom) ПЛ-цикл с editable customWeeks. */
export interface PLProgramBody {
  direction: 'pl';
  /** id иммутабельного цикла из src/data/lms-cycles. null = custom/empty PL cycle. */
  sourceCycleId: string | null;
  /** ISO-дата начала (необязательно). */
  startDate?: string;
  /** Расписание: сессия цикла (по индексу) → день недели (0-6). */
  schedule: { sessionIdx: number; dayOfWeek: number }[];
  /** Слабые группы пользователя (приоритет акцента, не меняет цикл). */
  weakPoints: string[];
  /** Заметки пользователя к циклу. */
  notes: string;
  /** Рабочие максимумы для расчёта весов из % цикла. */
  workMax: { squat?: number; bench?: number; dead?: number };
  /** Текущая неделя исходного цикла для просмотра/выполнения. */
  activeWeek?: number;
  /** Custom PL: когда sourceCycleId===null, weeks содержит редактируемую структуру. */
  customWeeks?: PLWeek[];
}

export interface PLDay {
  name: string;
  /** Calendar day for custom PL sessions (0 = Monday). */
  dayOfWeek?: number;
  exercises: PLExercise[];
}
export interface PLExercise {
  name: string;
  lift: 'squat' | 'bench' | 'dead' | 'accessory';
  muscle?: string;
  sets: PLSet[];
  note?: string;
}
export interface PLSet {
  pct: number;
  reps: number;
  sets: number;
  rir?: number;
}
export interface PLWeek {
  week: number;
  phase: 'accumulation' | 'intensification' | 'deload' | 'peaking';
  deload: boolean;
  days: PLDay[];
}

/** Hybrid-тело (powerbuilder) — зарезервировано для следующих итераций. */
export interface HybridProgramBody {
  direction: 'hybrid';
  plRef: { sourceCycleId: string; sessionIndices: number[] };
  bbWeeks: UserWeek[];
  notes: string;
  /** Рабочие максимумы для расчёта весов (из hybridPlanPanel). */
  workMax?: { squat?: number; bench?: number; deadlift?: number };
  /** Уровень спортсмена (отдельный от meta.level, чтобы не пересоздавать meta при правке). */
  level?: string;
  /** Длина цикла в неделях (override на meta.weeks). */
  weeksOverride?: number;
}

/* ───────────────────────── Мета и канонический тип ───────────────────────── */

export interface ProgramMeta {
  id: string;
  title: string;
  author: string;
  goal: string;
  level: string;
  daysPerWeek: number;
  weeks: number;
  direction: ProgramDirection;
  createdAt: string;
  updatedAt: string;
  source: ProgramSource;
  /** id источника при клонировании (программа библиотеки / цикл). */
  parentId?: string;
  tags?: string[];
  /** Журнал правок (дешёвая версия без полных снапшотов). */
  revisions?: { ts: string; note: string }[];
  /** Тренерские заметки к мезоциклу (отображаются в PDF/CSV). */
  notes?: string;
  /** Training focus (Schoenfeld 2021, Roberts 2022): 'strength' | 'hypertrophy' | 'endurance'. */
  trainingFocus?: 'strength' | 'hypertrophy' | 'endurance';
  /** Связь с дизайном периодизации (периодизационный дизайнер): id + имя + хэш содержимого.
   *  Хэш меняется при правке дизайна — по нему UI определяет «дизайн изменён» (stale). */
  designRef?: { id: string; name: string; hash: string };
  /** Длина микроцикла в днях (5-9 для cycle-based, 7 = недельный). По умолчанию 7. */
  cycleLength?: CycleLength;
  /** Специализация (1-2 целевые мышцы) — для tradeoff. */
  specialization?: string[];
  /** Дозировки PED для учёта MRV (если enhanced). */
  pedDoses?: { substance: string; dose: number }[];
  /** Идентификатор версии движка (для миграций). */
  engineVersion?: string;
}

export interface UserProgram {
  meta: ProgramMeta;
  bb?: BBProgramBody;
  pl?: PLProgramBody;
  hybrid?: HybridProgramBody;
}

/* ───────────────────────── Утилиты id ───────────────────────── */

export function newId(prefix: string): string {
  const now = Date.now();
  newId._counter = (newId._counter ?? 0) + 1;
  return prefix + '_' + now.toString(36) + '_' + newId._counter.toString(36) + '_' + Math.random().toString(36).slice(2, 6);
}
newId._counter = 0 as number;

/* Конвертация источников → UserProgram реализована в program-store.ts. */
export type { FullProgram, SRCycleTemplate, BBPlan };
