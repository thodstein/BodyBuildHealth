import { describe, expect, it } from 'vitest';
import {
  buildActualMapFromWorkoutLogs,
  buildPlannedMapFromBridgeSessions,
  generateCalendarMonth,
  generateTrainingCalendar,
} from '../training-calendar.engine';

describe('training calendar planned duration', () => {
  it('uses a supplied bridge duration and keeps missing duration unknown', () => {
    const sessions = [
      {
        date: '2026-09-25',
        focus: 'BB',
        exercises: [{ exerciseName: 'Жим' }],
        totalSets: 3,
        totalVolume: 300,
        duration: 75,
      },
      {
        date: '2026-09-26',
        focus: 'SRC',
        exercises: [{ exerciseName: 'Присед' }],
        totalSets: 4,
        totalVolume: 400,
      },
    ];

    const planned = buildPlannedMapFromBridgeSessions(sessions, '2026-09-01', '2026-09-30');
    expect(planned.get('2026-09-25')?.duration).toBe(75);
    expect(planned.get('2026-09-26')?.duration).toBeUndefined();

    const actual = buildActualMapFromWorkoutLogs([{ date: '2026-09-25' }], '2026-09-01', '2026-09-30');
    expect(actual.get('2026-09-25')?.duration).toBe(0);

    const month = generateTrainingCalendar(2026, 8, planned, actual);
    const day = month.weeks.flat().find(item => item.date === '2026-09-25');
    expect(day?.plannedDuration).toBe(75);
    expect(day?.actualDuration).toBe(0);
  });

  it('closes a completed day as done when the plan has no duration', () => {
    // generateCalendarMonth: план без длительности + факт выполнения.
    // Раньше compliance = 0 → статус «missed» для тренировки, которая выполнена.
    const month = generateCalendarMonth(
      2026,
      8,
      [{ date: '2026-09-25', focus: 'SRC', exercises: 3 }],
      [{ date: '2026-09-25', completed: true, duration: 65, volume: 400 }],
    );
    const day = month.weeks.flat().find(item => item.date === '2026-09-25');

    expect(day?.actualCompleted).toBe(true);
    expect(day?.status).toBe('done');
    expect(day?.compliance).toBe(100);
  });

  it('still marks a short completed day partial when the plan duration is known', () => {
    const month = generateCalendarMonth(
      2026,
      8,
      [{ date: '2026-09-25', focus: 'SRC', exercises: 3, duration: 90 }],
      [{ date: '2026-09-25', completed: true, duration: 40, volume: 400 }],
    );
    const day = month.weeks.flat().find(item => item.date === '2026-09-25');

    expect(day?.compliance).toBe(44);
    expect(day?.status).toBe('partial');
  });

  it('keeps the live calendar path completing a session without planned duration', () => {
    const planned = buildPlannedMapFromBridgeSessions(
      [{ date: '2026-09-25', focus: 'SRC', exercises: [{ exerciseName: 'Присед' }], totalSets: 4, totalVolume: 400 }],
      '2026-09-01',
      '2026-09-30',
    );
    const actual = buildActualMapFromWorkoutLogs(
      [{ date: '2026-09-25', duration: 65, exercises: [{ exerciseName: 'Присед', sets: [{}], totalVolume: 400 }] }],
      '2026-09-01',
      '2026-09-30',
    );
    const day = generateTrainingCalendar(2026, 8, planned, actual)
      .weeks.flat()
      .find(item => item.date === '2026-09-25');

    expect(planned.get('2026-09-25')?.duration).toBeUndefined();
    expect(day?.actualCompleted).toBe(true);
    expect(day?.status).toBe('done');
    expect(day?.compliance).toBe(100);
  });
});
