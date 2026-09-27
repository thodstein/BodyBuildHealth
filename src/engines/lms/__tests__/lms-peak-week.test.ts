/**
 * lms-peak-week.test.ts — тесты протокола пик-недели.
 * Проверяет: адаптивную длину тапера, корректность кривой, влияние velocityTrend.
 */

import { describe, it, expect } from 'vitest';
import { buildPeakWeekPlan, type PeakWeekInput } from '../lms-peak-week.engine';

function makeInput(overrides: Partial<PeakWeekInput> = {}): PeakWeekInput {
  return {
    weeksToMeet: 2,
    currentVolume: 20,
    currentIntensity: 85,
    ...overrides,
  };
}

describe('Пик-неделя', () => {
  it('базовый план 2 недели', () => {
    const plan = buildPeakWeekPlan(makeInput());
    expect(plan.weeks.length).toBe(2);
    expect(plan.weeks[0].volumePct).toBeGreaterThan(plan.weeks[1].volumePct);
  });

  it('при росте скорости — тапер короче (1 неделя)', () => {
    const plan = buildPeakWeekPlan(makeInput({ velocityTrend: 5 }));
    expect(plan.weeks.length).toBe(1);
  });

  it('при падении скорости — тапер длиннее (3 недели)', () => {
    const plan = buildPeakWeekPlan(makeInput({ velocityTrend: -5 }));
    expect(plan.weeks.length).toBe(3);
  });

  it('при высокой усталости — тапер длиннее', () => {
    const plan = buildPeakWeekPlan(makeInput({ fatigue: 80 }));
    expect(plan.weeks.length).toBeGreaterThanOrEqual(2);
  });

  it('объём снижается к финалу', () => {
    const plan = buildPeakWeekPlan(makeInput());
    for (let i = 1; i < plan.weeks.length; i++) {
      expect(plan.weeks[i].volumePct).toBeLessThan(plan.weeks[i - 1].volumePct);
    }
  });

  it('интенсивность поддерживается (не ниже 90%)', () => {
    const plan = buildPeakWeekPlan(makeInput());
    for (const week of plan.weeks) {
      expect(week.intensityPct).toBeGreaterThanOrEqual(0.9);
    }
  });

  it('RIR растёт к финалу', () => {
    const plan = buildPeakWeekPlan(makeInput());
    const lastWeek = plan.weeks[plan.weeks.length - 1];
    expect(lastWeek.rirShift).toBeGreaterThanOrEqual(2);
  });

  it('lastTrainingDay не раньше 3 дней до старта', () => {
    const plan = buildPeakWeekPlan(makeInput());
    expect(plan.lastTrainingDay).toBeGreaterThanOrEqual(3);
  });

  it('rationale содержит описание тренда', () => {
    const plan = buildPeakWeekPlan(makeInput({ velocityTrend: 5 }));
    expect(plan.rationale).toContain('растёт');
  });

  it('1 неделя до старта — минимальный тапер', () => {
    const plan = buildPeakWeekPlan(makeInput({ weeksToMeet: 1 }));
    expect(plan.weeks.length).toBeGreaterThanOrEqual(1);
  });

  it('4 недели до старта — стандартный тапер', () => {
    const plan = buildPeakWeekPlan(makeInput({ weeksToMeet: 4 }));
    expect(plan.weeks.length).toBeGreaterThanOrEqual(2);
  });
});
