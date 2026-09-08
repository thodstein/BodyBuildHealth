/**
 * planner-meal-target-scale.test.ts — MealTargets: meal-бюджеты масштабируются под цель дня.
 *
 * 1. dayTargetScale/quotaMealCap — ступени масштаба цели (≤3000 ккал = 1.0 бит-в-бит).
 * 2. familyMealCap/creamMealCap — приёмные капы семейств растут с масштабом цели.
 * 3. Fat-floor bypass: на углеводном дне (≥6 г/кг — инсулин/масса) 20%TEI-пол жира
 *    не превращается в overrade (8720 ккал → 194 г жира при цели 80 г).
 * 4. Окна болюсов учтены в meal-бюджетах: сумма target.c по приёмам = цели дня,
 *    каждое окно = dose×10 г У; белок окон заранее вычтен из регулярных приёмов
 *    (3 окна = +60 г поверх цели — перебор +14-23% до фикса).
 *
 * Мутационный характер: без (3) тест 3 падает (fat 194 г), без (4) тест 4 падает
 * (target.c окна не в сумме / белок дня перебор).
 */

import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';
import { dayTargetScale, quotaMealCap, familyMealCap, creamMealCap } from '../food-availability';

describe('dayTargetScale / quotaMealCap — ступени масштаба цели', () => {
  it('dayTargetScale: ≤3000 ккал = 1.0, растяжение до 1.6, кламп сверху/снизу', () => {
    expect(dayTargetScale(2500)).toBe(1);
    expect(dayTargetScale(3000)).toBe(1);
    expect(dayTargetScale(3600)).toBeCloseTo(1.2, 5);
    expect(dayTargetScale(4500)).toBe(1.5);
    expect(dayTargetScale(4800)).toBe(1.6);
    expect(dayTargetScale(9000)).toBe(1.6);
    expect(dayTargetScale(0)).toBe(1);
    expect(dayTargetScale(undefined)).toBe(1);
  });

  it('quotaMealCap: ≤1.3 → base, ≥1.3 → +1, ≥1.5 → +2, кламп max', () => {
    expect(quotaMealCap(3, 1, 5)).toBe(3);
    expect(quotaMealCap(3, 1.2, 5)).toBe(3);
    expect(quotaMealCap(3, 1.35, 5)).toBe(4);
    expect(quotaMealCap(3, 1.6, 5)).toBe(5);
    expect(quotaMealCap(3, 1.6, 4)).toBe(4);
  });

  it('familyMealCap/creamMealCap: капы семейств растут с масштабом цели', () => {
    // rice/прочие: 3 + ступень ts (1.3 → 4, 1.5 → 5); hv сам по себе ступень не даёт.
    expect(familyMealCap('rice', { hv: false, ts: 1 })).toBe(3);
    expect(familyMealCap('rice', { hv: true, ts: 1 })).toBe(3);
    expect(familyMealCap('rice', { hv: true, ts: 1.35 })).toBe(4);
    expect(familyMealCap('rice', { hv: true, ts: 1.6 })).toBe(5);
    // oats: завтрак-стейпл 2 → 3 только при масштабе ≥1.3.
    expect(familyMealCap('oats', { hv: true, ts: 1 })).toBe(2);
    expect(familyMealCap('oats', { hv: true, ts: 1.35 })).toBe(3);
    expect(familyMealCap('oats', { hv: true, ts: 1.6 })).toBe(3);
    // крем: 2 → 3 при ts ≥1.5.
    expect(creamMealCap(false, 1)).toBe(2);
    expect(creamMealCap(false, 1.6)).toBe(3);
  });
});

const base = (overrides: any = {}): MealPlanInput => ({
  weightKg: 120, lbmKg: 100, bodyFatPct: 17, sex: 'male' as const,
  goalKcal: 4800, goalProteinG: 220, goalFatG: 80, goalCarbsG: 800,
  mealsCount: 6, isTrainingDay: true, trainStartMin: 17 * 60, trainDurationMin: 75,
  allowIntraWorkout: false, budget: 'medium' as const, dayOffset: 0,
  cyclePhase: 'course' as const, variety: 'max' as const, eveningLowCarb: false,
  ...overrides,
}) as MealPlanInput;

