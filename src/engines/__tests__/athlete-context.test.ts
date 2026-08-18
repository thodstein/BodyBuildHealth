import { describe, expect, it } from 'vitest';
import {
  athletePolicyHints,
  athletePolicySummary,
  normalizeAthleteContext,
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
