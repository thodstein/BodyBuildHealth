import { describe, it, expect } from 'vitest';
import { scoreDayComposition } from '../planner-composition-quality';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';

// E7 (PRO-план §3): композиционный скор дня (advisory).

const meal = (type: string, label: string, kcal: number, items: any[]): any => ({
  type, label, totals: { kcal, p: 30 }, items,
});

describe('E7: scoreDayComposition', () => {
  it('пустой план — нейтральный A', () => {
    expect(scoreDayComposition(null).grade).toBe('A');
    expect(scoreDayComposition({ meals: [] }).score).toBe(100);
  });
  it('off-slot еда штрафуется', () => {
    const r = scoreDayComposition({ meals: [meal('lunch', 'Обед', 500, [
      { id: 'oats_dry', role: 'carb_slow', amount: 100, c: 40 },
      { id: 'chicken_breast', role: 'protein', amount: 100 },
      { id: 'veg_broccoli', role: 'veg', amount: 100 },
    ])] });
    expect(r.issues.some(i => i.kind === 'off-slot' && i.label.includes('oats_dry'))).toBe(true);
    expect(r.grade).not.toBe('A');
  });
  it('приправочная добивка (>15 г) штрафуется', () => {
    const r = scoreDayComposition({ meals: [meal('lunch', 'Обед', 500, [
      { id: 'sauce_mayo', role: 'fat', amount: 34 },
      { id: 'rice_white', role: 'carb_slow', amount: 150 },
      { id: 'veg_broccoli', role: 'veg', amount: 100 },
    ])] });
    expect(r.issues.some(i => i.kind === 'filler-condiment')).toBe(true);
  });
  it('фрагмент (<180 ккал) и 2 фрукта в приёме штрафуются', () => {
    const r = scoreDayComposition({ meals: [meal('dinner', 'Ужин', 120, [
      { id: 'pollock', role: 'protein', amount: 60 },
      { id: 'banana', role: 'fruit', amount: 50 },
      { id: 'apple', role: 'fruit', amount: 50 },
    ])] });
    expect(r.issues.some(i => i.kind === 'fragment')).toBe(true);
    expect(r.issues.some(i => i.kind === 'two-fruits')).toBe(true);
    expect(r.issues.some(i => i.kind === 'no-veg')).toBe(true);
  });
  it('повтор крахмала между приёмами мягко штрафуется', () => {
    const r = scoreDayComposition({ meals: [
      meal('lunch', 'Обед', 500, [{ id: 'buckwheat', role: 'carb_slow', amount: 150, c: 40 }, { id: 'veg_broccoli', role: 'veg', amount: 100 }]),
      meal('dinner', 'Ужин', 500, [{ id: 'buckwheat', role: 'carb_slow', amount: 150, c: 40 }, { id: 'veg_zucchini', role: 'veg', amount: 100 }]),
    ] });
    expect(r.issues.some(i => i.kind === 'repeat' && i.label.includes('buckwheat'))).toBe(true);
  });
  it('разнообразие гарниров/белков даёт плюсы', () => {
    const r = scoreDayComposition({ meals: [
      meal('breakfast', 'Завтрак', 500, [{ id: 'oats_dry', role: 'carb_slow', amount: 80, c: 40 }, { id: 'egg_white', role: 'protein', amount: 100 }, { id: 'veg_broccoli', role: 'veg', amount: 50 }]),
      meal('lunch', 'Обед', 500, [{ id: 'rice_white', role: 'carb_slow', amount: 150, c: 40 }, { id: 'chicken_breast', role: 'protein', amount: 100 }, { id: 'veg_broccoli', role: 'veg', amount: 100 }]),
      meal('dinner', 'Ужин', 500, [{ id: 'buckwheat', role: 'carb_slow', amount: 150, c: 40 }, { id: 'salmon', role: 'protein', amount: 100 }, { id: 'veg_zucchini', role: 'veg', amount: 100 }]),
    ] });
    expect(r.positives.some(p => p.includes('белки')), JSON.stringify(r.positives)).toBe(true);
  });
});

describe('E7: реальный планировщик — высокий скор композиции', () => {
  const base = (over: Partial<MealPlanInput> = {}): MealPlanInput => ({
    weightKg: 90, lbmKg: 73.8, bodyFatPct: 18, sex: 'male',
    goalKcal: 3000, goalProteinG: 180, goalFatG: 72, goalCarbsG: 408,
    mealsCount: 5, isTrainingDay: true, trainStartMin: 1050, trainDurationMin: 90, allowIntraWorkout: true,
    budget: 'medium', dayOffset: 0, cyclePhase: 'course', variety: 'max', eveningLowCarb: false,
    ...over,
  });
  for (const prof of [base({}), base({ isTrainingDay: false, trainStartMin: undefined, dayOffset: 1 }), base({ weightKg: 95, lbmKg: 78, goalKcal: 2060, goalProteinG: 180, goalFatG: 60, goalCarbsG: 200, isTrainingDay: false, dayOffset: 2 })]) {
    for (const salt of [1, 2, 3]) {
      it(`${prof.weightKg}кг ${prof.isTrainingDay ? 'T' : 'R'} s${salt}`, () => {
        const p = buildDayPlan({ ...prof, randomSalt: salt });
        const r = scoreDayComposition(p as any);
        // Про-выдача: композиция не ниже C; off-slot — редкий остаток (корректор
        // может добавить носитель напрямую; своп отклонён, если сходимость падала).
        const offSlot = r.issues.filter(i => i.kind === 'off-slot');
        expect(offSlot.length, `off-slot: ${JSON.stringify(offSlot)}`).toBeLessThanOrEqual(1);
        expect(r.score, `score=${r.score} issues=${JSON.stringify(r.issues)}`).toBeGreaterThanOrEqual(60);
      });
    }
  }
});
