/**
 * cardio-run-base-12.ts — Аэробная база 12 недель (генераторный).
 * Разметка по Runner's World Base-Building (Dec 2025): 20 → 75 мин easy,
 * нед.6-9 strides/холмы, нед.10-12 фартлек; итог 12-15 миль/нед.
 * Реализован генератором: health + polarized + 4 д/нед + level beginner.
 */
import type { CardioCycleTemplate } from './cardio-cycle-types';

export const CARDIO_RUN_BASE_12: CardioCycleTemplate = {
  meta: {
    id: 'cardio-run-base-12',
    title: 'Аэробная база — 12 недель (4 д/нед)',
    goal: 'health',
    goalFit: ['health', 'maintenance', 'cut', 'recomp'],
    weeks: 12,
    sessionsPerWeek: 4,
    level: ['beginner', 'intermediate'],
    sport: 'run',
    period: 'base',
    equipment: ['running'],
    lowImpact: false,
    kind: 'generator',
    description: 'Разговорный бег 20 → 75 мин: 80% легко, strides с 6-й недели, фартлек с 10-й. База под 10к/полумарафон.',
    howItWorks: 'Генератор строит polarized-цикл: Zone 2 растёт +4%/нед, делоды каждые 4 нед, HIIT — только strides/фартлек в хвосте.',
    conditions: ['Бегаете 20 мин непрерывно', '4 д/нед'],
    tags: ['run', 'base', 'polarized', 'strides'],
    sourceLabel: "Runner's World 12-Week Base-Building Plan (Dec 2025)",
  },
  preset: {
    goal: 'health', totalWeeks: 12, daysAvailable: 4, level: 'beginner',
    equipment: ['running'], periodizationModel: 'polarized',
  },
};
