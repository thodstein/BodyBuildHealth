import { describe, expect, it } from 'vitest';
import { generateAllergenReportPure, generateNutrientReportDetailed, generateQualityReportPure, generateRiskReportPure, generateDrugCompatReportPure } from '../planner-reports';
import { generateNutritionReport } from '../../../../../engines/nutrition-report.engine';

describe('planner reports malformed input safety', () => {
  it('does not throw when injections is not an array', () => {
    const result = generateDrugCompatReportPure({
      dayPlan: { meals: [], totals: {} },
      injections: null as any,
      weight: 80,
      v2Pharma: {},
      phase: 'course',
      takenSupplements: [],
    });

    expect(result.warnings).toEqual([]);
  });

  it('does not throw when the generated plan has malformed meals', () => {
    const result = generateDrugCompatReportPure({
      dayPlan: { meals: null, totals: {} },
      injections: [{ type: 'ААС', dose: 500, name: 'test' }],
      weight: 80,
      v2Pharma: {},
      phase: 'course',
      takenSupplements: null as any,
    });

    expect(result.warnings).toContain('✅ Все препараты совместимы с планом питания');
  });
});

describe('planner reports — profile and safety context', () => {
  it('matches Russian allergen ids against canonical food tags', () => {
    const foods = [{ id: 'salmon', name: 'Лосось', allergens: ['fish'], protein: 20, fat: 10, carbs: 0, kcal: 200, category: 'protein' }] as any[];
    const report = generateAllergenReportPure({ meals: [{ items: [{ id: 'salmon', name: 'Лосось' }] }] }, ['рыба'], foods);
    expect(report.conflicts).toEqual([{ food: 'Лосось', allergens: ['рыба'] }]);
  });

  it('uses sex, phase and training context for nutrient targets', () => {
    const foods = [{ id: 'food', name: 'Food', micros: { Fe: 5, Ca: 500, Na: 100 }, protein: 10, fat: 1, carbs: 1, kcal: 100 }] as any[];
    const dayPlan = { meals: [{ items: [{ id: 'food', amount: 100 }] }] };
    const female = generateNutrientReportDetailed(dayPlan, foods, 'female', 60, 'course', false);
    const male = generateNutrientReportDetailed(dayPlan, foods, 'male', 80, 'maintenance', false);
    const training = generateNutrientReportDetailed(dayPlan, foods, 'male', 80, 'maintenance', true);
    expect(female.micros.Fe.target).toBe(12);
    expect(male.micros.Fe.target).toBe(8);
    expect(training.micros.Na.target).toBeGreaterThan(male.micros.Na.target);
  });

  it('formats quality budget ranges and survives zero weight', () => {
    const foods = [{ id: 'food', name: 'Food', bb_quality_score: 4, protein: 10, fat: 1, carbs: 1, kcal: 100 }] as any[];
    const quality = generateQualityReportPure({ meals: [{ items: [{ id: 'food', name: 'Food' }] }] }, 'low', foods);
    expect(quality.budgetRange).toBe('1–5');
    expect(quality.budgetRange).not.toContain('?');
    const risk = generateRiskReportPure({ meals: [{ items: [{ p: 100, kcal: 500, f: 10 }] }] }, 0);
    expect(Number.isFinite(risk.systems.renal.score)).toBe(true);
  });

  it('passes canonical allergen matching into the full report', () => {
    const report = generateNutritionReport({
      meals: [{ label: 'Рыба', items: [{ name: 'Лосось', id: 'salmon', amount: 100, kcal: 200, p: 20, f: 10, c: 0 }], totals: { kcal: 200, p: 20, f: 10, c: 0 } }],
      totals: { kcal: 200, p: 20, f: 10, c: 0 },
      targets: { kcal: 2200, protein: 150, fats: 70, carbs: 250 },
      userWeight: 0,
      userTDEE: 0,
      healthIssues: [],
      planType: 'classic',
      variety: 'max',
      budget: 'medium',
      allergens: ['рыба'],
      allergenMatcher: (food, allergenId) => food.id === 'salmon' && allergenId === 'рыба',
      cyclingMode: 'none',
      goal: 'maintenance',
      microTargets: { Fe: 18 },
    });
    expect(report.allergenWarnings).toEqual([{ food: 'Лосось', allergens: ['рыба'] }]);
    expect(Number.isFinite(report.waterBalance.targetMl)).toBe(true);
    expect(report.micros.Fe.target).toBe(18);
  });
});
