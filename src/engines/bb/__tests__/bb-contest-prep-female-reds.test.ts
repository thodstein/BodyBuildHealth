/**
 * bb-contest-prep-female-reds.test.ts — RED-S/низкий жир warning для female
 * в validateBBContestPrepConfig (аддитивно, без изменения расчётов).
 */
import { describe, expect, it } from 'vitest';
import { validateBBContestPrepConfig, type BBContestPrepConfig } from '../bb-contest-prep.engine';

function femaleConfig(overrides: Partial<BBContestPrepConfig> = {}): BBContestPrepConfig {
  return {
    sex: 'female',
    category: 'bikini',
    weightKg: 55,
    experienceLevel: 'intermediate',
    enhanced: false,
    prepCount: 1,
    showDate: '2026-12-01',
    weeksOut: 3,
    trainingProtocol: 'bb',
    carbLoadStrategy: 'moderate',
    waterStrategy: 'minimal',
    sodiumStrategy: 'constant',
    ...overrides,
  };
}

describe('female RED-S warning in contest prep', () => {
  it('low body fat (12%) flags RED-S for female', () => {
    const res = validateBBContestPrepConfig(femaleConfig({ bodyFatPct: 12 }));
    expect(res.ok).toBe(true);
    expect(res.warnings.some(w => w.includes('RED-S') && w.includes('12%'))).toBe(true);
  });

  it('healthy body fat (18%) does not flag RED-S', () => {
    const res = validateBBContestPrepConfig(femaleConfig({ bodyFatPct: 18 }));
    expect(res.warnings.some(w => w.includes('RED-S'))).toBe(false);
  });

  it('male with low body fat is not flagged by the female RED-S rule', () => {
    const res = validateBBContestPrepConfig(femaleConfig({ sex: 'male', category: 'mens_physique', bodyFatPct: 8 }));
    expect(res.warnings.some(w => w.includes('RED-S'))).toBe(false);
  });
});
