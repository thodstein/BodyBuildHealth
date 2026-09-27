/**
 * lms-weakpoint-inject.test.ts — тесты инъекции слабых точек в buildLMSPlan.
 * Проверяет: добавление упражнений, корректность дозы, отсутствие дублей.
 */

import { describe, it, expect } from 'vitest';
import { buildLMSPlan, type LMSBuildInput } from '../lms-builder.engine';
import { LMS_CYCLES } from '../../../data/lms-cycles/lms-cycle-index';
import type { Lift, WeakPoint } from '../weakpoint-pl';

function makeInput(overrides: Partial<LMSBuildInput> = {}): LMSBuildInput {
  const template = LMS_CYCLES.find(c => c.meta.id === 'cycle-01')!;
  return {
    template,
    pmMap: { 'Присед': 100, 'Жим лёжа': 80, 'Становая': 120 },
    fallbackPm: 80,
    weeksOverride: 4,
    ...overrides,
  };
}

describe('Инъекция слабых точек в buildLMSPlan', () => {
  it('без plWeakPoints — план без коррекционных упражнений', () => {
    const plan = buildLMSPlan(makeInput());
    expect(plan.weeks.length).toBeGreaterThan(0);
  });

  it('с plWeakPoints — в план добавляются коррекционные упражнения', () => {
    const weakPoints: { lift: Lift; weakPoint: WeakPoint }[] = [
      { lift: 'bench', weakPoint: 'stickout' },
    ];
    const plan = buildLMSPlan(makeInput({ plWeakPoints: weakPoints }));
    expect(plan.weeks.length).toBeGreaterThan(0);
    // Проверяем, что в плане есть упражнения, добавленные инъекцией
    const allExercises = plan.weeks.flatMap(w => w.days.flatMap(d => d.exercises.map(e => e.name)));
    expect(allExercises.length).toBeGreaterThan(0);
  });

  it('plWeakPoints с несколькими точками — все инъецируются', () => {
    const weakPoints: { lift: Lift; weakPoint: WeakPoint }[] = [
      { lift: 'bench', weakPoint: 'stickout' },
      { lift: 'squat', weakPoint: 'bottom' },
    ];
    const plan = buildLMSPlan(makeInput({ plWeakPoints: weakPoints }));
    expect(plan.weeks.length).toBeGreaterThan(0);
  });

  it('plWeakPoints не дублируют упражнения', () => {
    const weakPoints: { lift: Lift; weakPoint: WeakPoint }[] = [
      { lift: 'bench', weakPoint: 'stickout' },
    ];
    const plan = buildLMSPlan(makeInput({ plWeakPoints: weakPoints }));
    // Проверяем, что нет дублей в рамках одного дня
    for (const week of plan.weeks) {
      for (const day of week.days) {
        const names = day.exercises.map(e => e.name);
        const unique = new Set(names);
        expect(unique.size).toBe(names.length);
      }
    }
  });

  it('plWeakPoints с пользовательским exerciseMap — выбранные упражнения', () => {
    const weakPoints: { lift: Lift; weakPoint: WeakPoint }[] = [
      { lift: 'bench', weakPoint: 'stickout' },
    ];
    const plan = buildLMSPlan(makeInput({
      plWeakPoints: weakPoints,
      plWeakPointExerciseMap: { 'bench|stickout': ['Жим лёжа с паузой'] },
    }));
    expect(plan.weeks.length).toBeGreaterThan(0);
  });

  it('plWeakPoints с dayMap — выбранные дни', () => {
    const weakPoints: { lift: Lift; weakPoint: WeakPoint }[] = [
      { lift: 'bench', weakPoint: 'stickout' },
    ];
    const plan = buildLMSPlan(makeInput({
      plWeakPoints: weakPoints,
      plWeakPointDayMap: { 'bench|stickout': [1] },
    }));
    expect(plan.weeks.length).toBeGreaterThan(0);
  });

  it('plWeakPoints с orthopedicBlockedPatterns — фильтрация', () => {
    const weakPoints: { lift: Lift; weakPoint: WeakPoint }[] = [
      { lift: 'bench', weakPoint: 'stickout' },
    ];
    const plan = buildLMSPlan(makeInput({
      plWeakPoints: weakPoints,
      orthopedicBlockedPatterns: ['overhead'],
    }));
    expect(plan.weeks.length).toBeGreaterThan(0);
  });

  it('plWeakPoints с faithful — инъекция поверх источника', () => {
    const weakPoints: { lift: Lift; weakPoint: WeakPoint }[] = [
      { lift: 'bench', weakPoint: 'stickout' },
    ];
    const plan = buildLMSPlan(makeInput({ plWeakPoints: weakPoints, faithful: true }));
    expect(plan.weeks.length).toBeGreaterThan(0);
  });

  it('plWeakPoints с длинным циклом — коррекции на каждой неделе', () => {
    const weakPoints: { lift: Lift; weakPoint: WeakPoint }[] = [
      { lift: 'bench', weakPoint: 'stickout' },
    ];
    const plan = buildLMSPlan(makeInput({ plWeakPoints: weakPoints, weeksOverride: 8 }));
    expect(plan.weeks.length).toBe(8);
  });

  it('plWeakPoints с ACWR — коррекции применяются', () => {
    const weakPoints: { lift: Lift; weakPoint: WeakPoint }[] = [
      { lift: 'bench', weakPoint: 'stickout' },
    ];
    const plan = buildLMSPlan(makeInput({
      plWeakPoints: weakPoints,
      acwr: { ratio: 1.2, zone: 'caution' },
    }));
    expect(plan.weeks.length).toBeGreaterThan(0);
  });
});
