import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';

/**
 * E14: per-meal бюджет больших КБЖУ — сводимость без «роста одной тарелки».
 *
 * Дефект: на больших НЕ-экстремальных HV-днях (M110 5000: carbs 7.5 г/кг ≥6.5 →
 * highVolumeDay) E0-reconciliation был выключен целиком (skip как у экстримов) —
 * день оставался 5–12% (белок-перебор + углевод-недобор) «best-effort». Фикс:
 * большие дни (HV, но НЕ capacity-экстрим, <6000 ккал, без инсулин-окон) снова
 * проходят reconciliation, а growCap получает бюджет ТАРЕЛКИ приёма — рост
 * ограничен 700 г твёрдого, комната делится между растущими позициями (иначе
 * недобор закрывался одной тарелкой >700). Экстримы (1500У/инсулин/≥6000) —
 * прежний skip (свои проходы §3D/E15).
 *
 * Замер (было → стало max-dev, M110-5000):
 *   T s1: 12.2% → 7.4% (оси выровнены: К4.0 Б7.4 Ж7.4 У6.1; тарелки ≤471 г);
 *   T s2: 5.9% → 1.7% (withinTolerance=true); R s1: 5.1% → 0.2% (true).
 *   HV1500 (capacity-экстрим): не тронут, max тарелка ≤724 г (кап 900) — E15-граница.
 */

const M110 = (over: Partial<MealPlanInput>): MealPlanInput => ({
  weightKg: 110, lbmKg: 90, bodyFatPct: 16, sex: 'male',
  goalKcal: 5000, goalProteinG: 220, goalFatG: 90, goalCarbsG: 827,
  mealsCount: 5, isTrainingDay: true, trainStartMin: 1050, trainDurationMin: 90, allowIntraWorkout: true,
  budget: 'max', dayOffset: 0, cyclePhase: 'course', variety: 'medium', eveningLowCarb: false,
  ...over,
});

const solidOf = (m: any): number => (m.items || []).filter((i: any) => i.role !== 'liquid').reduce((s: number, i: any) => s + (i.amount || 0), 0);
const devOf = (p: any, inp: MealPlanInput): number => Math.max(
  Math.abs(p.totals.kcal - inp.goalKcal) / inp.goalKcal,
  Math.abs(p.totals.p - inp.goalProteinG) / inp.goalProteinG,
  Math.abs(p.totals.f - inp.goalFatG) / inp.goalFatG,
  Math.abs(p.totals.c - inp.goalCarbsG) / inp.goalCarbsG,
);

describe('E14: бюджет больших дней (M110 5000)', () => {
  it('T s1: dev 12.2→7.4%, тарелки ≤700 г, флаг честный', () => {
    const inp = M110({ randomSalt: 1 });
    const p = buildDayPlan(inp);
    const dev = devOf(p, inp) * 100;
    expect(dev, `dev=${dev.toFixed(1)}%`).toBeLessThanOrEqual(8);
    for (const m of p.meals) {
      expect(solidOf(m), `${m.label}: ${solidOf(m)} г`).toBeLessThanOrEqual(700);
    }
    if (!p.withinTolerance) expect(p.notes.some(n => n.includes('«Не сошлось»'))).toBe(true);
  });

  it('T s2 и R s1: день сходится ≤3% (было 5.9%/5.1%)', () => {
    for (const [label, inp] of [
      ['T s2', M110({ randomSalt: 2 })],
      ['R s1', M110({ isTrainingDay: false, trainStartMin: undefined, allowIntraWorkout: false, randomSalt: 1 })],
    ] as const) {
      const p = buildDayPlan(inp);
      expect(p.withinTolerance, `${label}: dev=${p.deviationPct}%`).toBe(true);
      expect(devOf(p, inp) * 100, label).toBeLessThanOrEqual(3);
      for (const m of p.meals) {
        expect(solidOf(m), `${label} ${m.label}: ${solidOf(m)} г`).toBeLessThanOrEqual(700);
      }
    }
  });

  it('экстремум HV1500 не тронут гейтом: тарелки ≤900 г, флаг честный', () => {
    const inp: MealPlanInput = {
      weightKg: 100, lbmKg: 82, bodyFatPct: 16, sex: 'male',
      goalKcal: 7520, goalProteinG: 200, goalFatG: 80, goalCarbsG: 1500,
      mealsCount: 5, isTrainingDay: false, allowIntraWorkout: false,
      budget: 'max', dayOffset: 1, cyclePhase: 'course', variety: 'medium', eveningLowCarb: false,
      randomSalt: 1,
    };
    const p = buildDayPlan(inp);
    for (const m of p.meals) {
      expect(solidOf(m), `${m.label}: ${solidOf(m)} г`).toBeLessThanOrEqual(900);
    }
    // Экстремум честно несошедшийся (capacity-профиль) — не «тихая подгонка».
    expect(p.withinTolerance).toBe(false);
  });

  it('детерминизм большого дня', () => {
    const inp = M110({ randomSalt: 2 });
    const a = buildDayPlan(inp);
    const b = buildDayPlan(inp);
    expect(JSON.stringify(a.meals)).toBe(JSON.stringify(b.meals));
  });
});
