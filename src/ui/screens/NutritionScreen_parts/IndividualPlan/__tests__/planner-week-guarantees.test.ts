/**
 * planner-week-guarantees.test.ts — Роунд-2: недельные гарантии состава плана.
 * PROTEIN_ROTATION (8 ротаций по dayOffset): рыба 2/7 дней, красное мясо 1/7,
 * морепродукты 1/7 — структурные гарантии «рыба ≥2×/нед, красное мясо ≤3×/нед».
 */
import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';

const RED_MEAT_IDS = ['beef_lean', 'beef_minced', 'beef_steak_lean', 'beef_liver', 'beef_brisket', 'beef_lean_steak', 'lamb', 'pork'];
const FISH_IDS = ['salmon', 'mackerel', 'sardines', 'tuna_steak', 'cod', 'pollock', 'tuna_canned', 'trout', 'herring', 'red_fish', 'white_fish_cod'];

const baseInput = (dayOffset: number): MealPlanInput => ({
  weightKg: 90, lbmKg: 74, bodyFatPct: 18, sex: 'male' as const,
  goalKcal: 3200, goalProteinG: 190, goalFatG: 80, goalCarbsG: 430,
  mealsCount: 5, isTrainingDay: dayOffset % 2 === 0, trainStartMin: dayOffset % 2 === 0 ? 18 * 60 : undefined, trainDurationMin: 75,
  budget: 'medium' as const, dayOffset, cyclePhase: 'course' as const, variety: 'max' as const,
  quality: 'full' as const, randomSalt: dayOffset * 13 + 3,
  wakeTime: '07:00', bedTime: '23:00',
});

describe('week-гарантии: состав недели по ротации белка (Роунд-2)', () => {
  it('7 дней: рыба ≥2×, красное мясо ≤3×, источников белка ≥5', { timeout: 240000 }, () => {
    const proteinsPerDay: string[][] = [];
    for (let d = 0; d < 7; d++) {
      const p = buildDayPlan(baseInput(d));
      const proteins = p.meals.flatMap(m => m.items.filter(i => i.role === 'protein').map(i => i.id));
      proteinsPerDay.push(proteins);
    }
    // Рыба: дней с рыбой в белке ≥ 2 ( ротация «Жирная рыба» + «Постная рыба» + «Морепродукты»)
    const fishDays = proteinsPerDay.filter(ids => ids.some(id => FISH_IDS.some(f => id.includes(f)))).length;
    expect(fishDays, `рыба в ${fishDays}/7 дней — ротация должна давать ≥2`).toBeGreaterThanOrEqual(2);
    // Красное мясо: дней ≤ 3
    const redDays = proteinsPerDay.filter(ids => ids.some(id => RED_MEAT_IDS.some(r => id.includes(r)))).length;
    expect(redDays, `красное мясо ${redDays}/7 — не более 3`).toBeLessThanOrEqual(3);
    // Разнообразие: ≥5 разных белковых источников за неделю
    const uniqueProteins = new Set(proteinsPerDay.flat()).size;
    expect(uniqueProteins, 'разнообразие белка за неделю').toBeGreaterThanOrEqual(5);
  });
});
