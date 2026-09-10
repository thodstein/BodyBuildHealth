/**
 * combat-cycle-library.ts — библиотека готовых циклов единоборств.
 * Именные шаблоны (база/кэмп/весогонка/ОФП) поверх ATR/Linear/Conjugate:
 * цикл = дисциплина + цель + недели + дни + модель + сплит-паттерн.
 * Применение — одной кнопкой в шаге «Сплит» (только параметры, движок 1-в-1).
 */
import { COMBAT_PATTERNS } from './combat-split-patterns';
import type { CombatInput } from './combat.types';

export interface CombatCycleTemplate {
  id: string;
  name: string;
  discipline: CombatInput['discipline'];
  goal: CombatInput['goal'];
  weeks: number;
  daysPerWeek: 2 | 3 | 4;
  periodizationModel: CombatInput['periodizationModel'];
  patternId: string;
  blurb: string;
}

export const COMBAT_CYCLE_LIBRARY: CombatCycleTemplate[] = [
  {
    id: 'cb-box-base-8', name: 'Бокс · база 8 нед',
    discipline: 'boxing', goal: 'power', weeks: 8, daysPerWeek: 3,
    periodizationModel: 'linear_12', patternId: 'combat_3',
    blurb: 'Верх/низ/фулбоди: шея, ротация, взрывные медболы. Линейный рост объёма.',
  },
  {
    id: 'cb-wrestle-base-6', name: 'Борьба · база 6 нед',
    discipline: 'wrestling', goal: 'power', weeks: 6, daysPerWeek: 3,
    periodizationModel: 'atr_10', patternId: 'combat_3b',
    blurb: 'Тяги унилатерально, шея ×1.3, хват. ATR-укороченный: накопление → реализация.',
  },
  {
    id: 'cb-mma-camp-8', name: 'ММА · кэмп к бою 8 нед',
    discipline: 'mma', goal: 'camp', weeks: 8, daysPerWeek: 4,
    periodizationModel: 'atr_10', patternId: 'combat_4',
    blurb: 'Полный кэмп: сила + борьба + кондиция 3 системы, тапер к дате боя.',
  },
  {
    id: 'cb-kick-cond-6', name: 'Кикбоксинг · кондиция 6 нед',
    discipline: 'kickboxing', goal: 'endurance', weeks: 6, daysPerWeek: 3,
    periodizationModel: 'linear_12', patternId: 'combat_3',
    blurb: 'Ноги + ротация кора, силовая выносливость 8-15, короткие отдыхи.',
  },
  {
    id: 'cb-mma-cut-4', name: 'ММА · весогонка + пик 4 нед',
    discipline: 'mma', goal: 'weight_cut', weeks: 4, daysPerWeek: 3,
    periodizationModel: 'conjugate', patternId: 'combat_3b',
    blurb: 'Сопряжённая волна под дефицит: объём ×0.75, RIR 3-4, без отказа.',
  },
  {
    id: 'cb-general-ofp-6', name: 'Общая ОФП 6 нед',
    discipline: 'general', goal: 'maintenance', weeks: 6, daysPerWeek: 2,
    periodizationModel: 'linear_12', patternId: 'combat_2a',
    blurb: 'Минимум 2×/нед на фоне высокой внезальной: RIR 3-4, поддержка.',
  },
];

export function getCombatCycle(id: string): CombatCycleTemplate | null {
  return COMBAT_CYCLE_LIBRARY.find(c => c.id === id) || null;
}

/** Проверка библиотеки: все patternId существуют, дни совпадают со сплитом. */
export function validateCombatCycles(): string[] {
  const errs: string[] = [];
  for (const c of COMBAT_CYCLE_LIBRARY) {
    const p = COMBAT_PATTERNS.find(p => p.id === c.patternId);
    if (!p) { errs.push(`${c.id}: нет паттерна ${c.patternId}`); continue; }
    if (p.sessionsPerRotation !== c.daysPerWeek) errs.push(`${c.id}: дни ${c.daysPerWeek} !== сплит ${p.sessionsPerRotation}`);
    if (c.weeks < 2 || c.weeks > 12) errs.push(`${c.id}: недели вне 2-12`);
  }
  return errs;
}
