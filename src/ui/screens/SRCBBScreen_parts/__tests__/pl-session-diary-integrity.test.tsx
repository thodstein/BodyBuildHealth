/**
 * pl-session-diary-integrity.test.tsx — Фаза 2 аудита PL-AUTO (P0-2, P0-3, P1-6).
 *
 * Что проверяем поведением плеера (не «наличием строк»):
 *  1. P0-2: веса из прошлой сессии — ПОДСКАЗКА. Ни один подход не считается
 *     записанным, «Все подходы записаны» не появляется, а «OK» пишет ровно один подход;
 *  2. P0-3: «Пропустить упражнение» не дублирует уже записанные подходы и сохраняет
 *     введённый вес незакрытого подхода;
 *  3. P1-6: чек-ин, сохранённый уже после монтирования плеера, пересчитывает тренировку.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { SessionPlayer, type PlayerDay } from '../SessionPlayer';
import { StrengthDiary } from '../../../../engines/strength-diary.engine';
import { loadActiveSession, type WorkoutSession } from '../../../../engines/workout-logger.engine';
import { writePLCheckin, PL_CHECKIN_KEY } from '../../../../engines/lms/pl-readiness-adjust.engine';

const day = (): PlayerDay => ({
  label: 'День 1 · жим',
  exercises: [
    {
      name: 'Жим штанги лёжа',
      muscleGroup: 'chest',
      restSec: 90,
      targetSets: [
        { weight: 80, reps: 8, rir: 2 },
        { weight: 82.5, reps: 8, rir: 2 },
        { weight: 85, reps: 6, rir: 1 },
      ],
    },
  ],
});

const prevSession = (): WorkoutSession => ({
  sessionId: 'prev_1',
  date: '2026-11-20',
  startTime: '10:00',
  endTime: '11:00',
  durationMin: 60,
  focus: 'День 1 · жим',
  exercises: [
    {
      exerciseId: 'bench',
      exerciseName: 'Жим штанги лёжа',
      pattern: 'horizontal_push',
      muscleGroup: 'chest',
      order: 1,
      sets: [1, 2, 3].map((n) => ({
        setNumber: n,
        weightKg: 87.5,
        reps: 8,
        rpe: 8,
        rir: 2,
        isPR: false,
        notes: '',
      })),
      totalVolume: 3 * 87.5 * 8,
      best1RM: 110,
      avgRPE: 8,
    },
  ],
  totalVolume: 3 * 87.5 * 8,
  totalSets: 3,
  totalReps: 24,
  avgIntensity: 8,
  prCount: 0,
  notes: '',
  weekNumber: 1,
  mesocycleWeek: 1,
});

const btn = (root: ParentNode, text: string) =>
  Array.from(root.querySelectorAll('button')).find((b) => (b.textContent || '').includes(text)) as
    HTMLButtonElement | undefined;

const weightInput = (root: ParentNode) => root.querySelector('input[aria-label="вес"]') as HTMLInputElement | null;

function startMain(container: HTMLElement) {
  fireEvent.click(btn(container, 'Начать тренировку')!);
  fireEvent.click(btn(container, 'К основной части')!);
}

describe('SessionPlayer — дневник не врёт (P0-2)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('веса из прошлой сессии — подсказка: подходы не «записаны», OK пишет один подход', async () => {
    vi.spyOn(StrengthDiary.prototype, 'getLastSession').mockResolvedValue(prevSession());
    const { container, unmount } = render(<SessionPlayer days={[day()]} weekNumber={1} focus="PL" />);
    startMain(container);

    // Подсказка появилась и подставлена в поле веса.
    await vi.waitFor(() => {
      expect(container.querySelector('[data-pl="set-prefill"]')).toBeTruthy();
    });
    const w = weightInput(container);
    expect(w?.value).toBe('87.5');

    // Ни один подход не считается записанным: нет свёрнутых строк и нет «всё закрыто».
    expect(container.querySelectorAll('[data-act="edit-set"]').length).toBe(0);
    expect(container.querySelector('[data-act="all-sets-done"]')).toBeNull();
    expect(container.textContent).toContain('0/3 подходов');
    expect(loadActiveSession()).toBeNull();

    // «OK» подтверждает подсказку — и только теперь подход попадает в дневник.
    fireEvent.click(btn(container, 'OK')!);
    const active = loadActiveSession();
    expect(active?.exercises?.[0]?.sets?.length).toBe(1);
    expect(active?.exercises?.[0]?.sets?.[0]?.weightKg).toBe(87.5);
    expect(container.textContent).toContain('1/3 подходов');
    expect(container.querySelector('[data-act="all-sets-done"]')).toBeNull();

    unmount();
  });
});

describe('SessionPlayer — «Пропустить упражнение» (P0-3)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('не дублирует записанные подходы и сохраняет введённый вес незакрытого', () => {
    const { container, unmount } = render(<SessionPlayer days={[day()]} weekNumber={1} focus="PL" />);
    startMain(container);

    // Два подхода записаны руками (80 и 82.5), в третьем введён свой вес.
    fireEvent.click(btn(container, 'OK')!);
    fireEvent.click(btn(container, 'OK')!);
    const w = weightInput(container)!;
    fireEvent.change(w, { target: { value: '90' } });

    fireEvent.click(btn(container, 'Пропустить упражнение')!);

    const sets = loadActiveSession()?.exercises?.[0]?.sets ?? [];
    expect(sets.map((s) => s.setNumber)).toEqual([1, 2, 3]);
    expect(sets.map((s) => s.weightKg)).toEqual([80, 82.5, 90]);
    // Никакой скрытой второй записи по тем же номерам.
    expect(new Set(sets.map((s) => s.setNumber)).size).toBe(3);

    unmount();
  });
});

describe('SessionPlayer — чек-ин обновляет живую сессию (P1-6)', () => {
  beforeEach(() => {
    localStorage.clear();
    try {
      localStorage.removeItem(PL_CHECKIN_KEY);
    } catch {
      /* ignore */
    }
  });
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('сохранённый после монтирования чек-ин пересчитывает сегодняшнюю тренировку', async () => {
    const { container, unmount } = render(<SessionPlayer days={[day()]} weekNumber={1} focus="PL" />);
    // Плеер уже смонтирован (в проведении он только скрывается, не размонтируется).
    expect(container.querySelector('[data-session="readiness"]')).toBeNull();

    act(() => {
      writePLCheckin(localStorage, { sleepHours: 4.5, hrvRatio: 0.7, doms: 8, stress: 8 });
    });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-session="readiness"]')).toBeTruthy();
    });
    expect(container.querySelector('[data-session="readiness"]')!.textContent).toMatch(/Чек-ин: готовность/);

    // И тренировка реально идёт по скорректированному плану: объём ×0.6 (3 → 2 сета),
    // вес ×0.95 (80 → 75 кг), RIR +2 (2 → 4).
    startMain(container);
    expect(container.textContent).toContain('цель 75кг×8@RIR4');
    expect(container.textContent).toContain('0/2 подходов');

    unmount();
  });
});
