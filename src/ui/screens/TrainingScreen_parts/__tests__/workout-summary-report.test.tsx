import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, fireEvent, screen } from '@testing-library/react';
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
    expect(html).toContain('Интенсивность');
    expect(html).toContain('инт. ');
    expect(html).toContain('Только проблемные (2)');
    expect(html).toContain('ниже MEV');
  });

  it('уважает выбор блоков (только «Общее»)', () => {
    const html = renderToStaticMarkup(<WorkoutSummaryReport workouts={workouts} blocks={['totals']} />);
    expect(html).toContain('Общие показатели');
    expect(html).not.toContain('По упражнениям');
    expect(html).not.toContain('По мышцам');
  });

  it('с историей до периода показывает рекорды даже за одну тренировку', () => {
    const stronger: WorkoutLog = {
      ...mkWorkout('2026-11-10'),
      exercises: [{
        id: '2026-11-10_bench', date: '2026-11-10', exerciseId: 'bench_bar', exerciseName: 'Жим штанги лёжа',
        isCompound: true, weekNumber: 1,
        sets: [{ weight: 85, reps: 8, rir: 2, rpe: 8 }],
        totalVolume: 680, estimated1RM: 108,
      }] as StrengthLogEntry[],
    };
    const html = renderToStaticMarkup(<WorkoutSummaryReport workouts={[stronger]} blocks={['prs']} baselineWorkouts={[mkWorkout('2026-11-01')]} />);
    expect(html).toContain('Рекорды периода');

    const noBase = renderToStaticMarkup(<WorkoutSummaryReport workouts={[stronger]} blocks={['prs']} />);
    expect(noBase).not.toContain('Рекорды периода');
  });

  it('подходы без веса не попадают в тоннаж, но видны в отчёте', () => {
    const pullupWorkout: WorkoutLog = {
      ...mkWorkout('2026-11-12'),
      exercises: [{
        id: '2026-11-12_pullup', date: '2026-11-12', exerciseId: 'pullup', exerciseName: 'Подтягивания',
        isCompound: true, weekNumber: 1,
        sets: [{ weight: 0, reps: 10, rir: 2, rpe: 7 }, { weight: 0, reps: 8, rir: 1, rpe: 8 }],
        totalVolume: 0, estimated1RM: 0,
      }] as StrengthLogEntry[],
    };
    const html = renderToStaticMarkup(<WorkoutSummaryReport workouts={[pullupWorkout]} blocks={['totals']} />);
    expect(html).toContain('2 подх. без веса');
  });

  it('фильтр «только проблемные» оставляет мышцы вне коридора', () => {
    const mixed: WorkoutLog = {
      ...mkWorkout('2026-11-03'),
      exercises: [
        {
          id: '2026-11-03_bench', date: '2026-11-03', exerciseId: 'bench_bar', exerciseName: 'Жим штанги лёжа',
          isCompound: true, weekNumber: 1,
          sets: Array.from({ length: 10 }, () => ({ weight: 80, reps: 8, rir: 2, rpe: 7 })),
          totalVolume: 6400, estimated1RM: 101,
        },
        {
          id: '2026-11-03_squat', date: '2026-11-03', exerciseId: 'squat', exerciseName: 'Приседания со штангой',
          isCompound: true, weekNumber: 1,
          sets: [{ weight: 100, reps: 5, rir: 2, rpe: 7 }],
          totalVolume: 500, estimated1RM: 117,
        },
      ] as StrengthLogEntry[],
    };
    render(<WorkoutSummaryReport workouts={[mixed]} blocks={['muscles']} />);
    expect(screen.getByText('Грудь')).toBeTruthy();
    fireEvent.click(screen.getByText(/Только проблемные/));
    expect(screen.queryByText('Грудь')).toBeNull();
    expect(screen.getByText('Квадрицепсы')).toBeTruthy();
  });

  it('пустая история даёт честное пустое состояние', () => {
    const html = renderToStaticMarkup(<WorkoutSummaryReport workouts={[]} />);
    expect(html).toContain('Нет данных для отчёта');
  });

  it('ReportBlockPicker рендерит чекбоксы всех блоков', () => {
    const html = renderToStaticMarkup(<ReportBlockPicker value={['totals']} onChange={() => {}} />);
    ['Общее', 'Выводы', 'Сравнение', 'Объём', 'Мышцы', 'Упражнения', 'Подходы', 'Движения', 'Тренировки', 'Рекорды'].forEach(label => {
      expect(html).toContain(label);
    });
  });

  it('блок сравнения показывает дельты к прошлому периоду', () => {
    const html = renderToStaticMarkup(
      <WorkoutSummaryReport
        workouts={[mkWorkout('2026-11-10', 'FullBody')]}
        blocks={['compare']}
        previousWorkouts={[mkWorkout('2026-11-03', 'FullBody')]}
        previousLabel="прошлой неделей"
      />,
    );
    expect(html).toContain('Сравнение периодов');
    expect(html).toContain('прошлой неделей');
    expect(html).toContain('без изменений');
  });

  it('без предыдущего периода блок сравнения молчит', () => {
    const html = renderToStaticMarkup(<WorkoutSummaryReport workouts={workouts} blocks={['compare']} />);
    expect(html).not.toContain('Сравнение периодов');
  });

  it('блок «Подходы» показывает каждый подход с весом, повторами и RIR', () => {
    const html = renderToStaticMarkup(<WorkoutSummaryReport workouts={workouts} blocks={['sets']} />);
    expect(html).toContain('Все подходы');
    expect(html).toContain('80×8');
    expect(html).toContain('100×5');
    expect(html).toContain('@2');
    expect(html).not.toContain('По мышцам');
  });

  it('блок выводов показывает наблюдения по периоду', () => {
    const html = renderToStaticMarkup(<WorkoutSummaryReport workouts={workouts} blocks={['insights']} />);
    expect(html).toContain('Выводы');
    expect(html).toContain('Тоннаж недели');
  });

  it('в упражнениях видна прогрессия e1RM (спарклайн и проценты)', () => {
    const html = renderToStaticMarkup(<WorkoutSummaryReport workouts={workouts} blocks={['exercises']} />);
    expect(html).toContain('<polyline');
    expect(html).toContain('→ 0%');
  });

  it('вывод о разгрузке виден, когда объём упал к прошлому периоду', () => {
    const withSets = (date: string, bench: number, squat: number): WorkoutLog => {
      const w = mkWorkout(date);
      const [b, s] = w.exercises as StrengthLogEntry[];
      return {
        ...w,
        exercises: [
          { ...b, sets: Array.from({ length: bench }, () => ({ weight: 80, reps: 8, rir: 2, rpe: 7 })) },
          { ...s, sets: Array.from({ length: squat }, () => ({ weight: 100, reps: 5, rir: 2, rpe: 7 })) },
        ] as StrengthLogEntry[],
      };
    };
    const previous = [withSets('2026-11-02', 6, 6), withSets('2026-11-04', 6, 6)];
    const current = [withSets('2026-11-09', 3, 3), withSets('2026-11-11', 3, 3)];
    render(
      <WorkoutSummaryReport
        workouts={current}
        blocks={['insights']}
        previousWorkouts={previous}
        previousLabel="прошлой неделей"
      />,
    );
    expect(screen.getByText(/Похоже на разгрузку/)).toBeTruthy();
    expect(screen.getByText(/просели 2 мышц/)).toBeTruthy();
  });

  it('длинный список подходов раскрывается целиком', () => {
    const many: WorkoutLog[] = Array.from({ length: 45 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 7, 1 + i));
      return mkWorkout(d.toISOString().slice(0, 10));
    });
    render(<WorkoutSummaryReport workouts={many} blocks={['sets']} />);
    expect(screen.getByText(/Показаны 40 из 45 тренировок/)).toBeTruthy();
    fireEvent.click(screen.getByText('Показать все (45)'));
    expect(screen.getByText(/Показаны 45 из 45 тренировок/)).toBeTruthy();
    expect(screen.getByText('Свернуть')).toBeTruthy();
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
    expect(html).toContain('Сравнение периодов');
  });

  it('legacy-режим «reports» открывает новый отчёт, а не инструменты', () => {
    const html = renderToStaticMarkup(<TrainingDiaryHub {...baseProps} initialMode="reports" />);
    expect(html).toContain('Охват отчёта');
    expect(html).toContain('Неделя');
  });
});
