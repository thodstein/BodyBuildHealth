/**
 * cardio-cycle-types.ts — типы библиотеки именных кардио-циклов.
 * Аналог ss-types.ts / lms-типов для кардио: каждый шаблон — либо
 * генераторный (preset → buildCardioCycle), либо явный (weeks[w] =
 * сессии недели w+1, дословно по источнику: C25K, Garmin, Concept2...).
 *
 * Источники разметки указаны в meta.sourceLabel каждого шаблона
 * (C25K, Garmin, Nike NRC, Marathon Handbook, Runner's World,
 * 80/20 Endurance, Concept2, British Rowing, Helgerud/NTNU, Billat, Tabata).
 */

import type {
  CardioCycleInput,
  CardioEquipment,
  CardioGoal,
  CardioLevel,
  CardioPhase,
  CardioStructuredBlock,
  CardioType,
} from '../../engines/lms/cardio.engine';

export type CardioSport = 'run' | 'row' | 'bike' | 'mixed' | 'hiit';
export type CardioTemplatePeriod = 'base' | 'build' | 'peak' | 'mixed' | 'taper' | 'recovery';
export type CardioTemplateKind = 'generator' | 'explicit';

/** Одна сессия явной недели шаблона (частота всегда 1/нед — сессии поштучно). */
export interface CardioTemplateSession {
  type: CardioType;
  durationMin: number;
  equipment?: CardioEquipment;
  /** Структурированные интервалы (протоколы 4×4 / 30-30 / Tabata и т.п.). */
  structured?: CardioStructuredBlock[];
  /** Методическая подсказка: темп, RPE, сплит гребли и т.п. */
  purpose?: string;
  /** День недели 0-6 (Пн=0). Если не задан — раскладывает assignSessionDays. */
  dayOfWeek?: number;
}

/** Явная неделя шаблона. */
export interface CardioTemplateWeek {
  sessions: CardioTemplateSession[];
  phase?: CardioPhase;
  deload?: boolean;
  taper?: boolean;
  note?: string;
}

export interface CardioCycleMeta {
  id: string;
  title: string;
  /** Основная цель (для селектора и goal цикла). */
  goal: CardioGoal;
  /** Допустимые цели — шаблон применим и к ним (напр. health+maintenance). */
  goalFit?: CardioGoal[];
  weeks: number;
  sessionsPerWeek: number;
  /** Верхняя граница дней (пиковые недели шире базы). */
  sessionsPerWeekMax?: number;
  level: CardioLevel[];
  sport: CardioSport;
  period: CardioTemplatePeriod;
  equipment: CardioEquipment[];
  /** true = без ударной нагрузки (суставы): бег исключён из подбора. */
  lowImpact: boolean;
  kind: CardioTemplateKind;
  description: string;
  howItWorks: string;
  conditions: string[];
  tags?: string[];
  /** Недели делода / taper по источнику (для бейджей и валидатора). */
  deloadWeeks?: number[];
  taperWeeks?: number[];
  /** Человекочитаемый источник разметки (для аудита, не ссылка). */
  sourceLabel: string;
}

export interface CardioCycleTemplate {
  meta: CardioCycleMeta;
  /** Генераторные параметры (для kind='generator' — обязательно; для
   *  kind='explicit' — базовый пресет: goal/weeks/equipment/lowImpact/level). */
  preset: CardioCycleInput;
  /** Явная раскладка (только kind='explicit', длина = meta.weeks). */
  weeks?: CardioTemplateWeek[];
}

export type { CardioCycleInput, CardioEquipment, CardioGoal, CardioLevel, CardioPhase, CardioStructuredBlock, CardioType };
