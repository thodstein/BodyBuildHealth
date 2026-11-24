/**
 * training-calendar-planned.test.tsx — календарь показывает только настоящий план:
 * день с реальной датой и фактом не становится «пропущенным» из-за выдуманного
 * объёма, а без плана в localStorage нет ни демо-PPL, ни статусов «Пропущено».
 *
 * Даты дней плана берутся из якоря `he_pl_runtime.startDate` по графику профиля
 * (`planDatesForIndexes`), а не по индексу массива: иначе план встаёт на 1/2/3-е
 * число. В новых кейсах «сегодня» закреплено на дне перед стартом плана — иначе
 * первые дни плана уже в прошлом и календарь честно пометил бы их «Пропущено».
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TrainingCalendarTab } from '../TrainingCalendarTab';
import { StrengthDiary } from '../../../../engines/strength-diary.engine';
import type { WorkoutLog } from '../../../../core/types';

const pad = (n: number) => String(n).padStart(2, '0');

/** День плана с настоящей датой: объём выводится из targetSets (80×10 + 82.5×8 = 1460). */
const planDay = (date: string) => ({
  date,
  focus: 'Жим',
  exercises: [
    {
      name: 'Жим лёжа',
      targetSets: [
        { weight: 80, reps: 10, rir: 2 },
        { weight: 82.5, reps: 8, rir: 1 },
      ],
    },
  ],
});

/** День плана без собственной даты — дату даёт якорь startDate. */
const anchoredDay = (index: number) => ({
  label: `День ${index + 1}`,
  exercises: [
    {
      name: 'Жим лёжа',
      muscleGroup: 'chest',
      targetSets: [{ weight: 70, reps: 8, rir: 2 }],
    },
  ],
});

/** Старт плана — понедельник 2026-03-02 (локально). */
const PLAN_START = '2026-03-02';

function seedProfile(schedule: Record<string, unknown>) {
  localStorage.setItem(
    'he_profile_v2',
    JSON.stringify({
      settings: { training: { daysPerWeek: 3, schedule } },
    }),
  );
}

/** «Сегодня» = воскресенье 2026-03-01: все дни плана из PLAN_START ещё в будущем. */
function freezeDayBeforePlanStart() {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 2, 1, 9, 0, 0));
}

const seededRuntime = (dayCount: number, extra: Record<string, unknown> = {}) => ({
  focus: 'Верх',
  week: 1,
  track: 'bb',
  startDate: PLAN_START,
  days: Array.from({ length: dayCount }, (_, i) => anchoredDay(i)),
  ...extra,
});

/** ISO-даты ячеек со статусом «Запланировано» (атрибут data-date у .cal-cell). */
const plannedDates = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('.cal-cell[data-status="planned"]'))
    .map((cell) => cell.getAttribute('data-date'))
    .sort();

