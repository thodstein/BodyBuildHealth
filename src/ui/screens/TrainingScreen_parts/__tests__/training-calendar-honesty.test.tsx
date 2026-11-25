/**
 * training-calendar-honesty.test.tsx — четыре запаркованных дефекта календаря:
 *
 * 1. RIR клампится в тех же границах, что RPE (10 − RIR): `rir: 15` больше не даёт
 *    пару «RIR 15 / RPE 0».
 * 2. Дата дня плана: явная дата → якорь (`startDate` + график профиля) → и только
 *    потом `startDate + dayOfWeek`. Раньше `dayOfWeek` перебивал якорь.
 * 3. Экспорт журнала идёт через `core/apk-share` (native — Documents + Share),
 *    а не через `<a download>`, который в WebView теряет файл.
 * 4. Плановый слой пересчитывается по смене графика профиля, а не только по
 *    перезаписи `he_pl_runtime`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { runtimeDaysToBridgeSessions, TrainingCalendarTab } from '../TrainingCalendarTab';
import { saveCsvApk } from '../../../../core/apk-share';

vi.mock('../../../../core/apk-share', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../core/apk-share')>();
  return {
    ...actual,
    saveCsvApk: vi.fn(async () => 'saved'),
    saveTextFileApk: vi.fn(async () => 'saved'),
  };
});

const PLAN_START = '2026-03-02'; // понедельник

const planDayWith = (extra: Record<string, unknown> = {}) => ({
  label: 'День 1',
  exercises: [
    {
      name: 'Жим лёжа',
      muscleGroup: 'chest',
      targetSets: [{ weight: 80, reps: 10, rir: 2 }],
    },
  ],
  ...extra,
});

function seedProfile(weekly: boolean[]) {
  localStorage.setItem(
    'he_profile_v2',
    JSON.stringify({
      settings: {
        training: {
          daysPerWeek: weekly.filter(Boolean).length,
          schedule: { enabled: true, scheduleType: 'weekly', weeklyDays: weekly },
        },
      },
    }),
  );
}

const MON_WED_FRI = [true, false, true, false, true, false, false];
const MON_TO_FRI = [true, true, true, true, true, false, false];

const plannedDates = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('.cal-cell[data-status="planned"]'))
    .map((cell) => cell.getAttribute('data-date'))
    .sort();

describe('TrainingCalendarTab — RIR и якорь', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('RIR клампится в 0…10 и RPE остаётся 10 − RIR', () => {
    localStorage.setItem(
      'he_pl_runtime',
      JSON.stringify({
        track: 'bb',
        week: 1,
        startDate: PLAN_START,
        days: [
          {
            label: 'День 1',
            exercises: [
              {
                name: 'Жим лёжа',
                targetSets: [
                  { weight: 80, reps: 10, rir: 15 },
                  { weight: 80, reps: 10, rir: 3 },
                ],
              },
            ],
          },
        ],
      }),
    );

    const sessions = runtimeDaysToBridgeSessions(JSON.parse(localStorage.getItem('he_pl_runtime')!));
    expect(sessions).not.toBeNull();
    const sets = sessions![0].exercises[0].sets;
    // Границы пары: RIR 15 → 10 и RPE 0, а не «RIR 15 / RPE 0».
    expect(sets[0].rir).toBe(10);
    expect(sets[0].rpe).toBe(0);
    expect(sets[0].plannedRir).toBe(10);
    expect(sets[1].rir).toBe(3);
    expect(sets[1].rpe).toBe(7);
  });

  it('якорь плана важнее dayOfWeek: смена графика двигает дни плана', () => {
    seedProfile(MON_WED_FRI);
    const runtime = {
      track: 'bb',
      week: 1,
      startDate: PLAN_START,
      // День с устаревшим dayOfWeek = 5 (суббота) от прежней раскладки.
      days: [planDayWith({ dayOfWeek: 5 }), planDayWith({ dayOfWeek: 5 })],
    };

    const sessions = runtimeDaysToBridgeSessions(runtime)!;
    // Индекс берётся от якоря по графику профиля, dayOfWeek не перебивает якорь.
    expect(sessions.map((s: any) => s.date)).toEqual(['2026-03-02', '2026-03-04']);
  });

  it('экспорт журнала идёт через apk-share, а не <a download>', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const { container } = render(<TrainingCalendarTab />);
    await waitFor(() => expect(container.querySelectorAll('.cal-cell').length).toBeGreaterThan(0));

    fireEvent.click(container.querySelector('[data-act="export-csv"]')!);
    await waitFor(() => expect(vi.mocked(saveCsvApk)).toHaveBeenCalledTimes(1));
    expect(vi.mocked(saveCsvApk).mock.calls[0][0]).toBe('workouts.csv');
    // Прежний путь (Blob + a.download) не должен использоваться вовсе.
    expect(clickSpy).not.toHaveBeenCalled();
  });
});

describe('TrainingCalendarTab — плановый слой зависит от графика профиля', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 2, 1, 9, 0, 0)); // вс 1 марта, план ещё в будущем
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('смена дней недели в профиле двигает даты плана без перезаписи he_pl_runtime', async () => {
    seedProfile(MON_WED_FRI);
    localStorage.setItem(
      'he_pl_runtime',
      JSON.stringify({
        track: 'bb',
        week: 1,
        startDate: PLAN_START,
        days: Array.from({ length: 5 }, (_, i) => ({ ...planDayWith(), label: `День ${i + 1}` })),
      }),
    );

    const { container } = render(<TrainingCalendarTab />);
    await waitFor(() =>
      expect(plannedDates(container)).toEqual(['2026-03-02', '2026-03-04', '2026-03-06', '2026-03-09', '2026-03-11']),
    );

    // Пользователь поменял график на Пн–Пт: план тот же, даты другие.
    seedProfile(MON_TO_FRI);
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'he_profile_v2' }));
    });

    await waitFor(() =>
      expect(plannedDates(container)).toEqual(['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06']),
    );
    // Пересчёт по графику не превращает будущие дни в «пропущенные».
    expect(container.querySelectorAll('.cal-cell[data-status="missed"]')).toHaveLength(0);
  });
});
