/**
 * cardio-run-couch-half-15.ts — Couch-to-Half 15 недель (Marathon Handbook).
 * Фазы: 5K (walk/run) → 10K (RPE 3-4) → Half (long 8 → 17 км);
 * недели 4/8/12 — сброс; нед.15 — подводка + старт.
 */
import type { CardioCycleTemplate, CardioTemplateSession, CardioTemplateWeek } from './cardio-cycle-types';

const ez = (d: number, p: string, dow?: number): CardioTemplateSession => ({ type: 'zone2', durationMin: d, equipment: 'running', purpose: p, dayOfWeek: dow });
const wr = (runMin: number, walkMin: number, reps: number, totalMin: number, dow?: number): CardioTemplateSession => ({
  type: 'zone2', durationMin: totalMin, equipment: 'running', dayOfWeek: dow,
  purpose: `Чередование: ${runMin} мин бег / ${walkMin} мин ходьба ×${reps}. RPE 3-4.`,
  structured: [{ workSec: runMin * 60, restSec: walkMin * 60, reps, target: 'rpe', note: 'Бег/ходьба' }],
});

const WK: Array<{ w: number; phase: 'base' | 'build' | 'taper' | 'peak'; km: [number, number, number, number] }> = [
  { w: 1, phase: 'base', km: [0, 0, 0, 2.5] },
  { w: 2, phase: 'base', km: [0, 0, 0, 3] },
  { w: 3, phase: 'base', km: [0, 0, 0, 4] },
  { w: 4, phase: 'base', km: [0, 0, 0, 5] },
  { w: 5, phase: 'build', km: [4, 3, 4, 6] },
  { w: 6, phase: 'build', km: [4, 3, 4, 7] },
  { w: 7, phase: 'build', km: [5, 7, 5, 8] },
  { w: 8, phase: 'build', km: [5, 7, 5, 0] },
  { w: 9, phase: 'build', km: [5, 7, 5, 8] },
  { w: 10, phase: 'build', km: [5, 7, 5, 11] },
  { w: 11, phase: 'build', km: [7, 8, 7, 12] },
  { w: 12, phase: 'build', km: [7, 8, 7, 10] },
  { w: 13, phase: 'build', km: [7, 8, 7, 15] },
  { w: 14, phase: 'taper', km: [7, 10, 7, 17] },
  { w: 15, phase: 'peak', km: [5, 5, 3, 21.1] },
];

function buildWeek(w: number): CardioTemplateWeek {
  const row = WK[w - 1];
  const deload = w === 4 || w === 8 || w === 12;
  if (w <= 4) {
    const cfg = [[10, 2, 1, 30], [15, 1, 1, 32], [15, 0.5, 1.5, 34], [10, 1, 2, 34]][w - 1];
    return {
      phase: 'base', deload: deload || undefined,
      sessions: [wr(cfg[0], cfg[1], 3, cfg[3], 1), wr(cfg[0], cfg[1], 3, cfg[3], 3), ez(40, 'Силовая 45-60 мин (не бег).', 4), ez(45, `Длинный ${row.km[3]} км: идти можно. RPE 2-3.`, 6)],
      note: w === 4 ? 'Тест 5 км + сброс.' : 'Фаза 5K: бег/ходьба.',
    };
  }
  const [a, b, c, l] = row.km;
  return {
    phase: row.phase, deload: deload || undefined, taper: row.phase === 'taper' || row.phase === 'peak' || undefined,
    sessions: [
      ez(Math.round(a * 6), `Тренировочный бег ${a} км. RPE 3-4.`, 1),
      ez(Math.round(b * 6), `Тренировочный бег ${b} км. RPE 3-4.`, 3),
      ez(Math.round(c * 6), `Тренировочный бег ${c} км. RPE 3-4.`, 4),
      w === 8 ? ez(40, 'Силовая + тест 10 км. RPE 3-4.', 6) : w === 15
        ? ez(30, 'Разминка + СТАРТ полумарафон 21.1 км!', 6)
        : ez(Math.round(l * 6), `Длинный ${l} км. RPE 2-3.`, 6),
    ],
    note: w === 15 ? 'День старта!' : deload ? 'Сброс объёма.' : w >= 9 ? 'Фаза Half.' : 'Фаза 10K.',
  };
}

const weeks: CardioTemplateWeek[] = Array.from({ length: 15 }, (_, i) => buildWeek(i + 1));

export const CARDIO_RUN_COUCH_HALF_15: CardioCycleTemplate = {
  meta: {
    id: 'cardio-run-couch-half-15',
    title: 'Couch-to-Half — 15 недель (с нуля до 21 км)',
    goal: 'health',
    goalFit: ['health', 'maintenance'],
    weeks: 15,
    sessionsPerWeek: 4,
    level: ['beginner'],
    sport: 'run',
    period: 'mixed',
    equipment: ['running'],
    lowImpact: false,
    kind: 'explicit',
    description: 'С нуля до полумарафона: walk/run → бег RPE 3-4 → long до 17 км + старт.',
    howItWorks: 'Фазы 5K (нед.1-4) → 10K (5-8) → Half (9-15); силовая 1×/нед; сбросы на 4/8/12.',
    conditions: ['Нет запрета на бег', '4 д/нед + силовая'],
    tags: ['run', 'beginner', 'half-marathon', 'walk-run'],
    deloadWeeks: [4, 8, 12],
    taperWeeks: [14, 15],
    sourceLabel: 'Marathon Handbook Couch-to-Half-Marathon Plan (15 недель)',
  },
  preset: { goal: 'health', totalWeeks: 15, daysAvailable: 4, level: 'beginner', equipment: ['running'] },
  weeks,
};
