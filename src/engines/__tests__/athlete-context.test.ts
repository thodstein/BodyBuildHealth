import { describe, expect, it } from 'vitest';
import {
  athleteContextAdvisory,
  athletePolicyHints,
  athletePolicySummary,
  normalizeAthleteContext,
  redsRiskSignals,
  REPRODUCTIVE_CONTEXT_OPTIONS,
} from '../athlete-context.engine';

describe('athlete context policy', () => {
  it('legacy or absent context is standard and male-compatible', () => {
    expect(normalizeAthleteContext()).toMatchObject({ sex: 'male', athleteMode: 'standard' });
    expect(normalizeAthleteContext({ athleteMode: 'female_context' })).toMatchObject({ sex: 'male', athleteMode: 'standard' });
  });

  it('female context is explicit and preserves numeric context', () => {
    const context = normalizeAthleteContext({
      sex: 'female',
      athleteMode: 'female_context',
      trainingYears: '4' as unknown as number,
      pedExperience: { totalYears: 2, coursesCount: 3, enhancedNow: true },
      reproductiveContext: 'cycle',
    });
    expect(context).toMatchObject({
      sex: 'female',
      athleteMode: 'female_context',
      trainingYears: 4,
      pedExperience: { totalYears: 2, coursesCount: 3, enhancedNow: true },
      reproductiveContext: 'cycle',
    });
  });

  it('does not introduce a hidden volume multiplier', () => {
    const hints = athletePolicyHints({ sex: 'female', athleteMode: 'female_context' });
    expect(hints.volumeMultiplier).toBe(1);
    expect(hints.notes.join(' ')).toContain('капы');
  });

  it('flags pregnancy/postpartum for medical review', () => {
    for (const reproductiveContext of ['pregnancy', 'postpartum'] as const) {
      const hints = athletePolicyHints({ sex: 'female', athleteMode: 'female_context', reproductiveContext });
      expect(hints.warnings.some(w => w.includes('медицинская'))).toBe(true);
    }
  });

  it('produces an exportable transparent summary', () => {
    expect(athletePolicySummary({ sex: 'female', athleteMode: 'female_context' }))
      .toContain('Женский контекст');
  });
});

describe('RED-S risk signals (female_context only)', () => {
  const female = { sex: 'female' as const, athleteMode: 'female_context' as const };

  it('flags unsafe weight-loss rate on deficit', () => {
    const w = redsRiskSignals(female, { calorieDeficitActive: true, weightTrendPctPerWeek: 0.7 });
    expect(w.some(x => x.includes('RED-S'))).toBe(true);
  });

  it('safe rate produces no RED-S warning', () => {
    expect(redsRiskSignals(female, { calorieDeficitActive: true, weightTrendPctPerWeek: 0.4 })).toEqual([]);
  });

  it('low body fat + deficit flags bone/cycle risk', () => {
    const w = redsRiskSignals(female, { calorieDeficitActive: true, bodyFatPct: 12 });
    expect(w.some(x => x.includes('% жира 12%'))).toBe(true);
  });

  it('irregular cycle always warns', () => {
    const w = redsRiskSignals(female, { cycleIrregular: true });
    expect(w.some(x => x.includes('Нарушения цикла'))).toBe(true);
  });

  it('standard/male context yields no RED-S signals', () => {
    expect(redsRiskSignals({ sex: 'male', athleteMode: 'standard' }, { calorieDeficitActive: true, weightTrendPctPerWeek: 0.8 })).toEqual([]);
  });
});

describe('medical advisory (pregnancy/postpartum)', () => {
  it('pregnancy requires medical review in female context', () => {
    const a = athleteContextAdvisory({ sex: 'female', athleteMode: 'female_context', reproductiveContext: 'pregnancy' });
    expect(a.level).toBe('review');
    expect(a.reasons[0]).toContain('Беременность');
  });

  it('postpartum requires medical review', () => {
    const a = athleteContextAdvisory({ sex: 'female', athleteMode: 'female_context', reproductiveContext: 'postpartum' });
    expect(a.level).toBe('review');
  });

  it('standard and plain female context are ok', () => {
    expect(athleteContextAdvisory({ sex: 'male', athleteMode: 'standard' }).level).toBe('ok');
    expect(athleteContextAdvisory({ sex: 'female', athleteMode: 'female_context', reproductiveContext: 'cycle' }).level).toBe('ok');
  });
});

describe('reproductive context options', () => {
  it('provides UI options incl. pregnancy/postpartum', () => {
    const ids = REPRODUCTIVE_CONTEXT_OPTIONS.map(o => o.id);
    expect(ids).toContain('pregnancy');
    expect(ids).toContain('postpartum');
    expect(ids).toContain('menopause');
    expect(REPRODUCTIVE_CONTEXT_OPTIONS.length).toBeGreaterThanOrEqual(7);
    for (const o of REPRODUCTIVE_CONTEXT_OPTIONS) expect(o.label.length).toBeGreaterThan(0);
  });
});
