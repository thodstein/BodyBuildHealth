/**
 * pl-athlete-context.test.ts — свойство женского контекста PL-auto:
 *  - athleteMode/athleteContext не меняют pipeline (проценты/RIR/объём/недели);
 *  - контекст прозрачно сохраняется в LMSBuildOutput и добавляет rationale;
 *  - legacy-вызовы без контекста не получают новые поля.
 */
import { describe, expect, it } from 'vitest';
import { buildLMSPlan } from '../lms-builder.engine';
import { CYCLE_01 } from '../../../data/lms-cycles/cycle-01';

const pmMap = { 'Присед': 150, 'Жим лежа': 110, 'Становая тяга': 180 };

const base = {
  template: CYCLE_01,
  pmMap,
  fallbackPm: 80,
  mode: 'natural' as const,
  weeksOverride: 4,
  faithful: true,
};

describe('PL female_context: pipeline unchanged', () => {
  it('female_context не меняет недели плана (проценты/RIR/объём)', () => {
    const plain = buildLMSPlan({ ...base });
    const ctx = buildLMSPlan({
      ...base,
      athleteMode: 'female_context',
      athleteContext: { sex: 'female', athleteMode: 'female_context', competitionFederation: 'ipf' },
    });
    expect(JSON.stringify(ctx.weeks)).toBe(JSON.stringify(plain.weeks));
    expect(ctx.cycleMetrics.totalVolume).toBe(plain.cycleMetrics.totalVolume);
    expect(ctx.athleteMode).toBe('female_context');
    expect(ctx.athleteContext?.sex).toBe('female');
    expect(ctx.progressionRationale).toContain('Женский контекст');
  });

  it('female_context на мужском профиле нормализуется в standard', () => {
    const ctx = buildLMSPlan({
      ...base,
      athleteMode: 'female_context',
      athleteContext: { sex: 'male', athleteMode: 'female_context' },
    });
    expect(ctx.athleteMode).toBe('female_context');
    expect(ctx.progressionRationale).not.toContain('Женский контекст');
  });

  it('legacy-вызов без контекста не добавляет новые поля', () => {
    const plan = buildLMSPlan({ ...base });
    expect(plan.athleteMode).toBeUndefined();
    expect(plan.athleteContext).toBeUndefined();
  });
});
