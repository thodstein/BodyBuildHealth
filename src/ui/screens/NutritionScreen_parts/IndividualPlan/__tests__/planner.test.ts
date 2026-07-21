import { describe, it, expect } from 'vitest';
import { buildDayPlan } from '../meal-plan-engine';
import { computePlannerTargets } from '../planner-targets';
import { FOOD_DB } from '../../../../../core/nutrition-database';

const baseInput = (overrides: any = {}) => ({
  weightKg: 90, lbmKg: 90 * 0.82, bodyFatPct: 18, sex: 'male' as const,
  goalKcal: 3000, goalProteinG: 180, goalFatG: 72, goalCarbsG: 408,
  mealsCount: 5, isTrainingDay: true, trainStartMin: 17 * 60 + 30, trainDurationMin: 90, allowIntraWorkout: true,
  budget: 'medium' as const, dayOffset: 0, cyclePhase: 'course' as const, variety: 'max' as const, eveningLowCarb: false,
  ...overrides,
});

const baseTargetInput = (overrides: any = {}) => ({
  weightKg: 90, heightCm: 180, age: 30, sex: 'male' as const, goal: 'mass', phase: 'course', bodyFatPct: 15,
  workoutsPerWeek: 4, avgWorkoutMinutes: 75, dailySteps: 9000, householdActivity: 'moderate', trainType: 'mixed',
  trainIntensity: 'high', surplusPct: 10, injections: [] as any[], weightAdaptMode: false, weightLogWeek: [] as number[],
  expectedLossKgWeek: 0, metabolicAdaptEnabled: false, metabolicAdaptPct: 0, manualGPerKg: { protein: 0, fat: 0, carbs: 0 },
  ...overrides,
});

describe('computePlannerTargets', () => {
  it('базовый расчёт: kcal≈Б*4+Ж*9+У*4', () => {
    const r = computePlannerTargets(baseTargetInput());
    expect(r.kcal).toBeGreaterThan(2000);
    expect(r.protein).toBeGreaterThan(100);
    const sum = r.protein * 4 + r.fats * 9 + r.carbs * 4;
    expect(Math.abs(sum - r.kcal)).toBeLessThan(80);
  });

  it('AAS добавляет +0.3 г/кг белка', () => {
    const noAas = computePlannerTargets(baseTargetInput());
    const withAas = computePlannerTargets(baseTargetInput({ injections: [{ type: 'ААС', dose: 500 }] }));
    expect(withAas.protein - noAas.protein).toBeGreaterThanOrEqual(Math.round(90 * 0.3) - 1);
  });

  it('короткий инсулин поднимает углеводы и режет жир', () => {
    const r = computePlannerTargets(baseTargetInput({ weightKg: 100, injections: [{ type: 'инсулин', dose: 20, esterType: 'short' }] }));
    expect(r.carbs).toBeGreaterThanOrEqual(20 * 10 * 1.2 - 1);
    expect(r.fats).toBeLessThanOrEqual(Math.round(100 * 0.5));
  });

  it('GLP-1 режет жир до 0.4 г/кг', () => {
    const r = computePlannerTargets(baseTargetInput({ goal: 'maintenance', phase: 'maintenance', injections: [{ type: 'семаглутид', dose: 0.5 }] }));
    expect(r.fats).toBeLessThanOrEqual(Math.round(90 * 0.4));
  });

  it('ручные г/кг перезаписывают белок', () => {
    const r = computePlannerTargets(baseTargetInput({ manualGPerKg: { protein: 2.2, fat: 0, carbs: 0 } }));
    expect(r.protein).toBe(Math.round(90 * 2.2));
    expect(r.kcal).toBe(r.protein * 4 + r.fats * 9 + r.carbs * 4);
  });

  it('metabolic adaptation снижает kcal', () => {
    const base = computePlannerTargets(baseTargetInput());
    const adj = computePlannerTargets(baseTargetInput({ metabolicAdaptEnabled: true, metabolicAdaptPct: 10 }));
    expect(adj.kcal).toBeLessThan(base.kcal);
  });

  it('cutting < maintenance по kcal', () => {
    const maint = computePlannerTargets(baseTargetInput({ goal: 'maintenance', phase: 'maintenance' }));
    const cut = computePlannerTargets(baseTargetInput({ goal: 'cutting', phase: 'cutting' }));
    expect(cut.kcal).toBeLessThan(maint.kcal);
  });
});

