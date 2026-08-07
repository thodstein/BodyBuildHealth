import { describe, expect, it } from 'vitest';
import { estimateSessionDifficulty, calcCumulativeLoad } from '../session-metrics-engine';
import type { SessionMetricsInput, CumulativeLoadInput } from '../session-metrics-engine';

describe('estimateSessionDifficulty', () => {
  const baseInput = (overrides?: Partial<SessionMetricsInput>): SessionMetricsInput => ({
    exercises: [
      {
        name: 'Squat', sets: 3, reps: 5, intensity: 80,
        technicalComplexity: 3, cnsDemand: 4,
        jointStress: { knee: 3, hip: 3, spine: 4, shoulder: 1, elbow: 1, ankle: 2 },
        pattern: 'squat', primaryMuscles: ['quads'], secondaryMuscles: ['glutes'],
      },
    ],
    estimatedDurationMin: 60,
    previousFatigue: 0.3,
    priScore: 0.7,
    riskLevel: 'low',
    ...overrides,
  });

  it('returns high for typical session', () => {
    const result = estimateSessionDifficulty(baseInput());
    expect(result.level).toBe('high');
    expect(result.totalScore).toBeGreaterThan(0);
  });

  it('returns medium for low complexity', () => {
    const result = estimateSessionDifficulty(baseInput({
      exercises: [{ name: 'Plank', sets: 2, reps: 30, intensity: 40, technicalComplexity: 1, cnsDemand: 1, jointStress: { knee: 1, hip: 1, spine: 1, shoulder: 1, elbow: 1, ankle: 1 }, pattern: 'core', primaryMuscles: ['core'], secondaryMuscles: [] }],
      estimatedDurationMin: 20, previousFatigue: 0, priScore: 0.9, riskLevel: 'low',
    }));
    expect(result.level).toBe('medium');
  });

  it('returns high for high risk', () => {
    const result = estimateSessionDifficulty(baseInput({ riskLevel: 'high' }));
    expect(result.level).toBe('low');
  });

  it('computes breakdown components', () => {
    const result = estimateSessionDifficulty(baseInput());
    expect(result.breakdown.technical).toBeGreaterThan(0);
    expect(result.breakdown.neural).toBeGreaterThan(0);
    expect(result.breakdown.joint).toBeGreaterThan(0);
    expect(result.breakdown.volume).toBeGreaterThan(0);
  });

  it('returns low for very low intensity and short duration', () => {
    const result = estimateSessionDifficulty(baseInput({
      exercises: [{ name: 'Plank', sets: 1, reps: 10, intensity: 20, technicalComplexity: 1, cnsDemand: 1, jointStress: { knee: 1, hip: 1, spine: 1, shoulder: 1, elbow: 1, ankle: 1 }, pattern: 'core', primaryMuscles: ['core'], secondaryMuscles: [] }],
      estimatedDurationMin: 10, previousFatigue: 0, priScore: 1, riskLevel: 'low',
    }));
    expect(result.level).toBe('low');
  });
});

describe('calcCumulativeLoad', () => {
  const baseSession = (): SessionMetricsInput => ({
    exercises: [
      {
        name: 'Squat', sets: 3, reps: 5, intensity: 80,
        technicalComplexity: 3, cnsDemand: 4,
        jointStress: { knee: 3, hip: 3, spine: 4, shoulder: 1, elbow: 1, ankle: 2 },
        pattern: 'squat', primaryMuscles: ['quads'], secondaryMuscles: ['glutes'],
      },
    ],
    estimatedDurationMin: 60,
    previousFatigue: 0.3,
    priScore: 0.7,
    riskLevel: 'low',
  });

  it('computes weekly volume and pattern load', () => {
    const past = [baseSession(), baseSession()];
    const current = baseSession();
    const result = calcCumulativeLoad({ pastSessions: past, currentSession: current });
    expect(result.weeklyVolumeScore).toBeGreaterThan(0);
    expect(result.patternLoad['squat']).toBeGreaterThan(0);
  });

  it('computes joint and muscle load', () => {
    const result = calcCumulativeLoad({ pastSessions: [baseSession()], currentSession: baseSession() });
    expect(result.jointLoad['knee']).toBeGreaterThan(0);
    expect(result.muscleLoad['quads']).toBeGreaterThan(0);
  });

  it('detects overload', () => {
    const heavy = (): SessionMetricsInput => ({
      ...baseSession(),
      exercises: Array(10).fill(null).map(() => ({
        name: 'Squat', sets: 5, reps: 5, intensity: 90,
        technicalComplexity: 5, cnsDemand: 5,
        jointStress: { knee: 5, hip: 5, spine: 5, shoulder: 5, elbow: 5, ankle: 5 },
        pattern: 'squat', primaryMuscles: ['quads'], secondaryMuscles: [],
      })),
    });
    const result = calcCumulativeLoad({ pastSessions: [heavy(), heavy(), heavy(), heavy(), heavy(), heavy()], currentSession: heavy() });
    expect(result.overload).toBe(true);
  });
});
