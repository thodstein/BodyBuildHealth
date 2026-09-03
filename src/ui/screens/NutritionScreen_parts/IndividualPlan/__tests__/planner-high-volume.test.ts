/**
 * planner-high-volume.test.ts — итерации A–F (HIGH-VOLUME план).
 * Peri-инварианты при любом бюджете, инсулин-окна, F-бейджи, матрица high-volume.
 */
import { describe, it, expect } from 'vitest';
import {
  buildDayPlan, distributeCarbsByCapacity, mealCarbCapacityG, type MealPlanInput,
} from '../meal-plan-engine';
import { scaleComponentAmount, recipeComponentClass } from '../recipe-engine';

const base = (over: any = {}): MealPlanInput => ({
  weightKg: 110, lbmKg: 92, bodyFatPct: 16, sex: 'male' as const,
  goalKcal: 5100, goalProteinG: 220, goalFatG: 110, goalCarbsG: 800,
  mealsCount: 7, isTrainingDay: true, trainStartMin: 17 * 60, trainDurationMin: 90,
  allowIntraWorkout: true, budget: 'max' as const, dayOffset: 0,
  cyclePhase: 'course' as const, variety: 'max' as const, eveningLowCarb: false,
  quality: 'full' as const, randomSalt: 3, carbCapGPerKg: 0,
  wakeTime: '07:00', bedTime: '23:00', dinnerTime: '19:00',
  ...over,
});

describe('A: capacity-aware распределение (чистая функция)', () => {
  const wOf = (r: string) => ({ breakfast: 1.0, lunch: 1.7, dinner: 0.7, prew: 1.0, postw: 1.2, snack: 0.5, snack2: 0.5 } as any)[r] ?? 0.5;
  const capOf = (r: string) => mealCarbCapacityG(r, { budget: 'max', weightKg: 110, trainDurationMin: 90 });

  it('сумма всегда равна цели, peri зафиксированы, обед в капе', () => {
    for (const total of [300, 800, 1200, 1500]) {
      const roles = ['breakfast', 'lunch', 'dinner', 'prew', 'postw', 'snack', 'snack2'];
      const { vals, overCap } = distributeCarbsByCapacity(total, roles, wOf, capOf);
      const sum = Object.values(vals).reduce((s, v) => s + v, 0);
      expect(sum, `total=${total}`).toBe(total);
      expect(vals.prew, `prew total=${total}`).toBeLessThanOrEqual(60);
      expect(vals.postw, `postw total=${total}`).toBeLessThanOrEqual(75);
      expect(vals.lunch, `lunch total=${total}`).toBeLessThanOrEqual(capOf('lunch') + (overCap.includes('lunch') ? 1000 : 0));
      if (total <= 1000) expect(overCap, `overCap total=${total}`).toEqual([]);
    }
  });

  it('preSleep всегда 0, intra кап 40 г/ч (30–90)', () => {
    expect(mealCarbCapacityG('preSleep', {})).toBe(0);
    expect(mealCarbCapacityG('intra', { trainDurationMin: 60 })).toBe(40);
    expect(mealCarbCapacityG('intra', { trainDurationMin: 120 })).toBe(80);
    expect(mealCarbCapacityG('prew', {})).toBe(60);
    expect(mealCarbCapacityG('postw', {})).toBe(75);
  });
});

describe('E: peri-инварианты при любом бюджете (интеграция)', () => {
  for (const carbs of [800, 1200, 1500]) {
    it(`peri-капы целы при ${carbs}У: prew≤60/postw≤75/intra≤90 (допуск стражи ×1.05)`, () => {
      const kcal = Math.round(220 * 4 + 110 * 9 + carbs * 4);
      const plan = buildDayPlan(base({ goalCarbsG: carbs, goalKcal: kcal }));
      const prew = plan.meals.find(m => m.type === 'preworkout');
      const postw = plan.meals.find(m => m.type === 'postworkout');
      const intra = plan.meals.find(m => m.type === 'intra');
      if (prew) expect(prew.totals.c).toBeLessThanOrEqual(63);
      if (postw) expect(postw.totals.c).toBeLessThanOrEqual(79);
      if (intra) expect(intra.totals.c).toBeLessThanOrEqual(95);
    });
  }

  it('rest-day: intra нет вообще, presleep почти без углей', () => {
    const plan = buildDayPlan(base({ isTrainingDay: false, allowIntraWorkout: false, trainStartMin: undefined }));
    expect(plan.meals.some(m => m.type === 'intra')).toBe(false);
    const ps = plan.meals.find(m => m.type === 'presleep');
    if (ps) expect(ps.totals.c).toBeLessThanOrEqual(12);
  });

  it('presleep безуглеводный и в train-day', () => {
    const plan = buildDayPlan(base({}));
    const ps = plan.meals.find(m => m.type === 'presleep');
    if (ps) expect(ps.totals.c).toBeLessThanOrEqual(12);
  });
});

