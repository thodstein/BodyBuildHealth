/**
 * bb-contest-prep-female-reds.test.ts — RED-S/низкий жир warning для female
 * в validateBBContestPrepConfig (аддитивно, без изменения расчётов).
 */
import { describe, expect, it } from 'vitest';
import { prepNutritionSignals, validateBBContestPrepConfig, type BBContestPrepConfig, type BBContestPrepPlan } from '../bb-contest-prep.engine';

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

describe('prepNutritionSignals (женская подготовка)', () => {
  const plan = (sex: 'male' | 'female', rate: number): BBContestPrepPlan => ({
    sex,
    category: sex === 'female' ? 'bikini' : 'mens_physique',
    showDate: '2026-12-01',
    preparation: { startDate: '2026-07-01', weeks: 12, finalWeeks: 2, targetRatePctPerWeek: rate, startingWeightKg: 60, currentCalories: 1600, stepsPerDay: 8000, cardioMinutesPerWeek: 180 },
    taper: { enabled: true, weeks: 3, volumeProfile: [0.9, 0.7, 0.6], intensityProfile: [0.95, 0.9, 0.85], rirProfile: [[2, 3], [2, 4], [2, 4]] },
    peakWeek: { enabled: true, strategy: 'conservative', waterMode: 'stable', sodiumMode: 'stable', carbMode: 'moderate' },
    safety: { contraindications: [], warnings: [], requiresReview: false, blockedProtocol: false },
  } as BBContestPrepPlan);

  it('female with rate > 0.5 flags RED-S', () => {
    const s = prepNutritionSignals(plan('female', 0.6));
    expect(s.some(x => x.includes('RED-S'))).toBe(true);
  });

  it('female always includes iron/calcium/cycle notes', () => {
    const s = prepNutritionSignals(plan('female', 0.4));
    expect(s.some(x => x.includes('Железо'))).toBe(true);
    expect(s.some(x => x.includes('Кальций'))).toBe(true);
    expect(s.some(x => x.includes('Цикл'))).toBe(true);
    expect(s.some(x => x.includes('RED-S'))).toBe(false);
  });

  it('male plan yields no signals', () => {
    expect(prepNutritionSignals(plan('male', 0.8))).toEqual([]);
  });
});
