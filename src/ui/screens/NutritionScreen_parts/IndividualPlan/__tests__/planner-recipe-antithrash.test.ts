/**
 * planner-recipe-antithrash.test.ts — §3E EXTREME-SCALE: анти-осцилляция ребаланса.
 * На 1500У ребаланс рецептурного дня сжигал итерации на пинг-понге «добавил рис в Завтрак →
 * убрал рис из Завтрака» (20+ строк нот). Теперь: добавленное этим же ребалансом не режется,
 * а снятое не возвращается в тот же приём (полная история вызова, не кольцо 6).
 */
import { describe, it, expect } from 'vitest';
import { RECIPE_DB } from '../../../../../data/recipe-db';
import { assembleRecipeDay } from '../planner-recipe-mode';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';

const base = (over: any = {}): MealPlanInput => ({
  weightKg: 110, lbmKg: 92, bodyFatPct: 16, sex: 'male' as const,
  goalKcal: 5100, goalProteinG: 220, goalFatG: 110, goalCarbsG: 800,
  mealsCount: 7, isTrainingDay: true, trainStartMin: 17 * 60, trainDurationMin: 90,
  allowIntraWorkout: true, budget: 'max' as const, dayOffset: 0,
  cyclePhase: 'course' as const, variety: 'max' as const, eveningLowCarb: false,
  quality: 'full' as const, randomSalt: 3, carbCapGPerKg: 0,
  wakeTime: '07:00', bedtime: '23:00', dinnerTime: '19:00',
  ...over,
});

describe('§3E анти-осцилляция ребаланса', () => {
  it('R-1500: нет повторных «Убран X из „Приём"» (пинг-понг) и нет взрыва нот', () => {
    const src = buildDayPlan(base({
      weightKg: 120, lbmKg: 100, goalKcal: 8600, goalProteinG: 280, goalFatG: 120, goalCarbsG: 1500,
      injections: [
        { type: 'инсулин', name: 'А', time: '08:00', dose: 40, esterType: 'short' },
        { type: 'инсулин', name: 'Б', time: '13:00', dose: 40, esterType: 'short' },
        { type: 'инсулин', name: 'В', time: '19:30', dose: 40, esterType: 'short' },
      ] as any,
    }));
    const res = assembleRecipeDay({
      meals: (src.meals as any[]).map((m: any) => ({ ...m, items: (m.items || []).map((i: any) => ({ ...i })), totals: { ...m.totals } })) as any,
      pool: RECIPE_DB as any, targets: { kcal: 8600, p: 280, f: 120, c: 1500 },
      excludedIds: new Set<string>(), trainDay: true, athleteWeightKg: 120, seed: 3, goal: 'mass',
    });
    const cuts = res.notes.filter(n => n.startsWith('➖ Убран'));
    const pairs = cuts.map(n => {
      const m = n.match(/Убран (.+?) из «(.+?)»/);
      return m ? `${m[1]}|${m[2]}` : n;
    });
    const dupes = pairs.filter((p, i) => pairs.indexOf(p) !== i);
    expect(dupes, `повторные снятия: ${dupes.join(' | ')}`).toEqual([]);
    // Ноты не взрываются (было 40+ строк пинг-понга).
    expect(res.notes.length).toBeLessThanOrEqual(40);
  });
});
