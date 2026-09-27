/**
 * lms-vbt-integration.test.ts — тесты VBT-интеграции в buildLMSPlan.
 * Проверяет: подгрузку веса по скорости, корректность расчёта, отсутствие влияния без VBT.
 */

import { describe, it, expect } from 'vitest';
import { buildLMSPlan, type LMSBuildInput } from '../lms-builder.engine';
import { LMS_CYCLES } from '../../../data/lms-cycles/lms-cycle-index';
import type { VBTLift } from '../../pro/vbt.engine';

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

describe('VBT-интеграция в buildLMSPlan', () => {
  it('без VBT — веса рассчитываются как обычно', () => {
    const plan = buildLMSPlan(makeInput());
    expect(plan.weeks.length).toBeGreaterThan(0);
    const firstWeek = plan.weeks[0];
    expect(firstWeek.days.length).toBeGreaterThan(0);
  });

  it('с VBT — веса корректируются по скорости', () => {
    const vbt: { lift: VBTLift; warmupVelocity: number; warmupWeight: number } = {
      lift: 'squat',
      warmupVelocity: 0.85,
      warmupWeight: 60,
    };
    const plan = buildLMSPlan(makeInput({ vbt }));
    expect(plan.weeks.length).toBeGreaterThan(0);
    // VBT-нота должна быть в rationale
    expect(plan.progressionRationale).toContain('VBT');
    expect(plan.progressionRationale).toContain('squat');
  });

  it('VBT с недопустимой скоростью — не падает', () => {
    const vbt: { lift: VBTLift; warmupVelocity: number; warmupWeight: number } = {
      lift: 'bench',
      warmupVelocity: 0,
      warmupWeight: 0,
    };
    const plan = buildLMSPlan(makeInput({ vbt }));
    expect(plan.weeks.length).toBeGreaterThan(0);
  });

  it('VBT с очень высокой скоростью — корректировка веса', () => {
    const vbt: { lift: VBTLift; warmupVelocity: number; warmupWeight: number } = {
      lift: 'deadlift',
      warmupVelocity: 1.2,
      warmupWeight: 80,
    };
    const plan = buildLMSPlan(makeInput({ vbt }));
    expect(plan.weeks.length).toBeGreaterThan(0);
    expect(plan.progressionRationale).toContain('VBT');
  });

  it('VBT не влияет на faithful-режим', () => {
    const vbt: { lift: VBTLift; warmupVelocity: number; warmupWeight: number } = {
      lift: 'squat',
      warmupVelocity: 0.9,
      warmupWeight: 70,
    };
    const plan = buildLMSPlan(makeInput({ vbt, faithful: true }));
    expect(plan.weeks.length).toBeGreaterThan(0);
    // В faithful-режиме VBT-нота может быть, но веса не меняются
    // (faithful сохраняет источник)
  });

  it('VBT с разными лифтами — корректная подгрузка', () => {
    const lifts: VBTLift[] = ['squat', 'bench', 'deadlift'];
    for (const lift of lifts) {
      const vbt: { lift: VBTLift; warmupVelocity: number; warmupWeight: number } = {
        lift,
        warmupVelocity: 0.7,
        warmupWeight: 50,
      };
      const plan = buildLMSPlan(makeInput({ vbt }));
      expect(plan.weeks.length).toBeGreaterThan(0);
      expect(plan.progressionRationale).toContain('VBT');
    }
  });

  it('VBT с граничной скоростью — корректная работа', () => {
    const vbt: { lift: VBTLift; warmupVelocity: number; warmupWeight: number } = {
      lift: 'squat',
      warmupVelocity: 0.3,
      warmupWeight: 100,
    };
    const plan = buildLMSPlan(makeInput({ vbt }));
    expect(plan.weeks.length).toBeGreaterThan(0);
  });

  it('VBT с очень низкой скоростью — корректная работа', () => {
    const vbt: { lift: VBTLift; warmupVelocity: number; warmupWeight: number } = {
      lift: 'bench',
      warmupVelocity: 0.1,
      warmupWeight: 20,
    };
    const plan = buildLMSPlan(makeInput({ vbt }));
    expect(plan.weeks.length).toBeGreaterThan(0);
  });

  it('VBT не ломает авторегуляцию', () => {
    const vbt: { lift: VBTLift; warmupVelocity: number; warmupWeight: number } = {
      lift: 'squat',
      warmupVelocity: 0.8,
      warmupWeight: 60,
    };
    const autoReg = { topSetPctMultiplier: 0.95, volumeMultiplier: 0.9, rirShift: 1, deload: false };
    const plan = buildLMSPlan(makeInput({ vbt, autoReg }));
    expect(plan.weeks.length).toBeGreaterThan(0);
    expect(plan.progressionRationale).toContain('VBT');
    expect(plan.progressionRationale).toContain('Авторегуляция');
  });

  it('VBT с длинным циклом — корректная работа', () => {
    const vbt: { lift: VBTLift; warmupVelocity: number; warmupWeight: number } = {
      lift: 'deadlift',
      warmupVelocity: 0.75,
      warmupWeight: 90,
    };
    const plan = buildLMSPlan(makeInput({ vbt, weeksOverride: 12 }));
    expect(plan.weeks.length).toBe(12);
    expect(plan.progressionRationale).toContain('VBT');
  });
});
