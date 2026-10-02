/**
 * cardio-pro-tri-olympic-12.ts — ГОТОВЫЙ ЦИКЛ: олимпийский триатлон
 * (1500 м / 40 км / 10 км), 12 недель, 5 дней/нед.
 * Структура по канону олимпийской подготовки (Triathlete/British
 * Triathlon: база 4 нед → билд 4 нед с кирпичами → пик 2 нед → taper
 * 2 нед; правило «одна длинная на вид в неделю», кирпич вело→бег
 * каждую неделю билда; зоны RPE 1-5, каденс вело 85-95, транзиты).
 *   Вт — плавание, Ср — бег, Чт — вело, Сб — плавание, Вс — кирпич.
 */
import type { CardioCycleTemplate, CardioTemplateSession, CardioTemplateWeek } from './cardio-cycle-types';

const RPE = 'Зоны RPE: Z1 легко · Z2 разговорно · Z3 быстро-хорошо · Z4 тяжело · Z5 максимум.';
const swim = (min: number, desc: string, dow: number): CardioTemplateSession => ({
  type: 'zone2', durationMin: min, equipment: 'swimming', dayOfWeek: dow, purpose: `Заплыв: ${desc} ${RPE}`,
});
const run = (min: number, desc: string, dow: number, hard = false): CardioTemplateSession => ({
  type: hard ? 'hiit' : /Z3/.test(desc) ? 'miss' : 'zone2',
  durationMin: min, equipment: 'running', dayOfWeek: dow, purpose: `Бег: ${desc}`,
});
const bike = (min: number, desc: string, dow: number, hard = false): CardioTemplateSession => ({
  type: hard ? 'hiit' : /Z3/.test(desc) ? 'miss' : 'zone2', durationMin: min, equipment: 'cycling', dayOfWeek: dow,
  purpose: `Вело ${min} мин: ${desc} Каденс 85-95 RPM.`,
});
const brick = (bikeMin: number, bikeDesc: string, runMin: number, runDesc: string, dow: number): CardioTemplateSession[] => [
  { ...bike(bikeMin, `${bikeDesc} + переход <3 мин (к 8-й нед <2 мин)`, dow), purpose: `Вело ${bikeMin} мин: ${bikeDesc}. Переход <3 мин!` },
  { ...run(runMin, `Сразу с вела: ${runDesc}`, dow), purpose: `Кирпич-бег ${runMin} мин сразу с вела: ${runDesc}.` },
];
const rec = (min: number, dow: number): CardioTemplateSession => ({
  type: 'recovery', durationMin: min, equipment: 'cycling', dayOfWeek: dow, purpose: 'Recovery-катание: ноги прокрутить.',
});