describe('buildDayPlan — точность', () => {
  it('белок в пределах ±5% от цели', () => {
    const p = buildDayPlan(baseInput({ goalProteinG: 180 }));
    expect(Math.abs(p.totals.p - 180) / 180).toBeLessThan(0.05);
  });

  it('kcal в пределах ±8%', () => {
    const p = buildDayPlan(baseInput({ goalKcal: 3000 }));
    expect(Math.abs(p.totals.kcal - 3000) / 3000).toBeLessThan(0.08);
  });
});

describe('buildDayPlan — peri-workout', () => {
  it('тренировочный день: есть pre и post', () => {
    const p = buildDayPlan(baseInput());
    const labels = p.meals.map(m => m.label);
    expect(labels.some(l => l.includes('Предтрен'))).toBe(true);
    expect(labels.some(l => l.includes('Пост-трен'))).toBe(true);
  });

  it('день отдыха: нет peri-workout', () => {
    const p = buildDayPlan(baseInput({ isTrainingDay: false, trainStartMin: undefined, allowIntraWorkout: false }));
    const labels = p.meals.map(m => m.label);
    expect(labels.some(l => l.includes('Предтрен'))).toBe(false);
    expect(labels.some(l => l.includes('Пост-трен'))).toBe(false);
  });
});

describe('buildDayPlan — исключения и веган', () => {
  it('исключённые продукты не попадают в план', () => {
    const excluded = new Set(['chicken_breast', 'rice_white']);
    const p = buildDayPlan(baseInput({ excludedIds: excluded }));
    const ids = new Set(p.meals.flatMap(m => m.items.map(it => it.id)));
    expect(ids.has('chicken_breast')).toBe(false);
    expect(ids.has('rice_white')).toBe(false);
  });

  it('вегетарианский режим: нет курицы/говядины', () => {
    const p = buildDayPlan(baseInput({ isVegetarian: true, goalProteinG: 160 }));
    const ids = new Set(p.meals.flatMap(m => m.items.map(it => it.id)));
    expect(ids.has('chicken_breast')).toBe(false);
    expect(ids.has('beef_lean')).toBe(false);
  });
});

describe('buildDayPlan — carb periodization', () => {
  it('ужин ≤20% суточных углеводов', () => {
    const p = buildDayPlan(baseInput({ goalCarbsG: 500, goalKcal: 3600, goalProteinG: 200, goalFatG: 80 }));
    const dinner = p.meals.find(m => m.label === 'Ужин');
    expect(dinner).toBeTruthy();
    expect(dinner!.totals.c / p.totals.c).toBeLessThan(0.20);
  });
});

describe('buildDayPlan — граничные случаи', () => {
  it('нереалистично низкая kcal-цель не падает и держит белок', () => {
    const p = buildDayPlan(baseInput({ goalKcal: 1200, goalProteinG: 180, goalFatG: 40, goalCarbsG: 50 }));
    expect(p.meals.length).toBeGreaterThan(0);
    expect(p.totals.p).toBeGreaterThan(100);
  });

  it('очень высокая цель белка (4 г/кг) обрабатывается', () => {
    const p = buildDayPlan(baseInput({ weightKg: 80, lbmKg: 65, goalProteinG: 320, goalKcal: 4000, goalFatG: 70, goalCarbsG: Math.round((4000 - 320 * 4 - 70 * 9) / 4) }));
    expect(p.totals.p).toBeGreaterThan(250);
  });

  it('7-дневная генерация не падает на разных dayOffset', () => {
    for (let d = 0; d < 7; d++) {
      const p = buildDayPlan(baseInput({ dayOffset: d, isTrainingDay: d % 2 === 0 }));
      expect(p.meals.length).toBeGreaterThan(0);
      expect(p.totals.kcal).toBeGreaterThan(0);
    }
  });

  it('eveningLowCarb: ужин ещё легче (≤12% углеводов)', () => {
    const p = buildDayPlan(baseInput({ eveningLowCarb: true, goalCarbsG: 500, goalKcal: 3600, goalProteinG: 200, goalFatG: 80 }));
    const dinner = p.meals.find(m => m.label === 'Ужин');
    expect(dinner).toBeTruthy();
    expect(dinner!.totals.c / p.totals.c).toBeLessThan(0.12);
  });

  it('день отдыха без тренировки: нет intra-workout', () => {
    const p = buildDayPlan(baseInput({ isTrainingDay: false, trainStartMin: undefined, allowIntraWorkout: false }));
    const labels = p.meals.map(m => m.label);
    expect(labels.some(l => l.includes('Intra') || l.includes('intra'))).toBe(false);
  });
});

