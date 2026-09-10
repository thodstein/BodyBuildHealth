/**
 * cardio-run-10k-12.ts — 10K Intermediate 12 недель (Garmin).
 * Разметка по Garmin 10K Training Schedule: recovery + threshold
 * (4-5×5-7 мин) + интервалы на 10к-темпе + холмы + кросс-трен;
 * long 60 → 90 мин; нед.4 — разгрузка; нед.12 — подводка.
 */
import type { CardioCycleTemplate, CardioTemplateSession, CardioTemplateWeek } from './cardio-cycle-types';

const rec = (durationMin: number, purpose: string, dayOfWeek?: number): CardioTemplateSession => ({
  type: 'recovery', durationMin, equipment: 'running', purpose, dayOfWeek,
});
const easy = (durationMin: number, purpose: string, dayOfWeek?: number): CardioTemplateSession => ({
  type: 'zone2', durationMin, equipment: 'running', purpose, dayOfWeek,
});
const tempo = (durationMin: number, purpose: string, workSec: number, restSec: number, reps: number, dayOfWeek?: number): CardioTemplateSession => ({
  type: 'miss', durationMin, equipment: 'running', purpose, dayOfWeek,
  structured: [{ workSec, restSec, reps, target: 'pace', note: 'Пороговый темп (часовая гонка)' }],
});
const interv = (durationMin: number, purpose: string, workSec: number, restSec: number, reps: number, dayOfWeek?: number): CardioTemplateSession => ({
  type: 'hiit', durationMin, equipment: 'running', purpose, dayOfWeek,
  structured: [{ workSec, restSec, reps, target: 'pace', note: 'Темп 10к' }],
});

const B = (sessions: CardioTemplateSession[], note?: string): CardioTemplateWeek => ({ sessions, phase: 'base', note });
const U = (sessions: CardioTemplateSession[], note?: string): CardioTemplateWeek => ({ sessions, phase: 'build', note });

