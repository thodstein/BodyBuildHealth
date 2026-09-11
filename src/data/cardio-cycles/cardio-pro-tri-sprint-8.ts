/**
 * cardio-pro-tri-sprint-8.ts — ГОТОВЫЙ ЦИКЛ: Triathlete 8-Week Sprint
 * (первый спринт: 750 м / 20 км / 5 км), 5 дней/нед.
 * Дословно по дням источника (зоны — RPE 1-5 из ключа плана:
 * Z1 легко, Z2 разговорно, Z3 «быстро-хорошо», Z4 тяжело, Z5 максимум;
 * вело-каденс 80-100 RPM; заплывы в ярдах≈метрах, 25 = длина).
 * Нед.1-2 — втягивание; 3-5 — объём; 6 — пик + кирпичи; 7 — скорость;
 * 8 — taper + старт. Кирпич (brick) = вело + сразу бег.
 */
import type { CardioCycleTemplate, CardioTemplateSession, CardioTemplateWeek } from './cardio-cycle-types';

const RPE = 'Зоны RPE: Z1 легко · Z2 разговорно · Z3 быстро-хорошо · Z4 тяжело · Z5 максимум.';
const swim = (min: number, desc: string, dow: number): CardioTemplateSession => ({
  type: 'zone2', durationMin: min, equipment: 'swimming', dayOfWeek: dow, purpose: `Заплыв: ${desc}. ${RPE}`,
});
const hasZ45 = (desc: string): boolean => desc.includes('Z4') || desc.includes('Z5');
const bike = (min: number, desc: string, dow: number, hard = false): CardioTemplateSession => ({
  // Z3 источника = «быстро-хорошо» (tempo) → miss; HIIT только Z4/Z5.
  type: hasZ45(desc) ? 'hiit' : min >= 55 ? 'miss' : 'zone2', durationMin: min, equipment: 'cycling', dayOfWeek: dow,
  purpose: `Вело ${min} мин: ${desc}. Каденс 80-100 RPM.`,
});
const run = (min: number, desc: string, dow: number, hard = false): CardioTemplateSession => ({
  type: hasZ45(desc) ? 'hiit' : /Z3/.test(desc) ? 'miss' : 'zone2',
  durationMin: min, equipment: 'running', dayOfWeek: dow, purpose: `Бег: ${desc}.`,
});
const brick = (bikeMin: number, bikeDesc: string, runMin: number, runDesc: string, dow: number): CardioTemplateSession[] => [
  { ...bike(bikeMin, `${bikeDesc} + переход <3 мин (к 6-й нед <2 мин)`, dow), purpose: `Вело ${bikeMin} мин: ${bikeDesc}. Переход <3 мин!` },
  { ...run(runMin, `Сразу с вела: ${runDesc}`, dow), purpose: `Кирпич-бег ${runMin} мин сразу с вела: ${runDesc}.` },
];