describe('TrainingCalendarTab — только честный план', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('план с реальной датой и фактом не «пропущен», объём не 3000', async () => {
    const now = new Date();
    const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
    localStorage.setItem('he_pl_runtime', JSON.stringify([planDay(date)]));

    const actual = {
      id: 'w1',
      date,
      exercises: [
        {
          exerciseId: 'e1',
          exerciseName: 'Жим лёжа',
          sets: [{ setNumber: 1, weightKg: 50, reps: 10, rpe: 8, rir: 2, isPR: false, notes: '' }],
          totalVolume: 500,
        },
      ],
      duration: 50,
    } as unknown as WorkoutLog;
    vi.spyOn(StrengthDiary.prototype, 'getWorkoutLogs').mockResolvedValue([actual]);

    const { container } = render(<TrainingCalendarTab />);

    await waitFor(() => expect(container.querySelectorAll('.cal-cell').length).toBeGreaterThan(0));
    expect(container.querySelectorAll('.cal-cell[data-status="missed"]')).toHaveLength(0);
    expect(container.querySelector('.cal-cell[data-status="partial"]')).not.toBeNull();

    fireEvent.click(screen.getByText('📆 Неделя'));
    // Объём плана — сумма targetSets (1460), а не выдуманные 3000.
    expect(await screen.findByText('1.5K')).toBeInTheDocument();
    expect(screen.queryByText('3.0K')).toBeNull();
  });

  it('без плана в localStorage нет ни демо-PPL, ни «пропущенных» дней', async () => {
    const { container } = render(<TrainingCalendarTab />);

    await waitFor(() => expect(container.querySelectorAll('.cal-cell').length).toBeGreaterThan(0));
    expect(container.querySelectorAll('.cal-cell[data-status="missed"]')).toHaveLength(0);

    fireEvent.click(screen.getByText('📆 Неделя'));
    expect(screen.queryByText('Push')).toBeNull();
    expect(screen.queryByText('Pull')).toBeNull();
    expect(screen.queryByText('Legs')).toBeNull();
    expect(screen.queryByText('Пропущено')).toBeNull();
  });

  it('startDate + график Пн/Ср/Пт: план встаёт на реальные тренировочные дни', async () => {
    freezeDayBeforePlanStart();
    seedProfile({
      enabled: true,
      scheduleType: 'weekly',
      weeklyDays: [true, false, true, false, true, false, false],
    });
    localStorage.setItem('he_pl_runtime', JSON.stringify(seededRuntime(5)));

    const { container } = render(<TrainingCalendarTab />);
    await waitFor(() => expect(container.querySelectorAll('.cal-cell').length).toBeGreaterThan(0));

    // 1-й, 2-й… 5-й тренировочные дни от понедельника 2026-03-02: Пн/Ср/Пт.
    const expected = ['2026-03-02', '2026-03-04', '2026-03-06', '2026-03-09', '2026-03-11'];
    await waitFor(() => expect(plannedDates(container)).toEqual(expected));
    expect(container.querySelectorAll('.cal-cell[data-status="planned"]')).toHaveLength(5);
    expect(container.querySelectorAll('.cal-cell[data-status="missed"]')).toHaveLength(0);

    fireEvent.click(screen.getByText('📆 Неделя'));
    expect(screen.queryByText('Пропущено')).toBeNull();
  });

  it('pattern «2 через 1»: даты идут по циклу от startDate', async () => {
    freezeDayBeforePlanStart();
    seedProfile({
      enabled: true,
      scheduleType: 'pattern',
      pattern: { work: 2, off: 1 },
    });
    localStorage.setItem('he_pl_runtime', JSON.stringify(seededRuntime(4)));

    const { container } = render(<TrainingCalendarTab />);
    await waitFor(() => expect(container.querySelectorAll('.cal-cell').length).toBeGreaterThan(0));

    // 2 работы / 1 отдых от 2026-03-02: Пн, Вт, (Ср отдых), Чт, Пт.
    const expected = ['2026-03-02', '2026-03-03', '2026-03-05', '2026-03-06'];
    await waitFor(() => expect(plannedDates(container)).toEqual(expected));
    expect(container.querySelectorAll('.cal-cell[data-status="missed"]')).toHaveLength(0);
  });

  it('без startDate и без дат у дней плановых дней нет — регрессии нет', async () => {
    localStorage.setItem(
      'he_pl_runtime',
      JSON.stringify({
        focus: 'Верх',
        week: 1,
        track: 'bb',
        days: Array.from({ length: 5 }, (_, i) => anchoredDay(i)),
      }),
    );

    const { container } = render(<TrainingCalendarTab />);
    await waitFor(() => expect(container.querySelectorAll('.cal-cell').length).toBeGreaterThan(0));

    expect(container.querySelectorAll('.cal-cell[data-status="planned"]')).toHaveLength(0);
    expect(container.querySelectorAll('.cal-cell[data-status="missed"]')).toHaveLength(0);

    fireEvent.click(screen.getByText('📆 Неделя'));
    expect(screen.queryByText('Пропущено')).toBeNull();
  });

  it('план, перезаписанный в том же месяце, появляется без смены месяца', async () => {
    freezeDayBeforePlanStart();
    seedProfile({
      enabled: true,
      scheduleType: 'weekly',
      weeklyDays: [true, false, true, false, true, false, false],
    });
    localStorage.setItem('he_pl_runtime', JSON.stringify(seededRuntime(2)));

    const { container } = render(<TrainingCalendarTab />);
    await waitFor(() => expect(plannedDates(container)).toEqual(['2026-03-02', '2026-03-04']));

    // План перегенерирован в том же месяце: одно окно не получает storage-событие
    // само, поэтому продюсеры/другие окна шлют его синтетически (как DnD-трек).
    localStorage.setItem('he_pl_runtime', JSON.stringify(seededRuntime(4)));
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'he_pl_runtime' }));
    });

    await waitFor(() =>
      expect(plannedDates(container)).toEqual(['2026-03-02', '2026-03-04', '2026-03-06', '2026-03-09']),
    );
  });
});
