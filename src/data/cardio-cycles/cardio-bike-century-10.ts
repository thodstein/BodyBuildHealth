/**
 * cardio-bike-century-10.ts — ГОТОВЫЙ ЦИКЛ: подготовка к 100 км
 * (вело, 4 заезда/нед, 10 недель): выносливость + темп на длинной.
 * Структура по канону марафонской подготовки велосипедиста
 * (British Cycling «Century/Sportive plan»; Joe Friel «The Cyclist's
 * Training Bible»: длинная прогрессия 40% за блок, темповые включения
 * на усталости, делоды каждые 3-4 нед, taper 2 нед):
 *   Ср — темп/SS, Чт — лёгкое Z2, Сб — длинная прогрессия, Вс — recovery.
 */
import type { CardioCycleTemplate, CardioTemplateSession, CardioTemplateWeek } from './cardio-cycle-types';

const RW = 'Разминка 10 мин + заминка 10 мин.';
const ss = (min: number, desc: string, dow: number): CardioTemplateSession => ({
  type: 'miss', durationMin: min, equipment: 'cycling', dayOfWeek: dow,
  purpose: `${RW} ${desc} Темп 85-90% FTP / «на грани разговора», каденс 85-95.`,
});
const z2 = (min: number, desc: string, dow: number): CardioTemplateSession => ({
  type: 'zone2', durationMin: min, equipment: 'cycling', dayOfWeek: dow, purpose: `Z2: ${desc} Разговорно, каденс 85-95.`,
});
const rec = (min: number, dow: number): CardioTemplateSession => ({
  type: 'recovery', durationMin: min, equipment: 'cycling', dayOfWeek: dow, purpose: 'Recovery-катание: совсем легко, ноги прокрутить.',
});
const long = (min: number, desc: string, dow: number): CardioTemplateSession => ({
  type: 'zone2', durationMin: min, equipment: 'cycling', dayOfWeek: dow,
  purpose: `Длинная: ${desc} Еда/питьё по часам — репетиция сотни.`,
});
const event = (): CardioTemplateSession => ({
  type: 'miss', durationMin: 270, equipment: 'cycling', dayOfWeek: 6,
  purpose: 'СОБЫТИЕ: 100 км! Стартуйте спокойно, первые 30 км — легче плана, питание каждые 45 мин.',
});

const WEEKS: CardioTemplateWeek[] = [
  { sessions: [ss(60, '2×15 мин темп / 5 мин.', 2), z2(60, 'ровно.', 3), long(100, 'первая сотня минут.', 5), rec(30, 6)], phase: 'base', note: 'База: длинная ×60%, темповые включения короткие.' },
  { sessions: [ss(70, '3×15 мин темп / 5 мин.', 2), z2(60, 'ровно.', 3), long(110, '+10 мин.', 5), rec(30, 6)], phase: 'base' },
  { sessions: [ss(75, '3×20 мин темп / 5 мин.', 2), z2(60, 'ровно.', 3), long(120, 'два часа.', 5), rec(30, 6)], phase: 'build', note: 'Пик первой волны — затем разгрузка.' },
  { sessions: [rec(45, 2), z2(60, 'легко.', 3), long(80, 'укороченная.', 5), rec(25, 6)], phase: 'base', deload: true, note: 'Делод −30%: темп не катаем.' },
  { sessions: [ss(80, '3×20 мин / 5 мин.', 2), z2(60, 'ровно.', 3), long(150, '2.5 часа.', 5), rec(30, 6)], phase: 'build', note: 'Возврат: длинная растит время в седле.' },
  { sessions: [ss(90, '2×30 мин / 5 мин.', 2), z2(60, 'ровно.', 3), long(165, '2 ч 45 мин.', 5), rec(30, 6)], phase: 'build' },
  { sessions: [ss(90, '3×20 мин / 5 мин.', 2), z2(75, 'ровно.', 3), long(180, '3 часа — пик.', 5), rec(30, 6)], phase: 'build', note: 'Пик объёма: 3 часа в седле, отработайте питание.' },
  { sessions: [rec(45, 2), z2(60, 'легко.', 3), long(100, 'укороченная.', 5), rec(25, 6)], phase: 'base', deload: true, note: 'Делод перед taper: впитываем нагрузку.' },
  { sessions: [z2(50, 'лёгкое.', 2), rec(30, 3), rec(25, 5), long(120, 'подводка: 2 часа ровно.', 6)], phase: 'taper', taper: true, note: 'Taper: объём −35%, привычные ноги.' },
  { sessions: [rec(30, 2), rec(30, 3), rec(25, 5), event()], phase: 'peak', taper: true, note: 'Неделя события: отдых и 100 км!' },
];

export const CARDIO_BIKE_CENTURY_10: CardioCycleTemplate = {
  meta: {
    id: 'cardio-bike-century-10',
    title: '100 км (вело) — 10 недель',
    goal: 'health',
    goalFit: ['health', 'maintenance', 'cut'],
    weeks: 10,
    sessionsPerWeek: 4,
    level: ['intermediate', 'advanced'],
    sport: 'bike',
    period: 'mixed',
    equipment: ['cycling'],
    lowImpact: true,
    kind: 'explicit',
    description: 'Подготовка к сотне: длинная прогрессия до 3 ч, темп 85-90% FTP, taper 2 нед и событие 100 км.',
    howItWorks: 'Ср — темп, Чт лёгкое, Сб длинная (+10-15 мин/нед), Вс recovery; делоды на 4/8; нед.9-10 — taper и событие.',
    conditions: ['Катаетесь 60 мин непрерывно', 'Вело + шлем, желательно пульсометр/мощность'],
    tags: ['bike', 'century', 'sportive', 'endurance', 'long-ride', 'pro'],
    deloadWeeks: [4, 8],
    taperWeeks: [9, 10],
    sourceLabel: 'British Cycling century/sportive канон + Friel: длинная +40% за блок, taper 2 нед',
  },
  preset: { goal: 'health', totalWeeks: 10, daysAvailable: 4, level: 'intermediate', equipment: ['cycling'], lowImpact: true },
  weeks: WEEKS,
};