const weeks: CardioTemplateWeek[] = [
  B([rec(25, 'Восстановительный 25 мин.', 0), tempo(35, 'Порог 4×5 мин / 2 мин трусцой + кросс 30 мин.', 300, 120, 4, 2), easy(45, 'Холмы 45 мин.', 4), easy(60, 'Длинный 60 мин.', 6)]),
  B([rec(30, 'Восстановительный 30 мин / йога.', 0), tempo(38, 'Порог 4×6 мин / 2 мин + кросс 40 мин.', 360, 120, 4, 2), interv(30, 'Интервалы 5×2 мин в темпе 10к / 1 мин.', 120, 60, 5, 4), easy(70, 'Длинный 70 мин.', 6)]),
  B([rec(30, 'Восстановительный 30 мин.', 0), tempo(40, 'Порог 2×15 мин / 5 мин + кросс 40 мин.', 900, 300, 2, 2), interv(36, 'Интервалы 6×3 мин в темпе 10к / 1 мин.', 180, 60, 6, 4), easy(80, 'Длинный 80 мин.', 6)], 'Порог 2×15 — первый длинный темп.'),
  { sessions: [rec(30, 'Восстановительный 30 мин.', 0), tempo(35, 'Порог 3×7 мин + 3 мин в темпе 10к / 3 мин.', 420, 180, 3, 2), easy(45, 'Лёгкий длинный 45 мин.', 6)], phase: 'base', deload: true, note: 'Разгрузка: объём −40%.' },
  U([rec(30, 'Восстановительный 30 мин.', 0), tempo(40, 'Порог 3×7 мин + 3 мин в темпе 10к + кросс 3×20 мин.', 420, 180, 3, 2), easy(60, '60 мин вкл. 2×10 мин порога / 5 мин.', 4), interv(40, 'Интервалы 2×2×5 мин в темпе 10к.', 300, 90, 4, 6), easy(75, 'Длинный 75 мин.', 6)]),
  U([rec(30, 'Восстановительный 30 мин.', 0), tempo(40, '60 мин вкл. 20 мин порога + кросс 2×20 мин.', 1200, 300, 1, 2), interv(38, 'Интервалы 6×3 мин в темпе 10к / 2 мин.', 180, 120, 6, 4), easy(80, 'Длинный 80 мин.', 6)]),
  U([rec(30, 'Восстановительный 30 мин.', 0), tempo(42, 'Порог 4×6 мин + 3 мин в темпе 10к / 2 мин + кросс 40 мин.', 360, 120, 4, 2), easy(45, '45 мин вкл. 15 мин порога.', 4), interv(36, 'Интервалы 8×2 мин в темпе 10к / 1 мин.', 120, 60, 8, 6), easy(80, 'Длинный 80 мин.', 6)]),
  U([rec(40, 'Восстановительный 40 мин / кросс 3×20 мин.', 0), interv(44, 'Интервалы 2×4×2 мин в темпе 5к / 1+3 мин.', 120, 120, 8, 2), rec(40, 'Восстановительный 40 мин.', 4), tempo(45, '2×2 мили в темпе 10к / 10 мин.', 600, 600, 2, 6), easy(80, 'Длинный 80 мин.', 6)], 'Скоростной блок: темп 5к.'),
  U([rec(45, '45 мин вкл. 15 мин порога + кросс 3×20 мин.', 0), interv(40, 'Интервалы 10×2 мин в темпе 10к / 1 мин трусцой.', 120, 60, 10, 2), rec(25, 'Восстановительный 25 мин.', 4), easy(90, 'Длинный 90 мин — пик объёма.', 6)], 'Пик объёма: 10×2 мин + 90 мин.'),
  U([rec(30, 'Восстановительный 30 мин.', 0), tempo(40, 'Порог 2×15 мин / 2 мин + кросс 3×20 мин.', 900, 120, 2, 2), rec(30, 'Восстановительный 30 мин.', 4), tempo(45, '2×2 мили в темпе 10к / 10 мин.', 600, 600, 2, 6), easy(70, 'Лёгкий длинный 70 мин.', 6)]),
  U([rec(30, 'Восстановительный 30 мин.', 0), tempo(42, 'Порог 2×15 мин + 3 мин в темпе 10к / 2 мин.', 900, 120, 2, 2), rec(30, 'Восстановительный 30 мин.', 4), interv(32, 'Интервалы 6×2 мин в темпе 10к.', 120, 60, 6, 6), easy(75, 'Длинный 75 мин.', 6)]),
  { sessions: [rec(25, 'Восстановительный 25 мин.', 0), easy(30, 'Лёгкий 30 мин + 4×100 м strides.', 2), easy(25, 'Предстарт 20-25 мин + Старт 10 км!', 4)], phase: 'peak', taper: true, note: 'Подводка: лёгкая неделя + старт.' },
];

export const CARDIO_RUN_10K_12: CardioCycleTemplate = {
  meta: {
    id: 'cardio-run-10k-12',
    title: '10K Intermediate — 12 недель (Garmin)',
    goal: 'health',
    goalFit: ['health', 'maintenance', 'cut'],
    weeks: 12,
    sessionsPerWeek: 4,
    sessionsPerWeekMax: 5,
    level: ['intermediate', 'advanced'],
    sport: 'run',
    period: 'build',
    equipment: ['running'],
    lowImpact: false,
    kind: 'explicit',
    description: 'От уверенных 60 мин до старта 10 км: порог 2×15 мин, интервалы на 10к-темпе, холмы, long до 90 мин.',
    howItWorks: 'Неделя = recovery + threshold + интервалы + long; нед.4 — делод; пик объёма на 9-й; 12-я — подводка.',
    conditions: ['Бегаете 60 мин непрерывно', '4 д/нед', 'Знаете темп 10к (или бегите по пульсу Z3/Z4)'],
    tags: ['run', 'intermediate', '10k', 'threshold', 'intervals'],
    deloadWeeks: [4],
    taperWeeks: [12],
    sourceLabel: 'Garmin 10K Training Schedule (intermediate, 12 недель)',
  },
  preset: { goal: 'health', totalWeeks: 12, daysAvailable: 4, level: 'intermediate', equipment: ['running'], periodizationModel: 'pyramidal' },
  weeks,
};
