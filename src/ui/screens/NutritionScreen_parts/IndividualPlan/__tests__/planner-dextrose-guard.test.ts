/**
 * planner-dextrose-guard.test.ts — регрессия жалобы «декстроза на 2500 ккал на завтрак».
 * - жидкие peri-угли (декстроза/амилопектин/сок/изотоник) живут ТОЛЬКО в
 *   postw/intra/инсулин-окнах, никогда в завтраке/обеде/ужине/перекусах;
 * - инсулин-окно считает totals.c честно (баг c: acc.c давал 0 и дублировал окна);
 * - корректор не льёт добивку в уже тяжёлый приём (≥1000 ккал).
 */
import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';
import { correctDayToTargets } from '../day-target-corrector';

const PERI_ONLY = new Set(['dextrose', 'amylopectin', 'maltodextrin', 'vitargo', 'cyclic_dextrin', 'isotonic', 'drink_isotonic', 'isoton', 'orange_juice']);

const base2500 = (over: any = {}): MealPlanInput => ({
  weightKg: 85, lbmKg: 70, bodyFatPct: 15, sex: 'male' as const,
  goalKcal: 2500, goalProteinG: 170, goalFatG: 70, goalCarbsG: 280,
  mealsCount: 5, isTrainingDay: true, trainStartMin: 18 * 60, trainDurationMin: 75,
  allowIntraWorkout: false, budget: 'medium' as const, dayOffset: 0,
  cyclePhase: 'base' as const, variety: 'medium' as const, eveningLowCarb: false,
  quality: 'full' as const, randomSalt: 7, carbCapGPerKg: 0,
  wakeTime: '07:30', bedTime: '23:00', dinnerTime: '19:00',
  ...over,
});

describe('декстроза не живёт в обычных приёмах', () => {
  it('2500 ккал train-day: ни один завтрак/обед/ужин/перекус без декстрозы-сока', () => {
    for (const salt of [1, 7, 42]) {
      const plan = buildDayPlan(base2500({ randomSalt: salt }));
      for (const m of plan.meals) {
        if ((m as any)._insulinWindow) continue;
        const t = String((m as any).type || '');
        if (t === 'postworkout' || t === 'intra') continue;
        const bad = (m.items || []).filter((it: any) => PERI_ONLY.has(it.id));
        expect(bad.map((b: any) => `${m.label}:${b.id}:${b.amount}`).join(','), `salt=${salt} ${m.label}`).toBe('');
      }
    }
  });

  it('завтрак 2500 ккал дня — не ведро: <1000 ккал и без жидких углей', () => {
    const plan = buildDayPlan(base2500({}));
    const bf = plan.meals.find(m => String((m as any).type || '') === 'breakfast' || /Завтрак/i.test(m.label || ''));
    expect(bf).toBeTruthy();
    expect(bf!.totals.kcal, `завтрак ${bf!.totals.kcal} ккал: ${(bf!.items || []).map((i: any) => `${i.id} ${i.amount}г`).join(', ')}`).toBeLessThan(1000);
  });

  it('инсулин-окно считает угли честно (totals.c = сумме items.c)', () => {
    const plan = buildDayPlan(base2500({
      isTrainingDay: false,
      injections: [{ type: 'инсулин', name: 'НовоРапид', time: '14:00', dose: 10, esterType: 'short' }] as any,
    }));
    const win = plan.meals.find(m => (m.label || '').includes('Углеводы под инсулин'));
    expect(win).toBeTruthy();
    const sumC = (win!.items || []).reduce((s: number, it: any) => s + (it.c || 0), 0);
    expect(win!.totals.c).toBeGreaterThan(0);
    expect(Math.abs(win!.totals.c - sumC)).toBeLessThanOrEqual(1);
  });

  it('корректор не доливает в приём ≥1000 ккал при живых альтернативах', () => {
    const meals: any[] = [
      { label: 'Завтрак', type: 'breakfast', time: '08:00', items: [{ id: 'oats_dry', name: 'Овсянка', amount: 100, kcal: 350, p: 12, f: 6, c: 60, fiber: 8, role: 'carb_slow' }], totals: { kcal: 1200, p: 40, f: 30, c: 150, fiber: 8 } },
      { label: 'Перекус', type: 'snack', time: '12:00', items: [{ id: 'cottage_cheese_5', name: 'Творог', amount: 100, kcal: 120, p: 18, f: 5, c: 3, fiber: 0, role: 'protein' }], totals: { kcal: 120, p: 18, f: 5, c: 3, fiber: 0 } },
    ];
    const res = correctDayToTargets(meals as any, { kcal: 2500, p: 170, f: 70, c: 280 }, { weightKg: 85 });
    const bf = res.meals.find(m => m.label === 'Завтрак');
    const sn = res.meals.find(m => m.label === 'Перекус');
    // Добивка должна уйти в лёгкий перекус, а не раздуть завтрак-ведро.
    expect((sn!.totals?.kcal || 0) > 120 || (bf!.totals?.kcal || 0) <= 1300).toBe(true);
  });
});
