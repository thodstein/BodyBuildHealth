/**
 * cardio-hiit-block-6.ts — ГОТОВЫЙ ЦИКЛ: HIIT-периодизация, 6 недель
 * (3 сессии/нед): последовательность научно проверенных протоколов.
 * Структура: Norwegian 4×4 (Helgerud 2007: +7-13% VO2max) → Billat
 * 30-30 (время на vVO2max) → SIT (спринт-интервалы, Gibala) → тест;
 * между HIIT — лёгкое аэробное (поляризация: интенсив ≤30% недельного
 * объёма, делод на 4-й, taper и финальный тест 5К на 6-й). Выполнять
 * на беговой дорожке/вело/гребле по выбору; замер — телом/пульсом.
 */
import type { CardioCycleTemplate, CardioTemplateSession, CardioTemplateWeek } from './cardio-cycle-types';

const beat = (min: number, desc: string, dow: number, reps?: number, workSec?: number, restSec?: number): CardioTemplateSession => ({
  type: 'hiit', durationMin: min, equipment: 'cycling', dayOfWeek: dow,
  purpose: `HIIT: ${desc} Разминка 10 мин + 4 ускорения, заминка 10 мин.`,
  structured: reps && workSec != null && restSec != null
    ? [{ workSec, restSec, reps, target: 'rpe', note: desc }]
    : undefined,
});
const easy = (min: number, dow: number): CardioTemplateSession => ({
  type: 'zone2', durationMin: min, equipment: 'running', dayOfWeek: dow, purpose: 'Лёгкое аэробное (Z2): разговорно, между жёсткими днями.',
});
const rec = (min: number, dow: number): CardioTemplateSession => ({
  type: 'recovery', durationMin: min, equipment: 'cycling', dayOfWeek: dow, purpose: 'Recovery: совсем легко.',
});

const WEEKS: CardioTemplateWeek[] = [
  { sessions: [beat(45, '4×4 мин жёстко / 3 мин легко (Norwegian).', 1, 4, 240, 180), easy(50, 3), rec(25, 5)], phase: 'base', note: 'Старт: Norwegian 4×4 — база VO2max.' },
  { sessions: [beat(50, '5×4 мин / 3 мин легко (прогресс).', 1, 5, 240, 180), easy(55, 3), rec(25, 5)], phase: 'base' },
  { sessions: [beat(50, 'Billat 30-30: 20×30 с жёстко / 30 с трусцой.', 1, 20, 30, 30), easy(55, 3), rec(25, 5)], phase: 'build', note: 'Смена стимула: время на vVO2max.' },
  { sessions: [rec(25, 1), easy(40, 3), rec(25, 5)], phase: 'base', deload: true, note: 'Делод: HIIT нет, впитываем.' },
  { sessions: [beat(50, 'SIT: 8×20 с спринт / 10 с пауза (на максимум).', 1, 8, 20, 10), easy(55, 3), rec(25, 5)], phase: 'build', note: 'Спринт-стимул: взрывная работа.' },
  { sessions: [beat(35, 'Подводка: 4×4 мин в темпе, но не до отказа.', 1, 4, 240, 180), easy(45, 3), beat(45, 'ТЕСТ: Billat 30-30 до отказа (сколько удержите) + 5К-замер ощущения.', 5, 20, 30, 30)], phase: 'peak', taper: true, note: 'Taper + финальный тест протокола.' },
];

export const CARDIO_HIIT_BLOCK_6: CardioCycleTemplate = {
  meta: {
    id: 'cardio-hiit-block-6',
    title: 'HIIT-периодизация — 6 недель (4×4 → 30-30 → SIT)',
    goal: 'health',
    goalFit: ['health', 'cut', 'recomp', 'maintenance'],
    weeks: 6,
    sessionsPerWeek: 3,
    level: ['intermediate', 'advanced'],
    sport: 'hiit',
    period: 'peak',
    equipment: ['cycling', 'running', 'rowing'],
    lowImpact: true,
    kind: 'explicit',
    description: 'Последовательность проверенных HIIT-протоколов (Norwegian 4×4, Billat 30-30, SIT) с лёгкими днями и делодом.',
    howItWorks: 'Вт — жёсткая HIIT-сессия (протокол меняется каждые 2 нед), Чт — лёгкое Z2, Сб — recovery; нед.4 делод, нед.6 — тест.',
    conditions: ['Можете дать 4 минуты жёстко', 'Вело/дорожка/гребля', '3 д/нед'],
    tags: ['hiit', 'vo2max', 'norwegian', 'billat', 'sit', 'low-impact', 'pro'],
    deloadWeeks: [4],
    taperWeeks: [6],
    sourceLabel: 'Helgerud 4×4 (2007) · Billat 30-30 · Gibala SIT — последовательность блока',
  },
  preset: { goal: 'health', totalWeeks: 6, daysAvailable: 3, level: 'intermediate', equipment: ['cycling', 'running'], lowImpact: true },
  weeks: WEEKS,
};
