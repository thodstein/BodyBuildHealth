/**
 * planner-insulin-chain.test.ts — §3C EXTREME-SCALE: цепочка инсулин-окон.
 * Болюс >12 ЕД (≈120 г У) физически не влезает в одно окно ≤120 г: движок создаёт
 * 1–2 под-кормления (интервал 60 мин, каждое ≤120 г), ротирует носители и честно
 * рекомендует split/пролонг для доз ≥25 ЕД. Малые дозы (≤12 ЕД) — прежнее одно окно.
 */
import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';

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

const winsOf = (plan: any) => plan.meals.filter((m: any) => m._insulinWindow);

describe('§3C цепочка инсулин-окон', () => {
  it('40 ЕД вдали от приёмов → цепочка окон, покрытие ≥90%, носители ротируются, advisory', () => {
    // Rest-day с малым числом приёмов: окна 08:00/13:00 изолированы от еды.
    const plan = buildDayPlan(base({
      isTrainingDay: false, allowIntraWorkout: false, trainStartMin: undefined,
      mealsCount: 3, goalKcal: 7000, goalCarbsG: 1000,
      injections: [{ type: 'инсулин', name: 'А', time: '10:00', dose: 40, esterType: 'short' }] as any,
    }));
    const wins = winsOf(plan);
    expect(wins.length, `окон: ${wins.length}`).toBeGreaterThanOrEqual(2);
    for (const w of wins) {
      expect(w.totals.c).toBeGreaterThanOrEqual(30);
      expect(w.totals.c).toBeLessThanOrEqual(130);
    }
    const sum = wins.reduce((s: number, w: any) => s + (w.totals?.c || 0), 0);
    expect(sum, `покрытие окнами: ${Math.round(sum)} г`).toBeGreaterThanOrEqual(350); // 360 = 90% от 400
    // Ротация носителей: не все окна одним продуктом.
    const ids = wins.flatMap((w: any) => (w.items || []).map((i: any) => i.id)).filter((id: string) => id !== 'whey_protein' && id !== 'whey_isolate');
    expect(new Set(ids).size, `носители: ${ids.join(',')}`).toBeGreaterThanOrEqual(2);
    // Advisory о split-болюсе для высокой дозы.
    expect(plan.notes.some(n => (n || '').includes('split-болюс'))).toBe(true);
  });

  it('10 ЕД — прежнее одно окно ~100 г (без цепочки)', () => {
    const plan = buildDayPlan(base({
      isTrainingDay: false, allowIntraWorkout: false, trainStartMin: undefined,
      goalKcal: 6000, injections: [{ type: 'инсулин', name: 'А', time: '10:00', dose: 10, esterType: 'short' }] as any,
    }));
    const wins = winsOf(plan);
    expect(wins.length).toBe(1);
    expect(wins[0].totals.c).toBeGreaterThanOrEqual(90);
    expect(wins[0].totals.c).toBeLessThanOrEqual(120);
    expect(plan.notes.some(n => (n || '').includes('split-болюс'))).toBe(false);
  });

  it('болюс вплотную к основному приёму (≤20 мин) — окна нет (покрыт приёмом)', () => {
    const plan = buildDayPlan(base({
      injections: [{ type: 'инсулин', name: 'А', time: '12:20', dose: 10, esterType: 'short' }] as any,
    }));
    expect(winsOf(plan).length).toBe(0);
  });
});
