/**
 * annual-training.types.ts — модель «годового плана, собранного по конструкторам».
 *
 * Годовой планировщик отвечает за КАЛЕНДАРЬ и КОМПОЗИЦИЮ, а не за генерацию
 * тренировок. Каждый макро-блок (недели года) имеет тип конструктора:
 *   - 'PL'     — блок собирается ПЛ-конструктором (СРЦ-цикл из lms-cycle-index);
 *   - 'BB'     — блок собирается ББ-конструктором (buildBBPlan/autodraftBBPlan);
 *   - 'MANUAL' — блок вручную (скелет фаз, пользователь наполняет сам).
 *
 * Сборка блока даёт результат (недели/программа/предупреждения), который
 * кэшируется в AnnualBlockState. Изменение макро-разметки помечает блок 'stale',
 * но НЕ перезаписывает собранный результат — пользователь решает, пересобирать ли.
 */
import type { UserWeek, UserProgram } from '../user-program/user-program.types';

/** Тип конструктора блока годового плана. */
export type AnnualBlockKind = 'PL' | 'BB' | 'ARM' | 'MANUAL';

/** Статус сборки блока. */
export type MacroBlockBuildStatus = 'unbuilt' | 'built' | 'stale' | 'error';

/** Направление годового плана (производное от типов блоков). */
export type AnnualPlanDirection = 'pl' | 'bb' | 'arm' | 'hybrid' | 'mixed';

/** Ссылка на макро-блок раскладки (MacroBlock | BBMacroBlock). */
export interface AnnualBlockRef {
  /** Стабильный ключ блока: hash от (index, phase, weekOffset, weeks, cycleId). */
  blockKey: string;
  /** Индекс блока в macro.blocks на момент синхронизации. */
  blockIndex: number;
  /** Тип конструктора блока. */
  kind: AnnualBlockKind;
  /** Фаза макроцикла (MacroPhase | BBMacroPhase). */
  phase: string;
  /** Стартовая неделя блока в макро (1-индекс). */
  startWeek: number;
  /** Длина блока в неделях. */
  weeks: number;
  /** id соревнования (если блок привязан к старту). */
  competitionId?: string;
  /** id СРЦ-цикла (для PL-блоков ПЛ-макроцикла). */
  cycleId?: string;
  /** Человекочитаемое описание блока. */
  description?: string;
  /** WAF весовая категория (ARM) — влияет на sideRef, configHash. */
  weightClass?: string;
}

/** Пользовательская конфигурация сборки блока (выбранный цикл/сплит/taper/peak). */
export interface AnnualBlockConfig {
  /** PL: id СРЦ-цикла (переопределяет ref.cycleId). */
  cycleId?: string;
  /** BB/MANUAL: дней тренировок в неделю. */
  daysPerWeek?: number;
  /** BB: id сплита из SPLIT_PATTERNS. */
  splitPattern?: string;
  /** BB: цель (hypertrophy/mass/strength/cut/recomp...). */
  goal?: string;
  /** BB: уровень атлета. */
  level?: string;
  /** BB: training focus (strength/hypertrophy/endurance). */
  trainingFocus?: string;
  /** BB: слабые группы. */
  weakPoints?: string[];
  /** BB: оборудование. */
  equipment?: string[];
  /** BB: группа специализации. */
  focusGroup?: string;
  /** BB: режим специализации (слабые на MAV+10%). */
  specialization?: boolean;
  /** BB contest_prep-блок: собрать через Prep-цикл (акценты/минимум/тапер к дате).
   *  При задании — buildBBBlock использует buildPrepCycle вместо generic autodraft. */
  prep?: {
    /** Категория соревнования (id BBContestCategory). */
    category: string;
    /** Дата шоу (ISO yyyy-mm-dd) — якорь тапера/пик-недели. */
    showDate: string;
    /** Мышцы с акцентом (1-2). */
    accentMuscles?: string[];
    /** Мышцы на минимальную нагрузку. */
    minimalMuscles?: string[];
    /** Режим минимальной нагрузки (PrepMinimalMode). */
    minimalMode?: string;
    /** Тапер, недель (1-4). */
    taperWeeks?: number;
  };
  /** Тапер внутри блока (финальные недели блока, Bosquet 2005 / канон lms-taper.engine). */
  taper?: {
    enabled: boolean;
    weeks?: number;
    /** PL: раскладка тапера (classic/pl/pro/wf) — канон lms-taper.engine. */
    mode?: string;
    /** PL: весовая цель (auto/lose/gain/maintain) — множитель объёма кривой. */
    weightGoal?: string;
    /** PL: mock meet (прикиды-синглы) на финальной неделе тапера. */
    mockMeet?: boolean;
    /** PL: пост-старт восстановление (метка на финальной неделе). */
    postMeet?: boolean;
  };
  /** BB: применить пик-неделю (contests) к последней неделе блока. */
  peakWeek?: boolean;
  /** BB: сериализованный BBContestPrepConfig (JSON-safe). */
  peakConfig?: Record<string, unknown>;
  /** MANUAL: скопировать структуру другого собранного блока по blockKey. */
  templateFromBlockKey?: string;
  /** ARM: WAF весовая категория (−55..+110) — side/back нормализация. */
  weightClass?: string;
  /** Заметки пользователя к блоку. */
  notes?: string;
}

