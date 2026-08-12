import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TrainingDiaryHub } from '../TrainingDiaryHub';
import { DiaryRecordingForm } from '../DiaryRecordingForm';
import { QuickEntry } from '../QuickEntry';
import type { WorkoutLog, StrengthLogEntry } from '../../../core/types';
import type { StrengthDiary, WeeklyProgress } from '../../../engines/strength-diary.engine';

const mkWorkout = (date: string, split: string, weight: number): WorkoutLog => ({
  id: `w_${date}`,
  date,
  duration: 65,
  overallRPE: 7,
  recoveryBefore: 5,
  split,
  notes: 'хорошая тренировка',
  exercises: [
    {
      id: `${date}_bench`, date, exerciseId: 'bench_press', exerciseName: 'Жим штанги лёжа', isCompound: true, weekNumber: 1,
      sets: [{ weight, reps: 8, rir: 2, rpe: 7 }, { weight, reps: 6, rir: 1, rpe: 8 }],
      totalVolume: weight * 14, estimated1RM: Math.round(weight * 1.27),
    },
    {
      id: `${date}_squat`, date, exerciseId: 'squat', exerciseName: 'Приседания', isCompound: true, weekNumber: 1,
      sets: [{ weight: weight * 1.2, reps: 5, rir: 2, rpe: 7 }],
      totalVolume: weight * 1.2 * 5, estimated1RM: Math.round(weight * 1.2 * 1.17),
    },
  ] as StrengthLogEntry[],
});

const mkProgress = (): WeeklyProgress[] => [
  { week: 1, year: 2026, totalVolume: 5000, workoutCount: 2, compoundWorkouts: 2, isolationWorkouts: 0, total1RM: 100 },
  { week: 2, year: 2026, totalVolume: 7000, workoutCount: 3, compoundWorkouts: 3, isolationWorkouts: 0, total1RM: 110 },
  { week: 3, year: 2026, totalVolume: 9000, workoutCount: 3, compoundWorkouts: 3, isolationWorkouts: 0, total1RM: 115 },
];

const baseProps = {
  diary: {} as any as StrengthDiary,
  diaryStats: [],
  diaryProgress: mkProgress(),
  historyWorkouts: [
    mkWorkout('2026-08-10', 'PPL', 80),
    mkWorkout('2026-08-08', 'PPL', 77.5),
    mkWorkout('2026-08-05', 'FullBody', 75),
  ],
  macrocycle: null,
  selectedWeek: 1,
  level: 'intermediate',
  onRefresh: () => {},
  trainingOutput: null,
  goal: 'bulk',
  daysPerWeek: 4,
  splitType: 'auto',
  periodizationType: 'auto',
  mesoLength: 12,
  tprofile: { weakPoints: [], bodyWeight: 80, onCourse: false, courseIntensity: 1, goal: 'bulk', level: 'intermediate' },
  linked: { profile: { settings: { personal: { height: 175 } } } },
};

const CASES: [string, string][] = [
  ['record', '⚡ Быстро'],
  ['history', 'История тренировок'],
  ['analytics', 'Объём/нед'],
  ['progress', 'Замеры тела'],
  ['tools', 'Экспорт CSV'],
  ['calendar', ''],
  ['checkin', ''],
  ['mmc', ''],
];

describe('TrainingDiaryHub — все вкладки рендерят контент', () => {
  for (const [mode, marker] of CASES) {
    it(`mode ${mode} рендерится без ошибок${marker ? ` и содержит «${marker}»` : ''}`, () => {
      const html = renderToStaticMarkup(<TrainingDiaryHub {...baseProps} initialMode={mode as any} />);
      expect(html.length).toBeGreaterThan(100);
      if (marker) expect(html).toContain(marker);
    });
  }
});

describe('Формы записи дневника', () => {
  it('DiaryRecordingForm рендерится с заголовком сохранения', () => {
    const html = renderToStaticMarkup(
      <DiaryRecordingForm diary={{ saveWorkoutLog: async () => {}, saveStrengthLog: async () => {} } as any} selectedWeek={1} onSave={() => {}} historyWorkouts={baseProps.historyWorkouts} />
    );
    expect(html).toContain('Записать тренировку');
    expect(html).toContain('Сохран');
  });
  it('QuickEntry рендерится без ошибок', () => {
    const html = renderToStaticMarkup(
      <QuickEntry diary={{ saveWorkoutLog: async () => {} } as any} historyWorkouts={baseProps.historyWorkouts} selectedWeek={1} onSave={() => {}} />
    );
    expect(html.length).toBeGreaterThan(50);
  });
});
