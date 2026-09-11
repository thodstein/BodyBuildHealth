/**
 * cardio-pro-first-finish-16.ts — ГОТОВЫЙ ЦИКЛ: FIRST-to-the-Finish
 * (Furman/Harvard), 16 недель марафона для бегущих на результат.
 * Дословно по таблице источника (обратный отсчёт 16→гонка): 3 ключевые
 * тренировки в неделю — K1 скорость, K2 темп, K3 long; темпы от PMP
 * (прогнозный темп марафона): ST короткий темп, MT средний, LT порог.
 * Разминка 10-20 мин + заминка 10 мин к каждой K1. Длинные: PMP+10…+60 с/милю.
 * K2/K3 ниже — дословные связки источника (дистанция + темп).
 */
import type { CardioCycleTemplate, CardioTemplateSession, CardioTemplateWeek } from './cardio-cycle-types';

const LEGEND = 'Темпы: PMP — ваш прогноз марафона; ST — короткий темп; MT — средний темп; LT — порог.';
const MIN_PER_MI_EASY = 10;
const MIN_PER_MI_Q = 9;

interface W { k1: string; k1min: number; k2: string; k2mi: number; k3: string; k3mi: number; }

const TABLE: W[] = [
  { k1: '3×1600 м, отдых 1 мин', k1min: 45, k2: '6 миль: 2 легко + 2 в ST + 2 легко', k2mi: 6, k3: '13 миль в PMP+30 с/милю', k3mi: 13 },
  { k1: '4×800 м, отдых 2 мин', k1min: 40, k2: '7 миль: 1 легко + 5 в PMP + 1 легко', k2mi: 7, k3: '15 миль в PMP+45 с/милю', k3mi: 15 },
  { k1: 'Лестница 1200-1000-800-600-400 м, отдых 200 м', k1min: 45, k2: '7 миль: 1 легко + 5 в LT + 1 легко', k2mi: 7, k3: '17 миль в PMP+45 с/милю', k3mi: 17 },
  { k1: '5×1000 м, отдых 400 м', k1min: 45, k2: '6 миль: 1 легко + 4 в MT + 1 легко', k2mi: 6, k3: '20 миль в PMP+45–60 с/милю', k3mi: 20 },
  { k1: '3×1600 м, отдых 1 мин', k1min: 45, k2: '6 миль: 2 легко + 3 в ST + 1 легко', k2mi: 6, k3: '18 миль в PMP+45–60 с/милю', k3mi: 18 },
  { k1: '2×1200 м (2 мин) + 4×800 м (2 мин)', k1min: 45, k2: '5 миль в MT', k2mi: 5, k3: '20 миль в PMP+45–60 с/милю', k3mi: 20 },
  { k1: '6×800 м, отдых 1:30', k1min: 40, k2: '8 миль: 1 легко + 6 в LT + 1 легко', k2mi: 8, k3: '13 миль в PMP+15 с/милю', k3mi: 13 },
  { k1: '2 сета 6×400 м (1:30; между сетами 2:30)', k1min: 45, k2: '6 миль: 2 легко + 3 в ST + 1 легко', k2mi: 6, k3: '18 миль в PMP+30 с/милю', k3mi: 18 },
  { k1: '1 миля (400 м) + 2 мили (800 м) + 2×800 м (400 м)', k1min: 50, k2: '6 миль: 1 легко + 4 в MT + 1 легко', k2mi: 6, k3: '20 миль в PMP+30–45 с/милю', k3mi: 20 },
  { k1: '3 сета 2×1200 м (2 мин; между сетами 4 мин)', k1min: 50, k2: '10 миль в PMP', k2mi: 10, k3: '15 миль в PMP+20 с/милю', k3mi: 15 },
  { k1: '1K-2K-1K-1K, отдых 400 м', k1min: 45, k2: '6 миль: 1 легко + 5 в MT', k2mi: 6, k3: '20 миль в PMP+30–45 с/милю', k3mi: 20 },
  { k1: '3×1600 м, отдых 400 м', k1min: 45, k2: '10 миль в PMP', k2mi: 10, k3: '15 миль в PMP+10 с/милю', k3mi: 15 },
  { k1: '10×400 м, отдых 400 м', k1min: 40, k2: '8 миль в PMP', k2mi: 8, k3: '20 миль в PMP+30 с/милю', k3mi: 20 },
  { k1: '8×800 м, отдых 1:30', k1min: 40, k2: '5 миль в MT', k2mi: 5, k3: '13 миль в PMP', k3mi: 13 },
  { k1: '5×1000 м, отдых 400 м', k1min: 40, k2: '6 миль: 2 легко + 3 в ST + 1 легко', k2mi: 6, k3: '8–10 миль в PMP', k3mi: 9 },
  { k1: '6×400 м, отдых 400 м', k1min: 30, k2: '3 мили в PMP', k2mi: 3, k3: 'МАРАФОН 26.2 мили в темпе марафона', k3mi: 26.2 },
];

