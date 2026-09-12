/**
 * cardio-cycle-types.engine.ts — доменные типы кардио-цикла (P1 PRO-2, распил god-file).
 * Только типы (zero runtime): вынесены из cardio.engine.ts 1-в-1.
 * cardio.engine.ts реэкспортирует их — импорты потребителей не меняются.
 */

export type CardioType = 'zone2' | 'hiit' | 'miss' | 'recovery';

/** Оборудование/форма кардио (влияет на подбор при ограничениях суставов). */
export type CardioEquipment = 'running' | 'cycling' | 'rowing' | 'elliptical' | 'walking' | 'swimming';

/** Уровень подготовки: корректирует стартовый объём. */
export type CardioLevel = 'beginner' | 'intermediate' | 'advanced';

export interface CardioStructuredBlock {
  workSec: number;
  restSec: number;
  reps: number;
  target?: 'hr' | 'pace' | 'power' | 'rpe';
  targetHr?: { min?: number; max?: number };
  note?: string;
}

export interface CardioSession {
  id?: string;
  type: CardioType;
  durationMin: number;
  weeklyFrequency: number;
  intensity: 'low' | 'moderate' | 'high';
  kcalPerSession: number;   // оценочно
  purpose: string;
  targetHr?: { min?: number; max?: number };
  dayOfWeek?: number;
  restrictions?: string[];
  /** Предпочтительное оборудование для сессии (персонализация подбора). */
  equipment?: CardioEquipment;
  /** Структурированные интервалы (если есть — сессия выполняется по интервалам, а не равномерно). */
  structured?: CardioStructuredBlock[];
  /** Мощность (Вт) для вело/гребли, если задана. */
  powerWatts?: number;
}

export interface CardioPlan {
  sessions: CardioSession[];
  totalKcalPerWeek: number;
  rationale: string[];
}

// ─── CardioCycle (многонедельный цикл) ───

export type CardioGoal = 'health' | 'mass' | 'cut' | 'recomp' | 'maintenance' | 'recovery' | 'bb_prep' | 'pl_prep' | 'bb_taper';

export type CardioPeriodizationModel = 'linear' | 'polarized' | 'pyramidal' | 'pyramidal_polarized';

export type CardioPhase =
  | 'base'
  | 'build'
  | 'maintenance'
  | 'contest_prep'
  | 'taper'
  | 'peak'
  | 'transition';

export interface CardioWeek {
  week: number;
  phase: CardioPhase;
  sessions: CardioSession[];
  totalMinutes: number;
  totalKcal: number;
  deload: boolean;
  taper: boolean;
  rationale: string[];
}

export interface CardioCompetitionRef {
  id: string;
  name: string;
  week: number;       // 1-индекс недели соревнования внутри цикла
  priority?: 'A' | 'B' | 'C';
}

export interface CardioCycle {
  id: string;
  name: string;
  goal: CardioGoal;
  totalWeeks: number;
  weeks: CardioWeek[];
  totalKcal: number;
  linkedMacrocycleId?: string;
  linkedCompetitionIds?: string[];
  source: 'auto' | 'manual' | 'imported';
  version: 1;
  createdAt: string;
  rationale: string[];
  /** Дата начала цикла (локальная YYYY-MM-DD) — неделя 1 = startDate.
   *  Все date-функции (неделя/прогресс/adherence/«Сегодня») должны
   *  использовать его как reference, иначе прогресс «съезжает». */
  startDate?: string;
  /** Снапшот параметров сборки — для «⚙️ Изменить параметры» в мастере. */
  config?: CardioCycleInput;
}

