/**
 * Строка «белок по приёмам» обязана совпадать с тарелками.
 *
 * Дефект: нота собиралась ДО построения приёмов, из планового ровного деления
 * (`evenRegularP`), и печатала «Белок равномерно: 44г/приём (всего 220г / 5 основных)»
 * на дне, где фактически было 48 / 55 / 17 / 48 / 47 — то есть ровного деления нет,
 * а один приём даёт 0.16 г/кг при цели ≥0.30. Пользователь читает «равномерно»
 * и не видит, что перекус — пустышка.
 *
 * Канон: ноту пересобираем по финальным `m.totals.p` (как «Сводку MPS» после B42),
 * а слабый приём называем по имени.
 */
import { describe, it, expect } from 'vitest';
import { buildDayPlan } from '../meal-plan-engine';
import { buildDayTargets } from '../planner-day-targets';

const makePlan = (over: Record<string, any> = {}) => {
  const tgt: any = buildDayTargets({
    weightKg: 110, presetGPerKg: 2.0, fatFloorGPerKg: 0.8, kbjuMode: 'auto',
    goal: 'mass', dietStyle: 'classic',
  } as any);
  return buildDayPlan({
    weightKg: 110, lbmKg: 88, bodyFatPct: 20, sex: 'male',
    goalKcal: tgt.kcal, goalProteinG: tgt.protein, goalFatG: tgt.fats, goalCarbsG: tgt.carbs,
    mealsCount: 5, isTrainingDay: false, budget: 'medium', dayOffset: 0,
    cyclePhase: 'none', variety: 'medium', eveningLowCarb: false, goal: 'mass',
    ...over,
  } as any) as any;
};

const proteinNote = (plan: any): string =>
  ((plan.notes || []) as string[]).find((n) => /^Белок (по приёмам|равномерно):/.test(n)) || '';

describe('нота «белок по приёмам» = факт с тарелок', () => {
  it('в ноте фактические граммы каждого основного приёма, а не плановое «ровно X»', () => {
    const plan = makePlan();
    const note = proteinNote(plan);
    expect(note).not.toBe('');

    const mains = plan.meals.filter(
      (m: any) => !['preworkout', 'postworkout', 'intra'].includes(String(m.type)) && (m.totals?.p || 0) > 0,
    );
    expect(mains.length).toBeGreaterThan(2);

    // Каждый основной приём должен быть виден в ноте своей фактической цифрой.
    for (const m of mains) {
      const g = Math.round(m.totals.p);
      expect(note, `приём «${m.label}» ${g} г отсутствует в ноте: ${note}`).toContain(String(g));
    }
  });

  it('слабый приём назван по имени, когда он ниже 0.30 г/кг', () => {
    const plan = makePlan();
    const w = 110;
    const weak = plan.meals.find(
      (m: any) =>
        !['preworkout', 'postworkout', 'intra'].includes(String(m.type)) &&
        (m.totals?.p || 0) > 0 &&
        (m.totals.p || 0) / w < 0.3,
    );
    const note = proteinNote(plan);
    if (weak) {
      expect(note).toContain('недобирает');
      expect(note).toContain(String(weak.label));
    } else {
      // все приёмы ≥0.30 г/кг — тогда цифры всё равно должны быть фактическими
      expect(note).toMatch(/Белок (по приёмам|равномерно):/);
      expect(note).toMatch(/г\/кг/);
    }
  });

  it('на дне с 7 приёмами нота перечисляет 7 цифр, а не «всего N приёмов»', () => {
    const plan = makePlan({ mealsCount: 7 });
    const note = proteinNote(plan);
    const chain = (note.match(/\d+(?:\/\d+)+/g) || [])[0];
    expect(chain, `нет списка по приёмам: ${note}`).toBeTruthy();
    const count = chain!.split('/').length;
    const mains = plan.meals.filter(
      (m: any) => !['preworkout', 'postworkout', 'intra'].includes(String(m.type)) && (m.totals?.p || 0) > 0,
    );
    expect(count).toBe(mains.length);
  });
});
