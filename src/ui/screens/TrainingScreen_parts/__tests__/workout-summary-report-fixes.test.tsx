/**
 * Работа над честностью отчёта: единицы тоннажа, выбор блоков при копировании,
 * недоступный «План → факт», сессии без внешнего веса (вес 0) и duration 0.
 *
 * Отдельный файл, чтобы не раздувать исторический workout-summary-report.test.tsx
 * и не менять его ожидания: поведение старых мест должно остаться прежним.
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react';
import { WorkoutSummaryReport, ReportBlockPicker } from '../WorkoutSummaryReport';
import { ALL_REPORT_BLOCKS, type ReportBlockId } from '../../../../engines/workout-summary.engine';
import { TrainingDiaryHub } from '../TrainingDiaryHub';
import type { WorkoutLog, StrengthLogEntry } from '../../../../core/types';
import type { StrengthDiary } from '../../../../engines/strength-diary.engine';

const mkWorkout = (date: string, duration = 60): WorkoutLog => ({
  id: `w_${date}`,
  date,
  duration,
  overallRPE: 7,
  recoveryBefore: 4,
  split: 'FullBody',
  exercises: [
    {
      id: `${date}_bench`,
      date,
      exerciseId: 'bench_bar',
      exerciseName: 'Жим штанги лёжа',
      isCompound: true,
      weekNumber: 1,
      sets: [
        { weight: 80, reps: 8, rir: 2, rpe: 7 },
        { weight: 80, reps: 8, rir: 1, rpe: 8 },
      ],
      totalVolume: 1280,
      estimated1RM: 101,
    },
    {
      id: `${date}_squat`,
      date,
      exerciseId: 'squat',
      exerciseName: 'Приседания со штангой',
      isCompound: true,
      weekNumber: 1,
      sets: [{ weight: 100, reps: 5, rir: 2, rpe: 7 }],
      totalVolume: 500,
      estimated1RM: 117,
    },
  ] as StrengthLogEntry[],
});

/** Тренировка только из подходов со своим весом: вес 0, повторы > 0. */
const bwWorkout = (date = '2026-11-18', duration = 0): WorkoutLog => ({
  id: `w_${date}`,
  date,
  duration,
  overallRPE: 7,
  recoveryBefore: 4,
  split: 'Свой вес',
  exercises: [
    {
      id: `${date}_pull`,
      date,
      exerciseId: 'pullup',
      exerciseName: 'Подтягивания',
      isCompound: true,
      weekNumber: 1,
      sets: [
        { weight: 0, reps: 10, rir: 2, rpe: 7 },
        { weight: 0, reps: 8, rir: 1, rpe: 8 },
      ],
      totalVolume: 0,
      estimated1RM: 0,
    },
  ] as StrengthLogEntry[],
});

const textOf = (html: string) => html.replace(/<!-- -->/g, '').replace(/<[^>]+>/g, '');

