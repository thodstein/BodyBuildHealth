/**
 * cardio-pro-bridge10k-6.ts — ГОТОВЫЙ ЦИКЛ: Bridge to 10K 6 недель
 * (Aerix, выпускникам C25K). Дословно по таблице источника (3×/нед):
 * нед.1: 10 мин бег/1 мин ходьба ×4; нед.2: 15/1 ×3; нед.3: 17/1 ×3;
 * нед.4: 18/1 ×3; нед.5: 22/1 ×2; нед.6: 30/1 ×2 + 60 мин нон-стоп ×2.
 * Финиш — 60 мин непрерывного бега (≈10K).
 */
import type { CardioCycleTemplate, CardioTemplateSession, CardioTemplateWeek } from './cardio-cycle-types';

const sess = (runMin: number, walkMin: number, reps: number, totalMin: number, dow: number, note: string): CardioTemplateSession => ({
  type: 'zone2', durationMin: totalMin, equipment: 'running', dayOfWeek: dow,
  purpose: `${note}: бег ${runMin} мин / ходьба ${walkMin} мин ×${reps}.`,
  structured: [{ workSec: runMin * 60, restSec: walkMin * 60, reps, target: 'rpe', note: 'Бег/ходьба' }],
});
const steady = (min: number, dow: number, note: string): CardioTemplateSession => ({
  type: 'zone2', durationMin: min, equipment: 'running', dayOfWeek: dow, purpose: note,
});

const PLAN: Array<Array<[number, number, number] | [number]>> = [
  [[10, 1, 4], [10, 1, 4], [10, 1, 4]],
  [[15, 1, 3], [15, 1, 3], [15, 1, 3]],
  [[17, 1, 3], [17, 1, 3], [17, 1, 3]],
  [[18, 1, 3], [18, 1, 3], [18, 1, 3]],
  [[22, 1, 2], [22, 1, 2], [22, 1, 2]],
  [[30, 1, 2], [60], [60]],
];

function buildWeek(w: number): CardioTemplateWeek {
  const rows = PLAN[w - 1];
  const dows = [0, 2, 4];
  const sessions = rows.map((r, i) => {
    if (r.length === 1) return steady(60, dows[i], w === 6 ? 'Бег 60 мин НОН-СТОП — финиш моста!' : 'Бег 60 мин.');
    const [runMin, walkMin, reps] = r as [number, number, number];
    return sess(runMin, walkMin, reps, runMin * reps + walkMin * reps, dows[i], `Мост 5K→10K`);
  });
  return { sessions, phase: w <= 2 ? 'base' : 'build', note: w === 6 ? 'Финиш: 60 мин непрерывно (≈10K).' : undefined };
}

const weeks: CardioTemplateWeek[] = Array.from({ length: 6 }, (_, i) => buildWeek(i + 1));

export const CARDIO_PRO_BRIDGE10K_6: CardioCycleTemplate = {
  meta: {
    id: 'cardio-pro-bridge10k-6',
    title: 'Мост 5K→10K — 6 недель (выпускникам C25K)',
    goal: 'health',
    goalFit: ['health', 'maintenance'],
    weeks: 6,
    sessionsPerWeek: 3,
    level: ['beginner'],
    sport: 'run',
    period: 'base',
    equipment: ['running'],
    lowImpact: false,
    kind: 'explicit',
    description: 'От 30 мин бега до часа нон-стоп: интервалы бег/ходьба сжимаются 6 недель.',
    howItWorks: '3 одинаковые сессии в неделю; ходьба 1 мин, бег растёт 10→60 мин.',
    conditions: ['Бегаете 30 мин непрерывно (C25K)', '3 д/нед с днями отдыха между'],
    tags: ['run', '10k', 'bridge', 'walk-run', 'pro'],
    sourceLabel: 'Aerix Bridge to 10K 6-Week Plan (таблица 6 недель)',
  },
  preset: { goal: 'health', totalWeeks: 6, daysAvailable: 3, level: 'beginner', equipment: ['running'] },
  weeks,
};
