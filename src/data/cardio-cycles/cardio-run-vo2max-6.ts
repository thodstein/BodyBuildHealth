/**
 * cardio-run-vo2max-6.ts — ГОТОВЫЙ ЦИКЛ: VO2max / 5K-специфика,
 * 6 недель (4 пробежки/нед): интервалы I-темпа + короткая скорость R.
 * Структура по канону Jack Daniels («Daniels' Running Formula», фаза
 * I/R 5K-плана): I-отрезки 3-5 мин @ ~3K-5K-темп (98-100% VO2max,
 * vVO2max), R — короткие 200 м для скорости и экономичности; правило
 * «не более 8% недельного объёма в I-темпе» (в минутах — с разминкой);
 * длинная в Z2 держит аэробную базу, делод на 4-й, финал — гонка 5К.
 */
import type { CardioCycleTemplate, CardioTemplateSession, CardioTemplateWeek } from './cardio-cycle-types';

const I = 'Темп I: 3K-5K-усилие, дыхание тяжёлое, 4-5 мин на повтор — не быстрее, чем удержите все повторы.';
const R = 'Темп R: коротко и быстро, расслабленно, полное восстановление между отрезками.';
const RW = 'Разминка 15 мин легко + 4×20 с ускорения. Заминка 10 мин.';

const iv = (min: number, desc: string, dow: number): CardioTemplateSession => ({
  type: 'hiit', durationMin: min, equipment: 'running', dayOfWeek: dow, purpose: `${RW} ${desc} ${I}`,
});
const speed = (min: number, desc: string, dow: number): CardioTemplateSession => ({
  type: 'hiit', durationMin: min, equipment: 'running', dayOfWeek: dow, purpose: `${RW} ${desc} ${R}`,
});
const easy = (min: number, dow: number): CardioTemplateSession => ({
  type: 'zone2', durationMin: min, equipment: 'running', dayOfWeek: dow, purpose: 'Лёгкий бег Z2: разговорно, восстанавливает к интервалам.',
});
const long = (min: number, desc: string, dow: number): CardioTemplateSession => ({
  type: 'zone2', durationMin: min, equipment: 'running', dayOfWeek: dow, purpose: `Длинная Z2: ${desc}`,
});
const rec = (min: number, dow: number): CardioTemplateSession => ({
  type: 'recovery', durationMin: min, equipment: 'running', dayOfWeek: dow, purpose: 'Восстановление: трусца/ходьба.',
});
const race = (min: number, desc: string, dow: number): CardioTemplateSession => ({
  type: 'hiit', durationMin: min, equipment: 'running', dayOfWeek: dow, purpose: desc,
});

const WEEKS: CardioTemplateWeek[] = [
  { sessions: [iv(55, '8×400 м I / 2.5 мин трусцой.', 1), easy(45, 3), long(65, 'ровно.', 5), rec(30, 6)], phase: 'base', note: 'Втягивание: 400-ки, следите за одинаковым временем кругов.' },
  { sessions: [iv(60, '6×600 м I / 3 мин трусцой.', 1), easy(45, 3), long(75, 'чуть длиннее.', 5), rec(30, 6)], phase: 'base' },
  { sessions: [iv(65, '5×800 м I / 3 мин трусцой.', 1), easy(45, 3), long(85, 'спокойно.', 5), rec(35, 6)], phase: 'build', note: 'Пик объёма интервалов — затем разгрузка.' },
  { sessions: [rec(30, 6), easy(40, 1), long(55, 'укороченная.', 5), rec(25, 3)], phase: 'base', deload: true, note: 'Делод: скорость не трогаем, восстанавливаемся.' },
  { sessions: [iv(70, '4×1000 м I / 3 мин трусцой — специфика 5К.', 1), easy(45, 3), long(90, 'последняя большая.', 5), rec(35, 6)], phase: 'build', note: 'Ключевая сессия блока: 1000-ки в темпе цели.' },
  { sessions: [speed(45, 'Подводка: 6×200 м R / полное восстановление.', 1), easy(35, 3), rec(25, 5), race(50, 'ГОНКА 5К: цель — личный рекорд!', 6)], phase: 'peak', taper: true, note: 'Taper + гонка 5К.' },
];

export const CARDIO_RUN_VO2MAX_6: CardioCycleTemplate = {
  meta: {
    id: 'cardio-run-vo2max-6',
    title: 'VO2max / 5K — 6 недель (интервалы I + скорость R)',
    goal: 'health',
    goalFit: ['health', 'maintenance', 'cut'],
    weeks: 6,
    sessionsPerWeek: 4,
    level: ['intermediate', 'advanced'],
    sport: 'run',
    period: 'peak',
    equipment: ['running'],
    lowImpact: false,
    kind: 'explicit',
    description: 'Короткий скоростной блок: 400-1000 м в I-темпе + 200-ки R, аэробная поддержка, финал — гонка 5К.',
    howItWorks: 'Вт — интервалы I (с 400 до 1000 м), Чт/Сб/Вс — лёгкие; делод на 4-й; нед.6 — подводка и гонка 5К.',
    conditions: ['Бегаете 30+ мин непрерывно', 'Умеете держать ровный темп отрезков'],
    tags: ['run', 'vo2max', 'intervals', '5k', 'daniels', 'speed', 'pro'],
    deloadWeeks: [4],
    taperWeeks: [6],
    sourceLabel: 'Daniels I/R-фаза 5K-плана (400-1000 м @ I, 200 м @ R)',
  },
  preset: { goal: 'health', totalWeeks: 6, daysAvailable: 4, level: 'intermediate', equipment: ['running'] },
  weeks: WEEKS,
};
