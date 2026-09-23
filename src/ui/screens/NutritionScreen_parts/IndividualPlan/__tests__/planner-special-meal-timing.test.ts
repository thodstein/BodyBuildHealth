/**
 * planner-special-meal-timing.test.ts — P1-fix: «Время приёма» спецприёма реально
 * управляет заменой приёма. Раньше выбор «Завтрак/Обед/Ужин/Перекус/Перед сном»
 * жил только подписью в карточке — движок о нём не знал («показано ≠ применяется»).
 */
import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';
import { SPECIAL_MEAL_TIMING_TARGETS, effectiveSpecialMealTarget } from '../planner-special-meal-state';

const base = (over: Partial<MealPlanInput> = {}): MealPlanInput => ({
  weightKg: 90, lbmKg: 73.8, bodyFatPct: 18, sex: 'male',
  goalKcal: 3200, goalProteinG: 190, goalFatG: 80, goalCarbsG: 400,
  mealsCount: 5, isTrainingDay: true, trainStartMin: 17 * 60 + 30, trainDurationMin: 90, allowIntraWorkout: true,
  budget: 'medium', dayOffset: 0, cyclePhase: 'course', variety: 'max', eveningLowCarb: false,
  randomSalt: 1, ...over,
});

describe('effectiveSpecialMealTarget: словарь «время → метка приёма»', () => {
  it('все 5 значений времени маппятся в метки движка', () => {
    expect(effectiveSpecialMealTarget('', 'breakfast')).toBe('Завтрак');
    expect(effectiveSpecialMealTarget('', 'lunch')).toBe('Обед');
    expect(effectiveSpecialMealTarget('', 'dinner')).toBe('Ужин');
    expect(effectiveSpecialMealTarget('', 'snack')).toBe('Перекус');
    expect(effectiveSpecialMealTarget('', 'before_bed')).toBe('Перед сном');
    expect(Object.keys(SPECIAL_MEAL_TIMING_TARGETS).length).toBe(5);
  });

  it('явный «Заменить приём» приоритетнее времени', () => {
    expect(effectiveSpecialMealTarget('Ужин', 'breakfast')).toBe('Ужин');
  });

  it('неизвестное время без цели → пусто (override не добавляется)', () => {
    expect(effectiveSpecialMealTarget('', 'unknown_timing')).toBe('');
  });
});

describe('движок: override по меткам (включая «Перед сном») реально перестраивает приём', () => {
  it('custom «Завтрак» — заметка «Спецприём заменяет» в notes', () => {
    const plan = buildDayPlan(base({ specialMealOverride: [{ targetLabel: 'Завтрак', kind: 'custom', p: 40, c: 60, f: 5 }] }));
    expect(plan.notes.some(n => n.includes('Спецприём заменяет «Завтрак»'))).toBe(true);
  });

  it('custom «Перед сном» — preSleep-слот существует и заметка на месте (фикс fallback в snack)', () => {
    const plan = buildDayPlan(base({ specialMealOverride: [{ targetLabel: 'Перед сном', kind: 'custom', p: 35, c: 5, f: 15 }] }));
    const ps = plan.meals.find(m => m.type === 'presleep');
    expect(ps, 'pre-sleep отсутствует — тест-вход должен его давать').toBeTruthy();
    expect(plan.notes.some(n => n.includes('Спецприём заменяет «Перед сном»'))).toBe(true);
    const p = ps!.items.reduce((s, i) => s + i.p, 0);
    expect(p, `pre-sleep ${p} г белка после override`).toBeGreaterThanOrEqual(25);
  });

  it('без override заметок «Спецприём заменяет» нет', () => {
    const plan = buildDayPlan(base());
    expect(plan.notes.some(n => n.includes('Спецприём заменяет'))).toBe(false);
  });
});