describe('C: инсулин-окна первого класса (интеграция)', () => {
  // 10:00 покрывается перекусом из gapFill (09:45) — болюс честно гасится приёмом.
  // Свободные окна дня при 7 приёмах: 14:00 (обед 12:30 → предтрен 15:30) и 21:00.
  const bolus = { type: 'инсулин', name: 'НовоРапид', time: '14:00', dose: 10, esterType: 'short' };

  it('болюс 10ЕД вдали от приёмов → окно ~100У, жиры 0, маркер locked', () => {
    // rest-day: в 14:00 пусто (обед 12:30, перекус ~15:45) — полное окно, не топ-ап.
    const plan = buildDayPlan(base({ goalCarbsG: 800, goalKcal: 6000, isTrainingDay: false, injections: [bolus] as any }));
    const win = plan.meals.find(m => (m.label || '').includes('Углеводы под инсулин'));
    expect(win).toBeTruthy();
    expect(win!.totals.c).toBeGreaterThanOrEqual(90);
    expect(win!.totals.c).toBeLessThanOrEqual(120);
    // Сыворотка + плотный носитель несут ~2 г встроенного жира — без ДОБАВЛЕННОГО (f ≤ 3).
    expect(win!.totals.f).toBeLessThanOrEqual(3);
    expect((win as any)._insulinWindow).toBe(true);
  });

  it('болюс рядом с приёмом — покрывается приёмом, окна нет (честно, не дубль)', () => {
    const plan = buildDayPlan(base({ injections: [{ ...bolus, time: '12:20' }] as any }));
    expect(plan.meals.some(m => (m.label || '').includes('Углеводы под инсулин'))).toBe(false);
  });

  it('базальный long — окна нет (фон, не болюс)', () => {
    const plan = buildDayPlan(base({ injections: [{ type: 'инсулин', name: 'Лантус', time: '14:00', dose: 10, esterType: 'long' }] as any }));
    expect(plan.meals.some(m => (m.label || '').includes('Углеводы под инсулин'))).toBe(false);
  });

  it('несколько болюсов → несколько окон (полные и топ-ап, все locked)', () => {
    // 3 приёма (без перекусов): 10:00 и 15:30 изолированы от всех приёмов (>60 мин).
    const plan = buildDayPlan(base({
      goalCarbsG: 1000, goalKcal: 7000, isTrainingDay: false, mealsCount: 3,
      injections: [
        { type: 'инсулин', name: 'А', time: '10:00', dose: 8, esterType: 'short' },
        { type: 'инсулин', name: 'Б', time: '15:30', dose: 8, esterType: 'short' },
      ] as any,
    }));
    const wins = plan.meals.filter(m => (m.label || '').includes('Углеводы под инсулин'));
    expect(wins.length).toBe(2);
    for (const w of wins) {
      expect((w as any)._insulinWindow).toBe(true);
      expect(w.totals.f).toBeLessThanOrEqual(3);
      expect(w.totals.c).toBeGreaterThanOrEqual(30);
      expect(w.totals.c).toBeLessThanOrEqual(120);
    }
  });

  it('болюс рядом с бедным перекусом → топ-ап окно (безопасность, не дубль)', () => {
    // train-day 14:00: рядом перекус ~13:30 с ~35У < 80% потребности 100У → топ-ап.
    const plan = buildDayPlan(base({ goalCarbsG: 800, goalKcal: 6000, injections: [bolus] as any }));
    const wins = plan.meals.filter(m => (m.label || '').includes('Углеводы под инсулин'));
    expect(wins.length).toBe(1);
    expect(wins[0].totals.c).toBeGreaterThanOrEqual(30);
    expect((wins[0] as any)._insulinWindow).toBe(true);
  });
});

