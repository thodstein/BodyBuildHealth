// Честность карточек аналитики дневника: без NaN/Infinity/undefined, без фейкового RPE,
// «Объём по группам» не сваливает актуальные id каталога в other,
// и «Цели недели» в воскресенье считают неделю с понедельника.
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, render } from '@testing-library/react';
import { AnalyticsTab } from '../AnalyticsTab';
import { WeeklyTargetsCard } from '../diary-cards';
import type { WorkoutLog, StrengthLogEntry } from '../../../core/types';

const DAY = 24 * 60 * 60 * 1000;
const isoDay = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);

function mkExercise(
  date: string,
  exerciseId: string,
  exerciseName: string,
  sets: { weight: number; reps: number; rir: number }[],
): StrengthLogEntry {
  return {
    id: `${date}_${exerciseId}`,
    date,
    exerciseId,
    exerciseName,
    isCompound: true,
    weekNumber: 1,
    sets,
    totalVolume: sets.reduce((s, x) => s + x.weight * x.reps, 0),
    estimated1RM: 0,
  };
}

function mkWorkout(date: string, exercises: StrengthLogEntry[]): WorkoutLog {
  return {
    id: `w_${date}_${exercises.map((e) => e.exerciseId).join('_')}`,
    date,
    duration: 60,
    overallRPE: 0,
    recoveryBefore: 0,
    split: 'FullBody',
    notes: '',
    exercises,
  };
}

// Минимальная история: 2 тренировки с id каталога, RPE в подходах нет (только RIR).
const minimalHistory: WorkoutLog[] = [
  mkWorkout(isoDay(-3), [mkExercise(isoDay(-3), 'bench_bar', 'Жим штанги лёжа', [{ weight: 100, reps: 5, rir: 2 }])]),
  mkWorkout(isoDay(-1), [
    mkExercise(isoDay(-1), 'squat', 'Приседания со штангой', [{ weight: 100, reps: 5, rir: 2 }]),
    mkExercise(isoDay(-1), 'rdl', 'Румынская тяга', [{ weight: 100, reps: 5, rir: 2 }]),
  ]),
];

describe('diary analytics — честность', () => {
  it(' AnalyticsTab на минимальной истории не содержит NaN/Infinity/undefined', () => {
    const html = renderToStaticMarkup(<AnalyticsTab sessions={minimalHistory} />);
    expect(html.length).toBeGreaterThan(100);
    expect(html).not.toMatch(/NaN|Infinity/);
    expect(html).not.toContain('undefined');
  });

  it('«Объём по группам мышц» использует актуальные id каталога, а не other', () => {
    const html = renderToStaticMarkup(<AnalyticsTab sessions={minimalHistory} />);
    expect(html).toContain('Объём по группам мышц');
    expect(html).toContain('chest');
    expect(html).toContain('quads');
    expect(html).toContain('hamstrings');
  });

  it('RPE не фабрикуется: у подходов без RPE средний RPE = 0', () => {
    const html = renderToStaticMarkup(<AnalyticsTab sessions={minimalHistory} />);
    expect(html).toContain('RPE avg: 0');
  });
});

describe('WeeklyTargetsCard — начало недели', () => {
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('в воскресенье неделя начинается с прошедшего понедельника, а не с завтрашнего', () => {
    // 22 ноября 2026 — воскресенье.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 22, 12, 0, 0));
    localStorage.clear();

    const wednesday = '2026-11-18';
    const workout = mkWorkout(wednesday, [
      mkExercise(wednesday, 'squat', 'Приседания со штангой', [{ weight: 100, reps: 5, rir: 2 }]),
    ]);

    const { container, unmount } = render(<WeeklyTargetsCard historyWorkouts={[workout]} />);
    const text = container.querySelector('.wt-card')?.textContent || '';
    expect(text).toMatch(/Тренировки\s*1\s*\/\s*4/);
    unmount();
  });
});