const WEEKS: CardioTemplateWeek[] = [
  {
    sessions: [
      swim(20, '16×25 (30"), ровно, медленно. Z1', 1),
      run(25, '5×(2 мин ходьба / 3 мин бег Z1), ровно', 2),
      bike(30, 'Ровно, Z1', 3),
      swim(25, '10×50 (45"), Z1', 5),
      run(27, '6×(1.5 мин ходьба / 3.5 мин бег Z1), ровно', 6),
    ],
    phase: 'base', note: 'Втягивание: заканчивайте легко, стартуйте медленно.',
  },
  {
    sessions: [
      swim(25, '24×25 (30") ровно. Z2', 1),
      bike(30, '15 мин Z1 + 15 мин Z2', 2),
      run(24, '2×10 мин (отдых 2 мин ходьбы), Z1, ровно', 3),
      swim(25, '12×50 (35") ровно. Z1', 5),
      bike(45, '15 мин Z1 + 30 мин Z2, холмы', 6),
    ],
    phase: 'base',
  },
  {
    sessions: [
      swim(30, '8×75 (40") ровно. Z2', 1),
      run(20, '10 мин Z1 + 10 мин Z2, холмы', 2),
      bike(55, '20 мин Z1 + 35 мин Z2, 85-95 RPM', 3),
      swim(35, '4×100 (45") Z2 + 6×50 (30") чуть быстрее Z3', 5),
      run(30, 'Ровно, Z1', 6),
    ],
    phase: 'build',
  },
  {
    sessions: [
      swim(35, '12×75 (20"): 6 в Z2 + 6 в Z3', 1),
      run(40, '15 мин Z1 + 25 мин Z2, пересечёнка', 2),
      bike(70, '20 мин Z1 + 50 мин Z2, холмы, 85-95 RPM', 3),
      swim(30, '10×100 (25"), Z2', 5),
      ...brick(45, 'Ровно Z1, 90-100 RPM', 20, 'Z2, ровно', 6),
    ],
    phase: 'build', note: 'Первый кирпич! Готовьте транзитную зону заранее.',
  },
  {
    sessions: [
      swim(35, '2×200 (30") + 4×100 (20"). Всё Z2', 1),
      run(40, '15 мин Z1 + 25 мин Z2, пересечёнка', 2),
      bike(80, '20 мин Z1 + 25 мин Z2 + 15 мин Z3 + 20 мин Z2, 90-95 RPM', 3),
      swim(35, '500 (2 мин) + 5×100 (20"). Всё Z2', 5),
      ...brick(60, 'Z1, 90-100 RPM', 20, 'Z2, ровно', 6),
    ],
    phase: 'build', note: 'Еда/питьё гонки — отрабатывать сейчас.',
  },
  {
    sessions: [
      swim(30, '1000 нон-стоп, Z2', 1),
      run(35, '15 мин Z1 + 10 мин Z3 + 5 мин Z4 + 5 мин Z2, пересечёнка', 2, true),
      bike(60, '15 мин Z1 + 2×(5 мин Z3, 2.5 мин Z2, 5 мин Z4, 2.5 мин Z2) + 15 мин Z1, 90-95 RPM', 3, true),
      swim(30, '10×100 (20"): №3,6,9 быстрее Z4, остальные Z1', 5),
      ...brick(40, '15 мин Z1 + 15 мин Z3 + 10 мин Z4, 90-100 RPM', 20, '10 мин Z4 + 5 мин Z2 + 5 мин Z1', 6),
    ],
    phase: 'build', note: 'Пик: последний тяжёлый блок перед тейпером.',
  },
  {
    sessions: [
      swim(30, '500 Z1→Z2 + 10×50 (20"): 25 быстро Z4 / 25 легко Z1', 1),
      run(35, '15 мин Z1 + 10 мин Z3 + 5 мин Z5 + 5 мин Z2', 2, true),
      bike(60, '15 Z1 + 5 Z3 + 2.5 Z2 + 5 Z4 + 2.5 Z2 + 5×(1 Z5/2 Z1) + 15 Z1, 90-95 RPM', 3, true),
      swim(30, '5×200 (30"): №1 Z1, №2-3 Z2, №4 Z3, №5 Z4', 5),
      ...brick(30, '15 мин Z1 + 10 мин Z3 + 5 мин Z4', 15, '5 мин Z4 + 5 мин Z2 + 5 мин Z1', 6),
    ],
    phase: 'peak', taper: true, note: 'Скоростная неделя: коротко и остро.',
  },
  {
    sessions: [
      swim(20, '200 Z1 + 8×50 (20"): 25 быстро Z4 / 25 легко + 100 Z1', 1),
      run(20, '12 мин Z1 + 3 мин Z3 + 5 мин Z1, ровно', 2),
      bike(30, '15 мин Z1 + 2×(2.5 мин Z3 + 2.5 мин Z2) + 5 мин Z1, 90-95 RPM', 3),
      bike(15, 'Раскатка Z1, 90-95 RPM', 5),
      { type: 'hiit', durationMin: 90, equipment: 'running', dayOfWeek: 6, purpose: 'СТАРТ: спринт 750 м / 20 км / 5 км! Не тестируйте себя на неделе — сберегите на гонку.' },
    ],
    phase: 'peak', taper: true, note: 'Taper + старт. Разложите экипировку заранее.',
  },
];

export const CARDIO_PRO_TRI_SPRINT_8: CardioCycleTemplate = {
  meta: {
    id: 'cardio-pro-tri-sprint-8',
    title: 'Спринт-триатлон — 8 недель (первый старт)',
    goal: 'health',
    goalFit: ['health', 'maintenance'],
    weeks: 8,
    sessionsPerWeek: 5,
    level: ['beginner'],
    sport: 'mixed',
    period: 'mixed',
    equipment: ['swimming', 'cycling', 'running'],
    lowImpact: false,
    kind: 'explicit',
    description: 'Первый спринт 750 м/20 км/5 км: 2 заплыва + чередование вело/бег, кирпичи с 4-й недели.',
    howItWorks: '5 дней/нед по 1 сессии; Вт заплыв, Ср/Чт вело/бег чередуются, Сб заплыв, Вс вело-кирпич; нед.8 — taper.',
    conditions: ['Плывёте 100 м без стресса', 'Вело 20 мин + бег 10 мин непрерывно', '5 д/нед'],
    tags: ['triathlon', 'sprint', 'swim', 'bike', 'run', 'brick', 'pro'],
    taperWeeks: [7, 8],
    sourceLabel: 'Triathlete 8-Week Sprint Triathlon Training Plan (дни 1-в-1)',
  },
  preset: { goal: 'health', totalWeeks: 8, daysAvailable: 5, level: 'beginner', equipment: ['swimming', 'cycling', 'running'] },
  weeks: WEEKS,
};
