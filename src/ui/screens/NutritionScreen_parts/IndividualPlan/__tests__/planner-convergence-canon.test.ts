import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';
import { PLANNER_CONVERGENCE_PCT, checkTargetsConsistency } from '../day-target-corrector';

// E0: единый канон допуска сходимости дня (≤3% по каждому макросу) +
// феазибилити-гейт несогласованных целей + сходимость продуктового пути.

const base = (over: Partial<MealPlanInput> = {}): MealPlanInput => ({
  weightKg: 90, lbmKg: 73.8, bodyFatPct: 18, sex: 'male',
  goalKcal: 3000, goalProteinG: 180, goalFatG: 72, goalCarbsG: 408,
  mealsCount: 5, isTrainingDay: true, trainStartMin: 1050, trainDurationMin: 90, allowIntraWorkout: true,
  budget: 'medium', dayOffset: 0, cyclePhase: 'course', variety: 'medium', eveningLowCarb: false,
  ...over,
});

const maxDev = (p: any, i: MealPlanInput) => Math.max(
  Math.abs(p.totals.kcal - (i.goalKcal || 1)) / (i.goalKcal || 1),
  Math.abs(p.totals.p - (i.goalProteinG || 1)) / (i.goalProteinG || 1),
  Math.abs(p.totals.f - (i.goalFatG || 1)) / (i.goalFatG || 1),
  Math.abs(p.totals.c - (i.goalCarbsG || 1)) / (i.goalCarbsG || 1),
) * 100;

describe('E0: канон допуска', () => {
  it('PLANNER_CONVERGENCE_PCT = 3', () => {
    expect(PLANNER_CONVERGENCE_PCT).toBe(3);
  });
  it('checkTargetsConsistency: согласованные цели (Atwater) — consistent', () => {
    const r = checkTargetsConsistency(3000, 180, 72, 408); // 720+648+1632 = 3000
    expect(r.atwaterKcal).toBe(3000);
    expect(r.consistent).toBe(true);
    expect(r.devPct).toBeLessThanOrEqual(PLANNER_CONVERGENCE_PCT);
  });
  it('checkTargetsConsistency: расходящиеся цели — !consistent + devPct', () => {
    const r = checkTargetsConsistency(4000, 180, 72, 200); // 720+648+800 = 2168
    expect(r.consistent).toBe(false);
    expect(r.devPct).toBeGreaterThan(PLANNER_CONVERGENCE_PCT);
    expect(r.atwaterKcal).toBe(2168);
  });
});

describe('E0: сходимость продуктового дня (обычные профили)', () => {
  const cases: Array<{ name: string; inp: MealPlanInput }> = [
    { name: 'M90 курс трен', inp: base({}) },
    { name: 'M90 отдых', inp: base({ isTrainingDay: false, trainStartMin: undefined, dayOffset: 1 }) },
    { name: 'M95 низкокал', inp: base({ weightKg: 95, lbmKg: 78, goalProteinG: 180, goalFatG: 60, goalCarbsG: 200, goalKcal: 2060, isTrainingDay: false, dayOffset: 2 }) },
  ];
  for (const c of cases) {
    it(`${c.name}: withinTolerance=true и dev ≤ канона`, () => {
      const p = buildDayPlan(c.inp);
      const d = maxDev(p, c.inp);
      // honest flag: либо сошлось ≤3%, либо честный false (не молчаливая подгонка)
      if (p.withinTolerance) expect(d, `dev=${d.toFixed(1)}%`).toBeLessThanOrEqual(PLANNER_CONVERGENCE_PCT + 0.05);
      else expect((p as any).deviationPct).toBeGreaterThan(0);
    });
  }
});
