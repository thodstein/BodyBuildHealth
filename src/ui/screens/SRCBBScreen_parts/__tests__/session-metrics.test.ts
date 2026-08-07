import { describe, expect, it } from 'vitest';
import { playerExerciseToSR, computeSessionMetrics } from '../sessionMetrics';
import type { PlayerExercise } from '../SessionPlayer';
import type { WorkoutSession } from '../../../engines/workout-logger.engine';

describe('playerExerciseToSR', () => {
  it('returns null when no valid sets', () => {
    const ex: PlayerExercise = { name: 'Squat', pattern: 'squat', muscleGroup: 'quads', sets: [], targetSets: [] };
    const result = playerExerciseToSR(ex, { sets: [{ weightKg: 0, reps: 0 }] });
    expect(result).toBeNull();
  });

  it('maps exercise with valid sets', () => {
    const ex: PlayerExercise = { name: 'Squat', pattern: 'squat', muscleGroup: 'quads', sets: [], targetSets: [] };
    const result = playerExerciseToSR(ex, {
      sets: [{ weightKg: 100, reps: 5 }, { weightKg: 110, reps: 3 }],
    });
    expect(result).not.toBeNull();
    expect(result!.pm).toBeGreaterThan(100);
    expect(result!.sets.length).toBe(2);
    expect(result!.sets[0].weight).toBe(100);
    expect(result!.sets[1].weight).toBe(110);
  });
});

describe('computeSessionMetrics', () => {
  it('returns null when session or day is null', () => {
    expect(computeSessionMetrics(null, null)).toBeNull();
    expect(computeSessionMetrics({} as WorkoutSession, null)).toBeNull();
  });

  it('computes metrics for a simple session', () => {
    const session: WorkoutSession = {
      sessionId: 's1', date: '2026-07-15', startTime: '10:00', endTime: '11:00', durationMin: 60,
      focus: 'legs', exercises: [], totalVolume: 0, totalSets: 0, totalReps: 0, avgIntensity: 0, prCount: 0, notes: '', weekNumber: 1, mesocycleWeek: 1,
    };
    const day = {
      exercises: [
        { name: 'Squat', pattern: 'squat', muscleGroup: 'quads', sets: [], targetSets: [] } as PlayerExercise,
      ],
    };
    const sessionWithEx: WorkoutSession = {
      ...session,
      exercises: [{
        exerciseId: 'squat', exerciseName: 'Squat', pattern: 'squat', muscleGroup: 'quads', order: 1,
        sets: [{ setNumber: 1, weightKg: 100, reps: 5, rpe: 8, rir: 2, isPR: false, notes: '' }],
        totalVolume: 500, best1RM: 117, avgRPE: 8,
      }],
    };
    const result = computeSessionMetrics(sessionWithEx, day);
    expect(result).not.toBeNull();
    expect(result!.exerciseCount).toBe(1);
    expect(result!.minutes).toBeGreaterThan(0);
  });
});
