/**
 * lms-types.ts — типы СРЦ-циклов (силовые программы, импорт из xlsm).
 * Этап B. Обезличено (без авторов/эмблем/приставок).
 *
 * КЛЮЧЕВОЕ: СРЦ хранит раскладку микроцикла 1 (неделя 1); недели 2..N
 * генерируются прогрессией PM (lms-progression.engine). Поле week1 — шаблон-раскладка.
 */

export type SRDirection = 'powerlifting' | 'bench' | 'deadlift_bench' | 'armwrestling' | 'bodybuilding' | 'weightlifting';
export type SRLevel = 'novice' | 'II-KMS' | 'KMS-MS' | 'MS-MSMK' | 'II-MS' | 'KMS-MSMK' | 'intermediate';
export type SRPeriod = 'strength' | 'endurance' | 'peak' | 'mass' | 'mixed';

export interface SRCycleMeta {
  id: string;             // 'cycle-01'
  title: string;          // 'Силовой цикл 1'
  direction: SRDirection;
  level: SRLevel;
  period: SRPeriod;
  minBodyWeight?: number; // кг
  sessionsPerWeek: number;
  weeks: number;          // длительность (12 или 4)
  correctionPct: number;  // недельный % корректировки PM (0.005 = +0.5%)
  weightRatio?: 'normal' | 'any';
  description: string;    // краткое описание
  howItWorks: string;     // ОБЯЗАТЕЛЬНО: как работает цикл (метод, нагрузка, прогрессия, акценты)
  conditions: string[];   // условия соответствия (вес/уровень/техника/восстановление)
  notes?: string;
}

/** Один подход в раскладке: % от PM, повторения, количество подходов. */
export interface SRSetSpec {
  pct: number;   // доля от PM (0.68 = 68%)
  reps: number;
  sets: number;
}

/** Упражнение в дне. */
export interface SRExerciseSpec {
  name: string;
  group: string;          // ЖМ/ПР/ТГ/Ср — классификация источника
  coef: number;           // Коэф. тяжести
  mnosz: number;          // Множ
  load?: string;          // Тяжелая/Средняя/Легкая
  sets: SRSetSpec[];
}

/** Тренировочный день недели 1. */
export interface SRDaySpec {
  exercises: SRExerciseSpec[];
}

/** Шаблон цикла: meta + раскладка недели 1 (остальные недели генерируются прогрессией). */
export interface SRCycleTemplate {
  meta: SRCycleMeta;
  week1: SRDaySpec[];
}