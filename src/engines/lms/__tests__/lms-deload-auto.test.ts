/**
 * lms-deload-auto.test.ts — тесты авторегулируемого делода по ACWR.
 * Проверяет: авто-режим, выбор недель, корректность применения.
 */

import { describe, it, expect } from 'vitest';
import { applyPLDeload, type PLDeloadRequest } from '../lms-deload.engine';
import { buildLMSPlan, type LMSBuildInput } from '../lms-builder.engine';
import { LMS_CYCLES } from '../../../data/lms-cycles/lms-cycle-index';

function makePlan(overrides: Partial<LMSBuildInput> = {}): LMSBuildInput {
  const template = LMS_CYCLES.find(c => c.meta.id === 'cycle-01')!;
  return {
    template,
    pmMap: { 'Присед': 100, 'Жим лёжа': 80, 'Становая': 120 },
    fallbackPm: 80,
    weeksOverride: 6,
    ...overrides,
  };
}

describe('Авторегулируемый делод', () => {
  it('без auto — обычный делод', () => {
    const plan = buildLMSPlan(makePlan());
    const result = applyPLDeload(plan, { weeks: [2] });
    expect(result.applied).toContain(2);
    expect(result.notes[0]).toContain('Делод');
  });

  it('auto: ACWR > 1.3 (dangerous) — делод применяется', () => {
    const plan = buildLMSPlan(makePlan());
    const result = applyPLDeload(plan, {
      auto: { acwr: { ratio: 1.5, zone: 'dangerous' } },
    });
    expect(result.applied.length).toBeGreaterThan(0);
    expect(result.notes.some(n => n.includes('Авто-делод'))).toBe(true);
  });

  it('auto: ACWR < 0.8 (undertrained) — делод не нужен', () => {
    const plan = buildLMSPlan(makePlan());
    const result = applyPLDeload(plan, {
      auto: { acwr: { ratio: 0.6, zone: 'undertrained' } },
    });
    expect(result.notes.some(n => n.includes('undertrained'))).toBe(true);
  });

  it('auto: ACWR в норме — делод не применяется', () => {
    const plan = buildLMSPlan(makePlan());
    const result = applyPLDeload(plan, {
      auto: { acwr: { ratio: 1.0, zone: 'optimal' } },
    });
    expect(result.notes.some(n => n.includes('не требуется'))).toBe(true);
  });

  it('auto: явные weeks игнорируют auto', () => {
    const plan = buildLMSPlan(makePlan());
    const result = applyPLDeload(plan, {
      weeks: [3],
      auto: { acwr: { ratio: 1.5, zone: 'dangerous' } },
    });
    expect(result.applied).toContain(3);
  });

  it('auto: делод не применяется к защищённым неделям', () => {
    const plan = buildLMSPlan(makePlan());
    const result = applyPLDeload(plan, {
      auto: { acwr: { ratio: 1.5, zone: 'dangerous' } },
    });
    // Все применённые недели не должны быть защищёнными
    for (const weekNum of result.applied) {
      const week = plan.weeks.find(w => w.week === weekNum);
      expect(week?.meetWeek).toBeFalsy();
      expect(week?.mockMeet).toBeFalsy();
      expect(week?.taperWeek).toBeFalsy();
    }
  });

  it('auto: корректный множитель объёма', () => {
    const plan = buildLMSPlan(makePlan());
    const result = applyPLDeload(plan, {
      auto: { acwr: { ratio: 1.5, zone: 'dangerous' } },
      volumeMult: 0.4,
    });
    expect(result.notes[0]).toContain('×0.4');
  });

  it('auto: корректный RIR-сдвиг', () => {
    const plan = buildLMSPlan(makePlan());
    const result = applyPLDeload(plan, {
      auto: { acwr: { ratio: 1.5, zone: 'dangerous' } },
      rirShift: 4,
    });
    expect(result.notes[0]).toContain('RIR +4');
  });

  it('auto: пустой план — не падает', () => {
    const plan = buildLMSPlan(makePlan({ weeksOverride: 1 }));
    const result = applyPLDeload(plan, {
      auto: { acwr: { ratio: 1.5, zone: 'dangerous' } },
    });
    expect(result).toBeDefined();
  });

  it('auto: все недели защищены — делод не применяется', () => {
    const plan = buildLMSPlan(makePlan());
    // Помечаем все недели как защищённые
    for (const week of plan.weeks) {
      week.meetWeek = true;
    }
    const result = applyPLDeload(plan, {
      auto: { acwr: { ratio: 1.5, zone: 'dangerous' } },
    });
    expect(result.applied.length).toBe(0);
  });
});
