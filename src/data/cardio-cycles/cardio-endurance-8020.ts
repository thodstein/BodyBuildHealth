/**
 * cardio-endurance-8020.ts — 80/20 Endurance (генераторные, 3 уровня).
 * Разметка по Matt Fitzgerald 80/20: 80% объёма легко (Z1-Z2),
 * 20% — жёстко (темп/интервалы); уровни отличаются часами/нед.
 */
import type { CardioCycleTemplate } from './cardio-cycle-types';

const LEVELS = [
  { id: 'cardio-8020-1', title: '80/20 Уровень 1 — 12 недель (до 5 ч/нед)', level: 'beginner' as const, days: 4 },
  { id: 'cardio-8020-2', title: '80/20 Уровень 2 — 12 недель (до 8 ч/нед)', level: 'intermediate' as const, days: 5 },
  { id: 'cardio-8020-3', title: '80/20 Уровень 3 — 12 недель (до 11 ч/нед)', level: 'advanced' as const, days: 6 },
];

export const CARDIO_8020_TEMPLATES: CardioCycleTemplate[] = LEVELS.map(l => ({
  meta: {
    id: l.id,
    title: l.title,
    goal: 'health',
    goalFit: ['health', 'maintenance', 'cut'],
    weeks: 12,
    sessionsPerWeek: l.days,
    level: [l.level],
    sport: 'mixed',
    period: 'mixed',
    equipment: ['running', 'cycling'],
    lowImpact: false,
    kind: 'generator',
    description: 'Поляризованные 80/20: почти всё легко + точечные жёсткие сессии. Без травм и перетрена.',
    howItWorks: 'Генератор polarized: Zone 2 — 80% объёма, темп/интервалы — 20%; делоды каждые 4 нед.',
    conditions: [`${l.days} д/нед`, 'Бег и/или вело'],
    tags: ['polarized', '80-20', 'endurance', l.level],
    sourceLabel: '80/20 Endurance (Fitzgerald, уровневые планы)',
  },
  preset: {
    goal: 'health', totalWeeks: 12, daysAvailable: l.days, level: l.level,
    equipment: ['running', 'cycling'], periodizationModel: 'polarized',
  },
}));
