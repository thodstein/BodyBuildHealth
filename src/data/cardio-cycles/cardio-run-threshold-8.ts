/**
 * cardio-run-threshold-8.ts — ГОТОВЫЙ ЦИКЛ: пороговый блок бегуна,
 * 8 недель (4 пробежки/нед): темп T (threshold) + аэробная поддержка.
 * Структура по канону пороговой работы (Jack Daniels «Daniels' Running
 * Formula» T-темп = «comfortably hard», ~25-30 с/км медленнее 5K-темпа,
 * 88-92% LTHR; McMillan Running threshold blocks; Pfitzinger
 * LT-прогрессия 3×8 → 4×8 → 3×12 → 2×20 мин):
 *   Вт — Т-сессия (отрезки в темпе порога), Чт — лёгкий бег,
 *   Сб — длинная в Z2, Вс — восстановительная;
 * малые шаги объёма (+5-8%/нед), делод на 4-й, тест 10К на 8-й.
 */
import type { CardioCycleTemplate, CardioTemplateSession, CardioTemplateWeek } from './cardio-cycle-types';

const T = 'Темп T: «комфортно тяжело» (разговор короткими фразами), ~88-92% LTHR, 25-30 с/км медленнее 5K-темпа.';
const RW = 'Разминка 15 мин легко + заминка 10 мин.';

/** Т-сессия: отрезки в пороговом темпе через короткую трусцу. */
const thr = (min: number, desc: string, dow: number): CardioTemplateSession => ({
  type: 'miss', durationMin: min, equipment: 'running', dayOfWeek: dow,
  purpose: `${RW} ${desc} ${T}`,
});
const easy = (min: number, desc: string, dow: number): CardioTemplateSession => ({
  type: 'zone2', durationMin: min, equipment: 'running', dayOfWeek: dow, purpose: `Лёгкий бег: ${desc} Разговорно, Z2.`,
});
const long = (min: number, desc: string, dow: number): CardioTemplateSession => ({
  type: 'zone2', durationMin: min, equipment: 'running', dayOfWeek: dow, purpose: `Длинная: ${desc} Ровно, самый лёгкий темп недели.`,
});
const rec = (min: number, dow: number): CardioTemplateSession => ({
  type: 'recovery', durationMin: min, equipment: 'running', dayOfWeek: dow, purpose: 'Восстановительная: трусца/ходьба, ноги «прокрутить».',
});
const race = (min: number, desc: string, dow: number): CardioTemplateSession => ({
  type: 'hiit', durationMin: min, equipment: 'running', dayOfWeek: dow, purpose: `${desc} Сберегите силы на гонку — темп T больше не нужен.`,
});

const WEEKS: CardioTemplateWeek[] = [
  { sessions: [thr(60, '3×8 мин T / 2 мин трусцой.', 1), easy(40, 'легко, ровно.', 3), long(60, 'первый объёмный.', 5), rec(30, 6)], phase: 'base', note: 'Втягивание в порог: отрезки короче, качество важнее.' },
  { sessions: [thr(65, '4×8 мин T / 2 мин трусцой.', 1), easy(40, 'легко.', 3), long(70, 'на 10 мин больше прошлой.', 5), rec(30, 6)], phase: 'base' },
  { sessions: [thr(70, '3×12 мин T / 2.5 мин трусцой.', 1), easy(40, 'легко.', 3), long(80, 'спокойный, ок.', 5), rec(30, 6)], phase: 'build', note: 'Пик объёма первой волны — затем разгрузка.' },
  { sessions: [rec(25, 6), easy(35, 'только легко.', 1), long(55, 'укороченная.', 5), rec(25, 3)], phase: 'base', deload: true, note: 'Делод −40%: порог не бегается, восстанавливаемся.' },
  { sessions: [thr(75, '2×20 мин T / 3 мин трусцой — канонический порог.', 1), easy(40, 'легко.', 3), long(85, 'уверенно.', 5), rec(30, 6)], phase: 'build', note: 'Возврат после делода: лучшая Т-сессия блока.' },
  { sessions: [thr(75, '3×15 мин T / 3 мин трусцой.', 1), easy(40, 'легко.', 3), long(90, 'полтора часа.', 5), rec(30, 6)], phase: 'build' },
  { sessions: [thr(65, '25 мин нон-стоп T (без разрывов).', 1), easy(40, 'легко.', 3), long(95, 'последняя большая.', 5), rec(30, 6)], phase: 'build', note: 'Специфика: держать порог непрерывно.' },
  { sessions: [thr(45, 'Подводка: 4×3 мин T / 2 мин.', 1), easy(30, 'коротко и легко.', 3), rec(25, 5), race(55, 'ТЕСТ 10К: гонка на максимум!', 6)], phase: 'peak', taper: true, note: 'Taper + тест 10К: сравните с тестом до блока.' },
];

export const CARDIO_RUN_THRESHOLD_8: CardioCycleTemplate = {
  meta: {
    id: 'cardio-run-threshold-8',
    title: 'Порог бегуна — 8 недель (темп T, тест 10К)',
    goal: 'health',
    goalFit: ['health', 'maintenance', 'cut', 'recomp'],
    weeks: 8,
    sessionsPerWeek: 4,
    level: ['intermediate', 'advanced'],
    sport: 'run',
    period: 'build',
    equipment: ['running'],
    lowImpact: false,
    kind: 'explicit',
    description: 'Пороговая работа (темп T) от 3×8 до 25 мин нон-стоп + аэробная поддержка; финал — тест 10К.',
    howItWorks: 'Вт — Т-отрезки (88-92% LTHR), Чт лёгкий, Сб длинная, Вс восстановление; делод на 4-й; нед.8 — подводка и тест 10К.',
    conditions: ['Бегаете 30-40 мин непрерывно', '4 д/нед, есть где стабильно бежать темп'],
    tags: ['run', 'threshold', 'tempo', '10k', 'daniels', 'pro'],
    deloadWeeks: [4],
    taperWeeks: [8],
    sourceLabel: 'Пороговый блок по канону Daniels T-темпа и Pfitzinger LT-прогрессии (3×8 → 2×20 мин)',
  },
  preset: { goal: 'health', totalWeeks: 8, daysAvailable: 4, level: 'intermediate', equipment: ['running'] },
  weeks: WEEKS,
};
