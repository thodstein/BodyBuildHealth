/**
 * planner-calorie-circuit.test.ts — P0/P1-фиксы калорийного контура (Этап 1).
 *
 *  1. Bulk-профицит: от maintenance-TDEE, без магического сентинела «10» (нет разрыва 10→11).
 *  2. manualGPerKg не загрязняет auto-калории (применяется только в ручном режиме).
 *  3. weightLogPeriod учитывается (недельный лог не завышает темп ×7).
 *  4. Фарма-надбавка белка (ААС/GLP) доезжает до цели дня.
 *  5. esterType 'none' не считается коротким инсулином.
 */
import { describe, it, expect } from 'vitest';
import { computePlannerTargets } from '../planner-targets';
import { buildDayTargets } from '../planner-day-targets';

const base = (overrides: any = {}) => ({
  weightKg: 90, heightCm: 180, age: 30, sex: 'male' as const, goal: 'mass', phase: 'course', bodyFatPct: 15,
  workoutsPerWeek: 4, avgWorkoutMinutes: 75, dailySteps: 9000, householdActivity: 'moderate', trainType: 'mixed',
  trainIntensity: 'high', surplusPct: 10, injections: [] as any[], weightAdaptMode: false, weightLogWeek: [] as number[],
  expectedLossKgWeek: 0, metabolicAdaptEnabled: false, metabolicAdaptPct: 0, manualGPerKg: { protein: 0, fat: 0, carbs: 0 },
  ...overrides,
});

describe('P0: bulk-профицит — базис maintenance + без сентинела', () => {
  it('нет разрыва: 11% даёт ровно на ~1% больше 10%', () => {
    const r10 = computePlannerTargets(base({ surplusPct: 10 }));
    const r11 = computePlannerTargets(base({ surplusPct: 11 }));
    expect(r11.kcal).toBeGreaterThan(r10.kcal);
    expect(r11.kcal / r10.kcal).toBeCloseTo(1.11 / 1.10, 2);
  });
  it('профицит 0 не задан → дефолт V2 (mass), 10% выше', () => {
    const r0 = computePlannerTargets(base({ surplusPct: 0 }));
    const r10 = computePlannerTargets(base({ surplusPct: 10 }));
    expect(r10.kcal).toBeGreaterThan(r0.kcal);
  });
});

describe('P0: manualGPerKg не течёт в auto', () => {
  it('auto: manualGPerKg игнорируется', () => {
    const withMg = computePlannerTargets(base({ kbjuMode: 'auto', manualGPerKg: { protein: 2.5, fat: 1.2, carbs: 5 } }));
    const without = computePlannerTargets(base({ kbjuMode: 'auto', manualGPerKg: { protein: 0, fat: 0, carbs: 0 } }));
    expect(withMg.kcal).toBe(without.kcal);
    expect(withMg.protein).toBe(without.protein);
  });
  it('manual: manualGPerKg применяется', () => {
    const r = computePlannerTargets(base({ kbjuMode: 'manual', manualGPerKg: { protein: 2.5, fat: 1, carbs: 4 } }));
    expect(r.protein).toBe(Math.round(90 * 2.5));
    expect(r.fats).toBe(Math.round(90 * 1));
    expect(r.carbs).toBe(Math.round(90 * 4));
  });
});

describe('P1: weightLogPeriod учитывается', () => {
  it('недельный лог (2 точки, 0.5 кг/нед) не завышает темп ×7', () => {
    const weekly = computePlannerTargets(base({
      goal: 'cutting', weightAdaptMode: true, weightLogWeek: [90, 89.5], weightLogPeriod: 'weekly', expectedLossKgWeek: 0.5,
    }));
    const daily = computePlannerTargets(base({
      goal: 'cutting', weightAdaptMode: true, weightLogWeek: [90, 89.5], weightLogPeriod: 'daily', expectedLossKgWeek: 0.5,
    }));
    // weekly: 0.5 кг/нед — в коридоре → weightAdj 1.0; daily: 3.5 кг/нед → weightAdj > 1 (ккал выше)
    expect(weekly.kcal).toBeLessThan(daily.kcal);
  });
});

describe('P1: фарма-надбавка белка доезжает до дня', () => {
  it('pharmaProteinBoostG повышает белок auto-дня', () => {
    const mk = (boost: number) => buildDayTargets({
      weightKg: 90, presetGPerKg: 2.0, fatFloorGPerKg: 0.8, kbjuMode: 'auto',
      calcTargets: computePlannerTargets(base({})),
      profileTargets: computePlannerTargets(base({ goal: 'maintenance', phase: 'maintenance' })),
      goal: 'mass', trainingVolumeMinPerWeek: 300, budget: 'medium', insulinTotalUnits: 0,
      pharmaProteinBoostG: boost,
    });
    const plain = mk(0);
    const boosted = mk(27); // 0.3 г/кг × 90
    expect(boosted.protein).toBe(plain.protein + 27);
    expect(boosted.breakdown.some(b => b.includes('Фарма-надбавка белка'))).toBe(true);
  });
  it('кап 2.6 г/кг соблюдается', () => {
    const r = buildDayTargets({
      weightKg: 90, presetGPerKg: 2.2, fatFloorGPerKg: 0.8, kbjuMode: 'auto',
      calcTargets: computePlannerTargets(base({})),
      profileTargets: computePlannerTargets(base({ goal: 'maintenance', phase: 'maintenance' })),
      goal: 'mass', trainingVolumeMinPerWeek: 300, budget: 'medium', insulinTotalUnits: 0,
      pharmaProteinBoostG: 999,
    });
    expect(r.protein).toBeLessThanOrEqual(Math.round(90 * 2.6));
  });
});

describe('P1: esterType none не короткий инсулин', () => {
  it('инсулин с esterType=none не включает углеводный флор', () => {
    const noIns = computePlannerTargets(base({ goal: 'cutting', injections: [] }));
    const noneIns = computePlannerTargets(base({ goal: 'cutting', injections: [{ type: 'инсулин', dose: 40, esterType: 'none' }] }));
    // углеводный флор (10 г/ЕД) НЕ применяется при 'none' → carbs не растут
    expect(noneIns.carbs).toBe(noIns.carbs);
  });
  it('короткий инсулин (rapid) включает флор углеводов', () => {
    const noIns = computePlannerTargets(base({ goal: 'cutting', injections: [] }));
    const rapid = computePlannerTargets(base({ goal: 'cutting', injections: [{ type: 'инсулин', dose: 100, esterType: 'rapid' }] }));
    expect(rapid.carbs).toBeGreaterThan(noIns.carbs);
  });
});
