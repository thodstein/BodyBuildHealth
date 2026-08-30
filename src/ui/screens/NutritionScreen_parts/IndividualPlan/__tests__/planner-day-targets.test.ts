/**
 * planner-day-targets.test.ts — Эпик A (NUTRITION-PLANNER-QUALITY-PLAN, Aug 30 2026).
 * Инварианты единой целевой арифметики buildDayTargets:
 *  - наука (TDEE/surplus/фаза/фарма/weight-adapt) задаёт калораж;
 *  - пресет белка — оверрайд;
 *  - углеводы — остаток до калоража (диетпотолок);
 *  - manual/profile — обратно-совместимы.
 */
import { describe, it, expect } from 'vitest';
import { buildDayTargets } from '../planner-day-targets';
import type { PlannerTargets } from '../planner-targets';

const base = (over: Partial<PlannerTargets> = {}): PlannerTargets => ({
  bmr: 1700, tdee: 3000, kcal: 3000, protein: 180, fats: 80, carbs: 310, adjustment: 0, ...over,
});
const prof = (over: Partial<PlannerTargets> = {}): PlannerTargets => ({
  bmr: 1700, tdee: 2500, kcal: 2500, protein: 160, fats: 70, carbs: 280, adjustment: 0, ...over,
});
const IN = (over: Partial<Parameters<typeof buildDayTargets>[0]> = {}) => ({
  weightKg: 80, presetGPerKg: 2.0, fatFloorGPerKg: 0.8, kbjuMode: 'auto' as const,
  calcTargets: base(), profileTargets: prof(), goal: 'mass',
  trainingVolumeMinPerWeek: 360, budget: 'medium', insulinTotalUnits: 0,
  ...over,
});

describe('buildDayTargets — auto: наука задаёт калораж', () => {
  it('surplus 15% (ккал 3450) даёт больше углей/ккал, чем surplus 5% (3050) при том же белке', () => {
    const lo = buildDayTargets(IN({ calcTargets: base({ kcal: 3050 }) }));
    const hi = buildDayTargets(IN({ calcTargets: base({ kcal: 3450 }) }));
    expect(lo.protein).toBe(160); // пресет фиксирует белок
    expect(hi.protein).toBe(160);
    expect(hi.carbs).toBeGreaterThan(lo.carbs);
    expect(hi.kcal).toBeGreaterThan(lo.kcal);
    // разница калоража ≈ разница углей ×4 (остаток уходит в углеводы)
    const dKcal = hi.kcal - lo.kcal;
    const dCarbs = hi.carbs - lo.carbs;
    expect(Math.abs(dKcal - dCarbs * 4)).toBeLessThanOrEqual(6);
  });

  it('weight-adapt: сниженный calcTargets.kcal снижает цель (наука доезжает)', () => {
    const normal = buildDayTargets(IN({ calcTargets: base({ kcal: 3000 }) }));
    const adapted = buildDayTargets(IN({ calcTargets: base({ kcal: 2700 }) }));
    expect(adapted.kcal).toBeLessThan(normal.kcal);
    expect(adapted.carbs).toBeLessThan(normal.carbs);
  });

  it('AAS-белок выше пресета — пресет приоритетен, но breakdown предупреждает', () => {
    const r = buildDayTargets(IN({ calcTargets: base({ protein: 210 }) })); // 80 кг: 2.0 пресет = 160
    expect(r.protein).toBe(160);
    expect(r.breakdown.some(s => s.includes('выше пресета'))).toBe(true);
  });

  it('kcal = Atwater от фактических макросов (display == генерация)', () => {
    const r = buildDayTargets(IN());
    expect(r.kcal).toBe(Math.round(r.protein * 4 + r.fats * 9 + r.carbs * 4));
  });

  it('жиры: пол 0.8 г/кг применяется (64 г при 80 кг), если наука ниже', () => {
    const r = buildDayTargets(IN({ calcTargets: base({ fats: 50 }) }));
    expect(r.fats).toBe(64);
  });

  it('жиры: научный кап инсулина 0.5 г/кг сильнее пола', () => {
    const r = buildDayTargets(IN({ insulinTotalUnits: 10, calcTargets: base({ fats: 80 }) }));
    expect(r.fats).toBe(40); // 80 × 0.5
    expect(r.breakdown.some(s => s.includes('инсулин'))).toBe(true);
  });

  it('потолок углей не срезает bulk на 8 г/кг при большом объёме', () => {
    // 90 кг, bulk, 720 мин/нед → потолок 8 г/кг = 720 г
    const r = buildDayTargets(IN({
      weightKg: 90, goal: 'mass', trainingVolumeMinPerWeek: 720,
      calcTargets: base({ kcal: 4200, tdee: 3600 }),
    }));
    // raw = (4200 − 180×4 − 72×9)/4 = (4200 − 720 − 648)/4 = 708 → под потолком 720
    expect(r.carbs).toBeGreaterThan(650);
    expect(r.breakdown.some(s => s.includes('Потолок углей срезал'))).toBe(false);
  });

  it('cut: дефицитный калораж даёт меньше углей/ккал, чем mass, белок пресета удержан', () => {
    const cut = buildDayTargets(IN({ goal: 'fat_loss', calcTargets: base({ kcal: 2200, tdee: 3000 }) }));
    const mass = buildDayTargets(IN({ goal: 'mass', calcTargets: base({ kcal: 3400, tdee: 3000 }) }));
    expect(cut.protein).toBe(160);
    expect(cut.carbs).toBeLessThan(mass.carbs);
    expect(cut.kcal).toBeLessThan(mass.kcal);
  });

  it('breakdown непустой и упоминает TDEE и итог', () => {
    const r = buildDayTargets(IN());
    expect(r.breakdown.length).toBeGreaterThanOrEqual(4);
    expect(r.breakdown.some(s => s.includes('TDEE'))).toBe(true);
    expect(r.breakdown.some(s => s.startsWith('Итог дня'))).toBe(true);
  });

  it('детерминизм: одинаковый вход → одинаковый выход', () => {
    const a = buildDayTargets(IN());
    const b = buildDayTargets(IN());
    expect(a).toEqual(b);
  });
});

describe('buildDayTargets — manual (обратно-совместимо)', () => {
  it('все ручные значения заданы — используются как есть', () => {
    const r = buildDayTargets(IN({ kbjuMode: 'manual', manual: { kcal: 3200, p: 180, f: 90, c: 330 } }));
    expect(r).toMatchObject({ kcal: 3200, protein: 180, fats: Math.max(64, 90), carbs: 330 });
  });

  it('manualC = null → угли выводятся из manualKcal − Б − Ж', () => {
    const r = buildDayTargets(IN({ kbjuMode: 'manual', manual: { kcal: 3000, p: 170, f: 80, c: null } }));
    expect(r.carbs).toBe(Math.round((3000 - 170 * 4 - 80 * 9) / 4));
  });

  it('manual: жиры не ниже пола 0.8 г/кг', () => {
    const r = buildDayTargets(IN({ kbjuMode: 'manual', manual: { kcal: 2800, p: 180, f: 30, c: 200 } }));
    expect(r.fats).toBe(64);
  });
});

describe('buildDayTargets — profile', () => {
  it('нейтральные цели профиля + диетпотолок', () => {
    const r = buildDayTargets(IN({ kbjuMode: 'profile' }));
    expect(r.protein).toBe(160);
    expect(r.fats).toBe(Math.max(64, 70));
    expect(r.kcal).toBe(Math.round(r.protein * 4 + r.fats * 9 + r.carbs * 4));
  });
});
