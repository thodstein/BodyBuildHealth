/**
 * cardio-bike-1k-8.ts — BikeErg 1K 8 недель (Concept2, вело).
 * Разметка по Concept2 1000m BikeErg Race Plan: вело-аналог 2K-схемы —
 * длинные интервалы 4-6 мин + короткие 1-2 мин + ровные заезды;
 * 8-я неделя — подводка + гонка 1000 м.
 */
import type { CardioCycleTemplate, CardioTemplateSession, CardioTemplateWeek } from './cardio-cycle-types';

const bike = (d: number, p: string, workSec?: number, restSec?: number, reps?: number, dow?: number): CardioTemplateSession => ({
  type: workSec ? 'hiit' : 'zone2', durationMin: d, equipment: 'cycling', purpose: p, dayOfWeek: dow,
  structured: workSec && restSec && reps ? [{ workSec, restSec, reps, target: 'power', note: 'Мощность: средняя с прошлой такой тренировки, чуть выше' }] : undefined,
});
const steady = (d: number, p: string, dow?: number): CardioTemplateSession => ({ type: 'zone2', durationMin: d, equipment: 'cycling', purpose: p, dayOfWeek: dow });
const rec = (d: number, p: string, dow?: number): CardioTemplateSession => ({ type: 'recovery', durationMin: d, equipment: 'cycling', purpose: p, dayOfWeek: dow });

const W: CardioTemplateWeek[] = [
  { sessions: [bike(24, 'Интервалы 4×4 мин / 2 мин легко.', 240, 120, 4, 0), bike(22, 'Интервалы 6×2 мин / 1 мин.', 120, 60, 6, 2), steady(30, 'Ровный заезд 30 мин.', 4)], phase: 'base', note: 'Старт: длинные + короткие.' },
  { sessions: [bike(28, 'Интервалы 5×4 мин / 2 мин.', 240, 120, 5, 0), bike(28, 'Интервалы 3×6 мин / 3 мин.', 360, 180, 3, 2), steady(35, 'Ровный заезд 35 мин.', 4)], phase: 'base' },
  { sessions: [bike(32, 'Интервалы 6×4 мин / 2 мин.', 240, 120, 6, 0), bike(34, 'Интервалы 4×6 мин / 3 мин.', 360, 180, 4, 2), steady(40, 'Ровный заезд 40 мин.', 4)], phase: 'build', note: 'Объёмный пик.' },
  { sessions: [bike(24, 'Интервалы 6×3 мин / 2 мин.', 180, 120, 6, 0), bike(24, 'Интервалы 4×5 мин / 3 мин.', 300, 180, 4, 2), steady(30, 'Ровный заезд 30 мин.', 4)], phase: 'build', deload: true, note: 'Разгрузка −25%.' },
  { sessions: [bike(22, 'Интервалы 12×1 мин / 1 мин.', 60, 60, 12, 0), bike(28, 'Интервалы 4×5 мин / 3 мин.', 300, 180, 4, 2), steady(40, 'Ровный заезд 40 мин.', 4)], phase: 'build', note: 'Скоростной блок.' },
  { sessions: [bike(24, 'Интервалы 10×2 мин / 1 мин.', 120, 60, 10, 0), bike(30, 'Интервалы 5×4 мин / 2 мин.', 240, 120, 5, 2), steady(45, 'Ровный заезд 45 мин — пик.', 4)], phase: 'build', note: 'Пик объёма.' },
  { sessions: [bike(20, 'Интервалы 8×2 мин / 1 мин.', 120, 60, 8, 0), bike(24, 'Интервалы 3×6 мин / 3 мин.', 360, 180, 3, 2), steady(30, 'Ровный заезд 30 мин.', 4)], phase: 'taper', taper: true, note: 'Подводка: объём −40%.' },
  { sessions: [bike(15, 'Открывашка: 5×1 мин / 1 мин легко.', 60, 60, 5, 0), bike(10, 'ГОНКА 1000 м! Разминка 15 мин + старт.', undefined, undefined, undefined, 2), rec(20, 'Заминка 20 мин легко.', 4)], phase: 'peak', taper: true, note: 'Неделя гонки!' },
];

export const CARDIO_BIKE_1K_8: CardioCycleTemplate = {
  meta: {
    id: 'cardio-bike-1k-8',
    title: 'Вело 1K — 8 недель (Concept2 BikeErg)',
    goal: 'health',
    goalFit: ['health', 'maintenance', 'cut'],
    weeks: 8,
    sessionsPerWeek: 3,
    level: ['beginner', 'intermediate', 'advanced'],
    sport: 'bike',
    period: 'build',
    equipment: ['cycling'],
    lowImpact: true,
    kind: 'explicit',
    description: 'Быстрый километр на велоэргометре: интервалы по мощности + ровные заезды + гонка.',
    howItWorks: 'Неделя = длинные интервалы + короткие + ровный; нед.4 — делод; нед.7-8 — подводка и гонка.',
    conditions: ['Велоэргометр с ваттами', '3 д/нед'],
    tags: ['bike', 'erg', 'intervals', 'power', 'low-impact'],
    deloadWeeks: [4],
    taperWeeks: [7, 8],
    sourceLabel: 'Concept2 1000m BikeErg Race Plan (8 недель)',
  },
  preset: { goal: 'health', totalWeeks: 8, daysAvailable: 3, level: 'intermediate', equipment: ['cycling'], lowImpact: true },
  weeks: W,
};
