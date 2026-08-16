import { describe, expect, it } from 'vitest';
import { analyzeTrainingSafety } from '../training-safety.engine';

describe('training-safety.engine', () => {
  it('blocks axial exercise when the profile forbids axial loading', () => {
    const report = analyzeTrainingSafety({
      source: 'bb_auto',
      profile: { avoidAxialLoad: true },
      exercises: [{ id: 'back_squat', name: 'Присед', sets: 3 }],
    });

    expect(report.level).toBe('blocked');
    expect(report.exercises[0]?.blocked).toBe(true);
    expect(report.adjustments.some(adjustment => adjustment.kind === 'exclude_exercise')).toBe(true);
  });

  it('applies ACWR volume adjustment and recommendation', () => {
    const report = analyzeTrainingSafety({ source: 'pl_auto', workload: { acwrRatio: 1.6 } });

    expect(report.level).toBe('dangerous');
    expect(report.adjustments).toContainEqual(expect.objectContaining({ kind: 'volume_multiplier', value: 0.7 }));
    expect(report.recommendations.join(' ')).toContain('Снизить объём');
  });

  it('downgrades HIIT when load and recovery conflict', () => {
    const report = analyzeTrainingSafety({
      source: 'cardio',
      profile: { recovery: 4 },
      workload: { acwrRatio: 1.4 },
      cardio: { type: 'hiit', daysPerWeek: 3, durationMin: 30 },
    });

    expect(report.level).toBe('blocked');
    expect(report.adjustments).toContainEqual(expect.objectContaining({ kind: 'cardio_limit', value: 'zone2' }));
  });

  it('returns a stable safe report for an uncomplicated profile', () => {
    const report = analyzeTrainingSafety({
      source: 'manual_program',
      profile: { sleepHours: 8, stressLevel: 3, recovery: 8 },
      exercises: [{ id: 'hip_thrust', name: 'Hip thrust', techniqueScore: 0.9 }],
    });

    expect(report.level).toBe('safe');
    expect(report.score).toBeGreaterThanOrEqual(80);
    expect(report.issues).toHaveLength(0);
  });

  it('does not mutate the BB exercise and set context', () => {
    const input = {
      source: 'bb_auto' as const,
      profile: { avoidAxialLoad: true },
      plan: {
        weeks: [{ sessions: [{ exercises: [{ id: 'back_squat', name: 'Присед', sets: 4, reps: 6, weight: 120, rir: 2 }] }] }],
      },
    };
    const before = JSON.parse(JSON.stringify(input));

    analyzeTrainingSafety(input);

    expect(input).toEqual(before);
  });
});
