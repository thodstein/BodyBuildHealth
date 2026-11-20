/**
 * set-intensity-ui.test.tsx — «% от лучшего» прямо в подходе.
 *
 * Абсолютный вес без базы не читается: 80 кг могут быть разминкой, а могут —
 * работой на пределе. В подходе показываем e1RM подхода и его долю от лучшего
 * e1RM этого упражнения в истории.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SessionPlayer, type PlayerDay } from '../SessionPlayer';

const LOG_KEY = 'he_workout_log_v2';

const day: PlayerDay = {
  label: 'День 1 — присед',
  exercises: [{
    name: 'Приседания со штангой',
    group: 'legs',
    muscleGroup: 'quads',
    load: 'тяжело',
    restSec: 180,
    targetSets: [{ weight: 80, reps: 5, rir: 2 }],
  } as never],
};

/** Прошлая сессия с лучшим e1RM 117 кг (100 × 5) — база для процентов. */
const seedHistory = () => {
  localStorage.setItem(LOG_KEY, JSON.stringify([{
    sessionId: 'hist-1',
    date: '2026-11-01',
    focus: 'PL',
    weekNumber: 1,
    durationMin: 55,
    startTime: '18:00',
    endTime: '18:55',
    totalVolume: 3000,
    totalSets: 3,
    exercises: [{
      exerciseName: 'Приседания со штангой',
      pattern: 'legs',
      muscleGroup: 'quads',
      sets: [{ setNumber: 1, weightKg: 100, reps: 5, rpe: 8, rir: 2 }],
    }],
  }]));
};

const openMain = () => {
  fireEvent.click(screen.getByText('Начать тренировку'));
  // Фаза «Основная» в степпере — разминку не проходим.
  const main = screen.getAllByText('Основная')[0];
  fireEvent.click(main);
};

describe('SessionPlayer: интенсивность подхода относительно личного лучшего', () => {
  beforeEach(() => { localStorage.clear(); seedHistory(); });
  afterEach(() => { cleanup(); localStorage.clear(); });

  it('показывает процент от лучшего e1RM и сам лучший результат', () => {
    render(<SessionPlayer days={[day]} weekNumber={1} focus="PL" />);
    openMain();
    const badge = document.querySelector('[data-pl-set-intensity]');
    expect(badge).toBeTruthy();
    expect(badge!.textContent).toMatch(/[🎯🏆] \d+(\.\d)?% от лучшего/);
    const rowText = badge!.parentElement!.textContent || '';
    expect(rowText).toContain('лучший 117 кг');
  });

  it('без истории молчит, а не рисует 0%', () => {
    localStorage.clear();
    render(<SessionPlayer days={[day]} weekNumber={1} focus="PL" />);
    openMain();
    expect(document.querySelector('[data-pl-set-intensity]')).toBeNull();
  });
});
