/**
 * ss-types.ts — типы интернет-циклов ТА / силового экстрима.
 * Аналог lms-types.ts для strength-sport: явная раскладка ВСЕХ недель
 * (faithful multi-week, дословно по источнику), обезличено.
 *
 * КЛЮЧЕВОЕ: SS хранит раскладку каждой недели (weeks[w] = дни недели w+1),
 * т.к. волны ТА/стронга нелинейны (deload/taper/mock внутри цикла) и не
 * выводятся одной прогрессией из недели 1. Поле week1 дублирует weeks[0].
 */

export type SSCycleMode = 'weightlifting' | 'strongman' | 'hybrid';
export type SSCycleLevel = 'beginner' | 'intermediate' | 'advanced' | 'enhanced';
export type SSCyclePeriod = 'base' | 'build' | 'peak' | 'mixed';
export type SSSourcePhase = 'base' | 'build' | 'peak' | 'deload' | 'taper' | 'test';

/** Один блок подходов: % от ПМ (или от TM при meta.tmFactor), повторы, число подходов. */
export interface SSSetSpec {
  pct: number; // доля от ПМ (0.72 = 72%)
  reps: number;
  sets: number;
  rir?: number; // явный RIR из источника (иначе rirForWeek по фазе)
  distanceM?: number; // для carries: дистанция проноса
  timeCapS?: number; // для medley/AMRAP: лимит времени
  amrap?: boolean; // последний сет до отказа в разумных пределах (5/3/1 «+»)
}

/** Упражнение дня — id из пулов strength-sport (POOL_BY_TAG), группа для отчёта. */
export interface SSExerciseSpec {
  id: string; // exercise id (snatch, back_squat, yoke_walk, ...)
  name: string; // русское имя для плана/печати
  group: string; // olympic/legs/back/shoulders/strongman/accessory
  coef: number; // коэф. тяжести (как в lms)
  sets: SSSetSpec[];
  /** Роль в сессии (для methodology-порядка и accessory-first срезок). Дефолт primary. */
  role?: 'primary' | 'accessory';
  /** Переопределение базы ПМ: ключ workMax (deadlift/backSquat/...) вместо авто-определения. */
  base?: string;
  /** Множитель к базе (аксессуары: тяга в наклоне 0.5 от тяги, махи 0.3 от жима). */
  baseMult?: number;
  /** true = упражнение с весом тела (планка, подносы ног) — вес 0, только повторы/время. */
  bodyweight?: boolean;
}

/** Тренировочный день: тег сессии совпадает с пулами (snatch_day/event_day/...). */
export interface SSDaySpec {
  tag: string;
  character: 'тяж' | 'памп' | 'лёг';
  exercises: SSExerciseSpec[];
}

/** Фаза цикла — авторская разметка недель источника. */
export interface SSPhaseBlock {
  weekStart: number;
  weekEnd: number;
  phase: SSSourcePhase;
  title?: string;
}

export interface SSCycleMeta {
  id: string;
  title: string;
  mode: SSCycleMode;
  weeks: number;
  sessionsPerWeek: number;
  /** Верхняя граница дней (циклы 3→4 д/нед: база sessionsPerWeek, пик — Max). */
  sessionsPerWeekMax?: number;
  level: SSCycleLevel[];
  period: SSCyclePeriod;
  /** Недельный % корректировки ПМ для продолжения цикла (0 = явные недели, прогрессия вшита). */
  correctionPct: number;
  /** Какое оборудование требует (barbell всегда доступен). */
  equipment: string[]; // напр. ['barbell'] или ['barbell','log','yoke','stone']
  /** true = нужны спец-снаряды; без них — фолбэк через STRONG_FALLBACK_COEFF с бейджем. */
  needsSpecialty?: boolean;
  /** true = daily-max протокол; в UI только с явным согласием + advanced/enhanced. */
  bulgarian?: boolean;
  /** 0.9 = проценты от training max (5/3/1), иначе 1.0 = от истинного ПМ. */
  tmFactor?: number;
  description: string;
  howItWorks: string;
  conditions: string[];
  tags?: string[];
  phases?: SSPhaseBlock[];
  deloadWeeks?: number[];
  taperWeeks?: number[];
  mockWeeks?: number[]; // недели mock-соревнований (полная симуляция)
  /** Происхождение разметки для аудита. */
  sourcePhaseSource?: 'original' | 'inferred';
}

/** Шаблон цикла: meta + явная раскладка всех недель + week1-дубль. */
export interface SSCycleTemplate {
  meta: SSCycleMeta;
  week1: SSDaySpec[];
  weeks: SSDaySpec[][];
}
