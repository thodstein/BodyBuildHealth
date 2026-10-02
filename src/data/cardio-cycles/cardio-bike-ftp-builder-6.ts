/**
 * cardio-bike-ftp-builder-6.ts — ГОТОВЫЙ ЦИКЛ: FTP Builder, 6 недель
 * (3 заезда/нед): порог и sweet spot по мощности.
 * Структура по канону пороговой подготовки велосипедиста (FasCat
 * «Threshold progression»; TrainerRoad Sweet Spot: 3×10 → 2×20 → 3×15
 * @ 88-94% FTP; over-under 95/105% FTP для подъёма порога; Coggan
 * «Training and Racing with a Power Meter»: FTP-тест 5 мин + 20 мин ×0.95):
 *   Вт — SS/порог, Чт — endurance Z2, Сб — SS/over-under; делод на 4-й,
 *   FTP-тест на 1-й и 6-й (сравнить результат блока).
 */
import type { CardioCycleTemplate, CardioTemplateSession, CardioTemplateWeek } from './cardio-cycle-types';

const SS = 'Sweet Spot 88-94% FTP: тяжело, но контролируемо (в нашей сетке — tempo/miss).';
const RW = 'Разминка 15 мин + заминка 5 мин.';
const ss = (min: number, desc: string, workSec: number, restSec: number, reps: number, dow: number): CardioTemplateSession => ({
  type: 'miss', durationMin: min, equipment: 'cycling', dayOfWeek: dow,
  purpose: `${RW} ${desc} ${SS}`,
  structured: [{ workSec, restSec, reps, target: 'power', note: `${desc} (88-94% FTP)` }],
});
const ou = (min: number, desc: string, dow: number): CardioTemplateSession => ({
  type: 'miss', durationMin: min, equipment: 'cycling', dayOfWeek: dow,
  purpose: `${RW} ${desc} Over-under: чередование ~95% / ~105% FTP.`,
  structured: [{ workSec: 600, restSec: 120, reps: 3, target: 'power', note: `${desc} (95/105% FTP)` }],
});
const end = (min: number, desc: string, dow: number): CardioTemplateSession => ({
  type: 'zone2', durationMin: min, equipment: 'cycling', dayOfWeek: dow,
  purpose: `Endurance Z2: ${desc} Каденс 85-95, ровно, разговорно.`,
});
const ftpTest = (desc: string): CardioTemplateSession => ({
  type: 'hiit', durationMin: 40, equipment: 'cycling', dayOfWeek: 1,
  purpose: `FTP-тест: ${desc} Протокол: разминка 15 мин + 5 мин all-out + 10 мин лёгкие + 20 мин на максимум; FTP = 0.95 × средняя мощность 20 мин.`,
  structured: [{ workSec: 1200, restSec: 0, reps: 1, target: 'power', note: '20 мин на максимум' }],
});

const WEEKS: CardioTemplateWeek[] = [
  { sessions: [ftpTest('исходный, до блока.'), ss(60, 'Acho: вводный SS 3×10 мин / 5 мин.', 600, 300, 3, 3), end(100, 'база.', 5)], phase: 'base', note: 'Стартовый тест: запишите FTP и ватты SS.' },
  { sessions: [ss(60, 'Ericsson: 3×12 мин / 4 мин.', 720, 240, 3, 1), end(75, 'экономичное педалирование.', 3), ss(75, '2×20 мин / 5 мин — длинная SS.', 1200, 300, 2, 6)], phase: 'base' },
  { sessions: [ou(75, 'Over-under выходного дня.', 1), end(60, 'лёгкий.', 3), ss(80, '3×15 мин / 5 мин.', 900, 300, 3, 6)], phase: 'build', note: 'Пик объёма пороговой работы.' },
  { sessions: [end(45, 'лёгкое катание.', 1), end(55, 'лёгкое.', 3), end(40, 'совсем легко.', 6)], phase: 'base', deload: true, note: 'Recovery-неделя: −40%, ноль интенсивности.' },
  { sessions: [ss(80, '2×25 мин / 5 мин — удлинённый SS.', 1500, 300, 2, 1), end(75, 'поддержка.', 3), ou(80, 'Over-under: последняя тяжёлая.', 6)], phase: 'build', note: 'Ключевая неделя: терпеть 25-минутные блоки.' },
  { sessions: [ftpTest('итоговый: сравните с исходным.'), end(65, 'лёгкое.', 3), end(60, 'лёгкое, с ног снять усталость.', 6)], phase: 'peak', taper: true, note: 'Taper + повторный FTP-тест.' },
];

export const CARDIO_BIKE_FTP_BUILDER_6: CardioCycleTemplate = {
  meta: {
    id: 'cardio-bike-ftp-builder-6',
    title: 'FTP Builder — 6 недель (порог + sweet spot, вело)',
    goal: 'health',
    goalFit: ['health', 'maintenance', 'cut'],
    weeks: 6,
    sessionsPerWeek: 3,
    level: ['intermediate', 'advanced'],
    sport: 'bike',
    period: 'build',
    equipment: ['cycling'],
    lowImpact: true,
    kind: 'explicit',
    description: 'Порог по мощности: 3×10 → 2×25 мин SS 88-94% FTP + over-under; FTP-тест до и после блока.',
    howItWorks: 'Вт — SS, Чт endurance, Сб — SS/over-under; нед.1 — исходный FTP-тест (5+20 мин), нед.4 делод, нед.6 — повторный тест.',
    conditions: ['Велостанок + измеритель мощности', 'Знаете FTP из теста', '3×/нед по 60-100 мин'],
    tags: ['bike', 'ftp', 'sweet-spot', 'threshold', 'power', 'low-impact', 'pro'],
    deloadWeeks: [4],
    taperWeeks: [6],
    sourceLabel: 'FasCat/TrainerRoad threshold progression + Coggan FTP-тест (5 + 20 мин ×0.95)',
  },
  preset: { goal: 'health', totalWeeks: 6, daysAvailable: 3, level: 'intermediate', equipment: ['cycling'], lowImpact: true },
  weeks: WEEKS,
};
