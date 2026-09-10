/**
 * cardio-run-5k-6.ts — 5K Beginner 6 недель (3 бега + кросс-трен).
 * Разметка по Canada Running Series / Univ. Arizona 5K-планам:
 * easy/interval/long + strides; пик — интервалы 5×1 км + контрольная миля.
 */
import type { CardioCycleTemplate, CardioTemplateSession, CardioTemplateWeek } from './cardio-cycle-types';

const easy = (durationMin: number, purpose: string, dayOfWeek?: number): CardioTemplateSession => ({
  type: 'zone2', durationMin, equipment: 'running', purpose, dayOfWeek,
});
const interval = (durationMin: number, purpose: string, workSec: number, restSec: number, reps: number, dayOfWeek?: number): CardioTemplateSession => ({
  type: 'miss', durationMin, equipment: 'running', purpose, dayOfWeek,
  structured: [{ workSec, restSec, reps, target: 'pace', note: 'Темп целевой 5к' }],
});
const strides = (durationMin: number, purpose: string, dayOfWeek?: number): CardioTemplateSession => ({
  type: 'zone2', durationMin, equipment: 'running', purpose, dayOfWeek,
  structured: [{ workSec: 30, restSec: 60, reps: 6, target: 'rpe', note: 'Ускорения 30 с легко' }],
});

const wk = (sessions: CardioTemplateSession[], note?: string): CardioTemplateWeek => ({
  sessions, phase: 'base', note,
});

const weeks: CardioTemplateWeek[] = [
  wk([
    easy(30, 'Лёгкий бег 30 мин + 8×100 м strides.', 0),
    interval(28, 'Интервалы 10×1 мин в темпе 5к / 1 мин трусцой.', 60, 60, 10, 2),
    easy(50, 'Длинный 45-60 мин: начать легко, финиш уверенно.', 4),
  ], 'База: strides + короткие интервалы.'),
  wk([
    easy(30, 'Лёгкий бег 30 мин + 8×100 м strides.', 0),
    interval(30, 'Лестница 3-2-1 мин в темпе 10к→5к / 1-3 мин трусцой.', 120, 90, 6, 2),
    easy(55, 'Длинный 45-60 мин легко-уверенно.', 4),
  ]),
  wk([
    easy(35, 'Лёгкий бег 8 км + 8×100 м strides.', 0),
    easy(60, 'Длинный 60 мин: начать легко, финиш уверенно.', 2),
    interval(32, 'Пирамида 5-4-3-2-1 мин в темпе 10к, трусца 1 мин.', 180, 60, 5, 4),
  ]),
  wk([
    easy(40, 'Лёгкий бег 8 км + strides.', 0),
    easy(60, 'Длинный 60 мин легко.', 2),
    interval(34, '4×30 с strides + миля на время + 1 миля в темпе половинки.', 30, 60, 4, 4),
  ], 'Контрольная миля — калибровка темпа 5к.'),
  wk([
    easy(40, 'Лёгкий бег 8 км + strides.', 0),
    easy(60, 'Длинный 60 мин легко-уверенно.', 2),
    interval(36, 'Классика: 5×1 км в темпе 5к / 2 мин трусцой.', 300, 120, 5, 4),
  ], 'Ключевая: 5×1000 м в темпе гонки.'),
  wk([
    easy(30, 'Лёгкий бег + 6×30 с strides.', 0),
    interval(30, 'Предстарт: 4×800 м в темпе мили / 2 мин + 6×30 с.', 120, 120, 4, 2),
    easy(35, 'Старт 5 км! Разминка 10 мин + гонка.', 4),
  ], 'Подводка: лёгкая неделя + старт.'),
];

export const CARDIO_RUN_5K_6: CardioCycleTemplate = {
  meta: {
    id: 'cardio-run-5k-6',
    title: '5K Beginner — 6 недель (3 д/нед)',
    goal: 'health',
    goalFit: ['health', 'maintenance', 'cut'],
    weeks: 6,
    sessionsPerWeek: 3,
    level: ['beginner', 'intermediate'],
    sport: 'run',
    period: 'build',
    equipment: ['running'],
    lowImpact: false,
    kind: 'explicit',
    description: 'От уверенных 30 мин до старта 5 км: easy + интервалы в темпе гонки + длинный час.',
    howItWorks: 'Неделя = лёгкий со strides + интервальная + длинная; пик на 5-й неделе (5×1 км), 6-я — подводка.',
    conditions: ['Бегаете 30 мин непрерывно', '3 д/нед'],
    tags: ['run', 'beginner', '5k', 'intervals'],
    sourceLabel: 'Canada Running Series 5K + Univ. Arizona 5K (беговые планы 6 недель)',
  },
  preset: { goal: 'health', totalWeeks: 6, daysAvailable: 3, level: 'beginner', equipment: ['running'] },
  weeks,
};