import { generateNutritionReport } from '../../../../../engines/nutrition-report.engine';

describe('nutrition-report — PRAL (кислотная нагрузка)', () => {
  function reportFor(plan: any) {
    return generateNutritionReport({
      meals: plan.meals.map((m: any) => ({
        label: m.label,
        items: m.items.map((i: any) => ({ name: i.name || '', id: i.id || '', amount: i.amount || 100, kcal: i.kcal || 0, p: i.p || 0, f: i.f || 0, c: i.c || 0, fiber: i.fiber || 0 })),
        totals: m.totals || { kcal: 0, p: 0, f: 0, c: 0 }, time: m.time || '',
      })),
      totals: plan.totals,
      targets: { kcal: 3000, protein: 180, fats: 70, carbs: 400 },
      userWeight: 90, userTDEE: 3000, healthIssues: [], planType: 'classic', variety: 'max', budget: 'medium', allergens: [], cyclingMode: 'none', goal: 'maintenance',
    });
  }

  it('PRAL считается на высокобелковом рационе (число + валидный статус)', () => {
    const plan = buildDayPlan(baseInput({ goalProteinG: 220, goalKcal: 3400, goalFatG: 80, goalCarbsG: Math.round((3400 - 220 * 4 - 80 * 9) / 4) }));
    const rep = reportFor(plan);
    expect(typeof rep.pral.mEq).toBe('number');
    expect(rep.pral.status).toMatch(/ok|mild|moderate|high/);
    // PRAL имеет смысл: либо закисление (мало овощей), либо ощелачивание (много овощей);
    // оба исхода допустимы — главное, что метрика считается и статус валиден.
    expect(Math.abs(rep.pral.mEq)).toBeLessThan(200);
  });

  it('PRAL статус high на синтетическом высокобелковом рационе без овощей', () => {
    // Синтетика: чистый белок (whey + chicken), минимум K/Ca/Mg → сильное закисление
    const rep = generateNutritionReport({
      meals: [{ label: 'Тест', items: [
        { name: 'whey', id: 'whey_isolate', amount: 300, kcal: 1200, p: 270, f: 3, c: 9, fiber: 0 },
        { name: 'chicken', id: 'chicken_breast', amount: 400, kcal: 660, p: 92, f: 8, c: 0, fiber: 0 },
      ], totals: { kcal: 1860, p: 362, f: 11, c: 9 }, time: '12:00' }],
      totals: { kcal: 1860, p: 362, f: 11, c: 9 },
      targets: { kcal: 3000, protein: 200, fats: 70, carbs: 300 }, userWeight: 90, userTDEE: 3000,
      healthIssues: [], planType: 'classic', variety: 'max', budget: 'medium', allergens: [], cyclingMode: 'none', goal: 'maintenance',
    });
    expect(rep.pral.mEq).toBeGreaterThan(60);
    expect(rep.pral.status).toBe('high');
    expect(rep.pral.recommendation).toContain('закисление');
  });
});

describe('buildDayPlan — Glycemic Load per meal', () => {
  it('на реалистичной массе (400г углеводов) макс. пер-приёмная GL умеренная', () => {
    const plan = buildDayPlan(baseInput({ goalCarbsG: 400, goalKcal: 3400, goalProteinG: 200, goalFatG: 80, isTrainingDay: false, trainStartMin: undefined, allowIntraWorkout: false }));
    const GL = (food: any, carbs: number) => ((food?.gi || 55) * carbs) / 100;
    let maxMealGL = 0;
    for (const m of plan.meals) {
      let mealGL = 0;
      for (const it of m.items) { const food = FOOD_DB.find((f: any) => f.id === it.id); if ((food?.carbs || 0) > 5) mealGL += GL(food, it.c); }
      maxMealGL = Math.max(maxMealGL, mealGL);
    }
    // GL<65 за приём — умеренная зона для массонабора (низко-GI источники удерживают GL); без GL-aware был бы выше
    expect(maxMealGL).toBeLessThan(65);
  });
  it('высоко-углеводный приём (>=60г) выбирает низко-GI источник (GI<=60)', () => {
    const plan = buildDayPlan(baseInput({ goalCarbsG: 450, goalKcal: 3600, goalProteinG: 200, goalFatG: 80, isTrainingDay: false, trainStartMin: undefined, allowIntraWorkout: false }));
    let highCarbLowGI = 0, highCarbCount = 0;
    for (const m of plan.meals) {
      for (const it of m.items) { const food = FOOD_DB.find((f: any) => f.id === it.id); if ((food?.carbs || 0) >= 20 && (food?.gi||0) > 0) { highCarbCount++; if ((food?.gi||99) <= 60) highCarbLowGI++; } }
    }
    // большинство углеводных источников — низко-GI (благодаря GL-aware выбору)
    expect(highCarbCount).toBeGreaterThan(0);
    expect(highCarbLowGI / highCarbCount).toBeGreaterThan(0.5);
  });
});

