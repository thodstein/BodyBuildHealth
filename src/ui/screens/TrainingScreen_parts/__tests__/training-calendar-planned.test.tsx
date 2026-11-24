/**
 * training-calendar-planned.test.tsx — календарь показывает только настоящий план:
 * день с реальной датой и фактом не становится «пропущенным» из-за выдуманного
 * объёма, а без плана в localStorage нет ни демо-PPL, ни статусов «Пропущено».
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

describe('TrainingCalendarTab — только честный план', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
});
