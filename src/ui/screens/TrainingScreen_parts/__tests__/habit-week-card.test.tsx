import { describe, expect, it, beforeEach, vi } from 'vitest';
import { buildHabitWeek, HABIT_ROWS } from '../diary-cards';
import { upsertWarmupLog } from '../../../../engines/warmup.engine';
import { upsertCooldownLog } from '../../../../engines/cooldown.engine';
import { upsertStretchLog } from '../../../../engines/stretch-session.engine';
import { upsertMobilityCheckin } from '../../../../engines/mobility-protocol.engine';
import { upsertCheckin } from '../../../../engines/mindset-protocol.engine';

describe('buildHabitWeek', () => {
  beforeEach(() => localStorage.clear());

  it('7 дней, начало недели — понедельник', () => {
    const today = new Date('2026-08-17T12:00:00');
    vi.setSystemTime(today);
    const { days } = buildHabitWeek([]);
    expect(days.length).toBe(7);
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    expect(days[0]).toBe(monday.toISOString().slice(0, 10));
    vi.useRealTimers();
  });

  it('отмечает тренировки/разминку/заминку/растяжку/мобильность/психо по дням', () => {
    const today = new Date('2026-08-17T12:00:00');
    vi.setSystemTime(today);
    const base = buildHabitWeek([]);
    const days = base.days;
    const marks = buildHabitWeek([{ date: days[2] + 'T18:00:00' } as any]).marks;
    expect(marks.workout[2]).toBe(true);
    expect(marks.workout[3]).toBe(false);
    upsertWarmupLog({ date: days[0], done: true, quality: 4 });
    upsertCooldownLog({ date: days[1], done: true, quality: 4 });
    upsertStretchLog({ date: days[3], focus: 'legs', durationMin: 15, done: true, quality: 4 });
    upsertMobilityCheckin({ date: days[4], done: true, romScore: 4 });
    upsertCheckin({ date: days[5], confidence: 4, arousal: 3, focus: 4, protocolFollowed: true });
    const m2 = buildHabitWeek([]);
    expect(m2.marks.warmup[0]).toBe(true);
    expect(m2.marks.cooldown[1]).toBe(true);
    expect(m2.marks.stretch[3]).toBe(true);
    expect(m2.marks.mobility[4]).toBe(true);
    expect(m2.marks.mindset[5]).toBe(true);
    vi.useRealTimers();
  });

  it('пропущенные/незавершённые записи не считаются (done=false)', () => {
    const today = new Date('2026-08-17T12:00:00');
    vi.setSystemTime(today);
    const { days, marks } = buildHabitWeek([]);
    upsertWarmupLog({ date: days[0], done: false, skippedReason: 'устал' });
    upsertMobilityCheckin({ date: days[1], done: false, romScore: 0 });
    upsertStretchLog({ date: days[2], focus: 'fullbody', durationMin: 10, done: false, quality: 0 });
    const m2 = buildHabitWeek([]);
    expect(m2.marks.warmup[0]).toBe(false);
    expect(m2.marks.mobility[1]).toBe(false);
    expect(m2.marks.stretch[2]).toBe(false);
    vi.useRealTimers();
  });

  it('6 привычек в HABIT_ROWS (тренировка/разминка/заминка/растяжка/мобильность/психо)', () => {
    expect(HABIT_ROWS.map(r => r.id)).toEqual(['workout', 'warmup', 'cooldown', 'stretch', 'mobility', 'mindset']);
  });
});
