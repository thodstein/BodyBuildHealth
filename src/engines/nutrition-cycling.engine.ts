import { NutritionTargets } from '../core/types';

export interface MacroDay {
  date: string;
  isTrainingDay: boolean;
  targets: { kcal: number; p: number; f: number; c: number };
}

export interface WeeklyCyclePlan {
  startDate: string;
  days: MacroDay[];
  weeklyTotals: { kcal: number; p: number; f: number; c: number };
  avgDaily: { kcal: number; p: number; f: number; c: number };
}

export function generateMacroCycle(
  baseTargets: NutritionTargets,
  trainingDays: boolean[], // 7 булевых флагов для Пн-Вс
  cycleStart: string
): WeeklyCyclePlan {
  const days: MacroDay[] = [];
  let weeklyTotals = { kcal: 0, p: 0, f: 0, c: 0 };
  const start = new Date(cycleStart);

  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const isTrain = trainingDays[i];
    let kcal = baseTargets.kcal;
    let p = baseTargets.protein;
    let f = baseTargets.fats;
    let c = baseTargets.carbs;

    // Макроциклирование
    if (isTrain) {
      kcal = Math.round(kcal * 1.08);
      c = Math.round(c * 1.15);
      f = Math.round(f * 0.9);
    } else {
      kcal = Math.round(kcal * 0.95);
      c = Math.round(c * 0.85);
      f = Math.round(f * 1.05);
    }
    p = baseTargets.protein; // Белок стабилен

    const dateStr = d.toISOString().slice(0, 10);
    days.push({ date: dateStr, isTrainingDay: isTrain, targets: { kcal, p, f, c } });
    weeklyTotals.kcal += kcal;
    weeklyTotals.p += p;
    weeklyTotals.f += f;
    weeklyTotals.c += c;
  }

  return {
    startDate: cycleStart,
    days,
    weeklyTotals,
    avgDaily: {
      kcal: Math.round(weeklyTotals.kcal / 7),
      p: Math.round(weeklyTotals.p / 7),
      f: Math.round(weeklyTotals.f / 7),
      c: Math.round(weeklyTotals.c / 7)
    }
  };
}

export function calcCycleAdherence(
  loggedDays: Record<string, { kcal: number; p: number; f: number; c: number }>,
  plan: WeeklyCyclePlan
): { score: number; daysLogged: number; avgDeltaKcal: number } {
  let totalDelta = 0, daysMatched = 0;
  plan.days.forEach(d => {
    const log = loggedDays[d.date];
    if (log) {
      daysMatched++;
      totalDelta += Math.abs(log.kcal - d.targets.kcal);
    }
  });
  return {
    score: daysMatched === 0 ? 0 : Math.max(0, Math.min(100, Math.round(100 - (totalDelta / (daysMatched * plan.avgDaily.kcal)) * 100))),
    daysLogged: daysMatched,
    avgDeltaKcal: daysMatched === 0 ? 0 : Math.round(totalDelta / daysMatched)
  };
}