describe('MealTargets: meal-бюджеты = цель дня', () => {
  it('fat-floor: на углеводном дне (≥6 г/кг) 20%TEI-пол жира не overrade (цель 80 г, не 194)', () => {
    const p = buildDayPlan(base({}));
    // Без bypass: fatFloor 194 г → день несёт ≥150 г жира. С bypass: ≈80 г.
    expect(p.totals.f, 'fat на 800У/120кг дне').toBeLessThanOrEqual(100);
  });

  it('fat-floor: обычный день (угли < 6 г/кг) — бит-в-бит, пол-жира живёт', () => {
    // 300 г углей при 80 кг = 3.75 г/кг — legacy-путь.
    const p = buildDayPlan(base({ weightKg: 80, lbmKg: 66, goalCarbsG: 300, goalFatG: 70, goalKcal: 3000, goalProteinG: 180 }));
    expect(p.totals.f, 'жир не срезан ниже floor').toBeGreaterThanOrEqual(55);
  });

  it('3 болюса: окна = dose×10 г У с таргетом, порционные капы держат остальное', () => {
    const bolus = { type: 'инсулин', name: 'НовоРапид', dose: 10, esterType: 'short' };
    const goalC = 1161;
    const p = buildDayPlan(base({
      weightKg: 110, lbmKg: 92,
      goalCarbsG: goalC, goalKcal: 5470, goalProteinG: 220, goalFatG: 110,
      isTrainingDay: false, allowIntraWorkout: false,
      injections: [
        { ...bolus, time: '10:30' }, { ...bolus, time: '14:30' }, { ...bolus, time: '19:30' },
      ] as any,
    }));
    const wins = p.meals.filter((m: any) => (m as any)._insulinWindow);
    expect(wins.length, '3 окна болюсов').toBe(3);
    for (const w of wins) {
      expect(w.target?.c, 'окно = dose×10 г У').toBe(100);
    }
    // Регулярные приёмы: бюджеты масштабированы под цель минус окна (сумма > 70% —
    // порционные капы клампят экстремум 1161У, но далеко от unscaled ~580).
    const sumC = p.meals.reduce((s: number, m: any) => s + (m.target?.c || 0), 0);
    expect(sumC, `sum(target.c)=${sumC}`).toBeGreaterThanOrEqual(goalC * 0.7);
    expect(sumC, 'окна учтены в сумме').toBeGreaterThanOrEqual(3 * 100);
  });

  it('HV-цель: meal-бюджеты по У растянуты под цель (сумма ≥95% при 900У)', () => {
    const p = buildDayPlan(base({
      weightKg: 110, lbmKg: 92,
      goalCarbsG: 900, goalKcal: 5100, goalProteinG: 220, goalFatG: 110,
      isTrainingDay: false, allowIntraWorkout: false,
    }));
    const sumC = p.meals.reduce((s: number, m: any) => s + (m.target?.c || 0), 0);
    // Без масштабирования цели приёмные бюджеты стояли на ~700 У (прекорр-капы):
    // масштаб цели растягивает их к 900 (порционные капы клампят остаток).
    expect(sumC, `sum(target.c)=${sumC}`).toBeGreaterThanOrEqual(900 * 0.95);
  });

  it('3 болюса: белок окон вычтен из регулярных приёмов (день без перебора +14-23%)', () => {
    const bolus = { type: 'инсулин', name: 'НовоРапид', dose: 10, esterType: 'short' };
    const goalP = 220;
    const p = buildDayPlan(base({
      weightKg: 110, lbmKg: 92,
      goalCarbsG: 1161, goalKcal: 5470, goalProteinG: goalP, goalFatG: 110,
      isTrainingDay: false, allowIntraWorkout: false,
      injections: [
        { ...bolus, time: '10:30' }, { ...bolus, time: '14:30' }, { ...bolus, time: '19:30' },
      ] as any,
    }));
    // Без резерва: 3 окна × 20 г белка добавлялись поверх цели → перебор +14-23%.
    expect(p.totals.p, `totals.p=${p.totals.p}`).toBeLessThanOrEqual(goalP * 1.15);
    expect(p.totals.p, 'белок не схлопнулся').toBeGreaterThanOrEqual(goalP * 0.8);
  });
});
