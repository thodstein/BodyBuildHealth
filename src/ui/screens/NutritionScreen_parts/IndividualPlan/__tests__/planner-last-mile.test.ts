import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';
import { buildDayTargets } from '../planner-day-targets';

/**
 * QG46: последняя миля честными граммами.
 *
 * §8.44 вскрыл: до QG45 день «добирал» остаток фантомными граммами (позиция 8 г несла
 * макросы 160 г). После честного ремонта на экстремальном дне отдыха жир стал −7.2 %
 * (120.7 из 130 г). Стадия закрывает остаток 6–12 г **реальной** порцией масла 5–10 г,
 * только когда день уже собран (±3.5 % ккал), только в про-режиме и только в свободном
 * режиме (не ручные цели, не портативный).
 *
 * Замер (80 ячеек про-сетки): +2 канон-дня (110 кг / 8370 / 1500 У / отдых), падений
 * оценки 0, падений канона 0. В реальном 30-дневном харнессе (buildDayTargets) стадия
 * молчит — обычные дни и так в каноне.
 */

const mk = (o: {
  weightKg: number; lbmKg: number; kcal: number; p: number; f: number; c: number;
  mealsCount: number; training: boolean; manual?: boolean;
}): MealPlanInput => ({
  weightKg: o.weightKg, lbmKg: o.lbmKg, bodyFatPct: 12, sex: 'male',
  goalKcal: o.kcal, goalProteinG: o.p, goalFatG: o.f, goalCarbsG: o.c,
  mealsCount: o.mealsCount, isTrainingDay: o.training,
  trainStartMin: o.training ? 18 * 60 : undefined, trainDurationMin: 75,
  allowIntraWorkout: true, excludedIds: new Set<string>(), allergenTags: new Set<string>(),
  budget: 'medium', dayOffset: 0, cyclePhase: 'none', variety: 'medium',
  quality: 'full', randomSalt: 0, kbjuMode: o.manual ? 'manual' : 'auto',
  manualTargetsLocked: !!o.manual,
} as any);

const pct = (got: number, want: number) => ((got - want) / want) * 100;
const lastMile = (plan: any) => ((plan.notes || []) as string[]).filter((n) => n.includes('Последняя миля'));

describe('QG46: последняя миля честными граммами', () => {
  const extremeRest = { weightKg: 110, lbmKg: 90, kcal: 8370, p: 300, f: 130, c: 1500, mealsCount: 4, training: false };

  it('экстремальный день отдыха: жир в цели, канон 3 % по всем осям', () => {
    const plan: any = buildDayPlan(mk(extremeRest));
    const t = plan.totals;
    expect(Math.abs(pct(t.f, 130)), `жир ${t.f.toFixed(1)} из 130`).toBeLessThanOrEqual(3);
    for (const [got, want, name] of [[t.kcal, 8370, 'ккал'], [t.p, 300, 'белок'], [t.f, 130, 'жир'], [t.c, 1500, 'углеводы']] as const) {
      expect(Math.abs(pct(got, want)), `${name} ${got.toFixed(0)} из ${want}`).toBeLessThanOrEqual(3);
    }
    expect(lastMile(plan).length, 'нота последней мили').toBeGreaterThan(0);
  });

  it('добавка — реальная порция: 5–10 г масла, целые граммы, не «крошка»', () => {
    const plan: any = buildDayPlan(mk(extremeRest));
    const fats = (plan.meals || []).flatMap((m: any) => (m.items || []).filter((i: any) => i.role === 'fat'));
    for (const it of fats) {
      expect(Number.isInteger(it.amount), `${it.id}: дробные граммы ${it.amount}`).toBe(true);
      if (/oil|ghee/.test(String(it.id))) {
        expect(it.amount, `${it.id}: порция масла`).toBeGreaterThanOrEqual(5);
        expect(it.amount, `${it.id}: порция масла`).toBeLessThanOrEqual(25);
      }
    }
    const note = lastMile(plan)[0] || '';
    const m = note.match(/\+(\d+) г/);
    expect(!!m, `в ноте есть граммы: ${note}`).toBe(true);
    expect(Number(m![1])).toBeGreaterThanOrEqual(5);
    expect(Number(m![1])).toBeLessThanOrEqual(10);
  });

  it('ручные цели стадия не трогает (решение пользователя главнее)', () => {
    const plan: any = buildDayPlan(mk({ ...extremeRest, manual: true }));
    expect(lastMile(plan).length, 'нота в ручном режиме').toBe(0);
  });

  it('обычный день стадия не трогает: день уже в каноне', () => {
    const tgt: any = buildDayTargets({
      weightKg: 80, presetGPerKg: 2.0, fatFloorGPerKg: 0.8, kbjuMode: 'auto',
      goal: 'maintenance', dietStyle: 'classic',
    } as any);
    const plan: any = buildDayPlan(mk({
      weightKg: 80, lbmKg: 65, kcal: tgt.kcal, p: tgt.protein, f: tgt.fats, c: tgt.carbs,
      mealsCount: 5, training: false,
    }));
    expect(lastMile(plan).length, 'нота на обычном дне').toBe(0);
    const t = plan.totals;
    const worst = Math.max(
      Math.abs(pct(t.kcal, tgt.kcal)), Math.abs(pct(t.p, tgt.protein)),
      Math.abs(pct(t.f, tgt.fats)), Math.abs(pct(t.c, tgt.carbs)),
    );
    expect(worst, `обычный день: худшее ${worst.toFixed(1)} %`).toBeLessThanOrEqual(3);
  });
});