describe('F: бейджи режима дня', () => {
  it('800У/90кг → «Высокоуглеводный», 400Б/110кг → «выше потолка», инсулин → «Инсулин-режим»', () => {
    const hi = buildDayPlan(base({ weightKg: 90, lbmKg: 75, goalCarbsG: 800, goalKcal: 5500, goalProteinG: 200 }));
    expect(hi.notes.some(n => (n || '').includes('Высокоуглеводный'))).toBe(true);
    const hp = buildDayPlan(base({ goalProteinG: 400, goalKcal: 6000 }));
    expect(hp.notes.some(n => (n || '').includes('выше потолка'))).toBe(true);
    const ins = buildDayPlan(base({ injections: [{ type: 'инсулин', time: '10:00', dose: 10, esterType: 'short' }] as any }));
    expect(ins.notes.some(n => (n || '').includes('Инсулин-режим'))).toBe(true);
  });

  it('обычный день — без high-бейджей', () => {
    const plan = buildDayPlan(base({ weightKg: 90, lbmKg: 75, goalKcal: 3000, goalProteinG: 180, goalFatG: 80, goalCarbsG: 400, budget: 'medium' as const, mealsCount: 5 }));
    expect(plan.notes.some(n => (n || '').includes('Высокоуглеводный'))).toBe(false);
    expect(plan.notes.some(n => (n || '').includes('выше потолка'))).toBe(false);
  });
});

describe('D: компонентный скейл рецепта (unit)', () => {
  it('классы: масло/специи/овощи/сладкий фрукт/база', () => {
    expect(recipeComponentClass('olive_oil')).toBe('fat');
    expect(recipeComponentClass('spice_black_pepper')).toBe('seasoning');
    expect(recipeComponentClass('broccoli')).toBe('veg');
    expect(recipeComponentClass('banana')).toBe('base');
    expect(recipeComponentClass('chicken_breast')).toBe('base');
    expect(recipeComponentClass('rice_white')).toBe('base');
  });

  it('×4: база ×4, масло ≤×1.5, специи ≤×1.5, овощи ≤×2', () => {
    expect(scaleComponentAmount('chicken_breast', 150, 4)).toBe(600);
    expect(scaleComponentAmount('olive_oil', 10, 4)).toBe(15);
    expect(scaleComponentAmount('spice_black_pepper', 3, 4)).toBe(5);
    expect(scaleComponentAmount('broccoli', 100, 4)).toBe(200);
  });

  it('×0.5: всё пропорционально вниз', () => {
    expect(scaleComponentAmount('olive_oil', 10, 0.5)).toBe(5);
    expect(scaleComponentAmount('chicken_breast', 150, 0.5)).toBe(75);
  });
});

describe('E: матрица high-volume (products) — сходимость и съедобность', () => {
  const cells: Array<[number, number, number, boolean]> = [
    [80, 500, 200, true], [80, 500, 200, false],
    [110, 800, 220, true], [110, 800, 220, false],
    [110, 800, 300, true], [130, 1000, 300, true],
  ];
  for (const [w, c, p, train] of cells) {
    it(`w${w}/${c}У/${p}Б/${train ? 'train' : 'rest'}: сходимость + съедобность`, () => {
      const f = Math.round(w * 1.0);
      const kcal = Math.round(p * 4 + f * 9 + c * 4);
      const plan = buildDayPlan(base({
        weightKg: w, lbmKg: Math.round(w * 0.84), goalKcal: kcal, goalProteinG: p,
        goalFatG: f, goalCarbsG: c, mealsCount: 7, isTrainingDay: train,
        trainStartMin: train ? 17 * 60 : undefined, trainDurationMin: 90,
        allowIntraWorkout: train,
      }));
      const dC = Math.abs(plan.totals.c - c) / c;
      const dK = Math.abs(plan.totals.kcal - kcal) / kcal;
      expect(dC, `carbs w${w} c${c}`).toBeLessThanOrEqual(0.15);
      expect(dK, `kcal w${w}`).toBeLessThanOrEqual(0.20);
      // Съедобность: приём ≤750 г не-жидкости, порция ≤600 г.
      for (const m of plan.meals) {
        const solid = (m.items || []).filter((it: any) => it.role !== 'liquid').reduce((s: number, it: any) => s + (it.amount || 0), 0);
        expect(solid, `${m.label} вес`).toBeLessThanOrEqual(750);
        for (const it of m.items || []) {
          if (it.role === 'liquid') continue;
          expect(it.amount || 0, `${m.label}/${it.id}`).toBeLessThanOrEqual(600);
        }
      }
      // Peri-капы и в матрице (допуск стражи ×1.05).
      const prew = plan.meals.find(m => m.type === 'preworkout');
      const postw = plan.meals.find(m => m.type === 'postworkout');
      const intra = plan.meals.find(m => m.type === 'intra');
      if (prew) expect(prew.totals.c).toBeLessThanOrEqual(63);
      if (postw) expect(postw.totals.c).toBeLessThanOrEqual(79);
      if (intra) expect(intra.totals.c).toBeLessThanOrEqual(95);
    });
  }
});