const WEEKS: CardioTemplateWeek[] = [
  { sessions: [swim(30, '16×25 (30"), ровно. Z1', 1), run(30, 'ровно Z1.', 2), bike(45, 'Ровно Z1.', 3), swim(30, '10×50 (45"), Z1', 5), ...brick(40, 'Ровно Z1', 15, 'Z1, ровно', 6)], phase: 'base', note: 'Втягивание: заканчивайте легко, стартуйте медленно.' },
  { sessions: [swim(30, '20×25 (30") Z1.', 1), run(32, '20 мин Z1 + 12 мин Z2.', 2), bike(52, '20 Z1 + 32 Z2.', 3), swim(30, '12×50 (35") Z1', 5), ...brick(46, 'Z1, 90-95 RPM', 15, 'Z2, ровно', 6)], phase: 'base' },
  { sessions: [swim(35, '8×75 (40") Z2.', 1), run(35, '10 Z1 + 25 Z2.', 2), bike(58, '20 Z1 + 38 Z2.', 3), swim(35, '4×100 (45") Z2 + 6×50 (30") Z3', 5), ...brick(52, 'Z1-Z2, 90-95 RPM', 15, 'Z2, ровно', 6)], phase: 'base', note: 'Пик базы — дальше разгрузка.' },
  { sessions: [rec(25, 1), run(25, 'легко Z1, ровно.', 2), bike(40, 'лёгкое Z1.', 3), swim(25, 'только техника Z1.', 5), ...brick(25, 'совсем легко', 10, 'Z1, вкат', 6)], phase: 'base', deload: true, note: 'Делод −35%: объём срезан, интенсивности нет.' },
  { sessions: [swim(35, '12×75 (25"): 6 Z2 + 6 Z3.', 1), run(40, '20 Z1 + 20 Z2, пересечёнка.', 2), bike(65, '20 Z1 + 45 Z2, холмы.', 3), swim(35, '10×100 (25") Z2.', 5), ...brick(55, 'Ровно Z1, 90-100 RPM', 18, 'Z2, ровно', 6)], phase: 'build', note: 'Первый полноценный кирпич — учитесь бежать «с вела».' },
  { sessions: [swim(35, '2×200 (30") + 4×100 (20") Z2.', 1), run(42, '15 Z1 + 25 Z2, холмы.', 2), bike(70, '20 Z1 + 30 Z2 + 20 Z2.', 3), swim(35, '500 нон-стоп (2 мин) + 5×100 (20") Z2.', 5), ...brick(60, 'Z1, 90-100 RPM', 20, 'Z2, ровно', 6)], phase: 'build', note: 'Питание и питьё гонки — отрабатывайте сейчас.' },
  { sessions: [swim(40, '1000 м нон-стоп Z2.', 1), run(45, '15 Z1 + 20 Z2 + 10 Z3.', 2), bike(75, '20 Z1 + 40 Z2 + 15 Z3, 90-95 RPM.', 3), swim(35, '5×200 (30"): №4-5 Z3.', 5), ...brick(65, '20 Z1 + 30 Z3 + 15 Z1', 20, '10 Z3 + 10 Z2', 6)], phase: 'build', note: 'Объёмный пик билда.' },
  { sessions: [rec(30, 1), run(30, 'легко Z1-Z2.', 2), bike(45, 'лёгкое Z1.', 3), swim(30, 'техника 1200 м Z1.', 5), ...brick(35, 'легко Z1', 12, 'Z1', 6)], phase: 'base', deload: true, note: 'Делод: впитываем билд.' },
  { sessions: [swim(40, '1500 м нон-стоп — контроль.', 1), run(45, '15 Z1 + 20 Z2, пересечёнка.', 2), bike(80, '20 Z1 + 45 Z2 + 15 Z3, 90-95 RPM.', 3), swim(40, '4×400 (40") Z2.', 5), ...brick(70, '20 Z1 + 35 Z2 + 15 Z3', 22, '12 Z3 + 10 Z2', 6)], phase: 'build', note: 'Специфика: плавание в темпе цели 1500.' },
  { sessions: [swim(40, '1000 Z2 + 10×50 (20"): 25 Z4 / 25 Z1.', 1), run(35, '15 Z1 + 10 Z3 + 5 Z4 + 5 Z2.', 2, true), bike(70, '20 Z1 + 2×(5 Z3 / 2.5 Z2 / 5 Z4 / 2.5 Z2) + 10 Z1, 95 RPM.', 3, true), swim(35, '5×200 (30"): №4-5 Z4.', 5), ...brick(50, '15 Z1 + 15 Z3 + 10 Z4', 20, '10 Z4 + 5 Z3 + 5 Z1', 6)], phase: 'peak', taper: true, note: 'Скоростная неделя: коротко и остро, без накопления.' },
  { sessions: [swim(30, '500 Z1→Z2 + 10×50 (20"): 25 быстро / 25 легко.', 1), run(30, '15 Z1 + 3×3 мин Z3 (пауза 2) + 5 Z1.', 2), bike(50, '15 Z1 + 3×(5 Z3 / 3 Z1) + 10 Z1.', 3), swim(25, 'лёгкое 800 м.', 5), ...brick(30, '15 Z1 + 10 Z3 + 5 Z1', 15, '5 Z3 + 5 Z2 + 5 Z1', 6)], phase: 'taper', taper: true, note: 'Taper: объём −60%, острые касания темпа.' },
  { sessions: [swim(20, '200 Z1 + 8×50: 25 быстро / 25 легко + 100 Z1.', 1), run(18, '12 Z1 + 3 Z3 + 3 Z1.', 2), bike(25, '15 Z1 + 2×2.5 мин Z3, 95 RPM.', 3), swim(15, 'раскатка 500 м.', 5), { type: 'hiit', durationMin: 150, equipment: 'running', dayOfWeek: 6, purpose: 'СТАРТ: олимпийский триатлон — 1500 м / 40 км / 10 км! Раскладка: плывите ровно, вело первые 10 км спокойно, бегите по ощущению.' } ], phase: 'peak', taper: true, note: 'Taper + старт. Разложите экипировку и транзит заранее.' },
];

export const CARDIO_PRO_TRI_OLYMPIC_12: CardioCycleTemplate = {
  meta: {
    id: 'cardio-pro-tri-olympic-12',
    title: 'Олимпийский триатлон — 12 недель (1.5 км / 40 км / 10 км)',
    goal: 'health',
    goalFit: ['health', 'maintenance'],
    weeks: 12,
    sessionsPerWeek: 5,
    level: ['intermediate', 'advanced'],
    sport: 'mixed',
    period: 'mixed',
    equipment: ['swimming', 'cycling', 'running'],
    lowImpact: false,
    kind: 'explicit',
    description: 'Полная олимпийская дистанция: 2 заплыва + вело/бег + кирпич каждую неделю, taper 2 нед и старт.',
    howItWorks: 'Вс — кирпич (вело→бег), Вт/Сб — плавание, Ср — бег, Чт — вело; делоды на 4/8; нед.10 пик, нед.12 — старт.',
    conditions: ['Плывёте 400 м без остановки', 'Вело 60 мин + бег 30 мин непрерывно', '5 д/нед'],
    tags: ['triathlon', 'olympic', 'swim', 'bike', 'run', 'brick', 'pro'],
    deloadWeeks: [4, 8],
    taperWeeks: [11, 12],
    sourceLabel: 'Triathlete/British Triathlon olympic-distance канон (база-билд-пик-taper + weekly brick)',
  },
  preset: { goal: 'health', totalWeeks: 12, daysAvailable: 5, level: 'intermediate', equipment: ['swimming', 'cycling', 'running'] },
  weeks: WEEKS,
};