function buildWeek(w: number): CardioTemplateWeek {
  const t = TABLE[w - 1];
  const race = w === 16;
  const sessions: CardioTemplateSession[] = [
    {
      type: 'hiit', durationMin: t.k1min, equipment: 'running', dayOfWeek: 1,
      purpose: `K1 скорость: ${t.k1}. Разминка 10-20 мин + заминка 10 мин.`,
      structured: [{ workSec: 300, restSec: 120, reps: 5, target: 'pace', note: `Скорость: ${t.k1}` }],
    },
    { type: 'miss', durationMin: Math.round(t.k2mi * MIN_PER_MI_Q), equipment: 'running', dayOfWeek: 3, purpose: `K2 темп: ${t.k2}.` },
    race
      ? { type: 'hiit', durationMin: 240, equipment: 'running', dayOfWeek: 5, purpose: `K3: ${t.k3}!` }
      : { type: 'zone2', durationMin: Math.round(t.k3mi * MIN_PER_MI_EASY), equipment: 'running', dayOfWeek: 5, purpose: `K3 long: ${t.k3}.` },
  ];
  const phase = race ? 'peak' : w >= 14 ? 'taper' : 'build';
  return {
    sessions, phase, taper: w >= 14 || undefined,
    note: race ? 'День марафона!' : w === 4 || w === 6 ? 'Long 20 миль.' : undefined,
  };
}

const weeks: CardioTemplateWeek[] = Array.from({ length: 16 }, (_, i) => buildWeek(i + 1));

export const CARDIO_PRO_FIRST_FINISH_16: CardioCycleTemplate = {
  meta: {
    id: 'cardio-pro-first-finish-16',
    title: 'FIRST на результат — 16 недель (3 ключа + кросс)',
    goal: 'health',
    goalFit: ['health', 'maintenance'],
    weeks: 16,
    sessionsPerWeek: 3,
    sessionsPerWeekMax: 5,
    level: ['intermediate', 'advanced'],
    sport: 'run',
    period: 'build',
    equipment: ['running'],
    lowImpact: false,
    kind: 'explicit',
    description: 'Марафон на результат тремя тренировками: скорость + темп + long от PMP; плюс 2 кросса.',
    howItWorks: `Вт K1 + Чт K2 + Сб K3; Вт/Чт кросс по желанию. ${LEGEND}`,
    conditions: ['Знаете PMP (прогноз марафона)', '3 бега + 2 кросса в неделю'],
    tags: ['run', 'marathon', 'first', 'pmp', 'advanced', 'pro'],
    taperWeeks: [14, 15, 16],
    sourceLabel: 'FIRST-to-the-Finish veteran marathon program, Harvard (таблица 16→гонка)',
  },
  preset: { goal: 'health', totalWeeks: 16, daysAvailable: 5, level: 'advanced', equipment: ['running'], periodizationModel: 'linear' },
  weeks,
};
