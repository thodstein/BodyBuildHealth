/**
 * cardio-pro-ssb-lv-6.ts — ГОТОВЫЙ ЦИКЛ: TrainerRoad Sweet Spot Base
 * Low Volume I, 6 недель (3 заезда/нед, 3-4 ч).
 * Дословно по структуре источника: нед.1 — Ramp Test + Acho (вводный SS)
 * + Mono 90 мин (over-under); нед.2-5 — прогрессия SS (Ericsson 4×8 →
 * Carson 6×5-7 → Eclipse 3×20 мин в 88-94% FTP) + over-under выходных
 * + endurance Pettit (1 ч, каденс-драйлы); нед.5 — пик перед разгрузкой;
 * нед.6 — recovery. Разминка 15 мин + заминка 5 мин к каждой SS.
 */
import type { CardioCycleTemplate, CardioTemplateSession, CardioTemplateWeek } from './cardio-cycle-types';

const SS = 'Sweet Spot 88-94% FTP (субпорог — в нашей системе tempo/MISS, не HIIT).';
const ss = (min: number, desc: string, workSec: number, restSec: number, reps: number, dow: number): CardioTemplateSession => ({
  type: 'miss', durationMin: min, equipment: 'cycling', dayOfWeek: dow,
  purpose: `${desc} ${SS} Разминка 15 мин + заминка 5 мин.`,
  structured: [{ workSec, restSec, reps, target: 'power', note: `${desc} (88-94% FTP)` }],
});
const ou = (min: number, desc: string, dow: number): CardioTemplateSession => ({
  type: 'miss', durationMin: min, equipment: 'cycling', dayOfWeek: dow,
  purpose: `${desc} Over-under: чередование ~95% / ~105% FTP.`,
  structured: [{ workSec: 600, restSec: 120, reps: 3, target: 'power', note: `${desc} (95/105% FTP)` }],
});
const end = (min: number, desc: string, dow: number): CardioTemplateSession => ({
  type: 'zone2', durationMin: min, equipment: 'cycling', dayOfWeek: dow, purpose: `${desc} Endurance: каденс-драйлы, питание на ходу.`,
});
const test = (): CardioTemplateSession => ({
  type: 'hiit', durationMin: 30, equipment: 'cycling', dayOfWeek: 1,
  purpose: 'Ramp Test: оценка FTP. Выспаться, разминка, рампа до отказа.',
  structured: [{ workSec: 60, restSec: 0, reps: 20, target: 'power', note: 'Рампа +1 ступень/мин до отказа' }],
});

const WEEKS: CardioTemplateWeek[] = [
  { sessions: [test(), ss(60, 'Acho: вводный SS 3×10 мин / 5 мин.', 600, 300, 3, 3), ou(90, 'Mono 90 мин: длинные tempo-связки + threshold.', 5)], phase: 'base', note: 'Тест FTP + знакомство с SS.' },
  { sessions: [ss(60, 'Ericsson: 4×8 мин / 4 мин.', 480, 240, 4, 1), end(60, 'Pettit 1 ч: endurance + изолированная нога/спринты формы.', 3), ou(75, 'Over-under выходных.', 5)], phase: 'base' },
  { sessions: [ss(60, 'Carson: 6×5-7 мин / 4 мин.', 360, 240, 6, 1), end(60, 'Pettit: экономичность педалирования.', 3), ou(90, 'Over-under: переключения 95/105%.', 5)], phase: 'build', note: 'Драйлы leg-speed: меньше — лучше.' },
  { sessions: [ss(70, 'Warlow: удлинённый SS.', 600, 300, 4, 1), end(60, 'Endurance 1 ч.', 3), ou(90, 'Threshold выходного дня.', 5)], phase: 'build', note: 'Усталость первых 3 нед — норма.' },
  { sessions: [ss(75, 'Eclipse-подвод: 2×20 мин / 5 мин.', 1200, 300, 2, 1), end(60, 'Endurance 1 ч.', 3), ou(90, 'Over-under пик.', 5)], phase: 'build', note: 'Пик перед разгрузкой — самая тяжёлая.' },
  { sessions: [end(60, 'Pettit: лёгкий endurance.', 1), end(45, 'Лёгкое катание 45 мин.', 3), end(60, 'Endurance 1 ч без интенсивности.', 5)], phase: 'base', deload: true, note: 'Recovery: −40-50% объёма, ноль интенсивности.' },
];

export const CARDIO_PRO_SSB_LV_6: CardioCycleTemplate = {
  meta: {
    id: 'cardio-pro-ssb-lv-6',
    title: 'Sweet Spot Base LV — 6 недель (вело по мощности)',
    goal: 'health',
    goalFit: ['health', 'maintenance', 'cut'],
    weeks: 6,
    sessionsPerWeek: 3,
    level: ['beginner', 'intermediate'],
    sport: 'bike',
    period: 'base',
    equipment: ['cycling'],
    lowImpact: true,
    kind: 'explicit',
    description: 'База TrainerRoad: 3 заезда в неделю, SS 88-94% FTP от 3×10 до 2×20 мин + тест и разгрузка.',
    howItWorks: 'Вт SS + Чт endurance + Сб SS/O-U; нед.1 — Ramp Test; нед.6 — recovery. Нужен измеритель мощности.',
    conditions: ['Велостанок + измеритель мощности', 'Знаете FTP', '3×/нед по 60-90 мин'],
    tags: ['bike', 'sweet-spot', 'ftp', 'trainerroad', 'low-impact', 'pro'],
    deloadWeeks: [6],
    sourceLabel: 'TrainerRoad Sweet Spot Base I Low Volume (Ramp/Acho/Mono/Ericsson/Carson/Eclipse/Pettit)',
  },
  preset: { goal: 'health', totalWeeks: 6, daysAvailable: 3, level: 'beginner', equipment: ['cycling'], lowImpact: true },
  weeks: WEEKS,
};
