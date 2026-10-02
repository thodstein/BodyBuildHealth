/**
 * cardio-combat-8.ts — ГОТОВЫЙ ЦИКЛ: боевое кардио (roadwork),
 * 8 недель (4 тренировки/нед) для единоборств.
 * Структура по канону бойцовского «roadwork» (бокс/ММА: длинный
 * лёгкий бег как база, 30-30 интервалы на мешке/в беге как боевой
 * ритм, горки/спринты как взрывная работа, симуляции раундов
 * «5×3 мин» — специфическая выносливость; база ~80% объёма лёгкая):
 *   Вт — дорожная база, Чт — 30-30 (мешок/бег), Сб — взрыв (горки),
 *   Вс — симуляция боя; делод на 4-й, финальный тест-бой на 8-й.
 */
import type { CardioCycleTemplate, CardioTemplateSession, CardioTemplateWeek } from './cardio-cycle-types';

const RPE = 'Ощущения: «могу говорить» — лёгкое; «короткие фразы» — боевое; «не могу говорить» — взрывное.';
const road = (min: number, desc: string, dow: number): CardioTemplateSession => ({
  type: 'zone2', durationMin: min, equipment: 'running', dayOfWeek: dow, purpose: `Дорожная база: ${desc} ${RPE}`,
});
const intervals = (min: number, desc: string, dow: number): CardioTemplateSession => ({
  type: 'hiit', durationMin: min, equipment: 'running', dayOfWeek: dow,
  purpose: `30-30: ${desc} Мешок/бёрпи/бег — 30 с боевым темпом / 30 с лёгким. ${RPE}`,
  structured: [{ workSec: 30, restSec: 30, reps: 12, target: 'rpe', note: '30 с бой / 30 с отдых' }],
});
const power = (min: number, desc: string, dow: number): CardioTemplateSession => ({
  type: 'miss', durationMin: min, equipment: 'running', dayOfWeek: dow,
  purpose: `Взрыв: ${desc} В горку или спринтом, полностью восстанавливаясь между повторами. ${RPE}`,
});
const sim = (min: number, desc: string, dow: number): CardioTemplateSession => ({
  type: 'hiit', durationMin: min, equipment: 'running', dayOfWeek: dow, purpose: `Симуляция боя: ${desc} ${RPE}`,
});
const rec = (min: number, dow: number): CardioTemplateSession => ({
  type: 'recovery', durationMin: min, equipment: 'walking', dayOfWeek: dow, purpose: 'Восстановление: ходьба/трусца, растяжка.',
});

const WEEKS: CardioTemplateWeek[] = [
  { sessions: [road(40, 'ровно, разговорно.', 1), intervals(35, '10 раундов.', 3), power(40, '6×20 с.', 5), sim(30, '5×2 мин техника, 1 мин отдых.', 6)], phase: 'base', note: 'Втягивание: ритм боя на технике, не на износ.' },
  { sessions: [road(45, 'на 5 мин длиннее.', 1), intervals(35, '12 раундов.', 3), power(40, '7×20 с.', 5), sim(35, '5×2.5 мин.', 6)], phase: 'base' },
  { sessions: [road(50, 'уверенно.', 1), intervals(40, '12 раундов жёстче.', 3), power(45, '8×20 с.', 5), sim(40, '5×3 мин.', 6)], phase: 'build', note: 'Пик первой волны — затем разгрузка.' },
  { sessions: [rec(25, 1), rec(25, 3), rec(20, 5), sim(25, '3×2 мин легко, техника.', 6)], phase: 'base', deload: true, note: 'Делод −45%: восстанавливаемся, ритм не теряем.' },
  { sessions: [road(50, 'ровно.', 1), intervals(40, '12 раундов на мешке.', 3), power(45, '6×30 с в горку.', 5), sim(45, '6×3 мин с 1 мин отдыха.', 6)], phase: 'build', note: 'Возврат: раунды приближаются к бою.' },
  { sessions: [road(55, 'ровно.', 1), intervals(45, '14 раундов.', 3), power(45, '8×30 с.', 5), sim(45, '6×3 мин.', 6)], phase: 'build' },
  { sessions: [road(55, 'последняя длинная.', 1), intervals(45, '15 раундов.', 3), power(50, '10×30 с.', 5), sim(50, '7×3 мин — боевой объём.', 6)], phase: 'build', note: 'Пик: полный боевой объём раундов.' },
  { sessions: [road(35, 'лёгко.', 1), intervals(30, '8 раундов свежо.', 3), rec(25, 5), sim(60, 'ТЕСТ-БОЙ: 3×5 мин или 8×3 мин на максимум — сравните с неделей 1.', 6)], phase: 'peak', taper: true, note: 'Taper + тест-бой.' },
];

export const CARDIO_COMBAT_8: CardioCycleTemplate = {
  meta: {
    id: 'cardio-combat-8',
    title: 'Боевое кардио (roadwork) — 8 недель',
    goal: 'health',
    goalFit: ['health', 'cut', 'recomp', 'maintenance'],
    weeks: 8,
    sessionsPerWeek: 4,
    level: ['beginner', 'intermediate', 'advanced'],
    sport: 'mixed',
    period: 'build',
    equipment: ['running', 'walking'],
    lowImpact: false,
    kind: 'explicit',
    description: 'Бойцовская выносливость: дорожная база Z2, 30-30 на мешке/беге, взрывные горки, симуляции раундов и финальный тест-бой.',
    howItWorks: 'Вт — лёгкий бег, Чт — 30-30 (10-15 раундов), Сб — горки/спринты, Вс — симуляция «5×3 мин»; делод на 4-й; нед.8 — тест-бой.',
    conditions: ['Мешок или зал для бёрпи/скакалки', 'Бегаете 30+ мин непрерывно', '4 д/нед'],
    tags: ['combat', 'roadwork', 'boxing', '30-30', 'conditioning', 'pro'],
    deloadWeeks: [4],
    taperWeeks: [8],
    sourceLabel: 'Бойцовский roadwork канон (длинный лёгкий бег + 30-30 + горки + раунды 3-5 мин)',
  },
  preset: { goal: 'health', totalWeeks: 8, daysAvailable: 4, level: 'intermediate', equipment: ['running', 'walking'] },
  weeks: WEEKS,
};
