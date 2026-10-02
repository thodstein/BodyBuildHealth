/**
 * cardio-run-hills-6.ts — ГОТОВЫЙ ЦИКЛ: горки/холмы, 6 недель
 * (3 пробежки/нед): силовая выносливость бегуна без выдуманных темпов.
 * Структура по канону hill-repeat работы (Lydiard hill phase; McMillan
 * «Hill Repeats»: 6-10×45-90 с в подъём 4-8%, вниз — трусцой; улучшают
 * мощность шага и экономичность при меньшей ударной нагрузке, чем
 * ровные интервалы; финал — тест на холмистом круге):
 *   Вт — горки, Чт — лёгкий бег, Сб — длинная Z2; делод на 4-й.
 */
import type { CardioCycleTemplate, CardioTemplateSession, CardioTemplateWeek } from './cardio-cycle-types';

const HILL = 'В горку 4-8%: сильно, но подконтрольно, шаг короткий и частый; вниз — трусцой, восстанавливаясь.';
const RW = 'Разминка 15 мин с 2-3 короткими ускорениями + заминка 10 мин.';

const hill = (min: number, desc: string, dow: number): CardioTemplateSession => ({
  type: 'miss', durationMin: min, equipment: 'running', dayOfWeek: dow, purpose: `${RW} ${desc} ${HILL}`,
});
const easy = (min: number, dow: number): CardioTemplateSession => ({
  type: 'zone2', durationMin: min, equipment: 'running', dayOfWeek: dow, purpose: 'Лёгкий бег Z2: ровно, разговорно.',
});
const long = (min: number, desc: string, dow: number): CardioTemplateSession => ({
  type: 'zone2', durationMin: min, equipment: 'running', dayOfWeek: dow, purpose: `Длинная Z2: ${desc}`,
});
const rec = (min: number, dow: number): CardioTemplateSession => ({
  type: 'recovery', durationMin: min, equipment: 'running', dayOfWeek: dow, purpose: 'Восстановление: трусца/ходьба.',
});

const WEEKS: CardioTemplateWeek[] = [
  { sessions: [hill(55, '6×45 с в горку / трусца вниз.', 1), easy(40, 3), long(70, 'ровно по плоскому.', 5)], phase: 'base', note: 'Втягивание: короткие горки, следите за техникой.' },
  { sessions: [hill(60, '8×60 с в горку / трусца вниз.', 1), easy(45, 3), long(75, 'спокойно.', 5)], phase: 'base' },
  { sessions: [hill(65, '10×60 с в горку / трусца вниз.', 1), easy(45, 3), long(85, 'уверенно.', 5)], phase: 'build', note: 'Пик объёма горок — затем разгрузка.' },
  { sessions: [rec(30, 6), easy(40, 1), long(55, 'укороченная.', 5)], phase: 'base', deload: true, note: 'Делод: горки не бегаем, ноги отдыхают.' },
  { sessions: [hill(70, '6×90 с в горку / трусца вниз — длинные подъёмы.', 1), easy(45, 3), long(90, 'последняя большая.', 5)], phase: 'build', note: 'Ключевая: длинные подъёмы — сила-выносливость.' },
  { sessions: [hill(50, 'Подводка: 4×60 с в горку / полностью вниз.', 1), easy(35, 3), { type: 'hiit', durationMin: 55, equipment: 'running', dayOfWeek: 5, purpose: 'ТЕСТ: 5 км по холмистому кругу — сравните с ровным тестом.' }], phase: 'peak', taper: true, note: 'Taper + холмистый тест 5К.' },
];

export const CARDIO_RUN_HILLS_6: CardioCycleTemplate = {
  meta: {
    id: 'cardio-run-hills-6',
    title: 'Горки — 6 недель (сила-выносливость бегуна)',
    goal: 'health',
    goalFit: ['health', 'maintenance', 'cut'],
    weeks: 6,
    sessionsPerWeek: 3,
    level: ['intermediate', 'advanced'],
    sport: 'run',
    period: 'build',
    equipment: ['running'],
    lowImpact: false,
    kind: 'explicit',
    description: 'Горки 6-10×45-90 с: мощность шага и экономичность при меньшей ударной нагрузке; финал — холмистый тест 5К.',
    howItWorks: 'Вт — подъёмы (вниз трусцой), Чт лёгкий, Сб длинная; делод на 4-й; нед.6 — подводка и тест.',
    conditions: ['Есть горка 4-8% или лестница', 'Бегаете 30+ мин непрерывно'],
    tags: ['run', 'hills', 'strength-endurance', 'lydiard', 'pro'],
    deloadWeeks: [4],
    taperWeeks: [6],
    sourceLabel: 'Hill-repeat канон (Lydiard hill phase · McMillan hill repeats 6-10×45-90 с)',
  },
  preset: { goal: 'health', totalWeeks: 6, daysAvailable: 3, level: 'intermediate', equipment: ['running'] },
  weeks: WEEKS,
};
