import { describe, expect, it } from 'vitest';
import { plannedEntriesToBridgeSessions, runtimeDaysToBridgeSessions } from '../TrainingCalendarTab';

describe('training runtime bridge', () => {
  it('converts BB runtime days to calendar sessions with exact set data', () => {
    const sessions = runtimeDaysToBridgeSessions({
      track: 'bb',
      week: 3,
      focus: 'BB',
      days: [{
        date: '2026-08-05',
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
        date: '2026-10-05',
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

describe('даты и объёмы плана — без выдумок', () => {
  const exercises = [{ name: 'Жим', targetSets: [{ weight: 80, reps: 10, rir: 2 }] }];

  it('ставит дни плана на startDate + dayOfWeek, а не на 1/2-е число', () => {
    const sessions = runtimeDaysToBridgeSessions(
      {
        track: 'bb',
        week: 1,
        startDate: '2026-11-02',
        days: [
          { label: 'Д1', dayOfWeek: 0, exercises },
          { label: 'Д2', dayOfWeek: 2, exercises },
        ],
      },
      2026,
      10,
    );

    expect(sessions?.map((s: any) => s.date)).toEqual(['2026-11-02', '2026-11-04']);
    expect(sessions?.[0].date).not.toBe('2026-11-01');
    expect(sessions?.[1].date).not.toBe('2026-11-02');
  });

  it('не ставит день плана без даты: дата по индексу — выдумка', () => {
    const sessions = runtimeDaysToBridgeSessions(
      {
        track: 'bb',
        week: 1,
        days: [{ label: 'Без даты', exercises }],
      },
      2026,
      10,
    );

    expect(sessions).toEqual([]);
  });

  it('пропускает явную ISO-дату дня без изменений', () => {
    const sessions = runtimeDaysToBridgeSessions(
      {
        days: [{ label: 'Д', date: '2026-11-15', exercises }],
      },
      2026,
      10,
    );

    expect(sessions?.[0].date).toBe('2026-11-15');
  });

  it('берёт объём и подходы из targetSets, а не из заглушек 3000/15', () => {
    const sessions = plannedEntriesToBridgeSessions([
      {
        date: '2026-11-02',
        focus: 'Жим',
        exercises: [
          {
            name: 'Жим',
            targetSets: [
              { weight: 80, reps: 10 },
              { weight: 82.5, reps: 8 },
            ],
          },
        ],
      },
    ]);

    expect(sessions).toHaveLength(1);
    expect(sessions[0].totalVolume).toBe(1460);
    expect(sessions[0].totalSets).toBe(2);
    expect(sessions[0].totalVolume).not.toBe(3000);
    expect(sessions[0].totalSets).not.toBe(15);
  });

  it('массив плана без дат не превращается в дни по индексу', () => {
    expect(plannedEntriesToBridgeSessions([{ focus: 'День', exercises }])).toEqual([]);
  });
});
