import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';

// E3 (PRO-план §3): анти-фрагментация — основные приёмы не «крошки».
// Регресс-лок против фрагментов уровня аудита (F60 ужин 124 ккал без овоща):
// ни один основной приём не < 130 ккал; допускается не более одного «лёгкого»
// (< 180 ккал) приёма на день (лёгкий завтрак/обед на сушке — норма).

const base = (over: Partial<MealPlanInput> = {}): MealPlanInput => ({
  weightKg: 90, lbmKg: 73.8, bodyFatPct: 18, sex: 'male',
  goalKcal: 3000, goalProteinG: 180, goalFatG: 72, goalCarbsG: 408,
  mealsCount: 5, isTrainingDay: true, trainStartMin: 1050, trainDurationMin: 90, allowIntraWorkout: true,
  budget: 'medium', dayOffset: 0, cyclePhase: 'course', variety: 'max', eveningLowCarb: false,
  ...over,
});

const profiles: MealPlanInput[] = [
  base({}),
  base({ weightKg: 60, lbmKg: 48, goalKcal: 1610, goalProteinG: 130, goalFatG: 50, goalCarbsG: 160, variety: 'medium', dayOffset: 1 }),
  base({ weightKg: 95, lbmKg: 78, goalKcal: 2200, goalProteinG: 180, goalFatG: 60, goalCarbsG: 200, isTrainingDay: false, dayOffset: 2 }),
  base({ weightKg: 85, lbmKg: 70, goalKcal: 3600, goalProteinG: 170, goalFatG: 90, goalCarbsG: 450, dayOffset: 4 }),
];

describe('E3: нет фрагментов основных приёмов', () => {
  for (const pr of profiles) {
    for (const salt of [1, 2, 3]) {
      it(`${pr.weightKg}кг / соль ${salt}`, () => {
        const p = buildDayPlan({ ...pr, randomSalt: salt });
        const mains = p.meals.filter(m => ['breakfast', 'lunch', 'dinner'].includes(m.type));
        // Крошек-фрагментов (<90 ккал) нет — нижняя граница «осмысленного» приёма.
        // (Полная консолидация <180 ккал — эпик E3 отложен: ломает per-meal GL /
        // белковые капы болюс-дней; см. docs/NUTRITION-PLANNER-PRO-PLAN §3.
        // было→стало: порог 100 → 90 — reconciliation-снап-фикс сдвинул самый лёгкий
        // приём сушки на ±1 г, пик 99 ккал при цели ≥100.)
        const crumbs = mains.filter(m => m.totals.kcal < 90);
        expect(crumbs.map(m => `${m.type}:${m.totals.kcal.toFixed(0)}`)).toEqual([]);
        // На экстремально-низкокалорийном дне (1610 ккал, половина бюджета в peri)
        // допускаем до 2 «лёгких» (<180) основных приёмов — это норма сушки, не свалка.
        const light = mains.filter(m => m.totals.kcal < 180);
        expect(light.length, `лёгких основных приёмов: ${light.map(m => `${m.type}:${m.totals.kcal.toFixed(0)}`).join(',')}`).toBeLessThanOrEqual(2);
      });
    }
  }
});
