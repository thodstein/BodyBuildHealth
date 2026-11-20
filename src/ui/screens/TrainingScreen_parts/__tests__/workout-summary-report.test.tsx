import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { WorkoutSummaryReport, ReportBlockPicker } from '../WorkoutSummaryReport';
import { TrainingDiaryHub } from '../TrainingDiaryHub';
import type { WorkoutLog, StrengthLogEntry } from '../../../core/types';
import type { StrengthDiary } from '../../../engines/strength-diary.engine';

const mkWorkout = (date: string, split = 'FullBody'): WorkoutLog => ({
  id: `w_${date}`,
  date,
  duration: 60,
  overallRPE: 7,
  recoveryBefore: 4,
  split,
  exercises: [
    {
      id: `${date}_bench`, date, exerciseId: 'bench_bar', exerciseName: 'Жим штанги лёжа',
      isCompound: true, weekNumber: 1,
      sets: [{ weight: 80, reps: 8, rir: 2, rpe: 7 }, { weight: 80, reps: 8, rir: 1, rpe: 8 }],
      totalVolume: 1280, estimated1RM: 101,
    },
    {
      id: `${date}_squat`, date, exerciseId: 'squat', exerciseName: 'Приседания со штангой',
      isCompound: true, weekNumber: 1,
      sets: [{ weight: 100, reps: 5, rir: 2, rpe: 7 }],
      totalVolume: 500, estimated1RM: 117,
    },
  ] as StrengthLogEntry[],
});

const workouts = [mkWorkout('2026-11-03'), mkWorkout('2026-11-05'), mkWorkout('2026-11-10')];

describe('WorkoutSummaryReport', () => {
  it('показывает сводку: общее, объём, мышцы, упражнения, движения', () => {
    const html = renderToStaticMarkup(<WorkoutSummaryReport workouts={workouts} storageKey="test_blocks_report" />);
    expect(html).toContain('Общие показатели');
    expect(html).toContain('Распределение объёма');
    expect(html).toContain('По мышцам');
    expect(html).toContain('По упражнениям');
    expect(html).toContain('Движения (паттерны)');
    expect(html).toContain('По тренировкам');
    expect(html).toContain('Показать всё');
    expect(html).toContain('Жим штанги лёжа');
    expect(html).toContain('подх/нед');
    expect(html).toContain('MEV ');
  });

  it('уважает выбор блоков (только «Общее»)', () => {
    const html = renderToStaticMarkup(<WorkoutSummaryReport workouts={workouts} blocks={['totals']} />);
    expect(html).toContain('Общие показатели');
    expect(html).not.toContain('По упражнениям');
    expect(html).not.toContain('По мышцам');
  });

  it('пустая история даёт честное пустое состояние', () => {
    const html = renderToStaticMarkup(<WorkoutSummaryReport workouts={[]} />);
    expect(html).toContain('Нет данных для отчёта');
  });

  it('ReportBlockPicker рендерит чекбоксы всех блоков', () => {
    const html = renderToStaticMarkup(<ReportBlockPicker value={['totals']} onChange={() => {}} />);
    ['Общее', 'Выводы', 'Объём', 'Мышцы', 'Упражнения', 'Движения', 'Тренировки', 'Рекорды'].forEach(label => {
      expect(html).toContain(label);
    });
  });

  it('блок выводов показывает наблюдения по периоду', () => {
    const html = renderToStaticMarkup(<WorkoutSummaryReport workouts={workouts} blocks={['insights']} />);
    expect(html).toContain('Выводы');
    expect(html).toContain('Тоннаж недели');
  });
});

describe('Дневник → Отчёт', () => {
  const baseProps = {
    diary: {} as any as StrengthDiary,
    diaryStats: [],
    diaryProgress: [],
    historyWorkouts: workouts,
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

  it('режим отчёта даёт выбор охвата: тренировка / несколько / неделя / месяц / всё', () => {
    const html = renderToStaticMarkup(<TrainingDiaryHub {...baseProps} initialMode="summary" />);
    expect(html).toContain('Охват отчёта');
    expect(html).toContain('Несколько');
    expect(html).toContain('Неделя');
    expect(html).toContain('Месяц');
    expect(html).toContain('Всё время');
    expect(html).toContain('Сводный отчёт');
  });

  it('legacy-режим «reports» открывает новый отчёт, а не инструменты', () => {
    const html = renderToStaticMarkup(<TrainingDiaryHub {...baseProps} initialMode="reports" />);
    expect(html).toContain('Охват отчёта');
    expect(html).toContain('Неделя');
  });
});