describe('Отчёт: единицы, пустые данные и вес 0', () => {
  it('тоннаж в сравнении — в тех же единицах, что в плитках', () => {
    const benchOnly = (date: string, sets: number): WorkoutLog => {
      const base = mkWorkout(date);
      return {
        ...base,
        exercises: [
          {
            ...base.exercises[0],
            sets: Array.from({ length: sets }, () => ({ weight: 80, reps: 8, rir: 2, rpe: 7 })),
          },
        ] as StrengthLogEntry[],
      };
    };
    const html = renderToStaticMarkup(
      <WorkoutSummaryReport
        workouts={[benchOnly('2026-11-10', 3)]}
        blocks={['totals', 'compare']}
        previousWorkouts={[benchOnly('2026-11-03', 1)]}
        showSelector={false}
      />,
    );
    // 1 920 кг = 1.9 т, прирост 1 280 кг = 1.3 т: в плитке и в сравнении одна шкала.
    expect(html).toContain('1.9 т');
    expect(html).toContain('+1.3 т');
    // Старая подпись «Тоннаж, кг» обещала килограммы, а показывала тонны.
    expect(html).not.toContain('Тоннаж, кг');

    // Спад тоже в тоннах: «-1 280 кг» рядом с «+1.3 т» — та же ошибка единиц.
    const down = renderToStaticMarkup(
      <WorkoutSummaryReport
        workouts={[benchOnly('2026-11-10', 1)]}
        blocks={['totals', 'compare']}
        previousWorkouts={[benchOnly('2026-11-03', 3)]}
        showSelector={false}
      />,
    );
    expect(down).toContain('-1.3 т');
    expect(down).not.toMatch(/-1[\s\u00a0]?280/);
  });

  it('сессия со своим весом: без NaN, Infinity и выдуманных рекордов', () => {
    const html = renderToStaticMarkup(
      <WorkoutSummaryReport workouts={[bwWorkout()]} blocks={ALL_REPORT_BLOCKS} showSelector={false} />,
    );
    const text = textOf(html);
    expect(text).not.toContain('NaN');
    expect(text).not.toContain('Infinity');
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('-0');
    // Тоннаж честно нулевой, подходы без веса названы, e1RM не выдуман.
    expect(text).toContain('0 кг');
    expect(text).toContain('2 подх. без веса');
    expect(text).toContain('e1RM —');
    expect(text).not.toContain('e1RM 0');
    // Рекордов нет: базы для них тоже нет.
    expect(text).not.toContain('Рекорды периода');
  });

  it('одна тренировка: без «/нед», без заглушек и без NaN', () => {
    const html = renderToStaticMarkup(
      <WorkoutSummaryReport workouts={[mkWorkout('2026-11-03')]} blocks={ALL_REPORT_BLOCKS} showSelector={false} />,
    );
    const text = textOf(html);
    expect(text).not.toContain('/нед');
    expect(text).not.toContain('NaN');
    expect(text).not.toContain('Infinity');
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('null');
    // У одной тренировки все цифры реальные: подходы за сессию, а не «/нед».
    expect(text).toContain('подх за сессию');
    // Прочерк в тексте остаётся только в пояснениях («ориентир — доля»),
    // а не вместо данных: ни одной пары «: —» в отчёте быть не должно.
    expect(text).not.toContain(': —');
  });

  it('блок «План → факт» без плана выключен с причиной, с планом — доступен', () => {
    const first = render(
      <WorkoutSummaryReport workouts={[mkWorkout('2026-11-03')]} storageKey="test_fix_plan_block" />,
    );
    const disabled = screen.getByRole('checkbox', { name: /План → факт/ }) as HTMLButtonElement;
    expect(disabled.disabled).toBe(true);
    expect(disabled.getAttribute('aria-disabled')).toBe('true');
    expect(disabled.textContent).toContain('только из плеера');
    first.unmount();

    render(
      <WorkoutSummaryReport
        workouts={[mkWorkout('2026-11-03')]}
        plan={[{ name: 'Жим штанги лёжа', sets: [{ weight: 80, reps: 8 }] }]}
      />,
    );
    const enabled = screen.getByRole('checkbox', { name: /План → факт/ }) as HTMLButtonElement;
    expect(enabled.disabled).toBe(false);
  });

  it('«Показать всё» не включает блоки, которых на экране нет', () => {
    const changes: ReportBlockId[][] = [];
    render(<ReportBlockPicker value={[]} onChange={(next) => changes.push(next)} disabled={['plan']} />);
    fireEvent.click(screen.getByText('Показать всё'));
    expect(changes[0]).toContain('totals');
    expect(changes[0]).not.toContain('plan');
  });
});

describe('Дневник → копирование уважает выбранные блоки', () => {
  const baseProps = {
    diary: {} as any as StrengthDiary,
    diaryStats: [],
    diaryProgress: [],
    historyWorkouts: [mkWorkout('2026-11-10'), mkWorkout('2026-11-05'), mkWorkout('2026-11-03')],
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
    tprofile: {
      weakPoints: [],
      bodyWeight: 80,
      onCourse: false,
      courseIntensity: 1,
      goal: 'bulk',
      level: 'intermediate',
    },
    linked: { profile: { settings: { personal: { height: 175 } } } },
  };
  const stubDiary = new Proxy(
    {},
    {
      get: () => () => Promise.resolve([]),
    },
  ) as unknown as StrengthDiary;

  let writes: string[] = [];
  let origClipboard: any;

  beforeEach(() => {
    localStorage.removeItem('he_workout_report_blocks');
    writes = [];
    origClipboard = (navigator as any).clipboard;
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: (s: string) => {
          writes.push(s);
          return Promise.resolve();
        },
      },
      configurable: true,
    });
  });

  afterEach(() => {
    cleanup();
    Object.defineProperty(navigator, 'clipboard', { value: origClipboard, configurable: true });
  });

  it('выключенный блок не протекает в текст, включённый — есть', async () => {
    render(<TrainingDiaryHub {...baseProps} diary={stubDiary} initialMode="summary" />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Мышцы/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Копировать отчёт|Скопировано/ }));
    });
    const text = writes.join('\n');
    expect(text).toContain('По упражнениям:');
    expect(text).toContain('Жим штанги лёжа:');
    expect(text).not.toContain('По мышцам:');
    expect(text).not.toContain('NaN');
  });
});
