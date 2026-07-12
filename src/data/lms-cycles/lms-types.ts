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
 id: string;
 title: string;
 direction: SRDirection;
 level: SRLevel;
 period: SRPeriod;
 minBodyWeight?: number;
 sessionsPerWeek: number;
 weeks: number;
 correctionPct: number; // недельный % корректировки PM (0.005 = +0.5%)
 weightRatio?: 'normal' | 'any';
 description: string;
 howItWorks: string;
  conditions: string[];
  notes?: string;
  tags?: string[];
  // ПРОФ-поля для бодибилдинга
  targetFocus?: 'push' | 'pull' | 'legs' | 'upper' | 'lower' | 'fullbody' | 'arms' | 'shoulders' | 'back' | 'chest' | 'mixed' | 'specialization' | 'contest';
  deloadWeeks?: number[]; // номера недель с разгрузкой
  rirProgression?: { start: number; end: number }; // RIR первой/последней недели
  phases?: SRPhaseBlock[]; // фазы макропериодизации (сила→гипертрофия и т.д.)
}

/** Один подход в раскладке: % от PM, повторения, количество подходов, RIR. */
export interface SRSetSpec {
 pct: number; // доля от PM (0.68 = 68%)
 reps: number;
 sets: number;
 rir?: number; // repetitions in reserve (ПРОФ-поля: 0-4)
}

/** Фаза цикла — для макропериодизации (блок сила/гипертрофия/пик). */
export interface SRPhaseBlock {
 weekStart: number;
 weekEnd: number;
 title?: string;
 correctionPct?: number; // свой темп прогрессии в этой фазе
 rirProgression?: { start: number; end: number }; // RIR первой/последней недели фазы
 repRange?: [number, number]; // [minReps, maxReps]
}

/** Упражнение в дне. */
export interface SRExerciseSpec {
 name: string;
 group: string; // ЖМ/ПР/ТГ/Ср — классификация источника
 coef: number; // Коэф. тяжести
 mnosz: number; // Множ
 load?: string; // Тяжелая/Средняя/Легкая
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