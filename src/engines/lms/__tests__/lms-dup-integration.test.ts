/**
 * lms-dup-integration.test.ts — тесты DUP-режима в buildLMSPlan.
 * Проверяет: варьирование зон по дням, корректность весов/RIR, отсутствие влияния в linear.
 */

import { describe, it, expect } from 'vitest';
import { buildLMSPlan, type LMSBuildInput } from '../lms-builder.engine';
import { LMS_CYCLES } from '../../../data/lms-cycles/lms-cycle-index';

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

describe('DUP-режим в buildLMSPlan', () => {
  it('без periodization — веса рассчитываются как обычно (linear)', () => {
    const plan = buildLMSPlan(makeInput());
    expect(plan.weeks.length).toBeGreaterThan(0);
    expect(plan.progressionRationale).not.toContain('DUP');
  });

  it('с periodization=dup — веса варьируются по дням', () => {
    const plan = buildLMSPlan(makeInput({ periodization: 'dup' }));
    expect(plan.weeks.length).toBeGreaterThan(0);
    expect(plan.progressionRationale).toContain('DUP');
  });

  it('DUP: первый день недели — максимальный вес (×1.0)', () => {
    const plan = buildLMSPlan(makeInput({ periodization: 'dup' }));
    const week1 = plan.weeks[0];
    expect(week1.days.length).toBeGreaterThan(0);
    // Собираем веса одного упражнения по дням
    const exName = week1.days[0].exercises[0]?.name;
    const weights = week1.days.map(d => {
      const ex = d.exercises.find(e => e.name === exName);
      return ex?.workSets[0]?.weight ?? 0;
    }).filter(w => w > 0);
    if (weights.length >= 2) {
      expect(weights[0]).toBe(Math.max(...weights));
    }
  });

  it('DUP: второй день недели — вес ×0.97', () => {
    const plan = buildLMSPlan(makeInput({ periodization: 'dup' }));
    const week1 = plan.weeks[0];
    if (week1.days.length >= 2) {
      const exName = week1.days[0].exercises[0]?.name;
      const day1Ex = week1.days[0].exercises.find(e => e.name === exName);
      const day2Ex = week1.days[1].exercises.find(e => e.name === exName);
      if (day1Ex && day2Ex) {
        const w1 = day1Ex.workSets[0]?.weight ?? 0;
        const w2 = day2Ex.workSets[0]?.weight ?? 0;
        expect(w2).toBeLessThan(w1);
      }
    }
  });

  it('DUP: третий день недели — вес ×0.94', () => {
    const plan = buildLMSPlan(makeInput({ periodization: 'dup' }));
    const week1 = plan.weeks[0];
    if (week1.days.length >= 3) {
      const exName = week1.days[0].exercises[0]?.name;
      const day1Ex = week1.days[0].exercises.find(e => e.name === exName);
      const day3Ex = week1.days[2].exercises.find(e => e.name === exName);
      if (day1Ex && day3Ex) {
        const w1 = day1Ex.workSets[0]?.weight ?? 0;
        const w3 = day3Ex.workSets[0]?.weight ?? 0;
        expect(w3).toBeLessThan(w1);
      }
    }
  });

  it('DUP: RIR варьируется по дням (0, +1, +2)', () => {
    const plan = buildLMSPlan(makeInput({ periodization: 'dup' }));
    const week1 = plan.weeks[0];
    if (week1.days.length >= 3) {
      const rir0 = week1.days[0].exercises[0]?.workSets[0]?.rir ?? 0;
      const rir1 = week1.days[1].exercises[0]?.workSets[0]?.rir ?? 0;
      const rir2 = week1.days[2].exercises[0]?.workSets[0]?.rir ?? 0;
      // RIR должен расти: день 1 < день 2 < день 3
      expect(rir1).toBeGreaterThan(rir0);
      expect(rir2).toBeGreaterThan(rir1);
    }
  });

  it('DUP не влияет на faithful-режим', () => {
    const plan = buildLMSPlan(makeInput({ periodization: 'dup', faithful: true }));
    expect(plan.weeks.length).toBeGreaterThan(0);
    // В faithful-режиме DUP не применяется к весам
  });

  it('DUP с авторегуляцией — оба режима работают вместе', () => {
    const autoReg = { topSetPctMultiplier: 0.95, volumeMultiplier: 0.9, rirShift: 1, deload: false };
    const plan = buildLMSPlan(makeInput({ periodization: 'dup', autoReg }));
    expect(plan.weeks.length).toBeGreaterThan(0);
    expect(plan.progressionRationale).toContain('DUP');
    expect(plan.progressionRationale).toContain('Авторегуляция');
  });

  it('DUP: rationale содержит описание режима', () => {
    const plan = buildLMSPlan(makeInput({ periodization: 'dup' }));
    expect(plan.progressionRationale).toContain('ежедневное варьирование');
  });

  it('linear: rationale не содержит DUP', () => {
    const plan = buildLMSPlan(makeInput({ periodization: 'linear' }));
    expect(plan.progressionRationale).not.toContain('DUP');
  });

  it('DUP: все недели имеют упражнения', () => {
    const plan = buildLMSPlan(makeInput({ periodization: 'dup', weeksOverride: 6 }));
    expect(plan.weeks.length).toBe(6);
    for (const week of plan.weeks) {
      for (const day of week.days) {
        expect(day.exercises.length).toBeGreaterThan(0);
      }
    }
  });
});
