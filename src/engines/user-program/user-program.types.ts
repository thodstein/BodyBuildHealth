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
export type IntensityTechnique = 'rest_pause' | 'drop_set' | 'myo_reps' | 'pause_rep' | 'mechanical_drop' | 'none';

/** Роль блока в сессии. compound/accessory/isolation/finisher — ББ; power_* — ПЛ-вкладка в гибриде. */
export type BlockType = 'compound' | 'accessory' | 'isolation' | 'finisher' | 'power_main' | 'power_accessory';

export type MuscleRole = 'primary' | 'accessory';

/* ───────────────────────── Подход / Блок / Сессия ───────────────────────── */

export interface UserSet {
  reps: number | string;   // число или 'AMRAP'
  rir: number;            // repetitions in reserve (0-5)
  weight?: number;        // кг (рабочий вес); для ПЛ может быть не задан → считается из %1RM
  pctOf1RM?: number;      // ПЛ-стиль: доля от предельного максимума (0.68 = 68%)
  technique?: IntensityTechnique;
  tempo?: string;         // нотация темпа "3-1-1-0"
  restSec?: number;
  note?: string;
}

export interface UserBlock {
  id: string;
  type: BlockType;
  exerciseName: string;
  muscle: string;          // первичная мышечная группа
  role: MuscleRole;
  sets: UserSet[];
  /** id блока-партнёра для суперсета/антагониста/pre-exhaust (скобка объединения). */
  supersetWith?: string;
  /** Обоснование выбора (почему это упражнение) — прозрачность для пользователя. */
  rationale?: string;
  note?: string;
}

export interface UserSession {
  id: string;
  name: string;           // "День 1: Грудь / Трицепс"
  /** 0-6 — день недели (необязательная привязка к календарю). */
  dayOfWeek?: number;
  focus: string;          // "Upper" / "Push" / список мышц
  blocks: UserBlock[];
  warmup?: string;
  cooldown?: string;
  estimatedMin?: number;
}

export interface UserWeek {
  week: number;           // 1-based
  phase: Phase;
  deload: boolean;
  /** Сессии недели. Пустой массив → рендерится из microcycleTemplate (скелет сплита). */
  sessions: UserSession[];
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

/** ББ-тело: полностью редактируемая структура. */
export interface BBProgramBody {
  direction: 'bb';
  microcycleTemplate: MicrocycleTemplate;
  weeks: UserWeek[];
  volumeBudget: VolumeBudget;
  progression: ProgramProgression;
  constraints: ProgramConstraints;
}

/** ПЛ-тело: ссылка на иммутабельный LMS-цикл + пользовательский оверлей. */
export interface PLProgramBody {
  direction: 'pl';
  /** id иммутабельного цикла из src/data/lms-cycles. Процентки НЕ мутируются. */
  sourceCycleId: string;
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
}

/** Hybrid-тело (powerbuilder) — зарезервировано для следующих итераций. */
export interface HybridProgramBody {
  direction: 'hybrid';
  plRef: { sourceCycleId: string; sessionIndices: number[] };
  bbWeeks: UserWeek[];
  notes: string;
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
}

export interface UserProgram {
  meta: ProgramMeta;
  bb?: BBProgramBody;
  pl?: PLProgramBody;
  hybrid?: HybridProgramBody;
}

/* ───────────────────────── Утилиты id ───────────────────────── */

export function newId(prefix: string): string {
  return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

/* Конвертация источников → UserProgram реализована в program-store.ts. */
export type { FullProgram, SRCycleTemplate, BBPlan };
