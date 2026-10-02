/**
 * cardio-swim-1500-8.ts — ГОТОВЫЙ ЦИКЛ: плавание 1500 м, 8 недель
 * (3 заплыва/нед): техника + аэробная база + контрольные проплывы.
 * Структура по канону подготовки пловца-любителя (USA Swimming
 * «freestyle base»: техника на каждой тренировке, прогрессия
 * непрерывного проплыва 1000 → 1500 м; Swimpro/«триатлонные» каноны —
 * 25-50 м паузы 20-30 с для формы; тест — 1500 м нон-стоп):
 *   Вт — техника+короткие серии, Чт — аэробные серии, Сб — непрерывный;
 *   делод на 4-й, taper и тест 1500 м на 8-й.
 */
import type { CardioCycleTemplate, CardioTemplateSession, CardioTemplateWeek } from './cardio-cycle-types';

const TECH = 'Техника: длинный гребок, высокий локоть, ровное дыхание (на 3-й гребок).';
const swim = (min: number, desc: string, dow: number): CardioTemplateSession => ({
  type: 'zone2', durationMin: min, equipment: 'swimming', dayOfWeek: dow, purpose: `Заплыв: ${desc} ${TECH}`,
});
const rec = (min: number, dow: number): CardioTemplateSession => ({
  type: 'recovery', durationMin: min, equipment: 'swimming', dayOfWeek: dow, purpose: 'Спокойное плавание/дриллы без задачи.',
});
const test = (min: number, desc: string, dow: number): CardioTemplateSession => ({
  type: 'hiit', durationMin: min, equipment: 'swimming', dayOfWeek: dow, purpose: desc,
});

const WEEKS: CardioTemplateWeek[] = [
  { sessions: [swim(35, 'дриллы 200 + 10×50 (пауза 20 с) ровно.', 1), swim(40, 'серии 8×100 (пауза 30 с).', 3), swim(45, 'непрерывно 1000 м — базовый контроль.', 5)], phase: 'base', note: 'Втягивание: 1000 м нон-стоп — отправная точка.' },
  { sessions: [swim(35, 'дриллы 200 + 12×50 (пауза 20 с).', 1), swim(45, 'серии 8×100 (пауза 25 с).', 3), swim(50, 'непрерывно 1200 м.', 5)], phase: 'base' },
  { sessions: [swim(35, 'дриллы 200 + 6×100 (пауза 20 с).', 1), swim(45, 'серии 5×200 (пауза 30 с).', 3), swim(55, 'непрерывно 1400 м.', 5)], phase: 'build', note: 'Пик первой волны.' },
  { sessions: [rec(25, 1), swim(30, 'легко 800 м ровно.', 3), swim(35, 'легко 1000 м.', 5)], phase: 'base', deload: true, note: 'Делод −30%: объём срезан, техника держится.' },
  { sessions: [swim(35, 'дриллы 200 + 6×150 (пауза 25 с).', 1), swim(45, 'серии 4×300 (пауза 30 с).', 3), swim(55, 'непрерывно 1400 м.', 5)], phase: 'build' },
  { sessions: [swim(35, 'дриллы 200 + 4×300 (пауза 30 с).', 1), swim(45, 'серии 3×400 (пауза 40 с).', 3), swim(55, 'первая попытка 1500 м нон-стоп.', 5)], phase: 'build', note: 'Ключевая: контрольные 1500 м.' },
  { sessions: [swim(25, 'подводка: 200 дриллы + 6×50 бодро (пауза 20 с).', 1), swim(30, 'легко 800 м.', 3), swim(40, '1000 м ровно.', 5)], phase: 'taper', taper: true, note: 'Taper: объём −35%, руки свежие.' },
  { sessions: [swim(20, 'подводка: 4×50 по темпу цели.', 1), rec(25, 3), test(45, 'ТЕСТ 1500 м: разминка 10 мин + 1500 м на максимум! Разложите силы ровно.', 5)], phase: 'peak', taper: true, note: 'Неделя теста 1500 м.' },
];

export const CARDIO_SWIM_1500_8: CardioCycleTemplate = {
  meta: {
    id: 'cardio-swim-1500-8',
    title: 'Плавание 1500 м — 8 недель',
    goal: 'health',
    goalFit: ['health', 'maintenance', 'cut'],
    weeks: 8,
    sessionsPerWeek: 3,
    level: ['beginner', 'intermediate'],
    sport: 'mixed',
    period: 'build',
    equipment: ['swimming'],
    lowImpact: true,
    kind: 'explicit',
    description: 'От 1000 к 1500 м нон-стоп: техника + серии 100-400 м + непрерывные проплывы, финал — тест 1500 м.',
    howItWorks: 'Вт — техника и короткие серии, Чт — аэробные серии, Сб — непрерывный проплыв; делод на 4-й; нед.8 — тест.',
    conditions: ['Умеете проплыть 400 м без остановки', 'Бассейн 25/50 м, 3×/нед'],
    tags: ['swim', '1500m', 'technique', 'endurance', 'low-impact', 'pro'],
    deloadWeeks: [4],
    taperWeeks: [7, 8],
    sourceLabel: 'USA Swimming freestyle base + канон непрерывной прогрессии 1000 → 1500 м',
  },
  preset: { goal: 'health', totalWeeks: 8, daysAvailable: 3, level: 'beginner', equipment: ['swimming'], lowImpact: true },
  weeks: WEEKS,
};