/** Результат сборки одного блока. */
export interface AnnualBlockBuildResult {
  blockKey: string;
  kind: AnnualBlockKind;
  /** Недели блока (1..weeks), с фазовой модуляцией и taper/peak. */
  weeks: UserWeek[];
  /** Готовая UserProgram блока (для экспорта в ручной режим / выполнения). */
  program: UserProgram | null;
  /** BBPlan-снапшот (для передачи в ББ-авто); JSON-safe (any — движок BB тяжёлый). */
  bbPlan: unknown | null;
  warnings: string[];
  taperApplied: boolean;
  peakApplied: boolean;
  /** Hash конфигурации сборки (для stale-детекции). */
  configHash: string;
}

/** Состояние блока в годовом плане: ссылка + конфиг + (опц.) результат сборки. */
export interface AnnualBlockState {
  ref: AnnualBlockRef;
  config: AnnualBlockConfig;
  status: MacroBlockBuildStatus;
  result?: AnnualBlockBuildResult;
  builtAt?: string;
  error?: string;
}

/** Годовой план: разметка + состояния блоков. */
export interface AnnualTrainingPlan {
  id: string;
  version: number;
  totalWeeks: number;
  direction: AnnualPlanDirection;
  /** Ссылка на макро-разметку (сериализованный Macrocycle | BBMacrocycle | ArmMacrocycle). */
  macroRef: { source: 'pl' | 'bb' | 'arm'; serialized: string } | null;
  blocks: AnnualBlockState[];
  status: 'draft' | 'partial' | 'built' | 'stale';
  createdAt: string;
  updatedAt: string;
}

/** Опции сборки блоков (общие для всех конструкторов). */
export interface AnnualBuildOptions {
  /** BB: уровень по умолчанию (если не задан в config блока). */
  level?: string;
  /** BB: цель по умолчанию. */
  goal?: string;
  /** BB/MANUAL: дней в неделю по умолчанию. */
  daysPerWeek?: number;
  /** BB: оборудование по умолчанию. */
  equipment?: string[];
  /** BB: слабые группы по умолчанию. */
  weakPoints?: string[];
  /** BB: training focus по умолчанию. */
  trainingFocus?: string;
  /** BB: workMax по группам (для весов). */
  workMax?: Record<string, number>;
  /** BB: recovery-метрики → MRV soft-cap. */
  bodyFat?: number;
  leanMass?: number;
  hrvMs?: number;
  sleepHours?: number;
  stressLevel?: number;
  /** Пол (BB: glute-приоритет). */
  sex?: 'male' | 'female';
  /** Какие блоки собирать: 'missing' — только unbuilt/stale/error, 'all' — всё заново. */
  rebuild?: 'missing' | 'all';
  /** false — собрать блоки плана «как есть» без синхронизации с макро-разметкой
   *  (оркестратор уже синхронизировал план). По умолчанию true. */
  sync?: boolean;
}

/** Результат сборки всего годового плана. */
export interface AnnualBuildOutcome {
  plan: AnnualTrainingPlan;
  built: number;
  skipped: number;
  failed: number;
  errors: { blockKey: string; message: string }[];
}
