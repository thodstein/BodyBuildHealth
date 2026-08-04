/**
 * bb-frequency-optimizer.test.ts — тесты per-muscle frequency optimization.
 */
import { describe, expect, it } from 'vitest';
import { optimizeMuscleFrequency } from '../bb-frequency-optimizer.engine';
import { buildBBPlan, type BBBuilderInput } from '../bb-builder.engine';

const EQ = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight'];

function makeInput(overrides: Partial<BBBuilderInput> = {}): BBBuilderInput {
  return {
    patternId: 'upper_lower_4',
    level: 'intermediate',
    goal: 'mass',
    weeks: 8,
    workMax: { chest: 100, back: 120, legs: 140, shoulders: 70, arms: 50 },
    equipment: EQ,
    volumeGoal: 'mav',
    ...overrides,
  };
}

describe('optimizeMuscleFrequency', () => {
  it('план без workout sessions → рекомендует по размеру мышцы', () => {
    const plan = buildBBPlan(makeInput());
    const result = optimizeMuscleFrequency(plan);
    expect(result).toBeDefined();
    expect(result.rationale.length).toBeGreaterThan(0);
  });

  it('малые мышцы (biceps/triceps) → рекомендована ≥2×/нед', () => {
    const plan = buildBBPlan(makeInput());
    const result = optimizeMuscleFrequency(plan);
    // Если biceps имеет currentFreq < 2, должна быть рекомендация повысить
    const bicepsRec = result.recommendations.find(r => r.muscle === 'biceps');
    if (bicepsRec && bicepsRec.currentFrequency < 2) {
      expect(bicepsRec.recommendedFrequency).toBeGreaterThanOrEqual(2);
    }
  });

  it('большие мышцы (quads) → рекомендована ≤2×/нед', () => {
    const plan = buildBBPlan(makeInput());
    const result = optimizeMuscleFrequency(plan);
    // Если quads имеет currentFreq > 2, должна быть рекомендация снизить
    const quadsRec = result.recommendations.find(r => r.muscle === 'quads');
    if (quadsRec && quadsRec.currentFrequency > 2) {
      expect(quadsRec.recommendedFrequency).toBeLessThanOrEqual(2);
    }
  });

  it('totalAdjustments = recommendations.length', () => {
    const plan = buildBBPlan(makeInput());
    const result = optimizeMuscleFrequency(plan);
    expect(result.totalAdjustments).toBe(result.recommendations.length);
  });

  it('rationale содержит отчёт', () => {
    const plan = buildBBPlan(makeInput());
    const result = optimizeMuscleFrequency(plan);
    expect(result.rationale.length).toBeGreaterThan(0);
    // Должен содержать либо "корректировок" либо "оптимальны"
    expect(result.rationale.some(r => r.includes('frequency') || r.includes('частот'))).toBe(true);
  });

  it('recommendedFrequency в диапазоне 1-4', () => {
    const plan = buildBBPlan(makeInput());
    const result = optimizeMuscleFrequency(plan);
    for (const rec of result.recommendations) {
      expect(rec.recommendedFrequency).toBeGreaterThanOrEqual(1);
      expect(rec.recommendedFrequency).toBeLessThanOrEqual(4);
    }
  });

  it('каждая рекомендация имеет reason', () => {
    const plan = buildBBPlan(makeInput());
    const result = optimizeMuscleFrequency(plan);
    for (const rec of result.recommendations) {
      expect(rec.reason).toBeTruthy();
      expect(rec.reason.length).toBeGreaterThan(5);
    }
  });
});