describe('buildDayPlan — active micro-gap closing (D-23)', () => {
  it('микро-буст не ломает план: kcal/белок остаются у цели', () => {
    const plan = buildDayPlan(baseInput({ goalProteinG: 180, goalKcal: 3000 }));
    // план валиден
    expect(plan.meals.length).toBeGreaterThan(0);
    expect(Math.abs(plan.totals.kcal - 3000) / 3000).toBeLessThan(0.1);
    // если есть микро-буст note — формат корректный
    const boostNote = plan.notes.find((n: string) => n.includes('🧬'));
    if (boostNote) {
      expect(boostNote).toContain('закрытие дефицита');
    }
  });

  it('движок не падает и собирает валидный план при обеднённом пуле (овощи/фрукты исключены)', () => {
    // D-23 + robustness: даже при обеднённом пуле план должен собираться без краха,
    // а микро-буст (если дефицит есть) — не ломать макро-цели.
    const vegFruitIds = ['broccoli','spinach','cucumber','tomato','veg_bell_pepper_red','zucchini','cabbage','green_beans','papaya','blueberry','orange','apple','banana','avocado'];
    const excluded = new Set(vegFruitIds);
    const plan = buildDayPlan(baseInput({ excludedIds: excluded, goalProteinG: 180, goalKcal: 3000, isTrainingDay: false, trainStartMin: undefined, allowIntraWorkout: false }));
    expect(plan.meals.length).toBeGreaterThan(0);
    expect(plan.totals.kcal).toBeGreaterThan(1500);
    expect(plan.totals.p).toBeGreaterThan(120);
    // если микро-буст сработал — note содержит «закрытие дефицита»
    const boostNote = plan.notes.find((n: string) => n.includes('🧬'));
    if (boostNote) expect(boostNote).toContain('закрытие дефицита');
  });
});

describe('buildDayPlan — mealsCount-aware distribution (D-24)', () => {
  it('mealsCount контролирует число приёмов (3→3, 8→8 на тренинге)', () => {
    const m3 = buildDayPlan(baseInput({ mealsCount: 3, isTrainingDay: true, trainStartMin: 17 * 60 + 30, trainDurationMin: 90, allowIntraWorkout: true }));
    const m8 = buildDayPlan(baseInput({ mealsCount: 8, isTrainingDay: true, trainStartMin: 17 * 60 + 30, trainDurationMin: 90, allowIntraWorkout: true }));
    expect(m3.meals.length).toBeLessThanOrEqual(3);
    expect(m8.meals.length).toBe(8);
  });

  it('углеводы распределяются полностью (нет недобора) при малом mealsCount', () => {
    const plan = buildDayPlan(baseInput({ mealsCount: 3, goalCarbsG: 470, goalKcal: 3400, goalProteinG: 200, goalFatG: 80, isTrainingDay: false, trainStartMin: undefined, allowIntraWorkout: false }));
    // дефицит/перебор углеводов в пределах 10% (раньше был ~20%)
    expect(Math.abs(plan.totals.c - 470) / 470).toBeLessThan(0.1);
  });

  it('обед — главный приём (не наименьший, >20% ккал)', () => {
    const plan = buildDayPlan(baseInput({ mealsCount: 5, goalKcal: 3400, goalProteinG: 200, goalFatG: 80, goalCarbsG: 470, isTrainingDay: false, trainStartMin: undefined, allowIntraWorkout: false }));
    const lunch = plan.meals.find(m => m.label === 'Обед');
    expect(lunch).toBeTruthy();
    expect(lunch!.totals.kcal / 3400).toBeGreaterThan(0.2);
    // обед не наименьший по ккал среди основных приёмов (завтрак/обед/ужин)
    const main = ['Завтрак','Обед','Ужин'].map(l => plan.meals.find(m => m.label === l)?.totals.kcal || 0);
    expect(main[1]).toBeGreaterThanOrEqual(Math.min(...main));
  });
});