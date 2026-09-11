/**
 * cardio-pro-pete-full-12.ts — ГОТОВЫЕ ЦИКЛЫ Pete Plan (Pete Marston):
 * A) PETE FULL 12 нед — непрерывный план: 3-недельная ротация ×4.
 * Скорость (4000 м суммарно): нед.A 8×500/3:30; нед.B пирамида
 * 250-500-750-1000-750-500-250 (отдых 1:30 за каждые 250 м работы);
 * нед.C 4×1000/5:00. Порог (7.5-8K): A 5×1500/5:00; B 4×2000/5:00;
 * C waterfall 3K-2.5K-2K/5:00. Плюс steady 8-15K (22-25 spm) и hard
 * distance 5K+. Пейсинг источника: первая попытка — по ближайшей
 * дистанции целиком, все кроме последнего отрезка ровно, последний —
 * максимум; цель следующей — средний темп прошлой.
 * B) построен из той же ротации программно (недели 1-12).
 */
import type { CardioCycleTemplate, CardioTemplateSession, CardioTemplateWeek } from './cardio-cycle-types';

const iv = (min: number, desc: string, workSec: number, restSec: number, reps: number, dow: number): CardioTemplateSession => ({
  type: workSec >= 300 ? 'miss' : 'hiit', durationMin: min, equipment: 'rowing', dayOfWeek: dow,
  purpose: `${desc}. Пейсинг Pete: первая попытка — темп целостной дистанции, последний отрезок — максимум; дальше цель = средний темп.`,
  structured: [{ workSec, restSec, reps, target: 'pace', note: desc }],
});
const steady = (min: number, dow: number, hard = false): CardioTemplateSession => ({
  type: hard ? 'miss' : 'zone2', durationMin: min, equipment: 'rowing', dayOfWeek: dow,
  purpose: hard ? 'Hard distance ~5K+: быстрее steady-дней, темп >25 spm.' : 'Steady 8-15K, 22-25 spm, темп ≥+10 с к пороговым. Отдых — активное восстановление.',
});

const SPEED: Array<[string, number, number, number, number]> = [
  ['8×500 м / отдых 3:30', 40, 110, 210, 8],
  ['Пирамида 250-500-750-1000-750-500-250 м / отдых 1:30 за 250 м работы', 45, 150, 240, 7],
  ['4×1000 м / отдых 5:00', 45, 240, 300, 4],
];
const THRESH: Array<[string, number, number, number, number]> = [
  ['5×1500 м / отдых 5:00', 60, 330, 300, 5],
  ['4×2000 м / отдых 5:00', 65, 440, 300, 4],
  ['Waterfall 3000-2500-2000 м / отдых 5:00', 60, 500, 300, 3],
];

function buildWeek(w: number): CardioTemplateWeek {
  const r = (w - 1) % 3;
  const [sDesc, sMin, sWork, sRest, sReps] = SPEED[r];
  const [tDesc, tMin, tWork, tRest, tReps] = THRESH[r];
  return {
    sessions: [
      iv(sMin, `Скорость: ${sDesc}`, sWork, sRest, sReps, 0),
      steady(55, 1),
      iv(tMin, `Порог: ${tDesc}`, tWork, tRest, tReps, 2),
      steady(55, 3),
      steady(30, 4, true),
      steady(50, 5),
    ],
    phase: 'build',
    note: `Ротация Pete, неделя ${r + 1}/3. Вс — полный отдых (обязателен).`,
  };
}

const weeks: CardioTemplateWeek[] = Array.from({ length: 12 }, (_, i) => buildWeek(i + 1));

export const CARDIO_PRO_PETE_FULL_12: CardioCycleTemplate = {
  meta: {
    id: 'cardio-pro-pete-full-12',
    title: 'Pete Plan — 12 недель (гребля на результат)',
    goal: 'health',
    goalFit: ['health', 'maintenance', 'cut'],
    weeks: 12,
    sessionsPerWeek: 6,
    level: ['intermediate', 'advanced'],
    sport: 'row',
    period: 'build',
    equipment: ['rowing'],
    lowImpact: true,
    kind: 'explicit',
    description: 'Легендарный непрерывный план: скорость + порог + steady с ротацией каждые 3 недели и самонаводящимся пейсингом.',
    howItWorks: 'Пн скорость, Ср порог, Вт/Чт/Сб steady 22-25 spm, Пт hard distance, Вс отдых; каждая сессия повторяется через 3 нед — бьёте свой средний темп.',
    conditions: ['Гребёте 30+ мин непрерывно', 'Знаете сплит 2K/5K', '6 д/нед + отдых'],
    tags: ['row', 'erg', 'pete', 'intervals', 'low-impact', 'pro'],
    sourceLabel: 'The Pete Plan, Pete Marston (ротация 3 нед + пейсинг)',
  },
  preset: { goal: 'health', totalWeeks: 12, daysAvailable: 6, level: 'advanced', equipment: ['rowing'], lowImpact: true },
  weeks,
};
