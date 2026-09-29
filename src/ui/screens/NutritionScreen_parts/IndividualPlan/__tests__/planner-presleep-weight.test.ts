import { describe, it, expect } from 'vitest';
import { buildDayPlan, preSleepProteinBudget, type MealPlanInput } from '../meal-plan-engine';

/**
 * E15: ночной приём — белок зависит от ВЕСА (решение пользователя, Sep 29 2026).
 *
 * Было: фикс-бюджет 28 г вне зависимости от веса (малые дни фактически 20–22 г —
 * «подписанная граница» аудита-2; крупные 25–28 г после резки reconciler'а).
 * Стало: бюджет = 0.4 г/кг массы тела (ISSN 2017 «30–40 г казеина» — диапазон
 * для 75–100 кг), кламп 20–45 г: 50 кг → 20, 70 → 28, 90 → 36, 110 → 44.
 * Бюджет задаёт цель ночи и дневной учёт (регулярные приёмы получают остаток).
 * Reconciler режет ночь только до РЕАЛЬНО доступного остатка цели (пол 18 г) —
 * на днях, где регулярные приёмы уже выбрали белок, ночь честно урезается, а не
 * раздувает перебор (M110: защита 44 г давала Б +14.9% против +9.7% у адаптивной).
 *
 * Замер (факт белка ночи, было → стало):
 *   F50: 20–22 → 20–25; M70: 26–28 → 20–33; M85: 26–33 → 21–41; M95: 29–40 → 34–41;
 *   M110: 25–28 → 20–36 (rest-день 36 — полный вес-бюджет, train-день 20 — честный
 *   трим); 500Б: 29 → 46–57; HV1500 R: 42–47.
 */

const mk = (over: Partial<MealPlanInput>): MealPlanInput => ({
  weightKg: 90, lbmKg: 73.8, bodyFatPct: 18, sex: 'male',
  goalKcal: 3000, goalProteinG: 180, goalFatG: 72, goalCarbsG: 408,
  mealsCount: 5, isTrainingDay: true, trainStartMin: 1050, trainDurationMin: 90, allowIntraWorkout: true,
  budget: 'medium', dayOffset: 0, cyclePhase: 'course', variety: 'medium', eveningLowCarb: false,
  ...over,
});

const psPOf = (p: any): number => {
  const ps = (p.meals || []).find((m: any) => m.type === 'presleep');
  return ps ? Math.round((ps.items || []).reduce((s: number, i: any) => s + (i.p || 0), 0)) : -1;
};

describe('E15: бюджет ночного белка зависит от веса', () => {
  it('preSleepProteinBudget: 0.4 г/кг, кламп 20–45', () => {
    expect(preSleepProteinBudget(50)).toBe(20);
    expect(preSleepProteinBudget(60)).toBe(24);
    expect(preSleepProteinBudget(70)).toBe(28);
    expect(preSleepProteinBudget(85)).toBe(34);
    expect(preSleepProteinBudget(90)).toBe(36);
    expect(preSleepProteinBudget(110)).toBe(44);
    expect(preSleepProteinBudget(120)).toBe(45); // потолок
    expect(preSleepProteinBudget(40)).toBe(20);  // пол
    expect(preSleepProteinBudget(undefined)).toBe(32); // дефолт 80 кг
  });

  it('факт ночи масштабируется с весом при одинаковом типе дня (rest)', () => {
    const f50 = buildDayPlan(mk({
      weightKg: 50, lbmKg: 41, sex: 'female', goalKcal: 1200, goalProteinG: 100, goalFatG: 36, goalCarbsG: 119,
      cyclePhase: 'cutting', isTrainingDay: false, trainStartMin: undefined, allowIntraWorkout: false, randomSalt: 1,
    }));
    const m110 = buildDayPlan(mk({
      weightKg: 110, lbmKg: 90, goalKcal: 5000, goalProteinG: 220, goalFatG: 90, goalCarbsG: 827,
      budget: 'max', isTrainingDay: false, trainStartMin: undefined, allowIntraWorkout: false, randomSalt: 1,
    }));
    const psF = psPOf(f50);
    const psM = psPOf(m110);
    expect(psF, `F50: ${psF} г`).toBeGreaterThanOrEqual(18);
    expect(psF).toBeLessThanOrEqual(26);
    expect(psM, `M110: ${psM} г`).toBeGreaterThanOrEqual(30);
    expect(psM).toBeLessThanOrEqual(48);
    expect(psM, `F50 ${psF} vs M110 ${psM}`).toBeGreaterThan(psF);
    expect((f50.meals.find(m => m.type === 'presleep')!.items || []).some((i: any) => i.role === 'slow_protein')).toBe(true);
    expect((m110.meals.find(m => m.type === 'presleep')!.items || []).some((i: any) => i.role === 'slow_protein')).toBe(true);
  });

  it('дни, где регулярные приёмы выбрали цель, ночь честно урезается (не раздувает перебор)', () => {
    // M110 train: белок-ось структурно насыщена (полы цельного мяса) — ночь не
    // «защищается» на 44 г, иначе Б +14.9% вместо +9.7% (доказано дампом).
    const t = buildDayPlan(mk({
      weightKg: 110, lbmKg: 90, goalKcal: 5000, goalProteinG: 220, goalFatG: 90, goalCarbsG: 827,
      budget: 'max', randomSalt: 1,
    }));
    const psT = psPOf(t);
    expect(psT).toBeGreaterThanOrEqual(18);
    expect(psT).toBeLessThanOrEqual(preSleepProteinBudget(110));
    expect(t.deviationPct).toBeLessThanOrEqual(10);
  });

  it('M90: ночь в ISSN-полосе (≥25 г) и вес-бюджет ≥30', () => {
    // Профиль из planner-dietology-guarantees (M90 3200 ккал — день может себе
    // позволить полный вес-бюджет 36 г; ≥25 г держит и отдельный диетологический лок).
    const p = buildDayPlan(mk({ goalKcal: 3200, goalProteinG: 190, goalFatG: 80, goalCarbsG: 400, variety: 'max', randomSalt: 1 }));
    const ps = psPOf(p);
    expect(ps, `M90: ${ps} г`).toBeGreaterThanOrEqual(25);
    expect(preSleepProteinBudget(90)).toBe(36);
  });
});
