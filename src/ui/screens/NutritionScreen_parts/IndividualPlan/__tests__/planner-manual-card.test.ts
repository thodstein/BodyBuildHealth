import { describe, it, expect } from 'vitest';
import { buildDayTargets } from '../planner-day-targets';
import { buildDayPlan } from '../meal-plan-engine';

// Lock-тест карточки ручного ввода (жалоба «по ней не собирается рацион»):
// г/кг-степперы писали только в manualGPerKg → computePlannerTargets, который
// manual-ветка игнорирует целиком. Теперь г/кг — фолбэк граммов в ручном режиме.
const IN = (over: any = {}) => ({
  weightKg: 90, presetGPerKg: 2, fatFloorGPerKg: 0.8,
  kbjuMode: 'manual' as const, manual: { kcal: null, p: null, f: null, c: null },
  calcTargets: { bmr: 0, tdee: 0, kcal: 2500, protein: 160, fats: 70, carbs: 300, adjustment: 0 },
  profileTargets: { bmr: 0, tdee: 0, kcal: 2500, protein: 160, fats: 70, carbs: 300, adjustment: 0 },
  goal: 'mass' as const,
  ...over,
});

describe('ручная карточка: г/кг собираются в рацион', () => {
  it('только г/кг (без граммов): белок/жиры/угли считаются от веса', () => {
    const r = buildDayTargets(IN({
      manual: { kcal: null, p: null, f: null, c: null, gPerKg: { protein: 2.2, fat: 1.0, carbs: 4.0 } },
    }));
    expect(r.protein).toBe(Math.round(90 * 2.2));
    expect(r.fats).toBe(Math.round(90 * 1.0));
    expect(r.carbs).toBe(Math.round(90 * 4.0));
    expect(r.kcal).toBe(r.protein * 4 + r.fats * 9 + r.carbs * 4);
  });
  it('явные граммы приоритетнее г/кг', () => {
    const r = buildDayTargets(IN({
      manual: { kcal: null, p: 200, f: null, c: null, gPerKg: { protein: 2.2, fat: 1.0, carbs: 4.0 } },
    }));
    expect(r.protein).toBe(200);
    expect(r.fats).toBe(Math.round(90 * 1.0));
    expect(r.carbs).toBe(Math.round(90 * 4.0));
  });
  it('без г/кг — legacy: пустые граммы дают ~0, а не мусор', () => {
    const r = buildDayTargets(IN({}));
    expect(r.protein).toBe(0);
    expect(r.carbs).toBe(0);
  });
  it('рацион сходится под г/кг-цели (сквозной прогон движка)', () => {
    const t = buildDayTargets(IN({
      manual: { kcal: null, p: null, f: null, c: null, gPerKg: { protein: 2.0, fat: 0.9, carbs: 4.5 } },
    }));
    expect(t.protein).toBeGreaterThan(100);
    const p = buildDayPlan({
      weightKg: 90, lbmKg: 73.8, bodyFatPct: 18, sex: 'male' as const,
      goalKcal: t.kcal, goalProteinG: t.protein, goalFatG: t.fats, goalCarbsG: t.carbs,
      mealsCount: 5, isTrainingDay: true, trainStartMin: 1050, trainDurationMin: 90, allowIntraWorkout: true,
      budget: 'medium' as const, dayOffset: 0, cyclePhase: 'course' as const, variety: 'medium' as const, eveningLowCarb: false,
    } as any);
    expect(p.totals.p / t.protein).toBeGreaterThan(0.85);
    expect(p.totals.c / t.carbs).toBeGreaterThan(0.85);
  });
});