export interface CardioCycleInput {
  goal: CardioGoal;
  totalWeeks?: number;             // по умолчанию 12
  bodyWeight?: number;             // по умолчанию 80
  daysAvailable?: number;          // 0-7 доступных дней (по умолчанию 7)
  recoveryLow?: boolean;           // низкое восстановление → HIIT убран
  competitions?: CardioCompetitionRef[];
  /** Ручная структура фаз (недели base/build/maintenance). Если задано —
   *  используются эти доли вместо авто-процентов. taper/peak/contest_prep
   *  по-прежнему определяются соревнованиями. */
  phaseSplit?: { base?: number; build?: number; maintenance?: number };
  /** Длина taper-окна перед стартом (1-4, по умолчанию 2). */
  taperWeeks?: number;
  /** Модель taper: step (постоянный срез) vs exponential (прогрессивный, Thomas 2009, эффективнее) */
  taperModel?: 'step' | 'exponential';
  /** Строить taper перед стартами (по умолчанию true; false → старт без taper-кривой). */
  taper?: boolean;
  /** Строить пик-неделю старта (по умолчанию true; false → неделя старта лёгкая taper). */
  peakWeek?: boolean;
  /** Уровень подготовки (корректирует стартовый объём: 0.8/1/1.15). */
  level?: CardioLevel;
  /** Предпочтительное оборудование (до 3). */
  equipment?: CardioEquipment[];
  /** Щадить суставы: исключает ударные виды (бег). */
  lowImpact?: boolean;
  /** Возраст — для целевых пульс-зон сессий (Karvonen/ЧССмакс). */
  age?: number;
  /** ЧСС покоя — для пульс-зон по резерву (Karvonen). */
  restingHr?: number;
  /** Пол — для формулы ЧССмакс (женщины 226-age). */
  sex?: 'male' | 'female';
  /** Дни тяжёлых ног (0-6, Пн=0): zone2/miss/hiit не ставятся в эти дни. */
  legDays?: number[];
  /** Проблемы суставов из профиля (для autoLowImpact). */
  jointIssues?: boolean;
  /** Процент жира (0-70) — для точного расхода через FFM (вес × (1-бф/100)). */
  bodyFatPct?: number;
  /** Дата начала цикла (локальная YYYY-MM-DD); по умолчанию — сегодня. */
  startDate?: string;
  /** Сон (часы/ночь): <6 → объём ×0.9. */
  sleepHours?: number;
  /** Стресс (1-10): ≥7 → HIIT убран, объём ×0.95. */
  stressLevel?: number;
  /** HRV (мс, утренний): <25 при >0 → объём ×0.9. */
  hrvMs?: number;
  /** PED-курс: повышенное восстановление → объём ×1.05. */
  enhanced?: boolean;
  /** Авто-учёт суставов из профиля (chronicConditions) → lowImpact. */
  autoLowImpact?: boolean;
  /** Формула ЧССмакс: classic 220/226-age, tanaka 208-0.7×age (точнее), gulati 206-0.88×age (жен) */
  maxHrFormula?: 'classic' | 'tanaka' | 'gulati';
  /** Модель периодизации (Seiler 2026): linear / polarized 80/20 / pyramidal / pyramidal→polarized */
  periodizationModel?: CardioPeriodizationModel;
  /** PRO-калибровка (Эпик A): LTHR (Friel 30'), FTP (вело 20'×0.95), talk-test потолок Z2. Приоритет LTHR > FTP > talk > age. */
  lthr?: number;
  ftpWatts?: number;
  talkZone2Hr?: number;
  /** PRO-контекст среды (Эпик G): жара/влажность/высота для поправки HR-зон. */
  tempC?: number;
  humidityPct?: number;
  altitudeM?: number;
  /** Снапшот параметров сборки (для «⚙️ Изменить параметры»). Заполняется в buildCardioCycle. */
  config?: CardioCycleInput;
  id?: string;
  name?: string;
  source?: CardioCycle['source'];
  createdAt?: string;
  /** Id шаблона библиотеки (ставит buildCardioCycleFromTemplate для явных
   *  циклов): валидатор относится к острым неделям как к авторским (advisory). */
  templateId?: string;
  /** P5 PRO-2: неделя ручного свитча второй половины на polarized
   *  (Filipas 2021 PYR→POL +3%). Без флага — байт-в-байт. */
  tidSwitchWeek?: number;
  /** P6 PRO-2: durability-сессия 1×/нед (длинная Z2 с целью decoupling <5%).
   *  Вшивается только в недели ≥150 мин, иначе — только совет. По умолчанию выкл. */
  durabilitySession?: boolean;
  /** P4 PRO-2: красные флаги скрининга (см. cardio-red-flags.engine.ts).
   *  Любой флаг → только Z2/recovery до врача. */
  redFlags?: string[];
}

// ─── Факторы профиля (сон/стресс/HRV/PED/суставы) ───

export interface CardioProfileFactors {
  sleepHours?: number;
  stressLevel?: number;
  hrvMs?: number;
  enhanced?: boolean;
  jointIssues?: boolean;
}

// ─── Пресеты-шаблоны (быстрые старты) ───

export interface CardioPreset {
  id: string;
  name: string;
  desc: string;
  icon: string;
  goal: CardioGoal;
  totalWeeks: number;
  daysAvailable: number;
  recoveryLow: boolean;
}

export type CardioTaperModel = 'step' | 'exponential';

export interface CardioScenario {
  id: string;
  name: string;
  savedAt: string;
  cycle: CardioCycle;
}

export type CardioVariant = 'gentle' | 'base' | 'intense';
