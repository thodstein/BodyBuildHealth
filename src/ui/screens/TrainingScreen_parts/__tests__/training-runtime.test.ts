import { describe, expect, it } from 'vitest';
import { runtimeDaysToBridgeSessions } from '../TrainingCalendarTab';

describe('training runtime bridge', () => {
  it('converts BB runtime days to calendar sessions with exact set data', () => {
    const sessions = runtimeDaysToBridgeSessions({
      track: 'bb',
      week: 3,
      focus: 'BB',
      days: [{
        label: 'Нед3 Д1',
        exercises: [{
          name: 'Жим',
          muscleGroup: 'chest',
          targetSets: [
            { weight: 80, reps: 10, rir: 2 },
            { weight: 82.5, reps: 8, rir: 1 },
          ],
        }],
      }],
    }, 2026, 7);

    expect(sessions).toHaveLength(1);
    expect(sessions?.[0].source).toBe('BB');
    expect(sessions?.[0].weekNumber).toBe(3);
    expect(sessions?.[0].exercises[0].sets.map(set => set.weightKg)).toEqual([80, 82.5]);
    expect(sessions?.[0].totalSets).toBe(2);
  });

  it('maps ARM runtime sessions and planned set targets', () => {
    const sessions = runtimeDaysToBridgeSessions({
      track: 'arm',
      week: 2,
      focus: 'ARM',
      days: [{
        label: 'Нед2 Д1',
        durationMin: 55,
        exercises: [{
          name: 'Жим',
          muscleGroup: 'chest',
          targetSets: [{ weight: 60, reps: 6, rir: 2 }],
        }],
      }],
    }, 2026, 9);

    expect(sessions?.[0].source).toBe('ARM');
    expect(sessions?.[0].duration).toBe(55);
    expect(sessions?.[0].exercises[0].sets[0].plannedWeight).toBe(60);
    expect(sessions?.[0].exercises[0].sets[0].plannedReps).toBe(6);
  });

  it('rejects malformed runtime payloads', () => {
    expect(runtimeDaysToBridgeSessions(null, 2026, 7)).toBeNull();
    expect(runtimeDaysToBridgeSessions({ days: [] }, 2026, 7)).toBeNull();
  });
});
