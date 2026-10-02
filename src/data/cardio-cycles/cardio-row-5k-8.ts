/**
 * cardio-row-5k-8.ts — ГОТОВЫЙ ЦИКЛ: 5K гребля (Concept2), 8 недель
 * (4 сессии/нед): интервалы + темповая выносливость + тест 5К.
 * Структура по канону Concept2 «5K Training Plan» (интервалы 500-2000 м,
 * темповые непрерывные: 2000-6000 м на целевом сплите, контроль по
 * сплиту 500 м; Stroke rate 22-26 всё, кроме ускорений; техника — ровная
 * тяга без «дёргания») и British Rowing рекомендаций по сплиту
 * (цель 5К ↔ темп на 500 м). Всё в метрах и сплитах, без выдуманных кг.
 */
import type { CardioCycleTemplate, CardioTemplateSession, CardioTemplateWeek } from './cardio-cycle-types';

const TECH = 'Техника: ровная тяга 1:2 (тяга:возврат), rate 22-26, дыхание по гребкам.';
const RW = 'Разминка 5-10 мин лёгкой гребли + заминка 5 мин.';
const iv = (min: number, desc: string, dow: number): CardioTemplateSession => ({
  type: 'hiit', durationMin: min, equipment: 'rowing', dayOfWeek: dow, purpose: `${RW} ${desc}`,
});
const tempo = (min: number, desc: string, dow: number): CardioTemplateSession => ({
  type: 'miss', durationMin: min, equipment: 'rowing', dayOfWeek: dow, purpose: `${RW} ${desc} Сплит: цель 5К +2-3 с/500 м. ${TECH}`,
});
const steady = (min: number, desc: string, dow: number): CardioTemplateSession => ({
  type: 'zone2', durationMin: min, equipment: 'rowing', dayOfWeek: dow, purpose: `Стеди: ${desc} Разговорный сплит. ${TECH}`,
});
const rec = (min: number, dow: number): CardioTemplateSession => ({
  type: 'recovery', durationMin: min, equipment: 'rowing', dayOfWeek: dow, purpose: 'Лёгкая гребля: техника на расслаблении.',
});

const WEEKS: CardioTemplateWeek[] = [
  { sessions: [iv(45, '4×1000 м / 3 мин лёгкой гребли.', 1), steady(30, 'ровно.', 3), tempo(35, '3000 м нон-стоп.', 5), rec(25, 6)], phase: 'base', note: 'Втягивание: запишите сплит 3000 м — это ориентир.' },
  { sessions: [iv(50, '6×3 мин / 2 мин.', 1), steady(35, 'ровно.', 3), tempo(40, '4000 м.', 5), rec(25, 6)], phase: 'base' },
  { sessions: [iv(55, '5×1500 м / 3 мин.', 1), steady(35, 'ровно.', 3), tempo(45, '5000 м.', 5), rec(25, 6)], phase: 'build', note: 'Пик первой волны.' },
  { sessions: [rec(25, 1), steady(30, 'легко.', 3), steady(30, 'легко.', 5), rec(20, 6)], phase: 'base', deload: true, note: 'Делод: интервалы не гребём.' },
  { sessions: [iv(45, '8×500 м / 2 мин — быстро.', 1), steady(35, 'ровно.', 3), tempo(45, '5000 м.', 5), rec(25, 6)], phase: 'build', note: 'Скоростная неделя: короткие отрезки.' },
  { sessions: [iv(55, '3×2000 м / 4 мин — на целевом сплите 5К.', 1), steady(35, 'ровно.', 3), tempo(50, '6000 м.', 5), rec(25, 6)], phase: 'build', note: 'Ключевая: 2000-ки — сплит цели.' },
  { sessions: [iv(40, 'Подводка: 4×500 м бодро / полное восстановление.', 1), steady(30, 'легко.', 3), rec(20, 5), rec(25, 6)], phase: 'taper', taper: true, note: 'Taper: объём −35%, скорость свежая.' },
  { sessions: [iv(35, 'Подводка: 3×250 м по сплиту цели / полный отдых.', 1), rec(25, 3), rec(20, 5), { type: 'hiit', durationMin: 45, equipment: 'rowing', dayOfWeek: 6, purpose: 'ТЕСТ 5К: разминка 10 мин + 5000 м на максимум! Сравните сплит с 3000 м недели 1.' }], phase: 'peak', taper: true, note: 'Неделя теста 5К.' },
];

export const CARDIO_ROW_5K_8: CardioCycleTemplate = {
  meta: {
    id: 'cardio-row-5k-8',
    title: 'Гребля 5K — 8 недель (Concept2)',
    goal: 'health',
    goalFit: ['health', 'maintenance', 'cut'],
    weeks: 8,
    sessionsPerWeek: 4,
    level: ['beginner', 'intermediate'],
    sport: 'row',
    period: 'build',
    equipment: ['rowing'],
    lowImpact: true,
    kind: 'explicit',
    description: 'Пятикилометровая гребля: 500-2000 м интервалы + непрерывные 3000-6000 м, контроль по сплиту, финал — тест 5К.',
    howItWorks: 'Вт — интервалы, Чт — стеди, Сб — темповый непрерывный, Вс — recovery; делод на 4-й; нед.8 — тест 5К.',
    conditions: ['Гребной тренажёр (Concept2 или аналог)', '4 д/нед по 30-55 мин'],
    tags: ['row', 'concept2', '5k', 'split', 'low-impact', 'pro'],
    deloadWeeks: [4],
    taperWeeks: [7, 8],
    sourceLabel: 'Concept2 5K Training Plan (интервалы 500-2000 м + continuous 2-6 км)',
  },
  preset: { goal: 'health', totalWeeks: 8, daysAvailable: 4, level: 'beginner', equipment: ['rowing'], lowImpact: true },
  weeks: WEEKS,
};
