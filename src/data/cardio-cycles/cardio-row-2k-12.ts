/**
 * cardio-row-2k-12.ts — Concept2 2K 12 недель (3+1 д/нед, гребля).
 * Разметка по Concept2 2K Erg Test 12-Week Plan: цикл 1 (нед.1-4) →
 * цикл 2 (нед.5-8) → повтор цикла 2 (нед.9-12); интервалы 4×4м/2м →
 * 6×4м → 3×6м/8×2м → 12×1м; тесты 2к на 1-й и 8-й; темп — по среднему
 * сплиту прошлых тренировок (прогрессия дословно по источнику).
 */
import type { CardioCycleTemplate, CardioTemplateSession, CardioTemplateWeek } from './cardio-cycle-types';

const row = (d: number, p: string, workSec?: number, restSec?: number, reps?: number, dow?: number): CardioTemplateSession => ({
  type: workSec ? 'hiit' : 'zone2', durationMin: d, equipment: 'rowing', purpose: p, dayOfWeek: dow,
  structured: workSec && restSec && reps ? [{ workSec, restSec, reps, target: 'pace', note: 'Сплит /500м: средний темп прошлой такой тренировки, чуть быстрее' }] : undefined,
});
const steady = (d: number, p: string, dow?: number): CardioTemplateSession => ({ type: 'zone2', durationMin: d, equipment: 'rowing', purpose: p, dayOfWeek: dow });

const W: Array<[string, Array<ReturnType<typeof row>>]> = [
  ['Стартовый тест 2000 м: не стартуйте резко, вторую половину — быстрее. Запишите время и средний сплит.', [
    row(20, 'ТЕСТ 2000 м — запишите время и средний сплит /500м.', undefined, undefined, undefined, 0),
    row(26, 'Интервалы 4×4 мин / 2 мин лёгкой гребли.', 240, 120, 4, 2),
    row(24, 'Интервалы 6×2 мин / 1 мин.', 120, 60, 6, 4),
  ]],
  ['Рост: 5×4 мин + длинные интервалы 6 мин.', [
    row(30, 'Интервалы 5×4 мин / 2 мин.', 240, 120, 5, 0),
    row(30, 'Интервалы 3×6 мин / 3 мин.', 360, 180, 3, 2),
    row(26, 'Интервалы 8×2 мин / 1 мин.', 120, 60, 8, 4),
  ]],
  ['Объём: 6×4 мин + 4×6 мин + 10×2 мин.', [
    row(34, 'Интервалы 6×4 мин / 2 мин.', 240, 120, 6, 0),
    row(36, 'Интервалы 4×6 мин / 3 мин.', 360, 180, 4, 2),
    row(30, 'Интервалы 10×2 мин / 1 мин.', 120, 60, 10, 4),
  ]],
  ['Скорость: короткие 3 мин + 5 мин + 12×1 мин.', [
    row(26, 'Интервалы 6×3 мин / 2 мин.', 180, 120, 6, 0),
    row(28, 'Интервалы 4×5 мин / 3 мин.', 300, 180, 4, 2),
    row(24, 'Интервалы 12×1 мин / 1 мин.', 60, 60, 12, 4),
  ]],
];

function buildWeek(w: number): CardioTemplateWeek {
  const cycle = w <= 4 ? 0 : 1;
  const [note, sessions] = W[cycle === 0 ? w - 1 : Math.min(3, w - 5)];
  const isTest = w === 1 || w === 8;
  const list: CardioTemplateSession[] = sessions.map(s => ({ ...s }));
  if (w === 8) {
    list[0] = row(20, 'КОНТРОЛЬНЫЙ ТЕСТ 2000 м — по гоночному плану на сплите тренировок.', undefined, undefined, undefined, 0);
  }
  const opt4 = [20, 25, 30, 35, 40, 45, 45, 40, 45, 50, 50, 40][w - 1];
  list.push(steady(opt4, `Опциональная 4-я: ровная гребля ${opt4} мин в постоянном сплите.`, 6));
  return { sessions: list, phase: w >= 11 ? 'taper' : w <= 4 ? 'base' : 'build', taper: w >= 11 || undefined, note: `${isTest ? 'Тестовая неделя. ' : ''}${note}` };
}

const weeks: CardioTemplateWeek[] = Array.from({ length: 12 }, (_, i) => buildWeek(i + 1));

export const CARDIO_ROW_2K_12: CardioCycleTemplate = {
  meta: {
    id: 'cardio-row-2k-12',
    title: 'Гребля 2K — 12 недель (Concept2, 3+1 д/нед)',
    goal: 'health',
    goalFit: ['health', 'maintenance', 'cut'],
    weeks: 12,
    sessionsPerWeek: 3,
    sessionsPerWeekMax: 4,
    level: ['beginner', 'intermediate', 'advanced'],
    sport: 'row',
    period: 'build',
    equipment: ['rowing'],
    lowImpact: true,
    kind: 'explicit',
    description: 'С нуля до быстрого 2000 м: интервалы 4×4 → 12×1 мин + тесты; темп — по среднему сплиту.',
    howItWorks: 'Цикл 1 (нед.1-4) → цикл 2 (5-8) → повтор цикла 2 (9-12); 8-я неделя — контрольный тест; 11-12 — подводка.',
    conditions: ['Гребной тренажёр (Concept2)', '3 д/нед (+1 опционально)', 'Темп 24-30 гр/мин'],
    tags: ['row', 'erg', '2k', 'intervals', 'low-impact'],
    taperWeeks: [11, 12],
    sourceLabel: 'Concept2 Training for a 2K Rowing Ergometer Test — 12 Week Plan',
  },
  preset: { goal: 'health', totalWeeks: 12, daysAvailable: 4, level: 'intermediate', equipment: ['rowing'], lowImpact: true },
  weeks,
};
