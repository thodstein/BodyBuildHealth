import { describe, it, expect } from 'vitest';
import { buildDayPlan } from '../meal-plan-engine';
import { RELIEF_DESSERT_IDS } from '../day-target-corrector';

// Lock-тесты P4 «HV отдельно» (план §3, остаток):
// 1) честный флаг products-пути: при недоборе/сбое >8% — withinTolerance=false
//    + нота «не сошлось» (паритет с recipe-путём), вместо молчаливого мусора;
// 2) сошедшийся день — withinTolerance=true, deviationPct ≤8;
// 3) relief-десерты заданы явно именованным пулом (ровно 4 id).
const normalBase = (overrides: any = {}) => ({
  weightKg: 90, lbmKg: 73.8, bodyFatPct: 18, sex: 'male' as const,
  goalKcal: 3000, goalProteinG: 180, goalFatG: 72, goalCarbsG: 408,
  mealsCount: 5, isTrainingDay: true, trainStartMin: 1050, trainDurationMin: 90, allowIntraWorkout: true,
  budget: 'medium' as const, dayOffset: 0, cyclePhase: 'course' as const, variety: 'medium' as const, eveningLowCarb: false,
  ...overrides,
});

describe('P4 honest flag (products: не сошлось при >8%)', () => {
  it('расходящийся день (1500У+инсулин): флаг false + честная нота', () => {
    const p = buildDayPlan({
      weightKg: 120, lbmKg: 100, bodyFatPct: 16, sex: 'male' as const,
      goalKcal: 8600, goalProteinG: 280, goalFatG: 120, goalCarbsG: 1500,
      mealsCount: 7, isTrainingDay: true, trainStartMin: 17 * 60, trainDurationMin: 90,
      allowIntraWorkout: true, budget: 'max' as const, dayOffset: 0,
      cyclePhase: 'course' as const, variety: 'max' as const, eveningLowCarb: false,
      quality: 'full' as const, randomSalt: 3, carbCapGPerKg: 0,
      wakeTime: '07:00', bedTime: '23:00', dinnerTime: '19:00',
      injections: [
        { type: 'инсулин', name: 'А', time: '08:00', dose: 40, esterType: 'short' },
        { type: 'инсулин', name: 'Б', time: '13:00', dose: 40, esterType: 'short' },
        { type: 'инсулин', name: 'В', time: '19:30', dose: 40, esterType: 'short' },
      ] as any,
    } as any);
    expect((p as any).deviationPct).toBeGreaterThan(8);
    expect((p as any).withinTolerance).toBe(false);
    expect(((p as any).notes || []).join('\n')).toMatch(/не сошлось/i);
  });
  it('сошедшийся день: флаг true, deviationPct ≤8', () => {
    const p = buildDayPlan(normalBase({ dayOffset: 1 }));
    expect((p as any).withinTolerance).toBe(true);
    expect((p as any).deviationPct).toBeLessThanOrEqual(8);
  });
  it('relief-десерты — явный пул из 4 id', () => {
    expect([...RELIEF_DESSERT_IDS].sort()).toEqual(['dates', 'honey', 'jam', 'pryaniki']);
  });
});
